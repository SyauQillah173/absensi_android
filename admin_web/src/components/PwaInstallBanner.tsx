import { Download, Sparkles, X } from 'lucide-react';
import React, { useState } from 'react';
import { usePwaInstall } from '../utils/pwaHelper';

interface PwaInstallBannerProps {
  className?: string;
}

export function PwaInstallBanner({ className = '' }: PwaInstallBannerProps) {
  const { isInstallable, isInstalled, triggerInstall } = usePwaInstall();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Jangan tampilkan jika sudah diinstal atau browser tidak mendukung atau user telah menutup
  if (isInstalled || !isInstallable || isDismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await triggerInstall();
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in slide-in-from-bottom-5 duration-300 ${className}`}
    >
      <div className="rounded-3xl p-4 bg-gradient-to-r from-[#0D7A6F] via-[#138F81] to-[#0A685E] text-white shadow-2xl border border-teal-300/40 backdrop-blur-md flex items-center justify-between gap-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 rounded-2xl bg-white/15 border border-white/30 flex items-center justify-center shrink-0 p-1">
            <img
              src="/logo-qomaruddin.png"
              alt="Logo Qomaruddin"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black tracking-tight text-amber-300">
                Aplikasi Qomaruddin
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400 text-slate-900 font-bold">
                PWA Chrome
              </span>
            </div>
            <p className="text-[11px] text-teal-100 font-medium leading-tight mt-0.5 truncate">
              Instal langsung di HP tanpa update Play Store!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="px-3 py-2 rounded-xl text-xs font-black bg-[#FFDC80] hover:bg-amber-300 text-[#0D7A6F] transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            type="button"
          >
            <Download size={14} className="animate-bounce" />
            <span>{isInstalling ? 'Memasang...' : 'Instal App'}</span>
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 rounded-xl hover:bg-white/15 text-teal-200 hover:text-white transition-colors cursor-pointer"
            type="button"
            title="Tutup banner"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
