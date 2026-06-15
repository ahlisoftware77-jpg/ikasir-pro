import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Linking, RefreshControl, Vibration, Pressable, Image, Platform, PermissionsAndroid, Dimensions, NativeModules } from 'react-native';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, writeBatch, increment, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../context/ThemeContext';
import { printReceipt } from '../utils/ReceiptHelper';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatIndonesianDate, formatIndonesianDayMonth, formatIndonesianDateTime, formatIndonesianTime } from '../utils/dateFormatter';
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

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const hasBluetoothNativeModule = !!NativeModules.BluetoothManager || !!NativeModules.RNBluetoothManager;

const BluetoothManager = hasBluetoothNativeModule 
  ? require('react-native-bluetooth-escpos-printer')?.BluetoothManager 
  : null;

const requestBluetoothPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  try {
    if (Number(Platform.Version) >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      const scanGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED;
      const connectGranted = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;
      
      if (!scanGranted || !connectGranted) {
        Alert.alert(
          "Izin Dibutuhkan",
          "Aplikasi membutuhkan izin Bluetooth Scan dan Bluetooth Connect untuk mendeteksi & menyalakan printer."
        );
        return false;
      }
      return true;
    } else {
      const locationGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      if (locationGranted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert(
          "Izin Dibutuhkan",
          "Aplikasi membutuhkan izin Lokasi untuk mendeteksi printer Bluetooth."
        );
        return false;
      }
      return true;
    }
  } catch (err) {
    console.error("Error requesting Bluetooth permissions:", err);
    return false;
  }
};

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

  const [viewingReceipt, setViewingReceipt] = useState<any | null>(null);
  const [isBluetoothModalVisible, setIsBluetoothModalVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBluetoothActive, setIsBluetoothActive] = useState(true);
  const [activePrinter, setActivePrinter] = useState<string | null>(null);
  const [bluetoothDevices, setBluetoothDevices] = useState<any[]>([]);

  const checkBluetoothState = async () => {
    if (!BluetoothManager) {
      setIsBluetoothActive(false);
      return false;
    }
    try {
      const enabled = await BluetoothManager.isBluetoothEnabled();
      setIsBluetoothActive(!!enabled);
      return !!enabled;
    } catch (err) {
      console.error(err);
      setIsBluetoothActive(false);
      return false;
    }
  };

  const requestEnableBluetooth = async () => {
    if (!BluetoothManager) {
      Alert.alert("Perhatian", "Modul Bluetooth tidak terdeteksi pada perangkat ini.");
      return;
    }
    
    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) return;

    try {
      await BluetoothManager.enableBluetooth();
      setTimeout(async () => {
        const enabled = await checkBluetoothState();
        if (enabled) {
          startBluetoothScan();
        }
      }, 1000);
    } catch (err) {
      console.error("Gagal mengaktifkan bluetooth:", err);
      Alert.alert("Perhatian", "Gagal mengaktifkan Bluetooth secara otomatis. Silakan aktifkan manual melalui Pengaturan sistem.");
    }
  };

  // Load printer preference from AsyncStorage
  useEffect(() => {
    const loadPrinter = async () => {
      try {
        const val = await AsyncStorage.getItem('selected_printer');
        if (val) setActivePrinter(val);
      } catch (err) {
        console.error("Error loading printer preference:", err);
      }
    };
    loadPrinter();
    checkBluetoothState();
  }, []);

  const startBluetoothScan = async () => {
    setIsScanning(true);
    setBluetoothDevices([]);
    
    if (!BluetoothManager) {
      // Graceful fallback in development / Expo Go
      setTimeout(() => {
        setBluetoothDevices([
          { id: '1', name: 'PRINTER-58BT', address: '00:11:22:33:44:55', type: 'Bluetooth Thermal Printer', status: 'paired', signal: 4 },
          { id: '2', name: 'RPP-02N Mobile', address: '22:33:44:55:66:77', type: 'Mobile Thermal Printer', status: 'available', signal: 3 },
          { id: '3', name: 'PT-210 POS', address: '44:55:66:77:88:99', type: '58mm Handheld POS', status: 'available', signal: 5 },
          { id: '4', name: 'POS-80 Desk', address: '66:77:88:99:AA:BB', type: '80mm Thermal Printer', status: 'available', signal: 2 },
        ]);
        setIsScanning(false);
      }, 2000);
      return;
    }

    try {
      const hasPermission = await requestBluetoothPermissions();
      if (!hasPermission) {
        setIsScanning(false);
        return;
      }

      const isEnabled = await BluetoothManager.isBluetoothEnabled();
      if (!isEnabled) {
        setIsScanning(false);
        setIsBluetoothActive(false);
        Alert.alert(
          "Bluetooth Non-aktif",
          "Bluetooth pada ponsel Anda sedang tidak aktif. Apakah Anda ingin mengaktifkannya sekarang?",
          [
            { text: "Batal", style: "cancel" },
            { text: "Aktifkan", onPress: requestEnableBluetooth }
          ]
        );
        return;
      }

      setIsBluetoothActive(true);

      BluetoothManager.scanDevices().then((resStr: string) => {
        try {
          const results = JSON.parse(resStr);
          const found: any[] = [];
          
          const paired = results.paired || [];
          const foundList = results.found || [];
          
          paired.forEach((d: any) => {
            found.push({
              id: d.address,
              name: d.name || 'Printer Bluetooth (Paired)',
              address: d.address,
              type: 'Paired Device',
              status: 'paired',
              signal: 5
            });
          });

          foundList.forEach((d: any) => {
            if (d.name) {
              found.push({
                id: d.address,
                name: d.name,
                address: d.address,
                type: 'Discovered Device',
                status: 'available',
                signal: 3
              });
            }
          });

          setBluetoothDevices(found);
          setIsScanning(false);
        } catch (parseErr) {
          console.error("Gagal parse bluetooth list:", parseErr);
          setIsScanning(false);
        }
      }, (err: any) => {
        console.error("Gagal memindai bluetooth:", err);
        setIsScanning(false);
      });
    } catch (err) {
      console.error(err);
      setIsScanning(false);
    }
  };

  const handlePrintAction = async (order: any) => {
    setViewingReceipt(order);
    try {
      const savedPrinter = await AsyncStorage.getItem('selected_printer');
      if (savedPrinter) {
        Alert.alert(
          "Cetak Struk",
          `Mencetak menggunakan printer bluetooth "${savedPrinter}"?`,
          [
            { text: "Batal", style: "cancel" },
            { 
              text: "Pilih Printer Lain", 
              onPress: () => {
                setIsBluetoothModalVisible(true);
                startBluetoothScan();
              }
            },
            {
              text: "Cetak Sekarang",
              onPress: async () => {
                Vibration.vibrate(15);
                try {
                  await printReceipt(order, storeSettings);
                } catch (err) {
                  Alert.alert("Gagal Mencetak", "Terjadi kesalahan saat berkomunikasi dengan printer.");
                }
              }
            }
          ]
        );
      } else {
        setIsBluetoothModalVisible(true);
        startBluetoothScan();
      }
    } catch (err) {
      console.error(err);
      setIsBluetoothModalVisible(true);
      startBluetoothScan();
    }
  };

  const handleConnectDevice = async (device: any) => {
    setIsConnecting(true);
    Vibration.vibrate(15);
    
    if (!BluetoothManager) {
      setTimeout(async () => {
        try {
          setIsConnecting(false);
          setActivePrinter(device.name);
          await AsyncStorage.setItem('selected_printer', device.name);
          await AsyncStorage.setItem('selected_printer_address', device.address);
          Vibration.vibrate([0, 15, 50, 15]);
          
          setIsBluetoothModalVisible(false);
          
          if (viewingReceipt) {
            try {
              await printReceipt(viewingReceipt, storeSettings);
            } catch (err) {
              console.error("Error printing receipt:", err);
              Alert.alert("Gagal Mencetak", "Tidak dapat mengirim data ke printer.");
            }
          }
        } catch (err) {
          setIsConnecting(false);
          Alert.alert("Koneksi Gagal", `Tidak dapat berpasangan dengan ${device.name}. Silakan coba lagi.`);
        }
      }, 1500);
      return;
    }

    try {
      await BluetoothManager.connect(device.address);
      
      setIsConnecting(false);
      setActivePrinter(device.name);
      await AsyncStorage.setItem('selected_printer', device.name);
      await AsyncStorage.setItem('selected_printer_address', device.address);
      Vibration.vibrate([0, 15, 50, 15]);
      
      setIsBluetoothModalVisible(false);
      
      if (viewingReceipt) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          await printReceipt(viewingReceipt, storeSettings);
        } catch (err) {
          console.error("Error printing receipt:", err);
          Alert.alert("Gagal Mencetak", "Tidak dapat mengirim data ke printer.");
        }
      }
    } catch (err) {
      setIsConnecting(false);
      Alert.alert("Koneksi Gagal", `Tidak dapat berpasangan dengan ${device.name}. Silakan coba lagi.`);
    }
  };

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
            address: data.address || '',
            ...data
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
              const formattedTime = order.timestamp 
                ? formatIndonesianTime(order.timestamp)
                : formatIndonesianTime(new Date());

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
                                    {formatIndonesianDateTime(hist.date)}
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
                          onPress={() => handlePrintAction(order)}
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

      {/* Modal Bluetooth Printer Manager */}
      <Modal visible={isBluetoothModalVisible} animationType="slide" transparent onRequestClose={() => setIsBluetoothModalVisible(false)}>
        <View className="flex-1 bg-black/70 justify-center items-center">
          <View 
            className="rounded-[32px] overflow-hidden flex-col"
            style={{ 
              backgroundColor: '#ffffff',
              width: screenWidth * 0.9,
              height: screenHeight * 0.72
            }}
          >
            {/* Header Modal */}
            <View className="p-6 border-b border-slate-100 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View className="p-2 bg-blue-500/10 rounded-xl">
                  <Printer color="#3b82f6" size={18} />
                </View>
                <Text className="text-lg font-black text-slate-900">Printer Bluetooth</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setIsBluetoothModalVisible(false)}
                className="p-2 bg-slate-50 rounded-xl"
              >
                <X color="#94a3b8" size={20} />
              </TouchableOpacity>
            </View>

            {/* Banner Bluetooth Status */}
            {!isBluetoothActive && BluetoothManager && (
              <View className="bg-rose-50 p-4 mx-6 mt-4 rounded-2xl border border-rose-100 flex-row items-center gap-3">
                <View className="p-2 bg-rose-500/10 rounded-xl">
                  <X color="#f43f5e" size={16} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-black text-rose-900">Bluetooth Non-aktif</Text>
                  <Text className="text-[10px] text-rose-600 mt-0.5">Aktifkan bluetooth untuk mendeteksi printer.</Text>
                </View>
                <TouchableOpacity 
                  onPress={requestEnableBluetooth}
                  className="px-3 py-1.5 bg-rose-500 rounded-xl"
                >
                  <Text className="text-[9px] font-black text-white uppercase">Aktifkan</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* List Perangkat */}
            <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
              {!isBluetoothActive && BluetoothManager ? (
                <View className="items-center py-12 opacity-65">
                  <History color="#94a3b8" size={48} />
                  <Text className="font-bold text-slate-400 mt-4 text-center text-xs">
                    Bluetooth dinonaktifkan. Harap aktifkan koneksi bluetooth ponsel Anda.
                  </Text>
                </View>
              ) : isScanning ? (
                <View className="items-center py-12">
                  <ActivityIndicator size="large" color="#3b82f6" className="mb-4" />
                  <Text className="text-xs font-bold text-slate-400 uppercase tracking-[2px] animate-pulse">
                    Memindai Printer...
                  </Text>
                </View>
              ) : (
                <View className="space-y-4">
                  {bluetoothDevices.length > 0 ? (
                    <>
                      <Text className="text-[10px] font-black text-slate-400 uppercase tracking-[1px] mb-2">
                        Perangkat Terdeteksi ({bluetoothDevices.length})
                      </Text>
                      
                      {bluetoothDevices.map((device) => {
                        const isCurrent = activePrinter === device.name;
                        return (
                          <TouchableOpacity
                            key={device.id}
                            onPress={() => !isCurrent && handleConnectDevice(device)}
                            disabled={isConnecting}
                            activeOpacity={0.7}
                            className={`flex-row items-center p-4 rounded-2xl border mb-3 ${isCurrent ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-50 border-slate-100'}`}
                          >
                            <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isCurrent ? 'bg-blue-500' : 'bg-slate-200'}`}>
                              <Printer color={isCurrent ? '#ffffff' : '#64748b'} size={18} />
                            </View>
                            
                            <View className="flex-1">
                              <Text className={`font-black text-xs ${isCurrent ? 'text-blue-900' : 'text-slate-900'}`}>{device.name}</Text>
                              <Text className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.5px] mt-0.5" numberOfLines={1}>{device.address || device.type}</Text>
                            </View>

                            <View className="items-end">
                              {isCurrent ? (
                                <View className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                  <Text className="text-[8px] font-black text-blue-500 uppercase">Aktif</Text>
                                </View>
                              ) : (
                                <View className="px-2.5 py-1 bg-slate-200/50 border border-slate-200 rounded-lg">
                                  <Text className="text-[8px] font-black text-slate-500 uppercase">Pilih</Text>
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  ) : (
                    <View className="items-center py-12 opacity-65">
                      <Printer color="#94a3b8" size={48} />
                      <Text className="font-bold text-slate-400 mt-4 text-center text-xs">
                        Tidak ada printer bluetooth terdeteksi. Pastikan printer dalam jangkauan dan mode berpasangan.
                      </Text>
                    </View>
                  )}
                  
                  {!BluetoothManager && (
                    <View className="bg-amber-50 p-4 rounded-2xl border border-amber-100 mt-4">
                      <Text className="text-[9px] font-bold text-amber-800 leading-[14px]">
                        ℹ️ MODE SIMULATOR: Modul Bluetooth Native tidak terdeteksi pada Expo Go. Jalankan dengan custom dev client atau build APK real untuk memindai perangkat fisik Anda secara langsung.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Hubungkan Loading state */}
            {isConnecting && (
              <View className="absolute inset-0 bg-white/95 justify-center items-center rounded-[32px]">
                <ActivityIndicator size="large" color="#3b82f6" className="mb-4" />
                <Text className="text-sm font-black text-slate-900">Menghubungkan Perangkat...</Text>
                <Text className="text-xs text-slate-400 mt-1">Mengamankan koneksi Bluetooth...</Text>
              </View>
            )}

            {/* Tindakan Bawah */}
            <View className="p-6 bg-slate-50 border-t border-slate-200">
              <TouchableOpacity 
                onPress={startBluetoothScan}
                disabled={isScanning || isConnecting}
                className="w-full py-4 bg-slate-900 rounded-2xl items-center justify-center"
              >
                <Text className="font-black text-white text-xs uppercase">Pindai Ulang Perangkat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
