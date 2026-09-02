import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  GraduationCap,
  Pencil,
  Save,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { api, type ApiRecord } from '../services/api';

interface ComplexKelasFormProps {
  initialData?: ApiRecord | null;
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

export function ComplexKelasForm({
  initialData,
  readOnly = false,
  onClose,
  onSave,
}: ComplexKelasFormProps) {
  const [form, setForm] = useState<{
    id?: number;
    name: string;
    code: string;
    gender_group: 'PA' | 'PI' | 'Campur';
    is_active: boolean;
  }>({
    id: initialData?.id ? num(initialData.id) : undefined,
    name: text(initialData?.name),
    code: text(initialData?.code),
    gender_group: (text(initialData?.gender_group, 'Campur') as 'PA' | 'PI' | 'Campur') || 'Campur',
    is_active: initialData?.is_active !== false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  // Auto-generate kode kelas dari nama
  const handleNameChange = (val: string) => {
    setForm((prev) => {
      const updated = { ...prev, name: val };
      // Hanya auto-slug jika user belum mengetik kode custom atau sedang buat baru
      if (!prev.id && (!prev.code || prev.code === prev.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'))) {
        updated.code = val.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      }
      return updated;
    });
  };

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving || readOnly) return;

    if (!form.name.trim()) {
      setError('Nama kelas Madin wajib diisi.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        category: 'Madin',
        gender_group: form.gender_group,
        is_active: form.is_active,
      };

      if (form.id) {
        await api.updateClass(form.id, payload);
      } else {
        await api.createClass(payload);
      }

      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'kelas' } }));
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSave();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan data kelas Madin.');
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
              {form.id
                ? `Kelas Madin "${form.name}" berhasil diperbarui.`
                : `Kelas Madin baru "${form.name}" berhasil dibuat.`}
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
                <GraduationCap size={22} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-[#2D3436]">
                  {form.id ? `Edit Data Kelas Madin: ${form.name}` : 'Tambah Kelas Madin Baru'}
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-[#636E72]">
                  Atur nama rombel, kode kelas, dan pengelompokan santri secara terpadu.
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
            {/* Kolom Kiri: Form Input Utama (2 Kolom) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Card 1: Identitas Rombel Kelas */}
              <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 sm:p-6 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-3">
                  <BookOpen size={18} className="text-[#138F81]" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                    I. Identitas Rombel Kelas Madin
                  </h3>
                </div>

                {/* Nama Kelas */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Nama Kelas Madin <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                    type="text"
                    value={form.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    required
                    placeholder="Contoh: Sifir Awal A PA, 1 Ibtidaiyah B PI..."
                  />
                  <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
                    Format nama rombel dianjurkan mencantumkan tingkatan dan gender (PA / PI).
                  </p>
                </div>

                {/* Kode Kelas */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Kode Unik Kelas (Otomatis / Opsional)
                  </label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-mono font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="Contoh: sifir_awal_a_pa"
                  />
                  <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
                    Kode unik dipakai sistem untuk integrasi jadwal KBM dan database santri.
                  </p>
                </div>
              </div>

              {/* Card 2: Pengelompokan Santri & Gender */}
              <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 sm:p-6 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-3">
                  <Users size={18} className="text-[#138F81]" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                    II. Kelompok Santri & Gender
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { key: 'PA', label: '👦 Putra (PA)', desc: 'Khusus santri putra' },
                    { key: 'PI', label: '👧 Putri (PI)', desc: 'Khusus santri putri' },
                    { key: 'Campur', label: '👥 Campur (PA & PI)', desc: 'Rombel gabungan' },
                  ].map((g) => {
                    const isSelected = form.gender_group === g.key;
                    return (
                      <button
                        key={g.key}
                        type="button"
                        onClick={() => setForm({ ...form, gender_group: g.key as 'PA' | 'PI' | 'Campur' })}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                          isSelected
                            ? 'border-[#138F81] bg-teal-50/80 ring-2 ring-[#138F81]/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <p className={`text-sm font-black ${isSelected ? 'text-[#138F81]' : 'text-slate-800'}`}>
                          {g.label}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-400 mt-1">{g.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card 3: Status Aktif Kelas */}
              <div className="rounded-3xl border border-slate-200 bg-white p-5 flex items-center justify-between gap-4 shadow-xs">
                <div>
                  <p className="text-sm font-black text-slate-800">Status Operasional Kelas</p>
                  <p className="text-xs font-semibold text-slate-400 mt-0.5">
                    Kelas aktif dapat dipilih saat pembuatan jadwal KBM, penempatan santri, dan presensi harian.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-13 h-7 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#138F81]"></div>
                </label>
              </div>
            </div>

            {/* Kolom Kanan: Live Preview & Informasi Terpadu */}
            <div className="space-y-5">
              <div className="rounded-3xl border border-teal-100 bg-gradient-to-b from-teal-50/50 to-white p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-teal-100/80 pb-3">
                  <Sparkles size={18} className="text-[#138F81]" />
                  <h3 className="text-xs font-black text-[#138F81] uppercase tracking-wider">
                    Pratinjau Kelas di Sistem
                  </h3>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-black text-slate-800 truncate">
                        {form.name || 'Nama Kelas Madin'}
                      </p>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">
                        Kode: {form.code || 'otomatis'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-black ${
                        form.gender_group === 'PA'
                          ? 'bg-blue-50 text-blue-800 border border-blue-200'
                          : form.gender_group === 'PI'
                          ? 'bg-rose-50 text-rose-800 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {form.gender_group === 'PA'
                        ? 'Putra (PA)'
                        : form.gender_group === 'PI'
                        ? 'Putri (PI)'
                        : 'Campur'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs font-semibold text-slate-500">
                    <span>Status:</span>
                    <span
                      className={`font-black ${
                        form.is_active ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {form.is_active ? '● Aktif Digunakan' : '○ Nonaktif'}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl bg-teal-50/80 p-3.5 border border-teal-100 text-xs font-semibold text-teal-900 leading-relaxed">
                  💡 <b>Catatan Sistem:</b> Perubahan nama rombel kelas ini akan langsung tersinkronisasi otomatis dengan seluruh modul: <b>Jadwal KBM Madin</b>, <b>Presensi Harian</b>, dan <b>Buku Induk Santri</b>.
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
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Data Kelas'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
