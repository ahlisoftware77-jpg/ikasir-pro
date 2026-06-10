'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { 
  LayoutDashboard, Package, ShoppingCart, Users, LogOut, Settings, Calculator, 
  ChevronDown, ChevronUp, Palette, Sun, Moon, Cloud, Sparkles, X, ClipboardList, 
  PieChart, ShieldCheck, List, Warehouse, Layers, Tag, ShoppingBag, History, 
  Calendar, BarChart3, TrendingUp, Star, ArrowRightLeft, Archive, Store, BookOpen,
  FileText,
  UserCircle,
  Bell
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useNotificationStore } from '@/store/notifications';
import { useTheme } from '@/context/ThemeContext';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { handleExportJSON } from '@/lib/backupUtils';
import { doc, getDoc } from 'firebase/firestore';
import { useBranding } from '@/context/BrandingContext';
import toast from 'react-hot-toast';

const menuItems = [
  { name: 'Kasir (POS)', path: '/pos', icon: Calculator, permission: 'canAccessPOS' },
  { name: 'Daftar Pesanan', path: '/orders', icon: ClipboardList, permission: 'canManageOrders' },
  { name: 'Estimasi Biaya', path: '/estimations', icon: FileText, permission: 'canManageEstimations' },
  { name: 'Panel Super Admin', path: '/super-admin', icon: ShieldCheck, superOnly: true },
  { name: 'Shift Karyawan', path: '/shifts', icon: History, permission: 'canAccessPOS' },
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, permission: 'canViewReports' },
  { 
    name: 'Manajemen Produk', 
    path: '/products', 
    icon: Package, 
    permission: 'canManageProducts',
    subItems: [
      { name: 'Daftar Produk', path: '/products', icon: List },
      { name: 'Gudang Stok', path: '/products/warehouse', icon: Warehouse },
      { name: 'Produk Ekstra', path: '/products/extras', icon: Layers },
      { name: 'Diskon Harga', path: '/products/discounts', icon: Tag },
      { name: 'Produk Terjual', path: '/products/sold', icon: ShoppingBag },
      { name: 'Riwayat Stok', path: '/products/stock-history', icon: History },
      { name: 'Masa Berlaku', path: '/products/expiry', icon: Calendar },
    ]
  },
  { name: 'Transaksi', path: '/transactions', icon: ShoppingCart, permission: 'canAccessPOS' },
  { name: 'Hutang Piutang', path: '/debts', icon: BookOpen, permission: 'canManageDebts' },
  { 
    name: 'Laporan', 
    path: '/reports', 
    icon: PieChart, 
    permission: 'canViewReports',
    subItems: [
      { name: 'Transaksi Penjualan', path: '/reports/sales', icon: BarChart3 },
      { name: 'Omzet per Bulan', path: '/reports/monthly', icon: TrendingUp },
      { name: 'Produk Terlaris', path: '/reports/best-sellers', icon: Star },
      { name: 'Arus Kas', path: '/reports/cash-flow', icon: ArrowRightLeft },
      { name: 'Transaksi Pelanggan', path: '/reports/customers', icon: Users },
      { name: 'Riwayat Tutup', path: '/reports/cashier-closes', icon: Archive },
    ]
  },
  { name: 'Manajemen User', path: '/users', icon: Users, permission: 'canManageUsers' },
  { name: 'Log Aktifitas', path: '/logs', icon: ClipboardList, permission: 'canViewLogs' },
  { name: 'Profil Saya', path: '/profile', icon: UserCircle },
  { name: 'Pengaturan', path: '/settings', icon: Settings, permission: 'canEditSettings' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  logoUrl?: string | null;
  onOpenNotifications?: () => void;
}

export default function Sidebar({ isOpen, onClose, logoUrl, onOpenNotifications }: SidebarProps) {
  const pathname = usePathname();
  const { user, role, permissions, newOrderCount, storeName, userName, isSubscriptionExpired } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const { branding } = useBranding();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({ '/products': true });
  const unreadNotifications = useNotificationStore(state => state.getUnreadCount());

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

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isBackuping, setIsBackuping] = useState(false);

  const handleLogout = async () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async (backupFirst: boolean) => {
    if (backupFirst) {
      setIsBackuping(true);
      try {
        // We need storeId. Get it from current user's profile if possible or from auth store.
        // For simplicity, we can fetch it once here or get it from context.
        const userDoc = await getDoc(doc(db, 'users', user?.uid || ''));
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
    setShowLogoutModal(false);
  };

  const toggleMenu = (path: string) => {
    setOpenMenus(prev => ({ ...prev, [path]: !prev[path] }));
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <aside className={`w-64 bg-surface border-r border-app-border text-app-text-muted flex flex-col h-screen fixed top-0 left-0 overflow-y-auto transition-all duration-300 z-50 shadow-none ${
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="h-16 flex items-center px-6 border-b border-app-border shrink-0 sticky top-0 bg-surface z-10 justify-between md:justify-start gap-3">
          <div className="w-8 h-8 rounded-md overflow-hidden border border-app-border shrink-0">
             <img src={logoUrl || '/logo.png'} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-sm font-black text-foreground tracking-tighter uppercase italic truncate flex-1">
            {storeName || branding.appName}
          </h1>
          
          <button 
            onClick={onOpenNotifications}
            className="p-2 mr-1 rounded-lg bg-background hover:bg-accent/10 text-app-text-muted hover:text-accent relative transition-all hidden md:flex"
            title="Notifikasi"
          >
            <Bell size={18} />
            {unreadNotifications > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
            )}
          </button>

          <button onClick={onClose} className="md:hidden text-app-text-muted hover:text-foreground">
            <X size={20} />
          </button>
        </div>

      <div className="p-4 flex-1">
        <div className="mb-4 text-[10px] font-bold text-app-text-muted uppercase tracking-[0.2em] px-3 opacity-50">
          Main Menu
        </div>
        <nav className="space-y-3">
          {menuItems.filter(item => {
            if (item.superOnly) return role === 'super-admin';
            
            // Priority for granular permissions
            if ((item as any).permission) {
              const permKey = (item as any).permission;
              return (permissions as any)?.[permKey] ?? (role === 'admin' || role === 'super-admin');
            }

            if ((item as any).adminOnly) return role === 'admin' || role === 'super-admin';
            return true;
          }).map((item) => {
            const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path + '/'));
            const Icon = item.icon;
            
            if (item.subItems) {
              const isOpen = openMenus[item.path];
              return (
                <div key={item.path} className="space-y-2">
                  <button
                    onClick={() => toggleMenu(item.path)}
                    className={`menu-btn ${isActive && !isOpen ? 'active' : ''}`}
                  >
                    <span className="menu-btn-top">
                      <Icon size={18} />
                      <span className="text-sm flex-1 text-left">{item.name}</span>
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </button>
                  
                  {isOpen && (
                    <div className="pl-6 space-y-1.5 mt-2 border-l border-app-border ml-5">
                      {item.subItems.map(sub => {
                        const isSubActive = pathname === sub.path;
                        return (
                          <Link
                            key={sub.path}
                            href={sub.path}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] transition-all border ${
                              isSubActive 
                                ? 'bg-accent/15 text-accent shadow-sm font-bold border-accent/25' 
                                : 'text-app-text-muted hover:text-foreground hover:bg-accent/10 font-bold border-transparent'
                            }`}
                          >
                            {sub.icon && <sub.icon size={12} className={isSubActive ? 'text-accent' : 'text-app-text-muted/60'} />}
                            {sub.name}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isBlocked = isSubscriptionExpired && ['/pos', '/estimations', '/debts'].includes(item.path);

            return (
              <Link
                key={item.path}
                href={isBlocked ? '#' : item.path}
                onClick={(e) => {
                  if (isBlocked) {
                    e.preventDefault();
                    toast.error('Akses Terkunci. Masa aktif langganan habis.', { style: { background: '#f43f5e', color: '#fff' } });
                  }
                }}
                className={`menu-btn ${pathname === item.path ? 'active' : ''} ${isBlocked ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <span className="menu-btn-top">
                  <Icon size={18} />
                  <span className="text-sm flex-1 text-left">{item.name}</span>
                  {item.path === '/orders' && newOrderCount > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-md shadow-sm border border-rose-600 animate-pulse">
                       {newOrderCount}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* THEME SWITCHER UI */}
        <div className="mt-10 pt-6 border-t border-app-border">
          <div className="mb-4 text-[10px] font-bold text-app-text-muted uppercase tracking-[0.2em] px-3 opacity-50 flex items-center gap-2">
            <Palette size={12} /> Theme Style
          </div>
          <div className="px-3 grid grid-cols-4 gap-2">
            {themes.map(t => (
              <button
                key={t.id}
                title={t.name}
                onClick={() => setTheme(t.id as any)}
                className={`aspect-square rounded-md flex items-center justify-center transition-all border ${
                  theme === t.id 
                    ? 'ring-1 ring-accent ring-offset-1 ring-offset-surface scale-105 shadow-sm border-transparent' 
                    : 'opacity-40 hover:opacity-100 hover:scale-105 border-transparent'
                } ${t.id.startsWith('light') ? 'border-app-border' : ''}`}
                style={{ backgroundColor: t.color }}
              >
                <t.icon size={14} className={t.id.startsWith('light') ? 'text-accent' : 'text-white drop-shadow-md'} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-app-border shrink-0 sticky bottom-0 bg-surface z-10 backdrop-blur-md">
        <div className="mb-4 flex items-center gap-3 px-3">
          <div className="w-10 h-10 rounded-md bg-accent/20 border border-accent/30 flex items-center justify-center text-accent font-bold shadow-inner overflow-hidden">
            <img src={logoUrl || '/logo.png'} alt="User Store Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-black text-foreground truncate leading-tight">{userName || user?.displayName || user?.email?.split('@')[0] || 'Loading...'}</div>
            <div className="text-[10px] text-app-text-muted uppercase font-bold tracking-widest h-3">
              {role ? role : <div className="w-12 h-2 bg-app-text-muted/20 animate-pulse rounded mt-1"></div>}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full text-left text-rose-500 hover:bg-rose-500/10 rounded-md transition-all font-bold group border border-transparent hover:border-rose-500/20"
        >
          <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm">Log Out System</span>
        </button>
      </div>
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
           <div className="bg-surface border border-app-border rounded-xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8 text-center">
                 <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
                    <LogOut size={40} />
                 </div>
                 <h2 className="text-2xl font-black text-foreground mb-2">Konfirmasi Keluar</h2>
                 <p className="text-xs text-app-text-muted font-medium mb-8">Apakah Anda ingin mem-backup data ke komputer Anda sebelum keluar sistem?</p>
                 
                 <div className="space-y-3">
                    <button 
                      onClick={() => confirmLogout(true)}
                      disabled={isBackuping}
                      className="w-full py-4 bg-accent text-foreground rounded-lg font-black shadow-sm hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group border border-accent/50"
                    >
                       {isBackuping ? (
                         <div className="w-5 h-5 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                       ) : <Cloud size={18} className="group-hover:bounce" />}
                       {isBackuping ? 'MEMPROSES BACKUP...' : 'BACKUP & KELUAR'}
                    </button>
                    
                    <button 
                      onClick={() => confirmLogout(false)}
                      disabled={isBackuping}
                      className="w-full py-4 bg-background border border-app-border text-app-text-muted hover:text-foreground rounded-lg font-black transition-all hover:border-foreground/20"
                    >
                       KELUAR SAJA
                    </button>
                    
                    <button 
                      onClick={() => setShowLogoutModal(false)}
                      disabled={isBackuping}
                      className="w-full py-2 text-[10px] font-black tracking-widest text-app-text-muted uppercase hover:text-rose-500 transition-colors"
                    >
                       BATAL
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </>
  );
}
