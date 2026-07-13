import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, TextInput, ActivityIndicator, Dimensions, RefreshControl, Alert } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, ShoppingBag, Store, MapPin, ShoppingCart, Clock, PlayCircle, Tag, XCircle, Star } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { db, primaryDb, getTenantDb } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoLocation from 'expo-location';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
  storeId: string;
  storeName?: string;
  stock?: number;
  manageStock?: boolean;
  averageRating?: number;
  reviewCount?: number;
  storeLatitude?: number;
  storeLongitude?: number;
  discount?: {
    type: 'percent' | 'fixed';
    value: number;
    name: string;
  };
}

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 2;
const CARD_MARGIN = 8;
const CARD_WIDTH = (width - CARD_MARGIN * (COLUMN_COUNT + 1)) / COLUMN_COUNT;

const getCategoryIcon = (catName: string) => {
  const name = catName.toLowerCase();
  
  if (name.includes('semua')) return '🏪';
  
  // Elektronik & Gadget
  if (name.includes('cctv') || name.includes('kamera') || name.includes('camera')) return '📹';
  if (name.includes('hp') || name.includes('handphone') || name.includes('smartphone')) return '📱';
  if (name.includes('laptop') || name.includes('komputer') || name.includes('pc')) return '💻';
  if (name.includes('tv') || name.includes('televisi')) return '📺';
  if (name.includes('elektronik') || name.includes('listrik')) return '🔌';
  if (name.includes('jam tangan') || name.includes('smartwatch')) return '⌚';

  // F&B (Makanan & Minuman)
  if (name.includes('makanan') || name.includes('food')) return '🍔';
  if (name.includes('minuman') || name.includes('drink') || name.includes('boba')) return '🥤';
  if (name.includes('kopi') || name.includes('coffee') || name.includes('cafe')) return '☕';
  if (name.includes('kue') || name.includes('roti') || name.includes('cake') || name.includes('bakery') || name.includes('snack')) return '🍰';
  if (name.includes('es krim') || name.includes('ice cream')) return '🍦';
  if (name.includes('sayur') || name.includes('buah') || name.includes('segar')) return '🥬';
  if (name.includes('daging') || name.includes('ikan') || name.includes('ayam')) return '🥩';

  // Fashion & Apparel
  if (name.includes('pakaian') || name.includes('baju') || name.includes('fashion') || name.includes('kaos') || name.includes('kemeja')) return '👕';
  if (name.includes('celana') || name.includes('jeans') || name.includes('pants')) return '👖';
  if (name.includes('sepatu') || name.includes('sandal') || name.includes('alas kaki')) return '👟';
  if (name.includes('tas') || name.includes('bag') || name.includes('koper')) return '🎒';
  if (name.includes('topi')) return '🧢';
  if (name.includes('kacamata')) return '🕶️';

  // Kesehatan & Kecantikan
  if (name.includes('kesehatan') || name.includes('obat') || name.includes('medis') || name.includes('apotek')) return '💊';
  if (name.includes('kecantikan') || name.includes('makeup') || name.includes('skincare') || name.includes('kosmetik')) return '💄';
  if (name.includes('salon') || name.includes('rambut') || name.includes('barbershop')) return '✂️';

  // Otomotif
  if (name.includes('motor') || name.includes('sepeda motor') || name.includes('bengkel motor')) return '🏍️';
  if (name.includes('mobil') || name.includes('bengkel mobil')) return '🚗';
  if (name.includes('sepeda') || name.includes('bicycle')) return '🚲';
  if (name.includes('otomotif') || name.includes('sparepart')) return '⚙️';

  // Rumah Tangga & Furniture
  if (name.includes('perabot') || name.includes('rumah') || name.includes('furniture') || name.includes('mebel')) return '🛋️';
  if (name.includes('sembako') || name.includes('beras') || name.includes('grosir')) return '🛒';
  if (name.includes('alat mandi') || name.includes('sabun') || name.includes('shampo')) return '🧴';
  if (name.includes('kebersihan') || name.includes('sapu') || name.includes('pel')) return '🧹';

  // Hobi & Pendidikan
  if (name.includes('buku') || name.includes('atk') || name.includes('alat tulis') || name.includes('sekolah')) return '📚';
  if (name.includes('mainan') || name.includes('anak') || name.includes('toys') || name.includes('kids')) return '🧸';
  if (name.includes('olahraga') || name.includes('sport') || name.includes('bola')) return '⚽';
  if (name.includes('musik') || name.includes('alat musik') || name.includes('gitar')) return '🎸';
  if (name.includes('peliharaan') || name.includes('hewan') || name.includes('pet')) return '🐕';
  if (name.includes('game') || name.includes('console')) return '🎮';

  // Aksesoris & Lain-lain
  if (name.includes('aksesoris') || name.includes('perhiasan') || name.includes('emas') || name.includes('cincin')) return '💍';
  if (name.includes('kado') || name.includes('hadiah') || name.includes('gift') || name.includes('bunga')) return '🎁';
  if (name.includes('jasa') || name.includes('service') || name.includes('layanan')) return '🛠️';
  if (name.includes('tiket') || name.includes('travel') || name.includes('tour')) return '🎫';
  
  // Default fallback
  return '📦';
};

export default function MarketplaceScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const cartItems = useCartStore((state) => state.items);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [radiusFilter, setRadiusFilter] = useState('Semua');
  const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  // Haversine formula
  const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);  
    const dLon = (lon2 - lon1) * (Math.PI / 180); 
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; 
  };
  
  const handleSetRadius = async (radius: string) => {
    if (radius !== 'Semua' && !userLocation) {
      setIsGettingLocation(true);
      try {
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Izin Ditolak', 'Aplikasi membutuhkan izin akses lokasi (GPS) untuk mengatur radius jangkauan.');
          setIsGettingLocation(false);
          return;
        }
        
        const location = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
      } catch (error: any) {
        console.error(error);
        Alert.alert('Gagal', 'Gagal mendapatkan lokasi. Pastikan GPS perangkat menyala.');
        setIsGettingLocation(false);
        return; // Don't set radius if location fails
      }
      setIsGettingLocation(false);
    }
    setRadiusFilter(radius);
  };
  const [categories, setCategories] = useState<string[]>(['Semua']);
  const [hasNewUpdate, setHasNewUpdate] = useState(false);
  const { user } = useAuthStore();
  
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      const userIdToSearch = user.uid || user.phone || user.phoneNumber || '';
      const phoneToSearch = user.phone || user.phoneNumber || '';
      
      let savedState: Record<string, string> = {};

      const checkOrders = async () => {
        const storedStr = await AsyncStorage.getItem('@marketplace_orders_state');
        if (storedStr) {
          try {
            savedState = JSON.parse(storedStr);
          } catch (e) {}
        }

        const ordersRef = collection(db, 'transactions');
        
        const handleSnap = (snap: any) => {
          let foundNew = false;
          snap.forEach((doc: any) => {
            const data = doc.data();
            const currentStatus = data.paymentStatus === 'paid' || data.paymentStatus === 'completed' ? 'paid' : (data.status || 'pending');
            
            // Jika ID belum ada di savedState (pesanan baru), atau statusnya berubah
            if (savedState[doc.id] !== currentStatus) {
              foundNew = true;
            }
          });
          setHasNewUpdate(foundNew);
        };

        const q1 = query(ordersRef, where('userId', '==', userIdToSearch));
        const unsub1 = onSnapshot(q1, handleSnap);

        let unsub2: any = null;
        if (phoneToSearch && phoneToSearch !== userIdToSearch) {
          const q2 = query(ordersRef, where('customerPhone', '==', phoneToSearch));
          unsub2 = onSnapshot(q2, handleSnap);
        }

        return () => {
          unsub1();
          if (unsub2) unsub2();
        };
      };

      let cleanup: any;
      checkOrders().then(fn => cleanup = fn);

      return () => {
        if (cleanup) cleanup();
      };
    }, [user])
  );
  
  // Store info
  const [storeLogos, setStoreLogos] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchMarketplaceData();
  }, []);

  const fetchMarketplaceData = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const storesQ = query(collection(primaryDb, 'stores'));
      const storesSnap = await getDocs(storesQ);
      
      // Coordinates are now fetched from store settings concurrently later.
      
      const tenantConfigs = new Map<string, any>();
      const storeToConfigMap: Record<string, any> = {};
      const storeOwnerMap: Record<string, string> = {};
      const primaryStoreLocMap: Record<string, {lat: number, lng: number}> = {};
      
      storesSnap.forEach(doc => {
        const sData = doc.data();
        const cfg = sData.infraConfig || { projectId: 'kasir-3d12b' }; // fallback
        const pId = cfg.projectId || cfg.fb_project_id;
        if (pId) tenantConfigs.set(pId, cfg);
        storeToConfigMap[doc.id] = cfg;
        
        if (sData.ownerUid) storeOwnerMap[doc.id] = sData.ownerUid;
        if (sData.latitude && sData.longitude) {
           primaryStoreLocMap[doc.id] = { lat: sData.latitude, lng: sData.longitude };
        }
      });
      
      // Fetch users collection as a fallback source for GPS
      const usersQ = query(collection(primaryDb, 'users'));
      const usersSnap = await getDocs(usersQ);
      const userLocMap: Record<string, { lat: number, lng: number }> = {};
      usersSnap.forEach(doc => {
        const u = doc.data();
        if (u.latitude && u.longitude) {
           userLocMap[doc.id] = { lat: u.latitude, lng: u.longitude };
        }
      });

      const list: Product[] = [];
      const uniqueStoreIds = new Set<string>();

      const fetchPromises = Array.from(tenantConfigs.values()).map(async (cfg) => {
        try {
          const tDb = getTenantDb(cfg);
          const q = query(collection(tDb, 'products'), where('joinMarketplace', '==', true));
          const pSnap = await getDocs(q);
          
          pSnap.forEach((d) => {
            const data = d.data();
            let finalImageUrl = data.imageUrl || '';
            
            // Fallback ke media array jika imageUrl kosong
            if (!finalImageUrl) {
              if (data.imageUrls && data.imageUrls.length > 0) finalImageUrl = data.imageUrls[0];
              else if (data.media && data.media.length > 0) finalImageUrl = data.media[0].url || data.media[0];
            }

            // Coordinates will be injected later
            list.push({
              id: d.id,
              name: data.name || '',
              storeLatitude: undefined,
              storeLongitude: undefined,
              price: data.price || 0,
              category: data.category || 'Umum',
              imageUrl: finalImageUrl,
              storeId: data.storeId || '',
              storeName: data.storeName || 'Toko Mitra',
              stock: data.stock !== undefined ? data.stock : 0,
              manageStock: data.manageStock !== undefined ? data.manageStock : true,
              averageRating: data.averageRating || 0,
              reviewCount: data.reviewCount || 0,
            });
            if (data.storeId) {
              uniqueStoreIds.add(data.storeId);
            }
          });
        } catch (e) {
          console.warn(`Failed to fetch from tenant db ${cfg.projectId}`, e);
        }
      });

      await Promise.all(fetchPromises);

      // Fetch active discounts
      const dq = query(collection(db, 'discounts'), where('isActive', '==', true));
      const dSnap = await getDocs(dq);
      const activeDiscounts = dSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const now = new Date();
      
      const productDiscounts: Record<string, any> = {};
      activeDiscounts.forEach(disc => {
        const start = new Date(disc.startDate);
        const end = new Date(disc.endDate);
        if (now >= start && now <= end) {
          disc.appliedProductIds?.forEach((pid: string) => {
            productDiscounts[pid] = disc;
          });
        }
      });

      // Apply discount to list
      list.forEach(p => {
        if (productDiscounts[p.id]) {
          p.discount = {
            type: productDiscounts[p.id].type,
            value: productDiscounts[p.id].value,
            name: productDiscounts[p.id].name
          };
        }
      });

      // Fetch store details concurrently
      const logoMap: Record<string, string> = {};
      const hiddenCatMap: Record<string, string[]> = {};
      const locMap: Record<string, { lat: number, lng: number }> = {};
      await Promise.all(
        Array.from(uniqueStoreIds).map(async (storeId) => {
          try {
            const cfg = storeToConfigMap[storeId] || { projectId: 'kasir-3d12b' };
            const tDb = getTenantDb(cfg);
            const sRef = doc(tDb, 'settings', `store_${storeId}`);
            const sSnap = await getDoc(sRef);
            if (sSnap.exists()) {
              const sData = sSnap.data();
              if (sData.logoUrl) logoMap[storeId] = sData.logoUrl;
              if (sData.hiddenMarketplaceCategories) hiddenCatMap[storeId] = sData.hiddenMarketplaceCategories;
              if (sData.latitude && sData.longitude) {
                 locMap[storeId] = { lat: sData.latitude, lng: sData.longitude };
              }
            }
          } catch (e) {}
        })
      );

      setStoreLogos(logoMap);

      // Map latitude and longitude to products with robust fallback across databases
      list.forEach(p => {
         // Priority 1: Tenant settings
         if (locMap[p.storeId]) {
            p.storeLatitude = locMap[p.storeId].lat;
            p.storeLongitude = locMap[p.storeId].lng;
         } 
         // Priority 2: Primary stores collection
         else if (primaryStoreLocMap[p.storeId]) {
            p.storeLatitude = primaryStoreLocMap[p.storeId].lat;
            p.storeLongitude = primaryStoreLocMap[p.storeId].lng;
         } 
         // Priority 3: Primary users collection (using store's ownerId)
         else if (storeOwnerMap[p.storeId] && userLocMap[storeOwnerMap[p.storeId]]) {
            const ownerId = storeOwnerMap[p.storeId];
            p.storeLatitude = userLocMap[ownerId].lat;
            p.storeLongitude = userLocMap[ownerId].lng;
         } 
         // Priority 4: Primary users collection (using storeId directly as fallback)
         else if (userLocMap[p.storeId]) {
            p.storeLatitude = userLocMap[p.storeId].lat;
            p.storeLongitude = userLocMap[p.storeId].lng;
         }
      });

      // Filter products based on store's hidden categories
      const visibleList = list.filter(p => {
        const hiddenCats = hiddenCatMap[p.storeId] || [];
        return !hiddenCats.includes(p.category);
      });

      const uniqueCategories = ['Semua', ...Array.from(new Set(visibleList.map(p => p.category)))].filter(Boolean);
      setCategories(uniqueCategories);

      // Randomize products
      for (let i = visibleList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [visibleList[i], visibleList[j]] = [visibleList[j], visibleList[i]];
      }

      setProducts(visibleList);
    } catch (err) {
      console.error('Error fetching marketplace data:', err);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMarketplaceData(true);
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (p.storeName || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === 'Semua' || p.category === selectedCategory;
      
      let matchesRadius = true;
      if (radiusFilter !== 'Semua') {
        if (userLocation && p.storeLatitude && p.storeLongitude) {
          const dist = getDistanceFromLatLonInKm(
            userLocation.latitude, userLocation.longitude,
            p.storeLatitude, p.storeLongitude
          );
          const maxDist = parseInt(radiusFilter);
          matchesRadius = dist <= maxDist;
        } else {
          // If no location data for user or store, don't show it if a radius is active
          matchesRadius = false; 
        }
      }

      return matchesSearch && matchesCat && matchesRadius;
    });
  }, [products, searchQuery, selectedCategory, radiusFilter, userLocation]);

  const renderProductCard = ({ item }: { item: Product }) => {
    const outOfStock = item.manageStock !== false && (item.stock || 0) <= 0;
    const isVideo = item.imageUrl?.toLowerCase().match(/\.(mp4|mov|webm)(\?.*)?$/i);
    
    let finalPrice = item.price;
    let hasDiscount = !!item.discount;
    if (hasDiscount) {
      if (item.discount!.type === 'percent') {
        finalPrice = item.price - (item.price * item.discount!.value / 100);
      } else {
        finalPrice = Math.max(0, item.price - item.discount!.value);
      }
    }

    return (
      <TouchableOpacity 
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, width: CARD_WIDTH }]}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('MarketplaceProductDetail', { productId: item.id, storeId: item.storeId })}
      >
        <View style={[styles.imageContainer, { backgroundColor: colors.bg }]}>
          {item.imageUrl ? (
            isVideo ? (
              <View style={styles.videoWrapper}>
                <Video
                  source={{ uri: item.imageUrl }}
                  style={styles.image}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={false}
                  isMuted={true}
                />
                <View style={styles.playIconOverlay}>
                  <PlayCircle color="#ffffff" size={32} opacity={0.8} />
                </View>
              </View>
            ) : (
              <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
            )
          ) : (
            <ShoppingBag color={colors.text} size={32} opacity={0.3} />
          )}
          {(item.averageRating && item.averageRating > 0) ? (
            <View style={styles.ratingBadge}>
              <Star color="#f59e0b" fill="#f59e0b" size={10} style={{ marginRight: 2 }} />
              <Text style={styles.ratingBadgeText}>{item.averageRating.toFixed(1)}</Text>
            </View>
          ) : null}
          {hasDiscount && (
            <View style={styles.discountBadge}>
              <Tag color="#fff" size={10} style={{ marginRight: 2 }} />
              <Text style={styles.discountText}>
                {item.discount!.type === 'percent' ? `${item.discount!.value}% OFF` : `-${(item.discount!.value / 1000)}K`}
              </Text>
            </View>
          )}
          {outOfStock && (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockText}>HABIS</Text>
            </View>
          )}
        </View>

        <View style={styles.cardContent}>
          <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
            {item.name}
          </Text>
          {/* Radius Filter */}
          <View className="mb-4">
            <View className="flex-row items-center px-4 mb-2">
              <MapPin size={14} color={colors.textMuted} />
              <Text className="text-[10px] font-black uppercase tracking-widest ml-1" style={{ color: colors.textMuted }}>Radius Jangkauan</Text>
              {isGettingLocation && <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 8 }} />}
            </View>
          </View>
          {hasDiscount ? (
            <View style={styles.priceContainer}>
              <Text style={[styles.originalPrice, { color: colors.textMuted }]}>
                Rp {item.price.toLocaleString('id-ID')}
              </Text>
              <Text style={[styles.productPrice, { color: colors.accent }]}>
                Rp {finalPrice.toLocaleString('id-ID')}
              </Text>
            </View>
          ) : (
            <Text style={[styles.productPrice, { color: colors.accent }]}>
              Rp {item.price.toLocaleString('id-ID')}
            </Text>
          )}

          <View style={[styles.storeInfo, { borderTopColor: colors.border }]}>
            {storeLogos[item.storeId] ? (
              <Image source={{ uri: storeLogos[item.storeId] }} style={styles.storeLogo} />
            ) : (
              <View style={[styles.storeLogoFallback, { backgroundColor: colors.accent + '20' }]}>
                <Store color={colors.accent} size={10} />
              </View>
            )}
            <Text style={[styles.storeName, { color: colors.text }]} numberOfLines={1}>
              {item.storeName}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <View style={styles.topRow}>
          <View style={[styles.searchContainer, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Search color={colors.accent} size={20} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Cari produk atau toko..."
              placeholderTextColor={colors.text + '80'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                <XCircle color={colors.textMuted} size={18} />
              </TouchableOpacity>
            )}
          </View>
          
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity 
              style={[styles.historyBtn, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '40', width: 'auto', paddingHorizontal: 12, flexDirection: 'row', gap: 6 }]}
              onPress={() => navigation.navigate('CartScreen')}
            >
              <ShoppingCart color={colors.accent} size={16} />
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '900' }}>Keranjang</Text>
              {cartItems.length > 0 && (
                <View style={[styles.notificationBadge, { right: 0, top: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }}>{cartItems.length}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.historyBtn, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '40', width: 'auto', paddingHorizontal: 12, flexDirection: 'row', gap: 6 }]}
              onPress={() => {
                setHasNewUpdate(false);
                navigation.navigate('MarketplaceOrders');
              }}
            >
              <ShoppingBag color={colors.accent} size={16} />
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '900' }}>Pesanan</Text>
              {hasNewUpdate && <View style={[styles.notificationBadge, { right: 8, top: 6, backgroundColor: '#ef4444' }]} />}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.categoriesContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categories}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.categoriesList}
            renderItem={({ item }) => {
              const isSelected = selectedCategory === item;
              return (
                <TouchableOpacity
                  style={[
                    styles.categorySquare,
                    { 
                      backgroundColor: isSelected ? colors.accent : colors.surface,
                      borderColor: isSelected ? colors.accent : colors.border
                    }
                  ]}
                  onPress={() => setSelectedCategory(item)}
                >
                  <Text style={{ fontSize: 24, marginBottom: 4 }}>
                    {getCategoryIcon(item)}
                  </Text>
                  <Text style={[
                    styles.categorySquareText,
                    { color: isSelected ? '#fff' : colors.text }
                  ]} numberOfLines={1}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
        
        {/* Radius Filter */}
        <View className="mb-4">
          <View className="flex-row items-center px-4 mb-2">
            <MapPin size={14} color={colors.textMuted} />
            <Text className="text-[10px] font-black uppercase tracking-widest ml-1" style={{ color: colors.textMuted }}>Radius Jangkauan</Text>
            {isGettingLocation && <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 8 }} />}
          </View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={['Semua', '5', '10', '25', '50']}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.categoriesList}
            renderItem={({ item: r }) => (
              <TouchableOpacity
                onPress={() => handleSetRadius(r)}
                className="mr-2 px-3 py-1.5 rounded-full border"
                style={{
                  backgroundColor: radiusFilter === r ? colors.accent : colors.surface,
                  borderColor: radiusFilter === r ? colors.accent : colors.border
                }}
              >
                <Text className="text-[10px] font-bold" style={{ color: radiusFilter === r ? '#fff' : colors.text }}>
                  {r === 'Semua' ? 'Semua Jarak' : `< ${r} km`}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.centerContainer}>
          <ShoppingBag color={colors.text} size={48} opacity={0.2} style={{ marginBottom: 16 }} />
          <Text style={[styles.emptyText, { color: colors.text }]}>Produk tidak ditemukan.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          renderItem={renderProductCard}
          numColumns={COLUMN_COUNT}
          contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + 80 }]}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.accent]}
              tintColor={colors.accent}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  historyBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontFamily: 'System',
    fontSize: 14,
  },
  categoriesContainer: {
    marginHorizontal: -16,
  },
  categoriesList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  categorySquare: {
    width: 72,
    height: 72,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  categorySquareText: {
    fontFamily: 'System',
    fontWeight: 'bold',
    fontSize: 10,
    textAlign: 'center',
  },
  listContainer: {
    padding: CARD_MARGIN,
  },
  columnWrapper: {
    gap: CARD_MARGIN,
    marginBottom: CARD_MARGIN,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  videoWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    width: '100%',
    height: '100%',
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  ratingBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333',
  },
  discountBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  discountText: {
    color: '#fff',
    fontFamily: 'System',
    fontWeight: '900',
    fontSize: 9,
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outOfStockText: {
    color: '#fff',
    fontFamily: 'System',
    fontWeight: '900',
    fontSize: 12,
    backgroundColor: '#e11d48',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  cardContent: {
    padding: 10,
  },
  productName: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 4,
    height: 36, // Ensure 2 lines height approx
  },
  priceContainer: {
    marginBottom: 8,
  },
  originalPrice: {
    fontFamily: 'System',
    fontSize: 10,
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  productPrice: {
    fontFamily: 'System',
    fontWeight: '900',
    fontSize: 14,
  },
  storeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  storeLogo: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 6,
  },
  storeLogoFallback: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeName: {
    fontFamily: 'System',
    fontSize: 11,
    opacity: 0.7,
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontFamily: 'System',
    fontSize: 14,
    opacity: 0.5,
  },
  floatingCart: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  cartBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  cartBadgeText: {
    color: '#fff',
    fontFamily: 'System',
    fontWeight: '800',
    fontSize: 10,
  }
});
