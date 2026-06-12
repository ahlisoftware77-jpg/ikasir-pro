import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { activateKeepAwakeAsync } from 'expo-keep-awake';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from './src/store/authStore';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from './src/lib/firebase';
import { Alert, Platform, View, Text, TouchableOpacity, ActivityIndicator, Animated, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotificationStore } from './src/store/notificationStore';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import POSScreen from './src/screens/POSScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import ProductsScreen from './src/screens/ProductsScreen';
import ProductFormScreen from './src/screens/ProductFormScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import TransactionDetailScreen from './src/screens/TransactionDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ThemeScreen from './src/screens/ThemeScreen';
import StoreSettingsScreen from './src/screens/StoreSettingsScreen';
import FeatureScreen from './src/screens/FeatureScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import NotificationDetailScreen from './src/screens/NotificationDetailScreen';
import OrderNotificationListener from './src/components/OrderNotificationListener';
import SuperAdminScreen from './src/screens/SuperAdminScreen';

// Icons
import { Calculator, Package, History, LayoutGrid, LayoutDashboard, ShoppingBag, Wrench, AlertCircle, LogOut } from 'lucide-react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  const { colors } = useTheme();
  const { role, storeId } = useAuthStore();
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!storeId) return;

    const q = query(
      collection(db, 'transactions'),
      where('storeId', '==', storeId),
      where('orderStatus', '==', 'new')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setNewOrdersCount(snap.size);
    }, (err) => {
      console.error("Error fetching KDS tab badge count:", err);
    });

    return () => unsubscribe();
  }, [storeId]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        sceneStyle: { backgroundColor: colors.bg },
        headerStyle: {
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontFamily: 'System', // Use default font
          fontWeight: '900',
          fontSize: 18,
          color: colors.text,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 75 + insets.bottom,
          paddingBottom: 14 + insets.bottom,
          paddingTop: 12,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text + '80',
        tabBarLabelStyle: {
          fontWeight: '900',
          fontSize: 11,
          marginTop: 4,
        }
      }}
    >
      <Tab.Screen 
        name="Beranda" 
        component={DashboardScreen} 
        options={{
          tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={26} strokeWidth={2.5} />,
          title: 'DASBOR UTAMA'
        }}
      />
      <Tab.Screen 
        name="Kasir" 
        component={POSScreen} 
        options={{
          tabBarIcon: ({ color }) => <Calculator color={color} size={26} strokeWidth={2.5} />,
          title: 'IKASIR PRO'
        }}
      />
      <Tab.Screen 
        name="Pesanan" 
        component={OrdersScreen} 
        options={{
          tabBarIcon: ({ color }) => <ShoppingBag color={color} size={26} strokeWidth={2.5} />,
          title: 'PESANAN ONLINE',
          tabBarBadge: newOrdersCount > 0 ? newOrdersCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#ef4444',
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 'bold',
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            lineHeight: 20,
          }
        }}
      />
      <Tab.Screen 
        name="Transaksi" 
        component={TransactionsScreen} 
        options={{
          tabBarIcon: ({ color }) => <History color={color} size={26} strokeWidth={2.5} />,
          title: 'RIWAYAT TRANSAKSI'
        }}
      />
      <Tab.Screen 
        name="Lainnya" 
        component={SettingsScreen} 
        options={{
          tabBarIcon: ({ color }) => <LayoutGrid color={color} size={26} strokeWidth={2.5} />,
          title: 'MENU LAINNYA'
        }}
      />
    </Tab.Navigator>
  );
}

function NavigationRoot() {
  const { user, logout, role, storeId } = useAuthStore();
  const { colors, theme } = useTheme();
  const [maintenance, setMaintenance] = useState<{ isActive: boolean; message: string } | null>(null);

  const spinValue = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsubMaintenance = onSnapshot(doc(db, 'system_settings', 'maintenance'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMaintenance({
          isActive: !!data.isActive,
          message: data.message || '',
        });
      } else {
        setMaintenance({ isActive: false, message: '' });
      }
    }, (err) => {
      console.error("Error listening to maintenance status in App.tsx:", err);
    });

    return () => unsubMaintenance();
  }, []);

  useEffect(() => {
    const isMaint = maintenance?.isActive && role !== 'super-admin' && role !== 'superadmin';
    if (isMaint) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [maintenance?.isActive, role]);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        
        if (userData.isActive === false) {
          logout();
          Alert.alert('Akses Dibekukan', 'Akun Anda telah dinonaktifkan.');
          return;
        }

        const now = new Date();
        const validUntil = userData.validUntil ? new Date(userData.validUntil) : null;
        if (validUntil) {
          useAuthStore.getState().setSubscriptionUntil(userData.validUntil);
          useAuthStore.getState().setIsSubscriptionExpired(now > validUntil);

          // Expiry warning check
          if (userData.role !== 'super-admin' && userData.role !== 'superadmin' && userData.role !== 'customer') {
            const diffTime = validUntil.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if ([7, 3, 1].includes(diffDays)) {
              const todayStr = now.toISOString().split('T')[0];
              const storageKey = `sub_warned_mobile_${user.uid}_${diffDays}_${todayStr}`;
              
              AsyncStorage.getItem(storageKey).then((val) => {
                if (!val) {
                  AsyncStorage.setItem(storageKey, 'true');
                  
                  // Add to local notification store
                  useNotificationStore.getState().addNotification({
                    title: 'Masa Aktif Hampir Habis',
                    body: `Masa aktif langganan Anda tersisa ${diffDays} hari lagi. Segera lakukan perpanjangan agar layanan tetap aktif.`,
                    data: { type: 'subscription_warning' }
                  });

                  // Show alert
                  Alert.alert(
                    'Peringatan Langganan',
                    `Masa aktif langganan Anda tersisa ${diffDays} hari lagi. Segera perpanjang agar layanan tetap aktif.`,
                    [
                      {
                        text: 'Perpanjang',
                        onPress: () => {
                          if (navigationRef.isReady()) {
                            (navigationRef as any).navigate('Lainnya', { openSubscription: true });
                          }
                        }
                      },
                      { text: 'Nanti', style: 'cancel' }
                    ]
                  );
                }
              }).catch(err => console.error("Error reading sub warned AsyncStorage:", err));
            }
          }
        } else {
          useAuthStore.getState().setSubscriptionUntil(null);
          useAuthStore.getState().setIsSubscriptionExpired(false);
        }

        if (userData.role) useAuthStore.getState().setRole(userData.role);
        if (userData.storeId) useAuthStore.getState().setStoreId(userData.storeId);

        // Sync photoURL from Firestore to keep profile photo up-to-date
        const currentUser = useAuthStore.getState().user;
        const firestorePhoto = userData.photoURL || userData.photoUrl || '';
        if (currentUser && firestorePhoto && currentUser.photoURL !== firestorePhoto) {
          useAuthStore.getState().setUser({ ...currentUser, photoURL: firestorePhoto });
        }
      }
    }, (err) => {
      console.error("Error listening to user doc in App.tsx:", err);
    });

    const unsubBroadcasts = onSnapshot(collection(db, 'broadcasts'), async (snapshot) => {
      try {
        const processedStr = await AsyncStorage.getItem('kasir-pro-mobile-processed-broadcasts');
        const processedIds = processedStr ? JSON.parse(processedStr) : [];
        const newProcessedIds = [...processedIds];
        let changed = false;

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const id = change.doc.id;

            if (!processedIds.includes(id)) {
              useNotificationStore.getState().addNotification({
                title: data.title,
                body: data.message,
                data: {
                  broadcastId: id,
                  link: data.data?.link || '',
                  imageUrl: data.data?.imageUrl || ''
                }
              });
              newProcessedIds.push(id);
              changed = true;
            }
          }
        });

        if (changed) {
          await AsyncStorage.setItem('kasir-pro-mobile-processed-broadcasts', JSON.stringify(newProcessedIds));
        }
      } catch (err) {
        console.error("Error syncing broadcasts on mobile:", err);
      }
    }, (err) => {
      console.error("Error listening to broadcasts in App.tsx:", err);
    });

    return () => {
      unsubUser();
      unsubBroadcasts();
    };
  }, [user?.uid]);

  // Expiring & Low Stock Product Notification Check
  useEffect(() => {
    if (!storeId || (role as string) === 'customer') return;

    const q = query(
      collection(db, 'products'),
      where('storeId', '==', storeId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lowStockProducts: string[] = [];
      const expiringProducts: string[] = [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      snapshot.forEach(doc => {
        const data = doc.data();
        
        // 1. Check Low Stock
        if (data.manageStock !== false && data.stock !== undefined && data.stock !== null) {
          const stockNum = Number(data.stock);
          if (stockNum <= 5) {
            lowStockProducts.push(`${data.name} (Stok: ${stockNum})`);
          }
        }

        // 2. Check Expiry
        if (data.expiryDate) {
          const expiryDate = new Date(data.expiryDate);
          expiryDate.setHours(0, 0, 0, 0);
          const diffTime = expiryDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays >= 0 && diffDays <= 30) {
            expiringProducts.push(`${data.name} (Expired: ${diffDays} hari lagi)`);
          }
        }
      });

      if (lowStockProducts.length > 0 || expiringProducts.length > 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        const storageKey = `prod_warned_mobile_${storeId}_${todayStr}`;

        AsyncStorage.getItem(storageKey).then((val) => {
          if (!val) {
            AsyncStorage.setItem(storageKey, 'true');

            let warnMessage = '';
            if (lowStockProducts.length > 0) {
              warnMessage += `⚠️ Stok Menipis:\n${lowStockProducts.slice(0, 3).join('\n')}${lowStockProducts.length > 3 ? '\n...dan lainnya' : ''}\n\n`;
            }
            if (expiringProducts.length > 0) {
              warnMessage += `🚨 Hampir Expired:\n${expiringProducts.slice(0, 3).join('\n')}${expiringProducts.length > 3 ? '\n...dan lainnya' : ''}`;
            }

            // Trigger internal notification
            useNotificationStore.getState().addNotification({
              title: 'Peringatan Stok & Expired',
              body: `Terdapat ${lowStockProducts.length} produk menipis dan ${expiringProducts.length} hampir kadaluwarsa.`,
              data: { type: 'stock_warning' }
            });

            // Show native alert popup
            Alert.alert(
              '⚠️ Peringatan Persediaan',
              warnMessage.trim(),
              [{ text: 'OK', style: 'default' }]
            );
          }
        }).catch(err => console.error("Error reading prod warned AsyncStorage:", err));
      }
    }, (err) => {
      console.error("Error listening to products in App.tsx:", err);
    });

    return () => unsubscribe();
  }, [storeId, role]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (user && maintenance?.isActive && role !== 'super-admin' && role !== 'superadmin') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View
          className="absolute -top-12 -left-12 w-80 h-80 rounded-full opacity-10"
          style={{ backgroundColor: colors.accent }}
        />
        <View
          className="absolute -bottom-12 -right-12 w-80 h-80 rounded-full opacity-5"
          style={{ backgroundColor: colors.accent }}
        />

        <View className="items-center mb-8">
          <Animated.View
            style={{
              transform: [{ rotate: spin }],
              backgroundColor: colors.accent + '20',
              padding: 24,
              borderRadius: 32,
              borderWidth: 1,
              borderColor: colors.accent + '40',
            }}
          >
            <Wrench color={colors.accent} size={48} strokeWidth={2} />
          </Animated.View>
        </View>

        <View
          className="p-6 rounded-[32px] border w-full max-w-[400px]"
          style={{ backgroundColor: colors.surface + '99', borderColor: colors.border }}
        >
          <Text className="text-sm font-black text-center mb-4 uppercase tracking-[2px]" style={{ color: colors.text }}>
            PEMELIHARAAN SISTEM
          </Text>

          <View className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl mb-6 flex-row gap-3">
            <AlertCircle color="#f59e0b" size={20} className="shrink-0 mt-0.5" />
            <View className="flex-1">
              <Text className="text-xs font-black uppercase text-amber-500 tracking-[1px] mb-1">
                Pemberitahuan
              </Text>
              <Text className="text-xs leading-5" style={{ color: colors.text }}>
                {maintenance.message || 'Aplikasi sedang dalam pemeliharaan sistem. Harap coba beberapa saat lagi.'}
              </Text>
            </View>
          </View>

          <Text className="text-[10px] text-center mb-6 leading-5" style={{ color: colors.textMuted }}>
            Untuk sementara Anda tidak dapat melakukan transaksi atau mengakses dasbor. Kami akan segera kembali setelah pemeliharaan selesai. Terima kasih atas kesabaran Anda.
          </Text>

          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => logout()}
              activeOpacity={0.8}
              className="flex-1 h-14 rounded-2xl items-center justify-center border flex-row gap-2"
              style={{ borderColor: colors.border }}
            >
              <LogOut size={16} color={colors.textMuted} />
              <Text className="text-xs font-black uppercase tracking-[1px]" style={{ color: colors.textMuted }}>
                KELUAR
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <StatusBar style={theme.startsWith('light') ? 'dark' : 'light'} backgroundColor={colors.bg} translucent={false} />
      </View>
    );
  }

  const navTheme = {
    ...DefaultTheme,
    dark: !theme.startsWith('light'),
    colors: {
      ...DefaultTheme.colors,
      primary: colors.accent,
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: Platform.OS === 'ios' ? 'slide_from_right' : 'none'
        }}
      >
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen name="SuperAdminScreen" component={SuperAdminScreen} options={({ route }: any) => ({
              headerShown: true,
              title: route.params?.title || 'Super Admin',
              headerStyle: { backgroundColor: colors.surface },
              headerTitleStyle: { color: colors.text, fontWeight: '900', fontSize: 16 },
              headerTintColor: colors.text
            })} />
            <Stack.Screen name="ProfileScreen" component={ProfileScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ThemeScreen" component={ThemeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="StoreSettingsScreen" component={StoreSettingsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="EditProduct" component={ProductFormScreen} />
            <Stack.Screen 
              name="Products" 
              component={ProductsScreen} 
              options={{ 
                headerShown: true, 
                title: 'MANAJEMEN STOK',
                headerStyle: { backgroundColor: colors.surface },
                headerTitleStyle: { color: colors.text, fontWeight: '900', fontSize: 16 },
                headerTintColor: colors.text
              }} 
            />
            <Stack.Screen 
              name="Transactions" 
              component={TransactionsScreen} 
              options={{ 
                headerShown: true, 
                title: 'RIWAYAT PENJUALAN',
                headerStyle: { backgroundColor: colors.surface },
                headerTitleStyle: { color: colors.text, fontWeight: '900', fontSize: 16 },
                headerTintColor: colors.text
              }} 
            />
            <Stack.Screen 
              name="FeatureDetails" 
              component={FeatureScreen} 
              options={({ route }: any) => ({ 
                headerShown: true, 
                title: route.params?.title || 'Kasir Pro',
                headerStyle: { backgroundColor: colors.surface },
                headerTitleStyle: { color: colors.text, fontWeight: '900', fontSize: 16 },
                headerTintColor: colors.text
              })} 
            />
            <Stack.Screen 
              name="Notifications" 
              component={NotificationsScreen} 
              options={{ 
                headerShown: true, 
                title: 'PUSAT NOTIFIKASI',
                headerStyle: { backgroundColor: colors.surface },
                headerTitleStyle: { color: colors.text, fontWeight: '900', fontSize: 16 },
                headerTintColor: colors.text
              }} 
            />
            <Stack.Screen 
              name="NotificationDetail" 
              component={NotificationDetailScreen} 
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="TransactionDetail" 
              component={TransactionDetailScreen} 
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
      <StatusBar style={theme.startsWith('light') ? 'dark' : 'light'} backgroundColor={colors.bg} translucent={false} />
    </NavigationContainer>
  );
}

import UpdateChecker from './src/components/UpdateChecker';

export default function App() {
  useEffect(() => {
    activateKeepAwakeAsync().catch(console.warn);
  }, []);
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <UpdateChecker />
        <OrderNotificationListener />
        <NavigationRoot />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
