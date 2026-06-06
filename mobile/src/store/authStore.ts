import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  user: any | null; // Storing minimal user info for persistence
  role: 'admin' | 'cashier' | 'super-admin' | 'superadmin' | null;
  storeId: string | null;
  isLoading: boolean;
  setUser: (user: any | null) => void;
  setRole: (role: 'admin' | 'cashier' | 'super-admin' | 'superadmin' | null) => void;
  setStoreId: (storeId: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      storeId: null,
      isLoading: true,
      setUser: (user) => set({ user }),
      setRole: (role) => set({ role }),
      setStoreId: (storeId) => set({ storeId }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ user: null, role: null, storeId: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
