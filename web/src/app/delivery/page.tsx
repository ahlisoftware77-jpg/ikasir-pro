'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Loader2, Truck, User, Building, ClipboardCheck, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

function DeliveryOrderContent() {
  const searchParams = useSearchParams();
  const id = searchParams?.get('id');
  const [trx, setTrx] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [productsMap, setProductsMap] = useState<Record<string, any>>({});
  const [logoDataUri, setLogoDataUri] = useState<string | null>(null);
  const [isLogoReady, setIsLogoReady] = useState(false);
  const [isExpired, setIsExpired] = useState(true);
  const [infraData, setInfraData] = useState<any>(null);

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

            // Check subscription status
            try {
              const q = query(collection(db, 'users'), where('storeId', '==', storeId));
              const userSnaps = await getDocs(q);
              
              let hasActiveSub = false;
              const now = new Date();
              userSnaps.forEach((userDoc: any) => {
                const uData = userDoc.data();
                if (uData.validUntil) {
                  const d = new Date(uData.validUntil);
                  if (!isNaN(d.getTime()) && d > now) {
                    hasActiveSub = true;
                  }
                }
              });
              setIsExpired(!hasActiveSub);
            } catch (err) {
              console.warn("Failed to check subscription status:", err);
            }

            // Fetch infrastructure settings
            try {
              const infraSnap = await getDoc(doc(db, 'system_settings', 'infrastructure'));
              if (infraSnap.exists()) {
                setInfraData(infraSnap.data());
              }
            } catch (err) {
              console.warn("Failed to fetch infrastructure settings:", err);
            }

            // Fetch products for dynamic warranty lookup
            try {
              const qProds = query(collection(db, 'products'), where('storeId', '==', storeId));
              const prodsSnap = await getDocs(qProds);
              const pMap: Record<string, any> = {};
              prodsSnap.forEach(d => {
                const data = d.data();
                pMap[d.id] = data;
                if (data.name) {
                  pMap[data.name] = data;
                }
              });
              setProductsMap(pMap);
            } catch (err) {
              console.warn("Failed to fetch products for dynamic warranty in delivery page:", err);
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

  // Check if feature is locked
  const { role } = useAuthStore();
  const isPaidFeature = infraData?.paid_print_delivery ?? false;
  const isLocked = isExpired && isPaidFeature && role !== 'super-admin' && role !== 'superadmin';

  useEffect(() => {
    if (!loading && trx && isLogoReady && !isLocked) {
      // Set document title for suggested PDF filename
      const storeName = (settings?.storeName || 'IKASIR PRO').split('@')[0];
      const docId = trx.id?.substring(0, 10).toUpperCase();
      document.title = `${storeName} - SJ-${docId}`;

      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, trx, isLogoReady, settings?.storeName, isLocked]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="bg-white border border-slate-200 p-8 md:p-12 rounded-[2rem] shadow-2xl max-w-md w-full space-y-6">
          <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950 text-rose-500 rounded-2xl flex items-center justify-center mx-auto animate-bounce">
            <ShieldAlert size={36} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider">Fitur Premium Terkunci</h2>
            <p className="text-xs text-slate-500 font-bold leading-relaxed">
              Fitur pencetakan Surat Jalan A4 saat ini dikonfigurasi sebagai fitur berbayar oleh Superadmin. Silakan lakukan perpanjangan paket premium Kasir Pro Anda untuk menggunakan fitur ini.
            </p>
          </div>
          <button 
            onClick={() => window.close()} 
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg"
          >
            Tutup Halaman
          </button>
        </div>
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
                        {(() => {
                          const prodId = item.productId;
                          const prodName = item.productName || item.name;
                          let catalogProduct = null;
                          if (prodId && productsMap[prodId]) {
                            catalogProduct = productsMap[prodId];
                          } else if (prodName && productsMap[prodName]) {
                            catalogProduct = productsMap[prodName];
                          }

                          let wInfo = null;
                          if (catalogProduct && catalogProduct.warrantyDuration) {
                            wInfo = {
                              duration: catalogProduct.warrantyDuration,
                              unit: catalogProduct.warrantyUnit || 'months'
                            };
                          } else if (item.warrantyDuration) {
                            wInfo = {
                              duration: item.warrantyDuration,
                              unit: item.warrantyUnit || 'months'
                            };
                          }

                          let wStartDate: Date | null = null;
                          if (trx.paymentHistory && trx.paymentHistory.length > 0) {
                            const sorted = [...trx.paymentHistory].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                            wStartDate = new Date(sorted[0].date);
                          } else if ((trx.paidAmount ?? trx.cashReceived ?? 0) > 0 || trx.paymentStatus === 'paid') {
                            wStartDate = trx.timestamp?.toDate ? trx.timestamp.toDate() : new Date(trx.timestamp);
                          }

                          let expiryDate: Date | null = null;
                          if (item.warrantyExpiry) {
                            expiryDate = new Date(item.warrantyExpiry);
                          } else if (wStartDate && wInfo) {
                            const expiry = new Date(wStartDate);
                            const dur = wInfo.duration;
                            const u = wInfo.unit;
                            if (u === 'days') {
                              expiry.setDate(expiry.getDate() + dur);
                            } else if (u === 'months') {
                              expiry.setMonth(expiry.getMonth() + dur);
                            } else if (u === 'years') {
                              expiry.setFullYear(expiry.getFullYear() + dur);
                            }
                            expiryDate = expiry;
                          }

                          if (!wInfo && !expiryDate) return null;

                          if (expiryDate) {
                            return (
                              <p className="text-[8px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
                                🛡 Garansi s/d: {expiryDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                              </p>
                            );
                          } else {
                            return (
                              <p className="text-[8px] text-blue-600 font-bold mt-1 flex items-center gap-1">
                                🛡 Garansi: {wInfo?.duration} {wInfo?.unit === 'days' ? 'Hari' : wInfo?.unit === 'months' ? 'Bulan' : 'Tahun'} (Belum Aktif)
                              </p>
                            );
                          }
                        })()}
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
