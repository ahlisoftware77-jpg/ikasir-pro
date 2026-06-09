'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  collection, 
  addDoc, 
  getDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  writeBatch, 
  increment,
  updateDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Product, ProductExtra, ExtraOption, Customer, Discount } from '@/types';
import { useAuthStore } from '@/store/auth';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Printer, 
  CheckCircle2, 
  X, 
  Settings2, 
  Check, 
  Loader2, 
  Package, 
  Scan,
  UserPlus,
  Utensils,
  ChevronDown,
  Users,
  Lock,
  Unlock,
  StickyNote,
  ClipboardList,
  PlusCircle,
  FileText,
  LayoutGrid,
  List,
  LayoutList
} from 'lucide-react';
import { printReceipt } from '@/lib/printReceipt';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useBranding } from '@/context/BrandingContext';
import toast from 'react-hot-toast';
import { logActivity } from '@/lib/activity';

interface SelectedExtra {
  groupName: string;
  optionName: string;
  price: number;
}

interface CartItem extends Product {
  uniqueId: string;
  cartQty: number;
  selectedExtras: SelectedExtra[];
  displayPrice: number;
  originalPrice: number;
  discountName: string | null;
  note: string; // Per-item note
}

export default function POSPage() {
  const { user, userName, role, storeId, setSyncing, isOnline } = useAuthStore();
  const { branding } = useBranding();
  const [products, setProducts] = useState<Product[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // New States for Expanded POS Features
  const [paymentCategory, setPaymentCategory] = useState<'direct' | 'debt' | 'order' | 'merge'>('direct');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'transfer'>('cash');
  const [customerQuery, setCustomerQuery] = useState('');
  const [suggestions, setSuggestions] = useState<{id: string, name: string}[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<{id: string, name: string} | null>(null);
  const [useOrderType, setUseOrderType] = useState(false);
  const [orderType, setOrderType] = useState<'dine-in' | 'takeaway'>('dine-in');
  const [activeOrders, setActiveOrders] = useState<{id: string, customerName: string, total: number, paymentStatus?: string}[]>([]);
  const [selectedOrderToMerge, setSelectedOrderToMerge] = useState<string>('');

  const [cashReceived, setCashReceived] = useState<string>('');
  const [debtDownPayment, setDebtDownPayment] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [storeSettings, setStoreSettings] = useState({ 
    useTax: true, 
    taxRate: 11, 
    storeName: '', 
    phone: '', 
    address: '', 
    receiptMessage: '', 
    paperSize: '58mm',
    logoUrl: '',
    showLogoOnReceipt: true,
    showReceiptAddress: true,
    showReceiptPhone: true,
    showReceiptCustomer: true,
    showReceiptCashier: true,
    showReceiptSubtotal: true,
    qrisUrl: '',
    bankInfo: ''
  });
  const [successTrx, setSuccessTrx] = useState<any>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMobileDetailsExpanded, setIsMobileDetailsExpanded] = useState(false);
  const [isMobileSettingsExpanded, setIsMobileSettingsExpanded] = useState(false);
  const [isDesktopSettingsExpanded, setIsDesktopSettingsExpanded] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [showScanner, setShowScanner] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<any>(null);
  
  // New States for Cashier Close
  const [isCloseCashierModalOpen, setIsCloseCashierModalOpen] = useState(false);
  const [actualCash, setActualCash] = useState('');
  const [closeNote, setCloseNote] = useState('');
  
  // New States for Customer Modals
  const [isCustomerSelectModalOpen, setIsCustomerSelectModalOpen] = useState(false);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [modalSearch, setModalSearch] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  // Extras Modal States
  const [activeExtrasProduct, setActiveExtrasProduct] = useState<Product | null>(null);
  const [availableExtraGroups, setAvailableExtraGroups] = useState<ProductExtra[]>([]);
  const [tempSelections, setTempSelections] = useState<Record<string, ExtraOption[]>>({}); // groupId -> selected options
  const [isLodingExtras, setIsLoadingExtras] = useState(false);
  const [lastScannedProduct, setLastScannedProduct] = useState<Product | null>(null);
  const [scanNotFound, setScanNotFound] = useState<string | null>(null);

  // ESTIMATION & MANUAL ITEM STATES
  const [isManualItemModalOpen, setIsManualItemModalOpen] = useState(false);
  const [manualItemName, setManualItemName] = useState('');
  const [manualItemPrice, setManualItemPrice] = useState('');
  const [saveToCatalog, setSaveToCatalog] = useState(false);
  const [manualItemCategory, setManualItemCategory] = useState('Lainnya');
  const [estimationValidityDays, setEstimationValidityDays] = useState(7);
  const [editingEstimationId, setEditingEstimationId] = useState<string | null>(null);
  const [originalEstimationData, setOriginalEstimationData] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'tiles' | 'list' | 'detail'>('tiles');

  useEffect(() => {
    const savedViewMode = localStorage.getItem('pos_view_mode') as 'tiles' | 'list' | 'detail';
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
  }, []);

  const handleSetViewMode = (mode: 'tiles' | 'list' | 'detail') => {
    setViewMode(mode);
    localStorage.setItem('pos_view_mode', mode);
  };

  // --- SHIFT CHECK FOR POS LOCKING ---
  const [activeShift, setActiveShift] = useState<any>(null);
  const [isShiftChecking, setIsShiftChecking] = useState(true);

  useEffect(() => {
    if (!storeId || !user) return;

    // --- CHECK FOR ESTIMATION LOAD REQUEST ---
    const storedEstimate = localStorage.getItem('kasir_pro_pos_load_estimate');
    const editId = localStorage.getItem('kasir_pro_pos_edit_est_id');
    
    if (storedEstimate) {
      try {
        const estData = JSON.parse(storedEstimate);
        if (estData.items && estData.items.length > 0) {
          const itemsToLoad = estData.items.map((item: any) => ({
            ...item,
            id: item.productId === 'manual' ? undefined : item.productId,
            uniqueId: `${item.productId || 'manual'}-${Math.random().toString(36).substring(2, 9)}`,
            cartQty: item.qty,
            displayPrice: item.price,
            originalPrice: item.price,
            selectedExtras: [], 
            note: item.note || '',
            name: item.productName || item.name
          }));
          setCart(itemsToLoad);
          setCustomerQuery(estData.customerName || '');
          
          if (editId) {
            setEditingEstimationId(editId);
            setOriginalEstimationData(estData);
            toast.success(`Mengedit Estimasi: ${editId}`);
          } else {
            toast.success('Estimasi berhasil dimuat ke keranjang!');
          }
        }
        localStorage.removeItem('kasir_pro_pos_load_estimate');
        localStorage.removeItem('kasir_pro_pos_edit_est_id');
      } catch (err) {
        console.error("Error loading estimate:", err);
      }
    }

    const q = query(
      collection(db, 'shifts'),
      where('storeId', '==', storeId),
      where('userId', '==', user.uid),
      where('status', '==', 'open'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setActiveShift({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setActiveShift(null);
      }
      setIsShiftChecking(false);
    });

    return () => unsubscribe();
  }, [storeId, user]);
  // ------------------------------------

  // --- ANDROID BACK BUTTON SUPPORT ---
  const closeAllModals = () => {
    setIsCartOpen(false);
    setIsPreviewModalOpen(false);
    setSuccessTrx(null);
    setIsCustomerSelectModalOpen(false);
    setIsAddCustomerModalOpen(false);
    setIsCloseCashierModalOpen(false);
    setActiveExtrasProduct(null);
    setShowScanner(false);
  };

  useEffect(() => {
    const isNowOpen = isCartOpen || isPreviewModalOpen || !!successTrx || isCustomerSelectModalOpen || isAddCustomerModalOpen || isCloseCashierModalOpen || !!activeExtrasProduct || showScanner || !!viewingReceipt;
    
    if (isNowOpen) {
      window.history.pushState({ modal: true }, '');
    }

    const handlePopState = (e: PopStateEvent) => {
      if (isCartOpen || isPreviewModalOpen || successTrx || isCustomerSelectModalOpen || isAddCustomerModalOpen || isCloseCashierModalOpen || activeExtrasProduct || showScanner || viewingReceipt) {
        if (viewingReceipt) {
          setViewingReceipt(null);
        } else {
          closeAllModals();
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isCartOpen, isPreviewModalOpen, successTrx, isCustomerSelectModalOpen, isAddCustomerModalOpen, isCloseCashierModalOpen, activeExtrasProduct, showScanner, !!viewingReceipt]);
  // -----------------------------------

  const resetPOSState = () => {
    setCart([]);
    setCashReceived('');
    setDebtDownPayment('');
    setDueDate('');
    setCustomerQuery('');
    setSelectedCustomer(null);
    setPaymentCategory('direct');
    setUseOrderType(false);
    setSelectedOrderToMerge('');
  };

  // Fetch customer suggestions (Debounced with local case-insensitive substring search)
  useEffect(() => {
    if (customerQuery.length < 1 || selectedCustomer?.name === customerQuery) {
      setSuggestions([]);
      return;
    }

    const fetchCustomers = async () => {
      try {
        let list = allCustomers;
        if (list.length === 0) {
          const q = query(collection(db, 'customers'), where('storeId', '==', storeId));
          const snap = await getDocs(q);
          list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
          setAllCustomers(list);
        }
        
        const qLower = customerQuery.toLowerCase();
        const filtered = list.filter(c => c.name.toLowerCase().includes(qLower)).slice(0, 5);
        setSuggestions(filtered.map(c => ({ id: c.id!, name: c.name })));
      } catch (err) {
        console.error("Error searching customers:", err);
      }
    };

    const debounce = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(debounce);
  }, [customerQuery, selectedCustomer, allCustomers, storeId]);

  // Fetch active orders for merging
  useEffect(() => {
    if (paymentCategory === 'merge') {
      const q = query(
        collection(db, 'transactions'), 
        where('storeId', '==', storeId),
        where('paymentStatus', 'in', ['pending', 'unpaid', 'partially_paid']),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({
          id: doc.id,
          customerName: doc.data().customerName || 'Tanpa Nama',
          total: doc.data().total,
          paymentStatus: doc.data().paymentStatus
        }));
        setActiveOrders(orders);
      });
      return () => unsubscribe();
    }
  }, [paymentCategory]);

  const handleSaveNewCustomer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCustomerName.trim()) return;
    setIsProcessing(true);
    try {
      const docRef = await addDoc(collection(db, 'customers'), {
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
        createdAt: new Date(),
        totalOrders: 0,
        storeId: storeId
      });
      setSelectedCustomer({ id: docRef.id, name: newCustomerName.trim() });
      setCustomerQuery(newCustomerName.trim());
      setSuggestions([]);
      setIsAddCustomerModalOpen(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      toast.success(`Pelanggan "${newCustomerName}" berhasil disimpan!`);
    } catch (err) {
      console.error(err);
      toast.error("Gagal simpan pelanggan.");
    } finally {
      setIsProcessing(false);
    }
  };

  const openSelectModal = async () => {
    setIsCustomerSelectModalOpen(true);
    setIsProcessing(true);
    try {
      const q = query(
        collection(db, 'customers'), 
        where('storeId', '==', storeId),
        orderBy('name', 'asc')
      );
      const querySnapshot = await getDocs(q);
      const custs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setAllCustomers(custs);
    } catch (err) {
      console.error("Error fetching customers:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    // Fetch Products
    const q = query(
      collection(db, 'products'),
      where('storeId', '==', storeId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach((doc) => {
        prods.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(prods);
    });

    // Fetch Discounts
    const qDisc = query(
      collection(db, 'discounts'),
      where('storeId', '==', storeId),
      where('isActive', '==', true)
    );
    const unsubscribeDisc = onSnapshot(qDisc, (snapshot) => {
      const items: Discount[] = [];
      const now = new Date();
      snapshot.forEach((doc) => {
        const d = { id: doc.id, ...doc.data() } as Discount;
        const start = new Date(d.startDate);
        const end = d.endDate ? new Date(d.endDate) : null;
        if (now >= start && (!end || now <= end)) {
          items.push(d);
        }
      });
      setDiscounts(items);
    });

    // Fetch Settings
    const fetchSettings = async () => {
      if (!storeId) return;
      try {
        const docSnap = await getDoc(doc(db, 'settings', `store_${storeId}`));
        if (docSnap.exists()) {
          const data = docSnap.data();
            setStoreSettings({ 
              useTax: data.useTax !== false, 
              taxRate: data.taxRate || 0,
              storeName: data.storeName || '',
              phone: data.phone || '',
              address: data.address || '',
              receiptMessage: data.receiptMessage || '',
              paperSize: data.paperSize || '58mm',
              logoUrl: data.logoUrl || '',
              showLogoOnReceipt: data.showLogoOnReceipt !== false,
              showReceiptAddress: data.showReceiptAddress !== false,
              showReceiptPhone: data.showReceiptPhone !== false,
              showReceiptCustomer: data.showReceiptCustomer !== false,
              showReceiptCashier: data.showReceiptCashier !== false,
              showReceiptSubtotal: data.showReceiptSubtotal !== false,
              qrisUrl: data.qrisUrl || '',
              bankInfo: data.bankInfo || ''
            });
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };
    fetchSettings();

    return () => {
      unsubscribe();
      unsubscribeDisc();
    };
  }, [storeId]);

  // Expose cart state to global for navigation guard
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__isCartNotEmpty = cart.length > 0;
    }
    return () => {
      if (typeof window !== 'undefined') {
        (window as any).__isCartNotEmpty = false;
      }
    };
  }, [cart]);

  const filteredProducts = products.filter(p => {
    const s = search.toLowerCase().trim();
    if (!s) return true;
    return (
      p.name.toLowerCase().includes(s) || 
      (p.sku && p.sku.toLowerCase().includes(s)) ||
      (p.barcode && p.barcode.toLowerCase().includes(s))
    );
  });

  const getEffectivePrice = (product: Product) => {
    // Find discounts applicable to this product
    const applicable = discounts.filter(d => d.appliedProductIds?.includes(product.id!));
    
    if (applicable.length === 0) return { price: product.price, discountInfo: null };

    // Calculate best price
    let bestPrice = product.price;
    let selectedDiscount: Discount | null = null;

    for (const d of applicable) {
      let currentPrice = product.price;
      if (d.type === 'percent') {
        currentPrice = product.price * (1 - d.value / 100);
      } else {
        currentPrice = Math.max(0, product.price - d.value);
      }

      if (currentPrice < bestPrice) {
        bestPrice = currentPrice;
        selectedDiscount = d;
      }
    }

    return { 
      price: Math.round(bestPrice), 
      discountInfo: selectedDiscount ? { name: selectedDiscount.name, originalPrice: product.price } : null 
    };
  };

  const handleBarcodeScan = (data: string) => {
    // Find product by SKU or Barcode
    const product = products.find(p => p.barcode === data || p.sku === data);
    if (product) {
      addToCart(product);
      setLastScannedProduct(product);
      setScanNotFound(null);
      // Auto-clear after 4 seconds
      setTimeout(() => setLastScannedProduct(null), 4000);
    } else {
      setLastScannedProduct(null);
      setScanNotFound(data);
      // Auto-clear after 4 seconds
      setTimeout(() => setScanNotFound(null), 4000);
    }
  };

  const addToCart = async (product: Product) => {
    // Check if product has extras
    if (product.hasExtras && product.extras && product.extras.length > 0) {
      setActiveExtrasProduct(product);
      setTempSelections({});
      setIsLoadingExtras(true);
      
      try {
        // Fetch detailed extra groups for this product
        const groups: ProductExtra[] = [];
        for (const extraId of product.extras) {
          const docSnap = await getDoc(doc(db, 'product_extras', extraId));
          if (docSnap.exists()) {
            groups.push({ id: docSnap.id, ...docSnap.data() } as ProductExtra);
          }
        }
        setAvailableExtraGroups(groups);
      } catch (err) {
        console.error("Error fetching extras:", err);
      } finally {
        setIsLoadingExtras(false);
      }
      return; // Stop here, modal will take over
    }

    // Standard add to cart logic (no extras)
    const uniqueId = product.id!;
    const { price: displayPrice, discountInfo } = getEffectivePrice(product);

    setCart(prev => {
      const existing = prev.find(item => item.uniqueId === uniqueId);
      if (existing) {
        if (product.manageStock !== false && existing.cartQty >= product.stock) {
          toast.error('Stok tidak mencukupi!');
          return prev;
        }
        return prev.map(item => item.uniqueId === uniqueId ? { ...item, cartQty: item.cartQty + 1 } : item);
      }
      if (product.manageStock !== false && product.stock <= 0) {
        toast.error('Stok habis!');
        return prev;
      }
      return [...prev, { 
        ...product, 
        uniqueId, 
        cartQty: 1, 
        selectedExtras: [], 
        displayPrice, 
        originalPrice: product.price,
        discountName: discountInfo?.name || null,
        note: '' 
      }];
    });
  };

  const confirmExtrasToCart = () => {
    if (!activeExtrasProduct) return;

    // Validate mandatory selections
    for (const group of availableExtraGroups) {
      if (group.isMandatory && (!tempSelections[group.id!] || tempSelections[group.id!].length === 0)) {
        toast.error(`Harap pilih setidaknya satu opsi untuk ${group.name}`);
        return;
      }
    }

    const selectedExtras: SelectedExtra[] = [];
    let extrasTotal = 0;
    
    Object.entries(tempSelections).forEach(([groupId, options]) => {
      const group = availableExtraGroups.find(g => g.id === groupId);
      options.forEach(opt => {
        selectedExtras.push({
          groupName: group?.name || '',
          optionName: opt.name,
          price: opt.price
        });
        extrasTotal += opt.price;
      });
    });

    const { price: baseDiscountedPrice, discountInfo } = getEffectivePrice(activeExtrasProduct);
    const finalPrice = baseDiscountedPrice + extrasTotal;
    const extrasKey = selectedExtras.map(e => `${e.groupName}:${e.optionName}`).sort().join('|');
    const uniqueId = `${activeExtrasProduct.id}-${extrasKey}`;

    setCart(prev => {
      const existing = prev.find(item => item.uniqueId === uniqueId);
      if (existing) {
        if (activeExtrasProduct.manageStock !== false && existing.cartQty >= (activeExtrasProduct.stock || 0)) {
          toast.error('Stok tidak mencukupi!');
          return prev;
        }
        return prev.map(item => item.uniqueId === uniqueId ? { ...item, cartQty: item.cartQty + 1 } : item);
      }
      return [...prev, { 
        ...activeExtrasProduct, 
        uniqueId, 
        cartQty: 1, 
        selectedExtras, 
        displayPrice: finalPrice, 
        originalPrice: activeExtrasProduct.price + extrasTotal,
        discountName: discountInfo?.name || null,
        note: '' 
      }];
    });

    setActiveExtrasProduct(null);
  };

  const toggleOption = (group: ProductExtra, option: ExtraOption) => {
    const current = tempSelections[group.id!] || [];
    const isSelected = current.some(o => o.name === option.name);

    let next: ExtraOption[] = [];
    if (isSelected) {
      next = current.filter(o => o.name !== option.name);
    } else {
      if (!group.allowMultiple) {
        next = [option]; // Radio behavior
      } else {
        if (group.hasMaxLimit && current.length >= (group.maxLimit || 1)) {
          toast.error(`Maksimal pilihan untuk ${group.name} adalah ${group.maxLimit}`);
          return;
        }
        next = [...current, option];
      }
    }
    setTempSelections({ ...tempSelections, [group.id!]: next });
  };

  const updateQty = (uniqueId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.uniqueId === uniqueId) {
          const newQty = item.cartQty + delta;
          if (newQty <= 0) return null; // remove
          if (item.manageStock !== false && newQty > (item.stock || 0)) {
            toast.error('Stok tidak mencukupi!');
            return item;
          }
          return { ...item, cartQty: newQty };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const setQty = (uniqueId: string, value: string) => {
    const num = parseInt(value);
    if (isNaN(num)) return;
    
    setCart(prev => {
      return prev.map(item => {
        if (item.uniqueId === uniqueId) {
          if (num <= 0) return null; // remove
          if (item.manageStock !== false && num > (item.stock || 0)) {
            toast.error('Stok tidak mencukupi!');
            return item;
          }
          return { ...item, cartQty: num };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (uniqueId: string) => {
    setCart(prev => prev.filter(item => item.uniqueId !== uniqueId));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.displayPrice * item.cartQty), 0);
  const tax = storeSettings.useTax ? subtotal * (storeSettings.taxRate / 100) : 0;
  const total = subtotal + tax;
  const change = Number(cashReceived || 0) - total;

  const validateBeforeCheckout = () => {
    if (cart.length === 0) return false;
    
    // Validations
    if (paymentCategory === 'direct' && paymentMethod === 'cash' && Number(cashReceived || 0) < total) {
      toast.error('Uang tunai kurang!');
      return false;
    }
    
    if ((paymentCategory === 'debt' || paymentCategory === 'order') && !customerQuery) {
      toast.error('Nama pelanggan wajib diisi!');
      return false;
    }
    
    if (paymentCategory === 'merge' && !selectedOrderToMerge) {
      toast.error('Harap pilih pesanan yang akan digabungkan!');
      return false;
    }

    return true;
  };

  const openPreview = () => {
    if (validateBeforeCheckout()) {
      setIsPreviewModalOpen(true);
      setIsCartOpen(false); // Close mobile cart if open
    }
  };

  const handleResetTransaction = () => {
    if (cart.length > 0 && !confirm('Yakin ingin mereset transaksi ini? Semua data keranjang akan terhapus.')) return;
    setCart([]);
    setCashReceived('');
    setDebtDownPayment('');
    setDueDate('');
    setCustomerQuery('');
    setSelectedCustomer(null);
    setPaymentCategory('direct');
    setUseOrderType(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        handleResetTransaction();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart.length]);

  const playSuccessSound = () => {
    const audio = new Audio('/sound/bayar.mp3');
    audio.play().catch(err => console.error("Gagal memutar suara:", err));
  };

  const handleCheckout = async () => {
    if (!validateBeforeCheckout()) return;

    setIsProcessing(true);
    setSyncing(true);
    
    try {
      let finalDocId = '';
      const localNow = new Date();
      const transactionData: any = {
        cashierId: user?.uid,
        cashierName: userName || user?.displayName || 'Admin',
        items: cart.map(item => {
          let warrantyExpiry = null;
          if (item.warrantyDuration && item.warrantyDuration > 0) {
            const expiry = new Date();
            if (item.warrantyUnit === 'days') {
              expiry.setDate(expiry.getDate() + item.warrantyDuration);
            } else if (item.warrantyUnit === 'years') {
              expiry.setFullYear(expiry.getFullYear() + item.warrantyDuration);
            } else {
              // Default to months
              expiry.setMonth(expiry.getMonth() + item.warrantyDuration);
            }
            warrantyExpiry = expiry.toISOString();
          }

          return {
            productId: item.id || 'manual',
            productName: item.name,
            qty: item.cartQty,
            price: item.displayPrice,
            subtotal: item.displayPrice * item.cartQty,
            originalPrice: item.originalPrice,
            discountName: item.discountName,
            selectedExtras: item.selectedExtras || [],
            note: item.note?.trim() || null,
            warrantyExpiry
          };
        }),
        subtotal: subtotal,
        tax: tax,
        total: total,
        timestamp: serverTimestamp(),
        customerName: customerQuery.trim() || 'Tanpa Nama',
        customerId: selectedCustomer?.id || null,
        orderType: useOrderType ? orderType : null,
        paymentCategory: paymentCategory,
        orderStatus: (paymentCategory === 'order' || useOrderType) ? 'new' : 'completed',
        dueDate: dueDate || null,
        storeId: storeId
      };

      if (paymentCategory === 'direct') {
        transactionData.paymentStatus = 'paid';
        transactionData.paymentMethod = paymentMethod;
        if (paymentMethod === 'cash') {
          transactionData.cashReceived = Number(cashReceived);
          transactionData.change = Number(cashReceived) - total;
        }
      } else if (paymentCategory === 'debt') {
        const dp = Number(debtDownPayment || 0);
        transactionData.paymentStatus = dp >= total ? 'paid' : (dp > 0 ? 'partially_paid' : 'unpaid');
        transactionData.paidAmount = dp;
        transactionData.debtAmount = Math.max(0, total - dp);
        transactionData.paymentMethod = dp > 0 ? 'cash' : null;
        if (dp > 0) {
          transactionData.paymentHistory = [{
            id: Math.random().toString(36).substring(2, 9),
            date: localNow.toISOString(),
            amount: dp,
            cashierName: userName || user?.displayName || 'Kasir',
            note: 'Pembayaran Awal (DP)'
          }];
        } else {
          transactionData.paymentHistory = [];
        }
      } else if (paymentCategory === 'order') {
        transactionData.paymentStatus = 'pending';
      } else if (paymentCategory === 'merge') {
        transactionData.paymentStatus = 'pending'; 
      }

      // HELPER: Offline Fallback Logic (Non-blocking for UI)
      const performOfflineCheckout = async () => {
        const batch = writeBatch(db);
        const randomId = doc(collection(db, 'transactions')).id;
        finalDocId = `OFF-${randomId.substring(0, 8).toUpperCase()}`;
        transactionData.id = finalDocId;
        transactionData.offline = true;
        transactionData.isOfflineTemp = true;

        batch.set(doc(db, 'transactions', finalDocId), transactionData);
        for (const item of cart) {
          if (item.manageStock !== false) {
            batch.update(doc(db, 'products', item.id!), { stock: increment(-item.cartQty) });
          }
        }
        
        // Finalize UI state BEFORE awaiting commit for instant feedback
        setIsPreviewModalOpen(false);
        resetPOSState();
        setSuccessTrx({ 
          ...transactionData,
          id: finalDocId, 
          total: total, 
          change: Number(cashReceived) - total,
          paymentMethod: paymentCategory === 'direct' ? paymentMethod.toUpperCase() : paymentCategory.toUpperCase(),
        });
        playSuccessSound();

        // Background commit (no await for UI thread)
        batch.commit().then(() => {
          toast.success('Transaksi disimpan lokal (Offline).');
        }).catch(err => {
          console.error("Offline commit error:", err);
          toast.error("Gagal simpan lokal. Periksa storage HP.");
        });
      };

      // MAIN LOGIC: Try Online first, fallback to Offline if slow or error
      try {
        // We only try online if the browser says we are online to avoid unnecessary hangs
        if (!isOnline) {
          await performOfflineCheckout();
          return;
        }

        // Attempt Online Transaction with 2.5 Second Timeout
        await Promise.race([
          runTransaction(db, async (t) => {
            const settingsRef = doc(db, 'settings', `store_${storeId}`);
            const settingsDoc = await t.get(settingsRef);
            
            if (paymentCategory === 'merge') {
              const orderRef = doc(db, 'transactions', selectedOrderToMerge!);
              const orderSnap = await t.get(orderRef);
              
              if (orderSnap.exists()) {
                const existingData = orderSnap.data();
                const mergedItems = [...existingData.items, ...transactionData.items];
                const newTotal = existingData.total + total;
                const updateData: any = {
                  items: mergedItems,
                  total: newTotal,
                  subtotal: (existingData.subtotal || 0) + subtotal,
                  tax: (existingData.tax || 0) + tax,
                  lastUpdate: serverTimestamp()
                };

                if (existingData.paymentCategory === 'debt') {
                   const dp = existingData.paidAmount || 0;
                   updateData.debtAmount = Math.max(0, newTotal - dp);
                   updateData.paymentStatus = (newTotal - dp) > 0 ? (dp > 0 ? 'partially_paid' : 'unpaid') : 'paid';
                }

                t.update(orderRef, updateData);
                finalDocId = selectedOrderToMerge!;
              }
            } else {
              // DETECT WHICH COUNTER TO USE
              let counterKey = 'trxCounter';
              let prefixKey = 'trxPrefix';
              let paddingKey = 'trxPadding';
              let defaultPrefix = 'TRX-';

              if (paymentCategory === 'debt') {
                counterKey = 'debCounter';
                prefixKey = 'debPrefix';
                paddingKey = 'debPadding';
                defaultPrefix = 'DEB-';
              } else if (paymentCategory === 'order' || useOrderType) {
                counterKey = 'ordCounter';
                prefixKey = 'ordPrefix';
                paddingKey = 'ordPadding';
                defaultPrefix = 'ORD-';
              }

              let currentCounter = 0;
              let prefix = defaultPrefix;
              let padding = 4;
              
              if (settingsDoc.exists()) {
                const data = settingsDoc.data();
                currentCounter = Number(data[counterKey]) || 0;
                prefix = data[prefixKey] !== undefined ? data[prefixKey] : defaultPrefix;
                padding = Number(data[paddingKey]) || 4;
              }
              
              currentCounter += 1;
              finalDocId = `${prefix}${String(currentCounter).padStart(padding, '0')}`;
              transactionData.id = finalDocId;
              transactionData.queueNumber = currentCounter;
              transactionData.offline = false;
              
              t.set(doc(db, 'transactions', finalDocId), transactionData);
              t.set(settingsRef, { [counterKey]: currentCounter }, { merge: true });
            }

            for (const item of cart) {
              if (item.manageStock !== false) {
                t.update(doc(db, 'products', item.id!), { stock: increment(-item.cartQty) });
              }
            }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
        ]);

        // Success Path (Online)
        setIsPreviewModalOpen(false);
        resetPOSState();
        setSuccessTrx({ 
          ...transactionData,
          id: finalDocId, 
          total: total, 
          change: Number(cashReceived) - total,
          paymentMethod: paymentCategory === 'direct' ? paymentMethod.toUpperCase() : paymentCategory.toUpperCase(),
        });
        playSuccessSound();

        // BACKGROUND TASKS
        logActivity({
          userId: user?.uid || 'unknown',
          userName: user?.displayName || user?.email || 'Kasir',
          userEmail: user?.email || '-',
          storeId: storeId || 'unknown',
          action: 'CHECKOUT',
          description: `Transaksi berhasil: ${finalDocId}`,
          metadata: { trxId: finalDocId, total: total, isOfflineFallback: finalDocId.startsWith('OFF-') }
        }).catch(() => {});

      } catch (err: any) {
        if (err.message === 'timeout') {
          console.warn("Transaction timeout, trying offline...");
          await performOfflineCheckout();
        } else {
          console.error("Online checkout error:", err);
          toast.error("Gagal memproses transaksi online.");
        }
      } finally {
        setIsProcessing(false);
      }
    } catch (err) {
      console.error("Checkout Fatal Error:", err);
      toast.error('Gagal memproses transaksi. Silakan coba lagi.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveEstimation = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);

    try {
      const localNow = new Date();
      
      // Decide ID and Expiry
      let finalEstId = editingEstimationId || '';
      let finalNumber = originalEstimationData?.number || 0;
      let finalValidUntil = originalEstimationData?.validUntil || '';

      if (!finalValidUntil) {
        const validUntilDate = new Date();
        validUntilDate.setDate(localNow.getDate() + (Number(estimationValidityDays) || 30));
        finalValidUntil = validUntilDate.toISOString();
      }

      const estimationData: any = {
        storeId: storeId,
        cashierId: user?.uid,
        cashierName: userName || user?.displayName || 'Kasir',
        customerName: customerQuery.trim() || 'Tanpa Nama',
        customerId: selectedCustomer?.id || null,
        items: cart.map(item => ({
          productId: item.id || 'manual',
          productName: item.name,
          qty: item.cartQty,
          price: item.displayPrice,
          subtotal: item.displayPrice * item.cartQty,
          note: item.note?.trim() || null
        })),
        subtotal,
        tax,
        total,
        timestamp: serverTimestamp(),
        validUntil: finalValidUntil,
        status: 'active'
      };

      if (editingEstimationId) {
        // UPDATE MODE
        estimationData.id = editingEstimationId;
        estimationData.number = finalNumber;
        await updateDoc(doc(db, 'estimations', editingEstimationId), estimationData);
        setEditingEstimationId(null);
        setOriginalEstimationData(null);
      } else {
        // NEW MODE
        await runTransaction(db, async (t) => {
          const settingsRef = doc(db, 'settings', `store_${storeId}`);
          const settingsDoc = await t.get(settingsRef);
          
          let currentCounter = 0;
          let prefix = 'EST-';
          let padding = 4;

          if (settingsDoc.exists()) {
            const data = settingsDoc.data();
            currentCounter = Number(data.estCounter) || 0;
            prefix = data.estPrefix !== undefined ? data.estPrefix : 'EST-';
            padding = Number(data.estPadding) || 4;
          }

          currentCounter += 1;
          finalEstId = `${prefix}${String(currentCounter).padStart(padding, '0')}`;
          finalNumber = currentCounter;
          
          estimationData.id = finalEstId;
          estimationData.number = finalNumber;

          t.set(doc(db, 'estimations', finalEstId), estimationData);
          t.set(settingsRef, { estCounter: currentCounter }, { merge: true });
        });
      }
      
      setIsPreviewModalOpen(false);
      resetPOSState();
      toast.success(editingEstimationId ? 'Estimasi diperbarui!' : 'Estimasi berhasil disimpan!');
      
      setViewingReceipt({
        ...estimationData,
        id: finalEstId,
        isEstimation: true,
        timestamp: { toDate: () => localNow }
      });

    } catch (error) {
      console.error("Save estimation error:", error);
      toast.error("Gagal menyimpan estimasi.");
    } finally {
      setIsProcessing(false);
    }
  };

  const addManualItem = async () => {
    if (!manualItemName || !manualItemPrice) {
      toast.error('Nama dan Harga harus diisi!');
      return;
    }

    const price = Number(manualItemPrice);
    const uniqueId = `manual-${Math.random().toString(36).substring(2, 9)}`;
    let finalId: string | undefined = undefined;

    if (saveToCatalog) {
      setIsProcessing(true);
      try {
        const prodData = {
          storeId,
          name: manualItemName,
          price,
          originalPrice: price,
          stock: 999,
          manageStock: false,
          category: manualItemCategory,
          createdAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, 'products'), prodData);
        finalId = docRef.id;
        toast.success(`Produk "${manualItemName}" disimpan ke katalog`);
      } catch (err) {
        console.error("Save to catalog error:", err);
        toast.error("Gagal simpan ke katalog, tapi item tetap masuk keranjang.");
      } finally {
        setIsProcessing(false);
      }
    }
    
    const manualItem: CartItem = {
      uniqueId,
      id: finalId,
      name: saveToCatalog ? manualItemName : `[JASA/ITEM] ${manualItemName}`,
      price,
      displayPrice: price,
      originalPrice: price,
      cartQty: 1,
      stock: 999999,
      manageStock: false,
      category: saveToCatalog ? manualItemCategory : 'Manual',
      selectedExtras: [],
      discountName: null,
      note: ''
    };

    setCart(prev => [...prev, manualItem]);
    setIsManualItemModalOpen(false);
    setManualItemName('');
    setManualItemPrice('');
    setSaveToCatalog(false);
    toast.success('Item ditambahkan ke keranjang');
  };

  const handleCloseCashier = async () => {
    setIsProcessing(true);
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      const q = query(
        collection(db, 'transactions'),
        where('storeId', '==', storeId),
        where('cashierId', '==', user?.uid)
      );
      const snap = await getDocs(q);
      
      let systemCash = 0;
      snap.forEach(doc => {
        const data = doc.data();
        const trxDate = data.timestamp?.toDate ? data.timestamp.toDate() : new Date();
        if (trxDate >= startOfDay && data.paymentMethod === 'cash' && data.paymentStatus === 'paid') {
          systemCash += data.total;
        }
      });
      
      const sessionData = {
        cashierId: user?.uid,
        cashierName: userName || user?.displayName || 'Kasir',
        timestamp: serverTimestamp(),
        systemCalculatedCash: systemCash,
        actualCash: Number(actualCash) || 0,
        difference: (Number(actualCash) || 0) - systemCash,
        note: closeNote,
        storeId: storeId
      };
      await addDoc(collection(db, 'cashier_sessions'), sessionData);
      
      // Log Cashier Close
      await logActivity({
        userId: user?.uid || 'unknown',
        userName: user?.displayName || user?.email || 'Kasir',
        userEmail: user?.email || '-',
        storeId: storeId || 'unknown',
        action: 'SETTINGS_CHANGE',
        description: `Tutup Kasir: Selisih Rp ${sessionData.difference.toLocaleString('id-ID')}`,
        metadata: { ...sessionData }
      });

      toast.success('Berhasil tutup kasir dan disimpan ke laporan!');
      setIsCloseCashierModalOpen(false);
      setActualCash('');
      setCloseNote('');
    } catch (e) {
      console.error(e);
      toast.error('Gagal tutup kasir');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative h-full w-full max-w-full">
      {/* POS BLOCKING OVERLAY IF NO SHIFT */}
      {!isShiftChecking && !activeShift && (
        <div className="fixed inset-0 z-[9999] bg-background/90 backdrop-blur-md flex items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-surface border-2 border-app-border rounded-[2.5rem] p-10 max-w-md w-full shadow-[0_0_100px_rgba(0,0,0,0.5)] relative overflow-hidden group">
             {/* Decorative glow */}
             <div className="absolute -top-20 -right-20 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl group-hover:bg-rose-500/20 transition-colors duration-700" />
             
             <div className="w-20 h-20 bg-gradient-to-br from-rose-500/20 to-rose-500/5 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 relative z-10 shadow-inner border border-rose-500/20">
                <Lock size={36} className="animate-pulse" strokeWidth={2.5} />
             </div>
             
             <h2 className="text-2xl font-black text-foreground mb-3 uppercase tracking-tight relative z-10">Shift Belum Dibuka!</h2>
             
             <p className="text-xs text-app-text-muted font-bold leading-relaxed mb-8 relative z-10">
                Akses aplikasi kasir saat ini <strong>terkunci</strong>. Anda wajib melakukan pembukaan shift dengan menginput saldo kas awal sebelum memproses transaksi.
             </p>
             
             <Link 
               href="/shifts"
               className="w-full py-5 bg-gradient-to-r from-accent to-accent/90 hover:from-accent-hover hover:to-accent text-foreground rounded-2xl font-black shadow-xl shadow-accent/20 transition-all active:scale-95 flex items-center justify-center gap-3 text-[11px] uppercase tracking-widest relative z-10 overflow-hidden"
             >
                <Unlock size={18} /> BUKA SHIFT SEKARANG
                <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
             </Link>
          </div>
        </div>
      )}

      <div className={`flex flex-col lg:flex-row gap-6 h-full pb-20 lg:pb-0 lg:h-[calc(100vh-6rem)] -mt-2 transition-opacity duration-300 ${(!isShiftChecking && !activeShift) ? 'opacity-20 pointer-events-none grayscale-[0.5]' : ''}`}>
      {/* KIRI - LIST PRODUK */}
      <div className="flex-1 flex flex-col min-h-0 bg-surface border border-app-border rounded-2xl overflow-hidden shadow-sm transition-colors duration-300">
        <div className="p-4 border-b border-app-border">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
              <input 
                type="text" 
                placeholder="Cari produk..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-background border border-app-border rounded-xl text-foreground focus:outline-none focus:border-accent transition-all"
              />
              <button 
                onClick={() => setShowScanner(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-app-text-muted hover:text-accent transition-colors"
                title="Scan Barcode"
              >
                <Scan size={20} />
              </button>
            </div>

            <div className="flex bg-background border border-app-border rounded-xl p-1 shrink-0">
              <button 
                onClick={() => handleSetViewMode('tiles')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'tiles' ? 'bg-accent text-foreground shadow-sm' : 'text-app-text-muted hover:text-foreground'}`}
                title="Tiles View"
              >
                <LayoutGrid size={20} />
              </button>
              <button 
                onClick={() => handleSetViewMode('list')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-accent text-foreground shadow-sm' : 'text-app-text-muted hover:text-foreground'}`}
                title="List View"
              >
                <List size={20} />
              </button>
              <button 
                onClick={() => handleSetViewMode('detail')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'detail' ? 'bg-accent text-foreground shadow-sm' : 'text-app-text-muted hover:text-foreground'}`}
                title="Detail View"
              >
                <LayoutList size={20} />
              </button>
            </div>
            <button 
              onClick={() => setIsManualItemModalOpen(true)}
              className="px-4 py-3 bg-accent/10 border border-accent/20 text-accent rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-accent hover:text-foreground transition-all shrink-0 shadow-sm"
              title="Tambah Item Manual (Jasa/Barang)"
            >
              <PlusCircle size={20} />
              <span className="hidden sm:inline">Manual</span>
            </button>
            <button 
              onClick={() => setIsCloseCashierModalOpen(true)}
              className="px-4 py-3 bg-surface hover:bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shrink-0 shadow-sm"
            >
              <Lock size={18} />
              Tutup Kasir
            </button>
          </div>
        </div>


        <div className="flex-1 overflow-y-auto p-4">
          <div className={
            viewMode === 'tiles' 
              ? "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4" 
              : "flex flex-col gap-2"
          }>
            {filteredProducts.map(product => {
              const isOutOfStock = product.manageStock !== false && product.stock <= 0;
              
              if (viewMode === 'tiles') {
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={isOutOfStock}
                    className="flex flex-col text-left bg-background border border-app-border hover:border-accent rounded-xl p-4 transition-all focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <div className="w-full aspect-square bg-surface rounded-lg mb-3 flex items-center justify-center relative overflow-hidden shadow-inner">
                      {product.imageUrl ? (
                        <div className="absolute inset-0 bg-cover bg-center group-hover:scale-110 transition-transform duration-500" style={{ backgroundImage: `url(${product.imageUrl})` }}></div>
                      ) : null}
                      
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 backdrop-blur-sm">
                          <span className="text-rose-400 font-bold rotate-[-15deg] text-sm border-2 border-rose-400 px-2 py-1 rounded">HABIS</span>
                        </div>
                      )}
                      <div className="w-12 h-12 bg-app-border/20 rounded-full group-hover:scale-110 transition-transform"></div>
                    </div>
                    <div className="mt-auto">
                      <p className="text-[10px] text-app-text-muted mb-1 font-bold uppercase tracking-wider">{product.category || 'Umum'}</p>
                      <h3 className="text-sm font-bold text-foreground leading-tight mb-2 line-clamp-2">{product.name}</h3>
                      <div className="flex items-center justify-between mt-auto">
                        <p className="text-emerald-400 font-bold text-sm">Rp {product.price.toLocaleString('id-ID')}</p>
                        {product.manageStock !== false && <p className="text-[10px] text-app-text-muted">Stok: {product.stock}</p>}
                      </div>
                    </div>
                  </button>
                );
              }

              if (viewMode === 'list') {
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={isOutOfStock}
                    className="flex items-center gap-4 text-left bg-background border border-app-border hover:border-accent rounded-xl p-3 transition-all focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate">{product.name}</h3>
                      <p className="text-[10px] text-app-text-muted font-bold uppercase tracking-wider">{product.category || 'Umum'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-emerald-400 font-bold text-sm">Rp {product.price.toLocaleString('id-ID')}</p>
                      {product.manageStock !== false && <p className="text-[10px] text-app-text-muted">Stok: {product.stock}</p>}
                    </div>
                  </button>
                );
              }

              // Detail/Content View
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={isOutOfStock}
                  className="flex items-center gap-4 text-left bg-background border border-app-border hover:border-accent rounded-xl p-4 transition-all focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div className="w-16 h-16 bg-surface rounded-lg flex items-center justify-center relative overflow-hidden shrink-0 shadow-inner">
                    {product.imageUrl ? (
                      <div className="absolute inset-0 bg-cover bg-center group-hover:scale-110 transition-transform duration-500" style={{ backgroundImage: `url(${product.imageUrl})` }}></div>
                    ) : (
                      <div className="w-8 h-8 bg-app-border/20 rounded-full"></div>
                    )}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10 backdrop-blur-[1px]">
                         <span className="text-rose-400 font-black text-[8px] border border-rose-400 px-1 rounded">HABIS</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-app-text-muted font-black uppercase tracking-widest mb-0.5">{product.category || 'Umum'}</p>
                    <h3 className="text-sm font-black text-foreground mb-1 truncate">{product.name}</h3>
                    <div className="flex items-center gap-3">
                      <p className="text-emerald-400 font-black text-sm">Rp {product.price.toLocaleString('id-ID')}</p>
                      {product.sku && <p className="text-[10px] text-app-text-muted font-mono">SKU: {product.sku}</p>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {product.manageStock !== false && (
                      <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${product.stock > 10 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                        Stok: {product.stock}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
            
            {filteredProducts.length === 0 && (
              <div className="col-span-full py-20 text-center text-app-text-muted">
                <div className="mb-4 opacity-10 flex justify-center"><Package className="w-20 h-20" /></div>
                <p className="text-lg font-medium italic">Produk tidak ditemukan</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KANAN - KERANJANG CART (DESKTOP) */}
      <div className="hidden lg:flex w-[400px] flex-col min-h-0 bg-surface border border-app-border rounded-2xl overflow-hidden shadow-sm flex-shrink-0 transition-colors duration-300">
        {/* EDIT MODE INDICATOR */}
        {editingEstimationId && (
          <div className="bg-amber-500 text-white px-4 py-3 flex items-center justify-between border-b border-amber-600/20 shadow-md">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <FileText size={16} />
              </div>
              <div className="overflow-hidden">
                <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1 opacity-80">Edit Estimasi</p>
                <p className="text-xs font-black truncate">{editingEstimationId}</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setEditingEstimationId(null);
                setOriginalEstimationData(null);
                setCart([]);
                setCustomerQuery('');
                toast.success('Mode edit dibatalkan');
              }}
              className="p-2 hover:bg-white/20 rounded-xl transition-all"
              title="Batal Edit"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="p-4 border-b border-app-border bg-background/50 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ShoppingCart size={20} className="text-accent" />
            Detail Pesanan
          </h2>
          <span className="bg-accent text-foreground text-xs font-bold px-2 py-1 rounded-md shadow-lg shadow-accent/20">{cart.reduce((a,c) => a + c.cartQty, 0)} Item</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-app-text-muted space-y-3 pt-10">
              <ShoppingCart size={48} className="opacity-10" />
              <p className="italic">Keranjang belum diisi</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.uniqueId} className="border-b border-app-border/50 py-1 last:border-0 group">
                <div className="flex items-center gap-2 py-2">
                  {/* Name & Toggle Note */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-[13px] font-bold text-foreground truncate">{item.name}</h4>
                      <button 
                        onClick={() => setExpandedNotes(prev => ({ ...prev, [item.uniqueId]: !prev[item.uniqueId] }))}
                        className={`p-1 rounded-md transition-colors ${item.note ? 'text-amber-500 bg-amber-500/10' : 'text-app-text-muted hover:bg-background opacity-0 group-hover:opacity-100'}`}
                        title="Tambah Catatan"
                      >
                        <StickyNote size={12} />
                      </button>
                    </div>
                    {item.selectedExtras.length > 0 && (
                      <p className="text-[9px] text-app-text-muted truncate">
                        {item.selectedExtras.map(e => e.optionName).join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Qty Controls */}
                  <div className="flex items-center gap-1 bg-background border border-app-border rounded-lg p-0.5">
                    <button onClick={() => updateQty(item.uniqueId, -1)} className="w-6 h-6 flex items-center justify-center bg-surface text-foreground hover:bg-accent hover:text-background rounded-md transition-all"><Minus size={12} /></button>
                    <input 
                      type="number" 
                      value={item.cartQty} 
                      onChange={(e) => setQty(item.uniqueId, e.target.value)}
                      className="text-[11px] font-black w-6 text-center text-foreground bg-transparent border-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                    />
                    <button onClick={() => updateQty(item.uniqueId, 1)} className="w-6 h-6 flex items-center justify-center bg-background text-foreground hover:bg-accent hover:text-background rounded-md transition-all"><Plus size={12} /></button>
                  </div>

                  {/* Price */}
                  <div className="text-right min-w-[75px]">
                    {item.discountName && (
                      <div className="flex flex-col">
                        <span className="text-[9px] text-app-text-muted line-through">Rp {(item.originalPrice * item.cartQty).toLocaleString('id-ID')}</span>
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-[8px] font-black bg-accent/20 text-accent px-1 rounded uppercase tracking-tighter">PROMO</span>
                          <p className="text-[12px] font-black text-emerald-400">Rp {(item.displayPrice * item.cartQty).toLocaleString('id-ID')}</p>
                        </div>
                      </div>
                    )}
                    {!item.discountName && (
                      <p className="text-[12px] font-black text-emerald-400">Rp {(item.displayPrice * item.cartQty).toLocaleString('id-ID')}</p>
                    )}
                  </div>

                  {/* Delete */}
                  <button onClick={() => removeFromCart(item.uniqueId)} className="text-app-text-muted hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Collapsible Note (Desktop) */}
                {expandedNotes[item.uniqueId] && (
                  <div className="pb-2 px-1">
                    <textarea
                      value={item.note}
                      onChange={(e) => setCart(prev => prev.map(i => i.uniqueId === item.uniqueId ? { ...i, note: e.target.value } : i))}
                      placeholder="Tulis catatan..."
                      rows={1}
                      autoFocus
                      className="w-full px-2 py-1.5 bg-background border border-amber-500/20 rounded-lg text-[10px] font-medium text-foreground focus:outline-none focus:border-amber-500/50 resize-none transition-all"
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-app-border bg-background/80 backdrop-blur-md">
          <div className="space-y-2 mb-4 text-sm font-medium">
            <div className="flex justify-between text-app-text-muted">
              <span>Subtotal</span>
              <span className="text-foreground">Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>
            {storeSettings.useTax && (
              <div className="flex justify-between text-app-text-muted">
                <span>Pajak ({storeSettings.taxRate}%)</span>
                <span className="text-foreground">Rp {tax.toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-app-border mt-2">
              <span className="text-foreground">Total Tagihan</span>
              <span className="text-accent">Rp {total.toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="space-y-4 mb-4">
            {/* TOGGLE CONFIG HEADER (DESKTOP) */}
            <button 
              onClick={() => setIsDesktopSettingsExpanded(!isDesktopSettingsExpanded)}
              className="w-full flex items-center justify-between p-3 bg-surface border border-app-border rounded-xl hover:bg-background transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isDesktopSettingsExpanded ? 'bg-accent text-foreground' : 'bg-accent/10 text-accent'}`}>
                  <Settings2 size={16} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-foreground uppercase tracking-widest leading-none mb-1">Pengaturan Transaksi</p>
                  {!isDesktopSettingsExpanded && (
                    <div className="flex gap-1.5 text-[8px] font-bold text-app-text-muted uppercase">
                      <span>{paymentCategory}</span>
                      <span>•</span>
                      <span className="truncate max-w-[60px]">{customerQuery || 'UMUM'}</span>
                      <span>•</span>
                      <span>{useOrderType ? orderType : 'STANDAR'}</span>
                    </div>
                  )}
                </div>
              </div>
              <ChevronDown size={16} className={`text-app-text-muted transition-transform duration-300 ${isDesktopSettingsExpanded ? 'rotate-180' : ''}`} />
            </button>

            {/* COLLAPSIBLE CONFIG SECTION (DESKTOP) */}
            <div className={`space-y-4 overflow-hidden transition-all duration-300 ${isDesktopSettingsExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 invisible'}`}>
              {/* PAYMENT CATEGORIES */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'direct', label: 'Bayar Langsung' },
                  { id: 'debt', label: 'Piutang' },
                  { id: 'order', label: 'Buat Pesanan' },
                  { id: 'merge', label: 'Gabung Pesanan' }
                ].map(cat => (
                  <button 
                    key={cat.id}
                    onClick={() => setPaymentCategory(cat.id as any)}
                    className={`py-2 px-1 rounded-xl text-[10px] font-bold border transition-all ${paymentCategory === cat.id ? 'bg-accent text-foreground border-accent shadow-lg shadow-accent/20' : 'bg-surface border-app-border text-app-text-muted hover:border-accent'}`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* CUSTOMER SEARCH & SAVE */}
              <div className="relative">
                <p className="text-[10px] text-app-text-muted mb-2 uppercase font-bold tracking-widest">Pelanggan</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input 
                      type="text"
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                      placeholder="Nama Pelanggan..."
                      className="w-full px-3 py-2 text-xs border border-app-border rounded-xl bg-background text-foreground focus:border-accent outline-none font-bold"
                    />
                    {suggestions.length > 0 && (
                      <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface border border-app-border rounded-xl shadow-2xl z-20 overflow-hidden">
                        {suggestions.map(s => (
                          <button 
                            key={s.id}
                            onClick={() => {
                              setSelectedCustomer(s);
                              setCustomerQuery(s.name);
                              setSuggestions([]);
                            }}
                            className="w-full px-4 py-2 text-left text-xs hover:bg-accent hover:text-foreground font-bold border-b border-app-border last:border-0"
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={openSelectModal}
                      className="p-2 bg-accent/10 text-accent border border-accent/20 rounded-xl hover:bg-accent hover:text-foreground transition-all"
                    >
                      <Users size={16} />
                    </button>
                    <button 
                      onClick={() => {
                        setNewCustomerName(customerQuery);
                        setIsAddCustomerModalOpen(true);
                      }}
                      className="p-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl hover:bg-emerald-500 hover:text-white transition-all"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* ORDER TYPE SWITCH */}
              <div className="flex items-center justify-between p-3 bg-background border border-app-border rounded-2xl">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${useOrderType ? 'bg-accent/20 text-accent' : 'bg-app-text-muted/10 text-app-text-muted'}`}>
                      <Utensils size={14} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Jenis</span>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setUseOrderType(!useOrderType)}
                    className={`w-8 h-4 rounded-full relative transition-all ${useOrderType ? 'bg-accent' : 'bg-app-text-muted/30'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${useOrderType ? 'left-4.5' : 'left-0.5'}`} />
                  </button>
                  {useOrderType && (
                    <div className="flex bg-surface p-1 rounded-xl border border-app-border">
                        <button 
                          onClick={() => setOrderType('dine-in')}
                          className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase transition-all ${orderType === 'dine-in' ? 'bg-accent text-foreground' : 'text-app-text-muted'}`}
                        >
                          DINE
                        </button>
                        <button 
                          onClick={() => setOrderType('takeaway')}
                          className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase transition-all ${orderType === 'takeaway' ? 'bg-accent text-foreground' : 'text-app-text-muted'}`}
                        >
                          AWAY
                        </button>
                    </div>
                  )}
                </div>
              </div>

              {/* PAYMENT METHOD SELECTOR (DESKTOP SUB) */}
              {paymentCategory === 'direct' && (
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setPaymentMethod('cash')} className={`py-2 rounded-lg text-xs font-bold border transition-all ${paymentMethod === 'cash' ? 'bg-accent text-foreground border-accent shadow-lg shadow-accent/20' : 'bg-surface border-app-border text-app-text-muted hover:border-accent'}`}>Tunai</button>
                  <button onClick={() => setPaymentMethod('qris')} className={`py-2 rounded-lg text-xs font-bold border transition-all ${paymentMethod === 'qris' ? 'bg-accent text-foreground border-accent shadow-lg shadow-accent/20' : 'bg-surface border-app-border text-app-text-muted hover:border-accent'}`}>QRIS</button>
                  <button onClick={() => setPaymentMethod('transfer')} className={`py-2 rounded-lg text-xs font-bold border transition-all ${paymentMethod === 'transfer' ? 'bg-accent text-foreground border-accent shadow-lg shadow-accent/20' : 'bg-surface border-app-border text-app-text-muted hover:border-accent'}`}>TF</button>
                </div>
              )}
            </div>

            {/* MERGE SELECTION - Always show if relevant or include in config? 
                Actually, putting it below config but keeping it separate if relevant. */}
            {paymentCategory === 'merge' && isDesktopSettingsExpanded && (
              <div className="space-y-2 animate-in fade-in duration-300">
                <p className="text-[10px] text-app-text-muted uppercase font-bold tracking-widest">Pilih Pesanan Aktif</p>
                <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto pr-1 no-scrollbar">
                   {activeOrders.length === 0 ? (
                      <p className="text-[10px] italic text-app-text-muted py-2">Tidak ada pesanan aktif</p>
                   ) : (
                      activeOrders.map(ord => (
                        <button 
                          key={ord.id}
                          onClick={() => setSelectedOrderToMerge(ord.id)}
                          className={`w-full p-2 text-left text-[10px] rounded-lg border flex justify-between items-center transition-all ${selectedOrderToMerge === ord.id ? 'bg-accent/10 border-accent text-accent' : 'bg-background border-app-border text-app-text-muted'}`}
                        >
                          <span className="font-bold">{ord.customerName} {ord.paymentStatus !== 'pending' && <span className="text-rose-500 font-black tracking-widest">[PIUTANG]</span>}</span>
                          <span className="font-black">Rp {ord.total.toLocaleString('id-ID')}</span>
                        </button>
                      ))
                   )}
                </div>
              </div>
            )}

            {/* CASH RECEIVED INPUT - Always visible when relevant for speed */}
            {paymentCategory === 'direct' && paymentMethod === 'cash' && cart.length > 0 && (
              <div className="pt-2 border-t border-app-border/30 animate-in slide-in-from-bottom-2">
                  {/* SUGGESTIONS BUTTONS (DESKTOP) */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {[total, 2000, 5000, 10000, 20000, 50000, 100000]
                      .filter((d, i, self) => d >= total && self.indexOf(d) === i)
                      .sort((a, b) => a - b)
                      .slice(0, 4)
                      .map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCashReceived(val.toString())}
                          className={`px-2 py-1 rounded-lg text-[9px] font-black border transition-all ${Number(cashReceived) === val ? 'bg-accent border-accent text-foreground shadow-sm' : 'bg-background border-app-border text-app-text-muted hover:border-accent'}`}
                        >
                          {val === total ? 'UANG PAS' : val.toLocaleString('id-ID')}
                        </button>
                      ))
                    }
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-app-text-muted font-bold text-xs">Rp</div>
                    <input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="Tunai (Rp)..."
                      className="w-full pl-8 pr-3 py-3 border border-app-border rounded-xl bg-background text-foreground font-black text-sm focus:outline-none focus:border-accent transition-all shadow-inner"
                    />
                  </div>
                  
                  {Number(cashReceived) > 0 && (
                    <div className="flex justify-between text-[10px] py-1 px-1">
                      <span className="text-app-text-muted font-bold uppercase tracking-widest">Kembalian:</span>
                      <span className={`font-black ${change < 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                        {change < 0 ? 'NOMINAL KURANG!' : `Rp ${change.toLocaleString('id-ID')}`}
                      </span>
                    </div>
                  )}
              </div>
            )}
            
            {/* DEBT DOWN PAYMENT INPUT (DESKTOP) */}
            {paymentCategory === 'debt' && cart.length > 0 && (
              <div className="pt-2 border-t border-app-border/30 animate-in slide-in-from-bottom-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <p className="text-[10px] text-app-text-muted mb-1 uppercase font-bold tracking-widest px-1">Bayar Awal (DP)</p>
                    <div className="absolute top-[26px] left-3 flex items-center pointer-events-none text-app-text-muted font-bold text-xs">Rp</div>
                    <input
                      type="number"
                      value={debtDownPayment}
                      onChange={(e) => setDebtDownPayment(e.target.value)}
                      placeholder="DP..."
                      className="w-full pl-8 pr-3 py-2.5 border border-app-border rounded-xl bg-background text-foreground font-black text-xs focus:outline-none focus:border-accent transition-all shadow-inner"
                    />
                  </div>
                  <div className="relative">
                    <p className="text-[10px] text-app-text-muted mb-1 uppercase font-bold tracking-widest px-1 text-rose-500">Jatuh Tempo</p>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2.5 border border-app-border rounded-xl bg-background text-foreground font-bold text-[10px] focus:outline-none focus:border-rose-500 transition-all shadow-inner cursor-pointer"
                    />
                  </div>
                </div>
                
                <div className="flex justify-between items-center bg-accent/5 border border-accent/10 rounded-xl p-2.5">
                  <span className="text-[9px] font-black text-app-text-muted uppercase tracking-[0.2em]">Sisa Piutang</span>
                  <span className="text-sm font-black text-accent">
                    Rp {Math.max(0, total - Number(debtDownPayment || 0)).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button 
              onClick={handleResetTransaction}
              className="flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white px-6 rounded-2xl font-black text-sm shadow-sm transition-all"
              title="Reset / Batalkan (F8)"
            >
              <Trash2 size={18} />
            </button>
            <button 
              disabled={cart.length === 0 || isProcessing || (paymentCategory === 'direct' && paymentMethod === 'cash' && Number(cashReceived || 0) < total)}
              onClick={openPreview}
              className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-foreground py-4 rounded-2xl font-black text-sm shadow-xl shadow-accent/20 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  PROSES...
                </>
              ) : (
                <>
                  <CreditCard size={18} />
                  {paymentCategory === 'order' ? 'BUAT PESANAN' : 
                   paymentCategory === 'debt' ? 'SIMPAN PIUTANG' : 
                   paymentCategory === 'merge' ? 'GABUNG PESANAN' : 
                   'SELESAIKAN PEMBAYARAN'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL PILIHAN EKSTRA / MODIFIER */}
      {activeExtrasProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-surface border border-app-border rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-app-border flex items-center justify-between bg-surface sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-background border border-app-border overflow-hidden shadow-inner flex items-center justify-center">
                   {activeExtrasProduct.imageUrl ? (
                     <img src={activeExtrasProduct.imageUrl} alt="" className="w-full h-full object-cover" />
                   ) : <Package className="text-app-text-muted opacity-20" />}
                </div>
                <div>
                  <h3 className="text-xl font-black text-foreground leading-tight">{activeExtrasProduct.name}</h3>
                  <p className="text-xs text-app-text-muted font-bold uppercase tracking-widest mt-1">Konfigurasi Ekstra Produk</p>
                </div>
              </div>
              <button onClick={() => setActiveExtrasProduct(null)} className="text-app-text-muted hover:text-rose-500 p-2 hover:bg-background rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-background/30">
              {isLodingExtras ? (
                <div className="flex flex-col items-center justify-center py-20 text-app-text-muted">
                  <Loader2 className="w-10 h-10 animate-spin mb-4 text-accent" />
                  <p className="font-bold animate-pulse">Menyiapkan opsi modifier...</p>
                </div>
              ) : availableExtraGroups.length === 0 ? (
                <div className="text-center py-20 text-app-text-muted italic">
                  Tidak ada data ekstra yang ditemukan.
                </div>
              ) : (
                availableExtraGroups.map(group => (
                  <div key={group.id} className="space-y-4">
                    <div className="flex items-center justify-between border-b border-app-border pb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-foreground uppercase text-xs tracking-wider">{group.name}</h4>
                        {group.isMandatory && <span className="bg-rose-500 text-white text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">Wajib</span>}
                      </div>
                      <span className="text-[10px] text-accent uppercase font-black tracking-widest bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                        {group.allowMultiple ? (group.hasMaxLimit ? `MAX ${group.maxLimit}` : 'MULTI') : 'SINGLE'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {group.options.map((opt, idx) => {
                        const isSelected = (tempSelections[group.id!] || []).some(o => o.name === opt.name);
                        return (
                          <button 
                            key={idx}
                            onClick={() => toggleOption(group, opt)}
                            className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left shadow-sm group active:scale-95 ${
                              isSelected 
                              ? 'bg-accent/10 border-accent text-accent' 
                              : 'bg-surface border-app-border text-app-text-muted hover:border-accent/30'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all ${
                                isSelected ? 'bg-accent border-accent text-foreground' : 'bg-background border-app-border text-transparent'
                              }`}>
                                <Check size={12} className="stroke-[4]" />
                              </div>
                              <span className="text-sm font-bold">{opt.name}</span>
                            </div>
                            {opt.price > 0 && <span className="text-xs font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">+{opt.price.toLocaleString('id-ID')}</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 border-t border-app-border bg-surface">
              <button 
                onClick={confirmExtrasToCart}
                className="w-full py-4 bg-accent hover:bg-accent-hover text-foreground rounded-2xl font-black shadow-xl shadow-accent/30 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={20} /> TAMBAHKAN KE KERANJANG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PREVIEW TRANSAKSI */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-surface border border-app-border rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col h-full md:h-auto md:max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-app-border flex items-center justify-between bg-background/50">
              <div>
                <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                  <ShoppingCart className="text-accent" />
                  Preview Pesanan
                </h2>
                <p className="text-xs text-app-text-muted mt-1 font-bold">Harap periksa kembali detail pesanan</p>
              </div>
              <button onClick={() => setIsPreviewModalOpen(false)} className="text-app-text-muted hover:text-rose-500 p-2 hover:bg-background rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
               {/* List Detail Item */}
               <div className="space-y-3 pb-4 border-b border-app-border">
                 {cart.map(item => (
                    <div key={item.uniqueId} className="flex justify-between items-start text-sm">
                       <div className="flex-1 pr-4">
                          <p className="font-bold text-foreground">{item.name}</p>
                          <p className="text-[10px] text-app-text-muted">{item.cartQty} x Rp {item.displayPrice.toLocaleString('id-ID')}</p>
                          {item.selectedExtras.length > 0 && (
                            <p className="text-[9px] text-app-text-muted mt-0.5 border border-app-border px-1 py-0.5 rounded w-fit">
                              + {item.selectedExtras.map(e => e.optionName).join(', ')}
                            </p>
                          )}
                          {item.note && (
                            <p className="text-[9px] text-amber-500 italic bg-amber-500/10 px-2 py-0.5 rounded w-fit mt-0.5">Catatan: {item.note}</p>
                          )}
                       </div>
                       <p className="font-black text-foreground">Rp {(item.displayPrice * item.cartQty).toLocaleString('id-ID')}</p>
                    </div>
                 ))}
               </div>

               {/* Ringkasan Biaya */}
               <div className="space-y-2 text-sm bg-background p-4 rounded-2xl border border-app-border">
                  <div className="flex justify-between text-app-text-muted font-bold text-xs">
                    <span>Subtotal</span>
                    <span>Rp {subtotal.toLocaleString('id-ID')}</span>
                  </div>
                  {storeSettings.useTax && (
                    <div className="flex justify-between text-app-text-muted font-bold text-xs">
                      <span>Pajak ({storeSettings.taxRate}%)</span>
                      <span>Rp {tax.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  {paymentCategory === 'direct' && paymentMethod === 'cash' && (
                    <div className="flex justify-between text-app-text-muted font-bold text-xs">
                      <span>Tunai (Diterima)</span>
                      <span>Rp {Number(cashReceived || 0).toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  {paymentCategory === 'debt' && (
                    <>
                      <div className="flex justify-between text-app-text-muted font-bold text-xs">
                        <span>Pembayaran Awal (DP)</span>
                        <span>Rp {Number(debtDownPayment || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-amber-500 font-bold text-xs">
                        <span>Sisa Piutang</span>
                        <span>Rp {Math.max(0, total - Number(debtDownPayment || 0)).toLocaleString('id-ID')}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-lg font-black pt-3 border-t border-app-border mt-2">
                    <span className="text-foreground">TOTAL AKHIR</span>
                    <span className="text-accent">Rp {total.toLocaleString('id-ID')}</span>
                  </div>
                  {paymentCategory === 'direct' && paymentMethod === 'cash' && change > 0 && (
                    <div className="flex justify-between font-black text-xs pt-1">
                      <span className="text-emerald-400">KEMBALIAN</span>
                      <span className="text-emerald-400">Rp {change.toLocaleString('id-ID')}</span>
                    </div>
                  )}
               </div>

               {/* QRIS Image Display */}
               {paymentCategory === 'direct' && paymentMethod === 'qris' && (
                 <div className="bg-surface border border-app-border rounded-2xl p-4 flex flex-col items-center justify-center space-y-3">
                   <h3 className="font-black text-foreground text-sm uppercase tracking-widest text-center">Scan QRIS untuk Membayar</h3>
                   {storeSettings.qrisUrl ? (
                     <img src={storeSettings.qrisUrl} alt="QRIS" className="w-48 h-48 object-contain rounded-xl bg-white p-2 border border-app-border/50" />
                   ) : (
                     <div className="w-48 h-48 flex items-center justify-center bg-background border-2 border-dashed border-app-border rounded-xl">
                       <p className="text-xs text-app-text-muted text-center px-4 font-bold">Foto QRIS belum diatur di Pengaturan Toko.</p>
                     </div>
                   )}
                   <p className="text-[10px] text-app-text-muted italic text-center">Arahkan pelanggan untuk scan kode ini.</p>
                 </div>
               )}

               {/* Bank Transfer Info Display */}
               {paymentCategory === 'direct' && paymentMethod === 'transfer' && (
                 <div className="bg-surface border border-app-border rounded-2xl p-4 flex flex-col items-center justify-center space-y-3">
                   <h3 className="font-black text-foreground text-sm uppercase tracking-widest text-center">Info Rekening Transfer</h3>
                   {storeSettings.bankInfo ? (
                     <div className="w-full bg-background border border-app-border rounded-xl p-4">
                       <p className="text-sm font-black text-foreground whitespace-pre-line text-center">{storeSettings.bankInfo}</p>
                     </div>
                   ) : (
                     <div className="w-full flex items-center justify-center bg-background border-2 border-dashed border-app-border rounded-xl p-4">
                       <p className="text-xs text-app-text-muted text-center font-bold">Info Bank belum diatur di Pengaturan Toko.</p>
                     </div>
                   )}
                   <p className="text-[10px] text-app-text-muted italic text-center">Pastikan transfer sesuai nominal transaksi.</p>
                 </div>
               )}

               {/* Info Pelanggan & Tipe */}
               <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                  {customerQuery && (
                    <span className="bg-surface border border-app-border px-2 py-1 rounded">Pelanggan: {customerQuery}</span>
                  )}
                  <span className="bg-surface border border-app-border px-2 py-1 rounded">Tipe: {useOrderType ? orderType : 'Standar'}</span>
                  <span className="bg-surface border border-app-border px-2 py-1 rounded">Kas: {paymentCategory === 'direct' ? paymentMethod : paymentCategory}</span>
               </div>
            </div>

            <div className="p-8 border-t border-app-border bg-background/50 flex flex-col gap-4">
              <button 
                onClick={() => {
                   handleCheckout();
                }}
                disabled={isProcessing}
                className="w-full py-5 bg-accent hover:bg-accent-hover text-foreground rounded-[1.5rem] font-black shadow-2xl shadow-accent/40 transition-all flex justify-center items-center gap-3 disabled:opacity-50 active:scale-[0.98] text-base tracking-tight"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={22} /> : <CheckCircle2 size={22} />}
                PROSES SEKARANG
              </button>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="flex-1 py-4 text-app-text-muted hover:text-foreground font-black transition-all border border-app-border rounded-2xl bg-surface hover:bg-background flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                >
                  <X size={16} />
                  KE EDIT
                </button>
                <button 
                  onClick={handleSaveEstimation}
                  disabled={isProcessing}
                  className="flex-1 py-4 bg-surface border border-emerald-500/30 text-emerald-500 font-black rounded-2xl hover:bg-emerald-500 hover:text-white transition-all flex justify-center items-center gap-2 text-xs uppercase tracking-widest"
                >
                  <ClipboardList size={16} />
                  ESTIMASI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SUCCESS TRANSAKSI */}
      {successTrx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-surface border border-app-border rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden flex flex-col text-center p-10 animate-in zoom-in-90 duration-300">
            <div className="mx-auto w-24 h-24 bg-accent/20 text-accent flex items-center justify-center rounded-full mb-6 ring-8 ring-accent/5 animate-bounce">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="text-3xl font-black text-foreground mb-2">SUCCESS!</h2>
            <p className="text-app-text-muted mb-8 font-medium">Transaksi berhasil tercatat di sistem.</p>
            
            <div className="bg-background border border-app-border rounded-3xl p-6 mb-8 text-left text-sm space-y-3 shadow-inner">
              <div className="flex justify-between items-center text-app-text-muted uppercase text-[10px] font-black tracking-widest border-b border-app-border/50 pb-2">
                 <span>Detail Transaksi</span>
                 <span className="text-accent">#{successTrx.id.substring(0,8)}</span>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-app-text-muted font-bold">Total Tagihan</span>
                  <span className="text-foreground font-black">Rp {successTrx.total.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-app-text-muted font-bold">Uang Diterima</span>
                  <span className="text-foreground font-black">Rp {(successTrx.total + (successTrx.change || 0)).toLocaleString('id-ID')}</span>
                </div>
              </div>

              {successTrx.paymentStatus === 'partially_paid' || successTrx.paymentStatus === 'unpaid' ? (
                <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col gap-2">
                   <div className="flex justify-between items-center text-[10px] font-black text-amber-600 uppercase tracking-widest">
                      <span>Sudah Dibayar</span>
                      <span>Rp {successTrx.paidAmount?.toLocaleString('id-ID') || '0'}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm font-black text-amber-600 uppercase tracking-tight">
                      <span>Sisa Piutang</span>
                      <span>Rp {successTrx.debtAmount?.toLocaleString('id-ID') || '0'}</span>
                   </div>
                </div>
              ) : successTrx.paymentMethod?.toUpperCase() === 'CASH' && successTrx.change > 0 && (
                <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex flex-col items-center gap-1 animate-in zoom-in-95 duration-500 delay-200">
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Kembalian Pelanggan</span>
                  <span className="text-3xl font-black text-emerald-500 tracking-tighter">Rp {successTrx.change.toLocaleString('id-ID')}</span>
                </div>
              )}

              <div className="flex justify-between border-t border-app-border/50 pt-3">
                <span className="text-app-text-muted font-bold">Metode</span>
                <span className="bg-accent/10 px-3 py-1 rounded-full text-accent font-black text-[10px] uppercase border border-accent/20">{successTrx.paymentMethod}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                   // Tutup modal suksess dan buka modal preview struk digital
                   // Atau bisa langsung timpa saja jika kita tidak set null successTrx
                   setViewingReceipt({
                      ...successTrx,
                      // Ensure items exists for viewingReceipt backwards compatibility
                      items: successTrx.items || cart
                   });
                }}
                className="w-full flex items-center justify-center gap-2 py-4 bg-accent hover:bg-accent-hover text-foreground rounded-2xl font-black transition-all shadow-xl shadow-accent/20 active:scale-95"
              >
                <Printer size={20} /> LIHAT STRUK DIGITAL
              </button>
              <button 
                onClick={() => setSuccessTrx(null)}
                className="w-full py-4 text-app-text-muted hover:text-foreground font-bold transition-colors"
              >
                Nanti saja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL STRUK DIGITAL */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                 <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 italic">
                    <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                       <CheckCircle2 size={18} />
                    </div>
                    Struk Digital
                 </h2>
                 <button onClick={() => setViewingReceipt(null)} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-xl transition-colors"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 font-mono text-[10px] space-y-6">
                 <div className="text-center space-y-2">
                    {storeSettings?.logoUrl && storeSettings?.showLogoOnReceipt !== false && <img src={storeSettings.logoUrl} alt="" className="w-12 h-12 mx-auto object-contain grayscale opacity-50 mb-2" />}
                    <h3 className="text-sm font-black uppercase text-slate-900">{storeSettings?.storeName || 'Toko Kami'}</h3>
                    {storeSettings?.showReceiptAddress !== false && <p className="text-slate-500 whitespace-pre-line">{storeSettings?.address}</p>}
                    {storeSettings?.showReceiptPhone !== false && <p className="text-slate-500">Telp: {storeSettings?.phone}</p>}
                    <div className="border-b border-dashed border-slate-300 pt-2"></div>
                 </div>

                 {/* Detail Transaksi */}
                 <div className="space-y-1 text-slate-600">
                    <div className="flex justify-between"><span>Nomor TRX</span><span className="font-bold text-slate-900">#{(viewingReceipt.id || "").toUpperCase()}</span></div>
                    <div className="flex justify-between"><span>Tanggal</span><span className="font-bold text-slate-900">{viewingReceipt.timestamp?.toDate ? viewingReceipt.timestamp.toDate().toLocaleString('id-ID').replace(/\./g, ':') : 'Baru saja'}</span></div>
                    {storeSettings?.showReceiptCustomer !== false && (
                      <div className="flex justify-between"><span>Pelanggan</span><span className="font-bold text-slate-900">{viewingReceipt.customerName || selectedCustomer?.name || 'Umum'}</span></div>
                    )}
                    {storeSettings?.showReceiptCashier !== false && (
                      <div className="flex justify-between"><span>Kasir</span><span className="font-bold text-slate-900">{viewingReceipt.cashierName?.includes('@') ? viewingReceipt.cashierName.split('@')[0] : (viewingReceipt.cashierName || userName || 'Online')}</span></div>
                    )}
                    <div className="border-b border-dashed border-slate-300 pt-2"></div>
                 </div>

                 {/* List Item */}
                 <div className="space-y-4">
                    {(viewingReceipt.items || cart)?.map((item: any, i: number) => (
                      <div key={i} className="space-y-1">
                         <div className="flex justify-between text-slate-900 font-bold uppercase">
                            <span className="flex-1 mr-4">{item.productName || item.name}</span>
                            <span>Rp {(item.subtotal || (item.price * (item.qty || item.cartQty)) || 0).toLocaleString('id-ID')}</span>
                         </div>
                         <div className="flex justify-between text-slate-500">
                            <span>{item.qty || item.cartQty} x {(item.price || 0).toLocaleString('id-ID')}</span>
                            <div className="flex flex-col items-end">
                               {item.note && <span className="text-[9px] italic">({item.note})</span>}
                               {item.warrantyExpiry && (
                                 <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded mt-0.5">
                                   🛡 Garansi s/d: {new Date(item.warrantyExpiry).toLocaleDateString('id-ID', {day: '2-digit', month: '2-digit', year: '2-digit'})}
                                 </span>
                               )}
                            </div>
                         </div>
                         {item.selectedExtras?.length > 0 && (
                           <div className="pl-2 border-l-2 border-slate-100 space-y-0.5">
                             {item.selectedExtras.map((ex: any, ei: number) => (
                               <div key={ei} className="flex justify-between text-[9px] text-slate-400">
                                 <span>+ {ex.optionName}</span>
                                 <span>Rp {(ex.price || 0).toLocaleString('id-ID')}</span>
                               </div>
                             ))}
                           </div>
                         )}
                      </div>
                    ))}
                    <div className="border-b border-dashed border-slate-300 pt-2"></div>
                 </div>

                 {/* Kalkulasi Akhir */}
                 <div className="space-y-2">
                    {storeSettings?.showReceiptSubtotal !== false && (
                      <div className="flex justify-between text-slate-600"><span>SUBTOTAL</span><span className="font-bold text-slate-900">Rp {(viewingReceipt.subtotal || viewingReceipt.total || 0).toLocaleString('id-ID')}</span></div>
                    )}
                    {viewingReceipt.tax > 0 && (
                      <div className="flex justify-between text-slate-600"><span>PAJAK (PPN)</span><span className="font-bold text-slate-900">Rp {(viewingReceipt.tax || 0).toLocaleString('id-ID')}</span></div>
                    )}
                    <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                       <span>TOTAL</span>
                       <span>Rp {(viewingReceipt.total || 0).toLocaleString('id-ID')}</span>
                    </div>
                    {viewingReceipt.paymentStatus === 'paid' && (
                      <>
                        <div className="flex justify-between text-slate-600">
                           <span>{viewingReceipt.cashReceived ? 'UANG DITERIMA' : 'DIBAYAR'}</span>
                           <span className="font-bold text-emerald-600">Rp {(viewingReceipt.cashReceived || viewingReceipt.total || 0).toLocaleString('id-ID')}</span>
                        </div>
                        {viewingReceipt.change > 0 && (
                           <div className="flex justify-between text-slate-600">
                              <span>KEMBALIAN</span>
                              <span className="font-bold text-slate-900">Rp {(viewingReceipt.change || 0).toLocaleString('id-ID')}</span>
                           </div>
                        )}
                      </>
                    )}
                 </div>

                 <div className="text-center pt-6 space-y-1">
                    <p className="font-bold text-slate-900">{storeSettings?.receiptMessage || 'Terima Kasih Atas Kunjungan Anda'}</p>
                    {branding?.receiptWatermark && <p className="text-slate-400 uppercase tracking-widest mt-2 text-[8px]">{branding.receiptWatermark}</p>}
                 </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="p-4 bg-slate-50 flex gap-2 border-t border-slate-200 shrink-0">
                 <button 
                   onClick={() => setViewingReceipt(null)}
                   className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-200 bg-slate-200/50 rounded-2xl transition-colors"
                 >
                   Tutup
                 </button>
                 <button 
                   onClick={async () => {
                     await printReceipt(viewingReceipt, storeSettings, branding);
                     setViewingReceipt(null);
                     setSuccessTrx(null);
                   }}
                   className="flex-[2] py-4 bg-slate-900 hover:bg-black text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-slate-900/20 transition-all active:scale-95"
                 >
                   <Printer size={18} />CETAK KE PRINTER
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* MOBILE SCAN FEEDBACK BUBBLES */}
      <div className="lg:hidden fixed bottom-44 left-6 right-6 z-[60] pointer-events-none space-y-2">
        {lastScannedProduct && (
          <div className="bg-emerald-500/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex items-center justify-between border border-emerald-400/30 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-1.5 rounded-lg">
                <Check size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Berhasil ditambahkan</span>
                <span className="text-xs font-black truncate max-w-[180px]">{lastScannedProduct.name}</span>
              </div>
            </div>
            <div className="bg-white/20 px-3 py-1 rounded-lg font-black text-sm">
              x {cart.find(item => item.id === lastScannedProduct.id)?.cartQty || 1}
            </div>
          </div>
        )}

        {scanNotFound && (
          <div className="bg-rose-500/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-rose-400/30 animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white/20 p-1.5 rounded-lg">
              <X size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Barang Tidak Ditemukan</span>
              <span className="text-xs font-black tracking-tight font-mono">{scanNotFound}</span>
            </div>
          </div>
        )}
      </div>

      {/* MOBILE FLOATING CART BUTTON */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-24 left-6 right-6 z-40">
           <button 
             onClick={() => {
               setIsCartOpen(true);
               setIsMobileDetailsExpanded(true);
             }}
             className="w-full h-16 bg-accent text-foreground rounded-[24px] shadow-2xl shadow-accent/40 flex items-center justify-between px-8 animate-in slide-in-from-bottom-8 duration-500"
           >
             <div className="flex items-center gap-4">
                <div className="relative">
                  <ShoppingCart size={24} />
                  <span className="absolute -top-2 -right-2 bg-foreground text-background text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-accent">
                    {cart.reduce((a,c) => a + c.cartQty, 0)}
                  </span>
                </div>
                <div>
                   <p className="text-[10px] font-black opacity-70 uppercase tracking-widest">Keranjang</p>
                   <p className="text-lg font-black leading-none">Rp {total.toLocaleString('id-ID')}</p>
                </div>
             </div>
             <div className="bg-foreground/10 px-4 py-2 rounded-xl border border-foreground/20">
                <span className="text-xs font-black">LIHAT PESANAN</span>
             </div>
           </button>
        </div>
      )}

      {/* MOBILE CART BOTTOM SHEET */}
      {isCartOpen && (
        <div className="lg:hidden fixed inset-0 z-[70] flex items-end justify-center mb-16">
           <div 
             className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" 
             onClick={() => setIsCartOpen(false)} 
           />
           <div className="relative w-full bg-surface rounded-t-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-500 border-t border-app-border">
              {/* Drag Handle */}
              <div className="w-12 h-1.5 bg-app-border/40 rounded-full mx-auto my-4 shrink-0" />
              
              <div className="px-6 pb-4 border-b border-app-border flex items-center justify-between">
                <button 
                  onClick={() => setIsMobileDetailsExpanded(!isMobileDetailsExpanded)}
                  className="flex-1 flex items-center gap-3 text-left focus:outline-none"
                >
                  <div className={`p-2 rounded-xl transition-colors ${isMobileDetailsExpanded ? 'bg-accent text-foreground' : 'bg-accent/10 text-accent'}`}>
                    <ShoppingCart size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-foreground">Rincian Pesanan</h2>
                    <p className="text-[10px] text-app-text-muted font-bold uppercase tracking-wider">{cart.reduce((a,c) => a + c.cartQty, 0)} Items</p>
                  </div>
                  <ChevronDown size={20} className={`ml-auto text-app-text-muted transition-transform duration-300 ${isMobileDetailsExpanded ? 'rotate-180' : ''}`} />
                </button>
                <button onClick={() => setIsCartOpen(false)} className="ml-4 p-2 hover:bg-background rounded-full transition-colors text-rose-500">
                  <X size={24} />
                </button>
              </div>

              {/* Collapsible Item List (Dropdown) */}
              <div className={`overflow-y-auto bg-background/30 transition-all duration-300 ease-in-out ${isMobileDetailsExpanded ? 'max-h-[50vh] opacity-100 p-6 opacity-100' : 'max-h-0 opacity-0 p-0 overflow-hidden'}`}>
                 {cart.length === 0 ? (
                    <div className="py-10 flex flex-col items-center justify-center text-center opacity-30">
                       <ShoppingCart size={48} className="mb-4" />
                       <p className="font-bold italic">Keranjang kosong</p>
                    </div>
                 ) : (
                      cart.map(item => (
                        <div key={item.uniqueId} className="border-b border-app-border/50 last:border-0">
                          <div className="flex items-center gap-2 py-3">
                              {/* Product Info */}
                              <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <h4 className="text-[13px] font-bold text-foreground truncate leading-tight">{item.name}</h4>
                                    <button 
                                      onClick={() => setExpandedNotes(prev => ({ ...prev, [item.uniqueId]: !prev[item.uniqueId] }))}
                                      className={`p-1 rounded-md transition-colors ${item.note ? 'text-amber-500 bg-amber-500/10' : 'text-app-text-muted hover:bg-background'}`}
                                    >
                                      <StickyNote size={12} />
                                    </button>
                                  </div>
                                  {item.selectedExtras.length > 0 && (
                                    <p className="text-[9px] text-app-text-muted truncate">
                                      {item.selectedExtras.map(e => e.optionName).join(', ')}
                                    </p>
                                  )}
                              </div>

                              {/* Qty Controls */}
                              <div className="flex items-center bg-background border border-app-border rounded-lg p-0.5">
                                  <button onClick={() => updateQty(item.uniqueId, -1)} className="w-6 h-6 flex items-center justify-center text-app-text-muted hover:text-rose-500"><Minus size={12} /></button>
                                  <input 
                                    type="number" 
                                    value={item.cartQty} 
                                    onChange={(e) => setQty(item.uniqueId, e.target.value)}
                                    className="font-black text-[11px] w-6 text-center text-foreground bg-transparent border-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                  />
                                  <button onClick={() => updateQty(item.uniqueId, 1)} className="w-6 h-6 flex items-center justify-center text-app-text-muted hover:text-accent"><Plus size={12} /></button>
                              </div>

                              {/* Price / Subtotal */}
                              <div className="text-right min-w-[70px]">
                                {item.discountName && (
                                  <div className="flex flex-col">
                                    <span className="text-[9px] text-app-text-muted line-through">Rp {(item.originalPrice * item.cartQty).toLocaleString('id-ID')}</span>
                                    <div className="flex items-center justify-end gap-1">
                                      <span className="text-[8px] font-black bg-accent/20 text-accent px-1 rounded uppercase tracking-tighter">PROMO</span>
                                      <p className="text-[12px] font-black text-emerald-400">Rp {(item.displayPrice * item.cartQty).toLocaleString('id-ID')}</p>
                                    </div>
                                  </div>
                                )}
                                {!item.discountName && (
                                  <p className="text-[12px] font-black text-emerald-400">Rp {(item.displayPrice * item.cartQty).toLocaleString('id-ID')}</p>
                                )}
                              </div>

                              {/* Delete */}
                              <button onClick={() => removeFromCart(item.uniqueId)} className="text-rose-500/40 hover:text-rose-500 p-1">
                                  <Trash2 size={14} />
                              </button>
                          </div>

                          {/* Collapsible Note Dropdown */}
                          {expandedNotes[item.uniqueId] && (
                            <div className="pb-3 px-1 animate-in slide-in-from-top-2 duration-200">
                              <textarea
                                value={item.note}
                                onChange={(e) => setCart(prev => prev.map(i => i.uniqueId === item.uniqueId ? { ...i, note: e.target.value } : i))}
                                placeholder="Tulis catatan untuk item ini..."
                                autoFocus
                                className="w-full p-3 bg-background border border-app-border rounded-xl text-[11px] font-medium text-foreground focus:outline-none focus:border-amber-500/50 resize-none shadow-inner"
                                rows={2}
                              />
                            </div>
                          )}
                        </div>
                      ))
                 )}
              </div>

               <div className="p-6 border-t border-app-border bg-surface shadow-[0_-10px_20px_rgba(0,0,0,0.05)] space-y-4">
                  
                  {/* TOGGLE SETTINGS HEADER */}
                  <button 
                    onClick={() => setIsMobileSettingsExpanded(!isMobileSettingsExpanded)}
                    className="w-full flex items-center justify-between p-3 bg-background border border-app-border rounded-2xl hover:bg-background/80 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${isMobileSettingsExpanded ? 'bg-accent text-foreground' : 'bg-accent/10 text-accent'}`}>
                        <Settings2 size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-foreground uppercase tracking-widest leading-none mb-1">Pengaturan Transaksi</p>
                        {!isMobileSettingsExpanded && (
                          <div className="flex gap-2 text-[8px] font-bold text-app-text-muted uppercase">
                            <span>{paymentCategory}</span>
                            <span>•</span>
                            <span className="truncate max-w-[80px]">{customerQuery || 'UMUM'}</span>
                            <span>•</span>
                            <span>{useOrderType ? orderType : 'STANDAR'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronDown size={18} className={`text-app-text-muted transition-transform duration-300 ${isMobileSettingsExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {/* COLLAPSIBLE SETTINGS SECTION */}
                  <div className={`space-y-4 overflow-hidden transition-all duration-300 ${isMobileSettingsExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 invisible'}`}>
                    {/* MOBILE PAYMENT CATEGORIES */}
                    <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'direct', label: 'Bayar Langsung' },
                          { id: 'debt', label: 'Piutang' },
                          { id: 'order', label: 'Pesanan' },
                          { id: 'merge', label: 'Gabung' }
                        ].map(cat => (
                          <button 
                            key={cat.id}
                            onClick={() => setPaymentCategory(cat.id as any)}
                            className={`py-3 rounded-2xl text-[10px] font-black uppercase transition-all border ${
                              paymentCategory === cat.id 
                              ? 'bg-accent border-accent text-foreground shadow-lg' 
                              : 'bg-background border-app-border text-app-text-muted hover:border-accent/30'
                            }`}
                          >
                             {cat.label}
                          </button>
                        ))}
                    </div>

                    {/* MOBILE CUSTOMER SEARCH */}
                    <div className="relative">
                      <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input 
                              type="text"
                              value={customerQuery}
                              onChange={(e) => setCustomerQuery(e.target.value)}
                              placeholder="Nama Pelanggan..."
                              className="w-full p-4 bg-background border border-app-border rounded-2xl font-black text-xs text-foreground focus:border-accent focus:outline-none"
                            />
                            {suggestions.length > 0 && (
                              <div className="absolute bottom-full left-0 right-0 mb-2 bg-surface border border-app-border rounded-2xl shadow-2xl z-20 overflow-hidden max-h-40 overflow-y-auto">
                                {suggestions.map(s => (
                                  <button 
                                    key={s.id}
                                    onClick={() => {
                                      setSelectedCustomer(s);
                                      setCustomerQuery(s.name);
                                      setSuggestions([]);
                                    }}
                                    className="w-full px-4 py-3 text-left text-xs hover:bg-accent hover:text-foreground font-black border-b border-app-border last:border-0"
                                  >
                                    {s.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                             <button 
                               onClick={openSelectModal}
                               className="p-4 bg-accent/10 text-accent border border-accent/20 rounded-2xl active:bg-accent active:text-foreground"
                             >
                               <Users size={18} />
                             </button>
                             <button 
                               onClick={() => {
                                 setNewCustomerName(customerQuery);
                                 setIsAddCustomerModalOpen(true);
                               }}
                               className="p-4 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-2xl active:bg-emerald-500 active:text-white"
                             >
                               <Plus size={18} />
                             </button>
                          </div>
                      </div>
                    </div>

                    {/* MOBILE ORDER TYPE SELECT */}
                    <div className="flex items-center justify-between p-3 bg-background border border-app-border rounded-2xl">
                      <div className="flex items-center gap-2">
                        <Utensils size={14} className="text-accent" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-foreground">Jenis</span>
                        <button 
                          onClick={() => setUseOrderType(!useOrderType)}
                          className={`w-8 h-4 rounded-full relative transition-all ml-1 ${useOrderType ? 'bg-accent' : 'bg-app-text-muted/30'}`}
                        >
                          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${useOrderType ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                        {useOrderType && (
                          <div className="flex bg-surface p-0.5 rounded-lg border border-app-border">
                            <button 
                              onClick={() => setOrderType('dine-in')}
                              className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${orderType === 'dine-in' ? 'bg-accent text-foreground' : 'text-app-text-muted'}`}
                            >
                              DINE
                            </button>
                            <button 
                              onClick={() => setOrderType('takeaway')}
                              className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${orderType === 'takeaway' ? 'bg-accent text-foreground' : 'text-app-text-muted'}`}
                            >
                              AWAY
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* MOBILE PAYMENT CHOICE (SUB) */}
                    {paymentCategory === 'direct' && (
                        <div className="grid grid-cols-3 gap-2">
                            {['cash', 'qris', 'transfer'].map((m) => (
                                <button 
                                key={m}
                                onClick={() => setPaymentMethod(m as any)}
                                className={`py-3 rounded-2xl text-[10px] font-black uppercase transition-all border ${
                                    paymentMethod === m 
                                    ? 'bg-accent border-accent text-foreground shadow-lg' 
                                    : 'bg-background border-app-border text-app-text-muted hover:border-accent/30'
                                }`}
                                >
                                {m === 'cash' ? 'Tunai' : m.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    )}
                  </div>

                  {/* ALWAYS VISIBLE SUMMARY & ACTIONS */}
                  <div className="flex flex-col gap-4 bg-background/50 p-1 rounded-3xl">
                      {/* TOTAL SUMMARY */}
                      <div className="flex items-center justify-between px-3">
                        <div>
                          <p className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-1">Total Tagihan</p>
                          <p className="text-3xl font-black text-accent tracking-tighter">Rp {total.toLocaleString('id-ID')}</p>
                        </div>
                        {paymentCategory === 'direct' && paymentMethod === 'cash' && (
                          <div className="flex flex-col items-end flex-1 max-w-[240px] space-y-3">
                              {/* SUGGESTIONS BUTTONS */}
                              <div className="flex flex-wrap justify-end gap-1.5 mb-1">
                                {[total, 2000, 5000, 10000, 20000, 50000, 100000]
                                  .filter((d, i, self) => d >= total && self.indexOf(d) === i)
                                  .sort((a, b) => a - b)
                                  .slice(0, 4)
                                  .map(val => (
                                    <button
                                      key={val}
                                      onClick={() => setCashReceived(val.toString())}
                                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all ${Number(cashReceived) === val ? 'bg-accent border-accent text-foreground shadow-lg shadow-accent/20' : 'bg-background border-app-border text-app-text-muted hover:border-accent'}`}
                                    >
                                      {val === total ? 'PAS' : val.toLocaleString('id-ID')}
                                    </button>
                                  ))
                                }
                              </div>
                              <input 
                                type="number"
                                value={cashReceived}
                                onChange={(e) => setCashReceived(e.target.value)}
                                placeholder="Tunai (Rp)..."
                                className="w-full max-w-[180px] p-4 bg-background border-2 border-app-border focus:border-accent rounded-2xl font-black text-2xl text-foreground focus:outline-none text-right shadow-xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              {Number(cashReceived) > 0 && (
                                <div className="mt-1 animate-in fade-in slide-in-from-right-2">
                                    <span className={`text-xs font-black ${change < 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                                      {change < 0 ? 'KURANG!' : `KEMBALI: Rp ${change.toLocaleString('id-ID')}`}
                                    </span>
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                      
                      {/* MOBILE DEBT DP INPUT */}
                      {paymentCategory === 'debt' && (
                        <div className="px-3 pb-2 space-y-2 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between">
                               <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Down Payment (DP)</p>
                               <div className="flex items-center gap-2">
                                 <span className="text-sm font-bold text-foreground">Rp</span>
                                 <input 
                                   type="number"
                                   value={debtDownPayment}
                                   onChange={(e) => setDebtDownPayment(e.target.value)}
                                   placeholder="0"
                                   className="w-full max-w-[160px] p-3 bg-background border-2 border-app-border focus:border-accent rounded-xl font-black text-xl text-foreground focus:outline-none text-right shadow-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                 />
                               </div>
                            </div>

                            <div className="flex items-center justify-between">
                               <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Jatuh Tempo</p>
                               <input 
                                 type="date"
                                 value={dueDate}
                                 onChange={(e) => setDueDate(e.target.value)}
                                 className="w-36 p-2 bg-background border border-app-border rounded-xl font-bold text-[10px] text-foreground focus:border-rose-500 focus:outline-none text-right shadow-inner cursor-pointer"
                               />
                            </div>

                             <div className="flex items-center justify-between bg-accent/10 border border-accent/20 rounded-2xl p-3">
                              <div className="flex items-center gap-2">
                                 <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
                                    <ClipboardList size={16} />
                                 </div>
                                 <p className="text-[10px] font-black text-foreground uppercase tracking-wider">Sisa Piutang</p>
                              </div>
                              <p className="text-lg font-black text-accent tracking-tighter">
                                Rp {Math.max(0, total - Number(debtDownPayment || 0)).toLocaleString('id-ID')}
                              </p>
                           </div>
                        </div>
                       )}

                    {/* MOBILE MERGE LIST (Always show if relevant) */}
                      {paymentCategory === 'merge' && (
                        <div className="space-y-1 px-2">
                          <p className="text-[8px] font-black text-app-text-muted uppercase">Pilih Pesanan Aktif</p>
                          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                              {activeOrders.map(ord => (
                                <button 
                                    key={ord.id}
                                    onClick={() => setSelectedOrderToMerge(ord.id)}
                                    className={`flex-shrink-0 p-2 px-3 rounded-xl border text-[9px] text-left transition-all ${selectedOrderToMerge === ord.id ? 'bg-accent border-accent text-foreground' : 'bg-background border-app-border text-app-text-muted'}`}
                                >
                                    <div className="font-black">{ord.customerName} {ord.paymentStatus !== 'pending' && <span className="text-rose-500 font-black tracking-widest">[PIUTANG]</span>}</div>
                                    <div className="opacity-70">Rp {ord.total.toLocaleString('id-ID')}</div>
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex gap-2 w-full">
                        <button 
                          onClick={handleResetTransaction}
                          className="h-14 w-14 flex-shrink-0 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-[20px] font-black flex items-center justify-center transition-all bg-surface border border-rose-500/20"
                        >
                          <Trash2 size={24} />
                        </button>
                        <button 
                          disabled={cart.length === 0 || isProcessing || (paymentCategory === 'direct' && paymentMethod === 'cash' && Number(cashReceived || 0) < total)}
                          onClick={openPreview}
                          className="w-full h-14 bg-accent text-foreground rounded-[20px] font-black shadow-xl shadow-accent/30 flex items-center justify-center gap-3 disabled:grayscale disabled:opacity-50 active:scale-95 transition-all"
                        >
                        {isProcessing ? (
                            <Loader2 className="animate-spin" />
                        ) : (
                          <>
                            <CreditCard size={20} /> 
                            {paymentCategory === 'order' ? 'BUAT PESANAN' : 
                              paymentCategory === 'debt' ? 'SIMPAN PIUTANG' : 
                              paymentCategory === 'merge' ? 'GABUNG' : 
                              'KONFIRMASI BAYAR'}
                          </>
                        )}
                      </button>
                     </div>
                  </div>
               </div>
           </div>
        </div>
      )}

      {/* MODAL TUTUP KASIR */}
      {isCloseCashierModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-surface border border-app-border rounded-[2.5rem] w-full max-w-sm shadow-2xl p-8 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
               <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                 <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl">
                    <Lock size={20} />
                 </div>
                 Tutup Kasir
               </h2>
               <button onClick={() => setIsCloseCashierModalOpen(false)} className="text-app-text-muted hover:text-rose-500">
                 <X size={24} />
               </button>
            </div>
            
            <div className="space-y-4">
               <div>
                  <label className="block text-[10px] font-black text-app-text-muted uppercase tracking-widest pl-1 mb-1">Uang Kas Aktual (Rp)</label>
                  <input 
                     type="number"
                     placeholder="Masukkan saldo laci akhir..."
                     value={actualCash}
                     onChange={e => setActualCash(e.target.value)}
                     className="w-full px-4 py-3 bg-background border border-app-border rounded-xl text-sm font-black text-foreground focus:outline-none focus:border-accent"
                  />
                  <p className="text-[9px] text-app-text-muted mt-2 italic px-1">Hitung fisik sisa uang tunai yang ada di laci kasir saat ini.</p>
               </div>
               <div>
                  <label className="block text-[10px] font-black text-app-text-muted uppercase tracking-widest pl-1 mb-1">Catatan Tambahan</label>
                  <textarea 
                     value={closeNote}
                     onChange={e => setCloseNote(e.target.value)}
                     placeholder="Penjelasan selisih (jika ada)..."
                     className="w-full px-4 py-3 bg-background border border-app-border rounded-xl text-sm font-medium text-foreground focus:outline-none focus:border-accent resize-none min-h-[80px]"
                  />
               </div>
               
               <button 
                  onClick={handleCloseCashier}
                  disabled={isProcessing}
                  className="w-full py-4 mt-2 bg-rose-500 text-white rounded-2xl font-black shadow-xl shadow-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                  {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                  KONFIRMASI TUTUP KASIR
               </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH PELANGGAN BARU */}
      {isAddCustomerModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-surface border border-app-border rounded-[2.5rem] w-full max-w-md shadow-2xl p-8 md:p-10 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-foreground flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                  <UserPlus size={24} />
                </div>
                Pelanggan Baru
              </h2>
              <button onClick={() => setIsAddCustomerModalOpen(false)} className="text-app-text-muted hover:text-rose-500 p-2 hover:bg-background rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSaveNewCustomer} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-2">Nama Pelanggan</label>
                <input 
                  required 
                  type="text" 
                  value={newCustomerName} 
                  onChange={e => setNewCustomerName(e.target.value)} 
                  className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all" 
                  placeholder="Misal: Budi Sudarsono" 
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-2">Nomor WhatsApp/HP</label>
                <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-app-text-muted font-bold text-sm">+62</div>
                   <input 
                     type="tel" 
                     value={newCustomerPhone} 
                     onChange={e => setNewCustomerPhone(e.target.value)} 
                     className="w-full p-4 pl-14 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all" 
                     placeholder="812xxxxxxx" 
                   />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsAddCustomerModalOpen(false)}
                  className="flex-1 py-4 bg-background border border-app-border rounded-2xl font-black text-app-text-muted hover:bg-surface transition-all"
                >
                  BATAL
                </button>
                <button 
                  type="submit" 
                  disabled={isProcessing || !newCustomerName}
                  className="flex-[2] py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                  SIMPAN PELANGGAN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PILIH PELANGGAN (LIST) */}
      {isCustomerSelectModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-surface border border-app-border rounded-[2.5rem] w-full max-w-2xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 duration-300">
            <div className="p-8 border-b border-app-border flex items-center justify-between bg-surface">
               <h2 className="text-2xl font-black text-foreground flex items-center gap-3">
                  <div className="p-2 bg-accent/10 rounded-xl text-accent">
                    <Users size={24} />
                  </div>
                  Pilih Pelanggan
               </h2>
               <div className="relative flex-1 max-w-xs mx-6">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" />
                  <input 
                    type="text" 
                    placeholder="Nama atau Nomor HP..."
                    value={modalSearch}
                    onChange={e => setModalSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-background border border-app-border rounded-xl text-sm font-bold text-foreground focus:outline-none focus:border-accent"
                  />
               </div>
               <button onClick={() => setIsCustomerSelectModalOpen(false)} className="text-app-text-muted hover:text-rose-500 p-2 hover:bg-background rounded-full transition-colors">
                 <X size={24} />
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-background/20">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {allCustomers
                    .filter(c => 
                      c.name.toLowerCase().includes(modalSearch.toLowerCase()) || 
                      (c.phone && c.phone.includes(modalSearch))
                    )
                    .map(c => (
                      <button 
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer({ id: c.id!, name: c.name });
                          setCustomerQuery(c.name);
                          setIsCustomerSelectModalOpen(false);
                          setModalSearch('');
                        }}
                        className="p-4 bg-surface border border-app-border rounded-[1.5rem] flex flex-col text-left hover:border-accent group transition-all"
                      >
                         <div className="flex items-center justify-between mb-2">
                            <span className="text-lg font-black text-foreground group-hover:text-accent truncate">{c.name}</span>
                            <div className="w-8 h-8 rounded-full bg-accent/5 flex items-center justify-center text-accent">
                               <Plus size={16} />
                            </div>
                         </div>
                         <div className="flex items-center gap-2 text-app-text-muted text-xs font-bold">
                            <span className="bg-background px-2 py-0.5 rounded-lg border border-app-border">
                               {c.phone ? `+62 ${c.phone}` : 'No Phone'}
                            </span>
                            <span className="opacity-40">•</span>
                            <span>{c.totalOrders || 0} Trx</span>
                         </div>
                      </button>
                    ))
                  }
                  {allCustomers.length === 0 && !isProcessing && (
                     <div className="col-span-full py-20 text-center opacity-30">
                        <Users size={48} className="mx-auto mb-4" />
                        <p className="font-bold">Belum ada pelanggan terdaftar</p>
                     </div>
                  )}
               </div>
            </div>

            <div className="p-6 border-t border-app-border bg-surface flex justify-center">
                <p className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em]">Total Terdaftar: {allCustomers.length} Pelanggan</p>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner */}
      {showScanner && (
        <BarcodeScanner 
          onScan={handleBarcodeScan}
          onClose={() => {
            setShowScanner(false);
            setLastScannedProduct(null);
            setScanNotFound(null);
          }}
          title="Scan Produk"
          continuous={true}
          bottomContent={
            <div className="w-full flex justify-center pb-4">
              {lastScannedProduct && (
                 <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl text-center w-full shadow-lg shadow-emerald-500/5 animate-in slide-in-from-bottom-4 duration-300">
                   <p className="text-emerald-500 font-black mb-1 uppercase tracking-widest text-[9px]">Berhasil Ditambahkan ✅</p>
                   <p className="text-foreground font-black text-sm">{lastScannedProduct.name}</p>
                   <p className="text-emerald-400 font-bold text-xs mt-1">Rp {lastScannedProduct.price.toLocaleString('id-ID')}</p>
                 </div>
              )}
              {scanNotFound && (
                 <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl text-center w-full shadow-lg shadow-rose-500/5 animate-in slide-in-from-bottom-4 duration-300">
                   <p className="text-rose-500 font-black mb-1 uppercase tracking-widest text-[9px]">Tidak Ditemukan ⚠️</p>
                   <p className="text-rose-400 font-bold text-xs mt-1 truncate" title={scanNotFound}>{scanNotFound}</p>
                 </div>
              )}
              {!lastScannedProduct && !scanNotFound && (
                <div className="w-full text-center">
                  <div className="w-full h-1 bg-accent/10 rounded-full overflow-hidden relative mb-4">
                     <div className="absolute inset-y-0 bg-accent animate-[shimmer_2s_infinite] w-1/3" />
                  </div>
                  <p className="text-center text-[10px] text-app-text-muted font-black uppercase tracking-[5px] animate-pulse">Menunggu Scan...</p>
                </div>
              )}
            </div>
          }
        />
      )}
      </div>
      {/* MODAL TAMBAH ITEM MANUAL */}
      {isManualItemModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
           <div className="bg-surface border border-app-border rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-app-border flex items-center justify-between">
                 <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                    <PlusCircle className="text-accent" />
                    Item Manual
                 </h2>
                 <button onClick={() => setIsManualItemModalOpen(false)} className="text-app-text-muted hover:text-rose-500">
                    <X size={24} />
                 </button>
              </div>
              <div className="p-6 space-y-4">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Nama Jasa / Sparepart</label>
                    <input 
                      type="text"
                      autoFocus
                      placeholder="Contoh: Service Ganti Oli"
                      value={manualItemName}
                      onChange={e => setManualItemName(e.target.value)}
                      className="w-full p-4 bg-background border border-app-border rounded-xl font-bold text-foreground focus:outline-none focus:border-accent"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Harga Satuan (Rp)</label>
                    <input 
                      type="number"
                      placeholder="0"
                      value={manualItemPrice}
                      onChange={e => setManualItemPrice(e.target.value)}
                      className="w-full p-4 bg-background border border-app-border rounded-xl font-black text-xl text-foreground focus:outline-none focus:border-accent"
                    />
                 </div>
                  <div className="space-y-4 pt-2 border-t border-app-border">
                     <label className="flex items-center gap-3 cursor-pointer group pt-2">
                        <div className="relative">
                           <input 
                             type="checkbox"
                             className="sr-only peer"
                             checked={saveToCatalog}
                             onChange={e => setSaveToCatalog(e.target.checked)}
                           />
                           <div className="w-10 h-6 bg-app-border rounded-full peer peer-checked:bg-accent transition-colors"></div>
                           <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
                        </div>
                        <span className="text-xs font-bold text-app-text-muted group-hover:text-foreground transition-colors">Simpan ke Katalog Produk?</span>
                     </label>

                     {saveToCatalog && (
                        <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                           <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Kategori Produk</label>
                           <select 
                             value={manualItemCategory}
                             onChange={e => setManualItemCategory(e.target.value)}
                             className="w-full p-3 bg-background border border-app-border rounded-xl font-bold text-xs text-foreground focus:outline-none focus:border-accent appearance-none capitalize"
                           >
                             {['Lainnya', 'Jasa', 'Sparepart', 'Service', 'Oli', 'Ban'].map(cat => (
                               <option key={cat} value={cat}>{cat}</option>
                             ))}
                           </select>
                        </div>
                     )}
                  </div>

                  <div className="pt-2">
                    <button 
                      onClick={addManualItem}
                      className="w-full py-4 bg-accent text-foreground rounded-2xl font-black shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                       TAMBAHKAN KE KERANJANG
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
