'use client';

import { useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db, primaryDb, activeFirebaseConfig, isDynamicConfig } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';
import { doc, getDoc, setDoc, onSnapshotsInSync } from 'firebase/firestore';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { 
    setUser, setRole, setLoading, setBlockingDetails, 
    setStoreId, setStoreName, setUserName, setLogoUrl, setPermissions, 
    setOnline, setSyncing, isOnline 
  } = useAuthStore();

  useEffect(() => {
    // 1. Monitor Online/Offline Status
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setOnline(navigator.onLine);

    // 2. Monitor Firestore Sync Status
    const unsubscribeSync = onSnapshotsInSync(db, () => {
      // This triggers when all local changes have been synchronized with the server
      setSyncing(false);
    });

    // 3. Monitor Auth State
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Default root admin override (Super Admin)
        if (user.email === 'triyadi72@gmail.com') {
          setUser(user);
          setRole('super-admin');
          setStoreId('default-store');
          setStoreName('Toko Utama (Default)');
          setUserName('Super Admin Triyadi');
          setPermissions({
            canAccessPOS: true,
            canManageProducts: true,
            canCreateProducts: true, // Baru
            canEditProducts: true,   // Baru
            canDeleteProducts: true, // Baru
            canViewReports: true,
            canManageUsers: true,
            canEditSettings: true
          });
          
          try {
            await setDoc(doc(primaryDb, 'stores', 'default-store'), {
              name: 'Toko Utama (Default)',
              ownerEmail: 'triyadi72@gmail.com',
              createdAt: new Date().toISOString(),
              isActive: true
            }, { merge: true });

            await setDoc(doc(primaryDb, 'users', user.uid), {
              email: user.email,
              role: 'super-admin',
              name: 'Super Admin Triyadi',
              storeId: 'default-store',
              isActive: true,
              isSubscribed: true,
              validUntil: '2099-12-31'
            }, { merge: true });
          } catch (err) {}
          setLoading(false);
        } else {
          try {
            // SELALU gunakan primaryDb untuk Auth, Role, dan Info Langganan
            const userRef = doc(primaryDb, 'users', user.uid);
            let userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
              const userData = userDoc.data();
              const now = new Date();
              const validUntil = userData.validUntil ? new Date(userData.validUntil) : null;
              
              if (userData.isActive === false) {
                setBlockingDetails({
                  title: 'Akses Dibekukan',
                  message: 'Maaf, akun Anda telah dinonaktifkan sementara oleh administrator sistem.',
                  type: 'disabled'
                });
                if (navigator.onLine) await signOut(auth);
                setUser(null);
              } 
              else if (validUntil && now > validUntil) {
                setBlockingDetails({
                  title: 'Langganan Berakhir',
                  message: 'Masa berlaku aplikasi telah habis. Silakan hubungi administrator untuk perpanjangan layanan.',
                  type: 'expired'
                });
                if (navigator.onLine) await signOut(auth);
                setUser(null);
              }
              else {
                const sId = userData.storeId || 'default-store';
                
                // PENTING: Toko (stores) tetap dibaca dari db yang sedang aktif (bisa jadi Target DB)
                const storeRef = doc(db, 'stores', sId);
                const storeDoc = await getDoc(storeRef);
                const storeData = storeDoc.exists() ? storeDoc.data() : null;

                if (storeData && storeData.isActive === false) {
                  setBlockingDetails({
                    title: 'Menunggu Persetujuan',
                    message: 'Pendaftaran toko Anda sedang ditinjau oleh tim administrator.',
                    type: 'pending_approval'
                  });
                  if (navigator.onLine) await signOut(auth);
                  setUser(null);
                } else {
                  setUser(user);
                  setRole(userData.role as any);
                  setStoreId(sId);
                  setStoreName(storeData ? storeData.name : 'Toko Saya');
                  setUserName(userData.name || user.email);

                  if (userData.role === 'admin') {
                    setPermissions({
                      canAccessPOS: true,
                      canManageProducts: true,
                      canCreateProducts: true,
                      canEditProducts: true,
                      canDeleteProducts: true,
                      canViewReports: true,
                      canManageUsers: true,
                      canEditSettings: true
                    });
                  } else {
                    setPermissions({
                      canAccessPOS: userData.permissions?.canAccessPOS ?? true,
                      canManageProducts: userData.permissions?.canManageProducts ?? false,
                      canCreateProducts: userData.permissions?.canCreateProducts ?? userData.permissions?.canManageProducts ?? false,
                      canEditProducts: userData.permissions?.canEditProducts ?? userData.permissions?.canManageProducts ?? false,
                      canDeleteProducts: userData.permissions?.canDeleteProducts ?? userData.permissions?.canManageProducts ?? false,
                      canViewReports: userData.permissions?.canViewReports ?? false,
                      canManageUsers: userData.permissions?.canManageUsers ?? false,
                      canEditSettings: userData.permissions?.canEditSettings ?? false,
                      ...userData.permissions
                    });
                  }
                  }

                  // SYNC DYNAMIC INFRASTRUCTURE (Multi-Tenancy)
                  if (userData.infraConfig && userData.infraConfig.fb_project_id) {
                    const targetProjId = userData.infraConfig.fb_project_id;
                    const currentProjId = activeFirebaseConfig.projectId;

                    if (targetProjId !== currentProjId) {
                       console.log(`Switching infrastructure to ${targetProjId}...`);
                       const fbObj = {
                         apiKey: userData.infraConfig.fb_api_key,
                         authDomain: userData.infraConfig.fb_auth_domain,
                         projectId: userData.infraConfig.fb_project_id,
                         storageBucket: userData.infraConfig.fb_storage_bucket,
                         messagingSenderId: userData.infraConfig.fb_messaging_sender_id,
                         appId: userData.infraConfig.fb_app_id
                       };
                       localStorage.setItem('infra_config_fb', JSON.stringify(fbObj));
                       window.location.reload();
                       return; // Stop processing current doc
                     }
                  }

                  // Sync Logo
                  try {
                    const settingsRef = doc(db, 'settings', `store_${sId}`);
                    const settingsDoc = await getDoc(settingsRef);
                    if (settingsDoc.exists()) {
                      setLogoUrl(settingsDoc.data().logoUrl || null);
                    }
                  } catch (err) {}
                }
            } else {
              // FAIL-SAFE: Jika user tidak ditemukan di database AKTIF, 
              // tapi kita sedang menggunakan OVERRIDE (Dynamic Config), 
              // kemungkinan profil user ada di database UTAMA.
              if (isDynamicConfig) {
                 console.warn("User profile not found in target project. Falling back to primary...");
                 localStorage.removeItem('infra_config_fb');
                 window.location.reload();
                 return; 
              }

              setUser(user);
              setRole('cashier');
              setStoreId('default-store');
            }
          } catch (error) {
            console.error("Error fetching user data", error);
            // If offline and we have a user, assume previous session is valid
            if (!navigator.onLine && user) {
               setUser(user);
               // Minimal permissions if completely unknown
            }
          } finally {
            setLoading(false);
          }
        }
      } else {
        // Clear dynamic infra on logout to allow next user to start from primary
        if (typeof window !== 'undefined') {
           localStorage.removeItem('infra_config_fb');
        }
        setUser(null);
        setRole(null);
        setStoreId(null);
        setStoreName(null);
        setLoading(false);
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeSync();
      unsubscribeAuth();
    };
  }, [setUser, setRole, setLoading, setBlockingDetails, setStoreId, setStoreName, setLogoUrl, setPermissions, setOnline, setSyncing]);

  return <>{children}</>;
}
