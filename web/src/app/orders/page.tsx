'use client';

import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc,
  deleteDoc, 
  writeBatch, 
  increment, 
  updateDoc,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  ClipboardList, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  CreditCard, 
  Printer, 
  User, 
  History, 
  Package, 
  CheckCircle2, 
  X, 
  Loader2,
  Banknote,
  ChefHat,
  ShoppingBag,
  Ban,
  MessageCircle,
  Phone,
  ArrowLeft,
  Check,
  MapPin,
  Truck,
  ExternalLink,
  QrCode
} from 'lucide-react';
import { printReceipt } from '@/lib/printReceipt';
import { useAuthStore } from '@/store/auth';
import { useBranding } from '@/context/BrandingContext';
import toast from 'react-hot-toast';

export default function OrdersPage() {
  const { storeId, user, userName } = useAuthStore();
  const { branding } = useBranding();
  const [orders, setOrders] = useState<any[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isConfirmingReadyOrderId, setIsConfirmingReadyOrderId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [viewingReceipt, setViewingReceipt] = useState<any>(null);
  
  // Tabs State
  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'processing' | 'ready' | 'cancelled'>('all');

  // Piutang State
  const [showPiutangModal, setShowPiutangModal] = useState(false);
  const [selectedPiutangOrder, setSelectedPiutangOrder] = useState<any>(null);
  const [downPaymentAmount, setDownPaymentAmount] = useState('');

  // Settings State
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
    showReceiptSubtotal: true
  });
  
  const openWhatsApp = (phone: string, name: string) => {
    if (!phone) return;
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    } else if (!cleaned.startsWith('62')) {
      // Assuming Indonesia default if no country code
      cleaned = '62' + cleaned;
    }
    const message = encodeURIComponent(`Halo ${name}, pesanan Anda dari ${storeSettings.storeName || 'kami'} sudah siap. Terima kasih!`);
    window.open(`https://wa.me/${cleaned}?text=${message}`, '_blank');
  };
  
  // Payment States for Settlement
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'transfer'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  
  const playSuccessSound = () => {
    try {
      const audio = new Audio('/sound/bayar.mp3');
      audio.play();
    } catch (err) {
      console.error("Audio play failed:", err);
    }
  };

  // Fetch Orders (Last 2 days + any pending)
  useEffect(() => {
    if (!storeId) return;

    // Fetch recent transactions logically using existing index: storeId (ASC), timestamp (DESC)
    const start = new Date();
    start.setDate(start.getDate() - 2); // get last 48 hours to act as active tracker

    const q = query(
      collection(db, 'transactions'), 
      where('storeId', '==', storeId),
      where('timestamp', '>=', start),
      orderBy('timestamp', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(docs);
    });

    // Fetch Settings
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
            paperSize: data.paperSize || '58mm',
            logoUrl: data.logoUrl || '',
            showLogoOnReceipt: data.showLogoOnReceipt !== false,
            showReceiptAddress: data.showReceiptAddress !== false,
            showReceiptPhone: data.showReceiptPhone !== false,
            showReceiptCustomer: data.showReceiptCustomer !== false,
            showReceiptCashier: data.showReceiptCashier !== false,
            showReceiptSubtotal: data.showReceiptSubtotal !== false
          });
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };
    fetchSettings();

    return () => unsubscribe();
  }, [storeId]);

  // --- ANDROID BACK BUTTON SUPPORT ---
  useEffect(() => {
    const isModalOpen = showPaymentModal || showPiutangModal || !!viewingReceipt;
    if (isModalOpen) {
      window.history.pushState({ modal: true }, '');
    }

    const handlePopState = () => {
      if (showPaymentModal) setShowPaymentModal(false);
      if (showPiutangModal) setShowPiutangModal(false);
      if (viewingReceipt) setViewingReceipt(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showPaymentModal, showPiutangModal, !!viewingReceipt]);
  // -----------------------------------

  // Derived Filtered Orders
  const filteredOrders = orders.filter(o => {
    // Only show orders that have an orderStatus, or are pending payment. 
    // We don't want to show random purely direct sales in KDS unless they have orderStatus.
    // If we want direct sales to show, we can just rely on activeTab.
    if (!o.orderStatus && o.paymentStatus === 'paid') return false; // Ignore old un-tracked direct sales
    
    if (activeTab === 'all') {
       return (o.orderStatus !== 'completed' && o.orderStatus !== 'cancelled') || o.paymentStatus === 'pending' || o.paymentStatus === 'unpaid' || o.paymentStatus === 'partially_paid';
    }
    return o.orderStatus === activeTab;
  });

  const handleUpdateStatus = async (order: any, newStatus: string) => {
    // Validasi Urutan Antrian
    if (newStatus === 'processing') {
      const hasPreviousUnconfirmed = orders.some(o => 
        (o.orderStatus === 'new' || !o.orderStatus) && 
        (Number(o.queueNumber) || 0) < (Number(order.queueNumber) || 0) &&
        o.id !== order.id
      );

      if (hasPreviousUnconfirmed) {
        if (!confirm(`Pesanan sebelumnya belum dikonfirmasi. Lanjutkan konfirmasi pesanan ini?`)) {
          return;
        }
      }
    }

    setIsProcessing(order.id);
    try {
      await updateDoc(doc(db, 'transactions', order.id), {
        orderStatus: newStatus,
        lastUpdate: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengupdate status pesanan.');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleCancelOrder = async (order: any) => {
    if (!confirm(`Batalkan pesanan untuk "${order.customerName}"? Stok akan dikembalikan.`)) return;
    
    setIsProcessing(order.id);
    const batch = writeBatch(db);
    
    try {
      const orderRef = doc(db, 'transactions', order.id);
      
      // Instead of DELETE, we update status to cancelled so it appears in the Cancelled tab.
      batch.update(orderRef, {
        orderStatus: 'cancelled',
        paymentStatus: 'cancelled', // also cancel payment intent
        lastUpdate: serverTimestamp()
      });
      
      // Restore Stock
      for (const item of order.items) {
        if (item.productId && item.manageStock !== false) {
          const productRef = doc(db, 'products', item.productId);
          batch.update(productRef, {
            stock: increment(item.qty)
          });
        }
      }
      
      await batch.commit();
    } catch (err) {
      console.error(err);
      toast.error('Gagal membatalkan pesanan.');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleOpenPiutangModal = (order: any) => {
    setSelectedPiutangOrder(order);
    setDownPaymentAmount('');
    setShowPiutangModal(true);
  };

  const confirmPiutang = async () => {
    if (!selectedPiutangOrder) return;
    setIsProcessing(selectedPiutangOrder.id);
    const dp = Number(downPaymentAmount) || 0;
    
    // Check if we are ADDING a payment to an existing debt, or creating a new debt record.
    const isAlreadyDebt = selectedPiutangOrder.paymentCategory === 'debt';
    
    // Calculate new total paid
    const currentPaid = selectedPiutangOrder.paidAmount || 0;
    const newPaid = currentPaid + dp;
    const isFullyPaid = newPaid >= selectedPiutangOrder.total;
    
    const newHistoryEntry = {
      id: Math.random().toString(36).substring(2, 9),
      date: new Date().toISOString(),
      amount: dp,
      cashierName: userName || user?.displayName || (user?.email ? user.email.split('@')[0] : 'Kasir'),
      note: isAlreadyDebt ? 'Cicilan Piutang' : 'Pembayaran Awal / DP'
    };

    const updatedHistory = [...(selectedPiutangOrder.paymentHistory || [])];
    if (dp > 0) {
      updatedHistory.push(newHistoryEntry);
    }

    try {
      await updateDoc(doc(db, 'transactions', selectedPiutangOrder.id), {
        paymentStatus: isFullyPaid ? 'paid' : (newPaid > 0 ? 'partially_paid' : 'unpaid'),
        paymentCategory: 'debt', // keep as debt to mark it had history
        debtAmount: Math.max(0, selectedPiutangOrder.total - newPaid),
        paidAmount: newPaid,
        cashReceived: newPaid, // also update this for compatibility if needed, though we should move away from it
        paymentHistory: updatedHistory,
        lastUpdate: serverTimestamp()
      });
      setShowPiutangModal(false);
      if (isFullyPaid) playSuccessSound();
      toast.success(isFullyPaid ? 'Piutang Berhasil Dilunasi!' : 'Pembayaran Piutang Berhasil Disimpan.');
    } catch (err) {
      console.error(err);
      toast.error('Gagal memproses piutang.');
    } finally {
      setIsProcessing(null);
      setSelectedPiutangOrder(null);
    }
  };

  const handleOpenSettle = (order: any) => {
    setSelectedOrder(order);
    setShowPaymentModal(true);
    setCashReceived('');
  };

  const confirmSettlement = async () => {
    if (!selectedOrder) return;
    
    if (paymentMethod === 'cash' && Number(cashReceived) < selectedOrder.total) {
      toast.error('Uang tunai kurang!');
      return;
    }

    setIsProcessing(selectedOrder.id);
    try {
      const received = paymentMethod === 'cash' ? Number(cashReceived) : selectedOrder.total;
      await updateDoc(doc(db, 'transactions', selectedOrder.id), {
        paymentStatus: 'paid',
        paymentMethod: paymentMethod,
        paymentCategory: 'direct', // Convert to direct since it's fully settled
        paidAmount: selectedOrder.total,
        debtAmount: 0,
        cashReceived: received,
        change: received - selectedOrder.total,
        lastUpdate: serverTimestamp()
      });
      
      setShowPaymentModal(false);
      playSuccessSound();
      toast.success('Pesanan berhasil dilunasi!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal memproses pelunasan.');
    } finally {
      setIsProcessing(null);
      setSelectedOrder(null);
    }
  };

  const change = Number(cashReceived || 0) - (selectedOrder?.total || 0);

  const TABS = [
    { id: 'all', label: 'Semua Aktif' },
    { id: 'new', label: 'Baru' },
    { id: 'processing', label: 'Diproses' },
    { id: 'ready', label: 'Menunggu' },
    { id: 'cancelled', label: 'Dibatalkan' }
  ];

  const getStatusBadge = (order: any) => {
     const status = order.orderStatus || 'new';
     switch(status) {
        case 'new': return <span className="bg-blue-500/10 text-blue-500 px-2 flex items-center justify-center py-0.5 rounded-full text-[10px] font-black uppercase"><ClipboardList size={10} className="mr-1"/> Baru</span>;
        case 'processing': return <span className="bg-amber-500/10 text-amber-500 px-2 flex items-center justify-center py-0.5 rounded-full text-[10px] font-black uppercase"><ChefHat size={10} className="mr-1"/> Diproses</span>;
        case 'ready': 
           const isDelivery = order.deliveryType === 'delivery';
           return (
              <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 flex items-center justify-center rounded-full text-[10px] font-black uppercase">
                 {isDelivery ? <Truck size={10} className="mr-1"/> : <ShoppingBag size={10} className="mr-1"/>}
                 {isDelivery ? 'Siap Dikirim' : 'Menunggu Diambil'}
              </span>
           );
        case 'completed': return <span className="bg-app-text-muted/10 text-app-text-muted px-2 py-0.5 rounded-full text-[10px] font-black uppercase">Selesai</span>;
        case 'cancelled': return <span className="bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full flex items-center justify-center text-[10px] font-black uppercase"><Ban size={10} className="mr-1"/> Dibatalkan</span>;
        default: return null;
     }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 pb-24">
      <div className="flex flex-col mb-6 gap-4 group">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tighter flex items-center gap-3">
            <div className="p-3 bg-accent/20 text-accent rounded-2xl group-hover:scale-110 transition-transform shadow-lg shadow-accent/10">
              <ClipboardList size={28} />
            </div>
            DAFTAR <span className="text-secondary-foreground opacity-50">PESANAN</span>
          </h1>
          <p className="text-app-text-muted mt-1 font-medium italic text-xs uppercase tracking-[0.2em]">Kitchen Display & Fulfillment</p>
        </div>
        
        {/* TABS NAVIGATION */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-app-border/40">
           {TABS.map(tab => (
             <button 
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all ${activeTab === tab.id ? 'bg-accent text-foreground shadow-lg shadow-accent/20' : 'bg-surface text-app-text-muted hover:bg-surface/80 border border-app-border'}`}
             >
               {tab.label}
             </button>
           ))}
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-surface/50 border-2 border-dashed border-app-border rounded-[32px] p-20 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95">
          <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center mb-6 shadow-inner">
             <Package size={32} className="text-app-text-muted opacity-20" />
          </div>
          <p className="text-app-text-muted font-bold uppercase tracking-widest">Tidak Ada Pesanan</p>
          <p className="text-[10px] text-app-text-muted mt-2">Belum ada data pesanan untuk kategori ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredOrders.map((order) => (
            <div 
              key={order.id} 
              className={`bg-surface border transition-all duration-300 rounded-[28px] overflow-hidden animate-in fade-in slide-in-from-bottom-4 ${
                expandedOrderId === order.id ? 'border-accent shadow-2xl shadow-accent/10 ring-1 ring-accent/20' : 'border-app-border hover:border-accent/40'
              }`}
            >
              {/* Main Card row */}
              <div 
                className="p-4 md:p-6 cursor-pointer flex items-center justify-between gap-4"
                onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-background flex items-center justify-center text-accent shadow-inner border border-app-border">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-foreground tracking-tight">{order.customerName}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                       {getStatusBadge(order)}
                       
                       {order.paymentStatus === 'pending' && <span className="bg-rose-500/10 text-rose-500 font-black px-2 py-0.5 rounded-md text-[10px] uppercase">B. Bayar</span>}
                       {order.paymentStatus === 'paid' && <span className="bg-emerald-500/10 text-emerald-500 font-black px-2 py-0.5 rounded-md text-[10px] uppercase">Lunas</span>}
                       
                       <span className={"text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider " + (
                         order.orderType === 'dine-in' ? 'bg-indigo-500/10 text-indigo-500' : 
                         order.orderType === 'online' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                         'bg-orange-500/10 text-orange-500'
                       )}>
                          {order.orderType === 'dine-in' ? 'DINE-IN' : order.orderType === 'online' ? 'ONLINE' : 'TAKEAWAY'}
                       </span>

                       {order.deliveryType && (
                         <span className={"text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 " + (
                           order.deliveryType === 'delivery' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/20' : 'bg-slate-500/10 text-slate-500'
                         )}>
                           {order.deliveryType === 'delivery' ? <><Truck size={10}/> DIKIRIM</> : <><Package size={10}/> AMBIL</>}
                         </span>
                       )}

                       {/* PAYMENT METHOD BADGE FOR ONLINE ORDERS */}
                       {order.orderType === 'online' && order.paymentMethod && (
                          <span className={"text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 " + (
                            order.paymentMethod === 'cash' ? 'bg-emerald-500/10 text-emerald-500' : 
                            order.paymentMethod === 'qris' ? 'bg-cyan-500/10 text-cyan-500' : 'bg-blue-500/10 text-blue-500'
                          )}>
                             {order.paymentMethod === 'cash' ? <Banknote size={10}/> : order.paymentMethod === 'qris' ? <QrCode size={10}/> : <CreditCard size={10}/>}
                             {order.paymentMethod === 'cash' ? 'COD' : order.paymentMethod === 'qris' ? 'QRIS' : 'TRANSFER'}
                          </span>
                       )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 md:gap-6">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] text-app-text-muted font-black uppercase tracking-widest mb-1">
                      <History size={10} className="inline mr-1" />
                      {order.timestamp?.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':')}
                    </p>
                    <p className="text-2xl font-black text-accent tracking-tighter">Rp {order.total.toLocaleString('id-ID')}</p>
                  </div>
                  <div className={`p-2 rounded-xl transition-all ${expandedOrderId === order.id ? 'bg-accent text-foreground' : 'text-app-text-muted'}`}>
                    {expandedOrderId === order.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>
              </div>

              {/* Accordion Detail Panel */}
              {expandedOrderId === order.id && (
                <div className="px-6 pb-6 pt-2 border-t border-app-border bg-background/30 animate-in slide-in-from-top-4 duration-300">
                  <div className="block sm:hidden mb-4 border-b border-app-border pb-4">
                     <p className="text-[10px] text-app-text-muted font-black uppercase tracking-widest mb-1">
                      <History size={10} className="inline mr-1" />
                      Waktu Order: {order.timestamp?.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':')}
                     </p>
                     <p className="text-lg font-black text-accent tracking-tighter">Total: Rp {order.total.toLocaleString('id-ID')}</p>
                  </div>
                  
                  <div className="py-4">
                     <p className="text-[10px] text-app-text-muted font-black uppercase tracking-widest mb-4">Rincian Produk</p>
                     <div className="space-y-2">
                        {order.items.map((item: any, idx: number) => (
                           <div key={idx} className="flex justify-between items-center bg-surface p-3 rounded-2xl border border-app-border">
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center text-xs font-black border border-app-border">
                                    {item.qty}x
                                 </div>
                                 <div className="flex-1">
                                     <p className="text-sm font-black text-foreground">{item.productName}</p>
                                     <div className="flex gap-2">
                                        <p className="text-[10px] text-app-text-muted font-bold">Rp {item.price.toLocaleString('id-ID')}</p>
                                        {item.selectedExtras?.length > 0 && (
                                           <span className="text-[9px] text-app-text-muted bg-background px-1 rounded border border-app-border">
                                             +{item.selectedExtras.map((e:any) => e.optionName).join(', ')}
                                           </span>
                                        )}
                                     </div>
                                     {item.note && <p className="text-[10px] text-amber-500 bg-amber-500/10 w-fit px-2 py-0.5 rounded-lg font-bold italic mt-1">📝 {item.note}</p>}
                                  </div>
                              </div>
                              <p className="text-sm font-black text-fourth-foreground">Rp {item.subtotal.toLocaleString('id-ID')}</p>
                           </div>
                        ))}
                     </div>
                  </div>

                  {/* DELIVERY ADDRESS */}
                  {order.deliveryType === 'delivery' && order.deliveryAddress && (
                    <div className="mt-4 pt-4 border-t border-app-border animate-in fade-in slide-in-from-top-2 duration-300">
                      <p className="text-[10px] text-app-text-muted font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                        <MapPin size={12} className="text-amber-500" /> Alamat Pengiriman
                      </p>
                      <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl space-y-3">
                         <p className="text-sm font-bold text-foreground leading-relaxed">
                            {order.deliveryAddress}
                         </p>
                         <button 
                           onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`, '_blank')}
                           className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                         >
                            <ExternalLink size={14} /> Buka Google Maps
                         </button>
                      </div>
                    </div>
                  )}

                  {/* PAYMENT DETAILS FOR SETTLED ORDERS */}
                  {order.paymentStatus === 'paid' && (
                     <div className="mt-4 pt-4 border-t border-app-border">
                        <p className="text-[10px] text-app-text-muted font-black uppercase tracking-widest mb-3">Rincian Pembayaran</p>
                        <div className="bg-surface/50 p-4 rounded-[20px] border border-app-border space-y-3">
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-app-text-muted uppercase tracking-widest">Metode Bayar</span>
                              <span className="bg-emerald-500/10 text-emerald-500 font-black px-2.5 py-1 rounded-lg text-[10px] uppercase border border-emerald-500/20">
                                 {order.paymentMethod === 'cash' ? 'Tunai' : (order.paymentMethod?.toUpperCase() || 'LUNAS')}
                              </span>
                           </div>
                           
                           {order.paymentMethod === 'cash' && order.cashReceived && (
                              <>
                                 <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-app-text-muted uppercase tracking-widest">Uang Diterima</span>
                                    <span className="text-sm font-black text-app-text-muted">Rp {order.cashReceived.toLocaleString('id-ID')}</span>
                                 </div>
                                 <div className="flex justify-between items-center pt-2 border-t border-app-border/40">
                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Kembalian</span>
                                    <span className="text-xl font-black text-emerald-500 tracking-tighter">Rp {(order.cashReceived - order.total).toLocaleString('id-ID')}</span>
                                 </div>
                              </>
                           )}
                           
                           {!order.cashReceived && order.paymentMethod === 'cash' && (
                              <p className="text-[9px] text-app-text-muted italic">Data tunai tidak tersedia untuk transaksi ini</p>
                           )}
                        </div>
                     </div>
                  )}

                  {order.paymentHistory && order.paymentHistory.length > 0 && (
                     <div className="mt-4 pt-4 border-t border-app-border">
                       <p className="text-[10px] text-app-text-muted font-black uppercase tracking-widest mb-3">Histori Pembayaran</p>
                       <div className="space-y-2">
                         {order.paymentHistory.map((hist: any, idx: number) => (
                           <div key={idx} className="flex justify-between items-center bg-surface p-3 rounded-2xl border border-app-border">
                             <div>
                                <p className="text-xs font-black">{hist.note}</p>
                                <p className="text-[9px] text-app-text-muted mt-0.5 tracking-widest uppercase">{new Date(hist.date).toLocaleString('id-ID', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}</p>
                             </div>
                             <p className="text-sm font-black text-emerald-500">Rp {hist.amount.toLocaleString('id-ID')}</p>
                           </div>
                         ))}
                       </div>
                       <div className="flex justify-between mt-3 px-1">
                          <span className="text-[10px] font-bold text-app-text-muted uppercase tracking-widest">Telah Dibayar</span>
                          <span className="text-sm font-black text-emerald-500">Rp {(order.paidAmount ?? order.cashReceived ?? 0).toLocaleString('id-ID')}</span>
                       </div>
                       <div className="flex justify-between mt-1 px-1">
                          <span className="text-[10px] font-bold text-app-text-muted uppercase tracking-widest">Sisa Piutang</span>
                          <span className="text-lg font-black text-rose-500">Rp {Math.max(0, order.total - (order.paidAmount ?? order.cashReceived ?? 0)).toLocaleString('id-ID')}</span>
                       </div>
                     </div>
                  )}

                  {/* FULFILLMENT ACTIONS */}
                  {order.orderStatus !== 'cancelled' && order.orderStatus !== 'completed' && (
                    <div className="mt-4 pt-4 border-t border-app-border">
                       <p className="text-[10px] text-app-text-muted font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                         Pengerjaan & Komunikasi
                        </p>
                        <div className="flex flex-wrap gap-2">
                           <div className="w-full flex flex-wrap gap-2">
                              {/* WhatsApp Link - Always show if phone exists */}
                              {order.customerPhone && (
                                <button 
                                  onClick={() => openWhatsApp(order.customerPhone, order.customerName)}
                                  className="flex items-center gap-3 px-5 py-3.5 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all mb-2"
                                  style={{ backgroundColor: '#10b981', color: 'white' }}
                                >
                                  <MessageCircle size={18} /> Chat via WhatsApp
                                </button>
                              )}
                            {(!order.orderStatus || order.orderStatus === 'new') && (
                              <button 
                                disabled={!!isProcessing}
                                onClick={() => handleUpdateStatus(order, 'processing')}
                                className="flex items-center gap-2 px-4 py-3 bg-amber-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-amber-500/20"
                              >
                                {isProcessing === order.id ? <Loader2 className="animate-spin" size={14} /> : <ChefHat size={14} />}
                                Terima & Proses
                              </button>
                            )}
                            
                            {order.orderStatus === 'processing' && (
                              <>
                                {isConfirmingReadyOrderId === order.id ? (
                                  <div className="flex items-center gap-2 animate-in zoom-in-95 duration-200">
                                     <button 
                                       onClick={() => {
                                          handleUpdateStatus(order, 'ready');
                                          setIsConfirmingReadyOrderId(null);
                                       }}
                                       className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg"
                                     >
                                        <Check size={16} /> Ya, Siap
                                     </button>
                                     <button 
                                       onClick={() => setIsConfirmingReadyOrderId(null)}
                                       className="flex items-center gap-2 px-6 py-3 bg-rose-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg"
                                     >
                                        <X size={16} /> Batal
                                     </button>
                                  </div>
                                ) : (
                                  <button 
                                    disabled={!!isProcessing}
                                    onClick={() => setIsConfirmingReadyOrderId(order.id)}
                                    className="flex items-center gap-2 px-4 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                                  >
                                    {isProcessing === order.id ? <Loader2 className="animate-spin" size={14} /> : (order.deliveryType === 'delivery' ? <Truck size={14} /> : <ShoppingBag size={14} />)}
                                    {order.deliveryType === 'delivery' ? 'Pesanan Siap Dikirim' : 'Pesanan Siap Diambil'}
                                  </button>
                                )}
                              </>
                            )}

                            {order.orderStatus === 'ready' && (
                              <button 
                                disabled={!!isProcessing || order.paymentStatus !== 'paid'}
                                onClick={() => handleUpdateStatus(order, 'completed')}
                                className="flex items-center gap-2 px-4 py-3 bg-accent text-foreground rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-accent/20 disabled:opacity-50 disabled:grayscale"
                              >
                                {isProcessing === order.id ? <Loader2 className="animate-spin" size={14} /> : (
                                  order.paymentStatus !== 'paid' ? <Ban size={14} /> : <CheckCircle2 size={14} />
                                )}
                                {order.paymentStatus !== 'paid' ? 'Lengkapi Pembayaran' : 'Selesaikan Pesanan'}
                              </button>
                            )}
                          </div>
                       </div>
                    </div>
                  )}

                  {/* PAYMENT & OTHER ACTIONS */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-app-border">
                     {order.paymentStatus === 'pending' && order.orderStatus === 'ready' && (
                        <>
                          <button 
                            disabled={!!isProcessing}
                            onClick={() => handleOpenSettle(order)}
                            className="flex items-center justify-center gap-2 py-3 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                          >
                            <Banknote size={14} /> Bayar Kasir
                          </button>

                          <button 
                            disabled={!!isProcessing}
                            onClick={() => handleOpenPiutangModal(order)}
                            className="flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                          >
                            <CreditCard size={14} /> Bayar Piutang
                          </button>
                        </>
                     )}

                     {(order.paymentStatus === 'unpaid' || order.paymentStatus === 'partially_paid') && order.paymentCategory === 'debt' && (
                         <button 
                           disabled={!!isProcessing}
                           onClick={() => handleOpenPiutangModal(order)}
                           className="flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 md:col-span-2 col-span-2"
                         >
                           <CreditCard size={14} /> Cicil / Lunas Piutang
                         </button>
                     )}

                     <button 
                       disabled={!!isProcessing}
                       onClick={() => setViewingReceipt(order)}
                       className="flex items-center justify-center gap-2 py-3 bg-surface border border-app-border text-foreground rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-accent transition-all disabled:opacity-50"
                     >
                       <Printer size={14} /> Cetak Struk
                     </button>

                     {order.orderStatus !== 'cancelled' && (
                       <button 
                         disabled={!!isProcessing}
                         onClick={() => handleCancelOrder(order)}
                         className="flex items-center justify-center gap-2 py-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50"
                       >
                         <Trash2 size={14} /> Batalkan
                       </button>
                     )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* SETTLEMENT MODAL */}
      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="bg-surface w-full max-w-md rounded-[40px] border border-app-border p-8 shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-6">
                 <div>
                    <h2 className="text-2xl font-black text-foreground tracking-tighter">PELUNASAN KASIR</h2>
                    <p className="text-[10px] text-app-text-muted font-bold uppercase tracking-widest mt-1">Customer: <span className="text-accent">{selectedOrder.customerName}</span></p>
                 </div>
                 <button onClick={() => setShowPaymentModal(false)} className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-app-text-muted hover:text-foreground hover:bg-rose-500 transition-all">
                    <X size={20} />
                 </button>
              </div>

              <div className="mb-6 p-6 bg-background rounded-[32px] border border-app-border flex justify-between items-center group">
                 <span className="text-xs font-black text-app-text-muted uppercase">Total Bayar</span>
                 <span className="text-3xl font-black text-accent tracking-tighter group-hover:scale-105 transition-transform">Rp {selectedOrder.total.toLocaleString('id-ID')}</span>
              </div>

              {/* Method Selection */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                {['cash', 'qris', 'transfer'].map((m) => (
                  <button 
                    key={m}
                    onClick={() => setPaymentMethod(m as any)}
                    className={`py-3 rounded-2xl text-[10px] font-black uppercase transition-all border ${
                      paymentMethod === m 
                      ? 'bg-accent border-accent text-foreground shadow-lg' 
                      : 'bg-surface border-app-border text-app-text-muted hover:border-accent'
                    }`}
                  >
                    {m === 'cash' ? 'Tunai' : m.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Cash Input */}
              {paymentMethod === 'cash' && (
                <div className="mb-6 space-y-3 animate-in slide-in-from-bottom-2">
                   {/* SUGGESTIONS BUTTONS */}
                   <div className="flex flex-wrap gap-2">
                     {[selectedOrder.total, 2000, 5000, 10000, 20000, 50000, 100000]
                       .filter((d, i, self) => d >= selectedOrder.total && self.indexOf(d) === i)
                       .sort((a, b) => a - b)
                       .slice(0, 4)
                       .map(val => (
                         <button
                           key={val}
                           onClick={() => setCashReceived(val.toString())}
                           className={`px-3 py-2 rounded-xl text-[10px] font-black border transition-all ${Number(cashReceived) === val ? 'bg-accent border-accent text-foreground shadow-lg shadow-accent/20' : 'bg-surface border-app-border text-app-text-muted hover:border-accent'}`}
                         >
                           {val === selectedOrder.total ? 'UANG PAS' : val.toLocaleString('id-ID')}
                         </button>
                       ))
                     }
                   </div>
                   <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-app-text-muted font-black text-xs">Rp</div>
                      <input 
                        type="number"
                        autoFocus
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        placeholder="Nominal Tunai..."
                        className="w-full pl-12 pr-4 py-5 bg-background border border-app-border rounded-3xl font-black text-lg text-foreground focus:border-accent focus:outline-none transition-all shadow-inner"
                      />
                   </div>
                   {Number(cashReceived) > 0 && (
                      <div className="flex justify-between p-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                        <span className="text-[10px] font-black text-app-text-muted tracking-widest uppercase">KEMBALIAN</span>
                        <span className={`text-sm font-black ${change < 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                           {change < 0 ? 'UANG KURANG!' : `Rp ${change.toLocaleString('id-ID')}`}
                        </span>
                      </div>
                   )}
                </div>
              )}

              <button 
                disabled={isProcessing === selectedOrder.id || (paymentMethod === 'cash' && Number(cashReceived || 0) < selectedOrder.total)}
                onClick={confirmSettlement}
                className="w-full h-16 bg-accent text-foreground rounded-[24px] font-black shadow-xl shadow-accent/30 flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale transition-all active:scale-95"
              >
                {isProcessing === selectedOrder.id ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={24} /> LUNASKAN PESANAN</>}
              </button>
           </div>
        </div>
      )}

      {/* PIUTANG MODAL */}
      {showPiutangModal && selectedPiutangOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="bg-surface w-full max-w-md rounded-[40px] border border-app-border p-8 shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-6">
                 <div>
                    <h2 className="text-2xl font-black text-foreground tracking-tighter">BAYAR PIUTANG</h2>
                    <p className="text-[10px] text-app-text-muted font-bold uppercase tracking-widest mt-1">Customer: <span className="text-accent">{selectedPiutangOrder.customerName}</span></p>
                 </div>
                 <button onClick={() => setShowPiutangModal(false)} className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-app-text-muted hover:text-foreground hover:bg-rose-500 transition-all">
                    <X size={20} />
                 </button>
              </div>

              <div className="mb-6 p-6 bg-accent/5 rounded-[32px] border border-accent/10 flex justify-between items-center">
                 <span className="text-xs font-black text-app-text-muted uppercase max-w-[100px] leading-tight">Sisa Piutang</span>
                 <span className="text-3xl font-black text-accent tracking-tighter">Rp {Math.max(0, selectedPiutangOrder.total - (selectedPiutangOrder.paidAmount || 0)).toLocaleString('id-ID')}</span>
              </div>

              <div className="mb-6 space-y-3 animate-in slide-in-from-bottom-2">
                 <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-app-text-muted font-black text-xs">Rp</div>
                    <input 
                      type="number"
                      autoFocus
                      value={downPaymentAmount}
                      onChange={(e) => setDownPaymentAmount(e.target.value)}
                      placeholder="Nominal Cicilan / DP..."
                      className="w-full pl-12 pr-4 py-5 bg-background border border-app-border rounded-3xl font-black text-lg text-foreground focus:border-accent focus:outline-none transition-all shadow-inner"
                    />
                 </div>
                 <div className="flex flex-wrap gap-2 mt-2">
                   {[Math.max(0, selectedPiutangOrder.total - (selectedPiutangOrder.paidAmount || 0)), 50000, 100000, 500000]
                     .filter((d, i, self) => d > 0 && self.indexOf(d) === i)
                     .sort((a, b) => a - b)
                     .slice(0, 4)
                     .map(val => (
                       <button
                         key={val}
                         onClick={() => setDownPaymentAmount(val.toString())}
                         className={`px-3 py-2 rounded-xl text-[10px] font-black border transition-all ${Number(downPaymentAmount) === val ? 'bg-accent border-accent text-foreground shadow-lg shadow-accent/20' : 'bg-surface border-app-border text-app-text-muted hover:border-accent'}`}
                       >
                         {val === Math.max(0, selectedPiutangOrder.total - (selectedPiutangOrder.paidAmount || 0)) ? 'LUNASI SEMUA' : val.toLocaleString('id-ID')}
                       </button>
                     ))
                   }
                 </div>
              </div>

              <button 
                disabled={isProcessing === selectedPiutangOrder.id}
                onClick={confirmPiutang}
                className="w-full h-16 bg-blue-500 hover:bg-blue-600 text-white rounded-[24px] font-black shadow-xl shadow-blue-500/30 flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale transition-all active:scale-95"
              >
                {isProcessing === selectedPiutangOrder.id ? <Loader2 className="animate-spin" /> : <><CreditCard size={24} /> SIMPAN PEMBAYARAN</>}
              </button>
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
                      <div className="flex justify-between"><span>Pelanggan</span><span className="font-bold text-slate-900">{viewingReceipt.customerName}</span></div>
                    )}
                    {storeSettings?.showReceiptCashier !== false && (
                      <div className="flex justify-between"><span>Kasir</span><span className="font-bold text-slate-900">{viewingReceipt.cashierName || 'Online'}</span></div>
                    )}
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
                    {storeSettings?.showReceiptSubtotal !== false && (
                      <div className="flex justify-between text-slate-600"><span>SUBTOTAL</span><span className="font-bold text-slate-900">Rp {(viewingReceipt.subtotal || 0).toLocaleString('id-ID')}</span></div>
                    )}
                    {viewingReceipt.tax > 0 && (
                      <div className="flex justify-between text-slate-600"><span>PAJAK (PPN)</span><span className="font-bold text-slate-900">Rp {(viewingReceipt.tax || 0).toLocaleString('id-ID')}</span></div>
                    )}
                    {viewingReceipt.deliveryFee > 0 && (
                      <div className="flex justify-between text-slate-600"><span>ONGKOS KIRIM</span><span className="font-bold text-slate-900">Rp {(viewingReceipt.deliveryFee || 0).toLocaleString('id-ID')}</span></div>
                    )}
                    <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                       <span>TOTAL</span>
                       <span>Rp {(viewingReceipt.total || 0).toLocaleString('id-ID')}</span>
                    </div>
                    {(viewingReceipt.paymentStatus === 'paid' || viewingReceipt.paymentStatus === 'partially_paid' || viewingReceipt.paymentCategory === 'debt') && (
                      <>
                        {(viewingReceipt.paymentHistory && viewingReceipt.paymentHistory.length > 0) ? (
                          <div className="space-y-4">
                            <div className="space-y-1.5">
                               {(viewingReceipt.paymentHistory || []).map((hist: any, hIdx: number) => (
                                 <div key={hIdx} className="flex justify-between text-[10px] text-slate-500">
                                    <div className="flex gap-2">
                                       <span className="font-bold text-slate-400">{new Date(hist.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}</span>
                                       <span>{hist.note || 'Pembayaran'}</span>
                                    </div>
                                    <span className="font-black text-slate-900">Rp {hist.amount?.toLocaleString('id-ID')}</span>
                                 </div>
                               ))}
                            </div>
                            <div className="flex justify-between text-xs font-black text-emerald-600 pt-2 border-t border-slate-100">
                               <span className="uppercase tracking-widest text-[9px]">Total Dibayar</span>
                               <span>Rp {(viewingReceipt.paidAmount ?? viewingReceipt.cashReceived ?? 0).toLocaleString('id-ID')}</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between text-slate-600">
                               <span>{viewingReceipt.cashReceived ? 'UANG DITERIMA' : 'DIBAYAR'}</span>
                               <span className="font-bold text-slate-900">Rp {(viewingReceipt.cashReceived || viewingReceipt.paidAmount || viewingReceipt.total).toLocaleString('id-ID')}</span>
                            </div>
                            {(viewingReceipt.change || 0) > 0 && (
                              <div className="flex justify-between text-emerald-500 font-bold"><span>KEMBALIAN</span><span className="font-black">Rp {(viewingReceipt.change || 0).toLocaleString('id-ID')}</span></div>
                            )}
                          </>
                        )}
                        
                        {((viewingReceipt.total - (viewingReceipt.paidAmount ?? viewingReceipt.cashReceived ?? 0)) > 0) && (
                          <div className="flex justify-between text-rose-500 font-black pt-2 border-t border-slate-100">
                            <span className="uppercase tracking-widest text-[9px]">Sisa Piutang</span>
                            <span className="text-sm">Rp {(viewingReceipt.total - (viewingReceipt.paidAmount ?? viewingReceipt.cashReceived ?? 0)).toLocaleString('id-ID')}</span>
                          </div>
                        )}
                      </>
                    )}
                 </div>

                 {/* Footer */}
                 <div className="text-center space-y-2 pt-4 opacity-50">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-900">Terima Kasih</p>
                    <p className="text-[8px] italic whitespace-pre-line leading-relaxed">{storeSettings?.receiptMessage || 'Terima kasih atas pesanan Anda!'}</p>
                 </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
                 <button 
                   onClick={() => {
                       printReceipt(viewingReceipt, storeSettings, branding);
                       setViewingReceipt(null);
                   }} 
                   className="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-slate-900/10 active:scale-95 transition-all flex items-center justify-center gap-2"
                 >
                    <Printer size={16} /> CETAK KE PRINTER / SHARE
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
    </div>
  );
}
