import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  DoorOpen,
  FileText,
  GraduationCap,
  HeartHandshake,
  HelpCircle,
  Home,
  Info,
  KeyRound,
  LogOut,
  MapPin,
  MessageCircle,
  Phone,
  QrCode,
  Receipt,
  RefreshCw,
  School,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  UserCheck,
  UserRound,
  Users,
  Wallet,
  XCircle,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api, type ApiRecord } from '../services/api';

type WaliTabKey = 'biodata' | 'keuangan' | 'absensi' | 'nilai';
type AbsensiSubTab = 'madin' | 'ngaji' | 'sholat';
type KeuanganSubTab = 'tagihan' | 'riwayat';
type NilaiSubTab = 'akademik' | 'hafalan';

export function WaliPortalPage() {
  const { session, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<WaliTabKey>('keuangan');
  const [absensiSubTab, setAbsensiSubTab] = useState<AbsensiSubTab>('madin');
  const [keuanganSubTab, setKeuanganSubTab] = useState<KeuanganSubTab>('tagihan');
  const [nilaiSubTab, setNilaiSubTab] = useState<NilaiSubTab>('akademik');

  // Change password and security warning states
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [securityWarningDismissed, setSecurityWarningDismissed] = useState(() => {
    return session?.id ? sessionStorage.getItem(`dismissed_wali_pwd_warning_${session.id}`) === 'true' : false;
  });

  // Copied account number feedback
  const [copiedRekening, setCopiedRekening] = useState(false);

  // Multi-child list
  const [childrenList, setChildrenList] = useState<ApiRecord[]>(() => {
    return Array.isArray(session?.anak) ? session.anak : [];
  });
  const [selectedChildId, setSelectedChildId] = useState<number | null>(() => {
    if (Array.isArray(session?.anak) && session.anak.length > 0) {
      return Number(session.anak[0].id ?? 0);
    }
    return null;
  });

  // Data states
  const [isLoading, setIsLoading] = useState(false);
  const [childData, setChildData] = useState<ApiRecord | null>(null);
  const [biodata, setBiodata] = useState<ApiRecord | null>(null);
  const [keuanganData, setKeuanganData] = useState<ApiRecord | null>(null);
  const [absensiMadinData, setAbsensiMadinData] = useState<ApiRecord | null>(null);
  const [absensiSholatData, setAbsensiSholatData] = useState<ApiRecord | null>(null);
  const [absensiNgajiData, setAbsensiNgajiData] = useState<ApiRecord | null>(null);
  const [nilaiData, setNilaiData] = useState<ApiRecord | null>(null);

  // Search filter for bills
  const [billSearch, setBillSearch] = useState('');
  const [billStatusFilter, setBillStatusFilter] = useState<'all' | 'belum' | 'lunas'>('all');

  // Month & year filter for attendance
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

  // Load children list on mount if empty
  useEffect(() => {
    async function fetchChildren() {
      try {
        const res = await api.waliAnak();
        const list = Array.isArray(res.data) ? (res.data as ApiRecord[]) : [];
        if (list.length > 0) {
          setChildrenList(list);
          if (!selectedChildId) {
            setSelectedChildId(Number(list[0].id));
          }
        }
      } catch (err) {
        console.error('Failed to load children list', err);
      }
    }
    if (childrenList.length === 0) {
      fetchChildren();
    }
  }, [childrenList.length, selectedChildId]);

  // Load current child data when selectedChildId changes
  useEffect(() => {
    if (!selectedChildId) return;

    let isMounted = true;
    async function loadAllDataForChild(siswaId: number) {
      setIsLoading(true);
      try {
        // Run parallel queries
        const [bioRes, payRes, madinRes, sholatRes, ngajiRes, nilaiRes] = await Promise.allSettled([
          api.waliBiodata(siswaId),
          api.waliPembayaran(siswaId),
          api.waliAbsensi(siswaId, { bulan: selectedMonth, tahun: selectedYear }),
          api.waliAbsensiSholat(siswaId, { bulan: selectedMonth, tahun: selectedYear }),
          api.waliAbsensiNgaji(siswaId, { bulan: selectedMonth, tahun: selectedYear }),
          api.waliNilai(siswaId),
        ]);

        if (!isMounted) return;

        if (bioRes.status === 'fulfilled' && bioRes.value.success) {
          const bio = bioRes.value.data as ApiRecord;
          setBiodata(bio);
          setChildData(bio);
        } else {
          // fallback to matching child in childrenList
          const found = childrenList.find((c) => Number(c.id) === siswaId);
          if (found) {
            setChildData(found);
            setBiodata(found);
          }
        }

        if (payRes.status === 'fulfilled' && payRes.value.success) {
          setKeuanganData(payRes.value);
        }

        if (madinRes.status === 'fulfilled' && madinRes.value.success) {
          setAbsensiMadinData(madinRes.value);
        }

        if (sholatRes.status === 'fulfilled' && sholatRes.value.success) {
          setAbsensiSholatData(sholatRes.value);
        }

        if (ngajiRes.status === 'fulfilled' && ngajiRes.value.success) {
          setAbsensiNgajiData(ngajiRes.value);
        }

        if (nilaiRes.status === 'fulfilled' && nilaiRes.value.success) {
          setNilaiData(nilaiRes.value);
        }
      } catch (error) {
        console.error('Error fetching data for child:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadAllDataForChild(selectedChildId);

    return () => {
      isMounted = false;
    };
  }, [selectedChildId, selectedMonth, selectedYear, childrenList]);

  // Reload attendance when filter changes
  const handleReloadAttendance = async () => {
    if (!selectedChildId) return;
    try {
      const [madinRes, sholatRes, ngajiRes] = await Promise.allSettled([
        api.waliAbsensi(selectedChildId, { bulan: selectedMonth, tahun: selectedYear }),
        api.waliAbsensiSholat(selectedChildId, { bulan: selectedMonth, tahun: selectedYear }),
        api.waliAbsensiNgaji(selectedChildId, { bulan: selectedMonth, tahun: selectedYear }),
      ]);
      if (madinRes.status === 'fulfilled' && madinRes.value.success) {
        setAbsensiMadinData(madinRes.value);
      }
      if (sholatRes.status === 'fulfilled' && sholatRes.value.success) {
        setAbsensiSholatData(sholatRes.value);
      }
      if (ngajiRes.status === 'fulfilled' && ngajiRes.value.success) {
        setAbsensiNgajiData(ngajiRes.value);
      }
    } catch (err) {
      console.error('Failed to reload attendance', err);
    }
  };

  // Memoized values
  const studentName = String(childData?.nama || biodata?.nama || session?.name || 'Santri');
  const studentNis = String(childData?.nis || biodata?.nis || '-');
  const studentKelas = String(childData?.kelas || biodata?.kelas || (biodata?.academicClass as Record<string, unknown> | undefined)?.name || '-');
  const studentKomplek = String(childData?.komplek || biodata?.komplek || (biodata?.dormitoryRoom as Record<string, unknown> | undefined)?.komplek || '-');
  const studentKamar = String(childData?.kamar || biodata?.kamar || (biodata?.dormitoryRoom as Record<string, unknown> | undefined)?.name || '-');
  const studentStatus = String(childData?.status || biodata?.status || 'Aktif');

  // Financial calculations
  const totalBelumLunas = Number(keuanganData?.total_belum_lunas ?? 0);
  const totalLunas = Number(keuanganData?.total_lunas ?? 0);
  const tagihanList = useMemo(() => {
    return Array.isArray(keuanganData?.tagihan) ? (keuanganData.tagihan as ApiRecord[]) : [];
  }, [keuanganData]);

  const historyList = useMemo(() => {
    return Array.isArray(keuanganData?.riwayat_transaksi) ? (keuanganData.riwayat_transaksi as ApiRecord[]) : [];
  }, [keuanganData]);

  const filteredTagihanList = useMemo(() => {
    return tagihanList.filter((b) => {
      const matchSearch =
        billSearch === '' ||
        String(b.title || b.nama_pos || (b.payment_type as Record<string, unknown> | undefined)?.nama || '')
          .toLowerCase()
          .includes(billSearch.toLowerCase()) ||
        String(b.period_label || b.month_name || b.bulan || '')
          .toLowerCase()
          .includes(billSearch.toLowerCase());

      const status = String(b.status_tagihan || b.status || '');
      const isLunas = status === 'Lunas';

      if (billStatusFilter === 'belum') {
        return matchSearch && !isLunas;
      }
      if (billStatusFilter === 'lunas') {
        return matchSearch && isLunas;
      }
      return matchSearch;
    });
  }, [tagihanList, billSearch, billStatusFilter]);

  // Attendance stats
  const madinStats = (absensiMadinData?.statistik ?? {}) as ApiRecord;
  const madinGrouped = useMemo(() => {
    return Array.isArray(absensiMadinData?.grouped) ? (absensiMadinData.grouped as ApiRecord[]) : [];
  }, [absensiMadinData]);

  const sholatStats = (absensiSholatData?.ringkasan ?? {}) as ApiRecord;
  const sholatGrouped = useMemo(() => {
    return Array.isArray(absensiSholatData?.grouped) ? (absensiSholatData.grouped as ApiRecord[]) : [];
  }, [absensiSholatData]);

  const ngajiStats = (absensiNgajiData?.ringkasan ?? {}) as ApiRecord;
  const ngajiGrouped = useMemo(() => {
    return Array.isArray(absensiNgajiData?.grouped) ? (absensiNgajiData.grouped as ApiRecord[]) : [];
  }, [absensiNgajiData]);

  const totalMadinPresensi = Number(madinStats.total ?? 0);
  const hadirMadinPresensi = Number(madinStats.hadir ?? 0);
  const madinPercent = totalMadinPresensi > 0 ? Math.round((hadirMadinPresensi / totalMadinPresensi) * 100) : 100;

  // Nilai records
  const raportList = useMemo(() => {
    return Array.isArray(nilaiData?.raport) ? (nilaiData.raport as ApiRecord[]) : [];
  }, [nilaiData]);

  const hafalanList = useMemo(() => {
    return Array.isArray(nilaiData?.hafalan) ? (nilaiData.hafalan as ApiRecord[]) : [];
  }, [nilaiData]);

  const monthsList = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' },
  ];

  const handleCopyRekening = () => {
    navigator.clipboard.writeText('7171202688');
    setCopiedRekening(true);
    setTimeout(() => setCopiedRekening(false), 2500);
  };

  return (
    <div className="q-app-shell min-h-screen bg-[#FFDC80] p-2.5 sm:p-4 lg:p-6 theme-light overflow-x-hidden font-sans">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        {/* ========================================================================= */}
        {/* 1. TOP NAVBAR (MATCHING ADMIN DASHBOARD HEADER) */}
        {/* ========================================================================= */}
        <header className="q-topbar flex min-h-14 sm:min-h-16 items-center justify-between gap-2 sm:gap-3 rounded-2xl sm:rounded-[26px] bg-[#FFFDF7] px-4 sm:px-6 shadow-xl shadow-black/5">
          {/* BRANDING WITH PROJECT TEAL LOGO */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl p-1.5 bg-[#E1EFF7] flex items-center justify-center shadow-xs shrink-0">
              <img
                src="/logo-qomaruddin.png"
                alt="Logo Qomaruddin"
                className="h-8 w-8 sm:h-9 sm:w-9 object-contain drop-shadow-xs"
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-[#138F81] tracking-tight leading-none">
                  Portal Wali Santri
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-[#E8F7F3] text-[#138F81] border border-[#138F81]/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#138F81] animate-pulse" />
                  Live Database
                </span>
              </div>
              <p className="text-xs font-semibold text-[#636E72] mt-0.5 hidden sm:block">
                Yayasan Pondok Pesantren Qomaruddin • Sampurnan Bungah Gresik
              </p>
            </div>
          </div>

          {/* USER CONTROLS & WALI PROFILE */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="hidden lg:flex flex-col items-end pr-3 border-r border-slate-200">
              <div className="flex items-center gap-1.5 text-xs font-black text-[#2D3436]">
                <ShieldCheck size={14} className="text-[#138F81]" />
                <span>{session?.name || 'Wali Santri'}</span>
              </div>
              <span className="text-[10px] font-extrabold text-[#138F81] bg-[#E8F7F3] px-2 py-0.5 rounded-md border border-[#138F81]/20 mt-0.5">
                Wali Santri Resmi
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsChangePasswordOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#138F81] bg-[#E1EFF7] hover:bg-[#138F81] hover:text-white rounded-xl sm:rounded-2xl transition shadow-xs cursor-pointer active:scale-95"
              title="Ganti Kata Sandi Akun"
            >
              <KeyRound size={14} />
              <span className="hidden sm:inline">Ganti Sandi</span>
            </button>

            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200 rounded-xl sm:rounded-2xl transition shadow-xs cursor-pointer active:scale-95"
              title="Keluar dari Portal Wali"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        {/* ========================================================================= */}
        {/* 2. NON-MANDATORY SECURITY WARNING BANNER */}
        {/* ========================================================================= */}
        {session?.must_change_password && !securityWarningDismissed && (
          <div className="q-card rounded-2xl sm:rounded-[24px] bg-white p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-amber-300">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-[#FFF8E1] text-[#E65100] shrink-0">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h4 className="text-sm font-black text-[#2D3436] flex items-center gap-2">
                  Rekomendasi Keamanan Akun Wali
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-black px-2 py-0.5 rounded-full border border-amber-300">
                    Sandi Bawaan
                  </span>
                </h4>
                <p className="text-xs text-[#636E72] font-medium mt-0.5 leading-relaxed">
                  Akun Anda saat ini masih menggunakan kata sandi default (<code className="bg-[#E1EFF7] px-1.5 py-0.5 rounded font-mono font-bold text-[#138F81]">siswa12345</code>). Demi keamanan data santri dan tagihan, kami sarankan untuk mengganti kata sandi Anda.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(true)}
                className="px-3.5 py-2 text-xs font-black rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white transition shadow-md cursor-pointer"
              >
                🔒 Ganti Sandi Sekarang
              </button>
              <button
                type="button"
                onClick={() => {
                  if (session?.id) sessionStorage.setItem(`dismissed_wali_pwd_warning_${session.id}`, 'true');
                  setSecurityWarningDismissed(true);
                }}
                className="px-3 py-2 text-xs font-bold rounded-xl text-[#636E72] bg-[#E1EFF7] hover:bg-[#d5e7f2] transition cursor-pointer"
              >
                Nanti Saja
              </button>
            </div>
          </div>
        )}

        {/* MULTI CHILD SWITCHER (IF > 1) */}
        {childrenList.length > 1 && (
          <div className="q-card flex flex-wrap items-center gap-2 p-3.5 bg-white rounded-2xl sm:rounded-[24px]">
            <span className="text-xs font-black text-[#2D3436] pl-1 flex items-center gap-1.5">
              <Users size={15} className="text-[#138F81]" />
              Pilih Santri:
            </span>
            {childrenList.map((child) => (
              <button
                key={String(child.id)}
                type="button"
                onClick={() => setSelectedChildId(Number(child.id))}
                className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer ${
                  Number(child.id) === selectedChildId
                    ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/25'
                    : 'bg-[#E1EFF7] text-[#138F81] hover:bg-[#d0e5f2]'
                }`}
              >
                👨‍🎓 {String(child.nama || 'Santri')} ({String(child.nis || '-')})
              </button>
            ))}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. HERO SANTRI PROFILE CARD (SIGNATURE TEAL & ACCENT YELLOW) */}
        {/* ========================================================================= */}
        <section className="relative overflow-hidden rounded-2xl sm:rounded-[28px] bg-gradient-to-br from-[#138F81] via-[#0D7A6F] to-[#0A5C54] text-white p-6 sm:p-8 shadow-xl shadow-[#138F81]/25 border-2 border-white/20">
          {/* Subtle Ambient Glow */}
          <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute right-1/4 -bottom-10 h-44 w-44 rounded-full bg-[#FFDC80]/20 blur-2xl pointer-events-none" />

          {/* Watermark Emblem */}
          <div className="absolute right-4 top-4 text-white/5 font-serif text-8xl font-black select-none pointer-events-none">
            ۞
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4 sm:gap-6">
              {/* AVATAR WITH YELLOW EMBLEM ACCENT */}
              <div className="relative shrink-0">
                <div className="grid h-18 w-18 sm:h-22 sm:w-22 place-items-center rounded-2xl sm:rounded-3xl bg-[#FFDC80] text-[#0D7A6F] text-2xl sm:text-3xl font-black shadow-lg shadow-black/20">
                  {studentName.charAt(0).toUpperCase()}
                </div>
                <span
                  className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-400 border-2 border-[#138F81] shadow-xs"
                  title="Santri Aktif Terdaftar"
                />
              </div>

              {/* NAME & EMBOSSED METADATA */}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight">
                    {studentName}
                  </h2>
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-[#FFDC80] text-[#0D7A6F] shadow-xs">
                    <CheckCircle2 size={12} />
                    {studentStatus}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 mt-2.5 text-xs sm:text-sm text-white font-semibold">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20">
                    <UserRound size={14} className="text-[#FFDC80]" />
                    NIS: <strong className="text-white font-extrabold">{studentNis}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20">
                    <School size={14} className="text-[#FFDC80]" />
                    Kelas: <strong className="text-white font-extrabold">{studentKelas}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20">
                    <Building2 size={14} className="text-[#FFDC80]" />
                    Asrama: <strong className="text-white font-extrabold">{studentKomplek}</strong> • Kamar: <strong className="text-white font-extrabold">{studentKamar}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* QUICK KPI PILLS */}
            <div className="flex items-center gap-3 self-stretch lg:self-auto justify-between lg:justify-end border-t border-white/15 pt-4 lg:border-t-0 lg:pt-0">
              {/* KEWAJIBAN KEUANGAN */}
              <button
                type="button"
                onClick={() => setActiveTab('keuangan')}
                className="px-4 py-2.5 text-center rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 transition cursor-pointer text-left sm:text-center"
              >
                <span className="block text-[10px] uppercase font-black text-[#FFDC80] tracking-wider">
                  Kewajiban Tagihan
                </span>
                <span
                  className={`text-xs font-black px-2.5 py-0.5 rounded-lg inline-block mt-1 ${
                    totalBelumLunas > 0
                      ? 'bg-[#FFDC80] text-[#0D7A6F] shadow-sm'
                      : 'bg-emerald-400 text-emerald-950'
                  }`}
                >
                  {totalBelumLunas > 0
                    ? `⚠️ ${tagihanList.filter((t) => t.status_tagihan !== 'Lunas').length} Pos (Rp ${totalBelumLunas.toLocaleString('id-ID')})`
                    : '✅ Semua Lunas'}
                </span>
              </button>

              <div className="h-10 w-px bg-white/20 hidden sm:block" />

              {/* KEHADIRAN MADIN */}
              <button
                type="button"
                onClick={() => setActiveTab('absensi')}
                className="px-4 py-2.5 text-center rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 transition cursor-pointer"
              >
                <span className="block text-[10px] uppercase font-black text-white/80 tracking-wider">
                  Disiplin Kehadiran
                </span>
                <span className="text-sm font-black text-white block mt-0.5">
                  {totalMadinPresensi > 0 ? `${madinPercent}% Hadir` : '100% (Disiplin)'}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. NAVIGATION TABS (MATCHING PROJECT DESIGN SYSTEM) */}
        {/* ========================================================================= */}
        <nav className="flex items-center gap-2 overflow-x-auto p-1.5 rounded-2xl sm:rounded-[24px] bg-white shadow-xl shadow-black/5 scrollbar-none">
          {[
            {
              key: 'keuangan',
              label: 'Keuangan & Tagihan',
              icon: Wallet,
              badge: totalBelumLunas > 0 ? `${tagihanList.filter((t) => t.status_tagihan !== 'Lunas').length} Tagihan` : null,
              badgeColor: 'bg-amber-100 text-[#E65100] font-black border border-amber-300',
            },
            {
              key: 'absensi',
              label: 'Absensi Realtime',
              icon: CalendarCheck,
              badge: totalMadinPresensi > 0 ? `${hadirMadinPresensi} Hadir` : null,
              badgeColor: 'bg-[#E8F7F3] text-[#138F81] border border-[#138F81]/30',
            },
            { key: 'biodata', label: 'Data Diri Santri', icon: User, badge: null, badgeColor: '' },
            { key: 'nilai', label: 'Nilai & Hafalan', icon: Award, badge: null, badgeColor: '' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as WaliTabKey)}
                className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-black rounded-xl sm:rounded-2xl transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#138F81] text-white shadow-lg shadow-[#138F81]/25'
                    : 'text-[#636E72] hover:bg-[#E1EFF7] hover:text-[#138F81]'
                }`}
              >
                <Icon size={17} className={isActive ? 'text-white' : 'text-[#636E72]'} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-[#FFDC80] text-[#0D7A6F]' : tab.badgeColor
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* ========================================================================= */}
        {/* 5. TAB CONTENTS */}
        {/* ========================================================================= */}
        {isLoading ? (
          <div className="q-card py-16 text-center rounded-[28px] bg-white">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#E1EFF7] border-t-[#138F81] mx-auto mb-3" />
            <p className="text-xs font-black text-[#138F81] animate-pulse">
              Memuat data santri & tagihan secara realtime...
            </p>
          </div>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* TAB 1: KEUANGAN & TAGIHAN REALTIME */}
            {/* ========================================================================= */}
            {activeTab === 'keuangan' && (
              <div className="space-y-4 sm:space-y-6">
                {/* 3 BANKING CARDS: TOTAL TAGIHAN, TOTAL LUNAS, BSI OFFICIAL ACCOUNT */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                  {/* CARD 1: TAGIHAN MENUNGGU (THEME ORANGE BANKING CARD) */}
                  <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#E65100] via-[#EF6C00] to-[#F57C00] p-6 text-white shadow-xl shadow-orange-950/15 border-2 border-orange-300/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* EMV Microchip Motif */}
                        <div className="h-7 w-9 rounded-md bg-[#FFDC80] border border-amber-200 shadow-inner grid grid-cols-2 gap-0.5 p-0.5">
                          <div className="border-r border-amber-600/50" />
                          <div className="border-l border-amber-600/50" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-orange-100">
                          TAGIHAN AKTIF
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-black/25 text-white border border-white/20">
                        {tagihanList.filter((t) => t.status_tagihan !== 'Lunas').length} Pos Belum Lunas
                      </span>
                    </div>

                    <div className="mt-5">
                      <span className="text-xs font-bold text-orange-100 block">Total Tagihan Tertunggak</span>
                      <p className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight">
                        Rp {totalBelumLunas.toLocaleString('id-ID')}
                      </p>
                    </div>

                    <div className="mt-5 pt-3.5 border-t border-white/20 flex items-center justify-between text-[11px] text-orange-100 font-semibold">
                      <span>SPP & Kewajiban Terdaftar</span>
                      <span className="font-black text-[#FFDC80]">Harap Dilunasi</span>
                    </div>
                  </div>

                  {/* CARD 2: PEMBAYARAN LUNAS (THEME TEAL BANKING CARD) */}
                  <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#138F81] via-[#0D7A6F] to-[#0A5C54] p-6 text-white shadow-xl shadow-teal-950/15 border-2 border-teal-300/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Contactless Wave Motif */}
                        <div className="h-7 w-9 rounded-md bg-white/20 border border-white/30 flex items-center justify-center">
                          <CheckCircle2 size={18} className="text-white" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-teal-100">
                          TERVERIFIKASI
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-black/25 text-white border border-white/20">
                        {historyList.length} Kwitansi Tercatat
                      </span>
                    </div>

                    <div className="mt-5">
                      <span className="text-xs font-bold text-teal-100 block">Total Pembayaran Lunas</span>
                      <p className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight">
                        Rp {totalLunas.toLocaleString('id-ID')}
                      </p>
                    </div>

                    <div className="mt-5 pt-3.5 border-t border-white/20 flex items-center justify-between text-[11px] text-teal-100 font-semibold">
                      <span>Laci Kasir & Bank Yayasan</span>
                      <span className="font-black text-[#FFDC80]">Tersinkron Realtime</span>
                    </div>
                  </div>

                  {/* CARD 3: REKENING RESMI & KONFIRMASI KASIR */}
                  <div className="q-card rounded-[26px] bg-white border-2 border-[#138F81]/25 p-6 shadow-xl shadow-black/5 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-[#2D3436] uppercase tracking-wide flex items-center gap-1.5">
                          <Building2 size={16} className="text-[#138F81]" />
                          Rekening Resmi Pesantren
                        </span>
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-[#E8F7F3] text-[#138F81] border border-[#138F81]/20">
                          BSI Syariah
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[#636E72] mt-1">
                        Bank Syariah Indonesia (BSI)
                      </p>
                      <div className="flex items-center justify-between bg-[#E1EFF7] p-3 rounded-2xl border border-[#138F81]/20 mt-2.5">
                        <span className="font-mono font-black text-base sm:text-lg text-[#0D7A6F] tracking-wider">
                          7171 2026 88
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyRekening}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white transition shadow-sm cursor-pointer"
                        >
                          {copiedRekening ? <Check size={13} /> : <Copy size={13} />}
                          {copiedRekening ? 'Tersalin' : 'Salin'}
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] font-medium text-[#636E72] leading-tight">
                      a.n. <strong className="text-[#2D3436]">Yayasan Pondok Pesantren Qomaruddin</strong>. Pembayaran juga dapat dilakukan tunai di loket bendahara pondok.
                    </p>
                  </div>
                </div>

                {/* SUB-TABS: DAFTAR TAGIHAN VS RIWAYAT TRANSAKSI */}
                <div className="q-card bg-white rounded-[28px] shadow-xl shadow-black/5 p-5 sm:p-7 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setKeuanganSubTab('tagihan')}
                        className={`px-4 py-2.5 text-xs font-black rounded-xl transition cursor-pointer ${
                          keuanganSubTab === 'tagihan'
                            ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/25'
                            : 'bg-[#E1EFF7] text-[#138F81] hover:bg-[#d0e5f2]'
                        }`}
                      >
                        📋 Daftar Tagihan SPP & Kewajiban ({tagihanList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setKeuanganSubTab('riwayat')}
                        className={`px-4 py-2.5 text-xs font-black rounded-xl transition cursor-pointer ${
                          keuanganSubTab === 'riwayat'
                            ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/25'
                            : 'bg-[#E1EFF7] text-[#138F81] hover:bg-[#d0e5f2]'
                        }`}
                      >
                        🧾 Riwayat Transaksi & Kwitansi ({historyList.length})
                      </button>
                    </div>

                    {/* SEARCH & FILTER CONTROLS FOR BILLS */}
                    {keuanganSubTab === 'tagihan' && (
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Cari bulan / tagihan..."
                            value={billSearch}
                            onChange={(e) => setBillSearch(e.target.value)}
                            className="pl-8 pr-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-[#f8fafc] text-[#2D3436] placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#138F81]/40"
                          />
                        </div>
                        <select
                          value={billStatusFilter}
                          onChange={(e) => setBillStatusFilter(e.target.value as 'all' | 'belum' | 'lunas')}
                          className="px-3 py-2 text-xs font-black rounded-xl border border-slate-200 bg-[#f8fafc] text-[#2D3436] focus:outline-hidden cursor-pointer"
                        >
                          <option value="all">Semua Status</option>
                          <option value="belum">Belum Lunas</option>
                          <option value="lunas">Sudah Lunas</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* TAB 1 CONTENT: DAFTAR TAGIHAN */}
                  {keuanganSubTab === 'tagihan' ? (
                    filteredTagihanList.length === 0 ? (
                      <div className="py-14 text-center text-slate-400">
                        <CheckCircle2 size={42} className="mx-auto mb-2 text-[#138F81]" />
                        <p className="text-sm font-black text-[#2D3436]">Tidak ada tagihan tertunggak.</p>
                        <p className="text-xs text-[#636E72] mt-0.5">Semua kewajiban pembayaran santri sudah tercatat lunas.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-[#E1EFF7] text-[#138F81] font-black uppercase text-[11px]">
                              <th className="py-3.5 pl-4 rounded-l-xl">Pos Pembayaran</th>
                              <th className="py-3.5 px-3">Bulan / Periode</th>
                              <th className="py-3.5 px-3">Jatuh Tempo</th>
                              <th className="py-3.5 px-3 text-right">Nominal Tagihan</th>
                              <th className="py-3.5 pr-4 text-center rounded-r-xl">Status Pembayaran</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {filteredTagihanList.map((bill, idx) => {
                              const isLunas = bill.status_tagihan === 'Lunas' || bill.status === 'Lunas';
                              const isOverdue = bill.status_tagihan === 'Terlambat' || bill.status === 'Terlambat';
                              const posName = String(
                                (bill.payment_type as Record<string, unknown> | undefined)?.nama ??
                                  bill.title ??
                                  bill.nama_pos ??
                                  'Syahriah / SPP'
                              );
                              const monthLabel = String(bill.period_label ?? bill.month_name ?? bill.bulan ?? bill.periode ?? '-');

                              return (
                                <tr key={idx} className="hover:bg-[#F8FBFC] transition-colors">
                                  <td className="py-3.5 pl-4 font-black text-[#2D3436]">
                                    <div className="flex items-center gap-2">
                                      <span className="h-2 w-2 rounded-full bg-[#138F81]" />
                                      <span>{posName}</span>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-3 text-[#2D3436] font-bold">
                                    {monthLabel} {String(bill.tahun_ajaran ?? '')}
                                  </td>
                                  <td className="py-3.5 px-3 text-[#636E72] font-semibold">
                                    {String(bill.due_date || bill.tanggal_jatuh_tempo || '-')}
                                  </td>
                                  <td className="py-3.5 px-3 text-right font-black text-[#2D3436] text-sm">
                                    Rp {Number(bill.amount ?? bill.nominal ?? 0).toLocaleString('id-ID')}
                                  </td>
                                  <td className="py-3.5 pr-4 text-center">
                                    <span
                                      className={`inline-flex items-center gap-1 px-3 py-1 text-[10px] font-black rounded-lg ${
                                        isLunas
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                          : isOverdue
                                          ? 'bg-rose-50 text-rose-700 border border-rose-300 animate-pulse'
                                          : 'bg-amber-50 text-amber-800 border border-amber-300'
                                      }`}
                                    >
                                      {isLunas ? '🟢 LUNAS' : isOverdue ? '🔴 TERLAMBAT' : '🟡 BELUM LUNAS'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  ) : (
                    /* TAB 2 CONTENT: RIWAYAT TRANSAKSI & KWITANSI */
                    historyList.length === 0 ? (
                      <div className="py-14 text-center text-slate-400">
                        <FileText size={42} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm font-black text-[#2D3436]">Belum ada riwayat pembayaran tercatat.</p>
                        <p className="text-xs text-[#636E72] mt-0.5">Riwayat akan langsung otomatis muncul saat kasir menerima pembayaran.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-[#E1EFF7] text-[#138F81] font-black uppercase text-[11px]">
                              <th className="py-3.5 pl-4 rounded-l-xl">No. Kwitansi / Transaksi</th>
                              <th className="py-3.5 px-3">Tanggal Bayar</th>
                              <th className="py-3.5 px-3">Metode</th>
                              <th className="py-3.5 px-3">Penerima Kasir</th>
                              <th className="py-3.5 px-3 text-right">Jumlah Bayar</th>
                              <th className="py-3.5 pr-4 text-center rounded-r-xl">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {historyList.map((tr, idx) => (
                              <tr key={idx} className="hover:bg-[#F8FBFC] transition-colors">
                                <td className="py-3.5 pl-4 font-black text-[#2D3436] font-mono">
                                  {String(tr.receipt_number || tr.nomor_transaksi || tr.id || '-')}
                                </td>
                                <td className="py-3.5 px-3 text-[#2D3436] font-bold">
                                  {String(tr.tanggal || tr.created_at || '-')}
                                </td>
                                <td className="py-3.5 px-3 text-[#636E72] font-semibold">
                                  <span className="px-2.5 py-0.5 rounded-md bg-[#E1EFF7] text-[#138F81] text-[10px] font-black uppercase">
                                    {String(tr.metode || tr.metode_pembayaran || 'Tunai')}
                                  </span>
                                </td>
                                <td className="py-3.5 px-3 text-[#636E72] font-semibold">
                                  {String(tr.penerima || (tr.user as Record<string, unknown> | undefined)?.name || 'Kasir Pondok')}
                                </td>
                                <td className="py-3.5 px-3 text-right font-black text-[#138F81] text-sm">
                                  Rp {Number(tr.jumlah || tr.amount || 0).toLocaleString('id-ID')}
                                </td>
                                <td className="py-3.5 pr-4 text-center">
                                  <span className="inline-block px-2.5 py-1 text-[10px] font-black rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300">
                                    🟢 LUNAS
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}

                  {/* FOOTNOTE GUIDANCE FOR PARENTS */}
                  <div className="p-4 rounded-2xl bg-[#E1EFF7] border border-[#138F81]/20 text-xs text-[#2D3436] flex items-start gap-3 mt-4">
                    <Info size={18} className="text-[#138F81] shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-black text-[#138F81]">Petunjuk Pembayaran untuk Wali Santri:</h5>
                      <p className="mt-0.5 text-[#636E72] font-medium leading-relaxed">
                        Pembayaran Syahriah & SPP dapat ditunaikan langsung di <strong>Kantor Bendahara Pondok Pesantren Qomaruddin</strong> atau melalui transfer bank ke rekening yayasan resmi. Setelah transfer, kasir akan memverifikasi bukti transaksi dan menerbitkan kwitansi realtime.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: ABSENSI REALTIME (MADIN, SHOLAT, NGAJI) */}
            {/* ========================================================================= */}
            {activeTab === 'absensi' && (
              <div className="space-y-4 sm:space-y-6">
                {/* FILTER HEADER (BULAN, TAHUN & SUB-TABS) */}
                <div className="q-card bg-white rounded-[26px] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl shadow-black/5">
                  <div className="flex items-center gap-2">
                    <Calendar size={18} className="text-[#138F81]" />
                    <span className="text-xs font-black text-[#2D3436] uppercase tracking-wide">
                      Filter Periode:
                    </span>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="px-3 py-1.5 text-xs font-black rounded-xl border border-slate-200 bg-[#f8fafc] text-[#2D3436] focus:ring-2 focus:ring-[#138F81]/30 outline-hidden cursor-pointer"
                    >
                      {monthsList.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="px-3 py-1.5 text-xs font-black rounded-xl border border-slate-200 bg-[#f8fafc] text-[#2D3436] focus:ring-2 focus:ring-[#138F81]/30 outline-hidden cursor-pointer"
                    >
                      {[2024, 2025, 2026, 2027].map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleReloadAttendance}
                      className="p-2 text-[#138F81] hover:text-white bg-[#E1EFF7] hover:bg-[#138F81] rounded-xl transition cursor-pointer"
                      title="Perbarui Data Presensi"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>

                  {/* 3 SUB-TABS: MADIN, NGAJI, SHOLAT */}
                  <div className="flex items-center gap-1.5 bg-[#E1EFF7] p-1.5 rounded-2xl">
                    {[
                      { id: 'madin', label: 'Madin Diniyah' },
                      { id: 'sholat', label: 'Jamaah Sholat' },
                      { id: 'ngaji', label: 'Ngaji Kitab' },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setAbsensiSubTab(st.id as AbsensiSubTab)}
                        className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer ${
                          absensiSubTab === st.id
                            ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/25'
                            : 'text-[#636E72] hover:text-[#138F81]'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* STATS COUNTERS */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div className="q-card bg-[#E8F7F3] rounded-[22px] p-4 sm:p-5 border-2 border-[#138F81]/20 shadow-md">
                    <span className="text-[11px] font-black text-[#138F81] uppercase block">Total Hadir</span>
                    <p className="text-2xl sm:text-3xl font-black text-[#0D7A6F] mt-1">
                      {absensiSubTab === 'madin' ? String(madinStats.hadir ?? 0) : absensiSubTab === 'ngaji' ? String(ngajiStats.hadir ?? 0) : String(sholatStats.masuk ?? 0)} Hari
                    </p>
                  </div>
                  <div className="q-card bg-[#E1EFF7] rounded-[22px] p-4 sm:p-5 border-2 border-sky-300/30 shadow-md">
                    <span className="text-[11px] font-black text-sky-800 uppercase block">Izin</span>
                    <p className="text-2xl sm:text-3xl font-black text-sky-700 mt-1">
                      {absensiSubTab === 'madin' ? String(madinStats.izin ?? 0) : absensiSubTab === 'ngaji' ? String(ngajiStats.izin ?? 0) : String(sholatStats.izin ?? 0)} Hari
                    </p>
                  </div>
                  <div className="q-card bg-[#FFF8E1] rounded-[22px] p-4 sm:p-5 border-2 border-amber-300/40 shadow-md">
                    <span className="text-[11px] font-black text-amber-800 uppercase block">Sakit</span>
                    <p className="text-2xl sm:text-3xl font-black text-amber-700 mt-1">
                      {absensiSubTab === 'madin' ? String(madinStats.sakit ?? 0) : absensiSubTab === 'ngaji' ? String(ngajiStats.sakit ?? 0) : String(sholatStats.sakit ?? 0)} Hari
                    </p>
                  </div>
                  <div className="q-card bg-[#FEE2E2] rounded-[22px] p-4 sm:p-5 border-2 border-rose-300/40 shadow-md">
                    <span className="text-[11px] font-black text-rose-800 uppercase block">Alfa / Tanpa Keterangan</span>
                    <p className="text-2xl sm:text-3xl font-black text-rose-700 mt-1">
                      {absensiSubTab === 'madin' ? String(madinStats.alfa ?? 0) : absensiSubTab === 'ngaji' ? String(ngajiStats.alfa ?? 0) : '0'} Hari
                    </p>
                  </div>
                </div>

                {/* LOGS LIST */}
                <div className="q-card bg-white rounded-[28px] p-5 sm:p-7 space-y-4 shadow-xl shadow-black/5">
                  <h3 className="text-sm font-black text-[#2D3436] flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="flex items-center gap-2">
                      <CalendarCheck size={18} className="text-[#138F81]" />
                      Jurnal Kehadiran {absensiSubTab === 'madin' ? 'Madrasah Diniyah' : absensiSubTab === 'ngaji' ? 'Pengajian Kitab Kuning' : 'Sholat Berjamaah'}
                    </span>
                    <span className="text-xs font-bold text-[#138F81]">
                      Bulan {monthsList.find((m) => m.value === selectedMonth)?.label} {selectedYear}
                    </span>
                  </h3>

                  {/* MADIN LOGS */}
                  {absensiSubTab === 'madin' && (
                    madinGrouped.length === 0 ? (
                      <div className="py-12 text-center text-slate-400">
                        <CalendarCheck size={38} className="mx-auto mb-2 text-[#138F81]/40" />
                        <p className="text-sm font-black text-[#2D3436]">Belum ada catatan absensi madin pada bulan ini.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {madinGrouped.map((day, idx) => {
                          const records = (Array.isArray(day.records) ? day.records : []) as ApiRecord[];
                          return (
                            <div key={idx} className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200">
                              <div className="flex items-center justify-between mb-2.5">
                                <span className="text-xs font-black text-[#2D3436]">
                                  📅 {String(day.hari || '')}, {String(day.tanggal || '')}
                                </span>
                                <span className="text-[10px] font-extrabold text-[#138F81]">{records.length} Mata Pelajaran</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {records.map((rec, rIdx) => (
                                  <div key={rIdx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                                    <div>
                                      <p className="text-xs font-black text-[#2D3436]">{String(rec.mapel || 'Pelajaran')}</p>
                                      <p className="text-[10px] text-[#636E72] font-medium">Pengajar: {String(rec.diinput_oleh || 'Ustadz')}</p>
                                    </div>
                                    <span
                                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-md ${
                                        rec.status === 'Hadir'
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                          : rec.status === 'Izin'
                                          ? 'bg-sky-50 text-sky-700 border border-sky-300'
                                          : rec.status === 'Sakit'
                                          ? 'bg-amber-50 text-amber-800 border border-amber-300'
                                          : 'bg-rose-50 text-rose-700 border border-rose-300'
                                      }`}
                                    >
                                      {String(rec.status || 'Hadir')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* SHOLAT LOGS */}
                  {absensiSubTab === 'sholat' && (
                    sholatGrouped.length === 0 ? (
                      <div className="py-12 text-center text-slate-400">
                        <Home size={38} className="mx-auto mb-2 text-[#138F81]/40" />
                        <p className="text-sm font-black text-[#2D3436]">Belum ada catatan absensi sholat pada bulan ini.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sholatGrouped.map((day, idx) => {
                          const records = (Array.isArray(day.records) ? day.records : []) as ApiRecord[];
                          return (
                            <div key={idx} className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200">
                              <div className="flex items-center justify-between mb-2.5">
                                <span className="text-xs font-black text-[#2D3436]">
                                  🕌 {String(day.hari || '')}, {String(day.tanggal || '')}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                {records.map((rec, rIdx) => (
                                  <div key={rIdx} className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-2xs">
                                    <p className="text-[11px] font-black text-[#2D3436]">{String(rec.jenis_sholat || 'Sholat')}</p>
                                    <span className="inline-block mt-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-300">
                                      {String(rec.status || 'Masuk')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* NGAJI LOGS */}
                  {absensiSubTab === 'ngaji' && (
                    ngajiGrouped.length === 0 ? (
                      <div className="py-12 text-center text-slate-400">
                        <BookOpen size={38} className="mx-auto mb-2 text-[#138F81]/40" />
                        <p className="text-sm font-black text-[#2D3436]">Belum ada catatan absensi ngaji pada bulan ini.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {ngajiGrouped.map((day, idx) => {
                          const records = (Array.isArray(day.records) ? day.records : []) as ApiRecord[];
                          return (
                            <div key={idx} className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200">
                              <div className="flex items-center justify-between mb-2.5">
                                <span className="text-xs font-black text-[#2D3436]">
                                  📖 {String(day.hari || '')}, {String(day.tanggal || '')}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {records.map((rec, rIdx) => (
                                  <div key={rIdx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                                    <div>
                                      <p className="text-xs font-black text-[#2D3436]">{String(rec.kitab || rec.mapel || 'Ngaji Kitab')}</p>
                                      <p className="text-[10px] text-[#636E72] font-medium">Sesi: {String(rec.sesi || 'Kajian Sore')}</p>
                                    </div>
                                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-300">
                                      {String(rec.status || 'Masuk')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: DATA DIRI SANTRI (BIODATA & AKADEMIK) */}
            {/* ========================================================================= */}
            {activeTab === 'biodata' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                {/* 1. DATA PRIBADI SANTRI */}
                <div className="q-card bg-white rounded-[28px] p-6 sm:p-7 shadow-xl shadow-black/5 space-y-4">
                  <h3 className="text-sm font-black text-[#2D3436] flex items-center gap-2 pb-3 border-b border-slate-100">
                    <UserRound size={18} className="text-[#138F81]" />
                    Data Identitas Pribadi
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Nama Lengkap</span>
                      <p className="font-black text-[#2D3436] text-sm mt-0.5">{studentName}</p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Nomor Induk Santri (NIS)</span>
                      <p className="font-black text-[#2D3436] text-sm mt-0.5">{studentNis}</p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">NISN</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">{String(biodata?.nisn || '-')}</p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Jenis Kelamin</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">
                        {String(biodata?.jenis_kelamin || '').toUpperCase() === 'L' || String(biodata?.jenis_kelamin || '').toLowerCase().includes('laki')
                          ? '👨 Laki-laki (Putra)'
                          : '👩 Perempuan (Putri)'}
                      </p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Tempat, Tanggal Lahir</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">
                        {String(biodata?.tempat_lahir || '-')}, {String(biodata?.tanggal_lahir || '-')}
                      </p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Status Santri</span>
                      <span className="inline-block mt-0.5 px-2.5 py-0.5 text-[10px] font-black text-[#138F81] bg-[#E8F7F3] border border-[#138F81]/20 rounded-md">
                        🟢 {studentStatus}
                      </span>
                    </div>
                    <div className="sm:col-span-2 bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Alamat Lengkap</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">
                        {String(biodata?.alamat || biodata?.desa || biodata?.kecamatan || biodata?.kabupaten || 'Sampurnan Bungah Gresik')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. DATA AKADEMIK MADIN */}
                <div className="q-card bg-white rounded-[28px] p-6 sm:p-7 shadow-xl shadow-black/5 space-y-4">
                  <h3 className="text-sm font-black text-[#2D3436] flex items-center gap-2 pb-3 border-b border-slate-100">
                    <GraduationCap size={18} className="text-[#138F81]" />
                    Data Akademik Madrasah Diniyah
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Kelas Madin</span>
                      <p className="font-black text-[#2D3436] text-sm mt-0.5">{studentKelas}</p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Kelompok Belajar</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">
                        {String((biodata?.kelompok_belajar as Record<string, unknown> | undefined)?.nama ?? biodata?.kelompok ?? 'Reguler')}
                      </p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Tahun Masuk / Angkatan</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">{String(biodata?.tahun_masuk || biodata?.angkatan || '2025/2026')}</p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Asal Sekolah Formal</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">{String(biodata?.asal_sekolah || (biodata?.schoolOrigin as Record<string, unknown> | undefined)?.name || 'MTs Assa\'adah')}</p>
                    </div>
                  </div>
                </div>

                {/* 3. DATA PONDOK & ASRAMA */}
                <div className="q-card bg-white rounded-[28px] p-6 sm:p-7 shadow-xl shadow-black/5 space-y-4">
                  <h3 className="text-sm font-black text-[#2D3436] flex items-center gap-2 pb-3 border-b border-slate-100">
                    <Building2 size={18} className="text-[#138F81]" />
                    Data Komplek Pondok & Kamar
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Komplek / Asrama</span>
                      <p className="font-black text-[#2D3436] text-sm mt-0.5">{studentKomplek}</p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Nomor / Nama Kamar</span>
                      <p className="font-black text-[#2D3436] text-sm mt-0.5">{studentKamar}</p>
                    </div>
                    <div className="sm:col-span-2 bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Status Tempat Tinggal</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">
                        {studentKomplek !== '-' ? '🏡 Santri Mukim (Mondok)' : '🚶 Santri Kalong'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. DATA ORANG TUA & WALI */}
                <div className="q-card bg-white rounded-[28px] p-6 sm:p-7 shadow-xl shadow-black/5 space-y-4">
                  <h3 className="text-sm font-black text-[#2D3436] flex items-center gap-2 pb-3 border-b border-slate-100">
                    <HeartHandshake size={18} className="text-[#138F81]" />
                    Data Orang Tua / Wali
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Nama Ayah</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">{String(biodata?.nama_ayah || '-')}</p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Nama Ibu</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">{String(biodata?.nama_ibu || '-')}</p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Nama Wali Terdaftar</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">
                        {String(biodata?.nama_wali || (biodata?.wali as Record<string, unknown> | undefined)?.name || session?.name || '-')}
                      </p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">No. WhatsApp / HP Wali</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">
                        {String(biodata?.no_telepon_wali || biodata?.no_hp || (biodata?.wali as Record<string, unknown> | undefined)?.no_hp || '-')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: NILAI & HAFALAN SANTRI */}
            {/* ========================================================================= */}
            {activeTab === 'nilai' && (
              <div className="space-y-4 sm:space-y-6">
                <div className="q-card bg-white rounded-[28px] p-5 sm:p-7 space-y-4 shadow-xl shadow-black/5">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                    <button
                      type="button"
                      onClick={() => setNilaiSubTab('akademik')}
                      className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer ${
                        nilaiSubTab === 'akademik'
                          ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/25'
                          : 'bg-[#E1EFF7] text-[#138F81] hover:bg-[#d0e5f2]'
                      }`}
                    >
                      📊 Raport Nilai Akademik Madin ({raportList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setNilaiSubTab('hafalan')}
                      className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer ${
                        nilaiSubTab === 'hafalan'
                          ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/25'
                          : 'bg-[#E1EFF7] text-[#138F81] hover:bg-[#d0e5f2]'
                      }`}
                    >
                      📖 Catatan Setoran Hafalan Al-Qur'an ({hafalanList.length})
                    </button>
                  </div>

                  {nilaiSubTab === 'akademik' ? (
                    raportList.length === 0 ? (
                      <div className="py-14 text-center text-slate-400">
                        <Award size={42} className="mx-auto mb-2 text-[#138F81]/40" />
                        <p className="text-sm font-black text-[#2D3436]">Belum ada data nilai raport untuk semester ini.</p>
                        <p className="text-xs text-[#636E72] mt-0.5">Nilai akan otomatis muncul saat dewan guru madin selesai merekap nilai.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-[#E1EFF7] text-[#138F81] font-black uppercase text-[11px]">
                              <th className="py-3.5 pl-4 rounded-l-xl">Mata Pelajaran</th>
                              <th className="py-3.5 px-3 text-center">Tugas</th>
                              <th className="py-3.5 px-3 text-center">UTS</th>
                              <th className="py-3.5 px-3 text-center">UAS</th>
                              <th className="py-3.5 px-3 text-center">Nilai Akhir</th>
                              <th className="py-3.5 pr-4 text-center rounded-r-xl">Predikat</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {raportList.map((row, idx) => (
                              <tr key={idx} className="hover:bg-[#F8FBFC] transition-colors">
                                <td className="py-3.5 pl-4 font-black text-[#2D3436]">
                                  {String((row.mata_pelajaran as Record<string, unknown> | undefined)?.nama ?? row.mapel ?? 'Mata Pelajaran')}
                                </td>
                                <td className="py-3.5 px-3 text-center text-[#2D3436] font-bold">{String(row.nilai_tugas ?? '-')}</td>
                                <td className="py-3.5 px-3 text-center text-[#2D3436] font-bold">{String(row.nilai_uts ?? '-')}</td>
                                <td className="py-3.5 px-3 text-center text-[#2D3436] font-bold">{String(row.nilai_uas ?? '-')}</td>
                                <td className="py-3.5 px-3 text-center font-black text-[#138F81] text-sm">
                                  {String(row.nilai_akhir ?? row.nilai ?? '-')}
                                </td>
                                <td className="py-3.5 pr-4 text-center">
                                  <span className="inline-block px-2.5 py-0.5 text-[10px] font-black rounded-md bg-emerald-50 text-emerald-700 border border-emerald-300">
                                    {String(row.predikat ?? 'A')}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  ) : (
                    hafalanList.length === 0 ? (
                      <div className="py-14 text-center text-slate-400">
                        <BookOpen size={42} className="mx-auto mb-2 text-[#138F81]/40" />
                        <p className="text-sm font-black text-[#2D3436]">Belum ada riwayat setoran hafalan Al-Qur'an.</p>
                        <p className="text-xs text-[#636E72] mt-0.5">Catatan ziyadah dan muroja'ah akan tampil secara berurutan.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {hafalanList.map((haf, idx) => (
                          <div key={idx} className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-[#2D3436]">
                                  📖 {String(haf.surah ?? haf.surat ?? 'Surah')}
                                </span>
                                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-[#E1EFF7] text-[#138F81] border border-[#138F81]/20">
                                  Juz {String(haf.juz ?? '1')}
                                </span>
                              </div>
                              <p className="text-xs text-[#636E72] font-semibold mt-1">
                                Ayat {String(haf.ayat_awal ?? '1')} - {String(haf.ayat_akhir ?? 'Selesai')} • Tanggal: {String(haf.tanggal || '-')}
                              </p>
                              {Boolean(haf.catatan) && (
                                <p className="text-[11px] text-[#0D7A6F] italic mt-1 font-bold">
                                  💬 Catatan: "{String(haf.catatan)}"
                                </p>
                              )}
                            </div>
                            <div className="text-right whitespace-nowrap">
                              <span className="text-xs font-black px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-300 inline-block">
                                {String(haf.predikat || haf.nilai || 'Mumtaz')}
                              </span>
                              <p className="text-[10px] text-[#636E72] font-semibold mt-1">
                                Pembina: {String((haf.creator as Record<string, unknown> | undefined)?.name ?? haf.ustadz ?? 'Ustadz Pembina')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ========================================================================= */}
        {/* 6. AESTHETIC FOOTER (MATCHING ADMIN SYSTEM) */}
        {/* ========================================================================= */}
        <footer className="q-card rounded-2xl sm:rounded-[26px] bg-[#FFFDF7] p-5 shadow-xl shadow-black/5 text-[#636E72]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <p className="text-xs font-black text-[#2D3436] tracking-tight">
                Portal Informasi & Presensi Santri Terpadu
              </p>
              <p className="text-[11px] font-bold text-[#636E72]">
                Yayasan Pondok Pesantren Qomaruddin • Managed by <span className="font-extrabold text-[#138F81]">IT QOMARUDDIN ( ITQOM )</span>
              </p>
            </div>

            <div className="flex items-center gap-2.5 text-[11px] font-bold">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F7F3] text-[#138F81] border border-[#138F81]/20 font-black text-[10px]">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Monitoring
              </span>
              <span className="text-[11px] font-semibold text-[#636E72]">
                © 2026 PP. Qomaruddin
              </span>
            </div>
          </div>
        </footer>
      </div>

      {/* ========================================================================= */}
      {/* 7. CHANGE PASSWORD MODAL */}
      {/* ========================================================================= */}
      {isChangePasswordOpen && (
        <WaliChangePasswordModal
          identifier={studentNis !== '-' ? studentNis : studentName !== 'Santri' ? studentName : session?.email || session?.name || 'siswa'}
          onClose={() => setIsChangePasswordOpen(false)}
          onSuccess={() => {
            if (session?.id) sessionStorage.setItem(`dismissed_wali_pwd_warning_${session.id}`, 'true');
            setSecurityWarningDismissed(true);
          }}
        />
      )}
    </div>
  );
}

function WaliChangePasswordModal({
  identifier,
  onClose,
  onSuccess,
}: {
  identifier: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('siswa12345');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError('Kata sandi baru minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await api.changePassword({
        identifier,
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });
      setSuccess('Kata sandi berhasil diperbarui!');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengganti kata sandi. Cek kembali password lama/default Anda.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="q-card bg-white rounded-[28px] p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#E1EFF7] text-[#138F81]">
              <KeyRound size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#2D3436]">Ganti Kata Sandi Akun</h3>
              <p className="text-[11px] text-[#636E72] font-bold truncate max-w-[220px]">Login: {identifier}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <XCircle size={18} />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
            ✓ {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="font-bold text-[#2D3436] block mb-1">
              Kata Sandi Saat Ini / Default
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="siswa12345"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#f8fafc] font-mono text-xs focus:ring-2 focus:ring-[#138F81]/30 outline-hidden"
            />
            <span className="text-[10px] text-[#636E72] font-semibold mt-1 block">
              Default awal akun wali santri adalah: <code className="font-bold text-[#138F81]">siswa12345</code>
            </span>
          </div>

          <div>
            <label className="font-bold text-[#2D3436] block mb-1">
              Kata Sandi Baru
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-mono text-xs focus:ring-2 focus:ring-[#138F81]/30 outline-hidden"
            />
          </div>

          <div>
            <label className="font-bold text-[#2D3436] block mb-1">
              Konfirmasi Kata Sandi Baru
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi kata sandi baru"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-mono text-xs focus:ring-2 focus:ring-[#138F81]/30 outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-black rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white disabled:opacity-50 transition cursor-pointer shadow-md shadow-[#138F81]/25"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Kata Sandi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
