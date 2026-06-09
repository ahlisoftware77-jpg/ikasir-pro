import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ThemeScreen({ navigation }: any) {
  const { colors, theme, setTheme } = useTheme();

  const themeOptions = [
    { id: 'light', name: 'Terang (Default)', desc: 'Tampilan bersih & profesional', color: '#3b82f6', bg: '#f8fafc' },
    { id: 'ocean', name: 'Gelap (Samudra)', desc: 'Nyaman di mata, hemat baterai', color: '#3b82f6', bg: '#020617' },
    { id: 'emerald', name: 'Gelap (Zamrud)', desc: 'Segar dan menenangkan', color: '#10b981', bg: '#09090b' },
    { id: 'sunset', name: 'Gelap (Senja)', desc: 'Berani dan menarik', color: '#f43f5e', bg: '#0c0a09' },
    { id: 'purple', name: 'Gelap (Ungu)', desc: 'Mewah dan eksklusif', color: '#8b5cf6', bg: '#0a0a0a' },
    { id: 'light_mint', name: 'Terang (Mint)', desc: 'Tampilan hijau bersih', color: '#10b981', bg: '#f4fbf7' },
    { id: 'light_peach', name: 'Terang (Peach)', desc: 'Tampilan ceria dan hangat', color: '#f97316', bg: '#fffaf5' },
  ];

  return (
    <SafeAreaView className="flex-1" edges={['top', 'bottom']} style={{ backgroundColor: colors.bg }}>
      <View className="flex-row items-center px-6 py-4 border-b" style={{ borderColor: colors.border + '30' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 rounded-full bg-black/5 items-center justify-center mr-4">
          <Text style={{ color: colors.text, fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <View>
          <Text className="text-xl font-black" style={{ color: colors.text }}>Tema Aplikasi</Text>
          <Text className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.textMuted }}>Kustomisasi Tampilan Kasir</Text>
        </View>
      </View>
      <ScrollView className="flex-1">
        <View className="flex gap-3 px-6 pt-6 pb-12">
        {themeOptions.map((t) => {
          const isSelected = theme === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => setTheme(t.id as any)}
              activeOpacity={0.8}
              className="p-4 rounded-[20px] border flex-row items-center justify-between"
              style={{ 
                backgroundColor: colors.surface, 
                borderColor: isSelected ? colors.accent : colors.border
              }}
            >
              <View className="flex-row items-center gap-4 flex-1">
                <View 
                  className="w-10 h-10 rounded-xl items-center justify-center border"
                  style={{ backgroundColor: t.bg, borderColor: isSelected ? colors.accent : colors.border }}
                >
                  <View className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: t.color }} />
                </View>
                <View className="flex-1 pr-2">
                  <Text className="text-xs font-black" style={{ color: colors.text }}>{t.name}</Text>
                  <Text className="text-[9px] font-bold mt-0.5" style={{ color: colors.textMuted }}>{t.desc}</Text>
                </View>
              </View>
              {isSelected && (
                <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent }}>
                  <Check size={12} color="#ffffff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}
