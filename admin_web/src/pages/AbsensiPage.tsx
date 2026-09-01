import {
  Activity,
  BarChart3,
  BookMarked,
  BookOpenCheck,
  CalendarCheck,
  Check,
  ClipboardList,
  Download,
  Edit3,
  Landmark,
  Plus,
  Power,
  RefreshCw,
  Save,
  Settings,
  Trash2,
  TrendingUp,
  X
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
  | 'jenis-sholat';

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
  { id: 'rekap-sholat', label: 'Rekap Sholat' },
  { id: 'madin', label: 'Rekap Madin' },
  { id: 'jenis-sholat', label: "Waktu Jama'ah" }
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
  return new Date().toISOString().slice(0, 10);
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
      <section className="q-page-heading">
        <p className="text-sm font-bold text-[#636E72]">{headerInfo.badge}</p>
        <h1 className="text-3xl font-extrabold text-[#2D3436] flex items-center gap-2.5">
          <HeaderIcon className="text-[#138F81]" size={30} />
          {headerInfo.title}
        </h1>
        <p className="text-sm font-semibold text-[#636E72]">{headerInfo.desc}</p>
      </section>

      {/* Dynamic Tab Navigation Based on Role */}
      {isGuru ? (
        // Guru: HANYA TAB INPUT (Tanpa Rekap)
        <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
          <button
            type="button"
            onClick={() => handleTabSelect('madin-input')}
            className={`px-4 py-2 text-xs font-extrabold rounded-xl transition ${
              currentTab === 'madin-input'
                ? 'bg-[#138F81] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            🕌 Input Presensi Madin
          </button>
          {session?.hak_akses?.absen_sholat === true && (
            <button
              type="button"
              onClick={() => handleTabSelect('sholat')}
              className={`px-4 py-2 text-xs font-extrabold rounded-xl transition ${
                currentTab === 'sholat'
                  ? 'bg-[#138F81] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              🕋 Input Presensi Sholat
            </button>
          )}
          {session?.hak_akses?.absen_ngaji === true && (
            <button
              type="button"
              onClick={() => handleTabSelect('ngaji')}
              className={`px-4 py-2 text-xs font-extrabold rounded-xl transition ${
                currentTab === 'ngaji'
                  ? 'bg-[#138F81] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              📖 Input Presensi Ngaji
            </button>
          )}
        </div>
      ) : isKepalaSekolah ? (
        // Kepala Sekolah: HANYA MONITORING & REKAP (Tanpa Input)
        <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
          <button
            type="button"
            onClick={() => handleTabSelect('log-realtime')}
            className={`px-4 py-2 text-xs font-extrabold rounded-xl transition ${
              currentTab === 'log-realtime'
                ? 'bg-[#138F81] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            ⚡ Log Pemantauan Realtime
          </button>
          <button
            type="button"
            onClick={() => handleTabSelect('madin')}
            className={`px-4 py-2 text-xs font-extrabold rounded-xl transition ${
              currentTab === 'madin'
                ? 'bg-[#138F81] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            📊 Rekap Presensi Madin
          </button>
          <button
            type="button"
            onClick={() => handleTabSelect('rekap-sholat')}
            className={`px-4 py-2 text-xs font-extrabold rounded-xl transition ${
              currentTab === 'rekap-sholat'
                ? 'bg-[#138F81] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            📈 Rekap Presensi Sholat
          </button>
          <button
            type="button"
            onClick={() => handleTabSelect('rekap-ngaji')}
            className={`px-4 py-2 text-xs font-extrabold rounded-xl transition ${
              currentTab === 'rekap-ngaji'
                ? 'bg-[#138F81] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            📚 Rekap Presensi Ngaji
          </button>
        </div>
      ) : (
        // Admin Utama: Full Access Semua Tab
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto q-scrollbar">
          <button
            type="button"
            onClick={() => handleTabSelect('log-realtime')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-xl transition shrink-0 ${
              currentTab === 'log-realtime'
                ? 'bg-[#138F81] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            ⚡ Log Realtime
          </button>
          <button
            type="button"
            onClick={() => handleTabSelect('madin-input')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-xl transition shrink-0 ${
              currentTab === 'madin-input'
                ? 'bg-[#138F81] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            🕌 Form Madin
          </button>
          <button
            type="button"
            onClick={() => handleTabSelect('sholat')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-xl transition shrink-0 ${
              currentTab === 'sholat'
                ? 'bg-[#138F81] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            🕋 Form Sholat
          </button>
          <button
            type="button"
            onClick={() => handleTabSelect('ngaji')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-xl transition shrink-0 ${
              currentTab === 'ngaji'
                ? 'bg-[#138F81] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            📖 Form Ngaji
          </button>
          <button
            type="button"
            onClick={() => handleTabSelect('madin')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-xl transition shrink-0 ${
              currentTab === 'madin'
                ? 'bg-[#138F81] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            📊 Rekap Madin
          </button>
          <button
            type="button"
            onClick={() => handleTabSelect('rekap-sholat')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-xl transition shrink-0 ${
              currentTab === 'rekap-sholat'
                ? 'bg-[#138F81] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            📈 Rekap Sholat
          </button>
          <button
            type="button"
            onClick={() => handleTabSelect('rekap-ngaji')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-xl transition shrink-0 ${
              currentTab === 'rekap-ngaji'
                ? 'bg-[#138F81] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            📚 Rekap Ngaji
          </button>
          <button
            type="button"
            onClick={() => handleTabSelect('jenis-sholat')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-xl transition shrink-0 ${
              currentTab === 'jenis-sholat'
                ? 'bg-[#138F81] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            ⚙️ Waktu Sholat
          </button>
        </div>
      )}

      {currentTab === 'log-realtime' ? <RealtimeAttendanceLog /> : null}
      {currentTab === 'madin-input' ? <MadinInput initialTarget={initialTarget} /> : null}
      {currentTab === 'sholat' ? <PrayerInput /> : null}
      {currentTab === 'ngaji' ? <NgajiKitabSection initialSection="input" /> : null}
      {currentTab === 'rekap-ngaji' ? <NgajiKitabSection initialSection="rekap" /> : null}
      {currentTab === 'rekap-sholat' ? <PrayerRekap /> : null}
      {currentTab === 'madin' ? <MadinRekap /> : null}
      {currentTab === 'jenis-sholat' ? <PrayerTypeCms /> : null}
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
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadMaster() {
    setIsLoading(true);
    setError('');
    try {
      const [classResult, mapelResult, jadwalResult] = await Promise.all([api.classes(), api.mataPelajaran(), api.jadwal()]);
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

  async function loadStudents(nextClassId = classId) {
    if (!nextClassId) {
      setStudents([]);
      setStatuses({});
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const result = await api.siswa({ class_id: nextClassId, status: 'Aktif' });
      const nextStudents = rows(result.data);
      setStudents(nextStudents);
      const initial: Record<number, MadinStatus> = {};
      nextStudents.forEach((student) => {
        const id = num(student.id);
        if (id) initial[id] = '';
      });
      setStatuses(initial);
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
    void loadStudents(classId);
  }, [classId]);

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
      setNotice(text(result.message, 'Absensi Madin berhasil disimpan.'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Absensi Madin gagal disimpan');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Message error={error} notice={notice} />
      <section className="q-panel grid gap-3 p-4 sm:p-6 md:grid-cols-5">
        <input className="q-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <select className="q-input" value={classId} onChange={(event) => setClassId(Number(event.target.value))}>
          <option value={0}>Pilih kelas</option>
          {classes.map((item) => (
            <option key={num(item.id)} value={num(item.id)}>{text(item.name ?? item.nama)}</option>
          ))}
        </select>
        <select className="q-input" value={mapelId} onChange={(event) => setMapelId(Number(event.target.value))}>
          <option value={0}>Pilih mapel</option>
          {mapel.map((item) => (
            <option key={num(item.id)} value={num(item.id)}>{text(item.nama ?? item.name)}</option>
          ))}
        </select>
        <select className="q-input" value={jadwalId} onChange={(event) => setJadwalId(Number(event.target.value))}>
          <option value={0}>Pilih jadwal</option>
          {jadwal.map((item) => (
            <option key={num(item.id)} value={num(item.id)}>{text(item.hari ?? item.day ?? item.nama)} {text(item.jam_mulai ?? item.start_time, '')}</option>
          ))}
        </select>
        <RefreshButton isLoading={isLoading} onClick={() => void loadStudents(classId)} />
      </section>
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard title="Hadir" value={counts.Hadir} subtitle="Status H" icon={Check} tone="teal" />
        <StatCard title="Izin" value={counts.Izin} subtitle="Status I" icon={ClipboardList} tone="orange" />
        <StatCard title="Sakit" value={counts.Sakit} subtitle="Status S" icon={X} tone="red" />
        <StatCard title="Alfa" value={counts.Alfa} subtitle="Status A" icon={CalendarCheck} tone="blue" />
        <StatCard title="Belum" value={counts.Belum} subtitle="Belum dipilih" icon={BookOpenCheck} tone="blue" />
      </div>
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
      <SaveBar
        isSaving={isSaving}
        disabled={students.length === 0}
        primaryLabel="Simpan Absensi Madin"
        onReset={() => setStatuses(Object.fromEntries(students.map((student) => [num(student.id), ''])))}
        onSave={() => void save()}
      />
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<ApiRecord | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: number; kind: 'toggle' | 'delete'; nextActive?: boolean } | null>(null);
  const [backendReady, setBackendReady] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setIsLoading(true);
    setError('');
    try {
      const result = await api.prayerAttendanceTypes();
      setItems(rows(result.data));
      setBackendReady(true);
    } catch (err) {
      setBackendReady(false);
      setItems(legacyPrayerTypes);
      setNotice("Pengaturan waktu jama'ah menunggu backend terbaru. Setelah backend dideploy dan migration jalan, tambah/edit waktu jama'ah akan langsung tersimpan ke database pusat.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!form) return;
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        name: text(form.name, ''),
        code: text(form.code, '').toLowerCase().replace(/\s+/g, '_'),
        description: text(form.description, ''),
        is_active: form.is_active !== false,
        sort_order: num(form.sort_order)
      };
      if (num(form.id)) {
        await api.updatePrayerAttendanceType(num(form.id), payload);
      } else {
        await api.createPrayerAttendanceType(payload);
      }
      setForm(null);
      setNotice("Waktu jama'ah berhasil disimpan.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Waktu jama'ah gagal disimpan");
    } finally {
      setIsSaving(false);
    }
  }

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
    { key: 'name', header: "Waktu Jama'ah", render: (row) => <span className="font-extrabold">{text(row.name)}</span> },
    { key: 'code', header: 'Kode', render: (row) => text(row.code) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge label={row.is_active === false ? 'Nonaktif' : 'Aktif'} tone={row.is_active === false ? 'neutral' : 'success'} /> },
    { key: 'order', header: 'Urutan Tampil', render: (row) => num(row.sort_order) },
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

  return (
    <div className="space-y-5">
      <Message error={error} notice={notice} />
      <section className="q-panel flex flex-wrap items-center justify-between gap-3 p-4 sm:p-6">
        <div>
          <h2 className="text-xl font-extrabold text-[#2D3436]">Pengaturan Waktu Jama'ah Sholat</h2>
          <p className="text-sm font-semibold text-[#636E72]">Subuh, Maghrib, Isya, atau tambahan lain tetap memakai ID master database.</p>
          <p className="mt-1 text-xs font-bold text-[#138F81]">Urutan tampil: angka kecil muncul lebih dulu di pilihan absensi.</p>
        </div>
        <button
          className="flex min-h-12 items-center gap-2 rounded-2xl bg-[#138F81] px-5 text-sm font-extrabold text-white disabled:opacity-60"
          onClick={() => setForm({ is_active: true, sort_order: items.length * 10 + 10 })}
          type="button"
          disabled={!backendReady}
          title={!backendReady ? "Deploy backend terbaru dulu agar route master waktu jama'ah tersedia." : undefined}
        >
          <Plus size={18} /> Tambah Waktu
        </button>
      </section>
      <section className="q-panel p-4 sm:p-6">
        {isLoading ? <LoadingText text="Memuat waktu jama'ah..." /> : <DataTable rows={items} columns={columns} emptyText="Belum ada waktu jama'ah sholat." />}
      </section>
      {form ? (
        <ModalForm
          title={num(form.id) ? "Edit Waktu Jama'ah" : "Tambah Waktu Jama'ah"}
          onClose={() => setForm(null)}
          footer={
            <button className="min-h-12 w-full rounded-2xl bg-[#138F81] text-sm font-extrabold text-white disabled:opacity-60" onClick={() => void save()} disabled={isSaving} type="button">
              {isSaving ? 'Menyimpan...' : "Simpan Waktu Jama'ah"}
            </button>
          }
        >
          <div className="grid gap-4">
            <input className="q-input" value={text(form.name, '')} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nama, contoh: Subuh" />
            <input className="q-input" value={text(form.code, '')} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="Kode, contoh: subuh" />
            <textarea className="q-input min-h-24 py-3" value={text(form.description, '')} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Keterangan opsional" />
            <label className="grid gap-2">
              <span className="text-xs font-extrabold text-[#636E72]">Urutan tampil</span>
              <input className="q-input" inputMode="numeric" value={num(form.sort_order)} onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })} placeholder="Contoh: 10, 20, 30" />
              <span className="text-xs font-bold text-[#87939A]">Angka kecil tampil lebih dulu pada pilihan waktu jama'ah.</span>
            </label>
            <label className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-[#2D3436]">
              Aktif
              <input type="checkbox" checked={form.is_active !== false} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
            </label>
          </div>
        </ModalForm>
      ) : null}
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
