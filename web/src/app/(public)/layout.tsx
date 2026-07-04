import React from 'react';
import AuthHeader from '@/components/AuthHeader';
import Link from 'next/link';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 font-sans flex flex-col">
      <AuthHeader />
      
      <main className="flex-1 pt-20">
        {children}
      </main>

      {/* Public Footer */}
      <footer className="bg-white dark:bg-[#0B0F19] border-t border-slate-200 dark:border-slate-800 py-12 px-6 mt-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-black text-sm">
                K
              </div>
              <span className="font-black text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300">
                IKASIR <span className="text-emerald-500">PRO</span>
              </span>
            </Link>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-sm mb-6">
              Sistem kasir cerdas dan modern yang membantu ribuan pengusaha di Indonesia untuk mengelola penjualan, stok, dan pelanggan dalam satu platform terpadu.
            </p>
            <p className="text-xs text-slate-400 font-medium">
              &copy; {new Date().getFullYear()} iKasir Pro. Hak Cipta Dilindungi.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-4">Perusahaan</h4>
            <ul className="space-y-3">
              <li><Link href="/tentang-kami" className="text-sm text-slate-500 dark:text-slate-400 hover:text-emerald-500 transition-colors">Tentang Kami</Link></li>
              <li><Link href="/fitur" className="text-sm text-slate-500 dark:text-slate-400 hover:text-emerald-500 transition-colors">Fitur</Link></li>
              <li><Link href="/harga" className="text-sm text-slate-500 dark:text-slate-400 hover:text-emerald-500 transition-colors">Harga</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-4">Bantuan</h4>
            <ul className="space-y-3">
              <li><Link href="/panduan" className="text-sm text-slate-500 dark:text-slate-400 hover:text-emerald-500 transition-colors">Panduan Pengguna</Link></li>
              <li><Link href="/faq" className="text-sm text-slate-500 dark:text-slate-400 hover:text-emerald-500 transition-colors">FAQ</Link></li>
              <li><Link href="https://wa.me/6281234567890" target="_blank" className="text-sm text-slate-500 dark:text-slate-400 hover:text-emerald-500 transition-colors">Hubungi CS</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
