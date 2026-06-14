'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc, 
  addDoc, 
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword, deleteUser, updateProfile } from 'firebase/auth';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useBranding } from '@/context/BrandingContext';
import { 
  ShoppingCart, 
  User as UserIcon, 
  MapPin, 
  MessageCircle, 
  ChevronRight, 
  ClipboardList, 
  ArrowLeft, 
  History, 
  Plus, 
  Minus,
  Trash2, 
  X, 
  Search, 
  Loader2, 
  AlertCircle, 
  Banknote, 
  CreditCard, 
  QrCode, 
  AlertTriangle, 
  CheckCircle2,
  HelpCircle,
  ShoppingBag,
  Truck,
  Store,
  Camera,
  Upload,
  Image as ImageIcon
} from 'lucide-react';

interface Product {
  id?: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
  stock: number;
  manageStock?: boolean;
  hasExtras?: boolean;
  extras?: string[];
}

interface ProductExtra {
  id?: string;
  name: string;
  options: ExtraOption[];
  isMandatory?: boolean;
  allowMultiple?: boolean;
  maxLimit?: number;
  hasMaxLimit?: boolean;
}

interface ExtraOption {
  name: string;
  price: number;
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
  note: string;
}

const FONT_OPTIONS = [
  { id: 'sans', name: 'Modern (Sans)', family: "'Inter', sans-serif" },
  { id: 'serif', name: 'Classic (Serif)', family: "var(--font-playfair), serif" },
  { id: 'mono', name: 'Retro (Mono)', family: "'Courier New', monospace" },
  { id: 'elegant', name: 'Elegant (Outfit)', family: "var(--font-outfit), sans-serif" },
  { id: 'bold', name: 'Impact (Oswald)', family: "var(--font-oswald), sans-serif" }
];

const getFontFamily = (id: string) => {
  return FONT_OPTIONS.find(f => f.id === id)?.family || FONT_OPTIONS[0].family;
};

function PublicOrderContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { branding } = useBranding();
  const storeId = searchParams.get('s') || '';
  
  const [activeTab, setActiveTab] = useState<'menu' | 'orders' | 'account'>('menu');
  const [products, setProducts] = useState<Product[]>([]);
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isConfirmingCheckout, setIsConfirmingCheckout] = useState(false);
  const [fulfillmentType, setFulfillmentType] = useState<'pickup' | 'delivery'>('pickup');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qris'>('cash');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [selectedStoreBankId, setSelectedStoreBankId] = useState<string>('');
  const [selectedStoreEwalletId, setSelectedStoreEwalletId] = useState<string>('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentProofUrl, setPaymentProofUrl] = useState<string>('');
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  // Extras Modal State
  const [activeExtrasProduct, setActiveExtrasProduct] = useState<Product | null>(null);
  const [availableExtraGroups, setAvailableExtraGroups] = useState<ProductExtra[]>([]);
  const [tempSelections, setTempSelections] = useState<Record<string, ExtraOption[]>>({});
  const [isLoadingExtras, setIsLoadingExtras] = useState(false);

  // User State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [guestId, setGuestId] = useState('');
  const [myOrderIds, setMyOrderIds] = useState<string[]>([]);
  const [myOrdersData, setMyOrdersData] = useState<any[]>([]);
  const [authUser, setAuthUser] = useState<any>(null);
  const [isPasswordProvider, setIsPasswordProvider] = useState(false);

  // Security & Profile States
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [pwdOld, setPwdOld] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdDelete, setPwdDelete] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<any>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Navigation Guard for Modals (Mobile Back Button support)
  useEffect(() => {
    const isAnyModalOpen = isCheckoutOpen || !!activeExtrasProduct;
    
    if (!isAnyModalOpen) return;

    // Push a dummy state so back button closes modal instead of exiting page
    window.history.pushState({ modalOpen: true }, "");
    
    const handlePopState = (e: PopStateEvent) => {
      // If user presses back button (popstate fires)
      setIsCheckoutOpen(false);
      setActiveExtrasProduct(null);
      setIsConfirmingCheckout(false);
    };

    window.addEventListener("popstate", handlePopState);
    
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isCheckoutOpen, activeExtrasProduct]);

  // Helper to close modal manually while syncing history
  const handleManualClose = () => {
    if (window.history.state?.modalOpen) {
      window.history.back();
    } else {
      setIsCheckoutOpen(false);
      setActiveExtrasProduct(null);
      setIsConfirmingCheckout(false);
      setViewingReceipt(null);
    }
  };

  // Sync Auth State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      let isCustomer = false;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.role === 'customer') {
            isCustomer = true;
            setAuthUser(user);
            setIsPasswordProvider(user.providerData.some((p: any) => p.providerId === 'password'));
            setCustomerName(userData.name || user.displayName || '');
            setCustomerPhone(userData.phone || '');
          }
        }
      }
      
      if (!isCustomer) {
        setAuthUser(null);
        const savedName = localStorage.getItem('customer_name') || '';
        const savedPhone = localStorage.getItem('customer_phone') || '';
        setCustomerName(savedName);
        setCustomerPhone(savedPhone);
      }
    });
    return () => unsub();
  }, []);

  // Load Initial Data
  useEffect(() => {
    if (!storeId) {
      setIsLoading(false);
      return;
    }

    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', "store_" + storeId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStoreSettings(data);
          
          // Auto-adjust fulfillment type based on settings
          if (data.allowPickup === false && data.allowDelivery !== false) {
            setFulfillmentType('delivery');
          } else if (data.allowDelivery === false && data.allowPickup !== false) {
            setFulfillmentType('pickup');
          }
        }
      } catch (err) {
        console.error("Gagal memuat pengaturan toko", err);
      }
    };
    fetchSettings();

    const q = query(collection(db, 'products'), where('storeId', '==', storeId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Product[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() } as Product));
      setProducts(items);
      setIsLoading(false);
    });

    const savedGuestId = localStorage.getItem('guest_id') || ('guest_' + Math.random().toString(36).substring(2, 9));
    const savedOrders = JSON.parse(localStorage.getItem('my_orders') || '[]');

    setGuestId(savedGuestId);
    setMyOrderIds(savedOrders);

    if (!localStorage.getItem('guest_id')) {
      localStorage.setItem('guest_id', savedGuestId);
    }

    return () => unsubscribe();
  }, [storeId]);

  // Persist storeId to avoid losing it during auth redirects
  useEffect(() => {
    if (storeId) {
      localStorage.setItem('last_public_store_id', storeId);
    }
  }, [storeId]);

  useEffect(() => {
    if (storeSettings?.storeBanks && storeSettings.storeBanks.length > 0) {
      setSelectedStoreBankId(storeSettings.storeBanks[0].id);
    }
  }, [storeSettings?.storeBanks]);

  useEffect(() => {
    if (storeSettings?.storeEwallets && storeSettings.storeEwallets.length > 0) {
      setSelectedStoreEwalletId(storeSettings.storeEwallets[0].id);
    }
  }, [storeSettings?.storeEwallets]);

  // Persistent Cart Logic: Load
  useEffect(() => {
     if (typeof window !== 'undefined') {
        const savedCart = localStorage.getItem('public_cart_v1');
        if (savedCart) {
           try {
              setCart(JSON.parse(savedCart));
           } catch (e) {
              console.error("Gagal memuat keranjang", e);
           }
        }
        setIsInitialLoad(false);
     }
  }, []);

  // Persistent Cart Logic: Save
  useEffect(() => {
     if (isInitialLoad) return;
     if (typeof window !== 'undefined') {
        localStorage.setItem('public_cart_v1', JSON.stringify(cart));
     }
  }, [cart, isInitialLoad]);

  // Handle Resume Checkout from Redirect
  useEffect(() => {
     if (!isLoading && searchParams.get('open_checkout') === 'true') {
        setIsCheckoutOpen(true);
        // Clean URL to avoid repeated opens (fixing precedence)
        const newUrl = window.location.pathname + (storeId ? `?s=${storeId}` : '');
        window.history.replaceState({}, '', newUrl);
     }
  }, [isLoading, searchParams, storeId]);

  // Sync My Orders status
  useEffect(() => {
    if (!storeId) return;

    // We combine two sources:
    // 1. By ID (guest mode, historical orders from current device)
    // 2. By guestId (account mode, orders linked to logged-in UID)
    
    let unsubGuest: any = null;
    let unsubAccount: any = null;

    const handleSnapshot = (snapshot: any, source: string) => {
      const items = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      setMyOrdersData(prev => {
         // Merge and deduplicate by ID
         const combined = [...prev];
         items.forEach((newItem: any) => {
            const exists = combined.findIndex(ex => ex.id === newItem.id);
            if (exists !== -1) {
               combined[exists] = newItem; // Update if exists
            } else {
               combined.push(newItem); // Add new
            }
         });
         return combined.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      });
    };

    // 1. GUEST SYNC (By specific IDs in localStorage)
    if (myOrderIds.length > 0) {
      const qGuest = query(
        collection(db, 'transactions'), 
        where('storeId', '==', storeId),
        where('id', 'in', myOrderIds.slice(0, 10))
      );
      unsubGuest = onSnapshot(qGuest, (snap) => handleSnapshot(snap, 'guest'));
    }

    // 2. ACCOUNT SYNC (Only if user is logged in as customer)
    if (authUser) {
      const qAccount = query(
        collection(db, 'transactions'),
        where('storeId', '==', storeId),
        where('guestId', '==', authUser.uid)
      );
      unsubAccount = onSnapshot(qAccount, (snap) => handleSnapshot(snap, 'account'));
    }

    return () => {
      unsubGuest?.();
      unsubAccount?.();
    };
  }, [myOrderIds, authUser, storeId]);

  const categories = useMemo(() => {
    const cats = ['Semua', ...new Set(products.map(p => p.category || 'Umum'))];
    return cats;
  }, [products]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const prodCategory = p.category || 'Umum';
    const matchesCategory = selectedCategory === 'Semua' || prodCategory === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
        console.error("Gagal memuat ekstra", err);
      } finally {
        setIsLoadingExtras(false);
      }
      return;
    }

    const uniqueId = product.id!;
    setCart(prev => {
      const existing = prev.find(item => item.uniqueId === uniqueId);
      if (existing) {
        return prev.map(item => item.uniqueId === uniqueId ? { ...item, cartQty: item.cartQty + 1 } : item);
      }
      return [...prev, { 
        ...product, 
        uniqueId, 
        cartQty: 1, 
        selectedExtras: [], 
        displayPrice: product.price, 
        originalPrice: product.price,
        note: '' 
      }];
    });
    toast.success("Ditambahkan");
  };

  const confirmExtrasToCart = () => {
    if (!activeExtrasProduct) return;
    for (const group of availableExtraGroups) {
      if (group.isMandatory && (!tempSelections[group.id!] || tempSelections[group.id!].length === 0)) {
        toast.error("Wajib pilih " + group.name);
        return;
      }
    }
    const selectedExtras: SelectedExtra[] = [];
    let extrasTotal = 0;
    Object.entries(tempSelections).forEach(([groupId, options]) => {
      const group = availableExtraGroups.find(g => g.id === groupId);
      options.forEach(opt => {
        selectedExtras.push({ groupName: group?.name || '', optionName: opt.name, price: opt.price });
        extrasTotal += opt.price;
      });
    });
    const finalPrice = activeExtrasProduct.price + extrasTotal;
    const extrasKey = selectedExtras.map(e => e.groupName + ":" + e.optionName).sort().join("|");
    const uniqueId = activeExtrasProduct.id + "-" + extrasKey;

    setCart(prev => {
      const existing = prev.find(item => item.uniqueId === uniqueId);
      if (existing) {
        return prev.map(item => item.uniqueId === uniqueId ? { ...item, cartQty: item.cartQty + 1 } : item);
      }
      return [...prev, { 
        ...activeExtrasProduct, 
        uniqueId, 
        cartQty: 1, 
        selectedExtras, 
        displayPrice: finalPrice, 
        originalPrice: activeExtrasProduct.price + extrasTotal,
        note: '' 
      }];
    });
    setActiveExtrasProduct(null);
    toast.success("Ditambahkan");
  };

  const updateQty = (uniqueId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.uniqueId === uniqueId) {
        const n = item.cartQty + delta;
        return n > 0 ? { ...item, cartQty: n } : null;
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Berhasil keluar");
      const savedName = localStorage.getItem('customer_name') || '';
      const savedPhone = localStorage.getItem('customer_phone') || '';
      setCustomerName(savedName);
      setCustomerPhone(savedPhone);
    } catch (err) {
      toast.error("Gagal keluar");
    }
  };

  const handleSaveProfile = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error('Nama lengkap dan nomor WhatsApp wajib diisi');
      return;
    }

    if (authUser) {
      setIsUpdatingProfile(true);
      try {
        await updateProfile(authUser, { displayName: customerName });
        await updateDoc(doc(db, 'users', authUser.uid), {
          name: customerName,
          phone: customerPhone
        });
        toast.success("Profil berhasil diperbarui!");
      } catch (err: any) {
        console.error(err);
        toast.error("Gagal menyimpan profil: " + err.message);
      } finally {
        setIsUpdatingProfile(false);
      }
    } else {
      localStorage.setItem('customer_name', customerName);
      localStorage.setItem('customer_phone', customerPhone);
      toast.success("Profil tersimpan ke memori HP");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;
    if (pwdNew !== pwdConfirm) {
      toast.error("Konfirmasi sandi baru tidak cocok");
      return;
    }
    if (pwdNew.length < 6) {
      toast.error("Sandi baru minimal 6 karakter");
      return;
    }

    setIsChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(authUser.email, pwdOld);
      await reauthenticateWithCredential(authUser, credential);
      await updatePassword(authUser, pwdNew);
      toast.success("Kata sandi berhasil diubah!");
      setPwdOld('');
      setPwdNew('');
      setPwdConfirm('');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') {
        toast.error("Kata sandi lama salah");
      } else {
        toast.error("Gagal mengubah sandi: " + err.message);
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!authUser) return;
    setIsDeletingAccount(true);
    try {
      if (isPasswordProvider) {
        if (!pwdDelete) {
           toast.error("Ulangi kata sandi Anda untuk menghapus akun");
           setIsDeletingAccount(false);
           return;
        }
        const credential = EmailAuthProvider.credential(authUser.email, pwdDelete);
        await reauthenticateWithCredential(authUser, credential);
      }

      await deleteDoc(doc(db, 'users', authUser.uid));
      await deleteUser(authUser);
      
      toast.success("Akun Anda telah dihapus secara permanen");
      setAuthUser(null);
      setShowDeleteConfirm(false);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') {
        toast.error("Kata sandi salah");
      } else if (err.code === 'auth/requires-recent-login') {
        toast.error("Sesi terlalu lama. Harap keluar dan masuk kembali sebelum menghapus akun.");
      } else {
        toast.error("Gagal menghapus akun: " + err.message);
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const playSuccessSound = () => {
    const audio = new Audio('/sound/bayar.mp3');
    audio.play().catch(err => console.error("Gagal memutar suara:", err));
  };

  const openWhatsApp = (phone: string, name: string = '') => {
    if (!phone) {
      toast.error("Nomor WhatsApp toko tidak tersedia.");
      return;
    }
    let p = phone.replace(/\D/g, '');
    if (p.startsWith('0')) p = '62' + p.substring(1);
    
    const text = `Halo, saya ${name || 'Pelanggan'}. Saya ingin menanyakan pesanan saya.`;
    window.open(`https://wa.me/${p}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    // Check if logged in
    if (!authUser) {
       toast.error("Harap masuk atau daftar akun terlebih dahulu");
       router.push(`/tr/auth?s=${storeId}&redirect=checkout`);
       return;
    }

    if (!customerName.trim()) {
      toast.error("Harap lengkapi Nama Anda di tab Akun");
      setActiveTab('account');
      return;
    }

    if (fulfillmentType === 'delivery' && !deliveryAddress.trim()) {
      toast.error("Harap isi alamat pengiriman");
      return;
    }

    setIsProcessing(true);
    try {
      const sub = subtotalSum;
      const fee = (fulfillmentType === 'delivery' ? (storeSettings?.deliveryFee || 0) : 0);
      const taxRate = (storeSettings?.taxRate || 0);
      const taxAmount = storeSettings?.useTax ? Math.round((sub * taxRate) / 100) : 0;
      const finalTotal = sub + taxAmount + fee;

      const orderData: any = {
        storeId,
        customerName: customerName.trim() || 'Pelanggan Toko',
        customerPhone: customerPhone.trim() || '-',
        guestId: authUser?.uid || guestId,
        items: cart.map(item => ({
          productId: item.id,
          productName: item.name,
          price: item.displayPrice,
          qty: item.cartQty,
          subtotal: item.displayPrice * item.cartQty,
          selectedExtras: item.selectedExtras,
          note: item.note || ''
        })),
        subtotal: sub,
        tax: taxAmount,
        deliveryFee: fee,
        total: finalTotal,
        paymentMethod: paymentMethod,
        selectedPaymentDetails: paymentMethod === 'transfer' 
          ? (storeSettings?.storeBanks?.find((b: any) => b.id === selectedStoreBankId) || storeSettings?.storeBanks?.[0] || null)
          : paymentMethod === 'qris' 
            ? (storeSettings?.storeEwallets?.find((ew: any) => ew.id === selectedStoreEwalletId) || storeSettings?.storeEwallets?.[0] || null)
            : null,
        paymentProofUrl: (paymentMethod === 'transfer' || paymentMethod === 'qris') ? paymentProofUrl : '',
        orderStatus: 'new',
        paymentStatus: 'pending',
        deliveryType: fulfillmentType,
        deliveryAddress: fulfillmentType === 'delivery' ? deliveryAddress : '',
        orderType: 'online',
        cashierName: 'Online (Sistem)',
        cashierId: 'online',
        paidAmount: 0,
        debtAmount: finalTotal,
        timestamp: serverTimestamp(),
      };

      let finalId = '';
      
      await runTransaction(db, async (transaction) => {
        const settingsRef = doc(db, 'settings', `store_${storeId}`);
        const settingsSnap = await transaction.get(settingsRef);
        
        let currentCounter = 0;
        let prefix = 'TRX';
        let padding = 4;
        
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          currentCounter = Number(data.trxCounter) || 0;
          prefix = data.trxPrefix || 'TRX';
          padding = data.trxPadding || 4;
        }
        
        currentCounter += 1;
        finalId = `${prefix}${String(currentCounter).padStart(padding, '0')}`;
        
        orderData.id = finalId;
        orderData.queueNumber = currentCounter;

        transaction.set(doc(db, 'transactions', finalId), orderData);
        transaction.set(settingsRef, { trxCounter: currentCounter }, { merge: true });
      });
      
      const savedOrders = JSON.parse(localStorage.getItem('my_orders') || '[]');
      const newOrders = [finalId, ...savedOrders].slice(0, 50);
      setMyOrderIds(newOrders);
      localStorage.setItem('my_orders', JSON.stringify(newOrders));

      // Trigger FCM Push Notification
      fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: storeId,
          title: '🚨 PESANAN ONLINE BARU!',
          message: `Ada pesanan baru masuk senilai Rp ${finalTotal.toLocaleString('id-ID')}.`,
          data: { transactionId: finalId }
        })
      }).catch(e => console.error('Failed to trigger notification', e));

      setCart([]);
      setPaymentProofUrl('');
      setIsCheckoutOpen(false);
      setActiveTab('orders');
      playSuccessSound();
      toast.success("Pesanan berhasil dikirim!");
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengirim pesanan");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!storeId && !isLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-10 text-center">
        <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mb-6">
           <AlertCircle size={40} />
        </div>
        <h2 className="text-xl font-black text-white mb-2 uppercase tracking-tight">Link Tidak Valid</h2>
        <p className="text-sm text-slate-500 font-medium max-w-xs leading-relaxed">
           Maaf, link pemesanan tidak lengkap. Silakan minta link terbaru kepada pemilik toko.
        </p>
      </div>
    );
  }

  if (isLoading || (storeId && !storeSettings)) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-10">
        <Loader2 className="w-10 h-10 text-tr animate-spin mb-4" />
        <p className="text-tr font-black tracking-widest uppercase text-xs animate-pulse">{branding.appName} oleh YADIKOMPUTER...</p>
      </div>
    );
  }

  if (storeSettings && storeSettings.isOnlineStoreActive === false) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-10 text-center text-white">
        <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mb-6">
           <AlertTriangle size={40} />
        </div>
        <h2 className="text-xl font-black mb-2 uppercase tracking-tight">Toko Online Nonaktif</h2>
        <p className="text-sm text-slate-400 font-medium max-w-xs leading-relaxed font-sans">
           Maaf, toko online ini sedang dinonaktifkan oleh pemilik toko. Silakan hubungi toko secara langsung untuk pemesanan.
        </p>
      </div>
    );
  }

  const subtotalSum = cart.reduce((sum, item) => sum + ((item.displayPrice || 0) * (item.cartQty || 0)), 0);
  const totalCartItems = cart.reduce((sum, item) => sum + (item.cartQty || 0), 0);
  const deliveryFee = (fulfillmentType === 'delivery' && storeSettings?.allowDelivery !== false) ? (storeSettings?.deliveryFee || 0) : 0;
  const taxAmount = storeSettings?.useTax ? Math.round((subtotalSum * (storeSettings.taxRate || 0)) / 100) : 0;
  const totalWithFulfillment = subtotalSum + taxAmount + deliveryFee;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col max-w-md mx-auto shadow-2xl relative overflow-hidden font-sans">
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --tr-color: ${storeSettings?.themeColorHex || '#10b981'};
        }
      `}} />
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-tr/10 to-white/0 pointer-events-none"></div>

      <header className="p-6 sticky top-0 z-40 bg-white/80 backdrop-blur-xl flex items-center justify-between border-b border-slate-200/50">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-white p-1 shadow-xl shrink-0">
             <img src={storeSettings?.logoUrl || '/logo.png'} alt="" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-black tracking-tight text-slate-900 mb-0.5 truncate">{storeSettings?.storeName || 'Toko Kami'}</h1>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-tr uppercase tracking-widest">
               <div className="w-1.5 h-1.5 rounded-full bg-tr animate-pulse"></div>
               Online ordering open
            </div>
          </div>
        </div>
        <button className="p-2 text-slate-400 hover:text-white transition-colors">
           <HelpCircle size={20} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-40">
        {activeTab === 'menu' && (
          <div className="p-6 space-y-6">
            <div className="relative group">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
               <input 
                 type="text"
                 placeholder="Cari menu favorit..."
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:outline-none focus:border-tr transition-all font-sans shadow-sm"
               />
            </div>

            <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
               {categories.map(cat => (
                 <button 
                   key={cat}
                   onClick={() => setSelectedCategory(cat)}
                   className={"px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap " + (selectedCategory === cat ? 'bg-tr text-slate-950 shadow-md shadow-tr/20' : 'bg-white text-slate-600 border border-slate-200/60 hover:bg-slate-50')}
                 >
                   {cat}
                 </button>
               ))}
            </div>

            <div className="grid grid-cols-1 gap-5">
               {filteredProducts.map(p => (
                 <div key={p.id} className="bg-white border border-slate-100 rounded-3xl p-5 flex gap-5 hover:border-tr/30 transition-all group shadow-sm">
                    <div className="w-24 h-24 rounded-2xl bg-slate-50 overflow-hidden shrink-0 border border-slate-100">
                       {p.imageUrl ? (
                          <img src={p.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                       ) : (
                          <div className="w-full h-full flex items-center justify-center opacity-10">
                             <ShoppingBag size={32} />
                          </div>
                       )}
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                       <div className="min-w-0">
                          <h3 className="font-black text-slate-900 text-base leading-tight truncate">{p.name}</h3>
                          <p className="text-[10px] font-black text-tr uppercase tracking-widest mt-1.5 opacity-60">{p.category || 'Umum'}</p>
                       </div>
                       <div className="flex items-center justify-between mt-4">
                          <p className="font-black text-base text-slate-900 tracking-tighter">Rp {(p.price || 0).toLocaleString('id-ID')}</p>
                          <button 
                            onClick={() => addToCart(p)}
                            className="px-4 py-2 bg-tr hover:brightness-105 text-slate-950 rounded-2xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all shadow-tr/20 text-[10px] font-black uppercase tracking-widest"
                          >
                             <Plus size={14} className="stroke-[3]" />
                             <span>Tambah</span>
                          </button>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="p-6 space-y-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3 italic">
               <div className="p-2 bg-tr/10 text-tr rounded-xl border border-tr/20">
                  <History size={24} />
               </div>
               Riwayat Pesanan
            </h2>
            <div className="space-y-4">
               {myOrdersData.length === 0 ? (
                 <div className="py-20 text-center flex flex-col items-center gap-4 opacity-10">
                    <ShoppingBag size={64} />
                    <p className="font-bold uppercase tracking-widest text-[10px]">Belum ada pesanan</p>
                 </div>
               ) : (
                 myOrdersData.map(order => (
                   <div key={order.id} className="bg-white border border-slate-100 rounded-3xl p-5 space-y-4 shadow-sm">
                      <div className="flex justify-between items-start">
                         <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                               {order.timestamp?.toDate ? order.timestamp.toDate().toLocaleDateString('id-ID', {day:'numeric', month:'short'}) : 'Baru saja'}
                            </p>
                            <p className="font-black text-slate-900 uppercase text-xs"># {order.id?.substring(0,8)}</p>
                         </div>
                         <div className={"px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border " + (
                           order.orderStatus === 'completed' ? 'bg-tr/10 text-tr border-tr/20' :
                           order.orderStatus === 'ready' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                           order.orderStatus === 'cancelled' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                           'bg-amber-500/10 text-amber-500 border-amber-500/20'
                         )}>
                             {order.orderStatus === 'new' ? 'Baru' :
                              order.orderStatus === 'processing' ? 'Diproses' :
                              order.orderStatus === 'ready' ? 
                                (order.deliveryType === 'delivery' 
                                  ? (order.paymentStatus === 'paid' || (order.debtAmount || 0) <= 0 ? 'Terkirim & Lunas' : 'Siap Dikirim') 
                                  : (order.paymentStatus === 'paid' || (order.debtAmount || 0) <= 0 ? 'Sudah Diambil & Lunas' : 'Siap Diambil')) :
                              order.orderStatus === 'completed' ? 
                                (order.deliveryType === 'delivery' 
                                  ? 'Terkirim & Lunas' 
                                  : 'Sudah Diambil & Lunas') : 'Dibatalkan'}
                          </div>
                        </div>
                        
                        {(order.paymentMethod === 'transfer' || order.paymentMethod === 'qris') && (
                          <div className="border-t border-slate-100 pt-3 space-y-2.5">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bukti Pembayaran ({order.paymentMethod.toUpperCase()})</p>
                             {order.paymentProofUrl ? (
                               <div className="flex items-center justify-between bg-slate-50 p-2 rounded-2xl border border-slate-100">
                                 <a href={order.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-85 transition-opacity">
                                   <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0">
                                     <img src={order.paymentProofUrl} alt="Bukti" className="w-full h-full object-cover" />
                                   </div>
                                   <div className="min-w-0">
                                     <p className="text-[11px] font-bold text-slate-800 truncate">Bukti Pembayaran</p>
                                     <p className="text-[8px] text-emerald-500 font-bold uppercase tracking-wider flex items-center gap-0.5">
                                       <CheckCircle2 size={8} className="text-emerald-500" /> Sudah Diunggah
                                     </p>
                                   </div>
                                 </a>
                                 {order.paymentStatus !== 'paid' && (
                                   <label className="p-2 text-[9px] font-black uppercase text-tr bg-tr/10 hover:bg-tr/20 rounded-xl transition-all cursor-pointer">
                                     Ubah
                                     <input 
                                       type="file" 
                                       accept="image/*" 
                                       className="hidden" 
                                       onChange={async (e) => {
                                         if (!e.target.files || !e.target.files[0]) return;
                                         const file = e.target.files[0];
                                         if (!file.type.startsWith('image/')) {
                                           toast.error('File harus berupa gambar');
                                           return;
                                         }
                                         const toastId = toast.loading('Memperbarui bukti...');
                                         try {
                                           const refPath = `payment_proofs/store_${storeId}/post_${order.id}_${Date.now()}`;
                                           const storageRef = ref(storage, refPath);
                                           await uploadBytes(storageRef, file);
                                           const url = await getDownloadURL(storageRef);
                                           
                                           await updateDoc(doc(db, 'transactions', order.id), {
                                             paymentProofUrl: url
                                           });
                                           toast.success('Bukti bayar berhasil diperbarui!', { id: toastId });
                                         } catch (err: any) {
                                           console.error(err);
                                           toast.error('Gagal memperbarui bukti: ' + err.message, { id: toastId });
                                         }
                                       }}
                                     />
                                   </label>
                                 )}
                               </div>
                             ) : (
                               <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-200 hover:border-tr/30 rounded-2xl cursor-pointer transition-all active:scale-[0.99] group bg-slate-50/50">
                                 <Upload className="text-slate-400 group-hover:text-tr transition-colors" size={14} />
                                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Unggah Bukti Pembayaran</span>
                                 <input
                                   type="file"
                                   accept="image/*"
                                   className="hidden"
                                   onChange={async (e) => {
                                     if (!e.target.files || !e.target.files[0]) return;
                                     const file = e.target.files[0];
                                     if (!file.type.startsWith('image/')) {
                                       toast.error('File harus berupa gambar');
                                       return;
                                     }
                                     const toastId = toast.loading('Mengunggah bukti...');
                                     try {
                                       const refPath = `payment_proofs/store_${storeId}/post_${order.id}_${Date.now()}`;
                                       const storageRef = ref(storage, refPath);
                                       await uploadBytes(storageRef, file);
                                       const url = await getDownloadURL(storageRef);
                                       
                                       await updateDoc(doc(db, 'transactions', order.id), {
                                         paymentProofUrl: url
                                       });
                                       toast.success('Bukti bayar berhasil diunggah!', { id: toastId });
                                     } catch (err: any) {
                                       console.error(err);
                                       toast.error('Gagal mengunggah bukti: ' + err.message, { id: toastId });
                                     }
                                   }}
                                 />
                               </label>
                             )}
                          </div>
                        )}
                        
                        <div className="flex gap-2">
                           <button 
                             onClick={() => setViewingReceipt(order)}
                             className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-100 hover:bg-slate-100 transition-all active:scale-95"
                           >
                              <ClipboardList size={14} /> Lihat Struk
                           </button>
                           <button 
                             onClick={() => openWhatsApp(storeSettings?.phone, customerName)}
                             className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 text-[#25D366] rounded-2xl font-black text-[10px] uppercase tracking-widest border border-emerald-100 hover:bg-emerald-100 transition-all active:scale-95"
                           >
                              <MessageCircle size={14} /> Chat Toko
                           </button>
                        </div>
                   </div>
                 ))
               )}
            </div>
          </div>
        )}

        {activeTab === 'account' && (
          <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-4">
               <div className="w-20 h-20 bg-tr/10 text-tr rounded-3xl flex items-center justify-center mx-auto border border-tr/20 shadow-2xl shadow-tr/10">
                  <UserIcon size={40} className="stroke-[2.5]" />
               </div>
               <div>
                  <h2 className="text-2xl font-black text-slate-900 italic tracking-tight uppercase truncate max-w-[280px] mx-auto">
                    {authUser ? (customerName || 'PROFIL SAYA') : 'HALO '}
                    {!authUser && <span className="text-tr">PELANGGAN!</span>}
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">
                    {authUser ? authUser.email : 'Lengkapi data Anda agar kami mudah melayani'}
                  </p>
               </div>
            </div>

            {!authUser && (
              <div className="p-6 bg-tr/5 border border-tr/20 rounded-3xl space-y-4 shadow-xl shadow-tr/5">
                 <div className="space-y-1">
                    <h4 className="text-xs font-black text-tr uppercase tracking-widest">Punya Akun?</h4>
                    <p className="text-[10px] text-slate-500 font-bold tracking-wide leading-relaxed">Masuk untuk memantau riwayat pesanan & promo menarik di semua perangkat.</p>
                 </div>
                 <Link 
                   href={`/tr/auth?s=${storeId}`}
                   className="w-full py-4 bg-tr text-slate-950 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-tr/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
                 >
                    MASUK SEKARANG <ChevronRight size={16} />
                 </Link>
              </div>
            )}

            <div className="space-y-5">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="Masukkan nama Anda..."
                      className="w-full bg-white border border-slate-200 rounded-2xl p-4 pl-12 text-sm font-bold focus:outline-none focus:border-tr transition-all"
                    />
                  </div>
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nomor WhatsApp</label>
                  <div className="relative">
                    <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="tel" 
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      placeholder="08xxxxxxxxxx"
                      className="w-full bg-white border border-slate-200 rounded-2xl p-4 pl-12 text-sm font-bold focus:outline-none focus:border-tr transition-all"
                    />
                  </div>
               </div>
               
               {authUser ? (
                 <div className="flex flex-col gap-3">
                   <button 
                     onClick={handleSaveProfile}
                     disabled={isUpdatingProfile}
                     className="w-full py-4 bg-tr text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-tr/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                   >
                     {isUpdatingProfile ? <Loader2 className="animate-spin" size={16} /> : 'SIMPAN PROFIL'}
                   </button>
                   <button 
                     onClick={handleLogout}
                     className="w-full py-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-rose-500 hover:text-white transition-all active:scale-95 shadow-lg shadow-rose-500/5"
                   >
                     KELUAR AKUN
                   </button>
                 </div>
               ) : (
                 <button 
                   onClick={handleSaveProfile}
                   className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-slate-900/10 active:scale-95 transition-all"
                 >
                   SIMPAN PROFIL GUEST
                 </button>
               )}
            </div>

            {authUser && (
              <>
                {isPasswordProvider && (
                  <form onSubmit={handleChangePassword} className="space-y-4 pt-8 border-t border-slate-200">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center mb-4">Pengaturan Sandi Baru</p>
                     
                     <div className="space-y-2">
                        <div className="relative">
                           <Plus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-45" size={18} />
                           <input 
                             type="password" 
                             value={pwdOld}
                             onChange={e => setPwdOld(e.target.value)}
                             required
                             placeholder="Kata Sandi Lama"
                             className="w-full bg-white border border-slate-200 rounded-2xl p-4 pl-12 text-sm font-bold focus:outline-none focus:border-tr transition-all"
                           />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <div className="relative">
                           <Plus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                           <input 
                             type="password" 
                             value={pwdNew}
                             onChange={e => setPwdNew(e.target.value)}
                             required
                             placeholder="Sandi Baru (Min 6 Karakter)"
                             className="w-full bg-white border border-slate-200 rounded-2xl p-4 pl-12 text-sm font-bold focus:outline-none focus:border-tr transition-all"
                           />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <div className="relative">
                           <Plus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                           <input 
                             type="password" 
                             value={pwdConfirm}
                             onChange={e => setPwdConfirm(e.target.value)}
                             required
                             placeholder="Konfirmasi Sandi Baru"
                             className="w-full bg-white border border-slate-200 rounded-2xl p-4 pl-12 text-sm font-bold focus:outline-none focus:border-tr transition-all"
                           />
                        </div>
                     </div>
                     <button 
                       type="submit"
                       disabled={isChangingPassword}
                       className="w-full py-4 bg-slate-900 text-white border border-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
                     >
                       {isChangingPassword ? <Loader2 className="animate-spin" size={16} /> : 'UBAH KATA SANDI'}
                     </button>
                  </form>
                )}

                <div className="pt-8 border-t border-slate-200 space-y-4">
                  <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] text-center">Zona Bahaya</p>
                  
                  {!showDeleteConfirm ? (
                    <button 
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full py-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-rose-500 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} /> HAPUS AKUN SAYA
                    </button>
                  ) : (
                    <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-3xl space-y-4">
                      <p className="text-xs font-bold text-rose-400 text-center uppercase tracking-wider">Anda yakin ingin menghapusnya?</p>
                      {isPasswordProvider && (
                        <div className="relative">
                           <input 
                             type="password" 
                             value={pwdDelete}
                             onChange={e => setPwdDelete(e.target.value)}
                             placeholder="Masukkan sandi Anda"
                             className="w-full bg-white border border-rose-500/20 rounded-xl p-3 text-sm font-bold focus:outline-none focus:border-rose-500 text-rose-900"
                           />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex-1 py-3 bg-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-[0.1em]"
                        >
                          Batal
                        </button>
                        <button 
                          onClick={handleDeleteAccount}
                          disabled={isDeletingAccount}
                          className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.1em] flex items-center justify-center"
                        >
                          {isDeletingAccount ? <Loader2 className="animate-spin" size={16} /> : 'YA, HAPUS'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="pt-8 border-t border-slate-200 space-y-4">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Informasi Toko</p>
               <div className="bg-white p-5 rounded-3xl space-y-3 shadow-md border border-slate-100">
                  <div className="flex items-start gap-4">
                     <div className="p-2 bg-slate-50 rounded-lg text-slate-400"><MapPin size={18} /></div>
                     <p className="text-xs font-bold leading-relaxed text-slate-600">{storeSettings?.address || 'Alamat belum diatur'}</p>
                  </div>
                  <button 
                    onClick={() => openWhatsApp(storeSettings?.phone, customerName)}
                    className="w-full flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-[2rem] group active:scale-[0.98] transition-all shadow-sm hover:shadow-md hover:border-emerald-200"
                  >
                     <div className="p-2.5 bg-[#25D366] text-white rounded-xl shadow-[0_5px_15px_-3px_rgba(37,211,102,0.4)] group-hover:rotate-12 transition-transform flex items-center justify-center shrink-0">
                        <MessageCircle size={22} fill="white" strokeWidth={2.5} />
                     </div>
                     <div className="text-left flex-1">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Hubungi via WhatsApp</p>
                        <p className="text-sm font-bold text-slate-900">{storeSettings?.phone || 'WhatsApp belum diatur'}</p>
                     </div>
                     <ChevronRight className="text-slate-300 group-hover:text-emerald-400 transition-colors" size={20} />
                  </button>
               </div>
               <p className="text-[9px] text-slate-400 text-center font-bold uppercase tracking-widest">{branding.appName} oleh YADIKOMPUTER</p>
            </div>
          </div>
        )}
      </main>

      {/* MODAL STRUK DIGITAL */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                 <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 italic">
                    <div className="p-2 bg-tr/10 text-tr rounded-xl">
                       <ShoppingCart size={18} />
                    </div>
                    Struk Digital
                 </h2>
                 <button onClick={() => setViewingReceipt(null)} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-xl transition-colors"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 font-mono text-[10px] space-y-6">
                 {/* Header Toko */}
                 <div className="text-center space-y-2">
                    {storeSettings?.logoUrl && storeSettings?.showLogoOnReceipt && (
                      <img src={storeSettings.logoUrl} alt="" className="w-12 h-12 mx-auto object-contain grayscale opacity-50 mb-2" />
                    )}
                    <h3 
                       style={{ fontFamily: getFontFamily(storeSettings?.storeNameFont) }}
                       className="text-sm font-black uppercase text-slate-900"
                    >
                      {storeSettings?.storeName || 'Toko Kami'}
                    </h3>
                    <p className="text-slate-500 whitespace-pre-line">{storeSettings?.address}</p>
                    <p className="text-slate-500">Telp: {storeSettings?.phone}</p>
                    <div className="border-b border-dashed border-slate-300 pt-2"></div>
                 </div>

                 {/* Detail Transaksi */}
                 <div className="space-y-1 text-slate-600">
                    <div className="flex justify-between"><span>Nomor TRX</span><span className="font-bold text-slate-900">#{(viewingReceipt.id || "").toUpperCase()}</span></div>
                    <div className="flex justify-between"><span>Tanggal</span><span className="font-bold text-slate-900">{viewingReceipt.timestamp?.toDate ? viewingReceipt.timestamp.toDate().toLocaleString('id-ID').replace(/\./g, ':') : 'Baru saja'}</span></div>
                    <div className="flex justify-between"><span>Pelanggan</span><span className="font-bold text-slate-900">{viewingReceipt.customerName}</span></div>
                    <div className="flex justify-between"><span>Metode</span><span className="font-bold text-slate-900">{viewingReceipt.deliveryType === 'delivery' ? 'KIRIM' : 'AMBIL'}</span></div>
                    <div className="border-b border-dashed border-slate-300 pt-2"></div>
                 </div>

                 {/* List Item */}
                 <div className="space-y-4">
                    {viewingReceipt.items?.map((item: any, i: number) => (
                      <div key={i} className="space-y-1">
                         <div className="flex justify-between text-slate-900 font-bold uppercase">
                            <span className="flex-1 mr-4">{item.productName}</span>
                            <span>Rp {(item.subtotal || (item.price * item.qty) || 0).toLocaleString('id-ID')}</span>
                         </div>
                         <div className="flex justify-between text-slate-500">
                            <span>{item.qty} x {(item.price || 0).toLocaleString('id-ID')}</span>
                            {item.note && <span className="text-[9px] italic">({item.note})</span>}
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
                    <div className="flex justify-between text-slate-600"><span>SUBTOTAL</span><span className="font-bold text-slate-900">Rp {(viewingReceipt.subtotal || 0).toLocaleString('id-ID')}</span></div>
                    {viewingReceipt.tax > 0 && (
                      <div className="flex justify-between text-slate-600"><span>PAJAK (PPN)</span><span className="font-bold text-slate-900">Rp {(viewingReceipt.tax || 0).toLocaleString('id-ID')}</span></div>
                    )}
                    {(viewingReceipt.deliveryFee || 0) > 0 && (
                      <div className="flex justify-between text-slate-600"><span>ONGKOS KIRIM</span><span className="font-bold text-slate-900">Rp {(viewingReceipt.deliveryFee || 0).toLocaleString('id-ID')}</span></div>
                    )}
                    <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                       <span>TOTAL</span>
                       <span className="text-tr">Rp {(viewingReceipt.total || 0).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                       <span>{viewingReceipt.cashReceived ? 'UANG DITERIMA' : 'DIBAYAR'}</span>
                       <span className="font-bold text-slate-900">Rp {(viewingReceipt.cashReceived || viewingReceipt.paidAmount || 0).toLocaleString('id-ID')}</span>
                    </div>
                    {viewingReceipt.change > 0 && (
                      <div className="flex justify-between text-emerald-500 font-bold"><span>KEMBALIAN</span><span className="font-black">Rp {(viewingReceipt.change || 0).toLocaleString('id-ID')}</span></div>
                    )}
                    <div className="flex justify-between text-rose-500 font-bold"><span>SISA HUTANG</span><span className="font-black">Rp {(viewingReceipt.debtAmount || 0).toLocaleString('id-ID')}</span></div>
                 </div>

                 {storeSettings?.showSignature && storeSettings?.signatureUrl && (
                    <div className="text-center py-2 border-t border-dashed border-slate-200 mt-2 flex flex-col items-center">
                       <img 
                          src={storeSettings.signatureUrl} 
                          alt="Signature" 
                          className="w-16 h-8 object-contain mix-blend-multiply opacity-50 mx-auto" 
                       />
                       <span className="text-[6px] opacity-40 mt-0.5">Tanda Tangan Toko</span>
                    </div>
                 )}

                 {/* Footer */}
                 <div className="text-center space-y-2 pt-4 opacity-50">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-900">Terima Kasih</p>
                    <p className="text-[8px] italic whitespace-pre-line leading-relaxed">{storeSettings?.receiptMessage || 'Selamat menikmati pesanan Anda!'}</p>
                 </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
                 <button 
                   onClick={() => window.print()} 
                   className="w-full py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-slate-900/10 active:scale-95 transition-all flex items-center justify-center gap-2"
                 >
                    CETAK / PDF
                 </button>
                 <button 
                   onClick={() => setViewingReceipt(null)}
                   className="w-full py-3 text-slate-500 font-black text-[10px] uppercase tracking-[0.2em]"
                 >
                    TUTUP
                 </button>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'menu' && totalCartItems > 0 && (
         <div className="fixed bottom-28 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-40">
            <button 
              onClick={() => setIsCheckoutOpen(true)}
              className="w-full bg-tr text-slate-900 h-16 rounded-2xl flex items-center justify-between px-6 shadow-2xl active:scale-95 transition-all shadow-tr/30 animate-bounce-short"
            >
               <div className="flex items-center gap-3">
                  <div className="relative">
                     <ShoppingCart size={24} className="stroke-[2.5]" />
                     <span className="absolute -top-2 -right-2 bg-white text-tr text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-tr shadow-md">
                        {totalCartItems}
                     </span>
                  </div>
                  <span className="font-black text-xs uppercase tracking-tight">Cek Keranjang</span>
               </div>
               <div className="text-right">
                  <p className="text-[8px] font-black opacity-60 uppercase tracking-widest leading-none mb-0.5">Total</p>
                  <p className="text-base font-black leading-none tracking-tighter">Rp {(subtotalSum || 0).toLocaleString('id-ID')}</p>
               </div>
            </button>
         </div>
      )}

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md h-20 bg-white/95 backdrop-blur-2xl border-t border-slate-200 z-50 flex items-center justify-around px-4 pb-2 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
         <button onClick={() => setActiveTab('menu')} className={"flex flex-col items-center gap-1 transition-all " + (activeTab === 'menu' ? 'text-tr' : 'text-slate-400')}>
            <div className={"p-2 rounded-xl transition-all " + (activeTab === 'menu' ? 'bg-tr/10 scale-110 shadow-lg shadow-tr/5' : '')}>
               <ShoppingCart size={22} className={activeTab === 'menu' ? "stroke-[2.5]" : ""} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.1em]">Produk</span>
         </button>
         <button onClick={() => setActiveTab('orders')} className={"flex flex-col items-center gap-1 transition-all " + (activeTab === 'orders' ? 'text-tr' : 'text-slate-400')}>
            <div className={"p-2 rounded-xl transition-all " + (activeTab === 'orders' ? 'bg-tr/10 scale-110 shadow-lg shadow-tr/5' : '')}>
               <ClipboardList size={22} className={activeTab === 'orders' ? "stroke-[2.5]" : ""} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.1em]">Riwayat</span>
         </button>
         <button onClick={() => setActiveTab('account')} className={"flex flex-col items-center gap-1 transition-all " + (activeTab === 'account' ? 'text-tr' : 'text-slate-400')}>
            <div className={"p-2 rounded-xl transition-all " + (activeTab === 'account' ? 'bg-tr/10 scale-110 shadow-lg shadow-tr/5' : '')}>
               <UserIcon size={22} className={activeTab === 'account' ? "stroke-[2.5]" : ""} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.1em]">Akun Saya</span>
         </button>
      </nav>

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleManualClose}></div>
           <div className="bg-white border-t border-slate-200 rounded-t-[3rem] w-full max-w-md h-[85vh] flex flex-col items-center p-0 relative z-10 overflow-hidden shadow-[0_-20px_50px_rgba(0,0,0,0.1)]">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mt-4 mb-2"></div>
              
              <div className="w-full p-6 border-b border-slate-100 flex items-center justify-between">
                 <h2 className="text-xl font-black text-slate-900 flex items-center gap-3 italic tracking-tight">
                    {isConfirmingCheckout ? (
                      <><CheckCircle2 className="text-tr" /> Konfirmasi <span className="text-tr underline decoration-tr/30">Pesanan</span></>
                    ) : (
                      <><ShoppingCart className="text-tr" /> Keranjang <span className="text-tr underline decoration-tr/30">Belanja</span></>
                    )}
                 </h2>
                 <button onClick={handleManualClose} className="bg-slate-100 p-2 rounded-xl text-slate-400 hover:text-slate-600 transition-all"><X size={20} /></button>
              </div>

              <div className="flex-1 w-full overflow-y-auto p-6 space-y-4 font-sans">
                 {!isConfirmingCheckout ? (
                   <>
                     {cart.length === 0 ? (
                       <div className="py-20 text-center opacity-10 flex flex-col items-center gap-4 text-slate-900">
                          <ShoppingCart size={64} />
                          <p className="text-[10px] font-black uppercase tracking-[0.2em]">Keranjang Kosong</p>
                       </div>
                     ) : (
                       cart.map(item => (
                         <div key={item.uniqueId} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="flex-1 min-w-0 pr-4">
                               <p className="font-bold text-sm truncate text-slate-900">{item.name}</p>
                               <p className="text-[10px] text-tr font-black">Rp {(item.displayPrice || 0).toLocaleString('id-ID')}</p>
                               {(item.selectedExtras?.length || 0) > 0 && (
                                 <p className="text-[8px] text-slate-500 mt-1 uppercase font-black tracking-widest leading-none">+ {item.selectedExtras?.map((e:any) => e.optionName).join(', ')}</p>
                               )}
                            </div>
                            <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
                               <button onClick={() => updateQty(item.uniqueId, -1)} className="w-9 h-9 rounded-xl hover:bg-rose-50 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all active:scale-95"><Minus size={14} /></button>
                               <span className="text-xs font-black w-5 text-center text-slate-700">{item.cartQty}</span>
                               <button onClick={() => updateQty(item.uniqueId, 1)} className="w-9 h-9 rounded-xl hover:bg-emerald-50 flex items-center justify-center text-tr hover:text-slate-900 transition-all active:scale-95"><Plus size={14} className="stroke-[3]" /></button>
                            </div>
                         </div>
                       ))
                     )}
                   </>
                 ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                       {/* Fulfillment Selection */}
                       <div className="space-y-4">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Metode Pengambilan</p>
                           <div className={`grid gap-4 ${storeSettings?.allowPickup !== false && storeSettings?.allowDelivery !== false ? 'grid-cols-2' : 'grid-cols-1'}`}>
                              {storeSettings?.allowPickup !== false && (
                                <button 
                                  onClick={() => setFulfillmentType('pickup')}
                                  className={`p-5 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 active:scale-[0.98] ${fulfillmentType === 'pickup' ? 'border-tr bg-tr/10 text-slate-950 shadow-md shadow-tr/10 font-black' : 'border-slate-100 bg-white text-slate-400'}`}
                                >
                                   <Store size={24} className={fulfillmentType === 'pickup' ? 'animate-bounce' : ''} />
                                   <span className="text-[10px] font-black uppercase tracking-wider">Ambil di Tempat</span>
                                </button>
                              )}
                              {storeSettings?.allowDelivery !== false && (
                                <button 
                                  onClick={() => setFulfillmentType('delivery')}
                                  className={`p-5 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 active:scale-[0.98] ${fulfillmentType === 'delivery' ? 'border-tr bg-tr/10 text-slate-950 shadow-md shadow-tr/10 font-black' : 'border-slate-100 bg-white text-slate-400'}`}
                                >
                                   <Truck size={24} className={fulfillmentType === 'delivery' ? 'animate-bounce' : ''} />
                                   <span className="text-[10px] font-black uppercase tracking-wider">Dikirim</span>
                                </button>
                              )}
                           </div>
                           {storeSettings?.allowPickup === false && storeSettings?.allowDelivery === false && (
                             <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-500">
                               <AlertTriangle size={18} />
                               <p className="text-[10px] font-black uppercase">Metode pemesanan sedang dinonaktifkan sementara.</p>
                             </div>
                           )}
                        </div>

                       {/* Address Input */}
                       {fulfillmentType === 'delivery' && (
                         <div className="space-y-2 animate-in fade-in zoom-in-95 duration-300">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alamat Pengiriman</label>
                            <div className="relative">
                               <MapPin className="absolute left-4 top-4 text-slate-400" size={18} />
                               <textarea 
                                 value={deliveryAddress}
                                 onChange={e => setDeliveryAddress(e.target.value)}
                                 placeholder="Masukkan alamat lengkap..."
                                 className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 pl-12 text-sm font-bold focus:outline-none focus:border-tr transition-all min-h-[100px] text-slate-900"
                               />
                            </div>
                         </div>
                       )}

                        {/* Method Selection */}
                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300 pt-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Metode Pembayaran</label>
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <button 
                                onClick={() => setPaymentMethod('cash')}
                                className={`p-5 rounded-3xl border transition-all flex items-center justify-start gap-4 active:scale-[0.98] ${paymentMethod === 'cash' ? 'border-tr bg-tr text-white shadow-lg shadow-tr/20 font-black' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
                              >
                                 <Banknote size={24} className={paymentMethod === 'cash' ? 'text-white' : 'text-slate-400'} />
                                 <div className="text-left">
                                    <div className="text-[10px] font-black uppercase tracking-widest">Tunai / COD</div>
                                    <div className="text-[9px] opacity-70">Bayar langsung</div>
                                 </div>
                              </button>
                              <button 
                                onClick={() => setPaymentMethod('transfer')}
                                className={`p-5 rounded-3xl border transition-all flex items-center justify-start gap-4 active:scale-[0.98] ${paymentMethod === 'transfer' ? 'border-tr bg-tr text-white shadow-lg shadow-tr/20 font-black' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
                              >
                                 <CreditCard size={24} className={paymentMethod === 'transfer' ? 'text-white' : 'text-slate-400'} />
                                 <div className="text-left">
                                    <div className="text-[10px] font-black uppercase tracking-widest">Transfer Bank</div>
                                    <div className="text-[9px] opacity-70">ATM / M-Banking</div>
                                 </div>
                              </button>
                              <button 
                                onClick={() => setPaymentMethod('qris')}
                                className={`p-5 rounded-3xl border transition-all flex items-center justify-start gap-4 active:scale-[0.98] ${paymentMethod === 'qris' ? 'border-tr bg-tr text-white shadow-lg shadow-tr/20 font-black' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
                              >
                                 <QrCode size={24} className={paymentMethod === 'qris' ? 'text-white' : 'text-slate-400'} />
                                 <div className="text-left">
                                    <div className="text-[10px] font-black uppercase tracking-widest">QRIS E-Wallet</div>
                                    <div className="text-[9px] opacity-70">Gopay / Ovo / Dana</div>
                                 </div>
                              </button>
                           </div>
                          {paymentMethod !== 'cash' && (
                              <div className="p-4 bg-tr/5 border border-tr/20 rounded-2xl flex flex-col gap-3 text-tr">
                                <div className="flex items-center gap-3">
                                  <AlertTriangle size={18} className="shrink-0" />
                                  <p className="text-[10px] font-black uppercase leading-relaxed">Instruksi pembayaran {paymentMethod === 'transfer' ? 'Transfer Bank' : 'QRIS E-Wallet'} akan diinformasikan oleh staf kami melalui WhatsApp untuk konfirmasi pesanan.</p>
                                </div>
                                {paymentMethod === 'qris' && (
                                   storeSettings?.storeEwallets && storeSettings.storeEwallets.length > 0 ? (
                                     <div className="mt-2 flex flex-col bg-white rounded-xl p-4 border border-tr/10 shadow-inner w-full text-left space-y-3">
                                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pilih E-Wallet Pembayaran</label>
                                       <select
                                         value={selectedStoreEwalletId}
                                         onChange={(e) => setSelectedStoreEwalletId(e.target.value)}
                                         className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-tr"
                                       >
                                         {storeSettings.storeEwallets.map((ew: any) => (
                                           <option key={ew.id} value={ew.id}>
                                             {ew.ewalletName}
                                           </option>
                                         ))}
                                       </select>
                                       {(() => {
                                         const activeEwallet = storeSettings.storeEwallets.find((ew: any) => ew.id === selectedStoreEwalletId) || storeSettings.storeEwallets[0];
                                         if (!activeEwallet) return null;
                                         return (
                                           <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 w-full text-xs">
                                             <div className="flex justify-between items-center">
                                               <span className="text-[8px] font-black text-slate-400 uppercase">E-Wallet:</span>
                                               <span className="font-black text-slate-900">{activeEwallet.ewalletName}</span>
                                             </div>
                                             <div className="flex justify-between items-center">
                                               <span className="text-[8px] font-black text-slate-400 uppercase">Nomor HP:</span>
                                               <div className="flex items-center gap-1.5">
                                                 <span className="font-black text-tr font-mono">{activeEwallet.phoneNumber}</span>
                                                 <button
                                                   type="button"
                                                   onClick={() => {
                                                     navigator.clipboard.writeText(activeEwallet.phoneNumber);
                                                     toast.success('Nomor e-wallet disalin!');
                                                   }}
                                                   className="px-2 py-0.5 text-[8px] font-black uppercase text-tr bg-tr/10 hover:bg-tr/20 rounded transition-colors"
                                                 >
                                                   Salin
                                                 </button>
                                               </div>
                                             </div>
                                             <div className="flex justify-between items-center border-t border-slate-100 pt-1.5">
                                               <span className="text-[8px] font-black text-slate-400 uppercase">Atas Nama:</span>
                                               <span className="font-black text-slate-900">{activeEwallet.accountHolder}</span>
                                             </div>
                                           </div>
                                         );
                                       })()}
                                       <p className="text-[8px] text-slate-400 font-bold text-center mt-1">Harap simpan bukti transfer/scan dan kirimkan ke staf kami via WhatsApp.</p>
                                     </div>
                                   ) : storeSettings?.qrisUrl ? (
                                     <div className="mt-2 flex flex-col items-center bg-white rounded-xl p-3 border border-tr/10 shadow-inner">
                                       <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-800 mb-2">Scan QRIS Ini untuk Membayar</h4>
                                       <img src={storeSettings.qrisUrl} alt="QRIS Pembayaran" className="w-40 h-40 object-contain rounded-lg border border-slate-100" />
                                       <p className="text-[8px] text-slate-400 font-bold mt-2 text-center">Harap simpan bukti transfer/scan dan kirimkan ke staf kami via WhatsApp.</p>
                                     </div>
                                   ) : null
                                 )}
                                 {paymentMethod === 'transfer' && (
                                   storeSettings?.storeBanks && storeSettings.storeBanks.length > 0 ? (
                                     <div className="mt-2 flex flex-col bg-white rounded-xl p-4 border border-tr/10 shadow-inner w-full text-left space-y-3">
                                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pilih Rekening Bank</label>
                                       <select
                                         value={selectedStoreBankId}
                                         onChange={(e) => setSelectedStoreBankId(e.target.value)}
                                         className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-tr"
                                       >
                                         {storeSettings.storeBanks.map((bank: any) => (
                                           <option key={bank.id} value={bank.id}>
                                             {bank.bankName}
                                           </option>
                                         ))}
                                       </select>
                                       {(() => {
                                         const activeBank = storeSettings.storeBanks.find((b: any) => b.id === selectedStoreBankId) || storeSettings.storeBanks[0];
                                         if (!activeBank) return null;
                                         return (
                                           <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 w-full text-xs">
                                             <div className="flex justify-between items-center">
                                               <span className="text-[8px] font-black text-slate-400 uppercase">Nama Bank:</span>
                                               <span className="font-black text-slate-900">{activeBank.bankName}</span>
                                             </div>
                                             <div className="flex justify-between items-center">
                                               <span className="text-[8px] font-black text-slate-400 uppercase">Nomor Rekening:</span>
                                               <div className="flex items-center gap-1.5">
                                                 <span className="font-black text-tr font-mono">{activeBank.accountNumber}</span>
                                                 <button
                                                   type="button"
                                                   onClick={() => {
                                                     navigator.clipboard.writeText(activeBank.accountNumber);
                                                     toast.success('Nomor rekening disalin!');
                                                   }}
                                                   className="px-2 py-0.5 text-[8px] font-black uppercase text-tr bg-tr/10 hover:bg-tr/20 rounded transition-colors"
                                                 >
                                                   Salin
                                                 </button>
                                               </div>
                                             </div>
                                             <div className="flex justify-between items-center border-t border-slate-100 pt-1.5">
                                               <span className="text-[8px] font-black text-slate-400 uppercase">Atas Nama:</span>
                                               <span className="font-black text-slate-900">{activeBank.accountHolder}</span>
                                             </div>
                                           </div>
                                         );
                                       })()}
                                       <p className="text-[8px] text-slate-400 font-bold text-center mt-1">Harap simpan bukti transfer dan kirimkan ke staf kami via WhatsApp.</p>
                                     </div>
                                   ) : storeSettings?.bankInfo ? (
                                     <div className="mt-2 flex flex-col items-center bg-white rounded-xl p-4 border border-tr/10 shadow-inner">
                                       <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-800 mb-2">Transfer ke Rekening Berikut</h4>
                                       <p className="text-sm font-black text-slate-900 whitespace-pre-line text-center bg-slate-50 p-3 rounded-lg border border-slate-200 w-full">{storeSettings.bankInfo}</p>
                                       <p className="text-[8px] text-slate-400 font-bold mt-3 text-center">Harap simpan bukti transfer dan kirimkan ke staf kami via WhatsApp.</p>
                                     </div>
                                   ) : null
                                 )}

                                  {/* Upload Bukti Pembayaran */}
                                  <div className="mt-4 pt-4 border-t border-tr/20 flex flex-col gap-2.5 w-full text-left text-slate-800">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                      Unggah Bukti Bayar (Opsional)
                                    </label>
                                    
                                    {paymentProofUrl ? (
                                      <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-white p-2 flex items-center justify-between shadow-sm">
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div className="w-12 h-16 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden shrink-0">
                                            <img src={paymentProofUrl} alt="Bukti" className="w-full h-full object-cover" />
                                          </div>
                                          <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-900 truncate">Bukti Pembayaran</p>
                                            <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                              <CheckCircle2 size={10} className="text-emerald-500" /> Berhasil diunggah
                                            </p>
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setPaymentProofUrl('')}
                                          className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-xl transition-all"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                    ) : (
                                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-tr/30 bg-white p-5 rounded-2xl cursor-pointer transition-all active:scale-[0.99] group">
                                        {isUploadingProof ? (
                                          <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="w-8 h-8 text-tr animate-spin" />
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Mengunggah...</span>
                                          </div>
                                        ) : (
                                          <div className="flex flex-col items-center gap-2">
                                            <Upload className="text-slate-400 group-hover:text-tr transition-colors" size={24} />
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Pilih Foto Bukti Transfer</span>
                                            <span className="text-[8px] text-slate-400">PNG, JPG atau JPEG</span>
                                          </div>
                                        )}
                                        <input
                                          type="file"
                                          accept="image/*"
                                          disabled={isUploadingProof}
                                          onChange={async (e) => {
                                            if (!e.target.files || !e.target.files[0]) return;
                                            const file = e.target.files[0];
                                            if (!file.type.startsWith('image/')) {
                                              toast.error('File harus berupa gambar');
                                              return;
                                            }
                                            setIsUploadingProof(true);
                                            try {
                                              const refPath = `payment_proofs/store_${storeId}/pre_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                                              const storageRef = ref(storage, refPath);
                                              await uploadBytes(storageRef, file);
                                              const url = await getDownloadURL(storageRef);
                                              setPaymentProofUrl(url);
                                              toast.success('Bukti bayar berhasil diunggah!');
                                            } catch (err: any) {
                                              console.error(err);
                                              toast.error('Gagal mengunggah bukti: ' + err.message);
                                            } finally {
                                              setIsUploadingProof(false);
                                            }
                                          }}
                                          className="hidden"
                                        />
                                      </label>
                                    )}
                                  </div>
                              </div>
                          )}
                       </div>

                       {/* Summary Info */}
                       <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ringkasan Pesanan</p>
                          <div className="flex justify-between text-xs font-bold text-slate-600">
                             <span>{totalCartItems} Item Produk</span>
                             <span>Rp {(subtotalSum || 0).toLocaleString('id-ID')}</span>
                          </div>
                          {storeSettings?.useTax && (
                             <div className="flex justify-between text-xs font-bold text-slate-600">
                                <span>Pajak ({(storeSettings.taxRate || 0)}%)</span>
                                <span>Rp {(taxAmount || 0).toLocaleString('id-ID')}</span>
                             </div>
                           )}
                           {fulfillmentType === 'delivery' && (
                             <div className="flex justify-between text-xs font-bold text-emerald-600">
                                <span>Ongkos Kirim</span>
                                <span>Rp {(deliveryFee || 0).toLocaleString('id-ID')}</span>
                             </div>
                           )}
                        </div>
                    </div>
                 )}
              </div>

              <div className="w-full p-8 bg-slate-50 border-t border-slate-200 space-y-6">
                 <div className="space-y-2">
                    <div className="flex justify-between text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                       <span>Total Item</span>
                       <span>{totalCartItems} Produk</span>
                    </div>
                    <div className="flex justify-between text-2xl font-black text-slate-900 tracking-tighter pt-2 border-t border-slate-100">
                       <span>TOTAL</span>
                       <span className="text-tr">Rp {(totalWithFulfillment || 0).toLocaleString('id-ID')}</span>
                    </div>
                 </div>
                 <div className="flex gap-3">
                    {isConfirmingCheckout && (
                      <button 
                        onClick={() => setIsConfirmingCheckout(false)}
                        className="w-20 py-5 bg-white border-2 border-slate-100 text-slate-400 rounded-[2rem] font-black active:scale-95 transition-all flex items-center justify-center"
                      >
                         <ArrowLeft size={20} />
                      </button>
                    )}
                    {isConfirmingCheckout ? (
                       <button
                         onClick={handleCheckout}
                         disabled={isProcessing}
                         className="flex-1 py-5 bg-tr text-slate-900 rounded-[2rem] font-black shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                       >
                         {isProcessing ? <Loader2 className="animate-spin" /> : <>KONFIRMASI & KIRIM</>}
                       </button>
                    ) : (
                       <button
                         onClick={() => {
                           if (!authUser) {
                             toast.error("Harap masuk atau daftar akun terlebih dahulu sebelum melanjutkan checkout");
                             router.push(`/tr/auth?s=${storeId}&redirect=checkout`);
                             return;
                           }
                           setIsConfirmingCheckout(true);
                         }}
                         className="flex-1 py-5 bg-tr text-slate-900 rounded-[2rem] font-black shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
                       >
                         LANJUTKAN
                       </button>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Extras Modal */}
      {activeExtrasProduct && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
           <div className="bg-white border border-slate-200 rounded-[2.5rem] w-full max-w-sm flex flex-col max-h-[85vh] overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                 <div>
                    <h3 className="text-lg font-black text-slate-900 italic tracking-tight">{activeExtrasProduct.name}</h3>
                    <p className="text-[10px] text-tr uppercase font-black tracking-widest">Pilih Tambahan</p>
                 </div>
                 <button onClick={handleManualClose} className="text-slate-400 hover:text-slate-900 transition-all"><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 font-sans">
                 {isLoadingExtras ? (
                   <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-30">
                     <Loader2 className="animate-spin text-tr" size={32} />
                     <span className="text-[11px] font-black uppercase tracking-widest text-slate-900">Memuat Ekstra...</span>
                   </div>
                 ) : availableExtraGroups.map(group => (
                    <div key={group.id} className="space-y-4">
                       <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{group.name} {group.isMandatory && "*"}</span>
                          <span className="text-[8px] bg-slate-100 px-2 py-0.5 rounded-full font-black uppercase text-slate-400 border border-slate-200">{group.allowMultiple ? 'Multi' : 'Single'}</span>
                       </div>
                       <div className="grid grid-cols-1 gap-2">
                          {group.options.map((opt, i) => {
                            const isSelected = (tempSelections[group.id!] || []).some(o => o.name === opt.name);
                            return (
                              <button 
                                key={i}
                                onClick={() => {
                                  const cur = tempSelections[group.id!] || [];
                                  const exists = cur.some(o => o.name === opt.name);
                                  let next = [];
                                  if (exists) {
                                    next = cur.filter(o => o.name !== opt.name);
                                  } else {
                                    if (!group.allowMultiple) {
                                      next = [opt];
                                    } else {
                                      if (group.hasMaxLimit && cur.length >= (group.maxLimit || 1)) return;
                                      next = [...cur, opt];
                                    }
                                  }
                                  setTempSelections({ ...tempSelections, [group.id!]: next });
                                }}
                                className={"p-4 rounded-2xl border transition-all flex justify-between items-center " + (isSelected ? 'bg-tr/10 border-tr text-tr shadow-lg shadow-tr/5' : 'bg-white border-slate-200 text-slate-500 hover:border-tr/30')}
                              >
                                 <span className="text-sm font-bold">{opt.name}</span>
                                 {opt.price > 0 && <span className="text-[10px] font-black text-tr">+ {(opt.price || 0).toLocaleString('id-ID')}</span>}
                              </button>
                            )
                          })}
                       </div>
                    </div>
                 ))}
              </div>
              <div className="p-6 border-t border-slate-100">
                 <button onClick={confirmExtrasToCart} className="w-full py-4 bg-tr text-slate-900 rounded-2xl font-black shadow-xl active:scale-95 transition-all shadow-tr/20 uppercase tracking-widest text-xs">LANJUTKAN</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

function LoadingFallback() {
  const { branding } = useBranding();
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-10">
      <Loader2 className="w-10 h-10 text-tr animate-spin mb-4" />
      <p className="text-tr font-black tracking-widest uppercase text-xs animate-pulse tracking-[0.2em]">{branding.appName} oleh YADIKOMPUTER...</p>
    </div>
  );
}

export default function PublicOrderPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PublicOrderContent />
    </Suspense>
  );
}
