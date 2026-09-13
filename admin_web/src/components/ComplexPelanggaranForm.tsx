import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Coins,
  FileText,
  Gavel,
  Image as ImageIcon,
  Save,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  User,
  Users,
  X
} from 'lucide-react';
import React, { FormEvent, useMemo, useState } from 'react';
import { api, type ApiRecord } from '../services/api';
import { getTodayDateString } from '../utils/formatters';

interface PelanggaranFormProps {
  initialData?: ApiRecord | null;
  students: ApiRecord[];
  categories: ApiRecord[];
  onClose: () => void;
  onSave: () => void;
}

function text(value: unknown, fallback = ''): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function ComplexPelanggaranForm({
  initialData,
  students,
  categories,
  onClose,
  onSave
}: PelanggaranFormProps) {
  const isEditing = Boolean(initialData && initialData.id);

  // Form State
  const [siswaId, setSiswaId] = useState<number | ''>(() => {
    return initialData ? num(initialData.siswa_id || (initialData.siswa as ApiRecord)?.id) : '';
  });
  const [siswaSearch, setSiswaSearch] = useState<string>(() => {
    if (!initialData) return '';
    const s = initialData.siswa as ApiRecord | undefined;
    return text(s?.nama || initialData.siswa_nama || initialData.nama_siswa);
  });
  const [tanggal, setTanggal] = useState<string>(() => {
    return initialData?.tanggal ? String(initialData.tanggal).substring(0, 10) : getTodayDateString();
  });
  const [waktu, setWaktu] = useState<string>(() => text(initialData?.waktu));
  const [kategoriId, setKategoriId] = useState<number | ''>(() => {
    return initialData?.kategori_id ? num(initialData.kategori_id) : '';
  });
  const [judul, setJudul] = useState<string>(() => text(initialData?.judul_pelanggaran));
  const [tingkat, setTingkat] = useState<'Ringan' | 'Sedang' | 'Berat'>(() => {
    const t = text(initialData?.tingkat, 'Ringan');
    if (t === 'Sedang' || t === 'Berat') return t;
    return 'Ringan';
  });
  const [poin, setPoin] = useState<number>(() => num(initialData?.poin, 10));
  const [denda, setDenda] = useState<number>(() => num(initialData?.denda, 0));
  const [statusDenda, setStatusDenda] = useState<'tidak_ada' | 'belum_dibayar' | 'lunas'>(() => {
    return (text(initialData?.status_denda, 'tidak_ada') as any) || 'tidak_ada';
  });
  const [takzir, setTakzir] = useState<string>(() => text(initialData?.tindakan_takzir));
  const [keterangan, setKeterangan] = useState<string>(() => text(initialData?.keterangan));

  // Photo state
  const [buktiFile, setBuktiFile] = useState<File | null>(null);
  const [buktiPreview, setBuktiPreview] = useState<string | null>(() => {
    return text(initialData?.bukti_foto_url || initialData?.bukti_foto) || null;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  // Filter siswa untuk autocomplete/select
  const filteredStudents = useMemo(() => {
    if (!siswaSearch.trim()) return students.slice(0, 50);
    const q = siswaSearch.toLowerCase();
    return students
      .filter((s) => {
        const nama = text(s.nama).toLowerCase();
        const nis = text(s.nis).toLowerCase();
        const kelas = text(s.kelas).toLowerCase();
        const kamar = text(s.kamar).toLowerCase();
        const komplek = text(s.komplek).toLowerCase();
        return nama.includes(q) || nis.includes(q) || kelas.includes(q) || kamar.includes(q) || komplek.includes(q);
      })
      .slice(0, 50);
  }, [students, siswaSearch]);

  const selectedStudent = useMemo(() => {
    if (!siswaId) return null;
    return students.find((s) => num(s.id) === num(siswaId)) || (initialData?.siswa as ApiRecord | undefined);
  }, [students, siswaId, initialData]);

  // Handler auto-fill ketika kategori dipilih
  const handleCategorySelect = (catId: number | '') => {
    setKategoriId(catId);
    if (!catId) return;
    const cat = categories.find((c) => num(c.id) === num(catId));
    if (cat) {
      setJudul(text(cat.nama_pelanggaran));
      const t = text(cat.tingkat);
      if (t === 'Ringan' || t === 'Sedang' || t === 'Berat') setTingkat(t);
      setPoin(num(cat.poin_default, 10));
      const defDenda = num(cat.denda_default, 0);
      setDenda(defDenda);
      setStatusDenda(defDenda > 0 ? 'belum_dibayar' : 'tidak_ada');
      setTakzir(text(cat.tindakan_rekomendasi));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBuktiFile(file);
      setBuktiPreview(URL.createObjectURL(file));
    }
  };

  const handleRemovePhoto = () => {
    setBuktiFile(null);
    setBuktiPreview(null);
  };

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;

    if (!siswaId) {
      setError('Silakan tentukan santri yang melanggar terlebih dahulu.');
      return;
    }
    if (!judul.trim()) {
      setError('Uraian / nama pelanggaran wajib diisi.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      if (isEditing && initialData?.id) {
        await api.updatePelanggaran(num(initialData.id), {
          tanggal,
          waktu: waktu || null,
          kategori_id: kategoriId || null,
          judul_pelanggaran: judul.trim(),
          tingkat,
          poin: Number(poin),
          denda: Number(denda),
          status_denda: statusDenda,
          tindakan_takzir: takzir.trim() || null,
          keterangan: keterangan.trim() || null
        });
      } else {
        const payload: any = {
          siswa_id: Number(siswaId),
          tanggal,
          waktu: waktu || undefined,
          kategori_id: kategoriId ? Number(kategoriId) : undefined,
          judul_pelanggaran: judul.trim(),
          tingkat,
          poin: Number(poin),
          denda: Number(denda),
          status_denda: statusDenda,
          tindakan_takzir: takzir.trim() || undefined,
          keterangan: keterangan.trim() || undefined,
          bukti_foto: buktiFile || undefined
        };
        await api.createPelanggaran(payload);
      }

      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'pelanggaran' } }));
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSave();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan catatan pelanggaran.');
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full flex-1 animate-in fade-in duration-200">
      {/* Toast Notifikasi Berhasil */}
      {isSuccess && (
        <div className="fixed top-5 right-5 z-[99999] flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-2xl border border-emerald-200 shadow-emerald-900/15 animate-in fade-in slide-in-from-top-4 duration-300 max-w-sm">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
            <CheckCircle2 size={24} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-800">Pelanggaran Berhasil Disimpan!</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Data kedisiplinan dan notifikasi santri telah diperbarui secara realtime.
            </p>
          </div>
        </div>
      )}

      {/* Frame Kontainer In-Page Form (Konsisten Gaya Master Data) */}
      <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
        {/* Header Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer shrink-0"
                title="Kembali ke Tabel Pelanggaran"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl bg-rose-50 border border-rose-200/60 text-rose-600 shadow-sm shrink-0">
                <ShieldAlert size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/60">
                    Kedisiplinan Santri
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">•</span>
                  <span className="text-xs font-bold text-slate-500">Pondok Pesantren Qomaruddin</span>
                </div>
                <h1 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
                  {isEditing ? '✏️ Edit Catatan Pelanggaran Santri' : '🚨 Formulir Catat Pelanggaran Santri'}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button
              className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors shrink-0 cursor-pointer"
              onClick={onClose}
              type="button"
              disabled={isSaving}
              aria-label="Tutup Form"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Form Body Konten (Lega, Bersih, Card-Based) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50/50 q-scrollbar">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
            {/* Alert Pesan Error */}
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 animate-in fade-in">
                <div className="flex items-center gap-2 font-black text-sm">
                  <AlertTriangle size={18} />
                  <span>Periksa Kembali Isian Formulir</span>
                </div>
                <p className="text-xs font-semibold mt-1 text-rose-700">{error}</p>
              </div>
            )}

            {/* CARD 1: IDENTITAS SANTRI & WAKTU KEJADIAN */}
            <div className="rounded-3xl bg-white p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-[#138F81]">
                  <User size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800">1. Identitas Santri & Waktu Kejadian</h3>
                  <p className="text-xs text-slate-400 font-medium">Pilih santri yang melanggar serta waktu kejadian perkara.</p>
                </div>
              </div>

              {/* Pemilihan Santri */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Santri yang Melanggar <span className="text-rose-500">*</span>
                </label>
                {!isEditing ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                      <input
                        type="text"
                        placeholder="🔍 Filter santri: ketik nama, NIS, kelas madin, atau kamar asrama..."
                        value={siswaSearch}
                        onChange={(e) => setSiswaSearch(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:border-[#138F81] focus:bg-white transition"
                      />
                    </div>

                    <select
                      value={siswaId}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : '';
                        setSiswaId(val);
                      }}
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs sm:text-sm font-extrabold text-slate-800 outline-none focus:border-[#138F81] shadow-xs cursor-pointer"
                    >
                      <option value="">-- Pilih Dari Daftar Santri ({filteredStudents.length} Santri Ditampilkan) --</option>
                      {filteredStudents.map((s) => (
                        <option key={num(s.id)} value={num(s.id)}>
                          {text(s.nama)} ({text(s.nis, '-')}) - Kelas {text(s.kelas, '-')} [{text(s.komplek, 'Pondok')} - Kamar {text(s.kamar, '-')}]
                        </option>
                      ))}
                    </select>

                    {/* Preview Card Santri Terpilih */}
                    {selectedStudent && (
                      <div className="flex items-center gap-3 rounded-2xl bg-teal-50/70 border border-teal-200/80 p-3.5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#138F81] text-white font-black text-sm">
                          {text(selectedStudent.nama, 'S').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-slate-900 truncate">{text(selectedStudent.nama)}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs font-semibold text-slate-600">
                            <span>NIS: <b className="font-mono text-slate-800">{text(selectedStudent.nis, '-')}</b></span>
                            <span>•</span>
                            <span>Kelas: <b className="text-[#138F81]">{text(selectedStudent.kelas, '-')}</b></span>
                            <span>•</span>
                            <span>Asrama: <b>{text(selectedStudent.komplek, 'Pondok')} / Kamar {text(selectedStudent.kamar, '-')}</b></span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl bg-slate-100 border border-slate-200 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white font-black text-sm">
                      {text(selectedStudent?.nama, 'S').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">{text(selectedStudent?.nama || siswaSearch)}</p>
                      <p className="text-xs font-semibold text-slate-500">
                        NIS: {text(selectedStudent?.nis, '-')} • Kelas {text(selectedStudent?.kelas, '-')} • Kamar {text(selectedStudent?.kamar, '-')}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Tanggal & Waktu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Tanggal Kejadian <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-[#138F81] focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Jam / Waktu Kejadian (Opsional)
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Contoh: 14:30 WIB atau Malam Hari"
                      value={waktu}
                      onChange={(e) => setWaktu(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-[#138F81] focus:bg-white transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: KLASIFIKASI & RINCIAN PELANGGARAN */}
            <div className="rounded-3xl bg-white p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Gavel size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800">2. Klasifikasi & Poin Pelanggaran</h3>
                  <p className="text-xs text-slate-400 font-medium">Pilih preset kategori standar pondok atau atur uraian secara kustom.</p>
                </div>
              </div>

              {/* Preset Kategori */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Pilih Master Kategori Pelanggaran (Auto-Fill Poin & Sanksi)
                </label>
                <select
                  value={kategoriId}
                  onChange={(e) => handleCategorySelect(e.target.value ? Number(e.target.value) : '')}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-[#138F81] shadow-xs cursor-pointer"
                >
                  <option value="">-- Ketik Uraian Bebas / Pilih Master Kategori --</option>
                  {categories.map((c) => (
                    <option key={num(c.id)} value={num(c.id)}>
                      [{text(c.tingkat)}] {text(c.nama_pelanggaran)} (+{num(c.poin_default)} Poin{num(c.denda_default) > 0 ? ` • Denda Rp ${num(c.denda_default).toLocaleString('id-ID')}` : ''})
                    </option>
                  ))}
                </select>
              </div>

              {/* Judul / Uraian Pelanggaran */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Nama / Uraian Pelanggaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={judul}
                  onChange={(e) => setJudul(e.target.value)}
                  placeholder="Contoh: Terlambat Mengikuti Sholat Berjamaah Subuh di Masjid"
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-[#138F81] focus:bg-white transition"
                />
              </div>

              {/* Tingkat, Poin, dan Denda */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Tingkat */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Tingkat Pelanggaran
                  </label>
                  <select
                    value={tingkat}
                    onChange={(e) => setTingkat(e.target.value as any)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-extrabold text-slate-800 outline-none focus:border-[#138F81] cursor-pointer"
                  >
                    <option value="Ringan">🟡 Ringan (Peringatan & Takzir)</option>
                    <option value="Sedang">🟠 Sedang (Takzir Khusus)</option>
                    <option value="Berat">🔴 Berat (Panggilan Orang Tua)</option>
                  </select>
                </div>

                {/* Poin Pelanggaran */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Poin Pelanggaran <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={poin}
                    onChange={(e) => setPoin(Number(e.target.value))}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs sm:text-sm font-black text-rose-600 outline-none focus:border-[#138F81] focus:bg-white transition"
                  />
                  <p className="text-[11px] font-semibold text-slate-400 mt-1">Akumulasi poin masuk ke buku rekap santri.</p>
                </div>

                {/* Denda (Rp) */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Denda Administratif (Rp)
                  </label>
                  <div className="relative">
                    <Coins className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="number"
                      min="0"
                      step="5000"
                      value={denda}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setDenda(val);
                        if (val > 0 && statusDenda === 'tidak_ada') {
                          setStatusDenda('belum_dibayar');
                        } else if (val === 0) {
                          setStatusDenda('tidak_ada');
                        }
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2.5 text-xs sm:text-sm font-extrabold text-slate-800 outline-none focus:border-[#138F81] focus:bg-white transition"
                    />
                  </div>
                  {denda > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500">Status Denda:</span>
                      <select
                        value={statusDenda}
                        onChange={(e) => setStatusDenda(e.target.value as any)}
                        className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700"
                      >
                        <option value="belum_dibayar">Belum Dibayar</option>
                        <option value="lunas">Sudah Lunas</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CARD 3: TINDAKAN TAKZIR & BUKTI FOTO */}
            <div className="rounded-3xl bg-white p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800">3. Tindakan Takzir & Bukti Kejadian</h3>
                  <p className="text-xs text-slate-400 font-medium">Sanksi edukatif yang diberikan serta dokumentasi pendukung.</p>
                </div>
              </div>

              {/* Tindakan Takzir */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Tindakan / Takzir Edukatif yang Diberikan
                </label>
                <input
                  type="text"
                  value={takzir}
                  onChange={(e) => setTakzir(e.target.value)}
                  placeholder="Contoh: Membaca Al-Qur'an Surat Yasin 3x di depan masjid & piket lingkungan asrama"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:border-[#138F81] focus:bg-white transition"
                />
              </div>

              {/* Keterangan / Kronologi */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Catatan Kronologi / Keterangan Tambahan (Opsional)
                </label>
                <textarea
                  rows={3}
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Catat keterangan saat razia, pelaporan saksi, atau riwayat pembinaan santri..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:border-[#138F81] focus:bg-white transition"
                />
              </div>

              {/* Upload Foto Bukti */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Foto Bukti Kejadian / Barang Bukti (Opsional)
                </label>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer border border-slate-200 shadow-2xs">
                    <Camera size={18} className="text-[#138F81]" />
                    <span>Pilih Foto dari Galeri / Kamera</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>

                  {buktiPreview && (
                    <div className="relative h-20 w-20 rounded-2xl overflow-hidden border-2 border-slate-200 shadow-sm group">
                      <img src={buktiPreview} alt="Bukti Foto" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                        title="Hapus Foto"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ACTION BAR BAWAH */}
            <div className="sticky bottom-0 z-10 flex items-center justify-between gap-4 rounded-3xl bg-white/95 backdrop-blur-md p-4 sm:p-5 border border-slate-200/90 shadow-lg">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 hover:bg-slate-200 px-5 py-3 text-xs sm:text-sm font-extrabold text-slate-700 transition cursor-pointer"
              >
                <ChevronLeft size={16} /> Batal & Kembali
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] px-6 sm:px-8 py-3 text-xs sm:text-sm font-black text-white shadow-lg shadow-[#138F81]/25 transition cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan Catatan...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>{isEditing ? 'Simpan Perubahan' : 'Simpan & Terbitkan ke Wali'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
