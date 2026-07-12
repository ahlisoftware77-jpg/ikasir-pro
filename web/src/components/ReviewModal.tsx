import { useState } from 'react';
import { Star, X, Loader2 } from 'lucide-react';
import { db, primaryDb, getTenantDb } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, query, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  storeId: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  onSuccess?: () => void;
}

export default function ReviewModal({
  isOpen,
  onClose,
  productId,
  productName,
  storeId,
  orderId,
  customerName,
  customerPhone,
  onSuccess,
}: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);

  if (!isOpen) return null;

  const maskName = (name: string) => {
    if (!name || name.length <= 2) return name;
    const firstTwo = name.substring(0, 2);
    const lastOne = name.substring(name.length - 1);
    const stars = '*'.repeat(Math.max(1, name.length - 3));
    return `${firstTwo}${stars}${lastOne}`;
  };

  const handleSubmit = async () => {
    if (rating < 1 || rating > 5) {
      toast.error('Silakan pilih rating bintang terlebih dahulu.');
      return;
    }

    if (!comment.trim()) {
      toast.error('Silakan tuliskan sedikit komentar ulasan Anda.');
      return;
    }

    setSubmitting(true);
    try {
      let tDb = db;
      if (storeId) {
        const sRef = doc(primaryDb || db, 'stores', storeId);
        const sSnap = await getDoc(sRef);
        if (sSnap.exists()) {
          const cfg = sSnap.data().infraConfig;
          if (cfg) tDb = getTenantDb(cfg);
        } else {
          // Fallback if storeId is actually a projectId (due to old bug)
          const storesQ = query(collection(primaryDb || db, 'stores'));
          const storesSnap = await getDocs(storesQ);
          storesSnap.forEach(d => {
            const cfg = d.data().infraConfig;
            if (cfg && cfg.projectId === storeId) {
              tDb = getTenantDb(cfg);
            }
          });
        }
      }

      const actualName = customerName || customerPhone || 'Pengguna';
      const finalName = isAnonymous ? maskName(actualName) : actualName;

      // 1. Add review to 'reviews' collection
      await addDoc(collection(tDb, 'reviews'), {
        productId,
        productName,
        storeId,
        userId: customerPhone || 'anonymous',
        userName: finalName,
        rating,
        comment: comment.trim(),
        orderId: orderId || null,
        createdAt: serverTimestamp(),
      });

      // 2. Update product aggregate rating
      const pRef = doc(tDb, 'products', productId);
      const pSnap = await getDoc(pRef);
      if (pSnap.exists()) {
        const pData = pSnap.data();
        const currentCount = pData.reviewCount || 0;
        const currentAvg = pData.averageRating || 0;

        const newCount = currentCount + 1;
        const newAvg = ((currentAvg * currentCount) + rating) / newCount;

        await updateDoc(pRef, {
          reviewCount: newCount,
          averageRating: newAvg,
        });
      }

      // 3. Update order document to mark item as reviewed
      if (orderId) {
        const oRef = doc(tDb, 'transactions', orderId);
        const oSnap = await getDoc(oRef);
        if (oSnap.exists()) {
          const oData = oSnap.data();
          if (oData.items) {
            const updatedItems = oData.items.map((item: any) => {
              if (item.productId === productId || item.id === productId) {
                return { ...item, isReviewed: true };
              }
              return item;
            });
            await updateDoc(oRef, { items: updatedItems });
          }
        } else {
          console.error("Order not found in DB! orderId:", orderId);
        }
      }

      toast.success('Ulasan berhasil dikirim. Terima kasih!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error submitting review:', error);
      toast.error(`Gagal mengirim ulasan: ${error.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-sm">Beri Ulasan</h3>
            <p className="text-[10px] text-slate-500 font-bold truncate max-w-[250px]">{productName}</p>
          </div>
          <button 
            onClick={onClose}
            disabled={submitting}
            className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Rating */}
          <div className="flex flex-col items-center gap-3">
            <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Kualitas Produk</span>
            <div className="flex items-center gap-2" onMouseLeave={() => setHoverRating(0)}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  className="p-1 hover:scale-110 active:scale-95 transition-transform"
                >
                  <Star 
                    size={44} 
                    className={`transition-colors ${star <= (hoverRating || rating) ? 'fill-amber-400 text-amber-400 drop-shadow-md' : 'fill-slate-100 text-slate-200 dark:fill-slate-800 dark:text-slate-700'}`} 
                  />
                </button>
              ))}
            </div>
            {rating > 0 || hoverRating > 0 ? (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 bg-amber-500/10 px-4 py-1.5 rounded-full uppercase tracking-wider animate-in zoom-in duration-200">
                {(hoverRating || rating) === 1 ? 'Sangat Buruk 😞' : (hoverRating || rating) === 2 ? 'Buruk 😕' : (hoverRating || rating) === 3 ? 'Cukup 😐' : (hoverRating || rating) === 4 ? 'Baik 🙂' : 'Sangat Baik 🤩'}
              </span>
            ) : (
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-4 py-1.5 rounded-full uppercase tracking-wider">
                Pilih Rating
              </span>
            )}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tulis Komentar Anda</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Bagaimana kualitas produk ini? Apakah sesuai dengan deskripsi?"
              rows={4}
              className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 resize-none font-medium mb-3"
            />
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-colors ${isAnonymous ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600 group-hover:border-emerald-400'}`}>
                {isAnonymous && <span className="text-white text-xs font-bold">✓</span>}
              </div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Sembunyikan nama (Anonim)</span>
              <input type="checkbox" className="hidden" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
          <button
            onClick={handleSubmit}
            disabled={submitting || !comment.trim()}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black rounded-xl text-sm flex items-center justify-center gap-2 transition-colors uppercase tracking-wider"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Mengirim...
              </>
            ) : (
              'Kirim Ulasan'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
