import { AlertTriangle, X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'info' | 'success';
  isBusy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Lanjut',
  cancelLabel = 'Batal',
  tone = 'warning',
  isBusy = false,
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) onCancel();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isBusy, onCancel]);

  const danger = tone === 'danger';
  const info = tone === 'info';
  const success = tone === 'success';

  const iconBg = danger
    ? 'bg-[#FDECEC] text-[#D63031]'
    : info
      ? 'bg-[#F0ECFF] text-[#6C5CE7]'
      : success
        ? 'bg-[#E8F7F3] text-[#138F81]'
        : 'bg-[#FFF3E0] text-[#E8590C]';

  const confirmBtnBg = danger
    ? 'bg-[#D63031]'
    : info
      ? 'bg-[#6C5CE7]'
      : 'bg-[#138F81]';

  const dialog = (
    <div
      className="q-modal-backdrop fixed inset-0 z-[60] grid place-items-center overflow-hidden p-4"
      role="alertdialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) onCancel();
      }}
    >
      <section className="q-modal-panel w-full max-w-md rounded-[28px] bg-[#FFFDF7] p-5 shadow-2xl shadow-black/20">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`grid h-12 w-12 place-items-center rounded-2xl ${iconBg}`}>
              <AlertTriangle size={22} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-[#2D3436]">{title}</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-[#636E72]">{message}</p>
            </div>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-full bg-[#E1EFF7] text-[#2D3436]" onClick={onCancel} type="button" disabled={isBusy}>
            <X size={18} />
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button className="min-h-11 rounded-2xl bg-[#E1EFF7] px-5 text-sm font-extrabold text-[#2D3436]" onClick={onCancel} type="button" disabled={isBusy}>
            {cancelLabel}
          </button>
          <button
            className={`min-h-11 rounded-2xl px-5 text-sm font-extrabold text-white disabled:opacity-60 ${confirmBtnBg}`}
            onClick={onConfirm}
            type="button"
            disabled={isBusy}
          >
            {isBusy ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );

  return createPortal(dialog, document.body);
}
