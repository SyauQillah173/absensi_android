import {
  ArrowRight,
  BookMarked,
  BookOpen,
  BookOpenCheck,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  GraduationCap,
  Landmark,
  ListChecks,
  RefreshCw,
  Sparkles,
  UserCheck,
  Users
} from 'lucide-react';
import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { AbsensiNavigationTarget } from '../pages/AbsensiPage';
import type { ApiRecord } from '../services/api';

interface GuruDashboardViewProps {
  dashboard: ApiRecord | null;
  onRefresh: () => void;
  isLoading: boolean;
  onOpenAttendance: (target: AbsensiNavigationTarget) => void;
  onNavigateToNilai?: () => void;
}

export function GuruDashboardView({
  dashboard,
  onRefresh,
  isLoading,
  onOpenAttendance,
  onNavigateToNilai
}: GuruDashboardViewProps) {
  const { session } = useAuth();

  const guru = (dashboard?.guru as ApiRecord | undefined) || {};
  const stats = (dashboard?.stats as ApiRecord | undefined) || {};
  const hakAkses = (dashboard?.hak_akses as ApiRecord | undefined) || {
    absen_madin: true,
    absen_sholat: false,
    absen_ngaji: false,
    nilai: true
  };
  const jadwalList = Array.isArray(dashboard?.jadwal_hari_ini)
    ? (dashboard.jadwal_hari_ini as ApiRecord[])
    : [];

  const sholatSummary = dashboard?.absensi_sholat as ApiRecord | undefined;
  const ngajiSummary = dashboard?.absensi_ngaji as ApiRecord | undefined;

  const todayFormatted = useMemo(() => {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date());
  }, []);

  const totalJadwal = Number(stats.total_jadwal_hari_ini ?? jadwalList.length);
  const jadwalDone = Number(stats.jadwal_sudah_diabsen ?? jadwalList.filter((j) => String(j.status_absen) === 'completed').length);
  const jadwalPending = Number(stats.jadwal_belum_diabsen ?? (totalJadwal - jadwalDone));
  const totalSantri = Number(stats.total_santri_diampu ?? 0);

  const guruName = String(guru.name || session?.name || 'Ustadz / Ustadzah');
  const guruCode = guru.kode_guru ? String(guru.kode_guru) : '';
  const unitKerja = String(guru.unit_kerja || 'Madrasah Diniyah PP Qomaruddin');

  return (
    <div className="w-full max-w-full space-y-4 sm:space-y-6 overflow-hidden">
      {/* 1. HERO WELCOME BANNER FOR GURU (FULL RESPONSIVE) */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-[28px] bg-gradient-to-r from-[#0C6B60] via-[#138F81] to-[#1BB5A4] p-4 sm:p-6 lg:p-8 text-white shadow-xl shadow-[#138F81]/15">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 sm:h-64 sm:w-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute right-12 bottom-0 -mb-16 h-36 w-36 sm:h-48 sm:w-48 rounded-full bg-emerald-300/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
          <div className="min-w-0 flex-1 space-y-2 sm:space-y-2.5">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] sm:text-xs font-extrabold backdrop-blur-md border border-white/20">
                <Sparkles size={13} className="text-amber-300 shrink-0" />
                <span>Portal Guru & Ustadz</span>
              </div>
              {guruCode ? (
                <span className="rounded-full bg-amber-400 text-slate-900 px-2 py-0.5 text-[10px] sm:text-[11px] font-black shrink-0">
                  Kode: {guruCode}
                </span>
              ) : null}
            </div>

            {/* Teacher Name */}
            <h1 className="text-lg sm:text-2xl lg:text-3xl font-black tracking-tight text-white drop-shadow-sm break-words leading-tight">
              Assalamu'alaikum, <span className="block sm:inline">{guruName}</span>
            </h1>

            {/* Description */}
            <p className="text-xs sm:text-sm font-medium text-emerald-50 max-w-2xl leading-relaxed">
              Selamat mengajar dan berkhidmah di Madrasah Diniyah Pondok Pesantren Qomaruddin. Semoga ilmu yang diajarkan membawa keberkahan.
            </p>

            {/* Sub Info Chips */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1 text-[11px] sm:text-xs font-semibold text-emerald-100">
              <span className="inline-flex items-center gap-1.5 bg-black/15 px-2.5 py-1 rounded-xl">
                <Calendar size={13} className="text-emerald-200 shrink-0" />
                <span>{todayFormatted}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 bg-black/15 px-2.5 py-1 rounded-xl max-w-full">
                <GraduationCap size={13} className="text-emerald-200 shrink-0" />
                <span className="truncate">{unitKerja}</span>
              </span>
            </div>
          </div>

          {/* Refresh Button */}
          <div className="flex shrink-0 items-center self-start sm:self-auto">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-xl sm:rounded-2xl bg-white/20 hover:bg-white/30 active:scale-95 px-3 py-1.5 sm:px-4 sm:py-2.5 text-xs font-extrabold text-white backdrop-blur-md transition-all border border-white/25 shadow-sm"
              type="button"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              <span>{isLoading ? 'Menyinkron...' : 'Perbarui'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. STATS OVERVIEW CARDS (RESPONSIVE GRID) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Jadwal Hari Ini */}
        <div className="rounded-2xl sm:rounded-[22px] bg-white p-4 sm:p-5 border border-slate-100 shadow-md sm:shadow-lg shadow-black/5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500">Jadwal Mengajar</span>
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
              <CalendarCheck size={18} />
            </div>
          </div>
          <div className="my-2.5 sm:my-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-800">{totalJadwal}</div>
            <p className="text-[11px] sm:text-xs font-bold text-slate-500 mt-0.5">
              {totalJadwal > 0 ? (
                <>
                  <span className="text-emerald-600 font-extrabold">{jadwalDone} Selesai</span>
                  {' • '}
                  <span className={jadwalPending > 0 ? 'text-amber-600 font-extrabold' : 'text-slate-400'}>
                    {jadwalPending} Belum
                  </span>
                </>
              ) : (
                'Tidak ada jadwal hari ini'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenAttendance({ tab: 'madin-input' })}
            className="w-full mt-1 text-xs font-extrabold text-[#138F81] bg-[#138F81]/10 hover:bg-[#138F81] hover:text-white py-2 rounded-xl transition flex items-center justify-center gap-1.5"
          >
            <span>Buka Presensi Madin</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Card 2: Santri Diampu */}
        <div className="rounded-2xl sm:rounded-[22px] bg-white p-4 sm:p-5 border border-slate-100 shadow-md sm:shadow-lg shadow-black/5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500">Santri Diampu</span>
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
              <Users size={18} />
            </div>
          </div>
          <div className="my-2.5 sm:my-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-800">{totalSantri}</div>
            <p className="text-[11px] sm:text-xs font-bold text-slate-500 mt-0.5">
              Santri aktif di kelas yang diampu
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenAttendance({ tab: 'madin' })}
            className="w-full mt-1 text-xs font-extrabold text-slate-700 bg-slate-100 hover:bg-slate-200 py-2 rounded-xl transition flex items-center justify-center gap-1.5"
          >
            <span>Lihat Rekap Kehadiran</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Card 3: Presensi Sholat (Jika Ada Akses) / Status */}
        {Boolean(hakAkses.absen_sholat) ? (
          <div className="rounded-2xl sm:rounded-[22px] bg-white p-4 sm:p-5 border border-slate-100 shadow-md sm:shadow-lg shadow-black/5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500">Presensi Sholat</span>
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                <Landmark size={18} />
              </div>
            </div>
            <div className="my-2.5 sm:my-3">
              <div className="text-2xl sm:text-3xl font-black text-slate-800">
                {Number(sholatSummary?.total ?? 0)}
              </div>
              <p className="text-[11px] sm:text-xs font-bold text-slate-500 mt-0.5">
                Santri diabsen sholat jama'ah hari ini
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenAttendance({ tab: 'sholat' })}
              className="w-full mt-1 text-xs font-extrabold text-indigo-700 bg-indigo-50 hover:bg-indigo-600 hover:text-white py-2 rounded-xl transition flex items-center justify-center gap-1.5"
            >
              <span>Presensi Sholat</span>
              <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <div className="rounded-2xl sm:rounded-[22px] bg-white p-4 sm:p-5 border border-slate-100 shadow-md sm:shadow-lg shadow-black/5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500">Status Presensi</span>
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-teal-50 text-[#138F81] flex items-center justify-center font-bold shrink-0">
                <UserCheck size={18} />
              </div>
            </div>
            <div className="my-2.5 sm:my-3">
              <div className="text-2xl sm:text-3xl font-black text-[#138F81]">
                {jadwalPending === 0 && totalJadwal > 0 ? 'Tuntas ✓' : `${jadwalDone}/${totalJadwal}`}
              </div>
              <p className="text-[11px] sm:text-xs font-bold text-slate-500 mt-0.5">
                Progress absensi KBM hari ini
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenAttendance({ tab: 'madin-input' })}
              className="w-full mt-1 text-xs font-extrabold text-[#138F81] bg-[#138F81]/10 hover:bg-[#138F81] hover:text-white py-2 rounded-xl transition flex items-center justify-center gap-1.5"
            >
              <span>Catat Absensi</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Card 4: Nilai & Hafalan */}
        <div className="rounded-2xl sm:rounded-[22px] bg-white p-4 sm:p-5 border border-slate-100 shadow-md sm:shadow-lg shadow-black/5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500">Nilai & Hafalan</span>
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0">
              <ListChecks size={18} />
            </div>
          </div>
          <div className="my-2.5 sm:my-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-800">KBM</div>
            <p className="text-[11px] sm:text-xs font-bold text-slate-500 mt-0.5">
              Input nilai harian, UTS, UAS & hafalan
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onNavigateToNilai) {
                onNavigateToNilai();
              } else {
                window.location.hash = '#nilai';
              }
            }}
            className="w-full mt-1 text-xs font-extrabold text-rose-700 bg-rose-50 hover:bg-rose-600 hover:text-white py-2 rounded-xl transition flex items-center justify-center gap-1.5"
          >
            <span>Input Nilai & Hafalan</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* 3. MAIN SECTION: JADWAL MENGAJAR HARI INI */}
      <section className="rounded-2xl sm:rounded-[28px] bg-white p-4 sm:p-6 lg:p-7 border border-slate-100 shadow-xl shadow-black/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
              <BookOpenCheck className="text-[#138F81] shrink-0" size={20} />
              <span>Jadwal Mengajar Hari Ini</span>
            </h2>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-0.5">
              Daftar mata pelajaran & kelas yang harus diabsen pada {todayFormatted}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenAttendance({ tab: 'madin-input' })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#138F81] px-3.5 py-2 text-xs font-extrabold text-white shadow-md shadow-[#138F81]/20 hover:bg-[#0D6B60] transition self-start sm:self-auto shrink-0"
          >
            <BookOpen size={14} />
            <span>Form Presensi KBM</span>
          </button>
        </div>

        <div className="mt-4 sm:mt-5">
          {jadwalList.length === 0 ? (
            <div className="rounded-2xl bg-slate-50/80 border border-dashed border-slate-200 p-6 sm:p-8 text-center">
              <div className="mx-auto grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-2xl bg-emerald-50 text-[#138F81] mb-2.5 sm:mb-3">
                <CheckCircle2 size={26} />
              </div>
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-700">
                Alhamdulillah, tidak ada jadwal KBM untuk Ustadz/Ustadzah hari ini.
              </h3>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-1 max-w-md mx-auto">
                Anda tetap dapat melihat rekap kehadiran santri atau menginput nilai melalui menu navigasi.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {jadwalList.map((j) => {
                const isCompleted = String(j.status_absen) === 'completed';
                const mapelName = String(j.mapel || '-');
                const kelasName = String(j.kelas || '-');
                const waktuJam = String(j.waktu || 'Jam KBM');
                const hadirCount = Number(j.total_hadir ?? 0);
                const izinCount = Number(j.total_izin ?? 0);
                const sakitCount = Number(j.total_sakit ?? 0);
                const alfaCount = Number(j.total_alfa ?? 0);
                const siswaTotal = Number(j.total_siswa ?? 0);

                return (
                  <div
                    key={String(j.id)}
                    className={`rounded-2xl p-4 sm:p-5 border transition-all flex flex-col justify-between ${
                      isCompleted
                        ? 'bg-emerald-50/40 border-emerald-200/80'
                        : 'bg-amber-50/40 border-amber-200/80 hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200/60 shadow-2xs">
                          <Clock size={11} className="text-[#138F81] shrink-0" />
                          <span>{waktuJam}</span>
                        </span>
                        <span
                          className={`text-[10px] sm:text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-900 animate-pulse'
                          }`}
                        >
                          {isCompleted ? '✓ Sudah Diabsen' : 'Belum Diabsen'}
                        </span>
                      </div>

                      <h4 className="text-sm sm:text-base font-black text-slate-800 line-clamp-1">
                        {mapelName}
                      </h4>
                      <p className="text-xs font-bold text-[#138F81] mt-0.5">
                        Kelas: <span className="text-slate-700">{kelasName}</span>
                      </p>

                      {isCompleted && siswaTotal > 0 ? (
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-bold bg-white/80 p-2 rounded-xl border border-emerald-100">
                          <span className="text-emerald-700">Hadir: {hadirCount}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-amber-700">Izin: {izinCount}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-rose-700">Sakit: {sakitCount}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-600">Alfa: {alfaCount}</span>
                        </div>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onOpenAttendance({
                          tab: 'madin-input',
                          classId: Number(j.class_id ?? 0),
                          mapelId: Number(j.mapel_id ?? 0),
                          jadwalId: Number(j.id ?? 0)
                        })
                      }
                      className={`w-full mt-3 sm:mt-4 py-2 sm:py-2.5 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                        isCompleted
                          ? 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
                          : 'bg-[#138F81] text-white hover:bg-[#0D6B60] shadow-md shadow-[#138F81]/20'
                      }`}
                    >
                      <BookOpenCheck size={14} />
                      <span>{isCompleted ? 'Edit Presensi Kelas Ini' : 'Isi Presensi Kelas Ini'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 4. MODUL TAMBAHAN (NGAJI KITAB / SHOLAT) */}
      {(Boolean(hakAkses.absen_ngaji) || Boolean(hakAkses.absen_sholat)) && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
          {Boolean(hakAkses.absen_ngaji) && (
            <div className="rounded-2xl sm:rounded-[28px] bg-white p-4 sm:p-6 border border-slate-100 shadow-xl shadow-black/5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-indigo-700 font-extrabold text-xs sm:text-sm mb-1.5 sm:mb-2">
                  <BookMarked size={16} />
                  <span>Pengajian Kitab Kuning</span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-800">
                  Presensi Ngaji Kitab
                </h3>
                <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-1">
                  Catat kehadiran santri pada halaqah dan jadwal ngaji kitab yang Anda ampu.
                </p>
              </div>

              <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] sm:text-xs font-bold text-slate-600">
                  Diabsen: <span className="font-extrabold text-indigo-700">{Number(ngajiSummary?.total ?? 0)} Santri</span>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenAttendance({ tab: 'ngaji' })}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm transition flex items-center gap-1.5"
                >
                  <span>Buka Form</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}

          {Boolean(hakAkses.absen_sholat) && (
            <div className="rounded-2xl sm:rounded-[28px] bg-white p-4 sm:p-6 border border-slate-100 shadow-xl shadow-black/5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-teal-700 font-extrabold text-xs sm:text-sm mb-1.5 sm:mb-2">
                  <Landmark size={16} />
                  <span>Sholat Jama'ah Asrama</span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-800">
                  Presensi Sholat Santri
                </h3>
                <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-1">
                  Catat kehadiran sholat fardhu berjama'ah santri pada komplek dan kamar pondok.
                </p>
              </div>

              <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] sm:text-xs font-bold text-slate-600">
                  Diabsen: <span className="font-extrabold text-teal-700">{Number(sholatSummary?.total ?? 0)} Santri</span>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenAttendance({ tab: 'sholat' })}
                  className="px-3.5 py-1.5 rounded-xl bg-[#138F81] hover:bg-[#0D6B60] text-white text-xs font-extrabold shadow-sm transition flex items-center gap-1.5"
                >
                  <span>Buka Form</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 5. MUTIARA HIKMAH / DO'A GURU */}
      <footer className="rounded-xl sm:rounded-2xl bg-emerald-50/70 border border-emerald-200/50 p-3 sm:p-4 text-center">
        <p className="text-[11px] sm:text-xs font-bold text-emerald-900 italic">
          "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ"
        </p>
        <p className="text-[10px] sm:text-[11px] font-semibold text-emerald-700 mt-0.5">
          "Sebaik-baik kalian adalah orang yang mempelajari Al-Qur'an dan mengajarkannya." (HR. Bukhari)
        </p>
      </footer>
    </div>
  );
}
