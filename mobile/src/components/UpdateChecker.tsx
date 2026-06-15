import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Linking, Alert } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AlertTriangle, Download } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import * as Updates from 'expo-updates';

const CURRENT_VERSION_CODE = 7; // Increment this with every new APK build

export default function UpdateChecker() {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [updateUrl, setUpdateUrl] = useState('');
  const [updateMessage, setUpdateMessage] = useState('Versi baru aplikasi telah tersedia. Anda wajib memperbarui untuk melanjutkan.');
  const { colors } = useTheme();

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'appConfig'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.minVersionCode && data.minVersionCode > CURRENT_VERSION_CODE) {
            setNeedsUpdate(true);
            if (data.updateUrl) setUpdateUrl(data.updateUrl);
            if (data.updateMessage) setUpdateMessage(data.updateMessage);
            return; // Stop checking OTA if hard update is required
          }
        }
      } catch (err) {
        console.log("Error checking app version:", err);
      }

      // Check for OTA Updates (EAS Updates)
      checkOTAUpdate();
    };

    const checkOTAUpdate = async () => {
      if (__DEV__) return; // Skip in local development

      try {
        const updateStatus = await Updates.checkForUpdateAsync();
        if (updateStatus.isAvailable) {
          // Fetch the updates in background
          await Updates.fetchUpdateAsync();
          
          // Notify the user to reload
          Alert.alert(
            '🚨 Pembaruan Tersedia',
            'Versi baru aplikasi telah berhasil diunduh. Muat ulang aplikasi sekarang untuk menerapkan perubahan terbaru?',
            [
              { text: 'Nanti', style: 'cancel' },
              { 
                text: 'Muat Ulang', 
                onPress: async () => {
                  await Updates.reloadAsync();
                } 
              }
            ],
            { cancelable: false }
          );
        }
      } catch (error) {
        console.log("Error checking OTA updates:", error);
      }
    };
    
    checkVersion();
  }, []);

  if (!needsUpdate) return null;

  return (
    <Modal visible={true} transparent animationType="fade">
      <View className="flex-1 justify-center items-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <View className="w-full bg-white rounded-3xl p-8 items-center shadow-2xl" style={{ backgroundColor: colors.surface }}>
          <View className="w-20 h-20 bg-rose-500/10 rounded-full items-center justify-center mb-6">
            <AlertTriangle size={40} color="#f43f5e" />
          </View>
          
          <Text className="text-xl font-black mb-3 text-center" style={{ color: colors.text }}>
            Update Diperlukan!
          </Text>
          
          <Text className="text-sm font-bold text-center mb-8" style={{ color: colors.text + '80' }}>
            {updateMessage}
          </Text>

          <TouchableOpacity 
            onPress={() => {
              if (updateUrl) {
                Linking.openURL(updateUrl).catch(() => {
                  Linking.openURL('https://wa.me/6283815862300?text=Halo%20Admin,%20saya%20butuh%20link%20update%20aplikasi%20IKASIR%20PRO.');
                });
              } else {
                Linking.openURL('https://wa.me/6283815862300?text=Halo%20Admin,%20saya%20butuh%20link%20update%20aplikasi%20IKASIR%20PRO.');
              }
            }}
            className="w-full py-4 bg-emerald-500 rounded-2xl flex-row justify-center items-center gap-2 active:scale-95 transition-all"
          >
            <Download size={20} color="white" />
            <Text className="text-white font-black uppercase tracking-widest text-xs">Unduh Update</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
