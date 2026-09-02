import { BookOpen, Calendar, CheckCircle2, ChevronLeft, ChevronRight, Clock3, GraduationCap, Pencil, Plus, Save, Trash2, UsersRound, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type ApiRecord } from '../services/api';

export interface ScheduleItem {
  id?: number;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  class_id?: number | string;
  sifir: string;
  teacher_id?: number | string;
  guru: string;
  ruangan?: string;
  status: 'Aktif' | 'Nonaktif';
}

interface ComplexMapelFormProps {
  initialData?: ApiRecord | null;
  onClose: () => void;
  onSave: () => void;
}

const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad'];

function text(value: unknown, fallback = ''): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function ComplexMapelForm({ initialData, onClose, onSave }: ComplexMapelFormProps) {
  // Main form state
  const [form, setForm] = useState<{
    id?: number;
    nama: string;
    kode: string;
    status: 'Aktif' | 'Nonaktif';
    jadwals: ScheduleItem[];
  }>({
    id: initialData?.id ? num(initialData.id) : undefined,
    nama: text(initialData?.nama),
    kode: text(initialData?.kode),
    status: text(initialData?.status, 'Aktif') === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
    jadwals: Array.isArray(initialData?.jadwal)
      ? (initialData.jadwal as ApiRecord[]).map((j) => ({
          id: j.id ? num(j.id) : undefined,
          hari: text(j.hari, 'Senin'),
          jam_mulai: text(j.jam_mulai, '07:00'),
          jam_selesai: text(j.jam_selesai, '08:30'),
          class_id: j.class_id ? num(j.class_id) : undefined,
          sifir: text(j.sifir ?? (j.class as ApiRecord)?.name ?? (j.class as ApiRecord)?.nama, 'Kelas Utama'),
          teacher_id: j.teacher_id ? num(j.teacher_id) : undefined,
          guru: text(j.guru ?? (j.teacher as ApiRecord)?.name, 'Ustadz Pengajar'),
          ruangan: text(j.ruangan, ''),
          status: text(j.status, 'Aktif') === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
        }))
      : []
  });

  // Supporting master data
  const [teachers, setTeachers] = useState<ApiRecord[]>([]);
  const [classes, setClasses] = useState<ApiRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'mapel' | 'jadwal'>('mapel');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // New Schedule Draft State
  const [newSchedule, setNewSchedule] = useState<{
    hari: string;
    jam_mulai: string;
    jam_selesai: string;
    class_id: string;
    sifir: string;
    teacher_id: string;
    ruangan: string;
  }>({
    hari: 'Senin',
    jam_mulai: '07:00',
    jam_selesai: '08:30',
    class_id: '',
    sifir: '',
    teacher_id: '',
    ruangan: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Load teachers and classes
  useEffect(() => {
    async function loadMaster() {
      try {
        const [teacherRes, classRes] = await Promise.all([
          api.users({ role: 'guru', status: 'Aktif' }),
          api.classes()
        ]);
        const teacherList = Array.isArray(teacherRes.data) ? teacherRes.data : [];
        const classList = Array.isArray(classRes.data) ? classRes.data : [];
        setTeachers(teacherList);
        setClasses(classList);

        // Pre-select default class and teacher for schedule draft if available
        if (classList.length > 0) {
          setNewSchedule((prev) => ({
            ...prev,
            class_id: String(classList[0].id),
            sifir: String(classList[0].name ?? classList[0].nama ?? ''),
          }));
        }
        if (teacherList.length > 0) {
          setNewSchedule((prev) => ({
            ...prev,
            teacher_id: String(teacherList[0].id),
          }));
        }
      } catch {
        // master load fallback
      }
    }
    void loadMaster();
  }, []);

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  useEffect(() => {
    scrollToTop();
  }, [activeTab]);

  const handleEditSchedule = (index: number) => {
    const item = form.jadwals[index];
    if (!item) return;

    setEditingIndex(index);
    setNewSchedule({
      hari: item.hari,
      jam_mulai: item.jam_mulai.length >= 5 ? item.jam_mulai.slice(0, 5) : item.jam_mulai,
      jam_selesai: item.jam_selesai.length >= 5 ? item.jam_selesai.slice(0, 5) : item.jam_selesai,
      class_id: item.class_id ? String(item.class_id) : '',
      sifir: item.sifir || '',
      teacher_id: item.teacher_id ? String(item.teacher_id) : '',
      ruangan: item.ruangan || '',
    });

    scrollToTop();
  };

  const handleCancelEditSchedule = () => {
    setEditingIndex(null);
    setNewSchedule((prev) => ({
      ...prev,
      ruangan: '',
    }));
  };

  const handleSaveScheduleSlot = () => {
    setError('');
    if (!newSchedule.jam_mulai || !newSchedule.jam_selesai) {
      setError('Jam mulai dan jam selesai jadwal wajib diisi.');
      return;
    }
    if (newSchedule.jam_mulai >= newSchedule.jam_selesai) {
      setError('Jam selesai harus lebih besar dari jam mulai.');
      return;
    }

    const selClass = classes.find((c) => String(c.id) === String(newSchedule.class_id));
    const selTeacher = teachers.find((t) => String(t.id) === String(newSchedule.teacher_id));

    const item: ScheduleItem = {
      ...(editingIndex !== null && form.jadwals[editingIndex]?.id ? { id: form.jadwals[editingIndex].id } : {}),
      hari: newSchedule.hari,
      jam_mulai: newSchedule.jam_mulai,
      jam_selesai: newSchedule.jam_selesai,
      class_id: newSchedule.class_id ? Number(newSchedule.class_id) : undefined,
      sifir: selClass ? String(selClass.name ?? selClass.nama ?? '') : (newSchedule.sifir || 'Kelas Utama'),
      teacher_id: newSchedule.teacher_id ? Number(newSchedule.teacher_id) : undefined,
      guru: selTeacher ? String(selTeacher.name ?? '') : 'Ustadz Pengajar',
      ruangan: newSchedule.ruangan.trim() || undefined,
      status: 'Aktif',
    };

    setForm((prev) => {
      if (editingIndex !== null) {
        const nextList = [...prev.jadwals];
        nextList[editingIndex] = item;
        return { ...prev, jadwals: nextList };
      } else {
        return { ...prev, jadwals: [...prev.jadwals, item] };
      }
    });

    setEditingIndex(null);

    // Reset draft fields except day & class for easy consecutive entry
    setNewSchedule((prev) => ({
      ...prev,
      ruangan: '',
    }));
  };

  const handleRemoveSchedule = (index: number) => {
    if (editingIndex === index) {
      setEditingIndex(null);
    }
    setForm((prev) => ({
      ...prev,
      jadwals: prev.jadwals.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;

    if (!form.nama.trim()) {
      setError('Nama mata pelajaran wajib diisi.');
      setActiveTab('mapel');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      // Auto-derive teacher IDs directly from schedules
      const derivedGuruIds = Array.from(
        new Set(
          form.jadwals
            .map((j) => (j.teacher_id ? Number(j.teacher_id) : null))
            .filter((id): id is number => id !== null && id > 0)
        )
      );

      const payload: ApiRecord = {
        nama: form.nama.trim(),
        kode: form.kode.trim() || null,
        status: form.status,
        guru_ids: derivedGuruIds,
        jadwals: form.jadwals.map((j) => ({
          ...(j.id ? { id: j.id } : {}),
          hari: j.hari,
          jam_mulai: j.jam_mulai,
          jam_selesai: j.jam_selesai,
          class_id: j.class_id ? Number(j.class_id) : null,
          sifir: j.sifir,
          teacher_id: j.teacher_id ? Number(j.teacher_id) : null,
          guru: j.guru,
          ruangan: j.ruangan || null,
          status: j.status,
        })),
      };

      if (form.id) {
        await api.updateMataPelajaran(form.id, payload);
      } else {
        await api.createMataPelajaran(payload);
      }

      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'mapel' } }));
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSave();
      }, 500);
    } catch (err) {

      setError(err instanceof Error ? err.message : 'Gagal menyimpan mata pelajaran & jadwal.');
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full flex-1">
      {/* Modern Top-Right Floating Toast Notification */}
      {isSuccess && (
        <div className="fixed top-5 right-5 z-[99999] flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-2xl border border-emerald-200 shadow-emerald-900/15 transition-all animate-in fade-in slide-in-from-top-4 duration-300 max-w-sm">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
            <CheckCircle2 size={24} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-800">Berhasil Disimpan!</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {form.id
                ? 'Mata pelajaran & jadwal berhasil diperbarui.'
                : 'Mata pelajaran baru & jadwal berhasil ditambahkan.'}
            </p>
          </div>
        </div>
      )}

      <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#2D3436]">
              {form.id ? 'Edit Mata Pelajaran & Jadwal KBM' : 'Tambah Mata Pelajaran & Jadwal Baru'}
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-[#636E72] mt-0.5">
              Atur nama mapel, guru pengajar resmi, dan susun slot jadwal & jam pelajaran dalam satu form terpadu.
            </p>
          </div>
          <button
            className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors shrink-0"
            onClick={onClose}
            type="button"
            disabled={isSuccess}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab('mapel')}
            className={`flex items-center gap-2.5 border-b-2 py-3.5 text-xs sm:text-sm font-black transition-colors ${
              activeTab === 'mapel'
                ? 'border-[#138F81] text-[#138F81]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen size={16} />
            <span>I. Informasi Mata Pelajaran</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('jadwal')}
            className={`flex items-center gap-2.5 border-b-2 py-3.5 px-4 text-xs sm:text-sm font-black transition-colors ${
              activeTab === 'jadwal'
                ? 'border-[#138F81] text-[#138F81]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar size={16} />
            <span>II. Jadwal & Jam Pelajaran</span>
            {form.jadwals.length > 0 && (
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                {form.jadwals.length} Jadwal
              </span>
            )}
          </button>
        </div>

        {/* Form Body with Scroll */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {error && (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs sm:text-sm font-bold text-rose-700">
              ⚠️ {error}
            </div>
          )}

          {/* TAB 1: INFORMASI MATA PELAJARAN */}
          {activeTab === 'mapel' && (
            <div className="max-w-4xl space-y-6 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 sm:p-6 space-y-5">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-800 flex items-center gap-2">
                  <BookOpen className="text-[#138F81]" size={18} /> Detail Mata Pelajaran
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                      Nama Mata Pelajaran <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 placeholder-slate-400 focus:border-[#138F81] focus:ring-2 focus:ring-[#138F81]/20 outline-none"
                      placeholder="Contoh: AKHLAQ, NAHWU, FIQIH..."
                      value={form.nama}
                      onChange={(e) => setForm({ ...form, nama: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                      Kode Pelajaran (Opsional)
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 placeholder-slate-400 focus:border-[#138F81] focus:ring-2 focus:ring-[#138F81]/20 outline-none uppercase"
                      placeholder="Contoh: AKH, NHW, FQH..."
                      value={form.kode}
                      onChange={(e) => setForm({ ...form, kode: e.target.value.toUpperCase() })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    Status Mata Pelajaran
                  </label>
                  <div className="flex gap-2">
                    {(['Aktif', 'Nonaktif'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setForm({ ...form, status: st })}
                        className={`flex-1 rounded-xl py-2.5 text-xs font-extrabold transition-all ${
                          form.status === st
                            ? st === 'Aktif'
                              ? 'bg-[#138F81] text-white shadow-sm shadow-[#138F81]/30'
                              : 'bg-rose-500 text-white shadow-sm'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <div className="rounded-2xl border border-teal-200/80 bg-teal-50/50 p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#138F81] text-white">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-black text-slate-800">Tahap Selanjutnya: Atur Jadwal & Guru</p>
                      <p className="text-[11px] font-semibold text-slate-500">
                        Hubungkan guru pengajar langsung saat menyusun jadwal slot hari & jam di Tab II.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('jadwal')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#138F81] px-4 py-2 text-xs font-black text-white hover:bg-[#0f766a] transition-all shadow-sm"
                  >
                    Buka Jadwal Pelajaran <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: JADWAL & JAM PELAJARAN */}
          {activeTab === 'jadwal' && (
            <div className="max-w-4xl space-y-6 animate-in fade-in duration-200">
              {/* Form Tambah / Edit Slot Jadwal */}
              <div className={`rounded-2xl border p-5 sm:p-6 space-y-4 transition-all ${
                editingIndex !== null
                  ? 'border-amber-300 bg-amber-50/40 ring-1 ring-amber-300/60'
                  : 'border-teal-200/80 bg-teal-50/40'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm sm:text-base font-extrabold text-[#138F81] flex items-center gap-2">
                    {editingIndex !== null ? <Pencil size={18} className="text-amber-600" /> : <Plus size={18} />}
                    <span className={editingIndex !== null ? 'text-amber-900' : ''}>
                      {editingIndex !== null ? 'Edit Slot Jadwal KBM' : 'Atur / Tambah Slot Jadwal Baru'}
                    </span>
                  </h3>
                  {editingIndex !== null ? (
                    <span className="rounded-lg bg-amber-100/90 border border-amber-300 px-2.5 py-1 text-xs font-black text-amber-900 animate-pulse">
                      ✏️ Sedang Mengedit Jadwal #{editingIndex + 1}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500">
                      Mata Pelajaran: <b className="text-slate-800">{form.nama || '(Isi di Tab I)'}</b>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                      Hari
                    </label>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:border-[#138F81] outline-none"
                      value={newSchedule.hari}
                      onChange={(e) => setNewSchedule({ ...newSchedule, hari: e.target.value })}
                    >
                      {HARI_LIST.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                      Jam Mulai
                    </label>
                    <input
                      type="time"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:border-[#138F81] outline-none"
                      value={newSchedule.jam_mulai}
                      onChange={(e) => setNewSchedule({ ...newSchedule, jam_mulai: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                      Jam Selesai
                    </label>
                    <input
                      type="time"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:border-[#138F81] outline-none"
                      value={newSchedule.jam_selesai}
                      onChange={(e) => setNewSchedule({ ...newSchedule, jam_selesai: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                      Kelas / Kelompok Belajar
                    </label>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:border-[#138F81] outline-none"
                      value={newSchedule.class_id}
                      onChange={(e) => {
                        const sel = classes.find((c) => String(c.id) === e.target.value);
                        setNewSchedule({
                          ...newSchedule,
                          class_id: e.target.value,
                          sifir: sel ? String(sel.name ?? sel.nama ?? '') : '',
                        });
                      }}
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {classes.map((c) => (
                        <option key={c.id as number} value={c.id as number}>
                          {text(c.name ?? c.nama)} ({text(c.category, 'Madin')})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                      Guru Pengajar
                    </label>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:border-[#138F81] outline-none"
                      value={newSchedule.teacher_id}
                      onChange={(e) => setNewSchedule({ ...newSchedule, teacher_id: e.target.value })}
                    >
                      <option value="">-- Pilih Guru --</option>
                      {teachers.map((t) => (
                        <option key={t.id as number} value={t.id as number}>
                          {text(t.name)} {t.kode_guru ? `(${t.kode_guru})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                      Ruangan (Opsional)
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 placeholder-slate-400 focus:border-[#138F81] outline-none"
                      placeholder="Ruang 1 / Lab / Musholla"
                      value={newSchedule.ruangan}
                      onChange={(e) => setNewSchedule({ ...newSchedule, ruangan: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  {editingIndex !== null && (
                    <button
                      type="button"
                      onClick={handleCancelEditSchedule}
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      Batal Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveScheduleSlot}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#138F81] px-4 py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-[#138F81]/25 hover:bg-[#0f766a] transition-all cursor-pointer"
                  >
                    {editingIndex !== null ? (
                      <>
                        <Save size={16} /> Simpan Perubahan Jadwal
                      </>
                    ) : (
                      <>
                        <Plus size={16} /> Tambahkan ke Daftar Jadwal
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* List Jadwal Tersusun */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <Clock3 className="text-slate-500" size={16} /> Daftar Jadwal Aktif ({form.jadwals.length})
                  </h4>
                  <span className="text-xs font-semibold text-slate-400">
                    1 Guru bisa mengajar di berbagai hari & jam berbeda
                  </span>
                </div>

                {form.jadwals.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                    <Calendar className="mx-auto text-slate-300 mb-2" size={32} />
                    <p className="text-sm font-bold text-slate-500">Belum ada slot jadwal yang ditambahkan.</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Gunakan form di atas untuk memasang hari, jam, kelas, dan guru pengajar.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {form.jadwals.map((jadwal, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 shadow-sm transition-all ${
                          editingIndex === idx
                            ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-300'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-black text-xs ${
                            editingIndex === idx ? 'bg-amber-200 text-amber-900' : 'bg-teal-50 text-[#138F81]'
                          }`}>
                            {jadwal.hari.slice(0, 3)}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-extrabold text-sm text-slate-800">
                                {jadwal.hari}, {jadwal.jam_mulai} - {jadwal.jam_selesai}
                              </span>
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-700">
                                🏫 {jadwal.sifir}
                              </span>
                              {jadwal.ruangan && (
                                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                                  🚪 {jadwal.ruangan}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-1.5">
                              <GraduationCap size={13} className="text-[#138F81]" />
                              <span>Guru: <b>{jadwal.guru}</b></span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEditSchedule(idx)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                              editingIndex === idx
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-[#EAF4FF] text-[#2E86DE] hover:bg-[#d8ecff]'
                            }`}
                            title="Edit slot jadwal ini"
                          >
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveSchedule(idx)}
                            className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-colors cursor-pointer"
                            title="Hapus slot jadwal ini"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div>
            {activeTab === 'jadwal' && (
              <button
                type="button"
                onClick={() => setActiveTab('mapel')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft size={16} /> Kembali ke Informasi Mapel
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving || isSuccess}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>

            {activeTab === 'mapel' ? (
              <button
                type="button"
                onClick={() => {
                  if (!form.nama.trim()) {
                    setError('Nama mata pelajaran wajib diisi.');
                    return;
                  }
                  setError('');
                  setActiveTab('jadwal');
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#138F81] px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-[#138F81]/25 hover:bg-[#0f766a] transition-all"
              >
                <span>Lanjut ke II. Jadwal & Jam Pelajaran</span>
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isSaving || isSuccess}
                className="inline-flex items-center gap-2 rounded-xl bg-[#138F81] px-6 py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-[#138F81]/25 hover:bg-[#0f766a] transition-all disabled:opacity-50"
              >
                <Save size={16} />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Mata Pelajaran & Jadwal'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
