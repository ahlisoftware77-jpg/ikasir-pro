'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';
import { Users, Loader2, Award, Download, Edit2, Trash2, X, Check } from 'lucide-react';
import { Customer } from '@/types';
import { exportToExcel } from '@/lib/exportToExcel';
import toast from 'react-hot-toast';

export default function CustomerReportPage() {
  const { storeId } = useAuthStore();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit states
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPoints, setFormPoints] = useState('');
  const [formOrders, setFormOrders] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const handleEditClick = (stat: any) => {
     if (!stat.id) return;
     const cust = customers.find(c => c.id === stat.id);
     if (cust) {
        setEditCustomer(cust);
        setFormName(cust.name);
        setFormPhone(cust.phone || '');
        setFormPoints(cust.points?.toString() || '0');
        setFormOrders(cust.orders?.toString() || '0');
     }
  };

  const handleDeleteClick = async (stat: any) => {
     if (!stat.id) return;
     if (window.confirm(`Yakin ingin menghapus pelanggan ${stat.name}?`)) {
        try {
           await deleteDoc(doc(db, 'customers', stat.id));
           toast.success('Pelanggan berhasil dihapus');
        } catch (error) {
           console.error(error);
           toast.error('Gagal menghapus pelanggan');
        }
     }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!editCustomer?.id) return;
     setIsSaving(true);
     try {
        await updateDoc(doc(db, 'customers', editCustomer.id), {
           name: formName,
           phone: formPhone,
           points: parseInt(formPoints) || 0,
           orders: parseInt(formOrders) || 0,
        });
        toast.success('Data pelanggan diperbarui');
        setEditCustomer(null);
     } catch (error) {
        console.error(error);
        toast.error('Gagal memperbarui data');
     } finally {
        setIsSaving(false);
     }
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
                     <th className="p-4 text-center">Aksi</th>
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
                       <td className="p-4 text-center">
                          {stat.id ? (
                             <div className="flex justify-center items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEditClick(stat)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors">
                                   <Edit2 size={16} />
                                </button>
                                <button onClick={() => handleDeleteClick(stat)} className="p-2 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 rounded-lg transition-colors">
                                   <Trash2 size={16} />
                                </button>
                             </div>
                          ) : (
                             <span className="text-[10px] text-app-text-muted font-bold uppercase">-</span>
                          )}
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
                    {stat.id && (
                      <div className="flex items-center gap-2 pt-2 mt-2 border-t border-app-border">
                        <button onClick={() => handleEditClick(stat)} className="flex-1 py-1.5 flex justify-center items-center gap-2 bg-background border border-app-border rounded-lg text-[10px] font-black uppercase text-app-text-muted hover:text-foreground">
                          <Edit2 size={12} /> Edit
                        </button>
                        <button onClick={() => handleDeleteClick(stat)} className="flex-1 py-1.5 flex justify-center items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[10px] font-black uppercase text-rose-500 hover:bg-rose-500 hover:text-white transition-colors">
                          <Trash2 size={12} /> Hapus
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
           </>
         )}
      </div>

      {/* EDIT MODAL */}
      {editCustomer && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-surface border border-app-border rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
               <div className="p-6 border-b border-app-border flex items-center justify-between">
                  <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                     <Edit2 size={20} className="text-accent" />
                     Edit Pelanggan
                  </h2>
                  <button onClick={() => setEditCustomer(null)} className="text-app-text-muted hover:text-rose-500 transition-colors p-2 hover:bg-background rounded-full">
                     <X size={20} />
                  </button>
               </div>
               
               <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black uppercase tracking-widest text-app-text-muted pl-1">Nama Pelanggan</label>
                     <input 
                        required
                        value={formName}
                        onChange={e => setFormName(e.target.value)}
                        className="w-full px-4 py-3 bg-background border border-app-border rounded-xl font-bold text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
                     />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black uppercase tracking-widest text-app-text-muted pl-1">No. WhatsApp/HP</label>
                     <input 
                        required
                        type="tel"
                        value={formPhone}
                        onChange={e => setFormPhone(e.target.value)}
                        className="w-full px-4 py-3 bg-background border border-app-border rounded-xl font-bold text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
                     />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-app-text-muted pl-1">Poin</label>
                        <input 
                           type="number"
                           value={formPoints}
                           onChange={e => setFormPoints(e.target.value)}
                           className="w-full px-4 py-3 bg-background border border-app-border rounded-xl font-bold text-sm text-foreground focus:outline-none focus:border-accent transition-colors text-center"
                        />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-app-text-muted pl-1">Jml Trx</label>
                        <input 
                           type="number"
                           value={formOrders}
                           onChange={e => setFormOrders(e.target.value)}
                           className="w-full px-4 py-3 bg-background border border-app-border rounded-xl font-bold text-sm text-foreground focus:outline-none focus:border-accent transition-colors text-center"
                        />
                     </div>
                  </div>
                  
                  <div className="pt-2">
                     <button 
                        type="submit"
                        disabled={isSaving}
                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                     >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                        SIMPAN PERUBAHAN
                     </button>
                  </div>
               </form>
            </div>
         </div>
      )}

    </div>
  );
}
