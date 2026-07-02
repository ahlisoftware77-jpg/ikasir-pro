'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Search, ShoppingBag, MessageSquare, Store, AlertCircle, RefreshCw, X, Zap } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
  imageUrls?: string[];
  description?: string;
  videoUrl?: string;
  storeId: string;
  storeName?: string;
  stock?: number;
  manageStock?: boolean;
}

function MarketplaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeIdParam = searchParams.get('storeId');
  const storeNameParam = searchParams.get('storeName');

  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [categories, setCategories] = useState<string[]>(['Semua']);
  
  // Store-specific settings metadata mappings
  const [storePhones, setStorePhones] = useState<Record<string, string>>({});
  const [storeAddresses, setStoreAddresses] = useState<Record<string, string>>({});
  const [storeLogos, setStoreLogos] = useState<Record<string, string>>({});
  
  // Flash Sale state
  const [flashSales, setFlashSales] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Storefront navigation state
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedStoreName, setSelectedStoreName] = useState<string | null>(null);

  // 1-second timer for flash sale countdown
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (storeIdParam) {
      setSelectedStoreId(storeIdParam);
      setSelectedStoreName(storeNameParam || 'Toko');
    } else {
      setSelectedStoreId(null);
      setSelectedStoreName(null);
    }
  }, [storeIdParam, storeNameParam]);

  useEffect(() => {
    async function fetchMarketplaceData() {
      setLoading(true);
      try {
        const q = query(collection(db, 'products'), where('joinMarketplace', '==', true));
        const snap = await getDocs(q);
        const list: Product[] = [];
        const uniqueStoreIds = new Set<string>();

        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            name: data.name || '',
            price: data.price || 0,
            category: data.category || 'Umum',
            imageUrl: data.imageUrl || '',
            imageUrls: data.imageUrls || [],
            description: data.description || '',
            videoUrl: data.videoUrl || '',
            storeId: data.storeId || '',
            storeName: data.storeName || 'Toko Mitra',
            stock: data.stock !== undefined ? data.stock : 0,
            manageStock: data.manageStock !== undefined ? data.manageStock : true,
          });
          if (data.storeId) {
            uniqueStoreIds.add(data.storeId);
          }
        });

        setProducts(list);
        setFilteredProducts(list);

        // Fetch categories
        const cats = ['Semua', ...Array.from(new Set(list.map(p => p.category)))];
        setCategories(cats);

        // Fetch store contacts, addresses, and logos
        const phonesMap: Record<string, string> = {};
        const addressMap: Record<string, string> = {};
        const logosMap: Record<string, string> = {};
        for (const sId of Array.from(uniqueStoreIds)) {
          const settingsSnap = await getDoc(doc(db, 'settings', `store_${sId}`));
          if (settingsSnap.exists()) {
            phonesMap[sId] = settingsSnap.data().phone || '';
            addressMap[sId] = settingsSnap.data().address || '';
            logosMap[sId] = settingsSnap.data().logoUrl || '';
          }
        }
        setStorePhones(phonesMap);
        setStoreAddresses(addressMap);
        setStoreLogos(logosMap);

        // Fetch flash sales for all stores in marketplace
        const allFlashSales: any[] = [];
        for (const sId of Array.from(uniqueStoreIds)) {
          try {
            const fsQuery = query(
              collection(db, 'flash_sales'),
              where('storeId', '==', sId),
              where('isActive', '==', true)
            );
            const fsSnap = await getDocs(fsQuery);
            fsSnap.forEach((fsDoc) => {
              allFlashSales.push({ id: fsDoc.id, ...fsDoc.data() });
            });
          } catch (fsErr) {
            console.error(`Error fetching flash sales for store ${sId}:`, fsErr);
          }
        }
        setFlashSales(allFlashSales);
      } catch (err) {
        console.error("Error fetching marketplace products:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchMarketplaceData();
  }, []);

  useEffect(() => {
    let filtered = products;

    if (selectedStoreId) {
      filtered = filtered.filter(p => p.storeId === selectedStoreId);
    }

    if (selectedCategory !== 'Semua') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const qLower = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(qLower) || 
        (p.storeName && p.storeName.toLowerCase().includes(qLower)) ||
        p.category.toLowerCase().includes(qLower)
      );
    }

    setFilteredProducts(filtered);
  }, [searchQuery, selectedCategory, selectedStoreId, products]);

  const handleWhatsAppRedirect = (product: Product) => {
    const rawPhone = storePhones[product.storeId] || '';
    let formattedPhone = rawPhone.replace(/[^0-9]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.slice(1);
    }
    
    if (!formattedPhone) {
      alert("Toko ini belum menyantumkan nomor WhatsApp yang valid di pengaturannya.");
      return;
    }

    const message = `Halo ${product.storeName || 'Toko'}, saya tertarik dengan produk Anda di Marketplace iKasir:\n\n*${product.name}*\nHarga: Rp ${product.price.toLocaleString('id-ID')}\n\nApakah produk ini masih tersedia?`;
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleStoreClick = (storeId: string, storeName: string) => {
    router.push(`/marketplace?storeId=${storeId}&storeName=${encodeURIComponent(storeName)}`);
  };

  // Flash Sale: get effective price for a product
  const getEffectivePrice = (product: Product) => {
    const activeFs = flashSales.find(fs => {
      if (!fs.isActive) return false;
      const start = new Date(fs.startTime);
      const end = new Date(fs.endTime);
      return currentTime >= start && currentTime <= end;
    });

    if (activeFs && activeFs.products) {
      const fsProd = activeFs.products.find((p: any) => p.productId === product.id);
      if (fsProd && (fsProd.flashStock || 0) > (fsProd.soldCount || 0)) {
        return {
          price: fsProd.flashPrice as number,
          originalPrice: product.price,
          isFlashSale: true,
          flashStock: fsProd.flashStock,
          soldCount: fsProd.soldCount || 0,
        };
      }
    }

    return {
      price: product.price,
      originalPrice: product.price,
      isFlashSale: false,
      flashStock: 0,
      soldCount: 0,
    };
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
      {/* Top Banner/Header */}
      <header className="relative py-12 px-6 overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto flex flex-col items-center text-center relative z-10">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-[2px] mb-4">
            <ShoppingBag size={12} className="animate-pulse" /> iKasir Pro Marketplace
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-3">
            Marketplace <span className="bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">Bersama</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-xl text-xs md:text-sm font-medium leading-relaxed mb-8">
            Temukan berbagai produk unggulan langsung dari ribuan merchant iKasir yang terpercaya. Hubungi penjual secara instan melalui WhatsApp.
          </p>

          {/* Search Box */}
          <div className="w-full max-w-xl relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Search size={18} />
            </div>
            <input 
              type="text" 
              placeholder="Cari produk atau nama toko..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-4 pl-12 pr-4 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white font-bold text-sm focus:outline-none focus:border-emerald-500 transition-all placeholder-slate-400 dark:placeholder-slate-500 shadow-xl shadow-slate-200/50 dark:shadow-black/40 backdrop-blur-md"
            />
          </div>
        </div>
      </header>

      {/* Main Grid Section */}
      <main className="max-w-7xl mx-auto px-6 py-10 w-full flex-1">
        {/* Storefront Filter Banner */}
        {selectedStoreId && (
          <div className="mb-8 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-md shrink-0">
                {storeLogos[selectedStoreId] ? (
                  <img src={storeLogos[selectedStoreId]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Store size={28} />
                )}
              </div>
              <div>
                <span className="text-[9px] font-black bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md uppercase tracking-wider block w-fit mb-1">Toko Terpilih</span>
                <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">{selectedStoreName}</h2>
                <p className="text-xs text-slate-450 dark:text-slate-550 font-medium">{storeAddresses[selectedStoreId] || 'Mitra Penjual Resmi iKasir'}</p>
              </div>
            </div>
            <button 
              onClick={() => {
                router.push('/marketplace');
              }}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-black rounded-2xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all border border-slate-200 dark:border-slate-700 shrink-0"
            >
              <X size={14} /> Lihat Semua Toko
            </button>
          </div>
        )}

        {/* Categories Bar */}
        <div className="flex gap-2 overflow-x-auto pb-6 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border shrink-0 transition-all ${
                selectedCategory === cat
                  ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-lg shadow-emerald-500/20 scale-105'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Active Flash Sale Banners */}
        {(() => {
          const activeFses = flashSales.filter(fs => {
            if (!fs.isActive) return false;
            const start = new Date(fs.startTime);
            const end = new Date(fs.endTime);
            return currentTime >= start && currentTime <= end;
          });

          if (activeFses.length === 0) return null;

          return (
            <div className="space-y-4 mb-8">
              {activeFses.map(fs => {
                const end = new Date(fs.endTime);
                const diffMs = end.getTime() - currentTime.getTime();
                let countdownText = '00:00:00';
                if (diffMs > 0) {
                  const secs = Math.floor((diffMs / 1000) % 60);
                  const mins = Math.floor((diffMs / (1000 * 60)) % 60);
                  const hrs = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
                  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                  const totalHrs = hrs + (days * 24);
                  countdownText = `${String(totalHrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                }

                return (
                  <div
                    key={fs.id}
                    className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-3xl p-5 shadow-sm relative overflow-hidden"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-rose-200 dark:border-rose-900/40">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl animate-bounce">⚡</span>
                        <div>
                          <h4 className="font-black text-xs uppercase tracking-wider text-rose-600 dark:text-rose-400">Flash Sale Sedang Berlangsung</h4>
                          <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200">{fs.name}</p>
                        </div>
                      </div>
                      <div className="bg-rose-600 text-white font-mono px-3 py-1.5 rounded-2xl text-xs font-black shadow-md shadow-rose-600/20">
                        Selesai: {countdownText}
                      </div>
                    </div>

                    {fs.products && fs.products.length > 0 && (
                      <div className="pt-4">
                        <p className="text-[10px] font-black uppercase text-rose-600/70 dark:text-rose-400/70 mb-3 tracking-widest">Produk Flash Sale:</p>
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                          {fs.products.map((fsProd: any) => {
                            const prod = products.find(p => p.id === fsProd.productId);
                            if (!prod) return null;

                            const sold = fsProd.soldCount || 0;
                            const stock = fsProd.flashStock || 0;
                            const pct = stock > 0 ? Math.min(100, (sold / stock) * 100) : 0;
                            const isSoldOut = sold >= stock;

                            return (
                              <button
                                key={fsProd.productId}
                                onClick={() => router.push(`/marketplace/${prod.id}`)}
                                className="flex-shrink-0 bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900/40 hover:border-rose-300 dark:hover:border-rose-700 rounded-2xl p-3 w-44 text-left transition-all hover:scale-95 active:scale-90 relative overflow-hidden shadow-sm"
                              >
                                <h5 className="font-extrabold text-xs truncate text-slate-800 dark:text-slate-200 leading-snug">{prod.name}</h5>
                                <div className="flex items-baseline gap-1.5 mt-1.5">
                                  <span className="text-xs font-black text-rose-600 dark:text-rose-400">Rp {fsProd.flashPrice?.toLocaleString('id-ID')}</span>
                                  <span className="text-[10px] line-through text-slate-400">Rp {prod.price?.toLocaleString('id-ID')}</span>
                                </div>
                                <div className="mt-2.5">
                                  <div className="flex justify-between items-center text-[8px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                                    <span>Terjual {sold}/{stock}</span>
                                    <span>{Math.round(pct)}%</span>
                                  </div>
                                  <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-rose-600 rounded-full"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                                {isSoldOut && (
                                  <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 flex items-center justify-center">
                                    <span className="bg-rose-600 text-white text-[8px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider shadow-sm">Habis</span>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Loading Indicator */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="animate-spin text-emerald-500" size={32} />
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest animate-pulse">Memuat Produk...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-900/35 border border-slate-200 dark:border-slate-800/60 rounded-3xl p-8 shadow-sm">
            <AlertCircle className="text-slate-400 dark:text-slate-500 mb-3" size={40} />
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Tidak ada produk ditemukan</h3>
            <p className="text-xs text-slate-450 dark:text-slate-500 mt-1 max-w-sm">Coba sesuaikan kata kunci pencarian Anda atau pilih kategori lain.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {filteredProducts.map((prod) => {
              const storeLogo = storeLogos[prod.storeId];
              return (
                <div 
                  key={prod.id} 
                  onClick={() => {
                    // Navigate to the dynamic detail page
                    router.push(`/marketplace/${prod.id}`);
                  }}
                  className="group bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden flex flex-col hover:border-emerald-500/30 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/5 hover:-translate-y-1 cursor-pointer shadow-sm"
                >
                  {/* Image */}
                  <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800/60 overflow-hidden flex items-center justify-center">
                    {prod.manageStock !== false && (prod.stock || 0) <= 0 && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center z-10 p-1 text-center">
                        <span className="text-[8px] sm:text-[9px] font-black text-white uppercase tracking-widest bg-rose-600 px-1.5 sm:text-px-2 py-0.5 rounded shadow-lg shadow-rose-600/20 animate-pulse">Terjual</span>
                        <span className="text-[7px] sm:text-[8px] font-bold text-slate-300 mt-0.5 uppercase leading-none">Stok Kosong</span>
                      </div>
                    )}
                    {getEffectivePrice(prod).isFlashSale && (
                      <span className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded bg-rose-600 text-white text-[7px] sm:text-[8px] font-black uppercase tracking-widest shadow-lg shadow-rose-600/30 animate-pulse">
                        <Zap size={8} className="fill-white" /> Flash
                      </span>
                    )}
                    {prod.imageUrl ? (
                      <img 
                        src={prod.imageUrl} 
                        alt={prod.name} 
                        className="object-cover w-full h-full group-hover:scale-105 transition-all duration-500"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-slate-350 dark:text-slate-700">
                        <ShoppingBag size={24} className="sm:w-8 sm:h-8" />
                        <span className="text-[8px] font-black uppercase tracking-wider mt-1">NO IMAGE</span>
                      </div>
                    )}
                    {prod.category && (
                      <span className="absolute top-2 left-2 sm:top-3 sm:left-3 px-1.5 sm:px-2 py-0.5 rounded bg-white/90 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[7px] sm:text-[8px] font-black uppercase tracking-widest backdrop-blur-sm shadow-sm">
                        {prod.category}
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-2.5 sm:p-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-1">
                      {/* Store Details with Icon */}
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStoreClick(prod.storeId, prod.storeName || 'Toko Mitra');
                        }}
                        className="flex items-center gap-1 text-[8px] sm:text-[9px] text-emerald-600 dark:text-emerald-450 font-bold uppercase tracking-wider hover:text-emerald-500 transition-colors"
                      >
                        <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full overflow-hidden bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center border border-emerald-250 dark:border-emerald-900 shrink-0">
                          {storeLogo ? (
                            <img src={storeLogo} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Store size={6} className="sm:w-2 sm:h-2" />
                          )}
                        </div>
                        <span className="truncate">{prod.storeName || 'Toko Mitra'}</span>
                      </div>
                      {/* Product Name */}
                      <h3 className="font-bold text-slate-800 dark:text-white text-xs sm:text-sm line-clamp-2 leading-snug group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {prod.name}
                      </h3>
                      {/* Description */}
                      {prod.description && (
                        <p className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 line-clamp-1 sm:line-clamp-2 leading-relaxed pt-0.5 hidden xs:block">
                          {prod.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 sm:pt-4 flex flex-col xs:flex-row xs:items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/50 mt-2.5 sm:mt-4">
                      {(() => {
                        const ep = getEffectivePrice(prod);
                        return (
                          <div className="space-y-0.5">
                            <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Harga</span>
                            {ep.isFlashSale ? (
                              <div className="flex flex-wrap items-baseline gap-1">
                                <span className="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-400">
                                  Rp {ep.price.toLocaleString('id-ID')}
                                </span>
                                <span className="text-[8px] sm:text-[10px] line-through text-slate-400">
                                  Rp {ep.originalPrice.toLocaleString('id-ID')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-white">
                                Rp {ep.price.toLocaleString('id-ID')}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWhatsAppRedirect(prod);
                        }}
                        className="w-full xs:w-auto px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-emerald-500 hover:bg-emerald-450 text-slate-950 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black flex items-center justify-center gap-1 active:scale-95 transition-all shadow-md shadow-emerald-500/10"
                      >
                        <MessageSquare size={11} className="stroke-[2.5] sm:w-[13px] sm:h-[13px]" />
                        <span>Chat</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="py-6 border-t border-slate-200 dark:border-slate-900 text-center bg-white dark:bg-slate-950">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">
          &copy; {new Date().getFullYear()} iKasir Pro. Seluruh hak cipta dilindungi.
        </p>
      </footer>
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4">
        <RefreshCw className="animate-spin text-emerald-500" size={32} />
        <p className="text-slate-400 text-xs font-black uppercase tracking-widest animate-pulse">Memuat Marketplace...</p>
      </div>
    }>
      <MarketplaceContent />
    </Suspense>
  );
}
