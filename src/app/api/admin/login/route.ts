import { connection } from "next/server";
import { pinMatches, sessionCookie } from "@/lib/server/admin";
import { redis, serverModeEnabled } from "@/lib/server/store";

const MAX_TRIES = 8;
const WINDOW_SECONDS = 15 * 60;

export async function POST(request: Request) {
  await connection();
  if (!serverModeEnabled()) return Response.json({ error: "Mode server belum aktif" }, { status: 503 });

  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const key = `emasbung:login:${ip}`;
  try {
    const tries = Number(await redis(["INCR", key]));
    if (tries === 1) await redis(["EXPIRE", key, WINDOW_SECONDS]);
    if (tries > MAX_TRIES) return Response.json({ error: "Terlalu banyak percobaan" }, { status: 429 });

    const body = (await request.json().catch(() => null)) as { pin?: unknown } | null;
    if (typeof body?.pin !== "string" || body.pin.length > 64 || !pinMatches(body.pin)) {
      return Response.json({ error: "PIN salah" }, { status: 401 });
    }
    await redis(["DEL", key]);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", "Set-Cookie": sessionCookie(), "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[api/admin/login]", err instanceof Error ? err.message : err);
    return Response.json({ error: "Gagal memproses" }, { status: 502 });
  }
}
