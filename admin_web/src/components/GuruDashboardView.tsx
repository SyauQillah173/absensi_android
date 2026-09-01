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
    <div className="space-y-6">
      {/* 1. HERO WELCOME BANNER FOR GURU */}
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#0C6B60] via-[#138F81] to-[#1BB5A4] p-6 lg:p-8 text-white shadow-xl shadow-[#138F81]/15">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute right-20 bottom-0 -mb-16 h-48 w-48 rounded-full bg-emerald-300/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1 text-xs font-extrabold backdrop-blur-md border border-white/20">
              <Sparkles size={14} className="text-amber-300" />
              <span>Portal Ustadz & Ustadzah Pengajar</span>
              {guruCode ? (
                <span className="rounded-full bg-amber-400 text-slate-900 px-2 py-0.5 text-[11px] font-black">
                  Kode: {guruCode}
                </span>
              ) : null}
            </div>

            <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-white drop-shadow-sm">
              Assalamu'alaikum, {guruName}
            </h1>

            <p className="text-sm font-medium text-emerald-50 max-w-2xl leading-relaxed">
              Selamat mengajar dan berkhidmah di Madrasah Diniyah Pondok Pesantren Qomaruddin.
              Semoga setiap ilmu yang diajarkan membawa keberkahan dunia dan akhirat.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-semibold text-emerald-100">
              <span className="flex items-center gap-1.5 bg-black/15 px-3 py-1 rounded-xl">
                <Calendar size={14} className="text-emerald-200" />
                {todayFormatted}
              </span>
              <span className="flex items-center gap-1.5 bg-black/15 px-3 py-1 rounded-xl">
                <GraduationCap size={14} className="text-emerald-200" />
                {unitKerja}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-2xl bg-white/20 hover:bg-white/30 active:scale-95 px-4 py-2.5 text-xs font-extrabold text-white backdrop-blur-md transition-all border border-white/25 shadow-sm"
              type="button"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
              <span>{isLoading ? 'Menyinkron...' : 'Perbarui'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. STATS OVERVIEW CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Jadwal Hari Ini */}
        <div className="rounded-[22px] bg-white p-5 border border-slate-100 shadow-lg shadow-black/5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Jadwal Mengajar</span>
            <div className="h-10 w-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <CalendarCheck size={20} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-slate-800">{totalJadwal}</div>
            <p className="text-xs font-bold text-slate-500 mt-1">
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
        <div className="rounded-[22px] bg-white p-5 border border-slate-100 shadow-lg shadow-black/5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Santri Diampu</span>
            <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Users size={20} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-slate-800">{totalSantri}</div>
            <p className="text-xs font-bold text-slate-500 mt-1">
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
          <div className="rounded-[22px] bg-white p-5 border border-slate-100 shadow-lg shadow-black/5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Presensi Sholat</span>
              <div className="h-10 w-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Landmark size={20} />
              </div>
            </div>
            <div className="my-3">
              <div className="text-3xl font-black text-slate-800">
                {Number(sholatSummary?.total ?? 0)}
              </div>
              <p className="text-xs font-bold text-slate-500 mt-1">
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
          <div className="rounded-[22px] bg-white p-5 border border-slate-100 shadow-lg shadow-black/5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Status Presensi</span>
              <div className="h-10 w-10 rounded-2xl bg-teal-50 text-[#138F81] flex items-center justify-center font-bold">
                <UserCheck size={20} />
              </div>
            </div>
            <div className="my-3">
              <div className="text-3xl font-black text-[#138F81]">
                {jadwalPending === 0 && totalJadwal > 0 ? 'Tuntas ✓' : `${jadwalDone}/${totalJadwal}`}
              </div>
              <p className="text-xs font-bold text-slate-500 mt-1">
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
        <div className="rounded-[22px] bg-white p-5 border border-slate-100 shadow-lg shadow-black/5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Nilai & Hafalan</span>
            <div className="h-10 w-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <ListChecks size={20} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-slate-800">KBM</div>
            <p className="text-xs font-bold text-slate-500 mt-1">
              Input nilai harian, UTS, UAS & setor hafalan
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
      <section className="rounded-[28px] bg-white p-6 lg:p-7 border border-slate-100 shadow-xl shadow-black/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2.5">
              <BookOpenCheck className="text-[#138F81]" size={22} />
              Jadwal Mengajar Hari Ini
            </h2>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Daftar mata pelajaran dan kelas yang harus diabsen pada {todayFormatted}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenAttendance({ tab: 'madin-input' })}
            className="inline-flex items-center gap-2 rounded-xl bg-[#138F81] px-4 py-2 text-xs font-extrabold text-white shadow-md shadow-[#138F81]/20 hover:bg-[#0D6B60] transition"
          >
            <BookOpen size={15} />
            <span>Form Presensi KBM</span>
          </button>
        </div>

        <div className="mt-5">
          {jadwalList.length === 0 ? (
            <div className="rounded-2xl bg-slate-50/80 border border-dashed border-slate-200 p-8 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-[#138F81] mb-3">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="text-sm font-extrabold text-slate-700">
                Alhamdulillah, tidak ada jadwal KBM untuk Ustadz/Ustadzah hari ini.
              </h3>
              <p className="text-xs font-semibold text-slate-500 mt-1 max-w-md mx-auto">
                Anda tetap dapat melihat rekap kehadiran santri sebelumnya atau menginput nilai santri melalui menu navigasi.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    className={`rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                      isCompleted
                        ? 'bg-emerald-50/40 border-emerald-200/80'
                        : 'bg-amber-50/40 border-amber-200/80 hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200/60 shadow-2xs">
                          <Clock size={12} className="text-[#138F81]" />
                          {waktuJam}
                        </span>
                        <span
                          className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-900 animate-pulse'
                          }`}
                        >
                          {isCompleted ? '✓ Sudah Diabsen' : 'Belum Diabsen'}
                        </span>
                      </div>

                      <h4 className="text-base font-black text-slate-800 line-clamp-1">
                        {mapelName}
                      </h4>
                      <p className="text-xs font-bold text-[#138F81] mt-0.5">
                        Kelas / Sifir: <span className="text-slate-700">{kelasName}</span>
                      </p>

                      {isCompleted && siswaTotal > 0 ? (
                        <div className="mt-3 flex items-center gap-2 text-[11px] font-bold bg-white/80 p-2 rounded-xl border border-emerald-100">
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
                      className={`w-full mt-4 py-2.5 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                        isCompleted
                          ? 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
                          : 'bg-[#138F81] text-white hover:bg-[#0D6B60] shadow-md shadow-[#138F81]/20'
                      }`}
                    >
                      <BookOpenCheck size={15} />
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
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Boolean(hakAkses.absen_ngaji) && (
            <div className="rounded-[28px] bg-white p-6 border border-slate-100 shadow-xl shadow-black/5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-indigo-700 font-extrabold text-sm mb-2">
                  <BookMarked size={18} />
                  <span>Pengajian Kitab Kuning</span>
                </div>
                <h3 className="text-lg font-black text-slate-800">
                  Presensi Ngaji Kitab
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  Catat kehadiran santri pada halaqah dan jadwal ngaji kitab yang Anda ampu.
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">
                  Total diabsen hari ini: <span className="font-extrabold text-indigo-700">{Number(ngajiSummary?.total ?? 0)} Santri</span>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenAttendance({ tab: 'ngaji' })}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm transition flex items-center gap-1.5"
                >
                  <span>Buka Form Ngaji</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {Boolean(hakAkses.absen_sholat) && (
            <div className="rounded-[28px] bg-white p-6 border border-slate-100 shadow-xl shadow-black/5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-teal-700 font-extrabold text-sm mb-2">
                  <Landmark size={18} />
                  <span>Sholat Jama'ah Asrama</span>
                </div>
                <h3 className="text-lg font-black text-slate-800">
                  Presensi Sholat Santri
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  Catat kehadiran sholat fardhu berjama'ah santri pada komplek dan kamar yang ditugaskan.
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">
                  Total diabsen: <span className="font-extrabold text-teal-700">{Number(sholatSummary?.total ?? 0)} Santri</span>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenAttendance({ tab: 'sholat' })}
                  className="px-4 py-2 rounded-xl bg-[#138F81] hover:bg-[#0D6B60] text-white text-xs font-extrabold shadow-sm transition flex items-center gap-1.5"
                >
                  <span>Buka Presensi Sholat</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 5. MUTIARA HIKMAH / DO'A GURU */}
      <footer className="rounded-2xl bg-emerald-50/70 border border-emerald-200/50 p-4 text-center">
        <p className="text-xs font-bold text-emerald-900 italic">
          "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ"
        </p>
        <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">
          "Sebaik-baik kalian adalah orang yang mempelajari Al-Qur'an dan mengajarkannya." (HR. Bukhari)
        </p>
      </footer>
    </div>
  );
}
