'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, primaryDb } from '@/lib/firebase';

interface BrandingData {
  appName: string;
  receiptWatermark: string;
  showWatermark: boolean;
}

interface BrandingContextType {
  branding: BrandingData;
  isLoading: boolean;
}

const defaultBranding: BrandingData = {
  appName: 'IKASIR PRO',
  receiptWatermark: 'Powered by YadiApp',
  showWatermark: true,
};

const getCachedBranding = (): BrandingData => {
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem('kasir-pro-branding');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return defaultBranding;
      }
    }
  }
  return defaultBranding;
};

const BrandingContext = createContext<BrandingContextType>({
  branding: defaultBranding,
  isLoading: true,
});

export const useBranding = () => useContext(BrandingContext);

export const BrandingProvider = ({ children }: { children: React.ReactNode }) => {
  const [branding, setBranding] = useState<BrandingData>(getCachedBranding());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Listen to global branding settings from primaryDb
    const unsub = onSnapshot(doc(primaryDb, 'system_settings', 'branding'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const newBranding = {
          appName: data.appName || defaultBranding.appName,
          receiptWatermark: data.receiptWatermark || defaultBranding.receiptWatermark,
          showWatermark: data.showWatermark ?? defaultBranding.showWatermark,
        };
        setBranding(newBranding);
        if (typeof window !== 'undefined') {
          localStorage.setItem('kasir-pro-branding', JSON.stringify(newBranding));
        }
      }
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching branding:", err);
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, isLoading }}>
      {children}
    </BrandingContext.Provider>
  );
};
