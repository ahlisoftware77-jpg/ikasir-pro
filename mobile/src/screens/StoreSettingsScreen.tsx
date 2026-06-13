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
  Key, Database, Download, UploadCloud, ShieldAlert, CheckCircle2, Pencil, Power, Plus, Server, Edit2, ArrowRight, ArrowLeft, ShieldCheck, Mail, Palette, Sparkles, Bell, Camera, Save
} from 'lucide-react-native';
import { db, auth, storage } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, writeBatch, onSnapshot, deleteDoc } from 'firebase/firestore';
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

export default function StoreSettingsScreen({ navigation }: any) {
  const { colors, theme, setTheme } = useTheme();
  const { user, role, storeId, logout, isSubscriptionExpired } = useAuthStore();

  const [activeModal, setActiveModal] = useState<'theme' | 'profile' | 'premium' | 'storeSettings' | 'superAdminUsers' | 'superAdminStores' | 'superAdminBranding' | 'superAdminInfra' | null>(null);
  const [selectedPremiumFeature, setSelectedPremiumFeature] = useState('');

  // Profile States
  const { setUser } = useAuthStore();
  const [editProfileName, setEditProfileName] = useState(user?.name || user?.email?.split('@')[0] || '');
  const [editProfilePhoto, setEditProfilePhoto] = useState<string | null>(user?.photoURL || null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

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
    isOnlineStoreActive: true,
    
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
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingThermalLogo, setIsUploadingThermalLogo] = useState(false);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
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
    showWatermark: true
  });

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

      const unsubBranding = onSnapshot(doc(db, 'system_settings', 'branding'), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setBrandingData({
            appName: data.appName || 'IKASIR PRO',
            receiptWatermark: data.receiptWatermark || 'Powered by YadiApp',
            showWatermark: data.showWatermark ?? true
          });
        }
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

      return () => {
        unsubUsers();
        unsubStores();
        unsubBranding();
        unsubInfra();
        unsubProjects();
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
        maxUsers: Number(newStoreData.maxUsers) || 5
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
        maxUsers: parseInt(editingStore.maxUsers) || 5
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
          const settingsRef = doc(db, 'settings', `store_${storeId}`);
          await setDoc(settingsRef, { logoUrl: uploadResult.secure_url }, { merge: true });
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
          const settingsRef = doc(db, 'settings', `store_${storeId}`);
          await setDoc(settingsRef, { thermalLogoUrl: uploadResult.secure_url }, { merge: true });
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
      });

      const uploadResult = await uploadRes.json();
      if (uploadRes.ok && uploadResult.secure_url) {
        setStoreSettings(prev => ({ ...prev, signatureUrl: uploadResult.secure_url }));
        const settingsRef = doc(db, 'settings', `store_${storeId}`);
        await setDoc(settingsRef, { signatureUrl: uploadResult.secure_url }, { merge: true });
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
    if (storeId) {
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
              isOnlineStoreActive: data.isOnlineStoreActive !== false,
              
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
  }, [storeId]);

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
      navigation.goBack();
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
  const renderMenuItem = (label: string, IconComponent: any, color: string, onPress: () => void, isAdminOnly = false, isDisabled = false) => {
    if (isAdminOnly && role !== 'admin') return null;

    return (
      <TouchableOpacity
        key={label}
        onPress={isDisabled ? () => Alert.alert('Akses Terkunci', 'Masa aktif langganan Anda telah habis. Harap perpanjang untuk mengakses fitur ini.') : onPress}
        activeOpacity={isDisabled ? 1 : 0.7}
        className="w-[30%] aspect-square m-[1.5%] p-3 rounded-2xl border items-center justify-center text-center"
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

        <SafeAreaView className="flex-1" edges={['top', 'bottom']} style={{ backgroundColor: colors.bg }}>
          <View className="flex-row items-center px-6 py-4 border-b" style={{ borderColor: colors.border + '30' }}>
            <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 rounded-full bg-black/5 items-center justify-center mr-4">
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

                    {/* isOnlineStoreActive Toggle */}
                    <View 
                      className="p-4 rounded-2xl border flex-row items-center justify-between"
                      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                      <Text className="text-xs font-bold" style={{ color: colors.text }}>Aktifkan Toko Online (Visibility)</Text>
                      <Switch
                        value={storeSettings.isOnlineStoreActive}
                        onValueChange={(val) => setStoreSettings(prev => ({ ...prev, isOnlineStoreActive: val }))}
                        trackColor={{ false: colors.border, true: colors.accent }}
                        thumbColor="#ffffff"
                      />
                    </View>

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

          {/* MOBILE SIGNATURE DRAWING MODAL */}
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
        </SafeAreaView>
  );
}
