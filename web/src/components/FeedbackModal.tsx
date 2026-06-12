'use client';

import React, { useState } from 'react';
import { X, Check, Loader2, MessageSquare } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { primaryDb } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';
import toast from 'react-hot-toast';

export default function FeedbackModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, storeId } = useAuthStore();
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!feedbackText.trim()) {
      toast.error('Harap isi kritik & saran Anda.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(primaryDb, 'feedback'), {
        storeId: storeId || 'unknown',
        userEmail: user?.email || 'unknown',
        content: feedbackText,
        createdAt: serverTimestamp(),
        platform: 'web'
      });
      toast.success('Terima kasih! Kritik & saran Anda berhasil dikirim.');
      setFeedbackText('');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal mengirim masukan: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
      <div className="bg-surface border border-app-border rounded-[2rem] w-full max-w-md shadow-2xl animate-in zoom-in-95 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-app-border flex items-center justify-between bg-surface/50">
          <div>
            <h2 className="text-xl font-black text-foreground">Kritik & Saran</h2>
            <p className="text-xs text-app-text-muted font-bold">Kirim masukan Anda untuk perbaikan Kasir Pro</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-app-border/50 hover:bg-app-border flex items-center justify-center transition-colors"
          >
            <X size={20} className="text-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex gap-3 p-4 rounded-2xl bg-accent/5 border border-accent/10">
            <MessageSquare className="text-accent flex-shrink-0 mt-0.5" size={18} />
            <p className="text-xs text-app-text-muted leading-relaxed">
              Masukan, kritik, dan saran Anda sangat berharga bagi kami untuk terus mengembangkan fitur-fitur baru dan menyempurnakan Kasir Pro.
            </p>
          </div>

          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Tulis kritik, saran, atau laporan masalah Anda di sini..."
            rows={5}
            className="w-full p-4 bg-background border border-app-border rounded-2xl text-sm font-bold text-foreground focus:outline-none focus:border-accent transition-colors resize-none"
          />

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3.5 rounded-2xl border border-app-border hover:bg-surface font-black text-xs uppercase tracking-wider text-app-text-muted transition-all"
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-[2] py-3.5 bg-accent hover:bg-accent/90 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Check size={16} strokeWidth={3} />
                  <span>Kirim Masukan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
