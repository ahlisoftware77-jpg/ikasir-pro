import React from 'react';
import { 
  Store, 
  Smartphone, 
  BarChart3, 
  Users, 
  Box, 
  Receipt,
  ShieldCheck,
  Zap,
  Globe,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Fitur - iKasir Pro',
  description: 'Temukan fitur-fitur unggulan iKasir Pro yang akan membantu mengembangkan bisnis Anda.',
};

const features = [
  {
    icon: <Globe size={32} className="text-emerald-500" />,
    title: 'Toko Online Terintegrasi (Marketplace)',
    description: 'Bukan sekadar kasir. Aplikasi ini otomatis membuatkan link toko online agar pelanggan bisa belanja dari rumah.',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10'
  },
  {
    icon: <Receipt size={32} className="text-blue-500" />,
    title: 'Cetak Struk Bluetooth (ESC/POS)',
    description: 'Cetak struk secara instan melalui printer kasir thermal bluetooth langsung dari HP Anda tanpa ribet kabel.',
    bg: 'bg-blue-50 dark:bg-blue-500/10'
  },
  {
    icon: <Box size={32} className="text-purple-500" />,
    title: 'Manajemen Stok & Kadaluarsa',
    description: 'Stok terpotong otomatis saat transaksi. Dilengkapi fitur peringatan stok menipis dan sistem tracking tanggal expired barang.',
    bg: 'bg-purple-50 dark:bg-purple-500/10'
  },
  {
    icon: <Zap size={32} className="text-orange-500" />,
    title: 'Mode Kasir Offline',
    description: 'Internet putus? Tidak masalah! Transaksi kasir tetap berjalan lancar dan otomatis tersinkronisasi saat internet kembali.',
    bg: 'bg-orange-50 dark:bg-orange-500/10'
  },
  {
    icon: <Users size={32} className="text-pink-500" />,
    title: 'Sistem Otorisasi (Owner & Kasir)',
    description: 'Bagi tugas dengan aman. Pegawai Kasir hanya bisa transaksi, sementara Owner memegang kendali penuh laporan & stok.',
    bg: 'bg-pink-50 dark:bg-pink-500/10'
  },
  {
    icon: <BarChart3 size={32} className="text-cyan-500" />,
    title: 'Laporan Omzet & Laba Cloud',
    description: 'Pantau laporan penjualan harian, bulanan, laporan shift, hingga grafik laba-rugi kapan saja dari dashboard web.',
    bg: 'bg-cyan-50 dark:bg-cyan-500/10'
  },
];

export default function FiturPage() {
  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-400/20 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-teal-400/20 rounded-full blur-[100px]"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center animate-in fade-in slide-in-from-bottom-10 duration-1000">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-sm mb-6 border border-emerald-200 dark:border-emerald-500/20">
            <Zap size={16} /> Fitur Unggulan
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white mb-6 leading-tight">
            Semua yang Anda butuhkan <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">
              untuk sukses
            </span>
          </h1>
          <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
            Tinggalkan cara lama. Beralih ke sistem cerdas yang mempercepat transaksi, 
            mencegah kebocoran stok, dan meningkatkan loyalitas pelanggan Anda.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/register" 
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:scale-105 transition-transform shadow-xl shadow-slate-900/20 dark:shadow-white/20"
            >
              Coba Gratis Sekarang
            </Link>
            <Link 
              href="/tentang-kami" 
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
            >
              Pelajari Lebih Lanjut
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-white dark:bg-[#080B13] border-t border-slate-100 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 animate-in fade-in duration-700">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4">Fitur Utama Kami</h2>
            <p className="text-slate-500 dark:text-slate-400">Dirancang khusus untuk memenuhi kebutuhan UMKM di Indonesia.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="group p-8 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:shadow-2xl hover:shadow-slate-200/50 dark:hover:shadow-black/50 transition-all duration-300 hover:-translate-y-2 animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`w-16 h-16 rounded-2xl ${feature.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{feature.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-24 overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-[80px]"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px]"></div>
            
            <ShieldCheck size={64} className="text-emerald-400 mx-auto mb-8 animate-bounce" style={{ animationDuration: '3s' }} />
            <h2 className="text-3xl md:text-5xl font-black text-white mb-6">Keamanan Data Terjamin</h2>
            <p className="text-slate-300 text-lg max-w-2xl mx-auto mb-10">
              Infrastruktur cloud kami memastikan data toko dan pelanggan Anda tersimpan dengan aman, 
              terenkripsi, dan selalu dicadangkan (backup) secara otomatis setiap saat.
            </p>
            <div className="flex items-center justify-center gap-8 flex-wrap">
              <div className="flex items-center gap-2 text-white font-bold">
                <CheckCircle2 className="text-emerald-400" /> Server Global (Google Cloud)
              </div>
              <div className="flex items-center gap-2 text-white font-bold">
                <CheckCircle2 className="text-emerald-400" /> Enkripsi Data
              </div>
              <div className="flex items-center gap-2 text-white font-bold">
                <CheckCircle2 className="text-emerald-400" /> Uptime 99.9%
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
