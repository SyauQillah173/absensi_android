import { useEffect, useState } from 'react';
import { api, type ApiRecord } from '../services/api';
import { str, num } from '../utils/formatters';

export function ReceiptPrintPage({ id }: { id: string }) {
  const [transactions, setTransactions] = useState<ApiRecord[]>([]);
  const [settings, setSettings] = useState<ApiRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const idList = id.split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n) && n > 0);
        const [trxResults, setRes] = await Promise.all([
          Promise.all(idList.map((trxId) => api.getPaymentTransaction(trxId).catch(() => null))),
          api.documentSettings().catch(() => null)
        ]);

        const validTrxs: ApiRecord[] = [];
        for (const r of trxResults) {
          if (r && r.data) {
            validTrxs.push(r.data as ApiRecord);
          }
        }

        setTransactions(validTrxs);
        if (setRes && setRes.data) {
          setSettings(setRes.data as ApiRecord);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  useEffect(() => {
    if (!loading && transactions.length > 0) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [loading, transactions]);

  if (loading) return <div className="p-10 text-center font-bold font-mono">Memuat struk pembayaran...</div>;
  if (transactions.length === 0) return <div className="p-10 text-center font-bold font-mono text-red-600">Data transaksi tidak ditemukan.</div>;

  const width = String(settings?.receipt_width || '58mm');
  const mainTrx = transactions[0] as ApiRecord;
  const allCodes = transactions.map((t) => str(t.transaction_code ?? t.kode_transaksi)).filter(Boolean).join(', ');
  const grandTotal = transactions.reduce((sum, t) => sum + num(t.jumlah ?? t.jumlah_total), 0);

  return (
    <div
      className="bg-white text-black mx-auto p-4 font-mono text-sm leading-tight"
      style={{ width, maxWidth: '100%' }}
    >
      <div className="text-center mb-4">
        {settings?.document_logo_url ? (
          <img src={String(settings.document_logo_url)} alt="Logo" className="mx-auto mb-2 h-12 w-12 object-contain" />
        ) : null}
        <h1 className="font-bold text-base">{str(settings?.payment_admin_name ?? 'NAMA APLIKASI/INSTITUSI')}</h1>
        <p className="text-xs">{str(settings?.payment_admin_title ?? 'Alamat Institusi')}</p>
        <p className="text-xs">================================</p>
        <h2 className="font-bold text-sm mt-2">BUKTI PEMBAYARAN</h2>
      </div>

      <div className="mb-4 text-xs space-y-1">
        <div className="flex justify-between"><span className="w-16 text-gray-600">No. Trx</span><span className="font-bold text-right flex-1 break-all">: {allCodes}</span></div>
        <div className="flex justify-between"><span className="w-16 text-gray-600">Tanggal</span><span className="text-right flex-1">: {new Date(String(mainTrx.tanggal ?? new Date().toISOString())).toLocaleDateString('id-ID')}</span></div>
        <div className="flex justify-between"><span className="w-16 text-gray-600">Santri</span><span className="font-bold text-right flex-1">: {str((mainTrx.siswa as ApiRecord)?.nama)}</span></div>
        <div className="flex justify-between"><span className="w-16 text-gray-600">Wali</span><span className="text-right flex-1">: {str((mainTrx.wali as ApiRecord)?.name ?? mainTrx.atas_nama)}</span></div>
        <div className="flex justify-between"><span className="w-16 text-gray-600">Petugas</span><span className="text-right flex-1">: {str((mainTrx.creator as ApiRecord)?.name ?? '-')}</span></div>
      </div>

      <div className="border-t border-b border-dashed border-black py-2 mb-4 space-y-2">
        {transactions.map((trx, tIdx) => {
          const items = Array.isArray(trx.items) ? (trx.items as ApiRecord[]) : [];
          return (
            <div key={tIdx} className="space-y-1">
              {items.length > 0 ? (
                items.map((item, index) => {
                  const typeName = str((item.paymentType as ApiRecord)?.nama ?? item.name ?? 'Tagihan');
                  const ket = str(item.keterangan);
                  return (
                    <div key={index} className="mb-1">
                      <div className="font-bold">{typeName} {ket ? `(${ket})` : ''}</div>
                      <div className="flex justify-between text-xs">
                        <span>{str(item.jenis ?? item.periode ?? '-')} {str(item.semester) !== '-' && str(item.semester) ? `- ${str(item.semester)}` : ''}</span>
                        <span className="font-bold">Rp {num(item.jumlah).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex justify-between text-xs">
                  <span className="font-bold">{str(trx.keterangan, 'Pembayaran')}</span>
                  <span className="font-bold">Rp {num(trx.jumlah ?? trx.jumlah_total).toLocaleString('id-ID')}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between font-bold text-base mb-4 border-b border-dashed border-black pb-2">
        <span>TOTAL BAYAR</span>
        <span>Rp {grandTotal.toLocaleString('id-ID')}</span>
      </div>

      <div className="text-center text-xs mt-6 space-y-1">
        <p>Terima kasih atas pembayaran Anda.</p>
        <p>Harap simpan struk ini sebagai bukti pembayaran yang sah.</p>
      </div>
      
      <style>{`
        @media print {
          @page {
            margin: 0;
            size: ${width} auto;
          }
          body {
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
