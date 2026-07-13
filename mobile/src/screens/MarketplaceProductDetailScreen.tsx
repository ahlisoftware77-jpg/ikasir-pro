import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Dimensions, Linking, Alert, FlatList, Modal, Share } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Store, MessageCircle, ShoppingBag, ShoppingCart, Minus, Plus, Tag, X, Share2 } from 'lucide-react-native';
import { db, primaryDb, getTenantDb } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { Star } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function MarketplaceProductDetailScreen({ route, navigation }: any) {
  const { productId, storeId: routeStoreId } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [product, setProduct] = useState<any>(null);
  const [storePhone, setStorePhone] = useState('');
  const [storeLogo, setStoreLogo] = useState('');
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const addToCart = useCartStore((state) => state.addToCart);
  const cartItems = useCartStore((state) => state.items);
  
  const { user } = useAuthStore();
  const [reviews, setReviews] = useState<any[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [averageRating, setAverageRating] = useState(0);
  const [isCartModalVisible, setIsCartModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'cart' | 'buy'>('cart');
  const [productExtras, setProductExtras] = useState<any[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<Record<string, any[]>>({});

  useEffect(() => {
    fetchProductDetail();
  }, [productId]);

  const fetchProductDetail = async () => {
    try {
      let tDb = db;
      if (routeStoreId) {
        const sRefPrimary = doc(primaryDb, 'stores', routeStoreId);
        const sSnapPrimary = await getDoc(sRefPrimary);
        if (sSnapPrimary.exists()) {
          const cfg = sSnapPrimary.data().infraConfig;
          tDb = cfg ? getTenantDb(cfg) : primaryDb;
        } else {
          // Fallback if routeStoreId is actually a projectId
          const storesQ = query(collection(primaryDb || db, 'stores'));
          const storesSnap = await getDocs(storesQ);
          storesSnap.forEach(d => {
            const cfg = d.data().infraConfig;
            if (cfg && cfg.projectId === routeStoreId) {
              tDb = getTenantDb(cfg);
            }
          });
        }
      }

      const pRef = doc(tDb, 'products', productId);
      const pSnap = await getDoc(pRef);
      
      if (pSnap.exists()) {
        const pData = pSnap.data();
        
        // Fetch active discounts for this product
        const dq = query(collection(tDb, 'discounts'), where('isActive', '==', true));
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
        
        // Fetch extras if any
        if (pData.hasExtras && pData.extras && pData.extras.length > 0) {
          const exts: any[] = [];
          for (const extraId of pData.extras) {
            const eRef = doc(tDb, 'product_extras', extraId);
            const eSnap = await getDoc(eRef);
            if (eSnap.exists()) {
              exts.push({ id: eSnap.id, ...eSnap.data() });
            }
          }
          setProductExtras(exts);
        }

        // Fetch store settings for WhatsApp number
        if (pData.storeId) {
          const sRef = doc(tDb, 'settings', `store_${pData.storeId}`);
          const sSnap = await getDoc(sRef);
          if (sSnap.exists()) {
            setStorePhone(sSnap.data().phone || '');
            setStoreLogo(sSnap.data().logoUrl || '');
          }
        }
      }

      // Fetch Reviews
      const rQuery = query(collection(tDb, 'reviews'), where('productId', '==', productId));
      const rSnap = await getDocs(rQuery);
      const fetchedReviews = rSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setReviews(fetchedReviews);
      
      if (fetchedReviews.length > 0) {
        const sum = fetchedReviews.reduce((acc, curr) => acc + curr.rating, 0);
        setAverageRating(sum / fetchedReviews.length);
      }

      // Check if user can review
      if (user) {
        const userId = user.uid || user.phone;
        const oQuery = query(collection(tDb, 'transactions'), where('customerId', '==', userId), where('orderStatus', '==', 'completed'));
        const oSnap = await getDocs(oQuery);
        let hasPurchased = false;
        oSnap.docs.forEach(doc => {
          const oData = doc.data();
          if (oData.items && oData.items.some((item: any) => item.id === productId || item.productId === productId)) {
            hasPurchased = true;
          }
        });
        const hasReviewed = fetchedReviews.some(r => r.userId === userId);
        setCanReview(hasPurchased && !hasReviewed);
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

  const handleToggleExtra = (group: any, option: any) => {
    setSelectedExtras(prev => {
      const currentGroupSelected = prev[group.id] || [];
      const isAlreadySelected = currentGroupSelected.some(s => s.name === option.name);
      
      let nextSelected = [...currentGroupSelected];
      
      if (isAlreadySelected) {
        nextSelected = nextSelected.filter(s => s.name !== option.name);
      } else {
        if (!group.allowMultiple) {
          nextSelected = [option];
        } else {
          if (group.hasMaxLimit && nextSelected.length >= group.maxLimit) {
            Alert.alert('Batas Maksimal', `Anda hanya bisa memilih maksimal ${group.maxLimit} opsi.`);
            return prev;
          }
          nextSelected.push(option);
        }
      }
      
      return { ...prev, [group.id]: nextSelected };
    });
  };

  const getFormattedExtras = () => {
    const formatted: any[] = [];
    Object.keys(selectedExtras).forEach(groupId => {
      const group = productExtras.find(g => g.id === groupId);
      if (group) {
        selectedExtras[groupId].forEach(opt => {
          formatted.push({
            groupName: group.name,
            name: opt.name,
            price: Number(opt.price) || 0
          });
        });
      }
    });
    return formatted;
  };

  const getExtraPriceTotal = () => {
    let total = 0;
    Object.values(selectedExtras).forEach(arr => {
      arr.forEach((opt: any) => total += opt.price || 0);
    });
    return total;
  };

  const getDisplayPrice = () => {
    const extraTotal = getExtraPriceTotal();
    const unitPrice = finalPrice + extraTotal;
    
    if (extraTotal > 0 || productExtras.length === 0) {
       return `Rp ${unitPrice.toLocaleString('id-ID')}`;
    }
    
    if (finalPrice === 0 && productExtras.length > 0) {
      let minExtra = 0;
      let maxExtra = 0;
      
      productExtras.forEach(group => {
        if (group.options && group.options.length > 0) {
          const prices = group.options.map((opt: any) => Number(opt.price) || 0);
          const minOpt = Math.min(...prices);
          const maxOpt = Math.max(...prices);
          const totalAll = prices.reduce((a: number,b: number) => a+b, 0);
          
          if (group.isMandatory) {
            if (group.allowMultiple) {
              minExtra += minOpt;
              if (group.hasMaxLimit && group.maxLimit) {
                const sortedDesc = [...prices].sort((a,b) => b - a);
                const topN = sortedDesc.slice(0, group.maxLimit).reduce((a,b) => a+b, 0);
                maxExtra += topN;
              } else {
                maxExtra += totalAll;
              }
            } else {
              minExtra += minOpt;
              maxExtra += maxOpt;
            }
          } else {
            if (group.allowMultiple) {
              if (group.hasMaxLimit && group.maxLimit) {
                const sortedDesc = [...prices].sort((a,b) => b - a);
                const topN = sortedDesc.slice(0, group.maxLimit).reduce((a,b) => a+b, 0);
                maxExtra += topN;
              } else {
                maxExtra += totalAll;
              }
            } else {
              maxExtra += maxOpt;
            }
          }
        }
      });
      
      const min = finalPrice + minExtra;
      const max = finalPrice + maxExtra;
      if (min === max) {
         return `Rp ${min.toLocaleString('id-ID')}`;
      }
      return `Rp ${min.toLocaleString('id-ID')} - ${max.toLocaleString('id-ID')}`;
    }
    
    return `Rp ${unitPrice.toLocaleString('id-ID')}`;
  };

  const handleAddToCart = () => {
    if (product) {
      let finalPrice = product.price;
      if (product.discount) {
        finalPrice = product.discount.type === 'percent' 
          ? product.price - (product.price * product.discount.value / 100)
          : Math.max(0, product.price - product.discount.value);
      }
      const totalPrice = finalPrice + getExtraPriceTotal();

      addToCart({
        productId: product.id,
        name: product.name,
        price: totalPrice,
        storeId: product.storeId || 'unknown',
        storeName: product.storeName || 'Toko Mitra',
        imageUrl: product.imageUrl || product.imageUrls?.[0],
        stock: product.stock || 999,
        extras: getFormattedExtras()
      });
      useCartStore.getState().setQty(product.id, qty);
      Alert.alert('Sukses', 'Produk berhasil ditambahkan ke keranjang');
      setIsCartModalVisible(false);
    }
  };

  const handleBuyNow = () => {
    if (product) {
      let finalPrice = product.price;
      if (product.discount) {
        finalPrice = product.discount.type === 'percent' 
          ? product.price - (product.price * product.discount.value / 100)
          : Math.max(0, product.price - product.discount.value);
      }
      const totalPrice = finalPrice + getExtraPriceTotal();

      addToCart({
        productId: product.id,
        name: product.name,
        price: totalPrice,
        storeId: product.storeId || 'unknown',
        storeName: product.storeName || 'Toko Mitra',
        imageUrl: product.imageUrl || product.imageUrls?.[0],
        stock: product.stock || 999,
        extras: getFormattedExtras()
      });
      useCartStore.getState().setQty(product.id, qty);
      setIsCartModalVisible(false);
      navigation.navigate('MarketplaceCheckoutScreen', { storeId: product.storeId });
    }
  };

  const validateAndOpenModal = (type: 'cart' | 'buy') => {
    // Validate mandatory extras
    if (productExtras.length > 0) {
      for (const group of productExtras) {
        if (group.isMandatory) {
          const selectedForGroup = selectedExtras[group.id] || [];
          if (selectedForGroup.length === 0) {
            Alert.alert('Perhatian', `Mohon pilih opsi untuk: ${group.name}`);
            return;
          }
        }
      }
    }
    setModalType(type);
    setQty(1);
    setIsCartModalVisible(true);
  };

  const handleShare = async () => {
    if (!product) return;
    try {
      const shareUrl = `https://ikasir.my.id/marketplace/${product.id}?s=${routeStoreId || product.storeId}`;
      const message = `Lihat ${product.name} di iKasir Pro!\n\nHarga: Rp ${product.price?.toLocaleString('id-ID')}\n\nBelanja sekarang:\n${shareUrl}`;
      
      await Share.share({
        message,
        title: product.name,
      });
    } catch (error: any) {
      Alert.alert('Error', 'Gagal membagikan produk: ' + error.message);
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
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={() => navigation.navigate('CartScreen')} style={styles.backBtn}>
            <ShoppingCart color={colors.text} size={22} />
            {cartItems.length > 0 && (
              <View style={[styles.notificationBadge, { right: 4, top: 4, backgroundColor: '#ef4444' }]} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.backBtn}>
            <Share2 color={colors.text} size={22} />
          </TouchableOpacity>
        </View>
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
          {reviews.length > 0 && (
            <View style={styles.ratingSummary}>
              <Star color="#f59e0b" fill="#f59e0b" size={16} />
              <Text style={[styles.ratingText, { color: colors.text }]}>
                {averageRating.toFixed(1)} <Text style={{ color: colors.textMuted }}>({reviews.length} ulasan)</Text>
              </Text>
            </View>
          )}
          {hasDiscount ? (
            <View style={styles.detailPriceContainer}>
              <Text style={[styles.detailOriginalPrice, { color: colors.textMuted }]}>
                Rp {product.price.toLocaleString('id-ID')}
              </Text>
              <Text style={[styles.productPrice, { color: colors.accent }]}>
                {getDisplayPrice()}
              </Text>
            </View>
          ) : (
            <Text style={[styles.productPrice, { color: colors.accent }]}>
              {getDisplayPrice()}
            </Text>
          )}

          <TouchableOpacity 
            style={[styles.storeRow, { borderTopColor: colors.border, borderBottomColor: colors.border }]}
            onPress={() => {
              if (product.storeId) {
                navigation.navigate('MarketplaceStore', { storeId: product.storeId, storeName: product.storeName });
              }
            }}
          >
            {storeLogo ? (
              <Image source={{ uri: storeLogo }} style={styles.storeRowLogo} />
            ) : (
              <Store color={colors.text} size={20} opacity={0.7} />
            )}
            <Text style={[styles.storeName, { color: colors.text }]}>{product.storeName || 'Toko Mitra'}</Text>
          </TouchableOpacity>

          <View style={styles.descSection}>
            <Text style={[styles.descTitle, { color: colors.text }]}>Deskripsi Produk</Text>
            <Text style={[styles.descText, { color: colors.text }]}>
              {product.description || 'Tidak ada deskripsi.'}
            </Text>
          </View>
        </View>

        {productExtras.length > 0 && (
          <View style={[styles.infoSection, { backgroundColor: colors.surface, marginTop: 8 }]}>
            <Text style={[styles.descTitle, { color: colors.text, marginBottom: 12 }]}>Pilihan Tambahan</Text>
            {productExtras.map((extraGroup) => (
              <View key={extraGroup.id} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <View>
                    <Text style={{ fontWeight: 'bold', color: colors.text, fontSize: 14 }}>{extraGroup.name}</Text>
                    {extraGroup.allowMultiple && extraGroup.hasMaxLimit && (
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>Maks. {extraGroup.maxLimit} pilihan</Text>
                    )}
                  </View>
                  {extraGroup.isMandatory ? (
                    <View style={{ backgroundColor: '#ef444420', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ fontSize: 10, color: '#ef4444', fontWeight: 'bold' }}>WAJIB</Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>Opsional</Text>
                  )}
                </View>
                
                {extraGroup.options.map((opt: any, idx: number) => {
                  const isSelected = selectedExtras[extraGroup.id]?.some(s => s.name === opt.name);
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => handleToggleExtra(extraGroup, opt)}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        borderWidth: 1,
                        borderColor: isSelected ? colors.accent : colors.border,
                        borderRadius: 12,
                        marginBottom: 8,
                        backgroundColor: isSelected ? (colors.accent + '15') : 'transparent'
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ 
                          width: 18, height: 18, borderRadius: extraGroup.allowMultiple ? 4 : 9, 
                          borderWidth: 1.5, borderColor: isSelected ? colors.accent : colors.border,
                          marginRight: 12, justifyContent: 'center', alignItems: 'center',
                          backgroundColor: isSelected ? colors.accent : 'transparent'
                        }}>
                          {isSelected && <View style={{ width: 8, height: 8, borderRadius: extraGroup.allowMultiple ? 2 : 4, backgroundColor: '#fff' }} />}
                        </View>
                        <Text style={{ color: isSelected ? colors.accent : colors.text, fontWeight: isSelected ? '600' : 'normal', fontSize: 14 }}>{opt.name}</Text>
                      </View>
                      {Number(opt.price) > 0 && (
                        <Text style={{ color: isSelected ? colors.accent : colors.textMuted, fontSize: 13 }}>+Rp {Number(opt.price).toLocaleString('id-ID')}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        )}

        <View style={[styles.reviewSection, { backgroundColor: colors.surface }]}>
          <View style={styles.reviewHeader}>
            <Text style={[styles.descTitle, { color: colors.text, marginBottom: 0 }]}>Ulasan Produk</Text>
            {canReview && (
              <TouchableOpacity onPress={() => navigation.navigate('MarketplaceWriteReview', { productId, productName: product.name, storeId: product.storeId })}>
                <Text style={{ color: colors.accent, fontWeight: 'bold' }}>Tulis Ulasan</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {reviews.length === 0 ? (
            <Text style={[styles.descText, { color: colors.textMuted, marginTop: 12 }]}>Belum ada ulasan untuk produk ini.</Text>
          ) : (
            <View style={styles.reviewList}>
              {reviews.slice(0, 3).map(review => (
                <View key={review.id} style={[styles.reviewCard, { borderBottomColor: colors.border }]}>
                  <View style={styles.reviewUserRow}>
                    <Text style={[styles.reviewUserName, { color: colors.text }]}>{review.userName || 'Pengguna'}</Text>
                    <View style={styles.reviewStars}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star key={star} color={star <= review.rating ? '#f59e0b' : colors.border} fill={star <= review.rating ? '#f59e0b' : 'transparent'} size={12} />
                      ))}
                    </View>
                  </View>
                  {!!review.comment && (
                    <Text style={[styles.reviewComment, { color: colors.text }]}>{review.comment}</Text>
                  )}
                </View>
              ))}
              {reviews.length > 3 && (
                <TouchableOpacity style={styles.viewAllReviewsBtn}>
                  <Text style={{ color: colors.accent, textAlign: 'center', fontWeight: 'bold' }}>Lihat Semua Ulasan</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom || 16, flexDirection: 'row', gap: 8 }]}>
        <TouchableOpacity 
          style={[styles.actionBtn, { backgroundColor: colors.bg, flex: 0, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border }]} 
          onPress={handleWhatsApp}
        >
          <MessageCircle color={colors.text} size={20} />
        </TouchableOpacity>

        {outOfStock ? (
          <View style={[styles.actionBtn, { backgroundColor: colors.border, flex: 1 }]}>
            <Text style={[styles.actionBtnText, { color: colors.textMuted }]}>STOK HABIS</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: colors.surface, flex: 1, borderWidth: 1, borderColor: colors.accent }]} 
              onPress={() => validateAndOpenModal('cart')}
              activeOpacity={0.8}
            >
              <ShoppingCart color={colors.accent} size={20} />
              <Text style={[styles.actionBtnText, { color: colors.accent }]}>Keranjang</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: colors.accent, flex: 1 }]} 
              onPress={() => validateAndOpenModal('buy')}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>Beli Sekarang</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Modal
        visible={isCartModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsCartModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBgTouch} 
            activeOpacity={1} 
            onPress={() => setIsCartModalVisible(false)} 
          />
          <View style={[styles.modalContent, { backgroundColor: colors.surface, paddingBottom: (insets.bottom || 16) + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {modalType === 'cart' ? 'Masukkan Keranjang' : 'Beli Sekarang'}
              </Text>
              <TouchableOpacity onPress={() => setIsCartModalVisible(false)}>
                <X color={colors.textMuted} size={24} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalProductInfo}>
              {product.imageUrl ? (
                <Image source={{ uri: product.imageUrl }} style={styles.modalProductImage} />
              ) : (
                <View style={[styles.modalProductImage, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
                  <ShoppingBag color={colors.border} size={24} />
                </View>
              )}
              <View style={styles.modalProductDetails}>
                <Text style={[styles.modalProductName, { color: colors.text }]} numberOfLines={2}>
                  {product.name}
                </Text>
                <Text style={[styles.modalProductPrice, { color: colors.accent }]}>
                  {getDisplayPrice()}
                </Text>
                {product.manageStock !== false && (
                  <Text style={[styles.modalProductStock, { color: colors.textMuted }]}>
                    Sisa Stok: <Text style={{ color: colors.text, fontWeight: 'bold' }}>{product.stock || 0}</Text>
                  </Text>
                )}
              </View>
            </View>

            <View style={[styles.modalQtySection, { borderTopColor: colors.border }]}>
              <Text style={[styles.modalQtyLabel, { color: colors.text }]}>Jumlah</Text>
              <View style={[styles.qtySelector, { borderColor: colors.border }]}>
                <TouchableOpacity onPress={() => setQty(Math.max(1, qty - 1))} style={styles.qtyBtn}>
                  <Minus color={colors.text} size={16} />
                </TouchableOpacity>
                <Text style={[styles.qtyText, { color: colors.text }]}>{qty}</Text>
                <TouchableOpacity 
                  onPress={() => {
                    if (product.manageStock !== false && qty >= (product.stock || 0)) {
                      Alert.alert('Info', 'Stok terbatas!');
                      return;
                    }
                    setQty(qty + 1);
                  }} 
                  style={styles.qtyBtn}
                >
                  <Plus color={colors.text} size={16} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: colors.accent, width: '100%', flex: 0, paddingVertical: 14, minHeight: 48 }]} 
              onPress={modalType === 'cart' ? handleAddToCart : handleBuyNow}
            >
              <Text style={{ color: '#ffffff', fontFamily: 'System', fontWeight: '800', fontSize: 14, textAlign: 'center' }}>
                {modalType === 'cart' ? 'Masukkan Keranjang' : 'Beli Sekarang'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
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
  storeRowLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
  },
  ratingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    marginTop: -4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  reviewSection: {
    padding: 20,
    marginTop: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewList: {
    marginTop: 16,
  },
  reviewCard: {
    borderBottomWidth: 1,
    paddingBottom: 16,
    marginBottom: 16,
  },
  reviewUserRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewUserName: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
  },
  viewAllReviewsBtn: {
    paddingVertical: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBgTouch: {
    flex: 1,
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: 'System',
    fontWeight: '800',
    fontSize: 18,
  },
  modalProductInfo: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  modalProductImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
  },
  modalProductDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  modalProductName: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 4,
  },
  modalProductPrice: {
    fontFamily: 'System',
    fontWeight: '900',
    fontSize: 18,
    marginBottom: 4,
  },
  modalProductStock: {
    fontSize: 12,
  },
  modalQtySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    marginBottom: 16,
  },
  modalQtyLabel: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 16,
  },
});
