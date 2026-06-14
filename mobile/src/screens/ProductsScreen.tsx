import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput, Modal, RefreshControl, Vibration, Pressable } from 'react-native';
import { collection, query, onSnapshot, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../store/authStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { Plus, Edit2, Trash2, Search, Package, Scan, X, Printer, Minus, Square, CheckSquare, Share2 } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

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
                onPress={handlePrintBarcodes}
                className="flex-row flex-1 py-4 items-center justify-center rounded-2xl gap-2 bg-emerald-500/10 border border-emerald-500/20"
              >
                <Printer size={18} color="#10b981" />
                <Text className="text-xs font-black uppercase tracking-wider text-emerald-500">
                  Cetak
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              onPress={handleShareBarcodes}
              className="py-4 items-center justify-center rounded-2xl flex-row gap-2"
              style={{ backgroundColor: colors.accent }}
            >
              <Share2 size={18} color={colors.text} />
              <Text className="text-xs font-black uppercase tracking-wider" style={{ color: colors.text }}>
                Bagikan PDF (Label)
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
