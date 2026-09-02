import {
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type DataColumn } from '../components/DataTable';
import { SearchInput } from '../components/SearchInput';
import { api, type ApiRecord } from '../services/api';

export function MasterKelasPage() {
  const [classes, setClasses] = useState<ApiRecord[]>([]);
  const [search, setSearch] = useState('');
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
    try {
      const result = await api.classes();
      const raw = Array.isArray(result.data) ? result.data : [];
      // Filter classes to only include Madin / Diniyah
      const madinOnly = raw.filter(
        (c) =>
          String(c.category || '').toLowerCase() !== 'formal' ||
          String(c.name || '').toLowerCase().startsWith('sifir') ||
          String(c.name || '').toLowerCase().includes('ibtidaiyah') ||
          String(c.name || '').toLowerCase().includes('tsanawiyah') ||
          String(c.name || '').toLowerCase().includes('aliyah')
      );
      setClasses(madinOnly.length > 0 ? madinOnly : raw);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data kelas Madin gagal dimuat');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totalPa = useMemo(() => {
    return classes.filter((c) => String(c.gender_group || '').toUpperCase() === 'PA').length;
  }, [classes]);

  const totalPi = useMemo(() => {
    return classes.filter((c) => String(c.gender_group || '').toUpperCase() === 'PI').length;
  }, [classes]);

  const totalSiswa = useMemo(() => {
    return classes.reduce((sum, c) => sum + Number(c.siswa_count ?? 0), 0);
  }, [classes]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return classes.filter((row) => {
      if (genderFilter !== 'all') {
        const rowGender = String(row.gender_group || '').toUpperCase();
        if (genderFilter === 'PA' && rowGender !== 'PA') return false;
        if (genderFilter === 'PI' && rowGender !== 'PI') return false;
        if (genderFilter === 'Campur' && rowGender !== 'CAMPUR' && rowGender !== '') return false;
      }

      if (!keyword) return true;
      const name = String(row.name ?? '').toLowerCase();
      const code = String(row.code ?? '').toLowerCase();
      return name.includes(keyword) || code.includes(keyword);
    });
  }, [classes, search, genderFilter]);

  const columns: DataColumn<ApiRecord>[] = [
    {
      key: 'name',
      header: 'Nama Kelas Madin',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-[#138F81] font-black text-sm border border-teal-100 shadow-xs">
            <BookOpen size={18} />
          </div>
          <div>
            <p className="font-extrabold text-slate-800 text-sm">{String(row.name)}</p>
            <p className="text-[11px] font-mono text-slate-400">Kode: {String(row.code || '-')}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'gender_group',
      header: 'Kelompok Santri',
      render: (row) => {
        const g = String(row.gender_group || '').toUpperCase();
        if (g === 'PA') {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700 border border-blue-200/60">
              👦 Putra (PA)
            </span>
          );
        }
        if (g === 'PI') {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-1 text-xs font-extrabold text-rose-700 border border-rose-200/60">
              👧 Putri (PI)
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600 border border-slate-200/60">
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
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold ${
              count > 0
                ? 'bg-teal-50 text-teal-800 border border-teal-200/60'
                : 'bg-slate-50 text-slate-400 border border-slate-200/40'
            }`}
          >
            <Users size={14} /> {count} Santri
          </span>
        );
      },
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold ${
            row.is_active !== false
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${row.is_active !== false ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {row.is_active !== false ? 'Aktif' : 'Nonaktif'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Aksi',
      render: (row) => (
        <div className="flex justify-end gap-2">
          <button
            className="rounded-xl bg-[#EAF4FF] px-3.5 py-2 text-xs font-extrabold text-[#2E86DE] hover:bg-[#d8ecff] transition-colors inline-flex items-center gap-1.5"
            onClick={() => setForm(row)}
            type="button"
          >
            <Pencil size={13} /> Edit Kelas
          </button>
          <button
            className="rounded-xl bg-[#FDECEC] px-3.5 py-2 text-xs font-extrabold text-[#D63031] hover:bg-[#fad4d4] transition-colors inline-flex items-center gap-1.5"
            onClick={() => setDeleteTarget(row)}
            type="button"
          >
            <Trash2 size={13} /> Hapus
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
      const payload = {
        name: form.name,
        code: form.code || String(form.name).toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        category: 'Madin',
        gender_group: form.gender_group || 'Campur',
        is_active: form.is_active !== false,
      };

      if (form.id) {
        await api.updateClass(Number(form.id), payload);
        setNotice(`Kelas Madin "${String(form.name)}" berhasil diperbarui.`);
      } else {
        await api.createClass(payload);
        setNotice(`Kelas Madin "${String(form.name)}" berhasil ditambahkan.`);
      }
      setForm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan data kelas Madin.');
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
          <p className="text-sm font-bold text-[#636E72]">Master Data Akademik & KBM</p>
          <h1 className="text-3xl font-extrabold text-[#2D3436] flex items-center gap-2.5">
            <GraduationCap className="text-[#138F81]" size={32} />
            Data Kelas Madin (Diniyah)
          </h1>
          <p className="text-sm font-semibold text-[#636E72]">
            Kelola daftar rombel kelas Madrasah Diniyah santri Pondok Pesantren Qomaruddin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white shadow-lg shadow-[#138F81]/20 hover:brightness-105 transition-all"
            onClick={() =>
              setForm({
                name: '',
                code: '',
                category: 'Madin',
                gender_group: 'PA',
                is_active: true,
              })
            }
            type="button"
          >
            <Plus size={17} /> Tambah Kelas Madin
          </button>
          <button
            className={`q-refresh-button flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-[#138F81] border border-slate-200/70 shadow-xs ${
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
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">Total Rombel Madin</p>
            <p className="text-xl font-black text-slate-800">{classes.length} Kelas</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-4.5 border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 font-black">
            <span className="text-xl">👦</span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">Kelas Putra (PA)</p>
            <p className="text-xl font-black text-blue-800">{totalPa} Rombel</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-4.5 border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-700 font-black">
            <span className="text-xl">👧</span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400">Kelas Putri (PI)</p>
            <p className="text-xl font-black text-rose-800">{totalPi} Rombel</p>
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
        <div className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800 border border-rose-100 flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800 border border-emerald-100 flex items-center gap-2">
          <span>✅</span> {notice}
        </div>
      ) : null}

      {/* FILTER & SEARCH CONTROLS */}
      <section className="flex flex-wrap items-center justify-between gap-3">
        {/* GENDER FILTER PILLS */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/70">
          {[
            { id: 'all', label: `Semua Rombel (${classes.length})` },
            { id: 'PA', label: `👦 Putra (${totalPa})` },
            { id: 'PI', label: `👧 Putri (${totalPi})` },
            { id: 'Campur', label: '👥 Campur' },
          ].map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGenderFilter(g.id as typeof genderFilter)}
              className={`px-3.5 py-1.5 text-xs font-extrabold rounded-xl transition-all ${
                genderFilter === g.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-80">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari kelas Madin (Sifir, Awal, PA/PI)..."
          />
        </div>
      </section>

      {/* DATA TABLE */}
      <section className="q-table-container rounded-3xl bg-white p-4 shadow-sm md:p-6 lg:p-8">
        {isLoading ? (
          <div className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-bold text-[#636E72]">
            Memuat data rombel kelas Madin...
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={filtered}
            emptyText="Tidak ada data kelas Madin yang sesuai filter."
          />
        )}
      </section>

      {/* MODAL FORM TAMBAH / EDIT KELAS (KONSISTEN DENGAN FORM SANTRI & MADIN) */}
      {form ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            {/* Modal Header Banner */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-teal-50/70 via-emerald-50/50 to-white p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#138F81] text-white shadow-md shadow-[#138F81]/20">
                  <GraduationCap size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#2D3436]">
                    {form.id ? 'Edit Data Kelas Madin' : 'Tambah Kelas Madin Baru'}
                  </h3>
                  <p className="text-xs font-semibold text-[#636E72]">
                    Atur nama rombel dan pengelompokan kelas santri
                  </p>
                </div>
              </div>
              <button
                onClick={() => setForm(null)}
                className="rounded-2xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form id="kelas-madin-form" className="p-6 space-y-4.5" onSubmit={saveRecord}>
              {/* Field: Nama Kelas */}
              <div>
                <label className="mb-1.5 block text-xs font-extrabold text-slate-700">
                  Nama Kelas Madin <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:bg-white focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                    type="text"
                    value={String(form.name || '')}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    placeholder="Contoh: Sifir Awal A PA, 1 Ibtidaiyah B PI..."
                  />
                </div>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  Format nama rombel dianjurkan mencantumkan tingkatan dan gender (PA / PI).
                </p>
              </div>

              {/* Field: Kode Kelas */}
              <div>
                <label className="mb-1.5 block text-xs font-extrabold text-slate-700">
                  Kode Unik Kelas (Opsional)
                </label>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-mono font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:bg-white focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                  type="text"
                  value={String(form.code || '')}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="Contoh: sifir_awal_a_pa (otomatis diisi jika kosong)"
                />
              </div>

              {/* Field: Kelompok Gender Santri */}
              <div>
                <label className="mb-2 block text-xs font-extrabold text-slate-700">
                  Kelompok Santri <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'PA', label: '👦 Putra (PA)', desc: 'Santri Putra' },
                    { id: 'PI', label: '👧 Putri (PI)', desc: 'Santri Putri' },
                    { id: 'Campur', label: '👥 Campur', desc: 'Umum' },
                  ].map((g) => {
                    const isSelected = String(form.gender_group || 'PA').toUpperCase() === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setForm({ ...form, gender_group: g.id })}
                        className={`rounded-2xl p-3 text-center border transition-all ${
                          isSelected
                            ? 'bg-[#138F81]/10 border-[#138F81] text-[#138F81] font-black shadow-xs ring-2 ring-[#138F81]/20'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 font-bold'
                        }`}
                      >
                        <p className="text-xs">{g.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Field: Status Aktif Toggle */}
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <div>
                  <p className="text-xs font-extrabold text-slate-800">Status Kelas</p>
                  <p className="text-[11px] font-semibold text-slate-500">
                    Kelas aktif dapat dipilih pada jadwal KBM dan presensi santri.
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={form.is_active !== false}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                  <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:top-[2px] after:start-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#138F81] peer-checked:after:translate-x-full peer-focus:outline-hidden"></div>
                </label>
              </div>

              {/* Modal Actions Footer */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setForm(null)}
                  className="w-1/3 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-extrabold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-2/3 rounded-2xl bg-[#138F81] py-3 text-sm font-extrabold text-white shadow-lg shadow-[#138F81]/25 hover:brightness-105 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={18} />
                  {isSaving ? 'Menyimpan...' : 'Simpan Data Kelas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* CONFIRM DELETE DIALOG */}
      {deleteTarget ? (
        <ConfirmDialog
          title="Hapus Kelas Madin"
          message={`Apakah Anda yakin ingin menghapus kelas "${String(deleteTarget.name)}"? Data relasi presensi santri lama tetap dijaga.`}
          tone="danger"
          isBusy={isSaving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void deleteRecord()}
        />
      ) : null}
    </div>
  );
}
