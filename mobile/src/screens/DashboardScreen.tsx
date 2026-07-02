import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Share, Clipboard, RefreshControl, Vibration, Pressable, Modal, TextInput, Image, Linking, Switch } from 'react-native';
import { collection, query, onSnapshot, orderBy, where, getDocs, writeBatch, limit, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../context/ThemeContext';
import { DollarSign, ShoppingBag, Package, Users, Copy, Share2, TrendingUp, ChevronRight, Bell, X, AlertCircle, ChevronLeft, Sparkles, CheckCircle2, CreditCard, Globe, Printer, ArrowUpCircle, ArrowDownCircle, Plus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { useNotificationStore } from '../store/notificationStore';

export default function DashboardScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { user, storeId, isSubscriptionExpired, subscriptionUntil, role } = useAuthStore();

  const sisaHari = useMemo(() => {
    if (!subscriptionUntil) return null;
    const expiryDate = new Date(subscriptionUntil);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [subscriptionUntil]);

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleResetRevenueMobile = async () => {
    if (resetConfirmText !== 'Kosongkan Saldo') {
      Alert.alert('Eror', 'Teks konfirmasi salah!');
      return;
    }
    if (!storeId) return;

    setIsResetting(true);
    try {
      const q = query(collection(db, 'transactions'), where('storeId', '==', storeId));
      const snap = await getDocs(q);
      let batch = writeBatch(db);
      let count = 0;
      let totalDeleted = 0;
      
      for (const docSnap of snap.docs) {
        batch.delete(docSnap.ref);
        count++;
        totalDeleted++;
        if (count === 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }

      Alert.alert('Sukses', `Berhasil menghapus ${totalDeleted} transaksi. Pendapatan kotor berhasil di-reset!`);
      setIsResetModalOpen(false);
      setResetConfirmText('');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal mereset pendapatan kotor: ' + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    if (isSubscriptionExpired) {
      const formattedDate = subscriptionUntil 
        ? new Date(subscriptionUntil).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : '-';
      Alert.alert(
        '🚨 Masa Aktif Akun Habis',
        `Masa aktif langganan akun Anda telah berakhir pada ${formattedDate}. Silakan lakukan perpanjangan agar tetap dapat mengakses semua fitur iKasir Pro secara lengkap.`,
        [
          { text: 'Ok', style: 'cancel' },
          { 
            text: 'Langganan', 
            onPress: () => {
              Vibration.vibrate(10);
              navigation.navigate('Lainnya', { openSubscription: true });
            } 
          }
        ],
        { cancelable: true }
      );
    }
  }, [isSubscriptionExpired, subscriptionUntil, navigation]);
  const unreadCount = useNotificationStore(state => state.getUnreadCount());
  const [transactions, setTransactions] = useState<any[]>([]);
  const [customersCount, setCustomersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // State for Announcements
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [isLoadingBroadcasts, setIsLoadingBroadcasts] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null);

  const [brandingData, setBrandingData] = useState<any>({
    pkg_1m_price: 30000,
    pkg_1m_discount_type: 'none',
    pkg_1m_discount_val: 0,
    pkg_3m_price: 84000,
    pkg_3m_discount_type: 'none',
    pkg_3m_discount_val: 0,
    pkg_6m_price: 159000,
    pkg_6m_discount_type: 'none',
    pkg_6m_discount_val: 0,
    pkg_12m_price: 306000,
    pkg_12m_discount_type: 'none',
    pkg_12m_discount_val: 0,
  });

  const SUBSCRIPTION_PACKAGES = useMemo(() => {
    const pkgs = [
      { id: '1m', title: '1 Bulan', defaultPrice: 30000, months: 1 },
      { id: '3m', title: '3 Bulan', defaultPrice: 84000, months: 3 },
      { id: '6m', title: '6 Bulan', defaultPrice: 159000, months: 6 },
      { id: '12m', title: '12 Bulan', defaultPrice: 306000, months: 12 },
    ];

    return pkgs.map(p => {
      const priceKey = `pkg_${p.id}_price`;
      const typeKey = `pkg_${p.id}_discount_type`;
      const valKey = `pkg_${p.id}_discount_val`;

      const basePrice = Number((brandingData as any)[priceKey] ?? p.defaultPrice);
      const discountType = (brandingData as any)[typeKey] || 'none';
      const discountVal = Number((brandingData as any)[valKey] ?? 0);

      let finalPrice = basePrice;
      let discountLabel = '';

      if (discountType === 'percent') {
        finalPrice = Math.max(0, basePrice * (1 - discountVal / 100));
        discountLabel = `${discountVal}% OFF`;
      } else if (discountType === 'nominal') {
        finalPrice = Math.max(0, basePrice - discountVal);
        discountLabel = `HEMAT Rp ${discountVal.toLocaleString('id-ID')}`;
      }

      const pricePerMonth = Math.round(finalPrice / p.months);

      const defaultDiscountLabels: Record<string, string> = {
        '3m': 'HEMAT 7%',
        '6m': 'HEMAT 12%',
        '12m': 'HEMAT 15%'
      };
      const finalDiscountLabel = discountLabel || defaultDiscountLabels[p.id] || '';

      return {
        id: p.id,
        title: p.title,
        price: finalPrice,
        pricePerMonth,
        discountLabel: finalDiscountLabel
      };
    });
  }, [brandingData]);

  useEffect(() => {
    const unsubBranding = onSnapshot(doc(db, 'system_settings', 'branding'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBrandingData({
          pkg_1m_price: Number(data.pkg_1m_price ?? 30000),
          pkg_1m_discount_type: data.pkg_1m_discount_type || 'none',
          pkg_1m_discount_val: Number(data.pkg_1m_discount_val ?? 0),
          pkg_3m_price: Number(data.pkg_3m_price ?? 84000),
          pkg_3m_discount_type: data.pkg_3m_discount_type || 'none',
          pkg_3m_discount_val: Number(data.pkg_3m_discount_val ?? 0),
          pkg_6m_price: Number(data.pkg_6m_price ?? 159000),
          pkg_6m_discount_type: data.pkg_6m_discount_type || 'none',
          pkg_6m_discount_val: Number(data.pkg_6m_discount_val ?? 0),
          pkg_12m_price: Number(data.pkg_12m_price ?? 306000),
          pkg_12m_discount_type: data.pkg_12m_discount_type || 'none',
          pkg_12m_discount_val: Number(data.pkg_12m_discount_val ?? 0),
        });
      }
    }, (error) => {
      console.error("Error loading branding in mobile dashboard:", error);
    });
    return () => unsubBranding();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setRefreshing(false);
  };

  const [joinMarketplace, setJoinMarketplace] = useState(false);
  const [isOnlineStoreActive, setIsOnlineStoreActive] = useState(false);
  const [isUpdatingMarketplace, setIsUpdatingMarketplace] = useState(false);
  const [isUpdatingOnlineStore, setIsUpdatingOnlineStore] = useState(false);

  const handleToggleMarketplaceMobile = async (newVal: boolean) => {
    if (!storeId || isUpdatingMarketplace) return;
    setIsUpdatingMarketplace(true);
    
    const { doc, getDoc, updateDoc, writeBatch } = await import('firebase/firestore');

    try {
      const settingsRef = doc(db, 'settings', `store_${storeId}`);
      const settingsSnap = await getDoc(settingsRef);
      const storeName = settingsSnap.exists() ? (settingsSnap.data().storeName || '') : '';

      // 1. Update settings
      await updateDoc(settingsRef, {
        joinMarketplace: newVal
      });

      // 2. Update products
      const prodQuery = query(collection(db, 'products'), where('storeId', '==', storeId));
      const prodSnap = await getDocs(prodQuery);
      
      let batch = writeBatch(db);
      let count = 0;
      
      prodSnap.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          joinMarketplace: newVal,
          storeName: storeName
        });
        count++;
        if (count === 400) {
          batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      });
      
      if (count > 0) {
        await batch.commit();
      }

      Alert.alert('Sukses', newVal ? 'Marketplace Bersama berhasil DIAKTIFKAN!' : 'Marketplace Bersama berhasil DINONAKTIFKAN!');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal mengubah status marketplace: ' + err.message);
    } finally {
      setIsUpdatingMarketplace(false);
    }
  };

  const handleToggleOnlineStoreMobile = async (newVal: boolean) => {
    if (!storeId || isUpdatingOnlineStore) return;
    setIsUpdatingOnlineStore(true);

    const { doc, updateDoc } = await import('firebase/firestore');

    try {
      const settingsRef = doc(db, 'settings', `store_${storeId}`);
      await updateDoc(settingsRef, {
        isOnlineStoreActive: newVal
      });
      Alert.alert('Sukses', newVal ? 'Outlet Toko Online berhasil DIAKTIFKAN!' : 'Outlet Toko Online berhasil DINONAKTIFKAN!');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal mengubah status outlet online: ' + err.message);
    } finally {
      setIsUpdatingOnlineStore(false);
    }
  };

  useEffect(() => {
    if (!storeId) return;

    setLoading(true);

    const unsubSettings = onSnapshot(doc(db, 'settings', `store_${storeId}`), (docSnap) => {
      if (docSnap.exists()) {
        setJoinMarketplace(docSnap.data().joinMarketplace === true);
        setIsOnlineStoreActive(docSnap.data().isOnlineStoreActive !== false);
      }
    });

    const qTrx = query(
      collection(db, 'transactions'),
      where('storeId', '==', storeId),
      orderBy('timestamp', 'desc')
    );

    const unsubTrx = onSnapshot(qTrx, (snap) => {
      const items: any[] = [];
      snap.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setTransactions(items);
      setLoading(false);
    }, (error) => {
      console.error("Error loading transactions:", error);
      setLoading(false);
    });

    const qCust = query(
      collection(db, 'customers'),
      where('storeId', '==', storeId)
    );

    const unsubCust = onSnapshot(qCust, (snap) => {
      setCustomersCount(snap.size);
    }, (error) => {
      console.error("Error loading customers:", error);
    });

    return () => {
      unsubSettings();
      unsubTrx();
      unsubCust();
    };
  }, [storeId]);

  // Load announcements (broadcasts)
  useEffect(() => {
    const q = query(
      collection(db, 'broadcasts'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setBroadcasts(list);
      setIsLoadingBroadcasts(false);
    }, (error) => {
      console.error("Error loading broadcasts on mobile:", error);
      setIsLoadingBroadcasts(false);
    });
    return () => unsub();
  }, []);

  const activeBroadcasts = useMemo(() => {
    if (broadcasts.length > 0) return broadcasts;
    return [
      {
        id: 'default-welcome',
        title: 'Selamat Datang di iKasir Pro!',
        message: 'Kelola transaksi, produk, stok, laporan keuangan, dan lainnya secara real-time dengan mudah di satu tempat.',
        createdAt: new Date().toISOString(),
        data: { link: 'https://yadiapp.com' }
      }
    ];
  }, [broadcasts]);

  // Auto-slide announcements
  useEffect(() => {
    if (activeBroadcasts.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % activeBroadcasts.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [activeBroadcasts.length]);

  const { totalRevenue, totalProductsSold, topProducts } = useMemo(() => {
    let revenue = 0;
    let productsSold = 0;
    const productMap: Record<string, { name: string; qty: number; category?: string }> = {};

    transactions.forEach((trx) => {
      if (trx.orderStatus === 'cancelled' || trx.paymentStatus === 'cancelled') return;

      revenue += (trx.total || 0);
      trx.items?.forEach((item: any) => {
        productsSold += (item.qty || 0);
        const prodId = item.productId || item.name;
        if (!productMap[prodId]) {
          productMap[prodId] = { 
            name: item.productName || item.name, 
            qty: 0,
            category: item.category || 'Umum'
          };
        }
        productMap[prodId].qty += (item.qty || 0);
      });
    });

    const top = Object.values(productMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return { totalRevenue: revenue, totalProductsSold: productsSold, topProducts: top };
  }, [transactions]);

  const onlineStoreUrl = `https://ikasir.my.id/tr?s=${storeId}`;

  const handleCopyLink = () => {
    Clipboard.setString(onlineStoreUrl);
    Alert.alert('Sukses', 'Link pemesanan online berhasil disalin!');
  };

  const handleShareLink = async () => {
    try {
      await Share.share({
        message: `Silakan pesan produk kami secara online langsung lewat tautan berikut: ${onlineStoreUrl}`,
        title: 'Toko Online Kami',
      });
    } catch (error: any) {
      console.error("Sharing failed:", error.message);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1" edges={['bottom']} style={{ backgroundColor: colors.bg }}>
        <View className="px-6 py-6">
          <LoadingSkeleton type="stats" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" edges={['bottom']} style={{ backgroundColor: colors.bg }}>
      <ScrollView 
        className="flex-1" 
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.accent]}
            tintColor={colors.accent}
          />
        }
      >
        <View className="px-6 py-6 pb-24">
        
        {/* Glow Effects */}
        <View 
          className="absolute -top-12 -left-12 w-80 h-80 rounded-full opacity-10"
          style={{ backgroundColor: colors.accent }}
        />
        <View 
          className="absolute top-96 -right-12 w-64 h-64 rounded-full opacity-5"
          style={{ backgroundColor: '#10b981' }}
        />

        {/* Header Title */}
        <View className="mb-6 z-10 flex-row justify-between items-center">
          <View className="flex-1 mr-4">
            <Text className="text-2xl font-black tracking-tight" style={{ color: colors.text }}>
              DASBOR <Text style={{ color: colors.accent }}>UTAMA</Text>
            </Text>
            <Text className="text-[10px] font-bold uppercase mt-1 tracking-wider" style={{ color: colors.textMuted }}>
              Merchant: <Text style={{ color: colors.accent }}>{user?.name || user?.email?.split('@')[0]}</Text>
            </Text>
          </View>
          
          <View className="flex-row items-center gap-3">
            {/* Bell Icon Button */}
            <TouchableOpacity
              onPress={() => {
                Vibration.vibrate(10);
                navigation.navigate('Notifications');
              }}
              activeOpacity={0.8}
              className="relative w-10 h-10 rounded-xl items-center justify-center border"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
            >
              <Bell size={18} color={colors.text} />
              {unreadCount > 0 && (
                <View className="absolute -top-1.5 -right-1.5 bg-rose-500 min-w-[18px] h-[18px] rounded-full items-center justify-center px-1">
                  <Text className="text-white text-[8px] font-black text-center leading-none">
                    {unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <View className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full flex-row items-center gap-1.5">
              <View className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Text className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Live</Text>
            </View>
          </View>
        </View>
        
        {/* Marketplace Bersama Store Link Panel */}
        {storeId && (
          <View 
            className="mb-6 p-5 rounded-[2rem] border relative overflow-hidden"
            style={{ 
              backgroundColor: colors.surface, 
              borderColor: colors.border 
            }}
          >
            <View className="flex-row items-start gap-3">
              <View 
                className="w-11 h-11 rounded-2xl items-center justify-center border"
                style={{
                  backgroundColor: joinMarketplace ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                  borderColor: joinMarketplace ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)'
                }}
              >
                <Globe size={20} color={joinMarketplace ? '#10b981' : '#94a3b8'} />
              </View>
              <View className="flex-1 min-w-0">
                <View 
                  className="px-2 py-0.5 rounded-md self-start mb-1"
                  style={{ backgroundColor: joinMarketplace ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.1)' }}
                >
                  <Text className="text-[7px] font-black uppercase tracking-wider" style={{ color: joinMarketplace ? '#10b981' : '#94a3b8' }}>
                    {joinMarketplace ? 'Marketplace Aktif' : 'Marketplace Nonaktif'}
                  </Text>
                </View>
                <Text className="text-xs font-black" style={{ color: colors.text }}>
                  Marketplace Bersama iKasir
                </Text>
                <Text className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5 leading-snug">
                  {joinMarketplace ? 'Toko Anda aktif dan tampil di halaman utama pencarian marketplace.' : 'Aktifkan untuk menampilkan produk Anda di marketplace bersama.'}
                </Text>
                {joinMarketplace && (
                  <Text className="text-[9px] font-bold text-emerald-600 dark:text-emerald-450 truncate mt-1.5 bg-emerald-500/5 dark:bg-emerald-950/20 px-2 py-1 rounded-lg self-start border border-emerald-500/10">
                    {`https://ikasir.my.id/marketplace?storeId=${storeId}`}
                  </Text>
                )}
              </View>

              <View className="items-center justify-center shrink-0">
                <Switch
                  value={joinMarketplace}
                  disabled={isUpdatingMarketplace}
                  onValueChange={(val) => {
                    Vibration.vibrate(10);
                    handleToggleMarketplaceMobile(val);
                  }}
                  trackColor={{ false: '#cbd5e1', true: '#10b981' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>

            {joinMarketplace && (
              <View className="flex-row gap-2.5 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <TouchableOpacity
                  onPress={() => {
                    Vibration.vibrate(10);
                    Clipboard.setString(`https://ikasir.my.id/marketplace?storeId=${storeId}`);
                    Alert.alert('Sukses', 'Link Marketplace toko Anda berhasil disalin!');
                  }}
                  className="flex-1 py-2.5 bg-white rounded-xl items-center justify-center flex-row gap-1.5 border border-slate-200 shadow-sm"
                >
                  <Copy size={12} color="#1e293b" />
                  <Text className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                    Salin Link
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => {
                    Vibration.vibrate(10);
                    Linking.openURL(`https://ikasir.my.id/marketplace?storeId=${storeId}`);
                  }}
                  className="flex-1 py-2.5 bg-emerald-500 rounded-xl items-center justify-center flex-row gap-1.5 shadow-lg shadow-emerald-500/10"
                >
                  <Globe size={12} color="#ffffff" />
                  <Text className="text-[10px] font-black uppercase tracking-wider text-white">
                    Buka Toko
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Outlet Toko Online Mandiri Panel */}
        {storeId && (
          <View 
            className="mb-6 p-5 rounded-[2rem] border relative overflow-hidden"
            style={{ 
              backgroundColor: colors.surface, 
              borderColor: colors.border 
            }}
          >
            <View className="flex-row items-start gap-3">
              <View 
                className="w-11 h-11 rounded-2xl items-center justify-center border"
                style={{
                  backgroundColor: isOnlineStoreActive ? 'rgba(59, 130, 246, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                  borderColor: isOnlineStoreActive ? 'rgba(59, 130, 246, 0.2)' : 'rgba(148, 163, 184, 0.2)'
                }}
              >
                <ShoppingBag size={20} color={isOnlineStoreActive ? '#3b82f6' : '#94a3b8'} />
              </View>
              <View className="flex-1 min-w-0">
                <View 
                  className="px-2 py-0.5 rounded-md self-start mb-1"
                  style={{ backgroundColor: isOnlineStoreActive ? 'rgba(59, 130, 246, 0.1)' : 'rgba(148, 163, 184, 0.1)' }}
                >
                  <Text className="text-[7px] font-black uppercase tracking-wider" style={{ color: isOnlineStoreActive ? '#3b82f6' : '#94a3b8' }}>
                    {isOnlineStoreActive ? 'Toko Online Buka' : 'Toko Online Tutup'}
                  </Text>
                </View>
                <Text className="text-xs font-black" style={{ color: colors.text }}>
                  Outlet Online Mandiri
                </Text>
                <Text className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5 leading-snug">
                  {isOnlineStoreActive ? 'Toko online Anda aktif menerima pesanan langsung dari pelanggan publik.' : 'Nonaktifkan untuk sementara menutup pemesanan dari luar.'}
                </Text>
                {isOnlineStoreActive && (
                  <Text className="text-[9px] font-bold text-blue-600 dark:text-blue-450 truncate mt-1.5 bg-blue-500/5 dark:bg-blue-950/20 px-2 py-1 rounded-lg self-start border border-blue-500/10">
                    {`https://ikasir.my.id/tr?storeId=${storeId}`}
                  </Text>
                )}
              </View>

              <View className="items-center justify-center shrink-0">
                <Switch
                  value={isOnlineStoreActive}
                  disabled={isUpdatingOnlineStore}
                  onValueChange={(val) => {
                    Vibration.vibrate(10);
                    handleToggleOnlineStoreMobile(val);
                  }}
                  trackColor={{ false: '#cbd5e1', true: '#3b82f6' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>

            {isOnlineStoreActive && (
              <View className="flex-row gap-2.5 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <TouchableOpacity
                  onPress={() => {
                    Vibration.vibrate(10);
                    Clipboard.setString(`https://ikasir.my.id/tr?storeId=${storeId}`);
                    Alert.alert('Sukses', 'Link Toko Online berhasil disalin!');
                  }}
                  className="flex-1 py-2.5 bg-white rounded-xl items-center justify-center flex-row gap-1.5 border border-slate-200 shadow-sm"
                >
                  <Copy size={12} color="#1e293b" />
                  <Text className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                    Salin Link
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => {
                    Vibration.vibrate(10);
                    Linking.openURL(`https://ikasir.my.id/tr?storeId=${storeId}`);
                  }}
                  className="flex-1 py-2.5 bg-blue-500 rounded-xl items-center justify-center flex-row gap-1.5 shadow-lg shadow-blue-500/10"
                >
                  <ShoppingBag size={12} color="#ffffff" />
                  <Text className="text-[10px] font-black uppercase tracking-wider text-white">
                    Buka Toko
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* PROMO SPESIAL LANGGANAN (AKAN MUNCUL JIKA MASA AKTIF < 2 MINGGU) */}
        {sisaHari !== null && sisaHari <= 14 && (role as string) !== 'super-admin' && (role as string) !== 'superadmin' && (role as string) !== 'customer' && (
          <TouchableOpacity
            onPress={() => {
              Vibration.vibrate(10);
              navigation.navigate('Lainnya', { openSubscription: true });
            }}
            activeOpacity={0.9}
            className="mb-6 p-5 rounded-[2rem] border relative overflow-hidden"
            style={{ 
              borderColor: '#8b5cf6',
              backgroundColor: '#2e1065', // Premium dark purple/violet
            }}
          >
            {/* Subtle glow effect */}
            <View className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full filter blur-xl pointer-events-none" style={{ position: 'absolute' }} />
            
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <View className="bg-amber-400 px-2.5 py-0.5 rounded-full self-start mb-2">
                  <Text className="text-[8px] font-black uppercase tracking-wider text-slate-900">🔥 PROMO SPESIAL</Text>
                </View>
                <Text className="text-sm font-black text-white leading-tight">
                  Perpanjang Langganan Lebih Awal!
                </Text>
                <Text className="text-[10px] font-bold text-purple-200 mt-1 leading-relaxed">
                  Masa aktif toko tersisa <Text className="text-amber-400 font-extrabold">{sisaHari} hari</Text>. Dapatkan potongan harga eksklusif hari ini.
                </Text>
              </View>
              <View className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 items-center justify-center">
                <Text className="text-xl">🎁</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* WARNING BANNER FOR EXPIRING SUBSCRIPTION */}
        {sisaHari !== null && sisaHari <= 7 && !isSubscriptionExpired && (role as string) !== 'super-admin' && (role as string) !== 'superadmin' && (role as string) !== 'customer' && (
          <TouchableOpacity
            onPress={() => {
              Vibration.vibrate(10);
              navigation.navigate('Lainnya', { openSubscription: true });
            }}
            activeOpacity={0.9}
            className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex-row items-center gap-3"
          >
            <View className="w-8 h-8 rounded-xl bg-amber-500/20 items-center justify-center">
              <AlertCircle color="#f59e0b" size={18} />
            </View>
            <View className="flex-1">
              <Text className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Masa Aktif Akun Hampir Habis</Text>
              <Text className="text-xs font-bold mt-0.5" style={{ color: colors.text }}>
                Tinggal <Text className="text-amber-500">{sisaHari} hari</Text> lagi. Ketuk untuk perpanjang.
              </Text>
            </View>
            <ChevronRight color={colors.textMuted} size={16} />
          </TouchableOpacity>
        )}

        {/* SECTION: ANNOUNCEMENTS CAROUSEL */}
        {!isLoadingBroadcasts && activeBroadcasts.length > 0 && (
          <View 
            className="p-6 rounded-[28px] border mb-6 relative overflow-hidden"
            style={{ backgroundColor: '#1e1b4b', borderColor: '#3730a3' }}
          >
            {/* Subtle glow effect */}
            <View className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full filter blur-xl pointer-events-none" style={{ position: 'absolute' }} />

            <View className="flex-row items-center justify-between mb-4 z-10">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 items-center justify-center">
                  <Text className="text-base">📢</Text>
                </View>
                <Text className="text-[10px] font-black uppercase tracking-wider text-white">
                  Pengumuman & Info Terbaru
                </Text>
              </View>
              {activeBroadcasts.length > 1 && (
                <View className="flex-row gap-1.5">
                  <TouchableOpacity
                    onPress={() => {
                      Vibration.vibrate(5);
                      setCurrentSlide((prev) => (prev === 0 ? activeBroadcasts.length - 1 : prev - 1));
                    }}
                    className="w-7 h-7 rounded-lg items-center justify-center bg-white/10 border border-white/10"
                  >
                    <ChevronLeft size={14} color="#ffffff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      Vibration.vibrate(5);
                      setCurrentSlide((prev) => (prev + 1) % activeBroadcasts.length);
                    }}
                    className="w-7 h-7 rounded-lg items-center justify-center bg-white/10 border border-white/10"
                  >
                    <ChevronRight size={14} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => {
                Vibration.vibrate(10);
                setSelectedAnnouncement(activeBroadcasts[currentSlide]);
              }}
              className="flex-col gap-4 z-10"
            >
              <View className="space-y-2 flex-1">
                <View className="px-2.5 py-0.5 rounded-lg border w-fit bg-white/10 border-white/10">
                  <Text className="text-[8px] font-black uppercase tracking-wider text-emerald-300">
                    {new Date(activeBroadcasts[currentSlide].createdAt || Date.now()).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </Text>
                </View>
                <Text className="text-sm font-black tracking-tight text-white mt-1">
                  {activeBroadcasts[currentSlide].title}
                </Text>
                <Text className="text-[10px] font-bold mt-1 leading-relaxed text-slate-300">
                  {activeBroadcasts[currentSlide].message}
                  {activeBroadcasts[currentSlide].data?.link && (
                    <Text 
                      style={{ textDecorationLine: 'underline' }} 
                      className="text-emerald-400 font-black"
                    >
                      {' '}disini
                    </Text>
                  )}
                </Text>
              </View>

              {activeBroadcasts[currentSlide].data?.imageUrl && (
                <View 
                  className="w-full aspect-[2/1] rounded-2xl overflow-hidden border bg-black/10 border-white/10"
                >
                  <Image
                    source={{ uri: activeBroadcasts[currentSlide].data.imageUrl }}
                    className="w-full h-full"
                    style={{ resizeMode: 'cover' }}
                  />
                </View>
              )}
            </TouchableOpacity>

            {/* Dots Indicator */}
            {activeBroadcasts.length > 1 && (
              <View className="flex-row justify-center gap-1.5 mt-4 z-10">
                {activeBroadcasts.map((_, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      Vibration.vibrate(5);
                      setCurrentSlide(idx);
                    }}
                    className="h-1.5 rounded-full"
                    style={{
                      width: currentSlide === idx ? 16 : 6,
                      backgroundColor: currentSlide === idx ? '#34d399' : '#475569'
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* SECTION: PRICING CARD - PREMIUM DESIGN */}
        <View 
          className="p-6 rounded-[32px] border mb-6 relative overflow-hidden"
          style={{ backgroundColor: '#0f172a', borderColor: '#10b981' }}
        >
          {/* Subtle inside glow */}
          <View className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full filter blur-xl pointer-events-none" style={{ position: 'absolute' }} />

          <View className="flex-row items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1 rounded-full w-fit mb-4">
            <Sparkles size={12} color="#fef08a" />
            <Text className="text-[8px] font-black uppercase tracking-wider text-yellow-300">
              Promo Spesial Langganan
            </Text>
          </View>

          <Text className="text-lg font-black text-white leading-tight">
            Mulai Berlangganan iKasir Pro
          </Text>
          <Text className="text-white/70 text-[10px] font-medium mt-1 leading-relaxed">
            Buka fitur premium untuk mengoptimalkan operasional bisnis Anda.
          </Text>

          {/* Premium Feature Items with Icons */}
          <View className="my-4 gap-3">
            <View className="flex-row items-center gap-2.5">
              <View className="w-7 h-7 rounded-lg bg-emerald-500/20 items-center justify-center border border-emerald-500/30">
                <TrendingUp size={12} color="#10b981" />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-black uppercase tracking-wide text-white">Analisis Bisnis Lengkap</Text>
                <Text className="text-[8px] text-white/50">Laporan Omzet, Terlaris, & Arus Kas Realtime</Text>
              </View>
            </View>
            <View className="flex-row items-center gap-2.5">
              <View className="w-7 h-7 rounded-lg bg-emerald-500/20 items-center justify-center border border-emerald-500/30">
                <Globe size={12} color="#10b981" />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-black uppercase tracking-wide text-white">Toko Online Mandiri</Text>
                <Text className="text-[8px] text-white/50">Link pemesanan mandiri & menu online pelanggan</Text>
              </View>
            </View>
            <View className="flex-row items-center gap-2.5">
              <View className="w-7 h-7 rounded-lg bg-emerald-500/20 items-center justify-center border border-emerald-500/30">
                <Printer size={12} color="#10b981" />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-black uppercase tracking-wide text-white">Cetak Struk Kustom & Multi-user</Text>
                <Text className="text-[8px] text-white/50">Dukungan printer Bluetooth, PDF A4 & TTD digital</Text>
              </View>
            </View>
          </View>

          {/* Pricing Grid */}
          <View className="flex-row flex-wrap gap-2.5 my-3 justify-between">
            {SUBSCRIPTION_PACKAGES.map((pkg) => {
              const is12m = pkg.id === '12m';
              const hasDiscount = pkg.id !== '1m';
              return (
                <View 
                  key={pkg.id}
                  className={`border rounded-xl p-3 w-[48%] relative overflow-hidden ${
                    is12m ? 'bg-emerald-500/20 border-emerald-400/30' : 'bg-white/5 border-white/10'
                  }`}
                >
                  {pkg.discountLabel ? (
                    <View className="absolute right-0 top-0 bg-yellow-400 px-1 py-0.5 rounded-bl">
                      <Text className="text-[5px] font-black uppercase tracking-wider text-teal-950">
                        {pkg.discountLabel}
                      </Text>
                    </View>
                  ) : is12m ? (
                    <View className="absolute right-0 top-0 bg-yellow-400 px-1 py-0.5 rounded-bl">
                      <Text className="text-[5px] font-black uppercase tracking-wider text-teal-950">
                        Best
                      </Text>
                    </View>
                  ) : null}
                  <Text className={`text-[8px] font-black uppercase tracking-wider ${is12m ? 'text-emerald-200' : 'text-white/60'}`}>
                    {pkg.title}
                  </Text>
                  <Text className={`text-sm font-black mt-0.5 ${is12m ? 'text-emerald-200' : 'text-white'}`}>
                    Rp {pkg.price.toLocaleString('id-ID')}
                  </Text>
                  <Text className={`text-[7px] font-bold ${is12m ? 'text-white/80' : hasDiscount ? 'text-emerald-200' : 'text-white/50'}`}>
                    Rp {pkg.pricePerMonth.toLocaleString('id-ID')} / bln
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Action Button */}
          <TouchableOpacity
            onPress={() => {
              Vibration.vibrate(10);
              navigation.navigate('Lainnya', { openSubscription: true });
            }}
            activeOpacity={0.9}
            className="w-full py-3.5 bg-emerald-500 rounded-2xl items-center justify-center flex-row gap-2 border border-emerald-400/25"
          >
            <CreditCard size={14} color="#ffffff" strokeWidth={2.5} />
            <Text className="text-white text-xs font-black uppercase tracking-wider">
              Pilih Paket Premium
            </Text>
          </TouchableOpacity>
        </View>

        {/* HERO CARD - OMZET TOKO */}
        <View 
          className="p-6 rounded-[32px] border mb-6 relative overflow-hidden shadow-2xl shadow-emerald-500/5"
          style={{ backgroundColor: colors.surface, borderColor: '#10b98125' }}
        >
          {/* Subtle inside glow */}
          <View className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full filter blur-xl" />
          
          <View className="flex-row justify-between items-start mb-4">
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-[10px] font-black uppercase tracking-[2px]" style={{ color: colors.textMuted }}>
                  TOTAL PENDAPATAN KOTOR
                </Text>
                {(role as string) !== 'customer' && (role as string) !== 'cashier' && (
                  <TouchableOpacity
                    onPress={() => {
                      Vibration.vibrate(15);
                      setIsResetModalOpen(true);
                    }}
                    className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20"
                  >
                    <Text className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Reset</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text className="text-3xl font-black mt-2 tracking-tight text-emerald-400">
                Rp {totalRevenue.toLocaleString('id-ID')}
              </Text>
            </View>
            <View className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 items-center justify-center">
              <Text className="text-xl">💰</Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between border-t border-slate-800/60 pt-4 mt-2">
            <View className="flex-row items-center gap-1.5">
              <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <Text className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Metrik Finansial Terkini</Text>
            </View>
            <Text className="text-[9px] font-black text-emerald-500 uppercase tracking-wider">Omzet Stabil</Text>
          </View>
        </View>

        {/* 3-COLUMN METRICS GRID */}
        <View className="flex-row gap-3 mb-6">
          
          {/* Total Transaksi */}
          <View 
            className="flex-1 p-4 rounded-2xl border items-center justify-center text-center shadow-md"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <View className="w-8 h-8 rounded-lg bg-blue-500/10 items-center justify-center mb-2">
              <Text className="text-base">🛒</Text>
            </View>
            <Text className="text-[8px] font-black uppercase tracking-wider" style={{ color: colors.textMuted }}>TRANSAKSI</Text>
            <Text className="text-sm font-black mt-1" style={{ color: colors.text }}>{transactions.length}</Text>
          </View>

          {/* Produk Terjual */}
          <View 
            className="flex-1 p-4 rounded-2xl border items-center justify-center text-center shadow-md"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <View className="w-8 h-8 rounded-lg bg-purple-500/10 items-center justify-center mb-2">
              <Text className="text-base">📦</Text>
            </View>
            <Text className="text-[8px] font-black uppercase tracking-wider" style={{ color: colors.textMuted }}>TERJUAL</Text>
            <Text className="text-sm font-black mt-1" style={{ color: colors.text }}>{totalProductsSold}</Text>
          </View>

          {/* Total Pelanggan */}
          <View 
            className="flex-1 p-4 rounded-2xl border items-center justify-center text-center shadow-md"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <View className="w-8 h-8 rounded-lg bg-rose-500/10 items-center justify-center mb-2">
              <Text className="text-base">👥</Text>
            </View>
            <Text className="text-[8px] font-black uppercase tracking-wider" style={{ color: colors.textMuted }}>PELANGGAN</Text>
            <Text className="text-sm font-black mt-1" style={{ color: colors.text }}>{customersCount}</Text>
          </View>

        </View>

        {/* PINTASAN ARUS KAS (QUICK CASHFLOW SHORTCUTS) */}
        <View 
          className="p-6 rounded-[28px] border mb-6 shadow-xl"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <View className="flex-row items-center gap-4 mb-4">
            <View className="w-12 h-12 rounded-2xl items-center justify-center bg-emerald-500/10 border border-emerald-500/20">
              <Text className="text-xl">💸</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-black" style={{ color: colors.text }}>Pintasan Arus Kas</Text>
              <Text className="text-[9px] font-bold mt-0.5" style={{ color: colors.textMuted }}>Catat pemasukan atau pengeluaran manual secara instan</Text>
            </View>
          </View>

          <View className="flex-row gap-3">
            <TouchableOpacity 
              onPress={() => {
                Vibration.vibrate(10);
                navigation.navigate('FeatureDetails', { 
                  featureId: 'arus_kas', 
                  title: 'Arus Kas (Cashflow)',
                  autoOpenAddModal: true,
                  defaultType: 'in'
                });
              }}
              activeOpacity={0.85}
              className="flex-1 flex-row items-center justify-center gap-2 h-12 rounded-2xl border border-emerald-500/20 bg-emerald-500/5"
            >
              <ArrowUpCircle size={16} color="#10b981" strokeWidth={2.5} />
              <Text className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Catat Uang Masuk</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => {
                Vibration.vibrate(10);
                navigation.navigate('FeatureDetails', { 
                  featureId: 'arus_kas', 
                  title: 'Arus Kas (Cashflow)',
                  autoOpenAddModal: true,
                  defaultType: 'out'
                });
              }}
              activeOpacity={0.85}
              className="flex-1 flex-row items-center justify-center gap-2 h-12 rounded-2xl border border-rose-500/20 bg-rose-500/5"
            >
              <ArrowDownCircle size={16} color="#f43f5e" strokeWidth={2.5} />
              <Text className="text-[10px] font-black uppercase tracking-wider text-rose-400">Catat Uang Keluar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* PINTASAN SERVIS ELEKTRONIK */}
        <View 
          className="p-6 rounded-[28px] border mb-6 shadow-xl"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <View className="flex-row items-center gap-4 mb-4">
            <View className="w-12 h-12 rounded-2xl items-center justify-center bg-blue-500/10 border border-blue-500/20">
              <Text className="text-xl">🔧</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-black" style={{ color: colors.text }}>Pintasan Servis Elektronik</Text>
              <Text className="text-[9px] font-bold mt-0.5" style={{ color: colors.textMuted }}>Pantau status servis perangkat elektronik secara real-time</Text>
            </View>
          </View>

          <View className="flex-row gap-3">
            <TouchableOpacity 
              onPress={() => {
                Vibration.vibrate(10);
                navigation.navigate('FeatureDetails', { 
                  featureId: 'service_elektronik', 
                  title: 'Servis Elektronik',
                });
              }}
              activeOpacity={0.85}
              className="flex-1 flex-row items-center justify-center gap-2 h-12 rounded-2xl"
              style={{ backgroundColor: colors.accent }}
            >
              <Text className="text-[10px] font-black uppercase tracking-wider text-white">Buka Servis</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => {
                Vibration.vibrate(10);
                navigation.navigate('FeatureDetails', { 
                  featureId: 'service_elektronik', 
                  title: 'Servis Elektronik',
                  autoOpenAddModal: true
                });
              }}
              activeOpacity={0.85}
              className="flex-1 flex-row items-center justify-center gap-2 h-12 rounded-2xl border"
              style={{ borderColor: colors.border }}
            >
              <Plus size={14} color={colors.text} />
              <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: colors.text }}>Tambah Tiket</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* TOP 5 BESTSELLERS LEADERBOARD */}
        <View 
          className="p-6 rounded-[28px] border shadow-xl"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <View className="flex-row items-center justify-between mb-6">
            <View>
              <Text className="text-sm font-black uppercase tracking-wider" style={{ color: colors.text }}>Top 5 Produk Terlaris</Text>
              <Text className="text-[9px] font-bold mt-0.5" style={{ color: colors.textMuted }}>Kalkulasi produk berdasarkan volume PCS</Text>
            </View>
            <Text className="text-lg">📈</Text>
          </View>

          {topProducts.length === 0 ? (
            <View className="items-center py-10 opacity-30">
              <Text className="text-3xl">📦</Text>
              <Text className="text-xs font-bold mt-3" style={{ color: colors.textMuted }}>Belum ada produk terjual</Text>
            </View>
          ) : (
            <View className="flex gap-4">
              {topProducts.map((item, index) => {
                const maxQty = topProducts[0]?.qty || 1;
                const percentage = (item.qty / maxQty) * 100;
                
                // Beautiful badge decorations for rank
                const rankColor = index === 0 ? '#fbbf24' : index === 1 ? '#cbd5e1' : index === 2 ? '#d97706' : colors.textMuted;
                const rankLabel = `#${index + 1}`;

                return (
                  <View key={index} className="flex gap-2">
                    <View className="flex-row justify-between items-center">
                      <View className="flex-row items-center gap-3 flex-1 pr-4">
                        <View 
                          className="w-7 h-7 rounded-lg items-center justify-center border"
                          style={{ 
                            backgroundColor: index < 3 ? rankColor + '10' : 'transparent',
                            borderColor: index < 3 ? rankColor : colors.border
                          }}
                        >
                          <Text 
                            className="text-[10px] font-black" 
                            style={{ color: index < 3 ? rankColor : colors.textMuted }}
                          >
                            {rankLabel}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-xs font-black" style={{ color: colors.text }} numberOfLines={1}>{item.name}</Text>
                          <Text className="text-[8px] font-bold uppercase mt-0.5 tracking-wider" style={{ color: colors.textMuted }}>{item.category}</Text>
                        </View>
                      </View>
                      <Text className="text-xs font-black" style={{ color: colors.text }}>{item.qty} Pcs</Text>
                    </View>
                    
                    {/* Progress Bar indicator */}
                    <View className="w-full h-2 rounded-full bg-slate-900/60 overflow-hidden">
                      <View 
                        className="h-full rounded-full"
                        style={{ 
                          width: `${percentage}%`, 
                          backgroundColor: index === 0 ? '#10b981' : colors.accent
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

      </View>

      {/* Reset Revenue Confirmation Modal */}
      <Modal
        visible={isResetModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setIsResetModalOpen(false);
          setResetConfirmText('');
        }}
      >
        <Pressable 
          className="flex-1 justify-center items-center bg-black/60 px-6"
          onPress={() => {
            setIsResetModalOpen(false);
            setResetConfirmText('');
          }}
        >
          <Pressable 
            className="w-full max-w-sm rounded-[32px] p-6 border shadow-2xl"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            onPress={() => {}} // prevent closing
          >
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-base font-black uppercase tracking-wider" style={{ color: colors.text }}>
                  Reset Pendapatan
                </Text>
                <Text className="text-[8px] font-bold uppercase tracking-wider mt-0.5" style={{ color: colors.textMuted }}>
                  Konfirmasi Penghapusan
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => {
                  setIsResetModalOpen(false);
                  setResetConfirmText('');
                }}
                className="w-8 h-8 rounded-lg bg-black/10 items-center justify-center"
              >
                <X size={16} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Warning Box */}
            <View className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 mb-4">
              <Text className="text-[10px] font-bold text-rose-500 leading-4">
                Tindakan ini akan <Text className="font-black">menghapus secara permanen semua transaksi</Text> pada toko ini dari database. Pendapatan kotor pada dashboard akan kembali ke <Text className="font-black">Rp 0</Text>. Ketik <Text className="font-black">Kosongkan Saldo</Text> di bawah untuk mengonfirmasi.
              </Text>
            </View>

            {/* Input Field */}
            <View className="mb-4">
              <Text className="text-[9px] font-black uppercase tracking-wider mb-2 ml-1" style={{ color: colors.textMuted }}>
                Teks Konfirmasi
              </Text>
              <TextInput
                value={resetConfirmText}
                onChangeText={setResetConfirmText}
                placeholder="Kosongkan Saldo"
                placeholderTextColor={colors.textMuted + '80'}
                autoCapitalize="none"
                style={{ 
                  color: colors.text, 
                  backgroundColor: colors.bg, 
                  borderColor: colors.border 
                }}
                className="w-full h-12 px-4 rounded-xl border font-bold text-xs"
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleResetRevenueMobile}
              disabled={isResetting || resetConfirmText !== 'Kosongkan Saldo'}
              className="w-full h-12 rounded-xl items-center justify-center flex-row gap-2 bg-rose-500"
              style={{ opacity: (isResetting || resetConfirmText !== 'Kosongkan Saldo') ? 0.5 : 1 }}
            >
              {isResetting && <ActivityIndicator size="small" color="#ffffff" />}
              <Text className="text-xs font-black text-white uppercase tracking-wider">
                KONFIRMASI KOSONGKAN SALDO
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Detail Announcement Modal */}
      <Modal
        visible={!!selectedAnnouncement}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedAnnouncement(null)}
      >
        <Pressable 
          className="flex-1 justify-end p-0 bg-black/80 justify-center"
          onPress={() => setSelectedAnnouncement(null)}
        >
          <Pressable 
            className="w-full rounded-t-[2.5rem] p-6 space-y-6"
            style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row justify-between items-center pb-3 border-b" style={{ borderColor: colors.border }}>
              <View className="flex-row items-center gap-2">
                <Text className="text-base">📢</Text>
                <Text className="text-[10px] font-black uppercase tracking-widest" style={{ color: colors.accent }}>Detail Pengumuman</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setSelectedAnnouncement(null)}
                className="w-8 h-8 rounded-full items-center justify-center bg-black/10"
              >
                <Text className="text-sm font-black" style={{ color: colors.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedAnnouncement && (
              <ScrollView className="max-h-[50vh] space-y-4" showsVerticalScrollIndicator={false}>
                <View className="space-y-1">
                  <Text className="text-[8px] font-black uppercase tracking-wider text-emerald-400">
                    {new Date(selectedAnnouncement.createdAt || Date.now()).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </Text>
                  <Text className="text-lg font-black tracking-tight" style={{ color: colors.text }}>
                    {selectedAnnouncement.title}
                  </Text>
                </View>

                {selectedAnnouncement.data?.imageUrl && (
                  <View className="w-full aspect-[16/9] rounded-2xl overflow-hidden border mt-2" style={{ borderColor: colors.border }}>
                    <Image 
                      source={{ uri: selectedAnnouncement.data.imageUrl }} 
                      className="w-full h-full"
                      style={{ resizeMode: 'cover' }}
                    />
                  </View>
                )}

                <Text className="text-xs font-bold leading-relaxed text-slate-300 mt-3">
                  {selectedAnnouncement.message}
                </Text>

                {selectedAnnouncement.data?.link && (
                  <TouchableOpacity 
                    onPress={() => {
                      Vibration.vibrate(5);
                      Linking.openURL(selectedAnnouncement.data.link);
                    }}
                    className="w-full py-4 rounded-2xl items-center justify-center mt-5 flex-row gap-2"
                    style={{ backgroundColor: colors.accent }}
                  >
                    <Text className="text-xs font-black text-white uppercase tracking-widest">Buka Tautan / Info Lanjut</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}

            <TouchableOpacity 
              onPress={() => setSelectedAnnouncement(null)}
              className="w-full py-4 rounded-2xl items-center justify-center border mt-2"
              style={{ backgroundColor: colors.bg, borderColor: colors.border }}
            >
              <Text className="text-xs font-black uppercase tracking-widest" style={{ color: colors.textMuted }}>Tutup</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  </SafeAreaView>
);
}
