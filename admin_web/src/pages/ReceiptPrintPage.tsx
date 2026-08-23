import { useEffect, useState } from 'react';
import { api, type ApiRecord } from '../services/api';
import { str, num } from '../utils/formatters';

const monthNamesIndo: Record<number, string> = {
  1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April', 5: 'Mei', 6: 'Juni',
  7: 'Juli', 8: 'Agustus', 9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember'
};

export function ReceiptPrintPage({ id }: { id: string }) {
  const [transactions, setTransactions] = useState<ApiRecord[]>([]);
  const [settings, setSettings] = useState<ApiRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('58mm');

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
          const docData = setRes.data as ApiRecord;
          setSettings(docData);
          if (docData.receipt_width === '80mm') {
            setPaperWidth('80mm');
          }
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
      const timer = setTimeout(() => {
        window.print();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [loading, transactions]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center font-mono text-sm">
        <div className="text-center space-y-2">
          <div className="animate-spin text-2xl">⏳</div>
          <p className="font-bold">Memuat struk bukti pembayaran...</p>
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center font-mono text-sm">
        <div className="text-center space-y-2 text-red-600">
          <p className="text-xl">⚠️</p>
          <p className="font-bold">Data transaksi tidak ditemukan.</p>
        </div>
      </div>
    );
  }

  const mainTrx = transactions[0] as ApiRecord;
  const siswa = (mainTrx.siswa as ApiRecord) || {};
  const creator = (mainTrx.creator as ApiRecord) || {};
  
  // Format Date DD-MM-YYYY
  const rawDate = new Date(String(mainTrx.tanggal ?? mainTrx.created_at ?? new Date().toISOString()));
  const day = String(rawDate.getDate()).padStart(2, '0');
  const month = String(rawDate.getMonth() + 1).padStart(2, '0');
  const year = rawDate.getFullYear();
  const formattedDate = `${day}-${month}-${year}`;

  // Transaction code
  const allCodes = transactions.map((t) => str(t.transaction_code ?? t.kode_transaksi)).filter(Boolean).join(', ');

  // Student info
  const namaSantri = str(siswa.nama || mainTrx.atas_nama, '-').toUpperCase();
  const nisSantri = str(siswa.nis || (siswa as any).nisn, '');
  const kelasSantri = str(siswa.kelas || (siswa as any).class?.nama || mainTrx.kelas, '-');

  // Academic year and semester (e.g. 2026/2027 (2))
  const tahunAjaran = str(mainTrx.tahun_ajaran || '2026/2027');
  const semStr = str(mainTrx.semester).toLowerCase();
  const semNo = mainTrx.semester_id ? String(mainTrx.semester_id) : semStr.includes('genap') || semStr === '2' ? '2' : semStr.includes('ganjil') || semStr === '1' ? '1' : '';
  const thnAjaranFull = semNo ? `${tahunAjaran} (${semNo})` : tahunAjaran;

  // Flatten and extract items
  const allItems: Array<{
    title: string;
    subTitle?: string;
    amount: number;
  }> = [];

  transactions.forEach((trx) => {
    const rawItems = Array.isArray(trx.items) ? (trx.items as ApiRecord[]) : [];
    const trxYear = str(trx.tahun_ajaran || tahunAjaran);

    if (rawItems.length > 0) {
      rawItems.forEach((it) => {
        const pType = (it.paymentType as ApiRecord) || {};
        const pBill = (it.paymentBill as ApiRecord) || {};
        const typeName = str(pType.nama ?? it.jenis ?? it.name ?? 'Tagihan');
        const periodMonth = num(it.period_month || (pBill.period_month as number) || (it.month as number));
        const monthLabel = periodMonth > 0 ? monthNamesIndo[periodMonth] : '';
        const isMonthly = str(pType.periode ?? it.periode).toLowerCase().includes('bulan') || periodMonth > 0;

        let title = '';
        let subTitle = '';

        if (isMonthly) {
          title = `${typeName} ${trxYear} Bulan`;
          subTitle = monthLabel || str(pBill.period_label ?? it.keterangan);
        } else {
          title = `${typeName}`;
          subTitle = `${trxYear} (${str(it.status || trx.status || 'Lunas')})`;
        }

        allItems.push({
          title,
          subTitle,
          amount: num(it.jumlah),
        });
      });
    } else {
      allItems.push({
        title: str(trx.jenis || trx.keterangan || 'Pembayaran'),
        subTitle: `${trxYear} (${str(trx.status || 'Lunas')})`,
        amount: num(trx.jumlah ?? trx.jumlah_total),
      });
    }
  });

  const grandTotal = transactions.reduce((sum, t) => sum + num(t.jumlah ?? t.jumlah_total), 0);
  const petugasNama = str(creator.name || settings?.payment_admin_name || 'Petugas Keuangan');

  // Institution / Kop data
  const namaInstansi = str(settings?.payment_admin_name || "MTS ASSA'ADAH II");
  const alamatInstansi = str(settings?.payment_admin_title || 'JL. MASJID KIYAI GEDE BUNGAH');
  const teleponInstansi = str(settings?.phone || '(031) 3949818');

  return (
    <div className="min-h-screen bg-gray-100 p-2 sm:p-4 print:bg-white print:p-0">
      {/* Screen Control Bar (Hidden on Print) */}
      <div className="no-print mx-auto mb-4 flex max-w-md items-center justify-between gap-2 rounded-2xl bg-white p-3 shadow-md border border-gray-200 text-xs font-sans">
        <div className="flex items-center gap-2 font-bold text-gray-700">
          <span>Lebar Printer:</span>
          <select
            value={paperWidth}
            onChange={(e) => setPaperWidth(e.target.value as '58mm' | '80mm')}
            className="rounded-lg border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-800 focus:outline-none"
          >
            <option value="58mm">58mm (Standar POS)</option>
            <option value="80mm">80mm (Thermal Besar)</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl bg-[#138F81] px-4 py-1.5 font-extrabold text-white shadow-sm hover:bg-[#0A7065] transition-colors"
        >
          🖨️ Cetak Struk
        </button>
      </div>

      {/* Physical Thermal Receipt Container */}
      <div
        className="receipt-container mx-auto bg-white p-3 text-black font-mono leading-tight shadow-lg print:shadow-none print:m-0 print:p-2"
        style={{
          width: paperWidth === '80mm' ? '76mm' : '56mm',
          maxWidth: '100%',
          fontSize: paperWidth === '80mm' ? '12px' : '10.5px',
        }}
      >
        {/* HEADER / KOP */}
        <div className="text-center space-y-0.5">
          <div className="font-extrabold text-[12px] uppercase tracking-wider">{namaInstansi}</div>
          <div className="text-[10px] uppercase font-bold">{alamatInstansi}</div>
          {teleponInstansi && <div className="text-[10px] font-bold">{teleponInstansi}</div>}
        </div>

        {/* DOUBLE LINE DIVIDER */}
        <div className="my-1.5 border-b-[1.5px] border-black border-dashed" />

        {/* TITLE */}
        <div className="text-center font-black tracking-widest text-[11px] uppercase my-1">
          BUKTI PEMBAYARAN
        </div>

        {/* DASHED DIVIDER */}
        <div className="my-1 border-b border-black border-dashed" />

        {/* METADATA SECTION */}
        <div className="space-y-0.5 text-[10.5px]">
          <div className="flex">
            <span className="w-24 shrink-0 font-medium">Tanggal</span>
            <span className="shrink-0 mr-1">:</span>
            <span className="font-bold">{formattedDate}</span>
          </div>
          <div className="flex">
            <span className="w-24 shrink-0 font-medium">No. Transaksi</span>
            <span className="shrink-0 mr-1">:</span>
            <span className="font-bold break-all">{allCodes}</span>
          </div>
          <div className="flex items-start">
            <span className="w-24 shrink-0 font-medium">Nama</span>
            <span className="shrink-0 mr-1">:</span>
            <div className="font-bold">
              <div>{namaSantri}</div>
              {nisSantri && <div className="text-[9.5px]">({nisSantri})</div>}
            </div>
          </div>
          <div className="flex">
            <span className="w-24 shrink-0 font-medium">Kelas</span>
            <span className="shrink-0 mr-1">:</span>
            <span className="font-bold">{kelasSantri}</span>
          </div>
          <div className="flex">
            <span className="w-24 shrink-0 font-medium">Thn Ajaran</span>
            <span className="shrink-0 mr-1">:</span>
            <span className="font-bold">{thnAjaranFull}</span>
          </div>
        </div>

        {/* DOUBLE LINE BEFORE TABLE */}
        <div className="my-1.5 border-b-[1.5px] border-black" />

        {/* TABLE HEADER */}
        <div className="flex justify-between font-extrabold text-[10.5px]">
          <span>Uraian</span>
          <span>Nominal</span>
        </div>

        {/* DOUBLE LINE AFTER TABLE HEADER */}
        <div className="my-1 border-b-[1.5px] border-black" />

        {/* ITEMS LIST */}
        <div className="space-y-1.5 text-[10.5px]">
          {allItems.map((item, idx) => (
            <div key={idx}>
              <div className="flex justify-between items-start">
                <span className="font-bold pr-1 flex-1 leading-tight">
                  {idx + 1}. {item.title}
                </span>
                <span className="font-bold shrink-0 text-right">
                  {item.amount.toLocaleString('id-ID')}
                </span>
              </div>
              {item.subTitle && (
                <div className="pl-3.5 text-[9.5px] font-medium leading-tight">
                  {item.subTitle}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* DASHED LINE BEFORE TOTAL */}
        <div className="my-1.5 border-b border-black border-dashed" />

        {/* TOTAL */}
        <div className="flex justify-between font-black text-[11.5px]">
          <span>TOTAL</span>
          <span>{grandTotal.toLocaleString('id-ID')}</span>
        </div>

        {/* DOUBLE LINE AFTER TOTAL */}
        <div className="my-1.5 border-b-[1.5px] border-black" />

        {/* PETUGAS SIGNATURE */}
        <div className="mt-3 text-[10.5px]">
          <div className="font-bold">Petugas</div>
          <div className="h-10" />
          <div className="font-bold uppercase underline tracking-wider">{petugasNama}</div>
        </div>

        {/* FOOTER MESSAGE */}
        <div className="mt-4 text-center space-y-0.5 text-[9.5px]">
          <div className="font-extrabold tracking-wider">*** TERIMA KASIH ***</div>
          <div className="italic">Struk ini adalah bukti pembayaran yang sah</div>
        </div>
      </div>

      {/* PRINT STYLES */}
      <style>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
          .receipt-container {
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            padding: 4px 6px !important;
          }
        }
      `}</style>
    </div>
  );
}
