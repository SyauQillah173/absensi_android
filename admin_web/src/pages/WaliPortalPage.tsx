import {
  Award,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  DoorOpen,
  FileText,
  GraduationCap,
  HeartHandshake,
  HelpCircle,
  Home,
  KeyRound,
  LogOut,
  MapPin,
  MessageCircle,
  Phone,
  Receipt,
  RefreshCw,
  School,
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
  const [activeTab, setActiveTab] = useState<WaliTabKey>('biodata');
  const [absensiSubTab, setAbsensiSubTab] = useState<AbsensiSubTab>('madin');
  const [keuanganSubTab, setKeuanganSubTab] = useState<KeuanganSubTab>('tagihan');
  const [nilaiSubTab, setNilaiSubTab] = useState<NilaiSubTab>('akademik');

  // Change password and security warning states
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [securityWarningDismissed, setSecurityWarningDismissed] = useState(() => {
    return session?.id ? sessionStorage.getItem(`dismissed_wali_pwd_warning_${session.id}`) === 'true' : false;
  });

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
    setIsLoading(true);

    async function loadAllChildData() {
      try {
        const [bioRes, keuRes, absMadinRes, absSholatRes, absNgajiRes, nilRes] = await Promise.allSettled([
          api.waliBiodata(selectedChildId!),
          api.waliPembayaran(selectedChildId!),
          api.waliAbsensi(selectedChildId!, { bulan: selectedMonth, tahun: selectedYear }),
          api.waliAbsensiSholat(selectedChildId!, { bulan: selectedMonth, tahun: selectedYear }),
          api.waliAbsensiNgaji(selectedChildId!, { bulan: selectedMonth, tahun: selectedYear }),
          api.waliNilai(selectedChildId!),
        ]);

        if (!isMounted) return;

        if (bioRes.status === 'fulfilled' && bioRes.value?.data) {
          setBiodata(bioRes.value.data as ApiRecord);
          setChildData(bioRes.value.data as ApiRecord);
        }
        if (keuRes.status === 'fulfilled' && keuRes.value) {
          setKeuanganData(keuRes.value as ApiRecord);
        }
        if (absMadinRes.status === 'fulfilled' && absMadinRes.value) {
          setAbsensiMadinData(absMadinRes.value as ApiRecord);
        }
        if (absSholatRes.status === 'fulfilled' && absSholatRes.value) {
          setAbsensiSholatData(absSholatRes.value as ApiRecord);
        }
        if (absNgajiRes.status === 'fulfilled' && absNgajiRes.value) {
          setAbsensiNgajiData(absNgajiRes.value as ApiRecord);
        }
        if (nilRes.status === 'fulfilled' && nilRes.value) {
          setNilaiData(nilRes.value as ApiRecord);
        }
      } catch (err) {
        console.error('Error fetching child portal data', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadAllChildData();

    return () => {
      isMounted = false;
    };
  }, [selectedChildId, selectedMonth, selectedYear]);

  // Refresh attendance when month/year changes
  const handleReloadAttendance = async () => {
    if (!selectedChildId) return;
    setIsLoading(true);
    try {
      const [absMadinRes, absSholatRes, absNgajiRes] = await Promise.allSettled([
        api.waliAbsensi(selectedChildId, { bulan: selectedMonth, tahun: selectedYear }),
        api.waliAbsensiSholat(selectedChildId, { bulan: selectedMonth, tahun: selectedYear }),
        api.waliAbsensiNgaji(selectedChildId, { bulan: selectedMonth, tahun: selectedYear }),
      ]);
      if (absMadinRes.status === 'fulfilled' && absMadinRes.value) setAbsensiMadinData(absMadinRes.value as ApiRecord);
      if (absSholatRes.status === 'fulfilled' && absSholatRes.value) setAbsensiSholatData(absSholatRes.value as ApiRecord);
      if (absNgajiRes.status === 'fulfilled' && absNgajiRes.value) setAbsensiNgajiData(absNgajiRes.value as ApiRecord);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedChild = useMemo(() => {
    return childrenList.find((c) => Number(c.id) === selectedChildId) || biodata || childrenList[0] || null;
  }, [childrenList, selectedChildId, biodata]);

  const studentName = String(biodata?.nama ?? selectedChild?.nama ?? 'Santri');
  const studentNis = String(biodata?.nis ?? selectedChild?.nis ?? '-');
  const studentKelas = String(biodata?.kelas ?? selectedChild?.kelas ?? 'Belum Ditentukan');
  const studentKomplek = String(biodata?.komplek ?? selectedChild?.komplek ?? '-');
  const studentKamar = String(biodata?.kamar ?? selectedChild?.kamar ?? '-');

  // Keuangan calculations
  const totalLunas = Number(keuanganData?.total_lunas ?? 0);
  const totalBelumLunas = Number(keuanganData?.total_belum_lunas ?? 0);
  const tagihanList = (Array.isArray(keuanganData?.tagihan) ? keuanganData.tagihan : []) as ApiRecord[];
  const historyList = (Array.isArray(keuanganData?.data) ? keuanganData.data : []) as ApiRecord[];

  // Absensi calculations
  const madinStats = (absensiMadinData?.stats && typeof absensiMadinData.stats === 'object' ? absensiMadinData.stats : {}) as ApiRecord;
  const madinGrouped = (Array.isArray(absensiMadinData?.data) ? absensiMadinData.data : []) as ApiRecord[];

  const sholatStats = (absensiSholatData?.stats && typeof absensiSholatData.stats === 'object' ? absensiSholatData.stats : {}) as ApiRecord;
  const sholatGrouped = (Array.isArray(absensiSholatData?.data) ? absensiSholatData.data : []) as ApiRecord[];

  const ngajiStats = (absensiNgajiData?.stats && typeof absensiNgajiData.stats === 'object' ? absensiNgajiData.stats : {}) as ApiRecord;
  const ngajiGrouped = (Array.isArray(absensiNgajiData?.data) ? absensiNgajiData.data : []) as ApiRecord[];

  // Nilai calculations
  const raportList = (Array.isArray(nilaiData?.data) ? nilaiData.data : []) as ApiRecord[];
  const hafalanList = (Array.isArray(nilaiData?.hafalan) ? nilaiData.hafalan : []) as ApiRecord[];

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

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#2D3436] font-sans pb-16">
      {/* TOP NAVBAR */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* BRAND */}
            <div className="flex items-center gap-3">
              <img
                src="/logo-qomaruddin.png"
                alt="Logo Qomaruddin"
                className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black text-slate-800 tracking-tight leading-none">
                    Portal Wali Santri
                  </h1>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#138F81] animate-pulse" />
                    Monitoring Realtime
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-0.5">
                  Yayasan Pondok Pesantren Qomaruddin
                </p>
              </div>
            </div>

            {/* USER & LOGOUT */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden md:block text-right">
                <p className="text-xs font-bold text-slate-700">{session?.name || 'Wali Santri'}</p>
                <p className="text-[10px] text-teal-700 font-semibold">Akses Wali (Read-Only)</p>
              </div>
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-extrabold text-[#138F81] bg-[#138F81]/10 border border-[#138F81]/20 rounded-xl hover:bg-[#138F81]/20 transition-colors shadow-2xs"
                title="Ganti Kata Sandi Akun"
              >
                <KeyRound size={14} />
                <span className="hidden sm:inline">Ganti Sandi</span>
              </button>
              <button
                type="button"
                onClick={() => logout()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-extrabold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition-colors shadow-2xs"
                title="Keluar dari Portal"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* HERO SECTION / SANTRI SELECTOR */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-5 sm:mt-6 space-y-6">
        {/* NON-MANDATORY SECURITY WARNING BANNER */}
        {session?.must_change_password && !securityWarningDismissed && (
          <div className="rounded-3xl bg-amber-50/95 border border-amber-200 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-800 shrink-0">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h4 className="text-sm font-black text-amber-950 flex items-center gap-2">
                  Rekomendasi Keamanan Akun
                  <span className="text-[10px] bg-amber-200 text-amber-900 font-extrabold px-2 py-0.5 rounded-full">
                    Sandi Bawaan
                  </span>
                </h4>
                <p className="text-xs text-amber-800 font-medium mt-0.5 leading-relaxed">
                  Akun Anda saat ini masih menggunakan kata sandi default (<code className="bg-amber-100/80 px-1.5 py-0.5 rounded font-mono font-bold text-amber-900">siswa12345</code>). Demi privasi dan keamanan data santri, kami sarankan untuk membuat kata sandi baru.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(true)}
                className="px-3.5 py-2 text-xs font-black rounded-xl bg-amber-800 text-white hover:bg-amber-900 transition-all shadow-xs"
              >
                🔒 Ganti Sandi Sekarang
              </button>
              <button
                type="button"
                onClick={() => {
                  if (session?.id) sessionStorage.setItem(`dismissed_wali_pwd_warning_${session.id}`, 'true');
                  setSecurityWarningDismissed(true);
                }}
                className="px-3 py-2 text-xs font-bold rounded-xl text-amber-800 bg-amber-100 hover:bg-amber-200 transition-all"
              >
                Nanti Saja
              </button>
            </div>
          </div>
        )}

        {/* MULTI CHILD SWITCHER (IF > 1) */}
        {childrenList.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-slate-500 pl-1">Pilih Data Santri:</span>
            {childrenList.map((child) => (
              <button
                key={String(child.id)}
                type="button"
                onClick={() => setSelectedChildId(Number(child.id))}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  Number(child.id) === selectedChildId
                    ? 'bg-[#138F81] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                👨‍🎓 {String(child.nama || 'Santri')} ({String(child.nis || '-')})
              </button>
            ))}
          </div>
        )}

        {/* HERO PROFILE CARD */}
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#138F81] via-[#0E7A6E] to-[#0A5C53] text-white p-5 sm:p-7 shadow-xl shadow-[#138F81]/15">
          {/* Background Decorative Pattern */}
          <div className="absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-white/5 blur-2xl pointer-events-none" />
          <div className="absolute right-1/3 -top-10 h-40 w-40 rounded-full bg-white/10 blur-xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4 sm:gap-5">
              {/* AVATAR */}
              <div className="relative shrink-0">
                <div className="grid h-16 w-16 sm:h-20 sm:w-20 place-items-center rounded-2xl bg-white/15 border-2 border-white/30 backdrop-blur-md text-2xl sm:text-3xl font-black text-white shadow-inner">
                  {studentName.charAt(0).toUpperCase()}
                </div>
                <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-400 border-2 border-[#138F81] shadow-xs" title="Santri Aktif" />
              </div>

              {/* NAME & META */}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                    {studentName}
                  </h2>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-white/20 text-white border border-white/30">
                    {String(biodata?.status ?? selectedChild?.status ?? 'Aktif')}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs sm:text-sm text-teal-50 font-medium">
                  <span className="flex items-center gap-1.5">
                    <UserRound size={15} className="text-teal-200" />
                    NIS: <strong className="text-white font-bold">{studentNis}</strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <GraduationCap size={16} className="text-teal-200" />
                    Kelas: <strong className="text-white font-bold">{studentKelas}</strong>
                  </span>
                  {(studentKomplek !== '-' || studentKamar !== '-') && (
                    <span className="flex items-center gap-1.5">
                      <Home size={15} className="text-teal-200" />
                      Asrama: <strong className="text-white font-bold">{studentKomplek} {studentKamar !== '-' ? `• Kamar ${studentKamar}` : ''}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* QUICK STATS PILLS */}
            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto bg-black/15 p-2.5 rounded-2xl border border-white/15 backdrop-blur-sm">
              <div className="px-3 py-1 text-center">
                <span className="block text-[10px] uppercase font-bold text-teal-100">Status Keuangan</span>
                <span className={`text-xs font-black px-2 py-0.5 rounded-lg inline-block mt-0.5 ${
                  totalBelumLunas > 0 ? 'bg-amber-400 text-amber-950' : 'bg-emerald-400 text-emerald-950'
                }`}>
                  {totalBelumLunas > 0 ? `Ada Tagihan (Rp ${totalBelumLunas.toLocaleString('id-ID')})` : 'Semua Lunas'}
                </span>
              </div>
              <div className="h-8 w-px bg-white/20" />
              <div className="px-3 py-1 text-center">
                <span className="block text-[10px] uppercase font-bold text-teal-100">Kehadiran Madin</span>
                <span className="text-sm font-black text-white block mt-0.5">
                  {Number(madinStats.total ?? 0) > 0
                    ? `${Math.round((Number(madinStats.hadir ?? 0) / Number(madinStats.total ?? 1)) * 100)}%`
                    : '100%'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* NAVIGATION TABS */}
        <nav className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-2 scrollbar-none">
          {[
            { key: 'biodata', label: 'Data Diri Santri', icon: User, badge: null },
            {
              key: 'keuangan',
              label: 'Keuangan & Tagihan',
              icon: Wallet,
              badge: totalBelumLunas > 0 ? 'Ada Tagihan' : null,
              badgeColor: 'bg-rose-100 text-rose-800'
            },
            { key: 'absensi', label: 'Absensi Realtime', icon: CalendarCheck, badge: null },
            { key: 'nilai', label: 'Nilai & Hafalan', icon: Award, badge: null },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as WaliTabKey)}
                className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-black rounded-2xl transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/20'
                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <Icon size={17} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                    isActive ? 'bg-white text-rose-700' : tab.badgeColor
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* TAB CONTENTS */}
        {isLoading ? (
          <div className="py-16 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#138F81]/20 border-t-[#138F81] mx-auto mb-3" />
            <p className="text-xs font-bold text-slate-500 animate-pulse">Memuat data santri secara realtime...</p>
          </div>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* TAB 1: BIODATA & DATA DIRI LENGKAP SANTRI */}
            {/* ========================================================================= */}
            {activeTab === 'biodata' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. DATA PRIBADI SANTRI */}
                <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100">
                    <UserRound size={18} className="text-[#138F81]" />
                    Data Identitas Pribadi
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold block">Nama Lengkap</span>
                      <p className="font-extrabold text-slate-800 text-sm mt-0.5">{studentName}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">Nomor Induk Santri (NIS)</span>
                      <p className="font-extrabold text-slate-800 text-sm mt-0.5">{studentNis}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">NISN</span>
                      <p className="font-extrabold text-slate-800 mt-0.5">{String(biodata?.nisn || '-')}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">Jenis Kelamin</span>
                      <p className="font-extrabold text-slate-800 mt-0.5">
                        {String(biodata?.jenis_kelamin || '').toUpperCase() === 'L' || String(biodata?.jenis_kelamin || '').toLowerCase().includes('laki')
                          ? '👨 Laki-laki (Putra)'
                          : '👩 Perempuan (Putri)'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">Tempat, Tanggal Lahir</span>
                      <p className="font-extrabold text-slate-800 mt-0.5">
                        {String(biodata?.tempat_lahir || '-')}, {String(biodata?.tanggal_lahir || '-')}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">Status Santri</span>
                      <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md">
                        🟢 {String(biodata?.status || 'Aktif')}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-400 font-semibold block">Alamat Asal</span>
                      <p className="font-extrabold text-slate-800 mt-0.5">
                        {String(biodata?.alamat || biodata?.desa || biodata?.kecamatan || biodata?.kabupaten || '-')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. DATA AKADEMIK MADIN */}
                <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100">
                    <GraduationCap size={18} className="text-[#138F81]" />
                    Data Akademik Madrasah Diniyah
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold block">Kelas Madin</span>
                      <p className="font-extrabold text-slate-800 text-sm mt-0.5">{studentKelas}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">Kelompok Belajar</span>
                      <p className="font-extrabold text-slate-800 mt-0.5">
                        {String((biodata?.kelompok_belajar as Record<string, unknown> | undefined)?.nama ?? biodata?.kelompok ?? '-')}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">Tahun Masuk / Angkatan</span>
                      <p className="font-extrabold text-slate-800 mt-0.5">{String(biodata?.tahun_masuk || biodata?.angkatan || '-')}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">Asal Sekolah Formal</span>
                      <p className="font-extrabold text-slate-800 mt-0.5">{String(biodata?.asal_sekolah || '-')}</p>
                    </div>
                  </div>
                </div>

                {/* 3. DATA PONDOK & ASRAMA */}
                <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100">
                    <Building2 size={18} className="text-[#138F81]" />
                    Data Komplek Pondok & Kamar
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold block">Komplek / Asrama</span>
                      <p className="font-extrabold text-slate-800 text-sm mt-0.5">{studentKomplek}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">Nomor / Nama Kamar</span>
                      <p className="font-extrabold text-slate-800 text-sm mt-0.5">{studentKamar}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">Status Tempat Tinggal</span>
                      <p className="font-extrabold text-slate-800 mt-0.5">
                        {studentKomplek !== '-' ? '🏡 Santri Mukim (Mondok)' : '🚶 Santri Kalong (Pulang-Pergi)'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. DATA ORANG TUA & WALI */}
                <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100">
                    <HeartHandshake size={18} className="text-[#138F81]" />
                    Data Orang Tua / Wali
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold block">Nama Ayah</span>
                      <p className="font-extrabold text-slate-800 mt-0.5">{String(biodata?.nama_ayah || '-')}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">Nama Ibu</span>
                      <p className="font-extrabold text-slate-800 mt-0.5">{String(biodata?.nama_ibu || '-')}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">Nama Wali Terdaftar</span>
                      <p className="font-extrabold text-slate-800 mt-0.5">{String(biodata?.nama_wali || (biodata?.wali as Record<string, unknown> | undefined)?.name || '-')}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">No. WhatsApp / HP Wali</span>
                      <p className="font-extrabold text-slate-800 mt-0.5">{String(biodata?.no_telepon_wali || biodata?.no_hp || '-')}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: KEUANGAN & TAGIHAN SANTRI */}
            {/* ========================================================================= */}
            {activeTab === 'keuangan' && (
              <div className="space-y-5">
                {/* SUMMARY METRICS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">Total Tagihan Belum Lunas</span>
                      <div className="h-8 w-8 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 grid place-items-center">
                        <XCircle size={16} />
                      </div>
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-rose-700 mt-2">
                      Rp {totalBelumLunas.toLocaleString('id-ID')}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-400 mt-1">
                      {tagihanList.filter((t) => t.status_tagihan !== 'Lunas').length} item tagihan menunggu pembayaran
                    </p>
                  </div>

                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">Total Pembayaran Lunas</span>
                      <div className="h-8 w-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 grid place-items-center">
                        <CheckCircle2 size={16} />
                      </div>
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-emerald-700 mt-2">
                      Rp {totalLunas.toLocaleString('id-ID')}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-400 mt-1">
                      {historyList.length} transaksi pembayaran tercatat
                    </p>
                  </div>

                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">Status Pembayaran</span>
                      <div className="h-8 w-8 rounded-xl bg-teal-50 border border-teal-200 text-teal-600 grid place-items-center">
                        <ShieldCheck size={16} />
                      </div>
                    </div>
                    <p className="text-lg font-black text-slate-800 mt-2">
                      {totalBelumLunas === 0 ? '🟢 Bersih & Lunas' : '⚠️ Ada Tunggakan'}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-400 mt-1">
                      Data keuangan tersinkronisasi realtime
                    </p>
                  </div>
                </div>

                {/* SUB-TABS: TAGIHAN VS RIWAYAT */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
                    <button
                      type="button"
                      onClick={() => setKeuanganSubTab('tagihan')}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                        keuanganSubTab === 'tagihan'
                          ? 'bg-[#138F81] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      📋 Daftar Tagihan Syahriah & SPP ({tagihanList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setKeuanganSubTab('riwayat')}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                        keuanganSubTab === 'riwayat'
                          ? 'bg-[#138F81] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      🧾 Riwayat Transaksi & Kwitansi ({historyList.length})
                    </button>
                  </div>

                  {keuanganSubTab === 'tagihan' ? (
                    tagihanList.length === 0 ? (
                      <div className="py-12 text-center text-slate-400">
                        <CheckCircle2 size={36} className="mx-auto mb-2 text-emerald-500" />
                        <p className="text-sm font-bold text-slate-700">Tidak ada tagihan tertunggak.</p>
                        <p className="text-xs text-slate-400">Semua kewajiban pembayaran santri sudah lunas.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase">
                              <th className="pb-3">Pos Pembayaran</th>
                              <th className="pb-3">Bulan / Periode</th>
                              <th className="pb-3">Jatuh Tempo</th>
                              <th className="pb-3 text-right">Nominal</th>
                              <th className="pb-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {tagihanList.map((bill, idx) => {
                              const isLunas = bill.status_tagihan === 'Lunas' || bill.status === 'Lunas';
                              return (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="py-3 font-extrabold text-slate-800">
                                    {String((bill.payment_type as Record<string, unknown> | undefined)?.nama ?? bill.nama_pos ?? bill.pos_pembayaran ?? 'Syahriah / SPP')}
                                  </td>
                                  <td className="py-3 text-slate-600 font-semibold">
                                    {String(bill.month_name ?? bill.bulan ?? bill.periode ?? '-')} {String(bill.tahun ?? '')}
                                  </td>
                                  <td className="py-3 text-slate-500">
                                    {String(bill.due_date || '-')}
                                  </td>
                                  <td className="py-3 text-right font-black text-slate-800">
                                    Rp {Number(bill.amount ?? bill.nominal ?? 0).toLocaleString('id-ID')}
                                  </td>
                                  <td className="py-3 text-center">
                                    <span
                                      className={`inline-block px-2.5 py-1 text-[10px] font-black rounded-lg ${
                                        isLunas
                                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                                      }`}
                                    >
                                      {isLunas ? '🟢 LUNAS' : '🔴 BELUM LUNAS'}
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
                    historyList.length === 0 ? (
                      <div className="py-12 text-center text-slate-400">
                        <FileText size={36} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm font-bold text-slate-700">Belum ada riwayat pembayaran.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase">
                              <th className="pb-3">No. Kwitansi / Transaksi</th>
                              <th className="pb-3">Tanggal Bayar</th>
                              <th className="pb-3">Metode</th>
                              <th className="pb-3">Penerima</th>
                              <th className="pb-3 text-right">Jumlah Bayar</th>
                              <th className="pb-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {historyList.map((tr, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-3 font-extrabold text-slate-800">
                                  {String(tr.receipt_number || tr.nomor_transaksi || tr.id || '-')}
                                </td>
                                <td className="py-3 text-slate-600 font-semibold">
                                  {String(tr.tanggal || tr.created_at || '-')}
                                </td>
                                <td className="py-3 text-slate-600">
                                  {String(tr.payment_method || tr.via || 'Tunai')}
                                </td>
                                <td className="py-3 text-slate-500">
                                  {String(tr.admin_name || tr.diinput_oleh || 'Bendahara')}
                                </td>
                                <td className="py-3 text-right font-black text-emerald-700">
                                  Rp {Number(tr.jumlah ?? tr.total_amount ?? 0).toLocaleString('id-ID')}
                                </td>
                                <td className="py-3 text-center">
                                  <span className="inline-block px-2.5 py-1 text-[10px] font-black rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
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
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: ABSENSI REALTIME SANTRI */}
            {/* ========================================================================= */}
            {activeTab === 'absensi' && (
              <div className="space-y-5">
                {/* MONTH & YEAR FILTER HEADER */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                      <Calendar size={15} className="text-[#138F81]" />
                      Periode:
                    </span>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="px-3 py-1.5 text-xs font-extrabold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-[#138F81]/20 outline-none"
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
                      className="px-3 py-1.5 text-xs font-extrabold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-[#138F81]/20 outline-none"
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
                      className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                      title="Perbarui Data Absensi"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>

                  {/* 3 SUB-TABS: MADIN, NGAJI, SHOLAT */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
                    {[
                      { id: 'madin', label: 'Madin Diniyah' },
                      { id: 'ngaji', label: 'Ngaji Kitab' },
                      { id: 'sholat', label: 'Jamaah Sholat' },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setAbsensiSubTab(st.id as AbsensiSubTab)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                          absensiSubTab === st.id
                            ? 'bg-[#138F81] text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* STATS COUNTERS */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase block">Total Kehadiran</span>
                    <p className="text-xl font-black text-emerald-700 mt-1">
                      {absensiSubTab === 'madin' ? String(madinStats.hadir ?? 0) : absensiSubTab === 'ngaji' ? String(ngajiStats.hadir ?? 0) : String(sholatStats.masuk ?? 0)} Hari
                    </p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase block">Izin</span>
                    <p className="text-xl font-black text-sky-700 mt-1">
                      {absensiSubTab === 'madin' ? String(madinStats.izin ?? 0) : absensiSubTab === 'ngaji' ? String(ngajiStats.izin ?? 0) : String(sholatStats.izin ?? 0)} Hari
                    </p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase block">Sakit</span>
                    <p className="text-xl font-black text-amber-700 mt-1">
                      {absensiSubTab === 'madin' ? String(madinStats.sakit ?? 0) : absensiSubTab === 'ngaji' ? String(ngajiStats.sakit ?? 0) : String(sholatStats.sakit ?? 0)} Hari
                    </p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase block">Alfa / Tanpa Ket.</span>
                    <p className="text-xl font-black text-rose-700 mt-1">
                      {absensiSubTab === 'madin' ? String(madinStats.alfa ?? 0) : absensiSubTab === 'ngaji' ? String(ngajiStats.alfa ?? 0) : '0'} Hari
                    </p>
                  </div>
                </div>

                {/* LOGS ACCORDION / LIST */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
                  <h3 className="text-sm font-black text-slate-800 flex items-center justify-between pb-3 border-b border-slate-100">
                    <span>
                      Jurnal Kehadiran {absensiSubTab === 'madin' ? 'Madrasah Diniyah' : absensiSubTab === 'ngaji' ? 'Pengajian Kitab Kuning' : 'Sholat Berjamaah'}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      Bulan {monthsList.find((m) => m.value === selectedMonth)?.label} {selectedYear}
                    </span>
                  </h3>

                  {/* RENDER LIST BASED ON SUBTAB */}
                  {absensiSubTab === 'madin' && (
                    madinGrouped.length === 0 ? (
                      <div className="py-12 text-center text-slate-400">
                        <CalendarCheck size={36} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm font-bold text-slate-700">Belum ada catatan absensi madin pada bulan ini.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {madinGrouped.map((day, idx) => {
                          const records = (Array.isArray(day.records) ? day.records : []) as ApiRecord[];
                          return (
                            <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-extrabold text-slate-800">
                                  📅 {String(day.hari || '')}, {String(day.tanggal || '')}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">{records.length} Mata Pelajaran</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {records.map((rec, rIdx) => (
                                  <div key={rIdx} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200/70">
                                    <div>
                                      <p className="text-xs font-black text-slate-800">{String(rec.mapel || 'Pelajaran')}</p>
                                      <p className="text-[10px] text-slate-400 font-medium">Pengajar: {String(rec.diinput_oleh || 'Guru')}</p>
                                    </div>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                      rec.status === 'Hadir' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                                      rec.status === 'Izin' ? 'bg-sky-50 text-sky-800 border border-sky-200' :
                                      rec.status === 'Sakit' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                      'bg-rose-50 text-rose-800 border border-rose-200'
                                    }`}>
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

                  {absensiSubTab === 'ngaji' && (
                    ngajiGrouped.length === 0 ? (
                      <div className="py-12 text-center text-slate-400">
                        <BookOpen size={36} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm font-bold text-slate-700">Belum ada catatan absensi ngaji pada bulan ini.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {ngajiGrouped.map((day, idx) => {
                          const records = (Array.isArray(day.records) ? day.records : []) as ApiRecord[];
                          return (
                            <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-extrabold text-slate-800">
                                  📖 {String(day.hari || '')}, {String(day.tanggal || '')}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {records.map((rec, rIdx) => (
                                  <div key={rIdx} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200/70">
                                    <div>
                                      <p className="text-xs font-black text-slate-800">{String(rec.kitab || rec.mapel || 'Ngaji Kitab')}</p>
                                      <p className="text-[10px] text-slate-400 font-medium">Sesi: {String(rec.sesi || 'Pondok')}</p>
                                    </div>
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
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

                  {absensiSubTab === 'sholat' && (
                    sholatGrouped.length === 0 ? (
                      <div className="py-12 text-center text-slate-400">
                        <Home size={36} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm font-bold text-slate-700">Belum ada catatan absensi sholat pada bulan ini.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sholatGrouped.map((day, idx) => {
                          const records = (Array.isArray(day.records) ? day.records : []) as ApiRecord[];
                          return (
                            <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-extrabold text-slate-800">
                                  🕌 {String(day.hari || '')}, {String(day.tanggal || '')}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                {records.map((rec, rIdx) => (
                                  <div key={rIdx} className="bg-white p-2 rounded-xl border border-slate-200/70 text-center">
                                    <p className="text-[11px] font-extrabold text-slate-700">{String(rec.jenis_sholat || 'Sholat')}</p>
                                    <span className="inline-block mt-1 text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800">
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
            {/* TAB 4: NILAI & HAFALAN SANTRI */}
            {/* ========================================================================= */}
            {activeTab === 'nilai' && (
              <div className="space-y-5">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
                    <button
                      type="button"
                      onClick={() => setNilaiSubTab('akademik')}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                        nilaiSubTab === 'akademik'
                          ? 'bg-[#138F81] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      📊 Raport Nilai Akademik Madin ({raportList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setNilaiSubTab('hafalan')}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                        nilaiSubTab === 'hafalan'
                          ? 'bg-[#138F81] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      📖 Catatan Setoran Hafalan Al-Qur'an ({hafalanList.length})
                    </button>
                  </div>

                  {nilaiSubTab === 'akademik' ? (
                    raportList.length === 0 ? (
                      <div className="py-12 text-center text-slate-400">
                        <Award size={36} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm font-bold text-slate-700">Belum ada data nilai raport untuk semester aktif.</p>
                        <p className="text-xs text-slate-400">Nilai akan muncul setelah diinput oleh dewan guru madin.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase">
                              <th className="pb-3">Mata Pelajaran</th>
                              <th className="pb-3 text-center">Tugas</th>
                              <th className="pb-3 text-center">UTS</th>
                              <th className="pb-3 text-center">UAS</th>
                              <th className="pb-3 text-center">Nilai Akhir</th>
                              <th className="pb-3 text-center">Predikat</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {raportList.map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-3 font-extrabold text-slate-800">
                                  {String((row.mata_pelajaran as Record<string, unknown> | undefined)?.nama ?? row.mapel ?? 'Mata Pelajaran')}
                                </td>
                                <td className="py-3 text-center text-slate-600 font-semibold">{String(row.nilai_tugas ?? '-')}</td>
                                <td className="py-3 text-center text-slate-600 font-semibold">{String(row.nilai_uts ?? '-')}</td>
                                <td className="py-3 text-center text-slate-600 font-semibold">{String(row.nilai_uas ?? '-')}</td>
                                <td className="py-3 text-center font-black text-teal-800 text-sm">
                                  {String(row.nilai_akhir ?? row.nilai ?? '-')}
                                </td>
                                <td className="py-3 text-center">
                                  <span className="inline-block px-2 py-0.5 text-[10px] font-black rounded-md bg-teal-50 text-teal-800 border border-teal-200">
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
                      <div className="py-12 text-center text-slate-400">
                        <BookOpen size={36} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm font-bold text-slate-700">Belum ada riwayat setoran hafalan Al-Qur'an.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {hafalanList.map((haf, idx) => (
                          <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-extrabold text-slate-800">
                                  📖 {String(haf.surah ?? haf.surat ?? 'Surah')}
                                </span>
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                                  Juz {String(haf.juz ?? '1')}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 font-medium mt-1">
                                Ayat {String(haf.ayat_awal ?? '1')} - {String(haf.ayat_akhir ?? 'Selesai')} • Tanggal: {String(haf.tanggal || '-')}
                              </p>
                              {Boolean(haf.catatan) && (
                                <p className="text-[11px] text-teal-700 italic mt-1 font-semibold">
                                  💬 Catatan Ustadz: "{String(haf.catatan)}"
                                </p>
                              )}
                            </div>
                            <div className="text-right whitespace-nowrap">
                              <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 inline-block">
                                {String(haf.predikat || haf.nilai || 'Mumtaz (Sangat Baik)')}
                              </span>
                              <p className="text-[10px] text-slate-400 font-semibold mt-1">
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

        {/* MODERN & PROFESSIONAL FOOTER */}
        <footer className="mt-12 pt-6 pb-2 border-t border-slate-200/80 text-slate-600">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-xl bg-[#138F81] text-white font-black text-xs grid place-items-center shadow-md shadow-[#138F81]/20">
                IQ
              </div>
              <div>
                <p className="text-xs font-black text-slate-800 tracking-tight">
                  Portal Informasi & Presensi Santri Terpadu
                </p>
                <p className="text-[11px] font-semibold text-slate-500">
                  Yayasan Pondok Pesantren Qomaruddin • Managed by <span className="font-extrabold text-[#138F81]">IT QOMARUDDIN ( ITQOM )</span>
                </p>
              </div>

            </div>

            <div className="flex items-center gap-2.5 text-[11px] font-bold">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-[#138F81] border border-teal-200/60 font-extrabold text-[10px]">
                <span className="h-2 w-2 rounded-full bg-[#138F81] animate-pulse" />
                Live Monitoring
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                © 2026 PP. Qomaruddin
              </span>
            </div>
          </div>
        </footer>
      </main>


      {/* CHANGE PASSWORD MODAL */}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-50 text-[#138F81]">
              <KeyRound size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">Ganti Kata Sandi</h3>
              <p className="text-[11px] text-slate-400 font-semibold truncate max-w-[220px]">Login: {identifier}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
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
            <label className="font-bold text-slate-600 block mb-1">
              Kata Sandi Saat Ini / Default
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="siswa12345"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs focus:ring-2 focus:ring-[#138F81]/20 outline-none"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Default awal akun wali santri adalah: <code className="font-bold text-slate-600">siswa12345</code>
            </span>
          </div>

          <div>
            <label className="font-bold text-slate-600 block mb-1">
              Kata Sandi Baru
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-mono text-xs focus:ring-2 focus:ring-[#138F81]/20 outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-slate-600 block mb-1">
              Konfirmasi Kata Sandi Baru
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi kata sandi baru"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-mono text-xs focus:ring-2 focus:ring-[#138F81]/20 outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-extrabold rounded-xl bg-[#138F81] text-white hover:bg-[#0f766a] disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Kata Sandi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
