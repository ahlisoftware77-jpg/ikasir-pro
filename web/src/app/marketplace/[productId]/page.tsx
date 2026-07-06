'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  runTransaction, 
  serverTimestamp 
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  ShoppingBag, 
  MessageSquare, 
  Store, 
  AlertCircle, 
  RefreshCw, 
  ArrowLeft, 
  Share2, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Play, 
  Zap, 
  Truck, 
  Banknote, 
  CreditCard, 
  QrCode,
  CheckCircle,
  Plus
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCart } from '@/context/CartContext';
import CartButton from '@/components/CartButton';
import CartDrawer from '@/components/CartDrawer';
import { getInfraConfig } from '@/lib/infraConfig';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
  imageUrls?: string[];
  description?: string;
  videoUrl?: string;
  storeId: string;
  storeName?: string;
  stock?: number;
  manageStock?: boolean;
}

interface MediaItem {
  type: 'image' | 'video';
  url: string;
}

const uploadToCloudinary = async (file: File): Promise<string> => {
  const config = await getInfraConfig();
  const uploadData = new FormData();
  uploadData.append('file', file);
  uploadData.append('upload_preset', config.cloudinary_upload_preset || 'kasirpos');

  const cloudName = config.cloudinary_cloud_name || 'dkcjfwbvc';
  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: uploadData
  });

  if (!uploadRes.ok) {
    const errData = await uploadRes.json();
    throw new Error(errData.error?.message || 'Gagal mengunggah ke Cloudinary');
  }

  const uploadResult = await uploadRes.json();
  return uploadResult.secure_url;
};

export default function ProductDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params);
  const router = useRouter();
  const { addToCart } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [otherProducts, setOtherProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Store metadata mappings
  const [storePhone, setStorePhone] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeLogo, setStoreLogo] = useState('');
  
  // Store checkout settings
  const [storeBanks, setStoreBanks] = useState<any[]>([]);
  const [storeEwallets, setStoreEwallets] = useState<any[]>([]);
  const [storeBankInfo, setStoreBankInfo] = useState('');
  const [storeEwalletInfo, setStoreEwalletInfo] = useState('');
  const [storeUseTax, setStoreUseTax] = useState(false);
  const [storeTaxRate, setStoreTaxRate] = useState(0);
  const [storeDeliveryFee, setStoreDeliveryFee] = useState(0);
  const [storeAllowPickup, setStoreAllowPickup] = useState(true);
  const [storeAllowDelivery, setStoreAllowDelivery] = useState(true);

  // Fullscreen Media Preview Lightbox state (index based for navigation)
  const [previewIndex, setPreviewIndex] = useState<number>(-1);

  // Flash Sale state
  const [flashSales, setFlashSales] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Checkout state variables
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isCartPopupOpen, setIsCartPopupOpen] = useState(false);
  const [cartQty, setCartQty] = useState(1);
  const [qty, setQty] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qris'>('cash');
  const [selectedStoreBankId, setSelectedStoreBankId] = useState('');
  const [selectedStoreEwalletId, setSelectedStoreEwalletId] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downPayment, setDownPayment] = useState(0);
  const [guestId, setGuestId] = useState('');
  const [authUser, setAuthUser] = useState<any>(null);

  // Sync Auth User & guest_id
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthUser(user);
        setCustomerName(user.displayName || '');
        if (user && user.uid) {
          getDoc(doc(db, 'users', user.uid)).then(snap => {
            if (snap.exists() && snap.data().phone) {
              setCustomerPhone(snap.data().phone);
            }
          }).catch(err => console.error("Error fetching user doc:", err));
        }
      } else {
        setAuthUser(null);
        setCustomerName(localStorage.getItem('customer_name') || '');
        setCustomerPhone(localStorage.getItem('customer_phone') || '');
      }
    });

    const savedGuestId = localStorage.getItem('guest_id') || ('guest_' + Math.random().toString(36).substring(2, 9));
    setGuestId(savedGuestId);
    if (!localStorage.getItem('guest_id')) {
      localStorage.setItem('guest_id', savedGuestId);
    }

    return () => unsubAuth();
  }, []);

  // 1-second timer for flash sale countdown
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadProductDetails() {
      if (!productId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const productRef = doc(db, 'products', productId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
          const data = productSnap.data();
          const prodObj: Product = {
            id: productSnap.id,
            name: data.name || '',
            price: data.price || 0,
            category: data.category || 'Umum',
            imageUrl: data.imageUrl || '',
            imageUrls: data.imageUrls || [],
            description: data.description || '',
            videoUrl: data.videoUrl || '',
            storeId: data.storeId || '',
            storeName: data.storeName || 'Toko Mitra',
            stock: data.stock !== undefined ? data.stock : 0,
            manageStock: data.manageStock !== undefined ? data.manageStock : true,
          };
          setProduct(prodObj);

          // Fetch store details
          if (data.storeId) {
            const settingsSnap = await getDoc(doc(db, 'settings', `store_${data.storeId}`));
            if (settingsSnap.exists()) {
              const sData = settingsSnap.data();
              setStorePhone(sData.phone || '');
              setStoreAddress(sData.address || '');
              setStoreLogo(sData.logoUrl || '');
              
              // Load payment & fulfillment settings
              setStoreBanks(sData.storeBanks || []);
              setStoreEwallets(sData.storeEwallets || []);
              setStoreBankInfo(sData.bankInfo || '');
              setStoreEwalletInfo(sData.ewalletInfo || '');
              setStoreUseTax(!!sData.useTax);
              setStoreTaxRate(Number(sData.taxRate) || 0);
              setStoreDeliveryFee(Number(sData.deliveryFee) || 0);
              setStoreAllowPickup(sData.allowPickup !== false);
              setStoreAllowDelivery(sData.allowDelivery !== false);
              
              if (sData.allowPickup === false && sData.allowDelivery !== false) {
                setFulfillmentType('delivery');
              } else {
                setFulfillmentType('pickup');
              }

              if (sData.storeBanks && sData.storeBanks.length > 0) {
                setSelectedStoreBankId(sData.storeBanks[0].id);
              }
              if (sData.storeEwallets && sData.storeEwallets.length > 0) {
                setSelectedStoreEwalletId(sData.storeEwallets[0].id);
              }
            }

            // Fetch other products from same store
            const q = query(
              collection(db, 'products'), 
              where('storeId', '==', data.storeId), 
              where('joinMarketplace', '==', true)
            );
            const otherSnap = await getDocs(q);
            const list: Product[] = [];
            otherSnap.forEach((d) => {
              if (d.id !== productSnap.id) {
                const oData = d.data();
                list.push({
                  id: d.id,
                  name: oData.name || '',
                  price: oData.price || 0,
                  category: oData.category || 'Umum',
                  imageUrl: oData.imageUrl || '',
                  storeId: oData.storeId || '',
                  storeName: oData.storeName || 'Toko Mitra',
                });
              }
            });
            setOtherProducts(list.slice(0, 4));

            // Fetch flash sales for this store
            try {
              const fsQuery = query(
                collection(db, 'flash_sales'),
                where('storeId', '==', data.storeId),
                where('isActive', '==', true)
              );
              const fsSnap = await getDocs(fsQuery);
              const fsList: any[] = [];
              fsSnap.forEach((fsDoc) => {
                fsList.push({ id: fsDoc.id, ...fsDoc.data() });
              });
              setFlashSales(fsList);
            } catch (fsErr) {
              console.error('Error fetching flash sales:', fsErr);
            }
          }
        }
      } catch (err) {
        console.error("Error loading product detail page:", err);
      } finally {
        setLoading(false);
      }
    }

    loadProductDetails();
  }, [productId]);

  const handleOpenCheckout = () => {
    if (!product) return;
    setIsCheckoutOpen(true);
    setQty(1);
    setPaymentProofUrl('');
    
    // Auto populate profile data if guest
    if (!authUser) {
      setCustomerName(localStorage.getItem('customer_name') || '');
      setCustomerPhone(localStorage.getItem('customer_phone') || '');
    }
  };

  const handleConfirmCheckout = async () => {
    if (!product) return;

    if (!customerName.trim()) {
      alert("Harap lengkapi nama Anda.");
      return;
    }
    if (!customerPhone.trim()) {
      alert("Harap isi nomor WhatsApp Anda.");
      return;
    }
    if (fulfillmentType === 'delivery' && !deliveryAddress.trim()) {
      alert("Harap lengkapi alamat pengiriman Anda.");
      return;
    }

    setIsProcessing(true);
    try {
      const ep = getEffectivePrice(product);
      const activePrice = ep.isFlashSale ? ep.price : product.price;
      const sub = activePrice * qty;
      const fee = fulfillmentType === 'delivery' ? storeDeliveryFee : 0;
      const taxAmount = storeUseTax ? Math.round((sub * storeTaxRate) / 100) : 0;
      const finalTotal = sub + taxAmount + fee;

      const orderData: any = {
        storeId: product.storeId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        guestId: authUser?.uid || guestId,
        items: [{
          productId: product.id,
          productName: product.name,
          price: activePrice,
          qty: qty,
          subtotal: sub,
          selectedExtras: [],
          note: ''
        }],
        subtotal: sub,
        tax: taxAmount,
        deliveryFee: fee,
        total: finalTotal,
        paymentMethod: paymentMethod,
        selectedPaymentDetails: paymentMethod === 'transfer' 
          ? (storeBanks.find((b: any) => b.id === selectedStoreBankId) || storeBanks[0] || null)
          : paymentMethod === 'qris' 
            ? (storeEwallets.find((ew: any) => ew.id === selectedStoreEwalletId) || storeEwallets[0] || null)
            : null,
        paymentProofUrl: (paymentMethod === 'transfer' || paymentMethod === 'qris') ? paymentProofUrl : '',
        orderStatus: 'new',
        paymentStatus: 'pending',
        paymentCategory: 'order',
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
        if (!product.storeId) {
          throw new Error("Store ID tidak valid.");
        }
        const settingsRef = doc(db, 'settings', `store_${product.storeId}`);
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

        // Deduct flash sale stock if active
        if (ep.isFlashSale) {
          const activeFs = flashSales.find(fs => {
            if (!fs.isActive) return false;
            const start = new Date(fs.startTime);
            const end = new Date(fs.endTime);
            return currentTime >= start && currentTime <= end;
          });

          if (activeFs && activeFs.id) {
            const fsRef = doc(db, 'flash_sales', activeFs.id);
            const fsDoc = await transaction.get(fsRef);
            if (fsDoc.exists()) {
              const fsData = fsDoc.data();
              const updatedProducts = (fsData.products || []).map((p: any) => {
                if (p.productId === product.id) {
                  const newSoldCount = (p.soldCount || 0) + qty;
                  return { ...p, soldCount: Math.min(p.flashStock || 0, newSoldCount) };
                }
                return p;
              });
              transaction.update(fsRef, { products: updatedProducts });
            }
          }
        }

        if (!finalId) {
          throw new Error("ID Transaksi tidak valid.");
        }
        transaction.set(doc(db, 'transactions', finalId), orderData);
        transaction.set(settingsRef, { trxCounter: currentCounter }, { merge: true });
      });

      // Save customer profile defaults locally if guest
      if (!authUser) {
        localStorage.setItem('customer_name', customerName.trim());
        localStorage.setItem('customer_phone', customerPhone.trim());
      }

      // Add to personal order history
      const savedOrders = JSON.parse(localStorage.getItem('my_orders') || '[]');
      const newOrders = [finalId, ...savedOrders].slice(0, 50);
      localStorage.setItem('my_orders', JSON.stringify(newOrders));

      // Trigger FCM Push Notification
      fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: product.storeId,
          title: '🚨 PESANAN ONLINE BARU!',
          message: `Ada pesanan baru masuk senilai Rp ${finalTotal.toLocaleString('id-ID')}.`,
          data: { transactionId: finalId }
        })
      }).catch(e => console.error('Failed to trigger notification', e));

      // Redirect to WA Chat to Toko
      let formattedPhone = storePhone.replace(/[^0-9]/g, '');
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '62' + formattedPhone.slice(1);
      }
      if (formattedPhone) {
        const textMsg = `Halo ${product.storeName || 'Toko'}, saya telah memesan produk via Marketplace iKasir.\n\n*Detail Pesanan:*\nID Pesanan: #${finalId}\nProduk: *${product.name}* (x${qty})\nTotal Bayar: Rp ${finalTotal.toLocaleString('id-ID')}\nMetode Pembayaran: ${paymentMethod.toUpperCase()}\nPengambilan: ${fulfillmentType === 'delivery' ? 'Kirim ke Alamat' : 'Ambil di Toko'}\n\nMohon konfirmasi pesanan saya, terima kasih!`;
        window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(textMsg)}`, '_blank');
      }

      toast.success("Pesanan Anda berhasil dikirim!");
      setIsCheckoutOpen(false);

      // Redirect user to the Online Store `/tr?s=storeId` to view order list/status
      router.push(`/tr?s=${product.storeId}&open_checkout=false`);
    } catch (err: any) {
      console.error(err);
      alert("Gagal memproses pesanan: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Flash Sale: get effective price for a product
  const getEffectivePrice = (prod: Product) => {
    const activeFs = flashSales.find(fs => {
      if (!fs.isActive) return false;
      const start = new Date(fs.startTime);
      const end = new Date(fs.endTime);
      return currentTime >= start && currentTime <= end;
    });

    if (activeFs && activeFs.products) {
      const fsProd = activeFs.products.find((p: any) => p.productId === prod.id);
      if (fsProd && (fsProd.flashStock || 0) > (fsProd.soldCount || 0)) {
        const end = new Date(activeFs.endTime);
        const diffMs = end.getTime() - currentTime.getTime();
        let countdownText = '00:00:00';
        if (diffMs > 0) {
          const secs = Math.floor((diffMs / 1000) % 60);
          const mins = Math.floor((diffMs / (1000 * 60)) % 60);
          const hrs = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
          const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const totalHrs = hrs + (days * 24);
          countdownText = `${String(totalHrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return {
          price: fsProd.flashPrice as number,
          originalPrice: prod.price,
          isFlashSale: true,
          flashStock: fsProd.flashStock,
          soldCount: fsProd.soldCount || 0,
          countdown: countdownText,
          flashSaleName: activeFs.name || 'Flash Sale',
        };
      }
    }

    return {
      price: prod.price,
      originalPrice: prod.price,
      isFlashSale: false,
      flashStock: 0,
      soldCount: 0,
      countdown: '',
      flashSaleName: '',
    };
  };

  const isVideoUrl = (url: string): boolean => {
    if (!url) return false;
    const cleanUrl = url.split('?')[0].toLowerCase();
    return (
      cleanUrl.endsWith('.mp4') ||
      cleanUrl.endsWith('.webm') ||
      cleanUrl.endsWith('.ogg') ||
      cleanUrl.endsWith('.mov') ||
      cleanUrl.endsWith('.m4v') ||
      url.includes('/video') ||
      url.includes('video') ||
      (url.includes('firebasestorage.googleapis.com') && url.toLowerCase().includes('type=video'))
    );
  };

  const ep = product ? getEffectivePrice(product) : {
    price: 0,
    originalPrice: 0,
    isFlashSale: false,
    flashStock: 0,
    soldCount: 0,
    countdown: '',
    flashSaleName: '',
  };
  const activePrice = ep.isFlashSale ? ep.price : (product?.price || 0);
  const subtotalSum = activePrice * qty;
  const taxAmount = storeUseTax ? Math.round((subtotalSum * storeTaxRate) / 100) : 0;
  const deliveryFee = fulfillmentType === 'delivery' ? storeDeliveryFee : 0;
  const totalWithFulfillment = subtotalSum + taxAmount + deliveryFee;

  const getWhatsAppLink = (prod: Product) => {
    let formattedPhone = storePhone.replace(/[^0-9]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.slice(1);
    }
    
    if (!formattedPhone) return null;

    const message = `Halo ${prod.storeName || 'Toko'}, saya tertarik dengan produk Anda di Marketplace iKasir:\n\n*${prod.name}*\nHarga: Rp ${prod.price.toLocaleString('id-ID')}\n\nApakah produk ini masih tersedia?`;
    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
  };

  const handleWhatsAppRedirect = (prod: Product) => {
    const link = getWhatsAppLink(prod);
    if (!link) {
      alert("Toko ini belum menyantumkan nomor WhatsApp yang valid di pengaturannya.");
      return;
    }
    window.open(link, '_blank');
  };

  const handleShareProduct = (prod: Product) => {
    if (navigator.share) {
      navigator.share({
        title: prod.name,
        text: `Lihat ${prod.name} dari ${prod.storeName} di iKasir Marketplace!`,
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Tautan produk berhasil disalin!");
    }
  };

  const handleStoreClick = (storeId: string, storeName: string) => {
    router.push(`/marketplace?storeId=${storeId}&storeName=${encodeURIComponent(storeName)}`);
  };

  // Determine media gallery list (with video support)
  const getProductMediaGallery = (prod: Product): MediaItem[] => {
    const list: MediaItem[] = [];
    
    const addMedia = (url: string) => {
      if (!url) return;
      if (list.some(item => item.url === url)) return;
      
      if (isVideoUrl(url)) {
        list.push({ type: 'video', url });
      } else {
        list.push({ type: 'image', url });
      }
    };

    if (prod.videoUrl) {
      addMedia(prod.videoUrl);
    }
    if (prod.imageUrl) {
      addMedia(prod.imageUrl);
    }
    if (prod.imageUrls && prod.imageUrls.length > 0) {
      prod.imageUrls.forEach(url => addMedia(url));
    }
    
    return list.length > 0 ? list : [{ type: 'image', url: '' }];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4">
        <RefreshCw className="animate-spin text-emerald-500" size={32} />
        <p className="text-slate-400 text-xs font-black uppercase tracking-widest animate-pulse">Memuat Detail Produk...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4 text-center p-6">
        <AlertCircle className="text-slate-400" size={48} />
        <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider">Produk Tidak Ditemukan</h2>
        <button 
          onClick={() => router.push('/marketplace')}
          className="mt-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-black rounded-xl text-xs active:scale-95 transition-all shadow-md"
        >
          Kembali ke Marketplace
        </button>
      </div>
    );
  }

  const gallery = getProductMediaGallery(product);
  const waLink = getWhatsAppLink(product);
  const activeMedia = gallery[currentImageIndex];
  const previewMedia = previewIndex !== -1 ? gallery[previewIndex] : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300 pb-24 lg:pb-8">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
        <button 
          onClick={() => {
            router.push('/marketplace');
          }}
          className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft size={16} /> Kembali
        </button>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => handleShareProduct(product)}
            className="p-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-xl transition-all shadow-sm flex items-center justify-center"
          >
            <Share2 size={18} />
          </button>
        </div>
      </nav>

      {/* Main Details Panel */}
      <main className="max-w-6xl mx-auto px-4 lg:px-8 py-8 w-full flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: Product Images & Video (Shopee style Media Display) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="relative aspect-square w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden flex items-center justify-center shadow-md animate-in fade-in duration-300">
              {product.manageStock !== false && (product.stock || 0) <= 0 && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center z-20 p-2 text-center">
                  <span className="text-xs font-black text-white uppercase tracking-widest bg-rose-600 px-3 py-1 rounded-md shadow-lg shadow-rose-600/30 animate-pulse">Terjual</span>
                  <span className="text-[10px] font-bold text-slate-350 mt-1 uppercase">Stok Kosong</span>
                </div>
              )}
              {getEffectivePrice(product).isFlashSale && (
                <span className="absolute top-4 right-4 z-10 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[9px] font-black uppercase tracking-widest shadow-lg shadow-rose-600/30 animate-pulse">
                  <Zap size={11} className="fill-white" /> Flash Sale
                </span>
              )}
              {activeMedia && activeMedia.url ? (
                activeMedia.type === 'video' ? (
                  <video 
                    src={activeMedia.url} 
                    controls 
                    playsInline
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img 
                    src={activeMedia.url} 
                    alt={product.name} 
                    onClick={() => setPreviewIndex(currentImageIndex)}
                    className="object-cover w-full h-full cursor-pointer hover:scale-[1.01] transition-transform duration-300"
                  />
                )
              ) : (
                <div className="text-slate-400 flex flex-col items-center">
                  <ShoppingBag size={64} />
                  <span className="text-xs font-black uppercase tracking-widest mt-4">No Media Available</span>
                </div>
              )}

              {/* Carousel Controls */}
              {gallery.length > 1 && (
                <>
                  <button 
                    onClick={() => setCurrentImageIndex(prev => (prev === 0 ? gallery.length - 1 : prev - 1))}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 flex items-center justify-center shadow-lg hover:bg-emerald-500 dark:hover:bg-emerald-500 hover:text-white transition-all z-10"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button 
                    onClick={() => setCurrentImageIndex(prev => (prev === gallery.length - 1 ? 0 : prev + 1))}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 flex items-center justify-center shadow-lg hover:bg-emerald-500 dark:hover:bg-emerald-500 hover:text-white transition-all z-10"
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {gallery.length > 1 && (
              <div className="flex gap-3 overflow-x-auto py-2">
                {gallery.map((media, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${currentImageIndex === idx ? 'border-emerald-500 scale-105 shadow-md' : 'border-slate-200 dark:border-slate-800'}`}
                  >
                    {media.type === 'video' ? (
                      <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white">
                        <Play size={20} className="fill-white" />
                        <span className="absolute bottom-1 right-1 text-[8px] bg-black/60 px-1 rounded text-slate-300 font-bold uppercase tracking-wider">VIDEO</span>
                      </div>
                    ) : (
                      <img src={media.url} alt="" className="w-full h-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Info Section */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4 shadow-sm">
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-450 text-[10px] font-black uppercase tracking-wider">
                {product.category}
              </span>
              
              <h1 className="text-xl lg:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                {product.name}
              </h1>
              
              {/* Shopee-style Price Panel */}
              {(() => {
                const ep = getEffectivePrice(product);
                return (
                  <div className={`p-4 rounded-2xl border flex-wrap ${ep.isFlashSale ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40' : 'bg-slate-50 dark:bg-slate-900/80 border-slate-100 dark:border-slate-800/40'}`}>
                    {ep.isFlashSale && (
                      <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-rose-200 dark:border-rose-900/40">
                        <div className="flex items-center gap-2">
                          <span className="text-lg animate-bounce">⚡</span>
                          <div>
                            <h4 className="font-black text-[10px] uppercase tracking-wider text-rose-600 dark:text-rose-400">Flash Sale Aktif</h4>
                            <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300">{ep.flashSaleName}</p>
                          </div>
                        </div>
                        <div className="bg-rose-600 text-white font-mono px-2.5 py-1 rounded-xl text-[10px] font-black shadow-md shadow-rose-600/20 shrink-0">
                          {ep.countdown}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                            {ep.isFlashSale ? 'Harga Flash Sale' : 'Harga Spesial'}
                          </span>
                          {product.manageStock !== false && (
                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-md">
                              Sisa Stok: {product.stock || 0}
                            </span>
                          )}
                        </div>
                        <div className={`text-2xl lg:text-4xl font-black mt-1 ${ep.isFlashSale ? 'text-rose-600 dark:text-rose-400' : 'text-orange-500 dark:text-orange-400'}`}>
                          Rp {ep.price.toLocaleString('id-ID')}
                        </div>
                        {ep.isFlashSale && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-sm line-through text-slate-400 font-bold">
                              Rp {ep.originalPrice.toLocaleString('id-ID')}
                            </span>
                            <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded-md uppercase">
                              -{Math.round(((ep.originalPrice - ep.price) / ep.originalPrice) * 100)}%
                            </span>
                          </div>
                        )}
                        {ep.isFlashSale && (
                          <div className="mt-2.5 w-48">
                            <div className="flex justify-between items-center text-[8px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                              <span>Terjual {ep.soldCount}/{ep.flashStock}</span>
                              <span>{ep.flashStock > 0 ? Math.round((ep.soldCount / ep.flashStock) * 100) : 0}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-rose-200 dark:bg-rose-900/40 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-rose-600 rounded-full transition-all"
                                style={{ width: `${ep.flashStock > 0 ? Math.min(100, (ep.soldCount / ep.flashStock) * 100) : 0}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      {product.manageStock !== false && (product.stock || 0) <= 0 && (
                        <span className="px-3.5 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-450 text-xs font-black uppercase tracking-wider animate-pulse">
                          Stok Habis
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Desktop Checkout / Buy Action Buttons */}
              <div className="flex flex-wrap sm:flex-nowrap gap-3 pt-2">
                <button
                  disabled={product.manageStock !== false && (product.stock || 0) <= 0}
                  onClick={() => handleOpenCheckout()}
                  className={`flex-1 py-4 px-2 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md ${
                    product.manageStock !== false && (product.stock || 0) <= 0
                      ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-emerald-500 hover:bg-emerald-450 text-slate-950 shadow-emerald-500/20'
                  }`}
                >
                  <ShoppingBag size={16} />
                  <span>Beli Sekarang</span>
                </button>
                <button
                  disabled={product.manageStock !== false && (product.stock || 0) <= 0}
                  onClick={() => {
                    setCartQty(1);
                    setIsCartPopupOpen(true);
                  }}
                  className={`flex-1 py-4 px-2 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95 transition-all border ${
                    product.manageStock !== false && (product.stock || 0) <= 0
                      ? 'border-slate-300 dark:border-slate-800 text-slate-400 cursor-not-allowed'
                      : 'border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30'
                  }`}
                >
                  <Plus size={16} className="stroke-[3]" />
                  <span>+ Keranjang</span>
                </button>
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-none px-5 py-4 border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900/60 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                  >
                    <MessageSquare size={16} />
                  </a>
                )}
              </div>
            </div>

            {/* Description Panel */}
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-3">
              <h3 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Deskripsi Produk</h3>
              <p className="text-slate-600 dark:text-slate-350 text-xs md:text-sm leading-relaxed font-medium whitespace-pre-line">
                {product.description || 'Tidak ada deskripsi produk.'}
              </p>
            </div>
          </div>
        </div>

        {/* Store Panel - Outside main grid, aligned with bounds */}
        <div className="mt-8 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm shrink-0">
              {storeLogo ? (
                <img src={storeLogo} alt="" className="w-full h-full object-cover" />
              ) : (
                <Store size={22} />
              )}
            </div>
            <div className="min-w-0">
              <h3 
                onClick={() => handleStoreClick(product.storeId, product.storeName || 'Toko Mitra')}
                className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-wider cursor-pointer hover:text-emerald-500 transition-colors flex items-center gap-1"
              >
                {product.storeName || 'Toko Mitra'}
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold break-words">{storeAddress || 'Mitra Penjual Resmi iKasir'}</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button 
              onClick={() => handleStoreClick(product.storeId, product.storeName || 'Toko Mitra')}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-black rounded-xl text-xs active:scale-95 transition-all border border-slate-200 dark:border-slate-700"
            >
              Kunjungi Toko
            </button>
            {waLink && (
              <a 
                href={waLink} 
                target="_blank" 
                rel="noreferrer"
                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-emerald-500/10"
              >
                <MessageSquare size={14} className="stroke-[2.5]" /> Hubungi
              </a>
            )}
          </div>
        </div>

        {/* Related Products from same store */}
        {otherProducts.length > 0 && (
          <div className="mt-16 space-y-6">
            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Store size={18} className="text-emerald-500" /> Produk Lainnya Dari Toko Ini
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {otherProducts.map(prod => (
                <div 
                  key={prod.id} 
                  onClick={() => {
                    router.push(`/marketplace/${prod.id}`);
                  }}
                  className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden flex flex-col hover:border-emerald-500/30 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer shadow-sm"
                >
                  <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-950 overflow-hidden flex items-center justify-center">
                    {prod.imageUrl ? (
                      <img src={prod.imageUrl} alt="" className="object-cover w-full h-full" />
                    ) : (
                      <ShoppingBag size={20} className="text-slate-350 dark:text-slate-700" />
                    )}
                  </div>
                  <div className="p-2.5 sm:p-3 space-y-1">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-[11px] sm:text-xs line-clamp-1 leading-snug">{prod.name}</h4>
                    <p className="text-orange-500 text-[11px] sm:text-xs font-black">Rp {prod.price.toLocaleString('id-ID')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Bar for Mobile View */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center justify-between gap-3 lg:hidden">
        {(() => {
          return (
            <>
              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-none px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                >
                  <MessageSquare size={18} />
                </a>
              )}
              
              <button
                onClick={() => {
                  setCartQty(1);
                  setIsCartPopupOpen(true);
                }}
                disabled={product.manageStock !== false && (product.stock || 0) <= 0}
                className={`flex-1 py-3 rounded-2xl font-black text-[11px] flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm ${
                  product.manageStock !== false && (product.stock || 0) <= 0
                    ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-emerald-500'
                }`}
              >
                <ShoppingBag size={14} className="stroke-[2.5]" />
                <span>Keranjang</span>
              </button>

              <button
                onClick={() => handleOpenCheckout()}
                disabled={product.manageStock !== false && (product.stock || 0) <= 0}
                className={`flex-1 py-3 rounded-2xl font-black text-[11px] flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md ${
                  product.manageStock !== false && (product.stock || 0) <= 0
                    ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-emerald-500 hover:bg-emerald-450 text-slate-950 shadow-emerald-500/20'
                }`}
              >
                <span>Beli Sekarang</span>
              </button>
            </>
          );
        })()}
      </div>

      {/* Fullscreen Media Preview Modal (Lightbox) - Bounded Size with Arrows */}
      {previewMedia && (
        <div 
          onClick={() => setPreviewIndex(-1)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200 cursor-zoom-out"
        >
          <button 
            onClick={() => setPreviewIndex(-1)}
            className="absolute top-6 right-6 text-white hover:text-emerald-450 p-2.5 transition-colors z-55 bg-slate-900/60 rounded-full"
          >
            <X size={24} />
          </button>
          
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="relative max-w-4xl max-h-[85vh] w-11/12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 flex items-center justify-center shadow-2xl overflow-hidden cursor-default"
          >
            {previewMedia.type === 'video' ? (
              <video 
                key={previewMedia.url}
                src={previewMedia.url} 
                controls 
                autoPlay
                playsInline
                className="max-w-full max-h-[75vh] object-contain rounded-2xl"
              />
            ) : (
              <img 
                src={previewMedia.url} 
                alt="" 
                className="max-w-full max-h-[75vh] object-contain rounded-2xl animate-in zoom-in-95 duration-200"
              />
            )}

            {/* Lightbox Navigation Arrows */}
            {gallery.length > 1 && (
              <>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewIndex(prev => (prev === 0 ? gallery.length - 1 : prev - 1));
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-slate-100/80 dark:bg-slate-800/80 hover:bg-emerald-500 text-slate-800 dark:text-white flex items-center justify-center shadow-lg transition-all z-10"
                >
                  <ChevronLeft size={24} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewIndex(prev => (prev === gallery.length - 1 ? 0 : prev + 1));
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-slate-100/80 dark:bg-slate-800/80 hover:bg-emerald-500 text-slate-800 dark:text-white flex items-center justify-center shadow-lg transition-all z-10"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Fitur Checkout Modal (Premium Overlay) */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 dark:bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] w-full max-w-lg flex flex-col max-h-[90vh] shadow-2xl overflow-hidden my-8">
            
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white italic tracking-tight">Checkout Pemesanan</h3>
                <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">{product.storeName}</p>
              </div>
              <button 
                onClick={() => setIsCheckoutOpen(false)}
                className="text-slate-400 hover:text-slate-950 dark:hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 text-slate-800 dark:text-slate-200 text-left">
              
              {/* Product Info Summary */}
              <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-slate-900 overflow-hidden shrink-0 border border-slate-300 dark:border-slate-800">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-600">
                      <ShoppingBag size={24} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">{product.name}</h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">{product.category}</p>
                  
                  {/* Quantity Control */}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-black text-emerald-500">Rp {activePrice.toLocaleString('id-ID')}</span>
                    <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-xl shadow-inner scale-90">
                      <button 
                        onClick={() => setQty(prev => Math.max(1, prev - 1))}
                        className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      >
                        -
                      </button>
                      <span className="text-xs font-black text-slate-900 dark:text-white">{qty}</span>
                      <button 
                        onClick={() => {
                          if (product.manageStock !== false && qty >= (product.stock || 0)) {
                            alert("Stok terbatas!");
                            return;
                          }
                          setQty(prev => prev + 1);
                        }}
                        className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 1: Customer Profile Details */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">1. Data Pelanggan</h4>
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Nama Lengkap</label>
                    <input 
                      type="text"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="Masukkan nama Anda..."
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Nomor WhatsApp</label>
                    <input 
                      type="tel"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      placeholder="Contoh: 08123456789"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Fulfillment Type (Pickup vs Delivery) */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">2. Cara Pengambilan</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFulfillmentType('pickup')}
                    className={`p-4 border rounded-2xl flex flex-col items-center gap-1.5 transition-all text-center ${
                      fulfillmentType === 'pickup'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-450 font-black shadow-lg shadow-emerald-500/5'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-500/30'
                    }`}
                  >
                    <Store size={18} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Ambil Sendiri</span>
                  </button>
                  <button
                    onClick={() => setFulfillmentType('delivery')}
                    className={`p-4 border rounded-2xl flex flex-col items-center gap-1.5 transition-all text-center ${
                      fulfillmentType === 'delivery'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-450 font-black shadow-lg shadow-emerald-500/5'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-500/30'
                    }`}
                  >
                    <Truck size={18} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Pengiriman</span>
                  </button>
                </div>

                {fulfillmentType === 'delivery' && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Alamat Lengkap Pengiriman</label>
                    <textarea 
                      value={deliveryAddress}
                      onChange={e => setDeliveryAddress(e.target.value)}
                      placeholder="Masukkan alamat pengiriman lengkap Anda..."
                      rows={3}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                    />
                  </div>
                )}
              </div>

              {/* Step 3: Payment Method Selection */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">3. Metode Pembayaran</h4>
                
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setPaymentMethod('cash');
                      setDownPayment(0);
                    }}
                    className={`p-3 border rounded-2xl flex flex-col items-center gap-1.5 transition-all text-center ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-450 font-black shadow-lg shadow-emerald-500/5'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-500/30'
                    }`}
                  >
                    <Banknote size={16} />
                    <span className="text-[9px] font-black uppercase tracking-wider">Tunai / COD</span>
                  </button>
                  <button
                    onClick={() => {
                      setPaymentMethod('transfer');
                      setDownPayment(0);
                    }}
                    className={`p-3 border rounded-2xl flex flex-col items-center gap-1.5 transition-all text-center ${
                      paymentMethod === 'transfer'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-450 font-black shadow-lg shadow-emerald-500/5'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-500/30'
                    }`}
                  >
                    <CreditCard size={16} />
                    <span className="text-[9px] font-black uppercase tracking-wider">Transfer</span>
                  </button>
                  <button
                    onClick={() => {
                      setPaymentMethod('qris');
                      setDownPayment(0);
                    }}
                    className={`p-3 border rounded-2xl flex flex-col items-center gap-1.5 transition-all text-center ${
                      paymentMethod === 'qris'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-450 font-black shadow-lg shadow-emerald-500/5'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-500/30'
                    }`}
                  >
                    <QrCode size={16} />
                    <span className="text-[9px] font-black uppercase tracking-wider">QRIS</span>
                  </button>
                </div>

                {/* Sub-panels for payments details */}
                {paymentMethod === 'transfer' && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Informasi Bank Toko</p>
                    
                    {storeBanks.length > 0 ? (
                      <div className="space-y-3">
                        <select
                          value={selectedStoreBankId}
                          onChange={(e) => setSelectedStoreBankId(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                        >
                          {storeBanks.map((bank: any) => (
                            <option key={bank.id} value={bank.id}>
                              {bank.bankName} - {bank.accountNumber}
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const activeBank = storeBanks.find((b: any) => b.id === selectedStoreBankId) || storeBanks[0];
                          return (
                            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold space-y-1 text-slate-700 dark:text-slate-350 shadow-inner">
                              <div className="flex justify-between items-center">
                                <span className="text-[8px] font-black text-slate-400 uppercase">Nama Bank:</span>
                                <span className="font-extrabold text-slate-900 dark:text-white uppercase">{activeBank.bankName}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[8px] font-black text-slate-400 uppercase">No. Rekening:</span>
                                <span className="font-extrabold text-slate-900 dark:text-white select-all">{activeBank.accountNumber}</span>
                              </div>
                              <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-850 pt-1.5">
                                <span className="text-[8px] font-black text-slate-400 uppercase">Atas Nama:</span>
                                <span className="font-black text-slate-900 dark:text-white">{activeBank.accountHolder}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : storeBankInfo ? (
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 whitespace-pre-line text-center">{storeBankInfo}</p>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic text-center">Toko belum menyantumkan rekening bank.</p>
                    )}
                  </div>
                )}

                {paymentMethod === 'qris' && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pembayaran QRIS Toko</p>
                    
                    {storeEwallets.length > 0 ? (
                      <div className="space-y-3">
                        <select
                          value={selectedStoreEwalletId}
                          onChange={(e) => setSelectedStoreEwalletId(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                        >
                          {storeEwallets.map((ew: any) => (
                            <option key={ew.id} value={ew.id}>
                              {ew.ewalletName} - {ew.phoneNumber}
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const activeEw = storeEwallets.find((ew: any) => ew.id === selectedStoreEwalletId) || storeEwallets[0];
                          return (
                            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold space-y-2 text-slate-700 dark:text-slate-350 shadow-inner flex flex-col items-center">
                              {activeEw.qrCodeUrl && (
                                <div className="w-40 h-40 border border-slate-200 dark:border-slate-700 bg-white p-2 rounded-xl mb-2">
                                  <img src={activeEw.qrCodeUrl} alt="QR Code" className="w-full h-full object-contain" />
                                </div>
                              )}
                              <div className="w-full space-y-1">
                                <div className="flex justify-between items-center">
                                  <span className="text-[8px] font-black text-slate-400 uppercase">Provider:</span>
                                  <span className="font-extrabold text-slate-900 dark:text-white uppercase">{activeEw.ewalletName}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-[8px] font-black text-slate-400 uppercase">No. HP/ID:</span>
                                  <span className="font-extrabold text-slate-900 dark:text-white select-all">{activeEw.phoneNumber}</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-850 pt-1.5">
                                  <span className="text-[8px] font-black text-slate-400 uppercase">Nama:</span>
                                  <span className="font-black text-slate-900 dark:text-white">{activeEw.accountHolder}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : storeEwalletInfo ? (
                      <div className="flex flex-col items-center bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                        <img src={storeEwalletInfo} alt="QRIS" className="w-40 h-40 object-contain rounded mb-2" />
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Pindai kode QRIS Toko di atas</p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic text-center">Toko belum menyantumkan e-wallet atau QRIS.</p>
                    )}
                  </div>
                )}

                {/* Upload Proof for non-cash orders */}
                {(paymentMethod === 'transfer' || paymentMethod === 'qris') && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-850 flex flex-col gap-2.5 w-full text-left">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      Unggah Bukti Bayar (Opsional)
                    </label>
                    
                    {paymentProofUrl ? (
                      <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-2 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-16 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 overflow-hidden shrink-0">
                            <img src={paymentProofUrl} alt="Bukti" className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">Bukti Pembayaran</p>
                            <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider flex items-center gap-1">
                              <Zap size={10} className="fill-emerald-500 text-emerald-500" /> Berhasil diunggah
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPaymentProofUrl('')}
                          className="p-2 bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 text-rose-500 rounded-xl transition-all"
                        >
                          Hapus
                        </button>
                      </div>
                    ) : (
                      <label className="relative flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-emerald-500/30 bg-white dark:bg-slate-950 p-5 rounded-2xl cursor-pointer transition-all active:scale-[0.99] group overflow-hidden">
                        {isUploadingProof ? (
                          <div className="flex flex-col items-center gap-2">
                            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Mengunggah...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <RefreshCw className="text-slate-400 group-hover:text-emerald-500 transition-colors" size={24} />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Pilih Foto Bukti Transfer</span>
                            <span className="text-[8px] text-slate-400">PNG, JPG atau JPEG</span>
                          </div>
                        )}
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" 
                          onChange={async (e) => {
                            if (!e.target.files || !e.target.files[0]) return;
                            const file = e.target.files[0];
                            const fileName = file.name.toLowerCase();
                            const isImageExt = fileName.endsWith('.png') || 
                                               fileName.endsWith('.jpg') || 
                                               fileName.endsWith('.jpeg') || 
                                               fileName.endsWith('.webp') || 
                                               fileName.endsWith('.heic') || 
                                               fileName.endsWith('.heif');
                            const isImageType = file.type && file.type.startsWith('image/');
                            if (!isImageType && !isImageExt) {
                              alert('File harus berupa gambar (PNG, JPG, JPEG)');
                              return;
                            }
                            setIsUploadingProof(true);
                            try {
                              const url = await uploadToCloudinary(file);
                              setPaymentProofUrl(url);
                            } catch (err: any) {
                              console.error(err);
                              alert('Gagal mengunggah bukti: ' + err.message);
                            } finally {
                              setIsUploadingProof(false);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>

              {/* Order Summary Pricing details */}
              <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Ringkasan Harga</p>
                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                  <span>Subtotal ({qty} Item)</span>
                  <span>Rp {subtotalSum.toLocaleString('id-ID')}</span>
                </div>
                {storeUseTax && (
                  <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                    <span>Pajak ({storeTaxRate}%)</span>
                    <span>Rp {taxAmount.toLocaleString('id-ID')}</span>
                  </div>
                )}
                {fulfillmentType === 'delivery' && (
                  <div className="flex justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span>Ongkos Kirim</span>
                    <span>Rp {storeDeliveryFee.toLocaleString('id-ID')}</span>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Bottom Footer Actions */}
            <div className="px-8 py-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-4 shrink-0">
              <div className="flex justify-between items-baseline pt-2">
                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest">Total Bayar</span>
                <span className="text-xl font-black text-slate-900 dark:text-white">
                  Rp {totalWithFulfillment.toLocaleString('id-ID')}
                </span>
              </div>
              <button
                onClick={handleConfirmCheckout}
                disabled={isProcessing}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <span>Kirim Pesanan Ke Toko</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Add to Cart Popup Modal */}
      {isCartPopupOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4 bg-slate-900/75 dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
            
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white">Masukkan Keranjang</h3>
              <button 
                onClick={() => setIsCartPopupOpen(false)}
                className="text-slate-400 hover:text-slate-950 dark:hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <ShoppingBag size={24} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{product.name}</h4>
                  <p className="text-emerald-500 font-black text-sm mt-1">Rp {activePrice.toLocaleString('id-ID')}</p>
                  {product.manageStock !== false && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1">Sisa Stok: <span className="text-slate-700 dark:text-slate-300">{product.stock || 0}</span></p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-6">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Jumlah</span>
                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl">
                  <button 
                    onClick={() => setCartQty(prev => Math.max(1, prev - 1))}
                    className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    -
                  </button>
                  <span className="w-6 text-center text-sm font-black text-slate-900 dark:text-white">{cartQty}</span>
                  <button 
                    onClick={() => {
                      if (product.manageStock !== false && cartQty >= (product.stock || 0)) {
                        alert("Stok terbatas!");
                        return;
                      }
                      setCartQty(prev => prev + 1);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  const ep = getEffectivePrice(product);
                  addToCart({
                    productId: product.id,
                    productName: product.name,
                    price: activePrice,
                    storeId: product.storeId,
                    storeName: product.storeName || 'Toko Mitra',
                    storePhone: storePhone,
                    qty: cartQty,
                    imageUrl: product.imageUrl,
                    isFlashSale: ep.isFlashSale
                  });
                  toast.success('Ditambahkan ke keranjang!');
                  setIsCartPopupOpen(false);
                }}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-black rounded-xl text-xs uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                Konfirmasi Masukkan Keranjang
              </button>
            </div>
          </div>
        </div>
      )}

      <CartButton />
      <CartDrawer />
    </div>
  );
}
