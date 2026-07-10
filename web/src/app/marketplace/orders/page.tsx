'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db, auth, primaryDb, getTenantDb } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ArrowLeft, Package, Clock, CheckCircle2, XCircle, Search, MessageSquare } from 'lucide-react';
import ReviewModal from '@/components/ReviewModal';

export default function MarketplaceOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneQuery, setPhoneQuery] = useState('');
  const [reviewProduct, setReviewProduct] = useState<{
    productId: string;
    productName: string;
    storeId: string;
    orderId: string;
    customerName: string;
    customerPhone: string;
  } | null>(null);

  useEffect(() => {
    const savedPhone = localStorage.getItem('customer_phone') || '';
    setPhoneQuery(savedPhone);
    const savedGuestId = localStorage.getItem('guest_id') || '';
    
    const unsub = onAuthStateChanged(auth, (user) => {
      const activeUserId = user?.uid || savedGuestId;
      fetchOrders(activeUserId);
    });
    return () => unsub();
  }, []);

  const fetchOrders = async (userId: string) => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const storesQ = query(collection(primaryDb, 'stores'));
      const storesSnap = await getDocs(storesQ);
      const tenantConfigs = new Map<string, any>();
      
      storesSnap.forEach(doc => {
        const sData = doc.data();
        const cfg = sData.infraConfig || { projectId: 'kasir-3d12b' };
        const pId = cfg.projectId || cfg.fb_project_id;
        if (pId) tenantConfigs.set(pId, cfg);
      });

      const fetchedMap = new Map();
      const storeNames: Record<string, string> = {};
      const storePhones: Record<string, string> = {};

      await Promise.all(Array.from(tenantConfigs.values()).map(async (cfg) => {
        try {
          const tDb = getTenantDb(cfg);

          // Check transactions by userId
          const q1 = query(collection(tDb, 'transactions'), where('userId', '==', userId));
          const snap1 = await getDocs(q1);
          snap1.forEach(document => {
            fetchedMap.set(document.id, { id: document.id, ...document.data() });
          });

          // Check transactions by guestId
          const q2 = query(collection(tDb, 'transactions'), where('guestId', '==', userId));
          const snap2 = await getDocs(q2);
          snap2.forEach(document => {
            fetchedMap.set(document.id, { id: document.id, ...document.data() });
          });

          // Fetch store names from settings
          const settingsQ = query(collection(tDb, 'settings'));
          const settingsSnap = await getDocs(settingsQ);
          settingsSnap.forEach((sDoc) => {
            if (sDoc.id.startsWith('store_')) {
              const sId = sDoc.id.replace('store_', '');
              const sData = sDoc.data();
              if (sData.storeName) {
                storeNames[sId] = sData.storeName;
              }
              if (sData.phone) {
                storePhones[sId] = sData.phone;
              }
            }
          });
        } catch (tErr) {
          console.error(`Error fetching orders from tenant ${cfg.projectId}:`, tErr);
        }
      }));

      let list: any[] = Array.from(fetchedMap.values());
      
      for (const data of list) {
        if (data.storeId) {
          if (storeNames[data.storeId]) data.storeName = storeNames[data.storeId];
          if (storePhones[data.storeId]) data.storePhone = storePhones[data.storeId];
        }
      }
      
      list.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setOrders(list);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string, paymentStatus: string, orderStatus: string) => {
    if (paymentStatus === 'paid' || paymentStatus === 'completed' || orderStatus === 'completed') return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-900';
    if (status === 'cancelled' || orderStatus === 'cancelled') return 'text-rose-500 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-900';
    if (orderStatus === 'processing') return 'text-blue-500 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-900';
    if (orderStatus === 'ready') return 'text-teal-500 bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-900';
    return 'text-amber-500 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-900';
  };

  const getStatusIcon = (status: string, paymentStatus: string, orderStatus: string) => {
    if (paymentStatus === 'paid' || paymentStatus === 'completed' || orderStatus === 'completed') return <CheckCircle2 size={16} />;
    if (status === 'cancelled' || orderStatus === 'cancelled') return <XCircle size={16} />;
    if (orderStatus === 'processing') return <Package size={16} />;
    if (orderStatus === 'ready') return <CheckCircle2 size={16} />;
    return <Clock size={16} />;
  };

  const getStatusText = (status: string, paymentStatus: string, orderStatus: string) => {
    if (paymentStatus === 'paid' || paymentStatus === 'completed' || orderStatus === 'completed') return 'Selesai / Dibayar';
    if (status === 'cancelled' || orderStatus === 'cancelled') return 'Dibatalkan';
    if (orderStatus === 'processing') return 'Sedang Diproses';
    if (orderStatus === 'ready') return 'Siap Diambil/Kirim';
    return 'Menunggu Konfirmasi';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      <nav className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/marketplace')} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-black uppercase tracking-wider">Riwayat Pesanan</h1>
      </nav>

      <main className="max-w-2xl mx-auto w-full p-4 flex-1">
        <div className="space-y-4">
          {loading ? (
            <p className="text-center text-xs text-slate-500 py-10 font-bold animate-pulse">Memuat pesanan...</p>
          ) : orders.length === 0 ? (
            <div className="text-center py-20">
              <Package size={48} className="text-slate-300 mb-4 mx-auto" />
              <p className="text-sm font-bold text-slate-500">Belum ada pesanan.</p>
              <button onClick={() => router.push('/marketplace')} className="text-emerald-500 text-xs font-black mt-4 uppercase">Mulai Belanja</button>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-xs font-bold text-slate-500">Nomor: {phoneQuery}</span>
              </div>
                {orders.map((order) => {
                  const statusColor = getStatusColor(order.status, order.paymentStatus, order.orderStatus);
                  const isFinished = order.paymentStatus === 'paid' || order.paymentStatus === 'completed';
                  return (
                    <div key={order.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-4 border-b border-slate-100 dark:border-slate-800/50 pb-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Order ID</p>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{order.id}</p>
                          {order.storeName && (
                            <p className="text-[10px] font-bold text-slate-500 mt-1 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Toko: <span className="text-slate-700 dark:text-slate-300">{order.storeName}</span>
                            </p>
                          )}
                        </div>
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${statusColor}`}>
                          {getStatusIcon(order.status, order.paymentStatus, order.orderStatus)}
                          <span className="text-[9px] font-black uppercase tracking-widest">{getStatusText(order.status, order.paymentStatus, order.orderStatus)}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-3 mb-4">
                        {(order.items || []).map((item: any, idx: number) => (
                          <div 
                            key={idx} 
                            onClick={() => item.productId && router.push(`/marketplace/${item.productId}?s=${order.storeId}`)}
                            className={`flex gap-3 items-center ${item.productId ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 -mx-2 rounded-xl transition-colors' : ''}`}
                          >
                            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0">
                              {item.imageUrl ? <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" /> : <Package className="w-full h-full p-3 text-slate-300" />}
                            </div>
                            <div className="flex-1">
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{item.productName}</h4>
                              <p className="text-[10px] text-slate-500">{item.qty} x Rp {item.price?.toLocaleString('id-ID')}</p>
                              {item.selectedExtras && item.selectedExtras.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {item.selectedExtras.map((ext: any, eIdx: number) => (
                                    <p key={eIdx} className="text-[9px] text-slate-400 font-medium">
                                      + {ext.name || ext.optionName} <span className="opacity-70">(Rp {ext.price?.toLocaleString('id-ID')})</span>
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                            {isFinished && (
                              !item.isReviewed ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReviewProduct({
                                      productId: item.productId || item.id,
                                      productName: item.productName || item.name,
                                      storeId: order.storeId || '',
                                      orderId: order.id,
                                      customerName: order.customerName || phoneQuery,
                                      customerPhone: phoneQuery
                                    });
                                  }}
                                  className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest rounded-lg border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 transition-colors shrink-0"
                                >
                                  Beri Ulasan
                                </button>
                              ) : (
                                <span className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 text-[9px] font-black uppercase tracking-widest rounded-lg border border-slate-200 dark:border-slate-800 shrink-0 flex items-center gap-1">
                                  Telah Diulas
                                </span>
                              )
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800/50">
                        <span className="text-xs text-slate-500 font-bold">Total Pembayaran</span>
                        <span className="text-sm font-black text-emerald-500">Rp {(order.total || order.totalAmount || 0).toLocaleString('id-ID')}</span>
                      </div>

                      {/* WhatsApp Button */}
                      {!isFinished && order.status !== 'cancelled' && order.orderStatus !== 'cancelled' && (
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50">
                          <button
                            onClick={async () => {
                              let storePhone = '';
                              try {
                                if (order.storeId) {
                                  // First try stores collection in primaryDb
                                  const sRef = doc(primaryDb, 'stores', order.storeId);
                                  const sSnap = await getDoc(sRef);
                                  if (sSnap.exists() && sSnap.data().phone) {
                                    storePhone = sSnap.data().phone;
                                  } else {
                                    // Fallback to users collection
                                    let ownerId = sSnap.exists() ? sSnap.data().ownerId : order.storeId;
                                    if (!ownerId) ownerId = order.storeId;
                                    const uRef = doc(primaryDb, 'users', ownerId);
                                    const uSnap = await getDoc(uRef);
                                    if (uSnap.exists() && uSnap.data().phone) {
                                      storePhone = uSnap.data().phone;
                                    }
                                  }
                                }
                              } catch (e) {
                                console.error('Failed to fetch store settings', e);
                              }
                              
                              if (!storePhone) {
                                storePhone = order.storePhone || order.items?.[0]?.storePhone || '';
                              }

                              let formattedPhone = storePhone.replace(/[^0-9]/g, '');
                              if (formattedPhone.startsWith('0')) formattedPhone = '62' + formattedPhone.slice(1);
                              
                              if (!formattedPhone) {
                                alert('Nomor WhatsApp toko tidak tersedia');
                                return;
                              }

                              let message = `Halo, saya memesan dari Marketplace iKasir (Order ID: ${order.id}):\n\n`;
                              (order.items || []).forEach((item: any) => {
                                message += `- *${item.productName}* (${item.qty}x) = Rp ${(item.price * item.qty).toLocaleString('id-ID')}\n`;
                              });
                              message += `\n*Total: Rp ${(order.total || order.totalAmount || 0).toLocaleString('id-ID')}*`;
                              
                              if (order.customerName || order.customerPhone || order.customerAddress) {
                                message += `\n\n*Info Pengiriman:*`;
                                if (order.customerName) message += `\nNama: ${order.customerName}`;
                                if (order.customerPhone) message += `\nHP: ${order.customerPhone}`;
                                if (order.customerAddress) message += `\nAlamat: ${order.customerAddress}`;
                              }
                              
                              message += `\n\nApakah pesanan ini bisa diproses?`;

                              window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
                            }}
                            className="w-full py-2.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 font-black rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors border border-emerald-100 dark:border-emerald-500/20"
                          >
                            <MessageSquare size={14} /> Hubungi Penjual via WA
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
      </main>

      {reviewProduct && (
        <ReviewModal
          isOpen={true}
          onClose={() => setReviewProduct(null)}
          {...reviewProduct}
        />
      )}
    </div>
  );
}
