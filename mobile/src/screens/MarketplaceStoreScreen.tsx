import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, TextInput, ActivityIndicator, Dimensions, RefreshControl } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, ShoppingBag, Store, MapPin, ShoppingCart, Clock, PlayCircle, Tag, ChevronLeft, MessageCircle } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

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

export default function MarketplaceStoreScreen({ route, navigation }: any) {
  const { storeId, storeName: initialStoreName } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Toko');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  // Store info
  const [storeInfo, setStoreInfo] = useState<{name: string, logoUrl: string, desc?: string}>({
    name: initialStoreName || 'Toko',
    logoUrl: ''
  });

  useEffect(() => {
    fetchStoreData();
  }, [storeId]);

  const fetchStoreData = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      // 1. Fetch Store Info
      const sRef = doc(db, 'settings', `store_${storeId}`);
      const sSnap = await getDoc(sRef);
      if (sSnap.exists()) {
        const sData = sSnap.data();
        setStoreInfo({
          name: sData.storeName || initialStoreName || 'Toko',
          logoUrl: sData.logoUrl || '',
          desc: sData.storeDescription || ''
        });
      }

      // 2. Fetch Products
      const q = query(collection(db, 'products'), where('joinMarketplace', '==', true), where('storeId', '==', storeId));
      const snap = await getDocs(q);
      const list: Product[] = [];

      snap.forEach((d) => {
        const data = d.data();
        let finalImageUrl = data.imageUrl || '';
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
          storeId: data.storeId || storeId,
          storeName: data.storeName || initialStoreName,
          stock: data.stock !== undefined ? data.stock : 0,
          manageStock: data.manageStock !== undefined ? data.manageStock : true,
        });
      });

      // 3. Fetch active discounts
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

      // Apply discount
      list.forEach(p => {
        if (productDiscounts[p.id]) {
          p.discount = {
            type: productDiscounts[p.id].type,
            value: productDiscounts[p.id].value,
            name: productDiscounts[p.id].name
          };
        }
      });

      setProducts(list);
    } catch (err) {
      console.error('Error fetching store data:', err);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStoreData(true);
  }, [storeId]);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return Array.from(cats);
  }, [products]);

  const filteredProducts = useMemo(() => {
    let res = products;
    if (selectedCategory) {
      res = res.filter(p => p.category === selectedCategory);
    }
    if (searchQuery) {
      res = res.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return res;
  }, [products, searchQuery, selectedCategory]);

  const displayedData = useMemo(() => {
    if (activeTab === 'Toko') return filteredProducts.slice(0, 4); // Limit for home
    if (activeTab === 'Produk') return filteredProducts;
    if (activeTab === 'Kategori') return categories;
    if (activeTab === 'Ulasan') return []; // Placeholder
    return filteredProducts;
  }, [activeTab, filteredProducts, categories]);

  const renderProductCard = ({ item }: { item: any }) => {
    if (activeTab === 'Kategori') {
      return (
        <TouchableOpacity 
          style={[styles.categoryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {
            setSelectedCategory(item);
            setActiveTab('Produk');
          }}
        >
          <Text style={[styles.categoryName, { color: colors.text }]}>{item}</Text>
        </TouchableOpacity>
      );
    }

    if (activeTab === 'Ulasan') {
      return null;
    }

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
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft color={colors.text} size={24} />
          </TouchableOpacity>
          <View style={[styles.searchContainer, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Search color={colors.accent} size={20} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Cari produk toko..."
              placeholderTextColor={colors.text + '80'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>
      </View>

      <FlatList
        key={activeTab}
        data={displayedData}
        keyExtractor={(item, index) => typeof item === 'string' ? item : item.id}
        renderItem={renderProductCard}
        numColumns={activeTab === 'Kategori' ? 1 : COLUMN_COUNT}
        contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + 80 }]}
        columnWrapperStyle={activeTab === 'Kategori' ? undefined : styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.accent]}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              {activeTab === 'Ulasan' ? (
                <>
                  <MessageCircle color={colors.text} size={64} opacity={0.2} style={{ marginBottom: 16 }} />
                  <Text style={[styles.emptyStateText, { color: colors.textMuted }]}>Belum ada ulasan.</Text>
                </>
              ) : (
                <>
                  <Store color={colors.text} size={64} opacity={0.2} style={{ marginBottom: 16 }} />
                  <Text style={[styles.emptyStateText, { color: colors.textMuted }]}>Belum ada produk di kategori ini.</Text>
                </>
              )}
            </View>
          )
        }
        ListHeaderComponent={
          <View>
            <View style={[styles.storeProfileHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
              {storeInfo.logoUrl ? (
                <Image source={{ uri: storeInfo.logoUrl }} style={styles.storeProfileLogo} />
              ) : (
                <View style={[styles.storeProfileLogoFallback, { backgroundColor: colors.accent + '20' }]}>
                  <Store color={colors.accent} size={40} />
                </View>
              )}
              <Text style={[styles.storeProfileName, { color: colors.text }]}>{storeInfo.name}</Text>
              {!!storeInfo.desc && (
                <Text style={[styles.storeProfileDesc, { color: colors.textMuted }]} numberOfLines={3}>{storeInfo.desc}</Text>
              )}
            </View>
            <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
              {['Toko', 'Produk', 'Kategori', 'Ulasan'].map(tab => {
                const isActive = activeTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tabBtn, isActive && { borderBottomColor: colors.accent }]}
                    onPress={() => {
                      setActiveTab(tab);
                      if (tab !== 'Produk') setSelectedCategory('');
                    }}
                  >
                    <Text style={[styles.tabText, { color: isActive ? colors.accent : colors.textMuted }, isActive && styles.tabTextActive]}>
                      {tab}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {activeTab === 'Toko' && displayedData.length > 0 && (
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Produk Unggulan</Text>
            )}
          </View>
        }
      />
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
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'System',
    fontSize: 14,
  },
  storeProfileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  storeProfileLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  storeProfileLogoFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeProfileName: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'System',
    marginBottom: 8,
  },
  storeProfileDesc: {
    fontSize: 13,
    textAlign: 'center',
    fontFamily: 'System',
    lineHeight: 20,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontFamily: 'System',
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: CARD_MARGIN,
    marginTop: 8,
    marginBottom: 8,
  },
  listContainer: {
    padding: CARD_MARGIN,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: CARD_MARGIN * 2,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 16,
    letterSpacing: 2,
  },
  cardContent: {
    padding: 12,
  },
  productName: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 4,
    height: 36,
  },
  priceContainer: {
    marginBottom: 4,
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
  emptyState: {
    paddingTop: 80,
    alignItems: 'center',
  },
  emptyStateText: {
    fontFamily: 'System',
    fontSize: 14,
  },
  categoryCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    marginHorizontal: CARD_MARGIN,
  },
  categoryName: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '500',
  },
});
