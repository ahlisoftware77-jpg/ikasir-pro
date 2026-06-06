import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from './src/store/authStore';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './src/lib/firebase';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import POSScreen from './src/screens/POSScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import ProductsScreen from './src/screens/ProductsScreen';
import ProductFormScreen from './src/screens/ProductFormScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import FeatureScreen from './src/screens/FeatureScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import OrderNotificationListener from './src/components/OrderNotificationListener';

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
          height: 65 + insets.bottom,
          paddingBottom: 12 + insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontWeight: '900',
          fontSize: 10,
        }
      }}
    >
      <Tab.Screen 
        name="Beranda" 
        component={DashboardScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
          title: 'DASBOR UTAMA'
        }}
      />
      <Tab.Screen 
        name="Kasir" 
        component={POSScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <Calculator color={color} size={size} />,
          title: 'KASIR PRO POS'
        }}
      />
      <Tab.Screen 
        name="Pesanan" 
        component={OrdersScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={size} />,
          title: 'PESANAN ONLINE',
          tabBarBadge: newOrdersCount > 0 ? newOrdersCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#ef4444',
            color: '#ffffff',
            fontSize: 9,
            fontWeight: 'bold',
          }
        }}
      />
      <Tab.Screen 
        name="Transaksi" 
        component={TransactionsScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <History color={color} size={size} />,
          title: 'RIWAYAT TRANSAKSI'
        }}
      />
      <Tab.Screen 
        name="Lainnya" 
        component={SettingsScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} />,
          title: 'MENU LAINNYA'
        }}
      />
    </Tab.Navigator>
  );
}

function NavigationRoot() {
  const { user } = useAuthStore();
  const { colors, theme } = useTheme();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
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
          </>
        )}
      </Stack.Navigator>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
    </NavigationContainer>
  );
}

export default function App() {
  useKeepAwake();
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <OrderNotificationListener />
        <NavigationRoot />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
