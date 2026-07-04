import React from 'react';
import { ShieldCheck, Heart, Smartphone, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Tentang Kami - iKasir Pro',
  description: 'Mengenal lebih dekat iKasir Pro sebagai solusi kasir digital andalan UMKM.',
};

export default function TentangKamiPage() {
  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative pt-20 pb-24 overflow-hidden bg-slate-50 dark:bg-[#0B0F19]">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/4 -right-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-0 -left-1/4 w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-[120px]"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-10 duration-1000">
            <h1 className="text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-6">
              Membangun Solusi Kasir <br/> 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-blue-500">
                yang Nyata dan Praktis
              </span>
            </h1>
            <p className="text-xl text-slate-500 dark:text-slate-400 leading-relaxed mb-10">
              iKasir Pro hadir dari pemahaman sederhana: setiap usaha membutuhkan pencatatan yang rapi tanpa kerumitan. Kami membangun sistem kasir yang bekerja cepat, bisa digunakan secara offline, dan langsung terhubung ke laporan digital.
            </p>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-24 bg-white dark:bg-[#080B13] border-y border-slate-100 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            
            <div className="text-center group">
              <div className="w-20 h-20 mx-auto bg-blue-50 dark:bg-blue-500/10 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 group-hover:rotate-6">
                <Smartphone size={40} className="text-blue-500" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Sederhana & Fleksibel</h3>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                Kami merancang antarmuka kasir yang mudah dipahami dalam hitungan menit. Tetap bisa mencatat penjualan dengan lancar meski tanpa koneksi internet.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 mx-auto bg-emerald-50 dark:bg-emerald-500/10 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 group-hover:-rotate-6">
                <Heart size={40} className="text-emerald-500" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Mendukung Pertumbuhan</h3>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                Mulai dari fitur pencatatan stok otomatis hingga integrasi toko online mandiri (Marketplace), aplikasi kami dibuat untuk mengikuti alur perkembangan bisnis Anda.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 mx-auto bg-orange-50 dark:bg-orange-500/10 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 group-hover:rotate-6">
                <ShieldCheck size={40} className="text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Aman & Terkendali</h3>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                Pembagian hak akses yang jelas antara kasir dan pemilik toko memastikan operasional berjalan aman. Laporan penjualan dan laba juga bisa dipantau dari mana saja.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-slate-50 dark:bg-[#0B0F19]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-6">
            Mulai kelola usaha Anda dengan lebih rapi
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400 mb-10">
            Daftar sekarang dan nikmati kemudahan mencatat transaksi penjualan.
          </p>
          <Link 
            href="/register" 
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:scale-105 transition-transform shadow-xl shadow-slate-900/20 dark:shadow-white/20"
          >
            Mulai Tanpa Biaya
          </Link>
        </div>
      </section>

    </div>
  );
}
