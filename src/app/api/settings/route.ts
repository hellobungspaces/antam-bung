import { connection } from "next/server";
import { isAdmin } from "@/lib/server/admin";
import { SETTINGS_KEY, redis, serverModeEnabled } from "@/lib/server/store";

type Settings = {
  inventory: { gram: number; stock: number; discount: number }[];
  spread: number; // persen di bawah harga Antam (0 sampai 5)
  manual: { enabled: boolean; base: number; buyback: number };
};

const num = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;

// Mengembalikan pengaturan yang sudah dibersihkan, atau null kalau bentuknya salah
function validate(body: unknown): Settings | null {
  const b = body as Partial<Settings> | null;
  if (!b || !Array.isArray(b.inventory) || b.inventory.length > 20) return null;
  const inventory = [];
  const seen = new Set<number>();
  for (const i of b.inventory) {
    if (!num(i?.gram, 0.1, 1000) || !num(i?.stock, 0, 9999) || !num(i?.discount, 0, 1_000_000_000)) return null;
    if (seen.has(i.gram)) return null;
    seen.add(i.gram);
    inventory.push({ gram: i.gram, stock: Math.round(i.stock), discount: Math.round(i.discount) });
  }
  if (!num(b.spread, 0, 5)) return null;
  if (typeof b.manual?.enabled !== "boolean" || !num(b.manual.base, 0, 100_000_000) || !num(b.manual.buyback, 0, 100_000_000)) return null;
  return {
    inventory,
    spread: b.spread as number,
    manual: { enabled: b.manual.enabled, base: Math.round(b.manual.base), buyback: Math.round(b.manual.buyback) },
  };
}

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  await connection();
  if (!serverModeEnabled()) return Response.json({ configured: false }, { headers: noStore });
  try {
    const raw = (await redis(["GET", SETTINGS_KEY])) as string | null;
    return Response.json({ configured: true, settings: raw ? (JSON.parse(raw) as Settings) : null }, { headers: noStore });
  } catch (err) {
    console.error("[api/settings GET]", err instanceof Error ? err.message : err);
    // Gagal baca: anggap belum dikonfigurasi supaya halaman tetap jalan dengan data bawaan
    return Response.json({ configured: false }, { headers: noStore });
  }
}

export async function PUT(request: Request) {
  await connection();
  if (!serverModeEnabled()) return Response.json({ error: "Mode server belum aktif" }, { status: 503 });
  if (!isAdmin(request)) return Response.json({ error: "Belum masuk" }, { status: 401 });
  const settings = validate(await request.json().catch(() => null));
  if (!settings) return Response.json({ error: "Data tidak valid" }, { status: 400 });
  try {
    await redis(["SET", SETTINGS_KEY, JSON.stringify(settings)]);
    return Response.json({ ok: true }, { headers: noStore });
  } catch (err) {
    console.error("[api/settings PUT]", err instanceof Error ? err.message : err);
    return Response.json({ error: "Gagal menyimpan" }, { status: 502 });
  }
}
