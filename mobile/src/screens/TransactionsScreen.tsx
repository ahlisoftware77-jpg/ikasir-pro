import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert, RefreshControl, Vibration, Pressable, Image, Linking, Share, Clipboard, Dimensions, NativeModules, Platform, PermissionsAndroid } from 'react-native';
import { collection, query, onSnapshot, orderBy, limit, doc, deleteDoc, where, updateDoc, getDoc, getDocs, getDocsFromCache, writeBatch } from 'firebase/firestore';
import { db, primaryDb } from '../lib/firebase';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../store/authStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { 
  History, Calendar, User, ChevronRight, X, UserCircle, Trash2, Printer, Truck, 
  Share2, MessageCircle, ShieldCheck, ArrowUpDown, LayoutGrid, CheckCircle2, 
  AlertTriangle, FileText, ShoppingBag, Clock, CalendarDays, Download, Search, 
  Coins, TrendingUp, Activity
} from 'lucide-react-native';
import { printReceipt, printA4, printA4Delivery } from '../utils/ReceiptHelper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

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


interface Transaction {
  id?: string;
  storeId?: string;
  cashierName: string;
  customerName?: string;
  customerId?: string;
  total: number;
  subtotal?: number;
  tax?: number;
  paymentMethod: string;
  paymentCategory?: string; // 'direct' | 'debt' | 'order'
  paymentStatus?: string; // 'paid' | 'partially_paid' | 'unpaid'
  orderType?: string;
  timestamp: any;
  items: any[];
  dueDate?: string;
  downPayment?: number;
  paidAmount?: number;
  debtAmount?: number;
  cashReceived?: number;
  change?: number;
  paymentHistory?: {
    amount: number;
    date: string;
    note: string;
  }[];
  isSignatureLinkActive?: boolean;
}

export default function TransactionsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { storeId, isSubscriptionExpired, role } = useAuthStore();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrx, setSelectedTrx] = useState<Transaction | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [storeSettings, setStoreSettings] = useState<any>({});
  const [filterTab, setFilterTab] = useState<'all' | 'completed' | 'debt' | 'estimation' | 'online'>('all');
  const [timeFilter, setTimeFilter] = useState<'today' | 'weekly' | 'monthly' | 'yearly' | 'all'>('all');
  const [searchText, setSearchText] = useState('');
  const [viewingReceipt, setViewingReceipt] = useState<Transaction | null>(null);
  const [infraData, setInfraData] = useState<any>({});

  useEffect(() => {
    const unsubInfra = onSnapshot(doc(primaryDb, 'system_settings', 'infrastructure'), (docSnap) => {
      if (docSnap.exists()) {
        setInfraData(docSnap.data());
      }
    });
    return () => unsubInfra();
  }, []);

  const isFeatureLocked = (key: string, featureName: string) => {
    if (role === 'super-admin' || role === 'superadmin') return false;
    const isPaidFeature = infraData?.[key] ?? false;
    if (isPaidFeature && isSubscriptionExpired) {
      Alert.alert(
        'Fitur Premium Kasir Pro',
        `Fitur "${featureName}" saat ini dikonfigurasi sebagai fitur berbayar oleh Developer. Silakan lakukan langganan / perpanjang paket premium Kasir Pro Anda untuk menggunakan fitur ini.`,
        [
          { text: 'Tutup', style: 'cancel' }
        ]
      );
      return true;
    }
    return false;
  };
  // Bluetooth Printer states
  const [isBluetoothModalVisible, setIsBluetoothModalVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBluetoothActive, setIsBluetoothActive] = useState(true);
  const [activePrinter, setActivePrinter] = useState<string | null>(null);
  const [bluetoothDevices, setBluetoothDevices] = useState<any[]>([]);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const isWithinTimeRange = (timestamp: any, range: typeof timeFilter) => {
    if (range === 'all') return true;
    if (!timestamp) return false;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (range === 'today') {
      return date >= startOfToday;
    }
    
    if (range === 'weekly') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return date >= sevenDaysAgo;
    }
    
    if (range === 'monthly') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return date >= startOfMonth;
    }
    
    if (range === 'yearly') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return date >= startOfYear;
    }
    
    return true;
  };

  const getLeftCardDateTime = (timestamp: any) => {
    if (!timestamp) return { day: '--', monthYear: '---', time: '--:--:--' };
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const day = date.getDate().toString().padStart(2, '0');
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
    const monthYear = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    const time = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':');
    return {
      day,
      monthYear,
      time
    };
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(trx => {
      let matchStatus = true;
      if (filterTab === 'completed') {
        matchStatus = trx.paymentStatus === 'paid';
      } else if (filterTab === 'debt') {
        matchStatus = trx.paymentStatus === 'unpaid' || trx.paymentStatus === 'partially_paid' || trx.paymentCategory === 'debt';
      } else if (filterTab === 'online') {
        matchStatus = trx.orderType === 'online';
      }

      const matchTime = isWithinTimeRange(trx.timestamp, timeFilter);

      let matchSearch = true;
      if (searchText.trim() !== '') {
        const queryText = searchText.toLowerCase().trim();
        const trxId = (trx.id || '').toLowerCase();
        const custName = (trx.customerName || 'umum').toLowerCase();
        const cashier = (trx.cashierName || '').toLowerCase();
        const paymentM = (trx.paymentMethod || '').toLowerCase();
        matchSearch = trxId.includes(queryText) || custName.includes(queryText) || cashier.includes(queryText) || paymentM.includes(queryText);
      }

      return matchStatus && matchTime && matchSearch;
    });
  }, [transactions, filterTab, timeFilter, searchText]);

  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime();
      const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [filteredTransactions, sortOrder]);

  const metrics = useMemo(() => {
    let totalOmzet = 0;
    let totalProfit = 0;
    let totalQtyTerjual = 0;
    
    // Additional metrics for Piutang
    let totalPiutangAwal = 0;
    let totalPiutangTerbayar = 0;
    let totalSisaPiutang = 0;
    
    filteredTransactions.forEach(trx => {
      const omzetVal = trx.total || 0;
      totalOmzet += omzetVal;

      let trxHpp = 0;
      trx.items?.forEach((item: any) => {
        const qty = item.qty || 0;
        totalQtyTerjual += qty;
        trxHpp += qty * (item.purchasePrice || 0);
      });

      totalProfit += (omzetVal - trxHpp);
      
      // Calculate Piutang metrics
      let dp = trx.downPayment || 0;
      let paid = trx.paidAmount || 0;
      totalPiutangAwal += Math.max(0, (trx.total || 0) - dp);
      totalPiutangTerbayar += Math.max(0, paid - dp);
      totalSisaPiutang += trx.debtAmount !== undefined ? trx.debtAmount : Math.max(0, (trx.total || 0) - paid);
    });

    return {
      totalTrx: filteredTransactions.length,
      totalQty: totalQtyTerjual,
      omzet: totalOmzet,
      profit: totalProfit,
      piutangAwal: totalPiutangAwal,
      piutangTerbayar: totalPiutangTerbayar,
      sisaPiutang: totalSisaPiutang
    };
  }, [filteredTransactions]);

  const exportTransactionsToExcel = async () => {
    if (sortedTransactions.length === 0) {
      Alert.alert("Perhatian", "Tidak ada data transaksi untuk diekspor.");
      return;
    }

    try {
      let csvContent = '\uFEFF';
      csvContent += 'ID Transaksi,Tanggal,Jam,Staf/Kasir,Pelanggan,Status,Metode Pembayaran,Item,Omzet (Rp),Profit (Rp)\n';

      sortedTransactions.forEach(trx => {
        const trxId = trx.id || '';
        const dateObj = trx.timestamp?.toDate ? trx.timestamp.toDate() : new Date(trx.timestamp);
        const tanggal = dateObj.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const jam = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':');
        const cashier = trx.cashierName || '';
        const customer = trx.customerName || 'Umum';
        
        let status = 'Lunas';
        if (trx.paymentStatus === 'partially_paid') status = 'Dicicil';
        else if (trx.paymentStatus === 'unpaid') status = 'Belum Dibayar';
        
        const paymentMethod = trx.paymentMethod || trx.paymentCategory || '';
        const itemNames = trx.items?.map((i: any) => `${i.productName} (${i.qty}x)`).join('; ') || '';
        const omzet = trx.total || 0;
        
        let trxHpp = 0;
        trx.items?.forEach((i: any) => {
          trxHpp += (i.purchasePrice || 0) * (i.qty || 0);
        });
        const profit = omzet - trxHpp;

        const escapedItems = `"${itemNames.replace(/"/g, '""')}"`;
        const escapedCustomer = `"${customer.replace(/"/g, '""')}"`;
        const escapedCashier = `"${cashier.replace(/"/g, '""')}"`;

        csvContent += `${trxId},${tanggal},${jam},${escapedCashier},${escapedCustomer},${status},${paymentMethod},${escapedItems},${omzet},${profit}\n`;
      });

      const fileName = `Laporan_Transaksi_${new Date().toISOString().slice(0,10)}.csv`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8
      });

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Unduh Laporan Penjualan (Excel)',
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        Alert.alert("Error", "Fitur berbagi file tidak tersedia di perangkat ini.");
      }
    } catch (error) {
      console.error("Gagal mengekspor laporan:", error);
      Alert.alert("Gagal Mengekspor", "Terjadi kesalahan saat memproses laporan penjualan.");
    }
  };


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

  const handlePrintAction = async (trx: Transaction) => {
    if (isFeatureLocked('paid_print_receipt', 'Cetak Struk Kasir Thermal')) return;
    setViewingReceipt(trx);
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
                  await printReceipt(trx as any, storeSettings);
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
      // Simulator connection lag
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
              await printReceipt(viewingReceipt as any, storeSettings);
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
          // Wait 500ms for connection to stabilize before printing
          await new Promise(resolve => setTimeout(resolve, 500));
          await printReceipt(viewingReceipt as any, storeSettings);
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

  const onRefresh = async () => {
    setRefreshing(true);
    if (storeId) {
      try {
        const docSnap = await getDoc(doc(db, 'settings', `store_${storeId}`));
        if (docSnap.exists()) {
          setStoreSettings(docSnap.data());
        }
      } catch (err) {
        console.error("Error refreshing store settings:", err);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 800));
    setRefreshing(false);
  };

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);

    const isEstimation = filterTab === 'estimation';
    let collectionRef = collection(db, isEstimation ? 'estimations' : 'transactions');

    const q = query(
      collectionRef, 
      where('storeId', '==', storeId),
      orderBy('timestamp', 'desc'),
      limit(200)
    );

    // 1. Instant cache load
    try {
      getDocsFromCache(q).then((cacheSnap) => {
        if (!cacheSnap.empty) {
          const cachedTrx: Transaction[] = [];
          cacheSnap.forEach((doc) => {
            cachedTrx.push({ id: doc.id, ...doc.data() } as Transaction);
          });
          setTransactions(cachedTrx);
          setLoading(false);
        }
      }).catch(() => {});
    } catch (e) {}

    // 2. Real-time subscription
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const trx: Transaction[] = [];
      snapshot.forEach((doc) => {
        trx.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setTransactions(trx);
      setLoading(false);
    }, (error) => {
      console.error("Error subscribing to transactions:", error);
      setLoading(false);
    });

    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', `store_${storeId}`));
        if (docSnap.exists()) {
          setStoreSettings(docSnap.data());
        }
      } catch(err) {
        console.error("Error fetching settings:", err);
      }
    };
    fetchSettings();
    
    return () => unsubscribe();
  }, [storeId, filterTab === 'estimation']);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '...';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('id-ID', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).replace(/\./g, ':');
  };

  const handleClaimWarranty = (item: any) => {
    if (!item.warrantyExpiry) return;
    
    const expiryDate = item.warrantyExpiry.toDate ? item.warrantyExpiry.toDate() : new Date(item.warrantyExpiry);
    const isExpired = expiryDate < new Date();
    
    const formattedExpiry = expiryDate.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    Vibration.vibrate(15);

    if (isExpired) {
      Alert.alert(
        "Klaim Ditolak",
        `Masa garansi untuk ${item.productName} telah berakhir pada ${formattedExpiry}.\n\n⚠️ Garansi sudah tidak berlaku.`,
        [{ text: "OK" }]
      );
    } else {
      Alert.alert(
        "Klaim Valid",
        `Produk ${item.productName} masih dalam masa garansi hingga ${formattedExpiry}.\n\n✅ Silakan proses perbaikan/penggantian produk.`,
        [{ text: "OK" }]
      );
    }
  };

  const handleSendWA = async (trx: Transaction) => {
    if (!trx.customerId) {
      Alert.alert("Perhatian", "Nomor WhatsApp tidak diketahui karena tidak ada data Pelanggan yang ditautkan pada transaksi.");
      return;
    }
    
    try {
      const custDoc = await getDoc(doc(db, 'customers', trx.customerId));
      if (!custDoc.exists()) {
        Alert.alert("Error", "Data pelanggan tidak ditemukan!");
        return;
      }
      
      const customerData = custDoc.data();
      if (!customerData.phone) {
        Alert.alert("Perhatian", `Pelanggan "${customerData.name}" belum mencantumkan nomor telepon / WA pada sistem.`);
        return;
      }

      let phone = customerData.phone.replace(/\D/g, '');
      if (phone.startsWith('0')) {
        phone = '62' + phone.substring(1);
      }

      const paid = trx.paidAmount || 0;
      const total = trx.total || 0;
      const sisa = Math.max(0, total - paid);
      const dDate = trx.dueDate ? new Date(trx.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
      const trxId = trx.id?.substring(0, 8);

      let text = storeSettings?.waTemplate || 'Halo *{customerName}*,\n\nKami dari *{storeName}* ingin menyampaikan rincian tagihan pesanan Anda (Ref: *#{trxId}*)\n\nTotal Tagihan: *{total}*\nTelah Dibayar: {paid}\nSisa Piutang : *{debt}*\nJatuh Tempo  : *{dueDate}*\n\nMohon dapat melakukan pelunasan sisa tagihan sebelum jatuh tempo. Terima kasih!';

      text = text.replace(/{customerName}/g, customerData.name)
                .replace(/{trxId}/g, trxId)
                .replace(/{total}/g, `Rp ${total.toLocaleString('id-ID')}`)
                .replace(/{paid}/g, `Rp ${paid.toLocaleString('id-ID')}`)
                .replace(/{debt}/g, `Rp ${sisa.toLocaleString('id-ID')}`)
                .replace(/{dueDate}/g, dDate)
                .replace(/{storeName}/g, storeSettings?.storeName || 'Toko Kami');

      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
      const supported = await Linking.canOpenURL(waUrl);
      if (supported) {
        await Linking.openURL(waUrl);
      } else {
        Alert.alert("Error", "Tidak dapat membuka WhatsApp. Pastikan aplikasi WhatsApp terinstal.");
      }
    } catch (err) {
      console.error("Gagal mengambil kontak WhatsApp: ", err);
      Alert.alert("Error", "Terjadi kesalahan saat memproses kontak.");
    }
  };

  const handleShareSignatureLink = async (type: string, id: string) => {
    try {
      const collectionName = type === 'est' ? 'estimations' : 'transactions';
      
      // Generate secure signatureToken for client verification
      const generateSecureToken = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 32; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };
      
      const secureToken = generateSecureToken();
      
      await updateDoc(doc(db, collectionName, id), {
        isSignatureLinkActive: true,
        signatureToken: secureToken
      });
      Vibration.vibrate(15);
      
      const url = `https://ikasir.my.id/sign?type=${type}&id=${id}&storeId=${storeId}&token=${secureToken}`;
      
      try {
        await Share.share({
          title: 'Form Tanda Tangan',
          message: `Silakan klik link berikut untuk menandatangani dokumen Anda: ${url}`,
          url: url,
        });
      } catch (shareErr) {
        Clipboard.setString(url);
        Alert.alert("Link Disalin", "Link tanda tangan berhasil disalin ke clipboard!");
      }
    } catch (err) {
      console.error('Error sharing/activating signature link:', err);
      Alert.alert("Error", "Gagal mengaktifkan link tanda tangan.");
    }
  };

  const handleDeleteTrx = (trxId: string) => {
    Alert.alert(
      'Hapus Transaksi',
      'Apakah Anda yakin ingin menghapus transaksi ini? Transaksi akan dipindahkan ke Kotak Sampah selama 3 bulan.',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Hapus', 
          style: 'destructive',
          onPress: async () => {
            try {
              const trxRef = doc(db, 'transactions', trxId);
              const trxSnap = await getDoc(trxRef);
              if (!trxSnap.exists()) {
                Alert.alert('Error', 'Transaksi tidak ditemukan');
                return;
              }
              const trxData = trxSnap.data();
              const batch = writeBatch(db);
              
              const recycleRef = doc(db, 'recycle_bin', trxId);
              batch.set(recycleRef, {
                ...trxData,
                deletedAt: new Date().toISOString(),
                originalCollection: 'transactions'
              });
              
              batch.delete(trxRef);
              await batch.commit();
              
              Vibration.vibrate(15);
              Alert.alert('Sukses', 'Transaksi dipindahkan ke Kotak Sampah');
              if (selectedTrx?.id === trxId) {
                setSelectedTrx(null);
              }
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Gagal menghapus transaksi');
            }
          }
        }
      ]
    );
  };

  const handleDeleteAllTrx = () => {
    let title = "Hapus Semua Transaksi";
    let msg = "Apakah Anda yakin ingin menghapus SEMUA riwayat transaksi?";
    
    if (filterTab === 'completed') {
      title = "Hapus Transaksi Selesai";
      msg = "Apakah Anda yakin ingin menghapus semua transaksi yang sudah LUNAS?";
    } else if (filterTab === 'debt') {
      title = "Hapus Utang/Piutang";
      msg = "Apakah Anda yakin ingin menghapus semua data PIUTANG?";
    } else if (filterTab === 'estimation') {
      title = "Hapus Semua Estimasi";
      msg = "Apakah Anda yakin ingin menghapus semua data ESTIMASI?";
    } else if (filterTab === 'online') {
      title = "Hapus Online Order";
      msg = "Apakah Anda yakin ingin menghapus semua data ONLINE ORDER?";
    }

    Alert.alert(
      title,
      msg + " Data akan dipindahkan ke Kotak Sampah selama 3 bulan.",
      [
        { text: "Batal", style: "cancel" },
        { 
          text: "Ya, Hapus Semua", 
          style: "destructive",
          onPress: async () => {
            if (!storeId) return;
            setLoading(true);
            try {
              let colName = filterTab === 'estimation' ? 'estimations' : 'transactions';
              const allTrxQuery = query(collection(db, colName), where('storeId', '==', storeId));
              const snap = await getDocs(allTrxQuery);

              let docsToDelete = snap.docs;
              if (filterTab === 'completed') {
                docsToDelete = snap.docs.filter(d => d.data().paymentStatus === 'paid');
              } else if (filterTab === 'debt') {
                docsToDelete = snap.docs.filter(d => {
                   const s = d.data().paymentStatus;
                   const c = d.data().paymentCategory;
                   return s === 'unpaid' || s === 'partially_paid' || c === 'debt';
                });
              } else if (filterTab === 'online') {
                docsToDelete = snap.docs.filter(d => d.data().orderType === 'online');
              }

              if (docsToDelete.length > 0) {
                // Soft-delete dalam chunk 200 dokumen untuk menghindari batasan 500 operasi writeBatch
                const chunkSize = 200;
                for (let i = 0; i < docsToDelete.length; i += chunkSize) {
                  const chunk = docsToDelete.slice(i, i + chunkSize);
                  const batch = writeBatch(db);
                  
                  chunk.forEach(docSnap => {
                    const docData = docSnap.data();
                    const docId = docSnap.id;
                    
                    // Set di recycle_bin
                    const recycleRef = doc(db, 'recycle_bin', docId);
                    batch.set(recycleRef, {
                      ...docData,
                      deletedAt: new Date().toISOString(),
                      originalCollection: colName
                    });
                    
                    // Hapus dokumen asli
                    batch.delete(docSnap.ref);
                  });
                  
                  await batch.commit();
                }
              }

              Vibration.vibrate(15);
              Alert.alert("Sukses", `${docsToDelete.length} dokumen berhasil dipindahkan ke Kotak Sampah.`);
            } catch (error) {
              console.error("Gagal hapus semua transaksi:", error);
              Alert.alert("Error", "Gagal memindahkan transaksi ke Kotak Sampah");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1" edges={['bottom']} style={{ backgroundColor: colors.bg }}>
      {loading ? (
        <LoadingSkeleton type="list" count={5} />
      ) : (
        <FlatList
          data={sortedTransactions}
          keyExtractor={item => item.id!}
          contentContainerStyle={{ padding: 20 }}
          ListHeaderComponent={
            <View className="mb-4">
              {/* Search Bar */}
              <View className="flex-row items-center mb-4 px-4 py-2.5 rounded-2xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <Search size={16} color={colors.textMuted} className="mr-2" />
                <TextInput
                  className="flex-1 text-xs font-bold p-0"
                  style={{ color: colors.text }}
                  placeholder="Cari ID transaksi, kasir, pelanggan..."
                  placeholderTextColor={colors.textMuted}
                  value={searchText}
                  onChangeText={setSearchText}
                />
                {searchText !== '' && (
                  <TouchableOpacity onPress={() => setSearchText('')}>
                    <X size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Status Tab Filters */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
                {[
                  { id: 'all', label: 'Semua', icon: LayoutGrid },
                  { id: 'completed', label: 'Selesai', icon: CheckCircle2 },
                  { id: 'debt', label: 'Piutang', icon: AlertTriangle },
                  { id: 'estimation', label: 'Estimasi', icon: FileText },
                  { id: 'online', label: 'Online Order', icon: ShoppingBag }
                ].map(tab => {
                  const isActive = filterTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <TouchableOpacity 
                      key={tab.id}
                      onPress={() => {
                        Vibration.vibrate(10);
                        setFilterTab(tab.id as any);
                      }}
                      activeOpacity={0.8}
                      className="flex-row items-center gap-1 px-3 py-1.5 rounded-full border"
                      style={{
                        backgroundColor: isActive ? colors.text : colors.surface,
                        borderColor: isActive ? colors.text : colors.border,
                        flexShrink: 0
                      }}
                    >
                      <Icon size={11} color={isActive ? colors.bg : colors.textMuted} />
                      <Text className="text-[11px] font-black tracking-wide" style={{ color: isActive ? colors.bg : colors.text, flexShrink: 0 }}>{tab.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Time Tab Filters */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
                {[
                  { id: 'all', label: 'Semua Waktu', icon: Calendar },
                  { id: 'today', label: 'Hari Ini', icon: Clock },
                  { id: 'weekly', label: 'Minggu Ini', icon: Activity },
                  { id: 'monthly', label: 'Bulan Ini', icon: CalendarDays },
                  { id: 'yearly', label: 'Tahun Ini', icon: Calendar }
                ].map(tab => {
                  const isActive = timeFilter === tab.id;
                  const Icon = tab.icon;
                  return (
                    <TouchableOpacity 
                      key={tab.id}
                      onPress={() => {
                        Vibration.vibrate(10);
                        setTimeFilter(tab.id as any);
                      }}
                      activeOpacity={0.8}
                      className="flex-row items-center gap-1 px-2.5 py-1 rounded-full border"
                      style={{
                        backgroundColor: isActive ? colors.accent : colors.surface,
                        borderColor: isActive ? colors.accent : colors.border,
                        flexShrink: 0
                      }}
                    >
                      <Icon size={10} color={isActive ? '#ffffff' : colors.textMuted} />
                      <Text className="text-[10px] font-black" style={{ color: isActive ? '#ffffff' : colors.text, flexShrink: 0 }}>{tab.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Summary Cards Grid */}
              <View className="flex-row flex-wrap gap-3 mb-5">
                {/* Card 1: Jumlah Transaksi / Estimasi / Piutang / Pesanan */}
                <View className="flex-1 min-w-[45%] p-4 rounded-[20px] border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                      {filterTab === 'debt' ? 'Transaksi Piutang' : filterTab === 'estimation' ? 'Total Estimasi' : filterTab === 'online' ? 'Pesanan Online' : 'Transaksi'}
                    </Text>
                    <View className="p-1 rounded-lg bg-indigo-500/10">
                      <History size={12} color="#6366f1" />
                    </View>
                  </View>
                  <Text className="text-base font-black" style={{ color: colors.text }}>
                    {metrics.totalTrx} {filterTab === 'estimation' ? 'Est' : 'Trx'}
                  </Text>
                </View>

                {/* Card 2: Produk Terjual / Estimasi / Sisa Piutang / Pesanan */}
                <View className="flex-1 min-w-[45%] p-4 rounded-[20px] border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                      {filterTab === 'debt' ? 'Sisa Piutang' : filterTab === 'estimation' ? 'Produk Estimasi' : filterTab === 'online' ? 'Item Terjual' : 'Terjual'}
                    </Text>
                    <View className="p-1 rounded-lg bg-sky-500/10">
                      <ShoppingBag size={12} color="#0284c7" />
                    </View>
                  </View>
                  <Text className="text-base font-black" style={{ color: colors.text }}>
                    {filterTab === 'debt' ? `Rp${metrics.sisaPiutang.toLocaleString('id-ID')}` : `${metrics.totalQty} Qty`}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => {
                      Vibration.vibrate(10);
                      if (filterTab === 'debt') {
                        navigation.navigate('FeatureDetails', { featureId: 'piutang', title: 'Hutang Piutang' });
                      } else if (filterTab === 'estimation') {
                        navigation.navigate('FeatureDetails', { featureId: 'estimasi', title: 'Estimasi Biaya' });
                      } else if (filterTab === 'online') {
                        navigation.navigate('Pesanan');
                      } else {
                        navigation.navigate('FeatureDetails', { featureId: 'terjual', title: 'Analitik Terjual' });
                      }
                    }}
                    className="flex-row items-center mt-1"
                  >
                    <Text className="text-[9px] font-black text-sky-500 mr-0.5">Lihat Detail</Text>
                    <ChevronRight size={10} color="#0284c7" />
                  </TouchableOpacity>
                </View>

                {/* Card 3: Omzet / Piutang Awal */}
                <View className="flex-1 min-w-[45%] p-4 rounded-[20px] border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                      {filterTab === 'debt' ? 'Piutang Awal' : filterTab === 'estimation' ? 'Nilai Estimasi' : filterTab === 'online' ? 'Omzet Online' : 'Omzet'}
                    </Text>
                    <View className="p-1 rounded-lg bg-emerald-500/10">
                      <TrendingUp size={12} color="#10b981" />
                    </View>
                  </View>
                  <Text className="text-base font-black text-emerald-500">
                    Rp{(filterTab === 'debt' ? metrics.piutangAwal : metrics.omzet).toLocaleString('id-ID')}
                  </Text>
                </View>

                {/* Card 4: Profit / Piutang Terbayar */}
                <View className="flex-1 min-w-[45%] p-4 rounded-[20px] border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                      {filterTab === 'debt' ? 'Piutang Terbayar' : filterTab === 'estimation' ? 'Potensi Profit' : filterTab === 'online' ? 'Profit Online' : 'Profit'}
                    </Text>
                    <View className="p-1 rounded-lg bg-amber-500/10">
                      <Coins size={12} color="#f59e0b" />
                    </View>
                  </View>
                  <Text className="text-base font-black text-amber-500">
                    Rp{(filterTab === 'debt' ? metrics.piutangTerbayar : metrics.profit).toLocaleString('id-ID')}
                  </Text>
                </View>
              </View>

              {/* Utility Row (Sort, Excel, Delete) */}
              <View className="flex-row justify-between items-center gap-2 mb-2">
                <View className="flex-row gap-2">
                  <TouchableOpacity 
                    onPress={() => {
                      Vibration.vibrate(10);
                      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
                    }}
                    activeOpacity={0.8}
                    className="flex-row items-center gap-1.5 px-3 py-2 rounded-full border"
                    style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                  >
                    <ArrowUpDown color={colors.accent} size={11} />
                    <Text className="text-[9px] font-black uppercase tracking-wider" style={{ color: colors.text }}>
                      {sortOrder === 'desc' ? 'Terbaru' : 'Terlama'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={exportTransactionsToExcel}
                    activeOpacity={0.8}
                    className="flex-row items-center gap-1.5 px-3 py-2 rounded-full border"
                    style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                  >
                    <Download color={colors.accent} size={11} />
                    <Text className="text-[9px] font-black uppercase tracking-wider" style={{ color: colors.text }}>
                      Unduh Excel
                    </Text>
                  </TouchableOpacity>
                </View>

                {transactions.length > 0 && filterTab !== 'estimation' ? (
                  <TouchableOpacity 
                    onPress={handleDeleteAllTrx}
                    activeOpacity={0.8}
                    className="flex-row items-center gap-1.5 px-3 py-2 rounded-full border"
                    style={{ backgroundColor: 'rgba(244,63,94,0.08)', borderColor: 'rgba(244,63,94,0.15)' }}
                  >
                    <Trash2 color="#f43f5e" size={11} />
                    <Text className="text-[9px] font-black text-rose-500 uppercase tracking-wider">
                      Hapus Semua
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.accent]}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item }) => {
            const { day, monthYear, time } = getLeftCardDateTime(item.timestamp);
            
            let badgeBg = 'bg-rose-50 border-rose-200';
            let badgeTextColor = 'text-rose-600';
            let methodLabel = (item.paymentMethod || item.paymentCategory || 'Tunai').toUpperCase();
            
            if (item.paymentStatus === 'paid') {
              badgeBg = 'bg-emerald-50 border-emerald-200';
              badgeTextColor = 'text-emerald-600';
            } else if (item.paymentStatus === 'partially_paid') {
              badgeBg = 'bg-amber-50 border-amber-200';
              badgeTextColor = 'text-amber-600';
            }

            return (
              <TouchableOpacity 
                onPress={() => {
                  Vibration.vibrate(10);
                  if (filterTab === 'debt') {
                    navigation.navigate('FeatureDetails', { featureId: 'piutang', title: 'Hutang Piutang' });
                  } else if (filterTab === 'estimation') {
                    navigation.navigate('FeatureDetails', { featureId: 'estimasi', title: 'Estimasi Biaya' });
                  } else if (filterTab === 'online') {
                    navigation.navigate('Pesanan');
                  } else {
                    navigation.navigate('TransactionDetail', { trx: item, storeSettings });
                  }
                }}
                activeOpacity={0.7}
                className="flex-row items-stretch mb-4 rounded-3xl border overflow-hidden shadow-sm"
                style={{ 
                  backgroundColor: colors.surface, 
                  borderColor: colors.border,
                  minHeight: 90
                }}
              >
                {/* Blok Kiri: Tanggal Neon Orange */}
                <View 
                  className="w-[84px] items-center justify-center p-2.5"
                  style={{ backgroundColor: '#ff5c00' }}
                >
                  <Text className="text-2xl font-black text-white leading-none">{day}</Text>
                  <Text className="text-[9px] font-black text-white mt-1 uppercase tracking-wider">{monthYear}</Text>
                  <Text className="text-[10px] font-bold text-white mt-1.5 tracking-tighter">{time}</Text>
                </View>

                {/* Blok Kanan: Detail Transaksi */}
                <View className="flex-1 p-3.5 justify-between">
                  {/* Baris 1: ID Transaksi & Badge Tipe Pembayaran */}
                  <View className="flex-row justify-between items-center">
                    <Text className="text-[11px] font-bold text-slate-400 tracking-wider uppercase" numberOfLines={1}>
                      {item.id?.substring(0, 16).toUpperCase() || 'TRANSAKSI'}
                    </Text>
                    <View className={`px-2 py-0.5 rounded border ${badgeBg}`}>
                      <Text className={`text-[8px] font-black uppercase ${badgeTextColor}`}>
                        {methodLabel}
                      </Text>
                    </View>
                  </View>

                  {/* Baris 2: Nama Pelanggan & Dibuat Oleh Label */}
                  <View className="flex-row justify-between items-center my-1.5">
                    <Text className="text-xs font-black flex-1 mr-2" style={{ color: colors.text }} numberOfLines={1}>
                      {item.customerName || 'Umum'}
                    </Text>
                    <Text className="text-[9px] font-bold text-slate-400 text-right">
                      Dibuat Oleh
                    </Text>
                  </View>

                  {/* Baris 3: Nominal Rp & Nama Pembuat (Staf) */}
                  <View className="flex-row justify-between items-end">
                    <Text className="text-base font-black text-emerald-500 leading-none">
                      Rp{item.total.toLocaleString('id-ID')}
                    </Text>
                    <Text className="text-[11px] font-black text-rose-500 leading-none text-right" numberOfLines={1}>
                      {item.cashierName || 'Admin'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View className="items-center py-20 opacity-30">
               <History color={colors.textMuted} size={64} />
               <Text className="text-sm font-black mt-4 uppercase tracking-wider" style={{ color: colors.textMuted }}>Belum ada riwayat transaksi</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
