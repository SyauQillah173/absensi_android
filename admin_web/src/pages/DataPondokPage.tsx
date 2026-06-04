import { Building2, Check, DoorOpen, Pencil, Plus, RefreshCw, Save, Trash2, UserPlus, UsersRound, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DataTable, type DataColumn } from '../components/DataTable';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ModalForm } from '../components/ModalForm';
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
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const rooms = useMemo(() => complexes.flatMap((complex) => roomsOf(complex).map((room) => ({ ...room, complex }))), [complexes]);

  async function load() {
    setIsLoading(true);
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
      setError(err instanceof Error ? err.message : 'Data pondok gagal dimuat');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredSantri = useMemo(() => {
    const keyword = search.toLowerCase();
    if (!keyword) return santri;
    return santri.filter((row) => JSON.stringify(row).toLowerCase().includes(keyword));
  }, [santri, search]);

  const filteredComplexes = useMemo(() => {
    const keyword = search.toLowerCase();
    if (!keyword) return complexes;
    return complexes.filter((row) => JSON.stringify(row).toLowerCase().includes(keyword));
  }, [complexes, search]);

  const filteredRooms = useMemo(() => {
    const keyword = search.toLowerCase();
    if (!keyword) return rooms;
    return rooms.filter((row) => JSON.stringify(row).toLowerCase().includes(keyword));
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
    { key: 'name', header: 'Komplek', render: (row) => <span className="font-extrabold">{text(row.name)}</span> },
    { key: 'rooms', header: 'Kamar', render: (row) => roomsOf(row).length },
    { key: 'jumlah', header: 'Santri', render: (row) => num(row.jumlah_santri) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge label={bool(row.is_active) ? 'Aktif' : 'Nonaktif'} tone={bool(row.is_active) ? 'success' : 'danger'} /> },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (row) => (
        <div className="flex gap-2">
          <button className="rounded-xl bg-[#E1EFF7] px-3 py-2 text-[#2E86DE]" onClick={() => setComplexModal(row)} type="button">
            <Pencil size={16} />
          </button>
          <button className="rounded-xl bg-[#FFF0E8] px-3 py-2 text-[#E8590C]" onClick={() => void deleteComplex(row)} type="button">
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ];

  const roomColumns: DataColumn<ApiRecord>[] = [
    { key: 'name', header: 'Kamar', render: (row) => <span className="font-extrabold">{text(row.name)}</span> },
    { key: 'complex', header: 'Komplek', render: (row) => text(record(row.complex).name) },
    { key: 'capacity', header: 'Kapasitas', render: (row) => text(row.capacity, 'Tidak diatur') },
    { key: 'jumlah', header: 'Santri', render: (row) => num(row.jumlah_santri) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge label={bool(row.is_active) ? 'Aktif' : 'Nonaktif'} tone={bool(row.is_active) ? 'success' : 'danger'} /> },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (row) => (
        <div className="flex gap-2">
          <button className="rounded-xl bg-[#E1EFF7] px-3 py-2 text-[#2E86DE]" onClick={() => setRoomModal(row)} type="button">
            <Pencil size={16} />
          </button>
          <button className="rounded-xl bg-[#FFF0E8] px-3 py-2 text-[#E8590C]" onClick={() => void deleteRoom(row)} type="button">
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ];

  const santriColumns: DataColumn<ApiRecord>[] = [
    { key: 'nama', header: 'Santri', render: (row) => <span className="font-extrabold">{text(row.siswa_nama ?? row.nama)}</span> },
    { key: 'nis', header: 'NIS', render: (row) => text(row.nis ?? record(row.siswa).nis) },
    { key: 'kelas', header: 'Kelas', render: (row) => text(row.kelas ?? record(row.siswa).kelas) },
    { key: 'komplek', header: 'Komplek', render: (row) => text(row.complex_name ?? row.komplek ?? record(row.complex).name) },
    { key: 'kamar', header: 'Kamar', render: (row) => text(row.room_name ?? row.kamar ?? record(row.room).name) },
    {
      key: 'status',
      header: 'Status',
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

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#636E72]">Buku Induk</p>
          <h1 className="text-3xl font-extrabold text-[#2D3436]">Data Pondok</h1>
          <p className="text-sm font-semibold text-[#636E72]">Kelola master komplek, kamar, dan santri pondok memakai ID database utama.</p>
        </div>
        <button
          className={`q-refresh-button flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-[#138F81] ${isLoading ? 'is-loading' : ''}`}
          onClick={() => void load()}
          type="button"
          disabled={isLoading}
          aria-busy={isLoading}
        >
          <RefreshCw className="q-refresh-icon" size={17} />
          {isLoading ? 'Menyegarkan...' : 'Refresh'}
        </button>
      </section>

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
            <button className="flex min-h-12 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-bold text-white" onClick={() => setAssignOpen(true)} type="button">
              <UserPlus size={18} />
              Atur Santri
            </button>
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

      {complexModal ? <ComplexForm initial={complexModal === 'new' ? null : complexModal} onClose={() => setComplexModal(null)} onSaved={() => void load()} /> : null}
      {roomModal ? <RoomForm complexes={complexes} initial={roomModal === 'new' ? null : roomModal} onClose={() => setRoomModal(null)} onSaved={() => void load()} /> : null}
      {assignOpen ? <AssignSantriForm complexes={complexes} students={students} santri={santri} onClose={() => setAssignOpen(false)} onSaved={() => void load()} /> : null}
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

function ComplexForm({ initial, onClose, onSaved }: { initial: ApiRecord | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(text(initial?.name, ''));
  const [description, setDescription] = useState(text(initial?.description, ''));
  const [isActive, setIsActive] = useState(bool(initial?.is_active));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      const payload = { name, description, is_active: isActive };
      if (initial?.id) await api.updateBoardingComplex(num(initial.id), payload);
      else await api.createBoardingComplex(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Komplek gagal disimpan');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalForm
      title={initial ? 'Edit Komplek' : 'Tambah Komplek'}
      onClose={onClose}
      footer={
        <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white disabled:opacity-60" disabled={isSaving} form="complex-form" type="submit">
          <Save size={18} />
          {isSaving ? 'Menyimpan...' : 'Simpan Komplek'}
        </button>
      }
    >
      <form className="space-y-4" id="complex-form" onSubmit={(event) => void submit(event)}>
        {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
        <label className="block text-sm font-bold text-[#636E72]">
          Nama Komplek
          <input className="q-input mt-2" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="block text-sm font-bold text-[#636E72]">
          Keterangan
          <textarea className="q-input mt-2 min-h-24 py-3" value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-bold text-[#2D3436]">
          Status aktif
          <input checked={isActive} onChange={(event) => setIsActive(event.target.checked)} type="checkbox" />
        </label>
      </form>
    </ModalForm>
  );
}

function RoomForm({ complexes, initial, onClose, onSaved }: { complexes: ApiRecord[]; initial: ApiRecord | null; onClose: () => void; onSaved: () => void }) {
  const initialComplex = num(initial?.boarding_complex_id ?? record(initial?.complex).id ?? complexes[0]?.id);
  const [complexId, setComplexId] = useState(initialComplex);
  const [name, setName] = useState(text(initial?.name, ''));
  const [capacity, setCapacity] = useState(text(initial?.capacity, ''));
  const [isActive, setIsActive] = useState(bool(initial?.is_active));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      const payload = { boarding_complex_id: complexId, name, capacity: capacity ? Number(capacity) : null, is_active: isActive };
      if (initial?.id) await api.updateBoardingRoom(num(initial.id), payload);
      else await api.createBoardingRoom(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kamar gagal disimpan');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalForm
      title={initial ? 'Edit Kamar' : 'Tambah Kamar'}
      onClose={onClose}
      footer={
        <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white disabled:opacity-60" disabled={isSaving} form="room-form" type="submit">
          <Save size={18} />
          {isSaving ? 'Menyimpan...' : 'Simpan Kamar'}
        </button>
      }
    >
      <form className="space-y-4" id="room-form" onSubmit={(event) => void submit(event)}>
        {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
        <label className="block text-sm font-bold text-[#636E72]">
          Komplek
          <select className="q-input mt-2" value={complexId} onChange={(event) => setComplexId(Number(event.target.value))} required>
            {complexes.map((complex) => (
              <option key={num(complex.id)} value={num(complex.id)}>
                {text(complex.name)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold text-[#636E72]">
          Nama / Nomor Kamar
          <input className="q-input mt-2" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="block text-sm font-bold text-[#636E72]">
          Kapasitas
          <input className="q-input mt-2" inputMode="numeric" value={capacity} onChange={(event) => setCapacity(event.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-bold text-[#2D3436]">
          Status aktif
          <input checked={isActive} onChange={(event) => setIsActive(event.target.checked)} type="checkbox" />
        </label>
      </form>
    </ModalForm>
  );
}

function AssignSantriForm({
  complexes,
  students,
  santri,
  onClose,
  onSaved
}: {
  complexes: ApiRecord[];
  students: ApiRecord[];
  santri: ApiRecord[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [complexId, setComplexId] = useState(num(complexes[0]?.id));
  const selectedComplex = complexes.find((row) => num(row.id) === complexId) ?? complexes[0];
  const availableRooms = roomsOf(selectedComplex ?? {});
  const [roomId, setRoomId] = useState(num(availableRooms[0]?.id));
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isResident, setIsResident] = useState(true);
  const [participatesPrayer, setParticipatesPrayer] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const rooms = roomsOf(selectedComplex ?? {});
    setRoomId(num(rooms[0]?.id));
    setSelectedIds(new Set());
  }, [complexId]);

  const activeSantriIds = useMemo(
    () =>
      new Set(
        santri
          .filter((row) => text(row.status).toLowerCase() !== 'nonaktif' && row.is_active !== false)
          .map((row) => num(row.siswa_id ?? record(row.siswa).id))
      ),
    [santri]
  );

  const availableStudents = useMemo(() => {
    const keyword = search.toLowerCase();
    return students
      .filter((student) => !activeSantriIds.has(num(student.id)))
      .filter((student) => (!keyword ? true : JSON.stringify(student).toLowerCase().includes(keyword)));
  }, [activeSantriIds, search, students]);

  function toggle(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (isSaving) return;
    if (!roomId || selectedIds.size === 0) {
      setError('Pilih kamar dan minimal satu santri dulu.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await api.assignBoardingStudents({
        boarding_room_id: roomId,
        siswa_ids: Array.from(selectedIds),
        status: 'Aktif',
        is_resident: isResident,
        participates_prayer: participatesPrayer
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Santri pondok gagal disimpan');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalForm
      title="Atur Santri Pondok"
      onClose={onClose}
      footer={
        <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white disabled:opacity-60" disabled={isSaving || selectedIds.size === 0} form="assign-santri-form" type="submit">
          <Save size={18} />
          {isSaving ? 'Menyimpan...' : `Simpan ${selectedIds.size} Santri`}
        </button>
      }
    >
      <form className="space-y-4" id="assign-santri-form" onSubmit={(event) => void submit(event)}>
        {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <select className="q-input" value={complexId} onChange={(event) => setComplexId(Number(event.target.value))} required>
            {complexes.map((complex) => (
              <option key={num(complex.id)} value={num(complex.id)}>
                {text(complex.name)}
              </option>
            ))}
          </select>
          <select className="q-input" value={roomId} onChange={(event) => setRoomId(Number(event.target.value))} required>
            {availableRooms.map((room) => (
              <option key={num(room.id)} value={num(room.id)}>
                {text(room.name)}
              </option>
            ))}
          </select>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari nama / NIS / NISN / kelas" />
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold">
          <span>{selectedIds.size} santri dipilih</span>
          <div className="flex gap-2">
            <button className="rounded-xl bg-white px-3 py-2 text-[#138F81]" onClick={() => setSelectedIds(new Set(availableStudents.map((student) => num(student.id))))} type="button">
              Pilih Semua Hasil
            </button>
            <button className="rounded-xl bg-white px-3 py-2 text-[#E8590C]" onClick={() => setSelectedIds(new Set())} type="button">
              Bersihkan
            </button>
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto rounded-2xl bg-white p-2 q-scrollbar">
          {availableStudents.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm font-bold text-[#636E72]">Semua santri sudah terdaftar aktif di data pondok.</div>
          ) : (
            availableStudents.map((student) => {
              const id = num(student.id);
              return (
                <label key={id} className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 hover:bg-[#E1EFF7]">
                  <input checked={selectedIds.has(id)} onChange={() => toggle(id)} type="checkbox" />
                  <span>
                    <span className="block text-sm font-extrabold text-[#2D3436]">{text(student.nama)}</span>
                    <span className="text-xs font-semibold text-[#636E72]">
                      NIS: {text(student.nis)} - NISN: {text(student.nisn)} - {text(student.kelas)}
                    </span>
                  </span>
                </label>
              );
            })
          )}
        </div>
        <label className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-bold text-[#2D3436]">
          Penghuni pondok utama
          <input checked={isResident} onChange={(event) => setIsResident(event.target.checked)} type="checkbox" />
        </label>
        <label className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-bold text-[#2D3436]">
          Ikut kegiatan sholat
          <input checked={participatesPrayer} onChange={(event) => setParticipatesPrayer(event.target.checked)} type="checkbox" />
        </label>
      </form>
    </ModalForm>
  );
}
