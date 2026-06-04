import { RefreshCw, Save, ShieldCheck, ToggleLeft, UserCog, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DataTable, type DataColumn } from '../components/DataTable';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { api, type ApiRecord } from '../services/api';

interface PermissionRow extends ApiRecord {
  id: string;
  role: string;
  menu_key: string;
  label: string;
  group: string;
  locked: boolean;
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_approve: boolean;
  can_cancel: boolean;
  is_enabled: boolean;
}

const roleLabels: Record<string, string> = {
  admin_utama: 'Admin Utama',
  admin_bendahara: 'Bendahara',
  admin_akademik: 'Akademik',
  admin_pondok: 'Pondok',
  admin_absensi: 'Absensi',
  admin_lainnya: 'Admin Lain',
  guru: 'Guru',
  wali: 'Wali'
};

const actionLabels: Array<{ key: keyof PermissionRow; label: string }> = [
  { key: 'can_view', label: 'Lihat' },
  { key: 'can_create', label: 'Tambah' },
  { key: 'can_update', label: 'Edit' },
  { key: 'can_delete', label: 'Hapus' },
  { key: 'can_approve', label: 'Approve' },
  { key: 'can_cancel', label: 'Cancel' }
];

function text(value: unknown, fallback = '-'): string {
  const result = String(value ?? '').trim();
  return result || fallback;
}

function record(value: unknown): ApiRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ApiRecord) : {};
}

function bool(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}

function flattenSettings(settings: ApiRecord): PermissionRow[] {
  const permissions = record(settings.permissions);
  const rows: PermissionRow[] = [];
  Object.entries(permissions).forEach(([role, value]) => {
    const menuRows = Array.isArray(value) ? (value as ApiRecord[]) : [];
    menuRows.forEach((item) => {
      const menuKey = text(item.key ?? item.menu_key, '');
      if (!menuKey) return;
      rows.push({
        id: `${role}:${menuKey}`,
        role,
        menu_key: menuKey,
        label: text(item.label ?? menuKey),
        group: text(item.group, 'Umum'),
        locked: bool(item.locked) || role === 'admin_utama',
        can_view: role === 'admin_utama' ? true : bool(item.can_view),
        can_create: role === 'admin_utama' ? true : bool(item.can_create),
        can_update: role === 'admin_utama' ? true : bool(item.can_update),
        can_delete: role === 'admin_utama' ? true : bool(item.can_delete),
        can_approve: role === 'admin_utama' ? true : bool(item.can_approve),
        can_cancel: role === 'admin_utama' ? true : bool(item.can_cancel),
        is_enabled: role === 'admin_utama' ? true : bool(item.is_enabled)
      });
    });
  });
  return rows;
}

function permissionPayload(rows: PermissionRow[]): ApiRecord[] {
  return rows
    .filter((row) => row.role !== 'admin_utama')
    .map((row) => ({
      role: row.role,
      menu_key: row.menu_key,
      can_view: row.can_view,
      can_create: row.can_create,
      can_update: row.can_update,
      can_delete: row.can_delete,
      can_approve: row.can_approve,
      can_cancel: row.can_cancel,
      is_enabled: row.is_enabled
    }));
}

function ToggleCell({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      className={`inline-flex h-9 min-w-16 items-center justify-center rounded-2xl text-xs font-extrabold transition ${
        checked ? 'bg-[#E8F7F3] text-[#138F81]' : 'bg-[#F2F4F6] text-[#636E72]'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:-translate-y-0.5'}`}
      onClick={onChange}
      type="button"
      disabled={disabled}
      aria-pressed={checked}
    >
      {checked ? 'Ya' : 'Tidak'}
    </button>
  );
}

export function HakAksesPage() {
  const [roles, setRoles] = useState<string[]>([]);
  const [rows, setRows] = useState<PermissionRow[]>([]);
  const [activeRole, setActiveRole] = useState('admin_bendahara');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setIsLoading(true);
    setError('');
    setNotice('');
    try {
      const result = await api.permissionSettings();
      const settings = record(result.data);
      const nextRoles = Array.isArray(settings.roles) ? (settings.roles as string[]) : [];
      const nextRows = flattenSettings(settings);
      setRoles(nextRoles);
      setRows(nextRows);
      const preferredRole = nextRoles.includes(activeRole) ? activeRole : nextRoles.find((role) => role !== 'admin_utama') ?? nextRoles[0] ?? 'admin_bendahara';
      setActiveRole(preferredRole);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pengaturan hak akses gagal dimuat.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const visibleRows = useMemo(() => rows.filter((row) => row.role === activeRole), [activeRole, rows]);
  const activeRows = useMemo(() => rows.filter((row) => row.is_enabled && row.role !== 'admin_utama'), [rows]);

  function updateRow(rowId: string, key: keyof PermissionRow, value: boolean) {
    setRows((current) => current.map((row) => (row.id === rowId ? { ...row, [key]: value } : row)));
  }

  async function save() {
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      await api.updatePermissionSettings(permissionPayload(rows));
      await load();
      setNotice('Hak akses berhasil diperbarui.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hak akses gagal disimpan.');
    } finally {
      setIsSaving(false);
    }
  }

  const columns: DataColumn<PermissionRow>[] = [
    {
      key: 'menu',
      header: 'Menu',
      render: (row) => (
        <div>
          <p className="font-extrabold">{row.label}</p>
          <p className="text-xs font-semibold text-[#636E72]">{row.menu_key}</p>
        </div>
      )
    },
    { key: 'group', header: 'Grup', render: (row) => <StatusBadge label={row.group} tone="info" /> },
    {
      key: 'enabled',
      header: 'Aktif',
      render: (row) => <ToggleCell checked={row.is_enabled} disabled={row.locked} onChange={() => updateRow(row.id, 'is_enabled', !row.is_enabled)} />
    },
    ...actionLabels.map<DataColumn<PermissionRow>>((action) => ({
      key: String(action.key),
      header: action.label,
      render: (row) => (
        <ToggleCell
          checked={Boolean(row[action.key])}
          disabled={row.locked || !row.is_enabled}
          onChange={() => updateRow(row.id, action.key, !Boolean(row[action.key]))}
        />
      )
    }))
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#636E72]">Hak Akses</p>
          <h1 className="text-3xl font-extrabold text-[#2D3436]">Role dan Permission</h1>
          <p className="text-sm font-semibold text-[#636E72]">Admin utama full akses, admin lain dan guru/wali mengikuti permission backend.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={`q-refresh-button flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-[#138F81] ${isLoading ? 'is-loading' : ''}`}
            onClick={() => void load()}
            type="button"
            disabled={isLoading}
          >
            <RefreshCw className="q-refresh-icon" size={17} />
            {isLoading ? 'Menyegarkan...' : 'Refresh'}
          </button>
          <button
            className="q-soft-action inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white disabled:opacity-60"
            onClick={() => void save()}
            type="button"
            disabled={isSaving || isLoading || activeRole === 'admin_utama'}
          >
            <Save size={17} /> {isSaving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </section>

      {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
      {notice ? <div className="rounded-2xl bg-[#E8F7F3] px-4 py-3 text-sm font-bold text-[#138F81]">{notice}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Role Terdaftar" value={roles.length} subtitle="Admin, guru, wali" icon={UsersRound} tone="teal" />
        <StatCard title="Permission Aktif" value={activeRows.length} subtitle="Menu aktif lintas role" icon={ShieldCheck} tone="blue" />
        <StatCard title="Role Dipilih" value={roleLabels[activeRole] ?? activeRole} subtitle={activeRole === 'admin_utama' ? 'Full akses terkunci' : 'Bisa disesuaikan'} icon={UserCog} tone="orange" />
      </div>

      {roles.length > 0 ? (
        <SegmentedTabs
          tabs={roles.map((role) => ({ id: role, label: roleLabels[role] ?? role }))}
          active={activeRole}
          onChange={setActiveRole}
        />
      ) : null}

      {activeRole === 'admin_utama' ? (
        <div className="rounded-2xl bg-[#E8F7F3] px-4 py-3 text-sm font-bold text-[#138F81]">
          Admin Utama selalu punya full akses dan tidak diedit dari tabel permission agar akses inti tidak terkunci.
        </div>
      ) : null}

      <section className="q-panel p-4 sm:p-6">
        {isLoading ? (
          <div className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-bold text-[#636E72]">Memuat hak akses...</div>
        ) : (
          <DataTable rows={visibleRows} columns={columns} emptyText="Hak akses role ini belum tersedia." minWidth="980px" />
        )}
      </section>

      <section className="q-card flex items-center gap-3 p-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#EAF4FF] text-[#2E86DE]">
          <ToggleLeft size={24} />
        </span>
        <p className="text-sm font-semibold leading-6 text-[#636E72]">
          Perubahan di halaman ini langsung tersimpan ke backend pusat. Android dan web akan membaca permission yang sama setelah refresh/login ulang.
        </p>
      </section>
    </div>
  );
}
