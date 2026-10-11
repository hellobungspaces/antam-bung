"use client";
import { useState, useEffect } from "react";

export default function AdvancedEmasBungPWA() {
  const [isMounted, setIsMounted] = useState(false);
  const [basePrice, setBasePrice] = useState(2592000); 
  const [buybackPrice, setBuybackPrice] = useState(2401000);
  
  const [inventory, setInventory] = useState([
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

  const [gallery, setGallery] = useState([
    { id: 1, img: "/images/cod2.png", gram: "Kolase COD", loc: "Jabodetabek" },
  ]);

  const [newGram, setNewGram] = useState("");
  const [newStock, setNewStock] = useState("");
  const [newDisc, setNewDisc] = useState("");

  const [orders, setOrders] = useState<{id: string, name: string, detail: string, status: string}[]>([]);
  const [cart, setCart] = useState<{gram: number, qty: number, price: number}[]>([]);
  
  const [activeTab, setActiveTab] = useState("beranda");
  const [showCart, setShowCart] = useState(false);
  const [showPushNotif, setShowPushNotif] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  
  const [tapCount, setTapCount] = useState(0);
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState("price");
  const [pinInput, setPinInput] = useState("");
  
  // STATE BUYBACK
  const [bbGram, setBbGram] = useState<string>("1");
  const [bbEdition, setBbEdition] = useState<string>("press");
  const [bbCondition, setBbCondition] = useState<string>("mulus"); 

  const SECRET_PIN = "0000"; 
  const WA_NUMBER = "628176767166";
  const currentDate = "11 OKT 2026";

  useEffect(() => {
    setIsMounted(true);
    const savedData = localStorage.getItem("emasBungV42"); 
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.basePrice) setBasePrice(parsed.basePrice);
        if (parsed.buybackPrice) setBuybackPrice(parsed.buybackPrice);
        if (parsed.inventory) setInventory(parsed.inventory);
        if (parsed.gallery) setGallery(parsed.gallery);
        if (parsed.orders) setOrders(parsed.orders);
      } catch (err) {
        console.error("Storage parse error", err);
      }
    }
    
    const notifTimer = setTimeout(() => {
      setShowPushNotif(true);
      if (typeof window !== "undefined" && navigator.vibrate) navigator.vibrate(15);
      setTimeout(() => setShowPushNotif(false), 6000);
    }, 2500);
    return () => clearTimeout(notifTimer);
  }, []);

  const safeBuybackPrice = Number(buybackPrice) || 2401000;
  const bbGramNum = parseFloat(bbGram) || 0;
  let calculatedBbEstimate = safeBuybackPrice * bbGramNum;
  if (bbEdition === "retro") calculatedBbEstimate -= (bbGramNum * 10000);
  if (bbCondition === "baret") calculatedBbEstimate -= (bbGramNum * 15000);
  calculatedBbEstimate = Math.max(0, Math.round(calculatedBbEstimate));

  if (!isMounted) return null;

  const triggerHaptic = () => {
    if (typeof window !== "undefined" && navigator.vibrate) navigator.vibrate(15);
  };

  const getProductPrice = (gram: number, discount: number) => (basePrice * gram) - discount;

  const handleAddToCart = (gram: number, price: number, stock: number) => {
    triggerHaptic();
    const existing = cart.find(item => item.gram === gram);
    if (existing) {
      if (existing.qty < stock) {
        setCart(cart.map(item => item.gram === gram ? { ...item, qty: item.qty + 1 } : item));
      } else {
        alert("Stok kepingan tidak cukup!");
      }
    } else {
      setCart([...cart, { gram, qty: 1, price }]);
    }
    setShowCart(true);
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  const handleCheckoutWA = () => {
    triggerHaptic();
    if (cart.length === 0) return;
    let itemsText = cart.map(item => `- ${item.qty}x Antam ${item.gram}gr (Rp ${item.price.toLocaleString('id-ID')})`).join('%0a');
    let message = `Halo Emas BUNG! Saya mau order:%0a${itemsText}%0a%0a*Total: Rp ${cartTotal.toLocaleString('id-ID')}*%0a%0aCOD, cek emas dulu, lalu bayar via BCA a.n. Gilang Segara Bening.%0a%0aSiap janjian?`;
    
    const newOrder = { id: `ORD-${Date.now().toString().slice(-4)}`, name: "WA Customer", detail: `${cart.length} items - Rp ${cartTotal.toLocaleString('id-ID')}`, status: "Pending" };
    setOrders([newOrder, ...orders]);
    saveToStorage({ orders: [newOrder, ...orders] });
    
    window.open(`https://wa.me/${WA_NUMBER}?text=${message}`, "_blank");
    setCart([]);
    setShowCart(false);
  };

  const handleBuybackWA = () => {
    triggerHaptic();
    const msg = `Halo Bung, saya mau jual (buyback) Antam pecahan *${bbGramNum}gr*.%0aCetakan: ${bbEdition.toUpperCase()}, Kondisi: ${bbCondition.toUpperCase()}.%0aEstimasi sistem: *Rp ${calculatedBbEstimate.toLocaleString('id-ID')}*. Bisa atur jadwal ketemuan COD?`;
    window.open(`https://wa.me/${WA_NUMBER}?text=${msg}`, "_blank");
  };

  const handleLogoTap = () => {
    triggerHaptic();
    const newCount = tapCount + 1;
    setTapCount(newCount);
    if (newCount >= 5) { setShowAdminPin(true); setTapCount(0); }
    setTimeout(() => setTapCount(0), 2000);
  };

  const handlePinSubmit = () => {
    if (pinInput === SECRET_PIN) {
      setShowAdminPin(false);
      setShowAdminPanel(true);
      setPinInput("");
    } else {
      alert("PIN Salah!");
      setPinInput("");
    }
  };

  const saveToStorage = (partialData: any) => {
    try {
      const existing = JSON.parse(localStorage.getItem("emasBungV42") || "{}");
      const dataToSave = { ...existing, basePrice, buybackPrice, inventory, gallery, orders, ...partialData };
      localStorage.setItem("emasBungV42", JSON.stringify(dataToSave));
    } catch (error) {
      alert("Penyimpanan lokal penuh!");
      console.error(error);
    }
  };

  const handleAdminSave = () => {
    saveToStorage({});
    setShowAdminPanel(false);
    triggerHaptic();
    alert("Sistem & Database Lokal Berhasil Disimpan! 🚀");
  };

  const breakingNewsText = `UPDATE HARGA: 1G Rp ${getProductPrice(1, 0).toLocaleString('id-ID')} • BUYBACK Rp ${buybackPrice.toLocaleString('id-ID')} • Transaksi saat COD • REK RESMI BCA A.N. GILANG SEGARA BENING `;

  return (
    <main className="min-h-screen bg-[#f8f8f4] text-[#111111] font-sans selection:bg-[#FFD700] selection:text-[#111] pb-28 relative overflow-x-hidden max-w-md mx-auto shadow-2xl border-x-2 border-[#111]">
      
      {/* PUSH NOTIFICATION */}
      <div className={`fixed top-4 left-1/2 -translate-x-1/2 w-[92%] max-w-sm z-50 transition-all duration-500 ease-out ${showPushNotif ? "translate-y-0 opacity-100" : "-translate-y-32 opacity-0 pointer-events-none"}`}>
        <div className="bg-white border-2 border-[#111] p-3.5 shadow-[4px_4px_0px_0px_#111] flex gap-3 items-start">
          <div className="bg-[#FFD700] p-2 flex items-center justify-center border border-[#111] shrink-0 mt-0.5">
            <span className="text-[#111] text-xl">💡</span>
          </div>
          <div>
            <div className="flex justify-between items-center">
              <h4 className="font-black text-[11px] uppercase tracking-wider text-[#997404]">Info Singkat ⚡</h4>
              <button onClick={() => setShowPushNotif(false)} className="text-xs font-bold text-zinc-400 hover:text-[#111]">✕</button>
            </div>
            <p className="text-[11px] font-bold leading-tight mt-1 text-zinc-800">
              Cek panduan lengkap cara order di tab Info ya bro!
            </p>
          </div>
        </div>
      </div>

      {/* HEADER NAVBAR */}
      <section className="bg-[#FFD700] text-[#111] pt-6 pb-5 px-5 border-b-4 border-[#111] relative z-10 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h1 onClick={handleLogoTap} className="text-2xl font-black tracking-tighter cursor-pointer flex items-center gap-1.5">
            EMAS BUNG <span className="w-2 h-2 bg-[#111] rounded-full animate-pulse"></span>
          </h1>
          <div className="flex gap-2">
            <button onClick={() => window.open(`https://wa.me/${WA_NUMBER}?text=Halo%20Bung,%20mau%20tanya%20ketersediaan%20Antam%20&%20jadwal%20COD.`, "_blank")} className="bg-white text-[#111] px-3 py-1.5 border-2 border-[#111] font-black text-[10px] uppercase shadow-[2px_2px_0px_0px_#111] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-1">
              💬 Chat WA
            </button>
            <button onClick={() => setShowCart(true)} className="relative bg-[#111] text-white p-2 border-2 border-[#111] shadow-[2px_2px_0px_0px_#fff] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              {cart.length > 0 && <span className="absolute -top-3 -right-3 bg-[#111] text-[#FFD700] text-[11px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-[#111] animate-bounce">{cart.length}</span>}
            </button>
          </div>
        </div>

        {/* HERO SECTION */}
        {activeTab === "beranda" && (
          <div className="animate-in fade-in duration-300">
            <div className="bg-white/60 border-2 border-[#111]/30 p-4 mb-4 backdrop-blur-sm">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase flex items-center gap-1.5 text-[#111]">
                  <svg className="w-3 h-3 text-[#111]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                  HARGA ANTAM • 1G
                </p>
                <p className="text-[10px] font-bold bg-[#111] text-[#FFD700] px-1.5 py-0.5 uppercase tracking-wider">{currentDate}</p>
              </div>
              
              <div className="flex items-start gap-1 font-black leading-none tracking-tighter text-[#111]">
                <span className="text-5xl leading-none">Rp {(basePrice/1000).toLocaleString("id-ID")}</span>
                <div className="text-lg leading-tight flex flex-col pt-1">
                  <span>.000</span>
                </div>
              </div>
            </div>

            <div className="flex divide-x-2 divide-[#111]/20 border-2 border-[#111]/20 bg-[#ffcc00]">
              <div className="flex-1 p-3 text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#111]/80 mb-0.5">Spread Jual-Beli</p>
                <p className="text-sm font-black tracking-tight text-[#111]">Sangat Kompetitif</p>
              </div>
              <div className="flex-1 p-3 text-center bg-[#111] text-[#FFD700]">
                <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5">Terima Buyback</p>
                <p className="text-sm font-black tracking-tight">Rp {buybackPrice.toLocaleString("id-ID")}</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* BREAKING NEWS MARQUEE */}
      <div className="bg-[#111] text-[#FFD700] text-[11px] font-bold py-2.5 overflow-hidden flex whitespace-nowrap border-b-2 border-[#111] relative z-10">
        <div className="animate-marquee inline-block">
          <span className="mx-2 tracking-widest">{breakingNewsText}</span>
          <span className="mx-2 tracking-widest">{breakingNewsText}</span>
        </div>
      </div>

      {/* TABS CONTENT */}
      <div className="min-h-[50vh] relative z-0 pb-10">
        
        {/* BERANDA */}
        {activeTab === "beranda" && (
          <div className="animate-in fade-in duration-300 space-y-6">
            
            {/* READY STOCK SECTION */}
            <section className="p-5 pb-0">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <h2 className="text-xl font-black tracking-tight uppercase">Ready Stock</h2>
                  <p className="text-[10px] font-bold text-zinc-500">Pilih pecahan & amankan via WhatsApp</p>
                </div>
                <button onClick={() => setActiveTab("produk")} className="text-[10px] font-black text-[#111] bg-[#FFD700] border-2 border-[#111] px-2.5 py-1.5 shadow-[2px_2px_0px_0px_#111] active:translate-y-[2px] active:shadow-none transition-all uppercase">
                  Semua ➔
                </button>
              </div>
              
              <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar px-1">
                {inventory.filter(i => i.stock > 0).map((item) => {
                  const pPrice = getProductPrice(item.gram, item.discount);
                  return (
                    <div key={item.gram} className="min-w-[135px] bg-white border-2 border-[#111] p-3.5 flex flex-col justify-between shrink-0 shadow-[4px_4px_0px_0px_#111]">
                      <div className="border-b-2 border-zinc-100 pb-2 mb-2">
                        <h3 className="text-3xl font-black tracking-tighter leading-none flex items-end gap-0.5">
                          {item.gram}<span className="text-sm pb-0.5">gr</span>
                        </h3>
                        <span className="text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.5 mt-1.5 inline-block uppercase">Sisa {item.stock} Keping</span>
                      </div>
                      <p className="text-xs font-black">Rp {(pPrice/1000000).toFixed(2)} jt</p>
                      
                      <button onClick={() => handleAddToCart(item.gram, pPrice, item.stock)} className="mt-3 w-full bg-[#FFD700] text-[#111] text-[10px] font-black py-2 uppercase border-2 border-[#111] active:bg-[#111] active:text-[#FFD700] transition-colors">
                        + Keranjang
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* KENAPA TRANSAKSI DI EMAS BUNG */}
            <section className="px-5 mb-4">
              <div className="bg-white border-2 border-[#111] p-4 shadow-[4px_4px_0px_0px_#111] space-y-2">
                <h3 className="font-black text-xs uppercase tracking-wider text-[#997404]">⚡ Kenapa Transaksi di Emas BUNG?</h3>
                <ul className="text-[11px] font-bold text-zinc-700 space-y-1">
                  <li>✔ 100% Antam Asli (Garansi Uang Kembali)</li>
                  <li>✔ Rekening Resmi BCA a.n. Gilang Segara Bening</li>
                  <li>✔ COD di Mall, Coffee Shop, Stasiun KRL (Jabodetabek) / Rumah</li>
                  <li>✔ Harga & Stok Dinamis, Terima Buyback Emas Antam</li>
                </ul>
              </div>
            </section>

          </div>
        )}

        {/* PRODUK */}
        {activeTab === "produk" && (
          <section className="p-5 animate-in fade-in slide-in-from-right-2 duration-300">
            <h2 className="text-2xl font-black tracking-tight mb-4 uppercase">Katalog Emas Antam</h2>
            <div className="w-full">
              <div className="grid grid-cols-2 gap-3 w-full">
                {inventory.map((item) => {
                  const finalPrice = getProductPrice(item.gram, item.discount);
                  const isReady = item.stock > 0;
                  return (
                    <div key={item.gram} className={`bg-white border-2 border-[#111] p-3.5 flex flex-col justify-between min-h-[140px] ${!isReady ? 'opacity-60 grayscale bg-zinc-200' : 'shadow-[4px_4px_0px_0px_#111]'}`}>
                      <div className="flex justify-between items-start">
                        <h3 className="text-2xl font-black tracking-tighter leading-none">{item.gram}gr</h3>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 border border-[#111] ${isReady ? 'bg-[#FFD700] text-[#111]' : 'bg-[#111] text-white'}`}>
                          {isReady ? `SISA ${item.stock}` : 'KOSONG'}
                        </span>
                      </div>
                      <div className="mt-auto pt-3">
                        <p className="text-xs font-black">Rp {finalPrice.toLocaleString('id-ID')}</p>
                        <button 
                          disabled={!isReady}
                          onClick={() => handleAddToCart(item.gram, finalPrice, item.stock)} 
                          className={`mt-2 w-full text-[9px] font-black py-2 border-2 border-[#111] uppercase active:scale-95 ${isReady ? 'bg-[#FFD700] text-[#111]' : 'bg-transparent text-[#111]'}`}>
                          {isReady ? 'Add to Cart' : 'Sold Out'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* JUAL / BUYBACK */}
        {activeTab === "jual" && (
          <section className="p-5 animate-in fade-in slide-in-from-right-2 duration-300 w-full overflow-hidden">
            <h2 className="text-2xl font-black tracking-tight mb-1 uppercase">Kalkulator Buyback</h2>
            <p className="text-xs font-bold text-zinc-500 mb-6">Hitung estimasi pencairan emas Antam kamu secara real-time.</p>
            
            <div className="bg-white border-4 border-[#111] p-5 shadow-[6px_6px_0px_0px_#111] space-y-6">
              
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest block mb-2 text-[#997404]">1 • Pecahan (Gram)</label>
                <input 
                  type="number" 
                  inputMode="decimal"
                  min="0.1" 
                  step="any"
                  value={bbGram} 
                  onChange={(e) => setBbGram(e.target.value)} 
                  className="w-full border-2 border-[#111] font-black text-3xl py-3 px-4 focus:outline-none focus:border-[#FFD700] bg-amber-50/40 text-center transition-colors" 
                  placeholder="0"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest block mb-2 text-[#997404]">2 • Edisi Cetakan</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => { triggerHaptic(); setBbEdition("press"); }}
                    className={`flex flex-col items-center justify-center p-3 border-2 transition-all active:scale-95 ${bbEdition === 'press' ? 'bg-[#FFD700] border-[#111] text-[#111] shadow-[2px_2px_0px_0px_#111]' : 'bg-white border-[#111] text-zinc-500 hover:bg-zinc-50'}`}
                  >
                    <span className="font-black text-xs uppercase">CertiCard</span>
                    <span className={`text-[9px] font-bold mt-1 ${bbEdition === 'press' ? 'text-[#111]/70' : 'text-zinc-500'}`}>Kemasan Press</span>
                  </button>
                  <button 
                    onClick={() => { triggerHaptic(); setBbEdition("retro"); }}
                    className={`flex flex-col items-center justify-center p-3 border-2 transition-all active:scale-95 ${bbEdition === 'retro' ? 'bg-[#FFD700] border-[#111] text-[#111] shadow-[2px_2px_0px_0px_#111]' : 'bg-white border-[#111] text-zinc-500 hover:bg-zinc-50'}`}
                  >
                    <span className="font-black text-xs uppercase">Klasik</span>
                    <span className={`text-[9px] font-bold mt-1 ${bbEdition === 'retro' ? 'text-[#111]/70' : 'text-zinc-500'}`}>10rb/gr</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest block mb-2 text-[#997404]">3 • Kondisi Emas</label>
                <div className="grid grid-cols-1 gap-2">
                  <button 
                    onClick={() => { triggerHaptic(); setBbCondition("mulus"); }}
                    className={`flex items-center justify-between p-3 border-2 transition-all active:scale-95 ${bbCondition === 'mulus' ? 'bg-[#FFD700] border-[#111] text-[#111] shadow-[2px_2px_0px_0px_#111]' : 'bg-white border-[#111] text-zinc-500 hover:bg-zinc-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${bbCondition === 'mulus' ? 'border-[#111]' : 'border-zinc-300'}`}>
                        {bbCondition === 'mulus' && <div className="w-2 h-2 bg-[#111] rounded-full"></div>}
                      </div>
                      <span className="font-black text-xs uppercase">Mulus 100%</span>
                    </div>
                    <span className={`text-[9px] font-bold ${bbCondition === 'mulus' ? 'text-[#111]/70' : 'text-zinc-500'}`}>Harga Normal</span>
                  </button>

                  <button 
                    onClick={() => { triggerHaptic(); setBbCondition("baret"); }}
                    className={`flex items-center justify-between p-3 border-2 transition-all active:scale-95 ${bbCondition === 'baret' ? 'bg-[#FFD700] border-[#111] text-[#111] shadow-[2px_2px_0px_0px_#111]' : 'bg-white border-[#111] text-zinc-500 hover:bg-zinc-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${bbCondition === 'baret' ? 'border-[#111]' : 'border-zinc-300'}`}>
                        {bbCondition === 'baret' && <div className="w-2 h-2 bg-[#111] rounded-full"></div>}
                      </div>
                      <span className="font-black text-xs uppercase">Baret / Buka Segel</span>
                    </div>
                    <span className={`text-[9px] font-bold ${bbCondition === 'baret' ? 'text-[#111]/70' : 'text-zinc-500'}`}>15rb/gr</span>
                  </button>
                </div>
              </div>

              <div className="bg-[#111] text-white p-5 -mx-5 mt-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Estimasi Lu Terima</p>
                <p className="text-4xl font-black text-[#FFD700] tracking-tighter">Rp {calculatedBbEstimate.toLocaleString('id-ID')}</p>
                <p className="text-[9px] font-bold text-zinc-400 mt-2 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  Final dicek saat COD.
                </p>
              </div>

              <button onClick={handleBuybackWA} className="w-full py-4 mt-2 bg-[#FFD700] text-[#111] font-black uppercase tracking-widest text-xs border-2 border-[#111] shadow-[4px_4px_0px_0px_#111] active:translate-y-1 active:shadow-none transition-all flex justify-center items-center gap-2">
                Proses via WA 
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
              </button>
            </div>
          </section>
        )}

        {/* GALERI */}
        {activeTab === "galeri" && (
          <section className="p-5 animate-in fade-in duration-300 w-full overflow-hidden">
            <h2 className="text-2xl font-black tracking-tight mb-4 uppercase">Verified COD</h2>
            <div className="space-y-4 w-full">
              {gallery.map((pic) => (
                <div key={pic.id} className="border-4 border-[#111] bg-white shadow-[6px_6px_0px_0px_#111]">
                  <img 
                    src={pic.img} 
                    alt="Kolase COD Emas BUNG"
                    className="w-full h-auto object-contain bg-zinc-900 block" 
                  />
                  <div className="p-3 border-t-4 border-[#111] bg-white flex justify-between items-center">
                    <span className="text-xs font-black bg-[#FFD700] text-[#111] px-2 py-1 uppercase">Dokumentasi</span>
                    <p className="text-xs font-black truncate">📍 Jabodetabek</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* INFO (PINDAH SECTION CARA ORDER KESINI, HAPUS TIPS REDUNDAN) */}
        {activeTab === "info" && (
          <section className="p-5 animate-in fade-in duration-300 space-y-6">
            <h2 className="text-3xl font-black tracking-tight uppercase">Info</h2>
            
            <div className="grid grid-cols-3 bg-white border-2 border-[#111] shadow-[4px_4px_0px_0px_#111] text-center divide-x-2 divide-[#111]">
              <div className="p-3">
                <p className="text-xl font-black text-[#111]">50+</p>
                <p className="text-[9px] font-bold text-zinc-500 uppercase mt-0.5">Transaksi COD</p>
              </div>
              <div className="p-3">
                <p className="text-xl font-black text-[#111]">999,9</p>
                <p className="text-[9px] font-bold text-zinc-500 uppercase mt-0.5">Kemurnian</p>
              </div>
              <div className="p-3">
                <p className="text-xl font-black text-[#111]">Jabodetabek</p>
                <p className="text-[9px] font-bold text-zinc-500 uppercase mt-0.5">Area COD</p>
              </div>
            </div>

            {/* CARA ORDER & TRANSAKSI (PINDAHAN DARI HOMEPAGE) */}
            <div className="bg-white border-4 border-[#111] p-5 shadow-[6px_6px_0px_0px_#111]">
              <div className="flex items-center gap-2 border-b-2 border-[#111] pb-3 mb-4">
                <div className="bg-[#FFD700] border-2 border-[#111] p-1.5 flex items-center justify-center font-black text-xs">🚀</div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wider text-[#111]">Cara Order & Transaksi</h3>
                  <p className="text-[10px] font-bold text-zinc-500">Dijamin aman, transparan, dan fleksibel</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { step: "01", title: "Pilih Pecahan", desc: "Pilih gramasi Antam ready stock di katalog atau kalkulator buyback." },
                  { step: "02", title: "Checkout via WhatsApp", desc: "Klik tombol order untuk kirim detail pesanan otomatis ke WhatsApp Bung." },
                  { step: "03", title: "Atur Jadwal COD", desc: "Ketemuan di stasiun KRL Jabodetabek, area publik ramai, atau diantar langsung." },
                  { step: "04", title: "Cek Fisik & Bayar", desc: "Cek segel & sertifikat Antam bareng, transfer resmi BCA a.n. Gilang Segara Bening atau cash." },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3.5 p-3 border-2 border-zinc-200 bg-[#fdfdfc]">
                    <span className="bg-[#FFD700] text-[#111] font-black text-xs px-2 py-1 border-2 border-[#111] shrink-0 mt-0.5 shadow-[2px_2px_0px_0px_#111]">
                      {item.step}
                    </span>
                    <div>
                      <h4 className="font-black text-xs uppercase tracking-wide text-[#111]">{item.title}</h4>
                      <p className="text-[11px] font-bold text-zinc-600 leading-tight mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-[11px] font-black tracking-widest text-[#997404] uppercase">FAQ</h3>
              <div className="bg-white border-2 border-[#111] shadow-[4px_4px_0px_0px_#111] divide-y-2 divide-[#111]">
                {[
                  { q: "Emasnya asli gak?", a: "Antam Logam Mulia resmi, segel CertiEye utuh. Kamu bisa scan dan cek sertifikat bareng sebelum transaksi." },
                  { q: "Bagaimana rekening pembayaran resminya?", a: "Semua transaksi transfer hanya menggunakan rekening BCA atas nama Gilang Segara Bening. Waspada penipuan di luar rekening tersebut." },
                  { q: "Di mana saja titik temu COD yang tersedia?", a: "Sangat fleksibel! Bisa di stasiun KRL Jabodetabek terdekat, coffee shop/mall ramai, mampir ke rumah, atau diantar langsung ke rumah kamu." },
                  { q: "Apakah terima buyback emas lama?", a: "Ya! Emas Antam dari pecahan kecil sampai besar, baik cetakan press baru atau klasik, kami terima buyback dengan rate kompetitif." }
                ].map((faq, idx) => (
                  <div key={idx} className="p-4">
                    <button 
                      onClick={() => setOpenFaq(openFaq === idx ? null : idx)} 
                      className="w-full flex justify-between items-center text-left"
                    >
                      <span className="font-black text-sm">{faq.q}</span>
                      <span className="font-black text-lg text-[#997404]">{openFaq === idx ? "×" : "+"}</span>
                    </button>
                    {openFaq === idx && (
                      <p className="text-xs font-bold text-zinc-600 mt-3 leading-relaxed pt-2 border-t border-zinc-100">
                        {faq.a}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* CART MODAL */}
      {showCart && (
        <div className="fixed inset-0 z-50 bg-[#111]/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
          <div className="bg-white w-[85%] max-w-sm h-full border-l-4 border-[#111] p-5 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex justify-between items-center border-b-4 border-[#111] pb-4 mb-4">
              <h2 className="text-2xl font-black">CART</h2>
              <button onClick={() => setShowCart(false)} className="font-black text-xl px-2 border-2 border-[#111] hover:bg-[#FFD700] hover:text-[#111] transition-colors">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 hide-scrollbar">
              {cart.length === 0 ? (
                <div className="text-center mt-20 space-y-2">
                  <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Keranjang Kosong</p>
                  <p className="text-xs text-zinc-500">Yuk pilih pecahan emas ready stock dulu!</p>
                </div>
              ) : (
                cart.map((c, i) => (
                  <div key={i} className="border-2 border-[#111] p-3 flex justify-between items-center bg-zinc-50 shadow-[2px_2px_0px_0px_#111]">
                    <div>
                      <h4 className="font-black text-lg">{c.gram} Gram</h4>
                      <p className="text-[10px] font-bold text-[#997404]">Rp {c.price.toLocaleString('id-ID')} /pcs</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black">QTY</span>
                        <span className="font-black text-lg">{c.qty}</span>
                      </div>
                      <button onClick={() => setCart(cart.filter(x => x.gram !== c.gram))} className="text-[9px] border-2 border-[#111] bg-white text-[#111] px-2 py-1 font-black active:bg-[#FFD700] active:text-[#111] transition-colors">DEL</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t-4 border-[#111] pt-4 mt-4 bg-white">
              <div className="flex justify-between items-end mb-1">
                <span className="font-black uppercase tracking-wider text-[10px]">Rekening BCA:</span>
                <span className="font-bold text-[10px] text-zinc-600">Gilang Segara Bening</span>
              </div>
              <div className="flex justify-between items-end mb-4">
                <span className="font-black uppercase tracking-wider text-xs">Total Order:</span>
                <span className="font-black text-2xl text-[#997404] tracking-tighter">Rp {cartTotal.toLocaleString('id-ID')}</span>
              </div>
              
              <button onClick={handleCheckoutWA} disabled={cart.length===0} className="w-full py-4 bg-[#FFD700] text-[#111] font-black uppercase text-sm border-2 border-[#111] active:translate-y-1 shadow-[4px_4px_0px_0px_#111] active:shadow-none transition-all disabled:opacity-50 disabled:shadow-none disabled:active:translate-y-0">
                LANJUT VIA WA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t-4 border-[#111] flex justify-between px-2 pt-3 pb-6 z-40">
        {[
          { id:"beranda", label:"Beranda", icon: <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg> }, 
          { id:"produk", label:"Produk", icon: <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg> }, 
          { id:"galeri", label:"Galeri", icon: <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> }, 
          { id:"jual", label:"Jual", icon: <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg> },
          { id:"info", label:"Info", icon: <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> }
        ].map(t => (
          <button 
            key={t.id} 
            onClick={() => { triggerHaptic(); setActiveTab(t.id); }} 
            className={`flex flex-col items-center w-14 relative transition-colors ${activeTab === t.id ? 'text-[#b8860b]' : 'text-zinc-400 hover:text-[#111]'}`}
          >
            {t.icon}
            <span className="text-[9px] font-black uppercase tracking-widest">{t.label}</span>
          </button>
        ))}
      </nav>

      {/* ADMIN PIN MODAL */}
      {showAdminPin && (
        <div className="fixed inset-0 z-50 bg-[#111]/90 flex items-center justify-center p-5 backdrop-blur-sm">
          <div className="bg-[#f3f3f3] border-4 border-[#111] p-6 rounded-none w-full max-w-sm shadow-[8px_8px_0px_0px_#FFD700]">
            <h3 className="font-black text-xl mb-4 text-center">ADMIN ACCESS</h3>
            <input type="password" maxLength={4} value={pinInput} onChange={(e) => setPinInput(e.target.value)} className="w-full border-4 border-[#111] bg-white font-black text-2xl py-3 text-center tracking-[1em] mb-4 outline-none focus:border-[#FFD700]" />
            <div className="flex gap-3">
              <button onClick={() => setShowAdminPin(false)} className="flex-1 py-3 border-4 border-[#111] bg-white font-black text-xs uppercase active:translate-y-1">Batal</button>
              <button onClick={handlePinSubmit} className="flex-1 py-3 bg-[#FFD700] text-[#111] border-4 border-[#111] font-black text-xs uppercase active:translate-y-1">Login</button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN PANEL */}
      {showAdminPanel && (
        <div className="fixed inset-0 z-50 bg-[#f3f3f3] flex flex-col p-5 overflow-y-auto">
          <div className="max-w-md w-full mx-auto pb-20">
            <div className="flex justify-between items-center border-b-4 border-[#111] pb-4 mb-4 pt-2">
              <h2 className="text-2xl font-black text-[#997404]">COMMAND CENTER</h2>
              <button onClick={() => setShowAdminPanel(false)} className="text-[10px] font-black border-2 border-[#111] px-3 py-1 bg-white shadow-[2px_2px_0px_0px_#111] active:translate-y-1">TUTUP</button>
            </div>

            <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar pb-2">
              {['price', 'stock', 'gallery', 'orders'].map(tab => (
                <button key={tab} onClick={()=>setAdminTab(tab)} className={`px-4 py-2 font-black text-xs uppercase border-2 border-[#111] ${adminTab===tab ? 'bg-[#111] text-[#FFD700] shadow-[2px_2px_0px_0px_#FFD700]' : 'bg-white text-[#111]'}`}>{tab}</button>
              ))}
            </div>

            {adminTab === 'price' && (
              <div className="bg-white p-5 border-4 border-[#111] shadow-[4px_4px_0px_0px_#111] space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase">Base Jual (1g):</label>
                  <input type="number" value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value))} className="w-full border-2 border-[#111] font-black text-xl py-2 px-3 outline-none focus:border-[#FFD700]" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase">Buyback Base (1g):</label>
                  <input type="number" value={buybackPrice} onChange={(e) => setBuybackPrice(Number(e.target.value))} className="w-full border-2 border-[#111] font-black text-xl py-2 px-3 outline-none focus:border-[#FFD700]" />
                </div>
              </div>
            )}

            {adminTab === 'stock' && (
              <div className="space-y-4">
                <div className="bg-white p-4 border-4 border-[#111] shadow-[4px_4px_0px_0px_#111]">
                  <h3 className="font-black text-xs uppercase mb-3 text-[#997404]">Edit Stok & Diskon Existing</h3>
                  {inventory.map((item, idx) => (
                    <div key={item.gram} className="flex items-center justify-between py-2 border-b-2 border-zinc-100">
                      <span className="font-black w-12">{item.gram}g</span>
                      <div className="flex gap-2 items-center">
                        <div className="flex flex-col"><span className="text-[8px] font-bold">STOK</span><input type="number" value={item.stock} onChange={(e)=>{const n=[...inventory]; n[idx].stock=Number(e.target.value); setInventory(n)}} className="w-12 border-2 border-[#111] text-center font-bold outline-none focus:border-[#FFD700]" /></div>
                        <div className="flex flex-col"><span className="text-[8px] font-bold">DISKON (Rp)</span><input type="number" value={item.discount} onChange={(e)=>{const n=[...inventory]; n[idx].discount=Number(e.target.value); setInventory(n)}} className="w-20 border-2 border-[#111] text-center font-bold outline-none focus:border-[#FFD700]" /></div>
                        <button onClick={()=>{setInventory(inventory.filter((_, i) => i !== idx))}} className="bg-[#111] text-[#FFD700] font-black px-2 py-1 text-[10px] border border-[#111]">✕</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white p-4 border-4 border-[#111] shadow-[4px_4px_0px_0px_#111] space-y-3">
                  <h3 className="font-black text-xs uppercase text-[#997404]">Tambah Gramasi Baru</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" placeholder="Gram" value={newGram} onChange={(e)=>setNewGram(e.target.value)} className="border-2 border-[#111] p-2 text-xs font-bold focus:border-[#FFD700] outline-none" />
                    <input type="number" placeholder="Stok" value={newStock} onChange={(e)=>setNewStock(e.target.value)} className="border-2 border-[#111] p-2 text-xs font-bold focus:border-[#FFD700] outline-none" />
                    <input type="number" placeholder="Diskon" value={newDisc} onChange={(e)=>setNewDisc(e.target.value)} className="border-2 border-[#111] p-2 text-xs font-bold focus:border-[#FFD700] outline-none" />
                  </div>
                  <button onClick={()=>{
                    if(!newGram || !newStock) return alert("Isi gram dan stok dengan benar!");
                    setInventory([...inventory, { gram: Number(newGram), stock: Number(newStock), discount: Number(newDisc) || 0 }]);
                    setNewGram(""); setNewStock(""); setNewDisc("");
                    alert("Produk baru berhasil ditambahkan!");
                  }} className="w-full bg-[#111] text-[#FFD700] py-2 font-black text-xs uppercase">
                    + Tambahkan Produk
                  </button>
                </div>
              </div>
            )}

            {adminTab === 'gallery' && (
              <div className="space-y-4">
                <div className="bg-white p-4 border-4 border-[#111] shadow-[4px_4px_0px_0px_#111]">
                  <h3 className="font-black text-xs uppercase mb-3 text-[#997404]">Galeri Aktif</h3>
                  <p className="text-[10px] font-bold text-zinc-600">File <code className="bg-zinc-100 px-1 py-0.5 border border-[#111]">cod2.png</code> diset tampil penuh secara proporsional.</p>
                </div>
              </div>
            )}

            {adminTab === 'orders' && (
              <div className="space-y-3">
                {orders.length === 0 ? <p className="text-xs font-bold text-zinc-500 bg-white p-4 border-2 border-[#111]">Belum ada order.</p> : orders.map(ord => (
                  <div key={ord.id} className="bg-white p-3 border-2 border-[#111] shadow-[2px_2px_0px_0px_#111]">
                    <div className="flex justify-between border-b-2 border-zinc-100 pb-1 mb-2">
                      <span className="font-black text-[10px] text-[#997404]">{ord.id}</span>
                      <span className={`font-bold text-[10px] uppercase ${ord.status === 'Done' ? 'text-green-500' : 'text-zinc-400'}`}>{ord.status}</span>
                    </div>
                    <p className="text-xs font-black">{ord.detail}</p>
                    {ord.status !== 'Done' && (
                      <button onClick={()=>{const n = orders.map(o => o.id === ord.id ? {...o, status: "Done"} : o); setOrders(n); saveToStorage({orders: n});}} className="mt-2 text-[9px] border-2 border-[#111] bg-white text-[#111] px-2 py-1 uppercase font-black active:bg-[#111] active:text-white">Tandai Selesai</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button onClick={handleAdminSave} className="w-full mt-6 py-4 bg-[#FFD700] text-[#111] border-4 border-[#111] font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_#111] active:translate-y-1 active:shadow-none transition-all">
              SIMPAN & DEPLOY ➔
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        .animate-marquee {
          display: inline-block;
          animation: marquee 25s linear infinite;
        }
        
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </main>
  );
}