import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface ModalFormProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}

export function ModalForm({ title, children, onClose, footer }: ModalFormProps) {
  return (
    <div className="q-modal-backdrop fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="q-modal-panel q-panel max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-b-none sm:rounded-b-[24px]">
        <div className="flex items-center justify-between gap-4 border-b border-white/60 px-6 py-5">
          <h2 className="text-xl font-extrabold text-[#2D3436]">{title}</h2>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#2D3436]" onClick={onClose} type="button" aria-label="Tutup">
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[calc(92vh-150px)] overflow-y-auto px-6 py-5 q-scrollbar">{children}</div>
        {footer ? <div className="border-t border-white/60 px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
