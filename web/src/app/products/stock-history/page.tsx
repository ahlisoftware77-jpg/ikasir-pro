'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';
import { StockMutation } from '@/types';
import { History, Loader2, ArrowDownCircle, ArrowUpCircle, RefreshCw } from 'lucide-react';

export default function StockHistoryPage() {
  const { storeId } = useAuthStore();
  const [mutations, setMutations] = useState<StockMutation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;

    // Filter by storeId
    const q = query(
      collection(db, 'stock_history'),
      where('storeId', '==', storeId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs: StockMutation[] = [];
      snapshot.forEach((doc) => {
        logs.push({ id: doc.id, ...doc.data() } as StockMutation);
      });
      // Sort manually by timestamp strictly since we don't assume Firestore Indexes exist
      logs.sort((a, b) => b.timestamp?.toMillis() - a.timestamp?.toMillis());
      setMutations(logs);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [storeId]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight uppercase">Riwayat Mutasi Stok</h1>
        <p className="text-app-text-muted mt-1 font-medium">Catatan jejak audit (Audit Trail) kapan dan siapa penjaga yang melakukan opname inventaris gudang.</p>
      </div>

      <div className="bg-surface border border-app-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background/50 text-app-text-muted text-[10px] uppercase font-black tracking-widest">
                <th className="p-4">Tanggal & Waktu</th>
                <th className="p-4">Nama Produk</th>
                <th className="p-4">Pengguna</th>
                <th className="p-4">Jenis Akuntansi</th>
                <th className="p-4">Mutasi QTY</th>
                <th className="p-4">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-app-text-muted">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Menarik catatan mutasi gudang...
                  </td>
                </tr>
              ) : mutations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-app-text-muted">
                    <History className="w-12 h-12 text-app-text-muted opacity-20 mx-auto mb-4" />
                    Belum ada riwayat aktivitas gudang tercatat.
                  </td>
                </tr>
              ) : (
                mutations.map(log => {
                  const dateObject = log.timestamp?.toDate ? log.timestamp.toDate() : new Date();
                  return (
                    <tr key={log.id} className="hover:bg-accent/5 transition-colors group">
                      <td className="p-4 text-app-text-muted text-[10px] font-bold">
                        <div className="font-black text-foreground uppercase tracking-tight">{dateObject.toLocaleDateString('id-ID', {day:'2-digit', month: 'short', year: 'numeric'})}</div>
                        <div className="mt-0.5">{dateObject.toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'})}</div>
                      </td>
                      <td className="p-4 text-foreground font-black tracking-tight group-hover:text-accent transition-colors">{log.productName}</td>
                      <td className="p-4 text-app-text-muted text-[10px] font-black">{log.userEmail}</td>
                      <td className="p-4">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                          log.type === 'masuk' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                          log.type === 'keluar' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                          'bg-accent/10 text-accent border-accent/20'
                        }`}>
                          {log.type === 'masuk' && <ArrowDownCircle size={12} />}
                          {log.type === 'keluar' && <ArrowUpCircle size={12} />}
                          {log.type === 'penyesuaian' && <RefreshCw size={12} />}
                          {log.type}
                        </div>
                      </td>
                      <td className="p-4 text-right pr-8">
                        <span className={`text-lg font-black tracking-tighter ${
                          log.type === 'masuk' ? 'text-emerald-500' : 
                          log.type === 'keluar' ? 'text-rose-500' : 
                          'text-accent'
                        }`}>
                          {log.type === 'masuk' ? '+' : log.type === 'keluar' ? '-' : '='} {log.qty}
                        </span>
                      </td>
                      <td className="p-4 text-app-text-muted text-[10px] font-black max-w-[200px] truncate italic" title={log.note}>{log.note || '-'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
