import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { activateKeepAwakeAsync } from 'expo-keep-awake';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from './src/store/authStore';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from './src/lib/firebase';
import { Alert, Platform } from 'react-native';

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
import OrderNotificationListener from './src/components/OrderNotificationListener';
import SuperAdminScreen from './src/screens/SuperAdminScreen';

// Icons
import { Calculator, Package, History, LayoutGrid, LayoutDashboard, ShoppingBag } from 'lucide-react-native';

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
  const { user, logout } = useAuthStore();
  const { colors, theme } = useTheme();

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
        } else {
          useAuthStore.getState().setSubscriptionUntil(null);
          useAuthStore.getState().setIsSubscriptionExpired(false);
        }

        if (userData.role) useAuthStore.getState().setRole(userData.role);
        if (userData.storeId) useAuthStore.getState().setStoreId(userData.storeId);
      }
    }, (err) => {
      console.error("Error listening to user doc in App.tsx:", err);
    });

    return () => unsubUser();
  }, [user?.uid]);

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
    <NavigationContainer theme={navTheme}>
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
