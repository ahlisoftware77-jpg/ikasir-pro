'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, primaryDb } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';

interface BrandingData {
  appName: string;
  receiptWatermark: string;
  showWatermark: boolean;
  subscriptionQrisUrl: string;
  subscriptionBankInfo: string;
  subscriptionEwalletInfo: string;
  pkg_1m_price: number;
  pkg_1m_discount_type: 'none' | 'percent' | 'nominal';
  pkg_1m_discount_val: number;
  pkg_3m_price: number;
  pkg_3m_discount_type: 'none' | 'percent' | 'nominal';
  pkg_3m_discount_val: number;
  pkg_6m_price: number;
  pkg_6m_discount_type: 'none' | 'percent' | 'nominal';
  pkg_6m_discount_val: number;
  pkg_12m_price: number;
  pkg_12m_discount_type: 'none' | 'percent' | 'nominal';
  pkg_12m_discount_val: number;
  expiredDisabledMenus?: string[];
}

interface BrandingContextType {
  branding: BrandingData;
  isLoading: boolean;
}

const defaultBranding: BrandingData = {
  appName: 'IKASIR PRO',
  receiptWatermark: 'Powered by YadiApp',
  showWatermark: true,
  subscriptionQrisUrl: '',
  subscriptionBankInfo: '',
  subscriptionEwalletInfo: '',
  pkg_1m_price: 30000,
  pkg_1m_discount_type: 'none',
  pkg_1m_discount_val: 0,
  pkg_3m_price: 84000,
  pkg_3m_discount_type: 'none',
  pkg_3m_discount_val: 0,
  pkg_6m_price: 159000,
  pkg_6m_discount_type: 'none',
  pkg_6m_discount_val: 0,
  pkg_12m_price: 306000,
  pkg_12m_discount_type: 'none',
  pkg_12m_discount_val: 0,
};

const getCachedBranding = (): BrandingData => {
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem('kasir-pro-branding');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return { ...defaultBranding, ...parsed };
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
        const newBranding: BrandingData = {
          appName: data.appName || defaultBranding.appName,
          receiptWatermark: data.receiptWatermark || defaultBranding.receiptWatermark,
          showWatermark: data.showWatermark ?? defaultBranding.showWatermark,
          subscriptionQrisUrl: data.subscriptionQrisUrl || '',
          subscriptionBankInfo: data.subscriptionBankInfo || '',
          subscriptionEwalletInfo: data.subscriptionEwalletInfo || '',
          pkg_1m_price: Number(data.pkg_1m_price ?? defaultBranding.pkg_1m_price),
          pkg_1m_discount_type: data.pkg_1m_discount_type || defaultBranding.pkg_1m_discount_type,
          pkg_1m_discount_val: Number(data.pkg_1m_discount_val ?? defaultBranding.pkg_1m_discount_val),
          pkg_3m_price: Number(data.pkg_3m_price ?? defaultBranding.pkg_3m_price),
          pkg_3m_discount_type: data.pkg_3m_discount_type || defaultBranding.pkg_3m_discount_type,
          pkg_3m_discount_val: Number(data.pkg_3m_discount_val ?? defaultBranding.pkg_3m_discount_val),
          pkg_6m_price: Number(data.pkg_6m_price ?? defaultBranding.pkg_6m_price),
          pkg_6m_discount_type: data.pkg_6m_discount_type || defaultBranding.pkg_6m_discount_type,
          pkg_6m_discount_val: Number(data.pkg_6m_discount_val ?? defaultBranding.pkg_6m_discount_val),
          pkg_12m_price: Number(data.pkg_12m_price ?? defaultBranding.pkg_12m_price),
          pkg_12m_discount_type: data.pkg_12m_discount_type || defaultBranding.pkg_12m_discount_type,
          pkg_12m_discount_val: Number(data.pkg_12m_discount_val ?? defaultBranding.pkg_12m_discount_val),
          expiredDisabledMenus: data.expiredDisabledMenus || [],
        };
        setBranding(newBranding);
        useAuthStore.getState().setExpiredDisabledMenus(data.expiredDisabledMenus || []);
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
