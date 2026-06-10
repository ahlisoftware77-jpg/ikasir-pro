import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, ScrollView, Modal, Pressable, Vibration, 
  TextInput, Switch, ActivityIndicator, Alert, Image, Linking, 
  KeyboardAvoidingView, Platform, Dimensions 
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../store/authStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Check, X, Home, Tag, CalendarRange, FileText, Users, Lock, UserCheck, 
  Receipt, Trash2, Database, Download, CheckCircle2, Pencil, Power, Plus, 
  History, ArrowRight, ArrowLeft, Camera, Sparkles, AlertCircle
} from 'lucide-react-native';
import { db } from '../lib/firebase';
import { 
  doc, setDoc, updateDoc, collection, query, where, getDocs, 
  writeBatch, onSnapshot, deleteDoc, addDoc, serverTimestamp, getDoc 
} from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

LocaleConfig.locales['id'] = {
  monthNames: ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'],
  monthNamesShort: ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'],
  dayNames: ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'],
  dayNamesShort: ['Min','Sen','Sel','Rab','Kam','Jum','Sab'],
  today: 'Hari ini'
};
LocaleConfig.defaultLocale = 'id';

export default function SuperAdminScreen({ route, navigation }: any) {
  const { featureId } = route.params;
  const { colors, theme } = useTheme();
  const { user } = useAuthStore();

  const [superAdminUsers, setSuperAdminUsers] = useState<any[]>([]);
  const [superAdminStores, setSuperAdminStores] = useState<any[]>([]);
  const [subscriptionRequests, setSubscriptionRequests] = useState<any[]>([]);
  const [dbProjects, setDbProjects] = useState<any[]>([]);
  const [superAdminSearchQuery, setSuperAdminSearchQuery] = useState('');
  
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [migratingUser, setMigratingUser] = useState<any>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isAddingStore, setIsAddingStore] = useState(false);
  const [editingStore, setEditingStore] = useState<any>(null);
  const [newStoreData, setNewStoreData] = useState({ name: '', ownerEmail: '', id: '', maxUsers: 5 });
  const [isBackingUp, setIsBackingUp] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState<{visible: boolean, field: 'createdAt' | 'validUntil' | null}>({visible: false, field: null});
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const [brandingData, setBrandingData] = useState({ 
    appName: 'IKASIR PRO', 
    receiptWatermark: 'Powered by YadiApp', 
    showWatermark: true,
    subscriptionQrisUrl: '',
    subscriptionBankInfo: '',
    subscriptionEwalletInfo: '',
    webAppUrl: ''
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

  // Set up Firebase listeners selectively based on active feature
  useEffect(() => {
    let unsubUsers: any = () => {};
    let unsubStores: any = () => {};
    let unsubInfra: any = () => {};
    let unsubProjects: any = () => {};
    let unsubSubscriptions: any = () => {};
    let unsubBranding: any = () => {};

    // Always fetch branding for potential preview checks
    unsubBranding = onSnapshot(doc(db, 'system_settings', 'branding'), (docSnap) => {
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

    if (featureId === 'superAdminUsers') {
      unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const usr: any[] = [];
        snapshot.forEach((d) => usr.push({ id: d.id, ...d.data() }));
        setSuperAdminUsers(usr);
      });
      unsubStores = onSnapshot(collection(db, 'stores'), (snapshot) => {
        const str: any[] = [];
        snapshot.forEach((d) => str.push({ id: d.id, ...d.data() }));
        setSuperAdminStores(str);
      });
      unsubProjects = onSnapshot(collection(db, 'system_settings', 'database_projects', 'list'), (snapshot) => {
        const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setDbProjects(projects);
      });
    }

    if (featureId === 'superAdminStores') {
      unsubStores = onSnapshot(collection(db, 'stores'), (snapshot) => {
        const str: any[] = [];
        snapshot.forEach((d) => str.push({ id: d.id, ...d.data() }));
        setSuperAdminStores(str);
      });
      unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const usr: any[] = [];
        snapshot.forEach((d) => usr.push({ id: d.id, ...d.data() }));
        setSuperAdminUsers(usr);
      });
    }

    if (featureId === 'superAdminInfra') {
      unsubInfra = onSnapshot(doc(db, 'system_settings', 'infrastructure'), (docSnap) => {
        if (docSnap.exists()) {
          setInfraData(docSnap.data());
        }
      });
      unsubProjects = onSnapshot(collection(db, 'system_settings', 'database_projects', 'list'), (snapshot) => {
        const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setDbProjects(projects);
      });
      unsubStores = onSnapshot(collection(db, 'stores'), (snapshot) => {
        const str: any[] = [];
        snapshot.forEach((d) => str.push({ id: d.id, ...d.data() }));
        setSuperAdminStores(str);
      });
    }

    if (featureId === 'superAdminSubscriptions') {
      unsubSubscriptions = onSnapshot(collection(db, 'subscription_requests'), (snapshot) => {
        const subs: any[] = [];
        snapshot.forEach((d) => subs.push({ id: d.id, ...d.data() }));
        // Sort pending first, then newest
        subs.sort((a, b) => {
          if (a.status === 'pending' && b.status !== 'pending') return -1;
          if (a.status !== 'pending' && b.status === 'pending') return 1;
          const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
          const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
          return timeB - timeA;
        });
        setSubscriptionRequests(subs);
      });
    }

    return () => {
      unsubUsers();
      unsubStores();
      unsubInfra();
      unsubProjects();
      unsubSubscriptions();
      unsubBranding();
    };
  }, [featureId]);

  // Utility Download QRIS Handler
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

  // --- ACTIONS HANDLERS ---
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
      Alert.alert('Sukses', 'Data pengguna berhasil diperbarui!');
      setEditingUser(null);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal memperbarui data: ' + err.message);
    } finally {
      setIsSaving(false);
    }
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
                targetProjectId: isResetting ? null : targetProj.fb_project_id
              });
              Alert.alert('Sukses', 'Peta instansi user berhasil diperbarui.');
              setMigratingUser(null);
            } catch (err: any) {
              Alert.alert('Gagal', 'Gagal memetakan user: ' + err.message);
            } finally {
              setIsSaving(false);
            }
          }
        }
      ]
    );
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
                      await deleteDoc(doc(db, 'stores', storeId));
                      await deleteDoc(doc(db, 'settings', `store_${storeId}`));
                      
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
        mediaTypes: ['images'],
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
                Alert.alert('Sukses', `Berhasil diperbarui ${count} diskon.`);
              } else {
                Alert.alert('Info', 'Tidak ada data diskon lama.');
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
              Alert.alert('Gagal', 'Gagal memverifikasi: ' + err.message);
            } finally {
              setIsSaving(false);
            }
          }
        }
      ]
    );
  };

  // --- RENDER CONTENT BY FEATURE ID ---
  const renderContent = () => {
    switch (featureId) {
      case 'superAdminUsers':
        return (
          <View className="flex-1">
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
                        className="p-5 rounded-3xl border mb-3" 
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

                        <View className="flex-row justify-between pt-3 mt-3 border-t" style={{ borderColor: colors.border + '30' }}>
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
        );

      case 'superAdminStores':
        return (
          <View className="flex-1">
            {/* Search & Tambah Toko */}
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
                        className="p-5 rounded-3xl border mb-3" 
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                      >
                        <View className="flex-row justify-between items-center mb-3">
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
                              className="p-2.5 rounded-xl border bg-rose-500/10 border-rose-500/20"
                            >
                              <Trash2 size={14} color="#f43f5e" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View className="bg-black/10 p-3 rounded-2xl">
                          <View className="flex-row justify-between mb-1">
                            <Text className="text-[8px] font-black text-slate-500">PEMILIK:</Text>
                            <Text className="text-[9px] font-bold" style={{ color: colors.text }} numberOfLines={1}>{s.ownerEmail}</Text>
                          </View>
                          <View className="flex-row justify-between mb-1">
                            <Text className="text-[8px] font-black text-slate-500">KUOTA USER:</Text>
                            <Text className="text-[9px] font-bold" style={{ color: colors.text }}>{activeTenants} / {s.maxUsers || 5}</Text>
                          </View>
                          <View className="flex-row justify-between pt-1 border-t border-slate-800/10">
                            <Text className="text-[8px] font-black text-slate-500">STATUS:</Text>
                            <Text className={`text-[8px] font-black ${s.isActive !== false ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {s.isActive !== false ? 'AKTIF' : 'NON-AKTIF'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
              </View>
            </ScrollView>
          </View>
        );

      case 'superAdminBranding':
        return (
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

                <View className="h-[1px] w-full bg-slate-200/10 my-2" />

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
        );

      case 'superAdminInfra':
        return (
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="space-y-6 pb-20">
              {/* SYSTEM UTILITIES */}
              <View className="p-5 rounded-3xl border space-y-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
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

                {isRestoring && (
                  <View className="mt-2 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                    <Text className="text-[9px] font-black text-rose-500 text-center uppercase">Proses Restore: {restoreProgress}%</Text>
                  </View>
                )}
              </View>

              {/* CLOUDINARY CONFIGURATION */}
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

                <TouchableOpacity
                  onPress={handleUpdateInfra}
                  disabled={isSaving}
                  className="py-4 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: colors.accent }}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="font-black text-white text-xs uppercase tracking-wider">Simpan Kredensial</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* FIRESTORE PRIMARY CREDENTIALS */}
              <View className="p-5 rounded-3xl border space-y-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <Text className="text-[10px] font-black uppercase tracking-widest text-slate-400">Firebase Firestore Kredensial</Text>
                
                <View className="space-y-3">
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
                    <Text className="font-black text-white text-xs uppercase tracking-wider">Simpan Firebase Utama</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* ROUTED SHARDS (DB PROJECTS) */}
              <View className="p-5 rounded-3xl border space-y-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <View className="flex-row justify-between items-center">
                  <Text className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sharding Database Proyek</Text>
                  <TouchableOpacity onPress={() => setIsAddingProject(true)} className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <Plus size={14} color="#10b981" />
                  </TouchableOpacity>
                </View>

                <View className="space-y-3">
                  {dbProjects.map((proj) => (
                    <View key={proj.id} className="p-4 rounded-2xl border" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
                      <View className="flex-row justify-between items-center">
                        <View className="flex-1 pr-2">
                          <Text className="text-xs font-black uppercase" style={{ color: colors.text }} numberOfLines={1}>{proj.fb_project_id}</Text>
                          <Text className="text-[9px] font-bold text-slate-500" numberOfLines={1}>{proj.fb_auth_domain}</Text>
                        </View>
                        <View className="flex-row gap-2">
                          <TouchableOpacity 
                            onPress={() => {
                              setEditingProject(proj);
                              setInfraData(proj);
                              setIsAddingProject(true);
                            }}
                            className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl"
                          >
                            <Pencil size={12} color="#3b82f6" />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            onPress={() => handleDeleteProject(proj.id)}
                            className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl"
                          >
                            <Trash2 size={12} color="#f43f5e" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                  {dbProjects.length === 0 && (
                    <Text className="text-[10px] font-bold text-center italic py-2" style={{ color: colors.textMuted }}>Belum ada data cluster sharding.</Text>
                  )}
                </View>
              </View>
            </View>
          </ScrollView>
        );

      case 'superAdminSubscriptions':
        return (
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="space-y-4 pb-20">
              {subscriptionRequests.map(req => (
                <View key={req.id} className="p-5 rounded-3xl border mb-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                  <View className="flex-row justify-between mb-2">
                    <View>
                      <Text className="text-xs font-black uppercase" style={{ color: colors.text }}>{req.packageTitle}</Text>
                      <Text className="text-[10px] font-bold mt-1" style={{ color: colors.textMuted }}>{req.ownerEmail}</Text>
                    </View>
                    <View className={`px-2.5 py-0.5 rounded-full border ${req.status === 'pending' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                      <Text className={`text-[8px] font-black uppercase tracking-wider ${req.status === 'pending' ? 'text-amber-500' : 'text-emerald-500'}`}>{req.status}</Text>
                    </View>
                  </View>
                  <Text className="text-[10px] font-bold" style={{ color: colors.accent }}>Harga: Rp {req.price?.toLocaleString('id-ID')}</Text>
                  <Text className="text-[9px] font-bold mb-3" style={{ color: colors.textMuted }}>Metode: <Text className="uppercase" style={{ color: colors.text }}>{req.paymentMethod || 'qris'}</Text></Text>
                  
                  {req.proofUrl && (
                    <TouchableOpacity 
                      onPress={() => setPreviewImageUrl(req.proofUrl)}
                      activeOpacity={0.9}
                      className="w-full h-40 rounded-2xl overflow-hidden mb-3 border bg-black/10" 
                      style={{ borderColor: colors.border }}
                    >
                      <Image source={{ uri: req.proofUrl }} className="w-full h-full" resizeMode="cover" />
                    </TouchableOpacity>
                  )}

                  {req.status === 'pending' && (
                    <TouchableOpacity
                      onPress={() => handleVerifySubscription(req)}
                      disabled={isSaving}
                      className="w-full py-3.5 rounded-2xl items-center justify-center flex-row gap-2"
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
                <View className="py-20 items-center opacity-30">
                  <AlertCircle size={48} color={colors.textMuted} />
                  <Text className="text-xs font-bold mt-4" style={{ color: colors.textMuted }}>Belum ada pengajuan langganan.</Text>
                </View>
              )}
            </View>
          </ScrollView>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView className="flex-1" edges={['bottom']} style={{ backgroundColor: colors.bg }}>
      <View className="flex-1 px-6 pt-4">
        {renderContent()}
      </View>

      {/* --- SUB-MODALS OVERLAYS --- */}

      {/* 1. USER EDIT DIALOG OVERLAY */}
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

      {/* 2. CALENDAR DATE PICKER MODAL */}
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

      {/* 3. TENANT DATABASE MIGRATION ROUTING DIALOG OVERLAY */}
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

      {/* 4. TAMBAH TOKO MODAL OVERLAY */}
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

      {/* 5. EDIT TOKO DETAIL MODAL OVERLAY */}
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

      {/* 6. SHARD ADD/EDIT OVERLAY */}
      {isAddingProject && (
        <Modal visible={true} animationType="fade" transparent>
          <View className="flex-1 bg-black/80 justify-center p-6">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <ScrollView className="w-full max-w-sm rounded-[36px] p-6 space-y-4 max-h-[90%]" style={{ backgroundColor: colors.surface }}>
                <View className="flex-row justify-between items-center pb-2 border-b" style={{ borderColor: colors.border + '30' }}>
                  <Text className="text-base font-black" style={{ color: colors.text }}>
                    {editingProject ? 'Edit Proyek Database' : 'Tambah Proyek Database'}
                  </Text>
                  <TouchableOpacity onPress={() => {
                    setIsAddingProject(false);
                    setEditingProject(null);
                  }}>
                    <X size={20} color={colors.text} />
                  </TouchableOpacity>
                </View>

                {/* Firestore credentials form for Routed Shard */}
                <View className="space-y-3">
                  <View className="space-y-1">
                    <Text className="text-[8px] font-black uppercase text-slate-400">Project ID</Text>
                    <TextInput
                      value={infraData.fb_project_id || ''}
                      onChangeText={(txt) => setInfraData({ ...infraData, fb_project_id: txt })}
                      placeholder="e.g. kasir-pro-node-1"
                      placeholderTextColor={colors.textMuted}
                      className="p-2.5 border rounded-xl font-mono text-[10px]"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                    />
                  </View>
                  <View className="space-y-1">
                    <Text className="text-[8px] font-black uppercase text-slate-400">API Key</Text>
                    <TextInput
                      value={infraData.fb_api_key || ''}
                      onChangeText={(txt) => setInfraData({ ...infraData, fb_api_key: txt })}
                      secureTextEntry
                      placeholder="AIzaSy..."
                      placeholderTextColor={colors.textMuted}
                      className="p-2.5 border rounded-xl font-mono text-[10px]"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                    />
                  </View>
                  <View className="space-y-1">
                    <Text className="text-[8px] font-black uppercase text-slate-400">Auth Domain</Text>
                    <TextInput
                      value={infraData.fb_auth_domain || ''}
                      onChangeText={(txt) => setInfraData({ ...infraData, fb_auth_domain: txt })}
                      placeholder="e.g. kasir-pro-node-1.firebaseapp.com"
                      placeholderTextColor={colors.textMuted}
                      className="p-2.5 border rounded-xl font-mono text-[10px]"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                    />
                  </View>
                  <View className="space-y-1">
                    <Text className="text-[8px] font-black uppercase text-slate-400">Storage Bucket</Text>
                    <TextInput
                      value={infraData.fb_storage_bucket || ''}
                      onChangeText={(txt) => setInfraData({ ...infraData, fb_storage_bucket: txt })}
                      placeholder="e.g. kasir-pro-node-1.appspot.com"
                      placeholderTextColor={colors.textMuted}
                      className="p-2.5 border rounded-xl font-mono text-[10px]"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                    />
                  </View>
                  <View className="space-y-1">
                    <Text className="text-[8px] font-black uppercase text-slate-400">Messaging Sender ID</Text>
                    <TextInput
                      value={infraData.fb_messaging_sender_id || ''}
                      onChangeText={(txt) => setInfraData({ ...infraData, fb_messaging_sender_id: txt })}
                      placeholder="e.g. 123456789"
                      placeholderTextColor={colors.textMuted}
                      className="p-2.5 border rounded-xl font-mono text-[10px]"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                    />
                  </View>
                  <View className="space-y-1">
                    <Text className="text-[8px] font-black uppercase text-slate-400">App ID</Text>
                    <TextInput
                      value={infraData.fb_app_id || ''}
                      onChangeText={(txt) => setInfraData({ ...infraData, fb_app_id: txt })}
                      placeholder="1:123456:web:abcd..."
                      placeholderTextColor={colors.textMuted}
                      className="p-2.5 border rounded-xl font-mono text-[10px]"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleSaveProject}
                  disabled={isSaving}
                  className="py-4 rounded-2xl items-center justify-center mt-2"
                  style={{ backgroundColor: colors.accent }}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="font-black text-white text-xs uppercase tracking-wider">Simpan Proyek</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      )}

      {/* 7. FULLSCREEN IMAGE PREVIEW OVERLAY */}
      {previewImageUrl && (
        <Modal visible={!!previewImageUrl} transparent animationType="fade" onRequestClose={() => setPreviewImageUrl(null)}>
          <View className="flex-1 bg-black justify-center items-center relative">
            <Image source={{ uri: previewImageUrl }} className="w-full h-full" style={{ resizeMode: 'contain' }} />
            
            {/* Download/Share Button */}
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
