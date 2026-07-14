'use client';

import React, { useState, useEffect } from 'react';
import { useCart, CartItem } from '@/context/CartContext';
import { X, ShoppingBag, Plus, Minus, Trash2, MessageSquare, Loader2, CheckCircle2, Truck, Building, CreditCard, QrCode, Coins, Upload, Camera, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auth, db, primaryDb, getTenantDb } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, runTransaction, serverTimestamp, collection } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { getInfraConfig } from '@/lib/infraConfig';

export default function CartDrawer() {
  const { items, isCartOpen, setIsCartOpen, removeFromCart, updateQty, clearStoreItems, clearCart } = useCart();
  const router = useRouter();

  const [buyerInfo, setBuyerInfo] = useState({ name: '', phone: '', address: '' });
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Advanced Checkout Options
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup'>('delivery');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'transfer' | 'qris'>('cod');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [storeBanks, setStoreBanks] = useState<any[]>([]);
  const [storeEwallets, setStoreEwallets] = useState<any[]>([]);
  const [selectedStoreBankId, setSelectedStoreBankId] = useState('');
  const [selectedStoreEwalletId, setSelectedStoreEwalletId] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [storeAllowPickup, setStoreAllowPickup] = useState(true);
  const [storeAllowDelivery, setStoreAllowDelivery] = useState(true);

  // Group items by store helper
  const getItemsByStore = () => {
    const itemsByStore: Record<string, CartItem[]> = {};
    items.forEach(item => {
      if (!itemsByStore[item.storeId]) {
        itemsByStore[item.storeId] = [];
      }
      itemsByStore[item.storeId].push(item);
    });
    return itemsByStore;
  };

  useEffect(() => {
    const loadStorePaymentSettings = async () => {
      const itemsByStore = getItemsByStore();
      const storeIds = Object.keys(itemsByStore);
      if (storeIds.length === 1) {
        const storeId = storeIds[0];
        try {
          const settingsSnap = await getDoc(doc(db, 'settings', `store_${storeId}`));
          if (settingsSnap.exists()) {
            const sData = settingsSnap.data();
            setStoreBanks(sData.storeBanks || []);
            setStoreEwallets(sData.storeEwallets || []);
            setStoreAllowPickup(sData.allowPickup !== false);
            setStoreAllowDelivery(sData.allowDelivery !== false);
            
            if (sData.allowPickup === false && sData.allowDelivery !== false) {
              setFulfillmentType('delivery');
            } else if (sData.allowPickup !== false && sData.allowDelivery === false) {
              setFulfillmentType('pickup');
            }

            if (sData.storeBanks && sData.storeBanks.length > 0) {
              setSelectedStoreBankId(sData.storeBanks[0].id);
            }
            if (sData.storeEwallets && sData.storeEwallets.length > 0) {
              setSelectedStoreEwalletId(sData.storeEwallets[0].id);
            }
          }
        } catch (e) {
          console.warn("Failed to load store settings in CartDrawer:", e);
        }
      } else {
        setStoreBanks([]);
        setStoreEwallets([]);
        setStoreAllowPickup(true);
        setStoreAllowDelivery(true);
      }
    };

    if (isCartOpen && items.length > 0) {
      loadStorePaymentSettings();
    }
  }, [isCartOpen, items.length]);

  useEffect(() => {
    if (buyerInfo.address) {
      setDeliveryAddress(buyerInfo.address);
    }
  }, [buyerInfo.address]);

  // Cloudinary image upload helper
  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const config = await getInfraConfig();
      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('upload_preset', config.cloudinary_upload_preset || 'kasirpos');

      const cloudName = config.cloudinary_cloud_name || 'dkcjfwbvc';
      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: uploadData
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.error?.message || 'Gagal mengunggah bukti transfer');
      }

      const uploadResult = await uploadRes.json();
      setPaymentProofUrl(uploadResult.secure_url);
      toast.success('Bukti pembayaran berhasil diunggah!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Gagal mengunggah bukti pembayaran');
    } finally {
      setIsUploading(false);
    }
  };

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

    if (fulfillmentType === 'delivery' && !deliveryAddress.trim()) {
      toast.error('Alamat Pengiriman wajib diisi');
      return;
    }

    if ((paymentMethod === 'transfer' || paymentMethod === 'qris') && !paymentProofUrl) {
      toast.error('Silakan unggah bukti transfer pembayaran terlebih dahulu');
      return;
    }

    setIsCheckingOut(true);
    try {
      const itemsByStore = getItemsByStore();
      // Create a transaction for each store sequentially to avoid counter collision
      for (const [storeId, storeItems] of Object.entries(itemsByStore)) {
        let tDb = db;
        try {
          const sRefPrimary = doc(primaryDb, 'stores', storeId);
          const sSnapPrimary = await getDoc(sRefPrimary);
          if (sSnapPrimary.exists()) {
            const cfg = sSnapPrimary.data().infraConfig;
            tDb = cfg ? getTenantDb(cfg) : primaryDb;
          }
        } catch (e) {
          console.warn("Failed to fetch tenant config", e);
        }

        const result = await runTransaction(tDb, async (transaction) => {
          const settingsRef = doc(tDb, 'settings', `store_${storeId}`);
          const settingsSnap = await transaction.get(settingsRef);
          
          const productReads = [];
          for (const item of storeItems) {
            const pRef = doc(tDb, 'products', item.productId);
            const pSnap = await transaction.get(pRef);
            productReads.push({ ref: pRef, snap: pSnap, item });
          }
          
          let currentCounter = 0;
          let prefix = 'TRX';
          let padding = 4;
          
          if (settingsSnap.exists()) {
            const data = settingsSnap.data();
            currentCounter = Number(data.trxCounter) || 0;
            prefix = data.trxPrefix || 'TRX';
            padding = data.trxPadding || 4;
          }
          
          currentCounter += 1;
          const finalId = `${prefix}${String(currentCounter).padStart(padding, '0')}`;
          
          const storeTotal = storeItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
          
          let activeBank = null;
          let activeEwallet = null;
          if (settingsSnap.exists()) {
            const data = settingsSnap.data();
            const banks = data.storeBanks || [];
            const ewallets = data.storeEwallets || [];
            activeBank = banks.find((b: any) => b.id === selectedStoreBankId) || banks[0] || null;
            activeEwallet = ewallets.find((ew: any) => ew.id === selectedStoreEwalletId) || ewallets[0] || null;
          }

          const orderData = {
            id: finalId,
            queueNumber: currentCounter,
            storeId,
            storeName: storeItems[0]?.storeName || '',
            customerName: buyerInfo.name,
            customerPhone: buyerInfo.phone,
            deliveryAddress: fulfillmentType === 'delivery' ? deliveryAddress.trim() : '',
            items: storeItems.map(item => ({
              productId: item.productId,
              name: item.productName,
              qty: item.qty,
              price: item.price,
              capitalPrice: 0,
              subtotal: item.price * item.qty,
              imageUrl: item.imageUrl || '',
              storeName: item.storeName || '',
              selectedExtras: item.extras || []
            })),
            subtotal: storeTotal,
            taxAmount: 0,
            discountAmount: 0,
            total: storeTotal,
            status: 'pending',
            orderStatus: 'new',
            paymentMethod: paymentMethod,
            selectedPaymentDetails: paymentMethod === 'transfer' 
              ? activeBank
              : paymentMethod === 'qris' 
                ? activeEwallet
                : null,
            paymentProofUrl: (paymentMethod === 'transfer' || paymentMethod === 'qris') ? paymentProofUrl : '',
            paymentStatus: paymentMethod === 'cod' ? 'pending' : (paymentProofUrl ? 'pending' : 'unpaid'),
            paymentCategory: 'order',
            deliveryType: fulfillmentType,
            orderType: 'online',
            cashierName: 'Online (Sistem)',
            cashierId: 'online',
            paidAmount: 0,
            debtAmount: storeTotal,
            timestamp: serverTimestamp(),
            createdAt: new Date().toISOString(),
            userId: auth.currentUser?.uid || localStorage.getItem('guest_id') || ''
          };
          
          for (const { ref, snap, item } of productReads) {
            if (snap.exists()) {
              const pData = snap.data();
              const currentSold = pData.soldCount || 0;
              const updateFields: any = { soldCount: currentSold + item.qty };

              if (pData.manageStock !== false) {
                const currentStock = pData.stock || 0;
                if (currentStock < item.qty) {
                  throw new Error(`Stok produk ${item.productName} tidak mencukupi.`);
                }
                updateFields.stock = currentStock - item.qty;
              }
              transaction.update(ref, updateFields);
            }
          }

          const newOrderRef = doc(tDb, 'transactions', finalId);
          transaction.set(newOrderRef, orderData);
          transaction.set(settingsRef, { trxCounter: currentCounter }, { merge: true });
          
          return { finalId, storeTotal };
        });

        // Trigger FCM Push Notification
        fetch('/api/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeId: storeId,
            title: '🛍️ PESANAN MARKETPLACE BARU!',
            message: `Ada pesanan dari Marketplace senilai Rp ${result.storeTotal.toLocaleString('id-ID')}.`,
            data: { transactionId: result.finalId }
          })
        }).catch(e => console.error('Failed to trigger notification', e));
      }


      
      clearCart();
      setIsCartOpen(false);
      toast.success('Pesanan berhasil dibuat!');
      router.push('/marketplace/orders');

    } catch (error: any) {
      console.error('Error during checkout:', error);
      toast.error(error.message || 'Gagal memproses pesanan. Silakan coba lagi.');
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
              {/* PENGIRIMAN & PEMBAYARAN */}
              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-5 shadow-sm">
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-3">Metode Pengiriman</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {storeAllowDelivery && (
                      <button
                        type="button"
                        onClick={() => setFulfillmentType('delivery')}
                        className={`py-3 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                          fulfillmentType === 'delivery'
                            ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                            : 'border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900/50 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <Truck size={16} />
                        <span>Kirim Kurir</span>
                      </button>
                    )}
                    {storeAllowPickup && (
                      <button
                        type="button"
                        onClick={() => setFulfillmentType('pickup')}
                        className={`py-3 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                          fulfillmentType === 'pickup'
                            ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                            : 'border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900/50 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <Building size={16} />
                        <span>Ambil Sendiri</span>
                      </button>
                    )}
                  </div>
                </div>

                {fulfillmentType === 'delivery' && (
                  <div className="space-y-1.5 animate-fadeIn">
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Alamat Pengiriman Lengkap</label>
                    <textarea
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Masukkan alamat pengiriman lengkap Anda..."
                      className="w-full p-3 bg-slate-50 dark:bg-slate-905 border border-slate-205 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 min-h-[80px] resize-y"
                    />
                  </div>
                )}

                <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-3">Metode Pembayaran</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cod')}
                      className={`py-3 px-2 rounded-xl border font-bold text-[10px] sm:text-xs flex flex-col items-center justify-center gap-1.5 transition-all ${
                        paymentMethod === 'cod'
                          ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                          : 'border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900/50 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Coins size={16} />
                      <span>COD</span>
                    </button>
                    {(storeBanks.length > 0 || Object.keys(getItemsByStore()).length > 1) && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('transfer')}
                        className={`py-3 px-2 rounded-xl border font-bold text-[10px] sm:text-xs flex flex-col items-center justify-center gap-1.5 transition-all ${
                          paymentMethod === 'transfer'
                            ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                            : 'border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900/50 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <CreditCard size={16} />
                        <span>Transfer</span>
                      </button>
                    )}
                    {(storeEwallets.length > 0 || Object.keys(getItemsByStore()).length > 1) && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('qris')}
                        className={`py-3 px-2 rounded-xl border font-bold text-[10px] sm:text-xs flex flex-col items-center justify-center gap-1.5 transition-all ${
                          paymentMethod === 'qris'
                            ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                            : 'border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900/50 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <QrCode size={16} />
                        <span>QRIS</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* PILIHAN REKENING & BUKTI UPLOAD */}
                {(paymentMethod === 'transfer' || paymentMethod === 'qris') && (
                  <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-4 animate-fadeIn">
                    {/* Rekening Bank Toko */}
                    {paymentMethod === 'transfer' && storeBanks.length > 0 && (
                      <div className="space-y-2">
                        <label className="block text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Rekening Tujuan</label>
                        <div className="grid grid-cols-1 gap-2">
                          {storeBanks.map((bank: any) => (
                            <button
                              key={bank.id}
                              type="button"
                              onClick={() => setSelectedStoreBankId(bank.id)}
                              className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                                selectedStoreBankId === bank.id
                                  ? 'border-emerald-500 bg-emerald-500/5 text-slate-900 dark:text-white'
                                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              <div>
                                <p className="text-xs font-black uppercase tracking-wider">{bank.bankName}</p>
                                <p className="text-[10px] font-mono mt-0.5">{bank.accountNumber}</p>
                                <p className="text-[9px] text-slate-400 mt-0.5">a.n. {bank.accountHolder}</p>
                              </div>
                              {selectedStoreBankId === bank.id && (
                                <Check size={16} className="text-emerald-500" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* QRIS Toko */}
                    {paymentMethod === 'qris' && storeEwallets.length > 0 && (
                      <div className="space-y-3">
                        <label className="block text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pilih QRIS / E-Wallet</label>
                        <select
                          value={selectedStoreEwalletId}
                          onChange={(e) => setSelectedStoreEwalletId(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                        >
                          {storeEwallets.map((ew: any) => (
                            <option key={ew.id} value={ew.id}>
                              {ew.ewalletName} - {ew.phoneNumber}
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const activeEw = storeEwallets.find((ew: any) => ew.id === selectedStoreEwalletId) || storeEwallets[0];
                          if (!activeEw) return null;
                          return (
                            <div className="w-full p-3.5 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center">
                              <p className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-350">{activeEw.ewalletName}</p>
                              {activeEw.qrCodeUrl ? (
                                <div className="mt-2 aspect-square w-36 h-36 bg-white border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden flex items-center justify-center p-1">
                                  <img src={activeEw.qrCodeUrl} alt="QRIS" className="w-full h-full object-contain" />
                                </div>
                              ) : (
                                <p className="text-[10px] text-slate-400 mt-2">Gunakan nomor e-wallet: {activeEw.phoneNumber}</p>
                              )}
                              <p className="text-[9px] text-slate-400 mt-1 font-mono">a.n. {activeEw.accountHolder}</p>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Multiple Stores warning for transfer */}
                    {Object.keys(getItemsByStore()).length > 1 && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl text-[10px] font-bold leading-normal">
                        ⚠️ Keranjang Anda memiliki barang dari beberapa toko mitra. Detail rekening bank/QRIS akan dikonfirmasi secara manual via WhatsApp setelah pesanan dibuat. Silakan unggah bukti pembayaran awal Anda jika ada.
                      </div>
                    )}

                    {/* Upload Proof */}
                    <div className="space-y-2">
                      <label className="block text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Unggah Bukti Pembayaran</label>
                      {paymentProofUrl ? (
                        <div className="relative aspect-[4/3] w-full max-w-[160px] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 flex items-center justify-center group">
                          <img src={paymentProofUrl} alt="Bukti Transfer" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setPaymentProofUrl('')}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-black uppercase tracking-wider"
                          >
                            Hapus Foto
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center aspect-[4/3] w-full max-w-[160px] border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-xl cursor-pointer bg-slate-50 dark:bg-slate-950 text-slate-400 hover:text-emerald-500 transition-all">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleUploadProof}
                            disabled={isUploading}
                            className="hidden"
                          />
                          {isUploading ? (
                            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                          ) : (
                            <>
                              <Camera className="w-6 h-6 mb-1" />
                              <span className="text-[10px] font-black uppercase tracking-wide">Pilih Foto</span>
                            </>
                          )}
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>
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
