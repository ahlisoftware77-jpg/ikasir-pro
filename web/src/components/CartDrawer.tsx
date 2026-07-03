'use client';

import React, { useState, useEffect } from 'react';
import { useCart, CartItem } from '@/context/CartContext';
import { X, ShoppingBag, Plus, Minus, Trash2, MessageSquare, Loader2, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function CartDrawer() {
  const { items, isCartOpen, setIsCartOpen, removeFromCart, updateQty, clearStoreItems, clearCart } = useCart();
  const router = useRouter();

  const [buyerInfo, setBuyerInfo] = useState({ name: '', phone: '', address: '' });
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setBuyerInfo({
            name: data.name || user.displayName || '',
            phone: data.phone || '',
            address: data.address || ''
          });
        }
      } else {
        setBuyerInfo({ name: '', phone: '', address: '' });
      }
    });
    return () => unsub();
  }, []);

  if (!isCartOpen) return null;

  // Group items by storeId
  const itemsByStore: Record<string, CartItem[]> = {};
  items.forEach(item => {
    if (!itemsByStore[item.storeId]) {
      itemsByStore[item.storeId] = [];
    }
    itemsByStore[item.storeId].push(item);
  });

  const grandTotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleCheckout = async () => {
    if (!buyerInfo.name || !buyerInfo.phone) {
      toast.error('Silakan lengkapi Profil (Nama & Nomor HP) terlebih dahulu');
      setIsCartOpen(false);
      router.push('/marketplace/profile');
      return;
    }

    setIsCheckingOut(true);
    try {
      // Create a transaction for each store
      const promises = Object.entries(itemsByStore).map(async ([storeId, storeItems]) => {
        const storeTotal = storeItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
        
        await addDoc(collection(db, 'transactions'), {
          storeId,
          total: storeTotal,
          paymentMethod: 'whatsapp_marketplace',
          createdAt: Date.now(),
          userId: auth.currentUser?.uid || '',
          customerPhone: buyerInfo.phone,
          customerName: buyerInfo.name,
          customerAddress: buyerInfo.address,
          items: storeItems
        });
      });

      await Promise.all(promises);
      
      clearCart();
      setIsCartOpen(false);
      toast.success('Pesanan berhasil dibuat!');
      router.push('/marketplace/orders');

    } catch (error) {
      console.error('Error during checkout:', error);
      toast.error('Gagal memproses pesanan. Silakan coba lagi.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] transition-opacity duration-300" 
        onClick={() => !isCheckingOut && setIsCartOpen(false)}
      />
      <div className="fixed inset-y-0 right-0 w-full max-w-full md:max-w-md bg-white dark:bg-slate-950 shadow-2xl z-[101] flex flex-col transform transition-transform duration-500 translate-x-0">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShoppingBag size={20} />
            </div>
            <div>
              <h2 className="font-black text-lg text-slate-900 dark:text-white leading-none">Keranjang Belanja</h2>
              <p className="text-xs font-bold text-slate-400 mt-1">{items.length} Barang</p>
            </div>
          </div>
          <button 
            onClick={() => !isCheckingOut && setIsCartOpen(false)}
            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors disabled:opacity-50"
            disabled={isCheckingOut}
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 bg-slate-50 dark:bg-slate-900/50 scrollbar-none">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-70">
              <ShoppingBag size={64} className="text-slate-300 dark:text-slate-700 mb-4" />
              <p className="text-slate-500 dark:text-slate-400 font-bold">Keranjang Anda masih kosong</p>
              <button 
                onClick={() => { setIsCartOpen(false); router.push('/marketplace'); }}
                className="mt-6 px-6 py-2.5 bg-emerald-500 text-white font-black rounded-xl text-sm hover:bg-emerald-600 transition-colors shadow-md shadow-emerald-500/20"
              >
                Mulai Belanja
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(itemsByStore).map(([storeId, storeItems]) => {
                const storeTotal = storeItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
                const storeName = storeItems[0]?.storeName || 'Toko Mitra';
                return (
                  <div key={storeId} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/20">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <h3 className="font-black text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">{storeName}</h3>
                      </div>
                      <button 
                        onClick={() => clearStoreItems(storeId)}
                        disabled={isCheckingOut}
                        className="text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase tracking-widest flex items-center gap-1 disabled:opacity-50"
                      >
                        <Trash2 size={12} /> Hapus
                      </button>
                    </div>
                    
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {storeItems.map(item => (
                        <div key={item.productId} className="p-4 flex gap-4 items-center">
                          <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-900 flex-shrink-0 border border-slate-200 dark:border-slate-800 overflow-hidden relative flex items-center justify-center">
                            {item.isFlashSale && (
                              <span className="absolute top-0 right-0 bg-rose-600 text-white text-[6px] font-black px-1 py-0.5 uppercase z-10">Flash</span>
                            )}
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                            ) : (
                              <ShoppingBag size={20} className="text-slate-400" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate pr-2">{item.productName}</h4>
                            <p className="text-emerald-600 dark:text-emerald-400 font-black text-xs sm:text-sm mt-0.5">Rp {item.price.toLocaleString('id-ID')}</p>
                            
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 w-fit">
                                <button 
                                  onClick={() => updateQty(item.productId, -1)}
                                  disabled={isCheckingOut}
                                  className="w-7 h-7 flex items-center justify-center rounded-md bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 shadow-sm disabled:opacity-50"
                                >
                                  <Minus size={14} />
                                </button>
                                <span className="w-8 text-center text-xs font-bold text-slate-700 dark:text-slate-300">
                                  {item.qty}
                                </span>
                                <button 
                                  onClick={() => updateQty(item.productId, 1)}
                                  disabled={isCheckingOut}
                                  className="w-7 h-7 flex items-center justify-center rounded-md bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 shadow-sm disabled:opacity-50"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                              <button 
                                onClick={() => removeFromCart(item.productId)}
                                disabled={isCheckingOut}
                                className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors disabled:opacity-50"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
            <div className="flex justify-between items-end mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Pembayaran</p>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{items.length} Barang</p>
              </div>
              <p className="text-2xl font-black text-emerald-500 tracking-tight">
                <span className="text-sm mr-1">Rp</span>
                {grandTotal.toLocaleString('id-ID')}
              </p>
            </div>
            
            <button
              onClick={handleCheckout}
              disabled={isCheckingOut}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-emerald-500/30 disabled:opacity-70 disabled:active:scale-100"
            >
              {isCheckingOut ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Memproses Pesanan...
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} /> Checkout Sekarang
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-slate-400 font-medium mt-3">
              Pesanan Anda akan diteruskan ke Penjual
            </p>
          </div>
        )}
      </div>
    </>
  );
}
