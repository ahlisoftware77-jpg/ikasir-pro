'use client';

import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc,
  updateDoc,
  deleteDoc, 
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  FileText, 
  Trash2, 
  CreditCard, 
  Printer, 
  User, 
  History, 
  CheckCircle2, 
  X, 
  Loader2,
  ArrowLeft,
  Calendar,
  Globe,
  PlusCircle,
  Search,
  PenTool,
  Share2
} from 'lucide-react';
import { printReceipt } from '@/lib/printReceipt';
import { useAuthStore } from '@/store/auth';
import { useBranding } from '@/context/BrandingContext';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function EstimationsPage() {
  const router = useRouter();
  const { storeId, user, userName } = useAuthStore();
  const { branding } = useBranding();
  const [estimations, setEstimations] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'active' | 'converted'>('active');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [selectedEstimation, setSelectedEstimation] = useState<any>(null);
  
  const [storeSettings, setStoreSettings] = useState({ 
    useTax: true, 
    taxRate: 11, 
    storeName: '', 
    phone: '', 
    address: '', 
    receiptMessage: '', 
    paperSize: '58mm',
    logoUrl: '',
    showLogoOnReceipt: true,
    showReceiptAddress: true,
    showReceiptPhone: true,
    showReceiptCustomer: true,
    showReceiptCashier: true,
    showReceiptSubtotal: true
  });

  // Fetch Estimations
  useEffect(() => {
    if (!storeId) return;

    const q = query(
      collection(db, 'estimations'), 
      where('storeId', '==', storeId),
      orderBy('timestamp', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEstimations(docs);
    });

    // Fetch Settings
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', `store_${storeId}`));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStoreSettings({ 
            useTax: data.useTax !== false, 
            taxRate: data.taxRate || 0,
            storeName: data.storeName || '',
            phone: data.phone || '',
            address: data.address || '',
            receiptMessage: data.receiptMessage || '',
            paperSize: data.paperSize || '58mm',
            logoUrl: data.logoUrl || '',
            showLogoOnReceipt: data.showLogoOnReceipt !== false,
            showReceiptAddress: data.showReceiptAddress !== false,
            showReceiptPhone: data.showReceiptPhone !== false,
            showReceiptCustomer: data.showReceiptCustomer !== false,
            showReceiptCashier: data.showReceiptCashier !== false,
            showReceiptSubtotal: data.showReceiptSubtotal !== false
          });
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };
    fetchSettings();

    return () => unsubscribe();
  }, [storeId]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus estimasi ini?')) return;
    try {
      await deleteDoc(doc(db, 'estimations', id));
      toast.success('Estimasi dihapus');
    } catch (err) {
      toast.error('Gagal menghapus');
    }
  };

  const loadToPOS = (est: any) => {
    localStorage.setItem('kasir_pro_pos_load_estimate', JSON.stringify(est));
    localStorage.removeItem('kasir_pro_pos_edit_est_id'); // Ensure it's not in edit mode
    router.push('/pos');
  };

  const handleEdit = (est: any) => {
    localStorage.setItem('kasir_pro_pos_load_estimate', JSON.stringify(est));
    localStorage.setItem('kasir_pro_pos_edit_est_id', est.id);
    router.push('/pos');
  };

  const filtered = estimations.filter(e => {
    const matchesSearch = e.customerName?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = e.status === filter;
    return matchesSearch && matchesFilter;
  });

  const handleShareSignatureLink = async (type: string, id: string) => {
    try {
      const collectionName = type === 'est' ? 'estimations' : 'transactions';
      await updateDoc(doc(db, collectionName, id), {
        isSignatureLinkActive: true
      });
      
      const url = `${window.location.origin}/sign?type=${type}&id=${id}`;
      if (navigator.share) {
        await navigator.share({
          title: 'Form Tanda Tangan',
          text: 'Silakan klik link berikut untuk menandatangani dokumen Anda:',
          url: url,
        });
      } else {
        navigator.clipboard.writeText(url);
        toast.success('Link disalin ke clipboard!');
      }
    } catch (err) {
      console.error('Error sharing/activating:', err);
      toast.error('Gagal mengaktifkan link tanda tangan');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-3">
             <div className="p-2 bg-accent/20 text-accent rounded-xl">
                <FileText size={24} />
             </div>
             Estimasi Biaya
          </h1>
          <p className="text-xs text-app-text-muted mt-1 font-bold uppercase tracking-widest">
            Manajemen Penawaran Harga (Quotation)
          </p>
        </div>

        <Link 
          href="/pos"
          className="px-6 py-3 bg-accent text-foreground rounded-2xl font-black shadow-xl shadow-accent/20 flex items-center justify-center gap-2 hover:scale-[1.02] transition-all"
        >
          <PlusCircle size={18} /> BUAT ESTIMASI BARU
        </Link>
      </div>

      {/* FILTERS & SEARCH */}
      <div className="bg-surface border border-app-border rounded-3xl p-4 flex flex-col md:flex-row gap-4 shadow-sm items-center">
        <div className="flex bg-background p-1 rounded-2xl border border-app-border w-full md:w-auto">
           <button 
             onClick={() => setFilter('active')}
             className={`flex-1 md:px-6 py-2 rounded-xl text-xs font-black transition-all ${filter === 'active' ? 'bg-accent text-foreground shadow-lg shadow-accent/10' : 'text-app-text-muted hover:text-foreground'}`}
           >
             AKTIF
           </button>
           <button 
             onClick={() => setFilter('converted')}
             className={`flex-1 md:px-6 py-2 rounded-xl text-xs font-black transition-all ${filter === 'converted' ? 'bg-accent text-foreground shadow-lg shadow-accent/10' : 'text-app-text-muted hover:text-foreground'}`}
           >
             SELESAI
           </button>
        </div>

        <div className="relative flex-1 w-full md:w-auto">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
           <input 
             type="text"
             placeholder="Cari nama pelanggan..."
             value={search}
             onChange={e => setSearch(e.target.value)}
             className="w-full pl-12 pr-4 py-4 bg-background border border-app-border rounded-2xl font-bold text-xs focus:border-accent focus:outline-none transition-all"
           />
        </div>
      </div>

      {/* ESTIMATIONS LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(est => {
          const isValid = new Date(est.validUntil) > new Date();
          return (
            <div key={est.id} className="bg-surface border border-app-border rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all flex flex-col group relative overflow-hidden">
               {/* Validity Tag */}
               {!isValid && est.status === 'active' && (
                 <div className="absolute top-0 right-0 bg-rose-500 text-white text-[8px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest animate-pulse">
                    EXPIRED
                 </div>
               )}

               <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-black text-foreground truncate max-w-[150px]">{est.customerName}</h3>
                    <p className="text-[10px] text-app-text-muted font-bold flex items-center gap-1">
                      <Calendar size={10} /> {est.timestamp?.toDate ? est.timestamp.toDate().toLocaleDateString('id-ID') : 'Baru saja'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-app-text-muted font-bold uppercase tracking-widest">Total Harga</p>
                    <p className="text-lg font-black text-accent">Rp {est.total.toLocaleString('id-ID')}</p>
                  </div>
               </div>

               <div className="flex-1 space-y-2 mb-6">
                 {est.items.slice(0, 3).map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-[11px] font-medium text-app-text-muted">
                      <span>{item.qty}x {item.productName}</span>
                      <span>Rp {item.subtotal.toLocaleString('id-ID')}</span>
                    </div>
                 ))}
                 {est.items.length > 3 && (
                   <p className="text-[9px] text-app-text-muted italic">+{est.items.length - 3} item lainnya...</p>
                 )}
               </div>

               <div className="p-3 bg-background rounded-2xl border border-app-border mb-4">
                  <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-app-text-muted">
                    <span>Berlaku Hingga:</span>
                    <span className={isValid ? 'text-emerald-500' : 'text-rose-500'}>
                      {new Date(est.validUntil).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => handleEdit(est)}
                    className="col-span-2 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <FileText size={14} /> EDIT ESTIMASI
                  </button>
                  <button 
                    onClick={() => loadToPOS(est)}
                    className="col-span-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <CreditCard size={14} /> PROSES KE KASIR
                  </button>
                  <button 
                    onClick={() => window.open(`/invoice?id=${est.id}&type=estimation`, '_blank')}
                    className="py-3 bg-surface border border-app-border text-foreground rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                  >
                    <Globe size={14} /> CETAK A4
                  </button>
                  <button 
                    onClick={() => printReceipt({ ...est, isEstimation: true }, storeSettings, branding)}
                    className="py-3 bg-surface border border-app-border text-foreground rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                  >
                    <Printer size={14} /> THERMAL
                  </button>
                  <button 
                    onClick={() => est.id && handleShareSignatureLink('est', est.id)}
                    className="col-span-2 py-3 bg-accent/10 border border-accent/20 text-accent rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-accent hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <Share2 size={14} /> BAGIKAN LINK TTD
                  </button>
                  <button 
                    onClick={() => handleDelete(est.id)}
                    className="col-span-2 mt-2 py-2 text-rose-500/50 hover:text-rose-500 text-[9px] font-black uppercase tracking-[0.3em] transition-colors flex items-center justify-center gap-1"
                  >
                    <Trash2 size={12} /> HAPUS ESTIMASI
                  </button>
               </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="col-span-full py-20 bg-surface border-2 border-app-border border-dashed rounded-[3rem] text-center">
            <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center mx-auto mb-4 text-app-text-muted/30">
              <FileText size={40} />
            </div>
            <h3 className="text-lg font-black text-foreground">Tidak Ada Estimasi</h3>
            <p className="text-xs text-app-text-muted font-bold uppercase tracking-widest mt-1">
              {search ? 'Pencarian tidak ditemukan' : 'Belum ada data penawaran harga'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
