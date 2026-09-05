import {
  Activity,
  AlertTriangle,
  Award,
  Banknote,
  BookOpen,
  Calendar,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  CreditCard,
  Download,
  Edit2,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  Filter,
  Globe,
  GraduationCap,
  HelpCircle,
  Home,
  KeyRound,
  Layers,
  Megaphone,
  MessageCircle,
  Phone,
  Plus,
  Power,
  Printer,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api, type ApiRecord } from '../services/api';
import { exportRowsExcel } from '../utils/importTemplates';
import { PmbCmsTab } from './pmb/PmbCmsTab';
import { PmbAnnouncementsTab } from './pmb/PmbAnnouncementsTab';

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
  pmb_is_open?: boolean;
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
  dokumen_ijazah: string | null;
  status: 'pending' | 'reviewed' | 'accepted' | 'rejected';
  payment_status?: 'pending' | 'perlu_pelunasan' | 'lunas' | 'gratis';
  payment_amount?: number;
  payment_notes?: string | null;
  payment_verified_at?: string | null;
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
    tahun_akademik?: string;
  };
  siswa?: {
    id: number;
    nis: string;
    nama: string;
    kelas?: string | null;
    kamar?: string | null;
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

  // Master PMB Open / Closed state
  const [pmbIsOpen, setPmbIsOpen] = useState(true);
  const [pmbToggleModalOpen, setPmbToggleModalOpen] = useState(false);
  const [closedMessageInput, setClosedMessageInput] = useState('');
  const [isTogglingPmb, setIsTogglingPmb] = useState(false);

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
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Loading indicators
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);

  // Detail Modal state
  const [detailItem, setDetailItem] = useState<RegistrationItem | null>(null);

  // Audit & Payment Modal state
  const [auditModalItem, setAuditModalItem] = useState<RegistrationItem | null>(null);
  const [auditStatus, setAuditStatus] = useState<'pending' | 'reviewed' | 'accepted' | 'rejected'>('reviewed');
  const [auditAdminNote, setAuditAdminNote] = useState('');
  const [auditPaymentStatus, setAuditPaymentStatus] = useState<'pending' | 'perlu_pelunasan' | 'lunas' | 'gratis'>('pending');
  const [auditPaymentAmount, setAuditPaymentAmount] = useState(150000);
  const [auditPaymentNotes, setAuditPaymentNotes] = useState('');
  const [auditSendWa, setAuditSendWa] = useState(true);
  const [isSavingAudit, setIsSavingAudit] = useState(false);

  // Convert to Siswa Modal state (1-Klik ACC)
  const [convertModalItem, setConvertModalItem] = useState<RegistrationItem | null>(null);
  const [convertForm, setConvertForm] = useState({
    class_id: '',
    boarding_room_id: '',
    nis: '',
    create_wali_user: true,
    catatan_admin: '',
  });
  const [isConverting, setIsConverting] = useState(false);
  const [convertResult, setConvertResult] = useState<any | null>(null);

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

  // Modern Delete Confirmation state
  const [batchToDelete, setBatchToDelete] = useState<BatchItem | null>(null);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  // Resend WhatsApp state
  const [resendingWaId, setResendingWaId] = useState<number | null>(null);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);

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
  }, [activeTab, currentPage, statusFilter, paymentStatusFilter, genderFilter, batchFilter]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadDashboard = async () => {
    setIsLoadingDashboard(true);
    try {
      const res = await api.getPmbDashboard();
      if (res && res.data) {
        setDashboard(res.data as unknown as PmbDashboardData);
        if (typeof (res.data as any).pmb_is_open !== 'undefined') {
          setPmbIsOpen(Boolean((res.data as any).pmb_is_open));
        }
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
      const params: Record<string, string | number> = {
        page: currentPage,
        per_page: perPage,
        status: statusFilter,
        payment_status: paymentStatusFilter,
        jenis_kelamin: genderFilter,
        pmb_batch_id: batchFilter,
        search: searchQuery
      };

      const res = await api.getPmbRegistrations(params);
      if (res && res.data) {
        setRegistrations((res.data as any).data || []);
        setTotalItems((res.data as any).total || 0);
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

  const handleCopyPmbLink = () => {
    const url = `${window.location.origin}/?pmb=1`;
    navigator.clipboard.writeText(url);
    setHasCopiedLink(true);
    setTimeout(() => setHasCopiedLink(false), 3000);
  };

  const handleTogglePmbDirect = async (nextStatus: boolean) => {
    setIsTogglingPmb(true);
    try {
      await api.togglePmbStatus({
        is_open: nextStatus,
        closed_message: closedMessageInput || undefined
      });
      setPmbIsOpen(nextStatus);
      setPmbToggleModalOpen(false);
      showToast(`Pendaftaran PMB berhasil di-${nextStatus ? 'BUKA' : 'TUTUP'}.`);
    } catch (e: any) {
      showToast(e?.message || 'Gagal mengubah status pendaftaran PMB', 'error');
    } finally {
      setIsTogglingPmb(false);
    }
  };

  const handleResendWa = async (item: RegistrationItem) => {
    setResendingWaId(item.id);
    try {
      const res = await api.resendPmbWa(item.id);
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

  const handleOpenAuditModal = (item: RegistrationItem) => {
    setAuditModalItem(item);
    setAuditStatus(item.status);
    setAuditAdminNote(item.catatan_admin || '');
    setAuditPaymentStatus(item.payment_status || 'pending');
    setAuditPaymentAmount(Number(item.payment_amount) || (item.batch ? (item.batch as any).biaya_pendaftaran : 150000) || 150000);
    setAuditPaymentNotes(item.payment_notes || '');
    setAuditSendWa(true);
  };

  const handleSaveAudit = async () => {
    if (!auditModalItem) return;
    setIsSavingAudit(true);
    try {
      await api.auditPmbRegistration(auditModalItem.id, {
        status: auditStatus,
        catatan_admin: auditAdminNote,
        payment_status: auditPaymentStatus,
        payment_amount: auditPaymentAmount,
        payment_notes: auditPaymentNotes,
        send_wa: auditSendWa,
      });
      showToast(`Audit pendaftaran ${auditModalItem.registration_number} berhasil disimpan.`);
      setAuditModalItem(null);
      loadRegistrations();
      if (activeTab === 'dashboard') loadDashboard();
    } catch (e: any) {
      showToast(e?.message || 'Gagal menyimpan audit pendaftaran', 'error');
    } finally {
      setIsSavingAudit(false);
    }
  };

  const handleOpenConvertModal = (item: RegistrationItem) => {
    setConvertModalItem(item);
    setConvertResult(null);
    setConvertForm({
      class_id: '',
      boarding_room_id: '',
      nis: '',
      create_wali_user: true,
      catatan_admin: `Diterima resmi via PMB ${item.batch?.nama_gelombang || 'Gelombang 1'}.`,
    });
  };

  const handleExecuteConvert = async () => {
    if (!convertModalItem) return;
    setIsConverting(true);
    try {
      const res = await api.convertPmbToSiswa(convertModalItem.id, {
        nis: convertForm.nis || undefined,
        class_id: convertForm.class_id ? Number(convertForm.class_id) : undefined,
        boarding_room_id: convertForm.boarding_room_id ? Number(convertForm.boarding_room_id) : undefined,
        create_wali_user: convertForm.create_wali_user,
        catatan_admin: convertForm.catatan_admin,
      });

      if (res) {
        setConvertResult((res as any).data);
        showToast((res as any).message || 'Santri berhasil di-ACC dan otomatis masuk ke Buku Induk Siswa!');
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

  const handleExecuteDeleteBatch = async () => {
    if (!batchToDelete) return;
    setIsDeletingBatch(true);
    try {
      await api.delete(`/pmb/admin/batches/${batchToDelete.id}`);
      showToast(`Gelombang "${batchToDelete.nama_gelombang}" berhasil dihapus.`);
      setBatchToDelete(null);
      loadBatches();
    } catch (e: any) {
      showToast(e?.message || 'Gagal menghapus gelombang PMB', 'error');
    } finally {
      setIsDeletingBatch(false);
    }
  };

  const handleExportExcel = async () => {
    if (registrations.length === 0) {
      showToast('Tidak ada data calon santri untuk diekspor', 'error');
      return;
    }

    const rows = registrations.map((r, idx) => ({
      No: idx + 1,
      'No. Registrasi': r.registration_number,
      'Nama Lengkap': r.nama_lengkap,
      'Jenis Kelamin': r.jenis_kelamin === 'L' ? 'Laki-laki (Putra)' : 'Perempuan (Putri)',
      'NIK': r.nik || '-',
      'NISN': r.nisn || '-',
      'Kota Asal': r.kota || '-',
      'Asal Sekolah': r.asal_sekolah || '-',
      'Pilihan Jenjang': r.pilihan_jenjang,
      'Pilihan Asrama': r.pilihan_asrama,
      'Nama Wali': r.nama_wali || r.nama_ayah || '-',
      'No. WhatsApp Wali': r.no_whatsapp_wali,
      'Gelombang': r.batch?.nama_gelombang || '-',
      'Status Audit': r.status.toUpperCase(),
      'Status Pembayaran': (r.payment_status || 'pending').toUpperCase(),
      'Biaya Formulir': Number(r.payment_amount || 0),
      'Status Buku Induk': r.is_converted ? 'Santri Resmi (Tercatat)' : 'Calon Santri',
      'NIS Resmi': r.siswa?.nis || '-',
      'Tanggal Daftar': r.created_at,
    }));

    exportRowsExcel(
      rows,
      `Data_PMB_Calon_Santri_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'DATA PENERIMAAN SANTRI BARU (PMB)'
    );
    showToast('Data calon santri berhasil diekspor ke Excel!');
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 rounded-2xl text-xs font-black shadow-xl animate-fade-in ${
            toast.type === 'success'
              ? 'bg-[#0D7A6F] text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-[#FFDC80]" /> : <X className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 🌟 HEADER PMB ADMIN DENGAN MASTER TOGGLE PMB */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-[#FFDC80] text-[#0D7A6F] border border-amber-300 flex items-center justify-center shadow-xs">
            {activeTab === 'dashboard' ? (
              <Activity className="w-7 h-7" />
            ) : activeTab === 'applicants' ? (
              <Users className="w-7 h-7" />
            ) : activeTab === 'batches' ? (
              <CalendarRange className="w-7 h-7" />
            ) : activeTab === 'announcements' ? (
              <Megaphone className="w-7 h-7" />
            ) : (
              <Globe className="w-7 h-7" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-[#2D3436] tracking-tight">
                {activeTab === 'dashboard'
                  ? 'Dashboard PMB'
                  : activeTab === 'applicants'
                  ? 'Data Calon Santri PMB'
                  : activeTab === 'batches'
                  ? 'Gelombang Pendaftaran PMB'
                  : activeTab === 'announcements'
                  ? 'Berita & Agenda Santri Baru'
                  : 'CMS Profil Pesantren (WordPress)'}
              </h1>

              {/* Status Sakelar Cerdas PMB */}
              <button
                onClick={() => setPmbToggleModalOpen(true)}
                className={`px-3 py-1 rounded-full text-[11px] font-black border flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                  pmbIsOpen
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                }`}
                title="Klik untuk mengubah status buka/tutup pendaftaran PMB"
              >
                <Power className="w-3.5 h-3.5" />
                <span>{pmbIsOpen ? '🟢 PMB DIBUKA' : '🔴 PMB DITUTUP'}</span>
              </button>

              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#FFDC80] text-[#0D7A6F] border border-amber-300">
                TA 2026/2027
              </span>
            </div>
            <p className="text-xs text-[#636E72] font-medium mt-1">
              {activeTab === 'dashboard'
                ? 'Statistik pendaftaran, kuota gelombang, & pemantauan audit santri baru realtime'
                : activeTab === 'applicants'
                ? 'Audit berkas realtime, tagihan pembayaran, & 1-klik konversi santri resmi masuk ke Buku Induk'
                : activeTab === 'batches'
                ? 'Kelola periode tanggal buka, kuota pendaftaran, & tarif biaya formulir santri baru'
                : activeTab === 'announcements'
                ? 'Kelola tanggal santri wajib hadir, jadwal antar ke asrama, dan pengumuman seleksi resmi'
                : 'Kelola isi website profil pesantren, sejarah 1775 M, visi misi, fasilitas, dan narahubung'}
            </p>
          </div>
        </div>

        {/* Action Buttons: Salin Link & Lihat Web Publik */}
        <div className="flex items-center gap-2 flex-wrap">
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
            title="Buka tampilan landing page profil & formulir publik"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#FFDC80]" />
            <span>Lihat Web PMB Publik</span>
          </button>
        </div>
      </div>

      {/* 🌟 TAB 1: DASHBOARD METRICS */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Top 4 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-xs text-[#636E72] font-bold mb-1">
                <span>Total Pendaftar Realtime</span>
                <Users className="w-4 h-4 text-[#138F81]" />
              </div>
              <div className="text-3xl font-black text-[#2D3436]">{dashboard?.total ?? 0}</div>
              <div className="text-[11px] text-[#0D7A6F] font-bold mt-1">
                +{dashboard?.today ?? 0} calon santri baru hari ini
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-amber-200 shadow-sm">
              <div className="flex items-center justify-between text-xs text-[#D97706] font-bold mb-1">
                <span>Menunggu Audit Panitia</span>
                <ClipboardCheck className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-3xl font-black text-[#D97706]">{dashboard?.pending ?? 0}</div>
              <div className="text-[11px] text-[#636E72] font-medium mt-1">
                Calon santri baru mendaftar (Belum Masuk Buku Induk)
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-blue-200 shadow-sm">
              <div className="flex items-center justify-between text-xs text-blue-600 font-bold mb-1">
                <span>Sedang Diaudit Berkas</span>
                <Activity className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-3xl font-black text-blue-700">{dashboard?.reviewed ?? 0}</div>
              <div className="text-[11px] text-[#636E72] font-medium mt-1">
                Dalam proses verifikasi & pelunasan formulir
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-emerald-200 shadow-sm">
              <div className="flex items-center justify-between text-xs text-[#138F81] font-bold mb-1">
                <span>Diterima Resmi (ACC)</span>
                <CheckCircle2 className="w-4 h-4 text-[#138F81]" />
              </div>
              <div className="text-3xl font-black text-[#138F81]">{dashboard?.accepted ?? 0}</div>
              <div className="text-[11px] text-[#138F81] font-bold mt-1">
                Tercatat resmi di Buku Induk Santri
              </div>
            </div>
          </div>

          {/* Quick Info Bar */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-[#E8F7F3] text-[#138F81]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-black text-[#2D3436]">
                  Alur Seleksi & Penetapan Buku Induk PMB
                </h4>
                <p className="text-xs text-[#636E72] mt-0.5">
                  Santri baru yang mendaftar <strong>tidak langsung masuk ke data santri</strong>, melainkan diaudit dahulu oleh Admin PMB. Saat admin klik <strong>ACC Santri</strong>, santri otomatis resmi masuk Buku Induk dengan histori gelombang dan notifikasi WhatsApp langsung terkirim ke wali.
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('applicants')}
              className="px-5 py-2.5 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white text-xs font-black shrink-0 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <span>Buka Menu Audit Pendaftar</span>
              <ChevronRight className="w-4 h-4 text-[#FFDC80]" />
            </button>
          </div>
        </div>
      )}

      {/* 🌟 TAB 2: DATA CALON SANTRI & AUDIT REALTIME */}
      {activeTab === 'applicants' && (
        <div className="space-y-4">
          {/* Action Header & Filters */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-[#2D3436]">
                  Daftar Calon Santri & Audit Administrasi
                </h3>
                <p className="text-xs text-[#636E72]">
                  Total {totalItems} calon santri terdaftar di sistem.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={loadRegistrations}
                  disabled={isLoadingList}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#2D3436] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
                  <span>Segarkan</span>
                </button>

                <button
                  onClick={handleExportExcel}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#FFDC80]" />
                  <span>Ekspor Excel</span>
                </button>
              </div>
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-1">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setCurrentPage(1);
                      loadRegistrations();
                    }
                  }}
                  placeholder="Cari nama, no reg, kota..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#2D3436] font-medium focus:bg-white focus:outline-none focus:border-[#138F81]"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#2D3436] font-bold focus:bg-white focus:outline-none focus:border-[#138F81]"
              >
                <option value="all">Semua Status Audit</option>
                <option value="pending">Menunggu Audit (Pending)</option>
                <option value="reviewed">Sedang Diaudit (Reviewed)</option>
                <option value="accepted">Diterima Resmi (Accepted)</option>
                <option value="rejected">Perlu Perbaikan (Rejected)</option>
              </select>

              <select
                value={paymentStatusFilter}
                onChange={(e) => {
                  setPaymentStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#2D3436] font-bold focus:bg-white focus:outline-none focus:border-[#138F81]"
              >
                <option value="all">Semua Status Biaya</option>
                <option value="pending">Biaya: Belum Bayar</option>
                <option value="perlu_pelunasan">Biaya: Perlu Pelunasan</option>
                <option value="lunas">Biaya: Lunas</option>
                <option value="gratis">Biaya: Bebas / Beasiswa</option>
              </select>

              <select
                value={genderFilter}
                onChange={(e) => {
                  setGenderFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#2D3436] font-bold focus:bg-white focus:outline-none focus:border-[#138F81]"
              >
                <option value="all">Semua Gender</option>
                <option value="L">Putra (Laki-laki)</option>
                <option value="P">Putri (Perempuan)</option>
              </select>

              <select
                value={batchFilter}
                onChange={(e) => {
                  setBatchFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#2D3436] font-bold focus:bg-white focus:outline-none focus:border-[#138F81]"
              >
                <option value="all">Semua Gelombang</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nama_gelombang}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabel Calon Santri */}
          <div className="rounded-3xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#636E72] font-black uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3.5">No. Reg</th>
                    <th className="px-4 py-3.5">Nama Calon Santri</th>
                    <th className="px-4 py-3.5">Gelombang</th>
                    <th className="px-4 py-3.5">Asal & Jenjang</th>
                    <th className="px-4 py-3.5">Status Audit</th>
                    <th className="px-4 py-3.5">Biaya / Pembayaran</th>
                    <th className="px-4 py-3.5">Status Buku Induk</th>
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
                            <div className="font-bold text-[#2D3436] flex items-center gap-1.5">
                              <span>{item.nama_lengkap}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                                  isL ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                                }`}
                              >
                                {isL ? 'L' : 'P'}
                              </span>
                            </div>
                            <div className="text-[10px] text-[#636E72] font-mono mt-0.5">
                              WA Wali: {item.no_whatsapp_wali}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-50 text-amber-900 border border-amber-200">
                              {item.batch?.nama_gelombang || 'Gelombang 1'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="font-bold text-[#2D3436]">{item.kota || item.asal_sekolah || '-'}</div>
                            <div className="text-[10px] text-[#0D7A6F] font-bold">{item.pilihan_jenjang}</div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
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
                                ? 'Sedang Diaudit'
                                : 'Menunggu'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {item.payment_status === 'lunas' || item.payment_status === 'gratis' ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Lunas (Rp {Number(item.payment_amount || 0).toLocaleString('id-ID')})</span>
                              </span>
                            ) : item.payment_status === 'perlu_pelunasan' ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 flex items-center gap-1 w-fit">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>Perlu Pelunasan</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-600">
                                Belum Bayar
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {isConverted ? (
                              <div className="space-y-0.5">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#138F81] text-white flex items-center gap-1 w-fit">
                                  <CheckCircle2 className="w-3 h-3 text-[#FFDC80]" />
                                  <span>Masuk Buku Induk</span>
                                </span>
                                <div className="text-[10px] font-mono font-bold text-[#0D7A6F]">
                                  NIS: {item.siswa?.nis}
                                </div>
                              </div>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                Calon (Belum Di-ACC)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Tombol Detail Berkas */}
                              <button
                                onClick={() => setDetailItem(item)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#2D3436] transition-colors cursor-pointer"
                                title="Lihat Berkas & Biodata"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Tombol Kirim Ulang WA Akun */}
                              <button
                                onClick={() => handleResendWa(item)}
                                disabled={resendingWaId === item.id}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  item.wa_notif_sent
                                    ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                                    : 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                                }`}
                                title="Kirim Ulang Akun Login Portal via WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </button>

                              {/* Tombol Audit & Pembayaran */}
                              <button
                                onClick={() => handleOpenAuditModal(item)}
                                className="px-2.5 py-1 rounded-lg bg-[#FFDC80] hover:bg-[#ffe59e] text-[#0D7A6F] text-[11px] font-black flex items-center gap-1 transition-colors cursor-pointer"
                                title="Audit Berkas & Atur Biaya / Pelunasan"
                              >
                                <ClipboardCheck className="w-3.5 h-3.5" />
                                <span>Audit</span>
                              </button>

                              {/* Tombol 1-Klik ACC & Konversi ke Siswa */}
                              {!isConverted && (
                                <button
                                  onClick={() => handleOpenConvertModal(item)}
                                  className="px-2.5 py-1 rounded-lg bg-[#138F81] hover:bg-[#0D7A6F] text-white font-black text-[11px] flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                                  title="1-Klik ACC & Otomatis Masuk ke Buku Induk Siswa"
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
            ) : batches.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400">Belum ada gelombang PMB.</div>
            ) : (
              batches.map((batch) => (
                <div
                  key={batch.id}
                  className={`p-5 rounded-3xl bg-white border transition-all shadow-sm space-y-3 ${
                    batch.is_active
                      ? 'border-emerald-300 ring-2 ring-emerald-300/30'
                      : 'border-slate-200/80 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        batch.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {batch.is_active ? 'Aktif Sekarang' : 'Tidak Aktif'}
                    </span>
                    <span className="text-xs font-bold text-[#636E72]">{batch.tahun_akademik}</span>
                  </div>

                  <div>
                    <h4 className="text-base font-black text-[#2D3436]">{batch.nama_gelombang}</h4>
                    <p className="text-xs text-[#636E72] mt-0.5">{batch.keterangan || 'Tidak ada catatan.'}</p>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-slate-200 text-xs space-y-1.5 font-medium">
                    <div className="flex justify-between">
                      <span className="text-[#636E72]">Periode:</span>
                      <strong className="text-[#2D3436]">
                        {new Date(batch.tanggal_mulai).toLocaleDateString('id-ID')} s/d {new Date(batch.tanggal_selesai).toLocaleDateString('id-ID')}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#636E72]">Biaya Formulir:</span>
                      <strong className="text-[#0D7A6F]">
                        Rp {Number(batch.biaya_pendaftaran).toLocaleString('id-ID')}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#636E72]">Kuota Santri:</span>
                      <strong className="text-[#2D3436]">{batch.kuota || 'Tak Terbatas'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#636E72]">Pendaftar Masuk:</span>
                      <strong className="text-[#138F81]">{batch.registrations_count ?? 0} calon santri</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setEditingBatch(batch);
                        setBatchForm({
                          nama_gelombang: batch.nama_gelombang,
                          tahun_akademik: batch.tahun_akademik,
                          tanggal_mulai: batch.tanggal_mulai,
                          tanggal_selesai: batch.tanggal_selesai,
                          biaya_pendaftaran: Number(batch.biaya_pendaftaran),
                          kuota: batch.kuota || 200,
                          is_active: batch.is_active,
                          keterangan: batch.keterangan || '',
                        });
                        setBatchModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#2D3436] text-xs font-bold transition-colors cursor-pointer"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => setBatchToDelete(batch)}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 🌟 TAB 4: BERITA & AGENDA SANTRI BARU */}
      {activeTab === 'announcements' && <PmbAnnouncementsTab />}

      {/* 🌟 TAB 5: CMS WEB PROFIL PESANTREN (WORDPRESS-STYLE) */}
      {activeTab === 'cms' && <PmbCmsTab />}

      {/* 🌟 MODAL AUDIT & PEMBAYARAN FORMULIR */}
      {auditModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white text-[#2D3436] border-2 border-amber-300 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
            <button
              onClick={() => setAuditModalItem(null)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#0D7A6F] bg-[#FFDC80] px-2 py-0.5 rounded-md border border-amber-300">
                  AUDIT REALTIME & PEMBAYARAN
                </span>
                <h3 className="text-base font-black text-[#2D3436] mt-0.5">
                  Audit: {auditModalItem.nama_lengkap} ({auditModalItem.registration_number})
                </h3>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#2D3436] font-bold mb-1">Status Verifikasi Berkas</label>
                  <select
                    value={auditStatus}
                    onChange={(e) => setAuditStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#2D3436] font-bold text-xs outline-none focus:bg-white focus:border-[#138F81]"
                  >
                    <option value="pending">Menunggu Verifikasi (Pending)</option>
                    <option value="reviewed">Sedang Diaudit (Reviewed)</option>
                    <option value="accepted">Lolos Verifikasi / Diterima</option>
                    <option value="rejected">Perlu Perbaikan Berkas (Rejected)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#2D3436] font-bold mb-1">Status Pembayaran Biaya/Formulir</label>
                  <select
                    value={auditPaymentStatus}
                    onChange={(e) => setAuditPaymentStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#2D3436] font-bold text-xs outline-none focus:bg-white focus:border-[#138F81]"
                  >
                    <option value="pending">Belum Bayar (Pending)</option>
                    <option value="perlu_pelunasan">Perlu Pelunasan</option>
                    <option value="lunas">LUNAS Terverifikasi</option>
                    <option value="gratis">Bebas Biaya / Beasiswa</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#2D3436] font-bold mb-1">Nominal Tagihan Biaya Formulir (Rp)</label>
                <input
                  type="number"
                  value={auditPaymentAmount}
                  onChange={(e) => setAuditPaymentAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#2D3436] font-mono font-bold text-xs outline-none focus:bg-white focus:border-[#138F81]"
                />
              </div>

              <div>
                <label className="block text-[#2D3436] font-bold mb-1">Catatan Hasil Audit untuk Wali</label>
                <textarea
                  rows={2}
                  value={auditAdminNote}
                  onChange={(e) => setAuditAdminNote(e.target.value)}
                  placeholder="Misal: Berkas identitas lengkap, silakan lanjutkan pelunasan biaya..."
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#2D3436] text-xs outline-none focus:bg-white focus:border-[#138F81]"
                />
              </div>

              <div>
                <label className="block text-[#2D3436] font-bold mb-1">Instruksi Rekening & Pembayaran</label>
                <textarea
                  rows={2}
                  value={auditPaymentNotes}
                  onChange={(e) => setAuditPaymentNotes(e.target.value)}
                  placeholder="Misal: Transfer ke BSI 1234-5678-90 a.n Ponpes Qomaruddin PMB, atau bayar tunai di posko."
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#2D3436] text-xs outline-none focus:bg-white focus:border-[#138F81]"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <label className="flex items-center gap-2 font-bold text-[#2D3436] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={auditSendWa}
                    onChange={(e) => setAuditSendWa(e.target.checked)}
                    className="w-4 h-4 rounded text-[#138F81] focus:ring-[#138F81]"
                  />
                  <span>Kirim Notifikasi Update Audit & Instruksi Pembayaran ke WhatsApp Wali ({auditModalItem.no_whatsapp_wali})</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAuditModalItem(null)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveAudit}
                  disabled={isSavingAudit}
                  className="px-6 py-2.5 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white font-black shadow-md flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSavingAudit ? <RefreshCw className="w-4 h-4 animate-spin text-[#FFDC80]" /> : <Check className="w-4 h-4 text-[#FFDC80]" />}
                  <span>Simpan Hasil Audit</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL ACC & KONVERSI MENJADI SANTRI RESMI (BUKU INDUK SANTRI) */}
      {convertModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
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
                  PENETAPAN RESMI SANTRI BUKU INDUK
                </span>
                <h3 className="text-base font-black text-[#2D3436] mt-0.5">
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
                    Data otomatis tercatat di Buku Induk Santri lengkap dengan histori gelombang pendaftaran.
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-left space-y-1">
                  <div className="font-bold text-[#2D3436] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#138F81]" />
                    <span>Surat Penerimaan Resmi Dikirim ke WhatsApp Wali!</span>
                  </div>
                  <div className="text-slate-600 pt-1">
                    No. Tujuan: <strong className="text-[#0D7A6F] font-mono">{convertModalItem.no_whatsapp_wali}</strong>
                  </div>
                </div>

                <button
                  onClick={() => setConvertModalItem(null)}
                  className="w-full py-3 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white font-black text-xs shadow-md cursor-pointer"
                >
                  Selesai & Tutup
                </button>
              </div>
            ) : (
              /* Form Convert */
              <div className="space-y-4 text-xs">
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 leading-relaxed font-medium">
                  Santri ini terdaftar via <strong>{convertModalItem.batch?.nama_gelombang || 'Gelombang 1'}</strong>. Setelah di-ACC, data akan otomatis masuk ke <strong>Buku Induk Santri (tabel siswa)</strong>, dan sistem akan langsung mengirimkan surat kelulusan resmi via WhatsApp ke nomor wali.
                </div>

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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#2D3436] font-bold mb-1">
                      Penempatan Kelas Madin (Opsional)
                    </label>
                    <select
                      value={convertForm.class_id}
                      onChange={(e) => setConvertForm(prev => ({ ...prev, class_id: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#2D3436] text-xs outline-none focus:bg-white focus:border-[#138F81]"
                    >
                      <option value="">-- Tentukan Nanti --</option>
                      {classesList.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#2D3436] font-bold mb-1">
                      Penempatan Kamar Asrama (Opsional)
                    </label>
                    <select
                      value={convertForm.boarding_room_id}
                      onChange={(e) => setConvertForm(prev => ({ ...prev, boarding_room_id: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#2D3436] text-xs outline-none focus:bg-white focus:border-[#138F81]"
                    >
                      <option value="">-- Tentukan Nanti --</option>
                      {roomsList.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[#2D3436] font-bold mb-1">Catatan Penerimaan</label>
                  <input
                    type="text"
                    value={convertForm.catatan_admin}
                    onChange={(e) => setConvertForm(prev => ({ ...prev, catatan_admin: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#2D3436] text-xs outline-none focus:bg-white focus:border-[#138F81]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setConvertModalItem(null)}
                    className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteConvert}
                    disabled={isConverting}
                    className="px-6 py-2.5 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white font-black shadow-md flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isConverting ? <RefreshCw className="w-4 h-4 animate-spin text-[#FFDC80]" /> : <Check className="w-4 h-4 text-[#FFDC80]" />}
                    <span>{isConverting ? 'Mengonversi...' : 'ACC & Konversi Sekarang'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🌟 MODAL DETAIL BERKAS & BIODATA */}
      {detailItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-[#2D3436] border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
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
                <span className="text-[10px] font-black uppercase tracking-wider text-[#0D7A6F] bg-[#FFDC80] px-2 py-0.5 rounded-md border border-amber-300">
                  DETAIL LENGKAP PENDAFTAR
                </span>
                <h3 className="text-base font-black text-[#2D3436] mt-0.5">
                  {detailItem.nama_lengkap} ({detailItem.registration_number})
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-6">
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-2">
                <div className="font-black text-[#138F81] border-b border-slate-200 pb-1">Biodata Calon Santri</div>
                <div><span className="text-slate-500">Nama Lengkap:</span> <strong className="text-[#2D3436]">{detailItem.nama_lengkap}</strong></div>
                <div><span className="text-slate-500">Jenis Kelamin:</span> <strong className="text-[#2D3436]">{detailItem.jenis_kelamin === 'L' ? 'Laki-laki (Putra)' : 'Perempuan (Putri)'}</strong></div>
                <div><span className="text-slate-500">Tempat, Tgl Lahir:</span> <strong className="text-[#2D3436]">{detailItem.tempat_lahir || '-'}, {detailItem.tanggal_lahir || '-'}</strong></div>
                <div><span className="text-slate-500">NIK:</span> <strong className="text-[#2D3436] font-mono">{detailItem.nik || '-'}</strong></div>
                <div><span className="text-slate-500">NISN:</span> <strong className="text-[#2D3436] font-mono">{detailItem.nisn || '-'}</strong></div>
                <div><span className="text-slate-500">Asal Sekolah:</span> <strong className="text-[#2D3436]">{detailItem.asal_sekolah || '-'}</strong></div>
                <div><span className="text-slate-500">Kota Asal:</span> <strong className="text-[#2D3436]">{detailItem.kota || '-'}</strong></div>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-2">
                <div className="font-black text-[#138F81] border-b border-slate-200 pb-1">Wali & Akun Portal PMB</div>
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
                    <span>{resendingWaId === detailItem.id ? 'Mengirim Pesan...' : 'Kirim Ulang Akun via WA'}</span>
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

                {detailItem.dokumen_ijazah ? (
                  <a
                    href={detailItem.dokumen_ijazah}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-[#FFDC80] hover:bg-[#ffe59e] text-[#0D7A6F] font-bold border border-amber-300 flex items-center gap-1.5 transition-colors"
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Lihat Ijazah / SKL</span>
                  </a>
                ) : null}
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
                  className="px-5 py-2.5 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white font-black shadow-md cursor-pointer"
                >
                  Simpan Gelombang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🌟 MODAL KONFIRMASI TOGGLE PMB BUKA / TUTUP */}
      {pmbToggleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white text-[#2D3436] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border-2 border-amber-300 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${
                pmbIsOpen ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
              }`}>
                <Power className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#2D3436]">
                  {pmbIsOpen ? 'Tutup Pendaftaran PMB?' : 'Buka Pendaftaran PMB?'}
                </h3>
                <p className="text-xs text-[#636E72] mt-0.5">
                  {pmbIsOpen
                    ? 'Formulir online akan ditutup dan calon santri tidak bisa mendaftar.'
                    : 'Formulir online akan aktif kembali dan calon santri dapat mendaftar.'}
                </p>
              </div>
            </div>

            {pmbIsOpen && (
              <div>
                <label className="block text-xs font-bold text-[#2D3436] mb-1">
                  Pesan Pemberitahuan untuk Pengunjung Web Publik:
                </label>
                <textarea
                  rows={3}
                  value={closedMessageInput}
                  onChange={(e) => setClosedMessageInput(e.target.value)}
                  placeholder="Contoh: Pendaftaran PMB Gelombang ini telah resmi ditutup. Nantikan pembukaan gelombang berikutnya..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-[#2D3436] focus:bg-white focus:outline-none focus:border-[#138F81]"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPmbToggleModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#2D3436] text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isTogglingPmb}
                onClick={() => handleTogglePmbDirect(!pmbIsOpen)}
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-black shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 ${
                  pmbIsOpen
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
                }`}
              >
                {isTogglingPmb ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                <span>{pmbIsOpen ? 'Ya, Tutup Pendaftaran' : 'Ya, Buka Pendaftaran'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL KONFIRMASI HAPUS MODERN */}
      {batchToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white text-[#2D3436] rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border-2 border-rose-200 text-center animate-in zoom-in-95 duration-200">
            <div className="h-16 w-16 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-4 shadow-xs">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-[#2D3436] mb-1.5">
              Hapus Gelombang PMB?
            </h3>
            <p className="text-xs text-[#636E72] leading-relaxed mb-6 font-medium">
              Apakah Anda yakin ingin menghapus gelombang <strong className="text-[#2D3436]">"{batchToDelete.nama_gelombang}"</strong>? Data gelombang yang dihapus tidak dapat dipulihkan.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={isDeletingBatch}
                onClick={() => setBatchToDelete(null)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#2D3436] text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeletingBatch}
                onClick={handleExecuteDeleteBatch}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeletingBatch ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
