import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList, Vibration } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useNotificationStore, NotificationItem } from '../store/notificationStore';
import { Bell, Trash2, CheckCheck, ChevronRight, Inbox } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotificationsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { notifications, markAsRead, markAllAsRead, clearAll } = useNotificationStore();

  const handleNotificationPress = (item: NotificationItem) => {
    markAsRead(item.id);
    Vibration.vibrate(10);
    if (item.data?.type === 'subscription_warning') {
      navigation.navigate('Lainnya', { openSubscription: true });
    } else {
      navigation.navigate('NotificationDetail', { notification: item });
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      return `${dateStr} pukul ${hours}:${mins}`;
    } catch {
      return '';
    }
  };

  const renderItem = ({ item }: { item: NotificationItem }) => {
    return (
      <TouchableOpacity
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.8}
        className="p-4 border-b flex-row items-start justify-between"
        style={{
          backgroundColor: item.isRead ? 'transparent' : colors.surface + '20',
          borderColor: colors.border,
        }}
      >
        <View className="flex-row items-start flex-1 pr-4">
          {/* Status Indicator Dot */}
          <View className="pt-1.5 mr-3">
            {!item.isRead ? (
              <View className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            ) : (
              <View className="w-2.5 h-2.5 rounded-full bg-transparent" />
            )}
          </View>

          {/* Bell Icon container */}
          <View 
            className="w-10 h-10 rounded-xl items-center justify-center mr-3.5 border"
            style={{
              backgroundColor: item.isRead ? colors.surface + '30' : colors.accent + '15',
              borderColor: item.isRead ? colors.border : colors.accent + '30',
            }}
          >
            <Bell size={18} color={item.isRead ? colors.textMuted : colors.accent} />
          </View>

          {/* Texts */}
          <View className="flex-1">
            <Text 
              className={`text-sm ${item.isRead ? 'font-bold' : 'font-black'}`}
              style={{ color: colors.text }}
            >
              {item.title}
            </Text>
            <Text 
              className="text-xs font-bold mt-1 leading-relaxed"
              style={{ color: colors.textMuted }}
            >
              {item.body}
            </Text>
            <Text 
              className="text-[9px] font-bold mt-2"
              style={{ color: colors.textMuted + 'b0' }}
            >
              {formatTime(item.timestamp)}
            </Text>
          </View>
        </View>

        {/* Chevron right */}
        <View className="justify-center h-full pt-3">
          <ChevronRight size={16} color={colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1" edges={['bottom']} style={{ backgroundColor: colors.bg }}>
      {/* Header controls inside the screen */}
      <View 
        className="px-6 py-4 border-b flex-row justify-between items-center"
        style={{ borderColor: colors.border, backgroundColor: colors.surface }}
      >
        <Text className="text-xs font-black uppercase text-slate-400">
          Riwayat Notifikasi ({notifications.length})
        </Text>
        
        {notifications.length > 0 && (
          <View className="flex-row gap-3">
            <TouchableOpacity 
              onPress={() => { Vibration.vibrate(10); markAllAsRead(); }}
              className="flex-row items-center gap-1 bg-accent/10 px-3 py-1.5 rounded-lg border border-accent/20"
            >
              <CheckCheck size={12} color={colors.accent} />
              <Text className="text-[9px] font-black text-accent uppercase">Baca Semua</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => { Vibration.vibrate(10); clearAll(); }}
              className="flex-row items-center gap-1 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20"
            >
              <Trash2 size={12} color="#f43f5e" />
              <Text className="text-[9px] font-black text-rose-500 uppercase">Hapus Semua</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8 opacity-40">
          <Inbox size={48} color={colors.textMuted} />
          <Text className="text-sm font-black mt-4 text-center uppercase tracking-widest" style={{ color: colors.textMuted }}>
            Tidak ada notifikasi
          </Text>
          <Text className="text-xs font-bold text-center mt-2" style={{ color: colors.textMuted }}>
            Setiap ada pesanan online baru masuk, riwayatnya akan muncul di sini.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 50 }}
        />
      )}
    </SafeAreaView>
  );
}
