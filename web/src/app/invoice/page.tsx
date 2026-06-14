'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, Printer, MapPin, Phone, Globe, CreditCard, History } from 'lucide-react';

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

function InvoiceA4Content() {
  const searchParams = useSearchParams();
  const id = searchParams?.get('id');
  const [trx, setTrx] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const isEstimation = searchParams?.get('type') === 'estimation';
  const isDebt = searchParams?.get('type') === 'debt' || trx?.paymentCategory === 'debt';
  const [logoDataUri, setLogoDataUri] = useState<string | null>(null);
  const [isLogoReady, setIsLogoReady] = useState(false);

  // Effect to fetch and convert logo to Base64
  useEffect(() => {
    if (loading) return;

    const embedLogo = async () => {
      try {
        const logoToFetch = settings?.logoUrl || '/logo.png';
        const response = await fetch(logoToFetch);
        
        if (response.ok) {
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            setLogoDataUri(reader.result as string);
            setIsLogoReady(true);
          };
          reader.readAsDataURL(blob);
        } else {
          // If custom logo fails, try the default /logo.png
          if (settings?.logoUrl) {
            const fallback = await fetch('/logo.png');
            if (fallback.ok) {
              const blob = await fallback.blob();
              const reader = new FileReader();
              reader.onloadend = () => {
                setLogoDataUri(reader.result as string);
                setIsLogoReady(true);
              };
              reader.readAsDataURL(blob);
              return;
            }
          }
          setIsLogoReady(true);
        }
      } catch (err) {
        console.error("Logo embed error:", err);
        setIsLogoReady(true);
      }
    };
    embedLogo();
  }, [loading, settings?.logoUrl]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const collectionName = isEstimation ? 'estimations' : 'transactions';
        const trxSnap = await getDoc(doc(db, collectionName, id as string));
        if (trxSnap.exists()) {
          const trxData = { id: trxSnap.id, ...trxSnap.data() as any };
          setTrx(trxData);

          const storeId = trxData.storeId;
          if (storeId) {
            const settingsSnap = await getDoc(doc(db, 'settings', `store_${storeId}`));
            if (settingsSnap.exists()) {
              setSettings(settingsSnap.data());
            }
          }
        }
      } catch (err) {
        console.error("Error fetching invoice data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchData();
  }, [id]);

  useEffect(() => {
    // Only print if everything is loaded including the logo base64
    if (!loading && trx && isLogoReady) {
      // Set document title for suggested PDF filename
      const storeName = (settings?.storeName || 'IKASIR PRO').split('@')[0];
      const docType = isEstimation ? 'EST' : 'INV';
      const docId = trx.id?.substring(0, 10).toUpperCase();
      document.title = `${storeName} - ${docType}-${docId}`;

      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, trx, isLogoReady, settings?.storeName, isEstimation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!trx) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-gray-500 font-bold">
        Data Transaksi Tidak Ditemukan
      </div>
    );
  }

  const date = trx.timestamp?.toDate ? trx.timestamp.toDate() : (trx.timestamp instanceof Date ? trx.timestamp : new Date());
  const total = trx.total || 0;
  // Standardize paid amount using paidAmount or cashReceived fallback
  const paid = trx.paidAmount ?? trx.cashReceived ?? 0;
  const sisa = trx.paymentStatus === 'paid' ? 0 : Math.max(0, total - paid);

  const terbilang = (n: number): string => {
    const words = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
    let res = "";
    if (n < 12) res = words[n];
    else if (n < 20) res = terbilang(n - 10) + " Belas";
    else if (n < 100) res = terbilang(Math.floor(n / 10)) + " Puluh " + terbilang(n % 10);
    else if (n < 1000) res = terbilang(Math.floor(n / 100)) + " Ratus " + terbilang(n % 100);
    else if (n < 1000000) res = terbilang(Math.floor(n / 1000)) + " Ribu " + terbilang(n % 1000);
    else if (n < 1000000000) res = terbilang(Math.floor(n / 1000000)) + " Juta " + terbilang(n % 1000000);
    return res.trim();
  };

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0 font-sans">
      <div className="bg-white text-black p-[15mm] w-[210mm] min-h-[297mm] mx-auto shadow-2xl print:shadow-none print:w-full print:p-[10mm] relative">
        {/* HEADER SECTION - USING TABLE FOR MAXIMUM PRINT STABILITY */}
        <table className="w-full mb-6 border-b-2 border-slate-900">
          <tbody>
            <tr>
              <td className="w-[70px] pb-4">
                <div className="w-[64px] h-[64px] flex items-center justify-center logo-container">
                  {logoDataUri ? (
                    <img 
                      src={logoDataUri} 
                      alt="Logo" 
                      style={{ 
                        width: '64px', 
                        height: '64px', 
                        display: 'block',
                        objectFit: 'contain'
                      }}
                    />
                  ) : (
                    <div className="w-[64px] h-[64px] bg-slate-100 rounded" />
                  )}
                </div>
              </td>
              <td className="pb-4 align-middle">
                <h1 
                  style={{ fontFamily: getFontFamily(settings?.storeNameFont) }}
                  className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-0.5 leading-none"
                >
                  {(settings?.storeName || 'IKASIR PRO STORE').includes('@') ? (settings?.storeName || 'IKASIR PRO STORE').split('@')[0] : (settings?.storeName || 'IKASIR PRO STORE')}
                </h1>
                <div className="text-[9px] text-slate-500 font-bold max-w-xs space-y-0.5 leading-tight">
                  <p>{settings?.address || 'Alamat Belum Diatur'}</p>
                  <p>Telp: {settings?.phone || '-'}</p>
                </div>
              </td>
              <td className="pb-4 text-right align-top">
                <h2 className="text-2xl font-black text-slate-200 tracking-[0.2em] mb-2 leading-none uppercase">
                  {isEstimation 
                    ? 'ESTIMASI BIAYA' 
                    : trx.paymentStatus === 'paid' 
                      ? 'INVOICE' 
                      : trx.paymentStatus === 'partially_paid' 
                        ? 'INVOICE (PIUTANG)' 
                        : 'INVOICE (BELUM LUNAS)'}
                </h2>
                <div className="text-[9px] font-black uppercase space-y-0.5 leading-none">
                  <p className="text-slate-900">{isEstimation ? 'NO. PENAWARAN' : 'NO.'} #{trx.id?.substring(0, 10).toUpperCase()}</p>
                  <p className="text-slate-400 font-bold">{date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* CUSTOMER & STATUS */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Tagihan Kepada:</p>
             <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight leading-none">{trx.customerName || 'Pelanggan Umum'}</p>
             {trx.customerPhone && <p className="text-[9px] text-slate-500 font-bold mt-1 leading-none">{trx.customerPhone}</p>}
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex justify-between items-center">
             <div className="leading-none">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{isEstimation ? 'Masa Berlaku:' : 'Status:'}</p>
                {isEstimation ? (
                  <p className="text-[10px] font-black text-emerald-600 uppercase">
                    s/d {new Date(trx.validUntil).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                ) : (
                  <div className={`text-[10px] font-black uppercase flex items-center gap-1.5 ${
                    trx.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${trx.paymentStatus === 'paid' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                    {trx.paymentStatus === 'paid' ? 'Lunas' : trx.paymentStatus === 'partially_paid' ? 'Piutang' : 'Belum Lunas'}
                  </div>
                )}
             </div>
             {trx.dueDate && !isEstimation && trx.paymentStatus !== 'paid' && (
               <div className="text-right leading-none">
                  <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1">Jatuh Tempo:</p>
                  <p className="text-[10px] font-black text-rose-600">{new Date(trx.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
               </div>
             )}
          </div>
        </div>

        {/* TABLE SECTION */}
        <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
          <table className="w-full text-[10px] border-collapse">
            <thead>
               <tr className="bg-slate-900 text-white font-black uppercase tracking-widest text-[8px] border-b border-slate-900">
                  <th className="p-2 py-3 text-left w-[55%]">Nama Barang / Deskripsi</th>
                  <th className="p-2 text-center">Harga Satuan</th>
                  <th className="p-2 text-center">Qty</th>
                  <th className="p-2 text-right">Total</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {trx.items?.map((item: any, idx: number) => (
                 <tr key={idx} className="font-bold align-top">
                    <td className="p-2 py-3">
                       <p className="text-slate-900 text-[11px] font-black tracking-tight leading-tight">{item.productName || item.name}</p>
                       {item.warrantyExpiry && (
                         <p className="text-[8px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
                           🛡 Garansi s/d: {new Date(item.warrantyExpiry).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                         </p>
                       )}
                       {item.selectedExtras && item.selectedExtras.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                             {item.selectedExtras.map((ext: any, eIdx: number) => (
                                <span key={eIdx} className="text-[7px] bg-slate-100 border border-slate-200 text-slate-500 px-1 py-0.5 rounded leading-none">
                                   + {ext.optionName}
                                </span>
                             ))}
                          </div>
                       )}
                       {item.note && <p className="text-[8px] text-amber-500 font-bold italic mt-1 leading-tight italic">Catatan: {item.note}</p>}
                    </td>
                    <td className="p-2 py-3 text-center text-slate-500">Rp {item.price?.toLocaleString('id-ID')}</td>
                    <td className="p-2 py-3 text-center text-slate-900">{item.qty || item.quantity} {item.unit || 'pcs'}</td>
                    <td className="p-2 py-3 text-right text-slate-900 font-black">
                      Rp {(item.subtotal || (item.price * (item.qty || item.quantity))).toLocaleString('id-ID')}
                    </td>
                 </tr>
               ))}
            </tbody>
          </table>
        </div>

        {/* FOOTER SECTION */}
        <div className="grid grid-cols-2 gap-8 mb-6">
          <div className="space-y-4">
             <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Terbilang:</p>
                <p className="text-[10px] font-black italic text-slate-700 leading-tight">" {terbilang(total)} Rupiah "</p>
             </div>
             {settings?.bankInfo && (
               <div className="px-1 text-[9px] border-l-[3px] border-emerald-500 pl-3">
                  <p className="font-black text-emerald-600 uppercase text-[8px] tracking-widest mb-1">Info Pembayaran / Transfer:</p>
                  <p className="font-bold text-slate-800 whitespace-pre-line leading-normal">{settings.bankInfo}</p>
               </div>
             )}
             <p className="text-[8px] text-slate-400 font-bold italic leading-tight whitespace-pre-line">
                {isEstimation 
                  ? (settings?.a4EstimationNote || "* Penawaran harga ini berlaku selama masa aktif yang tertera di atas.\n* Barang yang telah diproses tidak dapat dibatalkan secara sepihak.\n* Dokumen ini dibuat otomatis oleh sistem dan sah tanpa tanda tangan basah.") 
                  : isDebt 
                    ? (settings?.a4DebtNote || "* Sisa tagihan piutang wajib dilunasi sebelum jatuh tempo.\n* Pembayaran cicilan yang sah harus tercatat di sistem.")
                    : (settings?.a4InvoiceNote || "* Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.\n* Invoice ini adalah bukti pembayaran yang sah.")
                }
             </p>
          </div>
          <div className="space-y-1.5 pt-2">
             <div className="flex justify-between text-[10px] font-bold text-slate-400 px-2 transition-all">
                <span>Subtotal</span>
                <span>Rp {((trx.total || 0) - (trx.tax || 0)).toLocaleString('id-ID')}</span>
             </div>
             {trx.tax > 0 && (
                <div className="flex justify-between text-[10px] font-bold text-slate-400 px-2 transition-all">
                   <span>Pajak (VAT {trx.taxRate}%)</span>
                   <span>Rp {trx.tax.toLocaleString('id-ID')}</span>
                </div>
             )}
             <div className="flex justify-between bg-slate-900 text-white p-3 rounded-lg text-sm font-black shadow-lg shadow-slate-900/10">
                <span className="tracking-widest text-[10px]">TOTAL</span>
                <span className="text-base tracking-tighter">Rp {total.toLocaleString('id-ID')}</span>
            </div>
            
            {!isEstimation && (
              <div className="pt-2 gap-1 flex flex-col">
                <div className="flex justify-between text-[10px] font-black text-slate-400 px-2">
                    <span className="uppercase text-[8px]">Telah Dibayar</span>
                    <span className="text-emerald-600 text-xs">Rp {paid.toLocaleString('id-ID')}</span>
                </div>
                {sisa > 0 && (
                  <div className="flex justify-between bg-rose-50 text-rose-600 p-2 px-3 rounded-lg border border-rose-100 font-black">
                      <span className="text-[9px] uppercase tracking-widest">Sisa Tagihan</span>
                      <span className="text-xs">Rp {sisa.toLocaleString('id-ID')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* PAYMENT HISTORY FOR DEBTS */}
        {trx.paymentHistory && trx.paymentHistory.length > 0 && (
          <div className="mb-6 pt-4 border-t-2 border-dashed border-slate-100">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-3">Rincian Riwayat Pembayaran:</p>
            <div className="space-y-1.5">
               {trx.paymentHistory.map((hist: any, hIdx: number) => (
                 <div key={hIdx} className="flex justify-between items-center text-[10px] font-bold text-slate-600 bg-slate-50/50 px-4 py-2 rounded-xl border border-dotted border-slate-200">
                    <div className="flex items-center gap-4">
                       <div className="w-12 text-slate-400 font-black text-[9px]">{new Date(hist.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}</div>
                       <div className="flex flex-col">
                          <span className="text-slate-900 text-[10px] uppercase font-black tracking-tight">{hist.note || 'Pembayaran'}</span>
                          <span className="text-[8px] text-slate-400 italic font-medium">Oleh: {hist.cashierName?.includes('@') ? hist.cashierName.split('@')[0] : (hist.cashierName || 'Kasir')}</span>
                       </div>
                    </div>
                    <span className="text-slate-900 font-black">Rp {hist.amount?.toLocaleString('id-ID')}</span>
                 </div>
               ))}
            </div>
          </div>
        )}

        {/* SIGNATURE SECTION */}
        <div className="mt-8 flex justify-between px-16 text-center">
          <div className="w-32 relative">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-12">Hormat Kami,</p>
             {settings?.showSignature && settings?.signatureUrl && (
               <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
                 <img 
                    src={settings.signatureUrl} 
                    alt="Signature" 
                    className="h-16 w-auto object-contain mix-blend-multiply" 
                    style={{ maxHeight: '60px' }}
                 />
               </div>
             )}
             <div className="border-b-[1.5px] border-slate-900 mb-1"></div>
             <p className="text-[10px] font-black uppercase text-slate-800 tracking-tighter leading-none">
                {trx.cashierName?.includes('@') ? trx.cashierName.split('@')[0] : (trx.cashierName || 'Store Admin')}
             </p>
          </div>
          <div className="w-32 relative">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-12">Penerima,</p>
             {trx?.signatureBase64 && (
               <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
                 <img 
                    src={trx.signatureBase64} 
                    alt="Customer Signature" 
                    className="h-16 w-auto object-contain mix-blend-multiply" 
                    style={{ maxHeight: '60px' }}
                 />
               </div>
             )}
             <div className="border-b-[1.5px] border-slate-200 mb-1"></div>
             <p className="text-[10px] font-black uppercase text-slate-300 tracking-tighter leading-none">
                {trx?.signatureBase64 ? trx.customerName || 'Pelanggan' : 'Sign & Stamp'}
             </p>
          </div>
        </div>

        {/* FOOTER WATERMARK */}
        <div className="absolute bottom-6 left-0 right-0 text-center opacity-20 pointer-events-none select-none">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.5em]">IKASIR PRO - MODERN POS SYSTEM</p>
        </div>
      </div>
      
      {/* PRINT STYLES */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            background: white !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .min-h-screen {
            padding: 0 !important;
            background: white !important;
          }
          .bg-white {
            box-shadow: none !important;
            padding: 10mm !important;
            width: 100% !important;
            min-height: auto !important;
          }
          img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            display: block !important;
            visibility: visible !important;
          }
          .logo-container {
            display: flex !important;
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function InvoiceA4Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
      </div>
    }>
      <InvoiceA4Content />
    </Suspense>
  );
}
