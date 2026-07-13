import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Star } from 'lucide-react-native';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, query, getDocs } from 'firebase/firestore';
import { db, primaryDb, getTenantDb } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';

export default function MarketplaceWriteReviewScreen({ route, navigation }: any) {
  const { productId, productName, storeId, orderId } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const maskName = (name: string) => {
    if (!name || name.length <= 2) return name;
    const firstTwo = name.substring(0, 2);
    const lastOne = name.substring(name.length - 1);
    const stars = '*'.repeat(Math.max(1, name.length - 3));
    return `${firstTwo}${stars}${lastOne}`;
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Gagal', 'Anda harus login untuk memberikan ulasan.');
      return;
    }
    
    if (rating < 1 || rating > 5) {
      Alert.alert('Error', 'Pilih rating bintang terlebih dahulu.');
      return;
    }

    if (!comment.trim()) {
      Alert.alert('Error', 'Tuliskan sedikit komentar ulasan Anda.');
      return;
    }

    setSubmitting(true);
    try {
      // Start from primaryDb as default - it always points to main project
      let tDb = primaryDb;
      if (storeId) {
        // Always look up stores from primaryDb (MAIN project) - never from tenant db
        const sRef = doc(primaryDb, 'stores', storeId);
        const sSnap = await getDoc(sRef);
        if (sSnap.exists()) {
          const cfg = sSnap.data().infraConfig;
          if (cfg) {
            tDb = getTenantDb(cfg);
            console.log('[Review] Resolved tenant db:', cfg.projectId);
          } else {
            console.log('[Review] No infraConfig found, using primaryDb');
          }
        } else {
          // Fallback: scan all stores to find by projectId
          console.log('[Review] Store not found by id, scanning all stores for projectId match...');
          const storesQ = query(collection(primaryDb, 'stores'));
          const storesSnap = await getDocs(storesQ);
          storesSnap.forEach(d => {
            const cfg = d.data().infraConfig;
            if (cfg && cfg.projectId === storeId) {
              tDb = getTenantDb(cfg);
              console.log('[Review] Resolved tenant db via fallback scan:', cfg.projectId);
            }
          });
        }
      }

      const actualName = user.name || user.phone || 'Pengguna';
      const finalName = isAnonymous ? maskName(actualName) : actualName;

      await addDoc(collection(tDb, 'reviews'), {
        productId,
        productName,
        storeId,
        userId: user.uid || user.phone || 'anonymous',
        userName: finalName,
        rating,
        comment: comment.trim(),
        orderId: orderId || null,
        createdAt: serverTimestamp(),
      });
      
      // Update product rating aggregate
      const pRef = doc(tDb, 'products', productId);
      const pSnap = await getDoc(pRef);
      if (pSnap.exists()) {
        const pData = pSnap.data();
        const currentCount = pData.reviewCount || 0;
        const currentAvg = pData.averageRating || 0;
        
        const newCount = currentCount + 1;
        const newAvg = ((currentAvg * currentCount) + rating) / newCount;
        
        await updateDoc(pRef, {
          reviewCount: newCount,
          averageRating: newAvg
        });
      }
      
      // Update order document to mark item as reviewed
      // Order might be in tDb (tenant DB) OR primaryDb — try both
      if (orderId) {
        const updateOrderReviewed = async (dbInstance: typeof tDb) => {
          const oRef = doc(dbInstance, 'transactions', orderId);
          const oSnap = await getDoc(oRef);
          if (oSnap.exists()) {
            const oData = oSnap.data();
            if (oData.items) {
              const updatedItems = oData.items.map((item: any) => {
                if (item.productId === productId || item.id === productId) {
                  return { ...item, isReviewed: true };
                }
                return item;
              });
              await updateDoc(oRef, { items: updatedItems });
            }
            return true;
          }
          return false;
        };

        // Try tenant DB first, then fall back to primaryDb
        const foundInTenant = await updateOrderReviewed(tDb);
        if (!foundInTenant) {
          const foundInPrimary = await updateOrderReviewed(primaryDb);
          if (!foundInPrimary) {
            console.warn('[Review] Order not found in any DB, orderId:', orderId);
          }
        }
      }
      
      Alert.alert('Berhasil', 'Terima kasih, ulasan Anda telah dikirim!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (err) {
      console.error('Error submitting review:', err);
      Alert.alert('Gagal', 'Terjadi kesalahan saat mengirim ulasan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.bg }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { backgroundColor: colors.surface, paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Tulis Ulasan</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.productLabel, { color: colors.textMuted }]}>Mengulas Produk:</Text>
        <Text style={[styles.productName, { color: colors.text }]}>{productName}</Text>
        
        <View style={styles.ratingContainer}>
          <Text style={[styles.ratingLabel, { color: colors.text }]}>Beri Nilai Kualitas Produk:</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity key={star} onPress={() => setRating(star)} style={styles.starBtn} activeOpacity={0.7}>
                <Star 
                  color={star <= rating ? '#f59e0b' : colors.border} 
                  fill={star <= rating ? '#f59e0b' : 'transparent'} 
                  size={46} 
                />
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 ? (
            <View style={[styles.ratingLabelBadge, { backgroundColor: '#fef3c7' }]}>
              <Text style={styles.ratingLabelText}>
                {rating === 1 ? 'Sangat Buruk 😞' : rating === 2 ? 'Buruk 😕' : rating === 3 ? 'Cukup 😐' : rating === 4 ? 'Baik 🙂' : 'Sangat Baik 🤩'}
              </Text>
            </View>
          ) : (
            <View style={[styles.ratingLabelBadge, { backgroundColor: colors.border }]}>
              <Text style={[styles.ratingLabelText, { color: colors.textMuted }]}>Pilih Rating</Text>
            </View>
          )}
        </View>

        <Text style={[styles.commentLabel, { color: colors.text }]}>Tulis Komentar Ulasan:</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, marginBottom: 16 }]}
          placeholder="Tuliskan pendapat Anda tentang produk ini..."
          placeholderTextColor={colors.text + '80'}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          value={comment}
          onChangeText={setComment}
        />

        <TouchableOpacity 
          style={styles.anonymousToggle} 
          onPress={() => setIsAnonymous(!isAnonymous)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: isAnonymous ? colors.accent : 'transparent' }]}>
            {isAnonymous && <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✓</Text>}
          </View>
          <Text style={[styles.anonymousText, { color: colors.text }]}>Sembunyikan nama (Anonim)</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.submitBtn, 
            { backgroundColor: colors.accent }, 
            (submitting || rating === 0 || !comment.trim()) && { opacity: 0.5 }
          ]}
          onPress={handleSubmit}
          disabled={submitting || rating === 0 || !comment.trim()}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Kirim Ulasan</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'System',
  },
  content: {
    padding: 20,
  },
  productLabel: {
    fontSize: 14,
    marginBottom: 4,
    fontFamily: 'System',
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'System',
    marginBottom: 24,
  },
  ratingContainer: {
    alignItems: 'center',
    marginBottom: 32,
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: 20,
    borderRadius: 16,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'System',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  starBtn: {
    padding: 2,
  },
  ratingLabelBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  ratingLabelText: {
    color: '#d97706',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'System',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    fontFamily: 'System',
    minHeight: 120,
    marginBottom: 32,
  },
  submitBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'System',
  },
  anonymousToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anonymousText: {
    fontSize: 14,
    fontFamily: 'System',
    fontWeight: '500',
  },
});
