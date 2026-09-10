import {
  AlertCircle,
  AlertTriangle,
  Award,
  BookOpen,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  Edit,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  Gavel,
  History,
  Image as ImageIcon,
  Layers,
  Plus,
  PlusCircle,
  Printer,
  RefreshCw,
  Save,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  Users,
  Wallet,
  X,
  Zap
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ToastNotification } from '../components/ToastNotification';
import { api, type ApiRecord } from '../services/api';
import qomaruddinLogo from '../assets/logo-qomaruddin.png';
import { getTodayDateString } from '../utils/formatters';

interface PelanggaranItem extends ApiRecord {
  id: number;
  siswa_id: number;
  tanggal: string;
  waktu: string | null;
  kategori_id: number | null;
  judul_pelanggaran: string;
  tingkat: 'Ringan' | 'Sedang' | 'Berat';
  poin: number;
  denda: number;
  status_denda: 'tidak_ada' | 'belum_dibayar' | 'lunas';
  keterangan: string | null;
  tindakan_takzir: string | null;
  bukti_foto: string | null;
  bukti_foto_url: string | null;
  nama_petugas: string | null;
  status_peringatan: 'normal' | 'sp1' | 'sp2' | 'panggilan_ortu';
  surat_panggilan_nomor: string | null;
  surat_panggilan_diterbitkan_at: string | null;
  siswa?: {
    id: number;
    nama: string;
    nis: string;
    kelas: string;
    komplek: string;
    kamar: string;
  };
  kategori?: {
    id: number;
    nama_pelanggaran: string;
    tingkat: string;
    poin_default: number;
  };
}

interface PelanggaranCategoryItem extends ApiRecord {
  id: number;
  nama_pelanggaran: string;
  tingkat: 'Ringan' | 'Sedang' | 'Berat';
  poin_default: number;
  denda_default: number;
  tindakan_rekomendasi: string | null;
}

interface CriticalStudentItem {
  siswa_id: number;
  nama: string;
  nis: string;
  kelas: string;
  asrama: string;
  total_poin: number;
  total_kasus: number;
  is_over_threshold: boolean;
}

export function PelanggaranPage() {
  const { session } = useAuth();

  // Active View Tab
  const [activeTab, setActiveTab] = useState<'log' | 'kritis' | 'kategori' | 'settings'>('log');

  // Main Data States
  const [loading, setLoading] = useState(true);
  const [pelanggaranList, setPelanggaranList] = useState<PelanggaranItem[]>([]);
  const [categories, setCategories] = useState<PelanggaranCategoryItem[]>([]);
  const [stats, setStats] = useState<ApiRecord | null>(null);
  const [students, setStudents] = useState<ApiRecord[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTingkat, setFilterTingkat] = useState<string>('all');
  const [filterDenda, setFilterDenda] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Toast State
  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({
    show: false,
    type: 'success',
    title: '',
    message: ''
  });

  // Modal 1: Input / Edit Pelanggaran
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Form Fields
  const [formSiswaId, setFormSiswaId] = useState<number | ''>('');
  const [formSiswaSearch, setFormSiswaSearch] = useState('');
  const [formTanggal, setFormTanggal] = useState<string>(getTodayDateString());
  const [formWaktu, setFormWaktu] = useState<string>('');
  const [formKategoriId, setFormKategoriId] = useState<number | ''>('');
  const [formJudul, setFormJudul] = useState('');
  const [formTingkat, setFormTingkat] = useState<'Ringan' | 'Sedang' | 'Berat'>('Ringan');
  const [formPoin, setFormPoin] = useState<number>(10);
  const [formDenda, setFormDenda] = useState<number>(0);
  const [formStatusDenda, setFormStatusDenda] = useState<'tidak_ada' | 'belum_dibayar' | 'lunas'>('tidak_ada');
  const [formTakzir, setFormTakzir] = useState('');
  const [formKeterangan, setFormKeterangan] = useState('');
  const [formBuktiFile, setFormBuktiFile] = useState<File | null>(null);
  const [formBuktiPreview, setFormBuktiPreview] = useState<string | null>(null);

  // Modal 2: Settings Threshold
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingThreshold, setSettingThreshold] = useState<number>(100);
  const [settingEnableDenda, setSettingEnableDenda] = useState<boolean>(true);
  const [settingTitle, setSettingTitle] = useState<string>('SURAT PANGGILAN WALI SANTRI');
  const [settingBody, setSettingBody] = useState<string>('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Modal 3: Master Kategori Form
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catTingkat, setCatTingkat] = useState<'Ringan' | 'Sedang' | 'Berat'>('Ringan');
  const [catPoin, setCatPoin] = useState<number>(10);
  const [catDenda, setCatDenda] = useState<number>(0);
  const [catTakzir, setCatTakzir] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  // Modal 4: Surat Panggilan & Print Preview
  const [activeSuratItem, setActiveSuratItem] = useState<PelanggaranItem | null>(null);
  const [isSuratModalOpen, setIsSuratModalOpen] = useState(false);
  const [issuingSurat, setIssuingSurat] = useState(false);

  // Modal 5: Photo Preview Modal
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Load All Initial Data
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [pRes, sRes, cRes, stRes, setRes] = await Promise.all([
        api.getPelanggaran({
          per_page: 200,
          tingkat: filterTingkat !== 'all' ? filterTingkat : undefined,
          status_denda: filterDenda !== 'all' ? filterDenda : undefined,
          tanggal_mulai: filterStartDate || undefined,
          tanggal_akhir: filterEndDate || undefined,
          search: searchQuery || undefined
        }),
        api.getPelanggaranStats(),
        api.getPelanggaranKategori(),
        api.siswa({ status: 'Aktif', per_page: 500 }),
        api.getPelanggaranSettings()
      ]);

      setPelanggaranList((pRes.data as unknown as PelanggaranItem[]) || []);
      setStats((sRes.data as unknown as ApiRecord) || null);
      setCategories((cRes.data as unknown as PelanggaranCategoryItem[]) || []);
      setStudents((stRes.data as unknown as ApiRecord[]) || []);

      if (setRes.data && typeof setRes.data === 'object') {
        const s = setRes.data as any;
        setSettingThreshold(Number(s.warning_threshold_points || 100));
        setSettingEnableDenda(Boolean(s.enable_denda));
        setSettingTitle(String(s.surat_template_title || 'SURAT PANGGILAN WALI SANTRI'));
        setSettingBody(String(s.surat_template_body || ''));
      }
    } catch (err) {
      setToast({
        show: true,
        type: 'error',
        title: 'Gagal Memuat Data',
        message: err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat data pelanggaran.'
      });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [filterTingkat, filterDenda, filterStartDate, filterEndDate]);

  // Handle Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Open Form for New Violation
  const handleOpenCreateModal = (prefillSiswaId?: number) => {
    setIsEditing(false);
    setEditId(null);
    setFormSiswaId(prefillSiswaId || '');
    setFormSiswaSearch('');
    setFormTanggal(getTodayDateString());
    setFormWaktu(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    setFormKategoriId('');
    setFormJudul('');
    setFormTingkat('Ringan');
    setFormPoin(10);
    setFormDenda(0);
    setFormStatusDenda('tidak_ada');
    setFormTakzir('');
    setFormKeterangan('');
    setFormBuktiFile(null);
    setFormBuktiPreview(null);
    setIsModalOpen(true);
  };

  // Open Form for Edit Violation
  const handleOpenEditModal = (item: PelanggaranItem) => {
    setIsEditing(true);
    setEditId(item.id);
    setFormSiswaId(item.siswa_id);
    setFormSiswaSearch(item.siswa?.nama || '');
    setFormTanggal(String(item.tanggal).substring(0, 10));
    setFormWaktu(item.waktu || '');
    setFormKategoriId(item.kategori_id || '');
    setFormJudul(item.judul_pelanggaran);
    setFormTingkat(item.tingkat);
    setFormPoin(Number(item.poin));
    setFormDenda(Number(item.denda || 0));
    setFormStatusDenda(item.status_denda || 'tidak_ada');
    setFormTakzir(item.tindakan_takzir || '');
    setFormKeterangan(item.keterangan || '');
    setFormBuktiFile(null);
    setFormBuktiPreview(item.bukti_foto_url || null);
    setIsModalOpen(true);
  };

  // Auto-fill fields when selecting category
  const handleCategoryChange = (catId: number | '') => {
    setFormKategoriId(catId);
    if (!catId) return;
    const cat = categories.find((c) => c.id === catId);
    if (cat) {
      setFormJudul(cat.nama_pelanggaran);
      setFormTingkat(cat.tingkat);
      setFormPoin(cat.poin_default);
      setFormDenda(Number(cat.denda_default || 0));
      setFormStatusDenda(Number(cat.denda_default || 0) > 0 ? 'belum_dibayar' : 'tidak_ada');
      setFormTakzir(cat.tindakan_rekomendasi || '');
    }
  };

  // Handle Photo File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormBuktiFile(file);
      const url = URL.createObjectURL(file);
      setFormBuktiPreview(url);
    }
  };

  // Save Violation (Create or Update)
  const handleSavePelanggaran = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSiswaId) {
      setToast({
        show: true,
        type: 'warning',
        title: 'Pilih Santri',
        message: 'Silakan pilih santri yang melakukan pelanggaran.'
      });
      return;
    }
    if (!formJudul.trim()) {
      setToast({
        show: true,
        type: 'warning',
        title: 'Judul Wajib Diisi',
        message: 'Mohon isi nama atau uraian pelanggaran.'
      });
      return;
    }

    setFormSubmitting(true);
    try {
      if (isEditing && editId) {
        await api.updatePelanggaran(editId, {
          tanggal: formTanggal,
          waktu: formWaktu,
          kategori_id: formKategoriId || null,
          judul_pelanggaran: formJudul,
          tingkat: formTingkat,
          poin: formPoin,
          denda: formDenda,
          status_denda: formStatusDenda,
          tindakan_takzir: formTakzir,
          keterangan: formKeterangan
        });
        setToast({
          show: true,
          type: 'success',
          title: 'Pelanggaran Diperbarui',
          message: 'Data pelanggaran santri berhasil disimpan.'
        });
      } else {
        const payload: any = {
          siswa_id: Number(formSiswaId),
          tanggal: formTanggal,
          waktu: formWaktu,
          kategori_id: formKategoriId ? Number(formKategoriId) : undefined,
          judul_pelanggaran: formJudul,
          tingkat: formTingkat,
          poin: Number(formPoin),
          denda: Number(formDenda),
          status_denda: formStatusDenda,
          tindakan_takzir: formTakzir,
          keterangan: formKeterangan,
          bukti_foto: formBuktiFile || undefined
        };
        const res = await api.createPelanggaran(payload);
        setToast({
          show: true,
          type: 'success',
          title: 'Pelanggaran Tercatat!',
          message: `Pelanggaran santri berhasil dicatat (+${formPoin} Poin) dan notifikasi terkirim ke Wali Santri.`
        });
      }
      setIsModalOpen(false);
      void loadData(true);
    } catch (err) {
      setToast({
        show: true,
        type: 'error',
        title: 'Gagal Menyimpan',
        message: err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan pelanggaran.'
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Violation
  const handleDeletePelanggaran = async (id: number, namaSantri: string) => {
    if (!window.confirm(`Yakin ingin menghapus catatan pelanggaran santri ${namaSantri}? Poin akan otomatis dikurangi kembali.`)) {
      return;
    }
    try {
      await api.deletePelanggaran(id);
      setToast({
        show: true,
        type: 'success',
        title: 'Pelanggaran Dihapus',
        message: 'Catatan pelanggaran santri berhasil dihapus.'
      });
      void loadData(true);
    } catch (err) {
      setToast({
        show: true,
        type: 'error',
        title: 'Gagal Menghapus',
        message: err instanceof Error ? err.message : 'Gagal menghapus pelanggaran.'
      });
    }
  };

  // Mark Fine Paid
  const handleBayarDenda = async (id: number) => {
    try {
      await api.bayarDendaPelanggaran(id);
      setToast({
        show: true,
        type: 'success',
        title: 'Denda Dilunaskan',
        message: 'Status denda santri berhasil diubah menjadi LUNAS.'
      });
      void loadData(true);
    } catch (err) {
      setToast({
        show: true,
        type: 'error',
        title: 'Gagal Memperbarui Denda',
        message: err instanceof Error ? err.message : 'Gagal melunaskan denda.'
      });
    }
  };

  // Issue Calling Letter
  const handleTerbitkanSurat = async (item: PelanggaranItem) => {
    if (!window.confirm(`Terbitkan Surat Panggilan Resmi untuk Wali Santri dari ${item.siswa?.nama}? Sistem akan mengirim notifikasi darurat ke akun Wali Santri.`)) {
      return;
    }
    setIssuingSurat(true);
    try {
      const res = await api.terbitkanSuratPanggilan(item.id);
      setToast({
        show: true,
        type: 'success',
        title: 'Surat Panggilan Diterbitkan!',
        message: 'Surat panggilan resmi telah diterbitkan dan dikirim ke Wali Santri.'
      });
      void loadData(true);
      if (res.data) {
        setActiveSuratItem(res.data as unknown as PelanggaranItem);
        setIsSuratModalOpen(true);
      }
    } catch (err) {
      setToast({
        show: true,
        type: 'error',
        title: 'Gagal Menerbitkan Surat',
        message: err instanceof Error ? err.message : 'Terjadi kesalahan saat menerbitkan surat panggilan.'
      });
    } finally {
      setIssuingSurat(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.updatePelanggaranSettings({
        warning_threshold_points: Number(settingThreshold),
        enable_denda: Boolean(settingEnableDenda),
        surat_template_title: settingTitle,
        surat_template_body: settingBody
      });
      setToast({
        show: true,
        type: 'success',
        title: 'Pengaturan Disimpan',
        message: 'Ambang batas poin peringatan dan konfigurasi berhasil diperbarui.'
      });
      setIsSettingsModalOpen(false);
      void loadData(true);
    } catch (err) {
      setToast({
        show: true,
        type: 'error',
        title: 'Gagal Menyimpan Pengaturan',
        message: err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan pengaturan.'
      });
    } finally {
      setSavingSettings(false);
    }
  };

  // Save Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setSavingCat(true);
    try {
      await api.storePelanggaranKategori({
        nama_pelanggaran: catName,
        tingkat: catTingkat,
        poin_default: Number(catPoin),
        denda_default: Number(catDenda),
        tindakan_rekomendasi: catTakzir
      });
      setToast({
        show: true,
        type: 'success',
        title: 'Kategori Berhasil Ditambahkan',
        message: `Kategori "${catName}" siap digunakan saat mencatat pelanggaran.`
      });
      setCatName('');
      setCatTakzir('');
      setIsCategoryModalOpen(false);
      void loadData(true);
    } catch (err) {
      setToast({
        show: true,
        type: 'error',
        title: 'Gagal Menambah Kategori',
        message: err instanceof Error ? err.message : 'Terjadi kesalahan.'
      });
    } finally {
      setSavingCat(false);
    }
  };

  // Filtered Students for Select
  const filteredStudents = useMemo(() => {
    if (!formSiswaSearch.trim()) return students.slice(0, 30);
    const q = formSiswaSearch.toLowerCase();
    return students
      .filter((s) => {
        const nama = String(s.nama || '').toLowerCase();
        const nis = String(s.nis || '').toLowerCase();
        const kelas = String(s.kelas || '').toLowerCase();
        const kamar = String(s.kamar || '').toLowerCase();
        return nama.includes(q) || nis.includes(q) || kelas.includes(q) || kamar.includes(q);
      })
      .slice(0, 30);
  }, [students, formSiswaSearch]);

  const selectedStudentObj = useMemo(() => {
    return students.find((s) => Number(s.id) === Number(formSiswaId));
  }, [students, formSiswaId]);

  // Santri Kritis List
  const santriKritisList = useMemo<CriticalStudentItem[]>(() => {
    return Array.isArray(stats?.santri_kritis) ? (stats?.santri_kritis as CriticalStudentItem[]) : [];
  }, [stats]);

  return (
    <div className="space-y-6">
      {/* Universal Floating Toast Notification */}
      {toast.show && (
        <ToastNotification
          show={toast.show}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          onClose={() => setToast((prev) => ({ ...prev, show: false }))}
        />
      )}

      {/* 🌟 HERO HEADER BANNER KEDISIPLINAN */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0D7A6F] p-6 sm:p-8 text-white shadow-xl shadow-slate-950/20 border border-slate-700/50">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-[#138F81]/15 blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 bottom-0 -mb-12 h-44 w-44 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-300 border border-emerald-400/30 backdrop-blur-md">
                <ShieldCheck size={14} /> Biro Keamanan & Ketertiban Santri
              </span>
              <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-black text-amber-300 border border-amber-400/30">
                Pondok Pesantren Qomaruddin
              </span>
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              Pusat Pengawasan Kedisiplinan & Pelanggaran
            </h1>
            <p className="mt-2 text-xs sm:text-sm font-medium text-slate-300 max-w-2xl leading-relaxed">
              Pencatatan pelanggaran santri, akumulasi poin kedisiplinan otomatis, tindakan takzir edukatif, penerbitan surat panggilan wali santri resmi, dan integrasi notifikasi real-time ke orang tua.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenCreateModal()}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] px-5 py-3 text-xs sm:text-sm font-black text-white shadow-lg shadow-[#138F81]/30 transition transform active:scale-95 cursor-pointer"
            >
              <PlusCircle size={18} />
              <span>+ Catat Pelanggaran</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 px-4 py-3 text-xs sm:text-sm font-bold text-white transition backdrop-blur-md cursor-pointer"
              title="Atur Ambang Batas Poin Peringatan"
            >
              <ShieldAlert size={16} className="text-amber-300" />
              <span className="hidden sm:inline">Batas Poin:</span>
              <strong className="text-amber-300">{settingThreshold} Poin</strong>
            </button>

            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition cursor-pointer"
              title="Muat Ulang Data"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </section>

      {/* 📊 4 KARTU METRIK STATISTIK EKSEKUTIF */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* KARTU 1: KASUS BULAN INI */}
        <div className="rounded-3xl bg-white p-5 border border-slate-200/80 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kasus Bulan Ini</span>
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Calendar size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-800 mt-2">
            {Number(stats?.total_kasus_bulan_ini ?? 0)}
          </p>
          <p className="text-[11px] font-semibold text-slate-400 mt-1">
            Total semua kasus: <b>{Number(stats?.total_kasus_semua ?? 0)}</b>
          </p>
        </div>

        {/* KARTU 2: SANTRI PERLU PANGGILAN (OVER THRESHOLD) */}
        <div className={`rounded-3xl p-5 border transition shadow-sm ${
          Number(stats?.total_santri_over_threshold ?? 0) > 0
            ? 'bg-rose-50/80 border-rose-200 ring-2 ring-rose-300/40 animate-pulse'
            : 'bg-white border-slate-200/80'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${
              Number(stats?.total_santri_over_threshold ?? 0) > 0 ? 'text-rose-700' : 'text-slate-500'
            }`}>
              Perlu Panggilan Wali
            </span>
            <div className={`grid h-10 w-10 place-items-center rounded-2xl ${
              Number(stats?.total_santri_over_threshold ?? 0) > 0 ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <p className={`text-3xl font-black mt-2 ${
            Number(stats?.total_santri_over_threshold ?? 0) > 0 ? 'text-rose-700' : 'text-slate-800'
          }`}>
            {Number(stats?.total_santri_over_threshold ?? 0)}
          </p>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">
            Akumulasi &ge; {settingThreshold} Poin
          </p>
        </div>

        {/* KARTU 3: TOTAL SANTRI TERCATAT POIN */}
        <div className="rounded-3xl bg-white p-5 border border-slate-200/80 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Santri Kena Poin</span>
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-50 text-amber-600">
              <Users size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-800 mt-2">
            {Number(stats?.total_santri_tercatat ?? 0)}
          </p>
          <p className="text-[11px] font-semibold text-amber-600 mt-1">
            Santri memiliki rekam poin aktif
          </p>
        </div>

        {/* KARTU 4: TOTAL DENDA TERCATAT / LUNAS */}
        <div className="rounded-3xl bg-white p-5 border border-slate-200/80 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Denda Belum Lunas</span>
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-50 text-[#138F81]">
              <Wallet size={18} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[#138F81] mt-2">
            Rp {Number(stats?.total_denda_belum_lunas ?? 0).toLocaleString('id-ID')}
          </p>
          <p className="text-[11px] font-semibold text-slate-400 mt-1">
            Lunas: Rp {Number(stats?.total_denda_lunas ?? 0).toLocaleString('id-ID')}
          </p>
        </div>
      </section>

      {/* 🧭 NAVIGATION TABS */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'log', label: '⚡ Riwayat Pelanggaran', icon: History, count: pelanggaranList.length },
            { id: 'kritis', label: '🚨 Santri Kritis & Panggilan Wali', icon: AlertTriangle, count: santriKritisList.length },
            { id: 'kategori', label: '📚 Master Kategori Pelanggaran', icon: BookOpen, count: categories.length },
            { id: 'settings', label: '⚙️ Aturan & Ambang Batas Poin', icon: ShieldAlert, count: null },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-black rounded-2xl transition whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/25'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    active ? 'bg-[#FFDC80] text-[#0D7A6F]' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Action Button */}
        {activeTab === 'kategori' && (
          <button
            type="button"
            onClick={() => {
              setCatName('');
              setCatTingkat('Ringan');
              setCatPoin(10);
              setCatDenda(0);
              setCatTakzir('');
              setIsCategoryModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition cursor-pointer"
          >
            <Plus size={15} /> Tambah Kategori
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LOG & RIWAYAT PELANGGARAN SANTRI */}
      {/* ========================================================================= */}
      {activeTab === 'log' && (
        <div className="space-y-4">
          {/* SEARCH & FILTER TOOLBAR */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex-1 min-w-[260px] relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama santri, NIS, kelas, komplek, judul pelanggaran..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#138F81] focus:bg-white transition"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Tingkat */}
              <select
                value={filterTingkat}
                onChange={(e) => setFilterTingkat(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-[#138F81] transition cursor-pointer"
              >
                <option value="all">Semua Tingkat</option>
                <option value="Ringan">🟡 Ringan (5-15 Poin)</option>
                <option value="Sedang">🟠 Sedang (20-45 Poin)</option>
                <option value="Berat">🔴 Berat (50+ Poin)</option>
              </select>

              {/* Filter Denda */}
              <select
                value={filterDenda}
                onChange={(e) => setFilterDenda(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-[#138F81] transition cursor-pointer"
              >
                <option value="all">Semua Status Denda</option>
                <option value="belum_dibayar">⚠️ Denda Belum Lunas</option>
                <option value="lunas">✅ Denda Lunas</option>
                <option value="tidak_ada">Tanpa Denda</option>
              </select>

              {/* Reset Filter */}
              {(filterTingkat !== 'all' || filterDenda !== 'all' || searchQuery || filterStartDate || filterEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterTingkat('all');
                    setFilterDenda('all');
                    setSearchQuery('');
                    setFilterStartDate('');
                    setFilterEndDate('');
                  }}
                  className="px-3 py-2 rounded-2xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {/* TABEL PELANGGARAN */}
          <div className="overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-black tracking-wider">
                  <tr>
                    <th className="py-4 px-4 sm:px-6">Santri</th>
                    <th className="py-4 px-4">Waktu Kejadian</th>
                    <th className="py-4 px-4">Pelanggaran</th>
                    <th className="py-4 px-4 text-center">Poin</th>
                    <th className="py-4 px-4">Tindakan / Takzir</th>
                    <th className="py-4 px-4">Denda</th>
                    <th className="py-4 px-4">Petugas</th>
                    <th className="py-4 px-4 sm:px-6 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400">
                        <RefreshCw className="mx-auto mb-2 animate-spin text-[#138F81]" size={28} />
                        <p className="font-bold text-slate-600">Memuat data kedisiplinan santri...</p>
                      </td>
                    </tr>
                  ) : pelanggaranList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400">
                        <ShieldCheck className="mx-auto mb-2 text-emerald-500" size={38} />
                        <p className="font-bold text-slate-700 text-base">Tidak ada catatan pelanggaran ditemukan.</p>
                        <p className="text-xs text-slate-400 mt-1">Santri aman, disiplin, dan tertib sesuai tata tertib pondok.</p>
                      </td>
                    </tr>
                  ) : (
                    pelanggaranList.map((item) => {
                      const tingkatBadge =
                        item.tingkat === 'Berat'
                          ? 'bg-rose-100 text-rose-800 border-rose-200'
                          : item.tingkat === 'Sedang'
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-sky-100 text-sky-800 border-sky-200';

                      const dendaNominal = Number(item.denda || 0);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition">
                          {/* SANTRI */}
                          <td className="py-4 px-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#E1EFF7] text-[#138F81] font-black text-sm">
                                {item.siswa?.nama ? item.siswa.nama.charAt(0).toUpperCase() : 'S'}
                              </div>
                              <div className="min-w-0">
                                <p className="font-black text-slate-900 truncate">
                                  {item.siswa?.nama || 'Santri Terdaftar'}
                                </p>
                                <p className="text-slate-500 text-xs mt-0.5">
                                  NIS: <b>{item.siswa?.nis || '-'}</b> • Kelas: {item.siswa?.kelas || '-'}
                                </p>
                                <p className="text-slate-400 text-[11px]">
                                  {item.siswa?.komplek ? `${item.siswa.komplek} - Kamar ${item.siswa.kamar}` : '-'}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* WAKTU KEJADIAN */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <p className="font-bold text-slate-800">{item.tanggal}</p>
                            <p className="text-slate-400 text-xs font-mono">{item.waktu || '-'}</p>
                          </td>

                          {/* PELANGGARAN & TINGKAT */}
                          <td className="py-4 px-4 min-w-[200px]">
                            <div className="flex items-center gap-2">
                              <span className={`inline-block px-2 py-0.5 text-[10px] font-black uppercase rounded-md border ${tingkatBadge}`}>
                                {item.tingkat}
                              </span>
                            </div>
                            <p className="font-extrabold text-slate-800 mt-1">
                              {item.judul_pelanggaran}
                            </p>
                            {item.keterangan && (
                              <p className="text-slate-500 text-xs mt-0.5 line-clamp-2">
                                {item.keterangan}
                              </p>
                            )}
                          </td>

                          {/* POIN PELANGGARAN */}
                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-900 text-white font-black text-xs shadow-xs">
                              <Zap size={12} className="text-amber-400" />
                              +{item.poin} Poin
                            </span>
                          </td>

                          {/* TINDAKAN TAKZIR */}
                          <td className="py-4 px-4 min-w-[180px]">
                            <div className="rounded-xl bg-slate-50 p-2 border border-slate-100 text-xs">
                              <p className="font-semibold text-slate-700">
                                {item.tindakan_takzir || 'Belum ditentukan'}
                              </p>
                            </div>
                          </td>

                          {/* DENDA */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            {dendaNominal > 0 ? (
                              <div>
                                <p className="font-black text-slate-800">
                                  Rp {dendaNominal.toLocaleString('id-ID')}
                                </p>
                                {item.status_denda === 'lunas' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mt-0.5">
                                    <CheckCircle2 size={11} /> Lunas
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => void handleBayarDenda(item.id)}
                                    className="inline-flex items-center gap-1 text-[10px] font-black text-amber-800 bg-amber-100 hover:bg-emerald-600 hover:text-white px-2 py-0.5 rounded-md mt-0.5 transition cursor-pointer"
                                    title="Klik untuk tandai lunas"
                                  >
                                    <Coins size={11} /> Belum Lunas (Bayar)
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>

                          {/* PETUGAS KEAMANAN */}
                          <td className="py-4 px-4 whitespace-nowrap text-xs">
                            <p className="font-bold text-slate-700 flex items-center gap-1">
                              <Shield size={12} className="text-[#138F81]" />
                              {item.nama_petugas || 'Pengurus Keamanan'}
                            </p>
                            {item.bukti_foto_url && (
                              <button
                                type="button"
                                onClick={() => setPreviewPhotoUrl(item.bukti_foto_url)}
                                className="inline-flex items-center gap-1 text-[11px] font-black text-[#138F81] hover:underline mt-1 cursor-pointer"
                              >
                                <ImageIcon size={12} /> Lihat Foto Bukti
                              </button>
                            )}
                          </td>

                          {/* AKSI */}
                          <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Terbitkan / Cetak Surat Panggilan */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.surat_panggilan_nomor) {
                                    setActiveSuratItem(item);
                                    setIsSuratModalOpen(true);
                                  } else {
                                    void handleTerbitkanSurat(item);
                                  }
                                }}
                                disabled={issuingSurat}
                                className={`p-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                                  item.surat_panggilan_nomor
                                    ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                                    : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                                }`}
                                title={item.surat_panggilan_nomor ? 'Lihat/Cetak Surat Panggilan' : 'Terbitkan Surat Panggilan Resmi'}
                              >
                                <FileText size={15} />
                              </button>

                              {/* Edit */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(item)}
                                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                title="Edit Catatan Pelanggaran"
                              >
                                <Edit size={15} />
                              </button>

                              {/* Hapus */}
                              <button
                                type="button"
                                onClick={() => void handleDeletePelanggaran(item.id, item.siswa?.nama || 'Santri')}
                                className="p-2 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 transition cursor-pointer"
                                title="Hapus Pelanggaran"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SANTRI KRITIS & PANGGILAN WALI */}
      {/* ========================================================================= */}
      {activeTab === 'kritis' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex items-start gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500 text-white shrink-0 shadow-md">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-base font-black text-amber-950">
                Pemantauan Khusus: Santri Akumulasi Poin Tinggi
              </h3>
              <p className="text-xs sm:text-sm font-medium text-amber-800 mt-1 leading-relaxed">
                Santri dengan total poin mencapai atau melebihi <b>{settingThreshold} Poin</b> otomatis ditandai <b>Perlu Panggilan Wali ke Pondok</b>. Anda dapat menerbitkan Surat Panggilan Resmi yang langsung terkirim secara real-time ke akun Wali Santri.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {santriKritisList.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200">
                <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-2" />
                <p className="text-base font-black text-slate-800">Alhamdulillah, Tidak Ada Santri Kritis</p>
                <p className="text-xs text-slate-400 mt-1">Seluruh santri memiliki rekam kedisiplinan yang baik.</p>
              </div>
            ) : (
              santriKritisList.map((s) => {
                const isOver = s.total_poin >= settingThreshold;
                const percentage = Math.min(100, Math.round((s.total_poin / settingThreshold) * 100));

                return (
                  <div
                    key={s.siswa_id}
                    className={`rounded-3xl p-6 border transition flex flex-col justify-between ${
                      isOver
                        ? 'bg-rose-50/60 border-rose-300 ring-2 ring-rose-400/40 shadow-lg'
                        : 'bg-white border-slate-200 shadow-sm'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-lg font-black text-slate-900 truncate">
                            {s.nama}
                          </h4>
                          <p className="text-xs font-semibold text-slate-500 mt-0.5">
                            NIS: <b>{s.nis}</b> • Kelas: {s.kelas}
                          </p>
                          <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                            Asrama: {s.asrama || '-'}
                          </p>
                        </div>

                        <span className={`px-2.5 py-1 rounded-xl text-xs font-black shrink-0 ${
                          isOver ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {s.total_poin} Poin
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-4">
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span className="text-slate-500">Ambang Batas Peringatan</span>
                          <span className={isOver ? 'text-rose-700 font-black' : 'text-slate-700'}>
                            {percentage}% ({s.total_poin}/{settingThreshold})
                          </span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isOver ? 'bg-rose-600' : 'bg-amber-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                        <span>Total Kejadian Pelanggaran:</span>
                        <span className="font-black text-slate-900">{s.total_kasus} Kasus</span>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-200/80 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenCreateModal(s.siswa_id)}
                        className="flex-1 py-2.5 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] text-white text-xs font-black shadow-md transition cursor-pointer"
                      >
                        + Catat Baru
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery(s.nama);
                          setActiveTab('log');
                        }}
                        className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                      >
                        Lihat Riwayat
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MASTER KATEGORI PELANGGARAN */}
      {/* ========================================================================= */}
      {activeTab === 'kategori' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-black tracking-wider">
                  <tr>
                    <th className="py-4 px-6">Nama / Jenis Pelanggaran</th>
                    <th className="py-4 px-4 text-center">Tingkat</th>
                    <th className="py-4 px-4 text-center">Poin Default</th>
                    <th className="py-4 px-4 text-center">Denda Default</th>
                    <th className="py-4 px-6">Saran Tindakan / Takzir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {categories.map((cat) => {
                    const badge =
                      cat.tingkat === 'Berat'
                        ? 'bg-rose-100 text-rose-800'
                        : cat.tingkat === 'Sedang'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-sky-100 text-sky-800';

                    return (
                      <tr key={cat.id} className="hover:bg-slate-50 transition">
                        <td className="py-4 px-6 font-extrabold text-slate-900">
                          {cat.nama_pelanggaran}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${badge}`}>
                            {cat.tingkat}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center font-black text-slate-800">
                          +{cat.poin_default} Poin
                        </td>
                        <td className="py-4 px-4 text-center font-bold text-slate-600">
                          {Number(cat.denda_default || 0) > 0 ? `Rp ${Number(cat.denda_default).toLocaleString('id-ID')}` : '-'}
                        </td>
                        <td className="py-4 px-6 text-slate-600 text-xs">
                          {cat.tindakan_rekomendasi || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PENGATURAN AMBANG BATAS POIN */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-xl font-black text-slate-900">
              Konfigurasi Ambang Batas Poin & Surat Panggilan
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Tentukan batasan akumulasi poin untuk memicu surat peringatan resmi dan notifikasi panggilan wali ke pondok pesantren.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-5">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Ambang Batas Poin Peringatan (Warning Threshold)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="10"
                  max="1000"
                  step="5"
                  value={settingThreshold}
                  onChange={(e) => setSettingThreshold(Number(e.target.value))}
                  className="w-40 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg font-black text-slate-900 outline-none focus:border-[#138F81] focus:bg-white"
                />
                <span className="text-sm font-bold text-slate-500">Poin Pelanggaran</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Contoh: Disetel <b>100</b> atau <b>200</b> poin. Santri yang poinnya &ge; angka ini akan otomatis ditandai status Panggilan Wali.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingEnableDenda}
                  onChange={(e) => setSettingEnableDenda(e.target.checked)}
                  className="h-5 w-5 rounded-lg border-slate-300 text-[#138F81] focus:ring-[#138F81]"
                />
                <div>
                  <span className="text-sm font-black text-slate-800 block">
                    Aktifkan Fitur Opsional Denda Finansial
                  </span>
                  <span className="text-xs text-slate-500 block mt-0.5">
                    Memungkinkan pencatatan denda rupiah pada pelanggaran tertentu sesuai tata tertib keamanan.
                  </span>
                </div>
              </label>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Judul Surat Panggilan Resmi
              </label>
              <input
                type="text"
                value={settingTitle}
                onChange={(e) => setSettingTitle(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-[#138F81] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Template Pesan Pembuka Surat Panggilan
              </label>
              <textarea
                rows={4}
                value={settingBody}
                onChange={(e) => setSettingBody(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:border-[#138F81] focus:bg-white"
              />
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#138F81]/25 transition cursor-pointer disabled:opacity-50"
              >
                <Save size={16} />
                <span>{savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: FORM INPUT / EDIT PELANGGARAN SANTRI */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  {isEditing ? '✏️ Edit Catatan Pelanggaran' : '🚨 Catat Pelanggaran Santri Baru'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Input data pelanggaran santri untuk audit kedisiplinan dan notifikasi ke Wali Santri.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePelanggaran} className="space-y-4 sm:space-y-5 mt-5">
              {/* PILIH SANTRI */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Santri yang Melanggar <span className="text-rose-500">*</span>
                </label>
                {!isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="🔍 Ketik nama santri, NIS, kelas, atau kamar asrama..."
                      value={formSiswaSearch}
                      onChange={(e) => setFormSiswaSearch(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:border-[#138F81] focus:bg-white"
                    />

                    <select
                      value={formSiswaId}
                      onChange={(e) => setFormSiswaId(Number(e.target.value))}
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-[#138F81]"
                    >
                      <option value="">-- Pilih Santri ({filteredStudents.length} Ditemukan) --</option>
                      {filteredStudents.map((s) => (
                        <option key={Number(s.id)} value={Number(s.id)}>
                          {String(s.nama || '')} ({String(s.nis || '')}) - Kelas {String(s.kelas || '-')} [{String(s.komplek || 'Pondok')} - Kamar {String(s.kamar || '-')}]
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-100 rounded-2xl text-xs font-black text-slate-800">
                    👨‍🎓 {formSiswaSearch} (ID: {formSiswaId})
                  </div>
                )}
              </div>

              {/* TANGGAL & JAM */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Tanggal Kejadian
                  </label>
                  <input
                    type="date"
                    value={formTanggal}
                    onChange={(e) => setFormTanggal(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-[#138F81]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Jam Kejadian
                  </label>
                  <input
                    type="text"
                    value={formWaktu}
                    placeholder="Contoh: 14:30 WIB"
                    onChange={(e) => setFormWaktu(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-[#138F81]"
                  />
                </div>
              </div>

              {/* KATEGORI PRESET */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Pilih Preset Kategori Pelanggaran (Opsional Cepat)
                </label>
                <select
                  value={formKategoriId}
                  onChange={(e) => handleCategoryChange(e.target.value ? Number(e.target.value) : '')}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-[#138F81]"
                >
                  <option value="">-- Ketik Kustom Sendiri / Pilih Master Kategori --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.tingkat}] {c.nama_pelanggaran} (+{c.poin_default} Poin)
                    </option>
                  ))}
                </select>
              </div>

              {/* JUDUL PELANGGARAN */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Nama / Uraian Pelanggaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formJudul}
                  onChange={(e) => setFormJudul(e.target.value)}
                  placeholder="Contoh: Merokok di Belakang Asrama Komplek 1"
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-[#138F81]"
                />
              </div>

              {/* TINGKAT & POIN & DENDA */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Tingkat
                  </label>
                  <select
                    value={formTingkat}
                    onChange={(e) => setFormTingkat(e.target.value as any)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#138F81]"
                  >
                    <option value="Ringan">🟡 Ringan</option>
                    <option value="Sedang">🟠 Sedang</option>
                    <option value="Berat">🔴 Berat</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Poin <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={formPoin}
                    onChange={(e) => setFormPoin(Number(e.target.value))}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm font-black text-slate-900 outline-none focus:border-[#138F81]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Denda (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={formDenda}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormDenda(val);
                      if (val > 0 && formStatusDenda === 'tidak_ada') {
                        setFormStatusDenda('belum_dibayar');
                      }
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-[#138F81]"
                  />
                </div>
              </div>

              {/* TINDAKAN TAKZIR */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Tindakan / Takzir Edukatif yang Diberikan
                </label>
                <input
                  type="text"
                  value={formTakzir}
                  onChange={(e) => setFormTakzir(e.target.value)}
                  placeholder="Contoh: Membaca Surat Yasin 3x & piket kebersihan masjid"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:border-[#138F81]"
                />
              </div>

              {/* KETERANGAN KRONOLOGI */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Keterangan / Kronologi Kejadian (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  placeholder="Catatan tambahan dari pengurus keamanan saat razia atau pelaporan..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:border-[#138F81]"
                />
              </div>

              {/* UPLOAD FOTO BUKTI */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Foto Bukti Kejadian / Barang Bukti (Opsional)
                </label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer border border-slate-200">
                    <Camera size={16} />
                    <span>Ambil Foto / Galeri</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  {formBuktiPreview && (
                    <div className="relative h-12 w-12 rounded-xl overflow-hidden border border-slate-200">
                      <img src={formBuktiPreview} alt="Preview" className="h-full w-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] text-white text-xs sm:text-sm font-black shadow-lg shadow-[#138F81]/25 transition cursor-pointer disabled:opacity-50"
                >
                  <Send size={15} />
                  <span>{formSubmitting ? 'Menyimpan...' : 'Simpan & Kirim ke Wali'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: TAMBAH KATEGORI BARU */}
      {/* ========================================================================= */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900">
                + Tambah Master Kategori Pelanggaran
              </h3>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Nama Pelanggaran
                </label>
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="Contoh: Tidak Sholat Berjamaah"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-[#138F81]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Tingkat
                  </label>
                  <select
                    value={catTingkat}
                    onChange={(e) => setCatTingkat(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#138F81]"
                  >
                    <option value="Ringan">Ringan</option>
                    <option value="Sedang">Sedang</option>
                    <option value="Berat">Berat</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Poin
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={catPoin}
                    onChange={(e) => setCatPoin(Number(e.target.value))}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs sm:text-sm font-black text-slate-900 outline-none focus:border-[#138F81]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Denda (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={catDenda}
                    onChange={(e) => setCatDenda(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-[#138F81]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Saran Tindakan Takzir
                </label>
                <input
                  type="text"
                  value={catTakzir}
                  onChange={(e) => setCatTakzir(e.target.value)}
                  placeholder="Contoh: Piket kebersihan asrama"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:border-[#138F81]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingCat}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
                >
                  {savingCat ? 'Menyimpan...' : 'Simpan Kategori'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CETAK SURAT PANGGILAN WALI SANTRI RESMI */}
      {/* ========================================================================= */}
      {isSuratModalOpen && activeSuratItem && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto print:p-0 print:bg-white">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-10 shadow-2xl border border-slate-200 my-8 print:border-none print:shadow-none print:m-0 print:p-4">
            {/* Header modal controls (hidden on print) */}
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200 print:hidden">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-rose-100 text-rose-700">
                  <FileText size={18} />
                </span>
                <h3 className="text-base font-black text-slate-900">
                  Pratinjau Surat Panggilan Resmi Wali Santri
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#138F81] text-white text-xs font-black shadow-md hover:bg-[#0D7A6F] transition cursor-pointer"
                >
                  <Printer size={15} /> Cetak / Unduh PDF
                </button>
                <button
                  type="button"
                  onClick={() => setIsSuratModalOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* LEMBAR SURAT RESMI BER-KOP SURAT */}
            <div className="space-y-6 text-slate-900 font-serif">
              {/* KOP SURAT */}
              <div className="flex items-center gap-4 pb-4 border-b-2 border-slate-900 text-center sm:text-left">
                <img src={qomaruddinLogo} alt="Logo" className="h-20 w-20 object-contain shrink-0 mx-auto sm:mx-0" />
                <div className="flex-1 text-center font-sans">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-600">
                    Yayasan Pondok Pesantren Qomaruddin
                  </p>
                  <h2 className="text-xl sm:text-2xl font-black text-[#0D7A6F] tracking-tight">
                    PENGURUS BIRO KEAMANAN & KETERTIBAN
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Jl. Masjid Kiyai Gede Sampurnan Bungah Gresik 61152 Jawa Timur • Telp: (031) 3949 123
                  </p>
                </div>
              </div>

              {/* NOMOR & PERIHAL */}
              <div className="flex justify-between text-xs font-sans font-semibold pt-2">
                <div>
                  <p>Nomor : <b>{activeSuratItem.surat_panggilan_nomor || 'SP/KEAMANAN/2026/001'}</b></p>
                  <p>Lamp. : -</p>
                  <p>Perihal : <b>SURAT PANGGILAN WALI SANTRI</b></p>
                </div>
                <div className="text-right">
                  <p>Sampurnan Bungah, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p>Kepada Yth.</p>
                  <p><b>Bapak/Ibu Wali Santri dari:</b></p>
                  <p className="font-bold text-[#0D7A6F]">{activeSuratItem.siswa?.nama}</p>
                </div>
              </div>

              {/* ISI SURAT */}
              <div className="space-y-3 text-xs sm:text-sm leading-relaxed text-justify font-sans">
                <p><i>Assalamu’alaikum Warahmatullahi Wabarakatuh,</i></p>
                <p>
                  Puji syukur kehadirat Allah SWT, shalawat serta salam senantiasa tercurahkan kepada Baginda Nabi Muhammad SAW.
                </p>
                <p>
                  {settingBody || 'Sehubungan dengan akumulasi poin pelanggaran kedisiplinan santri yang telah mencapai ambang batas peringatan, kami mengharap kehadiran Bapak/Ibu Wali Santri ke Kantor Pengurus Keamanan Pondok Pesantren Qomaruddin untuk berkoordinasi dan berdiskusi terkait pembinaan santri:'}
                </p>

                {/* TABEL DATA SANTRI */}
                <div className="my-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-sans space-y-1.5">
                  <div className="grid grid-cols-3">
                    <span className="text-slate-500">Nama Santri</span>
                    <span className="col-span-2 font-bold text-slate-900">: {activeSuratItem.siswa?.nama}</span>
                  </div>
                  <div className="grid grid-cols-3">
                    <span className="text-slate-500">Nomor Induk Santri (NIS)</span>
                    <span className="col-span-2 font-bold text-slate-900">: {activeSuratItem.siswa?.nis}</span>
                  </div>
                  <div className="grid grid-cols-3">
                    <span className="text-slate-500">Kelas & Kamar</span>
                    <span className="col-span-2 font-bold text-slate-900">: {activeSuratItem.siswa?.kelas} / {activeSuratItem.siswa?.komplek} Kamar {activeSuratItem.siswa?.kamar}</span>
                  </div>
                  <div className="grid grid-cols-3">
                    <span className="text-slate-500">Pelanggaran Terakhir</span>
                    <span className="col-span-2 font-bold text-rose-700">: {activeSuratItem.judul_pelanggaran} (+{activeSuratItem.poin} Poin)</span>
                  </div>
                </div>

                <p>
                  Mengingat pentingnya koordinasi demi kebaikan proses tarbiyah dan akhlak ananda di pesantren, kehadiran Bapak/Ibu Wali Santri sangat kami harapkan.
                </p>
                <p>
                  Demikian surat panggilan ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan jazakumullahu khairan katsiran.
                </p>
                <p><i>Wassalamu’alaikum Warahmatullahi Wabarakatuh.</i></p>
              </div>

              {/* TANDA TANGAN RESMI */}
              <div className="pt-8 grid grid-cols-2 text-center text-xs font-sans">
                <div>
                  <p>Mengetahui,</p>
                  <p className="font-bold">Kepala Pondok Pesantren</p>
                  <div className="h-16" />
                  <p className="font-black underline">Ust. H. Ahmad Ridwan, M.Pd.I</p>
                </div>
                <div>
                  <p>Biro Keamanan,</p>
                  <p className="font-bold">Ketua Pengurus Keamanan</p>
                  <div className="h-16" />
                  <p className="font-black underline">{activeSuratItem.nama_petugas || 'Pengurus Keamanan'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: PHOTO PREVIEW MODAL */}
      {/* ========================================================================= */}
      {previewPhotoUrl && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="relative max-w-xl max-h-[85vh] rounded-3xl overflow-hidden bg-black border border-white/20">
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute top-3 right-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white hover:bg-black transition cursor-pointer"
            >
              <X size={18} />
            </button>
            <img src={previewPhotoUrl} alt="Bukti Foto" className="h-full w-full object-contain max-h-[80vh]" />
          </div>
        </div>
      )}
    </div>
  );
}
