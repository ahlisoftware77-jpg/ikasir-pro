import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Star } from 'lucide-react-native';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuthStore } from '../store/authStore';

export default function MarketplaceWriteReviewScreen({ route, navigation }: any) {
  const { productId, productName, storeId, orderId } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      await addDoc(collection(db, 'reviews'), {
        productId,
        productName,
        storeId,
        userId: user.uid || user.phone || 'anonymous',
        userName: user.name || user.phone || 'Pengguna',
        rating,
        comment: comment.trim(),
        orderId: orderId || null,
        createdAt: serverTimestamp(),
      });
      
      // Update product rating aggregate
      const pRef = doc(db, 'products', productId);
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
          <Text style={[styles.ratingLabel, { color: colors.text }]}>Beri Nilai Rating:</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity key={star} onPress={() => setRating(star)} style={styles.starBtn}>
                <Star 
                  color={star <= rating ? '#f59e0b' : colors.border} 
                  fill={star <= rating ? '#f59e0b' : 'transparent'} 
                  size={40} 
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={[styles.commentLabel, { color: colors.text }]}>Tulis Komentar Ulasan:</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="Tuliskan pendapat Anda tentang produk ini..."
          placeholderTextColor={colors.text + '80'}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          value={comment}
          onChangeText={setComment}
        />

        <TouchableOpacity 
          style={[styles.submitBtn, { backgroundColor: colors.accent, opacity: submitting ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={submitting}
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
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'System',
    marginBottom: 12,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  starBtn: {
    padding: 4,
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'System',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    fontFamily: 'System',
    minHeight: 120,
    marginBottom: 24,
  },
  submitBtn: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'System',
  }
});
