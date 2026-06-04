import { BookOpenCheck, CalendarCheck, Landmark, RefreshCw, UsersRound, WalletCards } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { DataTable } from '../components/DataTable';
import { MoneyText, formatMoney } from '../components/MoneyText';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { api, type ApiRecord } from '../services/api';

interface DashboardPageProps {
  onOpenFinance: () => void;
}

function getNumber(source: ApiRecord | undefined, key: string): number {
  return Number(source?.[key] ?? 0);
}

function statusTone(tone: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (tone === 'success') return 'success';
  if (tone === 'warning') return 'warning';
  if (tone === 'danger') return 'danger';
  return 'neutral';
}

export function DashboardPage({ onOpenFinance }: DashboardPageProps) {
  const { session, isTreasurer } = useAuth();
  const [dashboard, setDashboard] = useState<ApiRecord | null>(null);
  const [payments, setPayments] = useState<ApiRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    setIsLoading(true);
    try {
      const [dashboardResult, paymentResult] = await Promise.all([
        api.dashboard(session?.id),
        api.paymentToday().catch(() => ({ success: true, data: [] }))
      ]);
      setDashboard(dashboardResult);
      setPayments(Array.isArray(paymentResult.data) ? paymentResult.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dashboard gagal dimuat');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const statistik = dashboard?.statistik as ApiRecord | undefined;
  const pembayaran = dashboard?.pembayaran as ApiRecord | undefined;
  const sholat = dashboard?.absensi_sholat as ApiRecord | undefined;
  const absensi = dashboard?.absensi as ApiRecord | undefined;
  const latestPrayer = Array.isArray(sholat?.terbaru) ? (sholat?.terbaru as ApiRecord[]) : [];

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

      <div className="q-stat-grid grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Santri" value={getNumber(statistik, 'total_siswa')} subtitle={`${getNumber(statistik, 'siswa_aktif')} siswa aktif`} icon={UsersRound} tone="teal" />
        <StatCard title="Absensi Kelas Hari Ini" value={getNumber(absensi, 'total')} subtitle="Data Madin/Diniyah" icon={BookOpenCheck} tone="blue" />
        <StatCard title="Keuangan Hari Ini" value={formatMoney(getNumber(pembayaran, 'total_masuk'))} subtitle={`${getNumber(pembayaran, 'jumlah_transaksi')} transaksi`} icon={WalletCards} tone="orange" />
        <StatCard title="Absensi Sholat" value={getNumber(sholat, 'total')} subtitle={`${getNumber(sholat, 'kamar_sudah_diabsen')} kamar diabsen`} icon={CalendarCheck} tone="purple" />
      </div>

      <div className="q-dashboard-summary-grid grid gap-5 xl:grid-cols-2">
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

      <div className="q-dashboard-bottom-grid grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="q-card p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#2D3436]">Transaksi Terbaru</h2>
              <p className="text-xs font-semibold text-[#636E72]">Data dari menu Keuangan hari ini</p>
            </div>
            <button className="q-soft-action rounded-full bg-[#E8F7F3] px-4 py-2 text-xs font-bold text-[#138F81]" onClick={onOpenFinance} type="button">
              Lihat Semua
            </button>
          </div>
          {isLoading ? (
            <div className="rounded-2xl bg-[#E1EFF7] px-4 py-8 text-center text-sm font-bold text-[#636E72]">Memuat dashboard...</div>
          ) : (
            <DataTable
              columns={[
                { key: 'siswa', header: 'Santri', render: (row) => String(row.siswa_nama ?? row.nama_siswa ?? row.nama ?? '-') },
                { key: 'jenis', header: 'Tipe', render: (row) => String(row.jenis ?? row.payment_type_name ?? '-') },
                { key: 'jumlah', header: 'Nominal', render: (row) => <MoneyText value={row.jumlah} className="font-extrabold text-[#138F81]" /> },
                { key: 'status', header: 'Status', render: (row) => <StatusBadge label={String(row.status ?? 'Tercatat')} tone={String(row.status ?? '').toLowerCase().includes('lunas') ? 'success' : 'warning'} /> }
              ]}
              rows={payments.slice(0, 6)}
              emptyText="Belum ada transaksi hari ini."
              minWidth="520px"
            />
          )}
        </section>

        <section className="q-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Landmark className="text-[#138F81]" size={20} />
            <h2 className="text-lg font-extrabold text-[#2D3436]">Aktivitas Absensi</h2>
          </div>
          <div className="space-y-3">
            {latestPrayer.length === 0 ? (
              <p className="rounded-2xl bg-[#E1EFF7] px-4 py-4 text-sm font-semibold leading-6 text-[#636E72]">
                {isTreasurer ? 'Bendahara hanya melihat ringkasan yang diizinkan.' : 'Belum ada aktivitas absensi terbaru.'}
              </p>
            ) : (
              latestPrayer.slice(0, 4).map((item, index) => (
                <div key={String(item.id ?? index)} className="rounded-2xl bg-[#E1EFF7] p-4">
                  <p className="text-sm font-extrabold text-[#2D3436]">{String(item.nama ?? item.siswa_nama ?? 'Santri')}</p>
                  <p className="text-xs font-semibold text-[#636E72]">
                    {String(item.kamar ?? item.room_name ?? '-')} - {String(item.status ?? '-')}
                  </p>
                </div>
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
