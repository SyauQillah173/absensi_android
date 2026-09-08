import {
  AlertCircle,
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Image as ImageIcon,
  KeyRound,
  LogOut,
  PlusCircle,
  Printer,
  RefreshCw,
  Search,
  Send,
  Upload,
  User,
  Wallet,
  X,
} from 'lucide-react';
import React, { FormEvent, useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import qomaruddinLogo from '../assets/logo-qomaruddin.png';

interface ExpenseItem {
  id: number;
  no_transaksi: string;
  judul: string;
  jumlah: number;
  tanggal: string;
  pos_pengeluaran: 'pondok' | 'madin' | string;
  pos_pengeluaran_label: string;
  kategori: string | null;
  keterangan: string | null;
  bukti_foto: string | null;
  bukti_foto_url: string | null;
  nama_petugas: string | null;
  dibayarkan_kepada: string | null;
  status_pengajuan: string;
  created_at: string;
}

interface SummaryData {
  total_nominal: number;
  total_pondok: number;
  total_madin: number;
  total_transaksi: number;
  total_bulan_ini: number;
  total_hari_ini: number;
  categories: string[];
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    admin_type: string;
  };
}

export function PetugasAnggaranPortalPage() {
  const { session, logout } = useAuth();
  const token = session?.token || '';

  // State data
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filter & Search
  const [posFilter, setPosFilter] = useState<'all' | 'pondok' | 'madin'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Form Pengajuan
  const [judul, setJudul] = useState('');
  const [posPengeluaran, setPosPengeluaran] = useState<'pondok' | 'madin'>('pondok');
  const [nominal, setNominal] = useState('');
  const [kategori, setKategori] = useState('Konsumsi & Dapur');
  const [keterangan, setKeterangan] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal Views
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<ExpenseItem | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);

  // Real-time Clock
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDateTimeFull = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(d) + ' WIB';
    } catch {
      return isoString;
    }
  };

  const fetchExpenses = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch('/api/petugas/pengeluaran', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      const json = await res.json();
      if (json.success) {
        setExpenses(json.data || []);
        setSummary(json.summary || null);
      }
    } catch (err) {
      console.error('Failed to load expenses', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [token]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setToastMessage({ type: 'error', text: 'Ukuran file kuitansi maksimal 5MB.' });
        return;
      }
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setFilePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddNominal = (amt: number) => {
    const curr = parseInt(nominal.replace(/[^0-9]/g, ''), 10) || 0;
    const next = curr + amt;
    setNominal(next.toString());
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanNominal = parseInt(nominal.replace(/[^0-9]/g, ''), 10);
    if (!judul.trim()) {
      setToastMessage({ type: 'error', text: 'Judul pengajuan anggaran wajib diisi.' });
      return;
    }
    if (!cleanNominal || cleanNominal <= 0) {
      setToastMessage({ type: 'error', text: 'Nominal pengajuan harus lebih dari Rp 0.' });
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('judul', judul.trim());
      formData.append('jumlah', cleanNominal.toString());
      formData.append('pos_pengeluaran', posPengeluaran);
      formData.append('kategori', kategori);
      if (keterangan.trim()) {
        formData.append('keterangan', keterangan.trim());
      }
      if (selectedFile) {
        formData.append('bukti_foto', selectedFile);
      }

      const res = await fetch('/api/petugas/pengeluaran', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: formData,
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setToastMessage({
          type: 'success',
          text: '🎉 Pengajuan anggaran berhasil disimpan! Kas bendahara langsung terpotong detik ini juga.',
        });
        // Reset form
        setJudul('');
        setNominal('');
        setKeterangan('');
        setSelectedFile(null);
        setFilePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        // Refresh list
        fetchExpenses(true);
      } else {
        setToastMessage({
          type: 'error',
          text: json.message || 'Gagal mengajukan anggaran. Periksa koneksi atau input Anda.',
        });
      }
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: 'Terjadi kendala jaringan saat mengirim pengajuan.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordStatus('Konfirmasi password baru tidak cocok.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordStatus('Password baru minimal 6 karakter.');
      return;
    }

    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          identifier: session?.email || session?.name,
          current_password: currentPassword,
          new_password: newPassword,
          new_password_confirmation: confirmPassword,
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert('Password berhasil diperbarui! Silakan login kembali.');
        setShowPasswordModal(false);
        logout();
      } else {
        setPasswordStatus(json.message || 'Gagal memperbarui password.');
      }
    } catch {
      setPasswordStatus('Terjadi kendala saat mengubah password.');
    }
  };

  // Filtered List
  const filteredExpenses = expenses.filter((item) => {
    const matchPos = posFilter === 'all' || item.pos_pengeluaran === posFilter;
    const matchSearch =
      !searchTerm ||
      item.judul.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.keterangan && item.keterangan.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.no_transaksi && item.no_transaksi.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.kategori && item.kategori.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchPos && matchSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* ================= TOP NAVBAR ================= */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Logo & Info Lembaga */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-emerald-600/10 dark:bg-emerald-500/20 p-1 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <img src={qomaruddinLogo} alt="Logo Qomaruddin" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight truncate">
                  PP. QOMARUDDIN
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  💼 Petugas Anggaran
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Portal Mandiri Pengajuan Anggaran Kas Terpadu
              </p>
            </div>
          </div>

          {/* Jam Realtime & User Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Live Clock */}
            <div className="hidden md:flex flex-col items-end px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400">
                <Clock size={13} className="animate-pulse" />
                <span>
                  {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                {currentTime.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>

            <ThemeToggle />

            {/* Profile Dropdown / Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => {
                  setPasswordStatus(null);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setShowPasswordModal(true);
                }}
                title="Ganti Password"
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              >
                <KeyRound size={17} />
              </button>

              <button
                onClick={() => logout()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/50 transition-all cursor-pointer"
                title="Keluar Akun"
              >
                <LogOut size={15} />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTAINER ================= */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Banner Sapaan Petugas */}
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-emerald-600 via-teal-600 to-cyan-700 dark:from-emerald-950 dark:via-teal-950 dark:to-slate-900 p-5 sm:p-7 text-white shadow-xl shadow-emerald-950/10 border border-emerald-500/30">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-[11px] font-bold text-emerald-100 border border-white/20">
                <FileCheck size={13} />
                <span>Otomatis Masuk & Potong Kas Bendahara</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Assalamu'alaikum, {session?.name || 'Petugas Anggaran'} 👋
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100/90 max-w-2xl leading-relaxed">
                Silakan ajukan kebutuhan belanja operasional. Setiap pengajuan yang Anda simpan akan{' '}
                <strong className="text-white underline decoration-emerald-300">langsung tercatat</strong> di buku kas Admin Bendahara
                dan saldo kas lembaga otomatis terpotong detik itu juga tanpa perlu menunggu klik ACC!
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => fetchExpenses(true)}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 active:scale-95 backdrop-blur-md text-xs font-bold text-white border border-white/20 transition-all cursor-pointer"
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                <span>Segarkan Data</span>
              </button>
            </div>
          </div>

          {/* Background Decorative Rings */}
          <div className="pointer-events-none absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute left-1/3 -top-12 w-48 h-48 rounded-full bg-emerald-400/20 blur-xl" />
        </div>

        {/* Toast Alert Feedback */}
        {toastMessage && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
              {toastMessage.type === 'success' ? <CheckCircle2 size={18} className="shrink-0 text-emerald-600" /> : <AlertCircle size={18} className="shrink-0 text-rose-600" />}
              <span>{toastMessage.text}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* ================= 4 KARTU METRIK RINGKASAN PETUGAS ================= */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Total Pengajuan Saya */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Total Diajukan Saya</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Coins size={17} />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {formatRupiah(summary?.total_nominal || 0)}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Akumulasi seluruh pengajuan Anda
              </p>
            </div>
          </div>

          {/* Pos Pondok Pesantren */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/20 dark:border-emerald-500/20 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <Building2 size={13} />
                <span>Pos Pondok</span>
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Wallet size={17} />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight">
                {formatRupiah(summary?.total_pondok || 0)}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Dapur, asrama, & sarana pondok
              </p>
            </div>
          </div>

          {/* Pos Madrasah Diniyah */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-500/20 dark:border-indigo-500/20 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                <FileText size={13} />
                <span>Pos Madin</span>
              </span>
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Wallet size={17} />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black text-indigo-700 dark:text-indigo-400 tracking-tight">
                {formatRupiah(summary?.total_madin || 0)}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Kitab, honor ustadz, & ujian
              </p>
            </div>
          </div>

          {/* Jumlah Transaksi */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Jumlah Transaksi</span>
              <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <FileCheck size={17} />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {summary?.total_transaksi || 0} <span className="text-xs font-normal text-slate-500">kali</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Hari ini: {formatRupiah(summary?.total_hari_ini || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* ================= 2-COLUMN LAYOUT: FORM PENGAJUAN & HISTORICAL LOG ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* FORM PENGAJUAN ANGGARAN (KIRI: 5 KOLOM) */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 sm:p-6 space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                <PlusCircle size={18} />
                <span className="text-xs font-bold uppercase tracking-wider">Form Pengajuan Anggaran</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Catat Permintaan Dana Keluar
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Isi rincian pengeluaran di bawah ini secara lengkap dan akurat.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 1. Judul Pengajuan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Judul Pengajuan Anggaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={judul}
                  onChange={(e) => setJudul(e.target.value)}
                  placeholder="Contoh: Belanja Beras Dapur Asrama / Kitab Santri"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              {/* 2. Pilihan Pos Pengeluaran (Radio Cards Visual) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Alokasi Pos Anggaran <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Pos Pondok */}
                  <label
                    className={`relative flex flex-col p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                      posPengeluaran === 'pondok'
                        ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pos_pengeluaran"
                      value="pondok"
                      checked={posPengeluaran === 'pondok'}
                      onChange={() => setPosPengeluaran('pondok')}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black flex items-center gap-1.5">
                        <Building2 size={14} className="text-emerald-600" />
                        <span>🕌 Pos Pondok</span>
                      </span>
                      {posPengeluaran === 'pondok' && <CheckCircle2 size={14} className="text-emerald-600" />}
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                      Dapur, konsumsi, listrik, asrama, & klinik
                    </span>
                  </label>

                  {/* Pos Madin */}
                  <label
                    className={`relative flex flex-col p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                      posPengeluaran === 'madin'
                        ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-100 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pos_pengeluaran"
                      value="madin"
                      checked={posPengeluaran === 'madin'}
                      onChange={() => setPosPengeluaran('madin')}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black flex items-center gap-1.5">
                        <FileText size={14} className="text-indigo-600" />
                        <span>📖 Pos Madin</span>
                      </span>
                      {posPengeluaran === 'madin' && <CheckCircle2 size={14} className="text-indigo-600" />}
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                      Kitab madin, honor ustadz, ujian, & ATK
                    </span>
                  </label>
                </div>
              </div>

              {/* 3. Nominal Pengeluaran (Live Rupiah Input + Quick Buttons) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nominal Anggaran (Rp) <span className="text-rose-500">*</span>
                  </label>
                  {nominal && (
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                      {formatRupiah(parseInt(nominal.replace(/[^0-9]/g, ''), 10) || 0)}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="text"
                    required
                    value={nominal ? parseInt(nominal.replace(/[^0-9]/g, ''), 10).toLocaleString('id-ID') : ''}
                    onChange={(e) => setNominal(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm sm:text-base font-black text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>

                {/* Quick Add Nominal Pills */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[50000, 100000, 250000, 500000, 1000000].map((amt) => (
                    <button
                      type="button"
                      key={amt}
                      onClick={() => handleAddNominal(amt)}
                      className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                    >
                      +{amt >= 1000000 ? `${amt / 1000000}jt` : `${amt / 1000}rb`}
                    </button>
                  ))}
                  {nominal && (
                    <button
                      type="button"
                      onClick={() => setNominal('')}
                      className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-[10px] font-bold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* 4. Kategori Pengeluaran */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Kategori Pengeluaran
                </label>
                <select
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  {(summary?.categories || [
                    'Konsumsi & Dapur',
                    'Operasional & Utilitas',
                    'Kitab & Buku Pelajaran',
                    'Bisyarah / Honor Guru',
                    'Sarana & Prasarana',
                    'Kegiatan & Lomba Santri',
                    'ATK & Percetakan',
                    'Kesehatan & Poskestren',
                    'Perawatan Gedung',
                    'Lain-lain',
                  ]).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Keterangan / Rincian Kebutuhan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Keterangan & Rincian Penggunaan Dana
                </label>
                <textarea
                  rows={2}
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Rincian barang/keperluan belanja (opsional)"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-none"
                />
              </div>

              {/* 6. Upload Bukti Kwitansi / Struk (Opsional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Upload Bukti Kuitansi / Nota <span className="text-slate-400 font-normal">(Opsional)</span>
                  </label>
                  {selectedFile && (
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      Hapus Foto
                    </button>
                  )}
                </div>

                {!selectedFile ? (
                  <label className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/60 dark:bg-slate-800/40 cursor-pointer transition-all">
                    <Camera size={22} className="text-slate-400 mb-1.5" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Ambil Foto / Pilih Kuitansi
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      JPG, PNG, WebP, atau PDF (Maks 5MB)
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>
                ) : (
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                    {filePreview ? (
                      <img
                        src={filePreview}
                        alt="Preview Kuitansi"
                        className="h-12 w-12 rounded-xl object-cover border border-slate-300 dark:border-slate-600"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                        <FileText size={22} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Siap diunggah
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Notice Kebijakan Kas Bendahara */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
                <AlertCircle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-tight">
                  <strong>Otomatisasi Kas:</strong> Setelah tombol simpan diklik, dana kas bendahara{' '}
                  <strong>langsung terpotong</strong> dan transaksi langsung tampil di pembukuan bendahara.
                </p>
              </div>

              {/* Tombol Simpan / Ajukan */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-2xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-emerald-950/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Menyimpan ke Kas Bendahara...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>🚀 Ajukan & Simpan ke Kas Bendahara</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* HISTORICAL AUDIT LOG PENGAJUAN (KANAN: 7 KOLOM) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 sm:p-6 space-y-4">
            {/* Header Riwayat & Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-0.5">
                  <Clock size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Histori Realtime</span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Riwayat Pengajuan Anggaran Saya
                </h3>
              </div>

              {/* Filter 3 Pos */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
                <button
                  onClick={() => setPosFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    posFilter === 'all'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setPosFilter('pondok')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    posFilter === 'pondok'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                  }`}
                >
                  🕌 Pondok
                </button>
                <button
                  onClick={() => setPosFilter('madin')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    posFilter === 'madin'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                  }`}
                >
                  📖 Madin
                </button>
              </div>
            </div>

            {/* Search Input Box */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari judul, keterangan, nomor transaksi, atau kategori..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            {/* List Riwayat */}
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                <RefreshCw size={24} className="animate-spin text-emerald-600" />
                <p className="text-xs font-semibold">Memuat riwayat pengajuan Anda...</p>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                <Coins size={36} className="mx-auto text-slate-300 dark:text-slate-700" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                  Belum ada catatan pengajuan anggaran
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Gunakan form di samping untuk mulai mengajukan belanja dana pondok atau madin.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                {filteredExpenses.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 transition-all space-y-2.5"
                  >
                    {/* Baris Atas: Kode Transaksi & Timestamp Detik demi Detik */}
                    <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-slate-600 dark:text-slate-300">
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700">
                          {item.no_transaksi || `EXP-${item.id}`}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            item.pos_pengeluaran === 'madin'
                              ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {item.pos_pengeluaran === 'madin' ? '📖 Pos Madin' : '🕌 Pos Pondok'}
                        </span>
                      </div>

                      {/* Tanggal & Waktu Presisi Detik */}
                      <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
                        <Clock size={12} className="text-emerald-600 dark:text-emerald-400" />
                        <span>{formatDateTimeFull(item.created_at)}</span>
                      </div>
                    </div>

                    {/* Baris Tengah: Judul & Nominal */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white leading-snug">
                          {item.judul}
                        </h4>
                        {item.keterangan && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">
                            {item.keterangan}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            🏷️ {item.kategori || 'Operasional'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400">
                          -{formatRupiah(item.jumlah)}
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 mt-1">
                          <CheckCircle2 size={11} />
                          <span>Tercatat di Kas</span>
                        </span>
                      </div>
                    </div>

                    {/* Baris Bawah: Aksi Preview Bukti Kuitansi & Cetak Struk */}
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {item.bukti_foto_url || item.bukti_foto ? (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(item.bukti_foto_url || `/storage/${item.bukti_foto}`)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
                          >
                            <ImageIcon size={13} />
                            <span>Lihat Kuitansi</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Tanpa lampiran kuitansi
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedReceipt(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Printer size={13} />
                        <span>Cetak Bukti</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ================= MODAL PRATINJAU FOTO KUITANSI HD ================= */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden p-2 shadow-2xl border border-slate-700 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between p-2 text-white border-b border-slate-800 mb-2">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <ImageIcon size={15} className="text-emerald-400" />
                <span>Bukti Kuitansi / Nota Belanja</span>
              </span>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <img
              src={previewImage}
              alt="Bukti Kuitansi"
              className="max-h-[75vh] w-auto object-contain rounded-xl"
            />
          </div>
        </div>
      )}

      {/* ================= MODAL CETAK BUKTI PENGAJUAN RESMI ================= */}
      {selectedReceipt && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Bukti */}
            <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="h-12 w-12 mx-auto mb-2">
                <img src={qomaruddinLogo} alt="Logo" className="h-full w-full object-contain" />
              </div>
              <h4 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Pondok Pesantren Qomaruddin
              </h4>
              <p className="text-[11px] text-slate-500">
                Bukti Pengajuan Anggaran Kas Keluar
              </p>
            </div>

            {/* Detail Transaksi */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">No. Transaksi</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {selectedReceipt.no_transaksi}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Waktu Lengkap</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatDateTimeFull(selectedReceipt.created_at)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Pos Anggaran</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {selectedReceipt.pos_pengeluaran === 'madin' ? 'Madrasah Diniyah' : 'Pondok Pesantren'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Judul Kebutuhan</span>
                <span className="font-bold text-slate-900 dark:text-white max-w-[200px] text-right">
                  {selectedReceipt.judul}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Petugas Pengaju</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedReceipt.nama_petugas || session?.name || 'Petugas Anggaran'}
                </span>
              </div>
              <div className="flex justify-between py-2 bg-emerald-50 dark:bg-emerald-950/40 px-3 rounded-xl">
                <span className="font-bold text-emerald-900 dark:text-emerald-200">Nominal Dicairkan</span>
                <span className="font-black text-emerald-700 dark:text-emerald-300 text-sm">
                  {formatRupiah(selectedReceipt.jumlah)}
                </span>
              </div>
            </div>

            {/* Aksi Print */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer size={15} />
                <span>Cetak Lembar Bukti</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL GANTI PASSWORD ================= */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowPasswordModal(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-base">
                <KeyRound size={18} className="text-emerald-600" />
                <span>Perbarui Password Akun</span>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {passwordStatus && (
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold">
                {passwordStatus}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Password Saat Ini / Default
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Password saat ini"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Password Baru (Min 6 Karakter)
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Password baru"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Konfirmasi Password Baru
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  Simpan Password
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
