"use client";
import { useState, useEffect, useLayoutEffect, useRef, useSyncExternalStore, Fragment } from "react";
import { flushSync } from "react-dom";
import {
  ArrowRight,
  ArrowsClockwise,
  CaretDown,
  ChatCircleDots,
  CheckCircle,
  FloppyDisk,
  GraduationCap,
  HandCoins,
  House,
  Info,
  Lock,
  MapPin,
  Minus,
  Money,
  Moon,
  PlayCircle,
  Plus,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sun,
  Tag,
  Trash,
  TrendUp,
  Wallet,
  X,
} from "@phosphor-icons/react";

type WaConfirm = { title: string; lead: string; rows: [string, string][]; note: string; url: string; onOpen?: () => void };
type InventoryItem = { gram: number; stock: number; discount: number };
type CartItem = { gram: number; qty: number; price: number };
type Order = { id: string; name: string; detail: string; status: string };
type PricePoint = { d: string; p: number };

const rp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

// Range harga jual: dari (harga Antam dikurangi spread%) sampai harga Antam. Batas atas tidak pernah
// melebihi harga Antam. Spread diatur di admin (tersimpan di server); ini nilai awalnya.
const DEFAULT_SPREAD_PCT = 0.5;

// Foto batangan per gramasi: /public/images/antam/{gram}-thumb.jpg (daftar) dan {gram}.jpg (diperbesar).
// Kalau fotonya belum ada, tampil kotak angka seperti sebelumnya.
function GramPhoto({ gram, broken, onBroken, onZoom }: { gram: number; broken: boolean; onBroken: () => void; onZoom?: () => void }) {
  if (broken) return <div className="bar-chip">{gram}</div>;
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/images/antam/${gram}-thumb.jpg`}
      alt={`Antam ${gram} gram`}
      width={36}
      height={56}
      loading="lazy"
      decoding="async"
      onError={onBroken}
      className="block h-14 w-9 rounded-md bg-surf object-cover"
    />
  );
  return onZoom ? (
    <button onClick={onZoom} aria-label={`Perbesar foto Antam ${gram} gram`} className="shrink-0 rounded-md active:scale-95">
      {img}
    </button>
  ) : (
    <span className="shrink-0">{img}</span>
  );
}

const compact = (n: number) =>
  n >= 1_000_000
    ? { v: (n / 1_000_000).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), u: "jt" }
    : { v: Math.round(n / 1000).toLocaleString("id-ID"), u: "rb" };

// Harga ditampilkan ringkas: "Rp 2,57–2,60 jt" (bukan Rp 2.572.000), dibulatkan ke ribuan
const priceRange = (n: number, sep = "–", spreadPct = DEFAULT_SPREAD_PCT) => {
  const lo = Math.round((n * (1 - spreadPct / 100)) / 1000) * 1000;
  const hi = Math.round(n / 1000) * 1000;
  const a = compact(lo);
  const b = compact(hi);
  if (a.v === b.v && a.u === b.u) return `Rp ${a.v} ${a.u}`;
  return a.u === b.u ? `Rp ${a.v}${sep}${b.v} ${a.u}` : `Rp ${a.v} ${a.u}${sep}${b.v} ${b.u}`;
};
const DEFAULT_BASE = 2592000;
const YOUTUBE_URL = "https://www.youtube.com/@emasbung";

// "17 OKT 2026" -> "17 Okt"; teks tanggal manual dari admin dipakai apa adanya
const dlabel = (d: string) => {
  const m = d.match(/^(\d{1,2}) ([A-Z]{3}) \d{4}$/);
  return m ? `${m[1]} ${m[2][0]}${m[2].slice(1).toLowerCase()}` : d;
};

const agoLabel = (ms: number) => {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "Diperbarui baru saja";
  if (m < 60) return `Diperbarui ${m} menit lalu`;
  return `Diperbarui ${Math.floor(m / 60)} jam lalu`;
};

const INFO_TABS = [
  { id: "kenalan", label: "Kenalan" },
  { id: "panduan", label: "Panduan" },
  { id: "syariah", label: "Syariah" },
] as const;
type InfoTab = (typeof INFO_TABS)[number]["id"];

// Foto COD: file /images/cod/N.jpg sesuai urutan di sini
const COD_GALLERY = [
  "Klender",
  "Palmerah",
  "Klender",
  "Pulo Gadung",
  "Tanah Koja",
  "Pondok Gede",
  "Rawamangun",
].map((loc, i) => ({ id: i + 1, img: `/images/cod/${i + 1}.jpg`, gram: "Foto COD", loc }));

const THEME_KEY = "emasbung-theme";
const THEME_COLORS = { light: "#faf7ef", dark: "#07130f" };

// Tema aktif dibaca dari DOM (pilihan manual) atau dari pengaturan HP, tanpa state tambahan di komponen
const subscribeTheme = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  window.addEventListener("emasbung-theme", cb);
  return () => {
    mq.removeEventListener("change", cb);
    window.removeEventListener("emasbung-theme", cb);
  };
};
const getIsDark = () => {
  const t = document.documentElement.getAttribute("data-theme");
  return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
};

// Samakan warna bar status browser dengan tema yang dipilih
const applyThemeColor = (t: "light" | "dark") =>
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", THEME_COLORS[t]));

const TABS = [
  { id: "beranda", label: "Home", Icon: House },
  { id: "jual", label: "Buyback", Icon: HandCoins },
  { id: "info", label: "Informasi", Icon: Info },
  { id: "edukasi", label: "Edukasi", Icon: GraduationCap },
];

export default function AdvancedEmasBungPWA() {
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const loadRef = useRef<(() => Promise<void>) | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const isDark = useSyncExternalStore(subscribeTheme, getIsDark, () => false);

  // React (mode dev) bisa menghapus atribut <html> saat remount, jadi pilihan tersimpan dipasang ulang sebelum dicat
  useLayoutEffect(() => {
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (t === "light" || t === "dark") {
        document.documentElement.setAttribute("data-theme", t);
        applyThemeColor(t);
        window.dispatchEvent(new Event("emasbung-theme"));
      }
    } catch {}
  }, []);

  const toggleTheme = () => {
    triggerHaptic();
    const next = isDark ? "light" : "dark";
    const apply = () => {
      document.documentElement.setAttribute("data-theme", next);
      applyThemeColor(next);
      flushSync(() => window.dispatchEvent(new Event("emasbung-theme")));
    };
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce && "startViewTransition" in document) (document as Document & { startViewTransition: (cb: () => void) => unknown }).startViewTransition(apply);
    else apply();
  };

  const [antamSell, setAntamSell] = useState<number | null>(null);
  const [antamBuyback, setAntamBuyback] = useState<number | null>(null);
  const [waConfirm, setWaConfirm] = useState<WaConfirm | null>(null);
  const [pulling, setPulling] = useState(false);
  const [infoTab, setInfoTab] = useState<InfoTab>("kenalan");
  const [range, setRange] = useState<7 | 30>(30);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [updatedAtMs, setUpdatedAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const pullStart = useRef<number | null>(null);

  const [basePrice, setBasePrice] = useState(DEFAULT_BASE);
  const [buybackPrice, setBuybackPrice] = useState(2401000);
  const [currentDate, setCurrentDate] = useState("");
  const [manualPrice, setManualPrice] = useState(false);
  const [spreadPct, setSpreadPct] = useState(DEFAULT_SPREAD_PCT);
  // true kalau penyimpanan server + ADMIN_PIN aktif: stok, diskon, spread, dan harga manual berlaku untuk semua pengunjung
  const [serverMode, setServerMode] = useState(false);
  const [unitPrices, setUnitPrices] = useState<Record<string, number>>({});
  const [isScrolling, setIsScrolling] = useState(false);
  const [history, setHistory] = useState<PricePoint[]>([{ d: "", p: DEFAULT_BASE }]);

  const [inventory, setInventory] = useState<InventoryItem[]>([
    { gram: 0.5, stock: 8, discount: 0 },
    { gram: 1, stock: 12, discount: 0 },
    { gram: 2, stock: 6, discount: 15000 },
    { gram: 3, stock: 4, discount: 20000 },
    { gram: 5, stock: 2, discount: 35000 },
    { gram: 10, stock: 0, discount: 50000 },
    { gram: 25, stock: 1, discount: 75000 },
    { gram: 50, stock: 0, discount: 100000 },
    { gram: 100, stock: 0, discount: 150000 },
  ]);

  const [gallery, setGallery] = useState(COD_GALLERY);

  const [newGram, setNewGram] = useState("");
  const [newStock, setNewStock] = useState("");
  const [newDisc, setNewDisc] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [activeTab, setActiveTab] = useState("beranda");
  const [showCart, setShowCart] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [zoomGram, setZoomGram] = useState<number | null>(null);
  const [showInsight, setShowInsight] = useState(false);
  const [showSoldOut, setShowSoldOut] = useState(false);
  const [brokenPhotos, setBrokenPhotos] = useState<number[]>([]);
  const markBroken = (gram: number) => setBrokenPhotos((b) => (b.includes(gram) ? b : [...b, gram]));
  const [removingItem, setRemovingItem] = useState<number | null>(null);

  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);


  const [tapCount, setTapCount] = useState(0);
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState("price");
  const [pinInput, setPinInput] = useState("");

  const [bbGram, setBbGram] = useState<string>("1");
  const [bbEdition, setBbEdition] = useState<string>("press");
  const [bbCondition, setBbCondition] = useState<string>("mulus");
  const [displayEstimate, setDisplayEstimate] = useState(0);

  const SECRET_PIN = "0000";
  const WA_NUMBER = "628176767166";
  const pr = (n: number, sep?: string) => priceRange(n, sep, spreadPct);

  // Esc menutup foto yang diperbesar / konfirmasi keluar
  useEffect(() => {
    if (zoomGram === null && !showLeaveConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setZoomGram(null);
      setShowLeaveConfirm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomGram, showLeaveConfirm]);

  // Navigasi mengecil saat scroll, kembali normal setelah diam
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      setIsScrolling(true);
      clearTimeout(timer);
      timer = setTimeout(() => setIsScrolling(false), 220);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    setIsMounted(true);
    const months = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];
    const now = new Date();
    const defaultFormattedDate = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

    let manual = false;
    const savedData = localStorage.getItem("emasBungV47");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        manual = parsed.manualPrice === true;
        setManualPrice(manual);
        if (parsed.basePrice) setBasePrice(parsed.basePrice);
        if (parsed.buybackPrice) setBuybackPrice(parsed.buybackPrice);
        if (parsed.inventory) setInventory(parsed.inventory);
        // Galeri bawaan (lama maupun baru) selalu diambil dari kode; hanya galeri yang diubah sendiri lewat admin yang dipertahankan
        const savedGallery: { img: string }[] | undefined = parsed.gallery;
        const isShippedGallery = savedGallery?.every((g) => /^\/images\/cod(\/|2)/.test(g.img));
        if (savedGallery && !isShippedGallery) setGallery(parsed.gallery);
        if (parsed.orders) setOrders(parsed.orders);
        if (parsed.history?.length) setHistory(parsed.history);
        setCurrentDate(parsed.currentDate || defaultFormattedDate);
      } catch (err) {
        console.error("Storage parse error", err);
        setCurrentDate(defaultFormattedDate);
      }
    } else {
      setCurrentDate(defaultFormattedDate);
    }

    // Pengaturan toko (server) + harga otomatis (API). Kalau salah satu gagal, data bawaan/lokal tetap dipakai.
    const loadData = () => {
      const settingsReq = fetch("/api/settings", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const priceReq = fetch("/api/harga", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      return Promise.all([settingsReq, priceReq]).then(([cfg, d]) => {
      const server = cfg?.configured === true;
      setServerMode(server);
      const st = server ? cfg.settings : null;
      if (st) {
        if (Array.isArray(st.inventory)) setInventory(st.inventory);
        if (typeof st.spread === "number") setSpreadPct(st.spread);
      }
      if (d?.sell > 0) setAntamSell(d.sell);
      setAntamBuyback(d?.antamBuyback > 0 ? d.antamBuyback : null);
      const manualOn = server ? st?.manual?.enabled === true : manual;
      setManualPrice(manualOn);
      if (manualOn) {
        if (st?.manual) {
          setBasePrice(st.manual.base);
          setBuybackPrice(st.manual.buyback);
        }
      } else if (d) {
        if (d.sell > 0) setBasePrice(d.sell);
        // Tanggal mengikuti kapan harga diperbarui di sumber data, bukan tanggal HP pengunjung
        const ymd = typeof d.updatedAt === "string" ? d.updatedAt.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
        if (ymd) setCurrentDate(`${Number(ymd[3])} ${months[Number(ymd[2]) - 1]} ${ymd[1]}`);
        if (d.buyback > 0) setBuybackPrice(d.buyback);
        if (d.prices && typeof d.prices === "object") setUnitPrices(d.prices);
        if (Array.isArray(d.history) && d.history.length >= 2) {
          setHistory(
            d.history.map((h: { date: string; price: number }) => {
              const dt = new Date(h.date);
              return { d: `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`, p: h.price };
            }),
          );
        }
      }
      if (d) setUpdatedAtMs(Date.now());
      setNowMs(Date.now());
      setIsLoading(false);
      });
    };
    loadRef.current = loadData;
    loadData();

    // Batas tunggu: kalau server lambat, tampilkan halaman dengan data yang ada
    const loadTimer = setTimeout(() => setIsLoading(false), 3000);

    const tick = setInterval(() => setNowMs(Date.now()), 30000);

    return () => {
      clearTimeout(loadTimer);
      clearInterval(tick);
    };
  }, []);

  const safeBuybackPrice = Number(buybackPrice) || 2401000;
  const bbGramNum = parseFloat(bbGram) || 0;
  const fmtGram = (n: number) => String(Number(n.toFixed(2)));
  let calculatedBbEstimate = safeBuybackPrice * bbGramNum;
  if (bbEdition === "retro") calculatedBbEstimate -= bbGramNum * 10000;
  if (bbCondition === "baret") calculatedBbEstimate -= bbGramNum * 15000;
  calculatedBbEstimate = Math.max(0, Math.round(calculatedBbEstimate));

  useEffect(() => {
    const start = displayEstimate;
    const end = calculatedBbEstimate;
    if (start === end) return;
    const duration = 400;
    const startTime = performance.now();

    const animate = (time: number) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayEstimate(Math.floor(start + (end - start) * easeProgress));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculatedBbEstimate]);

  if (!isMounted) return null;

  const triggerHaptic = () => {
    if (typeof window !== "undefined" && navigator.vibrate) navigator.vibrate(15);
  };

  const PULL_MAX = 90;
  const PULL_TRIGGER = 65;
  const onPullStart = (e: React.TouchEvent) => {
    if (activeTab !== "beranda" || refreshing || window.scrollY > 0) return;
    pullStart.current = e.touches[0].clientY;
    setPulling(true);
  };
  const onPullMove = (e: React.TouchEvent) => {
    if (pullStart.current === null) return;
    const dy = e.touches[0].clientY - pullStart.current;
    if (dy <= 0 || window.scrollY > 0) return setPull(0);
    setPull(Math.min(PULL_MAX, dy * 0.5));
  };
  const onPullEnd = async () => {
    if (pullStart.current === null) return;
    pullStart.current = null;
    setPulling(false);
    if (pull < PULL_TRIGGER) return setPull(0);
    setRefreshing(true);
    setPull(PULL_TRIGGER * 0.6);
    triggerHaptic();
    await loadRef.current?.();
    setRefreshing(false);
    setPull(0);
    notify("Harga diperbarui");
  };

  const notify = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(msg);
    setShowToast(true);
    toastTimer.current = setTimeout(() => setShowToast(false), 2500);
  };

  // Harga resmi per gramasi dari API; kalau tidak ada (atau mode manual) pakai harga 1 gram x berat
  const getProductPrice = (gram: number, discount: number) => {
    const official = manualPrice ? undefined : unitPrices[String(gram)];
    return (official ?? basePrice * gram) - discount;
  };
  const qtyOf = (gram: number) => cart.find((c) => c.gram === gram)?.qty ?? 0;

  // Tambah (+1) atau kurangi (-1) satu pecahan di Keranjang
  const changeQty = (gram: number, delta: number) => {
    const inv = inventory.find((i) => i.gram === gram);
    if (!inv) return;
    const current = qtyOf(gram);
    const next = current + delta;
    if (next < 0) return;
    if (next > inv.stock) {
      notify("Stok tidak cukup, sudah maksimal");
      return;
    }
    triggerHaptic();
    if (next === 0) {
      setCart(cart.filter((c) => c.gram !== gram));
    } else if (current === 0) {
      setCart([...cart, { gram, qty: 1, price: getProductPrice(gram, inv.discount) }]);
      notify(`Antam ${gram}gr masuk Keranjang`);
    } else {
      setCart(cart.map((c) => (c.gram === gram ? { ...c, qty: next } : c)));
    }
  };

  const handleRemoveCartItem = (gram: number) => {
    triggerHaptic();
    setRemovingItem(gram);
    setTimeout(() => {
      setCart((prev) => prev.filter((x) => x.gram !== gram));
      setRemovingItem(null);
    }, 300);
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);
  const totalCartItemsCount = cart.reduce((acc, item) => acc + item.qty, 0);

  const askWa = (c: WaConfirm) => {
    triggerHaptic();
    setWaConfirm(c);
  };

  const handleCheckoutWA = () => {
    if (cart.length === 0) return;
    const itemsText = cart
      .map((item) => `- ${item.qty}x Antam ${item.gram}gr (${pr(item.price, " - ")})`)
      .join("%0a");
    const message = `Halo Emas BUNG! Saya mau order:%0a${itemsText}%0a%0a*Estimasi total: ${pr(cartTotal, " - ")}*%0a(harga final dikonfirmasi saat COD)%0a%0aCOD, cek emas dulu, lalu bayar via BCA a.n. Gilang Segara Bening.%0a%0aSiap janjian?`;

    askWa({
      title: "Buka WhatsApp untuk memesan?",
      lead: "Kamu akan diarahkan ke WhatsApp Bung Gilang untuk memesan emas berikut.",
      rows: [...cart.map((item): [string, string] => [`Antam ${item.gram} gr × ${item.qty}`, pr(item.price * item.qty)]), ["Total", pr(cartTotal)]],
      note: "Pesan sudah terisi otomatis dan bisa kamu edit sebelum dikirim. Pembayaran dilakukan saat COD, setelah emas dicek.",
      url: `https://wa.me/${WA_NUMBER}?text=${message}`,
      onOpen: () => {
        const newOrder = {
          id: `ORD-${Date.now().toString().slice(-4)}`,
          name: "WA Customer",
          detail: `${cart.length} item - ${pr(cartTotal, " - ")}`,
          status: "Pending",
        };
        setOrders([newOrder, ...orders]);
        saveToStorage({ orders: [newOrder, ...orders] });
        setCart([]);
        setShowCart(false);
      },
    });
  };

  const handleBuybackWA = () => {
    const msg = `Halo Bung, saya mau jual (buyback) Antam pecahan *${bbGramNum}gr*.%0aCetakan: ${bbEdition.toUpperCase()}, Kondisi: ${bbCondition.toUpperCase()}.%0aEstimasi sistem: *${rp(displayEstimate)}*. Bisa atur jadwal ketemuan COD?`;
    askWa({
      title: "Buka WhatsApp untuk menjual emas?",
      lead: "Kamu akan diarahkan ke WhatsApp Bung Gilang untuk menjual emas Antam kamu.",
      rows: [
        ["Pecahan", `${bbGramNum} gram`],
        ["Cetakan / kondisi", `${bbEdition === "retro" ? "Klasik" : "CertiCard"} · ${bbCondition === "baret" ? "Baret / Buka Segel" : "Mulus"}`],
        ["Estimasi diterima", rp(displayEstimate)],
      ],
      note: "Harga final dicek saat COD. Pesan sudah terisi otomatis dan bisa kamu edit sebelum dikirim.",
      url: `https://wa.me/${WA_NUMBER}?text=${msg}`,
    });
  };

  const handleChatWA = () =>
    askWa({
      title: "Buka WhatsApp untuk bertanya?",
      lead: "Kamu akan diarahkan ke WhatsApp Bung Gilang untuk menanyakan ketersediaan Antam dan jadwal COD.",
      rows: [["Topik", "Ketersediaan dan jadwal COD"]],
      note: "Pesan pembuka sudah terisi. Kamu bisa menggantinya dengan pertanyaanmu sendiri.",
      url: `https://wa.me/${WA_NUMBER}?text=Halo%20Bung,%20mau%20tanya%20ketersediaan%20Antam%20&%20jadwal%20COD.`,
    });

  const handleLogoTap = () => {
    triggerHaptic();
    const newCount = tapCount + 1;
    setTapCount(newCount);
    if (newCount >= 5) {
      setShowAdminPin(true);
      setTapCount(0);
    }
    setTimeout(() => setTapCount(0), 2000);
  };

  const handlePinSubmit = async () => {
    const pin = pinInput;
    setPinInput("");
    let ok = false;
    if (serverMode) {
      try {
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });
        if (res.status === 429) {
          notify("Terlalu banyak percobaan, coba lagi nanti");
          return;
        }
        ok = res.ok;
      } catch {
        notify("Tidak bisa terhubung, coba lagi");
        return;
      }
    } else {
      // Mode lokal (server belum aktif) hanya untuk pengembangan; di produksi PIN bawaan tidak boleh membuka admin
      if (process.env.NODE_ENV === "production") {
        notify("Admin belum aktif di server");
        return;
      }
      ok = pin === SECRET_PIN;
    }
    if (ok) {
      setShowAdminPin(false);
      setShowAdminPanel(true);
    } else {
      notify("PIN salah, coba lagi");
    }
  };

  const saveToStorage = (partialData: Partial<{ orders: Order[]; history: PricePoint[] }>) => {
    try {
      const existing = JSON.parse(localStorage.getItem("emasBungV47") || "{}");
      const dataToSave = { ...existing, basePrice, buybackPrice, manualPrice, currentDate, inventory, gallery, orders, history, ...partialData };
      localStorage.setItem("emasBungV47", JSON.stringify(dataToSave));
    } catch (error) {
      notify("Penyimpanan lokal penuh");
      console.error(error);
    }
  };

  // Simpan perubahan; kalau harga berubah, titiknya masuk riwayat untuk grafik
  const handleAdminSave = async () => {
    let nextHistory = history;
    if (history[history.length - 1]?.p !== basePrice) {
      nextHistory = [...history, { d: currentDate, p: basePrice }].slice(-30);
      setHistory(nextHistory);
    }
    saveToStorage({ history: nextHistory });
    if (serverMode) {
      try {
        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inventory, spread: spreadPct, manual: { enabled: manualPrice, base: basePrice, buyback: buybackPrice } }),
        });
        if (res.status === 401) {
          notify("Sesi admin habis, masuk lagi");
          setShowAdminPanel(false);
          setShowAdminPin(true);
          return;
        }
        if (!res.ok) {
          notify("Gagal menyimpan ke server");
          return;
        }
      } catch {
        notify("Gagal menyimpan ke server");
        return;
      }
    }
    setShowAdminPanel(false);
    triggerHaptic();
    notify("Perubahan berhasil disimpan");
  };

  // Perbandingan dengan Antam. Harga Bung berupa rentang (batas atas = harga Antam dikurangi diskon), jadi penghematan
  // yang diklaim adalah "hingga" selisih ke batas bawah rentang 1 gram. Hanya tampil kalau datanya lengkap dan hasilnya positif.
  const oneGram = inventory.find((i) => i.gram === 1);
  const bungLo1 = oneGram ? Math.round((getProductPrice(1, oneGram.discount) * (1 - spreadPct / 100)) / 1000) * 1000 : 0;
  // Klaim di tab Info hanya tampil kalau datanya memang mendukung (angkanya tidak ditampilkan)
  const buybackAboveAntam = !!antamBuyback && Number(buybackPrice) > antamBuyback;
  const saveSell = antamSell && oneGram && oneGram.stock > 0 ? Math.round((antamSell - bungLo1) / 1000) * 1000 : 0;


  // Perubahan harga dibanding titik sebelumnya (hanya kalau sudah ada riwayat)
  // Dibanding harga terakhir yang berbeda (akhir pekan/libur harga sama dengan hari sebelumnya)
  const prevPoint = [...history].reverse().find((h) => h.p !== basePrice)?.p ?? null;
  const changePct = history.length >= 2 && prevPoint ? ((basePrice - prevPoint) / prevPoint) * 100 : null;

  // Grafik dari riwayat harga yang benar-benar tersimpan
  const W = 320;
  const H = 84;
  const pts = history.map((h) => h.p);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const chartHist = history.slice(-range);
  const cpts = chartHist.map((h) => h.p);
  const cmin = Math.min(...cpts);
  const cmax = Math.max(...cpts);
  const coords = cpts.map((p, i) => {
    const x = cpts.length === 1 ? W : (i / (cpts.length - 1)) * W;
    const y = cmax === cmin ? H / 2 : 10 + (1 - (p - cmin) / (cmax - cmin)) * (H - 24);
    return [x, y] as const;
  });
  const hasChart = cpts.length >= 2;
  const hi = hoverIdx !== null && hoverIdx < coords.length ? hoverIdx : null;
  const onChartPoint = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setHoverIdx(Math.round(f * (coords.length - 1)));
  };
  const linePath = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

  const fmtPct = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

  // Insight harga: dihitung dari rentang yang sama dengan grafik (7H/30H), hanya fakta harga (bukan saran beli/jual)
  const insight = (() => {
    const n = cpts.length;
    if (n < 3) return null;
    const now = cpts[n - 1];
    const change = (from: number) => ((now - from) / from) * 100;
    const span = `${n} hari`;
    const sinceStart = change(cpts[0]);
    const jt = (v: number) => `Rp ${(v / 1_000_000).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} jt`;
    const at = (v: number) => {
      const d = chartHist[cpts.lastIndexOf(v)]?.d;
      return `${jt(v)}${d ? ` · ${dlabel(d)}` : ""}`;
    };
    const rb = (v: number) => `Rp ${Math.round(Math.abs(v) / 1000).toLocaleString("id-ID")} rb`;
    // Berapa hari berturut-turut harga bergerak ke arah yang sama (hari tanpa perubahan dilewati)
    const dir = Math.sign(now - cpts[n - 2]);
    let streak = 0;
    for (let i = n - 1; i > 0 && dir !== 0; i--) {
      const s = Math.sign(cpts[i] - cpts[i - 1]);
      if (s === dir) streak++;
      else if (s !== 0) break;
    }
    // Terakhir kali harga sama murah (atau sama mahal) dengan hari ini
    const lastAt = (cmp: (v: number) => boolean) => {
      for (let i = n - 2; i >= 0; i--) if (cmp(cpts[i])) return n - 1 - i;
      return null;
    };
    const cheaper = cpts.filter((v) => v > now).length; // hari yang lebih mahal dari hari ini
    const pricier = cpts.filter((v) => v < now).length;
    let headline: string;
    if (cmax === cmin) headline = `Harga stabil ${span} terakhir`;
    else if (now === cmin) headline = `Terendah dalam ${span}. 5 gram lebih hemat ± ${rb(5 * (cmax - now))} dari saat tertinggi`;
    else if (now === cmax) headline = `Tertinggi dalam ${span}. Naik ${rb(now - cmin)}/gram dari titik terendah`;
    else if (streak >= 3) headline = `Sudah ${streak} hari ${dir < 0 ? "turun" : "naik"} berturut-turut, ${dir < 0 ? "−" : "+"}${rb(now - cpts[n - 1 - streak])}/gram`;
    else if (cheaper / n >= 0.8) headline = `Lebih murah dari ${cheaper} dari ${n} hari terakhir. Terakhir semurah ini ${lastAt((v) => v <= now)} hari lalu`.replace(" Terakhir semurah ini null hari lalu", "");
    else if (pricier / n >= 0.8) headline = `Lebih mahal dari ${pricier} dari ${n} hari terakhir. Terakhir setinggi ini ${lastAt((v) => v >= now)} hari lalu`.replace(" Terakhir setinggi ini null hari lalu", "");
    else {
      const d1 = now - cpts[n - 2];
      headline = d1 === 0 ? `Harga tetap sejak kemarin` : `${d1 > 0 ? "Naik" : "Turun"} ${rb(d1)}/gram sejak kemarin. Rentang ${span}: ${rb(cmax - cmin)}/gram`;
    }
    return {
      headline,
      rows: [
        { label: "Dibanding kemarin", pct: change(cpts[n - 2]) },
        ...(n >= 8 ? [{ label: "Dibanding 7 hari lalu", pct: change(cpts[n - 8]) }] : []),
        ...(n >= 25 ? [{ label: `Dibanding ${n} hari lalu`, pct: sinceStart }] : []),
      ],
      low: at(cmin),
      high: at(cmax),
      avg: jt(Math.round(cpts.reduce((x, y) => x + y, 0) / n / 1000) * 1000),
    };
  })();

  // Kartu gramasi (grid 2 kolom): foto besar, harga range, stepper
  const renderCard = (item: InventoryItem, idx: number) => {
    const ready = item.stock > 0;
    const q = qtyOf(item.gram);
    const broken = brokenPhotos.includes(item.gram);
    return (
      <div
        key={item.gram}
        style={{ animationDelay: `${idx * 40}ms` }}
        className={`animate-fade-up flex min-w-0 flex-col overflow-hidden rounded-[18px] ${
          q > 0 ? "bg-sel outline outline-[1.5px] outline-selbd" : "surface"
        }`}
      >
        <button
          onClick={() => setZoomGram(item.gram)}
          aria-label={`Perbesar foto Antam ${item.gram} gram`}
          className={`block aspect-square w-full bg-surf active:opacity-80 ${ready ? "" : "opacity-55"}`}
        >
          {broken ? (
            <span className="grid h-full w-full place-items-center">
              <span className="bar-chip">{item.gram}</span>
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/images/antam/${item.gram}.jpg`}
              alt={`Antam ${item.gram} gram`}
              loading="lazy"
              decoding="async"
              onError={() => markBroken(item.gram)}
              className="block h-full w-full object-cover"
            />
          )}
        </button>
        <div className="flex flex-1 flex-col gap-0.5 px-2.5 pb-2.5 pt-2">
          <p className={`text-[13px] font-extrabold ${ready ? "" : "opacity-55"}`}>Antam {item.gram} gr</p>
          {ready && <p className="text-[11.5px] font-extrabold">{pr(getProductPrice(item.gram, item.discount))}</p>}
          {ready && item.stock <= 2 ? (
            <p className="flex items-center gap-1.5 text-[10.5px] font-extrabold text-warn">
              <span className="h-1.5 w-1.5 rounded-full bg-warn" aria-hidden="true" />
              Sisa {item.stock}
            </p>
          ) : (
            <p className={`text-[10.5px] text-soft ${ready ? "" : "opacity-70"}`}>{ready ? `sisa ${item.stock}` : "Stok kosong"}</p>
          )}
          <div className="mt-2 flex justify-center">
            {ready ? (
              <div className="flex w-full items-center justify-between text-[13px] font-extrabold">
                <button
                  onClick={() => changeQty(item.gram, -1)}
                  disabled={q === 0}
                  aria-label={`Kurangi Antam ${item.gram} gram`}
                  className="relative grid h-8 w-8 place-items-center rounded-full bg-stp text-ico before:absolute before:-inset-1.5 before:content-[''] disabled:opacity-40"
                >
                  <Minus size={14} />
                </button>
                <span className={`w-4 text-center ${q === 0 ? "text-soft" : ""}`}>{q}</span>
                <button
                  onClick={() => changeQty(item.gram, 1)}
                  aria-label={`Tambah Antam ${item.gram} gram`}
                  className="relative grid h-8 w-8 place-items-center rounded-full bg-lime text-limeink before:absolute before:-inset-1.5 before:content-[''] active:scale-90"
                >
                  <Plus size={14} />
                </button>
              </div>
            ) : (
              <a
                href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Halo Bung, Antam ${item.gram} gr ada atau bisa dipesan?`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-1.5 rounded-full bg-lime px-3 py-2 text-[11.5px] font-extrabold text-limeink active:scale-95"
              >
                <ChatCircleDots size={13} aria-hidden="true" /> Tanya stok
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };
  // Tersedia dulu (gramasi terbesar di atas), stok habis dipisah di bawah
  const readyItems = [...inventory].filter((i) => i.stock > 0).sort((a, b) => b.gram - a.gram);
  const soldOutItems = [...inventory].filter((i) => i.stock <= 0).sort((a, b) => b.gram - a.gram);

  return (
    <main className="phone relative mx-auto flex min-h-screen flex-col overflow-x-hidden bg-pbg pb-44 text-ink shadow-[0_0_60px_-10px_rgb(0_0_0/35%)]">
      {/* TOAST */}
      <div
        className={`phone pointer-events-none fixed bottom-44 left-1/2 z-[60] -translate-x-1/2 px-4 transition-all duration-300 ease-out ${
          showToast ? "translate-y-0 scale-100 opacity-100" : "translate-y-8 scale-95 opacity-0"
        }`}
      >
        <div className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-pbg shadow-[0_12px_30px_-6px_rgb(0_0_0/45%)]">
          <CheckCircle size={16} className="shrink-0" />
          <p className="text-xs font-bold">{toastMessage}</p>
        </div>
      </div>

      {/* TOP BAR */}
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <h1
          onClick={handleLogoTap}
          className="flex cursor-pointer select-none items-center gap-2 text-[15px] font-extrabold"
        >
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-lime text-limeink">
            <ShieldCheck size={14} />
          </span>
          Emas BUNG
        </h1>
        <div className="flex gap-2">
          <button
            onClick={toggleTheme}
            aria-label={isDark ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
            className="btn btn-soft h-[34px] w-[34px] rounded-full"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={handleChatWA}
            aria-label="Chat WhatsApp"
            className="btn btn-soft h-[34px] w-[34px] rounded-full"
          >
            <ChatCircleDots size={16} />
          </button>
          <button
            onClick={() => setShowCart(true)}
            aria-label="Buka Keranjang"
            className="btn btn-soft relative h-[34px] w-[34px] rounded-full"
          >
            <ShoppingBag size={16} />
            {totalCartItemsCount > 0 && (
              <span
                key={totalCartItemsCount}
                className="animate-pop absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-lime px-1 text-[10px] font-extrabold text-limeink"
              >
                {totalCartItemsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div
        className="relative flex-1 pt-1"
        onTouchStart={onPullStart}
        onTouchMove={onPullMove}
        onTouchEnd={onPullEnd}
        onTouchCancel={onPullEnd}
      >
        {/* Indikator tarik untuk refresh */}
        <div
          className="pointer-events-none flex items-end justify-center overflow-hidden text-soft"
          style={{ height: pull, transition: pulling ? "none" : "height 0.25s ease" }}
          aria-hidden
        >
          <ArrowsClockwise
            size={18}
            className={`mb-2 ${refreshing ? "animate-spin" : ""}`}
            style={refreshing ? undefined : { transform: `rotate(${pull * 4}deg)`, opacity: Math.min(1, pull / PULL_TRIGGER) }}
          />
        </div>
        {/* BERANDA */}
        {activeTab === "beranda" && (
          <div className="animate-fade">
            <div className="px-4">
              {isLoading ? (
                <div className="skeleton h-3.5 w-36 rounded-md" />
              ) : (
                <p className="text-[11px] font-bold text-soft">Antam 1 gram · {currentDate}</p>
              )}
              {isLoading ? (
                <div className="skeleton mt-1 h-10 w-64 rounded-xl" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <p className="text-[34px] font-extrabold leading-[1.1] tracking-tight">{rp(basePrice)}</p>
                  {changePct !== null && changePct !== 0 && (
                    <em
                      className={`rounded-full px-2 py-0.5 text-[13px] font-extrabold not-italic ${
                        changePct > 0 ? "bg-lime text-limeink" : "bg-danger/15 text-danger"
                      }`}
                    >
                      {changePct > 0 ? "+" : ""}
                      {changePct.toFixed(1).replace(".", ",")}%
                    </em>
                  )}
                </div>
              )}
              <p className="mt-0.5 text-[11px] text-soft">
                Buyback {isLoading ? "..." : rp(buybackPrice)}
                {updatedAtMs !== null && !manualPrice && <> · {agoLabel(nowMs - updatedAtMs)}</>}
              </p>
            </div>

            {/* GRAFIK dari riwayat harga yang tersimpan: ketuk/geser untuk lihat harga per hari */}
            <div className="mt-2 px-4">
              {isLoading ? (
                <>
                  <div className="skeleton h-[84px] w-full rounded-2xl" />
                  <div className="skeleton mt-1.5 h-4 w-44 rounded-md" />
                </>
              ) : hasChart ? (
                <>
                  <div
                    className="relative touch-pan-y"
                    onPointerDown={onChartPoint}
                    onPointerMove={(e) => e.pointerType === "mouse" ? onChartPoint(e) : e.buttons && onChartPoint(e)}
                    onPointerLeave={() => setHoverIdx(null)}
                  >
                    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[84px] w-full" aria-label="Grafik harga">
                      <defs>
                        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="var(--line)" stopOpacity=".35" />
                          <stop offset="1" stopColor="var(--line)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d={`${linePath} L${W} ${H} L0 ${H}Z`} fill="url(#chartFill)" />
                      <path d={linePath} fill="none" stroke="var(--line)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    </svg>
                    {(() => {
                      const [mx, my] = coords[hi ?? coords.length - 1];
                      return (
                        <>
                          {hi !== null && <span className="pointer-events-none absolute top-0 h-full w-px opacity-40" style={{ background: "var(--line)", left: `${(mx / W) * 100}%` }} />}
                          <span
                            className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-[3px] ring-pbg"
                            style={{ background: "var(--line)", left: `${Math.min((mx / W) * 100, 98)}%`, top: `${my}px` }}
                          />
                        </>
                      );
                    })()}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <p className="min-h-4 text-xs font-semibold text-soft">
                      {hi !== null ? (
                        <>
                          {dlabel(chartHist[hi].d)} · <b className="font-semibold">{rp(cpts[hi])}</b>
                        </>
                      ) : (
                        "Ketuk grafik untuk lihat harga"
                      )}
                    </p>
                    <div className="flex gap-4" role="group" aria-label="Rentang grafik">
                      {([7, 30] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => {
                            setRange(r);
                            setHoverIdx(null);
                          }}
                          aria-pressed={range === r}
                          className={`font-sans text-xs font-semibold ${range === r ? "text-soft2" : "text-soft"} ${range === r ? "underline decoration-2 underline-offset-4" : ""}`}
                        >
                          {r}H
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-[84px] items-center justify-center rounded-2xl border-2 border-dashed border-surf px-4 text-center text-[11px] font-semibold text-soft">
                  Grafik muncul setelah harga diperbarui beberapa kali.
                </div>
              )}
            </div>

            {/* INSIGHT HARGA: satu baris, ketuk untuk detail */}
            {isLoading ? (
              <div className="skeleton mx-4 mt-2.5 h-11 rounded-[14px]" />
            ) : insight && (
              <>
                <button
                  onClick={() => setShowInsight(!showInsight)}
                  aria-expanded={showInsight}
                  aria-controls="insight-detail"
                  className="mx-4 mt-2.5 flex w-[calc(100%-2rem)] items-center gap-2 rounded-[14px] bg-surf px-3.5 py-3 text-left font-sans text-xs font-semibold text-soft"
                >
                  <span className="shrink-0 rounded-full bg-lime px-2 py-0.5 text-[11px] font-bold text-limeink">Insight</span>
                  <span className="min-w-0 flex-1 text-xs font-semibold text-soft">{insight.headline}</span>
                  <CaretDown size={16} className={`shrink-0 transition-transform motion-reduce:transition-none ${showInsight ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                {showInsight && (
                  <div id="insight-detail" className="surface animate-fade mx-4 mt-1.5 rounded-[14px] px-3.5 pb-3.5 pt-2">
                    <ul className="flex flex-col gap-1.5 text-xs text-soft2">
                      {insight.rows.map((r) => (
                        <li key={r.label} className="flex justify-between gap-3">
                          <span>{r.label}</span>
                          <b className={`font-extrabold ${r.pct > 0 ? "text-up" : r.pct < 0 ? "text-danger" : "text-ink"}`}>{fmtPct(r.pct)}</b>
                        </li>
                      ))}
                      <li className="flex justify-between gap-3"><span>Terendah</span><b className="font-extrabold text-ink">{insight.low}</b></li>
                      <li className="flex justify-between gap-3"><span>Tertinggi</span><b className="font-extrabold text-ink">{insight.high}</b></li>
                      <li className="flex justify-between gap-3"><span>Rata-rata</span><b className="font-extrabold text-ink">{insight.avg}</b></li>
                    </ul>
                  </div>
                )}
              </>
            )}


            {/* DAFTAR PECAHAN */}
            <div id="daftar" className="mt-4 flex scroll-mt-4 items-baseline justify-between px-4 pb-1.5">
              <h2 className="text-sm font-extrabold">Pilih pecahan</h2>
              <p className="text-[11px] text-soft">{inventory.filter((i) => i.stock > 0).length} gramasi tersedia</p>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 gap-2 px-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="skeleton aspect-[3/4] rounded-[18px]" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 px-3">{readyItems.map((item, idx) => renderCard(item, idx))}</div>
                {soldOutItems.length > 0 && (
                  <>
                    <button
                      onClick={() => setShowSoldOut(!showSoldOut)}
                      aria-expanded={showSoldOut}
                      aria-controls="stok-habis"
                      className="mx-3 mt-4 flex w-[calc(100%-1.5rem)] items-center justify-between rounded-2xl border-[1.5px] border-dashed border-zero bg-transparent px-3.5 py-3 text-[12.5px] font-extrabold text-soft2"
                    >
                      <span>Stok habis ({soldOutItems.length})</span>
                      <CaretDown size={18} className={`transition-transform motion-reduce:transition-none ${showSoldOut ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                    {showSoldOut && (
                      <div id="stok-habis" className="mt-2 grid grid-cols-2 gap-2 px-3">
                        {soldOutItems.map((item, idx) => renderCard(item, idx))}
                      </div>
                    )}
                  </>
                )}

              </>
            )}
          </div>
        )}

        {/* JUAL / BUYBACK */}
        {activeTab === "jual" && (
          <section className="animate-fade px-4">
            <h2 className="text-2xl font-extrabold tracking-tight">Buyback Emas</h2>
            <p className="mb-4 text-xs font-semibold text-soft">
              Hitung estimasi pencairan emas Antam kamu.
            </p>

            <div className="space-y-5">
              <div>
                <label htmlFor="bb-gram" className="mb-2 block text-xs font-extrabold text-ico">1. Berat emas</label>
                <div className="flex items-center gap-2 rounded-[18px] bg-surf p-1.5">
                  <button
                    type="button"
                    aria-label="Kurangi satu gram"
                    onClick={() => { triggerHaptic(); setBbGram(fmtGram(Math.max(0.5, bbGramNum - 1))); }}
                    className="grid h-11 w-11 place-items-center rounded-[14px] bg-pbg text-ink active:scale-95"
                  >
                    <Minus size={18} />
                  </button>
                  <div className="flex flex-1 items-baseline justify-center gap-1.5">
                    <input
                      id="bb-gram"
                      type="number"
                      inputMode="decimal"
                      min="0.1"
                      step="any"
                      value={bbGram}
                      onChange={(e) => setBbGram(e.target.value)}
                      className="w-16 bg-transparent text-center outline-none"
                      style={{ fontSize: 24, fontWeight: 800 }}
                      placeholder="0"
                    />
                    <span className="text-[13px] font-bold text-soft">gram</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Tambah satu gram"
                    onClick={() => { triggerHaptic(); setBbGram(fmtGram(bbGramNum + 1)); }}
                    className="grid h-11 w-11 place-items-center rounded-[14px] bg-lime text-limeink active:scale-95"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[1, 2, 5, 10, 25].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => { triggerHaptic(); setBbGram(String(g)); }}
                      aria-pressed={bbGramNum === g}
                      className={`rounded-full px-3.5 py-1.5 ${bbGramNum === g ? "bg-sel text-ink outline outline-2 -outline-offset-2 outline-selbd" : "bg-surf text-soft2"}`}
                    >
                      <span className="text-xs font-extrabold">{g}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-extrabold text-ico">2. Edisi cetakan</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: "press", title: "CertiCard", sub: "Kemasan press" },
                    { id: "retro", title: "Klasik", sub: "- Rp 10rb/gr" },
                  ].map((o) => (
                    <button
                      key={o.id}
                      onClick={() => {
                        triggerHaptic();
                        setBbEdition(o.id);
                      }}
                      className={`rounded-2xl p-3 text-center transition-all active:scale-95 ${
                        bbEdition === o.id ? "bg-sel outline outline-[1.5px] outline-selbd" : "surface text-soft"
                      }`}
                    >
                      <span className="block text-sm font-extrabold text-ink">{o.title}</span>
                      <span className="mt-0.5 block text-[11px] font-semibold">{o.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-extrabold text-ico">3. Kondisi emas</p>
                <div className="space-y-2">
                  {[
                    { id: "mulus", title: "Mulus 100%", sub: "Harga normal" },
                    { id: "baret", title: "Baret / Buka Segel", sub: "- Rp 15rb/gr" },
                  ].map((o) => (
                    <button
                      key={o.id}
                      onClick={() => {
                        triggerHaptic();
                        setBbCondition(o.id);
                      }}
                      className={`flex w-full items-center justify-between rounded-2xl p-3 transition-all active:scale-95 ${
                        bbCondition === o.id ? "bg-sel outline outline-[1.5px] outline-selbd" : "surface text-soft"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={`grid h-5 w-5 place-items-center rounded-full border-2 ${
                            bbCondition === o.id ? "border-ico" : "border-zero"
                          }`}
                        >
                          {bbCondition === o.id && <span className="h-2.5 w-2.5 rounded-full bg-ico" />}
                        </span>
                        <span className="text-sm font-extrabold text-ink">{o.title}</span>
                      </span>
                      <span className="text-[11px] font-semibold">{o.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="surface rounded-3xl p-2">
                <div className="px-3 pb-3.5 pt-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-soft">
                    <Wallet size={14} /> Estimasi yang kamu terima
                  </p>
                  <p className="text-4xl font-extrabold tracking-tight">{rp(displayEstimate)}</p>
                  <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-soft">
                    <Info size={12} /> Harga final dicek saat COD.
                  </p>
                </div>
                <button onClick={handleBuybackWA} className="btn btn-wa w-full py-4 text-sm">
                  <ChatCircleDots size={18} /> Lanjut via WhatsApp
                </button>
              </div>
            </div>
          </section>
        )}

        {/* INFO */}
        {activeTab === "info" && (
          <section className="animate-fade space-y-5 px-4">
            {/* Tiga tab di dalam Info supaya tidak satu halaman panjang */}
            <div className="flex gap-0.5 rounded-full bg-surf p-[3px]" role="tablist" aria-label="Bagian Info">
              {INFO_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={infoTab === t.id}
                  onClick={() => setInfoTab(t.id)}
                  className={`min-h-11 flex-1 rounded-full text-xs font-extrabold ${infoTab === t.id ? "bg-ink text-pbg" : "text-soft"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {infoTab === "kenalan" && (
              <div key="kenalan" className="animate-fade space-y-5">
                {/* Kenapa beli di Bung, di bawah galeri */}
                <div id="info-kenapa" className="scroll-mt-4">
                  <h2 className="text-2xl font-extrabold tracking-tight">Kenapa beli di Bung</h2>
                  <p className="mb-3 text-xs font-semibold text-soft">Nggak perlu percaya omongan, cek sendiri aja</p>
                  <div className="surface divide-y divide-surf px-4">
                    {[
                      ...(saveSell >= 1000 ? [{ Icon: Tag, title: "Lebih murah dari Antam", desc: "Harganya di bawah harga resmi Antam." }] : []),
                      ...(buybackAboveAntam ? [{ Icon: TrendUp, title: "Buyback lebih tinggi", desc: "Emasmu dihargai lebih tinggi dari perkiraan buyback Antam." }] : []),
                      { Icon: Money, title: "Cairnya langsung", desc: "Ketemu, cek emasnya, uang langsung beres. Nggak perlu antre atau nunggu kiriman." },
                    ].map(({ Icon, title, desc }) => (
                      <div key={title} className="flex items-start gap-3 py-3">
                        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[11px] bg-surf text-ico">
                          <Icon size={18} />
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-[13px] font-extrabold">{title}</h3>
                          <p className="mt-0.5 text-[11.5px] font-semibold leading-snug text-soft">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Galeri COD, di bawah alasan beli */}
                <div id="info-galeri" className="scroll-mt-4">
                  <h2 className="text-2xl font-extrabold tracking-tight">Galeri COD</h2>
                  <p className="mb-3 text-xs font-semibold text-soft">Foto-foto dari COD sebelumnya{gallery.length > 1 ? ", geser buat lihat semua" : ""}</p>
                  <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1" role="group" aria-label="Galeri COD, geser ke samping">
                    {gallery.map((pic) => (
                      <div key={pic.id} className={`surface shrink-0 snap-start overflow-hidden ${gallery.length > 1 ? "w-44" : "w-full"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={pic.img} loading="lazy" decoding="async" alt="Foto COD Emas BUNG bersama pembeli" className="block aspect-[3/4] w-full bg-surf object-cover" />
                        <p className="flex items-center gap-1 truncate px-3 py-2 text-xs font-bold text-soft">
                          <MapPin size={13} aria-hidden="true" /> {pic.loc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div id="info-bung" className="scroll-mt-4">
                  <h2 className="text-2xl font-extrabold tracking-tight">Tentang Bung</h2>
                  <p className="mb-3 text-xs font-semibold text-soft">Orang di balik Emas BUNG</p>
                  <div className="surface p-4">
                    <p className="text-[13px] font-semibold leading-relaxed text-soft2">
                      Gilang adalah penjual Emas BUNG yang melayani COD Antam di Jabodetabek, jadi kamu bisa lihat dan cek emasnya langsung sebelum bayar. Edukasi investasi emasnya di YouTube sudah ditonton 30rb+ orang.
                    </p>
                    <a
                      href={YOUTUBE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-lime px-4 text-xs font-extrabold text-limeink active:scale-95"
                    >
                      <PlayCircle size={16} aria-hidden="true" /> Mampir ke channel YouTube
                    </a>
                  </div>
                </div>

                <p className="text-center text-[10.5px] leading-snug text-soft">Emas BUNG bukan bagian dari PT Aneka Tambang Tbk.</p>
              </div>
            )}

            {infoTab === "panduan" && (
              <div key="panduan" className="animate-fade space-y-5">
                <div id="info-cara" className="scroll-mt-4">
                  <h2 className="text-2xl font-extrabold tracking-tight">Cara Order</h2>
                  <p className="mb-3 text-xs font-semibold text-soft">Empat langkah dari pilih sampai bayar</p>
                  <div className="surface p-4">
                    <div className="space-y-2.5">
                      {[
                        { title: "Pilih Pecahan", desc: "Atur jumlah Antam ready stock di Home, atau hitung dulu di tab Buyback." },
                        { title: "Checkout via WhatsApp", desc: "Tekan Checkout, detail pesanan terkirim otomatis ke WhatsApp Bung." },
                        { title: "Atur Jadwal COD", desc: "Ketemu di stasiun KRL Jabodetabek, area publik ramai, atau diantar langsung." },
                        { title: "Cek Fisik & Bayar", desc: "Cek segel & sertifikat Antam bareng, bayar transfer BCA a.n. Gilang Segara Bening atau tunai." },
                      ].map((item, idx) => (
                        <div key={item.title} className="flex items-start gap-3 rounded-2xl bg-pbg p-3">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-lime text-xs font-extrabold text-limeink">{idx + 1}</span>
                          <div>
                            <h4 className="text-sm font-extrabold">{item.title}</h4>
                            <p className="mt-0.5 text-xs font-semibold leading-snug text-soft">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div id="info-asli" className="scroll-mt-4">
                  <h2 className="text-2xl font-extrabold tracking-tight">Cek Keaslian Antam</h2>
                  <p className="mb-3 text-xs font-semibold text-soft">Pertama kali beli? Ini yang perlu kamu periksa</p>
                  <div className="surface divide-y divide-surf px-4">
                    {[
                      { title: "Lihat kemasannya", desc: "Segel CertiEye harus utuh, tidak ada bekas dibuka atau direkatkan ulang.", stop: false },
                      { title: "Scan QR di sertifikat", desc: "Pakai aplikasi CertiEye (gratis di Play Store dan App Store). Kalau asli, muncul logo ANTAM LM dan tulisan AUTHENTICATED.", stop: false },
                      { title: "Cocokkan datanya", desc: "Nomor seri, berat, dan kemurnian di sertifikat harus sama dengan yang tercetak di batangan.", stop: false },
                      { title: "Ada yang tidak cocok? Jangan bayar", desc: "Berhenti dulu dan tanyakan. Kamu berhak menunda sampai semuanya jelas.", stop: true },
                    ].map((item) => (
                      <div key={item.title} className="flex items-start gap-3 py-3">
                        {item.stop ? (
                          <X size={18} className="mt-px shrink-0 text-warn" aria-hidden="true" />
                        ) : (
                          <CheckCircle size={18} className="mt-px shrink-0 text-ico" aria-hidden="true" />
                        )}
                        <div>
                          <h4 className="text-[13px] font-extrabold">{item.title}</h4>
                          <p className="mt-0.5 text-[11.5px] font-semibold leading-snug text-soft">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10.5px] leading-snug text-soft">Belum pernah scan? Kami temani saat COD.</p>
                </div>
              </div>
            )}

            {infoTab === "syariah" && (
              <div key="syariah" className="animate-fade space-y-5">
                <div id="info-syariah" className="scroll-mt-4">
                  <h2 className="text-2xl font-extrabold tracking-tight">Jual Beli Sesuai Syariah</h2>
                  <p className="mb-3 text-xs font-semibold text-soft">Komitmen kami ke setiap pembeli</p>
                  <div className="rounded-[18px] border-[1.5px] border-selbd bg-sel p-4">
                    <p dir="rtl" lang="ar" className="text-xl leading-[1.8]">الذَّهَبُ بِالذَّهَبِ ... يَدًا بِيَدٍ</p>
                    <p className="mt-1 text-[13px] font-bold leading-relaxed">
                      &ldquo;Emas dengan emas ... sama beratnya, sepadan, dan tunai. Jika jenisnya berbeda, juallah sesukamu asal tunai.&rdquo;
                    </p>
                    <p className="mt-1 text-[10.5px] font-bold text-soft">HR Muslim no. 1587, dari Ubadah bin Shamit (diringkas)</p>
                    <ul className="mt-3 space-y-2">
                      {[
                        "Transaksi tunai: bayar dan terima emas di tempat",
                        "Harga disepakati sebelum bayar, tidak berubah setelahnya",
                        "Cek segel dan sertifikat bareng, bebas batal sebelum bayar",
                        "Kondisi barang disampaikan jujur",
                      ].map((t) => (
                        <li key={t} className="flex gap-2 text-xs font-bold leading-snug">
                          <CheckCircle size={16} className="mt-px shrink-0 text-ico" aria-hidden="true" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="mt-2 text-[10.5px] leading-snug text-soft">Ini penjelasan praktik kami, bukan fatwa. Untuk pertanyaan fikih, silakan tanya ustadz yang kamu percaya.</p>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* KERANJANG (BOTTOM SHEET) */}
      {showCart && (
        <div className="phone fixed left-1/2 top-0 z-50 flex h-full -translate-x-1/2 flex-col justify-end">
          <div onClick={() => setShowCart(false)} className="animate-fade absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <div className="animate-sheet relative z-10 flex h-[82vh] flex-col rounded-t-[2rem] bg-pbg p-5">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-surf" />

            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-2xl font-extrabold">
                Keranjang
                <span className="rounded-full bg-lime px-2.5 py-0.5 text-xs font-extrabold text-limeink">
                  {totalCartItemsCount}
                </span>
              </h2>
              <button onClick={() => setShowCart(false)} aria-label="Tutup Keranjang" className="btn btn-soft h-9 w-9 rounded-full">
                <X size={18} />
              </button>
            </div>

            <div className="hide-scrollbar flex-1 space-y-2 overflow-y-auto pb-4">
              {cart.length === 0 ? (
                <div className="mt-16 space-y-3 text-center">
                  <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-surf">
                    <ShoppingBag size={36} className="text-ico" />
                  </div>
                  <p className="text-base font-extrabold">Keranjang masih kosong</p>
                  <p className="text-xs font-semibold text-soft">Yuk pilih pecahan emas ready stock dulu!</p>
                  <button
                    onClick={() => {
                      setShowCart(false);
                      setActiveTab("beranda");
                    }}
                    className="btn btn-lime px-5 py-2.5 text-xs"
                  >
                    Pilih Pecahan
                  </button>
                </div>
              ) : (
                cart.map((c) => (
                  <div
                    key={c.gram}
                    className={`surface flex items-center gap-3 p-3 transition-all duration-300 ${
                      removingItem === c.gram ? "-translate-x-full opacity-0" : "translate-x-0 opacity-100"
                    }`}
                  >
                    <GramPhoto gram={c.gram} broken={brokenPhotos.includes(c.gram)} onBroken={() => markBroken(c.gram)} />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-extrabold">Antam {c.gram} gr</h4>
                      <p className="text-[11px] font-bold text-ico">{pr(c.price)} / keping</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[13px] font-extrabold">
                      <button onClick={() => changeQty(c.gram, -1)} aria-label="Kurangi" className="grid h-7 w-7 place-items-center rounded-full bg-stp text-ico active:scale-90">
                        <Minus size={14} />
                      </button>
                      <span className="w-4 text-center">{c.qty}</span>
                      <button onClick={() => changeQty(c.gram, 1)} aria-label="Tambah" className="grid h-7 w-7 place-items-center rounded-full bg-lime text-limeink active:scale-90">
                        <Plus size={14} />
                      </button>
                      <button
                        onClick={() => handleRemoveCartItem(c.gram)}
                        aria-label="Hapus"
                        className="ml-1 grid h-8 w-8 place-items-center rounded-full bg-danger/10 text-danger"
                      >
                        <Trash size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-surf pt-4">
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-soft">
                <span>Rekening BCA</span>
                <span className="rounded-full bg-surf px-2.5 py-0.5 font-bold text-ink">Gilang Segara Bening</span>
              </div>
              <div className="mb-4 mt-3 flex items-end justify-between">
                <span className="text-sm font-extrabold">Total</span>
                <span className="text-2xl font-extrabold tracking-tight text-ico">{pr(cartTotal)}</span>
              </div>
              <p className="-mt-2 mb-4 flex items-center gap-1 text-[11px] text-soft">
                <Info size={12} aria-hidden="true" /> Total ini perkiraan, ya. Kamu cek emasnya dulu, baru bayar sesuai harga yang disepakati saat COD.
              </p>
              <button onClick={handleCheckoutWA} disabled={cart.length === 0} className="btn btn-wa w-full py-4 text-sm">
                <ChatCircleDots size={18} /> Lanjut via WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCK BAWAH: ringkasan Keranjang + navigasi dalam satu blok */}
      <div className="phone pointer-events-none fixed bottom-0 left-1/2 z-40 -translate-x-1/2 pt-2">
        {totalCartItemsCount > 0 && !showCart && (
          <div className="pointer-events-auto px-3 pb-2">
            <button
              onClick={() => setShowCart(true)}
              aria-label={`Buka Keranjang, ${totalCartItemsCount} item, total ${pr(cartTotal)}`}
              className="animate-fade-up flex w-full items-center gap-3 rounded-2xl bg-row p-2 pl-2.5 text-left shadow-[0_10px_30px_-8px_rgb(0_0_0/40%)] ring-1 ring-selbd/50 active:scale-[0.99]"
            >
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surf text-ico">
                <ShoppingBag size={20} />
                <span
                  key={totalCartItemsCount}
                  className="animate-pop absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-lime px-1 text-[11px] font-extrabold text-limeink ring-2 ring-row"
                >
                  {totalCartItemsCount}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold text-soft">
                  Keranjang · {cart.reduce((a, c) => a + c.gram * c.qty, 0).toLocaleString("id-ID")} gram emas
                </span>
                <span className="block truncate text-base font-extrabold tracking-tight">{pr(cartTotal)}</span>
              </span>
              <span className="btn btn-lime shrink-0 rounded-xl px-4 py-3 text-[13px]">
                Checkout <ArrowRight size={15} />
              </span>
            </button>
          </div>
        )}
      <nav
        aria-label="Navigasi utama"
        className={`pointer-events-auto mx-auto mb-[max(0.75rem,env(safe-area-inset-bottom))] flex justify-around rounded-[28px] border border-surf bg-pbg/90 px-2 shadow-[0_8px_30px_-6px_rgb(0_0_0/45%)] backdrop-blur-xl transition-all duration-300 ease-out motion-reduce:transition-none ${
          isScrolling ? "w-[68%] py-1" : "w-[calc(100%-1.5rem)] py-2"
        }`}
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => {
                triggerHaptic();
                // Edukasi membuka YouTube (keluar dari web ini), jadi minta konfirmasi dulu
                if (id === "edukasi") setShowLeaveConfirm(true);
                else setActiveTab(id);
              }}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center py-1 ${active ? "text-ico" : "text-soft"}`}
            >
              <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${active ? "bg-surf" : ""}`}>
                <Icon size={20} weight={active ? "fill" : "bold"} />
              </span>
              <span
                className={`overflow-hidden text-[10.5px] font-bold transition-all duration-300 motion-reduce:transition-none ${
                  isScrolling ? "max-h-0 opacity-0" : "mt-0.5 max-h-4 opacity-100"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>
      </div>

      {/* FOTO GRAMASI DIPERBESAR */}
      {zoomGram !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Foto Antam ${zoomGram} gram`}
          onClick={() => setZoomGram(null)}
          className="phone animate-fade fixed left-1/2 top-0 z-[70] flex h-full -translate-x-1/2 items-center justify-center bg-black/85 p-5 backdrop-blur-md"
        >
          <div onClick={(e) => e.stopPropagation()} className="relative w-full overflow-hidden rounded-3xl bg-pbg">
            <button
              autoFocus
              onClick={() => setZoomGram(null)}
              aria-label="Tutup"
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white"
            >
              <X size={18} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/images/antam/${zoomGram}.jpg`} alt={`Antam ${zoomGram} gram, tampak depan dan belakang`} className="block h-auto w-full" />
            <p className="px-4 py-3 text-center text-sm font-extrabold">Antam {zoomGram} gr · 999,9 Fine Gold</p>
          </div>
        </div>
      )}

      {/* KONFIRMASI KELUAR KE YOUTUBE */}
      {showLeaveConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-title"
          onClick={() => setShowLeaveConfirm(false)}
          onKeyDown={(e) => e.key === "Escape" && setShowLeaveConfirm(false)}
          className="phone animate-fade fixed left-1/2 top-0 z-[70] flex h-full -translate-x-1/2 items-center justify-center bg-black/80 p-5 backdrop-blur-md"
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full rounded-3xl bg-pbg p-6 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-lime text-limeink">
              <PlayCircle size={22} />
            </div>
            <h3 id="leave-title" className="text-xl font-extrabold">Keluar dari Emas BUNG?</h3>
            <p className="mb-5 mt-2 text-sm font-semibold leading-snug text-soft">
              Kamu akan diarahkan ke channel YouTube Emas BUNG untuk belajar seputar emas, sudah ditonton 30rb+ orang. Keranjang kamu tetap aman di sini.
            </p>
            <div className="flex gap-3">
              <button autoFocus onClick={() => setShowLeaveConfirm(false)} className="btn btn-soft flex-1 py-3 text-sm">
                Batal
              </button>
              <button
                onClick={() => {
                  window.open(YOUTUBE_URL, "_blank", "noopener,noreferrer");
                  setShowLeaveConfirm(false);
                }}
                className="btn btn-lime flex-1 py-3 text-sm"
              >
                Buka YouTube
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KONFIRMASI WHATSAPP */}
      {waConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="wa-title"
          onClick={() => setWaConfirm(null)}
          onKeyDown={(e) => e.key === "Escape" && setWaConfirm(null)}
          className="phone animate-fade fixed left-1/2 top-0 z-[80] flex h-full -translate-x-1/2 items-end bg-black/70 backdrop-blur-sm"
        >
          <div onClick={(e) => e.stopPropagation()} className="animate-fade-up w-full rounded-t-3xl bg-pbg px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2.5">
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-soft/40" aria-hidden="true" />
            <div className="flex items-center gap-3">
              <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-wa text-white">
                <ChatCircleDots size={20} />
              </span>
              <h3 id="wa-title" className="text-[17px] font-extrabold leading-tight">{waConfirm.title}</h3>
            </div>
            <p className="mt-2 text-[12.5px] font-semibold leading-snug text-soft2">{waConfirm.lead}</p>
            <div className="mt-3 rounded-[14px] bg-surf px-3 py-1">
              {waConfirm.rows.map(([k, v], i) => (
                <div key={k + i} className={`flex justify-between gap-3 py-2 text-[12.5px] font-bold ${i > 0 ? "border-t border-soft/15" : ""} ${i === waConfirm.rows.length - 1 && waConfirm.rows.length > 1 ? "text-[13.5px] font-extrabold" : ""}`}>
                  <span className="text-soft2">{k}</span>
                  <span className="text-right">{v}</span>
                </div>
              ))}
            </div>
            <p className="mx-0.5 mt-2.5 text-[11.5px] font-semibold leading-snug text-soft">{waConfirm.note}</p>
            <div className="mt-3.5 flex flex-col gap-1.5">
              <a
                href={waConfirm.url}
                target="_blank"
                rel="noopener noreferrer"
                autoFocus
                onClick={() => {
                  waConfirm.onOpen?.();
                  setWaConfirm(null);
                }}
                className="btn btn-wa w-full py-3.5 text-sm"
              >
                <span className="text-sm font-extrabold">Buka WhatsApp</span>
              </a>
              <button type="button" onClick={() => setWaConfirm(null)} className="w-full py-2.5 text-soft">
                <span className="text-[13px] font-extrabold">Kembali</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN ADMIN */}
      {showAdminPin && (
        <div className="phone animate-fade fixed left-1/2 top-0 z-[70] flex h-full -translate-x-1/2 items-center justify-center bg-black/80 p-5 backdrop-blur-md">
          <div className="w-full rounded-3xl bg-pbg p-6">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-lime text-limeink">
              <Lock size={22} />
            </div>
            <h3 className="mb-4 text-center text-xl font-extrabold">Akses Admin</h3>
            <input
              id="admin-pin"
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="input mb-4 py-3 text-center text-2xl tracking-[0.5em]"
              aria-label="PIN admin"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowAdminPin(false)} className="btn btn-soft flex-1 py-3 text-sm">
                Batal
              </button>
              <button onClick={handlePinSubmit} className="btn btn-lime flex-1 py-3 text-sm">
                Masuk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PANEL ADMIN */}
      {showAdminPanel && (
        <div className="phone fixed left-1/2 top-0 z-[70] h-full -translate-x-1/2 overflow-y-auto bg-pbg p-5">
          <div className="pb-20">
            <div className="mb-4 flex items-center justify-between pt-2">
              <h2 className="flex items-center gap-2 text-2xl font-extrabold">
                <SlidersHorizontal size={22} className="text-ico" /> Panel Admin
              </h2>
              <button onClick={() => setShowAdminPanel(false)} className="btn btn-soft px-4 py-2 text-xs">
                Tutup
              </button>
            </div>

            <div className="hide-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
              {[
                { id: "price", l: "Harga" },
                { id: "stock", l: "Stok" },
                { id: "gallery", l: "Galeri" },
                { id: "orders", l: "Order" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setAdminTab(t.id)}
                  className={`btn px-4 py-2 text-xs ${adminTab === t.id ? "btn-lime" : "btn-soft"}`}
                >
                  {t.l}
                </button>
              ))}
            </div>

            <p className={`mb-3 rounded-xl px-3 py-2 text-[11px] font-bold ${serverMode ? "bg-sel text-ink" : "bg-surf text-soft2"}`}>
              {serverMode
                ? "Tersimpan di server: stok, diskon, spread, dan harga manual berlaku untuk semua pengunjung."
                : "Mode lokal: perubahan hanya terlihat di browser ini. Aktifkan penyimpanan server agar berlaku untuk semua pengunjung."}
            </p>

            {adminTab === "price" && (
              <div className="space-y-4">
                <div className="surface space-y-4 p-5">
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span>
                      <span className="block text-sm font-extrabold">Pakai harga manual</span>
                      <span className="block text-xs font-semibold leading-snug text-soft">
                        {manualPrice ? "Harga di bawah dipakai, API diabaikan." : "Harga otomatis dari API (Antam). Nyalakan untuk isi sendiri."}
                      </span>
                    </span>
                    <input type="checkbox" role="switch" checked={manualPrice} onChange={(e) => setManualPrice(e.target.checked)} className="h-6 w-11 shrink-0 accent-[var(--line)]" />
                  </label>
                  <div>
                    <label htmlFor="adm-base" className="text-xs font-extrabold text-ico">Harga jual 1 gram</label>
                    <input id="adm-base" type="number" disabled={!manualPrice} value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value))} className={`input mt-1 text-lg ${manualPrice ? "" : "opacity-50"}`} />
                  </div>
                  <div>
                    <label htmlFor="adm-bb" className="text-xs font-extrabold text-ico">Harga buyback 1 gram</label>
                    <input id="adm-bb" type="number" disabled={!manualPrice} value={buybackPrice} onChange={(e) => setBuybackPrice(Number(e.target.value))} className={`input mt-1 text-lg ${manualPrice ? "" : "opacity-50"}`} />
                  </div>
                </div>
                <div className="surface p-5">
                  <label htmlFor="adm-spread" className="text-xs font-extrabold text-ico">Range harga jual (% di bawah harga Antam)</label>
                  <input
                    id="adm-spread"
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={spreadPct}
                    onChange={(e) => setSpreadPct(Math.min(5, Math.max(0, Number(e.target.value))))}
                    className="input mt-1 text-lg"
                  />
                  <p className="mt-2 text-xs font-semibold leading-snug text-soft">
                    Batas atas selalu harga Antam. Contoh 0,5 menampilkan 1 gram sebagai {priceRange(basePrice, "–", spreadPct)}. Isi 0 untuk harga pasti.
                  </p>
                </div>
                <div className="surface p-5">
                  <h3 className="mb-2 text-sm font-extrabold">Tanggal update manual</h3>
                  <input id="adm-date" type="text" aria-label="Tanggal update" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} className="input" placeholder="Contoh: 14 OKT 2026" />
                  <p className="mt-2 text-xs font-semibold leading-snug text-soft">
                    Ubah kalau mau menampilkan tanggal update versi sendiri di halaman depan. Setiap kali harga jual berubah dan disimpan, titiknya masuk ke grafik di Home.
                  </p>
                </div>
              </div>
            )}

            {adminTab === "stock" && (
              <div className="space-y-4">
                <div className="surface p-4">
                  <h3 className="mb-3 text-sm font-extrabold">Edit stok & diskon</h3>
                  {inventory.map((item, idx) => (
                    <div key={item.gram} className="flex items-center justify-between border-b border-surf py-2 last:border-0">
                      <span className="w-12 font-extrabold">{item.gram}g</span>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-soft">Stok</span>
                          <input
                            type="number"
                            aria-label={`Stok ${item.gram} gram`}
                            value={item.stock}
                            onChange={(e) => {
                              const n = [...inventory];
                              n[idx] = { ...n[idx], stock: Number(e.target.value) };
                              setInventory(n);
                            }}
                            className="input w-14 px-1 py-1.5 text-center"
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-soft">Diskon (Rp)</span>
                          <input
                            type="number"
                            aria-label={`Diskon ${item.gram} gram`}
                            value={item.discount}
                            onChange={(e) => {
                              const n = [...inventory];
                              n[idx] = { ...n[idx], discount: Number(e.target.value) };
                              setInventory(n);
                            }}
                            className="input w-24 px-1 py-1.5 text-center"
                          />
                        </div>
                        <button
                          onClick={() => setInventory(inventory.filter((_, i) => i !== idx))}
                          aria-label="Hapus pecahan"
                          className="mt-4 grid h-8 w-8 place-items-center rounded-full bg-danger/10 text-danger"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="surface space-y-3 p-4">
                  <h3 className="text-sm font-extrabold">Tambah gramasi baru</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" aria-label="Gram baru" placeholder="Gram" value={newGram} onChange={(e) => setNewGram(e.target.value)} className="input text-xs" />
                    <input type="number" aria-label="Stok baru" placeholder="Stok" value={newStock} onChange={(e) => setNewStock(e.target.value)} className="input text-xs" />
                    <input type="number" aria-label="Diskon baru" placeholder="Diskon" value={newDisc} onChange={(e) => setNewDisc(e.target.value)} className="input text-xs" />
                  </div>
                  <button
                    onClick={() => {
                      if (!newGram || !newStock) return notify("Isi gram dan stok dulu");
                      setInventory([...inventory, { gram: Number(newGram), stock: Number(newStock), discount: Number(newDisc) || 0 }].sort((a, b) => a.gram - b.gram));
                      setNewGram("");
                      setNewStock("");
                      setNewDisc("");
                      notify("Produk baru ditambahkan");
                    }}
                    className="btn btn-lime w-full py-3 text-sm"
                  >
                    <Plus size={16} /> Tambah Produk
                  </button>
                </div>
              </div>
            )}

            {adminTab === "gallery" && (
              <div className="surface p-4">
                <h3 className="mb-2 text-sm font-extrabold">Galeri aktif</h3>
                <p className="text-xs font-semibold text-soft">
                  File <code className="rounded bg-surf px-1 py-0.5">cod2.jpg</code> ditampilkan penuh secara proporsional.
                </p>
              </div>
            )}

            {adminTab === "orders" && (
              <div className="space-y-3">
                {orders.length === 0 ? (
                  <p className="surface p-4 text-xs font-semibold text-soft">Belum ada order.</p>
                ) : (
                  orders.map((ord) => (
                    <div key={ord.id} className="surface p-4">
                      <div className="mb-2 flex justify-between border-b border-surf pb-2">
                        <span className="text-xs font-extrabold text-ico">{ord.id}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            ord.status === "Done" ? "bg-lime text-limeink" : "bg-surf text-soft"
                          }`}
                        >
                          {ord.status === "Done" ? "Selesai" : "Menunggu"}
                        </span>
                      </div>
                      <p className="text-sm font-extrabold">{ord.detail}</p>
                      {ord.status !== "Done" && (
                        <button
                          onClick={() => {
                            const n = orders.map((o) => (o.id === ord.id ? { ...o, status: "Done" } : o));
                            setOrders(n);
                            saveToStorage({ orders: n });
                          }}
                          className="btn btn-soft mt-3 w-full py-2 text-xs"
                        >
                          Tandai Selesai
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            <button onClick={handleAdminSave} className="btn btn-lime mt-6 w-full py-4 text-sm">
              <FloppyDisk size={16} /> Simpan Perubahan
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
