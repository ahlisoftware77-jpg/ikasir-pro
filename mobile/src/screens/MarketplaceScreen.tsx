import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, TextInput, ActivityIndicator, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, ShoppingBag, Store, MapPin } from 'lucide-react-native';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';

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
}

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 2;
const CARD_MARGIN = 8;
const CARD_WIDTH = (width - CARD_MARGIN * (COLUMN_COUNT + 1)) / COLUMN_COUNT;

export default function MarketplaceScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [categories, setCategories] = useState<string[]>(['Semua']);
  
  // Store info
  const [storeLogos, setStoreLogos] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchMarketplaceData();
  }, []);

  const fetchMarketplaceData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'products'), where('joinMarketplace', '==', true));
      const snap = await getDocs(q);
      const list: Product[] = [];
      const uniqueStoreIds = new Set<string>();

      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          name: data.name || '',
          price: data.price || 0,
          category: data.category || 'Umum',
          imageUrl: data.imageUrl || '',
          storeId: data.storeId || '',
          storeName: data.storeName || 'Toko Mitra',
          stock: data.stock !== undefined ? data.stock : 0,
          manageStock: data.manageStock !== undefined ? data.manageStock : true,
        });
        if (data.storeId) {
          uniqueStoreIds.add(data.storeId);
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
    }
  };

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
    
    return (
      <TouchableOpacity 
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, width: CARD_WIDTH }]}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('MarketplaceProductDetail', { productId: item.id })}
      >
        <View style={[styles.imageContainer, { backgroundColor: colors.bg }]}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <ShoppingBag color={colors.text} size={32} opacity={0.3} />
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
          <Text style={[styles.productPrice, { color: colors.primary }]}>
            Rp {item.price.toLocaleString('id-ID')}
          </Text>

          <View style={[styles.storeInfo, { borderTopColor: colors.border }]}>
            {storeLogos[item.storeId] ? (
              <Image source={{ uri: storeLogos[item.storeId] }} style={styles.storeLogo} />
            ) : (
              <View style={[styles.storeLogoFallback, { backgroundColor: colors.primary + '20' }]}>
                <Store color={colors.primary} size={10} />
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
        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Search color={colors.primary} size={20} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Cari produk atau toko..."
            placeholderTextColor={colors.text + '80'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Categories */}
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
                      backgroundColor: isSelected ? colors.primary : colors.bg,
                      borderColor: isSelected ? colors.primary : colors.border
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
          <ActivityIndicator size="large" color={colors.primary} />
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
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
  productPrice: {
    fontFamily: 'System',
    fontWeight: '900',
    fontSize: 14,
    marginBottom: 8,
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
  }
});
