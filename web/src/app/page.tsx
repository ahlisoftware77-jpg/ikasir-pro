'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/store/auth';
import { collection, doc, query, onSnapshot, orderBy, where, getDocs, writeBatch, limit } from 'firebase/firestore';
import { db, primaryDb } from '@/lib/firebase';
import { DollarSign, Package, ShoppingBag, TrendingUp, Users, Copy, Share2, ExternalLink, X, Loader2, Download, ChevronLeft, ChevronRight, Sparkles, CheckCircle, CreditCard, Globe, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import SubscriptionModal from '@/components/SubscriptionModal';
import Link from 'next/link';
import { useBranding } from '@/context/BrandingContext';

export default function Home() {
  const { user, role, storeId } = useAuthStore();
  const { branding } = useBranding();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [customersCount, setCustomersCount] = useState(0);

  const [isResetRevenueModalOpen, setIsResetRevenueModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // State for Announcements and Subscription Card
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [isLoadingBroadcasts, setIsLoadingBroadcasts] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [joinMarketplace, setJoinMarketplace] = useState(false);
  const [isOnlineStoreActive, setIsOnlineStoreActive] = useState(false);
  const [isUpdatingMarketplace, setIsUpdatingMarketplace] = useState(false);
  const [isUpdatingOnlineStore, setIsUpdatingOnlineStore] = useState(false);

  const SUBSCRIPTION_PACKAGES = useMemo(() => {
    const pkgs = [
      { id: '1m', title: '1 Bulan', defaultPrice: 30000, months: 1 },
      { id: '3m', title: '3 Bulan', defaultPrice: 84000, months: 3 },
      { id: '6m', title: '6 Bulan', defaultPrice: 159000, months: 6 },
      { id: '12m', title: '12 Bulan', defaultPrice: 306000, months: 12 },
    ];

    return pkgs.map(p => {
      const priceKey = `pkg_${p.id}_price`;
      const typeKey = `pkg_${p.id}_discount_type`;
      const valKey = `pkg_${p.id}_discount_val`;

      const basePrice = Number((branding as any)[priceKey] ?? p.defaultPrice);
      const discountType = (branding as any)[typeKey] || 'none';
      const discountVal = Number((branding as any)[valKey] ?? 0);

      let finalPrice = basePrice;
      let discountLabel = '';

      if (discountType === 'percent') {
        finalPrice = Math.max(0, basePrice * (1 - discountVal / 100));
        discountLabel = `${discountVal}% OFF`;
      } else if (discountType === 'nominal') {
        finalPrice = Math.max(0, basePrice - discountVal);
        discountLabel = `HEMAT Rp ${discountVal.toLocaleString('id-ID')}`;
      }

      const pricePerMonth = Math.round(finalPrice / p.months);

      const defaultDiscountLabels: Record<string, string> = {
        '3m': 'HEMAT 7%',
        '6m': 'HEMAT 12%',
        '12m': 'HEMAT 15%'
      };
      const finalDiscountLabel = discountLabel || defaultDiscountLabels[p.id] || '';

      return {
        id: p.id,
        title: p.title,
        price: finalPrice,
        pricePerMonth,
        discountLabel: finalDiscountLabel
      };
    });
  }, [branding]);

  const handleResetRevenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetConfirmText !== 'Kosongkan Saldo') {
      toast.error('Teks konfirmasi salah!');
      return;
    }
    if (!storeId) return;

    setIsResetting(true);
    try {
      const q = query(collection(db, 'transactions'), where('storeId', '==', storeId));
      const snap = await getDocs(q);
      let batch = writeBatch(db);
      let count = 0;
      let totalDeleted = 0;
      
      for (const docSnap of snap.docs) {
        batch.delete(docSnap.ref);
        count++;
        totalDeleted++;
        if (count === 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }

      toast.success(`Berhasil menghapus ${totalDeleted} transaksi. Pendapatan kotor berhasil di-reset!`);
      setIsResetRevenueModalOpen(false);
      setResetConfirmText('');
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal mereset pendapatan kotor: ' + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleToggleMarketplace = async (newVal: boolean) => {
    if (!storeId || isUpdatingMarketplace) return;
    setIsUpdatingMarketplace(true);
    
    // Import dynamically to optimize bundle
    const { doc, getDoc, updateDoc, writeBatch } = await import('firebase/firestore');

    try {
      const settingsRef = doc(db, 'settings', `store_${storeId}`);
      const settingsSnap = await getDoc(settingsRef);
      const storeName = settingsSnap.exists() ? (settingsSnap.data().storeName || '') : '';

      // 1. Update store settings document
      await updateDoc(settingsRef, {
        joinMarketplace: newVal
      });

      // 2. Update joinMarketplace on all products of this store
      const prodQuery = query(collection(db, 'products'), where('storeId', '==', storeId));
      const prodSnap = await getDocs(prodQuery);
      
      let batch = writeBatch(db);
      let count = 0;
      
      prodSnap.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          joinMarketplace: newVal,
          storeName: storeName
        });
        count++;
        if (count === 400) {
          batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      });
      
      if (count > 0) {
        await batch.commit();
      }

      toast.success(newVal ? 'Marketplace Bersama berhasil DIAKTIFKAN!' : 'Marketplace Bersama berhasil DINONAKTIFKAN!');
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal mengubah status marketplace: ' + err.message);
    } finally {
      setIsUpdatingMarketplace(false);
    }
  };

  const handleToggleOnlineStore = async (newVal: boolean) => {
    if (!storeId || isUpdatingOnlineStore) return;
    setIsUpdatingOnlineStore(true);

    const { doc, updateDoc } = await import('firebase/firestore');

    try {
      const settingsRef = doc(db, 'settings', `store_${storeId}`);
      await updateDoc(settingsRef, {
        isOnlineStoreActive: newVal
      });
      toast.success(newVal ? 'Outlet Toko Online berhasil DIAKTIFKAN!' : 'Outlet Toko Online berhasil DINONAKTIFKAN!');
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal mengubah status outlet online: ' + err.message);
    } finally {
      setIsUpdatingOnlineStore(false);
    }
  };

  useEffect(() => {
    if (!storeId) return;

    // Listen to store settings change
    const unsubSettings = onSnapshot(doc(db, 'settings', `store_${storeId}`), (docSnap: any) => {
      if (docSnap.exists()) {
        setJoinMarketplace(docSnap.data().joinMarketplace === true);
        setIsOnlineStoreActive(docSnap.data().isOnlineStoreActive !== false);
      }
    });

    const qTrx = query(
      collection(db, 'transactions'), 
      where('storeId', '==', storeId),
      orderBy('timestamp', 'desc')
    );
    const unsubTrx = onSnapshot(qTrx, (snap) => {
      const items: any[] = [];
      snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      setTransactions(items);
    });

    const qCust = query(
      collection(db, 'customers'),
      where('storeId', '==', storeId)
    );
    const unsubCust = onSnapshot(qCust, (snap) => {
      setCustomersCount(snap.size);
    });

    return () => { unsubSettings(); unsubTrx(); unsubCust(); };
  }, [storeId]);



  // Load announcements (broadcasts)
  useEffect(() => {
    const q = query(
      collection(primaryDb, 'broadcasts'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setBroadcasts(list);
      setIsLoadingBroadcasts(false);
    }, (error) => {
      console.error("Error fetching broadcasts:", error);
      setIsLoadingBroadcasts(false);
    });
    return () => unsub();
  }, []);

  const activeBroadcasts = useMemo(() => {
    if (broadcasts.length > 0) return broadcasts;
    return [
      {
        id: 'default-welcome',
        title: 'Selamat Datang di iKasir Pro Web Dashboard!',
        message: 'Kelola transaksi, produk, stok, laporan keuangan, dan lainnya secara real-time dengan mudah di satu tempat.',
        createdAt: new Date().toISOString(),
        data: { link: 'https://yadiapp.com' }
      }
    ];
  }, [broadcasts]);

  // Auto-slide announcements
  useEffect(() => {
    if (activeBroadcasts.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % activeBroadcasts.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [activeBroadcasts.length]);

  const { totalPendapatan, totalProduk, topProducts } = useMemo(() => {
    let rev = 0;
    let qty = 0;
    let productMap: Record<string, {name: string, qty: number}> = {};

    transactions.forEach(trx => {
      rev += (trx.total || 0);
      trx.items?.forEach((item: any) => {
        qty += item.qty;
        if (!productMap[item.productId]) {
          productMap[item.productId] = { name: item.productName, qty: 0 };
        }
        productMap[item.productId].qty += item.qty;
      });
    });

    const top = Object.values(productMap).sort((a,b) => b.qty - a.qty).slice(0, 5);

    return { totalPendapatan: rev, totalProduk: qty, topProducts: top };
  }, [transactions]);

  const stats = [
    { name: 'Total Pendapatan', value: `Rp ${totalPendapatan.toLocaleString('id-ID')}`, icon: '💰', change: 'Realtime', positive: true },
    { name: 'Total Transaksi', value: transactions.length.toLocaleString(), icon: '🛒', change: 'Realtime', positive: true },
    { name: 'Produk Terjual', value: totalProduk.toLocaleString(), icon: '📦', change: 'Realtime', positive: true },
    { name: 'Total Pelanggan', value: customersCount.toLocaleString(), icon: '👥', change: 'Realtime', positive: true },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">Dashboard</h1>
          <p className="text-xs md:text-sm text-app-text-muted mt-2 font-medium">Selamat datang kembali, <span className="text-accent font-bold">{user?.email}</span> 👋</p>
        </div>

        {/* Panel Link Marketplace & Outlet Online Bersama */}
        {storeId && (
          <div className="flex flex-col lg:flex-row gap-6 max-w-5xl">
            {/* Panel Marketplace */}
            <div className="flex-1 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-colors ${joinMarketplace ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 border-emerald-250 dark:border-emerald-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                  <Globe size={24} />
                </div>
                <div className="min-w-0">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider inline-block mb-1.5 ${joinMarketplace ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-450' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                    {joinMarketplace ? 'Marketplace Aktif' : 'Marketplace Nonaktif'}
                  </span>
                  <h3 className="font-extrabold text-sm text-slate-950 dark:text-white leading-snug">
                    Marketplace Bersama iKasir
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                    {joinMarketplace ? 'Toko Anda aktif dan tampil di halaman pencarian marketplace bersama.' : 'Aktifkan untuk menampilkan produk Anda di marketplace bersama.'}
                  </p>
                  {joinMarketplace && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold truncate mt-2 bg-emerald-500/5 px-2.5 py-1 rounded-lg border border-emerald-500/10">
                      {`Tautan: ${window.location.origin}/marketplace?storeId=${storeId}`}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col xs:flex-row md:flex-col gap-2 shrink-0 w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between md:justify-end gap-3 bg-slate-50 dark:bg-slate-950/50 px-4 py-2.5 rounded-2xl border border-slate-150 dark:border-slate-850">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-350">Status</span>
                  <button
                    type="button"
                    disabled={isUpdatingMarketplace}
                    onClick={() => handleToggleMarketplace(!joinMarketplace)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${joinMarketplace ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${joinMarketplace ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                  </button>
                </div>

                {joinMarketplace && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/marketplace?storeId=${storeId}`);
                        toast.success("Link Toko Marketplace berhasil disalin!");
                      }}
                      className="flex-1 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-black rounded-xl text-xs active:scale-95 transition-all border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5"
                    >
                      <Copy size={13} />
                      Salin
                    </button>
                    <Link
                      href={`/marketplace?storeId=${storeId}`}
                      className="flex-1 px-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-emerald-500/10"
                    >
                      <ExternalLink size={13} />
                      Buka
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Panel Outlet Toko Online */}
            <div className="flex-1 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-colors ${isOnlineStoreActive ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 border-blue-250 dark:border-blue-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                  <ShoppingBag size={24} />
                </div>
                <div className="min-w-0">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider inline-block mb-1.5 ${isOnlineStoreActive ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-650 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                    {isOnlineStoreActive ? 'Toko Online Buka' : 'Toko Online Tutup'}
                  </span>
                  <h3 className="font-extrabold text-sm text-slate-950 dark:text-white leading-snug">
                    Outlet Online Mandiri
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                    {isOnlineStoreActive ? 'Toko online Anda aktif menerima pesanan langsung dari pelanggan publik.' : 'Nonaktifkan untuk sementara menutup pemesanan dari luar.'}
                  </p>
                  {isOnlineStoreActive && (
                    <p className="text-[10px] text-blue-650 dark:text-blue-400 font-bold truncate mt-2 bg-blue-500/5 px-2.5 py-1 rounded-lg border border-blue-500/10">
                      {`Tautan: ${window.location.origin}/tr?storeId=${storeId}`}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col xs:flex-row md:flex-col gap-2 shrink-0 w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between md:justify-end gap-3 bg-slate-50 dark:bg-slate-950/50 px-4 py-2.5 rounded-2xl border border-slate-150 dark:border-slate-850">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-350">Status</span>
                  <button
                    type="button"
                    disabled={isUpdatingOnlineStore}
                    onClick={() => handleToggleOnlineStore(!isOnlineStoreActive)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${isOnlineStoreActive ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isOnlineStoreActive ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                  </button>
                </div>

                {isOnlineStoreActive && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/tr?storeId=${storeId}`);
                        toast.success("Link Toko Online berhasil disalin!");
                      }}
                      className="flex-1 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-black rounded-xl text-xs active:scale-95 transition-all border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5"
                    >
                      <Copy size={13} />
                      Salin
                    </button>
                    <Link
                      href={`/tr?storeId=${storeId}`}
                      className="flex-1 px-3.5 py-2.5 bg-blue-500 hover:bg-blue-450 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-blue-500/10"
                    >
                      <ExternalLink size={13} />
                      Buka
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {!isLoadingBroadcasts ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Announcements Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 border border-indigo-500/30 rounded-[2.5rem] p-6 md:p-8 shadow-xl shadow-indigo-950/20 hover:border-indigo-400/40 transition-all duration-300 flex flex-col justify-between">
            {/* Subtle inside glow glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full filter blur-3xl pointer-events-none" />
            
            <div>
              <div className="flex items-center justify-between mb-4 md:mb-6 px-1 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-xl shadow-inner animate-bounce">
                    📢
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-widest text-white">Pengumuman & Info Terbaru</h2>
                </div>
                {activeBroadcasts.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentSlide((prev) => (prev === 0 ? activeBroadcasts.length - 1 : prev - 1))}
                      className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all hover:scale-105 active:scale-95"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setCurrentSlide((prev) => (prev + 1) % activeBroadcasts.length)}
                      className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all hover:scale-105 active:scale-95"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
     
              <div className="min-h-[120px] flex flex-col md:flex-row items-start gap-6 relative z-10">
                <div className="flex-1 space-y-3 w-full">
                  <span className="inline-block text-[9px] font-black uppercase tracking-widest bg-white/10 text-emerald-300 border border-white/10 px-2.5 py-1 rounded-md">
                    {new Date(activeBroadcasts[currentSlide].createdAt || Date.now()).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                  <h3 className="text-base md:text-lg font-black text-white tracking-tight leading-snug">
                    {activeBroadcasts[currentSlide].title}
                  </h3>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    {activeBroadcasts[currentSlide].message}
                  </p>
                  {activeBroadcasts[currentSlide].data?.link && (
                    <a
                      href={activeBroadcasts[currentSlide].data.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-cyan-400 hover:text-cyan-300 mt-2"
                    >
                      Lihat Selengkapnya <ExternalLink size={12} />
                    </a>
                  )}
                </div>
     
                {activeBroadcasts[currentSlide].data?.imageUrl && (
                  <div className="w-full md:w-1/3 aspect-[2/1] md:aspect-[3/2] rounded-2xl overflow-hidden border border-white/10 bg-slate-950 relative shrink-0 shadow-inner">
                    <img
                      src={activeBroadcasts[currentSlide].data.imageUrl}
                      alt={activeBroadcasts[currentSlide].title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
     
            {/* Dots Indicator */}
            {activeBroadcasts.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-6 relative z-10">
                {activeBroadcasts.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      currentSlide === idx ? 'w-6 bg-cyan-400' : 'w-2 bg-white/20'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Promo Card - GREEN/SLATE premium card layout */}
          <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 border border-emerald-500/30 rounded-[2.5rem] p-6 md:p-8 text-white shadow-xl shadow-emerald-950/20 group hover:border-emerald-400/40 transition-all duration-500 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-white/5 blur-3xl pointer-events-none group-hover:scale-125 transition-transform duration-700"></div>
            <div className="absolute -left-16 -bottom-16 w-48 h-48 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none group-hover:scale-125 transition-transform duration-700"></div>
    
            <div className="relative z-10 space-y-6">
              <div>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full w-fit mb-4">
                  <Sparkles size={12} className="text-yellow-300 animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-yellow-300">Promo Spesial Langganan</span>
                </div>
                <h2 className="text-xl md:text-2xl font-black tracking-tight leading-tight">Mulai Berlangganan iKasir Pro</h2>
                <p className="text-white/70 text-xs mt-1 leading-relaxed">
                  Buka fitur-fitur terbaik dan tingkatkan efisiensi kasir serta bisnis Anda.
                </p>
              </div>
    
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-inner">
                    <TrendingUp size={14} className="text-emerald-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black uppercase tracking-wide text-white/95">Analisis Bisnis Lengkap</span>
                    <span className="text-[10px] text-white/60">Laporan Omzet, Terlaris, & Arus Kas Realtime</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-inner">
                    <Globe size={14} className="text-emerald-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black uppercase tracking-wide text-white/95">Toko Online Mandiri</span>
                    <span className="text-[10px] text-white/60">Link pemesanan mandiri & menu online pelanggan</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-inner">
                    <Printer size={14} className="text-emerald-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black uppercase tracking-wide text-white/95">Cetak Struk Kustom & Multi-user</span>
                    <span className="text-[10px] text-white/60">Dukungan printer Bluetooth, PDF A4 & TTD digital</span>
                  </div>
                </div>
              </div>
            </div>
    
            <div className="relative z-10 mt-6 pt-4 border-t border-white/10 flex flex-col md:flex-row items-center gap-4 justify-between">
              <div>
                <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest">Pilihan Paket Premium</p>
                <p className="text-lg font-black text-emerald-300">Mulai Rp 25.500 <span className="text-[10px] font-bold text-white/60">/ bulan</span></p>
              </div>
              <button
                onClick={() => setShowSubscriptionModal(true)}
                className="w-full md:w-auto px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <CreditCard size={14} className="stroke-[2.5]" />
                Pilih Paket
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-pulse h-[250px] bg-slate-900/50 rounded-[2.5rem] border border-slate-800"></div>
      )}

      {/* SHARE STORE LINK CARD */}
      <div className="bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/20 rounded-[2rem] p-6 mb-4 flex flex-col md:flex-row items-center justify-between gap-6 group hover:border-accent/40 transition-all duration-500 shadow-xl shadow-accent/5">
        <div className="flex items-center gap-5 w-full md:w-auto">
          <div className="w-16 h-16 rounded-2xl bg-accent text-foreground flex items-center justify-center shadow-lg shadow-accent/30 group-hover:scale-110 transition-transform duration-500 text-3xl">
            🔗
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground tracking-tight">Link Pemesanan Online</h2>
            <p className="text-xs text-app-text-muted font-medium mt-1">Bagikan link ini ke pelanggan agar mereka dapat memesan produk Anda secara mandiri.</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="flex-1 md:w-64 bg-background/50 border border-app-border rounded-xl px-4 py-3 text-xs font-bold text-app-text-muted truncate select-all">
            {typeof window !== 'undefined' ? `${window.location.origin}/tr?s=${storeId}` : 'Loading link...'}
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={() => {
                const url = `${window.location.origin}/tr?s=${storeId}`;
                navigator.clipboard.writeText(url);
                toast.success('Link pemesanan berhasil disalin!');
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-surface border border-app-border hover:border-accent hover:text-accent text-foreground rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95"
            >
              <Copy size={14} /> Salin
            </button>
            <button 
              onClick={() => {
                const url = `${window.location.origin}/tr?s=${storeId}`;
                if (navigator.share) {
                  navigator.share({
                    title: 'Toko Online Kami',
                    text: 'Silakan kunjungi toko online kami untuk memesan produk favorit Anda!',
                    url: url
                  }).catch(console.error);
                } else {
                  window.open(url, '_blank');
                }
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-accent text-foreground rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-accent/20 hover:bg-accent-hover transition-all active:scale-95"
            >
              <Share2 size={14} /> Bagikan
            </button>
          </div>
        </div>
      </div>

      {/* DOWNLOAD APK BANNER */}
      <div className="bg-gradient-to-br from-indigo-500/5 to-indigo-500/10 border border-indigo-500/20 rounded-[2rem] p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 group hover:border-indigo-500/40 transition-all duration-500 shadow-xl shadow-indigo-500/5">
        <div className="flex items-center gap-5 w-full md:w-auto">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform duration-500 text-3xl">
            📲
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground tracking-tight">Aplikasi Android iKasir Pro</h2>
            <p className="text-xs text-app-text-muted font-medium mt-1">Unduh aplikasi Android (APK) untuk melakukan transaksi penjualan dan kelola toko langsung melalui HP Anda.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <a 
            href="https://bit.ly/ikasirpro"
            target="_blank"
            rel="noreferrer"
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-500 text-white hover:bg-indigo-600 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
          >
            <Download size={14} /> Unduh APK Android
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-surface border border-app-border rounded-2xl md:rounded-[2rem] p-4 md:p-8 shadow-xl shadow-black/5 hover:border-accent/30 transition-all group active:scale-95 duration-300">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-background border border-app-border flex items-center justify-center shadow-inner group-hover:bg-accent/10 group-hover:border-accent/30 transition-all">
                {typeof stat.icon === 'string' ? (
                  <span className="text-lg md:text-2xl leading-none">{stat.icon}</span>
                ) : (
                  (() => {
                    const IconComp = stat.icon as any;
                    return <IconComp className="w-5 h-5 md:w-7 md:h-7 text-accent" />;
                  })()
                )}
              </div>
              <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border ${stat.positive ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400' : 'bg-rose-400/10 border-rose-400/20 text-rose-400'}`}>
                {stat.change}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1 md:mb-2">
                <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">{stat.name}</p>
                {stat.name === 'Total Pendapatan' && (role === 'admin' || role === 'super-admin' || role === 'superadmin') && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsResetRevenueModalOpen(true);
                    }}
                    className="text-[9px] font-bold text-rose-500 hover:text-rose-600 transition-colors uppercase tracking-wider px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 rounded-md"
                  >
                    Reset
                  </button>
                )}
              </div>
              <h3 className="text-lg md:text-3xl font-black text-foreground tracking-tight truncate">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-surface border border-app-border rounded-[2.5rem] p-8 shadow-xl shadow-black/5 min-h-[450px] flex flex-col transition-colors duration-300">
          <h2 className="text-xl font-black text-foreground mb-8 uppercase tracking-wider flex items-center gap-3">
             <div className="w-2 h-8 bg-accent rounded-full"></div>
             Grafik Penjualan
          </h2>
          <Link 
            href="/reports/monthly" 
            className="flex-1 flex items-center justify-center border-4 border-dashed border-app-border/50 rounded-[2rem] bg-background/50 hover:border-accent/40 hover:bg-accent/5 transition-all duration-300 cursor-pointer group/card"
          >
            <div className="text-center group">
               <span className="text-5xl block mx-auto mb-4 opacity-20 group-hover:scale-110 group-hover:opacity-100 group-hover/card:scale-110 group-hover/card:opacity-100 transition-all duration-500">📈</span>
               <p className="text-app-text-muted font-black group-hover/card:text-accent transition-colors">Buka Laporan Omzet & Grafik</p>
               <p className="text-[10px] text-app-text-muted font-bold mt-1">Klik untuk melihat detail grafik bulanan & tahunan</p>
            </div>
          </Link>
        </div>

        <div className="bg-surface border border-app-border rounded-[2.5rem] p-8 shadow-xl shadow-black/5 flex flex-col transition-colors duration-300">
          <h2 className="text-xl font-black text-foreground mb-8 uppercase tracking-wider">Top 5 Produk</h2>
          <div className="flex-1 flex flex-col gap-6">
            {topProducts.length === 0 ? (
               <div className="text-center text-app-text-muted font-bold text-sm mt-10 opacity-50">Belum ada barang terjual</div>
            ) : topProducts.map((item, index) => (
              <div key={index} className="flex items-center gap-5 group cursor-pointer">
                <div className="w-14 h-14 rounded-2xl bg-background border border-app-border flex-shrink-0 relative overflow-hidden shadow-inner group-hover:border-accent transition-colors flex items-center justify-center">
                  <div className="absolute inset-0 bg-accent/5 animate-pulse"></div>
                  <span className="text-xl opacity-20 group-hover:opacity-100 transition-all">📦</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-foreground truncate group-hover:text-accent transition-colors">{item.name}</p>
                  <p className="text-[10px] text-app-text-muted font-bold uppercase tracking-widest mt-0.5">Penjualan Teratas</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-black text-foreground">{item.qty} <span className="text-[10px] text-app-text-muted font-bold tracking-tighter">PCS</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reset Revenue Confirmation Modal */}
      {isResetRevenueModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface border border-app-border rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black text-foreground tracking-tight">RESET PENDAPATAN KOTOR</h3>
                <p className="text-[10px] text-app-text-muted font-bold uppercase tracking-widest mt-1">Konfirmasi Penghapusan</p>
              </div>
              <button 
                onClick={() => { setIsResetRevenueModalOpen(false); setResetConfirmText(''); }}
                className="w-8 h-8 rounded-lg bg-app-border/50 flex items-center justify-center text-app-text-muted hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleResetRevenue} className="space-y-4">
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs font-bold text-rose-500 leading-relaxed">
                Tindakan ini akan <strong>menghapus secara permanen semua transaksi</strong> pada toko ini dari database. Pendapatan kotor pada dashboard akan kembali ke <strong>Rp 0</strong>. Ketik <strong>Kosongkan Saldo</strong> di bawah untuk mengonfirmasi.
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest pl-2">Teks Konfirmasi</label>
                <input 
                  type="text"
                  required
                  value={resetConfirmText}
                  onChange={e => setResetConfirmText(e.target.value)}
                  placeholder="Kosongkan Saldo"
                  className="w-full px-5 py-4 bg-background border border-app-border rounded-xl text-sm font-bold text-foreground focus:outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isResetting || resetConfirmText !== 'Kosongkan Saldo'}
                className="w-full py-4 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl font-black shadow-lg shadow-rose-500/20 active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2"
              >
                {isResetting && <Loader2 size={16} className="animate-spin" />}
                KONFIRMASI KOSONGKAN SALDO
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Subscription Checkout Modal */}
      <SubscriptionModal isOpen={showSubscriptionModal} onClose={() => setShowSubscriptionModal(false)} />
    </div>
  );
}
