import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert, RefreshControl, Vibration, Pressable, Image, Linking, Dimensions } from 'react-native';
import { collection, query, onSnapshot, orderBy, doc, getDoc, deleteDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../store/authStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { 
  Trash2, RotateCcw, Search, X, Info, ChevronRight, AlertTriangle, FileText, ShoppingBag, Clock, Calendar, ArrowUpDown, Package, ShieldCheck
} from 'lucide-react-native';

export default function RecycleBinScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { storeId } = useAuthStore();
  const { width: screenWidth } = Dimensions.get('window');

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'transactions' | 'products' | 'estimations'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);

    const q = query(
      collection(db, 'recycle_bin'),
      where('storeId', '==', storeId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results: any[] = [];
      snapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });
      setItems(results);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to recycle_bin:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [storeId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setRefreshing(false);
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const originalColl = item.originalCollection || '';
      const matchesSearch = item.id.toLowerCase().includes(searchText.toLowerCase()) || 
                            (item.customerName && item.customerName.toLowerCase().includes(searchText.toLowerCase())) ||
                            (item.name && item.name.toLowerCase().includes(searchText.toLowerCase())) ||
                            (item.cashierName && item.cashierName.toLowerCase().includes(searchText.toLowerCase()));
      
      if (filterType === 'all') return matchesSearch;
      return matchesSearch && originalColl === filterType;
    });
  }, [items, searchText, filterType]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const timeA = new Date(a.deletedAt).getTime();
      const timeB = new Date(b.deletedAt).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [filteredItems, sortOrder]);

  const handleRestore = async (item: any) => {
    Vibration.vibrate(15);
    setProcessing(true);
    try {
      const batch = writeBatch(db);
      const originalColl = item.originalCollection;

      if (!originalColl) {
        throw new Error('Koleksi asal dokumen tidak terdefinisi.');
      }

      const originalRef = doc(db, originalColl, item.id);
      const { deletedAt, originalCollection, ...restoredData } = item;

      batch.set(originalRef, restoredData);

      const recycleRef = doc(db, 'recycle_bin', item.id);
      batch.delete(recycleRef);

      await batch.commit();
      Alert.alert('Sukses', 'Data berhasil dipulihkan!');
      setSelectedItem(null);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', 'Gagal memulihkan data: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handlePermanentDelete = (itemId: string) => {
    Vibration.vibrate(15);
    Alert.alert(
      'Hapus Permanen',
      'PERINGATAN: Apakah Anda yakin ingin menghapus data ini secara permanen? Tindakan ini tidak dapat dibatalkan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              await deleteDoc(doc(db, 'recycle_bin', itemId));
              Alert.alert('Sukses', 'Data dihapus secara permanen.');
              setSelectedItem(null);
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Gagal menghapus data.');
            } finally {
              setProcessing(false);
            }
          }
        }
      ]
    );
  };

  const handleEmptyBin = () => {
    if (items.length === 0) return;
    Vibration.vibrate(15);
    Alert.alert(
      'Kosongkan Kotak Sampah',
      'PERINGATAN KRITIS: Apakah Anda yakin ingin mengosongkan seluruh Kotak Sampah? Semua data di dalamnya akan dihapus selamanya.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Hapus Semua',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              const batch = writeBatch(db);
              items.forEach((item) => {
                batch.delete(doc(db, 'recycle_bin', item.id));
              });
              await batch.commit();
              Alert.alert('Sukses', 'Kotak sampah berhasil dikosongkan!');
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Gagal mengosongkan kotak sampah.');
            } finally {
              setProcessing(false);
            }
          }
        }
      ]
    );
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '...';
    const date = new Date(timestamp);
    return date.toLocaleString('id-ID', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).replace(/\./g, ':');
  };

  const getLeftCardDateTime = (timestamp: any) => {
    if (!timestamp) return { day: '00', monthYear: '---', time: '00:00' };
    const date = new Date(timestamp);
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    const monthYear = `${months[date.getMonth()]} '${date.getFullYear().toString().substring(2)}`;
    const time = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');
    return { day, monthYear, time };
  };

  const getCollectionInfo = (coll: string) => {
    switch (coll) {
      case 'transactions':
        return { label: 'Transaksi', color: '#10b981', badgeBg: 'bg-emerald-500/10 border-emerald-500/20', badgeTextColor: 'text-emerald-500' };
      case 'products':
        return { label: 'Produk', color: '#3b82f6', badgeBg: 'bg-blue-500/10 border-blue-500/20', badgeTextColor: 'text-blue-500' };
      case 'estimations':
        return { label: 'Estimasi', color: '#8b5cf6', badgeBg: 'bg-purple-500/10 border-purple-500/20', badgeTextColor: 'text-purple-500' };
      default:
        return { label: coll || 'Lainnya', color: '#64748b', badgeBg: 'bg-slate-500/10 border-slate-500/20', badgeTextColor: 'text-slate-500' };
    }
  };

  const getItemDescription = (item: any) => {
    if (item.originalCollection === 'transactions') {
      return `Pelanggan: ${item.customerName || 'Umum'} • Rp ${item.total?.toLocaleString('id-ID')}`;
    }
    if (item.originalCollection === 'products') {
      return `Harga: Rp ${item.price?.toLocaleString('id-ID')} • Stok: ${item.stock || 0}`;
    }
    if (item.originalCollection === 'estimations') {
      return `Pelanggan: ${item.customerName || 'Umum'} • Est: Rp ${item.total?.toLocaleString('id-ID')}`;
    }
    return item.name || item.id;
  };

  return (
    <SafeAreaView className="flex-1" edges={['bottom']} style={{ backgroundColor: colors.bg }}>
      {loading ? (
        <LoadingSkeleton type="list" count={5} />
      ) : (
        <FlatList
          data={sortedItems}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 20 }}
          ListHeaderComponent={
            <View className="mb-4">
              {/* Search Bar */}
              <View className="flex-row items-center mb-4 px-4 py-2.5 rounded-2xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <Search size={16} color={colors.textMuted} className="mr-2" />
                <TextInput
                  className="flex-1 text-xs font-bold p-0"
                  style={{ color: colors.text }}
                  placeholder="Cari item di kotak sampah..."
                  placeholderTextColor={colors.textMuted}
                  value={searchText}
                  onChangeText={setSearchText}
                />
                {searchText !== '' && (
                  <TouchableOpacity onPress={() => setSearchText('')}>
                    <X size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Tipe Filters */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
                {[
                  { id: 'all', label: 'Semua Tipe' },
                  { id: 'transactions', label: 'Transaksi' },
                  { id: 'products', label: 'Produk' },
                  { id: 'estimations', label: 'Estimasi' }
                ].map(tab => {
                  const isActive = filterType === tab.id;
                  return (
                    <TouchableOpacity 
                      key={tab.id}
                      onPress={() => {
                        Vibration.vibrate(10);
                        setFilterType(tab.id as any);
                      }}
                      activeOpacity={0.8}
                      className="px-4 py-1.5 rounded-full border"
                      style={{
                        backgroundColor: isActive ? colors.text : colors.surface,
                        borderColor: isActive ? colors.text : colors.border,
                      }}
                    >
                      <Text className="text-[11px] font-black tracking-wide" style={{ color: isActive ? colors.bg : colors.text }}>{tab.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Utility Row (Sort, Empty Bin) */}
              <View className="flex-row justify-between items-center gap-2 mb-2">
                <TouchableOpacity 
                  onPress={() => {
                    Vibration.vibrate(10);
                    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
                  }}
                  activeOpacity={0.8}
                  className="flex-row items-center gap-1.5 px-3 py-2 rounded-full border"
                  style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                >
                  <ArrowUpDown color={colors.accent} size={11} />
                  <Text className="text-[9px] font-black uppercase tracking-wider" style={{ color: colors.text }}>
                    {sortOrder === 'desc' ? 'Terbaru' : 'Terlama'}
                  </Text>
                </TouchableOpacity>

                {items.length > 0 && (
                  <TouchableOpacity 
                    onPress={handleEmptyBin}
                    activeOpacity={0.8}
                    className="flex-row items-center gap-1.5 px-3 py-2 rounded-full border"
                    style={{ backgroundColor: 'rgba(244,63,94,0.08)', borderColor: 'rgba(244,63,94,0.15)' }}
                  >
                    <Trash2 color="#f43f5e" size={11} />
                    <Text className="text-[9px] font-black text-rose-500 uppercase tracking-wider">
                      Kosongkan Sampah
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.accent]}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item }) => {
            const { day, monthYear, time } = getLeftCardDateTime(item.deletedAt);
            const typeInfo = getCollectionInfo(item.originalCollection);

            return (
              <TouchableOpacity 
                onPress={() => {
                  Vibration.vibrate(10);
                  setSelectedItem(item);
                }}
                activeOpacity={0.7}
                className="flex-row items-stretch mb-4 rounded-3xl border overflow-hidden shadow-sm"
                style={{ 
                  backgroundColor: colors.surface, 
                  borderColor: colors.border,
                  minHeight: 90
                }}
              >
                {/* Blok Kiri: Tanggal Merah Hapus */}
                <View 
                  className="w-[84px] items-center justify-center p-2.5"
                  style={{ backgroundColor: '#f43f5e' }}
                >
                  <Text className="text-2xl font-black text-white leading-none">{day}</Text>
                  <Text className="text-[9px] font-black text-white mt-1 uppercase tracking-wider">{monthYear}</Text>
                  <Text className="text-[10px] font-bold text-white mt-1.5 tracking-tighter">{time}</Text>
                </View>

                {/* Blok Kanan: Detail Data terhapus */}
                <View className="flex-1 p-3.5 justify-between">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-[11px] font-bold text-slate-400 tracking-wider uppercase" numberOfLines={1}>
                      ID: #{item.id?.substring(0, 10).toUpperCase()}
                    </Text>
                    <View className={`px-2 py-0.5 rounded border ${typeInfo.badgeBg}`}>
                      <Text className={`text-[8px] font-black uppercase ${typeInfo.badgeTextColor}`}>
                        {typeInfo.label}
                      </Text>
                    </View>
                  </View>

                  <View className="my-1.5">
                    <Text className="text-xs font-black" style={{ color: colors.text }} numberOfLines={1}>
                      {item.name || item.customerName || 'Item Sampah'}
                    </Text>
                  </View>

                  <View className="flex-row justify-between items-end">
                    <Text className="text-[10px] font-bold text-slate-400 leading-none truncate max-w-[80%]">
                      {getItemDescription(item)}
                    </Text>
                    <ChevronRight size={14} color={colors.textMuted} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View className="items-center py-20 opacity-30">
               <Trash2 color={colors.textMuted} size={64} />
               <Text className="text-sm font-black mt-4 uppercase tracking-wider" style={{ color: colors.textMuted }}>Kotak sampah kosong</Text>
            </View>
          }
        />
      )}

      {/* DETAIL MODAL MOBILE */}
      {selectedItem && (
        <Modal visible={selectedItem !== null} animationType="slide" transparent onRequestClose={() => setSelectedItem(null)}>
          <View className="flex-1 bg-black/80 justify-end">
            <View 
              style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
              className="p-6 max-h-[85%]"
            >
              {/* Modal Header */}
              <View className="flex-row justify-between items-center mb-6 pb-4 border-b" style={{ borderColor: colors.border }}>
                <View className="flex-row items-center gap-3">
                  <View className="p-2 bg-rose-500/10 rounded-xl">
                    <Trash2 color="#f43f5e" size={20} />
                  </View>
                  <View>
                    <Text className="text-lg font-black" style={{ color: colors.text }}>Detail Kotak Sampah</Text>
                    <Text className="text-[9px] font-black uppercase tracking-wider text-slate-400 mt-0.5">ID: #{selectedItem.id}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setSelectedItem(null)} className="p-2 bg-slate-500/10 rounded-full border border-slate-500/15">
                  <X size={18} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView className="space-y-6" showsVerticalScrollIndicator={false}>
                {/* Meta details */}
                <View className="p-4 rounded-2xl border flex-row flex-wrap gap-4" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
                  <View className="w-[45%]">
                    <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tipe Dokumen</Text>
                    <Text className="font-bold text-xs mt-1 uppercase" style={{ color: colors.text }}>{getCollectionInfo(selectedItem.originalCollection).label}</Text>
                  </View>
                  <View className="w-[45%]">
                    <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Waktu Hapus</Text>
                    <Text className="font-bold text-xs mt-1" style={{ color: colors.text }}>{formatDate(selectedItem.deletedAt)}</Text>
                  </View>
                </View>

                {/* TRANSACTIONS DETAIL SPECIFIC */}
                {selectedItem.originalCollection === 'transactions' && (
                  <View className="space-y-4">
                    <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Data Transaksi</Text>
                    <View className="flex-row justify-between py-1 border-b" style={{ borderColor: colors.border + '50' }}>
                      <Text className="text-xs" style={{ color: colors.textMuted }}>Pelanggan</Text>
                      <Text className="text-xs font-bold" style={{ color: colors.text }}>{selectedItem.customerName || 'Umum'}</Text>
                    </View>
                    <View className="flex-row justify-between py-1 border-b" style={{ borderColor: colors.border + '50' }}>
                      <Text className="text-xs" style={{ color: colors.textMuted }}>Kasir / Operator</Text>
                      <Text className="text-xs font-bold" style={{ color: colors.text }}>{(selectedItem.cashierName || 'Sistem').split('@')[0]}</Text>
                    </View>
                    <View className="flex-row justify-between py-1 border-b" style={{ borderColor: colors.border + '50' }}>
                      <Text className="text-xs" style={{ color: colors.textMuted }}>Metode Pembayaran</Text>
                      <Text className="text-xs font-bold uppercase" style={{ color: colors.text }}>{selectedItem.paymentMethod || selectedItem.paymentCategory || '-'}</Text>
                    </View>
                    <View className="flex-row justify-between py-1 border-b" style={{ borderColor: colors.border + '50' }}>
                      <Text className="text-xs" style={{ color: colors.textMuted }}>Status</Text>
                      <Text className="text-xs font-bold uppercase text-emerald-500">{selectedItem.paymentStatus || 'paid'}</Text>
                    </View>

                    {/* Belanjaan */}
                    <View className="p-4 rounded-2xl mt-2" style={{ backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1 }}>
                      <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-3">Item Belanja</Text>
                      {selectedItem.items?.map((item: any, idx: number) => (
                        <View key={idx} className="flex-row justify-between py-1.5">
                          <Text className="text-xs flex-1 pr-3" style={{ color: colors.text }}>{item.qty}x {item.productName}</Text>
                          <Text className="text-xs font-bold" style={{ color: colors.text }}>Rp {(item.subtotal || (item.price * item.qty)).toLocaleString('id-ID')}</Text>
                        </View>
                      ))}
                      <View className="border-t pt-3 mt-3 flex-row justify-between items-center" style={{ borderColor: colors.border }}>
                        <Text className="text-xs font-bold" style={{ color: colors.text }}>Total Pembayaran</Text>
                        <Text className="text-base font-black text-emerald-500">Rp {selectedItem.total?.toLocaleString('id-ID')}</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* PRODUCT DETAIL SPECIFIC */}
                {selectedItem.originalCollection === 'products' && (
                  <View className="space-y-4">
                    <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Data Produk</Text>
                    <View className="flex-row justify-between py-2 border-b" style={{ borderColor: colors.border + '50' }}>
                      <Text className="text-xs" style={{ color: colors.textMuted }}>Nama Produk</Text>
                      <Text className="text-xs font-black" style={{ color: colors.text }}>{selectedItem.name}</Text>
                    </View>
                    <View className="flex-row justify-between py-2 border-b" style={{ borderColor: colors.border + '50' }}>
                      <Text className="text-xs" style={{ color: colors.textMuted }}>Harga Jual</Text>
                      <Text className="text-xs font-bold" style={{ color: colors.text }}>Rp {selectedItem.price?.toLocaleString('id-ID')}</Text>
                    </View>
                    {selectedItem.costPrice && (
                      <View className="flex-row justify-between py-2 border-b" style={{ borderColor: colors.border + '50' }}>
                        <Text className="text-xs" style={{ color: colors.textMuted }}>Harga Modal</Text>
                        <Text className="text-xs font-bold" style={{ color: colors.text }}>Rp {selectedItem.costPrice?.toLocaleString('id-ID')}</Text>
                      </View>
                    )}
                    <View className="flex-row justify-between py-2 border-b" style={{ borderColor: colors.border + '50' }}>
                      <Text className="text-xs" style={{ color: colors.textMuted }}>Stok Sisa</Text>
                      <Text className="text-xs font-bold" style={{ color: colors.text }}>{selectedItem.stock || 0}</Text>
                    </View>
                    <View className="flex-row justify-between py-2">
                      <Text className="text-xs" style={{ color: colors.textMuted }}>SKU / Barcode</Text>
                      <Text className="text-xs font-mono font-bold" style={{ color: colors.text }}>{selectedItem.sku || '-'}</Text>
                    </View>
                  </View>
                )}

                {/* ESTIMATION DETAIL SPECIFIC */}
                {selectedItem.originalCollection === 'estimations' && (
                  <View className="space-y-4">
                    <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Estimasi Biaya</Text>
                    <View className="flex-row justify-between py-1 border-b" style={{ borderColor: colors.border + '50' }}>
                      <Text className="text-xs" style={{ color: colors.textMuted }}>Pelanggan</Text>
                      <Text className="text-xs font-bold" style={{ color: colors.text }}>{selectedItem.customerName || 'Umum'}</Text>
                    </View>

                    {/* Belanjaan */}
                    <View className="p-4 rounded-2xl mt-2" style={{ backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1 }}>
                      <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-3">Item Estimasi</Text>
                      {selectedItem.items?.map((item: any, idx: number) => (
                        <View key={idx} className="flex-row justify-between py-1.5">
                          <Text className="text-xs flex-1 pr-3" style={{ color: colors.text }}>{item.qty}x {item.productName}</Text>
                          <Text className="text-xs font-bold" style={{ color: colors.text }}>Rp {(item.subtotal || (item.price * item.qty)).toLocaleString('id-ID')}</Text>
                        </View>
                      ))}
                      <View className="border-t pt-3 mt-3 flex-row justify-between items-center" style={{ borderColor: colors.border }}>
                        <Text className="text-xs font-bold" style={{ color: colors.text }}>Total Estimasi</Text>
                        <Text className="text-base font-black text-purple-500">Rp {selectedItem.total?.toLocaleString('id-ID')}</Text>
                      </View>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Action Buttons */}
              <View className="flex-row gap-3 mt-6 pt-4 border-t" style={{ borderColor: colors.border }}>
                <TouchableOpacity 
                  onPress={() => handleRestore(selectedItem)}
                  disabled={processing}
                  activeOpacity={0.8}
                  style={{ backgroundColor: colors.accent }}
                  className="flex-1 h-14 rounded-2xl items-center justify-center flex-row gap-2 active:scale-95 disabled:opacity-50"
                >
                  <RotateCcw size={16} color="#0f172a" />
                  <Text className="text-xs font-black uppercase text-slate-900">Pulihkan</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => handlePermanentDelete(selectedItem.id)}
                  disabled={processing}
                  activeOpacity={0.8}
                  className="px-5 h-14 bg-rose-500/10 rounded-2xl items-center justify-center flex-row gap-2 active:scale-95 disabled:opacity-50 border border-rose-500/20"
                >
                  <Trash2 size={16} color="#f43f5e" />
                  <Text className="text-xs font-black uppercase text-rose-500">Hapus Permanen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}
