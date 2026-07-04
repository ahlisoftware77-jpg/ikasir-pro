import MarketplaceBottomNav from '@/components/MarketplaceBottomNav';
import CartDrawer from '@/components/CartDrawer';
import React from 'react';

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      {children}
      <MarketplaceBottomNav />
      <CartDrawer />
    </div>
  );
}
