'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Product, StockMutation } from '@/types';
import { useAuthStore } from '@/store/auth';
import { Search, Package, Loader2, ArrowRightLeft, X } from 'lucide-react';

export default function WarehousePage() {
  const { user, storeId } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [mutationType, setMutationType] = useState<'masuk' | 'keluar' | 'penyesuaian'>('masuk');
  const [mutationQty, setMutationQty] = useState('');
  const [mutationNote, setMutationNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
      // Only show items that are physically managed
      setProducts(prods.filter(p => p.manageStock !== false));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [storeId]);

  // Navigation Guard for Modals (Mobile Back Button support)
  useEffect(() => {
    if (!selectedProduct) return;

    // Push state so back button closes modal
    window.history.pushState({ modalOpen: true }, "");
    
    const handlePopState = () => {
      setSelectedProduct(null);
    };

    window.addEventListener("popstate", handlePopState);
    
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [selectedProduct]);

  const handleManualClose = () => {
    if (window.history.state?.modalOpen) {
      window.history.back();
    } else {
      setSelectedProduct(null);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !selectedProduct.id || !user) return;
    setIsSaving(true);

    try {
      const qtyNum = Number(mutationQty);
      if (qtyNum <= 0) throw new Error("Kuantitas harus lebih dari 0");

      let finalStock = selectedProduct.stock;
      if (mutationType === 'masuk') finalStock += qtyNum;
      else if (mutationType === 'keluar') finalStock -= qtyNum;
      else if (mutationType === 'penyesuaian') finalStock = qtyNum; // Force set

      if (finalStock < 0) finalStock = 0;

      // Update Stock in Products
      await updateDoc(doc(db, 'products', selectedProduct.id), {
        stock: finalStock,
        updatedAt: new Date()
      });

      // Write Audit Log
      const mutationData: StockMutation = {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type: mutationType,
        qty: qtyNum,
        note: mutationNote || (mutationType === 'penyesuaian' ? 'Opname Manual' : 'Penyesuaian Gudang'),
        timestamp: new Date(),
        userEmail: user.email || 'unknown',
        storeId: storeId
      };
      await addDoc(collection(db, 'stock_history'), mutationData);

      setSelectedProduct(null);
      setMutationQty('');
      setMutationNote('');
    } catch (err: any) {
      alert(err.message || "Gagal melakukan penyesuaian stok");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 md:space-y-6 relative">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Gudang & Opname Stok</h1>
          <p className="text-[10px] md:text-app-text-muted mt-1 font-medium">Lakukan penyetokan barang masuk/keluar secara aman.</p>
        </div>
      </div>

      <div className="bg-surface border border-app-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-app-border bg-surface/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
            <input 
              type="text" 
              placeholder="Cari nama atau SKU..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-app-border rounded-xl text-sm text-foreground focus:outline-none focus:border-accent transition-all font-bold"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* Desktop Table */}
          <table className="w-full text-left border-collapse hidden md:table">
            <thead>
              <tr className="bg-background/50 text-app-text-muted text-[10px] uppercase font-black tracking-widest">
                <th className="p-4">SKU</th>
                <th className="p-4">Nama Barang</th>
                <th className="p-4 text-right">Stok Fisik Tersisa</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-app-text-muted">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Memeriksa inventaris...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-app-text-muted">
                    <Package className="w-12 h-12 text-app-text-muted opacity-20 mx-auto mb-4" />
                    Tidak ada barang fisik / stok yang dikelola.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(prod => (
                  <tr key={prod.id} className="hover:bg-accent/5 transition-all">
                    <td className="p-4 text-app-text-muted font-mono text-xs font-bold">{prod.sku || '-'}</td>
                    <td className="p-4 text-foreground font-black">{prod.name}</td>
                    <td className="p-4 text-emerald-500 font-black text-right text-lg tracking-tighter">
                      {prod.stock} <span className="text-[10px] font-black uppercase text-app-text-muted ml-1">{prod.unit || 'unit'}</span>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => setSelectedProduct(prod)}
                        className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/20 hover:bg-accent text-accent hover:text-foreground rounded-xl transition-all text-xs font-black uppercase tracking-widest ml-auto"
                      >
                        <ArrowRightLeft size={14} /> Opname
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-app-border">
            {isLoading ? (
              <div className="p-8 text-center text-app-text-muted">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Memeriksa inventaris...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-8 text-center text-app-text-muted">
                <Package className="w-12 h-12 text-app-text-muted opacity-20 mx-auto mb-4" />
                Tidak ada barang stok.
              </div>
            ) : (
              filteredProducts.map(prod => (
                <div key={prod.id} className="p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-foreground font-black text-sm tracking-tight">{prod.name}</h3>
                      <p className="text-[10px] text-app-text-muted font-mono uppercase tracking-widest mt-0.5">{prod.sku || 'No SKU'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-500 font-black text-lg tracking-tighter">{prod.stock}</p>
                      <p className="text-[9px] font-black uppercase text-app-text-muted leading-none">{prod.unit || 'unit'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedProduct(prod)}
                    className="w-full py-3 bg-accent/10 border border-accent/20 text-accent font-black text-[10px] uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <ArrowRightLeft size={14} /> Atur Stok
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-surface border border-app-border rounded-[32px] w-full max-w-md shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh] animate-in zoom-in-95 duration-300 overflow-hidden">
            {/* Header - Fixed */}
            <div className="flex items-center justify-between p-5 md:p-8 border-b border-app-border bg-surface shrink-0 z-20">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-foreground tracking-tighter uppercase leading-tight">{mutationType === 'penyesuaian' ? 'Opname' : 'Mutasi'} Stok</h2>
                <p className="text-app-text-muted text-[9px] md:text-[10px] font-black uppercase tracking-widest mt-1">{selectedProduct.name}</p>
              </div>
              <button disabled={isSaving} onClick={handleManualClose} className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-background flex items-center justify-center text-app-text-muted hover:text-foreground transition-all">
                <X size={20} />
              </button>
            </div>
            
            {/* Form Body - Scrollable Area */}
            <form onSubmit={handleAdjustStock} className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6 flex flex-col custom-scrollbar">
              <div className="flex-1 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-app-text-muted mb-3 uppercase tracking-widest">Jenis Mutasi</label>
                  <div className="flex gap-2 bg-background p-1.5 rounded-2xl border border-app-border">
                    {(['masuk', 'keluar', 'penyesuaian'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setMutationType(type)}
                        className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${mutationType === type ? 'bg-accent text-foreground shadow-lg shadow-accent/20' : 'text-app-text-muted hover:text-foreground'}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-app-text-muted mb-2 uppercase tracking-widest text-center">
                    {mutationType === 'penyesuaian' ? 'Ubah Menjadi Angka Pasti' : 'Total Unit'}
                  </label>
                  <input 
                    required 
                    type="number" 
                    min={1} 
                    value={mutationQty} 
                    onChange={e => setMutationQty(e.target.value)} 
                    className="w-full px-4 py-5 bg-background border border-app-border rounded-2xl text-foreground font-black text-2xl focus:outline-none focus:border-accent text-center tracking-tighter shadow-inner" 
                    placeholder="0" 
                  />
                  
                  {mutationQty && (
                    <div className="bg-background/50 p-2 rounded-xl mt-4 border border-app-border text-center animate-in fade-in zoom-in-95">
                      <p className="text-[10px] font-black uppercase tracking-widest">
                        <span className="text-app-text-muted">Estimasi Akhir: </span>
                        <span className={`${mutationType === 'masuk' ? 'text-emerald-500' : mutationType === 'keluar' ? 'text-rose-500' : 'text-accent'}`}>
                          {mutationType === 'masuk' ? selectedProduct.stock + Number(mutationQty) : 
                           mutationType === 'keluar' ? Math.max(0, selectedProduct.stock - Number(mutationQty)) : 
                           Number(mutationQty)}
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-app-text-muted mb-2 uppercase tracking-widest">Catatan (Opsional)</label>
                  <input type="text" value={mutationNote} onChange={e => setMutationNote(e.target.value)} placeholder="Contoh: Barang datang dari supplier..." className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground text-xs font-bold focus:outline-none focus:border-accent transition-all shadow-sm" />
                </div>
              </div>
              
              {/* Footer Actions - Sticky to Bottom */}
              <div className="pt-4 mt-auto border-t border-app-border shrink-0 bg-surface">
                <button type="submit" disabled={isSaving || !mutationQty} className="w-full py-5 bg-accent hover:bg-accent-hover text-foreground rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex justify-center items-center gap-3 shadow-xl shadow-accent/20 active:scale-95">
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRightLeft size={18} />}
                  {isSaving ? 'Menyimpan...' : 'Konfirmasi Mutasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
