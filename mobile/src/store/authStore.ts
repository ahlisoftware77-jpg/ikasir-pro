import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut } from 'firebase/auth';
import { clearIndexedDbPersistence } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AuthState {
  user: any | null; // Storing minimal user info for persistence
  role: 'admin' | 'cashier' | 'super-admin' | 'superadmin' | null;
  permissions: any | null;
  storeId: string | null;
  isLoading: boolean;
  subscriptionUntil: string | null;
  isSubscriptionExpired: boolean;
  disabledMenus: string[] | null;
  expiredDisabledMenus: string[] | null;
  setUser: (user: any | null) => void;
  setRole: (role: 'admin' | 'cashier' | 'super-admin' | 'superadmin' | null) => void;
  setPermissions: (permissions: any | null) => void;
  setStoreId: (storeId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setSubscriptionUntil: (val: string | null) => void;
  setIsSubscriptionExpired: (val: boolean) => void;
  setDisabledMenus: (disabledMenus: string[] | null) => void;
  setExpiredDisabledMenus: (expiredDisabledMenus: string[] | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      permissions: null,
      storeId: null,
      isLoading: true,
      subscriptionUntil: null,
      isSubscriptionExpired: false,
      disabledMenus: null,
      expiredDisabledMenus: null,
      setUser: (user) => set({ user }),
      setRole: (role) => set({ role }),
      setPermissions: (permissions) => set({ permissions }),
      setStoreId: (storeId) => set({ storeId }),
      setLoading: (isLoading) => set({ isLoading }),
      setSubscriptionUntil: (val) => set({ subscriptionUntil: val }),
      setIsSubscriptionExpired: (val) => set({ isSubscriptionExpired: val }),
      setDisabledMenus: (disabledMenus) => set({ disabledMenus }),
      setExpiredDisabledMenus: (expiredDisabledMenus) => set({ expiredDisabledMenus }),
      logout: () => {
        // Set Zustand state to null synchronously first
        set({ 
          user: null, 
          role: null, 
          permissions: null, 
          storeId: null, 
          subscriptionUntil: null, 
          isSubscriptionExpired: false, 
          disabledMenus: null, 
          expiredDisabledMenus: null 
        });
        
        // Sign out from Firebase Auth
        signOut(auth).catch((err) => console.error("Firebase signOut error:", err));

        // Clear local Firestore persistent cache to prevent data leakage between users
        clearIndexedDbPersistence(db).catch((err) => {
          console.warn("Firestore cache clear warning:", err);
        });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
