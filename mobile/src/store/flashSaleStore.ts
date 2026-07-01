import { create } from 'zustand';

export interface FlashSaleProduct {
  productId: string;
  flashPrice: number;
  flashStock: number;
  soldCount: number;
}

export interface FlashSale {
  id: string;
  storeId: string;
  name: string;
  startTime: string;   // ISO string
  endTime: string;      // ISO string
  isActive: boolean;
  products: FlashSaleProduct[];
  createdAt: string;
  createdBy: string;
}

interface FlashSaleState {
  flashSales: FlashSale[];
  setFlashSales: (flashSales: FlashSale[]) => void;
}

export const useFlashSaleStore = create<FlashSaleState>()((set) => ({
  flashSales: [],
  setFlashSales: (flashSales) => set({ flashSales }),
}));
