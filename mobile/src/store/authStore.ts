import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  user: any | null; // Storing minimal user info for persistence
  role: 'admin' | 'cashier' | 'super-admin' | 'superadmin' | null;
  permissions: any | null;
  storeId: string | null;
  isLoading: boolean;
  subscriptionUntil: string | null;
  isSubscriptionExpired: boolean;
  disabledMenus: string[] | null;
  setUser: (user: any | null) => void;
  setRole: (role: 'admin' | 'cashier' | 'super-admin' | 'superadmin' | null) => void;
  setPermissions: (permissions: any | null) => void;
  setStoreId: (storeId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setSubscriptionUntil: (val: string | null) => void;
  setIsSubscriptionExpired: (val: boolean) => void;
  setDisabledMenus: (disabledMenus: string[] | null) => void;
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
      setUser: (user) => set({ user }),
      setRole: (role) => set({ role }),
      setPermissions: (permissions) => set({ permissions }),
      setStoreId: (storeId) => set({ storeId }),
      setLoading: (isLoading) => set({ isLoading }),
      setSubscriptionUntil: (val) => set({ subscriptionUntil: val }),
      setIsSubscriptionExpired: (val) => set({ isSubscriptionExpired: val }),
      setDisabledMenus: (disabledMenus) => set({ disabledMenus }),
      logout: () => set({ user: null, role: null, permissions: null, storeId: null, subscriptionUntil: null, isSubscriptionExpired: false, disabledMenus: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
