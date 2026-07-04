'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { Store, ShoppingBag, Package, User } from 'lucide-react';

export default function MarketplaceBottomNav() {
  const pathname = usePathname();
  const { items, setIsCartOpen } = useCart();
  
  const totalItems = items.reduce((sum, item) => sum + item.qty, 0);

  const tabs = [
    { name: 'Beranda', path: '/marketplace', icon: Store, isButton: false },
    { name: 'Keranjang', path: '#cart', icon: ShoppingBag, isButton: true },
    { name: 'Pesanan', path: '/marketplace/orders', icon: Package, isButton: false },
    { name: 'Profil', path: '/marketplace/profile', icon: User, isButton: false },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-t border-app-border z-[90] pb-safe">
      <div className="flex justify-between items-center px-2 py-2">
        {tabs.map((tab) => {
          const isActive = tab.path === '/marketplace' 
            ? pathname === '/marketplace' || pathname === '/marketplace/'
            : !tab.isButton && pathname.startsWith(tab.path);
          
          const Icon = tab.icon;

          if (tab.isButton) {
            return (
              <button
                key={tab.name}
                onClick={() => setIsCartOpen(true)}
                className="flex flex-col items-center justify-center w-full py-1.5 transition-all text-app-text-muted hover:text-foreground"
              >
                <div className="p-1.5 rounded-md transition-all relative">
                  <Icon size={20} strokeWidth={2} />
                  {totalItems > 0 && (
                     <div className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-[18px] h-[18px] flex items-center justify-center rounded-sm border border-surface shadow-sm animate-pulse">
                        {totalItems > 99 ? '99+' : totalItems}
                     </div>
                  )}
                </div>
                <span className="text-[9px] mt-0.5 tracking-wide font-bold">{tab.name}</span>
              </button>
            );
          }

          return (
            <Link
              href={tab.path}
              key={tab.name}
              className={`flex flex-col items-center justify-center w-full py-1.5 transition-all ${
                isActive ? 'text-accent scale-105' : 'text-app-text-muted hover:text-foreground'
              }`}
            >
              <div className={`p-1.5 rounded-md transition-all relative ${isActive ? 'bg-accent/15' : ''}`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'animate-bounce-short' : ''} />
              </div>
              <span className={`text-[9px] mt-0.5 tracking-wide ${isActive ? 'font-black' : 'font-bold'}`}>
                {tab.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
