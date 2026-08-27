import {
  BookMarked,
  BookOpenCheck,
  Building2,
  CalendarCheck,
  ChevronRight,
  DoorOpen,
  Filter,
  GraduationCap,
  Home,
  Landmark,
  Layers,
  RefreshCw,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  UsersRound,
  WalletCards
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useAuth } from '../auth/AuthContext';
import { DataTable } from '../components/DataTable';
import { MoneyText, formatCompactMoney, formatMoney } from '../components/MoneyText';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { api, type ApiRecord } from '../services/api';
import type { AbsensiNavigationTarget } from './AbsensiPage';

function CustomClassTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-2xl border border-slate-100 bg-white/95 backdrop-blur-md p-3.5 shadow-xl text-xs">
        <p className="font-black text-slate-800 text-sm mb-1.5">{data.name || data.kelas}</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="font-semibold text-slate-500">Total Santri:</span>
            <span className="font-black text-[#138F81] text-sm">{data.value} Siswa</span>
          </div>
          {(data.putra !== undefined || data.putri !== undefined) && (
            <div className="flex items-center gap-3 pt-1.5 border-t border-slate-100 text-[11px] font-bold">
              <span className="text-sky-600 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sky-500 inline-block" /> Putra: {data.putra ?? 0}
              </span>
              <span className="text-rose-500 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" /> Putri: {data.putri ?? 0}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}

function CustomPondokTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const capacity = Number(data.capacity || 0);
    const value = Number(data.value || 0);
    const pct = capacity > 0 ? Math.round((value / capacity) * 100) : null;
    return (
      <div className="rounded-2xl border border-slate-100 bg-white/95 backdrop-blur-md p-3.5 shadow-xl text-xs">
        <p className="font-black text-slate-800 text-sm mb-1">{data.name}</p>
        {data.komplek && data.komplek !== '-' && data.komplek !== data.name && (
          <p className="text-[11px] text-teal-700 font-bold mb-1.5">Komplek / Asrama: {data.komplek}</p>
        )}
        <div className="flex items-center justify-between gap-4">
          <span className="font-semibold text-slate-500">Santri Penghuni:</span>
          <span className="font-black text-teal-900 text-sm">{value} Santri</span>
        </div>
        {pct !== null && (
          <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[11px] font-bold text-slate-600 flex items-center justify-between gap-2">
            <span>Kapasitas: {capacity}</span>
            <span className={pct > 90 ? 'text-rose-600' : 'text-emerald-600'}>Terisi {pct}%</span>
          </div>
        )}
      </div>
    );
  }
  return null;
}

interface DashboardPageProps {
  onOpenFinance: () => void;
  onOpenAttendance: (target: AbsensiNavigationTarget) => void;
}

type DashboardActivity = ApiRecord & {
  activity_title: string;
  activity_detail: string;
  activity_target: AbsensiNavigationTarget;
};

function getNumber(source: ApiRecord | undefined, key: string): number {
  return Number(source?.[key] ?? 0);
}

function statusTone(tone: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (tone === 'success') return 'success';
  if (tone === 'warning') return 'warning';
  if (tone === 'danger') return 'danger';
  return 'neutral';
}

function asRecord(value: unknown): ApiRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ApiRecord) : undefined;
}

function studentName(row: ApiRecord): string {
  const student = asRecord(row.siswa);
  return String(row.siswa_nama ?? row.nama_siswa ?? student?.nama ?? row.nama ?? 'Santri');
}

function activityTimestamp(row: ApiRecord): number {
  const value = row.created_at;
  if (!value) return 0;
  const timestamp = new Date(String(value)).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function DashboardPage({ onOpenFinance, onOpenAttendance }: DashboardPageProps) {
  const { session, canView } = useAuth();
  const [dashboard, setDashboard] = useState<ApiRecord | null>(null);
  const [payments, setPayments] = useState<ApiRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setError('');
      setIsLoading(true);
    }
    try {
      const [dashboardResult, paymentResult] = await Promise.all([
        api.dashboard(),
        api.paymentToday().catch(() => ({ success: true, data: [] }))
      ]);
      setDashboard(dashboardResult);
      setPayments(Array.isArray(paymentResult.data) ? paymentResult.data : []);
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Dashboard gagal dimuat');
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [session?.id]);

  useEffect(() => {
    void load();

    const refreshVisibleDashboard = () => {
      if (document.visibilityState === 'visible') {
        void load(true);
      }
    };
    const intervalId = window.setInterval(refreshVisibleDashboard, 60_000);
    document.addEventListener('visibilitychange', refreshVisibleDashboard);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshVisibleDashboard);
    };
  }, [load]);

  const statistik = dashboard?.statistik as ApiRecord | undefined;
  const pembayaran = dashboard?.pembayaran as ApiRecord | undefined;
  const sholat = dashboard?.absensi_sholat as ApiRecord | undefined;
  const ngaji = dashboard?.absensi_ngaji as ApiRecord | undefined;
  const absensi = dashboard?.absensi as ApiRecord | undefined;
  const latestMadin = Array.isArray(absensi?.per_kelas) ? (absensi.per_kelas as ApiRecord[]) : [];
  const latestPrayer = Array.isArray(sholat?.aktivitas) ? (sholat.aktivitas as ApiRecord[]) : [];
  const latestNgaji = Array.isArray(ngaji?.aktivitas) ? (ngaji.aktivitas as ApiRecord[]) : [];
  const latestAttendance: DashboardActivity[] = [
    ...latestMadin.map((item) => ({
      ...item,
      activity_title: 'Absensi Madin/Diniyah',
      activity_detail: [item.kelas, item.mapel].filter(Boolean).join(' • '),
      activity_target: {
        tab: 'madin-input',
        classId: Number(item.class_id ?? 0),
        mapelId: Number(item.mapel_id ?? 0),
        jadwalId: Number(item.jadwal_id ?? 0)
      } satisfies AbsensiNavigationTarget
    })),
    ...latestNgaji.map((item) => ({
      ...item,
      activity_title: 'Absensi Ngaji Kitab',
      activity_detail: [item.sesi, item.kitab, item.pengajar].filter(Boolean).join(' • '),
      activity_target: { tab: 'ngaji' } satisfies AbsensiNavigationTarget
    })),
    ...latestPrayer.map((item) => ({
      ...item,
      activity_title: "Absensi Jama'ah Sholat",
      activity_detail: [item.jenis_sholat, item.komplek, item.kamar].filter(Boolean).join(' • '),
      activity_target: { tab: 'sholat' } satisfies AbsensiNavigationTarget
    }))
  ].sort((left, right) => activityTimestamp(right) - activityTimestamp(left));
  const showAbsensi = canView('absensi');
  const showFinance = canView('keuangan');

  // Chart filters & calculations
  const [selectedClassTier, setSelectedClassTier] = useState<string>('all');
  const [selectedPondokView, setSelectedPondokView] = useState<'komplek' | 'kamar'>('komplek');

  const rawClasses = useMemo(() => {
    return Array.isArray(statistik?.siswa_per_kelas) ? (statistik.siswa_per_kelas as ApiRecord[]) : [];
  }, [statistik?.siswa_per_kelas]);

  const filteredClasses = useMemo(() => {
    if (selectedClassTier === 'all') return rawClasses;
    if (selectedClassTier === 'top10') {
      return [...rawClasses].sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0)).slice(0, 10);
    }
    return rawClasses.filter((item) =>
      String(item.name || item.kelas || '').toLowerCase().includes(selectedClassTier.toLowerCase())
    );
  }, [rawClasses, selectedClassTier]);

  const genderData = useMemo(() => {
    return Array.isArray(statistik?.siswa_per_gender) ? (statistik.siswa_per_gender as ApiRecord[]) : [];
  }, [statistik?.siswa_per_gender]);

  const totalGender = useMemo(() => {
    return genderData.reduce((acc, curr) => acc + Number(curr.value ?? 0), 0) || Number(statistik?.total_siswa ?? 0);
  }, [genderData, statistik?.total_siswa]);

  const putraData = genderData.find(
    (g) =>
      String(g.name).toLowerCase().includes('putra') ||
      String(g.name).toLowerCase().includes('laki') ||
      g.gender === 'L'
  );
  const putriData = genderData.find(
    (g) =>
      String(g.name).toLowerCase().includes('putri') ||
      String(g.name).toLowerCase().includes('perempuan') ||
      g.gender === 'P'
  );

  const putraCount = Number(putraData?.value ?? 0);
  const putriCount = Number(putriData?.value ?? 0);
  const putraPct = totalGender > 0 ? ((putraCount / totalGender) * 100).toFixed(1) : '0';
  const putriPct = totalGender > 0 ? ((putriCount / totalGender) * 100).toFixed(1) : '0';

  const komplekData = useMemo(() => {
    return Array.isArray(statistik?.siswa_per_komplek) ? (statistik.siswa_per_komplek as ApiRecord[]) : [];
  }, [statistik?.siswa_per_komplek]);

  const kamarData = useMemo(() => {
    return Array.isArray(statistik?.siswa_per_kamar) ? (statistik.siswa_per_kamar as ApiRecord[]) : [];
  }, [statistik?.siswa_per_kamar]);

  const totalMondok = Number(statistik?.total_santri_mondok ?? 0);
  const totalAsrama = Number(statistik?.total_asrama ?? komplekData.length);
  const totalKamar = Number(statistik?.total_kamar ?? kamarData.length);

  const KOMPLEK_COLORS = ['#138F81', '#0EA5E9', '#8B5CF6', '#F59E0B', '#EC4899', '#10B981', '#6366F1', '#14B8A6'];

  return (
    <div className="space-y-6">
      <section className="q-page-heading flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#636E72]">Yayasan Pondok Qomaruddin</p>
          <h1 className="text-3xl font-extrabold text-[#2D3436]">Dashboard Overview</h1>
        </div>
        <button
          className={`q-refresh-button flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-[#138F81] ${isLoading ? 'is-loading' : ''}`}
          onClick={() => void load()}
          type="button"
          disabled={isLoading}
          aria-busy={isLoading}
        >
          <RefreshCw className="q-refresh-icon" size={17} />
          {isLoading ? 'Menyegarkan...' : 'Refresh'}
        </button>
      </section>

      {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}

      <div className="q-stat-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard title="Total Santri" value={getNumber(statistik, 'total_siswa')} subtitle={`${getNumber(statistik, 'siswa_aktif')} siswa aktif`} icon={UsersRound} tone="teal" />
        {showAbsensi ? <StatCard title="Absensi Kelas Hari Ini" value={getNumber(absensi, 'total')} subtitle="Data Madin/Diniyah" icon={BookOpenCheck} tone="blue" /> : null}
        {showAbsensi ? <StatCard title="Absensi Ngaji" value={getNumber(ngaji, 'total')} subtitle={`${getNumber(ngaji, 'jadwal_sudah_diabsen')} jadwal diabsen`} icon={BookMarked} tone="teal" /> : null}
        {showFinance ? (
          <StatCard
            title="Keuangan Hari Ini"
            value={formatCompactMoney(getNumber(pembayaran, 'total_masuk'))}
            valueTitle={formatMoney(getNumber(pembayaran, 'total_masuk'))}
            subtitle={`${getNumber(pembayaran, 'jumlah_transaksi')} transaksi`}
            icon={WalletCards}
            tone="orange"
            compactValue
          />
        ) : null}
        {showAbsensi ? <StatCard title="Absensi Sholat" value={getNumber(sholat, 'total')} subtitle={`${getNumber(sholat, 'kamar_sudah_diabsen')} kamar diabsen`} icon={CalendarCheck} tone="purple" /> : null}
      </div>

      {/* SECTION 1: DEMOGRAFI GENDER & SEBARAN KELAS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
        {/* CHART 1: TOTAL SANTRI PER JENIS KELAMIN (MODERN DONUT) */}
        <section className="q-card p-5 lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Users size={18} className="text-[#138F81]" />
                Komposisi Gender Santri
              </h2>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                100% Aktif
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mb-3">Rasio santri putra dan santri putri</p>

            {/* DONUT CHART WITH CENTER TOTAL */}
            <div className="relative h-[190px] w-full flex items-center justify-center my-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={78}
                    paddingAngle={4}
                    stroke="none"
                  >
                    {genderData.map((entry, index) => {
                      const isPutra =
                        String(entry.name).toLowerCase().includes('putra') ||
                        String(entry.name).toLowerCase().includes('laki') ||
                        entry.gender === 'L';
                      return (
                        <Cell
                          key={`gender-cell-${index}`}
                          fill={isPutra ? '#0284C7' : '#E11D48'}
                          className="transition-all duration-300 hover:opacity-80"
                        />
                      );
                    })}
                  </Pie>
                  <RechartsTooltip cursor={{ fill: 'transparent' }} content={<CustomClassTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* CENTER BADGE */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-2xl font-black text-slate-800 leading-tight">
                  {totalGender.toLocaleString('id-ID')}
                </span>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Total Santri
                </span>
              </div>
            </div>
          </div>

          {/* METRIC BADGES FOOTER */}
          <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-100 mt-2">
            <div className="rounded-2xl bg-sky-50/70 border border-sky-100 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-sky-700">👨 Santri Putra</span>
                <span className="text-[10px] font-black text-sky-800 bg-sky-100/80 px-1.5 py-0.5 rounded-md">
                  {putraPct}%
                </span>
              </div>
              <p className="text-lg font-black text-sky-900 leading-tight">{putraCount.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-sky-600 font-medium">Santri Laki-laki</p>
            </div>

            <div className="rounded-2xl bg-rose-50/70 border border-rose-100 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-rose-700">👩 Santri Putri</span>
                <span className="text-[10px] font-black text-rose-800 bg-rose-100/80 px-1.5 py-0.5 rounded-md">
                  {putriPct}%
                </span>
              </div>
              <p className="text-lg font-black text-rose-900 leading-tight">{putriCount.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-rose-600 font-medium">Santri Perempuan</p>
            </div>
          </div>
        </section>

        {/* CHART 2: SEBARAN SANTRI PER KELAS DENGAN FILTER JENJANG */}
        <section className="q-card p-5 lg:col-span-8 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <div>
                <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <GraduationCap size={19} className="text-[#138F81]" />
                  Sebaran Santri per Kelas
                </h2>
                <p className="text-xs font-semibold text-slate-500">
                  {filteredClasses.length} rombel kelas terpilih • Filter berdasarkan tingkatan
                </p>
              </div>

              {/* TIER FILTER PILLS */}
              <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {[
                  { id: 'all', label: 'Semua (70)' },
                  { id: 'top10', label: 'Top 10' },
                  { id: 'Awal', label: 'Awal' },
                  { id: 'Tsani', label: 'Tsani' },
                  { id: 'Tsalis', label: 'Tsalis' },
                  { id: 'Robi', label: "Robi'" },
                  { id: 'Khomis', label: 'Khomis' },
                  { id: 'Sadis', label: 'Sadis' }
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSelectedClassTier(tier.id)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                      selectedClassTier === tier.id
                        ? 'bg-[#138F81] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            {/* BAR CHART */}
            <div className="h-[220px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filteredClasses}
                  margin={{
                    top: 10,
                    right: 10,
                    left: -20,
                    bottom: selectedClassTier === 'all' ? 5 : 20
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={selectedClassTier === 'all' ? 0 : -20}
                    textAnchor={selectedClassTier === 'all' ? 'middle' : 'end'}
                    tick={
                      selectedClassTier === 'all'
                        ? false
                        : { fontSize: 10, fill: '#475569', fontWeight: 700 }
                    }
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <RechartsTooltip cursor={{ fill: '#f8fafc' }} content={<CustomClassTooltip />} />
                  <Bar
                    dataKey="value"
                    fill="#138F81"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={selectedClassTier === 'all' ? 14 : 45}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs font-bold text-slate-500 pt-2 border-t border-slate-100 gap-2">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#138F81] inline-block" /> Total Siswa per Rombel
              {selectedClassTier === 'all' && (
                <span className="text-[11px] font-medium text-slate-400 italic pl-1">
                  (Arahkan kursor ke batang grafik untuk melihat nama kelas)
                </span>
              )}
            </span>
            <span>Total {rawClasses.length} Rombel Kelas Madin</span>
          </div>
        </section>
      </div>

      {/* SECTION 2: DATA PONDOK PESANTREN & ASRAMA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-2 mb-5">
        {/* CHART 3: SEBARAN SANTRI PER KOMPLEK / ASRAMA */}
        <section className="q-card p-5 lg:col-span-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="min-w-0">
                <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Building2 size={18} className="text-[#138F81] shrink-0" />
                  <span>Sebaran Santri per Komplek Asrama</span>
                </h2>
                <p className="text-xs font-semibold text-slate-500">
                  Distribusi santri mukim di setiap komplek/asrama pondok
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-black text-teal-900 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl shrink-0 whitespace-nowrap shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-[#138F81]" />
                {totalMondok.toLocaleString('id-ID')} Santri Mukim
              </span>
            </div>

            {/* HORIZONTAL / COMPACT BAR CHART FOR ASRAMA */}
            {komplekData.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <p className="text-sm font-bold">Belum ada data penempatan komplek santri.</p>
              </div>
            ) : (
              <div className="h-[230px] w-full mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={komplekData}
                    margin={{ top: 5, right: 30, left: 15, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#1e293b', fontWeight: 800 }}
                      width={120}
                    />
                    <RechartsTooltip cursor={{ fill: '#f8fafc' }} content={<CustomPondokTooltip />} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24}>
                      {komplekData.map((_, index) => (
                        <Cell
                          key={`komplek-cell-${index}`}
                          fill={KOMPLEK_COLORS[index % KOMPLEK_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-slate-500 pt-2.5 border-t border-slate-100">
            <span>{totalAsrama} Komplek Asrama Terdaftar</span>
            <span className="text-[#138F81] font-extrabold">Data Pondok Pesantren</span>
          </div>
        </section>

        {/* CHART 4: TOP KAMAR ASRAMA DENGAN PENGHUNI TERBANYAK */}
        <section className="q-card p-5 lg:col-span-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="min-w-0">
                <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <DoorOpen size={18} className="text-[#138F81] shrink-0" />
                  <span>Top Kamar Asrama Terpadat</span>
                </h2>
                <p className="text-xs font-semibold text-slate-500">
                  Daftar kamar dengan jumlah santri penghuni terbanyak
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl shrink-0 whitespace-nowrap">
                <Home size={13} className="text-slate-500" />
                {totalKamar} Total Kamar
              </span>
            </div>

            {/* KAMAR RANKING LIST */}
            {kamarData.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <p className="text-sm font-bold">Belum ada data kamar asrama terisi.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3 max-h-[230px] overflow-y-auto pr-1">
                {kamarData.slice(0, 8).map((room, idx) => {
                  const val = Number(room.value || 0);
                  const cap = Number(room.capacity || 0);
                  const pct = cap > 0 ? Math.min(100, Math.round((val / cap) * 100)) : null;
                  const roomTitle = String(room.kamar ?? room.name ?? '-');
                  const komplekTitle = String(room.komplek ?? 'Umum');

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:bg-teal-50/50 transition-colors"
                      title={`${roomTitle} (${komplekTitle}): ${val} Santri`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="grid h-5 w-5 place-items-center rounded-md bg-white border border-slate-200 text-[10px] font-black text-slate-700 shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-extrabold text-slate-800 text-xs truncate max-w-[130px]">
                            {roomTitle}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-semibold pl-6 truncate max-w-[130px]">
                          {komplekTitle}
                        </p>
                      </div>

                      <div className="text-right whitespace-nowrap shrink-0">
                        <span className="text-xs font-black text-teal-800 bg-white border border-teal-200 px-2 py-0.5 rounded-lg shadow-2xs">
                          {val} Santri
                        </span>
                        {pct !== null && (
                          <div className="w-14 bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5 ml-auto">
                            <div
                              className={`h-full ${pct > 90 ? 'bg-rose-500' : 'bg-teal-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-slate-500 pt-2.5 border-t border-slate-100 mt-2">
            <span>Kapasitas & Okupansi Kamar</span>
            <span className="text-[#138F81] font-extrabold">Yayasan Pondok Qomaruddin</span>
          </div>
        </section>
      </div>

      {showAbsensi ? (
        <div className="q-dashboard-summary-grid grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          <AbsensiSummaryCard
            icon={<BookOpenCheck className="text-[#2E86DE]" size={20} />}
            title="Absensi Madin/Diniyah"
            subtitle="Ringkasan kelas hari ini"
            items={[
              ['H', getNumber(absensi, 'hadir'), 'success'],
              ['I', getNumber(absensi, 'izin'), 'warning'],
              ['S', getNumber(absensi, 'sakit'), 'danger'],
              ['A', getNumber(absensi, 'alfa'), 'neutral']
            ]}
          />
          <AbsensiSummaryCard
            icon={<BookMarked className="text-[#138F81]" size={20} />}
            title="Absensi Ngaji Kitab"
            subtitle={`${getNumber(ngaji, 'jadwal_sudah_diabsen')} jadwal sudah diabsen`}
            items={[
              ['H', getNumber(ngaji, 'H'), 'success'],
              ['I', getNumber(ngaji, 'I'), 'warning'],
              ['S', getNumber(ngaji, 'S'), 'danger'],
              ['A', getNumber(ngaji, 'A') || getNumber(ngaji, 'kosong'), 'neutral']
            ]}
          />
          <AbsensiSummaryCard
            icon={<CalendarCheck className="text-[#138F81]" size={20} />}
            title="Absensi Jama'ah Sholat"
            subtitle={`${getNumber(sholat, 'kamar_sudah_diabsen')} kamar sudah diabsen`}
            items={[
              ['M', getNumber(sholat, 'M'), 'success'],
              ['I', getNumber(sholat, 'I'), 'warning'],
              ['S', getNumber(sholat, 'S'), 'danger'],
              ['Kosong', getNumber(sholat, 'kosong'), 'neutral']
            ]}
          />
        </div>
      ) : null}

      <div className={`q-dashboard-bottom-grid grid grid-cols-1 items-start gap-5 ${showFinance ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
        {showFinance ? (
        <section className="q-card q-transactions-card p-5">
          <div className="q-card-heading mb-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-[#2D3436]">Transaksi Terbaru</h2>
              <p className="text-xs font-semibold text-[#636E72]">Data dari menu Keuangan hari ini</p>
            </div>
            <button className="q-soft-action q-view-all-button rounded-full bg-[#E8F7F3] px-4 py-2 text-xs font-bold text-[#138F81]" onClick={onOpenFinance} type="button">
              Lihat Semua
            </button>
          </div>
          {isLoading ? (
            <div className="rounded-2xl bg-[#E1EFF7] px-4 py-8 text-center text-sm font-bold text-[#636E72]">Memuat dashboard...</div>
          ) : (
            <DataTable
              columns={[
                { key: 'siswa', header: 'Santri', render: (row) => studentName(row) },
                { key: 'jenis', header: 'Tipe', render: (row) => String(row.jenis ?? row.payment_type_name ?? '-') },
                { key: 'jumlah', header: 'Nominal', render: (row) => <MoneyText value={row.jumlah} className="break-words font-extrabold text-[#138F81] [overflow-wrap:anywhere]" /> },
                { key: 'status', header: 'Status', render: (row) => <StatusBadge label={String(row.status ?? 'Tercatat')} tone={String(row.status ?? '').toLowerCase().includes('lunas') ? 'success' : 'warning'} /> }
              ]}
              rows={payments.slice(0, 6)}
              emptyText="Belum ada transaksi hari ini."
              minWidth="360px"
              mobileRender={(row) => (
                <article className="rounded-2xl bg-white p-4 shadow-sm shadow-black/5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-[#2D3436]">{studentName(row)}</p>
                      <p className="mt-1 text-xs font-semibold text-[#636E72]">{String(row.jenis ?? row.payment_type_name ?? 'Pembayaran')}</p>
                    </div>
                    <StatusBadge label={String(row.status ?? 'Tercatat')} tone={String(row.status ?? '').toLowerCase().includes('lunas') ? 'success' : 'warning'} />
                  </div>
                  <MoneyText value={row.jumlah} className="mt-3 block break-words text-base font-extrabold text-[#138F81] [overflow-wrap:anywhere]" />
                </article>
              )}
            />
          )}
        </section>
        ) : null}

        <section className="q-card q-activity-card p-5">
          <div className="q-card-heading mb-3 flex items-center gap-2">
            <Landmark className="text-[#138F81]" size={20} />
            <h2 className="text-lg font-extrabold text-[#2D3436]">Aktivitas Absensi</h2>
          </div>
          <div className="space-y-3">
            {latestAttendance.length === 0 ? (
              <p className="rounded-2xl bg-[#E1EFF7] px-4 py-4 text-sm font-semibold leading-6 text-[#636E72]">
                Belum ada aktivitas absensi terbaru.
              </p>
            ) : (
              latestAttendance.slice(0, 4).map((item) => (
                <button
                  key={`${item.activity_title}-${item.activity_detail}`}
                  className="group flex w-full items-center gap-3 rounded-2xl bg-[#E1EFF7] p-3 text-left transition hover:-translate-y-0.5 hover:bg-[#D8ECF5] hover:shadow-md"
                  onClick={() => onOpenAttendance(item.activity_target)}
                  type="button"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-[#138F81] shadow-sm">
                    <CalendarCheck size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold text-[#2D3436]">
                      {item.activity_title}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] font-semibold text-[#636E72]">
                      {item.activity_detail || 'Detail absensi'}
                    </span>
                    <span className="mt-1 block text-[11px] font-bold text-[#138F81]">
                      {getNumber(item, 'total')} santri • {String(item.waktu ?? '')}
                    </span>
                  </span>
                  <ChevronRight className="shrink-0 text-[#138F81] transition-transform group-hover:translate-x-0.5" size={17} />
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function AbsensiSummaryCard({
  icon,
  title,
  subtitle,
  items
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  items: Array<[string, number, string]>;
}) {
  return (
    <section className="q-card p-5">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <div>
          <h2 className="text-lg font-extrabold leading-snug text-[#2D3436]">{title}</h2>
          <p className="text-xs font-semibold text-[#636E72]">{subtitle}</p>
        </div>
      </div>
      <div className="q-summary-grid grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map(([label, value, tone]) => (
          <div key={label} className="dashboard-mini-tile">
            <p className="text-2xl font-extrabold text-[#2D3436]">{value}</p>
            <StatusBadge label={label} tone={statusTone(tone)} />
          </div>
        ))}
      </div>
    </section>
  );
}
