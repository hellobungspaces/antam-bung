import { cacheLife } from "next/cache";
import { connection } from "next/server";

type ApiRow = { sell_price: number; buyback_price: number; updated_at: string };
type Result =
  | { ok: true; sell: number; buyback: number; updatedAt: string; history: { date: string; price: number }[] }
  | { ok: false; detail: string };

// Kuota paket gratis hanya 60 hit/bulan, jadi hasil sukses disimpan ~1 hari.
// Satu panggilan sudah memuat harga terbaru + riwayat 30 hari terakhir.
// Kegagalan dikembalikan sebagai data (bukan throw) karena pesan error di dalam
// "use cache" disamarkan di produksi; cuma disimpan 30 detik supaya cepat pulih.
async function getAntam1g(): Promise<Result> {
  "use cache";
  const fail = (detail: string): Result => {
    cacheLife({ stale: 0, revalidate: 30, expire: 60 });
    return { ok: false, detail };
  };

  try {
    const url = "https://emas.maulanar.my.id/api/prices?resource[eq]=antam&weight[eq]=1&sort_by=updated_at&order=desc&limit=30";
    const res = await fetch(url, {
      headers: {
        "X-API-Key": process.env.EMAS_API_KEY ?? "",
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; EmasBungBot/1.0; +https://vercel.com)",
      },
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
      return fail(`Upstream ${res.status}${res.headers.get("cf-mitigated") ? " (cf-mitigated)" : ""}: ${body}`);
    }
    const json = (await res.json()) as { data: ApiRow[] };
    if (!Array.isArray(json.data) || json.data.length === 0) return fail("Data Antam kosong");

    const latest = json.data[0];
    const history = json.data.map((r) => ({ date: r.updated_at.slice(0, 10), price: r.sell_price })).reverse();
    cacheLife({ stale: 3600, revalidate: 86400, expire: 172800 });
    return { ok: true, sell: latest.sell_price, buyback: latest.buyback_price, updatedAt: latest.updated_at, history };
  } catch (err) {
    return fail(err instanceof Error ? `${err.name}: ${err.message}` : "unknown");
  }
}

export async function GET() {
  await connection(); // jalan saat ada request, bukan saat build, supaya error tidak ikut tersimpan
  if (!process.env.EMAS_API_KEY) {
    return Response.json({ error: "EMAS_API_KEY belum diisi" }, { status: 503 });
  }
  const result = await getAntam1g();
  if (!result.ok) {
    console.error("[api/harga]", result.detail);
    return Response.json({ error: "Gagal ambil harga", detail: result.detail }, { status: 502 });
  }
  const { ok, ...data } = result;
  return Response.json(data);
}
