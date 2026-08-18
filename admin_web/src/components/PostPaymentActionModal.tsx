import { CheckCircle2, Printer, MessageCircle } from 'lucide-react';
import type { ApiRecord } from '../services/api';
import { str } from '../utils/formatters';

interface PostPaymentActionModalProps {
  transaction: ApiRecord;
  onPrint: (type: 'receipt') => void;
  onSendWa: () => Promise<void>;
  onClose: () => void;
}

export function PostPaymentActionModal({ transaction, onPrint, onSendWa, onClose }: PostPaymentActionModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
        <div className="overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="bg-[#138F81] px-6 py-8 text-center text-white">
            <CheckCircle2 className="mx-auto mb-3 h-16 w-16" />
            <h2 className="text-2xl font-extrabold">Pembayaran Sukses!</h2>
            <p className="mt-2 text-sm font-medium opacity-90">
              Transaksi <span className="font-bold">{str(transaction.kode_transaksi)}</span> berhasil dicatat.
            </p>
          </div>
          
          <div className="p-6">
            <p className="mb-4 text-center text-sm font-semibold text-[#636E72]">Pilih tindakan selanjutnya:</p>
            <div className="space-y-3">
              <button
                onClick={() => onPrint('receipt')}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#138F81] bg-white p-3 font-bold text-[#138F81] transition-colors hover:bg-[#138F81] hover:text-white"
              >
                <Printer size={20} /> Cetak Struk
              </button>
              
              <button
                onClick={() => void onSendWa()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] p-3 font-bold text-white transition-colors hover:bg-[#128C7E]"
              >
                <MessageCircle size={20} /> Kirim WA Saja
              </button>
              
              <button
                onClick={async () => {
                  onPrint('receipt');
                  await onSendWa();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#138F81] p-3 font-bold text-white transition-colors hover:bg-[#0A7065]"
              >
                <Printer size={20} /><MessageCircle size={20} /> Cetak & Kirim WA
              </button>
            </div>

            <button
              onClick={onClose}
              className="mt-6 flex w-full justify-center text-sm font-bold text-[#636E72] hover:text-[#2D3436]"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
