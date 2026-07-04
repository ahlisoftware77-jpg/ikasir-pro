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
  CheckCircle2,
  BookOpen,
  ArrowRight,
  Settings,
  ShoppingCart
} from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Fitur & Panduan - iKasir Pro',
  description: 'Temukan fitur-fitur unggulan iKasir Pro dan panduan lengkap cara menggunakannya.',
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

const manualSteps = [
  {
    step: '01',
    title: 'Pendaftaran & Pengaturan Awal Toko',
    icon: <Store size={24} className="text-white" />,
    color: 'bg-blue-500 shadow-blue-500/30',
    details: [
      'Daftar akun baru dan verifikasi email Anda.',
      'Masuk ke menu Pengaturan Toko untuk mengisi nama toko, alamat, dan informasi kontak.',
      'Unggah logo toko yang akan ditampilkan di struk digital maupun cetak.',
      'Tentukan hak akses untuk kasir dan staf lainnya melalui menu Pengguna.'
    ]
  },
  {
    step: '02',
    title: 'Manajemen Inventaris & Produk',
    icon: <Box size={24} className="text-white" />,
    color: 'bg-purple-500 shadow-purple-500/30',
    details: [
      'Buka menu Produk, lalu tambahkan kategori produk untuk mengelompokkan barang.',
      'Klik Tambah Produk, isi nama, harga beli, harga jual, dan stok awal barang.',
      'Tambahkan informasi kadaluarsa (expired date) jika Anda menjual makanan atau obat.',
      'Gunakan fitur scan barcode dari HP untuk mempercepat pencarian barang.'
    ]
  },
  {
    step: '03',
    title: 'Proses Transaksi Penjualan (POS)',
    icon: <ShoppingCart size={24} className="text-white" />,
    color: 'bg-emerald-500 shadow-emerald-500/30',
    details: [
      'Masuk ke layar POS (Point of Sale). Pilih barang secara manual atau gunakan pemindai barcode.',
      'Masukkan diskon (jika ada) dan pilih metode pembayaran (Tunai, QRIS, Transfer).',
      'Jika transaksi selesai, pilih untuk mencetak struk thermal bluetooth atau mengirim struk digital (PDF) via WhatsApp.',
      'Stok akan otomatis berkurang dan pendapatan tercatat secara real-time di sistem.'
    ]
  },
  {
    step: '04',
    title: 'Monitoring Laporan & Analisis',
    icon: <BarChart3 size={24} className="text-white" />,
    color: 'bg-orange-500 shadow-orange-500/30',
    details: [
      'Buka menu Laporan (Dashboard Web) untuk melihat grafik omzet dan laba bersih secara langsung.',
      'Analisis produk mana yang paling laku (Top 5 Produk) dan mana yang stoknya menipis.',
      'Unduh laporan transaksi dalam format Excel atau PDF untuk pembukuan bulanan.',
      'Pantau shift kasir dan pastikan arus kas tercatat dengan presisi.'
    ]
  },
  {
    step: '05',
    title: 'Integrasi Toko Online (Marketplace)',
    icon: <Globe size={24} className="text-white" />,
    color: 'bg-pink-500 shadow-pink-500/30',
    details: [
      'Aktifkan fitur Toko Online di dashboard. Sistem akan membuatkan link unik untuk toko Anda.',
      'Bagikan link tersebut ke pelanggan melalui media sosial atau WhatsApp.',
      'Pelanggan dapat melihat katalog produk dan melakukan pemesanan langsung dari browser HP mereka tanpa perlu menginstall aplikasi.',
      'Pesanan dari pelanggan akan langsung muncul sebagai notifikasi di aplikasi iKasir Pro Anda.'
    ]
  }
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
            <Zap size={16} /> Detail & Panduan Lengkap
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white mb-6 leading-tight">
            Mengenal Lebih Dalam <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">
              Sistem iKasir Pro
            </span>
          </h1>
          <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
            Sebuah solusi ekosistem digital untuk bisnis. Dari kasir pintar hingga toko online mandiri yang bekerja secara sinkron layaknya tim profesional Anda.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-white dark:bg-[#080B13] border-t border-slate-100 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 animate-in fade-in duration-700">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4">Fitur Inti Penunjang Bisnis</h2>
            <p className="text-slate-500 dark:text-slate-400">Dirancang khusus untuk memenuhi kebutuhan UMKM modern.</p>
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

      {/* Manual Book Section */}
      <section className="py-24 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800/50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-20 animate-in fade-in duration-700">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 mb-6">
              <BookOpen size={32} />
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-4">Manual Book & Cara Kerja</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
              Langkah demi langkah yang transparan untuk membuktikan betapa mudah dan real-nya proses operasional menggunakan sistem iKasir Pro.
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-12 relative before:absolute before:inset-0 before:ml-[2.25rem] md:before:ml-[50%] before:-translate-x-px md:before:translate-x-0 before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 before:via-blue-500 before:to-transparent">
            {manualSteps.map((step, index) => (
              <div key={index} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group ${index % 2 === 0 ? 'md:pr-12' : 'md:pl-12'}`}>
                {/* Timeline Dot & Icon */}
                <div className={`absolute left-0 md:left-1/2 flex h-16 w-16 -translate-x-0 md:-translate-x-1/2 items-center justify-center rounded-2xl border-4 border-slate-50 dark:border-slate-900 shadow-xl z-10 ${step.color} transform transition-transform group-hover:scale-110`}>
                  {step.icon}
                </div>

                {/* Content Card */}
                <div className="w-[calc(100%-5rem)] md:w-[calc(50%-3rem)] p-6 md:p-8 rounded-[2rem] bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-lg hover:shadow-xl transition-shadow ml-auto md:mx-0 relative">
                  <div className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-slate-800 border-t border-r border-slate-100 dark:border-slate-700 rotate-45 ${index % 2 === 0 ? 'hidden md:block -right-2' : 'hidden md:block -left-2 border-b-0 border-r-0 border-l border-t'}`}></div>
                  <div className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-slate-800 border-t border-l border-slate-100 dark:border-slate-700 -rotate-45 -left-2 md:hidden`}></div>
                  
                  <span className="text-sm font-black text-slate-400 dark:text-slate-500 mb-2 block tracking-widest uppercase">Langkah {step.step}</span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mb-4">{step.title}</h3>
                  <ul className="space-y-3">
                    {step.details.map((detail, idx) => (
                      <li key={idx} className="flex gap-3 text-slate-600 dark:text-slate-300 leading-relaxed text-sm">
                        <ArrowRight size={16} className="shrink-0 mt-0.5 text-slate-400" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-24 overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-[80px]"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px]"></div>
            
            <ShieldCheck size={64} className="text-emerald-400 mx-auto mb-8 animate-bounce" style={{ animationDuration: '3s' }} />
            <h2 className="text-3xl md:text-5xl font-black text-white mb-6">Infrastruktur Nyata & Aman</h2>
            <p className="text-slate-300 text-lg max-w-2xl mx-auto mb-10">
              Sistem ini berjalan di atas teknologi Google Cloud yang handal. Data transaksi, stok, hingga pelanggan Anda disinkronisasikan secara real-time antar perangkat dengan enkripsi kelas tinggi.
            </p>
            <div className="flex items-center justify-center gap-8 flex-wrap">
              <div className="flex items-center gap-2 text-white font-bold bg-white/10 px-4 py-2 rounded-full border border-white/10">
                <CheckCircle2 className="text-emerald-400" /> Real-time Database
              </div>
              <div className="flex items-center gap-2 text-white font-bold bg-white/10 px-4 py-2 rounded-full border border-white/10">
                <CheckCircle2 className="text-emerald-400" /> Auto Backup
              </div>
              <div className="flex items-center gap-2 text-white font-bold bg-white/10 px-4 py-2 rounded-full border border-white/10">
                <CheckCircle2 className="text-emerald-400" /> Multi-Platform (Web & App)
              </div>
            </div>
            
            <div className="mt-16">
              <Link 
                href="/register" 
                className="inline-flex px-8 py-4 rounded-full bg-emerald-500 text-white font-black hover:bg-emerald-400 hover:scale-105 transition-all shadow-xl shadow-emerald-500/20 uppercase tracking-widest text-sm"
              >
                Mulai Gunakan iKasir Pro
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
