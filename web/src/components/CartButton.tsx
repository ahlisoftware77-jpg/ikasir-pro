'use client';

import React from 'react';
import { useCart } from '@/context/CartContext';
import { ShoppingBag } from 'lucide-react';

export default function CartButton() {
  const { items, setIsCartOpen } = useCart();
  
  const totalItems = items.reduce((sum, item) => sum + item.qty, 0);

  if (totalItems === 0) return null;

  return (
    <button
      onClick={() => setIsCartOpen(true)}
      className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-[90] w-14 h-14 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl shadow-xl shadow-emerald-500/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95 group border-2 border-white dark:border-slate-800"
    >
      <div className="relative">
        <ShoppingBag size={24} className="stroke-[2.5]" />
        <span className="absolute -top-3 -right-3 min-w-[20px] h-5 px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 animate-in zoom-in duration-300">
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      </div>
    </button>
  );
}
