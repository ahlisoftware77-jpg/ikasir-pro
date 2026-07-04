'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { 
  User, Mail, Phone, MapPin, Loader2, ArrowLeft, LogOut, Package, Save, CheckCircle2, ShoppingBag, Download, Store
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCart } from '@/context/CartContext';

export default function MarketplaceProfilePage() {
  const router = useRouter();
  const { clearCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUser({ ...currentUser, ...data });
            setFormData({
              name: data.name || currentUser.displayName || '',
              phone: data.phone || '',
              address: data.address || ''
            });
            
            // Sync phone to localstorage for guest cart
            if (data.phone) {
              localStorage.setItem('customer_phone', data.phone);
            }
          } else {
            setUser(currentUser);
            setFormData(prev => ({ ...prev, name: currentUser.displayName || '' }));
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        router.replace('/marketplace/auth');
      }
      setLoading(false);
    });

    return () => unsub();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: formData.name,
        phone: formData.phone,
        address: formData.address
      });
      
      if (formData.phone) {
        localStorage.setItem('customer_phone', formData.phone);
      }
      
      toast.success('Profil berhasil diperbarui!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Gagal memperbarui profil');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Bersihkan state keranjang dan data local marketplace secara langsung
      clearCart();
      localStorage.removeItem('marketplace_cart');
      localStorage.removeItem('customer_name');
      localStorage.removeItem('customer_phone');
      localStorage.removeItem('guest_id');
      localStorage.removeItem('my_orders');
      
      await signOut(auth);
      
      window.location.href = '/marketplace';
    } catch (error) {
      toast.error('Gagal logout');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans pb-20">
      <nav className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/marketplace')} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-base font-black uppercase tracking-wider">Profil Saya</h1>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 transition-colors"
        >
          <LogOut size={16} />
          <span className="text-xs font-bold hidden sm:inline">Keluar</span>
        </button>
      </nav>

      <main className="max-w-2xl mx-auto w-full p-4 flex-1 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Profile Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={formData.name} className="w-full h-full rounded-2xl object-cover" />
            ) : (
              <User size={32} />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">{formData.name || 'Pelanggan'}</h2>
            <div className="flex items-center gap-1.5 text-slate-500 mt-1">
              <Mail size={14} />
              <span className="text-xs font-medium">{user?.email}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => router.push('/marketplace/orders')}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:border-emerald-500 transition-colors shadow-sm"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Package size={20} />
            </div>
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Pesanan Saya</span>
          </button>
          
          <button 
            onClick={() => router.push('/marketplace')}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:border-blue-500 transition-colors shadow-sm"
          >
            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <ShoppingBag size={20} />
            </div>
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Belanja Lagi</span>
          </button>
        </div>

        {/* Download APK Section */}
        <a 
          href="https://bit.ly/ikasirpro"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-emerald-500 hover:bg-emerald-600 border border-emerald-400 dark:border-emerald-600 rounded-3xl p-5 flex items-center justify-between gap-4 transition-all shadow-lg shadow-emerald-500/20 group"
        >
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Unduh Aplikasi Android</h3>
            <p className="text-[10px] text-emerald-100 font-medium mt-1">Install iKasir Pro versi APK untuk pengalaman terbaik.</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/20 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
            <Download size={24} />
          </div>
        </a>

        {/* Seller Dashboard Link */}
        <a 
          href="https://ikasir.my.id"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-blue-600 hover:bg-blue-700 border border-blue-500 dark:border-blue-700 rounded-3xl p-5 flex items-center justify-between gap-4 transition-all shadow-lg shadow-blue-500/20 group"
        >
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Kelola Toko & Produk</h3>
            <p className="text-[10px] text-blue-100 font-medium mt-1">Masuk ke Dashboard Penjual (Admin/Kasir).</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/20 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
            <Store size={24} />
          </div>
        </a>

        {/* Edit Profile Form */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <User size={18} className="text-slate-400" />
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Informasi Pribadi</h3>
          </div>
          
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Nama Lengkap</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><User size={16} /></div>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500 transition-all font-medium"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Nomor WhatsApp</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Phone size={16} /></div>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500 transition-all font-medium"
                  placeholder="0812xxxx (Untuk Notifikasi Pesanan)"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Alamat Pengiriman</label>
              <div className="relative">
                <div className="absolute left-3 top-3 text-slate-400"><MapPin size={16} /></div>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500 transition-all font-medium resize-none"
                  placeholder="Alamat lengkap pengiriman..."
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-slate-900 dark:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-emerald-600 transition-colors disabled:opacity-70 mt-2"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Simpan Perubahan
            </button>
          </form>
        </div>

      </main>
    </div>
  );
}
