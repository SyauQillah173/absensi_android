import {
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import { FormEvent, useState } from 'react';
import { api, type ApiRecord } from '../services/api';

interface ComplexTahunAjaranFormProps {
  initialData?: ApiRecord | null;
  onClose: () => void;
  onSave: () => void;
}

export function ComplexTahunAjaranForm({
  initialData,
  onClose,
  onSave,
}: ComplexTahunAjaranFormProps) {
  const [name, setName] = useState(String(initialData?.name || ''));
  const [yearStart, setYearStart] = useState(String(initialData?.year_start || ''));
  const [yearEnd, setYearEnd] = useState(String(initialData?.year_end || ''));
  const [activeSemester, setActiveSemester] = useState<'ganjil' | 'genap'>(
    (initialData?.active_semester as 'ganjil' | 'genap') || 'ganjil'
  );
  const [isActive, setIsActive] = useState(initialData?.is_active !== false);

  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleYearStartChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 4);
    setYearStart(clean);
    if (clean.length === 4) {
      const end = String(Number(clean) + 1);
      setYearEnd(end);
      if (!name || name.includes('/')) {
        setName(`${clean}/${end}`);
      }
    }
  };

  const submit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;

    if (!name.trim()) {
      setError('Nama tahun ajaran wajib diisi (misal: 2025/2026).');
      return;
    }
    if (!yearStart || !yearEnd) {
      setError('Tahun mulai dan tahun selesai wajib diisi.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const payload = {
        name: name.trim(),
        year_start: Number(yearStart),
        year_end: Number(yearEnd),
        active_semester: activeSemester,
        is_active: isActive,
      };

      if (initialData?.id) {
        await api.updateAcademicPeriod(Number(initialData.id), payload);
      } else {
        await api.createAcademicPeriod(payload);
      }

      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'akademik' } }));
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSave();
        onClose();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan tahun ajaran.');
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
              Tahun ajaran {name} ({activeSemester.toUpperCase()}) berhasil diperbarui.
            </p>
          </div>
        </div>
      )}

      <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#138F81] text-white shadow-md shadow-[#138F81]/20">
              <CalendarDays size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#2D3436]">
                {initialData?.id ? 'Edit Tahun Ajaran & Semester' : 'Tambah Tahun Ajaran Baru'}
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-[#636E72]">
                Pengaturan kalender akademik pondok pesantren dan status semester aktif KBM.
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs sm:text-sm font-bold text-rose-700">
              ⚠️ {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 sm:p-6 space-y-4">
                {/* Tahun Mulai & Selesai */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Tahun Mulai <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                      type="text"
                      inputMode="numeric"
                      value={yearStart}
                      onChange={(e) => handleYearStartChange(e.target.value)}
                      placeholder="Contoh: 2025"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Tahun Selesai <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                      type="text"
                      inputMode="numeric"
                      value={yearEnd}
                      onChange={(e) => setYearEnd(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="Contoh: 2026"
                      required
                    />
                  </div>
                </div>

                {/* Nama Tahun Ajaran */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Nama / Label Periode Akademik <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: 2025/2026"
                    required
                  />
                </div>

                {/* Pilihan Semester */}
                <div>
                  <label className="mb-2 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Semester Aktif Saat Ini
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'ganjil', label: '1️⃣ Semester Ganjil', desc: 'Juli - Desember' },
                      { key: 'genap', label: '2️⃣ Semester Genap', desc: 'Januari - Juni' },
                    ].map((sem) => {
                      const isSelected = activeSemester === sem.key;
                      return (
                        <button
                          key={sem.key}
                          type="button"
                          onClick={() => setActiveSemester(sem.key as 'ganjil' | 'genap')}
                          className={`p-4 rounded-2xl border text-left transition-all ${
                            isSelected
                              ? 'border-[#138F81] bg-teal-50/90 ring-2 ring-[#138F81]/20 shadow-xs'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <p className={`text-sm font-black ${isSelected ? 'text-[#138F81]' : 'text-slate-800'}`}>
                            {sem.label}
                          </p>
                          <p className="text-xs font-semibold text-slate-400 mt-0.5">{sem.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Switch Status Aktif */}
                <div className="flex items-center justify-between rounded-2xl bg-white p-4 border border-slate-200">
                  <div>
                    <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Jadikan Tahun Ajaran Utama</p>
                    <p className="text-[11px] font-semibold text-slate-400">
                      Tahun ajaran aktif akan digunakan di seluruh modul presensi, rapor, dan tagihan SPP.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:top-[2px] after:start-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-[#138F81] peer-checked:after:translate-x-full peer-focus:outline-hidden"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Live Preview Card */}
            <div className="space-y-4">
              <div className="rounded-3xl border border-teal-100 bg-linear-to-b from-teal-50/60 to-white p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-teal-100/80 pb-3">
                  <Sparkles size={18} className="text-[#138F81]" />
                  <h3 className="text-xs font-black text-[#138F81] uppercase tracking-wider">
                    Kalender Akademik Pondok
                  </h3>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-teal-100 text-[#138F81] font-black text-[10px] px-2 py-0.5 uppercase">
                      Tahun Ajaran
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {isActive ? '🟢 Periode Aktif' : '⚪ Riwayat Arsip'}
                    </span>
                  </div>

                  <p className="text-xl font-black text-slate-900">{name || '2025/2026'}</p>

                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-500">Semester:</span>
                    <span className="font-black text-[#138F81] uppercase">{activeSemester}</span>
                  </div>
                </div>

                <div className="rounded-2xl bg-teal-50/80 p-3.5 border border-teal-100 text-xs font-semibold text-teal-900 leading-relaxed">
                  🎓 <b>KBM Otomatis:</b> Seluruh jadwal madin dan log absensi otomatis terhubung ke tahun ajaran yang sedang aktif ini.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#138F81] px-6 py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-[#138F81]/25 hover:bg-[#0f766a] transition-all disabled:opacity-50"
          >
            <Save size={16} />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Tahun Ajaran'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
