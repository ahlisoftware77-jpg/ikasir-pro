import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface LoginPayload {
  user: any;
  role: 'admin' | 'cashier' | 'super-admin' | 'superadmin';
  storeId: string;
  subscriptionUntil: string | null;
  isSubscriptionExpired: boolean;
  permissions?: any | null;
}

interface AuthState {
  user: any | null;
  role: 'admin' | 'cashier' | 'super-admin' | 'superadmin' | null;
  permissions: any | null;
  storeId: string | null;
  isLoading: boolean;
  subscriptionUntil: string | null;
  isSubscriptionExpired: boolean;
  disabledMenus: string[] | null;
  expiredDisabledMenus: string[] | null;
  login: (payload: LoginPayload) => void;
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
      login: (payload: LoginPayload) => {
        // Atomic set: all auth fields updated in ONE call to prevent
        // race conditions where UI renders with stale persisted state
        set({
          user: payload.user,
          role: payload.role,
          storeId: payload.storeId,
          subscriptionUntil: payload.subscriptionUntil,
          isSubscriptionExpired: payload.isSubscriptionExpired,
          permissions: payload.permissions || null,
          // Reset store-level fields; they will be loaded by App.tsx listeners
          disabledMenus: null,
          expiredDisabledMenus: null,
        });
      },
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
        // Reset all state atomically
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
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
