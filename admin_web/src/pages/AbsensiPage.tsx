import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookMarked,
  BookOpenCheck,
  CalendarCheck,
  Check,
  CheckCircle2,
  ClipboardList,
  Download,
  Edit3,
  Landmark,
  Plus,
  Power,
  Printer,
  RefreshCw,
  Save,
  Settings,
  Trash2,
  TrendingUp,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ComplexSholatForm } from '../components/ComplexSholatForm';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type DataColumn } from '../components/DataTable';
import { ModalForm } from '../components/ModalForm';
import { SearchInput } from '../components/SearchInput';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { api, type ApiRecord } from '../services/api';
import { exportMadinRekapExcel, exportPrayerRekapExcel } from '../utils/excel';
import { NgajiKitabSection } from './NgajiKitabSection';

import { RealtimeAttendanceLog } from '../components/RealtimeAttendanceLog';
import { GuruDashboardView } from '../components/GuruDashboardView';

export type AbsensiTab =
  | 'log-realtime'
  | 'madin-input'
  | 'sholat'
  | 'ngaji'
  | 'rekap-madin'
  | 'madin'
  | 'rekap-sholat'
  | 'rekap-ngaji'
  | 'jenis-sholat'
  | 'jadwal-ngaji';

export interface AbsensiNavigationTarget {
  tab: AbsensiTab;
  classId?: number;
  mapelId?: number;
  jadwalId?: number;
}

export interface AbsensiPageProps {
  initialTab?: AbsensiTab;
  initialTarget?: AbsensiNavigationTarget;
  onTabChange?: (tab: AbsensiTab) => void;
}
type PrayerStatus = '' | 'M' | 'I' | 'S';
type MadinStatus = '' | 'Hadir' | 'Izin' | 'Sakit' | 'Alfa';

const tabs = [
  { id: 'log-realtime', label: '⚡ Log Realtime' },
  { id: 'madin-input', label: 'Absensi Madin' },
  { id: 'sholat', label: "Jama'ah Sholat" },
  { id: 'ngaji', label: 'Ngaji Kitab' },
  { id: 'madin', label: 'Rekap Madin' },
  { id: 'rekap-sholat', label: 'Rekap Sholat' },
  { id: 'rekap-ngaji', label: 'Rekap Ngaji' },
  { id: 'jenis-sholat', label: "Atur Waktu Sholat" },
  { id: 'jadwal-ngaji', label: "Atur Jadwal Ngaji" }
];

const legacyPrayerTypes: ApiRecord[] = [
  {
    id: -1,
    name: "Jama'ah Sholat",
    code: 'legacy_jamaah_sholat',
    is_active: true
  }
];

function prayerTypeParam(typeId: number): number | undefined {
  return typeId > 0 ? typeId : undefined;
}

const prayerStatusLabels: Record<PrayerStatus, string> = {
  '': 'Belum',
  M: 'Masuk',
  I: 'Izin',
  S: 'Sakit'
};

const madinStatusLabels: Record<MadinStatus, string> = {
  '': 'Belum',
  Hadir: 'Hadir',
  Izin: 'Izin',
  Sakit: 'Sakit',
  Alfa: 'Alfa'
};

function today(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

function num(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function text(value: unknown, fallback = '-'): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function record(value: unknown): ApiRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ApiRecord) : {};
}

function rows(value: unknown): ApiRecord[] {
  return Array.isArray(value) ? (value as ApiRecord[]) : [];
}

function roomsOf(complex: ApiRecord): ApiRecord[] {
  return rows(complex.rooms);
}

function statusTone(status: PrayerStatus | MadinStatus | string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'M' || status === 'Masuk' || status === 'Hadir') return 'success';
  if (status === 'I' || status === 'Izin') return 'warning';
  if (status === 'S' || status === 'Sakit') return 'danger';
  if (status === 'Alfa') return 'info';
  return 'neutral';
}

export function AbsensiPage({ initialTab = 'log-realtime', initialTarget, onTabChange }: AbsensiPageProps) {
  const { session, isGuru, isKepalaSekolah, isMainAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<AbsensiTab>(() => {
    if (initialTarget?.tab) return initialTarget.tab;
    if (isGuru) return 'madin-input';
    if (isKepalaSekolah) return 'log-realtime';
    return initialTab;
  });

  const handleTabSelect = (tab: AbsensiTab) => {
    setActiveTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  useEffect(() => {
    if (initialTarget?.tab) {
      setActiveTab(initialTarget.tab);
    } else if (initialTab) {
      if (isGuru && !['madin-input', 'sholat', 'ngaji'].includes(initialTab)) {
        setActiveTab('madin-input');
      } else if (isKepalaSekolah && !['log-realtime', 'madin', 'rekap-madin', 'rekap-sholat', 'rekap-ngaji'].includes(initialTab)) {
        setActiveTab('log-realtime');
      } else {
        setActiveTab(initialTab);
      }
    }
  }, [initialTab, initialTarget, isGuru, isKepalaSekolah]);

  const currentTab = activeTab === 'rekap-madin' ? 'madin' : activeTab;

  const headerInfo = useMemo(() => {
    switch (currentTab) {
      case 'log-realtime':
        return {
          badge: 'Pemantauan & Monitoring',
          title: 'Log Pemantauan Presensi Realtime',
          desc: 'Pemantauan riwayat kehadiran santri dan ustadz secara realtime lengkap dengan jam detik, mata pelajaran, dan status kehadiran.',
          icon: Activity
        };
      case 'madin-input':
        return {
          badge: 'Presensi KBM Diniyah',
          title: 'Input Presensi KBM Madin',
          desc: 'Catat absensi santri pada jam pelajaran Madrasah Diniyah berdasarkan kelas, mata pelajaran, dan jadwal.',
          icon: BookOpenCheck
        };
      case 'sholat':
        return {
          badge: 'Presensi Kedisiplinan Pondok',
          title: "Input Presensi Jama'ah Sholat",
          desc: "Catat kehadiran sholat fardhu berjama'ah santri per komplek dan kamar asrama pondok.",
          icon: Landmark
        };
      case 'ngaji':
        return {
          badge: 'Presensi Pondok',
          title: 'Input Presensi Ngaji Kitab',
          desc: 'Catat absensi santri pada halaqah dan jadwal pengajian kitab kuning pondok pesantren.',
          icon: BookMarked
        };
      case 'rekap-ngaji':
        return {
          badge: 'Laporan & Rekapitulasi',
          title: 'Rekapitulasi Presensi Ngaji Kitab',
          desc: 'Laporan rekap kehadiran pengajian kitab santri dengan opsi ekspor Excel.',
          icon: BarChart3
        };
      case 'madin':
        return {
          badge: 'Laporan & Rekapitulasi',
          title: 'Rekapitulasi Presensi Madin',
          desc: 'Laporan rekap kehadiran KBM Madin per kelas dan semester lengkap dengan opsi export Excel.',
          icon: BarChart3
        };
      case 'rekap-sholat':
        return {
          badge: 'Laporan & Rekapitulasi',
          title: 'Rekapitulasi Presensi Sholat',
          desc: "Laporan rekapitulasi kehadiran sholat jama'ah santri per kamar dan komplek asrama pondok.",
          icon: TrendingUp
        };
      case 'jenis-sholat':
        return {
          badge: 'Pengaturan Sistem',
          title: "Pengaturan Sesi & Waktu Jama'ah",
          desc: "Kelola daftar sesi sholat (Subuh, Dhuhur, Ashar, Maghrib, Isya') dan konfigurasi batas waktu presensi.",
          icon: Settings
        };
      default:
        return {
          badge: 'Presensi & Absensi',
          title: 'Presensi Santri & Ustadz',
          desc: 'Kelola data kehadiran santri, KBM Madin, dan sholat jamaah.',
          icon: CalendarCheck
        };
    }
  }, [currentTab]);

  const HeaderIcon = headerInfo.icon;

  return (
    <div className="q-page-enter space-y-6">
      {/* 🌟 HEADER CARD PRESENSI & ABSENSI */}
      <div className="q-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-[#E1EFF7] text-[#138F81] border border-teal-100 flex items-center justify-center shrink-0 shadow-xs">
            <HeaderIcon className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#636E72]">
                Presensi & Absensi
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#FFDC80] text-[#0D7A6F] border border-amber-300">
                {headerInfo.badge}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#2D3436] tracking-tight">{headerInfo.title}</h1>
            <p className="text-xs sm:text-sm font-medium text-[#636E72] mt-0.5">{headerInfo.desc}</p>
          </div>
        </div>
      </div>

      {currentTab === 'log-realtime' ? <RealtimeAttendanceLog /> : null}
      {currentTab === 'madin-input' ? <MadinInput initialTarget={initialTarget} /> : null}
      {currentTab === 'sholat' ? <PrayerInput /> : null}
      {currentTab === 'ngaji' ? <NgajiKitabSection initialSection="input" /> : null}
      {currentTab === 'rekap-ngaji' ? <NgajiKitabSection initialSection="rekap" /> : null}
      {currentTab === 'jadwal-ngaji' ? <NgajiKitabSection initialSection="master" /> : null}
      {currentTab === 'rekap-sholat' ? <PrayerRekap /> : null}
      {currentTab === 'madin' ? <MadinRekap /> : null}
      {currentTab === 'jenis-sholat' ? <PrayerTypeCms /> : null}
    </div>
  );
}

function AbsensiSessionPrintModal({
  isOpen,
  onClose,
  sessionInfo,
  students,
  statuses,
  notes
}: {
  isOpen: boolean;
  onClose: () => void;
  sessionInfo: {
    tanggal: string;
    kelas: string;
    mapel: string;
    jadwal: string;
    guru: string;
    diinputOleh: string;
  };
  students: ApiRecord[];
  statuses: Record<number, string>;
  notes: Record<number, string>;
}) {
  if (!isOpen) return null;

  const counts = {
    Hadir: Object.values(statuses).filter((s) => s === 'Hadir').length,
    Izin: Object.values(statuses).filter((s) => s === 'Izin').length,
    Sakit: Object.values(statuses).filter((s) => s === 'Sakit').length,
    Alfa: Object.values(statuses).filter((s) => s === 'Alfa').length,
    Total: students.length
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-transparent">
      <div className="relative w-full max-w-4xl rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 print:border-none print:shadow-none print:p-4 my-8">
        {/* Header Actions (Hidden in Print) */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-50 text-[#138F81]">
              <Printer size={20} />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-800">Pratinjau Rekapitulasi Presensi Sesi</h3>
              <p className="text-xs font-semibold text-slate-500">Format resmi Berita Acara Presensi Madrasah Diniyah</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#138F81] px-4 py-2 text-xs font-black text-white shadow-xs hover:bg-[#0f766a] transition-all cursor-pointer"
            >
              <Printer size={15} /> Cetak Dokumen / PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PRINTABLE OFFICIAL SHEET */}
        <div className="p-4 sm:p-6 text-slate-900 font-sans" id="printable-attendance-sheet">
          {/* KOP SURAT */}
          <div className="text-center pb-4 border-b-2 border-slate-900">
            <h2 className="text-sm font-bold tracking-wider uppercase text-slate-600">YAYASAN PONDOK PESANTREN QOMARUDDIN</h2>
            <h1 className="text-xl font-black uppercase text-slate-900 tracking-tight mt-0.5">MADRASAH DINIYAH PONDOK PESANTREN</h1>
            <p className="text-[11px] text-slate-600 mt-0.5">Sampurnan, Bungah, Kabupaten Gresik, Jawa Timur • Website: ppqomaruddin.itqom.net</p>
          </div>

          <div className="text-center my-4">
            <h3 className="text-base font-black uppercase underline decoration-1">BERITA ACARA & JURNAL PRESENSI KELAS</h3>
            <p className="text-xs font-bold text-slate-600 mt-0.5">Tanggal: {sessionInfo.tanggal}</p>
          </div>

          {/* SESSION METADATA */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-semibold bg-slate-50 p-3.5 rounded-xl border border-slate-200 my-4">
            <div><span className="text-slate-500 font-normal">Rombel Kelas:</span> <b className="text-slate-800">{sessionInfo.kelas}</b></div>
            <div><span className="text-slate-500 font-normal">Mata Pelajaran:</span> <b className="text-slate-800">{sessionInfo.mapel}</b></div>
            <div><span className="text-slate-500 font-normal">Guru/Ustadz Pengampu:</span> <b className="text-[#138F81]">{sessionInfo.guru}</b></div>
            <div><span className="text-slate-500 font-normal">Jadwal & Waktu:</span> <b className="text-slate-800">{sessionInfo.jadwal}</b></div>
          </div>

          {/* STATS SUMMARY BOXES */}
          <div className="grid grid-cols-5 gap-2 text-center my-4">
            <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Santri</span>
              <span className="text-base font-black text-slate-800">{counts.Total}</span>
            </div>
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Hadir (H)</span>
              <span className="text-base font-black text-emerald-800">{counts.Hadir}</span>
            </div>
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-[10px] uppercase font-bold text-amber-700 block">Izin (I)</span>
              <span className="text-base font-black text-amber-800">{counts.Izin}</span>
            </div>
            <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
              <span className="text-[10px] uppercase font-bold text-rose-700 block">Sakit (S)</span>
              <span className="text-base font-black text-rose-800">{counts.Sakit}</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-200 border border-slate-300">
              <span className="text-[10px] uppercase font-bold text-slate-700 block">Alfa (A)</span>
              <span className="text-base font-black text-slate-900">{counts.Alfa}</span>
            </div>
          </div>

          {/* STUDENT TABLE */}
          <table className="w-full text-left text-xs border-collapse border border-slate-300 my-4">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-black">
                <th className="p-2 border-r border-slate-300 text-center w-10">No</th>
                <th className="p-2 border-r border-slate-300">Nama Santri</th>
                <th className="p-2 border-r border-slate-300 w-24">NIS</th>
                <th className="p-2 border-r border-slate-300 text-center w-14">L/P</th>
                <th className="p-2 border-r border-slate-300 w-24 text-center">Status</th>
                <th className="p-2">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {students.map((st, i) => {
                const sid = num(st.id);
                const s = statuses[sid] || '-';
                return (
                  <tr key={sid} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-2 border-r border-slate-300 text-center font-bold">{i + 1}</td>
                    <td className="p-2 border-r border-slate-300 font-extrabold">{String(st.nama ?? st.name ?? '-')}</td>
                    <td className="p-2 border-r border-slate-300 font-mono">{String(st.nis ?? '-')}</td>
                    <td className="p-2 border-r border-slate-300 text-center font-bold">{st.jenis_kelamin === 'L' ? 'L' : 'P'}</td>
                    <td className="p-2 border-r border-slate-300 text-center font-black">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        s === 'Hadir' ? 'bg-emerald-100 text-emerald-900' :
                        s === 'Izin' ? 'bg-amber-100 text-amber-900' :
                        s === 'Sakit' ? 'bg-rose-100 text-rose-900' :
                        s === 'Alfa' ? 'bg-slate-200 text-slate-900' : 'text-slate-400'
                      }`}>
                        {s}
                      </span>
                    </td>
                    <td className="p-2 text-slate-600 font-medium">{notes[sid] || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* SIGNATURE SECTION */}
          <div className="grid grid-cols-2 gap-8 text-center text-xs mt-10 pt-4">
            <div>
              <p className="font-medium text-slate-600">Mengetahui,</p>
              <p className="font-bold text-slate-800">Kepala Madrasah Diniyah</p>
              <div className="h-16"></div>
              <p className="font-black text-slate-900 underline">( ............................................ )</p>
            </div>
            <div>
              <p className="font-medium text-slate-600">Gresik, {sessionInfo.tanggal}</p>
              <p className="font-bold text-slate-800">Ustadz / Guru Pengampu</p>
              <div className="h-16"></div>
              <p className="font-black text-slate-900 underline">( {sessionInfo.guru} )</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MadinInput({ initialTarget }: { initialTarget?: AbsensiNavigationTarget }) {
  const { session, isGuru } = useAuth();

  if (isGuru) {
    return <GuruDashboardView session={session} />;
  }

  const [date, setDate] = useState(today());
  const [classes, setClasses] = useState<ApiRecord[]>([]);
  const [mapel, setMapel] = useState<ApiRecord[]>([]);
  const [jadwal, setJadwal] = useState<ApiRecord[]>([]);
  const [students, setStudents] = useState<ApiRecord[]>([]);
  const [classId, setClassId] = useState(initialTarget?.classId ?? 0);
  const [mapelId, setMapelId] = useState(initialTarget?.mapelId ?? 0);
  const [jadwalId, setJadwalId] = useState(initialTarget?.jadwalId ?? 0);
  const [statuses, setStatuses] = useState<Record<number, MadinStatus>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [existingAttendance, setExistingAttendance] = useState<{
    isExisting: boolean;
    count: number;
    pengabsen: string;
    createdAt: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadMaster() {
    setIsLoading(true);
    setError('');
    try {
      const [classResult, mapelResult, jadwalResult] = await Promise.all([
        api.classes(),
        api.mataPelajaran(),
        api.jadwal()
      ]);
      const nextClasses = rows(classResult.data);
      const nextMapel = rows(mapelResult.data);
      const nextJadwal = rows(jadwalResult.data);
      setClasses(nextClasses);
      setMapel(nextMapel);
      setJadwal(nextJadwal);
      setClassId((current) => current || num(nextClasses[0]?.id));
      setMapelId((current) => current || num(nextMapel[0]?.id));
      setJadwalId((current) => current || num(nextJadwal[0]?.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Master absensi madin gagal dimuat');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSessionData(
    targetClassId = classId,
    targetMapelId = mapelId,
    targetJadwalId = jadwalId,
    targetDate = date
  ) {
    if (!targetClassId) {
      setStudents([]);
      setStatuses({});
      setExistingAttendance(null);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const [siswaRes, absensiRes] = await Promise.all([
        api.siswa({ class_id: targetClassId, status: 'Aktif' }),
        targetClassId && targetMapelId && targetJadwalId
          ? api
              .absensi({
                tanggal: targetDate,
                class_id: targetClassId,
                mapel_id: targetMapelId,
                jadwal_id: targetJadwalId
              })
              .catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] })
      ]);

      const nextStudents = rows(siswaRes.data);
      setStudents(nextStudents);

      const existingList = Array.isArray(absensiRes.data) ? (absensiRes.data as ApiRecord[]) : [];
      const nextStatuses: Record<number, MadinStatus> = {};
      const nextNotes: Record<number, string> = {};

      if (existingList.length > 0) {
        existingList.forEach((row) => {
          const sid = num(row.siswa_id);
          if (sid) {
            nextStatuses[sid] = (row.status as MadinStatus) || '';
            if (row.keterangan) nextNotes[sid] = String(row.keterangan);
          }
        });
        nextStudents.forEach((student) => {
          const id = num(student.id);
          if (id && nextStatuses[id] === undefined) {
            nextStatuses[id] = '';
          }
        });

        const first = existingList[0];
        setExistingAttendance({
          isExisting: true,
          count: existingList.length,
          pengabsen: String(first?.diinput_oleh ?? record(first?.actor).name ?? 'Ustadz Pengampu'),
          createdAt: String(first?.created_at ?? '')
        });
      } else {
        nextStudents.forEach((student) => {
          const id = num(student.id);
          if (id) nextStatuses[id] = '';
        });
        setExistingAttendance(null);
      }

      setStatuses(nextStatuses);
      setNotes(nextNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data siswa kelas gagal dimuat');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadMaster();
  }, []);

  useEffect(() => {
    if (classId) {
      void loadSessionData(classId, mapelId, jadwalId, date);
    }
  }, [classId, mapelId, jadwalId, date]);

  const selectedJadwal = useMemo(() => {
    return jadwal.find((j) => num(j.id) === jadwalId);
  }, [jadwal, jadwalId]);

  const selectedMapel = useMemo(() => {
    return mapel.find((m) => num(m.id) === mapelId);
  }, [mapel, mapelId]);

  const selectedClass = useMemo(() => {
    return classes.find((c) => num(c.id) === classId);
  }, [classes, classId]);

  const teacherName = useMemo(() => {
    if (!selectedJadwal) return 'Belum Dipilih';
    return String(selectedJadwal.guru || selectedJadwal.teacher_name || 'Ustadz Pengampu');
  }, [selectedJadwal]);

  const counts = useMemo(() => {
    const values = Object.values(statuses);
    return {
      Hadir: values.filter((status) => status === 'Hadir').length,
      Izin: values.filter((status) => status === 'Izin').length,
      Sakit: values.filter((status) => status === 'Sakit').length,
      Alfa: values.filter((status) => status === 'Alfa').length,
      Belum: values.filter((status) => !status).length
    };
  }, [statuses]);

  function setStudentStatus(id: number, status: MadinStatus) {
    setStatuses((previous) => {
      const next = { ...previous, [id]: previous[id] === status ? '' : status };
      if (next[id] === 'Hadir' || !next[id]) {
        setNotes((prevNotes: Record<number, string>) => {
          const nextNotes = { ...prevNotes };
          delete nextNotes[id];
          return nextNotes;
        });
      }
      return next;
    });
  }

  async function save() {
    if (isSaving) return;
    if (!classId || !mapelId || !jadwalId || students.length === 0) {
      setError('Pilih kelas, mapel, jadwal, dan pastikan siswa tersedia.');
      return;
    }
    const absensi = students
      .map((student) => {
        const id = num(student.id);
        return {
          siswa_id: id,
          tanggal: date,
          status: statuses[id],
          class_id: classId,
          mapel_id: mapelId,
          jadwal_id: jadwalId,
          keterangan: notes[id] || undefined,
          diinput_via: 'online' as const
        };
      })
      .filter((item) => item.siswa_id > 0 && Boolean(item.status));
    if (absensi.length === 0) {
      setError('Pilih minimal satu status absensi madin dulu.');
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await api.createAbsensiBulk({
        user_id: session?.id,
        actor_user_id: session?.id,
        absensi: absensi as Parameters<typeof api.createAbsensiBulk>[0]['absensi']
      });
      setNotice(text(result.message, 'Absensi Madin berhasil disimpan & diperbarui.'));
      await loadSessionData(classId, mapelId, jadwalId, date);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Absensi Madin gagal disimpan');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteSession() {
    if (!classId || !mapelId || !jadwalId || !date || isDeletingSession) return;
    setIsDeletingSession(true);
    setError('');
    try {
      await api.cancelAbsensiSession({
        tanggal: date,
        class_id: classId,
        mapel_id: mapelId,
        jadwal_id: jadwalId
      });
      setShowDeleteConfirm(false);
      setNotice('Absensi sesi KBM ini berhasil dihapus & direset. Database telah bersih.');
      await loadSessionData(classId, mapelId, jadwalId, date);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mereset absensi sesi');
    } finally {
      setIsDeletingSession(false);
    }
  }

  return (
    <div className="space-y-6">
      <Message error={error} notice={notice} />

      {/* Selector Filters */}
      <section className="q-panel grid gap-3 p-4 sm:p-6 md:grid-cols-5">
        <div>
          <label className="text-[11px] font-bold text-slate-500 mb-1 block">Tanggal KBM</label>
          <input className="q-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-500 mb-1 block">Rombel Kelas</label>
          <select className="q-input" value={classId} onChange={(event) => setClassId(Number(event.target.value))}>
            <option value={0}>Pilih kelas</option>
            {classes.map((item) => (
              <option key={num(item.id)} value={num(item.id)}>
                {text(item.name ?? item.nama)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-500 mb-1 block">Mata Pelajaran</label>
          <select className="q-input" value={mapelId} onChange={(event) => setMapelId(Number(event.target.value))}>
            <option value={0}>Pilih mapel</option>
            {mapel.map((item) => (
              <option key={num(item.id)} value={num(item.id)}>
                {text(item.nama ?? item.name)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-500 mb-1 block">Jadwal & Waktu</label>
          <select className="q-input" value={jadwalId} onChange={(event) => setJadwalId(Number(event.target.value))}>
            <option value={0}>Pilih jadwal</option>
            {jadwal.map((item) => (
              <option key={num(item.id)} value={num(item.id)}>
                {text(item.hari ?? item.day ?? item.nama)} {text(item.jam_mulai ?? item.start_time, '')}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <RefreshButton isLoading={isLoading} onClick={() => void loadSessionData(classId, mapelId, jadwalId, date)} />
        </div>
      </section>

      {/* Teacher Assignment & Status Bar */}
      {selectedJadwal && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl">
              👨‍🏫 Ustadz Pengampu:
              <span className="text-[#138F81] font-black">{teacherName}</span>
            </span>
            <span className="font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">
              ⏰ {String(selectedJadwal.hari ?? '')}, {String(selectedJadwal.jam_mulai ?? '')} - {String(selectedJadwal.jam_selesai ?? '')} WIB
            </span>
            {Boolean(selectedJadwal.ruangan) && (
              <span className="font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">
                📍 Ruang: {String(selectedJadwal.ruangan ?? '')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {existingAttendance ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-black text-emerald-800">
                <CheckCircle2 size={14} className="text-emerald-600" />
                Sudah Diabsen oleh {existingAttendance.pengabsen}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-black text-amber-800">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Belum Diabsen (Siap Input)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Existing Attendance Action Banner */}
      {existingAttendance && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-3xl bg-emerald-50/80 border border-emerald-200 shadow-xs animate-in fade-in">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="text-emerald-600 shrink-0" size={18} />
              Sesi KBM ini sudah memiliki riwayat presensi tersimpan ({existingAttendance.count} santri).
            </p>
            <p className="text-xs font-semibold text-emerald-700 mt-0.5">
              Diinput oleh <b>{existingAttendance.pengabsen}</b>. Admin dapat mengedit status santri atau mereset absensi jika ada perbaikan data.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-black text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-all shadow-2xs cursor-pointer"
            >
              <Printer size={14} /> Cetak / Preview Rekap
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-black text-white hover:bg-rose-700 transition-all shadow-xs cursor-pointer"
            >
              <Trash2 size={14} /> Hapus & Reset Absensi
            </button>
          </div>
        </div>
      )}

      {/* Stats Counter */}
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard title="Hadir" value={counts.Hadir} subtitle="Status H" icon={Check} tone="teal" />
        <StatCard title="Izin" value={counts.Izin} subtitle="Status I" icon={ClipboardList} tone="orange" />
        <StatCard title="Sakit" value={counts.Sakit} subtitle="Status S" icon={X} tone="red" />
        <StatCard title="Alfa" value={counts.Alfa} subtitle="Status A" icon={CalendarCheck} tone="blue" />
        <StatCard title="Belum" value={counts.Belum} subtitle="Belum dipilih" icon={BookOpenCheck} tone="blue" />
      </div>

      {/* Attendance Rows */}
      <AttendanceRows
        isLoading={isLoading}
        rows={students}
        emptyText="Belum ada siswa aktif pada kelas ini."
        statusMap={statuses}
        notesMap={notes}
        labels={madinStatusLabels}
        options={['Hadir', 'Izin', 'Sakit', 'Alfa']}
        onChange={setStudentStatus}
        onNoteChange={(id: number, note: string) => setNotes((prev: Record<number, string>) => ({ ...prev, [id]: note }))}
      />

      {/* Save Bar */}
      <SaveBar
        isSaving={isSaving}
        disabled={students.length === 0}
        primaryLabel={existingAttendance ? '💾 Simpan Perubahan (Update Absensi)' : '💾 Simpan Absensi Madin'}
        onReset={() => setStatuses(Object.fromEntries(students.map((student) => [num(student.id), ''])))}
        onSave={() => void save()}
      />

      {/* Delete / Reset Confirmation Dialog */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Hapus & Reset Absensi Sesi Ini?"
          message={`Apakah Anda yakin ingin menghapus seluruh data absensi untuk kelas "${selectedClass?.name ?? classId}" - mapel "${selectedMapel?.nama ?? mapelId}" pada tanggal ${date}? Data presensi di database akan dibersihkan dan dapat diabsen ulang.`}
          confirmLabel={isDeletingSession ? 'Menghapus...' : 'Ya, Hapus & Reset'}
          tone="danger"
          isBusy={isDeletingSession}
          onConfirm={() => void handleDeleteSession()}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* Print / Preview PDF Modal */}
      {showPrintModal && (
        <AbsensiSessionPrintModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          sessionInfo={{
            tanggal: date,
            kelas: String(selectedClass?.name ?? selectedClass?.nama ?? `Kelas ${classId}`),
            mapel: String(selectedMapel?.nama ?? selectedMapel?.name ?? `Mapel ${mapelId}`),
            jadwal: `${selectedJadwal?.hari ?? ''}, ${selectedJadwal?.jam_mulai ?? ''} - ${selectedJadwal?.jam_selesai ?? ''} WIB`,
            guru: teacherName,
            diinputOleh: existingAttendance?.pengabsen ?? session?.name ?? 'Admin'
          }}
          students={students}
          statuses={statuses}
          notes={notes}
        />
      )}
    </div>
  );
}

function PrayerInput() {
  const { session } = useAuth();
  const [types, setTypes] = useState<ApiRecord[]>([]);
  const [typeId, setTypeId] = useState(0);
  const [complexes, setComplexes] = useState<ApiRecord[]>([]);
  const [complexId, setComplexId] = useState(0);
  const [roomId, setRoomId] = useState(0);
  const [date, setDate] = useState(today());
  const [inputRows, setInputRows] = useState<ApiRecord[]>([]);
  const [initialStatuses, setInitialStatuses] = useState<Record<number, PrayerStatus>>({});
  const [statuses, setStatuses] = useState<Record<number, PrayerStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedComplex = complexes.find((item) => num(item.id) === complexId) ?? complexes[0];
  const roomOptions = roomsOf(selectedComplex ?? {});
  const hasExisting = Object.values(initialStatuses).some(Boolean);
  const hasChanges = JSON.stringify(statuses) !== JSON.stringify(initialStatuses);

  async function loadMaster() {
    setError('');
    setIsLoading(true);
    try {
      const [typeResult, complexResult] = await Promise.allSettled([api.prayerAttendanceTypes({ active_only: 1 }), api.boardingComplexes()]);
      const fetchedTypes = typeResult.status === 'fulfilled' ? rows(typeResult.value.data) : [];
      const nextTypes = fetchedTypes.length > 0 ? fetchedTypes : legacyPrayerTypes;
      const nextComplexes = complexResult.status === 'fulfilled' ? rows(complexResult.value.data) : [];
      setTypes(nextTypes);
      setComplexes(nextComplexes);
      setTypeId((current) => current || num(nextTypes[0]?.id));
      setComplexId((current) => current || num(nextComplexes[0]?.id));
      setRoomId((current) => current || num(roomsOf(nextComplexes[0] ?? {})[0]?.id));
      if (typeResult.status === 'rejected') {
        setNotice("Master waktu jama'ah belum tersedia di backend online. Halaman memakai mode lama sampai backend terbaru dideploy.");
      }
      if (complexResult.status === 'rejected') {
        setError(complexResult.reason instanceof Error ? complexResult.reason.message : 'Master pondok gagal dimuat');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Master absensi sholat gagal dimuat');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadContext(nextRoomId = roomId, nextTypeId = typeId) {
    if (!nextRoomId || nextTypeId === 0) {
      setInputRows([]);
      setStatuses({});
      setInitialStatuses({});
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const params: Record<string, string | number | boolean> = { tanggal: date, boarding_room_id: nextRoomId };
      const selectedTypeId = prayerTypeParam(nextTypeId);
      if (selectedTypeId) params.prayer_attendance_type_id = selectedTypeId;
      const result = await api.absensiSholatContext(params);
      const data = record(result.data);
      const nextRows = rows(data.rows);
      const nextStatuses: Record<number, PrayerStatus> = {};
      nextRows.forEach((row) => {
        const siswa = record(row.siswa);
        const absensi = record(row.absensi);
        const id = num(siswa.id);
        nextStatuses[id] = (text(absensi.status_code, '') as PrayerStatus) || '';
      });
      setInputRows(nextRows);
      setStatuses(nextStatuses);
      setInitialStatuses(nextStatuses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data absensi sholat gagal dimuat');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadMaster();
  }, []);

  useEffect(() => {
    if (complexes.length === 0) return;
    const nextRoom = num(roomOptions[0]?.id);
    setRoomId((current) => (roomOptions.some((room) => num(room.id) === current) ? current : nextRoom));
  }, [complexId, complexes]);

  useEffect(() => {
    void loadContext(roomId, typeId);
  }, [date, roomId, typeId]);

  const counts = useMemo(() => {
    const values = Object.values(statuses);
    return {
      M: values.filter((status) => status === 'M').length,
      I: values.filter((status) => status === 'I').length,
      S: values.filter((status) => status === 'S').length,
      kosong: values.filter((status) => !status).length
    };
  }, [statuses]);

  function setStudentStatus(id: number, status: PrayerStatus) {
    setStatuses((previous) => ({ ...previous, [id]: previous[id] === status ? '' : status }));
  }

  async function save() {
    if (isSaving || !roomId || typeId === 0) return;
    const items = Object.entries(statuses)
      .filter(([, status]) => Boolean(status))
      .map(([siswaId, status]) => ({ siswa_id: Number(siswaId), status_code: status as 'M' | 'I' | 'S' }));
    if (items.length === 0) {
      setError('Pilih minimal satu status M/I/S dulu.');
      return;
    }
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await api.createAbsensiSholatBulk({
        tanggal: date,
        boarding_room_id: roomId,
        prayer_attendance_type_id: prayerTypeParam(typeId),
        actor_user_id: session?.id,
        diinput_oleh: session?.name,
        diinput_via: 'online',
        items
      });
      setNotice(text(result.message, 'Absensi sholat berhasil disimpan.'));
      await loadContext(roomId, typeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Absensi sholat gagal disimpan');
    } finally {
      setIsSaving(false);
    }
  }

  async function cancel() {
    if (!roomId || typeId === 0 || !hasExisting) return;
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await api.cancelAbsensiSholat({ tanggal: date, boarding_room_id: roomId, prayer_attendance_type_id: prayerTypeParam(typeId), reason: 'Dibatalkan dari web admin' });
      setNotice(text(result.message, 'Absensi sholat berhasil dibatalkan.'));
      await loadContext(roomId, typeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Absensi sholat gagal dibatalkan');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Message error={error} notice={notice} />
      <section className="q-panel grid gap-3 p-4 sm:p-6 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
        <select className="q-input" value={typeId} onChange={(event) => setTypeId(Number(event.target.value))}>
          <option value={0}>Waktu jama'ah</option>
          {types.map((type) => (
            <option key={num(type.id)} value={num(type.id)}>{text(type.name)}</option>
          ))}
        </select>
        <input className="q-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <select className="q-input" value={complexId} onChange={(event) => setComplexId(Number(event.target.value))}>
          {complexes.map((complex) => (
            <option key={num(complex.id)} value={num(complex.id)}>{text(complex.name)}</option>
          ))}
        </select>
        <select className="q-input" value={roomId} onChange={(event) => setRoomId(Number(event.target.value))}>
          {roomOptions.map((room) => (
            <option key={num(room.id)} value={num(room.id)}>{text(room.name)}</option>
          ))}
        </select>
        <RefreshButton isLoading={isLoading} onClick={() => void loadContext(roomId, typeId)} />
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Masuk" value={counts.M} subtitle="Status M" icon={Check} tone="teal" />
        <StatCard title="Izin" value={counts.I} subtitle="Status I" icon={ClipboardList} tone="orange" />
        <StatCard title="Sakit" value={counts.S} subtitle="Status S" icon={X} tone="red" />
        <StatCard title="Belum" value={counts.kosong} subtitle="Belum dipilih" icon={CalendarCheck} tone="blue" />
      </div>

      <AttendanceRows
        isLoading={isLoading}
        rows={inputRows.map((row) => record(row.siswa))}
        emptyText="Belum ada santri aktif ikut sholat pada kamar ini."
        statusMap={statuses}
        labels={prayerStatusLabels}
        options={['M', 'I', 'S']}
        onChange={setStudentStatus}
      />

      <SaveBar
        isSaving={isSaving}
        disabled={inputRows.length === 0 || (!hasChanges && hasExisting)}
        primaryLabel={hasExisting ? 'Perbarui Absensi' : 'Simpan Absensi'}
        onReset={() => setStatuses(initialStatuses)}
        onCancel={hasExisting ? () => void cancel() : undefined}
        onSave={() => void save()}
      />
    </div>
  );
}

function PrayerRekap() {
  const [types, setTypes] = useState<ApiRecord[]>([]);
  const [complexes, setComplexes] = useState<ApiRecord[]>([]);
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [typeId, setTypeId] = useState(0);
  const [complexId, setComplexId] = useState(0);
  const [roomId, setRoomId] = useState(0);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [rekapRows, setRekapRows] = useState<ApiRecord[]>([]);
  const [summary, setSummary] = useState<ApiRecord>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedComplex = complexes.find((item) => num(item.id) === complexId);
  const roomOptions = roomsOf(selectedComplex ?? {});
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rekapRows;
    return rekapRows.filter((row) => {
      const nama = String(record(row.siswa).nama ?? row.nama ?? '').toLowerCase();
      const nis = String(record(row.siswa).nis ?? row.nis ?? '').toLowerCase();
      const kamar = String(row.kamar ?? record(row.boardingRoom).name ?? '').toLowerCase();
      const komplek = String(row.komplek ?? record(row.boardingComplex).name ?? '').toLowerCase();
      return nama.includes(keyword) || nis.includes(keyword) || kamar.includes(keyword) || komplek.includes(keyword);
    });
  }, [rekapRows, search]);

  async function loadMaster() {
    const [typeResult, complexResult] = await Promise.allSettled([api.prayerAttendanceTypes(), api.boardingComplexes()]);
    const fetchedTypes = typeResult.status === 'fulfilled' ? rows(typeResult.value.data) : [];
    setTypes(fetchedTypes.length > 0 ? fetchedTypes : legacyPrayerTypes);
    setComplexes(complexResult.status === 'fulfilled' ? rows(complexResult.value.data) : []);
  }

  async function loadRekap() {
    setIsLoading(true);
    setError('');
    try {
      const params: Record<string, string | number | boolean> = { tanggal_mulai: startDate, tanggal_akhir: endDate };
      const selectedTypeId = prayerTypeParam(typeId);
      if (selectedTypeId) params.prayer_attendance_type_id = selectedTypeId;
      if (complexId) params.boarding_complex_id = complexId;
      if (roomId) params.boarding_room_id = roomId;
      if (status) params.status = status;
      const result = await api.rekapAbsensiSholat(params);
      const data = record(result);
      setRekapRows(rows(data.records));
      setSummary(record(data.summary));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rekap sholat gagal dimuat');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadMaster();
    void loadRekap();
  }, []);

  const columns: DataColumn<ApiRecord>[] = [
    { key: 'tanggal', header: 'Tanggal', render: (row) => text(row.tanggal) },
    { key: 'jenis', header: "Waktu Jama'ah", render: (row) => text(row.jenis_sholat) },
    { key: 'nama', header: 'Santri', render: (row) => <span className="font-extrabold">{text(row.nama)}</span> },
    { key: 'kelas', header: 'Kelas', render: (row) => text(row.kelas) },
    { key: 'pondok', header: 'Komplek/Kamar', render: (row) => `${text(row.komplek)} / ${text(row.kamar)}` },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge label={text(row.status_label ?? row.status)} tone={statusTone(text(row.status))} /> },
    { key: 'petugas', header: 'Petugas', render: (row) => text(row.petugas ?? row.diinput_oleh) }
  ];

  return (
    <div className="space-y-5">
      <Message error={error} />
      <section className="q-panel q-rekap-action-panel grid gap-3 p-4 sm:p-6 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_1.4fr_auto_auto]">
        <input className="q-input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        <input className="q-input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        <select className="q-input" value={typeId} onChange={(event) => setTypeId(Number(event.target.value))}>
          <option value={0}>Semua waktu jama'ah</option>
          {types.map((type) => <option key={num(type.id)} value={num(type.id)}>{text(type.name)}</option>)}
        </select>
        <select className="q-input" value={complexId} onChange={(event) => setComplexId(Number(event.target.value))}>
          <option value={0}>Semua Komplek</option>
          {complexes.map((complex) => <option key={num(complex.id)} value={num(complex.id)}>{text(complex.name)}</option>)}
        </select>
        <select className="q-input" value={roomId} onChange={(event) => setRoomId(Number(event.target.value))}>
          <option value={0}>Semua Kamar</option>
          {roomOptions.map((room) => <option key={num(room.id)} value={num(room.id)}>{text(room.name)}</option>)}
        </select>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari santri / kelas / petugas" />
        <button className="q-rekap-button rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white" onClick={() => void loadRekap()} type="button">
          Tampilkan
        </button>
        <button className="q-rekap-button flex items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold text-[#138F81]" onClick={() => exportPrayerRekapExcel(filtered, summary)} type="button" disabled={filtered.length === 0}>
          <Download size={17} /> Excel
        </button>
      </section>
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard title="M" value={num(summary.M)} subtitle="Masuk" icon={Check} tone="teal" />
        <StatCard title="I" value={num(summary.I)} subtitle="Izin" icon={ClipboardList} tone="orange" />
        <StatCard title="S" value={num(summary.S)} subtitle="Sakit" icon={X} tone="red" />
        <StatCard title="Kosong" value={num(summary.Kosong)} subtitle="Belum absen" icon={CalendarCheck} tone="blue" />
        <StatCard title="Hadir" value={`${num(summary.persentase_hadir)}%`} subtitle="Persentase" icon={BarChart3} tone="teal" />
      </div>
      <section className="q-panel p-4 sm:p-6">
        {isLoading ? <LoadingText text="Memuat rekap sholat..." /> : <DataTable rows={filtered} columns={columns} emptyText="Rekap sholat belum tersedia." minWidth="980px" />}
      </section>
    </div>
  );
}

function MadinRekap() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState('');
  const [rekapRows, setRekapRows] = useState<ApiRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setIsLoading(true);
    setError('');
    try {
      const result = await api.rekapAbsensi({ bulan: month, tahun: year });
      setRekapRows(rows(result.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rekap madin gagal dimuat');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rekapRows;
    return rekapRows.filter((row) => {
      const nama = String(record(row.siswa).nama ?? row.nama ?? '').toLowerCase();
      const nis = String(record(row.siswa).nis ?? row.nis ?? '').toLowerCase();
      const kelas = String(row.kelas ?? '').toLowerCase();
      const mapel = String(row.mapel ?? '').toLowerCase();
      const petugas = String(row.diinput_oleh ?? '').toLowerCase();
      return nama.includes(keyword) || nis.includes(keyword) || kelas.includes(keyword) || mapel.includes(keyword) || petugas.includes(keyword);
    });
  }, [rekapRows, search]);

  const columns: DataColumn<ApiRecord>[] = [
    { key: 'siswa', header: 'Siswa', render: (row) => <span className="font-extrabold">{text(record(row.siswa).nama ?? row.nama)}</span> },
    { key: 'kelas', header: 'Kelas', render: (row) => text(row.kelas) },
    { key: 'mapel', header: 'Mapel', render: (row) => text(row.mapel) },
    { key: 'hadir', header: 'Hadir', render: (row) => num(row.total_hadir) },
    { key: 'izin', header: 'Izin', render: (row) => num(row.total_izin) },
    { key: 'sakit', header: 'Sakit', render: (row) => num(row.total_sakit) },
    { key: 'alfa', header: 'Alfa', render: (row) => num(row.total_alfa) },
    { key: 'petugas', header: 'Petugas', render: (row) => text(row.diinput_oleh) }
  ];

  return (
    <div className="space-y-5">
      <Message error={error} />
      <section className="q-panel q-rekap-action-panel grid gap-3 p-4 sm:p-6 md:grid-cols-[1fr_1fr_2fr_auto_auto]">
        <input className="q-input" inputMode="numeric" value={month} onChange={(event) => setMonth(Number(event.target.value))} />
        <input className="q-input" inputMode="numeric" value={year} onChange={(event) => setYear(Number(event.target.value))} />
        <SearchInput value={search} onChange={setSearch} placeholder="Cari siswa / kelas / mapel" />
        <button className="q-rekap-button rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white" onClick={() => void load()} type="button">
          Tampilkan
        </button>
        <button className="q-rekap-button flex items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold text-[#138F81]" onClick={() => exportMadinRekapExcel(filtered, month, year)} type="button" disabled={filtered.length === 0}>
          <Download size={17} /> Excel
        </button>
      </section>
      <section className="q-panel p-4 sm:p-6">
        {isLoading ? <LoadingText text="Memuat rekap madin..." /> : <DataTable rows={filtered} columns={columns} emptyText="Rekap madin belum tersedia." />}
      </section>
    </div>
  );
}

function PrayerTypeCms() {
  const [items, setItems] = useState<ApiRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Aktif' | 'Nonaktif'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<ApiRecord | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: number; kind: 'toggle' | 'delete'; nextActive?: boolean } | null>(null);
  const [backendReady, setBackendReady] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError('');
    try {
      const result = await api.prayerAttendanceTypes();
      setItems(rows(result.data));
      setBackendReady(true);
    } catch (err) {
      setBackendReady(false);
      setItems(legacyPrayerTypes);
      if (!silent) {
        setNotice("Pengaturan waktu jama'ah menunggu backend terbaru. Setelah backend dideploy dan migration jalan, tambah/edit waktu jama'ah akan langsung tersimpan ke database pusat.");
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    // 1. Auto-refresh saat event app:data-updated dipicu
    const handleDataUpdate = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (!customEvt.detail || customEvt.detail.type === 'sholat' || customEvt.detail.type === 'all') {
        void load(true);
      }
    };
    window.addEventListener('app:data-updated', handleDataUpdate);

    // 2. Auto-refresh saat window fokus atau tab kembali aktif
    const handleFocus = () => void load(true);
    window.addEventListener('focus', handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // 3. Periodic Background Auto-Refresh (setiap 60 detik)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && form === null) {
        void load(true);
      }
    }, 60000);

    return () => {
      window.removeEventListener('app:data-updated', handleDataUpdate);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [load, form]);

  const activeCount = useMemo(() => items.filter((i) => i.is_active !== false).length, [items]);
  const inactiveCount = useMemo(() => items.filter((i) => i.is_active === false).length, [items]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (statusFilter === 'Aktif') {
      list = list.filter((i) => i.is_active !== false);
    } else if (statusFilter === 'Nonaktif') {
      list = list.filter((i) => i.is_active === false);
    }

    const kw = searchQuery.trim().toLowerCase();
    if (!kw) return list;
    return list.filter((i) => {
      const name = text(i.name).toLowerCase();
      const code = text(i.code).toLowerCase();
      const desc = text(i.description).toLowerCase();
      return name.includes(kw) || code.includes(kw) || desc.includes(kw);
    });
  }, [items, searchQuery, statusFilter]);


  async function runConfirmAction() {
    if (!confirmAction) return;
    setIsSaving(true);
    setError('');
    try {
      if (confirmAction.kind === 'toggle') {
        await api.updatePrayerAttendanceType(confirmAction.id, { is_active: confirmAction.nextActive === true });
        setNotice(confirmAction.nextActive ? "Waktu jama'ah berhasil diaktifkan." : "Waktu jama'ah berhasil dinonaktifkan.");
      } else {
        await api.deletePrayerAttendanceType(confirmAction.id);
        setNotice("Waktu jama'ah berhasil dihapus aman/dinonaktifkan.");
      }
      setConfirmAction(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aksi waktu jama'ah gagal diproses");
    } finally {
      setIsSaving(false);
    }
  }

  const columns: DataColumn<ApiRecord>[] = [
    {
      key: 'name',
      header: "Waktu Jama'ah",
      sortable: true,
      sortValue: (row) => String(row.name ?? ''),
      render: (row) => <span className="font-extrabold text-slate-800">{text(row.name)}</span>
    },
    {
      key: 'code',
      header: 'Kode',
      sortable: true,
      sortValue: (row) => String(row.code ?? ''),
      render: (row) => <span className="font-mono text-xs text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded">{text(row.code)}</span>
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (row) => (row.is_active !== false ? 1 : 0),
      render: (row) => <StatusBadge label={row.is_active === false ? 'Nonaktif' : 'Aktif'} tone={row.is_active === false ? 'neutral' : 'success'} />
    },

    {
      key: 'actions',
      header: 'Aksi',
      render: (row) => {
        const nextActive = row.is_active === false;
        return (
          <div className="flex gap-2">
            <button className="q-soft-action grid h-9 w-9 place-items-center rounded-xl bg-[#EAF1FF] text-[#2E86DE] disabled:opacity-50" onClick={() => setForm(row)} type="button" aria-label="Edit" disabled={!backendReady}>
              <Edit3 size={16} />
            </button>
            <button
              className="q-soft-action grid h-9 w-9 place-items-center rounded-xl bg-[#FFF3E0] text-[#E8590C] disabled:opacity-50"
              onClick={() => setConfirmAction({ id: num(row.id), kind: 'toggle', nextActive })}
              type="button"
              aria-label={nextActive ? 'Aktifkan' : 'Nonaktifkan'}
              disabled={!backendReady || num(row.id) <= 0}
              title={nextActive ? 'Aktifkan kembali' : 'Nonaktifkan sementara'}
            >
              <Power size={16} />
            </button>
            <button
              className="q-soft-action grid h-9 w-9 place-items-center rounded-xl bg-[#FDECEC] text-[#D63031] disabled:opacity-50"
              onClick={() => setConfirmAction({ id: num(row.id), kind: 'delete' })}
              type="button"
              aria-label="Hapus"
              disabled={!backendReady || num(row.id) <= 0}
              title="Hapus aman"
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      }
    }
  ];

  if (form !== null) {
    return (
      <ComplexSholatForm
        initialData={form.id ? form : null}
        onClose={() => {
          setForm(null);
          void load(true);
        }}
        onSave={() => {
          setForm(null);
          void load(true);
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <Message error={error} notice={notice} />

      {/* Header Banner */}
      <section className="q-panel flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white border border-slate-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#138F81]/10 text-[#138F81]">
              <Landmark size={20} />
            </div>
            <h2 className="text-xl font-extrabold text-[#2D3436]">Pengaturan Waktu Jama'ah Sholat</h2>
          </div>
          <p className="text-sm font-semibold text-[#636E72]">
            Subuh, Dhuhur, Ashar, Maghrib, Isya, atau sesi sholat khusus santri pondok.
          </p>
        </div>


        <button
          className="w-full sm:w-auto flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#138F81] px-5 text-sm font-extrabold text-white shadow-md shadow-[#138F81]/20 hover:brightness-105 transition-all disabled:opacity-60"
          onClick={() => setForm({ is_active: true, sort_order: items.length * 10 + 10 })}
          type="button"
          disabled={!backendReady}
          title={!backendReady ? "Deploy backend terbaru dulu agar route master waktu jama'ah tersedia." : undefined}
        >
          <Plus size={18} /> Tambah Waktu Sholat
        </button>
      </section>

      {/* Action & Filter Controls */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
        <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="flex-1 min-w-[200px]">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Cari waktu jama'ah (Subuh, Maghrib)..."
            />
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200 shrink-0 self-start sm:self-auto overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-800 shadow-xs ring-1 ring-black/5'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Semua ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('Aktif')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                statusFilter === 'Aktif'
                  ? 'bg-[#138F81] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#138F81]'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${statusFilter === 'Aktif' ? 'bg-white' : 'bg-emerald-500'}`} />
              Aktif ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('Nonaktif')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                statusFilter === 'Nonaktif'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${statusFilter === 'Nonaktif' ? 'bg-white' : 'bg-slate-400'}`} />
              Nonaktif ({inactiveCount})
            </button>
          </div>
        </div>

        <button
          className={`flex h-10 items-center justify-center gap-2 rounded-2xl bg-white px-3.5 text-xs font-extrabold text-[#138F81] border border-slate-200 shadow-xs hover:bg-slate-50 transition-colors shrink-0 ${
            isLoading ? 'animate-pulse' : ''
          }`}
          onClick={() => void load(true)}
          type="button"
          disabled={isLoading}
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </section>

      {/* Data Table */}
      <section className="q-table-container rounded-3xl bg-white p-4 shadow-sm md:p-6 lg:p-8">
        {isLoading ? (
          <LoadingText text="Memuat waktu jama'ah..." />
        ) : (
          <DataTable
            rows={filteredItems}
            columns={columns}
            defaultSortKey="order"
            defaultSortDirection="asc"
            emptyText={
              statusFilter === 'Aktif'
                ? "Tidak ada waktu jama'ah yang aktif."
                : statusFilter === 'Nonaktif'
                ? "Tidak ada waktu jama'ah yang nonaktif."
                : "Belum ada waktu jama'ah sholat."
            }
            mobileRender={(row) => {
              const nextActive = row.is_active === false;
              return (
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-black text-slate-800 leading-snug">{String(row.name || '-')}</p>
                      <p className="text-xs font-mono font-bold text-slate-400 mt-0.5">Kode: {String(row.code || '-')}</p>
                    </div>
                    <StatusBadge
                      label={row.is_active === false ? 'Nonaktif' : 'Aktif'}
                      tone={row.is_active === false ? 'neutral' : 'success'}
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      className="flex-1 rounded-xl bg-[#EAF1FF] py-2 text-xs font-extrabold text-[#2E86DE] hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
                      onClick={() => setForm(row)}
                      type="button"
                      disabled={!backendReady}
                    >
                      <Edit3 size={14} /> Edit
                    </button>
                    <button
                      className="flex-1 rounded-xl bg-[#FFF3E0] py-2 text-xs font-extrabold text-[#E8590C] hover:bg-orange-100 transition-colors flex items-center justify-center gap-1.5"
                      onClick={() => setConfirmAction({ id: num(row.id), kind: 'toggle', nextActive })}
                      type="button"
                      disabled={!backendReady || num(row.id) <= 0}
                    >
                      <Power size={14} /> {nextActive ? 'Aktifkan' : 'Nonaktif'}
                    </button>
                    <button
                      className="rounded-xl bg-[#FDECEC] p-2 text-[#D63031] hover:bg-rose-100 transition-colors"
                      onClick={() => setConfirmAction({ id: num(row.id), kind: 'delete' })}
                      type="button"
                      disabled={!backendReady || num(row.id) <= 0}
                      title="Hapus"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              );
            }}
          />
        )}
      </section>
      {confirmAction ? (
        <ConfirmDialog
          title={confirmAction.kind === 'delete' ? "Hapus Waktu Jama'ah" : confirmAction.nextActive ? "Aktifkan Waktu Jama'ah" : "Nonaktifkan Waktu Jama'ah"}
          message={
            confirmAction.kind === 'delete'
              ? "Data akan dihapus aman/dinonaktifkan dari pilihan baru. Riwayat absensi lama tetap dijaga."
              : confirmAction.nextActive
                ? "Waktu jama'ah akan muncul kembali pada input absensi."
                : "Waktu jama'ah tidak akan muncul pada input baru, tetapi riwayat lama tetap aman."
          }
          tone="danger"
          isBusy={isSaving}
          confirmLabel={confirmAction.kind === 'delete' ? 'Hapus' : confirmAction.nextActive ? 'Aktifkan' : 'Nonaktifkan'}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => void runConfirmAction()}
        />
      ) : null}
    </div>
  );
}

function AttendanceRows<TStatus extends string>({
  isLoading,
  rows: studentRows,
  emptyText,
  statusMap,
  notesMap = {},
  labels,
  options,
  onChange,
  onNoteChange
}: {
  isLoading: boolean;
  rows: ApiRecord[];
  emptyText: string;
  statusMap: Record<number, TStatus>;
  notesMap?: Record<number, string>;
  labels: Record<string, string>;
  options: TStatus[];
  onChange: (id: number, status: TStatus) => void;
  onNoteChange?: (id: number, note: string) => void;
}) {
  if (isLoading) return <LoadingText text="Memuat daftar..." />;
  if (studentRows.length === 0) return <div className="q-card px-4 py-8 text-center text-sm font-bold text-[#636E72]">{emptyText}</div>;

  const presetsMap: Record<string, string[]> = {
    Sakit: [
      'Sakit di Kamar / Asrama',
      'Dirawat di Poskestren / UKS',
      'Dirawat di Rumah Sakit / Puskesmas',
      'Pulang ke Rumah (Izin Sakit)',
      'Demam / Flu / Batuk',
      'Kecapekan / Istirahat'
    ],
    S: [
      'Sakit di Kamar / Asrama',
      'Dirawat di Poskestren / UKS',
      'Dirawat di Rumah Sakit / Puskesmas',
      'Pulang ke Rumah (Izin Sakit)',
      'Demam / Flu / Batuk',
      'Kecapekan / Istirahat'
    ],
    Izin: [
      'Izin Pulang ke Rumah (Keluarga)',
      'Izin Acara / Hajat Keluarga',
      'Izin Mengikuti Kegiatan Pondok / Lomba',
      'Izin Piket Pondok / Dapur',
      'Izin Mengurus Dokumen / Keperluan'
    ],
    I: [
      'Izin Pulang ke Rumah (Keluarga)',
      'Izin Acara / Hajat Keluarga',
      'Izin Mengikuti Kegiatan Pondok / Lomba',
      'Izin Piket Pondok / Dapur',
      'Izin Mengurus Dokumen / Keperluan'
    ],
    Alfa: [
      'Tanpa Keterangan (Tidak Masuk)',
      'Tertidur di Kamar',
      'Terlambat Lebih dari 30 Menit',
      'Bolos KBM / Menghilang'
    ],
    A: [
      'Tanpa Keterangan (Tidak Masuk)',
      'Tertidur di Kamar',
      'Terlambat Lebih dari 30 Menit',
      'Bolos KBM / Menghilang'
    ]
  };

  return (
    <section className="space-y-3">
      {studentRows.map((student, index) => {
        const id = num(student.id);
        const status = statusMap[id] ?? ('' as TStatus);
        const statusStr = String(status);
        const isNotPresent = Boolean(status) && statusStr !== 'Hadir' && statusStr !== 'M' && statusStr !== 'Masuk' && statusStr !== 'H';
        const currentNote = notesMap[id] || '';
        const presets = presetsMap[statusStr] || [];

        return (
          <div key={id} className="q-card flex flex-col p-4">
            <div className="flex flex-wrap items-center gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#E8F7F3] text-sm font-extrabold text-[#138F81]">{index + 1}</span>
              <div className="min-w-[220px] flex-1">
                <p className="text-base font-extrabold text-[#2D3436]">{text(student.nama ?? student.name)}</p>
                <p className="text-sm font-semibold text-[#636E72]">{text(student.kelas ?? student.class_name)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge label={labels[String(status)] ?? 'Belum'} tone={statusTone(status)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {options.map((option) => (
                  <button
                    key={option}
                    className={`grid h-12 min-w-12 place-items-center rounded-2xl px-3 text-sm font-extrabold transition ${
                      status === option ? 'bg-[#138F81] text-white' : 'bg-[#F7FBFC] text-[#138F81] hover:bg-[#E1EFF7]'
                    } ${option === 'Izin' || option === 'I' ? (status === option ? '!bg-[#E8590C]' : '') : ''} ${option === 'Sakit' || option === 'S' ? (status === option ? '!bg-[#D63031]' : '') : ''}`}
                    onClick={() => onChange(id, option)}
                    type="button"
                  >
                    {String(option).slice(0, 1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Dropdown & Input Alasan jika Izin / Sakit / Alfa */}
            {isNotPresent && onNoteChange && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 animate-in fade-in duration-200">
                <span className="text-xs font-bold text-slate-500 shrink-0">
                  Alasan {labels[statusStr] || statusStr}:
                </span>

                {presets.length > 0 && (
                  <select
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-[#138F81] shrink-0 max-w-[220px]"
                    value={presets.includes(currentNote) ? currentNote : (currentNote ? '__custom__' : '')}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__custom__') {
                        if (presets.includes(currentNote)) onNoteChange(id, '');
                      } else {
                        onNoteChange(id, val);
                      }
                    }}
                  >
                    <option value="">-- Pilih Alasan Cepat (Opsional) --</option>
                    {presets.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                    <option value="__custom__">✏️ Ketik Alasan Sendiri...</option>
                  </select>
                )}

                <input
                  type="text"
                  placeholder={`Ketik keterangan ${labels[statusStr] || statusStr} (opsional)...`}
                  value={currentNote}
                  onChange={(e) => onNoteChange(id, e.target.value)}
                  className="flex-1 min-w-[160px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#138F81]"
                />
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function RefreshButton({ isLoading, onClick }: { isLoading: boolean; onClick: () => void }) {
  return (
    <button
      className={`q-refresh-button flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-[#138F81] ${isLoading ? 'is-loading' : ''}`}
      onClick={onClick}
      type="button"
      disabled={isLoading}
      aria-busy={isLoading}
    >
      <RefreshCw className="q-refresh-icon" size={17} />
      {isLoading ? 'Menyegarkan...' : 'Refresh'}
    </button>
  );
}

function SaveBar({
  isSaving,
  disabled,
  primaryLabel,
  onReset,
  onCancel,
  onSave
}: {
  isSaving: boolean;
  disabled: boolean;
  primaryLabel: string;
  onReset: () => void;
  onCancel?: () => void;
  onSave: () => void;
}) {
  return (
    <div className="q-panel q-save-bar flex flex-wrap items-center justify-end gap-3 p-4">
      <button className="q-soft-action q-save-secondary min-h-12 rounded-2xl bg-white px-5 text-sm font-extrabold text-[#636E72]" onClick={onReset} type="button" disabled={isSaving}>
        Reset Pilihan
      </button>
      {onCancel ? (
        <button className="q-soft-action q-save-secondary min-h-12 rounded-2xl bg-[#FDECEC] px-5 text-sm font-extrabold text-[#D63031]" onClick={onCancel} type="button" disabled={isSaving}>
          Batalkan
        </button>
      ) : null}
      <button className="q-soft-action q-save-primary flex min-h-12 items-center gap-2 rounded-2xl bg-[#138F81] px-6 text-sm font-extrabold text-white shadow-lg shadow-[#138F81]/25 disabled:opacity-60" onClick={onSave} type="button" disabled={isSaving || disabled}>
        <Save size={18} />
        {isSaving ? 'Menyimpan...' : primaryLabel}
      </button>
    </div>
  );
}

function Message({ error, notice }: { error?: string; notice?: string }) {
  return (
    <>
      {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
      {notice ? <div className="rounded-2xl bg-[#E8F7F3] px-4 py-3 text-sm font-bold text-[#138F81]">{notice}</div> : null}
    </>
  );
}

function LoadingText({ text: label }: { text: string }) {
  return <div className="q-card px-4 py-8 text-center text-sm font-bold text-[#636E72]">{label}</div>;
}
