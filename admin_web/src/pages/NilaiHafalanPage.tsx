import { BookCheck, Download, Edit3, FileSpreadsheet, GraduationCap, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type DataColumn } from '../components/DataTable';
import { ModalForm } from '../components/ModalForm';
import { SearchInput } from '../components/SearchInput';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { api, type ApiRecord } from '../services/api';
import { exportRowsExcel } from '../utils/importTemplates';

type TabKey = 'nilai' | 'hafalan';

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

const emptyNilaiForm: NilaiFormState = {
  siswa_id: '',
  mapel_id: '',
  jenis_ujian: 'Harian',
  nilai: '',
  keterangan: '',
  academic_year_id: ''
};

const emptyHafalanForm: HafalanFormState = {
  siswa_id: '',
  juz: '',
  surah: '',
  status: 'Proses',
  tanggal_setor: new Date().toISOString().slice(0, 10),
  nilai_hafalan: '',
  keterangan: '',
  academic_year_id: ''
};

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

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const normalized = status.toLowerCase();
  if (['selesai', 'lunas', 'a', 'b'].includes(normalized)) return 'success';
  if (['proses', 'c'].includes(normalized)) return 'warning';
  if (['belum', 'd', 'e'].includes(normalized)) return 'danger';
  return 'info';
}

export function NilaiHafalanPage() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('nilai');
  const [nilaiRows, setNilaiRows] = useState<ApiRecord[]>([]);
  const [hafalanRows, setHafalanRows] = useState<ApiRecord[]>([]);
  const [students, setStudents] = useState<ApiRecord[]>([]);
  const [mapelRows, setMapelRows] = useState<ApiRecord[]>([]);
  const [academicRows, setAcademicRows] = useState<ApiRecord[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [nilaiForm, setNilaiForm] = useState<NilaiFormState | null>(null);
  const [hafalanForm, setHafalanForm] = useState<HafalanFormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: TabKey; row: ApiRecord } | null>(null);

  async function load() {
    setIsLoading(true);
    setError('');
    setNotice('');
    try {
      const [nilaiResult, hafalanResult, siswaResult, mapelResult, academicResult] = await Promise.all([
        api.nilai(),
        api.hafalan(),
        api.siswa({ status: 'Aktif' }),
        api.mataPelajaran({ status: 'Aktif' }),
        api.academicPeriods()
      ]);
      setNilaiRows(list(nilaiResult.data));
      setHafalanRows(list(hafalanResult.data));
      setStudents(list(siswaResult.data));
      setMapelRows(list(mapelResult.data));
      setAcademicRows(list(academicResult.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data nilai dan hafalan gagal dimuat.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const activeAcademic = useMemo(() => {
    return academicRows.find((row) => row.is_active === true || text(row.status).toLowerCase() === 'aktif') ?? academicRows[0] ?? {};
  }, [academicRows]);

  const filteredNilai = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return nilaiRows;
    return nilaiRows.filter((row) => {
      const nama = String(record(row.siswa).nama ?? row.nama_siswa ?? '').toLowerCase();
      const nis = String(record(row.siswa).nis ?? row.nis ?? '').toLowerCase();
      const mapel = String(record(row.mata_pelajaran).nama ?? row.nama_mapel ?? '').toLowerCase();
      const jenis = String(row.jenis_ujian ?? '').toLowerCase();
      const guru = String(record(row.guru).name ?? row.nama_guru ?? '').toLowerCase();
      return nama.includes(keyword) || nis.includes(keyword) || mapel.includes(keyword) || jenis.includes(keyword) || guru.includes(keyword);
    });
  }, [nilaiRows, search]);

  const filteredHafalan = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return hafalanRows;
    return hafalanRows.filter((row) => {
      const nama = String(record(row.siswa).nama ?? row.nama_siswa ?? '').toLowerCase();
      const nis = String(record(row.siswa).nis ?? row.nis ?? '').toLowerCase();
      const surah = String(row.nama_surah ?? row.surah ?? '').toLowerCase();
      const juz = String(row.juz ?? '').toLowerCase();
      const status = String(row.status ?? '').toLowerCase();
      const pembina = String(record(row.pembina).name ?? row.nama_pembina ?? '').toLowerCase();
      return nama.includes(keyword) || nis.includes(keyword) || surah.includes(keyword) || juz.includes(keyword) || status.includes(keyword) || pembina.includes(keyword);
    });
  }, [hafalanRows, search]);

  const nilaiAverage = useMemo(() => {
    if (nilaiRows.length === 0) return 0;
    const total = nilaiRows.reduce((sum, row) => sum + num(row.nilai), 0);
    return Math.round(total / nilaiRows.length);
  }, [nilaiRows]);

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

  function selectedAcademic(id: string): ApiRecord {
    return academicRows.find((row) => text(row.id, '') === id) ?? activeAcademic;
  }

  async function saveNilai() {
    if (!nilaiForm || !session) return;
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const academic = selectedAcademic(nilaiForm.academic_year_id);
      const payload: ApiRecord = {
        user_id: session.id,
        siswa_id: Number(nilaiForm.siswa_id),
        mapel_id: Number(nilaiForm.mapel_id),
        jenis_ujian: nilaiForm.jenis_ujian,
        nilai: Number(nilaiForm.nilai),
        keterangan: nilaiForm.keterangan,
        academic_year_id: nilaiForm.academic_year_id ? Number(nilaiForm.academic_year_id) : undefined,
        tahun_ajaran: text(academic.name ?? academic.tahun_ajaran, ''),
        semester: text(academic.active_semester ?? academic.semester, '')
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
      const academic = selectedAcademic(hafalanForm.academic_year_id);
      const payload: ApiRecord = {
        user_id: session.id,
        siswa_id: Number(hafalanForm.siswa_id),
        juz: hafalanForm.juz ? Number(hafalanForm.juz) : undefined,
        surah: hafalanForm.surah,
        status: hafalanForm.status,
        tanggal_setor: hafalanForm.tanggal_setor,
        nilai_hafalan: hafalanForm.nilai_hafalan ? Number(hafalanForm.nilai_hafalan) : undefined,
        keterangan: hafalanForm.keterangan,
        academic_year_id: hafalanForm.academic_year_id ? Number(hafalanForm.academic_year_id) : undefined,
        tahun_ajaran: text(academic.name ?? academic.tahun_ajaran, ''),
        semester: text(academic.active_semester ?? academic.semester, '')
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
    const rows = activeTab === 'nilai' ? filteredNilai : filteredHafalan;
    if (rows.length === 0) {
      setError('Belum ada data yang bisa diexport.');
      return;
    }
    exportRowsExcel(rows, `${activeTab}_qomaruddin.xlsx`, activeTab === 'nilai' ? 'REKAP NILAI' : 'REKAP HAFALAN');
  }

  const nilaiColumns: DataColumn<ApiRecord>[] = [
    { key: 'siswa', header: 'Siswa', render: (row) => <span className="font-extrabold">{text(record(row.siswa).nama ?? row.siswa_nama)}</span> },
    { key: 'kelas', header: 'Kelas', render: (row) => text(record(row.siswa).kelas ?? row.kelas) },
    { key: 'mapel', header: 'Mapel', render: (row) => text(record(row.mata_pelajaran).nama ?? row.mapel_nama) },
    { key: 'jenis', header: 'Jenis', render: (row) => <StatusBadge label={text(row.jenis_ujian)} tone="info" /> },
    { key: 'nilai', header: 'Nilai', render: (row) => <span className="text-lg font-extrabold">{text(row.nilai)}</span> },
    { key: 'grade', header: 'Grade', render: (row) => <StatusBadge label={text(row.grade)} tone={statusTone(text(row.grade))} /> },
    { key: 'penilai', header: 'Penilai', render: (row) => text(row.penilai_nama ?? record(row.user).name) },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <button className="q-soft-action inline-flex items-center gap-1 rounded-xl bg-[#EAF4FF] px-3 py-2 text-xs font-extrabold text-[#2E86DE]" onClick={() => openNilaiForm(row)} type="button">
            <Edit3 size={14} /> Edit
          </button>
          <button className="q-soft-action inline-flex items-center gap-1 rounded-xl bg-[#FDECEC] px-3 py-2 text-xs font-extrabold text-[#D63031]" onClick={() => setDeleteTarget({ type: 'nilai', row })} type="button">
            <Trash2 size={14} /> Hapus
          </button>
        </div>
      )
    }
  ];

  const hafalanColumns: DataColumn<ApiRecord>[] = [
    { key: 'siswa', header: 'Siswa', render: (row) => <span className="font-extrabold">{text(record(row.siswa).nama ?? row.siswa_nama)}</span> },
    { key: 'kelas', header: 'Kelas', render: (row) => text(record(row.siswa).kelas ?? row.kelas) },
    { key: 'juz', header: 'Juz/Surah', render: (row) => `${text(row.juz)} / ${text(row.surah)}` },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge label={text(row.status)} tone={statusTone(text(row.status))} /> },
    { key: 'nilai', header: 'Nilai', render: (row) => text(row.nilai_hafalan) },
    { key: 'periode', header: 'Periode', render: (row) => text(row.periode ?? row.tahun_ajaran) },
    { key: 'penguji', header: 'Penguji', render: (row) => text(row.penguji ?? row.penilai_nama ?? record(row.user).name) },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <button className="q-soft-action inline-flex items-center gap-1 rounded-xl bg-[#EAF4FF] px-3 py-2 text-xs font-extrabold text-[#2E86DE]" onClick={() => openHafalanForm(row)} type="button">
            <Edit3 size={14} /> Edit
          </button>
          <button className="q-soft-action inline-flex items-center gap-1 rounded-xl bg-[#FDECEC] px-3 py-2 text-xs font-extrabold text-[#D63031]" onClick={() => setDeleteTarget({ type: 'hafalan', row })} type="button">
            <Trash2 size={14} /> Hapus
          </button>
        </div>
      )
    }
  ];

  const isMadrasah = session?.role === 'admin' && String(session?.admin_type || '').toLowerCase() === 'madrasah';

  const visibleNilaiColumns = useMemo(() => {
    return isMadrasah ? nilaiColumns.filter((c) => c.key !== 'aksi') : nilaiColumns;
  }, [isMadrasah, nilaiColumns]);

  const visibleHafalanColumns = useMemo(() => {
    return isMadrasah ? hafalanColumns.filter((c) => c.key !== 'aksi') : hafalanColumns;
  }, [isMadrasah, hafalanColumns]);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#636E72]">Nilai dan Hafalan</p>
          <h1 className="text-3xl font-extrabold text-[#2D3436]">{isMadrasah ? 'Monitoring Nilai & Hafalan' : 'Nilai Ujian / Hafalan'}</h1>
          <p className="text-sm font-semibold text-[#636E72]">{isMadrasah ? 'Pemantauan rekapitulasi nilai ujian dan setoran hafalan santri secara realtime.' : 'Input dan rekap penilaian memakai backend yang sama dengan Android.'}</p>
        </div>
        <button
          className={`q-refresh-button flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-[#138F81] ${isLoading ? 'is-loading' : ''}`}
          onClick={() => void load()}
          type="button"
          disabled={isLoading}
        >
          <RefreshCw className="q-refresh-icon" size={17} />
          {isLoading ? 'Menyegarkan...' : 'Refresh'}
        </button>
      </section>

      {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
      {notice ? <div className="rounded-2xl bg-[#E8F7F3] px-4 py-3 text-sm font-bold text-[#138F81]">{notice}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Nilai Ujian" value={nilaiRows.length} subtitle={`${filteredNilai.length} data tampil`} icon={GraduationCap} tone="teal" />
        <StatCard title="Rata-rata Nilai" value={nilaiAverage} subtitle="Rata-rata nilai santri" icon={BookCheck} tone="blue" />
        <StatCard title="Setoran Hafalan" value={hafalanRows.length} subtitle={`${filteredHafalan.length} setoran santri`} icon={FileSpreadsheet} tone="orange" />
      </div>

      <SegmentedTabs
        tabs={[
          { id: 'nilai', label: 'Rekap Nilai' },
          { id: 'hafalan', label: 'Setoran Hafalan' }
        ]}
        active={activeTab}
        onChange={(id) => setActiveTab(id as TabKey)}
      />

      <section className="q-panel p-4 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Cari siswa / kelas / mapel / penilai" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="q-soft-action inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold text-[#138F81]" onClick={exportCurrentRows} type="button">
              <Download size={17} /> Export Excel
            </button>
            {!isMadrasah ? (
              <button
                className="q-soft-action inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white"
                onClick={() => (activeTab === 'nilai' ? openNilaiForm() : openHafalanForm())}
                type="button"
              >
                <Plus size={17} /> {activeTab === 'nilai' ? 'Tambah Nilai' : 'Tambah Hafalan'}
              </button>
            ) : null}
          </div>
        </div>
        {isLoading ? (
          <div className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-bold text-[#636E72]">Memuat data...</div>
        ) : activeTab === 'nilai' ? (
          <DataTable rows={filteredNilai} columns={visibleNilaiColumns} emptyText="Belum ada data nilai." />
        ) : (
          <DataTable rows={filteredHafalan} columns={visibleHafalanColumns} emptyText="Belum ada data hafalan." />
        )}
      </section>

      {nilaiForm ? (
        <ModalForm
          title={nilaiForm.id ? 'Edit Nilai' : 'Tambah Nilai'}
          onClose={() => setNilaiForm(null)}
          footer={
            <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#138F81] px-5 text-sm font-extrabold text-white disabled:opacity-60" onClick={() => void saveNilai()} type="button" disabled={isSaving}>
              <Save size={17} /> {isSaving ? 'Menyimpan...' : 'Simpan Nilai'}
            </button>
          }
        >
          <div className="grid gap-4">
            <select className="q-input" value={nilaiForm.siswa_id} onChange={(event) => setNilaiForm({ ...nilaiForm, siswa_id: event.target.value })}>
              <option value="">Pilih siswa</option>
              {students.map((row) => (
                <option key={text(row.id)} value={text(row.id)}>
                  {text(row.nama)} - {text(row.kelas)}
                </option>
              ))}
            </select>
            <select className="q-input" value={nilaiForm.mapel_id} onChange={(event) => setNilaiForm({ ...nilaiForm, mapel_id: event.target.value })}>
              <option value="">Pilih mata pelajaran</option>
              {mapelRows.map((row) => (
                <option key={text(row.id)} value={text(row.id)}>
                  {text(row.nama)}
                </option>
              ))}
            </select>
            <div className="grid gap-4 sm:grid-cols-2">
              <select className="q-input" value={nilaiForm.jenis_ujian} onChange={(event) => setNilaiForm({ ...nilaiForm, jenis_ujian: event.target.value })}>
                {['Harian', 'Tugas', 'UTS', 'UAS', 'Hafalan'].map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <input className="q-input" min="0" max="100" type="number" placeholder="Nilai 0 - 100" value={nilaiForm.nilai} onChange={(event) => setNilaiForm({ ...nilaiForm, nilai: event.target.value })} />
            </div>
            <select className="q-input" value={nilaiForm.academic_year_id} onChange={(event) => setNilaiForm({ ...nilaiForm, academic_year_id: event.target.value })}>
              <option value="">Periode aktif otomatis</option>
              {academicRows.map((row) => (
                <option key={text(row.id)} value={text(row.id)}>
                  {text(row.name ?? row.tahun_ajaran)} - {text(row.active_semester ?? row.semester)}
                </option>
              ))}
            </select>
            <textarea className="q-input min-h-28 resize-none" placeholder="Keterangan opsional" value={nilaiForm.keterangan} onChange={(event) => setNilaiForm({ ...nilaiForm, keterangan: event.target.value })} />
          </div>
        </ModalForm>
      ) : null}

      {hafalanForm ? (
        <ModalForm
          title={hafalanForm.id ? 'Edit Hafalan' : 'Tambah Hafalan'}
          onClose={() => setHafalanForm(null)}
          footer={
            <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#138F81] px-5 text-sm font-extrabold text-white disabled:opacity-60" onClick={() => void saveHafalan()} type="button" disabled={isSaving}>
              <Save size={17} /> {isSaving ? 'Menyimpan...' : 'Simpan Hafalan'}
            </button>
          }
        >
          <div className="grid gap-4">
            <select className="q-input" value={hafalanForm.siswa_id} onChange={(event) => setHafalanForm({ ...hafalanForm, siswa_id: event.target.value })}>
              <option value="">Pilih siswa</option>
              {students.map((row) => (
                <option key={text(row.id)} value={text(row.id)}>
                  {text(row.nama)} - {text(row.kelas)}
                </option>
              ))}
            </select>
            <div className="grid gap-4 sm:grid-cols-2">
              <input className="q-input" min="1" max="30" type="number" placeholder="Juz" value={hafalanForm.juz} onChange={(event) => setHafalanForm({ ...hafalanForm, juz: event.target.value })} />
              <input className="q-input" placeholder="Surah opsional" value={hafalanForm.surah} onChange={(event) => setHafalanForm({ ...hafalanForm, surah: event.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <select className="q-input" value={hafalanForm.status} onChange={(event) => setHafalanForm({ ...hafalanForm, status: event.target.value })}>
                {['Belum', 'Proses', 'Selesai'].map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <input className="q-input" type="date" value={hafalanForm.tanggal_setor} onChange={(event) => setHafalanForm({ ...hafalanForm, tanggal_setor: event.target.value })} />
            </div>
            <input className="q-input" min="0" max="100" type="number" placeholder="Nilai hafalan opsional" value={hafalanForm.nilai_hafalan} onChange={(event) => setHafalanForm({ ...hafalanForm, nilai_hafalan: event.target.value })} />
            <select className="q-input" value={hafalanForm.academic_year_id} onChange={(event) => setHafalanForm({ ...hafalanForm, academic_year_id: event.target.value })}>
              <option value="">Periode aktif otomatis</option>
              {academicRows.map((row) => (
                <option key={text(row.id)} value={text(row.id)}>
                  {text(row.name ?? row.tahun_ajaran)} - {text(row.active_semester ?? row.semester)}
                </option>
              ))}
            </select>
            <textarea className="q-input min-h-28 resize-none" placeholder="Keterangan opsional" value={hafalanForm.keterangan} onChange={(event) => setHafalanForm({ ...hafalanForm, keterangan: event.target.value })} />
          </div>
        </ModalForm>
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Hapus Data?"
          message={`Data ${deleteTarget.type === 'nilai' ? 'nilai' : 'hafalan'} akan dihapus dari server.`}
          tone="danger"
          confirmLabel="Hapus"
          isBusy={isSaving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}
