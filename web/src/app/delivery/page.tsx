'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, Truck, User, Building, ClipboardCheck } from 'lucide-react';

function DeliveryOrderContent() {
  const searchParams = useSearchParams();
  const id = searchParams?.get('id');
  const [trx, setTrx] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
        const trxSnap = await getDoc(doc(db, 'transactions', id as string));
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
        console.error("Error fetching delivery data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchData();
  }, [id]);

  useEffect(() => {
    if (!loading && trx && isLogoReady) {
      // Set document title for suggested PDF filename
      const storeName = (settings?.storeName || 'IKASIR PRO').split('@')[0];
      const docId = trx.id?.substring(0, 10).toUpperCase();
      document.title = `${storeName} - SJ-${docId}`;

      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, trx, isLogoReady, settings?.storeName]);

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

  const date = trx.timestamp?.toDate ? trx.timestamp.toDate() : new Date();

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
                <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-0.5 leading-none">
                  {(settings?.storeName || 'IKASIR PRO STORE').includes('@') ? (settings?.storeName || 'IKASIR PRO STORE').split('@')[0] : (settings?.storeName || 'IKASIR PRO STORE')}
                </h1>
                <div className="text-[9px] text-slate-500 font-bold max-w-xs space-y-0.5 leading-tight">
                  <p>{settings?.address || 'Alamat Belum Diatur'}</p>
                  <p>Telp: {settings?.phone || '-'}</p>
                </div>
              </td>
              <td className="pb-4 text-right align-top">
                <h2 className="text-2xl font-black text-slate-200 tracking-[0.2em] mb-2 leading-none uppercase">SURAT JALAN</h2>
                <div className="text-[9px] font-black uppercase space-y-0.5 leading-none">
                  <p className="text-slate-900">REF. #{trx.id?.substring(0, 10).toUpperCase()}</p>
                  <p className="text-slate-400 font-bold">Tgl Kirim: {date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* SHIPMENT INFO */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Building size={10} /> Penerima / Tujuan:
             </p>
             <p className="text-[12px] font-black text-slate-900 uppercase tracking-tight leading-none text-wrap">{trx.customerName || 'Pelanggan Umum'}</p>
             {trx.customerPhone && <p className="text-[9px] text-slate-500 font-bold mt-1 leading-none">{trx.customerPhone}</p>}
          </div>
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex flex-col justify-center">
             <div className="flex justify-between items-center">
                <div>
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <Truck size={10} /> Informasi Pengiriman:
                   </p>
                   <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-600">No. Kendaraan: <span className="text-slate-300">........................</span></p>
                      <p className="text-[10px] font-bold text-slate-600">Nama Driver: <span className="text-slate-300">........................</span></p>
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* TABLE SECTION */}
        <div className="border border-slate-200 rounded-lg overflow-hidden mb-8">
          <table className="w-full text-[10px] border-collapse">
            <thead>
               <tr className="bg-slate-900 text-white font-black uppercase tracking-widest text-[8px] border-b border-slate-900">
                  <th className="p-2 py-3 text-left w-[8%]">No</th>
                  <th className="p-2 py-3 text-left w-[72%]">Nama Barang / Deskripsi</th>
                  <th className="p-2 text-center w-[20%]">Quantity</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {trx.items?.map((item: any, idx: number) => (
                 <tr key={idx} className="font-bold align-top break-inside-avoid">
                    <td className="p-2 py-3 text-slate-400">{idx + 1}</td>
                    <td className="p-2 py-3">
                       <p className="text-slate-900 text-[11px] font-black tracking-tight leading-tight">{item.productName || item.name}</p>
                       {item.selectedExtras && item.selectedExtras.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                             {item.selectedExtras.map((ext: any, eIdx: number) => (
                                <span key={eIdx} className="text-[7px] bg-slate-100 border border-slate-200 text-slate-500 px-1 py-0.5 rounded leading-none">
                                   + {ext.optionName}
                                </span>
                             ))}
                          </div>
                       )}
                       {item.note && <p className="text-[8px] text-amber-500 font-bold italic mt-1 leading-tight">Catatan: {item.note}</p>}
                    </td>
                    <td className="p-2 py-3 text-center text-slate-900 font-black text-[12px]">
                      {item.qty || item.quantity} {item.unit || 'pcs'}
                    </td>
                 </tr>
               ))}
               {/* Add empty rows if items are few to make it look full */}
               {trx.items?.length < 5 && Array.from({ length: 5 - trx.items.length }).map((_, i) => (
                 <tr key={`empty-${i}`} className="h-10 border-none">
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                 </tr>
               ))}
            </tbody>
          </table>
        </div>

        {/* NOTES SECTION */}
        <div className="mb-12">
           <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                 <ClipboardCheck size={10} /> Keterangan Tambahan:
              </p>
              <div className="h-12 flex flex-col justify-end">
                 <div className="border-b border-slate-200 w-full mb-2"></div>
                 <div className="border-b border-slate-200 w-full"></div>
              </div>
           </div>
        </div>

        {/* SIGNATURE SECTION */}
        <div className="grid grid-cols-3 gap-4 text-center break-inside-avoid">
          <div className="space-y-12">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Penerima,</p>
             <div className="px-4">
                <div className="border-b-[1.5px] border-slate-900 mb-1"></div>
                <p className="text-[8px] font-bold text-slate-300 italic">Nama Terang & Stempel</p>
             </div>
          </div>
          <div className="space-y-12">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sopir / Pengantar,</p>
             <div className="px-4">
                <div className="border-b-[1.5px] border-slate-900 mb-1"></div>
                <p className="text-[8px] font-bold text-slate-300 italic">Nama Terang</p>
             </div>
          </div>
          <div className="space-y-12">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Hormat Kami,</p>
             <div className="px-4">
                <div className="border-b-[1.5px] border-slate-900 mb-1"></div>
                <p className="text-[10px] font-black uppercase text-slate-800 tracking-tighter leading-none">{trx.cashierName?.split('@')[0] || 'Store Admin'}</p>
             </div>
          </div>
        </div>

        {/* FOOTER WATERMARK */}
        <div className="absolute bottom-6 left-0 right-0 text-center opacity-20 pointer-events-none select-none">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.5em]">IKASIR PRO - DELIVERY SYSTEM</p>
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

export default function DeliveryOrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
      </div>
    }>
      <DeliveryOrderContent />
    </Suspense>
  );
}
