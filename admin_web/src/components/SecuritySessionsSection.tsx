import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe,
  KeyRound,
  Laptop,
  LogOut,
  MapPin,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tablet
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type ActiveSessionItem, type LoginHistoryItem } from '../services/api';

interface SecuritySessionsSectionProps {
  userEmail?: string;
  userName?: string;
}

export function SecuritySessionsSection({ userEmail, userName }: SecuritySessionsSectionProps) {
  const [sessions, setSessions] = useState<ActiveSessionItem[]>([]);
  const [history, setHistory] = useState<LoginHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevoking, setIsRevoking] = useState<number | null>(null);
  const [isLoggingOutOthers, setIsLoggingOutOthers] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form Ganti Password Aman
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
    logout_others: true,
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Confirm dialog state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    action: async () => {},
  });

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadData() {
    setIsLoading(true);
    try {
      const [sessionsRes, historyRes] = await Promise.all([
        api.getActiveSessions(),
        api.getLoginHistory(),
      ]);
      setSessions(Array.isArray(sessionsRes.data) ? sessionsRes.data : []);
      setHistory(Array.isArray(historyRes.data) ? historyRes.data : []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal memuat data keamanan.', 'error');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // Keluarkan satu perangkat spesifik
  async function handleRevokeSession(sessionItem: ActiveSessionItem) {
    setConfirmModal({
      isOpen: true,
      title: 'Keluarkan Perangkat?',
      description: `Apakah Anda yakin ingin mengeluarkan perangkat "${sessionItem.device_name}" (${sessionItem.browser})? Sesi di perangkat tersebut akan langsung ditutup dan harus login ulang.`,
      action: async () => {
        setIsRevoking(sessionItem.id);
        try {
          await api.revokeSession(sessionItem.id);
          showToast(`Perangkat ${sessionItem.device_name} berhasil dikeluarkan.`);
          await loadData();
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Gagal mengeluarkan perangkat.', 'error');
        } finally {
          setIsRevoking(null);
        }
      },
    });
  }

  // Keluarkan semua perangkat lain
  async function handleLogoutOtherDevices() {
    setConfirmModal({
      isOpen: true,
      title: 'Keluarkan dari Semua Perangkat Lain?',
      description: 'Semua perangkat ponsel, laptop, atau komputer lain yang sedang login ke akun Anda akan diputus sesinya seketika. Hanya sesi di browser ini yang akan tetap aktif.',
      action: async () => {
        setIsLoggingOutOthers(true);
        try {
          await api.logoutOtherDevices();
          showToast('Seluruh perangkat lain berhasil dikeluarkan dari akun Anda.');
          await loadData();
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Gagal mengeluarkan perangkat lain.', 'error');
        } finally {
          setIsLoggingOutOthers(false);
        }
      },
    });
  }

  // Ganti Password Berkeamanan Tinggi
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordForm.current_password) {
      showToast('Masukkan kata sandi lama Anda saat ini.', 'error');
      return;
    }
    if (passwordForm.password.length < 6) {
      showToast('Kata sandi baru minimal 6 karakter.', 'error');
      return;
    }
    if (passwordForm.password !== passwordForm.password_confirmation) {
      showToast('Konfirmasi kata sandi baru tidak cocok.', 'error');
      return;
    }

    setIsChangingPassword(true);
    try {
      await api.changePasswordSecure({
        current_password: passwordForm.current_password,
        password: passwordForm.password,
        password_confirmation: passwordForm.password_confirmation,
        logout_others: passwordForm.logout_others,
      });

      setPasswordForm({
        current_password: '',
        password: '',
        password_confirmation: '',
        logout_others: true,
      });

      showToast(
        passwordForm.logout_others
          ? 'Kata sandi berhasil diperbarui dan semua perangkat lain telah otomatis dikeluarkan!'
          : 'Kata sandi berhasil diperbarui!'
      );
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mengganti kata sandi.', 'error');
    } finally {
      setIsChangingPassword(false);
    }
  }

  function getDeviceIcon(type: string) {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-5 h-5 text-teal-600 dark:text-teal-400" />;
      case 'tablet':
        return <Tablet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      default:
        return <Laptop className="w-5 h-5 text-sky-600 dark:text-sky-400" />;
    }
  }

  function formatDateTime(isoStr?: string | null) {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  }

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[99999] flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-2xl border transition-all animate-in fade-in slide-in-from-top-4 duration-300 max-w-sm ${
            toast.type === 'error'
              ? 'border-rose-200 shadow-rose-900/15'
              : 'border-emerald-200 shadow-emerald-900/15'
          }`}
        >
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              toast.type === 'error'
                ? 'bg-rose-100 text-rose-600'
                : 'bg-emerald-100 text-emerald-600'
            }`}
          >
            {toast.type === 'error' ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
          </div>
          <div>
            <p className="text-sm font-black text-slate-800">
              {toast.type === 'error' ? 'Pemberitahuan Keamanan' : 'Operasi Berhasil!'}
            </p>
            <p className="text-xs text-slate-500 font-medium">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {confirmModal.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                {confirmModal.description}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                  await confirmModal.action();
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors shadow-md shadow-rose-600/20 cursor-pointer"
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1: PERANGKAT AKTIF SAAT INI (ACTIVE SESSIONS) */}
      <div className="bg-white dark:bg-slate-800/90 rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-teal-50 dark:bg-teal-950/50 text-[#138F81] flex items-center justify-center border border-teal-100 dark:border-teal-900">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Sesi Perangkat Aktif
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Daftar semua perangkat (smartphone, tablet, atau laptop) yang saat ini memiliki akses login ke akun Anda.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Segarkan
            </button>

            {sessions.filter((s) => !s.is_current).length > 0 && (
              <button
                type="button"
                onClick={() => void handleLogoutOtherDevices()}
                disabled={isLoggingOutOthers}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                {isLoggingOutOthers ? 'Mengeluarkan...' : 'Keluar dari Semua Perangkat Lain'}
              </button>
            )}
          </div>
        </div>

        {/* Daftar Kartu Perangkat */}
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-7 h-7 animate-spin text-teal-600" />
            <p className="text-xs font-bold">Menganalisa dan memuat sesi perangkat aktif...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">
            Tidak ada sesi aktif terdeteksi.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                className={`relative rounded-2xl p-4 sm:p-5 border transition-all flex flex-col justify-between gap-4 ${
                  sess.is_current
                    ? 'bg-gradient-to-b from-teal-50/70 to-white dark:from-teal-950/30 dark:to-slate-800 border-teal-300 dark:border-teal-700 ring-2 ring-teal-500/20 shadow-xs'
                    : 'bg-slate-50/60 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center shrink-0 shadow-xs">
                        {getDeviceIcon(sess.device_type)}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                          {sess.device_name}
                        </h4>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {sess.browser} • {sess.platform}
                        </p>
                      </div>
                    </div>

                    {sess.is_current ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 border border-teal-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                        Perangkat Ini
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        Device Lain
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate font-medium">{sess.location || 'Lokasi tidak terdeteksi'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono text-[11px] text-slate-500">{sess.ip_address}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[11px]">
                        Masuk: {formatDateTime(sess.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {!sess.is_current && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60">
                    <button
                      type="button"
                      onClick={() => void handleRevokeSession(sess)}
                      disabled={isRevoking === sess.id}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 border border-rose-200 dark:border-rose-900/40 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      {isRevoking === sess.id ? 'Memutus sesi...' : 'Keluarkan Perangkat Ini'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: GANTI PASSWORD AMAN & KELUAR DARI PERANGKAT LAIN */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white dark:bg-slate-800/90 rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center border border-amber-200 dark:border-amber-900">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Ganti Kata Sandi & Proteksi Akun
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Jika melihat perangkat asing yang mencurigakan, segera ganti kata sandi dan keluarkan semua perangkat lain.
              </p>
            </div>
          </div>

          <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Kata Sandi Lama Saat Ini
              </label>
              <input
                type="password"
                required
                value={passwordForm.current_password}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, current_password: e.target.value }))
                }
                placeholder="Masukkan kata sandi lama Anda"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Kata Sandi Baru
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={passwordForm.password}
                onChange={(e) => setPasswordForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Minimal 6 karakter"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Ulangi Kata Sandi Baru
              </label>
              <input
                type="password"
                required
                value={passwordForm.password_confirmation}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, password_confirmation: e.target.value }))
                }
                placeholder="Ketik ulang kata sandi baru"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
              />
            </div>

            {/* Checkbox Amankan Sesi */}
            <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3">
              <input
                type="checkbox"
                id="logout_others"
                checked={passwordForm.logout_others}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, logout_others: e.target.checked }))
                }
                className="mt-0.5 rounded border-amber-400 text-[#138F81] focus:ring-teal-500 cursor-pointer"
              />
              <label htmlFor="logout_others" className="text-xs text-amber-900 dark:text-amber-200 cursor-pointer">
                <span className="font-black block">Keluarkan dari Semua Perangkat Lain</span>
                Sangat disarankan: jika akun login di ponsel atau laptop lain yang hilang/dicurigai, perangkat tersebut akan langsung diputus dan wajib memasukkan kata sandi baru.
              </label>
            </div>

            <button
              type="submit"
              disabled={isChangingPassword}
              className="w-full py-3 px-4 rounded-xl bg-[#138F81] hover:bg-teal-700 text-white font-black text-xs sm:text-sm transition-all shadow-md shadow-teal-700/20 cursor-pointer disabled:opacity-60"
            >
              {isChangingPassword ? 'Menyimpan Kata Sandi...' : 'Perbarui Kata Sandi & Amankan Akun'}
            </button>
          </form>
        </div>

        {/* TIPS KEAMANAN AKUN */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 sm:p-7 flex flex-col justify-between shadow-lg space-y-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold">
              <Shield className="w-3.5 h-3.5" />
              Sistem Keamanan Pesantren Qomaruddin
            </div>

            <h3 className="text-xl font-black text-white leading-snug">
              Tips Keamanan Akun Kelas Atas
            </h3>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Sistem absensi dan administrasi pesantren dilengkapi pendeteksi perangkat otomatis. Setiap kali ada perangkat yang login, informasi tipe HP/Laptop, sistem operasi, IP, dan lokasi dicatat demi keamanan data santri dan yayasan.
            </p>

            <div className="space-y-2.5 pt-2">
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <span className="w-5 h-5 rounded-full bg-teal-600/30 text-teal-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                  1
                </span>
                <span>Jangan pernah membagikan kata sandi akun Anda kepada siapapun.</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <span className="w-5 h-5 rounded-full bg-teal-600/30 text-teal-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                  2
                </span>
                <span>
                  Jika login dari komputer umum atau HP pinjaman, selalu klik <strong>Keluar (Logout)</strong> setelah selesai bertugas.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <span className="w-5 h-5 rounded-full bg-teal-600/30 text-teal-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                  3
                </span>
                <span>
                  Bila ada riwayat login dari kota yang asing atau perangkat yang tidak dikenal, segera klik <strong>Keluarkan Perangkat</strong> dan ubah kata sandi akun Anda.
                </span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-400 flex items-center justify-between">
            <span>Status Enkripsi Token:</span>
            <span className="font-mono text-teal-400 font-bold">SHA-256 Validated</span>
          </div>
        </div>
      </div>

      {/* SECTION 3: RIWAYAT LOGIN TERAKHIR (LOGIN HISTORY LOG) */}
      <div className="bg-white dark:bg-slate-800/90 rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 flex items-center justify-center border border-sky-100 dark:border-sky-900">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Riwayat Login Akun Anda
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Catatan aktivitas masuk terbaru yang tercatat oleh sistem keamanan server.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-400 font-bold uppercase tracking-wider">
                <th className="pb-3 pr-4">Perangkat & Browser</th>
                <th className="pb-3 px-4">Alamat IP & Lokasi</th>
                <th className="pb-3 px-4">Waktu Masuk</th>
                <th className="pb-3 pl-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    Belum ada riwayat login tersimpan.
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(item.device_type)}
                        <div>
                          <p className="font-black text-slate-800 dark:text-slate-200">
                            {item.device_name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {item.browser} • {item.platform}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-mono text-slate-700 dark:text-slate-300">
                        {item.ip_address}
                      </p>
                      <p className="text-[11px] text-slate-400">{item.location}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {formatDateTime(item.login_at)}
                    </td>
                    <td className="py-3 pl-4 text-right">
                      {item.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Aktif
                        </span>
                      ) : item.status === 'revoked' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                          Diputus / Revoked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          Keluar Normal
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
