'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, where, deleteDoc } from 'firebase/firestore';
import { logActivity } from '@/lib/activity';
import { initializeApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';
import { Users as UsersIcon, Loader2, Plus, X, UserCog, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const { user, storeId, storeName, subscriptionUntil } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [maxUsers, setMaxUsers] = useState<number>(5);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'cashier'
  });

  const [editPermissions, setEditPermissions] = useState({
    canAccessPOS: true,
    canManageProducts: false,
    canCreateProducts: false,
    canEditProducts: false,
    canDeleteProducts: false,
    canViewReports: false,
    canManageUsers: false,
    canEditSettings: false,
    canManageEstimations: false,
    canManageDebts: false,
    canManageOrders: false,
    canViewLogs: false
  });
  useEffect(() => {
    if (!storeId) return;

    // Fetch maxUsers from store document
    const storeRef = doc(db, 'stores', storeId);
    onSnapshot(storeRef, (doc) => {
      if (doc.exists()) {
        setMaxUsers(doc.data().maxUsers || 5);
      }
    });

    const q = query(
      collection(db, 'users'),
      where('storeId', '==', storeId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usr: any[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.role !== 'super-admin') {
          usr.push({ id: d.id, ...data });
        }
      });
      setUsers(usr);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [storeId]);

  // Level 1: Add User Modal Guard
  useEffect(() => {
    if (!isModalOpen) return;
    window.history.pushState({ modal: 'user-add' }, "");
    const handlePopState = () => setIsModalOpen(false);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isModalOpen]);

  // Level 2: Permissions Modal Guard
  useEffect(() => {
    if (!isPermModalOpen) return;
    window.history.pushState({ modal: 'user-perm' }, "");
    const handlePopState = () => setIsPermModalOpen(false);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isPermModalOpen]);

  // Manual Close Handlers
  const handleManualCloseAdd = () => {
    if (window.history.state?.modal === 'user-add') {
      window.history.back();
    } else {
      setIsModalOpen(false);
    }
  };

  const handleManualClosePerm = () => {
    if (window.history.state?.modal === 'user-perm') {
      window.history.back();
    } else {
      setIsPermModalOpen(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check user quota
    if (users.length >= maxUsers) {
      toast.error(`Kuota user penuh! Maksimal ${maxUsers} user. Hubungi Super Admin untuk menambah kuota.`);
      return;
    }

    setIsSaving(true);
    
    try {
      // 1. Dapatkan config dari primary app
      const primaryApp = getApp();
      const firebaseConfig = primaryApp.options;

      // 2. Buat secondary app instance supaya tidak otomatis me-logout admin
      const secondaryApp = initializeApp(firebaseConfig, "SecondaryAppForCreation");
      const secondaryAuth = getAuth(secondaryApp);

      // 3. Buat user baru di Firebase Auth menggunakan secondary app
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, 
        formData.email, 
        formData.password
      );

      // 4. Logout secondary user & bersihkan app instance
      await signOut(secondaryAuth);
      
      // 5. Simpan hak akses role ke koleksi Firestore (`users`)
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        storeId: storeId,
        storeName: storeName || '',
        permissions: {
          canAccessPOS: true,
          canManageProducts: formData.role === 'admin',
          canCreateProducts: formData.role === 'admin',
          canEditProducts: formData.role === 'admin',
          canDeleteProducts: formData.role === 'admin',
          canViewReports: formData.role === 'admin',
          canManageUsers: formData.role === 'admin',
          canEditSettings: formData.role === 'admin',
          canManageEstimations: formData.role === 'admin',
          canManageDebts: formData.role === 'admin',
          canManageOrders: formData.role === 'admin',
          canViewLogs: formData.role === 'admin'
        },
        isActive: true,
        isSubscribed: !!subscriptionUntil,
        validUntil: subscriptionUntil || '',
        createdAt: new Date()
      });

      // Log User Creation
      await logActivity({
        userId: user?.uid || 'unknown',
        userName: user?.displayName || user?.email || 'Admin',
        userEmail: user?.email || '-',
        storeId: storeId || 'unknown',
        action: 'ADD_USER',
        description: `Menambahkan user baru: ${formData.name} (${formData.email}) sebagai ${formData.role === 'admin' ? 'Administrator' : 'Kasir'}`
      });

      toast.success('Berhasil membuat pengguna baru!');
      setIsModalOpen(false);
      setFormData({ name: '', email: '', password: '', role: 'cashier' });
    } catch (err: any) {
      console.error(err);
      let errorMessage = 'Gagal menambahkan pengguna';
      
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Email sudah terdaftar. Silakan gunakan email lain atau login dengan email ini.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Kata sandi terlalu lemah. Minimal 6 karakter.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Format email tidak valid.';
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const openPermissionModal = (user: any) => {
    setSelectedUser(user);
    setEditPermissions({
      canAccessPOS: user.permissions?.canAccessPOS ?? true,
      canManageProducts: user.permissions?.canManageProducts ?? false,
      canCreateProducts: user.permissions?.canCreateProducts ?? user.permissions?.canManageProducts ?? false,
      canEditProducts: user.permissions?.canEditProducts ?? user.permissions?.canManageProducts ?? false,
      canDeleteProducts: user.permissions?.canDeleteProducts ?? user.permissions?.canManageProducts ?? false,
      canViewReports: user.permissions?.canViewReports ?? false,
      canManageUsers: user.permissions?.canManageUsers ?? false,
      canEditSettings: user.permissions?.canEditSettings ?? false,
      canManageEstimations: user.permissions?.canManageEstimations ?? false,
      canManageDebts: user.permissions?.canManageDebts ?? false,
      canManageOrders: user.permissions?.canManageOrders ?? false,
      canViewLogs: user.permissions?.canViewLogs ?? false
    });
    setIsPermModalOpen(true);
  };

  const handleUpdatePermissions = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'users', selectedUser.id), {
        permissions: editPermissions
      }, { merge: true });

      // Log Permission Update
      await logActivity({
        userId: user?.uid || 'unknown',
        userName: user?.displayName || user?.email || 'Admin',
        userEmail: user?.email || '-',
        storeId: storeId || 'unknown', 
        action: 'EDIT_USER',
        description: `Memperbarui izin akses untuk user: ${selectedUser.name}`
      });
      alert('Izin pengguna berhasil diperbarui!');
      setIsPermModalOpen(false);
    } catch (err: any) {
      alert('Gagal memperbarui izin: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };
  const handleDeleteUser = async (u: any) => {
    if (u.id === user?.uid) {
      toast.error('Anda tidak dapat menghapus akun Anda sendiri dari menu ini.');
      return;
    }

    if (u.role === 'admin' && users.filter(usr => usr.role === 'admin').length <= 1) {
      toast.error('Harus ada minimal satu Administrator di sistem!');
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus user "${u.name || u.email}"? Tindakan ini akan menghapus data akses mereka dari database.`)) {
      return;
    }

    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'users', u.id));
      
      // Log User Deletion
      await logActivity({
        userId: user?.uid || 'unknown',
        userName: user?.displayName || user?.email || 'Admin',
        userEmail: user?.email || '-',
        storeId: storeId || 'unknown',
        action: 'DELETE_USER',
        description: `Menghapus user: ${u.name} (${u.email})`
      });

      toast.success('User berhasil dihapus dari database!');
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal menghapus user: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">Manajemen User</h1>
            <div className="flex items-center gap-2 mt-1">
               <p className="text-xs md:text-sm text-app-text-muted font-medium">Kelola hak akses operator sistem POS</p>
               <span className="text-[10px] bg-background border border-app-border px-2 py-0.5 rounded-md font-black text-accent flex items-center gap-1.5 uppercase">
                  Kuota: {users.length} / {maxUsers}
               </span>
            </div>
          </div>
          <button 
            onClick={() => {
              if (users.length >= maxUsers) {
                toast.error(`Kuota user penuh (${maxUsers}/${maxUsers}).`);
                return;
              }
              setIsModalOpen(true);
            }}
            className={`w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-black text-xs shadow-xl transition-all active:scale-95 ${
              users.length >= maxUsers 
              ? 'bg-app-border text-app-text-muted cursor-not-allowed grayscale' 
              : 'bg-accent hover:bg-accent-hover text-foreground shadow-accent/20'
            }`}
          >
            <Plus size={18} /> TAMBAH KASIR
          </button>
        </div>

      <div className="bg-surface border border-app-border rounded-3xl overflow-hidden mt-6 shadow-xl shadow-black/5 transition-colors duration-300">
        <div className="overflow-x-auto">
          {/* Desktop Table View */}
          <table className="w-full text-left border-collapse hidden md:table">
            <thead>
              <tr className="bg-background/50 text-app-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="p-6">User ID</th>
                <th className="p-6">Identitas Pengguna</th>
                <th className="p-6">Hak Akses (Role)</th>
                <th className="p-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/30">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="p-20 text-center text-app-text-muted">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-accent" />
                    <p className="font-bold animate-pulse">Memuat database pengguna...</p>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-20 text-center text-app-text-muted">
                    <UsersIcon className="w-16 h-16 opacity-10 mx-auto mb-4" />
                    <p className="font-bold italic">Belum ada pengguna terdaftar</p>
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="hover:bg-background/30 transition-colors group">
                    <td className="p-6 text-app-text-muted font-mono text-xs max-w-[120px] truncate" title={u.id}>
                       <span className="text-accent opacity-50">UID#</span>{u.id?.substring(0,10)}
                    </td>
                    <td className="p-6">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-black text-accent uppercase">
                             {(u.email || u.name)?.substring(0,2)}
                          </div>
                          <div>
                            <p className="text-foreground font-black text-sm">{u.name || 'User Tanpa Nama'}</p>
                            <p className="text-[10px] text-app-text-muted font-bold">{u.email}</p>
                          </div>
                       </div>
                    </td>
                    <td className="p-6">
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                        u.role === 'admin' 
                        ? 'bg-accent/10 border-accent/30 text-accent shadow-sm shadow-accent/5' 
                        : 'bg-background border-app-border text-app-text-muted'
                      }`}>
                        {u.role || 'KASIR'}
                      </span>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => openPermissionModal(u)}
                          className="bg-accent/10 hover:bg-accent text-accent hover:text-foreground px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          Setel Izin
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(u)}
                          className="bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white p-2.5 rounded-xl transition-all"
                          title="Hapus User"
                        >
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
                <div className="p-20 text-center">
                   <Loader2 className="w-10 h-10 animate-spin text-accent mx-auto mb-4" />
                   <p className="text-app-text-muted font-black animate-pulse">Syncing users...</p>
                </div>
             ) : users.length === 0 ? (
                <div className="p-20 text-center text-app-text-muted italic">
                   Belum ada pengguna terdaftar
                </div>
             ) : (
                users.map(u => (
                   <div key={u.id} className="p-4 flex items-center gap-4 hover:bg-accent/5 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-black text-accent uppercase shrink-0">
                         {(u.email || u.name)?.substring(0,2)}
                      </div>
                      <div className="flex-1 min-w-0 pr-4">
                         <h4 className="font-bold text-foreground text-sm truncate">{u.name || 'User Tanpa Nama'}</h4>
                         <p className="text-[10px] text-app-text-muted truncate">{u.email}</p>
                         <div className="flex items-center gap-2 mt-2">
                           <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${u.role === 'admin' ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-background border-app-border text-app-text-muted'}`}>
                             {u.role || 'KASIR'}
                           </span>
                           <div className="flex items-center gap-1">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                             <span className="text-emerald-500 font-black text-[8px] uppercase">Aktif</span>
                           </div>
                         </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="text-[10px] font-mono text-app-text-muted bg-background/50 px-2 py-1 rounded-lg">
                          #{u.id?.substring(0,8)}
                        </div>
                        <button 
                          onClick={() => openPermissionModal(u)}
                          className="p-2 bg-accent/10 hover:bg-accent text-accent hover:text-foreground rounded-lg transition-all"
                          title="Setel Izin"
                        >
                          <UserCog size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(u)}
                          className="p-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg transition-all"
                          title="Hapus User"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                 ))
              )}
           </div>
        </div>
      </div>

      {/* MODAL TAMBAH USER */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-surface border-t md:border border-app-border rounded-t-[2.5rem] md:rounded-[2.5rem] w-full max-w-md shadow-2xl p-8 md:p-10 h-full md:h-auto overflow-y-auto animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-foreground flex items-center gap-3">
                <div className="p-2 bg-accent/20 rounded-xl">
                  <UserCog className="text-accent" size={24} />
                </div>
                Tambah User
              </h2>
              <button disabled={isSaving} onClick={handleManualCloseAdd} className="text-app-text-muted hover:text-rose-500 transition-colors p-2 hover:bg-background rounded-full">
                <X size={28} />
              </button>
            </div>
            
            <form onSubmit={handleCreateUser} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-2">Nama Lengkap</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all" placeholder="E.g. Jhon Doe" />
              </div>
              
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-2">Alamat Email</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all" placeholder="kasir1@kasirpro.com" />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-2">Password Akses</label>
                <input required type="password" minLength={6} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all" placeholder="Minimal 6 karakter" />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-2">Peran (Role)</label>
                <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all appearance-none cursor-pointer">
                  <option value="cashier">Kasir Reguler</option>
                  <option value="admin">Administrator / Manager</option>
                </select>
              </div>
              
              <div className="pt-6 flex gap-4">
                <button type="button" disabled={isSaving} onClick={handleManualCloseAdd} className="flex-1 px-4 py-4 bg-background hover:bg-surface text-app-text-muted border border-app-border rounded-2xl font-black transition-all disabled:opacity-50">BATAL</button>
                <button type="submit" disabled={isSaving} className="flex-[2] px-4 py-4 bg-accent hover:bg-accent-hover text-foreground rounded-2xl font-black shadow-xl shadow-accent/20 transition-all disabled:opacity-50 flex justify-center items-center gap-2 active:scale-95 uppercase tracking-widest text-xs">
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : null}
                  {isSaving ? 'MEMPROSES...' : 'DAFTARKAN USER'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT IZIN */}
      {isPermModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-surface border-t md:border border-app-border rounded-t-[2.5rem] md:rounded-[2.5rem] w-full max-w-md shadow-2xl p-8 md:p-10 h-full md:h-auto max-h-[95vh] overflow-y-auto animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-8 sticky top-0 bg-surface z-10 py-2 border-b border-app-border/30">
              <h2 className="text-lg md:text-xl font-black text-foreground uppercase tracking-tight">Izin Akses: <span className="text-accent">{selectedUser?.name}</span></h2>
              <button onClick={handleManualClosePerm} className="text-app-text-muted hover:text-rose-500 transition-colors p-2 hover:bg-background rounded-full">
                <X size={28} />
              </button>
            </div>


            <div className="space-y-4">
              {[
                { key: 'canAccessPOS', label: 'Buka Menu Kasir (POS)', desc: 'Boleh melakukan transaksi penjualan' },
                { key: 'canManageProducts', label: 'Manajemen Produk', desc: 'Akses ke daftar/stok barang' },
                { key: 'canViewReports', label: 'Buka Menu Laporan', desc: 'Boleh melihat omzet & riwayat' },
                { key: 'canManageEstimations', label: 'Estimasi Biaya', desc: 'Akses menu pembuatan penawaran harga' },
                { key: 'canManageDebts', label: 'Hutang Piutang', desc: 'Manajemen piutang pelanggan' },
                { key: 'canManageOrders', label: 'Daftar Pesanan', desc: 'Lihat & proses pesanan online/delivery' },
                { key: 'canManageUsers', label: 'Kelola Staf / User', desc: 'Boleh tambah/edit data kasir lain' },
                { key: 'canViewLogs', label: 'Log Aktivitas', desc: 'Lihat riwayat aktifitas sistem' },
                { key: 'canEditSettings', label: 'Pengaturan Toko', desc: 'Boleh ubah profil & branding toko' },
              ].map(perm => (
                <div key={perm.key} className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-background border border-app-border rounded-2xl">
                    <div>
                      <p className="text-sm font-black text-foreground">{perm.label}</p>
                      <p className="text-[10px] text-app-text-muted font-bold italic">{perm.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={(editPermissions as any)[perm.key]}
                        onChange={(e) => {
                          const val = e.target.checked;
                          const newPerms = { ...editPermissions, [perm.key]: val };
                          // Auto sync sub-permissions if master products toggle is changed
                          if (perm.key === 'canManageProducts') {
                            newPerms.canCreateProducts = val;
                            newPerms.canEditProducts = val;
                            newPerms.canDeleteProducts = val;
                          }
                          setEditPermissions(newPerms);
                        }}
                      />
                      <div className="w-11 h-6 bg-app-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent shadow-sm"></div>
                    </label>
                  </div>

                  {/* SUB-PERMISSIONS FOR PRODUCTS */}
                  {perm.key === 'canManageProducts' && editPermissions.canManageProducts && (
                    <div className="ml-6 pl-4 border-l-2 border-accent/20 space-y-2 pb-2">
                       {[
                         { key: 'canCreateProducts', label: 'Tambah Barang' },
                         { key: 'canEditProducts', label: 'Edit / Update Barang' },
                         { key: 'canDeleteProducts', label: 'Hapus Barang' },
                       ].map(sub => (
                         <div key={sub.key} className="flex items-center justify-between p-3 bg-accent/5 border border-accent/10 rounded-xl">
                            <span className="text-[11px] font-bold text-foreground/80">{sub.label}</span>
                            <label className="relative inline-flex items-center scale-75 cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={(editPermissions as any)[sub.key]}
                                onChange={(e) => setEditPermissions({...editPermissions, [sub.key]: e.target.checked})}
                              />
                              <div className="w-11 h-6 bg-app-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent shadow-sm"></div>
                            </label>
                         </div>
                       ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 flex gap-3">
              <button disabled={isSaving} onClick={handleManualClosePerm} className="flex-1 px-4 py-4 bg-background border border-app-border text-app-text-muted rounded-2xl font-black transition-all">BATAL</button>
              <button 
                onClick={handleUpdatePermissions}
                disabled={isSaving} 
                className="flex-[2] px-4 py-4 bg-accent text-foreground rounded-2xl font-black shadow-xl shadow-accent/20 transition-all flex justify-center items-center gap-2"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : 'SIMPAN IZIN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
