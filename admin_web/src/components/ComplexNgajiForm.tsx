import {
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Pencil,
  Plus,
  Save,
  Search,
  Sparkles,
  UsersRound,
  X
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type ApiRecord } from '../services/api';
import SearchableSelect, { type FilterChip, type SearchSelectOption } from './SearchableSelect';

interface ComplexNgajiFormProps {
  initialData?: ApiRecord | null;
  onClose: () => void;
  onSave: () => void;
}

const HARI_LIST = ['Setiap Hari', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad'];

function text(value: unknown, fallback = ''): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getGenderOfTeacher(t?: ApiRecord | null): 'L' | 'P' | 'unknown' {
  if (!t) return 'unknown';
  const jk = String(t.jenis_kelamin || '').toUpperCase();
  if (jk === 'L' || jk === 'LAKI-LAKI') return 'L';
  if (jk === 'P' || jk === 'PEREMPUAN') return 'P';
  const name = String(t.name || '').toUpperCase();
  if (name.includes('USTADZAH') || name.includes('IBU') || name.includes('HJ.') || name.includes('NENG') || name.includes('NING') || name.includes('SITI')) return 'P';
  if (name.includes('USTADZ') || name.includes('BAPAK') || name.includes('KH.') || name.includes('GUS') || name.includes('KYAI')) return 'L';
  return 'unknown';
}

export function ComplexNgajiForm({ initialData, onClose, onSave }: ComplexNgajiFormProps) {
  const isEditing = Boolean(initialData?.id);
  const editingId = initialData?.id ? num(initialData.id) : undefined;

  // Master data
  const [sessions, setSessions] = useState<ApiRecord[]>([]);
  const [teachers, setTeachers] = useState<ApiRecord[]>([]);
  const [allStudents, setAllStudents] = useState<ApiRecord[]>([]);
  const [isLoadingMaster, setIsLoadingMaster] = useState(true);

  // Form states
  const [sessionId, setSessionId] = useState<number>(0);
  const [gender, setGender] = useState<'PA' | 'PI'>('PA');
  const [teacherId, setTeacherId] = useState<string>('');
  const [kitabNama, setKitabNama] = useState<string>('');
  const [hari, setHari] = useState<string>('Setiap Hari');
  const [startTime, setStartTime] = useState<string>('05:30');
  const [endTime, setEndTime] = useState<string>('06:30');
  const [status, setStatus] = useState<'Aktif' | 'Nonaktif'>('Aktif');
  const [description, setDescription] = useState<string>('');

  // Selected students (student_ids)
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [studentSearch, setStudentSearch] = useState<string>('');

  // UI state
  const [autoGenderNotice, setAutoGenderNotice] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Load masters & init data
  useEffect(() => {
    async function load() {
      setIsLoadingMaster(true);
      setError('');
      try {
        const [sessionRes, teacherRes, studentRes] = await Promise.all([
          api.ngajiSessions({ active_only: 1 }),
          api.users({ role: 'guru', status: 'Aktif' }),
          api.siswa({ status: 'Aktif' }),
        ]);

        const sessionList = Array.isArray(sessionRes.data) ? sessionRes.data : [];
        const teacherList = Array.isArray(teacherRes.data) ? teacherRes.data : [];
        const studentList = Array.isArray(studentRes.data) ? studentRes.data : [];

        setSessions(sessionList);
        setTeachers(teacherList);
        setAllStudents(studentList);

        // Jika initialData ada (mode edit), populate data
        if (initialData) {
          const initSessionId = num(initialData.ngaji_session_id || initialData.session_id);
          setSessionId(initSessionId || (sessionList[0]?.id ? num(sessionList[0].id) : 0));

          const initGender = String(initialData.gender || '').toUpperCase() === 'PI' ? 'PI' : 'PA';
          setGender(initGender);

          setTeacherId(initialData.teacher_id ? String(initialData.teacher_id) : '');
          setKitabNama(text(initialData.kitab_nama || (initialData.kitab !== '-' ? initialData.kitab : '')));
          setHari(text(initialData.hari, 'Setiap Hari'));
          setStartTime(text(initialData.start_time, '05:30').slice(0, 5));
          setEndTime(text(initialData.end_time, '06:30').slice(0, 5));
          setStatus(initialData.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif');
          setDescription(text(initialData.description));

          // Populate student_ids
          if (Array.isArray(initialData.student_ids)) {
            setSelectedStudentIds(initialData.student_ids.map((id: unknown) => Number(id)));
          }
        } else {
          // Default: sesi pertama (Ngaji Subuh)
          const firstSession = sessionList[0];
          if (firstSession) {
            setSessionId(num(firstSession.id));
            if (firstSession.start_time) setStartTime(String(firstSession.start_time).slice(0, 5));
            if (firstSession.end_time) setEndTime(String(firstSession.end_time).slice(0, 5));
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal memuat master data pengajian.');
      } finally {
        setIsLoadingMaster(false);
      }
    }

    void load();
  }, [initialData]);

  // Handler ganti sesi: hanya beri saran default jika jam belum diisi admin
  const handleSelectSession = (id: number) => {
    setSessionId(id);
    const chosen = sessions.find((s) => num(s.id) === id);
    if (chosen && !startTime && !endTime) {
      const sName = text(chosen.name).toLowerCase();
      if (chosen.code === 'ngaji_subuh' || sName.includes('subuh')) {
        setStartTime('05:30');
        setEndTime('06:30');
      } else if (chosen.code === 'ngaji_sore' || sName.includes('sore')) {
        setStartTime('16:00');
        setEndTime('17:15');
      }
    }
  };

  // Handler ganti gender target (PA / PI)
  const handleSelectGender = (target: 'PA' | 'PI') => {
    setGender(target);
    // Sesuaikan guru rekomendasi
    if (target === 'PI') {
      const femaleTeacher = teachers.find((t) => getGenderOfTeacher(t) === 'P');
      if (femaleTeacher) {
        setTeacherId(String(femaleTeacher.id));
        setAutoGenderNotice('💡 Target Santri Putri (PI) dipilih ➔ Guru otomatis diarahkan ke Ustadzah.');
      }
    } else {
      const maleTeacher = teachers.find((t) => getGenderOfTeacher(t) === 'L');
      if (maleTeacher) {
        setTeacherId(String(maleTeacher.id));
        setAutoGenderNotice('💡 Target Santri Putra (PA) dipilih ➔ Guru otomatis diarahkan ke Ustadz.');
      }
    }
  };

  // Options guru untuk SearchableSelect
  const teacherOptions: SearchSelectOption[] = useMemo(() => {
    return teachers.map((t) => {
      const g = getGenderOfTeacher(t);
      const isRec = (gender === 'PI' && g === 'P') || (gender === 'PA' && g === 'L');

      return {
        value: String(t.id),
        label: text(t.name),
        subLabel: t.kode_guru ? `Kode: ${t.kode_guru}` : (t.email ? text(t.email) : undefined),
        gender: g === 'unknown' ? undefined : g,
        badge: g === 'L' ? '👦 Ustadz' : g === 'P' ? '👧 Ustadzah' : undefined,
        badgeColor: g === 'L' ? ('blue' as const) : g === 'P' ? ('pink' as const) : ('teal' as const),
        isRecommended: isRec,
      };
    });
  }, [teachers, gender]);

  const teacherFilterChips: FilterChip[] = useMemo(
    () => [
      { id: 'all', label: 'Semua', filter: () => true },
      { id: 'male', label: '👦 Ustadz', filter: (opt: SearchSelectOption) => opt.gender === 'L' },
      { id: 'female', label: '👧 Ustadzah', filter: (opt: SearchSelectOption) => opt.gender === 'P' },
    ],
    []
  );

  // Filter santri sesuai gender target (PA atau PI)
  const availableStudents = useMemo(() => {
    return allStudents.filter((s) => {
      const jk = String(s.jenis_kelamin || '').toUpperCase();
      if (gender === 'PI') {
        return jk === 'P' || jk === 'PEREMPUAN' || String(s.komplek || '').toUpperCase().includes('PUTRI');
      }
      // PA: Putra
      return jk === 'L' || jk === 'LAKI-LAKI' || jk === 'LAKI' || String(s.komplek || '').toUpperCase().includes('PUTRA') || (!jk.includes('P') && !jk.includes('PEREMPUAN'));
    });
  }, [allStudents, gender]);

  // Santri terfilter berdasarkan pencarian
  const filteredStudents = useMemo(() => {
    const kw = studentSearch.trim().toLowerCase();
    if (!kw) return availableStudents;
    return availableStudents.filter((s) => {
      const name = String(s.nama ?? '').toLowerCase();
      const nis = String(s.nis ?? '').toLowerCase();
      const kamar = String(s.kamar ?? '').toLowerCase();
      const kelas = String(s.kelas ?? '').toLowerCase();
      return name.includes(kw) || nis.includes(kw) || kamar.includes(kw) || kelas.includes(kw);
    });
  }, [availableStudents, studentSearch]);

  // Toggle checklist santri
  const handleToggleStudent = (id: number) => {
    setSelectedStudentIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  // Pilih semua yang tampil di filter
  const handleSelectAllFiltered = () => {
    const idsToAdd = filteredStudents.map((s) => num(s.id));
    setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
  };

  // Kosongkan santri yang terpilih
  const handleClearAllSelected = () => {
    setSelectedStudentIds([]);
  };

  // Simpan Jadwal & Santri
  const handleSave = async () => {
    setError('');
    if (!sessionId) {
      setError('Silakan pilih sesi pengajian (Ngaji Subuh atau Ngaji Sore).');
      return;
    }
    if ((startTime && !endTime) || (!startTime && endTime)) {
      setError('Mohon lengkapi kedua kolom jam (mulai dan selesai) jika ingin mencantumkan waktu pengajian.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: ApiRecord = {
        ngaji_session_id: sessionId,
        gender: gender,
        teacher_id: teacherId ? Number(teacherId) : null,
        kitab_nama: kitabNama.trim() || null,
        hari: hari,
        start_time: startTime || null,
        end_time: endTime || null,
        status: status,
        description: description.trim() || null,
        student_ids: selectedStudentIds,
      };

      if (isEditing && editingId) {
        await api.updateNgajiSchedule(editingId, payload);
      } else {
        await api.createNgajiSchedule(payload);
      }

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan jadwal pengajian.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 sm:px-7 py-4 bg-gradient-to-r from-teal-50/60 via-white to-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#138F81] text-white shadow-md shadow-[#138F81]/25">
              <BookOpen size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 bg-teal-100/70 px-2 py-0.5 rounded-md">
                  Pondok Pesantren
                </span>
                <span className="text-[10px] font-bold text-slate-400">Absensi Ngaji Santri</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-800">
                {isEditing ? 'Edit Jadwal & Anggota Pengajian' : 'Atur Jadwal Pengajian Baru'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs sm:text-sm font-bold text-rose-700">
              ⚠️ {error}
            </div>
          )}

          {autoGenderNotice && (
            <div className="rounded-2xl border border-teal-200 bg-teal-50/90 p-3 text-xs font-bold text-teal-900 flex items-center justify-between gap-2 animate-in fade-in duration-200">
              <span>{autoGenderNotice}</span>
              <button
                type="button"
                onClick={() => setAutoGenderNotice('')}
                className="text-teal-700 hover:text-teal-900 text-xs font-black cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* 1. SESI NGAJI: NGAJI SUBUH vs NGAJI SORE */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
              1. Pilih Sesi Pengajian <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sessions.map((s) => {
                const sName = text(s.name).toLowerCase();
                const isSubuh = s.code === 'ngaji_subuh' || sName.includes('subuh');
                const isSelected = sessionId === num(s.id);

                return (
                  <div
                    key={text(s.id)}
                    onClick={() => handleSelectSession(num(s.id))}
                    className={`cursor-pointer rounded-2xl p-4 border-2 transition-all flex items-center gap-3.5 ${
                      isSelected
                        ? 'border-[#138F81] bg-[#138F81]/5 shadow-sm shadow-[#138F81]/15 ring-2 ring-[#138F81]/20'
                        : 'border-slate-200 hover:border-teal-300 bg-white hover:bg-slate-50/50'
                    }`}
                  >
                    <div
                      className={`h-12 w-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-2xs ${
                        isSubuh ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      {isSubuh ? '🌅' : '🌇'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-black text-slate-800 truncate">{text(s.name)}</p>
                        {isSelected && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#138F81] text-white">
                            <Check size={13} />
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-[#138F81]">
                        {isSubuh ? 'Pagi (05:30 - 06:30 WIB)' : 'Sore (16:00 - 17:15 WIB)'}
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                        {text(s.description, isSubuh ? 'Pengajian ba\'da shubuh' : 'Pengajian ba\'da ashar')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. GENDER TARGET & GURU PENGAJAR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Target Gender */}
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                2. Target Kelompok Santri <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectGender('PA')}
                  className={`flex items-center justify-center gap-2 rounded-2xl py-3 px-3 text-xs sm:text-sm font-black border-2 transition-all cursor-pointer ${
                    gender === 'PA'
                      ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-sm ring-2 ring-blue-300/40'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-base">👦</span>
                  <span>Santri Putra (PA)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectGender('PI')}
                  className={`flex items-center justify-center gap-2 rounded-2xl py-3 px-3 text-xs sm:text-sm font-black border-2 transition-all cursor-pointer ${
                    gender === 'PI'
                      ? 'border-pink-500 bg-pink-50 text-pink-900 shadow-sm ring-2 ring-pink-300/40'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-base">👧</span>
                  <span>Santri Putri (PI)</span>
                </button>
              </div>
            </div>

            {/* Guru Pengajar */}
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                3. Ustadz / Ustadzah Pengajar
              </label>
              <SearchableSelect
                options={teacherOptions}
                value={teacherId}
                onChange={(val) => setTeacherId(String(val))}
                placeholder="Pilih atau cari nama guru..."
                searchPlaceholder="Ketik nama ustadz / ustadzah..."
                filterChips={teacherFilterChips}
                dropdownWidth="w-full sm:w-[380px]"
                recommendationNotice={
                  gender === 'PI'
                    ? '✨ Direkomendasikan Ustadzah untuk santri Putri (PI)'
                    : '✨ Direkomendasikan Ustadz untuk santri Putra (PA)'
                }
              />
            </div>
          </div>

          {/* 3. NAMA KITAB (OPSIONAL) & WAKTU / HARI */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
            <div className="sm:col-span-1">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                Nama Kitab <span className="text-slate-400 font-normal">(Opsional)</span>
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-800 placeholder-slate-400 focus:border-[#138F81] outline-none min-h-[42px]"
                placeholder="Misal: Fathul Qorib, Safinah..."
                value={kitabNama}
                onChange={(e) => setKitabNama(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                Hari KBM
              </label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:border-[#138F81] outline-none min-h-[42px]"
                value={hari}
                onChange={(e) => setHari(e.target.value)}
              >
                {HARI_LIST.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Mulai</span>
                    <span className="text-[10px] font-bold text-teal-600 lowercase bg-teal-50 px-1.5 py-0.5 rounded">bebas atur</span>
                  </label>
                  <input
                    type="time"
                    className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:border-[#138F81] outline-none min-h-[42px]"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Selesai</span>
                    <span className="text-[10px] font-bold text-teal-600 lowercase bg-teal-50 px-1.5 py-0.5 rounded">bebas atur</span>
                  </label>
                  <input
                    type="time"
                    className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:border-[#138F81] outline-none min-h-[42px]"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-[10px] font-bold text-slate-500 pt-0.5 flex items-center gap-1">
                <span>💡</span> Admin bebas menentukan jam mulai & selesai sesuai kebutuhan pondok.
              </p>
            </div>
          </div>

          {/* 4. PILIHAN SANTRI ANGGOTA (BUKAN PER KAMAR, MELAINKAN PILIHAN SANTRI LANGSUNG) */}
          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-200/70 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <UsersRound className="text-[#138F81]" size={18} />
                  Pilih Santri Anggota Pengajian
                  <span className="rounded-full bg-teal-100 text-teal-800 px-2.5 py-0.5 text-xs font-extrabold">
                    {selectedStudentIds.length} Terpilih
                  </span>
                </h3>
                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                  Centang santri yang masuk ke dalam jadwal ini. Menampilkan santri khusus {gender === 'PI' ? 'Putri (PI)' : 'Putra (PA)'}.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="rounded-xl bg-teal-50 border border-teal-200 px-3 py-1.5 text-xs font-black text-[#138F81] hover:bg-teal-100 transition-colors cursor-pointer"
                >
                  ✓ Pilih Semua ({filteredStudents.length})
                </button>
                {selectedStudentIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllSelected}
                    className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                  >
                    ✕ Kosongkan
                  </button>
                )}
              </div>
            </div>

            {/* Toolbar Pencarian Santri */}
            <div className="relative flex items-center">
              <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
              <input
                type="text"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#138F81] focus:ring-1 focus:ring-[#138F81]/30 transition-all"
                placeholder={`Cari nama santri ${gender === 'PI' ? 'putri' : 'putra'}, NIS, kamar...`}
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
              {studentSearch && (
                <button
                  type="button"
                  onClick={() => setStudentSearch('')}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* List Kartu Santri (Scrollable) */}
            <div className="max-h-64 overflow-y-auto q-scrollbar pr-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {filteredStudents.length === 0 ? (
                <div className="col-span-full p-6 text-center text-xs font-bold text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                  Tidak ada santri yang cocok dengan pencarian "{studentSearch}".
                </div>
              ) : (
                filteredStudents.map((student) => {
                  const sId = num(student.id);
                  const isChecked = selectedStudentIds.includes(sId);

                  return (
                    <div
                      key={sId}
                      onClick={() => handleToggleStudent(sId)}
                      className={`flex items-center gap-2.5 rounded-xl p-2.5 border transition-all cursor-pointer select-none ${
                        isChecked
                          ? 'border-[#138F81] bg-teal-50/80 shadow-2xs ring-1 ring-[#138F81]/30'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by card click
                        className="h-4 w-4 rounded text-[#138F81] focus:ring-[#138F81] cursor-pointer"
                      />

                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs">
                        {gender === 'PI' ? '👧' : '👦'}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs font-extrabold truncate ${
                            isChecked ? 'text-teal-900' : 'text-slate-800'
                          }`}
                        >
                          {text(student.nama)}
                        </p>
                        <p className="text-[10px] text-slate-500 font-semibold truncate">
                          {student.kamar ? `Kamar: ${student.kamar}` : (student.kelas ? `Kelas: ${student.kelas}` : `NIS: ${text(student.nis, '-')}`)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-5 sm:px-7 py-3.5">
          <div className="text-xs font-bold text-slate-500">
            {selectedStudentIds.length > 0 ? (
              <span className="text-[#138F81] font-black">
                ✓ {selectedStudentIds.length} santri akan dimasukkan ke jadwal ini
              </span>
            ) : (
              <span className="text-amber-600 font-semibold">
                ⚠️ Belum ada santri yang dipilih
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              disabled={isSaving}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-[#138F81]/25 transition-all cursor-pointer disabled:opacity-60"
            >
              <Save size={16} />
              <span>{isSaving ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Terbitkan Jadwal Ngaji'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
