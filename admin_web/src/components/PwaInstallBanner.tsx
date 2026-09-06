import { Download, Sparkles, Smartphone, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { usePwaInstall } from '../utils/pwaHelper';

interface PwaInstallBannerProps {
  className?: string;
}

/**
 * 📲 Tombol Pasang PWA di Topbar Header (Sangat Ringkas, Rapi & Elegan)
 */
export function PwaHeaderInstallButton() {
  const { isInstallable, isInstalled, triggerInstall } = usePwaInstall();
  const [isInstalling, setIsInstalling] = useState(false);

  if (isInstalled || !isInstallable) {
    return null;
  }

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      await triggerInstall();
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <button
      onClick={handleInstall}
      disabled={isInstalling}
      className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-50 dark:bg-emerald-950/60 text-[#0D7A6F] dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-600/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all shadow-2xs cursor-pointer group shrink-0"
      title="Instal Aplikasi ke Layar Utama HP / Desktop"
      type="button"
    >
      <Download size={14} className="text-[#0D7A6F] dark:text-emerald-400 group-hover:translate-y-0.5 transition-transform" />
      <span className="hidden xs:inline">Instal App</span>
    </button>
  );
}

/**
 * 📲 Banner Instalasi PWA Bawah Layar yang Modern, Rapi, & Tidak Mengganggu
 */
export function PwaInstallBanner({ className = '' }: PwaInstallBannerProps) {
  const { isInstallable, isInstalled, triggerInstall } = usePwaInstall();
  const [isDismissed, setIsDismissed] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Cek apakah user pernah menutup banner ini
    const dismissed = localStorage.getItem('qomaruddin_pwa_banner_dismissed');
    if (!dismissed) {
      // Tampilkan banner dengan jeda 3 detik setelah halaman siap agar tidak menumpuk
      const timer = setTimeout(() => {
        setIsDismissed(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (isInstalled || !isInstallable || isDismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      const success = await triggerInstall();
      if (success) {
        setIsDismissed(true);
        localStorage.setItem('qomaruddin_pwa_banner_dismissed', 'installed');
      }
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    // Simpan status tutup agar tidak mengganggu lagi
    localStorage.setItem('qomaruddin_pwa_banner_dismissed', 'dismissed');
  };

  return (
    <aside
      aria-label="Pemasangan Aplikasi Web"
      className={`fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-sm z-40 animate-in slide-in-from-bottom-5 duration-300 ${className}`}
    >
      <div className="rounded-2xl p-3 sm:p-3.5 bg-gradient-to-r from-[#0D7A6F] to-[#138F81] text-white shadow-2xl border border-teal-300/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* Logo Pesantren Qomaruddin */}
          <div className="h-10 w-10 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-md">
            <img
              src="/logo-qomaruddin.png"
              alt="Qomaruddin"
              className="h-full w-full object-contain rounded-lg"
            />
          </div>

          {/* Deskripsi Singkat & Responsif */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-amber-300 truncate">
                Aplikasi Qomaruddin
              </span>
            </div>
            <p className="text-[11px] text-teal-100 font-medium leading-tight line-clamp-1 mt-0.5">
              Akses cepat tanpa browser
            </p>
          </div>

          {/* Tombol Aksi Rapi */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleInstallClick}
              disabled={isInstalling}
              className="px-3 py-1.5 rounded-xl text-xs font-black bg-[#FFDC80] hover:bg-amber-300 text-[#0D7A6F] transition-all shadow-md flex items-center gap-1 cursor-pointer disabled:opacity-50"
              type="button"
            >
              <Download size={13} />
              <span>{isInstalling ? 'Memasang...' : 'Instal'}</span>
            </button>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-lg text-teal-200 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
              type="button"
              title="Tutup (Bisa instal lewat menu titik 3 Chrome)"
              aria-label="Tutup"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Tip Edukatif Ramah: Bisa juga lewat titik 3 Chrome */}
        <div className="mt-2 pt-2 border-t border-teal-500/40 flex items-center justify-between text-[10px] text-teal-200">
          <span>💡 Bisa juga via Menu titik 3 Chrome ➔ Instal</span>
          <button
            onClick={handleDismiss}
            className="text-amber-300 hover:underline font-bold"
          >
            Jangan tampilkan
          </button>
        </div>
      </div>
    </aside>
  );
}
