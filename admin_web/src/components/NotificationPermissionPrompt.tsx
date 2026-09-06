import { Bell, BellRing, CheckCircle2, ShieldCheck, Sparkles, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { subscribeToPushNotifications } from '../utils/pushNotification';

interface NotificationPermissionPromptProps {
  userId?: number;
  role?: string;
  className?: string;
}

export function NotificationPermissionPrompt({
  userId,
  role,
  className = ''
}: NotificationPermissionPromptProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // 1. Cek apakah browser mendukung Notifications & ServiceWorker
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      return;
    }

    // 2. Hanya tampilkan jika status permission masih 'default' (belum diizinkan dan belum diblokir)
    if (Notification.permission === 'default') {
      const dismissed = localStorage.getItem('qomaruddin_notif_prompt_dismissed');
      // Berikan jeda 2 detik setelah halaman dimuat agar tidak mengejutkan pengguna
      const timer = setTimeout(() => {
        if (!dismissed) {
          setShowPrompt(true);
        }
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      // 1. Panggil requestPermission langsung dari user gesture (klik tombol)
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        setShowPrompt(false);
        setShowSuccess(true);
        localStorage.setItem('qomaruddin_notif_prompt_dismissed', 'granted');

        // 2. Berlangganan VAPID push notification di backend
        try {
          await subscribeToPushNotifications({
            userId,
            role,
            onSuccess: () => {
              console.log('[WebPush] Berhasil mendaftarkan langganan push notification.');
            }
          });
        } catch (subErr) {
          console.warn('[WebPush] Langganan push tersimpan lokal:', subErr);
        }

        setTimeout(() => setShowSuccess(false), 4000);
      } else {
        // Ditolak atau di-dismiss di dialog browser
        setShowPrompt(false);
        localStorage.setItem('qomaruddin_notif_prompt_dismissed', 'denied');
      }
    } catch (err) {
      console.error('[Notification] Gagal meminta izin notifikasi:', err);
      setShowPrompt(false);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Simpan ke localStorage agar tidak mengganggu selama 7 hari ke depan
    localStorage.setItem('qomaruddin_notif_prompt_dismissed', Date.now().toString());
  };

  if (showSuccess) {
    return (
      <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in slide-in-from-top-4 duration-300">
        <div className="rounded-2xl p-4 bg-[#0D7A6F] text-white shadow-2xl border border-teal-300/40 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-amber-300" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-black text-amber-300">Notifikasi Aktif!</h4>
            <p className="text-[11px] text-teal-50 font-medium">
              Anda akan menerima info absensi, tagihan, dan pengumuman secara real-time.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!showPrompt) {
    return null;
  }

  return (
    <div
      className={`fixed top-4 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in slide-in-from-top-5 duration-300 ${className}`}
    >
      <div className="rounded-3xl p-4 sm:p-5 bg-white dark:bg-[#1E293B] text-slate-800 dark:text-slate-100 shadow-2xl border-2 border-[#138F81]/40 dark:border-teal-500/30 backdrop-blur-xl">
        <div className="flex items-start gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-[#0D7A6F] dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
            <BellRing className="w-5 h-5 text-[#0D7A6F] dark:text-amber-400 animate-bounce" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-[#0D7A6F] dark:text-teal-400">
                  Aktifkan Notifikasi Real-Time
                </span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-300 border border-amber-400/30">
                  Penting
                </span>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title="Tutup"
                aria-label="Tutup"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed mt-1">
              Dapatkan pemberitahuan langsung saat ada absensi madin/sholat santri, status tagihan, dan pengumuman pondok di HP Anda.
            </p>

            <div className="flex items-center gap-2 mt-3.5">
              <button
                onClick={handleRequestPermission}
                disabled={isRequesting}
                className="flex-1 py-2 px-3 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-[#138F81]/25 hover:scale-102 transition-all cursor-pointer disabled:opacity-50"
                type="button"
              >
                <Bell size={13} />
                <span>{isRequesting ? 'Memproses...' : 'Izinkan Notifikasi'}</span>
              </button>
              <button
                onClick={handleDismiss}
                className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                type="button"
              >
                Nanti Saja
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
