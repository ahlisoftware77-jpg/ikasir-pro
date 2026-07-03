import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Store, Trash2, Minus, Plus, ShoppingBag } from 'lucide-react-native';
import { useCartStore, CartItem } from '../store/cartStore';

export default function CartScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  const { items, updateQty, removeFromCart, clearStoreCart } = useCartStore();

  // Group items by storeId
  const groupedItems = useMemo(() => {
    const groups: { [key: string]: { storeName: string; items: CartItem[] } } = {};
    items.forEach(item => {
      if (!groups[item.storeId]) {
        groups[item.storeId] = { storeName: item.storeName, items: [] };
      }
      groups[item.storeId].items.push(item);
    });
    return Object.entries(groups).map(([storeId, data]) => ({
      storeId,
      ...data
    }));
  }, [items]);

  const renderCartItem = (item: CartItem) => (
    <View key={item.productId} style={[styles.cartItem, { borderBottomColor: colors.border }]}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
      ) : (
        <View style={[styles.itemImagePlaceholder, { backgroundColor: colors.border }]}>
          <ShoppingBag color={colors.textMuted} size={20} />
        </View>
      )}
      
      <View style={styles.itemDetails}>
        <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={[styles.itemPrice, { color: colors.accent }]}>
          Rp {item.price.toLocaleString('id-ID')}
        </Text>
        
        <View style={styles.itemActions}>
          <View style={[styles.qtyControl, { borderColor: colors.border }]}>
            <TouchableOpacity onPress={() => updateQty(item.productId, -1)} style={styles.qtyBtn}>
              <Minus color={colors.text} size={14} />
            </TouchableOpacity>
            <Text style={[styles.qtyText, { color: colors.text }]}>{item.qty}</Text>
            <TouchableOpacity onPress={() => updateQty(item.productId, 1)} style={styles.qtyBtn}>
              <Plus color={colors.text} size={14} />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity onPress={() => removeFromCart(item.productId)} style={styles.deleteBtn}>
            <Trash2 color="#ef4444" size={18} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderStoreGroup = ({ item: group }: any) => {
    const storeTotal = group.items.reduce((acc: number, cur: CartItem) => acc + (cur.price * cur.qty), 0);
    
    return (
      <View style={[styles.storeGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.storeHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.storeTitleRow}>
            <Store color={colors.text} size={20} />
            <Text style={[styles.storeName, { color: colors.text }]}>{group.storeName}</Text>
          </View>
          <TouchableOpacity onPress={() => clearStoreCart(group.storeId)}>
            <Trash2 color={colors.textMuted} size={18} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.itemsList}>
          {group.items.map((cartItem: CartItem) => renderCartItem(cartItem))}
        </View>
        
        <View style={[styles.storeFooter, { borderTopColor: colors.border }]}>
          <View>
            <Text style={[styles.subtotalLabel, { color: colors.textMuted }]}>Subtotal</Text>
            <Text style={[styles.subtotalValue, { color: colors.text }]}>
              Rp {storeTotal.toLocaleString('id-ID')}
            </Text>
          </View>
          <TouchableOpacity 
            style={[styles.checkoutBtn, { backgroundColor: colors.accent }]}
            onPress={() => navigation.navigate('MarketplaceCheckoutScreen', { storeId: group.storeId })}
          >
            <Text style={styles.checkoutBtnText}>Checkout</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Keranjang Belanja</Text>
        <View style={{ width: 24 }} />
      </View>

      {groupedItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ShoppingBag color={colors.border} size={64} opacity={0.5} style={{ marginBottom: 16 }} />
          <Text style={{ color: colors.textMuted }}>Keranjang belanja kosong</Text>
        </View>
      ) : (
        <FlatList
          data={groupedItems}
          keyExtractor={(item) => item.storeId}
          renderItem={renderStoreGroup}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeGroup: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  storeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storeName: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 14,
  },
  itemsList: {
    paddingHorizontal: 12,
  },
  cartItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
  },
  itemImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  itemName: {
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: 13,
  },
  itemPrice: {
    fontFamily: 'System',
    fontWeight: '800',
    fontSize: 14,
    marginTop: 4,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
  },
  qtyBtn: {
    padding: 6,
  },
  qtyText: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 13,
    minWidth: 24,
    textAlign: 'center',
  },
  deleteBtn: {
    padding: 6,
  },
  storeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
  },
  subtotalLabel: {
    fontFamily: 'System',
    fontSize: 12,
  },
  subtotalValue: {
    fontFamily: 'System',
    fontWeight: '800',
    fontSize: 16,
  },
  checkoutBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  checkoutBtnText: {
    color: '#fff',
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 14,
  }
});
