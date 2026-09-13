import {
  AlertCircle,
  ArrowDownLeft,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Coins,
  CreditCard,
  FileText,
  HandCoins,
  Landmark,
  Save,
  Sparkles,
  Tag,
  TrendingUp,
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
  'Infaq & Shodaqoh',
  'Donasi Pembangunan',
  'Bantuan Yayasan',
  'Dana BOS / Hibah',
  'Unit Usaha / Koperasi',
  'Sumbangan Alumni',
  'Sumbangan Wali Santri',
  'Kas Awal Bendahara',
  'Lain-lain',
];

const FUND_SOURCES = [
  { id: 'Kas Tunai Bendahara', label: '💵 Kas Tunai Bendahara', desc: 'Diterima tunai di kantor bendahara' },
  { id: 'Transfer Bank BSI', label: '🏛️ Transfer Bank BSI', desc: 'Rekening penerimaan BSI' },
  { id: 'Transfer Bank Mandiri', label: '🏛️ Transfer Bank Mandiri', desc: 'Rekening penerimaan Mandiri' },
  { id: 'Transfer Bank BRI / Lainnya', label: '🏛️ Transfer Bank BRI / Lainnya', desc: 'Rekening Bank Lain' },
  { id: 'Kas Yayasan / Bantuan', label: '🤝 Kas Yayasan / Bantuan', desc: 'Subsidi/bantuan yayasan' },
];

export interface ComplexIncomeFormProps {
  row: ApiRecord | null;
  existingCategories?: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function ComplexIncomeForm({
  row,
  existingCategories = DEFAULT_CATEGORIES,
  onClose,
  onSaved,
}: ComplexIncomeFormProps) {
  const isEdit = Boolean(row?.id);
  const todayStr = new Date().toISOString().split('T')[0];

  const [tanggal, setTanggal] = useState(() => {
    if (row?.tanggal) {
      return String(row.tanggal).split('T')[0];
    }
    return todayStr;
  });
  const [judul, setJudul] = useState(str(row?.judul, ''));
  const [jumlah, setJumlah] = useState(() => (row?.jumlah ? String(row.jumlah) : ''));
  const [kategori, setKategori] = useState(str(row?.kategori, 'Infaq & Shodaqoh'));
  const [customKategori, setCustomKategori] = useState('');
  const [sumberDana, setSumberDana] = useState(str(row?.sumber_dana, 'Kas Tunai Bendahara'));
  const [diterimaDari, setDiterimaDari] = useState(str(row?.diterima_dari, ''));
  const [keterangan, setKeterangan] = useState(str(row?.keterangan, ''));

  const [saving, setSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

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
      setError('Judul / Uraian kas masuk wajib diisi.');
      return;
    }
    if (nominalValue <= 0) {
      setError('Nominal kas masuk harus lebih besar dari Rp 0.');
      return;
    }
    if (!tanggal) {
      setError('Tanggal penerimaan kas wajib dipilih.');
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
        kategori: finalKategori,
        sumber_dana: sumberDana,
        diterima_dari: diterimaDari.trim() || null,
        keterangan: keterangan.trim() || null,
      };

      if (isEdit && row?.id) {
        await api.updatePemasukanLain(num(row.id), payload);
      } else {
        await api.createPemasukanLain(payload);
      }

      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'pemasukan_lain' } }));
      setIsSuccess(true);
      setTimeout(async () => {
        setIsSuccess(false);
        await onSaved();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Catatan penerimaan kas gagal disimpan');
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
              Penerimaan kas &quot;{judul}&quot; berhasil dicatat ke buku kas masuk pesantren.
            </p>
          </div>
        </div>
      )}

      {/* FRAME IN-PAGE FORM KONSISTEN */}
      <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
        {/* Header Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="mr-1 grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              title="Kembali ke Tabel Kas Masuk"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
              <HandCoins size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-[#2D3436]">
                  {isEdit ? 'Edit Catatan Pemasukan Kas Lain' : 'Catat Kas Masuk & Donasi Baru'}
                </h2>
                <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 border border-emerald-200 uppercase">
                  Penerimaan Non-Santri
                </span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-[#636E72]">
                Pencatatan kas masuk infaq, donasi alumni/donatur, dana BOS, dan bantuan yayasan
              </p>
            </div>
          </div>

          <button
            className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"
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
            {/* Kolom Kiri: Form Inputs */}
            <div className="lg:col-span-7 space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-3">
                  <Coins size={18} className="text-[#138F81]" />
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    I. Data Kas Masuk
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tanggal */}
                  <div>
                    <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Tanggal Penerimaan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10"
                      value={tanggal}
                      onChange={(e) => setTanggal(e.target.value)}
                      required
                    />
                  </div>

                  {/* Sumber Dana / Rekening */}
                  <div>
                    <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Rekening Penampung <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs sm:text-sm font-bold text-slate-800 focus:border-[#138F81] focus:outline-hidden truncate"
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
                </div>

                {/* Judul Kas Masuk */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Judul / Uraian Kas Masuk <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10"
                    placeholder="Contoh: Infaq Jum'at Berkah, Sumbangan Pembangunan Asrama Santri..."
                    value={judul}
                    onChange={(e) => setJudul(e.target.value)}
                    required
                  />
                </div>

                {/* Nominal */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Nominal Kas Masuk (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-emerald-600">
                      Rp
                    </span>
                    <input
                      type="text"
                      className="w-full rounded-2xl border border-emerald-200 bg-emerald-50/30 pl-11 pr-4 py-3 text-base sm:text-lg font-black text-emerald-700 placeholder:text-emerald-300 focus:border-emerald-500 focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10"
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
                    <p className="mt-1 text-xs font-bold text-emerald-700 italic">
                      Terbilang: #{terbilangText}#
                    </p>
                  )}
                </div>

                {/* Kategori & Donatur */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Kategori Pemasukan <span className="text-rose-500">*</span>
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
                      Diterima Dari / Donatur
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden"
                      placeholder="Contoh: H. Abdullah (Alumni 2010), Hamba Allah..."
                      value={diterimaDari}
                      onChange={(e) => setDiterimaDari(e.target.value)}
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
                      placeholder="Ketik kategori pemasukan..."
                      value={customKategori}
                      onChange={(e) => setCustomKategori(e.target.value)}
                    />
                  </div>
                )}

                {/* Catatan / Keterangan */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Catatan Tambahan (Opsional)
                  </label>
                  <textarea
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10"
                    placeholder="Contoh: Donasi dititipkan melalui ustadz pembina saat ziarah makam..."
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Kolom Kanan: Pratinjau Kwitansi Kas Masuk */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-3xl border border-emerald-100 bg-linear-to-b from-emerald-50/50 via-white to-white p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-emerald-100 pb-3">
                  <Sparkles size={18} className="text-emerald-600" />
                  <h3 className="text-xs font-black text-emerald-800 uppercase tracking-wider">
                    Pratinjau Tanda Terima Kas Masuk
                  </h3>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-dashed border-slate-200">
                    <span className="rounded-lg bg-emerald-100 text-emerald-800 px-2.5 py-1 text-[10px] font-black uppercase">
                      📥 Penerimaan Kas
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      📅 {tanggal || 'Hari Ini'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Uraian Kas Masuk:</span>
                    <p className="text-base font-black text-slate-900 mt-0.5 leading-snug">
                      {judul || 'Judul / Uraian Kas Masuk'}
                    </p>
                    {kategori && (
                      <span className="mt-1.5 inline-block rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold">
                        🏷️ {kategori}
                      </span>
                    )}
                  </div>

                  <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-200/80 space-y-1">
                    <span className="text-[11px] font-black text-emerald-700 uppercase tracking-wider">
                      Nominal Kas Diterima:
                    </span>
                    <p className="text-2xl font-black text-emerald-700">
                      {nominalValue > 0 ? formatRupiah(nominalValue) : 'Rp 0'}
                    </p>
                    {nominalValue > 0 && (
                      <p className="text-[10px] font-bold text-emerald-800 italic pt-1 border-t border-emerald-200/60">
                        Terbilang: #{terbilangText}#
                      </p>
                    )}
                  </div>

                  <div className="text-xs font-semibold text-slate-600 space-y-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Diterima Dari:</span>
                      <span className="font-bold text-slate-800">{diterimaDari || 'Hamba Allah'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Tersimpan Pada:</span>
                      <span className="font-bold text-teal-900 truncate max-w-[200px]" title={sumberDana}>
                        {sumberDana}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-teal-50/80 p-3.5 border border-teal-100 text-xs font-semibold text-teal-900 leading-relaxed">
                  🧾 <b>Kwitansi Donatur:</b> Bukti tanda terima kas masuk ini dapat dicetak langsung untuk diserahkan kepada donatur/pihak pemberi.
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
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Save size={16} />
            <span>{saving ? 'Menyimpan...' : isEdit ? 'Perbarui Kas Masuk' : 'Simpan Kas Masuk'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
