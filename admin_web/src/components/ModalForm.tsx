import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalFormProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}

export function ModalForm({ title, children, onClose, footer }: ModalFormProps) {
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [onClose]);

  const modal = (
    <div className="q-modal-backdrop fixed inset-0 z-50 overflow-hidden p-0" role="dialog" aria-modal="true">
      <div
        className="q-modal-frame flex min-h-full w-full items-end justify-center sm:items-center"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className="q-modal-panel q-panel flex w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] sm:rounded-[24px]">
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
    </div>
  );

  return createPortal(modal, document.body);
}
