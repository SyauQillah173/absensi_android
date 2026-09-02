import {
  Bed,
  Building2,
  Check,
  CheckCircle2,
  DoorOpen,
  Plus,
  Save,
  Search,
  Sparkles,
  UserCheck,
  UsersRound,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { SearchInput } from './SearchInput';
import { api, type ApiRecord } from '../services/api';

function text(value: unknown, fallback = ''): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bool(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 0 || value === '0' || String(value).toLowerCase() === 'false') return false;
  if (value === 1 || value === '1' || String(value).toLowerCase() === 'true') return true;
  return fallback;
}

function record(value: unknown): ApiRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ApiRecord) : {};
}

function roomsOf(complex: ApiRecord): ApiRecord[] {
  return Array.isArray(complex.rooms) ? (complex.rooms as ApiRecord[]) : [];
}

/* =========================================================================
   1. KOMPLEK ASRAMA IN-PAGE FORM
   ========================================================================= */
export function ComplexKomplekForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: ApiRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(text(initial?.name, ''));
  const [description, setDescription] = useState(text(initial?.description, ''));
  const [isActive, setIsActive] = useState(bool(initial?.is_active));
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;
    if (!name.trim()) {
      setError('Nama komplek asrama wajib diisi.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const payload = { name: name.trim(), description: description.trim(), is_active: isActive };
      if (initial?.id) {
        await api.updateBoardingComplex(num(initial.id), payload);
      } else {
        await api.createBoardingComplex(payload);
      }

      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'pondok' } }));
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSaved();
        onClose();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Komplek gagal disimpan');
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
              Data komplek asrama {name} berhasil diperbarui.
            </p>
          </div>
        </div>
      )}

      <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#138F81] text-white shadow-md shadow-[#138F81]/20">
              <Building2 size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#2D3436]">
                {initial?.id ? 'Edit Data Komplek Asrama' : 'Tambah Komplek Asrama Baru'}
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-[#636E72]">
                Pengelompokan gedung / blok hunian santri Pondok Pesantren Qomaruddin.
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

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs sm:text-sm font-bold text-rose-700">
              ⚠️ {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 sm:p-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Nama Komplek / Gedung <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Komplek A (Sunan Kalijaga), Asrama Putri Khodijah..."
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Keterangan / Catatan Gedung
                  </label>
                  <textarea
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all min-h-24 resize-none"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Keterangan peruntukan kamar, santri putra/putri, atau fasilitas komplek..."
                  />
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-white p-4 border border-slate-200">
                  <div>
                    <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Status Komplek</p>
                    <p className="text-[11px] font-semibold text-slate-400">Aktifkan agar komplek ini bisa dipilih pada pembagian kamar.</p>
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

            {/* Kolom Kanan: Live Preview Card */}
            <div className="space-y-4">
              <div className="rounded-3xl border border-teal-100 bg-linear-to-b from-teal-50/60 to-white p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-teal-100/80 pb-3">
                  <Sparkles size={18} className="text-[#138F81]" />
                  <h3 className="text-xs font-black text-[#138F81] uppercase tracking-wider">
                    Pratinjau Komplek Asrama
                  </h3>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 shadow-xs">
                  <span className="rounded-md bg-teal-100 text-[#138F81] font-black text-[10px] px-2 py-0.5 uppercase">
                    {isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                  <p className="text-base font-black text-slate-900 mt-1">{name || 'Nama Komplek'}</p>
                  <p className="text-xs font-semibold text-slate-500 line-clamp-2">
                    {description || 'Belum ada keterangan gedung.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Action */}
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
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Komplek'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   2. KAMAR PONDOK IN-PAGE FORM
   ========================================================================= */
export function ComplexKamarForm({
  complexes,
  initial,
  onClose,
  onSaved,
}: {
  complexes: ApiRecord[];
  initial: ApiRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialComplex = num(initial?.boarding_complex_id ?? record(initial?.complex).id ?? complexes[0]?.id);
  const [complexId, setComplexId] = useState(initialComplex);
  const [name, setName] = useState(text(initial?.name, ''));
  const [capacity, setCapacity] = useState(text(initial?.capacity, ''));
  const [isActive, setIsActive] = useState(bool(initial?.is_active));
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const selectedComplex = useMemo(() => {
    return complexes.find((c) => num(c.id) === complexId) ?? complexes[0];
  }, [complexes, complexId]);

  const submit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;
    if (!name.trim()) {
      setError('Nama atau nomor kamar wajib diisi.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const payload = {
        boarding_complex_id: complexId,
        name: name.trim(),
        capacity: capacity ? Number(capacity) : null,
        is_active: isActive,
      };

      if (initial?.id) {
        await api.updateBoardingRoom(num(initial.id), payload);
      } else {
        await api.createBoardingRoom(payload);
      }

      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'pondok' } }));
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSaved();
        onClose();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kamar gagal disimpan');
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
              Data kamar {name} di {selectedComplex ? text(selectedComplex.name) : 'pondok'} tersimpan.
            </p>
          </div>
        </div>
      )}

      <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#138F81] text-white shadow-md shadow-[#138F81]/20">
              <DoorOpen size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#2D3436]">
                {initial?.id ? 'Edit Data Kamar Pondok' : 'Tambah Kamar Pondok Baru'}
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-[#636E72]">
                Pengaturan nomor kamar, gedung komplek, dan kapasitas daya tampung santri.
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

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs sm:text-sm font-bold text-rose-700">
              ⚠️ {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 sm:p-6 space-y-4">
                {/* Pilih Komplek */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Pilih Komplek Asrama <span className="text-rose-500">*</span>
                  </label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#138F81] focus:outline-hidden cursor-pointer"
                    value={complexId}
                    onChange={(e) => setComplexId(Number(e.target.value))}
                    required
                  >
                    {complexes.map((c) => (
                      <option key={num(c.id)} value={num(c.id)}>
                        {text(c.name)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Nama / Nomor Kamar */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Nama / Nomor Kamar <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Kamar 01, Al-Faruq 03..."
                    required
                  />
                </div>

                {/* Kapasitas */}
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Kapasitas Maksimal Santri
                  </label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                    type="number"
                    min="1"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ''))}
                    placeholder="Contoh: 12 santri"
                  />
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    Kapasitas akan digunakan untuk mendeteksi kamar penuh atau masih tersedia.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-white p-4 border border-slate-200">
                  <div>
                    <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Status Kamar</p>
                    <p className="text-[11px] font-semibold text-slate-400">Kamar aktif dapat ditempati dan dipilih dalam penempatan santri.</p>
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

            {/* Kolom Kanan: Live Preview Card */}
            <div className="space-y-4">
              <div className="rounded-3xl border border-teal-100 bg-linear-to-b from-teal-50/60 to-white p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-teal-100/80 pb-3">
                  <Sparkles size={18} className="text-[#138F81]" />
                  <h3 className="text-xs font-black text-[#138F81] uppercase tracking-wider">
                    Kartu Kamar Santri
                  </h3>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-teal-100 text-[#138F81] font-black text-[10px] px-2 py-0.5 uppercase">
                      {selectedComplex ? text(selectedComplex.name) : 'Komplek'}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {isActive ? '🟢 Aktif' : '⚪ Nonaktif'}
                    </span>
                  </div>

                  <p className="text-lg font-black text-slate-900">{name || 'Nama Kamar'}</p>

                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <Bed size={16} className="text-[#138F81]" />
                    <span>Kapasitas: {capacity ? `${capacity} Santri` : 'Belum dibatasi'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Action */}
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
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Kamar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   3. ATUR PENEMPATAN SANTRI PONDOK IN-PAGE FORM
   ========================================================================= */
export function ComplexAssignSantriInPageForm({
  complexes,
  students,
  santri,
  onClose,
  onSaved,
}: {
  complexes: ApiRecord[];
  students: ApiRecord[];
  santri: ApiRecord[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [complexId, setComplexId] = useState(num(complexes[0]?.id));
  const selectedComplex = complexes.find((row) => num(row.id) === complexId) ?? complexes[0];
  const availableRooms = roomsOf(selectedComplex ?? {});
  const [roomId, setRoomId] = useState(num(availableRooms[0]?.id));
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isResident, setIsResident] = useState(true);
  const [participatesPrayer, setParticipatesPrayer] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const r = roomsOf(selectedComplex ?? {});
    setRoomId(num(r[0]?.id));
    setSelectedIds(new Set());
  }, [complexId]);

  const activeSantriIds = useMemo(
    () =>
      new Set(
        santri
          .filter((row) => text(row.status).toLowerCase() !== 'nonaktif' && row.is_active !== false)
          .map((row) => num(row.siswa_id ?? record(row.siswa).id))
      ),
    [santri]
  );

  const availableStudents = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return students
      .filter((student) => !activeSantriIds.has(num(student.id)))
      .filter((student) => {
        if (!keyword) return true;
        const nama = String(student.nama ?? student.name ?? '').toLowerCase();
        const nis = String(student.nis ?? '').toLowerCase();
        const kelas = String(student.kelas ?? '').toLowerCase();
        return nama.includes(keyword) || nis.includes(keyword) || kelas.includes(keyword);
      });
  }, [activeSantriIds, search, students]);

  function toggle(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const submit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;
    if (!roomId || selectedIds.size === 0) {
      setError('Pilih kamar tujuan dan minimal satu santri yang ditempatkan.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await api.assignBoardingStudents({
        boarding_room_id: roomId,
        siswa_ids: Array.from(selectedIds),
        status: 'Aktif',
        is_resident: isResident,
        participates_prayer: participatesPrayer,
      });

      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'pondok' } }));
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSaved();
        onClose();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Santri pondok gagal disimpan');
      setIsSaving(false);
    }
  };

  const selectedRoom = availableRooms.find((r) => num(r.id) === roomId);

  return (
    <div className="w-full flex-1 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {isSuccess && (
        <div className="fixed top-5 right-5 z-[99999] flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-2xl border border-emerald-200 shadow-emerald-900/15 transition-all animate-in fade-in slide-in-from-top-4 duration-300 max-w-sm">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
            <CheckCircle2 size={24} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-800">Berhasil Ditempatkan!</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {selectedIds.size} santri berhasil dimasukkan ke kamar {selectedRoom ? text(selectedRoom.name) : ''}.
            </p>
          </div>
        </div>
      )}

      <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#138F81] text-white shadow-md shadow-[#138F81]/20">
              <UserCheck size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#2D3436]">
                Atur Penempatan Kamar Santri Pondok
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-[#636E72]">
                Pilih komplek, kamar asrama, dan centang santri yang akan menempati kamar tersebut.
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

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs sm:text-sm font-bold text-rose-700">
              ⚠️ {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              {/* Step 1: Pilih Lokasi Kamar */}
              <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-3">
                  <Building2 size={18} className="text-[#138F81]" />
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    I. Pilih Komplek & Kamar Tujuan
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Komplek Asrama <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#138F81] focus:outline-hidden cursor-pointer"
                      value={complexId}
                      onChange={(e) => setComplexId(Number(e.target.value))}
                      required
                    >
                      {complexes.map((c) => (
                        <option key={num(c.id)} value={num(c.id)}>
                          {text(c.name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Kamar Tujuan <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#138F81] focus:outline-hidden cursor-pointer"
                      value={roomId}
                      onChange={(e) => setRoomId(Number(e.target.value))}
                      required
                    >
                      {availableRooms.map((r) => (
                        <option key={num(r.id)} value={num(r.id)}>
                          {text(r.name)} (Kapasitas: {num(r.capacity) ? `${num(r.capacity)} santri` : 'Bebas'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Step 2: Pilih Santri */}
              <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <UsersRound size={18} className="text-[#138F81]" />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      II. Pilih Santri ({selectedIds.size} Dipilih)
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set(availableStudents.map((s) => num(s.id))))}
                      className="text-xs font-black text-[#138F81] hover:underline"
                    >
                      Pilih Semua ({availableStudents.length})
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set())}
                      className="text-xs font-black text-rose-600 hover:underline"
                    >
                      Bersihkan
                    </button>
                  </div>
                </div>

                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Cari nama santri, NIS, atau kelas..."
                />

                <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 divide-y divide-slate-100">
                  {availableStudents.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs font-bold text-slate-400">
                      Semua santri yang cocok sudah memiliki kamar aktif di pondok.
                    </div>
                  ) : (
                    availableStudents.map((student) => {
                      const id = num(student.id);
                      const isChecked = selectedIds.has(id);
                      return (
                        <label
                          key={id}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                            isChecked ? 'bg-teal-50/80 ring-1 ring-[#138F81]/20' : 'hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggle(id)}
                            className="h-4 w-4 rounded-md border-slate-300 text-[#138F81] focus:ring-[#138F81]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-black text-slate-800 truncate">
                              {text(student.nama ?? student.name)}
                            </p>
                            <p className="text-[11px] font-semibold text-slate-400">
                              NIS: {text(student.nis)} • Kelas: {text(student.kelas, 'Umum')}
                            </p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Kolom Kanan: Detail & Status */}
            <div className="space-y-4">
              <div className="rounded-3xl border border-teal-100 bg-linear-to-b from-teal-50/60 to-white p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-teal-100/80 pb-3">
                  <Sparkles size={18} className="text-[#138F81]" />
                  <h3 className="text-xs font-black text-[#138F81] uppercase tracking-wider">
                    Ringkasan Penempatan
                  </h3>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5">
                  <div className="text-xs font-bold text-slate-500">Kamar Tujuan:</div>
                  <div className="text-base font-black text-slate-900">
                    {selectedRoom ? text(selectedRoom.name) : 'Belum Dipilih'}
                  </div>
                  <div className="text-xs font-semibold text-slate-500">
                    Komplek: {selectedComplex ? text(selectedComplex.name) : '-'}
                  </div>

                  <div className="mt-2 rounded-xl bg-teal-50 p-2.5 text-center border border-teal-100">
                    <span className="text-2xl font-black text-[#138F81]">{selectedIds.size}</span>
                    <p className="text-[11px] font-bold text-teal-800">Santri Siap Ditempatkan</p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="flex items-center justify-between rounded-2xl bg-white p-3.5 border border-slate-200 cursor-pointer">
                    <span className="text-xs font-bold text-slate-700">Penghuni Pondok Utama</span>
                    <input
                      type="checkbox"
                      checked={isResident}
                      onChange={(e) => setIsResident(e.target.checked)}
                      className="h-4 w-4 rounded-md border-slate-300 text-[#138F81] focus:ring-[#138F81]"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-2xl bg-white p-3.5 border border-slate-200 cursor-pointer">
                    <span className="text-xs font-bold text-slate-700">Wajib Presensi Sholat Jama'ah</span>
                    <input
                      type="checkbox"
                      checked={participatesPrayer}
                      onChange={(e) => setParticipatesPrayer(e.target.checked)}
                      className="h-4 w-4 rounded-md border-slate-300 text-[#138F81] focus:ring-[#138F81]"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Action */}
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
            disabled={isSaving || selectedIds.size === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-[#138F81] px-6 py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-[#138F81]/25 hover:bg-[#0f766a] transition-all disabled:opacity-50"
          >
            <Save size={16} />
            <span>{isSaving ? 'Menyimpan...' : `Simpan ${selectedIds.size} Santri`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   4. IMPORT SANTRI PONDOK IN-PAGE FORM
   ========================================================================= */
export function ComplexImportSantriForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!file) {
      setError('Silakan pilih file Excel terlebih dahulu.');
      return;
    }
    setIsUploading(true);
    setError('');

    try {
      const response = await api.importBoardingSantri(file);
      if (response.success) {
        window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'pondok' } }));
        setIsSuccess(true);
        setTimeout(() => {
          setIsSuccess(false);
          onSaved();
          onClose();
        }, 500);
      } else {
        setError(response.message ?? 'Gagal mengimport data santri pondok.');
        setIsUploading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat upload file.');
      setIsUploading(false);
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
            <p className="text-sm font-black text-slate-800">Import Berhasil!</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Data santri pondok berhasil diperbarui secara massal.
            </p>
          </div>
        </div>
      )}

      <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E67E22] text-white shadow-md shadow-[#E67E22]/20">
              <Building2 size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#2D3436]">
                Import Data Santri Pondok via Excel
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-[#636E72]">
                Upload file spreadsheet (.xlsx, .xls, .csv) untuk memasukkan data kamar santri sekaligus secara massal.
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-3xl">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs sm:text-sm font-bold text-rose-700">
              ⚠️ {error}
            </div>
          )}

          <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-8 sm:p-12 text-center space-y-4">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-2xl file:border-0 file:bg-[#138F81] file:px-5 file:py-2.5 file:text-sm file:font-black file:text-white hover:file:bg-[#0f766a] file:cursor-pointer cursor-pointer"
            />
            {file && (
              <p className="text-xs font-black text-[#138F81]">
                📄 File Terpilih: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
            <p className="text-xs font-semibold text-slate-400">
              Format yang didukung: .xlsx, .xls, .csv • Ukuran maksimal: 5MB
            </p>
          </div>

          <div className="rounded-2xl bg-teal-50/80 p-4 border border-teal-100 text-xs font-semibold text-teal-900 leading-relaxed space-y-1">
            <p className="font-black text-[#138F81]">💡 Tips Format Excel:</p>
            <p>Pastikan file Excel memiliki kolom NIS, Nama Santri, Nama Komplek, dan Nama Kamar yang sesuai dengan data master di sistem.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={isUploading || !file}
            className="inline-flex items-center gap-2 rounded-xl bg-[#138F81] px-6 py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-[#138F81]/25 hover:bg-[#0f766a] transition-all disabled:opacity-50"
          >
            <Save size={16} />
            <span>{isUploading ? 'Mengupload...' : 'Proses Import Data'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

