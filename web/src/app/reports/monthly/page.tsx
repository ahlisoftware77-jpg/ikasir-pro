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

  const [periodType, setPeriodType] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [selectedYear, setSelectedYear] = useState<string>('Semua');

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

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    data.forEach(trx => {
      if (!trx.timestamp) return;
      const date = trx.timestamp.toDate ? trx.timestamp.toDate() : new Date(trx.timestamp);
      years.add(String(date.getFullYear()));
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [data]);

  const filteredData = useMemo(() => {
    let filtered = data.filter(t => t.paymentStatus === 'paid' && t.timestamp);
    if (periodType === 'monthly' && selectedYear !== 'Semua') {
      filtered = filtered.filter(trx => {
        const date = trx.timestamp.toDate ? trx.timestamp.toDate() : new Date(trx.timestamp);
        return String(date.getFullYear()) === selectedYear;
      });
    }
    return filtered;
  }, [data, periodType, selectedYear]);

  const stats = useMemo(() => {
    if (periodType === 'weekly') {
      const now = new Date();
      const weeksData = [
        { name: 'Minggu 4 (Terkini)', total: 0, count: 0, rangeStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), sortKey: '3' },
        { name: 'Minggu 3', total: 0, count: 0, rangeStart: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), rangeEnd: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), sortKey: '2' },
        { name: 'Minggu 2', total: 0, count: 0, rangeStart: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000), rangeEnd: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), sortKey: '1' },
        { name: 'Minggu 1', total: 0, count: 0, rangeStart: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000), rangeEnd: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000), sortKey: '0' },
      ];

      filteredData.forEach(t => {
        const date = t.timestamp.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
        for (const wk of weeksData) {
          if (date >= wk.rangeStart && (!wk.rangeEnd || date < wk.rangeEnd)) {
            wk.total += (t.total || 0);
            wk.count += 1;
            break;
          }
        }
      });

      return weeksData.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    }

    const res: Record<string, { total: number; count: number; name: string; sortKey: string }> = {};
    
    filteredData.forEach(trx => {
      if (!trx.timestamp) return;
      const date = trx.timestamp.toDate ? trx.timestamp.toDate() : new Date(trx.timestamp);
      
      if (periodType === 'monthly') {
        const monthYear = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!res[sortKey]) {
          res[sortKey] = { total: 0, count: 0, name: monthYear, sortKey };
        }
        res[sortKey].total += (trx.total || 0);
        res[sortKey].count += 1;
      } else {
        // Yearly
        const year = String(date.getFullYear());
        const sortKey = year;
        
        if (!res[sortKey]) {
          res[sortKey] = { total: 0, count: 0, name: `Tahun ${year}`, sortKey };
        }
        res[sortKey].total += (trx.total || 0);
        res[sortKey].count += 1;
      }
    });

    return Object.values(res).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [filteredData, periodType]);

  const maxTotal = stats.length > 0 ? Math.max(...stats.map(s => s.total)) : 0;

  const handleExport = () => {
    const formattedData = stats.map(stat => ({
      [periodType === 'weekly' ? 'Minggu' : periodType === 'monthly' ? 'Bulan' : 'Tahun']: stat.name,
      'Total Transaksi': stat.count,
      'Omzet (Rp)': stat.total,
    }));
    exportToExcel(
      formattedData, 
      periodType === 'weekly' ? 'Laporan_Omzet_Mingguan' : periodType === 'monthly' ? 'Laporan_Omzet_Bulanan' : 'Laporan_Omzet_Tahunan'
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
            Omzet per {periodType === 'weekly' ? 'Minggu' : periodType === 'monthly' ? 'Bulan' : 'Tahun'}
          </h1>
          <p className="text-sm text-app-text-muted mt-1 font-medium">
            Laporan akumulasi pendapatan {periodType === 'weekly' ? 'mingguan' : periodType === 'monthly' ? 'bulanan' : 'tahunan'}
          </p>
        </div>
        <button 
          onClick={handleExport}
          disabled={stats.length === 0}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-2xl font-black shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 text-sm"
        >
          <Download size={18} /> Export .xlsx
        </button>
      </div>

      {/* Filter Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface border border-app-border p-4 rounded-3xl shadow-sm">
        <div className="flex gap-2 p-1 bg-background border border-app-border rounded-2xl">
          <button
            onClick={() => setPeriodType('weekly')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
              periodType === 'weekly'
                ? 'bg-accent text-white shadow-lg shadow-accent/20'
                : 'text-app-text-muted hover:text-foreground'
            }`}
          >
            Mingguan
          </button>
          <button
            onClick={() => setPeriodType('monthly')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
              periodType === 'monthly'
                ? 'bg-accent text-white shadow-lg shadow-accent/20'
                : 'text-app-text-muted hover:text-foreground'
            }`}
          >
            Bulanan
          </button>
          <button
            onClick={() => setPeriodType('yearly')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
              periodType === 'yearly'
                ? 'bg-accent text-white shadow-lg shadow-accent/20'
                : 'text-app-text-muted hover:text-foreground'
            }`}
          >
            Tahunan
          </button>
        </div>

        {periodType === 'monthly' && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-app-text-muted">Tahun:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-background border border-app-border rounded-2xl px-4 py-2.5 text-xs font-black text-foreground focus:outline-none focus:border-accent"
            >
              <option value="Semua">Semua</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="bg-surface border border-app-border rounded-3xl overflow-hidden shadow-sm p-6">
        <h3 className="text-sm font-bold text-foreground mb-6 flex items-center gap-2">
           <BarChart className="text-accent" size={18} />
           Grafik Omzet
        </h3>
        
        {isLoading ? (
          <div className="py-20 text-center"><Loader2 className="animate-spin w-8 h-8 mx-auto text-accent mb-2" /></div>
        ) : stats.length === 0 ? (
          <div className="py-20 text-center text-app-text-muted italic opacity-50">Belum ada data omzet tersedia</div>
        ) : (
          <div className="space-y-6">
            {stats.map((stat, index) => {
              const percentage = maxTotal > 0 ? (stat.total / maxTotal) * 100 : 0;
              const isActive = index === 0;
              return (
                <div key={stat.sortKey || index} className="group">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                       <span className={`font-bold ${isActive ? 'text-foreground' : 'text-app-text-muted'}`}>{stat.name}</span>
                       <span className="text-[10px] text-app-text-muted ml-2">{stat.count} Transaksi</span>
                    </div>
                    <span className="font-black text-emerald-400">Rp {stat.total.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="h-4 bg-background border border-app-border rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${isActive ? 'bg-accent' : 'bg-accent/40'}`}
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
