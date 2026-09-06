import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CalendarDays,
  Coins,
  Download,
  Filter,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  UsersRound,
  WalletCards,
  Sparkles,
  X,
  Clock,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';
import { DataTable } from './DataTable';
import { formatMoney, MoneyText } from './MoneyText';
import { StatusBadge } from './StatusBadge';
import { ReceiptWaliModal } from './ReceiptWaliModal';
import { api, type ApiRecord } from '../services/api';

function num(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function str(value: unknown, fallback = '-'): string {
  const result = String(value ?? '').trim();
  return result || fallback;
}

function statusTone(status: unknown): 'success' | 'warning' | 'danger' | 'neutral' {
  const clean = String(status ?? '').toLowerCase();
  if (clean.includes('lunas') && !clean.includes('belum')) return 'success';
  if (clean.includes('kurang') || clean.includes('menunggu')) return 'warning';
  if (clean.includes('batal') || clean.includes('non')) return 'danger';
  return 'neutral';
}

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export type PeriodPreset = 'semua' | 'harian' | 'mingguan' | 'bulanan' | 'tahunan' | 'kustom';

interface RiwayatPembayaranPanelProps {
  rows: ApiRecord[];
  classes: string[];
  paymentTypes: ApiRecord[];
  paymentMethods: ApiRecord[];
  academicPeriods: ApiRecord[];
  isLoading?: boolean;
  onReload: () => Promise<void> | void;
  onDeleteTransaction?: (row: ApiRecord) => void;
  onDeleteItem?: (item: ApiRecord) => void;
  showToast?: (message: string, type?: 'success' | 'error') => void;
}

export function RiwayatPembayaranPanel({
  rows,
  classes,
  paymentTypes,
  paymentMethods,
  academicPeriods,
  isLoading = false,
  onReload,
  onDeleteTransaction,
  onDeleteItem,
  showToast,
}: RiwayatPembayaranPanelProps) {
  const todayStr = getTodayString();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Filters State
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('semua');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Search & Secondary Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedMethod, setSelectedMethod] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  // Receipt Modal State
  const [viewReceiptTx, setViewReceiptTx] = useState<ApiRecord | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // 1. Filtered Rows calculation
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const rowDate = str(row.tanggal || row.created_at || '').slice(0, 10);
      const rowObj = new Date(rowDate || todayStr);

      // Period filter
      if (periodPreset === 'harian') {
        if (selectedDate && rowDate !== selectedDate) return false;
      } else if (periodPreset === 'mingguan') {
        // Last 7 days or current week
        const d = new Date();
        const past7 = new Date();
        past7.setDate(d.getDate() - 7);
        const past7Str = past7.toISOString().slice(0, 10);
        if (rowDate < past7Str || rowDate > todayStr) return false;
      } else if (periodPreset === 'bulanan') {
        const rYear = rowObj.getFullYear();
        const rMonth = rowObj.getMonth() + 1;
        if (rYear !== selectedYear || rMonth !== selectedMonth) return false;
      } else if (periodPreset === 'tahunan') {
        const rYear = rowObj.getFullYear();
        if (rYear !== selectedYear) return false;
      } else if (periodPreset === 'kustom') {
        if (startDate && rowDate < startDate) return false;
        if (endDate && rowDate > endDate) return false;
      }

      // Class filter
      if (selectedClass !== 'all') {
        const sKelas = str(row.kelas ?? (row.siswa as Record<string, unknown> | undefined)?.kelas);
        if (sKelas.toLowerCase() !== selectedClass.toLowerCase()) return false;
      }

      // Method filter
      if (selectedMethod !== 'all') {
        const via = str(row.via ?? row.payment_method_name).toLowerCase();
        if (!via.includes(selectedMethod.toLowerCase())) return false;
      }

      // Status filter
      if (selectedStatus !== 'all') {
        const st = str(row.status).toLowerCase();
        if (selectedStatus === 'Lunas' && !st.includes('lunas')) return false;
        if (selectedStatus === 'Menunggu' && !st.includes('menunggu')) return false;
        if (selectedStatus === 'Batal' && !st.includes('batal')) return false;
      }

      // Payment Type filter
      if (selectedType !== 'all') {
        const jenis = str(row.jenis ?? row.payment_type_name).toLowerCase();
        const items = Array.isArray(row.payment_items) ? row.payment_items : [];
        const hasItem = items.some((it) => str(it.nama ?? it.jenis).toLowerCase().includes(selectedType.toLowerCase()));
        if (!jenis.includes(selectedType.toLowerCase()) && !hasItem) return false;
      }

      // Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const namaSantri = str(row.siswa_nama ?? row.nama_siswa ?? (row.siswa as Record<string, unknown> | undefined)?.nama).toLowerCase();
        const nis = str(row.nis ?? (row.siswa as Record<string, unknown> | undefined)?.nis).toLowerCase();
        const kode = str(row.kode_transaksi ?? row.transaction_code).toLowerCase();
        const wali = str(row.atas_nama ?? (row.wali as Record<string, unknown> | undefined)?.name).toLowerCase();
        const jenis = str(row.jenis ?? row.payment_type_name).toLowerCase();

        const match = namaSantri.includes(q) || nis.includes(q) || kode.includes(q) || wali.includes(q) || jenis.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [
    rows,
    periodPreset,
    selectedDate,
    selectedMonth,
    selectedYear,
    startDate,
    endDate,
    selectedClass,
    selectedMethod,
    selectedStatus,
    selectedType,
    searchQuery,
    todayStr,
  ]);

  // 2. Summary stats for the active filter
  const summaryStats = useMemo(() => {
    const totalNominal = filteredRows.reduce((sum, r) => sum + num(r.jumlah), 0);
    const totalTransaksi = filteredRows.length;
    const rataRata = totalTransaksi > 0 ? Math.round(totalNominal / totalTransaksi) : 0;

    const santriSet = new Set<string>();
    let totalTunai = 0;
    let totalNonTunai = 0;

    filteredRows.forEach((r) => {
      const sId = str(r.siswa_id ?? (r.siswa as Record<string, unknown> | undefined)?.id ?? r.siswa_nama);
      if (sId && sId !== '-') santriSet.add(sId);

      const via = str(r.via ?? r.payment_method_name).toLowerCase();
      const amount = num(r.jumlah);
      if (via.includes('tunai') || via.includes('cash')) {
        totalTunai += amount;
      } else {
        totalNonTunai += amount;
      }
    });

    return {
      totalNominal,
      totalTransaksi,
      rataRata,
      totalSantri: santriSet.size,
      totalTunai,
      totalNonTunai,
    };
  }, [filteredRows]);

  // Handle Export Excel
  async function handleExportExcel() {
    try {
      setIsExporting(true);
      const params: Record<string, string | number | boolean> = {
        status: selectedStatus !== 'all' ? selectedStatus : '',
        kelas: selectedClass !== 'all' ? selectedClass : '',
        search: searchQuery.trim(),
      };

      if (periodPreset === 'harian') {
        params.tanggal = selectedDate;
      } else if (periodPreset === 'mingguan') {
        const past7 = new Date();
        past7.setDate(new Date().getDate() - 7);
        params.tanggal_mulai = past7.toISOString().slice(0, 10);
        params.tanggal_akhir = todayStr;
      } else if (periodPreset === 'bulanan') {
        const start = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
        const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
        const end = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        params.tanggal_mulai = start;
        params.tanggal_akhir = end;
      } else if (periodPreset === 'tahunan') {
        params.tanggal_mulai = `${selectedYear}-01-01`;
        params.tanggal_akhir = `${selectedYear}-12-31`;
      } else if (periodPreset === 'kustom') {
        if (startDate) params.tanggal_mulai = startDate;
        if (endDate) params.tanggal_akhir = endDate;
      } else {
        params.semua = 1;
      }

      await api.downloadPaymentRecapExcel(params);
      showToast?.('Berhasil mengunduh Rekap Excel!', 'success');
    } catch (err) {
      showToast?.(`Gagal ekspor: ${err instanceof Error ? err.message : 'Error'}`, 'error');
    } finally {
      setIsExporting(false);
    }
  }

  // Handle Print Report Window
  function handlePrintRekapan() {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('Popup diblokir browser. Izinkan popup untuk mencetak laporan.');
      return;
    }

    const titlePeriode =
      periodPreset === 'semua'
        ? 'Seluruh Waktu (Akumulasi Total)'
        : periodPreset === 'harian'
        ? `Harian (${selectedDate})`
        : periodPreset === 'mingguan'
        ? 'Mingguan (7 Hari Terakhir)'
        : periodPreset === 'bulanan'
        ? `Bulanan (${MONTH_NAMES[selectedMonth - 1]} ${selectedYear})`
        : periodPreset === 'tahunan'
        ? `Tahunan (${selectedYear})`
        : `Rentang ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}`;

    const rowsHtml = filteredRows
      .map((r, i) => {
        const santri = str(r.siswa_nama ?? r.nama_siswa ?? (r.siswa as Record<string, unknown> | undefined)?.nama);
        const nis = str(r.nis ?? (r.siswa as Record<string, unknown> | undefined)?.nis);
        const kelas = str(r.kelas ?? (r.siswa as Record<string, unknown> | undefined)?.kelas);
        const wali = str(r.atas_nama ?? (r.wali as Record<string, unknown> | undefined)?.name);
        const jenis = str(r.jenis ?? r.payment_type_name);
        const via = str(r.via ?? r.payment_method_name);
        const tgl = str(r.tanggal || r.created_at).slice(0, 10);
        const nominal = num(r.jumlah).toLocaleString('id-ID');
        const st = str(r.status, 'Lunas');

        return `
        <tr>
          <td style="text-align:center; padding:6px; border:1px solid #ddd;">${i + 1}</td>
          <td style="padding:6px; border:1px solid #ddd; font-family:monospace; font-size:11px;">${str(r.kode_transaksi ?? r.transaction_code)}</td>
          <td style="padding:6px; border:1px solid #ddd;">${tgl}</td>
          <td style="padding:6px; border:1px solid #ddd;"><b>${santri}</b><br><small style="color:#666;">NIS: ${nis} • Kelas: ${kelas}</small></td>
          <td style="padding:6px; border:1px solid #ddd;">${wali}</td>
          <td style="padding:6px; border:1px solid #ddd;">${jenis}</td>
          <td style="text-align:right; padding:6px; border:1px solid #ddd; font-weight:bold; color:#0D7A6F;">Rp ${nominal}</td>
          <td style="padding:6px; border:1px solid #ddd; text-align:center;">${via}</td>
          <td style="padding:6px; border:1px solid #ddd; text-align:center;"><span style="background:#E6F4EA; color:#137333; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">${st}</span></td>
        </tr>
      `;
      })
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rekap Pembayaran Santri - ${titlePeriode}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; color: #2D3436; margin: 0; }
          .header { text-align: center; border-bottom: 2px solid #138F81; padding-bottom: 12px; margin-bottom: 20px; }
          .instansi { font-size: 18px; font-weight: 900; color: #138F81; margin: 0; }
          .sub { font-size: 13px; color: #636E72; margin: 3px 0 0 0; }
          .title { font-size: 15px; font-weight: 800; text-transform: uppercase; margin-top: 15px; margin-bottom: 5px; }
          .meta { font-size: 12px; color: #4b5563; margin-bottom: 15px; }
          .summary-box { display: flex; gap: 15px; margin-bottom: 20px; }
          .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 15px; flex: 1; background: #fafafa; }
          .stat-title { font-size: 10px; font-weight: bold; color: #6b7280; text-transform: uppercase; }
          .stat-val { font-size: 16px; font-weight: 900; color: #138F81; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #138F81; color: white; padding: 8px; border: 1px solid #0D7A6F; text-align: left; font-size: 11px; }
          .ttd-box { margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid; }
          .ttd { text-align: center; width: 200px; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="instansi">PONDOK PESANTREN QOMARUDDIN</h1>
          <p class="sub">Sampurnan Bungah Gresik • Sistem Keuangan Terpadu</p>
          <div class="title">LAPORAN REKAPITULASI PEMBAYARAN KEUANGAN SANTRI</div>
          <div class="meta">Periode: <b>${titlePeriode}</b> | Tanggal Cetak: ${new Date().toLocaleString('id-ID')} WIB</div>
        </div>

        <div class="summary-box">
          <div class="stat">
            <div class="stat-title">Total Rekapan Masuk</div>
            <div class="stat-val">Rp ${summaryStats.totalNominal.toLocaleString('id-ID')}</div>
          </div>
          <div class="stat">
            <div class="stat-title">Jumlah Transaksi</div>
            <div class="stat-val">${summaryStats.totalTransaksi} Trx</div>
          </div>
          <div class="stat">
            <div class="stat-title">Santri Berpartisipasi</div>
            <div class="stat-val">${summaryStats.totalSantri} Santri</div>
          </div>
          <div class="stat">
            <div class="stat-title">Penerimaan Kas Tunai</div>
            <div class="stat-val">Rp ${summaryStats.totalTunai.toLocaleString('id-ID')}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:25px; text-align:center;">No</th>
              <th>Kode Trx</th>
              <th>Tanggal</th>
              <th>Santri</th>
              <th>Atas Nama (Wali)</th>
              <th>Jenis Pembayaran</th>
              <th style="text-align:right;">Nominal</th>
              <th style="text-align:center;">Metode</th>
              <th style="text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="9" style="text-align:center; padding:20px; color:#888;">Tidak ada data transaksi pada periode ini.</td></tr>'}
          </tbody>
        </table>

        <div class="ttd-box">
          <div class="ttd">
            <p style="font-size:12px; margin-bottom:60px;">Mengetahui,<br><b>Kepala Sekolah / Pengasuh</b></p>
            <p style="font-size:12px; font-weight:bold; text-decoration:underline;">_______________________</p>
          </div>
          <div class="ttd">
            <p style="font-size:12px; margin-bottom:60px;">Gresik, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br><b>Bendahara Pondok</b></p>
            <p style="font-size:12px; font-weight:bold; text-decoration:underline;">_______________________</p>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  return (
    <div className="space-y-6">
      {/* 🌟 1. SMART DYNAMIC SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Rekapan */}
        <div className="relative overflow-hidden rounded-3xl border border-teal-100 bg-gradient-to-br from-white via-teal-50/20 to-teal-100/30 p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-teal-700">
              Total Rekapan Masuk
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#138F81] text-white shadow-xs">
              <WalletCards size={20} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-[#138F81] tracking-tight">
            {formatMoney(summaryStats.totalNominal)}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
            <Sparkles size={13} className="text-teal-600" />
            <span>
              {periodPreset === 'semua'
                ? 'Semua Waktu (Full Time)'
                : periodPreset === 'harian'
                ? `Harian: ${selectedDate}`
                : periodPreset === 'mingguan'
                ? '7 Hari Terakhir'
                : periodPreset === 'bulanan'
                ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
                : periodPreset === 'tahunan'
                ? `Tahun ${selectedYear}`
                : 'Rentang Kustom'}
            </span>
          </div>
        </div>

        {/* Frekuensi Transaksi */}
        <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-blue-50/20 to-blue-100/30 p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-700">
              Frekuensi Transaksi
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xs">
              <Receipt size={20} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-gray-800 tracking-tight">
            {summaryStats.totalTransaksi} <span className="text-sm font-bold text-gray-500">Transaksi</span>
          </div>
          <div className="mt-1 text-xs font-semibold text-gray-500">
            Rata-rata: <b className="text-blue-700">{formatMoney(summaryStats.rataRata)}</b> / trx
          </div>
        </div>

        {/* Santri Terlibat */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/20 to-emerald-100/30 p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
              Santri Berpartisipasi
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs">
              <UsersRound size={20} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-gray-800 tracking-tight">
            {summaryStats.totalSantri} <span className="text-sm font-bold text-gray-500">Santri</span>
          </div>
          <div className="mt-1 text-xs font-semibold text-gray-500">
            Terdistribusi di {classes.length || 1} kelas
          </div>
        </div>

        {/* Komposisi Kas */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-100 bg-gradient-to-br from-white via-amber-50/20 to-amber-100/30 p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-700">
              Arus Kas Masuk
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-xs">
              <Coins size={20} />
            </div>
          </div>
          <div className="mt-2 space-y-0.5">
            <div className="flex items-center justify-between text-xs font-extrabold text-gray-700">
              <span>Tunai (Fisik):</span>
              <span className="text-emerald-700">{formatMoney(summaryStats.totalTunai)}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-extrabold text-gray-700">
              <span>Non-Tunai / Bank:</span>
              <span className="text-blue-700">{formatMoney(summaryStats.totalNonTunai)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 2. PRESET FILTER BAR (SMART PILLS & TABS) */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-base font-black text-gray-800 flex items-center gap-2">
              <Filter size={18} className="text-[#138F81]" />
              <span>Pilih Periode Rekapan Cerdas</span>
            </h3>
            <p className="text-xs font-medium text-gray-500 mt-0.5">
              Pilih rentang waktu untuk mengamati mutasi transaksi dan menghitung total pembayaran secara otomatis.
            </p>
          </div>

          {/* Quick Action Buttons: Print Rekap & Export Excel */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrintRekapan}
              className="flex min-h-10 items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-3.5 text-xs font-extrabold text-[#138F81] hover:bg-teal-100 transition-all cursor-pointer shadow-2xs"
              title="Cetak format cetak bersih untuk tanda tangan pimpinan"
            >
              <Printer size={15} />
              <span>Cetak Laporan Rekapan</span>
            </button>

            <button
              type="button"
              disabled={isExporting}
              onClick={handleExportExcel}
              className="flex min-h-10 items-center gap-2 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] px-4 text-xs font-extrabold text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Download spreadsheet Excel 3-sheet"
            >
              {isExporting ? <RefreshCw className="animate-spin" size={15} /> : <FileSpreadsheet size={15} />}
              <span>{isExporting ? 'Mengunduh...' : 'Export Excel (.xlsx)'}</span>
            </button>

            <button
              type="button"
              onClick={() => void onReload()}
              disabled={isLoading}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-gray-600 hover:bg-slate-50 transition-all cursor-pointer"
              title="Segarkan Data"
            >
              <RefreshCw className={isLoading ? 'animate-spin text-[#138F81]' : ''} size={15} />
            </button>
          </div>
        </div>

        {/* Pills Presets */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'semua', label: '🌟 Semua Waktu (Full Time)', count: rows.length },
            { id: 'harian', label: '📅 Harian' },
            { id: 'mingguan', label: '🗓️ Mingguan (7 Hari)' },
            { id: 'bulanan', label: '📆 Bulanan' },
            { id: 'tahunan', label: '🎓 Tahunan' },
            { id: 'kustom', label: '⚙️ Rentang Kustom' },
          ].map((tab) => {
            const active = periodPreset === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPeriodPreset(tab.id as PeriodPreset)}
                className={`flex items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-black transition-all cursor-pointer ${
                  active
                    ? 'bg-[#138F81] text-white shadow-sm ring-2 ring-teal-600/30'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200/80'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      active ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Dynamic Sub-Controls depending on Preset */}
        {periodPreset === 'harian' && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-teal-50/60 p-3 border border-teal-100 animate-in fade-in duration-200">
            <span className="text-xs font-black text-teal-900">Pilih Tanggal:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-xl border border-teal-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 shadow-2xs focus:border-[#138F81] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className="rounded-xl bg-white border border-teal-200 px-3 py-1.5 text-xs font-extrabold text-[#138F81] hover:bg-teal-50 transition-all shadow-2xs"
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => {
                const y = new Date();
                y.setDate(y.getDate() - 1);
                setSelectedDate(y.toISOString().slice(0, 10));
              }}
              className="rounded-xl bg-white border border-teal-200 px-3 py-1.5 text-xs font-extrabold text-gray-700 hover:bg-teal-50 transition-all shadow-2xs"
            >
              Kemarin
            </button>
          </div>
        )}

        {periodPreset === 'bulanan' && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-teal-50/60 p-3 border border-teal-100 animate-in fade-in duration-200">
            <span className="text-xs font-black text-teal-900">Bulan:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="rounded-xl border border-teal-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 shadow-2xs focus:border-[#138F81] focus:outline-none"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>

            <span className="text-xs font-black text-teal-900 ml-2">Tahun:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="rounded-xl border border-teal-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 shadow-2xs focus:border-[#138F81] focus:outline-none"
            >
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        )}

        {periodPreset === 'tahunan' && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-teal-50/60 p-3 border border-teal-100 animate-in fade-in duration-200">
            <span className="text-xs font-black text-teal-900">Tahun Kalender / Ajaran:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="rounded-xl border border-teal-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 shadow-2xs focus:border-[#138F81] focus:outline-none"
            >
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((yr) => (
                <option key={yr} value={yr}>
                  Tahun {yr}
                </option>
              ))}
            </select>
          </div>
        )}

        {periodPreset === 'kustom' && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-teal-50/60 p-3 border border-teal-100 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-teal-900">Dari:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl border border-teal-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 shadow-2xs focus:border-[#138F81] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-teal-900">Sampai:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-xl border border-teal-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 shadow-2xs focus:border-[#138F81] focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Secondary Search & Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5 pt-2 border-t border-gray-100">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="Cari santri, NIS, no. trx, wali..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-xs font-bold text-gray-800 placeholder:font-medium placeholder:text-gray-400 focus:border-[#138F81] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Kelas */}
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800 focus:border-[#138F81] focus:outline-none"
          >
            <option value="all">Semua Kelas</option>
            {classes.map((k) => (
              <option key={k} value={k}>
                Kelas {k}
              </option>
            ))}
          </select>

          {/* Filter Metode */}
          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800 focus:border-[#138F81] focus:outline-none"
          >
            <option value="all">Semua Metode</option>
            <option value="Tunai">Tunai / Cash</option>
            <option value="Transfer">Transfer Bank</option>
            <option value="BRI">Bank BRI</option>
            <option value="Mandiri">Bank Mandiri</option>
            <option value="BSI">Bank BSI</option>
            <option value="BCA">Bank BCA</option>
            <option value="QRIS">QRIS</option>
          </select>

          {/* Filter Status */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800 focus:border-[#138F81] focus:outline-none"
          >
            <option value="all">Semua Status</option>
            <option value="Lunas">Lunas</option>
            <option value="Menunggu">Menunggu</option>
            <option value="Batal">Dibatalkan</option>
          </select>
        </div>
      </div>

      {/* 🌟 3. TABLE TRANSAKSI PEMBAYARAN */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-gray-800">
              Rincian Transaksi Terdaftar
            </span>
            <span className="rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-xs font-black text-teal-800">
              {filteredRows.length} Baris
            </span>
          </div>
          <div className="text-xs font-bold text-gray-500">
            Total Nilai: <span className="text-base font-black text-[#138F81] ml-1">{formatMoney(summaryStats.totalNominal)}</span>
          </div>
        </div>

        <DataTable
          rows={filteredRows}
          emptyText="Tidak ada riwayat pembayaran yang sesuai dengan filter."
          isRowExpandable={(row) => row.is_multi_payment === true || (Array.isArray(row.payment_items) && row.payment_items.length > 1)}
          renderExpandedRow={(row) => {
            const items = Array.isArray(row.payment_items) ? row.payment_items : [];
            return (
              <div className="grid gap-2 p-2">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Item Transaksi Multi-Tagihan</p>
                <div className="grid max-w-2xl gap-2">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3 shadow-2xs">
                      <div>
                        <div className="font-bold text-[#2D3436] text-xs">{str(item.nama ?? item.jenis)}</div>
                        <div className="text-[11px] font-semibold text-gray-500">
                          {str(item.payment_bill?.period_label ?? item.periode)} {str(item.tahun_ajaran)} {str(item.semester)} {str(item.keterangan)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-extrabold text-[#138F81]">Rp {num(item.jumlah).toLocaleString('id-ID')}</span>
                        {onDeleteItem && (
                          <button
                            type="button"
                            onClick={() => onDeleteItem(item)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                            title="Hapus Item Ini"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }}
          columns={[
            {
              key: 'no',
              header: 'No',
              render: (_row: ApiRecord, index: number) => <span className="text-xs font-bold text-gray-500">{index + 1}</span>,
            },
            {
              key: 'kode',
              header: 'Kode Trx',
              render: (row) => (
                <div>
                  <span className="font-mono text-xs font-black text-gray-800">
                    {str(row.kode_transaksi ?? row.transaction_code)}
                  </span>
                  <div className="text-[10px] text-gray-400 font-semibold mt-0.5">
                    {str(row.tanggal || row.created_at).slice(0, 10)}
                  </div>
                </div>
              ),
            },
            {
              key: 'siswa',
              header: 'Santri',
              render: (row) => (
                <div>
                  <div className="font-black text-xs text-[#2D3436]">
                    {str(row.siswa_nama ?? row.nama_siswa ?? (row.siswa as Record<string, unknown> | undefined)?.nama)}
                  </div>
                  <div className="text-[11px] text-gray-500 font-semibold">
                    NIS: {str(row.nis ?? (row.siswa as Record<string, unknown> | undefined)?.nis)} • Kelas: {str(row.kelas ?? (row.siswa as Record<string, unknown> | undefined)?.kelas)}
                  </div>
                </div>
              ),
            },
            {
              key: 'atas',
              header: 'Atas Nama',
              render: (row) => (
                <span className="text-xs font-semibold text-gray-700">
                  {str(row.atas_nama ?? (row.wali as Record<string, unknown> | undefined)?.name)}
                </span>
              ),
            },
            {
              key: 'jenis',
              header: 'Jenis Tagihan',
              render: (row) => {
                const items = Array.isArray(row.payment_items) ? row.payment_items : [];
                const first = items[0] ?? {};
                const periodLabel = str(first.payment_bill?.period_label ?? first.periode, '');
                return (
                  <div>
                    <div className="font-bold text-xs text-gray-800">{str(row.jenis ?? row.payment_type_name)}</div>
                    {periodLabel && periodLabel !== '-' && (
                      <div className="text-[10px] font-semibold text-teal-700 mt-0.5">{periodLabel}</div>
                    )}
                  </div>
                );
              },
            },
            {
              key: 'jumlah',
              header: 'Nominal',
              render: (row) => <MoneyText value={row.jumlah} className="font-black text-[#138F81] text-xs" />,
            },
            {
              key: 'via',
              header: 'Metode',
              render: (row) => (
                <span className="rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-black text-gray-700">
                  {str(row.via ?? row.payment_method_name)}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (row) => <StatusBadge label={str(row.status, 'Lunas')} tone={statusTone(row.status)} />,
            },
            {
              key: 'actions',
              header: 'Aksi',
              render: (row) => (
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setViewReceiptTx(row)}
                    className="flex h-8 items-center gap-1 rounded-xl bg-teal-50 px-2.5 text-xs font-extrabold text-[#138F81] hover:bg-teal-100 transition-all cursor-pointer"
                    title="Cetak Kuitansi / Struk Resmi"
                  >
                    <Printer size={13} />
                    <span className="hidden sm:inline">Struk</span>
                  </button>

                  {onDeleteTransaction && (
                    <button
                      type="button"
                      onClick={() => onDeleteTransaction(row)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-all cursor-pointer"
                      title="Hapus Transaksi"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* 🌟 4. RECEIPT WALI MODAL (CETAK KWITANSI) */}
      {viewReceiptTx && (
        <ReceiptWaliModal
          transaction={viewReceiptTx}
          child={(viewReceiptTx.siswa as ApiRecord | undefined) ?? null}
          onClose={() => setViewReceiptTx(null)}
        />
      )}
    </div>
  );
}
