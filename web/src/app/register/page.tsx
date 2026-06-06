'use client';

import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { 
  ShoppingBag, 
  User, 
  Lock, 
  Mail, 
  Building2, 
  Loader2, 
  CheckCircle2,
  ArrowRight,
  Eye,
  EyeOff,
  Store
} from 'lucide-react';
import Link from 'next/link';
import { logActivity } from '@/lib/activity';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    ownerName: '',
    email: '',
    password: '',
    confirmPassword: '',
    storeName: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError('');
      const provider = new (await import('firebase/auth')).GoogleAuthProvider();
      const { signInWithPopup } = await import('firebase/auth');
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      const { doc, getDoc } = await import('firebase/firestore');
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData?.storeId) {
          await logActivity({
            userId: user.uid,
            userName: userData?.name || user.displayName || 'User',
            userEmail: user.email || '',
            storeId: userData.storeId,
            action: 'LOGIN',
            description: `Masuk via Google (${user.email})`
          });
        }
        router.push('/');
      } else {
        setGoogleUser(user);
        setShowGoogleModal(true);
      }
    } catch (err: any) {
      console.error(err);
      setError('Gagal mendaftar dengan Google: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const submitGoogleRegistration = async () => {
    if (!storeName || !phone) {
      setError('Harap isi Nama Toko dan Nomor HP.');
      return;
    }
    setIsLoading(true);
    try {
      const { doc, getDoc, setDoc } = await import('firebase/firestore');
      
      let baseStoreId = storeName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      if (!baseStoreId) baseStoreId = 'store';
      
      let storeId = baseStoreId;
      let counter = 0;
      while (true) {
         const storeSnap = await getDoc(doc(db, 'stores', storeId));
         if (!storeSnap.exists()) break;
         counter++;
         storeId = `${baseStoreId}-${counter}`;
      }

      const userName = googleUser.displayName || 'Pengguna Baru';

      await setDoc(doc(db, 'stores', storeId), {
        name: storeName,
        ownerEmail: googleUser.email,
        ownerUid: googleUser.uid,
        createdAt: new Date().toISOString(),
        isActive: true,
        package: 'trial'
      });

      await setDoc(doc(db, 'users', googleUser.uid), {
        name: userName,
        email: googleUser.email,
        phone: phone,
        role: 'admin',
        storeId: storeId,
        isActive: true,
        isSubscribed: true,
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      });

      await setDoc(doc(db, 'settings', `store_${storeId}`), {
        storeName: storeName,
        address: 'Alamat Belum Diatur',
        phone: phone,
        useTax: true,
        taxRate: 11,
        receiptMessage: 'Terima kasih telah berbelanja!',
        paperSize: '58mm',
        storeId: storeId
      });

      await logActivity({
        userId: googleUser.uid,
        userName: userName,
        userEmail: googleUser.email,
        storeId: storeId,
        action: 'REGISTER_STORE',
        description: `Mendaftarkan toko baru via Google: ${storeName}`
      });

      window.location.href = '/';
    } catch (err: any) {
      console.error(err);
      setError('Gagal mendaftarkan toko: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Kata sandi dan konfirmasi kata sandi tidak cocok.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Kata sandi minimal harus 6 karakter.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // 2. Generate Store ID (Clean Slug)
      let baseStoreId = formData.storeName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      if (!baseStoreId) baseStoreId = 'store';
      
      let storeId = baseStoreId;
      let counter = 0;
      
      // Loop to find a unique store ID without random strings
      while (true) {
         const storeSnap = await getDoc(doc(db, 'stores', storeId));
         if (!storeSnap.exists()) {
             break; // Found unused ID!
         }
         counter++;
         storeId = `${baseStoreId}-${counter}`;
      }

      // 3. Create Store Document
      await setDoc(doc(db, 'stores', storeId), {
        name: formData.storeName,
        ownerEmail: formData.email,
        ownerUid: user.uid,
        createdAt: new Date().toISOString(),
        isActive: false,
        package: 'trial'
      });

      // 4. Create User Document
      await setDoc(doc(db, 'users', user.uid), {
        name: formData.ownerName,
        email: formData.email,
        role: 'admin',
        storeId: storeId,
        isActive: true,
        isSubscribed: true,
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 days trial
      });

      // 5. Create Default Settings for the Store
      await setDoc(doc(db, 'settings', `store_${storeId}`), {
        storeName: formData.storeName,
        address: 'Alamat Belum Diatur',
        phone: '-',
        useTax: true,
        taxRate: 11,
        receiptMessage: 'Terima kasih telah berbelanja!',
        paperSize: '58mm',
        storeId: storeId
      });

      // Log Registration
      await logActivity({
        userId: user.uid,
        userName: formData.ownerName,
        userEmail: formData.email,
        storeId: storeId,
        action: 'REGISTER_STORE',
        description: `Mendaftarkan toko baru: ${formData.storeName}`
      });

      // 6. Force Full Reload to let AuthProvider catch the new Documents
      window.location.href = '/';
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Email sudah digunakan oleh akun lain.');
      } else {
        setError('Pendaftaran gagal: ' + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background items-center justify-center relative overflow-hidden transition-colors duration-500 py-20">
      {/* Background Ornaments */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-accent/10 blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/20 blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-xl p-8 relative z-10 animate-in fade-in zoom-in-95 duration-700">
        <div className="mb-10 text-center">
          <div className="inline-flex justify-center items-center w-20 h-20 rounded-3xl bg-gradient-to-br from-accent to-accent-hover shadow-2xl shadow-accent/40 mb-8 border-4 border-white/10">
            <ShoppingBag className="text-foreground w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-foreground mb-3">DAFTAR <span className="text-accent">BARU</span></h1>
          <p className="text-app-text-muted font-bold tracking-wide uppercase text-xs">Mulai kelola bisnis Anda dengan IKASIR PRO</p>
        </div>

        <div className="bg-surface/60 border border-app-border rounded-[2.5rem] p-10 shadow-3xl backdrop-blur-2xl transition-colors duration-300">
          <form onSubmit={handleRegister} className="space-y-6">
            
            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-xs font-bold flex items-center gap-3 animate-in shake duration-500">
                 <CheckCircle2 size={16} className="rotate-180" />
                 {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-2 italic">Informasi Personal</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-app-text-muted">
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Nama Lengkap"
                    value={formData.ownerName}
                    onChange={(e) => setFormData({...formData, ownerName: e.target.value})}
                    className="block w-full pl-12 pr-4 py-4 border border-app-border rounded-2xl bg-background/50 text-foreground font-bold focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all duration-300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-2 italic">Informasi Bisnis</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-app-text-muted">
                    <Building2 size={18} />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Nama Toko / Perusahaan"
                    value={formData.storeName}
                    onChange={(e) => setFormData({...formData, storeName: e.target.value})}
                    className="block w-full pl-12 pr-4 py-4 border border-app-border rounded-2xl bg-background/50 text-foreground font-bold focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all duration-300 border-accent/30"
                  />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-2">Email Bisnis</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-app-text-muted">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="email@bisnis.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="block w-full pl-12 pr-4 py-4 border border-app-border rounded-2xl bg-background/50 text-foreground font-bold focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all duration-300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-2">Kata Sandi</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-app-text-muted group-focus-within:text-accent transition-colors">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Minimal 6 karakter"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="block w-full pl-12 pr-12 py-4 border border-app-border rounded-2xl bg-background/50 text-foreground font-bold focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all duration-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-app-text-muted hover:text-accent transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-2">Konfirmasi Sandi</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-app-text-muted group-focus-within:text-accent transition-colors">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    placeholder="Ulangi kata sandi"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    className="block w-full pl-12 pr-12 py-4 border border-app-border rounded-2xl bg-background/50 text-foreground font-bold focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all duration-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-app-text-muted hover:text-accent transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 bg-accent/5 rounded-[2rem] border border-accent/10 space-y-3">
               <h4 className="text-[10px] font-black text-accent uppercase tracking-widest">Apa yang Anda dapatkan?</h4>
               <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-xs font-bold text-foreground/80">
                     <CheckCircle2 size={14} className="text-emerald-500" /> Free Trial selama 14 hari
                  </li>
                  <li className="flex items-center gap-2 text-xs font-bold text-foreground/80">
                     <CheckCircle2 size={14} className="text-emerald-500" /> Data terisolasi aman (Multi-Tenant)
                  </li>
                  <li className="flex items-center gap-2 text-xs font-bold text-foreground/80">
                     <CheckCircle2 size={14} className="text-emerald-500" /> Akses penuh ke semua fitur Pro
                  </li>
               </ul>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-3 py-5 px-6 rounded-2xl shadow-xl text-sm font-black uppercase tracking-widest text-foreground bg-accent hover:bg-accent-hover focus:outline-none focus:ring-4 focus:ring-accent/20 transition-all duration-300 active:scale-95 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                <>MUAT TOKO SAYA <ArrowRight size={20} /></>
              )}
            </button>

            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-app-border"></div>
              <span className="px-4 text-[10px] font-bold text-app-text-muted uppercase tracking-widest">ATAU</span>
              <div className="flex-1 border-t border-app-border"></div>
            </div>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleGoogleLogin}
              className="w-full flex justify-center py-4 px-6 border border-app-border rounded-2xl shadow-sm text-sm font-black uppercase tracking-widest text-foreground bg-surface hover:bg-background focus:outline-none focus:ring-4 focus:ring-app-border transition-all duration-300 active:scale-[0.98] disabled:opacity-50 group"
            >
              <span className="flex items-center gap-3">
                <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                  <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                    <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                    <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                    <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                    <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                  </g>
                </svg>
                DAFTAR DENGAN GOOGLE
              </span>
            </button>

            <div className="text-center pt-6 mt-4 border-t border-app-border">
              <p className="text-xs font-bold text-app-text-muted">
                Sudah memiliki akun? <Link href="/login" className="text-accent hover:underline ml-1 uppercase tracking-widest">Masuk ke Panel</Link>
              </p>
            </div>
          </form>
        </div>
      </div>

      {showGoogleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface border border-app-border rounded-[2rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-4 border-2 border-accent">
                {googleUser?.photoURL ? (
                  <img src={googleUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-accent/20 flex items-center justify-center">
                    <Store size={24} className="text-accent" />
                  </div>
                )}
              </div>
              <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Halo, {googleUser?.displayName?.split(' ')[0]}!</h2>
              <p className="text-xs font-bold text-app-text-muted mt-2 leading-relaxed">
                Ini pertama kalinya Anda masuk. Lengkapi profil toko Anda untuk memulai.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-[10px] font-black text-app-text-muted mb-2 uppercase tracking-[0.2em] ml-2">Nama Toko</label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="block w-full px-4 py-4 border border-app-border rounded-2xl bg-background/50 text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                  placeholder="Misal: Toko Budi Jaya"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-app-text-muted mb-2 uppercase tracking-[0.2em] ml-2">Nomor WhatsApp</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="block w-full px-4 py-4 border border-app-border rounded-2xl bg-background/50 text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                  placeholder="08xxxxxxxxxx"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowGoogleModal(false)}
                className="flex-1 py-4 border border-app-border rounded-2xl font-black text-xs uppercase tracking-widest text-app-text-muted hover:bg-background"
              >
                Batal
              </button>
              <button
                onClick={submitGoogleRegistration}
                disabled={isLoading}
                className="flex-1 py-4 bg-accent text-foreground rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-accent-hover disabled:opacity-50"
              >
                {isLoading ? 'MEMPROSES...' : 'BUAT TOKO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
