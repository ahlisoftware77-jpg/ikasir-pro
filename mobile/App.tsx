import React, { useState, useEffect, useMemo } from 'react';
import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';

export const navigationRef = createNavigationContainerRef();
import { useFonts } from 'expo-font';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { activateKeepAwakeAsync } from 'expo-keep-awake';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from './src/store/authStore';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './src/lib/firebase';

let isCleanupDone = false;

const runBackgroundCleanup = async (storeId: string) => {
  try {
    // 1. Cleanup activity_logs (> 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const qLogsTimestamp = query(
      collection(db, 'activity_logs'),
      where('storeId', '==', storeId),
      where('timestamp', '<', thirtyDaysAgo)
    );

    const qLogsString = query(
      collection(db, 'activity_logs'),
      where('storeId', '==', storeId),
      where('timestamp', '<', thirtyDaysAgo.toISOString())
    );

    const [snapTimestamp, snapString] = await Promise.all([
      getDocs(qLogsTimestamp),
      getDocs(qLogsString)
    ]);

    const batch = writeBatch(db);
    let count = 0;

    snapTimestamp.forEach((d) => {
      batch.delete(doc(db, 'activity_logs', d.id));
      count++;
    });

    snapString.forEach((d) => {
      batch.delete(doc(db, 'activity_logs', d.id));
      count++;
    });

    // 2. Cleanup recycle_bin (> 90 days)
    const qRecycle = query(
      collection(db, 'recycle_bin'),
      where('storeId', '==', storeId)
    );
    const snapRecycle = await getDocs(qRecycle);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    snapRecycle.forEach((d) => {
      const data = d.data();
      if (data.deletedAt) {
        const deletedDate = new Date(data.deletedAt);
        if (deletedDate < ninetyDaysAgo) {
          batch.delete(doc(db, 'recycle_bin', d.id));
          count++;
        }
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`[Cleanup Mobile] Berhasil menghapus ${count} dokumen kedaluwarsa.`);
    }
  } catch (err) {
    console.error('[Cleanup Mobile] Gagal membersihkan data lama:', err);
  }
};
import { Alert, Platform, View, Text, TouchableOpacity, ActivityIndicator, Animated, Easing, Vibration, Pressable } from 'react-native';
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
import RecycleBinScreen from './src/screens/RecycleBinScreen';
import UpdateChecker from './src/components/UpdateChecker';

// Icons
import { Calculator, Package, History, LayoutGrid, LayoutDashboard, ShoppingBag, Wrench, AlertCircle, LogOut } from 'lucide-react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabBarButton3D({ props, colors, isMenuDisabled, onPressHandler }: any) {
  return (
    <Pressable
      onPress={(e) => {
        if (!isMenuDisabled) {
          if (onPressHandler) {
            onPressHandler(e);
          } else {
            props.onPress?.(e);
          }
        }
      }}
      style={[
        props.style,
        {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isMenuDisabled ? 0.4 : 1,
        }
      ]}
    >
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        {props.children}
      </View>
    </Pressable>
  );
}

function TabNavigator() {
  const { colors } = useTheme();
  const { role, storeId, subscriptionUntil, isSubscriptionExpired, disabledMenus, expiredDisabledMenus, permissions } = useAuthStore();
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const insets = useSafeAreaInsets();

  const isBerandaVisible = role === 'admin' || role === 'super-admin' || role === 'superadmin' || permissions?.canViewReports;
  const isKasirVisible = role === 'admin' || role === 'super-admin' || role === 'superadmin' || permissions?.canAccessPOS;
  const isPesananVisible = role === 'admin' || role === 'super-admin' || role === 'superadmin' || permissions?.canManageOrders;
  const isTransaksiVisible = role === 'admin' || role === 'super-admin' || role === 'superadmin' || permissions?.canAccessPOS;

  const sisaHari = useMemo(() => {
    if (!subscriptionUntil) return null;
    const expiryDate = new Date(subscriptionUntil);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [subscriptionUntil]);

  const showExpiredOrWarningBadge = (role as string) !== 'super-admin' && (role as string) !== 'superadmin' && (role as string) !== 'customer' && (isSubscriptionExpired || (sisaHari !== null && sisaHari <= 7));

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

  const getTabOptions = (title: string, path: string, iconComponent: any, extraOptions = {}) => {
    const isSuperAdminBlocked = disabledMenus?.includes(path);
    const blockedWhenExpired = expiredDisabledMenus || [];
    const isExpiredBlocked = isSubscriptionExpired && blockedWhenExpired.includes(path);
    const isMenuDisabled = isSuperAdminBlocked || isExpiredBlocked;

    return {
      tabBarIcon: ({ color, focused }: any) => {
        if (typeof iconComponent === 'string') {
          return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{iconComponent}</Text>;
        }
        const Icon = iconComponent;
        return <Icon color={color} size={24} strokeWidth={2.5} />;
      },
      title,
      tabBarButton: (props: any) => (
        <TabBarButton3D
          props={props}
          colors={colors}
          isMenuDisabled={isMenuDisabled}
          onPressHandler={(e: any) => {
            if (isSuperAdminBlocked) {
              Alert.alert('Akses Terkunci', 'Fitur ini dinonaktifkan oleh administrator.');
            } else if (isExpiredBlocked) {
              Alert.alert(
                'Masa Aktif Habis',
                'Masa aktif akun Anda telah habis. Silakan lakukan perpanjangan langganan untuk mengakses menu ini.',
                [
                  { text: 'Ok', style: 'cancel' },
                  {
                    text: 'Langganan',
                    onPress: () => {
                      Vibration.vibrate(10);
                      if (navigationRef.isReady()) {
                        (navigationRef as any).navigate('Lainnya', { openSubscription: true });
                      }
                    }
                  }
                ]
              );
            } else {
              props.onPress?.(e);
            }
          }}
        />
      ),
      ...extraOptions
    };
  };

  const isLightTheme = colors.bg.toLowerCase() === '#f8fafc' || colors.bg.toLowerCase() === '#f4fbf7' || colors.bg.toLowerCase() === '#fffaf5' || colors.bg.toLowerCase() === '#faf5f5';

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
          fontFamily: 'System',
          fontWeight: '900',
          fontSize: 18,
          color: colors.text,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 60 + insets.bottom,
          paddingBottom: 4 + insets.bottom,
          paddingTop: 8,
          elevation: 8,
          shadowOpacity: 0.05,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: isLightTheme ? '#64748b' : '#94a3b8',
        tabBarLabelStyle: {
          fontWeight: '900',
          fontSize: 10,
          marginTop: 2,
        }
      }}
    >
      {isBerandaVisible && (
        <Tab.Screen 
          name="Beranda" 
          component={DashboardScreen} 
          options={getTabOptions('DASBOR UTAMA', '/reports', '📊')}
        />
      )}
      {isKasirVisible && (
        <Tab.Screen 
          name="Kasir" 
          component={POSScreen} 
          options={getTabOptions('IKASIR PRO', '/pos', '🛒')}
        />
      )}
      {isPesananVisible && (
        <Tab.Screen 
          name="Pesanan" 
          component={OrdersScreen} 
          options={getTabOptions('PESANAN ONLINE', '/orders', '📦', {
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
          })}
        />
      )}
      {isTransaksiVisible && (
        <Tab.Screen 
          name="Transaksi" 
          component={TransactionsScreen} 
          options={getTabOptions('RIWAYAT TRANSAKSI', '/transactions', '💰')}
        />
      )}
      <Tab.Screen 
        name="Lainnya" 
        component={SettingsScreen} 
        options={{
          tabBarIcon: ({ focused }: any) => <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>⚙️</Text>,
          title: 'MENU LAINNYA',
          tabBarBadge: showExpiredOrWarningBadge ? '!' : undefined,
          tabBarBadgeStyle: showExpiredOrWarningBadge ? {
            backgroundColor: '#fbbf24',
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 'bold',
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            lineHeight: 16,
          } : undefined,
          tabBarButton: (props: any) => (
            <TabBarButton3D
              props={props}
              colors={colors}
              isMenuDisabled={false}
            />
          )
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

    const unsubBranding = onSnapshot(doc(db, 'system_settings', 'branding'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        useAuthStore.getState().setExpiredDisabledMenus(data.expiredDisabledMenus || []);
      }
    }, (err) => {
      console.error("Error listening to branding global settings in App.tsx:", err);
    });

    return () => {
      unsubMaintenance();
      unsubBranding();
    };
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
    let unsubSuperadminNotifications: (() => void) | null = null;

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
            
            if (diffDays <= 7 && diffDays > 0) {
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

        if (userData.role) {
          useAuthStore.getState().setRole(userData.role);
          
          if (userData.role === 'super-admin' || userData.role === 'superadmin' || !!(userData.permissions && userData.permissions.canAccessSuperAdminPanel)) {
            if (!unsubSuperadminNotifications) {
              unsubSuperadminNotifications = onSnapshot(collection(db, 'superadmin_notifications'), async (snapshot) => {
                try {
                  const processedStr = await AsyncStorage.getItem('kasir-pro-mobile-processed-superadmin-notifications');
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
                            superadminNotificationId: id,
                            createdAt: data.createdAt,
                            type: data.type,
                            registrationId: data.registrationId
                          }
                        });
                        newProcessedIds.push(id);
                        changed = true;
                      }
                    }
                  });

                  if (changed) {
                    await AsyncStorage.setItem('kasir-pro-mobile-processed-superadmin-notifications', JSON.stringify(newProcessedIds));
                  }
                } catch (err) {
                  console.error("Error syncing superadmin notifications on mobile:", err);
                }
              }, (err) => {
                console.error("Error listening to superadmin notifications in App.tsx:", err);
              });
            }
          } else {
            if (unsubSuperadminNotifications) {
              unsubSuperadminNotifications();
              unsubSuperadminNotifications = null;
            }
          }

          let userPermissions = null;
          if (userData.role === 'admin' || userData.role === 'super-admin' || userData.role === 'superadmin') {
            userPermissions = {
              canAccessPOS: true,
              canManageProducts: true,
              canCreateProducts: true,
              canEditProducts: true,
              canDeleteProducts: true,
              canViewReports: true,
              canManageUsers: true,
              canEditSettings: true,
              canManageEstimations: true,
              canManageDebts: true,
              canManageOrders: true,
              canViewLogs: true
            };
          } else {
            userPermissions = {
              canAccessPOS: userData.permissions?.canAccessPOS ?? true,
              canManageProducts: userData.permissions?.canManageProducts ?? false,
              canCreateProducts: userData.permissions?.canCreateProducts ?? userData.permissions?.canManageProducts ?? false,
              canEditProducts: userData.permissions?.canEditProducts ?? userData.permissions?.canManageProducts ?? false,
              canDeleteProducts: userData.permissions?.canDeleteProducts ?? userData.permissions?.canManageProducts ?? false,
              canViewReports: userData.permissions?.canViewReports ?? false,
              canManageUsers: userData.permissions?.canManageUsers ?? false,
              canEditSettings: userData.permissions?.canEditSettings ?? false,
              canManageEstimations: userData.permissions?.canManageEstimations ?? false,
              canManageDebts: userData.permissions?.canManageDebts ?? false,
              canManageOrders: userData.permissions?.canManageOrders ?? false,
              canViewLogs: userData.permissions?.canViewLogs ?? false,
              ...userData.permissions
            };
          }
          useAuthStore.getState().setPermissions(userPermissions);
        }
        if (userData.storeId) {
          useAuthStore.getState().setStoreId(userData.storeId);
          if (userData.storeId !== 'default-store' && !isCleanupDone) {
            isCleanupDone = true;
            runBackgroundCleanup(userData.storeId);
          }
          getDoc(doc(db, 'stores', userData.storeId)).then((storeSnap) => {
            if (storeSnap.exists()) {
              const storeData = storeSnap.data();
              useAuthStore.getState().setDisabledMenus(storeData.disabledMenus || []);
            }
          }).catch(err => console.error("Error loading store details on mobile:", err));
        }

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
      if (unsubSuperadminNotifications) {
        unsubSuperadminNotifications();
      }
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
            <Stack.Screen 
              name="RecycleBin" 
              component={RecycleBinScreen} 
              options={{ 
                headerShown: true, 
                title: 'KOTAK SAMPAH',
                headerStyle: { backgroundColor: colors.surface },
                headerTitleStyle: { color: colors.text, fontWeight: '900', fontSize: 16 },
                headerTintColor: colors.text
              }} 
            />
          </>
        )}
      </Stack.Navigator>
      <StatusBar style={theme.startsWith('light') ? 'dark' : 'light'} backgroundColor={colors.bg} translucent={false} />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'Railey': require('./assets/Railey-PersonalUse.ttf'),
    'Cheque-Regular': require('./assets/Cheque-Regular.ttf'),
    'Lovelo-LineBold': require('./assets/Lovelo-LineBold.ttf'),
    'Sancreek-Regular': require('./assets/Sancreek-Regular.ttf'),
  });

  useEffect(() => {
    activateKeepAwakeAsync().catch(console.warn);
  }, []);

  useEffect(() => {
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data = response.notification.request.content.data;
        if (!data || Object.keys(data).length === 0) return;
        
        if (navigationRef.isReady()) {
          if (data?.type === 'order' || data?.transactionId) {
            // Redirect to Orders tab ('Pesanan')
            (navigationRef as any).navigate('Main', { screen: 'Pesanan' });
          } else if (data?.type === 'broadcast' || data?.broadcastId || data?.superadminNotificationId) {
            // Redirect to Notifications screen
            (navigationRef as any).navigate('Notifications');
          }
        }
      } catch (err) {
        console.error('Error handling notification click response:', err);
      }
    });

    return () => {
      responseSubscription.remove();
    };
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
