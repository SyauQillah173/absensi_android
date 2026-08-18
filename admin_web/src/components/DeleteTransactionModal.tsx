import { AlertCircle, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { ApiRecord } from '../services/api';
import { api } from '../services/api';
import { num, str } from '../utils/formatters';

interface DeleteTransactionModalProps {
  transaction: ApiRecord;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteTransactionModal({ transaction, onClose, onDeleted }: DeleteTransactionModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const items = Array.isArray(transaction.payment_items) ? transaction.payment_items : [];
  const isMulti = items.length > 1;

  async function handleDeleteEntire() {
    try {
      setIsDeleting(true);
      await api.deletePaymentTransaction(num(transaction.id), transaction.source === 'legacy' ? 'legacy' : 'transaction');
      onDeleted();
    } catch (err) {
      alert('Gagal menghapus transaksi');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDeleteItem(itemId: number) {
    try {
      setIsDeleting(true);
      // Calls DELETE /api/pembayaran/{id} which handles single item delete
      await api.deletePaymentTransaction(itemId, 'legacy'); 
      onDeleted();
    } catch (err) {
      alert('Gagal menghapus item transaksi');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-all duration-300">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
            <div className="flex items-center gap-3 text-[#D63031]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertCircle size={20} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">Hapus Pembayaran</h2>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="mb-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
              <div className="flex justify-between border-b border-gray-200 pb-2 mb-2">
                <span className="font-semibold">No. Trx</span>
                <span className="font-mono">{str(transaction.transaction_code ?? transaction.kode_transaksi)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Santri</span>
                <span>{str(transaction.siswa_nama ?? transaction.nama_siswa)}</span>
              </div>
            </div>

            {isMulti ? (
              <div>
                <p className="mb-3 text-sm font-semibold text-gray-700">Pilih item yang ingin dihapus:</p>
                <div className="mb-6 space-y-2 max-h-48 overflow-y-auto q-scrollbar pr-2">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between rounded-xl border border-gray-200 p-3 hover:border-red-200 hover:bg-red-50/30 transition-colors">
                      <div>
                        <div className="font-bold text-gray-900">{str(item.nama)}</div>
                        <div className="text-xs text-gray-500">{str(item.periode)} {str(item.keterangan)}</div>
                        <div className="text-sm font-bold text-[#138F81]">Rp {num(item.jumlah).toLocaleString('id-ID')}</div>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm(`Yakin ingin menghapus ${str(item.nama)}?`)) {
                            void handleDeleteItem(num(item.id));
                          }
                        }}
                        disabled={isDeleting}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 transition-colors hover:bg-red-200 disabled:opacity-50"
                        title="Hapus Item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-gray-200"></div>
                  <span className="mx-4 shrink-0 text-xs text-gray-400">Atau hapus semua</span>
                  <div className="flex-grow border-t border-gray-200"></div>
                </div>
              </div>
            ) : (
              <p className="mb-6 text-sm text-gray-600 text-center">
                Tindakan ini akan menghapus data transaksi secara permanen dan tidak dapat dibatalkan.
              </p>
            )}

            <button
              onClick={() => {
                if (confirm('Yakin ingin menghapus seluruh transaksi ini secara permanen?')) {
                  void handleDeleteEntire();
                }
              }}
              disabled={isDeleting}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#D63031] py-3 text-sm font-bold text-white transition-colors hover:bg-[#B52728] disabled:opacity-50"
            >
              <Trash2 size={18} />
              {isMulti ? 'Hapus Seluruh Transaksi' : 'Hapus Transaksi Permanen'}
            </button>
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="mt-3 flex w-full justify-center py-2 text-sm font-bold text-gray-500 hover:text-gray-700"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
