'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, where, getDocs, writeBatch } from 'firebase/firestore';
import { initializeApp, getApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, primaryDb, activeFirebaseConfig, isDynamicConfig } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  Loader2, 
  UserPlus, 
  Search, 
  Power, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  UserCog,
  ShieldAlert,
  Save,
  Tag,
  History,
  Database,
  Building2,
  Users as UsersIcon,
  Plus,
  Palette,
  Sparkles,
  Download,
  Server,
  Pencil,
  Globe,
  Edit2,
  Trash2,
  X,
  ArrowRight,
  LogOut,
  Mail,
  Receipt,
  Wallet,
  Upload,
  Bell,
  MessageSquare
} from 'lucide-react';
import { handleExportJSON, handleImportJSON, handleImportStoreJSON } from '@/lib/backupUtils';

export default function SuperAdminPage() {
  const { user, role } = useAuthStore();
  const router = useRouter();
  
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin',
    storeId: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'stores' | 'branding' | 'infrastructure' | 'subscriptions' | 'broadcast' | 'feedback'>('users');
  const [stores, setStores] = useState<any[]>([]);
  const [dbProjects, setDbProjects] = useState<any[]>([]);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [editingStore, setEditingStore] = useState<any>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [isAddingStore, setIsAddingStore] = useState(false);
  const [newStoreData, setNewStoreData] = useState({ name: '', ownerEmail: '', id: '', maxUsers: 5 });
  const [isBackingUp, setIsBackingUp] = useState<string | null>(null);
  const [migratingUser, setMigratingUser] = useState<any>(null);
  const [migratingStoreData, setMigratingStoreData] = useState<any>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreTargetStoreId, setRestoreTargetStoreId] = useState<string | null>(null);
  const [migrationMode, setMigrationMode] = useState<'standard' | 'mass'>('standard');
  const [subscriptionRequests, setSubscriptionRequests] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastLink, setBroadcastLink] = useState('');
  const [broadcastImageUrl, setBroadcastImageUrl] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

  const [isMaintenanceActive, setIsMaintenanceActive] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [isUpdatingMaintenance, setIsUpdatingMaintenance] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system_settings', 'maintenance'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsMaintenanceActive(data.isActive ?? false);
        setMaintenanceMessage(data.message ?? '');
      }
    });
    return () => unsub();
  }, []);

  const handleToggleMaintenance = async () => {
    const nextState = !isMaintenanceActive;
    const actionText = nextState ? 'MENGAKTIFKAN' : 'MENONAKTIFKAN';
    const confirmText = `Apakah Anda yakin ingin ${actionText} Mode Pemeliharaan? ${nextState ? 'Seluruh pengguna kasir/admin aktif di web & mobile akan segera dikunci secara real-time.' : 'Akses pengguna akan dibuka kembali.'}`;
    
    if (!confirm(confirmText)) return;
    
    setIsUpdatingMaintenance(true);
    try {
      await setDoc(doc(db, 'system_settings', 'maintenance'), {
        isActive: nextState,
        message: nextState ? (maintenanceMessage.trim() || 'Aplikasi sedang dalam pemeliharaan sistem. Harap coba beberapa saat lagi.') : '',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      alert(`Mode Pemeliharaan berhasil ${nextState ? 'diaktifkan' : 'dinonaktifkan'}!`);
    } catch (err: any) {
      console.error(err);
      alert('Gagal memperbarui status pemeliharaan: ' + err.message);
    } finally {
      setIsUpdatingMaintenance(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      alert('Judul dan pesan tidak boleh kosong!');
      return;
    }

    const confirmFirst = confirm('⚠️ PERINGATAN: Anda akan mengirimkan push notifikasi ini ke SEMUA pelanggan user di seluruh toko/tenant secara massal! Lanjutkan?');
    if (!confirmFirst) return;

    const confirmSecond = confirm('🚨 KONFIRMASI TERAKHIR: Tindakan ini tidak dapat dibatalkan dan akan langsung muncul di perangkat masing-masing pengguna. Kirim sekarang?');
    if (!confirmSecond) return;

    setIsSendingBroadcast(true);
    try {
      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: 'GLOBAL',
          title: broadcastTitle,
          message: broadcastMessage,
          data: {
            link: broadcastLink.trim() || '',
            imageUrl: broadcastImageUrl.trim() || ''
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        alert(`✅ Broadcast Berhasil Dikirim!\n\nSukses: ${data.successCount} perangkat\nGagal: ${data.failureCount} perangkat`);
        setBroadcastTitle('');
        setBroadcastMessage('');
        setBroadcastLink('');
        setBroadcastImageUrl('');
      } else {
        alert('❌ Gagal mengirim broadcast: ' + (data.error || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      console.error(err);
      alert('❌ Error mengirim broadcast: ' + err.message);
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const triggerBackup = async (storeId: string) => {
    if (!confirm(storeId === 'GLOBAL' ? 'Mulai pencadangan semua data toko?' : 'Mulai pencadangan untuk toko ini?')) return;
    setIsBackingUp(storeId);
    try {
      await handleExportJSON(storeId);
      alert('Backup berhasil diunduh!');
    } catch (e: any) {
      console.error(e);
      alert('Gagal mendownload backup: ' + e.message);
    } finally {
      setIsBackingUp(null);
    }
  };

  const onFileRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmFirst = confirm("⚠️ PERINGATAN KERAS: Proses 'Restore Global' akan MENIMPA data yang ada dengan file cadangan ini. Lanjutkan?");
    if (!confirmFirst) {
        e.target.value = '';
        return;
    }

    const confirmSecond = confirm("🚨 KONFIRMASI TERAKHIR: Tindakan ini tidak dapat dibatalkan dan dapat menyebabkan kehilangan data jika file backup Anda tidak valid. Anda yakin?");
    if (!confirmSecond) {
        e.target.value = '';
        return;
    }

    setIsRestoring(true);
    try {
      const result: any = await handleImportJSON(file);
      alert(`✅ RESTORE BERHASIL!\nTotal ${result.totalRestored} dokumen dipulihkan dari backup tanggal ${result.metadata.timestamp}.\n\nHalaman akan dimuat ulang.`);
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      alert('❌ RESTORE GAGAL: ' + err.message);
    } finally {
      setIsRestoring(false);
      e.target.value = '';
    }
  };

  const onStoreFileRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !restoreTargetStoreId) return;

    const confirmFirst = confirm("⚠️ PERINGATAN: Proses 'Restore Toko' akan mengimpor data dari file backup ke toko yang dipilih. Lanjutkan?");
    if (!confirmFirst) {
      e.target.value = '';
      setRestoreTargetStoreId(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const backupData = JSON.parse(content);

        if (!backupData.metadata || !backupData.data) {
          alert('❌ Format file backup tidak valid.');
          e.target.value = '';
          setRestoreTargetStoreId(null);
          return;
        }

        const sourceStoreId = backupData.metadata.storeId;
        if (sourceStoreId === 'GLOBAL') {
          alert('❌ File backup GLOBAL tidak dapat dipulihkan ke toko tunggal.');
          e.target.value = '';
          setRestoreTargetStoreId(null);
          return;
        }

        if (sourceStoreId !== restoreTargetStoreId) {
          const confirmDifferent = confirm(`⚠️ PERINGATAN TOKO BERBEDA:\nFile backup ini berasal dari Toko Lain (ID: ${sourceStoreId}).\n\nApakah Anda ingin memulihkannya ke Toko ini (${restoreTargetStoreId})?\nSemua dokumen yang diimpor akan dipetakan ke Toko baru ini.`);
          if (!confirmDifferent) {
            e.target.value = '';
            setRestoreTargetStoreId(null);
            return;
          }
        }

        const confirmSecond = confirm("🚨 KONFIRMASI TERAKHIR: Tindakan ini tidak dapat dibatalkan. Apakah Anda yakin?");
        if (!confirmSecond) {
          e.target.value = '';
          setRestoreTargetStoreId(null);
          return;
        }

        setIsRestoring(true);
        const result: any = await handleImportStoreJSON(file, restoreTargetStoreId);
        alert(`✅ RESTORE TOKO BERHASIL!\nTotal ${result.totalRestored} dokumen dipulihkan dari backup tanggal ${result.metadata.timestamp}.\n\nHalaman akan dimuat ulang.`);
        window.location.reload();
      } catch (err: any) {
        console.error(err);
        alert('❌ RESTORE TOKO GAGAL: ' + err.message);
      } finally {
        setIsRestoring(false);
        e.target.value = '';
        setRestoreTargetStoreId(null);
      }
    };
    reader.readAsText(file);
  };

  // Security Check
  useEffect(() => {
    if (!isLoading && role !== 'super-admin') {
      router.push('/');
    }
  }, [role, isLoading, router]);

  useEffect(() => {
    const qUsers = query(collection(primaryDb, 'users'));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const usr: any[] = [];
      snapshot.forEach((d) => usr.push({ id: d.id, ...d.data() }));
      setUsers(usr);
      setIsLoading(false);
    });

    const qStores = query(collection(db, 'stores'));
    const unsubscribeStores = onSnapshot(qStores, (snapshot) => {
      const str: any[] = [];
      snapshot.forEach((d) => str.push({ id: d.id, ...d.data() }));
      setStores(str);
    });

    const qSubscriptions = query(collection(primaryDb, 'subscription_requests'));
    const unsubscribeSubscriptions = onSnapshot(qSubscriptions, (snapshot) => {
      const subs: any[] = [];
      snapshot.forEach((d) => subs.push({ id: d.id, ...d.data() }));
      setSubscriptionRequests(subs);
    });

    const qFeedback = query(collection(primaryDb, 'feedback'));
    const unsubscribeFeedback = onSnapshot(qFeedback, (snapshot) => {
      const fbs: any[] = [];
      snapshot.forEach((d) => fbs.push({ id: d.id, ...d.data() }));
      fbs.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
      setFeedbacks(fbs);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeStores();
      unsubscribeSubscriptions();
      unsubscribeFeedback();
    };
  }, []);

  const handleDeleteFeedback = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus kritik & saran ini?')) return;
    try {
      await deleteDoc(doc(primaryDb, 'feedback', id));
      alert('Kritik & saran berhasil dihapus.');
    } catch (err: any) {
      alert('Gagal menghapus: ' + err.message);
    }
  };

  const handleMigrateData = async () => {
    if (!confirm('Pindahkan semua data tanpa Toko ke "Toko Utama (Default)"?')) return;
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
      alert(`Berhasil memigrasikan ${totalPatched} dokumen ke Toko Utama.`);
    } catch (err: any) {
      alert('Migrasi gagal: ' + err.message);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleMigrateDiscountStructure = async () => {
    if (!confirm('Migrasi struktur Diskon dari productId (Format Lama) ke appliedProductIds (Format Baru)?')) return;
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
            productId: null // Hapus field lama
          });
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
        alert(`Berhasil memperbarui ${count} dokumen diskon.`);
      } else {
        alert('Tidak ada dokumen diskon lama yang ditemukan.');
      }
    } catch (err: any) {
      alert('Migrasi gagal: ' + err.message);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.name || !newUserData.email || !newUserData.password) {
      alert('Nama, Email, dan Password tidak boleh kosong!');
      return;
    }

    setIsSaving(true);
    let secondaryApp;
    try {
      // 1. Dapatkan config dari primary app
      const primaryApp = getApp();
      const firebaseConfig = primaryApp.options;

      // 2. Buat secondary app instance dengan nama unik
      secondaryApp = initializeApp(firebaseConfig, `SuperAdminUserCreation-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);

      // 3. Buat user baru di Firebase Auth menggunakan secondary app
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, 
        newUserData.email, 
        newUserData.password
      );

      // 4. Logout secondary user & bersihkan app instance
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);
      secondaryApp = null;

      // 5. Simpan hak akses role ke koleksi Firestore (`users`)
      const selectedStore = stores.find(s => s.id === newUserData.storeId);
      
      await setDoc(doc(primaryDb, 'users', userCredential.user.uid), {
        name: newUserData.name,
        email: newUserData.email,
        role: newUserData.role,
        storeId: newUserData.storeId || 'default-store',
        storeName: selectedStore?.name || (newUserData.storeId === 'default-store' ? 'Toko Utama' : ''),
        permissions: {
          canAccessPOS: true,
          canManageProducts: newUserData.role === 'admin' || newUserData.role === 'super-admin',
          canCreateProducts: newUserData.role === 'admin' || newUserData.role === 'super-admin',
          canEditProducts: newUserData.role === 'admin' || newUserData.role === 'super-admin',
          canDeleteProducts: newUserData.role === 'admin' || newUserData.role === 'super-admin',
          canViewReports: newUserData.role === 'admin' || newUserData.role === 'super-admin',
          canManageUsers: newUserData.role === 'admin' || newUserData.role === 'super-admin',
          canEditSettings: newUserData.role === 'admin' || newUserData.role === 'super-admin',
          canManageEstimations: newUserData.role === 'admin' || newUserData.role === 'super-admin',
          canManageDebts: newUserData.role === 'admin' || newUserData.role === 'super-admin',
          canManageOrders: newUserData.role === 'admin' || newUserData.role === 'super-admin',
          canViewLogs: newUserData.role === 'admin' || newUserData.role === 'super-admin'
        },
        isActive: true,
        isSubscribed: true,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 hari dari sekarang
        createdAt: new Date().toISOString()
      });

      alert('Akun pengguna berhasil dibuat!');
      setIsAddingUser(false);
      setNewUserData({ name: '', email: '', password: '', role: 'admin', storeId: '' });
    } catch (err: any) {
      console.error(err);
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (e) {
          console.error(e);
        }
      }
      let errorMessage = 'Gagal mendaftarkan akun baru';
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Email sudah terdaftar.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Kata sandi terlalu lemah. Minimal 6 karakter.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Format email tidak valid.';
      }
      alert(errorMessage + ': ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {

    e.preventDefault();
    if (!editingUser) return;
    
    setIsSaving(true);
    try {
      await updateDoc(doc(primaryDb, 'users', editingUser.id), {
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

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreData.name || !newStoreData.id) return;
    
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'stores', newStoreData.id), {
        name: newStoreData.name,
        ownerEmail: newStoreData.ownerEmail || '-',
        createdAt: new Date().toISOString(),
        isActive: true,
        package: 'manual-pro',
        maxUsers: newStoreData.maxUsers || 5
      });
      alert('Toko berhasil ditambahkan!');
      setIsAddingStore(false);
      setNewStoreData({ name: '', ownerEmail: '', id: '', maxUsers: 5 });
    } catch (err: any) {
      console.error(err);
      alert('Gagal menambah toko: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStore = async (storeId: string, currentStatus: boolean) => {
    if (!confirm(`Tandai toko ini sebagai ${!currentStatus ? 'AKTIF' : 'NON-AKTIF'}?`)) return;
    
    try {
      await updateDoc(doc(db, 'stores', storeId), {
        isActive: !currentStatus
      });
      alert('Status toko berhasil diperbarui!');
    } catch (err: any) {
      console.error(err);
      alert('Gagal memperbarui status toko: ' + err.message);
    }
  };

  const handleUpdateStoreDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'stores', editingStore.id), {
        name: editingStore.name,
        ownerEmail: editingStore.ownerEmail || '-',
        maxUsers: parseInt(editingStore.maxUsers) || 5,
        disabledMenus: editingStore.disabledMenus || []
      });
      
      // SYNC to Settings for Receipt/Invoice
      await updateDoc(doc(db, 'settings', "store_" + editingStore.id), {
        storeName: editingStore.name
      }).catch(() => {}); // Ignore if settings doc doesn't exist yet

      alert('Detail toko berhasil diperbarui!');
      setEditingStore(null);
    } catch (err: any) {
      console.error(err);
      alert('Gagal memperbarui detail toko: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifySubscription = async (req: any) => {
    if (!confirm('Validasi pembayaran ini dan tambahkan masa aktif?')) return;
    setIsSaving(true);
    try {
      const match = req.packageId.match(/(\d+)m/);
      const months = match ? parseInt(match[1]) : 1;
      
      const newValidUntil = new Date();
      newValidUntil.setDate(newValidUntil.getDate() + (months * 30));

      const batch = writeBatch(primaryDb);
      
      batch.update(doc(primaryDb, 'subscription_requests', req.id), {
        status: 'approved',
        approvedAt: new Date().toISOString()
      });

      const qUsers = query(collection(primaryDb, 'users'), where('storeId', '==', req.storeId));
      const userSnaps = await getDocs(qUsers);
      userSnaps.forEach((userDoc) => {
        batch.update(userDoc.ref, {
          validUntil: newValidUntil.toISOString(),
          isSubscribed: true
        });
      });

      await batch.commit();
      alert(`Berhasil memperpanjang masa aktif toko selama ${months} bulan.`);
    } catch (err: any) {
      console.error(err);
      alert('Gagal memverifikasi langganan: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const [brandingData, setBrandingData] = useState<any>({ 
    appName: 'IKASIR PRO', 
    receiptWatermark: 'Powered by YadiApp',
    showWatermark: true,
    subscriptionQrisUrl: '',
    subscriptionBankInfo: '',
    subscriptionEwalletInfo: '',
    webAppUrl: '',
    pkg_1m_price: 30000,
    pkg_1m_discount_type: 'none',
    pkg_1m_discount_val: 0,
    pkg_3m_price: 84000,
    pkg_3m_discount_type: 'none',
    pkg_3m_discount_val: 0,
    pkg_6m_price: 159000,
    pkg_6m_discount_type: 'none',
    pkg_6m_discount_val: 0,
    pkg_12m_price: 306000,
    pkg_12m_discount_type: 'none',
    pkg_12m_discount_val: 0,
    expiredDisabledMenus: [],
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

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system_settings', 'branding'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setBrandingData({
          appName: data.appName || 'IKASIR PRO',
          receiptWatermark: data.receiptWatermark || 'Powered by YadiApp',
          showWatermark: data.showWatermark ?? true,
          subscriptionQrisUrl: data.subscriptionQrisUrl || '',
          subscriptionBankInfo: data.subscriptionBankInfo || '',
          subscriptionEwalletInfo: data.subscriptionEwalletInfo || '',
          webAppUrl: data.webAppUrl || '',
          pkg_1m_price: Number(data.pkg_1m_price ?? 30000),
          pkg_1m_discount_type: data.pkg_1m_discount_type || 'none',
          pkg_1m_discount_val: Number(data.pkg_1m_discount_val ?? 0),
          pkg_3m_price: Number(data.pkg_3m_price ?? 84000),
          pkg_3m_discount_type: data.pkg_3m_discount_type || 'none',
          pkg_3m_discount_val: Number(data.pkg_3m_discount_val ?? 0),
          pkg_6m_price: Number(data.pkg_6m_price ?? 159000),
          pkg_6m_discount_type: data.pkg_6m_discount_type || 'none',
          pkg_6m_discount_val: Number(data.pkg_6m_discount_val ?? 0),
          pkg_12m_price: Number(data.pkg_12m_price ?? 306000),
          pkg_12m_discount_type: data.pkg_12m_discount_type || 'none',
          pkg_12m_discount_val: Number(data.pkg_12m_discount_val ?? 0),
          expiredDisabledMenus: data.expiredDisabledMenus || [],
        });
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system_settings', 'infrastructure'), (doc) => {
      if (doc.exists()) {
        setInfraData(doc.data());
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'system_settings', 'database_projects', 'list'), (snapshot) => {
      const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDbProjects(projects);
    });
    return () => unsub();
  }, []);

  const handleUpdateBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'system_settings', 'branding'), {
        ...brandingData,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      alert('Informasi Branding berhasil diperbarui secara global!');
    } catch (err: any) {
      console.error(err);
      alert('Gagal update branding: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleExpiredMenu = (path: string) => {
    const current = brandingData.expiredDisabledMenus || [];
    const next = current.includes(path) 
      ? current.filter((p: string) => p !== path) 
      : [...current, path];
    setBrandingData({ ...brandingData, expiredDisabledMenus: next });
  };

  const handleSaveExpiredMenus = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'system_settings', 'branding'), {
        expiredDisabledMenus: brandingData.expiredDisabledMenus || [],
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      alert('Pengaturan Menu Kedaluwarsa global berhasil diperbarui!');
    } catch (err: any) {
      console.error(err);
      alert('Gagal memperbarui menu kedaluwarsa: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateInfra = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // 1. Save to Firestore for global persistence
      await setDoc(doc(db, 'system_settings', 'infrastructure'), {
        ...infraData,
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      // 2. Map fields for localStorage override
      const fbConfig = {
        apiKey: infraData.fb_api_key,
        authDomain: infraData.fb_auth_domain,
        projectId: infraData.fb_project_id,
        storageBucket: infraData.fb_storage_bucket,
        messagingSenderId: infraData.fb_messaging_sender_id,
        appId: infraData.fb_app_id
      };

      // Only save to localStorage if config seems valid
      if (fbConfig.apiKey && fbConfig.projectId) {
        localStorage.setItem('infra_config_fb', JSON.stringify(fbConfig));
      }

      alert('Konfigurasi Infrastruktur berhasil diperbarui! Halaman akan dimuat ulang untuk menerapkan perubahan.');
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      alert('Gagal update infrastruktur: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadQris = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const cloudName = infraData.cloudinary_cloud_name || 'dkcjfwbvc';
    const uploadPreset = infraData.cloudinary_upload_preset || 'kasirpos';

    setIsSaving(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const formData = new FormData();
        formData.append('file', base64);
        formData.append('upload_preset', uploadPreset);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        
        if (data.secure_url) {
          setBrandingData({ ...brandingData, subscriptionQrisUrl: data.secure_url });
          alert('Gambar QRIS berhasil diunggah! Jangan lupa klik Simpan Pengaturan.');
        } else {
          alert('Gagal mengunggah gambar: ' + (data.error?.message || 'Unknown error'));
        }
        setIsSaving(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      alert('Error: ' + err.message);
      setIsSaving(false);
    }
  };

  const handleUpdateSubscriptionBranding = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'system_settings', 'branding'), {
        subscriptionQrisUrl: brandingData.subscriptionQrisUrl || '',
        subscriptionBankInfo: brandingData.subscriptionBankInfo || '',
        subscriptionEwalletInfo: brandingData.subscriptionEwalletInfo || '',
        pkg_1m_price: Number(brandingData.pkg_1m_price ?? 30000),
        pkg_1m_discount_type: brandingData.pkg_1m_discount_type || 'none',
        pkg_1m_discount_val: Number(brandingData.pkg_1m_discount_val ?? 0),
        pkg_3m_price: Number(brandingData.pkg_3m_price ?? 84000),
        pkg_3m_discount_type: brandingData.pkg_3m_discount_type || 'none',
        pkg_3m_discount_val: Number(brandingData.pkg_3m_discount_val ?? 0),
        pkg_6m_price: Number(brandingData.pkg_6m_price ?? 159000),
        pkg_6m_discount_type: brandingData.pkg_6m_discount_type || 'none',
        pkg_6m_discount_val: Number(brandingData.pkg_6m_discount_val ?? 0),
        pkg_12m_price: Number(brandingData.pkg_12m_price ?? 306000),
        pkg_12m_discount_type: brandingData.pkg_12m_discount_type || 'none',
        pkg_12m_discount_val: Number(brandingData.pkg_12m_discount_val ?? 0),
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      alert('Pengaturan Metode Pembayaran berhasil diperbarui!');
    } catch (err: any) {
      console.error(err);
      alert('Gagal menyimpan: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetInfra = async () => {
    if (confirm('Kembalikan ke pengaturan awal (Environment Variables)? Ini akan MENGHAPUS pengaturan kustom secara permanen dari database dan penyimpanan lokal.')) {
      setIsSaving(true);
      try {
        localStorage.removeItem('infra_config_fb');
        await deleteDoc(doc(db, 'system_settings', 'infrastructure'));
        alert('Pengaturan telah dikembalikan ke default. Aplikasi akan memuat ulang.');
        window.location.reload();
      } catch (err: any) {
        console.error(err);
        alert('Gagal menghapus pengaturan: ' + err.message);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const projId = editingProject?.id || doc(collection(db, 'system_settings', 'database_projects', 'list')).id;
      await setDoc(doc(db, 'system_settings', 'database_projects', 'list', projId), {
        ...infraData,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      alert('Proyek Database berhasil disimpan!');
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
      alert('Gagal simpan proyek: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async (projId: string) => {
    if (confirm('Hapus proyek database ini?')) {
      try {
        await deleteDoc(doc(db, 'system_settings', 'database_projects', 'list', projId));
      } catch (err: any) {
        alert('Gagal hapus: ' + err.message);
      }
    }
  };

  const handleMigrateUser = async (userToMigrate: any, targetProj: any) => {
    const isResetting = !targetProj;
    const targetId = isResetting ? 'DEFAULT (Internal)' : targetProj.fb_project_id;
    
    if (!confirm(`Pindahkan data user ${userToMigrate.email} dan tokonya ke ${targetId}?`)) return;
    
    setIsSaving(true);
    try {
      const { initializeApp: initApp } = await import('firebase/app');
      const { 
         getFirestore: gFirestore, 
         doc: fDoc, 
         setDoc: fSet, 
         getDoc: fGet, 
         collection: fColl, 
         getDocs: fGetDocs, 
         query: fQuery, 
         where: fWhere, 
         writeBatch, 
         deleteDoc: fDeleteDoc 
      } = await import('firebase/firestore');
      
      // 1. Initialize Source DB (Detect if user is already migrated)
      const sourceDb = userToMigrate.infraConfig 
        ? gFirestore(initApp({
            apiKey: userToMigrate.infraConfig.fb_api_key,
            authDomain: userToMigrate.infraConfig.fb_auth_domain,
            projectId: userToMigrate.infraConfig.fb_project_id,
            storageBucket: userToMigrate.infraConfig.fb_storage_bucket,
            messagingSenderId: userToMigrate.infraConfig.fb_messaging_sender_id,
            appId: userToMigrate.infraConfig.fb_app_id
          }, `source-${Date.now()}`))
        : db; // Source is Primary if no infraConfig

      // 2. Initialize Target DB
      const targetDb = isResetting 
        ? db // Target is Primary
        : gFirestore(initApp({
            apiKey: targetProj.fb_api_key,
            authDomain: targetProj.fb_auth_domain,
            projectId: targetProj.fb_project_id,
            storageBucket: targetProj.fb_storage_bucket,
            messagingSenderId: targetProj.fb_messaging_sender_id,
            appId: targetProj.fb_app_id
          }, `target-${Date.now()}`));

      // 3. Transfer Data
      let totalDocsMigrated = 0;
      // A. User Doc (Always update mapping metadata)
      const userRef = fDoc(targetDb, 'users', userToMigrate.id);
      const migratedUser = {
        ...userToMigrate,
        targetProjectId: isResetting ? null : targetProj.fb_project_id,
        infraConfig: isResetting ? null : targetProj,
        migratedAt: new Date().toISOString()
      };
      await fSet(userRef, migratedUser);

      // B. Store & Settings (Transfer across DBs)
      if (userToMigrate.storeId) {
        const storeSnap = await fGet(fDoc(sourceDb, 'stores', userToMigrate.storeId));
        if (storeSnap.exists()) {
          await fSet(fDoc(targetDb, 'stores', userToMigrate.storeId), storeSnap.data());
          
          const settingsSnap = await fGet(fDoc(sourceDb, 'settings', `store_${userToMigrate.storeId}`));
          if (settingsSnap.exists()) {
             await fSet(fDoc(targetDb, 'settings', `store_${userToMigrate.storeId}`), settingsSnap.data());
          }
        }

        // C. Mass Migration Data Elements
        if (migrationMode === 'mass') {
           const collectionsToMigrate = [
              'products', 'categories', 'product_extras', 'discounts', 'transactions', 
              'customers', 'expenses', 'estimations', 'shifts', 'cashier_sessions', 
              'cash_flow', 'stock_history', 'activity_logs'
           ];
           
           for (const collName of collectionsToMigrate) {
              const q = fQuery(fColl(sourceDb, collName), fWhere('storeId', '==', userToMigrate.storeId));
              const snap = await fGetDocs(q);
              
              if (!snap.empty) {
                 let batch = writeBatch(targetDb);
                 let count = 0;
                 for (const docSnap of snap.docs) {
                    batch.set(fDoc(targetDb, collName, docSnap.id), docSnap.data());
                    count++;
                    totalDocsMigrated++;
                    if (count === 400) {
                       await batch.commit();
                       batch = writeBatch(targetDb);
                       count = 0;
                    }
                 }
                 if (count > 0) {
                    await batch.commit();
                 }
              }
           }
        }
      }

      // 4. Update Global Registry (Primary DB)
      // This is crucial so AuthProvider knows where to route the next login
      await updateDoc(doc(primaryDb, 'users', userToMigrate.id), {
        targetProjectId: isResetting ? null : targetProj.fb_project_id,
        infraConfig: isResetting ? null : targetProj,
        lastMigration: new Date().toISOString()
      });

      if (migrationMode === 'mass') {
         alert(`Berhasil! Data ${userToMigrate.email} dipindahkan secara massal ke ${targetId}.\nTotal ${totalDocsMigrated} dokumen dipindahkan.`);
         if (userToMigrate.storeId) {
            const shouldDeleteOld = confirm(`⚠️ PERINGATAN HAPUS DATA ASAL ⚠️\n\nApakah Anda ingin menghapus database/data lama toko ini di proyek asal (${userToMigrate.infraConfig ? userToMigrate.infraConfig.fb_project_id : 'DEFAULT (Internal)'}) secara PERMANEN?`);
            if (shouldDeleteOld) {
               setIsSaving(true);
               try {
                  await fDeleteDoc(fDoc(sourceDb, 'stores', userToMigrate.storeId)).catch(() => {});
                  await fDeleteDoc(fDoc(sourceDb, 'settings', `store_${userToMigrate.storeId}`)).catch(() => {});

                  const collectionsToDelete = [
                     'products', 'categories', 'product_extras', 'discounts', 'transactions', 
                     'customers', 'expenses', 'estimations', 'shifts', 'cashier_sessions', 
                     'cash_flow', 'stock_history', 'activity_logs', 'users'
                  ];

                  let totalDeleted = 0;
                  for (const collName of collectionsToDelete) {
                     const q = fQuery(fColl(sourceDb, collName), fWhere('storeId', '==', userToMigrate.storeId));
                     const snap = await fGetDocs(q);
                     if (!snap.empty) {
                        let batch = writeBatch(sourceDb);
                        let count = 0;
                        for (const docSnap of snap.docs) {
                           batch.delete(docSnap.ref);
                           count++;
                           totalDeleted++;
                           if (count === 400) {
                              await batch.commit();
                              batch = writeBatch(sourceDb);
                              count = 0;
                           }
                        }
                        if (count > 0) {
                           await batch.commit();
                        }
                     }
                  }
                  alert(`Data lama toko beserta ${totalDeleted} dokumen berhasil dihapus secara permanen dari proyek asal.`);
               } catch (delErr: any) {
                  console.error(delErr);
                  alert('Gagal menghapus data lama: ' + delErr.message);
               }
            }
         }
      } else {
         alert(`Berhasil! Data ${userToMigrate.email} telah dipindahkan ke ${targetId}.`);
      }
      setMigratingUser(null);
    } catch (err: any) {
      console.error(err);
      alert('Gagal migrasi: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMigrateStore = async (storeToMigrate: any, targetProj: any) => {
    const isResetting = !targetProj;
    const targetId = isResetting ? 'DEFAULT (Internal)' : targetProj.fb_project_id;
    
    const confirmMsg = isResetting 
      ? `Apakah Anda yakin ingin mengembalikan seluruh data Toko "${storeToMigrate.name}" ke database UTAMA? Semua transaksi, produk, dan pengguna akan dipetakan kembali ke database utama.`
      : `⚠️ PERINGATAN MIGRASI ⚠️\n\nAnda akan memindahkan Toko "${storeToMigrate.name}" beserta seluruh data produk, kategori, ekstra, diskon, pelanggan, transaksi, estimasi, pengeluaran, serta seluruh pengguna toko tersebut ke proyek database: ${targetId}.\n\nLanjutkan migrasi?`;
      
    if (!confirm(confirmMsg)) return;

    setIsSaving(true);
    try {
      const { initializeApp: initApp } = await import('firebase/app');
      const { getFirestore: gFirestore, doc: fDoc, setDoc: fSet, getDoc: fGet, collection: fColl, getDocs: fGetDocs, query: fQuery, where: fWhere, writeBatch } = await import('firebase/firestore');

      // 1. Determine Source Database config
      const associatedUsers = users.filter(u => u.storeId === storeToMigrate.id);
      const userWithInfra = associatedUsers.find(u => u.infraConfig && u.infraConfig.fb_project_id);
      const sourceInfra = userWithInfra ? userWithInfra.infraConfig : null;

      const sourceDb = sourceInfra 
        ? gFirestore(initApp({
            apiKey: sourceInfra.fb_api_key,
            authDomain: sourceInfra.fb_auth_domain,
            projectId: sourceInfra.fb_project_id,
            storageBucket: sourceInfra.fb_storage_bucket,
            messagingSenderId: sourceInfra.fb_messaging_sender_id,
            appId: sourceInfra.fb_app_id
          }, `source-store-${Date.now()}`))
        : db;

      // 2. Initialize Target Database
      const targetDb = isResetting 
        ? db 
        : gFirestore(initApp({
            apiKey: targetProj.fb_api_key,
            authDomain: targetProj.fb_auth_domain,
            projectId: targetProj.fb_project_id,
            storageBucket: targetProj.fb_storage_bucket,
            messagingSenderId: targetProj.fb_messaging_sender_id,
            appId: targetProj.fb_app_id
          }, `target-store-${Date.now()}`));

      // 3. Migrate Store Document
      const storeRef = fDoc(sourceDb, 'stores', storeToMigrate.id);
      const storeSnap = await fGet(storeRef);
      if (storeSnap.exists()) {
        await fSet(fDoc(targetDb, 'stores', storeToMigrate.id), storeSnap.data());
      } else {
        const { id, ...rest } = storeToMigrate;
        await fSet(fDoc(targetDb, 'stores', storeToMigrate.id), rest);
      }

      // 4. Migrate Store Settings Document
      const settingsRefSrc = fDoc(sourceDb, 'settings', `store_${storeToMigrate.id}`);
      const settingsSnap = await fGet(settingsRefSrc);
      if (settingsSnap.exists()) {
        await fSet(fDoc(targetDb, 'settings', `store_${storeToMigrate.id}`), settingsSnap.data());
      }

      // 5. Migrate Data Elements
      const collectionsToMigrate = [
         'products', 'categories', 'product_extras', 'discounts', 'transactions', 
         'customers', 'expenses', 'estimations', 'shifts', 'cashier_sessions', 
         'cash_flow', 'stock_history', 'activity_logs'
      ];
      let totalDocsMigrated = 0;

      for (const collName of collectionsToMigrate) {
         const q = fQuery(fColl(sourceDb, collName), fWhere('storeId', '==', storeToMigrate.id));
         const snap = await fGetDocs(q);
         
         if (!snap.empty) {
            let batch = writeBatch(targetDb);
            let count = 0;
            for (const docSnap of snap.docs) {
               batch.set(fDoc(targetDb, collName, docSnap.id), docSnap.data());
               count++;
               totalDocsMigrated++;
               if (count === 400) {
                  await batch.commit();
                  batch = writeBatch(targetDb);
                  count = 0;
               }
            }
            if (count > 0) {
               await batch.commit();
            }
         }
      }

      // 6. Migrate Users
      const primaryBatch = writeBatch(primaryDb);
      
      for (const u of associatedUsers) {
         const userDocSnap = await fGet(fDoc(sourceDb, 'users', u.id));
         const userData = userDocSnap.exists() ? userDocSnap.data() : u;

         const updatedUserData = {
            ...userData,
            targetProjectId: isResetting ? null : targetProj.fb_project_id,
            infraConfig: isResetting ? null : targetProj,
            lastMigration: new Date().toISOString()
         };

         await fSet(fDoc(targetDb, 'users', u.id), updatedUserData);

         primaryBatch.update(fDoc(primaryDb, 'users', u.id), {
            targetProjectId: isResetting ? null : targetProj.fb_project_id,
            infraConfig: isResetting ? null : targetProj,
            lastMigration: new Date().toISOString()
         });
      }

      await primaryBatch.commit();
      
      const shouldDeleteOld = confirm(
         `✅ MIGRASI BERHASIL!\n\nToko "${storeToMigrate.name}" telah dipindahkan ke ${targetId}.\nTotal ${totalDocsMigrated} dokumen dipindahkan.\nTotal ${associatedUsers.length} pengguna dialihkan.\n\nApakah Anda ingin menghapus database/data lama toko ini di proyek asal (${sourceInfra ? sourceInfra.fb_project_id : 'DEFAULT (Internal)'}) secara PERMANEN?`
      );

      if (shouldDeleteOld) {
         setIsSaving(true);
         try {
            const { deleteDoc: fDeleteDoc } = await import('firebase/firestore');
            await fDeleteDoc(fDoc(sourceDb, 'stores', storeToMigrate.id)).catch(() => {});
            await fDeleteDoc(fDoc(sourceDb, 'settings', `store_${storeToMigrate.id}`)).catch(() => {});

            const collectionsToDelete = [
               'products', 'categories', 'product_extras', 'discounts', 'transactions', 
               'customers', 'expenses', 'estimations', 'shifts', 'cashier_sessions', 
               'cash_flow', 'stock_history', 'activity_logs', 'users'
            ];

            let totalDeleted = 0;
            for (const collName of collectionsToDelete) {
               const q = fQuery(fColl(sourceDb, collName), fWhere('storeId', '==', storeToMigrate.id));
               const snap = await fGetDocs(q);
               if (!snap.empty) {
                  let batch = writeBatch(sourceDb);
                  let count = 0;
                  for (const docSnap of snap.docs) {
                     batch.delete(docSnap.ref);
                     count++;
                     totalDeleted++;
                     if (count === 400) {
                        await batch.commit();
                        batch = writeBatch(sourceDb);
                        count = 0;
                     }
                  }
                  if (count > 0) {
                     await batch.commit();
                  }
               }
            }
            alert(`Data lama toko beserta ${totalDeleted} dokumen berhasil dihapus secara permanen dari proyek asal.`);
         } catch (delErr: any) {
            console.error(delErr);
            alert('Gagal menghapus data lama: ' + delErr.message);
         }
      }
      setMigratingStoreData(null);
    } catch (err: any) {
      console.error(err);
      alert('❌ Gagal melakukan migrasi: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStorePermanently = async (storeId: string) => {
    if (confirm('⚠️ PERINGATAN KERAS ⚠️\n\nAnda yakin ingin menghapus toko ini secara PERMANEN? Semua data (Produk, Transaksi, Pelanggan, Karyawan) yang terkait akan ikut hangus dan tidak dapat dikembalikan!')) {
      if (confirm('Konfirmasi Terakhir: Apakah Anda benar-benar yakin? Tindakan ini TIDAK BISA dibatalkan.')) {
        setIsSaving(true);
        try {
          await deleteDoc(doc(db, 'stores', storeId));
          await deleteDoc(doc(db, 'settings', `store_${storeId}`));
          
          const collectionsToDelete = ['products', 'transactions', 'customers', 'users', 'expenses', 'discounts', 'categories', 'product_extras', 'estimations', 'subscription_requests'];
          let totalDeleted = 0;
          for (const collName of collectionsToDelete) {
            const q = query(collection(db, collName), where('storeId', '==', storeId));
            const snap = await getDocs(q);
            let batch = writeBatch(db);
            let count = 0;
            for (const docSnap of snap.docs) {
              batch.delete(docSnap.ref);
              count++;
              totalDeleted++;
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
          alert(`Toko beserta ${totalDeleted} data terkait berhasil dihapus secara permanen.`);
        } catch (error: any) {
          console.error(error);
          alert('Terjadi kesalahan saat menghapus data toko: ' + error.message);
        } finally {
          setIsSaving(false);
        }
      }
    }
  };

  const handleDeleteUserPermanently = async (userId: string, email: string) => {
    if (confirm(`⚠️ PERINGATAN KERAS ⚠️\n\nAnda yakin ingin menghapus akses User "${email}" secara PERMANEN dari database utama?`)) {
      setIsSaving(true);
      try {
        await deleteDoc(doc(primaryDb, 'users', userId));
        alert('User berhasil dihapus secara permanen dari Firestore.');
      } catch (error: any) {
        console.error(error);
        alert('Gagal menghapus user: ' + error.message);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleDeleteSubscription = async (reqId: string) => {
    if (confirm('Yakin ingin menghapus riwayat langganan ini?')) {
      setIsSaving(true);
      try {
        await deleteDoc(doc(primaryDb, 'subscription_requests', reqId));
        alert('Riwayat langganan berhasil dihapus.');
      } catch (error: any) {
        console.error(error);
        alert('Gagal menghapus riwayat: ' + error.message);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group users by storeId for hierarchical display
  const groupedUsers = (() => {
    const groups: { storeId: string; storeName: string; users: any[] }[] = [];
    const storeMap = new Map<string, any[]>();
    
    filteredUsers.forEach(u => {
      const sid = u.storeId || '__no_store__';
      if (!storeMap.has(sid)) storeMap.set(sid, []);
      storeMap.get(sid)!.push(u);
    });

    // Sort: stores with names first, then no-store group last
    const sortedKeys = Array.from(storeMap.keys()).sort((a, b) => {
      if (a === '__no_store__') return 1;
      if (b === '__no_store__') return -1;
      const nameA = stores.find(s => s.id === a)?.name || '';
      const nameB = stores.find(s => s.id === b)?.name || '';
      return nameA.localeCompare(nameB);
    });

    sortedKeys.forEach(sid => {
      const store = stores.find(s => s.id === sid);
      groups.push({
        storeId: sid,
        storeName: store?.name || (sid === '__no_store__' ? 'Tanpa Toko' : sid),
        users: storeMap.get(sid)!
      });
    });

    return groups;
  })();

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-accent animate-spin" />
        <p className="text-app-text-muted font-black uppercase tracking-[0.2em] animate-pulse">Otorisasi Panel Super...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-accent/20 rounded-2xl shadow-lg shadow-accent/10 shrink-0">
                <ShieldCheck size={32} className="text-accent" />
             </div>
             <div>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-foreground tracking-tight italic">Panel Super <span className="text-accent">Admin</span></h1>
                <p className="text-[10px] md:text-sm text-app-text-muted font-bold tracking-wide">Pengaturan izin akses & status langganan global</p>
             </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4">
           <button 
             onClick={handleMigrateData}
             disabled={isMigrating}
             className="btn-3d btn-3d-amber"
           >
              <span className="btn-3d-top text-[10px] md:text-xs px-6 py-4 font-black">
                 {isMigrating ? <Loader2 className="animate-spin" size={16} /> : <Database size={16} />}
                 MIGRASI DATA LAMA
              </span>
           </button>

           <button 
             onClick={handleMigrateDiscountStructure}
             disabled={isMigrating || isBackingUp !== null}
             className="btn-3d btn-3d-blue"
           >
              <span className="btn-3d-top text-[10px] md:text-xs px-6 py-4 font-black">
                 {isMigrating ? <Loader2 className="animate-spin" size={16} /> : <Tag size={16} />}
                 MIGRASI DISKON
              </span>
           </button>

           <button 
             onClick={() => triggerBackup('GLOBAL')}
             disabled={isBackingUp !== null || isRestoring}
             className="btn-3d btn-3d-emerald"
           >
              <span className="btn-3d-top text-[10px] md:text-xs px-6 py-4 font-black">
                 {isBackingUp === 'GLOBAL' ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                 BACKUP GLOBAL
              </span>
           </button>
           
           <div className="relative">
              <input 
                type="file" 
                id="restore-file" 
                accept=".json" 
                className="hidden" 
                onChange={onFileRestore}
                disabled={isRestoring}
              />
              <input 
                type="file" 
                id="restore-store-file" 
                accept=".json" 
                className="hidden" 
                onChange={onStoreFileRestore}
                disabled={isRestoring}
              />
              <button 
                onClick={() => document.getElementById('restore-file')?.click()}
                disabled={isRestoring || isBackingUp !== null}
                className="btn-3d btn-3d-rose"
              >
                 <span className="btn-3d-top text-[10px] md:text-xs px-6 py-4 font-black">
                    {isRestoring ? <Loader2 className="animate-spin" size={16} /> : <History size={16} />}
                    RESTORE GLOBAL
                 </span>
              </button>
           </div>
           
           <div className="relative group flex-1 sm:flex-none">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-app-text-muted group-focus-within:text-accent transition-colors">
                <Search size={18} />
              </div>
              <input 
                type="text" 
                placeholder="Pencarian global..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full lg:w-80 bg-surface border border-app-border rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all shadow-xl shadow-black/5"
              />
           </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex p-1.5 bg-surface/50 border border-app-border rounded-[1.5rem] md:rounded-2xl overflow-x-auto no-scrollbar">
             <button 
               onClick={() => setActiveTab('users')}
               className={`flex-1 md:flex-none px-6 md:px-8 py-3 rounded-xl font-black text-[10px] md:text-xs tracking-widest transition-all flex items-center justify-center gap-2 shrink-0 ${activeTab === 'users' ? 'bg-accent text-foreground shadow-lg' : 'text-app-text-muted hover:text-foreground'}`}
             >
                <UsersIcon size={16} /> <span className="hidden sm:inline">DATA</span> USER
             </button>
             <button 
               onClick={() => setActiveTab('stores')}
               className={`flex-1 md:flex-none px-6 md:px-8 py-3 rounded-xl font-black text-[10px] md:text-xs tracking-widest transition-all flex items-center justify-center gap-2 shrink-0 ${activeTab === 'stores' ? 'bg-accent text-foreground shadow-lg' : 'text-app-text-muted hover:text-foreground'}`}
             >
                <Building2 size={16} /> <span className="hidden sm:inline">KELOLA</span> TOKO
             </button>
             <button 
               onClick={() => setActiveTab('branding')}
               className={`flex-1 md:flex-none px-6 md:px-8 py-3 rounded-xl font-black text-[10px] md:text-xs tracking-widest transition-all flex items-center justify-center gap-2 shrink-0 ${activeTab === 'branding' ? 'bg-accent text-foreground shadow-lg' : 'text-app-text-muted hover:text-foreground'}`}
             >
                <Palette size={16} /> BRANDING
             </button>
             <button 
               onClick={() => setActiveTab('infrastructure')}
               className={`flex-1 md:flex-none px-6 md:px-8 py-3 rounded-xl font-black text-[10px] md:text-xs tracking-widest transition-all flex items-center justify-center gap-2 shrink-0 ${activeTab === 'infrastructure' ? 'bg-accent text-foreground shadow-lg' : 'text-app-text-muted hover:text-foreground'}`}
             >
                <Database size={16} /> INFRASTRUKTUR
             </button>
             <button 
               onClick={() => setActiveTab('subscriptions')}
               className={`relative flex-1 md:flex-none px-6 md:px-8 py-3 rounded-xl font-black text-[10px] md:text-xs tracking-widest transition-all flex items-center justify-center gap-2 shrink-0 ${activeTab === 'subscriptions' ? 'bg-accent text-foreground shadow-lg' : 'text-app-text-muted hover:text-foreground'}`}
             >
                <Receipt size={16} /> LANGGANAN
                {subscriptionRequests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center text-[9px] text-white animate-bounce shadow-lg shadow-rose-500/50">
                    {subscriptionRequests.filter(r => r.status === 'pending').length}
                  </span>
                )}
             </button>
             <button 
               onClick={() => setActiveTab('broadcast')}
               className={`flex-1 md:flex-none px-6 md:px-8 py-3 rounded-xl font-black text-[10px] md:text-xs tracking-widest transition-all flex items-center justify-center gap-2 shrink-0 ${activeTab === 'broadcast' ? 'bg-accent text-foreground shadow-lg' : 'text-app-text-muted hover:text-foreground'}`}
             >
                <Bell size={16} /> BROADCAST
             </button>
             <button 
               onClick={() => setActiveTab('feedback')}
               className={`flex-1 md:flex-none px-6 md:px-8 py-3 rounded-xl font-black text-[10px] md:text-xs tracking-widest transition-all flex items-center justify-center gap-2 shrink-0 ${activeTab === 'feedback' ? 'bg-accent text-foreground shadow-lg' : 'text-app-text-muted hover:text-foreground'}`}
             >
                <MessageSquare size={16} /> KRITIK & SARAN
             </button>
          </div>

          <div className="flex gap-2">
            {activeTab === 'stores' && (
               <button 
                 onClick={() => setIsAddingStore(true)}
                 className="flex items-center justify-center gap-2 px-6 py-4 md:py-3 bg-emerald-500 text-white rounded-2xl md:rounded-xl font-black text-xs hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
               >
                  <Plus size={18} /> TAMBAH TOKO
               </button>
            )}

            {activeTab === 'users' && (
               <button 
                  onClick={() => setIsAddingUser(true)}
                  className="flex items-center justify-center gap-2 px-6 py-4 md:py-3 bg-accent text-foreground rounded-2xl md:rounded-xl font-black text-xs hover:bg-accent-hover transition-all shadow-lg shadow-accent/20 animate-in fade-in duration-300"
               >
                  <Plus size={18} /> BUAT AKUN
               </button>
            )}
          </div>
      </div>

      {/* DASHBOARD STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-surface border border-app-border p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] flex flex-col gap-1">
           <span className="text-[8px] md:text-[10px] font-black text-app-text-muted uppercase tracking-widest">Total User</span>
           <span className="text-xl md:text-3xl font-black text-foreground">{users.length}</span>
        </div>
        <div className="bg-surface border border-app-border p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] flex flex-col gap-1">
           <span className="text-[8px] md:text-[10px] font-black text-accent uppercase tracking-widest">Total Toko</span>
           <span className="text-xl md:text-3xl font-black text-accent">{stores.length}</span>
        </div>
        <div className="bg-surface border border-app-border p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] flex flex-col gap-1">
           <span className="text-[8px] md:text-[10px] font-black text-emerald-500 uppercase tracking-widest">Langganan</span>
           <span className="text-xl md:text-3xl font-black text-emerald-500">{users.filter(u => u.isSubscribed).length}</span>
        </div>
        <div className="bg-surface border border-app-border p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] flex flex-col gap-1">
           <span className="text-[8px] md:text-[10px] font-black text-rose-500 uppercase tracking-widest">Blokir</span>
           <span className="text-xl md:text-3xl font-black text-rose-500">{users.filter(u => u.isActive === false).length}</span>
        </div>
      </div>

      {activeTab === 'users' ? (
        <div className="space-y-4">
           {groupedUsers.map(group => (
             <div key={group.storeId} className="bg-surface border border-app-border rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl shadow-black/10">
                {/* Store Group Header */}
                <div className="flex items-center justify-between px-6 md:px-8 py-4 bg-background/50 border-b border-app-border/50">
                   <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${group.storeId === '__no_store__' ? 'bg-slate-500/10 text-slate-400' : 'bg-accent/10 text-accent'}`}>
                         <Building2 size={20} />
                      </div>
                      <div>
                         <p className="font-black text-sm md:text-base text-foreground uppercase tracking-tight">{group.storeName}</p>
                         <p className="text-[9px] md:text-[10px] font-bold text-app-text-muted">{group.users.length} pengguna terdaftar</p>
                      </div>
                   </div>
                   <span className={`px-3 py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest border ${group.storeId !== '__no_store__' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                      {group.storeId !== '__no_store__' ? '🏪 TOKO' : '👤 CUSTOMER'}
                   </span>
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                   <table className="w-full text-left">
                      <thead>
                         <tr className="bg-background/30 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted">
                           <th className="px-8 py-4 uppercase">Pengguna</th>
                           <th className="px-8 py-4 uppercase">Izin Akses</th>
                           <th className="px-8 py-4 uppercase">Langganan</th>
                           <th className="px-8 py-4 uppercase">Kedaluwarsa</th>
                           <th className="px-8 py-4 uppercase text-center">Tindakan</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-app-border/30">
                         {group.users.map(u => (
                           <tr key={u.id} className="group hover:bg-background/20 transition-colors">
                              <td className="px-8 py-5">
                                 <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center text-foreground font-black text-xs shadow-lg shadow-accent/20">
                                       {u.email?.[0].toUpperCase()}
                                    </div>
                                    <div>
                                       <p className="font-black text-sm text-foreground">{u.name || 'No Name'}</p>
                                       <p className="text-[10px] font-bold text-app-text-muted">{u.email}</p>
                                       <div className="flex items-center gap-1.5 mt-1">
                                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                            u.role === 'super-admin' ? 'bg-amber-500/10 text-amber-500' : 
                                            u.role === 'admin' ? 'bg-accent/10 text-accent' : 'bg-background text-app-text-muted'
                                          }`}>
                                            {u.role || 'CASHIER'}
                                          </span>
                                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${u.targetProjectId ? 'bg-amber-500/20 text-amber-500 animate-pulse' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10'}`}>
                                             DB: {u.targetProjectId || 'UTAMA'}
                                          </span>
                                       </div>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-8 py-5">
                                 {u.isActive !== false ? (
                                   <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 w-fit px-3 py-1.5 rounded-full border border-emerald-500/20">
                                      <CheckCircle2 size={14} />
                                      <span className="text-[9px] font-black uppercase tracking-widest">IZIN AKTIF</span>
                                    </div>
                                 ) : (
                                   <div className="flex items-center gap-2 text-rose-500 bg-rose-500/10 w-fit px-3 py-1.5 rounded-full border border-rose-500/20">
                                      <ShieldAlert size={14} />
                                      <span className="text-[9px] font-black uppercase tracking-widest">DIBLOKIR</span>
                                    </div>
                                 )}
                              </td>
                              <td className="px-8 py-5">
                                 {u.isSubscribed ? (
                                   <div className="flex items-center gap-2 text-accent">
                                      <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                                      <span className="text-[10px] font-black uppercase tracking-widest italic">Berlangganan</span>
                                    </div>
                                 ) : (
                                   <span className="text-[10px] font-bold text-app-text-muted italic opacity-50">TIDAK AKTIF</span>
                                 )}
                              </td>
                              <td className="px-8 py-5">
                                 <div className="flex items-center gap-2 text-app-text-muted font-bold text-xs bg-background/50 px-3 py-1.5 rounded-xl w-fit">
                                    <History size={14} />
                                    {u.validUntil ? new Date(u.validUntil).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-'}
                                 </div>
                              </td>
                              <td className="px-8 py-5 text-center">
                                 <div className="flex items-center justify-center gap-2">
                                    <button 
                                      onClick={() => setMigratingUser(u)}
                                      title="Migrasi ke DB lain"
                                      className="p-3 bg-surface hover:bg-amber-500 hover:text-white text-amber-500 rounded-2xl border border-app-border transition-all shadow-sm active:scale-90"
                                    >
                                       <ArrowRight size={18} />
                                    </button>
                                    <button 
                                      onClick={() => setEditingUser(u)}
                                      className="p-3 bg-surface hover:bg-accent hover:text-foreground text-app-text-muted rounded-2xl border border-app-border transition-all shadow-sm active:scale-90"
                                    >
                                       <UserCog size={18} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteUserPermanently(u.id, u.email || 'No Email')}
                                      title="Hapus Permanen"
                                      className="p-3 bg-surface hover:bg-rose-500 hover:text-white text-rose-500 rounded-2xl border border-app-border transition-all shadow-sm active:scale-90"
                                    >
                                       <Trash2 size={18} />
                                    </button>
                                 </div>
                              </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-app-border/30">
                   {group.users.map(u => (
                     <div key={u.id} className="p-5 flex flex-col gap-3">
                        <div className="flex items-start justify-between">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-accent text-foreground flex items-center justify-center font-black text-xs">
                                 {u.email?.[0].toUpperCase()}
                              </div>
                              <div>
                                 <p className="font-black text-sm text-foreground">{u.name || 'No Name'}</p>
                                 <p className="text-[10px] font-bold text-app-text-muted">{u.email}</p>
                              </div>
                           </div>
                           <div className="flex gap-1.5">
                              <button 
                                onClick={() => setMigratingUser(u)}
                                className="p-2.5 bg-background border border-app-border text-amber-500 rounded-xl active:scale-90"
                              >
                                 <ArrowRight size={16} />
                              </button>
                              <button 
                                onClick={() => setEditingUser(u)}
                                className="p-2.5 bg-background border border-app-border text-app-text-muted rounded-xl active:scale-90"
                              >
                                 <UserCog size={16} />
                              </button>
                              <button 
                                onClick={() => handleDeleteUserPermanently(u.id, u.email || 'No Email')}
                                className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl active:scale-90"
                              >
                                 <Trash2 size={16} />
                              </button>
                           </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-1.5">
                           <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                             u.role === 'super-admin' ? 'bg-amber-500/10 text-amber-500' : 
                             u.role === 'admin' ? 'bg-accent/10 text-accent' : 'bg-background text-app-text-muted'
                           }`}>
                             {u.role || 'CASHIER'}
                           </span>
                           <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${u.isActive !== false ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                             {u.isActive !== false ? 'AKTIF' : 'BLOKIR'}
                           </span>
                           <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${u.isSubscribed ? 'bg-purple-500/10 text-purple-500' : 'bg-background text-app-text-muted/50'}`}>
                             {u.isSubscribed ? 'PRO' : 'FREE'}
                           </span>
                           <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${u.targetProjectId ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                             DB: {u.targetProjectId || 'UTAMA'}
                           </span>
                        </div>
                        
                        <div className="flex items-center justify-between text-[9px] font-bold text-app-text-muted bg-background/50 px-3 py-2 rounded-lg">
                           <span className="flex items-center gap-1"><History size={10} /> {u.validUntil ? new Date(u.validUntil).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-'}</span>
                           <span className="font-mono opacity-50">#{u.id?.substring(0,8)}</span>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
           ))}
           {groupedUsers.length === 0 && (
             <div className="bg-surface border border-app-border rounded-[2rem] p-20 text-center">
                <UsersIcon className="w-16 h-16 opacity-10 mx-auto mb-4" />
                <p className="text-app-text-muted font-bold italic">Tidak ada pengguna yang ditemukan.</p>
             </div>
           )}
        </div>
      ) : activeTab === 'stores' ? (
        <div className="bg-surface border border-app-border rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl shadow-black/10 animate-in fade-in duration-500">
           {/* Desktop View */}
           <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                 <thead>
                    <tr className="bg-background/50 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted">
                      <th className="px-8 py-6 uppercase">Informasi Toko</th>
                      <th className="px-8 py-6 uppercase">Pemilik</th>
                      <th className="px-8 py-6 uppercase">Kuota User</th>
                      <th className="px-8 py-6 uppercase">Status</th>
                      <th className="px-8 py-6 uppercase text-center">Tindakan</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-app-border/30">
                    {stores.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).map(s => (
                      <tr key={s.id} className="group hover:bg-background/20 transition-colors">
                         <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 rounded-2xl bg-surface border border-app-border flex items-center justify-center text-accent font-black shadow-lg">
                                  <Building2 size={24} />
                               </div>
                               <div>
                                  <p className="font-black text-sm text-foreground uppercase tracking-tight">{s.name}</p>
                                  <p className="text-[10px] font-bold text-app-text-muted italic">{s.id}</p>
                               </div>
                            </div>
                         </td>
                         <td className="px-8 py-6">
                            <span className="text-xs font-bold text-foreground bg-background px-3 py-1.5 rounded-xl border border-app-border">
                               {s.ownerEmail}
                            </span>
                         </td>
                         <td className="px-8 py-6 text-xs font-black text-foreground tracking-widest uppercase italic">
                            <span className="text-accent">{users.filter(u => u.storeId === s.id).length}</span> / {s.maxUsers || 5} User
                         </td>
                         <td className="px-8 py-6">
                              {s.isActive !== false ? (
                                <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 w-fit px-3 py-1.5 rounded-full border border-emerald-500/20">
                                   <CheckCircle2 size={14} />
                                   <span className="text-[9px] font-black uppercase tracking-widest">AKTIF</span>
                                 </div>
                              ) : (
                                <div className="flex items-center gap-2 text-amber-500 bg-amber-500/10 w-fit px-3 py-1.5 rounded-full border border-amber-500/20 animate-pulse">
                                   <History size={14} />
                                   <span className="text-[9px] font-black uppercase tracking-widest">MENUNGGU</span>
                                 </div>
                              )}
                           </td>
                           <td className="px-8 py-6 text-center">
                             <div className="flex items-center justify-center gap-2">
                               <button 
                                 onClick={() => setEditingStore(s)}
                                 className="p-3 bg-surface hover:bg-blue-500 hover:text-white text-blue-500 rounded-2xl border border-app-border transition-all shadow-sm active:scale-90"
                                 title="Edit Detail Toko"
                               >
                                  <Pencil size={18} />
                               </button>
                               <button 
                                 onClick={() => triggerBackup(s.id)}
                                 disabled={isBackingUp !== null || isRestoring}
                                 className="p-3 bg-surface hover:bg-accent hover:text-foreground text-app-text-muted rounded-2xl border border-app-border transition-all shadow-sm active:scale-90 disabled:opacity-50"
                                 title="Backup Toko"
                               >
                                  {isBackingUp === s.id ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                               </button>
                               <button 
                                  onClick={() => {
                                    setRestoreTargetStoreId(s.id);
                                    setTimeout(() => {
                                      document.getElementById('restore-store-file')?.click();
                                    }, 100);
                                  }}
                                  disabled={isRestoring || isBackingUp !== null}
                                  className="p-3 bg-surface hover:bg-amber-500 hover:text-white text-amber-500 rounded-2xl border border-app-border transition-all shadow-sm active:scale-90 disabled:opacity-50"
                                  title="Upload Database Toko"
                                >
                                   {isRestoring && restoreTargetStoreId === s.id ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                                </button>
                                <button 
                                  onClick={() => setMigratingStoreData(s)}
                                  className="p-3 bg-surface hover:bg-emerald-500 hover:text-white text-emerald-500 rounded-2xl border border-app-border transition-all shadow-sm active:scale-90"
                                  title="Migrasi Database Toko"
                                >
                                  <Database size={18} />
                                </button>
                                <button 
                                  onClick={() => handleUpdateStore(s.id, s.isActive ?? true)}
                                  className={`p-3 rounded-2xl border transition-all shadow-sm active:scale-90 ${
                                    s.isActive !== false 
                                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500 hover:text-white' 
                                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500 hover:text-white'
                                  }`}
                                  title={s.isActive !== false ? 'Matikan Toko' : 'Aktifkan Toko'}
                                >
                                   <Power size={18} />
                               </button>
                               <button 
                                 onClick={() => handleDeleteStorePermanently(s.id)}
                                 className="p-3 bg-surface hover:bg-rose-500 hover:text-white text-rose-500 rounded-2xl border border-app-border transition-all shadow-sm active:scale-90"
                                 title="Hapus Permanen Toko"
                               >
                                  <Trash2 size={18} />
                               </button>
                             </div>
                          </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>

           {/* Mobile Card View for Stores */}
           <div className="md:hidden divide-y divide-app-border">
              {stores.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).map(s => (
                <div key={s.id} className="p-5 flex flex-col gap-4">
                   <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-background border border-app-border flex items-center justify-center text-accent">
                            <Building2 size={20} />
                         </div>
                         <div>
                            <p className="font-black text-sm text-foreground uppercase truncate max-w-[150px]">{s.name}</p>
                            <p className="text-[9px] font-bold text-app-text-muted italic">{s.id}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                         <button 
                            onClick={() => setEditingStore(s)}
                            className="p-2 bg-background border border-app-border text-blue-500 rounded-xl active:scale-90"
                         >
                            <Pencil size={16} />
                         </button>
                         <button 
                             onClick={() => triggerBackup(s.id)}
                             disabled={isBackingUp !== null || isRestoring}
                             className="p-2 bg-background border border-app-border text-app-text-muted rounded-xl active:scale-90 disabled:opacity-50"
                          >
                             {isBackingUp === s.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                          </button>
                          <button 
                             onClick={() => {
                               setRestoreTargetStoreId(s.id);
                               setTimeout(() => {
                                 document.getElementById('restore-store-file')?.click();
                               }, 100);
                             }}
                             disabled={isRestoring || isBackingUp !== null}
                             className="p-2 bg-background border border-app-border text-amber-500 rounded-xl active:scale-90 disabled:opacity-50"
                          >
                             {isRestoring && restoreTargetStoreId === s.id ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                          </button>
                          <button 
                             onClick={() => setMigratingStoreData(s)}
                             className="p-2 bg-background border border-app-border text-emerald-500 rounded-xl active:scale-90"
                          >
                             <Database size={16} />
                          </button>
                         <button 
                            onClick={() => handleUpdateStore(s.id, s.isActive ?? true)}
                          className={`p-2 rounded-xl border transition-all ${
                            s.isActive !== false 
                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' 
                            : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          }`}
                       >
                          <Power size={16} />
                         </button>
                         <button 
                            onClick={() => handleDeleteStorePermanently(s.id)}
                            className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl active:scale-90"
                         >
                            <Trash2 size={16} />
                         </button>
                      </div>
                   </div>
                   
                   <div className="bg-background/50 p-4 rounded-xl border border-app-border/30 space-y-2">
                      <div className="flex justify-between items-center">
                         <span className="text-[8px] font-black text-app-text-muted uppercase italic">Pemilik:</span>
                         <span className="text-[10px] font-bold text-foreground">{s.ownerEmail}</span>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-[8px] font-black text-app-text-muted uppercase italic">Kuota User:</span>
                         <span className="text-[10px] font-bold text-foreground">
                            <span className="text-accent">{users.filter(u => u.storeId === s.id).length}</span> / {s.maxUsers || 5}
                         </span>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-[8px] font-black text-app-text-muted uppercase italic">Status:</span>
                         {s.isActive !== false ? (
                           <span className="text-[9px] font-black text-emerald-500 uppercase">AKTIF</span>
                         ) : (
                           <span className="text-[9px] font-black text-amber-500 uppercase animate-pulse">MENUNGGU</span>
                         )}
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      ) : activeTab === 'branding' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in zoom-in-95 duration-500">
           <div className="bg-surface border border-app-border rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl">
              <div className="mb-8">
                 <h3 className="text-2xl font-black text-foreground mb-2 flex items-center gap-3">
                    <Palette className="text-accent" /> Visual Branding
                 </h3>
                 <p className="text-xs text-app-text-muted font-medium">Ubah identitas visual aplikasi secara global.</p>
              </div>
              
              <form onSubmit={handleUpdateBranding} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Nama Aplikasi Global</label>
                    <input 
                      type="text" 
                      value={brandingData.appName}
                      onChange={e => setBrandingData({...brandingData, appName: e.target.value.toUpperCase()})}
                      className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-black text-lg focus:outline-none focus:border-accent transition-all shadow-inner"
                      placeholder="Contoh: IKASIR PRO"
                    />
                    <p className="text-[9px] text-app-text-muted italic ml-1">*Akan ditampilkan di sidebar dan header seluruh tenant.</p>
                 </div>
                 
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Watermark Struk Belanja</label>
                    <input 
                      type="text" 
                      value={brandingData.receiptWatermark}
                      onChange={e => setBrandingData({...brandingData, receiptWatermark: e.target.value})}
                      className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent transition-all"
                      placeholder="Contoh: Powered by YadiApp"
                    />
                    <p className="text-[9px] text-app-text-muted italic ml-1">*Muncul di bagian paling bawah setiap struk yang dicetak.</p>
                 </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Domain / URL Web & API App</label>
                     <input 
                       type="text" 
                       value={brandingData.webAppUrl || ''}
                       onChange={e => setBrandingData({...brandingData, webAppUrl: e.target.value})}
                       className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent transition-all"
                       placeholder="Contoh: https://ikasir-pro.vercel.app"
                     />
                     <p className="text-[9px] text-app-text-muted italic ml-1">*Digunakan oleh aplikasi mobile untuk mengirim push notifikasi.</p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-background border border-app-border rounded-2xl">
                    <div>
                       <p className="text-xs font-black text-foreground">Status Watermark</p>
                       <p className="text-[9px] text-app-text-muted">Tampilkan/Sembunyikan watermark di struk.</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setBrandingData({...brandingData, showWatermark: !brandingData.showWatermark})}
                      className={`w-14 h-8 rounded-full transition-all relative ${brandingData.showWatermark ? 'bg-accent' : 'bg-app-border'}`}
                    >
                       <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${brandingData.showWatermark ? 'left-7' : 'left-1'}`} />
                    </button>
                 </div>

                 <button 
                   type="submit" 
                   disabled={isSaving}
                   className="w-full py-5 bg-accent hover:bg-accent-hover text-foreground rounded-2xl font-black shadow-xl shadow-accent/20 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs active:scale-95 mt-4"
                 >
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                    SIMPAN PERUBAHAN
                 </button>
              </form>
           </div>

             <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
               {/* Kontrol Menu Kedaluwarsa Global */}
               <div className="bg-surface border border-app-border rounded-[2rem] p-6 md:p-8 shadow-2xl">
                  <div className="mb-6">
                     <h3 className="text-xl font-black text-foreground mb-2 flex items-center gap-3">
                        <ShieldAlert className="text-rose-500" /> Menu Kedaluwarsa (Global)
                     </h3>
                     <p className="text-xs text-app-text-muted font-medium">
                        Pilih menu mana saja yang dinonaktifkan (samar & tidak bisa diklik) di seluruh toko ketika masa aktif habis.
                     </p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                     {[
                       { name: 'Kasir (POS)', path: '/pos' },
                       { name: 'Daftar Pesanan', path: '/orders' },
                       { name: 'Estimasi Biaya', path: '/estimations' },
                       { name: 'Shift Karyawan', path: '/shifts' },
                       { name: 'Manajemen Produk', path: '/products' },
                       { name: 'Transaksi', path: '/transactions' },
                       { name: 'Hutang Piutang', path: '/debts' },
                       { name: 'Laporan', path: '/reports' },
                       { name: 'Manajemen User', path: '/users' },
                       { name: 'Log Aktifitas', path: '/logs' },
                       { name: 'Pengaturan Toko', path: '/settings' },
                     ].map((menu) => {
                       const isChecked = (brandingData.expiredDisabledMenus || []).includes(menu.path);
                       return (
                         <button
                           key={menu.path}
                           type="button"
                           onClick={() => handleToggleExpiredMenu(menu.path)}
                           className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-300 active:scale-95 ${
                             isChecked 
                               ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' 
                               : 'bg-background border-app-border text-app-text-muted hover:border-app-border-hover'
                           }`}
                         >
                           <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                             isChecked ? 'bg-rose-500 border-rose-500 text-white' : 'border-app-border bg-surface'
                           }`}>
                             {isChecked && <span className="text-xs font-black">✓</span>}
                           </div>
                           <span className="text-xs font-black uppercase tracking-tight truncate">{menu.name}</span>
                         </button>
                       );
                     })}
                  </div>
                  
                  <button 
                    type="button"
                    onClick={handleSaveExpiredMenus}
                    disabled={isSaving}
                    className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black shadow-xl shadow-rose-500/20 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs active:scale-95"
                  >
                     {isSaving ? <Loader2 className="animate-spin" /> : <Save size={16} />}
                     SIMPAN BLOKIR MENU KEDALUWARSA
                  </button>
               </div>

               {/* Preview Identitas */}
               <div className="bg-accent/5 border border-accent/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 flex flex-col justify-center items-center text-center">
                  <div className="w-20 h-20 bg-accent/20 text-accent rounded-full flex items-center justify-center mb-6">
                     <Sparkles size={32} />
                  </div>
                  <h4 className="text-xl font-black text-foreground mb-4">Preview Identitas</h4>
                  <div className="bg-surface border border-app-border rounded-2xl p-6 w-full max-w-xs shadow-xl">
                     <div className="flex items-center gap-3 border-b border-app-border pb-4 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-accent" />
                        <span className="font-black text-sm tracking-widest uppercase italic">{brandingData.appName}</span>
                     </div>
                     <div className="space-y-2 mb-4">
                        <div className="h-2 w-full bg-app-text-muted/10 rounded" />
                        <div className="h-2 w-3/4 bg-app-text-muted/10 rounded" />
                     </div>
                     <div className="border-t border-dashed border-app-border pt-4 text-[8px] font-bold text-app-text-muted uppercase tracking-widest opacity-60">
                        {brandingData.receiptWatermark}
                     </div>
                  </div>
               </div>
             </div>
        </div>
      ) : activeTab === 'infrastructure' ? (
        <div className="animate-in fade-in zoom-in-95 duration-500 space-y-8">
           {/* MAINTENANCE MODE CARD */}
           <div className="p-6 bg-surface border border-app-border rounded-[2rem] shadow-xl flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isMaintenanceActive ? 'bg-rose-500/20 text-rose-500 animate-pulse' : 'bg-slate-500/10 text-slate-400'}`}>
                    <Bell size={24} />
                 </div>
                 <div>
                    <h4 className="text-sm font-black text-foreground uppercase tracking-widest">Mode Pemeliharaan (Maintenance)</h4>
                    <p className="text-[10px] font-bold text-app-text-muted mt-1 leading-relaxed max-w-lg">
                       Mengaktifkan mode ini akan langsung mengunci akses seluruh pengguna kasir/admin di web dan mobile secara real-time agar tidak melakukan transaksi. Akun Super Admin dikecualikan dan tetap memiliki akses penuh.
                    </p>
                 </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0 w-full lg:w-auto">
                 <input 
                    type="text" 
                    placeholder="Pesan pemeliharaan (opsional)..."
                    value={maintenanceMessage}
                    onChange={(e) => setMaintenanceMessage(e.target.value)}
                    className="flex-1 lg:w-80 bg-background border border-app-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-accent"
                 />
                 <button
                    onClick={handleToggleMaintenance}
                    disabled={isUpdatingMaintenance}
                    className="btn-3d btn-3d-rose shrink-0"
                 >
                    <span className="btn-3d-top text-xs px-6 py-3 font-black">
                       {isUpdatingMaintenance ? <Loader2 className="animate-spin" size={14} /> : null}
                       {isMaintenanceActive ? 'NONAKTIFKAN PEMELIHARAAN' : 'AKTIFKAN PEMELIHARAAN'}
                    </span>
                 </button>
              </div>
           </div>
           {/* CONNECTION STATUS BADGE */}
           <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-6 bg-surface border border-app-border rounded-[2rem] shadow-xl overflow-hidden relative group">
              <div className="flex items-center gap-4 relative z-10">
                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDynamicConfig ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                    <Server size={24} />
                 </div>
                 <div>
                    <div className="flex items-center gap-2">
                       <h4 className="text-sm font-black text-foreground uppercase tracking-widest">Status Koneksi Aktif</h4>
                       <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.2em] ${isDynamicConfig ? 'bg-amber-500 text-white animate-pulse' : 'bg-emerald-500 text-white'}`}>
                          {isDynamicConfig ? 'OVERRIDE AKTIF' : 'DEFAULT (.ENV)'}
                       </span>
                    </div>
                    <p className="text-[10px] font-bold text-app-text-muted mt-1 uppercase tracking-tighter">
                       <span className="text-foreground">Project ID:</span> {activeFirebaseConfig.projectId} | <span className="text-foreground">API Key:</span> {String(activeFirebaseConfig.apiKey).substring(0, 6)}...
                    </p>
                 </div>
              </div>
              <div className="flex items-center gap-2 relative z-10 shrink-0">
                 <div className="text-right hidden sm:block">
                    <p className="text-[8px] font-black text-app-text-muted uppercase tracking-[0.2em]">Target Database</p>
                    <p className="text-xs font-black text-foreground font-mono">{activeFirebaseConfig.projectId}.firebaseapp.com</p>
                 </div>
                 <div className={`w-3 h-3 rounded-full ${isDynamicConfig ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`} />
              </div>
                               <div className={`absolute -right-20 -top-20 w-64 h-64 blur-[100px] opacity-10 transition-colors ${isDynamicConfig ? 'bg-amber-500' : 'bg-emerald-500'}`} />
           </div>

           <form onSubmit={handleUpdateInfra} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-surface border border-app-border rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl space-y-8">
                 <div>
                    <h3 className="text-2xl font-black text-foreground mb-2 flex items-center gap-3">
                       <Sparkles className="text-accent" /> Cloudinary Storage
                    </h3>
                    <p className="text-xs text-app-text-muted font-medium italic leading-relaxed">Penyimpanan aset gambar (Produk & Logo). Jika dikosongkan, aplikasi akan menggunakan akun default developer.</p>
                 </div>
                 
                 <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Cloud Name</label>
                       <input 
                         type="text" 
                         value={infraData.cloudinary_cloud_name || ''}
                         onChange={e => setInfraData({...infraData, cloudinary_cloud_name: e.target.value})}
                         className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent transition-all"
                         placeholder="Contoh: dkcjfwbvc"
                       />
                       {infraData.cloudinary_cloud_name && (
                          <p className="text-[8px] font-bold text-accent italic ml-1">Aktif saat ini: {infraData.cloudinary_cloud_name}</p>
                       )}
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Upload Preset (Unsigned)</label>
                       <input 
                         type="text" 
                         value={infraData.cloudinary_upload_preset || ''}
                         onChange={e => setInfraData({...infraData, cloudinary_upload_preset: e.target.value})}
                         className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent transition-all"
                         placeholder="Contoh: kasirpos"
                       />
                    </div>
                 </div>
              </div>

              <div className="bg-surface border border-app-border rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl space-y-8">
                 <div>
                    <h3 className="text-2xl font-black text-foreground mb-2 flex items-center gap-3">
                       <Database className="text-accent" /> Firebase Firestore
                    </h3>
                    <p className="text-xs text-app-text-muted font-medium italic leading-relaxed">Koneksi database utama. PERINGATAN: Mengubah ini akan menyebabkan aplikasi terhubung ke database baru yang mungkin kosong.</p>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">API Key</label>
                       <input 
                         type="password" 
                         value={infraData.fb_api_key || ''}
                         onChange={e => setInfraData({...infraData, fb_api_key: e.target.value})}
                         className="w-full p-3 bg-background border border-app-border rounded-xl text-foreground font-mono text-xs focus:outline-none focus:border-accent transition-all"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Project ID</label>
                       <input 
                         type="text" 
                         value={infraData.fb_project_id || ''}
                         onChange={e => setInfraData({...infraData, fb_project_id: e.target.value})}
                         className="w-full p-3 bg-background border border-app-border rounded-xl text-foreground font-mono text-xs focus:outline-none focus:border-accent transition-all"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Auth Domain</label>
                       <input 
                         type="text" 
                         value={infraData.fb_auth_domain || ''}
                         onChange={e => setInfraData({...infraData, fb_auth_domain: e.target.value})}
                         className="w-full p-3 bg-background border border-app-border rounded-xl text-foreground font-mono text-xs focus:outline-none focus:border-accent transition-all"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">App ID</label>
                       <input 
                         type="text" 
                         value={infraData.fb_app_id || ''}
                         onChange={e => setInfraData({...infraData, fb_app_id: e.target.value})}
                         className="w-full p-3 bg-background border border-app-border rounded-xl text-foreground font-mono text-xs focus:outline-none focus:border-accent transition-all"
                       />
                    </div>
                 </div>

                 <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl">
                    <p className="text-[9px] font-black text-rose-500 uppercase flex items-center gap-2 mb-1">
                       <ShieldAlert size={12} /> Zona Berbahaya
                    </p>
                    <p className="text-[10px] text-app-text-muted leading-relaxed font-bold">Mengubah kredensial Firebase akan memaksa aplikasi untuk inisialisasi ulang. Pastikan data di proyek baru sudah siap.</p>
                 </div>

                 <button 
                   type="submit" 
                   disabled={isSaving}
                   className="w-full py-5 bg-accent hover:bg-accent-hover text-foreground rounded-2xl font-black shadow-xl shadow-accent/20 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs active:scale-95"
                 >
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                    TERAPKAN INFRASTRUKTUR BARU
                 </button>

                 <button 
                   type="button"
                   onClick={handleResetInfra}
                   className="w-full py-4 bg-app-border/20 text-app-text-muted hover:text-rose-500 rounded-2xl font-bold transition-all text-[10px] uppercase tracking-widest border border-dashed border-app-border"
                 >
                    RESET KE DEFAULT (.ENV)
                 </button>
              </div>
           </form>

           {/* DATABASE PROJECTS INVENTORY */}
           <div className="mt-16 space-y-8 animate-in slide-in-from-bottom-5 duration-700">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
                 <div className="space-y-2">
                    <h3 className="text-2xl font-black text-foreground flex items-center gap-3">
                       <Database className="text-accent" /> Inventory Database
                    </h3>
                    <p className="text-xs text-app-text-muted font-medium italic">Daftar project Firebase eksternal yang tersedia untuk migrasi tenant.</p>
                 </div>
                 <button 
                   onClick={() => {
                     setEditingProject(null);
                     setInfraData({
                       cloudinary_cloud_name: '', cloudinary_upload_preset: '',
                       fb_api_key: '', fb_auth_domain: '', fb_project_id: '',
                       fb_storage_bucket: '', fb_messaging_sender_id: '', fb_app_id: ''
                     });
                     setIsAddingProject(true);
                   }}
                   className="flex items-center justify-center gap-2 px-6 py-4 bg-accent text-foreground rounded-2xl font-black text-xs hover:bg-accent-hover transition-all shadow-xl shadow-accent/20 active:scale-95 whitespace-nowrap"
                 >
                    <Plus size={20} /> TAMBAH DATABASE PROYEK
                 </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {dbProjects.map((proj) => (
                   <div key={proj.id} className="bg-surface border border-app-border rounded-[2.5rem] p-8 shadow-xl hover:border-accent transition-all group relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                      
                      <div className="relative z-10 flex flex-col h-full">
                         <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-background border border-app-border flex items-center justify-center text-accent shadow-inner">
                               <Globe size={24} />
                            </div>
                            <div className="overflow-hidden">
                               <h4 className="text-base font-black text-foreground uppercase tracking-tight truncate">{proj.fb_project_id}</h4>
                               <p className="text-[10px] text-app-text-muted font-bold truncate opacity-60">{proj.fb_auth_domain}</p>
                            </div>
                         </div>

                         <div className="space-y-3 mb-8 flex-grow">
                            <div className="flex items-center justify-between p-3 bg-background/50 rounded-xl border border-app-border/30">
                               <span className="text-[9px] font-black text-app-text-muted uppercase">Status</span>
                               <span className="flex items-center gap-1.5 text-emerald-500 text-[9px] font-black uppercase">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> TERHUBUNG
                               </span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-background/50 rounded-xl border border-app-border/30">
                               <span className="text-[9px] font-black text-app-text-muted uppercase">Tenant</span>
                               <span className="text-[9px] font-black text-foreground">
                                  {users.filter(u => u.targetProjectId === proj.fb_project_id).length} USER
                               </span>
                            </div>
                         </div>

                         <div className="flex items-center gap-3 mt-auto">
                            <button 
                              onClick={() => {
                                setEditingProject(proj);
                                setInfraData(proj);
                                setIsAddingProject(true);
                              }}
                              className="flex-1 flex items-center justify-center gap-2 py-3 bg-background border border-app-border text-app-text-muted hover:text-accent hover:border-accent rounded-xl text-[10px] font-black transition-all"
                            >
                               <Edit2 size={14} /> EDIT
                            </button>
                            <button 
                              onClick={() => handleDeleteProject(proj.id)}
                              className="px-4 py-3 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all"
                            >
                               <Trash2 size={16} />
                            </button>
                         </div>
                      </div>
                   </div>
                 ))}

                 {dbProjects.length === 0 && (
                   <div className="col-span-full py-20 bg-background/30 border-2 border-dashed border-app-border rounded-[3rem] flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-surface border border-app-border rounded-full flex items-center justify-center text-app-text-muted mb-4">
                         <Database size={24} />
                      </div>
                      <p className="text-sm font-black text-foreground uppercase tracking-widest opacity-40">Belum ada database tambahan</p>
                      <p className="text-[10px] text-app-text-muted mt-2">Daftarkan project Firebase baru untuk membagi beban storage.</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      ) : activeTab === 'subscriptions' ? (
        <div className="animate-in fade-in zoom-in-95 duration-500 space-y-8">
           {/* PENGATURAN METODE PEMBAYARAN */}
           <div className="bg-surface border border-app-border rounded-[2rem] p-6 shadow-xl mb-8">
              <h3 className="text-lg font-black text-foreground flex items-center gap-2 mb-4">
                 <Wallet className="text-emerald-500" /> Metode Pembayaran Langganan (Global)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* QRIS */}
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Gambar QRIS</label>
                    <div className="relative group cursor-pointer border-2 border-dashed border-app-border hover:border-emerald-500/50 rounded-2xl h-40 flex items-center justify-center overflow-hidden transition-colors bg-background/50">
                       {brandingData.subscriptionQrisUrl ? (
                         <img src={brandingData.subscriptionQrisUrl} alt="QRIS" className="w-full h-full object-contain p-2" />
                       ) : (
                         <div className="text-center">
                            <Upload className="mx-auto text-app-text-muted mb-2" size={20} />
                            <span className="text-[10px] font-bold text-app-text-muted">Upload QRIS</span>
                         </div>
                       )}
                       <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                          <span className="text-white text-xs font-bold uppercase tracking-widest">Ganti QRIS</span>
                       </div>
                       <input type="file" accept="image/*" onChange={handleUploadQris} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                 </div>

                 {/* TRANSFER BANK */}
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Info Transfer Bank (Teks)</label>
                    <textarea 
                      value={brandingData.subscriptionBankInfo || ''}
                      onChange={e => setBrandingData({...brandingData, subscriptionBankInfo: e.target.value})}
                      placeholder="BCA: 123456789 a/n IKASIR PRO"
                      className="w-full h-40 p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent transition-all resize-none text-sm"
                    />
                 </div>

                 {/* E-WALLET */}
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Info E-Wallet (Teks)</label>
                    <textarea 
                      value={brandingData.subscriptionEwalletInfo || ''}
                      onChange={e => setBrandingData({...brandingData, subscriptionEwalletInfo: e.target.value})}
                      placeholder="DANA: 08123456789 a/n IKASIR PRO"
                      className="w-full h-40 p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent transition-all resize-none text-sm"
                    />
                 </div>
              </div>
              
               {/* PENGATURAN HARGA & DISKON PAKET */}
               <div className="mt-8 border-t border-app-border/40 pt-8">
                  <h4 className="text-sm font-black text-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                     <Tag className="text-emerald-500" size={16} /> Pengaturan Harga & Diskon Paket Langganan
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                     {[
                       { id: '1m', name: 'Paket 1 Bulan', priceKey: 'pkg_1m_price', typeKey: 'pkg_1m_discount_type', valKey: 'pkg_1m_discount_val' },
                       { id: '3m', name: 'Paket 3 Bulan', priceKey: 'pkg_3m_price', typeKey: 'pkg_3m_discount_type', valKey: 'pkg_3m_discount_val' },
                       { id: '6m', name: 'Paket 6 Bulan', priceKey: 'pkg_6m_price', typeKey: 'pkg_6m_discount_type', valKey: 'pkg_6m_discount_val' },
                       { id: '12m', name: 'Paket 12 Bulan', priceKey: 'pkg_12m_price', typeKey: 'pkg_12m_discount_type', valKey: 'pkg_12m_discount_val' },
                     ].map((pkg) => (
                        <div key={pkg.id} className="bg-background/40 p-5 rounded-2xl border border-app-border space-y-4">
                           <p className="text-xs font-black text-foreground uppercase tracking-wide border-b border-app-border pb-2">{pkg.name}</p>
                           
                           {/* Harga Dasar */}
                           <div className="space-y-1">
                              <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Harga Dasar (Rp)</label>
                              <input 
                                type="number" 
                                value={brandingData[pkg.priceKey] ?? 0}
                                onChange={e => setBrandingData({...brandingData, [pkg.priceKey]: Number(e.target.value)})}
                                className="w-full p-2.5 bg-background border border-app-border rounded-xl text-xs text-foreground font-bold focus:outline-none focus:border-accent"
                                placeholder="30000"
                              />
                           </div>

                           {/* Tipe Diskon */}
                           <div className="space-y-1">
                              <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Tipe Potongan/Diskon</label>
                              <select 
                                value={brandingData[pkg.typeKey] || 'none'}
                                onChange={e => setBrandingData({...brandingData, [pkg.typeKey]: e.target.value})}
                                className="w-full p-2.5 bg-background border border-app-border rounded-xl text-xs text-foreground font-bold focus:outline-none focus:border-accent"
                              >
                                 <option value="none">Tanpa Potongan</option>
                                 <option value="percent">Persentase (%)</option>
                                 <option value="nominal">Nominal Manual (Rp)</option>
                              </select>
                           </div>

                           {/* Nilai Diskon */}
                           {brandingData[pkg.typeKey] !== 'none' && (
                              <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-300">
                                 <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">
                                    {brandingData[pkg.typeKey] === 'percent' ? 'Persentase Diskon (%)' : 'Nominal Potongan (Rp)'}
                                 </label>
                                 <input 
                                   type="number" 
                                   value={brandingData[pkg.valKey] ?? 0}
                                   onChange={e => setBrandingData({...brandingData, [pkg.valKey]: Number(e.target.value)})}
                                   className="w-full p-2.5 bg-background border border-app-border rounded-xl text-xs text-foreground font-bold focus:outline-none focus:border-accent"
                                   placeholder="0"
                                 />
                              </div>
                           )}

                           {/* Preview Final Price */}
                           <div className="bg-background/80 px-3 py-2 rounded-xl border border-app-border flex items-center justify-between">
                              <span className="text-[8px] font-black text-app-text-muted uppercase tracking-widest">Harga Final:</span>
                              <span className="text-[11px] font-black text-emerald-500">
                                 Rp {(() => {
                                    const base = Number(brandingData[pkg.priceKey] ?? 0);
                                    const type = brandingData[pkg.typeKey] || 'none';
                                    const val = Number(brandingData[pkg.valKey] ?? 0);
                                    if (type === 'percent') return Math.max(0, base * (1 - val / 100)).toLocaleString('id-ID');
                                    if (type === 'nominal') return Math.max(0, base - val).toLocaleString('id-ID');
                                    return base.toLocaleString('id-ID');
                                 })()}
                              </span>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>

              <div className="mt-6 flex justify-end">
                 <button 
                   onClick={handleUpdateSubscriptionBranding}
                   disabled={isSaving}
                   className="py-3 px-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black shadow-xl shadow-emerald-500/20 transition-all flex items-center gap-2 active:scale-95 text-xs uppercase tracking-widest"
                 >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Simpan Pengaturan
                 </button>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {subscriptionRequests.map(req => (
                 <div key={req.id} className="bg-surface border border-app-border p-6 rounded-[2rem] shadow-xl flex flex-col justify-between">
                    <div>
                       <div className="flex justify-between items-start mb-4">
                          <div>
                             <p className="text-xs font-black text-foreground uppercase tracking-widest">{req.packageTitle}</p>
                             <p className="text-[10px] text-app-text-muted font-bold mt-1">{req.ownerEmail}</p>
                             <p className="text-[9px] text-emerald-500 font-bold">Harga: Rp {req.price?.toLocaleString('id-ID')}</p>
                             <p className="text-[9px] text-app-text-muted font-bold mt-0.5">Metode: <span className="text-foreground uppercase font-black">{req.paymentMethod || 'qris'}</span></p>
                          </div>
                          <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider ${req.status === 'pending' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'}`}>
                             {req.status}
                          </span>
                       </div>
                       <a href={req.proofUrl} target="_blank" rel="noreferrer">
                          <img src={req.proofUrl} alt="Bukti Transfer" className="w-full h-40 object-cover rounded-xl border border-app-border mb-4 cursor-pointer hover:opacity-80 transition-opacity bg-background/50" />
                       </a>
                    </div>
                    {req.status === 'pending' ? (
                       <div className="flex gap-2">
                           <button 
                             onClick={() => handleVerifySubscription(req)} 
                             disabled={isSaving} 
                             className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-colors flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                           >
                              <CheckCircle2 size={16} /> Validasi
                           </button>
                           <button 
                             onClick={() => handleDeleteSubscription(req.id)} 
                             disabled={isSaving} 
                             className="py-3 px-4 bg-rose-500/10 text-rose-500 rounded-xl font-black hover:bg-rose-500 hover:text-white transition-colors flex justify-center items-center active:scale-95 disabled:opacity-50"
                           >
                              <Trash2 size={16} />
                           </button>
                       </div>
                    ) : (
                       <button 
                         onClick={() => handleDeleteSubscription(req.id)} 
                         disabled={isSaving} 
                         className="w-full py-3 bg-rose-500/10 text-rose-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-colors flex justify-center items-center gap-2 active:scale-95 disabled:opacity-50 mt-2"
                       >
                          <Trash2 size={16} /> Hapus Riwayat
                       </button>
                    )}
                 </div>
              ))}
                 {subscriptionRequests.length === 0 && (
                 <div className="col-span-full py-12 text-center border border-dashed border-app-border rounded-[2rem]">
                    <p className="text-app-text-muted text-xs font-bold">Belum ada pengajuan langganan.</p>
                 </div>
              )}
            </div>
         </div>
      ) : activeTab === 'broadcast' ? (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in zoom-in-95 duration-500">
            {/* Form Broadcast */}
            <div className="bg-surface border border-app-border rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl">
               <div className="mb-8">
                  <h3 className="text-2xl font-black text-foreground mb-2 flex items-center gap-3">
                     <Bell className="text-accent" /> Kirim Broadcast Notifikasi
                  </h3>
                  <p className="text-xs text-app-text-muted font-medium">Kirimkan pemberitahuan instan ke semua perangkat pengguna aplikasi mobile.</p>
               </div>
               
               <form onSubmit={handleSendBroadcast} className="space-y-6">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Judul Notifikasi</label>
                     <input 
                       type="text" 
                       value={broadcastTitle}
                       onChange={e => setBroadcastTitle(e.target.value)}
                       className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-black focus:outline-none focus:border-accent transition-all"
                       placeholder="Contoh: Pemeliharaan Sistem / Pengumuman"
                       required
                     />
                  </div>
                  
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Isi Pesan</label>
                     <textarea 
                       value={broadcastMessage}
                       onChange={e => setBroadcastMessage(e.target.value)}
                       className="w-full h-40 p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent transition-all resize-none text-sm"
                       placeholder="Tulis pesan Anda di sini yang akan diterima oleh semua perangkat pengguna..."
                       required
                     />
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Tautan Web / URL Aksi (Opsional)</label>
                     <input 
                       type="text" 
                       value={broadcastLink}
                       onChange={e => setBroadcastLink(e.target.value)}
                       className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent transition-all text-xs"
                       placeholder="Contoh: https://yadiapp.com/promo"
                     />
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">URL Gambar Lampiran (Opsional)</label>
                     <input 
                       type="text" 
                       value={broadcastImageUrl}
                       onChange={e => setBroadcastImageUrl(e.target.value)}
                       className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent transition-all text-xs"
                       placeholder="Contoh: https://images.unsplash.com/photo-..."
                     />
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSendingBroadcast}
                    className="w-full py-5 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black shadow-xl shadow-rose-500/20 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs active:scale-95 mt-4"
                  >
                     {isSendingBroadcast ? <Loader2 size={16} className="animate-spin" /> : <Bell size={20} />}
                     KIRIM BROADCAST NOTIFIKASI
                  </button>
               </form>
            </div>

            {/* Preview Push Notifikasi */}
            <div className="bg-surface/30 border border-app-border rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 flex flex-col justify-center items-center">
               <h4 className="text-sm font-black text-foreground mb-6 uppercase tracking-widest">Preview Push Notifikasi</h4>
               
               {/* Smartphone mockup preview container */}
               <div className="w-[300px] h-[550px] bg-slate-950 border-[8px] border-slate-800 rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col justify-between p-4">
                  {/* Speaker and Camera notch */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-5 bg-slate-800 rounded-full flex items-center justify-center">
                     <div className="w-12 h-1 bg-slate-700 rounded-full mr-2" />
                     <div className="w-2.5 h-2.5 bg-slate-900 rounded-full" />
                  </div>
                  
                  {/* Status Bar */}
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mt-4 px-2 select-none">
                     <span>15:21</span>
                     <div className="flex items-center gap-1">
                        <span>📶</span>
                        <span>🔋</span>
                     </div>
                  </div>
                  
                  {/* Push notification banner */}
                  <div className="flex-1 flex items-start justify-center pt-8">
                     {(broadcastTitle.trim() || broadcastMessage.trim()) ? (
                        <div className="w-full bg-slate-900/95 border border-slate-800/80 p-4 rounded-2xl shadow-xl backdrop-blur-md animate-bounce">
                           <div className="flex items-center gap-2 mb-1">
                              <div className="w-5 h-5 rounded bg-accent flex items-center justify-center text-[8px] font-black text-white">i</div>
                              <span className="text-[10px] font-black text-foreground uppercase tracking-wider">{brandingData.appName}</span>
                              <span className="text-[8px] text-slate-500 font-bold ml-auto">sekarang</span>
                           </div>
                           <h5 className="text-xs font-black text-foreground">{broadcastTitle || 'Judul Notifikasi'}</h5>
                           <p className="text-[10px] text-slate-300 font-bold mt-0.5 leading-relaxed break-words mb-2">{broadcastMessage || 'Isi pesan notifikasi...'}</p>
                           {broadcastImageUrl.trim() && (
                             <div className="w-full h-24 rounded-lg overflow-hidden border border-slate-800 mt-2 bg-slate-950">
                               <img src={broadcastImageUrl.trim()} className="w-full h-full object-cover" alt="Preview" />
                             </div>
                           )}
                           {broadcastLink.trim() && (
                             <div className="flex items-center gap-1.5 mt-2 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1.5 rounded-lg text-blue-400 select-none">
                               <span className="text-[9px] font-bold truncate">Link: {broadcastLink}</span>
                             </div>
                           )}
                        </div>
                     ) : (
                        <p className="text-[10px] text-slate-600 text-center italic mt-12 font-bold uppercase tracking-wider">Silakan isi form di sebelah kiri untuk melihat preview</p>
                     )}
                  </div>
                  
                  {/* Home indicator */}
                  <div className="w-28 h-1 bg-slate-700 rounded-full mx-auto mb-1" />
               </div>
            </div>
         </div>
      ) : null}

      {activeTab === 'feedback' && (
         <div className="bg-surface border border-app-border rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-xl relative overflow-hidden transition-colors duration-300">
            <h2 className="text-xl font-black text-foreground mb-6 flex items-center gap-3 uppercase tracking-wider">
               <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                  <MessageSquare className="text-accent" />
               </div>
               Kritik & Saran Pengguna
            </h2>
            
            <div className="overflow-x-auto rounded-2xl border border-app-border bg-background/50">
               <table className="w-full border-collapse text-left">
                  <thead>
                     <tr className="border-b border-app-border bg-background">
                        <th className="p-4 text-[10px] font-black text-app-text-muted uppercase tracking-widest">Waktu</th>
                        <th className="p-4 text-[10px] font-black text-app-text-muted uppercase tracking-widest">Platform</th>
                        <th className="p-4 text-[10px] font-black text-app-text-muted uppercase tracking-widest">Toko / Merchant</th>
                        <th className="p-4 text-[10px] font-black text-app-text-muted uppercase tracking-widest">Email Pengirim</th>
                        <th className="p-4 text-[10px] font-black text-app-text-muted uppercase tracking-widest">Isi Kritik & Saran</th>
                        <th className="p-4 text-[10px] font-black text-app-text-muted uppercase tracking-widest text-center">Aksi</th>
                     </tr>
                  </thead>
                  <tbody>
                     {feedbacks.length === 0 ? (
                        <tr>
                           <td colSpan={6} className="p-8 text-center text-xs text-app-text-muted font-bold italic">
                              Belum ada kritik dan saran yang masuk.
                           </td>
                        </tr>
                     ) : (
                        feedbacks.map((fb) => (
                           <tr key={fb.id} className="border-b border-app-border/40 hover:bg-surface/10 transition-colors">
                              <td className="p-4 text-xs font-black text-foreground">
                                 {fb.createdAt ? (fb.createdAt.toDate ? fb.createdAt.toDate().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : new Date(fb.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })) : '-'}
                              </td>
                              <td className="p-4 text-xs font-bold">
                                 <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${fb.platform === 'mobile' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                                    {fb.platform || 'web'}
                                 </span>
                              </td>
                              <td className="p-4 text-xs font-bold text-foreground">
                                 <div className="text-[10px] text-accent font-black uppercase tracking-wider">{fb.storeId || 'GLOBAL'}</div>
                              </td>
                              <td className="p-4 text-xs font-bold text-foreground">{fb.userEmail || '-'}</td>
                              <td className="p-4 text-xs font-medium text-foreground whitespace-pre-wrap max-w-md">{fb.content}</td>
                              <td className="p-4 text-xs font-bold text-center">
                                 <button 
                                    onClick={() => handleDeleteFeedback(fb.id)}
                                    className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 transition-all active:scale-95"
                                 >
                                    <Trash2 size={14} />
                                 </button>
                              </td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      )}

      {/* EDIT MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-xl p-0 md:p-4">
           <div className="bg-surface border-t md:border border-app-border rounded-t-[2rem] md:rounded-[3rem] w-full max-w-lg overflow-y-auto max-h-[90vh] md:max-h-none shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
              <div className="p-6 md:p-8 border-b border-app-border flex items-center justify-between sticky top-0 bg-surface/80 backdrop-blur-md z-10">
                 <h2 className="text-lg md:text-xl font-black text-foreground flex items-center gap-3">
                    <UserCog className="text-accent" /> <span className="truncate max-w-[150px] md:max-w-none">Edit {editingUser.email}</span>
                 </h2>
                 <button onClick={() => setEditingUser(null)} className="text-app-text-muted hover:text-rose-500 transition-colors">
                    <XCircle size={28} />
                 </button>
              </div>

              <form onSubmit={handleUpdateUser} className="p-6 md:p-10 space-y-6 pb-12 md:pb-10">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Nama Tampilan</label>
                    <input 
                      type="text" 
                      value={editingUser.name || ''} 
                      onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                      className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent transition-all"
                    />
                 </div>

                 <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Role Akun</label>
                        <select 
                          value={editingUser.role || 'cashier'}
                          onChange={e => setEditingUser({...editingUser, role: e.target.value})}
                          className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none appearance-none cursor-pointer"
                        >
                           <option value="cashier">CASHIER</option>
                           <option value="admin">ADMIN</option>
                           <option value="super-admin">SUPER-ADMIN</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Tanggal Daftar</label>
                       <input 
                         type="date" 
                         value={editingUser.createdAt ? (editingUser.createdAt.includes('T') ? editingUser.createdAt.substring(0, 10) : editingUser.createdAt) : ''} 
                         onChange={e => setEditingUser({...editingUser, createdAt: e.target.value ? new Date(e.target.value).toISOString() : ''})}
                         className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none transition-all cursor-pointer"
                       />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Tanggal Expired</label>
                        <input 
                          type="date" 
                          value={editingUser.validUntil ? (editingUser.validUntil.includes('T') ? editingUser.validUntil.substring(0, 10) : editingUser.validUntil) : ''} 
                          onChange={e => setEditingUser({...editingUser, validUntil: e.target.value})}
                          className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none transition-all cursor-pointer"
                        />
                    </div>
                 </div>

                 <div className="space-y-2">
                     <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">ID Toko (Store ID)</label>
                     <div className="relative">
                        <select 
                          value={editingUser.storeId || ''}
                          onChange={e => setEditingUser({...editingUser, storeId: e.target.value})}
                          className="w-full p-4 pl-12 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none appearance-none cursor-pointer"
                        >
                           <option value="">-- Pilih Toko --</option>
                           {stores.map(s => (
                              <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                           ))}
                        </select>
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
                     </div>
                  </div>

                 <div className="flex gap-4">
                    <button 
                      type="button"
                      onClick={() => setEditingUser({...editingUser, isActive: !editingUser.isActive})}
                      className={`flex-1 p-4 rounded-2xl flex items-center justify-center gap-2 font-black text-xs transition-all ${
                        editingUser.isActive !== false 
                        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' 
                        : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      }`}
                    >
                       <Power size={14} />
                       {editingUser.isActive !== false ? 'BEKUKAN AKSES' : 'AKTIFKAN AKSES'}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setEditingUser({...editingUser, isSubscribed: !editingUser.isSubscribed})}
                      className={`flex-1 p-4 rounded-2xl flex items-center justify-center gap-2 font-black text-xs transition-all ${
                        editingUser.isSubscribed 
                        ? 'bg-app-text-muted/10 text-app-text-muted border border-app-border' 
                        : 'bg-accent/10 text-accent border border-accent/20'
                      }`}
                    >
                       <ShieldCheck size={14} />
                       {editingUser.isSubscribed ? 'BATAL LANGGANAN' : 'SET LANGGANAN'}
                    </button>
                 </div>

                 <div className="pt-6 border-t border-app-border mt-4">
                    <button 
                      type="submit" 
                      disabled={isSaving}
                      className="w-full py-5 bg-accent hover:bg-accent-hover text-foreground rounded-2xl font-black shadow-xl shadow-accent/20 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs active:scale-95"
                    >
                       {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                       {isSaving ? 'Menyimpan...' : 'Simpan Perubahan Global'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* ADD USER MODAL */}
      {isAddingUser && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-xl p-0 md:p-4">
           <div className="bg-surface border-t md:border border-app-border rounded-t-[2rem] md:rounded-[3rem] w-full max-w-lg overflow-y-auto max-h-[90vh] md:max-h-none shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
              <div className="p-6 md:p-8 border-b border-app-border flex items-center justify-between sticky top-0 bg-surface/80 backdrop-blur-md z-10">
                 <h2 className="text-lg md:text-xl font-black text-foreground flex items-center gap-3">
                    <UserPlus className="text-accent" /> Buat Akun Pengguna
                 </h2>
                 <button onClick={() => setIsAddingUser(false)} className="text-app-text-muted hover:text-rose-500 transition-colors">
                    <X size={28} />
                 </button>
              </div>

              <form onSubmit={handleCreateUser} className="p-6 md:p-10 space-y-6 pb-12 md:pb-10">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Nama Lengkap</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Contoh: Budi Santoso"
                      value={newUserData.name} 
                      onChange={e => setNewUserData({...newUserData, name: e.target.value})}
                      className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent transition-all"
                    />
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Alamat Email</label>
                    <input 
                      type="email" 
                      required
                      placeholder="budi@domain.com"
                      value={newUserData.email} 
                      onChange={e => setNewUserData({...newUserData, email: e.target.value})}
                      className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent transition-all"
                    />
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Password</label>
                    <input 
                      type="password" 
                      required
                      minLength={6}
                      placeholder="Minimal 6 karakter"
                      value={newUserData.password} 
                      onChange={e => setNewUserData({...newUserData, password: e.target.value})}
                      className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent transition-all"
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Role Akun</label>
                        <select 
                          value={newUserData.role}
                          onChange={e => setNewUserData({...newUserData, role: e.target.value})}
                          className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none appearance-none cursor-pointer"
                        >
                           <option value="cashier">CASHIER</option>
                           <option value="admin">ADMIN</option>
                           <option value="super-admin">SUPER-ADMIN</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Pilih Toko (Store)</label>
                        <select 
                          value={newUserData.storeId}
                          onChange={e => setNewUserData({...newUserData, storeId: e.target.value})}
                          className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none appearance-none cursor-pointer"
                        >
                           <option value="">-- Tanpa Toko --</option>
                           <option value="default-store">Toko Utama (default-store)</option>
                           {stores.map(s => (
                              <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                           ))}
                        </select>
                    </div>
                 </div>

                 <button 
                   type="submit" 
                   disabled={isSaving}
                   className="w-full py-5 bg-accent hover:bg-accent-hover text-foreground rounded-2xl font-black shadow-xl shadow-accent/20 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs active:scale-95 mt-4"
                 >
                    {isSaving ? <Loader2 className="animate-spin" /> : <Plus size={20} />}
                    BUAT AKUN BARU
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* ADD STORE MODAL */}
      {isAddingStore && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-xl p-0 md:p-4">
           <div className="bg-surface border-t md:border border-app-border rounded-t-[2rem] md:rounded-[3rem] w-full max-w-lg overflow-y-auto max-h-[90vh] md:max-h-none shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
              <div className="p-6 md:p-8 border-b border-app-border flex items-center justify-between sticky top-0 bg-surface/80 backdrop-blur-md z-10">
                 <h2 className="text-lg md:text-xl font-black text-foreground flex items-center gap-3">
                    <Building2 className="text-accent" /> Tambah Toko Manual
                 </h2>
                 <button onClick={() => setIsAddingStore(false)} className="text-app-text-muted hover:text-rose-500 transition-colors">
                    <XCircle size={28} />
                 </button>
              </div>

              <form onSubmit={handleCreateStore} className="p-6 md:p-10 space-y-6 pb-12 md:pb-10">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Nama Toko</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Contoh: YADI KOMPUTER"
                      value={newStoreData.name} 
                      onChange={e => setNewStoreData({...newStoreData, name: e.target.value.toUpperCase(), id: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                      className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none border-accent/30"
                    />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Store ID (Slug URL)</label>
                        <input 
                          type="text" 
                          required
                          placeholder="contoh-toko-anda"
                          value={newStoreData.id} 
                          onChange={e => setNewStoreData({...newStoreData, id: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                          className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none"
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Kuota User Maks</label>
                        <input 
                          type="number" 
                          required
                          value={newStoreData.maxUsers} 
                          onChange={e => setNewStoreData({...newStoreData, maxUsers: parseInt(e.target.value)})}
                          className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none border-accent/20"
                          min="1"
                        />
                     </div>
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Email Pemilik (Opsional)</label>
                     <div className="relative">
                        <input 
                          type="email" 
                          placeholder="owner@email.com"
                          value={newStoreData.ownerEmail} 
                          onChange={e => setNewStoreData({...newStoreData, ownerEmail: e.target.value})}
                          className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none pl-12"
                        />
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
                     </div>
                  </div>

                 <button 
                   type="submit" 
                   disabled={isSaving}
                   className="w-full py-5 bg-accent hover:bg-accent-hover text-foreground rounded-2xl font-black shadow-xl shadow-accent/20 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs active:scale-95 mt-4"
                 >
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                    SIMPAN TOKO BARU
                 </button>
              </form>
           </div>
        </div>
      )}
      {/* ADD/EDIT PROJECT MODAL */}
      {isAddingProject && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-xl p-0 md:p-4">
            <div className="bg-surface border-t md:border border-app-border rounded-t-[2rem] md:rounded-[3rem] w-full max-w-2xl overflow-y-auto max-h-[95vh] shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
               <div className="p-6 md:p-8 border-b border-app-border flex items-center justify-between sticky top-0 bg-surface/80 backdrop-blur-md z-10">
                  <h2 className="text-lg md:text-xl font-black text-foreground flex items-center gap-3">
                     <Database className="text-accent" /> {editingProject ? 'Edit Proyek Database' : 'Daftarkan Proyek Database'}
                  </h2>
                  <button onClick={() => setIsAddingProject(false)} className="text-app-text-muted hover:text-rose-500 transition-colors">
                     <XCircle size={28} />
                  </button>
               </div>

               <form onSubmit={handleSaveProject} className="p-6 md:p-10 space-y-8 pb-12 md:pb-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                           <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                              <Sparkles size={16} />
                           </div>
                           <h4 className="text-[10px] font-black text-foreground uppercase tracking-[0.2em]">Cloudinary Config</h4>
                        </div>
                        <div className="space-y-4">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Cloud Name</label>
                              <input 
                                type="text" 
                                required
                                value={infraData.cloudinary_cloud_name || ''} 
                                onChange={e => setInfraData({...infraData, cloudinary_cloud_name: e.target.value})}
                                className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none"
                              />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Upload Preset</label>
                              <input 
                                type="text" 
                                required
                                value={infraData.cloudinary_upload_preset || ''} 
                                onChange={e => setInfraData({...infraData, cloudinary_upload_preset: e.target.value})}
                                className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none"
                              />
                           </div>
                        </div>
                     </div>

                     <div className="space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                           <div className="p-2 bg-amber-500/20 rounded-lg text-amber-500">
                              <Database size={16} />
                           </div>
                           <h4 className="text-[10px] font-black text-foreground uppercase tracking-[0.2em]">Firebase Config</h4>
                        </div>
                        <div className="space-y-4">
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Project ID</label>
                                 <input 
                                   type="text" 
                                   required
                                   value={infraData.fb_project_id || ''} 
                                   onChange={e => setInfraData({...infraData, fb_project_id: e.target.value})}
                                   className="w-full p-3 bg-background border border-app-border rounded-xl text-foreground font-bold focus:outline-none text-xs"
                                 />
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">API Key</label>
                                 <input 
                                   type="text" 
                                   required
                                   value={infraData.fb_api_key || ''} 
                                   onChange={e => setInfraData({...infraData, fb_api_key: e.target.value})}
                                   className="w-full p-3 bg-background border border-app-border rounded-xl text-foreground font-bold focus:outline-none text-xs"
                                 />
                              </div>
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Auth Domain</label>
                              <input 
                                type="text" 
                                required
                                value={infraData.fb_auth_domain || ''} 
                                onChange={e => setInfraData({...infraData, fb_auth_domain: e.target.value})}
                                className="w-full p-3 bg-background border border-app-border rounded-xl text-foreground font-bold focus:outline-none text-xs"
                              />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Storage Bucket</label>
                                 <input 
                                   type="text" 
                                   value={infraData.fb_storage_bucket || ''} 
                                   onChange={e => setInfraData({...infraData, fb_storage_bucket: e.target.value})}
                                   className="w-full p-3 bg-background border border-app-border rounded-xl text-foreground font-bold focus:outline-none text-[10px]"
                                 />
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">App ID</label>
                                 <input 
                                   type="text" 
                                   required
                                   value={infraData.fb_app_id || ''} 
                                   onChange={e => setInfraData({...infraData, fb_app_id: e.target.value})}
                                   className="w-full p-3 bg-background border border-app-border rounded-xl text-foreground font-bold focus:outline-none text-[10px]"
                                 />
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="pt-6 border-t border-app-border flex items-center justify-end gap-4">
                     <button 
                       type="button" 
                       onClick={() => setIsAddingProject(false)}
                       className="px-6 py-4 text-app-text-muted font-black text-xs uppercase tracking-widest hover:text-foreground transition-colors"
                     >
                        Batal
                     </button>
                     <button 
                       type="submit" 
                       disabled={isSaving}
                       className="px-10 py-4 bg-accent hover:bg-accent-hover text-foreground rounded-2xl font-black shadow-xl shadow-accent/20 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs active:scale-95"
                     >
                        {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                        SIMPAN PROJECT
                     </button>
                  </div>
               </form>
            </div>
        </div>
      )}

      {/* USER MIGRATION MODAL */}
      {migratingUser && (
        <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-xl p-0 md:p-4">
            <div className="bg-surface border-t md:border border-app-border rounded-t-[2rem] md:rounded-[3rem] w-full max-w-lg overflow-y-auto max-h-[90vh] shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
               <div className="p-6 md:p-8 border-b border-app-border flex items-center justify-between sticky top-0 bg-surface/80 backdrop-blur-md z-10">
                  <h2 className="text-lg md:text-xl font-black text-foreground flex items-center gap-3">
                     <ArrowRight className="text-amber-500" /> Migrasi User
                  </h2>
                  <button onClick={() => setMigratingUser(null)} className="text-app-text-muted hover:text-rose-500 transition-colors">
                     <XCircle size={28} />
                  </button>
               </div>

               <div className="p-6 md:p-10 space-y-6">
                  <div className="p-4 bg-background border border-app-border rounded-2xl flex items-center gap-4">
                     <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-foreground font-black uppercase shadow-lg shadow-accent/20">
                        {migratingUser.email?.[0].toUpperCase()}
                     </div>
                     <div>
                        <p className="font-black text-foreground">{migratingUser.name || 'User'}</p>
                        <p className="text-xs text-app-text-muted italic">{migratingUser.email}</p>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Pilih Mode Migrasi</label>
                     <div className="grid grid-cols-2 gap-3 mb-6">
                        <button 
                           onClick={() => setMigrationMode('standard')}
                           className={`p-4 border rounded-2xl flex flex-col items-center justify-center gap-2 transition-all ${migrationMode === 'standard' ? 'bg-accent/10 border-accent text-accent' : 'bg-background border-app-border text-app-text-muted hover:border-app-text-muted/50'}`}
                        >
                           <span className="text-sm font-black uppercase tracking-widest">Standar</span>
                           <span className="text-[9px] text-center opacity-80 leading-relaxed">Hanya identitas & pengaturan toko. Sangat Cepat.</span>
                        </button>
                        <button 
                           onClick={() => setMigrationMode('mass')}
                           className={`p-4 border rounded-2xl flex flex-col items-center justify-center gap-2 transition-all ${migrationMode === 'mass' ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-background border-app-border text-app-text-muted hover:border-app-text-muted/50'}`}
                        >
                           <span className="text-sm font-black uppercase tracking-widest">Massal</span>
                           <span className="text-[9px] text-center opacity-80 leading-relaxed">Produk, Transaksi, Diskon, dsb. Lebih Lambat.</span>
                        </button>
                     </div>

                     <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Pilih Database Tujuan</label>
                     <div className="grid grid-cols-1 gap-3 max-h-[40vh] overflow-y-auto pr-2 no-scrollbar">
                        {/* Option: Primary Database */}
                        <button 
                          onClick={() => handleMigrateUser(migratingUser, null)}
                          disabled={isSaving || !migratingUser.targetProjectId}
                          className={`w-full p-4 bg-emerald-500/5 hover:bg-emerald-500/10 border ${!migratingUser.targetProjectId ? 'border-emerald-500/50 opacity-50 cursor-not-allowed' : 'border-emerald-500/20 hover:border-emerald-500/40'} rounded-2xl flex items-center justify-between group transition-all`}
                        >
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-emerald-500 border border-emerald-500/20 transition-colors">
                                 <Server size={16} />
                              </div>
                              <div className="text-left">
                                 <p className="text-sm font-black text-foreground uppercase tracking-tight">Database Utama (Internal)</p>
                                 <p className="text-[9px] font-bold text-app-text-muted italic lowercase opacity-60">Server App Utama (Default)</p>
                              </div>
                           </div>
                           {!migratingUser.targetProjectId ? (
                              <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest px-2 py-1 bg-emerald-500/10 rounded-md">AKTIF</span>
                           ) : (
                              <ArrowRight className="text-emerald-500 transform group-hover:translate-x-1 transition-all" size={18} />
                           )}
                        </button>

                        <div className="relative py-2 flex items-center">
                           <div className="flex-grow border-t border-app-border"></div>
                           <span className="flex-shrink mx-4 text-[8px] font-black text-app-text-muted uppercase tracking-widest">Database Eksternal</span>
                           <div className="flex-grow border-t border-app-border"></div>
                        </div>

                        {dbProjects.map((proj) => (
                           <button 
                             key={proj.id}
                             onClick={() => handleMigrateUser(migratingUser, proj)}
                             disabled={isSaving || migratingUser.targetProjectId === proj.fb_project_id}
                             className={`w-full p-4 bg-background hover:bg-accent/5 border ${migratingUser.targetProjectId === proj.fb_project_id ? 'border-accent/50 opacity-50 cursor-not-allowed' : 'border-app-border hover:border-accent'} rounded-2xl flex items-center justify-between group transition-all`}
                           >
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-app-text-muted group-hover:text-accent border border-app-border transition-colors">
                                    <Database size={16} />
                                 </div>
                                 <div className="text-left">
                                    <p className="text-sm font-black text-foreground uppercase tracking-tight">{proj.fb_project_id}</p>
                                    <p className="text-[9px] font-bold text-app-text-muted italic lowercase opacity-60 truncate max-w-[150px]">{proj.fb_auth_domain}</p>
                                 </div>
                              </div>
                              {migratingUser.targetProjectId === proj.fb_project_id ? (
                                 <span className="text-[8px] font-black text-accent uppercase tracking-widest px-2 py-1 bg-accent/10 rounded-md">AKTIF</span>
                              ) : (
                                 <ArrowRight className="text-app-text-muted group-hover:text-accent transform group-hover:translate-x-1 transition-all" size={18} />
                              )}
                           </button>
                        ))}
                        {dbProjects.length === 0 && (
                           <div className="text-center py-8 space-y-2">
                              <p className="text-xs font-bold text-app-text-muted italic">Belum ada project database eksternal terdaftar.</p>
                              <p className="text-[10px] text-app-text-muted opacity-50">Daftarkan project di tab Infrastruktur terlebih dahulu.</p>
                           </div>
                        )}
                     </div>
                  </div>

                  <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                     <p className="text-[10px] text-amber-600 font-bold leading-relaxed">
                        ⚠️ Seluruh data User, Toko, dan Pengaturan akan <strong>disalin</strong> ke project target. Autentikasi tetap terpusat, namun data akan disimpan pada project database yang dipilih.
                     </p>
                  </div>
               </div>
            </div>
        </div>
      )}

      {/* STORE MIGRATION MODAL */}
      {migratingStoreData && (
        <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-xl p-0 md:p-4">
            <div className="bg-surface border-t md:border border-app-border rounded-t-[2rem] md:rounded-[3rem] w-full max-w-lg overflow-y-auto max-h-[90vh] shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
               <div className="p-6 md:p-8 border-b border-app-border flex items-center justify-between sticky top-0 bg-surface/80 backdrop-blur-md z-10">
                  <h2 className="text-lg md:text-xl font-black text-foreground flex items-center gap-3">
                     <Database className="text-accent" /> Migrasi Database Toko
                  </h2>
                  <button onClick={() => setMigratingStoreData(null)} className="text-app-text-muted hover:text-rose-500 transition-colors">
                     <XCircle size={28} />
                  </button>
               </div>

               <div className="p-6 md:p-10 space-y-6">
                  <div className="p-4 bg-background border border-app-border rounded-2xl flex items-center gap-4">
                     <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-foreground font-black shadow-lg shadow-accent/20">
                        <Building2 size={24} />
                     </div>
                     <div>
                        <p className="font-black text-foreground">{migratingStoreData.name}</p>
                        <p className="text-xs text-app-text-muted italic">Owner: {migratingStoreData.ownerEmail}</p>
                        <p className="text-[9px] font-mono text-app-text-muted opacity-60">ID: {migratingStoreData.id}</p>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Pilih Database Tujuan</label>
                     <div className="grid grid-cols-1 gap-3 max-h-[40vh] overflow-y-auto pr-2 no-scrollbar">
                        {(() => {
                          const assocUsers = users.filter(u => u.storeId === migratingStoreData.id);
                          const userWithInfra = assocUsers.find(u => u.infraConfig && u.infraConfig.fb_project_id);
                          const currentProjectId = userWithInfra ? userWithInfra.targetProjectId : null;

                          return (
                            <>
                              <button 
                                onClick={() => handleMigrateStore(migratingStoreData, null)}
                                disabled={isSaving || !currentProjectId}
                                className={`w-full p-4 bg-emerald-500/5 hover:bg-emerald-500/10 border ${!currentProjectId ? 'border-emerald-500/50 opacity-50 cursor-not-allowed' : 'border-emerald-500/20 hover:border-emerald-500/40'} rounded-2xl flex items-center justify-between group transition-all`}
                              >
                                 <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-emerald-500 border border-emerald-500/20 transition-colors">
                                       <Server size={16} />
                                    </div>
                                    <div className="text-left">
                                       <p className="text-sm font-black text-foreground uppercase tracking-tight">Database Utama (Internal)</p>
                                       <p className="text-[9px] font-bold text-app-text-muted italic lowercase opacity-60">Server App Utama (Default)</p>
                                    </div>
                                 </div>
                                 {!currentProjectId ? (
                                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest px-2 py-1 bg-emerald-500/10 rounded-md">AKTIF</span>
                                 ) : (
                                    <ArrowRight className="text-emerald-500 transform group-hover:translate-x-1 transition-all" size={18} />
                                 )}
                              </button>

                              <div className="relative py-2 flex items-center">
                                 <div className="flex-grow border-t border-app-border"></div>
                                 <span className="flex-shrink mx-4 text-[8px] font-black text-app-text-muted uppercase tracking-widest">Database Eksternal</span>
                                 <div className="flex-grow border-t border-app-border"></div>
                              </div>

                              {dbProjects.map((proj) => (
                                 <button 
                                   key={proj.id}
                                   onClick={() => handleMigrateStore(migratingStoreData, proj)}
                                   disabled={isSaving || currentProjectId === proj.fb_project_id}
                                   className={`w-full p-4 bg-background hover:bg-accent/5 border ${currentProjectId === proj.fb_project_id ? 'border-accent/50 opacity-50 cursor-not-allowed' : 'border-app-border hover:border-accent'} rounded-2xl flex items-center justify-between group transition-all`}
                                 >
                                    <div className="flex items-center gap-3">
                                       <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-app-text-muted group-hover:text-accent border border-app-border transition-colors">
                                          <Database size={16} />
                                       </div>
                                       <div className="text-left">
                                          <p className="text-sm font-black text-foreground uppercase tracking-tight">{proj.fb_project_id}</p>
                                          <p className="text-[9px] font-bold text-app-text-muted italic lowercase opacity-60 truncate max-w-[150px]">{proj.fb_auth_domain}</p>
                                       </div>
                                    </div>
                                    {currentProjectId === proj.fb_project_id ? (
                                       <span className="text-[8px] font-black text-accent uppercase tracking-widest px-2 py-1 bg-accent/10 rounded-md">AKTIF</span>
                                    ) : (
                                       <ArrowRight className="text-app-text-muted group-hover:text-accent transform group-hover:translate-x-1 transition-all" size={18} />
                                    )}
                                 </button>
                              ))}
                            </>
                          );
                        })()}
                        {dbProjects.length === 0 && (
                           <div className="text-center py-8 space-y-2">
                              <p className="text-xs font-bold text-app-text-muted italic">Belum ada project database eksternal terdaftar.</p>
                              <p className="text-[10px] text-app-text-muted opacity-50">Daftarkan project di tab Infrastruktur terlebih dahulu.</p>
                           </div>
                        )}
                     </div>
                  </div>

                  <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                     <p className="text-[10px] text-amber-600 font-bold leading-relaxed">
                        ⚠️ Seluruh data toko (produk, transaksi, dll.) dan seluruh penggunanya akan langsung disalin ke infrastruktur baru. Pengguna akan diarahkan otomatis saat login berikutnya.
                     </p>
                  </div>
               </div>
            </div>
        </div>
      )}

      {/* EDIT STORE MODAL */}
      {editingStore && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-xl p-0 md:p-4">
           <div className="bg-surface border-t md:border border-app-border rounded-t-[2rem] md:rounded-[3rem] w-full max-w-lg overflow-y-auto max-h-[90vh] md:max-h-none shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
              <div className="p-6 md:p-8 border-b border-app-border flex items-center justify-between sticky top-0 bg-surface/80 backdrop-blur-md z-10">
                 <h2 className="text-lg md:text-xl font-black text-foreground flex items-center gap-3">
                    <Building2 className="text-accent" /> Edit Detail Toko
                 </h2>
                 <button onClick={() => setEditingStore(null)} className="text-app-text-muted hover:text-rose-500 transition-colors">
                    <XCircle size={28} />
                 </button>
              </div>

              <form onSubmit={handleUpdateStoreDetails} className="p-6 md:p-10 space-y-6 pb-12 md:pb-10">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Nama Toko</label>
                    <input 
                      type="text" 
                      required
                      value={editingStore.name} 
                      onChange={e => setEditingStore({...editingStore, name: e.target.value.toUpperCase()})}
                      className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none border-accent/30"
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Store ID (Locked)</label>
                       <input 
                         type="text" 
                         disabled
                         value={editingStore.id} 
                         className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold opacity-50 italic"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Kuota User Maks</label>
                       <input 
                         type="number" 
                         required
                         value={editingStore.maxUsers || 5} 
                         onChange={e => setEditingStore({...editingStore, maxUsers: parseInt(e.target.value) || 1})}
                         className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none border-accent/20"
                         min="1"
                       />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Email Pemilik</label>
                    <div className="relative">
                      <input 
                        type="email" 
                        value={editingStore.ownerEmail || ''} 
                        onChange={e => setEditingStore({...editingStore, ownerEmail: e.target.value})}
                        className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none pl-12"
                      />
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
                    </div>
                 </div>

                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">
                      Menu yang Dinonaktifkan
                    </label>
                    <div className="grid grid-cols-2 gap-3 p-4 bg-background border border-app-border rounded-2xl max-h-48 overflow-y-auto">
                      {[
                        { key: '/pos', name: 'Kasir (POS)' },
                        { key: '/orders', name: 'Daftar Pesanan' },
                        { key: '/estimations', name: 'Estimasi Biaya' },
                        { key: '/shifts', name: 'Shift Karyawan' },
                        { key: '/products', name: 'Manajemen Produk' },
                        { key: '/transactions', name: 'Transaksi' },
                        { key: '/debts', name: 'Hutang Piutang' },
                        { key: '/reports', name: 'Laporan' },
                        { key: '/users', name: 'Manajemen User' },
                        { key: '/logs', name: 'Log Aktifitas' },
                      ].map((item) => {
                        const isDisabled = (editingStore.disabledMenus || []).includes(item.key);
                        return (
                          <label key={item.key} className="flex items-center gap-3 cursor-pointer text-xs font-bold text-foreground">
                            <input
                              type="checkbox"
                              checked={isDisabled}
                              onChange={(e) => {
                                const current = editingStore.disabledMenus || [];
                                const next = e.target.checked
                                  ? [...current, item.key]
                                  : current.filter((path: string) => path !== item.key);
                                setEditingStore({ ...editingStore, disabledMenus: next });
                              }}
                              className="w-4 h-4 rounded border-app-border text-accent focus:ring-accent"
                            />
                            {item.name}
                          </label>
                        );
                      })}
                    </div>
                 </div>

                 <button 
                   type="submit" 
                   disabled={isSaving}
                   className="w-full py-5 bg-accent hover:bg-accent-hover text-foreground rounded-2xl font-black shadow-xl shadow-accent/20 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs active:scale-95 mt-4"
                 >
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                    SIMPAN PERUBAHAN TOKO
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
