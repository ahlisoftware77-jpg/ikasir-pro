'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Phone, Calendar, AlertTriangle, Shield, CheckCircle, RefreshCw, X, ArrowLeft, Clock, Camera, Wrench } from 'lucide-react';
import Link from 'next/link';

const STATUS_LABELS: Record<string, string> = {
  received: 'Diterima',
  checking: 'Pengecekan',
  pending_part: 'Menunggu Part',
  repairing: 'Sedang Diperbaiki',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  taken: 'Sudah Diambil'
};

const STATUS_EMOJIS: Record<string, string> = {
  received: '📥',
  checking: '🔍',
  pending_part: '⏳',
  repairing: '🛠️',
  completed: '✅',
  cancelled: '❌',
  taken: '📦'
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  received: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20', glow: 'shadow-blue-500/20' },
  checking: { bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/20', glow: 'shadow-purple-500/20' },
  pending_part: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20', glow: 'shadow-amber-500/20' },
  repairing: { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/20', glow: 'shadow-orange-500/20' },
  completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20', glow: 'shadow-emerald-500/20' },
  cancelled: { bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/20', glow: 'shadow-rose-500/20' },
  taken: { bg: 'bg-slate-500/10', text: 'text-slate-500', border: 'border-slate-500/20', glow: 'shadow-slate-500/20' }
};

export default function ServiceTrackPage() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('id');

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isPickupModalOpen, setIsPickupModalOpen] = useState(false);
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [pickupNotes, setPickupNotes] = useState('');
  const [isSubmittingPickup, setIsSubmittingPickup] = useState(false);

  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

  const handleConfirmPickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupDate || !pickupTime) {
      alert("Silakan pilih tanggal dan jam pengambilan.");
      return;
    }
    setIsSubmittingPickup(true);
    try {
      const docRef = doc(db, 'service_tickets', ticket.id);
      await updateDoc(docRef, {
        pickupSchedule: {
          date: pickupDate,
          time: pickupTime,
          notes: pickupNotes,
          confirmedAt: new Date().toISOString()
        }
      });
      setIsPickupModalOpen(false);
    } catch (err: any) {
      console.error(err);
      alert("Gagal menyimpan jadwal pengambilan: " + err.message);
    } finally {
      setIsSubmittingPickup(false);
    }
  };

  useEffect(() => {
    if (!ticketId) {
      setLoading(false);
      setError('ID Tiket tidak valid atau kosong.');
      return;
    }

    const docRef = doc(db, 'service_tickets', ticketId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setTicket({ id: docSnap.id, ...docSnap.data() });
        setError('');
      } else {
        setError('Tiket servis tidak ditemukan. Silakan periksa kembali tautan Anda.');
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError('Gagal memuat status: ' + err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ticketId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-slate-900 via-slate-950 to-slate-900 flex flex-col justify-center items-center p-4">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-accent/20"></div>
          <div className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-2xl">⚡</div>
        </div>
        <p className="text-[10px] font-black text-slate-400 mt-6 uppercase tracking-widest animate-pulse">Menghubungkan ke Server...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-slate-900 via-slate-950 to-slate-900 flex flex-col justify-center items-center p-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6 shadow-2xl shadow-rose-500/5">
          <span className="text-4xl">⚠️</span>
        </div>
        <h1 className="text-lg font-black text-white mb-2">Pelacakan Gagal</h1>
        <p className="text-xs font-bold text-slate-400 max-w-sm mb-8 leading-relaxed">{error || 'Tiket tidak ditemukan.'}</p>
        <Link href="/" className="px-6 py-3 bg-gradient-to-r from-accent to-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:opacity-95 transition-all shadow-lg shadow-accent/25">
          Kembali ke Beranda
        </Link>
      </div>
    );
  }

  const currentStatusColor = STATUS_COLORS[ticket.status] || STATUS_COLORS.received;
  
  // Progress steps
  const steps = [
    { key: 'received', label: 'Diterima', emoji: '📥' },
    { key: 'checking', label: 'Pengecekan', emoji: '🔍' },
    { key: 'repairing', label: 'Perbaikan', emoji: '🛠️' },
    { key: 'completed', label: 'Selesai', emoji: '✅' },
    { key: 'taken', label: 'Diambil', emoji: '📦' }
  ];

  const getStepIndex = (status: string) => {
    if (status === 'pending_part' || status === 'repairing') return 2;
    if (status === 'completed') return 3;
    if (status === 'taken') return 4;
    if (status === 'cancelled') return -1;
    return 0; // received or checking
  };

  const activeIndex = getStepIndex(ticket.status);

  return (
    <div className="min-h-screen bg-gradient-to-tr from-slate-900 via-slate-950 to-slate-900 text-slate-100 pb-20 font-sans">
      {/* Top Banner */}
      <div className="bg-slate-950/80 border-b border-slate-800/60 py-4 px-6 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 border border-accent/20 rounded-2xl flex items-center justify-center text-accent shadow-inner">
              <span className="text-xl">🛠️</span>
            </div>
            <div>
              <h1 className="text-xs font-black uppercase tracking-widest text-slate-300">Tracking Service</h1>
              <p className="text-[10px] font-bold text-slate-500">iKasir Pro Real-time Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-[9px] font-black uppercase text-emerald-400 tracking-wider bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              Live Update
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Header Status Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-[2.5rem] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-accent/5 rounded-full filter blur-2xl"></div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/60 pb-6">
            <div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">NOMOR TIKET</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-lg font-black text-white tracking-tight uppercase">
                  #ST-{ticket.id.substring(0, 8).toUpperCase()}
                </span>
                <span className="text-base">🧾</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">STATUS TERKINI</span>
              <div className={`px-4 py-2 rounded-2xl border text-xs font-black uppercase flex items-center gap-2 shadow-lg ${currentStatusColor.bg} ${currentStatusColor.text} ${currentStatusColor.border} ${currentStatusColor.glow}`}>
                <span className="text-sm">{STATUS_EMOJIS[ticket.status] || '⚡'}</span>
                <span>{STATUS_LABELS[ticket.status]}</span>
              </div>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          {ticket.status !== 'cancelled' && (
            <div className="py-10 border-b border-slate-800/60">
              <div className="relative">
                {/* Connector Line */}
                <div className="absolute left-6 right-6 top-5 -translate-y-1/2 h-1 bg-slate-800/80 rounded-full z-0">
                  <div 
                    className="h-full bg-gradient-to-r from-accent to-indigo-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(var(--color-accent),0.5)]"
                    style={{ width: `${(activeIndex / (steps.length - 1)) * 100}%` }}
                  ></div>
                </div>

                {/* Step Dots & Labels */}
                <div className="relative flex justify-between items-start w-full z-10">
                  {steps.map((step, idx) => {
                    const isCompleted = idx <= activeIndex;
                    const isActive = idx === activeIndex;

                    return (
                      <div key={step.key} className="flex flex-col items-center flex-1">
                        <div 
                          className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center transition-all duration-500 ease-out transform ${
                            isActive 
                              ? 'bg-gradient-to-tr from-accent to-indigo-650 border-accent text-white scale-110 shadow-lg shadow-accent/40 animate-pulse' 
                              : isCompleted 
                              ? 'bg-accent/15 border-accent/40 text-accent scale-100' 
                              : 'bg-slate-900 border-slate-850 text-slate-600 scale-95'
                          }`}
                        >
                          <span className="text-lg transition-transform duration-500">{step.emoji}</span>
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-wider mt-6 text-center transition-colors duration-300 ${
                          isActive 
                            ? 'text-accent font-black' 
                            : isCompleted 
                            ? 'text-slate-300' 
                            : 'text-slate-650'
                        }`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Jadwal Pengambilan Section */}
          {(ticket.status === 'completed' || ticket.pickupSchedule) && (
            <div className="bg-gradient-to-tr from-accent/15 via-indigo-950/30 to-accent/5 border border-accent/25 rounded-[2rem] p-6 space-y-4 backdrop-blur-xl relative overflow-hidden shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent/20 border border-accent/30 rounded-2xl flex items-center justify-center text-accent shadow-inner">
                  <span className="text-xl">📦</span>
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-200">Jadwal Pengambilan Unit</h3>
                  <p className="text-[10px] text-slate-400">Konfirmasi rencana waktu kedatangan Anda ke toko</p>
                </div>
              </div>

              {ticket.pickupSchedule ? (
                <div className="bg-slate-950/60 border border-slate-800/40 rounded-2xl p-4 space-y-2.5">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Tanggal Rencana</span>
                      <span className="text-sm font-bold text-white mt-0.5 block">
                        {new Date(ticket.pickupSchedule.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Jam Rencana</span>
                      <span className="text-sm font-bold text-white mt-0.5 block">{ticket.pickupSchedule.time} WIB</span>
                    </div>
                  </div>
                  {ticket.pickupSchedule.notes && (
                    <div className="border-t border-slate-800/40 pt-2">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Catatan Tambahan</span>
                      <p className="text-xs text-slate-300 mt-0.5 italic">"{ticket.pickupSchedule.notes}"</p>
                    </div>
                  )}
                  <div className="border-t border-slate-800/40 pt-2 flex items-center gap-1.5 justify-end">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Terkonfirmasi</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/30 p-4 rounded-2xl border border-slate-800/40">
                  <p className="text-xs text-slate-300 leading-relaxed max-w-md">
                    Unit Anda telah selesai diperbaiki dan siap diambil. Silakan konfirmasi jadwal kedatangan agar teknisi kami dapat mempersiapkan unit Anda.
                  </p>
                  <button
                    onClick={() => setIsPickupModalOpen(true)}
                    className="px-5 py-3 bg-gradient-to-r from-accent to-indigo-650 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:opacity-95 transition-all shadow-lg shadow-accent/25 whitespace-nowrap self-start sm:self-center"
                  >
                    Konfirmasi Jadwal
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Device & Client Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 text-xs">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-800/60 pb-2 flex items-center gap-1.5">
                <span>📱</span> Detail Perangkat
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-slate-950/30 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">MODEL UNIT</span>
                  <span className="font-bold text-white">{ticket.deviceModel}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-950/30 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">S/N ATAU IMEI</span>
                  <span className="font-bold text-white">{ticket.serialNumber || '-'}</span>
                </div>
                <div className="flex flex-col bg-slate-950/30 p-2.5 rounded-xl border border-slate-800 gap-1">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">KELUHAN / DIAGNOSA</span>
                  <span className="font-medium text-slate-300">{ticket.damageDescription}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-800/60 pb-2 flex items-center gap-1.5">
                <span>👤</span> Informasi Pemilik
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-slate-950/30 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">PELANGGAN</span>
                  <span className="font-bold text-white">{ticket.customerName}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-950/30 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">ESTIMASI BIAYA</span>
                  <span className="font-black text-emerald-400 text-sm">Rp {ticket.estimatedCost?.toLocaleString('id-ID')}</span>
                </div>
                {ticket.notes && (
                  <div className="flex flex-col bg-slate-950/30 p-2.5 rounded-xl border border-slate-800 gap-1">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">CATATAN FISIK UNIT</span>
                    <span className="font-medium text-slate-400 italic text-left">"{ticket.notes}"</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Cloudinary Real-Time Photo Attachments */}
        {ticket.attachments && ticket.attachments.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-[2.5rem] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-white">
              <span>📸</span> Lampiran Bukti Visual Pengerjaan
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {ticket.attachments.map((url: string, index: number) => {
                const isVideo = url.toLowerCase().match(/\.(mp4|webm|ogg|mov|3gp)$/) || url.includes('/video/upload/');
                return (
                  <div 
                    key={index} 
                    onClick={() => setPreviewMedia({ url, type: isVideo ? 'video' : 'image' })}
                    className="group relative rounded-2xl overflow-hidden border border-slate-800 aspect-square bg-slate-950 hover:border-accent transition-all shadow-md cursor-pointer"
                  >
                    {isVideo ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-black/65 relative">
                        <span className="text-3xl text-white opacity-80 group-hover:scale-110 transition-transform">📹</span>
                        <span className="text-[9px] font-black text-white uppercase tracking-widest mt-2">Putar Video</span>
                        <div className="absolute inset-0 bg-accent/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ) : (
                      <img src={url} alt={`Bukti Servis ${index + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    )}
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-slate-950/90 border border-slate-850 text-[8px] font-black uppercase text-white rounded-lg shadow-lg z-10">
                      {isVideo ? 'Video' : 'Foto'} {index + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* History Timeline */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-[2.5rem] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <h3 className="text-xs font-black uppercase tracking-wider mb-6 flex items-center gap-2 text-white">
            <span>⏳</span> Log Progres Pengerjaan
          </h3>

          <div className="relative border-l border-slate-850 pl-6 ml-3 space-y-6">
            {ticket.history && [...ticket.history].reverse().map((log: any, idx: number) => {
              const color = STATUS_COLORS[log.status] || STATUS_COLORS.received;
              return (
                <div key={idx} className="relative group">
                  {/* Dot Indicator */}
                  <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full border-2 border-slate-900 bg-accent group-hover:scale-110 transition-transform"></div>
                  
                  <div className="bg-slate-950/20 hover:bg-slate-950/40 p-3.5 rounded-2xl border border-slate-850 transition-colors">
                    <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-500 font-bold">
                        {new Date(log.timestamp).toLocaleString('id-ID')}
                      </span>
                      <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-md border flex items-center gap-1 ${color.bg} ${color.text} ${color.border}`}>
                        <span>{STATUS_EMOJIS[log.status] || '⚡'}</span>
                        <span>{STATUS_LABELS[log.status]}</span>
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-300">{log.notes}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* Pickup Schedule Modal */}
      {isPickupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 max-w-md w-full space-y-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-200 flex items-center gap-2">
                <span>📅</span> Atur Jadwal Pengambilan
              </h3>
              <button onClick={() => setIsPickupModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmPickup} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tanggal Kedatangan</label>
                <input
                  type="date"
                  required
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Estimasi Jam Kedatangan</label>
                <input
                  type="time"
                  required
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Catatan Tambahan (Opsional)</label>
                <textarea
                  value={pickupNotes}
                  onChange={(e) => setPickupNotes(e.target.value)}
                  placeholder="Contoh: Saya ambil sore hari sepulang kerja, tolong siapkan nota cetak."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-accent transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingPickup}
                className="w-full py-4 bg-gradient-to-r from-accent to-indigo-650 hover:from-accent/90 hover:to-indigo-600/90 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-accent/20 disabled:opacity-50"
              >
                {isSubmittingPickup ? 'Menyimpan...' : 'Kirim Konfirmasi Jadwal'}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Fullscreen Media Preview Modal */}
      {previewMedia && (
        <div 
          className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setPreviewMedia(null)}
        >
          <button 
            onClick={() => setPreviewMedia(null)}
            className="absolute top-4 right-4 z-50 p-2.5 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full border border-slate-800 transition-colors shadow-lg"
          >
            <X size={20} />
          </button>
          
          <div 
            className="relative max-w-4xl w-full max-h-[85vh] flex items-center justify-center p-2 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {previewMedia.type === 'video' ? (
              <video 
                src={previewMedia.url} 
                controls 
                autoPlay
                className="w-full max-h-[80vh] rounded-xl shadow-2xl object-contain border border-slate-800 bg-black"
              />
            ) : (
              <img 
                src={previewMedia.url} 
                alt="Preview Bukti Visual" 
                className="max-w-full max-h-[80vh] rounded-xl shadow-2xl object-contain border border-slate-800 bg-black"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
