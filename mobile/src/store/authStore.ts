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
        // race conditions where UI renders with stale persisted state.
        // NOTE: expiredDisabledMenus is NOT reset here — it's a global
        // branding setting loaded by a one-time onSnapshot listener.
        // Resetting it would wipe the data and the listener won't re-fire.
        set({
          user: payload.user,
          role: payload.role,
          storeId: payload.storeId,
          subscriptionUntil: payload.subscriptionUntil,
          isSubscriptionExpired: payload.isSubscriptionExpired,
          permissions: payload.permissions || null,
          // Reset per-store field; will be reloaded by App.tsx user listener
          disabledMenus: null,
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
        // Reset per-user state atomically.
        // NOTE: expiredDisabledMenus is preserved — it's a global branding
        // setting that the onSnapshot listener won't reload after reset.
        set({ 
          user: null, 
          role: null, 
          permissions: null, 
          storeId: null, 
          subscriptionUntil: null, 
          isSubscriptionExpired: false, 
          disabledMenus: null,
        });
        // Clear other stores dynamically to avoid circular dependencies
        import('./cartStore').then(({ useCartStore }) => {
          useCartStore.getState().clearAll();
        }).catch(err => console.error("Failed to clear cart store:", err));
        
        import('./notificationStore').then(({ useNotificationStore }) => {
          useNotificationStore.getState().clearAll();
        }).catch(err => console.error("Failed to clear notification store:", err));

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
