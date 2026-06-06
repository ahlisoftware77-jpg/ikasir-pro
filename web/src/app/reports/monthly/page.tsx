'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';
import { BarChart, Loader2, CalendarRange, Download } from 'lucide-react';
import { exportToExcel } from '@/lib/exportToExcel';

export default function MonthlyReportPage() {
  const { storeId } = useAuthStore();
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;

    const q = query(
      collection(db, 'transactions'), 
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

  const monthlyStats = useMemo(() => {
    const stats: Record<string, { total: number; count: number; monthName: string; sortKey: string }> = {};
    
    data.forEach(trx => {
      if (!trx.timestamp) return;
      const date = trx.timestamp.toDate ? trx.timestamp.toDate() : new Date(trx.timestamp);
      
      const monthYear = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!stats[sortKey]) {
        stats[sortKey] = { total: 0, count: 0, monthName: monthYear, sortKey };
      }
      stats[sortKey].total += (trx.total || 0);
      stats[sortKey].count += 1;
    });

    return Object.values(stats).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [data]);

  const maxTotal = monthlyStats.length > 0 ? Math.max(...monthlyStats.map(s => s.total)) : 0;

  const handleExport = () => {
    const formattedData = monthlyStats.map(stat => ({
      'Bulan': stat.monthName,
      'Total Transaksi': stat.count,
      'Omzet (Rp)': stat.total,
    }));
    exportToExcel(formattedData, 'Laporan_Omzet_Bulanan');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">Omzet per Bulan</h1>
          <p className="text-sm text-app-text-muted mt-1 font-medium">Laporan akumulasi pendapatan bulanan</p>
        </div>
        <button 
          onClick={handleExport}
          disabled={monthlyStats.length === 0}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-2xl font-black shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 text-sm"
        >
          <Download size={18} /> Export .xlsx
        </button>
      </div>

      <div className="bg-surface border border-app-border rounded-3xl overflow-hidden shadow-sm p-6">
        <h3 className="text-sm font-bold text-foreground mb-6 flex items-center gap-2">
           <BarChart className="text-accent" size={18} />
           Grafik Omzet
        </h3>
        
        {isLoading ? (
          <div className="py-20 text-center"><Loader2 className="animate-spin w-8 h-8 mx-auto text-accent mb-2" /></div>
        ) : monthlyStats.length === 0 ? (
          <div className="py-20 text-center text-app-text-muted italic opacity-50">Belum ada data omzet tersedia</div>
        ) : (
          <div className="space-y-6">
            {monthlyStats.map(stat => {
              const percentage = maxTotal > 0 ? (stat.total / maxTotal) * 100 : 0;
              return (
                <div key={stat.sortKey} className="group">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                       <span className="font-bold text-foreground">{stat.monthName}</span>
                       <span className="text-[10px] text-app-text-muted ml-2">{stat.count} Transaksi</span>
                    </div>
                    <span className="font-black text-emerald-400">Rp {stat.total.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="h-4 bg-background border border-app-border rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent rounded-full transition-all duration-1000"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  );
}
