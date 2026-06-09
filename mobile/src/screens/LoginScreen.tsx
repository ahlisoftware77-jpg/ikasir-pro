import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert, Modal, Linking } from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../context/ThemeContext';
import { Mail, Lock, ShoppingBag, Eye, EyeOff, User, Store, Phone } from 'lucide-react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import Svg, { Path, G } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

// TODO: Anda wajib mengganti webClientId ini dengan Web Client ID dari Firebase Console (Authentication -> Google)
GoogleSignin.configure({
  webClientId: '468553316772-2e0gf3gou8u71tgi91r181kcugnojlto.apps.googleusercontent.com',
});

export default function LoginScreen() {
  const { colors } = useTheme();
  const { setUser, setRole, setStoreId, setSubscriptionUntil, setIsSubscriptionExpired } = useAuthStore();

  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Google Registration State
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleUser, setGoogleUser] = useState<any>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Harap isi email dan kata sandi.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        if (userData.isActive === false) {
          await signOut(auth);
          setError('Akses dibekukan: Akun Anda telah dinonaktifkan.');
          return;
        }

        const now = new Date();
        const validUntil = userData.validUntil ? new Date(userData.validUntil) : null;
        if (validUntil) {
          setSubscriptionUntil(userData.validUntil);
          setIsSubscriptionExpired(now > validUntil);
        } else {
          setSubscriptionUntil(null);
          setIsSubscriptionExpired(false);
        }

        setRole(userData.role);
        setStoreId(userData.storeId || 'default-store');
        setUser({
          uid: user.uid,
          email: user.email,
          name: userData.name
        });
      } else {
        setRole('cashier');
        setStoreId('default-store');
        setUser({ uid: user.uid, email: user.email });
      }
    } catch (err: any) {
      console.error(err);
      setError('Email atau kata sandi salah.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !name || !storeName) {
      setError('Harap isi semua kolom.');
      return;
    }
    if (password.length < 6) {
      setError('Kata sandi minimal 6 karakter.');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      let baseStoreId = storeName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      if (!baseStoreId) baseStoreId = 'store';

      let storeIdStr = baseStoreId;
      let counter = 0;
      while (true) {
        const storeSnap = await getDoc(doc(db, 'stores', storeIdStr));
        if (!storeSnap.exists()) break;
        counter++;
        storeIdStr = `${baseStoreId}-${counter}`;
      }

      await setDoc(doc(db, 'stores', storeIdStr), {
        name: storeName,
        ownerEmail: email,
        ownerUid: user.uid,
        createdAt: new Date().toISOString(),
        isActive: true,
        package: 'trial'
      });

      await setDoc(doc(db, 'users', user.uid), {
        name: name,
        email: email,
        role: 'admin',
        storeId: storeIdStr,
        isActive: true,
        isSubscribed: true,
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      });

      await setDoc(doc(db, 'settings', `store_${storeIdStr}`), {
        storeName: storeName,
        address: 'Alamat Belum Diatur',
        phone: '-',
        useTax: true,
        taxRate: 11,
        receiptMessage: 'Terima kasih telah berbelanja!',
        paperSize: '58mm',
        storeId: storeIdStr
      });

      setRole('admin');
      setStoreId(storeIdStr);
      setUser({ uid: user.uid, email: user.email, name: name });

    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Email sudah digunakan oleh akun lain.');
      } else {
        setError('Pendaftaran gagal: ' + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Reset Sandi', 'Harap isi alamat email Anda di kolom email, lalu tekan tombol Lupa Sandi lagi.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Sukses', 'Tautan reset kata sandi telah dikirim ke email Anda. Silakan cek Inbox atau folder Spam.');
    } catch (err: any) {
      Alert.alert('Gagal', 'Gagal mengirim email reset. Pastikan email yang dimasukkan benar.');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError('');
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        throw new Error('No ID token found');
      }

      const googleCredential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, googleCredential);
      const user = userCredential.user;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        if (userData.isActive === false) {
          await signOut(auth);
          setError('Akses dibekukan: Akun Anda telah dinonaktifkan.');
          setIsLoading(false);
          return;
        }

        const now = new Date();
        const validUntil = userData.validUntil ? new Date(userData.validUntil) : null;
        if (validUntil) {
          setSubscriptionUntil(userData.validUntil);
          setIsSubscriptionExpired(now > validUntil);
        } else {
          setSubscriptionUntil(null);
          setIsSubscriptionExpired(false);
        }

        setRole(userData.role);
        setStoreId(userData.storeId || 'default-store');
        setUser({
          uid: user.uid,
          email: user.email,
          name: userData.name
        });
      } else {
        setGoogleUser(user);
        setShowGoogleModal(true);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        setError('Login Google dibatalkan.');
      } else if (err.code === statusCodes.IN_PROGRESS) {
        setError('Login Google sedang diproses.');
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError('Google Play Services tidak tersedia.');
      } else {
        setError('Gagal login Google: ' + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const submitGoogleRegistration = async () => {
    if (!storeName || !phone) {
      Alert.alert('Error', 'Harap isi Nama Toko dan Nomor HP.');
      return;
    }
    setIsLoading(true);
    try {
      let baseStoreId = storeName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      if (!baseStoreId) baseStoreId = 'store';

      let storeIdStr = baseStoreId;
      let counter = 0;
      while (true) {
        const storeSnap = await getDoc(doc(db, 'stores', storeIdStr));
        if (!storeSnap.exists()) break;
        counter++;
        storeIdStr = `${baseStoreId}-${counter}`;
      }

      const displayName = googleUser.displayName || 'Pengguna Baru';

      await setDoc(doc(db, 'stores', storeIdStr), {
        name: storeName,
        ownerEmail: googleUser.email,
        ownerUid: googleUser.uid,
        createdAt: new Date().toISOString(),
        isActive: true,
        package: 'trial'
      });

      await setDoc(doc(db, 'users', googleUser.uid), {
        name: displayName,
        email: googleUser.email,
        phone: phone,
        role: 'admin',
        storeId: storeIdStr,
        isActive: true,
        isSubscribed: true,
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      });

      await setDoc(doc(db, 'settings', `store_${storeIdStr}`), {
        storeName: storeName,
        address: 'Alamat Belum Diatur',
        phone: phone,
        useTax: true,
        taxRate: 11,
        receiptMessage: 'Terima kasih telah berbelanja!',
        paperSize: '58mm',
        storeId: storeIdStr
      });

      setShowGoogleModal(false);
      setRole('admin');
      setStoreId(storeIdStr);
      setUser({ uid: googleUser.uid, email: googleUser.email, name: displayName });
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', 'Gagal mendaftarkan toko: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, maxWidth: 450, width: '100%', alignSelf: 'center' }}>

        <View
          className="absolute -top-12 -left-12 w-80 h-80 rounded-full opacity-10"
          style={{ backgroundColor: colors.accent }}
        />
        <View
          className="absolute -bottom-12 -right-12 w-80 h-80 rounded-full opacity-5"
          style={{ backgroundColor: colors.accent }}
        />

        <View className="items-center mb-8">
          <View
            className="w-16 h-16 rounded-[20px] items-center justify-center shadow-xl mb-4"
            style={{ backgroundColor: colors.accent }}
          >
            <ShoppingBag color={colors.text} size={28} />
          </View>
          <Text className="text-3xl font-black tracking-tighter" style={{ color: colors.text }}>
            IKASIR <Text style={{ color: colors.accent }}>PRO</Text>
          </Text>
          <Text className="text-[9px] font-bold tracking-[2px] uppercase mt-1" style={{ color: colors.textMuted }}>
            Modern Point of Sale Ecosystem
          </Text>
        </View>

        <View
          className="p-6 rounded-[32px] border"
          style={{ backgroundColor: colors.surface + '99', borderColor: colors.border }}
        >
          <Text className="text-[10px] font-black uppercase tracking-[2px] mb-6 text-center" style={{ color: colors.textMuted }}>
            {mode === 'login' ? 'Masuk ke Panel Akun' : 'Daftar Toko Baru (Free Trial)'}
          </Text>

          {error ? (
            <View className="bg-red-500/10 border border-red-500/50 p-3 rounded-xl mb-6">
              <Text className="text-red-500 text-[10px] font-bold text-center mb-2">{error}</Text>
            </View>
          ) : null}

          <View className="flex gap-4">

            {mode === 'register' && (
              <>
                <View>
                  <Text className="text-[9px] font-bold uppercase tracking-[1px] mb-2 ml-1" style={{ color: colors.textMuted }}>Nama Lengkap</Text>
                  <View className="flex-row items-center border rounded-2xl px-4 py-1" style={{ borderColor: colors.border, backgroundColor: colors.bg + '50' }}>
                    <User size={16} color={colors.textMuted} />
                    <TextInput
                      placeholder="Nama Anda"
                      placeholderTextColor={colors.textMuted + '80'}
                      value={name}
                      onChangeText={setName}
                      className="flex-1 h-12 ml-3 font-bold text-xs"
                      style={{ color: colors.text }}
                    />
                  </View>
                </View>

                <View>
                  <Text className="text-[9px] font-bold uppercase tracking-[1px] mb-2 ml-1" style={{ color: colors.textMuted }}>Nama Toko</Text>
                  <View className="flex-row items-center border rounded-2xl px-4 py-1" style={{ borderColor: colors.border, backgroundColor: colors.bg + '50' }}>
                    <Store size={16} color={colors.textMuted} />
                    <TextInput
                      placeholder="Nama Toko/Bisnis Anda"
                      placeholderTextColor={colors.textMuted + '80'}
                      value={storeName}
                      onChangeText={setStoreName}
                      className="flex-1 h-12 ml-3 font-bold text-xs"
                      style={{ color: colors.text }}
                    />
                  </View>
                </View>
              </>
            )}

            <View>
              <Text className="text-[9px] font-bold uppercase tracking-[1px] mb-2 ml-1" style={{ color: colors.textMuted }}>Alamat Email</Text>
              <View className="flex-row items-center border rounded-2xl px-4 py-1" style={{ borderColor: colors.border, backgroundColor: colors.bg + '50' }}>
                <Mail size={16} color={colors.textMuted} />
                <TextInput
                  placeholder="admin@kasirpro.com"
                  placeholderTextColor={colors.textMuted + '80'}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  className="flex-1 h-12 ml-3 font-bold text-xs"
                  style={{ color: colors.text }}
                />
              </View>
            </View>

            <View>
              <Text className="text-[9px] font-bold uppercase tracking-[1px] mb-2 ml-1" style={{ color: colors.textMuted }}>Kata Sandi</Text>
              <View className="flex-row items-center border rounded-2xl px-4 py-1" style={{ borderColor: colors.border, backgroundColor: colors.bg + '50' }}>
                <Lock size={16} color={colors.textMuted} />
                <TextInput
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted + '80'}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  className="flex-1 h-12 ml-3 font-bold text-xs"
                  style={{ color: colors.text }}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={16} color={colors.textMuted} /> : <Eye size={16} color={colors.textMuted} />}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {mode === 'login' && (
            <TouchableOpacity onPress={handleResetPassword} className="mt-3 self-end">
              <Text className="text-[10px] font-black uppercase text-blue-500">Lupa Kata Sandi?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={mode === 'login' ? handleLogin : handleRegister}
            disabled={isLoading}
            activeOpacity={0.8}
            className="mt-6 h-14 rounded-2xl items-center justify-center shadow-lg"
            style={{ backgroundColor: colors.accent, shadowColor: colors.accent }}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text className="text-xs font-black uppercase tracking-[2px]" style={{ color: colors.text }}>
                {mode === 'login' ? 'MASUK SEKARANG' : 'DAFTAR TOKO'}
              </Text>
            )}
          </TouchableOpacity>

          <View className="flex-row items-center my-6">
            <View className="flex-1 border-t" style={{ borderColor: colors.border }} />
            <Text className="mx-4 text-[10px] font-bold" style={{ color: colors.textMuted }}>ATAU</Text>
            <View className="flex-1 border-t" style={{ borderColor: colors.border }} />
          </View>

          <TouchableOpacity
            onPress={handleGoogleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
            className="h-14 rounded-2xl items-center justify-center flex-row gap-4"
            style={{ 
              backgroundColor: '#ffffff', 
              borderWidth: 1, 
              borderColor: '#e5e7eb',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2 
            }}
          >
            <Svg width="20" height="20" viewBox="0 0 24 24">
              <G transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                <Path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                <Path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                <Path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                <Path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
              </G>
            </Svg>
            <Text className="text-xs font-black uppercase tracking-[1px] text-gray-600">
              {mode === 'login' ? 'MASUK DENGAN GOOGLE' : 'DAFTAR DENGAN GOOGLE'}
            </Text>
          </TouchableOpacity>

          <View className="mt-6 flex-row justify-center items-center">
            <Text className="text-[10px] font-bold" style={{ color: colors.textMuted }}>
              {mode === 'login' ? 'Belum punya akun? ' : 'Sudah punya akun? '}
            </Text>
            <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
              <Text className="text-[10px] font-black uppercase ml-1" style={{ color: colors.accent }}>
                {mode === 'login' ? 'Daftar Baru' : 'Masuk Disini'}
              </Text>
            </TouchableOpacity>
          </View>

        </View>

      </ScrollView>

      {/* Google Registration Modal */}
      <Modal
        visible={showGoogleModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowGoogleModal(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center p-6">
          <View className="w-full rounded-[32px] p-8" style={{ backgroundColor: colors.surface }}>
            <Text className="text-xl font-black text-center mb-2" style={{ color: colors.text }}>Lengkapi Profil Toko</Text>
            <Text className="text-xs text-center mb-6" style={{ color: colors.textMuted }}>
              Halo {googleUser?.displayName?.split(' ')[0]}, silakan lengkapi nama toko dan nomor HP Anda.
            </Text>

            <View className="gap-4 mb-6">
              <View>
                <Text className="text-[9px] font-bold uppercase tracking-[1px] mb-2 ml-1" style={{ color: colors.textMuted }}>Nama Toko</Text>
                <View className="flex-row items-center border rounded-2xl px-4 py-1" style={{ borderColor: colors.border, backgroundColor: colors.bg + '50' }}>
                  <Store size={16} color={colors.textMuted} />
                  <TextInput
                    placeholder="Nama Toko/Bisnis Anda"
                    placeholderTextColor={colors.textMuted + '80'}
                    value={storeName}
                    onChangeText={setStoreName}
                    className="flex-1 h-12 ml-3 font-bold text-xs"
                    style={{ color: colors.text }}
                  />
                </View>
              </View>

              <View>
                <Text className="text-[9px] font-bold uppercase tracking-[1px] mb-2 ml-1" style={{ color: colors.textMuted }}>Nomor HP/WhatsApp</Text>
                <View className="flex-row items-center border rounded-2xl px-4 py-1" style={{ borderColor: colors.border, backgroundColor: colors.bg + '50' }}>
                  <Phone size={16} color={colors.textMuted} />
                  <TextInput
                    placeholder="08xxxxxxxx"
                    placeholderTextColor={colors.textMuted + '80'}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    className="flex-1 h-12 ml-3 font-bold text-xs"
                    style={{ color: colors.text }}
                  />
                </View>
              </View>
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowGoogleModal(false)}
                className="flex-1 h-12 items-center justify-center rounded-xl border"
                style={{ borderColor: colors.border }}
              >
                <Text className="text-xs font-black uppercase" style={{ color: colors.textMuted }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitGoogleRegistration}
                disabled={isLoading}
                className="flex-1 h-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: colors.accent }}
              >
                {isLoading ? <ActivityIndicator color={colors.text} /> : (
                  <Text className="text-xs font-black uppercase" style={{ color: colors.text }}>BUAT TOKO</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
