import {
  Award,
  BookOpen,
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

interface ComplexNilaiFormProps {
  initialData?: ApiRecord | null;
  students: ApiRecord[];
  mapelRows: ApiRecord[];
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

function calculateGrade(score: number): { grade: string; predikat: string; tone: string } {
  if (score >= 90) return { grade: 'A', predikat: 'Istimewa (Mumtaz)', tone: 'emerald' };
  if (score >= 80) return { grade: 'B', predikat: 'Sangat Baik (Jayyid Jiddan)', tone: 'blue' };
  if (score >= 70) return { grade: 'C', predikat: 'Baik (Jayyid)', tone: 'teal' };
  if (score >= 60) return { grade: 'D', predikat: 'Cukup (Maqbul)', tone: 'amber' };
  return { grade: 'E', predikat: 'Perlu Bimbingan (Rasib)', tone: 'rose' };
}

export function ComplexNilaiForm({
  initialData,
  students,
  mapelRows,
  activeAcademic,
  readOnly = false,
  onClose,
  onSave,
}: ComplexNilaiFormProps) {
  const { session } = useAuth();

  const [form, setForm] = useState<{
    id?: number;
    siswa_id: string;
    mapel_id: string;
    jenis_ujian: string;
    nilai: string;
    keterangan: string;
    academic_year_id: string;
  }>({
    id: initialData?.id ? num(initialData.id) : undefined,
    siswa_id: text(initialData?.siswa_id ?? (initialData?.siswa as ApiRecord)?.id, ''),
    mapel_id: text(initialData?.mapel_id ?? (initialData?.mata_pelajaran as ApiRecord)?.id, ''),
    jenis_ujian: text(initialData?.jenis_ujian, 'Harian'),

    nilai: text(initialData?.nilai, ''),
    keterangan: text(initialData?.keterangan, ''),
    academic_year_id: text(initialData?.academic_year_id ?? activeAcademic?.id, ''),
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const selectedStudent = useMemo(() => {
    return students.find((s) => String(s.id) === String(form.siswa_id));
  }, [students, form.siswa_id]);

  const selectedMapel = useMemo(() => {
    return mapelRows.find((m) => String(m.id) === String(form.mapel_id));
  }, [mapelRows, form.mapel_id]);

  const numericScore = Number(form.nilai) || 0;
  const gradeInfo = useMemo(() => calculateGrade(numericScore), [numericScore]);

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving || readOnly || !session) return;

    if (!form.siswa_id) {
      setError('Silakan pilih santri terlebih dahulu.');
      return;
    }
    if (!form.mapel_id) {
      setError('Silakan pilih mata pelajaran.');
      return;
    }
    if (form.nilai === '' || Number(form.nilai) < 0 || Number(form.nilai) > 100) {
      setError('Skor nilai wajib diisi antara rentang 0 sampai 100.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const payload: ApiRecord = {
        user_id: session.id,
        siswa_id: Number(form.siswa_id),
        mapel_id: Number(form.mapel_id),
        jenis_ujian: form.jenis_ujian,
        nilai: Number(form.nilai),
        keterangan: form.keterangan.trim(),
        academic_year_id: form.academic_year_id ? Number(form.academic_year_id) : undefined,
        tahun_ajaran: text(activeAcademic?.name ?? activeAcademic?.tahun_ajaran, ''),
        semester: text(activeAcademic?.active_semester ?? activeAcademic?.semester, ''),
      };

      if (form.id) {
        await api.updateNilai(form.id, payload);
      } else {
        await api.createNilai(payload);
      }

      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'nilai' } }));
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSave();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan nilai ujian santri.');
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
              Nilai ujian {selectedStudent ? text(selectedStudent.nama) : 'santri'} berhasil dicatat ke rapor.
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
                <Award size={22} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-[#2D3436]">
                  {form.id ? 'Edit Nilai Ujian Santri' : 'Input Nilai Ujian Baru'}
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-[#636E72]">
                  Pencatatan evaluasi akademik KBM (Harian, UTS, UAS) terhubung langsung ke Buku Induk & Rapor.
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
            {/* Kolom Kiri: Form Input Nilai (2 Kolom) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Card 1: Identitas Santri & Mapel */}
              <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 sm:p-6 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-3">
                  <User size={18} className="text-[#138F81]" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                    I. Target Santri & Mata Pelajaran
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

                {/* Pilih Mapel */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Mata Pelajaran <span className="text-rose-500">*</span>
                  </label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all cursor-pointer"
                    value={form.mapel_id}
                    onChange={(e) => setForm({ ...form, mapel_id: e.target.value })}
                    required
                  >
                    <option value="">-- Pilih Mata Pelajaran KBM --</option>
                    {mapelRows.map((m) => (
                      <option key={text(m.id)} value={text(m.id)}>
                        {text(m.nama)} {m.kode ? `[${m.kode}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Card 2: Jenis Evaluasi & Skor */}
              <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 sm:p-6 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-3">
                  <GraduationCap size={18} className="text-[#138F81]" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                    II. Evaluasi Ujian & Skor Nilai
                  </h3>
                </div>

                {/* Jenis Ujian Pills */}
                <div>
                  <label className="mb-2 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Jenis Evaluasi / Ujian
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { key: 'Harian', label: '📝 Ujian Harian', desc: 'Tugas / Ulangan Harian' },
                      { key: 'UTS', label: '📑 UTS Madin', desc: 'Tengah Semester' },
                      { key: 'UAS', label: '🏆 UAS / Imtihan', desc: 'Akhir Semester' },
                    ].map((j) => {
                      const isSelected = form.jenis_ujian === j.key;
                      return (
                        <button
                          key={j.key}
                          type="button"
                          onClick={() => setForm({ ...form, jenis_ujian: j.key })}
                          className={`p-3.5 rounded-2xl border text-left transition-all ${
                            isSelected
                              ? 'border-[#138F81] bg-teal-50/90 ring-2 ring-[#138F81]/20 shadow-xs'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <p className={`text-xs sm:text-sm font-black ${isSelected ? 'text-[#138F81]' : 'text-slate-800'}`}>
                            {j.label}
                          </p>
                          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{j.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Input Skor Nilai */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Skor Nilai Angka (0 - 100) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-xl font-black text-slate-800 placeholder:text-slate-300 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      placeholder="Contoh: 85, 92.5..."
                      value={form.nilai}
                      onChange={(e) => setForm({ ...form, nilai: e.target.value })}
                      required
                    />
                    {form.nilai !== '' && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 rounded-xl bg-teal-50 px-3 py-1 text-sm font-black text-[#138F81] border border-teal-200">
                        Grade {gradeInfo.grade}
                      </span>
                    )}
                  </div>
                </div>

                {/* Catatan Keterangan */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Catatan Evaluasi / Catatan Guru (Opsional)
                  </label>
                  <textarea
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all min-h-20 resize-none"
                    value={form.keterangan}
                    onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                    placeholder="Catatan perkembangan pemahaman santri, keaktifan musyawarah, atau saran pengajar..."
                  />
                </div>
              </div>
            </div>

            {/* Kolom Kanan: Live Preview & Rapor Card */}
            <div className="space-y-5">
              <div className="rounded-3xl border border-teal-100 bg-gradient-to-b from-teal-50/60 to-white p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-teal-100/80 pb-3">
                  <Sparkles size={18} className="text-[#138F81]" />
                  <h3 className="text-xs font-black text-[#138F81] uppercase tracking-wider">
                    Pratinjau Nilai di Rapor
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
                    <span className="rounded-lg bg-teal-50 px-2 py-0.5 text-xs font-black text-[#138F81] border border-teal-200">
                      {form.jenis_ujian}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Mata Pelajaran:</p>
                      <p className="text-sm font-black text-slate-800">{selectedMapel ? text(selectedMapel.nama) : 'Belum Dipilih'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-500">Skor Akhir:</p>
                      <p className="text-2xl font-black text-slate-800">{form.nilai || '0'}</p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600">Predikat:</span>
                    <span className="font-black text-[#138F81]">{gradeInfo.predikat}</span>
                  </div>
                </div>

                <div className="rounded-2xl bg-teal-50/80 p-3.5 border border-teal-100 text-xs font-semibold text-teal-900 leading-relaxed">
                  📘 <b>Sinkronisasi Otomatis:</b> Nilai yang disimpan akan langsung otomatis tersambung ke <b>Portal Wali Santri</b> dan kalkulasi peringkat kelas santri.
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
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Nilai Ujian'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
