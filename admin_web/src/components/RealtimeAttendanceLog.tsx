import {
  BookOpenCheck,
  CalendarCheck,
  CalendarDays,
  Clock3,
  Download,
  Filter,
  GraduationCap,
  Landmark,
  RefreshCw,
  Search,
  Sparkles,
  UsersRound
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable, type DataColumn } from './DataTable';
import { SearchInput } from './SearchInput';
import { StatCard } from './StatCard';
import { StatusBadge } from './StatusBadge';
import { api, type ApiRecord } from '../services/api';
import { exportRowsExcel } from '../utils/importTemplates';
import { getTodayDateString } from '../utils/formatters';

export interface UnifiedAttendanceLog extends ApiRecord {
  id: string | number;
  siswa_id?: number;
  siswa_nama: string;
  nis: string;
  kelas: string;
  komplek?: string;
  kamar?: string;
  kategori: 'Madin' | 'Sholat' | 'Ngaji';
  kegiatan_pelajaran: string;
  status: string;
  keterangan?: string;
  pengabsen: string;
  diinput_via: string;
  created_at: string;
  waktu_lengkap: string;
  jam_detik: string;
  tanggal_format: string;
}

function str(val: unknown, fallback = '-'): string {
  const clean = String(val ?? '').trim();
  return clean || fallback;
}

function num(val: unknown): number {
  const result = Number(val ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function record(val: unknown): ApiRecord {
  return val && typeof val === 'object' && !Array.isArray(val) ? (val as ApiRecord) : {};
}

function formatFullTimestamp(dateStr: unknown): { full: string; time: string; dateOnly: string } {
  if (!dateStr) return { full: '-', time: '-', dateOnly: '-' };
  const d = new Date(String(dateStr));
  if (Number.isNaN(d.getTime())) return { full: String(dateStr), time: '-', dateOnly: '-' };

  const dateOnly = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(d);

  const time = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(d);

  return {
    full: `${dateOnly}, ${time} WIB`,
    time: `${time} WIB`,
    dateOnly
  };
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const clean = status.toLowerCase();
  if (clean.includes('hadir') || clean === 'm' || clean === 'h' || clean === 'masuk') return 'success';
  if (clean.includes('izin') || clean === 'i') return 'warning';
  if (clean.includes('sakit') || clean === 's') return 'danger';
  if (clean.includes('alfa') || clean === 'a') return 'info';
  return 'neutral';
}

function normalizeStatus(status: string): string {
  const clean = status.toLowerCase();
  if (clean === 'm' || clean === 'h' || clean.includes('hadir') || clean.includes('masuk')) return 'Hadir';
  if (clean === 'i' || clean.includes('izin')) return 'Izin';
  if (clean === 's' || clean.includes('sakit')) return 'Sakit';
  if (clean === 'a' || clean.includes('alfa')) return 'Alfa';
  return status || 'Hadir';
}

export function RealtimeAttendanceLog() {
  const [logs, setLogs] = useState<UnifiedAttendanceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [selectedStatus, setSelectedStatus] = useState<string>('Semua');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());

  const loadData = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
      setError('');
    }
    try {
      const [absensiRes, dashboardRes] = await Promise.all([
        api.absensi({ tanggal: selectedDate || 'all' }).catch(() => ({ success: true, data: [] })),
        api.dashboard().catch(() => null)
      ]);

      const unified: UnifiedAttendanceLog[] = [];

      // 1. Parse Madin Absensi
      const madinList = Array.isArray(absensiRes.data) ? (absensiRes.data as ApiRecord[]) : [];
      madinList.forEach((row) => {
        const student = record(row.siswa);
        const mapel = record(row.mata_pelajaran);
        const actor = record(row.actor);
        const timestamps = formatFullTimestamp(row.created_at || row.tanggal);

        unified.push({
          id: `madin-${row.id}`,
          siswa_id: num(row.siswa_id ?? student.id),
          siswa_nama: str(student.nama ?? row.siswa_nama ?? row.nama_siswa, 'Santri'),
          nis: str(student.nis ?? row.nis),
          kelas: str(student.kelas ?? row.kelas),
          komplek: str(student.komplek ?? row.komplek),
          kamar: str(student.kamar ?? row.kamar),
          kategori: 'Madin',
          kegiatan_pelajaran: str(mapel.nama ?? row.mapel ?? 'Pelajaran Diniyah'),
          status: normalizeStatus(str(row.status, 'Hadir')),
          keterangan: str(row.keterangan, ''),
          pengabsen: str(actor.name ?? row.diinput_oleh ?? 'Ustadz Pengajar'),
          diinput_via: str(row.diinput_via, 'Android App'),
          created_at: String(row.created_at || row.tanggal || ''),
          waktu_lengkap: timestamps.full,
          jam_detik: timestamps.time,
          tanggal_format: timestamps.dateOnly
        });
      });

      // 2. Parse Dashboard Recent Streams if available (Ngaji & Sholat)
      if (dashboardRes && typeof dashboardRes === 'object') {
        const absensiSholat = record(dashboardRes.absensi_sholat);
        const sholatRecent = Array.isArray(absensiSholat.terbaru) ? (absensiSholat.terbaru as ApiRecord[]) : [];
        sholatRecent.forEach((row) => {
          const timestamps = formatFullTimestamp(row.created_at || row.tanggal);
          unified.push({
            id: `sholat-${row.id ?? Math.random()}`,
            siswa_id: num(row.siswa_id),
            siswa_nama: str(row.siswa_nama ?? row.nama, 'Santri'),
            nis: str(row.nis),
            kelas: str(row.kelas ?? row.komplek),
            komplek: str(row.komplek),
            kamar: str(row.kamar),
            kategori: 'Sholat',
            kegiatan_pelajaran: `Jama'ah ${str(row.jenis_sholat ?? 'Sholat Wajib')}`,
            status: normalizeStatus(str(row.status, 'Hadir')),
            pengabsen: str(row.petugas ?? row.diinput_oleh ?? 'Musyrif Asrama'),
            diinput_via: str(row.diinput_via, 'Aplikasi Android'),
            created_at: String(row.created_at || ''),
            waktu_lengkap: timestamps.full,
            jam_detik: timestamps.time,
            tanggal_format: timestamps.dateOnly
          });
        });

        const absensiNgaji = record(dashboardRes.absensi_ngaji);
        const ngajiRecent = Array.isArray(absensiNgaji.terbaru) ? (absensiNgaji.terbaru as ApiRecord[]) : [];
        ngajiRecent.forEach((row) => {
          const timestamps = formatFullTimestamp(row.created_at || row.tanggal);
          unified.push({
            id: `ngaji-${row.id ?? Math.random()}`,
            siswa_id: num(row.siswa_id),
            siswa_nama: str(row.siswa_nama ?? row.nama, 'Santri'),
            nis: str(row.nis),
            kelas: str(row.kelas),
            kategori: 'Ngaji',
            kegiatan_pelajaran: `Kitab ${str(row.kitab ?? row.sesi ?? 'Ngaji Kitab')}`,
            status: normalizeStatus(str(row.status ?? row.status_code, 'Hadir')),
            pengabsen: str(row.pengajar ?? row.diinput_oleh ?? 'Ustadz Pembina'),
            diinput_via: 'Aplikasi Android',
            created_at: String(row.created_at || ''),
            waktu_lengkap: timestamps.full,
            jam_detik: timestamps.time,
            tanggal_format: timestamps.dateOnly
          });
        });
      }

      // Sort chronological descending (latest timestamps first)
      unified.sort((a, b) => {
        const timeA = new Date(a.created_at).getTime() || 0;
        const timeB = new Date(b.created_at).getTime() || 0;
        return timeB - timeA;
      });

      setLogs(unified);
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Gagal memuat riwayat log absensi realtime.');
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void loadData();
    // Realtime polling every 30 seconds
    const interval = setInterval(() => {
      void loadData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      const matchCat = selectedCategory === 'Semua' || item.kategori === selectedCategory;
      const matchStat = selectedStatus === 'Semua' || item.status === selectedStatus;
      if (!matchCat || !matchStat) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        item.siswa_nama.toLowerCase().includes(q) ||
        item.nis.toLowerCase().includes(q) ||
        item.kelas.toLowerCase().includes(q) ||
        item.kegiatan_pelajaran.toLowerCase().includes(q) ||
        item.pengabsen.toLowerCase().includes(q)
      );
    });
  }, [logs, selectedCategory, selectedStatus, search]);

  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const hadir = filteredLogs.filter((l) => l.status === 'Hadir').length;
    const izin = filteredLogs.filter((l) => l.status === 'Izin').length;
    const sakit = filteredLogs.filter((l) => l.status === 'Sakit').length;
    const alfa = filteredLogs.filter((l) => l.status === 'Alfa').length;
    return { total, hadir, izin, sakit, alfa };
  }, [filteredLogs]);

  const handleExport = () => {
    if (filteredLogs.length === 0) {
      alert('Tidak ada data absensi untuk diexport.');
      return;
    }
    exportRowsExcel(
      filteredLogs.map((item, idx) => ({
        No: idx + 1,
        'Waktu Presensi (Lengkap)': item.waktu_lengkap,
        'Jam & Detik': item.jam_detik,
        Tanggal: item.tanggal_format,
        'Nama Santri': item.siswa_nama,
        NIS: item.nis,
        Kelas: item.kelas,
        Kategori: item.kategori,
        'Pelajaran / Kegiatan': item.kegiatan_pelajaran,
        'Status Kehadiran': item.status,
        'Ustadz / Pengabsen': item.pengabsen,
        'Media Input': item.diinput_via
      })),
      `Log_Monitoring_Absensi_${selectedDate || 'Semua'}.xlsx`,
      'LOG MONITORING REALTIME'
    );
  };

  const columns: DataColumn<UnifiedAttendanceLog>[] = [
    {
      key: 'waktu_lengkap',
      header: 'Waktu Presensi (Jam : Detik)',
      render: (row) => (
        <div className="flex flex-col">
          <span className="flex items-center gap-1 text-xs font-black text-slate-800">
            <Clock3 size={13} className="text-[#138F81]" />
            {row.jam_detik}
          </span>
          <span className="text-[11px] font-semibold text-slate-500">{row.tanggal_format}</span>
        </div>
      )
    },
    {
      key: 'siswa_nama',
      header: 'Nama Santri & NIS',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-extrabold text-slate-900 text-sm">{row.siswa_nama}</span>
          <span className="text-xs font-mono font-bold text-slate-500">NIS: {row.nis}</span>
        </div>
      )
    },
    {
      key: 'kelas',
      header: 'Kelas / Kamar',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-xs text-slate-800">{row.kelas}</span>
          {row.komplek ? <span className="text-[11px] text-slate-500">{row.komplek}</span> : null}
        </div>
      )
    },
    {
      key: 'kegiatan_pelajaran',
      header: 'Kegiatan & Pelajaran',
      render: (row) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                row.kategori === 'Madin'
                  ? 'bg-emerald-100 text-emerald-800'
                  : row.kategori === 'Sholat'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-purple-100 text-purple-800'
              }`}
            >
              {row.kategori}
            </span>
          </div>
          <span className="font-bold text-xs text-slate-800">{row.kegiatan_pelajaran}</span>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status & Keterangan',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <StatusBadge label={row.status} tone={statusTone(row.status)} />
            {row.keterangan && row.keterangan.toLowerCase().includes('terlambat') && (
              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-800 border border-amber-200">
                ⚠️ Terlambat
              </span>
            )}
          </div>
          {row.keterangan && (
            <span className="text-[10px] font-medium text-slate-500 line-clamp-1" title={row.keterangan}>
              {row.keterangan}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'pengabsen',
      header: 'Ustadz / Pengabsen',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-xs text-slate-800">{row.pengabsen}</span>
          <span className="text-[10px] font-semibold text-slate-400">Via {row.diinput_via}</span>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* HEADER MONITORING */}
      <section className="rounded-3xl bg-linear-to-r from-[#0F7A6E] via-[#138F81] to-[#1AB3A3] p-6 text-white shadow-lg shadow-[#138F81]/15">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-black backdrop-blur-xs">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300"></span>
              </span>
              <span>LIVE MONITORING REALTIME</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">Log Pemantauan Absensi Lengkap</h2>
            <p className="text-xs font-medium text-emerald-100 max-w-2xl">
              Memantau riwayat presensi santri detik-per-detik, nama santri, kegiatan/mata pelajaran, jam absensi, dan ustadz pengampu.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/30 px-4 py-2.5 text-xs font-extrabold text-white backdrop-blur-sm transition-all"
            >
              <Download size={15} /> Export Rekap Excel
            </button>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-xs font-black text-[#138F81] shadow-md hover:bg-emerald-50 transition-all disabled:opacity-50"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
              {isLoading ? 'Menyegarkan...' : 'Refresh Live Feed'}
            </button>
          </div>
        </div>
      </section>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard title="Total Presensi" value={stats.total} subtitle="Riwayat terdata" icon={CalendarCheck} tone="teal" />
        <StatCard title="Hadir" value={stats.hadir} subtitle="Santri masuk/hadir" icon={BookOpenCheck} tone="teal" />
        <StatCard title="Izin" value={stats.izin} subtitle="Santri izin" icon={GraduationCap} tone="orange" />
        <StatCard title="Sakit / Alfa" value={stats.sakit + stats.alfa} subtitle={`${stats.sakit} Sakit • ${stats.alfa} Alfa`} icon={UsersRound} tone="red" />
      </div>

      {error ? <div className="rounded-2xl bg-[#FDECEC] p-4 text-xs font-bold text-[#D63031]">{error}</div> : null}

      {/* FILTER & SEARCH */}
      <section className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Cari nama santri / NIS / kelas / mata pelajaran / nama ustadz..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* FILTER KATEGORI */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500">Kategori:</span>
              <select
                className="q-input text-xs font-bold py-2"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="Semua">Semua Kategori</option>
                <option value="Madin">Madin / Diniyah</option>
                <option value="Sholat">Jama'ah Sholat</option>
                <option value="Ngaji">Ngaji Kitab</option>
              </select>
            </div>

            {/* FILTER STATUS */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500">Status:</span>
              <select
                className="q-input text-xs font-bold py-2"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="Semua">Semua Status</option>
                <option value="Hadir">Hadir</option>
                <option value="Izin">Izin</option>
                <option value="Sakit">Sakit</option>
                <option value="Alfa">Alfa</option>
              </select>
            </div>

            {/* FILTER TANGGAL */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500">Tanggal:</span>
              <input
                type="date"
                className="q-input text-xs font-bold py-2"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  className="rounded-xl bg-slate-100 hover:bg-slate-200 px-2.5 py-2 text-[11px] font-bold text-slate-600 transition-colors"
                >
                  Semua Tanggal
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TABEL DATA */}
        {isLoading ? (
          <div className="py-12 text-center text-sm font-bold text-slate-400">
            <RefreshCw className="mx-auto mb-2 animate-spin text-[#138F81]" size={24} />
            Memuat log absensi realtime...
          </div>
        ) : (
          <DataTable
            rows={filteredLogs}
            columns={columns}
            emptyText="Tidak ada riwayat absensi pada tanggal / filter yang dipilih."
            minWidth="100%"
          />
        )}
      </section>
    </div>
  );
}
