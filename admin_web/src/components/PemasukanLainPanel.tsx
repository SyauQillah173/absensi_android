import React, { FormEvent, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Download,
  Edit,
  FileSpreadsheet,
  Filter,
  HandCoins,
  Landmark,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  Wallet,
  X
} from 'lucide-react';
import { api, type ApiRecord } from '../services/api';
import { formatMoney, MoneyText } from './MoneyText';
import { ModalForm } from './ModalForm';

interface PemasukanLainPanelProps {
  rows: ApiRecord[];
  summaryData?: ApiRecord | null;
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

const DEFAULT_CATEGORIES = [
  'Infaq & Shodaqoh',
  'Donasi Pembangunan',
  'Bantuan Yayasan',
  'Dana BOS / Hibah',
  'Unit Usaha / Koperasi',
  'Sumbangan Alumni',
  'Sumbangan Wali Santri',
  'Kas Awal Bendahara',
  'Lain-lain'
];

const FUND_SOURCES = [
  { id: 'Kas Tunai Bendahara', label: '💵 Kas Tunai Bendahara', desc: 'Diterima tunai di kasir bendahara' },
  { id: 'Transfer Bank BSI', label: '🏛️ Transfer Bank BSI', desc: 'Rekening penerimaan BSI' },
  { id: 'Transfer Bank Mandiri', label: '🏛️ Transfer Bank Mandiri', desc: 'Rekening penerimaan Mandiri' },
  { id: 'Transfer Bank BRI / Lainnya', label: '🏛️ Transfer Bank BRI / Lainnya', desc: 'Rekening Bank Lain' },
  { id: 'Kas Yayasan / Bantuan', label: '🤝 Kas Yayasan / Bantuan', desc: 'Subsidi/bantuan yayasan' },
];

const QUICK_TITLES = [
  { label: "Infaq Jum'at & Shodaqoh", cat: 'Infaq & Shodaqoh' },
  { label: 'Donasi Pembangunan Asrama', cat: 'Donasi Pembangunan' },
  { label: 'Bantuan Operasional BOS', cat: 'Dana BOS / Hibah' },
  { label: 'Subsidi Kas Yayasan', cat: 'Bantuan Yayasan' },
  { label: 'Sumbangan Reuni Alumni', cat: 'Sumbangan Alumni' },
  { label: 'Bagi Hasil Usaha Koperasi', cat: 'Unit Usaha / Koperasi' },
  { label: 'Sumbangan Sukarela Wali', cat: 'Sumbangan Wali Santri' },
];

export function PemasukanLainPanel({
  rows,
  summaryData,
  academicPeriods = [],
  userId,
  docSetting,
  onReload,
  showToast
}: PemasukanLainPanelProps) {
  // --- FORM STATE ---
  const todayStr = new Date().toISOString().split('T')[0];
  const [tanggal, setTanggal] = useState(todayStr);
  const [judul, setJudul] = useState('');
  const [kategori, setKategori] = useState('Infaq & Shodaqoh');
  const [customKategori, setCustomKategori] = useState('');
  const [nominal, setNominal] = useState('');
  const [sumberDana, setSumberDana] = useState('Kas Tunai Bendahara');
  const [diterimaDari, setDiterimaDari] = useState('');
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
  const [sourceFilter, setSourceFilter] = useState('all');

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

      // 5. Source Filter
      if (sourceFilter !== 'all' && str(r.sumber_dana || 'Kas Tunai Bendahara') !== sourceFilter) return false;

      // 6. Search Query
      if (search.trim()) {
        const query = search.toLowerCase();
        const j = str(r.judul).toLowerCase();
        const k = str(r.kategori).toLowerCase();
        const p = str(r.diterima_dari).toLowerCase();
        const no = str(r.no_transaksi).toLowerCase();
        const ket = str(r.keterangan).toLowerCase();
        const s = str(r.sumber_dana).toLowerCase();
        const petugas = str((r.penginput as ApiRecord)?.name).toLowerCase();
        const ayName = str((r.academicYear as ApiRecord)?.name).toLowerCase();

        return (
          j.includes(query) ||
          k.includes(query) ||
          p.includes(query) ||
          no.includes(query) ||
          ket.includes(query) ||
          s.includes(query) ||
          petugas.includes(query) ||
          ayName.includes(query)
        );
      }

      return true;
    });
  }, [rows, search, periodFilter, academicYearFilter, calendarYearFilter, customStartDate, customEndDate, categoryFilter, sourceFilter, todayStr]);

  // --- STATS COMPUTATION ---
  const stats = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const curMonthPrefix = `${curYear}-${curMonth}`;

    let totalAll = 0;
    let totalMonth = 0;
    let totalToday = 0;
    let totalFiltered = 0;
    const catMap: Record<string, number> = {};

    rows.forEach((r) => {
      const rowDate = String(r.tanggal || '').split('T')[0];
      const amt = num(r.jumlah);
      const cat = str(r.kategori, 'Lain-lain');

      totalAll += amt;

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

    let topCatName = '-';
    let topCatAmount = 0;
    Object.entries(catMap).forEach(([k, v]) => {
      if (v > topCatAmount) {
        topCatAmount = v;
        topCatName = k;
      }
    });

    return {
      totalAll: num(summaryData?.total_all) || totalAll,
      totalMonth: num(summaryData?.total_this_month) || totalMonth,
      totalToday: num(summaryData?.total_today) || totalToday,
      totalFiltered,
      countFiltered: filteredRows.length,
      topCatName,
      topCatAmount,
    };
  }, [rows, filteredRows, summaryData, todayStr]);

  // --- HANDLE SUBMIT NEW INCOME ---
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!judul.trim()) {
      showToast('Harap isi judul/keperluan pemasukan kas!', 'error');
      return;
    }
    const cleanAmount = num(nominal);
    if (cleanAmount <= 0) {
      showToast('Nominal pemasukan kas harus lebih dari Rp 0!', 'error');
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
        sumber_dana: sumberDana,
        diterima_dari: diterimaDari.trim() || null,
        keterangan: keterangan.trim() || null,
        user_id: userId,
      };

      await api.createPemasukanLain(payload);
      await onReload();

      // Reset form
      setJudul('');
      setNominal('');
      setDiterimaDari('');
      setKeterangan('');
      setCustomKategori('');
      showToast('✅ Pemasukan kas sumber dana berhasil dicatat!', 'success');
    } catch (err) {
      showToast(`Gagal mencatat pemasukan kas: ${err instanceof Error ? err.message : 'Error'}`, 'error');
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
      await api.deletePemasukanLain(num(deleteConfirmRow.id));
      await onReload();
      showToast('✅ Catatan pemasukan kas berhasil dihapus', 'success');
      setDeleteConfirmRow(null);
    } catch (err) {
      showToast(`Gagal menghapus pemasukan kas: ${err instanceof Error ? err.message : 'Error'}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. TOP SUMMARY CARDS (CLEAN WHITE BG) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* CARD 1: PEMASUKAN BULAN INI */}
        <div className="rounded-3xl bg-white p-5 shadow-xs border border-emerald-100 flex items-center gap-4 transition-all hover:shadow-md">
          <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <ArrowDownLeft size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-wider text-emerald-700 uppercase">Pemasukan Kas Bulan Ini</p>
            <p className="text-xl font-black text-emerald-900 mt-0.5">{formatMoney(stats.totalMonth)}</p>
            <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">📥 Donasi, BOS, Infaq & Bantuan</p>
          </div>
        </div>

        {/* CARD 2: PEMASUKAN HARI INI */}
        <div className="rounded-3xl bg-white p-5 shadow-xs border border-teal-100 flex items-center gap-4 transition-all hover:shadow-md">
          <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-[#138F81]">
            <CalendarDays size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-wider text-[#138F81] uppercase">Pemasukan Hari Ini</p>
            <p className="text-xl font-black text-gray-900 mt-0.5">{formatMoney(stats.totalToday)}</p>
            <p className="text-[11px] font-semibold text-teal-600 mt-0.5">✨ Kas Masuk Masuk Hari Ini</p>
          </div>
        </div>

        {/* CARD 3: KATEGORI TERBANYAK */}
        <div className="rounded-3xl bg-white p-5 shadow-xs border border-blue-100 flex items-center gap-4 transition-all hover:shadow-md">
          <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <HandCoins size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-wider text-blue-700 uppercase">Kategori Terbanyak</p>
            <p className="text-sm font-black text-gray-900 mt-0.5 truncate max-w-[170px]" title={stats.topCatName}>
              {stats.topCatName}
            </p>
            <p className="text-[11px] font-extrabold text-blue-600 mt-0.5">{formatMoney(stats.topCatAmount)}</p>
          </div>
        </div>

        {/* CARD 4: TOTAL AKUMULASI */}
        <div className="rounded-3xl bg-white p-5 shadow-xs border border-gray-100 flex items-center gap-4 transition-all hover:shadow-md">
          <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-700">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-wider text-gray-500 uppercase">Total Seluruh Kas Masuk</p>
            <p className="text-xl font-black text-gray-900 mt-0.5">{formatMoney(stats.totalAll)}</p>
            <p className="text-[11px] font-bold text-gray-400 mt-0.5">{stats.countFiltered} data difilter</p>
          </div>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE: TWO-COLUMN SIDE-BY-SIDE */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* LEFT COLUMN: DIRECT INPUT FORM (4 / 12) */}
        <div className="lg:col-span-4 rounded-3xl bg-white p-5 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-[#2D3436] flex items-center gap-2">
                <span>🎁</span> Catat Pemasukan Kas Baru
              </h3>
              <p className="text-xs text-gray-500 font-medium mt-0.5">Donasi, Infaq, BOS, Subsidi Yayasan, dll</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
              Kas Masuk Lain
            </span>
          </div>

          {/* QUICK SUGGESTION CHIPS */}
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Pilihan Cepat Keperluan:</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TITLES.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setJudul(item.label);
                    setKategori(item.cat);
                  }}
                  className="rounded-lg bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-gray-200 px-2 py-1 text-[11px] font-bold text-gray-700 transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* SUMBER DANA / METODE PENERIMAAN */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Disimpan Ke Sumber Dana / Rekening <span className="text-emerald-600">*</span>
              </label>
              <select
                className="w-full rounded-2xl border border-emerald-200 bg-emerald-50/50 p-2.5 text-xs font-extrabold text-emerald-950 focus:border-emerald-500 focus:outline-none"
                value={sumberDana}
                onChange={(e) => setSumberDana(e.target.value)}
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
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Tanggal Pemasukan Kas
              </label>
              <input
                type="date"
                className="q-input font-bold text-gray-800"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                required
              />
            </div>

            {/* JUDUL / URAIAN */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Judul / Uraian Kas Masuk <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="q-input font-bold text-gray-900"
                placeholder="Contoh: Donasi Pembangunan Asrama Santri"
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                required
              />
            </div>

            {/* KATEGORI */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Kategori Pemasukan
              </label>
              <select
                className="q-input font-bold text-gray-800"
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

            {/* NOMINAL */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Nominal Kas Masuk (Rp) <span className="text-red-500">*</span>
                </label>
                {num(nominal) > 0 && (
                  <span className="text-xs font-extrabold text-emerald-600">
                    {formatMoney(num(nominal))}
                  </span>
                )}
              </div>
              <input
                type="text"
                className="q-input text-lg font-black text-emerald-600 tracking-wide"
                placeholder="0"
                value={nominal ? formatMoney(num(nominal)).replace('Rp ', '') : ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '');
                  setNominal(raw);
                }}
                required
              />

              {/* QUICK NOMINAL SHORTCUTS */}
              <div className="mt-1.5 flex flex-wrap gap-1">
                {[
                  { l: '+100rb', v: 100000 },
                  { l: '+500rb', v: 500000 },
                  { l: '+1jt', v: 1000000 },
                  { l: '+5jt', v: 5000000 },
                  { l: '+10jt', v: 10000000 },
                  { l: '+50jt', v: 50000000 },
                ].map((btn) => (
                  <button
                    key={btn.l}
                    type="button"
                    onClick={() => addNominal(btn.v)}
                    className="rounded-md bg-gray-100 hover:bg-emerald-100 hover:text-emerald-800 px-2 py-0.5 text-[11px] font-bold text-gray-700 transition-colors"
                  >
                    {btn.l}
                  </button>
                ))}
                {num(nominal) > 0 && (
                  <button
                    type="button"
                    onClick={() => setNominal('')}
                    className="rounded-md bg-rose-50 hover:bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700 transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* DITERIMA DARI */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Diterima Dari / Donatur / Instansi
              </label>
              <input
                type="text"
                className="q-input font-medium"
                placeholder="Contoh: H. Ahmad Fulan / Kemenag Gresik"
                value={diterimaDari}
                onChange={(e) => setDiterimaDari(e.target.value)}
              />
            </div>

            {/* KETERANGAN */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Catatan / Keterangan Tambahan
              </label>
              <textarea
                className="q-input min-h-16 text-xs font-medium"
                placeholder="Keterangan rincian kas masuk..."
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              {isSubmitting ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
              {isSubmitting ? 'Menyimpan Pemasukan Kas...' : 'Simpan Pemasukan Kas'}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: TABLE & FILTER TOOLS (8 / 12) */}
        <div className="lg:col-span-8 rounded-3xl bg-white p-5 shadow-sm border border-gray-100 space-y-4">
          {/* HEADER & ACTION BUTTONS */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-[#2D3436] flex items-center gap-2">
                <span>📋</span> Riwayat & Data Pemasukan Kas Lain
              </h3>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Menampilkan <strong className="text-emerald-700">{filteredRows.length}</strong> transaksi kas masuk
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
                        ? 'bg-emerald-600 text-white shadow-xs'
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
                className="w-full rounded-2xl border border-gray-200 bg-white py-2.5 pl-10 pr-9 text-xs font-semibold text-gray-800 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-2xs"
                placeholder="Cari judul pemasukan, no transaksi IN-..., nama donatur, petugas..."
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
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 px-2.5 text-xs font-bold text-gray-800 focus:border-emerald-500 focus:outline-none shadow-2xs"
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
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 px-2.5 text-xs font-bold text-gray-800 focus:border-emerald-500 focus:outline-none shadow-2xs"
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
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 px-2.5 text-xs font-bold text-gray-800 focus:border-emerald-500 focus:outline-none shadow-2xs"
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
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 px-2.5 text-xs font-bold text-gray-800 focus:border-emerald-500 focus:outline-none shadow-2xs"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
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
                    className="w-full rounded-xl border border-gray-200 bg-white py-2 px-3 text-xs font-bold text-gray-800 focus:border-emerald-500 focus:outline-none"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sampai Tanggal:</span>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-gray-200 bg-white py-2 px-3 text-xs font-bold text-gray-800 focus:border-emerald-500 focus:outline-none"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* TABLE OF INCOMES */}
          <div className="overflow-hidden rounded-2xl border border-gray-200">
            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full text-left text-xs text-gray-700">
                <thead className="sticky top-0 bg-[#F4F8F7] text-[11px] font-black uppercase text-emerald-800 border-b border-gray-200 shadow-2xs">
                  <tr>
                    <th className="py-3 px-3.5">Tanggal & No Trx</th>
                    <th className="py-3 px-3.5">Judul / Uraian</th>
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
                        <p className="text-sm font-bold">Tidak ada data pemasukan kas yang sesuai filter.</p>
                        <p className="text-xs text-gray-400 mt-1">Coba sesuaikan kata kunci pencarian atau tanggal.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const noTrx = str(row.no_transaksi, `IN-${String(row.id).padStart(4, '0')}`);
                      const tglStr = row.tanggal ? new Date(String(row.tanggal)).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
                      const petugasName = str((row.penginput as ApiRecord)?.name, 'Admin');

                      return (
                        <tr key={num(row.id)} className="hover:bg-emerald-50/40 transition-colors">
                          {/* TANGGAL & NO TRX */}
                          <td className="py-3 px-3.5 font-medium whitespace-nowrap">
                            <span className="font-bold text-gray-900 block">{tglStr}</span>
                            <span className="text-[10px] font-mono text-gray-400">{noTrx}</span>
                          </td>

                          {/* JUDUL & DONATUR */}
                          <td className="py-3 px-3.5">
                            <p className="font-extrabold text-gray-900">{str(row.judul)}</p>
                            {Boolean(row.diterima_dari) && (
                              <p className="text-[11px] text-emerald-800 font-medium">
                                Dari: <span className="text-gray-700">{str(row.diterima_dari)}</span>
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
                            <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                              {str(row.kategori, 'Umum')}
                            </span>
                          </td>

                          {/* NOMINAL */}
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <MoneyText value={num(row.jumlah)} className="font-black text-emerald-700 text-sm" />
                          </td>

                          {/* SUMBER DANA & PETUGAS */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="block text-[11px] font-bold text-gray-800 truncate max-w-[150px]" title={str(row.sumber_dana)}>
                              {str(row.sumber_dana, 'Kas Tunai Bendahara')}
                            </span>
                            <span className="block text-[10px] text-gray-400">Oleh: {petugasName}</span>
                          </td>

                          {/* AKSI */}
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* CETAK KWITANSI KAS MASUK */}
                              <button
                                type="button"
                                title="Cetak Kwitansi / Bukti Kas Masuk"
                                onClick={() => setReceiptRow(row)}
                                className="rounded-xl bg-amber-50 hover:bg-amber-100 p-2 text-amber-700 transition-colors shadow-2xs"
                              >
                                <Printer size={14} />
                              </button>

                              {/* EDIT */}
                              <button
                                type="button"
                                title="Edit Pemasukan Kas"
                                onClick={() => setEditingRow(row)}
                                className="rounded-xl bg-blue-50 hover:bg-blue-100 p-2 text-blue-700 transition-colors shadow-2xs"
                              >
                                <Edit size={14} />
                              </button>

                              {/* HAPUS */}
                              <button
                                type="button"
                                title="Hapus Pemasukan Kas"
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
                  TOTAL AKUMULASI PEMASUKAN KAS TERFILTER:
                </span>
                <span className="text-base font-black text-emerald-700">
                  {formatMoney(stats.totalFiltered)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. EDIT INCOME MODAL */}
      {editingRow && (
        <EditIncomeModal
          row={editingRow}
          onClose={() => setEditingRow(null)}
          onSaved={async () => {
            await onReload();
            setEditingRow(null);
            showToast('✅ Catatan pemasukan kas berhasil diperbarui!', 'success');
          }}
          existingCategories={existingCategories}
        />
      )}

      {/* 4. KWITANSI / BUKTI KAS MASUK MODAL */}
      {receiptRow && (
        <IncomeReceiptModal
          row={receiptRow}
          docSetting={docSetting}
          onClose={() => setReceiptRow(null)}
        />
      )}

      {/* 5. EXPORT REKAP EXCEL MODAL */}
      {isExportModalOpen && (
        <ExportPemasukanModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          existingCategories={existingCategories}
          academicPeriods={academicPeriods}
          availableCalendarYears={availableCalendarYears}
        />
      )}

      {/* 6. DELETE CONFIRMATION DIALOG */}
      {deleteConfirmRow && (
        <ModalForm
          title="Konfirmasi Hapus Pemasukan Kas"
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
              Apakah Anda yakin ingin menghapus catatan pemasukan kas berikut?
            </p>
            <div className="rounded-2xl bg-rose-50/60 border border-rose-200 p-3 space-y-1">
              <p className="text-xs font-bold text-gray-900">
                Judul: <span className="font-extrabold text-emerald-800">{str(deleteConfirmRow.judul)}</span>
              </p>
              <p className="text-xs text-gray-600">
                Nominal: <span className="font-black text-emerald-700">{formatMoney(num(deleteConfirmRow.jumlah))}</span>
              </p>
              <p className="text-xs text-gray-500">
                Tanggal: {deleteConfirmRow.tanggal ? new Date(String(deleteConfirmRow.tanggal)).toLocaleDateString('id-ID') : '-'}
              </p>
            </div>
            <p className="text-[11px] text-gray-500 font-medium">
              ⚠️ Tindakan ini akan menghapus data pemasukan kas secara permanen dari database.
            </p>
          </div>
        </ModalForm>
      )}
    </div>
  );
}

// ==========================================
// SUBCOMPONENT: EDIT INCOME MODAL
// ==========================================
function EditIncomeModal({
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
  const [kategori, setKategori] = useState(str(row.kategori, 'Infaq & Shodaqoh'));
  const [sumberDana, setSumberDana] = useState(str(row.sumber_dana, 'Kas Tunai Bendahara'));
  const [diterimaDari, setDiterimaDari] = useState(str(row.diterima_dari, ''));
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
        sumber_dana: sumberDana,
        diterima_dari: diterimaDari.trim() || null,
        keterangan: keterangan.trim() || null,
      };

      await api.updatePemasukanLain(num(row.id), payload);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data pemasukan kas gagal diperbarui');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalForm
      title="Edit Catatan Pemasukan Kas"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-2xl bg-gray-100 px-4 py-2.5 text-xs font-bold text-gray-700">
            Batal
          </button>
          <button
            type="submit"
            form="edit-pemasukan-form"
            disabled={saving}
            className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
            {saving ? 'Menyimpan...' : 'Perbarui Pemasukan'}
          </button>
        </div>
      }
    >
      <form id="edit-pemasukan-form" className="space-y-3.5" onSubmit={submit}>
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tanggal</label>
          <input type="date" className="q-input font-bold" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Judul / Uraian Kas Masuk</label>
          <input type="text" className="q-input font-bold" value={judul} onChange={(e) => setJudul(e.target.value)} required />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nominal (Rp)</label>
          <input
            type="text"
            className="q-input font-black text-emerald-600"
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
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Sumber Dana / Rekening</label>
            <select className="q-input font-bold" value={sumberDana} onChange={(e) => setSumberDana(e.target.value)}>
              {FUND_SOURCES.map((f) => (
                <option key={f.id} value={f.id}>{f.id}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Diterima Dari / Donatur</label>
          <input type="text" className="q-input font-medium" value={diterimaDari} onChange={(e) => setDiterimaDari(e.target.value)} />
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
// SUBCOMPONENT: OFFICIAL INCOME RECEIPT MODAL
// ==========================================
function IncomeReceiptModal({
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

  const noTrx = str(row.no_transaksi, `IN-${String(row.id).padStart(4, '0')}`);
  const tglFormatted = row.tanggal ? new Date(String(row.tanggal)).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
  const nominalValue = num(row.jumlah);
  const terbilangText = angkaTerbilang(nominalValue) + ' Rupiah';
  const petugasName = str((row.penginput as ApiRecord)?.name, 'Bendahara Keuangan');

  function handlePrint() {
    window.print();
  }

  return (
    <ModalForm
      title="Bukti Penerimaan Kas Masuk (Kwitansi Kas Masuk)"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-2xl bg-gray-100 px-4 py-2.5 text-xs font-bold text-gray-700">
            Tutup
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-700 shadow-sm"
          >
            <Printer size={15} /> Cetak Bukti Kas Masuk
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
            <h4 className="text-sm font-black uppercase text-emerald-800 tracking-wider">{instansiName}</h4>
            <p className="text-[10px] text-gray-500 font-medium">{instansiAlamat}</p>
            <div className="mt-2 inline-block rounded-md bg-emerald-800 px-3 py-0.5 text-[10px] font-black text-white uppercase tracking-widest">
              BUKTI PENERIMAAN KAS MASUK
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
              <span className="font-bold text-emerald-800">{str(row.kategori, 'Umum')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Sumber Dana / Rekening:</span>
              <span className="font-bold text-gray-900">{str(row.sumber_dana, 'Kas Tunai Bendahara')}</span>
            </div>
          </div>

          {/* DETAIL DATA */}
          <div className="py-3 border-b border-gray-200 text-xs space-y-2">
            <div>
              <span className="text-[11px] text-gray-500 block">Telah Diterima Dari:</span>
              <span className="text-xs font-bold text-gray-900 block">{str(row.diterima_dari, '-')}</span>
            </div>

            <div>
              <span className="text-[11px] text-gray-500 block">Guna Pembayaran / Uraian:</span>
              <span className="text-xs font-extrabold text-gray-900 block">{str(row.judul)}</span>
              {Boolean(row.keterangan) && <span className="text-[10px] text-gray-500 block italic">({str(row.keterangan)})</span>}
            </div>

            <div className="rounded-xl bg-gray-50 p-2.5 border border-gray-200 space-y-1 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-gray-700">Jumlah Uang:</span>
                <span className="text-base font-black text-emerald-700">{formatMoney(nominalValue)}</span>
              </div>
              <div className="text-[11px] font-bold text-gray-600 italic border-t border-gray-200 pt-1">
                Terbilang: #{terbilangText}#
              </div>
            </div>
          </div>

          {/* SIGNATURES */}
          <div className="pt-4 grid grid-cols-2 text-center text-[11px] font-medium text-gray-700">
            <div>
              <p className="text-gray-500">Yang Menyerahkan,</p>
              <div className="h-14" />
              <p className="font-bold text-gray-900 underline">
                ( {str(row.diterima_dari, '.......................')} )
              </p>
            </div>
            <div>
              <p className="text-gray-500">Bendahara / Penerima,</p>
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
function ExportPemasukanModal({
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
  const [sumberDana, setSumberDana] = useState('all');
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  async function handleDownload() {
    setIsExporting(true);
    try {
      await api.exportPemasukanLain({
        start_date: startDate || '',
        end_date: endDate || '',
        academic_year_id: academicYearId !== 'all' ? academicYearId : '',
        year: calendarYear !== 'all' ? calendarYear : '',
        kategori: kategori !== 'all' ? kategori : '',
        sumber_dana: sumberDana !== 'all' ? sumberDana : '',
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
      title="Export Rekap Pemasukan Kas (.xlsx)"
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
            <p className="font-extrabold">Format Excel 3-Sheet Multi-Laporan Resmi</p>
            <p className="text-[11px] text-emerald-700 mt-0.5">
              File Excel berisi: <strong>1. Rincian Kas Masuk</strong>, <strong>2. Rekap Per Kategori</strong>, dan <strong>3. Rekap Bulanan</strong> lengkap dengan rumus SUM dan persentase otomatis.
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
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Filter Sumber Dana / Rekening</label>
          <select className="q-input font-bold" value={sumberDana} onChange={(e) => setSumberDana(e.target.value)}>
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
