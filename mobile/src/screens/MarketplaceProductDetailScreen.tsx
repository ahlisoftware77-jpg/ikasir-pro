import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Dimensions, Linking, Alert, FlatList } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Store, MessageCircle, ShoppingBag, ShoppingCart, Minus, Plus, Tag } from 'lucide-react-native';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useCartStore } from '../store/cartStore';

const { width } = Dimensions.get('window');

export default function MarketplaceProductDetailScreen({ route, navigation }: any) {
  const { productId } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [product, setProduct] = useState<any>(null);
  const [storePhone, setStorePhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const addToCart = useCartStore((state) => state.addToCart);

  useEffect(() => {
    fetchProductDetail();
  }, [productId]);

  const fetchProductDetail = async () => {
    try {
      const pRef = doc(db, 'products', productId);
      const pSnap = await getDoc(pRef);
      
      if (pSnap.exists()) {
        const pData = pSnap.data();
        
        // Fetch active discounts for this product
        const dq = query(collection(db, 'discounts'), where('isActive', '==', true));
        const dSnap = await getDocs(dq);
        const activeDiscounts = dSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        const now = new Date();
        let appliedDiscount = null;
        activeDiscounts.forEach(disc => {
          const start = new Date(disc.startDate);
          const end = new Date(disc.endDate);
          if (now >= start && now <= end) {
            if (disc.appliedProductIds?.includes(productId)) {
              appliedDiscount = { type: disc.type, value: disc.value, name: disc.name };
            }
          }
        });
        if (appliedDiscount) pData.discount = appliedDiscount;

        setProduct({ id: pSnap.id, ...pData });
        
        // Fetch store settings for WhatsApp number
        if (pData.storeId) {
          const sRef = doc(db, 'settings', `store_${pData.storeId}`);
          const sSnap = await getDoc(sRef);
          if (sSnap.exists()) {
            setStorePhone(sSnap.data().phone || '');
          }
        }
      }
    } catch (err) {
      console.error('Error fetching product detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsApp = () => {
    if (!storePhone) {
      Alert.alert('Info', 'Nomor telepon toko tidak tersedia.');
      return;
    }

    let formattedPhone = storePhone.replace(/[^0-9]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.slice(1);
    }

    const message = `Halo, saya tertarik dengan produk ini dari Marketplace iKasir:\n\n*${product?.name}*\nHarga: Rp ${product?.price?.toLocaleString('id-ID')}\n\nApakah barang ini masih tersedia?`;
    const url = `whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`;
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Error', 'WhatsApp tidak terpasang di perangkat ini.');
      }
    });
  };

  const handleAddToCart = () => {
    if (product) {
      addToCart({
        productId: product.id,
        name: product.name,
        price: product.price,
        storeId: product.storeId || 'unknown',
        storeName: product.storeName || 'Toko Mitra',
        imageUrl: product.imageUrl || product.imageUrls?.[0],
        stock: product.stock || 999
      });
      useCartStore.getState().setQty(product.id, qty);
      Alert.alert('Sukses', 'Produk berhasil ditambahkan ke keranjang');
      navigation.goBack();
    }
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.text }}>Produk tidak ditemukan.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
          <Text style={{ color: colors.accent }}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const outOfStock = product.manageStock !== false && (product.stock || 0) <= 0;
  let finalPrice = product.price;
  let hasDiscount = !!product.discount;
  if (hasDiscount) {
    if (product.discount.type === 'percent') {
      finalPrice = product.price - (product.price * product.discount.value / 100);
    } else {
      finalPrice = Math.max(0, product.price - product.discount.value);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Detail Produk</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={[styles.imageContainer, { backgroundColor: colors.surface }]}>
          {(() => {
            const mediaItems = [];
            if (product.videoUrl) mediaItems.push({ type: 'video', url: product.videoUrl });
            
            // Periksa media array (jika ada)
            if (product.media && product.media.length > 0) {
              product.media.forEach((m: any) => {
                const url = m.url || m;
                const isVid = typeof url === 'string' && url.toLowerCase().match(/\.(mp4|mov|webm)(\?.*)?$/i);
                mediaItems.push({ type: m.type === 'video' || isVid ? 'video' : 'image', url });
              });
            } else {
              if (product.imageUrls && product.imageUrls.length > 0) {
                product.imageUrls.forEach((url: string) => {
                  const isVid = url.toLowerCase().match(/\.(mp4|mov|webm)(\?.*)?$/i);
                  mediaItems.push({ type: isVid ? 'video' : 'image', url });
                });
              } else if (product.imageUrl) {
                const isVid = product.imageUrl.toLowerCase().match(/\.(mp4|mov|webm)(\?.*)?$/i);
                mediaItems.push({ type: isVid ? 'video' : 'image', url: product.imageUrl });
              }
            }

            if (mediaItems.length === 0) {
              return <ShoppingBag color={colors.border} size={64} opacity={0.5} />;
            }

            return (
              <FlatList
                data={mediaItems}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={true}
                keyExtractor={(item, index) => `${item.type}-${index}`}
                renderItem={({ item }) => (
                  <View style={{ width: width, height: width, justifyContent: 'center', alignItems: 'center' }}>
                    {item.type === 'video' ? (
                      <Video
                        style={{ width: width, height: width }}
                        source={{ uri: item.url }}
                        useNativeControls
                        resizeMode={ResizeMode.CONTAIN}
                        isLooping
                      />
                    ) : (
                      <Image source={{ uri: item.url }} style={styles.image} resizeMode="contain" />
                    )}
                  </View>
                )}
              />
            );
          })()}
        </View>

        <View style={[styles.infoSection, { backgroundColor: colors.surface }]}>
          {hasDiscount && (
            <View style={styles.detailDiscountBadge}>
              <Tag color="#fff" size={12} style={{ marginRight: 4 }} />
              <Text style={styles.detailDiscountText}>
                {product.discount.type === 'percent' ? `${product.discount.value}% OFF` : `-${(product.discount.value / 1000)}K`}
              </Text>
            </View>
          )}
          <Text style={[styles.productName, { color: colors.text }]}>{product.name}</Text>
          {hasDiscount ? (
            <View style={styles.detailPriceContainer}>
              <Text style={[styles.detailOriginalPrice, { color: colors.textMuted }]}>
                Rp {product.price.toLocaleString('id-ID')}
              </Text>
              <Text style={[styles.productPrice, { color: colors.accent }]}>
                Rp {finalPrice.toLocaleString('id-ID')}
              </Text>
            </View>
          ) : (
            <Text style={[styles.productPrice, { color: colors.accent }]}>
              Rp {product.price.toLocaleString('id-ID')}
            </Text>
          )}

          <View style={[styles.storeRow, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
            <Store color={colors.text} size={20} opacity={0.7} />
            <Text style={[styles.storeName, { color: colors.text }]}>{product.storeName || 'Toko Mitra'}</Text>
          </View>

          <View style={styles.descSection}>
            <Text style={[styles.descTitle, { color: colors.text }]}>Deskripsi Produk</Text>
            <Text style={[styles.descText, { color: colors.text }]}>
              {product.description || 'Tidak ada deskripsi.'}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom || 16, flexDirection: 'row', gap: 12 }]}>
        {outOfStock ? (
          <View style={[styles.actionBtn, { backgroundColor: colors.border, flex: 1 }]}>
            <Text style={[styles.actionBtnText, { color: colors.textMuted }]}>STOK HABIS</Text>
          </View>
        ) : (
          <>
            <View style={[styles.qtySelector, { borderColor: colors.border }]}>
              <TouchableOpacity onPress={() => setQty(Math.max(1, qty - 1))} style={styles.qtyBtn}>
                <Minus color={colors.text} size={16} />
              </TouchableOpacity>
              <Text style={[styles.qtyText, { color: colors.text }]}>{qty}</Text>
              <TouchableOpacity 
                onPress={() => setQty(Math.min(product.stock || 999, qty + 1))} 
                style={styles.qtyBtn}
              >
                <Plus color={colors.text} size={16} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: colors.accent, flex: 1 }]} 
              onPress={handleAddToCart}
              activeOpacity={0.8}
            >
              <ShoppingCart color="#fff" size={20} />
              <Text style={styles.actionBtnText}>Tambah ke Keranjang</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  backBtn: {
    padding: 4,
    marginLeft: -4,
  },
  headerTitle: {
    fontFamily: 'System',
    fontWeight: '800',
    fontSize: 16,
  },
  imageContainer: {
    width: width,
    height: width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  infoSection: {
    padding: 20,
    marginTop: 8,
  },
  productName: {
    fontFamily: 'System',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  detailPriceContainer: {
    marginBottom: 12,
  },
  detailOriginalPrice: {
    fontSize: 14,
    textDecorationLine: 'line-through',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 24,
    fontWeight: '900',
  },
  detailDiscountBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  detailDiscountText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  storeName: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 12,
  },
  descSection: {
    marginTop: 8,
  },
  descTitle: {
    fontFamily: 'System',
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 8,
  },
  descText: {
    fontFamily: 'System',
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.8,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionBtnText: {
    color: '#fff',
    fontFamily: 'System',
    fontWeight: '800',
    fontSize: 14,
  },
  qtySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 4,
    height: 48,
  },
  qtyBtn: {
    padding: 10,
  },
  qtyText: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 16,
    minWidth: 24,
    textAlign: 'center',
  }
});
