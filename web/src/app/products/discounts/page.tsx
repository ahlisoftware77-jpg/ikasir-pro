'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, doc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';
import { Discount, Product } from '@/types';
import { Plus, Edit2, Trash2, Search, Loader2, X, Tag, Calendar as CalendarIcon, Percent, ChevronRight, Package, ListFilter, CheckCircle2, Circle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DiscountsPage() {
  const { storeId, user } = useAuthStore();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<Discount>({
    name: '', type: 'percent', value: 0, startDate: '', endDate: '', isActive: true, appliedProductIds: []
  });
  const [editId, setEditId] = useState<string | null>(null);
  
  // Selection states
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>([]);
  const [selectorTab, setSelectorTab] = useState<'product' | 'category'>('product');
  const [selectorSearch, setSelectorSearch] = useState('');

  useEffect(() => {
    if (!storeId) return;

    const q = query(
      collection(db, 'discounts'),
      where('storeId', '==', storeId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Discount[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Discount);
      });
      setDiscounts(items);
      setIsLoading(false);
    });

    // Fetch Products for selection
    const qProds = query(collection(db, 'products'), where('storeId', '==', storeId));
    const unsubscribeProds = onSnapshot(qProds, (snapshot) => {
        const items: Product[] = [];
        const cats = new Set<string>();
        snapshot.forEach((doc) => {
            const data = doc.data() as Product;
            items.push({ ...data, id: doc.id });
            if (data.category) cats.add(data.category);
        });
        setAllProducts(items);
        setCategories(Array.from(cats).sort());
    });

    return () => {
        unsubscribe();
        unsubscribeProds();
    };
  }, [storeId]);

  // Level 1: Main Modal Guard
  useEffect(() => {
    if (!isModalOpen) return;
    window.history.pushState({ modal: 'discount-main' }, "");
    const handlePopState = () => setIsModalOpen(false);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isModalOpen]);

  // Level 2: Product Selector Guard
  useEffect(() => {
    if (!isSelectorOpen) return;
    window.history.pushState({ modal: 'discount-selector' }, "");
    const handlePopState = () => setIsSelectorOpen(false);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isSelectorOpen]);

  // Manual Close Handlers
  const handleManualCloseMain = () => {
    if (window.history.state?.modal === 'discount-main' || window.history.state?.modal === 'discount-selector') {
      window.history.back();
    } else {
      setIsModalOpen(false);
    }
  };

  const handleManualCloseSelector = () => {
    if (window.history.state?.modal === 'discount-selector') {
      window.history.back();
    } else {
      setIsSelectorOpen(false);
    }
  };

  const openModal = (discount?: Discount) => {
    if (discount) {
      setEditId(discount.id!);
      setFormData(discount);
      setTempSelectedIds(discount.appliedProductIds || []);
    } else {
      setEditId(null);
      const today = new Date().toISOString().split('T')[0];
      setFormData({ name: '', type: 'percent', value: 0, startDate: today, endDate: '', isActive: true, appliedProductIds: [] });
      setTempSelectedIds([]);
    }
    setIsModalOpen(true);
  };

  const toggleProduct = (productId: string) => {
    setTempSelectedIds(prev => 
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const toggleCategory = (category: string) => {
    const prodsInCat = allProducts.filter(p => p.category === category).map(p => p.id!);
    const allSelected = prodsInCat.every(id => tempSelectedIds.includes(id));
    
    if (allSelected) {
      setTempSelectedIds(prev => prev.filter(id => !prodsInCat.includes(id)));
    } else {
      setTempSelectedIds(prev => {
        const unique = new Set([...prev, ...prodsInCat]);
        return Array.from(unique);
      });
    }
  };

  const saveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tempSelectedIds.length === 0) {
        toast.error('Harap pilih minimal 1 produk untuk diskon ini.');
        return;
    }
    
    setIsSaving(true);
    const finalData = { ...formData, appliedProductIds: tempSelectedIds };
    try {
      if (editId) {
        await updateDoc(doc(db, 'discounts', editId), { ...finalData });
      } else {
        await addDoc(collection(db, 'discounts'), { ...finalData, storeId: storeId });
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan diskon');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteDiscount = async (id: string) => {
    if (user?.email === 'demo@kasirpro.com') {
      alert('Tindakan Terkunci: Akun Demo tidak memiliki izin untuk menghapus diskon.');
      return;
    }

    if (confirm('Yakin ingin menghapus diskon ini?')) {
      try {
        await deleteDoc(doc(db, 'discounts', id));
      } catch (err) {
        alert('Gagal menghapus diskon');
      }
    }
  };

  const getStatusLabel = (disc: Discount) => {
    if (!disc.isActive) return { label: 'Nonaktif', color: 'bg-slate-800 text-slate-500' };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(disc.startDate);
    const end = disc.endDate ? new Date(disc.endDate) : null;

    if (start > today) return { label: 'Mendatang', color: 'bg-blue-500/10 text-blue-500' };
    if (end && end < today) return { label: 'Kadaluwarsa', color: 'bg-rose-500/10 text-rose-500' };
    return { label: 'Aktif', color: 'bg-emerald-500/10 text-emerald-500' };
  };

  const filteredDiscounts = discounts.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4 md:space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight uppercase">Diskon & Promo</h1>
          <p className="text-[10px] md:text-app-text-muted mt-1 font-medium">Atur promosi potongan harga Katalog.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-foreground px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-accent/20 active:scale-95"
        >
          <Plus size={18} /> Tambah Diskon
        </button>
      </div>

      <div className="bg-surface border border-app-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-app-border bg-surface/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
            <input 
              type="text" 
              placeholder="Cari nama diskon..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-app-border rounded-xl text-foreground focus:outline-none focus:border-accent transition-all font-bold"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* Desktop Table */}
          <table className="w-full text-left border-collapse hidden md:table">
            <thead>
              <tr className="bg-background/50 text-app-text-muted text-[10px] uppercase font-black tracking-widest">
                <th className="p-4 font-medium">Nama Promo</th>
                <th className="p-4 font-medium">Nilai Diskon</th>
                <th className="p-4 font-medium">Periode</th>
                <th className="p-4 font-medium text-center">Status</th>
                <th className="p-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-app-text-muted">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Memuat data...
                  </td>
                </tr>
              ) : filteredDiscounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-app-text-muted">
                    <Tag className="w-12 h-12 text-app-text-muted opacity-20 mx-auto mb-4" />
                    Belum ada kampanye diskon yang didaftarkan.
                  </td>
                </tr>
              ) : (
                filteredDiscounts.map(disc => {
                  const status = getStatusLabel(disc);
                  const statusColors = disc.isActive ? (status.label === 'Aktif' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20') : 'bg-background text-app-text-muted border-app-border';
                  return (
                    <tr key={disc.id} className="hover:bg-accent/5 transition-all">
                      <td className="p-4 text-foreground font-black tracking-tight">{disc.name}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-accent font-black">
                          {disc.type === 'percent' ? <Percent size={14}/> : <span className="text-[10px]">Rp</span>}
                          <span className="text-lg tracking-tighter">{disc.type === 'percent' ? `${disc.value}%` : disc.value.toLocaleString('id-ID')}</span>
                        </div>
                      </td>
                      <td className="p-4 text-app-text-muted text-[10px] font-bold">
                        <div className="flex items-center gap-2 uppercase tracking-wider">
                           <CalendarIcon size={12}/>
                           {new Date(disc.startDate).toLocaleDateString('id-ID', {day:'2-digit', month:'short'})} 
                           {' - '}
                           {disc.endDate ? new Date(disc.endDate).toLocaleDateString('id-ID', {day:'2-digit', month:'short'}) : 'Infinit'}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${statusColors}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openModal(disc)} className="p-2 bg-background border border-app-border hover:text-accent hover:border-accent text-app-text-muted rounded-xl transition-all shadow-sm">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => deleteDiscount(disc.id!)} className="p-2 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 hover:text-white text-rose-500 rounded-xl transition-all shadow-sm">
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

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-app-border">
            {isLoading ? (
              <div className="p-8 text-center text-app-text-muted">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Memuat data...
              </div>
            ) : filteredDiscounts.length === 0 ? (
              <div className="p-8 text-center text-app-text-muted">
                <Tag className="w-12 h-12 text-app-text-muted opacity-20 mx-auto mb-4" />
                Belum ada kampanye diskon yang didaftarkan.
              </div>
            ) : (
              filteredDiscounts.map(disc => {
                const status = getStatusLabel(disc);
                const statusColors = disc.isActive ? (status.label === 'Aktif' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20') : 'bg-background text-app-text-muted border-app-border';
                return (
                  <div key={disc.id} className="p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-foreground font-black tracking-tight">{disc.name}</div>
                        <div className="flex items-center gap-2 uppercase tracking-widest text-[10px] text-app-text-muted font-bold mt-1">
                          <CalendarIcon size={12}/>
                          {new Date(disc.startDate).toLocaleDateString('id-ID', {day:'2-digit', month:'short'})} 
                          {' - '}
                          {disc.endDate ? new Date(disc.endDate).toLocaleDateString('id-ID', {day:'2-digit', month:'short'}) : 'Infinit'}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${statusColors}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-accent font-black">
                      {disc.type === 'percent' ? <Percent size={14}/> : <span className="text-[10px]">Rp</span>}
                      <span className="text-lg tracking-tighter">{disc.type === 'percent' ? `${disc.value}%` : disc.value.toLocaleString('id-ID')}</span>
                    </div>

                    <div className="flex items-center justify-center gap-2 mt-2">
                       <button onClick={() => openModal(disc)} className="flex-1 py-2.5 transition-all bg-background border border-app-border text-foreground hover:text-accent font-bold text-xs rounded-xl flex items-center justify-center gap-2">
                         <Edit2 size={14} /> Edit
                       </button>
                       <button onClick={() => deleteDiscount(disc.id!)} className="flex-1 py-2.5 transition-all bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2">
                         <Trash2 size={14} /> Hapus
                       </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-surface border border-app-border rounded-[32px] w-full max-w-md shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh] animate-in zoom-in-95 duration-300 overflow-hidden">
            {/* Header - Fixed */}
            <div className="flex items-center justify-between p-5 md:p-8 border-b border-app-border bg-surface shrink-0 z-20">
              <div>
                 <h2 className="text-xl md:text-2xl font-black text-foreground uppercase tracking-tighter leading-tight">{editId ? 'Edit Promo' : 'Tambah Promo'}</h2>
                 <p className="text-[9px] md:text-[10px] text-app-text-muted font-black uppercase tracking-widest mt-0.5">Konfigurasi Potongan Harga</p>
              </div>
              <button disabled={isSaving} onClick={handleManualCloseMain} className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-background flex items-center justify-center text-app-text-muted hover:text-foreground transition-all">
                <X size={20} />
              </button>
            </div>
            
            {/* Form Body - Scrollable Area */}
            <form onSubmit={saveDiscount} className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6 custom-scrollbar">
              <div>
                <label className="block text-[10px] font-black text-app-text-muted mb-2 uppercase tracking-widest leading-tight">Nama Kampanye Promo</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-black focus:outline-none focus:border-accent transition-all text-sm shadow-inner" placeholder="Misal: Promo Gajian, Berkah Ramadhan..." />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-app-text-muted mb-2 uppercase tracking-widest">Tipe Diskon</label>
                  <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as 'percent' | 'fixed'})} className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-black focus:outline-none focus:border-accent transition-all appearance-none text-xs md:text-sm">
                    <option value="percent">Persen (%)</option>
                    <option value="fixed">Nominal (Rp)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-app-text-muted mb-2 uppercase tracking-widest">Besar Potongan</label>
                  <input required type="number" min={0} value={formData.value} onChange={e => setFormData({...formData, value: Number(e.target.value)})} className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-black focus:outline-none focus:border-accent transition-all text-sm shadow-inner" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-app-text-muted mb-2 uppercase tracking-widest">Tanggal Mulai</label>
                  <input required type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full p-3 md:p-4 bg-background border border-app-border rounded-2xl text-foreground font-black focus:outline-none focus:border-accent transition-all text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-app-text-muted mb-2 uppercase tracking-widest">Tanggal Akhir</label>
                  <input type="date" value={formData.endDate || ''} onChange={e => setFormData({...formData, endDate: e.target.value})} className="w-full p-3 md:p-4 bg-background border border-app-border rounded-2xl text-foreground font-black focus:outline-none focus:border-accent transition-all text-xs" placeholder="Tak Terbatas" />
                </div>
              </div>

              <div className="flex items-center gap-4 py-4 border-t border-app-border group">
                <input type="checkbox" id="isActiveDisc" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="w-6 h-6 rounded-lg border-app-border bg-background focus:ring-accent text-accent" />
                <label htmlFor="isActiveDisc" className="text-xs font-black text-foreground cursor-pointer select-none uppercase tracking-wide group-hover:text-accent transition-colors">Status Diskon Aktif</label>
              </div>

              {/* Conditional Product Selection Button */}
              {formData.name && formData.value > 0 && (
                <div className="pt-2">
                    <button 
                        type="button"
                        onClick={() => setIsSelectorOpen(true)}
                        className={`w-full p-4 rounded-2xl border-2 border-dashed flex items-center justify-between transition-all group ${
                            tempSelectedIds.length > 0 
                            ? 'border-accent bg-accent/5 text-accent' 
                            : 'border-app-border text-app-text-muted hover:border-accent hover:text-accent'
                        }`}
                    >
                        <div className="flex items-center gap-3 text-left">
                            <div className={`p-2 rounded-xl ${tempSelectedIds.length > 0 ? 'bg-accent text-white' : 'bg-background'}`}>
                                <Package size={18} />
                            </div>
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest">Target Produk</div>
                                <div className="text-sm font-bold leading-tight">
                                    {tempSelectedIds.length === 0 ? 'Pilih Produk atau Kategori' : `${tempSelectedIds.length} Produk Dipilih`}
                                </div>
                            </div>
                        </div>
                        <ChevronRight size={18} className="opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </button>
                    {tempSelectedIds.length === 0 && (
                        <p className="text-[9px] text-rose-500 font-bold mt-2 text-center uppercase tracking-widest animate-pulse">
                            * Wajib memilih item agar diskon valid.
                        </p>
                    )}
                </div>
              )}
              
              {/* Footer - Sticky inside scrollable or just fixed at bottom if flex-1 used */}
              <div className="pt-4 border-t border-app-border flex gap-4 mt-auto shrink-0 bg-surface">
                <button type="button" disabled={isSaving} onClick={handleManualCloseMain} className="flex-1 px-4 py-4 bg-background border border-app-border hover:bg-surface text-app-text-muted hover:text-foreground rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">BATAL</button>
                <button type="submit" disabled={isSaving} className="flex-1 px-4 py-4 bg-accent hover:bg-accent-hover text-foreground rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-3 disabled:grayscale active:scale-95">
                   {isSaving ? <Loader2 size={18} className="animate-spin" /> : null}
                   {isSaving ? 'SIMPAN' : 'SIMPAN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Product & Category Selector Modal */}
      {isSelectorOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 md:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-surface border border-app-border rounded-[32px] w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 overflow-hidden">
                <div className="p-6 md:p-8 border-b border-app-border bg-surface shrink-0">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-xl md:text-2xl font-black text-foreground uppercase tracking-tighter">Target Diskon</h2>
                            <p className="text-[10px] text-app-text-muted font-black uppercase tracking-widest mt-1">Pilih Produk atau Kategori</p>
                        </div>
                        <button onClick={handleManualCloseSelector} className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-app-text-muted hover:text-foreground">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex bg-background p-1.5 rounded-2xl gap-1 mb-4">
                        <button 
                            onClick={() => setSelectorTab('product')}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${selectorTab === 'product' ? 'bg-accent text-foreground shadow-lg' : 'text-app-text-muted hover:text-foreground'}`}
                        >
                            <Package size={14} /> Pilih Barang
                        </button>
                        <button 
                            onClick={() => setSelectorTab('category')}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${selectorTab === 'category' ? 'bg-accent text-foreground shadow-lg' : 'text-app-text-muted hover:text-foreground'}`}
                        >
                            <ListFilter size={14} /> Per Kategori
                        </button>
                    </div>

                    {selectorTab === 'product' && (
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                            <input 
                                type="text"
                                placeholder="Cari barang..."
                                value={selectorSearch}
                                onChange={e => setSelectorSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-background border border-app-border rounded-xl text-foreground text-sm font-bold focus:outline-none focus:border-accent"
                            />
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 bg-background/20 custom-scrollbar relative">
                    {selectorTab === 'product' ? (
                        allProducts
                            .filter(p => !selectorSearch || p.name.toLowerCase().includes(selectorSearch.toLowerCase()))
                            .map(product => {
                                const isSelected = tempSelectedIds.includes(product.id!);
                                return (
                                    <div 
                                        key={product.id}
                                        onClick={() => toggleProduct(product.id!)}
                                        className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${isSelected ? 'bg-accent/10 border-accent shadow-sm' : 'bg-surface border-app-border hover:border-accent/40'}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-xl ${isSelected ? 'bg-accent text-white' : 'bg-background text-app-text-muted'}`}>
                                                {isSelected ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                                            </div>
                                            <div>
                                                <div className="text-sm font-black text-foreground leading-tight">{product.name}</div>
                                                <div className="text-[10px] text-app-text-muted font-bold uppercase mt-0.5 tracking-tight">{product.category} • Rp {product.price.toLocaleString('id-ID')}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                    ) : (
                        categories.map(cat => {
                            const prodsInCat = allProducts.filter(p => p.category === cat).map(p => p.id!);
                            const allSelected = prodsInCat.every(id => tempSelectedIds.includes(id));
                            const someSelected = prodsInCat.some(id => tempSelectedIds.includes(id));
                            
                            return (
                                <div 
                                    key={cat}
                                    onClick={() => toggleCategory(cat)}
                                    className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${allSelected ? 'bg-accent/10 border-accent shadow-sm' : 'bg-surface border-app-border hover:border-accent/40'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-xl ${allSelected ? 'bg-accent text-white' : (someSelected ? 'bg-accent/30 text-accent' : 'bg-background text-app-text-muted')}`}>
                                            {allSelected ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                                        </div>
                                        <div>
                                            <div className="text-sm font-black text-foreground leading-tight uppercase tracking-tight">{cat || 'Tanpa Kategori'}</div>
                                            <div className="text-[10px] text-app-text-muted font-bold uppercase mt-0.5 tracking-tight">{prodsInCat.length} Produk</div>
                                        </div>
                                    </div>
                                    <div className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${allSelected ? 'bg-accent text-foreground' : 'bg-background'}`}>
                                        {allSelected ? 'Terpilih' : 'Pilih Semua'}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="p-6 md:p-8 border-t border-app-border bg-surface shrink-0 flex items-center justify-between gap-4">
                    <div className="hidden md:block">
                        <div className="text-xs font-black text-foreground uppercase tracking-wider">{tempSelectedIds.length} Barang</div>
                        <p className="text-[9px] text-app-text-muted font-bold uppercase tracking-widest">Siap diterapkan</p>
                    </div>
                    <button 
                        onClick={handleManualCloseSelector}
                        className="flex-1 py-4 bg-accent hover:bg-accent-hover text-foreground rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-accent/20 transition-all active:scale-95"
                    >
                        KONFIRMASI PILIHAN
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

