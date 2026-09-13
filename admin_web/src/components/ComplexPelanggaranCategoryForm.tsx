import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Coins,
  Gavel,
  Layers,
  Save,
  Shield,
  X
} from 'lucide-react';
import React, { FormEvent, useState } from 'react';
import { api, type ApiRecord } from '../services/api';

interface PelanggaranCategoryFormProps {
  initialData?: ApiRecord | null;
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

export function ComplexPelanggaranCategoryForm({
  initialData,
  onClose,
  onSave
}: PelanggaranCategoryFormProps) {
  const isEditing = Boolean(initialData && initialData.id);

  const [nama, setNama] = useState(() => text(initialData?.nama_pelanggaran));
  const [tingkat, setTingkat] = useState<'Ringan' | 'Sedang' | 'Berat'>(() => {
    const t = text(initialData?.tingkat, 'Ringan');
    if (t === 'Sedang' || t === 'Berat') return t;
    return 'Ringan';
  });
  const [poin, setPoin] = useState<number>(() => num(initialData?.poin_default, 10));
  const [denda, setDenda] = useState<number>(() => num(initialData?.denda_default, 0));
  const [takzir, setTakzir] = useState(() => text(initialData?.tindakan_rekomendasi));

  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;

    if (!nama.trim()) {
      setError('Nama master kategori pelanggaran wajib diisi.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const payload = {
        nama_pelanggaran: nama.trim(),
        tingkat,
        poin_default: Number(poin),
        denda_default: Number(denda),
        tindakan_rekomendasi: takzir.trim() || undefined
      };

      if (isEditing && initialData?.id) {
        await api.updatePelanggaranKategori(num(initialData.id), payload);
      } else {
        await api.storePelanggaranKategori(payload);
      }

      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'pelanggaran_kategori' } }));
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSave();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan kategori pelanggaran.');
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
            <p className="text-sm font-black text-slate-800">Kategori Berhasil Disimpan!</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Master aturan pelanggaran telah diperbarui dan siap digunakan.
            </p>
          </div>
        </div>
      )}

      {/* Frame Kontainer In-Page Form */}
      <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
        {/* Header Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer shrink-0"
                title="Kembali"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-200/60 text-indigo-600 shadow-sm shrink-0">
                <Layers size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
                    Master Aturan
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">•</span>
                  <span className="text-xs font-bold text-slate-500">Standarisasi Tata Tertib</span>
                </div>
                <h1 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
                  {isEditing ? '✏️ Edit Master Kategori Pelanggaran' : '➕ Tambah Master Kategori Pelanggaran Baru'}
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
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body Form */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50/50 q-scrollbar">
          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-5">
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 animate-in fade-in">
                <div className="flex items-center gap-2 font-black text-sm">
                  <AlertTriangle size={18} />
                  <span>Kesalahan Validasi</span>
                </div>
                <p className="text-xs font-semibold mt-1 text-rose-700">{error}</p>
              </div>
            )}

            <div className="rounded-3xl bg-white p-5 sm:p-7 border border-slate-200/80 shadow-xs space-y-5">
              {/* Nama Kategori */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Nama / Jenis Pelanggaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Merokok di Lingkungan Pesantren"
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-[#138F81] focus:bg-white transition"
                />
              </div>

              {/* Tingkat, Poin Default & Denda Default */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Tingkat Pelanggaran
                  </label>
                  <select
                    value={tingkat}
                    onChange={(e) => setTingkat(e.target.value as any)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs sm:text-sm font-extrabold text-slate-800 outline-none focus:border-[#138F81] cursor-pointer"
                  >
                    <option value="Ringan">🟡 Ringan</option>
                    <option value="Sedang">🟠 Sedang</option>
                    <option value="Berat">🔴 Berat</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Poin Default <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={poin}
                    onChange={(e) => setPoin(Number(e.target.value))}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm font-black text-rose-600 outline-none focus:border-[#138F81] focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Denda Default (Rp)
                  </label>
                  <div className="relative">
                    <Coins className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="number"
                      min="0"
                      step="5000"
                      value={denda}
                      onChange={(e) => setDenda(Number(e.target.value))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2.5 text-xs sm:text-sm font-extrabold text-slate-800 outline-none focus:border-[#138F81] focus:bg-white transition"
                    />
                  </div>
                </div>
              </div>

              {/* Rekomendasi Takzir */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Rekomendasi Tindakan Takzir Edukatif
                </label>
                <input
                  type="text"
                  value={takzir}
                  onChange={(e) => setTakzir(e.target.value)}
                  placeholder="Contoh: Piket kebersihan asrama selama 3 hari & setoran hafalan juz amma"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:border-[#138F81] focus:bg-white transition"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-2">
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
                className="inline-flex items-center gap-2 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] px-7 py-3 text-xs sm:text-sm font-black text-white shadow-lg shadow-[#138F81]/25 transition cursor-pointer disabled:opacity-50"
              >
                <Save size={16} />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Kategori Aturan'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
