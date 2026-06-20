import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from './authStore';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: string; // ISO string
  isRead: boolean;
  userId?: string | null;
  data?: any;
}

interface NotificationState {
  notifications: NotificationItem[];
  addNotification: (notification: Omit<NotificationItem, 'id' | 'timestamp' | 'isRead'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  getUnreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      addNotification: (n) => {
        const currentUserId = useAuthStore.getState().user?.uid || null;
        const newItem: NotificationItem = {
          ...n,
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toISOString(),
          isRead: false,
          userId: currentUserId,
        };
        set((state) => ({
          notifications: [newItem, ...state.notifications].slice(0, 50), // Keep last 50
        }));
      },
      markAsRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
        }));
      },
      markAllAsRead: () => {
        const currentUserId = useAuthStore.getState().user?.uid || null;
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.userId === currentUserId ? { ...n, isRead: true } : n
          ),
        }));
      },
      clearAll: () => {
        const currentUserId = useAuthStore.getState().user?.uid || null;
        set((state) => ({
          notifications: state.notifications.filter((n) => n.userId !== currentUserId),
        }));
      },
      getUnreadCount: () => {
        const currentUserId = useAuthStore.getState().user?.uid || null;
        return get().notifications.filter((n) => n.userId === currentUserId && !n.isRead).length;
      },
    }),
    {
      name: 'kasir-pro-mobile-notifications',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
