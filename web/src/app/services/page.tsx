'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  addDoc,
  updateDoc,
  deleteDoc, 
  orderBy,
  getDoc
} from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { 
  Camera,
  Paperclip,
  Wrench, 
  Trash2, 
  Printer, 
  User, 
  FileText,
  FileSignature, 
  History, 
  CheckCircle2, 
  X, 
  Loader2,
  Calendar,
  Search,
  PlusCircle,
  Clock,
  Phone,
  AlertTriangle,
  Info,
  Check,
  DollarSign,
  Share2
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { getInfraConfig } from '@/lib/infraConfig';
import { useBranding } from '@/context/BrandingContext';
import { printServiceReceipt, printServiceA4 } from '@/lib/printReceipt';
import toast from 'react-hot-toast';

const STATUS_LABELS: Record<string, string> = {
  received: 'Diterima',
  checking: 'Pengecekan',
  pending_part: 'Menunggu Part',
  repairing: 'Sedang Diperbaiki',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  taken: 'Sudah Diambil'
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  received: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
  checking: { bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/20' },
  pending_part: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
  repairing: { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/20' },
  completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' },
  cancelled: { bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/20' },
  taken: { bg: 'bg-slate-500/10', text: 'text-slate-500', border: 'border-slate-500/20' }
};

export default function ServicesPage() {
  const { storeId, user } = useAuthStore();
  const { branding } = useBranding();
  
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  
  // Add Form
  const [addForm, setAddForm] = useState({
    customerName: '',
    customerPhone: '',
    deviceModel: '',
    serialNumber: '',
    damageDescription: '',
    estimatedCost: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Status Update State
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusNote, setStatusNote] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Edit/Delete History Logs
  const [editingLogIndex, setEditingLogIndex] = useState<number | null>(null);
  const [editingLogNotes, setEditingLogNotes] = useState('');
  
  // Real-time Tickets Listener
  useEffect(() => {
    if (!storeId) return;

    setLoading(true);
    const q = query(
      collection(db, 'service_tickets'),
      where('storeId', '==', storeId),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTickets(docs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching service tickets:", error);
      toast.error("Gagal menyinkronkan data servis.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [storeId]);

  // Statistics
  const stats = useMemo(() => {
    const active = tickets.filter(t => ['received', 'checking', 'pending_part', 'repairing'].includes(t.status)).length;
    const completed = tickets.filter(t => t.status === 'completed').length;
    const taken = tickets.filter(t => t.status === 'taken').length;
    const total = tickets.length;
    return { active, completed, taken, total };
  }, [tickets]);

  // Filtered List
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchSearch = 
        t.customerName?.toLowerCase().includes(search.toLowerCase()) ||
        t.customerPhone?.includes(search) ||
        t.deviceModel?.toLowerCase().includes(search.toLowerCase()) ||
        t.serialNumber?.toLowerCase().includes(search.toLowerCase()) ||
        t.id?.toLowerCase().includes(search.toLowerCase());
        
      if (statusFilter === 'all') return matchSearch;
      if (statusFilter === 'active') {
        return matchSearch && ['received', 'checking', 'pending_part', 'repairing'].includes(t.status);
      }
      return matchSearch && t.status === statusFilter;
    });
  }, [tickets, search, statusFilter]);

  // Handle Add Ticket
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) return;
    if (!addForm.customerName || !addForm.deviceModel || !addForm.damageDescription) {
      toast.error("Harap isi semua kolom wajib!");
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const ticketNo = 'ST-' + Math.floor(100000 + Math.random() * 900000);
      const docData = {
        storeId,
        ticketNo,
        customerName: addForm.customerName,
        customerPhone: addForm.customerPhone || '-',
        deviceModel: addForm.deviceModel,
        serialNumber: addForm.serialNumber || '-',
        damageDescription: addForm.damageDescription,
        estimatedCost: Number(addForm.estimatedCost) || 0,
        status: 'received',
        notes: addForm.notes || '',
        timestamp: now,
        updatedAt: now,
        history: [
          {
            status: 'received',
            notes: 'Tiket servis dibuat. Perangkat diterima oleh kasir.',
            timestamp: now
          }
        ]
      };

      await addDoc(collection(db, 'service_tickets'), docData);
      toast.success("Tiket servis berhasil dibuat!");
      setIsAddModalOpen(false);
      setAddForm({
        customerName: '',
        customerPhone: '',
        deviceModel: '',
        serialNumber: '',
        damageDescription: '',
        estimatedCost: '',
        notes: ''
      });
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal membuat tiket: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Status Update
  const handleUpdateStatus = async () => {
    if (!selectedTicket || !newStatus) return;

    setIsUpdatingStatus(true);
    try {
      const now = new Date().toISOString();
      const newHistoryLog = {
        status: newStatus,
        notes: statusNote || `Status diperbarui menjadi ${STATUS_LABELS[newStatus]}`,
        timestamp: now
      };

      const updatedHistory = [...(selectedTicket.history || []), newHistoryLog];
      
      const docRef = doc(db, 'service_tickets', selectedTicket.id);

      if (newStatus === 'taken' && selectedTicket.status !== 'taken' && (selectedTicket.estimatedCost || 0) > 0) {
        await addDoc(collection(db, 'cash_flow'), {
          storeId,
          type: 'in',
          category: 'Servis Elektronik',
          amount: Number(selectedTicket.estimatedCost) || 0,
          description: `Servis Selesai & Diambil: ${selectedTicket.deviceModel} (Ref: ${selectedTicket.ticketNo || `ST-${selectedTicket.id.substring(0,6).toUpperCase()}`})`,
          subNotes: [
            { description: `Perbaikan unit ${selectedTicket.deviceModel}`, amount: Number(selectedTicket.estimatedCost) || 0 }
          ],
          timestamp: now,
          userEmail: user?.email || 'admin'
        });
      }

      await updateDoc(docRef, {
        status: newStatus,
        updatedAt: now,
        history: updatedHistory
      });

      // Update local modal state
      setSelectedTicket((prev: any) => ({
        ...prev,
        status: newStatus,
        updatedAt: now,
        history: updatedHistory
      }));

      setStatusNote('');
      toast.success("Status servis berhasil diperbarui!");
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal mengubah status: " + err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handle Delete Ticket
  const handleDeleteTicket = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus tiket servis ini secara permanen?")) return;

    try {
      await deleteDoc(doc(db, 'service_tickets', id));
      toast.success("Tiket servis berhasil dihapus!");
      setIsDetailModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal menghapus tiket: " + err.message);
    }
  };

  const handleDeleteHistoryLog = async (logIndex: number) => {
    if (!selectedTicket) return;
    if (!window.confirm("Apakah Anda yakin ingin menghapus log riwayat ini?")) return;

    const originalIndex = selectedTicket.history.length - 1 - logIndex;
    const updatedHistory = selectedTicket.history.filter((_: any, i: number) => i !== originalIndex);

    try {
      const docRef = doc(db, 'service_tickets', selectedTicket.id);
      await updateDoc(docRef, { history: updatedHistory });
      setSelectedTicket((prev: any) => ({ ...prev, history: updatedHistory }));
      toast.success("Log riwayat berhasil dihapus!");
    } catch (err: any) {
      toast.error("Gagal menghapus log: " + err.message);
    }
  };

  const handleStartEditHistoryLog = (logIndex: number, currentNotes: string) => {
    const originalIndex = selectedTicket.history.length - 1 - logIndex;
    setEditingLogIndex(originalIndex);
    setEditingLogNotes(currentNotes);
  };

  const handleSaveEditHistoryLog = async () => {
    if (!selectedTicket || editingLogIndex === null) return;

    const updatedHistory = selectedTicket.history.map((log: any, i: number) => {
      if (i === editingLogIndex) {
        return { ...log, notes: editingLogNotes };
      }
      return log;
    });

    try {
      const docRef = doc(db, 'service_tickets', selectedTicket.id);
      await updateDoc(docRef, { history: updatedHistory });
      setSelectedTicket((prev: any) => ({ ...prev, history: updatedHistory }));
      setEditingLogIndex(null);
      setEditingLogNotes('');
      toast.success("Log riwayat berhasil diperbarui!");
    } catch (err: any) {
      toast.error("Gagal memperbarui log: " + err.message);
    }
  };

  const handleQuickUpdateStatus = async (targetStatus: string, defaultNote: string) => {
    if (!selectedTicket) return;
    setIsUpdatingStatus(true);
    try {
      const now = new Date().toISOString();
      const newHistoryLog = {
        status: targetStatus,
        notes: defaultNote,
        timestamp: now
      };
      const updatedHistory = [...(selectedTicket.history || []), newHistoryLog];

      const docRef = doc(db, 'service_tickets', selectedTicket.id);

      if (targetStatus === 'taken' && selectedTicket.status !== 'taken' && (selectedTicket.estimatedCost || 0) > 0) {
        await addDoc(collection(db, 'cash_flow'), {
          storeId,
          type: 'in',
          category: 'Servis Elektronik',
          amount: Number(selectedTicket.estimatedCost) || 0,
          description: `Servis Selesai & Diambil: ${selectedTicket.deviceModel} (Ref: ${selectedTicket.ticketNo || `ST-${selectedTicket.id.substring(0,6).toUpperCase()}`})`,
          subNotes: [
            { description: `Perbaikan unit ${selectedTicket.deviceModel}`, amount: Number(selectedTicket.estimatedCost) || 0 }
          ],
          timestamp: now,
          userEmail: user?.email || 'admin'
        });
      }

      await updateDoc(docRef, {
        status: targetStatus,
        updatedAt: now,
        history: updatedHistory
      });

      setSelectedTicket((prev: any) => ({
        ...prev,
        status: targetStatus,
        updatedAt: now,
        history: updatedHistory
      }));

      toast.success(`Status berhasil diperbarui ke ${STATUS_LABELS[targetStatus]}!`);
    } catch (err: any) {
      toast.error("Gagal update status: " + err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedTicket || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploadingAttachment(true);

    try {
      const config = await getInfraConfig();
      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('upload_preset', config.cloudinary_upload_preset || 'kasirpos');

      const cloudName = config.cloudinary_cloud_name || 'dkcjfwbvc';
      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: uploadData
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.error?.message || 'Gagal mengunggah ke Cloudinary');
      }

      const uploadResult = await uploadRes.json();
      const downloadUrl = uploadResult.secure_url;

      const updatedAttachments = [...(selectedTicket.attachments || []), downloadUrl];
      const docRef = doc(db, 'service_tickets', selectedTicket.id);
      await updateDoc(docRef, { attachments: updatedAttachments });

      setSelectedTicket((prev: any) => ({
        ...prev,
        attachments: updatedAttachments
      }));

      toast.success("Foto bukti berhasil dilampirkan via Cloudinary!");
    } catch (err: any) {
      toast.error("Gagal mengunggah foto: " + err.message);
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (imageUrl: string) => {
    if (!selectedTicket) return;
    if (!window.confirm("Apakah Anda yakin ingin menghapus foto bukti ini?")) return;

    try {
      const updatedAttachments = selectedTicket.attachments.filter((url: string) => url !== imageUrl);
      const docRef = doc(db, 'service_tickets', selectedTicket.id);
      await updateDoc(docRef, { attachments: updatedAttachments });

      setSelectedTicket((prev: any) => ({
        ...prev,
        attachments: updatedAttachments
      }));

      toast.success("Foto bukti berhasil dihapus!");
    } catch (err: any) {
      toast.error("Gagal menghapus foto: " + err.message);
    }
  };

  // Printable Receipt Render
  const handlePrintReceipt = async (ticket: any) => {
    let settings = null;
    try {
      if (storeId) {
        const docRef = doc(db, 'settings', `store_${storeId}`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          settings = docSnap.data();
        }
      }
    } catch (err) {
      console.error("Gagal memuat pengaturan cetak:", err);
    }

    toast.promise(
      printServiceReceipt(ticket, settings, branding),
      {
        loading: 'Mempersiapkan struk thermal & QR Code...',
        success: 'Jendela cetak struk siap!',
        error: 'Gagal mencetak struk tanda terima.'
      }
    );
  };

  const handlePrintA4 = async (ticket: any) => {
    let settings = null;
    try {
      if (storeId) {
        const docRef = doc(db, 'settings', `store_${storeId}`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          settings = docSnap.data();
        }
      }
    } catch (err) {
      console.error("Gagal memuat pengaturan cetak A4:", err);
    }

    toast.promise(
      printServiceA4(ticket, settings, branding),
      {
        loading: 'Mempersiapkan nota servis A4...',
        success: 'Jendela cetak nota A4 siap!',
        error: 'Gagal mencetak nota servis A4.'
      }
    );
  };

  const handleShareSignatureLink = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'service_tickets', ticketId), {
        isSignatureLinkActive: true
      });
      
      const url = `${window.location.origin}/sign?type=service&id=${ticketId}`;
      if (navigator.share) {
        await navigator.share({
          title: 'Tanda Tangan Nota Penerimaan Servis',
          text: 'Silakan klik link berikut untuk menandatangani Nota Penerimaan Servis Anda secara digital:',
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link tanda tangan disalin ke clipboard!');
      }
    } catch (err) {
      console.error('Error sharing signature link:', err);
      toast.error('Gagal mengaktifkan link tanda tangan');
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-accent/20 text-accent rounded-2xl flex items-center justify-center">
              <Wrench size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">Servis Elektronik</h1>
              <p className="text-xs text-app-text-muted font-bold uppercase tracking-widest">Manajemen Perbaikan Real-Time</p>
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="px-6 py-4 bg-accent hover:bg-accent-hover text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-accent/25 flex items-center gap-2"
        >
          <PlusCircle size={16} />
          Tambah Tiket Servis
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Servis Aktif', val: stats.active, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Selesai Diperbaiki', val: stats.completed, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Sudah Diambil', val: stats.taken, color: 'text-slate-500', bg: 'bg-slate-500/10' },
          { label: 'Total Tiket', val: stats.total, color: 'text-blue-500', bg: 'bg-blue-500/10' }
        ].map((s, idx) => (
          <div key={idx} className="bg-surface border border-app-border rounded-[2rem] p-6 flex flex-col gap-2">
            <span className="text-[10px] font-black text-app-text-muted uppercase tracking-wider">{s.label}</span>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-black ${s.color}`}>{s.val}</span>
              <span className={`w-3 h-3 rounded-full ${s.bg}`}></span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter and Search controls */}
      <div className="bg-surface border border-app-border rounded-[2.5rem] p-6 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {[
            { label: 'Semua', val: 'all' },
            { label: 'Aktif / Sedang Servis', val: 'active' },
            { label: 'Selesai', val: 'completed' },
            { label: 'Sudah Diambil', val: 'taken' },
            { label: 'Batal', val: 'cancelled' }
          ].map((btn) => (
            <button
              key={btn.val}
              onClick={() => setStatusFilter(btn.val)}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${statusFilter === btn.val ? 'bg-accent text-white' : 'bg-background hover:bg-surface border border-app-border text-app-text-muted hover:text-foreground'}`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
          <input
            type="text"
            placeholder="Cari Pelanggan, Unit, IMEI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-6 py-3 bg-background border border-app-border rounded-2xl text-xs font-bold text-foreground focus:outline-none focus:border-accent transition-all"
          />
        </div>
      </div>

      {/* Tickets List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="animate-spin text-accent w-10 h-10" />
          <p className="text-xs text-app-text-muted font-black tracking-widest uppercase">Menyinkronkan Basis Data Servis...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="bg-surface border border-app-border rounded-[3rem] p-16 text-center">
          <Wrench className="mx-auto text-app-text-muted/40 mb-4" size={48} />
          <p className="text-sm font-bold text-app-text-muted">Tidak ada tiket servis yang sesuai dengan filter pencarian.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTickets.map((ticket) => {
            const color = STATUS_COLORS[ticket.status] || STATUS_COLORS.received;
            return (
              <div 
                key={ticket.id} 
                onClick={() => {
                  setSelectedTicket(ticket);
                  setNewStatus(ticket.status);
                  setIsDetailModalOpen(true);
                }}
                className="bg-surface border border-app-border hover:border-accent/40 rounded-[2.5rem] p-6 cursor-pointer shadow-sm hover:shadow-md transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-black text-app-text-muted">{ticket.ticketNo || `ST-${ticket.id.substring(0,6).toUpperCase()}`}</span>
                    <span className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg border ${color.bg} ${color.text} ${color.border}`}>
                      {STATUS_LABELS[ticket.status]}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-foreground mb-1 group-hover:text-accent transition-colors">{ticket.deviceModel}</h3>
                  <p className="text-[10px] text-app-text-muted font-bold uppercase tracking-wider mb-4">S/N: {ticket.serialNumber}</p>
                  
                  <div className="space-y-2 border-t border-app-border/40 pt-4 mb-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                      <User size={14} className="text-app-text-muted" />
                      <span>{ticket.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-app-text-muted">
                      <Phone size={14} />
                      <span>{ticket.customerPhone}</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-app-text-muted">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{ticket.damageDescription}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-app-border/40">
                  <div>
                    <p className="text-[9px] text-app-text-muted font-black uppercase tracking-wider">Estimasi Biaya</p>
                    <p className="text-sm font-black text-foreground">Rp {ticket.estimatedCost?.toLocaleString('id-ID')}</p>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrintReceipt(ticket);
                    }}
                    className="p-3 bg-background hover:bg-accent/15 hover:text-accent rounded-xl text-app-text-muted transition-all"
                  >
                    <Printer size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD TICKET MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="bg-surface border border-app-border rounded-[3rem] w-full max-w-xl shadow-2xl p-8 max-h-[90%] overflow-y-auto animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent/20 text-accent rounded-xl flex items-center justify-center">
                  <Wrench size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase text-foreground leading-none mb-1">Tiket Servis Baru</h2>
                  <p className="text-[10px] text-app-text-muted font-bold uppercase">Registrasi Unit & Kerusakan</p>
                </div>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 bg-background hover:bg-surface border border-app-border rounded-full text-app-text-muted">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-app-text-muted uppercase tracking-wider block pl-1">Nama Pelanggan *</label>
                  <input
                    type="text"
                    required
                    value={addForm.customerName}
                    onChange={(e) => setAddForm({ ...addForm, customerName: e.target.value })}
                    placeholder="e.g. Budi Raharjo"
                    className="w-full px-5 py-3 bg-background border border-app-border rounded-2xl text-xs font-bold focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-app-text-muted uppercase tracking-wider block pl-1">No. Telepon</label>
                  <input
                    type="text"
                    value={addForm.customerPhone}
                    onChange={(e) => setAddForm({ ...addForm, customerPhone: e.target.value })}
                    placeholder="e.g. 08123456789"
                    className="w-full px-5 py-3 bg-background border border-app-border rounded-2xl text-xs font-bold focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-app-text-muted uppercase tracking-wider block pl-1">Tipe / Model Perangkat *</label>
                  <input
                    type="text"
                    required
                    value={addForm.deviceModel}
                    onChange={(e) => setAddForm({ ...addForm, deviceModel: e.target.value })}
                    placeholder="e.g. iPhone 13 Pro"
                    className="w-full px-5 py-3 bg-background border border-app-border rounded-2xl text-xs font-bold focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-app-text-muted uppercase tracking-wider block pl-1">S/N atau IMEI</label>
                  <input
                    type="text"
                    value={addForm.serialNumber}
                    onChange={(e) => setAddForm({ ...addForm, serialNumber: e.target.value })}
                    placeholder="e.g. SN8291039832"
                    className="w-full px-5 py-3 bg-background border border-app-border rounded-2xl text-xs font-bold focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-app-text-muted uppercase tracking-wider block pl-1">Kerusakan / Keluhan *</label>
                <textarea
                  required
                  rows={2}
                  value={addForm.damageDescription}
                  onChange={(e) => setAddForm({ ...addForm, damageDescription: e.target.value })}
                  placeholder="Deskripsikan gejala kerusakan pada unit perangkat..."
                  className="w-full px-5 py-3 bg-background border border-app-border rounded-2xl text-xs font-bold focus:outline-none focus:border-accent resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-app-text-muted uppercase tracking-wider block pl-1">Estimasi Biaya Awal (Rp)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-app-text-muted">Rp</span>
                  <input
                    type="number"
                    value={addForm.estimatedCost}
                    onChange={(e) => setAddForm({ ...addForm, estimatedCost: e.target.value })}
                    placeholder="0"
                    className="w-full pl-12 pr-5 py-3 bg-background border border-app-border rounded-2xl text-xs font-bold focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-app-text-muted uppercase tracking-wider block pl-1">Catatan Tambahan</label>
                <input
                  type="text"
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  placeholder="Catatan fisik casing lecet, kelengkapan charger dsb."
                  className="w-full px-5 py-3 bg-background border border-app-border rounded-2xl text-xs font-bold focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-4 bg-background border border-app-border hover:bg-surface rounded-2xl font-black text-[10px] uppercase tracking-widest text-app-text-muted transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] py-4 bg-accent hover:bg-accent-hover text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="animate-spin" size={14} />}
                  Buat Tiket Servis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL & TRACKING MODAL */}
      {isDetailModalOpen && selectedTicket && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="bg-surface border border-app-border rounded-[3rem] w-full max-w-4xl shadow-2xl p-8 max-h-[90%] overflow-y-auto animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-8 border-b pb-4" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent/20 text-accent rounded-xl flex items-center justify-center">
                  <Wrench size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase text-foreground leading-none mb-1">Rincian Tiket Servis</h2>
                  <p className="text-[10px] text-app-text-muted font-bold uppercase">Pelacakan Log & Pembaruan Status</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handlePrintA4(selectedTicket)}
                  className="p-2.5 bg-background border border-app-border hover:bg-surface text-app-text-muted hover:text-foreground rounded-xl transition-all flex items-center gap-2 text-xs font-bold"
                >
                  <FileText size={16} className="text-accent" />
                  Cetak A4
                </button>

                <button 
                  onClick={() => handlePrintReceipt(selectedTicket)}
                  className="p-2.5 bg-background border border-app-border hover:bg-surface text-app-text-muted hover:text-foreground rounded-xl transition-all flex items-center gap-2 text-xs font-bold"
                >
                  <Printer size={16} />
                  Cetak Struk
                </button>

                <button 
                  onClick={() => handleShareSignatureLink(selectedTicket.id)}
                  className="p-2.5 bg-background border border-app-border hover:bg-surface text-app-text-muted hover:text-foreground rounded-xl transition-all flex items-center gap-2 text-xs font-bold"
                >
                  <FileSignature size={16} className="text-amber-500" />
                  Kirim Link TTD
                </button>

                <button 
                  onClick={() => {
                    const ticketIdentifier = selectedTicket.ticketNo 
                      ? `no=${selectedTicket.ticketNo}` 
                      : `id=${selectedTicket.id}`;
                    const ticketDisplayNo = selectedTicket.ticketNo || `ST-${selectedTicket.id.substring(0,8).toUpperCase()}`;

                    const shareText = `*IKASIR PRO - Tanda Terima Servis*

No. Tiket: ${ticketDisplayNo}
Pelanggan: ${selectedTicket.customerName}
Perangkat: ${selectedTicket.deviceModel}
Kerusakan: ${selectedTicket.damageDescription}
Estimasi Biaya: Rp ${selectedTicket.estimatedCost?.toLocaleString('id-ID')}
Status: ${STATUS_LABELS[selectedTicket.status]}

Lacak status perbaikan Anda secara real-time di sini:
https://ikasir.my.id/tr/service?${ticketIdentifier}`;
                    navigator.clipboard.writeText(shareText);
                    toast.success("Link pelacakan disalin ke clipboard!");
                  }}
                  className="p-2.5 bg-accent/10 border border-accent/20 hover:bg-accent text-accent hover:text-foreground rounded-xl transition-all flex items-center gap-2 text-xs font-bold"
                >
                  <Share2 size={16} />
                  Bagikan Status
                </button>
                
                <button 
                  onClick={() => handleDeleteTicket(selectedTicket.id)}
                  className="p-2.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 rounded-xl transition-all flex items-center gap-2 text-xs font-bold"
                >
                  <Trash2 size={16} />
                  Hapus
                </button>

                <button onClick={() => setIsDetailModalOpen(false)} className="p-2 bg-background hover:bg-surface border border-app-border rounded-full text-app-text-muted">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column: Info & Update Form */}
              <div className="space-y-6">
                <div className="bg-background border border-app-border rounded-[2rem] p-5 space-y-4">
                  <h3 className="text-xs font-black uppercase text-app-text-muted tracking-wider border-b border-app-border/40 pb-2 mb-2">Informasi Unit</h3>
                  
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-[9px] font-black text-app-text-muted uppercase">Model / Perangkat</p>
                      <p className="font-bold text-foreground mt-0.5">{selectedTicket.deviceModel}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-app-text-muted uppercase">Nomor Seri / IMEI</p>
                      <p className="font-bold text-foreground mt-0.5">{selectedTicket.serialNumber}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-app-text-muted uppercase">Nama Pelanggan</p>
                      <p className="font-bold text-foreground mt-0.5">{selectedTicket.customerName}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-app-text-muted uppercase">Telepon Pelanggan</p>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="font-bold text-foreground">{selectedTicket.customerPhone}</p>
                        {selectedTicket.customerPhone && selectedTicket.customerPhone !== '-' && (
                          <button
                            onClick={() => {
                              let cleaned = selectedTicket.customerPhone.replace(/[^0-9]/g, '');
                              if (cleaned.startsWith('0')) {
                                cleaned = '62' + cleaned.substring(1);
                              }
                              window.open(`https://wa.me/${cleaned}`, '_blank');
                            }}
                            className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[9px] font-black rounded border border-emerald-500/20 uppercase hover:bg-emerald-500 hover:text-white transition-all"
                          >
                            Hubungi WA
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-app-border/40 pt-3">
                    <p className="text-[9px] font-black text-app-text-muted uppercase">Kerusakan / Keluhan</p>
                    <p className="text-xs font-medium text-foreground mt-1 bg-surface/50 p-3 rounded-xl border border-app-border/40">{selectedTicket.damageDescription}</p>
                  </div>

                  {selectedTicket.notes && (
                    <div className="border-t border-app-border/40 pt-3">
                      <p className="text-[9px] font-black text-app-text-muted uppercase">Catatan</p>
                      <p className="text-xs italic text-app-text-muted mt-1">{selectedTicket.notes}</p>
                    </div>
                  )}
                </div>

                {/* Status Update Card */}
                <div className="bg-background border border-app-border rounded-[2rem] p-5 space-y-4">
                  <h3 className="text-xs font-black uppercase text-app-text-muted tracking-wider border-b border-app-border/40 pb-2">Ubah Status Servis</h3>
                  
                  {/* Quick Workflow Buttons */}
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-app-text-muted uppercase tracking-wider">Alur Proses Cepat</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedTicket.status === 'received' && (
                        <button
                          type="button"
                          onClick={() => handleQuickUpdateStatus('checking', 'Unit masuk tahap pengecekan awal.')}
                          className="px-3 py-2 bg-purple-500/10 text-purple-500 border border-purple-500/20 text-[10px] font-black rounded-xl uppercase hover:bg-purple-500 hover:text-white transition-all"
                        >
                          → Mulai Pengecekan
                        </button>
                      )}
                      {selectedTicket.status === 'checking' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleQuickUpdateStatus('repairing', 'Unit mulai dikerjakan / diperbaiki.')}
                            className="px-3 py-2 bg-orange-500/10 text-orange-500 border border-orange-500/20 text-[10px] font-black rounded-xl uppercase hover:bg-orange-500 hover:text-white transition-all"
                          >
                            → Mulai Perbaikan
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickUpdateStatus('pending_part', 'Menunggu suku cadang/sparepart.')}
                            className="px-3 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-black rounded-xl uppercase hover:bg-amber-500 hover:text-white transition-all"
                          >
                            → Tunggu Sparepart
                          </button>
                        </>
                      )}
                      {selectedTicket.status === 'pending_part' && (
                        <button
                          type="button"
                          onClick={() => handleQuickUpdateStatus('repairing', 'Suku cadang tersedia. Mulai perbaikan.')}
                          className="px-3 py-2 bg-orange-500/10 text-orange-500 border border-orange-500/20 text-[10px] font-black rounded-xl uppercase hover:bg-orange-500 hover:text-white transition-all"
                        >
                          → Mulai Perbaikan
                        </button>
                      )}
                      {(selectedTicket.status === 'repairing' || selectedTicket.status === 'pending_part') && (
                        <button
                          type="button"
                          onClick={() => handleQuickUpdateStatus('completed', 'Perbaikan unit telah selesai.')}
                          className="px-3 py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-black rounded-xl uppercase hover:bg-emerald-500 hover:text-white transition-all"
                        >
                          ✓ Selesai Perbaikan
                        </button>
                      )}
                      {selectedTicket.status === 'completed' && (
                        <button
                          type="button"
                          onClick={() => handleQuickUpdateStatus('taken', 'Unit diserahkan ke pelanggan.')}
                          className="px-3 py-2 bg-slate-500/10 text-slate-500 border border-slate-500/20 text-[10px] font-black rounded-xl uppercase hover:bg-slate-500 hover:text-white transition-all"
                        >
                          ✓ Unit Diambil Pelanggan
                        </button>
                      )}
                      {selectedTicket.status !== 'taken' && selectedTicket.status !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => handleQuickUpdateStatus('cancelled', 'Pekerjaan servis dibatalkan.')}
                          className="px-3 py-2 bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[10px] font-black rounded-xl uppercase hover:bg-rose-500 hover:text-white transition-all"
                        >
                          ✕ Batalkan Servis
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-app-border/40 pt-4 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-app-text-muted uppercase tracking-wider">Pembaruan Manual</label>
                      <select 
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="w-full px-4 py-2.5 bg-background border border-app-border rounded-xl text-xs font-bold text-foreground focus:outline-none"
                      >
                        <option value="">Pilih status...</option>
                        {Object.entries(STATUS_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-app-text-muted uppercase tracking-wider font-bold">Catatan Log Status (Penting)</label>
                      <input 
                        type="text"
                        value={statusNote}
                        onChange={(e) => setStatusNote(e.target.value)}
                        placeholder="e.g. Masuk tahap solder IC power / Selesai ganti LCD"
                        className="w-full px-4 py-2.5 bg-background border border-app-border rounded-xl text-xs font-bold focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleUpdateStatus}
                      disabled={isUpdatingStatus || !newStatus || newStatus === selectedTicket.status}
                      className="w-full py-3 bg-accent hover:bg-accent-hover disabled:bg-app-border text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      {isUpdatingStatus && <Loader2 className="animate-spin" size={12} />}
                      Update Status Servis
                    </button>
                  </div>
                </div>

                {/* Attachment Upload Card */}
                <div className="bg-background border border-app-border rounded-[2rem] p-5 space-y-4">
                  <h3 className="text-xs font-black uppercase text-app-text-muted tracking-wider border-b border-app-border/40 pb-2 flex items-center gap-2">
                    <Camera size={14} />
                    Lampiran Foto Bukti Servis
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-app-border hover:border-accent rounded-2xl p-4 cursor-pointer transition-all bg-surface/50">
                        <Paperclip size={20} className="text-app-text-muted mb-1" />
                        <span className="text-[10px] font-black uppercase text-app-text-muted">Pilih File Foto</span>
                        <span className="text-[8px] text-app-text-muted mt-0.5">JPG, PNG maks 5MB</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleUploadAttachment}
                          disabled={isUploadingAttachment}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {isUploadingAttachment && (
                      <div className="flex items-center justify-center gap-2 py-2">
                        <Loader2 className="animate-spin text-accent" size={14} />
                        <span className="text-[10px] font-bold text-accent uppercase">Mengunggah Foto...</span>
                      </div>
                    )}

                    {selectedTicket.attachments && selectedTicket.attachments.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {selectedTicket.attachments.map((url: string, index: number) => (
                          <div key={index} className="relative group rounded-xl overflow-hidden border border-app-border aspect-square bg-surface">
                            <img src={url} alt={`Bukti ${index + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleDeleteAttachment(url)}
                              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-500/90 hover:bg-rose-600 text-white flex items-center justify-center text-xs shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Hapus foto"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-app-text-muted italic text-center py-2">Belum ada foto bukti yang dilampirkan.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Real-Time logs history */}
              <div className="flex flex-col">
                <h3 className="text-xs font-black uppercase text-app-text-muted tracking-wider mb-4 pl-2 flex items-center gap-2">
                  <History size={16} />
                  Riwayat Progress Pelacakan Real-time
                </h3>

                <div className="flex-1 bg-background border border-app-border rounded-[2rem] p-6 overflow-y-auto max-h-[360px]">
                  <div className="relative border-l border-app-border/80 pl-6 ml-2.5 space-y-6">
                    {selectedTicket.history && [...selectedTicket.history].reverse().map((log: any, idx: number) => {
                      const color = STATUS_COLORS[log.status] || STATUS_COLORS.received;
                      return (
                        <div key={idx} className="relative">
                          {/* Dot Badge */}
                          <div className="absolute -left-[31px] top-0 w-3 h-3 rounded-full border-2 border-background bg-accent"></div>
                          
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] text-app-text-muted font-bold">
                                {new Date(log.timestamp).toLocaleString('id-ID')}
                              </span>
                              <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded ${color.bg} ${color.text}`}>
                                {STATUS_LABELS[log.status]}
                              </span>
                            </div>
                            {editingLogIndex === (selectedTicket.history.length - 1 - idx) ? (
                              <div className="mt-2 flex gap-2">
                                <input
                                  type="text"
                                  value={editingLogNotes}
                                  onChange={e => setEditingLogNotes(e.target.value)}
                                  className="flex-1 px-3 py-1 bg-surface border border-app-border rounded-lg text-xs font-semibold text-foreground focus:outline-none"
                                />
                                <button
                                  onClick={handleSaveEditHistoryLog}
                                  className="px-3 py-1 bg-accent text-white text-[10px] font-black rounded-lg uppercase"
                                >
                                  Simpan
                                </button>
                                <button
                                  onClick={() => setEditingLogIndex(null)}
                                  className="px-3 py-1 bg-app-border text-foreground text-[10px] font-black rounded-lg uppercase"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-between items-start group/log gap-2">
                                <p className="text-xs font-semibold text-foreground">{log.notes}</p>
                                <div className="flex items-center gap-2 shrink-0 opacity-50 hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => handleStartEditHistoryLog(idx, log.notes)}
                                    className="text-[10px] font-bold text-accent hover:underline"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteHistoryLog(idx)}
                                    className="text-[10px] font-bold text-rose-500 hover:underline"
                                  >
                                    Hapus
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
