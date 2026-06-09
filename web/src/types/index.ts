export interface Product {
  id?: string;
  storeId?: string | null;
  name: string;
  price: number;
  purchasePrice?: number;
  wholesalePrice?: number;
  stock: number;
  manageStock?: boolean;
  category: string;
  variation?: string;
  unit?: string;
  sku?: string;
  barcode?: string;
  description?: string;
  extras?: string[];
  hasExtras?: boolean;
  imageUrl?: string;
  expiryDate?: string;
  entryDate?: string;
  warrantyDuration?: number;
  warrantyUnit?: 'days' | 'months' | 'years';
  createdAt?: any; // Firestore Timestamp
  updatedAt?: any;
}

export interface StockMutation {
  id?: string;
  storeId?: string | null;
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
  appliedProductIds: string[];
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
    originalPrice?: number;
    discountName?: string | null;
    note?: string;
    selectedExtras?: {
      groupName: string;
      optionName: string;
      price: number;
    }[];
    warrantyExpiry?: string;
  }[];
  total: number;
  subtotal?: number;
  tax?: number;
  paymentMethod: 'cash' | 'qris' | 'transfer';
  paymentStatus: 'paid' | 'unpaid' | 'pending' | 'partially_paid' | 'cancelled';
  paymentCategory: 'direct' | 'debt' | 'order' | 'merge';
  customerName: string;
  queueNumber?: number;
  customerId?: string | null;
  orderType?: 'dine-in' | 'takeaway' | 'online' | null;
  cashReceived?: number;
  paidAmount?: number;
  debtAmount?: number;
  change?: number;
  dueDate?: string;
  paymentHistory?: {
    id: string;
    amount: number;
    date: string;
    cashierName: string;
    note?: string;
  }[];
  timestamp: any;
  orderStatus?: 'new' | 'processing' | 'ready' | 'completed' | 'cancelled';
  storeId?: string;
}

export interface Customer {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  totalOrders?: number;
  totalSpent?: number;
  points?: number;
  orders?: number;
  createdAt?: any;
}

export interface CashFlow {
  id?: string;
  type: 'in' | 'out';
  category: 'penjualan' | 'operasional' | 'modal' | 'lainnya';
  amount: number;
  description: string;
  timestamp: any;
  userEmail: string;
}

export interface CashierSession {
  id?: string;
  cashierId: string;
  cashierName: string;
  timestamp: any; // closing time
  systemCalculatedCash: number; // sum of cash sales since last close
  actualCash: number; // inputted by the cashier
  difference: number; // actual - system
  note?: string;
}

export interface Shift {
  id?: string;
  storeId: string;
  userId: string;
  userName: string;
  startTime: any;
  endTime?: any | null;
  startingCash: number;
  systemCalculatedCash: number;
  actualCash: number;
  notes?: string;
  status: 'open' | 'closed';
}
export interface Estimation {
  id?: string;
  storeId?: string;
  cashierId: string;
  cashierName: string;
  items: {
    productId: string | 'manual';
    productName: string;
    qty: number;
    price: number;
    subtotal: number;
    note?: string | null;
  }[];
  total: number;
  subtotal: number;
  tax: number;
  customerName: string;
  customerId?: string | null;
  timestamp: any;
  validUntil: string; // ISO String
  status: 'active' | 'converted';
}
