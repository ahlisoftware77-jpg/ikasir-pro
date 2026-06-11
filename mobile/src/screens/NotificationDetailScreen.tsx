import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Linking, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Calendar, ExternalLink, ShoppingBag, Eye } from 'lucide-react-native';
import { Button3D } from './SuperAdminScreen';

export default function NotificationDetailScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const { notification } = route.params;
  const [imageLoading, setImageLoading] = useState(true);

  if (!notification) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center" style={{ backgroundColor: colors.bg }}>
        <Text style={{ color: colors.text }}>Notifikasi tidak ditemukan.</Text>
      </SafeAreaView>
    );
  }

  // Extract link and image URL from data payload
  const imageUrl = notification.data?.imageUrl || notification.data?.image || notification.imageUrl;
  const link = notification.data?.link || notification.data?.url || notification.link;
  const transactionId = notification.data?.transactionId;

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      return `${dateStr} pukul ${hours}:${mins}`;
    } catch {
      return '';
    }
  };

  const handleOpenLink = async () => {
    if (!link) return;
    
    let targetUrl = link.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    try {
      const supported = await Linking.canOpenURL(targetUrl);
      if (supported) {
        await Linking.openURL(targetUrl);
      } else {
        Alert.alert('Gagal', 'Perangkat Anda tidak mendukung pembukaan tautan ini.');
      }
    } catch (err) {
      Alert.alert('Gagal', 'Terjadi kesalahan saat membuka tautan.');
    }
  };

  const handleGoToOrder = () => {
    navigation.navigate('Main', { screen: 'Pesanan' });
  };

  return (
    <SafeAreaView className="flex-1" edges={['top', 'bottom']} style={{ backgroundColor: colors.bg }}>
      {/* Header */}
      <View className="flex-row items-center px-6 py-4 border-b" style={{ borderColor: colors.border + '30', backgroundColor: colors.surface }}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          className="w-10 h-10 rounded-full bg-black/5 items-center justify-center mr-4"
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-base font-black uppercase tracking-tight" style={{ color: colors.text }}>Detail Notifikasi</Text>
          <Text className="text-[9px] font-bold uppercase tracking-wider" style={{ color: colors.textMuted }}>Informasi Pesan & Pengumuman</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <View 
          className="p-6 rounded-[28px] border mb-6" 
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          {/* Timestamp */}
          <View className="flex-row items-center gap-2 mb-4">
            <Calendar size={14} color={colors.accent} />
            <Text className="text-[10px] font-bold" style={{ color: colors.textMuted }}>
              {formatTime(notification.timestamp)}
            </Text>
          </View>

          {/* Title */}
          <Text className="text-lg font-black leading-snug mb-3" style={{ color: colors.text }}>
            {notification.title}
          </Text>

          {/* Divider */}
          <View className="h-[1px] w-full my-3" style={{ backgroundColor: colors.border + '50' }} />

          {/* Body Message */}
          <Text className="text-xs font-bold leading-6" style={{ color: colors.text }}>
            {notification.body}
          </Text>
        </View>

        {/* Dynamic Media: Image */}
        {imageUrl ? (
          <View className="mb-6">
            <Text className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2.5 ml-1">Lampiran Gambar</Text>
            <View 
              className="w-full aspect-[16/10] rounded-2xl overflow-hidden border bg-black/5 justify-center items-center"
              style={{ borderColor: colors.border }}
            >
              {imageLoading && (
                <View className="absolute z-10">
                  <ActivityIndicator size="small" color={colors.accent} />
                </View>
              )}
              <Image 
                source={{ uri: imageUrl }} 
                className="w-full h-full"
                resizeMode="cover"
                onLoadEnd={() => setImageLoading(false)}
              />
            </View>
          </View>
        ) : null}

        {/* Action Buttons */}
        <View className="space-y-3 gap-3">
          {link ? (
            <View>
              <Text className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2.5 ml-1">Tautan Web</Text>
              <Button3D
                variant="accent"
                colors={colors}
                onPress={handleOpenLink}
              >
                <ExternalLink size={16} color="#ffffff" />
                <Text className="font-black text-white text-xs uppercase tracking-wider">Kunjungi Tautan</Text>
              </Button3D>
            </View>
          ) : null}

          {transactionId ? (
            <View>
              <Text className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2.5 ml-1">Aksi Pesanan</Text>
              <Button3D
                variant="success"
                colors={colors}
                onPress={handleGoToOrder}
              >
                <ShoppingBag size={16} color="#ffffff" />
                <Text className="font-black text-white text-xs uppercase tracking-wider">Buka Halaman Pesanan</Text>
              </Button3D>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
