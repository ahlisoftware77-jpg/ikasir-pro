'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { User as UserIcon, UserCircle, Mail, Shield, Key, Loader2, Save, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { logActivity } from '@/lib/activity';

export default function ProfilePage() {
  const { user, role, storeId, storeName, userName, setUserName } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: userName || user.displayName || '',
        email: user.email || '',
      });
      setIsLoading(false);
    }
  }, [user, userName]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);

    try {
      // 1. Update Firebase Auth Profile
      await updateProfile(user, {
        displayName: formData.name
      });

      // 2. Update Firestore Users Collection
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        name: formData.name
      });

      // 3. Update Global Store
      setUserName(formData.name);

      // 4. Log Activity
      await logActivity({
        userId: user.uid,
        userName: formData.name,
        userEmail: user.email || '-',
        storeId: storeId || 'unknown',
        action: 'UPDATE_PROFILE',
        description: `Mengubah nama tampilan profil menjadi: ${formData.name}`
      });

      toast.success('Profil berhasil diperbaharui!');
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal memperbaharui profil: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Konfirmasi kata sandi baru tidak cocok');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('Kata sandi baru minimal 6 karakter');
      return;
    }

    setIsChangingPassword(true);

    try {
      // Re-authenticate
      const credential = EmailAuthProvider.credential(user.email, passwordForm.oldPassword);
      await reauthenticateWithCredential(user, credential);

      // Update Password
      await updatePassword(user, passwordForm.newPassword);

      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Kata sandi berhasil diubah!');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password') {
        toast.error('Kata sandi lama salah');
      } else {
        toast.error('Gagal mengubah kata sandi: ' + err.message);
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-accent animate-spin" />
        <p className="text-sm font-bold text-app-text-muted animate-pulse uppercase tracking-widest">Memuat Profil...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Profil */}
      <div className="relative overflow-hidden bg-surface border border-app-border rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-black/20">
        <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[120%] bg-accent/5 blur-[100px] pointer-events-none rounded-full"></div>
        <div className="relative flex flex-col md:flex-row items-center gap-8">
          <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center text-foreground shadow-2xl shadow-accent/40 border-4 border-white/10 shrink-0">
            <UserIcon size={64} className="drop-shadow-lg" />
          </div>
          <div className="flex-1 text-center md:text-left space-y-1">
            <h1 className="text-3xl font-black text-foreground tracking-tight">{userName || user?.displayName || 'User'}</h1>
            <p className="text-app-text-muted font-bold tracking-widest uppercase text-xs flex items-center justify-center md:justify-start gap-2">
              <Shield size={14} className="text-accent" /> {role || 'Staff'} • {storeName || 'Toko Kasir'}
            </p>
            <p className="text-sm text-app-text-muted/80 font-medium pt-2">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Form Informasi Personal */}
        <div className="bg-surface border border-app-border rounded-[2.5rem] p-8 shadow-xl shadow-black/10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <UserCircle size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground uppercase tracking-widest">Informasi Personal</h2>
              <p className="text-[10px] text-app-text-muted font-bold">Perbarui nama tampilan Anda di sistem.</p>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-2 italic">Nama Lengkap / Tampilan</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent transition-all"
                placeholder="Masukkan nama baru..."
              />
            </div>

            <div className="space-y-2 opacity-60 cursor-not-allowed">
              <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-2">Alamat Email (Permanen)</label>
              <div className="relative">
                <input
                  type="email"
                  disabled
                  value={formData.email}
                  className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold cursor-not-allowed italic"
                />
                <Mail size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-app-text-muted" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full flex justify-center items-center gap-3 py-4 bg-accent hover:bg-accent-hover text-foreground rounded-2xl font-black shadow-xl shadow-accent/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={18} />}
              {isSaving ? 'MENYIMPAN...' : 'SIMPAN PERUBAHAN'}
            </button>
          </form>
        </div>

        {/* Form Ganti Password */}
        <div className="bg-surface border border-app-border rounded-[2.5rem] p-8 shadow-xl shadow-black/10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
              <Key size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground uppercase tracking-widest">Keamanan Akun</h2>
              <p className="text-[10px] text-app-text-muted font-bold">Ganti kata sandi secara berkala agar aman.</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-2 italic">Kata Sandi LAMA</label>
              <input
                type="password"
                required
                value={passwordForm.oldPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-rose-500 transition-all"
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-2 italic">Kata Sandi BARU</label>
              <input
                type="password"
                required
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent transition-all"
                placeholder="Min. 6 karakter"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-2 italic">Ulangi Sandi BARU</label>
              <input
                type="password"
                required
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent transition-all"
                placeholder="Konfirmasi sandi baru"
              />
            </div>

            <button
              type="submit"
              disabled={isChangingPassword}
              className="w-full flex justify-center items-center gap-3 py-4 bg-surface border border-app-border hover:bg-rose-500 hover:border-rose-500 hover:text-foreground text-app-text-muted rounded-2xl font-black transition-all active:scale-95 disabled:opacity-50 mt-2"
            >
              {isChangingPassword ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield size={18} />}
              {isChangingPassword ? 'MEMPROSES...' : 'GANTI KATA SANDI'}
            </button>
          </form>
        </div>
      </div>

      {/* Info Tambahan / Bagian bawah */}
      <div className="p-8 bg-accent/5 border border-accent/10 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h4 className="text-sm font-black text-foreground uppercase tracking-widest">Status Keanggotaan Pro</h4>
            <p className="text-[10px] text-app-text-muted font-bold">Semua fitur aktif dan diperbarui secara otomatis.</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-xs font-black uppercase tracking-widest text-app-text-muted">
           <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Aktif
           </div>
           <div className="w-px h-8 bg-app-border"></div>
           <div className="text-foreground">ID TOKO: {storeId}</div>
        </div>
      </div>
    </div>
  );
}
