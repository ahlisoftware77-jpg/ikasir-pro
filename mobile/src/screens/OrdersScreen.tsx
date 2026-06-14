import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Linking, RefreshControl, Vibration, Pressable, Image } from 'react-native';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, writeBatch, increment, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../context/ThemeContext';
import { printReceipt } from '../utils/ReceiptHelper';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingSkeleton from '../components/LoadingSkeleton';
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
  MessageCircle, 
  MapPin, 
  Truck, 
  ChefHat, 
  ShoppingBag, 
  Ban, 
  Banknote, 
  Check, 
  ExternalLink 
} from 'lucide-react-native';

export default function OrdersScreen() {
  const { colors } = useTheme();
  const { storeId, user } = useAuthStore();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  
  // Tabs State
  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'processing' | 'ready' | 'cancelled'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setRefreshing(false);
  };

  // Modals States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'transfer'>('cash');
  const [cashReceived, setCashReceived] = useState('');

  const [showPiutangModal, setShowPiutangModal] = useState(false);
  const [selectedPiutangOrder, setSelectedPiutangOrder] = useState<any>(null);
  const [downPaymentAmount, setDownPaymentAmount] = useState('');

  const [storeSettings, setStoreSettings] = useState({ 
    storeName: 'Kasir Pro Store', 
    phone: '', 
    address: '' 
  });

  // Fetch orders (Last 48 hours + any active pending/ready orders)
  useEffect(() => {
    if (!storeId) return;

    const start = new Date();
    start.setDate(start.getDate() - 2); // Get active orders within last 48 hours

    const q = query(
      collection(db, 'transactions'),
      where('storeId', '==', storeId),
      where('timestamp', '>=', start),
      orderBy('timestamp', 'desc')
    );

    setLoading(true);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: any[] = [];
      snapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      setOrders(docs);
      setLoading(false);
    }, (err) => {
      console.error("Error loading KDS orders:", err);
      setLoading(false);
    });

    // Fetch Store settings
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', `store_${storeId}`));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStoreSettings({
            storeName: data.storeName || 'Kasir Pro Store',
            phone: data.phone || '',
            address: data.address || ''
          });
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };
    
    fetchSettings();

    return () => unsubscribe();
  }, [storeId]);

  // Derived filter
  const filteredOrders = orders.filter((o) => {
    // Only display online orders or orders with orderStatus, ignore direct offline sales that are paid
    if (!o.orderStatus && o.paymentStatus === 'paid') return false;

    if (activeTab === 'all') {
      return (
        (o.orderStatus !== 'completed' && o.orderStatus !== 'cancelled') ||
        o.paymentStatus === 'pending' ||
        o.paymentStatus === 'unpaid' ||
        o.paymentStatus === 'partially_paid'
      );
    }
    return o.orderStatus === activeTab;
  });

  const handleUpdateStatus = async (order: any, newStatus: string) => {
    // Validate order queue progression warning
    if (newStatus === 'processing') {
      const hasPreviousUnconfirmed = orders.some(o => 
        (o.orderStatus === 'new' || !o.orderStatus) && 
        (Number(o.queueNumber) || 0) < (Number(order.queueNumber) || 0) &&
        o.id !== order.id
      );

      if (hasPreviousUnconfirmed) {
        Alert.alert(
          'Antrean Belum Siap',
          'Pesanan sebelumnya belum dikonfirmasi. Ingin tetap mendahului dan mengonfirmasi pesanan ini?',
          [
            { text: 'Batal', style: 'cancel' },
            { text: 'Lanjutkan', onPress: () => processStatusUpdate(order.id, newStatus) }
          ]
        );
        return;
      }
    }

    processStatusUpdate(order.id, newStatus);
  };

  const processStatusUpdate = async (orderId: string, newStatus: string) => {
    setIsProcessing(orderId);
    try {
      await updateDoc(doc(db, 'transactions', orderId), {
        orderStatus: newStatus,
        lastUpdate: serverTimestamp()
      });
      Vibration.vibrate(15);
      Alert.alert('Sukses', `Status pesanan berhasil diperbarui menjadi ${newStatus === 'processing' ? 'Diproses' : newStatus === 'ready' ? 'Siap' : 'Selesai'}.`);
    } catch (err) {
      console.error("Error updating status:", err);
      Alert.alert('Gagal', 'Gagal memperbarui status pesanan.');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleCancelOrder = async (order: any) => {
    Alert.alert(
      'Batalkan Pesanan',
      `Yakin ingin membatalkan pesanan milik "${order.customerName}"? Stok barang akan dikembalikan ke inventaris.`,
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Batalkan', 
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(order.id);
            const batch = writeBatch(db);
            try {
              const orderRef = doc(db, 'transactions', order.id);
              batch.update(orderRef, {
                orderStatus: 'cancelled',
                paymentStatus: 'cancelled',
                lastUpdate: serverTimestamp()
              });

              // Restore Stock
              for (const item of order.items) {
                if (item.productId && item.manageStock !== false) {
                  const productRef = doc(db, 'products', item.productId);
                  batch.update(productRef, {
                    stock: increment(item.qty || 0)
                  });
                }
              }

              await batch.commit();
              Alert.alert('Dibatalkan', 'Pesanan berhasil dibatalkan dan stok dikembalikan.');
            } catch (err) {
              console.error(err);
              Alert.alert('Gagal', 'Gagal membatalkan pesanan.');
            } finally {
              setIsProcessing(null);
            }
          }
        }
      ]
    );
  };

  const openWhatsApp = (phone: string, name: string) => {
    if (!phone) return;
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    } else if (!cleaned.startsWith('62')) {
      cleaned = '62' + cleaned;
    }
    const message = `Halo ${name}, pesanan Anda dari ${storeSettings.storeName} sudah siap. Terima kasih!`;
    const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Gagal membuka aplikasi WhatsApp.');
    });
  };

  const openMaps = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Gagal membuka aplikasi Google Maps.');
    });
  };

  const handleOpenSettle = (order: any) => {
    setSelectedOrder(order);
    setCashReceived('');
    setPaymentMethod('cash');
    setShowPaymentModal(true);
  };

  const confirmSettlement = async () => {
    if (!selectedOrder) return;
    
    if (paymentMethod === 'cash' && Number(cashReceived) < selectedOrder.total) {
      Alert.alert('Gagal', 'Uang tunai yang diterima kurang!');
      return;
    }

    setIsProcessing(selectedOrder.id);
    try {
      const received = paymentMethod === 'cash' ? Number(cashReceived) : selectedOrder.total;
      await updateDoc(doc(db, 'transactions', selectedOrder.id), {
        paymentStatus: 'paid',
        paymentMethod: paymentMethod,
        paymentCategory: 'direct',
        paidAmount: selectedOrder.total,
        debtAmount: 0,
        cashReceived: received,
        change: received - selectedOrder.total,
        lastUpdate: serverTimestamp()
      });
      
      Vibration.vibrate([0, 15, 80, 15]);
      setShowPaymentModal(false);
      Alert.alert('Sukses', 'Pesanan berhasil dilunasi!');
    } catch (err) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal memproses pelunasan pembayaran.');
    } finally {
      setIsProcessing(null);
      setSelectedOrder(null);
    }
  };

  const handleOpenPiutang = (order: any) => {
    setSelectedPiutangOrder(order);
    setDownPaymentAmount('');
    setShowPiutangModal(true);
  };

  const confirmPiutang = async () => {
    if (!selectedPiutangOrder) return;

    setIsProcessing(selectedPiutangOrder.id);
    const dp = Number(downPaymentAmount) || 0;
    
    const isAlreadyDebt = selectedPiutangOrder.paymentCategory === 'debt';
    const currentPaid = selectedPiutangOrder.paidAmount || 0;
    const newPaid = currentPaid + dp;
    const isFullyPaid = newPaid >= selectedPiutangOrder.total;
    
    const newHistoryEntry = {
      id: Math.random().toString(36).substring(2, 9),
      date: new Date().toISOString(),
      amount: dp,
      cashierName: user?.name || user?.displayName || 'Kasir',
      note: isAlreadyDebt ? 'Cicilan Piutang' : 'Pembayaran Awal / DP'
    };

    const updatedHistory = [...(selectedPiutangOrder.paymentHistory || [])];
    if (dp > 0) {
      updatedHistory.push(newHistoryEntry);
    }

    try {
      await updateDoc(doc(db, 'transactions', selectedPiutangOrder.id), {
        paymentStatus: isFullyPaid ? 'paid' : (newPaid > 0 ? 'partially_paid' : 'unpaid'),
        paymentCategory: 'debt',
        debtAmount: Math.max(0, selectedPiutangOrder.total - newPaid),
        paidAmount: newPaid,
        cashReceived: newPaid,
        paymentHistory: updatedHistory,
        lastUpdate: serverTimestamp()
      });
      
      Vibration.vibrate([0, 15, 80, 15]);
      setShowPiutangModal(false);
      Alert.alert('Sukses', isFullyPaid ? 'Piutang Berhasil Dilunasi!' : 'Pembayaran Piutang Berhasil Disimpan.');
    } catch (err) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal memproses transaksi piutang.');
    } finally {
      setIsProcessing(null);
      setSelectedPiutangOrder(null);
    }
  };

  const getStatusBadge = (order: any) => {
    const status = order.orderStatus || 'new';
    switch(status) {
      case 'new': 
        return (
          <View className="bg-blue-500/10 px-2 py-0.5 rounded-full flex-row items-center border border-blue-500/20">
            <ClipboardList size={10} color="#3b82f6" className="mr-1"/>
            <Text className="text-[9px] font-black text-blue-500 uppercase">Baru</Text>
          </View>
        );
      case 'processing': 
        return (
          <View className="bg-amber-500/10 px-2 py-0.5 rounded-full flex-row items-center border border-amber-500/20">
            <ChefHat size={10} color="#f59e0b" className="mr-1"/>
            <Text className="text-[9px] font-black text-amber-500 uppercase">Proses</Text>
          </View>
        );
      case 'ready': 
        const isDelivery = order.deliveryType === 'delivery';
        return (
          <View className="bg-emerald-500/10 px-2 py-0.5 rounded-full flex-row items-center border border-emerald-500/20">
            {isDelivery ? <Truck size={10} color="#10b981"/> : <ShoppingBag size={10} color="#10b981"/>}
            <Text className="text-[9px] font-black text-emerald-500 uppercase ml-1">
              {isDelivery ? 'Siap Kirim' : 'Siap Ambil'}
            </Text>
          </View>
        );
      case 'completed': 
        return (
          <View className="bg-slate-500/10 px-2 py-0.5 rounded-full">
            <Text className="text-[9px] font-black text-slate-400 uppercase">Selesai</Text>
          </View>
        );
      case 'cancelled': 
        return (
          <View className="bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
            <Text className="text-[9px] font-black text-rose-500 uppercase">Batal</Text>
          </View>
        );
      default: 
        return null;
    }
  };

  const tabs = [
    { id: 'all', label: 'Semua' },
    { id: 'new', label: 'Baru' },
    { id: 'processing', label: 'Proses' },
    { id: 'ready', label: 'Siap' },
    { id: 'cancelled', label: 'Batal' }
  ];

  return (
    <SafeAreaView className="flex-1" edges={['bottom']} style={{ backgroundColor: colors.bg }}>
      
      {/* Tabs Filter Header */}
      <View className="p-4 border-b" style={{ borderColor: colors.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id as any)}
              className="px-4 py-2.5 rounded-2xl border"
              style={{
                backgroundColor: activeTab === tab.id ? colors.accent : colors.surface,
                borderColor: activeTab === tab.id ? colors.accent : colors.border
              }}
            >
              <Text 
                className="text-[10px] font-black uppercase tracking-wider" 
                style={{ color: activeTab === tab.id ? '#ffffff' : colors.textMuted }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Orders List */}
      {loading ? (
        <LoadingSkeleton type="list" count={4} />
      ) : (
        <ScrollView 
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.accent]}
              tintColor={colors.accent}
            />
          }
        >
        {filteredOrders.length === 0 ? (
          <View className="items-center py-24 opacity-40">
            <Package size={50} color={colors.textMuted} />
            <Text className="text-xs font-black uppercase mt-4 tracking-widest" style={{ color: colors.textMuted }}>
              Tidak ada pesanan aktif
            </Text>
          </View>
        ) : (
          <View className="flex gap-4">
            {filteredOrders.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              const formattedTime = order.timestamp?.seconds 
                ? new Date(order.timestamp.seconds * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':')
                : new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');

              return (
                <View 
                  key={order.id} 
                  className="rounded-[28px] border overflow-hidden"
                  style={{ 
                    backgroundColor: colors.surface, 
                    borderColor: isExpanded ? colors.accent : colors.border 
                  }}
                >
                  {/* Card Header Tap Area */}
                  <TouchableOpacity
                    onPress={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    activeOpacity={0.9}
                    className="p-5 flex-row justify-between items-center"
                  >
                    <View className="flex-1 pr-4">
                      <View className="flex-row items-center gap-2 flex-wrap">
                        <Text className="text-base font-black" style={{ color: colors.text }}>
                          {order.customerName || 'Pelanggan'}
                        </Text>
                        <Text className="text-[10px] font-black text-rose-500">
                          #{order.queueNumber || '0'}
                        </Text>
                      </View>

                      <View className="flex-row items-center gap-2 mt-2 flex-wrap">
                        {getStatusBadge(order)}
                        
                        <View className="bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                          <Text className="text-[9px] font-black text-indigo-500 uppercase">
                            {order.orderType === 'dine-in' ? 'Dine In' : order.orderType === 'online' ? 'Online' : 'Takeaway'}
                          </Text>
                        </View>

                        <View 
                          className="px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: order.paymentStatus === 'paid' ? '#10b98120' : '#ef444420' }}
                        >
                          <Text 
                            className="text-[9px] font-black uppercase" 
                            style={{ color: order.paymentStatus === 'paid' ? '#10b981' : '#ef4444' }}
                          >
                            {order.paymentStatus === 'paid' ? 'Lunas' : 'Belum Lunas'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View className="items-end">
                      <Text className="text-[10px] font-bold" style={{ color: colors.textMuted }}>
                        {formattedTime}
                      </Text>
                      <Text className="text-base font-black text-emerald-500 mt-1">
                        Rp {order.total?.toLocaleString('id-ID')}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Accordion Area */}
                  {isExpanded && (
                    <View className="px-5 pb-5 border-t pt-4" style={{ borderColor: colors.border, backgroundColor: colors.bg + '10' }}>
                      
                      {/* Products List */}
                      <Text className="text-[10px] font-black uppercase tracking-wider mb-2.5" style={{ color: colors.textMuted }}>
                        Daftar Pembelian:
                      </Text>
                      <View className="flex gap-2 mb-4">
                        {order.items?.map((item: any, idx: number) => (
                          <View 
                            key={idx} 
                            className="p-3 rounded-2xl border flex-row justify-between items-center"
                            style={{ backgroundColor: colors.bg + '50', borderColor: colors.border }}
                          >
                            <View className="flex-1 pr-4">
                              <Text className="text-xs font-black" style={{ color: colors.text }}>
                                {item.productName || item.name}
                              </Text>
                              <Text className="text-[10px] font-bold mt-0.5" style={{ color: colors.textMuted }}>
                                {item.qty}x @ Rp {item.price?.toLocaleString('id-ID')}
                              </Text>
                              {item.selectedExtras?.length > 0 && (
                                <Text className="text-[8px] font-bold text-accent mt-1">
                                  + {item.selectedExtras.map((e: any) => e.optionName).join(', ')}
                                </Text>
                              )}
                              {item.note ? (
                                <Text className="text-[9px] font-bold italic text-amber-500 mt-1">
                                  📝 {item.note}
                                </Text>
                              ) : null}
                            </View>
                            <Text className="text-xs font-black text-slate-300">
                              Rp {item.subtotal?.toLocaleString('id-ID')}
                            </Text>
                          </View>
                        ))}
                      </View>

                      {/* Delivery Address */}
                      {order.deliveryType === 'delivery' && order.deliveryAddress && (
                        <View className="mb-4 p-4 rounded-2xl border bg-amber-500/5 border-amber-500/20">
                          <Text className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1.5 flex-row items-center">
                            <MapPin size={10} color="#f59e0b" /> Alamat Pengiriman:
                          </Text>
                          <Text className="text-xs font-bold leading-normal mb-3" style={{ color: colors.text }}>
                            {order.deliveryAddress}
                          </Text>
                          <TouchableOpacity 
                            onPress={() => openMaps(order.deliveryAddress)}
                            className="bg-amber-500 px-4 py-2 rounded-xl flex-row items-center gap-1.5 w-fit"
                          >
                            <ExternalLink size={12} color="white" />
                            <Text className="text-[9px] font-black text-white uppercase tracking-wider">BUKA GOOGLE MAPS</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Payments list history */}
                      {order.paymentHistory && order.paymentHistory.length > 0 && (
                        <View className="mb-4">
                          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Riwayat Cicilan Piutang:</Text>
                          <View className="flex gap-2">
                            {order.paymentHistory.map((hist: any, idx: number) => (
                              <View 
                                key={idx} 
                                className="p-3 rounded-2xl border flex-row justify-between items-center bg-black/10"
                                style={{ borderColor: colors.border }}
                              >
                                <View>
                                  <Text className="text-xs font-bold" style={{ color: colors.text }}>{hist.note}</Text>
                                  <Text className="text-[8px] font-bold mt-0.5" style={{ color: colors.textMuted }}>
                                    {new Date(hist.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </Text>
                                </View>
                                <Text className="text-xs font-black text-emerald-500">Rp {hist.amount?.toLocaleString('id-ID')}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                      {/* Payment Proof Image Preview */}
                      {order.paymentProofUrl ? (
                        <View className="mb-4">
                          <Text className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>Bukti Pembayaran (Transfer/E-Wallet):</Text>
                          <TouchableOpacity 
                            onPress={() => Linking.openURL(order.paymentProofUrl).catch(() => Alert.alert('Error', 'Gagal membuka link bukti pembayaran.'))}
                            activeOpacity={0.8}
                            className="rounded-2xl overflow-hidden border bg-black/10"
                            style={{ borderColor: colors.border, width: 120, height: 160 }}
                          >
                            <Image source={{ uri: order.paymentProofUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            <View className="absolute bottom-0 left-0 right-0 bg-black/60 py-1.5">
                              <Text className="text-[8px] font-black text-white text-center uppercase tracking-widest">Buka Gambar</Text>
                            </View>
                          </TouchableOpacity>
                        </View>
                      ) : null}

                      {/* Fulfillment Actions */}
                      {order.orderStatus !== 'completed' && order.orderStatus !== 'cancelled' && (
                        <View className="border-t pt-4 flex gap-2" style={{ borderColor: colors.border }}>
                          
                          {/* Comm buttons */}
                          {order.customerPhone && (
                            <TouchableOpacity 
                              onPress={() => openWhatsApp(order.customerPhone, order.customerName)}
                              className="bg-emerald-500 h-12 rounded-xl items-center justify-center flex-row gap-2"
                            >
                              <MessageCircle size={16} color="white" />
                              <Text className="text-xs font-black text-white">CHAT WHATSAPP</Text>
                            </TouchableOpacity>
                          )}

                          <View className="flex-row gap-2">
                            {(!order.orderStatus || order.orderStatus === 'new') && (
                              <TouchableOpacity 
                                onPress={() => handleUpdateStatus(order, 'processing')}
                                className="flex-1 bg-amber-500 h-12 rounded-xl items-center justify-center flex-row gap-1.5"
                              >
                                <ChefHat size={16} color="white" />
                                <Text className="text-xs font-black text-white">TERIMA & PROSES</Text>
                              </TouchableOpacity>
                            )}

                            {order.orderStatus === 'processing' && (
                              <TouchableOpacity 
                                onPress={() => handleUpdateStatus(order, 'ready')}
                                className="flex-1 bg-emerald-500 h-12 rounded-xl items-center justify-center flex-row gap-1.5"
                              >
                                {order.deliveryType === 'delivery' ? <Truck size={16} color="white" /> : <ShoppingBag size={16} color="white" />}
                                <Text className="text-xs font-black text-white">PESANAN SIAP</Text>
                              </TouchableOpacity>
                            )}

                            {order.orderStatus === 'ready' && order.paymentStatus === 'paid' && (
                              <TouchableOpacity 
                                onPress={() => handleUpdateStatus(order, 'completed')}
                                className="flex-1 bg-blue-500 h-12 rounded-xl items-center justify-center flex-row gap-1.5"
                              >
                                <CheckCircle2 size={16} color="white" />
            <Text className="text-xs font-black text-white">SELESAIKAN ORDER</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      )}

                      {/* Cashier Payments Actions */}
                      <View className="border-t pt-4 mt-2 flex-row gap-2" style={{ borderColor: colors.border }}>
                        
                        {order.paymentStatus !== 'paid' && (
                          <>
                            <TouchableOpacity
                              onPress={() => handleOpenSettle(order)}
                              className="flex-1 bg-emerald-600 h-12 rounded-xl items-center justify-center flex-row gap-1 px-1"
                            >
                              <Banknote size={14} color="white" />
                              <Text className="text-[9px] font-black text-white text-center" adjustsFontSizeToFit numberOfLines={1}>BAYAR</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => handleOpenPiutang(order)}
                              className="flex-1 bg-blue-600 h-12 rounded-xl items-center justify-center flex-row gap-1 px-1"
                            >
                              <CreditCard size={14} color="white" />
                              <Text className="text-[9px] font-black text-white text-center" adjustsFontSizeToFit numberOfLines={1}>PIUTANG</Text>
                            </TouchableOpacity>
                          </>
                        )}

                        <TouchableOpacity
                          onPress={() => printReceipt(order, storeSettings)}
                          className="flex-1 bg-slate-800 border h-12 rounded-xl items-center justify-center flex-row gap-1 px-1"
                          style={{ borderColor: colors.border }}
                        >
                          <Printer size={14} color="white" />
                          <Text className="text-[9px] font-black text-white text-center" adjustsFontSizeToFit numberOfLines={1}>CETAK</Text>
                        </TouchableOpacity>

                        {order.orderStatus !== 'cancelled' && (
                          <TouchableOpacity
                            onPress={() => handleCancelOrder(order)}
                            className="bg-rose-500/10 w-12 h-12 rounded-xl items-center justify-center border border-rose-500/30"
                          >
                            <Trash2 size={16} color="#f43f5e" />
                          </TouchableOpacity>
                        )}

                      </View>

                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
      )}

      {/* SETTLEMENT MODAL (BAYAR KASIR) */}
      <Modal visible={showPaymentModal && selectedOrder !== null} animationType="slide" transparent onRequestClose={() => setShowPaymentModal(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="h-[75%] rounded-t-[40px] p-6" style={{ backgroundColor: colors.bg }}>
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-xl font-black" style={{ color: colors.text }}>Pelunasan Pesanan</Text>
                <Text className="text-xs font-bold" style={{ color: colors.textMuted }}>Customer: {selectedOrder?.customerName}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <X color={colors.text} size={24} />
              </TouchableOpacity>
            </View>

            <View className="p-5 rounded-[24px] bg-black/20 mb-6 flex-row justify-between items-center">
              <Text className="text-xs font-black uppercase tracking-wider" style={{ color: colors.textMuted }}>Total Tagihan</Text>
              <Text className="text-2xl font-black text-accent">Rp {selectedOrder?.total?.toLocaleString('id-ID')}</Text>
            </View>

            {/* Payment Method Selector */}
            <View className="flex-row gap-2 mb-6">
              {['cash', 'qris', 'transfer'].map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setPaymentMethod(m as any)}
                  className="flex-1 h-12 rounded-xl border items-center justify-center"
                  style={{
                    backgroundColor: paymentMethod === m ? colors.accent : colors.surface,
                    borderColor: paymentMethod === m ? colors.accent : colors.border
                  }}
                >
                  <Text className="text-xs font-black uppercase" style={{ color: paymentMethod === m ? 'white' : colors.textMuted }}>
                    {m === 'cash' ? 'Tunai' : m.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Cash details input */}
            {paymentMethod === 'cash' && (
              <View className="mb-6 flex gap-4">
                <View className="flex-row gap-2 flex-wrap">
                  {[selectedOrder?.total, 5000, 10000, 20000, 50000, 100000]
                    .filter((v, i, self) => selectedOrder && v >= selectedOrder.total && self.indexOf(v) === i)
                    .slice(0, 4)
                    .map((val) => (
                      <TouchableOpacity
                        key={val}
                        onPress={() => setCashReceived(val.toString())}
                        className="px-4 py-2.5 rounded-xl border"
                        style={{
                          backgroundColor: Number(cashReceived) === val ? colors.accent + '20' : colors.surface,
                          borderColor: Number(cashReceived) === val ? colors.accent : colors.border
                        }}
                      >
                        <Text className="text-[10px] font-black" style={{ color: Number(cashReceived) === val ? colors.accent : colors.text }}>
                          {val === selectedOrder.total ? 'UANG PAS' : `Rp ${val.toLocaleString('id-ID')}`}
                        </Text>
                      </TouchableOpacity>
                    ))
                  }
                </View>

                <View className="relative justify-center">
                  <Text className="absolute left-4 font-black text-xs" style={{ color: colors.textMuted }}>Rp</Text>
                  <TextInput
                    placeholder="Uang diterima..."
                    placeholderTextColor={colors.textMuted + '80'}
                    keyboardType="numeric"
                    value={cashReceived}
                    onChangeText={setCashReceived}
                    className="h-14 rounded-2xl border font-bold pl-10 pr-4"
                    style={{ color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }}
                  />
                </View>

                {Number(cashReceived) >= (selectedOrder?.total || 0) && (
                  <View className="flex-row justify-between items-center px-2">
                    <Text className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Kembalian</Text>
                    <Text className="text-lg font-black text-emerald-500">
                      Rp {(Number(cashReceived) - (selectedOrder?.total || 0)).toLocaleString('id-ID')}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              onPress={confirmSettlement}
              className="h-16 rounded-[24px] items-center justify-center mt-auto"
              style={{ backgroundColor: colors.accent }}
            >
              <Text className="text-base font-black text-white uppercase tracking-wider">KONFIRMASI BAYAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* DEBT MODAL (CICILAN PIUTANG / DP) */}
      <Modal visible={showPiutangModal && selectedPiutangOrder !== null} animationType="slide" transparent onRequestClose={() => setShowPiutangModal(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="h-[70%] rounded-t-[40px] p-6" style={{ backgroundColor: colors.bg }}>
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-xl font-black" style={{ color: colors.text }}>Bayar / DP Piutang</Text>
                <Text className="text-xs font-bold" style={{ color: colors.textMuted }}>Customer: {selectedPiutangOrder?.customerName}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPiutangModal(false)}>
                <X color={colors.text} size={24} />
              </TouchableOpacity>
            </View>

            <View className="p-4 rounded-2xl bg-black/10 border mb-6" style={{ borderColor: colors.border }}>
              <View className="flex-row justify-between mb-2">
                <Text className="text-[10px] font-bold" style={{ color: colors.textMuted }}>TOTAL TAGIHAN</Text>
                <Text className="text-xs font-black" style={{ color: colors.text }}>Rp {selectedPiutangOrder?.total?.toLocaleString('id-ID')}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-[10px] font-bold text-rose-400">SISA PIUTANG AKTIF</Text>
                <Text className="text-sm font-black text-rose-500">
                  Rp {(selectedPiutangOrder?.total - (selectedPiutangOrder?.paidAmount || 0)).toLocaleString('id-ID')}
                </Text>
              </View>
            </View>

            <View className="mb-6 gap-2">
              <Text className="text-[10px] font-black uppercase tracking-widest ml-1" style={{ color: colors.textMuted }}>
                Nominal Pembayaran / Angsuran
              </Text>
              <View className="relative justify-center">
                <Text className="absolute left-4 font-black text-xs" style={{ color: colors.textMuted }}>Rp</Text>
                <TextInput
                  placeholder="Jumlah bayar..."
                  placeholderTextColor={colors.textMuted + '80'}
                  keyboardType="numeric"
                  value={downPaymentAmount}
                  onChangeText={setDownPaymentAmount}
                  className="h-14 rounded-2xl border font-bold pl-10 pr-4"
                  style={{ color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }}
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={confirmPiutang}
              className="h-16 rounded-[24px] items-center justify-center mt-auto"
              style={{ backgroundColor: colors.accent }}
            >
              <Text className="text-base font-black text-white uppercase tracking-wider">SIMPAN PEMBAYARAN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
