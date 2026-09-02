import {
  CheckCircle2,
  Database,
  Layers,
  Save,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { FormEvent, useState } from 'react';
import { api, type ApiRecord } from '../services/api';

interface ComplexReferensiFormProps {
  initialData?: ApiRecord | null;
  kategoriOptions: string[];
  onClose: () => void;
  onSave: () => void;
}

export function ComplexReferensiForm({
  initialData,
  kategoriOptions,
  onClose,
  onSave,
}: ComplexReferensiFormProps) {
  const [form, setForm] = useState<{
    id?: number;
    kategori: string;
    nilai: string;
    is_active: boolean;
  }>({
    id: initialData?.id ? Number(initialData.id) : undefined,
    kategori: String(initialData?.kategori || '').toLowerCase(),
    nilai: String(initialData?.nilai || ''),
    is_active: initialData?.is_active !== false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;

    if (!form.kategori.trim()) {
      setError('Kategori referensi wajib diisi.');
      return;
    }
    if (!form.nilai.trim()) {
      setError('Nilai / label opsi referensi wajib diisi.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const payload = {
        kategori: form.kategori.trim().toLowerCase(),
        nilai: form.nilai.trim(),
        is_active: form.is_active,
      };

      if (form.id) {
        await api.updateMasterReferensi(form.id, payload);
      } else {
        await api.createMasterReferensi(payload);
      }


      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'referensi' } }));
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSave();
        onClose();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan data referensi.');
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
              Referensi {form.nilai} ({form.kategori}) berhasil diperbarui.
            </p>
          </div>
        </div>
      )}

      <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#138F81] text-white shadow-md shadow-[#138F81]/20">
              <Database size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#2D3436]">
                {form.id ? 'Edit Data Referensi Master' : 'Tambah Referensi Master Baru'}
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-[#636E72]">
                Pengaturan opsi dropdown dinamis untuk formulir santri, guru, dan berkas pondok.
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
                {/* Kategori */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Kategori Referensi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    list="kategori-list-inpage"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                    value={form.kategori}
                    onChange={(e) => setForm({ ...form, kategori: e.target.value.toLowerCase() })}
                    placeholder="Pilih atau ketik kategori baru (misal: provinsi, status_santri)..."
                    required
                  />
                  <datalist id="kategori-list-inpage">
                    {kategoriOptions.map((k) => (
                      <option key={k} value={k} />
                    ))}
                  </datalist>
                </div>

                {/* Nilai */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Nilai / Opsi Dropdown <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                    type="text"
                    value={form.nilai}
                    onChange={(e) => setForm({ ...form, nilai: e.target.value })}
                    placeholder="Misal: Jawa Timur, Gresik, Reguler..."
                    required
                  />
                </div>

                {/* Status Aktif */}
                <div className="flex items-center justify-between rounded-2xl bg-white p-4 border border-slate-200">
                  <div>
                    <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Status Opsi Referensi</p>
                    <p className="text-[11px] font-semibold text-slate-400">
                      Opsi aktif akan otomatis tampil dalam pilihan dropdown formulir santri dan wali.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
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
                    Pratinjau Dropdown
                  </h3>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 shadow-xs">
                  <span className="rounded-md bg-teal-100 text-[#138F81] font-black text-[10px] px-2 py-0.5 uppercase">
                    {form.kategori || 'kategori'}
                  </span>
                  <p className="text-base font-black text-slate-900 mt-1">{form.nilai || 'Label Opsi'}</p>
                  <p className="text-xs font-bold text-slate-400">
                    Status: {form.is_active ? '🟢 Aktif Digunakan' : '⚪ Nonaktif'}
                  </p>
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
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Referensi'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
