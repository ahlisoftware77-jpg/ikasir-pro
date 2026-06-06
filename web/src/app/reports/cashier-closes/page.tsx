'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';
import { Lock, Loader2, DollarSign, Wallet, Download } from 'lucide-react';
import { exportToExcel } from '@/lib/exportToExcel';

export default function CashierCloseReportPage() {
  const { storeId } = useAuthStore();
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;

    const q = query(
      collection(db, 'cashier_sessions'), 
      where('storeId', '==', storeId),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      setData(items);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [storeId]);

  const handleExport = () => {
    const formattedData = data.map(session => ({
      'Waktu Tutup': session.timestamp?.toDate ? session.timestamp.toDate().toLocaleString('id-ID') : '-',
      'Nama Kasir': session.cashierName?.split('@')[0],
      'Saldo Tercatat Sistem (Rp)': session.systemCalculatedCash,
      'Fisik Uang Aktual (Rp)': session.actualCash,
      'Selisih (Rp)': session.difference,
      'Catatan': session.note || '-',
    }));
    exportToExcel(formattedData, 'Laporan_Riwayat_Tutup_Kasir');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">Riwayat Tutup Kasir</h1>
          <p className="text-sm text-app-text-muted mt-1 font-medium">Data rekap penghitungan uang fisik vs sistem POS</p>
        </div>
        <button 
          onClick={handleExport}
          disabled={data.length === 0}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-2xl font-black shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 text-sm"
        >
          <Download size={18} /> Export .xlsx
        </button>
      </div>

      <div className="bg-surface border border-app-border rounded-3xl overflow-hidden shadow-sm">
         <div className="p-4 md:p-6 border-b border-app-border bg-background/50 flex justify-between items-center">
            <span className="text-sm font-bold text-foreground">Sesi Kasir</span>
         </div>
         
         {isLoading ? (
            <div className="p-20 text-center flex flex-col items-center gap-3">
               <Loader2 className="animate-spin text-accent w-10 h-10" />
               <p className="text-app-text-muted font-bold text-xs uppercase tracking-widest animate-pulse">Memuat Data...</p>
            </div>
         ) : data.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center gap-3 opacity-50">
               <Lock className="w-12 h-12 text-app-text-muted mb-2" />
               <p className="text-app-text-muted font-bold text-sm">Belum ada aktivitas tutup kasir</p>
            </div>
         ) : (
           <>
            {/* Desktop Table */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-background/30 text-app-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                    <th className="p-4">Waktu Tutup</th>
                    <th className="p-4">Operator Kasir</th>
                    <th className="p-4 text-right">Saldo Sistem (KAS)</th>
                    <th className="p-4 text-right">Fisik Uang (Aktual)</th>
                    <th className="p-4 text-center">Selisih</th>
                    <th className="p-4">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {data.map(session => (
                    <tr key={session.id} className="hover:bg-background/30 transition-colors">
                      <td className="p-4 text-sm font-bold">
                        {session.timestamp?.toDate ? session.timestamp.toDate().toLocaleString('id-ID') : '-'}
                      </td>
                      <td className="p-4 text-sm font-bold text-foreground">
                        <span className="bg-accent/10 text-accent px-3 py-1 rounded-full border border-accent/20 text-xs">
                          {session.cashierName?.split('@')[0]}
                        </span>
                      </td>
                      <td className="p-4 text-right font-black text-foreground">
                        Rp {session.systemCalculatedCash?.toLocaleString('id-ID')}
                      </td>
                      <td className="p-4 text-right font-black text-emerald-400">
                        Rp {session.actualCash?.toLocaleString('id-ID')}
                      </td>
                      <td className="p-4 text-center">
                        {session.difference === 0 ? (
                          <span className="text-app-text-muted font-bold text-xs uppercase bg-surface px-2 py-1 rounded">Sesuai (Balance)</span>
                        ) : session.difference > 0 ? (
                          <span className="text-emerald-400 font-bold text-xs uppercase bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">Lebih Rp {session.difference.toLocaleString('id-ID')}</span>
                        ) : (
                          <span className="text-rose-500 font-bold text-xs uppercase bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">Minus Rp {Math.abs(session.difference).toLocaleString('id-ID')}</span>
                        )}
                      </td>
                      <td className="p-4 text-xs font-medium text-app-text-muted max-w-[150px] truncate">
                        {session.note || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-app-border">
              {data.map(session => (
                <div key={session.id} className="p-4 space-y-4 hover:bg-background/20 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest leading-none">
                        {session.timestamp?.toDate ? session.timestamp.toDate().toLocaleString('id-ID') : '-'}
                      </p>
                      <h3 className="text-sm font-black text-foreground uppercase tracking-tight">
                        Kasir: <span className="text-accent">{session.cashierName?.split('@')[0]}</span>
                      </h3>
                    </div>
                    <div>
                      {session.difference === 0 ? (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-500 font-black px-2 py-1 rounded-md border border-emerald-500/20 uppercase tracking-tighter">Sesuai</span>
                      ) : session.difference > 0 ? (
                        <span className="text-[10px] bg-blue-500/10 text-blue-500 font-black px-2 py-1 rounded-md border border-blue-500/20 uppercase tracking-tighter">Surplus</span>
                      ) : (
                        <span className="text-[10px] bg-rose-500/10 text-rose-500 font-black px-2 py-1 rounded-md border border-rose-500/20 uppercase tracking-tighter">Selisih</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-background/50 p-3 rounded-2xl border border-app-border">
                      <p className="text-[8px] font-black text-app-text-muted uppercase tracking-widest mb-1">Saldo Sistem</p>
                      <p className="text-xs font-black text-foreground">Rp {session.systemCalculatedCash?.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="bg-background/50 p-3 rounded-2xl border border-app-border">
                      <p className="text-[8px] font-black text-app-text-muted uppercase tracking-widest mb-1">Uang Fisik</p>
                      <p className="text-xs font-black text-emerald-400">Rp {session.actualCash?.toLocaleString('id-ID')}</p>
                    </div>
                  </div>

                  {session.difference !== 0 && (
                    <div className={`p-3 rounded-2xl border flex items-center justify-between ${session.difference > 0 ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-500' : 'bg-rose-500/5 border-rose-500/10 text-rose-500'}`}>
                      <span className="text-[10px] font-black uppercase tracking-widest">{session.difference > 0 ? 'Kelebihan Uang' : 'Kekurangan Uang'}</span>
                      <span className="text-xs font-black">Rp {Math.abs(session.difference).toLocaleString('id-ID')}</span>
                    </div>
                  )}

                  {session.note && (
                    <div className="p-3 bg-app-border/10 rounded-xl">
                      <p className="text-[8px] font-black text-app-text-muted uppercase mb-1">Catatan:</p>
                      <p className="text-[11px] font-medium text-app-text-muted italic leading-relaxed">"{session.note}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
           </>
         )}
      </div>
    </div>
  );
}
