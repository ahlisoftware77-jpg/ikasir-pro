import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Package, Clock, CheckCircle2, XCircle, MessageCircle } from 'lucide-react-native';
import { db, primaryDb, getTenantDb } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useAuthStore } from '../store/authStore';
import dayjs from 'dayjs';
import 'dayjs/locale/id';

dayjs.locale('id');

export default function MarketplaceOrdersScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeNames, setStoreNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchStoreNames = async () => {
      const newNames = { ...storeNames };
      let changed = false;
      for (const order of orders) {
        if (order.storeId && !newNames[order.storeId]) {
          try {
            const snap = await getDoc(doc(primaryDb, 'stores', order.storeId));
            if (snap.exists() && snap.data().storeName) {
              newNames[order.storeId] = snap.data().storeName;
              changed = true;
            } else {
              // Fallback to settings if needed
              const setSnap = await getDoc(doc(db, 'settings', `store_${order.storeId}`));
              if (setSnap.exists() && setSnap.data().storeName) {
                newNames[order.storeId] = setSnap.data().storeName;
                changed = true;
              }
            }
          } catch (e) {}
        }
      }
      if (changed) setStoreNames(newNames);
    };
    if (orders.length > 0) fetchStoreNames();
  }, [orders]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const userIdToSearch = user.uid || user.phone || user.phoneNumber || '';
    const phoneToSearch = user.phone || user.phoneNumber || '';
    
    let fetchedMap = new Map();
    let unsubs: (() => void)[] = [];
    
    const updateOrders = () => {
      const arr = Array.from(fetchedMap.values());
      // Sort in memory in case index is not present for orderBy
      arr.sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA;
      });
      setOrders(arr);
      setLoading(false);

      // Simpan state terakhir untuk badge notifikasi
      const stateToSave: Record<string, string> = {};
      arr.forEach(o => {
        stateToSave[o.id] = o.paymentStatus === 'paid' || o.paymentStatus === 'completed' ? 'paid' : (o.status || 'pending');
      });
      AsyncStorage.setItem('@marketplace_orders_state', JSON.stringify(stateToSave)).catch(console.error);
    };

    const fetchAllOrders = async () => {
      try {
        const storesQ = query(collection(primaryDb, 'stores'));
        const storesSnap = await getDocs(storesQ);
        const tenantConfigs = new Map<string, any>();
        storesSnap.forEach(doc => {
          const sData = doc.data();
          const cfg = sData.infraConfig || { projectId: 'kasir-3d12b' };
          const pId = cfg.projectId || cfg.fb_project_id;
          if (pId) tenantConfigs.set(pId, cfg);
        });

        Array.from(tenantConfigs.values()).forEach(cfg => {
          try {
            const tDb = getTenantDb(cfg);
            const ordersRef = collection(tDb, 'transactions');
            
            const q1 = query(ordersRef, where('userId', '==', userIdToSearch));
            const unsub1 = onSnapshot(q1, (snap) => {
              snap.forEach(doc => {
                fetchedMap.set(doc.id, { id: doc.id, ...doc.data() });
              });
              snap.docChanges().forEach(change => {
                if (change.type === 'removed') fetchedMap.delete(change.doc.id);
              });
              updateOrders();
            });
            unsubs.push(unsub1);

            if (phoneToSearch && phoneToSearch !== userIdToSearch) {
              const q2 = query(ordersRef, where('customerPhone', '==', phoneToSearch));
              const unsub2 = onSnapshot(q2, (snap) => {
                snap.forEach(doc => {
                  fetchedMap.set(doc.id, { id: doc.id, ...doc.data() });
                });
                snap.docChanges().forEach(change => {
                  if (change.type === 'removed') fetchedMap.delete(change.doc.id);
                });
                updateOrders();
              });
              unsubs.push(unsub2);
            }
          } catch (e) {
            console.warn(`Failed to fetch orders from tenant db ${cfg.projectId}`, e);
          }
        });
        
        // Timeout in case no tenants
        setTimeout(() => setLoading(false), 2000);
      } catch (err) {
        console.error("Error fetching stores config for orders", err);
        setLoading(false);
      }
    };

    fetchAllOrders();

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [user]);

  const getStatusConfig = (status: string) => {
    switch(status) {
      case 'completed':
      case 'paid':
      case 'delivered':
        return { color: '#10b981', icon: CheckCircle2, text: 'Selesai' };
      case 'cancelled':
      case 'canceled':
        return { color: '#ef4444', icon: XCircle, text: 'Dibatalkan' };
      default:
        return { color: '#f59e0b', icon: Clock, text: 'Diproses' };
    }
  };

  const handleChatSeller = async (order: any) => {
    try {
      let storePhone = order.items?.[0]?.storePhone || '';
      
      if (!storePhone && order.storeId) {
        const sRefPrimary = doc(primaryDb, 'stores', order.storeId);
        const sSnapPrimary = await getDoc(sRefPrimary);
        if (sSnapPrimary.exists()) {
          const cfg = sSnapPrimary.data().infraConfig;
          const tDb = cfg ? getTenantDb(cfg) : primaryDb;
          const sRef = doc(tDb, 'settings', `store_${order.storeId}`);
          const sSnap = await getDoc(sRef);
          if (sSnap.exists()) {
             storePhone = sSnap.data().phone || sSnap.data().storePhone || '';
          }
        }
      }
      
      if (!storePhone) {
        Alert.alert('Info', 'Nomor WhatsApp toko tidak tersedia.');
        return;
      }

      let formattedPhone = storePhone.replace(/[^0-9]/g, '');
      if (formattedPhone.startsWith('0')) formattedPhone = '62' + formattedPhone.slice(1);
      
      let message = `Halo, saya memesan dari Marketplace iKasir (Order ID: ${order.id}):\n\n`;
      (order.items || []).forEach((item: any) => {
        message += `- *${item.name || item.productName}* (${item.qty}x) = Rp ${((item.price || 0) * (item.qty || 1)).toLocaleString('id-ID')}\n`;
      });
      message += `\n*Total: Rp ${(order.total || order.totalAmount || 0).toLocaleString('id-ID')}*`;
      
      const url = `whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`;
      
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Error', 'WhatsApp tidak terpasang di perangkat ini.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Gagal memuat kontak penjual.');
    }
  };

  const renderOrderItem = ({ item }: any) => {
    let finalStatus = item.status;
    if (item.paymentStatus === 'paid' || item.paymentStatus === 'completed') {
      finalStatus = 'paid';
    }
    const statusConfig = getStatusConfig(finalStatus);
    const StatusIcon = statusConfig.icon;
    const dateStr = item.timestamp?.seconds 
      ? dayjs(item.timestamp.seconds * 1000).format('DD MMM YYYY, HH:mm') 
      : 'Tanggal tidak diketahui';

    return (
      <View style={[styles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.orderHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.orderHeaderLeft}>
            <Package color={colors.text} size={16} />
            <View>
              <Text style={[styles.orderId, { color: colors.text }]}>{item.id}</Text>
              {(item.storeName || storeNames[item.storeId]) && (
                <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2, fontWeight: 'bold' }}>
                  Toko: {item.storeName || storeNames[item.storeId]}
                </Text>
              )}
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
            <StatusIcon color={statusConfig.color} size={12} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.text}</Text>
          </View>
        </View>
        
        <View style={styles.orderBody}>
          <Text style={[styles.orderDate, { color: colors.textMuted }]}>{dateStr}</Text>
          <Text style={[styles.orderTotal, { color: colors.text }]}>
            Rp {(item.total || 0).toLocaleString('id-ID')}
          </Text>
          
          <View style={styles.itemsList}>
            {item.items?.map((prod: any, idx: number) => (
              <TouchableOpacity 
                key={idx} 
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}
                onPress={() => {
                  const pid = prod.id || prod.productId;
                  if (pid) {
                    navigation.navigate('MarketplaceProductDetail', { productId: pid, storeId: item.storeId });
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: colors.bg, overflow: 'hidden', marginRight: 12, borderWidth: 1, borderColor: colors.border }}>
                  {prod.imageUrl || prod.image ? (
                    <Image source={{ uri: prod.imageUrl || prod.image }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <Package color={colors.textMuted} size={20} style={{ margin: 12 }} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemText, { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
                    {prod.name || prod.productName}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2 }}>
                    {prod.qty} x Rp {(prod.price || 0).toLocaleString('id-ID')}
                  </Text>
                </View>
                {finalStatus === 'paid' && (
                  !prod.isReviewed ? (
                    <TouchableOpacity
                      style={{ backgroundColor: colors.accent + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 8 }}
                      onPress={() => navigation.navigate('MarketplaceWriteReview', {
                        productId: prod.id || prod.productId,
                        productName: prod.name || prod.productName,
                        storeId: item.storeId,
                        orderId: item.id
                      })}
                    >
                      <Text style={{ color: colors.accent, fontSize: 10, fontWeight: '900' }}>Beri Ulasan</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ backgroundColor: colors.border + '50', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 8 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '900' }}>Telah Diulas</Text>
                    </View>
                  )
                )}
              </TouchableOpacity>
            ))}
          </View>
          
          {finalStatus !== 'cancelled' && (
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border }} 
                onPress={() => handleChatSeller(item)}
                activeOpacity={0.7}
              >
                <MessageCircle size={16} color={colors.textMuted} />
                <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 12 }}>Chat Penjual via WhatsApp</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Riwayat Pesanan</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centerContainer}>
          <Package color={colors.border} size={64} opacity={0.5} style={{ marginBottom: 16 }} />
          <Text style={{ color: colors.textMuted }}>Belum ada pesanan.</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { padding: 4, marginLeft: -4 },
  headerTitle: { fontFamily: 'System', fontWeight: '800', fontSize: 16 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  orderCard: { borderWidth: 1, borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1 },
  orderHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderId: { fontFamily: 'System', fontWeight: '700', fontSize: 14 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontFamily: 'System', fontWeight: '700', fontSize: 11 },
  orderBody: { padding: 12 },
  orderDate: { fontFamily: 'System', fontSize: 12, marginBottom: 8 },
  orderTotal: { fontFamily: 'System', fontWeight: '800', fontSize: 16, marginBottom: 12 },
  itemsList: { gap: 4 },
  itemText: { fontFamily: 'System', fontSize: 13 },
});
