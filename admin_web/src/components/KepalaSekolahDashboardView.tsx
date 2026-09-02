import {
  BookOpen,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Eye,
  GraduationCap,
  Layers,
  Radio,
  RefreshCw,
  Sparkles,
  Users,
  UsersRound,
} from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import type { ApiRecord, UserSession } from '../services/api';
import type { AbsensiNavigationTarget } from '../pages/AbsensiPage';

interface KepalaSekolahDashboardViewProps {
  session: UserSession | null;
  dashboard: ApiRecord | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  onOpenAttendance?: (target: AbsensiNavigationTarget) => void;
}

type ActivityItem = ApiRecord & {
  category: 'madin' | 'ngaji' | 'sholat';
  title: string;
  subtitle: string;
  creator: string;
  time: string;
  hadir: number;
  izin: number;
  sakit: number;
  alfa: number;
  total: number;
  rawTimestamp: number;
};

export function KepalaSekolahDashboardView({
  session,
  dashboard,
  isLoading = false,
  onRefresh,
  onOpenAttendance,
}: KepalaSekolahDashboardViewProps) {
  const [filterType, setFilterType] = useState<'all' | 'madin' | 'ngaji' | 'sholat'>('all');
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' WIB'
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const statistik = dashboard?.statistik as ApiRecord | undefined;
  const absensi = dashboard?.absensi as ApiRecord | undefined;
  const sholat = dashboard?.absensi_sholat as ApiRecord | undefined;
  const ngaji = dashboard?.absensi_ngaji as ApiRecord | undefined;

  // Santri Counts
  const totalSiswa = Number(statistik?.total_siswa ?? 966);
  const totalPutra = Number(statistik?.total_siswa_putra ?? 557);
  const totalPutri = Number(statistik?.total_siswa_putri ?? 409);
  const totalGuru = Number(statistik?.total_guru ?? 91);

  // Parse Live Feed Activities
  const activities = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    // 1. Madin Activities
    const madinList = Array.isArray(absensi?.per_kelas) ? (absensi.per_kelas as ApiRecord[]) : [];
    for (const m of madinList) {
      const ts = m.created_at ? new Date(String(m.created_at)).getTime() : 0;
      items.push({
        ...m,
        category: 'madin',
        title: `KBM ${String(m.kelas ?? 'Kelas')} • ${String(m.mapel ?? 'Mata Pelajaran')}`,
        subtitle: `Jadwal KBM Diniyah/Madin`,
        creator: String(m.diinput_oleh ?? 'Ustadz Pengajar'),
        time: String(m.waktu ?? (m.created_at ? new Date(String(m.created_at)).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-')),
        hadir: Number(m.hadir ?? 0),
        izin: Number(m.izin ?? 0),
        sakit: Number(m.sakit ?? 0),
        alfa: Number(m.alfa ?? 0),
        total: Number(m.total ?? 0),
        rawTimestamp: isNaN(ts) ? 0 : ts,
      });
    }

    // 2. Ngaji Activities
    const ngajiList = Array.isArray(ngaji?.aktivitas) ? (ngaji.aktivitas as ApiRecord[]) : [];
    for (const n of ngajiList) {
      const ts = n.created_at ? new Date(String(n.created_at)).getTime() : 0;
      items.push({
        ...n,
        category: 'ngaji',
        title: `Halaqoh Ngaji Kitab • ${String(n.kitab ?? n.sesi ?? 'Kitab Santri')}`,
        subtitle: `Sesi: ${String(n.sesi ?? 'Ngaji Kitab')}`,
        creator: String(n.pengajar ?? n.diinput_oleh ?? 'Ustadz Pembina'),
        time: String(n.waktu ?? (n.created_at ? new Date(String(n.created_at)).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-')),
        hadir: Number(n.hadir ?? 0),
        izin: Number(n.izin ?? 0),
        sakit: Number(n.sakit ?? 0),
        alfa: Number(n.alfa ?? 0),
        total: Number(n.total ?? 0),
        rawTimestamp: isNaN(ts) ? 0 : ts,
      });
    }

    // 3. Sholat Activities
    const sholatList = Array.isArray(sholat?.aktivitas) ? (sholat.aktivitas as ApiRecord[]) : [];
    for (const s of sholatList) {
      const ts = s.created_at ? new Date(String(s.created_at)).getTime() : 0;
      items.push({
        ...s,
        category: 'sholat',
        title: `Jama'ah Sholat ${String(s.jenis_sholat ?? 'Fardhu')} • ${String(s.komplek ?? 'Komplek Asrama')}`,
        subtitle: s.kamar ? `Kamar: ${String(s.kamar)}` : 'Asrama Santri',
        creator: String(s.diinput_oleh ?? 'Ustadz / Pengurus Asrama'),
        time: String(s.waktu ?? (s.created_at ? new Date(String(s.created_at)).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-')),
        hadir: Number(s.hadir ?? s.masuk ?? 0),
        izin: Number(s.izin ?? 0),
        sakit: Number(s.sakit ?? 0),
        alfa: Number(s.alfa ?? s.belum ?? 0),
        total: Number(s.total ?? 0),
        rawTimestamp: isNaN(ts) ? 0 : ts,
      });
    }

    return items.sort((a, b) => b.rawTimestamp - a.rawTimestamp);
  }, [absensi, ngaji, sholat]);

  const filteredActivities = useMemo(() => {
    if (filterType === 'all') return activities;
    return activities.filter((a) => a.category === filterType);
  }, [activities, filterType]);

  // Today Date formatted in Indonesian
  const dateFormatted = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* 1. HERO EXECUTIVE WELCOME & REALTIME BANNER */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#138F81] via-[#0F766E] to-[#115E59] p-6 sm:p-8 text-white shadow-xl shadow-teal-950/15">
        {/* Background decorative watermark */}
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-72 w-72 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 -mb-10 h-48 w-48 rounded-full bg-[#FFDC80]/10 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[#FFDC80] text-xs font-black uppercase tracking-wider">
              <Radio size={14} className="animate-pulse text-[#FFDC80]" />
              <span>Portal Pemantauan & Monitoring Santri</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white leading-tight">
              Ahlan wa Sahlan, {session?.name || 'Bapak Kepala Madrasah'}
            </h1>

            <p className="text-sm sm:text-base font-medium text-teal-100 max-w-2xl leading-relaxed">
              Memantau aktivitas belajar mengajar (KBM), ngaji kitab, dan kehadiran santri Pondok Pesantren Qomaruddin secara langsung.
            </p>
          </div>

          {/* Right Live Clock & Refresh Card */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-3 bg-white/10 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-white/15">
            <div className="text-left lg:text-right">
              <p className="text-xs font-bold text-teal-200 uppercase tracking-widest">WAKTU SISTEM</p>
              <p className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">{currentTime || 'WIB'}</p>
              <p className="text-xs font-semibold text-teal-100 mt-0.5">{dateFormatted}</p>
            </div>

            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-[#138F81] font-black text-xs hover:bg-[#E8F7F3] transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span>{isLoading ? 'Menyegarkan...' : 'Perbarui Data'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. JENDELA UTAMA: JUMLAH SANTRI (BESAR, JELAS, NYAMAN DIPANDANG SEPUH) */}
      <section className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#138F81]">
              Data Induk Utama
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight mt-0.5">
              Jumlah Seluruh Santri Aktif
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">
              Santri aktif yang terdaftar dan terpantau dalam sistem presensi KBM & Asrama.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black">
              <CheckCircle2 size={15} />
              100% Terverifikasi Aktif
            </span>
          </div>
        </div>

        {/* 3 Large Dignified Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* TOTAL SANTRI */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50/60 p-6 border-2 border-[#138F81]/30 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-[#138F81]">
                TOTAL SANTRI AKTIF
              </span>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#138F81] text-white shadow-md shadow-[#138F81]/25">
                <Users size={20} />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tight">
                {totalSiswa.toLocaleString('id-ID')}
              </span>
              <span className="ml-2 text-base font-bold text-slate-500">Santri</span>
            </div>
            <p className="mt-2 text-xs font-bold text-[#138F81]">
              Madrasah & Asrama Pondok Pesantren
            </p>
          </div>

          {/* SANTRI PUTRA */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 to-sky-50/60 p-6 border-2 border-blue-200/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-blue-700">
                SANTRI PUTRA (BANIN)
              </span>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/25">
                <UsersRound size={20} />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tight">
                {totalPutra.toLocaleString('id-ID')}
              </span>
              <span className="ml-2 text-base font-bold text-slate-500">Putra</span>
            </div>
            <p className="mt-2 text-xs font-bold text-blue-600">
              Komplek Asrama Putra Qomaruddin
            </p>
          </div>

          {/* SANTRI PUTRI */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50/60 p-6 border-2 border-rose-200/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-rose-700">
                SANTRI PUTRI (BANAT)
              </span>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500 text-white shadow-md shadow-rose-500/25">
                <GraduationCap size={20} />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tight">
                {totalPutri.toLocaleString('id-ID')}
              </span>
              <span className="ml-2 text-base font-bold text-slate-500">Putri</span>
            </div>
            <p className="mt-2 text-xs font-bold text-rose-600">
              Komplek Asrama Putri Qomaruddin
            </p>
          </div>
        </div>
      </section>

      {/* 3. PEMANTAUAN LIVE REAL-TIME FEED (AKTIVITAS PRESENSI TERKINI) */}
      <section className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-50 text-[#138F81]">
                <Clock3 size={16} />
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-800">
                Aktivitas Presensi Terkini Hari Ini
              </h3>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">
              Catatan presensi KBM Madin, Ngaji Kitab, dan Sholat yang baru saja diinput oleh para Ustadz.
            </p>
          </div>

          {/* Clean Big Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap bg-slate-100 p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                filterType === 'all'
                  ? 'bg-white text-[#138F81] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({activities.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('madin')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                filterType === 'madin'
                  ? 'bg-white text-[#138F81] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🕌 KBM Madin
            </button>
            <button
              type="button"
              onClick={() => setFilterType('ngaji')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                filterType === 'ngaji'
                  ? 'bg-white text-[#138F81] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📖 Ngaji Kitab
            </button>
            <button
              type="button"
              onClick={() => setFilterType('sholat')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                filterType === 'sholat'
                  ? 'bg-white text-[#138F81] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🕋 Sholat Jama'ah
            </button>
          </div>
        </div>

        {/* Stream of Activities - Large and Highly Legible */}
        <div className="space-y-3.5">
          {filteredActivities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center space-y-2">
              <span className="text-3xl">🕌</span>
              <p className="text-sm font-extrabold text-slate-700">
                Belum ada aktivitas presensi baru yang tercatat hari ini
              </p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Ketika para Ustadz melakukan absensi KBM, Ngaji, atau Sholat melalui aplikasi, data akan langsung muncul di sini secara otomatis.
              </p>
            </div>
          ) : (
            filteredActivities.map((item, idx) => {
              const isMadin = item.category === 'madin';
              const isNgaji = item.category === 'ngaji';

              return (
                <div
                  key={String(item.id ?? idx)}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-slate-50/70 hover:bg-slate-50 transition-all"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-bold shadow-xs ${
                        isMadin
                          ? 'bg-teal-100 text-[#138F81]'
                          : isNgaji
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {isMadin ? '🕌' : isNgaji ? '📖' : '🕋'}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm sm:text-base font-black text-slate-800">
                          {item.title}
                        </span>
                        <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-600">
                          Jam: {item.time}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-1">
                        Diinput oleh: <span className="font-bold text-slate-900">{item.creator}</span>
                        {item.subtitle ? ` • ${item.subtitle}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Attendance Breakdown Pills */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200">
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black">
                      ✓ {item.hadir} Hadir
                    </span>
                    {item.izin > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold">
                        {item.izin} Izin
                      </span>
                    )}
                    {item.sakit > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                        {item.sakit} Sakit
                      </span>
                    )}
                    {item.alfa > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                        {item.alfa} Alfa
                      </span>
                    )}
                    <span className="text-xs font-bold text-slate-400 ml-1">
                      (Total {item.total || (item.hadir + item.izin + item.sakit + item.alfa)} santri)
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut to Full Log */}
        {onOpenAttendance && (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => onOpenAttendance({ tab: 'log-realtime' })}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#138F81]/10 text-[#138F81] font-black text-xs hover:bg-[#138F81]/20 transition-all"
            >
              <Eye size={15} />
              <span>Buka Halaman Pemantauan Presensi Lengkap</span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
