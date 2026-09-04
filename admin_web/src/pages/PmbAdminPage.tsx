import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
  Layers,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Search,
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
  dokumen_foto: string | null;
  dokumen_kk: string | null;
  dokumen_ijazah: string | null;
  catatan_khusus: string | null;
  status: 'pending' | 'reviewed' | 'accepted' | 'rejected';
  catatan_admin: string | null;
  verified_at: string | null;
  is_converted: boolean;
  converted_siswa_id: number | null;
  batch?: { id: number; nama_gelombang: string; tahun_akademik: string };
  siswa?: { id: number; nis: string; nama: string; kelas: string | null; kamar: string | null };
  created_at: string;
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
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Tab 1: Dashboard Stats
  const [dashboard, setDashboard] = useState<PmbDashboardData | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);

  // Tab 2: Registrations List
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [statusFilter, setStatusFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingList, setIsLoadingList] = useState(false);

  // Modals & Action States
  const [detailItem, setDetailItem] = useState<RegistrationItem | null>(null);
  const [convertModalItem, setConvertModalItem] = useState<RegistrationItem | null>(null);
  const [convertForm, setConvertForm] = useState({
    nis: '',
    class_id: '',
    boarding_room_id: '',
    create_wali_user: true,
    catatan_admin: 'Diterima resmi sebagai santri PP Qomaruddin.'
  });
  const [isConverting, setIsConverting] = useState(false);
  const [convertResult, setConvertResult] = useState<any | null>(null);

  // Status Modal
  const [statusModalItem, setStatusModalItem] = useState<RegistrationItem | null>(null);
  const [newStatus, setNewStatus] = useState<'pending' | 'reviewed' | 'accepted' | 'rejected'>('reviewed');
  const [statusAdminNote, setStatusAdminNote] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Master References for Conversion (Classes & Rooms)
  const [classesList, setClassesList] = useState<Array<{ id: number; name: string }>>([]);
  const [roomsList, setRoomsList] = useState<Array<{ id: number; name: string }>>([]);

  // Tab 3: Batches
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<BatchItem | null>(null);
  const [batchForm, setBatchForm] = useState({
    nama_gelombang: '',
    tahun_akademik: '2026/2027',
    tanggal_mulai: '',
    tanggal_selesai: '',
    biaya_pendaftaran: 150000,
    kuota: 300,
    is_active: true,
    keterangan: '',
  });

  // Success / Error Toast
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
      showToast(e?.message || 'Gagal memuat data pendaftar', 'error');
    } finally {
      setIsLoadingList(false);
    }
  };

  const loadReferenceOptions = async () => {
    try {
      // Load classes
      const clsRes = await api.classes();
      if (clsRes && Array.isArray(clsRes.data)) {
        setClassesList(clsRes.data.map((c: any) => ({ id: Number(c.id), name: String(c.name || c.nama || '') })));
      }
      // Load complexes & rooms
      const complexRes = await api.boardingComplexes();
      if (complexRes && Array.isArray(complexRes.data)) {
        const allRooms: Array<{ id: number; name: string }> = [];
        complexRes.data.forEach((comp: any) => {
          if (Array.isArray(comp.rooms)) {
            comp.rooms.forEach((r: any) => {
              allRooms.push({ id: Number(r.id), name: `${comp.name || ''} - ${r.name || ''}`.trim() });
            });
          }
        });
        setRoomsList(allRooms);
      }
    } catch (e) {
      // Fallback
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
      showToast(e?.message || 'Gagal memuat data gelombang PMB', 'error');
    } finally {
      setIsLoadingBatches(false);
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
      await api.post(`/pmb/admin/registrations/${statusModalItem.id}/status`, {
        status: newStatus,
        catatan_admin: statusAdminNote,
      });
      showToast(`Status pendaftaran ${statusModalItem.registration_number} berhasil diperbarui.`);
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
      nis: '',
      class_id: '',
      boarding_room_id: '',
      create_wali_user: true,
      catatan_admin: 'Diterima resmi sebagai santri PP Qomaruddin.'
    });
  };

  const handleExecuteConvert = async () => {
    if (!convertModalItem) return;
    setIsConverting(true);
    try {
      const res = await api.post<{ message: string; data: any }>(
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
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl text-xs font-bold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300 ${
            toast.type === 'success'
              ? 'bg-[#10B981] text-white shadow-[#10B981]/30'
              : 'bg-rose-600 text-white shadow-rose-600/30'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 🌟 HEADER PMB ADMIN */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-br from-[#0B3A2C] via-[#092B23] to-[#061A15] border border-[#138F81]/40 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-[#138F81]/25 border border-[#4ADE80]/40 flex items-center justify-center text-[#5EEAD4] shadow-lg shadow-[#138F81]/20">
            <UserPlus className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Penerimaan Santri Baru (PMB)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#4ADE80]/20 text-[#4ADE80] border border-[#4ADE80]/40">
                TA 2026/2027
              </span>
            </div>
            <p className="text-xs text-[#A7F3D0] mt-0.5">
              Portal Verifikasi, Seleksi Berkas, & 1-Klik ACC Santri Resmi Pondok Pesantren Qomaruddin
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open('/pmb', '_blank')}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 flex items-center gap-1.5 transition-colors"
            title="Buka tampilan formulir publik untuk calon santri"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#5EEAD4]" />
            <span>Lihat Web PMB Publik</span>
          </button>
        </div>
      </div>

      {/* 🌟 NAVIGATION SUB-TABS */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#09251E] border border-[#138F81]/30 overflow-x-auto">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'dashboard'
              ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/40'
              : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
          }`}
        >
          <Award className="w-3.5 h-3.5 text-[#5EEAD4]" />
          <span>Dashboard PMB</span>
        </button>

        <button
          onClick={() => setActiveTab('applicants')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'applicants'
              ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/40'
              : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-[#FCD34D]" />
          <span>Data Calon Santri</span>
          {dashboard && dashboard.pending > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
              {dashboard.pending}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('batches')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'batches'
              ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/40'
              : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-[#6EE7B7]" />
          <span>Gelombang Pendaftaran</span>
        </button>
      </div>

      {/* 🌟 TAB 1: DASHBOARD METRICS */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Top 4 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#092B23] border border-[#138F81]/40 shadow-lg">
              <div className="flex items-center justify-between text-xs text-[#94A3B8] font-semibold mb-1">
                <span>Total Pendaftar</span>
                <Users className="w-4 h-4 text-[#5EEAD4]" />
              </div>
              <div className="text-3xl font-black text-white">{dashboard?.total ?? 0}</div>
              <div className="text-[11px] text-[#A7F3D0] mt-1">
                +{dashboard?.today ?? 0} calon santri baru hari ini
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#092B23] border border-amber-500/40 shadow-lg">
              <div className="flex items-center justify-between text-xs text-amber-300 font-semibold mb-1">
                <span>Menunggu Verifikasi</span>
                <HelpCircle className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-3xl font-black text-amber-400">{dashboard?.pending ?? 0}</div>
              <div className="text-[11px] text-amber-200/80 mt-1">Perlu ditinjau panitia PMB</div>
            </div>

            <div className="p-5 rounded-2xl bg-[#092B23] border border-[#10B981]/40 shadow-lg">
              <div className="flex items-center justify-between text-xs text-[#A7F3D0] font-semibold mb-1">
                <span>Diterima / Lolos ACC</span>
                <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" />
              </div>
              <div className="text-3xl font-black text-[#4ADE80]">{dashboard?.accepted ?? 0}</div>
              <div className="text-[11px] text-[#A7F3D0] mt-1">Resmi bergabung di pondok</div>
            </div>

            <div className="p-5 rounded-2xl bg-[#092B23] border border-rose-500/40 shadow-lg">
              <div className="flex items-center justify-between text-xs text-rose-300 font-semibold mb-1">
                <span>Perlu Perbaikan / Ditolak</span>
                <X className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-3xl font-black text-rose-400">{dashboard?.rejected ?? 0}</div>
              <div className="text-[11px] text-rose-200/80 mt-1">Berkas kurang lengkap / belum lolos</div>
            </div>
          </div>

          {/* Gender & Program Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 p-6 rounded-3xl bg-[#092B23] border border-[#138F81]/40 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#5EEAD4]" />
                <span>Proporsi Calon Santri Putra & Putri</span>
              </h3>

              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-blue-300">👦 Santri Putra: {dashboard?.putra ?? 0}</span>
                    <span className="text-white">
                      {dashboard?.total
                        ? Math.round(((dashboard?.putra ?? 0) / dashboard.total) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-black/40 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${dashboard?.total ? ((dashboard.putra ?? 0) / dashboard.total) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-pink-300">👧 Santri Putri: {dashboard?.putri ?? 0}</span>
                    <span className="text-white">
                      {dashboard?.total
                        ? Math.round(((dashboard?.putri ?? 0) / dashboard.total) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-black/40 overflow-hidden">
                    <div
                      className="h-full bg-pink-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${dashboard?.total ? ((dashboard.putri ?? 0) / dashboard.total) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#061A15] border border-[#138F81]/30 text-xs text-[#CBD5E1]">
                💡 <strong>Catatan Panitia:</strong> Asrama putra dan putri memiliki kapasitas terpisah. Pastikan kamar asrama sesuai dengan jenis kelamin calon santri saat proses ACC.
              </div>
            </div>

            <div className="lg:col-span-7 p-6 rounded-3xl bg-[#092B23] border border-[#138F81]/40 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#FCD34D]" />
                <span>Peminatan Program Pendidikan</span>
              </h3>

              <div className="space-y-2.5">
                {dashboard?.jenjang_stats && dashboard.jenjang_stats.length > 0 ? (
                  dashboard.jenjang_stats.map((j, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl bg-[#061A15] border border-[#138F81]/30 flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-white">{j.pilihan_jenjang}</span>
                      <span className="font-black px-2.5 py-1 rounded-lg bg-[#138F81]/30 text-[#5EEAD4]">
                        {j.total} Santri
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-[#94A3B8] text-center py-6">Belum ada data pendaftar.</div>
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
          <div className="p-4 rounded-2xl bg-[#092B23] border border-[#138F81]/30 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama santri, no registrasi, WA, kota..."
                  className="w-full px-4 py-2 pl-9 rounded-xl bg-[#061A15] border border-[#138F81]/40 focus:border-[#4ADE80] text-xs text-white placeholder-slate-500 outline-none"
                />
                <Search className="w-4 h-4 text-[#4ADE80] absolute left-3 top-2.5" />
              </div>
            </form>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 rounded-xl bg-[#061A15] border border-[#138F81]/40 text-xs text-white outline-none"
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
                className="px-3 py-2 rounded-xl bg-[#061A15] border border-[#138F81]/40 text-xs text-white outline-none"
              >
                <option value="all">Semua Gender</option>
                <option value="L">Putra (L)</option>
                <option value="P">Putri (P)</option>
              </select>

              <button
                onClick={loadRegistrations}
                className="p-2 rounded-xl bg-[#061A15] hover:bg-[#138F81]/20 text-[#A7F3D0] border border-[#138F81]/40 transition-colors"
                title="Refresh Data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={handleExportExcel}
                className="px-3.5 py-2 rounded-xl bg-[#10B981]/20 hover:bg-[#10B981]/30 text-[#6EE7B7] font-bold text-xs border border-[#10B981]/40 flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-3xl bg-[#092B23] border border-[#138F81]/40 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#061A15] text-[#94A3B8] font-bold uppercase tracking-wider border-b border-[#138F81]/30">
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
                <tbody className="divide-y divide-[#138F81]/20 text-[#CBD5E1]">
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
                        <tr key={item.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3.5 font-mono font-bold text-[#FCD34D] whitespace-nowrap">
                            {item.registration_number}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="font-bold text-white">{item.nama_lengkap}</div>
                            {item.nama_panggilan && (
                              <div className="text-[10px] text-[#94A3B8]">({item.nama_panggilan})</div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                isL ? 'bg-blue-500/20 text-blue-300' : 'bg-pink-500/20 text-pink-300'
                              }`}
                            >
                              {isL ? 'Putra' : 'Putri'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="font-semibold text-white">{item.kota || '-'}</div>
                            <div className="text-[10px] text-[#94A3B8]">{item.asal_sekolah || '-'}</div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="text-white">{item.pilihan_jenjang}</div>
                            <div className="text-[10px] text-[#A7F3D0]">{item.pilihan_asrama}</div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[#A7F3D0]">
                            {item.no_whatsapp_wali}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {isConverted ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-[#10B981] text-white flex items-center gap-1 w-fit">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Santri Resmi</span>
                              </span>
                            ) : (
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                  item.status === 'accepted'
                                    ? 'bg-[#10B981] text-white'
                                    : item.status === 'rejected'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                    : item.status === 'reviewed'
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
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
                                className="p-1.5 rounded-lg bg-[#138F81]/20 hover:bg-[#138F81]/40 text-[#5EEAD4] transition-colors"
                                title="Lihat Detail & Berkas"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Tombol Ubah Status */}
                              <button
                                onClick={() => handleOpenStatusModal(item)}
                                className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 transition-colors"
                                title="Ubah Status Seleksi / Catatan"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Tombol ACC & Konversi ke Siswa */}
                              {!isConverted && (
                                <button
                                  onClick={() => handleOpenConvertModal(item)}
                                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white font-extrabold text-[11px] flex items-center gap-1 shadow-md shadow-[#10B981]/20 transition-all cursor-pointer"
                                  title="ACC dan Konversi Menjadi Santri Resmi Pondok"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
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
              <div className="px-4 py-3 bg-[#061A15] border-t border-[#138F81]/30 flex items-center justify-between text-xs text-[#94A3B8]">
                <span>
                  Menampilkan {(currentPage - 1) * perPage + 1} s/d {Math.min(currentPage * perPage, totalItems)} dari {totalItems} pendaftar
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg bg-[#092B23] border border-[#138F81]/30 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-bold text-white">{currentPage}</span>
                  <button
                    disabled={currentPage * perPage >= totalItems}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="p-1.5 rounded-lg bg-[#092B23] border border-[#138F81]/30 disabled:opacity-40"
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
              <h3 className="text-sm font-bold text-white">Daftar Gelombang Pendaftaran PMB</h3>
              <p className="text-xs text-[#94A3B8]">Kelola periode tanggal buka, kuota, dan tarif biaya formulir.</p>
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
              className="px-4 py-2 rounded-xl bg-[#138F81] hover:bg-[#16A394] text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span>Buka Gelombang Baru</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoadingBatches ? (
              <div className="col-span-full py-12 text-center text-slate-400">Memuat gelombang PMB...</div>
            ) : batches.map((b) => (
              <div
                key={b.id}
                className={`p-6 rounded-3xl border transition-all ${
                  b.is_active
                    ? 'bg-[#092B23] border-[#4ADE80]/50 shadow-xl'
                    : 'bg-[#061A15] border-[#138F81]/20 opacity-80'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                      b.is_active ? 'bg-[#10B981] text-white' : 'bg-slate-700 text-slate-300'
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
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteBatch(b.id)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h4 className="text-base font-black text-white">{b.nama_gelombang}</h4>
                <p className="text-xs text-[#A7F3D0] mb-4">Tahun Akademik {b.tahun_akademik}</p>

                <div className="space-y-1.5 text-xs text-[#94A3B8] border-t border-[#138F81]/20 pt-3">
                  <div className="flex justify-between">
                    <span>Periode:</span>
                    <span className="text-white font-medium">{b.tanggal_mulai} s/d {b.tanggal_selesai}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Biaya Formulir:</span>
                    <span className="text-[#FCD34D] font-bold">Rp {Number(b.biaya_pendaftaran).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pendaftar Masuk:</span>
                    <span className="text-[#5EEAD4] font-black">{b.registrations_count ?? 0} / {b.kuota ?? '∞'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🌟 MODAL DETAIL & REVIEW BERKAS */}
      {detailItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#092B23] text-white border border-[#138F81]/50 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setDetailItem(null)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-2xl bg-[#138F81]/30 border border-[#4ADE80]/40 flex items-center justify-center text-[#5EEAD4]">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-mono font-bold text-[#FCD34D]">
                  {detailItem.registration_number}
                </span>
                <h3 className="text-lg font-black text-white">{detailItem.nama_lengkap}</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-6">
              <div className="p-4 rounded-2xl bg-[#061A15] border border-[#138F81]/30 space-y-2">
                <div className="font-bold text-[#A7F3D0] border-b border-[#138F81]/30 pb-1">Biodata Santri</div>
                <div><span className="text-slate-400">Gender:</span> {detailItem.jenis_kelamin === 'L' ? 'Laki-laki (Putra)' : 'Perempuan (Putri)'}</div>
                <div><span className="text-slate-400">TTL:</span> {detailItem.tempat_lahir || '-'}, {detailItem.tanggal_lahir || '-'}</div>
                <div><span className="text-slate-400">NIK:</span> {detailItem.nik || '-'}</div>
                <div><span className="text-slate-400">NISN:</span> {detailItem.nisn || '-'}</div>
                <div><span className="text-slate-400">Asal Sekolah:</span> {detailItem.asal_sekolah || '-'}</div>
                <div><span className="text-slate-400">Kota Asal:</span> {detailItem.kota || '-'}</div>
              </div>

              <div className="p-4 rounded-2xl bg-[#061A15] border border-[#138F81]/30 space-y-2">
                <div className="font-bold text-[#A7F3D0] border-b border-[#138F81]/30 pb-1">Orang Tua & Pilihan</div>
                <div><span className="text-slate-400">Nama Wali:</span> {detailItem.nama_wali || detailItem.nama_ayah || '-'}</div>
                <div><span className="text-slate-400">No. WA Wali:</span> <strong className="text-[#4ADE80] font-mono">{detailItem.no_whatsapp_wali}</strong></div>
                <div><span className="text-slate-400">Nama Ayah:</span> {detailItem.nama_ayah || '-'} ({detailItem.pekerjaan_ayah || '-'})</div>
                <div><span className="text-slate-400">Nama Ibu:</span> {detailItem.nama_ibu || '-'} ({detailItem.pekerjaan_ibu || '-'})</div>
                <div><span className="text-slate-400">Pilihan Jenjang:</span> {detailItem.pilihan_jenjang}</div>
                <div><span className="text-slate-400">Pilihan Asrama:</span> {detailItem.pilihan_asrama}</div>
              </div>
            </div>

            {/* Dokumen Berkas */}
            <div className="p-4 rounded-2xl bg-[#061A15] border border-[#138F81]/30 text-xs mb-6">
              <div className="font-bold text-[#FCD34D] mb-3">Dokumen Berkas Pendaftaran:</div>
              <div className="flex flex-wrap gap-3">
                {detailItem.dokumen_foto ? (
                  <a
                    href={detailItem.dokumen_foto}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-[#138F81]/20 hover:bg-[#138F81]/40 text-[#5EEAD4] font-bold border border-[#138F81]/40 flex items-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Lihat Pas Foto</span>
                  </a>
                ) : (
                  <span className="text-slate-500 italic">Tidak ada foto</span>
                )}

                {detailItem.dokumen_kk ? (
                  <a
                    href={detailItem.dokumen_kk}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-[#138F81]/20 hover:bg-[#138F81]/40 text-[#5EEAD4] font-bold border border-[#138F81]/40 flex items-center gap-1.5 transition-colors"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Lihat Kartu Keluarga (KK)</span>
                  </a>
                ) : (
                  <span className="text-slate-500 italic">Tidak ada file KK</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDetailItem(null)}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL ACC & KONVERSI MENJADI SANTRI RESMI PONDOK */}
      {convertModalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#092B23] text-white border-2 border-[#10B981]/60 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
            <button
              onClick={() => setConvertModalItem(null)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="h-12 w-12 rounded-2xl bg-[#10B981]/20 border border-[#10B981]/40 flex items-center justify-center text-[#4ADE80]">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#4ADE80] bg-[#10B981]/20 px-2 py-0.5 rounded-md">
                  PENERIMAAN RESMI
                </span>
                <h3 className="text-lg font-black text-white mt-0.5">
                  ACC Santri: {convertModalItem.nama_lengkap}
                </h3>
              </div>
            </div>

            {convertResult ? (
              /* Success Result View */
              <div className="space-y-4 text-center animate-in fade-in duration-300">
                <div className="p-6 rounded-2xl bg-[#061A15] border border-[#10B981]/50 text-xs space-y-2">
                  <div className="text-xs text-[#A7F3D0]">NOMOR INDUK SANTRI RESMI:</div>
                  <div className="text-2xl font-black text-[#FCD34D] font-mono">
                    {convertResult.siswa?.nis}
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Santri resmi masuk ke Buku Induk Pondok Pesantren Qomaruddin.
                  </div>
                </div>

                {convertResult.wali_user && (
                  <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/40 text-xs text-left space-y-1">
                    <div className="font-bold text-blue-300">Akun Wali Santri Otomatis Dibuat:</div>
                    <div>Email: <strong className="text-white">{convertResult.wali_user.email}</strong></div>
                    <div>Password Default: <strong className="text-white">{convertResult.wali_user.default_password}</strong></div>
                  </div>
                )}

                <button
                  onClick={() => setConvertModalItem(null)}
                  className="w-full py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs"
                >
                  Selesai
                </button>
              </div>
            ) : (
              /* Form Convert */
              <div className="space-y-4 text-xs">
                <p className="text-slate-300 leading-relaxed">
                  Calon santri ini akan di-ACC dan <strong>dikonversi otomatis menjadi Santri Resmi</strong> di tabel database <code>siswa</code> pondok pesantren.
                </p>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Nomor Induk Santri (NIS) (Kosongkan untuk otomatis)
                  </label>
                  <input
                    type="text"
                    value={convertForm.nis}
                    onChange={(e) => setConvertForm(prev => ({ ...prev, nis: e.target.value }))}
                    placeholder="Auto: RT2026xxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 text-white font-mono text-xs outline-none focus:border-[#4ADE80]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Penempatan Kelas Madin Awal (Opsional)
                  </label>
                  <select
                    value={convertForm.class_id}
                    onChange={(e) => setConvertForm(prev => ({ ...prev, class_id: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 text-white text-xs outline-none"
                  >
                    <option value="">-- Pilih Kelas Madin Awal --</option>
                    {classesList.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Penempatan Kamar Pondok Awal (Opsional)
                  </label>
                  <select
                    value={convertForm.boarding_room_id}
                    onChange={(e) => setConvertForm(prev => ({ ...prev, boarding_room_id: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 text-white text-xs outline-none"
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
                    className="rounded border-[#138F81] text-[#10B981] focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="createWaliCheck" className="text-slate-300 cursor-pointer select-none">
                    Buat akun login Wali Santri otomatis (username: <code>wali_nis@absensi.local</code>)
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#138F81]/30">
                  <button
                    onClick={() => setConvertModalItem(null)}
                    className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleExecuteConvert}
                    disabled={isConverting}
                    className="px-6 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-black shadow-lg flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#092B23] text-white border border-[#138F81]/50 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setStatusModalItem(null)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-white mb-4">
              Ubah Status Pendaftaran: {statusModalItem.registration_number}
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Status Seleksi</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 text-white text-xs outline-none"
                >
                  <option value="pending">Menunggu Verifikasi (Pending)</option>
                  <option value="reviewed">Sedang Ditinjau Berkas (Reviewed)</option>
                  <option value="accepted">Diterima / Lolos Seleksi (Accepted)</option>
                  <option value="rejected">Perlu Perbaikan / Ditolak (Rejected)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Catatan Panitia untuk Santri/Wali</label>
                <textarea
                  rows={3}
                  value={statusAdminNote}
                  onChange={(e) => setStatusAdminNote(e.target.value)}
                  placeholder="Misal: Mohon upload ulang foto KK yang lebih jelas..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 text-white text-xs outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#138F81]/30">
                <button
                  onClick={() => setStatusModalItem(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveStatus}
                  disabled={isUpdatingStatus}
                  className="px-5 py-2.5 rounded-xl bg-[#138F81] hover:bg-[#16A394] text-white font-bold"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#092B23] text-white border border-[#138F81]/50 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setBatchModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-white mb-4">
              {editingBatch ? 'Edit Gelombang PMB' : 'Buka Gelombang PMB Baru'}
            </h3>

            <form onSubmit={handleSaveBatch} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nama Gelombang</label>
                <input
                  type="text"
                  required
                  value={batchForm.nama_gelombang}
                  onChange={(e) => setBatchForm(prev => ({ ...prev, nama_gelombang: e.target.value }))}
                  placeholder="Contoh: Gelombang 1 - TA 2026/2027"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#061A15] border border-[#138F81]/40 text-white text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    required
                    value={batchForm.tanggal_mulai}
                    onChange={(e) => setBatchForm(prev => ({ ...prev, tanggal_mulai: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#061A15] border border-[#138F81]/40 text-white text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tanggal Berakhir</label>
                  <input
                    type="date"
                    required
                    value={batchForm.tanggal_selesai}
                    onChange={(e) => setBatchForm(prev => ({ ...prev, tanggal_selesai: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#061A15] border border-[#138F81]/40 text-white text-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Biaya Formulir (Rp)</label>
                  <input
                    type="number"
                    value={batchForm.biaya_pendaftaran}
                    onChange={(e) => setBatchForm(prev => ({ ...prev, biaya_pendaftaran: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#061A15] border border-[#138F81]/40 text-white text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Kuota Santri</label>
                  <input
                    type="number"
                    value={batchForm.kuota}
                    onChange={(e) => setBatchForm(prev => ({ ...prev, kuota: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#061A15] border border-[#138F81]/40 text-white text-xs outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="batchActiveCheck"
                  checked={batchForm.is_active}
                  onChange={(e) => setBatchForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded border-[#138F81] text-[#10B981] focus:ring-0"
                />
                <label htmlFor="batchActiveCheck" className="text-slate-300 cursor-pointer">
                  Jadikan gelombang aktif utama di halaman pendaftaran online
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#138F81]/30">
                <button
                  type="button"
                  onClick={() => setBatchModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#138F81] hover:bg-[#16A394] text-white font-bold"
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
