'use client';

import AuthHeader from '@/components/AuthHeader';

import { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingBag, Lock, Mail, Loader2, Store, Users, CheckCircle2, MessageCircle, TrendingUp, Package } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { logActivity } from '@/lib/activity';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useBranding } from '@/context/BrandingContext';
import toast from 'react-hot-toast';

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
        toast.error('Akun belum terdaftar. Silakan lengkapi pendaftaran.');
        router.push('/register');
      }
    } catch (err: any) {
      console.error(err);
      setError('Gagal masuk dengan Google: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AuthHeader />
      <div className="flex min-h-screen w-full bg-surface dark:bg-[#0B0F19] text-foreground font-sans overflow-hidden">
      
      {/* LEFT PANEL - Branding (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden items-center justify-center border-r border-white/5 bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-slate-950 dark:via-slate-900 dark:to-[#0a1017]">
        
        {/* Background glow effects */}
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-emerald-500/20 dark:bg-emerald-500/10 blur-[120px] pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-teal-500/20 dark:bg-teal-500/10 blur-[120px] pointer-events-none" style={{ animationDuration: '4s' }}></div>
        <div className="absolute top-[40%] left-[40%] w-[30%] h-[30%] rounded-full bg-blue-500/10 blur-[80px] pointer-events-none"></div>

        {/* Premium Generated Image Display */}
        <div className="relative w-full max-w-xl flex flex-col items-center justify-center z-10 px-8">
          <div className="relative w-full aspect-square mb-8 animate-float-slow">
            {/* Adding a subtle glow behind the image for more premium feel */}
            <div className="absolute inset-10 bg-emerald-500/20 blur-3xl rounded-full"></div>
            
            <Image 
              src="/hero-ikasir.png" 
              alt="iKasir Pro Premium Mockup" 
              fill
              className="object-contain drop-shadow-2xl scale-110"
              priority
            />
          </div>

          {/* Center Title */}
          <div className="text-center animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-3">
              Supercharge Bisnis Anda
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium max-w-md mx-auto text-sm leading-relaxed">
              Sistem kasir cerdas yang dirancang khusus untuk mempercepat penjualan dan memonitor aset secara real-time.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 relative">
        {/* Mobile Background Elements */}
        <div className="absolute inset-0 lg:hidden overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[80%] h-[80%] rounded-full bg-emerald-500/10 blur-[100px]"></div>
          <div className="absolute bottom-0 left-0 w-[60%] h-[60%] rounded-full bg-teal-500/10 blur-[100px]"></div>
        </div>

        <div className="w-full max-w-[400px] relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
          
          <div className="mb-10 text-center lg:text-left">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-2">
              Selamat Datang 👋
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
              Silakan masuk ke akun Anda untuk melanjutkan.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            
            {error && (
              <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl text-rose-600 dark:text-rose-400 text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-300">
                {error}
              </div>
            )}

            {resetSent && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl text-emerald-600 dark:text-emerald-400 text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-300">
                Silahkan cek pada email Anda, lalu cek inbox atau spam.
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 ml-1" htmlFor="email">Alamat Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-lg">
                  ✉️
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-300 hover:bg-white dark:hover:bg-slate-900"
                  placeholder="admin@kasirpro.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2 ml-1 mr-1">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400" htmlFor="password">Kata Sandi</label>
                <button 
                  type="button" 
                  onClick={handleResetPassword}
                  disabled={isResetting || isLoading}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors disabled:opacity-50"
                >
                  {isResetting ? 'Mengirim...' : 'Lupa Sandi?'}
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-lg grayscale opacity-80">
                  🔒
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-300 hover:bg-white dark:hover:bg-slate-900"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-4 px-6 rounded-2xl shadow-lg shadow-emerald-500/20 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 transition-all duration-300 active:scale-[0.98] disabled:opacity-70 disabled:scale-100 mt-2"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Masuk Sekarang'}
            </button>

            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-slate-200 dark:border-slate-800"></div>
              <span className="px-4 text-xs font-medium text-slate-400 dark:text-slate-500">atau lanjutkan dengan</span>
              <div className="flex-1 border-t border-slate-200 dark:border-slate-800"></div>
            </div>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleGoogleLogin}
              className="w-full flex justify-center items-center gap-3 py-3.5 px-6 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-300 active:scale-[0.98] disabled:opacity-50 shadow-sm"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                  <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                  <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                  <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                  <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                </g>
              </svg>
              Google
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Belum punya akun?{' '}
              <Link 
                href="/register" 
                className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline transition-all"
              >
                Daftar sekarang
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
