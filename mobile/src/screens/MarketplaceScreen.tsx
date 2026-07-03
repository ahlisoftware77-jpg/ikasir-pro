import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, TextInput, ActivityIndicator, Dimensions, RefreshControl } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, ShoppingBag, Store, MapPin, ShoppingCart, Clock, PlayCircle, Tag, XCircle, Star } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export default function MarketplaceScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const cartItems = useCartStore((state) => state.items);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [categories, setCategories] = useState<string[]>(['Semua']);
  const [refreshing, setRefreshing] = useState(false);
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
      const q = query(collection(db, 'products'), where('joinMarketplace', '==', true));
      const snap = await getDocs(q);
      const list: Product[] = [];
      const uniqueStoreIds = new Set<string>();

      snap.forEach((d) => {
        const data = d.data();
        let finalImageUrl = data.imageUrl || '';
        
        // Fallback ke media array jika imageUrl kosong
        if (!finalImageUrl) {
          if (data.imageUrls && data.imageUrls.length > 0) finalImageUrl = data.imageUrls[0];
          else if (data.media && data.media.length > 0) finalImageUrl = data.media[0].url || data.media[0];
        }

        list.push({
          id: d.id,
          name: data.name || '',
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
      await Promise.all(
        Array.from(uniqueStoreIds).map(async (storeId) => {
          const sRef = doc(db, 'settings', `store_${storeId}`);
          const sSnap = await getDoc(sRef);
          if (sSnap.exists()) {
            const sData = sSnap.data();
            if (sData.logoUrl) logoMap[storeId] = sData.logoUrl;
          }
        })
      );

      setStoreLogos(logoMap);

      const uniqueCategories = ['Semua', ...Array.from(new Set(list.map(p => p.category)))].filter(Boolean);
      setCategories(uniqueCategories);

      // Randomize products
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }

      setProducts(list);
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
      return matchesSearch && matchesCat;
    });
  }, [products, searchQuery, selectedCategory]);

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
        onPress={() => navigation.navigate('MarketplaceProductDetail', { productId: item.id })}
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
          
          <TouchableOpacity 
            style={[styles.historyBtn, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '40', width: 'auto', paddingHorizontal: 14, flexDirection: 'row', gap: 6 }]}
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
                    styles.categoryChip,
                    { 
                      backgroundColor: isSelected ? colors.accent : colors.bg,
                      borderColor: isSelected ? colors.accent : colors.border
                    }
                  ]}
                  onPress={() => setSelectedCategory(item)}
                >
                  <Text style={[
                    styles.categoryText,
                    { color: isSelected ? '#fff' : colors.text }
                  ]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }}
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

      {cartItems.length > 0 && (
        <TouchableOpacity
          style={[styles.floatingCart, { bottom: insets.bottom + 24, backgroundColor: colors.accent }]}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('CartScreen')}
        >
          <ShoppingCart color="#fff" size={24} />
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{cartItems.length}</Text>
          </View>
        </TouchableOpacity>
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
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryText: {
    fontFamily: 'System',
    fontWeight: 'bold',
    fontSize: 12,
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
