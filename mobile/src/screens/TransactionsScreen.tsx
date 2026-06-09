import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert, RefreshControl, Vibration, Pressable, Image, Linking, Share, Clipboard, Dimensions, NativeModules, Platform, PermissionsAndroid } from 'react-native';
import { collection, query, onSnapshot, orderBy, limit, doc, deleteDoc, where, updateDoc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../store/authStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { History, Calendar, User, ChevronRight, X, UserCircle, Trash2, Printer, Truck, Share2, MessageCircle, ShieldCheck } from 'lucide-react-native';
import { printReceipt, printA4, printA4Delivery } from '../utils/ReceiptHelper';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const { storeId } = useAuthStore();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrx, setSelectedTrx] = useState<Transaction | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [storeSettings, setStoreSettings] = useState<any>({});
  const [filterTab, setFilterTab] = useState<'all' | 'completed' | 'debt' | 'estimation' | 'online'>('all');
  const [viewingReceipt, setViewingReceipt] = useState<Transaction | null>(null);
  // Bluetooth Printer states
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

  const handlePrintAction = async (trx: Transaction) => {
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

    let collectionRef = collection(db, 'transactions');
    if (filterTab === 'estimation') {
      collectionRef = collection(db, 'estimations');
    }

    const q = query(
      collectionRef, 
      where('storeId', '==', storeId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const trx: Transaction[] = [];
      snapshot.forEach((doc) => {
        trx.push({ id: doc.id, ...doc.data() } as Transaction);
      });

      let filteredTrx = trx;
      if (filterTab === 'completed') {
        filteredTrx = trx.filter(t => t.paymentStatus === 'paid');
      } else if (filterTab === 'debt') {
        filteredTrx = trx.filter(t => t.paymentStatus === 'unpaid' || t.paymentStatus === 'partially_paid' || t.paymentCategory === 'debt');
      } else if (filterTab === 'online') {
        filteredTrx = trx.filter(t => t.orderType === 'online');
      }

      setTransactions(filteredTrx);
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
  }, [storeId, filterTab]);

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
      await updateDoc(doc(db, collectionName, id), {
        isSignatureLinkActive: true
      });
      Vibration.vibrate(15);
      
      const url = `https://ikasir.my.id/sign?type=${type}&id=${id}`;
      
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
      'Apakah Anda yakin ingin menghapus transaksi ini? Data tidak dapat dikembalikan.',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Hapus', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'transactions', trxId));
              Vibration.vibrate(15);
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

  const renderStatusBadge = (trx: Transaction) => {
    let text = trx.paymentMethod || trx.paymentCategory || '';
    let bgColor = 'bg-slate-500/10';
    let textColor = 'text-slate-500';

    if (trx.paymentStatus === 'paid') {
      text = 'Lunas';
      bgColor = 'bg-emerald-500/10';
      textColor = 'text-emerald-500';
    } else if (trx.paymentStatus === 'partially_paid') {
      text = 'Dicicil';
      bgColor = 'bg-amber-500/10';
      textColor = 'text-amber-500';
    } else if (trx.paymentStatus === 'unpaid') {
      text = 'Belum Dibayar';
      bgColor = 'bg-rose-500/10';
      textColor = 'text-rose-500';
    }

    if (trx.orderType === 'online') {
      return (
        <View className="flex-row items-center gap-1">
          <View className={`px-2.5 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10`}>
            <Text className="text-[8px] font-black uppercase text-emerald-500">Online Order</Text>
          </View>
          <View className={`px-2.5 py-0.5 rounded-full border border-slate-500/20 ${bgColor}`}>
            <Text className={`text-[8px] font-black uppercase ${textColor}`}>{text}</Text>
          </View>
        </View>
      );
    }

    return (
      <View className={`px-2.5 py-0.5 rounded-full border border-slate-500/20 ${bgColor}`}>
        <Text className={`text-[8px] font-black uppercase ${textColor}`}>{text}</Text>
      </View>
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
      msg + " Tindakan ini tidak dapat dibatalkan.",
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

              const deletePromises = docsToDelete.map(document => deleteDoc(doc(db, colName, document.id)));
              await Promise.all(deletePromises);
              Vibration.vibrate(15);
              Alert.alert("Sukses", `${docsToDelete.length} dokumen berhasil dihapus.`);
            } catch (error) {
              console.error("Gagal hapus semua transaksi:", error);
              Alert.alert("Error", "Gagal menghapus transaksi");
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
          data={transactions}
          keyExtractor={item => item.id!}
          contentContainerStyle={{ padding: 24 }}
          ListHeaderComponent={
            <View>
              {/* Tab Filters */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 flex-row" contentContainerStyle={{ gap: 8 }}>
                {[
                  { id: 'all', label: 'Semua' },
                  { id: 'completed', label: 'Selesai' },
                  { id: 'debt', label: 'Piutang' },
                  { id: 'estimation', label: 'Estimasi' },
                  { id: 'online', label: 'Online Order' }
                ].map(tab => {
                  const isActive = filterTab === tab.id;
                  return (
                    <TouchableOpacity 
                      key={tab.id}
                      onPress={() => setFilterTab(tab.id as any)}
                      activeOpacity={0.8}
                      className={`px-5 py-2.5 rounded-full border`}
                      style={{
                        backgroundColor: isActive ? colors.text : 'transparent',
                        borderColor: isActive ? colors.text : colors.border
                      }}
                    >
                      <Text className="text-xs font-black tracking-wide" style={{ color: isActive ? colors.bg : colors.textMuted }}>{tab.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {transactions.length > 0 ? (
                <View className="flex-row justify-end mb-4">
                  <TouchableOpacity 
                    onPress={handleDeleteAllTrx}
                    activeOpacity={0.8}
                    className="flex-row items-center gap-2 px-5 py-2.5 rounded-full border"
                    style={{ backgroundColor: 'rgba(244,63,94,0.08)', borderColor: 'rgba(244,63,94,0.15)' }}
                  >
                    <Trash2 color="#f43f5e" size={14} />
                    <Text className="text-[10px] font-black text-rose-500 uppercase tracking-widest">
                      {filterTab === 'all' ? 'Hapus Semua' : filterTab === 'completed' ? 'Hapus Lunas' : filterTab === 'debt' ? 'Hapus Piutang' : filterTab === 'online' ? 'Hapus Online' : 'Hapus Estimasi'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
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
          renderItem={({ item }) => (
            <TouchableOpacity 
              onPress={() => navigation.navigate('TransactionDetail', { trx: item, storeSettings })}
              activeOpacity={0.7}
              className="flex-row items-center mb-4 p-5 rounded-[28px] border"
              style={{ 
                backgroundColor: colors.surface, 
                borderColor: colors.border,
                shadowColor: colors.text,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.03,
                shadowRadius: 12,
                elevation: 2
              }}
            >
              <View 
                 className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
                 style={{ backgroundColor: colors.bg }}
              >
                 <History color={colors.accent} size={20} />
              </View>
              
              <View className="flex-1">
                <View className="flex-row justify-between items-start">
                   <Text className="text-[17px] font-black" style={{ color: colors.text }}>
                     Rp {item.total.toLocaleString('id-ID')}
                   </Text>
                   {renderStatusBadge(item)}
                </View>
                <View className="flex-row items-center mt-1.5 flex-wrap">
                    <Text className="text-[10px] font-bold" style={{ color: colors.textMuted }}>
                      {formatDate(item.timestamp)}
                    </Text>
                    <View className="w-1.5 h-1.5 rounded-full mx-2" style={{ backgroundColor: colors.border }} />
                    <Text className="text-[10px] font-bold" style={{ color: colors.textMuted }} numberOfLines={1}>
                      {item.customerName || 'Umum'}
                    </Text>
                </View>
              </View>

              <ChevronRight color={colors.textMuted} size={18} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View className="items-center py-20 opacity-30">
               <History color={colors.textMuted} size={64} />
               <Text className="text-app-text-muted font-bold mt-4">Belum ada riwayat transaksi</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
