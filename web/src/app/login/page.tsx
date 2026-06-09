'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingBag, Lock, Mail, Loader2, Store, Users, CheckCircle2, MessageCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { logActivity } from '@/lib/activity';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useBranding } from '@/context/BrandingContext';

export default function LoginPage() {
  const { branding } = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const router = useRouter();
  const isDemoTriggered = useRef(false);

  // Auto-trigger demo login if ?demo=true in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('demo') === 'true' && !isDemoTriggered.current) {
        isDemoTriggered.current = true;
        handleDemoLogin();
      }
    }
  }, []);

  const handleDemoLogin = async () => {
    setError('');
    setIsLoading(true);
    setEmail('demo@kasirpro.com');
    setPassword('demo123'); // Preset dummy password

    try {
      const userCredential = await signInWithEmailAndPassword(auth, 'demo@kasirpro.com', 'demo123');
      
      // Log Demo Login
      await logActivity({
        userId: userCredential.user.uid,
        userName: 'PENGGUNA DEMO',
        userEmail: 'demo@kasirpro.com',
        storeId: 'demo-store',
        action: 'LOGIN',
        description: 'Masuk sebagai Pengguna Demo'
      });

      router.push('/');
    } catch (err: any) {
      console.error(err);
      setError('Akun Demo belum tersedia. Buat akun demo@kasirpro.com terlebih dahulu via Firebase.');
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Masukkan alamat email Anda terlebih dahulu di kolom atas untuk mereset kata sandi.');
      return;
    }
    setIsResetting(true);
    setError('');
    setResetSent(false);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err: any) {
      console.error(err);
      const errorMap: Record<string, string> = {
        'auth/invalid-email': 'Format email tidak valid.',
        'auth/user-not-found': 'Akun dengan email ini tidak ditemukan.'
      };
      setError(errorMap[err.code] || 'Gagal mengirim email reset: ' + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetSent(false);
    setIsLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Fetch user profile for name, storeId, and status
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      const userData = userDoc.data();

      if (userData) {
         if (userData.isActive === false) {
           await auth.signOut();
           setError('Akses dibekukan: Akun Anda telah dinonaktifkan.');
           setIsLoading(false);
           return;
         }


      }

      // Log Login
      if (userData?.storeId) {
        await logActivity({
          userId: userCredential.user.uid,
          userName: userData?.name || 'User',
          userEmail: email,
          storeId: userData.storeId,
          action: 'LOGIN',
          description: `Masuk ke sistem (${email})`
        });
      }

      router.push('/');
    } catch (err: any) {
      console.error(err.code);
      // Mapping Firebase Auth error codes to user-friendly Indonesian messages
      const errorMap: Record<string, string> = {
        'auth/invalid-email': 'Format email tidak valid.',
        'auth/user-not-found': 'Akun tidak terdaftar.',
        'auth/wrong-password': 'Kata sandi salah. Silakan coba lagi.',
        'auth/invalid-credential': 'Email atau kata sandi salah. Periksa kembali data Anda.',
        'auth/too-many-requests': 'Terlalu banyak percobaan gagal. Silakan coba lagi nanti.',
        'auth/network-request-failed': 'Gagal terhubung. Periksa koneksi internet Anda.',
        'auth/user-disabled': 'Akun ini telah dinonaktifkan.'
      };
      
      setError(errorMap[err.code] || 'Terjadi kesalahan sistem: ' + (err.message || 'Error tidak diketahui'));
    } finally {
      setIsLoading(false);
    }
  };

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

        if (userData?.isActive === false) {
          await auth.signOut();
          setError('Akses dibekukan: Akun Anda telah dinonaktifkan.');
          setIsLoading(false);
          return;
        }



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
      setError('Gagal masuk dengan Google: ' + err.message);
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

  return (
    <div className="flex min-h-screen bg-background items-center justify-center relative overflow-hidden transition-colors duration-500">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-accent/10 blur-[130px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/20 blur-[120px] pointer-events-none delay-1000"></div>

      <div className="w-full max-w-md p-8 relative z-10 animate-in fade-in zoom-in-95 duration-700">
        <div className="mb-10 text-center">
          <div className="inline-flex justify-center items-center w-20 h-20 rounded-3xl bg-gradient-to-br from-accent to-accent-hover shadow-2xl shadow-accent/40 mb-8 border-4 border-white/10">
            <ShoppingBag className="text-foreground w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-foreground mb-3 uppercase italic">
            {branding.appName.split(' ')[0]} <span className="text-accent">{branding.appName.split(' ').slice(1).join(' ')}</span>
          </h1>
          <p className="text-app-text-muted font-bold tracking-wide uppercase text-xs">Modern Point of Sale Ecosystem</p>
        </div>

        <div className="bg-surface/60 border border-app-border rounded-[2.5rem] p-10 shadow-3xl backdrop-blur-2xl transition-colors duration-300">
          <form onSubmit={handleLogin} className="space-y-6">
            
            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-xs font-bold flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-start gap-3">
                  <Lock size={14} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {resetSent && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-500 text-xs font-bold flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                <span>Silahkan cek pada email Anda, lalu cek inbox atau spam.</span>
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-app-text-muted mb-2 uppercase tracking-[0.2em] ml-2" htmlFor="email">Alamat Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-app-text-muted">
                    <Mail size={20} />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-12 pr-4 py-4 border border-app-border rounded-2xl bg-background/50 text-foreground font-bold focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all duration-300"
                    placeholder="admin@kasirpro.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 ml-2">
                  <label className="block text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em]" htmlFor="password">Kata Sandi</label>
                  <button 
                    type="button" 
                    onClick={handleResetPassword}
                    disabled={isResetting || isLoading}
                    className="text-[10px] font-black text-accent hover:text-accent-hover transition-colors italic disabled:opacity-50"
                  >
                    {isResetting ? 'MENGIRIM...' : 'LUPA SANDI?'}
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-app-text-muted">
                    <Lock size={20} />
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-12 pr-4 py-4 border border-app-border rounded-2xl bg-background/50 text-foreground font-bold focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all duration-300"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-4 px-6 border border-transparent rounded-2xl shadow-xl text-sm font-black uppercase tracking-widest text-foreground bg-accent hover:bg-accent-hover focus:outline-none focus:ring-4 focus:ring-accent/20 transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                  <span className="flex items-center gap-2">
                    MASUK KE PANEL <ShoppingBag size={18} className="group-hover:animate-bounce" />
                  </span>
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
                  MASUK DENGAN GOOGLE
                </span>
              </button>

            </div>
          </form>

          <div className="mt-8 pt-8 border-t border-app-border text-center">
            <p className="text-xs text-app-text-muted font-bold mb-4">BELUM PUNYA TOKO?</p>
            <Link 
              href="/register" 
              className="inline-flex items-center gap-2 text-accent hover:text-accent-hover font-black text-xs uppercase tracking-widest transition-all hover:gap-3"
            >
              <Store size={16} /> DAFTAR TOKO BARU SEKARANG
            </Link>
          </div>
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
