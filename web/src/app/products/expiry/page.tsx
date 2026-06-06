'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';
import { Product } from '@/types';
import { Calendar, Loader2, AlertTriangle, CheckCircle, History, TrendingDown, Package } from 'lucide-react';

type TabType = 'expired' | 'near' | 'safe';

export default function ExpiryPage() {
  const { storeId } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('near');

  useEffect(() => {
    if (!storeId) return;

    const q = query(
      collection(db, 'products'),
      where('storeId', '==', storeId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach((doc) => {
        prods.push({ id: doc.id, ...doc.data() } as Product);
      });
      // Only products with expiry date AND stock > 0
      setProducts(prods.filter(p => p.expiryDate && (p.stock || 0) > 0));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [storeId]);

  const getDiffDays = (dateStr: string) => {
    const expiry = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const filteredProducts = products.filter(p => {
    const diffDays = getDiffDays(p.expiryDate!);
    if (activeTab === 'expired') return diffDays < 0;
    if (activeTab === 'near') return diffDays >= 0 && diffDays <= 14;
    if (activeTab === 'safe') return diffDays > 14;
    return true;
  });

  const getLoss = (p: Product) => (p.stock || 0) * (p.purchasePrice || 0);

  const stats = {
    expired: {
      count: products.filter(p => getDiffDays(p.expiryDate!) < 0).length,
      loss: products.filter(p => getDiffDays(p.expiryDate!) < 0).reduce((acc, p) => acc + getLoss(p), 0)
    },
    near: {
      count: products.filter(p => {
        const d = getDiffDays(p.expiryDate!);
        return d >= 0 && d <= 14;
      }).length,
      loss: products.filter(p => {
        const d = getDiffDays(p.expiryDate!);
        return d >= 0 && d <= 14;
      }).reduce((acc, p) => acc + getLoss(p), 0)
    },
    safe: {
      count: products.filter(p => getDiffDays(p.expiryDate!) > 14).length,
      loss: products.filter(p => getDiffDays(p.expiryDate!) > 14).reduce((acc, p) => acc + getLoss(p), 0)
    },
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight uppercase">Masa Berlaku Produk</h1>
          <p className="text-app-text-muted mt-1 font-medium text-xs md:text-sm italic">Penyusutan stok akibat kadaluwarsa per barang.</p>
        </div>
      </div>

      <div className="flex bg-surface border border-app-border p-1.5 rounded-2xl gap-1 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('expired')}
          className={`flex-1 min-w-[160px] flex flex-col items-center justify-center gap-1 px-4 py-3 rounded-xl transition-all ${activeTab === 'expired' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'text-app-text-muted hover:bg-background'}`}
        >
          <div className="flex items-center gap-2 font-black text-[10px] uppercase tracking-widest">
            <AlertTriangle size={14} />
            Sudah Kadaluwarsa ({stats.expired.count})
          </div>
          <p className="text-[10px] font-bold opacity-80">Rp {stats.expired.loss.toLocaleString('id-ID')}</p>
        </button>
        <button 
          onClick={() => setActiveTab('near')}
          className={`flex-1 min-w-[160px] flex flex-col items-center justify-center gap-1 px-4 py-3 rounded-xl transition-all ${activeTab === 'near' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-app-text-muted hover:bg-background'}`}
        >
          <div className="flex items-center gap-2 font-black text-[10px] uppercase tracking-widest">
            <History size={14} />
            Mendekati Kadaluwarsa ({stats.near.count})
          </div>
          <p className="text-[10px] font-bold opacity-80">Rp {stats.near.loss.toLocaleString('id-ID')}</p>
        </button>
        <button 
          onClick={() => setActiveTab('safe')}
          className={`flex-1 min-w-[160px] flex flex-col items-center justify-center gap-1 px-4 py-3 rounded-xl transition-all ${activeTab === 'safe' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-app-text-muted hover:bg-background'}`}
        >
          <div className="flex items-center gap-2 font-black text-[10px] uppercase tracking-widest">
            <CheckCircle size={14} />
            Layak Dijual ({stats.safe.count})
          </div>
          <p className="text-[10px] font-bold opacity-80">Rp {stats.safe.loss.toLocaleString('id-ID')}</p>
        </button>
      </div>

      <div className="bg-surface border border-app-border rounded-3xl overflow-hidden shadow-xl">
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background/30 text-app-text-muted text-[10px] uppercase font-black tracking-widest border-b border-app-border">
                <th className="p-5">Informasi Produk</th>
                <th className="p-5">Tanggal Expired</th>
                <th className="p-5">Sisa Waktu</th>
                <th className="p-5">Stok</th>
                <th className="p-5 text-right">Nilai Kerugian (Modal)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <Loader2 className="w-10 h-10 animate-spin text-accent" />
                      <p className="text-app-text-muted font-black uppercase tracking-widest text-[10px]">Memproses Database...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-app-text-muted">
                    <div className="flex flex-col items-center opacity-30">
                       <Calendar className="w-16 h-16 mb-4" />
                       <p className="text-sm font-black uppercase tracking-[0.2em]">Tidak Ada Data</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.sort((a,b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime()).map(prod => {
                  const diff = getDiffDays(prod.expiryDate!);
                  const loss = getLoss(prod);
                  
                  return (
                    <tr key={prod.id} className="hover:bg-accent/5 transition-colors group">
                      <td className="p-5">
                        <p className="font-black text-foreground text-sm tracking-tight leading-none mb-1">{prod.name}</p>
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[9px] text-accent font-mono font-bold uppercase tracking-widest">SKU: {prod.sku || 'N/A'}</p>
                           {prod.entryDate && (
                             <p className="text-[9px] text-app-text-muted font-black uppercase tracking-widest">
                               Masuk: {new Date(prod.entryDate).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: '2-digit'})}
                             </p>
                           )}
                        </div>
                      </td>
                      <td className="p-5 text-foreground font-black text-sm">
                        {new Date(prod.expiryDate!).toLocaleDateString('id-ID', {day: '2-digit', month: 'long', year: 'numeric'})}
                      </td>
                      <td className="p-5">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                          diff < 0 ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 
                          diff <= 14 ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 
                          'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                        }`}>
                          {diff < 0 ? `LEWAT ${Math.abs(diff)} HARI` : diff === 0 ? 'EXPIRED HARI INI' : `${diff} HARI LAGI`}
                        </div>
                      </td>
                      <td className="p-5 font-black text-base">{prod.stock}</td>
                      <td className="p-5 text-right">
                        <p className={`font-black text-base tracking-tight ${loss > 0 ? 'text-rose-400' : 'text-foreground opacity-30'}`}>
                          Rp {loss.toLocaleString('id-ID')}
                        </p>
                        {loss > 0 && <p className="text-[8px] font-black uppercase text-rose-500/50 tracking-widest">Potensi Rugi</p>}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-app-border">
           {isLoading ? (
             <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" /></div>
           ) : filteredProducts.length === 0 ? (
             <div className="p-10 text-center text-app-text-muted italic text-xs">Tidak ada data untuk kategori ini.</div>
           ) : (
             filteredProducts.map(prod => {
               const diff = getDiffDays(prod.expiryDate!);
               const loss = getLoss(prod);
               return (
                 <div key={prod.id} className="p-4 space-y-3">
                   <div className="flex justify-between items-start gap-3">
                     <div className="min-w-0">
                       <p className="font-black text-foreground text-sm leading-tight mb-1">{prod.name}</p>
                       <div className="flex flex-col gap-0.5">
                          <p className="text-[9px] text-accent font-mono uppercase tracking-widest font-bold">SKU: {prod.sku || 'N/A'}</p>
                          <p className="text-[9px] text-app-text-muted font-mono uppercase tracking-widest font-bold">STOK: {prod.stock} {prod.unit}</p>
                       </div>
                     </div>
                     <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                          diff < 0 ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 
                          diff <= 14 ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 
                          'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                        }`}>
                       {diff < 0 ? `Exp` : diff === 0 ? 'Exp' : `${diff} Hr`}
                     </div>
                   </div>
                   <div className="flex items-center justify-between pt-2 border-t border-app-border/30">
                     <div className="flex gap-4">
                        <div className="flex flex-col">
                           <span className="text-[8px] font-black uppercase text-app-text-muted tracking-widest mb-0.5">Exp Date</span>
                           <span className="text-[10px] font-bold text-foreground">{new Date(prod.expiryDate!).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'})}</span>
                        </div>
                        {prod.entryDate && (
                          <div className="flex flex-col">
                             <span className="text-[8px] font-black uppercase text-app-text-muted tracking-widest mb-0.5">Masuk</span>
                             <span className="text-[10px] font-bold text-foreground opacity-60">{new Date(prod.entryDate).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: '2-digit'})}</span>
                          </div>
                        )}
                     </div>
                     <div className="text-right">
                        <span className="text-[8px] font-black uppercase text-rose-500/50 tracking-widest block mb-0.5">Nilai Kerugian</span>
                        <span className="text-sm font-black text-rose-400 leading-none">Rp {loss.toLocaleString('id-ID')}</span>
                     </div>
                   </div>
                 </div>
               )
             })
           )}
        </div>
        
        {!isLoading && filteredProducts.length > 0 && (
          <div className="p-5 bg-background/50 border-t border-app-border flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
                <TrendingDown size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-app-text-muted tracking-widest">Total Kerugian</p>
                <p className="text-xl font-black text-foreground tracking-tighter">
                  Rp {filteredProducts.reduce((acc, p) => acc + getLoss(p), 0).toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
