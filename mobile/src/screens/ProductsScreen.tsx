import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput, Modal, RefreshControl, Vibration, Pressable, Platform, PermissionsAndroid, Dimensions, NativeModules, ScrollView } from 'react-native';
import { collection, query, onSnapshot, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../store/authStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { Plus, Edit2, Trash2, Search, Package, Scan, X, Printer, Minus, Square, CheckSquare, Share2, History } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Product {
  id?: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  imageUrl?: string;
  sku?: string;
  barcode?: string;
}

const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211312",
  "231112", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "233111"
];

function generateCode128Svg(text: string, height = 40): string {
  let cleanText = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 32 && code <= 126) {
      cleanText += text[i];
    }
  }

  const values: number[] = [];
  values.push(104); // Start B

  for (let i = 0; i < cleanText.length; i++) {
    values.push(cleanText.charCodeAt(i) - 32);
  }

  let checksum = values[0];
  for (let i = 1; i < values.length; i++) {
    checksum += values[i] * i;
  }
  const checkDigit = checksum % 103;
  values.push(checkDigit);
  values.push(106); // Stop

  let pattern = "";
  for (const val of values) {
    pattern += CODE128_PATTERNS[val];
  }
  pattern += "2"; // Stop character extra bar

  let x = 0;
  let rects = "";
  for (let i = 0; i < pattern.length; i++) {
    const w = parseInt(pattern[i], 10);
    const isBar = (i % 2 === 0);
    if (isBar) {
      rects += `<rect x="${x}" y="0" width="${w}" height="${height}" fill="black" />`;
    }
    x += w;
  }

  return `<svg style="shape-rendering: crispEdges;" width="100%" height="100%" viewBox="0 0 ${x} ${height}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const hasBluetoothNativeModule = !!NativeModules.BluetoothManager || !!NativeModules.RNBluetoothManager;

const BluetoothManager = hasBluetoothNativeModule 
  ? require('react-native-bluetooth-escpos-printer')?.BluetoothManager 
  : null;

const BluetoothEscposPrinter = hasBluetoothNativeModule
  ? require('react-native-bluetooth-escpos-printer')?.BluetoothEscposPrinter
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

export default function ProductsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { storeId, role } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [labelSize, setLabelSize] = useState<'58x30' | '58x20'>('58x30');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const [isBluetoothModalVisible, setIsBluetoothModalVisible] = useState(false);
  const [isBluetoothScanning, setIsBluetoothScanning] = useState(false);
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
    } catch (err) {
      setIsConnecting(false);
      Alert.alert("Koneksi Gagal", `Tidak dapat berpasangan dengan ${device.name}. Silakan coba lagi.`);
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

  const handlePrintBarcodesBluetooth = async () => {
    if (!BluetoothEscposPrinter) {
      Alert.alert(
        "Mode Simulator", 
        "Pencetakan Bluetooth langsung tidak terdeteksi di Simulator. Apakah Anda ingin mengalihkan ke Cetak PDF?",
        [
          { text: "Batal", style: "cancel" },
          { text: "Cetak PDF", onPress: handlePrintBarcodes }
        ]
      );
      return;
    }
    
    const savedPrinterAddress = await AsyncStorage.getItem('selected_printer_address');
    if (!savedPrinterAddress) {
      setIsBluetoothModalVisible(true);
      startBluetoothScan();
      return;
    }
    
    Alert.alert(
      "Cetak Barcode Bluetooth",
      `Mencetak label menggunakan printer bluetooth "${activePrinter || 'Printer Terhubung'}"?`,
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
            setIsConnecting(true);
            try {
              // Ensure connection is established
              await BluetoothManager.connect(savedPrinterAddress);
              await new Promise(resolve => setTimeout(resolve, 500));
              
              const selectedProducts = products.filter(p => selectedIds.includes(p.id!));
              
              await BluetoothEscposPrinter.printerInit();
              
              for (const p of selectedProducts) {
                const qty = quantities[p.id!] || 1;
                const barcodeValue = p.barcode || p.sku || '00000000';
                
                for (let i = 0; i < qty; i++) {
                  // Center aligning
                  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
                  
                  // Product Name (Bold, normal size)
                  await BluetoothEscposPrinter.setBlob(1);
                  await BluetoothEscposPrinter.printText(`${p.name.toUpperCase()}\n\r`, {});
                  await BluetoothEscposPrinter.setBlob(0);
                  
                  // Barcode (CODE128 = 73, width = 2, height = 60, HriFont = 0, HriPos = 2 (below barcode))
                  try {
                    await BluetoothEscposPrinter.printBarCode(barcodeValue, 73, 2, 60, 0, 2);
                    await BluetoothEscposPrinter.printText(`\n\r`, {});
                  } catch (barErr) {
                    // Fallback to plain text if barcode print fails
                    await BluetoothEscposPrinter.printText(`*${barcodeValue}*\n\r`, {});
                  }
                  
                  // Product Price
                  await BluetoothEscposPrinter.setBlob(1);
                  await BluetoothEscposPrinter.printText(`Rp ${p.price.toLocaleString('id-ID')}\n\r`, {});
                  await BluetoothEscposPrinter.setBlob(0);
                  
                  // Space separating label
                  await BluetoothEscposPrinter.printText(`\n\r\n\r`, {});
                }
              }
              
              Vibration.vibrate([0, 15, 80, 15]);
              Alert.alert("Sukses", "Barcode berhasil dicetak!");
            } catch (err: any) {
              console.error(err);
              Alert.alert("Gagal Mencetak", "Tidak dapat mengirim data ke printer: " + (err.message || String(err)));
            } finally {
              setIsConnecting(false);
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    if (isBarcodeModalOpen) {
      const initialQuantities: Record<string, number> = {};
      selectedIds.forEach(id => {
        initialQuantities[id] = 1;
      });
      setQuantities(initialQuantities);
    }
  }, [isBarcodeModalOpen, selectedIds]);

  const handlePrintBarcodes = async () => {
    try {
      const selectedProducts = products.filter(p => selectedIds.includes(p.id!));
      const printItemsHtml = selectedProducts.flatMap(p => {
        const qty = quantities[p.id!] || 1;
        const barcodeValue = p.barcode || p.sku || '00000000';
        const svgBarcode = generateCode128Svg(barcodeValue, labelSize === '58x30' ? 40 : 25);
        
        return Array.from({ length: qty }).map(() => `
          <div class="label">
            <div class="name">${p.name}</div>
            <div class="code">${barcodeValue}</div>
            <div class="barcode-container">
              ${svgBarcode}
            </div>
            <div class="price">Rp ${p.price.toLocaleString('id-ID')}</div>
          </div>
        `);
      }).join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              margin: 0;
              padding: 0;
              background-color: white;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            @page {
              margin: 0;
              size: 58mm ${labelSize === '58x30' ? '30mm' : '20mm'};
            }
            .label {
              width: 58mm;
              height: ${labelSize === '58x30' ? '30mm' : '20mm'};
              box-sizing: border-box;
              padding: 2mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              page-break-after: always;
              overflow: hidden;
            }
            .name {
              font-size: 8pt;
              font-weight: 900;
              text-transform: uppercase;
              margin-bottom: 0.5mm;
              width: 100%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              color: black;
            }
            .code {
              font-size: 7pt;
              font-weight: bold;
              letter-spacing: 1px;
              margin-bottom: 1mm;
              color: black;
            }
            .barcode-container {
              display: flex;
              justify-content: center;
              align-items: center;
              width: 100%;
              height: ${labelSize === '58x30' ? '40px' : '25px'};
              background: white;
            }
            .price {
              font-size: 10pt;
              font-weight: 900;
              margin-top: 1.5mm;
              color: black;
            }
          </style>
        </head>
        <body>
          ${printItemsHtml}
        </body>
        </html>
      `;

      await Print.printAsync({ html });
    } catch (err: any) {
      Alert.alert('Error', 'Gagal memproses cetak barcode: ' + err.message);
    }
  };

  const handleShareBarcodes = async () => {
    try {
      const selectedProducts = products.filter(p => selectedIds.includes(p.id!));
      const printItemsHtml = selectedProducts.flatMap(p => {
        const qty = quantities[p.id!] || 1;
        const barcodeValue = p.barcode || p.sku || '00000000';
        const svgBarcode = generateCode128Svg(barcodeValue, labelSize === '58x30' ? 40 : 25);
        
        return Array.from({ length: qty }).map(() => `
          <div class="label">
            <div class="name">${p.name}</div>
            <div class="code">${barcodeValue}</div>
            <div class="barcode-container">
              ${svgBarcode}
            </div>
            <div class="price">Rp ${p.price.toLocaleString('id-ID')}</div>
          </div>
        `);
      }).join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              margin: 0;
              padding: 0;
              background-color: white;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            @page {
              margin: 0;
              size: 58mm ${labelSize === '58x30' ? '30mm' : '20mm'};
            }
            .label {
              width: 58mm;
              height: ${labelSize === '58x30' ? '30mm' : '20mm'};
              box-sizing: border-box;
              padding: 2mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              page-break-after: always;
              overflow: hidden;
            }
            .name {
              font-size: 8pt;
              font-weight: 900;
              text-transform: uppercase;
              margin-bottom: 0.5mm;
              width: 100%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              color: black;
            }
            .code {
              font-size: 7pt;
              font-weight: bold;
              letter-spacing: 1px;
              margin-bottom: 1mm;
              color: black;
            }
            .barcode-container {
              display: flex;
              justify-content: center;
              align-items: center;
              width: 100%;
              height: ${labelSize === '58x30' ? '40px' : '25px'};
              background: white;
            }
            .price {
              font-size: 10pt;
              font-weight: 900;
              margin-top: 1.5mm;
              color: black;
            }
          </style>
        </head>
        <body>
          ${printItemsHtml}
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (err: any) {
      Alert.alert('Error', 'Gagal membagikan PDF: ' + err.message);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setRefreshing(false);
  };
  
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);

  const onBarcodeScanned = ({ data }: { data: string }) => {
    if (isScanning) return;
    setIsScanning(true);
    
    setSearch(data);
    setShowScanner(false);
    
    // Reset scanning flag after a short delay
    setTimeout(() => setIsScanning(false), 2000);
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

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    const q = query(
      collection(db, 'products'),
      where('storeId', '==', storeId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach((doc) => {
        prods.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(prods);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [storeId]);

  const handleDelete = (id: string) => {
    Alert.alert(
      'Hapus Produk',
      'Yakin ingin menghapus produk ini?',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Hapus', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'products', id));
              Vibration.vibrate(15);
            } catch (err) {
              Alert.alert('Error', 'Gagal menghapus produk');
            }
          }
        }
      ]
    );
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <SafeAreaView className="flex-1" edges={['bottom']} style={{ backgroundColor: colors.bg }}>
      <View className="px-6 pt-4 pb-2">
        <View 
          className="flex-row items-center px-4 py-3 rounded-2xl border"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <Search size={18} color={colors.textMuted} />
          <TextInput
            placeholder="Cari SKU atau Nama Barang..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            className="flex-1 ml-3 font-bold"
            style={{ color: colors.text }}
          />
          <TouchableOpacity 
            onPress={startScanning}
            className="p-2 -mr-2"
          >
            <Scan size={20} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Barcode Select Mode Controls */}
      <View className="px-6 py-2">
        {!isSelectMode ? (
          <TouchableOpacity 
            onPress={() => {
              setIsSelectMode(true);
              setSelectedIds([]);
            }}
            className="py-3 px-4 rounded-xl border flex-row items-center justify-center gap-2"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <Printer size={16} color={colors.accent} />
            <Text className="text-xs font-black uppercase tracking-wider" style={{ color: colors.accent }}>Pilih Produk untuk Cetak Barcode</Text>
          </TouchableOpacity>
        ) : (
          <View 
            className="p-3 rounded-xl border flex-row items-center justify-between"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <View className="flex-row items-center gap-2">
              <TouchableOpacity 
                onPress={() => {
                  if (selectedIds.length === filteredProducts.length) {
                    setSelectedIds([]);
                  } else {
                    setSelectedIds(filteredProducts.map(p => p.id!));
                  }
                }}
                className="px-2.5 py-1.5 rounded-lg border bg-background"
                style={{ borderColor: colors.border }}
              >
                <Text className="text-[10px] font-black text-foreground uppercase">
                  {selectedIds.length === filteredProducts.length ? 'Batal Semua' : 'Pilih Semua'}
                </Text>
              </TouchableOpacity>
              <Text className="text-xs font-black" style={{ color: colors.text }}>
                {selectedIds.length} Terpilih
              </Text>
            </View>

            <View className="flex-row items-center gap-2">
              <TouchableOpacity 
                onPress={() => {
                  setIsSelectMode(false);
                  setSelectedIds([]);
                }}
                className="px-3 py-1.5 rounded-lg border"
                style={{ borderColor: colors.border }}
              >
                <Text className="text-[10px] font-black text-app-text-muted uppercase" style={{ color: colors.textMuted }}>Batal</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                disabled={selectedIds.length === 0}
                onPress={() => setIsBarcodeModalOpen(true)}
                className={`px-3 py-1.5 rounded-lg flex-row items-center gap-1.5 ${selectedIds.length === 0 ? 'opacity-40' : ''}`}
                style={{ backgroundColor: colors.accent }}
              >
                <Printer size={12} color={colors.text} />
                <Text className="text-[10px] font-black uppercase" style={{ color: colors.text }}>Cetak ({selectedIds.length})</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {loading ? (
        <LoadingSkeleton type="list" count={5} />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={item => item.id!}
          contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.accent]}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item }) => {
            const isSelected = selectedIds.includes(item.id!);
            return (
              <Pressable
                onPress={() => {
                  if (isSelectMode) {
                    if (isSelected) {
                      setSelectedIds(prev => prev.filter(id => id !== item.id));
                    } else {
                      setSelectedIds(prev => [...prev, item.id!]);
                    }
                  } else {
                    navigation.navigate('EditProduct', { product: item });
                  }
                }}
                className="flex-row items-center mb-4 p-4 rounded-[28px] border"
                style={{ 
                  backgroundColor: isSelected ? colors.accent + '08' : colors.surface, 
                  borderColor: isSelected ? colors.accent : colors.border 
                }}
              >
                {isSelectMode && (
                  <View className="mr-3">
                    {isSelected ? (
                      <CheckSquare size={22} color={colors.accent} strokeWidth={2.5} />
                    ) : (
                      <Square size={22} color={colors.textMuted} strokeWidth={2} />
                    )}
                  </View>
                )}

                <View 
                  className="w-16 h-16 rounded-2xl bg-black/20 overflow-hidden items-center justify-center border"
                  style={{ borderColor: colors.border }}
                >
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <Package color={colors.textMuted} opacity={0.2} size={24} />
                  )}
                </View>
                
                <View className="flex-1 ml-4">
                  <Text className="text-base font-black" style={{ color: colors.text }} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: colors.textMuted }}>
                    SKU: {item.sku || 'N/A'} • {item.category}
                  </Text>
                  <View className="flex-row items-center mt-1 gap-3">
                     <Text className="font-black text-emerald-500">Rp {item.price.toLocaleString('id-ID')}</Text>
                     <View className="w-1 h-1 rounded-full bg-slate-700" />
                     <Text className="text-xs font-bold" style={{ color: colors.accent }}>Stok: {item.stock}</Text>
                  </View>
                </View>

                {!isSelectMode && (
                  <View className="flex-row gap-2">
                    <TouchableOpacity 
                       onPress={() => navigation.navigate('EditProduct', { product: item })}
                       className="w-10 h-10 items-center justify-center rounded-xl bg-blue-500/10"
                    >
                      <Edit2 size={18} color={colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                       onPress={() => handleDelete(item.id!)}
                       className="w-10 h-10 items-center justify-center rounded-xl bg-rose-500/10"
                    >
                      <Trash2 size={18} color="#f43f5e" />
                    </TouchableOpacity>
                  </View>
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View className="items-center py-20 opacity-50">
               <Package color={colors.textMuted} size={64} />
               <Text className="text-app-text-muted font-bold mt-4">Belum ada data produk</Text>
            </View>
          }
        />
      )}

      {/* Floating Plus Button (only visible when not in select mode) */}
      {!isSelectMode && (
        <TouchableOpacity
          onPress={() => navigation.navigate('EditProduct')}
          className="absolute bottom-6 right-6 w-16 h-16 rounded-full items-center justify-center shadow-2xl"
          style={{ backgroundColor: colors.accent, shadowColor: colors.accent }}
        >
          <Plus color={colors.text} size={32} />
        </TouchableOpacity>
      )}

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
          
          {/* Overlay UI */}
          <View className="absolute inset-0 items-center justify-center">
            <View className="w-64 h-64 border-4 border-accent rounded-3xl opacity-50" />
            <Text className="text-white font-black mt-8 text-lg bg-black/40 px-6 py-2 rounded-full">CARI BARCODE</Text>
          </View>

          <TouchableOpacity 
            onPress={() => setShowScanner(false)}
            className="absolute top-12 right-6 w-12 h-12 rounded-full bg-black/50 items-center justify-center"
          >
            <X color="white" size={28} />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Barcode Print Modal */}
      <Modal 
        visible={isBarcodeModalOpen} 
        animationType="slide" 
        onRequestClose={() => setIsBarcodeModalOpen(false)}
      >
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }}>
          {/* Header */}
          <View 
            className="flex-row items-center justify-between px-6 py-5 border-b"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <View>
              <Text className="text-lg font-black uppercase tracking-tight" style={{ color: colors.text }}>
                Cetak Barcode
              </Text>
              <Text className="text-[10px] font-black uppercase tracking-widest mt-0.5" style={{ color: colors.textMuted }}>
                Konfigurasi Cetak
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => setIsBarcodeModalOpen(false)}
              className="w-10 h-10 rounded-full items-center justify-center bg-black/5"
            >
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Configuration Settings */}
          <View className="p-6 gap-4 border-b" style={{ borderColor: colors.border }}>
            <Text className="text-xs font-black uppercase tracking-wider" style={{ color: colors.textMuted }}>
              Pengaturan Kertas
            </Text>
            <View className="flex-row gap-3">
              {(['58x30', '58x20'] as const).map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setLabelSize(s)}
                  className="flex-1 py-3 items-center justify-center rounded-xl border"
                  style={{ 
                    backgroundColor: labelSize === s ? colors.accent + '15' : colors.surface, 
                    borderColor: labelSize === s ? colors.accent : colors.border 
                  }}
                >
                  <Text className="text-xs font-black" style={{ color: labelSize === s ? colors.accent : colors.text }}>
                    {s} mm
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Selected Products List */}
          <FlatList
            data={products.filter(p => selectedIds.includes(p.id!))}
            keyExtractor={item => item.id!}
            contentContainerStyle={{ padding: 24 }}
            ListHeaderComponent={
              <Text className="text-xs font-black uppercase tracking-wider mb-4" style={{ color: colors.textMuted }}>
                Daftar Item & Jumlah Cetak
              </Text>
            }
            renderItem={({ item }) => (
              <View 
                className="flex-row items-center justify-between mb-3 p-4 rounded-2xl border"
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              >
                <View className="flex-1 pr-3">
                  <Text className="text-sm font-black" style={{ color: colors.text }} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="text-[9px] font-bold font-mono mt-0.5" style={{ color: colors.textMuted }}>
                    {item.barcode || item.sku || 'No Barcode/SKU'}
                  </Text>
                  <Text className="text-xs font-black text-emerald-500 mt-1">
                    Rp {item.price.toLocaleString('id-ID')}
                  </Text>
                </View>
                
                <View 
                  className="flex-row items-center gap-3 p-1 rounded-xl border bg-background"
                  style={{ borderColor: colors.border }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      setQuantities(prev => ({
                        ...prev,
                        [item.id!]: Math.max(1, (prev[item.id!] || 1) - 1)
                      }));
                    }}
                    className="w-8 h-8 rounded-lg items-center justify-center bg-rose-500/10"
                  >
                    <Minus size={14} color="#f43f5e" strokeWidth={3} />
                  </TouchableOpacity>
                  <Text className="w-6 text-center font-black text-sm" style={{ color: colors.text }}>
                    {quantities[item.id!] || 1}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setQuantities(prev => ({
                        ...prev,
                        [item.id!]: (prev[item.id!] || 1) + 1
                      }));
                    }}
                    className="w-8 h-8 rounded-lg items-center justify-center bg-emerald-500/10"
                  >
                    <Plus size={14} color="#10b981" strokeWidth={3} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />

          {/* Footer Actions */}
          <View 
            className="p-6 border-t gap-3"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <View className="flex-row gap-3">
              <TouchableOpacity 
                onPress={() => setIsBarcodeModalOpen(false)}
                className="flex-1 py-4 items-center justify-center rounded-2xl border"
                style={{ borderColor: colors.border }}
              >
                <Text className="text-xs font-black uppercase tracking-wider" style={{ color: colors.textMuted }}>
                  Batal
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handlePrintBarcodesBluetooth}
                className="flex-row flex-[2] py-4 items-center justify-center rounded-2xl gap-2"
                style={{ backgroundColor: colors.accent }}
              >
                <Printer size={18} color="white" />
                <Text className="text-xs font-black uppercase tracking-wider text-white">
                  Cetak Bluetooth
                </Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity 
                onPress={handlePrintBarcodes}
                className="flex-1 py-4 items-center justify-center rounded-2xl flex-row gap-2 bg-emerald-500/10 border border-emerald-500/20"
              >
                <Printer size={18} color="#10b981" />
                <Text className="text-xs font-black uppercase tracking-wider text-emerald-500">
                  Cetak PDF
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handleShareBarcodes}
                className="flex-1 py-4 items-center justify-center rounded-2xl flex-row gap-2 bg-blue-500/10 border border-blue-500/20"
              >
                <Share2 size={18} color="#3b82f6" />
                <Text className="text-xs font-black uppercase tracking-wider text-blue-500">
                  Bagikan PDF
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
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
              ) : isBluetoothScanning ? (
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
                disabled={isBluetoothScanning || isConnecting}
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
