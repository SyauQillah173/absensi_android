import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit3,
  Lock,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Shield,
  Sliders,
  Sparkles,
  Trash2,
  Unlock,
  Users,
  X,
  Zap
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  api,
  type ItAttendanceSettingsResponse,
  type ItGlobalAttendanceConfig,
  type ItGuruAttendanceOverride,
  type ItNotificationSettingsResponse
} from '../services/api';

export function ItSystemMasterControlSection() {
  const [activeTab, setActiveTab] = useState<'attendance' | 'notifications'>('attendance');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

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

  // Initial Load
  useEffect(() => {
    setLoading(true);
    Promise.all([loadAttendanceSettings(), loadNotificationSettings()]).finally(() => {
      setLoading(false);
    });
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setMessage(null);
    try {
      if (activeTab === 'attendance') {
        await loadAttendanceSettings();
      } else {
        await loadNotificationSettings();
      }
      setMessage({ text: 'Data master kontrol IT berhasil disegarkan.', type: 'info' });
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
        setMessage({ text: 'Konfigurasi default presensi guru berhasil diperbarui!', type: 'success' });
        await loadAttendanceSettings();
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menyimpan pengaturan global.', type: 'error' });
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
      alert('Silakan pilih guru terlebih dahulu.');
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

      setMessage({
        text: `Aturan khusus untuk guru berhasil ${editingOverride ? 'diperbarui' : 'ditambahkan'}!`,
        type: 'success',
      });
      setIsFormActive(false);
      await loadAttendanceSettings();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menyimpan aturan override.', type: 'error' });
    } finally {
      setSavingOverride(false);
    }
  };

  // Hapus Override
  const handleDeleteOverride = async (id: number, teacherName: string) => {
    if (!confirm(`Hapus aturan khusus presensi untuk guru "${teacherName}"?`)) return;
    try {
      await api.deleteItGuruOverride(id);
      setMessage({ text: 'Aturan khusus berhasil dihapus.', type: 'info' });
      await loadAttendanceSettings();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menghapus aturan.', type: 'error' });
    }
  };

  // Toggle Force Open / Force Locked Cepat
  const handleToggleForce = async (id: number, type: 'force_open' | 'force_locked') => {
    try {
      await api.toggleItForceStatus(id, type);
      await loadAttendanceSettings();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status kontrol darurat.');
    }
  };

  // Simpan Notifikasi SPP Wali
  const handleSaveWaliNotification = async () => {
    if (!notificationData) return;
    setSavingNotification('wali');
    setMessage(null);
    try {
      await api.saveItNotificationSettings('wali_billing', notificationData.wali_billing);
      setMessage({ text: 'Pengaturan otomatisasi notifikasi SPP wali berhasil disimpan!', type: 'success' });
      await loadNotificationSettings();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menyimpan konfigurasi notifikasi SPP.', type: 'error' });
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
      setMessage({ text: 'Pengaturan peringatan presensi guru berhasil disimpan!', type: 'success' });
      await loadNotificationSettings();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menyimpan konfigurasi peringatan guru.', type: 'error' });
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
      setMessage({
        text: res.message || 'Notifikasi pengingat SPP berhasil dikirimkan ke wali santri yang belum lunas.',
        type: 'success',
      });
      await loadNotificationSettings();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal mengirimkan notifikasi pengingat SPP.', type: 'error' });
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
      setMessage({
        text: res.message || 'Peringatan presensi terkirim ke guru yang jadwalnya belum lengkap hari ini.',
        type: 'success',
      });
      await loadNotificationSettings();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal mengirimkan peringatan presensi guru.', type: 'error' });
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
                      {t.name} ({t.username || t.email || `ID: ${t.id}`})
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
                        {j.hari} {j.jam_mulai?.substring(0, 5)} - {j.mapel?.name || 'Mapel'} ({j.kelas?.name || 'Kelas'})
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

      {/* Sub-Navigation Tabs Responsif (Grid 1 col on mobile, 2 col on tablet/desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'attendance'
              ? 'bg-white text-[#138F81] shadow-sm ring-1 ring-slate-200 font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 rounded-lg shrink-0 ${activeTab === 'attendance' ? 'bg-teal-50 text-[#138F81]' : 'bg-slate-200/60 text-slate-500'}`}>
              <Clock className="w-4 h-4" />
            </div>
            <span className="truncate">Kontrol Jam Presensi Guru</span>
          </div>
          {attendanceData?.overrides?.length ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 shrink-0">
              {attendanceData.overrides.length} Override
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'notifications'
              ? 'bg-white text-[#138F81] shadow-sm ring-1 ring-slate-200 font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 rounded-lg shrink-0 ${activeTab === 'notifications' ? 'bg-amber-50 text-amber-600' : 'bg-slate-200/60 text-slate-500'}`}>
              <Bell className="w-4 h-4" />
            </div>
            <span className="truncate">Smart Notification Engine</span>
          </div>
          {notificationData?.stats?.unpaid_students_count ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 shrink-0">
              {notificationData.stats.unpaid_students_count} Penunggak
            </span>
          ) : null}
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
                                    Jadwal: {item.jadwal.mapel?.name || 'Mapel'} ({item.jadwal.kelas?.name || 'Kelas'}) &bull; {item.jadwal.hari} {item.jadwal.jam_mulai}
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
                                ? `${item.jadwal.mapel?.name || 'Mapel'} (${item.jadwal.kelas?.name || 'Kelas'}) • ${item.jadwal.hari} ${item.jadwal.jam_mulai}`
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
    </div>
  );
}
