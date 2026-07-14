import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image as RNImage, Modal, Linking } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, CheckCircle2, Truck, Building, CreditCard, QrCode, Coins, Camera, Trash2, Check } from 'lucide-react-native';
import { db, primaryDb, getTenantDb } from '../lib/firebase';
import { collection, doc, getDoc, getDocs, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function MarketplaceCheckoutScreen({ route, navigation }: any) {
  const { storeId } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  const { user, storeId: myStoreId } = useAuthStore();
  const { items, clearStoreCart } = useCartStore();
  const storeItems = items.filter(item => item.storeId === storeId);
  const totalAmount = storeItems.reduce((acc, item) => acc + (item.price * item.qty), 0);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup');
  const [loading, setLoading] = useState(false);

  // Advanced Payment & Settlement Options
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'transfer' | 'ewallet' | 'qris'>('cod');
  const [storeBanks, setStoreBanks] = useState<any[]>([]);
  const [storeEwallets, setStoreEwallets] = useState<any[]>([]);
  const [selectedStoreBankId, setSelectedStoreBankId] = useState('');
  const [selectedStoreEwalletId, setSelectedStoreEwalletId] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [storeAllowPickup, setStoreAllowPickup] = useState(true);
  const [storeAllowDelivery, setStoreAllowDelivery] = useState(true);
  const [storeQrisUrl, setStoreQrisUrl] = useState('');
  const [isQrisPreviewVisible, setIsQrisPreviewVisible] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      let defaultName = user.displayName || user.name || '';
      let defaultPhone = user.phone || user.phoneNumber || '';
      let defaultAddress = user.address || '';
      
      try {
        const targetStoreId = myStoreId || user.uid;
        const settingsRef = doc(db, 'settings', `store_${targetStoreId}`);
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          if (!defaultName && data.storeName) defaultName = data.storeName;
          if (!defaultPhone && data.phone) defaultPhone = data.phone;
          if (!defaultAddress && data.address) defaultAddress = data.address;
        }
      } catch (err) {
        console.error("Failed to fetch user settings:", err);
      }
      
      setName(defaultName);
      setPhone(defaultPhone);
      setAddress(defaultAddress);
    };
    
    fetchUserData();
  }, [user, myStoreId]);

  useEffect(() => {
    const fetchStoreSettings = async () => {
      if (!storeId) return;
      try {
        // Collect all DB candidates to try
        const dbCandidates: any[] = [db, primaryDb]; // default + primary always tried

        // Try to resolve the store's specific tenant DB from primaryDb.stores
        const sSnapPrimary = await getDoc(doc(primaryDb, 'stores', storeId));
        if (sSnapPrimary.exists()) {
          const cfg = sSnapPrimary.data().infraConfig;
          if (cfg) {
            const tenantDb = getTenantDb(cfg);
            // Insert tenant DB at front (highest priority)
            dbCandidates.unshift(tenantDb);
            console.log('[Checkout] Resolved tenant DB for storeId:', storeId, 'projectId:', cfg.projectId);
          }
        } else {
          // Fallback: scan all stores to find the correct tenant DB
          console.log('[Checkout] Store not found by direct ID, scanning all stores...');
          const allStores = await getDocs(collection(primaryDb, 'stores'));
          allStores.forEach(d => {
            if (d.id === storeId) {
              const cfg = d.data().infraConfig;
              if (cfg) dbCandidates.unshift(getTenantDb(cfg));
            }
          });
        }

        // Try each DB candidate until we find the settings document
        let settingsData: any = null;
        for (const candidateDb of dbCandidates) {
          try {
            const snap = await getDoc(doc(candidateDb, 'settings', `store_${storeId}`));
            if (snap.exists()) {
              settingsData = snap.data();
              console.log('[Checkout] Settings found in candidate DB, banks:', settingsData.storeBanks?.length, 'ewallets:', settingsData.storeEwallets?.length, 'qrisUrl:', !!settingsData.qrisUrl);
              break;
            }
          } catch (e) {}
        }

        if (settingsData) {
          setStoreBanks(settingsData.storeBanks || []);
          setStoreEwallets(settingsData.storeEwallets || []);
          setStoreAllowPickup(settingsData.allowPickup !== false);
          setStoreAllowDelivery(settingsData.allowDelivery !== false);
          setStoreQrisUrl(settingsData.qrisUrl || '');

          if (settingsData.allowPickup === false && settingsData.allowDelivery !== false) {
            setDeliveryType('delivery');
          } else {
            setDeliveryType('pickup');
          }
          if (settingsData.storeBanks && settingsData.storeBanks.length > 0) {
            setSelectedStoreBankId(settingsData.storeBanks[0].id);
          }
          if (settingsData.storeEwallets && settingsData.storeEwallets.length > 0) {
            setSelectedStoreEwalletId(settingsData.storeEwallets[0].id);
          }
        } else {
          console.warn('[Checkout] Store settings NOT FOUND in any DB for storeId:', storeId);
        }
      } catch (err) {
        console.error("Failed to fetch store settings:", err);
      }
    };
    
    fetchStoreSettings();
  }, [storeId]);



  const pickAndUploadImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Izin akses galeri diperlukan untuk mengunggah bukti transfer.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8
      });
      
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      
      const localUri = result.assets[0].uri;
      setIsUploading(true);
      
      // Upload to Cloudinary
      const formDataUpload = new FormData();
      const filename = localUri.split('/').pop() || 'file.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      formDataUpload.append('file', { uri: localUri, name: filename, type } as any);
      formDataUpload.append('upload_preset', 'kasirpos');
      
      const uploadRes = await fetch('https://api.cloudinary.com/v1_1/dkcjfwbvc/image/upload', {
        method: 'POST',
        body: formDataUpload,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const uploadResult = await uploadRes.json();
      if (uploadRes.ok && uploadResult.secure_url) {
        setPaymentProofUrl(uploadResult.secure_url);
        Alert.alert('Sukses', 'Bukti pembayaran berhasil diunggah!');
      } else {
        throw new Error(uploadResult.error?.message || 'Gagal mengunggah bukti');
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Gagal', err.message || 'Gagal mengunggah bukti pembayaran.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadQris = async (url: string) => {
    if (!url) return;
    try {
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (!isSharingAvailable) {
        Alert.alert('Info', 'Fitur sharing tidak tersedia di perangkat Anda.');
        return;
      }
      const extension = url.split('.').pop()?.split('?')[0] || 'png';
      const localUri = `${FileSystem.documentDirectory}qris_pembayaran.${extension}`;

      const downloadResult = await FileSystem.downloadAsync(url, localUri);
      if (downloadResult.status === 200) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
          dialogTitle: 'Unduh / Simpan QRIS',
        });
      } else {
        Alert.alert('Gagal', 'Gagal mengunduh gambar QRIS.');
      }
    } catch (error: any) {
      console.error(error);
      Linking.openURL(url);
    }
  };

  const handleCheckout = async () => {
    if (!name || !phone) {
      Alert.alert('Error', 'Nama dan Nomor HP wajib diisi!');
      return;
    }
    if (deliveryType === 'delivery' && !address) {
      Alert.alert('Error', 'Alamat pengiriman wajib diisi untuk opsi Delivery!');
      return;
    }
    if ((paymentMethod === 'transfer' || paymentMethod === 'qris') && !paymentProofUrl) {
      Alert.alert('Error', 'Silakan unggah bukti transfer pembayaran terlebih dahulu!');
      return;
    }

    setLoading(true);
    try {
      let tDb = db;
      if (storeId) {
        const sRefPrimary = doc(primaryDb, 'stores', storeId);
        const sSnapPrimary = await getDoc(sRefPrimary);
        if (sSnapPrimary.exists()) {
          const cfg = sSnapPrimary.data().infraConfig;
          tDb = cfg ? getTenantDb(cfg) : primaryDb;
        }
      }

      let finalId = '';
      
      await runTransaction(tDb, async (transaction) => {
        // --- 1. Lakukan SEMUA proses baca (reads) terlebih dahulu ---
        const settingsRef = doc(tDb, 'settings', `store_${storeId}`);
        const settingsSnap = await transaction.get(settingsRef);
        
        const productReads = [];
        for (const item of storeItems) {
          const pRef = doc(tDb, 'products', item.productId);
          const pSnap = await transaction.get(pRef);
          productReads.push({ ref: pRef, snap: pSnap, item });
        }

        // --- 2. Lakukan validasi dan penulisan (writes) ---
        let currentCounter = 0;
        let prefix = 'TRX';
        let padding = 4;
        
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          currentCounter = Number(data.trxCounter) || 0;
          prefix = data.trxPrefix || 'TRX';
          padding = data.trxPadding || 4;
        }
        
        currentCounter += 1;
        finalId = `${prefix}${String(currentCounter).padStart(padding, '0')}`;
        
        let activeBank = null;
        let activeEwallet = null;
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          const banks = data.storeBanks || [];
          const ewallets = data.storeEwallets || [];
          activeBank = banks.find((b: any) => b.id === selectedStoreBankId) || banks[0] || null;
          activeEwallet = ewallets.find((ew: any) => ew.id === selectedStoreEwalletId) || ewallets[0] || null;
        }

        const orderData = {
          id: finalId,
          queueNumber: currentCounter,
          storeId,
          storeName: storeItems[0]?.storeName || '',
          customerName: name,
          customerPhone: phone,
          guestId: user?.uid || '',
          items: storeItems.map(item => ({
            id: item.productId,
            name: item.name,
            price: item.price,
            qty: item.qty,
            subtotal: item.price * item.qty,
            imageUrl: item.imageUrl || '',
            storeName: item.storeName || '',
            selectedExtras: item.extras || []
          })),
          subtotal: totalAmount,
          taxAmount: 0,
          discountAmount: 0,
          total: totalAmount,
          status: 'pending', // Marketplace orders usually wait for confirmation
          orderStatus: 'new',
          paymentMethod: paymentMethod,
          selectedPaymentDetails: paymentMethod === 'transfer' 
            ? activeBank
            : paymentMethod === 'qris' 
              ? activeEwallet
              : null,
          paymentProofUrl: (paymentMethod === 'transfer' || paymentMethod === 'qris') ? paymentProofUrl : '',
          paymentStatus: paymentMethod === 'cod' ? 'pending' : (paymentProofUrl ? 'pending' : 'unpaid'),
          paymentCategory: 'order',
          deliveryType,
          deliveryAddress: deliveryType === 'delivery' ? address : '',
          orderType: 'online',
          cashierName: 'Online (Sistem)',
          cashierId: 'online',
          paidAmount: 0,
          debtAmount: totalAmount,
          timestamp: serverTimestamp(),
          createdAt: new Date().toISOString(),
          userId: user?.uid || user?.phone || 'anonymous'
        };

        // Check and deduct stock/update soldCount
        for (const { ref, snap, item } of productReads) {
          if (snap.exists()) {
            const pData = snap.data();
            const currentSold = pData.soldCount || 0;
            const updateFields: any = { soldCount: currentSold + item.qty };

            if (pData.manageStock !== false) {
              const currentStock = pData.stock || 0;
              if (currentStock < item.qty) {
                throw new Error(`Stok produk ${item.name} tidak mencukupi.`);
              }
              updateFields.stock = currentStock - item.qty;
            }
            transaction.update(ref, updateFields);
          }
        }

        const newOrderRef = doc(tDb, 'transactions', finalId);
        transaction.set(newOrderRef, orderData);
        transaction.set(settingsRef, { trxCounter: currentCounter }, { merge: true });
      });

      if (user?.uid) {
        // Sync phone and address to user profile
        try {
           await updateDoc(doc(primaryDb, 'users', user.uid), {
             phone,
             address
           });
        } catch (e) {}
      }

      clearStoreCart(storeId);
      Alert.alert('Berhasil', `Pesanan berhasil dibuat dengan ID: ${finalId}`);
      navigation.navigate('MarketplaceOrders');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Gagal', err.message || 'Terjadi kesalahan saat memproses pesanan.');
    } finally {
      setLoading(false);
    }
  };

  if (storeItems.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft color={colors.text} size={24} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Checkout</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={{ color: colors.text }}>Tidak ada barang dari toko ini di keranjang.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Checkout</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Informasi Pelanggan</Text>
          
          <Text style={[styles.label, { color: colors.text }]}>Nama Lengkap</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
            value={name}
            onChangeText={setName}
            placeholder="Contoh: Budi Santoso"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.label, { color: colors.text }]}>Nomor WhatsApp</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
            value={phone}
            onChangeText={setPhone}
            placeholder="Contoh: 08123456789"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Metode Pengambilan</Text>
          <View style={styles.radioGroup}>
            <TouchableOpacity 
              style={[styles.radioItem, { borderColor: deliveryType === 'pickup' ? colors.accent : colors.border }]}
              onPress={() => setDeliveryType('pickup')}
            >
              <View style={styles.radioHeader}>
                <View style={[styles.radioOuter, { borderColor: deliveryType === 'pickup' ? colors.accent : colors.textMuted }]}>
                  {deliveryType === 'pickup' && <View style={[styles.radioInner, { backgroundColor: colors.accent }]} />}
                </View>
                <Text style={[styles.radioLabel, { color: colors.text }]}>Ambil di Toko</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.radioItem, { borderColor: deliveryType === 'delivery' ? colors.accent : colors.border }]}
              onPress={() => setDeliveryType('delivery')}
            >
              <View style={styles.radioHeader}>
                <View style={[styles.radioOuter, { borderColor: deliveryType === 'delivery' ? colors.accent : colors.textMuted }]}>
                  {deliveryType === 'delivery' && <View style={[styles.radioInner, { backgroundColor: colors.accent }]} />}
                </View>
                <Text style={[styles.radioLabel, { color: colors.text }]}>Kirim ke Alamat</Text>
              </View>
            </TouchableOpacity>
          </View>

          {deliveryType === 'delivery' && (
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.label, { color: colors.text }]}>Alamat Pengiriman</Text>
              <TextInput
                style={[styles.inputArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
                value={address}
                onChangeText={setAddress}
                placeholder="Alamat lengkap tujuan pengiriman..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>
          )}
        </View>

        {/* Metode Pembayaran */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Metode Pembayaran</Text>
          
          <View style={{ gap: 10 }}>
            <TouchableOpacity 
              style={[styles.radioItem, { borderColor: paymentMethod === 'cod' ? colors.accent : colors.border, flexDirection: 'row', alignItems: 'center' }]}
              onPress={() => setPaymentMethod('cod')}
            >
              <View style={[styles.radioOuter, { borderColor: paymentMethod === 'cod' ? colors.accent : colors.textMuted }]}>
                {paymentMethod === 'cod' && <View style={[styles.radioInner, { backgroundColor: colors.accent }]} />}
              </View>
              <Coins color={paymentMethod === 'cod' ? colors.accent : colors.textMuted} size={18} />
              <Text style={[styles.radioLabel, { color: colors.text, marginLeft: 8 }]}>COD (Bayar di Tempat)</Text>
            </TouchableOpacity>

            {storeBanks.length > 0 && (
              <TouchableOpacity 
                style={[styles.radioItem, { borderColor: paymentMethod === 'transfer' ? colors.accent : colors.border, flexDirection: 'row', alignItems: 'center' }]}
                onPress={() => setPaymentMethod('transfer')}
              >
                <View style={[styles.radioOuter, { borderColor: paymentMethod === 'transfer' ? colors.accent : colors.textMuted }]}>
                  {paymentMethod === 'transfer' && <View style={[styles.radioInner, { backgroundColor: colors.accent }]} />}
                </View>
                <CreditCard color={paymentMethod === 'transfer' ? colors.accent : colors.textMuted} size={18} />
                <Text style={[styles.radioLabel, { color: colors.text, marginLeft: 8 }]}>Transfer Bank</Text>
              </TouchableOpacity>
            )}

            {storeEwallets.length > 0 && (
              <TouchableOpacity 
                style={[styles.radioItem, { borderColor: paymentMethod === 'ewallet' ? colors.accent : colors.border, flexDirection: 'row', alignItems: 'center' }]}
                onPress={() => setPaymentMethod('ewallet')}
              >
                <View style={[styles.radioOuter, { borderColor: paymentMethod === 'ewallet' ? colors.accent : colors.textMuted }]}>
                  {paymentMethod === 'ewallet' && <View style={[styles.radioInner, { backgroundColor: colors.accent }]} />}
                </View>
                <CreditCard color={paymentMethod === 'ewallet' ? colors.accent : colors.textMuted} size={18} />
                <Text style={[styles.radioLabel, { color: colors.text, marginLeft: 8 }]}>E-Wallet</Text>
              </TouchableOpacity>
            )}

            {storeQrisUrl.length > 0 && (
              <TouchableOpacity 
                style={[styles.radioItem, { borderColor: paymentMethod === 'qris' ? colors.accent : colors.border, flexDirection: 'row', alignItems: 'center' }]}
                onPress={() => setPaymentMethod('qris')}
              >
                <View style={[styles.radioOuter, { borderColor: paymentMethod === 'qris' ? colors.accent : colors.textMuted }]}>
                  {paymentMethod === 'qris' && <View style={[styles.radioInner, { backgroundColor: colors.accent }]} />}
                </View>
                <QrCode color={paymentMethod === 'qris' ? colors.accent : colors.textMuted} size={18} />
                <Text style={[styles.radioLabel, { color: colors.text, marginLeft: 8 }]}>QRIS (Scan Barcode)</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Details for Transfer or QRIS or E-Wallet */}
          {(paymentMethod === 'transfer' || paymentMethod === 'ewallet' || paymentMethod === 'qris') && (
            <View style={{ marginTop: 16, padding: 12, backgroundColor: colors.bg, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
              {paymentMethod === 'transfer' && storeBanks.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase' }}>Pilih Rekening Bank</Text>
                  {storeBanks.map((bank: any) => (
                    <TouchableOpacity
                      key={bank.id}
                      onPress={() => setSelectedStoreBankId(bank.id)}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: selectedStoreBankId === bank.id ? colors.accent : colors.border,
                        backgroundColor: colors.surface,
                        marginBottom: 6,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <View>
                        <Text style={{ fontSize: 12, fontWeight: '900', color: colors.text, textTransform: 'uppercase' }}>{bank.bankName}</Text>
                        <Text style={{ fontSize: 11, color: colors.text, marginTop: 2, fontFamily: 'monospace' }}>{bank.accountNumber}</Text>
                        <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>a.n. {bank.accountHolder}</Text>
                      </View>
                      {selectedStoreBankId === bank.id && (
                        <Check size={16} color={colors.accent} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {paymentMethod === 'ewallet' && storeEwallets.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase' }}>Pilih Akun E-Wallet</Text>
                  {storeEwallets.map((wallet: any) => (
                    <TouchableOpacity
                      key={wallet.id}
                      onPress={() => setSelectedStoreEwalletId(wallet.id)}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: selectedStoreEwalletId === wallet.id ? colors.accent : colors.border,
                        backgroundColor: colors.surface,
                        marginBottom: 6,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <View>
                        <Text style={{ fontSize: 12, fontWeight: '900', color: colors.text, textTransform: 'uppercase' }}>{wallet.ewalletName || wallet.walletName || wallet.name || 'E-Wallet'}</Text>
                        <Text style={{ fontSize: 11, color: colors.text, marginTop: 2, fontFamily: 'monospace' }}>{wallet.phoneNumber || wallet.accountNumber || ''}</Text>
                        <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>a.n. {wallet.accountHolder || wallet.holderName || ''}</Text>
                      </View>
                      {selectedStoreEwalletId === wallet.id && (
                        <Check size={16} color={colors.accent} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {paymentMethod === 'qris' && (
                <View style={{ marginBottom: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase', alignSelf: 'flex-start' }}>Scan QRIS Toko</Text>
                  
                  <View style={{ alignItems: 'center', marginTop: 4, width: '100%' }}>
                    {storeQrisUrl ? (
                      <>
                        <TouchableOpacity 
                          onPress={() => setIsQrisPreviewVisible(true)}
                          style={{ width: 140, height: 140, backgroundColor: '#fff', borderRadius: 12, padding: 8, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}
                        >
                          <RNImage source={{ uri: storeQrisUrl }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setIsQrisPreviewVisible(true)} style={{ marginBottom: 6 }}>
                          <Text style={{ fontSize: 10, color: colors.accent, fontWeight: 'bold' }}>🔍 Ketuk untuk Perbesar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDownloadQris(storeQrisUrl)} style={{ marginBottom: 12, backgroundColor: colors.accent + '15', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 }}>
                          <Text style={{ fontSize: 10, color: colors.accent, fontWeight: 'bold' }}>⬇️ Simpan / Bagikan QRIS</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <Text style={{ fontSize: 10, color: colors.textMuted, marginVertical: 8, fontStyle: 'italic' }}>Toko belum mengunggah gambar QRIS.</Text>
                    )}
                  </View>
                </View>
              )}

              {/* Upload Proof */}
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase' }}>Unggah Bukti Pembayaran</Text>
                {paymentProofUrl ? (
                  <View style={{ position: 'relative', width: 120, height: 90, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                    <RNImage source={{ uri: paymentProofUrl }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                    <TouchableOpacity
                      onPress={() => setPaymentProofUrl('')}
                      style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}
                    >
                      <Trash2 size={12} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={pickAndUploadImage}
                    disabled={isUploading}
                    style={{
                      height: 50,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderStyle: 'dashed',
                      borderColor: colors.accent,
                      justifyContent: 'center',
                      alignItems: 'center',
                      flexDirection: 'row',
                      gap: 8,
                      backgroundColor: colors.surface
                    }}
                  >
                    {isUploading ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <>
                        <Camera size={18} color={colors.accent} />
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.accent }}>Pilih & Upload Foto</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Ringkasan Pesanan</Text>
          {storeItems.map((item) => (
            <View key={item.productId} style={styles.summaryRow}>
              <Text style={[styles.summaryName, { color: colors.text }]} numberOfLines={1}>
                {item.qty}x {item.name}
              </Text>
              <Text style={[styles.summaryPrice, { color: colors.text }]}>
                Rp {(item.price * item.qty).toLocaleString('id-ID')}
              </Text>
            </View>
          ))}
          <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total Tagihan</Text>
            <Text style={[styles.totalValue, { color: colors.accent }]}>
              Rp {totalAmount.toLocaleString('id-ID')}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom || 16 }]}>
        <TouchableOpacity 
          style={[styles.submitBtn, { backgroundColor: colors.accent }]}
          onPress={handleCheckout}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <CheckCircle2 color="#fff" size={20} />
              <Text style={styles.submitBtnText}>Buat Pesanan</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* QRIS Image Preview Modal */}
      <Modal
        visible={isQrisPreviewVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsQrisPreviewVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <TouchableOpacity 
            style={{ position: 'absolute', top: 40, right: 20, padding: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 }}
            onPress={() => setIsQrisPreviewVisible(false)}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>Tutup</Text>
          </TouchableOpacity>

          {(storeQrisUrl || (storeEwallets.find((ew: any) => ew.qrCodeUrl) || storeEwallets[0])?.qrCodeUrl) ? (
            <View style={{ width: '100%', alignItems: 'center' }}>
              <View style={{ width: '90%', aspectRatio: 1, backgroundColor: '#fff', borderRadius: 16, padding: 12, justifyContent: 'center', alignItems: 'center' }}>
                <RNImage 
                  source={{ uri: storeQrisUrl || (storeEwallets.find((ew: any) => ew.qrCodeUrl) || storeEwallets[0])?.qrCodeUrl }} 
                  style={{ width: '100%', height: '100%', resizeMode: 'contain' }} 
                />
              </View>
              
              <TouchableOpacity 
                onPress={() => {
                  const activeEw = storeEwallets.find((ew: any) => ew.qrCodeUrl) || storeEwallets[0];
                  handleDownloadQris(storeQrisUrl || activeEw?.qrCodeUrl);
                }}
                style={{ marginTop: 24, backgroundColor: colors.accent, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'black', uppercase: true }}>Simpan ke Galeri / Bagikan</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={{ color: '#fff' }}>QRIS tidak tersedia</Text>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { padding: 4, marginLeft: -4 },
  headerTitle: { fontFamily: 'System', fontWeight: '800', fontSize: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  section: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionTitle: { fontFamily: 'System', fontWeight: '800', fontSize: 16, marginBottom: 16 },
  label: { fontFamily: 'System', fontSize: 13, marginBottom: 6, fontWeight: '500' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, height: 44, marginBottom: 16, fontFamily: 'System' },
  inputArea: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingTop: 12, minHeight: 80, fontFamily: 'System', textAlignVertical: 'top' },
  radioGroup: { flexDirection: 'row', gap: 12 },
  radioItem: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 12 },
  radioHeader: { flexDirection: 'row', alignItems: 'center' },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  radioLabel: { fontFamily: 'System', fontWeight: '600', fontSize: 13 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryName: { flex: 1, fontFamily: 'System', fontSize: 14, paddingRight: 16 },
  summaryPrice: { fontFamily: 'System', fontWeight: '600', fontSize: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  totalLabel: { fontFamily: 'System', fontWeight: '800', fontSize: 16 },
  totalValue: { fontFamily: 'System', fontWeight: '900', fontSize: 18 },
  footer: { padding: 16, borderTopWidth: 1 },
  submitBtn: { height: 52, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  submitBtnText: { color: '#fff', fontFamily: 'System', fontWeight: '800', fontSize: 16 },
});
