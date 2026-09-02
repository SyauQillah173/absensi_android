import {
  CheckCircle2,
  Clock,
  Landmark,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import { FormEvent, useState } from 'react';
import { api, type ApiRecord } from '../services/api';

interface ComplexSholatFormProps {
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

const QUICK_PRAYER_SUGGESTIONS = [
  'Subuh',
  'Dzuhur',
  'Ashar',
  'Maghrib',
  'Isya',
  'Sholat Tahajjud',
  'Sholat Dhuha',
  'Sholat Tarawih',
  'Sholat Jumat',
];

export function ComplexSholatForm({
  initialData,
  readOnly = false,
  onClose,
  onSave,
}: ComplexSholatFormProps) {
  const [form, setForm] = useState<{
    id?: number;
    name: string;
    code: string;
    description: string;
    sort_order: number;
    is_active: boolean;
  }>({
    id: initialData?.id ? num(initialData.id) : undefined,
    name: text(initialData?.name),
    code: text(initialData?.code),
    description: text(initialData?.description),
    sort_order: initialData?.sort_order !== undefined ? num(initialData.sort_order) : 10,
    is_active: initialData?.is_active !== false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  // Auto-slug kode sholat dari nama jika belum diisi custom
  const handleNameChange = (val: string) => {
    setForm((prev) => {
      const updated = { ...prev, name: val };
      if (!prev.id && (!prev.code || prev.code === prev.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'))) {
        updated.code = val.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      }
      return updated;
    });
  };

  const handleApplySuggestion = (suggestion: string) => {
    setForm((prev) => ({
      ...prev,
      name: suggestion,
      code: suggestion.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    }));
  };

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving || readOnly) return;

    if (!form.name.trim()) {
      setError("Nama waktu sholat jama'ah wajib diisi.");
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        description: form.description.trim(),
        is_active: form.is_active,
        sort_order: form.sort_order,
      };

      if (form.id) {
        await api.updatePrayerAttendanceType(form.id, payload);
      } else {
        await api.createPrayerAttendanceType(payload);
      }

      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'sholat' } }));
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSave();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan waktu sholat jama'ah.");
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
                ? `Waktu Jama'ah "${form.name}" berhasil diperbarui.`
                : `Waktu Jama'ah baru "${form.name}" berhasil dibuat.`}
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
                <Landmark size={22} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-[#2D3436]">
                  {form.id ? `Edit Waktu Jama'ah: ${form.name}` : "Tambah Waktu Jama'ah Baru"}
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-[#636E72]">
                  Atur sesi sholat jama'ah santri pondok, kode sistem, dan urutan tampil secara terpadu.
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
              {/* Card 1: Identitas Sesi Sholat */}
              <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 sm:p-6 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-3">
                  <Landmark size={18} className="text-[#138F81]" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                    I. Identitas Waktu Jama'ah
                  </h3>
                </div>

                {/* Nama Waktu Sholat */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Nama Waktu Sholat <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                    type="text"
                    value={form.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    required
                    placeholder="Contoh: Subuh, Dzuhur, Ashar, Maghrib, Isya..."
                  />

                  {/* Suggestion Chips */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-400">Pilihan Cepat:</span>
                    {QUICK_PRAYER_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleApplySuggestion(s)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                          form.name.toLowerCase() === s.toLowerCase()
                            ? 'bg-[#138F81] text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Kode Unik */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Kode Unik Sesi (Otomatis / Opsional)
                  </label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-mono font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="Contoh: subuh, maghrib, isya"
                  />
                  <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
                    Kode unik dipakai sistem database untuk sinkronisasi absensi sholat santri di aplikasi Android.
                  </p>
                </div>

                {/* Keterangan */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Keterangan (Opsional)
                  </label>
                  <textarea
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all min-h-20 resize-none"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Keterangan tambahan mengenai pelaksanaan sholat berjama'ah..."
                  />
                </div>
              </div>

              {/* Card 2: Urutan Tampil & Operasional */}
              <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 sm:p-6 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-3">
                  <Clock size={18} className="text-[#138F81]" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                    II. Urutan & Pengaturan Operasional
                  </h3>
                </div>

                {/* Urutan Tampil */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Urutan Tampil (Sort Order)
                  </label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
                  />
                  <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
                    Angka lebih kecil (misal: 10 untuk Subuh, 20 untuk Dzuhur) akan muncul lebih dulu pada form absensi pengurus.
                  </p>
                </div>

                {/* Status Aktif Switch */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-4 shadow-xs">
                  <div>
                    <p className="text-sm font-black text-slate-800">Status Waktu Sholat</p>
                    <p className="text-xs font-semibold text-slate-400 mt-0.5">
                      Aktifkan agar sesi sholat ini muncul pada pilihan input absensi sholat santri di aplikasi Android dan web.
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
            </div>

            {/* Kolom Kanan: Live Preview & Catatan Integrasi */}
            <div className="space-y-5">
              <div className="rounded-3xl border border-teal-100 bg-gradient-to-b from-teal-50/50 to-white p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-teal-100/80 pb-3">
                  <Sparkles size={18} className="text-[#138F81]" />
                  <h3 className="text-xs font-black text-[#138F81] uppercase tracking-wider">
                    Pratinjau Sesi di Presensi
                  </h3>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-[#138F81] border border-teal-100 font-black">
                      <Landmark size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-black text-slate-800 truncate">
                        {form.name || "Nama Waktu Jama'ah"}
                      </p>
                      <p className="text-xs font-mono text-slate-400">
                        Kode: {form.code || 'otomatis'} • Urutan: #{form.sort_order}
                      </p>
                    </div>
                  </div>

                  {form.description ? (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                      {form.description}
                    </p>
                  ) : null}

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
                  🕌 <b>Integrasi Aplikasi:</b> Setiap kali sesi waktu jama'ah ini disimpan atau diubah, pengurus asrama dan ustadz pembina yang sedang membuka aplikasi absensi santri akan langsung menerima pembaruan secara otomatis.
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
            <span>{isSaving ? 'Menyimpan...' : "Simpan Waktu Jama'ah"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
