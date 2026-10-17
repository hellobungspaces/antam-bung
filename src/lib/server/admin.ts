import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE = "eb_admin";
const SESSION_SECONDS = 12 * 60 * 60;

const secret = () => process.env.ADMIN_SECRET ?? `emasbung:${process.env.ADMIN_PIN ?? ""}`;
const mac = (payload: string) => createHmac("sha256", secret()).update(payload).digest("hex");

export function pinMatches(input: string): boolean {
  const expected = process.env.ADMIN_PIN ?? "";
  if (!expected) return false;
  // hash dulu supaya panjangnya sama dan perbandingannya waktu-konstan
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function sessionCookie(): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const value = `${exp}.${mac(String(exp))}`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/api${secure}; Max-Age=${SESSION_SECONDS}`;
}

export function isAdmin(request: Request): boolean {
  const raw = request.headers.get("cookie") ?? "";
  const part = raw.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  if (!part) return false;
  const [exp, sig] = part.slice(COOKIE.length + 1).split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const good = Buffer.from(mac(exp));
  const got = Buffer.from(sig);
  return good.length === got.length && timingSafeEqual(good, got);
}
