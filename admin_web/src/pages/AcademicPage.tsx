import {
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Pencil,
  Plus,
  RefreshCw,
  RotateCw,
  Sparkles,
  Trash2
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ComplexTahunAjaranForm } from '../components/ComplexTahunAjaranForm';
import { DataTable, type DataColumn } from '../components/DataTable';
import { ModalForm } from '../components/ModalForm';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { api, type ApiRecord } from '../services/api';

function text(value: unknown, fallback = '-'): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSemester(value: unknown): 'ganjil' | 'genap' {
  const clean = String(value ?? '').trim().toLowerCase();
  return clean.includes('genap') ? 'genap' : 'ganjil';
}

interface AcademicFormState extends ApiRecord {
  id?: number;
  name: string;
  year_start: string;
  year_end: string;
  active_semester: 'ganjil' | 'genap';
}


export function AcademicPage() {
  const [years, setYears] = useState<ApiRecord[]>([]);
  const [active, setActive] = useState<ApiRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingYear, setDeletingYear] = useState<ApiRecord | null>(null);
  const [autoPromoteTarget, setAutoPromoteTarget] = useState<ApiRecord | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [form, setForm] = useState<AcademicFormState | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setIsLoading(true);
    setError('');
    try {
      const result = await api.academicPeriods();
      setYears(Array.isArray(result.data) ? result.data : []);
      setActive(result.active && typeof result.active === 'object' ? (result.active as ApiRecord) : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data akademik gagal dimuat.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const activeSemester = normalizeSemester(active?.semester ?? active?.semester_label ?? (active?.academic_year as ApiRecord | undefined)?.active_semester);
  const activeAcademicYear = active?.academic_year && typeof active.academic_year === 'object' ? (active.academic_year as ApiRecord) : null;

  const columns: DataColumn<ApiRecord>[] = [
    {
      key: 'name',
      header: 'Tahun Ajaran',
      sortable: true,
      sortValue: (row) => String(row.name ?? ''),
      render: (row) => <span className="font-extrabold text-slate-800">{text(row.name)}</span>
    },
    {
      key: 'active_semester',
      header: 'Semester Aktif',
      sortable: true,
      sortValue: (row) => String(row.active_semester ?? ''),
      render: (row) => <span className="font-bold text-xs uppercase text-[#138F81] bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200/60">{text(row.active_semester)}</span>
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (row) => (row.is_active ? 1 : 0),
      render: (row) => <StatusBadge label={row.is_active ? 'Aktif' : 'Nonaktif'} tone={row.is_active ? 'success' : 'neutral'} />
    },
    {
      key: 'actions',
      header: 'Aksi',
      render: (row) => {
        const id = asNumber(row.id);
        const activeSemester = normalizeSemester(row.active_semester);
        return (
          <div className="flex flex-wrap gap-2">
            <button
              className="q-soft-action rounded-xl bg-[#F0ECFF] px-3 py-2 text-xs font-extrabold text-[#6C5CE7] hover:bg-[#e2dbff] disabled:opacity-60 transition-colors inline-flex items-center gap-1"
              onClick={() => setAutoPromoteTarget(row)}
              type="button"
              disabled={isSaving || isPromoting}
              title="Naikkan semua santri madin secara otomatis & luluskan santri tingkat akhir"
            >
              <Sparkles size={13} /> Naik Kelas Otomatis
            </button>
            <button className="q-soft-action rounded-xl bg-[#EAF4FF] px-3 py-2 text-xs font-extrabold text-[#2E86DE]" onClick={() => openForm(row)} type="button">
              <Pencil size={14} className="inline" /> Edit
            </button>
            <button
              className="q-soft-action rounded-xl bg-[#E8F7F3] px-3 py-2 text-xs font-extrabold text-[#138F81] disabled:opacity-60"
              onClick={() => void activate(id, activeSemester)}
              type="button"
              disabled={isSaving || row.is_active === true}
            >
              Aktifkan
            </button>
            <button
              className="q-soft-action rounded-xl bg-white px-3 py-2 text-xs font-extrabold text-[#138F81] disabled:opacity-60"
              onClick={() => void syncSiswa(row)}
              type="button"
              disabled={syncingId === id}
            >
              <RotateCw size={14} className={`inline ${syncingId === id ? 'animate-spin' : ''}`} /> Sinkron
            </button>
            <button
              className="q-soft-action rounded-xl bg-[#FDECEC] px-3 py-2 text-xs font-extrabold text-[#D63031] hover:bg-[#FCD8D8] disabled:opacity-60 transition-colors"
              onClick={() => setDeletingYear(row)}
              type="button"
              disabled={isSaving || isDeleting || isPromoting}
            >
              <Trash2 size={14} className="inline" /> Hapus
            </button>
          </div>
        );
      }
    }
  ];

  function openForm(year?: ApiRecord) {
    const start = text(year?.year_start, String(new Date().getFullYear()));
    const end = text(year?.year_end, String(Number(start) + 1));
    setForm({
      id: year?.id ? asNumber(year.id) : undefined,
      name: text(year?.name, `${start}/${end}`),
      year_start: start,
      year_end: end,
      active_semester: normalizeSemester(year?.active_semester)
    });
  }

  async function activate(id: number, semester: string) {
    if (!id || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      await api.activateAcademicPeriod(id, semester);
      setNotice('Tahun ajaran aktif berhasil diperbarui.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengaktifkan tahun ajaran.');
    } finally {
      setIsSaving(false);
    }
  }

  async function setSemester(year: ApiRecord, semester: 'ganjil' | 'genap') {
    const id = asNumber(year.id);
    if (!id || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      await api.setAcademicSemester(id, semester);
      setNotice('Semester aktif berhasil diperbarui.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah semester.');
    } finally {
      setIsSaving(false);
    }
  }

  async function syncSiswa(year: ApiRecord) {
    const id = asNumber(year.id);
    if (!id || syncingId) return;
    setSyncingId(id);
    setError('');
    try {
      const semester = normalizeSemester(year.active_semester);
      const result = await api.syncAcademicPeriodSiswa(id, { semester });
      const data = (result.data && typeof result.data === 'object' ? result.data : {}) as ApiRecord;
      setNotice(`Sinkron selesai. Total: ${data.total_santri ?? 0}, berhasil: ${data.berhasil ?? 0}, sudah ada: ${data.sudah_ada ?? 0}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sinkronisasi gagal.');
    } finally {
      setSyncingId(null);
    }
  }

  async function handleAutoPromote() {
    if (!autoPromoteTarget?.id || isPromoting) return;
    setIsPromoting(true);
    setError('');
    setNotice('');
    try {
      const result = await api.autoPromoteAcademicPeriod(asNumber(autoPromoteTarget.id));
      const payload = (result.data && typeof result.data === 'object' ? result.data : {}) as ApiRecord;
      setNotice(
        `Kenaikan kelas otomatis berhasil! Total santri diproses: ${payload.total_processed ?? 0}, Naik Kelas: ${payload.promoted ?? 0}, Lulus (Alumni): ${payload.graduated ?? 0}. Data santri yang lulus telah dipindahkan ke Data Santri Alumni.`
      );
      setAutoPromoteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kenaikan kelas otomatis gagal diproses.');
    } finally {
      setIsPromoting(false);
    }
  }

  async function handleDelete() {
    if (!deletingYear?.id || isDeleting) return;
    setIsDeleting(true);
    setError('');
    setNotice('');
    try {
      const res = await api.deleteAcademicPeriod(asNumber(deletingYear.id));
      setNotice(res.message || `Tahun ajaran ${text(deletingYear.name)} berhasil dihapus.`);
      setDeletingYear(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus tahun ajaran.');
    } finally {
      setIsDeleting(false);
    }
  }

  if (form !== null) {
    return (
      <ComplexTahunAjaranForm
        initialData={form.id ? form : null}
        onClose={() => setForm(null)}
        onSave={() => {
          setForm(null);
          void load();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 🌟 HEADER CARD SETTING AKADEMIK */}
      <div className="q-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-[#E1EFF7] text-[#138F81] border border-teal-100 flex items-center justify-center shrink-0 shadow-xs">
            <CalendarDays className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#636E72]">
                Konfigurasi Pendidikan
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#FFDC80] text-[#0D7A6F] border border-amber-300">
                Tahun Ajaran
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#2D3436] tracking-tight">Setting Akademik</h1>
            <p className="text-xs sm:text-sm font-medium text-[#636E72] mt-0.5">Tahun ajaran, kenaikan kelas otomatis madin, dan sinkronisasi santri.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] px-4 text-sm font-extrabold text-white shadow-lg shadow-[#138F81]/20 transition-all cursor-pointer"
            onClick={() => openForm()}
            type="button"
          >
            <Plus size={17} /> Tambah Tahun Ajaran
          </button>
          <button
            className={`q-refresh-button flex min-h-11 items-center gap-2 rounded-2xl bg-white border border-slate-200/80 px-4 text-sm font-bold text-[#138F81] hover:bg-slate-50 transition-all cursor-pointer shadow-xs ${isLoading ? 'is-loading' : ''}`}
            onClick={() => void load()}
            type="button"
            disabled={isLoading}
          >
            <RefreshCw className={`q-refresh-icon ${isLoading ? 'animate-spin' : ''}`} size={17} /> Refresh
          </button>
        </div>
      </div>

      {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
      {notice ? <div className="rounded-2xl bg-[#E8F7F3] px-4 py-3 text-sm font-bold text-[#138F81]">{notice}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Tahun Ajaran Aktif" value={text(active?.tahun_ajaran, '-')} subtitle={text(active?.semester_label, 'Semester belum dipilih')} icon={CalendarDays} tone="teal" />
        <StatCard title="Jumlah Tahun Ajaran" value={years.length} subtitle="Riwayat akademik tersimpan" icon={CheckCircle2} tone="blue" />
        <StatCard title="Semester Aktif" value={text(active?.semester_label ?? active?.semester, '-')} subtitle="Ganjil/Genap tidak menimpa arsip" icon={RotateCw} tone="orange" />
      </div>

      {activeAcademicYear ? (
        <section className="q-panel p-5 bg-gradient-to-r from-[#F0ECFF] via-[#E8F3FF] to-[#E8F7F3] border border-[#6C5CE7]/20 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#6C5CE7] text-white text-xs font-black uppercase tracking-wider mb-2">
                <Sparkles size={13} /> Fitur Otomatisasi Akademik
              </span>
              <h2 className="text-lg font-black text-[#2D3436]">Kenaikan Kelas Madin & Pemisahan Alumni Otomatis</h2>
              <p className="mt-1 text-xs sm:text-sm font-semibold text-[#636E72] leading-relaxed">
                Tahun Ajaran <span className="font-extrabold text-[#2D3436]">{text(activeAcademicYear.name)}</span> sedang aktif. Anda dapat menaikkan seluruh siswa madin 1 tingkat sekaligus secara otomatis tanpa perlu dipilih satu per satu. Siswa tingkat akhir (Sifir Sadis) otomatis lulus dan dipindahkan ke Data Santri Alumni agar data rapi dan tidak bercampur.
              </p>
            </div>
            <button
              className="q-soft-action inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#6C5CE7] px-6 text-sm font-extrabold text-white shadow-lg shadow-[#6C5CE7]/25 hover:bg-[#5b4cc4] transition-colors"
              onClick={() => setAutoPromoteTarget(activeAcademicYear)}
              type="button"
            >
              <Sparkles size={16} /> Jalankan Naik Kelas Otomatis
            </button>
          </div>
        </section>
      ) : null}

      <section className="q-panel p-4 sm:p-6">
        <DataTable rows={years} columns={columns} emptyText={isLoading ? 'Memuat tahun ajaran...' : 'Belum ada tahun ajaran.'} minWidth="860px" />
      </section>

      {activeAcademicYear ? (
        <section className="q-panel p-5">
          <h2 className="text-lg font-extrabold text-[#2D3436]">Ubah Semester Aktif Cepat</h2>
          <p className="mt-1 text-sm font-semibold text-[#636E72]">Data semester lama tetap aman sebagai riwayat. Sistem hanya menyiapkan periode baru.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className={`q-soft-action min-h-11 rounded-2xl px-5 text-sm font-extrabold disabled:opacity-60 ${
                activeSemester === 'ganjil' ? 'bg-[#138F81] text-white shadow-lg shadow-[#138F81]/20' : 'bg-white text-[#138F81]'
              }`}
              onClick={() => void setSemester(activeAcademicYear, 'ganjil')}
              type="button"
              disabled={isSaving || activeSemester === 'ganjil'}
            >
              Semester Ganjil
            </button>
            <button
              className={`q-soft-action min-h-11 rounded-2xl px-5 text-sm font-extrabold disabled:opacity-60 ${
                activeSemester === 'genap' ? 'bg-[#138F81] text-white shadow-lg shadow-[#138F81]/20' : 'bg-white text-[#138F81]'
              }`}
              onClick={() => void setSemester(activeAcademicYear, 'genap')}
              type="button"
              disabled={isSaving || activeSemester === 'genap'}
            >
              Semester Genap
            </button>
          </div>
        </section>
      ) : null}



      {autoPromoteTarget ? (
        <ModalForm
          title="🚀 Kenaikan Kelas Otomatis & Pemisahan Alumni"
          onClose={() => !isPromoting && setAutoPromoteTarget(null)}
          footer={
            <div className="flex w-full justify-end gap-2">
              <button
                type="button"
                disabled={isPromoting}
                onClick={() => setAutoPromoteTarget(null)}
                className="rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isPromoting}
                onClick={() => void handleAutoPromote()}
                className="rounded-2xl bg-[#6C5CE7] px-6 py-2.5 text-sm font-black text-white shadow-lg shadow-[#6C5CE7]/30 hover:bg-[#5b4cc4] disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isPromoting ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} /> Memproses Kenaikan Kelas...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Ya, Proses Kenaikan Kelas Otomatis
                  </>
                )}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#6C5CE7]/30 bg-[#F0ECFF] p-4 text-[#2D3436]">
              <p className="text-sm font-extrabold text-[#6C5CE7]">
                Konfirmasi Kenaikan Kelas untuk Periode: {text(autoPromoteTarget.name)}
              </p>
              <p className="mt-2 text-xs font-semibold text-[#636E72] leading-relaxed">
                Sistem akan memproses seluruh data siswa madin aktif secara otomatis dengan aturan pesantren:
              </p>
              <div className="mt-3 space-y-2 text-xs font-bold text-[#2D3436]">
                <div className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-purple-100">
                  <span className="text-base">📈</span>
                  <div>
                    <span className="font-extrabold text-[#138F81]">Siswa Kelas 1 s/d 5 (Sifir Awal - Sifir Khomis):</span>
                    <p className="text-[11px] font-medium text-[#636E72] mt-0.5">Otomatis naik 1 tingkat (Awal ➔ Tsani ➔ Tsalis ➔ Robi' ➔ Khomis ➔ Sadis) dengan menjaga rombel paralel yang ada.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-purple-100">
                  <span className="text-base">🎓</span>
                  <div>
                    <span className="font-extrabold text-[#6C5CE7]">Siswa Tingkat Akhir (Sifir Sadis):</span>
                    <p className="text-[11px] font-medium text-[#636E72] mt-0.5">Otomatis dinyatakan <b className="text-[#6C5CE7]">LULUS</b> dan langsung dipisahkan masuk ke menu <b className="text-[#2D3436]">Data Santri Alumni</b> agar tidak tercampur dengan siswa aktif maupun siswa baru.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-purple-100">
                  <span className="text-base">🗂️</span>
                  <div>
                    <span className="font-extrabold text-[#2E86DE]">Audit Trail & Keamanan Data:</span>
                    <p className="text-[11px] font-medium text-[#636E72] mt-0.5">Riwayat kelas dan tagihan semester lama tersimpan rapi di tabel snapshot riwayat sehingga data tidak hilang, amburadul, ataupun crash.</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs font-bold text-[#636E72] bg-gray-50 border border-gray-200 rounded-xl p-3">
              💡 <b>Catatan Admin:</b> Setelah kenaikan kelas otomatis berhasil, jika ada santri yang berpindah kelompok atau rombel paralel baru, Admin cukup mengatur pembagian kelompok di menu <b>Kelompok Belajar</b>.
            </p>
          </div>
        </ModalForm>
      ) : null}

      {deletingYear ? (
        <ModalForm
          title="Hapus Tahun Ajaran"
          onClose={() => !isDeleting && setDeletingYear(null)}
          footer={
            <div className="flex w-full justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingYear(null)}
                className="rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleDelete()}
                className="rounded-2xl bg-[#D63031] px-5 py-2.5 text-sm font-black text-white shadow-md hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus Bersih'}
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
              <p className="text-sm font-bold">
                ⚠️ Apakah Anda yakin ingin menghapus Tahun Ajaran <span className="font-extrabold underline">{text(deletingYear.name)}</span>?
              </p>
              <p className="mt-2 text-xs text-red-700 leading-relaxed">
                Tindakan ini akan menghapus tahun ajaran beserta seluruh data tagihan (bills), aturan tagihan, dan riwayat semester terkait secara bersih dari database tanpa meninggalkan data sampah (orphan).
              </p>
            </div>
            {deletingYear.is_active ? (
              <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                ℹ️ Tahun ajaran ini sedang <b>Aktif</b>. Setelah dihapus, sistem akan otomatis mengaktifkan tahun ajaran berikutnya yang tersedia.
              </p>
            ) : null}
          </div>
        </ModalForm>
      ) : null}
    </div>
  );
}
