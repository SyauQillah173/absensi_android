import {
  AlertCircle,
  BookOpen,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Eye,
  GraduationCap,
  Lock,
  Play,
  RefreshCw,
  Save,
  Search,
  UsersRound,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type ApiRecord, type UserSession } from '../services/api';

interface GuruDashboardViewProps {
  session: UserSession | null;
  onNavigateToMadin?: (target?: { classId?: number; mapelId?: number; jadwalId?: number }) => void;
}

interface ScheduleCardData extends ApiRecord {
  id: number;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  jam_aktif_mulai: string;
  waktu: string;
  ruangan?: string;
  class_id: number;
  kelas: string;
  mapel_id: number;
  mapel: string;
  guru: string;
  status_absen: 'active' | 'active_late' | 'locked' | 'completed' | 'tomorrow' | 'upcoming';
  status_waktu: 'aktif' | 'terlambat' | 'segera' | 'ditutup' | 'sudah_absen' | 'besok' | 'hari_lain';
  badge_status: string;
  pesan_ramah: string;
  can_input: boolean;
  is_late: boolean;
  is_done: boolean;
  total_hadir: number;
  total_izin: number;
  total_sakit: number;
  total_alfa: number;
  total_siswa: number;
}

type MadinStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Alfa';

export const KETERANGAN_PRESETS: Record<'Sakit' | 'Izin' | 'Alfa', string[]> = {
  Sakit: [
    'Sakit di Kamar / Asrama',
    'Dirawat di Poskestren / UKS',
    'Dirawat di Rumah Sakit / Puskesmas',
    'Pulang ke Rumah (Izin Sakit)',
    'Demam / Flu / Batuk',
    'Kecapekan / Istirahat'
  ],
  Izin: [
    'Izin Pulang ke Rumah (Keluarga)',
    'Izin Acara / Hajat Keluarga',
    'Izin Mengikuti Kegiatan Pondok / Lomba',
    'Izin Piket Pondok / Dapur',
    'Izin Mengurus Dokumen / Keperluan'
  ],
  Alfa: [
    'Tanpa Keterangan (Tidak Masuk)',
    'Tertidur di Kamar',
    'Terlambat Lebih dari 30 Menit',
    'Bolos KBM / Menghilang'
  ]
};

function text(value: unknown, fallback = '-'): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function num(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

export function GuruDashboardView({ session }: GuruDashboardViewProps) {
  const [dashboard, setDashboard] = useState<ApiRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  // 1-Click Modal Presensi state
  const [activeJadwal, setActiveJadwal] = useState<ScheduleCardData | null>(null);
  const [isReadOnlyMode, setIsReadOnlyMode] = useState(false);
  const [searchStudent, setSearchStudent] = useState('');
  const [students, setStudents] = useState<ApiRecord[]>([]);
  const [statuses, setStatuses] = useState<Record<number, MadinStatus>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [toastMessage, setToastMessage] = useState<{ title: string; subtitle: string } | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError('');
    try {
      const res = await api.dashboard();
      setDashboard(res);
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Gagal memuat jadwal guru.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => {
      void load(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [load]);

  // Update clock every second
  useEffect(() => {
    const updateClock = () => {
      const d = new Date();
      setCurrentTimeStr(
        d.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }) + ' WIB'
      );
    };
    updateClock();
    const clockInterval = setInterval(updateClock, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const jadwalHariIni = useMemo(() => {
    return Array.isArray(dashboard?.jadwal_hari_ini)
      ? (dashboard?.jadwal_hari_ini as ScheduleCardData[])
      : [];
  }, [dashboard]);

  const jadwalBesok = useMemo(() => {
    return Array.isArray(dashboard?.jadwal_besok)
      ? (dashboard?.jadwal_besok as ScheduleCardData[])
      : [];
  }, [dashboard]);

  const jadwalMingguan = useMemo(() => {
    return Array.isArray(dashboard?.jadwal_mingguan)
      ? (dashboard?.jadwal_mingguan as ScheduleCardData[])
      : [];
  }, [dashboard]);

  const stats = dashboard?.stats as ApiRecord | undefined;

  // Open 1-Click Attendance Modal
  const openAttendanceModal = async (jadwal: ScheduleCardData, isReadOnly = false) => {
    setActiveJadwal(jadwal);
    const readOnly = isReadOnly || Boolean(jadwal.is_done);
    setIsReadOnlyMode(readOnly);
    setModalError('');
    setSearchStudent('');
    setIsLoadingStudents(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const classId = jadwal.class_id;

      // Parallel fetch students and attendance records if done
      const [siswaRes, absensiRes] = await Promise.all([
        classId
          ? api.siswa({ class_id: classId, status: 'Aktif' })
          : api.siswa({ status: 'Aktif' }),
        readOnly
          ? api.absensi({ class_id: classId, mapel_id: jadwal.mapel_id, tanggal: todayStr, jadwal_id: jadwal.id })
          : Promise.resolve({ data: [] })
      ]);

      const rawList = Array.isArray(siswaRes.data) ? (siswaRes.data as ApiRecord[]) : [];
      const savedLogs = Array.isArray(absensiRes.data) ? (absensiRes.data as ApiRecord[]) : [];

      setStudents(rawList);

      const initStatuses: Record<number, MadinStatus> = {};
      const initNotes: Record<number, string> = {};

      if (savedLogs.length > 0) {
        savedLogs.forEach((log) => {
          const sid = Number(log.siswa_id);
          const st = String(log.status ?? 'Hadir');
          initStatuses[sid] = (st === 'H' || st === 'Hadir') ? 'Hadir' : (st === 'I' || st === 'Izin') ? 'Izin' : (st === 'S' || st === 'Sakit') ? 'Sakit' : 'Alfa';
          if (log.keterangan || log.catatan) {
            initNotes[sid] = String(log.keterangan || log.catatan);
          }
        });
      } else {
        rawList.forEach((s) => {
          if (s.id) initStatuses[Number(s.id)] = 'Hadir';
        });
      }

      setStatuses(initStatuses);
      setNotes(initNotes);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Gagal memuat daftar santri.');
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const setAllStatus = (st: MadinStatus) => {
    if (isReadOnlyMode) return;
    const next: Record<number, MadinStatus> = {};
    students.forEach((s) => {
      if (s.id) next[Number(s.id)] = st;
    });
    setStatuses(next);
  };

  const handleSaveAttendance = async () => {
    if (!activeJadwal || isSaving || isReadOnlyMode) return;
    setIsSaving(true);
    setModalError('');

    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const items = students.map((s) => {
        const sid = Number(s.id);
        return {
          siswa_id: sid,
          tanggal: todayStr,
          status: statuses[sid] || 'Hadir',
          class_id: activeJadwal.class_id,
          mapel_id: activeJadwal.mapel_id,
          jadwal_id: activeJadwal.id,
          keterangan: notes[sid] || undefined
        };
      });

      await api.createAbsensiBulk({
        user_id: session?.id,
        actor_user_id: session?.id,
        absensi: items
      });

      // Show top-right toast
      setToastMessage({
        title: 'Presensi Berhasil Disimpan!',
        subtitle: `Data absensi ${activeJadwal.mapel} telah tersimpan dan status terkunci.`
      });

      setActiveJadwal(null);
      void load(true);

      setTimeout(() => {
        setToastMessage(null);
      }, 3500);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Gagal menyimpan absensi santri.');
      setIsSaving(false);
    }
  };

  const filteredStudents = useMemo(() => {
    const kw = searchStudent.toLowerCase().trim();
    if (!kw) return students;
    return students.filter((s) =>
      `${s.nama ?? ''} ${s.nis ?? ''} ${s.kamar ?? ''}`.toLowerCase().includes(kw)
    );
  }, [students, searchStudent]);

  const summaryCount = useMemo(() => {
    let hadir = 0;
    let izin = 0;
    let sakit = 0;
    let alfa = 0;
    students.forEach((s) => {
      const st = statuses[Number(s.id)] || 'Hadir';
      if (st === 'Hadir') hadir++;
      else if (st === 'Izin') izin++;
      else if (st === 'Sakit') sakit++;
      else alfa++;
    });
    return { hadir, izin, sakit, alfa };
  }, [students, statuses]);

  // If activeJadwal is selected, render the Dedicated Full Page Form (Mobile & Desktop Full Screen)
  if (activeJadwal) {
    return (
      <div className="space-y-4 animate-in fade-in duration-200 pb-16">
        {/* Floating Top-Right Toast Notification */}
        {toastMessage && (
          <div className="fixed top-6 right-6 z-[999999] flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-2xl border border-emerald-200 shadow-emerald-900/20 transition-all animate-in fade-in slide-in-from-top-4 duration-300 max-w-sm">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#138F81] text-white shadow-md shadow-[#138F81]/30">
              <CheckCircle2 size={24} strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-slate-800">{toastMessage.title}</p>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {toastMessage.subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Top Navigation & Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-4 sm:p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveJadwal(null)}
              disabled={isSaving}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all cursor-pointer shadow-2xs"
            >
              <ChevronLeft size={22} strokeWidth={2.5} />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-2xl font-black text-slate-800">
                  Presensi {activeJadwal.mapel}
                </h2>
                <span className="rounded-lg bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-xs font-black text-[#138F81]">
                  Kelas: {activeJadwal.kelas}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                <span>⏰ {activeJadwal.hari}, {activeJadwal.waktu} WIB</span>
                {isReadOnlyMode ? (
                  <span className="rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black px-2.5 py-0.5 border border-emerald-200">
                    🔒 Terkunci (Hanya Lihat Detail)
                  </span>
                ) : (
                  <span className="rounded-full bg-teal-100 text-teal-800 text-[11px] font-black px-2.5 py-0.5 border border-teal-200">
                    ✏️ Form Pengisian Presensi Guru
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveJadwal(null)}
              disabled={isSaving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {isReadOnlyMode ? '← Kembali' : 'Batal'}
            </button>
            {!isReadOnlyMode && (
              <button
                type="button"
                onClick={() => void handleSaveAttendance()}
                disabled={isSaving || students.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-[#138F81] px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-[#138F81]/25 hover:bg-[#0f766a] transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save size={16} />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Presensi'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter & Quick Actions Card */}
        <div className="rounded-3xl bg-white p-4 sm:p-5 shadow-sm ring-1 ring-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {isReadOnlyMode ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold text-slate-600 mr-1">Rekap Hasil:</span>
                <span className="rounded-xl bg-emerald-100 border border-emerald-200 px-3 py-1 text-xs font-black text-emerald-800">
                  ✅ {summaryCount.hadir} Hadir
                </span>
                {summaryCount.izin > 0 && (
                  <span className="rounded-xl bg-amber-100 border border-amber-200 px-3 py-1 text-xs font-black text-amber-800">
                    ⚠️ {summaryCount.izin} Izin
                  </span>
                )}
                {summaryCount.sakit > 0 && (
                  <span className="rounded-xl bg-rose-100 border border-rose-200 px-3 py-1 text-xs font-black text-rose-800">
                    🏥 {summaryCount.sakit} Sakit
                  </span>
                )}
                {summaryCount.alfa > 0 && (
                  <span className="rounded-xl bg-slate-200 border border-slate-300 px-3 py-1 text-xs font-black text-slate-800">
                    ❌ {summaryCount.alfa} Alfa
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 w-full">
                <span className="text-xs sm:text-sm font-extrabold text-slate-700">
                  Daftar Santri ({students.length} Santri)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAllStatus('Hadir')}
                    className="rounded-xl bg-[#138F81] px-3.5 py-1.5 text-xs font-black text-white hover:bg-[#0f766a] transition-all shadow-xs cursor-pointer"
                  >
                    ✓ Semua Hadir
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllStatus('Izin')}
                    className="rounded-xl bg-amber-100 border border-amber-200 px-3.5 py-1.5 text-xs font-black text-amber-800 hover:bg-amber-200 transition-all cursor-pointer"
                  >
                    Semua Izin
                  </button>
                </div>
              </div>
            )}

            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-4 text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#138F81] outline-none transition-all"
                placeholder="🔍 Cari nama santri / NIS / kamar..."
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Student Cards List */}
        <div className="space-y-3">
          {modalError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
              ⚠️ {modalError}
            </div>
          )}

          {isLoadingStudents ? (
            <div className="rounded-3xl bg-white p-12 text-center text-slate-400 font-bold text-sm ring-1 ring-slate-200">
              Memuat daftar santri...
            </div>
          ) : students.length === 0 ? (
            <div className="rounded-3xl bg-white p-12 text-center text-slate-400 font-bold text-sm ring-1 ring-slate-200">
              Belum ada santri terdaftar di kelas {activeJadwal.kelas}.
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center text-xs font-bold text-slate-400 ring-1 ring-slate-200">
              Tidak ada santri yang cocok dengan pencarian "{searchStudent}".
            </div>
          ) : (
            filteredStudents.map((siswa, idx) => {
              const sid = Number(siswa.id);
              const currentStatus = statuses[sid] || 'Hadir';
              const currentNote = notes[sid] || '';

              return (
                <div
                  key={sid}
                  className="flex flex-col p-4 sm:p-5 rounded-3xl border border-slate-200 bg-white shadow-xs hover:border-slate-300 transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 font-black text-xs text-slate-600">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm sm:text-base font-black text-slate-800 truncate">{text(siswa.nama)}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-mono font-bold text-slate-500">NIS: {text(siswa.nis)}</span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-black ${
                              siswa.jenis_kelamin === 'L'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-pink-50 text-pink-700 border border-pink-200'
                            }`}
                          >
                            {siswa.jenis_kelamin === 'L' ? 'Putra' : 'Putri'}
                          </span>
                          {Boolean(siswa.kamar) && (
                            <span className="text-[11px] font-semibold text-slate-400 truncate">
                              • {text(siswa.kamar)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge in Read-Only Mode vs Status Pills in Editable Mode */}
                    {isReadOnlyMode ? (
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-2xl px-4 py-1.5 text-xs font-black border ${
                            currentStatus === 'Hadir'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : currentStatus === 'Izin'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : currentStatus === 'Sakit'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-slate-100 text-slate-800 border-slate-300'
                          }`}
                        >
                          ● {currentStatus}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(['Hadir', 'Izin', 'Sakit', 'Alfa'] as const).map((st) => {
                          const isSelected = currentStatus === st;
                          const colors = {
                            Hadir: isSelected
                              ? 'bg-[#138F81] text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                            Izin: isSelected
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                            Sakit: isSelected
                              ? 'bg-rose-500 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                            Alfa: isSelected
                              ? 'bg-slate-800 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          };

                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => {
                                setStatuses({ ...statuses, [sid]: st });
                                if (st === 'Hadir') {
                                  const nextNotes = { ...notes };
                                  delete nextNotes[sid];
                                  setNotes(nextNotes);
                                }
                              }}
                              className={`px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${colors[st]}`}
                            >
                              {st}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Note / Keterangan Alasan */}
                  {isReadOnlyMode ? (
                    currentNote ? (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                        <span className="font-bold text-slate-500">💬 Keterangan:</span>
                        <span>{currentNote}</span>
                      </div>
                    ) : null
                  ) : (
                    currentStatus !== 'Hadir' && (
                      <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 animate-in fade-in duration-200">
                        <span className="text-xs font-bold text-slate-600 shrink-0">
                          Alasan {currentStatus}:
                        </span>

                        <select
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-[#138F81] transition-colors shrink-0 max-w-[240px]"
                          value={
                            KETERANGAN_PRESETS[currentStatus].includes(currentNote)
                              ? currentNote
                              : currentNote
                              ? '__custom__'
                              : ''
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '__custom__') {
                              if (KETERANGAN_PRESETS[currentStatus].includes(currentNote)) {
                                setNotes({ ...notes, [sid]: '' });
                              }
                            } else {
                              setNotes({ ...notes, [sid]: val });
                            }
                          }}
                        >
                          <option value="">-- Pilih Alasan Cepat (Opsional) --</option>
                          {KETERANGAN_PRESETS[currentStatus].map((preset) => (
                            <option key={preset} value={preset}>
                              {preset}
                            </option>
                          ))}
                          <option value="__custom__">✏️ Ketik Alasan Sendiri...</option>
                        </select>

                        <input
                          type="text"
                          placeholder={`Ketik keterangan ${currentStatus.toLowerCase()} (opsional)...`}
                          value={currentNote}
                          onChange={(e) => setNotes({ ...notes, [sid]: e.target.value })}
                          className="flex-1 min-w-[160px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#138F81]"
                        />
                      </div>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sticky Bottom Action Bar on Mobile / Desktop */}
        <div className="sticky bottom-4 z-30 flex items-center justify-between gap-3 rounded-3xl bg-white/95 backdrop-blur-md p-4 shadow-xl border border-slate-200 ring-1 ring-slate-900/5">
          <button
            type="button"
            onClick={() => setActiveJadwal(null)}
            disabled={isSaving}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            {isReadOnlyMode ? '← Kembali ke Jadwal' : 'Batal'}
          </button>

          {!isReadOnlyMode ? (
            <button
              type="button"
              onClick={() => void handleSaveAttendance()}
              disabled={isSaving || students.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#138F81] px-6 sm:px-8 py-3 text-xs sm:text-sm font-black text-white shadow-lg shadow-[#138F81]/30 hover:bg-[#0f766a] transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save size={18} />
              <span>{isSaving ? 'Menyimpan Presensi...' : 'Simpan Presensi Santri'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveJadwal(null)}
              className="rounded-2xl bg-[#138F81] px-6 sm:px-8 py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-[#0f766a] cursor-pointer"
            >
              Tutup & Kembali
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Floating Top-Right Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[999999] flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-2xl border border-emerald-200 shadow-emerald-900/20 transition-all animate-in fade-in slide-in-from-top-4 duration-300 max-w-sm">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#138F81] text-white shadow-md shadow-[#138F81]/30">
            <CheckCircle2 size={24} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-800">{toastMessage.title}</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {toastMessage.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Greeting Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#138F81] via-[#0E7A6E] to-[#0A5D54] p-6 text-white shadow-lg shadow-[#138F81]/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-md">
                Madrasah Diniyah PP Qomaruddin
              </span>
              <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-black text-emerald-200 border border-emerald-300/30">
                Ustadz Pengajar
              </span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-black">
              Ahlan Wa Sahlan, {session?.name ?? 'Ustadz'}
            </h1>
            <p className="mt-1 text-xs sm:text-sm font-medium text-emerald-100/90">
              Berikut jadwal mengajar KBM aktif Anda hari ini. Cukup klik jadwal aktif untuk input presensi santri.
            </p>
          </div>

          <div className="flex flex-col items-end rounded-2xl bg-white/10 p-3.5 backdrop-blur-md border border-white/15">
            <span className="text-[11px] font-bold text-emerald-200 flex items-center gap-1.5">
              <Clock3 size={13} /> Waktu Realtime
            </span>
            <span className="text-xl font-black font-mono mt-0.5 text-white">
              {currentTimeStr || '--:--:-- WIB'}
            </span>
            <span className="text-[11px] font-semibold text-emerald-100">
              Hari: <b>{text(dashboard?.hari_ini, 'Hari ini')}</b> ({dashboard?.tanggal as string ?? ''})
            </span>
          </div>
        </div>
      </section>

      {/* Quick Summary Cards */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">Jadwal Hari Ini</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{jadwalHariIni.length}</p>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Sesi KBM hari ini</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
          <p className="text-xs font-bold text-emerald-800">Sedang Aktif</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">
            {num(stats?.jadwal_aktif_sekarang)}
          </p>
          <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">Siap diinput sekarang</p>
        </div>

        <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4 shadow-sm">
          <p className="text-xs font-bold text-teal-800">Sudah Diabsen</p>
          <p className="text-2xl font-black text-teal-700 mt-1">
            {num(stats?.jadwal_sudah_diabsen)}
          </p>
          <p className="text-[11px] font-semibold text-teal-600 mt-0.5">Tersimpan & terkunci</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">Total Santri Diampu</p>
          <p className="text-2xl font-black text-slate-800 mt-1">
            {num(stats?.total_santri_diampu)}
          </p>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Santri aktif</p>
        </div>
      </section>

      {/* SECTION 1: JADWAL HARI INI */}
      <section className="space-y-4 rounded-3xl bg-white p-5 sm:p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Calendar className="text-[#138F81]" size={20} />
              Jadwal Mengajar Hari Ini ({text(dashboard?.hari_ini, 'Hari Ini')})
            </h2>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Jadwal otomatis aktif <b>1 jam sebelum pelajaran dimulai</b> sampai jam selesai (batas toleransi 23:00).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
            ⚠️ {error}
          </div>
        )}

        {jadwalHariIni.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Calendar className="mx-auto mb-2 text-slate-300" size={36} />
            <p className="text-sm font-bold text-slate-600">Tidak ada jadwal mengajar untuk hari ini.</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Silakan cek jadwal besok atau jadwal mingguan di bawah.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jadwalHariIni.map((jadwal) => {
              const isActive = jadwal.can_input && !jadwal.is_done;
              const isDone = jadwal.is_done;
              const isLocked = !jadwal.can_input && !jadwal.is_done;
              const isLate = jadwal.is_late && isActive;

              return (
                <div
                  key={jadwal.id}
                  className={`flex flex-col justify-between rounded-3xl p-5 border transition-all ${
                    isDone
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : isActive
                      ? isLate
                        ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-300/50 shadow-md'
                        : 'bg-gradient-to-br from-emerald-50/80 to-teal-50/60 border-emerald-400 ring-2 ring-emerald-400/50 shadow-lg'
                      : 'bg-slate-50/80 border-slate-200 opacity-90'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Badge Status Waktu */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black ${
                          isDone
                            ? 'bg-emerald-600 text-white'
                            : isActive
                            ? isLate
                              ? 'bg-amber-500 text-white animate-pulse'
                              : 'bg-emerald-500 text-white animate-pulse'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {jadwal.badge_status}
                      </span>

                      <span className="text-xs font-black text-slate-700 font-mono">
                        ⏰ {jadwal.waktu} WIB
                      </span>
                    </div>

                    {/* Mata Pelajaran & Kelas */}
                    <div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">
                        {jadwal.mapel}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="rounded-lg bg-white px-2.5 py-0.5 text-xs font-black text-slate-800 border border-slate-200 shadow-2xs">
                          🏫 Kelas: {jadwal.kelas}
                        </span>
                        {jadwal.ruangan && jadwal.ruangan !== '-' && (
                          <span className="rounded-lg bg-white px-2.5 py-0.5 text-xs font-bold text-slate-600 border border-slate-200">
                            🚪 {jadwal.ruangan}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Pesan Ramah Guru */}
                    <p className="text-xs font-semibold text-slate-600 bg-white/80 p-2.5 rounded-xl border border-slate-100">
                      💡 {jadwal.pesan_ramah}
                    </p>

                    {/* Attendance Result if completed */}
                    {isDone && (
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 pt-1">
                        <span>👥 Rekap: <b>{jadwal.total_hadir} Hadir</b></span>
                        {jadwal.total_izin > 0 && <span>• {jadwal.total_izin} Izin</span>}
                        {jadwal.total_sakit > 0 && <span>• {jadwal.total_sakit} Sakit</span>}
                        {jadwal.total_alfa > 0 && <span>• {jadwal.total_alfa} Alfa</span>}
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="pt-4 mt-2 border-t border-slate-200/60">
                    {isActive ? (
                      <button
                        type="button"
                        onClick={() => void openAttendanceModal(jadwal, false)}
                        className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white shadow-lg transition-transform active:scale-95 cursor-pointer ${
                          isLate
                            ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                            : 'bg-[#138F81] hover:bg-[#0f766a] shadow-[#138F81]/30'
                        }`}
                      >
                        <Play size={16} fill="white" />
                        <span>{isLate ? '👉 Input Presensi (Terlambat)' : '👉 Input Presensi Sekarang'}</span>
                      </button>
                    ) : isDone ? (
                      <button
                        type="button"
                        onClick={() => void openAttendanceModal(jadwal, true)}
                        className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200 transition-colors shadow-xs cursor-pointer"
                      >
                        <Eye size={15} />
                        <span>👁️ Lihat Detail Presensi (Terkunci)</span>
                      </button>
                    ) : (
                      <div className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-bold bg-slate-100 text-slate-500">
                        <Lock size={15} />
                        <span>Terkunci (Aktif 1 Jam Sebelum Pelajaran)</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 2: JADWAL UNTUK BESOK (Ramah Guru Sepuh) */}
      {jadwalBesok.length > 0 && (
        <section className="rounded-3xl bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50/50 p-5 sm:p-6 border border-blue-200/80 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-600 text-white font-black text-xs">
              📌
            </span>
            <div>
              <h3 className="text-base font-black text-blue-950">
                Jadwal Mengajar Untuk Besok ({text(dashboard?.hari_besok, 'Besok')})
              </h3>
              <p className="text-xs font-semibold text-blue-700/80">
                Pengingat awal persiapan materi mengajar untuk esok hari.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {jadwalBesok.map((j) => (
              <div
                key={j.id}
                className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-black text-blue-800">
                    ⏰ {j.waktu} WIB
                  </span>
                  <h4 className="text-base font-extrabold text-slate-800 mt-2">{j.mapel}</h4>
                  <p className="text-xs font-bold text-slate-500 mt-0.5">🏫 Kelas: {j.kelas}</p>
                </div>
                <p className="text-[11px] font-semibold text-blue-600 mt-3 pt-2 border-t border-slate-100">
                  {j.pesan_ramah}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 3: SELURUH JADWAL MINGGUAN */}
      <section className="rounded-3xl bg-white p-5 sm:p-6 shadow-sm ring-1 ring-slate-200 space-y-4">
        <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
          <BookOpen className="text-[#138F81]" size={18} />
          Seluruh Jadwal Mengajar Mingguan Anda
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {jadwalMingguan.map((j) => (
            <div
              key={j.id}
              className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 hover:bg-white hover:border-slate-300 transition-all shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs text-[#138F81] bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                  {j.hari}
                </span>
                <span className="text-xs font-mono font-bold text-slate-600">{j.waktu} WIB</span>
              </div>
              <h4 className="text-sm font-extrabold text-slate-800 mt-2.5">{j.mapel}</h4>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">Kelas: {j.kelas}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
