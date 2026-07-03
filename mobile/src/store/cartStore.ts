import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
  imageUrl?: string;
  storeId: string;
  storeName: string;
  stock: number;
}

interface CartState {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'qty'>) => void;
  updateQty: (productId: string, delta: number) => void;
  setQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearStoreCart: (storeId: string) => void;
  clearAll: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      
      addToCart: (item) => set((state) => {
        const existingIndex = state.items.findIndex(i => i.productId === item.productId);
        if (existingIndex >= 0) {
          const newItems = [...state.items];
          // Check stock limit
          if (newItems[existingIndex].qty < item.stock) {
            newItems[existingIndex].qty += 1;
          }
          return { items: newItems };
        } else {
          return { items: [...state.items, { ...item, qty: 1 }] };
        }
      }),
      
      updateQty: (productId, delta) => set((state) => {
        const newItems = state.items.map(item => {
          if (item.productId === productId) {
            const newQty = item.qty + delta;
            // Ensure qty is between 1 and stock limit
            if (newQty >= 1 && newQty <= item.stock) {
              return { ...item, qty: newQty };
            }
          }
          return item;
        });
        return { items: newItems };
      }),

      setQty: (productId, qty) => set((state) => {
        const newItems = state.items.map(item => {
          if (item.productId === productId) {
            let validQty = qty;
            if (validQty < 1) validQty = 1;
            if (validQty > item.stock) validQty = item.stock;
            return { ...item, qty: validQty };
          }
          return item;
        });
        return { items: newItems };
      }),
      
      removeFromCart: (productId) => set((state) => ({
        items: state.items.filter(i => i.productId !== productId)
      })),
      
      clearStoreCart: (storeId) => set((state) => ({
        items: state.items.filter(i => i.storeId !== storeId)
      })),
      
      clearAll: () => set({ items: [] })
    }),
    {
      name: 'marketplace-cart-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
