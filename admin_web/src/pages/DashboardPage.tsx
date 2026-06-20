import { BookMarked, BookOpenCheck, CalendarCheck, ChevronRight, Landmark, RefreshCw, UsersRound, WalletCards } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { DataTable } from '../components/DataTable';
import { MoneyText, formatCompactMoney, formatMoney } from '../components/MoneyText';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { api, type ApiRecord } from '../services/api';
import type { AbsensiNavigationTarget } from './AbsensiPage';

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
        api.dashboard(session?.id),
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
    const intervalId = window.setInterval(refreshVisibleDashboard, 20_000);
    document.addEventListener('visibilitychange', refreshVisibleDashboard);
    window.addEventListener('focus', refreshVisibleDashboard);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshVisibleDashboard);
      window.removeEventListener('focus', refreshVisibleDashboard);
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

      <div className="q-stat-grid grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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

      {showAbsensi ? (
        <div className="q-dashboard-summary-grid grid gap-5 xl:grid-cols-3">
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

      <div className={`q-dashboard-bottom-grid grid items-start gap-5 ${showFinance ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
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
