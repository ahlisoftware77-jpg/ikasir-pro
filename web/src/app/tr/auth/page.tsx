'use client';

import { useState, useEffect, Suspense } from 'react';
import { auth, db } from '@/lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  User, 
  Lock, 
  Mail, 
  Phone, 
  Loader2, 
  ArrowLeft,
  Globe,
  XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get('s') || (typeof window !== 'undefined' ? localStorage.getItem('last_public_store_id') : null);
  
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [themeColor, setThemeColor] = useState('#10b981');

  useEffect(() => {
    if (searchParams.get('mode') === 'register') {
      setIsLogin(false);
    }
  }, [searchParams]);
  
  // Load Theme Color
  useEffect(() => {
    if (!storeId) return;
    getDoc(doc(db, 'settings', "store_" + storeId))
      .then(snap => {
        if (snap.exists() && snap.data().themeColorHex) {
          setThemeColor(snap.data().themeColorHex);
        }
      })
      .catch(console.error);
  }, [storeId]);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setError('');
    
    const handleSuccess = () => {
      const redirect = searchParams.get('redirect');
      if (redirect === 'checkout') {
        router.push(`/tr?s=${storeId || ''}&open_checkout=true`);
      } else {
        router.push(`/tr?s=${storeId || ''}`);
      }
    };

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          name: user.displayName || 'Pelanggan',
          email: user.email,
          role: 'customer',
          createdAt: new Date().toISOString()
        });
      }

      toast.success("Berhasil masuk dengan Google");
      handleSuccess();
    } catch (err: any) {
      console.error(err);
      setError("Gagal masuk dengan Google");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const handleSuccess = () => {
      const redirect = searchParams.get('redirect');
      if (redirect === 'checkout') {
        router.push(`/tr?s=${storeId || ''}&open_checkout=true`);
      } else {
        router.push(`/tr?s=${storeId || ''}`);
      }
    };

    try {
      if (isLogin) {
        // LOGIN logic
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
        toast.success("Selamat datang kembali!");
      } else {
        // REGISTER logic
        if (formData.password !== formData.confirmPassword) {
          throw new Error("Konfirmasi kata sandi tidak cocok");
        }
        if (!formData.phone) {
          throw new Error("Nomor HP wajib diisi");
        }

        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: formData.name });

        // Save metadata
        await setDoc(doc(db, 'users', user.uid), {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: 'customer',
          createdAt: new Date().toISOString()
        });

        toast.success(isLogin ? "Selamat datang kembali!" : "Pendaftaran berhasil!");
      }

      handleSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError("Email sudah terdaftar");
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError("Email atau kata sandi salah");
      } else {
        setError(err.message || "Terjadi kesalahan");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      style={{ '--tr-color': themeColor } as React.CSSProperties}
      className="min-h-screen bg-[#020617] text-slate-200 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans"
    >
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-tr/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Back Button */}
        <button 
          onClick={() => router.back()}
          className="mb-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
        >
          <div className="w-10 h-10 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center group-hover:bg-slate-800 transition-all">
            <ArrowLeft size={18} />
          </div>
          <span className="text-xs font-black uppercase tracking-widest">Kembali</span>
        </button>

        <div className="mb-10 text-center">
           <h1 className="text-3xl font-black text-white tracking-tighter mb-2 italic">
             {isLogin ? 'SELAMAT ' : 'DAFTAR '}
             <span className="text-tr">{isLogin ? 'DATANG' : 'AKUN'}</span>
           </h1>
           <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">
             {isLogin ? 'Masuk untuk memantau pesanan Anda' : 'Buat akun untuk pengalaman memesan yang lebih baik'}
           </p>
        </div>

        <div className="bg-slate-900/60 border border-white/5 rounded-[2.5rem] p-8 md:p-10 backdrop-blur-3xl shadow-2xl">
           {/* Tab Switcher */}
           <div className="flex bg-slate-950/50 p-1.5 rounded-2xl gap-1 mb-8">
              <button 
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isLogin ? 'bg-tr text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}
              >
                 Masuk
              </button>
              <button 
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isLogin ? 'bg-tr text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}
              >
                 Daftar
              </button>
           </div>

           {error && (
             <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-500 text-[11px] font-bold animate-in shake duration-300">
                <XCircle size={16} />
                {error}
             </div>
           )}

           <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nama Lengkap</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type="text"
                      required
                      placeholder="Masukkan nama Anda"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full pl-12 pr-4 py-4 bg-slate-950/50 border border-white/5 rounded-2xl text-white font-bold text-sm focus:outline-none focus:border-tr transition-all"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    type="email"
                    required
                    placeholder="email@anda.com"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full pl-12 pr-4 py-4 bg-slate-950/50 border border-white/5 rounded-2xl text-white font-bold text-sm focus:outline-none focus:border-tr transition-all"
                  />
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nomor WhatsApp</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type="tel"
                      required
                      placeholder="0812..."
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      className="w-full pl-12 pr-4 py-4 bg-slate-950/50 border border-white/5 rounded-2xl text-white font-bold text-sm focus:outline-none focus:border-tr transition-all"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Kata Sandi</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    type="password"
                    required
                    placeholder={isLogin ? "••••••••" : "Min. 6 karakter"}
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    className="w-full pl-12 pr-4 py-4 bg-slate-950/50 border border-white/5 rounded-2xl text-white font-bold text-sm focus:outline-none focus:border-tr transition-all"
                  />
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Konfirmasi Sandi</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type="password"
                      required
                      placeholder="Ulangi sandi"
                      value={formData.confirmPassword}
                      onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                      className="w-full pl-12 pr-4 py-4 bg-slate-950/50 border border-white/5 rounded-2xl text-white font-bold text-sm focus:outline-none focus:border-tr transition-all"
                    />
                  </div>
                </div>
              )}

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full py-5 mt-4 bg-tr text-slate-950 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-tr/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                 {isLoading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? 'MASUK SEKARANG' : 'DAFTAR AKUN')}
              </button>
           </form>

           <div className="relative my-8 text-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
              <span className="relative bg-[#0b1224] px-4 text-[9px] font-black text-slate-600 uppercase tracking-widest">ATAU</span>
           </div>

           <button 
             onClick={handleGoogleAuth}
             disabled={isLoading}
             className="w-full py-4 border border-white/10 rounded-2xl flex items-center justify-center gap-3 text-xs font-bold hover:bg-white/5 transition-all active:scale-95"
           >
            <svg width="20" height="20" viewBox="0 0 48 48" className="shrink-0">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
              <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
              <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
              <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
            </svg>
              {isLogin ? 'Masuk' : 'Daftar'} dengan Akun Google
           </button>
        </div>
      </div>
    </div>
  );
}

export default function TRAuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-tr animate-spin" />
      </div>
    }>
      <AuthContent />
    </Suspense>
  );
}
