// Penyimpanan pengaturan toko di Redis (Upstash lewat Vercel Marketplace), dipanggil lewat REST
// supaya tidak perlu paket tambahan. Nama variabel mengikuti yang dibuat integrasi Vercel.
const URL_ = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

// Mode server aktif hanya kalau penyimpanan DAN ADMIN_PIN sudah diisi, supaya pemilik tidak terkunci.
export const serverModeEnabled = () => Boolean(URL_ && TOKEN && process.env.ADMIN_PIN);

export async function redis(cmd: (string | number)[]): Promise<unknown> {
  if (!URL_ || !TOKEN) throw new Error("Redis belum dikonfigurasi");
  const res = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (json.error) throw new Error(json.error);
  return json.result;
}

export const SETTINGS_KEY = "emasbung:settings";
