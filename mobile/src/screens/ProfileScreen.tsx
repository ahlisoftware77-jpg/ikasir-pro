import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Image, Alert } from 'react-native';
import { Save, Camera } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../store/authStore';
import * as ImagePicker from 'expo-image-picker';
import { db, auth, storage } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { user, setUser } = useAuthStore();
  const [editProfileName, setEditProfileName] = useState(user?.name || user?.email?.split('@')[0] || '');
  const [editProfilePhoto, setEditProfilePhoto] = useState(user?.photoURL || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handlePickProfilePhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploadingPhoto(true);
        const localUri = result.assets[0].uri;
        const filename = localUri.split('/').pop() || `profile_${Date.now()}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        const formDataUpload = new FormData();
        formDataUpload.append('file', { uri: localUri, name: filename, type } as any);
        formDataUpload.append('upload_preset', 'kasirpos');

        const uploadRes = await fetch('https://api.cloudinary.com/v1_1/dkcjfwbvc/image/upload', {
          method: 'POST',
          body: formDataUpload,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        const uploadResult = await uploadRes.json();
        if (uploadRes.ok && uploadResult.secure_url) {
          setEditProfilePhoto(uploadResult.secure_url);
        } else {
          throw new Error(uploadResult.error?.message || 'Gagal upload ke server');
        }
      }
    } catch (error) {
      console.error('Error picking photo:', error);
      Alert.alert('Error', 'Gagal memilih atau mengunggah foto profil.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    try {
      if (auth.currentUser) {
         await updateProfile(auth.currentUser, { displayName: editProfileName, photoURL: editProfilePhoto });
      }
      await updateDoc(doc(db, 'users', user.uid), { name: editProfileName, photoURL: editProfilePhoto });
      setUser({ ...user, name: editProfileName, photoURL: editProfilePhoto });
      Alert.alert('Sukses', 'Profil berhasil diperbarui!');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Gagal memperbarui profil.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" edges={['top', 'bottom']} style={{ backgroundColor: colors.bg }}>
      <View className="flex-row items-center px-6 py-4 border-b" style={{ borderColor: colors.border + '30' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 rounded-full bg-black/5 items-center justify-center mr-4">
          <Text style={{ color: colors.text, fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <View>
          <Text className="text-xl font-black" style={{ color: colors.text }}>Profil Pengguna</Text>
          <Text className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.textMuted }}>Detail akun Kasir Pro Anda</Text>
        </View>
      </View>
      <ScrollView className="flex-1">
        <View className="flex-1 p-6">
        <View 
          className="p-6 rounded-3xl border mb-6 items-center"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <TouchableOpacity onPress={handlePickProfilePhoto} disabled={isUploadingPhoto} className="relative w-24 h-24 rounded-full mb-4 bg-teal-500/10 border-2 border-teal-500/20 items-center justify-center overflow-hidden">
            {editProfilePhoto ? (
              <Image source={{ uri: editProfilePhoto }} className="w-full h-full" style={{ resizeMode: 'cover' }} />
            ) : (
              <Text className="text-4xl font-black text-teal-500">{editProfileName.charAt(0).toUpperCase()}</Text>
            )}
            
            {isUploadingPhoto ? (
              <View className="absolute inset-0 bg-black/50 items-center justify-center">
                <ActivityIndicator size="small" color="#ffffff" />
              </View>
            ) : (
              <View className="absolute bottom-0 w-full h-1/3 bg-black/40 items-center justify-center">
                <Camera color="#ffffff" size={14} />
              </View>
            )}
          </TouchableOpacity>
          <Text className="text-lg font-black text-center mb-1" style={{ color: colors.text }}>{editProfileName || 'Kasir Pengguna'}</Text>
          <View className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Text className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">{user?.role || 'KASIR'}</Text>
          </View>
        </View>

        <View className="p-6 rounded-3xl border space-y-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <View className="w-full">
            <Text className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1 pl-1 mt-4">Nama Lengkap</Text>
            <TextInput
              value={editProfileName}
              onChangeText={setEditProfileName}
              placeholder="Masukkan nama lengkap"
              placeholderTextColor={colors.textMuted}
              className="w-full h-12 px-4 rounded-xl font-bold text-sm"
              style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border, borderWidth: 1 }}
            />
          </View>

          <View className="w-full border-t border-slate-800/30 pt-4 mt-4 flex gap-3">
            <View className="flex-row justify-between">
              <Text className="text-xs font-bold" style={{ color: colors.textMuted }}>Email (Permanen)</Text>
              <Text className="text-xs font-black" style={{ color: colors.text }}>{user?.email}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs font-bold" style={{ color: colors.textMuted }}>UID Akun</Text>
              <Text className="text-[10px] font-black" style={{ color: colors.text }}>{user?.uid?.substring(0, 16)}...</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleSaveProfile}
            disabled={isSavingProfile}
            className="w-full h-12 rounded-xl items-center justify-center mt-6 flex-row gap-2"
            style={{ backgroundColor: colors.accent, opacity: isSavingProfile ? 0.5 : 1 }}
          >
            {isSavingProfile ? <ActivityIndicator color="white" /> : <Save color="white" size={18} />}
            <Text className="font-black text-white uppercase tracking-wider">SIMPAN PROFIL</Text>
          </TouchableOpacity>
        </View>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}
