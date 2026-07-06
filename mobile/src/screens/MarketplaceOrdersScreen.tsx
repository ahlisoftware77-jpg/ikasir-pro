import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Package, Clock, CheckCircle2, XCircle } from 'lucide-react-native';
import { db } from '../lib/firebase';
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
            const snap = await getDoc(doc(db, 'settings', `store_${order.storeId}`));
            if (snap.exists() && snap.data().storeName) {
              newNames[order.storeId] = snap.data().storeName;
              changed = true;
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
    
    const ordersRef = collection(db, 'transactions');
    let fetchedMap = new Map();
    
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

    // Ambil berdasarkan userId
    const q1 = query(ordersRef, where('userId', '==', userIdToSearch));
    const unsub1 = onSnapshot(q1, (snap) => {
      snap.forEach(doc => {
        fetchedMap.set(doc.id, { id: doc.id, ...doc.data() });
      });
      // Handle deleted documents
      snap.docChanges().forEach(change => {
        if (change.type === 'removed') {
          fetchedMap.delete(change.doc.id);
        }
      });
      updateOrders();
    });

    let unsub2: any = null;
    // Tambahkan juga berdasar phone jika ada dan berbeda dengan userId
    if (phoneToSearch && phoneToSearch !== userIdToSearch) {
      const q2 = query(ordersRef, where('customerPhone', '==', phoneToSearch));
      unsub2 = onSnapshot(q2, (snap) => {
        snap.forEach(doc => {
          fetchedMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
        snap.docChanges().forEach(change => {
          if (change.type === 'removed') {
            fetchedMap.delete(change.doc.id);
          }
        });
        updateOrders();
      });
    }

    return () => {
      unsub1();
      if (unsub2) unsub2();
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
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={[styles.itemText, { color: colors.textMuted, flex: 1 }]} numberOfLines={1}>
                  {prod.qty}x {prod.name}
                </Text>
                {finalStatus === 'paid' && (
                  <TouchableOpacity
                    style={{ backgroundColor: colors.accent + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 8 }}
                    onPress={() => navigation.navigate('MarketplaceWriteReview', {
                      productId: prod.id,
                      productName: prod.name,
                      storeId: item.storeId,
                      orderId: item.id
                    })}
                  >
                    <Text style={{ color: colors.accent, fontSize: 10, fontWeight: '900' }}>Beri Ulasan</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
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
