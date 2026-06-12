'use client';

import { useState, useEffect } from 'react';
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
import { doc, getDoc } from 'firebase/firestore';
import { handleExportJSON } from '@/lib/backupUtils';
import toast from 'react-hot-toast';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, user, permissions, newOrderCount, isSubscriptionExpired } = useAuthStore();
  const { branding } = useBranding();
  const { theme, setTheme } = useTheme();

  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isBackuping, setIsBackuping] = useState(false);

  const isAdmin = role === 'super-admin' || role === 'admin';

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  // MAIN TAB MAPPING
  const mainTabs = [
    { name: 'Dasbor', path: '/', icon: LayoutDashboard, show: isAdmin || (permissions as any)?.canViewReports },
    { name: 'Kasir', path: '/pos', icon: Calculator, show: isAdmin || (permissions as any)?.canAccessPOS },
    { name: 'Pesanan', path: '/orders', icon: ClipboardList, show: isAdmin || (permissions as any)?.canManageOrders },
    { name: 'Riwayat', path: '/transactions', icon: ShoppingCart, show: isAdmin || (permissions as any)?.canAccessPOS },
  ].filter(t => t.show !== false);

  // Take top 4 max for clean UI, leaving 1 slot for "Lainnya"
  const displayTabs = mainTabs.slice(0, 4);

  // MORE SHEET MAPPING
  const moreMenus = [
    { name: 'Estimasi Biaya', path: '/estimations', icon: FileText, show: isAdmin || (permissions as any)?.canManageEstimations },
    { name: 'Hutang Piutang', path: '/debts', icon: BookOpen, show: isAdmin || (permissions as any)?.canManageDebts },
    { name: 'Shift Karyawan', path: '/shifts', icon: History, show: isAdmin || (permissions as any)?.canAccessPOS },
    { 
      name: 'Laporan', 
      path: '/reports', 
      icon: PieChart, 
      show: isAdmin || (permissions as any)?.canViewReports,
      subItems: [
        { name: 'Penjualan', path: '/reports/sales', icon: BarChart3 },
        { name: 'Omzet', path: '/reports/monthly', icon: TrendingUp },
        { name: 'Terlaris', path: '/reports/best-sellers', icon: Star },
        { name: 'Arus Kas', path: '/reports/cash-flow', icon: ArrowRightLeft },
        { name: 'Pelanggan', path: '/reports/customers', icon: Users },
        { name: 'Riwayat Tutup', path: '/reports/cashier-closes', icon: Archive },
      ]
    },
    { 
      name: 'Manajemen Produk', 
      path: '/products', 
      icon: Package, 
      show: isAdmin || (permissions as any)?.canManageProducts,
      subItems: [
        { name: 'Produk', path: '/products', icon: List },
        { name: 'Gudang', path: '/products/warehouse', icon: Warehouse },
        { name: 'Ekstra', path: '/products/extras', icon: Layers },
        { name: 'Diskon', path: '/products/discounts', icon: Tag },
        { name: 'Terjual', path: '/products/sold', icon: ShoppingBag },
        { name: 'Stok', path: '/products/stock-history', icon: History },
        { name: 'Expired', path: '/products/expiry', icon: Calendar },
      ]
    },
    { name: 'Staf & User', path: '/users', icon: Users, show: isAdmin || (permissions as any)?.canManageUsers },
    { name: 'Log Aktifitas', path: '/logs', icon: ClipboardList, show: isAdmin || (permissions as any)?.canViewLogs },
    { name: 'Profil', path: '/profile', icon: UserCircle },
    { name: 'Paket Langganan', path: '#subscription', icon: Sparkles },
    { name: 'Pusat Bantuan', path: 'https://wa.me/6283815862300', icon: HelpCircle },
    { name: 'Kritik & Saran', path: '#feedback', icon: MessageSquare },
    { name: 'Pengaturan', path: '/settings', icon: Settings, show: isAdmin || (permissions as any)?.canEditSettings },
    { name: 'Super Admin', path: '/super-admin', icon: ShieldCheck, show: role === 'super-admin' },
  ].filter(m => m.show !== false);

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

  const handleLogoutClick = () => {
    setIsMoreOpen(false);
    setShowLogoutModal(true);
  };

  const confirmLogout = async (backupFirst: boolean) => {
    if (backupFirst) {
      setIsBackuping(true);
      try {
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

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-t border-app-border z-40 pb-safe">
        <div className="flex justify-between items-center px-2 py-2">
          {displayTabs.map((tab) => {
            const isActive = pathname === tab.path || (tab.path !== '/' && pathname.startsWith(tab.path + '/'));
            const isBlocked = isSubscriptionExpired && ['/pos', '/estimations', '/debts', '/users'].includes(tab.path);
            const Icon = tab.icon;
            return (
              <Link
                href={isBlocked ? '#' : tab.path}
                key={tab.path}
                onClick={(e) => {
                  if (isBlocked) {
                    e.preventDefault();
                    toast.error('Akses Terkunci. Masa aktif langganan habis.', { style: { background: '#f43f5e', color: '#fff' } });
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
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'animate-bounce-short' : ''} />
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
            onClick={() => setIsMoreOpen(true)}
            className={`flex flex-col items-center justify-center w-full py-1.5 transition-all ${
              isMoreOpen ? 'text-accent scale-105' : 'text-app-text-muted hover:text-foreground'
            }`}
          >
            <div className={`p-1.5 rounded-md transition-all ${isMoreOpen ? 'bg-accent/15' : ''}`}>
              <Menu size={20} className={isMoreOpen ? 'animate-pulse' : ''} />
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
            onClick={() => setIsMoreOpen(false)}
          />
          <div className="w-full bg-surface rounded-t-xl shadow-2xl relative z-10 animate-in slide-in-from-bottom duration-300 max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-app-border bg-surface shrink-0">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-md bg-accent/20 flex items-center justify-center text-accent font-black shadow-inner border border-accent/20">
                    {user?.email?.[0].toUpperCase() || '?'}
                 </div>
                 <div>
                    <h2 className="text-sm font-black text-foreground">{user?.displayName || user?.email?.split('@')[0]}</h2>
                    <p className="text-[10px] text-app-text-muted font-bold tracking-widest uppercase">{role}</p>
                 </div>
              </div>
              <button 
                onClick={() => setIsMoreOpen(false)}
                className="w-8 h-8 rounded-md bg-app-border flex items-center justify-center text-app-text-muted hover:text-foreground hover:bg-background border border-transparent hover:border-foreground/10"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-4 space-y-2 relative pb-24">
               {moreMenus.map(menu => {
                 const isActive = pathname.startsWith(menu.path);
                 const isExpanded = expandedMenu === menu.name;
                 const hasSubItems = (menu as any).subItems && (menu as any).subItems.length > 0;

                 return (
                   <div key={menu.name} className="space-y-1 py-1">
                     <div
                       onClick={() => {
                          const isBlocked = isSubscriptionExpired && ['/estimations', '/debts', '/users'].includes(menu.path);
                         if (isBlocked) {
                           toast.error('Akses Terkunci. Masa aktif langganan habis.', { style: { background: '#f43f5e', color: '#fff' } });
                           return;
                         }

                         if (menu.path === '#subscription') {
                           setIsMoreOpen(false);
                           window.dispatchEvent(new CustomEvent('open-subscription-modal'));
                           return;
                         }

                         if (menu.path === '#feedback') {
                           setIsMoreOpen(false);
                           window.dispatchEvent(new CustomEvent('open-feedback-modal'));
                           return;
                         }

                         if (menu.path.startsWith('http')) {
                           setIsMoreOpen(false);
                           window.open(menu.path, '_blank');
                           return;
                         }

                         if (hasSubItems) {
                           setExpandedMenu(isExpanded ? null : menu.name);
                         } else {
                           setIsMoreOpen(false);
                           router.push(menu.path);
                         }
                       }}
                       className={`uiverse-btn ${isActive ? 'active-btn' : ''} ${isSubscriptionExpired && ['/estimations', '/debts', '/users'].includes(menu.path) ? 'opacity-40 cursor-not-allowed' : ''}`}
                     >
                       <span className="uiverse-btn-top w-full justify-between">
                         <span className="flex items-center gap-3">
                           <menu.icon size={18} />
                           <span className="text-sm font-bold text-foreground">{menu.name}</span>
                         </span>
                         {hasSubItems ? (
                           <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}>
                              <ChevronRight size={16} className="opacity-30" />
                           </div>
                         ) : (
                           <ChevronRight size={16} className="opacity-30" />
                         )}
                       </span>
                     </div>

                     {hasSubItems && isExpanded && (
                       <div className="grid grid-cols-2 gap-2 p-2 bg-background/30 rounded-lg animate-in slide-in-from-top-2 duration-300">
                          {(menu as any).subItems.map((sub: any) => (
                            <Link
                              key={sub.path}
                              href={sub.path}
                              onClick={() => setIsMoreOpen(false)}
                              className={`flex flex-col items-center justify-center p-3 rounded-md gap-2 border transition-all ${
                                pathname === sub.path 
                                  ? 'bg-accent border-accent text-foreground shadow-lg shadow-accent/20' 
                                  : 'bg-surface border-app-border text-app-text-muted hover:border-accent/30'
                              }`}
                            >
                              {sub.icon && <sub.icon size={16} className={pathname === sub.path ? 'text-foreground' : 'text-accent'} />}
                              <span className="text-[9px] font-black uppercase tracking-tighter line-clamp-1">{sub.name}</span>
                            </Link>
                          ))}
                       </div>
                     )}
                   </div>
                 );
               })}

               <div className="mt-6 pt-4 border-t border-app-border relative">
                  <div className="mb-3 text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                    <Palette size={12} /> TEMA VISUAL
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {themes.map(t => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setTheme(t.id as any);
                          setTimeout(() => setIsMoreOpen(false), 300);
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
               
               <button 
                 onClick={handleLogoutClick}
                 className="w-full mt-6 py-4 rounded-lg bg-rose-500/10 text-rose-500 font-black tracking-widest text-xs uppercase flex justify-center items-center gap-2 border border-rose-500/20 active:scale-95 transition-all hover:bg-rose-500/20"
               >
                 <LogOut size={16} /> Keluar Akun
               </button>
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
                     onClick={() => setShowLogoutModal(false)}
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
