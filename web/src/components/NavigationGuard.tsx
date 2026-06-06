'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function NavigationGuard() {
  const pathname = usePathname();

  useEffect(() => {
    // 1. Browser Level Guard (Refresh / Close Tab)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Check if we are on POS page and cart is not empty
      const isPOSDirty = pathname === '/pos' && (window as any).__isCartNotEmpty;
      
      if (isPOSDirty) {
        const message = "Transaksi sedang berlangsung! Jika Anda me-refresh atau menutup halaman ini, keranjang belanja akan hilang. Yakin ingin keluar?";
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    // 2. Hardware Back Button Guard (Android/Touch Devices)
    // Concept: We "push" a fake entry to the history stack when we are dirty.
    // When the user clicks "Back", it triggers popstate on that fake entry.
    const handlePopState = (e: PopStateEvent) => {
      const isPOSDirty = pathname === '/pos' && (window as any).__isCartNotEmpty;
      
      if (isPOSDirty) {
        // Stop the movement temporarily by pushing the same URL back
        // to prevent the actual page change
        window.history.pushState(null, '', window.location.href);
        
        const confirmed = window.confirm("Transaksi sedang berlangsung! Jika Anda kembali, keranjang belanja akan dikosongkan. Yakin ingin keluar?");
        if (confirmed) {
          // If they really want to leave, we need to manually go back twice
          // (Once for the push we just did, once for the original back)
          // But actually, it's safer to just let them go or use a cleaner logic.
          // For now, we manually go back.
          (window as any).__isCartNotEmpty = false; // Bypass guard
          window.history.back();
          window.history.back();
        }
      }
    };

    // Initial trap setup if we enter POS with items (rare but possible) or just setup listener
    if (pathname === '/pos') {
      // Small delay to ensure browser history is stable
      setTimeout(() => {
        window.history.pushState(null, '', window.location.href);
      }, 500);
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [pathname]);

  return null;
}
