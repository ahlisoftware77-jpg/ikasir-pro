'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { useBranding } from '@/context/BrandingContext';
import { X, Check, Camera, Loader2, Info, MessageCircle } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getInfraConfig } from '@/lib/infraConfig';
import toast from 'react-hot-toast';

export default function SubscriptionModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { user, storeId } = useAuthStore();
  const { branding } = useBranding();
  
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [subscriptionProofBase64, setSubscriptionProofBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const SUBSCRIPTION_PACKAGES = [
    { id: '1m', title: '1 Bulan', price: 30000, desc: 'Rp 30.000 / bln' },
    { id: '3m', title: '3 Bulan', price: 84000, desc: 'Rp 28.000 / bln (Hemat Rp 6.000)' },
    { id: '6m', title: '6 Bulan', price: 159000, desc: 'Rp 26.500 / bln (Hemat Rp 21.000)' },
    { id: '12m', title: '12 Bulan', price: 306000, desc: 'Rp 25.500 / bln (Hemat Rp 54.000)' },
  ];

  if (!isOpen) return null;

  const handlePickProof = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSubscriptionProofBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPackage || !subscriptionProofBase64) {
      toast.error('Pilih paket dan unggah bukti pembayaran terlebih dahulu.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const config = await getInfraConfig();
      const cloudName = config.cloudinary_cloud_name || 'dkcjfwbvc';
      const uploadPreset = config.cloudinary_upload_preset || 'kasirpos';

      const uploadData = new FormData();
      uploadData.append('file', subscriptionProofBase64);
      uploadData.append('upload_preset', uploadPreset);

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: uploadData
      });
      const uploadResult = await uploadRes.json();
      
      if (uploadResult.secure_url) {
        await addDoc(collection(db, 'subscription_requests'), {
          storeId: storeId,
          ownerUid: user?.uid || '',
          ownerEmail: user?.email || '',
          packageId: selectedPackage.id,
          packageTitle: selectedPackage.title,
          price: selectedPackage.price,
          proofUrl: uploadResult.secure_url,
          status: 'pending',
          createdAt: serverTimestamp()
        });
        toast.success('Bukti pembayaran berhasil dikirim. Menunggu verifikasi admin pusat.');
        setIsSuccess(true);
      } else {
        console.error("Cloudinary Error:", uploadResult);
        toast.error('Gagal mengunggah gambar: ' + (uploadResult.error?.message || 'Server error'));
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal memproses langganan: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
      <div className="bg-surface border border-app-border rounded-[2rem] w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95">
        
        {/* Header */}
        <div className="p-6 border-b border-app-border flex items-center justify-between bg-surface/50">
          <div>
            <h2 className="text-xl font-black text-foreground">Menu Langganan</h2>
            <p className="text-xs text-app-text-muted font-bold">Pilih paket untuk memperpanjang masa aktif</p>
          </div>
          <button 
            onClick={() => { onClose(); setSelectedPackage(null); setIsSuccess(false); }}
            className="w-10 h-10 rounded-xl bg-app-border/50 hover:bg-app-border flex items-center justify-center transition-colors"
          >
            <X size={20} className="text-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {isSuccess ? (
            <div className="space-y-6 text-center">
              <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <Check size={40} strokeWidth={3} />
              </div>
              <h3 className="text-2xl font-black text-foreground">Bukti Terkirim!</h3>
              <p className="text-sm font-bold text-app-text-muted">Pembayaran Anda sedang kami proses. Untuk mempercepat verifikasi, silakan konfirmasi ke admin kami melalui WhatsApp.</p>
              
              <a 
                href="https://wa.me/6283815862300?text=Halo%20Admin%20IKASIR%20PRO,%20saya%20sudah%20mengirim%20bukti%20pembayaran%20untuk%20perpanjangan%20langganan%20aplikasi%20saya.%20Mohon%20segera%20diverifikasi." 
                target="_blank" 
                rel="noreferrer"
                className="w-full group relative overflow-hidden flex items-center justify-center gap-3 py-5 rounded-2xl font-black transition-all active:scale-95 shadow-2xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20 mt-4"
              >
                 <MessageCircle size={20} />
                 <span className="uppercase tracking-[0.2em] text-xs">Konfirmasi via WhatsApp</span>
                 <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
              </a>

              <button 
                onClick={() => { setIsSuccess(false); onClose(); setSelectedPackage(null); setSubscriptionProofBase64(null); }} 
                className="w-full py-3 mt-4 items-center justify-center flex text-app-text-muted hover:text-foreground transition-colors"
              >
                <span className="text-[10px] font-black uppercase tracking-wider">Tutup</span>
              </button>
            </div>
          ) : !selectedPackage ? (
            <div className="space-y-4">
              {SUBSCRIPTION_PACKAGES.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg)}
                  className="w-full p-5 rounded-2xl border border-app-border bg-background hover:border-emerald-500/50 hover:bg-emerald-500/5 flex items-center justify-between group transition-all text-left"
                >
                  <div>
                    <h3 className="text-base font-black text-foreground group-hover:text-emerald-500 transition-colors">{pkg.title}</h3>
                    <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest">{pkg.desc}</p>
                  </div>
                  <div className="bg-emerald-500/10 px-4 py-2 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
                    <span className="text-[10px] font-black text-emerald-500 tracking-wider">PILIH</span>
                  </div>
                </button>
              ))}
              <div className="flex items-start gap-3 mt-6 p-4 rounded-xl bg-background/50 border border-app-border">
                <Info size={16} className="text-app-text-muted flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-app-text-muted italic leading-relaxed">
                  Pilih paket yang sesuai dengan kebutuhan bisnis Anda. Harga sudah termasuk pajak.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Selected Package Details */}
              <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-center">
                <p className="text-[10px] font-bold text-app-text-muted uppercase tracking-widest mb-1">Paket Pilihan Anda</p>
                <h3 className="text-2xl font-black text-emerald-500">{selectedPackage.title}</h3>
                <p className="text-sm font-bold text-foreground mt-1">Total Tagihan: Rp {selectedPackage.price.toLocaleString('id-ID')}</p>
              </div>

              {/* Payment Details */}
              <div className="space-y-4 text-center">
                <h4 className="text-sm font-black text-foreground">Metode Pembayaran</h4>
                
                {branding.subscriptionQrisUrl && (
                  <div className="flex flex-col items-center">
                    <p className="text-[10px] font-bold text-app-text-muted uppercase mb-3">Scan QRIS</p>
                    <div className="p-3 bg-white rounded-2xl border border-app-border shadow-sm inline-block w-48 h-48">
                      <img src={branding.subscriptionQrisUrl} alt="QRIS Langganan" className="w-full h-full object-contain" />
                    </div>
                  </div>
                )}

                {branding.subscriptionBankInfo && (
                  <div className="mt-4">
                    <p className="text-[10px] font-bold text-app-text-muted uppercase mb-2">Atau Transfer ke Rekening</p>
                    <div className="p-4 bg-white rounded-2xl border border-app-border inline-block min-w-[250px]">
                      <p className="text-sm font-black text-slate-800 whitespace-pre-wrap">{branding.subscriptionBankInfo}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Proof */}
              <div className="mt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-app-text-muted mb-3 ml-1">Upload Bukti Pembayaran</p>
                <label className={`block w-full h-40 border-2 border-dashed rounded-2xl overflow-hidden cursor-pointer transition-colors relative group flex items-center justify-center ${subscriptionProofBase64 ? 'border-accent' : 'border-app-border hover:border-app-border/80 bg-background/50'}`}>
                  {subscriptionProofBase64 ? (
                    <>
                       <img src={subscriptionProofBase64} alt="Bukti" className="w-full h-full object-cover" />
                       <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="text-white text-xs font-bold bg-black/60 px-4 py-2 rounded-xl backdrop-blur-sm">Ganti Gambar</span>
                       </div>
                    </>
                  ) : (
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-surface border border-app-border flex items-center justify-center mx-auto mb-3 shadow-sm group-hover:scale-110 transition-transform">
                        <Camera size={20} className="text-app-text-muted" />
                      </div>
                      <span className="text-xs font-bold text-app-text-muted">Klik untuk pilih gambar bukti transfer</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePickProof} />
                </label>
              </div>

              {/* Actions */}
              <div className="pt-4 space-y-3">
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-white shadow-xl shadow-accent/20 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isSubmitting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <Check size={18} strokeWidth={3} />
                      <span className="font-black text-xs uppercase tracking-wider">Kirim Bukti Pembayaran</span>
                    </>
                  )}
                </button>

                <button 
                  onClick={() => { setSelectedPackage(null); setSubscriptionProofBase64(null); }} 
                  className="w-full py-3 items-center justify-center flex text-app-text-muted hover:text-foreground transition-colors"
                >
                  <span className="text-[10px] font-black uppercase tracking-wider">Ganti Paket</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
