'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, Calculator, ClipboardList, ShieldCheck, FileText } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

export default function MobileFooterNav() {
  const pathname = usePathname();
  const { role, permissions } = useAuthStore();

  if (!permissions && role !== 'super-admin') return null;

  const navItems = [
    { 
      name: 'Beranda', 
      path: '/', 
      icon: LayoutDashboard, 
      show: permissions?.canViewReports || role === 'super-admin'
    },
    { 
      name: 'Kasir', 
      path: '/pos', 
      icon: Calculator, 
      show: permissions?.canAccessPOS || role === 'super-admin'
    },
    { 
      name: 'Produk', 
      path: '/products', 
      icon: Package, 
      show: permissions?.canManageProducts || role === 'super-admin'
    },
    { 
      name: 'Pesanan', 
      path: '/orders', 
      icon: ClipboardList, 
      show: permissions?.canManageOrders || role === 'super-admin'
    },
    { 
      name: 'Estimasi', 
      path: '/estimations', 
      icon: FileText, 
      show: permissions?.canManageEstimations || role === 'super-admin'
    },
    { 
      name: 'Super', 
      path: '/super-admin', 
      icon: ShieldCheck, 
      show: role === 'super-admin'
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-2xl border-t border-app-border shadow-[0_-10px_30px_rgba(0,0,0,0.1)] px-2 pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.filter(item => item.show).map((item) => {
          const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path + '/'));
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all duration-300 relative ${
                isActive ? 'text-accent' : 'text-app-text-muted hover:text-foreground'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 ${
                isActive ? 'bg-accent/10 border border-accent/20' : 'border border-transparent'
              }`}>
                <Icon size={20} className={isActive ? 'animate-bounce-short' : ''} />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-wider transition-all ${
                isActive ? 'opacity-100 scale-100' : 'opacity-70 scale-95'
              }`}>
                {item.name}
              </span>
              
              {isActive && (
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-accent rounded-full animate-pulse shadow-[0_0_8px_rgba(var(--accent-rgb),0.8)]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// Add CSS keyframes for a subtle bounce
const styles = `
  @keyframes bounce-short {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
  }
  .animate-bounce-short {
    animation: bounce-short 2s ease-in-out infinite;
  }
`;
