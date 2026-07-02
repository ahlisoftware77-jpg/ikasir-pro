'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Search, ShoppingBag, MessageSquare, Store, AlertCircle, RefreshCw } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
  imageUrls?: string[];
  description?: string;
  storeId: string;
  storeName?: string;
}

export default function MarketplacePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [categories, setCategories] = useState<string[]>(['Semua']);
  const [storePhones, setStorePhones] = useState<Record<string, string>>({});

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
            storeId: data.storeId || '',
            storeName: data.storeName || 'Toko Mitra',
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

        // Fetch store contacts
        const phonesMap: Record<string, string> = {};
        for (const sId of Array.from(uniqueStoreIds)) {
          const settingsSnap = await getDoc(doc(db, 'settings', `store_${sId}`));
          if (settingsSnap.exists()) {
            phonesMap[sId] = settingsSnap.data().phone || '';
          }
        }
        setStorePhones(phonesMap);
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
  }, [searchQuery, selectedCategory, products]);

  const handleWhatsAppRedirect = (product: Product) => {
    const rawPhone = storePhones[product.storeId] || '';
    // Format to international: replace starting 08... with 628...
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Banner/Header */}
      <header className="relative py-12 px-6 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border-b border-slate-800">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto flex flex-col items-center text-center relative z-10">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-[2px] mb-4">
            <ShoppingBag size={12} className="animate-pulse" /> iKasir Pro Marketplace
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-3">
            Marketplace <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Bersama</span>
          </h1>
          <p className="text-slate-400 max-w-xl text-xs md:text-sm font-medium leading-relaxed mb-8">
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
              className="w-full p-4 pl-12 pr-4 bg-slate-900/80 border border-slate-800 rounded-2xl text-white font-bold text-sm focus:outline-none focus:border-emerald-500 transition-all placeholder-slate-500 shadow-xl shadow-black/40 backdrop-blur-md"
            />
          </div>
        </div>
      </header>

      {/* Main Grid Section */}
      <main className="max-w-7xl mx-auto px-6 py-10 w-full flex-1">
        {/* Categories Bar */}
        <div className="flex gap-2 overflow-x-auto pb-6 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border shrink-0 transition-all ${
                selectedCategory === cat
                  ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-lg shadow-emerald-500/20 scale-105'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Loading Indicator */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="animate-spin text-emerald-500" size={32} />
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest animate-pulse">Memuat Produk...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-900/35 border border-slate-800/60 rounded-3xl p-8">
            <AlertCircle className="text-slate-500 mb-3" size={40} />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Tidak ada produk ditemukan</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">Coba sesuaikan kata kunci pencarian Anda atau pilih kategori lain.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((prod) => (
              <div 
                key={prod.id} 
                className="group bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col hover:border-emerald-500/30 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/5 hover:-translate-y-1"
              >
                {/* Image */}
                <div className="relative aspect-square w-full bg-slate-950 border-b border-slate-800/60 overflow-hidden flex items-center justify-center">
                  {prod.imageUrl ? (
                    <img 
                      src={prod.imageUrl} 
                      alt={prod.name} 
                      className="object-cover w-full h-full group-hover:scale-105 transition-all duration-500"
                    />
                  ) : (
                    <div className="flex flex-col items-center text-slate-700">
                      <ShoppingBag size={32} />
                      <span className="text-[9px] font-black uppercase tracking-wider mt-2">NO IMAGE</span>
                    </div>
                  )}
                  {prod.category && (
                    <span className="absolute top-3 left-3 px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-slate-400 text-[8px] font-black uppercase tracking-widest backdrop-blur-sm">
                      {prod.category}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    {/* Store Name */}
                    <div className="flex items-center gap-1 text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                      <Store size={10} />
                      <span>{prod.storeName || 'Toko Mitra'}</span>
                    </div>
                    {/* Product Name */}
                    <h3 className="font-bold text-white text-sm line-clamp-2 leading-snug group-hover:text-emerald-400 transition-colors">
                      {prod.name}
                    </h3>
                    {/* Description */}
                    {prod.description && (
                      <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed pt-1">
                        {prod.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 flex items-center justify-between gap-4 border-t border-slate-800/50 mt-4">
                    <div className="space-y-0.5">
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Harga</span>
                      <span className="text-sm font-black text-white">
                        Rp {prod.price.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <button
                      onClick={() => handleWhatsAppRedirect(prod)}
                      className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1 active:scale-95 transition-all shadow-md shadow-emerald-500/10"
                    >
                      <MessageSquare size={13} className="stroke-[2.5]" />
                      <span>Chat</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="py-6 border-t border-slate-900 text-center bg-slate-950">
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
          &copy; {new Date().getFullYear()} iKasir Pro. Seluruh hak cipta dilindungi.
        </p>
      </footer>
    </div>
  );
}
