import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Globe,
  Laptop,
  LogOut,
  MapPin,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tablet,
  User,
  Users
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api, type LoginHistoryItem } from '../services/api';

export function AdminSecurityAuditSection() {
  const [logs, setLogs] = useState<LoginHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Force logout action state
  const [selectedUser, setSelectedUser] = useState<{ id: number; name: string } | null>(null);
  const [isForcingLogout, setIsForcingLogout] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadLogs() {
    setIsLoading(true);
    try {
      const res = await api.getAdminAllLogins({
        search: search.trim() || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        device_type: deviceFilter || undefined,
        page,
        per_page: 25,
      });

      const rawMeta = (res as unknown as { meta?: { last_page?: number; total?: number } }).meta;
      setLogs(Array.isArray(res.data) ? res.data : []);
      setTotalPages(Number(rawMeta?.last_page ?? 1));
      setTotalCount(Number(rawMeta?.total ?? (Array.isArray(res.data) ? res.data.length : 0)));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal memuat log audit keamanan.', 'error');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, [page, roleFilter, statusFilter, deviceFilter]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    void loadLogs();
  }

  async function handleConfirmForceLogout() {
    if (!selectedUser) return;
    setIsForcingLogout(true);
    try {
      await api.adminForceLogoutUser(selectedUser.id);
      showToast(`Semua sesi untuk "${selectedUser.name}" berhasil diputus darurat!`);
      setSelectedUser(null);
      await loadLogs();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal memutus sesi pengguna.', 'error');
    } finally {
      setIsForcingLogout(false);
    }
  }

  function getDeviceIcon(type: string) {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
      case 'tablet':
        return <Tablet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      default:
        return <Laptop className="w-4 h-4 text-sky-600 dark:text-sky-400" />;
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

  // Statistik Ringkas
  const activeCount = useMemo(() => logs.filter((l) => l.status === 'active').length, [logs]);
  const mobileCount = useMemo(() => logs.filter((l) => l.device_type === 'mobile').length, [logs]);
  const desktopCount = useMemo(() => logs.filter((l) => l.device_type === 'desktop').length, [logs]);

  return (
    <div className="space-y-6">
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

      {/* MODAL KONFIRMASI FORCE LOGOUT DARURAT */}
      {selectedUser && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-rose-200 dark:border-rose-900 space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center">
              <AlertOctagon className="w-7 h-7" />
            </div>
            <div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200">
                Tindakan Darurat Admin IT
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1.5">
                Putus Sesi (Force Logout) Pengguna?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                Anda akan memutuskan seluruh sesi aktif untuk pengguna <strong>"{selectedUser.name}"</strong> di semua perangkat (HP, Laptop, PC). Pengguna akan seketika terpental keluar dan wajib login ulang.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batalkan
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmForceLogout()}
                disabled={isForcingLogout}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-60"
              >
                {isForcingLogout ? 'Memutus Sesi...' : 'Ya, Putus Sesi Sekarang!'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATS BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700 shadow-xs flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-[#138F81] flex items-center justify-center shrink-0 border border-teal-100">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Audit Log</p>
            <p className="text-xl font-black text-slate-900 dark:text-white">{totalCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700 shadow-xs flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sesi Aktif Di Halaman</p>
            <p className="text-xl font-black text-emerald-600">{activeCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700 shadow-xs flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 flex items-center justify-center shrink-0 border border-teal-100">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Login via Smartphone</p>
            <p className="text-xl font-black text-slate-900 dark:text-white">{mobileCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700 shadow-xs flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100">
            <Laptop className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Login via Laptop/PC</p>
            <p className="text-xl font-black text-slate-900 dark:text-white">{desktopCount}</p>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH CARD */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#138F81]" />
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Pusat Audit Keamanan Login Pesantren
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 border border-teal-200">
              Live Real-Time
            </span>
          </div>

          <button
            type="button"
            onClick={() => void loadLogs()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#138F81] text-white hover:bg-teal-700 transition-all cursor-pointer self-start sm:self-auto shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Segarkan Log
          </button>
        </div>

        <form onSubmit={handleSearchSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari user, IP, atau device..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <div>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="">Semua Hak Akses (Role)</option>
              <option value="admin">Admin / Pengurus / IT</option>
              <option value="guru">Guru (Madin/Sholat/Ngaji)</option>
              <option value="wali">Wali Santri</option>
              <option value="keamanan">Pengurus Keamanan</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="">Semua Status Sesi</option>
              <option value="active">Sesi Masih Aktif</option>
              <option value="revoked">Sesi Dicabut (Revoked)</option>
              <option value="logged_out">Logout Normal</option>
            </select>
          </div>

          <div>
            <select
              value={deviceFilter}
              onChange={(e) => {
                setDeviceFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="">Semua Tipe Perangkat</option>
              <option value="mobile">Smartphone / HP</option>
              <option value="desktop">Laptop / Komputer PC</option>
              <option value="tablet">Tablet</option>
            </select>
          </div>
        </form>
      </div>

      {/* TABEL LIVE AUDIT LOG */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-700 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">Pengguna</th>
                <th className="py-3.5 px-4">Perangkat & OS</th>
                <th className="py-3.5 px-4">IP Address & Lokasi</th>
                <th className="py-3.5 px-4">Waktu Masuk</th>
                <th className="py-3.5 px-4">Status Sesi</th>
                <th className="py-3.5 px-4 text-right">Tindakan Admin IT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-teal-600" />
                      <p className="text-xs font-bold">Menganalisa data sesi dan jejak login...</p>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Tidak ada catatan audit yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                logs.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                    {/* PENGGUNA */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-teal-50 dark:bg-teal-950/50 text-[#138F81] flex items-center justify-center font-black text-xs shrink-0 border border-teal-100">
                          {item.user_name ? item.user_name.charAt(0).toUpperCase() : <User size={14} />}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 dark:text-white leading-tight">
                            {item.user_name || 'Tanpa Nama'}
                          </p>
                          <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 mt-0.5">
                            {item.role || 'user'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* PERANGKAT & OS */}
                    <td className="py-3 px-4">
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

                    {/* IP & LOKASI */}
                    <td className="py-3 px-4">
                      <p className="font-mono text-slate-700 dark:text-slate-300 font-bold">
                        {item.ip_address}
                      </p>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                        <MapPin size={11} className="shrink-0" />
                        <span className="truncate max-w-[150px]">{item.location}</span>
                      </div>
                    </td>

                    {/* WAKTU MASUK */}
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1 text-[11px]">
                        <Clock size={11} className="shrink-0" />
                        <span>{formatDateTime(item.login_at)}</span>
                      </div>
                    </td>

                    {/* STATUS */}
                    <td className="py-3 px-4">
                      {item.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Online / Aktif
                        </span>
                      ) : item.status === 'revoked' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300">
                          Diputus / Revoked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          Keluar Normal
                        </span>
                      )}
                    </td>

                    {/* TINDAKAN */}
                    <td className="py-3 px-4 text-right">
                      {item.user_id && item.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedUser({
                              id: item.user_id!,
                              name: item.user_name || 'Pengguna',
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-black bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 transition-colors cursor-pointer"
                        >
                          <LogOut size={12} />
                          Putus Sesi
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Halaman {page} dari {totalPages} ({totalCount} log tercatat)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold disabled:opacity-40 cursor-pointer"
              >
                Sebelumnya
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold disabled:opacity-40 cursor-pointer"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
