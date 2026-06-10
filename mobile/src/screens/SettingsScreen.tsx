import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Pressable, Vibration, TextInput, Switch, ActivityIndicator, Alert, Image, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';

LocaleConfig.locales['id'] = {
  monthNames: ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'],
  monthNamesShort: ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'],
  dayNames: ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'],
  dayNamesShort: ['Min','Sen','Sel','Rab','Kam','Jum','Sab'],
  today: 'Hari ini'
};
LocaleConfig.defaultLocale = 'id';

import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../store/authStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  LogOut, Check, X, Calculator, CreditCard, History, Package, Home, PlusCircle, 
  Tag, BadgePercent, Layers, CalendarRange, FileText, TrendingUp, Flame, Coins, 
  Users, Lock, Clock, UserCheck, ClipboardList, User, Settings, AlertCircle, Receipt, Trash2,
  Key, Database, Download, UploadCloud, ShieldAlert, CheckCircle2, Pencil, Power, Plus, Server, Edit2, ArrowRight, ArrowLeft, ShieldCheck, Mail, Palette, Sparkles, Bell, Camera, Save,
  MessageCircle, QrCode, Landmark, Wallet
} from 'lucide-react-native';
import { db, auth, storage } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, writeBatch, onSnapshot, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import SignaturePad from '../components/SignaturePad';

const FONT_OPTIONS = [
  { id: 'sans', name: 'Modern (Sans)', family: 'System' },
  { id: 'serif', name: 'Classic (Serif)', family: 'Georgia' },
  { id: 'mono', name: 'Retro (Mono)', family: 'Courier' },
  { id: 'elegant', name: 'Elegant (Outfit)', family: 'System' },
  { id: 'bold', name: 'Impact (Oswald)', family: 'System' }
];

const getFontFamily = (id: string) => {
  return FONT_OPTIONS.find(f => f.id === id)?.family || 'System';
};

export default function SettingsScreen({ navigation }: any) {
  const { colors, theme, setTheme } = useTheme();
  const { user, role, storeId, logout, isSubscriptionExpired, subscriptionUntil } = useAuthStore();

  const [activeModal, setActiveModal] = useState<'theme' | 'profile' | 'premium' | 'storeSettings' | 'superAdminUsers' | 'superAdminStores' | 'superAdminBranding' | 'superAdminInfra' | 'subscriptionMenu' | 'superAdminSubscriptions' | null>(null);
  const [selectedPremiumFeature, setSelectedPremiumFeature] = useState('');

  // Profile States
  const { setUser } = useAuthStore();
  const [editProfileName, setEditProfileName] = useState(user?.name || user?.email?.split('@')[0] || '');
  const [editProfilePhoto, setEditProfilePhoto] = useState<string | null>(user?.photoURL || null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [hasPendingSubscription, setHasPendingSubscription] = useState(false);

  useEffect(() => {
    if (storeId) {
      const q = query(collection(db, 'subscription_requests'), where('storeId', '==', storeId), where('status', '==', 'pending'));
      const unsub = onSnapshot(q, (snap) => {
        setHasPendingSubscription(!snap.empty);
      });
      return () => unsub();
    }
  }, [storeId]);

  const handleSaveProfile = async () => {
    if (!user || !user.uid) return;
    setIsSavingProfile(true);
    try {
      if (auth.currentUser) {
         await updateProfile(auth.currentUser, { displayName: editProfileName });
      }
      await updateDoc(doc(db, 'users', user.uid), { name: editProfileName });
      setUser({ ...user, name: editProfileName });
      Alert.alert('Sukses', 'Profil berhasil diperbarui');
    } catch (error: any) {
      console.error(error);
      Alert.alert('Gagal', 'Tidak dapat menyimpan profil');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePickProfilePhoto = async () => {
    if (!user || !user.uid) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploadingPhoto(true);
        const imageUri = result.assets[0].uri;
        
        const response = await fetch(imageUri);
        const blob = await response.blob();
        
        const storageRef = ref(storage, `profiles/${user.uid}_${Date.now()}`);
        await uploadBytes(storageRef, blob);
        const downloadUrl = await getDownloadURL(storageRef);
        
        if (auth.currentUser) {
           await updateProfile(auth.currentUser, { photoURL: downloadUrl });
        }
        await updateDoc(doc(db, 'users', user.uid), { photoUrl: downloadUrl });
        
        setEditProfilePhoto(downloadUrl);
        setUser({ ...user, photoURL: downloadUrl });
        Alert.alert('Sukses', 'Foto profil diperbarui');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Gagal', 'Tidak dapat mengunggah foto');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Store Settings States
  const [storeSettings, setStoreSettings] = useState({
    storeName: '',
    address: '',
    phone: '',
    bankInfo: '',
    useTax: true,
    taxRate: 11,
    showLogoOnReceipt: true,
    showReceiptAddress: true,
    showReceiptPhone: true,
    showReceiptCustomer: true,
    showReceiptCashier: true,
    showReceiptSubtotal: true,
    showSignature: true,
    
    // Add additional settings fields matching web page
    paperSize: '58mm',
    receiptMessage: '',
    waTemplate: '',
    themeColorHex: '#10b981',
    allowPickup: true,
    allowDelivery: true,
    deliveryFee: 0,
    
    trxPrefix: 'TRX-',
    trxPadding: 4,
    trxCounter: 0,
    ordPrefix: 'ORD-',
    ordPadding: 4,
    ordCounter: 0,
    debPrefix: 'DEB-',
    debPadding: 4,
    debCounter: 0,
    estPrefix: 'EST-',
    estPadding: 4,
    estCounter: 0,

    // New web properties
    logoUrl: '',
    thermalLogoUrl: '',
    signatureUrl: '',
    storeNameFont: 'sans',
    a4InvoiceNote: '',
    a4EstimationNote: '',
    a4DebtNote: '',
    qrisUrl: '',
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingThermalLogo, setIsUploadingThermalLogo] = useState(false);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const [isUploadingQris, setIsUploadingQris] = useState(false);
  const [showSignaturePadMobile, setShowSignaturePadMobile] = useState(false);

  // Password change states
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Backup & Restore states
  const [isBackuping, setIsBackuping] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<{visible: boolean, field: 'createdAt' | 'validUntil' | null}>({visible: false, field: null});
  const [restoreProgress, setRestoreProgress] = useState(0);

  // Super Admin states
  const [superAdminUsers, setSuperAdminUsers] = useState<any[]>([]);
  const [superAdminStores, setSuperAdminStores] = useState<any[]>([]);
  const [subscriptionRequests, setSubscriptionRequests] = useState<any[]>([]);
  const [dbProjects, setDbProjects] = useState<any[]>([]);
  const [superAdminSearchQuery, setSuperAdminSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [migratingUser, setMigratingUser] = useState<any>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationMode, setMigrationMode] = useState<'standard' | 'mass'>('standard');
  const [isAddingStore, setIsAddingStore] = useState(false);
  const [editingStore, setEditingStore] = useState<any>(null);
  const [newStoreData, setNewStoreData] = useState({ name: '', ownerEmail: '', id: '', maxUsers: 5 });
  const [isBackingUp, setIsBackingUp] = useState<string | null>(null);
  
  const [brandingData, setBrandingData] = useState({ 
    appName: 'IKASIR PRO', 
    receiptWatermark: 'Powered by YadiApp', 
    showWatermark: true,
    subscriptionQrisUrl: '',
    subscriptionBankInfo: '',
    subscriptionEwalletInfo: '',
    webAppUrl: ''
  });

  // Subscription Menu States
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [subscriptionProofBase64, setSubscriptionProofBase64] = useState<string | null>(null);
  const [isSubmittingSubscription, setIsSubmittingSubscription] = useState(false);
  const [isSubscriptionSuccess, setIsSubscriptionSuccess] = useState(false);
  const [subscriptionPaymentMethod, setSubscriptionPaymentMethod] = useState<'qris' | 'bank' | 'ewallet'>('qris');
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const SUBSCRIPTION_PACKAGES = [
    { id: '1m', title: '1 Bulan', price: 30000, desc: '1 Bulan x Rp 30.000 = Rp 30.000' },
    { id: '3m', title: '3 Bulan', price: 84000, desc: '3 Bulan x Rp 28.000 = Rp 84.000' },
    { id: '6m', title: '6 Bulan', price: 159000, desc: '6 Bulan x Rp 26.500 = Rp 159.000' },
    { id: '12m', title: '12 Bulan', price: 306000, desc: '12 Bulan x Rp 25.500 = Rp 306.000' },
  ];

  const [infraData, setInfraData] = useState<any>({
    cloudinary_cloud_name: '',
    cloudinary_upload_preset: '',
    fb_api_key: '',
    fb_auth_domain: '',
    fb_project_id: '',
    fb_storage_bucket: '',
    fb_messaging_sender_id: '',
    fb_app_id: ''
  });
  
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);

  useEffect(() => {
    const unsubBranding = onSnapshot(doc(db, 'system_settings', 'branding'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBrandingData({
          appName: data.appName || 'IKASIR PRO',
          receiptWatermark: data.receiptWatermark || 'Powered by YadiApp',
          showWatermark: data.showWatermark ?? true,
          subscriptionQrisUrl: data.subscriptionQrisUrl || '',
          subscriptionBankInfo: data.subscriptionBankInfo || '',
          subscriptionEwalletInfo: data.subscriptionEwalletInfo || '',
          webAppUrl: data.webAppUrl || ''
        });
      }
    });
    return () => unsubBranding();
  }, []);

  useEffect(() => {
    if (role === 'super-admin' || role === 'superadmin') {
      const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const usr: any[] = [];
        snapshot.forEach((d) => usr.push({ id: d.id, ...d.data() }));
        setSuperAdminUsers(usr);
      });

      const unsubStores = onSnapshot(collection(db, 'stores'), (snapshot) => {
        const str: any[] = [];
        snapshot.forEach((d) => str.push({ id: d.id, ...d.data() }));
        setSuperAdminStores(str);
      });

      const unsubInfra = onSnapshot(doc(db, 'system_settings', 'infrastructure'), (docSnap) => {
        if (docSnap.exists()) {
          setInfraData(docSnap.data());
        }
      });

      const unsubProjects = onSnapshot(collection(db, 'system_settings', 'database_projects', 'list'), (snapshot) => {
        const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setDbProjects(projects);
      });

      const unsubSubscriptions = onSnapshot(collection(db, 'subscription_requests'), (snapshot) => {
        const subs: any[] = [];
        snapshot.forEach((d) => subs.push({ id: d.id, ...d.data() }));
        setSubscriptionRequests(subs);
      });

      return () => {
        unsubUsers();
        unsubStores();
        unsubInfra();
        unsubProjects();
        unsubSubscriptions();
      };
    }
  }, [role]);

  const triggerBackup = async (storeId: string) => {
    Alert.alert(
      'Konfirmasi Backup',
      storeId === 'GLOBAL' ? 'Mulai pencadangan semua data toko?' : 'Mulai pencadangan untuk toko ini?',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Ya', 
          onPress: async () => {
            setIsBackingUp(storeId);
            try {
              const backupData: any = {
                metadata: {
                  storeId,
                  timestamp: new Date().toISOString(),
                  version: '1.2'
                },
                data: {}
              };

              if (storeId === 'GLOBAL') {
                const storesSnap = await getDocs(collection(db, 'stores'));
                const storesList: any[] = [];
                storesSnap.forEach(d => storesList.push({ id: d.id, ...d.data() }));
                backupData.data['stores'] = storesList;

                const settingsSnap = await getDocs(collection(db, 'settings'));
                const settingsList: any[] = [];
                settingsSnap.forEach(d => settingsList.push({ id: d.id, ...d.data() }));
                backupData.data['settings'] = settingsList;

                const collectionsToExport = ['products', 'transactions', 'customers', 'users', 'expenses', 'discounts', 'categories', 'product_extras'];
                for (const collName of collectionsToExport) {
                  const snap = await getDocs(collection(db, collName));
                  const docs: any[] = [];
                  snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
                  backupData.data[collName] = docs;
                }
              } else {
                const storeRef = doc(db, 'stores', storeId);
                const storeSnap = await getDoc(storeRef);
                if (storeSnap.exists()) {
                  backupData.data['stores'] = [{ id: storeSnap.id, ...storeSnap.data() }];
                }

                const specSettingsRef = doc(db, 'settings', `store_${storeId}`);
                const specificSettings = await getDoc(specSettingsRef);
                if (specificSettings.exists()) {
                  backupData.data['settings'] = [{ id: specificSettings.id, ...specificSettings.data() }];
                }

                const collectionsToExport = ['products', 'transactions', 'customers', 'users', 'expenses', 'discounts', 'categories', 'product_extras'];
                for (const collName of collectionsToExport) {
                  const q = query(collection(db, collName), where('storeId', '==', storeId));
                  const snap = await getDocs(q);
                  const docs: any[] = [];
                  snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
                  backupData.data[collName] = docs;
                }
              }

              const fileUri = `${FileSystem.documentDirectory}backup_${storeId}_${new Date().toISOString().split('T')[0]}.json`;
              await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backupData, null, 2), { encoding: FileSystem.EncodingType.UTF8 });

              const isSharingAvailable = await Sharing.isAvailableAsync();
              if (isSharingAvailable) {
                await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Simpan Backup' });
              } else {
                Alert.alert('Gagal', 'Sharing tidak tersedia.');
              }
            } catch (e: any) {
              console.error(e);
              Alert.alert('Gagal', 'Gagal backup: ' + e.message);
            } finally {
              setIsBackingUp(null);
            }
          }
        }
      ]
    );
  };

  const onFileRestoreGlobal = async () => {
    Alert.alert(
      '🚨 KONFIRMASI TERAKHIR',
      "⚠️ PERINGATAN KERAS: Tindakan ini tidak dapat dibatalkan dan dapat menyebabkan kehilangan data jika file backup Anda tidak valid. Anda yakin?",
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Restore Global',
          onPress: async () => {
            setIsRestoring(true);
            try {
              const pickerResult = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
              });

              if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
                setIsRestoring(false);
                return;
              }

              const localUri = pickerResult.assets[0].uri;
              const fileContent = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.UTF8 });
              const backupData = JSON.parse(fileContent);

              if (!backupData.data) {
                throw new Error('Format file backup tidak valid.');
              }

              const collections = Object.keys(backupData.data);
              let totalDocs = 0;
              collections.forEach(c => totalDocs += backupData.data[c].length);
              
              let processedDocs = 0;

              for (const collName of collections) {
                const docs = backupData.data[collName];
                if (!Array.isArray(docs)) continue;

                for (let i = 0; i < docs.length; i += 400) {
                  const batch = writeBatch(db);
                  const chunk = docs.slice(i, i + 400);

                  chunk.forEach((d: any) => {
                    const { id, ...data } = d;
                    const ref = doc(db, collName, id);
                    batch.set(ref, data, { merge: true });
                  });

                  await batch.commit();
                  processedDocs += chunk.length;
                  setRestoreProgress(Math.round((processedDocs / totalDocs) * 100));
                }
              }

              Alert.alert('Sukses', `✅ RESTORE BERHASIL!\nTotal ${processedDocs} dokumen dipulihkan.`);
            } catch (err: any) {
              console.error(err);
              Alert.alert('Gagal', 'Restore Gagal: ' + err.message);
            } finally {
              setIsRestoring(false);
            }
          }
        }
      ]
    );
  };

  const handleMigrateData = async () => {
    Alert.alert(
      'Konfirmasi',
      'Pindahkan semua data tanpa Toko ke "Toko Utama (Default)"?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Migrasikan',
          onPress: async () => {
            setIsMigrating(true);
            try {
              const collections = ['products', 'transactions', 'customers', 'users', 'expenses', 'discounts', 'categories'];
              let totalPatched = 0;

              for (const collName of collections) {
                const snap = await getDocs(collection(db, collName));
                const batch = writeBatch(db);
                let count = 0;
                
                snap.forEach((d) => {
                  if (!d.data().storeId) {
                    batch.update(d.ref, { storeId: 'default-store' });
                    count++;
                  }
                });

                if (count > 0) {
                  await batch.commit();
                  totalPatched += count;
                }
              }
              Alert.alert('Sukses', `Berhasil memigrasikan ${totalPatched} dokumen ke Toko Utama.`);
            } catch (err: any) {
              Alert.alert('Gagal', 'Migrasi gagal: ' + err.message);
            } finally {
              setIsMigrating(false);
            }
          }
        }
      ]
    );
  };

  const handleMigrateDiscountStructure = async () => {
    Alert.alert(
      'Konfirmasi',
      'Migrasi struktur Diskon dari productId (Format Lama) ke appliedProductIds (Format Baru)?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Migrasikan',
          onPress: async () => {
            setIsMigrating(true);
            try {
              const snap = await getDocs(collection(db, 'discounts'));
              const batch = writeBatch(db);
              let count = 0;

              snap.forEach((d) => {
                const data = d.data();
                if (data.productId && !data.appliedProductIds) {
                  batch.update(d.ref, { 
                    appliedProductIds: [data.productId],
                    productId: null
                  });
                  count++;
                }
              });

              if (count > 0) {
                await batch.commit();
                Alert.alert('Sukses', `Berhasil memperbarui ${count} dokumen diskon.`);
              } else {
                Alert.alert('Info', 'Tidak ada dokumen diskon lama yang ditemukan.');
              }
            } catch (err: any) {
              Alert.alert('Gagal', 'Migrasi gagal: ' + err.message);
            } finally {
              setIsMigrating(false);
            }
          }
        }
      ]
    );
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', editingUser.id), {
        role: editingUser.role,
        isActive: editingUser.isActive ?? true,
        isSubscribed: editingUser.isSubscribed ?? false,
        validUntil: editingUser.validUntil || '',
        name: editingUser.name,
        storeId: editingUser.storeId || 'default-store',
        createdAt: editingUser.createdAt || new Date().toISOString()
      });
      alert('Data pengguna berhasil diperbarui!');
      setEditingUser(null);
    } catch (err: any) {
      console.error(err);
      alert('Gagal memperbarui data: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateStore = async () => {
    if (!newStoreData.name || !newStoreData.id) return;
    
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'stores', newStoreData.id), {
        name: newStoreData.name,
        ownerEmail: newStoreData.ownerEmail || '-',
        createdAt: new Date().toISOString(),
        isActive: true,
        package: 'manual-pro',
        maxUsers: Math.max(1, Number(newStoreData.maxUsers) || 1)
      });
      Alert.alert('Sukses', 'Toko berhasil ditambahkan!');
      setIsAddingStore(false);
      setNewStoreData({ name: '', ownerEmail: '', id: '', maxUsers: 5 });
    } catch (err: any) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal menambah toko: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStore = async (storeId: string, currentStatus: boolean) => {
    Alert.alert(
      'Konfirmasi Status Toko',
      `Tandai toko ini sebagai ${!currentStatus ? 'AKTIF' : 'NON-AKTIF'}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'stores', storeId), {
                isActive: !currentStatus
              });
              Alert.alert('Sukses', 'Status toko berhasil diperbarui!');
            } catch (err: any) {
              console.error(err);
              Alert.alert('Gagal', 'Gagal memperbarui status: ' + err.message);
            }
          }
        }
      ]
    );
  };

  const handleUpdateStoreDetails = async () => {
    if (!editingStore) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'stores', editingStore.id), {
        name: editingStore.name,
        ownerEmail: editingStore.ownerEmail || '-',
        maxUsers: Math.max(1, parseInt(editingStore.maxUsers as any) || 1)
      });
      
      await updateDoc(doc(db, 'settings', "store_" + editingStore.id), {
        storeName: editingStore.name
      }).catch(() => {});

      Alert.alert('Sukses', 'Detail toko berhasil diperbarui!');
      setEditingStore(null);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal memperbarui detail toko: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStorePermanently = async (storeId: string) => {
    Alert.alert(
      '⚠️ PERINGATAN KERAS ⚠️',
      'Anda yakin ingin menghapus toko ini secara PERMANEN? Semua data (Produk, Transaksi, Pelanggan, Karyawan) yang terkait akan ikut hangus dan tidak dapat dikembalikan!',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'YA, HAPUS SEMUA',
          style: 'destructive',
          onPress: async () => {
            Alert.alert(
              'Konfirmasi Terakhir',
              'Apakah Anda benar-benar yakin?',
              [
                { text: 'Batal', style: 'cancel' },
                {
                  text: 'EKSEKUSI',
                  style: 'destructive',
                  onPress: async () => {
                    setIsSaving(true);
                    try {
                      // 1. Delete store doc
                      await deleteDoc(doc(db, 'stores', storeId));
                      // 2. Delete store settings
                      await deleteDoc(doc(db, 'settings', `store_${storeId}`));
                      
                      // 3. Batch delete related collections
                      const collectionsToDelete = ['products', 'transactions', 'customers', 'users', 'expenses', 'discounts', 'categories', 'product_extras', 'estimations'];
                      
                      for (const collName of collectionsToDelete) {
                        const q = query(collection(db, collName), where('storeId', '==', storeId));
                        const snap = await getDocs(q);
                        
                        let batch = writeBatch(db);
                        let count = 0;
                        
                        for (const docSnap of snap.docs) {
                          batch.delete(docSnap.ref);
                          count++;
                          if (count === 400) {
                            await batch.commit();
                            batch = writeBatch(db);
                            count = 0;
                          }
                        }
                        if (count > 0) {
                          await batch.commit();
                        }
                      }
                      
                      Alert.alert('Sukses', 'Toko dan seluruh datanya telah berhasil dihapus!');
                    } catch (err: any) {
                      console.error(err);
                      Alert.alert('Gagal', 'Terjadi kesalahan saat menghapus: ' + err.message);
                    } finally {
                      setIsSaving(false);
                    }
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  const handleDeleteUserPermanently = async (userId: string, email: string) => {
    Alert.alert(
      '⚠️ PERINGATAN KERAS ⚠️',
      `Anda yakin ingin menghapus akses User "${email}" secara PERMANEN dari database utama?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Permanen',
          style: 'destructive',
          onPress: async () => {
            setIsSaving(true);
            try {
              await deleteDoc(doc(db, 'users', userId));
              Alert.alert('Sukses', 'User berhasil dihapus secara permanen dari Firestore.');
            } catch (err: any) {
              console.error(err);
              Alert.alert('Gagal', 'Gagal menghapus user: ' + err.message);
            } finally {
              setIsSaving(false);
            }
          }
        }
      ]
    );
  };

  const handleVerifySubscription = async (req: any) => {
    Alert.alert(
      'Konfirmasi Verifikasi',
      `Validasi pembayaran dari ${req.ownerEmail} dan tambahkan masa aktif?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Verifikasi Valid',
          onPress: async () => {
            setIsSaving(true);
            try {
              const match = req.packageId.match(/(\d+)m/);
              const months = match ? parseInt(match[1]) : 1;
              
              const newValidUntil = new Date();
              newValidUntil.setDate(newValidUntil.getDate() + (months * 30));

              const batch = writeBatch(db);
              
              batch.update(doc(db, 'subscription_requests', req.id), {
                status: 'approved',
                approvedAt: new Date().toISOString()
              });

              const qUsers = query(collection(db, 'users'), where('storeId', '==', req.storeId));
              const userSnaps = await getDocs(qUsers);
              userSnaps.forEach((userDoc) => {
                batch.update(userDoc.ref, {
                  validUntil: newValidUntil.toISOString(),
                  isSubscribed: true
                });
              });

              await batch.commit();
              Alert.alert('Sukses', `Berhasil memperpanjang masa aktif toko selama ${months} bulan.`);
            } catch (err: any) {
              console.error(err);
              Alert.alert('Gagal', 'Gagal memverifikasi langganan: ' + err.message);
            } finally {
              setIsSaving(false);
            }
          }
        }
      ]
    );
  };

  const handleUpdateBranding = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'system_settings', 'branding'), {
        ...brandingData,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      Alert.alert('Sukses', 'Informasi Branding berhasil diperbarui secara global!');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal update branding: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePickSubscriptionQris = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setIsSaving(true);
        const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
        const cloudinaryUrl = 'https://api.cloudinary.com/v1_1/dtt1zow8f/image/upload';
        
        const data = {
          file: base64Img,
          upload_preset: 'kasirpos',
        };

        const uploadRes = await fetch(cloudinaryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        const uploadResult = await uploadRes.json();
        if (uploadResult.secure_url) {
          setBrandingData(prev => ({ ...prev, subscriptionQrisUrl: uploadResult.secure_url }));
          Alert.alert('Berhasil', 'Foto QRIS Langganan berhasil disiapkan, tekan Simpan Perubahan!');
        } else {
          Alert.alert('Gagal', 'Gagal menyiapkan QRIS ke server.');
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Gagal memilih QRIS.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadQris = async (url: string) => {
    if (!url) return;
    try {
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (!isSharingAvailable) {
        Alert.alert('Info', 'Fitur sharing tidak tersedia di perangkat Anda.');
        return;
      }
      const extension = url.split('.').pop()?.split('?')[0] || 'png';
      const localUri = `${FileSystem.documentDirectory}qris_pembayaran.${extension}`;

      const downloadResult = await FileSystem.downloadAsync(url, localUri);
      if (downloadResult.status === 200) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
          dialogTitle: 'Unduh / Simpan QRIS',
        });
      } else {
        Alert.alert('Gagal', 'Gagal mengunduh gambar QRIS.');
      }
    } catch (error: any) {
      console.error(error);
      Linking.openURL(url);
    }
  };

  const handlePickSubscriptionProof = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setSubscriptionProofBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (err) {
      Alert.alert('Error', 'Gagal memilih gambar bukti transfer.');
    }
  };

  const handleSubmitSubscription = async () => {
    if (!selectedPackage || !subscriptionProofBase64) {
      Alert.alert('Info', 'Pilih paket dan unggah bukti pembayaran terlebih dahulu.');
      return;
    }
    setIsSubmittingSubscription(true);
    try {
      const infraSnap = await getDoc(doc(db, 'system_settings', 'infrastructure'));
      let cloudName = 'dkcjfwbvc';
      let uploadPreset = 'kasirpos';
      if (infraSnap.exists()) {
        const data = infraSnap.data();
        if (data.cloudinary_cloud_name) cloudName = data.cloudinary_cloud_name;
        if (data.cloudinary_upload_preset) uploadPreset = data.cloudinary_upload_preset;
      }

      const uploadData = new FormData();
      uploadData.append('file', subscriptionProofBase64);
      uploadData.append('upload_preset', uploadPreset);

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: uploadData
      });
      const uploadResult = await uploadRes.json();
      
      if (uploadResult.secure_url) {
        await addDoc(collection(db, 'subscription_requests'), {
          storeId: storeId,
          ownerUid: user?.uid || '',
          ownerEmail: user?.email || '',
          packageId: selectedPackage.id,
          packageTitle: selectedPackage.title,
          price: selectedPackage.price,
          paymentMethod: subscriptionPaymentMethod,
          proofUrl: uploadResult.secure_url,
          status: 'pending',
          createdAt: serverTimestamp()
        });

        // Trigger FCM Push Notification for Superadmin
        const webUrl = brandingData.webAppUrl || 'https://ikasir-pro.vercel.app';
        fetch(`${webUrl}/api/send-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeId: 'superadmin',
            title: '🚨 Pengajuan Langganan Baru!',
            message: `Toko ${user?.email || ''} mengajukan paket ${selectedPackage.title || ''}.`
          })
        }).catch(e => console.error('Failed to trigger superadmin push notification from mobile:', e));

        setIsSubscriptionSuccess(true);
      } else {
        Alert.alert('Error', 'Gagal mengunggah gambar ke server.');
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', 'Gagal memproses langganan: ' + err.message);
    } finally {
      setIsSubmittingSubscription(false);
    }
  };

  const handleUpdateInfra = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'system_settings', 'infrastructure'), {
        ...infraData,
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      Alert.alert('Sukses', 'Konfigurasi Infrastruktur berhasil diperbarui secara global!');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal update infrastruktur: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetInfra = async () => {
    Alert.alert(
      'Konfirmasi Reset',
      'Kembalikan ke pengaturan awal (Environment Variables)? Ini akan MENGHAPUS pengaturan kustom secara permanen dari database.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Reset',
          onPress: async () => {
            setIsSaving(true);
            try {
              await deleteDoc(doc(db, 'system_settings', 'infrastructure'));
              Alert.alert('Sukses', 'Pengaturan telah dikembalikan ke default.');
            } catch (err: any) {
              console.error(err);
              Alert.alert('Gagal', 'Gagal menghapus pengaturan: ' + err.message);
            } finally {
              setIsSaving(false);
            }
          }
        }
      ]
    );
  };

  const handleSaveProject = async () => {
    setIsSaving(true);
    try {
      const projId = editingProject?.id || doc(collection(db, 'system_settings', 'database_projects', 'list')).id;
      await setDoc(doc(db, 'system_settings', 'database_projects', 'list', projId), {
        ...infraData,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      Alert.alert('Sukses', 'Proyek Database berhasil disimpan!');
      setIsAddingProject(false);
      setEditingProject(null);
      setInfraData({
        cloudinary_cloud_name: '',
        cloudinary_upload_preset: '',
        fb_api_key: '',
        fb_auth_domain: '',
        fb_project_id: '',
        fb_storage_bucket: '',
        fb_messaging_sender_id: '',
        fb_app_id: ''
      });
    } catch (err: any) {
      Alert.alert('Gagal', 'Gagal simpan proyek: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async (projId: string) => {
    Alert.alert(
      'Konfirmasi Hapus',
      'Hapus proyek database ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Hapus',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'system_settings', 'database_projects', 'list', projId));
              Alert.alert('Sukses', 'Proyek berhasil dihapus.');
            } catch (err: any) {
              Alert.alert('Gagal', 'Gagal hapus: ' + err.message);
            }
          }
        }
      ]
    );
  };

  const handleMigrateUser = async (userToMigrate: any, targetProj: any) => {
    const isResetting = !targetProj;
    const targetId = isResetting ? 'DEFAULT (Internal)' : targetProj.fb_project_id;
    
    Alert.alert(
      'Konfirmasi Migrasi User',
      `Pindahkan data user ${userToMigrate.email} dan tokonya ke ${targetId}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Migrasikan',
          onPress: async () => {
            setIsSaving(true);
            try {
              await updateDoc(doc(db, 'users', userToMigrate.id), {
                targetProjectId: isResetting ? null : targetProj.fb_project_id,
                infraConfig: isResetting ? null : targetProj,
                lastMigration: new Date().toISOString()
              });

              Alert.alert('Sukses', `Berhasil! Data ${userToMigrate.email} telah dipetakan ke ${targetId}.`);
              setMigratingUser(null);
            } catch (err: any) {
              console.error(err);
              Alert.alert('Gagal', 'Gagal memetakan user: ' + err.message);
            } finally {
              setIsSaving(false);
            }
          }
        }
      ]
    );
  };

  const handlePasswordChangeMobile = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert('Peringatan', 'Harap isi semua kolom kata sandi.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Peringatan', 'Kata sandi baru tidak cocok dengan konfirmasi.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Peringatan', 'Kata sandi baru minimal 6 karakter.');
      return;
    }
    if (!auth.currentUser?.email) {
      Alert.alert('Error', 'Data pengguna tidak valid, coba login ulang.');
      return;
    }

    Vibration.vibrate(15);
    setIsChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, oldPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);

      Alert.alert('Berhasil', 'Kata sandi berhasil diubah!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error("Password change mobile error:", err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        Alert.alert('Error', 'Kata sandi lama yang Anda masukkan salah.');
      } else {
        Alert.alert('Error', 'Gagal mengubah kata sandi: ' + err.message);
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleExportJSONMobile = async () => {
    if (!storeId) return;
    Vibration.vibrate(15);
    setIsBackuping(true);

    try {
      const collectionsToExport = [
        'products', 
        'transactions', 
        'customers', 
        'users', 
        'expenses', 
        'discounts', 
        'categories',
        'product_extras'
      ];
      
      const backupData: any = {
        metadata: {
          storeId,
          timestamp: new Date().toISOString(),
          version: '1.2'
        },
        data: {}
      };

      // 1. Export Settings & Store Docs
      const storeRef = doc(db, 'stores', storeId);
      const storeSnap = await getDoc(storeRef);
      if (storeSnap.exists()) {
        backupData.data['stores'] = [{ id: storeSnap.id, ...storeSnap.data() }];
      }

      const specSettingsRef = doc(db, 'settings', `store_${storeId}`);
      const specificSettings = await getDoc(specSettingsRef);
      if (specificSettings.exists()) {
        backupData.data['settings'] = [{ id: specificSettings.id, ...specificSettings.data() }];
      }

      // 2. Export Collections
      for (const collName of collectionsToExport) {
        try {
          const q = query(collection(db, collName), where('storeId', '==', storeId));
          const snap = await getDocs(q);
          const docs: any[] = [];
          snap.forEach(d => {
            const data = d.data();
            const serializedData = { ...data };
            Object.keys(serializedData).forEach(key => {
              if (serializedData[key]?.toDate && typeof serializedData[key].toDate === 'function') {
                serializedData[key] = serializedData[key].toDate().toISOString();
              }
            });
            docs.push({ id: d.id, ...serializedData });
          });
          backupData.data[collName] = docs;
        } catch (colErr) {
          console.warn(`Could not export collection ${collName} on mobile:`, colErr);
        }
      }

      // 3. Share File via Document / Sharing API
      const fileUri = `${FileSystem.documentDirectory}backup_${storeId}_${new Date().toISOString().split('T')[0]}.json`;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backupData, null, 2), { encoding: FileSystem.EncodingType.UTF8 });

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Simpan Backup Toko' });
      } else {
        Alert.alert('Gagal', 'Sistem sharing tidak tersedia di perangkat ini.');
      }
    } catch (err: any) {
      console.error("Backup error on mobile:", err);
      Alert.alert('Gagal', 'Gagal membuat backup data: ' + err.message);
    } finally {
      setIsBackuping(false);
    }
  };

  const handleImportJSONMobile = async () => {
    if (!storeId) return;
    
    Alert.alert(
      'Konfirmasi',
      'PERINGATAN: Mengembalikan data akan menimpa atau menambah data yang sudah ada. Lanjutkan?',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Ya, Lanjutkan', 
          onPress: async () => {
            Vibration.vibrate(15);
            setIsRestoring(true);
            setRestoreProgress(0);

            try {
              const pickerResult = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
              });

              if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
                setIsRestoring(false);
                return;
              }

              const localUri = pickerResult.assets[0].uri;
              const fileContent = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.UTF8 });
              const backupData = JSON.parse(fileContent);

              if (!backupData.data) {
                throw new Error('Format file backup tidak valid.');
              }

              const collections = Object.keys(backupData.data);
              let totalDocs = 0;
              collections.forEach(c => totalDocs += backupData.data[c].length);
              
              let processedDocs = 0;

              for (const collName of collections) {
                const docs = backupData.data[collName];
                if (!Array.isArray(docs)) continue;

                // Split into batches of 400
                for (let i = 0; i < docs.length; i += 400) {
                  const batch = writeBatch(db);
                  const chunk = docs.slice(i, i + 400);

                  chunk.forEach((d: any) => {
                    const { id, ...data } = d;
                    data.storeId = storeId;
                    const ref = doc(db, collName, id);
                    batch.set(ref, data, { merge: true });
                  });

                  await batch.commit();
                  processedDocs += chunk.length;
                  setRestoreProgress(Math.round((processedDocs / totalDocs) * 100));
                }
              }

              Alert.alert('Berhasil', 'Data toko berhasil dipulihkan!');
            } catch (err: any) {
              console.error("Restore error on mobile:", err);
              Alert.alert('Gagal', 'Gagal memulihkan data: ' + err.message);
            } finally {
              setIsRestoring(false);
            }
          }
        }
      ]
    );
  };

  const handlePickLogoMobile = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setIsUploadingLogo(true);
        const localUri = result.assets[0].uri;
        const filename = localUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;

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
          setStoreSettings(prev => ({ ...prev, logoUrl: uploadResult.secure_url }));
          Alert.alert('Berhasil', 'Logo berhasil diunggah!');
        } else {
          console.error(uploadResult);
          Alert.alert('Gagal', 'Gagal mengunggah logo ke server.');
        }
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Gagal memilih logo.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handlePickQrisMobile = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setIsUploadingQris(true);
        const localUri = result.assets[0].uri;
        const filename = localUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;

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
          setStoreSettings(prev => ({ ...prev, qrisUrl: uploadResult.secure_url }));
          Alert.alert('Berhasil', 'Foto QRIS berhasil diunggah!');
        } else {
          console.error(uploadResult);
          Alert.alert('Gagal', 'Gagal mengunggah QRIS ke server.');
        }
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Gagal memilih QRIS.');
    } finally {
      setIsUploadingQris(false);
    }
  };

  const handlePickThermalLogoMobile = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setIsUploadingThermalLogo(true);
        const localUri = result.assets[0].uri;
        const filename = localUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;

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
          setStoreSettings(prev => ({ ...prev, thermalLogoUrl: uploadResult.secure_url }));
          Alert.alert('Berhasil', 'Logo thermal berhasil diunggah!');
        } else {
          console.error(uploadResult);
          Alert.alert('Gagal', 'Gagal mengunggah logo ke server.');
        }
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Gagal memilih logo thermal.');
    } finally {
      setIsUploadingThermalLogo(false);
    }
  };

  const handleSaveSignatureMobile = async (base64: string) => {
    setShowSignaturePadMobile(false);
    setIsUploadingSignature(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', base64);
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
        setStoreSettings(prev => ({ ...prev, signatureUrl: uploadResult.secure_url }));
        Alert.alert('Berhasil', 'Tanda tangan berhasil disimpan!');
      } else {
        console.error(uploadResult);
        Alert.alert('Gagal', 'Gagal mengunggah tanda tangan.');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Gagal menyimpan tanda tangan.');
    } finally {
      setIsUploadingSignature(false);
    }
  };

  useEffect(() => {
    if (activeModal === 'storeSettings' && storeId) {
      const loadStoreSettings = async () => {
        setIsLoadingSettings(true);
        try {
          const settingsRef = doc(db, 'settings', `store_${storeId}`);
          const docSnap = await getDoc(settingsRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setStoreSettings({
              storeName: data.storeName || '',
              address: data.address || '',
              phone: data.phone || '',
              bankInfo: data.bankInfo || '',
              useTax: data.useTax !== false,
              taxRate: data.taxRate || 0,
              showLogoOnReceipt: data.showLogoOnReceipt !== false,
              showReceiptAddress: data.showReceiptAddress !== false,
              showReceiptPhone: data.showReceiptPhone !== false,
              showReceiptCustomer: data.showReceiptCustomer !== false,
              showReceiptCashier: data.showReceiptCashier !== false,
              showReceiptSubtotal: data.showReceiptSubtotal !== false,
              showSignature: data.showSignature !== false,
              
              // Load new fields
              paperSize: data.paperSize || '58mm',
              receiptMessage: data.receiptMessage || '',
              waTemplate: data.waTemplate || '',
              themeColorHex: data.themeColorHex || '#10b981',
              allowPickup: data.allowPickup !== false,
              allowDelivery: data.allowDelivery !== false,
              deliveryFee: data.deliveryFee || 0,
              
              trxPrefix: data.trxPrefix || 'TRX-',
              trxPadding: data.trxPadding || 4,
              trxCounter: data.trxCounter || 0,
              ordPrefix: data.ordPrefix || 'ORD-',
              ordPadding: data.ordPadding || 4,
              ordCounter: data.ordCounter || 0,
              debPrefix: data.debPrefix || 'DEB-',
              debPadding: data.debPadding || 4,
              debCounter: data.debCounter || 0,
              estPrefix: data.estPrefix || 'EST-',
              estPadding: data.estPadding || 4,
              estCounter: data.estCounter || 0,

              // Load new properties
              logoUrl: data.logoUrl || '',
              thermalLogoUrl: data.thermalLogoUrl || '',
              signatureUrl: data.signatureUrl || '',
              storeNameFont: data.storeNameFont || 'sans',
              a4InvoiceNote: data.a4InvoiceNote || '',
              a4EstimationNote: data.a4EstimationNote || '',
              a4DebtNote: data.a4DebtNote || '',
              qrisUrl: data.qrisUrl || '',
            });
          }
        } catch (err) {
          console.error("Error loading store settings on mobile SettingsScreen:", err);
        } finally {
          setIsLoadingSettings(false);
        }
      };
      loadStoreSettings();
    }
  }, [activeModal, storeId]);

  const handleSaveStoreSettings = async () => {
    if (!storeId) return;
    Vibration.vibrate(15);
    setIsSavingSettings(true);
    try {
      const settingsRef = doc(db, 'settings', `store_${storeId}`);
      
      const finalSettings = {
        ...storeSettings,
        taxRate: Number(storeSettings.taxRate) || 0,
        deliveryFee: Number(storeSettings.deliveryFee) || 0,
        trxPadding: Number(storeSettings.trxPadding) || 4,
        trxCounter: Number(storeSettings.trxCounter) || 0,
        ordPadding: Number(storeSettings.ordPadding) || 4,
        ordCounter: Number(storeSettings.ordCounter) || 0,
        debPadding: Number(storeSettings.debPadding) || 4,
        debCounter: Number(storeSettings.debCounter) || 0,
        estPadding: Number(storeSettings.estPadding) || 4,
        estCounter: Number(storeSettings.estCounter) || 0,
      };

      await setDoc(settingsRef, finalSettings, { merge: true });
      
      // Sync back to stores collection if name changed
      await updateDoc(doc(db, 'stores', storeId), {
        name: storeSettings.storeName
      }).catch(() => {});

      Alert.alert('Berhasil', 'Pengaturan toko berhasil disimpan!');
      setActiveModal(null);
    } catch (err) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal menyimpan pengaturan toko.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleOpenPremium = (featureName: string) => {
    Vibration.vibrate(15);
    setSelectedPremiumFeature(featureName);
    setActiveModal('premium');
  };

  const handleOpenBatterySettings = () => {
    Vibration.vibrate(15);
    Alert.alert(
      'Optimasi Baterai Android',
      'Agar iKasir Pro dapat mendeteksi dan memunculkan notifikasi pesanan baru secara real-time saat aplikasi di-minimize (background), silakan atur penggunaan baterai menjadi "Tidak Dibatasi" (Unrestricted).\n\nKami akan membuka Pengaturan Aplikasi. Silakan pilih menu "Baterai" lalu ubah pengaturannya ke "Tidak Dibatasi" (Unrestricted) / "No restrictions".',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Buka Pengaturan', 
          onPress: () => {
            Linking.openSettings();
          } 
        }
      ]
    );
  };

  const themeOptions = [
    { id: 'ocean', name: 'Ocean Blue', color: '#3b82f6', bg: '#020617', desc: 'Tema gelap elegan beraksen biru samudera' },
    { id: 'emerald', name: 'Emerald Green', color: '#10b981', bg: '#09090b', desc: 'Tema gelap segar beraksen hijau emerald' },
    { id: 'purple', name: 'Royal Purple', color: '#8b5cf6', bg: '#0a0a0a', desc: 'Tema gelap mewah beraksen ungu royal' },
    { id: 'sunset', name: 'Sunset Rose', color: '#f43f5e', bg: '#0c0a09', desc: 'Tema gelap berani beraksen merah senja' },
    { id: 'light', name: 'Light Slate', color: '#3b82f6', bg: '#f8fafc', desc: 'Tema terang bersih, dingin, dan minimalis' },
    { id: 'light_mint', name: 'Light Mint', color: '#10b981', bg: '#f4fbf7', desc: 'Tema terang segar beraksen hijau mint' },
    { id: 'light_peach', name: 'Light Peach', color: '#f97316', bg: '#fffaf5', desc: 'Tema terang hangat beraksen orange peach' },
  ];

  // Helper to render grid item
  const renderMenuItem = (label: string, IconComponent: any, color: string, onPress: () => void, isAdminOnly = false, isDisabled = false, badgeCount = 0) => {
    if (isAdminOnly && role !== 'admin') return null;

    return (
      <TouchableOpacity
        key={label}
        onPress={isDisabled ? () => Alert.alert('Akses Terkunci', 'Masa aktif langganan Anda telah habis. Harap perpanjang untuk mengakses fitur ini.') : onPress}
        activeOpacity={isDisabled ? 1 : 0.7}
        className="w-[30%] aspect-square m-[1.5%] p-3 rounded-2xl border items-center justify-center text-center relative"
        style={{ 
          backgroundColor: colors.surface, 
          borderColor: colors.border,
          opacity: isDisabled ? 0.4 : 1
        }}
      >
        <View 
          className="w-10 h-10 rounded-xl items-center justify-center mb-2"
          style={{ backgroundColor: color + '15' }}
        >
          <IconComponent size={20} color={isDisabled ? colors.textMuted : color} />
          {badgeCount > 0 && (
            <View className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full items-center justify-center border border-white">
              <Text className="text-[8px] font-black text-white">{badgeCount}</Text>
            </View>
          )}
        </View>
        <Text 
          className="text-[9px] font-black text-center leading-normal" 
          style={{ color: isDisabled ? colors.textMuted : colors.text }}
          numberOfLines={2}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1" edges={['bottom']} style={{ backgroundColor: colors.bg }}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* Profile Card Header */}
        <View 
          className="p-5 mx-6 mt-4 rounded-3xl border flex-row items-center justify-between"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <View className="flex-row items-center gap-4 flex-1">
            <View 
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.accent + '20' }}
            >
              <Text className="text-lg font-black" style={{ color: colors.accent }}>
                {user?.email?.[0].toUpperCase()}
              </Text>
            </View>
            <View className="flex-1 pr-2">
              <Text className="text-sm font-black" style={{ color: colors.text }} numberOfLines={1}>
                {user?.name || user?.email?.split('@')[0]}
              </Text>
              <Text className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
                {role === 'admin' ? 'Owner (Admin)' : 'Kasir'}
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => {
              Vibration.vibrate(15);
              logout();
            }}
            className="w-10 h-10 rounded-xl bg-rose-500/10 items-center justify-center border border-rose-500/20"
          >
            <LogOut color="#f43f5e" size={16} />
          </TouchableOpacity>
        </View>

        {/* Subscription Status Block */}
        <View className="px-6 mt-4">
          <TouchableOpacity 
            onPress={() => hasPendingSubscription ? null : setActiveModal('subscriptionMenu')}
            activeOpacity={hasPendingSubscription ? 1 : 0.8}
            className="w-full rounded-3xl p-5 border flex-row items-center overflow-hidden relative shadow-lg shadow-emerald-500/20"
            style={{ 
              backgroundColor: hasPendingSubscription ? '#f59e0b' : colors.accent, 
              borderColor: hasPendingSubscription ? '#f59e0b' : colors.accent 
            }}
          >
            <View className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full" />
            <View className="absolute -left-4 -top-4 w-16 h-16 bg-black/10 rounded-full" />
            
            <View className="flex-1">
              <Text className="text-white font-black text-xs uppercase tracking-widest mb-1">Masa Aktif Akun</Text>
              <Text className="text-white/80 font-bold text-[10px]">
                {isSubscriptionExpired ? 'Berakhir pada ' : 'Berlaku s/d '} 
                {subscriptionUntil ? new Date(subscriptionUntil).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
              </Text>
            </View>
            <View className="bg-white px-3 py-2 rounded-xl border border-white/20">
              <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: hasPendingSubscription ? '#f59e0b' : colors.accent }}>
                {hasPendingSubscription ? 'Menunggu Verifikasi' : 'Perpanjang'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Section 1: Transaksi & Keuangan */}
        <View className="mt-6 px-6">
          <Text className="text-[10px] font-black uppercase tracking-[2px] mb-3 ml-2" style={{ color: colors.textMuted }}>
            💸 Keuangan & Transaksi
          </Text>
          <View className="flex-row flex-wrap">
            {renderMenuItem('Estimasi Biaya', Calculator, '#10b981', () => {
              Vibration.vibrate(10);
              navigation.navigate('FeatureDetails', { featureId: 'estimasi', title: 'Estimasi Biaya' });
            }, false, isSubscriptionExpired)}
            {renderMenuItem('Hutang Piutang', CreditCard, '#f43f5e', () => {
              Vibration.vibrate(10);
              navigation.navigate('FeatureDetails', { featureId: 'piutang', title: 'Hutang Piutang' });
            }, false, isSubscriptionExpired)}
            {renderMenuItem('Riwayat Transaksi', History, colors.accent, () => {
              Vibration.vibrate(10);
              navigation.navigate('Transactions');
            })}
            {renderMenuItem('Notifikasi', Bell, '#fbbf24', () => {
              Vibration.vibrate(10);
              navigation.navigate('Notifications');
            })}
          </View>
        </View>

        {/* Section 2: Manajemen Produk */}
        <View className="mt-6 px-6">
          <Text className="text-[10px] font-black uppercase tracking-[2px] mb-3 ml-2" style={{ color: colors.textMuted }}>
            📦 Manajemen Produk
          </Text>
          <View className="flex-row flex-wrap">
            {renderMenuItem('Daftar Produk', Package, '#8b5cf6', () => {
              Vibration.vibrate(10);
              navigation.navigate('Products');
            }, false)}
            {renderMenuItem('Gudang', Home, '#3b82f6', () => {
              Vibration.vibrate(10);
              navigation.navigate('FeatureDetails', { featureId: 'gudang', title: 'Manajemen Gudang' });
            })}
            {renderMenuItem('Ekstra', PlusCircle, '#f59e0b', () => {
              Vibration.vibrate(10);
              navigation.navigate('FeatureDetails', { featureId: 'ekstra', title: 'Kelola Ekstra' });
            })}
            {renderMenuItem('Diskon', Tag, '#ec4899', () => {
              Vibration.vibrate(10);
              navigation.navigate('FeatureDetails', { featureId: 'diskon', title: 'Kelola Diskon' });
            })}
            {renderMenuItem('Terjual', BadgePercent, '#10b981', () => {
              Vibration.vibrate(10);
              navigation.navigate('FeatureDetails', { featureId: 'terjual', title: 'Analitik Terjual' });
            })}
            {renderMenuItem('Stok', Layers, '#06b6d4', () => {
              Vibration.vibrate(10);
              navigation.navigate('FeatureDetails', { featureId: 'stok', title: 'Mutasi Stok' });
            })}
            {renderMenuItem('Expired', CalendarRange, '#ef4444', () => {
              Vibration.vibrate(10);
              navigation.navigate('FeatureDetails', { featureId: 'expired', title: 'Stok Expired' });
            })}
          </View>
        </View>

        {/* Section 3: Laporan */}
        <View className="mt-6 px-6">
          <Text className="text-[10px] font-black uppercase tracking-[2px] mb-3 ml-2" style={{ color: colors.textMuted }}>
            📊 Laporan Analitik
          </Text>
          <View className="flex-row flex-wrap">
            {renderMenuItem('Laporan Penjualan', FileText, '#3b82f6', () => {
              Vibration.vibrate(10);
              navigation.navigate('FeatureDetails', { featureId: 'lap_penjualan', title: 'Laporan Penjualan' });
            })}
            {renderMenuItem('Laporan Omzet', TrendingUp, '#10b981', () => {
              Vibration.vibrate(10);
              navigation.navigate('FeatureDetails', { featureId: 'lap_omzet', title: 'Laporan Omzet' });
            })}
            {renderMenuItem('Laporan Terlaris', Flame, '#f97316', () => {
              Vibration.vibrate(10);
              navigation.navigate('FeatureDetails', { featureId: 'lap_terlaris', title: 'Laporan Terlaris' });
            })}
            {renderMenuItem('Arus Kas', Coins, '#fbbf24', () => {
              Vibration.vibrate(10);
              navigation.navigate('FeatureDetails', { featureId: 'arus_kas', title: 'Arus Kas (Cashflow)' });
            })}
            {renderMenuItem('Pelanggan', Users, '#6366f1', () => {
              Vibration.vibrate(10);
              navigation.navigate('FeatureDetails', { featureId: 'pelanggan', title: 'Daftar Pelanggan' });
            })}
            {renderMenuItem('Riwayat Tutup', Lock, '#64748b', () => {
              Vibration.vibrate(10);
              navigation.navigate('FeatureDetails', { featureId: 'tutup_buku', title: 'Riwayat Tutup Buku' });
            })}
          </View>
        </View>

        {/* Section 4: Operasional & Staff */}
        <View className="mt-6 px-6">
          <Text className="text-[10px] font-black uppercase tracking-[2px] mb-3 ml-2" style={{ color: colors.textMuted }}>
            👥 Operasional & Staff
          </Text>
          <View className="flex-row flex-wrap">
            {renderMenuItem('Shift Karyawan', Clock, '#06b6d4', () => {
              Vibration.vibrate(10);
              navigation.navigate('FeatureDetails', { featureId: 'shift', title: 'Shift Karyawan' });
            })}
            {renderMenuItem('Staff & User', UserCheck, '#6366f1', () => {
              Vibration.vibrate(10);
              navigation.navigate('FeatureDetails', { featureId: 'staff', title: 'Staff & User' });
            })}
            {renderMenuItem('Log Aktifitas', ClipboardList, '#64748b', () => {
              Vibration.vibrate(10);
              navigation.navigate('FeatureDetails', { featureId: 'activity_log', title: 'Log Aktifitas' });
            })}
          </View>
        </View>

        {/* Section: Panel Superadmin */}
        {(role === 'super-admin' || role === 'superadmin') && (
          <View className="mt-6 px-6">
            <Text className="text-[10px] font-black uppercase tracking-[2px] mb-3 ml-2" style={{ color: colors.accent }}>
              🔑 Panel Superadmin
            </Text>
            <View className="flex-row flex-wrap">
              {renderMenuItem('Data User', Users, '#f59e0b', () => {
                Vibration.vibrate(10);
                setActiveModal('superAdminUsers');
              })}
              {renderMenuItem('Kelola Toko', Home, '#3b82f6', () => {
                Vibration.vibrate(10);
                setActiveModal('superAdminStores');
              })}
              {renderMenuItem('Branding', Tag, '#ec4899', () => {
                Vibration.vibrate(10);
                setActiveModal('superAdminBranding');
              })}
              {renderMenuItem('Infrastruktur', Database, '#10b981', () => {
                Vibration.vibrate(10);
                setActiveModal('superAdminInfra');
              })}
              {renderMenuItem('Langganan', Receipt, '#8b5cf6', () => {
                Vibration.vibrate(10);
                setActiveModal('superAdminSubscriptions');
              }, false, false, subscriptionRequests.filter(r => r.status === 'pending').length)}
            </View>
          </View>
        )}

        {/* Section 5: Akun & Aplikasi */}
        <View className="mt-6 px-6">
          <Text className="text-[10px] font-black uppercase tracking-[2px] mb-3 ml-2" style={{ color: colors.textMuted }}>
            ⚙️ Akun & Aplikasi
          </Text>
          <View className="flex-row flex-wrap">
            {renderMenuItem('Profil', User, '#14b8a6', () => {
              Vibration.vibrate(10);
              navigation.navigate('ProfileScreen');
            })}
            {renderMenuItem('Tema Aplikasi', Settings, '#64748b', () => {
              Vibration.vibrate(10);
              navigation.navigate('ThemeScreen');
            })}
            {renderMenuItem('Pengaturan Toko', Settings, colors.accent, () => {
              Vibration.vibrate(10);
              navigation.navigate('StoreSettingsScreen');
            }, true)}
            {renderMenuItem('Notifikasi BG', ShieldAlert, '#f59e0b', handleOpenBatterySettings)}
          </View>
        </View>

      </ScrollView>

      {/* 1. THEME SELECTOR MODAL */}
      <Modal visible={activeModal === 'theme'} animationType="slide" transparent={false} onRequestClose={() => setActiveModal(null)}>
        <SafeAreaView className="flex-1" edges={['top', 'bottom']} style={{ backgroundColor: colors.bg }}>
          <View className="flex-row items-center px-6 py-4 border-b" style={{ borderColor: colors.border + '30' }}>
            <TouchableOpacity onPress={() => setActiveModal(null)} className="w-10 h-10 rounded-full bg-black/5 items-center justify-center mr-4">
              <ArrowLeft color={colors.text} size={20} />
            </TouchableOpacity>
            <View>
              <Text className="text-xl font-black" style={{ color: colors.text }}>Pengaturan Tema</Text>
              <Text className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.textMuted }}>Personalisasi warna aplikasi</Text>
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
      </Modal>

      {/* 2. PROFILE DETAILS MODAL */}
      <Modal visible={activeModal === 'profile'} animationType="slide" transparent={false} onRequestClose={() => setActiveModal(null)}>
        <SafeAreaView className="flex-1" edges={['top', 'bottom']} style={{ backgroundColor: colors.bg }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
            <View className="flex-row items-center px-6 py-4 border-b" style={{ borderColor: colors.border + '30' }}>
              <TouchableOpacity onPress={() => setActiveModal(null)} className="w-10 h-10 rounded-full bg-black/5 items-center justify-center mr-4">
                <ArrowLeft color={colors.text} size={20} />
              </TouchableOpacity>
              <View>
                <Text className="text-xl font-black" style={{ color: colors.text }}>Profil Pengguna</Text>
                <Text className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.textMuted }}>Detail akun Kasir Pro Anda</Text>
              </View>
            </View>
            <View className="flex-1 p-6">

            <View 
              className="p-6 rounded-3xl border mb-6 items-center"
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            >
              <TouchableOpacity onPress={handlePickProfilePhoto} disabled={isUploadingPhoto} className="relative w-24 h-24 rounded-full mb-4 bg-teal-500/10 border-2 border-teal-500/20 items-center justify-center overflow-hidden">
                {editProfilePhoto ? (
                  <Image source={{ uri: editProfilePhoto }} className="w-full h-full" />
                ) : (
                  <Text className="text-4xl font-black text-teal-500">{user?.email?.[0].toUpperCase()}</Text>
                )}
                <View className="absolute bottom-0 w-full bg-black/50 py-1 items-center">
                  <Camera color="white" size={12} />
                </View>
                {isUploadingPhoto && (
                   <View className="absolute inset-0 bg-black/60 items-center justify-center">
                      <ActivityIndicator color="white" />
                   </View>
                )}
              </TouchableOpacity>
              
              <Text className="text-xs font-bold uppercase tracking-widest text-teal-500 mb-1">
                {role === 'admin' ? 'Owner (Admin)' : 'Kasir'}
              </Text>

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
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* 3. PREMIUM RUNTIME SETUP MODAL */}
      <Modal visible={activeModal === 'premium'} animationType="fade" transparent onRequestClose={() => setActiveModal(null)}>
        <View className="flex-1 bg-black/75 items-center justify-center p-6">
          <View className="w-full max-w-sm rounded-[36px] p-8 items-center" style={{ backgroundColor: colors.surface }}>
            <View className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 items-center justify-center mb-4">
              <AlertCircle size={28} color="#f59e0b" />
            </View>
            <Text className="text-lg font-black text-center mb-2" style={{ color: colors.text }}>
              {selectedPremiumFeature}
            </Text>
            <Text className="text-xs text-center leading-relaxed mb-6" style={{ color: colors.textMuted }}>
              Fitur manajemen ini masuk dalam paket **Kasir Pro SaaS Premium**. Hubungi administrator Anda untuk meningkatkan lisensi outlet toko Anda.
            </Text>
            <TouchableOpacity 
              onPress={() => setActiveModal(null)} 
              className="w-full py-4 rounded-2xl items-center justify-center"
              style={{ backgroundColor: colors.accent }}
            >
              <Text className="font-black text-white text-xs uppercase tracking-wider">MENGALAMI LEBIH LANJUT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 4. STORE SETTINGS MODAL */}
      <Modal visible={activeModal === 'storeSettings'} animationType="slide" transparent={false} onRequestClose={() => setActiveModal(null)}>
        <SafeAreaView className="flex-1" edges={['top', 'bottom']} style={{ backgroundColor: colors.bg }}>
          <View className="flex-row items-center px-6 py-4 border-b" style={{ borderColor: colors.border + '30' }}>
            <TouchableOpacity onPress={() => setActiveModal(null)} className="w-10 h-10 rounded-full bg-black/5 items-center justify-center mr-4">
              <ArrowLeft color={colors.text} size={20} />
            </TouchableOpacity>
            <View>
              <Text className="text-xl font-black" style={{ color: colors.text }}>Pengaturan Toko</Text>
              <Text className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.textMuted }}>Konfigurasi profil bisnis & struk</Text>
            </View>
          </View>
          <View className="flex-1 p-6 pb-0">

            {isLoadingSettings ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            ) : (
              <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <View className="space-y-6 pb-20">
                  {/* Profil Toko Section */}
                  <View className="space-y-4">
                    <Text className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: colors.accent }}>Profil Toko</Text>

                    {/* Logo Toko Section */}
                    <View className="space-y-2">
                      <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Logo Utama</Text>
                      <View className="flex-row items-center gap-4 p-4 rounded-2xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                        <View className="w-16 h-16 rounded-xl bg-black/10 border overflow-hidden items-center justify-center" style={{ borderColor: colors.border }}>
                          {storeSettings.logoUrl ? (
                            <Image source={{ uri: storeSettings.logoUrl }} className="w-full h-full" style={{ resizeMode: 'contain' }} />
                          ) : (
                            <Text className="text-[8px] font-bold text-slate-500 uppercase tracking-tight text-center">NO LOGO</Text>
                          )}
                        </View>
                        <View className="flex-1 gap-2">
                          <TouchableOpacity 
                            onPress={handlePickLogoMobile}
                            disabled={isUploadingLogo}
                            className="px-4 py-2.5 rounded-xl items-center justify-center"
                            style={{ backgroundColor: colors.accent }}
                          >
                            {isUploadingLogo ? (
                              <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                              <Text className="text-[10px] font-black text-white uppercase tracking-wider">Pilih Logo Baru</Text>
                            )}
                          </TouchableOpacity>
                          {storeSettings.logoUrl !== '' && (
                            <TouchableOpacity 
                              onPress={() => setStoreSettings(prev => ({ ...prev, logoUrl: '' }))}
                              className="px-4 py-2 rounded-xl items-center justify-center border border-rose-500/20 bg-rose-500/10"
                            >
                              <Text className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Hapus</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Logo Thermal Section */}
                    <View className="space-y-2">
                      <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Logo Struk Thermal (B&W)</Text>
                      <View className="flex-row items-center gap-4 p-4 rounded-2xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                        <View className="w-16 h-16 rounded-xl bg-white border overflow-hidden items-center justify-center" style={{ borderColor: colors.border }}>
                          {storeSettings.thermalLogoUrl ? (
                            <Image source={{ uri: storeSettings.thermalLogoUrl }} className="w-full h-full" style={{ resizeMode: 'contain' }} />
                          ) : (
                            <Text className="text-[8px] font-bold text-slate-500 uppercase tracking-tight text-center">NO LOGO</Text>
                          )}
                        </View>
                        <View className="flex-1 gap-2">
                          <TouchableOpacity 
                            onPress={handlePickThermalLogoMobile}
                            disabled={isUploadingThermalLogo}
                            className="px-4 py-2.5 rounded-xl items-center justify-center"
                            style={{ backgroundColor: colors.accent }}
                          >
                            {isUploadingThermalLogo ? (
                              <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                              <Text className="text-[10px] font-black text-white uppercase tracking-wider">Pilih Logo Thermal</Text>
                            )}
                          </TouchableOpacity>
                          {storeSettings.thermalLogoUrl !== '' && (
                            <TouchableOpacity 
                              onPress={() => setStoreSettings(prev => ({ ...prev, thermalLogoUrl: '' }))}
                              className="px-4 py-2 rounded-xl items-center justify-center border border-rose-500/20 bg-rose-500/10"
                            >
                              <Text className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Hapus</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Foto QRIS Section */}
                    <View className="space-y-2">
                      <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Foto QRIS Pembayaran</Text>
                      <View className="flex-row items-center gap-4 p-4 rounded-2xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                        <View className="w-16 h-16 rounded-xl bg-white border overflow-hidden items-center justify-center" style={{ borderColor: colors.border }}>
                          {storeSettings.qrisUrl ? (
                            <Image source={{ uri: storeSettings.qrisUrl }} className="w-full h-full" style={{ resizeMode: 'contain' }} />
                          ) : (
                            <Text className="text-[8px] font-bold text-slate-500 uppercase tracking-tight text-center">NO QRIS</Text>
                          )}
                        </View>
                        <View className="flex-1 gap-2">
                          <TouchableOpacity 
                            onPress={handlePickQrisMobile}
                            disabled={isUploadingQris}
                            className="px-4 py-2.5 rounded-xl items-center justify-center"
                            style={{ backgroundColor: colors.accent }}
                          >
                            {isUploadingQris ? (
                              <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                              <Text className="text-[10px] font-black text-white uppercase tracking-wider">Pilih Foto QRIS</Text>
                            )}
                          </TouchableOpacity>
                          {storeSettings.qrisUrl !== '' && (
                            <TouchableOpacity 
                              onPress={() => setStoreSettings(prev => ({ ...prev, qrisUrl: '' }))}
                              className="px-4 py-2 rounded-xl items-center justify-center border border-rose-500/20 bg-rose-500/10"
                            >
                              <Text className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Hapus</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Store Name Input */}
                    <View className="space-y-1">
                      <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Nama Toko</Text>
                      <TextInput
                        value={storeSettings.storeName}
                        onChangeText={(txt) => setStoreSettings(prev => ({ ...prev, storeName: txt }))}
                        placeholder="Nama Toko..."
                        placeholderTextColor={colors.textMuted}
                        className="p-4 rounded-2xl border font-bold text-xs"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }}
                      />
                    </View>

                    {/* Address Input */}
                    <View className="space-y-1">
                      <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Alamat Lengkap</Text>
                      <TextInput
                        value={storeSettings.address}
                        onChangeText={(txt) => setStoreSettings(prev => ({ ...prev, address: txt }))}
                        placeholder="Alamat Toko..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        numberOfLines={3}
                        className="p-4 rounded-2xl border font-bold text-xs min-h-[80px]"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, textAlignVertical: 'top' }}
                      />
                    </View>

                    {/* Phone Input */}
                    <View className="space-y-1">
                      <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Nomor Telepon</Text>
                      <TextInput
                        value={storeSettings.phone}
                        onChangeText={(txt) => setStoreSettings(prev => ({ ...prev, phone: txt }))}
                        placeholder="e.g. 0812-3456-7890"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="phone-pad"
                        className="p-4 rounded-2xl border font-bold text-xs"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }}
                      />
                    </View>

                    {/* Bank Info Input */}
                    <View className="space-y-1">
                      <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Info Rekening / Pembayaran</Text>
                      <TextInput
                        value={storeSettings.bankInfo}
                        onChangeText={(txt) => setStoreSettings(prev => ({ ...prev, bankInfo: txt }))}
                        placeholder="e.g. BCA 123456789 a.n Toko"
                        placeholderTextColor={colors.textMuted}
                        multiline
                        numberOfLines={2}
                        className="p-4 rounded-2xl border font-bold text-xs min-h-[60px]"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, textAlignVertical: 'top' }}
                      />
                    </View>

                    {/* Catatan A4 Invoice Input */}
                    <View className="space-y-1">
                      <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Catatan A4 (Invoice)</Text>
                      <TextInput
                        value={storeSettings.a4InvoiceNote}
                        onChangeText={(txt) => setStoreSettings(prev => ({ ...prev, a4InvoiceNote: txt }))}
                        placeholder="Contoh: * Barang yang sudah dibeli tidak dapat ditukar..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        numberOfLines={2}
                        className="p-4 rounded-2xl border font-bold text-xs min-h-[60px]"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, textAlignVertical: 'top' }}
                      />
                    </View>

                    {/* Catatan A4 Estimasi Input */}
                    <View className="space-y-1">
                      <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Catatan A4 (Estimasi)</Text>
                      <TextInput
                        value={storeSettings.a4EstimationNote}
                        onChangeText={(txt) => setStoreSettings(prev => ({ ...prev, a4EstimationNote: txt }))}
                        placeholder="Contoh: * Harga diatas adalah estimasi biaya pengerjaan..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        numberOfLines={2}
                        className="p-4 rounded-2xl border font-bold text-xs min-h-[60px]"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, textAlignVertical: 'top' }}
                      />
                    </View>

                    {/* Catatan A4 Piutang Input */}
                    <View className="space-y-1">
                      <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Catatan A4 (Piutang / Hutang)</Text>
                      <TextInput
                        value={storeSettings.a4DebtNote}
                        onChangeText={(txt) => setStoreSettings(prev => ({ ...prev, a4DebtNote: txt }))}
                        placeholder="Contoh: * Sisa tagihan piutang wajib dilunasi sebelum jatuh tempo..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        numberOfLines={2}
                        className="p-4 rounded-2xl border font-bold text-xs min-h-[60px]"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, textAlignVertical: 'top' }}
                      />
                    </View>

                    {/* Tanda Tangan Section */}
                    <View className="space-y-2">
                      <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Tanda Tangan Toko</Text>
                      <View className="flex-row items-center gap-4 p-4 rounded-2xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                        <View className="w-16 h-16 rounded-xl bg-white border overflow-hidden items-center justify-center p-1" style={{ borderColor: colors.border }}>
                          {storeSettings.signatureUrl ? (
                            <Image source={{ uri: storeSettings.signatureUrl }} className="w-full h-full" style={{ resizeMode: 'contain' }} />
                          ) : (
                            <Text className="text-[8px] font-bold text-slate-400 uppercase tracking-tight text-center">BELUM ADA</Text>
                          )}
                        </View>
                        <View className="flex-1 gap-2">
                          <TouchableOpacity 
                            onPress={() => setShowSignaturePadMobile(true)}
                            disabled={isUploadingSignature}
                            className="px-4 py-2.5 rounded-xl items-center justify-center"
                            style={{ backgroundColor: colors.accent }}
                          >
                            {isUploadingSignature ? (
                              <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                              <Text className="text-[10px] font-black text-white uppercase tracking-wider">Ubah Tanda Tangan</Text>
                            )}
                          </TouchableOpacity>
                          {storeSettings.signatureUrl !== '' && (
                            <TouchableOpacity 
                              onPress={() => setStoreSettings(prev => ({ ...prev, signatureUrl: '' }))}
                              className="px-4 py-2 rounded-xl items-center justify-center border border-rose-500/20 bg-rose-500/10"
                            >
                              <Text className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Hapus</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Format Penomoran Dokumen Section */}
                  <View className="space-y-4 pt-4 border-t" style={{ borderColor: colors.border }}>
                    <Text className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: colors.accent }}>Format Penomoran Dokumen</Text>
                    
                    {[
                      { key: 'trx', label: 'Transaksi Tunai / Lunas' },
                      { key: 'ord', label: 'Pesanan Online / Delivery' },
                      { key: 'deb', label: 'Transaksi Piutang (Kasir)' },
                      { key: 'est', label: 'Penawaran / Estimasi Biaya' }
                    ].map((docType) => {
                      const prefixKey = `${docType.key}Prefix`;
                      const paddingKey = `${docType.key}Padding`;
                      const counterKey = `${docType.key}Counter`;

                      const prefixVal = (storeSettings as any)[prefixKey];
                      const paddingVal = (storeSettings as any)[paddingKey];
                      const counterVal = (storeSettings as any)[counterKey];

                      return (
                        <View key={docType.key} className="p-4 rounded-2xl border space-y-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                          <Text className="text-[10px] font-black uppercase tracking-wide" style={{ color: colors.text }}>{docType.label}</Text>
                          
                          <View className="flex-row gap-3">
                            <View className="flex-1 space-y-1">
                              <Text className="text-[8px] font-bold text-slate-400 uppercase">Awalan</Text>
                              <TextInput
                                value={prefixVal}
                                onChangeText={(txt) => setStoreSettings(prev => ({ ...prev, [prefixKey]: txt.toUpperCase() }))}
                                placeholder="Prefix..."
                                autoCapitalize="characters"
                                className="p-2.5 rounded-xl border font-bold text-[11px]"
                                style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                              />
                            </View>
                            <View className="flex-1 space-y-1">
                              <Text className="text-[8px] font-bold text-slate-400 uppercase">Padding (0)</Text>
                              <TextInput
                                value={String(paddingVal)}
                                onChangeText={(txt) => setStoreSettings(prev => ({ ...prev, [paddingKey]: Number(txt) || 0 }))}
                                placeholder="4"
                                keyboardType="numeric"
                                className="p-2.5 rounded-xl border font-bold text-[11px]"
                                style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                              />
                            </View>
                          </View>

                          <View className="space-y-1">
                            <Text className="text-[8px] font-bold text-slate-400 uppercase">Nomor Urut Terakhir</Text>
                            <TextInput
                              value={String(counterVal)}
                              onChangeText={(txt) => setStoreSettings(prev => ({ ...prev, [counterKey]: Number(txt) || 0 }))}
                              placeholder="0"
                              keyboardType="numeric"
                              className="p-2.5 rounded-xl border font-bold text-[11px]"
                              style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                            />
                          </View>

                          <Text className="text-[9px] text-slate-500 italic">
                            Contoh: <Text className="font-bold" style={{ color: colors.text }}>{prefixVal}{String(Number(counterVal) + 1).padStart(Number(paddingVal) || 4, '0')}</Text>
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Pengaturan Pajak & Struk Section */}
                  <View className="space-y-4 pt-4 border-t" style={{ borderColor: colors.border }}>
                    <Text className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: colors.accent }}>Pajak & Struk</Text>

                    {/* PPN Toggle */}
                    <View 
                      className="p-4 rounded-2xl border flex-row items-center justify-between"
                      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                      <Text className="text-xs font-bold" style={{ color: colors.text }}>Aktifkan Pajak (PPN)</Text>
                      <Switch
                        value={storeSettings.useTax}
                        onValueChange={(val) => setStoreSettings(prev => ({ ...prev, useTax: val }))}
                        trackColor={{ false: colors.border, true: colors.accent }}
                        thumbColor="#ffffff"
                      />
                    </View>

                    {/* PPN Rate Input */}
                    {storeSettings.useTax && (
                      <View className="space-y-1">
                        <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Pajak PPN (%)</Text>
                        <TextInput
                          value={String(storeSettings.taxRate)}
                          onChangeText={(txt) => setStoreSettings(prev => ({ ...prev, taxRate: Number(txt) || 0 }))}
                          placeholder="11"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                          className="p-4 rounded-2xl border font-bold text-xs"
                          style={{ backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }}
                        />
                      </View>
                    )}

                    {/* Paper Size Picker */}
                    <View className="space-y-1">
                      <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Ukuran Kertas Printer</Text>
                      <View className="flex-row gap-2 bg-black/10 p-1 rounded-2xl">
                        <TouchableOpacity
                          onPress={() => setStoreSettings(prev => ({ ...prev, paperSize: '58mm' }))}
                          className="flex-1 py-3 rounded-xl items-center"
                          style={{ backgroundColor: storeSettings.paperSize === '58mm' ? colors.accent : 'transparent' }}
                        >
                          <Text className="text-[10px] font-black uppercase" style={{ color: storeSettings.paperSize === '58mm' ? '#ffffff' : colors.text }}>58mm (Kecil)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setStoreSettings(prev => ({ ...prev, paperSize: '80mm' }))}
                          className="flex-1 py-3 rounded-xl items-center"
                          style={{ backgroundColor: storeSettings.paperSize === '80mm' ? colors.accent : 'transparent' }}
                        >
                          <Text className="text-[10px] font-black uppercase" style={{ color: storeSettings.paperSize === '80mm' ? '#ffffff' : colors.text }}>80mm (Sedang)</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Gaya Font Nama Toko */}
                    <View className="space-y-1">
                      <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Gaya Font Nama Toko</Text>
                      <View className="flex-row flex-wrap gap-2.5">
                        {FONT_OPTIONS.map((font) => {
                          const isSelected = storeSettings.storeNameFont === font.id;
                          return (
                            <TouchableOpacity
                              key={font.id}
                              onPress={() => setStoreSettings(prev => ({ ...prev, storeNameFont: font.id }))}
                              activeOpacity={0.8}
                              className="p-3 rounded-xl border flex-1 min-w-[40%]"
                              style={{ 
                                backgroundColor: colors.surface, 
                                borderColor: isSelected ? colors.accent : colors.border 
                              }}
                            >
                              <Text className="text-[8px] font-bold text-slate-400 uppercase">{font.name}</Text>
                              <Text 
                                className="text-xs font-bold mt-1" 
                                style={{ color: colors.text, fontFamily: font.family }}
                              >
                                {storeSettings.storeName || 'Nama Toko'}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Receipt Message (Footer message) */}
                    <View className="space-y-1">
                      <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Pesan Footer Struk</Text>
                      <TextInput
                        value={storeSettings.receiptMessage}
                        onChangeText={(txt) => setStoreSettings(prev => ({ ...prev, receiptMessage: txt }))}
                        placeholder="Terima Kasih..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        numberOfLines={3}
                        className="p-4 rounded-2xl border font-bold text-xs min-h-[80px]"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, textAlignVertical: 'top' }}
                      />
                    </View>

                    {/* LIVE PREVIEW STRUK */}
                    <View className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden my-2">
                      <View className="flex-row items-center gap-2 mb-4">
                        <View className="w-2 h-2 rounded-full bg-emerald-500" />
                        <Text className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Preview Struk Real-Time</Text>
                      </View>
                      
                      <View className="bg-white p-5 rounded-2xl mx-auto w-[200px] space-y-1.5 border-t-8 border-slate-200">
                        <View className="items-center mb-3">
                          {storeSettings.logoUrl !== '' && storeSettings.showLogoOnReceipt ? (
                            <Image source={{ uri: storeSettings.logoUrl }} className="w-8 h-8 object-contain mb-1" />
                          ) : null}
                          <Text 
                            className="text-xs font-black text-slate-900 uppercase text-center"
                            style={{ fontFamily: getFontFamily(storeSettings.storeNameFont) }}
                          >
                            {storeSettings.storeName || 'KASIR PRO'}
                          </Text>
                          {storeSettings.showReceiptAddress && (
                            <Text className="text-[8px] text-slate-500 text-center">{storeSettings.address || 'Alamat Toko...'}</Text>
                          )}
                          {storeSettings.showReceiptPhone && (
                            <Text className="text-[8px] text-slate-500 text-center">Telp: {storeSettings.phone || '-'}</Text>
                          )}
                        </View>
                        
                        <View className="border-b border-dashed border-slate-300 py-1 flex-row justify-between">
                          <Text className="text-[9px] font-mono text-slate-800">ITEM x1</Text>
                          <Text className="text-[9px] font-mono text-slate-800">10.000</Text>
                        </View>
                        
                        <View className="flex-row justify-between font-black pt-1">
                          <Text className="text-[9px] font-mono text-slate-900 font-bold">TOTAL</Text>
                          <Text className="text-[9px] font-mono text-slate-900 font-bold">10.000</Text>
                        </View>

                        {storeSettings.showSignature && storeSettings.signatureUrl !== '' ? (
                          <View className="items-center py-2 border-t border-slate-100 mt-2">
                            <Image source={{ uri: storeSettings.signatureUrl }} className="w-12 h-6 object-contain" />
                            <Text className="text-[6px] text-slate-400 mt-0.5">Tanda Tangan Toko</Text>
                          </View>
                        ) : null}

                        <Text className="text-center pt-3 text-[7px] text-slate-400 italic">
                          {storeSettings.receiptMessage || 'Terima Kasih'}
                        </Text>
                      </View>
                      
                      <Text className="mt-3 text-center text-[8px] text-slate-500 font-bold italic">
                        *Tampilan di atas adalah simulasi struk belanja.
                      </Text>
                    </View>

                    {/* Toggles Grid */}
                    <Text className="text-[9px] font-black uppercase tracking-wider pl-1 mt-2" style={{ color: colors.textMuted }}>Visibilitas Struk</Text>
                    <View className="flex-row flex-wrap gap-2.5">
                      {[
                        { id: 'showLogoOnReceipt', label: 'Tampilkan Logo Toko' },
                        { id: 'showReceiptAddress', label: 'Tampilkan Alamat Toko' },
                        { id: 'showReceiptPhone', label: 'Tampilkan No. Telepon' },
                        { id: 'showReceiptCustomer', label: 'Tampilkan Nama Pelanggan' },
                        { id: 'showReceiptCashier', label: 'Tampilkan Nama Kasir' },
                        { id: 'showReceiptSubtotal', label: 'Tampilkan Detail Subtotal' },
                        { id: 'showSignature', label: 'Tampilkan Tanda Tangan' }
                      ].map((toggle) => {
                        const isChecked = (storeSettings as any)[toggle.id];
                        return (
                          <TouchableOpacity
                            key={toggle.id}
                            onPress={() => setStoreSettings(prev => ({ ...prev, [toggle.id]: !isChecked }))}
                            activeOpacity={0.8}
                            className="w-[48%] p-3.5 rounded-xl border flex-row items-center gap-2.5"
                            style={{ 
                              backgroundColor: colors.surface, 
                              borderColor: isChecked ? colors.accent : colors.border 
                            }}
                          >
                            <View 
                              className="w-4 h-4 rounded border items-center justify-center"
                              style={{ 
                                backgroundColor: isChecked ? colors.accent : 'transparent',
                                borderColor: isChecked ? colors.accent : colors.border
                              }}
                            >
                              {isChecked && <Check size={10} color="#ffffff" strokeWidth={4} />}
                            </View>
                            <Text className="text-[10px] font-bold flex-1" style={{ color: colors.text }}>
                              {toggle.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Konfigurasi Pemesanan Online Section */}
                  <View className="space-y-4 pt-4 border-t" style={{ borderColor: colors.border }}>
                    <Text className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: colors.accent }}>Konfigurasi Pemesanan Online</Text>

                    {/* allowPickup Toggle */}
                    <View 
                      className="p-4 rounded-2xl border flex-row items-center justify-between"
                      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                      <Text className="text-xs font-bold" style={{ color: colors.text }}>Aktifkan Ambil di Tempat</Text>
                      <Switch
                        value={storeSettings.allowPickup}
                        onValueChange={(val) => setStoreSettings(prev => ({ ...prev, allowPickup: val }))}
                        trackColor={{ false: colors.border, true: colors.accent }}
                        thumbColor="#ffffff"
                      />
                    </View>

                    {/* allowDelivery Toggle */}
                    <View 
                      className="p-4 rounded-2xl border flex-row items-center justify-between"
                      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                      <Text className="text-xs font-bold" style={{ color: colors.text }}>Aktifkan Pengiriman</Text>
                      <Switch
                        value={storeSettings.allowDelivery}
                        onValueChange={(val) => setStoreSettings(prev => ({ ...prev, allowDelivery: val }))}
                        trackColor={{ false: colors.border, true: colors.accent }}
                        thumbColor="#ffffff"
                      />
                    </View>

                    {/* deliveryFee Input */}
                    {storeSettings.allowDelivery && (
                      <View className="space-y-1">
                        <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Biaya Pengiriman (Rp)</Text>
                        <TextInput
                          value={String(storeSettings.deliveryFee)}
                          onChangeText={(txt) => setStoreSettings(prev => ({ ...prev, deliveryFee: Number(txt) || 0 }))}
                          placeholder="0"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                          className="p-4 rounded-2xl border font-bold text-xs"
                          style={{ backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }}
                        />
                      </View>
                    )}

                    {/* themeColorHex Color Options and Input */}
                    <View className="space-y-1">
                      <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Tema Aksen Halaman Online</Text>
                      
                      <View className="flex-row flex-wrap gap-2.5 my-2">
                        {['#10b981', '#3b82f6', '#f43f5e', '#8b5cf6', '#f59e0b', '#0f172a'].map(color => (
                          <TouchableOpacity
                            key={color}
                            onPress={() => setStoreSettings(prev => ({ ...prev, themeColorHex: color }))}
                            className="w-8 h-8 rounded-full border-2 items-center justify-center"
                            style={{ 
                              backgroundColor: color, 
                              borderColor: storeSettings.themeColorHex === color ? colors.text : 'transparent' 
                            }}
                          >
                            {storeSettings.themeColorHex === color && <Check size={12} color="#ffffff" strokeWidth={3} />}
                          </TouchableOpacity>
                        ))}
                      </View>

                      <TextInput
                        value={storeSettings.themeColorHex}
                        onChangeText={(txt) => setStoreSettings(prev => ({ ...prev, themeColorHex: txt }))}
                        placeholder="#10b981"
                        placeholderTextColor={colors.textMuted}
                        className="p-4 rounded-2xl border font-bold text-xs"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }}
                      />
                    </View>
                  </View>
                  {/* Template WhatsApp Section */}
                  <View className="space-y-4 pt-4 border-t" style={{ borderColor: colors.border }}>
                    <Text className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: colors.accent }}>Template WhatsApp</Text>
                    <Text className="text-[8px] font-bold text-slate-400 italic leading-normal pl-1">
                      Variabel didukung: {"{customerName}, {trxId}, {total}, {paid}, {debt}, {dueDate}, {storeName}"}
                    </Text>
                    <TextInput
                      value={storeSettings.waTemplate}
                      onChangeText={(txt) => setStoreSettings(prev => ({ ...prev, waTemplate: txt }))}
                      placeholder="Template WhatsApp..."
                      placeholderTextColor={colors.textMuted}
                      multiline
                      numberOfLines={6}
                      className="p-4 rounded-2xl border font-mono text-xs min-h-[140px] leading-relaxed"
                      style={{ backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, textAlignVertical: 'top' }}
                    />
                  </View>

                  {/* Keamanan / Ubah Sandi Section */}
                  <View className="space-y-4 pt-4 border-t" style={{ borderColor: colors.border }}>
                    <Text className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: colors.accent }}>Keamanan (Ubah Sandi Akun)</Text>
                    
                    <View className="p-4 rounded-3xl border space-y-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                      
                      <View className="space-y-1">
                        <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Kata Sandi Lama</Text>
                        <TextInput
                          value={oldPassword}
                          onChangeText={setOldPassword}
                          secureTextEntry
                          placeholder="••••••"
                          placeholderTextColor={colors.textMuted}
                          className="p-4 rounded-2xl border font-bold text-xs"
                          style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                        />
                      </View>

                      <View className="space-y-1">
                        <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Kata Sandi Baru</Text>
                        <TextInput
                          value={newPassword}
                          onChangeText={setNewPassword}
                          secureTextEntry
                          placeholder="Minimal 6 karakter"
                          placeholderTextColor={colors.textMuted}
                          className="p-4 rounded-2xl border font-bold text-xs"
                          style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                        />
                      </View>

                      <View className="space-y-1">
                        <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Konfirmasi Sandi Baru</Text>
                        <TextInput
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                          secureTextEntry
                          placeholder="Ulangi sandi baru"
                          placeholderTextColor={colors.textMuted}
                          className="p-4 rounded-2xl border font-bold text-xs"
                          style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                        />
                      </View>

                      <TouchableOpacity
                        onPress={handlePasswordChangeMobile}
                        disabled={isChangingPassword}
                        className="py-3.5 rounded-2xl items-center justify-center flex-row gap-2 mt-2"
                        style={{ backgroundColor: colors.accent }}
                      >
                        {isChangingPassword ? (
                          <ActivityIndicator color="#ffffff" size="small" />
                        ) : (
                          <>
                            <Check color="#ffffff" size={14} strokeWidth={3} />
                            <Text className="font-black text-white text-[10px] uppercase tracking-wider">Simpan Sandi Baru</Text>
                          </>
                        )}
                      </TouchableOpacity>

                    </View>
                  </View>

                  {/* Backup & Restore Data Section */}
                  <View className="space-y-4 pt-4 border-t" style={{ borderColor: colors.border }}>
                    <Text className="text-[10px] font-black uppercase tracking-widest pl-1" style={{ color: colors.accent }}>Backup & Restore Data</Text>
                    
                    <View className="p-4 rounded-3xl border space-y-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                      <Text className="text-[10px] font-bold leading-normal text-slate-400">
                        Simpan cadangan seluruh data toko Anda ke dalam file JSON atau pulihkan data dari file cadangan sebelumnya.
                      </Text>

                      <View className="flex-row gap-3">
                        <TouchableOpacity
                          onPress={handleExportJSONMobile}
                          disabled={isBackuping || isRestoring}
                          className="flex-1 py-4 rounded-xl items-center justify-center flex-row gap-2"
                          style={{ backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1 }}
                        >
                          {isBackuping ? (
                            <ActivityIndicator size="small" color={colors.text} />
                          ) : (
                            <>
                              <Download color={colors.text} size={14} />
                              <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: colors.text }}>Unduh Backup</Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={handleImportJSONMobile}
                          disabled={isBackuping || isRestoring}
                          className="flex-1 py-4 rounded-xl items-center justify-center flex-row gap-2"
                          style={{ backgroundColor: colors.accent + '15', borderColor: colors.accent + '30', borderWidth: 1 }}
                        >
                          {isRestoring ? (
                            <ActivityIndicator size="small" color={colors.accent} />
                          ) : (
                            <>
                              <UploadCloud color={colors.accent} size={14} />
                              <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: colors.accent }}>Unggah Backup</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>

                      {isRestoring && (
                        <View className="space-y-1.5 items-center">
                          <Text className="text-[9px] font-black text-emerald-500 uppercase tracking-widest animate-pulse">Memulihkan... {restoreProgress}%</Text>
                        </View>
                      )}

                      <View className="p-3.5 rounded-2xl flex-row items-start gap-2 bg-amber-500/10 border border-amber-500/20">
                        <AlertCircle color="#f59e0b" size={16} style={{ marginTop: 2 }} />
                        <View className="flex-1">
                          <Text className="text-[8px] font-black text-amber-500 uppercase tracking-wider mb-0.5">Penting</Text>
                          <Text className="text-[8px] font-bold text-amber-500 leading-normal">
                            Proses restore data akan menggabungkan data dari file backup dengan data saat ini di Cloud. Dokumen dengan ID yang sama akan diperbarui nilainya.
                          </Text>
                        </View>
                      </View>

                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={handleSaveStoreSettings}
                    disabled={isSavingSettings}
                    className="py-4 rounded-2xl items-center justify-center flex-row gap-2 mt-4"
                    style={{ backgroundColor: colors.accent }}
                  >
                    {isSavingSettings ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <>
                        <Check color="#ffffff" size={16} strokeWidth={3} />
                        <Text className="font-black text-white text-xs uppercase tracking-wider">Simpan Perubahan</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* 5. MOBILE SIGNATURE DRAWING MODAL */}
      <Modal visible={showSignaturePadMobile} animationType="slide" transparent onRequestClose={() => setShowSignaturePadMobile(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="h-[55%] rounded-t-[40px] p-6 pb-10" style={{ backgroundColor: colors.bg }}>
            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Text className="text-base font-black" style={{ color: colors.text }}>Gambar Tanda Tangan Toko</Text>
                <Text className="text-[10px] font-bold" style={{ color: colors.textMuted }}>Gunakan jari Anda di area gambar</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSignaturePadMobile(false)} className="w-8 h-8 rounded-full bg-black/10 items-center justify-center">
                <X color={colors.text} size={16} />
              </TouchableOpacity>
            </View>
            <View className="flex-1 bg-white rounded-2xl overflow-hidden border border-slate-200">
               <SignaturePad 
                  onOK={handleSaveSignatureMobile}
                  onCancel={() => setShowSignaturePadMobile(false)}
               />
            </View>
          </View>
        </View>
      </Modal>

      {/* 6. SUPER ADMIN - DATA USER MODAL */}
      <Modal visible={activeModal === 'superAdminUsers'} animationType="slide" transparent onRequestClose={() => setActiveModal(null)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="h-[92%] rounded-t-[40px] p-6 pb-12" style={{ backgroundColor: colors.bg }}>
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-xl font-black" style={{ color: colors.text }}>Data Pengguna</Text>
                <Text className="text-xs font-bold" style={{ color: colors.textMuted }}>Kelola akses & langganan tenant</Text>
              </View>
              <TouchableOpacity onPress={() => { setActiveModal(null); setSuperAdminSearchQuery(''); }} className="w-10 h-10 rounded-full bg-black/10 items-center justify-center">
                <X color={colors.text} size={20} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View className="flex-row items-center border rounded-2xl px-4 py-1 mb-4" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
              <TextInput
                placeholder="Cari user berdasarkan nama/email..."
                placeholderTextColor={colors.textMuted + '80'}
                value={superAdminSearchQuery}
                onChangeText={setSuperAdminSearchQuery}
                className="flex-1 h-12 font-bold text-xs"
                style={{ color: colors.text }}
              />
              {superAdminSearchQuery !== '' && (
                <TouchableOpacity onPress={() => setSuperAdminSearchQuery('')}>
                  <X size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <View className="space-y-4 pb-20">
                {superAdminUsers
                  .filter(u => 
                    u.name?.toLowerCase().includes(superAdminSearchQuery.toLowerCase()) || 
                    u.email?.toLowerCase().includes(superAdminSearchQuery.toLowerCase())
                  )
                  .map((u) => {
                    const userStore = superAdminStores.find(s => s.id === u.storeId);
                    return (
                      <View 
                        key={u.id} 
                        className="p-5 rounded-3xl border space-y-3" 
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                      >
                        <View className="flex-row items-start justify-between">
                          <View className="flex-row items-center gap-3 flex-1">
                            <View className="w-10 h-10 rounded-xl items-center justify-center bg-amber-500/10 border border-amber-500/20">
                              <Text className="text-sm font-black text-amber-500">{u.email?.[0].toUpperCase()}</Text>
                            </View>
                            <View className="flex-1 pr-2">
                              <Text className="text-xs font-black" style={{ color: colors.text }} numberOfLines={1}>{u.name || 'No Name'}</Text>
                              <Text className="text-[9px] font-bold text-slate-400" numberOfLines={1}>{u.email}</Text>
                              <Text className="text-[9px] font-bold text-teal-500 mt-0.5" numberOfLines={1}>Toko: {userStore?.name || 'Toko Default'}</Text>
                            </View>
                          </View>
                          <View className="flex-row gap-2">
                            <TouchableOpacity 
                              onPress={() => setMigratingUser(u)}
                              className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl"
                            >
                              <ArrowRight size={14} color="#f59e0b" />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              onPress={() => setEditingUser(u)}
                              className="p-2.5 bg-teal-500/10 border border-teal-500/20 rounded-xl"
                            >
                              <UserCheck size={14} color="#14b8a6" />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              onPress={() => handleDeleteUserPermanently(u.id, u.email || 'No Email')}
                              className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl"
                            >
                              <Trash2 size={14} color="#f43f5e" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View className="flex-row justify-between pt-2 border-t" style={{ borderColor: colors.border + '30' }}>
                          <View className="flex-row gap-1.5 items-center">
                            <Text className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${u.role === 'super-admin' || u.role === 'superadmin' ? 'bg-amber-500/10 text-amber-500' : u.role === 'admin' ? 'bg-teal-500/10 text-teal-500' : 'bg-slate-800 text-slate-400'}`}>
                              {u.role || 'CASHIER'}
                            </Text>
                            <Text className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${u.isActive !== false ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                              {u.isActive !== false ? 'AKTIF' : 'BLOKIR'}
                            </Text>
                            <Text className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${u.isSubscribed ? 'bg-purple-500/10 text-purple-500' : 'bg-slate-800 text-slate-400'}`}>
                              {u.isSubscribed ? 'PRO' : 'FREE'}
                            </Text>
                          </View>
                          <Text className="text-[8px] font-black text-slate-500 font-mono">DB: {u.targetProjectId || 'UTAMA'}</Text>
                        </View>
                      </View>
                    );
                  })}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* USER EDIT DIALOG OVERLAY */}
        {editingUser && (
          <Modal visible={true} animationType="fade" transparent>
            <View className="flex-1 bg-black/80 justify-center p-6">
              <View className="w-full max-w-sm rounded-[36px] p-6 space-y-5" style={{ backgroundColor: colors.surface }}>
                <View className="flex-row justify-between items-center pb-3 border-b" style={{ borderColor: colors.border + '30' }}>
                  <Text className="text-base font-black" style={{ color: colors.text }}>Edit User</Text>
                  <TouchableOpacity onPress={() => setEditingUser(null)}>
                    <X size={20} color={colors.text} />
                  </TouchableOpacity>
                </View>

                {/* Display Name Input */}
                <View className="space-y-1">
                  <Text className="text-[8px] font-black uppercase tracking-wider text-slate-400">Nama Tampilan</Text>
                  <TextInput
                    value={editingUser.name || ''}
                    onChangeText={(txt) => setEditingUser({ ...editingUser, name: txt })}
                    className="p-3.5 rounded-2xl border font-bold text-xs"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                  />
                </View>

                {/* Role Selector */}
                <View className="space-y-1">
                  <Text className="text-[8px] font-black uppercase tracking-wider text-slate-400">Role Akun</Text>
                  <View className="flex-row gap-2">
                    {['cashier', 'admin', 'super-admin'].map((r) => {
                      const isSelected = editingUser.role === r || (r === 'super-admin' && editingUser.role === 'superadmin');
                      return (
                        <TouchableOpacity
                          key={r}
                          onPress={() => setEditingUser({ ...editingUser, role: r })}
                          className="flex-1 py-2.5 rounded-xl border items-center justify-center"
                          style={{ 
                            backgroundColor: isSelected ? colors.accent : colors.bg, 
                            borderColor: isSelected ? colors.accent : colors.border 
                          }}
                        >
                          <Text className="text-[9px] font-black uppercase" style={{ color: isSelected ? '#ffffff' : colors.text }}>{r.replace('-', '')}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Store Mappings Selector */}
                <View className="space-y-1">
                  <Text className="text-[8px] font-black uppercase tracking-wider text-slate-400">Pilih Outlet Toko</Text>
                  <ScrollView className="max-h-[100px] border rounded-2xl p-2" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
                    <TouchableOpacity 
                      onPress={() => setEditingUser({ ...editingUser, storeId: 'default-store' })}
                      className="py-2 px-3 border-b flex-row justify-between items-center" 
                      style={{ borderColor: colors.border + '20' }}
                    >
                      <Text className="text-[10px] font-bold" style={{ color: editingUser.storeId === 'default-store' ? colors.accent : colors.text }}>Toko Default (default-store)</Text>
                      {editingUser.storeId === 'default-store' && <Check size={10} color={colors.accent} />}
                    </TouchableOpacity>
                    {superAdminStores.map((s) => (
                      <TouchableOpacity 
                        key={s.id}
                        onPress={() => setEditingUser({ ...editingUser, storeId: s.id })}
                        className="py-2 px-3 border-b flex-row justify-between items-center"
                        style={{ borderColor: colors.border + '20' }}
                      >
                        <Text className="text-[10px] font-bold" style={{ color: editingUser.storeId === s.id ? colors.accent : colors.text }}>{s.name} ({s.id})</Text>
                        {editingUser.storeId === s.id && <Check size={10} color={colors.accent} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Subscription and Expiry Date Inputs */}
                <View className="flex-row gap-3">
                  <View className="space-y-1 flex-1">
                    <Text className="text-[8px] font-black uppercase tracking-wider text-slate-400">Tanggal Daftar</Text>
                    <TouchableOpacity
                      onPress={() => setShowDatePicker({visible: true, field: 'createdAt'})}
                      className="p-3.5 rounded-2xl border flex-row items-center justify-between"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border }}
                    >
                      <Text className="font-bold text-xs" style={{ color: editingUser.createdAt ? colors.text : colors.textMuted }}>
                        {editingUser.createdAt ? (editingUser.createdAt.includes('T') ? editingUser.createdAt.substring(0, 10) : editingUser.createdAt) : 'Pilih Tanggal'}
                      </Text>
                      <CalendarRange size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <View className="space-y-1 flex-1">
                    <Text className="text-[8px] font-black uppercase tracking-wider text-slate-400">Tanggal Expired</Text>
                    <TouchableOpacity
                      onPress={() => setShowDatePicker({visible: true, field: 'validUntil'})}
                      className="p-3.5 rounded-2xl border flex-row items-center justify-between"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border }}
                    >
                      <Text className="font-bold text-xs" style={{ color: editingUser.validUntil ? colors.text : colors.textMuted }}>
                        {editingUser.validUntil ? (editingUser.validUntil.includes('T') ? editingUser.validUntil.substring(0, 10) : editingUser.validUntil) : 'Pilih Tanggal'}
                      </Text>
                      <CalendarRange size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Freeze and Subscription Toggles */}
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setEditingUser({ ...editingUser, isActive: editingUser.isActive === false })}
                    className="flex-1 py-3 rounded-xl border items-center justify-center"
                    style={{ backgroundColor: editingUser.isActive !== false ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)', borderColor: editingUser.isActive !== false ? 'rgba(244,63,94,0.2)' : 'rgba(16,185,129,0.2)' }}
                  >
                    <Text className="text-[9px] font-black uppercase" style={{ color: editingUser.isActive !== false ? '#f43f5e' : '#10b981' }}>
                      {editingUser.isActive !== false ? 'BEKUKAN AKSES' : 'AKTIFKAN AKSES'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setEditingUser({ ...editingUser, isSubscribed: !editingUser.isSubscribed })}
                    className="flex-1 py-3 rounded-xl border items-center justify-center"
                    style={{ backgroundColor: editingUser.isSubscribed ? 'rgba(148,163,184,0.1)' : 'rgba(139,92,246,0.1)', borderColor: editingUser.isSubscribed ? 'rgba(148,163,184,0.2)' : 'rgba(139,92,246,0.2)' }}
                  >
                    <Text className="text-[9px] font-black uppercase" style={{ color: editingUser.isSubscribed ? colors.text : '#8b5cf6' }}>
                      {editingUser.isSubscribed ? 'BATAL PRO' : 'SET PRO'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Save Changes */}
                <TouchableOpacity
                  onPress={handleUpdateUser}
                  disabled={isSaving}
                  className="py-4 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: colors.accent }}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="font-black text-white text-xs uppercase tracking-wider">Simpan Perubahan</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}

        {/* CALENDAR DATE PICKER MODAL */}
        {showDatePicker.visible && (
          <Modal visible={true} animationType="fade" transparent>
            <View className="flex-1 bg-black/80 justify-center items-center p-6">
              <View className="w-full max-w-sm rounded-[36px] overflow-hidden" style={{ backgroundColor: colors.surface }}>
                <View className="flex-row justify-between items-center p-6 border-b" style={{ borderColor: colors.border + '30' }}>
                  <Text className="text-base font-black" style={{ color: colors.text }}>
                    {showDatePicker.field === 'createdAt' ? 'Pilih Tanggal Daftar' : 'Pilih Tanggal Kedaluwarsa'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowDatePicker({visible: false, field: null})}>
                    <X size={20} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <Calendar
                  theme={{
                    backgroundColor: colors.surface,
                    calendarBackground: colors.surface,
                    textSectionTitleColor: colors.textMuted,
                    selectedDayBackgroundColor: colors.accent,
                    selectedDayTextColor: '#ffffff',
                    todayTextColor: colors.accent,
                    dayTextColor: colors.text,
                    textDisabledColor: colors.textMuted + '50',
                    monthTextColor: colors.text,
                    arrowColor: colors.accent,
                    textDayFontWeight: 'bold',
                    textMonthFontWeight: '900',
                    textDayHeaderFontWeight: '800'
                  }}
                  onDayPress={(day: any) => {
                    const isoDate = new Date(day.dateString).toISOString();
                    if (showDatePicker.field === 'createdAt') {
                      setEditingUser({ ...editingUser, createdAt: isoDate });
                    } else {
                      setEditingUser({ ...editingUser, validUntil: isoDate });
                    }
                    setShowDatePicker({visible: false, field: null});
                  }}
                />
              </View>
            </View>
          </Modal>
        )}

        {/* TENANT DATABASE MIGRATION ROUTING DIALOG OVERLAY */}
        {migratingUser && (
          <Modal visible={true} animationType="fade" transparent>
            <View className="flex-1 bg-black/80 justify-center p-6">
              <View className="w-full max-w-sm rounded-[36px] p-6 space-y-4" style={{ backgroundColor: colors.surface }}>
                <View className="flex-row justify-between items-center pb-2 border-b" style={{ borderColor: colors.border + '30' }}>
                  <Text className="text-base font-black" style={{ color: colors.text }}>Migrasi Database User</Text>
                  <TouchableOpacity onPress={() => setMigratingUser(null)}>
                    <X size={20} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <Text className="text-[10px] font-bold text-slate-400">Pilih target instance database Firestore untuk memetakan akun {migratingUser.email}.</Text>

                <ScrollView className="max-h-[220px] space-y-2">
                  {/* Reset to Primary Option */}
                  <TouchableOpacity
                    onPress={() => handleMigrateUser(migratingUser, null)}
                    className="p-4 rounded-2xl border flex-row justify-between items-center"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border }}
                  >
                    <View>
                      <Text className="text-xs font-black" style={{ color: colors.text }}>DATABASE UTAMA (.ENV)</Text>
                      <Text className="text-[9px] font-bold text-slate-500">Koneksi bawaan developer</Text>
                    </View>
                    {!migratingUser.targetProjectId && <Check size={14} color={colors.accent} />}
                  </TouchableOpacity>

                  {/* Registered Inventory Database Nodes */}
                  {dbProjects.map((proj) => (
                    <TouchableOpacity
                      key={proj.id}
                      onPress={() => handleMigrateUser(migratingUser, proj)}
                      className="p-4 rounded-2xl border flex-row justify-between items-center"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border }}
                    >
                      <View className="flex-1 pr-2">
                        <Text className="text-xs font-black uppercase" style={{ color: colors.text }} numberOfLines={1}>{proj.fb_project_id}</Text>
                        <Text className="text-[9px] font-bold text-slate-500 truncate" numberOfLines={1}>{proj.fb_auth_domain}</Text>
                      </View>
                      {migratingUser.targetProjectId === proj.fb_project_id && <Check size={14} color={colors.accent} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}
      </Modal>

      {/* 7. SUPER ADMIN - KELOLA TOKO MODAL */}
      <Modal visible={activeModal === 'superAdminStores'} animationType="slide" transparent onRequestClose={() => setActiveModal(null)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="h-[92%] rounded-t-[40px] p-6 pb-12" style={{ backgroundColor: colors.bg }}>
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-xl font-black" style={{ color: colors.text }}>Kelola Toko</Text>
                <Text className="text-xs font-bold" style={{ color: colors.textMuted }}>Provisioning outlet merchant</Text>
              </View>
              <TouchableOpacity onPress={() => { setActiveModal(null); setSuperAdminSearchQuery(''); }} className="w-10 h-10 rounded-full bg-black/10 items-center justify-center">
                <X color={colors.text} size={20} />
              </TouchableOpacity>
            </View>

            {/* Header controls: Search & Tambah Toko */}
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1 flex-row items-center border rounded-2xl px-4 py-1" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
                <TextInput
                  placeholder="Cari toko..."
                  placeholderTextColor={colors.textMuted + '80'}
                  value={superAdminSearchQuery}
                  onChangeText={setSuperAdminSearchQuery}
                  className="flex-1 h-12 font-bold text-xs"
                  style={{ color: colors.text }}
                />
              </View>
              <TouchableOpacity 
                onPress={() => setIsAddingStore(true)}
                className="px-4 py-3 rounded-2xl items-center justify-center"
                style={{ backgroundColor: colors.accent }}
              >
                <Plus size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <View className="space-y-4 pb-20">
                {superAdminStores
                  .filter(s => s.name?.toLowerCase().includes(superAdminSearchQuery.toLowerCase()))
                  .map((s) => {
                    const activeTenants = superAdminUsers.filter(u => u.storeId === s.id).length;
                    return (
                      <View 
                        key={s.id} 
                        className="p-5 rounded-3xl border space-y-4" 
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                      >
                        <View className="flex-row justify-between items-center">
                          <View className="flex-1 pr-2">
                            <Text className="text-sm font-black uppercase" style={{ color: colors.text }} numberOfLines={1}>{s.name}</Text>
                            <Text className="text-[10px] font-bold text-slate-400 font-mono" numberOfLines={1}>ID: {s.id}</Text>
                          </View>
                          <View className="flex-row gap-2">
                            <TouchableOpacity 
                              onPress={() => setEditingStore(s)}
                              className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl"
                            >
                              <Pencil size={14} color="#3b82f6" />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              onPress={() => triggerBackup(s.id)}
                              disabled={isBackingUp !== null}
                              className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl"
                            >
                              {isBackingUp === s.id ? (
                                <ActivityIndicator size="small" color="#8b5cf6" />
                              ) : (
                                <Download size={14} color="#8b5cf6" />
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity 
                              onPress={() => handleUpdateStore(s.id, s.isActive ?? true)}
                              className={`p-2.5 rounded-xl border ${s.isActive !== false ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-500/10 border-slate-500/20'}`}
                            >
                              <Power size={14} color={s.isActive !== false ? '#10b981' : '#94a3b8'} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              onPress={() => handleDeleteStorePermanently(s.id)}
                              className="p-2.5 rounded-xl border bg-rose-500/10 border-rose-500/20 ml-1"
                            >
                              <Trash2 size={14} color="#f43f5e" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View className="grid grid-cols-2 gap-2 bg-black/10 p-3 rounded-2xl">
                          <View className="flex-row justify-between">
                            <Text className="text-[8px] font-black text-slate-500">PEMILIK:</Text>
                            <Text className="text-[9px] font-bold" style={{ color: colors.text }} numberOfLines={1}>{s.ownerEmail}</Text>
                          </View>
                          <View className="flex-row justify-between">
                            <Text className="text-[8px] font-black text-slate-500">KUOTA USER:</Text>
                            <Text className="text-[9px] font-bold" style={{ color: colors.text }}>{activeTenants} / {s.maxUsers || 5}</Text>
                          </View>
                          <View className="flex-row justify-between mt-1 pt-1 border-t border-slate-800/20">
                            <Text className="text-[8px] font-black text-slate-500">STATUS:</Text>
                            <Text className={`text-[8px] font-black ${s.isActive !== false ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {s.isActive !== false ? 'AKTIF' : 'MENUNGGU'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* TAMBAH TOKO MODAL OVERLAY */}
        {isAddingStore && (
          <Modal visible={true} animationType="fade" transparent>
            <View className="flex-1 bg-black/80 justify-center p-6">
              <View className="w-full max-w-sm rounded-[36px] p-6 space-y-4" style={{ backgroundColor: colors.surface }}>
                <View className="flex-row justify-between items-center pb-2 border-b" style={{ borderColor: colors.border + '30' }}>
                  <Text className="text-base font-black" style={{ color: colors.text }}>Tambah Toko Baru</Text>
                  <TouchableOpacity onPress={() => setIsAddingStore(false)}>
                    <X size={20} color={colors.text} />
                  </TouchableOpacity>
                </View>

                {/* Store Name Input */}
                <View className="space-y-1">
                  <Text className="text-[8px] font-black uppercase tracking-wider text-slate-400">Nama Toko</Text>
                  <TextInput
                    value={newStoreData.name}
                    onChangeText={(txt) => setNewStoreData({ 
                      ...newStoreData, 
                      name: txt.toUpperCase(),
                      id: txt.toLowerCase().replace(/\s+/g, '-')
                    })}
                    placeholder="Contoh: YADI BARBERSHOP"
                    placeholderTextColor={colors.textMuted}
                    className="p-3.5 rounded-2xl border font-bold text-xs"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                  />
                </View>

                {/* Slug ID Input */}
                <View className="space-y-1">
                  <Text className="text-[8px] font-black uppercase tracking-wider text-slate-400">Slug ID Toko (Unique URL)</Text>
                  <TextInput
                    value={newStoreData.id}
                    onChangeText={(txt) => setNewStoreData({ ...newStoreData, id: txt.toLowerCase() })}
                    placeholder="yadi-barbershop"
                    placeholderTextColor={colors.textMuted}
                    className="p-3.5 rounded-2xl border font-mono text-xs"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                  />
                </View>

                {/* Owner Email Input */}
                <View className="space-y-1">
                  <Text className="text-[8px] font-black uppercase tracking-wider text-slate-400">Email Pemilik Toko</Text>
                  <TextInput
                    value={newStoreData.ownerEmail}
                    onChangeText={(txt) => setNewStoreData({ ...newStoreData, ownerEmail: txt })}
                    placeholder="e.g. yadi@kasirpro.com"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    className="p-3.5 rounded-2xl border font-bold text-xs"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                  />
                </View>

                {/* Quota Input */}
                <View className="space-y-1">
                  <Text className="text-[8px] font-black uppercase tracking-wider text-slate-400">Kuota Maksimal User Staff</Text>
                  <TextInput
                    value={String(newStoreData.maxUsers)}
                    onChangeText={(txt) => setNewStoreData({ ...newStoreData, maxUsers: txt.replace(/[^0-9]/g, '') as any })}
                    placeholder="5"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    className="p-3.5 rounded-2xl border font-bold text-xs"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                  />
                </View>

                {/* Save New Store Button */}
                <TouchableOpacity
                  onPress={handleCreateStore}
                  disabled={isSaving}
                  className="py-4 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: colors.accent }}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="font-black text-white text-xs uppercase tracking-wider">Daftarkan Toko Baru</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}

        {/* EDIT TOKO DETAIL MODAL OVERLAY */}
        {editingStore && (
          <Modal visible={true} animationType="fade" transparent>
            <View className="flex-1 bg-black/80 justify-center p-6">
              <View className="w-full max-w-sm rounded-[36px] p-6 space-y-4" style={{ backgroundColor: colors.surface }}>
                <View className="flex-row justify-between items-center pb-2 border-b" style={{ borderColor: colors.border + '30' }}>
                  <Text className="text-base font-black" style={{ color: colors.text }}>Edit Toko</Text>
                  <TouchableOpacity onPress={() => setEditingStore(null)}>
                    <X size={20} color={colors.text} />
                  </TouchableOpacity>
                </View>

                {/* Store Name */}
                <View className="space-y-1">
                  <Text className="text-[8px] font-black uppercase tracking-wider text-slate-400">Nama Toko</Text>
                  <TextInput
                    value={editingStore.name}
                    onChangeText={(txt) => setEditingStore({ ...editingStore, name: txt.toUpperCase() })}
                    className="p-3.5 rounded-2xl border font-bold text-xs"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                  />
                </View>

                {/* Owner Email */}
                <View className="space-y-1">
                  <Text className="text-[8px] font-black uppercase tracking-wider text-slate-400">Email Pemilik</Text>
                  <TextInput
                    value={editingStore.ownerEmail}
                    onChangeText={(txt) => setEditingStore({ ...editingStore, ownerEmail: txt })}
                    className="p-3.5 rounded-2xl border font-bold text-xs"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                  />
                </View>

                {/* Max Quota */}
                <View className="space-y-1">
                  <Text className="text-[8px] font-black uppercase tracking-wider text-slate-400">Kuota Maksimal User Staff</Text>
                  <TextInput
                    value={String(editingStore.maxUsers)}
                    onChangeText={(txt) => setEditingStore({ ...editingStore, maxUsers: txt.replace(/[^0-9]/g, '') as any })}
                    keyboardType="numeric"
                    className="p-3.5 rounded-2xl border font-bold text-xs"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                  />
                </View>

                {/* Save Changes */}
                <TouchableOpacity
                  onPress={handleUpdateStoreDetails}
                  disabled={isSaving}
                  className="py-4 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: colors.accent }}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="font-black text-white text-xs uppercase tracking-wider">Simpan Perubahan Toko</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
      </Modal>

      {/* 8. SUPER ADMIN - BRANDING MODAL */}
      <Modal visible={activeModal === 'superAdminBranding'} animationType="slide" transparent onRequestClose={() => setActiveModal(null)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="h-[88%] rounded-t-[40px] p-6 pb-12" style={{ backgroundColor: colors.bg }}>
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-xl font-black" style={{ color: colors.text }}>Branding Global</Text>
                <Text className="text-xs font-bold" style={{ color: colors.textMuted }}>Personalisasi identitas visual platform</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} className="w-10 h-10 rounded-full bg-black/10 items-center justify-center">
                <X color={colors.text} size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <View className="space-y-6 pb-20">
                <View className="p-6 rounded-3xl border space-y-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                  {/* appName */}
                  <View className="space-y-1">
                    <Text className="text-[8px] font-black uppercase tracking-widest text-slate-400">Nama Aplikasi Global</Text>
                    <TextInput
                      value={brandingData.appName}
                      onChangeText={(txt) => setBrandingData({ ...brandingData, appName: txt.toUpperCase() })}
                      placeholder="e.g. IKASIR PRO"
                      placeholderTextColor={colors.textMuted}
                      className="p-4 rounded-2xl border font-black text-sm"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                    />
                  </View>

                  {/* receiptWatermark */}
                  <View className="space-y-1">
                    <Text className="text-[8px] font-black uppercase tracking-widest text-slate-400">Watermark Struk Belanja</Text>
                    <TextInput
                      value={brandingData.receiptWatermark}
                      onChangeText={(txt) => setBrandingData({ ...brandingData, receiptWatermark: txt })}
                      placeholder="e.g. Powered by YadiApp"
                      placeholderTextColor={colors.textMuted}
                      className="p-4 rounded-2xl border font-bold text-xs"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                    />
                  </View>

                  {/* showWatermark Switch */}
                  <View className="flex-row justify-between items-center p-4 rounded-2xl border mb-2" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
                    <View>
                      <Text className="text-xs font-black" style={{ color: colors.text }}>Status Watermark</Text>
                      <Text className="text-[8px] font-bold text-slate-400">Tampilkan/Sembunyikan watermark di struk</Text>
                    </View>
                    <Switch
                      value={brandingData.showWatermark}
                      onValueChange={(val) => setBrandingData({ ...brandingData, showWatermark: val })}
                      trackColor={{ false: colors.border, true: colors.accent }}
                      thumbColor="#ffffff"
                    />
                  </View>

                  {/* webAppUrl */}
                  <View className="space-y-1">
                    <Text className="text-[8px] font-black uppercase tracking-widest text-slate-400">Domain / URL Web & API App</Text>
                    <TextInput
                      value={brandingData.webAppUrl || ''}
                      onChangeText={(txt) => setBrandingData({ ...brandingData, webAppUrl: txt })}
                      placeholder="e.g. https://ikasir-pro.vercel.app"
                      placeholderTextColor={colors.textMuted}
                      className="p-4 rounded-2xl border font-bold text-xs"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                    />
                  </View>

                  <View className="h-[1px] w-full bg-slate-200 my-2" />

                  {/* subscriptionBankInfo */}
                  <View className="space-y-1">
                    <Text className="text-[8px] font-black uppercase tracking-widest text-slate-400">Info Bank/Rekening Pusat (Untuk Langganan)</Text>
                    <TextInput
                      value={brandingData.subscriptionBankInfo}
                      onChangeText={(txt) => setBrandingData({ ...brandingData, subscriptionBankInfo: txt })}
                      placeholder="e.g. BCA 1234567890 a/n KASIR PRO"
                      placeholderTextColor={colors.textMuted}
                      multiline
                      numberOfLines={3}
                      className="p-4 rounded-2xl border font-bold text-xs"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text, textAlignVertical: 'top', minHeight: 80 }}
                    />
                  </View>

                  {/* subscriptionEwalletInfo */}
                  <View className="space-y-1 mt-2">
                    <Text className="text-[8px] font-black uppercase tracking-widest text-slate-400">Info E-Wallet Pusat (Untuk Langganan)</Text>
                    <TextInput
                      value={brandingData.subscriptionEwalletInfo}
                      onChangeText={(txt) => setBrandingData({ ...brandingData, subscriptionEwalletInfo: txt })}
                      placeholder="e.g. DANA 08123456789 a/n KASIR PRO"
                      placeholderTextColor={colors.textMuted}
                      multiline
                      numberOfLines={3}
                      className="p-4 rounded-2xl border font-bold text-xs"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text, textAlignVertical: 'top', minHeight: 80 }}
                    />
                  </View>

                  {/* subscriptionQrisUrl */}
                  <View className="space-y-2 mt-2">
                    <Text className="text-[8px] font-black uppercase tracking-widest text-slate-400">QRIS Pembayaran Langganan (Pusat)</Text>
                    <View className="flex-row gap-3 h-24">
                      <View className="flex-1 bg-white border border-dashed rounded-xl items-center justify-center overflow-hidden" style={{ borderColor: colors.border }}>
                        {brandingData.subscriptionQrisUrl ? (
                          <Image source={{ uri: brandingData.subscriptionQrisUrl }} className="w-full h-full" style={{ resizeMode: 'contain' }} />
                        ) : (
                          <Text className="text-[8px] font-bold text-slate-400 px-4 text-center">Belum ada QRIS</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={handlePickSubscriptionQris}
                        className="h-full px-4 rounded-xl items-center justify-center border"
                        style={{ backgroundColor: colors.accent + '20', borderColor: colors.accent + '40' }}
                      >
                        <Text className="text-[10px] font-black uppercase" style={{ color: colors.accent }}>Upload QRIS</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Save Changes Button */}
                  <TouchableOpacity
                    onPress={handleUpdateBranding}
                    disabled={isSaving}
                    className="py-4 rounded-2xl items-center justify-center flex-row gap-2 mt-2"
                    style={{ backgroundColor: colors.accent }}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Check size={16} color="#ffffff" strokeWidth={3} />
                        <Text className="font-black text-white text-xs uppercase tracking-wider">Simpan Perubahan Branding</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Preview Mockup Card */}
                <View className="p-6 rounded-[2rem] bg-accent/5 border border-accent/10 items-center text-center">
                  <View className="w-12 h-12 bg-accent/20 rounded-full items-center justify-center mb-3">
                    <Sparkles size={20} color={colors.accent} />
                  </View>
                  <Text className="text-sm font-black mb-3" style={{ color: colors.text }}>Preview Identitas Struk</Text>
                  
                  <View className="bg-white p-4 rounded-2xl w-[160px] space-y-1.5 border-t-4 border-slate-200 shadow-lg">
                    <View className="items-center mb-1">
                      <Text className="text-[10px] font-black text-slate-900 uppercase italic">{brandingData.appName}</Text>
                      <Text className="text-[6px] text-slate-400">Alamat Toko Merchant...</Text>
                    </View>
                    <View className="border-b border-dashed border-slate-200 py-0.5 flex-row justify-between">
                      <Text className="text-[7px] text-slate-600 font-mono">PRODUK PREVIEW</Text>
                      <Text className="text-[7px] text-slate-600 font-mono">15.000</Text>
                    </View>
                    {brandingData.showWatermark && (
                      <View className="border-t border-dashed border-slate-200 pt-2 items-center">
                        <Text className="text-[6px] font-bold text-slate-400 uppercase tracking-widest">{brandingData.receiptWatermark}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 9. SUPER ADMIN - INFRASTRUKTUR & DATABASE NODES MODAL */}
      <Modal visible={activeModal === 'superAdminInfra'} animationType="slide" transparent onRequestClose={() => setActiveModal(null)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="h-[92%] rounded-t-[40px] p-6 pb-12" style={{ backgroundColor: colors.bg }}>
            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Text className="text-xl font-black" style={{ color: colors.text }}>Infrastruktur & Proyek</Text>
                <Text className="text-xs font-bold" style={{ color: colors.textMuted }}>Kredensial database & multi-tenant routing</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} className="w-10 h-10 rounded-full bg-black/10 items-center justify-center">
                <X color={colors.text} size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <View className="space-y-6 pb-20">
                {/* GLOBAL ACTION BATCH TRIGGERS */}
                <View className="p-4 rounded-3xl border space-y-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                  <Text className="text-[9px] font-black uppercase tracking-widest text-slate-400 pl-1">Perbaikan & Utilitas Sistem</Text>
                  
                  <View className="flex-row flex-wrap gap-2.5">
                    <TouchableOpacity 
                      onPress={handleMigrateData}
                      disabled={isMigrating}
                      className="flex-1 min-w-[45%] py-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl items-center justify-center flex-row gap-1.5"
                    >
                      {isMigrating ? <ActivityIndicator size="small" color="#f59e0b" /> : <Database size={12} color="#f59e0b" />}
                      <Text className="text-[8px] font-black text-amber-500 uppercase tracking-wider">MIGRASI DATA LAMA</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={handleMigrateDiscountStructure}
                      disabled={isMigrating}
                      className="flex-1 min-w-[45%] py-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl items-center justify-center flex-row gap-1.5"
                    >
                      {isMigrating ? <ActivityIndicator size="small" color="#3b82f6" /> : <Tag size={12} color="#3b82f6" />}
                      <Text className="text-[8px] font-black text-blue-500 uppercase tracking-wider">MIGRASI DISKON</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => triggerBackup('GLOBAL')}
                      disabled={isBackingUp !== null}
                      className="flex-1 min-w-[45%] py-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl items-center justify-center flex-row gap-1.5"
                    >
                      {isBackingUp === 'GLOBAL' ? <ActivityIndicator size="small" color="#10b981" /> : <Download size={12} color="#10b981" />}
                      <Text className="text-[8px] font-black text-emerald-500 uppercase tracking-wider">BACKUP GLOBAL</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={onFileRestoreGlobal}
                      disabled={isRestoring}
                      className="flex-1 min-w-[45%] py-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl items-center justify-center flex-row gap-1.5"
                    >
                      {isRestoring ? <ActivityIndicator size="small" color="#f43f5e" /> : <History size={12} color="#f43f5e" />}
                      <Text className="text-[8px] font-black text-rose-500 uppercase tracking-wider">RESTORE GLOBAL</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* CLOUDINARY CONFIGURATION FORM */}
                <View className="p-5 rounded-3xl border space-y-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                  <Text className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cloudinary Cloud Storage</Text>
                  <Text className="text-[8px] font-bold text-slate-400 italic leading-normal">Penyimpanan global untuk gambar produk dan merchant. Jika kosong, akan memakai asset bucket developer.</Text>

                  <View className="space-y-1">
                    <Text className="text-[8px] font-black uppercase tracking-wider text-slate-400">Cloud Name</Text>
                    <TextInput
                      value={infraData.cloudinary_cloud_name || ''}
                      onChangeText={(txt) => setInfraData({ ...infraData, cloudinary_cloud_name: txt })}
                      className="p-3 border rounded-xl font-bold text-xs"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                    />
                  </View>
                  <View className="space-y-1">
                    <Text className="text-[8px] font-black uppercase tracking-wider text-slate-400">Upload Preset (Unsigned)</Text>
                    <TextInput
                      value={infraData.cloudinary_upload_preset || ''}
                      onChangeText={(txt) => setInfraData({ ...infraData, cloudinary_upload_preset: txt })}
                      className="p-3 border rounded-xl font-bold text-xs"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                    />
                  </View>
                </View>

                {/* FIRESTORE KREDENSIAL UTAMA */}
                <View className="p-5 rounded-3xl border space-y-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                  <Text className="text-[10px] font-black uppercase tracking-widest text-slate-400">Firebase Firestore Kredensial</Text>
                  
                  <View className="grid grid-cols-2 gap-2">
                    <View className="space-y-1">
                      <Text className="text-[8px] font-black uppercase text-slate-400">API Key</Text>
                      <TextInput
                        value={infraData.fb_api_key || ''}
                        onChangeText={(txt) => setInfraData({ ...infraData, fb_api_key: txt })}
                        secureTextEntry
                        className="p-2.5 border rounded-xl font-mono text-[10px]"
                        style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                      />
                    </View>
                    <View className="space-y-1">
                      <Text className="text-[8px] font-black uppercase text-slate-400">Project ID</Text>
                      <TextInput
                        value={infraData.fb_project_id || ''}
                        onChangeText={(txt) => setInfraData({ ...infraData, fb_project_id: txt })}
                        className="p-2.5 border rounded-xl font-mono text-[10px]"
                        style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                      />
                    </View>
                    <View className="space-y-1">
                      <Text className="text-[8px] font-black uppercase text-slate-400">Auth Domain</Text>
                      <TextInput
                        value={infraData.fb_auth_domain || ''}
                        onChangeText={(txt) => setInfraData({ ...infraData, fb_auth_domain: txt })}
                        className="p-2.5 border rounded-xl font-mono text-[10px]"
                        style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                      />
                    </View>
                    <View className="space-y-1">
                      <Text className="text-[8px] font-black uppercase text-slate-400">App ID</Text>
                      <TextInput
                        value={infraData.fb_app_id || ''}
                        onChangeText={(txt) => setInfraData({ ...infraData, fb_app_id: txt })}
                        className="p-2.5 border rounded-xl font-mono text-[10px]"
                        style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleUpdateInfra}
                    disabled={isSaving}
                    className="py-4 rounded-2xl items-center justify-center mt-2"
                    style={{ backgroundColor: colors.accent }}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text className="font-black text-white text-xs uppercase tracking-wider">Update Infrastruktur</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleResetInfra}
                    className="py-3 border-dashed border border-slate-700 rounded-xl items-center justify-center"
                  >
                    <Text className="text-[9px] font-black text-rose-500 uppercase tracking-widest">RESET KE KREDENSIAL (.ENV)</Text>
                  </TouchableOpacity>
                </View>

                {/* INVENTORY DATABASE PROJECTS LIST */}
                <View className="space-y-4">
                  <View className="flex-row justify-between items-center px-1">
                    <Text className="text-base font-black" style={{ color: colors.text }}>Inventory DB Proyek</Text>
                    <TouchableOpacity 
                      onPress={() => {
                        setEditingProject(null);
                        setInfraData({
                          cloudinary_cloud_name: '', cloudinary_upload_preset: '',
                          fb_api_key: '', fb_auth_domain: '', fb_project_id: '',
                          fb_storage_bucket: '', fb_messaging_sender_id: '', fb_app_id: ''
                        });
                        setIsAddingProject(true);
                      }}
                      className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
                    >
                      <Plus size={14} color="#10b981" />
                    </TouchableOpacity>
                  </View>

                  <View className="space-y-3">
                    {dbProjects.map((proj) => {
                      const userTenantsCount = superAdminUsers.filter(u => u.targetProjectId === proj.fb_project_id).length;
                      return (
                        <View 
                          key={proj.id} 
                          className="p-5 rounded-3xl border space-y-3" 
                          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                        >
                          <View className="flex-row items-center gap-3">
                            <View className="w-10 h-10 rounded-xl items-center justify-center bg-teal-500/10 border border-teal-500/20">
                              <Server size={18} color="#14b8a6" />
                            </View>
                            <View className="flex-1 pr-2">
                              <Text className="text-xs font-black uppercase" style={{ color: colors.text }} numberOfLines={1}>{proj.fb_project_id}</Text>
                              <Text className="text-[8px] font-bold text-slate-500" numberOfLines={1}>{proj.fb_auth_domain}</Text>
                            </View>
                          </View>

                          <View className="flex-row justify-between pt-2 border-t" style={{ borderColor: colors.border + '30' }}>
                            <Text className="text-[9px] font-bold text-teal-500">{userTenantsCount} USER MAPPED</Text>
                            <View className="flex-row gap-2">
                              <TouchableOpacity
                                onPress={() => {
                                  setEditingProject(proj);
                                  setInfraData(proj);
                                  setIsAddingProject(true);
                                }}
                                className="p-2 bg-slate-800 rounded-xl"
                              >
                                <Edit2 size={10} color="#ffffff" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => handleDeleteProject(proj.id)}
                                className="p-2 bg-rose-500/10 rounded-xl"
                              >
                                <Trash2 size={10} color="#f43f5e" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      );
                    })}

                    {dbProjects.length === 0 && (
                      <View className="py-8 bg-black/10 border-2 border-dashed border-slate-800 rounded-3xl items-center justify-center">
                        <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Belum ada database tambahan</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>

        {/* DATABASE PROJECT DIALOG ADD/EDIT NODE OVERLAY */}
        {isAddingProject && (
          <Modal visible={true} animationType="fade" transparent>
            <View className="flex-1 bg-black/80 justify-center p-6">
              <View className="w-full max-w-sm rounded-[36px] p-6 space-y-4" style={{ backgroundColor: colors.surface }}>
                <View className="flex-row justify-between items-center pb-2 border-b" style={{ borderColor: colors.border + '30' }}>
                  <Text className="text-base font-black" style={{ color: colors.text }}>
                    {editingProject ? 'Edit Database Proyek' : 'Tambah Database Proyek'}
                  </Text>
                  <TouchableOpacity onPress={() => setIsAddingProject(false)}>
                    <X size={20} color={colors.text} />
                  </TouchableOpacity>
                </View>

                {/* Firestore project credentials */}
                <ScrollView className="max-h-[300px] space-y-3 pr-1">
                  <View className="space-y-1">
                    <Text className="text-[8px] font-black uppercase text-slate-400">Project ID</Text>
                    <TextInput
                      value={infraData.fb_project_id || ''}
                      onChangeText={(txt) => setInfraData({ ...infraData, fb_project_id: txt })}
                      className="p-3 border rounded-xl text-xs font-bold"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                    />
                  </View>
                  <View className="space-y-1">
                    <Text className="text-[8px] font-black uppercase text-slate-400">API Key</Text>
                    <TextInput
                      value={infraData.fb_api_key || ''}
                      onChangeText={(txt) => setInfraData({ ...infraData, fb_api_key: txt })}
                      secureTextEntry
                      className="p-3 border rounded-xl text-xs font-mono"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                    />
                  </View>
                  <View className="space-y-1">
                    <Text className="text-[8px] font-black uppercase text-slate-400">Auth Domain</Text>
                    <TextInput
                      value={infraData.fb_auth_domain || ''}
                      onChangeText={(txt) => setInfraData({ ...infraData, fb_auth_domain: txt })}
                      className="p-3 border rounded-xl text-xs font-bold"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                    />
                  </View>
                  <View className="space-y-1">
                    <Text className="text-[8px] font-black uppercase text-slate-400">App ID</Text>
                    <TextInput
                      value={infraData.fb_app_id || ''}
                      onChangeText={(txt) => setInfraData({ ...infraData, fb_app_id: txt })}
                      className="p-3 border rounded-xl text-xs font-bold"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                    />
                  </View>
                </ScrollView>

                {/* Submit Save Database Project */}
                <TouchableOpacity
                  onPress={handleSaveProject}
                  disabled={isSaving}
                  className="py-4 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: colors.accent }}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="font-black text-white text-xs uppercase tracking-wider">Simpan Database Proyek</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
      </Modal>

      {/* 10. SUBSCRIPTION MENU MODAL */}
      <Modal visible={activeModal === 'subscriptionMenu'} animationType="slide" transparent onRequestClose={() => { setActiveModal(null); setSelectedPackage(null); }}>
        <View className="flex-1 bg-black/80 justify-end">
          <View className="h-[90%] rounded-t-[40px] p-6 pb-12" style={{ backgroundColor: colors.bg }}>
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-xl font-black" style={{ color: colors.text }}>Menu Langganan</Text>
                <Text className="text-xs font-bold text-slate-400">Pilih paket untuk memperpanjang masa aktif</Text>
              </View>
              <TouchableOpacity onPress={() => { setActiveModal(null); setSelectedPackage(null); setIsSubscriptionSuccess(false); }} className="w-10 h-10 rounded-full bg-black/10 items-center justify-center">
                <X color={colors.text} size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              {isSubscriptionSuccess ? (
                <View className="space-y-6 pb-10 pt-4 items-center px-4">
                  <View className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-2">
                    <Check size={40} color="#10b981" strokeWidth={3} />
                  </View>
                  <Text className="text-2xl font-black text-center" style={{ color: colors.text }}>Bukti Terkirim!</Text>
                  <Text className="text-sm font-bold text-slate-400 text-center leading-relaxed mb-6">
                    Pembayaran Anda sedang kami proses. Untuk mempercepat verifikasi, silakan konfirmasi ke admin kami melalui WhatsApp.
                  </Text>
                  
                  <TouchableOpacity 
                    onPress={() => Linking.openURL('https://wa.me/6283815862300?text=Halo%20Admin%20IKASIR%20PRO,%20saya%20sudah%20mengirim%20bukti%20pembayaran%20untuk%20perpanjangan%20langganan%20aplikasi%20saya.%20Mohon%20segera%20diverifikasi.')}
                    className="w-full bg-emerald-500 py-4 rounded-2xl items-center justify-center flex-row gap-2 active:opacity-90 shadow-xl shadow-emerald-500/20 mb-3"
                  >
                    <MessageCircle size={20} color="#ffffff" />
                    <Text className="font-black text-xs uppercase tracking-widest text-white">Konfirmasi via WhatsApp</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={() => { setIsSubscriptionSuccess(false); setActiveModal(null); setSelectedPackage(null); setSubscriptionProofBase64(null); }}
                    className="py-4 rounded-2xl items-center justify-center flex-row gap-2"
                  >
                    <Text className="font-black text-[10px] text-slate-400 uppercase tracking-widest">Tutup</Text>
                  </TouchableOpacity>
                </View>
              ) : !selectedPackage ? (
                <View className="space-y-4">
                  {SUBSCRIPTION_PACKAGES.map((pkg) => (
                    <TouchableOpacity
                      key={pkg.id}
                      onPress={() => setSelectedPackage(pkg)}
                      className="p-5 rounded-3xl border flex-row items-center justify-between"
                      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                      <View>
                        <Text className="text-sm font-black" style={{ color: colors.text }}>{pkg.title}</Text>
                        <Text className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{pkg.desc}</Text>
                      </View>
                      <View className="bg-emerald-500/10 px-3 py-2 rounded-xl">
                        <Text className="text-[10px] font-black text-emerald-500">PILIH</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  <Text className="text-[9px] text-center text-slate-400 italic mt-4">
                    Pilih paket yang sesuai dengan kebutuhan bisnis Anda. Harga sudah termasuk pajak.
                  </Text>
                </View>
              ) : (
                <View className="space-y-6 pb-10">
                  {/* Selected Package Details */}
                  <View className="p-4 rounded-2xl border bg-emerald-500/5 items-center" style={{ borderColor: colors.border }}>
                    <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Paket Pilihan Anda</Text>
                    <Text className="text-xl font-black text-emerald-500">{selectedPackage.title}</Text>
                    <Text className="text-sm font-bold mt-1" style={{ color: colors.text }}>Total Tagihan: Rp {selectedPackage.price.toLocaleString('id-ID')}</Text>
                  </View>

                  <View className="h-[1px] w-full bg-slate-200" />

                  {/* Payment Details */}
                  <View className="items-center space-y-4">
                    <Text className="text-sm font-black" style={{ color: colors.text }}>Metode Pembayaran</Text>
                    
                    {/* Method Tabs */}
                    <View className="flex-row gap-2 w-full justify-center">
                      <TouchableOpacity 
                        onPress={() => setSubscriptionPaymentMethod('qris')} 
                        className="flex-1 py-3 px-1 rounded-2xl flex-col items-center justify-center border"
                        style={{ 
                          backgroundColor: subscriptionPaymentMethod === 'qris' ? colors.accent + '15' : colors.surface, 
                          borderColor: subscriptionPaymentMethod === 'qris' ? colors.accent : colors.border 
                        }}
                      >
                        <QrCode size={18} color={subscriptionPaymentMethod === 'qris' ? colors.accent : colors.textMuted} />
                        <Text className="text-[9px] font-black uppercase mt-1" style={{ color: subscriptionPaymentMethod === 'qris' ? colors.accent : colors.textMuted }}>QRIS</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        onPress={() => setSubscriptionPaymentMethod('bank')} 
                        className="flex-1 py-3 px-1 rounded-2xl flex-col items-center justify-center border"
                        style={{ 
                          backgroundColor: subscriptionPaymentMethod === 'bank' ? colors.accent + '15' : colors.surface, 
                          borderColor: subscriptionPaymentMethod === 'bank' ? colors.accent : colors.border 
                        }}
                      >
                        <Landmark size={18} color={subscriptionPaymentMethod === 'bank' ? colors.accent : colors.textMuted} />
                        <Text className="text-[9px] font-black uppercase mt-1" style={{ color: subscriptionPaymentMethod === 'bank' ? colors.accent : colors.textMuted }}>BANK</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        onPress={() => setSubscriptionPaymentMethod('ewallet')} 
                        className="flex-1 py-3 px-1 rounded-2xl flex-col items-center justify-center border"
                        style={{ 
                          backgroundColor: subscriptionPaymentMethod === 'ewallet' ? colors.accent + '15' : colors.surface, 
                          borderColor: subscriptionPaymentMethod === 'ewallet' ? colors.accent : colors.border 
                        }}
                      >
                        <Wallet size={18} color={subscriptionPaymentMethod === 'ewallet' ? colors.accent : colors.textMuted} />
                        <Text className="text-[9px] font-black uppercase mt-1" style={{ color: subscriptionPaymentMethod === 'ewallet' ? colors.accent : colors.textMuted }}>E-Wallet</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Method Content */}
                    <View className="mt-2 w-full items-center justify-center p-4 rounded-3xl border min-h-[140px]" style={{ borderColor: colors.border, backgroundColor: colors.bg }}>
                      {subscriptionPaymentMethod === 'qris' && (
                        brandingData.subscriptionQrisUrl ? (
                          <View className="items-center w-full">
                            <Text className="text-[9px] font-black uppercase mb-3" style={{ color: colors.textMuted }}>Scan QRIS di bawah ini (Ketuk untuk perbesar)</Text>
                            <TouchableOpacity 
                              onPress={() => setPreviewImageUrl(brandingData.subscriptionQrisUrl)}
                              activeOpacity={0.9}
                              className="p-3 bg-white rounded-3xl border shadow-sm w-44 h-44" 
                              style={{ borderColor: colors.border }}
                            >
                              <Image source={{ uri: brandingData.subscriptionQrisUrl }} className="w-full h-full" style={{ resizeMode: 'contain' }} />
                            </TouchableOpacity>

                            <View className="flex-row gap-2 mt-4">
                              <TouchableOpacity
                                onPress={() => setPreviewImageUrl(brandingData.subscriptionQrisUrl)}
                                className="px-3 py-2 rounded-xl border flex-row items-center gap-1.5"
                                style={{ borderColor: colors.border, backgroundColor: colors.surface }}
                              >
                                <Text className="text-[9px] font-black" style={{ color: colors.text }}>PREVIEW JELAS</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={() => handleDownloadQris(brandingData.subscriptionQrisUrl)}
                                className="px-3 py-2 rounded-xl flex-row items-center gap-1.5 bg-emerald-500"
                              >
                                <Download size={12} color="#ffffff" />
                                <Text className="text-[9px] font-black text-white">UNDUH / SIMPAN</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <Text className="text-[10px] font-bold text-center italic" style={{ color: colors.textMuted }}>Metode QRIS belum diset oleh admin pusat.</Text>
                        )
                      )}

                      {subscriptionPaymentMethod === 'bank' && (
                        brandingData.subscriptionBankInfo ? (
                          <View className="w-full items-center">
                            <Text className="text-[9px] font-black uppercase mb-2" style={{ color: colors.textMuted }}>Transfer ke Nomor Rekening</Text>
                            <Text className="text-xs font-black text-center leading-relaxed" style={{ color: colors.text }}>{brandingData.subscriptionBankInfo}</Text>
                          </View>
                        ) : (
                          <Text className="text-[10px] font-bold text-center italic" style={{ color: colors.textMuted }}>Metode Transfer Bank belum diset.</Text>
                        )
                      )}

                      {subscriptionPaymentMethod === 'ewallet' && (
                        brandingData.subscriptionEwalletInfo ? (
                          <View className="w-full items-center">
                            <Text className="text-[9px] font-black uppercase mb-2" style={{ color: colors.textMuted }}>Kirim ke Info E-Wallet</Text>
                            <Text className="text-xs font-black text-center leading-relaxed" style={{ color: colors.text }}>{brandingData.subscriptionEwalletInfo}</Text>
                          </View>
                        ) : (
                          <Text className="text-[10px] font-bold text-center italic" style={{ color: colors.textMuted }}>Metode E-Wallet belum diset.</Text>
                        )
                      )}
                    </View>
                  </View>

                  {/* Upload Proof */}
                  <View className="mt-4">
                    <Text className="text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">Upload Bukti Pembayaran</Text>
                    <TouchableOpacity 
                      onPress={handlePickSubscriptionProof}
                      className="w-full h-32 border-2 border-dashed rounded-2xl items-center justify-center bg-black/5 overflow-hidden"
                      style={{ borderColor: subscriptionProofBase64 ? colors.accent : colors.border }}
                    >
                      {subscriptionProofBase64 ? (
                        <Image source={{ uri: subscriptionProofBase64 }} className="w-full h-full" style={{ resizeMode: 'cover' }} />
                      ) : (
                        <View className="items-center">
                          <Camera size={24} color={colors.textMuted} className="mb-2" />
                          <Text className="text-[10px] font-bold text-slate-400">Ketuk untuk pilih gambar</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={handleSubmitSubscription}
                    disabled={isSubmittingSubscription}
                    className="py-4 rounded-2xl items-center justify-center flex-row gap-2 shadow-lg mt-2"
                    style={{ backgroundColor: colors.accent, shadowColor: colors.accent }}
                  >
                    {isSubmittingSubscription ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Check size={16} color="#ffffff" strokeWidth={3} />
                        <Text className="font-black text-white text-xs uppercase tracking-wider">Kirim Bukti Pembayaran</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => { setSelectedPackage(null); setSubscriptionProofBase64(null); }} className="py-3 items-center">
                    <Text className="text-[10px] font-black text-slate-400 uppercase">Ganti Paket</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* SUPER ADMIN: SUBSCRIPTIONS MODAL */}
      <Modal visible={activeModal === 'superAdminSubscriptions'} animationType="slide" transparent onRequestClose={() => setActiveModal(null)}>
        <SafeAreaView className="flex-1" edges={['top', 'bottom']} style={{ backgroundColor: colors.bg }}>
          <View className="flex-row items-center px-6 py-4 border-b" style={{ borderColor: colors.border + '30' }}>
            <TouchableOpacity onPress={() => setActiveModal(null)} className="w-10 h-10 rounded-full bg-black/10 items-center justify-center mr-4">
              <ArrowLeft color={colors.text} size={20} />
            </TouchableOpacity>
            <View>
              <Text className="text-xl font-black" style={{ color: colors.text }}>Pengajuan Langganan</Text>
              <Text className="text-[10px] font-bold uppercase tracking-wider text-rose-500">
                {subscriptionRequests.filter(r => r.status === 'pending').length} Menunggu Verifikasi
              </Text>
            </View>
          </View>
          <ScrollView className="flex-1 p-6">
            {subscriptionRequests.map(req => (
              <View key={req.id} className="p-4 rounded-2xl border mb-4 shadow-sm" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <View className="flex-row justify-between mb-2">
                  <View>
                    <Text className="text-xs font-black uppercase" style={{ color: colors.text }}>{req.packageTitle}</Text>
                    <Text className="text-[10px] font-bold mt-1" style={{ color: colors.textMuted }}>{req.ownerEmail}</Text>
                  </View>
                  <View className={`px-2 py-1 rounded ${req.status === 'pending' ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                    <Text className={`text-[8px] font-black uppercase tracking-wider ${req.status === 'pending' ? 'text-amber-500' : 'text-emerald-500'}`}>{req.status}</Text>
                  </View>
                </View>
                <Text className="text-[10px] font-bold" style={{ color: colors.accent }}>Harga: Rp {req.price?.toLocaleString('id-ID')}</Text>
                <Text className="text-[9px] font-bold mb-3" style={{ color: colors.textMuted }}>Metode: <Text className="uppercase" style={{ color: colors.text }}>{req.paymentMethod || 'qris'}</Text></Text>
                
                {req.proofUrl && (
                  <TouchableOpacity 
                    onPress={() => setPreviewImageUrl(req.proofUrl)}
                    activeOpacity={0.9}
                    className="w-full h-40 rounded-xl overflow-hidden mb-3 border bg-slate-100" 
                    style={{ borderColor: colors.border }}
                  >
                    <Image source={{ uri: req.proofUrl }} className="w-full h-full" resizeMode="cover" />
                  </TouchableOpacity>
                )}

                {req.status === 'pending' && (
                  <TouchableOpacity
                    onPress={() => handleVerifySubscription(req)}
                    disabled={isSaving}
                    className="w-full py-3 rounded-xl items-center justify-center flex-row gap-2"
                    style={{ backgroundColor: '#10b981', opacity: isSaving ? 0.7 : 1 }}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <CheckCircle2 size={16} color="#ffffff" />
                        <Text className="text-[10px] font-black text-white uppercase tracking-widest">Verifikasi Valid</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {subscriptionRequests.length === 0 && (
              <View className="py-12 items-center">
                <Text className="text-xs font-bold text-slate-400">Belum ada pengajuan langganan.</Text>
              </View>
            )}
            <View className="h-10" />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Fullscreen Image Preview Modal */}
      {previewImageUrl && (
        <Modal visible={!!previewImageUrl} transparent animationType="fade" onRequestClose={() => setPreviewImageUrl(null)}>
          <View className="flex-1 bg-black justify-center items-center relative">
            <Image source={{ uri: previewImageUrl }} className="w-full h-full" style={{ resizeMode: 'contain' }} />
            
            {/* Download/Share Button on Top Left */}
            <TouchableOpacity 
              onPress={() => handleDownloadQris(previewImageUrl)} 
              activeOpacity={0.8}
              className="absolute top-12 left-6 px-4 h-12 rounded-full bg-black/40 items-center justify-center border border-white/10 flex-row gap-2"
            >
              <Download color="#ffffff" size={18} />
              <Text className="text-white font-bold text-xs uppercase tracking-wider">Simpan / Bagikan</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setPreviewImageUrl(null)} 
              activeOpacity={0.8}
              className="absolute top-12 right-6 w-12 h-12 rounded-full bg-black/40 items-center justify-center border border-white/10"
            >
              <X color="#ffffff" size={24} />
            </TouchableOpacity>
          </View>
        </Modal>
      )}

    </SafeAreaView>
  );
}
