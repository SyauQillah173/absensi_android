import {
  AlertTriangle,
  Award,
  BedDouble,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  Gavel,
  History,
  Home,
  PlusCircle,
  Printer,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserCheck,
  Users,
  Wallet,
  Zap
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type ApiRecord, type UserSession } from '../services/api';
import { StatusBadge } from './StatusBadge';

interface KeamananDashboardViewProps {
  session: UserSession | null;
  onNavigateToPelanggaran?: () => void;
  onNavigateToKamar?: () => void;
  onRefresh?: () => void;
}

interface PelanggaranSummaryItem extends ApiRecord {
  id: number;
  siswa_id: number;
  tanggal: string;
  waktu: string | null;
  judul_pelanggaran: string;
  tingkat: 'Ringan' | 'Sedang' | 'Berat';
  poin: number;
  denda: number;
  status_denda: 'tidak_ada' | 'belum_dibayar' | 'lunas';
  siswa?: {
    id: number;
    nama: string;
    nis: string;
    kelas?: string;
    komplek?: string;
    kamar?: string;
    status?: string;
  };
}

interface SantriKritisItem {
  siswa_id: number;
  nama: string;
  nis: string;
  kelas: string;
  asrama: string;
  total_poin: number;
  total_kasus: number;
  is_over_threshold: boolean;
}

export function KeamananDashboardView({
  session,
  onNavigateToPelanggaran,
  onNavigateToKamar,
  onRefresh
}: KeamananDashboardViewProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ApiRecord | null>(null);
  const [recentList, setRecentList] = useState<PelanggaranSummaryItem[]>([]);
  const [students, setStudents] = useState<ApiRecord[]>([]);
  const [searchStudentQuery, setSearchStudentQuery] = useState('');
  const [threshold, setThreshold] = useState<number>(100);

  // Load Data
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [statsRes, recentRes, studentRes, settingRes] = await Promise.all([
        api.getPelanggaranStats().catch(() => ({ data: null })),
        api.getPelanggaran({ per_page: 8 }).catch(() => ({ data: [] })),
        api.siswa({ status: 'Aktif', per_page: 500 }).catch(() => ({ data: [] })),
        api.getPelanggaranSettings().catch(() => ({ data: null }))
      ]);

      if (statsRes && statsRes.data) {
        setStats(statsRes.data as ApiRecord);
      }
      if (recentRes && Array.isArray(recentRes.data)) {
        setRecentList(recentRes.data as unknown as PelanggaranSummaryItem[]);
      }
      if (studentRes && Array.isArray(studentRes.data)) {
        setStudents(studentRes.data as ApiRecord[]);
      }
      if (settingRes && settingRes.data) {
        setThreshold(Number((settingRes.data as any).warning_threshold_points || 100));
      }
    } catch (err) {
      console.error('Gagal memuat data dashboard keamanan:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => void loadData(true), 60_000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Santri Kritis
  const santriKritis = useMemo<SantriKritisItem[]>(() => {
    return Array.isArray(stats?.santri_kritis) ? (stats?.santri_kritis as SantriKritisItem[]) : [];
  }, [stats]);

  // Top Pelanggaran
  const topPelanggaran = useMemo(() => {
    return Array.isArray(stats?.top_pelanggaran) ? (stats?.top_pelanggaran as ApiRecord[]) : [];
  }, [stats]);

  // Filtered Students for Quick Lookup
  const searchedStudents = useMemo(() => {
    if (!searchStudentQuery.trim()) return [];
    const q = searchStudentQuery.toLowerCase().trim();
    return students
      .filter((s) => {
        const nama = String(s.nama || '').toLowerCase();
        const nis = String(s.nis || '').toLowerCase();
        const kamar = String(s.kamar || '').toLowerCase();
        return nama.includes(q) || nis.includes(q) || kamar.includes(q);
      })
      .slice(0, 5);
  }, [students, searchStudentQuery]);

  return (
    <div className="space-y-6">
      {/* 🌟 HERO COMMAND CENTER HEADER BIRO KEAMANAN (TACTICAL EMERALD) */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#04120E] via-[#08241C] to-[#0A3427] p-6 sm:p-8 text-white shadow-2xl shadow-emerald-950/40 border border-emerald-500/30">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 bottom-0 -mb-12 h-44 w-44 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-5">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-300 border border-emerald-400/40 backdrop-blur-md">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  BIRO KEAMANAN & KETERTIBAN SANTRI
                </span>
                <span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-black text-amber-300 border border-amber-400/30">
                  Pusat Komando Tatib
                </span>
              </div>
              <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-2.5">
                <span>Posko Pengawasan Kedisiplinan</span>
              </h1>
              <p className="mt-2 text-xs sm:text-sm font-medium text-emerald-100/80 leading-relaxed">
                Pusat pengawasan tata tertib harian santri, akumulasi poin pelanggaran otomatis, denda takzir edukatif,
                penerbitan surat panggilan wali resmi, serta ketertiban lingkungan asrama pondok.
              </p>
            </div>
          </div>

          {/* ACTION BUTTONS TOOLBAR */}
          <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2 sm:gap-2.5 pt-4 border-t border-emerald-500/20">
            <button
              type="button"
              onClick={() => onNavigateToPelanggaran && onNavigateToPelanggaran()}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#0D7A6F] to-[#059669] hover:from-[#0B685F] hover:to-[#047857] px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-black text-white shadow-lg shadow-emerald-950/50 transition transform active:scale-95 cursor-pointer border border-emerald-400/30"
            >
              <PlusCircle size={17} />
              <span>+ Catat Pelanggaran</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateToPelanggaran && onNavigateToPelanggaran()}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white transition backdrop-blur-md cursor-pointer"
              title="Buka Rekap Pelanggaran & Poin Santri"
            >
              <History size={16} />
              <span>Log Pelanggaran</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateToKamar && onNavigateToKamar()}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white transition backdrop-blur-md cursor-pointer"
              title="Data Kamar & Asrama Santri"
            >
              <BedDouble size={16} />
              <span>Data Asrama & Kamar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                void loadData();
                if (onRefresh) onRefresh();
              }}
              disabled={loading}
              className="inline-flex items-center justify-center h-10 sm:h-11 w-10 sm:w-11 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition cursor-pointer"
              title="Perbarui Data"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </section>

      {/* 📊 4 KARTU METRIK EKSEKUTIF KEAMANAN */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* KARTU 1: SANTRI PERLU PANGGILAN (OVER THRESHOLD) */}
        <div
          className={`rounded-3xl p-5 border transition-all duration-300 shadow-sm ${
            Number(stats?.total_santri_over_threshold ?? 0) > 0
              ? 'bg-gradient-to-br from-rose-50 to-rose-100/70 border-rose-300 ring-2 ring-rose-400/30'
              : 'bg-white border-slate-200/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-black uppercase tracking-wider ${
                Number(stats?.total_santri_over_threshold ?? 0) > 0 ? 'text-rose-800' : 'text-slate-500'
              }`}
            >
              Perlu Panggilan
            </span>
            <div
              className={`grid h-10 w-10 place-items-center rounded-2xl ${
                Number(stats?.total_santri_over_threshold ?? 0) > 0
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 animate-bounce'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <AlertTriangle size={18} />
            </div>
          </div>
          <p
            className={`text-3xl font-black mt-2 ${
              Number(stats?.total_santri_over_threshold ?? 0) > 0 ? 'text-rose-700' : 'text-slate-800'
            }`}
          >
            {Number(stats?.total_santri_over_threshold ?? 0)}
          </p>
          <p className="text-[11px] font-bold text-rose-700/80 mt-1">
            Akumulasi &ge; {threshold} Poin (Batas SP)
          </p>
        </div>

        {/* KARTU 2: KASUS BULAN INI */}
        <div className="rounded-3xl bg-white p-5 border border-slate-200/80 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kasus Bulan Ini</span>
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Calendar size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-800 mt-2">
            {Number(stats?.total_kasus_bulan_ini ?? 0)}
          </p>
          <p className="text-[11px] font-semibold text-slate-400 mt-1">
            Total semua kasus: <b>{Number(stats?.total_kasus_semua ?? 0)}</b>
          </p>
        </div>

        {/* KARTU 3: TOTAL SANTRI TERCATAT POIN */}
        <div className="rounded-3xl bg-white p-5 border border-slate-200/80 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Santri Kena Poin</span>
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
              <Users size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-800 mt-2">
            {Number(stats?.total_santri_tercatat ?? 0)}
          </p>
          <p className="text-[11px] font-semibold text-amber-600 mt-1">
            Santri dengan riwayat poin aktif
          </p>
        </div>

        {/* KARTU 4: TOTAL DENDA TAKZIR BELUM LUNAS */}
        <div className="rounded-3xl bg-white p-5 border border-slate-200/80 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Denda Takzir</span>
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-50 text-[#138F81] border border-teal-100">
              <Coins size={18} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[#138F81] mt-2">
            Rp {Number(stats?.total_denda_belum_lunas ?? 0).toLocaleString('id-ID')}
          </p>
          <p className="text-[11px] font-semibold text-slate-400 mt-1">
            Lunas: Rp {Number(stats?.total_denda_lunas ?? 0).toLocaleString('id-ID')}
          </p>
        </div>
      </section>

      {/* 🔍 QUICK STUDENT SECURITY SEARCH (PENCARIAN REKAM JEJAK SANTRI CEPAT) */}
      <section className="rounded-3xl bg-white p-5 sm:p-6 border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
              <Search size={18} className="text-[#138F81]" />
              <span>Cari Rekam Jejak Kedisiplinan Santri</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Ketik nama santri, NIS, atau nama kamar untuk melihat riwayat ketertiban seketika.
            </p>
          </div>
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600 self-start sm:self-auto">
            {students.length} Santri Terdaftar
          </span>
        </div>

        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchStudentQuery}
            onChange={(e) => setSearchStudentQuery(e.target.value)}
            placeholder="Cari nama santri (misal: 'Ahmad', 'Fulan') atau NIS..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#138F81] focus:outline-hidden transition"
          />
          {searchStudentQuery && (
            <button
              type="button"
              onClick={() => setSearchStudentQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              Hapus
            </button>
          )}
        </div>

        {/* Search Results Preview */}
        {searchedStudents.length > 0 && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {searchedStudents.map((st) => (
              <div
                key={String(st.id)}
                className="p-3.5 rounded-2xl bg-slate-50 hover:bg-teal-50/60 border border-slate-200 hover:border-teal-200 transition-all flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-slate-800 truncate group-hover:text-[#138F81]">
                    {String(st.nama)}
                  </p>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                    NIS: {String(st.nis || '-')} • Kelas: {String(st.kelas || '-')}
                  </p>
                  <p className="text-[10px] text-teal-700 font-bold mt-0.5 truncate">
                    Asrama: {String(st.komplek || '-')} / {String(st.kamar || '-')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateToPelanggaran && onNavigateToPelanggaran()}
                  className="px-2.5 py-1.5 rounded-xl bg-[#138F81] text-white text-[10px] font-black hover:bg-[#0D7A6F] transition shrink-0 shadow-xs cursor-pointer"
                  title="Lihat riwayat atau beri takzir"
                >
                  Lihat Rekam
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ⚡ RADAR LIVE & SANTRI KRITIS SPLIT VIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RADAR 1: REKAP PELANGGARAN TERBARU (2 COLS) */}
        <section className="lg:col-span-2 rounded-3xl bg-white p-5 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Zap size={18} className="text-amber-500" />
                  <span>Radar Pelanggaran Terbaru</span>
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Catatan ketertiban yang baru saja dimasukkan oleh petugas keamanan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToPelanggaran && onNavigateToPelanggaran()}
                className="text-xs font-black text-[#138F81] hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <span>Lihat Semua</span>
                <ExternalLink size={12} />
              </button>
            </div>

            {recentList.length === 0 ? (
              <div className="py-12 text-center">
                <ShieldCheck size={36} className="mx-auto text-emerald-500 mb-2 opacity-70" />
                <p className="text-sm font-black text-slate-700">Situasi Tertib & Kondusif</p>
                <p className="text-xs text-slate-400 mt-1">Belum ada catatan pelanggaran baru.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentList.map((item) => {
                  const tingkatColor =
                    item.tingkat === 'Berat'
                      ? 'bg-rose-100 text-rose-800 border-rose-200'
                      : item.tingkat === 'Sedang'
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-200';

                  return (
                    <div key={item.id} className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 px-2 rounded-xl transition">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-slate-800 truncate">
                            {item.siswa?.nama || 'Santri'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${tingkatColor}`}>
                            {item.tingkat}
                          </span>
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md">
                            +{item.poin} Poin
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium mt-1 truncate">
                          {item.judul_pelanggaran}
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5 flex items-center gap-1.5">
                          <span>📅 {item.tanggal}</span>
                          {item.waktu && <span>⏰ {item.waktu}</span>}
                          {item.siswa?.kamar && <span>🛏️ {item.siswa.kamar}</span>}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        {item.denda > 0 && (
                          <p className="text-xs font-black text-slate-700">
                            Rp {Number(item.denda).toLocaleString('id-ID')}
                          </p>
                        )}
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-black ${
                            item.status_denda === 'lunas'
                              ? 'bg-emerald-100 text-emerald-700'
                              : item.status_denda === 'belum_dibayar'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {item.status_denda === 'lunas'
                            ? 'Lunas'
                            : item.status_denda === 'belum_dibayar'
                            ? 'Belum Bayar'
                            : 'Bebas Denda'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Menampilkan 8 kasus terbaru</span>
            <button
              type="button"
              onClick={() => onNavigateToPelanggaran && onNavigateToPelanggaran()}
              className="text-[#138F81] hover:underline cursor-pointer"
            >
              Buka Manajemen Lengkap &rarr;
            </button>
          </div>
        </section>

        {/* RADAR 2: SANTRI KRITIS & OVER THRESHOLD (1 COL) */}
        <section className="rounded-3xl bg-white p-5 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-black text-rose-700 flex items-center gap-1.5">
                  <AlertTriangle size={18} />
                  <span>Santri Kritis (Top Poin)</span>
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Santri dengan akumulasi poin tertinggi mendekati batas SP.
                </p>
              </div>
            </div>

            {santriKritis.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2 opacity-70" />
                <p className="text-sm font-black text-slate-700">Bebas Santri Kritis</p>
                <p className="text-xs text-slate-400 mt-1">Tidak ada santri yang melampaui ambang batas.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {santriKritis.slice(0, 5).map((sk, idx) => {
                  const pct = Math.min(100, Math.round((sk.total_poin / threshold) * 100));
                  return (
                    <div
                      key={sk.siswa_id}
                      className="p-3 rounded-2xl bg-rose-50/60 border border-rose-200/80 text-left transition hover:bg-rose-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-slate-800 truncate">
                            {idx + 1}. {sk.nama}
                          </p>
                          <p className="text-[10px] text-slate-500 font-semibold">
                            {sk.asrama || `Kelas ${sk.kelas}`} • {sk.total_kasus} kali takzir
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[11px] font-black shrink-0 shadow-xs">
                          {sk.total_poin} Poin
                        </span>
                      </div>

                      {/* Progress Bar Towards Threshold */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pct >= 100 ? 'bg-rose-600 animate-pulse' : pct >= 75 ? 'bg-amber-500' : 'bg-teal-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-extrabold text-slate-600 shrink-0">
                          {pct}%
                        </span>
                      </div>

                      {sk.is_over_threshold && (
                        <div className="mt-2 flex items-center justify-between text-[10px] font-black text-rose-700">
                          <span>🚨 Wajib Panggilan Wali</span>
                          <button
                            type="button"
                            onClick={() => onNavigateToPelanggaran && onNavigateToPelanggaran()}
                            className="underline text-rose-800 hover:text-rose-950 cursor-pointer"
                          >
                            Cetak Surat
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => onNavigateToPelanggaran && onNavigateToPelanggaran()}
              className="text-xs font-black text-rose-700 hover:underline cursor-pointer"
            >
              Lihat Daftar Santri Kritis Selengkapnya &rarr;
            </button>
          </div>
        </section>
      </div>

      {/* 🏆 TOP 5 KASUS TERBANYAK DI PESANTREN */}
      {topPelanggaran.length > 0 && (
        <section className="rounded-3xl bg-white p-5 sm:p-6 border border-slate-200/80 shadow-sm">
          <h2 className="text-base font-black text-slate-800 flex items-center gap-2 mb-1">
            <Flame size={18} className="text-amber-500" />
            <span>Fokus Penertiban: 5 Pelanggaran Paling Sering Terjadi</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mb-4">
            Statistik tren kasus untuk evaluasi pembinaan akhlak dan pengawasan asrama santri.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {topPelanggaran.map((tp, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between gap-2"
              >
                <div>
                  <span className="text-[10px] font-bold text-slate-400">Peringkat #{idx + 1}</span>
                  <p className="text-xs font-black text-slate-800 mt-1 line-clamp-2">
                    {String(tp.judul_pelanggaran)}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {String(tp.tingkat || 'Umum')}
                  </span>
                  <span className="text-xs font-black text-[#138F81]">
                    {Number(tp.total)} Kasus
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
