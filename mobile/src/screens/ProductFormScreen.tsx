import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, Switch, Vibration } from 'react-native';
import { addDoc, collection, doc, updateDoc, query, where, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../store/authStore';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, Save, ArrowLeft, Trash2, Camera as CameraIcon, Scan, X, Calendar, Layers, Shield, ChevronDown, Check, CheckSquare, Square, Sparkles, AlertCircle, Info, Plus } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProductFormScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const { storeId } = useAuthStore();
  const editProduct = route.params?.product;

  const [activeTab, setActiveTab] = useState<'info' | 'harga_stok' | 'lanjutan'>('info');

  const [formData, setFormData] = useState({
    name: editProduct?.name || '',
    price: editProduct?.price?.toString() || '0',
    purchasePrice: editProduct?.purchasePrice?.toString() || '0',
    wholesalePrice: editProduct?.wholesalePrice?.toString() || '0',
    stock: editProduct?.stock?.toString() || '0',
    manageStock: editProduct?.manageStock ?? true,
    category: editProduct?.category || 'Umum',
    variation: editProduct?.variation || '',
    unit: editProduct?.unit || 'pcs',
    sku: editProduct?.sku || '',
    barcode: editProduct?.barcode || '',
    description: editProduct?.description || '',
    expiryDate: editProduct?.expiryDate || '',
    entryDate: editProduct?.entryDate || new Date().toISOString().split('T')[0],
    imageUrl: editProduct?.imageUrl || '',
    hasExtras: editProduct?.hasExtras ?? false,
    extras: editProduct?.extras || [],
    warrantyDuration: editProduct?.warrantyDuration?.toString() || '0',
    warrantyUnit: editProduct?.warrantyUnit || 'months'
  });

  const [image, setImage] = useState<string | null>(editProduct?.imageUrl || null);
  const [isSaving, setIsSaving] = useState(false);

  const [showScanner, setShowScanner] = useState(false);
  const [scanTarget, setScanTarget] = useState<'sku' | 'barcode'>('sku');
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCustomCategoryModal, setShowCustomCategoryModal] = useState(false);
  const [customCategoryText, setCustomCategoryText] = useState('');

  const [useAdvancedUnit, setUseAdvancedUnit] = useState(editProduct?.unit !== 'pcs' && !!editProduct?.unit);
  const [hasExpiryDate, setHasExpiryDate] = useState(!!editProduct?.expiryDate);
  const [hasWarranty, setHasWarranty] = useState(Number(editProduct?.warrantyDuration) > 0);

  const [availableExtras, setAvailableExtras] = useState<any[]>([]);

  const CATEGORIES = ['Umum', 'Makanan', 'Minuman', 'Snack', 'Bahan Baku', 'Aksesoris', 'Jasa'];

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

  // Fetch available modifiers
  useEffect(() => {
    if (!storeId) return;
    const qExtras = query(
      collection(db, 'product_extras'),
      where('storeId', '==', storeId)
    );
    const unsubscribe = onSnapshot(qExtras, (snapshot) => {
      const exts: any[] = [];
      snapshot.forEach((doc) => {
        exts.push({ id: doc.id, ...doc.data() });
      });
      setAvailableExtras(exts.filter(e => e.isActive));
    });
    return () => unsubscribe();
  }, [storeId]);

  const onBarcodeScanned = ({ data }: { data: string }) => {
    if (isScanning) return;
    setIsScanning(true);
    
    setFormData(prev => ({ ...prev, [scanTarget]: data }));
    setShowScanner(false);
    
    setTimeout(() => setIsScanning(false), 2000);
  };

  const startScanning = async (target: 'sku' | 'barcode') => {
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

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Ditolak', 'Maaf, kami butuh izin kamera untuk mengambil foto.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const generateAutomaticSku = () => {
    const { name, category, variation } = formData;
    
    const catPart = (category || 'UMUM')
      .trim()
      .split(/\s+/)[0]
      .substring(0, 3)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    const namePart = (name || 'PRD')
      .trim()
      .split(/\s+/)[0]
      .substring(0, 3)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    const varPart = (variation || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    const randomNum = Math.floor(100 + Math.random() * 900); // 3 random digits
    const prefix = varPart 
      ? `${catPart}-${namePart}-${varPart}-${randomNum}` 
      : `${catPart}-${namePart}-${randomNum}`;

    setFormData(prev => ({ ...prev, sku: prefix }));
    Vibration.vibrate(10);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      Alert.alert('Error', 'Nama dan harga jual wajib diisi.');
      return;
    }

    setIsSaving(true);
    try {
      let finalImageUrl = formData.imageUrl;
      let productId = editProduct?.id;
      const targetDocRef = editProduct ? doc(db, 'products', editProduct.id) : doc(collection(db, 'products'));
      if (!productId) {
        productId = targetDocRef.id;
      }

      // Handle Image Upload to Cloudinary if image changed
      if (image && image !== formData.imageUrl) {
        const formDataUpload = new FormData();
        const filename = image.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;

        formDataUpload.append('file', { uri: image, name: filename, type } as any);
        formDataUpload.append('upload_preset', 'kasirpos');
        formDataUpload.append('public_id', 'product_' + storeId + '_' + productId);

        const uploadRes = await fetch('https://api.cloudinary.com/v1_1/dkcjfwbvc/image/upload', {
          method: 'POST',
          body: formDataUpload,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        const uploadResult = await uploadRes.json();
        if (uploadRes.ok && uploadResult.secure_url) {
          finalImageUrl = uploadResult.secure_url;
        } else {
          console.error('Cloudinary error:', uploadResult);
          throw new Error('Gagal mengunggah foto');
        }
      }

      const productData = {
        name: formData.name,
        price: Number(formData.price) || 0,
        purchasePrice: Number(formData.purchasePrice) || 0,
        wholesalePrice: Number(formData.wholesalePrice) || 0,
        stock: Number(formData.stock) || 0,
        manageStock: formData.manageStock,
        category: formData.category || 'Umum',
        variation: formData.variation || '',
        unit: formData.unit || 'pcs',
        sku: formData.sku || '',
        barcode: formData.barcode || '',
        description: formData.description || '',
        expiryDate: hasExpiryDate ? formData.expiryDate : '',
        entryDate: formData.entryDate || new Date().toISOString().split('T')[0],
        imageUrl: finalImageUrl,
        hasExtras: formData.hasExtras,
        extras: formData.hasExtras ? formData.extras : [],
        warrantyDuration: hasWarranty ? Number(formData.warrantyDuration) || 0 : 0,
        warrantyUnit: hasWarranty ? formData.warrantyUnit : 'months',
        storeId: storeId || 'default-store',
        updatedAt: new Date()
      };

      if (editProduct) {
        await updateDoc(targetDocRef, productData);
      } else {
        await setDoc(targetDocRef, {
          ...productData,
          createdAt: new Date()
        });
      }

      Vibration.vibrate(15);
      Alert.alert('Berhasil', 'Produk berhasil disimpan.');
      navigation.goBack();
    } catch (err: any) {
      console.error(err);
      Alert.alert('Gagal', err.message || 'Gagal menyimpan produk');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
      {/* Header */}
      <View 
        className="flex-row items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: colors.border, backgroundColor: colors.surface }}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text className="text-lg font-black" style={{ color: colors.text }}>
          {editProduct ? 'Edit Produk' : 'Tambah Produk'}
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={isSaving}>
          {isSaving ? <ActivityIndicator color={colors.accent} /> : <Save color={colors.accent} size={24} />}
        </TouchableOpacity>
      </View>

      {/* Tab Selector */}
      <View 
        className="flex-row mx-6 mt-4 p-1 rounded-2xl border" 
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      >
        <TouchableOpacity 
          onPress={() => setActiveTab('info')}
          className="flex-1 py-3 rounded-xl items-center justify-center"
          style={{ backgroundColor: activeTab === 'info' ? colors.accent : 'transparent' }}
        >
          <Text 
            className="text-[10px] font-black uppercase tracking-wider" 
            style={{ color: activeTab === 'info' ? '#ffffff' : colors.textMuted }}
          >
            Info Umum
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setActiveTab('harga_stok')}
          className="flex-1 py-3 rounded-xl items-center justify-center"
          style={{ backgroundColor: activeTab === 'harga_stok' ? colors.accent : 'transparent' }}
        >
          <Text 
            className="text-[10px] font-black uppercase tracking-wider" 
            style={{ color: activeTab === 'harga_stok' ? '#ffffff' : colors.textMuted }}
          >
            Harga & Stok
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setActiveTab('lanjutan')}
          className="flex-1 py-3 rounded-xl items-center justify-center"
          style={{ backgroundColor: activeTab === 'lanjutan' ? colors.accent : 'transparent' }}
        >
          <Text 
            className="text-[10px] font-black uppercase tracking-wider" 
            style={{ color: activeTab === 'lanjutan' ? '#ffffff' : colors.textMuted }}
          >
            Lanjutan
          </Text>
        </TouchableOpacity>
      </View>

      {/* Form Content */}
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        
        {activeTab === 'info' && (
          <View className="flex gap-5 animate-in fade-in duration-200">
            {/* Image Section */}
            <View className="items-center mb-4">
              <TouchableOpacity 
                onPress={pickImage}
                className="w-40 h-40 rounded-[32px] overflow-hidden items-center justify-center border-2 border-dashed"
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              >
                {image ? (
                  <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <View className="items-center">
                    <ImageIcon color={colors.textMuted} size={40} opacity={0.3} />
                    <Text className="text-[10px] font-bold mt-2" style={{ color: colors.textMuted }}>Pilih Foto</Text>
                  </View>
                )}
              </TouchableOpacity>
              <View className="flex-row gap-4 mt-4">
                 <TouchableOpacity 
                    onPress={takePhoto}
                    className="flex-row items-center gap-2 px-4 py-2 rounded-xl bg-accent/10"
                 >
                    <CameraIcon size={16} color={colors.accent} />
                    <Text className="text-xs font-bold" style={{ color: colors.accent }}>Ambil Foto</Text>
                 </TouchableOpacity>
              </View>
              <View className="w-full mt-4 flex gap-1">
                <Text className="text-[8px] font-black text-app-text-muted uppercase tracking-wider ml-1" style={{ color: colors.textMuted }}>
                  Atau URL Gambar
                </Text>
                <TextInput 
                  placeholder="https://example.com/image.jpg"
                  placeholderTextColor={colors.textMuted + '60'}
                  value={formData.imageUrl} 
                  onChangeText={(text) => {
                    setFormData(prev => ({ ...prev, imageUrl: text }));
                    setImage(text || null);
                  }}
                  className="p-3 rounded-xl border text-xs font-bold"
                  style={{ backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }}
                />
              </View>
            </View>

            {/* General Fields */}
            <View>
              <Text className="text-[10px] font-black uppercase tracking-[2px] mb-2 ml-1" style={{ color: colors.textMuted }}>Nama Barang</Text>
              <TextInput
                placeholder="Contoh: Kopi Gula Aren"
                placeholderTextColor={colors.textMuted + '60'}
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                className="p-4 rounded-2xl border font-bold"
                style={{ backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }}
              />
            </View>

            <View className="flex-row gap-4">
              <View className="flex-1">
                <Text className="text-[10px] font-black uppercase tracking-[2px] mb-2 ml-1" style={{ color: colors.textMuted }}>Kategori Utama</Text>
                <TouchableOpacity 
                  onPress={() => setShowCategoryModal(true)}
                  className="p-4 rounded-2xl border font-bold flex-row items-center justify-between"
                  style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                >
                  <Text className="font-bold" style={{ color: formData.category ? colors.text : colors.textMuted + '60' }}>
                    {formData.category || 'Pilih Kategori'}
                  </Text>
                  <ChevronDown size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              
              <View className="flex-1">
                <Text className="text-[10px] font-black uppercase tracking-[2px] mb-2 ml-1" style={{ color: colors.textMuted }}>Variasi (Warna/Ukuran)</Text>
                <TextInput
                  placeholder="Contoh: Merah, XL"
                  placeholderTextColor={colors.textMuted + '60'}
                  value={formData.variation}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, variation: text }))}
                  className="p-4 rounded-2xl border font-bold"
                  style={{ backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }}
                />
              </View>
            </View>

            <View>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-[10px] font-black uppercase tracking-[2px] ml-1" style={{ color: colors.textMuted }}>Satuan</Text>
                <View className="flex-row items-center gap-2">
                  <Text className="text-[9px] font-bold uppercase" style={{ color: colors.textMuted }}>Kostum Satuan</Text>
                  <Switch
                    value={useAdvancedUnit}
                    onValueChange={(val) => {
                      setUseAdvancedUnit(val);
                      if (!val) setFormData(prev => ({ ...prev, unit: 'pcs' }));
                    }}
                    trackColor={{ false: colors.border, true: colors.accent }}
                    thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                </View>
              </View>

              {!useAdvancedUnit ? (
                <View className="p-4 rounded-2xl border flex-row items-center justify-between opacity-80" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                  <Text className="font-bold" style={{ color: colors.text }}>Pcs (pcs)</Text>
                  <Text className="text-[9px] font-bold px-2 py-0.5 rounded bg-teal-500/10 text-teal-500">DEFAULT</Text>
                </View>
              ) : (
                <View className="mt-1 p-4 rounded-2xl border flex gap-3 animate-in fade-in duration-200" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                  {UNIT_CATEGORIES.map(category => (
                    <View key={category.name} className="flex gap-2">
                      <Text className="text-[9px] font-black uppercase tracking-wider" style={{ color: colors.textMuted }}>{category.name}</Text>
                      <View className="flex-row flex-wrap gap-2">
                        {category.units.map(u => (
                          <TouchableOpacity
                            key={u.value}
                            onPress={() => setFormData(prev => ({ ...prev, unit: u.value }))}
                            className="px-3 py-2 rounded-xl border"
                            style={{
                              backgroundColor: formData.unit === u.value ? colors.accent + '20' : colors.bg,
                              borderColor: formData.unit === u.value ? colors.accent : colors.border
                            }}
                          >
                            <Text className="text-[10px] font-bold" style={{ color: formData.unit === u.value ? colors.accent : colors.text }}>
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
                      value={formData.unit}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, unit: text }))}
                      className="p-3 rounded-xl border text-xs font-bold"
                      style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
                    />
                  </View>
                </View>
              )}
            </View>

            <View className="flex-row gap-4">
              <View className="flex-1">
                <Text className="text-[10px] font-black uppercase tracking-[2px] mb-2 ml-1" style={{ color: colors.textMuted }}>SKU (Stok)</Text>
                <View className="flex-row gap-2">
                  <TextInput
                    placeholder="Input manual/Scan"
                    placeholderTextColor={colors.textMuted + '60'}
                    value={formData.sku}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, sku: text }))}
                    className="flex-1 p-3.5 rounded-xl border font-bold text-xs"
                    style={{ backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }}
                  />
                  <TouchableOpacity
                    onPress={generateAutomaticSku}
                    className="p-3.5 bg-accent rounded-xl flex-row items-center gap-1 shadow-md shadow-accent/20"
                  >
                    <Sparkles size={14} color="#ffffff" />
                    <Text className="text-[9px] font-black text-white uppercase tracking-wider">AUTO</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => startScanning('sku')}
                    className="p-3.5 rounded-xl border justify-center items-center"
                    style={{ backgroundColor: colors.accent + '15', borderColor: colors.accent + '30' }}
                  >
                    <Scan size={14} color={colors.accent} />
                  </TouchableOpacity>
                </View>
              </View>

              <View className="flex-1">
                <Text className="text-[10px] font-black uppercase tracking-[2px] mb-2 ml-1" style={{ color: colors.textMuted }}>Barcode</Text>
                <View className="flex-row gap-2">
                  <TextInput
                    placeholder="Barcode produk"
                    placeholderTextColor={colors.textMuted + '60'}
                    value={formData.barcode}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, barcode: text }))}
                    className="flex-1 p-3.5 rounded-xl border font-bold text-xs"
                    style={{ backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }}
                  />
                  <TouchableOpacity
                    onPress={() => startScanning('barcode')}
                    className="p-3.5 rounded-xl border justify-center items-center"
                    style={{ backgroundColor: colors.accent + '15', borderColor: colors.accent + '30' }}
                  >
                    <Scan size={14} color={colors.accent} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View>
              <Text className="text-[10px] font-black uppercase tracking-[2px] mb-2 ml-1" style={{ color: colors.textMuted }}>Deskripsi (Opsional)</Text>
              <TextInput
                placeholder="Tambahkan detail produk..."
                placeholderTextColor={colors.textMuted + '60'}
                multiline
                numberOfLines={4}
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                className="p-4 rounded-2xl border font-medium h-32"
                textAlignVertical="top"
                style={{ backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }}
              />
            </View>
          </View>
        )}

        {activeTab === 'harga_stok' && (
          <View className="flex gap-5 animate-in fade-in duration-200">
            
            {/* Pricing Section */}
            <View className="p-5 rounded-3xl border flex gap-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <View className="flex-row items-center gap-2 mb-2">
                <Info size={16} color={colors.accent} />
                <Text className="text-xs font-black uppercase tracking-wider" style={{ color: colors.text }}>Pengaturan Harga</Text>
              </View>

              <View>
                <Text className="text-[10px] font-black uppercase tracking-[2px] mb-2 ml-1" style={{ color: colors.textMuted }}>Harga Beli / Modal (Rp)</Text>
                <TextInput
                  placeholder="0"
                  keyboardType="numeric"
                  value={formData.purchasePrice === '0' ? '' : formData.purchasePrice}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, purchasePrice: text }))}
                  className="p-4 rounded-2xl border font-bold"
                  style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
                />
              </View>

              <View>
                <Text className="text-[10px] font-black uppercase tracking-[2px] mb-2 ml-1" style={{ color: colors.accent }}>Harga Jual Reguler (Rp)</Text>
                <TextInput
                  placeholder="0"
                  keyboardType="numeric"
                  value={formData.price === '0' ? '' : formData.price}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, price: text }))}
                  className="p-4 rounded-2xl border font-black text-lg"
                  style={{ backgroundColor: colors.bg, color: colors.accent, borderColor: colors.accent + '30' }}
                />
              </View>

              <View>
                <Text className="text-[10px] font-black uppercase tracking-[2px] mb-2 ml-1" style={{ color: colors.textMuted }}>Harga Grosir (Rp - Opsional)</Text>
                <TextInput
                  placeholder="0"
                  keyboardType="numeric"
                  value={formData.wholesalePrice === '0' ? '' : formData.wholesalePrice}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, wholesalePrice: text }))}
                  className="p-4 rounded-2xl border font-bold"
                  style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
                />
              </View>
            </View>

            {/* Stock Management Section */}
            <View className="p-5 rounded-3xl border flex gap-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-xl items-center justify-center bg-teal-500/10">
                    <Layers size={18} color="#10b981" />
                  </View>
                  <View>
                    <Text className="text-xs font-black" style={{ color: colors.text }}>Kelola Stok Barang (Inventaris)</Text>
                    <Text className="text-[9px] font-bold" style={{ color: colors.textMuted }}>Pantau mutasi stok di gudang</Text>
                  </View>
                </View>
                <Switch
                  value={formData.manageStock}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, manageStock: val }))}
                  trackColor={{ false: colors.border, true: '#10b981' }}
                  thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
                />
              </View>

              {formData.manageStock && (
                <View className="border-t pt-3 flex gap-4 animate-in fade-in duration-200" style={{ borderColor: colors.border + '20' }}>
                  <View>
                    <Text className="text-[10px] font-black uppercase tracking-[2px] mb-2 ml-1" style={{ color: colors.textMuted }}>Kuantitas Stok Awal</Text>
                    <TextInput
                      placeholder="0"
                      keyboardType="numeric"
                      value={formData.stock}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, stock: text }))}
                      className="p-4 rounded-2xl border font-bold"
                      style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
                    />
                  </View>

                  <View>
                    <Text className="text-[10px] font-black uppercase tracking-[2px] mb-2 ml-1" style={{ color: colors.textMuted }}>Tanggal Masuk Barang</Text>
                    <TextInput
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.textMuted + '60'}
                      value={formData.entryDate}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, entryDate: text }))}
                      className="p-4 rounded-2xl border font-bold"
                      style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
                    />
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {activeTab === 'lanjutan' && (
          <View className="flex gap-5 animate-in fade-in duration-200">
            
            {/* Masa Berlaku (Expired) */}
            <View className="p-5 rounded-3xl border flex gap-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-xl items-center justify-center bg-amber-500/10">
                    <Calendar size={18} color="#f59e0b" />
                  </View>
                  <View>
                    <Text className="text-xs font-black" style={{ color: colors.text }}>Masa Berlaku (Expired)</Text>
                    <Text className="text-[9px] font-bold" style={{ color: colors.textMuted }}>Aktifkan tanggal kedaluwarsa</Text>
                  </View>
                </View>
                <Switch
                  value={hasExpiryDate}
                  onValueChange={(val) => {
                    setHasExpiryDate(val);
                    if (!val) setFormData(prev => ({ ...prev, expiryDate: '' }));
                  }}
                  trackColor={{ false: colors.border, true: '#f59e0b' }}
                  thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
                />
              </View>
              {hasExpiryDate && (
                <View className="border-t pt-3 flex gap-2 animate-in fade-in duration-200" style={{ borderColor: colors.border + '20' }}>
                  <Text className="text-[10px] font-black uppercase tracking-wider ml-1 mb-1" style={{ color: colors.textMuted }}>Tanggal Kedaluwarsa</Text>
                  <TextInput
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textMuted + '60'}
                    value={formData.expiryDate}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, expiryDate: text }))}
                    className="p-4 rounded-2xl border font-bold"
                    style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
                  />
                </View>
              )}
            </View>

            {/* Produk Ekstra (Modifier) */}
            <View className="p-5 rounded-3xl border flex gap-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-xl items-center justify-center bg-purple-500/10">
                    <Layers size={18} color="#8b5cf6" />
                  </View>
                  <View>
                    <Text className="text-xs font-black" style={{ color: colors.text }}>Produk Ekstra (Modifier)</Text>
                    <Text className="text-[9px] font-bold" style={{ color: colors.textMuted }}>Aktifkan grup ekstra produk</Text>
                  </View>
                </View>
                <Switch
                  value={formData.hasExtras}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, hasExtras: val }))}
                  trackColor={{ false: colors.border, true: '#8b5cf6' }}
                  thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
                />
              </View>
              {formData.hasExtras && (
                <View className="border-t pt-3 flex gap-2 animate-in fade-in duration-200" style={{ borderColor: colors.border + '20' }}>
                  <Text className="text-[10px] font-black uppercase tracking-wider mb-2 ml-1" style={{ color: colors.textMuted }}>Pilih Grup Modifier</Text>
                  {availableExtras.length === 0 ? (
                    <Text className="text-[11px] font-bold italic" style={{ color: colors.textMuted }}>
                      Belum ada grup ekstra yang aktif. Buat di menu Ekstra terlebih dahulu.
                    </Text>
                  ) : (
                    <View className="flex gap-2">
                      {availableExtras.map(extra => {
                        const isSelected = formData.extras.includes(extra.id);
                        return (
                          <TouchableOpacity
                            key={extra.id}
                            onPress={() => {
                              const current = formData.extras || [];
                              const next = isSelected 
                                ? current.filter((id: string) => id !== extra.id)
                                : [...current, extra.id];
                              setFormData(prev => ({ ...prev, extras: next }));
                            }}
                            className="p-3 rounded-2xl border flex-row items-center justify-between"
                            style={{
                              backgroundColor: isSelected ? colors.accent + '10' : colors.bg,
                              borderColor: isSelected ? colors.accent : colors.border
                            }}
                          >
                            <View className="flex-row items-center gap-3">
                              {isSelected ? (
                                <CheckSquare size={16} color={colors.accent} />
                              ) : (
                                <Square size={16} color={colors.textMuted} />
                              )}
                              <Text className="text-xs font-bold" style={{ color: colors.text }}>{extra.name}</Text>
                            </View>
                            <Text className="text-xs font-black text-emerald-400">Rp {extra.price?.toLocaleString('id-ID') || 0}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Garansi Produk */}
            <View className="p-5 rounded-3xl border flex gap-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-xl items-center justify-center bg-blue-500/10">
                    <Shield size={18} color="#3b82f6" />
                  </View>
                  <View>
                    <Text className="text-xs font-black" style={{ color: colors.text }}>Garansi Produk</Text>
                    <Text className="text-[9px] font-bold" style={{ color: colors.textMuted }}>Aktifkan masa garansi produk</Text>
                  </View>
                </View>
                <Switch
                  value={hasWarranty}
                  onValueChange={(val) => {
                    setHasWarranty(val);
                    if (!val) setFormData(prev => ({ ...prev, warrantyDuration: '0' }));
                  }}
                  trackColor={{ false: colors.border, true: '#3b82f6' }}
                  thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
                />
              </View>
              {hasWarranty && (
                <View className="border-t pt-3 flex gap-3 animate-in fade-in duration-200" style={{ borderColor: colors.border + '20' }}>
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Text className="text-[10px] font-black uppercase tracking-wider ml-1 mb-1.5" style={{ color: colors.textMuted }}>Durasi</Text>
                      <TextInput
                        keyboardType="numeric"
                        value={formData.warrantyDuration}
                        onChangeText={(text) => setFormData(prev => ({ ...prev, warrantyDuration: text }))}
                        className="p-4 rounded-2xl border font-bold"
                        style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[10px] font-black uppercase tracking-wider ml-1 mb-1.5" style={{ color: colors.textMuted }}>Satuan</Text>
                      <View className="flex-row gap-1">
                        {['days', 'months', 'years'].map((unit) => {
                          const label = unit === 'days' ? 'Hari' : unit === 'months' ? 'Bulan' : 'Tahun';
                          const isSelected = formData.warrantyUnit === unit;
                          return (
                            <TouchableOpacity
                              key={unit}
                              onPress={() => setFormData(prev => ({ ...prev, warrantyUnit: unit }))}
                              className="flex-1 py-3.5 rounded-xl border items-center justify-center"
                              style={{
                                backgroundColor: isSelected ? colors.accent + '20' : colors.bg,
                                borderColor: isSelected ? colors.accent : colors.border
                              }}
                            >
                              <Text className="text-[10px] font-bold" style={{ color: isSelected ? colors.accent : colors.text }}>
                                {label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                  <Text className="text-[9px] italic text-blue-400 leading-normal px-1">
                    * Masa garansi dihitung sejak tanggal penjualan produk.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          className="h-16 rounded-[24px] items-center justify-center shadow-xl mt-6 flex-row gap-2"
          style={{ backgroundColor: colors.accent }}
        >
          {isSaving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Save color="#ffffff" size={18} />
              <Text className="text-sm font-black uppercase tracking-[2px] text-white">
                SIMPAN PRODUK
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* 1. Category Selection Drawer Modal */}
      <Modal visible={showCategoryModal} animationType="slide" transparent onRequestClose={() => setShowCategoryModal(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="h-[60%] rounded-t-[40px] p-6" style={{ backgroundColor: colors.bg }}>
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-lg font-black" style={{ color: colors.text }}>Pilih Kategori</Text>
                <Text className="text-xs font-bold" style={{ color: colors.textMuted }}>Kategori produk utama</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)} className="w-10 h-10 rounded-full bg-black/10 items-center justify-center">
                <X color={colors.text} size={20} />
              </TouchableOpacity>
            </View>
            <ScrollView className="flex-1">
              <View className="flex gap-2">
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => {
                      setFormData(prev => ({ ...prev, category: cat }));
                      setShowCategoryModal(false);
                    }}
                    className="p-4 rounded-2xl border flex-row items-center justify-between"
                    style={{ 
                      backgroundColor: colors.surface, 
                      borderColor: formData.category === cat ? colors.accent : colors.border 
                    }}
                  >
                    <Text className="font-bold" style={{ color: colors.text }}>{cat}</Text>
                    {formData.category === cat && <Check size={18} color={colors.accent} />}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  onPress={() => {
                    setShowCategoryModal(false);
                    setTimeout(() => {
                      setShowCustomCategoryModal(true);
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

      {/* 2. Custom Category Input Dialog Modal */}
      <Modal visible={showCustomCategoryModal} animationType="fade" transparent onRequestClose={() => setShowCustomCategoryModal(false)}>
        <View className="flex-1 bg-black/75 items-center justify-center p-6">
          <View className="w-full max-w-sm rounded-[32px] p-6 items-center" style={{ backgroundColor: colors.surface }}>
            <Text className="text-base font-black text-center mb-4" style={{ color: colors.text }}>Kategori Kustom Baru</Text>
            <TextInput
              placeholder="Masukkan nama kategori..."
              placeholderTextColor={colors.textMuted + '60'}
              value={customCategoryText}
              onChangeText={setCustomCategoryText}
              className="w-full p-4 rounded-2xl border font-bold mb-4"
              style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
            />
            <View className="flex-row gap-3 w-full">
              <TouchableOpacity 
                onPress={() => {
                  setShowCustomCategoryModal(false);
                  setCustomCategoryText('');
                }} 
                className="flex-1 py-3.5 rounded-xl bg-background border items-center justify-center"
                style={{ borderColor: colors.border }}
              >
                <Text className="font-bold text-xs" style={{ color: colors.textMuted }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => {
                  if (customCategoryText.trim()) {
                    setFormData(prev => ({ ...prev, category: customCategoryText.trim() }));
                    setShowCustomCategoryModal(false);
                    setCustomCategoryText('');
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

      {/* 3. Scanner Modal */}
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
          <View className="absolute inset-0 items-center justify-center">
            <View className="w-64 h-64 border-4 border-accent rounded-3xl opacity-50" />
            <Text className="text-white font-black mt-8 text-lg bg-black/40 px-6 py-2 rounded-full">
              PINDAI {scanTarget.toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity 
            onPress={() => setShowScanner(false)}
            className="absolute top-12 right-6 w-12 h-12 rounded-full bg-black/50 items-center justify-center"
          >
            <X color="white" size={28} />
          </TouchableOpacity>
        </View>
      </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
