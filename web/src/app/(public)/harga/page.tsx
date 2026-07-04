'use client';

import React, { useMemo } from 'react';
import { Check, X, Star } from 'lucide-react';
import Link from 'next/link';
import { useBranding } from '@/context/BrandingContext';

export default function HargaPage() {
  const { branding } = useBranding();

  const pricingPlans = useMemo(() => {
    const pkgs = [
      { id: '1m', name: '1 Bulan', defaultPrice: 30000, months: 1, period: '/bulan', description: 'Cocok untuk memulai dan mencoba fitur.', popular: false },
      { id: '3m', name: '3 Bulan', defaultPrice: 84000, months: 3, period: '/3 bulan', description: 'Pas untuk bisnis yang sedang mencari pola.', popular: false },
      { id: '6m', name: '6 Bulan', defaultPrice: 159000, months: 6, period: '/6 bulan', description: 'Lebih hemat untuk bisnis yang sedang berkembang.', popular: true },
      { id: '12m', name: '1 Tahun', defaultPrice: 306000, months: 12, period: '/tahun', description: 'Investasi terbaik dengan harga termurah per bulan.', popular: false },
    ];

    return pkgs.map(p => {
      const priceKey = `pkg_${p.id}_price`;
      const typeKey = `pkg_${p.id}_discount_type`;
      const valKey = `pkg_${p.id}_discount_val`;

      const basePrice = Number((branding as any)[priceKey] ?? p.defaultPrice);
      const discountType = (branding as any)[typeKey] || 'none';
      const discountVal = Number((branding as any)[valKey] ?? 0);

      let finalPrice = basePrice;
      let discountLabel = '';

      if (discountType === 'percent') {
        finalPrice = Math.max(0, basePrice * (1 - discountVal / 100));
        discountLabel = `${discountVal}% OFF`;
      } else if (discountType === 'nominal') {
        finalPrice = Math.max(0, basePrice - discountVal);
        discountLabel = `HEMAT Rp ${discountVal.toLocaleString('id-ID')}`;
      }

      return {
        ...p,
        price: `Rp ${finalPrice.toLocaleString('id-ID')}`,
        basePrice: `Rp ${basePrice.toLocaleString('id-ID')}`,
        hasDiscount: finalPrice < basePrice,
        discountLabel,
        features: [
          { name: 'Akses Semua Fitur Utama', included: true },
          { name: 'Kasir & Manajemen Stok', included: true },
          { name: 'Laporan Penjualan Lengkap', included: true },
          { name: 'Manajemen Pegawai', included: true },
          { name: 'Toko Online (Marketplace)', included: true },
        ],
        buttonText: p.popular ? 'Mulai Lebih Hemat' : 'Pilih Paket Ini',
        buttonClass: p.popular 
          ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/30' 
          : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
      };
    });
  }, [branding]);

  // Kita hanya menampilkan 3 paket utama agar pas di grid 3 kolom (1 Bulan, 6 Bulan, 1 Tahun)
  const displayPlans = pricingPlans.filter(p => p.id !== '3m');

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative pt-20 pb-20 overflow-hidden bg-slate-50 dark:bg-[#0B0F19]">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-10 duration-1000">
            <h1 className="text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-6">
              Harga Transparan, <br/> 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-blue-500">
                Sesuai Skala Bisnis Anda
              </span>
            </h1>
            <p className="text-xl text-slate-500 dark:text-slate-400 leading-relaxed mb-10">
              Mulai secara gratis, tingkatkan saat bisnis Anda berkembang. 
              Pilih paket yang paling sesuai dengan kebutuhan operasional toko Anda.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Table Section */}
      <section className="pb-32 bg-slate-50 dark:bg-[#0B0F19]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            
            {displayPlans.map((plan, index) => (
              <div 
                key={index} 
                className={`relative bg-white dark:bg-[#080B13] rounded-3xl p-8 border ${
                  plan.popular 
                    ? 'border-emerald-500 shadow-2xl shadow-emerald-500/20 -translate-y-4' 
                    : 'border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none'
                } transition-transform hover:-translate-y-2 duration-300`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="bg-emerald-500 text-white text-xs font-black px-4 py-1.5 rounded-full flex items-center gap-1 shadow-lg shadow-emerald-500/30 uppercase tracking-widest">
                      <Star size={14} fill="currentColor" /> Paling Laris
                    </div>
                  </div>
                )}

                {plan.hasDiscount && (
                  <div className="absolute top-4 right-4 bg-rose-500 text-white text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider">
                    {plan.discountLabel}
                  </div>
                )}
                
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{plan.name}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 h-10">{plan.description}</p>
                
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-black text-slate-900 dark:text-white">{plan.price}</span>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">{plan.period}</span>
                </div>
                
                {plan.hasDiscount ? (
                  <div className="text-sm text-slate-400 line-through mb-6">
                    Harga Normal: {plan.basePrice}
                  </div>
                ) : (
                  <div className="mb-6 h-5"></div>
                )}
                
                <Link 
                  href="/register" 
                  className={`block w-full py-3 px-4 rounded-xl text-center font-bold mb-8 transition-all ${plan.buttonClass}`}
                >
                  {plan.buttonText}
                </Link>
                
                <div className="space-y-4">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      {feature.included ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500 flex-shrink-0">
                          <Check size={14} strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                          <X size={14} strokeWidth={3} />
                        </div>
                      )}
                      <span className={`text-sm font-medium ${
                        feature.included ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 line-through'
                      }`}>
                        {feature.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
          </div>
        </div>
      </section>
      
      {/* FAQ / Guarantee Section */}
      <section className="py-24 bg-white dark:bg-[#080B13] border-t border-slate-100 dark:border-slate-800/50">
        <div className="max-w-4xl mx-auto px-6 text-center">
           <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-6">Masih Ragu?</h2>
           <p className="text-lg text-slate-500 dark:text-slate-400 mb-10 max-w-2xl mx-auto">
             Jangan khawatir, Anda bisa mencoba secara gratis tanpa komitmen apapun. Jika Anda merasa aplikasi ini tidak cocok, Anda tidak perlu melanjutkan perpanjangan.
           </p>
           <Link 
             href="/register"
             className="inline-flex justify-center items-center py-4 px-8 rounded-2xl text-base font-bold text-slate-900 bg-white border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
           >
             Coba Gratis Sekarang
           </Link>
        </div>
      </section>
    </div>
  );
}
