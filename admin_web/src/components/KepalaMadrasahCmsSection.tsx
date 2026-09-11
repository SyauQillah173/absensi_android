import {
  BookMarked,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Edit3,
  GraduationCap,
  Info,
  Landmark,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  UsersRound,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ModalForm } from './ModalForm';
import { StatCard } from './StatCard';
import { StatusBadge } from './StatusBadge';
import { api, type ApiRecord } from '../services/api';

export interface KepalaAccessItem {
  id: number;
  user_id: number;
  nama_pejabat: string;
  jabatan: string;
  can_monitor_madin: boolean;
  can_monitor_sholat: boolean;
  can_monitor_ngaji: boolean;
  is_active: boolean;
  user?: {
    id: number;
    name: string;
    email: string;
    admin_type: string | null;
    role: string;
  };
}

export interface AvailableUserItem {
  id: number;
  name: string;
  email: string;
  role: string;
  admin_type?: string | null;
}

export function KepalaMadrasahCmsSection() {
  const [kepalaList, setKepalaList] = useState<KepalaAccessItem[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Toggling state for optimistic update loading
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [togglingField, setTogglingField] = useState<string | null>(null);

  // Modal form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formUserId, setFormUserId] = useState<number | ''>('');
  const [formNama, setFormNama] = useState('');
  const [formJabatan, setFormJabatan] = useState('');
  const [formMadin, setFormMadin] = useState(true);
  const [formSholat, setFormSholat] = useState(false);
  const [formNgaji, setFormNgaji] = useState(false);
  const [formActive, setFormActive] = useState(true);
  const [isSavingModal, setIsSavingModal] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await api.getKepalaMadrasahAccess();
      setKepalaList((res.data as any) || []);
      setAvailableUsers(Array.isArray(res.available_users) ? (res.available_users as any) : []);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat daftar Kepala Madrasah.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Statistics
  const totalCount = kepalaList.length;
  const madinActiveCount = useMemo(
    () => kepalaList.filter((k) => k.can_monitor_madin && k.is_active).length,
    [kepalaList]
  );
  const sholatActiveCount = useMemo(
    () => kepalaList.filter((k) => k.can_monitor_sholat && k.is_active).length,
    [kepalaList]
  );
  const ngajiActiveCount = useMemo(
    () => kepalaList.filter((k) => k.can_monitor_ngaji && k.is_active).length,
    [kepalaList]
  );

  // Instant Checkbox Toggle Handler
  const handleToggle = async (
    item: KepalaAccessItem,
    field: 'can_monitor_madin' | 'can_monitor_sholat' | 'can_monitor_ngaji' | 'is_active'
  ) => {
    const nextVal = !item[field];
    const prevList = [...kepalaList];

    // Optimistic UI update
    setKepalaList((prev) =>
      prev.map((k) => (k.id === item.id ? { ...k, [field]: nextVal } : k))
    );
    setTogglingId(item.id);
    setTogglingField(field);
    setError('');
    setNotice('');

    try {
      await api.updateKepalaMadrasahAccess(item.id, { [field]: nextVal });
      const fieldLabels: Record<string, string> = {
        can_monitor_madin: 'Presensi Madin',
        can_monitor_sholat: 'Presensi Sholat',
        can_monitor_ngaji: 'Presensi Ngaji',
        is_active: 'Status Akses',
      };
      setNotice(
        `✓ ${fieldLabels[field]} untuk ${item.nama_pejabat} berhasil ${nextVal ? 'diaktifkan' : 'dinonaktifkan'}.`
      );
    } catch (err: any) {
      // Revert optimistic update
      setKepalaList(prevList);
      setError(err?.message || 'Gagal memperbarui pengaturan.');
    } finally {
      setTogglingId(null);
      setTogglingField(null);
    }
  };

  const openAddModal = () => {
    setModalMode('add');
    setEditingId(null);
    const firstUser = availableUsers[0];
    if (firstUser) {
      setFormUserId(Number(firstUser.id));
      setFormNama(String(firstUser.name || ''));
    } else {
      setFormUserId('');
      setFormNama('');
    }
    setFormJabatan('Kepala Madrasah');
    setFormMadin(true);
    setFormSholat(false);
    setFormNgaji(false);
    setFormActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (item: KepalaAccessItem) => {
    setModalMode('edit');
    setEditingId(item.id);
    setFormUserId(item.user_id);
    setFormNama(item.nama_pejabat);
    setFormJabatan(item.jabatan);
    setFormMadin(item.can_monitor_madin);
    setFormSholat(item.can_monitor_sholat);
    setFormNgaji(item.can_monitor_ngaji);
    setFormActive(item.is_active);
    setIsModalOpen(true);
  };

  const handleUserSelectChange = (userId: number) => {
    setFormUserId(userId);
    const user = availableUsers.find((u) => Number(u.id) === userId);
    if (user && !formNama) {
      setFormNama(String(user.name || ''));
    }
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUserId && modalMode === 'add') {
      alert('Silakan pilih akun pengguna / ustadz.');
      return;
    }
    if (!formNama.trim()) {
      alert('Nama pejabat tidak boleh kosong.');
      return;
    }
    if (!formJabatan.trim()) {
      alert('Nama jabatan tidak boleh kosong.');
      return;
    }

    setIsSavingModal(true);
    setError('');
    setNotice('');
    try {
      if (modalMode === 'add') {
        await api.saveKepalaMadrasahAccess({
          user_id: Number(formUserId),
          nama_pejabat: formNama.trim(),
          jabatan: formJabatan.trim(),
          can_monitor_madin: formMadin,
          can_monitor_sholat: formSholat,
          can_monitor_ngaji: formNgaji,
          is_active: formActive,
        });
        setNotice(`✓ Kepala Madrasah / Pejabat ${formNama} berhasil ditambahkan.`);
      } else if (editingId) {
        await api.updateKepalaMadrasahAccess(editingId, {
          nama_pejabat: formNama.trim(),
          jabatan: formJabatan.trim(),
          can_monitor_madin: formMadin,
          can_monitor_sholat: formSholat,
          can_monitor_ngaji: formNgaji,
          is_active: formActive,
        });
        setNotice(`✓ Pengaturan untuk ${formNama} berhasil diperbarui.`);
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan data Kepala Madrasah.');
    } finally {
      setIsSavingModal(false);
    }
  };

  const handleDelete = async (item: KepalaAccessItem) => {
    if (
      !window.confirm(
        `Yakin ingin mencabut hak akses monitoring khusus untuk ${item.nama_pejabat} (${item.jabatan})?\nAkun user tidak dihapus, hanya izin monitoring khususnya yang dicabut.`
      )
    ) {
      return;
    }
    try {
      await api.deleteKepalaMadrasahAccess(item.id);
      setKepalaList((prev) => prev.filter((k) => k.id !== item.id));
      setNotice(`✓ Akses monitoring untuk ${item.nama_pejabat} berhasil dicabut.`);
    } catch (err: any) {
      setError(err?.message || 'Gagal mencabut hak akses.');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 💡 PANDUAN & KONTROL CERDAS CMS */}
      <div className="rounded-3xl border border-teal-200/90 bg-gradient-to-r from-teal-50/90 via-emerald-50/50 to-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#138F81] text-white shadow-md shadow-[#138F81]/25">
              <Sparkles size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-800">
                  CMS Pengaturan Monitoring Kepala Madrasah & Pondok
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#138F81] text-white uppercase tracking-wider">
                  Khusus Admin IT
                </span>
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-600 mt-1 max-w-3xl leading-relaxed">
                Fitur cerdas ini memungkinkan Admin IT mengatur modul presensi santri mana saja yang boleh dipantau oleh masing-masing Kepala Madrasah secara fleksibel.
                Cukup centang atau hilangkan centang modul di bawah, perubahan langsung aktif seketika tanpa perlu mengubah kodingan program!
              </p>
              <div className="mt-2.5 flex items-center gap-3 text-xs font-bold text-[#138F81] flex-wrap">
                <span className="inline-flex items-center gap-1">
                  📖 <strong>Ust. Imam Bashori:</strong> Monitoring KBM Madin saja
                </span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1">
                  🕌 <strong>Ust. Abd. Wajid:</strong> Monitoring Jama'ah Sholat & Ngaji Kitab
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#138F81] text-white text-xs sm:text-sm font-black hover:bg-[#0D7A6F] transition-all shadow-md shadow-[#138F81]/20 cursor-pointer active:scale-95"
            >
              <Plus size={16} />
              <span>+ Tunjuk Kepala Madrasah</span>
            </button>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200/80 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
              <span>{isLoading ? 'Memuat...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-[#FDECEC] border border-red-200 px-4 py-3 text-sm font-bold text-[#D63031] animate-shake">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-2xl bg-[#E8F7F3] border border-teal-200 px-4 py-3 text-sm font-bold text-[#138F81] animate-fadeIn">
          {notice}
        </div>
      )}

      {/* 4 STATISTIK CEPAT */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Kepala Madrasah"
          value={totalCount}
          subtitle="Pejabat monitoring terdaftar"
          icon={GraduationCap}
          tone="teal"
        />
        <StatCard
          title="Pemantau Madin"
          value={madinActiveCount}
          subtitle="Akses presensi KBM Diniyah"
          icon={BookOpenCheck}
          tone="teal"
        />
        <StatCard
          title="Pemantau Sholat"
          value={sholatActiveCount}
          subtitle="Akses presensi jamaah sholat"
          icon={Landmark}
          tone="blue"
        />
        <StatCard
          title="Pemantau Ngaji"
          value={ngajiActiveCount}
          subtitle="Akses presensi ngaji kitab"
          icon={BookMarked}
          tone="orange"
        />
      </div>

      {/* 📋 TABEL INTERAKTIF PENGATURAN MONITORING */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-800">
              Matriks Pengaturan Hak Pantau Absensi
            </h3>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Klik switch atau centang tombol di bawah untuk mengubah izin monitoring secara langsung.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-400">
            {kepalaList.length} Pejabat Dikonfigurasi
          </span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center">
            <RefreshCw size={28} className="mx-auto animate-spin text-[#138F81] mb-2" />
            <p className="text-xs font-bold text-slate-500">Memuat data Kepala Madrasah...</p>
          </div>
        ) : kepalaList.length === 0 ? (
          <div className="py-12 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 space-y-2">
            <GraduationCap size={36} className="mx-auto text-slate-400" />
            <p className="text-sm font-black text-slate-700">Belum ada Kepala Madrasah yang ditunjuk.</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Klik tombol "+ Tunjuk Kepala Madrasah" di atas untuk menambahkan akun ustadz sebagai kepala madrasah atau pejabat pemantau.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200/70 text-[11px] font-black uppercase tracking-wider text-slate-500 bg-slate-50/50">
                    <th className="py-3.5 px-4 rounded-l-2xl">Pejabat & Akun</th>
                    <th className="py-3.5 px-4">Jabatan / Satuan</th>
                    <th className="py-3.5 px-4 text-center">📖 KBM Madin</th>
                    <th className="py-3.5 px-4 text-center">🕌 Jama'ah Sholat</th>
                    <th className="py-3.5 px-4 text-center">📚 Ngaji Kitab</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-center rounded-r-2xl">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {kepalaList.map((item) => {
                    const isRowToggling = togglingId === item.id;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Pejabat & Akun */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-[#138F81] font-black text-sm border border-teal-100">
                              {item.nama_pejabat.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-extrabold text-slate-800 leading-tight">
                                {item.nama_pejabat}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">
                                {item.user?.email || `User ID: ${item.user_id}`}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Jabatan */}
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold">
                            <GraduationCap size={13} className="text-[#138F81]" />
                            {item.jabatan}
                          </span>
                        </td>

                        {/* Toggle Madin */}
                        <td className="py-4 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggle(item, 'can_monitor_madin')}
                            disabled={isRowToggling}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs ${
                              item.can_monitor_madin
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            {isRowToggling && togglingField === 'can_monitor_madin' ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : item.can_monitor_madin ? (
                              <Check size={12} strokeWidth={3} />
                            ) : (
                              <X size={12} strokeWidth={3} />
                            )}
                            <span>{item.can_monitor_madin ? 'DIPANTAU' : 'SEMBUNYI'}</span>
                          </button>
                        </td>

                        {/* Toggle Sholat */}
                        <td className="py-4 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggle(item, 'can_monitor_sholat')}
                            disabled={isRowToggling}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs ${
                              item.can_monitor_sholat
                                ? 'bg-sky-500 text-white hover:bg-sky-600 shadow-sky-500/20'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            {isRowToggling && togglingField === 'can_monitor_sholat' ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : item.can_monitor_sholat ? (
                              <Check size={12} strokeWidth={3} />
                            ) : (
                              <X size={12} strokeWidth={3} />
                            )}
                            <span>{item.can_monitor_sholat ? 'DIPANTAU' : 'SEMBUNYI'}</span>
                          </button>
                        </td>

                        {/* Toggle Ngaji */}
                        <td className="py-4 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggle(item, 'can_monitor_ngaji')}
                            disabled={isRowToggling}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs ${
                              item.can_monitor_ngaji
                                ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            {isRowToggling && togglingField === 'can_monitor_ngaji' ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : item.can_monitor_ngaji ? (
                              <Check size={12} strokeWidth={3} />
                            ) : (
                              <X size={12} strokeWidth={3} />
                            )}
                            <span>{item.can_monitor_ngaji ? 'DIPANTAU' : 'SEMBUNYI'}</span>
                          </button>
                        </td>

                        {/* Toggle Active */}
                        <td className="py-4 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggle(item, 'is_active')}
                            disabled={isRowToggling}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black transition-all cursor-pointer ${
                              item.is_active
                                ? 'bg-teal-50 text-[#138F81] border border-teal-200 hover:bg-teal-100'
                                : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                item.is_active ? 'bg-[#138F81] animate-pulse' : 'bg-rose-400'
                              }`}
                            />
                            <span>{item.is_active ? 'Aktif' : 'Nonaktif'}</span>
                          </button>
                        </td>

                        {/* Aksi */}
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              title="Edit Data Pejabat"
                              className="p-1.5 rounded-xl text-slate-500 hover:text-[#138F81] hover:bg-teal-50 transition-colors"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(item)}
                              title="Cabut Hak Akses"
                              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden space-y-3">
              {kepalaList.map((item) => {
                const isRowToggling = togglingId === item.id;

                return (
                  <article
                    key={item.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-extrabold text-slate-800 text-sm leading-tight">
                          {item.nama_pejabat}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.jabatan}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{item.user?.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggle(item, 'is_active')}
                        disabled={isRowToggling}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black ${
                          item.is_active
                            ? 'bg-teal-50 text-[#138F81] border border-teal-200'
                            : 'bg-rose-50 text-rose-600 border border-rose-200'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            item.is_active ? 'bg-[#138F81]' : 'bg-rose-400'
                          }`}
                        />
                        <span>{item.is_active ? 'Aktif' : 'Nonaktif'}</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-600">📖 Presensi Madin</span>
                        <button
                          type="button"
                          onClick={() => handleToggle(item, 'can_monitor_madin')}
                          disabled={isRowToggling}
                          className={`px-3 py-1 rounded-xl text-xs font-black ${
                            item.can_monitor_madin
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {item.can_monitor_madin ? 'DIPANTAU' : 'SEMBUNYI'}
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-600">🕌 Presensi Sholat</span>
                        <button
                          type="button"
                          onClick={() => handleToggle(item, 'can_monitor_sholat')}
                          disabled={isRowToggling}
                          className={`px-3 py-1 rounded-xl text-xs font-black ${
                            item.can_monitor_sholat
                              ? 'bg-sky-500 text-white'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {item.can_monitor_sholat ? 'DIPANTAU' : 'SEMBUNYI'}
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-600">📚 Ngaji Kitab</span>
                        <button
                          type="button"
                          onClick={() => handleToggle(item, 'can_monitor_ngaji')}
                          disabled={isRowToggling}
                          className={`px-3 py-1 rounded-xl text-xs font-black ${
                            item.can_monitor_ngaji
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {item.can_monitor_ngaji ? 'DIPANTAU' : 'SEMBUNYI'}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item)}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold"
                      >
                        Hapus
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* MODAL FORM TAMBAH / EDIT KEPALA MADRASAH */}
      {isModalOpen && (
        <ModalForm
          onClose={() => setIsModalOpen(false)}
          title={modalMode === 'add' ? 'Tunjuk Kepala Madrasah / Pejabat' : 'Edit Pengaturan Pejabat'}
        >
          <form onSubmit={handleSaveModal} className="space-y-4">
            <p className="text-xs font-medium text-slate-500 -mt-2 mb-3">
              Atur izin monitoring presensi santri untuk pejabat bersangkutan.
            </p>
          {modalMode === 'add' && (
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                Pilih Akun Ustadz / Guru / Admin <span className="text-rose-500">*</span>
              </label>
              <select
                value={formUserId}
                onChange={(e) => handleUserSelectChange(Number(e.target.value))}
                required
                className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-[#138F81] focus:ring-1 focus:ring-[#138F81] outline-none"
              >
                <option value="">-- Pilih Akun --</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}) - {u.role === 'admin' ? `Admin (${u.admin_type || 'Umum'})` : 'Guru'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
              Nama Pejabat <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formNama}
              onChange={(e) => setFormNama(e.target.value)}
              placeholder="Contoh: Ust. Imam Bashori, M.Pd"
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-[#138F81] focus:ring-1 focus:ring-[#138F81] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
              Jabatan / Unit Madrasah <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formJabatan}
              onChange={(e) => setFormJabatan(e.target.value)}
              placeholder="Contoh: Kepala Madrasah Diniyah (Madin) / Kepala Pondok"
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-[#138F81] focus:ring-1 focus:ring-[#138F81] outline-none"
            />
          </div>

          {/* CHECKBOXES MODUL MONITORING */}
          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200/80 space-y-3">
            <p className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Modul Absensi yang Dipantau:
            </p>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formMadin}
                onChange={(e) => setFormMadin(e.target.checked)}
                className="h-4 w-4 rounded text-[#138F81] focus:ring-[#138F81]"
              />
              <div className="text-xs">
                <span className="font-extrabold text-slate-800">📖 Presensi KBM Madin</span>
                <p className="text-[11px] text-slate-500">Melihat rekap & log kehadiran kelas Diniyah.</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formSholat}
                onChange={(e) => setFormSholat(e.target.checked)}
                className="h-4 w-4 rounded text-[#138F81] focus:ring-[#138F81]"
              />
              <div className="text-xs">
                <span className="font-extrabold text-slate-800">🕌 Presensi Jama'ah Sholat</span>
                <p className="text-[11px] text-slate-500">Melihat rekap & log sholat santri per kamar asrama.</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formNgaji}
                onChange={(e) => setFormNgaji(e.target.checked)}
                className="h-4 w-4 rounded text-[#138F81] focus:ring-[#138F81]"
              />
              <div className="text-xs">
                <span className="font-extrabold text-slate-800">📚 Presensi Ngaji Kitab</span>
                <p className="text-[11px] text-slate-500">Melihat rekap & log pengajian kitab kuning santri.</p>
              </div>
            </label>

            <div className="pt-2 border-t border-slate-200">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="h-4 w-4 rounded text-[#138F81] focus:ring-[#138F81]"
                />
                <span className="text-xs font-bold text-slate-700">Status Akses Aktif</span>
              </label>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSavingModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#138F81] text-white text-xs font-black hover:bg-[#0D7A6F] transition-all shadow-md shadow-[#138F81]/20 cursor-pointer disabled:opacity-50"
            >
              <Save size={15} />
              <span>{isSavingModal ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
            </button>
          </div>
        </form>
      </ModalForm>
      )}
    </div>
  );
}
