export interface Product {
  id?: string;
  name: string;
  price: number;
  purchasePrice?: number;
  wholesalePrice?: number;
  stock: number;
  manageStock?: boolean;
  category: string;
  unit?: string;
  sku?: string;
  barcode?: string;
  description?: string;
  extras?: string[];
  hasExtras?: boolean;
  imageUrl?: string;
  expiryDate?: string;
  createdAt?: any; // Firestore Timestamp
  updatedAt?: any;
}

export interface StockMutation {
  id?: string;
  productId: string;
  productName: string;
  type: 'masuk' | 'keluar' | 'penyesuaian';
  qty: number;
  note: string;
  timestamp: any;
  userEmail: string;
}

export interface ExtraOption {
  name: string;
  price: number;
}

export interface ProductExtra {
  id?: string;
  name: string; // Group Name, e.g., "Topping", "Level Pedas"
  options: ExtraOption[];
  isMandatory: boolean;
  allowMultiple: boolean;
  hasMaxLimit: boolean;
  maxLimit?: number;
  isActive: boolean;
}

export interface Discount {
  id?: string;
  name: string;
  type: 'percent' | 'fixed';
  value: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Transaction {
  id?: string;
  cashierId: string;
  cashierName: string;
  items: {
    productId: string;
    productName: string;
    qty: number;
    price: number;
    subtotal: number;
    selectedExtras?: {
      groupName: string;
      optionName: string;
      price: number;
    }[];
  }[];
  total: number;
  subtotal?: number;
  tax?: number;
  paymentMethod: 'cash' | 'qris' | 'transfer';
  timestamp: any;
}
