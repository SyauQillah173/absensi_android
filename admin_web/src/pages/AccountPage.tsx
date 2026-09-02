import { Camera, KeyRound, RefreshCw, Save, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { api, type ApiRecord } from '../services/api';
import { getRoleDisplayName } from '../utils/roleHelper';

function valueOf(source: ApiRecord, key: string): string {
  return String(source[key] ?? '').trim();
}

function permissionsOf(profile: ApiRecord): ApiRecord[] {
  const permissions = profile.permissions;
  if (!permissions || typeof permissions !== 'object') return [];
  const menus = (permissions as ApiRecord).menus;
  return Array.isArray(menus) ? (menus as ApiRecord[]) : [];
}

export function AccountPage() {
  const { session, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<ApiRecord>({});
  const [form, setForm] = useState({
    name: '',
    email: '',
    no_hp: '',
    nik_user: '',
    jenis_kelamin: ''
  });
  const [password, setPassword] = useState({
    current_password: '',
    new_password: '',
    new_password_confirmation: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [isPhotoSaving, setIsPhotoSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setIsLoading(true);
    setError('');
    try {
      const response = await api.profile();
      const data = (response.data && typeof response.data === 'object' ? response.data : {}) as ApiRecord;
      setProfile(data);
      setForm({
        name: valueOf(data, 'name') || session?.name || '',
        email: valueOf(data, 'email') || session?.email || '',
        no_hp: valueOf(data, 'no_hp') || session?.no_hp || '',
        nik_user: valueOf(data, 'nik_user'),
        jenis_kelamin: valueOf(data, 'jenis_kelamin')
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profil gagal dimuat.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const permissionMenus = useMemo(() => permissionsOf(profile), [profile]);
  const roleLabel = useMemo(() => {
    return getRoleDisplayName(
      String(profile.role ?? session?.role ?? ''),
      String(profile.admin_type ?? session?.admin_type ?? '')
    );
  }, [profile.role, profile.admin_type, session?.role, session?.admin_type]);


  const photoUrl = String(profile.foto_url ?? session?.foto_url ?? '').trim();

  async function saveProfile() {
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      await api.updateProfile(form);
      await refreshProfile();
      await load();
      setNotice('Pengaturan akun berhasil diperbarui.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Akun gagal diperbarui.');
    } finally {
      setIsSaving(false);
    }
  }

  async function savePassword() {
    if (password.new_password !== password.new_password_confirmation) {
      setError('Konfirmasi password baru belum sama.');
      return;
    }
    setIsPasswordSaving(true);
    setError('');
    setNotice('');
    try {
      await api.changePassword({
        identifier: form.email || session?.email || form.name || session?.name || '',
        ...password
      });
      setPassword({ current_password: '', new_password: '', new_password_confirmation: '' });
      setNotice('Password berhasil diganti.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password gagal diganti.');
    } finally {
      setIsPasswordSaving(false);
    }
  }

  async function uploadPhoto(file?: File) {
    if (!file) return;
    setIsPhotoSaving(true);
    setError('');
    setNotice('');
    try {
      await api.uploadProfilePhoto(file);
      await refreshProfile();
      await load();
      setNotice('Foto profil berhasil diperbarui.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Foto profil gagal diperbarui.');
    } finally {
      setIsPhotoSaving(false);
    }
  }

  async function deletePhoto() {
    setIsPhotoSaving(true);
    setError('');
    setNotice('');
    try {
      await api.deleteProfilePhoto();
      await refreshProfile();
      await load();
      setNotice('Foto profil berhasil dihapus.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Foto profil gagal dihapus.');
    } finally {
      setIsPhotoSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="q-page-heading flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#636E72]">Akun</p>
          <h1 className="text-3xl font-extrabold text-[#2D3436]">Pengaturan Akun</h1>
          <p className="text-sm font-semibold text-[#636E72]">Kelola profil pribadi. Role dan permission hanya dapat diubah Admin Utama.</p>
        </div>
        <button
          className={`q-refresh-button flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-[#138F81] ${isLoading ? 'is-loading' : ''}`}
          onClick={() => void load()}
          type="button"
          disabled={isLoading}
        >
          <RefreshCw className="q-refresh-icon" size={17} />
          Refresh
        </button>
      </section>

      {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
      {notice ? <div className="rounded-2xl bg-[#E8F7F3] px-4 py-3 text-sm font-bold text-[#138F81]">{notice}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="q-panel p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center gap-4">
            <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-[24px] bg-[#E8F7F3] text-[#138F81]">
              {photoUrl ? <img src={photoUrl} alt="Foto profil" className="h-full w-full object-cover" /> : <UserRound size={34} />}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="q-soft-action inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white">
                <Camera size={17} /> {isPhotoSaving ? 'Mengunggah...' : 'Ubah Foto'}
                <input className="sr-only" type="file" accept="image/*" onChange={(event) => void uploadPhoto(event.target.files?.[0])} />
              </label>
              <button
                className="q-soft-action inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#FDECEC] px-4 text-sm font-extrabold text-[#D63031]"
                onClick={() => void deletePhoto()}
                type="button"
                disabled={isPhotoSaving || !photoUrl}
              >
                <Trash2 size={17} /> Hapus Foto
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-bold text-[#636E72]">
              Nama Pengguna
              <input className="q-input" value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm font-bold text-[#636E72]">
              Email
              <input className="q-input" type="email" value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm font-bold text-[#636E72]">
              Nomor HP
              <input className="q-input" value={form.no_hp} onChange={(event) => setForm((value) => ({ ...value, no_hp: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm font-bold text-[#636E72]">
              NIK/Username
              <input className="q-input" value={form.nik_user} onChange={(event) => setForm((value) => ({ ...value, nik_user: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm font-bold text-[#636E72]">
              Jenis Kelamin
              <select className="q-input" value={form.jenis_kelamin} onChange={(event) => setForm((value) => ({ ...value, jenis_kelamin: event.target.value }))}>
                <option value="">Belum diatur</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </label>
          </div>

          <button
            className="q-soft-action mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-extrabold text-white disabled:opacity-60 sm:w-auto"
            onClick={() => void saveProfile()}
            type="button"
            disabled={isSaving || isLoading}
          >
            <Save size={18} /> {isSaving ? 'Menyimpan...' : 'Simpan Profil'}
          </button>
        </section>

        <aside className="space-y-5">
          <section className="q-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="text-[#138F81]" size={20} />
              <h2 className="text-lg font-extrabold text-[#2D3436]">Role & Permission</h2>
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl bg-[#E1EFF7] p-4">
                <p className="text-xs font-bold text-[#636E72]">Role</p>
                <p className="mt-1 text-xl font-extrabold capitalize text-[#2D3436]">{roleLabel}</p>
                {adminType ? <StatusBadge label={`Admin ${adminType}`} tone="success" /> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {permissionMenus.slice(0, 10).map((item) => (
                  <StatusBadge key={String(item.key ?? item.menu_key)} label={String(item.label ?? item.key ?? '-')} tone="info" />
                ))}
                {permissionMenus.length === 0 ? <p className="text-sm font-semibold text-[#636E72]">Permission belum dimuat.</p> : null}
              </div>
            </div>
          </section>

          <section className="q-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <KeyRound className="text-[#138F81]" size={20} />
              <h2 className="text-lg font-extrabold text-[#2D3436]">Ganti Password</h2>
            </div>
            <div className="space-y-3">
              <input className="q-input" type="password" placeholder="Password lama" value={password.current_password} onChange={(event) => setPassword((value) => ({ ...value, current_password: event.target.value }))} />
              <input className="q-input" type="password" placeholder="Password baru" value={password.new_password} onChange={(event) => setPassword((value) => ({ ...value, new_password: event.target.value }))} />
              <input className="q-input" type="password" placeholder="Konfirmasi password baru" value={password.new_password_confirmation} onChange={(event) => setPassword((value) => ({ ...value, new_password_confirmation: event.target.value }))} />
            </div>
            <button
              className="q-soft-action mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#2D3436] px-4 text-sm font-extrabold text-white disabled:opacity-60"
              onClick={() => void savePassword()}
              type="button"
              disabled={isPasswordSaving || !password.current_password || !password.new_password || !password.new_password_confirmation}
            >
              <KeyRound size={17} /> {isPasswordSaving ? 'Menyimpan...' : 'Ganti Password'}
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
