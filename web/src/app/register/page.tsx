'use client';

import AuthHeader from '@/components/AuthHeader';

import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
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
import { useEffect } from 'react';

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

  // Otomatis tangkap user yang login via Google tapi belum terdaftar di Firestore
  useEffect(() => {
    let unsub: () => void;
    import('firebase/auth').then(({ onAuthStateChanged }) => {
      unsub = onAuthStateChanged(auth, async (user) => {
        if (user) {
          const { doc, getDoc } = await import('firebase/firestore');
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (!userDoc.exists()) {
            setGoogleUser(user);
            setShowGoogleModal(true);
          }
        }
      });
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

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
      const { doc, getDoc, setDoc, addDoc, collection } = await import('firebase/firestore');
      
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

      // Rekam Pendataan Pendaftaran
      await setDoc(doc(db, 'registrations', storeId), {
        ownerName: userName,
        storeName: storeName,
        email: googleUser.email,
        phone: phone,
        createdAt: new Date().toISOString(),
        method: 'google',
        platform: 'web',
        storeId: storeId
      });

      // Kirim Notifikasi Superadmin
      await addDoc(collection(db, 'superadmin_notifications'), {
        title: 'Pendaftaran Baru (Google)',
        message: `Toko "${storeName}" (${userName}) terdaftar via Web.`,
        createdAt: new Date().toISOString(),
        type: 'registration',
        read: false,
        registrationId: storeId
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

      // Rekam Pendataan Pendaftaran
      await setDoc(doc(db, 'registrations', storeId), {
        ownerName: formData.ownerName,
        storeName: formData.storeName,
        email: formData.email,
        phone: '-',
        createdAt: new Date().toISOString(),
        method: 'email',
        platform: 'web',
        storeId: storeId
      });

      // Kirim Notifikasi Superadmin
      await addDoc(collection(db, 'superadmin_notifications'), {
        title: 'Pendaftaran Baru (Email)',
        message: `Toko "${formData.storeName}" (${formData.ownerName}) terdaftar via Web.`,
        createdAt: new Date().toISOString(),
        type: 'registration',
        read: false,
        registrationId: storeId
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
    <>
      <AuthHeader />
      <div className="flex min-h-screen w-full bg-surface dark:bg-[#0B0F19] text-foreground font-sans overflow-hidden">
      
      {/* LEFT PANEL - Branding (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden items-center justify-center border-r border-white/5 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-slate-900 dark:to-slate-950">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/20 blur-[120px] pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-teal-500/20 blur-[120px] pointer-events-none delay-1000"></div>

        {/* Claymorphism 3D Animation Container */}
        <div className="relative w-full max-w-xl flex flex-col items-center justify-center z-10 px-8">
          
          <div className="relative w-full h-[400px] flex items-center justify-center mb-8">
            
            {/* Clay Store Building - Center */}
            <div className="absolute z-20 w-[240px] h-[300px] bg-teal-500 dark:bg-teal-600 rounded-[40px] animate-float-slow flex flex-col items-center justify-start pt-6 px-4
              shadow-[16px_16px_32px_rgba(0,0,0,0.15),_-16px_-16px_32px_rgba(255,255,255,0.4),_inset_4px_4px_10px_rgba(255,255,255,0.6),_inset_-4px_-4px_10px_rgba(0,0,0,0.2)]
              dark:shadow-[16px_16px_32px_rgba(0,0,0,0.4),_-16px_-16px_32px_rgba(255,255,255,0.05),_inset_4px_4px_10px_rgba(255,255,255,0.3),_inset_-4px_-4px_10px_rgba(0,0,0,0.3)]">
              
              {/* Store Awning */}
              <div className="w-[110%] h-16 bg-red-400 rounded-t-3xl rounded-b-xl mb-4 flex overflow-hidden shadow-[0_8px_16px_rgba(0,0,0,0.2),_inset_2px_2px_6px_rgba(255,255,255,0.5),_inset_-2px_-2px_6px_rgba(0,0,0,0.2)]">
                <div className="w-1/4 h-full bg-red-300"></div>
                <div className="w-1/4 h-full bg-red-400"></div>
                <div className="w-1/4 h-full bg-red-300"></div>
                <div className="w-1/4 h-full bg-red-400"></div>
              </div>
              
              {/* Store Window */}
              <div className="w-full flex-1 bg-sky-200 dark:bg-sky-900/50 rounded-2xl mb-4 p-3 flex flex-wrap gap-2 justify-center content-start shadow-[inset_4px_4px_8px_rgba(0,0,0,0.1),_inset_-4px_-4px_8px_rgba(255,255,255,0.6)] dark:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.3),_inset_-4px_-4px_8px_rgba(255,255,255,0.1)] border border-white/20">
                <div className="w-12 h-16 bg-white/60 dark:bg-slate-700/60 rounded-xl shadow-sm"></div>
                <div className="w-12 h-16 bg-white/60 dark:bg-slate-700/60 rounded-xl shadow-sm"></div>
                <div className="w-12 h-16 bg-white/60 dark:bg-slate-700/60 rounded-xl shadow-sm"></div>
                <div className="w-full h-8 bg-white/40 dark:bg-slate-800/40 rounded-lg mt-2 shadow-inner"></div>
              </div>
              
              {/* Door/Entrance */}
              <div className="w-16 h-20 bg-slate-100 dark:bg-slate-800 rounded-t-2xl shadow-[inset_2px_2px_5px_rgba(0,0,0,0.1)] flex justify-center pt-2 border-t-4 border-l-4 border-r-4 border-teal-400 dark:border-teal-700">
                <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 self-center ml-8"></div>
              </div>
            </div>

            {/* Clay User Profile Card - Top Right */}
            <div className="absolute z-30 -right-6 top-6 w-32 h-40 bg-[#f8fafc] dark:bg-[#1e293b] rounded-[24px] animate-float-medium transform rotate-12 flex flex-col items-center p-4
              shadow-[12px_12px_24px_rgba(0,0,0,0.1),_-12px_-12px_24px_rgba(255,255,255,0.8),_inset_2px_2px_6px_rgba(255,255,255,1),_inset_-2px_-2px_6px_rgba(0,0,0,0.05)]
              dark:shadow-[12px_12px_24px_rgba(0,0,0,0.4),_-12px_-12px_24px_rgba(255,255,255,0.05),_inset_2px_2px_6px_rgba(255,255,255,0.2),_inset_-2px_-2px_6px_rgba(0,0,0,0.2)]">
              <div className="relative w-16 h-16 bg-indigo-400 rounded-full mb-3 shadow-inner flex items-center justify-center border-4 border-white dark:border-slate-700 overflow-hidden">
                <div className="w-6 h-6 bg-white/80 rounded-full mb-4"></div>
                <div className="w-10 h-6 bg-white/80 rounded-t-full absolute bottom-0"></div>
              </div>
              <div className="w-16 h-2.5 rounded-full bg-slate-200 dark:bg-slate-600 mb-2"></div>
              <div className="w-10 h-2 rounded-full bg-slate-100 dark:bg-slate-700"></div>
            </div>

            {/* Clay Checklist Card - Bottom Left */}
            <div className="absolute z-30 -left-6 bottom-8 w-32 h-36 bg-amber-100 dark:bg-amber-900/40 rounded-[24px] animate-float-slow transform -rotate-6 flex flex-col p-4
              shadow-[12px_12px_24px_rgba(0,0,0,0.1),_-12px_-12px_24px_rgba(255,255,255,0.8),_inset_2px_2px_6px_rgba(255,255,255,1),_inset_-2px_-2px_6px_rgba(0,0,0,0.05)]
              dark:shadow-[12px_12px_24px_rgba(0,0,0,0.4),_-12px_-12px_24px_rgba(255,255,255,0.05),_inset_2px_2px_6px_rgba(255,255,255,0.1),_inset_-2px_-2px_6px_rgba(0,0,0,0.2)]" style={{ animationDelay: '1.5s' }}>
              <div className="w-full h-3 rounded-full bg-amber-200 dark:bg-amber-700 mb-4"></div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-4 h-4 rounded bg-emerald-400 flex items-center justify-center text-white text-[8px] font-bold">✓</div>
                <div className="w-16 h-2 rounded-full bg-slate-200 dark:bg-slate-600"></div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-4 h-4 rounded bg-emerald-400 flex items-center justify-center text-white text-[8px] font-bold">✓</div>
                <div className="w-12 h-2 rounded-full bg-slate-200 dark:bg-slate-600"></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-2 border-slate-300 dark:border-slate-500 bg-white/50 dark:bg-transparent"></div>
                <div className="w-14 h-2 rounded-full bg-slate-200 dark:bg-slate-600"></div>
              </div>
            </div>
            
            {/* Clay Rocket / Badge - Top Left */}
            <div className="absolute z-10 -left-2 top-10 w-20 h-20 bg-emerald-400 rounded-3xl animate-float-fast transform -rotate-12 flex items-center justify-center
              shadow-[8px_8px_16px_rgba(0,0,0,0.15),_-8px_-8px_16px_rgba(255,255,255,0.4),_inset_4px_4px_8px_rgba(255,255,255,0.5),_inset_-4px_-4px_8px_rgba(0,0,0,0.2)]
              dark:shadow-[8px_8px_16px_rgba(0,0,0,0.4),_-8px_-8px_16px_rgba(255,255,255,0.05),_inset_4px_4px_8px_rgba(255,255,255,0.3),_inset_-4px_-4px_8px_rgba(0,0,0,0.3)]">
              <span className="text-4xl filter drop-shadow-sm">🚀</span>
            </div>

            {/* Clay Chart - Bottom Right */}
            <div className="absolute z-10 right-4 bottom-0 w-28 h-28 bg-rose-400 rounded-[28px] animate-float-medium transform rotate-6 flex items-end justify-center gap-2 p-4
              shadow-[10px_10px_20px_rgba(0,0,0,0.15),_-10px_-10px_20px_rgba(255,255,255,0.4),_inset_4px_4px_10px_rgba(255,255,255,0.5),_inset_-4px_-4px_10px_rgba(0,0,0,0.2)]
              dark:shadow-[10px_10px_20px_rgba(0,0,0,0.4),_-10px_-10px_20px_rgba(255,255,255,0.05),_inset_4px_4px_10px_rgba(255,255,255,0.3),_inset_-4px_-4px_10px_rgba(0,0,0,0.3)]" style={{ animationDelay: '0.5s' }}>
              <div className="w-4 bg-white/90 rounded-t-lg shadow-sm" style={{ height: '30%' }}></div>
              <div className="w-4 bg-white/90 rounded-t-lg shadow-sm" style={{ height: '60%' }}></div>
              <div className="w-4 bg-white rounded-t-lg shadow-md" style={{ height: '90%' }}></div>
            </div>

          </div>

          {/* Center Title */}
          <div className="text-center animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300 z-40 relative">
            <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white mb-4">
              Mulai Perjalanan Bisnis Anda
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto text-lg leading-relaxed">
              Daftar sekarang dan nikmati semua fitur manajemen toko dalam satu genggaman.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 relative overflow-y-auto bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:via-blue-950/40 dark:to-[#0B0F19] shadow-[-10px_0_30px_rgba(0,0,0,0.05)] dark:shadow-[-20px_0_40px_rgba(0,0,0,0.4)] z-20">
        {/* Mobile Background Elements */}
        <div className="absolute inset-0 lg:hidden overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[80%] h-[80%] rounded-full bg-emerald-500/10 blur-[100px]"></div>
          <div className="absolute bottom-0 left-0 w-[60%] h-[60%] rounded-full bg-teal-500/10 blur-[100px]"></div>
        </div>

        <div className="w-full max-w-[500px] relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700 py-10">
          
          <div className="mb-10 text-center lg:text-left">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-2">
              Daftar Akun Baru ✨
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
              Lengkapi data di bawah ini untuk membuat toko Anda.
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-6">
            
            {error && (
              <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl text-rose-600 dark:text-rose-400 text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-300">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Nama Lengkap</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-lg">
                    👤
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Nama Anda"
                    value={formData.ownerName}
                    onChange={(e) => setFormData({...formData, ownerName: e.target.value})}
                    className="block w-full pl-12 pr-4 py-3 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-300 hover:bg-white dark:hover:bg-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Nama Toko</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-lg">
                    🏪
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Toko Anda"
                    value={formData.storeName}
                    onChange={(e) => setFormData({...formData, storeName: e.target.value})}
                    className="block w-full pl-12 pr-4 py-3 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 backdrop-blur-sm text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                  />
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Alamat Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-lg">
                    ✉️
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="email@contoh.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="block w-full pl-12 pr-4 py-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-300 hover:bg-white dark:hover:bg-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Kata Sandi</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-lg grayscale opacity-80 group-focus-within:grayscale-0 group-focus-within:opacity-100 transition-all">
                    🔒
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Minimal 6 karakter"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="block w-full pl-12 pr-12 py-3 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-300 hover:bg-white dark:hover:bg-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-emerald-500 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Ulangi Sandi</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-lg grayscale opacity-80 group-focus-within:grayscale-0 group-focus-within:opacity-100 transition-all">
                    🔒
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    placeholder="Ulangi kata sandi"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    className="block w-full pl-12 pr-12 py-3 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-300 hover:bg-white dark:hover:bg-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-emerald-500 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-4 px-6 rounded-2xl shadow-lg shadow-emerald-500/20 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 transition-all duration-300 active:scale-[0.98] disabled:opacity-70 disabled:scale-100 mt-4"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buat Akun Toko Sekarang'}
            </button>

            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-slate-200 dark:border-slate-800"></div>
              <span className="px-4 text-xs font-medium text-slate-400 dark:text-slate-500">atau daftar instan dengan</span>
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
              Daftar dengan Google
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sudah punya akun?{' '}
              <Link 
                href="/login" 
                className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline transition-all"
              >
                Masuk di sini
              </Link>
            </p>
          </div>
        </div>
      </div>

      {showGoogleModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-500 relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[60px] pointer-events-none"></div>
            
            <div className="text-center mb-8 relative z-10">
              <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-4 border-4 border-emerald-100 dark:border-emerald-900/50 shadow-lg">
                {googleUser?.photoURL ? (
                  <img src={googleUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-3xl">
                    👤
                  </div>
                )}
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Halo, {googleUser?.displayName?.split(' ')[0]}! 👋</h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">
                Satu langkah lagi. Lengkapi profil toko Anda untuk mulai mengelola bisnis.
              </p>
            </div>

            <div className="space-y-4 mb-8 relative z-10">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 ml-1">Nama Toko Anda</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-lg">🏪</div>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="block w-full pl-12 pr-4 py-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    placeholder="Misal: Toko Sejahtera"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 ml-1">Nomor WhatsApp</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-lg">📱</div>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="block w-full pl-12 pr-4 py-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    placeholder="0812xxxxxxxx"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 relative z-10">
              <button
                onClick={() => {
                  setShowGoogleModal(false);
                  if (auth.currentUser) auth.signOut();
                }}
                className="flex-1 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={submitGoogleRegistration}
                disabled={isLoading}
                className="flex-[2] py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all active:scale-95"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Selesaikan Pendaftaran'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
