import { cacheLife } from "next/cache";
import { connection } from "next/server";

const BASE = "https://logam-mulia-api.iamutaki.workers.dev/api/prices";

type Row = { material: string; materialType: string; weight: number; sellPrice: number; buybackPrice: number | null; recordedDate: string };
type Result =
  | { ok: true; sell: number; buyback: number | null; antamBuyback: number | null; updatedAt: string; history: { date: string; price: number }[]; prices: Record<string, number> }
  | { ok: false; detail: string };

async function getJson(path: string): Promise<Row[]> {
  const res = await fetch(`${BASE}/${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Upstream ${res.status} (${path.split("?")[0]})`);
  const json = (await res.json()) as { data?: Row[] };
  return Array.isArray(json.data) ? json.data : [];
}

// Harga jual + riwayat: logammulia.com (Antam resmi), 1 gram. Buyback: Indogold (Antam 1 gram),
// karena logammulia tidak menyediakan harga buyback. API publik tanpa key.
// Kegagalan dikembalikan sebagai data (bukan throw) karena pesan error di dalam
// "use cache" disamarkan di produksi; cuma disimpan 30 detik supaya cepat pulih.
async function getAntam1g(): Promise<Result> {
  "use cache";
  const fail = (detail: string): Result => {
    cacheLife({ stale: 0, revalidate: 30, expire: 60 });
    return { ok: false, detail };
  };

  try {
    const [hist, bbRows, nowRows, aggA, aggB] = await Promise.all([
      getJson("logammulia/history?weight=1&material=gold&length=60"),
      getJson("indogold").catch(() => [] as Row[]),
      getJson("logammulia").catch(() => [] as Row[]),
      getJson("hargaemas-com").catch(() => [] as Row[]),
      getJson("hargaemas-net").catch(() => [] as Row[]),
    ]);

    // Harga resmi per gramasi (harga per gram tiap gramasi tidak sama, jadi jangan dikali 1 gram)
    const prices: Record<string, number> = {};
    for (const r of nowRows) {
      if (r.material === "gold" && r.materialType === "Emas Batangan" && r.sellPrice > 0) prices[String(r.weight)] = r.sellPrice;
    }

    // Satu titik per tanggal (data terbaru di depan), hanya "Emas Batangan" biasa
    const byDate = new Map<string, number>();
    for (const r of hist) {
      if (r.materialType === "Emas Batangan" && r.weight === 1 && !byDate.has(r.recordedDate)) byDate.set(r.recordedDate, r.sellPrice);
    }
    const days = [...byDate.entries()].slice(0, 30).reverse();
    if (days.length === 0) return fail("Data Antam kosong");

    const [updatedAt, sell] = days[days.length - 1];
    const buyback = bbRows.find((r) => r.materialType === "Antam" && r.weight === 1 && r.buybackPrice)?.buybackPrice ?? null;

    // Buyback Antam resmi tidak tersedia (logammulia.com memblokir server). Pembanding diambil dari agregator
    // harga, dan hanya dipakai kalau harga jual 1 gram Antam di sana sama (±0,5%) dengan logammulia.com.
    const antamBuyback =
      [...aggA, ...aggB].find(
        (r) => r.weight === 1 && r.buybackPrice && r.buybackPrice > 0 && /antam|lm|logam mulia/i.test(r.materialType) && Math.abs(r.sellPrice - sell) / sell <= 0.005,
      )?.buybackPrice ?? null;

    cacheLife({ stale: 600, revalidate: 3600, expire: 86400 });
    return { ok: true, sell, buyback, antamBuyback, updatedAt, history: days.map(([date, price]) => ({ date, price })), prices };
  } catch (err) {
    return fail(err instanceof Error ? `${err.name}: ${err.message}` : "unknown");
  }
}

export async function GET() {
  await connection(); // jalan saat ada request, bukan saat build, supaya error tidak ikut tersimpan
  const result = await getAntam1g();
  if (!result.ok) {
    console.error("[api/harga]", result.detail);
    return Response.json({ error: "Gagal ambil harga", detail: result.detail }, { status: 502 });
  }
  const { ok, ...data } = result;
  return Response.json(data);
}
