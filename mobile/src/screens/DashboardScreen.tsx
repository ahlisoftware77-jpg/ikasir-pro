import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Share, Clipboard, RefreshControl, Vibration, Pressable } from 'react-native';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../context/ThemeContext';
import { DollarSign, ShoppingBag, Package, Users, Copy, Share2, TrendingUp, ChevronRight, Bell } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { useNotificationStore } from '../store/notificationStore';

export default function DashboardScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { user, storeId, isSubscriptionExpired, subscriptionUntil } = useAuthStore();

  useEffect(() => {
    if (isSubscriptionExpired) {
      const formattedDate = subscriptionUntil 
        ? new Date(subscriptionUntil).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : '-';
      Alert.alert(
        '🚨 Masa Aktif Akun Habis',
        `Masa aktif langganan akun Anda telah berakhir pada ${formattedDate}. Silakan lakukan perpanjangan agar tetap dapat mengakses semua fitur iKasir Pro secara lengkap.`,
        [
          { text: 'Nanti', style: 'cancel' },
          { 
            text: 'Perpanjang Sekarang', 
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

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setRefreshing(false);
  };

  useEffect(() => {
    if (!storeId) return;

    setLoading(true);

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
      unsubTrx();
      unsubCust();
    };
  }, [storeId]);

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

        {/* HERO CARD - OMZET TOKO */}
        <View 
          className="p-6 rounded-[32px] border mb-6 relative overflow-hidden shadow-2xl shadow-emerald-500/5"
          style={{ backgroundColor: colors.surface, borderColor: '#10b98125' }}
        >
          {/* Subtle inside glow */}
          <View className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full filter blur-xl" />
          
          <View className="flex-row justify-between items-start mb-4">
            <View>
              <Text className="text-[10px] font-black uppercase tracking-[2px]" style={{ color: colors.textMuted }}>
                TOTAL PENDAPATAN KOTOR
              </Text>
              <Text className="text-3xl font-black mt-2 tracking-tight text-emerald-400">
                Rp {totalRevenue.toLocaleString('id-ID')}
              </Text>
            </View>
            <View className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 items-center justify-center">
              <DollarSign color="#10b981" size={24} />
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
              <ShoppingBag color="#3b82f6" size={16} />
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
              <Package color="#8b5cf6" size={16} />
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
              <Users color="#f43f5e" size={16} />
            </View>
            <Text className="text-[8px] font-black uppercase tracking-wider" style={{ color: colors.textMuted }}>PELANGGAN</Text>
            <Text className="text-sm font-black mt-1" style={{ color: colors.text }}>{customersCount}</Text>
          </View>

        </View>

        {/* ONLINE STORE EMBED SHARE CARD */}
        <View 
          className="p-6 rounded-[28px] border mb-6 shadow-xl"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <View className="flex-row items-center gap-4 mb-4">
            <View className="w-12 h-12 rounded-2xl items-center justify-center bg-blue-500/10 border border-blue-500/20">
              <ShoppingBag color={colors.accent} size={22} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-black" style={{ color: colors.text }}>Outlet Online Aktif</Text>
              <Text className="text-[9px] font-bold mt-0.5" style={{ color: colors.textMuted }}>Link order instan mandiri untuk pelanggan Anda</Text>
            </View>
          </View>
          
          <View className="bg-black/30 border border-slate-800/80 rounded-xl px-4 py-3 mb-4 flex-row justify-between items-center">
            <Text className="text-[10px] font-bold text-slate-400 select-all flex-1 mr-2" numberOfLines={1}>
              {onlineStoreUrl}
            </Text>
            <TouchableOpacity onPress={handleCopyLink} className="p-1">
              <Copy size={14} color={colors.accent} />
            </TouchableOpacity>
          </View>

          <View className="flex-row gap-3">
            <TouchableOpacity 
              onPress={handleCopyLink}
              activeOpacity={0.85}
              className="flex-1 flex-row items-center justify-center gap-2 h-12 rounded-2xl border"
              style={{ borderColor: colors.border, backgroundColor: colors.bg + '20' }}
            >
              <Copy size={14} color={colors.text} />
              <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: colors.text }}>SALIN LINK</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleShareLink}
              activeOpacity={0.855}
              className="flex-1 flex-row items-center justify-center gap-2 h-12 rounded-2xl"
              style={{ backgroundColor: colors.accent }}
            >
              <Share2 size={14} color="#ffffff" />
              <Text className="text-[10px] font-black text-white uppercase tracking-wider">BAGIKAN</Text>
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
            <TrendingUp size={18} color={colors.accent} />
          </View>

          {topProducts.length === 0 ? (
            <View className="items-center py-10 opacity-30">
              <Package size={44} color={colors.textMuted} />
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
    </ScrollView>
  </SafeAreaView>
);
}
