'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowLeft, Package, Clock, CheckCircle2, XCircle, Search } from 'lucide-react';

export default function MarketplaceOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneQuery, setPhoneQuery] = useState('');
  const [isSearched, setIsSearched] = useState(false);

  useEffect(() => {
    const savedPhone = localStorage.getItem('customer_phone');
    if (savedPhone) {
      setPhoneQuery(savedPhone);
      fetchOrders(savedPhone);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchOrders = async (phone: string) => {
    if (!phone) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'transactions'),
        where('customerPhone', '==', phone)
      );
      const snap = await getDocs(q);
      let list: any[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a,b) => b.createdAt - a.createdAt);
      setOrders(list);
      setIsSearched(true);
      localStorage.setItem('customer_phone', phone);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string, paymentStatus: string) => {
    if (paymentStatus === 'paid' || paymentStatus === 'completed') return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-900';
    if (status === 'cancelled') return 'text-rose-500 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-900';
    return 'text-amber-500 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-900';
  };

  const getStatusIcon = (status: string, paymentStatus: string) => {
    if (paymentStatus === 'paid' || paymentStatus === 'completed') return <CheckCircle2 size={16} />;
    if (status === 'cancelled') return <XCircle size={16} />;
    return <Clock size={16} />;
  };

  const getStatusText = (status: string, paymentStatus: string) => {
    if (paymentStatus === 'paid' || paymentStatus === 'completed') return 'Selesai / Dibayar';
    if (status === 'cancelled') return 'Dibatalkan';
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
        {!isSearched && !loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package size={48} className="text-slate-300 mb-4" />
            <h2 className="text-sm font-black uppercase mb-2">Cek Pesanan Anda</h2>
            <p className="text-xs text-slate-500 mb-6 max-w-xs">Masukkan nomor WhatsApp yang Anda gunakan saat checkout untuk melihat status pesanan.</p>
            <div className="flex w-full max-w-sm gap-2 mx-auto">
              <input 
                type="tel" 
                value={phoneQuery} 
                onChange={(e) => setPhoneQuery(e.target.value)} 
                placeholder="081234567890" 
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 text-sm font-bold focus:outline-none focus:border-emerald-500"
              />
              <button 
                onClick={() => fetchOrders(phoneQuery)}
                className="bg-emerald-500 text-white px-4 rounded-xl flex items-center justify-center hover:bg-emerald-600"
              >
                <Search size={18} />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {loading ? (
              <p className="text-center text-xs text-slate-500 py-10 font-bold animate-pulse">Memuat pesanan...</p>
            ) : orders.length === 0 ? (
              <div className="text-center py-20">
                <Package size={48} className="text-slate-300 mb-4 mx-auto" />
                <p className="text-sm font-bold text-slate-500">Belum ada pesanan untuk nomor ini.</p>
                <button onClick={() => setIsSearched(false)} className="text-emerald-500 text-xs font-black mt-4 uppercase">Cari Nomor Lain</button>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-2 px-1">
                  <span className="text-xs font-bold text-slate-500">Nomor: {phoneQuery}</span>
                  <button onClick={() => { setIsSearched(false); setOrders([]); }} className="text-[10px] text-emerald-500 font-black uppercase">Ganti Nomor</button>
                </div>
                {orders.map((order) => {
                  const statusColor = getStatusColor(order.status, order.paymentStatus);
                  const isFinished = order.paymentStatus === 'paid' || order.paymentStatus === 'completed';
                  return (
                    <div key={order.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-4 border-b border-slate-100 dark:border-slate-800/50 pb-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Order ID</p>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{order.id}</p>
                        </div>
                        <div className={lex items-center gap-1.5 px-2.5 py-1 rounded-full border }>
                          {getStatusIcon(order.status, order.paymentStatus)}
                          <span className="text-[9px] font-black uppercase tracking-widest">{getStatusText(order.status, order.paymentStatus)}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-3 mb-4">
                        {(order.items || []).map((item: any, idx: number) => (
                          <div key={idx} className="flex gap-3 items-center">
                            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0">
                              {item.imageUrl ? <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" /> : <Package className="w-full h-full p-3 text-slate-300" />}
                            </div>
                            <div className="flex-1">
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{item.productName}</h4>
                              <p className="text-[10px] text-slate-500">{item.qty} x Rp {item.price?.toLocaleString('id-ID')}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800/50">
                        <span className="text-xs text-slate-500 font-bold">Total Pembayaran</span>
                        <span className="text-sm font-black text-emerald-500">Rp {(order.totalAmount || 0).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
