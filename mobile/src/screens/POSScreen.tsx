import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  Image, 
  ActivityIndicator, 
  Modal, 
  ScrollView, 
  Alert, 
  RefreshControl, 
  Vibration, 
  Pressable,
  Linking,
  useWindowDimensions
} from 'react-native';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  doc, 
  getDoc, 
  where, 
  limit, 
  updateDoc, 
  writeBatch, 
  increment, 
  serverTimestamp, 
  getDocs,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../context/ThemeContext';
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Package, 
  CheckCircle2, 
  X, 
  CreditCard, 
  Check, 
  Scan, 
  Printer,
  Lock,
  Unlock,
  Users,
  StickyNote,
  PlusCircle,
  ChevronDown,
  UserPlus,
  LayoutGrid,
  List,
  LayoutList
} from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import { printReceipt } from '../utils/ReceiptHelper';
import SignaturePad from '../components/SignaturePad';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingSkeleton from '../components/LoadingSkeleton';

// Types
interface Product {
  id?: string;
  name: string;
  price: number;
  purchasePrice?: number;
  stock: number;
  category: string;
  imageUrl?: string;
  manageStock?: boolean;
  hasExtras?: boolean;
  extras?: string[];
  barcode?: string;
  sku?: string;
  warrantyDuration?: number;
  warrantyUnit?: 'days' | 'months' | 'years';
}

interface ExtraOption {
  name: string;
  price: number;
}

interface ProductExtra {
  id?: string;
  name: string;
  options: ExtraOption[];
  isMandatory: boolean;
  allowMultiple: boolean;
  hasMaxLimit: boolean;
  maxLimit?: number;
}

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
  note: string;
}

export default function POSScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const { user, storeId, isSubscriptionExpired, expiredDisabledMenus } = useAuthStore();
  const blockedWhenExpired = expiredDisabledMenus || [];
  const isExpiredBlocked = isSubscriptionExpired && blockedWhenExpired.includes('/pos');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [storeSettings, setStoreSettings] = useState({
    useTax: false,
    taxRate: 0,
    storeName: '',
    phone: '',
    address: '',
    receiptMessage: '',
    qrisUrl: '',
    bankInfo: '',
  });

  const { width, height } = useWindowDimensions();
  const isTabletOrLandscape = width > 768 || width > height;

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [successTrx, setSuccessTrx] = useState<any>(null);
  const [viewingReceipt, setViewingReceipt] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedItem, setLastScannedItem] = useState<{name: string, price: number} | null>(null);

  // Extras States
  const [activeExtrasProduct, setActiveExtrasProduct] = useState<Product | null>(null);
  const [viewMode, setViewMode] = useState<'tiles' | 'list' | 'detail'>('tiles');
  const [availableExtraGroups, setAvailableExtraGroups] = useState<ProductExtra[]>([]);
  const [tempSelections, setTempSelections] = useState<Record<string, ExtraOption[]>>({});
  const [isLoadingExtras, setIsLoadingExtras] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Shift States
  const [activeShift, setActiveShift] = useState<any>(null);
  const [isShiftChecking, setIsShiftChecking] = useState(true);
  const [startingCash, setStartingCash] = useState('');
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [actualCash, setActualCash] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [activeStats, setActiveStats] = useState({ cashSales: 0, nonCashSales: 0, trxCount: 0 });

  // Customer States
  const [customerQuery, setCustomerQuery] = useState('');
  const [suggestions, setSuggestions] = useState<{ id: string; name: string }[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [allCustomers, setAllCustomers] = useState<{id: string, name: string}[]>([]);

  // Manual Item States
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualItemName, setManualItemName] = useState('');
  const [manualItemPrice, setManualItemPrice] = useState('');
  const [manualItemCategory, setManualItemCategory] = useState('Jasa');
  const [saveToCatalog, setSaveToCatalog] = useState(false);
  // Checkout configuration
  const [paymentCategory, setPaymentCategory] = useState<'direct' | 'debt' | 'order' | 'estimasi' | 'merge'>('direct');
  const [selectedOrderToMerge, setSelectedOrderToMerge] = useState<string>('');
  const [activeOrders, setActiveOrders] = useState<{id: string, customerName: string, total: number, paymentStatus?: string}[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'transfer'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [debtDownPayment, setDebtDownPayment] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [editingEstimationId, setEditingEstimationId] = useState<string | null>(null);
  const [originalEstimationData, setOriginalEstimationData] = useState<any>(null);
  // Item notes expand
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  // Helper date pre-population
  const getFutureDateString = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setRefreshing(false);
  };

  // Prepopulate due date to 14 days in future
  useEffect(() => {
    setDueDate(getFutureDateString(14));
  }, []);

  // Load estimation into checkout cart
  useEffect(() => {
    if (route?.params?.loadEstimate) {
      const est = route.params.loadEstimate;
      const mode = route.params.mode || 'convert'; // 'convert' or 'edit'

      if (est.items && est.items.length > 0) {
        const newCart: CartItem[] = est.items.map((item: any) => {
          const uniqueId = item.productId || `manual-${Math.random().toString(36).substring(2, 9)}`;
          return {
            id: item.productId === 'manual' ? undefined : item.productId,
            uniqueId: uniqueId,
            name: item.productName || 'Item Resep',
            price: item.price || 0,
            displayPrice: item.price || 0,
            originalPrice: item.price || 0,
            cartQty: item.qty || 1,
            stock: 999999,
            manageStock: false,
            category: 'Estimasi',
            selectedExtras: item.selectedExtras || [],
            discountName: item.discountName || null,
            note: item.note || ''
          };
        });
        setCart(newCart);
        const custName = est.customerName || est.name || '';
        if (custName) {
          setCustomerQuery(custName);
        }
        
        if (mode === 'edit') {
          setEditingEstimationId(est.id);
          setOriginalEstimationData(est);
          setPaymentCategory('estimasi');
          Alert.alert('Edit Estimasi', `Mengedit estimasi ${est.id}. Silakan edit item lalu selesaikan di checkout.`);
        } else {
          setEditingEstimationId(null);
          setOriginalEstimationData(null);
          setPaymentCategory('direct');
          Alert.alert('Estimasi Dimuat', `Berhasil memuat ${newCart.length} item dari estimasi ke keranjang POS.`);
        }
        
        // Clear parameters so it won't reload repeatedly
        navigation.setParams({ loadEstimate: null, mode: null });
      }
    }
  }, [route?.params?.loadEstimate, route?.params?.mode]);
  // Fetch settings & discounts & products
  useEffect(() => {
    if (!storeId) return;
    setLoading(true);

    // Products fetch
    const q = query(
      collection(db, 'products'),
      where('storeId', '==', storeId)
    );
    const unsubscribeProd = onSnapshot(q, (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach((doc) => {
        prods.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(prods);
      setLoading(false);
    });

    // Settings fetch
    const fetchSettings = async () => {
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
            qrisUrl: data.qrisUrl || '',
            bankInfo: data.bankInfo || '',
          });
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };
    fetchSettings();

    // Active discounts fetch
    const qDisc = query(
      collection(db, 'discounts'),
      where('storeId', '==', storeId),
      where('isActive', '==', true)
    );
    const unsubscribeDisc = onSnapshot(qDisc, (snapshot) => {
      const items: any[] = [];
      const now = new Date();
      snapshot.forEach((doc) => {
        const d = { id: doc.id, ...doc.data() } as any;
        const start = new Date(d.startDate);
        const end = d.endDate ? new Date(d.endDate) : null;
        if (now >= start && (!end || now <= end)) {
          items.push(d);
        }
      });
      setDiscounts(items);
    });

    return () => {
      unsubscribeProd();
      unsubscribeDisc();
    };
  }, [storeId]);

  // Listener for open cashier shifts
  useEffect(() => {
    if (!storeId || !user) return;
    const q = query(
      collection(db, 'shifts'),
      where('storeId', '==', storeId),
      where('userId', '==', user.uid),
      where('status', '==', 'open'),
      limit(1)
    );
    const unsubscribeShift = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setActiveShift({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setActiveShift(null);
      }
      setIsShiftChecking(false);
    });
    return () => unsubscribeShift();
  }, [storeId, user]);

  // Listener for cashier shift stats (realtime sales during active shift)
  useEffect(() => {
    if (!activeShift || !storeId) return;
    const qTrx = query(
      collection(db, 'transactions'),
      where('storeId', '==', storeId),
      where('cashierId', '==', activeShift.userId),
      where('timestamp', '>=', activeShift.startTime)
    );
    const unsubscribeTrxStats = onSnapshot(qTrx, (snap) => {
      let cash = 0;
      let nonCash = 0;
      snap.forEach(doc => {
        const d = doc.data();
        if (d.paymentStatus === 'paid') {
          if (d.paymentMethod === 'cash') cash += d.total;
          else nonCash += d.total;
        }
      });
      setActiveStats({
        cashSales: cash,
        nonCashSales: nonCash,
        trxCount: snap.size
      });
    }, (err) => {
      console.log("Error loading active stats:", err);
    });
    return () => unsubscribeTrxStats();
  }, [activeShift, storeId]);

  // Debounced customer suggestions query
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
          list = snap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
          setAllCustomers(list);
        }
        
        const qLower = customerQuery.toLowerCase();
        const filtered = list.filter(c => c.name.toLowerCase().includes(qLower)).slice(0, 5);
        setSuggestions(filtered);
      } catch (err) {
        console.error("Error searching customers:", err);
      }
    };
    const debounce = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(debounce);
  }, [customerQuery, selectedCustomer, allCustomers, storeId]);

  const [selectedCategory, setSelectedCategory] = useState('Semua');

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
  }, [paymentCategory, storeId]);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category || 'Umum'));
    return ['Semua', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
                          (p.category && p.category.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getEffectivePrice = (product: Product) => {
    const applicable = discounts.filter(d => d.appliedProductIds?.includes(product.id!));
    if (applicable.length === 0) return { price: product.price, discountInfo: null };

    let bestPrice = product.price;
    let selectedDiscount: any = null;

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

  const addToCart = async (product: Product) => {
    if (product.hasExtras && product.extras && product.extras.length > 0) {
      setActiveExtrasProduct(product);
      setTempSelections({});
      setIsLoadingExtras(true);
      
      try {
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
      return;
    }

    const uniqueId = product.id!;
    const { price: displayPrice, discountInfo } = getEffectivePrice(product);

    Vibration.vibrate(15);
    setCart(prev => {
      const existing = prev.find(item => item.uniqueId === uniqueId);
      if (existing) {
        if (product.manageStock !== false && existing.cartQty >= product.stock) {
          Alert.alert('Habis', 'Stok tidak mencukupi!');
          return prev;
        }
        return prev.map(item => item.uniqueId === uniqueId ? { ...item, cartQty: item.cartQty + 1 } : item);
      }
      if (product.manageStock !== false && product.stock <= 0) {
        Alert.alert('Habis', 'Stok produk ini sedang kosong.');
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

  const toggleOption = (group: ProductExtra, option: ExtraOption) => {
    const current = tempSelections[group.id!] || [];
    const isSelected = current.some(o => o.name === option.name);

    let next: ExtraOption[] = [];
    if (isSelected) {
      next = current.filter(o => o.name !== option.name);
    } else {
      if (!group.allowMultiple) {
        next = [option];
      } else {
        if (group.hasMaxLimit && current.length >= (group.maxLimit || 1)) {
          Alert.alert('Batas', `Maksimal pilihan untuk ${group.name} adalah ${group.maxLimit}`);
          return;
        }
        next = [...current, option];
      }
    }
    setTempSelections({ ...tempSelections, [group.id!]: next });
  };

  const confirmExtrasToCart = () => {
    if (!activeExtrasProduct) return;

    for (const group of availableExtraGroups) {
      if (group.isMandatory && (!tempSelections[group.id!] || tempSelections[group.id!].length === 0)) {
        Alert.alert('Wajib Pilih', `Harap pilih setidaknya satu opsi untuk ${group.name}`);
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

    Vibration.vibrate(15);
    setCart(prev => {
      const existing = prev.find(item => item.uniqueId === uniqueId);
      if (existing) {
        if (activeExtrasProduct.manageStock !== false && existing.cartQty >= (activeExtrasProduct.stock || 0)) {
          Alert.alert('Habis', 'Stok tidak mencukupi!');
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

  const updateQty = (uniqueId: string, delta: number) => {
    Vibration.vibrate(10);
    setCart(prev => {
      return prev.map(item => {
        if (item.uniqueId === uniqueId) {
          const newQty = item.cartQty + delta;
          if (newQty <= 0) return null;
          if (item.manageStock !== false && newQty > item.stock) {
            Alert.alert('Batas', 'Stok tidak mencukupi!');
            return item;
          }
          return { ...item, cartQty: newQty };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (uniqueId: string) => {
    setCart(prev => prev.filter(item => item.uniqueId !== uniqueId));
  };

  // Computations
  const subtotal = cart.reduce((sum, item) => sum + (item.displayPrice * item.cartQty), 0);
  const tax = storeSettings.useTax ? subtotal * (storeSettings.taxRate / 100) : 0;
  const total = subtotal + tax;
  const change = Number(cashReceived || 0) - total;

  const resetPOSState = () => {
    setCart([]);
    setCashReceived('');
    setDebtDownPayment('');
    setDueDate(getFutureDateString(14));
    setCustomerQuery('');
    setSelectedCustomer(null);
    setPaymentCategory('direct');
    setPaymentMethod('cash');
    setSelectedOrderToMerge('');
  };

  // Start Shift execution
  const handleStartShift = async () => {
    if (!startingCash) return;
    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'shifts'), {
        storeId,
        userId: user?.uid,
        userName: user?.name || user?.displayName || 'Kasir',
        startTime: new Date(),
        startingCash: Number(startingCash),
        systemCalculatedCash: 0,
        actualCash: 0,
        status: 'open',
        notes: ''
      });
      Vibration.vibrate(15);
      setStartingCash('');
    } catch (err) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal membuka shift.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Close Shift execution
  const handleCloseShift = async () => {
    if (!activeShift) return;
    setIsProcessing(true);
    try {
      const shiftRef = doc(db, 'shifts', activeShift.id);
      const totalSystemCash = activeStats.cashSales;
      const actual = Number(actualCash);
      const diff = actual - (activeShift.startingCash + totalSystemCash);

      await updateDoc(shiftRef, {
        status: 'closed',
        endTime: new Date(),
        systemCalculatedCash: totalSystemCash,
        actualCash: actual,
        notes: closeNote
      });

      await addDoc(collection(db, 'cashier_sessions'), {
        cashierId: activeShift.userId,
        cashierName: activeShift.userName,
        timestamp: new Date(),
        systemCalculatedCash: totalSystemCash,
        actualCash: actual,
        difference: diff,
        note: `Shift Closed: ${closeNote}`,
        storeId: storeId
      });

      Vibration.vibrate(15);
      setIsCloseShiftModalOpen(false);
      setActualCash('');
      setCloseNote('');
    } catch (err) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal menutup shift.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Add customer handler
  const handleSaveNewCustomer = async () => {
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
      Vibration.vibrate(15);
    } catch (err) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal menyimpan pelanggan baru.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Add manual item handler
  const addManualItem = async () => {
    if (!manualItemName || !manualItemPrice) {
      Alert.alert('Gagal', 'Nama dan Harga harus diisi!');
      return;
    }

    const price = Number(manualItemPrice);
    const uniqueId = `manual-${Math.random().toString(36).substring(2, 9)}`;
    let finalId: string | undefined = undefined;

    setIsProcessing(true);
    try {
      if (saveToCatalog) {
        const prodData = {
          storeId,
          name: manualItemName,
          price,
          originalPrice: price,
          stock: 999,
          manageStock: false,
          category: manualItemCategory,
          createdAt: new Date()
        };
        const docRef = await addDoc(collection(db, 'products'), prodData);
        finalId = docRef.id;
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
      setIsManualModalOpen(false);
      setManualItemName('');
      setManualItemPrice('');
      setSaveToCatalog(false);
      Vibration.vibrate(15);
    } catch (err) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal menambahkan item manual.');
    } finally {
      setIsProcessing(false);
    }
  };

    // Checkout execution
  const handleCheckout = async (signatureBase64?: string) => {
    if (cart.length === 0) return;

    if (paymentCategory === 'estimasi') {
      setIsProcessing(true);
      try {
        const localNow = new Date();
        
        let finalEstId = editingEstimationId || '';
        let finalNumber = originalEstimationData?.number || 0;
        let finalValidUntil = originalEstimationData?.validUntil || '';

        if (!finalValidUntil) {
          const validUntilDate = new Date();
          validUntilDate.setDate(localNow.getDate() + 30); // 30 days default
          finalValidUntil = validUntilDate.toISOString();
        }

        const estimationData: any = {
          storeId: storeId || 'default-store',
          cashierId: user?.uid,
          cashierName: user?.name || user?.displayName || 'Kasir',
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
          timestamp: localNow,
          validUntil: finalValidUntil,
          status: 'active'
        };

        if (editingEstimationId) {
          // UPDATE EXISTING ESTIMATION
          estimationData.id = editingEstimationId;
          estimationData.number = finalNumber;
          await updateDoc(doc(db, 'estimations', editingEstimationId), estimationData);
          setEditingEstimationId(null);
          setOriginalEstimationData(null);
          Alert.alert('Sukses', 'Estimasi berhasil diperbarui!');
        } else {
          // CREATE NEW ESTIMATION
          let currentCounter = 0;
          let prefix = 'EST-';
          let padding = 4;

          try {
            const settingsRef = doc(db, 'settings', `store_${storeId}`);
            const settingsSnap = await getDoc(settingsRef);
            if (settingsSnap.exists()) {
              const data = settingsSnap.data();
              currentCounter = Number(data.estCounter) || 0;
              prefix = data.estPrefix !== undefined ? data.estPrefix : 'EST-';
              padding = Number(data.estPadding) || 4;
            }
          } catch (err) {
            console.error("Error reading settings counter:", err);
          }

          currentCounter += 1;
          finalEstId = `${prefix}${String(currentCounter).padStart(padding, '0')}`;
          finalNumber = currentCounter;
          
          estimationData.id = finalEstId;
          estimationData.number = finalNumber;

          const batch = writeBatch(db);
          batch.set(doc(db, 'estimations', finalEstId), estimationData);
          batch.set(doc(db, 'settings', `store_${storeId}`), { estCounter: currentCounter }, { merge: true });
          await batch.commit();

          Alert.alert('Sukses', 'Estimasi berhasil disimpan!');
        }

        Vibration.vibrate([0, 15, 80, 15]);
        setSuccessTrx({ id: finalEstId, ...estimationData, isEstimation: true });
        resetPOSState();
        setShowCheckout(false);
        setShowSignature(false);
      } catch (err) {
        console.error(err);
        Alert.alert('Gagal', 'Gagal memproses estimasi.');
      } finally {
        setIsProcessing(false);
      }
      return;
    }
    if (paymentCategory === 'direct' && paymentMethod === 'cash' && Number(cashReceived || 0) < total) {
      Alert.alert('Gagal', 'Uang tunai kurang!');
      return;
    }
    if ((paymentCategory === 'debt' || paymentCategory === 'order') && !customerQuery) {
      Alert.alert('Gagal', 'Nama pelanggan wajib diisi!');
      return;
    }
    if (paymentCategory === 'merge' && !selectedOrderToMerge) {
      Alert.alert('Gagal', 'Harap pilih pesanan yang akan digabungkan!');
      return;
    }

    setIsProcessing(true);
    try {
      const localNow = new Date();

      if (paymentCategory === 'merge') {
        const orderRef = doc(db, 'transactions', selectedOrderToMerge);
        const docSnap = await getDoc(orderRef);
        if (!docSnap.exists()) {
          Alert.alert('Gagal', 'Pesanan tidak ditemukan.');
          setIsProcessing(false);
          return;
        }
        const existingData = docSnap.data();
        
        const newItems = cart.map(item => ({
          productId: item.id || 'manual',
          productName: item.name,
          qty: item.cartQty,
          price: item.displayPrice,
          subtotal: item.displayPrice * item.cartQty,
          originalPrice: item.originalPrice || item.price,
          purchasePrice: item.purchasePrice || 0,
          discountName: item.discountName || null,
          selectedExtras: item.selectedExtras || [],
          note: item.note?.trim() || null
        }));

        const mergedItems = [...existingData.items, ...newItems];
        const newSubtotal = existingData.subtotal + subtotal;
        const newTax = storeSettings.useTax ? newSubtotal * (storeSettings.taxRate / 100) : 0;
        const newTotal = newSubtotal + newTax;

        const updateData: any = {
          items: mergedItems,
          subtotal: newSubtotal,
          tax: newTax,
          total: newTotal
        };

        if (existingData.paymentCategory === 'debt') {
           const dp = existingData.paidAmount || 0;
           updateData.debtAmount = Math.max(0, newTotal - dp);
           updateData.paymentStatus = (newTotal - dp) > 0 ? (dp > 0 ? 'partially_paid' : 'unpaid') : 'paid';
        }

        await updateDoc(orderRef, updateData);

        Vibration.vibrate([0, 15, 80, 15]);
        setSuccessTrx({ id: selectedOrderToMerge, ...existingData, items: mergedItems, total: newTotal, paymentCategory: 'merge' });
        resetPOSState();
        setShowCheckout(false);
        setShowSignature(false);
        setIsProcessing(false);
        return;
      }

      const transactionData: any = {
        storeId: storeId || 'default-store',
        cashierId: user?.uid,
        cashierName: user?.name || user?.displayName || 'Kasir Mobile',
        items: cart.map(item => {
          let warrantyExpiry = null;
          if (item.warrantyDuration && item.warrantyDuration > 0) {
            const expiry = new Date();
            if (item.warrantyUnit === 'days') {
              expiry.setDate(expiry.getDate() + item.warrantyDuration);
            } else if (item.warrantyUnit === 'years') {
              expiry.setFullYear(expiry.getFullYear() + item.warrantyDuration);
            } else {
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
            originalPrice: item.originalPrice || item.price,
            purchasePrice: item.purchasePrice || 0,
            discountName: item.discountName || null,
            selectedExtras: item.selectedExtras || [],
            note: item.note?.trim() || null,
            warrantyExpiry
          };
        }),
        subtotal: subtotal,
        tax: tax,
        total: total,
        timestamp: localNow,
        customerName: customerQuery.trim() || 'Tanpa Nama',
        customerId: selectedCustomer?.id || null,
        paymentCategory: paymentCategory,
        orderStatus: paymentCategory === 'order' ? 'new' : 'completed',
        dueDate: dueDate || null,
        signatureBase64: signatureBase64 || null
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
            cashierName: user?.name || user?.displayName || 'Kasir',
            note: 'Pembayaran Awal (DP)'
          }];
        } else {
          transactionData.paymentHistory = [];
        }
      } else if (paymentCategory === 'order') {
        transactionData.paymentStatus = 'pending';
      }

      // Decrement stock and save transaction in a batch write
      let counterKey = 'trxCounter';
      let prefix = 'TRX-';
      if (paymentCategory === 'debt') {
        counterKey = 'debCounter';
        prefix = 'DEB-';
      } else if (paymentCategory === 'order') {
        counterKey = 'ordCounter';
        prefix = 'ORD-';
      }

      let currentCounter = 0;
      let padding = 4;
      let isOnline = true;

      try {
        const settingsRef = doc(db, 'settings', `store_${storeId}`);
        // Batasi getDoc dengan batas waktu 1.5 detik. Jika lewat, anggap offline
        const settingsSnap = await Promise.race([
          getDoc(settingsRef),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]) as any;

        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          currentCounter = Number(data[counterKey]) || 0;
          prefix = data[counterKey + 'Prefix'] !== undefined ? data[counterKey + 'Prefix'] : prefix;
          padding = Number(data[counterKey + 'Padding']) || 4;
        }
      } catch (err) {
        console.warn("Connection slow or offline, using offline checkout:", err);
        isOnline = false;
      }

      const batch = writeBatch(db);

      if (!isOnline) {
        const randomId = doc(collection(db, 'transactions')).id;
        const finalDocId = `OFF-${randomId.substring(0, 8).toUpperCase()}`;
        transactionData.id = finalDocId;
        transactionData.offline = true;
        transactionData.isOfflineTemp = true;

        batch.set(doc(db, 'transactions', finalDocId), transactionData);
        for (const item of cart) {
          if (item.manageStock !== false && item.id) {
            batch.update(doc(db, 'products', item.id), { stock: increment(-item.cartQty) });
          }
        }

        await batch.commit();

        Vibration.vibrate([0, 15, 80, 15]);
        setSuccessTrx({ id: finalDocId, ...transactionData });
        resetPOSState();
        setShowCheckout(false);
        setShowSignature(false);
        setIsProcessing(false);
        return;
      }

      currentCounter += 1;
      const finalDocId = `${prefix}${String(currentCounter).padStart(padding, '0')}`;
      transactionData.id = finalDocId;
      transactionData.queueNumber = currentCounter;

      batch.set(doc(db, 'transactions', finalDocId), transactionData);
      batch.set(doc(db, 'settings', `store_${storeId}`), { [counterKey]: currentCounter }, { merge: true });

      // Decrement stock
      for (const item of cart) {
        if (item.manageStock !== false && item.id) {
          batch.update(doc(db, 'products', item.id), { stock: increment(-item.cartQty) });
        }
      }

      await batch.commit();

      Vibration.vibrate([0, 15, 80, 15]);
      setSuccessTrx({ id: finalDocId, ...transactionData });
      resetPOSState();
      setShowCheckout(false);
      setShowSignature(false);
    } catch (err) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal memproses transaksi.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startScanning = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Izin Kamera', 'Izin kamera diperlukan untuk memindai barcode.');
        return;
      }
    }
    setShowScanner(true);
  };

  const playBeep = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/beepscan.mp3')
      );
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.log('Error playing sound:', error);
    }
  };

  const onBarcodeScanned = ({ data }: { data: string }) => {
    if (isScanning) return;
    setIsScanning(true);
    
    const product = products.find(p => p.barcode === data || (p.sku && p.sku === data));
    if (product) {
      playBeep();
      addToCart(product);
      setLastScannedItem({ name: product.name, price: product.price });
      Vibration.vibrate(15);
    } else {
      Alert.alert('Produk Tidak Ditemukan', `Barcode/SKU: ${data}`);
    }
    
    setTimeout(() => {
      setIsScanning(false);
      setTimeout(() => setLastScannedItem(null), 2000);
    }, 1500);
  };

  // Generate fast cash suggestions based on total
  const cashSuggestions = useMemo(() => {
    return [total, 20000, 50000, 100000]
      .filter((d, i, self) => d >= total && self.indexOf(d) === i)
      .sort((a, b) => a - b)
      .slice(0, 4);
  }, [total]);

  return (
    <SafeAreaView className="flex-1" edges={['bottom']} style={{ backgroundColor: colors.bg }}>
      <View className={isTabletOrLandscape ? 'flex-1 flex-row' : 'flex-1'}>
        <View className={isTabletOrLandscape ? 'flex-[2] border-r border-slate-800/40 relative overflow-hidden' : 'flex-1 relative'}>
      
      {/* SUBSCRIPTION EXPIRED OVERLAY */}
      {isExpiredBlocked && (
        <View className="absolute inset-0 z-[100] bg-slate-950/95 justify-center p-6">
          <View className="bg-slate-900 border border-slate-800 rounded-[32px] p-8 items-center shadow-2xl">
            <View className="bg-rose-500/10 p-5 rounded-full mb-6">
              <Lock size={40} color="#f43f5e" />
            </View>
            <Text className="text-xl font-black text-slate-100 uppercase tracking-tight mb-2 text-center">Akses Terkunci</Text>
            <Text className="text-xs font-bold text-slate-400 text-center leading-relaxed mb-6">
              Masa aktif langganan Kasir Pro Anda telah habis. Akses ke menu transaksi dihentikan sementara.
            </Text>

            <TouchableOpacity 
              onPress={() => navigation.navigate('Lainnya', { openSubscription: true })}
              className="w-full bg-accent py-4 rounded-2xl items-center justify-center flex-row gap-2 active:opacity-90 mb-3"
            >
              <Text className="font-black text-xs uppercase tracking-widest text-white">Buka Menu Langganan</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* SHIFT LOCK OVERLAY */}
      {!isShiftChecking && !activeShift && (
        <View className="absolute inset-0 z-50 bg-slate-950/95 justify-center p-6">
          <View className="bg-slate-900 border border-slate-800 rounded-[32px] p-8 items-center shadow-2xl">
            <View className="bg-rose-500/10 p-5 rounded-full mb-6">
              <Lock size={40} color="#f43f5e" />
            </View>
            <Text className="text-xl font-black text-slate-100 uppercase tracking-tight mb-2">Shift Belum Dibuka!</Text>
            <Text className="text-xs font-bold text-slate-400 text-center leading-relaxed mb-6">
              Akses aplikasi kasir terkunci. Silakan buka shift Anda dengan menginput Modal Awal di laci kas terlebih dahulu.
            </Text>

            <View className="w-full space-y-2 mb-6">
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Modal Awal / Uang Kas Laci (Rp)</Text>
              <View className="relative justify-center">
                <Text className="absolute left-5 text-sm font-black text-slate-400 z-10">RP</Text>
                <TextInput
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={startingCash}
                  onChangeText={setStartingCash}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-6 text-lg font-black text-slate-100"
                />
              </View>
            </View>

            <TouchableOpacity 
              onPress={handleStartShift}
              disabled={isProcessing || !startingCash}
              className="w-full bg-accent py-4 rounded-2xl items-center justify-center flex-row gap-2 active:opacity-90 disabled:opacity-50"
            >
              {isProcessing ? <ActivityIndicator color="#0f172a" /> : (
                <>
                  <Unlock size={18} color="#0f172a" />
                  <Text className="font-black text-xs uppercase tracking-widest text-slate-900">BUKA SHIFT SEKARANG</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main Bar Top Header */}
      <View className="flex-row justify-between items-center px-4 pt-3 pb-2 border-b" style={{ borderColor: colors.border }}>
        <Text className="text-lg font-black" style={{ color: colors.text }}>KASIR POS</Text>
        <View className="flex-row items-center">
          <TouchableOpacity 
            onPress={() => setIsManualModalOpen(true)}
            className="flex-row items-center bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 mr-2 active:opacity-80"
          >
            <PlusCircle size={14} color="#10b981" />
            <Text className="text-[9px] font-black text-emerald-500 ml-1 uppercase">Manual</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => {
              setActualCash('');
              setCloseNote('');
              setIsCloseShiftModalOpen(true);
            }}
            className="flex-row items-center bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/20 active:opacity-80"
          >
            <Lock size={14} color="#f43f5e" />
            <Text className="text-[9px] font-black text-rose-500 ml-1 uppercase">Tutup Shift</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Header */}
      <View className="p-4 border-b" style={{ borderColor: colors.border }}>
        <View className="flex-row gap-2">
          <View 
            className="flex-1 flex-row items-center px-4 py-2.5 rounded-2xl border"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <Search size={18} color={colors.textMuted} />
            <TextInput
              placeholder="Cari produk SKU/nama..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              className="flex-1 ml-2.5 font-bold text-xs"
              style={{ color: colors.text }}
            />
            <TouchableOpacity 
              onPress={startScanning}
              className="p-2 -mr-2"
            >
              <Scan size={18} color={colors.accent} />
            </TouchableOpacity>
          </View>

          {/* View Mode Toggle */}
          <View className="flex-row rounded-2xl p-0.5 border items-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <TouchableOpacity 
              onPress={() => setViewMode('tiles')}
              className="p-2.5 rounded-xl"
              style={{ backgroundColor: viewMode === 'tiles' ? colors.accent : 'transparent' }}
            >
              <LayoutGrid size={14} color={viewMode === 'tiles' ? '#ffffff' : colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setViewMode('list')}
              className="p-2.5 rounded-xl"
              style={{ backgroundColor: viewMode === 'list' ? colors.accent : 'transparent' }}
            >
              <List size={14} color={viewMode === 'list' ? '#ffffff' : colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setViewMode('detail')}
              className="p-2.5 rounded-xl"
              style={{ backgroundColor: viewMode === 'detail' ? colors.accent : 'transparent' }}
            >
              <LayoutList size={14} color={viewMode === 'detail' ? '#ffffff' : colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Category Slider */}
      <View className="px-4 py-3 border-b" style={{ borderColor: colors.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              activeOpacity={0.8}
              className="px-4 py-2 rounded-xl border"
              style={{
                backgroundColor: selectedCategory === cat ? colors.accent : colors.surface,
                borderColor: selectedCategory === cat ? colors.accent : colors.border
              }}
            >
              <Text 
                className="text-[9px] font-black uppercase tracking-wider" 
                style={{ color: selectedCategory === cat ? '#ffffff' : colors.textMuted }}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Product Grid */}
      {loading ? (
        <LoadingSkeleton type="card" count={6} />
      ) : (
        <FlatList
          key={viewMode}
          data={filteredProducts}
          numColumns={viewMode === 'tiles' ? 2 : 1}
          keyExtractor={item => item.id || Math.random().toString()}
          contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.accent]}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item }) => {
            const isOutOfStock = item.manageStock !== false && item.stock <= 0;
            const { price: displayPrice, discountInfo } = getEffectivePrice(item);
            const hasPromo = !!discountInfo;

            if (viewMode === 'tiles') {
              return (
                <TouchableOpacity 
                  onPress={() => addToCart(item)}
                  activeOpacity={0.7}
                  disabled={isOutOfStock}
                  className="flex-1 m-2 p-3 rounded-[24px] border"
                  style={{ 
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: isOutOfStock ? 0.6 : 1
                  }}
                >
                  <View 
                    className="w-full aspect-square rounded-2xl mb-3 overflow-hidden items-center justify-center relative"
                    style={{ backgroundColor: colors.bg }}
                  >
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <Package color={colors.textMuted} opacity={0.2} size={40} />
                    )}
                    
                    {isOutOfStock && (
                      <View className="absolute inset-0 bg-black/60 items-center justify-center">
                        <View className="bg-rose-500 px-3 py-1 rounded-full border border-rose-600">
                          <Text className="text-[9px] font-black text-white uppercase tracking-wider">HABIS</Text>
                        </View>
                      </View>
                    )}

                    {!isOutOfStock && hasPromo && (
                      <View className="absolute top-2 left-2 bg-emerald-500 px-2 py-0.5 rounded-lg">
                        <Text className="text-[8px] font-black text-white uppercase">PROMO</Text>
                      </View>
                    )}

                    {item.hasExtras && (
                      <View className="absolute top-2 right-2 bg-accent px-2 py-0.5 rounded-lg">
                        <Text className="text-[8px] font-black text-white">+ EXTRA</Text>
                      </View>
                    )}
                  </View>
                  
                  <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: colors.accent }}>{item.category || 'Umum'}</Text>
                  <Text className="text-sm font-black mt-0.5 mb-2" style={{ color: colors.text }} numberOfLines={2}>{item.name}</Text>
                  
                  <View className="flex-row justify-between items-end mt-auto pt-2 border-t border-slate-800/10">
                    <View>
                      {hasPromo && (
                        <Text className="text-[9px] text-slate-500 line-through">
                          Rp {item.price.toLocaleString('id-ID')}
                        </Text>
                      )}
                      <Text className="font-black text-emerald-500 text-xs">
                        Rp {displayPrice.toLocaleString('id-ID')}
                      </Text>
                    </View>
                    
                    <View 
                      className="w-7 h-7 rounded-xl items-center justify-center border"
                      style={{ backgroundColor: colors.accent + '15', borderColor: colors.accent + '40' }}
                    >
                      <Plus size={14} color={colors.accent} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }

            if (viewMode === 'list') {
              return (
                <TouchableOpacity 
                  onPress={() => addToCart(item)}
                  activeOpacity={0.7}
                  disabled={isOutOfStock}
                  className="mx-2 my-1.5 p-3 rounded-2xl border flex-row items-center justify-between"
                  style={{ 
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: isOutOfStock ? 0.6 : 1
                  }}
                >
                  <View className="flex-1 pr-4">
                    <Text className="text-xs font-bold" style={{ color: colors.text }} numberOfLines={1}>{item.name}</Text>
                    <Text className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{item.category || 'Umum'}</Text>
                  </View>
                  <View className="items-end shrink-0">
                    <Text className="font-black text-emerald-500 text-xs">
                      Rp {displayPrice.toLocaleString('id-ID')}
                    </Text>
                    {item.manageStock !== false && (
                      <Text className="text-[9px] text-slate-400 font-bold mt-0.5">
                        Stok: {item.stock}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }

            // Detail View
            return (
              <TouchableOpacity 
                onPress={() => addToCart(item)}
                activeOpacity={0.7}
                disabled={isOutOfStock}
                className="mx-2 my-1.5 p-3 rounded-[24px] border flex-row items-center gap-3.5"
                style={{ 
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: isOutOfStock ? 0.6 : 1
                }}
              >
                <View 
                  className="w-16 h-16 rounded-2xl overflow-hidden items-center justify-center relative shrink-0"
                  style={{ backgroundColor: colors.bg }}
                >
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <Package color={colors.textMuted} opacity={0.2} size={24} />
                  )}
                  
                  {isOutOfStock && (
                    <View className="absolute inset-0 bg-black/50 items-center justify-center">
                      <Text className="text-[8px] font-black text-rose-500 uppercase tracking-widest">HABIS</Text>
                    </View>
                  )}
                </View>

                <View className="flex-1 min-w-0">
                  <Text className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: colors.accent }}>{item.category || 'Umum'}</Text>
                  <Text className="text-sm font-black mb-1 truncate" style={{ color: colors.text }}>{item.name}</Text>
                  <View className="flex-row items-center gap-2">
                    <Text className="font-black text-emerald-500 text-xs">
                      Rp {displayPrice.toLocaleString('id-ID')}
                    </Text>
                    {item.sku && (
                      <Text className="text-[9px] text-slate-400 font-mono">
                        SKU: {item.sku}
                      </Text>
                    )}
                  </View>
                </View>

                <View className="items-end shrink-0 pl-2">
                  {item.manageStock !== false && (
                    <View 
                      className="px-2 py-0.5 rounded-lg"
                      style={{ backgroundColor: item.stock > 10 ? '#10b98115' : '#f43f5e15' }}
                    >
                      <Text 
                        className="text-[9px] font-black uppercase tracking-wider"
                        style={{ color: item.stock > 10 ? '#10b981' : '#f43f5e' }}
                      >
                        Stok: {item.stock}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Floating Cart Bar */}
      {!isTabletOrLandscape && cart.length > 0 && (
        <View 
          className="absolute bottom-6 left-6 right-6 h-16 rounded-[24px] shadow-2xl flex-row items-center px-6"
          style={{ backgroundColor: colors.accent }}
        >
          <ShoppingCart color="#0f172a" size={24} />
          <View className="ml-4 flex-1">
             <Text className="text-xs font-black opacity-70" style={{ color: '#0f172a' }}>
               {cart.reduce((sum, item) => sum + item.cartQty, 0)} Item
             </Text>
             <Text className="text-lg font-black" style={{ color: '#0f172a' }}>Rp {total.toLocaleString('id-ID')}</Text>
          </View>
          <TouchableOpacity 
            onPress={() => {
              setCustomerQuery('');
              setSelectedCustomer(null);
              setPaymentCategory('direct');
              setPaymentMethod('cash');
              setCashReceived('');
              setDebtDownPayment('');
              setDueDate(getFutureDateString(14));
              setShowCheckout(true);
            }}
            className="bg-white/20 px-4 py-2 rounded-xl"
          >
            <Text className="text-xs font-black" style={{ color: '#0f172a' }}>BAYAR</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Product Extras Modal */}
      <Modal visible={activeExtrasProduct !== null} animationType="slide" transparent onRequestClose={() => setActiveExtrasProduct(null)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View 
            className="h-[80%] rounded-t-[40px] p-6"
            style={{ backgroundColor: colors.bg }}
          >
            <View className="flex-row items-center justify-between mb-6">
              <View>
                <Text className="text-xl font-black" style={{ color: colors.text }}>Pilihan Extra</Text>
                <Text className="text-xs font-bold" style={{ color: colors.textMuted }}>{activeExtrasProduct?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveExtrasProduct(null)}>
                <X color={colors.text} size={24} />
              </TouchableOpacity>
            </View>

            {isLoadingExtras ? (
              <ActivityIndicator color={colors.accent} className="my-20" />
            ) : (
              <ScrollView className="flex-1">
                {availableExtraGroups.map(group => (
                  <View key={group.id} className="mb-6">
                    <View className="flex-row items-center gap-2 mb-3">
                      <Text className="text-sm font-black" style={{ color: colors.text }}>{group.name}</Text>
                      {group.isMandatory && (
                        <View className="bg-rose-500/10 px-2 py-0.5 rounded">
                          <Text className="text-[8px] font-bold text-rose-500">WAJIB</Text>
                        </View>
                      )}
                    </View>
                    
                    <View className="flex-row flex-wrap gap-2">
                      {group.options.map((option, idx) => {
                        const isSelected = (tempSelections[group.id!] || []).some(o => o.name === option.name);
                        return (
                          <TouchableOpacity
                            key={idx}
                            onPress={() => toggleOption(group, option)}
                            className="px-4 py-3 rounded-2xl border"
                            style={{ 
                              backgroundColor: isSelected ? colors.accent + '20' : colors.surface,
                              borderColor: isSelected ? colors.accent : colors.border
                            }}
                          >
                            <View className="flex-row items-center gap-2">
                               <Text className="font-bold" style={{ color: isSelected ? colors.accent : colors.text }}>
                                 {option.name}
                               </Text>
                               {option.price > 0 && (
                                 <Text className="text-[10px] opacity-70" style={{ color: colors.textMuted }}>
                                   +Rp{option.price.toLocaleString('id-ID')}
                                 </Text>
                               )}
                               {isSelected && <Check size={12} color={colors.accent} />}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              onPress={confirmExtrasToCart}
              className="h-16 rounded-[24px] items-center justify-center mt-4"
              style={{ backgroundColor: colors.accent }}
            >
              <Text className="font-black text-lg" style={{ color: '#0f172a' }}>TAMBAHKAN KE CART</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Manual Item Modal */}
      <Modal visible={isManualModalOpen} animationType="slide" transparent onRequestClose={() => setIsManualModalOpen(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="h-[75%] rounded-t-[40px] p-6 bg-slate-900">
            <View className="flex-row items-center justify-between mb-6">
              <View>
                <Text className="text-lg font-black text-slate-100">Tambah Item Manual</Text>
                <Text className="text-xs font-bold text-slate-400">Jasa / Barang tidak terdaftar</Text>
              </View>
              <TouchableOpacity onPress={() => setIsManualModalOpen(false)}>
                <X color="#94a3b8" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 space-y-4">
              <View className="space-y-1">
                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nama Item</Text>
                <TextInput
                  placeholder="e.g. Ongkos Kirim / Servis AC"
                  placeholderTextColor="#64748b"
                  value={manualItemName}
                  onChangeText={setManualItemName}
                  className="bg-slate-950 border border-slate-800 rounded-2xl py-3.5 px-4 text-sm font-bold text-slate-100"
                />
              </View>

              <View className="space-y-1">
                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Harga (Rp)</Text>
                <TextInput
                  placeholder="0"
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                  value={manualItemPrice}
                  onChangeText={setManualItemPrice}
                  className="bg-slate-950 border border-slate-800 rounded-2xl py-3.5 px-4 text-sm font-black text-slate-100"
                />
              </View>

              <View className="space-y-1">
                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Kategori</Text>
                <TextInput
                  placeholder="e.g. Jasa / Umum / Ongkir"
                  placeholderTextColor="#64748b"
                  value={manualItemCategory}
                  onChangeText={setManualItemCategory}
                  className="bg-slate-950 border border-slate-800 rounded-2xl py-3.5 px-4 text-sm font-bold text-slate-100"
                />
              </View>

              <TouchableOpacity 
                onPress={() => setSaveToCatalog(!saveToCatalog)}
                className="flex-row items-center p-4 bg-slate-950 border border-slate-800 rounded-2xl my-2"
              >
                <View className={`w-5 h-5 rounded border-2 items-center justify-center mr-3 ${saveToCatalog ? 'bg-accent border-accent' : 'border-slate-700'}`}>
                  {saveToCatalog && <Check size={14} color="#0f172a" />}
                </View>
                <Text className="text-xs font-bold text-slate-300">Simpan item ini ke katalog produk permanent</Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              onPress={addManualItem}
              disabled={isProcessing}
              className="h-14 rounded-2xl items-center justify-center bg-accent mt-4 active:opacity-90"
            >
              <Text className="font-black text-sm text-slate-950">TAMBAHKAN ITEM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Close Shift Modal */}
      <Modal visible={isCloseShiftModalOpen} animationType="slide" transparent onRequestClose={() => setIsCloseShiftModalOpen(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="h-[80%] rounded-t-[40px] p-6 bg-slate-900">
            <View className="flex-row items-center justify-between mb-6">
              <View>
                <Text className="text-lg font-black text-slate-100">Penutupan Shift Sesi</Text>
                <Text className="text-xs font-bold text-slate-400">Verifikasi Uang Fisik Di Laci Kas</Text>
              </View>
              <TouchableOpacity onPress={() => setIsCloseShiftModalOpen(false)}>
                <X color="#94a3b8" size={24} />
              </TouchableOpacity>
            </View>

            {activeShift && (
              <ScrollView className="flex-1 space-y-4">
                
                {/* Stats Summary Card */}
                <View className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 mb-2">
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-black text-slate-500 uppercase">Modal Awal</Text>
                    <Text className="text-xs font-bold text-slate-300">Rp {activeShift.startingCash.toLocaleString('id-ID')}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-black text-slate-500 uppercase">Penjualan Tunai</Text>
                    <Text className="text-xs font-bold text-slate-300">Rp {activeStats.cashSales.toLocaleString('id-ID')}</Text>
                  </View>
                  <View className="border-t border-slate-800/80 pt-2 flex-row justify-between">
                    <Text className="text-[10px] font-black text-slate-400 uppercase">Estimasi Total Kas</Text>
                    <Text className="text-sm font-black text-emerald-400">
                      Rp {(activeShift.startingCash + activeStats.cashSales).toLocaleString('id-ID')}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-black text-slate-500 uppercase">Non-Tunai (Transfer/QRIS)</Text>
                    <Text className="text-xs font-bold text-slate-300">Rp {activeStats.nonCashSales.toLocaleString('id-ID')}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-black text-slate-500 uppercase">Volume Penjualan</Text>
                    <Text className="text-xs font-bold text-slate-300">{activeStats.trxCount} Transaksi</Text>
                  </View>
                </View>

                {/* Cash Input */}
                <View className="space-y-1">
                  <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Total Uang Fisik Di Laci (Rp)</Text>
                  <View className="relative justify-center">
                    <Text className="absolute left-4 text-sm font-black text-slate-400 z-10">RP</Text>
                    <TextInput
                      placeholder="0"
                      placeholderTextColor="#64748b"
                      keyboardType="numeric"
                      value={actualCash}
                      onChangeText={setActualCash}
                      className="bg-slate-950 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-base font-black text-slate-100"
                    />
                  </View>
                </View>

                {/* Close Note */}
                <View className="space-y-1">
                  <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Catatan</Text>
                  <TextInput
                    placeholder="Masukkan catatan jika ada selisih laci..."
                    placeholderTextColor="#64748b"
                    multiline
                    numberOfLines={3}
                    value={closeNote}
                    onChangeText={setCloseNote}
                    className="bg-slate-950 border border-slate-800 rounded-2xl py-3.5 px-4 text-sm font-bold text-slate-100 h-20 text-start"
                  />
                </View>

              </ScrollView>
            )}

            <TouchableOpacity
              onPress={handleCloseShift}
              disabled={isProcessing || !actualCash}
              className="h-14 rounded-2xl items-center justify-center bg-rose-500 mt-4 active:opacity-90 disabled:opacity-50"
            >
              <Text className="font-black text-sm text-white">CETAK SETORAN & TUTUP SHIFT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Advanced Checkout Modal (Revamped) */}
        </View>

        {/* RIGHT SIDE / TABLET OR MODAL CHECKOUT */}
        {(isTabletOrLandscape || showCheckout) && (
          <View className={isTabletOrLandscape ? "flex-[1.2] bg-surface z-10" : "absolute inset-0 z-50 bg-black/60 justify-end"}>
            <View 
              className={isTabletOrLandscape ? "flex-1 px-5 pt-7 pb-2" : "h-[85%] rounded-t-[36px] px-6 pt-7 pb-2"}
              style={{ backgroundColor: colors.bg }}
            >
            <View className="flex-row items-center justify-between mb-5">
              <View>
                <Text className="text-2xl font-black tracking-tight" style={{ color: colors.text }}>Checkout</Text>
                <Text className="text-[10px] font-bold text-slate-400 mt-0.5">Selesaikan pesanan pelanggan</Text>
              </View>
              {!isTabletOrLandscape && (
                <TouchableOpacity 
                  onPress={() => setShowCheckout(false)}
                  className="w-10 h-10 rounded-full bg-black/5 items-center justify-center"
                >
                  <X color={colors.text} size={20} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView className="flex-1 space-y-5" showsVerticalScrollIndicator={false}>
              
              {/* Product Cart List */}
              <View className="space-y-2">
                <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Rincian Pesanan</Text>
                {cart.map(item => (
                  <View 
                    key={item.uniqueId} 
                    className="p-3.5 rounded-2xl border"
                    style={{ backgroundColor: colors.surface, borderColor: 'rgba(0,0,0,0.05)' }}
                  >
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1 pr-3">
                        <View className="flex-row items-center flex-wrap gap-2">
                          <Text className="text-[13px] font-black" style={{ color: colors.text }}>{item.name}</Text>
                          
                          <TouchableOpacity 
                            onPress={() => setExpandedNotes(prev => ({ ...prev, [item.uniqueId]: !prev[item.uniqueId] }))}
                            className={`p-1.5 rounded-lg ${item.note ? 'bg-amber-500/20' : 'bg-slate-800'}`}
                          >
                            <StickyNote size={12} color={item.note ? '#f59e0b' : '#94a3b8'} />
                          </TouchableOpacity>
                        </View>

                        {item.selectedExtras.length > 0 && (
                          <Text className="text-[9px] text-slate-400 mt-1">
                            Extras: {item.selectedExtras.map(e => `${e.optionName}`).join(', ')}
                          </Text>
                        )}
                        
                        {item.discountName && (
                          <Text className="text-[9px] text-emerald-500 font-bold mt-1">
                            Diskon: {item.discountName} (Hemat Rp {(item.originalPrice - item.displayPrice).toLocaleString('id-ID')})
                          </Text>
                        )}
                      </View>
                      
                      <View className="items-end">
                        <Text className="font-black text-emerald-400 text-sm">
                          Rp {(item.displayPrice * item.cartQty).toLocaleString('id-ID')}
                        </Text>
                        {item.discountName && (
                          <Text className="text-[9px] text-slate-500 line-through">
                            Rp {(item.originalPrice * item.cartQty).toLocaleString('id-ID')}
                          </Text>
                        )}
                      </View>
                    </View>
                    
                    {/* Collapsible Item Note */}
                    {expandedNotes[item.uniqueId] && (
                      <View className="mt-3">
                        <TextInput
                          placeholder="Ketik catatan..."
                          placeholderTextColor={colors.textMuted}
                          value={item.note}
                          onChangeText={(val) => {
                            setCart(prev => prev.map(i => i.uniqueId === item.uniqueId ? { ...i, note: val } : i));
                          }}
                          className="w-full bg-black/5 rounded-xl py-2.5 px-3 text-xs font-bold"
                          style={{ color: colors.text }}
                        />
                      </View>
                    )}

                    {/* Qty edit row */}
                    <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-black/5">
                      <TouchableOpacity onPress={() => removeFromCart(item.uniqueId)} className="p-1.5 bg-rose-500/10 rounded-lg">
                        <Trash2 size={14} color="#f43f5e" />
                      </TouchableOpacity>

                      <View className="flex-row items-center gap-3">
                         <TouchableOpacity onPress={() => updateQty(item.uniqueId, -1)} className="w-8 h-8 items-center justify-center rounded-lg bg-black/5">
                            <Minus size={14} color={colors.text} />
                         </TouchableOpacity>
                         <Text className="font-black text-xs" style={{ color: colors.text }}>{item.cartQty}</Text>
                         <TouchableOpacity onPress={() => updateQty(item.uniqueId, 1)} className="w-8 h-8 items-center justify-center rounded-lg bg-black/5">
                            <Plus size={14} color={colors.text} />
                         </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {/* Customer Lookup & Quick Add */}
              <View className="space-y-2">
                <View className="flex-row justify-between items-center ml-1">
                  <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Data Pelanggan</Text>
                  <TouchableOpacity 
                    onPress={() => setIsAddCustomerModalOpen(true)}
                    className="flex-row items-center bg-accent/10 px-3 py-1.5 rounded-xl border border-accent/20"
                  >
                    <UserPlus size={12} color={colors.accent} />
                    <Text className="text-[9px] font-black text-accent ml-1.5 uppercase">Baru</Text>
                  </TouchableOpacity>
                </View>

                <View className="flex-row gap-2 relative">
                  <View className="flex-1 bg-black/5 rounded-2xl flex-row items-center px-4">
                    <Search size={16} color={colors.textMuted} />
                    <TextInput
                      placeholder="Cari nama pelanggan..."
                      placeholderTextColor={colors.textMuted}
                      value={customerQuery}
                      onChangeText={setCustomerQuery}
                      className="flex-1 ml-2.5 py-3.5 text-xs font-bold"
                      style={{ color: colors.text }}
                    />
                    {selectedCustomer && (
                      <TouchableOpacity onPress={() => { setSelectedCustomer(null); setCustomerQuery(''); }} className="p-1 bg-rose-500/10 rounded-full">
                        <X size={12} color="#f43f5e" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Suggestions Dropdown overlay */}
                {suggestions.length > 0 && (
                  <View className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-1 shadow-2xl">
                    {suggestions.map(s => (
                      <TouchableOpacity 
                        key={s.id}
                        onPress={() => {
                          setSelectedCustomer(s);
                          setCustomerQuery(s.name.toLowerCase());
                          setSuggestions([]);
                        }}
                        className="p-3 border-b border-slate-800 last:border-0 active:bg-slate-800"
                      >
                        <Text className="text-xs font-bold text-slate-200 lowercase">{s.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Transaction Category Selector */}
              <View className="space-y-2">
                <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Kategori Pesanan</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row" contentContainerStyle={{ gap: 8 }}>
                  {[
                    { id: 'direct', label: 'Tunai' },
                    { id: 'debt', label: 'Piutang' },
                    { id: 'order', label: 'Antrean' },
                    { id: 'estimasi', label: 'Estimasi' },
                    { id: 'merge', label: 'Gabung' }
                  ].map(cat => (
                    <TouchableOpacity 
                      key={cat.id}
                      onPress={() => {
                        setPaymentCategory(cat.id as any);
                        setCashReceived('');
                        setDebtDownPayment('');
                      }}
                      className="px-5 py-3 rounded-full items-center border active:opacity-90"
                      style={{
                        backgroundColor: paymentCategory === cat.id ? colors.accent : colors.surface,
                        borderColor: paymentCategory === cat.id ? colors.accent : 'rgba(0,0,0,0.05)'
                      }}
                    >
                      <Text 
                        className="text-[11px] font-black tracking-widest"
                        style={{ color: paymentCategory === cat.id ? '#0f172a' : colors.textMuted }}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>              {/* Conditional Inputs based on Transaction Category */}
              {paymentCategory === 'direct' && (
                <View className="space-y-4">
                  
                  {/* Payment Method */}
                  <View className="space-y-2">
                    <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Pembayaran</Text>
                    <View className="flex-row gap-2">
                      {[
                        { id: 'cash', label: 'Tunai' },
                        { id: 'qris', label: 'QRIS' },
                        { id: 'transfer', label: 'Transfer' }
                      ].map(method => (
                        <TouchableOpacity 
                          key={method.id}
                          onPress={() => {
                            setPaymentMethod(method.id as any);
                            setCashReceived('');
                          }}
                          className="flex-1 py-3 rounded-xl items-center border active:opacity-90"
                          style={{
                            backgroundColor: paymentMethod === method.id ? colors.accent : colors.surface,
                            borderColor: paymentMethod === method.id ? colors.accent : 'rgba(0,0,0,0.05)'
                          }}
                        >
                          <Text 
                            className="text-[10px] font-black uppercase tracking-wider"
                            style={{ color: paymentMethod === method.id ? '#0f172a' : colors.textMuted }}
                          >
                            {method.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Cash received details */}
                  {paymentMethod === 'cash' && (
                    <View className="space-y-3 bg-black/5 p-4 rounded-2xl">
                      
                      {/* Fast Pay Suggestions */}
                      <View className="flex-row flex-wrap gap-2">
                        <TouchableOpacity 
                          onPress={() => setCashReceived(total.toString())}
                          className="bg-accent/15 px-3.5 py-2 rounded-xl border border-accent/20"
                        >
                          <Text className="text-[10px] font-black text-accent">UANG PAS</Text>
                        </TouchableOpacity>
                        
                        {cashSuggestions.map(val => (
                          <TouchableOpacity 
                            key={val}
                            onPress={() => setCashReceived(val.toString())}
                            className="bg-slate-800/10 px-3.5 py-2 rounded-xl border border-black/5"
                          >
                            <Text className="text-[10px] font-black" style={{ color: colors.text }}>
                              Rp {val.toLocaleString('id-ID')}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Manual received input */}
                      <View className="space-y-1.5 mt-2">
                        <Text className="text-[10px] font-black text-slate-400 uppercase ml-1">Diterima (Rp)</Text>
                        <TextInput
                          placeholder="Nominal bayar..."
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                          value={cashReceived}
                          onChangeText={setCashReceived}
                          className="w-full bg-white/50 border border-black/5 rounded-2xl py-3.5 px-4 font-black text-sm"
                          style={{ color: colors.text }}
                        />
                      </View>

                      {Number(cashReceived) > 0 && (
                        <View className="flex-row justify-between pt-2">
                          <Text className="text-[10px] font-black text-slate-400 uppercase ml-1">Kembalian</Text>
                          <Text className={`text-sm font-black ${change < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {change < 0 ? 'DANA KURANG!' : `Rp ${change.toLocaleString('id-ID')}`}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* QRIS details */}
                  {paymentMethod === 'qris' && (
                    <View className="space-y-3 bg-black/5 p-4 rounded-2xl items-center">
                      <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">Scan QRIS untuk Membayar</Text>
                      {storeSettings.qrisUrl ? (
                        <View className="p-2 bg-white rounded-2xl border border-black/5 shadow-sm">
                          <Image source={{ uri: storeSettings.qrisUrl }} style={{ width: 200, height: 200, resizeMode: 'contain' }} />
                        </View>
                      ) : (
                        <View className="p-4 bg-rose-500/10 rounded-xl border border-rose-500/20 w-full items-center">
                          <Text className="text-xs font-bold text-rose-500 text-center">Foto QRIS belum diunggah.</Text>
                          <Text className="text-[10px] font-bold text-slate-500 text-center mt-1">Silakan unggah foto QRIS di menu Pengaturan Toko terlebih dahulu.</Text>
                        </View>
                      )}
                      {storeSettings.qrisUrl && (
                         <Text className="text-[10px] font-black" style={{ color: colors.accent }}>Total Tagihan: Rp {total.toLocaleString('id-ID')}</Text>
                      )}
                    </View>
                  )}

                  {/* Bank Transfer details */}
                  {paymentMethod === 'transfer' && (
                    <View className="space-y-3 bg-black/5 p-4 rounded-2xl items-center">
                      <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">Info Rekening Transfer</Text>
                      {storeSettings.bankInfo ? (
                        <View className="p-4 bg-white rounded-2xl border border-black/5 shadow-sm w-full">
                          <Text className="text-sm font-black text-center" style={{ color: colors.text }}>{storeSettings.bankInfo}</Text>
                        </View>
                      ) : (
                        <View className="p-4 bg-rose-500/10 rounded-xl border border-rose-500/20 w-full items-center">
                          <Text className="text-xs font-bold text-rose-500 text-center">Info Bank belum diatur.</Text>
                          <Text className="text-[10px] font-bold text-slate-500 text-center mt-1">Silakan atur Info Rekening di menu Pengaturan Toko.</Text>
                        </View>
                      )}
                      {storeSettings.bankInfo && (
                         <Text className="text-[10px] font-black" style={{ color: colors.accent }}>Total Tagihan: Rp {total.toLocaleString('id-ID')}</Text>
                      )}
                    </View>
                  )}
                </View>
              )}

              {paymentCategory === 'debt' && (
                <View className="space-y-3 bg-black/5 p-4 rounded-2xl">
                  <View className="flex-row gap-3">
                    
                    {/* DP */}
                    <View className="flex-1 space-y-1.5">
                      <Text className="text-[10px] font-black text-slate-400 uppercase ml-1">DP (Awal)</Text>
                      <TextInput
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        value={debtDownPayment}
                        onChangeText={setDebtDownPayment}
                        className="bg-white/50 border border-black/5 rounded-xl py-3.5 px-4 text-xs font-black"
                        style={{ color: colors.text }}
                      />
                    </View>

                    {/* Due Date */}
                    <View className="flex-1 space-y-1.5">
                      <Text className="text-[10px] font-black text-slate-400 uppercase ml-1">Jatuh Tempo</Text>
                      <TextInput
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.textMuted}
                        value={dueDate}
                        onChangeText={setDueDate}
                        className="bg-white/50 border border-black/5 rounded-xl py-3.5 px-4 text-xs font-bold text-center"
                        style={{ color: colors.text }}
                      />
                    </View>
                  </View>

                  <View className="flex-row justify-between pt-3 border-t border-black/5 mt-2">
                    <Text className="text-[10px] font-black text-slate-400 uppercase ml-1">Sisa Hutang</Text>
                    <Text className="text-sm font-black text-rose-500">
                      Rp {Math.max(0, total - Number(debtDownPayment || 0)).toLocaleString('id-ID')}
                    </Text>
                  </View>
                </View>
              )}

            </ScrollView>

            {paymentCategory === 'merge' && (
              <View className="space-y-3 bg-black/10 p-4 rounded-3xl border" style={{ borderColor: colors.border }}>
                <Text className="text-[10px] font-black text-slate-400 uppercase">Pilih Pesanan untuk Digabung</Text>
                {activeOrders.length === 0 ? (
                  <Text className="text-xs font-bold text-center text-rose-400 py-4">Tidak ada pesanan aktif (Antrean/Piutang) yang bisa digabung.</Text>
                ) : (
                  <View className="space-y-2">
                    {activeOrders.map(ord => (
                      <TouchableOpacity
                        key={ord.id}
                        onPress={() => setSelectedOrderToMerge(ord.id)}
                        className="p-3 rounded-2xl border"
                        style={{
                          backgroundColor: selectedOrderToMerge === ord.id ? colors.accent + '20' : colors.surface,
                          borderColor: selectedOrderToMerge === ord.id ? colors.accent : colors.border
                        }}
                      >
                        <View className="flex-row justify-between items-center">
                          <View>
                            <Text className="text-xs font-bold" style={{ color: selectedOrderToMerge === ord.id ? colors.accent : colors.text }}>
                              {ord.id}
                            </Text>
                            <Text className="text-[10px] font-bold text-slate-400">
                              {ord.customerName} {ord.paymentStatus !== 'pending' && <Text style={{color: '#f43f5e', fontWeight: '900'}}>[PIUTANG]</Text>}
                            </Text>
                          </View>
                          <Text className="text-xs font-black" style={{ color: selectedOrderToMerge === ord.id ? colors.accent : colors.text }}>
                            Rp {ord.total.toLocaleString('id-ID')}
                          </Text>
                        </View>
                        
                        {/* Auto-expand confirm button when selected */}
                        {selectedOrderToMerge === ord.id && (
                          <TouchableOpacity 
                            onPress={() => handleCheckout()}
                            className="mt-3 p-3 rounded-xl items-center"
                            style={{ backgroundColor: colors.accent }}
                          >
                            <Text className="text-[10px] font-black uppercase text-slate-900 tracking-widest">
                              GABUNGKAN SEKARANG
                            </Text>
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Calculations and Actions Footer */}
            <View className="pt-5 mt-2 bg-transparent">
              <View className="flex-row justify-between items-end mb-4">
                <View>
                  <Text className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Tagihan</Text>
                  {storeSettings.useTax && (
                    <Text className="text-[9px] font-bold text-slate-500 mt-0.5">
                      Termasuk PPN ({storeSettings.taxRate}%)
                    </Text>
                  )}
                </View>
                <Text className="text-3xl font-black tracking-tighter" style={{ color: colors.accent }}>Rp {total.toLocaleString('id-ID')}</Text>
              </View>

              <TouchableOpacity
                onPress={() => handleCheckout()}
                disabled={isProcessing || (paymentCategory === 'direct' && paymentMethod === 'cash' && Number(cashReceived || 0) < total) || (paymentCategory === 'merge' && !selectedOrderToMerge)}
                className="w-full py-4 rounded-3xl flex-row justify-center items-center active:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: colors.accent, elevation: 4, shadowColor: colors.accent, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8 }}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#0f172a" />
                ) : (
                  <>
                    <CreditCard color="#0f172a" size={18} />
                    <Text className="text-[10px] font-black uppercase text-slate-900 tracking-widest ml-2">
                      {paymentCategory === 'order' ? 'PROSES ANTRIAN' : paymentCategory === 'merge' ? 'GABUNG PESANAN' : 'PROSES SELESAI'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            </View>
          </View>
        )}
      </View>

      {/* Quick Add Customer Modal */}
      <Modal visible={isAddCustomerModalOpen} animationType="slide" transparent onRequestClose={() => setIsAddCustomerModalOpen(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="h-[50%] rounded-t-[40px] p-6 bg-slate-900">
            <View className="flex-row items-center justify-between mb-6">
              <View>
                <Text className="text-lg font-black text-slate-100">Registrasi Pelanggan Baru</Text>
                <Text className="text-xs font-bold text-slate-400">Hubungkan piutang & pesanan</Text>
              </View>
              <TouchableOpacity onPress={() => setIsAddCustomerModalOpen(false)}>
                <X color="#94a3b8" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 space-y-4">
              <View className="space-y-1">
                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nama Lengkap</Text>
                <TextInput
                  placeholder="Nama pelanggan..."
                  placeholderTextColor="#64748b"
                  value={newCustomerName}
                  onChangeText={setNewCustomerName}
                  className="bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-sm font-bold text-slate-100"
                />
              </View>

              <View className="space-y-1">
                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nomor Telepon</Text>
                <TextInput
                  placeholder="e.g. 08123456789"
                  placeholderTextColor="#64748b"
                  keyboardType="phone-pad"
                  value={newCustomerPhone}
                  onChangeText={setNewCustomerPhone}
                  className="bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-sm font-bold text-slate-100"
                />
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={handleSaveNewCustomer}
              disabled={isProcessing || !newCustomerName.trim()}
              className="h-14 rounded-2xl items-center justify-center bg-accent mt-4 active:opacity-90 disabled:opacity-50"
            >
              <Text className="font-black text-sm text-slate-950">SIMPAN PELANGGAN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Barcode Scanner Modal */}
      <Modal visible={showScanner} animationType="fade" transparent onRequestClose={() => setShowScanner(false)}>
        <View className="flex-1 bg-black">
          {showScanner && (
            <CameraView 
              onBarcodeScanned={onBarcodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ["qr", "ean13", "code128", "code39", "upc_a"],
              }}
              style={{ flex: 1 }}
            />
          )}
          
          <View className="absolute inset-0 items-center justify-center pointer-events-none">
            <View className={`w-64 h-64 border-4 ${lastScannedItem ? 'border-emerald-500' : 'border-accent'} rounded-3xl opacity-50`} />
            <Text className="text-white font-black mt-8 text-lg bg-black/40 px-6 py-2 rounded-full">
              {lastScannedItem ? 'BERHASIL DISCAN!' : 'PINDAI BARCODE'}
            </Text>
          </View>

          {lastScannedItem && (
            <View className="absolute bottom-12 left-6 right-6 bg-emerald-500 rounded-2xl p-4 flex-row items-center shadow-2xl">
              <View className="w-12 h-12 bg-black/20 rounded-full items-center justify-center mr-4">
                <Check color="white" size={24} />
              </View>
              <View className="flex-1">
                <Text className="text-white font-black text-sm" numberOfLines={1}>{lastScannedItem.name}</Text>
                <Text className="text-emerald-100 font-bold text-xs mt-0.5">Rp {lastScannedItem.price.toLocaleString('id-ID')} ditambahkan ke keranjang</Text>
              </View>
            </View>
          )}

          <TouchableOpacity 
            onPress={() => setShowScanner(false)}
            className="absolute top-12 right-6 w-12 h-12 rounded-full bg-black/50 items-center justify-center"
          >
            <X color="white" size={28} />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Success Receipt Modal */}
      <Modal visible={successTrx !== null} animationType="fade" transparent onRequestClose={() => setSuccessTrx(null)}>
        <View className="flex-1 bg-black/80 items-center justify-center p-6">
          <View className="w-full max-w-sm rounded-[40px] p-8 items-center" style={{ backgroundColor: colors.surface }}>
            <CheckCircle2 color="#10b981" size={60} className="mb-4" />
            <Text className="text-xl font-black text-center mb-2" style={{ color: colors.text }}>
              {successTrx?.isEstimation ? 'ESTIMASI SUKSES' : 'TRANSAKSI SUKSES'}
            </Text>
            <Text className="text-xs text-app-text-muted text-center mb-6">
              {successTrx?.isEstimation 
                ? `Tercatat di data penawaran/estimasi dengan ID #${successTrx?.id}` 
                : `Tercatat di antrean/transaksi dengan ID #${successTrx?.id?.substring(0, 8)}`}
            </Text>
            <View className="w-full bg-slate-950/20 border border-slate-800 p-4 rounded-2xl mb-6 text-sm space-y-2">
              <View className="flex-row justify-between">
                <Text className="text-[10px] font-bold text-slate-400">Total Tagihan</Text>
                <Text className="text-xs font-black text-slate-200">Rp {successTrx?.total.toLocaleString('id-ID')}</Text>
              </View>
              {successTrx?.paymentCategory === 'direct' && successTrx?.paymentMethod === 'cash' && (
                <>
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-bold text-slate-400">Diterima</Text>
                    <Text className="text-xs font-black text-slate-200">Rp {successTrx?.cashReceived.toLocaleString('id-ID')}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-bold text-emerald-400">Kembalian</Text>
                    <Text className="text-xs font-black text-emerald-400">Rp {successTrx?.change.toLocaleString('id-ID')}</Text>
                  </View>
                </>
              )}
              {successTrx?.paymentCategory === 'debt' && (
                <>
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-bold text-slate-400">Dibayar (DP)</Text>
                    <Text className="text-xs font-black text-slate-200">Rp {successTrx?.paidAmount?.toLocaleString('id-ID')}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-bold text-rose-400">Sisa Piutang</Text>
                    <Text className="text-xs font-black text-rose-400">Rp {successTrx?.debtAmount?.toLocaleString('id-ID')}</Text>
                  </View>
                </>
              )}
            </View>

            <View className="w-full gap-2">
              <TouchableOpacity 
                onPress={() => setViewingReceipt(successTrx)} 
                className="w-full py-4 rounded-2xl flex-row items-center justify-center gap-2 active:opacity-95"
                style={{ backgroundColor: colors.accent }}
              >
                <Printer color="#0f172a" size={18} />
                <Text className="text-center font-black text-xs text-slate-900">LIHAT STRUK DIGITAL</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setSuccessTrx(null)} className="w-full py-4 rounded-2xl bg-accent/10 active:opacity-90">
                <Text className="text-center font-black text-xs" style={{ color: colors.accent }}>SELESAI</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Digital Receipt Modal (Struk Digital) */}
      <Modal visible={viewingReceipt !== null} animationType="slide" transparent onRequestClose={() => setViewingReceipt(null)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="h-[85%] rounded-t-[40px] p-6 bg-slate-900">
            <View className="flex-row items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <View className="flex-row items-center gap-2">
                <View className="p-2 bg-emerald-500/10 rounded-xl">
                  <CheckCircle2 size={18} color="#10b981" />
                </View>
                <Text className="text-lg font-black text-slate-100">Struk Digital</Text>
              </View>
              <TouchableOpacity onPress={() => setViewingReceipt(null)}>
                <X color="#94a3b8" size={24} />
              </TouchableOpacity>
            </View>

            {/* Scrollable Receipt Area */}
            <ScrollView className="flex-1 bg-white rounded-3xl p-6 mb-4" showsVerticalScrollIndicator={false}>
              <View className="items-center mb-4">
                <Text className="text-sm font-black text-slate-900 uppercase text-center mb-1">
                  {storeSettings?.storeName || 'TOKO KAMI'}
                </Text>
                {storeSettings?.address ? (
                  <Text className="text-[10px] text-slate-500 text-center font-mono whitespace-pre-line leading-tight">
                    {storeSettings.address}
                  </Text>
                ) : null}
                {storeSettings?.phone ? (
                  <Text className="text-[10px] text-slate-500 text-center font-mono leading-none mt-1">
                    Telp: {storeSettings.phone}
                  </Text>
                ) : null}
                
                {/* Dashed Separator */}
                <View className="w-full border-t border-dashed border-slate-300 mt-3 pt-1" />
              </View>

              {/* Transaction Metadata */}
              <View className="space-y-1 mb-4">
                <View className="flex-row justify-between">
                  <Text className="text-[10px] font-mono text-slate-500">Nomor TRX</Text>
                  <Text className="text-[10px] font-mono font-bold text-slate-900">
                    #{(viewingReceipt?.id || "").toUpperCase()}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-[10px] font-mono text-slate-500">Tanggal</Text>
                  <Text className="text-[10px] font-mono font-bold text-slate-900">
                    {viewingReceipt?.timestamp ? (
                      viewingReceipt.timestamp.toDate 
                      ? viewingReceipt.timestamp.toDate().toLocaleString('id-ID')
                      : new Date(viewingReceipt.timestamp).toLocaleString('id-ID')
                    ) : 'Baru saja'}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-[10px] font-mono text-slate-500">Pelanggan</Text>
                  <Text className="text-[10px] font-mono font-bold text-slate-900">
                    {viewingReceipt?.customerName || 'Umum'}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-[10px] font-mono text-slate-500">Kasir</Text>
                  <Text className="text-[10px] font-mono font-bold text-slate-900">
                    {viewingReceipt?.cashierName?.includes('@') 
                      ? viewingReceipt.cashierName.split('@')[0] 
                      : (viewingReceipt?.cashierName || 'Kasir')}
                  </Text>
                </View>
                
                {/* Dashed Separator */}
                <View className="w-full border-t border-dashed border-slate-300 mt-3 pt-1" />
              </View>

              {/* Item details */}
              <View className="space-y-3 mb-4">
                {viewingReceipt?.items?.map((item: any, idx: number) => (
                  <View key={idx} className="space-y-1">
                    <View className="flex-row justify-between">
                      <Text className="text-[10px] font-mono font-bold text-slate-900 flex-1 mr-4 uppercase">
                        {item.productName || item.name}
                      </Text>
                      <Text className="text-[10px] font-mono font-bold text-slate-900">
                        Rp {item.subtotal ? item.subtotal.toLocaleString('id-ID') : (item.price * item.qty).toLocaleString('id-ID')}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-[9px] font-mono text-slate-500">
                        {item.qty || item.cartQty} x {item.price.toLocaleString('id-ID')}
                      </Text>
                      {item.note ? (
                        <Text className="text-[9px] font-mono italic text-slate-500">({item.note})</Text>
                      ) : null}
                    </View>
                    
                    {item.selectedExtras?.length > 0 && (
                      <View className="pl-3 border-l border-slate-200">
                        {item.selectedExtras.map((ex: any, ei: number) => (
                          <View key={ei} className="flex-row justify-between">
                            <Text className="text-[8px] font-mono text-slate-400">+ {ex.optionName}</Text>
                            <Text className="text-[8px] font-mono text-slate-400">Rp {ex.price.toLocaleString('id-ID')}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
                
                {/* Dashed Separator */}
                <View className="w-full border-t border-dashed border-slate-300 mt-3 pt-1" />
              </View>

              {/* Calculations summary */}
              <View className="space-y-1.5">
                <View className="flex-row justify-between">
                  <Text className="text-[10px] font-mono text-slate-500">SUBTOTAL</Text>
                  <Text className="text-[10px] font-mono font-bold text-slate-900">
                    Rp {viewingReceipt?.subtotal ? viewingReceipt.subtotal.toLocaleString('id-ID') : viewingReceipt?.total.toLocaleString('id-ID')}
                  </Text>
                </View>
                {viewingReceipt?.tax > 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-mono text-slate-500">PAJAK PPN</Text>
                    <Text className="text-[10px] font-mono font-bold text-slate-900">
                      Rp {viewingReceipt.tax.toLocaleString('id-ID')}
                    </Text>
                  </View>
                )}
                
                <View className="flex-row justify-between border-t border-slate-200 pt-1.5 mt-1.5">
                  <Text className="text-[11px] font-mono font-black text-slate-900">TOTAL</Text>
                  <Text className="text-[11px] font-mono font-black text-slate-900">
                    Rp {viewingReceipt?.total.toLocaleString('id-ID')}
                  </Text>
                </View>

                {viewingReceipt?.paymentStatus === 'paid' && (
                  <>
                    <View className="flex-row justify-between">
                      <Text className="text-[10px] font-mono text-slate-500">
                        {viewingReceipt.cashReceived ? 'UANG TUNAI DITERIMA' : 'METODE BAYAR'}
                      </Text>
                      <Text className="text-[10px] font-mono font-bold text-slate-900">
                        {viewingReceipt.cashReceived 
                          ? `Rp ${viewingReceipt.cashReceived.toLocaleString('id-ID')}` 
                          : viewingReceipt.paymentMethod?.toUpperCase()}
                      </Text>
                    </View>
                    {viewingReceipt.change > 0 && (
                      <View className="flex-row justify-between">
                        <Text className="text-[10px] font-mono text-emerald-600 font-bold">KEMBALIAN</Text>
                        <Text className="text-[10px] font-mono font-bold text-emerald-600">
                          Rp {viewingReceipt.change.toLocaleString('id-ID')}
                        </Text>
                      </View>
                    )}
                  </>
                )}

                {viewingReceipt?.paymentCategory === 'debt' && (
                  <>
                    <View className="flex-row justify-between">
                      <Text className="text-[10px] font-mono text-slate-500">DIBAYAR (DP)</Text>
                      <Text className="text-[10px] font-mono font-bold text-slate-900">
                        Rp {viewingReceipt.paidAmount?.toLocaleString('id-ID') || '0'}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-[10px] font-mono text-rose-500 font-bold">SISA PIUTANG</Text>
                      <Text className="text-[10px] font-mono font-bold text-rose-500">
                        Rp {viewingReceipt.debtAmount?.toLocaleString('id-ID') || '0'}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {/* Footer Message */}
              <View className="items-center mt-6 pt-4 border-t border-dashed border-slate-300">
                <Text className="text-[9px] font-mono font-bold text-slate-500 text-center">
                  {storeSettings?.receiptMessage || 'TERIMA KASIH ATAS KUNJUNGAN ANDA'}
                </Text>
              </View>
            </ScrollView>

            {/* Print Action Row at bottom */}
            <View className="flex-row gap-3 pt-2">
              <TouchableOpacity
                onPress={async () => {
                  setViewingReceipt(null);
                  setSuccessTrx(null);
                }}
                className="flex-1 py-4 bg-slate-800 rounded-2xl items-center justify-center active:opacity-90"
              >
                <Text className="font-black text-xs text-slate-300 uppercase tracking-widest text-center">Tutup</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  await printReceipt(viewingReceipt, storeSettings);
                  setViewingReceipt(null);
                  setSuccessTrx(null);
                }}
                className="flex-[2] py-4 bg-accent rounded-2xl items-center justify-center flex-row gap-2 active:opacity-95"
              >
                <Printer size={16} color="#0f172a" />
                <Text className="font-black text-xs text-slate-900 uppercase tracking-widest text-center">CETAK STRUK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Signature Modal */}
      <Modal visible={showSignature} animationType="slide" transparent onRequestClose={() => setShowSignature(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View 
            className="h-[60%] rounded-t-[40px] p-6"
            style={{ backgroundColor: colors.bg }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-xl font-black" style={{ color: colors.text }}>Tanda Tangan</Text>
                <Text className="text-xs font-bold" style={{ color: colors.textMuted }}>Selesaikan Transaksi</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSignature(false)}>
                <X color={colors.text} size={24} />
              </TouchableOpacity>
            </View>

            <View className="flex-1 rounded-2xl overflow-hidden border" style={{ borderColor: colors.border }}>
               <SignaturePad 
                 onOK={(base64) => handleCheckout(base64)}
                 onCancel={() => setShowSignature(false)}
               />
            </View>
            
            <TouchableOpacity 
              onPress={() => handleCheckout()} 
              className="mt-4 p-4 items-center justify-center border rounded-2xl"
              style={{ borderColor: colors.border }}
            >
              <Text className="font-bold text-xs" style={{ color: colors.textMuted }}>Lewati Tanda Tangan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
