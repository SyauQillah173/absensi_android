import {
  BookOpen,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GraduationCap,
  Image as ImageIcon,
  Landmark,
  Pencil,
  Plus,
  Save,
  Trash2,
  UsersRound,
  X
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type ApiRecord } from '../services/api';

export interface NgajiScheduleItem {
  id?: number;
  ngaji_session_id?: number;
  sesi?: string;
  ngaji_book_id?: number;
  kitab?: string;
  teacher_id?: number | null;
  pengajar?: string;
  boarding_complex_id?: number | null;
  komplek?: string;
  boarding_room_id?: number | null;
  kamar?: string;
  class_id?: number | null;
  kelas?: string;
  hari?: string;
  start_time: string;
  end_time: string;
  description?: string;
  status: 'Aktif' | 'Nonaktif';
}

interface ComplexNgajiFormProps {
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

function formatTeacherOption(name: string, jenisKelamin?: string): string {
  const clean = text(name);
  if (!clean) return '-';

  // Tentukan icon khas: 🧕 untuk Ustadzah/Bu Nyai, 👳‍♂️ untuk Ustadz/Kiai
  const icon = (jenisKelamin === 'P' || /^(bu\s*nyai|nyai|ning|hj\.|ustadzah)/i.test(clean)) ? '🧕 ' : '👳‍♂️ ';

  // Cek apakah nama sudah memiliki gelar penghormatan (misal: UST., USTADZ, KH., BU NYAI, NYAI, MAS, dll.)
  const alreadyHasTitle = /^(ust|ustadz|ustadzah|kh|k\.h|k\s*h|kyai|kiai|bu\s*nyai|nyai|ning|gus|habib|mas|pak|bapak|ibu|drs|dra|prof|dr)\b/i.test(clean);

  // Jika sudah ada gelar, pertahankan icon + nama asli agar tidak double!
  if (alreadyHasTitle) {
    return `${icon}${clean}`;
  }

  // Jika nama polos tanpa gelar, tambahkan gelar sesuai jenis kelamin
  const prefix = jenisKelamin === 'P' ? 'Ustadzah ' : 'Ustadz ';
  return `${icon}${prefix}${clean}`;
}



function getBookCover(key: string): string | null {
  try {
    return localStorage.getItem(`kitab_img_${key}`);
  } catch {
    return null;
  }
}

function saveBookCover(key: string, base64: string): void {
  try {
    localStorage.setItem(`kitab_img_${key}`, base64);
  } catch {}
}

function removeBookCover(key: string): void {
  try {
    localStorage.removeItem(`kitab_img_${key}`);
  } catch {}
}

export function ComplexNgajiForm({ initialData, onClose, onSave }: ComplexNgajiFormProps) {
  // Main Book Form State
  const [form, setForm] = useState<{
    id?: number;
    name: string;
    code: string;
    method: string;
    description: string;
    is_active: boolean;
    photo_preview: string | null;
    photo_base64: string | null;
    photo_removed: boolean;
    jadwals: NgajiScheduleItem[];
  }>({
    id: initialData?.id ? num(initialData.id) : undefined,
    name: text(initialData?.name),
    code: text(initialData?.code),
    method: text(initialData?.method, 'Maknani'),
    description: text(initialData?.description),
    is_active: initialData?.is_active !== false,
    photo_preview: initialData?.id ? getBookCover(String(initialData.code || initialData.id)) : null,
    photo_base64: null,
    photo_removed: false,
    jadwals: []
  });

  // Supporting master data
  const [sessions, setSessions] = useState<ApiRecord[]>([]);
  const [teachers, setTeachers] = useState<ApiRecord[]>([]);
  const [complexes, setComplexes] = useState<ApiRecord[]>([]);
  const [classes, setClasses] = useState<ApiRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'kitab' | 'jadwal'>('kitab');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deletedScheduleIds, setDeletedScheduleIds] = useState<number[]>([]);

  // Draft Schedule Slot State
  const [newSchedule, setNewSchedule] = useState<{
    ngaji_session_id: string;
    teacher_id: string;
    hari: string;
    start_time: string;
    end_time: string;
    boarding_complex_id: string;
    boarding_room_id: string;
    class_id: string;
    description: string;
    status: 'Aktif' | 'Nonaktif';
  }>({
    ngaji_session_id: '',
    teacher_id: '',
    hari: 'Senin',
    start_time: '05:30',
    end_time: '06:30',
    boarding_complex_id: '',
    boarding_room_id: '',
    class_id: '',
    description: '',
    status: 'Aktif',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Load masters & existing schedules for this book
  useEffect(() => {
    async function loadMaster() {
      try {
        const [sessionRes, teacherRes, complexRes, classRes, scheduleRes] = await Promise.all([
          api.ngajiSessions(),
          api.users({ role: 'guru', status: 'Aktif' }),
          api.boardingComplexes(),
          api.classes(),
          initialData?.id ? api.ngajiSchedules({ ngaji_book_id: Number(initialData.id) }) : Promise.resolve({ data: [] })
        ]);

        const sessionList = Array.isArray(sessionRes.data) ? sessionRes.data : [];
        const teacherList = Array.isArray(teacherRes.data) ? teacherRes.data : [];
        const complexList = Array.isArray(complexRes.data) ? complexRes.data : [];
        const classList = Array.isArray(classRes.data) ? classRes.data : [];
        const scheduleList = Array.isArray(scheduleRes.data) ? (scheduleRes.data as ApiRecord[]) : [];

        setSessions(sessionList);
        setTeachers(teacherList);
        setComplexes(complexList);
        setClasses(classList);

        if (sessionList.length > 0) {
          setNewSchedule((prev) => ({
            ...prev,
            ngaji_session_id: String(sessionList[0].id),
            start_time: String(sessionList[0].start_time || '05:30'),
            end_time: String(sessionList[0].end_time || '06:30'),
          }));
        }

        if (scheduleList.length > 0) {
          setForm((prev) => ({
            ...prev,
            jadwals: scheduleList.map((s) => ({
              id: s.id ? num(s.id) : undefined,
              ngaji_session_id: s.ngaji_session_id ? num(s.ngaji_session_id) : undefined,
              sesi: text(s.sesi ?? (s.session as ApiRecord)?.name, 'Sesi Ngaji'),
              ngaji_book_id: s.ngaji_book_id ? num(s.ngaji_book_id) : undefined,
              kitab: text(s.kitab ?? (s.book as ApiRecord)?.name),
              teacher_id: s.teacher_id ? num(s.teacher_id) : null,
              pengajar: text(s.pengajar ?? (s.teacher as ApiRecord)?.name, 'Ustadz Pengajar'),
              boarding_complex_id: s.boarding_complex_id ? num(s.boarding_complex_id) : null,
              komplek: text(s.komplek ?? (s.complex as ApiRecord)?.name),
              boarding_room_id: s.boarding_room_id ? num(s.boarding_room_id) : null,
              kamar: text(s.kamar ?? (s.room as ApiRecord)?.name),
              class_id: s.class_id ? num(s.class_id) : null,
              kelas: text(s.kelas ?? (s.class as ApiRecord)?.name),
              hari: text(s.hari, 'Senin'),
              start_time: text(s.start_time, '05:30'),
              end_time: text(s.end_time, '06:30'),
              description: text(s.description),
              status: text(s.status, 'Aktif') === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
            }))
          }));
        }
      } catch {}
    }
    void loadMaster();
  }, [initialData]);

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result);
      setForm((prev) => ({
        ...prev,
        photo_base64: base64,
        photo_preview: base64,
        photo_removed: false,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setForm((prev) => ({
      ...prev,
      photo_base64: null,
      photo_preview: null,
      photo_removed: true,
    }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEditSchedule = (index: number) => {
    const item = form.jadwals[index];
    if (!item) return;

    setEditingIndex(index);
    setNewSchedule({
      ngaji_session_id: item.ngaji_session_id ? String(item.ngaji_session_id) : '',
      teacher_id: item.teacher_id ? String(item.teacher_id) : '',
      hari: item.hari || 'Senin',
      start_time: item.start_time || '05:30',
      end_time: item.end_time || '06:30',
      boarding_complex_id: item.boarding_complex_id ? String(item.boarding_complex_id) : '',
      boarding_room_id: item.boarding_room_id ? String(item.boarding_room_id) : '',
      class_id: item.class_id ? String(item.class_id) : '',
      description: item.description || '',
      status: item.status || 'Aktif',
    });

    scrollToTop();
  };

  const handleCancelEditSchedule = () => {
    setEditingIndex(null);
    setNewSchedule((prev) => ({
      ...prev,
      description: '',
    }));
  };

  const handleSaveScheduleSlot = () => {
    setError('');
    if (!newSchedule.start_time || !newSchedule.end_time) {
      setError('Jam mulai dan jam selesai pengajian wajib diisi.');
      return;
    }

    const selSession = sessions.find((s) => String(s.id) === String(newSchedule.ngaji_session_id));
    const selTeacher = teachers.find((t) => String(t.id) === String(newSchedule.teacher_id));
    const selComplex = complexes.find((c) => String(c.id) === String(newSchedule.boarding_complex_id));
    const selClass = classes.find((c) => String(c.id) === String(newSchedule.class_id));

    const item: NgajiScheduleItem = {
      ...(editingIndex !== null && form.jadwals[editingIndex]?.id ? { id: form.jadwals[editingIndex].id } : {}),
      ngaji_session_id: newSchedule.ngaji_session_id ? Number(newSchedule.ngaji_session_id) : undefined,
      sesi: selSession ? String(selSession.name) : 'Sesi Pengajian',
      ngaji_book_id: form.id,
      kitab: form.name,
      teacher_id: newSchedule.teacher_id ? Number(newSchedule.teacher_id) : null,
      pengajar: selTeacher ? String(selTeacher.name) : 'Ustadz Pengajar',
      boarding_complex_id: newSchedule.boarding_complex_id ? Number(newSchedule.boarding_complex_id) : null,
      komplek: selComplex ? String(selComplex.name) : undefined,
      boarding_room_id: newSchedule.boarding_room_id ? Number(newSchedule.boarding_room_id) : null,
      class_id: newSchedule.class_id ? Number(newSchedule.class_id) : null,
      kelas: selClass ? String(selClass.name) : undefined,
      hari: newSchedule.hari,
      start_time: newSchedule.start_time,
      end_time: newSchedule.end_time,
      description: newSchedule.description.trim() || undefined,
      status: newSchedule.status,
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
    setNewSchedule((prev) => ({
      ...prev,
      description: '',
    }));
  };

  const handleRemoveSchedule = (index: number) => {
    const item = form.jadwals[index];
    if (item?.id) {
      setDeletedScheduleIds((prev) => [...prev, item.id!]);
    }
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

    if (!form.name.trim()) {
      setError('Nama kitab kajian wajib diisi.');
      setActiveTab('kitab');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const bookCode = form.code.trim() || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const bookPayload = {
        name: form.name.trim(),
        code: bookCode,
        method: form.method,
        description: form.description.trim() || null,
        is_active: form.is_active,
        sort_order: 0,
      };

      let bookId = form.id;
      if (bookId) {
        await api.updateNgajiBook(bookId, bookPayload);
      } else {
        const createRes = await api.createNgajiBook(bookPayload);
        bookId = num((createRes.data as ApiRecord)?.id);
      }

      // Save/remove local image cover
      if (form.photo_base64) {
        saveBookCover(bookCode, form.photo_base64);
        if (bookId) saveBookCover(String(bookId), form.photo_base64);
      } else if (form.photo_removed) {
        removeBookCover(bookCode);
        if (bookId) removeBookCover(String(bookId));
      }

      // Process deleted schedules
      for (const delId of deletedScheduleIds) {
        try {
          await api.deleteNgajiSchedule(delId);
        } catch {}
      }

      // Process schedule slots
      for (const j of form.jadwals) {
        const schedulePayload = {
          ngaji_session_id: j.ngaji_session_id || (sessions[0]?.id ? Number(sessions[0].id) : 1),
          ngaji_book_id: bookId,
          teacher_id: j.teacher_id || null,
          boarding_complex_id: j.boarding_complex_id || null,
          boarding_room_id: j.boarding_room_id || null,
          class_id: j.class_id || null,
          hari: j.hari || 'Senin',
          start_time: j.start_time,
          end_time: j.end_time,
          description: j.description || null,
          status: j.status,
        };

        if (j.id) {
          await api.updateNgajiSchedule(j.id, schedulePayload);
        } else {
          await api.createNgajiSchedule(schedulePayload);
        }
      }

      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'ngaji' } }));
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSave();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan kitab dan jadwal pengajian.');
      setIsSaving(false);
    }

  };

  const selectedComplex = complexes.find((c) => String(c.id) === String(newSchedule.boarding_complex_id));
  const availableRooms = Array.isArray(selectedComplex?.rooms) ? (selectedComplex?.rooms as ApiRecord[]) : [];

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
              Kitab kajian dan susunan jadwal pengajian berhasil diperbarui.
            </p>
          </div>
        </div>
      )}

      {/* Main In-Page Card Form Container */}
      <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
        {/* HEADER SECTION */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-teal-50/60 via-emerald-50/40 to-white px-6 py-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#138F81] text-white shadow-md shadow-[#138F81]/25">
              <BookOpen size={24} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[#2D3436]">
                {form.id ? 'Edit Kitab & Jadwal Pengajian' : 'Tambah Kitab & Jadwal Pengajian Baru'}
              </h2>
              <p className="text-xs font-semibold text-[#636E72] mt-0.5">
                Atur nama kitab kajian, metode pengajian, ustadz pengajar, dan susun slot jadwal ngaji dalam satu form terpadu.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-2xl p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {/* STEPPER TABS HEADER */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50/80 px-6">
          <button
            type="button"
            onClick={() => setActiveTab('kitab')}
            className={`flex items-center gap-2 border-b-2 py-4 px-3 text-sm font-extrabold transition-all ${
              activeTab === 'kitab'
                ? 'border-[#138F81] text-[#138F81]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen size={16} /> I. Informasi Kitab Kajian
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('jadwal')}
            className={`flex items-center gap-2 border-b-2 py-4 px-3 text-sm font-extrabold transition-all ${
              activeTab === 'jadwal'
                ? 'border-[#138F81] text-[#138F81]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar size={16} /> II. Jadwal & Pengajar Ngaji ({form.jadwals.length} Slot)
          </button>
        </div>

        {/* ERROR MESSAGE */}
        {error && (
          <div className="mx-6 mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800 border border-rose-100 flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* TAB BODY CONTENT */}
        <div ref={scrollContainerRef} className="flex-1 p-6 space-y-6 overflow-y-auto">
          {activeTab === 'kitab' ? (
            /* TAB I: INFORMASI KITAB KAJIAN */
            <div className="space-y-6 max-w-3xl">
              {/* Card 1: Detail Kitab */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-2 text-slate-800 font-extrabold text-base border-b border-slate-100 pb-3">
                  <BookOpen className="text-[#138F81]" size={19} /> Detail Kitab Kajian
                </div>

                {/* Upload Foto Cover Kitab (Offline Client Storage) */}
                <div className="rounded-2xl bg-teal-50/50 p-4 border border-teal-100 flex items-center gap-4">
                  <div className="relative shrink-0">
                    {form.photo_preview ? (
                      <div className="relative group">
                        <img src={form.photo_preview} alt="Cover" className="h-24 w-18 rounded-2xl object-cover border-2 border-[#138F81] shadow-md" />
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-sm hover:bg-rose-600 transition-colors"
                          title="Hapus foto cover"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <div className="h-24 w-18 rounded-2xl bg-teal-100/70 border-2 border-dashed border-[#138F81]/40 flex flex-col items-center justify-center text-[#138F81]">
                        <ImageIcon size={24} />
                        <span className="text-[10px] font-bold mt-1">Cover Kitab</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-extrabold text-slate-800">Foto Cover Kitab (Opsional)</p>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                      Foto cover tersimpan langsung di penyimpanan HP/browser Anda agar cepat, aman, dan hemat server.
                    </p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-xl bg-white px-3.5 py-2 text-xs font-extrabold text-[#138F81] border border-teal-200/80 shadow-2xs hover:bg-teal-50 transition-colors inline-flex items-center gap-1.5"
                      >
                        <Camera size={14} /> {form.photo_preview ? 'Ganti Foto' : 'Pilih Foto Kitab'}
                      </button>
                      {form.photo_preview && (
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="rounded-xl bg-rose-50 px-3.5 py-2 text-xs font-extrabold text-rose-600 hover:bg-rose-100 transition-colors"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </div>
                </div>

                {/* Nama Kitab & Kode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-extrabold text-slate-700">
                      Nama Kitab <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:bg-white focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Contoh: Fathul Qorib, Safinatun Najah..."
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-extrabold text-slate-700">
                      Kode Kitab (Opsional)
                    </label>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-mono font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:bg-white focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      placeholder="Contoh: fathul_qorib (otomatis terisi)"
                    />
                  </div>
                </div>

                {/* Metode Pengajian */}
                <div>
                  <label className="mb-2 block text-xs font-extrabold text-slate-700">
                    Metode Pengajian <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {['Maknani', 'Sorogan', 'Lalaran', 'Mudzakarah'].map((m) => {
                      const isSelected = form.method === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setForm({ ...form, method: m })}
                          className={`rounded-2xl p-3 text-center border transition-all text-xs ${
                            isSelected
                              ? 'bg-[#138F81]/10 border-[#138F81] text-[#138F81] font-black ring-2 ring-[#138F81]/20 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 font-bold'
                          }`}
                        >
                          {m === 'Maknani' ? '📖 Maknani (Bandongan)' : m === 'Sorogan' ? '🗣️ Sorogan' : m === 'Lalaran' ? '✍️ Lalaran / Hafalan' : '💡 Mudzakarah'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Keterangan */}
                <div>
                  <label className="mb-1.5 block text-xs font-extrabold text-slate-700">
                    Keterangan Kitab (Opsional)
                  </label>
                  <textarea
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:bg-white focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all min-h-24 resize-none"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Pengarang kitab, bahasan pokok fiqih / nahwu / akhlaq..."
                  />
                </div>

                {/* Status Aktif */}
                <div>
                  <label className="mb-1.5 block text-xs font-extrabold text-slate-700">
                    Status Kitab
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, is_active: true })}
                      className={`flex-1 rounded-2xl py-2.5 text-xs font-extrabold border transition-all ${
                        form.is_active
                          ? 'bg-[#138F81] text-white border-[#138F81] shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      🟢 Aktif Digunakan
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, is_active: false })}
                      className={`flex-1 rounded-2xl py-2.5 text-xs font-extrabold border transition-all ${
                        !form.is_active
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      ⚪ Nonaktifkan
                    </button>
                  </div>
                </div>
              </div>

              {/* Next Step Card */}
              <div className="rounded-3xl border border-teal-200/80 bg-gradient-to-r from-teal-50/80 via-emerald-50/50 to-white p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#138F81] text-white">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-[#2D3436]">Tahap Selanjutnya: Atur Jadwal & Pengajar</p>
                    <p className="text-xs font-semibold text-[#636E72]">
                      Hubungkan ustadz pengajar dan susun slot waktu pengajian di Tab II.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('jadwal')}
                  className="rounded-2xl bg-[#138F81] px-5 py-2.5 text-xs font-extrabold text-white shadow-md shadow-[#138F81]/20 hover:brightness-105 transition-all inline-flex items-center gap-1.5"
                >
                  Buka Jadwal Pengajian <ChevronRight size={15} />
                </button>
              </div>
            </div>
          ) : (
            /* TAB II: JADWAL & PENGAJAR NGAJI */
            <div className="space-y-6">
              {/* Draft Box: Tambah / Edit Slot Jadwal */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-slate-800 font-extrabold text-base">
                    <Clock3 className="text-[#138F81]" size={19} />
                    {editingIndex !== null ? 'Edit Slot Jadwal Pengajian' : 'Tambah Slot Jadwal Pengajian Baru'}
                  </div>
                  {editingIndex !== null && (
                    <button
                      type="button"
                      onClick={handleCancelEditSchedule}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 underline"
                    >
                      Batal Edit Slot
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Sesi Waktu */}
                  <div>
                    <label className="mb-1.5 block text-xs font-extrabold text-slate-700">
                      Sesi Waktu Ngaji <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#138F81] focus:bg-white focus:outline-hidden"
                      value={newSchedule.ngaji_session_id}
                      onChange={(e) => {
                        const sid = e.target.value;
                        const ses = sessions.find((s) => String(s.id) === sid);
                        setNewSchedule({
                          ...newSchedule,
                          ngaji_session_id: sid,
                          start_time: ses?.start_time ? String(ses.start_time) : newSchedule.start_time,
                          end_time: ses?.end_time ? String(ses.end_time) : newSchedule.end_time,
                        });
                      }}
                    >
                      {sessions.map((s) => (
                        <option key={text(s.id)} value={text(s.id)}>
                          {text(s.name)} ({text(s.start_time, '--:--')} - {text(s.end_time, '--:--')})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Ustadz Pengajar */}
                  <div>
                    <label className="mb-1.5 block text-xs font-extrabold text-slate-700">
                      Ustadz / Ustadzah Pengajar
                    </label>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#138F81] focus:bg-white focus:outline-hidden"
                      value={newSchedule.teacher_id}
                      onChange={(e) => setNewSchedule({ ...newSchedule, teacher_id: e.target.value })}
                    >
                      <option value="">-- Pilih Ustadz Pengajar --</option>
                      {teachers.map((t) => (
                        <option key={text(t.id)} value={text(t.id)}>
                          {formatTeacherOption(text(t.name), text(t.jenis_kelamin))}
                        </option>
                      ))}
                    </select>

                  </div>

                  {/* Hari */}
                  <div>
                    <label className="mb-1.5 block text-xs font-extrabold text-slate-700">Hari Pengajian</label>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#138F81] focus:bg-white focus:outline-hidden"
                      value={newSchedule.hari}
                      onChange={(e) => setNewSchedule({ ...newSchedule, hari: e.target.value })}
                    >
                      {HARI_LIST.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Jam Mulai & Selesai */}
                  <div>
                    <label className="mb-1.5 block text-xs font-extrabold text-slate-700">Jam Mulai</label>
                    <input
                      type="time"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#138F81] focus:bg-white focus:outline-hidden"
                      value={newSchedule.start_time}
                      onChange={(e) => setNewSchedule({ ...newSchedule, start_time: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-extrabold text-slate-700">Jam Selesai</label>
                    <input
                      type="time"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#138F81] focus:bg-white focus:outline-hidden"
                      value={newSchedule.end_time}
                      onChange={(e) => setNewSchedule({ ...newSchedule, end_time: e.target.value })}
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="mb-1.5 block text-xs font-extrabold text-slate-700">Status Slot</label>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#138F81] focus:bg-white focus:outline-hidden"
                      value={newSchedule.status}
                      onChange={(e) => setNewSchedule({ ...newSchedule, status: e.target.value as 'Aktif' | 'Nonaktif' })}
                    >
                      <option value="Aktif">🟢 Aktif</option>
                      <option value="Nonaktif">⚪ Nonaktif</option>
                    </select>
                  </div>
                </div>

                {/* Target Santri Filter (Komplek / Kamar / Kelas) */}
                <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 space-y-2.5">
                  <p className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <UsersRound size={15} className="text-[#138F81]" /> Target Santri Pengajian (Opsional)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-[#138F81] focus:outline-hidden"
                      value={newSchedule.boarding_complex_id}
                      onChange={(e) => setNewSchedule({ ...newSchedule, boarding_complex_id: e.target.value, boarding_room_id: '' })}
                    >
                      <option value="">Semua Komplek</option>
                      {complexes.map((c) => (
                        <option key={text(c.id)} value={text(c.id)}>{text(c.name)}</option>
                      ))}
                    </select>

                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-[#138F81] focus:outline-hidden"
                      value={newSchedule.boarding_room_id}
                      onChange={(e) => setNewSchedule({ ...newSchedule, boarding_room_id: e.target.value })}
                    >
                      <option value="">Semua Kamar</option>
                      {availableRooms.map((r) => (
                        <option key={text(r.id)} value={text(r.id)}>{text(r.name)}</option>
                      ))}
                    </select>

                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-[#138F81] focus:outline-hidden"
                      value={newSchedule.class_id}
                      onChange={(e) => setNewSchedule({ ...newSchedule, class_id: e.target.value })}
                    >
                      <option value="">Semua Kelas Madin</option>
                      {classes.map((c) => (
                        <option key={text(c.id)} value={text(c.id)}>{text(c.name)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSaveScheduleSlot}
                    className="rounded-2xl bg-[#138F81] px-5 py-3 text-xs font-extrabold text-white shadow-md shadow-[#138F81]/20 hover:brightness-105 transition-all inline-flex items-center gap-1.5"
                  >
                    <Plus size={16} /> {editingIndex !== null ? 'Perbarui Slot Jadwal' : 'Tambahkan ke Daftar Slot'}
                  </button>
                </div>
              </div>

              {/* Daftar Slot Jadwal Terpasang */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                    <Calendar className="text-[#138F81]" size={18} />
                    Daftar Slot Jadwal Terpasang ({form.jadwals.length})
                  </h3>
                </div>

                {form.jadwals.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
                    <Calendar size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-600">Belum ada slot jadwal pengajian.</p>
                    <p className="text-xs font-semibold text-slate-400 mt-0.5">
                      Gunakan form di atas untuk menambahkan sesi, hari, dan ustadz pengajar.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {form.jadwals.map((item, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col justify-between gap-3 hover:bg-white hover:shadow-xs transition-all"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="rounded-lg bg-[#138F81]/10 px-2.5 py-1 text-xs font-black text-[#138F81]">
                              {item.hari || 'Senin'} • {item.sesi}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${item.status === 'Aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                              {item.status}
                            </span>
                          </div>
                          <p className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                            <Clock3 size={14} className="text-slate-400" /> {item.start_time} - {item.end_time} WIB
                          </p>
                          <p className="text-xs font-bold text-slate-700">
                            👤 {item.pengajar || 'Ustadz / Pengajar'}
                          </p>

                          <p className="text-xs font-semibold text-slate-500">
                            🎯 Target: {item.kamar ? `Kamar ${item.kamar}` : item.komplek ? `Komplek ${item.komplek}` : item.kelas ? `Kelas ${item.kelas}` : 'Semua Santri'}
                          </p>
                        </div>

                        <div className="flex items-center justify-end gap-2 border-t border-slate-200/60 pt-2.5">
                          <button
                            type="button"
                            onClick={() => handleEditSchedule(idx)}
                            className="rounded-xl bg-white px-3 py-1.5 text-xs font-extrabold text-blue-600 border border-slate-200 shadow-2xs hover:bg-blue-50 transition-colors inline-flex items-center gap-1"
                          >
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveSchedule(idx)}
                            className="rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-extrabold text-rose-600 hover:bg-rose-100 transition-colors inline-flex items-center gap-1"
                          >
                            <Trash2 size={13} /> Hapus
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

        {/* BOTTOM ACTION BAR */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Batal
          </button>
          <div className="flex items-center gap-3">
            {activeTab === 'kitab' ? (
              <button
                type="button"
                onClick={() => setActiveTab('jadwal')}
                className="rounded-2xl bg-[#138F81] px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-[#138F81]/25 hover:brightness-105 transition-all inline-flex items-center gap-2"
              >
                Lanjut ke II. Jadwal & Pengajar <ChevronRight size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isSaving}
                className="rounded-2xl bg-[#138F81] px-7 py-3 text-sm font-extrabold text-white shadow-lg shadow-[#138F81]/25 hover:brightness-105 transition-all disabled:opacity-60 inline-flex items-center gap-2"
              >
                <Save size={18} /> {isSaving ? 'Menyimpan...' : 'Simpan Seluruh Data Kitab & Jadwal'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
