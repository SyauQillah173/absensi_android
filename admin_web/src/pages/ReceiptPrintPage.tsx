import { useEffect, useState } from 'react';
import { api, type ApiRecord } from '../services/api';
import { str, num } from '../utils/formatters';

export function ReceiptPrintPage({ id }: { id: string }) {
  const [transaction, setTransaction] = useState<ApiRecord | null>(null);
  const [settings, setSettings] = useState<ApiRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [trxRes, setRes] = await Promise.all([
          api.getPaymentTransaction(Number(id)),
          api.documentSettings()
        ]);
        setTransaction(trxRes.data as ApiRecord);
        setSettings(setRes.data as ApiRecord);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  useEffect(() => {
    if (!loading && transaction) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [loading, transaction]);

  if (loading) return <div className="p-10 text-center">Memuat struk...</div>;
  if (!transaction) return <div className="p-10 text-center">Data transaksi tidak ditemukan.</div>;

  const width = String(settings?.receipt_width || '58mm');
  const items = Array.isArray(transaction.items) ? (transaction.items as ApiRecord[]) : [];

  return (
    <div
      className="bg-white text-black mx-auto p-4 font-mono text-sm leading-tight"
      style={{ width, maxWidth: '100%' }}
    >
      <div className="text-center mb-4">
        {settings?.document_logo_url ? (
          <img src={String(settings.document_logo_url)} alt="Logo" className="mx-auto mb-2 h-12 w-12 object-contain" />
        ) : null}
        <h1 className="font-bold text-base">UNIVERSITAS QOMARUDDIN</h1>
        <p className="text-xs">SAMPURNAN BUNGAH GRESIK</p>
        <p className="text-xs">================================</p>
        <h2 className="font-bold text-sm mt-2">BUKTI PEMBAYARAN</h2>
      </div>

      <div className="mb-4">
        <div className="flex justify-between"><span className="w-20">No. Trx</span><span>: {str(transaction.kode_transaksi)}</span></div>
        <div className="flex justify-between"><span className="w-20">Tanggal</span><span>: {new Date(String(transaction.tanggal)).toLocaleDateString('id-ID')}</span></div>
        <div className="flex justify-between"><span className="w-20">Santri</span><span>: {str((transaction.siswa as ApiRecord)?.nama)}</span></div>
        <div className="flex justify-between"><span className="w-20">Wali</span><span>: {str((transaction.wali as ApiRecord)?.name ?? transaction.atas_nama)}</span></div>
        <div className="flex justify-between"><span className="w-20">Petugas</span><span>: {str((transaction.createdByUser as ApiRecord)?.name)}</span></div>
      </div>

      <div className="border-t border-b border-dashed border-black py-2 mb-4">
        {items.map((item, index) => {
          const typeName = str((item.paymentType as ApiRecord)?.nama);
          const ket = str(item.keterangan);
          return (
            <div key={index} className="mb-2">
              <div className="font-bold">{typeName} {ket ? `(${ket})` : ''}</div>
              <div className="flex justify-between">
                <span>{str(item.jenis)} {str(item.semester) !== '-' ? `- ${str(item.semester)}` : ''}</span>
                <span>Rp {num(item.jumlah).toLocaleString('id-ID')}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between font-bold text-base mb-4">
        <span>TOTAL</span>
        <span>Rp {num(transaction.jumlah_total).toLocaleString('id-ID')}</span>
      </div>

      <div className="text-center text-xs mt-6">
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
