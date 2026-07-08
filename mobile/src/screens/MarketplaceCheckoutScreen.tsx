import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, CheckCircle2 } from 'lucide-react-native';
import { db, primaryDb, getTenantDb } from '../lib/firebase';
import { doc, getDoc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';

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

  const handleCheckout = async () => {
    if (!name || !phone) {
      Alert.alert('Error', 'Nama dan Nomor HP wajib diisi!');
      return;
    }
    if (deliveryType === 'delivery' && !address) {
      Alert.alert('Error', 'Alamat pengiriman wajib diisi untuk opsi Delivery!');
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
          paymentStatus: 'unpaid',
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

        // Check and deduct stock
        for (const { ref, snap, item } of productReads) {
          if (snap.exists()) {
            const pData = snap.data();
            if (pData.manageStock !== false) {
              const currentStock = pData.stock || 0;
              if (currentStock < item.qty) {
                throw new Error(`Stok produk ${item.name} tidak mencukupi.`);
              }
              transaction.update(ref, { stock: currentStock - item.qty });
            }
          }
        }

        const newOrderRef = doc(tDb, 'transactions', finalId);
        transaction.set(newOrderRef, orderData);
        transaction.update(settingsRef, { trxCounter: currentCounter });
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
