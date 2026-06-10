'use client';

import { useAuthStore } from '@/store/auth';
import Sidebar from './Sidebar';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode, useState } from 'react';
import { Menu, LogOut, Cloud, ShieldCheck, User as UserIcon, X, Store, Loader2, Bell } from 'lucide-react';
import { useBranding } from '@/context/BrandingContext';
import PWAInstallButton from './PWAInstallButton';
import NavigationGuard from './NavigationGuard';
import MobileBottomNav from './MobileBottomNav';
import { useNotificationStore } from '@/store/notifications';
import NotificationCenter from '@/components/NotificationCenter';
import { auth, db, primaryDb } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { handleExportJSON } from '@/lib/backupUtils';
import SubscriptionModal from '@/components/SubscriptionModal';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { user, role, isLoading, isOnline, isSyncing, wasAuthenticated, logoUrl, setLogoUrl, resetAll, storeId, setNewOrderCount, storeName, isSubscriptionExpired } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const { branding } = useBranding();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const setWasAuthenticated = useAuthStore(state => state.setWasAuthenticated);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isBackuping, setIsBackuping] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [hasPendingSubscription, setHasPendingSubscription] = useState(false);
  const addInternalNotification = useNotificationStore(state => state.addNotification);
  const unreadCount = useNotificationStore(state => state.getUnreadCount());

  // Listen to subscription requests for current store to check if pending
  useEffect(() => {
    if (!storeId || (role as string) === 'customer') return;

    const q = query(
      collection(primaryDb, 'subscription_requests'),
      where('storeId', '==', storeId),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHasPendingSubscription(!snapshot.empty);
    });

    return () => unsubscribe();
  }, [storeId, role]);

  // Background New Order Listener
  useEffect(() => {
    if (!storeId || (role as string) === 'customer') return;

    const q = query(
      collection(db, 'transactions'),
      where('storeId', '==', storeId),
      where('orderStatus', 'in', ['new', 'processing', 'ready'])
    );

    let isInitialLoad = true;
    let lastKnownCount = 0;

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const newCount = snapshot.docs.length;
      setNewOrderCount(newCount);

      // Detect "Sync" status from Firestore metadata
      if (snapshot.metadata.fromCache) {
        console.log("Data loaded from cache, waiting for server...");
      }

      if (!isInitialLoad) {
        const hasNew = snapshot.docChanges().some(change => change.type === 'added');
        if (hasNew && newCount > lastKnownCount) {
          // Play Sound
          const audio = new Audio('/sound/pesanan.mp3');
          audio.play().catch(e => console.error("Auto-play pesanan terblokir browser:", e));

          // Notifikasi Mengambang (Floating Toast untuk Android Web)
          toast.success("🚨 PESANAN BARU MASUK!", { 
            position: 'top-center', 
            duration: 5000,
            style: { border: '2px solid #10b981', padding: '16px', color: '#10b981', fontWeight: 'bold' }
          });

          // Always show System Notification
          showSystemNotification();

          // Add to internal notification store
          addInternalNotification({
            title: 'Pesanan Online Baru!',
            body: `Seorang pelanggan baru saja melakukan pemesanan melalui link online.`,
            type: 'order'
          });
        }
      }
      lastKnownCount = newCount;
      isInitialLoad = false;
    });

    const showSystemNotification = async () => {
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'granted') {
         await Notification.requestPermission();
      }
      
      if (Notification.permission === 'granted') {
        try {
           const registration = await navigator.serviceWorker.ready;
           registration.showNotification('PESANAN BARU!', {
          body: 'Ada pelanggan baru yang melakukan pemesanan online. Klik untuk memproses!',
          icon: logoUrl || '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [200, 100, 200],
          tag: 'new-order',
          renotify: true,
          requireInteraction: true
        } as any);
        } catch (err) {
          console.error("Failed to show service worker notification:", err);
          // Fallback to basic notification if SW fails
          new Notification('PESANAN BARU!', {
            body: 'Ada pelanggan baru yang melakukan pemesanan online. Klik untuk memproses!',
            icon: logoUrl || '/icon-192.png'
          });
        }
      }
    };

    // Re-check on Focus
    const handleFocus = () => {
       // Just being visible helps Firestore reconnect if it was dormant
       console.log("Tab re-focused, listener status will be refreshed by Firestore auto-reconnect");
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, [storeId, role, setNewOrderCount, addInternalNotification]); // Removed logoUrl to stop unnecessary listener restarts
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    // Register Service Worker globally for PWA support
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(reg => {
            console.log('SW registered:', reg);
            if (navigator.serviceWorker.controller && storeId) {
              navigator.serviceWorker.controller.postMessage({
                type: 'SET_STORE_ID',
                storeId: storeId
              });
            }
          })
          .catch(err => console.log('SW reg error:', err));
          
        // Request Persistent Storage for better offline support
        if (navigator.storage && navigator.storage.persist) {
          navigator.storage.persisted().then(persistent => {
            if (!persistent) {
              navigator.storage.persist().then(granted => {
                console.log(granted ? "Persistent storage granted" : "Persistent storage denied");
              });
            } else {
              console.log("Persistent storage already granted");
            }
          });
        }
      });
    }

    // Pre-unlock Audio for foreground sound autoplay resilience
    const unlockAudio = () => {
      const audio = new Audio('/sound/pesanan.mp3');
      audio.volume = 0; // silent playback to register interaction
      audio.play()
        .then(() => {
          console.log("Audio system pre-unlocked successfully");
          window.removeEventListener('click', unlockAudio);
          window.removeEventListener('touchstart', unlockAudio);
        })
        .catch(e => console.log("Audio pre-unlock waiting for user interaction:", e));
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('click', unlockAudio);
      window.addEventListener('touchstart', unlockAudio);
    }

    if (user && !isLoading) {
      setWasAuthenticated(true);
      
      // Request browser notification permission
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      }
    };
  }, [user, isLoading, storeId]);

  // Sync storeId with Service Worker
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && storeId) {
      const sendStoreId = () => {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SET_STORE_ID',
            storeId: storeId
          });
        }
      };
      
      sendStoreId();

      // Listen for controllerchange (when SW updates and takes control)
      navigator.serviceWorker.addEventListener('controllerchange', sendStoreId);
      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', sendStoreId);
      };
    }
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    const fetchLogo = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', `store_${storeId}`));
        if (docSnap.exists()) {
          const fetchedLogo = docSnap.data().logoUrl || null;
          if (fetchedLogo !== logoUrl) {
            setLogoUrl(fetchedLogo);
          }
        }
      } catch (err) {
        console.error("Error fetching logo:", err);
      }
    };
    fetchLogo();
  }, [storeId, logoUrl, setLogoUrl]);

  // Navigation Guard Integration
  useEffect(() => {
    const handleNavigationAttempt = (e: MouseEvent | SubmitEvent) => {
      const target = (e.target as HTMLElement).closest('a, form');
      if (target) {
        // POS Internal Navigation Guard (Sidebar/Menu links)
        if (pathname === '/pos' && (window as any).__isCartNotEmpty) {
          const isInternalNav = target.tagName === 'A' || target.closest('nav') || target.closest('aside') || target.closest('footer');
          if (isInternalNav) {
            const confirmed = window.confirm("Transaksi sedang berlangsung!\n\nJika Anda keluar dari halaman kasir, keranjang belanja akan dikosongkan. Yakin ingin keluar?");
            if (!confirmed) {
              e.preventDefault();
              e.stopPropagation();
              return;
            } else {
              // Biarkan keluar, set status cart jadi aman agar tidak memicu guard lain (e.g. popstate)
              (window as any).__isCartNotEmpty = false;
            }
          }
        }
      }
    };

    // Gunakan event 'click' pada fase capture (true) agar dieksekusi sebelum Next.js Link
    document.addEventListener('click', handleNavigationAttempt as EventListener, true);
    document.addEventListener('submit', handleNavigationAttempt as EventListener, true);
    
    return () => {
      document.removeEventListener('click', handleNavigationAttempt as EventListener, true);
      document.removeEventListener('submit', handleNavigationAttempt as EventListener, true);
    };
  }, [pathname]);

  useEffect(() => {
    if (!isLoading) {
      const isTrRoute = pathname === '/tr' || pathname?.startsWith('/tr/');
      const isInvoiceRoute = pathname?.startsWith('/invoice');
      const isDeliveryRoute = pathname?.startsWith('/delivery');
      const isSignRoute = pathname?.startsWith('/sign');
      const publicRoutes = ['/login', '/register', '/demo'];
      const permissions = useAuthStore.getState().permissions;

      const isAdminRoute = !publicRoutes.includes(pathname) && !isTrRoute && !isInvoiceRoute && !isDeliveryRoute && !isSignRoute;

      // 1. Protection for Admin Routes: Only allow admin/cashier/super-admin roles
      if (isAdminRoute && (!user || (role as string) === 'customer')) {
        router.push('/login');
        return;
      } 
      
      // 2. Redirect from Main Login: If already an admin, go home/pos. 
      // Note: If they are a customer, we let them stay on /login so they can login as an admin if they want.
      // This prevents the "Link Tidak Valid" redirect loop.
      if (user && pathname === '/login') {
        if ((role as string) !== 'customer') {
           router.push(role === 'cashier' ? '/pos' : '/');
           return;
        }
      }

      // 3. Protection for Customer Routes: (Optional: Admins browsing TR can stay but handled differently in TR page)
      // We already handled this in the previous turn by ensuring routing guard redirects to home for admins if needed,
      // but here we focus on the USER's specific request about separation.

      if (user && permissions && role !== 'super-admin') {
        // POS Check
        if (pathname.startsWith('/pos') && !permissions.canAccessPOS) {
          router.push('/');
        }
        // Reports Check
        else if (pathname.startsWith('/reports') && !permissions.canViewReports) {
          router.push('/pos');
        }
        // Products Check
        else if (pathname.startsWith('/products') && !permissions.canManageProducts) {
          router.push('/pos');
        }
        // Users Check
        else if (pathname === '/users' && !permissions.canManageUsers) {
          router.push('/');
        }
        // Settings Check
        else if (pathname === '/settings' && !permissions.canEditSettings) {
          router.push('/');
        }
        // Dashboard Check
        else if (pathname === '/' && !permissions.canViewReports) {
          router.push('/pos');
        }
      }
    }
  }, [user, role, isLoading, pathname, router]);

  // Initial Boot Loading (No user yet AND no previous session)
  if (isLoading && !user && !wasAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 transition-colors duration-500">
        <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin shadow-2xl shadow-accent/20"></div>
        <p className="text-app-text-muted font-bold tracking-widest uppercase text-[10px] animate-pulse">Menghubungkan ke Sistem...</p>
      </div>
    );
  }

  const isInvoicePage = pathname?.startsWith('/invoice');
  const isDeliveryPage = pathname?.startsWith('/delivery');
  const isTrPage = pathname === '/tr' || pathname?.startsWith('/tr/');
  const isSignPage = pathname?.startsWith('/sign');
  const publicRoutes = ['/login', '/register', '/tr'];
  
  if (publicRoutes.includes(pathname) || isTrPage || isInvoicePage || isDeliveryPage || isSignPage) {
    return (
      <div className="min-h-screen bg-background text-foreground relative">
        {children}
        {(!isInvoicePage && !isDeliveryPage && !isTrPage) && <PWAInstallButton />}
      </div>
    );
  }

  if (!user && !wasAuthenticated) return null;

  const handleLogout = () => {
    setShowProfileModal(false);
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
    resetAll(); // Clear persistent store
    setShowLogoutModal(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row shadow-none">
      {/* Mobile Top Bar */}
      <header className="md:hidden h-16 border-b border-app-border bg-surface flex items-center justify-between px-6 sticky top-0 z-40 shrink-0">
        <div className="flex items-center gap-2 overflow-hidden mr-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-app-border bg-background shrink-0">
             <img src={logoUrl || '/logo.png'} alt="Store Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-sm font-black text-foreground tracking-widest uppercase italic truncate">
            {storeName || branding.appName}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={() => setShowNotifications(true)}
            className="w-10 h-10 rounded-xl bg-surface border border-app-border flex items-center justify-center text-app-text-muted hover:text-accent relative transition-all active:scale-95"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
            )}
          </button>

          <button 
            onClick={() => setShowProfileModal(true)}
            className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent active:scale-95 transition-all overflow-hidden"
          >
            <img src={logoUrl || '/logo.png'} alt="Store Logo" className="w-full h-full object-contain" />
          </button>
        </div>
      </header>

      <NotificationCenter isOpen={showNotifications} onClose={() => setShowNotifications(false)} />

      {/* Account Profile Modal Mobile */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
           <div 
             className="fixed inset-0 pointer-events-auto" 
             onClick={() => setShowProfileModal(false)}
           />
           <div className="bg-surface border-t sm:border border-app-border rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 relative z-10">
              <div className="p-8">
                 <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 rounded-xl bg-accent text-white flex items-center justify-center text-3xl font-black shadow-sm overflow-hidden border border-accent/20">
                       <img src={logoUrl || '/logo.png'} alt="Store Profile" className="w-full h-full object-contain bg-white" />
                    </div>
                 </div>
                 
                 <div className="text-center mb-8">
                    <h2 className="text-xl font-black text-foreground uppercase tracking-tight">{user?.displayName || user?.email?.split('@')[0]}</h2>
                    <p className="text-xs text-app-text-muted font-bold tracking-widest uppercase mt-1">{role} System</p>
                 </div>

                 <div className="space-y-4 mb-8">
                    <div className="p-4 bg-background/50 border border-app-border rounded-2xl flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-app-text-muted">
                          <UserIcon size={18} />
                       </div>
                       <div className="flex-1 overflow-hidden">
                          <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">ID / Email</p>
                          <p className="text-xs font-bold text-foreground truncate">{user?.email}</p>
                       </div>
                    </div>
                    
                    <div className="p-4 bg-background/50 border border-app-border rounded-2xl flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-app-text-muted">
                          <Store size={18} />
                       </div>
                       <div className="flex-1 overflow-hidden">
                          <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Nama Toko</p>
                          <p className="text-xs font-bold text-foreground truncate">{useAuthStore.getState().storeName || 'Toko Kasir Pro'}</p>
                       </div>
                    </div>
                 </div>

                 <div className="flex flex-col gap-3">
                   <button 
                     onClick={handleLogout}
                     className="w-full py-4 bg-rose-500 text-white rounded-lg font-black shadow-sm hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group border border-rose-600"
                   >
                     <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
                     LOG OUT SYSTEM
                   </button>
                   
                   <button 
                     onClick={() => setShowProfileModal(false)}
                     className="w-full py-4 bg-background border border-app-border text-app-text-muted hover:text-foreground rounded-lg font-black transition-all hover:border-foreground/20"
                   >
                     TUTUP
                   </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in zoom-in-95 duration-300">
           <div className="bg-surface border border-app-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
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

      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        logoUrl={logoUrl} 
        onOpenNotifications={() => setShowNotifications(true)}
      />
      
      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto h-screen relative pb-24 md:pb-8">
        {/* Connectivity Status Bar */}
        {!isOnline && (
          <div className="fixed top-0 left-0 md:left-64 right-0 z-[100] bg-amber-500 text-white py-1 px-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Bekerja Offline - Transaksi akan disinkronisasi saat internet kembali
          </div>
        )}
        {isOnline && isSyncing && (
          <div className="fixed top-0 left-0 md:left-64 right-0 z-[100] bg-blue-500 text-white py-1 px-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300">
            <Loader2 className="w-3 h-3 animate-spin" />
            Menyinkronkan Data ke Cloud...
          </div>
        )}
        
        {isSubscriptionExpired && (
          <div className="mb-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top duration-500">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h3 className="text-sm font-black text-rose-500 uppercase tracking-widest">Akses Terbatas: Langganan Habis</h3>
                <p className="text-xs text-app-text-muted mt-1 font-bold">Menu transaksi, estimasi, dan piutang telah diblokir. Perpanjang langganan untuk memulihkan akses.</p>
              </div>
            </div>
            <button 
              onClick={() => setShowSubscriptionModal(true)}
              className="w-full md:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors text-center whitespace-nowrap shrink-0"
            >
              Buka Menu Langganan
            </button>
          </div>
        )}

        {hasPendingSubscription && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top duration-500">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
              </div>
              <div>
                <h3 className="text-sm font-black text-amber-500 uppercase tracking-widest">Pembayaran Sedang Ditinjau</h3>
                <p className="text-xs text-app-text-muted mt-1 font-bold">Bukti pembayaran Anda telah dikirim dan sedang dalam proses verifikasi oleh admin pusat. Akses akan dipulihkan secara otomatis setelah disetujui.</p>
              </div>
            </div>
            <a 
              href="https://wa.me/6283815862300?text=Halo%20Admin%20IKASIR%20PRO,%20saya%20sudah%20mengirim%20bukti%20pembayaran%20untuk%20perpanjangan%20langganan%20aplikasi%20saya.%20Mohon%20segera%20diverifikasi."
              target="_blank"
              rel="noreferrer"
              className="w-full md:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors text-center whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5"
            >
              Hubungi Admin WA
            </a>
          </div>
        )}
        
        <NavigationGuard />
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500">
            <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin"></div>
            <p className="text-app-text-muted font-bold tracking-widest uppercase text-[8px]">Sinkronisasi Data...</p>
          </div>
        ) : (
          <>
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-accent/5 blur-3xl mix-blend-screen pointer-events-none"></div>
            {children}
          </>
        )}
        <SubscriptionModal isOpen={showSubscriptionModal} onClose={() => setShowSubscriptionModal(false)} />
      </main>
      <MobileBottomNav />
      <PWAInstallButton />
    </div>
  );
}
