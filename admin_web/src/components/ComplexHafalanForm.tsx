import {
  BookMarked,
  BookOpen,
  Calendar,
  CheckCircle2,
  GraduationCap,
  Save,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api, type ApiRecord } from '../services/api';

interface ComplexHafalanFormProps {
  initialData?: ApiRecord | null;
  students: ApiRecord[];
  activeAcademic: ApiRecord;
  readOnly?: boolean;
  onClose: () => void;
  onSave: () => void;
}

function text(value: unknown, fallback = ''): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

const POPULAR_SURAHS = [
  "An-Naba'",
  'Al-Mulk',
  'Yasin',
  'Al-Waqi’ah',
  'Ar-Rahman',
  'Al-Kahfi',
  'Al-Ikhlas',
  'Al-Fatihah',
  'Juz 30 Lengkap',
];

export function ComplexHafalanForm({
  initialData,
  students,
  activeAcademic,
  readOnly = false,
  onClose,
  onSave,
}: ComplexHafalanFormProps) {
  const { session } = useAuth();

  const [form, setForm] = useState<{
    id?: number;
    siswa_id: string;
    juz: string;
    surah: string;
    status: string;
    tanggal_setor: string;
    nilai_hafalan: string;
    keterangan: string;
    academic_year_id: string;
  }>({
    id: initialData?.id ? num(initialData.id) : undefined,
    siswa_id: text(initialData?.siswa_id ?? (initialData?.siswa as ApiRecord)?.id, ''),
    juz: text(initialData?.juz, '30'),

    surah: text(initialData?.surah, ''),
    status: text(initialData?.status, 'Mutqin'),
    tanggal_setor: text(initialData?.tanggal_setor, new Date().toISOString().slice(0, 10)),
    nilai_hafalan: text(initialData?.nilai_hafalan, '90'),
    keterangan: text(initialData?.keterangan, ''),
    academic_year_id: text(initialData?.academic_year_id ?? activeAcademic?.id, ''),
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const selectedStudent = useMemo(() => {
    return students.find((s) => String(s.id) === String(form.siswa_id));
  }, [students, form.siswa_id]);

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving || readOnly || !session) return;

    if (!form.siswa_id) {
      setError('Silakan pilih santri yang menyetorkan hafalan.');
      return;
    }
    if (!form.surah.trim()) {
      setError('Nama surat atau materi hafalan wajib diisi.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const payload: ApiRecord = {
        user_id: session.id,
        siswa_id: Number(form.siswa_id),
        juz: form.juz.trim(),
        surah: form.surah.trim(),
        status: form.status,
        tanggal_setor: form.tanggal_setor,
        nilai_hafalan: form.nilai_hafalan ? Number(form.nilai_hafalan) : undefined,
        keterangan: form.keterangan.trim(),
        academic_year_id: form.academic_year_id ? Number(form.academic_year_id) : undefined,
      };

      if (form.id) {
        await api.updateHafalan(form.id, payload);
      } else {
        await api.createHafalan(payload);
      }

      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'hafalan' } }));
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSave();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan setoran hafalan santri.');
      setIsSaving(false);
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
              Setoran surat {form.surah} untuk {selectedStudent ? text(selectedStudent.nama) : 'santri'} berhasil tercatat.
            </p>
          </div>
        </div>
      )}

      <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#138F81] text-white shadow-md shadow-[#138F81]/20">
                <BookMarked size={22} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-[#2D3436]">
                  {form.id ? 'Edit Setoran Hafalan Santri' : 'Tambah Setoran Hafalan Baru'}
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-[#636E72]">
                  Pencatatan setoran tahfidz Al-Qur'an dan kitab nadhom santri Pondok Pesantren Qomaruddin.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button
              className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors shrink-0"
              onClick={onClose}
              type="button"
              disabled={isSuccess}
              title="Tutup form"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Form Body with Scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs sm:text-sm font-bold text-rose-700">
              ⚠️ {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Kolom Kiri: Form Input Setoran (2 Kolom) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Card 1: Identitas Santri & Materi */}
              <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 sm:p-6 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-3">
                  <User size={18} className="text-[#138F81]" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                    I. Target Santri & Materi Setoran
                  </h3>
                </div>

                {/* Pilih Santri */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Pilih Santri <span className="text-rose-500">*</span>
                  </label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all cursor-pointer"
                    value={form.siswa_id}
                    onChange={(e) => setForm({ ...form, siswa_id: e.target.value })}
                    required
                  >
                    <option value="">-- Cari dan Pilih Santri --</option>
                    {students.map((s) => (
                      <option key={text(s.id)} value={text(s.id)}>
                        {text(s.nama)} (NIS: {text(s.nis)}) — Kelas: {text(s.kelas, 'Belum Ditentukan')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {/* Juz */}
                  <div>
                    <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Juz Al-Qur'an
                    </label>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#138F81] focus:outline-hidden cursor-pointer"
                      value={form.juz}
                      onChange={(e) => setForm({ ...form, juz: e.target.value })}
                    >
                      {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
                        <option key={j} value={String(j)}>
                          Juz {j} {j === 30 ? "('Amma)" : j === 1 ? '(Al-Baqarah)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Surat / Materi */}
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Surat / Materi Hafalan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                      type="text"
                      placeholder="Contoh: An-Naba' 1-40, Al-Mulk, Yasin..."
                      value={form.surah}
                      onChange={(e) => setForm({ ...form, surah: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Quick Surah Suggestion Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-400">Pilihan Cepat:</span>
                  {POPULAR_SURAHS.map((sur) => (
                    <button
                      key={sur}
                      type="button"
                      onClick={() => setForm({ ...form, surah: sur })}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                        form.surah === sur
                          ? 'bg-[#138F81] text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {sur}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card 2: Predikat, Nilai & Tanggal */}
              <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 sm:p-6 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-3">
                  <GraduationCap size={18} className="text-[#138F81]" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                    II. Predikat Kelulusan & Catatan Tajwid
                  </h3>
                </div>

                {/* Predikat Status Pills */}
                <div>
                  <label className="mb-2 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Status Predikat Setoran
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { key: 'Mutqin', label: '⭐ Mutqin', desc: 'Lancar & Tajwid Baik' },
                      { key: 'Mumtaz', label: '🌟 Mumtaz', desc: 'Sangat Sempurna' },
                      { key: 'Jayyid', label: '👍 Jayyid', desc: 'Baik / Lulus' },
                      { key: 'Mengulang', label: '🔄 Mengulang', desc: 'Perlu Pengulangan' },
                    ].map((p) => {
                      const isSelected = form.status.toLowerCase() === p.key.toLowerCase();
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setForm({ ...form, status: p.key })}
                          className={`p-3 rounded-2xl border text-left transition-all ${
                            isSelected
                              ? 'border-[#138F81] bg-teal-50/90 ring-2 ring-[#138F81]/20 shadow-xs'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <p className={`text-xs sm:text-sm font-black ${isSelected ? 'text-[#138F81]' : 'text-slate-800'}`}>
                            {p.label}
                          </p>
                          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{p.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Nilai Angka */}
                  <div>
                    <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Skor Nilai Hafalan (0 - 100)
                    </label>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                      type="number"
                      min="0"
                      max="100"
                      value={form.nilai_hafalan}
                      onChange={(e) => setForm({ ...form, nilai_hafalan: e.target.value })}
                      placeholder="Contoh: 90"
                    />
                  </div>

                  {/* Tanggal Setor */}
                  <div>
                    <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Tanggal Setoran
                    </label>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#138F81] focus:outline-hidden"
                      type="date"
                      value={form.tanggal_setor}
                      onChange={(e) => setForm({ ...form, tanggal_setor: e.target.value })}
                    />
                  </div>
                </div>

                {/* Catatan Tajwid */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Catatan Tajwid & Makhorijul Huruf (Opsional)
                  </label>
                  <textarea
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all min-h-20 resize-none"
                    value={form.keterangan}
                    onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                    placeholder="Catatan panjang pendek mad, dengung ikhfa/idgham, atau kelancaran ayat..."
                  />
                </div>
              </div>
            </div>

            {/* Kolom Kanan: Live Preview Kartu Prestasi */}
            <div className="space-y-5">
              <div className="rounded-3xl border border-teal-100 bg-gradient-to-b from-teal-50/60 to-white p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-teal-100/80 pb-3">
                  <Sparkles size={18} className="text-[#138F81]" />
                  <h3 className="text-xs font-black text-[#138F81] uppercase tracking-wider">
                    Kartu Prestasi Tahfidz
                  </h3>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3.5">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-slate-800 truncate">
                        {selectedStudent ? text(selectedStudent.nama) : 'Pilih Santri'}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                        NIS: {selectedStudent ? text(selectedStudent.nis) : '—'} • Kelas: {selectedStudent ? text(selectedStudent.kelas, 'Umum') : '—'}
                      </p>
                    </div>
                    <span className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-black text-[#138F81] border border-teal-200">
                      Juz {form.juz}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Materi Surat:</p>
                      <p className="text-sm font-black text-slate-800">{form.surah || 'Belum Diisi'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-500">Skor:</p>
                      <p className="text-2xl font-black text-slate-800">{form.nilai_hafalan || '-'}</p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600">Predikat:</span>
                    <span className="font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                      {form.status}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl bg-teal-50/80 p-3.5 border border-teal-100 text-xs font-semibold text-teal-900 leading-relaxed">
                  📖 <b>Laporan Wali Santri:</b> Catatan setoran ini dapat dilihat langsung oleh orang tua santri melalui <b>Portal Wali</b> di web dan aplikasi Android.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isSuccess}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSaving || isSuccess}
            className="inline-flex items-center gap-2 rounded-xl bg-[#138F81] px-6 py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-[#138F81]/25 hover:bg-[#0f766a] transition-all disabled:opacity-50"
          >
            <Save size={16} />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Setoran'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
