'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, getDoc, deleteDoc, writeBatch, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';
import { Trash2, RotateCcw, Search, Loader2, Calendar, X, ReceiptText, AlertTriangle, ShieldCheck, ArrowUpDown, Info, Package, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RecycleBinPage() {
  const { storeId, isSubscriptionExpired } = useAuthStore();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, transactions, products
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    if (!storeId) return;

    const q = query(
      collection(db, 'recycle_bin'),
      where('storeId', '==', storeId),
      orderBy('deletedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results: any[] = [];
      snapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });
      setItems(results);
      setIsLoading(false);
    }, (error) => {
      console.error("Error subscribing to recycle_bin:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [storeId]);

  const filteredItems = items.filter(item => {
    const originalColl = item.originalCollection || '';
    const matchesSearch = item.id.toLowerCase().includes(search.toLowerCase()) || 
                          (item.customerName && item.customerName.toLowerCase().includes(search.toLowerCase())) ||
                          (item.name && item.name.toLowerCase().includes(search.toLowerCase())) ||
                          (item.cashierName && item.cashierName.toLowerCase().includes(search.toLowerCase()));
    
    if (filterType === 'all') return matchesSearch;
    return matchesSearch && originalColl === filterType;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    const timeA = new Date(a.deletedAt).getTime();
    const timeB = new Date(b.deletedAt).getTime();
    return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });

  const handleRestore = async (item: any) => {
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      const originalColl = item.originalCollection;
      
      if (!originalColl) {
        throw new Error('Koleksi asal dokumen tidak terdefinisi.');
      }

      // Copy back to original collection
      const originalRef = doc(db, originalColl, item.id);
      
      // Clean up fields added for recycle bin
      const { deletedAt, originalCollection, ...restoredData } = item;
      
      batch.set(originalRef, restoredData);

      // Delete from recycle bin
      const recycleRef = doc(db, 'recycle_bin', item.id);
      batch.delete(recycleRef);

      await batch.commit();
      toast.success('Data berhasil dipulihkan!');
      if (selectedItem?.id === item.id) {
        setSelectedItem(null);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal memulihkan data: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermanentDelete = async (itemId: string) => {
    if (!window.confirm('PERINGATAN: Apakah Anda yakin ingin menghapus data ini secara permanen? Tindakan ini TIDAK dapat dibatalkan.')) return;
    
    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, 'recycle_bin', itemId));
      toast.success('Data dihapus secara permanen');
      if (selectedItem?.id === itemId) {
        setSelectedItem(null);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal menghapus data secara permanen');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEmptyBin = async () => {
    if (items.length === 0) return;
    if (!window.confirm('PERINGATAN KRITIS: Apakah Anda yakin ingin mengosongkan Kotak Sampah? SEMUA data di dalam Kotak Sampah akan dihapus secara permanen dan tidak dapat dikembalikan.')) return;

    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      items.forEach((item) => {
        batch.delete(doc(db, 'recycle_bin', item.id));
      });
      await batch.commit();
      toast.success('Kotak sampah berhasil dikosongkan!');
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal mengosongkan kotak sampah');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(/\./g, ':');
  };

  const getCollectionLabel = (coll: string) => {
    switch (coll) {
      case 'transactions':
        return { label: 'Transaksi', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
      case 'products':
        return { label: 'Produk', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
      case 'estimations':
        return { label: 'Estimasi', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' };
      default:
        return { label: coll || 'Lainnya', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20' };
    }
  };

  const getItemDescription = (item: any) => {
    if (item.originalCollection === 'transactions') {
      return `Pelanggan: ${item.customerName || 'Umum'} • Total: Rp ${item.total?.toLocaleString('id-ID')} (${item.items?.length || 0} item)`;
    }
    if (item.originalCollection === 'products') {
      return `Harga Jual: Rp ${item.price?.toLocaleString('id-ID')} • Stok Tersisa: ${item.stock || 0}`;
    }
    if (item.originalCollection === 'estimations') {
      return `Pelanggan: ${item.customerName || 'Umum'} • Estimasi: Rp ${item.total?.toLocaleString('id-ID')}`;
    }
    return item.name || item.id;
  };

  return (
    <div className="space-y-6 relative animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">Kotak Sampah</h1>
          <p className="text-xs md:text-sm text-app-text-muted mt-1 font-medium">Data yang dihapus disimpan sementara selama 90 hari sebelum dihapus permanen otomatis</p>
        </div>
        {items.length > 0 && (
          <button 
            onClick={handleEmptyBin}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-md hover:scale-[1.02] active:scale-95 transition-all w-full md:w-auto"
          >
            <Trash2 size={16} />
            Kosongkan Kotak Sampah
          </button>
        )}
      </div>

      <div className="bg-surface border border-app-border rounded-3xl overflow-hidden shadow-xl shadow-black/5 transition-colors duration-300">
        <div className="p-4 md:p-6 border-b border-app-border flex flex-col md:flex-row gap-4 items-center justify-between bg-background/30">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
            <input 
              type="text" 
              placeholder="Cari item di kotak sampah..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent transition-all text-sm"
            />
          </div>
          
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {[
              { id: 'all', label: 'Semua Tipe' },
              { id: 'transactions', label: 'Transaksi' },
              { id: 'products', label: 'Produk' },
            ].map(type => (
              <button
                key={type.id}
                onClick={() => setFilterType(type.id)}
                className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider border transition-all ${
                  filterType === type.id
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-surface hover:bg-background border-app-border text-app-text-muted hover:text-foreground'
                }`}
              >
                {type.label}
              </button>
            ))}
            
            <button 
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="flex items-center justify-center gap-2 bg-surface hover:bg-background text-foreground px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider border border-app-border shadow-sm transition-all"
              title={sortOrder === 'desc' ? "Urutkan: Baru ke Lama" : "Urutkan: Lama ke Baru"}
            >
              <ArrowUpDown size={14} className="text-accent" />
              <span>{sortOrder === 'desc' ? 'Terbaru' : 'Terlama'}</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background/50 text-app-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="p-6">ID Item</th>
                <th className="p-6">Tipe</th>
                <th className="p-6">Tanggal Dihapus</th>
                <th className="p-6">Keterangan</th>
                <th className="p-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/30">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-app-text-muted">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-accent" />
                    <p className="font-bold animate-pulse">Menghubungkan ke server...</p>
                  </td>
                </tr>
              ) : sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-app-text-muted">
                    <Trash2 className="w-16 h-16 opacity-10 mx-auto mb-4" />
                    <p className="font-bold italic">Kotak sampah kosong</p>
                  </td>
                </tr>
              ) : (
                sortedItems.map(item => {
                  const typeInfo = getCollectionLabel(item.originalCollection);
                  return (
                    <tr key={item.id} className="hover:bg-background/30 transition-colors group">
                      <td className="p-6 text-foreground font-mono text-xs max-w-[120px] truncate" title={item.id}>
                        <span className="text-accent opacity-50 group-hover:opacity-100 transition-opacity">#</span>{item.id.substring(0, 12)}
                      </td>
                      <td className="p-6">
                        <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="p-6 text-foreground text-sm font-bold">
                        {formatDate(item.deletedAt)}
                      </td>
                      <td className="p-6 text-app-text-muted text-sm font-medium max-w-sm truncate" title={getItemDescription(item)}>
                        {getItemDescription(item)}
                      </td>
                      <td className="p-6 text-center">
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => setSelectedItem(item)}
                            className="p-3 bg-surface border border-app-border hover:border-accent hover:text-accent text-app-text-muted rounded-xl transition-all inline-flex shadow-sm active:scale-90"
                            title="Lihat Detail Data"
                          >
                            <Info size={16} />
                          </button>
                          <button 
                            onClick={() => handleRestore(item)}
                            disabled={isProcessing}
                            className="p-3 bg-surface border border-app-border hover:border-emerald-500 hover:text-emerald-500 text-app-text-muted rounded-xl transition-all inline-flex shadow-sm active:scale-90 disabled:opacity-50"
                            title="Pulihkan Data (Restore)"
                          >
                            <RotateCcw size={16} />
                          </button>
                          <button 
                            onClick={() => handlePermanentDelete(item.id)}
                            disabled={isProcessing}
                            className="p-3 bg-surface border border-app-border hover:border-rose-500 hover:text-rose-500 text-app-text-muted rounded-xl transition-all inline-flex shadow-sm active:scale-90 disabled:opacity-50"
                            title="Hapus Permanen"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL SCREEN */}
      {selectedItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-surface border border-app-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-app-border flex items-center justify-between bg-background/30">
              <h2 className="text-xl font-black text-foreground flex items-center gap-3">
                <div className="p-2 bg-rose-500/10 rounded-xl text-rose-500">
                  <Trash2 size={20} />
                </div>
                Rincian Item Sampah
              </h2>
              <button 
                onClick={() => setSelectedItem(null)}
                className="text-app-text-muted hover:text-rose-500 transition-colors p-2 hover:bg-background rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4 bg-background/50 p-4 rounded-2xl border border-app-border text-sm">
                <div>
                  <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">ID Dokumen</p>
                  <p className="text-foreground font-mono font-bold text-xs mt-1">{selectedItem.id}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Tipe Koleksi</p>
                  <p className="text-foreground font-bold mt-1 uppercase tracking-wide text-xs">{selectedItem.originalCollection}</p>
                </div>
                <div className="col-span-2 border-t border-app-border/40 pt-3 mt-1">
                  <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Tanggal Dihapus</p>
                  <p className="text-foreground font-bold mt-1 text-xs">{formatDate(selectedItem.deletedAt)}</p>
                </div>
              </div>

              {/* TRANSACTION PREVIEW TYPE */}
              {selectedItem.originalCollection === 'transactions' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-app-text-muted uppercase tracking-[0.3em] border-b border-app-border pb-2">Rincian Transaksi Penjualan</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-[10px] font-black text-app-text-muted uppercase tracking-wider">Nama Pelanggan</p>
                      <p className="text-foreground font-bold mt-1">{selectedItem.customerName || 'Umum'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-app-text-muted uppercase tracking-wider">Kasir</p>
                      <p className="text-foreground font-bold mt-1">{selectedItem.cashierName || 'Sistem'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-app-text-muted uppercase tracking-wider">Metode Pembayaran</p>
                      <p className="text-foreground font-bold mt-1 uppercase">{selectedItem.paymentMethod || selectedItem.paymentCategory || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-app-text-muted uppercase tracking-wider">Status Pembayaran</p>
                      <p className="text-foreground font-bold mt-1 uppercase text-emerald-400">{selectedItem.paymentStatus || 'paid'}</p>
                    </div>
                  </div>

                  <div className="space-y-3 bg-background/20 p-4 rounded-2xl border border-app-border/60">
                    <p className="text-[9px] font-black uppercase text-app-text-muted tracking-widest">Daftar Barang Belanja</p>
                    {selectedItem.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-xs text-foreground font-medium py-1">
                        <span className="flex-1 pr-4">{item.qty}x {item.productName}</span>
                        <span>Rp {(item.subtotal || (item.price * item.qty)).toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                    <div className="border-t border-app-border/40 pt-3 mt-3 flex justify-between items-center font-bold text-sm">
                      <span className="text-foreground">Total Transaksi</span>
                      <span className="text-emerald-400 font-black">Rp {selectedItem.total?.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* PRODUCT PREVIEW TYPE */}
              {selectedItem.originalCollection === 'products' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-app-text-muted uppercase tracking-[0.3em] border-b border-app-border pb-2">Rincian Data Produk</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-1 border-b border-app-border/30">
                      <span className="text-app-text-muted font-bold">Nama Produk</span>
                      <span className="text-foreground font-black">{selectedItem.name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-app-border/30">
                      <span className="text-app-text-muted font-bold">Harga Jual</span>
                      <span className="text-foreground font-bold">Rp {selectedItem.price?.toLocaleString('id-ID')}</span>
                    </div>
                    {selectedItem.costPrice && (
                      <div className="flex justify-between py-1 border-b border-app-border/30">
                        <span className="text-app-text-muted font-bold">Harga Modal</span>
                        <span className="text-foreground font-bold">Rp {selectedItem.costPrice?.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 border-b border-app-border/30">
                      <span className="text-app-text-muted font-bold">Stok Produk</span>
                      <span className="text-foreground font-bold">{selectedItem.stock || 0}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-app-border/30">
                      <span className="text-app-text-muted font-bold">Kode SKU / Barcode</span>
                      <span className="text-foreground font-mono">{selectedItem.sku || '-'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-app-text-muted font-bold">Kategori</span>
                      <span className="text-foreground font-bold">{selectedItem.categoryName || selectedItem.category || '-'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ESTIMATIONS PREVIEW TYPE */}
              {selectedItem.originalCollection === 'estimations' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-app-text-muted uppercase tracking-[0.3em] border-b border-app-border pb-2">Rincian Estimasi Biaya</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs mb-4">
                    <div>
                      <p className="text-[10px] font-black text-app-text-muted uppercase tracking-wider">Nama Pelanggan</p>
                      <p className="text-foreground font-bold mt-1">{selectedItem.customerName || 'Umum'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-app-text-muted uppercase tracking-wider">Dibuat Oleh</p>
                      <p className="text-foreground font-bold mt-1">{selectedItem.cashierName || 'Sistem'}</p>
                    </div>
                  </div>

                  <div className="space-y-3 bg-background/20 p-4 rounded-2xl border border-app-border/60">
                    <p className="text-[9px] font-black uppercase text-app-text-muted tracking-widest">Daftar Item Estimasi</p>
                    {selectedItem.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-xs text-foreground font-medium py-1">
                        <span className="flex-1 pr-4">{item.qty}x {item.productName}</span>
                        <span>Rp {(item.subtotal || (item.price * item.qty)).toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                    <div className="border-t border-app-border/40 pt-3 mt-3 flex justify-between items-center font-bold text-sm">
                      <span className="text-foreground">Total Estimasi</span>
                      <span className="text-purple-400 font-black">Rp {selectedItem.total?.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-app-border bg-background/30 flex gap-3">
              <button 
                onClick={() => handleRestore(selectedItem)}
                disabled={isProcessing}
                className="flex-1 py-3.5 bg-accent hover:bg-accent/80 text-foreground font-black text-xs uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <RotateCcw size={16} />
                Pulihkan Item
              </button>
              <button 
                onClick={() => handlePermanentDelete(selectedItem.id)}
                disabled={isProcessing}
                className="py-3.5 px-5 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <Trash2 size={16} />
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
