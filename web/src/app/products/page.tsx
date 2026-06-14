'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, addDoc, doc, deleteDoc, updateDoc, where, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';
import { Plus, Edit2, Trash2, Search, Package, Loader2, X, Image as ImageIcon, UploadCloud, Camera, CheckSquare, Square, ListPlus, RotateCcw, Check, DownloadCloud, FileStack, Scan, Printer, Sparkles, Calendar, PenTool } from 'lucide-react';
import { logActivity } from '@/lib/activity';
import { Product, ProductExtra } from '@/types';
import Barcode from 'react-barcode';
import BarcodeScanner from '@/components/BarcodeScanner';
import BarcodePrintModal from '@/components/BarcodePrintModal';
import { getInfraConfig } from '@/lib/infraConfig';

export default function ProductsPage() {
  const { storeId, user, role, permissions } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [availableExtras, setAvailableExtras] = useState<ProductExtra[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Barcode Selection States
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);

  const defaultForm: Product = {
    name: '',
    price: 0,
    purchasePrice: 0,
    wholesalePrice: 0,
    stock: 0,
    manageStock: true,
    category: '',
    variation: '',
    unit: 'pcs',
    sku: '',
    barcode: '',
    description: '',
    expiryDate: '',
    entryDate: new Date().toISOString().split('T')[0],
    imageUrl: '',
    hasExtras: false,
    extras: [],
    warrantyDuration: 0,
    warrantyUnit: 'months'
  };

  const [formData, setFormData] = useState<Product>(defaultForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [useAdvancedUnit, setUseAdvancedUnit] = useState(false);
  const [hasExpiryDate, setHasExpiryDate] = useState(false);

  const UNIT_CATEGORIES = [
    { 
      name: 'Pcs', 
      units: [
        { label: 'Pcs (pc)', value: 'pcs' },
        { label: 'Lusin (ls)', value: 'ls' },
        { label: 'Gross (grs)', value: 'grs' }
      ] 
    },
    { 
      name: 'Berat', 
      units: [
        { label: 'Gram (g)', value: 'g' },
        { label: 'Ons (ons)', value: 'ons' },
        { label: 'Kilogram (kg)', value: 'kg' }
      ] 
    },
    { 
      name: 'Volume', 
      units: [
        { label: 'Mililiter (ml)', value: 'ml' },
        { label: 'Liter (L)', value: 'L' }
      ] 
    },
    { 
      name: 'Panjang', 
      units: [
        { label: 'Centimeter (cm)', value: 'cm' },
        { label: 'Meter (m)', value: 'm' }
      ] 
    }
  ];

  const [showScanner, setShowScanner] = useState(false);
  const [scanTarget, setScanTarget] = useState<'search' | 'sku' | 'barcode'>('search');

  // Native Camera States
  const [showCamera, setShowCamera] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!storeId) return;

    const qProducts = query(
      collection(db, 'products'),
      where('storeId', '==', storeId)
    );
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach((doc) => {
        prods.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(prods);
      setIsLoading(false);
    });

    const qExtras = query(
      collection(db, 'product_extras'),
      where('storeId', '==', storeId)
    );
    const unsubExtras = onSnapshot(qExtras, (snapshot) => {
      const exts: ProductExtra[] = [];
      snapshot.forEach((doc) => {
        exts.push({ id: doc.id, ...doc.data() } as ProductExtra);
      });
      setAvailableExtras(exts.filter(e => e.isActive));
    });

    return () => {
      unsubProducts();
      unsubExtras();
    };
  }, [storeId]);

  // Navigation Guard for Modals (Mobile Back Button support)
  useEffect(() => {
    const isAnyModalOpen = isModalOpen || showScanner || showCamera;
    
    if (!isAnyModalOpen) return;

    // Push a dummy state so back button closes modal instead of exiting page
    window.history.pushState({ modalOpen: true }, "");
    
    const handlePopState = (e: PopStateEvent) => {
      // If user presses back button (popstate fires)
      setIsModalOpen(false);
      setShowScanner(false);
      // We check if stopCamera exists before calling to avoid issues with closure
      if (showCamera) setShowCamera(false); 
    };

    window.addEventListener("popstate", handlePopState);
    
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isModalOpen, showScanner, showCamera]);

  // Helper to close modal manually while syncing history
  const handleManualClose = () => {
    if (window.history.state?.modalOpen) {
      window.history.back();
    } else {
      setIsModalOpen(false);
      setShowScanner(false);
      setShowCamera(false);
    }
  };

  const openModal = (product?: Product) => {
    setImageFile(null);
    if (product) {
      setEditId(product.id!);
      setFormData({ ...defaultForm, ...product });
      setImagePreview(product.imageUrl || null);
      // If unit is not default 'pcs', enable advanced unit toggle
      setUseAdvancedUnit(product.unit !== 'pcs' && !!product.unit);
      setHasExpiryDate(!!product.expiryDate);
    } else {
      setEditId(null);
      setFormData(defaultForm);
      setImagePreview(null);
      setUseAdvancedUnit(false);
      setHasExpiryDate(false);
    }
    setIsModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const startCamera = async () => {
    setShowCamera(true);
    setIsCameraLoading(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      alert("Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.");
      setShowCamera(false);
    } finally {
      setIsCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `camera-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const toggleProductSelection = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map(p => p.id!));
    }
  };

  const filteredProducts = products.filter(p => {
    const s = search.toLowerCase().trim();
    if (!s) return true;
    return (
      p.name.toLowerCase().includes(s) || 
      p.category.toLowerCase().includes(s) ||
      (p.sku && p.sku.toLowerCase().includes(s)) ||
      (p.barcode && p.barcode.toLowerCase().includes(s))
    );
  });

  const generateAutomaticSku = () => {
    const { name, category, variation } = formData;
    
    // 1. Get first 3 letters of first word of Category
    const catPart = (category || 'UMUM')
      .trim()
      .split(/\s+/)[0]
      .substring(0, 3)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    // 2. Get first 3 letters of first word of Name
    const namePart = (name || 'PRD')
      .trim()
      .split(/\s+/)[0]
      .substring(0, 3)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    // 3. Variation
    const varPart = (variation || '').trim().toUpperCase();

    // Construct Prefix for sequence lookup
    const prefix = varPart 
      ? `${catPart}-${namePart}-${varPart}-` 
      : `${catPart}-${namePart}-`;

    // 4. Find next sequence
    const existingSkus = products
      .filter(p => p.sku && p.sku.startsWith(prefix))
      .map(p => p.sku!);

    let maxSeq = 0;
    existingSkus.forEach(sku => {
      const parts = sku.split('-');
      const lastPart = parts[parts.length - 1];
      const seq = parseInt(lastPart);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(3, '0');
    const finalSku = `${prefix}${nextSeq}`;
    
    setFormData(prev => ({ ...prev, sku: finalSku }));
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let uploadedUrl = formData.imageUrl;
      
      if (imageFile) {
        const config = await getInfraConfig();
        const uploadData = new FormData();
        uploadData.append('file', imageFile);
        uploadData.append('upload_preset', config.cloudinary_upload_preset || 'kasirpos');

        const cloudName = config.cloudinary_cloud_name || 'dkcjfwbvc';
        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          body: uploadData
        });

        const uploadResult = await uploadRes.json();
        if (uploadRes.ok && uploadResult.secure_url) {
          uploadedUrl = uploadResult.secure_url;
        } else {
          throw new Error(uploadResult.error?.message || 'Gagal unggah foto ke Cloudinary');
        }
      }

      const finalData = { ...formData, imageUrl: uploadedUrl || '' };

      if (editId) {
        await updateDoc(doc(db, 'products', editId), { ...finalData, updatedAt: serverTimestamp() });
        await logActivity({
          userId: auth.currentUser?.uid || 'unknown',
          userName: auth.currentUser?.displayName || auth.currentUser?.email || 'User',
          userEmail: auth.currentUser?.email || '-',
          storeId: storeId || 'unknown',
          action: 'UPDATE_PRODUCT',
          description: `Memperbarui produk: ${finalData.name}`,
          metadata: { productId: editId }
        });
      } else {
        const docRef = await addDoc(collection(db, 'products'), { ...finalData, storeId: storeId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        await logActivity({
          userId: auth.currentUser?.uid || 'unknown',
          userName: auth.currentUser?.displayName || auth.currentUser?.email || 'User',
          userEmail: auth.currentUser?.email || '-',
          storeId: storeId || 'unknown',
          action: 'CREATE_PRODUCT',
          description: `Menambahkan produk: ${finalData.name}`,
          metadata: { productId: docRef.id }
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan produk');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteProduct = async (id: string) => {
    if (user?.email === 'demo@kasirpro.com') {
      alert('Tindakan Terkunci: Akun Demo tidak memiliki izin untuk menghapus data barang demi menjaga keamanan data uji coba.');
      return;
    }

    if (confirm('Yakin ingin menghapus produk ini?')) {
      try {
        const prodToRemove = products.find(p => p.id === id);
        await deleteDoc(doc(db, 'products', id));
        await logActivity({
          userId: auth.currentUser?.uid || 'unknown',
          userName: auth.currentUser?.displayName || auth.currentUser?.email || 'User',
          userEmail: auth.currentUser?.email || '-',
          storeId: storeId || 'unknown',
          action: 'DELETE_PRODUCT',
          description: `Menghapus produk: ${prodToRemove?.name || 'ID ' + id}`,
          metadata: { productId: id }
        });
        alert('Produk berhasil dihapus!');
      } catch (err) {
        alert('Gagal menghapus produk');
      }
    }
  };

  const handleBarcodeScan = (data: string) => {
    if (scanTarget === 'search') {
      setSearch(data);
    } else if (scanTarget === 'sku') {
      setFormData(prev => ({ ...prev, sku: data }));
    } else if (scanTarget === 'barcode') {
       setFormData(prev => ({ ...prev, barcode: data }));
    }
    setShowScanner(false);
  };

  const openScanner = (target: 'search' | 'sku' | 'barcode') => {
    stopCamera();
    setScanTarget(target);
    setShowScanner(true);
  };

  const exportToCSV = () => {
    if (products.length === 0) return alert('Tidak ada data produk untuk diekspor.');

    const headers = ['Nama', 'Kategori', 'Harga Jual', 'Harga Beli', 'Stok', 'Satuan', 'SKU', 'Barcode', 'Deskripsi', 'URL Gambar'];
    const rows = products.map(p => [
      p.name,
      p.category || '',
      p.price,
      p.purchasePrice || 0,
      p.stock,
      p.unit || 'pcs',
      p.sku || '',
      p.barcode || '',
      p.description || '',
      p.imageUrl || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `daftar_produk_${new Date().toLocaleDateString('id-ID')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length <= 1) throw new Error('File CSV kosong atau tidak valid.');

        // Simple CSV Parser (handling quoted values)
        const parseLine = (line: string) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const headers = parseLine(lines[0]);
        const dataRows = lines.slice(1);

        const { writeBatch } = await import('firebase/firestore');
        let batch = writeBatch(db);
        let count = 0;
        let successCount = 0;
        let skipCount = 0;
        const skippedNames: string[] = [];

        // Pre-build sets for fast lookup from existing products
        const existingSkus = new Set(products.map(p => p.sku?.trim().toLowerCase()).filter(Boolean));
        const existingBarcodes = new Set(products.map(p => p.barcode?.trim().toLowerCase()).filter(Boolean));
        const existingNames = new Set(products.map(p => p.name?.trim().toLowerCase()).filter(Boolean));

        for (const line of dataRows) {
          const values = parseLine(line);
          if (values.length < headers.length) continue;

          // Mapping index based on template headers logic
          // Template: Nama, Kategori, Harga Jual, Harga Beli, Stok, Satuan, SKU, Barcode, Deskripsi, URL Gambar
          const [name, category, price, pPrice, stock, unit, sku, barcode, description, imageUrl] = values;

          if (!name) continue;

          const trimName = name.trim();
          const trimSku = sku?.trim() || '';
          const trimBarcode = barcode?.trim() || '';

          // DUPLICATE CHECK
          const isDuplicate = 
            existingNames.has(trimName.toLowerCase()) || 
            (trimSku && existingSkus.has(trimSku.toLowerCase())) ||
            (trimBarcode && existingBarcodes.has(trimBarcode.toLowerCase()));

          if (isDuplicate) {
            skipCount++;
            if (skippedNames.length < 5) skippedNames.push(trimName);
            continue;
          }

          const newProd: Product = {
            name: trimName,
            category: category || 'Umum',
            price: Number(price) || 0,
            purchasePrice: Number(pPrice) || 0,
            stock: Number(stock) || 0,
            unit: unit || 'pcs',
            sku: trimSku,
            barcode: trimBarcode,
            description: description || '',
            imageUrl: imageUrl || '',
            manageStock: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            storeId: storeId
          };

          const newDocRef = doc(collection(db, 'products'));
          batch.set(newDocRef, newProd);
          
          // Add to local sets to prevent duplicates within the same CSV file
          existingNames.add(trimName.toLowerCase());
          if (trimSku) existingSkus.add(trimSku.toLowerCase());
          if (trimBarcode) existingBarcodes.add(trimBarcode.toLowerCase());

          count++;
          successCount++;

          if (count === 499) { // Firebase batch limit is 500
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }

        if (count > 0) await batch.commit();

        // Log Import
        await logActivity({
          userId: auth.currentUser?.uid || 'unknown',
          userName: auth.currentUser?.displayName || auth.currentUser?.email || 'User',
          userEmail: auth.currentUser?.email || '-',
          storeId: storeId || 'unknown',
          action: 'IMPORT_PRODUCT',
          description: `Berhasil mengimpor ${successCount} produk baru melalui CSV.`
        });

        let message = `Impor Selesai!\n- ${successCount} Produk baru berhasil ditambahkan.`;
        if (skipCount > 0) {
          message += `\n- ${skipCount} Produk dilewati (Sudah ada di database).\nContoh: ${skippedNames.join(', ')}${skipCount > 5 ? '...' : ''}`;
        }
        alert(message);
      } catch (err: any) {
        console.error(err);
        alert('Gagal impor CSV: ' + err.message);
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 md:space-y-6 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-accent/10 rounded-2xl shrink-0">
              <Package className="w-8 h-8 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Daftar Produk</h1>
              <p className="text-xs md:text-app-text-muted">Kelola inventaris Anda</p>
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              onChange={handleImport} 
              className="hidden" 
            />
            {permissions?.canCreateProducts && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="flex items-center gap-2 bg-surface border border-app-border hover:border-accent text-app-text-muted hover:text-accent px-3 md:px-4 py-2 md:py-2.5 rounded-xl font-bold transition-all shrink-0"
              >
                <FileStack size={16} />
                <span className="text-[10px] md:text-xs">Impor</span>
              </button>
            )}
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-surface border border-app-border hover:border-accent text-app-text-muted hover:text-accent px-3 md:px-4 py-2 md:py-2.5 rounded-xl font-bold transition-all shrink-0"
            >
              <DownloadCloud size={16} />
              <span className="text-[10px] md:text-xs">Ekspor</span>
            </button>
            {permissions?.canCreateProducts && (
              <button 
                onClick={() => openModal()}
                className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-foreground px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-bold shadow-lg shadow-accent/20 transition-all shrink-0 ml-1"
              >
                <Plus size={18} /> <span className="text-[10px] md:text-xs">Tambah</span>
              </button>
            )}
            <button 
              onClick={() => setIsBarcodeModalOpen(true)}
              disabled={products.length === 0}
              className="flex items-center gap-2 bg-background border border-app-border hover:border-accent text-app-text-muted hover:text-accent px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-bold transition-all shrink-0 disabled:opacity-50"
            >
              <Printer size={18} /> <span className="text-[10px] md:text-xs">Cetak Barcode</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="md:col-span-3 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted group-focus-within:text-accent transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Cari produk..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 md:py-4 bg-surface border border-app-border rounded-2xl text-foreground focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all font-medium text-sm"
            />
            <button 
              onClick={() => openScanner('search')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-accent p-2"
              title="Scan Produk"
            >
              <Scan size={20} />
            </button>
          </div>
          <div className="bg-surface border border-app-border rounded-2xl px-4 py-2 flex items-center justify-between shadow-inner h-[50px] md:h-auto">
            <span className="text-[10px] md:text-sm font-bold text-app-text-muted uppercase tracking-wider">Total: {products.length}</span>
            <div className="h-4 md:h-8 w-px bg-app-border mx-2"></div>
            <span className="text-[10px] md:text-sm font-bold text-accent uppercase tracking-widest">Aktif</span>
          </div>
        </div>

        <div className="bg-surface border border-app-border rounded-3xl overflow-hidden shadow-xl">
          {/* Desktop Table View */}
          <table className="w-full text-left border-collapse hidden md:table">
            <thead>
              <tr className="bg-background/50 border-b border-app-border">
                <th className="p-5 w-10">
                  <button 
                    onClick={toggleSelectAll}
                    className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all ${
                      selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0
                        ? 'bg-accent border-accent text-foreground'
                        : 'border-app-border hover:border-accent/50'
                    }`}
                  >
                    {selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0 ? <Check size={14} strokeWidth={3} /> : null}
                  </button>
                </th>
                <th className="p-5 text-xs font-bold text-app-text-muted uppercase tracking-widest">Barang</th>
                <th className="p-5 text-xs font-bold text-app-text-muted uppercase tracking-widest">Kategori</th>
                <th className="p-5 text-xs font-bold text-app-text-muted uppercase tracking-widest">Deskripsi</th>
                <th className="p-5 text-xs font-bold text-app-text-muted uppercase tracking-widest">Harga</th>
                <th className="p-5 text-xs font-bold text-app-text-muted uppercase tracking-widest">Stok</th>
                <th className="p-5 text-xs font-bold text-app-text-muted uppercase tracking-widest">Tgl Masuk</th>
                <th className="p-5 text-xs font-bold text-app-text-muted uppercase tracking-widest">Nilai Modal</th>
                <th className="p-5 text-xs font-bold text-app-text-muted uppercase tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                       <Loader2 className="w-12 h-12 animate-spin text-accent" />
                       <p className="text-app-text-muted font-medium animate-pulse">Menghubungkan ke pusat data...</p>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-20 text-center text-app-text-muted">
                    <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg">Belum ada produk terdaftar</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className={`hover:bg-accent/5 transition-colors group ${selectedProductIds.includes(product.id!) ? 'bg-accent/5' : ''}`}>
                    <td className="p-5">
                      <button 
                        onClick={() => toggleProductSelection(product.id!)}
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                          selectedProductIds.includes(product.id!)
                            ? 'bg-accent border-accent text-foreground'
                            : 'border-app-border hover:border-accent group-hover:bg-background shadow-inner'
                        }`}
                      >
                        {selectedProductIds.includes(product.id!) ? <Check size={14} strokeWidth={4} /> : null}
                      </button>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-background border border-app-border rounded-xl overflow-hidden shadow-sm flex-shrink-0 group-hover:border-accent/30 transition-colors">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-app-text-muted opacity-30">
                              <ImageIcon size={24} />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-foreground text-lg leading-snug">{product.name}</p>
                          <p className="text-xs text-app-text-muted font-mono uppercase mt-1">SKU: {product.sku || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <span className="px-3 py-1 bg-accent/10 text-accent rounded-md text-xs font-bold border border-accent/20 shadow-sm">
                        {product.category || 'Umum'}
                      </span>
                    </td>
                    <td className="p-5 max-w-[200px]">
                      <p className="text-xs text-app-text-muted line-clamp-2" title={product.description || '-'}>
                        {product.description || '-'}
                      </p>
                    </td>
                    <td className="p-5">
                      <p className="text-emerald-400 font-bold text-lg">Rp {product.price.toLocaleString('id-ID')}</p>
                      {product.wholesalePrice ? (
                        <p className="text-[10px] text-app-text-muted mt-0.5">Grosir: Rp {product.wholesalePrice.toLocaleString('id-ID')}</p>
                      ) : null}
                    </td>
                    <td className="p-5">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-sm ${product.stock <= 5 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                        <p className={`font-bold ${product.stock <= 5 ? 'text-rose-400' : 'text-foreground'}`}>
                          {product.stock} <span className="text-xs font-normal text-app-text-muted ml-0.5">{product.unit || 'pcs'}</span>
                        </p>
                      </div>
                    </td>
                    <td className="p-5">
                      <p className="text-xs font-black text-foreground opacity-80">
                        {product.entryDate ? new Date(product.entryDate).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: '2-digit'}) : '-'}
                      </p>
                    </td>
                    <td className="p-5">
                      <p className="text-foreground font-black text-sm tracking-tight opacity-80">
                        Rp {((product.stock || 0) * (product.purchasePrice || 0)).toLocaleString('id-ID')}
                      </p>
                      <p className="text-[8px] font-black uppercase text-app-text-muted tracking-widest">Total Modal</p>
                    </td>
                    <td className="p-5 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {permissions?.canEditProducts && (
                          <button onClick={() => openModal(product)} className="p-2.5 bg-background border border-app-border text-blue-400 hover:bg-blue-600/10 rounded-xl transition-all"><Edit2 size={18} /></button>
                        )}
                        {permissions?.canDeleteProducts && (
                          <button onClick={() => deleteProduct(product.id!)} className="p-2.5 bg-background border border-app-border text-rose-400 hover:bg-rose-600/10 rounded-xl transition-all"><Trash2 size={18} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-app-border">
            {isLoading ? (
              <div className="p-20 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-accent mx-auto mb-4" />
                <p className="text-app-text-muted font-bold animate-pulse">Memuat data...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="p-20 text-center text-app-text-muted italic">
                Belum ada produk terdaftar
              </div>
            ) : (
              filteredProducts.map((product) => (
                <div key={product.id} className={`p-3 flex gap-3 hover:bg-accent/5 transition-colors items-center ${selectedProductIds.includes(product.id!) ? 'bg-accent/5' : ''}`}>
                  <button 
                    onClick={() => toggleProductSelection(product.id!)}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                      selectedProductIds.includes(product.id!)
                        ? 'bg-accent border-accent text-foreground'
                        : 'border-app-border bg-background'
                    }`}
                  >
                    {selectedProductIds.includes(product.id!) ? <Check size={12} strokeWidth={4} /> : null}
                  </button>
                  <div className="w-16 h-16 bg-background border border-app-border rounded-xl overflow-hidden shrink-0">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-app-text-muted opacity-20">
                        <ImageIcon size={20} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                       <div className="min-w-0">
                          <h3 className="font-black text-foreground text-[13px] truncate leading-tight mb-0.5">{product.name}</h3>
                          <p className="text-[9px] text-app-text-muted uppercase font-bold tracking-widest">{product.category || 'Umum'}</p>
                          {product.description && (
                            <p className="text-[10px] text-app-text-muted mt-1 line-clamp-1 italic">
                              {product.description}
                            </p>
                          )}
                       </div>
                       <div className="flex gap-1 shrink-0">
                          {permissions?.canEditProducts && (
                            <button onClick={() => openModal(product)} className="p-2 text-accent bg-accent/10 rounded-lg hover:bg-accent/20 transition-all"><Edit2 size={12} /></button>
                          )}
                          {permissions?.canDeleteProducts && (
                            <button onClick={() => deleteProduct(product.id!)} className="p-2 text-rose-500 bg-rose-500/10 rounded-lg hover:bg-rose-500/20 transition-all"><Trash2 size={12} /></button>
                          )}
                       </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-app-border/30">
                       <p className="text-emerald-400 font-black text-sm tracking-tighter">Rp {product.price.toLocaleString('id-ID')}</p>
                       <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${product.stock <= 5 ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-accent/5 border-app-border text-app-text-muted'}`}>
                          <span className={`w-1.5 h-1.5 rounded-sm ${product.stock <= 5 ? 'bg-rose-500 animate-pulse' : 'bg-accent'}`}></span>
                          <p className="text-[10px] font-black uppercase tracking-tighter">
                            {product.stock} <span className="opacity-50 lowercase">{product.unit || 'pcs'}</span>
                          </p>
                       </div>
                    </div>
                    
                    <div className="mt-2 pt-2 border-t border-app-border/20 flex flex-col gap-1.5">
                       <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                          <span className="text-app-text-muted">Tgl Masuk</span>
                          <span className="text-foreground">{product.entryDate ? new Date(product.entryDate).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: '2-digit'}) : '-'}</span>
                       </div>
                       <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                          <span className="text-app-text-muted">Nilai Modal</span>
                          <span className="font-bold text-foreground">Rp {((product.stock || 0) * (product.purchasePrice || 0)).toLocaleString('id-ID')}</span>
                       </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      {/* Floating Selection Bar */}
      {selectedProductIds.length > 0 && (
        <div className="fixed bottom-28 md:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 duration-500 w-[92vw] md:w-auto max-w-lg">
          <div className="bg-foreground text-background px-4 md:px-6 py-3 md:py-4 rounded-2xl shadow-2xl flex items-center justify-between md:justify-start gap-3 md:gap-6 border border-white/10 backdrop-blur-xl">
            <div className="flex items-center gap-2 md:gap-3 pr-3 md:pr-6 border-r border-white/10">
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-md bg-accent flex items-center justify-center font-black text-foreground text-xs md:text-sm">
                {selectedProductIds.length}
              </div>
              <p className="text-[10px] md:text-xs font-black uppercase tracking-widest whitespace-nowrap">Terpilih</p>
            </div>
            
            <div className="flex items-center gap-2 md:gap-3">
              <button 
                onClick={() => setSelectedProductIds([])}
                className="px-3 md:px-4 py-2 hover:bg-white/10 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all"
              >
                Batal
              </button>
              <button 
                onClick={() => setIsBarcodeModalOpen(true)}
                className="px-4 md:px-6 py-2 bg-accent hover:bg-accent-hover text-foreground rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-accent/20 flex items-center gap-2"
              >
                <Printer size={14} className="md:w-4 md:h-4" />
                Cetak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Print Modal */}
      <BarcodePrintModal 
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        products={selectedProductIds.length > 0 
          ? products.filter(p => selectedProductIds.includes(p.id!))
          : products
        }
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-app-border rounded-2xl md:rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="p-4 md:p-6 border-b border-app-border flex items-center justify-between bg-surface shrink-0 z-20">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-2 bg-accent/10 rounded-lg">
                  {editId ? <Edit2 className="text-accent" size={20} /> : <Plus className="text-accent" size={20} />}
                </div>
                <h2 className="text-sm md:text-xl font-bold text-foreground tracking-tight">{editId ? 'Sempurnakan Detail' : 'Produk Baru'}</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-app-text-muted hover:text-foreground transition-colors p-2 hover:bg-background rounded-lg border border-transparent hover:border-app-border"><X size={24} /></button>
            </div>
            
            <form onSubmit={saveProduct} className="flex-1 overflow-y-auto p-5 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                {/* Image Section */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-app-text-muted mb-2">Foto Produk Utama</label>
                    <div className="w-full aspect-square bg-background border-2 border-dashed border-app-border rounded-xl relative overflow-hidden group hover:border-accent transition-colors flex flex-col items-center justify-center">
                      {imagePreview ? (
                        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${imagePreview})` }}>
                        </div>
                      ) : (
                        <div className="text-center p-4">
                          <UploadCloud className="w-10 h-10 text-app-text-muted mx-auto mb-2 group-hover:text-accent transition-colors" />
                          <p className="text-xs text-app-text-muted font-medium">Klik Area ini untuk Foto atau Pilih File</p>
                        </div>
                      )}
                      {/* Invisible Input covering the area */}
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageChange}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      />
                    </div>
                    
                    <button 
                      type="button" 
                      onClick={startCamera}
                      className="w-full mt-2 flex items-center justify-center gap-2 py-3 bg-accent/10 hover:bg-accent/20 text-accent rounded-xl transition-all font-bold border border-accent/30"
                    >
                      <Camera size={18} /> Buka Kamera (Real-time)
                    </button>

                    <div className="mt-4 space-y-1">
                      <label className="block text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Atau Lampirkan URL Gambar</label>
                      <input 
                        type="text" 
                        value={formData.imageUrl || ''} 
                        onChange={e => {
                          setFormData({...formData, imageUrl: e.target.value});
                          setImagePreview(e.target.value || null);
                          setImageFile(null); // Clear file if URL is being used
                        }}
                        placeholder="https://example.com/image.jpg"
                        className="w-full p-3 bg-background border border-app-border rounded-xl text-xs font-bold focus:outline-none focus:border-accent transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-app-text-muted mb-2">Barcode / QR Code</label>
                    <div className="p-4 bg-white rounded-xl shadow-inner border border-app-border flex justify-center min-h-[100px] items-center">
                      {formData.barcode ? (
                         <Barcode value={formData.barcode} width={1.5} height={50} fontSize={12} />
                      ) : (
                        <p className="text-xs text-slate-400 italic">Input barcode di bawah untuk preview</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Details Section */}
                <div className="md:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-app-text-muted mb-1">Nama Barang / Produk</label>
                      <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-background border border-app-border rounded-lg text-foreground focus:outline-none focus:border-accent" placeholder="Contoh: Kopi Gayo 250gr" />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-app-text-muted mb-1">Kategori Utama</label>
                      <div className="relative">
                        <select 
                          required 
                          value={formData.category || 'Umum'} 
                          onChange={e => {
                            if (e.target.value !== '_custom') {
                              setFormData({...formData, category: e.target.value});
                            } else {
                              const custom = prompt('Masukkan Kategori Baru:');
                              if (custom) setFormData({...formData, category: custom});
                            }
                          }} 
                          className="w-full p-3 bg-background border border-app-border rounded-lg text-foreground focus:outline-none focus:border-accent appearance-none pr-10"
                        >
                          <option value="Umum">Umum</option>
                          <option value="Makanan">Makanan</option>
                          <option value="Minuman">Minuman</option>
                          <option value="Snack">Snack</option>
                          <option value="Bahan Baku">Bahan Baku</option>
                          <option value="Aksesoris">Aksesoris</option>
                          <option value="Jasa">Jasa</option>
                          {formData.category && !['Umum', 'Makanan', 'Minuman', 'Snack', 'Bahan Baku', 'Aksesoris', 'Jasa'].includes(formData.category) && (
                            <option value={formData.category}>{formData.category}</option>
                          )}
                          <option value="_custom">+ Kategori Lainnya...</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-app-text-muted">
                           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/></svg>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-app-text-muted mb-1">Variasi (Warna/Ukuran)</label>
                      <input type="text" value={formData.variation || ''} onChange={e => setFormData({...formData, variation: e.target.value})} className="w-full p-3 bg-background border border-app-border rounded-lg text-foreground focus:outline-none focus:border-accent" placeholder="Contoh: 32, Merah, XL" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-app-text-muted">Satuan</label>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-app-text-muted uppercase">Kostum</span>
                          <label className="relative inline-flex items-center cursor-pointer scale-75">
                            <input type="checkbox" checked={useAdvancedUnit} onChange={e => {
                              const enabled = e.target.checked;
                              setUseAdvancedUnit(enabled);
                              if (!enabled) setFormData({...formData, unit: 'pcs'});
                            }} className="sr-only peer" />
                            <div className="w-11 h-6 bg-app-border peer-focus:outline-none rounded-md peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-sm after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                          </label>
                        </div>
                      </div>

                      {!useAdvancedUnit ? (
                        <div className="p-3 bg-background border border-app-border rounded-lg text-foreground font-bold flex items-center justify-between opacity-80">
                          <span>Pcs (pcs)</span>
                          <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded">DEFAULT</span>
                        </div>
                      ) : (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                           {UNIT_CATEGORIES.map(category => (
                             <div key={category.name} className="space-y-1.5">
                                <p className="text-[10px] font-black text-app-text-muted uppercase tracking-tighter ml-1">{category.name}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {category.units.map(u => (
                                    <button
                                      key={u.value}
                                      type="button"
                                      onClick={() => setFormData({...formData, unit: u.value})}
                                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${formData.unit === u.value ? 'bg-accent border-accent text-foreground shadow-lg shadow-accent/20' : 'bg-background border-app-border text-app-text-muted hover:border-accent/30'}`}
                                    >
                                      {u.label}
                                    </button>
                                  ))}
                                </div>
                             </div>
                           ))}
                           <div className="pt-2">
                              <p className="text-[10px] font-black text-app-text-muted uppercase tracking-tighter mb-1.5 ml-1">Kustom Lainnya</p>
                              <input 
                                type="text" 
                                value={formData.unit} 
                                onChange={e => setFormData({...formData, unit: e.target.value})} 
                                className="w-full p-3 bg-background border border-app-border rounded-lg text-xs font-bold text-foreground focus:outline-none focus:border-accent" 
                                placeholder="Contoh: box, koli, sachet, dll" 
                              />
                           </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-app-text-muted mb-1">SKU (Kode Stok)</label>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="text" 
                          value={formData.sku} 
                          onChange={e => setFormData({...formData, sku: e.target.value})} 
                          className="flex-1 min-w-0 p-3 bg-background border border-app-border rounded-lg text-foreground focus:outline-none focus:border-accent" 
                        />
                        <button 
                          type="button" 
                          onClick={generateAutomaticSku}
                          className="shrink-0 px-3 py-3 bg-accent text-foreground rounded-lg font-bold hover:bg-accent-hover transition-colors flex items-center gap-1.5 text-xs shadow-lg shadow-accent/20"
                          title="Generate Otomatis"
                        >
                          <Sparkles size={14} /> <span>AUTO</span>
                        </button>
                        <button 
                          type="button" 
                          onClick={() => openScanner('sku')}
                          className="shrink-0 p-3 bg-accent/10 text-accent rounded-lg border border-accent/20 hover:bg-accent/20 transition-colors"
                        >
                          <Scan size={18} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-app-text-muted mb-1">Barcode</label>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="text" 
                          value={formData.barcode} 
                          onChange={e => setFormData({...formData, barcode: e.target.value})} 
                          className="flex-1 min-w-0 p-3 bg-background border border-app-border rounded-lg text-foreground focus:outline-none focus:border-accent" 
                        />
                        <button 
                          type="button" 
                          onClick={() => openScanner('barcode')}
                          className="shrink-0 p-3 bg-accent/10 text-accent rounded-lg border border-accent/20 hover:bg-accent/20 transition-colors"
                        >
                          <Scan size={18} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-app-text-muted mb-1">Harga Beli / Modal (Rp)</label>
                      <input required type="number" min={0} value={formData.purchasePrice === 0 ? '' : formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: Number(e.target.value)})} placeholder="0" className="w-full p-3 bg-background border border-app-border rounded-lg text-foreground focus:outline-none focus:border-accent" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-accent mb-1">Harga Jual Reguler (Rp)</label>
                      <input required type="number" min={0} value={formData.price === 0 ? '' : formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} placeholder="0" className="w-full p-3 bg-background border border-accent/50 rounded-lg text-foreground focus:outline-none focus:border-accent shadow-[0_0_15px_rgba(var(--app-accent),0.1)]" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-app-text-muted mb-1">Harga Grosir (Rp)</label>
                      <input type="number" min={0} value={formData.wholesalePrice === 0 ? '' : formData.wholesalePrice} onChange={e => setFormData({...formData, wholesalePrice: Number(e.target.value)})} placeholder="Opsional (0)" className="w-full p-3 bg-background border border-app-border rounded-lg text-foreground focus:outline-none focus:border-accent" />
                    </div>
                  </div>

                  <div className="bg-background/50 p-4 border border-app-border rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Package size={20} className="text-accent" />
                        <div>
                          <label htmlFor="manageStock" className="text-sm font-bold text-foreground cursor-pointer select-none block">
                            Kelola Stok Barang (Inventaris)
                          </label>
                          <p className="text-[10px] text-app-text-muted font-medium">Matikan jika barang ini tidak terbatas (Jasa/Makanan)</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="manageStock" checked={formData.manageStock !== false} onChange={e => setFormData({...formData, manageStock: e.target.checked})} className="sr-only peer" />
                        <div className="w-11 h-6 bg-app-border peer-focus:outline-none rounded-md peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-sm after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>
                    {formData.manageStock !== false && (
                      <>
                        <div className="space-y-2 pt-2 border-t border-app-border/50 animate-in fade-in slide-in-from-top-2 duration-300">
                          <label className="block text-[10px] uppercase font-bold text-app-text-muted tracking-wider mb-1 ml-1">Kuantitas Stok Awal</label>
                          <input 
                            required 
                            type="number" 
                            min={0} 
                            value={formData.stock === 0 ? '' : formData.stock} 
                            onChange={e => setFormData({...formData, stock: Number(e.target.value)})} 
                            placeholder="0" 
                            className="w-full p-3 bg-background border border-app-border rounded-lg text-sm font-bold text-foreground focus:outline-none focus:border-accent" 
                          />
                        </div>

                        <div className="space-y-2 pt-2 border-t border-app-border/50 animate-in fade-in slide-in-from-top-2 duration-300">
                          <label className="block text-[10px] uppercase font-bold text-app-text-muted tracking-wider mb-1 ml-1">Tanggal Masuk Barang</label>
                          <input 
                            required 
                            type="date" 
                            value={formData.entryDate || ''} 
                            onChange={e => setFormData({...formData, entryDate: e.target.value})} 
                            className="w-full p-3 bg-background border border-app-border rounded-lg text-sm font-bold text-foreground focus:outline-none focus:border-accent"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="bg-background/50 p-4 border border-app-border rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Calendar size={20} className="text-accent" />
                        <label className="text-sm font-bold text-foreground cursor-pointer select-none">
                          Aktifkan Masa Berlaku (Expired)
                        </label>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={hasExpiryDate} onChange={e => {
                          setHasExpiryDate(e.target.checked);
                          if (!e.target.checked) setFormData({...formData, expiryDate: ''});
                        }} className="sr-only peer" />
                        <div className="w-11 h-6 bg-app-border peer-focus:outline-none rounded-md peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-sm after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                      </label>
                    </div>

                    {hasExpiryDate && (
                      <div className="space-y-2 pt-2 border-t border-app-border/50 animate-in fade-in slide-in-from-top-2">
                        <label className="block text-[10px] uppercase font-bold text-app-text-muted tracking-wider mb-1 ml-1">Pilih Tanggal Kedaluwarsa</label>
                        <input 
                          required 
                          type="date" 
                          value={formData.expiryDate || ''} 
                          onChange={e => setFormData({...formData, expiryDate: e.target.value})} 
                          className="w-full p-3 bg-background border border-app-border rounded-lg text-sm font-bold text-foreground focus:outline-none focus:border-accent"
                        />
                      </div>
                    )}
                  </div>

                  <div className="bg-background/50 p-4 border border-app-border rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ListPlus size={20} className="text-accent" />
                        <label className="text-sm font-bold text-foreground cursor-pointer select-none">
                          Aktifkan Produk Ekstra
                        </label>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={formData.hasExtras} onChange={e => setFormData({...formData, hasExtras: e.target.checked})} className="sr-only peer" />
                        <div className="w-11 h-6 bg-app-border peer-focus:outline-none rounded-md peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-sm after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                      </label>
                    </div>

                    {formData.hasExtras && (
                      <div className="space-y-2 pt-2 border-t border-app-border/50 animate-in fade-in slide-in-from-top-2">
                        <p className="text-[10px] uppercase font-bold text-app-text-muted tracking-wider mb-2">Pilih Grup Modifier</p>
                        {availableExtras.length === 0 ? (
                          <p className="text-xs text-app-text-muted italic">Belum ada grup ekstra yang aktif. Buat di menu Ekstra terlebih dahulu.</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-1">
                            {availableExtras.map(extra => {
                              const isSelected = formData.extras?.includes(extra.id!);
                              return (
                                <button 
                                  key={extra.id}
                                  type="button"
                                  onClick={() => {
                                    const current = formData.extras || [];
                                    const next = isSelected 
                                      ? current.filter(id => id !== extra.id)
                                      : [...current, extra.id!];
                                    setFormData({...formData, extras: next});
                                  }}
                                  className={`flex items-center gap-3 p-2.5 rounded-lg transition-all border ${isSelected ? 'bg-accent/10 border-accent text-accent' : 'bg-background border-app-border text-app-text-muted hover:border-accent/30'}`}
                                >
                                  {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                  <span className="text-xs font-medium">{extra.name}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                    <div className="bg-background/50 p-4 border border-app-border rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <PenTool size={20} className="text-accent" />
                        <label className="text-sm font-bold text-foreground cursor-pointer select-none">
                          Pengaturan Garansi Produk
                        </label>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={formData.warrantyDuration! > 0} onChange={e => setFormData({...formData, warrantyDuration: e.target.checked ? 1 : 0})} className="sr-only peer" />
                        <div className="w-11 h-6 bg-app-border peer-focus:outline-none rounded-md peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-sm after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                      </label>
                    </div>

                    {formData.warrantyDuration! > 0 && (
                      <div className="space-y-4 pt-2 border-t border-app-border/50 animate-in fade-in slide-in-from-top-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="block text-[10px] uppercase font-bold text-app-text-muted tracking-wider ml-1">Durasi Garansi</label>
                            <input 
                              type="number" 
                              min={1}
                              value={formData.warrantyDuration} 
                              onChange={e => setFormData({...formData, warrantyDuration: Number(e.target.value)})} 
                              className="w-full p-3 bg-background border border-app-border rounded-lg text-sm font-bold text-foreground focus:outline-none focus:border-accent"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] uppercase font-bold text-app-text-muted tracking-wider ml-1">Satuan Waktu</label>
                            <select 
                              value={formData.warrantyUnit} 
                              onChange={e => setFormData({...formData, warrantyUnit: e.target.value as any})} 
                              className="w-full p-3 bg-background border border-app-border rounded-lg text-sm font-bold text-foreground focus:outline-none focus:border-accent"
                            >
                              <option value="days">Hari</option>
                              <option value="months">Bulan</option>
                              <option value="years">Tahun</option>
                            </select>
                          </div>
                        </div>
                        <p className="text-[10px] text-blue-400 italic font-medium px-1">
                          * Masa garansi akan otomatis dihitung sejak tanggal transaksi penjualan.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="pt-6 border-t border-app-border flex justify-end gap-4">
                <button type="button" disabled={isSaving} onClick={handleManualClose} className="px-6 py-3 bg-surface border border-app-border hover:bg-background text-foreground rounded-xl font-medium transition-colors disabled:opacity-50">Batal</button>
                <button type="submit" disabled={isSaving} className="px-8 py-3 flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-foreground rounded-xl font-bold transition-all shadow-lg shadow-accent/30 disabled:opacity-50 active:scale-95">
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  {isSaving ? 'Menyimpan...' : 'Simpan Produk Secara Permanen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showCamera && (
        <CameraOverlay 
          isCameraLoading={isCameraLoading} 
          videoRef={videoRef} 
          canvasRef={canvasRef} 
          onCapture={capturePhoto} 
          onCancel={handleManualClose} 
        />
      )}
      {showScanner && (
        <BarcodeScanner 
          onScan={handleBarcodeScan}
          onClose={handleManualClose}
          title={scanTarget === 'search' ? "Cari Produk" : "Scan SKU/Barcode"}
        />
      )}
    </div>
  );
}

// Sub-component for Camera Overlay
function CameraOverlay({ isCameraLoading, videoRef, canvasRef, onCapture, onCancel }: any) {
  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-lg aspect-[3/4] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        {isCameraLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3 z-10 bg-slate-950">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            <p className="animate-pulse font-medium">Inisialisasi Sensor Kamera...</p>
          </div>
        )}
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Camera UI Elements */}
        {!isCameraLoading && (
          <>
            <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
              <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-white font-bold tracking-widest uppercase border border-white/10">LIVE PREVIEW</div>
            </div>
            
            <div className="absolute bottom-8 left-0 right-0 flex items-center justify-around px-10">
              <button 
                onClick={onCancel}
                className="w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center transition-all backdrop-blur-md"
              >
                <X size={24} />
              </button>
              
              <button 
                onClick={onCapture}
                className="w-20 h-20 bg-white p-1 rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-transform"
              >
                <div className="w-full h-full border-4 border-slate-950 rounded-xl bg-white"></div>
              </button>
              
              <div className="w-12 h-12 flex items-center justify-center">
                {/* Empty space for symmetry or camera switch */}
                <RotateCcw className="text-white/40" size={20} />
              </div>
            </div>
          </>
        )}
      </div>
      <p className="text-slate-500 text-xs mt-6 text-center max-w-xs">Posisikan produk di tengah layar dan tekan tombol putih untuk mengambil foto.</p>
    </div>
  );
}
