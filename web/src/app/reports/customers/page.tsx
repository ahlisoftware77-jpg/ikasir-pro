'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';
import { Users, Loader2, Award, Download } from 'lucide-react';
import { Customer } from '@/types';
import { exportToExcel } from '@/lib/exportToExcel';

export default function CustomerReportPage() {
  const { storeId } = useAuthStore();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;

    // We could just group transactions by customer name, or load customers
    // Since we have a 'customers' collection, it's better to fetch both and merge
    const unsubTrx = onSnapshot(query(
      collection(db, 'transactions'), 
      where('storeId', '==', storeId),
      orderBy('timestamp', 'desc')
    ), snap => {
       const trxs: any[] = [];
       snap.forEach(doc => trxs.push({ id: doc.id, ...doc.data() }));
       setTransactions(trxs);
    });

    const unsubCust = onSnapshot(query(
      collection(db, 'customers'),
      where('storeId', '==', storeId)
    ), snap => {
       const custs: Customer[] = [];
       snap.forEach(doc => custs.push({ id: doc.id, ...doc.data() } as Customer));
       setCustomers(custs);
       setIsLoading(false);
    });

    return () => { unsubTrx(); unsubCust(); }
  }, [storeId]);

  const mergedStats = useMemo(() => {
    // To handle guest transactions, we track by customerName as fallback
    const stats: Record<string, { id?: string, name: string, totalOrders: number, totalSpent: number, lastOrder?: Date }> = {};
    
    // Init with registered customers
    customers.forEach(c => {
       stats[c.name.toLowerCase()] = {
          id: c.id,
          name: c.name,
          totalOrders: 0,
          totalSpent: 0
       };
    });

    // Accumulate from transactions
    transactions.forEach(trx => {
       const rawName = trx.customerName || 'Tanpa Nama';
       const key = rawName.toLowerCase();
       const trxDate = trx.timestamp?.toDate ? trx.timestamp.toDate() : new Date();

       if (!stats[key]) {
          stats[key] = { name: rawName, totalOrders: 0, totalSpent: 0 };
       }
       
       stats[key].totalOrders += 1;
       stats[key].totalSpent += (trx.total || 0);
       
       if (!stats[key].lastOrder || trxDate > stats[key].lastOrder!) {
          stats[key].lastOrder = trxDate;
       }
    });

    // Remove "Tanpa Nama" or keep it? Users usually want to see overall, but "Tanpa Nama" is not a specific customer.
    // Let's keep it but sort it properly.

    return Object.values(stats)
      .filter(s => s.totalOrders > 0 || s.id) // Only show if they made an order or are registered
      .sort((a, b) => b.totalSpent - a.totalSpent); // Sort by highest spender
  }, [transactions, customers]);

  const handleExport = () => {
    const formattedData = mergedStats.map((item, idx) => ({
      'Peringkat': idx + 1,
      'Nama Pelanggan': item.name,
      'Total Kunjungan': item.totalOrders,
      'Kunjungan Terakhir': item.lastOrder ? item.lastOrder.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-',
      'Total Nominal Belanja (Rp)': item.totalSpent,
      'Status Member': item.id ? 'Terdaftar' : 'Tamu',
    }));
    exportToExcel(formattedData, 'Laporan_Pelanggan_Loyal');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">Transaksi Pelanggan</h1>
          <p className="text-sm text-app-text-muted mt-1 font-medium">Analisis perilaku belanja dan loyalitas pelanggan</p>
        </div>
        <button 
          onClick={handleExport}
          disabled={mergedStats.length === 0}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-2xl font-black shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 text-sm"
        >
          <Download size={18} /> Export .xlsx
        </button>
      </div>

      <div className="bg-surface border border-app-border rounded-3xl overflow-hidden shadow-sm">
         <div className="p-4 md:p-6 border-b border-app-border bg-background/50 flex justify-between items-center">
            <span className="text-sm font-bold text-foreground flex items-center gap-2">
               <Users className="text-accent" size={18} /> Daftar Loyalitas Pelanggan
            </span>
         </div>

         {isLoading ? (
            <div className="p-20 text-center flex flex-col items-center gap-3">
               <Loader2 className="animate-spin text-accent w-10 h-10" />
               <p className="text-app-text-muted font-bold text-xs uppercase tracking-widest animate-pulse">Menghitung Data...</p>
            </div>
         ) : mergedStats.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center gap-3 opacity-50">
               <Users className="w-12 h-12 text-app-text-muted mb-2" />
               <p className="text-app-text-muted font-bold text-sm">Belum ada data pelanggan</p>
            </div>
         ) : (
           <>
            {/* Desktop Table View */}
            <div className="overflow-x-auto hidden md:block">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="bg-background/30 text-app-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                     <th className="p-4 w-16 text-center">Rank</th>
                     <th className="p-4">Nama Pelanggan</th>
                     <th className="p-4 text-center">Total Kunjungan</th>
                     <th className="p-4">Kunjungan Terakhir</th>
                     <th className="p-4 text-right">Total Belanja</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-app-border">
                   {mergedStats.map((stat, idx) => (
                     <tr key={idx} className="hover:bg-background/30 transition-colors group">
                       <td className="p-4 text-center">
                           {idx < 3 ? (
                              <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center font-black text-xs ${
                                 idx === 0 ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 shadow-lg shadow-yellow-500/20' : 
                                 idx === 1 ? 'bg-slate-300/20 text-slate-300 border border-slate-300/30' : 
                                 'bg-amber-700/20 text-amber-600 border border-amber-700/30'
                              }`}>
                                 {idx + 1}
                              </div>
                           ) : (
                              <span className="text-app-text-muted font-bold text-sm">#{idx + 1}</span>
                           )}
                       </td>
                       <td className="p-4 font-bold text-sm text-foreground">
                          {stat.name}
                          {stat.id && <span className="ml-2 bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded text-[9px] uppercase tracking-widest font-black">Member</span>}
                       </td>
                       <td className="p-4 text-center font-black">
                          {stat.totalOrders}x
                       </td>
                       <td className="p-4 text-xs font-bold text-app-text-muted">
                          {stat.lastOrder ? stat.lastOrder.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                       </td>
                       <td className="p-4 text-right font-black text-emerald-400">
                          Rp {stat.totalSpent.toLocaleString('id-ID')}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-app-border">
              {mergedStats.map((stat, idx) => (
                <div key={idx} className="p-4 flex gap-4 hover:bg-background/20 transition-colors items-center">
                  <div className="shrink-0">
                    {idx < 3 ? (
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shadow-lg ${
                        idx === 0 ? 'bg-yellow-500 text-white shadow-yellow-500/20' : 
                        idx === 1 ? 'bg-slate-400 text-white shadow-slate-400/20' : 
                        'bg-amber-700 text-white shadow-amber-700/20'
                      }`}>
                        {idx + 1}
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-2xl bg-background border border-app-border flex items-center justify-center text-app-text-muted font-bold text-xs uppercase tracking-tighter shadow-inner">
                        #{idx + 1}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-foreground truncate leading-tight">{stat.name}</p>
                        <p className="text-[10px] text-app-text-muted font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                          {stat.id ? <span className="text-accent">MEMBER</span> : "TAMU"}
                          <span className="w-1 h-1 bg-app-border rounded-full"></span>
                          {stat.totalOrders} KUNJUNGAN
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-emerald-400 tracking-tighter">Rp {stat.totalSpent.toLocaleString('id-ID')}</p>
                        <p className="text-[9px] text-app-text-muted font-bold uppercase mt-0.5">TERAKHIR: {stat.lastOrder ? stat.lastOrder.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
           </>
         )}
      </div>
    </div>
  );
}
