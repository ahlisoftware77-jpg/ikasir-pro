'use client';

import { useNotificationStore } from '@/store/notifications';
import { Bell, X, Trash2, CheckCheck, ShoppingBag, Info, AlertCircle, Clock, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const { notifications, markAsRead, markAllAsRead, clearAll, getUnreadCount } = useNotificationStore();
  const unreadCount = getUnreadCount();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-300">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-surface h-full shadow-2xl border-l border-app-border flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-6 border-b border-app-border flex items-center justify-between bg-surface sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <Bell size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-foreground uppercase tracking-tight">Notifikasi</h2>
              <p className="text-[10px] font-bold text-app-text-muted uppercase tracking-widest">
                {unreadCount > 0 ? `${unreadCount} Pesan Belum Dibaca` : 'Semua Sudah Dibaca'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-background rounded-lg text-app-text-muted transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Actions Bar */}
        {notifications.length > 0 && (
          <div className="px-6 py-3 bg-background/50 border-b border-app-border flex items-center justify-between">
            <button 
              onClick={() => markAllAsRead()}
              className="text-[10px] font-black text-accent hover:text-accent-hover flex items-center gap-1.5 uppercase tracking-widest transition-colors"
            >
              <CheckCheck size={12} /> Tandai Semua Dibaca
            </button>
            <button 
              onClick={() => {
                if (confirm("Hapus semua riwayat notifikasi?")) clearAll();
              }}
              className="text-[10px] font-black text-rose-500 hover:text-rose-600 flex items-center gap-1.5 uppercase tracking-widest transition-colors"
            >
              <Trash2 size={12} /> Bersihkan
            </button>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
              <div className="w-20 h-20 rounded-full bg-background flex items-center justify-center mb-4">
                <Bell size={40} className="text-app-text-muted" />
              </div>
              <p className="font-black text-foreground uppercase tracking-widest text-sm">Belum Ada Notifikasi</p>
              <p className="text-xs font-medium text-app-text-muted mt-2">Pesan dan aktivitas terbaru Anda akan muncul di sini.</p>
            </div>
          ) : (
            notifications.map((item) => (
              <div 
                key={item.id}
                onClick={() => {
                  markAsRead(item.id);
                  if (item.type === 'subscription_warning') {
                    onClose();
                    window.dispatchEvent(new CustomEvent('open-subscription-modal'));
                  }
                }}
                className={`p-4 rounded-3xl border transition-all cursor-pointer relative group ${
                  item.isRead 
                    ? 'bg-background/40 border-app-border' 
                    : 'bg-surface border-accent/30 shadow-lg shadow-accent/5'
                }`}
              >
                {!item.isRead && (
                  <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-accent animate-pulse" />
                )}
                
                <div className="flex gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    item.type === 'order' ? 'bg-emerald-500/10 text-emerald-500' :
                    item.type === 'debt' ? 'bg-rose-500/10 text-rose-500' :
                    item.type === 'stock_warning' ? 'bg-amber-500/10 text-amber-500' :
                    item.type === 'subscription_warning' ? 'bg-amber-500/10 text-amber-500' :
                    'bg-blue-500/10 text-blue-500'
                  }`}>
                    {item.type === 'order' ? <ShoppingBag size={18} /> :
                     item.type === 'debt' ? <AlertCircle size={18} /> :
                     item.type === 'stock_warning' ? <AlertCircle size={18} /> :
                     item.type === 'subscription_warning' ? <Sparkles size={18} /> :
                     <Info size={18} />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-black uppercase tracking-tight truncate ${item.isRead ? 'text-foreground/70' : 'text-foreground'}`}>
                      {item.title}
                    </h4>
                    <p className={`text-xs mt-1 leading-relaxed ${item.isRead ? 'text-app-text-muted' : 'text-foreground/90 font-medium'}`}>
                      {item.body}
                    </p>
                    <div className="flex items-center gap-1.5 mt-3 text-[10px] font-bold text-app-text-muted uppercase tracking-widest opacity-60">
                      <Clock size={10} />
                      {formatDistanceToNow(item.timestamp, { addSuffix: true, locale: id })}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Footer */}
        <div className="p-6 bg-background border-t border-app-border">
          <p className="text-[10px] text-center font-black text-app-text-muted uppercase tracking-[0.2em] italic">
            Kasir Pro Notification v1.0
          </p>
        </div>
      </div>
    </div>
  );
}
