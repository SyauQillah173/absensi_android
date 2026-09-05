import {
  Award,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit2,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  Filter,
  GraduationCap,
  HelpCircle,
  Home,
  KeyRound,
  Layers,
  MessageCircle,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api, type ApiRecord } from '../services/api';
import { exportRowsExcel } from '../utils/importTemplates';

interface PmbAdminPageProps {
  initialTab?: string;
  onTabChange?: (tab: string) => void;
}

interface PmbDashboardData {
  total: number;
  today: number;
  pending: number;
  reviewed: number;
  accepted: number;
  rejected: number;
  putra: number;
  putri: number;
  jenjang_stats: Array<{ pilihan_jenjang: string; total: number }>;
  latest: any[];
}

interface RegistrationItem {
  id: number;
  registration_number: string;
  nama_lengkap: string;
  nama_panggilan: string | null;
  jenis_kelamin: 'L' | 'P';
  nik: string | null;
  nisn: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  alamat_lengkap: string | null;
  provinsi: string | null;
  kota: string | null;
  kecamatan: string | null;
  asal_sekolah: string | null;
  pilihan_jenjang: string;
  pilihan_asrama: string;
  nama_ayah: string | null;
  pekerjaan_ayah: string | null;
  nama_ibu: string | null;
  pekerjaan_ibu: string | null;
  nama_wali: string | null;
  no_whatsapp_wali: string;
  catatan_khusus: string | null;
  dokumen_foto: string | null;
  dokumen_kk: string | null;
  status: 'pending' | 'reviewed' | 'accepted' | 'rejected';
  catatan_admin: string | null;
  is_converted: boolean;
  siswa_id: number | null;
  created_at: string;
  user_id?: number | null;
  account_username?: string | null;
  account_initial_password?: string | null;
  wa_notif_sent?: boolean;
  wa_notif_at?: string | null;
  batch?: {
    id: number;
    nama_gelombang: string;
  };
  siswa?: {
    id: number;
    nis: string;
    nama: string;
  };
}

interface BatchItem {
  id: number;
  nama_gelombang: string;
  tahun_akademik: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  biaya_pendaftaran: number;
  kuota: number | null;
  is_active: boolean;
  keterangan: string | null;
  registrations_count?: number;
}

export function PmbAdminPage({ initialTab = 'dashboard', onTabChange }: PmbAdminPageProps) {
  const [activeTab, setActiveTab] = useState(initialTab);

  // Data states
  const [dashboard, setDashboard] = useState<PmbDashboardData | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [classesList, setClassesList] = useState<Array<{ id: number; name: string }>>([]);
  const [roomsList, setRoomsList] = useState<Array<{ id: number; name: string }>>([]);

  // Pagination & filter
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(15);
  const [totalItems, setTotalItems] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Loading indicators
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);

  // Detail Modal state
  const [detailItem, setDetailItem] = useState<RegistrationItem | null>(null);

  // Convert to Siswa Modal state
  const [convertModalItem, setConvertModalItem] = useState<RegistrationItem | null>(null);
  const [convertForm, setConvertForm] = useState({
    class_id: '',
    boarding_room_id: '',
    nis: '',
    create_wali_user: true
  });
  const [isConverting, setIsConverting] = useState(false);
  const [convertResult, setConvertResult] = useState<any | null>(null);

  // Change Status Modal state
  const [statusModalItem, setStatusModalItem] = useState<RegistrationItem | null>(null);
  const [newStatus, setNewStatus] = useState<'pending' | 'reviewed' | 'accepted' | 'rejected'>('reviewed');
  const [statusAdminNote, setStatusAdminNote] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Batch Form Modal state
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<BatchItem | null>(null);
  const [batchForm, setBatchForm] = useState({
    nama_gelombang: '',
    tahun_akademik: '2026/2027',
    tanggal_mulai: '',
    tanggal_selesai: '',
    biaya_pendaftaran: 150000,
    kuota: 200,
    is_active: true,
    keterangan: ''
  });

  // Resend WhatsApp state
  const [resendingWaId, setResendingWaId] = useState<number | null>(null);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);

  const handleCopyPmbLink = () => {
    const url = `${window.location.origin}/?pmb=1`;
    navigator.clipboard.writeText(url);
    setHasCopiedLink(true);
    setTimeout(() => setHasCopiedLink(false), 3000);
  };

  const handleResendWa = async (item: RegistrationItem) => {
    setResendingWaId(item.id);
    try {
      const res = await api.post(`/pmb/admin/registrations/${item.id}/resend-wa`, {});
      showToast((res as any)?.message || `Notifikasi WhatsApp berhasil dikirim ke nomor ${item.no_whatsapp_wali}`);
      loadRegistrations();
      if (detailItem && detailItem.id === item.id) {
        setDetailItem(prev => prev ? { ...prev, wa_notif_sent: true } : null);
      }
    } catch (e: any) {
      showToast(e?.message || 'Gagal mengirim ulang notifikasi WhatsApp', 'error');
    } finally {
      setResendingWaId(null);
    }
  };

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    onTabChange?.(activeTab);
  }, [activeTab, onTabChange]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboard();
    } else if (activeTab === 'applicants') {
      loadRegistrations();
      loadReferenceOptions();
    } else if (activeTab === 'batches') {
      loadBatches();
    }
  }, [activeTab, currentPage, statusFilter, genderFilter, batchFilter]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadDashboard = async () => {
    setIsLoadingDashboard(true);
    try {
      const res = await api.get<PmbDashboardData>('/pmb/admin/dashboard');
      if (res && res.data) {
        setDashboard(res.data);
      }
    } catch (e: any) {
      showToast(e?.message || 'Gagal memuat dashboard PMB', 'error');
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  const loadRegistrations = async () => {
    setIsLoadingList(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        per_page: String(perPage),
        status: statusFilter,
        jenis_kelamin: genderFilter,
        pmb_batch_id: batchFilter,
        search: searchQuery
      });

      const res = await api.get<{ data: RegistrationItem[]; total: number }>(`/pmb/admin/registrations?${params.toString()}`);
      if (res && res.data) {
        setRegistrations(res.data.data || []);
        setTotalItems(res.data.total || 0);
      }
    } catch (e: any) {
      showToast(e?.message || 'Gagal memuat daftar pendaftar PMB', 'error');
    } finally {
      setIsLoadingList(false);
    }
  };

  const loadBatches = async () => {
    setIsLoadingBatches(true);
    try {
      const res = await api.get<BatchItem[]>('/pmb/admin/batches');
      if (res && res.data) {
        setBatches(res.data);
      }
    } catch (e: any) {
      showToast(e?.message || 'Gagal memuat gelombang PMB', 'error');
    } finally {
      setIsLoadingBatches(false);
    }
  };

  const loadReferenceOptions = async () => {
    try {
      const resClasses = await api.get<any[]>('/classes');
      if (resClasses && resClasses.data) {
        setClassesList(resClasses.data.map(c => ({ id: c.id, name: c.name || c.nama_kelas })));
      }
      const resRooms = await api.get<any[]>('/boarding-rooms');
      if (resRooms && resRooms.data) {
        setRoomsList(resRooms.data.map(r => ({ id: r.id, name: r.name || r.nama_kamar })));
      }
    } catch (e) {
      console.warn('Gagal memuat opsi kelas/kamar:', e);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadRegistrations();
  };

  const handleOpenStatusModal = (item: RegistrationItem) => {
    setStatusModalItem(item);
    setNewStatus(item.status);
    setStatusAdminNote(item.catatan_admin || '');
  };

  const handleSaveStatus = async () => {
    if (!statusModalItem) return;
    setIsUpdatingStatus(true);
    try {
      await api.patch(`/pmb/admin/registrations/${statusModalItem.id}/status`, {
        status: newStatus,
        catatan_admin: statusAdminNote
      });
      showToast('Status seleksi calon santri berhasil diperbarui.');
      setStatusModalItem(null);
      loadRegistrations();
      if (activeTab === 'dashboard') loadDashboard();
    } catch (e: any) {
      showToast(e?.message || 'Gagal memperbarui status', 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleOpenConvertModal = (item: RegistrationItem) => {
    setConvertModalItem(item);
    setConvertResult(null);
    setConvertForm({
      class_id: '',
      boarding_room_id: '',
      nis: '',
      create_wali_user: true
    });
  };

  const handleExecuteConvert = async () => {
    if (!convertModalItem) return;
    setIsConverting(true);
    try {
      const res = await api.post<any>(
        `/pmb/admin/registrations/${convertModalItem.id}/convert-to-siswa`,
        convertForm
      );
      if (res) {
        setConvertResult(res.data);
        showToast(res.message || 'Santri berhasil di-ACC dan dikonversi resmi!');
        loadRegistrations();
        if (activeTab === 'dashboard') loadDashboard();
      }
    } catch (e: any) {
      showToast(e?.message || 'Gagal mengonversi calon santri', 'error');
    } finally {
      setIsConverting(false);
    }
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBatch) {
        await api.put(`/pmb/admin/batches/${editingBatch.id}`, batchForm);
        showToast('Gelombang PMB berhasil diperbarui.');
      } else {
        await api.post('/pmb/admin/batches', batchForm);
        showToast('Gelombang PMB baru berhasil dibuat.');
      }
      setBatchModalOpen(false);
      setEditingBatch(null);
      loadBatches();
    } catch (e: any) {
      showToast(e?.message || 'Gagal menyimpan gelombang PMB', 'error');
    }
  };

  const handleDeleteBatch = async (id: number) => {
    if (!confirm('Yakin ingin menghapus gelombang PMB ini?')) return;
    try {
      await api.delete(`/pmb/admin/batches/${id}`);
      showToast('Gelombang PMB berhasil dihapus.');
      loadBatches();
    } catch (e: any) {
      showToast(e?.message || 'Gagal menghapus gelombang PMB', 'error');
    }
  };

  const handleExportExcel = async () => {
    if (registrations.length === 0) {
      showToast('Tidak ada data untuk diexport', 'error');
      return;
    }

    const rows = registrations.map((r, idx) => ({
      No: idx + 1,
      'No. Registrasi': r.registration_number,
      'Nama Calon Santri': r.nama_lengkap,
      'Jenis Kelamin': r.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan',
      NIK: r.nik || '-',
      NISN: r.nisn || '-',
      'Tempat Lahir': r.tempat_lahir || '-',
      'Tanggal Lahir': r.tanggal_lahir || '-',
      'Kota Asal': r.kota || '-',
      'Asal Sekolah': r.asal_sekolah || '-',
      'Pilihan Jenjang': r.pilihan_jenjang,
      'Pilihan Asrama': r.pilihan_asrama,
      'Nama Orang Tua / Wali': r.nama_wali || r.nama_ayah || '-',
      'No. WhatsApp Wali': r.no_whatsapp_wali,
      Status: r.status.toUpperCase(),
      'Telah Dikonversi': r.is_converted ? 'YA (NIS: ' + (r.siswa?.nis || '-') + ')' : 'BELUM',
      'Tanggal Daftar': r.created_at,
    }));

    await exportRowsExcel(rows, `Data_PMB_Qomaruddin_${new Date().toISOString().slice(0, 10)}.xlsx`, 'Data Pendaftar PMB');
    showToast('Data pendaftar berhasil diexport ke Excel!');
  };

  return (
    <div className="space-y-6">
      {/* 🌟 TOAST NOTIFICATION */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl text-xs font-black shadow-xl flex items-center gap-2 animate-in fade-in duration-300 ${
            toast.type === 'success'
              ? 'bg-[#138F81] text-white shadow-[#138F81]/30'
              : 'bg-rose-600 text-white shadow-rose-600/30'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-[#FFDC80]" /> : <X className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 🌟 HEADER PMB ADMIN (CARD PUTIH BERSIH SESUAI STANDAR ADMIN LAYOUT KITA) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-[#FFDC80] text-[#0D7A6F] border border-amber-300 flex items-center justify-center shadow-xs">
            <UserPlus className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-[#2D3436] tracking-tight">
                Penerimaan Santri Baru (PMB)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#FFDC80] text-[#0D7A6F] border border-amber-300">
                TA 2026/2027
              </span>
            </div>
            <p className="text-xs text-[#636E72] font-medium mt-0.5">
              Portal Verifikasi, Seleksi Berkas, & 1-Klik ACC Santri Resmi Pondok Pesantren Qomaruddin
            </p>
          </div>
        </div>

        {/* Action Buttons: Salin Link & Lihat Web Publik */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyPmbLink}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-amber-50 text-[#0D7A6F] text-xs font-bold border border-amber-300 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="Salin link pendaftaran online untuk dibagikan ke WhatsApp / Media Sosial"
          >
            {hasCopiedLink ? <Check className="w-3.5 h-3.5 text-[#138F81]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{hasCopiedLink ? 'Link Tersalin!' : 'Salin Link PMB'}</span>
          </button>

          <button
            onClick={() => window.open('/?pmb=1', '_blank')}
            className="px-4 py-2 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-sm shadow-[#138F81]/25 cursor-pointer"
            title="Buka tampilan formulir publik untuk calon santri"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#FFDC80]" />
            <span>Lihat Web PMB Publik</span>
          </button>
        </div>
      </div>

      {/* 🌟 NAVIGATION SUB-TABS (KONSISTEN DENGAN TEMA APP KITA) */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-[#138F81] text-white shadow-xs'
              : 'text-[#636E72] hover:bg-slate-100'
          }`}
        >
          <Award className="w-3.5 h-3.5 text-[#FFDC80]" />
          <span>Dashboard PMB</span>
        </button>

        <button
          onClick={() => setActiveTab('applicants')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'applicants'
              ? 'bg-[#138F81] text-white shadow-xs'
              : 'text-[#636E72] hover:bg-slate-100'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-[#FFDC80]" />
          <span>Data Calon Santri</span>
          {dashboard && dashboard.pending > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
              {dashboard.pending}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('batches')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'batches'
              ? 'bg-[#138F81] text-white shadow-xs'
              : 'text-[#636E72] hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-[#FFDC80]" />
          <span>Gelombang Pendaftaran</span>
        </button>
      </div>

      {/* 🌟 TAB 1: DASHBOARD METRICS */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Top 4 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-xs text-[#636E72] font-bold mb-1">
                <span>Total Pendaftar</span>
                <Users className="w-4 h-4 text-[#138F81]" />
              </div>
              <div className="text-3xl font-black text-[#2D3436]">{dashboard?.total ?? 0}</div>
              <div className="text-[11px] text-[#0D7A6F] font-bold mt-1">
                +{dashboard?.today ?? 0} calon santri baru hari ini
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-amber-200 shadow-sm">
              <div className="flex items-center justify-between text-xs text-[#D97706] font-bold mb-1">
                <span>Menunggu Verifikasi</span>
                <HelpCircle className="w-4 h-4 text-[#D97706]" />
              </div>
              <div className="text-3xl font-black text-[#D97706]">{dashboard?.pending ?? 0}</div>
              <div className="text-[11px] text-amber-700 font-semibold mt-1">Perlu ditinjau panitia PMB</div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-emerald-200 shadow-sm">
              <div className="flex items-center justify-between text-xs text-emerald-700 font-bold mb-1">
                <span>Diterima / Lolos ACC</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-3xl font-black text-[#138F81]">{dashboard?.accepted ?? 0}</div>
              <div className="text-[11px] text-emerald-800 font-semibold mt-1">Resmi bergabung di pondok</div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-rose-200 shadow-sm">
              <div className="flex items-center justify-between text-xs text-rose-600 font-bold mb-1">
                <span>Perlu Perbaikan / Ditolak</span>
                <X className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-3xl font-black text-rose-600">{dashboard?.rejected ?? 0}</div>
              <div className="text-[11px] text-rose-700 font-semibold mt-1">Berkas kurang lengkap / belum lolos</div>
            </div>
          </div>

          {/* Gender & Program Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-[#2D3436] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#138F81]" />
                <span>Proporsi Calon Santri Putra & Putri</span>
              </h3>

              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-blue-700">👦 Santri Putra: {dashboard?.putra ?? 0}</span>
                    <span className="text-[#2D3436]">
                      {dashboard?.total
                        ? Math.round(((dashboard?.putra ?? 0) / dashboard.total) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${dashboard?.total ? ((dashboard.putra ?? 0) / dashboard.total) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-pink-600">👧 Santri Putri: {dashboard?.putri ?? 0}</span>
                    <span className="text-[#2D3436]">
                      {dashboard?.total
                        ? Math.round(((dashboard?.putri ?? 0) / dashboard.total) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-pink-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${dashboard?.total ? ((dashboard.putri ?? 0) / dashboard.total) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 text-xs text-[#636E72] font-medium">
                💡 <strong className="text-[#2D3436]">Catatan Panitia:</strong> Asrama putra dan putri memiliki kapasitas terpisah. Pastikan kamar asrama sesuai dengan jenis kelamin calon santri saat proses ACC.
              </div>
            </div>

            <div className="lg:col-span-7 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-[#2D3436] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#D97706]" />
                <span>Peminatan Program Pendidikan</span>
              </h3>

              <div className="space-y-2.5">
                {dashboard?.jenjang_stats && dashboard.jenjang_stats.length > 0 ? (
                  dashboard.jenjang_stats.map((j, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-[#2D3436]">{j.pilihan_jenjang}</span>
                      <span className="font-black px-2.5 py-1 rounded-lg bg-[#FFDC80] text-[#0D7A6F] border border-amber-300">
                        {j.total} Santri
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-[#636E72] text-center py-6">Belum ada data pendaftar.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 TAB 2: APPLICANTS DATA TABLE */}
      {activeTab === 'applicants' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama santri, no registrasi, WA, kota..."
                  className="w-full px-4 py-2 pl-9 rounded-xl bg-[#F8FAFC] border border-slate-200 focus:bg-white focus:border-[#138F81] text-xs text-[#2D3436] outline-none"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </form>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs text-[#2D3436] font-medium outline-none"
              >
                <option value="all">Semua Status</option>
                <option value="pending">Menunggu Review</option>
                <option value="reviewed">Sedang Ditinjau</option>
                <option value="accepted">Diterima / Lolos</option>
                <option value="rejected">Ditolak / Perbaikan</option>
              </select>

              <select
                value={genderFilter}
                onChange={(e) => { setGenderFilter(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs text-[#2D3436] font-medium outline-none"
              >
                <option value="all">Semua Gender</option>
                <option value="L">Putra (L)</option>
                <option value="P">Putri (P)</option>
              </select>

              <button
                onClick={loadRegistrations}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#2D3436] transition-colors cursor-pointer"
                title="Refresh Data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={handleExportExcel}
                className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-3xl bg-white border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#636E72] font-black uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3.5">No. Reg</th>
                    <th className="px-4 py-3.5">Nama Santri</th>
                    <th className="px-4 py-3.5">Gender</th>
                    <th className="px-4 py-3.5">Asal Kota & Sekolah</th>
                    <th className="px-4 py-3.5">Program & Asrama</th>
                    <th className="px-4 py-3.5">No. WA Wali</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[#2D3436]">
                  {isLoadingList ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <div className="w-8 h-8 rounded-full border-2 border-[#138F81]/20 border-t-[#138F81] animate-spin mx-auto mb-2" />
                        <span>Memuat data pendaftar...</span>
                      </td>
                    </tr>
                  ) : registrations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        Tidak ada data pendaftar yang sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    registrations.map((item) => {
                      const isL = item.jenis_kelamin === 'L';
                      const isConverted = item.is_converted;

                      return (
                        <tr key={item.id} className="hover:bg-amber-50/50 transition-colors">
                          <td className="px-4 py-3.5 font-mono font-black text-[#138F81] whitespace-nowrap">
                            {item.registration_number}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="font-bold text-[#2D3436]">{item.nama_lengkap}</div>
                            {item.nama_panggilan && (
                              <div className="text-[10px] text-[#636E72]">({item.nama_panggilan})</div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                isL ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                              }`}
                            >
                              {isL ? 'Putra' : 'Putri'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="font-bold text-[#2D3436]">{item.kota || '-'}</div>
                            <div className="text-[10px] text-[#636E72]">{item.asal_sekolah || '-'}</div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="text-[#2D3436] font-medium">{item.pilihan_jenjang}</div>
                            <div className="text-[10px] text-[#0D7A6F] font-bold">{item.pilihan_asrama}</div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap font-mono font-bold text-[#0D7A6F]">
                            {item.no_whatsapp_wali}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {isConverted ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-[#138F81] text-white flex items-center gap-1 w-fit">
                                <CheckCircle2 className="w-3 h-3 text-[#FFDC80]" />
                                <span>Santri Resmi</span>
                              </span>
                            ) : (
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                                  item.status === 'accepted'
                                    ? 'bg-[#138F81] text-white'
                                    : item.status === 'rejected'
                                    ? 'bg-rose-100 text-rose-800'
                                    : item.status === 'reviewed'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {item.status === 'accepted'
                                  ? 'Diterima'
                                  : item.status === 'rejected'
                                  ? 'Perlu Perbaikan'
                                  : item.status === 'reviewed'
                                  ? 'Ditinjau'
                                  : 'Menunggu'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Tombol Detail */}
                              <button
                                onClick={() => setDetailItem(item)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#2D3436] transition-colors cursor-pointer"
                                title="Lihat Detail & Berkas"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Tombol Kirim Ulang WA */}
                              <button
                                onClick={() => handleResendWa(item)}
                                disabled={resendingWaId === item.id}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  item.wa_notif_sent
                                    ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                                    : 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                                }`}
                                title={item.wa_notif_sent ? 'Kirim Ulang Notifikasi WA Akun & Pendaftaran' : 'Kirim Notifikasi WA Akun & Pendaftaran'}
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </button>

                              {/* Tombol Ubah Status */}
                              <button
                                onClick={() => handleOpenStatusModal(item)}
                                className="p-1.5 rounded-lg bg-[#FFDC80] hover:bg-[#ffe59e] text-[#0D7A6F] transition-colors cursor-pointer"
                                title="Ubah Status Seleksi / Catatan"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Tombol ACC & Konversi ke Siswa */}
                              {!isConverted && (
                                <button
                                  onClick={() => handleOpenConvertModal(item)}
                                  className="px-2.5 py-1 rounded-lg bg-[#138F81] hover:bg-[#0D7A6F] text-white font-black text-[11px] flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                                  title="ACC dan Konversi Menjadi Santri Resmi Pondok"
                                >
                                  <UserCheck className="w-3.5 h-3.5 text-[#FFDC80]" />
                                  <span>ACC Santri</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalItems > perPage && (
              <div className="px-4 py-3 bg-[#F8FAFC] border-t border-slate-200 flex items-center justify-between text-xs text-[#636E72]">
                <span>
                  Menampilkan {(currentPage - 1) * perPage + 1} s/d {Math.min(currentPage * perPage, totalItems)} dari {totalItems} pendaftar
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-bold text-[#2D3436]">{currentPage}</span>
                  <button
                    disabled={currentPage * perPage >= totalItems}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🌟 TAB 3: GELOMBANG PMB */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-black text-[#2D3436]">Daftar Gelombang Pendaftaran PMB</h3>
              <p className="text-xs text-[#636E72]">Kelola periode tanggal buka, kuota, dan tarif biaya formulir.</p>
            </div>
            <button
              onClick={() => {
                setEditingBatch(null);
                setBatchForm({
                  nama_gelombang: 'Gelombang 2 - TA 2026/2027',
                  tahun_akademik: '2026/2027',
                  tanggal_mulai: new Date().toISOString().slice(0, 10),
                  tanggal_selesai: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
                  biaya_pendaftaran: 150000,
                  kuota: 300,
                  is_active: true,
                  keterangan: '',
                });
                setBatchModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#FFDC80]" />
              <span>Buka Gelombang Baru</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoadingBatches ? (
              <div className="col-span-full py-12 text-center text-slate-400">Memuat gelombang PMB...</div>
            ) : batches.map((b) => (
              <div
                key={b.id}
                className={`p-6 rounded-3xl border-2 transition-all ${
                  b.is_active
                    ? 'bg-white border-amber-300 shadow-sm'
                    : 'bg-white border-slate-200 opacity-70'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                      b.is_active ? 'bg-[#FFDC80] text-[#0D7A6F] border border-amber-300' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {b.is_active ? '● SEDANG AKTIF' : 'NONAKTIF'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingBatch(b);
                        setBatchForm({
                          nama_gelombang: b.nama_gelombang,
                          tahun_akademik: b.tahun_akademik,
                          tanggal_mulai: b.tanggal_mulai,
                          tanggal_selesai: b.tanggal_selesai,
                          biaya_pendaftaran: b.biaya_pendaftaran,
                          kuota: b.kuota || 300,
                          is_active: b.is_active,
                          keterangan: b.keterangan || '',
                        });
                        setBatchModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#2D3436] transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteBatch(b.id)}
                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h4 className="text-base font-black text-[#2D3436]">{b.nama_gelombang}</h4>
                <p className="text-xs text-[#0D7A6F] font-bold mb-4">Tahun Akademik {b.tahun_akademik}</p>

                <div className="space-y-1.5 text-xs text-[#636E72] border-t border-slate-100 pt-3">
                  <div className="flex justify-between">
                    <span>Periode:</span>
                    <span className="text-[#2D3436] font-bold">{b.tanggal_mulai} s/d {b.tanggal_selesai}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Biaya Formulir:</span>
                    <span className="text-[#D97706] font-black">Rp {Number(b.biaya_pendaftaran).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pendaftar Masuk:</span>
                    <span className="text-[#138F81] font-black">{b.registrations_count ?? 0} / {b.kuota ?? '∞'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🌟 MODAL DETAIL & REVIEW BERKAS */}
      {detailItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-[#2D3436] border-2 border-amber-300 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setDetailItem(null)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-2xl bg-[#FFDC80] text-[#0D7A6F] border border-amber-300 flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-mono font-black text-[#138F81]">
                  {detailItem.registration_number}
                </span>
                <h3 className="text-lg font-black text-[#2D3436]">{detailItem.nama_lengkap}</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-6">
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-2">
                <div className="font-black text-[#138F81] border-b border-slate-200 pb-1">Biodata Santri</div>
                <div><span className="text-slate-500">Gender:</span> <strong className="text-[#2D3436]">{detailItem.jenis_kelamin === 'L' ? 'Laki-laki (Putra)' : 'Perempuan (Putri)'}</strong></div>
                <div><span className="text-slate-500">TTL:</span> <strong className="text-[#2D3436]">{detailItem.tempat_lahir || '-'}, {detailItem.tanggal_lahir || '-'}</strong></div>
                <div><span className="text-slate-500">NIK:</span> <strong className="text-[#2D3436]">{detailItem.nik || '-'}</strong></div>
                <div><span className="text-slate-500">NISN:</span> <strong className="text-[#2D3436]">{detailItem.nisn || '-'}</strong></div>
                <div><span className="text-slate-500">Asal Sekolah:</span> <strong className="text-[#2D3436]">{detailItem.asal_sekolah || '-'}</strong></div>
                <div><span className="text-slate-500">Kota Asal:</span> <strong className="text-[#2D3436]">{detailItem.kota || '-'}</strong></div>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-2">
                <div className="font-black text-[#138F81] border-b border-slate-200 pb-1">Orang Tua & Akun Login</div>
                <div><span className="text-slate-500">Nama Wali:</span> <strong className="text-[#2D3436]">{detailItem.nama_wali || detailItem.nama_ayah || '-'}</strong></div>
                <div><span className="text-slate-500">No. WA Wali:</span> <strong className="text-[#0D7A6F] font-mono">{detailItem.no_whatsapp_wali}</strong></div>
                <div><span className="text-slate-500">Username Login:</span> <strong className="text-[#2D3436] font-mono">{detailItem.account_username || detailItem.registration_number}</strong></div>
                <div><span className="text-slate-500">Password Sistem:</span> <strong className="text-[#D97706] font-mono">{detailItem.account_initial_password || '-'}</strong></div>
                <div><span className="text-slate-500">Status WA:</span> {detailItem.wa_notif_sent ? <span className="text-[#138F81] font-black">Terkirim</span> : <span className="text-amber-600 font-bold">Belum Terkirim</span>}</div>
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={resendingWaId === detailItem.id}
                    onClick={() => handleResendWa(detailItem)}
                    className="w-full py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-700" />
                    <span>{resendingWaId === detailItem.id ? 'Mengirim Pesan...' : 'Kirim Ulang Notifikasi WA'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Dokumen Berkas */}
            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200 text-xs mb-6">
              <div className="font-black text-[#2D3436] mb-3">Dokumen Berkas Pendaftaran:</div>
              <div className="flex flex-wrap gap-3">
                {detailItem.dokumen_foto ? (
                  <a
                    href={detailItem.dokumen_foto}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-[#FFDC80] hover:bg-[#ffe59e] text-[#0D7A6F] font-bold border border-amber-300 flex items-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Lihat Pas Foto</span>
                  </a>
                ) : (
                  <span className="text-slate-400 italic">Tidak ada foto</span>
                )}

                {detailItem.dokumen_kk ? (
                  <a
                    href={detailItem.dokumen_kk}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-[#FFDC80] hover:bg-[#ffe59e] text-[#0D7A6F] font-bold border border-amber-300 flex items-center gap-1.5 transition-colors"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Lihat Kartu Keluarga (KK)</span>
                  </a>
                ) : (
                  <span className="text-slate-400 italic">Tidak ada file KK</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDetailItem(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#2D3436] text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL ACC & KONVERSI MENJADI SANTRI RESMI PONDOK */}
      {convertModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-[#2D3436] border-2 border-emerald-400 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
            <button
              onClick={() => setConvertModalItem(null)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-[#138F81] border border-emerald-300 flex items-center justify-center">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#0D7A6F] bg-[#FFDC80] px-2 py-0.5 rounded-md border border-amber-300">
                  PENETAPAN RESMI SANTRI
                </span>
                <h3 className="text-lg font-black text-[#2D3436] mt-0.5">
                  ACC Santri: {convertModalItem.nama_lengkap}
                </h3>
              </div>
            </div>

            {convertResult ? (
              /* Success Result View */
              <div className="space-y-4 text-center animate-in fade-in duration-300">
                <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs space-y-2">
                  <div className="text-xs text-emerald-800 font-bold">NOMOR INDUK SANTRI RESMI (NIS):</div>
                  <div className="text-2xl font-black text-[#138F81] font-mono">
                    {convertResult.siswa?.nis}
                  </div>
                  <div className="text-[11px] text-[#636E72]">
                    Santri resmi masuk ke Buku Induk Pondok Pesantren Qomaruddin.
                  </div>
                </div>

                {convertResult.wali_user && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-left space-y-1">
                    <div className="font-bold text-[#2D3436]">Akun Wali Santri Otomatis Dibuat:</div>
                    <div>Email: <strong className="text-[#138F81]">{convertResult.wali_user.email}</strong></div>
                    <div>Password Default: <strong className="text-[#D97706]">{convertResult.wali_user.default_password}</strong></div>
                  </div>
                )}

                <button
                  onClick={() => setConvertModalItem(null)}
                  className="w-full py-3 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white font-black text-xs shadow-md cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            ) : (
              /* Form Convert */
              <div className="space-y-4 text-xs">
                <p className="text-[#636E72] leading-relaxed font-medium">
                  Calon santri ini akan di-ACC dan <strong>dikonversi otomatis menjadi Santri Resmi</strong> di tabel database <code>siswa</code> pondok pesantren.
                </p>

                <div>
                  <label className="block text-[#2D3436] font-bold mb-1">
                    Nomor Induk Santri (NIS) (Kosongkan untuk otomatis)
                  </label>
                  <input
                    type="text"
                    value={convertForm.nis}
                    onChange={(e) => setConvertForm(prev => ({ ...prev, nis: e.target.value }))}
                    placeholder="Auto: RT2026xxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#2D3436] font-mono text-xs outline-none focus:bg-white focus:border-[#138F81]"
                  />
                </div>

                <div>
                  <label className="block text-[#2D3436] font-bold mb-1">
                    Penempatan Kelas Madin Awal (Opsional)
                  </label>
                  <select
                    value={convertForm.class_id}
                    onChange={(e) => setConvertForm(prev => ({ ...prev, class_id: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#2D3436] text-xs outline-none focus:bg-white focus:border-[#138F81]"
                  >
                    <option value="">-- Pilih Kelas Madin Awal --</option>
                    {classesList.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#2D3436] font-bold mb-1">
                    Penempatan Kamar Pondok Awal (Opsional)
                  </label>
                  <select
                    value={convertForm.boarding_room_id}
                    onChange={(e) => setConvertForm(prev => ({ ...prev, boarding_room_id: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#2D3436] text-xs outline-none focus:bg-white focus:border-[#138F81]"
                  >
                    <option value="">-- Pilih Kamar Asrama Pondok --</option>
                    {roomsList.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="createWaliCheck"
                    checked={convertForm.create_wali_user}
                    onChange={(e) => setConvertForm(prev => ({ ...prev, create_wali_user: e.target.checked }))}
                    className="rounded border-slate-300 text-[#138F81] focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="createWaliCheck" className="text-[#2D3436] cursor-pointer select-none font-medium">
                    Buat akun login Wali Santri otomatis (username: <code>wali_nis@absensi.local</code>)
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => setConvertModalItem(null)}
                    className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleExecuteConvert}
                    disabled={isConverting}
                    className="px-6 py-2.5 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white font-black shadow-md flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isConverting ? 'Mengonversi...' : 'ACC & Konversi Sekarang'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🌟 MODAL UBAH STATUS SELEKSI */}
      {statusModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-[#2D3436] border-2 border-amber-300 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setStatusModalItem(null)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-[#2D3436] mb-4">
              Ubah Status Pendaftaran: {statusModalItem.registration_number}
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[#2D3436] font-bold mb-1">Status Seleksi</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#2D3436] text-xs outline-none focus:bg-white focus:border-[#138F81]"
                >
                  <option value="pending">Menunggu Verifikasi (Pending)</option>
                  <option value="reviewed">Sedang Ditinjau Berkas (Reviewed)</option>
                  <option value="accepted">Diterima / Lolos Seleksi (Accepted)</option>
                  <option value="rejected">Perlu Perbaikan / Ditolak (Rejected)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#2D3436] font-bold mb-1">Catatan Panitia untuk Santri/Wali</label>
                <textarea
                  rows={3}
                  value={statusAdminNote}
                  onChange={(e) => setStatusAdminNote(e.target.value)}
                  placeholder="Misal: Mohon upload ulang foto KK yang lebih jelas..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#2D3436] text-xs outline-none focus:bg-white focus:border-[#138F81]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  onClick={() => setStatusModalItem(null)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveStatus}
                  disabled={isUpdatingStatus}
                  className="px-5 py-2.5 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white font-black shadow-md cursor-pointer"
                >
                  {isUpdatingStatus ? 'Menyimpan...' : 'Simpan Status'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL FORM GELOMBANG PMB */}
      {batchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-[#2D3436] border-2 border-amber-300 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setBatchModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-[#2D3436] mb-4">
              {editingBatch ? 'Edit Gelombang PMB' : 'Buka Gelombang PMB Baru'}
            </h3>

            <form onSubmit={handleSaveBatch} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#2D3436] font-bold mb-1">Nama Gelombang</label>
                <input
                  type="text"
                  required
                  value={batchForm.nama_gelombang}
                  onChange={(e) => setBatchForm(prev => ({ ...prev, nama_gelombang: e.target.value }))}
                  placeholder="Contoh: Gelombang 1 - TA 2026/2027"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#2D3436] text-xs outline-none focus:bg-white focus:border-[#138F81]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#2D3436] font-bold mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    required
                    value={batchForm.tanggal_mulai}
                    onChange={(e) => setBatchForm(prev => ({ ...prev, tanggal_mulai: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#2D3436] text-xs outline-none focus:bg-white focus:border-[#138F81]"
                  />
                </div>
                <div>
                  <label className="block text-[#2D3436] font-bold mb-1">Tanggal Berakhir</label>
                  <input
                    type="date"
                    required
                    value={batchForm.tanggal_selesai}
                    onChange={(e) => setBatchForm(prev => ({ ...prev, tanggal_selesai: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#2D3436] text-xs outline-none focus:bg-white focus:border-[#138F81]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#2D3436] font-bold mb-1">Biaya Formulir (Rp)</label>
                  <input
                    type="number"
                    value={batchForm.biaya_pendaftaran}
                    onChange={(e) => setBatchForm(prev => ({ ...prev, biaya_pendaftaran: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#2D3436] text-xs outline-none focus:bg-white focus:border-[#138F81]"
                  />
                </div>
                <div>
                  <label className="block text-[#2D3436] font-bold mb-1">Kuota Santri</label>
                  <input
                    type="number"
                    value={batchForm.kuota}
                    onChange={(e) => setBatchForm(prev => ({ ...prev, kuota: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#2D3436] text-xs outline-none focus:bg-white focus:border-[#138F81]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="batchActiveCheck"
                  checked={batchForm.is_active}
                  onChange={(e) => setBatchForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded border-slate-300 text-[#138F81] focus:ring-0 cursor-pointer"
                />
                <label htmlFor="batchActiveCheck" className="text-[#2D3436] cursor-pointer font-medium select-none">
                  Jadikan gelombang aktif utama di halaman pendaftaran online
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setBatchModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white font-black shadow-md cursor-pointer"
                >
                  Simpan Gelombang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
