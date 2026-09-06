import React from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastNotificationProps {
  show: boolean;
  type?: ToastType;
  title?: string;
  message: string;
  onClose?: () => void;
}

/**
 * ToastNotification
 * Standar notifikasi floating di pojok kanan atas (top-5 right-5 z-[99999])
 * Sesuai dengan gaya visual Buku Induk Santri (ComplexSiswaForm).
 */
export function ToastNotification({
  show,
  type = 'success',
  title,
  message,
  onClose
}: ToastNotificationProps) {
  if (!show || !message) return null;

  const isSuccess = type === 'success';
  const isError = type === 'error';
  const isWarning = type === 'warning';

  const defaultTitle = isSuccess
    ? 'Berhasil Disimpan!'
    : isError
    ? 'Terjadi Kesalahan'
    : isWarning
    ? 'Perhatian'
    : 'Informasi';

  const borderClass = isSuccess
    ? 'border-emerald-200 shadow-emerald-900/15'
    : isError
    ? 'border-rose-200 shadow-rose-900/15'
    : isWarning
    ? 'border-amber-200 shadow-amber-900/15'
    : 'border-teal-200 shadow-teal-900/15';

  const iconBgClass = isSuccess
    ? 'bg-emerald-500 text-white shadow-emerald-500/30'
    : isError
    ? 'bg-rose-500 text-white shadow-rose-500/30'
    : isWarning
    ? 'bg-amber-500 text-white shadow-amber-500/30'
    : 'bg-[#138F81] text-white shadow-teal-500/30';

  const IconComponent = isSuccess
    ? CheckCircle2
    : isError
    ? XCircle
    : isWarning
    ? AlertTriangle
    : Info;

  return (
    <div
      className={`fixed top-5 right-5 z-[99999] flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-2xl border transition-all animate-in fade-in slide-in-from-top-4 duration-300 max-w-sm sm:max-w-md ${borderClass}`}
      role="status"
      aria-live="polite"
    >
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-md ${iconBgClass}`}>
        <IconComponent size={24} strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-slate-800">{title || defaultTitle}</p>
        <p className="text-xs font-semibold text-slate-500 mt-0.5 break-words">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          type="button"
          className="ml-1 text-slate-400 hover:text-slate-600 transition-colors shrink-0 p-1 rounded-lg hover:bg-slate-100"
          aria-label="Tutup notifikasi"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
