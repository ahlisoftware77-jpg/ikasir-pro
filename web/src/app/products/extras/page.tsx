'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, doc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';
import { ProductExtra, ExtraOption } from '@/types';
import { Plus, Edit2, Trash2, Search, Loader2, X, Star, Settings2, ListPlus } from 'lucide-react';

export default function ExtrasPage() {
  const { storeId, user } = useAuthStore();
  const [extras, setExtras] = useState<ProductExtra[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const defaultOption: ExtraOption = { name: '', price: 0 };
  const [formData, setFormData] = useState<ProductExtra>({
    name: '', 
    options: [{ ...defaultOption }], 
    isMandatory: false, 
    allowMultiple: false, 
    hasMaxLimit: false, 
    maxLimit: 1,
    isActive: true
  });
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) return;

    const q = query(
      collection(db, 'product_extras'),
      where('storeId', '==', storeId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: ProductExtra[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as ProductExtra);
      });
      setExtras(items);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [storeId]);

  // Navigation Guard for Modals (Mobile Back Button support)
  useEffect(() => {
    if (!isModalOpen) return;

    // Push state so back button closes modal
    window.history.pushState({ modalOpen: true }, "");
    
    const handlePopState = () => {
      setIsModalOpen(false);
    };

    window.addEventListener("popstate", handlePopState);
    
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isModalOpen]);

  const handleManualClose = () => {
    if (window.history.state?.modalOpen) {
      window.history.back();
    } else {
      setIsModalOpen(false);
    }
  };

  const openModal = (extra?: ProductExtra) => {
    if (extra) {
      setEditId(extra.id!);
      setFormData({
        ...extra,
        options: extra.options || [{ ...defaultOption }],
        maxLimit: extra.maxLimit || 1
      });
    } else {
      setEditId(null);
      setFormData({ 
        name: '', 
        options: [{ ...defaultOption }], 
        isMandatory: false, 
        allowMultiple: false, 
        hasMaxLimit: false, 
        maxLimit: 1, 
        isActive: true 
      });
    }
    setIsModalOpen(true);
  };

  const addOption = () => {
    setFormData({
      ...formData,
      options: [...formData.options, { ...defaultOption }]
    });
  };

  const removeOption = (index: number) => {
    if (formData.options.length <= 1) return;
    const newOptions = [...formData.options];
    newOptions.splice(index, 1);
    setFormData({ ...formData, options: newOptions });
  };

  const updateOption = (index: number, field: keyof ExtraOption, value: string | number) => {
    const newOptions = [...formData.options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setFormData({ ...formData, options: newOptions });
  };

  const saveExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Clean up options (remove empty names)
    const cleanOptions = formData.options.filter(o => o.name.trim() !== '');
    if (cleanOptions.length === 0) {
      alert('Minimal harus ada 1 opsi pilihan produk ekstra');
      setIsSaving(false);
      return;
    }

    const finalData = { ...formData, options: cleanOptions };

    try {
      if (editId) {
        await updateDoc(doc(db, 'product_extras', editId), { ...finalData });
      } else {
        await addDoc(collection(db, 'product_extras'), { ...finalData, storeId: storeId });
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan produk ekstra');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteExtra = async (id: string) => {
    if (user?.email === 'demo@kasirpro.com') {
      alert('Tindakan Terkunci: Akun Demo tidak memiliki izin untuk menghapus data demi menjaga keamanan data uji coba.');
      return;
    }
    
    if (confirm('Yakin ingin menghapus grup ekstra ini? Data ini akan hilang permanen.')) {
      try {
        await deleteDoc(doc(db, 'product_extras', id));
      } catch (err) {
        alert('Gagal menghapus produk ekstra');
      }
    }
  };

  const filteredExtras = extras.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4 md:space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Produk Ekstra & Modifier</h1>
          <p className="text-[10px] md:text-app-text-muted mt-1 font-medium">Kelola grup pilihan dengan aturan kustom.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-foreground px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-accent/20 active:scale-95"
        >
          <Plus size={18} /> Tambah Grup Ekstra
        </button>
      </div>

      <div className="bg-surface border border-app-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-app-border bg-surface/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
            <input 
              type="text" 
              placeholder="Cari nama grup ekstra..." 
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
                <th className="p-4">Nama Grup</th>
                <th className="p-4 text-center">Jumlah Opsi</th>
                <th className="p-4">Aturan</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-app-text-muted">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Memuat data ekstra...
                  </td>
                </tr>
              ) : filteredExtras.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-app-text-muted">
                    <Star className="w-12 h-12 text-app-text-muted opacity-20 mx-auto mb-4" />
                    Belum ada grup ekstra yang didaftarkan.
                  </td>
                </tr>
              ) : (
                filteredExtras.map(extra => (
                  <tr key={extra.id} className="hover:bg-accent/5 transition-all">
                    <td className="p-4">
                      <div className="text-foreground font-black tracking-tight">{extra.name}</div>
                      <div className="text-[10px] text-app-text-muted truncate mt-1 max-w-[200px] font-medium italic">
                        {extra.options?.map(o => o.name).join(', ')}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="bg-background px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-app-text-muted border border-app-border">
                        {extra.options?.length || 0} Pilihan
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {extra.isMandatory && <span className="bg-rose-500/10 text-rose-500 text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest border border-rose-500/20">Wajib</span>}
                        {extra.allowMultiple ? 
                          <span className="bg-accent/10 text-accent text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest border border-accent/20">Multiple</span> :
                          <span className="bg-background text-app-text-muted text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest border border-app-border">Single</span>
                        }
                        {extra.hasMaxLimit && <span className="bg-amber-500/10 text-amber-500 text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest border border-amber-500/20">Max {extra.maxLimit}</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${extra.isActive ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-background text-app-text-muted border-app-border'}`}>
                        {extra.isActive ? 'Aktif' : 'Off'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openModal(extra)} className="p-2 transition-all bg-background border border-app-border text-app-text-muted hover:text-accent hover:border-accent rounded-xl shadow-sm">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => deleteExtra(extra.id!)} className="p-2 transition-all bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl shadow-sm">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-app-border">
            {isLoading ? (
              <div className="p-8 text-center text-app-text-muted">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Memuat data ekstra...
              </div>
            ) : filteredExtras.length === 0 ? (
              <div className="p-8 text-center text-app-text-muted">
                <Star className="w-12 h-12 text-app-text-muted opacity-20 mx-auto mb-4" />
                Belum ada grup ekstra yang didaftarkan.
              </div>
            ) : (
              filteredExtras.map(extra => (
                <div key={extra.id} className="p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-foreground font-black tracking-tight">{extra.name}</div>
                      <div className="text-[10px] text-app-text-muted font-medium italic mt-0.5">
                        {extra.options?.length || 0} Pilihan
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${extra.isActive ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-background text-app-text-muted border-app-border'}`}>
                      {extra.isActive ? 'Aktif' : 'Off'}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {extra.isMandatory && <span className="bg-rose-500/10 text-rose-500 text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest border border-rose-500/20">Wajib</span>}
                    {extra.allowMultiple ? 
                      <span className="bg-accent/10 text-accent text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest border border-accent/20">Multiple</span> :
                      <span className="bg-background text-app-text-muted text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest border border-app-border">Single</span>
                    }
                    {extra.hasMaxLimit && <span className="bg-amber-500/10 text-amber-500 text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest border border-amber-500/20">Max {extra.maxLimit}</span>}
                  </div>

                  <div className="flex items-center justify-center gap-2 mt-2">
                    <button onClick={() => openModal(extra)} className="flex-1 py-2.5 transition-all bg-background border border-app-border text-foreground hover:text-accent font-bold text-xs rounded-xl flex items-center justify-center gap-2">
                      <Edit2 size={14} /> Edit
                    </button>
                    <button onClick={() => deleteExtra(extra.id!)} className="flex-1 py-2.5 transition-all bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2">
                      <Trash2 size={14} /> Hapus
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-surface border border-app-border rounded-[32px] w-full max-w-2xl shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh] animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="flex items-center justify-between p-5 md:p-8 border-b border-app-border bg-surface shrink-0 z-20">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="p-2 md:p-3 bg-accent/20 text-accent rounded-xl md:rounded-2xl shadow-lg shadow-accent/10">
                  <Settings2 size={24} />
                </div>
                <div>
                  <h2 className="text-lg md:text-2xl font-black text-foreground uppercase tracking-tighter">{editId ? 'Edit Grup Ekstra' : 'Grup Ekstra Baru'}</h2>
                  <p className="text-[9px] md:text-[10px] text-app-text-muted font-bold uppercase tracking-widest mt-0.5">Konfigurasi Modifier</p>
                </div>
              </div>
              <button disabled={isSaving} onClick={handleManualClose} className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-background flex items-center justify-center text-app-text-muted hover:text-foreground transition-all">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={saveExtra} className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6 md:space-y-8 custom-scrollbar">
              {/* NAMA GRUP */}
              <div>
                <label className="block text-[10px] font-black text-app-text-muted mb-3 uppercase tracking-widest">Nama Grup Ekstra</label>
                <input 
                  required 
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground focus:outline-none focus:border-accent transition-all font-black" 
                  placeholder="Misal: Pilihan Topping, Level Pedas, Masa Berlaku..." 
                />
              </div>

              {/* OPSI PILIHAN */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Daftar Opsi Pilihan</label>
                  <button 
                    type="button" 
                    onClick={addOption}
                    className="flex items-center gap-2 text-[10px] font-black text-accent hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
                  >
                    <Plus size={14} /> Tambah Opsi
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.options.map((option, index) => (
                    <div key={index} className="flex flex-col md:flex-row gap-3 p-3 md:p-0 bg-background/50 md:bg-transparent border border-app-border md:border-none rounded-2xl md:rounded-none group animate-in fade-in slide-in-from-left-2 transition-all relative">
                      <div className="flex-1">
                        <label className="md:hidden block text-[8px] font-black text-app-text-muted mb-1 uppercase">Nama Opsi</label>
                        <input 
                          required
                          type="text" 
                          value={option.name} 
                          onChange={e => updateOption(index, 'name', e.target.value)}
                          placeholder="Nama Opsi (Contoh: Boba)"
                          className="w-full p-4 bg-background border border-app-border rounded-xl md:rounded-2xl text-foreground text-xs font-black focus:outline-none focus:border-accent shadow-inner"
                        />
                      </div>
                      <div className="w-full md:w-36">
                        <label className="md:hidden block text-[8px] font-black text-app-text-muted mb-1 uppercase">Harga Tambahan</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted text-[10px] font-black">Rp</span>
                          <input 
                            required
                            type="number" 
                            value={option.price === 0 ? '' : option.price} 
                            onChange={e => updateOption(index, 'price', Number(e.target.value))}
                            className="w-full pl-10 pr-4 py-4 bg-background border border-app-border rounded-xl md:rounded-2xl text-foreground text-xs font-black focus:outline-none focus:border-accent shadow-inner"
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end">
                        <button 
                          type="button" 
                          onClick={() => removeOption(index)}
                          disabled={formData.options.length <= 1}
                          className="w-full md:w-auto p-4 md:p-4 bg-rose-500/5 md:bg-background border border-rose-500/20 md:border-app-border hover:bg-rose-500/10 text-rose-500 md:text-app-text-muted md:hover:text-rose-500 rounded-xl md:rounded-2xl transition-all disabled:opacity-30 active:scale-90 flex items-center justify-center gap-2"
                        >
                          <Trash2 size={20} />
                          <span className="md:hidden text-[10px] font-black uppercase tracking-widest">Hapus Opsi</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ATURAN LOGIKA */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 pt-6 border-t border-app-border">
                <div className="flex items-center justify-between py-2 group">
                  <div>
                    <div className="text-xs font-black text-foreground uppercase tracking-tight group-hover:text-accent transition-colors">Wajib Memilih?</div>
                    <div className="text-[9px] text-app-text-muted font-bold uppercase tracking-widest mt-0.5">Membatasi agar tidak bisa dilewati</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={formData.isMandatory} onChange={e => setFormData({...formData, isMandatory: e.target.checked})} className="sr-only peer" />
                    <div className="w-12 h-6 bg-background border border-app-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between py-2 group">
                   <div>
                    <div className="text-xs font-black text-foreground uppercase tracking-tight group-hover:text-accent transition-colors">Pilih Lebih dari 1?</div>
                    <div className="text-[9px] text-app-text-muted font-bold uppercase tracking-widest mt-0.5">Boleh pilih beberapa opsi sekaligus</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={formData.allowMultiple} onChange={e => setFormData({...formData, allowMultiple: e.target.checked})} className="sr-only peer" />
                    <div className="w-12 h-6 bg-background border border-app-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between py-2 group">
                   <div>
                    <div className="text-xs font-black text-foreground uppercase tracking-tight group-hover:text-accent transition-colors">Batasan Maksimal?</div>
                    <div className="text-[9px] text-app-text-muted font-bold uppercase tracking-widest mt-0.5">Batasi jumlah pilihan maksimum</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={formData.hasMaxLimit} onChange={e => setFormData({...formData, hasMaxLimit: e.target.checked})} className="sr-only peer" />
                    <div className="w-12 h-6 bg-background border border-app-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                  </label>
                </div>

                {formData.hasMaxLimit && (
                  <div className="flex items-center justify-between py-2 animate-in fade-in zoom-in-95">
                    <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Minimal & Maksimal</div>
                    <input 
                      type="number" 
                      min={1} 
                      value={formData.maxLimit === 0 ? '' : formData.maxLimit} 
                      onChange={e => setFormData({...formData, maxLimit: Number(e.target.value)})} 
                      className="w-20 p-3 bg-background border-2 border-amber-500/20 rounded-xl text-foreground text-center font-black focus:outline-none focus:border-amber-500 transition-all text-sm" 
                      placeholder="0"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 py-6 border-t border-app-border group">
                <input type="checkbox" id="isActiveGrp" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="w-6 h-6 rounded-lg border-app-border bg-background focus:ring-accent text-accent" />
                <label htmlFor="isActiveGrp" className="text-xs font-black text-foreground cursor-pointer select-none uppercase tracking-wide group-hover:text-accent transition-colors">Grup ini Aktif & Siap Muncul di Kasir</label>
              </div>
              
              <div className="flex gap-4 bg-surface p-5 md:p-8 md:py-6 border-t border-app-border shrink-0 mt-auto">
                <button type="button" disabled={isSaving} onClick={handleManualClose} className="flex-1 px-4 md:px-8 py-4 md:py-5 bg-background border border-app-border hover:bg-surface text-app-text-muted hover:text-foreground rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all">BATAL</button>
                <button type="submit" disabled={isSaving} className="flex-1 px-4 md:px-8 py-4 md:py-5 bg-accent hover:bg-accent-hover text-foreground rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-3 active:scale-95 disabled:grayscale">
                   {isSaving ? <Loader2 size={24} className="animate-spin" /> : null}
                   {isSaving ? 'MEMPROSES...' : 'SIMPAN GRUP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
