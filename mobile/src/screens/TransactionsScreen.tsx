import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert, RefreshControl, Vibration, Pressable, Image, Linking, Share, Clipboard, Dimensions, NativeModules, Platform, PermissionsAndroid } from 'react-native';
import { collection, query, onSnapshot, orderBy, limit, doc, deleteDoc, where, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../store/authStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { History, Calendar, User, ChevronRight, X, UserCircle, Trash2, Printer, Truck, Share2, MessageCircle, ShieldCheck } from 'lucide-react-native';
import { printReceipt } from '../utils/ReceiptHelper';
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

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const { storeId } = useAuthStore();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrx, setSelectedTrx] = useState<Transaction | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [storeSettings, setStoreSettings] = useState<any>({});
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
    const q = query(
      collection(db, 'transactions'), 
      where('storeId', '==', storeId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const trx: Transaction[] = [];
      snapshot.forEach((doc) => {
        trx.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setTransactions(trx);
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
  }, [storeId]);

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

  return (
    <SafeAreaView className="flex-1" edges={['bottom']} style={{ backgroundColor: colors.bg }}>
      {loading ? (
        <LoadingSkeleton type="list" count={5} />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={item => item.id!}
          contentContainerStyle={{ padding: 24 }}
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
              onPress={() => setSelectedTrx(item)}
              activeOpacity={0.7}
              className="flex-row items-center mb-4 p-5 rounded-[32px] border"
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            >
              <View 
                 className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
                 style={{ backgroundColor: colors.bg }}
              >
                 <History color={colors.accent} size={20} />
              </View>
              
              <View className="flex-1">
                <View className="flex-row justify-between items-start">
                   <Text className="text-lg font-black" style={{ color: colors.text }}>
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

      {/* Detail Modal */}
      <Modal visible={selectedTrx !== null} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 justify-end">
          <View 
            className="h-[85%] rounded-t-[40px] p-8"
            style={{ backgroundColor: colors.bg }}
          >
            <View className="flex-row items-center justify-between mb-8">
              <Text className="text-2xl font-black" style={{ color: colors.text }}>Detail Transaksi</Text>
              <View className="flex-row items-center gap-4">
                {selectedTrx?.id && (
                  <TouchableOpacity onPress={() => handleDeleteTrx(selectedTrx.id!)}>
                    <Trash2 color="#ef4444" size={24} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setSelectedTrx(null)}>
                  <X color={colors.text} size={24} />
                </TouchableOpacity>
              </View>
            </View>

            {selectedTrx && (
              <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Section Info */}
                <View 
                   className="p-6 rounded-3xl border mb-6 space-y-4"
                   style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                >
                   <View className="flex-row items-center gap-3">
                      <UserCircle color={colors.accent} size={20} />
                      <View>
                        <Text className="text-[10px] font-bold text-app-text-muted uppercase">Pelanggan</Text>
                        <Text className="font-black" style={{ color: colors.text }}>{selectedTrx.customerName || 'Umum'}</Text>
                      </View>
                   </View>
                   <View className="flex-row items-center gap-3">
                      <User color={colors.accent} size={20} />
                      <View>
                        <Text className="text-[10px] font-bold text-app-text-muted uppercase">Operator Kasir</Text>
                        <Text className="font-black" style={{ color: colors.text }}>{(selectedTrx.cashierName || 'Online (Sistem)').split('@')[0]}</Text>
                      </View>
                   </View>
                   <View className="flex-row items-center gap-3">
                      <Calendar color={colors.accent} size={20} />
                      <View>
                        <Text className="text-[10px] font-bold text-app-text-muted uppercase">Waktu Transaksi</Text>
                        <Text className="font-black" style={{ color: colors.text }}>{formatDate(selectedTrx.timestamp)}</Text>
                      </View>
                   </View>

                   {selectedTrx.dueDate ? (
                     <View className="flex-row items-center gap-3 pt-3 border-t" style={{ borderColor: colors.border }}>
                        <Calendar color="#f43f5e" size={20} />
                        <View>
                          <Text className="text-[10px] font-black text-rose-500 uppercase">Jatuh Tempo</Text>
                          <Text className="font-black text-rose-500">
                            {new Date(selectedTrx.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </Text>
                        </View>
                     </View>
                   ) : null}
                </View>

                {/* Daftar Belanja */}
                <Text className="text-[10px] font-black uppercase tracking-[2px] mb-4 ml-2" style={{ color: colors.textMuted }}>
                  Daftar Belanja
                </Text>

                <View className="space-y-4 mb-6">
                  {selectedTrx.items?.map((item, idx) => (
                    <View key={idx} className="flex-row justify-between items-start mb-3 pb-3 border-b" style={{ borderColor: colors.border + '20' }}>
                      <View className="flex-1 pr-4">
                        <Text className="font-bold text-sm" style={{ color: colors.text }}>{item.productName}</Text>
                        <Text className="text-[11px] mt-0.5" style={{ color: colors.textMuted }}>{item.qty} x Rp {item.price.toLocaleString('id-ID')}</Text>
                        
                        {item.note ? (
                          <View className="bg-amber-500/10 px-2.5 py-1 rounded mt-1.5 self-start">
                            <Text className="text-[10px] font-bold italic" style={{ color: '#f59e0b' }}>Catatan: {item.note}</Text>
                          </View>
                        ) : null}

                        {item.selectedExtras && item.selectedExtras.length > 0 ? (
                          <View className="flex-row flex-wrap gap-1 mt-1.5">
                            {item.selectedExtras.map((ext: any, eIdx: number) => (
                              <View key={eIdx} className="px-2 py-0.5 bg-slate-500/5 border border-slate-500/10 rounded-md">
                                <Text className="text-[8px] font-bold" style={{ color: colors.textMuted }}>
                                  + {ext.optionName}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : null}

                        {item.warrantyExpiry ? (
                          <View className="mt-2 flex-row items-center gap-1.5 flex-wrap">
                            <ShieldCheck size={14} color={new Date(item.warrantyExpiry) > new Date() ? "#10b981" : "#f43f5e"} />
                            <Text className={`text-[10px] font-black uppercase tracking-wider ${new Date(item.warrantyExpiry) > new Date() ? "text-emerald-500" : "text-rose-500"}`}>
                              Garansi {new Date(item.warrantyExpiry) > new Date() ? "Aktif" : "Habis"}
                            </Text>
                            <TouchableOpacity 
                              onPress={() => handleClaimWarranty(item)}
                              activeOpacity={0.6}
                              className="px-2 py-0.5 bg-slate-500/5 rounded border border-slate-500/10"
                            >
                              <Text className="text-[8px] font-black" style={{ color: colors.textMuted }}>CLAIM</Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
                      
                      <Text className="font-black text-sm" style={{ color: colors.text }}>
                         Rp {(item.subtotal || (item.price * item.qty)).toLocaleString('id-ID')}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Ledger Histori Pembayaran (Jika Ada) */}
                {selectedTrx.paymentHistory && selectedTrx.paymentHistory.length > 0 ? (
                  <View className="mt-4 mb-6">
                    <Text className="text-[10px] font-black uppercase tracking-[2px] mb-4 ml-2" style={{ color: colors.textMuted }}>
                      Histori Pembayaran
                    </Text>
                    
                    {selectedTrx.paymentHistory.map((hist, idx) => (
                      <View 
                        key={idx} 
                        className="flex-row justify-between items-center p-3 rounded-2xl border mb-3"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                      >
                        <View className="flex-1">
                          <Text className="text-xs font-black" style={{ color: colors.text }}>{hist.note}</Text>
                          <Text className="text-[9px] uppercase mt-1 font-bold" style={{ color: colors.textMuted }}>
                            {new Date(hist.date).toLocaleString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Text>
                        </View>
                        <Text className="text-sm font-black text-emerald-500">
                          Rp {hist.amount.toLocaleString('id-ID')}
                        </Text>
                      </View>
                    ))}
                    
                    <View className="p-4 rounded-2xl border mt-2 space-y-2" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                      <View className="flex-row justify-between items-center">
                        <Text className="text-[10px] font-bold uppercase tracking-[1px]" style={{ color: colors.textMuted }}>Telah Terbayar</Text>
                        <Text className="text-sm font-black text-emerald-500">
                          Rp {(selectedTrx.paidAmount || 0).toLocaleString('id-ID')}
                        </Text>
                      </View>
                      
                      {selectedTrx.paymentStatus !== 'paid' && (
                        <View className="flex-row justify-between items-center pt-2 border-t" style={{ borderColor: colors.border }}>
                          <Text className="text-[10px] font-bold uppercase tracking-[1px]" style={{ color: colors.textMuted }}>Sisa Piutang</Text>
                          <Text className="text-base font-black text-rose-500">
                            Rp {Math.max(0, selectedTrx.total - (selectedTrx.paidAmount || 0)).toLocaleString('id-ID')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ) : null}

                {/* Section Kalkulasi & Pajak */}
                <View className="border-t mt-4 pt-6 space-y-2" style={{ borderColor: colors.border }}>
                   <View className="flex-row justify-between text-xs font-bold uppercase tracking-[1px]">
                     <Text style={{ color: colors.textMuted }}>Subtotal</Text>
                     <Text style={{ color: colors.text }}>Rp {((selectedTrx.total || 0) - (selectedTrx.tax || 0)).toLocaleString('id-ID')}</Text>
                   </View>
                   
                   {selectedTrx.tax ? (
                     <View className="flex-row justify-between text-xs font-bold uppercase tracking-[1px]">
                       <Text style={{ color: colors.textMuted }}>Pajak PPN</Text>
                       <Text style={{ color: colors.text }}>Rp {selectedTrx.tax.toLocaleString('id-ID')}</Text>
                     </View>
                   ) : null}
                   
                   <View className="flex-row justify-between items-center pt-4 border-t mt-2" style={{ borderColor: colors.border }}>
                      <Text className="text-xl font-bold" style={{ color: colors.text }}>Total Akhir</Text>
                      <Text className="text-3xl font-black" style={{ color: colors.accent }}>
                         Rp {selectedTrx.total.toLocaleString('id-ID')}
                      </Text>
                   </View>

                   {selectedTrx.paymentMethod?.toLowerCase() === 'cash' && selectedTrx.cashReceived !== undefined ? (
                     <View className="pt-3 space-y-2 border-t mt-2" style={{ borderColor: colors.border }}>
                       <View className="flex-row justify-between text-xs font-bold uppercase tracking-[1px]">
                         <Text style={{ color: colors.textMuted }}>Tunai</Text>
                         <Text style={{ color: colors.text }}>Rp {selectedTrx.cashReceived.toLocaleString('id-ID')}</Text>
                       </View>
                       <View className="flex-row justify-between text-xs font-black uppercase tracking-[1px]">
                         <Text style={{ color: '#10b981' }}>Kembalian</Text>
                         <Text style={{ color: '#10b981' }}>Rp {selectedTrx.change?.toLocaleString('id-ID')}</Text>
                       </View>
                     </View>
                   ) : null}
                </View>

                {/* Section Action Buttons Grid */}
                <View className="mt-8 pt-6 border-t gap-3" style={{ borderColor: colors.border }}>
                  <View className="flex-row gap-2">
                    <TouchableOpacity 
                      onPress={() => Linking.openURL(`https://ikasir.my.id/invoice?id=${selectedTrx.id}`)}
                      activeOpacity={0.7}
                      className="flex-1 flex-row items-center justify-center gap-2 py-3.5 rounded-2xl border"
                      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                      <Printer size={16} color="#10b981" /> 
                      <Text className="text-[11px] font-black uppercase" style={{ color: colors.text }}>INVOICE</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => Linking.openURL(`https://ikasir.my.id/delivery?id=${selectedTrx.id}`)}
                      activeOpacity={0.7}
                      className="flex-1 flex-row items-center justify-center gap-2 py-3.5 rounded-2xl border"
                      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                      <Truck size={16} color="#3b82f6" /> 
                      <Text className="text-[11px] font-black uppercase" style={{ color: colors.text }}>SURAT JALAN</Text>
                    </TouchableOpacity>
                  </View>

                  <View className="flex-row gap-2">
                    <TouchableOpacity 
                      onPress={() => handleShareSignatureLink('trx', selectedTrx.id!)}
                      activeOpacity={0.7}
                      className="flex-1 flex-row items-center justify-center gap-2 py-3.5 rounded-2xl border"
                      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                      <Share2 size={16} color="#f59e0b" /> 
                      <Text className="text-[11px] font-black uppercase" style={{ color: colors.text }}>BAGIKAN TTD</Text>
                    </TouchableOpacity>

                    {selectedTrx.paymentStatus !== 'paid' && (
                      <TouchableOpacity 
                        onPress={() => handleSendWA(selectedTrx)}
                        activeOpacity={0.7}
                        className="flex-1 flex-row items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-500"
                      >
                        <MessageCircle size={16} color="#ffffff" /> 
                        <Text className="text-[11px] font-black uppercase text-white">INGATKAN WA</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity 
                    onPress={() => setViewingReceipt(selectedTrx)}
                    activeOpacity={0.7}
                    className="w-full flex-row items-center justify-center gap-2 py-4 rounded-2xl"
                    style={{ backgroundColor: colors.accent }}
                  >
                    <Printer size={18} color="#000000" /> 
                    <Text className="text-xs font-black uppercase text-black">
                      {selectedTrx.paymentStatus === 'paid' ? 'CETAK STRUK THERMAL' : 'CETAK STRUK'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Struk Digital */}
      <Modal visible={viewingReceipt !== null} animationType="fade" transparent>
        <View className="flex-1 bg-black/70 justify-center items-center">
          <View 
            className="rounded-[32px] overflow-hidden flex-col"
            style={{ 
              backgroundColor: '#ffffff',
              width: screenWidth * 0.9,
              height: screenHeight * 0.82
            }}
          >
            {/* Header Modal */}
            <View className="p-6 border-b border-slate-100 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View className="p-2 bg-emerald-500/10 rounded-xl">
                  <History color="#10b981" size={18} />
                </View>
                <Text className="text-lg font-black text-slate-900 italic">Struk Digital</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setViewingReceipt(null)}
                className="p-2 bg-slate-50 rounded-xl"
              >
                <X color="#94a3b8" size={20} />
              </TouchableOpacity>
            </View>

            {/* Konten Struk (Paper) */}
            <ScrollView className="flex-1 px-5 py-6" contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
              <View className="items-center mb-6">
                {storeSettings?.logoUrl && storeSettings?.showLogoOnReceipt !== false ? (
                  <Image 
                    source={{ uri: storeSettings.logoUrl }} 
                    className="w-12 h-12 mb-2 opacity-60" 
                    resizeMode="contain" 
                  />
                ) : null}
                <Text className="text-sm font-black uppercase text-slate-900 text-center">
                  {storeSettings?.storeName || 'Toko Kami'}
                </Text>
                {storeSettings?.showReceiptAddress !== false && storeSettings?.address ? (
                  <Text className="text-[10px] font-mono text-slate-500 text-center mt-1">
                    {storeSettings.address}
                  </Text>
                ) : null}
                {storeSettings?.showReceiptPhone !== false && storeSettings?.phone ? (
                  <Text className="text-[10px] font-mono text-slate-500 text-center mt-0.5">
                    Telp: {storeSettings.phone}
                  </Text>
                ) : null}
                
                <Text className="text-slate-300 font-mono text-[10px] mt-4 w-full text-center" numberOfLines={1}>
                  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
                </Text>
              </View>

              {/* Detail Transaksi */}
              <View className="space-y-1 font-mono text-[10px] mb-6">
                <View className="flex-row justify-between">
                  <Text className="text-[10px] font-mono text-slate-500">Nomor TRX</Text>
                  <Text className="text-[10px] font-mono font-bold text-slate-900">
                    #{(viewingReceipt?.id || "").toUpperCase()}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-[10px] font-mono text-slate-500">Tanggal</Text>
                  <Text className="text-[10px] font-mono font-bold text-slate-900">
                    {formatDate(viewingReceipt?.timestamp)}
                  </Text>
                </View>
                {storeSettings?.showReceiptCustomer !== false && (
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-mono text-slate-500">Pelanggan</Text>
                    <Text className="text-[10px] font-mono font-bold text-slate-900">
                      {viewingReceipt?.customerName || 'Umum'}
                    </Text>
                  </View>
                )}
                {storeSettings?.showReceiptCashier !== false && (
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-mono text-slate-500">Kasir</Text>
                    <Text className="text-[10px] font-mono font-bold text-slate-900">
                      {(viewingReceipt?.cashierName || 'Online').split('@')[0]}
                    </Text>
                  </View>
                )}
                
                <Text className="text-slate-300 font-mono text-[10px] mt-4 w-full text-center" numberOfLines={1}>
                  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
                </Text>
              </View>

              {/* List Item */}
              <View className="space-y-4 mb-6">
                {viewingReceipt?.items?.map((item: any, idx: number) => (
                  <View key={idx} className="space-y-1">
                    <View className="flex-row justify-between">
                      <Text className="flex-1 mr-4 font-mono font-bold text-slate-900 uppercase text-[10px]">
                        {item.productName || item.name}
                      </Text>
                      <Text className="font-mono font-bold text-slate-900 text-[10px]">
                        Rp {(item.subtotal || (item.price * item.qty) || 0).toLocaleString('id-ID')}
                      </Text>
                    </View>
                    
                    <View className="flex-row justify-between">
                      <Text className="font-mono text-slate-500 text-[10px]">
                        {item.qty} x {(item.price || 0).toLocaleString('id-ID')}
                      </Text>
                      
                      <View className="items-end">
                        {item.note ? (
                          <Text className="font-mono text-[9px] text-slate-500 italic">
                            ({item.note})
                          </Text>
                        ) : null}
                        {item.warrantyExpiry ? (
                          <Text className="font-mono text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded mt-1">
                            🛡️ Garansi s/d: {new Date(item.warrantyExpiry).toLocaleDateString('id-ID', {
                              day: '2-digit', month: '2-digit', year: '2-digit'
                            })}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {item.selectedExtras && item.selectedExtras.length > 0 ? (
                      <View className="pl-2 border-l border-slate-100 mt-1 space-y-0.5">
                        {item.selectedExtras.map((ex: any, ei: number) => (
                          <View key={ei} className="flex-row justify-between">
                            <Text className="font-mono text-[9px] text-slate-400">+ {ex.optionName}</Text>
                            <Text className="font-mono text-[9px] text-slate-400">Rp {(ex.price || 0).toLocaleString('id-ID')}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))}
                
                <Text className="text-slate-300 font-mono text-[10px] mt-4 w-full text-center" numberOfLines={1}>
                  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
                </Text>
              </View>

              {/* Kalkulasi Akhir */}
              <View className="space-y-2 mb-6">
                {storeSettings?.showReceiptSubtotal !== false && (
                  <View className="flex-row justify-between">
                    <Text className="font-mono text-slate-500 text-[10px]">SUBTOTAL</Text>
                    <Text className="font-mono font-bold text-slate-900 text-[10px]">
                      Rp {(viewingReceipt?.subtotal || (viewingReceipt?.total || 0) - (viewingReceipt?.tax || 0)).toLocaleString('id-ID')}
                    </Text>
                  </View>
                )}
                {(viewingReceipt?.tax ?? 0) > 0 && (
                  <View className="flex-row justify-between">
                    <Text className="font-mono text-slate-500 text-[10px]">PAJAK (PPN)</Text>
                    <Text className="font-mono font-bold text-slate-900 text-[10px]">
                      Rp {(viewingReceipt?.tax || 0).toLocaleString('id-ID')}
                    </Text>
                  </View>
                )}
                
                <View className="flex-row justify-between pt-2 border-t border-slate-200">
                  <Text className="font-mono font-black text-slate-900 text-xs">TOTAL</Text>
                  <Text className="font-mono font-black text-slate-900 text-xs">
                    Rp {(viewingReceipt?.total || 0).toLocaleString('id-ID')}
                  </Text>
                </View>
                
                {viewingReceipt?.paymentStatus === 'paid' && (
                  <>
                    <View className="flex-row justify-between">
                      <Text className="font-mono text-slate-500 text-[10px]">
                        {viewingReceipt?.cashReceived ? 'UANG DITERIMA' : 'DIBAYAR'}
                      </Text>
                      <Text className="font-mono font-bold text-emerald-600 text-[10px]">
                        Rp {(viewingReceipt?.cashReceived || viewingReceipt?.total || 0).toLocaleString('id-ID')}
                      </Text>
                    </View>
                    {(viewingReceipt?.change ?? 0) > 0 && (
                      <View className="flex-row justify-between">
                        <Text className="font-mono text-slate-500 text-[10px]">KEMBALIAN</Text>
                        <Text className="font-mono font-bold text-slate-900 text-[10px]">
                          Rp {(viewingReceipt?.change || 0).toLocaleString('id-ID')}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Footer Pesan */}
              <View className="items-center pt-4">
                <Text className="font-bold font-mono text-slate-900 text-[10px] text-center">
                  {storeSettings?.receiptMessage || 'Terima Kasih Atas Kunjungan Anda'}
                </Text>
              </View>
            </ScrollView>

            {/* Button Aksi */}
            <View className="p-6 bg-slate-50 flex-row gap-2 border-t border-slate-200">
              <TouchableOpacity 
                onPress={() => setViewingReceipt(null)}
                className="flex-1 py-4 bg-slate-200 rounded-2xl items-center justify-center"
              >
                <Text className="font-black text-slate-600 text-xs uppercase">Tutup</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={async () => {
                  if (viewingReceipt) {
                    await handlePrintAction(viewingReceipt);
                  }
                }}
                className="flex-[2] py-4 bg-slate-900 rounded-2xl items-center justify-center flex-row gap-2 shadow-lg shadow-slate-900/10"
              >
                <Printer size={16} color="#ffffff" />
                <Text className="font-black text-white text-xs uppercase">Cetak ke Printer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Bluetooth Printer Manager */}
      <Modal visible={isBluetoothModalVisible} animationType="slide" transparent>
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

