'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Store, LayoutDashboard, Tag, Info, User, ArrowRight } from 'lucide-react';

export default function AuthHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Fitur', path: '/fitur', icon: LayoutDashboard },
    { name: 'Harga', path: '/harga', icon: Tag },
    { name: 'Tentang', path: '/tentang-kami', icon: Info },
  ];

  const isActive = (path: string) => pathname === path;

  return (
    <header 
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/70 dark:bg-[#0B0F19]/70 backdrop-blur-lg border-b border-white/20 dark:border-white/10 shadow-sm' 
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-300 border-2 border-white/20">
            K
          </div>
          <span className="font-black text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300">
            IKASIR <span className="text-emerald-500">PRO</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link 
              key={link.name} 
              href={link.path}
              className={`relative font-bold text-sm tracking-wide transition-colors duration-300 ${
                isActive(link.path) 
                  ? 'text-emerald-500' 
                  : 'text-slate-600 dark:text-slate-300 hover:text-emerald-500'
              }`}
            >
              {link.name}
              {isActive(link.path) && (
                <span className="absolute -bottom-2 left-0 w-full h-1 bg-emerald-500 rounded-t-full animate-in fade-in zoom-in-95" />
              )}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-4">
          {pathname !== '/login' && (
            <Link 
              href="/login" 
              className="font-bold text-sm text-slate-700 dark:text-white hover:text-emerald-500 transition-colors"
            >
              Masuk
            </Link>
          )}
          {pathname !== '/register' && (
            <Link 
              href="/register" 
              className="group flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-slate-900/20 dark:shadow-white/20"
            >
              Coba Gratis
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="md:hidden p-2 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-white dark:bg-[#0B0F19] animate-in fade-in zoom-in-95 duration-300 md:hidden flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-black">K</div>
              <span className="font-black text-lg">IKASIR <span className="text-emerald-500">PRO</span></span>
            </div>
            <button 
              className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="flex flex-col p-6 gap-6 overflow-y-auto">
            <nav className="flex flex-col gap-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Navigasi Utama</h3>
              
              <Link 
                href="/" 
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-4 text-lg font-bold text-slate-800 dark:text-white p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
              >
                <Store size={24} className="text-emerald-500" />
                Beranda
              </Link>
              
              {navLinks.map((link) => (
                <Link 
                  key={link.name}
                  href={link.path} 
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-4 text-lg font-bold p-3 rounded-2xl transition-colors ${
                    isActive(link.path) 
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                      : 'text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-900'
                  }`}
                >
                  <link.icon size={24} className={isActive(link.path) ? 'text-emerald-500' : 'text-slate-400'} />
                  {link.name}
                </Link>
              ))}
            </nav>

            <div className="mt-8 flex flex-col gap-3">
              {pathname !== '/login' && (
                <Link 
                  href="/login" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-4 text-center rounded-2xl border-2 border-slate-200 dark:border-slate-800 font-black text-slate-800 dark:text-white"
                >
                  Masuk Akun
                </Link>
              )}
              {pathname !== '/register' && (
                <Link 
                  href="/register" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-4 text-center rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black shadow-lg shadow-emerald-500/20"
                >
                  Buat Akun Gratis
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
