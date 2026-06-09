import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from 'firebase/auth';

export interface UserPermissions {
  canAccessPOS: boolean;
  canManageProducts: boolean;
  canCreateProducts?: boolean; // New
  canEditProducts?: boolean;   // New
  canDeleteProducts?: boolean; // New
  canViewReports: boolean;
  canManageUsers: boolean;
  canEditSettings: boolean;
  canManageEstimations?: boolean;
  canManageDebts?: boolean;
  canManageOrders?: boolean;
  canViewLogs?: boolean;
}

interface AuthState {
  user: User | null;
  role: 'super-admin' | 'admin' | 'cashier' | 'customer' | null;
  permissions: UserPermissions | null;
  wasAuthenticated: boolean;
  isLoading: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  storeId: string | null;
  storeName: string | null;
  userName: string | null;
  subscriptionUntil: string | null;
  isSubscriptionExpired: boolean;
  blockingDetails: {
    isBlocked: boolean;
    reason: string;
    type?: 'expired' | 'pending_approval' | 'suspended' | string;
    title?: string;
    message?: string;
    expiryDate?: any;
    isTemporary?: boolean;
  } | null;
  logoUrl: string | null;
  newOrderCount: number;
  setUser: (user: User | null) => void;
  setUserName: (name: string | null) => void;
  setRole: (role: 'super-admin' | 'admin' | 'cashier' | null) => void;
  setPermissions: (permissions: UserPermissions | null) => void;
  setStoreId: (storeId: string | null) => void;
  setStoreName: (storeName: string | null) => void;
  setSubscriptionUntil: (val: string | null) => void;
  setIsSubscriptionExpired: (val: boolean) => void;
  setLogoUrl: (url: string | null) => void;
  setWasAuthenticated: (val: boolean) => void;
  setBlockingDetails: (details: any) => void;
  setOnline: (val: boolean) => void;
  setSyncing: (val: boolean) => void;
  setLoading: (loading: boolean) => void;
  setNewOrderCount: (count: number) => void;
  resetAll: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      permissions: null,
      wasAuthenticated: false,
      isLoading: true,
      isOnline: true,
      isSyncing: false,
      storeId: null,
      storeName: null,
      userName: null,
      subscriptionUntil: null,
      isSubscriptionExpired: false,
      logoUrl: null,
      newOrderCount: 0,
      blockingDetails: null,
      setUser: (user) => set({ user }),
      setUserName: (userName) => set({ userName }),
      setRole: (role) => set({ role }),
      setPermissions: (permissions) => set({ permissions }),
      setStoreId: (storeId) => set({ storeId }),
      setStoreName: (storeName) => set({ storeName }),
      setSubscriptionUntil: (val) => set({ subscriptionUntil: val }),
      setIsSubscriptionExpired: (val) => set({ isSubscriptionExpired: val }),
      setLogoUrl: (logoUrl) => set({ logoUrl }),
      setWasAuthenticated: (wasAuthenticated) => set({ wasAuthenticated }),
      setBlockingDetails: (blockingDetails) => set({ blockingDetails }),
      setOnline: (isOnline) => set({ isOnline }),
      setSyncing: (isSyncing) => set({ isSyncing }),
      setLoading: (isLoading) => set({ isLoading }),
      setNewOrderCount: (count) => set({ newOrderCount: count }),
      resetAll: () => set({ 
        user: null, 
        role: null, 
        permissions: null, 
        wasAuthenticated: false, 
        storeId: null, 
        storeName: null,
        userName: null,
        subscriptionUntil: null,
        isSubscriptionExpired: false,
        logoUrl: null,
        blockingDetails: null 
      }),
    }),
    {
      name: 'kasir-pro-auth-v2',
      storage: createJSONStorage(() => localStorage),
      // Only persist critical UI parts to avoid circular references in 'user'
      partialize: (state) => ({ 
        role: state.role, 
        permissions: state.permissions, 
        storeId: state.storeId, 
        storeName: state.storeName,
        userName: state.userName,
        subscriptionUntil: state.subscriptionUntil,
        isSubscriptionExpired: state.isSubscriptionExpired,
        logoUrl: state.logoUrl,
        wasAuthenticated: state.wasAuthenticated,
        blockingDetails: state.blockingDetails
      }),
    }
  )
);
