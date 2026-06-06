'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import SignaturePad from '@/components/SignaturePad';
import { Loader2, CheckCircle2, FileSignature, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

function SignatureContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const type = searchParams?.get('type') || '';
  const id = searchParams?.get('id') || '';
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [docData, setDocData] = useState<any>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const collectionName = type === 'est' ? 'estimations' : 'transactions';

  useEffect(() => {
    if (!type || !id) {
       setError('Parameter URL tidak lengkap.');
       setLoading(false);
       return;
    }
    
    const fetchDoc = async () => {
      try {
        const docRef = doc(db, collectionName, id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDocData(data);
          if (data.signatureBase64) {
            setSuccess(true);
          }
        } else {
          setError('Dokumen tidak ditemukan.');
        }
      } catch (err: any) {
        if (err.code === 'permission-denied') {
          setError('Link tanda tangan tidak aktif atau sudah kadaluarsa. Silakan minta link baru kepada admin.');
        } else {
          setError(err.message || 'Terjadi kesalahan');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchDoc();
  }, [type, id, collectionName]);

  const handleSaveSignature = async (base64: string) => {
    setSaving(true);
    try {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, {
        signatureBase64: base64,
        isSignatureLinkActive: false, // Matikan link setelah berhasil tanda tangan
        updatedAt: new Date().toISOString()
      });
      setSuccess(true);
      toast.success('Tanda tangan berhasil disimpan!');
    } catch (err: any) {
      toast.error('Gagal menyimpan tanda tangan');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Loader2 className="w-10 h-10 animate-spin text-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-[2rem] shadow-xl max-w-sm w-full">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-black text-slate-900 mb-2">Akses Ditolak</h2>
          <p className="text-slate-500 font-medium mb-6">{error}</p>
          <button onClick={() => router.back()} className="w-full py-3 bg-slate-100 text-slate-900 rounded-xl font-bold">Kembali</button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-[2rem] shadow-xl max-w-sm w-full animate-in zoom-in-95 duration-300">
          <CheckCircle2 className="w-20 h-20 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-900 mb-2">Terima Kasih!</h2>
          <p className="text-slate-500 font-medium mb-8">Tanda tangan Anda telah berhasil direkam ke dalam dokumen.</p>
          <button 
            onClick={() => window.close()} 
            className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
          >
            Tutup Halaman
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 overflow-hidden overscroll-none" style={{ overscrollBehavior: 'none' }}>
      <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
        <div className="p-8 border-b border-slate-100 bg-slate-900 text-white">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white">
              <FileSignature size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter">Form Tanda Tangan</h1>
              <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold mt-1">Dokumen ID: {id?.substring(0,8)}</p>
            </div>
          </div>
          <div className="bg-white/10 p-4 rounded-xl">
             <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold mb-1">Nama Pelanggan:</p>
             <p className="text-sm font-black">{docData?.customerName || 'Pelanggan Umum'}</p>
          </div>
        </div>

        <div className="p-8">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 text-center">
            Silakan Tanda Tangan di Bawah Ini
          </p>

          <div className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm">
            <SignaturePad 
              onSave={handleSaveSignature} 
              initialImage={docData?.signatureBase64}
              className="w-full"
            />
          </div>
          
          {saving && (
             <div className="mt-4 flex items-center justify-center gap-2 text-accent text-sm font-bold animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...
             </div>
          )}
        </div>
      </div>
      <p className="mt-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Powered by IKASIR PRO</p>
    </div>
  );
}

export default function SignaturePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Loader2 className="w-10 h-10 animate-spin text-accent" />
      </div>
    }>
      <SignatureContent />
    </Suspense>
  );
}
