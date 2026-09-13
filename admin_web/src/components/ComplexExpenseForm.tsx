import {
  AlertCircle,
  ArrowDownLeft,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Coins,
  CreditCard,
  FileText,
  Landmark,
  Save,
  Sparkles,
  Tag,
  Trash2,
  TrendingDown,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, type ApiRecord } from '../services/api';

function str(value: unknown, fallback = ''): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
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
  'Konsumsi & Dapur',
  'Operasional & Utilitas',
  'Honor & Gaji Asatidz',
  'Sarana & Prasarana',
  'Kegiatan & Lomba Santri',
  'ATK & Percetakan',
  'Kesehatan & Kebersihan',
  'Perawatan Gedung',
  'Lain-lain',
];

const FUND_SOURCES = [
  { id: 'Kas Pembayaran Siswa (Pemasukan Transaksi)', label: '📥 Kas Pembayaran Siswa (Pemasukan Transaksi)', desc: 'Kas masuk dari pembayaran santri' },
  { id: 'Kas Tunai Bendahara', label: '💵 Kas Tunai Bendahara', desc: 'Uang tunai di kantor bendahara' },
  { id: 'Transfer Bank BSI (Rekening Siswa)', label: '🏛️ Transfer Bank BSI (Rekening Siswa)', desc: 'Rekening penerimaan BSI yayasan' },
  { id: 'Transfer Bank Mandiri', label: '🏛️ Transfer Bank Mandiri', desc: 'Rekening operasional Mandiri' },
  { id: 'Kas Operasional / Petty Cash', label: '🏢 Kas Operasional / Petty Cash', desc: 'Kas kecil operasional harian' },
  { id: 'Kas Yayasan / Bantuan', label: '🤝 Kas Yayasan / Bantuan', desc: 'Bantuan/subsidi yayasan' },
];

export interface ComplexExpenseFormProps {
  row: ApiRecord | null;
  existingCategories?: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function ComplexExpenseForm({
  row,
  existingCategories = DEFAULT_CATEGORIES,
  onClose,
  onSaved,
}: ComplexExpenseFormProps) {
  const isEdit = Boolean(row?.id);
  const todayStr = new Date().toISOString().split('T')[0];

  const [posPengeluaran, setPosPengeluaran] = useState<'pondok' | 'madin'>(() => {
    const raw = str(row?.pos_pengeluaran, 'pondok').toLowerCase();
    return raw === 'madin' ? 'madin' : 'pondok';
  });
  const [tanggal, setTanggal] = useState(() => {
    if (row?.tanggal) {
      return String(row.tanggal).split('T')[0];
    }
    return todayStr;
  });
  const [judul, setJudul] = useState(str(row?.judul, ''));
  const [jumlah, setJumlah] = useState(() => (row?.jumlah ? String(row.jumlah) : ''));
  const [kategori, setKategori] = useState(str(row?.kategori, 'Konsumsi & Dapur'));
  const [customKategori, setCustomKategori] = useState('');
  const [metodePembayaran, setMetodePembayaran] = useState(
    str(row?.metode_pembayaran, 'Kas Pembayaran Siswa (Pemasukan Transaksi)')
  );
  const [dibayarkanKepada, setDibayarkanKepada] = useState(str(row?.dibayarkan_kepada, ''));
  const [keterangan, setKeterangan] = useState(str(row?.keterangan, ''));

  const [saving, setSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  // Gabungkan kategori default dengan kategori dari database
  const categoryList = useMemo(() => {
    const set = new Set<string>([...DEFAULT_CATEGORIES, ...existingCategories]);
    return Array.from(set);
  }, [existingCategories]);

  const nominalValue = num(jumlah);
  const terbilangText = nominalValue > 0 ? `${angkaTerbilang(nominalValue)} Rupiah` : '-';

  const submit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (saving) return;

    if (!judul.trim()) {
      setError('Judul / Keperluan pengeluaran kas wajib diisi.');
      return;
    }
    if (nominalValue <= 0) {
      setError('Nominal pengeluaran harus lebih besar dari Rp 0.');
      return;
    }
    if (!tanggal) {
      setError('Tanggal pengeluaran wajib dipilih.');
      return;
    }

    const finalKategori = kategori === 'Lain-lain' && customKategori.trim() ? customKategori.trim() : kategori;

    setSaving(true);
    setError('');

    try {
      const payload: ApiRecord = {
        judul: judul.trim(),
        jumlah: nominalValue,
        tanggal,
        pos_pengeluaran: posPengeluaran,
        kategori: finalKategori,
        metode_pembayaran: metodePembayaran,
        dibayarkan_kepada: dibayarkanKepada.trim() || null,
        keterangan: keterangan.trim() || null,
      };

      if (isEdit && row?.id) {
        await api.updatePengeluaran(num(row.id), payload);
      } else {
        await api.createPengeluaran(payload);
      }

      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'pengeluaran' } }));
      setIsSuccess(true);
      setTimeout(async () => {
        setIsSuccess(false);
        await onSaved();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Catatan pengeluaran gagal disimpan');
      setSaving(false);
    }
  };

  return (
    <div className="w-full flex-1 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {isSuccess && (
        <div className="fixed top-5 right-5 z-[99999] flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-2xl border border-emerald-200 shadow-emerald-900/15 transition-all animate-in fade-in slide-in-from-top-4 duration-300 max-w-sm">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
            <CheckCircle2 size={24} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-800">Berhasil Disimpan!</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Catatan pengeluaran &quot;{judul}&quot; berhasil disimpan ke buku kas pesantren.
            </p>
          </div>
        </div>
      )}

      {/* FRAME IN-PAGE FORM KONSISTEN DENGAN MASTER DATA */}
      <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
        {/* Header Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="mr-1 grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              title="Kembali ke Tabel Pengeluaran"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-md shadow-rose-500/20">
              <TrendingDown size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-[#2D3436]">
                  {isEdit ? 'Edit Catatan Kas Keluar' : 'Catat Pengeluaran Kas Baru'}
                </h2>
                <span className="rounded-full bg-rose-100 text-rose-800 text-[10px] font-black px-2.5 py-0.5 border border-rose-200 uppercase">
                  Buku Kas Operasional
                </span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-[#636E72]">
                Formulir pencatatan pengeluaran operasional asrama pondok dan madrasah diniyah
              </p>
            </div>
          </div>

          <button
            className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
            onClick={onClose}
            type="button"
            title="Tutup form"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs sm:text-sm font-bold text-rose-700 flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Kolom Kiri: Form Fields */}
            <div className="lg:col-span-7 space-y-5">
              {/* Pos Anggaran Pengeluaran (Pondok vs Madin) */}
              <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 space-y-3">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                  I. Pos Anggaran Pengeluaran <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPosPengeluaran('pondok')}
                    className={`flex items-start gap-3 rounded-2xl p-4 text-left border-2 transition-all cursor-pointer ${
                      posPengeluaran === 'pondok'
                        ? 'border-emerald-500 bg-emerald-50/80 shadow-xs ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-black ${
                        posPengeluaran === 'pondok' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      🕌
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900">Pondok Pesantren</span>
                        {posPengeluaran === 'pondok' && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                            ✓ Terpilih
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-slate-500 mt-1 leading-snug">
                        Dapur & beras santri, listrik PLN, perawatan gedung asrama, kesehatan
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPosPengeluaran('madin')}
                    className={`flex items-start gap-3 rounded-2xl p-4 text-left border-2 transition-all cursor-pointer ${
                      posPengeluaran === 'madin'
                        ? 'border-indigo-500 bg-indigo-50/80 shadow-xs ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-black ${
                        posPengeluaran === 'madin' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      📖
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900">Madrasah Diniyah (Madin)</span>
                        {posPengeluaran === 'madin' && (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-black text-indigo-800">
                            ✓ Terpilih
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-slate-500 mt-1 leading-snug">
                        Pengadaan kitab kuning, lembar ujian semester madin, honor guru madin, ATK
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Rincian Kas Keluar */}
              <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-3">
                  <Coins size={18} className="text-[#138F81]" />
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    II. Rincian Nominal & Keperluan
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tanggal */}
                  <div>
                    <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Tanggal Kas Keluar <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10"
                        value={tanggal}
                        onChange={(e) => setTanggal(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Sumber Dana */}
                  <div>
                    <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Sumber Dana Kas <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs sm:text-sm font-bold text-slate-800 focus:border-[#138F81] focus:outline-hidden truncate"
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
                </div>

                {/* Judul / Keperluan */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Judul / Keperluan Pengeluaran <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10"
                    placeholder="Contoh: Belanja Beras & Dapur Santri, Token Listrik Gedung Asrama..."
                    value={judul}
                    onChange={(e) => setJudul(e.target.value)}
                    required
                  />
                </div>

                {/* Nominal */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Nominal Kas Keluar (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-rose-500">
                      Rp
                    </span>
                    <input
                      type="text"
                      className="w-full rounded-2xl border border-rose-200 bg-rose-50/30 pl-11 pr-4 py-3 text-base sm:text-lg font-black text-rose-700 placeholder:text-rose-300 focus:border-rose-500 focus:outline-hidden focus:ring-4 focus:ring-rose-500/10"
                      placeholder="0"
                      value={jumlah ? Number(jumlah).toLocaleString('id-ID') : ''}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        setJumlah(raw);
                      }}
                      required
                    />
                  </div>
                  {nominalValue > 0 && (
                    <p className="mt-1 text-xs font-bold text-rose-600 italic">
                      Terbilang: #{terbilangText}#
                    </p>
                  )}
                </div>

                {/* Kategori */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Kategori Pos Pengeluaran <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs sm:text-sm font-bold text-slate-800 focus:border-[#138F81] focus:outline-hidden"
                      value={kategori}
                      onChange={(e) => setKategori(e.target.value)}
                    >
                      {categoryList.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Dibayarkan Kepada / Penerima
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden"
                      placeholder="Contoh: Toko Sembako Barokah, PLN..."
                      value={dibayarkanKepada}
                      onChange={(e) => setDibayarkanKepada(e.target.value)}
                    />
                  </div>
                </div>

                {kategori === 'Lain-lain' && (
                  <div>
                    <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Sebutkan Kategori Khusus
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#138F81] focus:outline-hidden"
                      placeholder="Ketik kategori pengeluaran..."
                      value={customKategori}
                      onChange={(e) => setCustomKategori(e.target.value)}
                    />
                  </div>
                )}

                {/* Catatan / Keterangan */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Catatan / Rincian Belanja (Opsional)
                  </label>
                  <textarea
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10"
                    placeholder="Contoh: Pembelian beras rojo lele 5 sak untuk asrama putra..."
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Kolom Kanan: Live Preview Kwitansi Kas Keluar */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-3xl border border-rose-100 bg-linear-to-b from-rose-50/50 via-white to-white p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-rose-100 pb-3">
                  <Sparkles size={18} className="text-rose-500" />
                  <h3 className="text-xs font-black text-rose-700 uppercase tracking-wider">
                    Pratinjau Bukti Kas Keluar
                  </h3>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-dashed border-slate-200">
                    <span
                      className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase ${
                        posPengeluaran === 'madin' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {posPengeluaran === 'madin' ? '📖 Pos Madin' : '🕌 Pos Pondok'}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      📅 {tanggal || 'Hari Ini'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Untuk Keperluan:</span>
                    <p className="text-base font-black text-slate-900 mt-0.5 leading-snug">
                      {judul || 'Judul / Keperluan Pengeluaran'}
                    </p>
                    {kategori && (
                      <span className="mt-1.5 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                        🏷️ {kategori}
                      </span>
                    )}
                  </div>

                  <div className="rounded-2xl bg-rose-50 p-4 border border-rose-200/80 space-y-1">
                    <span className="text-[11px] font-black text-rose-600 uppercase tracking-wider">
                      Nominal Kas Keluar:
                    </span>
                    <p className="text-2xl font-black text-rose-700">
                      {nominalValue > 0 ? formatRupiah(nominalValue) : 'Rp 0'}
                    </p>
                    {nominalValue > 0 && (
                      <p className="text-[10px] font-bold text-rose-800 italic pt-1 border-t border-rose-200/60">
                        Terbilang: #{terbilangText}#
                      </p>
                    )}
                  </div>

                  <div className="text-xs font-semibold text-slate-600 space-y-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Dibayarkan Kepada:</span>
                      <span className="font-bold text-slate-800">{dibayarkanKepada || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Sumber Dana:</span>
                      <span className="font-bold text-teal-900 truncate max-w-[200px]" title={metodePembayaran}>
                        {metodePembayaran}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-200 text-xs font-semibold text-slate-600 leading-relaxed">
                  💡 <b>Audit Keuangan:</b> Setiap pengeluaran kas otomatis tercatat pada buku besar, memperbarui saldo kas bersih secara realtime, dan dapat dicetak kwitansinya.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Footer Action Bar */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-6 py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-rose-600/25 hover:bg-rose-700 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Save size={16} />
            <span>{saving ? 'Menyimpan...' : isEdit ? 'Perbarui Pengeluaran' : 'Simpan Kas Keluar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
