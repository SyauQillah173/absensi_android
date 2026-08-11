import { Plus, RefreshCw, Trash2, Pencil } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type DataColumn } from '../components/DataTable';
import { ModalForm } from '../components/ModalForm';
import { SearchInput } from '../components/SearchInput';
import { api, type ApiRecord } from '../services/api';

export function MasterReferensiPage() {
  const [rows, setRows] = useState<ApiRecord[]>([]);
  const [search, setSearch] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('Semua');
  const [form, setForm] = useState<ApiRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const kategoriOptions = ['Tempat Lahir', 'Kabupaten', 'Desa', 'Negara', 'Kode Pos'];

  async function load() {
    setIsLoading(true);
    setError('');
    setNotice('');
    try {
      const result = await api.masterReferensi();
      setRows(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data gagal dimuat');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase();
    return rows.filter((row) => {
      if (kategoriFilter !== 'Semua' && String(row.kategori) !== kategoriFilter) return false;
      const haystack = JSON.stringify(row).toLowerCase();
      return keyword ? haystack.includes(keyword) : true;
    });
  }, [rows, search, kategoriFilter]);

  const columns: DataColumn[] = [
    { key: 'kategori', label: 'Kategori', format: (val) => String(val) },
    { key: 'nilai', label: 'Nilai Referensi', format: (val) => String(val) },
    {
      key: 'is_active',
      label: 'Status',
      format: (val) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${val ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
          {val ? 'Aktif' : 'Nonaktif'}
        </span>
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
        await api.updateMasterReferensi(Number(form.id), { ...form, is_active: form.is_active !== false });
      } else {
        await api.createMasterReferensi({ ...form, is_active: form.is_active !== false });
      }
      setNotice('Data referensi berhasil disimpan.');
      setForm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan data.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRecord() {
    if (!deleteTarget?.id || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      await api.deleteMasterReferensi(Number(deleteTarget.id));
      setDeleteTarget(null);
      setNotice('Data referensi berhasil dihapus.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data referensi gagal dihapus.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="q-page-heading flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#636E72]">Master Data</p>
          <h1 className="text-3xl font-extrabold text-[#2D3436]">Data Referensi</h1>
          <p className="text-sm font-semibold text-[#636E72]">Kelola opsi dropdown seperti Tempat Lahir, Kabupaten, Negara, dll.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white shadow-lg shadow-[#138F81]/20"
            onClick={() => setForm({ kategori: 'Tempat Lahir', nilai: '', is_active: true })}
            type="button"
          >
            <Plus size={17} /> Tambah Referensi
          </button>
          <button
            className={`q-refresh-button flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-[#138F81] ${isLoading ? 'is-loading' : ''}`}
            onClick={() => void load()}
            type="button"
            disabled={isLoading}
          >
            <RefreshCw className="q-refresh-icon" size={17} />
            {isLoading ? 'Refresh...' : 'Refresh'}
          </button>
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

      <section className="q-filters grid gap-4 md:grid-cols-[1fr_200px]">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari nilai referensi..." />
        <label className="block">
          <span className="sr-only">Filter Kategori</span>
          <select className="q-input" value={kategoriFilter} onChange={(e) => setKategoriFilter(e.target.value)}>
            <option value="Semua">Semua Kategori</option>
            {kategoriOptions.map(kat => <option key={kat} value={kat}>{kat}</option>)}
          </select>
        </label>
      </section>

      <section className="q-table-container rounded-3xl bg-white p-4 shadow-sm md:p-6 lg:p-8">
        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          keyField="id"
          actions={(row) => (
            <div className="flex justify-end gap-2">
              <button
                className="rounded-xl bg-slate-100 p-2 text-[#636E72] hover:bg-slate-200 hover:text-[#2D3436] focus:ring focus:ring-slate-300"
                onClick={() => setForm(row)}
                title="Edit Referensi"
              >
                <Pencil size={18} />
              </button>
              <button
                className="rounded-xl bg-rose-50 p-2 text-rose-600 hover:bg-rose-100 hover:text-rose-800 focus:ring focus:ring-rose-300"
                onClick={() => setDeleteTarget(row)}
                title="Hapus Referensi"
              >
                <Trash2 size={18} />
              </button>
            </div>
          )}
          emptyMessage="Tidak ada data referensi yang ditemukan."
        />
      </section>

      {form ? (
        <ModalForm
          title={form.id ? 'Edit Referensi' : 'Tambah Referensi'}
          onClose={() => setForm(null)}
          footer={
            <button className="min-h-12 w-full rounded-2xl bg-[#138F81] text-sm font-extrabold text-white disabled:opacity-60" disabled={isSaving} form="referensi-form" type="submit">
              {isSaving ? 'Menyimpan...' : 'Simpan Data'}
            </button>
          }
        >
          <form id="referensi-form" className="grid gap-4" onSubmit={saveRecord}>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#636E72]">Kategori</span>
              <select className="q-input" value={String(form.kategori || '')} onChange={(e) => setForm({ ...form, kategori: e.target.value })} required>
                {kategoriOptions.map(kat => <option key={kat} value={kat}>{kat}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#636E72]">Nilai (Opsi Dropdown)</span>
              <input
                className="q-input"
                type="text"
                value={String(form.nilai || '')}
                onChange={(e) => setForm({ ...form, nilai: e.target.value })}
                required
                placeholder="Misal: Jakarta, Indonesia, 12345"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#636E72]">Status Aktif</span>
              <select className="q-input" value={form.is_active !== false ? '1' : '0'} onChange={(e) => setForm({ ...form, is_active: e.target.value === '1' })}>
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </select>
            </label>
          </form>
        </ModalForm>
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Hapus Referensi?"
          message={`Opsi referensi "${String(deleteTarget.nilai)}" akan dihapus secara permanen.`}
          tone="danger"
          confirmLabel="Hapus"
          isBusy={isSaving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void deleteRecord()}
        />
      ) : null}
    </div>
  );
}
