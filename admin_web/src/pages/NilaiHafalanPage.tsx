import {
  Award,
  BookCheck,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Download,
  Edit3,
  FileSpreadsheet,
  Filter,
  GraduationCap,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trophy,
  Trash2,
  UsersRound
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ComplexHafalanForm } from '../components/ComplexHafalanForm';
import { ComplexNilaiForm } from '../components/ComplexNilaiForm';
import { ConfirmDialog } from '../components/ConfirmDialog';

import { DataTable, type DataColumn } from '../components/DataTable';
import { ModalForm } from '../components/ModalForm';
import { SearchInput } from '../components/SearchInput';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { api, type ApiRecord } from '../services/api';
import { exportRowsExcel } from '../utils/importTemplates';

type TabKey = 'nilai' | 'hafalan' | 'ranking';

interface NilaiFormState {
  id?: number;
  siswa_id: string;
  mapel_id: string;
  jenis_ujian: string;
  nilai: string;
  keterangan: string;
  academic_year_id: string;
}

interface HafalanFormState {
  id?: number;
  siswa_id: string;
  juz: string;
  surah: string;
  status: string;
  tanggal_setor: string;
  nilai_hafalan: string;
  keterangan: string;
  academic_year_id: string;
}

function text(value: unknown, fallback = '-'): string {
  const result = String(value ?? '').trim();
  return result || fallback;
}

function num(value: unknown, fallback = 0): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function record(value: unknown): ApiRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ApiRecord) : {};
}

function list(value: unknown): ApiRecord[] {
  if (Array.isArray(value)) return value as ApiRecord[];
  const data = record(value).data;
  return Array.isArray(data) ? (data as ApiRecord[]) : [];
}

function scoreTone(scoreVal: number): 'success' | 'warning' | 'danger' | 'info' {
  if (scoreVal >= 85) return 'success';
  if (scoreVal >= 75) return 'info';
  if (scoreVal >= 65) return 'warning';
  return 'danger';
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const normalized = status.toLowerCase();
  if (['selesai', 'lunas', 'a', 'b', 'mutqin', 'mumtaz'].includes(normalized)) return 'success';
  if (['proses', 'c', 'jayyid'].includes(normalized)) return 'warning';
  if (['belum', 'd', 'e', 'mengulang'].includes(normalized)) return 'danger';
  return 'info';
}

function formatDateIndo(dateStr: unknown): string {
  if (!dateStr) return '-';
  const d = new Date(String(dateStr));
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(d);
}

export function NilaiHafalanPage() {
  const { session } = useAuth();
  const isMadrasah = session?.role === 'admin' && String(session?.admin_type || '').toLowerCase() === 'madrasah';

  const [activeTab, setActiveTab] = useState<TabKey>('nilai');
  const [nilaiRows, setNilaiRows] = useState<ApiRecord[]>([]);
  const [hafalanRows, setHafalanRows] = useState<ApiRecord[]>([]);
  const [students, setStudents] = useState<ApiRecord[]>([]);
  const [mapelRows, setMapelRows] = useState<ApiRecord[]>([]);
  const [academicRows, setAcademicRows] = useState<ApiRecord[]>([]);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('Semua');
  const [selectedMapel, setSelectedMapel] = useState('Semua');
  const [selectedJenisUjian, setSelectedJenisUjian] = useState('Semua');
  const [selectedStatusHafalan, setSelectedStatusHafalan] = useState('Semua');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [nilaiForm, setNilaiForm] = useState<NilaiFormState | null>(null);
  const [hafalanForm, setHafalanForm] = useState<HafalanFormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: TabKey; row: ApiRecord } | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError('');
    setNotice('');
    try {
      const [nilaiResult, hafalanResult, siswaResult, mapelResult, academicResult] = await Promise.all([
        api.nilai().catch(() => ({ success: true, data: [] })),
        api.hafalan().catch(() => ({ success: true, data: [] })),
        api.siswa({ status: 'Aktif' }).catch(() => ({ success: true, data: [] })),
        api.mataPelajaran({ status: 'Aktif' }).catch(() => ({ success: true, data: [] })),
        api.academicPeriods().catch(() => ({ success: true, data: [] }))
      ]);
      setNilaiRows(list(nilaiResult.data));
      setHafalanRows(list(hafalanResult.data));
      setStudents(list(siswaResult.data));
      setMapelRows(list(mapelResult.data));
      setAcademicRows(list(academicResult.data));
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Data nilai dan hafalan gagal dimuat.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    // 1. Auto-refresh saat event app:data-updated dipicu
    const handleDataUpdate = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (!customEvt.detail || customEvt.detail.type === 'nilai' || customEvt.detail.type === 'hafalan' || customEvt.detail.type === 'all') {
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

    // 3. Periodic Background Auto-Refresh (setiap 15 detik)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && nilaiForm === null && hafalanForm === null) {
        void load(true);
      }
    }, 15000);

    return () => {
      window.removeEventListener('app:data-updated', handleDataUpdate);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [load, nilaiForm, hafalanForm]);


  const activeAcademic = useMemo(() => {
    return academicRows.find((row) => row.is_active === true || text(row.status).toLowerCase() === 'aktif') ?? academicRows[0] ?? {};
  }, [academicRows]);

  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.kelas) set.add(String(s.kelas));
    });
    return Array.from(set).sort();
  }, [students]);

  const filteredNilai = useMemo(() => {
    return nilaiRows.filter((row) => {
      const siswa = record(row.siswa);
      const mapel = record(row.mata_pelajaran);
      const nama = String(siswa.nama ?? row.siswa_nama ?? row.nama_siswa ?? '').toLowerCase();
      const nis = String(siswa.nis ?? row.nis ?? '').toLowerCase();
      const kelas = String(siswa.kelas ?? row.kelas ?? '');
      const mapelNama = String(mapel.nama ?? row.mapel_nama ?? row.nama_mapel ?? '');
      const jenis = String(row.jenis_ujian ?? '');
      const penilai = String(row.penilai_nama ?? record(row.user).name ?? '').toLowerCase();

      if (selectedClass !== 'Semua' && kelas !== selectedClass) return false;
      if (selectedMapel !== 'Semua' && mapelNama !== selectedMapel) return false;
      if (selectedJenisUjian !== 'Semua' && jenis !== selectedJenisUjian) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        nama.includes(q) ||
        nis.includes(q) ||
        mapelNama.toLowerCase().includes(q) ||
        jenis.toLowerCase().includes(q) ||
        penilai.includes(q)
      );
    });
  }, [nilaiRows, search, selectedClass, selectedMapel, selectedJenisUjian]);

  const filteredHafalan = useMemo(() => {
    return hafalanRows.filter((row) => {
      const siswa = record(row.siswa);
      const nama = String(siswa.nama ?? row.nama_siswa ?? '').toLowerCase();
      const nis = String(siswa.nis ?? row.nis ?? '').toLowerCase();
      const kelas = String(siswa.kelas ?? row.kelas ?? '');
      const surah = String(row.nama_surah ?? row.surah ?? '').toLowerCase();
      const juz = String(row.juz ?? '').toLowerCase();
      const status = String(row.status ?? '');
      const pembina = String(record(row.pembina).name ?? row.nama_pembina ?? row.penguji ?? '').toLowerCase();

      if (selectedClass !== 'Semua' && kelas !== selectedClass) return false;
      if (selectedStatusHafalan !== 'Semua' && status.toLowerCase() !== selectedStatusHafalan.toLowerCase()) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        nama.includes(q) ||
        nis.includes(q) ||
        surah.includes(q) ||
        juz.includes(q) ||
        status.toLowerCase().includes(q) ||
        pembina.includes(q)
      );
    });
  }, [hafalanRows, search, selectedClass, selectedStatusHafalan]);

  const stats = useMemo(() => {
    const totalNilai = nilaiRows.length;
    const avgNilai = totalNilai > 0 ? Math.round(nilaiRows.reduce((sum, r) => sum + num(r.nilai), 0) / totalNilai) : 0;
    const totalHafalan = hafalanRows.length;
    const mutqinHafalan = hafalanRows.filter((h) => ['selesai', 'mutqin', 'mumtaz'].includes(String(h.status).toLowerCase())).length;

    return { totalNilai, avgNilai, totalHafalan, mutqinHafalan };
  }, [nilaiRows, hafalanRows]);

  // Ranking calculation
  const topStudentsByScore = useMemo(() => {
    const studentMap = new Map<string, { nama: string; nis: string; kelas: string; scores: number[] }>();
    nilaiRows.forEach((row) => {
      const siswa = record(row.siswa);
      const nama = String(siswa.nama ?? row.siswa_nama ?? 'Santri');
      const nis = String(siswa.nis ?? row.nis ?? '-');
      const kelas = String(siswa.kelas ?? row.kelas ?? '-');
      const score = num(row.nilai);
      if (!studentMap.has(nama)) {
        studentMap.set(nama, { nama, nis, kelas, scores: [] });
      }
      studentMap.get(nama)?.scores.push(score);
    });

    return Array.from(studentMap.values())
      .map((item) => {
        const avg = item.scores.reduce((a, b) => a + b, 0) / item.scores.length;
        return { ...item, average: Math.round(avg * 10) / 10, totalUjian: item.scores.length };
      })
      .sort((a, b) => b.average - a.average)
      .slice(0, 10);
  }, [nilaiRows]);

  const topStudentsByHafalan = useMemo(() => {
    const studentMap = new Map<string, { nama: string; nis: string; kelas: string; setoranCount: number; mutqinCount: number }>();
    hafalanRows.forEach((row) => {
      const siswa = record(row.siswa);
      const nama = String(siswa.nama ?? row.nama_siswa ?? 'Santri');
      const nis = String(siswa.nis ?? row.nis ?? '-');
      const kelas = String(siswa.kelas ?? row.kelas ?? '-');
      const isMutqin = ['selesai', 'mutqin', 'mumtaz'].includes(String(row.status).toLowerCase());

      if (!studentMap.has(nama)) {
        studentMap.set(nama, { nama, nis, kelas, setoranCount: 0, mutqinCount: 0 });
      }
      const entry = studentMap.get(nama);
      if (entry) {
        entry.setoranCount += 1;
        if (isMutqin) entry.mutqinCount += 1;
      }
    });

    return Array.from(studentMap.values())
      .sort((a, b) => b.mutqinCount - a.mutqinCount || b.setoranCount - a.setoranCount)
      .slice(0, 10);
  }, [hafalanRows]);

  function openNilaiForm(row?: ApiRecord) {
    const siswa = record(row?.siswa);
    const mapel = record(row?.mata_pelajaran);
    setNilaiForm({
      id: row?.id ? num(row.id) : undefined,
      siswa_id: text(row?.siswa_id ?? siswa.id, ''),
      mapel_id: text(row?.mapel_id ?? mapel.id, ''),
      jenis_ujian: text(row?.jenis_ujian, 'Harian'),
      nilai: text(row?.nilai, ''),
      keterangan: text(row?.keterangan, ''),
      academic_year_id: text(row?.academic_year_id ?? activeAcademic.id, '')
    });
  }

  function openHafalanForm(row?: ApiRecord) {
    const siswa = record(row?.siswa);
    setHafalanForm({
      id: row?.id ? num(row.id) : undefined,
      siswa_id: text(row?.siswa_id ?? siswa.id, ''),
      juz: text(row?.juz, ''),
      surah: text(row?.surah, ''),
      status: text(row?.status, 'Proses'),
      tanggal_setor: text(row?.tanggal_setor, new Date().toISOString().slice(0, 10)),
      nilai_hafalan: text(row?.nilai_hafalan, ''),
      keterangan: text(row?.keterangan, ''),
      academic_year_id: text(row?.academic_year_id ?? activeAcademic.id, '')
    });
  }

  async function saveNilai() {
    if (!nilaiForm || !session) return;
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const payload: ApiRecord = {
        user_id: session.id,
        siswa_id: Number(nilaiForm.siswa_id),
        mapel_id: Number(nilaiForm.mapel_id),
        jenis_ujian: nilaiForm.jenis_ujian,
        nilai: Number(nilaiForm.nilai),
        keterangan: nilaiForm.keterangan,
        academic_year_id: nilaiForm.academic_year_id ? Number(nilaiForm.academic_year_id) : undefined,
        tahun_ajaran: text(activeAcademic.name ?? activeAcademic.tahun_ajaran, ''),
        semester: text(activeAcademic.active_semester ?? activeAcademic.semester, '')
      };
      if (nilaiForm.id) {
        await api.updateNilai(nilaiForm.id, payload);
      } else {
        await api.createNilai(payload);
      }
      setNilaiForm(null);
      await load();
      setNotice('Data nilai berhasil disimpan.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data nilai gagal disimpan.');
    } finally {
      setIsSaving(false);
    }
  }

  async function saveHafalan() {
    if (!hafalanForm || !session) return;
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const payload: ApiRecord = {
        user_id: session.id,
        siswa_id: Number(hafalanForm.siswa_id),
        juz: hafalanForm.juz,
        surah: hafalanForm.surah,
        status: hafalanForm.status,
        tanggal_setor: hafalanForm.tanggal_setor,
        nilai_hafalan: hafalanForm.nilai_hafalan,
        keterangan: hafalanForm.keterangan,
        academic_year_id: hafalanForm.academic_year_id ? Number(hafalanForm.academic_year_id) : undefined,
        tahun_ajaran: text(activeAcademic.name ?? activeAcademic.tahun_ajaran, ''),
        semester: text(activeAcademic.active_semester ?? activeAcademic.semester, '')
      };
      if (hafalanForm.id) {
        await api.updateHafalan(hafalanForm.id, payload);
      } else {
        await api.createHafalan(payload);
      }
      setHafalanForm(null);
      await load();
      setNotice('Data hafalan berhasil disimpan.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data hafalan gagal disimpan.');
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const id = num(deleteTarget.row.id);
      if (deleteTarget.type === 'nilai') {
        await api.deleteNilai(id);
      } else {
        await api.deleteHafalan(id);
      }
      setDeleteTarget(null);
      await load();
      setNotice('Data berhasil dihapus.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data gagal dihapus.');
    } finally {
      setIsSaving(false);
    }
  }

  function exportCurrentRows() {
    if (activeTab === 'nilai') {
      if (filteredNilai.length === 0) {
        alert('Belum ada data nilai yang bisa diexport.');
        return;
      }
      exportRowsExcel(
        filteredNilai.map((row, idx) => ({
          No: idx + 1,
          'Nama Santri': text(record(row.siswa).nama ?? row.siswa_nama),
          NIS: text(record(row.siswa).nis ?? row.nis),
          Kelas: text(record(row.siswa).kelas ?? row.kelas),
          'Mata Pelajaran': text(record(row.mata_pelajaran).nama ?? row.mapel_nama),
          'Jenis Ujian': text(row.jenis_ujian),
          Nilai: text(row.nilai),
          Grade: text(row.grade),
          Penilai: text(row.penilai_nama ?? record(row.user).name),
          'Tahun Ajaran': text(row.tahun_ajaran),
          Semester: text(row.semester)
        })),
        `Rekap_Nilai_Madin_Qomaruddin_${new Date().toISOString().slice(0, 10)}.xlsx`,
        'REKAP NILAI MADIN'
      );
    } else {
      if (filteredHafalan.length === 0) {
        alert('Belum ada data hafalan yang bisa diexport.');
        return;
      }
      exportRowsExcel(
        filteredHafalan.map((row, idx) => ({
          No: idx + 1,
          'Nama Santri': text(record(row.siswa).nama ?? row.nama_siswa),
          NIS: text(record(row.siswa).nis ?? row.nis),
          Kelas: text(record(row.siswa).kelas ?? row.kelas),
          Juz: text(row.juz),
          Surah: text(row.surah ?? row.nama_surah),
          'Nilai Setoran': text(row.nilai_hafalan),
          Status: text(row.status),
          'Tanggal Setor': formatDateIndo(row.tanggal_setor),
          'Penguji / Pembina': text(row.penguji ?? row.penilai_nama ?? record(row.user).name),
          Keterangan: text(row.keterangan)
        })),
        `Rekap_Hafalan_Santri_Qomaruddin_${new Date().toISOString().slice(0, 10)}.xlsx`,
        'REKAP HAFALAN SANTRI'
      );
    }
  }

  const nilaiColumns: DataColumn<ApiRecord>[] = [
    {
      key: 'siswa',
      header: 'Santri & Kelas',
      sortable: true,
      sortValue: (row) => String(record(row.siswa).nama ?? row.siswa_nama ?? ''),
      render: (row) => {
        const student = record(row.siswa);
        const name = text(student.nama ?? row.siswa_nama, 'Santri');
        const nis = text(student.nis ?? row.nis, '-');
        const kls = text(student.kelas ?? row.kelas, '-');
        return (
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-emerald-100 font-black text-xs text-[#138F81]">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-slate-900 text-sm truncate max-w-[200px]">{name}</p>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-bold text-slate-500">
                <span>NIS: {nis}</span>
                <span>•</span>
                <span className="text-[#138F81] bg-teal-50 px-1.5 py-0.5 rounded-md border border-teal-200/60">{kls}</span>
              </div>
            </div>
          </div>
        );
      }
    },
    {
      key: 'mapel',
      header: 'Mata Pelajaran',
      sortable: true,
      sortValue: (row) => String(record(row.mata_pelajaran).nama ?? row.mapel_nama ?? ''),
      render: (row) => {
        const mapel = record(row.mata_pelajaran);
        const mapelName = text(mapel.nama ?? row.mapel_nama ?? row.nama_mapel, '-');
        return (
          <div className="flex flex-col">
            <span className="font-extrabold text-xs text-slate-800">{mapelName}</span>
            <span className="text-[10px] font-semibold text-slate-400">Madrasah Diniyah</span>
          </div>
        );
      }
    },
    {
      key: 'jenis_ujian',
      header: 'Jenis Ujian',
      sortable: true,
      sortValue: (row) => String(row.jenis_ujian ?? ''),
      render: (row) => (
        <span className="inline-flex items-center gap-1 rounded-xl bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-bold text-blue-700">
          {text(row.jenis_ujian, 'Harian')}
        </span>
      )
    },
    {
      key: 'nilai',
      header: 'Nilai & Skor',
      sortable: true,
      sortValue: (row) => num(row.nilai),
      render: (row) => {
        const val = num(row.nilai);
        const tone = scoreTone(val);
        return (
          <div className="flex items-center gap-2">
            <div
              className={`grid h-8 w-11 place-items-center rounded-xl font-black text-sm ${
                tone === 'success'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : tone === 'info'
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : tone === 'warning'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}
            >
              {val}
            </div>
            <StatusBadge label={`Grade ${text(row.grade, val >= 85 ? 'A' : val >= 75 ? 'B' : val >= 65 ? 'C' : 'D')}`} tone={statusTone(text(row.grade))} />
          </div>
        );
      }
    },
    {
      key: 'penilai',
      header: 'Penguji & Periode',
      sortable: true,
      sortValue: (row) => String(row.penilai_nama ?? ''),

      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-xs text-slate-800">{text(row.penilai_nama ?? record(row.user).name, 'Ustadz Pengampu')}</span>
          <span className="text-[10px] font-semibold text-slate-400">
            {text(row.tahun_ajaran ?? activeAcademic.name, '')} {text(row.semester ?? activeAcademic.active_semester, '') ? `(${text(row.semester ?? activeAcademic.active_semester)})` : ''}
          </span>
        </div>
      )
    },
    ...(isMadrasah
      ? []
      : [
          {
            key: 'aksi',
            header: 'Aksi',
            render: (row: ApiRecord) => (
              <div className="flex flex-wrap gap-1.5">
                <button
                  className="q-soft-action inline-flex items-center gap-1 rounded-xl bg-[#EAF4FF] px-2.5 py-1.5 text-xs font-extrabold text-[#2E86DE]"
                  onClick={() => openNilaiForm(row)}
                  type="button"
                >
                  <Edit3 size={13} /> Edit
                </button>
                <button
                  className="q-soft-action inline-flex items-center gap-1 rounded-xl bg-[#FDECEC] px-2.5 py-1.5 text-xs font-extrabold text-[#D63031]"
                  onClick={() => setDeleteTarget({ type: 'nilai', row })}
                  type="button"
                >
                  <Trash2 size={13} /> Hapus
                </button>
              </div>
            )
          }
        ])
  ];

  const hafalanColumns: DataColumn<ApiRecord>[] = [
    {
      key: 'siswa',
      header: 'Santri & Kelas',
      sortable: true,
      sortValue: (row) => String(record(row.siswa).nama ?? row.nama_siswa ?? ''),
      render: (row) => {
        const student = record(row.siswa);
        const name = text(student.nama ?? row.nama_siswa, 'Santri');
        const nis = text(student.nis ?? row.nis, '-');
        const kls = text(student.kelas ?? row.kelas, '-');
        return (
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-amber-100 font-black text-xs text-amber-800">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-slate-900 text-sm truncate max-w-[200px]">{name}</p>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-bold text-slate-500">
                <span>NIS: {nis}</span>
                <span>•</span>
                <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200/60">{kls}</span>
              </div>
            </div>
          </div>
        );
      }
    },
    {
      key: 'juz_surah',
      header: 'Juz & Surah Al-Qur\'an',
      sortable: true,
      sortValue: (row) => num(row.juz),
      render: (row) => {
        const juzVal = text(row.juz, '-');
        const surahVal = text(row.surah ?? row.nama_surah, '-');
        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="rounded-md bg-purple-100 text-purple-800 font-black text-[10px] px-1.5 py-0.5">
                Juz {juzVal}
              </span>
              <span className="font-extrabold text-xs text-slate-900">QS. {surahVal}</span>
            </div>
            {row.keterangan ? <span className="text-[10px] text-slate-500 font-medium mt-0.5 truncate max-w-[180px]">{text(row.keterangan)}</span> : null}
          </div>
        );
      }
    },
    {
      key: 'status',
      header: 'Status Setoran',
      sortable: true,
      sortValue: (row) => String(row.status ?? ''),
      render: (row) => <StatusBadge label={text(row.status, 'Proses')} tone={statusTone(text(row.status))} />
    },
    {
      key: 'nilai_hafalan',
      header: 'Nilai Setoran',
      sortable: true,
      sortValue: (row) => num(row.nilai_hafalan),
      render: (row) => {
        const val = text(row.nilai_hafalan, '-');
        return <span className="font-black text-sm text-slate-800 bg-slate-100 px-2.5 py-1 rounded-xl">{val}</span>;
      }
    },
    {
      key: 'tanggal_setor',
      header: 'Tanggal & Penguji',
      sortable: true,
      sortValue: (row) => String(row.tanggal_setor ?? ''),
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-xs text-slate-800">{formatDateIndo(row.tanggal_setor)}</span>
          <span className="text-[10px] font-semibold text-slate-400">{text(row.penguji ?? row.penilai_nama ?? record(row.user).name, 'Ustadz Pembina')}</span>
        </div>
      )
    },

    ...(isMadrasah
      ? []
      : [
          {
            key: 'aksi',
            header: 'Aksi',
            render: (row: ApiRecord) => (
              <div className="flex flex-wrap gap-1.5">
                <button
                  className="q-soft-action inline-flex items-center gap-1 rounded-xl bg-[#EAF4FF] px-2.5 py-1.5 text-xs font-extrabold text-[#2E86DE]"
                  onClick={() => openHafalanForm(row)}
                  type="button"
                >
                  <Edit3 size={13} /> Edit
                </button>
                <button
                  className="q-soft-action inline-flex items-center gap-1 rounded-xl bg-[#FDECEC] px-2.5 py-1.5 text-xs font-extrabold text-[#D63031]"
                  onClick={() => setDeleteTarget({ type: 'hafalan', row })}
                  type="button"
                >
                  <Trash2 size={13} /> Hapus
                </button>
              </div>
            )
          }
        ])
  ];

  // JIKA FORM NILAI AKTIF, TAMPILKAN IN-PAGE FORM KONSISTEN
  if (nilaiForm !== null) {
    return (
      <ComplexNilaiForm
        initialData={nilaiForm.id ? (nilaiRows.find((r) => num(r.id) === nilaiForm.id) || (nilaiForm as unknown as ApiRecord)) : null}
        students={students}
        mapelRows={mapelRows}
        activeAcademic={activeAcademic}
        onClose={() => setNilaiForm(null)}
        onSave={() => {
          setNilaiForm(null);
          void load(true);
        }}
      />
    );
  }

  // JIKA FORM HAFALAN AKTIF, TAMPILKAN IN-PAGE FORM KONSISTEN
  if (hafalanForm !== null) {
    return (
      <ComplexHafalanForm
        initialData={hafalanForm.id ? (hafalanRows.find((r) => num(r.id) === hafalanForm.id) || (hafalanForm as unknown as ApiRecord)) : null}
        students={students}
        activeAcademic={activeAcademic}
        onClose={() => setHafalanForm(null)}
        onSave={() => {
          setHafalanForm(null);
          void load(true);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">

      {/* HERO GRADIENT BANNER (CONSISTENT WITH ABSENSI MONITORING) */}
      <section className="rounded-3xl bg-linear-to-r from-[#0F7A6E] via-[#138F81] to-[#1AB3A3] p-6 text-white shadow-lg shadow-[#138F81]/15">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-black backdrop-blur-xs">
              <Sparkles size={14} className="text-amber-300" />
              <span>{isMadrasah ? 'MONITORING NILAI & HAFALAN MADRASAH' : 'PUSAT EVALUASI PEMBELAJARAN'}</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">
              {isMadrasah ? 'Rekapitulasi Nilai & Setoran Hafalan Santri' : 'Nilai Ujian & Hafalan Al-Qur\'an'}
            </h2>
            <p className="text-xs font-medium text-emerald-100 max-w-2xl">
              {isMadrasah
                ? 'Pemantauan komprehensif nilai ujian madin, raport semester, peringkat kelas, dan progres setoran hafalan Al-Qur\'an santri.'
                : 'Pencatatan dan rekapitulasi nilai ujian harian, UTS, UAS, serta setoran hafalan santri terintegrasi dengan portal wali & Android.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCurrentRows}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/30 px-4 py-2.5 text-xs font-extrabold text-white backdrop-blur-sm transition-all"
            >
              <Download size={15} /> Export Rekap Excel
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-xs font-black text-[#138F81] shadow-md hover:bg-emerald-50 transition-all disabled:opacity-50"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
              {isLoading ? 'Menyegarkan...' : 'Refresh Data'}
            </button>
          </div>
        </div>
      </section>

      {/* 4 MODERN STAT CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard title="Total Nilai Ujian" value={stats.totalNilai} subtitle="Nilai ujian tercatat" icon={GraduationCap} tone="teal" />
        <StatCard title="Rata-Rata Nilai" value={`${stats.avgNilai} / 100`} subtitle="Performa akademik santri" icon={Award} tone="blue" />
        <StatCard title="Setoran Hafalan" value={stats.totalHafalan} subtitle="Total setoran santri" icon={BookOpen} tone="orange" />
        <StatCard title="Hafalan Selesai" value={stats.mutqinHafalan} subtitle={`${stats.mutqinHafalan} setoran mutqin`} icon={CheckCircle2} tone="teal" />
      </div>

      {error ? <div className="rounded-2xl bg-[#FDECEC] p-4 text-xs font-bold text-[#D63031]">{error}</div> : null}
      {notice ? <div className="rounded-2xl bg-[#E8F7F3] p-4 text-xs font-bold text-[#138F81]">{notice}</div> : null}

      {/* SEGMENTED TABS */}
      <SegmentedTabs
        tabs={[
          { id: 'nilai', label: '📊 Rekap Nilai Ujian Madin' },
          { id: 'hafalan', label: '📖 Setoran Hafalan Al-Qur\'an' },
          { id: 'ranking', label: '🏆 Peringkat & Top Santri' }
        ]}
        active={activeTab}
        onChange={(id) => setActiveTab(id as TabKey)}
      />

      {/* TAB CONTENT 1 & 2: TABLES WITH MODERN FILTER */}
      {activeTab === 'nilai' || activeTab === 'hafalan' ? (
        <section className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center justify-between">
            <div className="min-w-0 flex-1">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder={
                  activeTab === 'nilai'
                    ? 'Cari nama santri / NIS / kelas / mata pelajaran / penguji...'
                    : 'Cari nama santri / NIS / kelas / juz / surah / pembina...'
                }
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* FILTER KELAS */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500">Kelas:</span>
                <select
                  className="q-input text-xs font-bold py-2"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                >
                  <option value="Semua">Semua Kelas</option>
                  {uniqueClasses.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* FILTER SPESIFIK NILAI */}
              {activeTab === 'nilai' ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-500">Mapel:</span>
                    <select
                      className="q-input text-xs font-bold py-2"
                      value={selectedMapel}
                      onChange={(e) => setSelectedMapel(e.target.value)}
                    >
                      <option value="Semua">Semua Mapel</option>
                      {mapelRows.map((m) => (
                        <option key={text(m.id)} value={text(m.nama)}>
                          {text(m.nama)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-500">Jenis:</span>
                    <select
                      className="q-input text-xs font-bold py-2"
                      value={selectedJenisUjian}
                      onChange={(e) => setSelectedJenisUjian(e.target.value)}
                    >
                      <option value="Semua">Semua Ujian</option>
                      <option value="Harian">Harian</option>
                      <option value="UTS">UTS</option>
                      <option value="UAS">UAS</option>
                    </select>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-500">Status:</span>
                  <select
                    className="q-input text-xs font-bold py-2"
                    value={selectedStatusHafalan}
                    onChange={(e) => setSelectedStatusHafalan(e.target.value)}
                  >
                    <option value="Semua">Semua Status</option>
                    <option value="Selesai">Selesai / Mutqin</option>
                    <option value="Proses">Proses</option>
                    <option value="Belum">Belum / Mengulang</option>
                  </select>
                </div>
              )}

              {!isMadrasah ? (
                <button
                  type="button"
                  onClick={() => (activeTab === 'nilai' ? openNilaiForm() : openHafalanForm())}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#138F81] hover:bg-[#0F7A6E] px-4 py-2.5 text-xs font-black text-white shadow-sm transition-all"
                >
                  <Plus size={15} /> {activeTab === 'nilai' ? 'Tambah Nilai' : 'Tambah Setoran'}
                </button>
              ) : null}
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-sm font-bold text-slate-400">
              <RefreshCw className="mx-auto mb-2 animate-spin text-[#138F81]" size={24} />
              Memuat data penilaian santri...
            </div>
          ) : activeTab === 'nilai' ? (
            <DataTable
              rows={filteredNilai}
              columns={nilaiColumns}
              emptyText="Belum ada data nilai ujian pada filter yang dipilih."
              minWidth="100%"
            />
          ) : (
            <DataTable
              rows={filteredHafalan}
              columns={hafalanColumns}
              emptyText="Belum ada data setoran hafalan pada filter yang dipilih."
              minWidth="100%"
            />
          )}
        </section>
      ) : null}

      {/* TAB CONTENT 3: RANKING & LEADERBOARD SANTRI */}
      {activeTab === 'ranking' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* TOP NILAI UJIAN */}
          <section className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-100 text-amber-700 font-bold shadow-2xs">
                  <Trophy size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Top 10 Prestasi Akademik Madin</h3>
                  <p className="text-xs font-semibold text-slate-500">Santri dengan rata-rata nilai ujian tertinggi</p>
                </div>
              </div>
              <span className="rounded-xl bg-teal-50 border border-teal-200 px-2.5 py-1 text-xs font-bold text-[#138F81]">
                Akademik
              </span>
            </div>

            {topStudentsByScore.length === 0 ? (
              <div className="py-10 text-center text-xs font-bold text-slate-400">Belum ada data ranking ujian.</div>
            ) : (
              <div className="space-y-2.5">
                {topStudentsByScore.map((st, idx) => (
                  <div
                    key={st.nama}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-teal-50/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`grid h-7 w-7 place-items-center rounded-xl text-xs font-black shrink-0 ${
                          idx === 0
                            ? 'bg-amber-400 text-amber-950 shadow-xs'
                            : idx === 1
                            ? 'bg-slate-300 text-slate-800'
                            : idx === 2
                            ? 'bg-amber-600 text-white'
                            : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-extrabold text-xs text-slate-900 truncate">{st.nama}</p>
                        <p className="text-[10px] font-bold text-slate-400">
                          NIS: {st.nis} • Kelas: {st.kelas}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-sm text-[#138F81] bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-lg">
                        {st.average} / 100
                      </span>
                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{st.totalUjian} Ujian</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* TOP SETORAN HAFALAN */}
          <section className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-purple-100 text-purple-700 font-bold shadow-2xs">
                  <BookCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Top 10 Hafalan Al-Qur'an</h3>
                  <p className="text-xs font-semibold text-slate-500">Santri dengan capaian setoran hafalan terbanyak</p>
                </div>
              </div>
              <span className="rounded-xl bg-purple-50 border border-purple-200 px-2.5 py-1 text-xs font-bold text-purple-700">
                Tahfidz
              </span>
            </div>

            {topStudentsByHafalan.length === 0 ? (
              <div className="py-10 text-center text-xs font-bold text-slate-400">Belum ada data ranking hafalan.</div>
            ) : (
              <div className="space-y-2.5">
                {topStudentsByHafalan.map((st, idx) => (
                  <div
                    key={st.nama}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-purple-50/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`grid h-7 w-7 place-items-center rounded-xl text-xs font-black shrink-0 ${
                          idx === 0
                            ? 'bg-purple-600 text-white shadow-xs'
                            : idx === 1
                            ? 'bg-purple-400 text-white'
                            : idx === 2
                            ? 'bg-purple-200 text-purple-900'
                            : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-extrabold text-xs text-slate-900 truncate">{st.nama}</p>
                        <p className="text-[10px] font-bold text-slate-400">
                          NIS: {st.nis} • Kelas: {st.kelas}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-xs text-purple-800 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-lg">
                        {st.mutqinCount} Mutqin
                      </span>
                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{st.setoranCount} Total Setor</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}


      {/* CONFIRM DELETE DIALOG */}
      {deleteTarget ? (
        <ConfirmDialog
          title="Hapus Data Penilaian"
          message={`Apakah Anda yakin ingin menghapus data ${deleteTarget.type === 'nilai' ? 'nilai ujian' : 'setoran hafalan'} ini? Data yang dihapus tidak dapat dikembalikan.`}
          confirmLabel="Hapus Data"
          tone="danger"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
          isBusy={isSaving}
        />
      ) : null}
    </div>
  );
}
