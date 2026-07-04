'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Calculator, 
  ClipboardList, 
  Package, 
  Menu, 
  ShoppingCart, 
  PieChart, 
  Users, 
  Settings, 
  ShieldCheck, 
  LogOut, 
  X,
  Palette,
  Sun,
  Moon,
  Cloud,
  Sparkles,
  ChevronRight,
  List, 
  Warehouse, 
  Layers, 
  Tag, 
  ShoppingBag, 
  History, 
  Calendar, 
  BarChart3, 
  TrendingUp, 
  Star, 
  ArrowRightLeft, 
  Archive,
  BookOpen,
  FileText,
  UserCircle,
  HelpCircle,
  MessageSquare
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/context/ThemeContext';
import { useBranding } from '@/context/BrandingContext';

import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { handleExportJSON } from '@/lib/backupUtils';
import toast from 'react-hot-toast';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, user, permissions, newOrderCount, isSubscriptionExpired, disabledMenus, expiredDisabledMenus, subscriptionUntil, storeId } = useAuthStore();
  const { branding } = useBranding();
  const { theme, setTheme } = useTheme();

  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isBackuping, setIsBackuping] = useState(false);
  const [hasPendingSubscription, setHasPendingSubscription] = useState(false);

  const sisaHari = useMemo(() => {
    if (!subscriptionUntil) return null;
    const expiryDate = new Date(subscriptionUntil);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [subscriptionUntil]);

  useEffect(() => {
    if (!storeId || role === 'super-admin' || role === 'superadmin' || role === 'customer') return;
    const q = query(
      collection(db, 'subscription_requests'),
      where('storeId', '==', storeId),
      where('status', '==', 'pending')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHasPendingSubscription(!snapshot.empty);
    });
    return () => unsubscribe();
  }, [storeId, role]);

  const isAdmin = role === 'super-admin' || role === 'superadmin' || role === 'admin';

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      setShowLogoutModal(state?.type === 'nav-logout-modal');
      setIsMoreOpen(state?.type === 'more-modal');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  // MAIN TAB MAPPING
  const mainTabs = [
    { name: 'Beranda', path: '/', icon: '📊', show: (isAdmin || (permissions as any)?.canViewReports) },
    { name: 'Kasir', path: '/pos', icon: '🛒', show: (isAdmin || (permissions as any)?.canAccessPOS) },
    { name: 'Pesanan', path: '/orders', icon: '📦', show: (isAdmin || (permissions as any)?.canManageOrders) },
    { name: 'Transaksi', path: '/transactions', icon: '💰', show: (isAdmin || (permissions as any)?.canAccessPOS) },
  ].filter(t => t.show !== false);

  // Take top 4 max for clean UI, leaving 1 slot for "Lainnya"
  const displayTabs = mainTabs.slice(0, 4);

  // MORE SHEET MAPPING
  const sections = [
    {
      title: '💸 Keuangan & Transaksi',
      show: true,
      items: [
        { name: 'Estimasi Biaya', path: '/estimations', icon: '📋', color: '#10b981', show: (isAdmin || (permissions as any)?.canManageEstimations) },
        { name: 'Hutang Piutang', path: '/debts', icon: '💸', color: '#f43f5e', show: (isAdmin || (permissions as any)?.canManageDebts) },
        { name: 'Riwayat Transaksi', path: '/transactions', icon: '⏳', color: '#3b82f6', show: true },
        { name: 'Notifikasi', path: '#notifications', icon: '🔔', color: '#fbbf24', show: true },
        { name: 'Kotak Sampah', path: '/recycle-bin', icon: '🗑️', color: '#ef4444', show: isAdmin },
      ]
    },
    {
      title: '📦 Manajemen Produk',
      show: (isAdmin || (permissions as any)?.canManageProducts),
      items: [
        { name: 'Daftar Produk', path: '/products', icon: '📦', color: '#8b5cf6', show: true },
        { name: 'Gudang', path: '/products/warehouse', icon: '🏢', color: '#3b82f6', show: true },
        { name: 'Ekstra', path: '/products/extras', icon: '➕', color: '#f59e0b', show: true },
        { name: 'Diskon', path: '/products/discounts', icon: '🏷️', color: '#ec4899', show: true },
        { name: 'Terjual', path: '/products/sold', icon: '🛍️', color: '#10b981', show: true },
        { name: 'Stok', path: '/products/stock-history', icon: '🔄', color: '#06b6d4', show: true },
        { name: 'Expired', path: '/products/expiry', icon: '📅', color: '#ef4444', show: true },
      ]
    },
    {
      title: '📊 Laporan Analitik',
      show: (isAdmin || (permissions as any)?.canViewReports),
      items: [
        { name: 'Laporan Penjualan', path: '/reports/sales', icon: '📊', color: '#3b82f6', show: true },
        { name: 'Laporan Omzet', path: '/reports/monthly', icon: '📈', color: '#10b981', show: true },
        { name: 'Laporan Terlaris', path: '/reports/best-sellers', icon: '🔥', color: '#f97316', show: true },
        { name: 'Arus Kas', path: '/reports/cash-flow', icon: '💰', color: '#fbbf24', show: true },
        { name: 'Pelanggan', path: '/reports/customers', icon: '👥', color: '#6366f1', show: true },
        { name: 'Riwayat Tutup', path: '/reports/cashier-closes', icon: '📥', color: '#64748b', show: true },
      ]
    },
    {
      title: '👥 Operasional & Staff',
      show: true,
      items: [
        { name: 'Shift Karyawan', path: '/shifts', icon: '⏰', color: '#06b6d4', show: (isAdmin || (permissions as any)?.canAccessPOS) },
        { name: 'Staff & User', path: '/users', icon: '👤', color: '#6366f1', show: (isAdmin || (permissions as any)?.canManageUsers) },
        { name: 'Log Aktifitas', path: '/logs', icon: '📝', color: '#64748b', show: (isAdmin || (permissions as any)?.canViewLogs) },
      ]
    },
    {
      title: '🔑 Panel Superadmin',
      show: (role === 'super-admin' || role === 'superadmin' || !!(permissions && (permissions as any).canAccessSuperAdminPanel)),
      items: [
        { name: 'Data User', path: '/super-admin?tab=users', icon: '👥', color: '#f59e0b', show: true },
        { name: 'Kelola Toko', path: '/super-admin?tab=stores', icon: '🏪', color: '#3b82f6', show: true },
        { name: 'Branding', path: '/super-admin?tab=branding', icon: '🎨', color: '#ec4899', show: true },
        { name: 'Infrastruktur', path: '/super-admin?tab=infra', icon: '🗄️', color: '#10b981', show: true },
        { name: 'Langganan', path: '/super-admin?tab=subscriptions', icon: '📄', color: '#8b5cf6', show: true },
        { name: 'Broadcast', path: '/super-admin?tab=broadcast', icon: '📢', color: '#f43f5e', show: true },
        { name: 'Kritik & Saran', path: '/super-admin?tab=feedback', icon: '📩', color: '#a855f7', show: true },
        { name: 'Registrasi', path: '/super-admin?tab=registrations', icon: '🆕', color: '#06b6d4', show: true },
      ]
    },
    {
      title: '⚙️ Akun & Aplikasi',
      show: true,
      items: [
        { name: 'Profil', path: '/profile', icon: '👤', color: '#14b8a6', show: true },
        { name: 'Tema Aplikasi', path: '#theme', icon: '🎨', color: '#64748b', show: true },
        { name: 'Pengaturan Toko', path: '/settings', icon: '⚙️', color: '#3b82f6', show: isAdmin },
        { name: 'Notifikasi BG', path: '#battery', icon: '🔋', color: '#f59e0b', show: true },
        { name: 'Paket Langganan', path: '#subscription', icon: '💎', color: '#8b5cf6', show: true },
        { name: 'Pusat Bantuan', path: 'https://wa.me/6283815862300?text=Halo%20Admin%20iKasir%20Pro%2C%20saya%20membutuhkan%20bantuan%20atau%20informasi%20lebih%20lanjut%20terkait%20penggunaan%20layanan%20aplikasi.%20Terima%20kasih.', icon: '💬', color: '#10b981', show: true },
        { name: 'Kritik & Saran', path: '#feedback', icon: '✉️', color: '#3b82f6', show: true },
        { name: 'Periksa Pembaruan', path: '#update', icon: '🔄', color: '#10b981', show: true },
      ]
    }
  ];

  const themes = [
    { id: 'ocean', name: 'Ocean', color: '#3b82f6', icon: Cloud },
    { id: 'emerald', name: 'Emerald', color: '#10b981', icon: Sun },
    { id: 'purple', name: 'Purple', color: '#8b5cf6', icon: Sparkles },
    { id: 'sunset', name: 'Sunset', color: '#f43f5e', icon: Moon },
    { id: 'light', name: 'Light Blue', color: '#f1f5f9', icon: Sun },
    { id: 'light-emerald', name: 'Light Emerald', color: '#ecfdf5', icon: Sun },
    { id: 'light-purple', name: 'Light Purple', color: '#f5f3ff', icon: Sun },
    { id: 'light-sunset', name: 'Light Rose', color: '#fff1f2', icon: Sun },
  ];

  const openMore = () => {
    setIsMoreOpen(true);
    if (typeof window !== 'undefined') {
      if (window.history.state?.type !== 'more-modal') {
        window.history.pushState({ type: 'more-modal' }, '');
      }
    }
  };

  const closeMore = () => {
    setIsMoreOpen(false);
    setExpandedMenu(null);
    if (typeof window !== 'undefined') {
      if (window.history.state?.type === 'more-modal') {
        window.history.back();
      }
    }
  };

  const openLogout = () => {
    setShowLogoutModal(true);
    if (typeof window !== 'undefined') {
      if (window.history.state?.type !== 'nav-logout-modal') {
        window.history.pushState({ type: 'nav-logout-modal' }, '');
      }
    }
  };

  const closeLogout = () => {
    setShowLogoutModal(false);
    if (typeof window !== 'undefined') {
      if (window.history.state?.type === 'nav-logout-modal') {
        window.history.back();
      }
    }
  };

  const handleLogoutClick = () => {
    setIsMoreOpen(false);
    openLogout();
  };

  const confirmLogout = async (backupFirst: boolean) => {
    if (backupFirst) {
      setIsBackuping(true);
      try {
        if (!user?.uid) {
          throw new Error('User UID tidak valid untuk backup.');
        }
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const storeId = userDoc.data()?.storeId || 'default-store';
        await handleExportJSON(storeId);
      } catch (err) {
        console.error(err);
        toast.error('Gagal mem-backup data. Anda tetap akan dialihkan keluar.');
      } finally {
        setIsBackuping(false);
      }
    }
    await signOut(auth);
    useAuthStore.getState().resetAll();
    
    // Clear marketplace local storage
    localStorage.removeItem('marketplace_cart');
    localStorage.removeItem('customer_name');
    localStorage.removeItem('customer_phone');
    localStorage.removeItem('guest_id');
    localStorage.removeItem('my_orders');
    
    setShowLogoutModal(false);
    if (typeof window !== 'undefined' && window.history.state?.type === 'nav-logout-modal') {
      window.history.back();
    }
  };

  if (pathname.startsWith('/marketplace')) return null;

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-t border-app-border z-40 pb-safe">
        <div className="flex justify-between items-center px-2 py-2">
          {displayTabs.map((tab) => {
            const isActive = pathname === tab.path || (tab.path !== '/' && pathname.startsWith(tab.path + '/'));
            const isSuperAdminBlocked = disabledMenus?.includes(tab.path === '/' ? '/reports' : tab.path);
            const blockedWhenExpired = expiredDisabledMenus || [];
            const isBlocked = (isSubscriptionExpired && blockedWhenExpired.includes(tab.path)) || isSuperAdminBlocked;
            const Icon = tab.icon as any;
            return (
              <Link
                href={isBlocked ? '#' : tab.path}
                key={tab.path}
                onClick={(e) => {
                  if (isBlocked) {
                    e.preventDefault();
                    if (isSuperAdminBlocked) {
                      toast.error('Akses Terkunci. Fitur dinonaktifkan oleh administrator.', { style: { background: '#f43f5e', color: '#fff' } });
                    } else {
                      toast.error('Akses Terkunci. Masa aktif langganan habis.', { style: { background: '#f43f5e', color: '#fff' } });
                    }
                  } else {
                    setIsMoreOpen(false);
                  }
                }}
                className={`flex flex-col items-center justify-center w-full py-1.5 transition-all ${
                  isActive 
                    ? 'text-accent scale-105' 
                    : 'text-app-text-muted hover:text-foreground'
                } ${isBlocked ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className={`p-1.5 rounded-md transition-all relative ${isActive ? 'bg-accent/15' : ''}`}>
                  {typeof tab.icon === 'string' ? (
                    <span className={`text-xl leading-none flex items-center justify-center shrink-0 w-6 h-6 ${isActive ? 'animate-bounce-short' : ''}`}>
                      {tab.icon}
                    </span>
                  ) : (
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'animate-bounce-short' : ''} />
                  )}
                  {tab.path === '/orders' && newOrderCount > 0 && (
                     <div className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-sm border border-surface shadow-sm animate-pulse">
                        {newOrderCount}
                     </div>
                  )}
                </div>
                <span className={`text-[9px] mt-0.5 tracking-wide ${isActive ? 'font-black' : 'font-bold'}`}>
                  {tab.name}
                </span>
              </Link>
            )
          })}
          
          <button
            onClick={openMore}
            className={`flex flex-col items-center justify-center w-full py-1.5 transition-all ${
              isMoreOpen ? 'text-accent scale-105' : 'text-app-text-muted hover:text-foreground'
            }`}
          >
            <div className={`p-1.5 rounded-md transition-all ${isMoreOpen ? 'bg-accent/15' : ''}`}>
              <span className={`text-xl leading-none flex items-center justify-center shrink-0 w-6 h-6 ${isMoreOpen ? 'animate-pulse' : ''}`}>
                ⚙️
              </span>
            </div>
            <span className={`text-[9px] mt-0.5 tracking-wide ${isMoreOpen ? 'font-black' : 'font-bold'}`}>Lainnya</span>
          </button>
        </div>
      </nav>

      {/* MORE / BOTTOM SHEET MODAL */}
      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={closeMore}
          />
          <div className="w-full bg-surface rounded-t-2xl shadow-2xl relative z-10 animate-in slide-in-from-bottom duration-300 max-h-[85vh] flex flex-col overflow-hidden">
            {/* Top Sheet Header */}
            <div className="flex justify-between items-center p-5 border-b border-app-border bg-surface shrink-0">
               <h2 className="text-sm font-black text-foreground tracking-widest uppercase italic">Menu Lainnya</h2>
               <button 
                 onClick={closeMore}
                 className="w-8 h-8 rounded-md bg-app-border flex items-center justify-center text-app-text-muted hover:text-foreground hover:bg-background border border-transparent hover:border-foreground/10"
               >
                 <X size={16} />
               </button>
            </div>

            {/* Scrollable Sheet Content */}
            <div className="overflow-y-auto px-5 py-4 space-y-6 relative pb-24 max-h-[75vh]">
              {/* Profile Card Header (identical to mobile app) */}
              <div 
                className="p-4 rounded-3xl border flex items-center justify-between bg-surface border-app-border"
              >
                <div className="flex items-center gap-4 flex-1 overflow-hidden">
                  <div 
                    className="w-12 h-12 rounded-full items-center justify-center flex bg-accent/20 text-accent font-black shrink-0"
                  >
                    {user?.email?.[0].toUpperCase()}
                  </div>
                  <div className="flex-1 overflow-hidden text-left">
                    <h3 className="text-sm font-black text-foreground truncate">
                      {user?.displayName || user?.email?.split('@')[0]}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
                      {role === 'admin' ? 'Owner (Admin)' : role}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={handleLogoutClick}
                  className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 hover:bg-rose-500 hover:text-white active:scale-95 transition-all"
                >
                  <LogOut size={16} />
                </button>
              </div>

              {/* Account Expiry Bar (identical to mobile app) */}
              {role !== 'super-admin' && role !== 'superadmin' && role !== 'customer' && (
                <div className="w-full">
                  <div 
                    className="w-full rounded-2xl py-3 px-4 border flex items-center justify-between bg-background/50 border-app-border"
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isSubscriptionExpired ? 'bg-rose-500 animate-pulse' : (hasPendingSubscription ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500')}`} />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-foreground">Masa Aktif Akun</p>
                        <p className="font-bold text-[9px] mt-0.5 text-app-text-muted">
                          {isSubscriptionExpired ? 'Berakhir pada ' : 'Berlaku s/d '} 
                          {subscriptionUntil ? new Date(subscriptionUntil).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                        </p>
                      </div>
                    </div>
                    {hasPendingSubscription ? (
                      <div className="bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 shrink-0">
                        <span className="text-[8px] font-black uppercase text-amber-500">
                          Menunggu Verifikasi
                        </span>
                      </div>
                    ) : (
                      sisaHari !== null && (
                        <div className={`px-2.5 py-1 rounded-lg border shrink-0 ${sisaHari <= 7 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                          <span className={`text-[8px] font-black uppercase tracking-wider ${sisaHari <= 7 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {sisaHari <= 0 ? 'Habis' : `${sisaHari} Hari`}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Grid Sections (Keuangan, Produk, Laporan, Operasional, Superadmin, Akun) */}
              {sections.map(section => {
                if (!section.show) return null;
                const visibleItems = section.items.filter(item => item.show !== false);
                if (visibleItems.length === 0) return null;

                return (
                  <div key={section.title} className="space-y-3 text-left">
                    <h3 className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] pl-1">
                      {section.title}
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      {visibleItems.map(item => {
                        const isSuperAdminBlocked = item.path.startsWith('/') ? disabledMenus?.includes(item.path) : false;
                        const blockedWhenExpired = expiredDisabledMenus || [];
                        const isExpiredBlockedComputed = item.path.startsWith('/') ? (isSubscriptionExpired && blockedWhenExpired.includes(item.path)) : false;
                        const isDisabled = isExpiredBlockedComputed || isSuperAdminBlocked;

                        return (
                          <button
                            key={item.name}
                            onClick={() => {
                              if (isSuperAdminBlocked) {
                                toast.error('Akses Terkunci. Fitur dinonaktifkan oleh administrator.', { style: { background: '#f43f5e', color: '#fff' } });
                                return;
                              }
                              if (isExpiredBlockedComputed) {
                                toast.error('Akses Terkunci. Masa aktif langganan habis.', { style: { background: '#f43f5e', color: '#fff' } });
                                return;
                              }
                              
                              if (item.path === '#theme') {
                                const el = document.getElementById('theme-visual-section');
                                if (el) {
                                  el.scrollIntoView({ behavior: 'smooth' });
                                }
                                return;
                              }

                              if (item.path === '#battery') {
                                alert("Notifikasi Latar Belakang PWA:\n\nAgar tetap berjalan di latar belakang, pastikan izin Notifikasi browser telah diizinkan dan batasan hemat daya browser dinonaktifkan di Pengaturan Android Anda.");
                                return;
                              }

                              if (item.path === '#update') {
                                toast.loading('Memeriksa pembaruan...', { id: 'update-pwa-toast' });
                                setTimeout(() => {
                                  toast.success('Aplikasi Web sudah menggunakan versi terbaru (v1.0.1)', { id: 'update-pwa-toast' });
                                }, 1000);
                                return;
                              }

                              if (item.path === '#subscription') {
                                setIsMoreOpen(false);
                                window.dispatchEvent(new CustomEvent('open-subscription-modal'));
                                return;
                              }

                              if (item.path === '#feedback') {
                                const isSuperAdmin = role === 'super-admin' || role === 'superadmin';
                                if (isSuperAdmin) {
                                  setIsMoreOpen(false);
                                  setExpandedMenu(null);
                                  router.push('/super-admin?tab=feedback');
                                } else {
                                  setIsMoreOpen(false);
                                  window.dispatchEvent(new CustomEvent('open-feedback-modal'));
                                }
                                return;
                              }

                              if (item.path === '#notifications') {
                                setIsMoreOpen(false);
                                window.dispatchEvent(new CustomEvent('open-notifications-modal'));
                                return;
                              }

                              if (item.path.startsWith('http')) {
                                closeMore();
                                window.open(item.path, '_blank');
                                return;
                              }

                              setIsMoreOpen(false);
                              setExpandedMenu(null);
                              router.push(item.path);
                            }}
                            className={`aspect-square flex flex-col items-center justify-center p-2 rounded-2xl border transition-all ${
                              isDisabled 
                                ? 'opacity-40 cursor-not-allowed' 
                                : 'bg-surface border-app-border hover:border-accent/30 active:scale-95'
                            }`}
                          >
                            <div 
                              className="w-10 h-10 rounded-xl flex items-center justify-center mb-1.5 shrink-0"
                              style={{ backgroundColor: `${item.color}15` }}
                            >
                              <span className="text-xl leading-none flex items-center justify-center shrink-0">
                                {item.icon}
                              </span>
                            </div>
                            <span className="text-[9px] font-black text-center text-foreground leading-tight line-clamp-2">
                              {item.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Theme Selector (integrated from old UI but kept clean) */}
              <div id="theme-visual-section" className="pt-4 border-t border-app-border relative text-left">
                 <div className="mb-3 text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                   <Palette size={12} /> TEMA VISUAL
                 </div>
                 <div className="grid grid-cols-4 gap-2">
                   {themes.map(t => (
                     <button
                       key={t.id}
                       onClick={() => {
                         setTheme(t.id as any);
                         setTimeout(() => closeMore(), 300);
                       }}
                       className={`aspect-square rounded-md flex items-center justify-center transition-all border ${
                         theme === t.id 
                           ? 'ring-1 ring-accent ring-offset-1 ring-offset-surface scale-[1.05] shadow-sm border-transparent' 
                           : 'opacity-40 hover:opacity-100 hover:scale-105 border-transparent'
                       } ${t.id.startsWith('light') ? 'border-app-border' : ''}`}
                       style={{ backgroundColor: t.color }}
                     >
                       <t.icon size={14} className={t.id.startsWith('light') ? 'text-accent' : 'text-white drop-shadow-md'} />
                     </button>
                   ))}
                 </div>
              </div>

              {/* App Version Info */}
              <p className="text-[9px] text-center text-app-text-muted font-bold pt-4">
                iKasir Pro v1.0.1 • Web Android / PWA
              </p>
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-surface border border-app-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 relative">
              <div className="bg-rose-500 w-full h-32 flex items-center justify-center relative overflow-hidden">
                 <LogOut className="w-16 h-16 text-white drop-shadow-lg relative z-10" />
                 <div className="absolute inset-0 bg-gradient-to-t from-rose-600 to-transparent"></div>
              </div>
              <div className="p-8 pb-10 text-center">
                 <h2 className="text-2xl font-black text-foreground tracking-tight mb-2">Konfirmasi Keluar</h2>
                 <p className="text-app-text-muted text-sm font-medium leading-relaxed mb-8">
                   Sangat disarankan untuk <strong className="text-foreground">mencadangkan data</strong> (Backup) sebelum keluar agar aman dari risiko kehilangan data di perangkat.
                 </p>
                 <div className="space-y-3">
                   <button 
                     onClick={() => confirmLogout(true)}
                     disabled={isBackuping}
                     className="w-full py-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-black tracking-widest text-[11px] uppercase shadow-sm transition-all flex justify-center items-center gap-2 border border-emerald-600"
                   >
                     {isBackuping ? 'MEM-BACKUP...' : 'BACKUP & KELUAR'}
                   </button>
                   <button 
                     onClick={() => confirmLogout(false)}
                     disabled={isBackuping}
                     className="w-full py-4 rounded-lg bg-surface border border-rose-500 hover:bg-rose-50 text-rose-500 font-black tracking-widest text-[11px] uppercase transition-all flex justify-center items-center gap-2"
                   >
                     KELUAR TANPA BACKUP
                   </button>
                   <button 
                     onClick={closeLogout}
                     disabled={isBackuping}
                     className="w-full py-3 text-app-text-muted font-bold text-xs hover:text-foreground mt-4"
                   >
                     Batal
                   </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </>
  );
}
