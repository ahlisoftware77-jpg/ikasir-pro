'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { ShoppingBag, MessageSquare, Store, AlertCircle, RefreshCw, ArrowLeft, Share2, ChevronLeft, ChevronRight, X, Play } from 'lucide-react';

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

interface MediaItem {
  type: 'image' | 'video';
  url: string;
}

export default function ProductDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params);
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [otherProducts, setOtherProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Store metadata mappings
  const [storePhone, setStorePhone] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeLogo, setStoreLogo] = useState('');

  // Fullscreen Media Preview Lightbox state (index based for navigation)
  const [previewIndex, setPreviewIndex] = useState<number>(-1);

  useEffect(() => {
    async function loadProductDetails() {
      if (!productId) return;
      setLoading(true);
      try {
        const productRef = doc(db, 'products', productId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
          const data = productSnap.data();
          const prodObj: Product = {
            id: productSnap.id,
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
          };
          setProduct(prodObj);

          // Fetch store details
          if (data.storeId) {
            const settingsSnap = await getDoc(doc(db, 'settings', `store_${data.storeId}`));
            if (settingsSnap.exists()) {
              setStorePhone(settingsSnap.data().phone || '');
              setStoreAddress(settingsSnap.data().address || '');
              setStoreLogo(settingsSnap.data().logoUrl || '');
            }

            // Fetch other products from same store
            const q = query(
              collection(db, 'products'), 
              where('storeId', '==', data.storeId), 
              where('joinMarketplace', '==', true)
            );
            const otherSnap = await getDocs(q);
            const list: Product[] = [];
            otherSnap.forEach((d) => {
              if (d.id !== productSnap.id) {
                const oData = d.data();
                list.push({
                  id: d.id,
                  name: oData.name || '',
                  price: oData.price || 0,
                  category: oData.category || 'Umum',
                  imageUrl: oData.imageUrl || '',
                  storeId: oData.storeId || '',
                  storeName: oData.storeName || 'Toko Mitra',
                });
              }
            });
            setOtherProducts(list.slice(0, 4));
          }
        }
      } catch (err) {
        console.error("Error loading product detail page:", err);
      } finally {
        setLoading(false);
      }
    }

    loadProductDetails();
  }, [productId]);

  const getWhatsAppLink = (prod: Product) => {
    let formattedPhone = storePhone.replace(/[^0-9]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.slice(1);
    }
    
    if (!formattedPhone) return null;

    const message = `Halo ${prod.storeName || 'Toko'}, saya tertarik dengan produk Anda di Marketplace iKasir:\n\n*${prod.name}*\nHarga: Rp ${prod.price.toLocaleString('id-ID')}\n\nApakah produk ini masih tersedia?`;
    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
  };

  const handleWhatsAppRedirect = (prod: Product) => {
    const link = getWhatsAppLink(prod);
    if (!link) {
      alert("Toko ini belum menyantumkan nomor WhatsApp yang valid di pengaturannya.");
      return;
    }
    window.open(link, '_blank');
  };

  const handleShareProduct = (prod: Product) => {
    if (navigator.share) {
      navigator.share({
        title: prod.name,
        text: `Lihat ${prod.name} dari ${prod.storeName} di iKasir Marketplace!`,
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Tautan produk berhasil disalin!");
    }
  };

  const handleStoreClick = (storeId: string, storeName: string) => {
    router.push(`/marketplace?storeId=${storeId}&storeName=${encodeURIComponent(storeName)}`);
  };

  const isVideoUrl = (url: string): boolean => {
    if (!url) return false;
    const cleanUrl = url.split('?')[0].toLowerCase();
    return (
      cleanUrl.endsWith('.mp4') ||
      cleanUrl.endsWith('.webm') ||
      cleanUrl.endsWith('.ogg') ||
      cleanUrl.endsWith('.mov') ||
      cleanUrl.endsWith('.m4v') ||
      url.includes('/video') ||
      url.includes('video') ||
      (url.includes('firebasestorage.googleapis.com') && url.toLowerCase().includes('type=video'))
    );
  };

  // Determine media gallery list (with video support)
  const getProductMediaGallery = (prod: Product): MediaItem[] => {
    const list: MediaItem[] = [];
    
    const addMedia = (url: string) => {
      if (!url) return;
      if (list.some(item => item.url === url)) return;
      
      if (isVideoUrl(url)) {
        list.push({ type: 'video', url });
      } else {
        list.push({ type: 'image', url });
      }
    };

    if (prod.videoUrl) {
      addMedia(prod.videoUrl);
    }
    if (prod.imageUrl) {
      addMedia(prod.imageUrl);
    }
    if (prod.imageUrls && prod.imageUrls.length > 0) {
      prod.imageUrls.forEach(url => addMedia(url));
    }
    
    return list.length > 0 ? list : [{ type: 'image', url: '' }];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4">
        <RefreshCw className="animate-spin text-emerald-500" size={32} />
        <p className="text-slate-400 text-xs font-black uppercase tracking-widest animate-pulse">Memuat Detail Produk...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4 text-center p-6">
        <AlertCircle className="text-slate-400" size={48} />
        <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider">Produk Tidak Ditemukan</h2>
        <button 
          onClick={() => router.push('/marketplace')}
          className="mt-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-black rounded-xl text-xs active:scale-95 transition-all shadow-md"
        >
          Kembali ke Marketplace
        </button>
      </div>
    );
  }

  const gallery = getProductMediaGallery(product);
  const waLink = getWhatsAppLink(product);
  const activeMedia = gallery[currentImageIndex];
  const previewMedia = previewIndex !== -1 ? gallery[previewIndex] : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300 pb-24 lg:pb-8">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
        <button 
          onClick={() => {
            router.push('/marketplace');
          }}
          className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft size={16} /> Kembali
        </button>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => handleShareProduct(product)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-emerald-500 transition-colors"
          >
            <Share2 size={18} />
          </button>
        </div>
      </nav>

      {/* Main Details Panel */}
      <main className="max-w-6xl mx-auto px-4 lg:px-8 py-8 w-full flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: Product Images & Video (Shopee style Media Display) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="relative aspect-square w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden flex items-center justify-center shadow-md animate-in fade-in duration-300">
              {product.manageStock !== false && (product.stock || 0) <= 0 && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center z-20 p-2 text-center">
                  <span className="text-xs font-black text-white uppercase tracking-widest bg-rose-600 px-3 py-1 rounded-md shadow-lg shadow-rose-600/30 animate-pulse">Terjual</span>
                  <span className="text-[10px] font-bold text-slate-350 mt-1 uppercase">Stok Kosong</span>
                </div>
              )}
              {activeMedia && activeMedia.url ? (
                activeMedia.type === 'video' ? (
                  <video 
                    src={activeMedia.url} 
                    controls 
                    playsInline
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img 
                    src={activeMedia.url} 
                    alt={product.name} 
                    onClick={() => setPreviewIndex(currentImageIndex)}
                    className="object-cover w-full h-full cursor-pointer hover:scale-[1.01] transition-transform duration-300"
                  />
                )
              ) : (
                <div className="text-slate-400 flex flex-col items-center">
                  <ShoppingBag size={64} />
                  <span className="text-xs font-black uppercase tracking-widest mt-4">No Media Available</span>
                </div>
              )}

              {/* Carousel Controls */}
              {gallery.length > 1 && (
                <>
                  <button 
                    onClick={() => setCurrentImageIndex(prev => (prev === 0 ? gallery.length - 1 : prev - 1))}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 flex items-center justify-center shadow-lg hover:bg-emerald-500 dark:hover:bg-emerald-500 hover:text-white transition-all z-10"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button 
                    onClick={() => setCurrentImageIndex(prev => (prev === gallery.length - 1 ? 0 : prev + 1))}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 flex items-center justify-center shadow-lg hover:bg-emerald-500 dark:hover:bg-emerald-500 hover:text-white transition-all z-10"
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {gallery.length > 1 && (
              <div className="flex gap-3 overflow-x-auto py-2">
                {gallery.map((media, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${currentImageIndex === idx ? 'border-emerald-500 scale-105 shadow-md' : 'border-slate-200 dark:border-slate-800'}`}
                  >
                    {media.type === 'video' ? (
                      <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white">
                        <Play size={20} className="fill-white" />
                        <span className="absolute bottom-1 right-1 text-[8px] bg-black/60 px-1 rounded text-slate-300 font-bold uppercase tracking-wider">VIDEO</span>
                      </div>
                    ) : (
                      <img src={media.url} alt="" className="w-full h-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Info Section */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4 shadow-sm">
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-450 text-[10px] font-black uppercase tracking-wider">
                {product.category}
              </span>
              
              <h1 className="text-xl lg:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                {product.name}
              </h1>
              
              {/* Shopee-style Price Panel */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/80 rounded-2xl border border-slate-100 dark:border-slate-800/40 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Harga Spesial</span>
                  <div className="text-2xl lg:text-4xl font-black text-orange-500 dark:text-orange-400 mt-1">
                    Rp {product.price.toLocaleString('id-ID')}
                  </div>
                </div>
                {product.manageStock !== false && (product.stock || 0) <= 0 && (
                  <span className="px-3.5 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-450 text-xs font-black uppercase tracking-wider animate-pulse">
                    Stok Habis
                  </span>
                )}
              </div>
            </div>

            {/* Description Panel */}
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-3">
              <h3 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Deskripsi Produk</h3>
              <p className="text-slate-600 dark:text-slate-350 text-xs md:text-sm leading-relaxed font-medium whitespace-pre-line">
                {product.description || 'Tidak ada deskripsi produk.'}
              </p>
            </div>

            {/* Store Panel - Wrapped at the bottom like Shopee */}
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl overflow-hidden bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm shrink-0">
                  {storeLogo ? (
                    <img src={storeLogo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Store size={22} />
                  )}
                </div>
                <div>
                  <h3 
                    onClick={() => handleStoreClick(product.storeId, product.storeName || 'Toko Mitra')}
                    className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-wider cursor-pointer hover:text-emerald-500 transition-colors flex items-center gap-1"
                  >
                    {product.storeName || 'Toko Mitra'}
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold truncate max-w-xs">{storeAddress || 'Mitra Penjual Resmi iKasir'}</p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button 
                  onClick={() => handleStoreClick(product.storeId, product.storeName || 'Toko Mitra')}
                  className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-black rounded-xl text-xs active:scale-95 transition-all border border-slate-200 dark:border-slate-700"
                >
                  Kunjungi Toko
                </button>
                {waLink && (
                  <a 
                    href={waLink} 
                    target="_blank" 
                    rel="noreferrer"
                    className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-emerald-500/10"
                  >
                    <MessageSquare size={14} className="stroke-[2.5]" /> Hubungi
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Related Products from same store */}
        {otherProducts.length > 0 && (
          <div className="mt-16 space-y-6">
            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Store size={18} className="text-emerald-500" /> Produk Lainnya Dari Toko Ini
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {otherProducts.map(prod => (
                <div 
                  key={prod.id} 
                  onClick={() => {
                    router.push(`/marketplace/${prod.id}`);
                  }}
                  className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden flex flex-col hover:border-emerald-500/30 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer shadow-sm"
                >
                  <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-950 overflow-hidden flex items-center justify-center">
                    {prod.imageUrl ? (
                      <img src={prod.imageUrl} alt="" className="object-cover w-full h-full" />
                    ) : (
                      <ShoppingBag size={24} className="text-slate-300" />
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs line-clamp-1 leading-snug">{prod.name}</h4>
                    <p className="text-orange-500 text-xs font-black">Rp {prod.price.toLocaleString('id-ID')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Floating Mobile Bottom Action Bar (Shopee Style) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between gap-4 lg:hidden">
        <div className="flex-1">
          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Harga</span>
          <span className="text-lg font-black text-orange-500 dark:text-orange-400 block leading-tight">
            Rp {product.price.toLocaleString('id-ID')}
          </span>
        </div>
        <button
          onClick={() => {
            if (product.manageStock !== false && (product.stock || 0) <= 0) return;
            handleWhatsAppRedirect(product);
          }}
          disabled={product.manageStock !== false && (product.stock || 0) <= 0}
          className={`flex-1 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-lg ${
            product.manageStock !== false && (product.stock || 0) <= 0
              ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-none'
              : 'bg-emerald-500 hover:bg-emerald-450 text-slate-950 shadow-emerald-500/20'
          }`}
        >
          {product.manageStock !== false && (product.stock || 0) <= 0 ? (
            <span>Stok Habis</span>
          ) : (
            <>
              <MessageSquare size={16} className="stroke-[2.5]" />
              <span>Chat Sekarang</span>
            </>
          )}
        </button>
      </div>

      {/* Fullscreen Media Preview Modal (Lightbox) - Bounded Size with Arrows */}
      {previewMedia && (
        <div 
          onClick={() => setPreviewIndex(-1)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200 cursor-zoom-out"
        >
          <button 
            onClick={() => setPreviewIndex(-1)}
            className="absolute top-6 right-6 text-white hover:text-emerald-450 p-2.5 transition-colors z-55 bg-slate-900/60 rounded-full"
          >
            <X size={24} />
          </button>
          
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="relative max-w-4xl max-h-[85vh] w-11/12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 flex items-center justify-center shadow-2xl overflow-hidden cursor-default"
          >
            {previewMedia.type === 'video' ? (
              <video 
                key={previewMedia.url}
                src={previewMedia.url} 
                controls 
                autoPlay
                playsInline
                className="max-w-full max-h-[75vh] object-contain rounded-2xl"
              />
            ) : (
              <img 
                src={previewMedia.url} 
                alt="" 
                className="max-w-full max-h-[75vh] object-contain rounded-2xl animate-in zoom-in-95 duration-200"
              />
            )}

            {/* Lightbox Navigation Arrows */}
            {gallery.length > 1 && (
              <>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewIndex(prev => (prev === 0 ? gallery.length - 1 : prev - 1));
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-slate-100/80 dark:bg-slate-800/80 hover:bg-emerald-500 text-slate-800 dark:text-white flex items-center justify-center shadow-lg transition-all z-10"
                >
                  <ChevronLeft size={24} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewIndex(prev => (prev === gallery.length - 1 ? 0 : prev + 1));
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-slate-100/80 dark:bg-slate-800/80 hover:bg-emerald-500 text-slate-800 dark:text-white flex items-center justify-center shadow-lg transition-all z-10"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
