import React, { useState, useEffect, useMemo } from 'react';
import { Calendar as RNCalendar } from 'react-native-calendars';
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
  useWindowDimensions,
  NativeModules,
  Platform,
  PermissionsAndroid,
  Animated,
  Switch
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
  LayoutList,
  Sparkles,
  Calendar,
  Shield
} from 'lucide-react-native';
import { CameraView, useCameraPermissions, Camera as ExpoCamera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon } from 'lucide-react-native';
import { Audio, Video, ResizeMode } from 'expo-av';
import { printReceipt } from '../utils/ReceiptHelper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SignaturePad from '../components/SignaturePad';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingSkeleton from '../components/LoadingSkeleton';

const getFontStyle = (id: string) => {
  switch (id) {
    case 'serif':
      return {
        fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
        fontWeight: 'bold' as const
      };
    case 'mono':
      return {
        fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
        fontWeight: 'normal' as const
      };
    case 'elegant':
      return {
        fontFamily: Platform.select({ ios: 'System', android: 'sans-serif-light' }),
        fontWeight: '300' as const,
        letterSpacing: 1.2
      };
    case 'bold':
      return {
        fontFamily: Platform.select({ ios: 'System', android: 'sans-serif-condensed' }),
        fontWeight: '900' as const,
        letterSpacing: -0.2
      };
    case 'railey':
      return {
        fontFamily: 'Railey',
        textTransform: 'none' as const
      };
    case 'cheque':
      return {
        fontFamily: 'Cheque-Regular',
        textTransform: 'uppercase' as const,
        letterSpacing: 1
      };
    case 'lovelo':
      return {
        fontFamily: 'Lovelo-LineBold',
        textTransform: 'uppercase' as const,
        letterSpacing: 1.5
      };
    case 'sancreek':
      return {
        fontFamily: 'Sancreek-Regular',
        textTransform: 'none' as const
      };
    default: // sans
      return {
        fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
        fontWeight: 'bold' as const
      };
  }
};

// Types
interface Product {
  id?: string;
  name: string;
  price: number;
  purchasePrice?: number;
  stock: number;
  category: string;
  imageUrl?: string;
  imageUrls?: string[];
  manageStock?: boolean;
  hasExtras?: boolean;
  extras?: string[];
  barcode?: string;
  sku?: string;
  description?: string;
  expiryDate?: string;
  warrantyDuration?: number;
  warrantyUnit?: 'days' | 'months' | 'years';
  unit?: string;
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

const getCategoryColors = (categoryName: string, isDarkTheme: boolean) => {
  const cat = (categoryName || 'Umum').toLowerCase().trim();
  
  const palette: Record<string, { bg: string; border: string; text: string; catText: string }> = {
    'service': { bg: '#eff6ff', border: '#bfdbfe', text: '#1e3a8a', catText: '#2563eb' }, // Blue
    'jasa': { bg: '#eff6ff', border: '#bfdbfe', text: '#1e3a8a', catText: '#2563eb' }, 
    'oli': { bg: '#fef3c7', border: '#fde68a', text: '#78350f', catText: '#d97706' }, // Amber
    'oil': { bg: '#fef3c7', border: '#fde68a', text: '#78350f', catText: '#d97706' },
    'ban': { bg: '#f3e8ff', border: '#e9d5ff', text: '#581c87', catText: '#9333ea' }, // Purple
    'tire': { bg: '#f3e8ff', border: '#e9d5ff', text: '#581c87', catText: '#9333ea' },
    'sparepart': { bg: '#ecfdf5', border: '#a7f3d0', text: '#064e3b', catText: '#059669' }, // Emerald
    'part': { bg: '#ecfdf5', border: '#a7f3d0', text: '#064e3b', catText: '#059669' },
    'lainnya': { bg: '#f1f5f9', border: '#e2e8f0', text: '#0f172a', catText: '#64748b' }, // Slate
    'umum': { bg: '#fdf2f8', border: '#fbcfe8', text: '#831843', catText: '#db2777' }, // Pink
  };
  
  const getFallbackColors = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % 6;
    const fallbacks = [
      { bg: '#eff6ff', border: '#bfdbfe', text: '#1e3a8a', catText: '#2563eb' }, // Blue
      { bg: '#ecfdf5', border: '#a7f3d0', text: '#064e3b', catText: '#059669' }, // Emerald
      { bg: '#fef3c7', border: '#fde68a', text: '#78350f', catText: '#d97706' }, // Amber
      { bg: '#f3e8ff', border: '#e9d5ff', text: '#581c87', catText: '#9333ea' }, // Purple
      { bg: '#fdf2f8', border: '#fbcfe8', text: '#831843', catText: '#db2777' }, // Pink
      { bg: '#e0f2fe', border: '#bae6fd', text: '#0c4a6e', catText: '#0284c7' }, // Sky
    ];
    return fallbacks[index];
  };

  const chosen = palette[cat] || getFallbackColors(cat);
  
  if (isDarkTheme) {
    return {
      bg: cat === 'lainnya' ? 'rgba(255,255,255,0.04)' : `${chosen.catText}15`,
      border: `${chosen.catText}40`,
      text: '#ffffff',
      catText: chosen.catText
    };
  }
  
  return chosen;
};

interface SuccessTransactionModalProps {
  visible: boolean;
  successTrx: any;
  onClose: () => void;
  onViewReceipt: (trx: any) => void;
  colors: any;
}

const SuccessTransactionModal: React.FC<SuccessTransactionModalProps> = ({
  visible,
  successTrx,
  onClose,
  onViewReceipt,
  colors
}) => {
  // Animation values
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.7)).current;
  const pulseAnim = React.useRef(new Animated.Value(0)).current;
  const iconScaleAnim = React.useRef(new Animated.Value(0)).current;
  const checkmarkScale = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      // Reset values
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.7);
      pulseAnim.setValue(0);
      iconScaleAnim.setValue(0);
      checkmarkScale.setValue(0);

      // Start animation sequence
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(100),
          Animated.spring(iconScaleAnim, {
            toValue: 1,
            friction: 5,
            tension: 50,
            useNativeDriver: true,
          }),
          Animated.spring(checkmarkScale, {
            toValue: 1,
            friction: 4,
            tension: 60,
            useNativeDriver: true,
          })
        ]),
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            })
          ])
        )
      ]).start();

      // Trigger premium double-vibration haptic feedback
      try {
        Vibration.vibrate([0, 50, 40, 80]);
      } catch (e) {}
    }
  }, [visible]);

  if (!visible) return null;

  const pulseScale1 = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.2],
  });

  const pulseOpacity1 = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.35, 0.15, 0],
  });

  const pulseScale2 = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.6],
  });

  const pulseOpacity2 = pulseAnim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.25, 0.08, 0],
  });

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <Animated.View 
        className="flex-1 bg-black/80 items-center justify-center p-6"
        style={{ opacity: fadeAnim }}
      >
        <Animated.View 
          className="w-full max-w-sm rounded-[40px] p-8 items-center border" 
          style={{ 
            backgroundColor: colors.surface,
            borderColor: colors.border,
            transform: [{ scale: scaleAnim }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 10,
          }}
        >
          {/* Animated Success Icon Container */}
          <View className="items-center justify-center mb-6 relative w-28 h-28">
            {/* Pulsing rings in background */}
            <Animated.View 
              style={{
                position: 'absolute',
                width: 68,
                height: 68,
                borderRadius: 34,
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                transform: [{ scale: pulseScale1 }],
                opacity: pulseOpacity1,
              }}
            />
            <Animated.View 
              style={{
                position: 'absolute',
                width: 68,
                height: 68,
                borderRadius: 34,
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                transform: [{ scale: pulseScale2 }],
                opacity: pulseOpacity2,
              }}
            />

            {/* Glowing Icon Base */}
            <Animated.View 
              className="w-20 h-20 rounded-full items-center justify-center border-4"
              style={{ 
                backgroundColor: '#10b981', 
                borderColor: '#a7f3d0',
                transform: [{ scale: iconScaleAnim }],
                shadowColor: '#10b981',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              {/* Checkmark inside */}
              <Animated.View style={{ transform: [{ scale: checkmarkScale }] }}>
                <Check color="white" size={38} strokeWidth={4.5} />
              </Animated.View>
            </Animated.View>
          </View>

          <Text className="text-xl font-black text-center mb-2" style={{ color: colors.text }}>
            {successTrx?.isEstimation ? 'ESTIMASI SUKSES' : 'TRANSAKSI SUKSES'}
          </Text>
          <Text className="text-xs text-app-text-muted text-center mb-6">
            {successTrx?.isEstimation 
              ? `Tercatat di data penawaran/estimasi dengan ID #${successTrx?.id}` 
              : `Tercatat di antrean/transaksi dengan ID #${successTrx?.id?.substring(0, 8)}`}
          </Text>

          <View className="w-full border p-4 rounded-2xl mb-6 text-sm space-y-2" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
            <View className="flex-row justify-between">
              <Text className="text-[10px] font-bold" style={{ color: colors.textMuted }}>Total Tagihan</Text>
              <Text className="text-xs font-black" style={{ color: colors.text }}>Rp {successTrx?.total.toLocaleString('id-ID')}</Text>
            </View>
            {successTrx?.paymentCategory === 'direct' && successTrx?.paymentMethod === 'cash' && (
              <>
                <View className="flex-row justify-between">
                  <Text className="text-[10px] font-bold" style={{ color: colors.textMuted }}>Diterima</Text>
                  <Text className="text-xs font-black" style={{ color: colors.text }}>Rp {successTrx?.cashReceived.toLocaleString('id-ID')}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-[10px] font-bold text-emerald-500">Kembalian</Text>
                  <Text className="text-xs font-black text-emerald-500">Rp {successTrx?.change.toLocaleString('id-ID')}</Text>
                </View>
              </>
            )}
            {successTrx?.paymentCategory === 'debt' && (
              <>
                <View className="flex-row justify-between">
                  <Text className="text-[10px] font-bold" style={{ color: colors.textMuted }}>Dibayar (DP)</Text>
                  <Text className="text-xs font-black" style={{ color: colors.text }}>Rp {successTrx?.paidAmount?.toLocaleString('id-ID')}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-[10px] font-bold text-rose-500">Sisa Piutang</Text>
                  <Text className="text-xs font-black text-rose-500">Rp {successTrx?.debtAmount?.toLocaleString('id-ID')}</Text>
                </View>
              </>
            )}
          </View>

          <View className="w-full gap-2">
            <TouchableOpacity 
              onPress={() => onViewReceipt(successTrx)} 
              className="w-full py-4 rounded-2xl flex-row items-center justify-center gap-2 active:opacity-95"
              style={{ backgroundColor: colors.accent }}
            >
              <Printer color="white" size={18} />
              <Text className="text-center font-black text-xs text-white">LIHAT STRUK DIGITAL</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} className="w-full py-4 rounded-2xl bg-accent/10 active:opacity-90">
              <Text className="text-center font-black text-xs" style={{ color: colors.accent }}>SELESAI</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const UNIT_CATEGORIES = [
  { 
    name: 'Pcs', 
    units: [
      { label: 'Pcs (pc)', value: 'pcs' },
      { label: 'Lusin (ls)', value: 'ls' },
      { label: 'Gross (grs)', value: 'grs' }
    ] 
  },
  { 
    name: 'Berat', 
    units: [
      { label: 'Gram (g)', value: 'g' },
      { label: 'Ons (ons)', value: 'ons' },
      { label: 'Kilogram (kg)', value: 'kg' }
    ] 
  },
  { 
    name: 'Volume', 
    units: [
      { label: 'Mililiter (ml)', value: 'ml' },
      { label: 'Liter (L)', value: 'L' }
    ] 
  },
  { 
    name: 'Panjang', 
    units: [
      { label: 'Centimeter (cm)', value: 'cm' },
      { label: 'Meter (m)', value: 'm' }
    ] 
  }
];

export default function POSScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const { user, storeId, isSubscriptionExpired, expiredDisabledMenus } = useAuthStore();
  const blockedWhenExpired = expiredDisabledMenus || [];
  const isExpiredBlocked = isSubscriptionExpired && blockedWhenExpired.includes('/pos');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [storeSettings, setStoreSettings] = useState<any>({
    useTax: false,
    taxRate: 0,
    storeName: '',
    phone: '',
    address: '',
    receiptMessage: '',
    qrisUrl: '',
    bankInfo: '',
    storeBanks: [] as any[],
    storeEwallets: [] as any[],
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
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Bluetooth Printer states
  const [isBluetoothModalVisible, setIsBluetoothModalVisible] = useState(false);
  const [isBluetoothScanning, setIsBluetoothScanning] = useState(false);
  const [isBluetoothConnecting, setIsBluetoothConnecting] = useState(false);
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
    setIsBluetoothScanning(true);
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
        setIsBluetoothScanning(false);
      }, 2000);
      return;
    }

    try {
      const hasPermission = await requestBluetoothPermissions();
      if (!hasPermission) {
        setIsBluetoothScanning(false);
        return;
      }

      const isEnabled = await BluetoothManager.isBluetoothEnabled();
      if (!isEnabled) {
        setIsBluetoothScanning(false);
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
          setIsBluetoothScanning(false);
        } catch (parseErr) {
          console.error("Gagal parse bluetooth list:", parseErr);
          setIsBluetoothScanning(false);
        }
      }, (err: any) => {
        console.error("Gagal memindai bluetooth:", err);
        setIsBluetoothScanning(false);
      });
    } catch (err) {
      console.error(err);
      setIsBluetoothScanning(false);
    }
  };

  const handlePrintAction = async (trx: any) => {
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
                  await printReceipt(trx, storeSettings);
                  setViewingReceipt(null);
                  setSuccessTrx(null);
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
    setIsBluetoothConnecting(true);
    Vibration.vibrate(15);
    
    if (!BluetoothManager) {
      // Simulator connection lag
      setTimeout(async () => {
        try {
          setIsBluetoothConnecting(false);
          setActivePrinter(device.name);
          await AsyncStorage.setItem('selected_printer', device.name);
          await AsyncStorage.setItem('selected_printer_address', device.address);
          Vibration.vibrate([0, 15, 50, 15]);
          
          setIsBluetoothModalVisible(false);
          
          if (viewingReceipt) {
            try {
              await printReceipt(viewingReceipt, storeSettings);
              setViewingReceipt(null);
              setSuccessTrx(null);
            } catch (err) {
              console.error("Error printing receipt:", err);
              Alert.alert("Gagal Mencetak", "Tidak dapat mengirim data ke printer.");
            }
          }
        } catch (err) {
          setIsBluetoothConnecting(false);
          Alert.alert("Koneksi Gagal", `Tidak dapat berpasangan dengan ${device.name}. Silakan coba lagi.`);
        }
      }, 1500);
      return;
    }

    try {
      await BluetoothManager.connect(device.address);
      
      setIsBluetoothConnecting(false);
      setActivePrinter(device.name);
      await AsyncStorage.setItem('selected_printer', device.name);
      await AsyncStorage.setItem('selected_printer_address', device.address);
      Vibration.vibrate([0, 15, 50, 15]);
      
      setIsBluetoothModalVisible(false);
      
      if (viewingReceipt) {
        try {
          // Wait 500ms for connection to stabilize before printing
          await new Promise(resolve => setTimeout(resolve, 500));
          await printReceipt(viewingReceipt, storeSettings);
          setViewingReceipt(null);
          setSuccessTrx(null);
        } catch (err) {
          console.error("Error printing receipt:", err);
          Alert.alert("Gagal Mencetak", "Tidak dapat mengirim data ke printer.");
        }
      }
    } catch (err) {
      setIsBluetoothConnecting(false);
      Alert.alert("Koneksi Gagal", `Tidak dapat berpasangan dengan ${device.name}. Silakan coba lagi.`);
    }
  };

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
  const [newCustomerNpwp, setNewCustomerNpwp] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [allCustomers, setAllCustomers] = useState<{id: string, name: string, phone?: string}[]>([]);
  const [showCustomerListModal, setShowCustomerListModal] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Manual Item States
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualItemName, setManualItemName] = useState('');
  const [manualItemPrice, setManualItemPrice] = useState('');
  const [manualItemCategory, setManualItemCategory] = useState('Jasa');
  const [manualItemUnit, setManualItemUnit] = useState('Pcs');
  const [useManualItemCustomUnit, setUseManualItemCustomUnit] = useState(false);
  const [showManualCategoryModal, setShowManualCategoryModal] = useState(false);
  const [showManualCustomCategoryModal, setShowManualCustomCategoryModal] = useState(false);
  const [manualCustomCategoryText, setManualCustomCategoryText] = useState('');
  const [saveToCatalog, setSaveToCatalog] = useState(true);
  const [manualItemBarcode, setManualItemBarcode] = useState('');
  const [manualItemDescription, setManualItemDescription] = useState('');
  const [manualItemExpiryDate, setManualItemExpiryDate] = useState('');
  const [manualItemWarrantyDuration, setManualItemWarrantyDuration] = useState('');
  const [manualItemWarrantyUnit, setManualItemWarrantyUnit] = useState<'days' | 'months' | 'years'>('months');
  const [scanTarget, setScanTarget] = useState<'cart' | 'manual_barcode'>('cart');
  const [manualItemCalendarVisible, setManualItemCalendarVisible] = useState(false);
  const [manualItemImages, setManualItemImages] = useState<string[]>([]);
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
  const [estimationValidityDays, setEstimationValidityDays] = useState('30');
  // Item notes expand
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

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

          // Prepopulate estimation validity days based on difference or default
          if (est.validUntil) {
            const vDate = new Date(est.validUntil);
            const baseDate = est.timestamp ? (est.timestamp.toDate ? est.timestamp.toDate() : new Date(est.timestamp)) : new Date();
            const diffTime = vDate.getTime() - baseDate.getTime();
            const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
            setEstimationValidityDays(String(diffDays));
          } else {
            setEstimationValidityDays('30');
          }

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
    const unsubscribeSettings = onSnapshot(
      doc(db, 'settings', `store_${storeId}`),
      (docSnap) => {
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
            storeBanks: data.storeBanks || [],
            storeEwallets: data.storeEwallets || [],
            ...data
          });
        }
      },
      (err) => {
        console.error("Error fetching settings:", err);
      }
    );

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

    // Active & upcoming Flash Sales fetch
    const qFlash = query(
      collection(db, 'flash_sales'),
      where('storeId', '==', storeId),
      where('isActive', '==', true)
    );
    const unsubscribeFlash = onSnapshot(qFlash, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      // Import store dynamically or via React state
      // We will set this directly to flashSaleStore
      const { setFlashSales } = require('../store/flashSaleStore').useFlashSaleStore.getState();
      setFlashSales(items);
    }, (err) => {
      console.error("Error loading flash sales in POS:", err);
    });

    return () => {
      unsubscribeProd();
      unsubscribeDisc();
      unsubscribeSettings();
      unsubscribeFlash();
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

  const categoriesList = useMemo(() => {
    const cats = new Set(['Umum', 'Makanan', 'Minuman', 'Snack', 'Bahan Baku', 'Aksesoris', 'Jasa', ...products.map(p => p.category || 'Umum')]);
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
                          (p.category && p.category.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getEffectivePrice = (product: Product) => {
    // 1. Check active Flash Sale
    const { flashSales } = require('../store/flashSaleStore').useFlashSaleStore.getState();
    const now = new Date();
    const activeFlashSale = (flashSales as any[]).find(fs => {
      if (!fs.isActive) return false;
      const start = new Date(fs.startTime);
      const end = new Date(fs.endTime);
      if (now < start || now > end) return false;

      const fsProd = fs.products?.find((p: any) => p.productId === product.id);
      if (!fsProd) return false;

      // Check if stock has not been fully claimed
      return (fsProd.soldCount || 0) < (fsProd.flashStock || 0);
    });

    if (activeFlashSale) {
      const fsProd = activeFlashSale.products.find((p: any) => p.productId === product.id);
      return {
        price: fsProd.flashPrice,
        discountInfo: {
          name: `⚡ ${activeFlashSale.name}`,
          originalPrice: product.price,
          isFlashSale: true,
          soldCount: fsProd.soldCount || 0,
          flashStock: fsProd.flashStock || 0,
          endTime: activeFlashSale.endTime
        }
      };
    }

    // 2. Regular Discount fallback
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

    if (discountInfo?.isFlashSale) {
      const remainingFlashStock = discountInfo.flashStock - discountInfo.soldCount;
      const existing = cart.find(item => item.uniqueId === uniqueId);
      const currentQty = existing ? existing.cartQty : 0;
      if (currentQty >= remainingFlashStock) {
        Alert.alert('Batas Flash Sale', `Jumlah pembelian melebihi sisa stok Flash Sale (${remainingFlashStock} pcs).`);
        return;
      }
    }

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

    if (discountInfo?.isFlashSale) {
      const remainingFlashStock = discountInfo.flashStock - discountInfo.soldCount;
      const existing = cart.find(item => item.uniqueId === uniqueId);
      const currentQty = existing ? existing.cartQty : 0;
      if (currentQty >= remainingFlashStock) {
        Alert.alert('Batas Flash Sale', `Jumlah pembelian melebihi sisa stok Flash Sale (${remainingFlashStock} pcs).`);
        return;
      }
    }

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

          // Check Flash Sale limits
          const { price: _, discountInfo } = getEffectivePrice(item);
          if (discountInfo?.isFlashSale) {
            const remainingFlashStock = discountInfo.flashStock - discountInfo.soldCount;
            if (newQty > remainingFlashStock) {
              Alert.alert('Batas Flash Sale', `Jumlah pembelian melebihi sisa stok Flash Sale (${remainingFlashStock} pcs).`);
              return item;
            }
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
        npwp: newCustomerNpwp.trim(),
        address: newCustomerAddress.trim(),
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
      setNewCustomerNpwp('');
      setNewCustomerAddress('');
      Vibration.vibrate(15);
    } catch (err) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal menyimpan pelanggan baru.');
    } finally {
      setIsProcessing(false);
    }
  };

  const loadAllCustomers = async () => {
    if (!storeId) return;
    try {
      const q = query(collection(db, 'customers'), where('storeId', '==', storeId));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        phone: doc.data().phone || ''
      }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setAllCustomers(list);
    } catch (err) {
      console.error("Error loading all customers:", err);
    }
  };

  const pickManualItemImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setManualItemImages(prev => [...prev, result.assets[0].uri]);
    }
  };

  const takeManualItemPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Ditolak', 'Maaf, kami butuh izin kamera untuk mengambil foto.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setManualItemImages(prev => [...prev, result.assets[0].uri]);
    }
  };

  const recordManualItemVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    const micStatus = await ExpoCamera.requestMicrophonePermissionsAsync();
    if (status !== 'granted' || micStatus.status !== 'granted') {
      Alert.alert('Izin Ditolak', 'Kami butuh izin kamera & mikrofon untuk merekam video.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 30,
      quality: 0.8,
    });

    if (!result.canceled) {
      setManualItemImages(prev => [...prev, result.assets[0].uri]);
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
      const uploadedImageUrls: string[] = [];

      // Upload to Cloudinary if manualItemImages are selected
      if (manualItemImages && manualItemImages.length > 0) {
        for (const localUri of manualItemImages) {
          const formDataUpload = new FormData();
          const filename = localUri.split('/').pop() || 'file';
          const match = /\.(\w+)$/.exec(filename);
          const ext = match ? match[1].toLowerCase() : '';
          const isVideo = ['mp4', 'mov', '3gp', 'm4v', 'avi'].includes(ext);
          const type = isVideo ? (match ? `video/${match[1]}` : 'video/mp4') : (match ? `image/${match[1]}` : 'image/jpeg');

          formDataUpload.append('file', { uri: localUri, name: filename, type } as any);
          formDataUpload.append('upload_preset', 'kasirpos');

          const uploadUrl = isVideo 
            ? 'https://api.cloudinary.com/v1_1/dkcjfwbvc/video/upload'
            : 'https://api.cloudinary.com/v1_1/dkcjfwbvc/image/upload';

          const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            body: formDataUpload,
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

          const uploadResult = await uploadRes.json();
          if (uploadRes.ok && uploadResult.secure_url) {
            uploadedImageUrls.push(uploadResult.secure_url);
          } else {
            console.error('Cloudinary error:', uploadResult);
            throw new Error('Gagal mengunggah salah satu foto produk manual');
          }
        }
      }

      const finalImageUrl = uploadedImageUrls[0] || '';

      if (saveToCatalog) {
        const prodData = {
          storeId,
          name: manualItemName,
          price,
          originalPrice: price,
          stock: 999,
          manageStock: false,
          category: manualItemCategory,
          barcode: manualItemBarcode.trim() || '',
          description: manualItemDescription.trim() || '',
          expiryDate: manualItemExpiryDate.trim() || '',
          warrantyDuration: Number(manualItemWarrantyDuration) || 0,
          warrantyUnit: manualItemWarrantyUnit,
          unit: manualItemUnit.trim() || 'Pcs',
          imageUrl: finalImageUrl,
          imageUrls: uploadedImageUrls,
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
        barcode: manualItemBarcode.trim() || '',
        description: manualItemDescription.trim() || '',
        expiryDate: manualItemExpiryDate.trim() || '',
        warrantyDuration: Number(manualItemWarrantyDuration) || 0,
        warrantyUnit: manualItemWarrantyUnit,
        unit: manualItemUnit.trim() || 'Pcs',
        imageUrl: finalImageUrl,
        imageUrls: uploadedImageUrls,
        selectedExtras: [],
        discountName: null,
        note: ''
      };

      setCart(prev => [...prev, manualItem]);
      setIsManualModalOpen(false);
      setManualItemName('');
      setManualItemPrice('');
      setManualItemCategory('Jasa');
      setManualItemUnit('Pcs');
      setUseManualItemCustomUnit(false);
      setSaveToCatalog(true);
      setManualItemBarcode('');
      setManualItemDescription('');
      setManualItemExpiryDate('');
      setManualItemWarrantyDuration('');
      setManualItemWarrantyUnit('months');
      setManualItemImages([]);
      Vibration.vibrate(15);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Gagal', err.message || 'Gagal menambahkan item manual.');
    } finally {
      setIsProcessing(false);
    }
  };

    const updateFlashSaleSoldCount = async (items: CartItem[]) => {
    try {
      const { flashSales } = require('../store/flashSaleStore').useFlashSaleStore.getState();
      const now = new Date();
      const activeFlashSale = (flashSales as any[]).find(fs => {
        if (!fs.isActive) return false;
        const start = new Date(fs.startTime);
        const end = new Date(fs.endTime);
        return now >= start && now <= end;
      });

      if (!activeFlashSale) return;

      const fsDocRef = doc(db, 'flash_sales', activeFlashSale.id);
      const fsSnap = await getDoc(fsDocRef);
      if (!fsSnap.exists()) return;

      const fsData = fsSnap.data();
      const updatedProducts = (fsData.products || []).map((p: any) => {
        const cartItem = items.find(item => item.id === p.productId);
        if (cartItem && cartItem.discountName?.startsWith('⚡')) {
          return {
            ...p,
            soldCount: (p.soldCount || 0) + cartItem.cartQty
          };
        }
        return p;
      });

      await updateDoc(fsDocRef, { products: updatedProducts });
    } catch (err) {
      console.error("Gagal memperbarui stok Flash Sale:", err);
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
        
        const validityDays = parseInt(estimationValidityDays) || 30;
        const validUntilDate = new Date();
        validUntilDate.setDate(localNow.getDate() + validityDays);
        const finalValidUntil = validUntilDate.toISOString();

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
        await updateFlashSaleSoldCount(cart);

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
        transactionData.paymentMethod = dp > 0 ? paymentMethod : null;
        if (dp > 0) {
          transactionData.paymentHistory = [{
            id: Math.random().toString(36).substring(2, 9),
            date: localNow.toISOString(),
            amount: dp,
            cashierName: user?.name || user?.displayName || 'Kasir',
            note: `Pembayaran Awal (DP - ${paymentMethod === 'cash' ? 'Tunai' : paymentMethod.toUpperCase()})`
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
        await updateFlashSaleSoldCount(cart);

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
      await updateFlashSaleSoldCount(cart);

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

  const startScanning = async (target: 'cart' | 'manual_barcode' = 'cart') => {
    setScanTarget(target);
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
    
    if (scanTarget === 'manual_barcode') {
      playBeep();
      setManualItemBarcode(data);
      Vibration.vibrate(15);
      setShowScanner(false);
      setIsScanning(false);
      return;
    }
    
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
        <View 
          className={isTabletOrLandscape ? 'flex-[2] border-r relative overflow-hidden' : 'flex-1 relative'}
          style={isTabletOrLandscape ? { borderColor: colors.border } : undefined}
        >
      
      {/* SUBSCRIPTION EXPIRED OVERLAY */}
      {isExpiredBlocked && (
        <View className="absolute inset-0 z-[100] justify-center p-6" style={{ backgroundColor: colors.bg + 'f2' }}>
          <View className="border rounded-[32px] p-8 items-center shadow-2xl" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <View className="bg-rose-500/10 p-5 rounded-full mb-6">
              <Lock size={40} color="#f43f5e" />
            </View>
            <Text className="text-xl font-black uppercase tracking-tight mb-2 text-center" style={{ color: colors.text }}>Akses Terkunci</Text>
            <Text className="text-xs font-bold text-center leading-relaxed mb-6" style={{ color: colors.textMuted }}>
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
        <View className="absolute inset-0 z-50 justify-center p-6" style={{ backgroundColor: colors.bg + 'f2' }}>
          <View className="border rounded-[32px] p-8 items-center shadow-2xl" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <View className="bg-rose-500/10 p-5 rounded-full mb-6">
              <Lock size={40} color="#f43f5e" />
            </View>
            <Text className="text-xl font-black uppercase tracking-tight mb-2" style={{ color: colors.text }}>Shift Belum Dibuka!</Text>
            <Text className="text-xs font-bold text-center leading-relaxed mb-6" style={{ color: colors.textMuted }}>
              Akses aplikasi kasir terkunci. Silakan buka shift Anda dengan menginput Modal Awal di laci kas terlebih dahulu.
            </Text>

            <View className="w-full space-y-2 mb-6">
              <Text className="text-[10px] font-black uppercase tracking-widest pl-2" style={{ color: colors.textMuted }}>Modal Awal / Uang Kas Laci (Rp)</Text>
              <View className="relative justify-center">
                <Text className="absolute left-5 text-sm font-black z-10" style={{ color: colors.textMuted }}>RP</Text>
                <TextInput
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={startingCash}
                  onChangeText={setStartingCash}
                  className="w-full border rounded-2xl py-4 pl-12 pr-6 text-lg font-black"
                  style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
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
              onPress={() => startScanning('cart')}
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

      {/* Flash Sale Banner */}
      {(() => {
        const { flashSales } = require('../store/flashSaleStore').useFlashSaleStore.getState();
        const activeFlash = (flashSales as any[]).find(fs => {
          if (!fs.isActive) return false;
          const start = new Date(fs.startTime);
          const end = new Date(fs.endTime);
          return currentTime >= start && currentTime <= end;
        });

        if (!activeFlash) return null;

        const end = new Date(activeFlash.endTime);
        const diff = end.getTime() - currentTime.getTime();
        if (diff <= 0) return null;

        const hrs = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        const timeStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        // Calculate progress
        const totalStock = activeFlash.products?.reduce((acc: number, p: any) => acc + (p.flashStock || 0), 0) || 0;
        const totalSold = activeFlash.products?.reduce((acc: number, p: any) => acc + (p.soldCount || 0), 0) || 0;
        const percent = totalStock > 0 ? (totalSold / totalStock) * 100 : 0;

        return (
          <View className="mx-4 mt-3 p-4 rounded-3xl bg-red-600 border border-red-500 shadow-sm flex flex-col gap-2">
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-white text-base">⚡</Text>
                <Text className="text-white font-black text-xs uppercase tracking-wider">FLASH SALE AKTIF</Text>
              </View>
              <View className="bg-white/20 px-2.5 py-1 rounded-xl">
                <Text className="text-white font-mono font-black text-xs">{timeStr}</Text>
              </View>
            </View>
            <View className="flex-row justify-between items-center mt-1">
              <Text className="text-red-100 text-[10px] font-bold uppercase">{activeFlash.name}</Text>
              <Text className="text-red-100 text-[10px] font-black">{Math.round(percent)}% Terjual</Text>
            </View>
            <View className="w-full h-1.5 bg-red-800 rounded-full overflow-hidden">
              <View className="h-full bg-yellow-400 rounded-full" style={{ width: `${percent}%` }} />
            </View>
          </View>
        );
      })()}

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
            const isLightTheme = colors.bg.toLowerCase() === '#f8fafc' || colors.bg.toLowerCase() === '#f4fbf7' || colors.bg.toLowerCase() === '#fffaf5' || colors.bg.toLowerCase() === '#faf5f5';
            const isDark = !isLightTheme;
            const catColors = getCategoryColors(item.category, isDark);

            if (viewMode === 'tiles') {
              return (
                <TouchableOpacity 
                  onPress={() => addToCart(item)}
                  activeOpacity={0.7}
                  disabled={isOutOfStock}
                  className="flex-1 m-2 p-3 rounded-[24px] border"
                  style={{ 
                    backgroundColor: catColors.bg,
                    borderColor: catColors.border,
                    opacity: isOutOfStock ? 0.6 : 1
                  }}
                >
                  <View 
                    className="w-full aspect-square rounded-2xl mb-3 overflow-hidden items-center justify-center relative"
                    style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
                  >
                    {item.imageUrl || (item.imageUrls && item.imageUrls.length > 0 && item.imageUrls[0]) ? (
                      <Image source={{ uri: item.imageUrl || item.imageUrls?.[0] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <Package color={catColors.text} opacity={0.2} size={40} />
                    )}
                    
                    {isOutOfStock && (
                      <View className="absolute inset-0 bg-black/60 items-center justify-center">
                        <View className="bg-rose-500 px-3 py-1 rounded-full border border-rose-600">
                          <Text className="text-[9px] font-black text-white uppercase tracking-wider">HABIS</Text>
                        </View>
                      </View>
                    )}

                    {!isOutOfStock && hasPromo && (
                      <View 
                        className="absolute top-2 left-2 px-2 py-0.5 rounded-lg"
                        style={{ backgroundColor: discountInfo?.isFlashSale ? '#dc2626' : '#10b981' }}
                      >
                        <Text className="text-[8px] font-black text-white uppercase">
                          {discountInfo?.isFlashSale ? '⚡ FLASH' : 'PROMO'}
                        </Text>
                      </View>
                    )}

                    {item.hasExtras && (
                      <View className="absolute top-2 right-2 bg-emerald-500 px-2 py-0.5 rounded-lg">
                        <Text className="text-[8px] font-black text-white">+ EXTRA</Text>
                      </View>
                    )}
                  </View>
                  
                  <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: catColors.catText }}>{item.category || 'Umum'}</Text>
                  <Text className="text-sm font-black mt-0.5 mb-2" style={{ color: catColors.text }} numberOfLines={2}>{item.name}</Text>
                  {item.warrantyDuration ? (
                    <Text className="text-[8px] font-black text-blue-500 uppercase tracking-wider mb-2">
                      🛡️ Garansi: {item.warrantyDuration} {item.warrantyUnit === 'days' ? 'Hari' : item.warrantyUnit === 'months' ? 'Bulan' : 'Tahun'}
                    </Text>
                  ) : null}

                  {discountInfo?.isFlashSale && (
                    <View className="mb-2">
                      <View className="flex-row justify-between mb-1">
                        <Text className="text-[8px] text-slate-400 font-bold">Stok Promo</Text>
                        <Text className="text-[8px] text-red-500 font-black">
                          Sisa {discountInfo.flashStock - discountInfo.soldCount}
                        </Text>
                      </View>
                      <View className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <View 
                          className="h-full bg-red-500" 
                          style={{ width: `${((discountInfo.flashStock - discountInfo.soldCount) / discountInfo.flashStock) * 100}%` }}
                        />
                      </View>
                    </View>
                  )}
                  
                  <View className="flex-row justify-between items-end mt-auto pt-2 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.15)' }}>
                    <View>
                      {hasPromo && (
                        <Text className="text-[9px] line-through text-slate-500">
                          Rp {item.price.toLocaleString('id-ID')}
                        </Text>
                      )}
                      <Text className="font-black text-xs" style={{ color: discountInfo?.isFlashSale ? '#dc2626' : '#15803d' }}>
                        Rp {displayPrice.toLocaleString('id-ID')}
                      </Text>
                    </View>
                    
                    <View 
                      className="w-7 h-7 rounded-xl items-center justify-center border"
                      style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)', borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.2)' }}
                    >
                      <Plus size={14} color={catColors.text} />
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
                    backgroundColor: catColors.bg,
                    borderColor: catColors.border,
                    opacity: isOutOfStock ? 0.6 : 1
                  }}
                >
                  <View className="flex-1 pr-4">
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-xs font-bold" style={{ color: catColors.text }} numberOfLines={1}>{item.name}</Text>
                      {discountInfo?.isFlashSale && (
                        <View className="bg-red-600 px-1 rounded">
                          <Text className="text-[7px] font-black text-white">⚡ FLASH</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-[9px] font-bold mt-0.5 uppercase tracking-wider" style={{ color: catColors.catText }}>
                      {item.category || 'Umum'} {item.warrantyDuration ? `| 🛡️ Garansi: ${item.warrantyDuration} ${item.warrantyUnit === 'days' ? 'Hari' : item.warrantyUnit === 'months' ? 'Bulan' : 'Tahun'}` : ''}
                    </Text>
                  </View>
                  <View className="items-end shrink-0">
                    <Text className="font-black text-xs" style={{ color: discountInfo?.isFlashSale ? '#dc2626' : '#15803d' }}>
                      Rp {displayPrice.toLocaleString('id-ID')}
                    </Text>
                    {item.manageStock !== false && (
                      <Text className="text-[9px] font-bold mt-0.5" style={{ color: isDark ? '#94a3b8' : '#475569' }}>
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
                  backgroundColor: catColors.bg,
                  borderColor: catColors.border,
                  opacity: isOutOfStock ? 0.6 : 1
                }}
              >
                <View 
                  className="w-16 h-16 rounded-2xl overflow-hidden items-center justify-center relative shrink-0"
                  style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
                >
                  {item.imageUrl || (item.imageUrls && item.imageUrls.length > 0 && item.imageUrls[0]) ? (
                    <Image source={{ uri: item.imageUrl || item.imageUrls?.[0] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <Package color={catColors.text} opacity={0.2} size={24} />
                  )}
                  
                  {isOutOfStock && (
                    <View className="absolute inset-0 bg-black/50 items-center justify-center">
                      <Text className="text-[8px] font-black text-rose-500 uppercase tracking-widest">HABIS</Text>
                    </View>
                  )}

                  {!isOutOfStock && discountInfo?.isFlashSale && (
                    <View className="absolute top-1 left-1 bg-red-600 px-1 rounded">
                      <Text className="text-[6px] font-black text-white">⚡ FLASH</Text>
                    </View>
                  )}
                </View>

                <View className="flex-1 min-w-0">
                  <Text className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: catColors.catText }}>{item.category || 'Umum'}</Text>
                  <Text className="text-sm font-black mb-1 truncate" style={{ color: catColors.text }}>{item.name}</Text>
                  {item.warrantyDuration ? (
                    <Text className="text-[8px] font-black text-blue-500 uppercase tracking-wider mb-1">
                      🛡️ Garansi: {item.warrantyDuration} {item.warrantyUnit === 'days' ? 'Hari' : item.warrantyUnit === 'months' ? 'Bulan' : 'Tahun'}
                    </Text>
                  ) : null}
                  <View className="flex-row items-center gap-2">
                    <Text className="font-black text-xs" style={{ color: discountInfo?.isFlashSale ? '#dc2626' : '#15803d' }}>
                      Rp {displayPrice.toLocaleString('id-ID')}
                    </Text>
                    {item.sku && (
                      <Text className="text-[9px] font-mono" style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                        SKU: {item.sku}
                      </Text>
                    )}
                  </View>
                </View>

                <View className="items-end shrink-0 pl-2">
                  {item.manageStock !== false && (
                    <View 
                      className="px-2 py-0.5 rounded-lg"
                      style={{ backgroundColor: 'rgba(16,185,129,0.15)' }}
                    >
                      <Text 
                        className="text-[9px] font-black uppercase tracking-wider"
                        style={{ color: '#10b981' }}
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
              // Only reset customer query/selected customer if not loaded from params
              if (!customerQuery) {
                setCustomerQuery('');
                setSelectedCustomer(null);
              }
              if (editingEstimationId) {
                setPaymentCategory('estimasi');
              } else {
                setPaymentCategory('direct');
              }
              setPaymentMethod('cash');
              setCashReceived('');
              setDebtDownPayment('');
              setDueDate(getFutureDateString(14));
              setEstimationValidityDays('30');
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
          <View className="h-[85%] rounded-t-[40px] p-6" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row items-center justify-between mb-6">
              <View>
                <Text className="text-lg font-black" style={{ color: colors.text }}>Tambah Item Manual</Text>
                <Text className="text-xs font-bold" style={{ color: colors.textMuted }}>Jasa / Barang tidak terdaftar</Text>
              </View>
              <TouchableOpacity onPress={() => setIsManualModalOpen(false)}>
                <X color={colors.textMuted} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 space-y-4">
              {/* Foto Produk Manual */}
              {/* Foto Produk Manual (Multi-Foto) */}
              <View className="space-y-2 mb-2 w-full">
                <View className="flex-row justify-between items-center pl-1 pr-1">
                  <Text className="text-[10px] font-black uppercase tracking-widest" style={{ color: colors.textMuted }}>Foto Produk (Opsional)</Text>
                  <Text className="text-[8px] font-bold text-slate-400">{manualItemImages.length}/5 Foto</Text>
                </View>
                <View className="p-4 rounded-2xl border w-full flex-row items-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }} className="flex-row">
                    {manualItemImages.map((uri, index) => {
                      const isVid = uri.endsWith('.mp4') || uri.endsWith('.mov') || uri.endsWith('.3gp') || uri.endsWith('.m4v') || uri.includes('/video/upload/');
                      return (
                        <View key={index} className="w-20 h-20 rounded-xl bg-black/5 border overflow-hidden mr-3 justify-center items-center relative" style={{ borderColor: colors.border }}>
                          {isVid ? (
                            <View className="w-full h-full justify-center items-center bg-slate-900">
                              <Video
                                source={{ uri }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode={ResizeMode.CONTAIN}
                                useNativeControls={false}
                                shouldPlay={false}
                                isMuted={true}
                              />
                              <View className="absolute bg-black/60 px-1 py-0.5 rounded bottom-1 right-1">
                                <Text className="text-[5px] font-black text-white uppercase">VIDEO</Text>
                              </View>
                            </View>
                          ) : (
                            <Image source={{ uri }} className="w-full h-full" style={{ resizeMode: 'cover' }} />
                          )}
                          <TouchableOpacity 
                            onPress={() => setManualItemImages(prev => prev.filter((_, idx) => idx !== index))}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-500 items-center justify-center shadow shadow-black/20"
                          >
                            <X size={10} color="#ffffff" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                    
                    {manualItemImages.length < 5 && (
                      <View className="flex-row gap-3">
                        <TouchableOpacity
                          onPress={takeManualItemPhoto}
                          className="w-20 h-20 rounded-xl border border-dashed justify-center items-center bg-black/5 flex-col"
                          style={{ borderColor: colors.border }}
                        >
                          <Camera size={18} color={colors.textMuted} />
                          <Text className="text-[8px] font-black uppercase text-slate-400 mt-1">Kamera</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={recordManualItemVideo}
                          className="w-20 h-20 rounded-xl border border-dashed justify-center items-center bg-black/5 flex-col"
                          style={{ borderColor: colors.border }}
                        >
                          <Camera size={18} color="#e11d48" />
                          <Text className="text-[8px] font-black uppercase text-rose-500 mt-1">Video</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={pickManualItemImage}
                          className="w-20 h-20 rounded-xl border border-dashed justify-center items-center bg-black/5 flex-col"
                          style={{ borderColor: colors.border }}
                        >
                          <ImageIcon size={18} color={colors.textMuted} />
                          <Text className="text-[8px] font-black uppercase text-slate-400 mt-1">Galeri</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    
                    {manualItemImages.length === 0 && (
                      <View className="ml-2 flex-1 justify-center">
                        <Text className="text-[9px] font-bold text-slate-400 italic">Klik tombol Kamera/Galeri untuk memilih foto produk manual.</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              </View>

              <View className="space-y-1">
                <Text className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: colors.textMuted }}>Nama Item</Text>
                <TextInput
                  placeholder="e.g. Ongkos Kirim / Servis AC"
                  placeholderTextColor={colors.textMuted + '60'}
                  value={manualItemName}
                  onChangeText={setManualItemName}
                  className="border rounded-[1.25rem] p-4 text-sm font-bold"
                  style={{ backgroundColor: colors.surface, borderColor: colors.border + '40', color: colors.text }}
                />
              </View>

              <View className="space-y-1">
                <Text className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: colors.textMuted }}>Harga (Rp)</Text>
                <TextInput
                  placeholder="0"
                  placeholderTextColor={colors.textMuted + '60'}
                  keyboardType="numeric"
                  value={manualItemPrice}
                  onChangeText={setManualItemPrice}
                  className="border rounded-[1.25rem] p-4 text-sm font-black"
                  style={{ backgroundColor: colors.surface, borderColor: colors.border + '40', color: colors.text }}
                />
              </View>

              <View className="space-y-1">
                <Text className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: colors.textMuted }}>Kategori</Text>
                <TouchableOpacity
                  onPress={() => setShowManualCategoryModal(true)}
                  className="border rounded-[1.25rem] p-4 flex-row items-center justify-between"
                  style={{ backgroundColor: colors.surface, borderColor: colors.border + '40' }}
                >
                  <Text className="font-bold text-sm" style={{ color: manualItemCategory ? colors.text : colors.textMuted }}>
                    {manualItemCategory || 'Pilih Kategori'}
                  </Text>
                  <ChevronDown size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-[10px] font-black uppercase tracking-[2px] ml-1" style={{ color: colors.textMuted }}>Satuan</Text>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[9px] font-bold uppercase" style={{ color: colors.textMuted }}>Kostum Satuan</Text>
                    <Switch
                      value={useManualItemCustomUnit}
                      onValueChange={(val: boolean) => {
                        setUseManualItemCustomUnit(val);
                        if (!val) setManualItemUnit('Pcs');
                      }}
                      trackColor={{ false: colors.border, true: colors.accent }}
                      thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                  </View>
                </View>

                {!useManualItemCustomUnit ? (
                  <View className="p-4 rounded-2xl border flex-row items-center justify-between opacity-80" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                    <Text className="font-bold" style={{ color: colors.text }}>Pcs (pcs)</Text>
                    <Text className="text-[9px] font-bold px-2 py-0.5 rounded bg-teal-500/10 text-teal-500">DEFAULT</Text>
                  </View>
                ) : (
                  <View className="mt-1 p-4 rounded-2xl border flex gap-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                    {UNIT_CATEGORIES.map(category => (
                      <View key={category.name} className="flex gap-2">
                        <Text className="text-[9px] font-black uppercase tracking-wider" style={{ color: colors.textMuted }}>{category.name}</Text>
                        <View className="flex-row flex-wrap gap-2">
                          {category.units.map(u => (
                            <TouchableOpacity
                              key={u.value}
                              onPress={() => setManualItemUnit(u.value)}
                              className="px-3 py-2 rounded-xl border"
                              style={{
                                backgroundColor: manualItemUnit === u.value ? colors.accent + '20' : colors.bg,
                                borderColor: manualItemUnit === u.value ? colors.accent : colors.border
                              }}
                            >
                              <Text className="text-[10px] font-bold" style={{ color: manualItemUnit === u.value ? colors.accent : colors.text }}>
                                {u.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ))}
                    <View className="mt-2 border-t pt-3" style={{ borderColor: colors.border + '20' }}>
                      <Text className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>Kustom Lainnya</Text>
                      <TextInput
                        placeholder="Contoh: box, koli, sachet"
                        placeholderTextColor={colors.textMuted + '60'}
                        value={manualItemUnit}
                        onChangeText={setManualItemUnit}
                        className="p-3 rounded-xl border text-xs font-bold"
                        style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
                      />
                    </View>
                  </View>
                )}
              </View>
              {/* Barcode / Scan / Auto Generate */}
              <View className="space-y-1">
                <Text className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: colors.textMuted }}>Barcode (Opsional)</Text>
                <View className="flex-row gap-2">
                  <TextInput
                    placeholder="Barcode / scan / ketik..."
                    placeholderTextColor={colors.textMuted + '60'}
                    value={manualItemBarcode}
                    onChangeText={setManualItemBarcode}
                    className="flex-1 border rounded-[1.25rem] p-4 text-sm font-bold"
                    style={{ backgroundColor: colors.surface, borderColor: colors.border + '40', color: colors.text }}
                  />
                  <TouchableOpacity
                    onPress={() => startScanning('manual_barcode')}
                    className="p-4 rounded-[1.25rem] border justify-center items-center bg-accent/10"
                    style={{ borderColor: colors.accent + '30' }}
                  >
                    <Scan size={16} color={colors.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      const randomBarcode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
                      setManualItemBarcode(randomBarcode);
                      Vibration.vibrate(10);
                    }}
                    className="px-4 bg-accent rounded-[1.25rem] flex-row items-center justify-center gap-1 shadow-md shadow-accent/20"
                  >
                    <Sparkles size={14} color="#0f172a" />
                    <Text className="text-[10px] font-black text-[#0f172a] uppercase tracking-wider">AUTO</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Masa Berlaku (Expired) */}
              <View className="space-y-1">
                <Text className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: colors.textMuted }}>Masa Berlaku / Kedaluwarsa (Opsional)</Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setManualItemCalendarVisible(true)}
                    className="flex-1 border rounded-[1.25rem] p-4 flex-row items-center justify-between"
                    style={{ backgroundColor: colors.surface, borderColor: colors.border + '40' }}
                  >
                    <Text className="font-bold text-sm" style={{ color: manualItemExpiryDate ? colors.text : colors.textMuted }}>
                      {manualItemExpiryDate || 'Pilih Tanggal Kedaluwarsa'}
                    </Text>
                    <Calendar size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                  {manualItemExpiryDate ? (
                    <TouchableOpacity
                      onPress={() => setManualItemExpiryDate('')}
                      className="px-4 border rounded-[1.25rem] items-center justify-center bg-rose-500/10"
                      style={{ borderColor: 'rgba(244,63,94,0.2)' }}
                    >
                      <X size={16} color="#f43f5e" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {/* Garansi Produk */}
              <View className="space-y-1">
                <Text className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: colors.textMuted }}>Garansi Produk (Opsional)</Text>
                <View className="flex-row gap-2">
                  <TextInput
                    placeholder="Durasi (e.g. 1)"
                    placeholderTextColor={colors.textMuted + '60'}
                    keyboardType="numeric"
                    value={manualItemWarrantyDuration}
                    onChangeText={setManualItemWarrantyDuration}
                    className="flex-[1.2] border rounded-[1.25rem] p-4 text-sm font-bold"
                    style={{ backgroundColor: colors.surface, borderColor: colors.border + '40', color: colors.text }}
                  />
                  <View className="flex-1 flex-row border rounded-[1.25rem] p-1" style={{ backgroundColor: colors.surface, borderColor: colors.border + '40' }}>
                    {(['days', 'months', 'years'] as const).map((unit) => {
                      const label = unit === 'days' ? 'Hari' : unit === 'months' ? 'Bln' : 'Thn';
                      const isSelected = manualItemWarrantyUnit === unit;
                      return (
                        <TouchableOpacity
                          key={unit}
                          onPress={() => setManualItemWarrantyUnit(unit)}
                          className="flex-1 rounded-xl items-center justify-center"
                          style={{
                            backgroundColor: isSelected ? colors.accent : 'transparent'
                          }}
                        >
                          <Text className="text-[10px] font-black" style={{ color: isSelected ? '#0f172a' : colors.textMuted }}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              <View className="space-y-1">
                <Text className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: colors.textMuted }}>Deskripsi (Opsional)</Text>
                <TextInput
                  placeholder="Tambahkan deskripsi atau detail..."
                  placeholderTextColor={colors.textMuted + '60'}
                  multiline
                  numberOfLines={3}
                  value={manualItemDescription}
                  onChangeText={setManualItemDescription}
                  className="border rounded-[1.25rem] p-4 text-sm font-medium h-24 text-start"
                  textAlignVertical="top"
                  style={{ backgroundColor: colors.surface, borderColor: colors.border + '40', color: colors.text }}
                />
              </View>
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

      {/* Calendar Date Picker Modal for Manual Item Expiry */}
      <Modal visible={manualItemCalendarVisible} animationType="fade" transparent onRequestClose={() => setManualItemCalendarVisible(false)}>
        <View className="flex-1 bg-black/80 justify-center items-center p-6">
          <View className="w-full max-w-sm rounded-[36px] overflow-hidden" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row justify-between items-center p-6 border-b" style={{ borderColor: colors.border + '30' }}>
              <Text className="text-base font-black" style={{ color: colors.text }}>Pilih Masa Berlaku</Text>
              <TouchableOpacity onPress={() => setManualItemCalendarVisible(false)}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            <RNCalendar
              theme={{
                backgroundColor: colors.surface,
                calendarBackground: colors.surface,
                textSectionTitleColor: colors.textMuted,
                selectedDayBackgroundColor: colors.accent,
                selectedDayTextColor: '#ffffff',
                todayTextColor: colors.accent,
                dayTextColor: colors.text,
                textDisabledColor: colors.textMuted + '50',
                monthTextColor: colors.text,
                arrowColor: colors.accent,
                textDayFontWeight: 'bold',
                textMonthFontWeight: '900',
                textDayHeaderFontWeight: '800'
              }}
              current={manualItemExpiryDate || undefined}
              markedDates={{
                [manualItemExpiryDate || '']: {
                  selected: true,
                  disableTouchEvent: true,
                  selectedColor: colors.accent,
                  selectedTextColor: '#ffffff'
                }
              }}
              onDayPress={(day: any) => {
                setManualItemExpiryDate(day.dateString);
                setManualItemCalendarVisible(false);
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Manual Item Category Selection Drawer Modal */}
      <Modal visible={showManualCategoryModal} animationType="slide" transparent onRequestClose={() => setShowManualCategoryModal(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="h-[60%] rounded-t-[40px] p-6" style={{ backgroundColor: colors.bg }}>
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-lg font-black" style={{ color: colors.text }}>Pilih Kategori</Text>
                <Text className="text-xs font-bold" style={{ color: colors.textMuted }}>Kategori item manual</Text>
              </View>
              <TouchableOpacity onPress={() => setShowManualCategoryModal(false)} className="w-10 h-10 rounded-full bg-black/10 items-center justify-center">
                <X color={colors.text} size={20} />
              </TouchableOpacity>
            </View>
            <ScrollView className="flex-1">
              <View className="flex gap-2">
                {categoriesList.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => {
                      setManualItemCategory(cat);
                      setShowManualCategoryModal(false);
                    }}
                    className="p-4 rounded-2xl border flex-row items-center justify-between"
                    style={{ 
                      backgroundColor: colors.surface, 
                      borderColor: manualItemCategory === cat ? colors.accent : colors.border 
                    }}
                  >
                    <Text className="font-bold" style={{ color: colors.text }}>{cat}</Text>
                    {manualItemCategory === cat && <Check size={18} color={colors.accent} />}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  onPress={() => {
                    setShowManualCategoryModal(false);
                    setTimeout(() => {
                      setShowManualCustomCategoryModal(true);
                    }, 400);
                  }}
                  className="p-4 rounded-2xl border flex-row items-center justify-center border-dashed"
                  style={{ backgroundColor: colors.surface, borderColor: colors.accent }}
                >
                  <Plus size={18} color={colors.accent} style={{ marginRight: 8 }} />
                  <Text className="font-black" style={{ color: colors.accent }}>Kategori Kustom Baru...</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Manual Item Custom Category Input Dialog Modal */}
      <Modal visible={showManualCustomCategoryModal} animationType="fade" transparent onRequestClose={() => setShowManualCustomCategoryModal(false)}>
        <View className="flex-1 bg-black/75 items-center justify-center p-6">
          <View className="w-full max-w-sm rounded-[32px] p-6 items-center" style={{ backgroundColor: colors.surface }}>
            <Text className="text-base font-black text-center mb-4" style={{ color: colors.text }}>Kategori Kustom Baru</Text>
            <TextInput
              placeholder="Masukkan nama kategori..."
              placeholderTextColor={colors.textMuted + '60'}
              value={manualCustomCategoryText}
              onChangeText={setManualCustomCategoryText}
              className="w-full p-4 rounded-2xl border font-bold mb-4"
              style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
            />
            <View className="flex-row gap-3 w-full">
              <TouchableOpacity 
                onPress={() => {
                  setShowManualCustomCategoryModal(false);
                  setManualCustomCategoryText('');
                }} 
                className="flex-1 py-3.5 rounded-xl bg-background border items-center justify-center"
                style={{ borderColor: colors.border }}
              >
                <Text className="font-bold text-xs" style={{ color: colors.textMuted }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => {
                  if (manualCustomCategoryText.trim()) {
                    setManualItemCategory(manualCustomCategoryText.trim());
                    setShowManualCustomCategoryModal(false);
                    setManualCustomCategoryText('');
                  } else {
                    Alert.alert('Error', 'Nama kategori tidak boleh kosong.');
                  }
                }} 
                className="flex-1 py-3.5 rounded-xl items-center justify-center"
                style={{ backgroundColor: colors.accent }}
              >
                <Text className="font-black text-xs" style={{ color: colors.text }}>Tambah</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Close Shift Modal */}
      <Modal visible={isCloseShiftModalOpen} animationType="slide" transparent onRequestClose={() => setIsCloseShiftModalOpen(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="h-[80%] rounded-t-[40px] p-6" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row items-center justify-between mb-6">
              <View>
                <Text className="text-lg font-black" style={{ color: colors.text }}>Penutupan Shift Sesi</Text>
                <Text className="text-xs font-bold" style={{ color: colors.textMuted }}>Verifikasi Uang Fisik Di Laci Kas</Text>
              </View>
              <TouchableOpacity onPress={() => setIsCloseShiftModalOpen(false)}>
                <X color={colors.textMuted} size={24} />
              </TouchableOpacity>
            </View>

            {activeShift && (
              <ScrollView className="flex-1 space-y-4">
                
                {/* Stats Summary Card */}
                <View className="border rounded-2xl p-4 space-y-2 mb-2" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-black uppercase" style={{ color: colors.textMuted }}>Modal Awal</Text>
                    <Text className="text-xs font-bold" style={{ color: colors.text }}>Rp {activeShift.startingCash.toLocaleString('id-ID')}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-black uppercase" style={{ color: colors.textMuted }}>Penjualan Tunai</Text>
                    <Text className="text-xs font-bold" style={{ color: colors.text }}>Rp {activeStats.cashSales.toLocaleString('id-ID')}</Text>
                  </View>
                  <View className="border-t pt-2 flex-row justify-between" style={{ borderColor: colors.border }}>
                    <Text className="text-[10px] font-black uppercase" style={{ color: colors.textMuted }}>Estimasi Total Kas</Text>
                    <Text className="text-sm font-black text-emerald-400">
                      Rp {(activeShift.startingCash + activeStats.cashSales).toLocaleString('id-ID')}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-black uppercase" style={{ color: colors.textMuted }}>Non-Tunai (Transfer/QRIS)</Text>
                    <Text className="text-xs font-bold" style={{ color: colors.text }}>Rp {activeStats.nonCashSales.toLocaleString('id-ID')}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-black uppercase" style={{ color: colors.textMuted }}>Volume Penjualan</Text>
                    <Text className="text-xs font-bold" style={{ color: colors.text }}>{activeStats.trxCount} Transaksi</Text>
                  </View>
                </View>

                {/* Cash Input */}
                <View className="space-y-1">
                  <Text className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: colors.textMuted }}>Total Uang Fisik Di Laci (Rp)</Text>
                  <View className="relative justify-center">
                    <Text className="absolute left-4 text-sm font-black z-10" style={{ color: colors.textMuted }}>RP</Text>
                    <TextInput
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={actualCash}
                      onChangeText={setActualCash}
                      className="border rounded-2xl py-3.5 pl-12 pr-4 text-base font-black"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                    />
                  </View>
                </View>

                {/* Close Note */}
                <View className="space-y-1">
                  <Text className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: colors.textMuted }}>Catatan</Text>
                  <TextInput
                    placeholder="Masukkan catatan jika ada selisih laci..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                    value={closeNote}
                    onChangeText={setCloseNote}
                    className="border rounded-2xl py-3.5 px-4 text-sm font-bold h-20 text-start"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
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
          <View 
            className={isTabletOrLandscape ? "flex-[1.2] z-10" : "absolute inset-0 z-50 bg-black/60 justify-end"}
            style={isTabletOrLandscape ? { backgroundColor: colors.surface } : undefined}
          >
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
                        
                        {item.warrantyDuration ? (
                          <Text className="text-[9px] text-blue-500 font-bold mt-1">
                            🛡️ Garansi: {item.warrantyDuration} {item.warrantyUnit === 'days' ? 'Hari' : item.warrantyUnit === 'months' ? 'Bulan' : 'Tahun'}
                          </Text>
                        ) : null}
                        
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
                  <View className="flex-row gap-2">
                    <TouchableOpacity 
                      onPress={() => {
                        loadAllCustomers();
                        setCustomerSearchQuery('');
                        setShowCustomerListModal(true);
                      }}
                      className="flex-row items-center bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/20"
                    >
                      <Users size={12} color="#8b5cf6" />
                      <Text className="text-[9px] font-black text-indigo-400 ml-1.5 uppercase">Pilih</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => setIsAddCustomerModalOpen(true)}
                      className="flex-row items-center bg-accent/10 px-3 py-1.5 rounded-xl border border-accent/20"
                    >
                      <UserPlus size={12} color={colors.accent} />
                      <Text className="text-[9px] font-black text-accent ml-1.5 uppercase">Baru</Text>
                    </TouchableOpacity>
                  </View>
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
                  <View 
                    className="border rounded-2xl overflow-hidden p-1 shadow-2xl"
                    style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                  >
                    {suggestions.map(s => (
                      <TouchableOpacity 
                        key={s.id}
                        onPress={() => {
                          setSelectedCustomer(s);
                          setCustomerQuery(s.name.toLowerCase());
                          setSuggestions([]);
                        }}
                        className="p-3 border-b last:border-0"
                        style={{ borderColor: colors.border }}
                      >
                        <Text className="text-xs font-bold lowercase" style={{ color: colors.text }}>{s.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Transaction Category Selector */}
              <View className="space-y-2">
                <Text className="text-[9px] font-black uppercase tracking-widest ml-1" style={{ color: colors.textMuted }}>Kategori Pesanan</Text>
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
                    <View className="space-y-3 bg-black/5 p-4 rounded-2xl items-center w-full">
                      <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">Scan QRIS untuk Membayar</Text>
                      {storeSettings.qrisUrl ? (
                        <TouchableOpacity 
                          onPress={() => setZoomImageUrl(storeSettings.qrisUrl)}
                          className="p-2 bg-white rounded-2xl border border-black/5 shadow-sm active:scale-[0.98]"
                        >
                          <Image source={{ uri: storeSettings.qrisUrl }} style={{ width: 200, height: 200, resizeMode: 'contain' }} />
                        </TouchableOpacity>
                      ) : (
                        <View className="p-4 bg-rose-500/10 rounded-xl border border-rose-500/20 w-full items-center">
                          <Text className="text-xs font-bold text-rose-500 text-center">Foto QRIS belum diunggah.</Text>
                          <Text className="text-[10px] font-bold text-slate-500 text-center mt-1">Silakan unggah foto QRIS di menu Pengaturan Toko terlebih dahulu.</Text>
                        </View>
                      )}
                      
                      {/* E-Wallets List if configured */}
                      {storeSettings.storeEwallets && storeSettings.storeEwallets.length > 0 && (
                        <View className="space-y-1.5 w-full mt-2">
                          <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">Akun E-Wallet Pendukung</Text>
                          {storeSettings.storeEwallets.map((ew: any) => (
                            <View key={ew.id} className="p-2.5 bg-white rounded-xl border border-black/5 flex-row justify-between items-center">
                              <View>
                                <Text className="text-[9px] font-black uppercase text-indigo-600">{ew.ewalletName}</Text>
                                <Text className="text-xs font-black text-slate-900 mt-0.5">{ew.phoneNumber}</Text>
                                <Text className="text-[8px] font-bold text-slate-400">a.n. {ew.accountHolder}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}

                      {(storeSettings.qrisUrl || (storeSettings.storeEwallets && storeSettings.storeEwallets.length > 0)) && (
                         <Text className="text-[10px] font-black mt-2 text-center" style={{ color: colors.accent }}>Total Tagihan: Rp {total.toLocaleString('id-ID')}</Text>
                      )}
                    </View>
                  )}
 
                  {/* Bank Transfer details */}
                  {paymentMethod === 'transfer' && (
                    <View className="space-y-3 bg-black/5 p-4 rounded-2xl w-full">
                      <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">Info Rekening Transfer</Text>
                      {storeSettings.storeBanks && storeSettings.storeBanks.length > 0 ? (
                        <View className="space-y-2 w-full">
                          {storeSettings.storeBanks.map((bank: any) => (
                            <View key={bank.id} className="p-3 bg-white rounded-xl border border-black/5 shadow-sm">
                              <Text className="text-[9px] font-black uppercase text-emerald-600">{bank.bankName}</Text>
                              <Text className="text-xs font-black text-slate-900 mt-0.5">{bank.accountNumber}</Text>
                              <Text className="text-[8px] font-bold text-slate-400">a.n. {bank.accountHolder}</Text>
                            </View>
                          ))}
                        </View>
                      ) : storeSettings.bankInfo ? (
                        <View className="p-4 bg-white rounded-2xl border border-black/5 shadow-sm w-full">
                          <Text className="text-sm font-black text-center" style={{ color: colors.text }}>{storeSettings.bankInfo}</Text>
                        </View>
                      ) : (
                        <View className="p-4 bg-rose-500/10 rounded-xl border border-rose-500/20 w-full items-center">
                          <Text className="text-xs font-bold text-rose-500 text-center">Info Bank belum diatur.</Text>
                          <Text className="text-[10px] font-bold text-slate-500 text-center mt-1">Silakan atur Info Rekening di menu Pengaturan Toko.</Text>
                        </View>
                      )}
                      {(storeSettings.bankInfo || (storeSettings.storeBanks && storeSettings.storeBanks.length > 0)) && (
                         <Text className="text-[10px] font-black text-center mt-2" style={{ color: colors.accent }}>Total Tagihan: Rp {total.toLocaleString('id-ID')}</Text>
                      )}
                    </View>
                  )}
                </View>
              )}

              {paymentCategory === 'debt' && (
                <View className="space-y-3 bg-black/5 p-4 rounded-2xl">
                  {/* Metode Bayar DP */}
                  <View className="space-y-2 mb-1">
                    <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Metode Bayar DP</Text>
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
                          }}
                          className="flex-1 py-2.5 rounded-xl border active:opacity-90"
                          style={{
                            backgroundColor: paymentMethod === method.id ? colors.accent : colors.surface,
                            borderColor: paymentMethod === method.id ? colors.accent : 'rgba(0,0,0,0.05)'
                          }}
                        >
                          <Text 
                            className="text-[9px] font-black uppercase tracking-wider text-center"
                            style={{ color: paymentMethod === method.id ? '#0f172a' : colors.textMuted }}
                          >
                            {method.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

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

              {paymentCategory === 'estimasi' && (
                <View className="space-y-3 bg-black/5 p-4 rounded-2xl">
                  {/* Validity Period Input */}
                  <View className="space-y-1.5">
                    <Text className="text-[10px] font-black text-slate-400 uppercase ml-1">Masa Berlaku Estimasi (Hari)</Text>
                    <TextInput
                      placeholder="30"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={estimationValidityDays}
                      onChangeText={setEstimationValidityDays}
                      className="bg-white/50 border border-black/5 rounded-xl py-3.5 px-4 text-xs font-black"
                      style={{ color: colors.text }}
                    />
                    <Text className="text-[9px] font-bold text-slate-400 ml-1">
                      Masa aktif penawaran harga ini dalam hitungan hari.
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

      {/* Customer List Modal */}
      <Modal visible={showCustomerListModal} animationType="slide" transparent onRequestClose={() => setShowCustomerListModal(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="h-[75%] rounded-t-[40px] p-6" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row items-center justify-between mb-6">
              <View>
                <Text className="text-lg font-black" style={{ color: colors.text }}>Daftar Pelanggan</Text>
                <Text className="text-xs font-bold" style={{ color: colors.textMuted }}>Pilih pelanggan untuk transaksi</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCustomerListModal(false)}>
                <X color={colors.textMuted} size={24} />
              </TouchableOpacity>
            </View>

            {/* Local Search Input inside Modal */}
            <View className="bg-black/5 rounded-2xl flex-row items-center px-4 mb-4">
              <Search size={16} color={colors.textMuted} />
              <TextInput
                placeholder="Cari berdasarkan nama atau telepon..."
                placeholderTextColor={colors.textMuted}
                value={customerSearchQuery}
                onChangeText={setCustomerSearchQuery}
                className="flex-1 ml-2.5 py-3.5 text-xs font-bold"
                style={{ color: colors.text }}
              />
              {customerSearchQuery !== '' && (
                <TouchableOpacity onPress={() => setCustomerSearchQuery('')} className="p-1 bg-rose-500/10 rounded-full">
                  <X size={12} color="#f43f5e" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <View className="flex gap-2">
                {allCustomers.filter(c => 
                  c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) || 
                  (c.phone && c.phone.includes(customerSearchQuery))
                ).length === 0 ? (
                  <Text className="text-xs font-bold text-center text-rose-400 py-8">Pelanggan tidak ditemukan.</Text>
                ) : (
                  allCustomers.filter(c => 
                    c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) || 
                    (c.phone && c.phone.includes(customerSearchQuery))
                  ).map(c => {
                    const isSelected = selectedCustomer?.id === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => {
                          setSelectedCustomer(c);
                          setCustomerQuery(c.name);
                          setShowCustomerListModal(false);
                        }}
                        className="p-4 rounded-2xl border flex-row items-center justify-between"
                        style={{ 
                          backgroundColor: colors.bg, 
                          borderColor: isSelected ? colors.accent : colors.border 
                        }}
                      >
                        <View className="flex-1">
                          <Text className="font-bold text-sm" style={{ color: colors.text }}>{c.name}</Text>
                          {c.phone ? (
                            <Text className="text-[10px] font-medium mt-0.5" style={{ color: colors.textMuted }}>{c.phone}</Text>
                          ) : null}
                        </View>
                        {isSelected && <Check size={18} color={colors.accent} />}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Quick Add Customer Modal */}
      <Modal visible={isAddCustomerModalOpen} animationType="slide" transparent onRequestClose={() => setIsAddCustomerModalOpen(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="h-[75%] rounded-t-[40px] p-6" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row items-center justify-between mb-6">
              <View>
                <Text className="text-lg font-black" style={{ color: colors.text }}>Registrasi Pelanggan Baru</Text>
                <Text className="text-xs font-bold" style={{ color: colors.textMuted }}>Hubungkan piutang & pesanan</Text>
              </View>
              <TouchableOpacity onPress={() => setIsAddCustomerModalOpen(false)}>
                <X color={colors.textMuted} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 space-y-4">
              <View className="space-y-1">
                <Text className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: colors.textMuted }}>Nama Lengkap</Text>
                <TextInput
                  placeholder="Nama pelanggan..."
                  placeholderTextColor={colors.textMuted}
                  value={newCustomerName}
                  onChangeText={setNewCustomerName}
                  className="border rounded-2xl py-3 px-4 text-sm font-bold"
                  style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                />
              </View>

              <View className="space-y-1">
                <Text className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: colors.textMuted }}>Nomor Telepon</Text>
                <TextInput
                  placeholder="e.g. 08123456789"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  value={newCustomerPhone}
                  onChangeText={setNewCustomerPhone}
                  className="border rounded-2xl py-3 px-4 text-sm font-bold"
                  style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                />
              </View>

              <View className="space-y-1">
                <Text className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: colors.textMuted }}>Nomor NPWP Pelanggan</Text>
                <TextInput
                  placeholder="e.g. 01.234.567.8-901.000"
                  placeholderTextColor={colors.textMuted}
                  value={newCustomerNpwp}
                  onChangeText={setNewCustomerNpwp}
                  className="border rounded-2xl py-3 px-4 text-sm font-bold"
                  style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                />
              </View>

              <View className="space-y-1">
                <Text className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: colors.textMuted }}>Alamat Lengkap</Text>
                <TextInput
                  placeholder="Alamat pelanggan..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={2}
                  value={newCustomerAddress}
                  onChangeText={setNewCustomerAddress}
                  className="border rounded-2xl py-3 px-4 text-sm font-bold min-h-[60px]"
                  style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text, textAlignVertical: 'top' }}
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
      <SuccessTransactionModal
        visible={successTrx !== null}
        successTrx={successTrx}
        onClose={() => setSuccessTrx(null)}
        onViewReceipt={(trx) => setViewingReceipt(trx)}
        colors={colors}
      />

      {/* Digital Receipt Modal (Struk Digital) */}
      <Modal visible={viewingReceipt !== null} animationType="slide" transparent onRequestClose={() => setViewingReceipt(null)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="h-[85%] rounded-t-[40px] p-6" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row items-center justify-between mb-4 border-b pb-3" style={{ borderColor: colors.border }}>
              <View className="flex-row items-center gap-2">
                <View className="p-2 bg-emerald-500/10 rounded-xl">
                  <CheckCircle2 size={18} color="#10b981" />
                </View>
                <Text className="text-lg font-black" style={{ color: colors.text }}>Struk Digital</Text>
              </View>
              <TouchableOpacity onPress={() => setViewingReceipt(null)}>
                <X color={colors.textMuted} size={24} />
              </TouchableOpacity>
            </View>

            {/* Scrollable Receipt Area */}
            <ScrollView className="flex-1 bg-white rounded-3xl p-6 mb-4" showsVerticalScrollIndicator={false}>
              <View className="items-center mb-4">
                {storeSettings?.logoUrl && storeSettings?.showLogoOnReceipt !== false ? (
                  <Image 
                    source={{ uri: storeSettings.logoUrl }} 
                    style={{ width: 64, height: 64, marginBottom: 8 }}
                    resizeMode="contain"
                  />
                ) : null}
                <Text 
                  className="text-xs text-slate-900 text-center mb-1"
                  style={getFontStyle(storeSettings?.storeNameFont)}
                >
                  {storeSettings?.storeName || 'TOKO KAMI'}
                </Text>
                {storeSettings?.showReceiptAddress !== false && storeSettings?.address ? (
                  <Text className="text-[10px] text-slate-500 text-center font-mono whitespace-pre-line leading-tight">
                    {storeSettings.address}
                  </Text>
                ) : null}
                {storeSettings?.showReceiptPhone !== false && storeSettings?.phone ? (
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
                      {viewingReceipt?.cashierName?.includes('@') 
                        ? viewingReceipt.cashierName.split('@')[0] 
                        : (viewingReceipt?.cashierName || 'Kasir')}
                    </Text>
                  </View>
                )}
                
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
                {storeSettings?.showReceiptSubtotal !== false && (
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] font-mono text-slate-500">SUBTOTAL</Text>
                    <Text className="text-[10px] font-mono font-bold text-slate-900">
                      Rp {viewingReceipt?.subtotal ? viewingReceipt.subtotal.toLocaleString('id-ID') : viewingReceipt?.total.toLocaleString('id-ID')}
                    </Text>
                  </View>
                )}
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

              {storeSettings?.showSignature && storeSettings?.signatureUrl ? (
                <View className="items-center py-3 border-t border-dashed border-slate-200 mt-4">
                  <Image 
                    source={{ uri: storeSettings.signatureUrl }} 
                    style={{ width: 64, height: 32 }}
                    resizeMode="contain"
                  />
                  <Text className="text-[6px] text-slate-400 mt-0.5">Tanda Tangan Toko</Text>
                </View>
              ) : null}

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
                className="flex-1 py-4 rounded-2xl items-center justify-center active:opacity-90"
                style={{ backgroundColor: colors.border }}
              >
                <Text className="font-black text-xs uppercase tracking-widest text-center" style={{ color: colors.text }}>Tutup</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (viewingReceipt) {
                    await handlePrintAction(viewingReceipt);
                  }
                }}
                className="flex-[2] py-4 bg-accent rounded-2xl items-center justify-center flex-row gap-2 active:opacity-95"
              >
                <Printer size={16} color="white" />
                <Text className="font-black text-xs text-white uppercase tracking-widest text-center">CETAK STRUK</Text>
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

      {/* Modal Bluetooth Printer Manager */}
      <Modal visible={isBluetoothModalVisible} animationType="slide" transparent onRequestClose={() => setIsBluetoothModalVisible(false)}>
        <View className="flex-1 bg-black/70 justify-center items-center">
          <View 
            className="rounded-[32px] overflow-hidden flex-col"
            style={{ 
              backgroundColor: colors.surface,
              width: width * 0.9,
              height: height * 0.72
            }}
          >
            {/* Header Modal */}
            <View className="p-6 border-b flex-row items-center justify-between" style={{ borderColor: colors.border }}>
              <View className="flex-row items-center gap-2">
                <View className="p-2 bg-blue-500/10 rounded-xl">
                  <Printer color={colors.accent} size={18} />
                </View>
                <Text className="text-lg font-black" style={{ color: colors.text }}>Printer Bluetooth</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setIsBluetoothModalVisible(false)}
                className="p-2 rounded-xl"
                style={{ backgroundColor: colors.bg }}
              >
                <X color={colors.textMuted} size={20} />
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
                  <Printer color={colors.textMuted} size={48} />
                  <Text className="font-bold mt-4 text-center text-xs" style={{ color: colors.textMuted }}>
                    Bluetooth dinonaktifkan. Harap aktifkan koneksi bluetooth ponsel Anda.
                  </Text>
                </View>
              ) : isBluetoothScanning ? (
                <View className="items-center py-12">
                  <ActivityIndicator size="large" color={colors.accent} className="mb-4" />
                  <Text className="text-xs font-bold uppercase tracking-[2px] animate-pulse" style={{ color: colors.textMuted }}>
                    Memindai Printer...
                  </Text>
                </View>
              ) : (
                <View className="space-y-4">
                  {bluetoothDevices.length > 0 ? (
                    <>
                      <Text className="text-[10px] font-black uppercase tracking-[1px] mb-2" style={{ color: colors.textMuted }}>
                        Perangkat Terdeteksi ({bluetoothDevices.length})
                      </Text>
                      
                      {bluetoothDevices.map((device) => {
                        const isCurrent = activePrinter === device.name;
                        return (
                          <TouchableOpacity
                            key={device.id}
                            onPress={() => !isCurrent && handleConnectDevice(device)}
                            disabled={isBluetoothConnecting}
                            activeOpacity={0.7}
                            className="flex-row items-center p-4 rounded-2xl border mb-3"
                            style={{ 
                              backgroundColor: isCurrent ? colors.accent + '15' : colors.bg, 
                              borderColor: isCurrent ? colors.accent : colors.border 
                            }}
                          >
                            <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: isCurrent ? colors.accent : colors.border }}>
                              <Printer color={isCurrent ? '#ffffff' : colors.textMuted} size={18} />
                            </View>
                            
                            <View className="flex-1">
                              <Text className="font-black text-xs" style={{ color: isCurrent ? colors.accent : colors.text }}>{device.name}</Text>
                              <Text className="text-[9px] font-bold uppercase tracking-[0.5px] mt-0.5" style={{ color: colors.textMuted }} numberOfLines={1}>{device.address || device.type}</Text>
                            </View>

                            <View className="items-end">
                              {isCurrent ? (
                                <View className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                  <Text className="text-[8px] font-black text-blue-500 uppercase">Aktif</Text>
                                </View>
                              ) : (
                                <View className="px-2.5 py-1 rounded-lg border" style={{ backgroundColor: colors.border + '50', borderColor: colors.border }}>
                                  <Text className="text-[8px] font-black uppercase" style={{ color: colors.textMuted }}>Pilih</Text>
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  ) : (
                    <View className="items-center py-12 opacity-65">
                      <Printer color={colors.textMuted} size={48} />
                      <Text className="font-bold mt-4 text-center text-xs" style={{ color: colors.textMuted }}>
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
            {isBluetoothConnecting && (
              <View className="absolute inset-0 justify-center items-center rounded-[32px]" style={{ backgroundColor: colors.surface + 'f2' }}>
                <ActivityIndicator size="large" color={colors.accent} className="mb-4" />
                <Text className="text-sm font-black" style={{ color: colors.text }}>Menghubungkan Perangkat...</Text>
                <Text className="text-xs mt-1" style={{ color: colors.textMuted }}>Mengamankan koneksi Bluetooth...</Text>
              </View>
            )}

            {/* Tindakan Bawah */}
            <View className="p-6 border-t" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <TouchableOpacity 
                onPress={startBluetoothScan}
                disabled={isBluetoothScanning || isBluetoothConnecting}
                className="w-full py-4 rounded-2xl items-center justify-center"
                style={{ backgroundColor: colors.accent }}
              >
                <Text className="font-black text-white text-xs uppercase">Pindai Ulang Perangkat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* QRIS Image Preview Modal */}
      <Modal
        visible={!!zoomImageUrl}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setZoomImageUrl(null)}
      >
        <Pressable 
          className="flex-1 bg-black/90 justify-center items-center p-6"
          onPress={() => setZoomImageUrl(null)}
        >
          {/* Close Button */}
          <TouchableOpacity 
            className="absolute top-12 right-6 p-3 bg-white/10 rounded-full border border-white/10"
            onPress={() => setZoomImageUrl(null)}
          >
            <X color="white" size={24} />
          </TouchableOpacity>

          {/* Image Container */}
          <Pressable 
            className="bg-white rounded-[2.5rem] p-4 items-center justify-center max-w-sm w-full"
            onPress={(e) => e.stopPropagation()}
          >
            {zoomImageUrl && (
              <Image 
                source={{ uri: zoomImageUrl }} 
                style={{ width: '100%', height: 320, resizeMode: 'contain' }} 
                className="rounded-3xl"
              />
            )}
            <View className="mt-4 pb-2 items-center">
              <Text className="text-sm font-black text-slate-800 uppercase tracking-widest">QRIS Pembayaran</Text>
              <Text className="text-[10px] text-slate-400 font-bold mt-1">Ketuk di luar gambar atau tombol X untuk menutup</Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}
