import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  DollarSign,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  Lock,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  Unlock,
  Users,
  X,
  Zap
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ToastNotification, type ToastType } from './ToastNotification';
import {
  api,
  type ItAttendanceSettingsResponse,
  type ItGlobalAttendanceConfig,
  type ItGuruAttendanceOverride,
  type ItNotificationSettingsResponse,
  type ItHelpdeskConfig,
  type ItVaultUser
} from '../services/api';

export function ItSystemMasterControlSection() {
  const [activeTab, setActiveTab] = useState<'attendance' | 'notifications' | 'vault' | 'helpdesk'>('attendance');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Floating Toast State (Pojok Kanan Atas)
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: ToastType;
    title?: string;
  } | null>(null);

  const showToast = (text: string, type: ToastType = 'success', title?: string) => {
    setMessage({ text, type: type === 'warning' ? 'info' : type });
    setToast({
      show: true,
      message: text,
      type,
      title: title || (type === 'success' ? 'Berhasil Disimpan!' : type === 'error' ? 'Gagal Disimpan' : 'Informasi Sistem'),
    });
  };

  useEffect(() => {
    if (!toast?.show) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Data State
  const [attendanceData, setAttendanceData] = useState<ItAttendanceSettingsResponse | null>(null);
  const [notificationData, setNotificationData] = useState<ItNotificationSettingsResponse | null>(null);

  // Form State: Global Attendance Config
  const [globalForm, setGlobalForm] = useState<ItGlobalAttendanceConfig>({
    default_open_lead_minutes: 60,
    default_close_hour: '23:00',
    auto_lock_enabled: true,
    allow_late_submission: true,
    late_tolerance_minutes: 60,
  });

  // INLINE Form State: Override Guru (Tidak lagi modal popup, melainkan inline view konsisten)
  const [isFormActive, setIsFormActive] = useState(false);
  const [editingOverride, setEditingOverride] = useState<ItGuruAttendanceOverride | null>(null);
  const [overrideForm, setOverrideForm] = useState<{
    teacher_id: number | '';
    jadwal_id: number | '';
    open_mode: 'lead' | 'custom_hour';
    open_lead_minutes: number;
    custom_open_hour: string;
    close_hour: string;
    is_force_open: boolean;
    is_force_locked: boolean;
    notes: string;
  }>({
    teacher_id: '',
    jadwal_id: '',
    open_mode: 'lead',
    open_lead_minutes: 60,
    custom_open_hour: '',
    close_hour: '23:00',
    is_force_open: false,
    is_force_locked: false,
    notes: '',
  });

  // Action State: Notifikasi
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);
  const [savingNotification, setSavingNotification] = useState<'wali' | 'guru' | null>(null);
  const [triggeringNotification, setTriggeringNotification] = useState<'wali' | 'guru' | null>(null);

  // Vault Kredensial State (Khusus Master IT)
  const [vaultUsers, setVaultUsers] = useState<ItVaultUser[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultSearch, setVaultSearch] = useState('');
  const [vaultRole, setVaultRole] = useState<'all' | 'guru' | 'wali' | 'admin' | 'petugas' | 'keamanan'>('all');
  const [vaultPagination, setVaultPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
    per_page: 15,
  });
  const [revealedPasswords, setRevealedPasswords] = useState<Record<number, boolean>>({});
  const [copiedUserId, setCopiedUserId] = useState<number | null>(null);

  // Helpdesk & WhatsApp Lupa Password State
  const [helpdeskForm, setHelpdeskForm] = useState<ItHelpdeskConfig>({
    whatsapp_number: '6285731998591',
    pic_name: 'Abdullah SyauQillah (Admin IT)',
    contact_type: 'it_master',
    message_template: "Assalamu'alaikum Admin Pesantren Qomaruddin, saya {nama} ({role}) lupa kata sandi akun saya. Mohon bantuannya untuk reset kata sandi ke bawaan. Terima kasih.",
    is_active: true,
  });
  const [loadingHelpdesk, setLoadingHelpdesk] = useState(false);
  const [savingHelpdesk, setSavingHelpdesk] = useState(false);

  // Fetch Attendance Settings
  const loadAttendanceSettings = async () => {
    try {
      const res = await api.getItAttendanceSettings();
      if (res.data) {
        setAttendanceData(res.data);
        setGlobalForm(res.data.global);
      }
    } catch (err: any) {
      console.error('Error loading attendance settings:', err);
      setMessage({ text: err.message || 'Gagal memuat pengaturan presensi.', type: 'error' });
    }
  };

  // Fetch Notification Settings
  const loadNotificationSettings = async () => {
    try {
      const res = await api.getItNotificationSettings();
      if (res.data) {
        setNotificationData(res.data);
      }
    } catch (err: any) {
      console.error('Error loading notification settings:', err);
      setMessage({ text: err.message || 'Gagal memuat pengaturan notifikasi.', type: 'error' });
    }
  };

  // Fetch Credentials Vault (Khusus IT)
  const loadVault = async (page = 1, search = vaultSearch, role = vaultRole) => {
    setVaultLoading(true);
    try {
      const res = await api.getItCredentialsVault({
        page,
        search: search.trim() || undefined,
        role: role === 'all' ? undefined : role,
      });
      if (res.data) {
        setVaultUsers(res.data.users);
        setVaultPagination({
          current_page: res.data.pagination.current_page,
          last_page: res.data.pagination.last_page,
          total: res.data.pagination.total,
          per_page: res.data.pagination.per_page,
        });
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat vault kredensial.', 'error', 'Gagal Memuat Vault');
    } finally {
      setVaultLoading(false);
    }
  };

  const togglePasswordReveal = (userId: number) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const handleCopyPassword = async (userId: number, plainPwd: string) => {
    try {
      await navigator.clipboard.writeText(plainPwd);
      setCopiedUserId(userId);
      setTimeout(() => setCopiedUserId(null), 2500);
      showToast('Kata sandi berhasil disalin ke clipboard!', 'success', 'Sandi Tersalin');
    } catch {
      // clipboard fallback
    }
  };

  // Fetch Helpdesk Settings
  const loadHelpdeskSettings = async () => {
    setLoadingHelpdesk(true);
    try {
      const res = await api.getItHelpdeskSettings();
      if (res.data) {
        setHelpdeskForm(res.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat pengaturan helpdesk.', 'error', 'Gagal Memuat Helpdesk');
    } finally {
      setLoadingHelpdesk(false);
    }
  };

  const handleSaveHelpdesk = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHelpdesk(true);
    try {
      const res = await api.saveItHelpdeskSettings(helpdeskForm);
      if (res.data) {
        setHelpdeskForm(res.data);
      }
      showToast('Pengaturan Kontak WhatsApp Helpdesk & Template Pesan berhasil disimpan!', 'success', 'Helpdesk Disimpan!');
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan pengaturan helpdesk.', 'error', 'Gagal Menyimpan');
    } finally {
      setSavingHelpdesk(false);
    }
  };

  // Initial Load
  useEffect(() => {
    setLoading(true);
    Promise.all([loadAttendanceSettings(), loadNotificationSettings()]).finally(() => {
      setLoading(false);
    });
  }, []);

  // Effect on Tab Change
  useEffect(() => {
    if (activeTab === 'vault') {
      loadVault(1, vaultSearch, vaultRole);
    } else if (activeTab === 'helpdesk') {
      loadHelpdeskSettings();
    }
  }, [activeTab]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setMessage(null);
    try {
      if (activeTab === 'attendance') {
        await loadAttendanceSettings();
      } else if (activeTab === 'notifications') {
        await loadNotificationSettings();
      } else if (activeTab === 'vault') {
        await loadVault(vaultPagination.current_page, vaultSearch, vaultRole);
      } else if (activeTab === 'helpdesk') {
        await loadHelpdeskSettings();
      }
      showToast('Data master kontrol IT berhasil disegarkan.', 'info', 'Data Diperbarui');
    } catch (err: any) {
      showToast(err.message || 'Gagal menyegarkan data.', 'error', 'Gagal Refresh');
    } finally {
      setRefreshing(false);
    }
  };

  // Simpan Konfigurasi Presensi Global
  const handleSaveGlobalAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGlobal(true);
    setMessage(null);
    try {
      const res = await api.saveItGlobalAttendance(globalForm);
      if (res.data) {
        setGlobalForm(res.data);
        showToast('Konfigurasi default presensi guru berhasil diperbarui!', 'success', 'Pengaturan Berhasil Disimpan!');
        await loadAttendanceSettings();
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan pengaturan global.', 'error', 'Gagal Menyimpan Pengaturan');
    } finally {
      setSavingGlobal(false);
    }
  };

  // Buka Form Tambah Override (Inline, non-popup)
  const openAddOverrideForm = () => {
    setEditingOverride(null);
    setOverrideForm({
      teacher_id: '',
      jadwal_id: '',
      open_mode: 'lead',
      open_lead_minutes: globalForm.default_open_lead_minutes || 60,
      custom_open_hour: '',
      close_hour: globalForm.default_close_hour || '23:00',
      is_force_open: false,
      is_force_locked: false,
      notes: '',
    });
    setIsFormActive(true);
  };

  // Buka Form Edit Override (Inline, non-popup)
  const openEditOverrideForm = (override: ItGuruAttendanceOverride) => {
    setEditingOverride(override);
    setOverrideForm({
      teacher_id: override.teacher_id,
      jadwal_id: override.jadwal_id || '',
      open_mode: override.custom_open_hour ? 'custom_hour' : 'lead',
      open_lead_minutes: override.open_lead_minutes ?? 60,
      custom_open_hour: override.custom_open_hour ? override.custom_open_hour.substring(0, 5) : '',
      close_hour: override.close_hour ? override.close_hour.substring(0, 5) : '23:00',
      is_force_open: Boolean(override.is_force_open),
      is_force_locked: Boolean(override.is_force_locked),
      notes: override.notes || '',
    });
    setIsFormActive(true);
  };

  // Simpan Override Guru
  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideForm.teacher_id) {
      showToast('Silakan pilih guru terlebih dahulu.', 'warning', 'Perhatian');
      return;
    }

    setSavingOverride(true);
    setMessage(null);
    try {
      await api.saveItGuruOverride({
        id: editingOverride ? editingOverride.id : undefined,
        teacher_id: Number(overrideForm.teacher_id),
        jadwal_id: overrideForm.jadwal_id ? Number(overrideForm.jadwal_id) : null,
        open_lead_minutes: overrideForm.open_mode === 'lead' ? Number(overrideForm.open_lead_minutes) : null,
        custom_open_hour: overrideForm.open_mode === 'custom_hour' ? overrideForm.custom_open_hour : null,
        close_hour: overrideForm.close_hour || '23:00',
        is_force_open: overrideForm.is_force_open,
        is_force_locked: overrideForm.is_force_locked,
        notes: overrideForm.notes || null,
      });

      showToast(
        `Aturan khusus presensi guru berhasil ${editingOverride ? 'diperbarui' : 'ditambahkan'}!`,
        'success',
        'Override Berhasil Disimpan!'
      );
      setIsFormActive(false);
      await loadAttendanceSettings();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan aturan override.', 'error', 'Gagal Menyimpan Override');
    } finally {
      setSavingOverride(false);
    }
  };

  // Hapus Override
  const handleDeleteOverride = async (id: number, teacherName: string) => {
    if (!confirm(`Hapus aturan khusus presensi untuk guru "${teacherName}"?`)) return;
    try {
      await api.deleteItGuruOverride(id);
      showToast('Aturan khusus guru berhasil dihapus.', 'info', 'Aturan Dihapus');
      await loadAttendanceSettings();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus aturan.', 'error', 'Gagal Menghapus');
    }
  };

  // Toggle Force Open / Force Locked Cepat
  const handleToggleForce = async (id: number, type: 'force_open' | 'force_locked') => {
    try {
      await api.toggleItForceStatus(id, type);
      showToast(
        type === 'force_open' ? 'Mode Buka Paksa presensi berhasil diubah!' : 'Mode Kunci Paksa presensi berhasil diubah!',
        'success',
        'Status Kontrol Diperbarui'
      );
      await loadAttendanceSettings();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status kontrol darurat.', 'error', 'Gagal Mengubah Status');
    }
  };

  // Simpan Notifikasi SPP Wali
  const handleSaveWaliNotification = async () => {
    if (!notificationData) return;
    setSavingNotification('wali');
    setMessage(null);
    try {
      await api.saveItNotificationSettings('wali_billing', notificationData.wali_billing);
      showToast('Pengaturan otomatisasi notifikasi SPP wali berhasil disimpan!', 'success', 'Konfigurasi SPP Disimpan!');
      await loadNotificationSettings();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan konfigurasi notifikasi SPP.', 'error', 'Gagal Menyimpan');
    } finally {
      setSavingNotification(null);
    }
  };

  // Simpan Notifikasi Guru
  const handleSaveGuruNotification = async () => {
    if (!notificationData) return;
    setSavingNotification('guru');
    setMessage(null);
    try {
      await api.saveItNotificationSettings('guru_deadline', notificationData.guru_deadline);
      showToast('Pengaturan peringatan presensi guru berhasil disimpan!', 'success', 'Konfigurasi Guru Disimpan!');
      await loadNotificationSettings();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan konfigurasi peringatan guru.', 'error', 'Gagal Menyimpan');
    } finally {
      setSavingNotification(null);
    }
  };

  // Trigger Instan Broadcast SPP Wali
  const handleTriggerWaliBroadcast = async () => {
    const stats = notificationData?.stats;
    const count = stats?.unpaid_students_count || 0;
    if (!confirm(`Kirim broadcast pengingat tagihan SPP SEKARANG kepada ${count} wali santri yang memiliki tunggakan belum lunas?`)) {
      return;
    }

    setTriggeringNotification('wali');
    setMessage(null);
    try {
      const res = await api.triggerItWaliBillingReminder(false);
      showToast(
        res.message || 'Notifikasi pengingat SPP berhasil dikirimkan ke wali santri yang belum lunas.',
        'success',
        'Broadcast Berhasil Terkirim!'
      );
      await loadNotificationSettings();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengirimkan notifikasi pengingat SPP.', 'error', 'Gagal Mengirim');
    } finally {
      setTriggeringNotification(null);
    }
  };

  // Trigger Instan Broadcast Guru
  const handleTriggerGuruBroadcast = async () => {
    if (!confirm('Kirimkan notifikasi peringatan presensi hari ini SEKARANG kepada semua guru yang jadwalnya belum diabsen?')) {
      return;
    }

    setTriggeringNotification('guru');
    setMessage(null);
    try {
      const res = await api.triggerItGuruReminder(true);
      showToast(
        res.message || 'Peringatan presensi terkirim ke guru yang jadwalnya belum lengkap hari ini.',
        'success',
        'Peringatan Berhasil Terkirim!'
      );
      await loadNotificationSettings();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengirimkan peringatan presensi guru.', 'error', 'Gagal Mengirim');
    } finally {
      setTriggeringNotification(null);
    }
  };

  // =========================================================================
  // 🌟 JIKA FORM ACTIVE: TAMPILKAN INLINE FORM CARD (KONSISTEN DENGAN MASTER DATA)
  // TIDAK ADA POPUP/MODAL LAGI!
  // =========================================================================
  if (isFormActive) {
    return (
      <div className="w-full flex-1">
        {/* Floating Toast Notification (Pojok Kanan Atas) */}
        <ToastNotification
          show={Boolean(toast?.show)}
          type={toast?.type || 'success'}
          title={toast?.title}
          message={toast?.message || ''}
          onClose={() => setToast(null)}
        />
        <div className="flex w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
          {/* Header Card Form Konsisten */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsFormActive(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                title="Kembali ke Daftar"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-[#2D3436]">
                    {editingOverride ? 'Edit Aturan Khusus Presensi Guru' : 'Tambah Aturan Khusus Presensi Guru'}
                  </h2>
                  <span className="rounded-xl bg-[#E8F7F3] px-2.5 py-0.5 text-xs font-black text-[#138F81] border border-teal-200">
                    Master IT Control
                  </span>
                </div>
                <p className="text-sm font-semibold text-[#636E72] mt-0.5">
                  Atur jam buka & jam tutup khusus untuk guru tertentu, atau gunakan kontrol darurat (Buka Paksa / Kunci Paksa).
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsFormActive(false)}
              className="grid h-10 w-10 place-items-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"
              title="Tutup Form"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form Content */}
          <form id="guru-override-form" onSubmit={handleSaveOverride} className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 1. Pilih Guru */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  1. Pilih Guru Target: <span className="text-rose-500">*</span>
                </label>
                <select
                  value={overrideForm.teacher_id}
                  onChange={(e) =>
                    setOverrideForm({ ...overrideForm, teacher_id: e.target.value ? Number(e.target.value) : '' })
                  }
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#138F81] focus:ring-1 focus:ring-[#138F81] outline-none"
                >
                  <option value="">-- Pilih Guru --</option>
                  {attendanceData?.teachers?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.kode_guru ? `Kode: ${t.kode_guru}` : t.email || `ID: ${t.id}`})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">Pilih guru yang ingin diatur jam presensinya.</p>
              </div>

              {/* 2. Target Jadwal */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  2. Target Jadwal (Opsional):
                </label>
                <select
                  value={overrideForm.jadwal_id}
                  onChange={(e) =>
                    setOverrideForm({ ...overrideForm, jadwal_id: e.target.value ? Number(e.target.value) : '' })
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#138F81] focus:ring-1 focus:ring-[#138F81] outline-none"
                >
                  <option value="">⭐ Berlaku Untuk Seluruh Jadwal Mengajar Guru Ini</option>
                  {attendanceData?.jadwals
                    ?.filter((j) => !overrideForm.teacher_id || j.teacher_id === Number(overrideForm.teacher_id))
                    ?.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.hari} {j.jam_mulai?.substring(0, 5)} - {j.mapel?.name || j.mapel?.nama || 'Mapel'} ({j.kelas?.name || j.sifir || 'Kelas'})
                      </option>
                    ))}
                </select>
                <p className="text-xs text-slate-500">
                  Kosongkan jika ingin menerapkan aturan ini ke seluruh jadwal yang diampu guru.
                </p>
              </div>
            </div>

            {/* 3. Pengaturan Jam Buka Presensi */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                3. Aturan Waktu Buka Presensi Guru:
              </label>

              <div className="flex flex-wrap gap-6 text-sm font-bold">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="open_mode"
                    value="lead"
                    checked={overrideForm.open_mode === 'lead'}
                    onChange={() => setOverrideForm({ ...overrideForm, open_mode: 'lead' })}
                    className="h-4 w-4 text-[#138F81] focus:ring-[#138F81]"
                  />
                  <span>H-X Menit Sebelum Jam Pelajaran Dimulai</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="open_mode"
                    value="custom_hour"
                    checked={overrideForm.open_mode === 'custom_hour'}
                    onChange={() => setOverrideForm({ ...overrideForm, open_mode: 'custom_hour' })}
                    className="h-4 w-4 text-[#138F81] focus:ring-[#138F81]"
                  />
                  <span>Buka Tepat Jam Tertentu (Misal: 17:00 / 18:00 WIB)</span>
                </label>
              </div>

              {overrideForm.open_mode === 'lead' ? (
                <div className="max-w-xs relative">
                  <input
                    type="number"
                    min={0}
                    max={720}
                    step={5}
                    value={overrideForm.open_lead_minutes}
                    onChange={(e) =>
                      setOverrideForm({ ...overrideForm, open_lead_minutes: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold focus:border-[#138F81] outline-none"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-slate-500 font-bold">Menit Sebelumnya</span>
                </div>
              ) : (
                <div className="max-w-xs">
                  <input
                    type="time"
                    value={overrideForm.custom_open_hour}
                    onChange={(e) => setOverrideForm({ ...overrideForm, custom_open_hour: e.target.value })}
                    required={overrideForm.open_mode === 'custom_hour'}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold focus:border-[#138F81] outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-1">Presensi akan terbuka tepat pada jam ini.</p>
                </div>
              )}
            </div>

            {/* 4. Pengaturan Jam Tutup Presensi */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                4. Batas Waktu Tutup Presensi Khusus Guru Ini:
              </label>
              <div className="max-w-xs">
                <input
                  type="time"
                  value={overrideForm.close_hour}
                  onChange={(e) => setOverrideForm({ ...overrideForm, close_hour: e.target.value })}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold focus:border-[#138F81] outline-none"
                />
              </div>
              <p className="text-xs text-slate-500">
                Admin IT bisa memajukan batas tutup (misal jadi 22:00) atau memperpanjangnya.
              </p>
            </div>

            {/* 5. Kontrol Status Darurat Langsung (Bypass) */}
            <div className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-3">
              <div className="text-xs font-black text-amber-900 flex items-center gap-2 uppercase tracking-wider">
                <Zap className="w-4 h-4 text-amber-600" />
                5. KONTROL STATUS DARURAT LANGSUNG (INSTANT OVERRIDE):
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <label className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-emerald-200 cursor-pointer shadow-xs">
                  <input
                    type="checkbox"
                    checked={overrideForm.is_force_open}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setOverrideForm({
                        ...overrideForm,
                        is_force_open: checked,
                        is_force_locked: checked ? false : overrideForm.is_force_locked,
                      });
                    }}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <div>
                    <span className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
                      <Unlock className="w-3.5 h-3.5" /> Buka Paksa Sekarang (Force Open)
                    </span>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Membuka presensi guru ini seketika tanpa peduli batasan jam atau hari.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-red-200 cursor-pointer shadow-xs">
                  <input
                    type="checkbox"
                    checked={overrideForm.is_force_locked}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setOverrideForm({
                        ...overrideForm,
                        is_force_locked: checked,
                        is_force_open: checked ? false : overrideForm.is_force_open,
                      });
                    }}
                    className="mt-0.5 rounded text-red-600 focus:ring-red-500 h-4 w-4"
                  />
                  <div>
                    <span className="text-xs font-black text-red-800 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Kunci Paksa Sekarang (Force Locked)
                    </span>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Memblokir guru ini dari input absensi saat ini juga.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* 6. Catatan Admin IT */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                6. Catatan / Alasan Admin IT (Opsional):
              </label>
              <input
                type="text"
                placeholder="Misal: Izin buka awal untuk persiapan acara maulid / ujian praktek"
                value={overrideForm.notes}
                onChange={(e) => setOverrideForm({ ...overrideForm, notes: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#138F81] outline-none"
              />
            </div>
          </form>

          {/* Footer Action Buttons Konsisten & Responsif */}
          <div className="flex flex-col-reverse sm:flex-row shrink-0 items-stretch sm:items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 sm:px-6 py-4">
            <button
              type="button"
              onClick={() => setIsFormActive(false)}
              disabled={savingOverride}
              className="w-full sm:w-auto rounded-2xl bg-white px-6 py-2.5 text-sm font-bold text-[#636E72] shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer text-center"
            >
              Batal
            </button>
            <button
              type="submit"
              form="guru-override-form"
              disabled={savingOverride}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-[#138F81] px-8 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-[#138F81]/20 hover:bg-[#0E6A5F] transition-colors disabled:opacity-70 cursor-pointer"
            >
              <CheckCircle2 size={18} className={savingOverride ? 'animate-spin' : ''} />
              <span>{savingOverride ? 'Menyimpan...' : 'Simpan Aturan Khusus Guru'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW UTAMA CMS (JIKA TIDAK SEDANG EDIT/TAMBAH OVERRIDE)
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* Floating Toast Notification (Pojok Kanan Atas) */}
      <ToastNotification
        show={Boolean(toast?.show)}
        type={toast?.type || 'success'}
        title={toast?.title}
        message={toast?.message || ''}
        onClose={() => setToast(null)}
      />

      {/* Hero Header Responsif */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 sm:p-7 text-white shadow-xl border border-indigo-500/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[11px] sm:text-xs font-semibold mb-2">
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <span>EXCLUSIVELY FOR IT MASTER ADMIN</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Sliders className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400 shrink-0" />
              <span>CMS Master Kontrol Sistem & Smart Notification</span>
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Pusat otoritas mutlak Admin IT: kendalikan jam buka & tutup presensi guru secara leluasa (global maupun per-guru),
              buka/kunci darurat, serta atur notifikasi pintar tagihan SPP wali dan peringatan presensi guru.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-start md:self-center">
            {attendanceData?.server_time && (
              <div className="flex items-center gap-2 bg-slate-800/90 px-3.5 py-2 rounded-xl border border-slate-700 text-xs text-slate-300">
                <Clock className="w-3.5 h-3.5 text-indigo-400 animate-pulse shrink-0" />
                <span>Waktu Server: <strong className="text-white">{attendanceData.server_time.split(' ')[1]} WIB</strong></span>
              </div>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-xs font-bold text-white shadow transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
          </div>
        </div>

        {/* Decorative ambient glows */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -top-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Alert Message Banner */}
      {message && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl border text-sm transition-all ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : message.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-indigo-50 text-indigo-800 border-indigo-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          ) : message.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-indigo-600" />
          )}
          <span className="font-medium text-xs sm:text-sm">{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="ml-auto text-xs opacity-70 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs Responsif (Grid 1 col on mobile, 2 col on tablet, 4 col on desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'attendance'
              ? 'bg-white text-[#138F81] shadow-sm ring-1 ring-slate-200 font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 rounded-lg shrink-0 ${activeTab === 'attendance' ? 'bg-teal-50 text-[#138F81]' : 'bg-slate-200/60 text-slate-500'}`}>
              <Clock className="w-4 h-4" />
            </div>
            <span className="truncate">Presensi Guru</span>
          </div>
          {attendanceData?.overrides?.length ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 shrink-0">
              {attendanceData.overrides.length}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'notifications'
              ? 'bg-white text-[#138F81] shadow-sm ring-1 ring-slate-200 font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 rounded-lg shrink-0 ${activeTab === 'notifications' ? 'bg-amber-50 text-amber-600' : 'bg-slate-200/60 text-slate-500'}`}>
              <Bell className="w-4 h-4" />
            </div>
            <span className="truncate">Notifikasi SPP & Guru</span>
          </div>
          {notificationData?.stats?.unpaid_students_count ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 shrink-0">
              {notificationData.stats.unpaid_students_count}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vault')}
          className={`flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'vault'
              ? 'bg-white text-[#138F81] shadow-sm ring-1 ring-slate-200 font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 rounded-lg shrink-0 ${activeTab === 'vault' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200/60 text-slate-500'}`}>
              <KeyRound className="w-4 h-4" />
            </div>
            <span className="truncate">Vault Sandi Pengguna</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 shrink-0">
            Khusus IT
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('helpdesk')}
          className={`flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'helpdesk'
              ? 'bg-white text-[#138F81] shadow-sm ring-1 ring-slate-200 font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 rounded-lg shrink-0 ${activeTab === 'helpdesk' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200/60 text-slate-500'}`}>
              <MessageSquare className="w-4 h-4" />
            </div>
            <span className="truncate">WhatsApp Lupa Sandi</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 shrink-0">
            Helpdesk
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB A: KONTROL JAM PRESENSI GURU (GLOBAL & PER-GURU) */}
      {/* ========================================================================= */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {/* Card 1: Pengaturan Default Jam Presensi Global */}
          <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">1. Aturan Jam Presensi Guru (Default Global)</h3>
                  <p className="text-xs text-slate-500">
                    Berlaku secara otomatis untuk seluruh guru jika tidak memiliki aturan override khusus.
                  </p>
                </div>
              </div>
              <span className="self-start sm:self-center px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold whitespace-nowrap">
                Default: Buka H-1 Jam &bull; Tutup 23:00 WIB
              </span>
            </div>

            <form onSubmit={handleSaveGlobalAttendance} className="mt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Default Open Lead Minutes */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Jendela Buka Sebelum Jadwal:
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={720}
                      step={5}
                      value={globalForm.default_open_lead_minutes}
                      onChange={(e) =>
                        setGlobalForm({ ...globalForm, default_open_lead_minutes: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#138F81] focus:outline-none focus:ring-2 focus:ring-teal-100"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-medium">Menit</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {globalForm.default_open_lead_minutes >= 60
                      ? `(${globalForm.default_open_lead_minutes / 60} jam sebelum jam pelajaran dimulai)`
                      : `(${globalForm.default_open_lead_minutes} menit sebelum pelajaran)`}
                  </p>
                </div>

                {/* Default Close Hour */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Batas Jam Tutup Presensi:
                  </label>
                  <input
                    type="time"
                    value={globalForm.default_close_hour}
                    onChange={(e) => setGlobalForm({ ...globalForm, default_close_hour: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#138F81] focus:outline-none focus:ring-2 focus:ring-teal-100"
                    required
                  />
                  <p className="text-[11px] text-slate-500">
                    Default 23:00. Admin IT bisa turunkan ke 22:00 atau jam berapa pun.
                  </p>
                </div>

                {/* Toggle Auto Lock */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Kunci Otomatis Setelah Jam Tutup:
                  </label>
                  <div className="pt-1">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={globalForm.auto_lock_enabled}
                        onChange={(e) => setGlobalForm({ ...globalForm, auto_lock_enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#138F81]"></div>
                      <span className="ml-3 text-xs font-medium text-slate-700">
                        {globalForm.auto_lock_enabled ? 'Aktif (Terkunci Ketat)' : 'Nonaktif (Bebas)'}
                      </span>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Jika aktif, guru tidak bisa input absensi setelah jam {globalForm.default_close_hour}.
                  </p>
                </div>

                {/* Toggle Allow Late Submission */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Izinkan Pengisian Terlambat:
                  </label>
                  <div className="pt-1">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={globalForm.allow_late_submission}
                        onChange={(e) =>
                          setGlobalForm({ ...globalForm, allow_late_submission: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#138F81]"></div>
                      <span className="ml-3 text-xs font-medium text-slate-700">
                        {globalForm.allow_late_submission ? 'Boleh (Diberi Flag Terlambat)' : 'Dilarang'}
                      </span>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Diizinkan menginput setelah jam KBM selesai selama belum melewati jam batas tutup.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={savingGlobal}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] active:scale-95 text-white text-sm font-extrabold shadow-md shadow-[#138F81]/20 transition disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{savingGlobal ? 'Menyimpan...' : 'Simpan Konfigurasi Presensi Global'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Override Aturan Khusus By-Guru & Emergency Force Toggles */}
          <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    2. Override Aturan Khusus By-Guru (Buka/Tutup Bebas & Force Control)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Admin IT bebas memilih guru tertentu untuk jam buka khusus, jam tutup custom, atau Buka Paksa / Kunci Paksa.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={openAddOverrideForm}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] active:scale-95 text-white text-xs font-black shadow-md shadow-[#138F81]/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tambah Aturan Khusus Guru</span>
              </button>
            </div>

            {/* Overrides List */}
            <div className="mt-6">
              {!attendanceData?.overrides || attendanceData.overrides.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <Sliders className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Belum ada aturan khusus guru</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Saat ini seluruh guru mengikuti jam default global (buka H-1 jam, tutup {globalForm.default_close_hour}).
                    Klik tombol di atas jika ingin membuat pengecualian jam buka/tutup untuk guru tertentu.
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-700 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Guru & Target</th>
                          <th className="px-4 py-3">Jam Buka Khusus</th>
                          <th className="px-4 py-3">Batas Jam Tutup</th>
                          <th className="px-4 py-3">Status Kontrol Darurat</th>
                          <th className="px-4 py-3">Catatan IT</th>
                          <th className="px-4 py-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attendanceData.overrides.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition">
                            {/* Guru & Jadwal */}
                            <td className="px-4 py-3.5">
                              <div className="font-bold text-slate-900">{item.teacher?.name || `Guru #${item.teacher_id}`}</div>
                              <div className="text-xs text-slate-500">
                                {item.jadwal ? (
                                  <span className="inline-flex items-center gap-1 text-indigo-600 font-medium">
                                    Jadwal: {item.jadwal.mapel?.name || item.jadwal.mapel?.nama || 'Mapel'} ({item.jadwal.kelas?.name || item.jadwal.sifir || 'Kelas'}) &bull; {item.jadwal.hari} {item.jadwal.jam_mulai}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                    ⭐ Berlaku Untuk Semua Jadwal Guru Ini
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Jam Buka */}
                            <td className="px-4 py-3.5">
                              {item.custom_open_hour ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold">
                                  <Clock className="w-3.5 h-3.5" />
                                  Pukul {item.custom_open_hour.substring(0, 5)} WIB
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium">
                                  H-{item.open_lead_minutes ?? 60} Menit
                                </span>
                              )}
                            </td>

                            {/* Jam Tutup */}
                            <td className="px-4 py-3.5">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold">
                                {item.close_hour ? item.close_hour.substring(0, 5) : '23:00'} WIB
                              </span>
                            </td>

                            {/* Status Kontrol Darurat */}
                            <td className="px-4 py-3.5">
                              {item.is_force_open ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold animate-pulse shadow-sm">
                                  <Unlock className="w-3 h-3" />
                                  BUKA PAKSA AKTIF
                                </span>
                              ) : item.is_force_locked ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white text-xs font-bold shadow-sm">
                                  <Lock className="w-3 h-3" />
                                  KUNCI PAKSA AKTIF
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                                  Normal Sesuai Jadwal
                                </span>
                              )}
                            </td>

                            {/* Catatan */}
                            <td className="px-4 py-3.5 text-xs text-slate-500 max-w-xs truncate">
                              {item.notes || '-'}
                            </td>

                            {/* Aksi & Quick Toggles */}
                            <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleToggleForce(item.id, 'force_open')}
                                title={item.is_force_open ? 'Nonaktifkan Buka Paksa' : 'Buka Paksa Presensi Guru Ini Sekarang'}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 cursor-pointer ${
                                  item.is_force_open
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300'
                                }`}
                              >
                                <Unlock className="w-3.5 h-3.5" />
                                {item.is_force_open ? 'Batal Buka' : 'Buka Paksa'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleForce(item.id, 'force_locked')}
                                title={item.is_force_locked ? 'Lepas Kunci Paksa' : 'Kunci Paksa Presensi Guru Ini Sekarang'}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 cursor-pointer ${
                                  item.is_force_locked
                                    ? 'bg-red-600 text-white hover:bg-red-700'
                                    : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-300'
                                }`}
                              >
                                <Lock className="w-3.5 h-3.5" />
                                {item.is_force_locked ? 'Batal Kunci' : 'Kunci Paksa'}
                              </button>

                              <button
                                type="button"
                                onClick={() => openEditOverrideForm(item)}
                                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                                title="Edit Aturan"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteOverride(item.id, item.teacher?.name || 'Guru')}
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition cursor-pointer"
                                title="Hapus Aturan"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View (Khusus Layar HP) */}
                  <div className="block md:hidden space-y-3.5">
                    {attendanceData.overrides.map((item) => (
                      <article
                        key={item.id}
                        className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="min-w-0">
                            <p className="font-extrabold text-slate-800 text-sm leading-tight">
                              {item.teacher?.name || `Guru #${item.teacher_id}`}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {item.jadwal
                                  ? `${item.jadwal.mapel?.name || item.jadwal.mapel?.nama || 'Mapel'} (${item.jadwal.kelas?.name || item.jadwal.sifir || 'Kelas'}) • ${item.jadwal.hari} ${item.jadwal.jam_mulai}`
                                : '⭐ Seluruh Jadwal Mengajar'}
                            </p>
                          </div>

                          {item.is_force_open ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black shrink-0 animate-pulse">
                              BUKA PAKSA
                            </span>
                          ) : item.is_force_locked ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black shrink-0">
                              KUNCI PAKSA
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold shrink-0">
                              Normal
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                          <div className="bg-slate-50 p-2 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-400 block">Jam Buka:</span>
                            <span className="font-extrabold text-slate-700">
                              {item.custom_open_hour
                                ? `${item.custom_open_hour.substring(0, 5)} WIB`
                                : `H-${item.open_lead_minutes ?? 60} Menit`}
                            </span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-400 block">Batas Tutup:</span>
                            <span className="font-extrabold text-slate-700">
                              {item.close_hour ? item.close_hour.substring(0, 5) : '23:00'} WIB
                            </span>
                          </div>
                        </div>

                        {item.notes && (
                          <p className="text-[11px] text-slate-500 italic bg-amber-50/50 p-2 rounded-xl border border-amber-100">
                            Catatan IT: {item.notes}
                          </p>
                        )}

                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleForce(item.id, 'force_open')}
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition inline-flex items-center gap-1 ${
                                item.is_force_open
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              <Unlock className="w-3 h-3" />
                              {item.is_force_open ? 'Batal Buka' : 'Buka Paksa'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleForce(item.id, 'force_locked')}
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition inline-flex items-center gap-1 ${
                                item.is_force_locked
                                  ? 'bg-red-600 text-white'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}
                            >
                              <Lock className="w-3 h-3" />
                              {item.is_force_locked ? 'Batal Kunci' : 'Kunci Paksa'}
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 ml-auto">
                            <button
                              type="button"
                              onClick={() => openEditOverrideForm(item)}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteOverride(item.id, item.teacher?.name || 'Guru')}
                              className="px-3 py-1.5 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB B: ENGINE NOTIFIKASI CERDAS (WALI SPP & PERINGATAN GURU) */}
      {/* ========================================================================= */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          {/* Card 1: Notifikasi Pengingat Tagihan SPP Wali Santri */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    1. Otomatisasi Notifikasi Tagihan SPP Wali Santri
                  </h3>
                  <p className="text-xs text-slate-500">
                    Notifikasi bulanan tagihan SPP: secara otomatis HANYA menyasar wali santri dengan tunggakan belum lunas.
                  </p>
                </div>
              </div>

              {/* Statistics Chips */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
                  ⚠️ {notificationData?.stats?.unpaid_students_count || 0} Santri Belum Lunas
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold">
                  Total {notificationData?.stats?.unpaid_bills_count || 0} Invoice
                </div>
              </div>
            </div>

            {/* Notice banner rule */}
            <div className="mt-4 p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 flex items-start gap-2.5">
              <Zap className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Aturan Cerdas Terverifikasi:</strong> Sistem menfilter secara ketat data pembayaran santri.
                Wali santri yang sudah berstatus <strong>LUNAS (100%)</strong> dipastikan sama sekali tidak akan menerima pesan notifikasi tagihan ini.
              </div>
            </div>

            {notificationData?.wali_billing && (
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Toggle Active */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Status Notifikasi SPP:</label>
                    <div className="pt-1">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationData.wali_billing.is_enabled}
                          onChange={(e) =>
                            setNotificationData({
                              ...notificationData,
                              wali_billing: { ...notificationData.wali_billing, is_enabled: e.target.checked },
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        <span className="ml-3 text-xs font-semibold text-slate-800">
                          {notificationData.wali_billing.is_enabled ? 'Aktif Otomatis' : 'Nonaktif'}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Scheduled Day of Month */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Jadwal Tanggal Kirim Rutin:
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={notificationData.wali_billing.scheduled_day_of_month}
                        onChange={(e) =>
                          setNotificationData({
                            ...notificationData,
                            wali_billing: {
                              ...notificationData.wali_billing,
                              scheduled_day_of_month: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-[#138F81] focus:outline-none font-bold"
                      />
                      <span className="absolute right-3 top-2 text-xs text-slate-500 font-medium">Tiap Bulan</span>
                    </div>
                    <p className="text-[11px] text-slate-500">Default: Setiap tanggal 10 tiap bulannya.</p>
                  </div>

                  {/* Scheduled Hour */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Jam Kirim Rutin:</label>
                    <input
                      type="time"
                      value={notificationData.wali_billing.scheduled_hour.substring(0, 5)}
                      onChange={(e) =>
                        setNotificationData({
                          ...notificationData,
                          wali_billing: { ...notificationData.wali_billing, scheduled_hour: e.target.value },
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-[#138F81] focus:outline-none font-bold"
                    />
                    <p className="text-[11px] text-slate-500">Default: Pukul 07:00 pagi WIB.</p>
                  </div>
                </div>

                {/* Template Message */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Template Judul Notifikasi:
                    </label>
                    <input
                      type="text"
                      value={notificationData.wali_billing.template_title}
                      onChange={(e) =>
                        setNotificationData({
                          ...notificationData,
                          wali_billing: { ...notificationData.wali_billing, template_title: e.target.value },
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-[#138F81] focus:outline-none font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Template Isi Pesan (Variabel: {'{nama_santri}'}, {'{total_tunggakan}'}, {'{link_pembayaran}'}):
                    </label>
                    <textarea
                      rows={3}
                      value={notificationData.wali_billing.template_body}
                      onChange={(e) =>
                        setNotificationData({
                          ...notificationData,
                          wali_billing: { ...notificationData.wali_billing, template_body: e.target.value },
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 p-3 text-sm font-mono focus:border-[#138F81] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Actions Responsif */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
                  <div className="text-xs text-slate-500">
                    Terakhir dieksekusi: {notificationData.wali_billing.last_run_at || 'Belum pernah'}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleTriggerWaliBroadcast}
                      disabled={triggeringNotification === 'wali'}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold shadow transition disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{triggeringNotification === 'wali'
                        ? 'Mengirimkan...'
                        : '🚀 Kirim Pengingat SPP Sekarang (Instan)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveWaliNotification}
                      disabled={savingNotification === 'wali'}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] active:scale-95 text-white text-xs font-bold shadow-md shadow-[#138F81]/20 transition disabled:opacity-50 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{savingNotification === 'wali' ? 'Menyimpan...' : 'Simpan Pengaturan SPP'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Notifikasi Peringatan Presensi Guru (Deadline Warning) */}
          <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    2. Notifikasi Peringatan Presensi Guru (Tenggat Waktu Hampir Habis)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mengirim peringatan kepada guru yang belum menyelesaikan pengisian absensi menjelang jam penutupan.
                  </p>
                </div>
              </div>

              <span className="self-start sm:self-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold whitespace-nowrap">
                Otomatis Menjelang Jam Tutup
              </span>
            </div>

            {notificationData?.guru_deadline && (
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Toggle Active */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Status Peringatan Guru:</label>
                    <div className="pt-1">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationData.guru_deadline.is_enabled}
                          onChange={(e) =>
                            setNotificationData({
                              ...notificationData,
                              guru_deadline: { ...notificationData.guru_deadline, is_enabled: e.target.checked },
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#138F81]"></div>
                        <span className="ml-3 text-xs font-semibold text-slate-800">
                          {notificationData.guru_deadline.is_enabled ? 'Aktif Otomatis' : 'Nonaktif'}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Warning minutes before close */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Kirim Peringatan Berapa Menit Sebelum Jam Tutup:
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={10}
                        max={300}
                        step={5}
                        value={notificationData.guru_deadline.warning_minutes_before_close}
                        onChange={(e) =>
                          setNotificationData({
                            ...notificationData,
                            guru_deadline: {
                              ...notificationData.guru_deadline,
                              warning_minutes_before_close: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-[#138F81] focus:outline-none font-bold"
                      />
                      <span className="absolute right-3 top-2 text-xs text-slate-500 font-medium">Menit Sebelumnya</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Default: 60 menit (pukul 22:00 jika batas tutup jam 23:00 WIB).
                    </p>
                  </div>
                </div>

                {/* Template Message */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Template Judul Peringatan:
                    </label>
                    <input
                      type="text"
                      value={notificationData.guru_deadline.template_title}
                      onChange={(e) =>
                        setNotificationData({
                          ...notificationData,
                          guru_deadline: { ...notificationData.guru_deadline, template_title: e.target.value },
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-[#138F81] focus:outline-none font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Template Isi Pesan (Variabel: {'{mapel}'}, {'{kelas}'}, {'{jam_tutup}'}):
                    </label>
                    <textarea
                      rows={3}
                      value={notificationData.guru_deadline.template_body}
                      onChange={(e) =>
                        setNotificationData({
                          ...notificationData,
                          guru_deadline: { ...notificationData.guru_deadline, template_body: e.target.value },
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 p-3 text-sm font-mono focus:border-[#138F81] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Actions Responsif */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
                  <div className="text-xs text-slate-500">
                    Terakhir dieksekusi: {notificationData.guru_deadline.last_run_at || 'Belum pernah'}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleTriggerGuruBroadcast}
                      disabled={triggeringNotification === 'guru'}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-bold shadow transition disabled:opacity-50 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{triggeringNotification === 'guru'
                        ? 'Memeriksa & Mengirimkan...'
                        : '⚡ Kirim Peringatan Hari Ini Sekarang'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveGuruNotification}
                      disabled={savingNotification === 'guru'}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] active:scale-95 text-white text-xs font-bold shadow-md shadow-[#138F81]/20 transition disabled:opacity-50 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{savingNotification === 'guru' ? 'Menyimpan...' : 'Simpan Pengaturan Peringatan'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB C: VAULT KREDENSIAL & KATA SANDI PENGGUNA (KHUSUS MASTER IT) */}
      {/* ========================================================================= */}
      {activeTab === 'vault' && (
        <div className="space-y-6">
          {/* Header Card & Security Notice */}
          <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-start gap-3">
                <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-700 shrink-0 border border-indigo-200/60">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black text-slate-900">
                      Vault Kredensial & Sandi Akun Pengguna
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                      AES-256 Reversible Encryption
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                      Khusus Master IT
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                    Sistem enkripsi dua arah memungkinkan Admin IT melihat kata sandi asli akun guru, wali santri, dan petugas untuk keperluan audit dan investigasi kendala login.
                    Secara default kata sandi disamarkan dengan tanda bintang (••••••••••••). Klik ikon mata untuk melihat kata sandi asli.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                <button
                  type="button"
                  onClick={() => loadVault(vaultPagination.current_page, vaultSearch, vaultRole)}
                  disabled={vaultLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${vaultLoading ? 'animate-spin' : ''}`} />
                  <span>Muat Ulang Vault</span>
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={vaultSearch}
                  onChange={(e) => setVaultSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      loadVault(1, vaultSearch, vaultRole);
                    }
                  }}
                  placeholder="Cari nama, email, username, NIS, atau kode guru..."
                  className="w-full pl-10 pr-24 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:border-[#138F81] focus:ring-1 focus:ring-[#138F81] outline-hidden transition-all"
                />
                <button
                  type="button"
                  onClick={() => loadVault(1, vaultSearch, vaultRole)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-[#138F81] text-white text-[11px] font-extrabold rounded-xl hover:bg-[#0d7367] transition cursor-pointer"
                >
                  Cari
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                {(
                  [
                    { id: 'all', label: 'Semua Role' },
                    { id: 'guru', label: 'Guru' },
                    { id: 'wali', label: 'Wali Santri' },
                    { id: 'admin', label: 'Admin' },
                    { id: 'petugas', label: 'Petugas' },
                    { id: 'keamanan', label: 'Keamanan' },
                  ] as const
                ).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setVaultRole(r.id);
                      loadVault(1, vaultSearch, r.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                      vaultRole === r.id
                        ? 'bg-[#138F81] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table / List Pengguna */}
          <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            {vaultLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold text-slate-500 animate-pulse">
                  Mendekripsi dan memuat vault kata sandi...
                </span>
              </div>
            ) : vaultUsers.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <ShieldCheck className="w-12 h-12 mx-auto text-slate-300" />
                <p className="font-bold text-sm text-slate-700">Tidak ada data pengguna yang ditemukan</p>
                <p className="text-xs">Coba sesuaikan kata kunci pencarian atau filter peran akun.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Nama & Identitas Pengguna</th>
                      <th className="py-3.5 px-4">Peran (Role)</th>
                      <th className="py-3.5 px-4">Status Kata Sandi</th>
                      <th className="py-3.5 px-4 min-w-[240px]">Kata Sandi Aktif (Live Vault)</th>
                      <th className="py-3.5 px-4 text-right">Terakhir Diperbarui</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vaultUsers.map((u) => {
                      const isRevealed = Boolean(revealedPasswords[u.id]);
                      const isCopied = copiedUserId === u.id;

                      const roleBadgeColor =
                        u.role === 'guru'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : u.role === 'wali'
                          ? 'bg-sky-50 text-sky-800 border-sky-200'
                          : u.role === 'admin'
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200';

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Nama & Identitas */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-700 text-xs shrink-0">
                                {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                              </div>
                              <div className="min-w-0">
                                <p className="font-extrabold text-slate-900 text-xs truncate max-w-[200px]">
                                  {u.name}
                                </p>
                                <p className="text-[11px] text-slate-500 font-mono truncate max-w-[200px]">
                                  {u.email || u.kode_guru || u.nis || `ID: ${u.id}`}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${roleBadgeColor}`}
                            >
                              {u.role}
                              {u.admin_type ? ` (${u.admin_type})` : ''}
                            </span>
                          </td>

                          {/* Status Sandi */}
                          <td className="py-3.5 px-4">
                            {u.has_custom_password ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Sandi Kustom</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Sandi Default</span>
                              </span>
                            )}
                          </td>

                          {/* Kata Sandi dengan Masking & Toggle Mata */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div
                                className={`px-3 py-1.5 rounded-xl border font-mono text-xs font-bold transition-all flex items-center gap-2 ${
                                  isRevealed
                                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-950 dark:text-amber-200 shadow-inner'
                                    : 'bg-slate-100 border-slate-200 text-slate-500'
                                }`}
                              >
                                <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className={isRevealed ? 'tracking-wider font-extrabold' : 'tracking-widest'}>
                                  {isRevealed ? u.password_plain : u.password_masked}
                                </span>
                              </div>

                              {/* Toggle Mata (Eye / EyeOff) */}
                              <button
                                type="button"
                                onClick={() => togglePasswordReveal(u.id)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                                title={isRevealed ? 'Sembunyikan Sandi' : 'Lihat Sandi Asli (Khusus IT)'}
                              >
                                {isRevealed ? <EyeOff className="w-4 h-4 text-amber-600" /> : <Eye className="w-4 h-4" />}
                              </button>

                              {/* Salin Sandi */}
                              <button
                                type="button"
                                onClick={() => handleCopyPassword(u.id, u.password_plain)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-[#138F81] text-slate-600 transition cursor-pointer"
                                title="Salin Kata Sandi ke Clipboard"
                              >
                                {isCopied ? (
                                  <Check className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Terakhir Diperbarui */}
                          <td className="py-3.5 px-4 text-right text-slate-500 font-mono text-[11px]">
                            {u.password_changed_at || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {vaultPagination.last_page > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 bg-slate-50/80 border-t border-slate-200">
                <span className="text-xs font-semibold text-slate-500">
                  Menampilkan halaman <strong className="text-slate-800">{vaultPagination.current_page}</strong> dari{' '}
                  <strong className="text-slate-800">{vaultPagination.last_page}</strong> (Total {vaultPagination.total}{' '}
                  pengguna)
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={vaultPagination.current_page <= 1 || vaultLoading}
                    onClick={() => loadVault(vaultPagination.current_page - 1, vaultSearch, vaultRole)}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
                  >
                    Sebelumnya
                  </button>
                  <button
                    type="button"
                    disabled={vaultPagination.current_page >= vaultPagination.last_page || vaultLoading}
                    onClick={() => loadVault(vaultPagination.current_page + 1, vaultSearch, vaultRole)}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB D: KONTAK HELPDESK & WHATSAPP LUPA PASSWORD */}
      {/* ========================================================================= */}
      {activeTab === 'helpdesk' && (
        <div className="space-y-6">
          <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-start gap-3">
                <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700 shrink-0 border border-emerald-200/60">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    Pengaturan Bantuan Lupa Kata Sandi (WhatsApp Helpdesk)
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-100 text-teal-800 border border-teal-200">
                      Smart Dynamic Routing
                    </span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                    Atur nomor WhatsApp dan PIC resmi yang akan dituju saat guru atau wali santri mengeklik tombol "Lupa Password?" di halaman login.
                    Anda dapat mengarahkan ke nomor Admin IT (default) atau mengalihkannya ke Admin Pengurus Pesantren secara cerdas kapan saja.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={loadHelpdeskSettings}
                disabled={loadingHelpdesk}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition cursor-pointer self-start md:self-center"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHelpdesk ? 'animate-spin' : ''}`} />
                <span>Segarkan</span>
              </button>
            </div>

            {/* Form & Live Preview */}
            <form onSubmit={handleSaveHelpdesk} className="pt-5 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Form Input (7 cols) */}
                <div className="lg:col-span-7 space-y-5">
                  {/* 1. Tipe Penanggung Jawab */}
                  <div className="space-y-2">
                    <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      1. Penanggung Jawab Layanan Reset Sandi:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label
                        className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          helpdeskForm.contact_type === 'it_master'
                            ? 'bg-indigo-50/60 border-indigo-300 ring-2 ring-indigo-500/20'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="contact_type"
                          checked={helpdeskForm.contact_type === 'it_master'}
                          onChange={() =>
                            setHelpdeskForm({
                              ...helpdeskForm,
                              contact_type: 'it_master',
                              pic_name: 'Abdullah SyauQillah (Admin IT)',
                              whatsapp_number: '6285731998591',
                            })
                          }
                          className="mt-1 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <p className="text-xs font-black text-slate-800">Admin IT (Master IT)</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Diarahkan ke penanggung jawab teknis sistem IT (Abdullah SyauQillah).
                          </p>
                        </div>
                      </label>

                      <label
                        className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          helpdeskForm.contact_type === 'pengurus'
                            ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-500/20'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="contact_type"
                          checked={helpdeskForm.contact_type === 'pengurus'}
                          onChange={() =>
                            setHelpdeskForm({
                              ...helpdeskForm,
                              contact_type: 'pengurus',
                              pic_name: 'Admin Pengurus Pesantren',
                            })
                          }
                          className="mt-1 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <p className="text-xs font-black text-slate-800">Admin Pengurus Pesantren</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Diarahkan ke kantor sekretariat / pengurus harian pesantren.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* 2. Nomor WhatsApp & Nama PIC */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        2. Nomor WhatsApp Tujuan: <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={helpdeskForm.whatsapp_number}
                          onChange={(e) =>
                            setHelpdeskForm({ ...helpdeskForm, whatsapp_number: e.target.value })
                          }
                          placeholder="6285731998591"
                          required
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:border-[#138F81] focus:ring-1 focus:ring-[#138F81] outline-hidden font-mono"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">Format: 628xxx atau 08xxx (otomatis dinormalisasi).</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        3. Nama PIC / Layanan: <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={helpdeskForm.pic_name}
                        onChange={(e) =>
                          setHelpdeskForm({ ...helpdeskForm, pic_name: e.target.value })
                        }
                        placeholder="Contoh: Abdullah SyauQillah (Admin IT)"
                        required
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:border-[#138F81] focus:ring-1 focus:ring-[#138F81] outline-hidden"
                      />
                      <p className="text-[11px] text-slate-500">Nama yang tampil sebagai penanggung jawab helpdesk.</p>
                    </div>
                  </div>

                  {/* 4. Template Pesan WhatsApp */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        4. Template Pesan WhatsApp:
                      </label>
                      <span className="text-[11px] text-slate-500">
                        Variabel: <code className="bg-slate-100 px-1 py-0.5 rounded font-bold text-teal-700">{`{nama}`}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded font-bold text-teal-700">{`{role}`}</code>
                      </span>
                    </div>
                    <textarea
                      rows={4}
                      value={helpdeskForm.message_template}
                      onChange={(e) =>
                        setHelpdeskForm({ ...helpdeskForm, message_template: e.target.value })
                      }
                      className="w-full p-3 rounded-2xl border border-slate-200 bg-white text-xs font-mono text-slate-800 focus:border-[#138F81] focus:ring-1 focus:ring-[#138F81] outline-hidden leading-relaxed"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-semibold text-slate-500">Sisipkan Tag Cepat:</span>
                      <button
                        type="button"
                        onClick={() =>
                          setHelpdeskForm({
                            ...helpdeskForm,
                            message_template: helpdeskForm.message_template + ' {nama}',
                          })
                        }
                        className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 cursor-pointer"
                      >
                        + {'{nama}'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setHelpdeskForm({
                            ...helpdeskForm,
                            message_template: helpdeskForm.message_template + ' {role}',
                          })
                        }
                        className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 cursor-pointer"
                      >
                        + {'{role}'}
                      </button>
                    </div>
                  </div>

                  {/* 5. Status Aktif Switch */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <div>
                      <p className="text-xs font-extrabold text-slate-800">
                        Status Layanan Bantuan Lupa Sandi
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Aktifkan opsi & link bantuan WhatsApp pada form login portal.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={helpdeskForm.is_active}
                        onChange={(e) =>
                          setHelpdeskForm({ ...helpdeskForm, is_active: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:width-5 after:transition-all peer-checked:bg-[#138F81]"></div>
                    </label>
                  </div>
                </div>

                {/* Live Mockup WhatsApp Preview (5 cols) */}
                <div className="lg:col-span-5 space-y-3">
                  <span className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Live Mockup WhatsApp Pengguna:
                  </span>
                  <div className="rounded-3xl border border-slate-300 bg-[#EFEAE2] p-4 shadow-inner space-y-3 text-xs">
                    <div className="bg-[#075E54] text-white p-3 rounded-2xl flex items-center gap-2.5 shadow-sm">
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-black">
                        PQ
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-xs leading-tight truncate">
                          {helpdeskForm.pic_name || 'Admin Pesantren'}
                        </p>
                        <p className="text-[10px] text-emerald-200">Online • Helpdesk Resmi</p>
                      </div>
                    </div>

                    {/* Chat Bubble */}
                    <div className="bg-white rounded-2xl p-3.5 shadow-xs border border-slate-200 space-y-1.5 max-w-[95%] ml-auto">
                      <p className="text-[11px] font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {helpdeskForm.message_template
                          .replace(/\{nama\}/g, 'Ahmad Fauzi (Santri)')
                          .replace(/\{role\}/g, 'Wali Santri')}
                      </p>
                      <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400">
                        <span>12:00</span>
                        <Check className="w-3 h-3 text-sky-500" />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold leading-relaxed">
                      ℹ️ Preview di atas menyimulasikan pesan WhatsApp yang akan langsung terisi saat pengguna mengklik "Kirim ke WhatsApp" di halaman login.
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={savingHelpdesk}
                  className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] active:scale-95 text-white font-extrabold text-xs shadow-lg shadow-[#138F81]/20 transition disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className={`w-4 h-4 ${savingHelpdesk ? 'animate-spin' : ''}`} />
                  <span>{savingHelpdesk ? 'Menyimpan Konfigurasi...' : 'Simpan Pengaturan Helpdesk'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
