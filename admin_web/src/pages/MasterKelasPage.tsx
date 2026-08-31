import {
  BookOpen,
  Building,
  GraduationCap,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type DataColumn } from '../components/DataTable';
import { ModalForm } from '../components/ModalForm';
import { SearchInput } from '../components/SearchInput';
import { api, type ApiRecord } from '../services/api';

export function MasterKelasPage() {
  const [classes, setClasses] = useState<ApiRecord[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'Madin' | 'Formal'>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'PA' | 'PI' | 'Campur'>('all');
  const [form, setForm] = useState<ApiRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setIsLoading(true);
    setError('');
    setNotice('');
    try {
      const result = await api.classes();
      setClasses(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data kelas gagal dimuat');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totalMadin = useMemo(() => {
    return classes.filter(
      (c) =>
        String(c.category || '').toLowerCase() !== 'formal' ||
        String(c.name || '').toLowerCase().startsWith('sifir')
    ).length;
  }, [classes]);

  const totalFormal = useMemo(() => {
    return classes.filter(
      (c) =>
        String(c.category || '').toLowerCase() === 'formal' ||
        !String(c.name || '').toLowerCase().startsWith('sifir')
    ).length;
  }, [classes]);

  const totalSiswa = useMemo(() => {
    return classes.reduce((sum, c) => sum + Number(c.siswa_count ?? 0), 0);
  }, [classes]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return classes.filter((row) => {
      const isMadin =
        String(row.category || '').toLowerCase() !== 'formal' ||
        String(row.name || '').toLowerCase().startsWith('sifir');
      const isFormal =
        String(row.category || '').toLowerCase() === 'formal' ||
        !String(row.name || '').toLowerCase().startsWith('sifir');

      if (categoryFilter === 'Madin' && !isMadin) return false;
      if (categoryFilter === 'Formal' && !isFormal) return false;

      if (genderFilter !== 'all') {
        const rowGender = String(row.gender_group || '').toUpperCase();
        if (genderFilter === 'PA' && rowGender !== 'PA') return false;
        if (genderFilter === 'PI' && rowGender !== 'PI') return false;
        if (genderFilter === 'Campur' && rowGender !== 'CAMPUR' && rowGender !== '') return false;
      }

      if (!keyword) return true;
      const name = String(row.name ?? '').toLowerCase();
      const code = String(row.code ?? '').toLowerCase();
      const cat = String(row.category ?? '').toLowerCase();
      return name.includes(keyword) || code.includes(keyword) || cat.includes(keyword);
    });
  }, [classes, search, categoryFilter, genderFilter]);

  const columns: DataColumn<ApiRecord>[] = [
    {
      key: 'name',
      header: 'Nama Kelas',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-[#138F81] font-black text-xs border border-teal-100">
            {String(row.name || '').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-extrabold text-slate-800 text-sm">{String(row.name)}</p>
            <p className="text-[11px] font-mono text-slate-400">Kode: {String(row.code || '-')}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Kategori',
      render: (row) => {
        const isFormal =
          String(row.category || '').toLowerCase() === 'formal' ||
          !String(row.name || '').toLowerCase().startsWith('sifir');
        return isFormal ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 border border-sky-200/60">
            <Building size={13} /> Formal / Sekolah
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200/60">
            <BookOpen size={13} /> Madin / Diniyah
          </span>
        );
      },
    },
    {
      key: 'gender_group',
      header: 'Kelompok Gender',
      render: (row) => {
        const g = String(row.gender_group || '').toUpperCase();
        if (g === 'PA') {
          return (
            <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
              👦 Putra (PA)
            </span>
          );
        }
        if (g === 'PI') {
          return (
            <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">
              👧 Putri (PI)
            </span>
          );
        }
        return (
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
            👥 Campur / Umum
          </span>
        );
      },
    },
    {
      key: 'siswa_count',
      header: 'Jumlah Santri',
      render: (row) => {
        const count = Number(row.siswa_count ?? 0);
        return (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold ${
              count > 0 ? 'bg-teal-50 text-teal-800 border border-teal-200/60' : 'bg-slate-50 text-slate-400'
            }`}
          >
            <Users size={13} /> {count} Santri
          </span>
        );
      },
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
            row.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {row.is_active ? 'Aktif' : 'Nonaktif'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Aksi',
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <button
            className="rounded-xl bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors"
            onClick={() => setForm(row)}
            title="Edit Kelas"
            type="button"
          >
            <Pencil size={16} />
          </button>
          <button
            className="rounded-xl bg-rose-50 p-2 text-rose-600 hover:bg-rose-100 hover:text-rose-800 transition-colors"
            onClick={() => setDeleteTarget(row)}
            title="Hapus / Nonaktifkan Kelas"
            type="button"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  async function saveRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!form || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      if (form.id) {
        await api.updateClass(Number(form.id), {
          name: form.name,
          code: form.code,
          category: form.category,
          gender_group: form.gender_group,
          is_active: form.is_active !== false,
        });
        setNotice(`Kelas "${String(form.name)}" berhasil diperbarui.`);
      } else {
        await api.createClass({
          name: form.name,
          code: form.code,
          category: form.category,
          gender_group: form.gender_group,
          is_active: form.is_active !== false,
        });
        setNotice(`Kelas "${String(form.name)}" berhasil ditambahkan.`);
      }
      setForm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan kelas.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRecord() {
    if (!deleteTarget?.id || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      await api.deleteClass(Number(deleteTarget.id));
      setDeleteTarget(null);
      setNotice('Data kelas berhasil diproses.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses data kelas.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <section className="q-page-heading flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#636E72]">Master Data Akademik</p>
          <h1 className="text-3xl font-extrabold text-[#2D3436] flex items-center gap-2.5">
            <GraduationCap className="text-[#138F81]" size={32} />
            Data Kelas (Madin & Sekolah)
          </h1>
          <p className="text-sm font-semibold text-[#636E72]">
            Kelola daftar rombel kelas Madrasah Diniyah (Madin) dan kelas Sekolah Formal santri.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white shadow-lg shadow-[#138F81]/20 hover:brightness-105 transition-all"
            onClick={() =>
              setForm({
                name: '',
                code: '',
                category: categoryFilter === 'Formal' ? 'Formal' : 'Madin',
                gender_group: 'Campur',
                is_active: true,
              })
            }
            type="button"
          >
            <Plus size={17} /> Tambah Kelas Baru
          </button>
          <button
            className={`q-refresh-button flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-[#138F81] ${
              isLoading ? 'is-loading' : ''
            }`}
            onClick={() => void load()}
            type="button"
            disabled={isLoading}
          >
            <RefreshCw className="q-refresh-icon" size={17} />
            {isLoading ? 'Refresh...' : 'Refresh'}
          </button>
        </div>
      </section>

      {/* SUMMARY STAT CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-3xl bg-white p-4.5 border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-[#138F81] font-black">
            <GraduationCap size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">Total Rombel Kelas</p>
            <p className="text-xl font-black text-slate-800">{classes.length} Kelas</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-4.5 border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 font-black">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">Kelas Madin (Diniyah)</p>
            <p className="text-xl font-black text-emerald-800">{totalMadin} Rombel</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-4.5 border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700 font-black">
            <Building size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">Kelas Sekolah Formal</p>
            <p className="text-xl font-black text-sky-800">{totalFormal} Rombel</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-4.5 border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 font-black">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">Total Santri Terhubung</p>
            <p className="text-xl font-black text-amber-800">{totalSiswa.toLocaleString('id-ID')} Santri</p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800 border border-rose-100">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800 border border-emerald-100">
          {notice}
        </div>
      ) : null}

      {/* FILTER & SEARCH CONTROLS */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* CATEGORY TABS */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/50">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-3.5 py-1.5 text-xs font-extrabold rounded-xl transition-all ${
                categoryFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Kelas ({classes.length})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('Madin')}
              className={`px-3.5 py-1.5 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 ${
                categoryFilter === 'Madin'
                  ? 'bg-[#138F81] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen size={13} /> Kelas Madin ({totalMadin})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('Formal')}
              className={`px-3.5 py-1.5 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 ${
                categoryFilter === 'Formal'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building size={13} /> Kelas Sekolah ({totalFormal})
            </button>
          </div>

          {/* GENDER FILTER PILLS */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200/70">
            {[
              { id: 'all', label: 'Semua Gender' },
              { id: 'PA', label: '👦 Putra' },
              { id: 'PI', label: '👧 Putri' },
              { id: 'Campur', label: '👥 Campur' },
            ].map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGenderFilter(g.id as typeof genderFilter)}
                className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all ${
                  genderFilter === g.id
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Cari nama kelas (contoh: VII MTS, Sifir Awal, IX SMP)..."
        />
      </section>

      {/* DATA TABLE */}
      <section className="q-table-container rounded-3xl bg-white p-4 shadow-sm md:p-6 lg:p-8">
        {isLoading ? (
          <div className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-bold text-[#636E72]">
            Memuat data rombel kelas...
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={filtered}
            emptyText="Tidak ada data kelas yang sesuai filter."
          />
        )}
      </section>

      {/* MODAL FORM TAMBAH / EDIT */}
      {form ? (
        <ModalForm
          title={form.id ? 'Edit Data Kelas' : 'Tambah Kelas Baru'}
          onClose={() => setForm(null)}
          footer={
            <button
              className="min-h-12 w-full rounded-2xl bg-[#138F81] text-sm font-extrabold text-white disabled:opacity-60 hover:brightness-105 shadow-md shadow-[#138F81]/20"
              disabled={isSaving}
              form="kelas-form"
              type="submit"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Data Kelas'}
            </button>
          }
        >
          <form id="kelas-form" className="grid gap-4" onSubmit={saveRecord}>
            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold text-slate-700">
                Nama Kelas <span className="text-rose-500">*</span>
              </span>
              <input
                className="q-input font-bold"
                type="text"
                value={String(form.name || '')}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Misal: VII MTS, Sifir Awal A PA, X SMA, MA Assa'adah..."
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-extrabold text-slate-700">
                  Kategori Kelas <span className="text-rose-500">*</span>
                </span>
                <select
                  className="q-input font-bold"
                  value={String(form.category || 'Formal')}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  required
                >
                  <option value="Madin">🕌 Madin / Diniyah</option>
                  <option value="Formal">🏫 Formal / Sekolah</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-extrabold text-slate-700">
                  Kelompok Gender
                </span>
                <select
                  className="q-input font-bold"
                  value={String(form.gender_group || 'Campur')}
                  onChange={(e) => setForm({ ...form, gender_group: e.target.value })}
                >
                  <option value="Campur">👥 Campur / Umum</option>
                  <option value="PA">👦 Putra Saja (PA)</option>
                  <option value="PI">👧 Putri Saja (PI)</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold text-slate-700">
                Kode Kelas (Opsional)
              </span>
              <input
                className="q-input font-mono text-sm"
                type="text"
                value={String(form.code || '')}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="Kosongkan untuk generate otomatis..."
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold text-slate-700">Status Aktif</span>
              <select
                className="q-input font-bold"
                value={form.is_active !== false ? '1' : '0'}
                onChange={(e) => setForm({ ...form, is_active: e.target.value === '1' })}
              >
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </select>
            </label>
          </form>
        </ModalForm>
      ) : null}

      {/* CONFIRM DIALOG HAPUS */}
      {deleteTarget ? (
        <ConfirmDialog
          title="Hapus / Nonaktifkan Kelas?"
          message={`Apakah Anda yakin ingin menghapus kelas "${String(
            deleteTarget.name
          )}"? Jika terdapat santri di kelas ini, sistem akan menonaktifkannya secara aman.`}
          tone="danger"
          confirmLabel="Hapus / Nonaktifkan"
          isBusy={isSaving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void deleteRecord()}
        />
      ) : null}
    </div>
  );
}
