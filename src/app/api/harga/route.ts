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

type PaidRow = { weight: number; sell_price: number; buyback_price: number; updated_at: string };

// API berbayar (emas.maulanar.my.id): riwayat + harga resmi Antam per gramasi.
async function getPaid(query: string): Promise<PaidRow[]> {
  const key = process.env.EMAS_API_KEY;
  if (!key) throw new Error("EMAS_API_KEY belum diset");
  const res = await fetch(`https://emas.maulanar.my.id/api/prices?${query}`, { headers: { Accept: "application/json", "X-API-Key": key } });
  if (!res.ok) throw new Error(`Upstream ${res.status} (emas-api)`);
  const json = (await res.json()) as { data?: PaidRow[] };
  return Array.isArray(json.data) ? json.data : [];
}

const todayWib = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
const isAntam = (t: string) => /antam|lm/i.test(t);

// Harga jual + riwayat: Emas API ID (resource antam = logammulia.com), 1 gram. Kalau scraper-nya tertinggal
// (mis. logammulia.com berubah tampilan), titik hari ini diisi dari agregator hargaemas yang dicocokkan dengan Indogold.
// Buyback: Indogold (Antam 1 gram). Kegagalan dikembalikan sebagai data (bukan throw) karena pesan error di dalam
// "use cache" disamarkan di produksi; cuma disimpan 30 detik supaya cepat pulih.
async function getAntam1g(): Promise<Result> {
  "use cache";
  const fail = (detail: string): Result => {
    cacheLife({ stale: 0, revalidate: 30, expire: 60 });
    return { ok: false, detail };
  };

  try {
    const [hist, recent, bbRows, aggA, aggB] = await Promise.all([
      getPaid("resource[eq]=antam&weight[eq]=1&sort_by=updated_at&order=desc&limit=60"),
      getPaid("resource[eq]=antam&sort_by=updated_at&order=desc&limit=30"),
      getJson("indogold").catch(() => [] as Row[]),
      getJson("hargaemas-com").catch(() => [] as Row[]),
      getJson("hargaemas-net").catch(() => [] as Row[]),
    ]);

    // Satu titik per tanggal (data terbaru di depan)
    const byDate = new Map<string, number>();
    let officialBuyback: number | null = null;
    for (const r of hist) {
      const d = r.updated_at.slice(0, 10);
      if (r.sell_price > 0 && !byDate.has(d)) {
        byDate.set(d, r.sell_price);
        if (byDate.size === 1) officialBuyback = r.buyback_price > 0 ? r.buyback_price : null;
      }
    }
    if (byDate.size === 0) return fail("Data Antam kosong");

    // Harga resmi per gramasi pada tanggal terbaru (harga per gram tiap gramasi tidak sama)
    const latest = [...byDate.keys()][0];
    const prices: Record<string, number> = {};
    for (const r of recent) if (r.updated_at.slice(0, 10) === latest && r.sell_price > 0) prices[String(r.weight)] = r.sell_price;

    let sell = byDate.get(latest)!;
    let updatedAt = latest;
    let antamBuyback = officialBuyback;

    // Scraper tertinggal: isi hari ini dari agregator, hanya kalau harga 1 gram-nya sejalan dengan Indogold (±1%)
    const today = todayWib();
    if (latest < today) {
      const bb1 = (r: Row) => r.weight === 1 && isAntam(r.materialType);
      const indo = bbRows.find((r) => bb1(r) && r.sellPrice > 0)?.sellPrice;
      const agg = [...aggA, ...aggB].filter((r) => r.sellPrice > 0 && isAntam(r.materialType));
      const one = agg.find((r) => r.weight === 1);
      if (one && (!indo || Math.abs(one.sellPrice - indo) / indo <= 0.01)) {
        sell = one.sellPrice;
        updatedAt = today;
        byDate.set(today, sell);
        antamBuyback = agg.find((r) => r.weight === 1 && r.buybackPrice && r.buybackPrice > 0)?.buybackPrice ?? antamBuyback;
        for (const k of Object.keys(prices)) delete prices[k];
        for (const r of agg) prices[String(r.weight)] ??= r.sellPrice;
      }
    }

    const days = [...byDate.entries()].sort(([x], [y]) => x.localeCompare(y)).slice(-30);
    const buyback = bbRows.find((r) => r.materialType === "Antam" && r.weight === 1 && r.buybackPrice)?.buybackPrice ?? null;

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
