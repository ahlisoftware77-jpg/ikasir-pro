import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput, Modal, RefreshControl, Vibration, Pressable } from 'react-native';
import { collection, query, onSnapshot, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../store/authStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { Plus, Edit2, Trash2, Search, Package, Scan, X } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface Product {
  id?: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  imageUrl?: string;
  sku?: string;
}

export default function ProductsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { storeId, role } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      <View className="px-6 py-4">
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
          renderItem={({ item }) => (
            <View 
              className="flex-row items-center mb-4 p-4 rounded-[28px] border"
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            >
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
            </View>
          )}
          ListEmptyComponent={
            <View className="items-center py-20 opacity-50">
               <Package color={colors.textMuted} size={64} />
               <Text className="text-app-text-muted font-bold mt-4">Belum ada data produk</Text>
            </View>
          }
        />
      )}

      {/* Floating Plus Button */}
      <TouchableOpacity
        onPress={() => navigation.navigate('EditProduct')}
        className="absolute bottom-6 right-6 w-16 h-16 rounded-full items-center justify-center shadow-2xl"
        style={{ backgroundColor: colors.accent, shadowColor: colors.accent }}
      >
        <Plus color={colors.text} size={32} />
      </TouchableOpacity>

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
    </SafeAreaView>
  );
}
