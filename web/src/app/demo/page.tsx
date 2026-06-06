'use client';

import { useBranding } from '@/context/BrandingContext';
import Link from 'next/link';
import { 
  ShoppingBag, 
  Store, 
  Users, 
  Package, 
  TrendingUp, 
  ShieldCheck, 
  Printer, 
  Smartphone,
  ChevronRight,
  MonitorCheck
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DemoLandingPage() {
  const { branding } = useBranding();
  const router = useRouter();

  const handleTryDemo = () => {
    // Navigate to login with a special hash or query that we can intercept, 
    // but the easiest way is to let the user click the demo button on the login page,
    // or we can pass a URL parameter ?demo=true.
    router.push('/login?demo=true');
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden transition-colors duration-500 selection:bg-accent/30 selection:text-accent">
      {/* Background Ornaments */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-accent/5 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/10 blur-[130px] pointer-events-none"></div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-20 border-b border-app-border bg-surface/80 backdrop-blur-xl z-50 px-6 sm:px-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center text-white shadow-lg shadow-accent/20">
              <ShoppingBag size={20} />
           </div>
           <h1 className="text-xl font-bold tracking-widest uppercase italic">
             {branding.appName.split(' ')[0]} <span className="text-accent">{branding.appName.split(' ').slice(1).join(' ')}</span>
           </h1>
        </div>
        <div className="flex items-center gap-4">
           <Link href="/login" className="hidden sm:block text-sm font-bold text-app-text-muted hover:text-foreground transition-colors mr-2">Login</Link>
           <button 
             onClick={handleTryDemo}
             className="px-6 py-2.5 bg-accent text-white rounded-full font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-accent/20 flex items-center gap-2"
           >
              Coba Sekarang <ChevronRight size={14} />
           </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6 sm:px-12 max-w-7xl mx-auto relative z-10 flex flex-col items-center text-center">
         <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-accent/20 bg-accent/10 text-accent text-[10px] font-black uppercase tracking-widest mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
            Revolusi Sistem Kasir Modern
         </div>
         <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
            Kelola Bisnis Anda <br/> Lebih <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-accent-hover italic pr-2">Profesional</span>
         </h2>
         <p className="text-lg md:text-xl text-app-text-muted max-w-2xl font-medium mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            Aplikasi Point of Sale (POS) berbasis Cloud dengan fitur Multi-Tenant, Laporan Cerdas, dan Interface cantik. Didesain untuk Cafe, Retail, dan Jasa.
         </p>
         
         <div className="flex flex-col sm:flex-row items-center gap-4 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
            <button 
              onClick={handleTryDemo}
              className="w-full sm:w-auto px-10 py-5 bg-foreground text-background rounded-full font-black text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-foreground/20 flex items-center justify-center gap-3"
            >
               JELAJAHI FITUR DEMO <MonitorCheck size={18} />
            </button>
            <Link 
              href="/register"
              className="w-full sm:w-auto px-10 py-5 bg-surface border-2 border-app-border text-foreground rounded-full font-black text-sm hover:border-accent hover:text-accent transition-all flex items-center justify-center"
            >
               Buat Akun Anda
            </Link>
         </div>

         {/* Dashboard Mockup Image */}
         <div className="mt-20 w-full rounded-[2rem] border border-app-border bg-surface/50 backdrop-blur-sm p-4 md:p-8 shadow-2xl shadow-accent/5 animate-in fade-in zoom-in-95 duration-1000 delay-500">
            <div className="w-full aspect-video bg-background rounded-xl md:rounded-[1.5rem] overflow-hidden border border-app-border relative flex items-center justify-center">
               <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/5 via-background to-background"></div>
               <div className="text-center z-10 flex flex-col items-center gap-4 opacity-50">
                  <ShoppingBag size={64} className="text-accent" />
                  <p className="text-2xl font-black italic tracking-widest text-foreground uppercase">{branding.appName}</p>
               </div>
               
               {/* Mockup UI Elements abstract */}
               <div className="absolute top-4 left-4 right-4 flex gap-4 opacity-30">
                  <div className="w-64 h-12 bg-surface rounded-xl border border-app-border"></div>
                  <div className="flex-1 h-12 bg-surface rounded-xl border border-app-border"></div>
               </div>
               <div className="absolute top-20 left-4 bottom-4 w-64 bg-surface rounded-xl border border-app-border opacity-30"></div>
               <div className="absolute top-20 left-72 right-4 bottom-4 bg-surface rounded-xl border border-app-border opacity-30"></div>
            </div>
         </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 sm:px-12 max-w-7xl mx-auto border-t border-app-border">
         <div className="text-center mb-16">
            <h1 className="text-4xl font-black tracking-tighter text-foreground mb-4 drop-shadow-sm uppercase italic">IKASIR <span className="text-emerald-500">PRO</span></h1>
            <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mb-8">Modern Cloud POS Ecosystem</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Store, title: 'Multi-Tenant System', desc: 'Isolasi data 100% aman untuk ratusan cabang/toko dalam satu database master.' },
              { icon: TrendingUp, title: 'Analisa Sales Real-Time', desc: 'Pantau grafik pendapatan, stok barang, hingga laporan kas dengan instan.' },
              { icon: Smartphone, title: 'Android Share Ready', desc: 'Mendukung share resi via WhatsApp di perangkat Android tanpa harus mencetak.' },
              { icon: Printer, title: 'Struk Kustom', desc: 'Tampilkan nama toko pengunjung ke dalam Header dan Watermark eksklusif Anda.' },
              { icon: Users, title: 'Role Management', desc: 'Akses berbeda antara Super Admin, Pemilik Toko, hingga Staff Kasir biasa.' },
              { icon: ShieldCheck, title: 'Cloud Database', desc: 'Perlindungan anti-hilang karena data tersimpan otomatis di Google Firebase Cloud.' },
            ].map((f, i) => (
              <div key={i} className="bg-surface border border-app-border rounded-3xl p-8 hover:border-accent hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                 <div className="w-14 h-14 bg-background border border-app-border rounded-xl flex items-center justify-center mb-6 group-hover:bg-accent group-hover:text-white group-hover:border-accent transition-colors">
                    <f.icon size={24} className={i === 0 ? 'text-accent group-hover:text-white' : 'text-app-text-muted group-hover:text-white'} />
                 </div>
                 <h4 className="text-lg font-black text-foreground mb-3">{f.title}</h4>
                 <p className="text-sm font-medium text-app-text-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
         </div>
      </section>

      {/* Footer CTA */}
      <section className="py-24 px-6 sm:px-12 max-w-4xl mx-auto text-center border-t border-app-border">
         <h2 className="text-4xl font-black mb-6">Siap Meroketkan Omzet Anda?</h2>
         <p className="text-app-text-muted font-medium text-lg mb-10">Rasakan pengalaman kasir bintang lima gratis sekarang juga.</p>
         <button 
           onClick={handleTryDemo}
           className="px-12 py-5 bg-accent text-white rounded-full font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-accent/30 text-sm"
         >
            COBA AKUN DEMO
         </button>
      </section>
      
      {/* Footer mini */}
      <footer className="py-8 text-center border-t border-app-border bg-surface text-app-text-muted text-xs font-bold uppercase tracking-widest">
         &copy; {new Date().getFullYear()} {branding.appName}. All Rights Reserved.
      </footer>
    </div>
  );
}
