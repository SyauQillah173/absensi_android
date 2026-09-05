import {
  Building2,
  Check,
  DoorOpen,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  UserPlus,
  UsersRound,
  X
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ComplexAssignSantriInPageForm, ComplexImportSantriForm, ComplexKamarForm, ComplexKomplekForm } from '../components/ComplexPondokKamarForms';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable, type DataColumn } from '../components/DataTable';

import { SearchInput } from '../components/SearchInput';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { api, type ApiRecord } from '../services/api';

type PondokTab = 'komplek' | 'kamar' | 'santri';
type ConfirmState = {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'danger' | 'warning';
  action: () => Promise<void>;
};

const tabs = [
  { id: 'komplek', label: 'Komplek' },
  { id: 'kamar', label: 'Kamar' },
  { id: 'santri', label: 'Santri Pondok' }
];

function text(value: unknown, fallback = '-'): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function num(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function bool(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 0 || value === '0' || String(value).toLowerCase() === 'false') return false;
  if (value === 1 || value === '1' || String(value).toLowerCase() === 'true') return true;
  return fallback;
}

function record(value: unknown): ApiRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ApiRecord) : {};
}

function roomsOf(complex: ApiRecord): ApiRecord[] {
  return Array.isArray(complex.rooms) ? (complex.rooms as ApiRecord[]) : [];
}

export function DataPondokPage() {
  const [activeTab, setActiveTab] = useState<PondokTab>('komplek');
  const [complexes, setComplexes] = useState<ApiRecord[]>([]);
  const [santri, setSantri] = useState<ApiRecord[]>([]);
  const [students, setStudents] = useState<ApiRecord[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [complexModal, setComplexModal] = useState<ApiRecord | 'new' | null>(null);
  const [roomModal, setRoomModal] = useState<ApiRecord | 'new' | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const rooms = useMemo(() => complexes.flatMap((complex) => roomsOf(complex).map((room) => ({ ...room, complex }))), [complexes]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError('');
    try {
      const [complexResult, santriResult, siswaResult] = await Promise.all([
        api.boardingComplexes(),
        api.boardingStudents({ include_inactive: 1 }),
        api.siswa({ status: 'Aktif', limit: 500 })
      ]);
      setComplexes(Array.isArray(complexResult.data) ? complexResult.data : []);
      setSantri(Array.isArray(santriResult.data) ? santriResult.data : []);
      setStudents(Array.isArray(siswaResult.data) ? siswaResult.data : []);
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Data pondok gagal dimuat');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    // 1. Auto-refresh saat event app:data-updated dipicu
    const handleDataUpdate = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (!customEvt.detail || customEvt.detail.type === 'pondok' || customEvt.detail.type === 'all') {
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
      if (document.visibilityState === 'visible' && complexModal === null && roomModal === null && !assignOpen && !importOpen) {
        void load(true);
      }
    }, 60000);

    return () => {
      window.removeEventListener('app:data-updated', handleDataUpdate);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [load, complexModal, roomModal, assignOpen, importOpen]);


  const filteredSantri = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return santri;
    return santri.filter((row) => {
      const nama = String(record(row.siswa).nama ?? row.nama ?? '').toLowerCase();
      const nis = String(record(row.siswa).nis ?? row.nis ?? '').toLowerCase();
      const kamar = String(record(row.kamar).name ?? row.kamar_nama ?? row.kamar ?? '').toLowerCase();
      const komplek = String(record(row.komplek).name ?? row.komplek_nama ?? row.komplek ?? '').toLowerCase();
      return nama.includes(keyword) || nis.includes(keyword) || kamar.includes(keyword) || komplek.includes(keyword);
    });
  }, [santri, search]);

  const filteredComplexes = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return complexes;
    return complexes.filter((row) => {
      const name = String(row.name ?? row.nama ?? '').toLowerCase();
      const code = String(row.code ?? row.kode ?? '').toLowerCase();
      const gender = String(row.gender ?? '').toLowerCase();
      return name.includes(keyword) || code.includes(keyword) || gender.includes(keyword);
    });
  }, [complexes, search]);

  const filteredRooms = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rooms;
    return rooms.filter((r) => {
      const row = r as ApiRecord;
      const name = String(row.name ?? row.nama ?? '').toLowerCase();
      const code = String(row.code ?? row.kode ?? '').toLowerCase();
      const komplek = String(record(row.complex).name ?? row.komplek ?? '').toLowerCase();
      return name.includes(keyword) || code.includes(keyword) || komplek.includes(keyword);
    });
  }, [rooms, search]);

  async function updateSantriStatus(row: ApiRecord, status: 'Aktif' | 'Nonaktif') {
    setNotice('');
    try {
      await api.updateBoardingSantri(num(row.id), {
        status,
        participates_prayer: status === 'Aktif'
      });
      setNotice(status === 'Aktif' ? 'Santri diaktifkan dan otomatis ikut sholat.' : 'Santri dinonaktifkan dari pondok.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status santri gagal diperbarui');
    }
  }

  async function deleteSantri(row: ApiRecord) {
    setConfirmState({
      title: 'Hapus Relasi Santri',
      message: `Hapus relasi pondok untuk ${text(row.siswa_nama ?? row.nama, 'santri ini')}? Data siswa utama tetap aman.`,
      confirmLabel: 'Hapus Relasi',
      tone: 'danger',
      action: async () => {
        setNotice('');
        await api.deleteBoardingSantri(num(row.id));
        setNotice('Relasi santri pondok berhasil dihapus atau diarsipkan.');
        await load();
      }
    });
  }

  const complexColumns: DataColumn<ApiRecord>[] = [
    {
      key: 'name',
      header: 'Komplek Asrama',
      sortable: true,
      sortValue: (row) => String(row.name ?? ''),
      render: (row) => <span className="font-extrabold text-slate-800">{text(row.name)}</span>
    },
    {
      key: 'rooms',
      header: 'Jumlah Kamar',
      sortable: true,
      sortValue: (row) => roomsOf(row).length,
      render: (row) => <span className="font-bold text-xs bg-slate-100 px-2.5 py-1 rounded-lg text-slate-700">{roomsOf(row).length} Kamar</span>
    },
    {
      key: 'jumlah',
      header: 'Jumlah Santri',
      sortable: true,
      sortValue: (row) => num(row.jumlah_santri),
      render: (row) => <span className="font-extrabold text-xs text-[#138F81] bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200/60">{num(row.jumlah_santri)} Santri</span>
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (row) => (bool(row.is_active) ? 1 : 0),
      render: (row) => <StatusBadge label={bool(row.is_active) ? 'Aktif' : 'Nonaktif'} tone={bool(row.is_active) ? 'success' : 'danger'} />
    },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (row) => (
        <div className="flex gap-2">
          <button className="rounded-xl bg-[#E1EFF7] px-3 py-2 text-[#2E86DE] hover:bg-[#cde4f2] transition-colors" onClick={() => setComplexModal(row)} type="button">
            <Pencil size={16} />
          </button>
          <button className="rounded-xl bg-[#FFF0E8] px-3 py-2 text-[#E8590C] hover:bg-[#ffe0d1] transition-colors" onClick={() => void deleteComplex(row)} type="button">
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ];

  const roomColumns: DataColumn<ApiRecord>[] = [
    {
      key: 'name',
      header: 'Kamar Pondok',
      sortable: true,
      sortValue: (row) => String(row.name ?? ''),
      render: (row) => <span className="font-extrabold text-slate-800">{text(row.name)}</span>
    },
    {
      key: 'complex',
      header: 'Komplek Asrama',
      sortable: true,
      sortValue: (row) => String(record(row.complex).name ?? ''),
      render: (row) => <span className="font-semibold text-xs text-slate-600">{text(record(row.complex).name)}</span>
    },
    {
      key: 'capacity',
      header: 'Kapasitas',
      sortable: true,
      sortValue: (row) => num(row.capacity),
      render: (row) => <span className="font-bold text-xs text-slate-600">{text(row.capacity, 'Bebas')}</span>
    },
    {
      key: 'jumlah',
      header: 'Santri Terisi',
      sortable: true,
      sortValue: (row) => num(row.jumlah_santri),
      render: (row) => <span className="font-black text-xs text-[#138F81] bg-teal-50 px-2 py-0.5 rounded-md">{num(row.jumlah_santri)} Santri</span>
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (row) => (bool(row.is_active) ? 1 : 0),
      render: (row) => <StatusBadge label={bool(row.is_active) ? 'Aktif' : 'Nonaktif'} tone={bool(row.is_active) ? 'success' : 'danger'} />
    },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (row) => (
        <div className="flex gap-2">
          <button className="rounded-xl bg-[#E1EFF7] px-3 py-2 text-[#2E86DE] hover:bg-[#cde4f2] transition-colors" onClick={() => setRoomModal(row)} type="button">
            <Pencil size={16} />
          </button>
          <button className="rounded-xl bg-[#FFF0E8] px-3 py-2 text-[#E8590C] hover:bg-[#ffe0d1] transition-colors" onClick={() => void deleteRoom(row)} type="button">
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ];

  const santriColumns: DataColumn<ApiRecord>[] = [
    {
      key: 'nama',
      header: 'Santri',
      sortable: true,
      sortValue: (row) => String(row.siswa_nama ?? row.nama ?? ''),
      render: (row) => <span className="font-extrabold text-slate-800">{text(row.siswa_nama ?? row.nama)}</span>
    },
    {
      key: 'nis',
      header: 'NIS',
      sortable: true,
      sortValue: (row) => String(row.nis ?? record(row.siswa).nis ?? ''),
      render: (row) => <span className="font-mono text-xs text-slate-500 font-bold">{text(row.nis ?? record(row.siswa).nis)}</span>
    },
    {
      key: 'kelas',
      header: 'Kelas',
      sortable: true,
      sortValue: (row) => String(row.kelas ?? record(row.siswa).kelas ?? ''),
      render: (row) => <span className="text-xs font-bold text-slate-600">{text(row.kelas ?? record(row.siswa).kelas)}</span>
    },
    {
      key: 'komplek',
      header: 'Komplek',
      sortable: true,
      sortValue: (row) => String(row.complex_name ?? row.komplek ?? record(row.complex).name ?? ''),
      render: (row) => <span className="text-xs font-bold text-slate-700">{text(row.complex_name ?? row.komplek ?? record(row.complex).name)}</span>
    },
    {
      key: 'kamar',
      header: 'Kamar',
      sortable: true,
      sortValue: (row) => String(row.room_name ?? row.kamar ?? record(row.room).name ?? ''),
      render: (row) => <span className="font-bold text-xs text-[#138F81] bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">{text(row.room_name ?? row.kamar ?? record(row.room).name)}</span>
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (row) => (text(row.status).toLowerCase() !== 'nonaktif' && row.is_active !== false ? 1 : 0),
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={text(row.status, bool(row.is_active) ? 'Aktif' : 'Nonaktif')} tone={text(row.status).toLowerCase() === 'nonaktif' || row.is_active === false ? 'danger' : 'success'} />
          <StatusBadge label={bool(row.participates_prayer, false) ? 'Ikut sholat' : 'Tidak ikut sholat'} tone={bool(row.participates_prayer, false) ? 'info' : 'neutral'} />
        </div>
      )
    },

    {
      key: 'aksi',
      header: 'Aksi',
      render: (row) => {
        const active = text(row.status).toLowerCase() !== 'nonaktif' && row.is_active !== false;
        return (
          <div className="flex gap-2">
            <button
              className="rounded-xl bg-[#E8F7F3] px-3 py-2 text-[#138F81]"
              onClick={() => void updateSantriStatus(row, active ? 'Nonaktif' : 'Aktif')}
              type="button"
              title={active ? 'Nonaktifkan' : 'Aktifkan'}
            >
              {active ? <X size={16} /> : <Check size={16} />}
            </button>
            <button className="rounded-xl bg-[#FFF0E8] px-3 py-2 text-[#E8590C]" onClick={() => void deleteSantri(row)} type="button" title="Hapus relasi">
              <Trash2 size={16} />
            </button>
          </div>
        );
      }
    }
  ];

  async function deleteComplex(row: ApiRecord) {
    setConfirmState({
      title: 'Hapus / Nonaktifkan Komplek',
      message: `Komplek ${text(row.name)} akan dihapus jika belum dipakai, atau dinonaktifkan jika sudah punya relasi.`,
      confirmLabel: 'Proses',
      tone: 'warning',
      action: async () => {
        await api.deleteBoardingComplex(num(row.id));
        setNotice('Komplek berhasil diproses.');
        await load();
      }
    });
  }

  async function deleteRoom(row: ApiRecord) {
    setConfirmState({
      title: 'Hapus / Nonaktifkan Kamar',
      message: `Kamar ${text(row.name)} akan dihapus jika belum dipakai, atau dinonaktifkan jika sudah punya santri/riwayat.`,
      confirmLabel: 'Proses',
      tone: 'warning',
      action: async () => {
        await api.deleteBoardingRoom(num(row.id));
        setNotice('Kamar berhasil diproses.');
        await load();
      }
    });
  }

  async function runConfirm() {
    if (!confirmState || confirmBusy) return;
    setConfirmBusy(true);
    setError('');
    try {
      await confirmState.action();
      setConfirmState(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aksi gagal diproses');
    } finally {
      setConfirmBusy(false);
    }
  }

  async function downloadExcel() {
    try {
      const blob = await api.exportBoardingSantri();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Data_Santri_Pondok_Qomaruddin.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Gagal mendownload file Excel');
    }
  }

  // JIKA FORM IN-PAGE SEDANG TERBUKA, RENDER IN-PAGE CONTAINER TANPA POPUP
  if (complexModal !== null) {
    return (
      <ComplexKomplekForm
        initial={complexModal === 'new' ? null : complexModal}
        onClose={() => setComplexModal(null)}
        onSaved={() => void load(true)}
      />
    );
  }

  if (roomModal !== null) {
    return (
      <ComplexKamarForm
        complexes={complexes}
        initial={roomModal === 'new' ? null : roomModal}
        onClose={() => setRoomModal(null)}
        onSaved={() => void load(true)}
      />
    );
  }

  if (assignOpen) {
    return (
      <ComplexAssignSantriInPageForm
        complexes={complexes}
        students={students}
        santri={santri}
        onClose={() => setAssignOpen(false)}
        onSaved={() => void load(true)}
      />
    );
  }

  if (importOpen) {
    return (
      <ComplexImportSantriForm
        onClose={() => setImportOpen(false)}
        onSaved={() => void load(true)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 🌟 HEADER CARD DATA PONDOK */}
      <div className="q-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-[#E1EFF7] text-[#138F81] border border-teal-100 flex items-center justify-center shrink-0 shadow-xs">
            <Building2 className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#636E72]">
                Asrama & Kamar Santri
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#FFDC80] text-[#0D7A6F] border border-amber-300">
                Pondok Pesantren
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#2D3436] tracking-tight">Data Kamar Pondok</h1>
            <p className="text-xs sm:text-sm font-medium text-[#636E72] mt-0.5">Kelola master komplek asrama, kamar santri, dan penempatan kamar pondok.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`q-refresh-button flex min-h-11 items-center gap-2 rounded-2xl bg-white border border-slate-200/80 px-4 text-sm font-bold text-[#138F81] hover:bg-slate-50 transition-all cursor-pointer shadow-xs ${isLoading ? 'is-loading' : ''}`}
            onClick={() => void load()}
            type="button"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            <RefreshCw className="q-refresh-icon" size={17} />
            {isLoading ? 'Menyegarkan...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
      {notice ? <div className="rounded-2xl bg-[#E8F7F3] px-4 py-3 text-sm font-bold text-[#138F81]">{notice}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Komplek" value={complexes.length} subtitle="Master komplek" icon={Building2} tone="teal" />
        <StatCard title="Kamar" value={rooms.length} subtitle="Master kamar" icon={DoorOpen} tone="blue" />
        <StatCard title="Santri Pondok" value={santri.length} subtitle="Relasi pondok" icon={UsersRound} tone="orange" />
      </div>

      <SegmentedTabs tabs={tabs} active={activeTab} onChange={(id) => setActiveTab(id as PondokTab)} />

      <section className="q-panel p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap gap-3">
          <div className="min-w-[240px] flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Cari nama / NIS / komplek / kamar" />
          </div>
          {activeTab === 'komplek' ? (
            <button className="flex min-h-12 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-bold text-white" onClick={() => setComplexModal('new')} type="button">
              <Plus size={18} />
              Tambah Komplek
            </button>
          ) : null}
          {activeTab === 'kamar' ? (
            <button className="flex min-h-12 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-bold text-white" onClick={() => setRoomModal('new')} type="button">
              <Plus size={18} />
              Tambah Kamar
            </button>
          ) : null}
          {activeTab === 'santri' ? (
            <>
              <button className="flex min-h-12 items-center gap-2 rounded-2xl bg-[#F0F7F4] px-4 text-sm font-bold text-[#138F81]" onClick={() => void downloadExcel()} type="button">
                <Download size={18} />
                Export
              </button>
              <button className="flex min-h-12 items-center gap-2 rounded-2xl bg-[#FFF8E6] px-4 text-sm font-bold text-[#E67E22]" onClick={() => setImportOpen(true)} type="button">
                <Upload size={18} />
                Import
              </button>
              <button className="flex min-h-12 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-bold text-white" onClick={() => setAssignOpen(true)} type="button">
                <UserPlus size={18} />
                Atur Santri
              </button>
            </>
          ) : null}
        </div>

        {isLoading ? (
          <div className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-bold text-[#636E72]">Memuat data pondok...</div>
        ) : activeTab === 'komplek' ? (
          <DataTable rows={filteredComplexes} columns={complexColumns} emptyText="Belum ada komplek." />
        ) : activeTab === 'kamar' ? (
          <DataTable rows={filteredRooms} columns={roomColumns} emptyText="Belum ada kamar." />
        ) : (
          <DataTable rows={filteredSantri} columns={santriColumns} emptyText="Belum ada santri pondok." />
        )}
      </section>

      {confirmState ? (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          tone={confirmState.tone}
          isBusy={confirmBusy}
          onCancel={() => setConfirmState(null)}
          onConfirm={() => void runConfirm()}
        />
      ) : null}
    </div>
  );
}
