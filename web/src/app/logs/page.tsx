'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';
import { 
  ClipboardList, 
  Loader2, 
  Search, 
  User, 
  History, 
  Tag as TagIcon,
  LogIn,
  Package,
  Trash2,
  Edit2,
  FileStack,
  ShoppingBag,
  Settings,
  Users,
  Store,
  CreditCard,
  UserPlus,
  UserCog,
  UserMinus
} from 'lucide-react';

const ACTION_ICONS: Record<string, any> = {
  'LOGIN': LogIn,
  'REGISTER_STORE': Store,
  'CREATE_PRODUCT': Package,
  'UPDATE_PRODUCT': Edit2,
  'DELETE_PRODUCT': Trash2,
  'IMPORT_PRODUCT': FileStack,
  'TRANSACTION': ShoppingBag,
  'CHECKOUT': CreditCard,
  'SETTINGS_CHANGE': Settings,
  'MANAGE_USER': Users,
  'ADD_USER': UserPlus,
  'EDIT_USER': UserCog,
  'DELETE_USER': UserMinus,
};

const ACTION_COLORS: Record<string, string> = {
  'LOGIN': 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  'REGISTER_STORE': 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  'CREATE_PRODUCT': 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  'UPDATE_PRODUCT': 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  'DELETE_PRODUCT': 'text-rose-500 bg-rose-500/10 border-rose-500/20',
  'IMPORT_PRODUCT': 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  'TRANSACTION': 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  'CHECKOUT': 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  'SETTINGS_CHANGE': 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  'ADD_USER': 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  'EDIT_USER': 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  'DELETE_USER': 'text-rose-500 bg-rose-500/10 border-rose-500/20',
};

export default function LogsPage() {
  const storeId = useAuthStore(state => state.storeId);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');

  useEffect(() => {
    if (!storeId) return;

    const q = query(
      collection(db, 'activity_logs'),
      where('storeId', '==', storeId),
      orderBy('timestamp', 'desc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logData: any[] = [];
      snapshot.forEach((doc) => {
        logData.push({ id: doc.id, ...doc.data() });
      });
      setLogs(logData);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [storeId]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      log.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    return matchesSearch && matchesAction;
  });

  const getRelativeTime = (timestamp: any) => {
    if (!timestamp) return 'Baru saja';
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Baru saja';
    if (diff < 3600000) return `${Math.floor(diff/60000)}m yang lalu`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}j yang lalu`;
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-accent animate-spin" />
        <p className="text-app-text-muted font-black tracking-widest uppercase animate-pulse">Memuat Log Aktifitas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">Log Aktifitas</h1>
          <p className="text-xs md:text-sm text-app-text-muted mt-1 font-medium">Riwayat pergerakan sistem secara real-time</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
           <div className="relative group w-full sm:w-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted group-focus-within:text-accent transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Cari user atau aktivitas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 bg-surface border border-app-border rounded-xl pl-12 pr-4 py-3 text-sm font-bold focus:outline-none focus:border-accent transition-all shadow-xl shadow-black/5"
              />
           </div>
           <select 
             value={filterAction}
             onChange={(e) => setFilterAction(e.target.value)}
             className="w-full sm:w-auto bg-surface border border-app-border rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-accent shadow-xl shadow-black/5"
           >
              <option value="all">Semua Aksi</option>
              <option value="LOGIN">Login</option>
              <option value="CREATE_PRODUCT">Tambah Produk</option>
              <option value="UPDATE_PRODUCT">Edit Produk</option>
              <option value="DELETE_PRODUCT">Hapus Produk</option>
              <option value="TRANSACTION">Transaksi</option>
           </select>
        </div>
      </div>

      <div className="bg-surface border border-app-border rounded-3xl overflow-hidden shadow-xl shadow-black/5">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-background/50 text-app-text-muted text-[10px] font-black uppercase tracking-[0.2em] border-b border-app-border/30">
                <th className="px-6 py-5">Waktu</th>
                <th className="px-6 py-5">Pengguna</th>
                <th className="px-6 py-5">Aksi</th>
                <th className="px-6 py-5">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/20">
              {filteredLogs.map((log) => {
                const ActionIcon = ACTION_ICONS[log.action] || TagIcon;
                return (
                  <tr key={log.id} className="hover:bg-background/30 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-foreground">{log.timestamp?.toDate().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}</span>
                        <span className="text-[10px] text-app-text-muted font-bold truncate">{log.timestamp?.toDate().toLocaleDateString('id-ID', { dateStyle: 'medium' })}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent text-[10px] font-black">
                            {log.userName?.[0].toUpperCase()}
                         </div>
                         <div className="flex flex-col min-w-0">
                            <span className="text-xs font-black text-foreground truncate">{log.userName}</span>
                            <span className="text-[9px] text-app-text-muted font-bold truncate">{log.userEmail}</span>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border w-fit ${ACTION_COLORS[log.action] || 'text-app-text-muted bg-background border-app-border'}`}>
                        <ActionIcon size={12} />
                        <span className="text-[9px] font-black uppercase tracking-widest">{log.action.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                       <p className="text-xs font-bold text-foreground/80 leading-relaxed">{log.description}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-app-border/30">
           {filteredLogs.map((log) => {
             const ActionIcon = ACTION_ICONS[log.action] || TagIcon;
             return (
               <div key={log.id} className="p-4 space-y-3 hover:bg-background/20 transition-colors">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg border ${ACTION_COLORS[log.action] || 'text-app-text-muted bg-background border-app-border'}`}>
                           <ActionIcon size={14} />
                        </div>
                        <span className="text-[10px] font-black text-foreground uppercase tracking-widest">{log.action.replace('_', ' ')}</span>
                     </div>
                     <span className="text-[9px] font-bold text-app-text-muted flex items-center gap-1">
                        <History size={10} /> {getRelativeTime(log.timestamp)}
                     </span>
                  </div>
                  
                  <p className="text-xs font-bold text-foreground leading-relaxed pl-1">{log.description}</p>
                  
                  <div className="flex items-center justify-between pt-1 border-t border-app-border/10">
                     <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-accent/10 flex items-center justify-center text-accent text-[8px] font-black">
                           {log.userName?.[0].toUpperCase()}
                        </div>
                        <span className="text-[10px] font-bold text-app-text-muted truncate max-w-[120px]">{log.userName}</span>
                     </div>
                     <span className="text-[9px] font-mono text-app-text-muted/50">#{log.id?.substring(0,6)}</span>
                  </div>
               </div>
             );
           })}
        </div>

        {filteredLogs.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center gap-4 opacity-30">
             <ClipboardList size={64} />
             <p className="font-black uppercase tracking-[0.2em] text-sm">Tidak ada aktifitas ditemukan</p>
          </div>
        )}
      </div>
    </div>
  );
}
