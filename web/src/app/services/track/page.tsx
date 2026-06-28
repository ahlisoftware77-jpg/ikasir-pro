'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Wrench, Phone, Calendar, AlertTriangle, Shield, CheckCircle, RefreshCw, X, ArrowLeft, Clock } from 'lucide-react';
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

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  received: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
  checking: { bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/20' },
  pending_part: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
  repairing: { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/20' },
  completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' },
  cancelled: { bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/20' },
  taken: { bg: 'bg-slate-500/10', text: 'text-slate-500', border: 'border-slate-500/20' }
};

export default function ServiceTrackPage() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('id');

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-app-text-muted mt-4 uppercase tracking-wider animate-pulse">Menghubungkan ke Server...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6">
          <AlertTriangle className="text-rose-500" size={32} />
        </div>
        <h1 className="text-lg font-black text-foreground mb-2">Pencarian Gagal</h1>
        <p className="text-xs font-bold text-app-text-muted max-w-sm mb-8 leading-relaxed">{error || 'Tiket tidak ditemukan.'}</p>
        <Link href="/" className="px-6 py-3 bg-accent text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-accent/80 transition-all shadow-lg">
          Kembali ke Beranda
        </Link>
      </div>
    );
  }

  const currentStatusColor = STATUS_COLORS[ticket.status] || STATUS_COLORS.received;
  
  // Progress steps
  const steps = [
    { key: 'received', label: 'Diterima' },
    { key: 'checking', label: 'Pengecekan' },
    { key: 'repairing', label: 'Perbaikan' },
    { key: 'completed', label: 'Selesai' },
    { key: 'taken', label: 'Diambil' }
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
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Top Banner */}
      <div className="bg-surface border-b border-app-border py-4 px-6 sticky top-0 z-40 backdrop-blur-md bg-opacity-80">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center text-accent">
              <Wrench size={18} />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-tight">Status Servis Perangkat</h1>
              <p className="text-[10px] font-bold text-app-text-muted">Layanan Pelacakan Online iKasir Pro</p>
            </div>
          </div>
          <span className="text-[9px] font-black uppercase text-accent tracking-widest bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
            Real-Time
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-300">
        {/* Main Status Card */}
        <div className="bg-surface border border-app-border rounded-[2.5rem] p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full filter blur-xl"></div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-app-border pb-6">
            <div>
              <span className="text-[9px] font-black text-app-text-muted uppercase tracking-wider">Nomor Tiket</span>
              <h2 className="text-lg font-black text-foreground uppercase mt-0.5">#ST-{ticket.id.substring(0, 8).toUpperCase()}</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-black text-app-text-muted uppercase tracking-wider">Status Terkini</span>
              <div className={`px-4 py-1.5 rounded-xl border text-xs font-black uppercase ${currentStatusColor.bg} ${currentStatusColor.text} ${currentStatusColor.border}`}>
                {STATUS_LABELS[ticket.status]}
              </div>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          {ticket.status !== 'cancelled' && (
            <div className="py-8 border-b border-app-border">
              <div className="relative flex justify-between items-center w-full">
                {/* Connector Line */}
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-app-border rounded-full z-0">
                  <div 
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{ width: `${(activeIndex / (steps.length - 1)) * 100}%` }}
                  ></div>
                </div>

                {/* Step Dots */}
                {steps.map((step, idx) => {
                  const isCompleted = idx <= activeIndex;
                  const isActive = idx === activeIndex;

                  return (
                    <div key={step.key} className="flex flex-col items-center z-10 relative">
                      <div 
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                          isActive 
                            ? 'bg-accent border-accent text-white scale-110 shadow-lg shadow-accent/25' 
                            : isCompleted 
                            ? 'bg-accent/10 border-accent text-accent' 
                            : 'bg-surface border-app-border text-app-text-muted'
                        }`}
                      >
                        {isCompleted && !isActive ? (
                          <CheckCircle size={14} className="stroke-[3px]" />
                        ) : (
                          <span className="text-[10px] font-black">{idx + 1}</span>
                        )}
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-wider mt-2.5 ${isActive ? 'text-accent' : 'text-app-text-muted'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Device & Client Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 text-xs">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase text-app-text-muted tracking-wider border-b border-app-border/40 pb-1">Detail Perangkat</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-app-text-muted">Model / Perangkat:</span>
                  <span className="font-bold text-foreground">{ticket.deviceModel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-app-text-muted">S/N atau IMEI:</span>
                  <span className="font-bold text-foreground">{ticket.serialNumber || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-app-text-muted">Keluhan / Kerusakan:</span>
                  <span className="font-bold text-foreground text-right max-w-[200px]">{ticket.damageDescription}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase text-app-text-muted tracking-wider border-b border-app-border/40 pb-1">Informasi Pemilik</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-app-text-muted">Nama Pelanggan:</span>
                  <span className="font-bold text-foreground">{ticket.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-app-text-muted">Estimasi Biaya:</span>
                  <span className="font-black text-emerald-500">Rp {ticket.estimatedCost?.toLocaleString('id-ID')}</span>
                </div>
                {ticket.notes && (
                  <div className="flex justify-between">
                    <span className="text-app-text-muted">Catatan Pelengkap:</span>
                    <span className="font-medium text-app-text-muted">{ticket.notes}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* History Timeline */}
        <div className="bg-surface border border-app-border rounded-[2.5rem] p-6 shadow-xl">
          <h3 className="text-sm font-black uppercase tracking-wider mb-6 flex items-center gap-2">
            <Clock size={16} className="text-accent" />
            Riwayat Progress Perbaikan
          </h3>

          <div className="relative border-l border-app-border/80 pl-6 ml-2.5 space-y-6">
            {ticket.history && [...ticket.history].reverse().map((log: any, idx: number) => {
              const color = STATUS_COLORS[log.status] || STATUS_COLORS.received;
              return (
                <div key={idx} className="relative">
                  {/* Dot Badge */}
                  <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full border-2 border-surface bg-accent"></div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] text-app-text-muted font-bold">
                        {new Date(log.timestamp).toLocaleString('id-ID')}
                      </span>
                      <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded ${color.bg} ${color.text}`}>
                        {STATUS_LABELS[log.status]}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-foreground">{log.notes}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
