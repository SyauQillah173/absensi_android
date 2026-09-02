import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ComplexReferensiForm } from '../components/ComplexReferensiForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type DataColumn } from '../components/DataTable';

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

  const kategoriOptions = useMemo(() => {
    const kats = new Set(['agama', 'pekerjaan', 'pendidikan', 'penghasilan', 'golongan_darah', 'status_keluarga', 'negara', ...rows.map(r => String(r.kategori))]);
    return Array.from(kats).sort();
  }, [rows]);

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
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (kategoriFilter !== 'Semua' && String(row.kategori) !== kategoriFilter) return false;
      if (!keyword) return true;
      const kategori = String(row.kategori ?? '').toLowerCase();
      const nilai = String(row.nilai ?? '').toLowerCase();
      const kode = String(row.kode ?? '').toLowerCase();
      const keterangan = String(row.keterangan ?? '').toLowerCase();
      return kategori.includes(keyword) || nilai.includes(keyword) || kode.includes(keyword) || keterangan.includes(keyword);
    });
  }, [rows, search, kategoriFilter]);

  const columns: DataColumn<ApiRecord>[] = [
    {
      key: 'kategori',
      header: 'Kategori',
      sortable: true,
      sortValue: (row) => String(row.kategori ?? ''),
      render: (row) => (
        <span className="font-extrabold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg text-xs">
          {String(row.kategori).toUpperCase()}
        </span>
      ),
    },
    {
      key: 'nilai',
      header: 'Nilai (Label Opsi)',
      sortable: true,
      sortValue: (row) => String(row.nilai ?? ''),
      render: (row) => <span className="font-extrabold text-slate-900 text-sm">{String(row.nilai)}</span>,
    },
    {
      key: 'is_active',
      header: 'Status',
      sortable: true,
      sortValue: (row) => (row.is_active !== false ? 1 : 0),
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-black ${
            row.is_active !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${row.is_active !== false ? 'bg-emerald-500' : 'bg-rose-500'}`} />
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

  // JIKA FORM REFERENSI TERBUKA, TAMPILKAN IN-PAGE FORM KONSISTEN
  if (form !== null) {
    return (
      <ComplexReferensiForm
        initialData={form.id ? form : null}
        kategoriOptions={kategoriOptions}
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
      <section className="q-page-heading flex flex-wrap items-end justify-between gap-4">

        <div>
          <p className="text-sm font-bold text-[#636E72]">Master Data</p>
          <h1 className="text-3xl font-extrabold text-[#2D3436]">Data Referensi</h1>
          <p className="text-sm font-semibold text-[#636E72]">Kelola opsi dropdown seperti Tempat Lahir, Kabupaten, Negara, dll.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white shadow-lg shadow-[#138F81]/20"
            onClick={() => setForm({ kategori: 'agama', nilai: '', is_active: true })}
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
        {isLoading ? (
          <div className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-bold text-[#636E72]">Memuat data...</div>
        ) : (
          <DataTable
            columns={columns}
            rows={filtered}
            emptyText="Tidak ada data referensi yang ditemukan."
          />
        )}
      </section>



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
