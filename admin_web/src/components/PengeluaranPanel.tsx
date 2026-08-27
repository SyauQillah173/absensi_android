import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Coins,
  CreditCard,
  Download,
  Edit,
  FileSpreadsheet,
  FileText,
  Filter,
  Landmark,
  Plus,
  PlusCircle,
  Printer,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  WalletCards,
  X
} from 'lucide-react';
import { api, type ApiRecord } from '../services/api';
import { formatMoney, MoneyText } from './MoneyText';
import { ModalForm } from './ModalForm';

interface PengeluaranPanelProps {
  rows: ApiRecord[];
  summaryData?: ApiRecord | null;
  totalPemasukanFallback?: number;
  academicPeriods?: ApiRecord[];
  userId: number;
  docSetting?: ApiRecord | null;
  onReload: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

function num(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function str(value: unknown, fallback = '-'): string {
  const result = String(value ?? '').trim();
  return result.length > 0 ? result : fallback;
}

// Terbilang Rupiah Helper
function angkaTerbilang(angka: number): string {
  const bilangan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  const n = Math.floor(Math.abs(angka));

  if (n < 12) return bilangan[n];
  if (n < 20) return angkaTerbilang(n - 10) + ' Belas';
  if (n < 100) return angkaTerbilang(Math.floor(n / 10)) + ' Puluh ' + angkaTerbilang(n % 10);
  if (n < 200) return 'Seratus ' + angkaTerbilang(n - 100);
  if (n < 1000) return angkaTerbilang(Math.floor(n / 100)) + ' Ratus ' + angkaTerbilang(n % 100);
  if (n < 2000) return 'Seribu ' + angkaTerbilang(n - 1000);
  if (n < 1000000) return angkaTerbilang(Math.floor(n / 1000)) + ' Ribu ' + angkaTerbilang(n % 1000);
  if (n < 1000000000) return angkaTerbilang(Math.floor(n / 1000000)) + ' Juta ' + angkaTerbilang(n % 1000000);
  if (n < 1000000000000) return angkaTerbilang(Math.floor(n / 1000000000)) + ' Milyar ' + angkaTerbilang(n % 1000000000);
  return angkaTerbilang(Math.floor(n / 1000000000000)) + ' Triliun ' + angkaTerbilang(n % 1000000000000);
}

export interface QuickExpensePresetItem {
  id: string;
  label: string;
  cat: string;
}

const DEFAULT_CATEGORIES = [
  'Konsumsi & Dapur',
  'Operasional & Utilitas',
  'Honor & Gaji Asatidz',
  'Sarana & Prasarana',
  'Kegiatan & Lomba Santri',
  'ATK & Percetakan',
  'Kesehatan & Kebersihan',
  'Perawatan Gedung',
  'Lain-lain'
];

const FUND_SOURCES = [
  { id: 'Kas Pembayaran Siswa (Pemasukan Transaksi)', label: '📥 Kas Pembayaran Siswa (Pemasukan Transaksi)', desc: 'Menggunakan kas masuk dari pembayaran santri' },
  { id: 'Kas Tunai Bendahara', label: '💵 Kas Tunai Bendahara', desc: 'Uang tunai di brankas kasir bendahara' },
  { id: 'Transfer Bank BSI (Rekening Siswa)', label: '🏛️ Transfer Bank BSI (Rekening Siswa)', desc: 'Rekening penerimaan BSI' },
  { id: 'Transfer Bank Mandiri', label: '🏛️ Transfer Bank Mandiri', desc: 'Rekening operasional Mandiri' },
  { id: 'Kas Operasional / Petty Cash', label: '🏢 Kas Operasional / Petty Cash', desc: 'Dana kas kecil operasional harian' },
  { id: 'Kas Yayasan / Bantuan', label: '🤝 Kas Yayasan / Bantuan', desc: 'Subsidi/bantuan yayasan' },
];

export const DEFAULT_QUICK_EXPENSES: QuickExpensePresetItem[] = [
  { id: '1', label: 'Beras & Dapur', cat: 'Konsumsi & Dapur' },
  { id: '2', label: 'Listrik & Air PLN', cat: 'Operasional & Utilitas' },
  { id: '3', label: 'Honor Asatidz / Guru', cat: 'Honor & Gaji Asatidz' },
  { id: '4', label: 'ATK & Kertas Cetak', cat: 'ATK & Percetakan' },
  { id: '5', label: 'Perbaikan Gedung', cat: 'Perawatan Gedung' },
  { id: '6', label: 'Konsumsi Rapat / Tamu', cat: 'Konsumsi & Dapur' },
  { id: '7', label: 'Obat & Kebersihan', cat: 'Kesehatan & Kebersihan' },
];

const STORAGE_KEY_EXPENSE_PRESETS = 'pesantren_quick_expense_presets_v2';

function loadQuickExpensePresets(): QuickExpensePresetItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EXPENSE_PRESETS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  return DEFAULT_QUICK_EXPENSES;
}

export function PengeluaranPanel({
  rows,
  summaryData,
  totalPemasukanFallback = 0,
  academicPeriods = [],
  userId,
  docSetting,
  onReload,
  showToast
}: PengeluaranPanelProps) {
  // --- QUICK PRESETS MASTER STATE ---
  const [quickPresets, setQuickPresets] = useState<QuickExpensePresetItem[]>(() => loadQuickExpensePresets());
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);

  const handleSavePresets = (newItems: QuickExpensePresetItem[]) => {
    setQuickPresets(newItems);
    try {
      localStorage.setItem(STORAGE_KEY_EXPENSE_PRESETS, JSON.stringify(newItems));
    } catch {
      // ignore
    }
  };

  // --- FORM STATE ---
  const todayStr = new Date().toISOString().split('T')[0];
  const [tanggal, setTanggal] = useState(todayStr);
  const [judul, setJudul] = useState('');
  const [kategori, setKategori] = useState('Konsumsi & Dapur');
  const [customKategori, setCustomKategori] = useState('');
  const [nominal, setNominal] = useState('');
  const [dibayarkanKepada, setDibayarkanKepada] = useState('');
  const [metodePembayaran, setMetodePembayaran] = useState('Kas Pembayaran Siswa (Pemasukan Transaksi)');
  const [keterangan, setKeterangan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- FILTER & SEARCH STATE ---
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'today' | 'this_month' | 'this_year' | 'all' | 'custom'>('this_month');
  const [academicYearFilter, setAcademicYearFilter] = useState('all');
  const [calendarYearFilter, setCalendarYearFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');

  // --- MODALS STATE ---
  const [editingRow, setEditingRow] = useState<ApiRecord | null>(null);
  const [receiptRow, setReceiptRow] = useState<ApiRecord | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [deleteConfirmRow, setDeleteConfirmRow] = useState<ApiRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- ALL UNIQUE CATEGORIES IN DATA ---
  const existingCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    rows.forEach((r) => {
      const c = str(r.kategori, '');
      if (c && c !== '-') set.add(c);
    });
    return Array.from(set);
  }, [rows]);

  // --- ALL UNIQUE CALENDAR YEARS IN DATA ---
  const availableCalendarYears = useMemo(() => {
    const years = new Set<string>();
    const curYr = String(new Date().getFullYear());
    years.add(curYr);
    rows.forEach((r) => {
      const d = String(r.tanggal || '').split('T')[0];
      if (d.length >= 4) {
        years.add(d.substring(0, 4));
      }
    });
    return Array.from(years).sort().reverse();
  }, [rows]);

  // --- FILTERED DATA COMPUTATION ---
  const filteredRows = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const curMonthPrefix = `${curYear}-${curMonth}`;

    return rows.filter((r) => {
      const rowDate = String(r.tanggal || '').split('T')[0];

      // 1. Period Filter (Pills)
      if (periodFilter === 'today' && rowDate !== todayStr) return false;
      if (periodFilter === 'this_month' && !rowDate.startsWith(curMonthPrefix)) return false;
      if (periodFilter === 'this_year' && !rowDate.startsWith(String(curYear))) return false;
      if (periodFilter === 'custom') {
        if (customStartDate && rowDate < customStartDate) return false;
        if (customEndDate && rowDate > customEndDate) return false;
      }

      // 2. Academic Year Filter
      if (academicYearFilter !== 'all') {
        const rAyId = String(r.academic_year_id ?? (r.academicYear as ApiRecord)?.id ?? '');
        if (rAyId !== academicYearFilter) return false;
      }

      // 3. Calendar Year Filter
      if (calendarYearFilter !== 'all') {
        if (!rowDate.startsWith(calendarYearFilter)) return false;
      }

      // 4. Category Filter
      if (categoryFilter !== 'all' && str(r.kategori) !== categoryFilter) return false;

      // 5. Method Filter
      if (methodFilter !== 'all' && str(r.metode_pembayaran || 'Tunai') !== methodFilter) return false;

      // 6. Search Query
      if (search.trim()) {
        const query = search.toLowerCase();
        const j = str(r.judul).toLowerCase();
        const k = str(r.kategori).toLowerCase();
        const p = str(r.dibayarkan_kepada).toLowerCase();
        const no = str(r.no_transaksi).toLowerCase();
        const ket = str(r.keterangan).toLowerCase();
        const petugas = str((r.penginput as ApiRecord)?.name).toLowerCase();
        const ayName = str((r.academicYear as ApiRecord)?.name).toLowerCase();

        return (
          j.includes(query) ||
          k.includes(query) ||
          p.includes(query) ||
          no.includes(query) ||
          ket.includes(query) ||
          petugas.includes(query) ||
          ayName.includes(query)
        );
      }

      return true;
    });
  }, [rows, search, periodFilter, academicYearFilter, calendarYearFilter, customStartDate, customEndDate, categoryFilter, methodFilter, todayStr]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredRows.length, pageSize]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedRows = useMemo(() => {
    if (pageSize >= filteredRows.length) return filteredRows;
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safePage, pageSize]);

  const startIndex = filteredRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIndex = Math.min(safePage * pageSize, filteredRows.length);

  // --- STATS & TREASURY CASHFLOW COMPUTATION ---
  const stats = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const curMonthPrefix = `${curYear}-${curMonth}`;

    let totalPengeluaranAll = 0;
    let totalMonth = 0;
    let totalToday = 0;
    let totalFiltered = 0;
    const catMap: Record<string, number> = {};

    rows.forEach((r) => {
      const rowDate = String(r.tanggal || '').split('T')[0];
      const amt = num(r.jumlah);
      const cat = str(r.kategori, 'Lain-lain');

      totalPengeluaranAll += amt;

      if (rowDate.startsWith(curMonthPrefix)) {
        totalMonth += amt;
      }
      if (rowDate === todayStr) {
        totalToday += amt;
      }

      catMap[cat] = (catMap[cat] || 0) + amt;
    });

    filteredRows.forEach((r) => {
      totalFiltered += num(r.jumlah);
    });

    // Inflow from student payments
    const totalPemasukanSiswa = num(summaryData?.total_pemasukan) || totalPemasukanFallback;
    const saldoKasBersih = totalPemasukanSiswa - totalPengeluaranAll;

    return {
      totalPemasukanSiswa,
      totalPengeluaranAll,
      saldoKasBersih,
      totalMonth,
      totalToday,
      totalFiltered,
      countFiltered: filteredRows.length,
    };
  }, [rows, filteredRows, summaryData, totalPemasukanFallback, todayStr]);

  // --- HANDLE SUBMIT NEW EXPENSE ---
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!judul.trim()) {
      showToast('Harap isi judul/keperluan pengeluaran!', 'error');
      return;
    }
    const cleanAmount = num(nominal);
    if (cleanAmount <= 0) {
      showToast('Nominal pengeluaran harus lebih dari Rp 0!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const finalCategory = kategori === '__custom__' ? customKategori.trim() || 'Lain-lain' : kategori;

      const payload = {
        judul: judul.trim(),
        jumlah: cleanAmount,
        tanggal,
        kategori: finalCategory,
        dibayarkan_kepada: dibayarkanKepada.trim() || null,
        metode_pembayaran: metodePembayaran,
        keterangan: keterangan.trim() || null,
        user_id: userId,
      };

      await api.createPengeluaran(payload);
      await onReload();

      // Reset form
      setJudul('');
      setNominal('');
      setDibayarkanKepada('');
      setKeterangan('');
      setCustomKategori('');
      showToast('✅ Pengeluaran kas keluar berhasil dicatat!', 'success');
    } catch (err) {
      showToast(`Gagal mencatat pengeluaran: ${err instanceof Error ? err.message : 'Error'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Quick nominal helper
  function addNominal(amt: number) {
    const current = num(nominal);
    setNominal(String(current + amt));
  }

  // --- HANDLE DELETE ---
  async function handleDeleteConfirm() {
    if (!deleteConfirmRow) return;
    setIsDeleting(true);
    try {
      await api.deletePengeluaran(num(deleteConfirmRow.id));
      await onReload();
      showToast('✅ Catatan pengeluaran berhasil dihapus', 'success');
      setDeleteConfirmRow(null);
    } catch (err) {
      showToast(`Gagal menghapus pengeluaran: ${err instanceof Error ? err.message : 'Error'}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. TOP SUMMARY: ARUS KAS PESANTREN (INFLOW VS OUTFLOW VS NET BALANCE) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* CARD 1: PEMASUKAN SISWA */}
        <div className="rounded-3xl bg-white p-5 shadow-xs border border-emerald-100 flex items-center gap-4 transition-all hover:shadow-md">
          <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <ArrowDownLeft size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-wider text-emerald-700 uppercase">Pemasukan Transaksi Siswa</p>
            <p className="text-xl font-black text-emerald-900 mt-0.5">{formatMoney(stats.totalPemasukanSiswa)}</p>
            <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">📥 Sumber Kas Pembayaran Santri</p>
          </div>
        </div>

        {/* CARD 2: TOTAL PENGELUARAN */}
        <div className="rounded-3xl bg-white p-5 shadow-xs border border-rose-100 flex items-center gap-4 transition-all hover:shadow-md">
          <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <ArrowUpRight size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-wider text-rose-700 uppercase">Total Pengeluaran Kas</p>
            <p className="text-xl font-black text-rose-900 mt-0.5">{formatMoney(stats.totalPengeluaranAll)}</p>
            <p className="text-[11px] font-semibold text-rose-600 mt-0.5">📤 Akumulasi Kas Keluar Pesantren</p>
          </div>
        </div>

        {/* CARD 3: SISA SALDO KAS BERSIH (NET) */}
        <div className="rounded-3xl bg-white p-5 shadow-xs border border-teal-100 flex items-center gap-4 transition-all hover:shadow-md">
          <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-[#138F81]">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-wider text-[#138F81] uppercase">
              Sisa Saldo Kas Tersedia
            </p>
            <p className="text-xl font-black text-gray-900 mt-0.5">
              {formatMoney(stats.saldoKasBersih)}
            </p>
            <p className="text-[11px] font-bold text-teal-600 mt-0.5">
              {stats.saldoKasBersih >= 0 ? '✨ Kas Surplus & Siap Pakai' : '⚠️ Kas Defisit'}
            </p>
          </div>
        </div>

        {/* CARD 4: PENGELUARAN HARI INI */}
        <div className="rounded-3xl bg-white p-5 shadow-xs border border-gray-100 flex items-center gap-4 transition-all hover:shadow-md">
          <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <CalendarDays size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-wider text-gray-500 uppercase">Pengeluaran Hari Ini</p>
            <p className="text-xl font-black text-gray-900 mt-0.5">{formatMoney(stats.totalToday)}</p>
            <p className="text-[11px] font-bold text-amber-700 mt-0.5">{stats.countFiltered} data difilter</p>
          </div>
        </div>
      </div>

      {/* 2. KOTAK ATAS: CATAT KAS KELUAR BARU (FULL WIDTH) */}
      <div className="rounded-3xl bg-white p-5 sm:p-6 shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-3.5">
          <div>
            <h3 className="text-base font-extrabold text-[#2D3436] flex items-center gap-2">
              <span>📝</span> Catat Kas Keluar / Pengeluaran Baru
            </h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Ambil dana operasional dari kas pembayaran santri atau sumber dana kas lainnya
            </p>
          </div>
          <span className="self-start sm:self-auto rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-[11px] font-black text-teal-800">
            Kasir Kas Keluar
          </span>
        </div>

        {/* QUICK SUGGESTION CHIPS WITH SETTINGS BUTTON */}
        <div className="rounded-2xl bg-gray-50/90 p-3.5 border border-gray-200/70">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-[11px] font-black text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" /> Pilihan Cepat Keperluan:
            </span>
            <button
              type="button"
              onClick={() => setIsPresetModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-white hover:bg-teal-50 hover:text-teal-800 border border-gray-200 hover:border-teal-300 px-2.5 py-1 text-[11px] font-bold text-gray-700 transition-all shadow-2xs"
            >
              <Settings2 size={13} className="text-[#138F81]" />
              <span>Atur Pilihan Cepat</span>
              <span className="rounded-full bg-teal-100 px-1.5 py-0.2 text-[9px] font-black text-teal-800">
                {quickPresets.length}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickPresets.length === 0 ? (
              <p className="text-xs text-gray-400 font-medium italic">
                Belum ada pilihan cepat. Klik tombol "Atur Pilihan Cepat" di atas untuk menambah.
              </p>
            ) : (
              quickPresets.map((item) => (
                <button
                  key={item.id || item.label}
                  type="button"
                  onClick={() => {
                    setJudul(item.label);
                    setKategori(item.cat);
                  }}
                  className="rounded-xl bg-white hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 transition-all shadow-2xs flex items-center gap-1.5"
                >
                  <span>{item.label}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* BARIS 1: 3 KOLOM (SUMBER DANA, TANGGAL, KATEGORI) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* SUMBER DANA */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Sumber Dana Kas <span className="text-teal-600">*</span>
              </label>
              <select
                className="w-full rounded-2xl border border-teal-200 bg-teal-50/60 p-2.5 text-xs font-extrabold text-teal-950 focus:border-teal-500 focus:outline-none shadow-2xs"
                value={metodePembayaran}
                onChange={(e) => setMetodePembayaran(e.target.value)}
              >
                {FUND_SOURCES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* TANGGAL */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Tanggal Pengeluaran <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className="q-input font-bold text-gray-800 shadow-2xs"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                required
              />
            </div>

            {/* KATEGORI */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Kategori Pengeluaran
              </label>
              <select
                className="q-input font-bold text-gray-800 shadow-2xs"
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
              >
                {existingCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="__custom__">+ Tambah Kategori Lain...</option>
              </select>

              {kategori === '__custom__' && (
                <input
                  type="text"
                  className="q-input mt-2 font-semibold text-gray-800"
                  placeholder="Ketik nama kategori baru..."
                  value={customKategori}
                  onChange={(e) => setCustomKategori(e.target.value)}
                  required
                />
              )}
            </div>
          </div>

          {/* BARIS 2: 2 KOLOM (JUDUL, DIBAYARKAN KEPADA) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* JUDUL */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Judul / Keperluan Pengeluaran <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="q-input font-bold text-gray-900 shadow-2xs"
                placeholder="Contoh: Pembelian Beras Dapur 50kg / Token Listrik"
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                required
              />
            </div>

            {/* DIBAYARKAN KEPADA */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Dibayarkan Kepada / Penerima / Toko
              </label>
              <input
                type="text"
                className="q-input font-medium shadow-2xs"
                placeholder="Contoh: Toko Beras Makmur / PLN Bungah / Ust. Fulan"
                value={dibayarkanKepada}
                onChange={(e) => setDibayarkanKepada(e.target.value)}
              />
            </div>
          </div>

          {/* BARIS 3: 2 KOLOM (NOMINAL & KETERANGAN) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* NOMINAL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Nominal Pengeluaran (Rp) <span className="text-red-500">*</span>
                </label>
                {num(nominal) > 0 && (
                  <span className="text-xs font-extrabold text-rose-600">
                    {formatMoney(num(nominal))}
                  </span>
                )}
              </div>
              <input
                type="text"
                className="q-input text-lg font-black text-rose-600 tracking-wide shadow-2xs"
                placeholder="0"
                value={nominal ? formatMoney(num(nominal)).replace('Rp ', '') : ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '');
                  setNominal(raw);
                }}
                required
              />

              {/* QUICK NOMINAL SHORTCUTS */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  { l: '+50rb', v: 50000 },
                  { l: '+100rb', v: 100000 },
                  { l: '+200rb', v: 200000 },
                  { l: '+500rb', v: 500000 },
                  { l: '+1jt', v: 1000000 },
                  { l: '+5jt', v: 5000000 },
                ].map((btn) => (
                  <button
                    key={btn.l}
                    type="button"
                    onClick={() => addNominal(btn.v)}
                    className="rounded-lg bg-gray-100 hover:bg-teal-100 hover:text-teal-800 px-2.5 py-1 text-xs font-bold text-gray-700 transition-colors shadow-2xs"
                  >
                    {btn.l}
                  </button>
                ))}
                {num(nominal) > 0 && (
                  <button
                    type="button"
                    onClick={() => setNominal('')}
                    className="rounded-lg bg-rose-50 hover:bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700 transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* KETERANGAN */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Catatan / Keterangan Tambahan
              </label>
              <textarea
                className="q-input min-h-[78px] text-xs font-medium shadow-2xs"
                placeholder="Keterangan rincian nota belanja, kwitansi, atau keperluan operasional..."
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#138F81] px-8 py-3.5 text-sm font-extrabold text-white shadow-md shadow-[#138F81]/20 hover:bg-[#0F7A6E] transition-all disabled:opacity-50"
            >
              {isSubmitting ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
              {isSubmitting ? 'Menyimpan Pengeluaran Kas...' : 'Simpan Pengeluaran Kas'}
            </button>
          </div>
        </form>
      </div>

      {/* 3. KOTAK BAWAH: RIWAYAT & DATA PENGELUARAN KAS (FULL WIDTH) */}
      <div className="rounded-3xl bg-white p-5 sm:p-6 shadow-sm border border-gray-100 space-y-4">
        {/* HEADER & ACTION BUTTONS */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-[#2D3436] flex items-center gap-2">
              <span>📋</span> Riwayat & Data Pengeluaran Kas
            </h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Menampilkan <strong className="text-teal-700">{filteredRows.length}</strong> transaksi kas keluar
            </p>
          </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center gap-1.5 rounded-2xl bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100 transition-all shadow-xs"
              >
                <FileSpreadsheet size={15} /> Export Rekap Excel (.xlsx)
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-2xl bg-gray-100 hover:bg-gray-200 px-3 py-2 text-xs font-bold text-gray-700 transition-all"
              >
                <Printer size={15} /> Cetak
              </button>
            </div>
          </div>

          {/* FILTER TOOLBAR */}
          <div className="space-y-3.5 rounded-3xl bg-gray-50/80 p-4 border border-gray-200/70">
            {/* ROW 1: PERIOD FILTER PILLS */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200/60 pb-3">
              <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                Filter Periode:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'today', l: 'Hari Ini' },
                  { id: 'this_month', l: 'Bulan Ini' },
                  { id: 'this_year', l: 'Tahun Ini' },
                  { id: 'all', l: 'Semua Periode' },
                  { id: 'custom', l: '📅 Custom' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPeriodFilter(tab.id as any)}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-all ${
                      periodFilter === tab.id
                        ? 'bg-[#138F81] text-white shadow-xs'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 shadow-2xs'
                    }`}
                  >
                    {tab.l}
                  </button>
                ))}
              </div>
            </div>

            {/* ROW 2: SEARCH BAR (FULL WIDTH ON OWN ROW) */}
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                className="w-full rounded-2xl border border-gray-200 bg-white py-2.5 pl-10 pr-9 text-xs font-semibold text-gray-800 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all shadow-2xs"
                placeholder="Cari judul keperluan, no transaksi OUT-..., nama penerima, petugas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* ROW 3: DROPDOWN FILTERS (TAHUN AJARAN, TAHUN KALENDER, KATEGORI, SUMBER DANA) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-0.5">
              {/* TAHUN AJARAN */}
              <div>
                <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">🎓 Tahun Ajaran:</span>
                <select
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 px-2.5 text-xs font-bold text-gray-800 focus:border-teal-500 focus:outline-none shadow-2xs"
                  value={academicYearFilter}
                  onChange={(e) => setAcademicYearFilter(e.target.value)}
                >
                  <option value="all">Semua Tahun Ajaran</option>
                  {(academicPeriods || []).map((ap) => {
                    const isActive = ap.is_active === true || ap.status === 'Aktif';
                    return (
                      <option key={num(ap.id)} value={String(ap.id)}>
                        {str(ap.name ?? ap.tahun_ajaran)} {isActive ? '⭐ (Aktif)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* TAHUN KALENDER */}
              <div>
                <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">📅 Tahun Kalender:</span>
                <select
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 px-2.5 text-xs font-bold text-gray-800 focus:border-teal-500 focus:outline-none shadow-2xs"
                  value={calendarYearFilter}
                  onChange={(e) => setCalendarYearFilter(e.target.value)}
                >
                  <option value="all">Semua Tahun Kalender</option>
                  {availableCalendarYears.map((yr) => (
                    <option key={yr} value={yr}>
                      Tahun {yr}
                    </option>
                  ))}
                </select>
              </div>

              {/* KATEGORI */}
              <div>
                <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">🏷️ Filter Kategori:</span>
                <select
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 px-2.5 text-xs font-bold text-gray-800 focus:border-teal-500 focus:outline-none shadow-2xs"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">Semua Kategori ({existingCategories.length})</option>
                  {existingCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* SUMBER DANA */}
              <div>
                <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">🏛️ Sumber Dana:</span>
                <select
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 px-2.5 text-xs font-bold text-gray-800 focus:border-teal-500 focus:outline-none shadow-2xs"
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                >
                  <option value="all">Semua Sumber Dana</option>
                  {FUND_SOURCES.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ROW 4: CUSTOM DATE RANGE (IF ACTIVE) */}
            {periodFilter === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-200/60">
                <div>
                  <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Dari Tanggal:</span>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-gray-200 bg-white py-2 px-3 text-xs font-bold text-gray-800 focus:border-teal-500 focus:outline-none"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sampai Tanggal:</span>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-gray-200 bg-white py-2 px-3 text-xs font-bold text-gray-800 focus:border-teal-500 focus:outline-none"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* TABLE OF EXPENSES */}
          <div className="overflow-hidden rounded-2xl border border-gray-200">
            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full text-left text-xs text-gray-700">
                <thead className="sticky top-0 bg-[#F4F8F7] text-[11px] font-black uppercase text-[#138F81] border-b border-gray-200 shadow-2xs">
                  <tr>
                    <th className="py-3 px-3.5">Tanggal & No Trx</th>
                    <th className="py-3 px-3.5">Keperluan / Judul</th>
                    <th className="py-3 px-3.5">Kategori</th>
                    <th className="py-3 px-3.5 text-right">Nominal (Rp)</th>
                    <th className="py-3 px-3.5">Sumber Dana & Petugas</th>
                    <th className="py-3 px-3.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400">
                        <p className="text-sm font-bold">Tidak ada data pengeluaran yang sesuai filter.</p>
                        <p className="text-xs text-gray-400 mt-1">Coba sesuaikan kata kunci pencarian atau tanggal.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => {
                      const noTrx = str(row.no_transaksi, `EXP-${String(row.id).padStart(4, '0')}`);
                      const tglStr = row.tanggal ? new Date(String(row.tanggal)).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
                      const petugasName = str((row.penginput as ApiRecord)?.name, 'Admin');

                      return (
                        <tr key={num(row.id)} className="hover:bg-teal-50/40 transition-colors">
                          {/* TANGGAL & NO TRX */}
                          <td className="py-3 px-3.5 font-medium whitespace-nowrap">
                            <span className="font-bold text-gray-900 block">{tglStr}</span>
                            <span className="text-[10px] font-mono text-gray-400">{noTrx}</span>
                          </td>

                          {/* KEPERLUAN & PENERIMA */}
                          <td className="py-3 px-3.5">
                            <p className="font-extrabold text-gray-900">{str(row.judul)}</p>
                            {Boolean(row.dibayarkan_kepada) && (
                              <p className="text-[11px] text-gray-500 font-medium">
                                Penerima: <span className="text-gray-700">{str(row.dibayarkan_kepada)}</span>
                              </p>
                            )}
                            {Boolean(row.keterangan) && (
                              <p className="text-[10px] text-gray-400 italic truncate max-w-[200px]">
                                {str(row.keterangan)}
                              </p>
                            )}
                          </td>

                          {/* KATEGORI */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="rounded-lg bg-teal-50 border border-teal-200 px-2 py-0.5 text-[10px] font-extrabold text-teal-800">
                              {str(row.kategori, 'Umum')}
                            </span>
                          </td>

                          {/* NOMINAL */}
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <MoneyText value={num(row.jumlah)} className="font-black text-rose-600 text-sm" />
                          </td>

                          {/* METODE & PETUGAS */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="block text-[11px] font-bold text-teal-900 truncate max-w-[150px]" title={str(row.metode_pembayaran)}>
                              {str(row.metode_pembayaran, 'Kas Pembayaran Siswa')}
                            </span>
                            <span className="block text-[10px] text-gray-400">Oleh: {petugasName}</span>
                          </td>

                          {/* AKSI */}
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* CETAK KWITANSI */}
                              <button
                                type="button"
                                title="Cetak Kwitansi / Bukti Kas Keluar"
                                onClick={() => setReceiptRow(row)}
                                className="rounded-xl bg-amber-50 hover:bg-amber-100 p-2 text-amber-700 transition-colors shadow-2xs"
                              >
                                <Printer size={14} />
                              </button>

                              {/* EDIT */}
                              <button
                                type="button"
                                title="Edit Pengeluaran"
                                onClick={() => setEditingRow(row)}
                                className="rounded-xl bg-blue-50 hover:bg-blue-100 p-2 text-blue-700 transition-colors shadow-2xs"
                              >
                                <Edit size={14} />
                              </button>

                              {/* HAPUS */}
                              <button
                                type="button"
                                title="Hapus Pengeluaran"
                                onClick={() => setDeleteConfirmRow(row)}
                                className="rounded-xl bg-rose-50 hover:bg-rose-100 p-2 text-rose-700 transition-colors shadow-2xs"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* SUBTOTAL FOOTER */}
            {filteredRows.length > 0 && (
              <div className="flex items-center justify-between bg-[#F4F8F7] px-4 py-3 border-t border-gray-200">
                <span className="text-xs font-extrabold text-gray-600">
                  TOTAL AKUMULASI PENGELUARAN TERFILTER:
                </span>
                <span className="text-base font-black text-rose-600">
                  {formatMoney(stats.totalFiltered)}
                </span>
              </div>
            )}

            {/* PAGINATION FOOTER */}
            {filteredRows.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white px-4 py-2.5 border-t border-gray-200 text-xs font-bold text-gray-600">
                <div className="flex items-center gap-2">
                  <span>
                    Menampilkan <span className="text-[#138F81] font-extrabold">{startIndex}</span> –{' '}
                    <span className="text-[#138F81] font-extrabold">{endIndex}</span> dari{' '}
                    <span className="text-gray-900 font-extrabold">{filteredRows.length.toLocaleString('id-ID')}</span> data
                  </span>
                  <span className="text-gray-300">|</span>
                  <div className="flex items-center gap-1">
                    <span>Per hal:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-xs font-bold text-gray-800 focus:border-[#138F81] focus:outline-none"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={filteredRows.length}>Semua</option>
                    </select>
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(1)}
                      disabled={safePage <= 1}
                      title="Halaman Pertama"
                      className="grid h-7 w-7 place-items-center rounded-lg bg-gray-50 text-gray-600 hover:bg-[#138F81] hover:text-white disabled:opacity-40 disabled:hover:bg-gray-50 disabled:hover:text-gray-600 transition-colors"
                    >
                      <ChevronsLeft size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                      title="Halaman Sebelumnya"
                      className="grid h-7 w-7 place-items-center rounded-lg bg-gray-50 text-gray-600 hover:bg-[#138F81] hover:text-white disabled:opacity-40 disabled:hover:bg-gray-50 disabled:hover:text-gray-600 transition-colors"
                    >
                      <ChevronLeft size={14} />
                    </button>

                    <span className="px-2.5 py-0.5 font-bold text-gray-800 bg-gray-100 rounded-lg">
                      Hal {safePage} / {totalPages}
                    </span>

                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                      title="Halaman Selanjutnya"
                      className="grid h-7 w-7 place-items-center rounded-lg bg-gray-50 text-gray-600 hover:bg-[#138F81] hover:text-white disabled:opacity-40 disabled:hover:bg-gray-50 disabled:hover:text-gray-600 transition-colors"
                    >
                      <ChevronRight size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={safePage >= totalPages}
                      title="Halaman Terakhir"
                      className="grid h-7 w-7 place-items-center rounded-lg bg-gray-50 text-gray-600 hover:bg-[#138F81] hover:text-white disabled:opacity-40 disabled:hover:bg-gray-50 disabled:hover:text-gray-600 transition-colors"
                    >
                      <ChevronsRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      {/* 3. EDIT EXPENSE MODAL */}
      {editingRow && (
        <EditExpenseModal
          row={editingRow}
          onClose={() => setEditingRow(null)}
          onSaved={async () => {
            await onReload();
            setEditingRow(null);
            showToast('✅ Catatan pengeluaran berhasil diperbarui!', 'success');
          }}
          existingCategories={existingCategories}
        />
      )}

      {/* 4. KWITANSI / BUKTI KAS KELUAR MODAL */}
      {receiptRow && (
        <ExpenseReceiptModal
          row={receiptRow}
          docSetting={docSetting}
          onClose={() => setReceiptRow(null)}
        />
      )}

      {/* 5. EXPORT REKAP EXCEL MODAL */}
      {isExportModalOpen && (
        <ExportPengeluaranModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          existingCategories={existingCategories}
          academicPeriods={academicPeriods}
          availableCalendarYears={availableCalendarYears}
        />
      )}

      {/* 6. MANAGE QUICK PRESETS MODAL */}
      {isPresetModalOpen && (
        <ManageExpenseQuickPresetsModal
          isOpen={isPresetModalOpen}
          onClose={() => setIsPresetModalOpen(false)}
          presets={quickPresets}
          onSave={handleSavePresets}
          existingCategories={existingCategories}
          showToast={showToast}
        />
      )}

      {/* 7. DELETE CONFIRMATION DIALOG */}
      {deleteConfirmRow && (
        <ModalForm
          title="Konfirmasi Hapus Pengeluaran"
          onClose={() => setDeleteConfirmRow(null)}
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmRow(null)}
                className="rounded-2xl bg-gray-100 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="rounded-2xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus Data'}
              </button>
            </div>
          }
        >
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-700">
              Apakah Anda yakin ingin menghapus catatan pengeluaran kas berikut?
            </p>
            <div className="rounded-2xl bg-rose-50/60 border border-rose-200 p-3 space-y-1">
              <p className="text-xs font-bold text-gray-900">
                Judul: <span className="font-extrabold text-rose-800">{str(deleteConfirmRow.judul)}</span>
              </p>
              <p className="text-xs text-gray-600">
                Nominal: <span className="font-black text-rose-700">{formatMoney(num(deleteConfirmRow.jumlah))}</span>
              </p>
              <p className="text-xs text-gray-500">
                Tanggal: {deleteConfirmRow.tanggal ? new Date(String(deleteConfirmRow.tanggal)).toLocaleDateString('id-ID') : '-'}
              </p>
            </div>
            <p className="text-[11px] text-gray-500 font-medium">
              ⚠️ Tindakan ini akan menghapus data kas keluar secara permanen dari database.
            </p>
          </div>
        </ModalForm>
      )}
    </div>
  );
}

// ==========================================
// SUBCOMPONENT: EDIT EXPENSE MODAL
// ==========================================
function EditExpenseModal({
  row,
  onClose,
  onSaved,
  existingCategories,
}: {
  row: ApiRecord;
  onClose: () => void;
  onSaved: () => Promise<void>;
  existingCategories: string[];
}) {
  const [judul, setJudul] = useState(str(row.judul, ''));
  const [jumlah, setJumlah] = useState(String(row.jumlah ?? '0'));
  const [tanggal, setTanggal] = useState(str(row.tanggal, new Date().toISOString().split('T')[0]));
  const [kategori, setKategori] = useState(str(row.kategori, 'Konsumsi & Dapur'));
  const [dibayarkanKepada, setDibayarkanKepada] = useState(str(row.dibayarkan_kepada, ''));
  const [metodePembayaran, setMetodePembayaran] = useState(str(row.metode_pembayaran, 'Kas Pembayaran Siswa (Pemasukan Transaksi)'));
  const [keterangan, setKeterangan] = useState(str(row.keterangan, ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        judul: judul.trim(),
        jumlah: num(jumlah),
        tanggal,
        kategori,
        dibayarkan_kepada: dibayarkanKepada.trim() || null,
        metode_pembayaran: metodePembayaran,
        keterangan: keterangan.trim() || null,
      };

      await api.updatePengeluaran(num(row.id), payload);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data pengeluaran gagal diperbarui');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalForm
      title="Edit Catatan Pengeluaran"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-2xl bg-gray-100 px-4 py-2.5 text-xs font-bold text-gray-700">
            Batal
          </button>
          <button
            type="submit"
            form="edit-pengeluaran-form"
            disabled={saving}
            className="flex items-center gap-1.5 rounded-2xl bg-[#138F81] px-5 py-2.5 text-xs font-extrabold text-white hover:bg-[#0F7A6E] disabled:opacity-50"
          >
            {saving ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
            {saving ? 'Menyimpan...' : 'Perbarui Pengeluaran'}
          </button>
        </div>
      }
    >
      <form id="edit-pengeluaran-form" className="space-y-3.5" onSubmit={submit}>
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tanggal</label>
          <input type="date" className="q-input font-bold" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Judul / Keperluan</label>
          <input type="text" className="q-input font-bold" value={judul} onChange={(e) => setJudul(e.target.value)} required />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nominal (Rp)</label>
          <input
            type="text"
            className="q-input font-black text-rose-600"
            value={jumlah ? formatMoney(num(jumlah)).replace('Rp ', '') : ''}
            onChange={(e) => setJumlah(e.target.value.replace(/\D/g, ''))}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Kategori</label>
            <select className="q-input font-bold" value={kategori} onChange={(e) => setKategori(e.target.value)}>
              {existingCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Sumber Dana Kas</label>
            <select className="q-input font-bold" value={metodePembayaran} onChange={(e) => setMetodePembayaran(e.target.value)}>
              {FUND_SOURCES.map((f) => (
                <option key={f.id} value={f.id}>{f.id}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Dibayarkan Kepada / Penerima</label>
          <input type="text" className="q-input font-medium" value={dibayarkanKepada} onChange={(e) => setDibayarkanKepada(e.target.value)} />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Catatan Tambahan</label>
          <textarea className="q-input min-h-16 text-xs font-medium" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
        </div>

        {error && <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-700">{error}</div>}
      </form>
    </ModalForm>
  );
}

// ==========================================
// SUBCOMPONENT: OFFICIAL EXPENSE RECEIPT MODAL
// ==========================================
function ExpenseReceiptModal({
  row,
  docSetting,
  onClose
}: {
  row: ApiRecord;
  docSetting?: ApiRecord | null;
  onClose: () => void;
}) {
  const instansiName = str(docSetting?.payment_admin_name, "MTS ASSA'ADAH II");
  const instansiAlamat = str(docSetting?.payment_admin_title, "JL. MASJID KIYAI GEDE BUNGAH GRESIK");

  const noTrx = str(row.no_transaksi, `OUT-${String(row.id).padStart(4, '0')}`);
  const tglFormatted = row.tanggal ? new Date(String(row.tanggal)).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
  const nominalValue = num(row.jumlah);
  const terbilangText = angkaTerbilang(nominalValue) + ' Rupiah';
  const petugasName = str((row.penginput as ApiRecord)?.name, 'Bendahara Keuangan');

  function handlePrint() {
    window.print();
  }

  return (
    <ModalForm
      title="Bukti Pengeluaran Kas (Kwitansi Kas Keluar)"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-2xl bg-gray-100 px-4 py-2.5 text-xs font-bold text-gray-700">
            Tutup
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-2xl bg-[#138F81] px-5 py-2.5 text-xs font-black text-white hover:bg-[#0F7A6E] shadow-sm"
          >
            <Printer size={15} /> Cetak Bukti Kas Keluar
          </button>
        </div>
      }
    >
      <div className="p-2 space-y-4">
        {/* PRINTABLE VOUCHER CONTAINER */}
        <div
          className="mx-auto rounded-2xl bg-white p-5 border border-gray-300 shadow-sm text-gray-900 leading-relaxed font-sans"
          style={{ maxWidth: '420px' }}
        >
          {/* HEADER KOP */}
          <div className="text-center border-b-2 border-gray-800 pb-3">
            <h4 className="text-sm font-black uppercase text-[#138F81] tracking-wider">{instansiName}</h4>
            <p className="text-[10px] text-gray-500 font-medium">{instansiAlamat}</p>
            <div className="mt-2 inline-block rounded-md bg-gray-900 px-3 py-0.5 text-[10px] font-black text-white uppercase tracking-widest">
              BUKTI PENGELUARAN KAS KELUAR
            </div>
          </div>

          {/* META INFO */}
          <div className="py-3 border-b border-dashed border-gray-300 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">No. Bukti / Trx:</span>
              <span className="font-mono font-bold text-gray-900">{noTrx}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tanggal:</span>
              <span className="font-bold text-gray-900">{tglFormatted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Kategori Kas:</span>
              <span className="font-bold text-teal-800">{str(row.kategori, 'Umum')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Sumber Dana:</span>
              <span className="font-bold text-teal-900">{str(row.metode_pembayaran, 'Kas Pembayaran Siswa')}</span>
            </div>
          </div>

          {/* DETAIL DATA */}
          <div className="py-3 border-b border-gray-200 text-xs space-y-2">
            <div>
              <span className="text-[11px] text-gray-500 block">Dibayarkan Kepada:</span>
              <span className="text-xs font-bold text-gray-900 block">{str(row.dibayarkan_kepada, '-')}</span>
            </div>

            <div>
              <span className="text-[11px] text-gray-500 block">Untuk Keperluan:</span>
              <span className="text-xs font-extrabold text-gray-900 block">{str(row.judul)}</span>
              {Boolean(row.keterangan) && <span className="text-[10px] text-gray-500 block italic">({str(row.keterangan)})</span>}
            </div>

            <div className="rounded-xl bg-gray-50 p-2.5 border border-gray-200 space-y-1 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-gray-700">Jumlah Uang:</span>
                <span className="text-base font-black text-rose-600">{formatMoney(nominalValue)}</span>
              </div>
              <div className="text-[11px] font-bold text-gray-600 italic border-t border-gray-200 pt-1">
                Terbilang: #{terbilangText}#
              </div>
            </div>
          </div>

          {/* SIGNATURES */}
          <div className="pt-4 grid grid-cols-2 text-center text-[11px] font-medium text-gray-700">
            <div>
              <p className="text-gray-500">Yang Menerima,</p>
              <div className="h-14" />
              <p className="font-bold text-gray-900 underline">
                ( {str(row.dibayarkan_kepada, '.......................')} )
              </p>
            </div>
            <div>
              <p className="text-gray-500">Bendahara / Kasir,</p>
              <div className="h-14" />
              <p className="font-bold text-gray-900 underline">( {petugasName} )</p>
            </div>
          </div>

          <div className="mt-4 border-t border-dashed border-gray-300 pt-2 text-center text-[9px] text-gray-400">
            Dicetak otomatis oleh Sistem Keuangan Pesantren • {new Date().toLocaleString('id-ID')}
          </div>
        </div>
      </div>
    </ModalForm>
  );
}

// ==========================================
// SUBCOMPONENT: EXPORT EXCEL MODAL
// ==========================================
function ExportPengeluaranModal({
  isOpen,
  onClose,
  existingCategories,
  academicPeriods = [],
  availableCalendarYears = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  existingCategories: string[];
  academicPeriods?: ApiRecord[];
  availableCalendarYears?: string[];
}) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [academicYearId, setAcademicYearId] = useState('all');
  const [calendarYear, setCalendarYear] = useState('all');
  const [kategori, setKategori] = useState('all');
  const [metode, setMetode] = useState('all');
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  async function handleDownload() {
    setIsExporting(true);
    try {
      await api.exportPengeluaran({
        start_date: startDate || '',
        end_date: endDate || '',
        academic_year_id: academicYearId !== 'all' ? academicYearId : '',
        year: calendarYear !== 'all' ? calendarYear : '',
        kategori: kategori !== 'all' ? kategori : '',
        metode_pembayaran: metode !== 'all' ? metode : '',
      });
      onClose();
    } catch (err) {
      alert(`Export gagal: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <ModalForm
      title="Export Rekap Pengeluaran & Arus Kas (.xlsx)"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-2xl bg-gray-100 px-4 py-2.5 text-xs font-bold text-gray-700">
            Batal
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs font-black text-white shadow-sm disabled:opacity-50"
          >
            {isExporting ? <RefreshCw className="animate-spin" size={15} /> : <Download size={15} />}
            {isExporting ? 'Memproses Excel...' : 'Download Rekap Excel'}
          </button>
        </div>
      }
    >
      <div className="space-y-4 py-2">
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 flex items-start gap-2.5">
          <FileSpreadsheet className="text-emerald-700 shrink-0 mt-0.5" size={20} />
          <div className="text-xs text-emerald-900">
            <p className="font-extrabold">Format Excel 4-Sheet Multi-Laporan Lengkap</p>
            <p className="text-[11px] text-emerald-700 mt-0.5">
              File Excel berisi: <strong>1. Rincian Kas Keluar</strong>, <strong>2. Rekap Per Kategori</strong>, <strong>3. Rekap Bulanan</strong>, dan <strong>4. Buku Kas & Arus Kas (Pemasukan Santri vs Kas Keluar)</strong> lengkap dengan rumus SUM dan saldo mutasi otomatis.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">🎓 Tahun Ajaran</label>
            <select className="q-input font-bold" value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
              <option value="all">Semua Tahun Ajaran</option>
              {academicPeriods.map((ap) => {
                const isActive = ap.is_active === true || ap.status === 'Aktif';
                return (
                  <option key={num(ap.id)} value={String(ap.id)}>
                    {str(ap.name ?? ap.tahun_ajaran)} {isActive ? '⭐ (Aktif)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">📅 Tahun Kalender</label>
            <select className="q-input font-bold" value={calendarYear} onChange={(e) => setCalendarYear(e.target.value)}>
              <option value="all">Semua Tahun</option>
              {availableCalendarYears.map((yr) => (
                <option key={yr} value={yr}>
                  Tahun {yr}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Dari Tanggal (Opsional)</label>
            <input type="date" className="q-input font-bold" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Sampai Tanggal (Opsional)</label>
            <input type="date" className="q-input font-bold" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Filter Kategori</label>
          <select className="q-input font-bold" value={kategori} onChange={(e) => setKategori(e.target.value)}>
            <option value="all">Semua Kategori</option>
            {existingCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Filter Sumber Dana</label>
          <select className="q-input font-bold" value={metode} onChange={(e) => setMetode(e.target.value)}>
            <option value="all">Semua Sumber Dana</option>
            {FUND_SOURCES.map((f) => (
              <option key={f.id} value={f.id}>{f.id}</option>
            ))}
          </select>
        </div>
      </div>
    </ModalForm>
  );
}

// ==========================================
// SUBCOMPONENT: MANAGE EXPENSE QUICK PRESETS MODAL
// ==========================================
function ManageExpenseQuickPresetsModal({
  isOpen,
  onClose,
  presets,
  onSave,
  existingCategories,
  showToast
}: {
  isOpen: boolean;
  onClose: () => void;
  presets: QuickExpensePresetItem[];
  onSave: (items: QuickExpensePresetItem[]) => void;
  existingCategories: string[];
  showToast: (message: string, type?: 'success' | 'error') => void;
}) {
  const [items, setItems] = useState<QuickExpensePresetItem[]>(presets);
  const [newLabel, setNewLabel] = useState('');
  const [newCat, setNewCat] = useState(existingCategories[0] || 'Konsumsi & Dapur');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editCat, setEditCat] = useState('');

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) {
      showToast('Nama pilihan cepat tidak boleh kosong', 'error');
      return;
    }
    const newItem: QuickExpensePresetItem = {
      id: String(Date.now()),
      label: newLabel.trim(),
      cat: newCat.trim() || 'Konsumsi & Dapur'
    };
    const updated = [...items, newItem];
    setItems(updated);
    onSave(updated);
    setNewLabel('');
    showToast('✅ Pilihan cepat pengeluaran berhasil ditambahkan!', 'success');
  };

  const handleStartEdit = (item: QuickExpensePresetItem) => {
    setEditingId(item.id);
    setEditLabel(item.label);
    setEditCat(item.cat);
  };

  const handleSaveEdit = () => {
    if (!editLabel.trim()) return;
    const updated = items.map((it) => (it.id === editingId ? { ...it, label: editLabel.trim(), cat: editCat.trim() } : it));
    setItems(updated);
    onSave(updated);
    setEditingId(null);
    showToast('✅ Pilihan cepat pengeluaran berhasil diperbarui!', 'success');
  };

  const handleDelete = (id: string) => {
    const updated = items.filter((it) => it.id !== id);
    setItems(updated);
    onSave(updated);
    showToast('🗑️ Pilihan cepat pengeluaran berhasil dihapus', 'success');
  };

  const handleResetDefault = () => {
    if (confirm('Kembalikan seluruh pilihan cepat pengeluaran ke daftar bawaan sistem?')) {
      setItems(DEFAULT_QUICK_EXPENSES);
      onSave(DEFAULT_QUICK_EXPENSES);
      showToast('✨ Pilihan cepat pengeluaran telah direset ke default!', 'success');
    }
  };

  return (
    <ModalForm
      title="⚙️ Master Data: Atur Pilihan Cepat Pengeluaran"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={handleResetDefault}
            className="rounded-2xl bg-amber-50 hover:bg-amber-100 px-3.5 py-2 text-xs font-bold text-amber-800 border border-amber-200 transition-colors"
          >
            ↺ Reset ke Default
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-[#138F81] hover:bg-[#0F7A6E] px-6 py-2.5 text-xs font-black text-white shadow-sm transition-all"
          >
            Selesai
          </button>
        </div>
      }
    >
      <div className="space-y-4 py-2">
        <p className="text-xs text-gray-500 font-medium">
          Daftar tombol pintas ini akan muncul pada menu <strong>Catat Kas Keluar / Pengeluaran</strong> untuk memudahkan bendahara mengisi keperluan operasional secara instan dengan 1x klik.
        </p>

        {/* FORM TAMBAH BARU */}
        <form onSubmit={handleAdd} className="rounded-2xl bg-teal-50/60 border border-teal-200/80 p-3.5 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-black text-teal-900">
            <PlusCircle size={15} className="text-teal-700" />
            <span>Tambah Pilihan Cepat Pengeluaran Baru</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                Nama Keperluan / Judul <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="q-input text-xs font-bold bg-white"
                placeholder="Contoh: Tagihan WiFi Indihome"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                Kategori Otomatis
              </label>
              <select
                className="q-input text-xs font-bold bg-white"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
              >
                {existingCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-[#138F81] hover:bg-[#0F7A6E] px-4 py-2 text-xs font-black text-white shadow-xs"
            >
              <Plus size={14} /> Tambah Ke Pilihan Cepat
            </button>
          </div>
        </form>

        {/* LIST EXISTING PRESETS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-700 uppercase px-1">
            <span>Daftar Pilihan Cepat Aktif ({items.length})</span>
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-400 text-xs font-bold">
                Belum ada pilihan cepat. Tambahkan di formulir atas atau klik Reset ke Default.
              </div>
            ) : (
              items.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="rounded-2xl border border-gray-200 bg-white p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-teal-300 transition-all shadow-2xs"
                >
                  {editingId === item.id ? (
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        className="q-input text-xs font-bold"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        placeholder="Nama keperluan..."
                        autoFocus
                      />
                      <select
                        className="q-input text-xs font-bold"
                        value={editCat}
                        onChange={(e) => setEditCat(e.target.value)}
                      >
                        {existingCategories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xs font-black text-gray-700">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-xs font-black text-gray-900">{item.label}</p>
                        <p className="text-[11px] font-bold text-teal-700">🏷️ {item.cat}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    {editingId === item.id ? (
                      <>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          className="rounded-xl bg-[#138F81] px-3 py-1.5 text-xs font-black text-white hover:bg-[#0F7A6E] shadow-2xs"
                        >
                          Simpan
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-200"
                        >
                          Batal
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          title="Edit Pilihan Cepat"
                          onClick={() => handleStartEdit(item)}
                          className="rounded-xl bg-gray-100 hover:bg-teal-50 hover:text-teal-800 p-2 text-gray-600 transition-colors"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          type="button"
                          title="Hapus Pilihan Cepat"
                          onClick={() => handleDelete(item.id)}
                          className="rounded-xl bg-rose-50 hover:bg-rose-100 p-2 text-rose-700 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </ModalForm>
  );
}
