import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

interface ModalFormProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}

export function ModalForm({ title, children, onClose, footer }: ModalFormProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div
      className="q-modal-backdrop fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="q-modal-panel q-panel flex max-h-[calc(94dvh-env(safe-area-inset-bottom))] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] sm:max-h-[calc(100dvh-2rem)] sm:rounded-[24px]">
        <div className="q-modal-header flex shrink-0 items-center justify-between gap-4 border-b border-white/60 px-6 py-5">
          <h2 className="text-xl font-extrabold text-[#2D3436]">{title}</h2>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#2D3436]" onClick={onClose} type="button" aria-label="Tutup">
            <X size={20} />
          </button>
        </div>
        <div className="q-modal-content min-h-0 flex-1 overflow-y-auto px-6 py-5 q-scrollbar">{children}</div>
        {footer ? <div className="q-modal-footer shrink-0 border-t border-white/60 px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
