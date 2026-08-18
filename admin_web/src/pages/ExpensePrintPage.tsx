import { useEffect, useState } from 'react';
import { api, type ApiRecord } from '../services/api';
import { str, num } from '../utils/formatters';

export function ExpensePrintPage({ id }: { id: string }) {
  const [expense, setExpense] = useState<ApiRecord | null>(null);
  const [settings, setSettings] = useState<ApiRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [expRes, setRes] = await Promise.all([
          api.getPengeluaran(Number(id)),
          api.documentSettings()
        ]);
        setExpense(expRes.data as ApiRecord);
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
    if (!loading && expense) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [loading, expense]);

  if (loading) return <div className="p-10 text-center">Memuat kwitansi pengeluaran...</div>;
  if (!expense) return <div className="p-10 text-center">Data pengeluaran tidak ditemukan.</div>;

  const width = String(settings?.receipt_width || '58mm');

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
        <h2 className="font-bold text-sm mt-2">KWITANSI PENGELUARAN</h2>
      </div>

      <div className="mb-4">
        <div className="flex justify-between"><span className="w-20">No. Bukti</span><span>: EXP-{num(expense.id).toString().padStart(5, '0')}</span></div>
        <div className="flex justify-between"><span className="w-20">Tanggal</span><span>: {new Date(String(expense.tanggal)).toLocaleDateString('id-ID')}</span></div>
        <div className="flex justify-between"><span className="w-20">Petugas</span><span>: {str((expense.penginput as ApiRecord)?.name ?? '-')}</span></div>
      </div>

      <div className="border-t border-b border-dashed border-black py-2 mb-4">
        <div className="mb-2">
          <div className="font-bold">{str(expense.judul)}</div>
          <div className="text-xs text-gray-600 mb-1">{str(expense.kategori)}</div>
          {expense.keterangan ? <div className="text-xs mb-1">Ket: {str(expense.keterangan)}</div> : null}
        </div>
      </div>

      <div className="flex justify-between font-bold text-base mb-4">
        <span>TOTAL</span>
        <span>Rp {num(expense.jumlah).toLocaleString('id-ID')}</span>
      </div>

      <div className="text-center text-xs mt-6">
        <p>Bukti pengeluaran sah.</p>
        <p>{new Date().toLocaleString('id-ID')}</p>
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
