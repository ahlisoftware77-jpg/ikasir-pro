'use client';

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Loader2, Receipt, Check, Database, Download, UploadCloud, AlertTriangle, Smartphone, ShoppingBag, Trash2, Key, Bell, List, RotateCcw, Printer, History, Plus, Wallet, Landmark } from 'lucide-react';
import { getInfraConfig } from '@/lib/infraConfig';
import { doc, getDoc, setDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { db, auth, primaryDb } from '@/lib/firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { handleExportJSON } from '@/lib/backupUtils';
import { useAuthStore } from '@/store/auth';
import toast from 'react-hot-toast';
import { logActivity } from '@/lib/activity';
import SignaturePad from '@/components/SignaturePad';
import { printReceipt } from '@/lib/printReceipt';
import { useBranding } from '@/context/BrandingContext';
import SubscriptionModal from '@/components/SubscriptionModal';

export default function SettingsPage() {
  const user = useAuthStore(state => state.user);
  const isSubscriptionExpired = useAuthStore(state => state.isSubscriptionExpired);
  const subscriptionUntil = useAuthStore(state => state.subscriptionUntil);
  const storeId = useAuthStore(state => state.storeId);
  const authStoreName = useAuthStore(state => state.storeName);
  const setLogoUrl = useAuthStore(state => state.setLogoUrl);
  const { branding } = useBranding();
  const [isLoading, setIsLoading] = useState(true);
  const [swStatus, setSwStatus] = useState<'Checking' | 'Activated' | 'Not Registered' | 'Error'>('Checking');
  const [isSaving, setIsSaving] = useState(false);
  const [signaturePadData, setSignaturePadData] = useState<string>('');
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [hasPendingSubscription, setHasPendingSubscription] = useState(false);

  useEffect(() => {
    if (storeId) {
      import('firebase/firestore').then(({ collection, query, where, onSnapshot }) => {
        const q = query(collection(primaryDb, 'subscription_requests'), where('storeId', '==', storeId), where('status', '==', 'pending'));
        const unsubscribe = onSnapshot(q, (snap) => {
          setHasPendingSubscription(!snap.empty);
        });
        return unsubscribe;
      });
    }
  }, [storeId]);
  
  const FONT_OPTIONS = [
    { id: 'sans', name: 'Modern (Sans)', family: "'Inter', sans-serif" },
    { id: 'serif', name: 'Classic (Serif)', family: "var(--font-playfair), serif" },
    { id: 'mono', name: 'Retro (Mono)', family: "'Courier New', monospace" },
    { id: 'elegant', name: 'Elegant (Outfit)', family: "var(--font-outfit), sans-serif" },
    { id: 'bold', name: 'Impact (Oswald)', family: "var(--font-oswald), sans-serif" }
  ];

  const getFontFamily = (id: string) => {
    return FONT_OPTIONS.find(f => f.id === id)?.family || FONT_OPTIONS[0].family;
  };

  const [isBackuping, setIsBackuping] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [settings, setSettings] = useState({
    storeName: '',
    address: '',
    phone: '',
    useTax: true,
    taxRate: 11,
    receiptMessage: '',
    paperSize: '58mm',
    waTemplate: '',
    bankInfo: '',
    a4InvoiceNote: '',
    a4EstimationNote: '',
    a4DebtNote: '',
    trxPrefix: 'TRX-',
    trxPadding: 4,
    trxCounter: 0,
    logoUrl: '',
    showLogoOnReceipt: true,
    themeColorHex: '#10b981',
    allowPickup: true,
    allowDelivery: true,
    deliveryFee: 0,
    isOnlineStoreActive: true,
    showReceiptAddress: true,
    showReceiptPhone: true,
    showReceiptCustomer: true,
    showReceiptCashier: true,
    showReceiptSubtotal: true,
    storeNameFont: 'sans',
    estPrefix: 'EST-',
    estPadding: 4,
    estCounter: 0,
    debPrefix: 'DEB-',
    debPadding: 4,
    debCounter: 0,
    ordPrefix: 'ORD-',
    ordPadding: 4,
    ordCounter: 0,
    signatureUrl: '',
    showSignature: true,
    thermalLogoUrl: '',
    qrisUrl: '',
    storeBanks: [] as any[],
    storeEwallets: [] as any[]
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [thermalLogoFile, setThermalLogoFile] = useState<File | null>(null);
  const [thermalLogoPreview, setThermalLogoPreview] = useState<string | null>(null);
  const [qrisFile, setQrisFile] = useState<File | null>(null);
  const [qrisPreview, setQrisPreview] = useState<string | null>(null);
  
  const [passwordState, setPasswordState] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const settingsRef = doc(db, 'settings', `store_${storeId}`);

  useEffect(() => {
    if (!storeId) return;

    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(settingsRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSettings({
            storeName: data.storeName || '',
            address: data.address || '',
            phone: data.phone || '',
            useTax: data.useTax !== false, // defaults to true unless explicitly false
            taxRate: data.taxRate || 0,
            receiptMessage: data.receiptMessage || '',
            paperSize: data.paperSize || '58mm',
            waTemplate: data.waTemplate || '',
            bankInfo: data.bankInfo || '',
            a4InvoiceNote: data.a4InvoiceNote || '',
            a4EstimationNote: data.a4EstimationNote || '',
            a4DebtNote: data.a4DebtNote || '',
            trxPrefix: data.trxPrefix || 'TRX-',
            trxPadding: data.trxPadding || 4,
            trxCounter: data.trxCounter || 0,
            logoUrl: data.logoUrl || '',
            showLogoOnReceipt: data.showLogoOnReceipt !== false,
            themeColorHex: data.themeColorHex || '#10b981',
            allowPickup: data.allowPickup !== false,
            allowDelivery: data.allowDelivery !== false,
            deliveryFee: data.deliveryFee || 0,
            isOnlineStoreActive: data.isOnlineStoreActive !== false,
            showReceiptAddress: data.showReceiptAddress !== false,
            showReceiptPhone: data.showReceiptPhone !== false,
            showReceiptCustomer: data.showReceiptCustomer !== false,
            showReceiptCashier: data.showReceiptCashier !== false,
            showReceiptSubtotal: data.showReceiptSubtotal !== false,
            storeNameFont: data.storeNameFont || 'sans',
            estPrefix: data.estPrefix || 'EST-',
            estPadding: data.estPadding || 4,
            estCounter: data.estCounter || 0,
            debPrefix: data.debPrefix || 'DEB-',
            debPadding: data.debPadding || 4,
            debCounter: data.debCounter || 0,
            ordPrefix: data.ordPrefix || 'ORD-',
            ordPadding: data.ordPadding || 4,
            ordCounter: data.ordCounter || 0,
            signatureUrl: data.signatureUrl || '',
            showSignature: data.showSignature !== false,
            thermalLogoUrl: data.thermalLogoUrl || '',
            qrisUrl: data.qrisUrl || '',
            storeBanks: data.storeBanks || [],
            storeEwallets: data.storeEwallets || []
          });
          setLogoPreview(data.logoUrl || null);
          setLogoUrl(data.logoUrl || null);
          setThermalLogoPreview(data.thermalLogoUrl || null);
          setQrisPreview(data.qrisUrl || null);
        } else {
          // Defaults if none exist
          setSettings({
            storeName: authStoreName || 'Kasir Pro Store',
            address: 'Jl. Teknologi Modern No. 12, Kota Bisnis',
            phone: '0812-3456-7890',
            useTax: true,
            taxRate: 11,
            receiptMessage: 'Terima Kasih!\nBarang yang dibeli tidak dapat ditukar.',
            paperSize: '58mm',
            waTemplate: 'Halo *{customerName}*,\n\nKami dari *{storeName}* ingin menyampaikan rincian tagihan pesanan Anda (Ref: *#{trxId}*)\n\nTotal Tagihan: *{total}*\nTelah Dibayar: {paid}\nSisa Piutang : *{debt}*\nJatuh Tempo  : *{dueDate}*\n\nMohon dapat melakukan pelunasan sisa tagihan sebelum jatuh tempo. Terima kasih!',
            bankInfo: 'BCA 123456789 a.n Kasir Pro',
            trxPrefix: 'TRX-',
            trxPadding: 4,
            trxCounter: 0,
            logoUrl: '',
            showLogoOnReceipt: true,
            themeColorHex: '#10b981',
            allowPickup: true,
            allowDelivery: true,
            deliveryFee: 0,
            isOnlineStoreActive: true,
            showReceiptAddress: true,
            showReceiptPhone: true,
            showReceiptCustomer: true,
            showReceiptCashier: true,
            showReceiptSubtotal: true,
            storeNameFont: 'sans',
            estPrefix: 'EST-',
            estPadding: 4,
            estCounter: 0,
            debPrefix: 'DEB-',
            debPadding: 4,
            debCounter: 0,
            ordPrefix: 'ORD-',
            ordPadding: 4,
            ordCounter: 0,
            signatureUrl: '',
            showSignature: true,
            a4InvoiceNote: '',
            a4EstimationNote: '',
            a4DebtNote: '',
            thermalLogoUrl: '',
            qrisUrl: '',
            storeBanks: [],
            storeEwallets: [],
          });
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      } finally {
        setIsLoading(false);
      }
    };
    

    fetchSettings();
  }, [storeId, authStoreName]);

  const handleTestPrint = async (withLogo: boolean) => {
    const mockTrx: any = {
      id: 'TEST-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      timestamp: { toDate: () => new Date() },
      customerName: 'Pelanggan Simulasi',
      cashierName: user?.displayName || 'Admin Toko',
      items: [
        { productName: 'Item Contoh A (Pcs)', qty: 2, price: 25000, subtotal: 50000 },
        { productName: 'Item Contoh B (Kg)', qty: 1, price: 15000, subtotal: 15000, note: "Pesan khusus" }
      ],
      total: 65000,
      tax: 0,
      paymentMethod: 'TUNAI',
      paymentCategory: 'cash',
      paymentStatus: 'paid',
      cashReceived: 70000,
      change: 5000
    };

    // Temproarily modify settings for the test if forced logo requested
    const testSettings = {
      ...settings,
      showLogoOnReceipt: withLogo,
      thermalLogoUrl: withLogo ? (settings.thermalLogoUrl || thermalLogoPreview || '') : '',
      logoUrl: withLogo ? (settings.logoUrl || logoPreview || '/logo.png') : ''
    };

    try {
      await printReceipt(mockTrx, testSettings, branding);
      toast.success("Perintah cetak dikirim!");
    } catch (err) {
      toast.error("Gagal mencetak struk tes.");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setSettings(prev => ({ ...prev, [name]: checked }));
    } else {
      const isNumericField = ['taxRate', 'trxPadding', 'trxCounter', 'deliveryFee', 'estPadding', 'estCounter', 'debPadding', 'debCounter', 'ordPadding', 'ordCounter'].includes(name);
      setSettings(prev => ({ ...prev, [name]: isNumericField ? Number(value) : value }));
    }
  };

  useEffect(() => {
    // Check Service Worker Status
    const checkSW = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          if (registrations.length > 0) {
            const active = registrations.find(r => r.active || r.waiting || r.installing);
            if (active) {
              setSwStatus('Activated');
            } else {
              setSwStatus('Not Registered');
            }
          } else {
            setSwStatus('Not Registered');
          }
        } catch (e) {
          setSwStatus('Error');
        }
      } else {
        setSwStatus('Error');
      }
    };
    checkSW();
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleThermalLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setThermalLogoFile(file);
      setThermalLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleQrisChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setQrisFile(file);
      setQrisPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let finalSettings = { ...settings };
      
      // Upload Logo to Cloudinary if changed
      if (logoFile) {
        const config = await getInfraConfig();
        const uploadData = new FormData();
        uploadData.append('file', logoFile);
        uploadData.append('upload_preset', config.cloudinary_upload_preset || 'kasirpos');
        uploadData.append('public_id', 'logo_' + storeId);

        const cloudName = config.cloudinary_cloud_name || 'dkcjfwbvc';
        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          body: uploadData
        });

        const uploadResult = await uploadRes.json();
        if (uploadRes.ok && uploadResult.secure_url) {
          finalSettings.logoUrl = uploadResult.secure_url;
          setSettings(prev => ({ ...prev, logoUrl: uploadResult.secure_url }));
          setLogoFile(null);
        } else {
          throw new Error(uploadResult.error?.message || 'Gagal unggah logo ke Cloudinary');
        }
      }

      // Upload Thermal Logo to Cloudinary if changed
      if (thermalLogoFile) {
        const config = await getInfraConfig();
        const uploadData = new FormData();
        uploadData.append('file', thermalLogoFile);
        uploadData.append('upload_preset', config.cloudinary_upload_preset || 'kasirpos');
        uploadData.append('public_id', 'thermal_logo_' + storeId);

        const cloudName = config.cloudinary_cloud_name || 'dkcjfwbvc';
        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          body: uploadData
        });

        const uploadResult = await uploadRes.json();
        if (uploadRes.ok && uploadResult.secure_url) {
          finalSettings.thermalLogoUrl = uploadResult.secure_url;
          setSettings(prev => ({ ...prev, thermalLogoUrl: uploadResult.secure_url }));
          setThermalLogoFile(null);
        } else {
          throw new Error(uploadResult.error?.message || 'Gagal unggah logo thermal ke Cloudinary');
        }
      }

      // Upload QRIS to Cloudinary if changed
      if (qrisFile) {
        const config = await getInfraConfig();
        const uploadData = new FormData();
        uploadData.append('file', qrisFile);
        uploadData.append('upload_preset', config.cloudinary_upload_preset || 'kasirpos');
        uploadData.append('public_id', 'qris_' + storeId);

        const cloudName = config.cloudinary_cloud_name || 'dkcjfwbvc';
        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          body: uploadData
        });

        const uploadResult = await uploadRes.json();
        if (uploadRes.ok && uploadResult.secure_url) {
          finalSettings.qrisUrl = uploadResult.secure_url;
          setSettings(prev => ({ ...prev, qrisUrl: uploadResult.secure_url }));
          setQrisFile(null);
        } else {
          throw new Error(uploadResult.error?.message || 'Gagal unggah foto QRIS ke Cloudinary');
        }
      }

      // Upload Signature to Cloudinary if changed
      if (signaturePadData) {
        const config = await getInfraConfig();
        const uploadData = new FormData();
        uploadData.append('file', signaturePadData);
        uploadData.append('upload_preset', config.cloudinary_upload_preset || 'kasirpos');
        uploadData.append('public_id', 'signature_' + storeId);

        const cloudName = config.cloudinary_cloud_name || 'dkcjfwbvc';
        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          body: uploadData
        });

        const uploadResult = await uploadRes.json();
        if (uploadRes.ok && uploadResult.secure_url) {
          finalSettings.signatureUrl = uploadResult.secure_url;
          setSettings(prev => ({ ...prev, signatureUrl: uploadResult.secure_url }));
          setSignaturePadData('');
        } else {
          console.error("Signature upload failed:", uploadResult);
          // Don't throw error here to let other settings save, but maybe toast it?
          toast.error("Gagal mengunggah tanda tangan.");
        }
      }

      await setDoc(settingsRef, finalSettings);
      
      // SYNC back to Stores collection for Super Admin view
      if (storeId) {
        await updateDoc(doc(db, 'stores', storeId), {
          name: finalSettings.storeName
        }).catch(() => {});
      }

      // Sync to Global Store (AuthStore) for immediate UI update
      useAuthStore.getState().setStoreName(finalSettings.storeName);

      setLogoUrl(finalSettings.logoUrl || null);
      
      await logActivity({
        userId: user?.uid || 'unknown',
        userName: user?.displayName || user?.email || 'Admin',
        userEmail: user?.email || '-',
        storeId: storeId || 'unknown',
        action: 'SETTINGS_CHANGE',
        description: `Memperbarui pengaturan toko / informasi struk: ${finalSettings.storeName}`
      });

      toast.success('Pengaturan berhasil disimpan!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan pengaturan.');
    } finally {
      setIsSaving(false);
    }
  };

  const testNotification = async () => {
    if (!('Notification' in window)) {
      toast.error('Browser Anda tidak mendukung notifikasi latar belakang.');
      return;
    }

    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error(`Izin notifikasi ditolak (${permission}). Harap aktifkan di pengaturan browser.`);
        return;
      }
    }

    toast.success('Minimalkan aplikasi / Tutup tab sekarang! Menunggu sistem...', { 
        duration: 5000,
        style: { border: '2px solid #3b82f6', padding: '16px', color: '#10b981', fontWeight: 'bold' }
    });
    
    setTimeout(async () => {
      try {
        let registration;
        
        // Try to get ready registration
        try {
          registration = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((_, reject) => setTimeout(() => reject('Timeout'), 5000))
          ]) as ServiceWorkerRegistration;
        } catch (e) {
          console.log("Ready state timed out, trying to register manually...");
          registration = await navigator.serviceWorker.register('/sw.js');
        }

        if (!registration) throw new Error("Gagal menghubungkan ke Service Worker.");

        await registration.showNotification('🎯 TES PESANAN BARU', {
          body: 'Notifikasi latar belakang berfungsi! Jika ini muncul di Android, maka sistem Anda sudah sinkron.',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [200, 100, 200],
          tag: 'test-notification',
          renotify: true,
          requireInteraction: true
        } as any);

        toast.success("Notifikasi dikirim!");
      } catch (err: any) {
        toast.error(`Gagal: ${err.message || err}`);
        try {
           new Notification('🎯 TES PESANAN BARU', { body: 'Notifikasi dasar (mode terbatas).' });
        } catch (f) {}
      }
    }, 5000);
  };

  const handleResetPWA = async () => {
    if (!window.confirm("RESET KONEKSI & NOTIFIKASI?\n\nIni akan mereset cache browser dan mendaftarkan ulang sistem notifikasi untuk domain ini. Sangat disarankan jika Anda baru saja mengganti nama domain. Halaman akan dimuat ulang.")) return;

    try {
      // 1. Unregister Service Workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }
      }

      // 2. Clear Caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (let name of cacheNames) {
          await caches.delete(name);
        }
      }

      toast.success("Berhasil mereset data. Memuat ulang sistem...");
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err) {
      console.error("Failed to reset PWA:", err);
      toast.error("Gagal mereset data secara otomatis. Coba bersihkan cache browser secara manual.");
    }
  };

  const handleExport = async () => {
    if (!storeId) return;
    setIsBackuping(true);
    try {
      await handleExportJSON(storeId);
      alert('Backup berhasil diunduh!');
    } catch (err: any) {
      console.error("Backup error:", err);
      alert('Gagal melakukan backup: ' + err.message);
    } finally {
      setIsBackuping(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storeId) return;

    if (!confirm('PERINGATAN: Mengembalikan data akan menimpa atau menambah data yang sudah ada. Lanjutkan?')) {
      e.target.value = '';
      return;
    }

    setIsRestoring(true);
    setRestoreProgress(0);
    
    try {
      const reader = new FileReader();
      const content = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });

      const backupData = JSON.parse(content);
      
      if (!backupData.data) throw new Error('Format file backup tidak valid.');

      const collections = Object.keys(backupData.data);
      let totalDocs = 0;
      collections.forEach(c => totalDocs += backupData.data[c].length);
      
      let processedDocs = 0;

      for (const collName of collections) {
        const docs = backupData.data[collName];
        
        // Split into batches of 400 (under 500 limit)
        for (let i = 0; i < docs.length; i += 400) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + 400);
          
          chunk.forEach((d: any) => {
            const { id, ...data } = d;
            // ENFORCE storeId for security
            data.storeId = storeId;
            const ref = doc(db, collName, id);
            batch.set(ref, data, { merge: true });
          });

          await batch.commit();
          processedDocs += chunk.length;
          setRestoreProgress(Math.round((processedDocs / totalDocs) * 100));
        }
      }

      await logActivity({
        userId: user?.uid || 'unknown',
        userName: user?.displayName || user?.email || 'Admin',
        userEmail: user?.email || '-',
        storeId: storeId || 'unknown',
        action: 'SETTINGS_CHANGE',
        description: 'Melakukan pemulihan data (Restore Backup)'
      });

      alert('Berhasil memulihkan data!');
      window.location.reload(); // Reload to refresh all state
    } catch (err: any) {
      console.error("Restore error:", err);
      alert('Gagal memulihkan data: ' + err.message);
    } finally {
      setIsRestoring(false);
      e.target.value = '';
    }
  };
  const handleRemoveLogo = () => {
    if (confirm('Hapus logo utama toko?')) {
      setSettings(prev => ({ ...prev, logoUrl: '' }));
      toast.success('Logo dihapus (klik Simpan untuk menetapkan)');
    }
  };

  const handleRemoveThermalLogo = () => {
    if (confirm('Hapus logo struk thermal?')) {
      setSettings(prev => ({ ...prev, thermalLogoUrl: '' }));
      toast.success('Logo thermal dihapus (klik Simpan untuk menetapkan)');
    }
  };

  const handleRemoveQris = () => {
    if (confirm('Hapus foto QRIS pembayaran?')) {
      setSettings(prev => ({ ...prev, qrisUrl: '' }));
      toast.success('Foto QRIS dihapus (klik Simpan untuk menetapkan)');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordState.newPassword !== passwordState.confirmPassword) {
      toast.error('Kata sandi baru tidak cocok dengan konfirmasi');
      return;
    }
    if (passwordState.newPassword.length < 6) {
      toast.error('Kata sandi baru minimal 6 karakter');
      return;
    }
    if (!auth.currentUser?.email) {
      toast.error('Data pengguna tidak valid, coba login ulang');
      return;
    }

    setIsChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, passwordState.oldPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, passwordState.newPassword);
      
      await logActivity({
        userId: user?.uid || 'unknown',
        userName: user?.displayName || user?.email || 'Admin',
        userEmail: user?.email || '-',
        storeId: storeId || 'unknown',
        action: 'SECURITY',
        description: 'Mengubah kata sandi akun'
      });

      toast.success('Kata sandi berhasil diubah!');
      setPasswordState({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        toast.error('Kata sandi lama yang Anda masukkan salah');
      } else {
        toast.error('Gagal mengubah kata sandi: ' + err.message);
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-10 h-10 text-accent animate-spin" />
      </div>
    );
  }

  const onlineOrderUrl = (typeof window !== 'undefined' ? window.location.origin + "/tr?s=" + storeId : '');

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Pengaturan Toko</h1>
          <p className="text-app-text-muted mt-1 font-medium">Konfigurasi profil bisnis dan informasi cetak struk</p>
        </div>
      </div>

      {/* Subscription Banner */}
      <div className="bg-gradient-to-r from-accent/90 to-accent/60 border border-accent/20 rounded-3xl p-6 shadow-xl shadow-accent/20 flex flex-col md:flex-row items-center justify-between gap-4 mt-6">
        <div>
          <h2 className="text-white font-black text-xs uppercase tracking-widest mb-1">Masa Aktif Akun</h2>
          <p className="text-white/90 font-bold text-sm">
            {isSubscriptionExpired ? 'Berakhir pada ' : 'Berlaku s/d '} 
            {subscriptionUntil ? new Date(subscriptionUntil).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
          </p>
        </div>
        {hasPendingSubscription && (
          <div className="bg-amber-500/20 px-6 py-3 rounded-2xl border border-amber-500/50 shadow-lg flex items-center gap-2">
            <History size={16} className="text-amber-500 animate-spin-slow" />
            <span className="text-xs font-black uppercase tracking-wider text-amber-500">Menunggu Verifikasi Pusat</span>
          </div>
        )}
      </div>

      <SubscriptionModal isOpen={showSubscriptionModal} onClose={() => setShowSubscriptionModal(false)} />

      <div className="bg-surface border border-app-border rounded-3xl overflow-hidden mt-6 p-5 md:p-8 shadow-xl shadow-black/20 transition-colors duration-300">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <h2 className="text-lg font-black text-foreground flex items-center gap-3 uppercase tracking-wider">
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                  <SettingsIcon size={18} className="text-accent" />
                </div>
                Profil Toko
              </h2>
              
              <div className="space-y-4">
                <label className="block text-xs font-black text-app-text-muted uppercase tracking-widest ml-1">Logo Toko (Invoice Utama & Web)</label>
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-2xl bg-background border-2 border-app-border overflow-hidden flex items-center justify-center relative shadow-inner">
                       {logoPreview ? (
                         <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-contain" />
                       ) : (
                         <div className="text-app-text-muted text-[10px] font-black uppercase text-center px-2 italic opacity-50">NO LOGO</div>
                       )}
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <UploadCloud size={20} className="text-white" />
                       </div>
                    </div>
                    <input 
                     type="file" 
                     accept="image/*"
                     onChange={handleLogoChange}
                     className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                     <div className="flex items-center justify-between">
                        <div className="relative">
                           <button 
                             type="button"
                             className="bg-accent/15 hover:bg-accent text-accent hover:text-white px-3 py-1.5 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-accent/20"
                           >
                             <UploadCloud size={12} /> Pilih Logo Baru
                           </button>
                           <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleLogoChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                           />
                        </div>
                        {settings.logoUrl && (
                          <button 
                            type="button"
                            onClick={handleRemoveLogo}
                            className="bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white p-1.5 rounded-lg transition-all flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest"
                          >
                             <Trash2 size={12} /> Hapus
                          </button>
                        )}
                     </div>
                     <p className="text-[10px] font-bold text-app-text-muted leading-relaxed italic">Direkomendasikan gambar persegi (1:1) dengan latar transparan (.png/webp).</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-app-border/50">
                <label className="block text-xs font-black text-app-text-muted uppercase tracking-widest ml-1">Logo Struk Thermal (B&W)</label>
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-2xl bg-white border-2 border-app-border overflow-hidden flex items-center justify-center relative shadow-inner">
                       {thermalLogoPreview ? (
                         <img src={thermalLogoPreview} alt="Thermal Logo Preview" className="w-full h-full object-contain filter grayscale contrast-125" />
                       ) : (
                         <div className="text-app-text-muted text-[10px] font-black uppercase text-center px-2 italic opacity-50">NO LOGO</div>
                       )}
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <UploadCloud size={20} className="text-white" />
                       </div>
                    </div>
                    <input 
                     type="file" 
                     accept="image/*"
                     onChange={handleThermalLogoChange}
                     className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                     <div className="flex items-center justify-between">
                        <div className="relative">
                           <button 
                             type="button"
                             className="bg-accent/15 hover:bg-accent text-accent hover:text-white px-3 py-1.5 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-accent/20"
                           >
                             <UploadCloud size={12} /> Pilih Logo Thermal
                           </button>
                           <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleThermalLogoChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                           />
                        </div>
                        {settings.thermalLogoUrl && (
                          <button 
                            type="button"
                            onClick={handleRemoveThermalLogo}
                            className="bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white p-1.5 rounded-lg transition-all flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest"
                          >
                             <Trash2 size={12} /> Hapus
                          </button>
                        )}
                     </div>
                     <p className="text-[10px] font-bold text-app-text-muted leading-relaxed italic">Khusus untuk printer thermal. Wajib berlatar belakang <b className="text-foreground">PUTIH SOLID</b> dan logo warna hitam. Lebar optimal: kelipatan 8 (misal: 200px).</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-app-border/50">
                <label className="block text-xs font-black text-app-text-muted uppercase tracking-widest ml-1">Foto QRIS Pembayaran</label>
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-2xl bg-white border-2 border-app-border overflow-hidden flex items-center justify-center relative shadow-inner p-1">
                       {qrisPreview ? (
                         <img src={qrisPreview} alt="QRIS Preview" className="w-full h-full object-contain" />
                       ) : (
                         <div className="text-app-text-muted text-[10px] font-black uppercase text-center px-2 italic opacity-50">NO QRIS</div>
                       )}
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <UploadCloud size={20} className="text-white" />
                       </div>
                    </div>
                    <input 
                     type="file" 
                     accept="image/*"
                     onChange={handleQrisChange}
                     className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                     <div className="flex items-center justify-between">
                        <div className="relative">
                           <button 
                             type="button"
                             className="bg-accent/15 hover:bg-accent text-accent hover:text-white px-3 py-1.5 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-accent/20"
                           >
                             <UploadCloud size={12} /> Pilih Foto QRIS
                           </button>
                           <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleQrisChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                           />
                        </div>
                        {settings.qrisUrl && (
                          <button 
                            type="button"
                            onClick={handleRemoveQris}
                            className="bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white p-1.5 rounded-lg transition-all flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest"
                          >
                             <Trash2 size={12} /> Hapus
                          </button>
                        )}
                     </div>
                     <p className="text-[10px] font-bold text-app-text-muted leading-relaxed italic">Dipergunakan saat checkout pembayaran QRIS di sistem POS.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-app-text-muted uppercase tracking-widest ml-1">Nama Toko</label>
                <input 
                  type="text" 
                  name="storeName"
                  value={settings.storeName} 
                  onChange={handleChange}
                  required
                  className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all" 
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-xs font-black text-app-text-muted uppercase tracking-widest ml-1">Alamat Lengkap</label>
                <textarea 
                  name="address"
                  rows={3} 
                  value={settings.address}
                  onChange={handleChange}
                  className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all resize-none"
                ></textarea>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-app-text-muted uppercase tracking-widest ml-1">Nomor Telepon</label>
                <input 
                  type="text" 
                  name="phone"
                  value={settings.phone} 
                  onChange={handleChange}
                  className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all" 
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                   <label className="block text-xs font-black text-app-text-muted uppercase tracking-widest ml-1">Info Rekening / Pembayaran</label>
                   <span className="text-[9px] font-bold text-app-text-muted italic">Muncul di Invoice A4 / Estimasi</span>
                </div>
                <textarea 
                  name="bankInfo"
                  rows={2} 
                  value={settings.bankInfo}
                  onChange={handleChange}
                  placeholder="Contoh: BCA 123456789 a.n Nama Toko"
                  className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all resize-none"
                ></textarea>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-app-text-muted uppercase tracking-widest ml-1">Catatan Struk A4 (Invoice)</label>
                <textarea 
                  name="a4InvoiceNote"
                  rows={2} 
                  value={settings.a4InvoiceNote}
                  onChange={handleChange}
                  placeholder="Contoh: * Barang yang sudah dibeli tidak dapat ditukar..."
                  className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all resize-none"
                ></textarea>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-app-text-muted uppercase tracking-widest ml-1">Catatan Struk A4 (Estimasi)</label>
                <textarea 
                  name="a4EstimationNote"
                  rows={2} 
                  value={settings.a4EstimationNote}
                  onChange={handleChange}
                  placeholder="Contoh: * Harga diatas adalah estimasi biaya pengerjaan..."
                  className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all resize-none"
                ></textarea>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-app-text-muted uppercase tracking-widest ml-1">Catatan Struk A4 (Piutang / Hutang)</label>
                <textarea 
                  name="a4DebtNote"
                  rows={2} 
                  value={settings.a4DebtNote}
                  onChange={handleChange}
                  placeholder="Contoh: * Sisa tagihan piutang wajib dilunasi sebelum jatuh tempo..."
                  className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all resize-none"
                ></textarea>
              </div>

              <div className="pt-6 border-t border-app-border space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-foreground uppercase tracking-widest leading-none">Tanda Tangan Digital</h4>
                    <p className="text-[10px] font-bold text-app-text-muted italic mt-1">Tanda tangan resmi toko untuk dokumen</p>
                  </div>
                  <div 
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => setSettings(prev => ({ ...prev, showSignature: !prev.showSignature }))}
                  >
                    <span className="text-[10px] font-black text-app-text-muted uppercase tracking-widest group-hover:text-accent transition-colors">Tampilkan di Dokumen</span>
                    <div className={`w-12 h-6 rounded-full transition-all relative ${settings.showSignature ? 'bg-accent' : 'bg-app-border'}`}>
                       <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.showSignature ? 'left-7' : 'left-1'}`}></div>
                    </div>
                  </div>
                </div>

                <div className="bg-surface rounded-[2rem] border border-app-border p-6 space-y-4">
                   <p className="text-[11px] font-medium text-app-text-muted leading-relaxed">
                      Gunakan area di bawah ini untuk menggambar tanda tangan menggunakan mouse atau layar sentuh. Pastikan tanda tangan sudah benar sebelum menekan tombol simpan di atas.
                   </p>
                   
                   <SignaturePad 
                      onSave={(data) => setSignaturePadData(data)}
                      initialImage={settings.signatureUrl}
                      className="max-w-md"
                   />

                   {settings.signatureUrl && !signaturePadData && (
                     <div className="flex items-center gap-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                        <div className="w-12 h-12 rounded-xl bg-white p-2 border border-emerald-500/20 shadow-sm overflow-hidden flex items-center justify-center">
                           <img src={settings.signatureUrl} alt="Signature Preview" className="max-h-full max-w-full object-contain" />
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none">Tanda Tangan Aktif</p>
                           <p className="text-[9px] font-bold text-emerald-500/70 italic mt-1 leading-none">Tersimpan di Cloudinary</p>
                        </div>
                     </div>
                   )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-lg font-black text-foreground flex items-center gap-3 uppercase tracking-wider">
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                  <Receipt size={18} className="text-accent" />
                </div>
                Pengaturan Struk
              </h2>
              
              <div className="flex items-center gap-4 p-4 bg-background border border-app-border rounded-2xl hover:border-accent/30 transition-all group cursor-pointer" onClick={() => setSettings(prev => ({ ...prev, useTax: !prev.useTax }))}>
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${settings.useTax ? 'bg-accent border-accent text-foreground' : 'bg-transparent border-app-border text-transparent'}`}>
                  <Check size={14} className="stroke-[4]" />
                </div>
                <label htmlFor="useTax" className="text-sm font-bold text-foreground cursor-pointer select-none">
                  Aktifkan Pajak (PPN)
                </label>
              </div>

              {settings.useTax && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                  <label className="block text-xs font-black text-app-text-muted uppercase tracking-widest ml-1">Pajak PPN (%)</label>
                  <input 
                    type="number" 
                    name="taxRate"
                    min="0"
                    max="100"
                    value={settings.taxRate} 
                    onChange={handleChange}
                    className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all" 
                  />
                </div>
              )}

              <div className="flex items-center gap-4 p-4 bg-background border border-app-border rounded-2xl hover:border-accent/30 transition-all group cursor-pointer" onClick={() => setSettings(prev => ({ ...prev, showLogoOnReceipt: !prev.showLogoOnReceipt }))}>
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${settings.showLogoOnReceipt ? 'bg-accent border-accent text-foreground' : 'bg-transparent border-app-border text-transparent'}`}>
                  <Check size={14} className="stroke-[4]" />
                </div>
                <label className="text-sm font-bold text-foreground cursor-pointer select-none">
                  Tampilkan Logo di Struk
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                 {[
                   { id: 'showReceiptAddress', label: 'Tampilkan Alamat Toko' },
                   { id: 'showReceiptPhone', label: 'Tampilkan No. Telepon' },
                   { id: 'showReceiptCustomer', label: 'Tampilkan Nama Pelanggan' },
                   { id: 'showReceiptCashier', label: 'Tampilkan Nama Kasir' },
                   { id: 'showReceiptSubtotal', label: 'Tampilkan Detail Subtotal' }
                 ].map(toggle => (
                    <div 
                      key={toggle.id}
                      className="flex items-center gap-3 p-3 bg-surface border border-app-border rounded-xl cursor-pointer hover:border-accent/30 transition-all group" 
                      onClick={() => setSettings(prev => ({ ...prev, [toggle.id]: !(prev as any)[toggle.id] }))}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        (settings as any)[toggle.id] ? 'bg-accent border-accent text-foreground' : 'bg-transparent border-app-border text-transparent'
                      }`}>
                        <Check size={12} className="stroke-[4]" />
                      </div>
                      <label className="text-[11px] font-bold text-foreground cursor-pointer select-none">
                        {toggle.label}
                      </label>
                    </div>
                 ))}
              </div>
              
              <div className="space-y-2">
                <label className="block text-xs font-black text-app-text-muted uppercase tracking-widest ml-1">Ukuran Kertas Printer</label>
                <select 
                  name="paperSize"
                  value={settings.paperSize || '58mm'} 
                  onChange={handleChange as any}
                  className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all appearance-none cursor-pointer"
                >
                  <option value="58mm">Thermal Printer Kecil (58mm)</option>
                  <option value="80mm">Thermal Printer Sedang (80mm)</option>
                </select>
              </div>

              <div className="space-y-3 p-4 bg-background border border-app-border rounded-2xl">
                <label className="block text-xs font-black text-app-text-muted uppercase tracking-widest ml-1">Gaya Font Nama Toko</label>
                <div className="grid grid-cols-2 gap-2">
                   {FONT_OPTIONS.map(font => (
                     <button
                       key={font.id}
                       type="button"
                       onClick={() => setSettings(prev => ({ ...prev, storeNameFont: font.id }))}
                       className={`p-3 rounded-xl border-2 text-left transition-all ${
                         settings.storeNameFont === font.id 
                         ? 'border-accent bg-accent/5' 
                         : 'border-app-border bg-surface hover:border-accent/30'
                       }`}
                     >
                        <p className="text-[10px] font-black text-app-text-muted uppercase mb-1">{font.name}</p>
                        <p style={{ fontFamily: font.family }} className="text-sm font-bold truncate">
                          {settings.storeName || 'Nama Toko Anda'}
                        </p>
                     </button>
                   ))}
                </div>
              </div>

              {/* LIVE PREVIEW COMPONENT */}
              <div className="p-6 bg-slate-900 rounded-[2rem] border border-slate-800 shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Receipt size={80} className="text-white" />
                 </div>
                 <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                       <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                       <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Preview Struk Real-Time</h3>
                    </div>
                    
                    <div className="bg-white text-slate-900 p-6 rounded-xl shadow-inner font-mono text-[10px] space-y-1 mx-auto max-w-[200px] border-t-8 border-slate-200">
                       <div className="text-center mb-4">
                          {(settings.thermalLogoUrl || settings.logoUrl) && settings.showLogoOnReceipt && (
                            <img src={settings.thermalLogoUrl || settings.logoUrl} alt="logo" className="w-8 h-8 mx-auto object-contain grayscale mb-2 opacity-50" />
                          )}
                          <p 
                            style={{ 
                              fontFamily: getFontFamily(settings.storeNameFont),
                              fontSize: '14px',
                              fontWeight: 900,
                              lineHeight: '1.2',
                              textTransform: 'uppercase'
                            }}
                          >
                            {(settings.storeName || 'IKASIR PRO').includes('@') ? (settings.storeName || 'IKASIR PRO').split('@')[0] : (settings.storeName || 'IKASIR PRO')}
                          </p>
                          {settings.showReceiptAddress && <p className="text-[8px] opacity-70" style={{ whiteSpace: 'pre-wrap' }}>{settings.address || 'Alamat Toko...'}</p>}
                          {settings.showReceiptPhone && <p className="text-[8px] opacity-70" style={{ whiteSpace: 'pre-wrap' }}>Telp: {settings.phone || '-'}</p>}
                       </div>
                       
                       <div className="border-b border-dashed border-slate-300 py-1 flex justify-between">
                          <span>ITEM x1</span>
                          <span>10.000</span>
                       </div>
                       <div className="flex justify-between font-black pt-1">
                           <span>TOTAL</span>
                           <span>10.000</span>
                        </div>
                        {settings.showSignature && (settings.signatureUrl || signaturePadData) && (
                          <div className="text-center py-2 border-t border-dashed border-slate-200 mt-2 flex flex-col items-center">
                             <img 
                                src={signaturePadData || settings.signatureUrl} 
                                alt="Signature Preview" 
                                className="w-12 h-6 object-contain grayscale opacity-50" 
                             />
                             <span className="text-[6px] opacity-40 mt-0.5">Tanda Tangan Toko</span>
                          </div>
                        )}
                        <div className="text-center pt-4 opacity-50 italic text-[7px]" style={{ whiteSpace: 'pre-wrap' }}>
                           {settings.receiptMessage || 'Terima Kasih'}
                        </div>
                     </div>

                     <p className="mt-4 text-center text-[9px] text-slate-500 font-bold italic">
                        *Tampilan di atas adalah simulasi hasil cetak sesungguhnya.
                     </p>
                  </div>
               </div>

              <div className="p-6 bg-background border border-app-border rounded-[2rem] space-y-8">
                  <div className="flex items-center gap-3 border-b border-app-border pb-4">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                      <List size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Format Penomoran Dokumen</h3>
                      <p className="text-[10px] text-app-text-muted font-bold">Atur awalan dan nomor urut untuk setiap jenis dokumen.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* TRANSAKSI TUNAI */}
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <h4 className="text-[11px] font-black text-foreground uppercase tracking-widest">Transaksi Tunai / Lunas</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest ml-1">Awalan</label>
                          <input type="text" name="trxPrefix" value={settings.trxPrefix} onChange={handleChange} className="w-full p-3 bg-surface border border-app-border rounded-xl text-xs font-bold focus:border-accent outline-none uppercase" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest ml-1">Padding (0)</label>
                          <input type="number" name="trxPadding" min="2" max="8" value={settings.trxPadding} onChange={handleChange} className="w-full p-3 bg-surface border border-app-border rounded-xl text-xs font-bold focus:border-accent outline-none" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest ml-1">Nomor Urut Terakhir</label>
                        <input type="number" name="trxCounter" min="0" value={settings.trxCounter} onChange={handleChange} className="w-full p-3 bg-surface border border-app-border rounded-xl text-xs font-bold focus:border-accent outline-none" />
                        <p className="text-[9px] text-app-text-muted italic ml-1">Contoh: <span className="text-foreground font-black">{(settings.trxPrefix || '').toUpperCase()}{String((Number(settings.trxCounter) || 0) + 1).padStart(settings.trxPadding || 4, '0')}</span></p>
                      </div>
                    </div>

                    {/* PESANAN ONLINE */}
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                        <h4 className="text-[11px] font-black text-foreground uppercase tracking-widest">Pesanan Online / Delivery</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest ml-1">Awalan</label>
                          <input type="text" name="ordPrefix" value={settings.ordPrefix} onChange={handleChange} className="w-full p-3 bg-surface border border-app-border rounded-xl text-xs font-bold focus:border-accent outline-none uppercase" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest ml-1">Padding (0)</label>
                          <input type="number" name="ordPadding" min="2" max="8" value={settings.ordPadding} onChange={handleChange} className="w-full p-3 bg-surface border border-app-border rounded-xl text-xs font-bold focus:border-accent outline-none" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest ml-1">Nomor Urut Terakhir</label>
                        <input type="number" name="ordCounter" min="0" value={settings.ordCounter} onChange={handleChange} className="w-full p-3 bg-surface border border-app-border rounded-xl text-xs font-bold focus:border-accent outline-none" />
                        <p className="text-[9px] text-app-text-muted italic ml-1">Contoh: <span className="text-foreground font-black">{(settings.ordPrefix || '').toUpperCase()}{String((Number(settings.ordCounter) || 0) + 1).padStart(settings.ordPadding || 4, '0')}</span></p>
                      </div>
                    </div>

                    {/* PIUTANG CUSTOMER */}
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        <h4 className="text-[11px] font-black text-foreground uppercase tracking-widest">Transaksi Piutang (Kasir)</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest ml-1">Awalan</label>
                          <input type="text" name="debPrefix" value={settings.debPrefix} onChange={handleChange} className="w-full p-3 bg-surface border border-app-border rounded-xl text-xs font-bold focus:border-accent outline-none uppercase" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest ml-1">Padding (0)</label>
                          <input type="number" name="debPadding" min="2" max="8" value={settings.debPadding} onChange={handleChange} className="w-full p-3 bg-surface border border-app-border rounded-xl text-xs font-bold focus:border-accent outline-none" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest ml-1">Nomor Urut Terakhir</label>
                        <input type="number" name="debCounter" min="0" value={settings.debCounter} onChange={handleChange} className="w-full p-3 bg-surface border border-app-border rounded-xl text-xs font-bold focus:border-accent outline-none" />
                        <p className="text-[9px] text-app-text-muted italic ml-1">Contoh: <span className="text-foreground font-black">{(settings.debPrefix || '').toUpperCase()}{String((Number(settings.debCounter) || 0) + 1).padStart(settings.debPadding || 4, '0')}</span></p>
                      </div>
                    </div>

                    {/* ESTIMASI BIAYA */}
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <h4 className="text-[11px] font-black text-foreground uppercase tracking-widest">Penawaran / Estimasi Biaya</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest ml-1">Awalan</label>
                          <input type="text" name="estPrefix" value={settings.estPrefix} onChange={handleChange} className="w-full p-3 bg-surface border border-app-border rounded-xl text-xs font-bold focus:border-accent outline-none uppercase" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest ml-1">Padding (0)</label>
                          <input type="number" name="estPadding" min="2" max="8" value={settings.estPadding} onChange={handleChange} className="w-full p-3 bg-surface border border-app-border rounded-xl text-xs font-bold focus:border-accent outline-none" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest ml-1">Nomor Urut Terakhir</label>
                        <input type="number" name="estCounter" min="0" value={settings.estCounter} onChange={handleChange} className="w-full p-3 bg-surface border border-app-border rounded-xl text-xs font-bold focus:border-accent outline-none" />
                        <p className="text-[9px] text-app-text-muted italic ml-1">Contoh: <span className="text-foreground font-black">{(settings.estPrefix || '').toUpperCase()}{String((Number(settings.estCounter) || 0) + 1).padStart(settings.estPadding || 4, '0')}</span></p>
                      </div>
                    </div>
                  </div>
               </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-app-text-muted uppercase tracking-widest ml-1">Pesan Footer Struk</label>
                <textarea 
                  name="receiptMessage"
                  rows={3} 
                  value={settings.receiptMessage}
                  onChange={handleChange}
                  className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all resize-none"
                ></textarea>
              </div>

              <div className="space-y-4 pt-4 border-t border-app-border/50">
                <div className="flex items-center justify-between">
                   <label className="block text-xs font-black text-[#25D366] uppercase tracking-widest ml-1">Template WhatsApp</label>
                   <span className="text-[9px] font-bold text-app-text-muted italic">Mendukung: {"{customerName}, {trxId}, {total}, {paid}, {debt}, {dueDate}, {storeName}"}</span>
                </div>
                <textarea 
                  name="waTemplate"
                  rows={6} 
                  value={settings.waTemplate}
                  onChange={handleChange}
                  placeholder="Tulis template pesan WhatsApp di sini..."
                  className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-[#25D366] focus:ring-4 focus:ring-[#25D366]/10 transition-all resize-none text-xs leading-relaxed font-mono"
                ></textarea>
              </div>

              </div>
            </div>

          <div className="mt-8 pt-8 border-t border-app-border space-y-6">
            <h2 className="text-lg font-black text-foreground flex items-center gap-3 uppercase tracking-wider">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <ShoppingBag size={18} className="text-emerald-500" />
              </div>
              Tema Halaman Pemesanan Online
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-background border border-app-border p-6 rounded-[2rem]">
               <div className="space-y-4">
                  <p className="text-[11px] font-medium text-app-text-muted leading-relaxed">
                     Pilih warna tema utama yang akan digunakan di halaman pemesanan online. Warna ini akan diterapkan pada tombol, highlight teks, dan warna latar belakang aksen.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['#10b981', '#3b82f6', '#f43f5e', '#8b5cf6', '#f59e0b', '#0f172a'].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSettings(prev => ({...prev, themeColorHex: color}))}
                        className={`w-10 h-10 rounded-full border-2 transition-all shadow-md ${settings.themeColorHex === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
               </div>
               <div className="flex items-center gap-6 p-4 bg-surface rounded-2xl border border-app-border">
                  <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-app-border cursor-pointer shadow-lg shrink-0">
                    <input 
                      type="color" 
                      name="themeColorHex"
                      value={settings.themeColorHex}
                      onChange={handleChange}
                      className="absolute -top-4 -left-4 w-32 h-32 cursor-pointer"
                    />
                  </div>
                                    <div>
                     <p className="text-[10px] font-black uppercase text-app-text-muted mb-1">Custom Color Hex</p>
                     <p className="text-sm font-black text-accent uppercase tracking-widest leading-none mb-2">{settings.themeColorHex}</p>
                     <input 
                        type="text"
                        name="themeColorHex"
                        value={settings.themeColorHex}
                        onChange={handleChange}
                        placeholder="#10b981"
                        className="w-28 p-2 bg-background border border-app-border rounded-xl text-xs font-bold font-mono focus:outline-none focus:border-accent text-foreground mb-2"
                     />
                     <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: settings.themeColorHex }}></div>
                        <span className="text-[9px] font-bold text-app-text-muted italic truncate">Warna link aktif & aksen publik</span>
                     </div>
                  </div>
               </div>
            </div>
         </div>
 
          <div className="mt-8 pt-8 border-t border-app-border space-y-6">
            <h2 className="text-lg font-black text-foreground flex items-center gap-3 uppercase tracking-wider">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Smartphone size={18} className="text-orange-500" />
              </div>
              Konfigurasi Pemesanan Online
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-4">
                  <div 
                    className="flex items-center gap-4 p-4 bg-background border border-app-border rounded-2xl hover:border-accent/30 transition-all group cursor-pointer" 
                    onClick={() => setSettings(prev => ({ ...prev, isOnlineStoreActive: !prev.isOnlineStoreActive }))}
                  >
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${settings.isOnlineStoreActive ? 'bg-accent border-accent text-foreground' : 'bg-transparent border-app-border text-transparent'}`}>
                      <Check size={14} className="stroke-[4]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground cursor-pointer select-none">Aktifkan Toko Online (Visibility)</p>
                      <p className="text-[10px] text-app-text-muted font-medium">Aktifkan untuk menerima pesanan online dari pelanggan.</p>
                    </div>
                  </div>

                  <div 
                    className="flex items-center gap-4 p-4 bg-background border border-app-border rounded-2xl hover:border-accent/30 transition-all group cursor-pointer" 
                    onClick={() => setSettings(prev => ({ ...prev, allowPickup: !prev.allowPickup }))}
                  >
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${settings.allowPickup ? 'bg-accent border-accent text-foreground' : 'bg-transparent border-app-border text-transparent'}`}>
                      <Check size={14} className="stroke-[4]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground cursor-pointer select-none">Aktifkan Ambil di Tempat</p>
                      <p className="text-[10px] text-app-text-muted font-medium">Pelanggan bisa memesan dan mengambil sendiri.</p>
                    </div>
                  </div>

                  <div 
                    className="flex items-center gap-4 p-4 bg-background border border-app-border rounded-2xl hover:border-accent/30 transition-all group cursor-pointer" 
                    onClick={() => setSettings(prev => ({ ...prev, allowDelivery: !prev.allowDelivery }))}
                  >
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${settings.allowDelivery ? 'bg-accent border-accent text-foreground' : 'bg-transparent border-app-border text-transparent'}`}>
                      <Check size={14} className="stroke-[4]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground cursor-pointer select-none">Aktifkan Pengiriman</p>
                      <p className="text-[10px] text-app-text-muted font-medium">Pelanggan bisa memesan untuk dikirim ke rumah.</p>
                    </div>
                  </div>
               </div>

               {settings.allowDelivery && (
                 <div className="p-6 bg-surface border border-app-border rounded-[2rem] space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-3 mb-2">
                       <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                          <Download size={20} className="rotate-180" />
                       </div>
                       <div>
                          <p className="text-xs font-black uppercase tracking-widest text-foreground">Biaya Pengiriman</p>
                          <p className="text-[10px] font-bold text-app-text-muted italic">Akan ditambahkan otomatis ke total</p>
                       </div>
                    </div>
                    <div className="relative">
                       <div className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted font-black text-sm">Rp</div>
                       <input 
                         type="number" 
                         name="deliveryFee"
                         value={settings.deliveryFee}
                         onChange={handleChange}
                         min="0"
                         className="w-full p-4 pl-12 bg-background border border-app-border rounded-2xl text-foreground font-black text-lg focus:outline-none focus:border-accent transition-all" 
                       />
                    </div>
                 </div>
               )}
             </div>

             {/* MULTI-BANK TOKO ONLINE */}
             <div className="mt-8 pt-8 border-t border-app-border space-y-4">
               <h3 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                 <Landmark className="text-accent" size={16} /> Daftar Rekening Bank Toko (Multi-Bank Toko Online)
               </h3>
               <p className="text-[10px] text-app-text-muted font-medium mb-4">Merchant dapat mendaftarkan beberapa nomor rekening bank untuk metode pembayaran transfer pada toko online.</p>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 items-end bg-background/30 p-5 rounded-2xl border border-app-border">
                  <div className="space-y-1">
                     <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Nama Bank</label>
                     <input 
                       type="text" 
                       id="new-store-bank-name"
                       placeholder="e.g. BCA, MANDIRI"
                       className="w-full p-2.5 bg-background border border-app-border rounded-xl text-xs text-foreground font-bold focus:outline-none focus:border-accent"
                     />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Nomor Rekening</label>
                     <input 
                       type="text" 
                       id="new-store-bank-account"
                       placeholder="e.g. 12345678"
                       className="w-full p-2.5 bg-background border border-app-border rounded-xl text-xs text-foreground font-bold focus:outline-none focus:border-accent"
                     />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Atas Nama (Pemilik)</label>
                     <input 
                       type="text" 
                       id="new-store-bank-holder"
                       placeholder="e.g. Budi"
                       className="w-full p-2.5 bg-background border border-app-border rounded-xl text-xs text-foreground font-bold focus:outline-none focus:border-accent"
                     />
                  </div>
                  <div className="col-span-full flex justify-end">
                     <button
                       type="button"
                       onClick={() => {
                         const nameEl = document.getElementById('new-store-bank-name') as HTMLInputElement;
                         const accEl = document.getElementById('new-store-bank-account') as HTMLInputElement;
                         const holderEl = document.getElementById('new-store-bank-holder') as HTMLInputElement;
                         if (!nameEl.value || !accEl.value || !holderEl.value) {
                           toast.error('Semua kolom rekening bank harus diisi!');
                           return;
                         }
                         const newBank = {
                           id: Date.now().toString(),
                           bankName: nameEl.value.trim(),
                           accountNumber: accEl.value.trim(),
                           accountHolder: holderEl.value.trim()
                         };
                         setSettings(prev => ({
                           ...prev,
                           storeBanks: [...(prev.storeBanks || []), newBank]
                         }));
                         nameEl.value = '';
                         accEl.value = '';
                         holderEl.value = '';
                         toast.success('Rekening bank berhasil ditambahkan ke daftar');
                       }}
                       className="py-2.5 px-5 bg-accent hover:bg-accent/80 text-foreground rounded-xl font-black transition-all flex items-center gap-1 active:scale-95 text-[10px] uppercase tracking-widest shadow-md"
                     >
                        <Plus size={14} /> Tambah Rekening
                     </button>
                  </div>
               </div>

               {/* List of Added Store Banks */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(settings.storeBanks || []).map((bank: any) => (
                     <div key={bank.id} className="p-4 bg-background border border-app-border rounded-2xl flex items-center justify-between group hover:border-accent/20 transition-all">
                        <div className="min-w-0">
                           <span className="px-2 py-0.5 rounded bg-accent/10 text-accent text-[9px] font-black uppercase tracking-wider">{bank.bankName}</span>
                           <p className="text-xs font-black text-foreground mt-2 truncate">{bank.accountNumber}</p>
                           <p className="text-[10px] font-bold text-app-text-muted mt-0.5 truncate">a.n. {bank.accountHolder}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSettings(prev => ({
                              ...prev,
                              storeBanks: (prev.storeBanks || []).filter((b: any) => b.id !== bank.id)
                            }));
                            toast.success('Rekening bank dihapus');
                          }}
                          className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                        >
                           <Trash2 size={16} />
                        </button>
                     </div>
                  ))}
                  {(settings.storeBanks || []).length === 0 && (
                     <p className="text-[10px] font-bold text-app-text-muted italic col-span-full">Belum ada daftar rekening bank toko. Pembayaran transfer akan fall back menggunakan Info Rekening struk di atas.</p>
                  )}
               </div>
             </div>

             {/* MULTI E-WALLET TOKO ONLINE */}
             <div className="mt-8 pt-8 border-t border-app-border space-y-4">
               <h3 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                 <Wallet className="text-accent" size={16} /> Daftar Akun E-Wallet Toko (Multi E-Wallet Toko Online)
               </h3>
               <p className="text-[10px] text-app-text-muted font-medium mb-4">Merchant dapat mendaftarkan beberapa nomor akun e-wallet untuk metode pembayaran e-wallet pada toko online.</p>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 items-end bg-background/30 p-5 rounded-2xl border border-app-border">
                  <div className="space-y-1">
                     <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Nama E-Wallet</label>
                     <input 
                       type="text" 
                       id="new-store-ewallet-name"
                       placeholder="e.g. DANA, OVO, GOPAY"
                       className="w-full p-2.5 bg-background border border-app-border rounded-xl text-xs text-foreground font-bold focus:outline-none focus:border-accent"
                     />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Nomor HP / Akun</label>
                     <input 
                       type="text" 
                       id="new-store-ewallet-phone"
                       placeholder="e.g. 08123456789"
                       className="w-full p-2.5 bg-background border border-app-border rounded-xl text-xs text-foreground font-bold focus:outline-none focus:border-accent"
                     />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Atas Nama (Pemilik)</label>
                     <input 
                       type="text" 
                       id="new-store-ewallet-holder"
                       placeholder="e.g. Budi"
                       className="w-full p-2.5 bg-background border border-app-border rounded-xl text-xs text-foreground font-bold focus:outline-none focus:border-accent"
                     />
                  </div>
                  <div className="col-span-full flex justify-end">
                     <button
                       type="button"
                       onClick={() => {
                         const nameEl = document.getElementById('new-store-ewallet-name') as HTMLInputElement;
                         const phoneEl = document.getElementById('new-store-ewallet-phone') as HTMLInputElement;
                         const holderEl = document.getElementById('new-store-ewallet-holder') as HTMLInputElement;
                         if (!nameEl.value || !phoneEl.value || !holderEl.value) {
                           toast.error('Semua kolom e-wallet harus diisi!');
                           return;
                         }
                         const newEwallet = {
                           id: Date.now().toString(),
                           ewalletName: nameEl.value.trim(),
                           phoneNumber: phoneEl.value.trim(),
                           accountHolder: holderEl.value.trim()
                         };
                         setSettings(prev => ({
                           ...prev,
                           storeEwallets: [...(prev.storeEwallets || []), newEwallet]
                         }));
                         nameEl.value = '';
                         phoneEl.value = '';
                         holderEl.value = '';
                         toast.success('Akun e-wallet berhasil ditambahkan ke daftar');
                       }}
                       className="py-2.5 px-5 bg-accent hover:bg-accent/80 text-foreground rounded-xl font-black transition-all flex items-center gap-1 active:scale-95 text-[10px] uppercase tracking-widest shadow-md"
                     >
                        <Plus size={14} /> Tambah E-Wallet
                     </button>
                  </div>
               </div>

               {/* List of Added Store E-Wallets */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(settings.storeEwallets || []).map((ewallet: any) => (
                     <div key={ewallet.id} className="p-4 bg-background border border-app-border rounded-2xl flex items-center justify-between group hover:border-accent/20 transition-all">
                        <div className="min-w-0">
                           <span className="px-2 py-0.5 rounded bg-accent/10 text-accent text-[9px] font-black uppercase tracking-wider">{ewallet.ewalletName}</span>
                           <p className="text-xs font-black text-foreground mt-2 truncate">{ewallet.phoneNumber}</p>
                           <p className="text-[10px] font-bold text-app-text-muted mt-0.5 truncate">a.n. {ewallet.accountHolder}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSettings(prev => ({
                              ...prev,
                              storeEwallets: (prev.storeEwallets || []).filter((ew: any) => ew.id !== ewallet.id)
                            }));
                            toast.success('Akun e-wallet dihapus');
                          }}
                          className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                        >
                           <Trash2 size={16} />
                        </button>
                     </div>
                  ))}
                  {(settings.storeEwallets || []).length === 0 && (
                     <p className="text-[10px] font-bold text-app-text-muted italic col-span-full">Belum ada daftar e-wallet toko. Pembayaran e-wallet akan fall back menggunakan foto QRIS toko di atas.</p>
                  )}
               </div>
             </div>
          </div>

          <div className="mt-8 pt-8 border-t border-app-border space-y-6">
            <button 
              type="submit" 
              disabled={isSaving}
              className="flex items-center gap-3 px-8 py-4 bg-accent hover:bg-accent-hover text-foreground rounded-2xl font-black shadow-xl shadow-accent/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={18} />}
              {isSaving ? 'MENYIMPAN...' : 'SIMPAN PERUBAHAN'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-surface border border-app-border rounded-3xl overflow-hidden mt-6 p-5 md:p-8 shadow-xl shadow-black/20 transition-colors duration-300">
        <div className="space-y-6">
          <h2 className="text-lg font-black text-foreground flex items-center gap-3 uppercase tracking-wider">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <ShoppingBag size={18} className="text-emerald-500" />
            </div>
            Link Pemesanan Online
          </h2>
          
          <div className="flex flex-col md:flex-row gap-8 items-start">
             <div className="flex-1 space-y-3">
                <h4 className="text-sm font-black text-foreground uppercase tracking-widest">Akses Publik Pelanggan</h4>
                <p className="text-[11px] font-medium text-app-text-muted leading-relaxed">
                   Bagikan link di bawah ini kepada pelanggan Anda melalui WhatsApp atau Sosial Media. Pelanggan dapat melihat menu favorit, memesan secara online, dan memantau status pesanan mereka secara langsung.
                </p>
                <div className="bg-background border border-app-border p-3 md:p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group">
                   <code className="text-[9px] md:text-[10px] font-bold text-accent truncate w-full sm:flex-1">
                      {onlineOrderUrl || ('/tr?s=' + storeId)}
                   </code>
                   <div className="flex gap-2 w-full sm:w-auto justify-end">
                      <button 
                        onClick={() => {
                          const url = onlineOrderUrl || (window.location.origin + "/tr?s=" + storeId);
                          navigator.clipboard.writeText(url);
                          toast.success('Link berhasil disalin!');
                        }}
                        className="bg-accent/10 hover:bg-accent text-accent hover:text-foreground p-2 rounded-lg transition-all"
                        title="Salin Link"
                      >
                         <Save size={14} />
                      </button>
                      <button 
                        onClick={() => window.open(onlineOrderUrl || ("/tr?s=" + storeId), '_blank')}
                        className="bg-accent/10 hover:bg-accent text-accent hover:text-foreground p-2 rounded-lg transition-all"
                        title="Buka Link"
                      >
                         <Smartphone size={14} />
                      </button>
                   </div>
                </div>


             </div>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-app-border rounded-3xl overflow-hidden mt-6 p-5 md:p-8 shadow-xl shadow-black/20 transition-colors duration-300">
        <div className="space-y-6">
          <h2 className="text-lg font-black text-foreground flex items-center gap-3 uppercase tracking-wider">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Smartphone size={18} className="text-blue-500" />
            </div>
            Alat Pendukung Cetak
          </h2>
          
          <div className="flex flex-col md:flex-row gap-8 items-start">
             <div className="flex-1 space-y-3">
                <h4 className="text-sm font-black text-foreground uppercase tracking-widest">Driver RawBT (Android)</h4>
                <p className="text-[11px] font-medium text-app-text-muted leading-relaxed">
                   Untuk dapat mencetak struk langsung dari browser HP Android ke printer thermal Bluetooth/USB, Anda memerlukan aplikasi <strong className="text-foreground">RawBT</strong>. Aplikasi ini berfungsi sebagai jembatan (driver) komunikasi antara web kasir dan printer Anda.
                </p>
                <div className="flex flex-wrap gap-2 text-[10px] font-bold text-app-text-muted italic">
                   <span>✓ Support Bluetooth</span>
                   <span className="w-1 h-1 bg-app-border rounded-full self-center"></span>
                   <span>✓ Support USB/OTG</span>
                   <span className="w-1 h-1 bg-app-border rounded-full self-center"></span>
                   <span>✓ Support WiFi Printer</span>
                </div>
             </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                 <button
                   onClick={() => handleTestPrint(true)}
                   className="flex items-center justify-center gap-3 px-6 py-4 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-2xl font-black transition-all active:scale-95 text-[10px] uppercase tracking-widest border border-emerald-500/20"
                 >
                    <Printer size={18} />
                    <span>TES CETAK + LOGO</span>
                 </button>

                 <button
                   onClick={() => handleTestPrint(false)}
                   className="flex items-center justify-center gap-3 px-6 py-4 bg-slate-500/10 hover:bg-slate-500 text-slate-500 hover:text-white rounded-2xl font-black transition-all active:scale-95 text-[10px] uppercase tracking-widest border border-slate-500/20"
                 >
                    <Printer size={18} />
                    <span>TES CETAK POLOS</span>
                 </button>

                 <a 
                   href="https://drive.google.com/file/d/15WKt6yuNjMpuTMNKLGSxpuQIR7iMGaJO/view?usp=drive_link" 
                   target="_blank"
                   rel="noopener noreferrer"
                   className="flex items-center justify-center gap-3 px-8 py-5 bg-accent hover:bg-accent-hover text-white rounded-2xl font-black shadow-xl shadow-accent/20 transition-all active:scale-95 text-[10px] uppercase tracking-[0.2em]"
                 >
                    <Download size={18} className="text-white" />
                    <span className="text-white">UNDUH APK RAWBT</span>
                 </a>
              </div>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-app-border rounded-3xl overflow-hidden mt-6 p-5 md:p-8 shadow-xl shadow-black/20 transition-colors duration-300">
        <div className="space-y-6">
          <h2 className="text-lg font-black text-foreground flex items-center gap-3 uppercase tracking-wider">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <Bell size={18} className="text-indigo-500" />
            </div>
            Pusat Notifikasi Latar Belakang
            <span className={`ml-3 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
              swStatus === 'Activated' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' :
              swStatus === 'Checking' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 animate-pulse' :
              'bg-rose-500/10 border-rose-500/30 text-rose-500'
            }`}>
              {swStatus === 'Activated' ? 'SISTEM SIAP' : 
               swStatus === 'Checking' ? 'MENGECEK...' : 
               swStatus === 'Not Registered' ? 'BELUM TERHUBUNG' : 'ERROR SW'}
            </span>
          </h2>
          
          <div className="flex flex-col md:flex-row gap-8 items-start">
             <div className="flex-1 space-y-3">
                <h4 className="text-sm font-black text-foreground uppercase tracking-widest">Peringatan Pesanan Online</h4>
                <p className="text-[11px] font-medium text-app-text-muted leading-relaxed">
                   Aplikasi secara otomatis memiliki kemampuan memonitor pesanan masuk dan meneriakannya melalui **Push Notification / Pop-up** handphone Anda meskipun aplikasi ini sedang diminimize. Fitur ini memerlukan "Izin (Permission)" dari perangkat.
                </p>
             </div>
             
              <div className="flex flex-col md:flex-row gap-3">
                <button 
                  onClick={testNotification}
                  className="w-full md:w-auto flex items-center justify-center gap-3 px-6 py-4 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-500 hover:text-white rounded-2xl font-black transition-all active:scale-95 text-[10px] uppercase tracking-widest"
                >
                   <Bell size={18} />
                   <span>TES NOTIFIKASI</span>
                </button>
                
                <button 
                  onClick={handleResetPWA}
                  className="w-full md:w-auto flex items-center justify-center gap-3 px-6 py-4 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-2xl font-black transition-all active:scale-95 text-[10px] uppercase tracking-widest"
                  title="Gunakan ini jika notifikasi macet setelah ganti domain"
                >
                   <RotateCcw size={18} />
                   <span>RESET KONEKSI & NOTIFIKASI</span>
                </button>
              </div>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-app-border rounded-3xl overflow-hidden mt-6 p-5 md:p-8 shadow-xl shadow-black/20 transition-colors duration-300">
        <form onSubmit={handlePasswordChange} className="space-y-6">
          <h2 className="text-lg font-black text-foreground flex items-center gap-3 uppercase tracking-wider">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center">
              <Key size={18} className="text-rose-500" />
            </div>
            Keamanan (Ubah Sandi Akun)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
             <div className="space-y-2">
                <label className="block text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Kata Sandi Lama</label>
                <input 
                  type="password"
                  required
                  value={passwordState.oldPassword}
                  onChange={e => setPasswordState(prev => ({ ...prev, oldPassword: e.target.value }))}
                  className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all placeholder:text-app-text-muted/30"
                  placeholder="••••••"
                />
             </div>
             <div className="space-y-2">
                <label className="block text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Kata Sandi Baru</label>
                <input 
                  type="password"
                  required
                  value={passwordState.newPassword}
                  onChange={e => setPasswordState(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all placeholder:text-app-text-muted/30"
                  placeholder="Minimal 6 karakter"
                />
             </div>
             <div className="space-y-2">
                <label className="block text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Konfirmasi Sandi Baru</label>
                <input 
                  type="password"
                  required
                  value={passwordState.confirmPassword}
                  onChange={e => setPasswordState(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full p-4 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all placeholder:text-app-text-muted/30"
                  placeholder="Ulangi sandi baru"
                />
             </div>
          </div>
          <div className="flex justify-end pt-2">
             <button 
               type="submit"
               disabled={isChangingPassword}
               className="flex items-center gap-3 px-8 py-4 bg-surface hover:bg-rose-500 border border-app-border hover:border-rose-500 text-foreground hover:text-white rounded-2xl font-black shadow-xl hover:shadow-rose-500/20 transition-all active:scale-95 disabled:opacity-50"
             >
               {isChangingPassword ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={18} />}
               {isChangingPassword ? 'MENYIMPAN...' : 'SIMPAN KATA SANDI BARU'}
             </button>
          </div>
        </form>
      </div>

      <div className="bg-surface border border-app-border rounded-3xl overflow-hidden mt-6 p-5 md:p-8 shadow-xl shadow-black/20 transition-colors duration-300">
        <div className="space-y-6">
          <h2 className="text-lg font-black text-foreground flex items-center gap-3 uppercase tracking-wider">
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
              <Database size={18} className="text-accent" />
            </div>
            Backup & Restore Data
          </h2>
          
          <p className="text-xs font-bold text-app-text-muted leading-relaxed max-w-2xl">
            Simpan cadangan seluruh data toko Anda ke dalam file JSON atau pulihkan data dari file cadangan sebelumnya. 
            <span className="text-amber-500 ml-1">Pastikan Anda tidak mengedit isi file backup secara manual.</span>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="p-6 bg-background/50 border border-app-border rounded-[2rem] space-y-4">
               <div>
                  <h4 className="text-sm font-black text-foreground uppercase tracking-widest mb-1">Export Data</h4>
                  <p className="text-[10px] font-bold text-app-text-muted italic">Unduh file cadangan semua koleksi data.</p>
               </div>
               <button 
                onClick={handleExport}
                disabled={isBackuping || isRestoring}
                className="w-full flex items-center justify-center gap-3 py-4 bg-surface hover:bg-background border border-app-border rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
               >
                  {isBackuping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download size={18} />}
                  {isBackuping ? 'MENYIAPKAN...' : 'DOWNLOAD BACKUP (JSON)'}
               </button>
            </div>

            <div className="p-6 bg-background/50 border border-app-border rounded-[2rem] space-y-4 border-dashed relative">
               <div>
                  <h4 className="text-sm font-black text-foreground uppercase tracking-widest mb-1">Restore Data</h4>
                  <p className="text-[10px] font-bold text-rose-500 italic">Peringatan: Data yang ada mungkin akan tertimpa.</p>
               </div>
               
               {isRestoring ? (
                  <div className="space-y-3">
                     <div className="h-2 w-full bg-surface rounded-full overflow-hidden border border-app-border">
                        <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${restoreProgress}%` }}></div>
                     </div>
                     <p className="text-[10px] text-center font-black text-emerald-500 animate-pulse uppercase tracking-[0.2em]">Memulihkan... {restoreProgress}%</p>
                  </div>
               ) : (
                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".json"
                      onChange={handleImport}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      disabled={isBackuping || isRestoring}
                    />
                    <button className="w-full flex items-center justify-center gap-3 py-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                       <UploadCloud size={18} />
                       IMPORT FILE BACKUP
                    </button>
                  </div>
               )}
            </div>
          </div>

          <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-4">
             <AlertTriangle className="text-amber-500 mt-1" size={20} />
             <div>
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Penting</p>
                <p className="text-[10px] font-bold text-amber-500/80 leading-relaxed italic">
                   Proses restore data akan menggabungkan data dari file backup dengan data saat ini di Cloud. Dokumen dengan ID yang sama akan diperbarui nilainya.
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
