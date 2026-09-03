import {
  ArrowDownCircle,
  ArrowDownLeft,
  ArrowUpCircle,
  ArrowUpRight,
  Banknote,
  Building,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  FileSpreadsheet,
  FileText,
  History,
  Landmark,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UsersRound,
  Wallet,
  WalletCards,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney, MoneyText } from './MoneyText';
import { StatusBadge } from './StatusBadge';
import { api, type ApiRecord, type UserSession } from '../services/api';

interface BendaharaDashboardViewProps {
  session: UserSession | null;
  onNavigateFinance?: (tab: 'today' | 'student' | 'history' | 'pemasukan_lain' | 'pengeluaran' | 'types') => void;
  onRefresh?: () => void;
}

function num(val: unknown): number {
  const n = Number(val ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function str(val: unknown, fallback = '-'): string {
  const s = String(val ?? '').trim();
  return s || fallback;
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getTodayFormatted(): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

interface AtmCardProps {
  theme: 'emerald' | 'sapphire' | 'titanium' | 'bronze' | 'ruby';
  issuer?: string;
  tier: string;
  chip?: 'gold' | 'silver' | 'copper';
  numberMask: string;
  label: string;
  amount: string;
  subText: string;
  holder: string;
  validThru?: string;
  network?: string;
}

function AtmCard({
  theme,
  issuer = 'BANK QOMARUDDIN',
  tier,
  chip = 'gold',
  numberMask,
  label,
  amount,
  subText,
  holder,
  validThru = 'REALTIME',
  network = 'DEBIT',
}: AtmCardProps) {
  const themeStyles = {
    emerald: {
      bg: 'bg-linear-to-br from-[#044e3b] via-[#065f46] to-[#022c22]',
      border: 'border-emerald-400/40',
      glow: 'shadow-emerald-950/40',
      accent: 'text-emerald-200',
    },
    sapphire: {
      bg: 'bg-linear-to-br from-[#1e3a8a] via-[#1d4ed8] to-[#0f172a]',
      border: 'border-blue-400/40',
      glow: 'shadow-blue-950/40',
      accent: 'text-sky-200',
    },
    titanium: {
      bg: 'bg-linear-to-br from-[#1c1917] via-[#292524] to-[#0c0a09]',
      border: 'border-amber-400/30',
      glow: 'shadow-black/60',
      accent: 'text-amber-200/90',
    },
    bronze: {
      bg: 'bg-linear-to-br from-[#7c2d12] via-[#9a3412] to-[#431407]',
      border: 'border-amber-500/40',
      glow: 'shadow-amber-950/40',
      accent: 'text-amber-200',
    },
    ruby: {
      bg: 'bg-linear-to-br from-[#881337] via-[#9f1239] to-[#4c0519]',
      border: 'border-rose-400/40',
      glow: 'shadow-rose-950/40',
      accent: 'text-rose-200',
    },
  }[theme];

  return (
    <div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl p-5 text-white shadow-xl ${themeStyles.bg} border ${themeStyles.border} ${themeStyles.glow} hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 min-h-[235px] select-none`}
    >
      {/* Glossy lighting reflection streak */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-xl group-hover:scale-110 transition-transform" />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-tr from-transparent via-white/5 to-white/10" />
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-[1px] bg-linear-to-r from-transparent via-white/35 to-transparent" />

      {/* Subtle guilloche watermark circles */}
      <div className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full border border-white/5 opacity-40" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full border border-white/5 opacity-20" />

      {/* 1. TOP HEADER: Issuer & Tier */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/15 backdrop-blur-xs border border-white/20">
            <Landmark size={12} className="text-amber-300" />
          </div>
          <span className="font-mono text-[10px] sm:text-[11px] font-black tracking-widest text-white/95 uppercase truncate">
            {issuer}
          </span>
        </div>

        <span className="rounded-md bg-white/15 px-2 py-0.5 text-[9px] font-black tracking-wider text-white/95 uppercase border border-white/20 shrink-0">
          {tier}
        </span>
      </div>

      {/* 2. CHIP & CONTACTLESS WAVE & CARD NUMBER */}
      <div className="relative z-10 my-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Realistic EMV Smart Chip */}
          <div
            className={`relative h-6 w-8 rounded-md p-0.5 shadow-inner border flex flex-col justify-between overflow-hidden shrink-0 ${
              chip === 'silver'
                ? 'bg-linear-to-br from-slate-100 via-slate-200 to-slate-400 border-slate-200/90'
                : chip === 'copper'
                ? 'bg-linear-to-br from-orange-200 via-amber-600 to-amber-700 border-orange-300/80'
                : 'bg-linear-to-br from-amber-200 via-yellow-400 to-amber-500 border-amber-300/80'
            }`}
          >
            <div className="h-full w-full rounded-[2px] border border-black/20 flex flex-col justify-between p-0.5">
              <div className="flex justify-between h-1">
                <div className="w-1.5 border-b border-r border-black/30" />
                <div className="w-1.5 border-b border-l border-black/30" />
              </div>
              <div className="h-1 w-2.5 mx-auto rounded-xs border border-black/30 bg-black/10" />
              <div className="flex justify-between h-1">
                <div className="w-1.5 border-t border-r border-black/30" />
                <div className="w-1.5 border-t border-l border-black/30" />
              </div>
            </div>
          </div>

          {/* Contactless Wave */}
          <svg
            className="h-3.5 w-3.5 text-white/70 rotate-90 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M8.5 16.5a5 5 0 0 1 0-9" />
            <path d="M12 19a8.5 8.5 0 0 0 0-14" />
            <path d="M15.5 21.5a12 12 0 0 0 0-19" />
          </svg>
        </div>

        <p className="font-mono text-xs font-black tracking-wider text-white/90 drop-shadow-xs">
          {numberMask}
        </p>
      </div>

      {/* 3. METRIC / AMOUNT SECTION */}
      <div className="relative z-10 space-y-0.5 my-1">
        <p className="text-[10px] font-black uppercase tracking-wider text-white/70 leading-none">
          {label}
        </p>
        <p className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-md py-0.5">
          {amount}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <p className={`text-[11px] font-bold ${themeStyles.accent} truncate`}>
            {subText}
          </p>
        </div>
      </div>

      {/* 4. BOTTOM ROW: CARDHOLDER (LEFT) & NETWORK EMBLEM (RIGHT) - 2 KOLOM RAPI ANTI-TABRAK */}
      <div className="relative z-10 mt-2 flex items-end justify-between border-t border-white/15 pt-2 gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[8px] font-bold text-white/60 uppercase tracking-wider leading-none">
            <span>Cardholder</span>
            <span>•</span>
            <span className="text-white/80 font-mono">{validThru}</span>
          </div>
          <p className="font-mono text-[11px] sm:text-xs font-black tracking-wider text-white uppercase mt-0.5 truncate">
            {holder}
          </p>
        </div>

        {/* Payment Network Emblem */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex -space-x-1.5">
            <div className="h-4.5 w-4.5 rounded-full bg-rose-500/90 shadow-xs" />
            <div className="h-4.5 w-4.5 rounded-full bg-amber-400/90 shadow-xs" />
          </div>
          <span className="font-mono text-[10px] font-black tracking-wider text-white/95 uppercase">
            {network}
          </span>
        </div>
      </div>
    </div>
  );
}


export function BendaharaDashboardView({

  session,
  onNavigateFinance,
}: BendaharaDashboardViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Data states
  const [dashboardData, setDashboardData] = useState<ApiRecord | null>(null);
  const [todayPayments, setTodayPayments] = useState<ApiRecord[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<ApiRecord[]>([]);
  const [chartData, setChartData] = useState<ApiRecord[]>([]);
  const [pengeluaranHariIni, setPengeluaranHariIni] = useState<ApiRecord[]>([]);
  const [pemasukanLainHariIni, setPemasukanLainHariIni] = useState<ApiRecord[]>([]);
  const [financialSummary, setFinancialSummary] = useState<ApiRecord | null>(null);
  const [currentTime, setCurrentTime] = useState('');

  const adminType = String(session?.admin_type || '').toLowerCase();
  const isBendahara1 = adminType === 'bendahara_1' || adminType === 'kasir';
  const roleTitle = isBendahara1
    ? 'Bendahara 1 (Kasir & Transaksi Santri)'
    : 'Bendahara 2 (Kepala Keuangan & Buku Kas)';

  // Live Digital Clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }) + ' WIB'
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError('');

    try {
      const [
        dashRes,
        todayRes,
        allPayRes,
        chartRes,
        pengeluaranRes,
        pemasukanLainRes,
      ] = await Promise.all([
        api.dashboard().catch(() => null),
        api.paymentToday().catch(() => ({ success: true, data: [] })),
        api.paymentAll(30).catch(() => ({ success: true, data: [] })),
        api.paymentChart().catch(() => ({ success: true, data: [] })),
        api.pengeluaran().catch(() => ({ success: true, data: [] })),
        api.pemasukanLain().catch(() => ({ success: true, data: [] })),
      ]);

      const dashObj = ((dashRes as ApiRecord)?.data || dashRes) as ApiRecord | null;
      setDashboardData(dashObj ?? null);


      const todayList = Array.isArray((todayRes as ApiRecord)?.data)
        ? ((todayRes as ApiRecord).data as ApiRecord[])
        : Array.isArray(todayRes)
        ? todayRes
        : [];
      setTodayPayments(todayList);

      if ((todayRes as ApiRecord)?.financial_summary) {
        setFinancialSummary((todayRes as ApiRecord).financial_summary as ApiRecord);
      }

      const allList = Array.isArray((allPayRes as ApiRecord)?.data)
        ? ((allPayRes as ApiRecord).data as ApiRecord[])
        : Array.isArray(allPayRes)
        ? allPayRes
        : [];
      setRecentTransactions(allList);

      const chartList = Array.isArray((chartRes as ApiRecord)?.data)
        ? ((chartRes as ApiRecord).data as ApiRecord[])
        : Array.isArray(chartRes)
        ? chartRes
        : [];
      setChartData(chartList);

      // Filter Pengeluaran Hari Ini
      const todayStr = new Date().toISOString().slice(0, 10);
      const rawPengeluaran = Array.isArray((pengeluaranRes as ApiRecord)?.data)
        ? ((pengeluaranRes as ApiRecord).data as ApiRecord[])
        : Array.isArray(pengeluaranRes)
        ? pengeluaranRes
        : [];
      setPengeluaranHariIni(
        rawPengeluaran.filter((p) => String(p.tanggal || p.created_at || '').slice(0, 10) === todayStr)
      );

      // Filter Pemasukan Lain Hari Ini
      const rawPemasukanLain = Array.isArray((pemasukanLainRes as ApiRecord)?.data)
        ? ((pemasukanLainRes as ApiRecord).data as ApiRecord[])
        : Array.isArray(pemasukanLainRes)
        ? pemasukanLainRes
        : [];
      setPemasukanLainHariIni(
        rawPemasukanLain.filter((p) => String(p.tanggal || p.created_at || '').slice(0, 10) === todayStr)
      );
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Gagal memuat ringkasan keuangan');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();

    // Auto-refresh saat event app:data-updated
    const handleUpdate = (e: Event) => {
      const ce = e as CustomEvent;
      if (!ce.detail || ce.detail.type === 'keuangan' || ce.detail.type === 'all') {
        void loadData(true);
      }
    };
    window.addEventListener('app:data-updated', handleUpdate);
    return () => window.removeEventListener('app:data-updated', handleUpdate);
  }, [loadData]);

  // Kalkulasi Realtime Keuangan Hari Ini
  const totalMasukHariIni = useMemo(() => {
    if (financialSummary?.total_masuk_hari_ini !== undefined) {
      return num(financialSummary.total_masuk_hari_ini);
    }
    const fromStudent = todayPayments.reduce((sum, p) => sum + num(p.jumlah), 0);
    const fromOther = pemasukanLainHariIni.reduce((sum, p) => sum + num(p.jumlah), 0);
    return fromStudent + fromOther;
  }, [financialSummary, todayPayments, pemasukanLainHariIni]);

  const countMasukHariIni = useMemo(() => {
    return todayPayments.length + pemasukanLainHariIni.length;
  }, [todayPayments, pemasukanLainHariIni]);

  const totalKeluarHariIni = useMemo(() => {
    if (financialSummary?.total_keluar_hari_ini !== undefined) {
      return num(financialSummary.total_keluar_hari_ini);
    }
    return pengeluaranHariIni.reduce((sum, p) => sum + num(p.jumlah), 0);
  }, [financialSummary, pengeluaranHariIni]);

  const countKeluarHariIni = pengeluaranHariIni.length;

  // Saldo Kas Bersih Akumulasi
  const saldoKasBersih = useMemo(() => {
    if (financialSummary?.saldo_kas_bersih !== undefined) {
      return num(financialSummary.saldo_kas_bersih);
    }
    return num(dashboardData?.keuangan_bulan_ini ?? totalMasukHariIni - totalKeluarHariIni);
  }, [financialSummary, dashboardData, totalMasukHariIni, totalKeluarHariIni]);

  // Total Santri Terdaftar (HANYA JUMLAH SISWA SAJA)
  const totalSantri = useMemo(() => {
    return num(dashboardData?.total_siswa ?? dashboardData?.siswa_aktif ?? 966);
  }, [dashboardData]);

  // Pembagian Metode Bayar Hari Ini (Kas Laci Kasir Tunai vs Bank vs QRIS)
  const breakdownMetode = useMemo(() => {
    let tunai = 0;
    let transfer = 0;
    let qris = 0;

    todayPayments.forEach((p) => {
      const via = String(p.via || p.metode || '').toLowerCase();
      const jml = num(p.jumlah);
      if (via.includes('tunai') || via.includes('cash')) {
        tunai += jml;
      } else if (via.includes('qris')) {
        qris += jml;
      } else {
        transfer += jml;
      }
    });

    const total = tunai + transfer + qris || 1;
    return {
      tunai,
      transfer,
      qris,
      tunaiPct: Math.round((tunai / total) * 100),
      transferPct: Math.round((transfer / total) * 100),
      qrisPct: Math.round((qris / total) * 100),
    };
  }, [todayPayments]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. BANKING HEADER & CASHIER WORKSTATION BAR */}
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-r from-[#0E4D45] via-[#138F81] to-[#1A6B62] p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 -mb-10 h-40 w-40 rounded-full bg-teal-300/10 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-black backdrop-blur-md">
                <Landmark size={14} className="text-amber-300" />
                <span>TERMINAL KEUANGAN & PERBANKAN PESANTREN</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-extrabold text-emerald-200 border border-emerald-400/30">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Kasir Online & Realtime</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Selamat Bertugas, {session?.name || 'Bendahara'}! 👋
            </h1>

            <p className="text-xs sm:text-sm font-semibold text-teal-100/90 max-w-2xl">
              {isBendahara1
                ? 'Bendahara 1 (Kasir & SPP Santri). Fokus pada transaksi pembayaran santri, setoran SPP harian, cetak kuitansi struk, dan rekonsiliasi kasir santri.'
                : 'Bendahara 2 (Kepala Keuangan & Pembukuan Kas). Akses penuh kas masuk, pengeluaran kas operasional, pengaturan tarif SPP, dan buku besar yayasan.'}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2.5">
            <div className="rounded-2xl bg-black/20 backdrop-blur-md px-4 py-2 text-right border border-white/10">
              <p className="text-[11px] font-bold text-teal-200">{getTodayFormatted()}</p>
              <p className="text-lg font-black font-mono tracking-wider text-white">{currentTime || '--:--:-- WIB'}</p>
            </div>

            <button
              onClick={() => void loadData()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/25 transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span>{isLoading ? 'Menyinkronkan...' : 'Sinkron Kasir'}</span>
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm font-bold text-rose-700">
          ⚠️ {error}
        </div>
      )}

      {/* 2. CORE BANKING KEY METRICS (4 KARTU ATM PERBANKAN MODERN) */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isBendahara1 ? (
          <>
            {/* KARTU ATM 1 (BENDAHARA 1): PENERIMAAN KASIR SANTRI HARI INI */}
            <AtmCard
              theme="emerald"
              issuer="BANK QOMARUDDIN"
              tier="HASANAH DEBIT"
              chip="gold"
              numberMask="5321 •••• •••• 2026"
              label="Penerimaan Kasir Santri Hari Ini"
              amount={`+${formatRupiah(totalMasukHariIni)}`}
              subText={`${todayPayments.length} Setoran Santri Berhasil`}
              holder={str(session?.name, 'MAS UDIN')}
              validThru="REALTIME"
              network="GPN"
            />

            {/* KARTU ATM 2 (BENDAHARA 1): TOTAL TRANSAKSI KASIR HARI INI */}
            <AtmCard
              theme="sapphire"
              issuer="BANK QOMARUDDIN"
              tier="PLATINUM COUNTER"
              chip="silver"
              numberMask="4820 •••• •••• 0812"
              label="Transaksi Santri Hari Ini"
              amount={`${todayPayments.length} Transaksi`}
              subText="Setoran SPP & Tagihan Santri"
              holder="KASIR SANTRI"
              validThru="TODAY"
              network="DEBIT"
            />

            {/* KARTU ATM 3 (BENDAHARA 1): TOTAL SANTRI TERDAFTAR */}
            <AtmCard
              theme="titanium"
              issuer="BANK QOMARUDDIN"
              tier="BLACK TITANIUM"
              chip="gold"
              numberMask="9660 •••• •••• 1914"
              label="Total Santri Terdaftar"
              amount={`${totalSantri.toLocaleString('id-ID')} Santri`}
              subText="Objek Wajib Tagihan Santri"
              holder="PP QOMARUDDIN"
              validThru="2026"
              network="INFINITE"
            />

            {/* KARTU ATM 4 (BENDAHARA 1): UANG TUNAI DI LACI KASIR */}
            <AtmCard
              theme="bronze"
              issuer="BANK QOMARUDDIN"
              tier="CASH VAULT"
              chip="copper"
              numberMask="7700 •••• •••• LACI"
              label="Uang Tunai di Laci Kasir"
              amount={formatRupiah(breakdownMetode.tunai)}
              subText={`${breakdownMetode.tunaiPct}% Fisik Uang di Laci Kasir`}
              holder="LACI KASIR"
              validThru="VERIFIED"
              network="CASH"
            />
          </>
        ) : (
          <>
            {/* KARTU ATM 1 (BENDAHARA 2): SALDO KAS BERSIH UTAMA */}
            <AtmCard
              theme="emerald"
              issuer="YAYASAN QOMARUDDIN"
              tier="TREASURY RESERVE"
              chip="gold"
              numberMask="5218 •••• •••• 9999"
              label="Saldo Kas Bersih Yayasan"
              amount={formatRupiah(saldoKasBersih)}
              subText="Surplus Kas Bersih Terverifikasi"
              holder={str(session?.name, 'KEPALA BENDAHARA')}
              validThru="REALTIME"
              network="PRIORITAS"
            />

            {/* KARTU ATM 2 (BENDAHARA 2): TOTAL PENERIMAAN HARI INI */}
            <AtmCard
              theme="sapphire"
              issuer="BANK QOMARUDDIN"
              tier="INFLOW PLATINUM"
              chip="silver"
              numberMask="4412 •••• •••• 2026"
              label="Total Penerimaan Hari Ini"
              amount={`+${formatRupiah(totalMasukHariIni)}`}
              subText={`${countMasukHariIni} Transaksi Masuk (Santri + Lain)`}
              holder="KAS MASUK GLOBAL"
              validThru="TODAY"
              network="DEBIT"
            />

            {/* KARTU ATM 3 (BENDAHARA 2): PENGELUARAN OPERASIONAL HARI INI */}
            <AtmCard
              theme="ruby"
              issuer="BANK QOMARUDDIN"
              tier="CORPORATE EXPENSE"
              chip="silver"
              numberMask="4900 •••• •••• OPER"
              label="Pengeluaran Operasional Hari Ini"
              amount={`-${formatRupiah(totalKeluarHariIni)}`}
              subText={`${countKeluarHariIni} Transaksi Operasional Keluar`}
              holder="KAS OPERASIONAL"
              validThru="APPROVED"
              network="CORP"
            />

            {/* KARTU ATM 4 (BENDAHARA 2): TOTAL SANTRI TERDAFTAR */}
            <AtmCard
              theme="titanium"
              issuer="BANK QOMARUDDIN"
              tier="BLACK TITANIUM"
              chip="gold"
              numberMask="9660 •••• •••• 1914"
              label="Total Santri Terdaftar"
              amount={`${totalSantri.toLocaleString('id-ID')} Santri`}
              subText="Objek Wajib Tagihan Santri"
              holder="PP QOMARUDDIN"
              validThru="2026"
              network="INFINITE"
            />
          </>
        )}
      </section>




      {/* 3. TERMINAL AKSI CEPAT TRANSAKSI KASIR (QUICK ACTIONS HUB) */}
      <section className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-50 text-amber-700 border border-amber-200/60 font-black">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Terminal Transaksi Cepat Kasir</h2>
              <p className="text-xs font-semibold text-slate-500">
                Pilih menu cepat untuk input transaksi langsung tanpa berpindah-pindah menu.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Action 1: Bayar SPP Santri */}
          <button
            type="button"
            onClick={() => onNavigateFinance?.('today')}
            className="group relative flex flex-col justify-between rounded-3xl border-2 border-emerald-200 bg-linear-to-br from-emerald-50/70 to-white p-5 text-left transition-all hover:border-[#138F81] hover:shadow-lg hover:shadow-emerald-900/10"
          >
            <div className="flex items-center justify-between">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#138F81] text-white shadow-md shadow-[#138F81]/30 group-hover:scale-105 transition-transform">
                <CreditCard size={24} />
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-[#138F81] uppercase">
                Prioritas Utama
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-base font-black text-slate-900 group-hover:text-[#138F81] transition-colors">
                Bayar SPP / Tagihan Santri
              </h3>
              <p className="text-xs font-medium text-slate-500 mt-1">
                Input pembayaran SPP harian, terima setoran wali santri, dan langsung cetak struk kuitansi kasir.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-black text-[#138F81]">
              <span>Buka Kasir Pembayaran</span>
              <span className="ml-1 group-hover:translate-x-1 transition-transform">➔</span>
            </div>
          </button>

          {/* Action 2: Cek Tagihan & Profil Santri */}
          <button
            type="button"
            onClick={() => onNavigateFinance?.('student')}
            className="group relative flex flex-col justify-between rounded-3xl border border-slate-200 bg-slate-50/40 p-5 text-left transition-all hover:border-sky-400 hover:bg-sky-50/40 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-500 text-white shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
                <Search size={22} />
              </div>
              <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-black text-sky-700 uppercase">
                Pencarian
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-base font-black text-slate-900 group-hover:text-sky-700 transition-colors">
                Cari Tagihan & Buku Santri
              </h3>
              <p className="text-xs font-medium text-slate-500 mt-1">
                Cari santri berdasarkan Nama atau NIS untuk memeriksa rincian tagihan belum lunas, riwayat, dan WhatsApp bot.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-black text-sky-700">
              <span>Cek Tagihan Santri</span>
              <span className="ml-1 group-hover:translate-x-1 transition-transform">➔</span>
            </div>
          </button>

          {/* Action 3: Riwayat & Rekap Pembayaran */}
          <button
            type="button"
            onClick={() => onNavigateFinance?.('history')}
            className="group relative flex flex-col justify-between rounded-3xl border border-slate-200 bg-slate-50/40 p-5 text-left transition-all hover:border-purple-400 hover:bg-purple-50/40 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#6C5CE7] text-white shadow-md shadow-[#6C5CE7]/20 group-hover:scale-105 transition-transform">
                <History size={22} />
              </div>
              <span className="rounded-full bg-purple-100 px-2.5 py-1 text-[10px] font-black text-purple-700 uppercase">
                Rekap Kas
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-base font-black text-slate-900 group-hover:text-[#6C5CE7] transition-colors">
                Riwayat & Export Rekap Excel
              </h3>
              <p className="text-xs font-medium text-slate-500 mt-1">
                Lihat seluruh mutasi kasir harian/bulanan dan export ke format spreadsheet (.xlsx) siap cetak.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-black text-[#6C5CE7]">
              <span>Buka Buku Riwayat Kas</span>
              <span className="ml-1 group-hover:translate-x-1 transition-transform">➔</span>
            </div>
          </button>

          {/* Action 4 & 5: Kas Masuk & Pengeluaran Khusus Bendahara 2 (Kepala Bendahara) */}
          {!isBendahara1 && (
            <>
              <button
                type="button"
                onClick={() => onNavigateFinance?.('pemasukan_lain')}
                className="group relative flex flex-col justify-between rounded-3xl border border-teal-200 bg-teal-50/40 p-5 text-left transition-all hover:border-[#138F81] hover:bg-teal-50 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-600 text-white shadow-md shadow-teal-600/20 group-hover:scale-105 transition-transform">
                    <ArrowDownCircle size={22} />
                  </div>
                  <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[10px] font-black text-teal-800 uppercase">
                    Kas Umum
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-base font-black text-slate-900 group-hover:text-teal-800 transition-colors">
                    Catat Kas Masuk Lain
                  </h3>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    Input donasi, infaq santri, hasil unit usaha pesantren, dan penerimaan kas di luar tagihan SPP.
                  </p>
                </div>
                <div className="mt-4 flex items-center text-xs font-black text-teal-700">
                  <span>Input Kas Masuk</span>
                  <span className="ml-1 group-hover:translate-x-1 transition-transform">➔</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigateFinance?.('pengeluaran')}
                className="group relative flex flex-col justify-between rounded-3xl border border-rose-200 bg-rose-50/40 p-5 text-left transition-all hover:border-rose-400 hover:bg-rose-50 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-500 text-white shadow-md shadow-rose-500/20 group-hover:scale-105 transition-transform">
                    <ArrowUpCircle size={22} />
                  </div>
                  <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-black text-rose-700 uppercase">
                    Operasional
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-base font-black text-slate-900 group-hover:text-rose-700 transition-colors">
                    Catat Pengeluaran Kas
                  </h3>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    Catat belanja santri, beras, dapur, listrik, honor guru, dan pengeluaran pembangunan pondok.
                  </p>
                </div>
                <div className="mt-4 flex items-center text-xs font-black text-rose-600">
                  <span>Input Pengeluaran Kas</span>
                  <span className="ml-1 group-hover:translate-x-1 transition-transform">➔</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigateFinance?.('types')}
                className="group relative flex flex-col justify-between rounded-3xl border border-amber-200 bg-amber-50/40 p-5 text-left transition-all hover:border-amber-400 hover:bg-amber-50 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-600 text-white shadow-md shadow-amber-600/20 group-hover:scale-105 transition-transform">
                    <Sliders size={22} />
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-800 uppercase">
                    Master Tarif
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-base font-black text-slate-900 group-hover:text-amber-800 transition-colors">
                    Atur Tarif & Pos Tagihan SPP
                  </h3>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    Kelola tarif tagihan SPP bulanan, uang makan, kitab, dan nominal khusus per semester.
                  </p>
                </div>
                <div className="mt-4 flex items-center text-xs font-black text-amber-700">
                  <span>Atur Pos & Tarif Tagihan</span>
                  <span className="ml-1 group-hover:translate-x-1 transition-transform">➔</span>
                </div>
              </button>
            </>
          )}
        </div>
      </section>

      {/* 4. VISUAL CASH ANALYTICS & CASH DRAWER BREAKDOWN (GRAFIK ARUS KAS ALA BANK) */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Grafik Arus Kas Pemasukan vs Pengeluaran */}
        <div className="lg:col-span-2 rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
            <div>
              <h3 className="text-base font-black text-slate-900">Grafik Arus Kas (Cash Flow Bulanan)</h3>
              <p className="text-xs font-semibold text-slate-500">Perbandingan pemasukan vs pengeluaran kas pesantren</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-[#138F81]">
                <span className="h-3 w-3 rounded-md bg-[#138F81] inline-block" /> Pemasukan
              </span>
              <span className="flex items-center gap-1.5 text-rose-500">
                <span className="h-3 w-3 rounded-md bg-rose-400 inline-block" /> Pengeluaran
              </span>
            </div>
          </div>

          <div className="h-[280px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPemasukan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#138F81" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#138F81" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorPengeluaran" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF7675" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#FF7675" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${(Number(v) / 1000000).toFixed(0)}jt`}
                  />
                  <RechartsTooltip
                    formatter={(value: any) => [formatRupiah(Number(value) || 0), '']}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="pemasukan" stroke="#138F81" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPemasukan)" name="Pemasukan" />
                  <Area type="monotone" dataKey="pengeluaran" stroke="#FF7675" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPengeluaran)" name="Pengeluaran" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-xs font-bold text-slate-400">
                Memuat grafik arus kas...
              </div>
            )}
          </div>
        </div>

        {/* Breakdown Kasir Hari Ini (Laci Kasir Tunai vs Bank Transfer vs QRIS) */}
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-slate-900">Rekap Kasir Hari Ini</h3>
            <p className="text-xs font-semibold text-slate-500">Penerimaan kas berdasarkan kanal bayar</p>
          </div>

          <div className="space-y-3.5">
            {/* Tunai / Cash */}
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3.5">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="flex items-center gap-1.5 text-emerald-900">
                  <Banknote size={16} className="text-emerald-600" />
                  <span>💵 Kas Tunai di Laci Kasir</span>
                </span>
                <span className="text-emerald-700">{breakdownMetode.tunaiPct}%</span>
              </div>
              <p className="text-lg font-black text-emerald-900 mt-1">{formatRupiah(breakdownMetode.tunai)}</p>
              <div className="mt-2 h-2 w-full rounded-full bg-emerald-200 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${breakdownMetode.tunaiPct}%` }} />
              </div>
            </div>

            {/* Transfer Bank */}
            <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-3.5">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="flex items-center gap-1.5 text-sky-900">
                  <Landmark size={16} className="text-sky-600" />
                  <span>🏦 Transfer Bank (BSI/Mandiri)</span>
                </span>
                <span className="text-sky-700">{breakdownMetode.transferPct}%</span>
              </div>
              <p className="text-lg font-black text-sky-900 mt-1">{formatRupiah(breakdownMetode.transfer)}</p>
              <div className="mt-2 h-2 w-full rounded-full bg-sky-200 overflow-hidden">
                <div className="h-full bg-sky-500 rounded-full" style={{ width: `${breakdownMetode.transferPct}%` }} />
              </div>
            </div>

            {/* QRIS */}
            <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-3.5">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="flex items-center gap-1.5 text-purple-900">
                  <QrCode size={16} className="text-purple-600" />
                  <span>📱 QRIS & E-Wallet</span>
                </span>
                <span className="text-purple-700">{breakdownMetode.qrisPct}%</span>
              </div>
              <p className="text-lg font-black text-purple-900 mt-1">{formatRupiah(breakdownMetode.qris)}</p>
              <div className="mt-2 h-2 w-full rounded-full bg-purple-200 overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${breakdownMetode.qrisPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. LIVE LEDGER MUTASI TRANSAKSI TERKINI (ALA INTERNET BANKING) */}
      <section className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="text-base font-black text-slate-900">Mutasi Transaksi Kas Terkini (Live Ledger)</h3>
            <p className="text-xs font-semibold text-slate-500">
              Log transaksi pembayaran santri dan mutasi kasir yang baru saja tercatat
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateFinance?.('history')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 transition-colors"
          >
            <span>Buka Riwayat Lengkap</span>
            <span>➔</span>
          </button>
        </div>

        {recentTransactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-3">Waktu / Tanggal</th>
                  <th className="py-3 px-3">No. Transaksi</th>
                  <th className="py-3 px-3">Nama Santri / Keterangan</th>
                  <th className="py-3 px-3">Pos Tagihan</th>
                  <th className="py-3 px-3">Metode</th>
                  <th className="py-3 px-3 text-right">Nominal</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {recentTransactions.slice(0, 8).map((trx, idx) => {
                  const student = trx.siswa as ApiRecord | undefined;
                  const studentName = str(trx.siswa_nama || trx.nama_siswa || student?.nama || trx.nama || 'Santri');
                  const posName = str(trx.pos_tagihan || trx.jenis_pembayaran || trx.tipe_pembayaran || 'SPP Pondok');
                  const via = str(trx.via || trx.metode || 'Tunai');
                  const time = str(trx.tanggal || trx.created_at || '').slice(0, 16);

                  return (
                    <tr key={num(trx.id) || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">{time}</td>
                      <td className="py-3 px-3 font-mono font-bold text-[#138F81] whitespace-nowrap">
                        #{num(trx.id) || idx + 1}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                        {studentName}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-[#138F81] border border-teal-100">
                          {posName}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-bold text-slate-600">
                          {via.toLowerCase().includes('tunai') ? '💵 Tunai' : via.toLowerCase().includes('qris') ? '📱 QRIS' : `🏦 ${via}`}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-emerald-600 whitespace-nowrap">
                        +{formatRupiah(num(trx.jumlah))}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={11} /> Sukses
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-xs font-bold text-slate-400">
            Belum ada transaksi yang tercatat hari ini.
          </div>
        )}
      </section>
    </div>
  );
}
