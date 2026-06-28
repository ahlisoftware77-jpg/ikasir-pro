'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Wrench, Phone, Calendar, AlertTriangle, Shield, CheckCircle, Clock, ArrowLeft, ArrowRight, User, Share2, Camera } from 'lucide-react';
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

function TrackingContent() {
  const searchParams = useSearchParams();
  const ticketNo = searchParams.get('no');
  const ticketId = searchParams.get('id');

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ticketNo && !ticketId) {
      setLoading(false);
      setError('Nomor tiket atau ID tidak boleh kosong.');
      return;
    }

    let unsubscribe: () => void = () => {};

    const loadTicket = async () => {
      try {
        if (ticketId) {
          const docRef = doc(db, 'service_tickets', ticketId);
          unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
              setTicket({ id: docSnap.id, ...docSnap.data() });
              setError('');
            } else {
              setError('Tiket servis tidak ditemukan.');
            }
            setLoading(false);
          });
        } else if (ticketNo) {
          const q = query(collection(db, 'service_tickets'), where('ticketNo', '==', ticketNo));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            const docSnap = querySnap.docs[0];
            const targetDocRef = doc(db, 'service_tickets', docSnap.id);
            unsubscribe = onSnapshot(targetDocRef, (realSnap) => {
              if (realSnap.exists()) {
                setTicket({ id: realSnap.id, ...realSnap.data() });
                setError('');
              }
              setLoading(false);
            });
          } else {
            setError('Tiket servis dengan nomor tersebut tidak ditemukan.');
            setLoading(false);
          }
        }
      } catch (err: any) {
        console.error(err);
        setError('Gagal memuat status: ' + err.message);
        setLoading(false);
      }
    };

    loadTicket();
    return () => unsubscribe();
  }, [ticketNo, ticketId]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-20">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[10px] font-black text-app-text-muted mt-4 uppercase tracking-widest animate-pulse">Menghubungkan ke Server...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="flex flex-col items-center py-20 text-center px-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
          <AlertTriangle className="text-rose-500" size={24} />
        </div>
        <h3 className="text-sm font-black text-foreground mb-1">Tiket Tidak Ditemukan</h3>
        <p className="text-xs text-app-text-muted max-w-xs">{error || 'Data servis tidak ditemukan.'}</p>
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
    return 0; 
  };

  const activeIndex = getStepIndex(ticket.status);

  return (
    <div className="space-y-6">
      {/* Receipt Design layout like /tr */}
      <div className="bg-surface border border-app-border rounded-[2.5rem] p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full filter blur-xl"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-app-border pb-6">
          <div>
            <span className="text-[9px] font-black text-app-text-muted uppercase tracking-wider">No. Tiket Servis</span>
            <h2 className="text-lg font-black text-foreground uppercase mt-0.5">{ticket.ticketNo || `ST-${ticket.id.substring(0, 8).toUpperCase()}`}</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-black text-app-text-muted uppercase tracking-wider">Status Terkini</span>
            <div className={`px-3 py-1 rounded-xl border text-[10px] font-black uppercase ${currentStatusColor.bg} ${currentStatusColor.text} ${currentStatusColor.border}`}>
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

        {/* Detail Info Grid */}
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
                <span className="text-app-text-muted">Gejala Kerusakan:</span>
                <span className="font-bold text-foreground text-right max-w-[200px]">{ticket.damageDescription}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase text-app-text-muted tracking-wider border-b border-app-border/40 pb-1">Informasi Pelanggan</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-app-text-muted">Pelanggan:</span>
                <span className="font-bold text-foreground">{ticket.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-text-muted">Estimasi Biaya:</span>
                <span className="font-black text-emerald-500">Rp {ticket.estimatedCost?.toLocaleString('id-ID')}</span>
              </div>
              {ticket.notes && (
                <div className="flex justify-between">
                  <span className="text-app-text-muted">Catatan Fisik:</span>
                  <span className="font-medium text-app-text-muted">{ticket.notes}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Photo Attachments Section (Real-Time) */}
      {ticket.attachments && ticket.attachments.length > 0 && (
        <div className="bg-surface border border-app-border rounded-[2.5rem] p-6 shadow-xl space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
            <Camera size={14} className="text-accent" />
            Lampiran Foto Bukti Servis
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {ticket.attachments.map((url: string, index: number) => (
              <a 
                key={index} 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="relative rounded-2xl overflow-hidden border border-app-border aspect-square bg-background hover:scale-[1.02] transition-transform shadow-sm cursor-zoom-in"
              >
                <img src={url} alt={`Bukti Servis ${index + 1}`} className="w-full h-full object-cover" />
                <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/75 text-[8px] font-black uppercase text-white rounded">
                  Foto {index + 1}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Timeline Section */}
      <div className="bg-surface border border-app-border rounded-[2.5rem] p-6 shadow-xl">
        <h3 className="text-xs font-black uppercase tracking-wider mb-6 flex items-center gap-2">
          <Clock size={14} className="text-accent" />
          Riwayat Perjalanan Servis
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
  );
}

export default function ServiceReceiptPage() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Top Header matching /tr theme */}
      <div className="bg-surface border-b border-app-border py-4 px-6 sticky top-0 z-40 backdrop-blur-md bg-opacity-80">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center text-accent">
              <Wrench size={18} />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-tight">Pelacakan Servis</h1>
              <p className="text-[9px] font-bold text-app-text-muted">Layanan Online iKasir Pro</p>
            </div>
          </div>
          <span className="text-[9px] font-black uppercase text-accent tracking-widest bg-accent/10 px-2.5 py-1 rounded-lg border border-accent/20">
            Real-Time
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 mt-8">
        <Suspense fallback={
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
          </div>
        }>
          <TrackingContent />
        </Suspense>
      </div>
    </div>
  );
}
