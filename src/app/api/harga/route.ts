import { cacheLife } from "next/cache";
import { connection } from "next/server";

type ApiRow = { sell_price: number; buyback_price: number; updated_at: string };

// Kuota paket gratis hanya 60 hit/bulan, jadi hasilnya disimpan ~1 hari.
// Satu panggilan sudah memuat harga terbaru + riwayat 30 hari terakhir.
async function getAntam1g() {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 86400, expire: 172800 });

  const url = "https://emas.maulanar.my.id/api/prices?resource[eq]=antam&weight[eq]=1&sort_by=updated_at&order=desc&limit=30";
  const res = await fetch(url, { headers: { "X-API-Key": process.env.EMAS_API_KEY ?? "" } });
  if (!res.ok) throw new Error(`Upstream ${res.status}`);
  const json = (await res.json()) as { data: ApiRow[] };
  if (!Array.isArray(json.data) || json.data.length === 0) throw new Error("Data Antam kosong");

  const latest = json.data[0];
  const history = json.data.map((r) => ({ date: r.updated_at.slice(0, 10), price: r.sell_price })).reverse();
  return { sell: latest.sell_price, buyback: latest.buyback_price, updatedAt: latest.updated_at, history };
}

export async function GET() {
  await connection(); // jalan saat ada request, bukan saat build, supaya error tidak ikut tersimpan
  if (!process.env.EMAS_API_KEY) {
    return Response.json({ error: "EMAS_API_KEY belum diisi" }, { status: 503 });
  }
  try {
    return Response.json(await getAntam1g());
  } catch {
    return Response.json({ error: "Gagal ambil harga" }, { status: 502 });
  }
}
