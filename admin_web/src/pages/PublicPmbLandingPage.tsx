import {
  AlertCircle,
  AlertTriangle,
  Award,
  Bell,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  FileCheck,
  FileText,
  Globe,
  GraduationCap,
  HeartHandshake,
  HelpCircle,
  Home,
  Info,
  KeyRound,
  Landmark,
  Lock,
  LogIn,
  MapPin,
  Megaphone,
  MessageCircle,
  Phone,
  Printer,
  QrCode,
  Search,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  Upload,
  UserCheck,
  UserPlus,
  X
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ThemeToggle } from '../components/ThemeToggle';
import { PwaInstallBanner, PwaHeaderInstallButton } from '../components/PwaInstallBanner';
import { NotificationPermissionPrompt } from '../components/NotificationPermissionPrompt';
import { CountUpNumber } from '../components/CountUpNumber';
import { api, type ApiRecord } from '../services/api';

interface PublicPmbLandingPageProps {
  onOpenLogin: () => void;
  isLoggedIn?: boolean;
  onBackToAdmin?: () => void;
}

interface ActiveBatch {
  id: number;
  nama_gelombang: string;
  tahun_akademik: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  biaya_pendaftaran: number;
  kuota: number | null;
  is_active: boolean;
  keterangan: string | null;
}

interface ProfilCms {
  nama_pesantren: string;
  pendiri: string;
  tahun_berdiri: string;
  alamat: string;
  telepon: string;
  email: string;
  website: string;
  tagline: string;
  sejarah: string;
  visi: string;
  misi: string;
  agenda_kedatangan_info: string;
  program_unggulan: Array<{
    title: string;
    desc: string;
    icon?: string;
  }>;
  fasilitas: string[];
}

interface AnnouncementItem {
  id: number;
  title: string;
  slug: string;
  category: string;
  excerpt: string | null;
  content: string;
  event_date: string | null;
  is_pinned: boolean;
  author?: { name: string };
  created_at: string;
}

interface RegistrationResult {
  registration_number: string;
  nama_lengkap: string;
  tanggal_daftar: string;
  status: string;
  no_whatsapp_wali: string;
  username?: string;
  random_password?: string;
  wa_notif_sent?: boolean;
}

interface StatusCheckItem {
  id: number;
  registration_number: string;
  nama_lengkap: string;
  jenis_kelamin: 'L' | 'P';
  pilihan_jenjang: string;
  pilihan_asrama: string;
  status: string;
  status_label: string;
  payment_status: 'pending' | 'perlu_pelunasan' | 'lunas' | 'gratis' | string;
  payment_amount: number;
  payment_notes: string | null;
  catatan_admin: string | null;
  gelombang: string;
  tahun_akademik?: string;
  tanggal_daftar: string;
  is_converted: boolean;
  nis_resmi?: string | null;
  kelas_resmi?: string | null;
  kamar_resmi?: string | null;
}

export function PublicPmbLandingPage({ onOpenLogin, isLoggedIn = false, onBackToAdmin }: PublicPmbLandingPageProps) {
  const [activeTab, setActiveTab] = useState<'beranda' | 'daftar' | 'status' | 'agenda'>('beranda');
  const [activeBatch, setActiveBatch] = useState<ActiveBatch | null>(null);
  const [totalRegistered, setTotalRegistered] = useState(0);
  const [totalSantriMukim, setTotalSantriMukim] = useState(0);
  const [totalSantriAktif, setTotalSantriAktif] = useState(0);
  const [tahunKhidmah, setTahunKhidmah] = useState(251);
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  const [pmbIsOpen, setPmbIsOpen] = useState<boolean>(true);
  const [pmbClosedMessage, setPmbClosedMessage] = useState<string>(
    'Pendaftaran Santri Baru Gelombang Ini Saat Ini Sedang Ditutup. Silakan Pantau Pengumuman Resmi Berkala.'
  );
  const [profilCms, setProfilCms] = useState<ProfilCms | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementItem | null>(null);
  const [announcementFilter, setAnnouncementFilter] = useState<string>('all');
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);

  // Share & Copy states
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);
  const [hasCopiedCredentials, setHasCopiedCredentials] = useState(false);

  const getPublicPmbUrl = () => {
    return `${window.location.origin}/?pmb=1`;
  };

  const handleCopyPmbLink = () => {
    navigator.clipboard.writeText(getPublicPmbUrl());
    setHasCopiedLink(true);
    setTimeout(() => setHasCopiedLink(false), 3000);
  };

  const handleShareWhatsApp = () => {
    const namaPesantren = profilCms?.nama_pesantren || 'Pondok Pesantren Qomaruddin';
    const text = encodeURIComponent(
      `Penerimaan Santri Baru (PMB) ${namaPesantren} Sampurnan Bungah Gresik telah dibuka!\n\n` +
      `Mari bergabung bersama keluarga besar Pesantren Salaf Bersejarah (Est. 1775 M).\n` +
      `Pendaftaran online, pilihan jenjang Diniyah, Tahfidz 30 Juz, dan Asrama:\n` +
      `${getPublicPmbUrl()}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleCopyCredentials = (u: string, p: string) => {
    const text = `Kredensial Login Portal PP. Qomaruddin:\nUsername: ${u}\nPassword: ${p}\nLink Portal: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setHasCopiedCredentials(true);
    setTimeout(() => setHasCopiedCredentials(false), 3000);
  };

  // Form Registration states
  const [form, setForm] = useState({
    nama_lengkap: '',
    nama_panggilan: '',
    jenis_kelamin: 'L' as 'L' | 'P',
    tempat_lahir: '',
    tanggal_lahir: '',
    nik: '',
    nisn: '',
    asal_sekolah: '',
    pilihan_jenjang: 'Madrasah Diniyah & Pondok',
    pilihan_asrama: 'Pondok Putra',
    nama_ayah: '',
    pekerjaan_ayah: '',
    nama_ibu: '',
    pekerjaan_ibu: '',
    nama_wali: '',
    no_whatsapp_wali: '',
    alamat_lengkap: '',
    kota: '',
    provinsi: 'Jawa Timur',
    catatan_khusus: ''
  });

  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [kkFile, setKkFile] = useState<File | null>(null);
  const [formStep, setFormStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [registrationSuccess, setRegistrationSuccess] = useState<RegistrationResult | null>(null);

  // Status Check states
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearchingStatus, setIsSearchingStatus] = useState(false);
  const [statusResults, setStatusResults] = useState<StatusCheckItem[] | null>(null);
  const [statusSearchError, setStatusSearchError] = useState('');
  const [selectedCardToPrint, setSelectedCardToPrint] = useState<StatusCheckItem | null>(null);

  // Load Public Batch Info & Dynamic CMS Profil
  useEffect(() => {
    async function loadPublicBatch() {
      setIsLoadingInfo(true);
      try {
        const res = await api.getPmbInfo();
        if (res && res.data) {
          const d = res.data as any;
          if (d.active_batch) setActiveBatch(d.active_batch);
          if (typeof d.total_registered === 'number') setTotalRegistered(d.total_registered);
          if (typeof d.total_santri_mukim === 'number') setTotalSantriMukim(d.total_santri_mukim);
          if (typeof d.total_santri_aktif === 'number') setTotalSantriAktif(d.total_santri_aktif);
          if (typeof d.tahun_khidmah === 'number') setTahunKhidmah(d.tahun_khidmah);
          if (d.quota_remaining !== undefined) setQuotaRemaining(d.quota_remaining);
          if (typeof d.pmb_is_open === 'boolean') setPmbIsOpen(d.pmb_is_open);
          if (d.pmb_closed_message) setPmbClosedMessage(d.pmb_closed_message);
          if (d.profil) setProfilCms(d.profil);
          if (Array.isArray(d.announcements)) setAnnouncements(d.announcements);
        }
      } catch (err) {
        console.warn('Gagal memuat batch PMB & profil CMS:', err);
      } finally {
        setIsLoadingInfo(false);
      }
    }
    loadPublicBatch();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleNextStep = () => {
    setSubmitError('');
    if (formStep === 1) {
      if (!form.nama_lengkap.trim()) {
        setSubmitError('Nama lengkap calon santri wajib diisi.');
        return;
      }
      if (!form.jenis_kelamin) {
        setSubmitError('Jenis kelamin calon santri wajib dipilih.');
        return;
      }
    } else if (formStep === 2) {
      if (!form.pilihan_jenjang) {
        setSubmitError('Pilihan jenjang pendidikan wajib dipilih.');
        return;
      }
    } else if (formStep === 3) {
      if (!form.no_whatsapp_wali.trim()) {
        setSubmitError('Nomor WhatsApp wali wajib diisi untuk konfirmasi dan notifikasi akun portal.');
        return;
      }
      const cleanWa = form.no_whatsapp_wali.replace(/\D/g, '');
      if (cleanWa.length < 9) {
        setSubmitError('Nomor WhatsApp tidak valid. Masukkan nomor minimal 10 digit (contoh: 081234567890).');
        return;
      }
    }
    setFormStep((prev) => prev + 1);
  };

  const handlePrevStep = () => {
    setSubmitError('');
    setFormStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!pmbIsOpen) {
      setSubmitError('Pendaftaran saat ini sedang ditutup oleh panitia PMB. Mohon pantau pengumuman.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          formData.append(k, String(v));
        }
      });

      if (fotoFile) {
        formData.append('berkas_foto', fotoFile);
      }
      if (kkFile) {
        formData.append('berkas_kk', kkFile);
      }

      const res = await api.postForm<RegistrationResult>('/pmb/register', formData);
      if (res && res.data) {
        setRegistrationSuccess(res.data);
        setFormStep(1);
        setForm({
          nama_lengkap: '',
          nama_panggilan: '',
          jenis_kelamin: 'L',
          tempat_lahir: '',
          tanggal_lahir: '',
          nik: '',
          nisn: '',
          asal_sekolah: '',
          pilihan_jenjang: 'Madrasah Diniyah & Pondok',
          pilihan_asrama: 'Pondok Putra',
          nama_ayah: '',
          pekerjaan_ayah: '',
          nama_ibu: '',
          pekerjaan_ibu: '',
          nama_wali: '',
          no_whatsapp_wali: '',
          alamat_lengkap: '',
          kota: '',
          provinsi: 'Jawa Timur',
          catatan_khusus: ''
        });
        setFotoFile(null);
        setKkFile(null);
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Terjadi kendala saat mengirim formulir. Pastikan jaringan stabil dan data terisi benar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchKeyword.trim();
    if (!q) {
      setStatusSearchError('Ketikkan nomor registrasi (contoh: PMB-2026-0001) atau nomor WhatsApp.');
      return;
    }

    setIsSearchingStatus(true);
    setStatusSearchError('');
    setStatusResults(null);

    try {
      const res = await api.get<StatusCheckItem[]>(`/pmb/check-status?keyword=${encodeURIComponent(q)}`);
      if (res && res.data && res.data.length > 0) {
        setStatusResults(res.data);
      } else {
        setStatusSearchError('Data pendaftaran tidak ditemukan. Pastikan nomor registrasi atau nomor WA sesuai.');
      }
    } catch (err: any) {
      setStatusSearchError(err?.message || 'Nomor pendaftaran atau nomor WhatsApp tidak ditemukan.');
    } finally {
      setIsSearchingStatus(false);
    }
  };

  const renderProgramIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Award':
        return <Award className="w-5 h-5 text-[#0D7A6F] dark:text-[#2DD4BF]" />;
      case 'GraduationCap':
        return <GraduationCap className="w-5 h-5 text-[#2E86DE] dark:text-sky-400" />;
      case 'ShieldCheck':
        return <ShieldCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />;
      case 'Home':
        return <Home className="w-5 h-5 text-amber-700 dark:text-amber-400" />;
      case 'Landmark':
        return <Landmark className="w-5 h-5 text-purple-700 dark:text-purple-400" />;
      case 'BookOpen':
      default:
        return <BookOpen className="w-5 h-5 text-[#0D7A6F] dark:text-[#2DD4BF]" />;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'agenda_kedatangan':
        return {
          label: 'Agenda Kedatangan',
          style: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
        };
      case 'pengumuman':
        return {
          label: 'Pengumuman Resmi',
          style: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700'
        };
      case 'alur_berkas':
        return {
          label: 'Alur & Berkas Fisik',
          style: 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700'
        };
      case 'berita':
        return {
          label: 'Berita & Seputar Pondok',
          style: 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700'
        };
      default:
        return {
          label: 'Informasi',
          style: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
        };
    }
  };

  const filteredAnnouncements = announcements.filter((a) => {
    if (announcementFilter === 'all') return true;
    return a.category === announcementFilter;
  });

  return (
    <div className="min-h-screen bg-[#FFDC80] dark:bg-[#0B1120] text-[#2D3436] dark:text-slate-100 flex flex-col font-sans selection:bg-[#138F81] selection:text-white transition-colors duration-300">
      {/* 🌟 BANNER KHUSUS MODE PREVIEW ADMIN */}
      {isLoggedIn && (
        <div className="bg-gradient-to-r from-[#0D7A6F] to-[#138F81] text-white px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-bold flex items-center justify-between gap-2 shadow-md border-b border-teal-500/50">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded-full bg-amber-300 text-slate-900 font-black text-[9px] sm:text-[10px] tracking-wider uppercase shadow-xs shrink-0">
              Mode Admin
            </span>
            <span className="text-[10px] sm:text-xs text-teal-100 truncate hidden sm:inline">
              Anda sedang login sebagai Admin dan melihat tampilan langsung Web Publik PMB & Profil Pesantren.
            </span>
          </div>
          <button
            onClick={onBackToAdmin || onOpenLogin}
            className="px-2.5 py-0.5 sm:py-1 rounded-xl bg-white/20 hover:bg-white text-white hover:text-[#0D7A6F] text-[11px] sm:text-xs font-black transition-all flex items-center gap-1 border border-white/40 cursor-pointer shadow-xs shrink-0"
          >
            <Home className="w-3 h-3 text-amber-300" />
            <span>← Dashboard</span>
          </button>
        </div>
      )}

      {/* 🌟 BANNER STATUS MASTER BUKA/TUTUP JIKA DITUTUP */}
      {!pmbIsOpen && (
        <div className="bg-rose-600 dark:bg-rose-900 text-white px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-center flex items-center justify-center gap-1.5 shadow-md">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-300 animate-pulse" />
          <span className="line-clamp-1 sm:line-clamp-none text-left sm:text-center">
            <strong>PEMBERITAHUAN:</strong> {pmbClosedMessage}
          </span>
        </div>
      )}
      {/* 🌟 TOP NAVBAR KHAS QOMARUDDIN (DESAIN ELEGAN, RAPI & PROFESIONAL) */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-[#1E293B]/95 backdrop-blur-md border-b border-amber-300/80 dark:border-slate-800 shadow-sm transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-18 lg:h-20 gap-1.5 sm:gap-4">
            {/* Logo & Identitas Pesantren */}
            <div
              onClick={() => setActiveTab('beranda')}
              className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group shrink-0 min-w-0"
            >
              <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-2xl bg-amber-50/80 dark:bg-slate-800 p-1 shadow-2xs border border-amber-200 dark:border-slate-700 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <img
                  src="/logo-qomaruddin.png"
                  alt="Logo Qomaruddin"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-xs sm:text-base tracking-tight text-[#2D3436] dark:text-slate-100 group-hover:text-[#138F81] dark:group-hover:text-[#2DD4BF] transition-colors whitespace-nowrap">
                    PP. QOMARUDDIN
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-[#636E72] dark:text-slate-400 hidden sm:block font-medium whitespace-nowrap truncate max-w-[200px] md:max-w-none">
                  Penerimaan Santri Baru • Sampurnan Bungah
                </p>
              </div>
            </div>

            {/* Nav Menu Tabs (Hanya ditampilkan pada layar lg >= 1024px agar tidak sesak) */}
            <nav className="hidden lg:flex items-center gap-1 bg-amber-50/80 dark:bg-slate-900/80 p-1 rounded-2xl border border-amber-200/80 dark:border-slate-800 shrink-0">
              <button
                onClick={() => setActiveTab('beranda')}
                className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'beranda'
                    ? 'bg-[#138F81] text-white shadow-xs'
                    : 'text-[#2D3436] dark:text-slate-300 hover:bg-amber-100/70 dark:hover:bg-slate-800'
                }`}
              >
                Beranda
              </button>
              <button
                onClick={() => {
                  setActiveTab('daftar');
                  setFormStep(1);
                  setRegistrationSuccess(null);
                }}
                className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'daftar'
                    ? 'bg-[#138F81] text-white shadow-xs'
                    : 'text-[#2D3436] dark:text-slate-300 hover:bg-amber-100/70 dark:hover:bg-slate-800'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 text-[#FFDC80]" />
                <span>Daftar Online</span>
                {!pmbIsOpen && (
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-rose-500 text-white">
                    Tutup
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('status')}
                className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'status'
                    ? 'bg-[#138F81] text-white shadow-xs'
                    : 'text-[#2D3436] dark:text-slate-300 hover:bg-amber-100/70 dark:hover:bg-slate-800'
                }`}
              >
                <Search className="w-3.5 h-3.5 text-[#FFDC80]" />
                <span>Cek Kelulusan</span>
              </button>
              <button
                onClick={() => setActiveTab('agenda')}
                className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'agenda'
                    ? 'bg-[#138F81] text-white shadow-xs'
                    : 'text-[#2D3436] dark:text-slate-300 hover:bg-amber-100/70 dark:hover:bg-slate-800'
                }`}
              >
                <Megaphone className="w-3.5 h-3.5 text-[#FFDC80]" />
                <span>Agenda & Berita</span>
                {announcements.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-600 text-white font-bold">
                    {announcements.length}
                  </span>
                )}
              </button>
            </nav>

            {/* Quick Actions: Install App, ThemeToggle, Share PMB & Login Pegawai / Dashboard Admin */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <PwaHeaderInstallButton />

              <ThemeToggle showDropdown={true} />

              <button
                onClick={() => setIsShareModalOpen(true)}
                className="whitespace-nowrap hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-[#0D7A6F] dark:text-[#2DD4BF] border border-amber-300 dark:border-slate-700 transition-all shadow-xs cursor-pointer"
                title="Bagikan Info PMB ke WhatsApp / Media Sosial"
              >
                <Share2 className="w-3.5 h-3.5 text-[#138F81] dark:text-[#2DD4BF]" />
                <span className="hidden xl:inline">Bagikan</span>
              </button>

              {isLoggedIn ? (
                <button
                  onClick={onBackToAdmin || onOpenLogin}
                  className="whitespace-nowrap flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black bg-[#0D7A6F] hover:bg-[#138F81] text-white transition-all shadow-md shadow-[#0D7A6F]/25 border border-teal-400/40 cursor-pointer"
                  title="Kembali ke Dashboard Admin"
                >
                  <Home className="w-3.5 h-3.5 text-[#FFDC80]" />
                  <span className="hidden xs:inline">Dashboard</span>
                </button>
              ) : (
                <button
                  onClick={onOpenLogin}
                  className="whitespace-nowrap flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-black bg-[#138F81] hover:bg-[#0D7A6F] text-white transition-all shadow-sm shadow-[#138F81]/25 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5 text-[#FFDC80]" />
                  <span className="hidden sm:inline">Portal Pegawai</span>
                  <span className="sm:hidden">Masuk</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation Tabs (untuk layar di bawah 1024px / hp / tablet) */}
        <div className="lg:hidden flex items-center justify-start sm:justify-around border-t border-amber-200/60 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 py-1.5 px-2 text-xs font-bold shadow-xs gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('beranda')}
            className={`whitespace-nowrap shrink-0 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'beranda'
                ? 'bg-[#138F81] text-white shadow-xs'
                : 'text-[#2D3436] dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-800'
            }`}
          >
            Beranda
          </button>
          <button
            onClick={() => {
              setActiveTab('daftar');
              setFormStep(1);
              setRegistrationSuccess(null);
            }}
            className={`whitespace-nowrap shrink-0 px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all cursor-pointer ${
              activeTab === 'daftar'
                ? 'bg-[#138F81] text-white shadow-xs'
                : 'text-[#2D3436] dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-800'
            }`}
          >
            <UserPlus size={13} />
            <span>Daftar</span>
            {!pmbIsOpen && <span className="text-[8px] bg-rose-500 text-white px-1.5 py-0.2 rounded-md font-black">Off</span>}
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all cursor-pointer ${
              activeTab === 'status'
                ? 'bg-[#138F81] text-white shadow-xs'
                : 'text-[#2D3436] dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-800'
            }`}
          >
            <Search size={13} />
            <span>Cek Status</span>
          </button>
          <button
            onClick={() => setActiveTab('agenda')}
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all cursor-pointer ${
              activeTab === 'agenda'
                ? 'bg-[#138F81] text-white shadow-xs'
                : 'text-[#2D3436] dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-800'
            }`}
          >
            <Megaphone size={13} />
            <span>Agenda</span>
            {announcements.length > 0 && (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-600 text-white font-black">
                {announcements.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* 🌟 CONTENT AREA */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* ========================================================================= */}
        {/* TAB 1: BERANDA & PROFIL PESANTREN (WORDPRESS-STYLE CMS CONTENT) */}
        {/* ========================================================================= */}
        {activeTab === 'beranda' && (
          <div className="space-y-6 sm:space-y-8">
            {/* HERO CARD ELEGAN BERWARNA PUTIH BERSIH DENGAN AKSEN KUNING-TEAL */}
            <section className="relative overflow-hidden rounded-[32px] sm:rounded-[40px] bg-white dark:bg-[#1E293B] p-6 sm:p-12 shadow-2xl border border-amber-200/80 dark:border-slate-800 text-center transition-colors">
              {/* Ornamen Lembut Latar Belakang */}
              <div className="absolute top-0 right-0 w-80 h-80 bg-amber-100/50 dark:bg-amber-900/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-50/60 dark:bg-teal-900/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

              <div className="relative z-10 max-w-4xl mx-auto">
                {/* Active Gelombang Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFDC80] dark:bg-amber-400/20 border border-amber-300 dark:border-amber-500/30 text-xs font-black text-[#0D7A6F] dark:text-amber-300 mb-6 shadow-xs">
                  <Sparkles className="w-4 h-4 text-[#D97706] dark:text-amber-400" />
                  <span>
                    {pmbIsOpen
                      ? (activeBatch ? activeBatch.nama_gelombang : 'Penerimaan Santri Baru Telah Dibuka Resmi!')
                      : 'Pendaftaran PMB Saat Ini Sedang Ditutup'}
                  </span>
                </div>

                {/* Main Heading */}
                <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-[#2D3436] dark:text-slate-100 tracking-tight leading-tight mb-4">
                  Penerimaan Santri Baru (PMB) <br />
                  <span className="text-[#138F81] dark:text-[#2DD4BF]">
                    {profilCms?.nama_pesantren || 'Pondok Pesantren Qomaruddin'}
                  </span>
                </h1>

                {/* Tagline / Subtitle */}
                <p className="text-xs sm:text-sm lg:text-base text-[#636E72] dark:text-slate-300 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed font-medium">
                  {profilCms?.tagline ||
                    'Menyemai generasi santri tafaqquh fiddin, berakhlakul karimah, dan berwawasan luas dengan barokah sanad keilmuan salaf sejak 1775 M di Sampurnan, Bungah, Gresik.'}
                </p>

                {/* CTA Buttons - Cerdas Menyesuaikan Sakelar Buka/Tutup */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-xl mx-auto mb-10">
                  {pmbIsOpen ? (
                    <button
                      onClick={() => {
                        setActiveTab('daftar');
                        setFormStep(1);
                        setRegistrationSuccess(null);
                      }}
                      className="w-full sm:w-auto px-6 sm:px-7 py-3.5 sm:py-4 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] text-white font-black text-xs sm:text-sm shadow-lg shadow-[#138F81]/25 hover:scale-102 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <UserPlus className="w-4 h-4 text-[#FFDC80]" />
                      <span>Daftar Santri Baru</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setActiveTab('agenda')}
                      className="w-full sm:w-auto px-6 sm:px-7 py-3.5 sm:py-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs sm:text-sm shadow-lg shadow-amber-500/25 hover:scale-102 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <Megaphone className="w-4 h-4 text-white" />
                      <span>Lihat Agenda & Pengumuman</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => setActiveTab('status')}
                    className="w-full sm:w-auto px-6 py-3.5 sm:py-4 rounded-2xl bg-[#FFDC80] dark:bg-slate-800 hover:bg-[#ffe59e] dark:hover:bg-slate-700 text-[#0D7A6F] dark:text-amber-300 font-black text-xs sm:text-sm border-2 border-amber-300 dark:border-slate-700 shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <Search className="w-4 h-4 text-[#0D7A6F] dark:text-amber-300" />
                    <span>Lacak Status Kelulusan</span>
                  </button>
                </div>

                {/* Live Stats Cards Real-Time Beranimasi */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-slate-800/80 border border-amber-200/80 dark:border-slate-700 text-center hover:scale-102 hover:shadow-md hover:border-amber-400 dark:hover:border-teal-500/40 transition-all duration-300">
                    <div className="text-2xl sm:text-3xl font-black text-[#138F81] dark:text-[#2DD4BF] flex items-center justify-center">
                      <CountUpNumber end={tahunKhidmah || 251} duration={1400} suffix="+" />
                    </div>
                    <div className="text-[11px] sm:text-xs text-[#636E72] dark:text-slate-400 font-semibold mt-0.5">Tahun Khidmah (1775 M)</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-slate-800/80 border border-amber-200/80 dark:border-slate-700 text-center hover:scale-102 hover:shadow-md hover:border-teal-400 dark:hover:border-teal-500/40 transition-all duration-300">
                    <div className="text-2xl sm:text-3xl font-black text-[#0D7A6F] dark:text-teal-400 flex items-center justify-center">
                      <CountUpNumber end={totalSantriMukim || totalSantriAktif || 447} duration={1600} suffix="+" />
                    </div>
                    <div className="text-[11px] sm:text-xs text-[#636E72] dark:text-slate-400 font-semibold mt-0.5">Santri Aktif Mukim</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-slate-800/80 border border-amber-200/80 dark:border-slate-700 text-center hover:scale-102 hover:shadow-md hover:border-amber-400 dark:hover:border-amber-500/40 transition-all duration-300">
                    <div className="text-2xl sm:text-3xl font-black text-[#D97706] dark:text-amber-400 flex items-center justify-center">
                      <CountUpNumber end={30} duration={1000} suffix=" Juz" />
                    </div>
                    <div className="text-[11px] sm:text-xs text-[#636E72] dark:text-slate-400 font-semibold mt-0.5">Tahfidz Bersanad</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-slate-800/80 border border-amber-200/80 dark:border-slate-700 text-center hover:scale-102 hover:shadow-md hover:border-slate-400 dark:hover:border-slate-600 transition-all duration-300">
                    <div className="text-2xl sm:text-3xl font-black text-[#2D3436] dark:text-slate-100 flex items-center justify-center">
                      <CountUpNumber end={totalRegistered} duration={1200} />
                    </div>
                    <div className="text-[11px] sm:text-xs text-[#636E72] dark:text-slate-400 font-semibold mt-0.5">Pendaftar Gelombang Ini</div>
                  </div>
                </div>
              </div>
            </section>

            {/* SEJARAH & KURIKULUM TERPADU DINAMIS CMS */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Kolom Sejarah 1775 M */}
              <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-[#1E293B] border border-amber-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-xl flex flex-col justify-between transition-colors">
                <div>
                  <div className="h-14 w-14 rounded-2xl bg-amber-50 dark:bg-slate-800 border border-amber-200 dark:border-slate-700 p-2 flex items-center justify-center mb-5">
                    <img src="/logo-qomaruddin.png" alt="Qomaruddin" className="h-full w-full object-contain" />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#138F81] dark:text-[#2DD4BF]">
                    WARISAN SALAF NUSANTARA • {profilCms?.tahun_berdiri || 'EST. 1775 M'}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-[#2D3436] dark:text-slate-100 mt-1 mb-3">
                    Pesantren Salaf Tertua & Bersejarah
                  </h3>
                  <p className="text-xs sm:text-sm text-[#636E72] dark:text-slate-300 leading-relaxed mb-6 whitespace-pre-line">
                    {profilCms?.sejarah ||
                      'Didirikan oleh Kiai Qomaruddin pada tahun 1775 M, Pondok Pesantren Qomaruddin Sampurnan Bungah telah melahirkan ribuan ulama, kiai, dan cendekiawan yang bertebaran di pelosok nusantara hingga mancanegara.'}
                  </p>
                </div>

                <div className="space-y-2.5 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-[#2D3436] dark:text-slate-300 font-semibold">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#138F81] dark:text-[#2DD4BF] shrink-0" />
                    <span>Sanad keilmuan muttashil bersambung ke Mbah Kiai Qomaruddin & Rasulullah SAW</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#138F81] dark:text-[#2DD4BF] shrink-0" />
                    <span>Kombinasi sorogan salaf dan manajemen keilmuan modern terakreditasi</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#138F81] dark:text-[#2DD4BF] shrink-0" />
                    <span>Komplek asrama santri putra & putri mukim yang aman, asri, dan barokah</span>
                  </div>
                </div>
              </div>

              {/* Kolom Pilihan Program & Kurikulum Dinamis CMS */}
              <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-[#1E293B] border border-amber-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-xl flex flex-col justify-between transition-colors">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-[#0D7A6F] dark:text-amber-300 text-xs font-black mb-3">
                    <BookOpen size={14} />
                    <span>PROGRAM PENDIDIKAN UNGGULAN PESANTREN</span>
                  </div>
                  <h2 className="text-xl sm:text-3xl font-black text-[#2D3436] dark:text-slate-100">
                    Pilihan Jenjang & Kurikulum Terpadu
                  </h2>
                  <p className="text-xs sm:text-sm text-[#636E72] dark:text-slate-300 mt-1 mb-6">
                    Pesantren menyediakan jalur pendidikan komprehensif bagi santri putra maupun putri:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {(profilCms?.program_unggulan && profilCms.program_unggulan.length > 0
                      ? profilCms.program_unggulan
                      : [
                          {
                            title: 'Madrasah Diniyah Salafiyah',
                            desc: 'Kajian kitab kuning berjenjang mendalami Fiqih, Nahwu-Sharaf, Hadits, Tauhid, dan Akhlaq.',
                            icon: 'BookOpen'
                          },
                          {
                            title: 'Tahfidzul Qur\'an 30 Juz',
                            desc: 'Halaqah tahfidz intensif dengan musyrif mutqin, setoran tartil, muraja\'ah, dan tasmi\' bersanad.',
                            icon: 'Award'
                          },
                          {
                            title: 'Sekolah Formal Terpadu',
                            desc: 'Pilihan pendidikan formal Yayasan: MI, MTs, MA, SMA, SMK Assa\'adah Bungah, hingga Universitas Qomaruddin.',
                            icon: 'GraduationCap'
                          },
                          {
                            title: 'Asrama Pondok Putra & Putri',
                            desc: 'Asrama bersih dan asri, sholat jama\'ah 5 waktu, pengajian bandongan, dan muhadhoroh.',
                            icon: 'Home'
                          }
                        ]
                    ).map((prog, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-[#F8FAFC] dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 hover:border-[#138F81] dark:hover:border-[#2DD4BF] transition-all"
                      >
                        <div className="h-9 w-9 rounded-xl bg-[#FFDC80] dark:bg-slate-800 text-[#0D7A6F] dark:text-amber-400 flex items-center justify-center mb-2.5 shadow-xs">
                          {renderProgramIcon(prog.icon)}
                        </div>
                        <h4 className="text-sm font-black text-[#2D3436] dark:text-slate-100 mb-1">
                          {prog.title}
                        </h4>
                        <p className="text-xs text-[#636E72] dark:text-slate-400 leading-relaxed">
                          {prog.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* VISI & MISI PESANTREN ALA WORDPRESS CMS */}
            {profilCms && (profilCms.visi || profilCms.misi) && (
              <section className="rounded-3xl bg-white dark:bg-[#1E293B] border border-amber-200/80 dark:border-slate-800 p-6 sm:p-10 shadow-xl transition-colors">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-6 rounded-2xl bg-amber-50/50 dark:bg-slate-900/50 border border-amber-200/60 dark:border-slate-800">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-[#0D7A6F] dark:text-amber-300 text-xs font-black mb-3">
                      <Sparkles size={14} />
                      <span>VISI PESANTREN</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-[#2D3436] dark:text-slate-100 mb-3">
                      Arah & Cita-Cita Mulia
                    </h3>
                    <p className="text-xs sm:text-sm text-[#636E72] dark:text-slate-300 leading-relaxed italic">
                      "{profilCms.visi}"
                    </p>
                  </div>

                  <div className="p-6 rounded-2xl bg-teal-50/40 dark:bg-slate-900/50 border border-teal-200/60 dark:border-slate-800">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-[#0D7A6F] dark:text-[#2DD4BF] text-xs font-black mb-3">
                      <FileCheck size={14} />
                      <span>MISI PESANTREN</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-[#2D3436] dark:text-slate-100 mb-3">
                      Langkah & Strategi Khidmah
                    </h3>
                    <div className="text-xs sm:text-sm text-[#636E72] dark:text-slate-300 leading-relaxed whitespace-pre-line space-y-1">
                      {profilCms.misi}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* FASILITAS PESANTREN */}
            {profilCms && profilCms.fasilitas && profilCms.fasilitas.length > 0 && (
              <section className="rounded-3xl bg-white dark:bg-[#1E293B] border border-amber-200/80 dark:border-slate-800 p-6 sm:p-10 shadow-xl transition-colors">
                <div className="text-center max-w-2xl mx-auto mb-8">
                  <span className="text-xs font-black uppercase tracking-wider text-[#0D7A6F] dark:text-amber-300 bg-[#FFDC80] dark:bg-amber-400/20 px-3.5 py-1 rounded-full border border-amber-300 dark:border-amber-500/30">
                    SARANA & PRASARANA
                  </span>
                  <h2 className="text-xl sm:text-3xl font-black text-[#2D3436] dark:text-slate-100 mt-3">
                    Fasilitas Lengkap Menunjang Belajar & Nyantri
                  </h2>
                  <p className="text-xs sm:text-sm text-[#636E72] dark:text-slate-400 mt-1">
                    Pesantren didukung fasilitas representatif untuk kenyamanan ibadah, belajar, dan istirahat:
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {profilCms.fasilitas.map((fasi, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-amber-50/40 dark:bg-slate-900/60 border border-amber-200/60 dark:border-slate-800 flex items-center gap-3"
                    >
                      <div className="h-8 w-8 rounded-xl bg-[#138F81] dark:bg-[#2DD4BF] text-white dark:text-slate-900 flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4" />
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-[#2D3436] dark:text-slate-200">
                        {fasi}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* PREVIEW AGENDA KEDATANGAN & PENGUMUMAN TERBARU */}
            {announcements.length > 0 && (
              <section className="rounded-3xl bg-white dark:bg-[#1E293B] border border-amber-200/80 dark:border-slate-800 p-6 sm:p-10 shadow-xl transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-[#0D7A6F] dark:text-amber-300 bg-[#FFDC80] dark:bg-amber-400/20 px-3.5 py-1 rounded-full border border-amber-300 dark:border-amber-500/30">
                      INFO KEDATANGAN & BERITA RESMI
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-[#2D3436] dark:text-slate-100 mt-2">
                      Agenda Santri Baru & Berita Terkini
                    </h2>
                  </div>
                  <button
                    onClick={() => setActiveTab('agenda')}
                    className="inline-flex items-center gap-2 text-xs font-black text-[#138F81] dark:text-[#2DD4BF] hover:underline cursor-pointer"
                  >
                    <span>Lihat Semua Pengumuman ({announcements.length})</span>
                    <ChevronRight size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {announcements.slice(0, 3).map((item) => {
                    const badge = getCategoryBadge(item.category);
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedAnnouncement(item);
                        }}
                        className="p-5 rounded-2xl bg-[#F8FAFC] dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 hover:border-[#138F81] dark:hover:border-[#2DD4BF] transition-all cursor-pointer flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${badge.style}`}>
                              {badge.label}
                            </span>
                            {item.is_pinned && (
                              <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <Sparkles size={11} />
                                <span>Penting</span>
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-black text-[#2D3436] dark:text-slate-100 group-hover:text-[#138F81] dark:group-hover:text-[#2DD4BF] transition-colors mb-2 line-clamp-2">
                            {item.title}
                          </h4>
                          <p className="text-xs text-[#636E72] dark:text-slate-400 line-clamp-3 mb-4">
                            {item.excerpt || item.content}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px] text-[#636E72] dark:text-slate-400">
                          {item.event_date ? (
                            <span className="flex items-center gap-1 font-bold text-amber-700 dark:text-amber-400">
                              <Calendar size={12} />
                              <span>{item.event_date}</span>
                            </span>
                          ) : (
                            <span>{new Date(item.created_at).toLocaleDateString('id-ID')}</span>
                          )}
                          <span className="font-bold text-[#138F81] dark:text-[#2DD4BF]">Baca →</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 4 LANGKAH MUDAH PMB */}
            <section className="rounded-3xl bg-white dark:bg-[#1E293B] border border-amber-200/80 dark:border-slate-800 p-6 sm:p-10 shadow-2xl transition-colors">
              <div className="text-center max-w-2xl mx-auto mb-8">
                <span className="text-xs font-black uppercase tracking-wider text-[#0D7A6F] dark:text-amber-300 bg-[#FFDC80] dark:bg-amber-400/20 px-3.5 py-1 rounded-full border border-amber-300 dark:border-amber-500/30">
                  ALUR PMB MUDAH & CEPAT
                </span>
                <h2 className="text-xl sm:text-3xl font-black text-[#2D3436] dark:text-slate-100 mt-3">
                  4 Langkah Pendaftaran Santri Baru
                </h2>
                <p className="text-xs sm:text-sm text-[#636E72] dark:text-slate-400 mt-1">
                  Proses pendaftaran cepat, transparan, dan dapat dipantau langsung oleh wali santri:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                <div className="p-5 rounded-2xl bg-amber-50/40 dark:bg-slate-900/60 border border-amber-200/70 dark:border-slate-800 relative">
                  <div className="w-9 h-9 rounded-full bg-[#FFDC80] text-[#0D7A6F] font-black text-sm flex items-center justify-center mb-3 border border-amber-300 shadow-xs">
                    1
                  </div>
                  <h3 className="text-sm font-black text-[#2D3436] dark:text-slate-100 mb-1">Isi Formulir Online</h3>
                  <p className="text-xs text-[#636E72] dark:text-slate-400 leading-relaxed">
                    Lengkapi biodata santri, data wali santri, pilihan jenjang madin, dan upload dokumen pendukung.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-amber-50/40 dark:bg-slate-900/60 border border-amber-200/70 dark:border-slate-800 relative">
                  <div className="w-9 h-9 rounded-full bg-[#FFDC80] text-[#0D7A6F] font-black text-sm flex items-center justify-center mb-3 border border-amber-300 shadow-xs">
                    2
                  </div>
                  <h3 className="text-sm font-black text-[#2D3436] dark:text-slate-100 mb-1">Dapatkan No. Registrasi</h3>
                  <p className="text-xs text-[#636E72] dark:text-slate-400 leading-relaxed">
                    Sistem otomatis menerbitkan Nomor Registrasi unik dan mengirimkan notifikasi login via WhatsApp.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-amber-50/40 dark:bg-slate-900/60 border border-amber-200/70 dark:border-slate-800 relative">
                  <div className="w-9 h-9 rounded-full bg-[#FFDC80] text-[#0D7A6F] font-black text-sm flex items-center justify-center mb-3 border border-amber-300 shadow-xs">
                    3
                  </div>
                  <h3 className="text-sm font-black text-[#2D3436] dark:text-slate-100 mb-1">Audit Panitia & Biaya</h3>
                  <p className="text-xs text-[#636E72] dark:text-slate-400 leading-relaxed">
                    Panitia memverifikasi keabsahan dokumen, status biaya pendaftaran, dan kelayakan berkas santri.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-amber-50/40 dark:bg-slate-900/60 border border-amber-200/70 dark:border-slate-800 relative">
                  <div className="w-9 h-9 rounded-full bg-[#138F81] text-white font-black text-sm flex items-center justify-center mb-3 shadow-xs">
                    4
                  </div>
                  <h3 className="text-sm font-black text-[#2D3436] dark:text-slate-100 mb-1">ACC & Masuk Buku Induk</h3>
                  <p className="text-xs text-[#636E72] dark:text-slate-400 leading-relaxed">
                    Santri resmi mendapatkan NIS pondok, penetapan kamar asrama, dan tercatat di Buku Induk Santri.
                  </p>
                </div>
              </div>

              {/* Call to Action Banner di dalam alur */}
              <div className="mt-8 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-[#138F81] to-[#0D7A6F] text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-[#138F81]/20">
                <div>
                  <h3 className="text-lg sm:text-xl font-black">
                    Mari Bergabung dengan Pondok Pesantren Qomaruddin
                  </h3>
                  <p className="text-xs sm:text-sm text-teal-100 mt-0.5">
                    {pmbIsOpen
                      ? 'Kuota santri terbatas untuk menjaga mutu bimbingan dan kenyamanan kamar asrama.'
                      : pmbClosedMessage}
                  </p>
                </div>
                {pmbIsOpen ? (
                  <button
                    onClick={() => {
                      setActiveTab('daftar');
                      setFormStep(1);
                      setRegistrationSuccess(null);
                    }}
                    className="shrink-0 px-6 py-3 rounded-xl bg-[#FFDC80] hover:bg-[#ffe59e] text-[#0D7A6F] font-black text-xs transition-all shadow-md cursor-pointer"
                  >
                    Daftar Santri Baru Sekarang
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveTab('agenda')}
                    className="shrink-0 px-6 py-3 rounded-xl bg-white hover:bg-slate-100 text-[#0D7A6F] font-black text-xs transition-all shadow-md cursor-pointer"
                  >
                    Lihat Pengumuman & Agenda
                  </button>
                )}
              </div>
            </section>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: FORMULIR PENDAFTARAN ONLINE (DENGAN MASTER SAKELAR BUKA/TUTUP) */}
        {/* ========================================================================= */}
        {activeTab === 'daftar' && (
          <section className="max-w-3xl mx-auto">
            {!pmbIsOpen ? (
              /* TAMPILAN JIKA PMB SEDANG DITUTUP SAKELAR ADMIN */
              <div className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-[#1E293B] border-2 border-amber-300 dark:border-slate-700 shadow-2xl text-center">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-5 border border-rose-300 dark:border-rose-800 shadow-sm">
                  <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-rose-600 dark:text-rose-400" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/70 px-4 py-1.5 rounded-full border border-rose-300 dark:border-rose-800">
                  PENDAFTARAN SEMENTARA DITUTUP
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-[#2D3436] dark:text-slate-100 mt-4 mb-2">
                  Penerimaan Santri Baru Ditutup
                </h2>
                <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 dark:bg-slate-900/60 border border-amber-200 dark:border-slate-800 max-w-lg mx-auto mb-8 text-xs sm:text-sm text-[#636E72] dark:text-slate-300 leading-relaxed font-medium">
                  {pmbClosedMessage}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 max-w-lg mx-auto mb-8">
                  <button
                    onClick={() => setActiveTab('status')}
                    className="p-4 rounded-2xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-[#138F81] text-center transition-all cursor-pointer"
                  >
                    <Search className="w-5 h-5 text-[#138F81] dark:text-[#2DD4BF] mx-auto mb-1.5" />
                    <div className="text-xs font-black text-[#2D3436] dark:text-slate-100">Lacak Status</div>
                    <div className="text-[10px] text-[#636E72] dark:text-slate-400 mt-0.5">Bagi yang sudah daftar</div>
                  </button>

                  <button
                    onClick={() => setActiveTab('agenda')}
                    className="p-4 rounded-2xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-[#138F81] text-center transition-all cursor-pointer"
                  >
                    <Megaphone className="w-5 h-5 text-amber-600 dark:text-amber-400 mx-auto mb-1.5" />
                    <div className="text-xs font-black text-[#2D3436] dark:text-slate-100">Agenda & Berita</div>
                    <div className="text-[10px] text-[#636E72] dark:text-slate-400 mt-0.5">Jadwal kedatangan</div>
                  </button>

                  <a
                    href="https://wa.me/6281234567890?text=Assalamu%27alaikum%20Panitia%20PMB%20Qomaruddin%2C%20kapan%20gelombang%20berikutnya%20dibuka%3F"
                    target="_blank"
                    rel="noreferrer"
                    className="p-4 rounded-2xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-[#138F81] text-center transition-all cursor-pointer"
                  >
                    <Phone className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto mb-1.5" />
                    <div className="text-xs font-black text-[#2D3436] dark:text-slate-100">Narahubung</div>
                    <div className="text-[10px] text-[#636E72] dark:text-slate-400 mt-0.5">Konsultasi panitia</div>
                  </a>
                </div>

                <button
                  onClick={() => setActiveTab('beranda')}
                  className="px-6 py-2.5 rounded-xl bg-[#138F81] text-white font-bold text-xs shadow-md hover:bg-[#0D7A6F] transition-all cursor-pointer"
                >
                  Kembali ke Beranda Profil
                </button>
              </div>
            ) : registrationSuccess ? (
              /* MODAL / VIEW SUKSES REGISTRASI */
              <div className="p-6 sm:p-10 rounded-3xl bg-white dark:bg-[#1E293B] border-2 border-emerald-400 dark:border-emerald-600 shadow-xl text-center">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-[#138F81] dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-300 dark:border-emerald-700 shadow-sm">
                  <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-[#138F81] dark:text-emerald-400" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-[#0D7A6F] dark:text-amber-300 bg-[#FFDC80] dark:bg-amber-400/20 px-3.5 py-1 rounded-full border border-amber-300 dark:border-amber-500/30">
                  PENDAFTARAN ONLINE BERHASIL
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-[#2D3436] dark:text-slate-100 mt-3 mb-1.5">
                  Alhamdulillah, Selamat Datang!
                </h2>
                <p className="text-xs sm:text-sm text-[#636E72] dark:text-slate-300 max-w-md mx-auto mb-6">
                  Data calon santri <strong className="text-[#2D3436] dark:text-slate-100">{registrationSuccess.nama_lengkap}</strong> telah resmi terdaftar di Sistem PMB Pondok Pesantren Qomaruddin.
                </p>

                {/* Card Kredensial & Nomor Registrasi */}
                <div className="p-5 sm:p-6 rounded-2xl bg-amber-50/60 dark:bg-slate-900/80 border border-amber-200 dark:border-slate-800 max-w-md mx-auto mb-6 text-left shadow-xs space-y-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-[#636E72] dark:text-slate-400 font-bold">NOMOR REGISTRASI RESMI:</div>
                    <div className="text-2xl sm:text-3xl font-black text-[#138F81] dark:text-[#2DD4BF] tracking-widest font-mono select-all mt-0.5">
                      {registrationSuccess.registration_number}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-amber-200/80 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-black text-[#0D7A6F] dark:text-amber-300">
                      <KeyRound className="w-4 h-4" />
                      <span>AKUN LOGIN PORTAL SANTRI & WALI:</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-white dark:bg-slate-800 p-3 rounded-xl border border-amber-200 dark:border-slate-700 text-xs shadow-xs">
                      <div>
                        <span className="text-[#636E72] dark:text-slate-400 block text-[10px] uppercase font-bold">Username / ID</span>
                        <strong className="text-[#2D3436] dark:text-slate-100 font-mono select-all text-xs">
                          {registrationSuccess.username || registrationSuccess.registration_number}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#636E72] dark:text-slate-400 block text-[10px] uppercase font-bold">Password Otomatis</span>
                        <strong className="text-[#D97706] dark:text-amber-400 font-mono select-all text-xs">
                          {registrationSuccess.random_password || 'Dibuat otomatis'}
                        </strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleCopyCredentials(
                          registrationSuccess.username || registrationSuccess.registration_number,
                          registrationSuccess.random_password || ''
                        )
                      }
                      className="w-full py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-[#0D7A6F] dark:text-amber-300 text-xs font-bold border border-amber-300 dark:border-slate-700 flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      {hasCopiedCredentials ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#138F81] dark:text-[#2DD4BF]" />
                          <span>Kredensial Berhasil Disalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin Username & Password</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* WhatsApp Notification Info */}
                  <div className="pt-3 border-t border-amber-200/80 dark:border-slate-800">
                    <div className="flex items-start gap-2 text-xs text-[#0D7A6F] dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      <MessageCircle className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Notifikasi WhatsApp Telah Terkirim</strong>
                        <span className="text-emerald-900 dark:text-emerald-200">
                          Rincian akun & bukti registrasi telah dikirimkan ke nomor{' '}
                          <strong className="font-mono text-[#2D3436] dark:text-white">{registrationSuccess.no_whatsapp_wali}</strong>.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setActiveTab('status');
                      setSearchKeyword(registrationSuccess.registration_number);
                    }}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Search className="w-4 h-4 text-[#FFDC80]" />
                    <span>Lacak Status & Biaya</span>
                  </button>

                  <button
                    onClick={onOpenLogin}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#FFDC80] dark:bg-slate-800 hover:bg-[#ffe59e] dark:hover:bg-slate-700 text-[#0D7A6F] dark:text-amber-300 font-bold text-xs border border-amber-300 dark:border-slate-700 shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Masuk ke Portal Login</span>
                  </button>

                  <button
                    onClick={() => {
                      setRegistrationSuccess(null);
                      setFormStep(1);
                    }}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#636E72] dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                  >
                    Daftar Santri Lain
                  </button>
                </div>
              </div>
            ) : (
              /* FORMULIR MULTI-STEP WIZARD */
              <div className="bg-white dark:bg-[#1E293B] border border-amber-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-xl transition-colors">
                <div className="text-center mb-8">
                  <span className="text-xs font-black uppercase tracking-wider text-[#0D7A6F] dark:text-amber-300 bg-[#FFDC80] dark:bg-amber-400/20 px-3.5 py-1 rounded-full border border-amber-300 dark:border-amber-500/30">
                    FORMULIR PMB ONLINE
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#2D3436] dark:text-slate-100 mt-3">
                    Pendaftaran Santri Baru
                  </h2>
                  <p className="text-xs sm:text-sm text-[#636E72] dark:text-slate-400 mt-1 font-medium">
                    Gelombang Aktif: <strong className="text-[#138F81] dark:text-[#2DD4BF]">{activeBatch?.nama_gelombang ?? 'TA 2026/2027'}</strong>
                  </p>
                </div>

                {/* Wizard Step Indicators */}
                <div className="flex items-center justify-between max-w-md mx-auto mb-8 relative">
                  <div className="absolute top-1/2 left-0 right-0 h-1 bg-amber-100 dark:bg-slate-800 -translate-y-1/2 z-0" />
                  {[
                    { num: 1, label: 'Santri' },
                    { num: 2, label: 'Program' },
                    { num: 3, label: 'Wali' },
                    { num: 4, label: 'Kirim' }
                  ].map((s) => (
                    <div key={s.num} className="relative z-10 flex flex-col items-center">
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                          formStep === s.num
                            ? 'bg-[#FFDC80] text-[#0D7A6F] ring-4 ring-amber-300/50 shadow-sm scale-110'
                            : formStep > s.num
                            ? 'bg-[#138F81] text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {formStep > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                      </div>
                      <span className="text-[11px] font-bold text-[#636E72] dark:text-slate-400 mt-1 hidden sm:block">
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>

                {submitError && (
                  <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold mb-6 flex items-center gap-2">
                    <Info className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    <span>{submitError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmitRegistration}>
                  {/* STEP 1: DATA CALON SANTRI */}
                  {formStep === 1 && (
                    <div className="space-y-4">
                      <div className="text-sm font-black text-[#138F81] dark:text-[#2DD4BF] border-b border-amber-200 dark:border-slate-800 pb-2">
                        1. Biodata Calon Santri
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-1">
                          Nama Lengkap Calon Santri <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="nama_lengkap"
                          value={form.nama_lengkap}
                          onChange={handleInputChange}
                          placeholder="Contoh: Muhammad Faiz Al-Qodri"
                          className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#138F81] text-sm text-[#2D3436] dark:text-slate-100 outline-none transition-colors"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-1">
                            Nama Panggilan
                          </label>
                          <input
                            type="text"
                            name="nama_panggilan"
                            value={form.nama_panggilan}
                            onChange={handleInputChange}
                            placeholder="Contoh: Faiz"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#138F81] text-sm text-[#2D3436] dark:text-slate-100 outline-none transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-1">
                            Jenis Kelamin <span className="text-rose-500">*</span>
                          </label>
                          <select
                            name="jenis_kelamin"
                            value={form.jenis_kelamin}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#138F81] text-sm text-[#2D3436] dark:text-slate-100 outline-none transition-colors"
                          >
                            <option value="L">Laki-laki (Putra)</option>
                            <option value="P">Perempuan (Putri)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-1">
                            Tempat Lahir
                          </label>
                          <input
                            type="text"
                            name="tempat_lahir"
                            value={form.tempat_lahir}
                            onChange={handleInputChange}
                            placeholder="Contoh: Gresik"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#138F81] text-sm text-[#2D3436] dark:text-slate-100 outline-none transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-1">
                            Tanggal Lahir
                          </label>
                          <input
                            type="date"
                            name="tanggal_lahir"
                            value={form.tanggal_lahir}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#138F81] text-sm text-[#2D3436] dark:text-slate-100 outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-1">
                            NIK (Nomor Induk Kependudukan)
                          </label>
                          <input
                            type="text"
                            name="nik"
                            value={form.nik}
                            onChange={handleInputChange}
                            placeholder="16 digit NIK dari Kartu Keluarga"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#138F81] text-sm text-[#2D3436] dark:text-slate-100 outline-none transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-1">
                            NISN (Nomor Induk Siswa Nasional)
                          </label>
                          <input
                            type="text"
                            name="nisn"
                            value={form.nisn}
                            onChange={handleInputChange}
                            placeholder="Nomor NISN jika ada"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#138F81] text-sm text-[#2D3436] dark:text-slate-100 outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-1">
                          Asal Sekolah Sebelumnya
                        </label>
                        <input
                          type="text"
                          name="asal_sekolah"
                          value={form.asal_sekolah}
                          onChange={handleInputChange}
                          placeholder="Contoh: MI / SD Negeri 1 Bungah"
                          className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#138F81] text-sm text-[#2D3436] dark:text-slate-100 outline-none transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  {/* STEP 2: PILIHAN PROGRAM & ASRAMA */}
                  {formStep === 2 && (
                    <div className="space-y-4">
                      <div className="text-sm font-black text-[#138F81] dark:text-[#2DD4BF] border-b border-amber-200 dark:border-slate-800 pb-2">
                        2. Pilihan Program & Asrama Pondok
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-1">
                          Pilihan Program Pendidikan
                        </label>
                        <select
                          name="pilihan_jenjang"
                          value={form.pilihan_jenjang}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#138F81] text-sm text-[#2D3436] dark:text-slate-100 outline-none transition-colors"
                        >
                          <option value="Madrasah Diniyah & Pondok">Madrasah Diniyah & Pondok (Salaf Reguler)</option>
                          <option value="Tahfidzul Qur'an & Pondok">Tahfidzul Qur'an 30 Juz & Pondok</option>
                          <option value="Kitab Salaf Sorogan & Pondok">Pendalaman Kitab Salaf Sorogan & Bandongan</option>
                          <option value="Pondok & Sekolah Formal MI/MTs/MA">Pondok & Satuan Pendidikan Formal (MTs/MA Assa'adah)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-1">
                          Pilihan Asrama / Tempat Tinggal
                        </label>
                        <select
                          name="pilihan_asrama"
                          value={form.pilihan_asrama}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#138F81] text-sm text-[#2D3436] dark:text-slate-100 outline-none transition-colors"
                        >
                          {form.jenis_kelamin === 'L' ? (
                            <>
                              <option value="Pondok Putra">Asrama Pondok Putra (Mukim Penuh)</option>
                              <option value="Pondok Tahfidz Putra">Komplek Tahfidz Putra</option>
                              <option value="Non-Mukim">Non-Mukim (Kalong / Pulang Pergi)</option>
                            </>
                          ) : (
                            <>
                              <option value="Pondok Putri">Asrama Pondok Putri (Mukim Penuh)</option>
                              <option value="Pondok Tahfidz Putri">Komplek Tahfidz Putri</option>
                              <option value="Non-Mukim">Non-Mukim (Kalong / Pulang Pergi)</option>
                            </>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-1">
                          Riwayat Kesehatan / Bakat Khusus Santri (Opsional)
                        </label>
                        <textarea
                          name="catatan_khusus"
                          rows={3}
                          value={form.catatan_khusus}
                          onChange={handleInputChange}
                          placeholder="Catatan riwayat alergi, penyakit tertentu, atau prestasi tahfidz/hadrah sebelumnya..."
                          className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#138F81] text-sm text-[#2D3436] dark:text-slate-100 outline-none transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  {/* STEP 3: DATA ORANG TUA / WALI */}
                  {formStep === 3 && (
                    <div className="space-y-4">
                      <div className="text-sm font-black text-[#138F81] dark:text-[#2DD4BF] border-b border-amber-200 dark:border-slate-800 pb-2">
                        3. Biodata Orang Tua & Kontak WhatsApp
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-1">
                          Nomor WhatsApp Aktif Wali / Orang Tua <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            name="no_whatsapp_wali"
                            value={form.no_whatsapp_wali}
                            onChange={handleInputChange}
                            placeholder="Contoh: 081234567890"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#138F81] text-sm text-[#2D3436] dark:text-slate-100 outline-none transition-colors pl-11"
                            required
                          />
                          <Phone className="w-4 h-4 text-[#138F81] dark:text-[#2DD4BF] absolute left-3.5 top-3" />
                        </div>
                        <p className="text-[11px] text-[#0D7A6F] dark:text-teal-400 font-semibold mt-1">
                          Nomor ini wajib aktif untuk menerima konfirmasi akun portal wali dan pengumuman seleksi.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-1">
                            Nama Lengkap Ayah
                          </label>
                          <input
                            type="text"
                            name="nama_ayah"
                            value={form.nama_ayah}
                            onChange={handleInputChange}
                            placeholder="Nama ayah kandung"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#138F81] text-sm text-[#2D3436] dark:text-slate-100 outline-none transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-1">
                            Pekerjaan Ayah
                          </label>
                          <input
                            type="text"
                            name="pekerjaan_ayah"
                            value={form.pekerjaan_ayah}
                            onChange={handleInputChange}
                            placeholder="Contoh: Wiraswasta / Guru / PNS"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#138F81] text-sm text-[#2D3436] dark:text-slate-100 outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-1">
                            Nama Lengkap Ibu
                          </label>
                          <input
                            type="text"
                            name="nama_ibu"
                            value={form.nama_ibu}
                            onChange={handleInputChange}
                            placeholder="Nama ibu kandung"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#138F81] text-sm text-[#2D3436] dark:text-slate-100 outline-none transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-1">
                            Pekerjaan Ibu
                          </label>
                          <input
                            type="text"
                            name="pekerjaan_ibu"
                            value={form.pekerjaan_ibu}
                            onChange={handleInputChange}
                            placeholder="Contoh: Ibu Rumah Tangga / Guru"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#138F81] text-sm text-[#2D3436] dark:text-slate-100 outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-1">
                          Alamat Lengkap Tempat Tinggal
                        </label>
                        <textarea
                          name="alamat_lengkap"
                          rows={2}
                          value={form.alamat_lengkap}
                          onChange={handleInputChange}
                          placeholder="Jalan, RT/RW, Dusun/Desa, Kecamatan..."
                          className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#138F81] text-sm text-[#2D3436] dark:text-slate-100 outline-none transition-colors"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-1">
                            Kabupaten / Kota
                          </label>
                          <input
                            type="text"
                            name="kota"
                            value={form.kota}
                            onChange={handleInputChange}
                            placeholder="Contoh: Gresik / Surabaya / Lamongan"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#138F81] text-sm text-[#2D3436] dark:text-slate-100 outline-none transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-1">
                            Provinsi
                          </label>
                          <input
                            type="text"
                            name="provinsi"
                            value={form.provinsi}
                            onChange={handleInputChange}
                            placeholder="Contoh: Jawa Timur"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#138F81] text-sm text-[#2D3436] dark:text-slate-100 outline-none transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: UPLOAD BERKAS & KONFIRMASI */}
                  {formStep === 4 && (
                    <div className="space-y-4">
                      <div className="text-sm font-black text-[#138F81] dark:text-[#2DD4BF] border-b border-amber-200 dark:border-slate-800 pb-2">
                        4. Upload Berkas & Konfirmasi Pendaftaran
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                          <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-1">
                            Pas Foto Calon Santri (Opsional)
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setFotoFile(e.target.files?.[0] || null)}
                            className="text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#FFDC80] file:text-[#0D7A6F] hover:file:bg-[#ffe59e] cursor-pointer"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Format JPG, PNG (Maksimal 5 MB)</p>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                          <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-1">
                            Foto / Scan Kartu Keluarga (Opsional)
                          </label>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => setKkFile(e.target.files?.[0] || null)}
                            className="text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#FFDC80] file:text-[#0D7A6F] hover:file:bg-[#ffe59e] cursor-pointer"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Format PDF atau Gambar (Maksimal 5 MB)</p>
                        </div>
                      </div>

                      {/* Ringkasan Pernyataan */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 dark:bg-slate-900/60 border border-amber-200 dark:border-slate-800 text-xs space-y-1.5">
                        <div className="font-black text-[#0D7A6F] dark:text-amber-300 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-[#138F81] dark:text-[#2DD4BF]" />
                          <span>Pernyataan Kesungguhan & Kebenaran Data</span>
                        </div>
                        <p className="text-[#636E72] dark:text-slate-300 leading-relaxed">
                          Dengan mengirimkan formulir pendaftaran ini, saya selaku orang tua / wali calon santri menyatakan bahwa data yang diisi adalah benar. Saya bersedia mentaati segenap tata tertib serta bimbingan di Pondok Pesantren Qomaruddin Sampurnan Bungah Gresik.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Wizard Bottom Navigation Buttons */}
                  <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800 mt-6">
                    {formStep > 1 ? (
                      <button
                        type="button"
                        onClick={handlePrevStep}
                        className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[#2D3436] dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                      >
                        ← Kembali
                      </button>
                    ) : (
                      <div />
                    )}

                    {formStep < 4 ? (
                      <button
                        type="button"
                        onClick={handleNextStep}
                        className="px-6 py-2.5 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white text-xs font-black shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <span>Lanjut Langkah Berikutnya</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#138F81] to-[#0D7A6F] hover:from-[#0e7467] hover:to-[#09574e] text-white text-xs font-black shadow-lg shadow-[#138F81]/25 flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            <span>Mengirim Data Pendaftaran...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-[#FFDC80]" />
                            <span>Kirim Pendaftaran Santri Baru</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}
          </section>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: CEK STATUS PENDAFTARAN, AUDIT, BIAYA, & PENERIMAAN BUKU INDUK */}
        {/* ========================================================================= */}
        {activeTab === 'status' && (
          <section className="max-w-3xl mx-auto">
            <div className="bg-white dark:bg-[#1E293B] border border-amber-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-xl transition-colors">
              <div className="text-center mb-8">
                <span className="text-xs font-black uppercase tracking-wider text-[#0D7A6F] dark:text-amber-300 bg-[#FFDC80] dark:bg-amber-400/20 px-3.5 py-1 rounded-full border border-amber-300 dark:border-amber-500/30">
                  PELACAKAN REALTIME PMB
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-[#2D3436] dark:text-slate-100 mt-3">
                  Cek Status Pendaftaran & Hasil Seleksi
                </h2>
                <p className="text-xs sm:text-sm text-[#636E72] dark:text-slate-400 mt-1">
                  Masukkan Nomor Registrasi (contoh: <span className="font-mono font-bold text-[#138F81] dark:text-[#2DD4BF]">PMB-2026-0001</span>) atau Nomor WhatsApp yang terdaftar.
                </p>
              </div>

              {/* Form Search Input */}
              <form onSubmit={handleCheckStatus} className="max-w-xl mx-auto mb-6">
                <div className="flex items-center gap-2 bg-[#F8FAFC] dark:bg-slate-900 p-2 rounded-2xl border-2 border-amber-200 dark:border-slate-700 focus-within:border-[#138F81] dark:focus-within:border-[#2DD4BF] shadow-xs transition-colors">
                  <Search className="w-5 h-5 text-[#138F81] dark:text-[#2DD4BF] ml-3 shrink-0" />
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="Ketik Nomor Registrasi atau No. WhatsApp..."
                    className="flex-1 bg-transparent px-3 py-2 text-sm text-[#2D3436] dark:text-slate-100 placeholder-slate-400 outline-none font-medium"
                  />
                  <button
                    type="submit"
                    disabled={isSearchingStatus}
                    className="px-6 py-2.5 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white text-xs font-black shadow-md disabled:opacity-50 transition-all shrink-0 cursor-pointer"
                  >
                    {isSearchingStatus ? 'Mencari...' : 'Lacak Status'}
                  </button>
                </div>
              </form>

              {statusSearchError && (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold max-w-xl mx-auto mb-6 text-center">
                  {statusSearchError}
                </div>
              )}

              {/* Hasil Pencarian */}
              {statusResults && statusResults.length > 0 && (
                <div className="space-y-4 max-w-2xl mx-auto pt-2">
                  <div className="text-xs font-black text-[#138F81] dark:text-[#2DD4BF] uppercase tracking-wider">
                    Ditemukan {statusResults.length} Data Pendaftaran:
                  </div>

                  {statusResults.map((item) => {
                    const isAccepted = item.status === 'accepted';
                    const isRejected = item.status === 'rejected';
                    const isReviewed = item.status === 'reviewed';

                    return (
                      <div
                        key={item.id}
                        className={`p-6 rounded-3xl border-2 transition-all shadow-sm ${
                          isAccepted
                            ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700'
                            : isRejected
                            ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                            : isReviewed
                            ? 'bg-sky-50/80 dark:bg-sky-950/30 border-sky-300 dark:border-sky-800'
                            : 'bg-amber-50/60 dark:bg-slate-900/60 border-amber-200 dark:border-slate-700'
                        }`}
                      >
                        {/* Header Hasil */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-700/80 pb-3 mb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-black text-[#138F81] dark:text-[#2DD4BF] bg-white dark:bg-slate-800 px-2.5 py-1 rounded-md border border-amber-200 dark:border-slate-700 shadow-2xs">
                                {item.registration_number}
                              </span>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FFDC80] dark:bg-amber-400/20 text-[#0D7A6F] dark:text-amber-300 border border-amber-300 dark:border-amber-600/30">
                                {item.gelombang}
                              </span>
                            </div>
                            <h3 className="text-lg font-black text-[#2D3436] dark:text-slate-100 mt-2">{item.nama_lengkap}</h3>
                            <p className="text-xs text-[#636E72] dark:text-slate-400 font-semibold">
                              {item.pilihan_jenjang} • {item.pilihan_asrama}
                            </p>
                          </div>

                          {/* Status Seleksi Badge */}
                          <div>
                            <span
                              className={`px-3.5 py-1.5 rounded-full text-xs font-black inline-flex items-center gap-1.5 shadow-xs ${
                                isAccepted
                                  ? 'bg-[#138F81] text-white'
                                  : isRejected
                                  ? 'bg-rose-600 text-white'
                                  : isReviewed
                                  ? 'bg-sky-600 text-white'
                                  : 'bg-[#FFDC80] text-[#0D7A6F] border border-amber-300'
                              }`}
                            >
                              {isAccepted && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                              {item.status_label}
                            </span>
                          </div>
                        </div>

                        {/* STATUS PEMBAYARAN FORMULIR PMB */}
                        <div className="mb-4 p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-[#636E72] dark:text-slate-400">
                              STATUS BIAYA PENDAFTARAN PMB
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.payment_status === 'lunas' ? (
                                <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 size={14} />
                                  <span>LUNAS (Rp {Number(item.payment_amount || 0).toLocaleString('id-ID')})</span>
                                </span>
                              ) : item.payment_status === 'perlu_pelunasan' ? (
                                <span className="inline-flex items-center gap-1 text-xs font-black text-amber-600 dark:text-amber-400">
                                  <AlertCircle size={14} />
                                  <span>PERLU PELUNASAN: Rp {Number(item.payment_amount || 0).toLocaleString('id-ID')}</span>
                                </span>
                              ) : item.payment_status === 'gratis' ? (
                                <span className="inline-flex items-center gap-1 text-xs font-black text-sky-600 dark:text-sky-400">
                                  <Sparkles size={14} />
                                  <span>GRATIS / BEASISWA</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-black text-slate-600 dark:text-slate-400">
                                  <Clock size={14} />
                                  <span>MENUNGGU VERIFIKASI BIAYA</span>
                                </span>
                              )}
                            </div>
                            {item.payment_notes && (
                              <p className="text-[11px] text-[#636E72] dark:text-slate-400 mt-1 italic">
                                Catatan: {item.payment_notes}
                              </p>
                            )}
                          </div>

                          <div className="shrink-0 text-right sm:text-right">
                            <span className="text-[11px] text-[#636E72] dark:text-slate-400 block">Biaya Formulir</span>
                            <span className="font-bold text-xs text-[#2D3436] dark:text-slate-200">
                              Rp {Number(item.payment_amount || 0).toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>

                        {/* STATUS BUKU INDUK JIKA DI-ACC RESMI */}
                        {item.is_converted && (
                          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white mb-4 shadow-md">
                            <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-amber-200 mb-2">
                              <Award className="w-4 h-4 text-amber-300" />
                              <span>RESMI TERDAFTAR DI BUKU INDUK SANTRI</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                              <div className="bg-white/10 p-2.5 rounded-xl">
                                <span className="text-emerald-100 text-[10px] block uppercase font-bold">NIS Resmi</span>
                                <strong className="font-mono text-sm">{item.nis_resmi || 'Menunggu Sinkron'}</strong>
                              </div>
                              <div className="bg-white/10 p-2.5 rounded-xl">
                                <span className="text-emerald-100 text-[10px] block uppercase font-bold">Kelas Diniyah</span>
                                <strong>{item.kelas_resmi || '-'}</strong>
                              </div>
                              <div className="bg-white/10 p-2.5 rounded-xl col-span-2 sm:col-span-1">
                                <span className="text-emerald-100 text-[10px] block uppercase font-bold">Kamar Asrama</span>
                                <strong>{item.kamar_resmi || '-'}</strong>
                              </div>
                            </div>
                            <p className="text-[11px] text-emerald-100 mt-2.5 leading-relaxed">
                              🎉 Selamat! Calon santri telah resmi di-ACC dan terdaftar di Buku Induk Santri Pondok Pesantren Qomaruddin. Silakan unduh atau cetak Bukti Penerimaan resmi di bawah ini.
                            </p>
                          </div>
                        )}

                        {/* Catatan Panitia */}
                        {item.catatan_admin && (
                          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-[#2D3436] dark:text-slate-200 mb-4">
                            <strong className="text-[#0D7A6F] dark:text-amber-300">Catatan Panitia PMB:</strong> {item.catatan_admin}
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#636E72] dark:text-slate-400 pt-1">
                          <span>Tanggal Daftar: <strong className="text-[#2D3436] dark:text-slate-200">{item.tanggal_daftar}</strong></span>
                          <button
                            onClick={() => setSelectedCardToPrint(item)}
                            className="px-4 py-2 rounded-xl bg-[#FFDC80] dark:bg-slate-800 hover:bg-[#ffe59e] dark:hover:bg-slate-700 text-[#0D7A6F] dark:text-amber-300 border border-amber-300 dark:border-slate-700 font-black flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Cetak Kartu Tanda Peserta</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: AGENDA KEDATANGAN & BERITA SANTRI BARU */}
        {/* ========================================================================= */}
        {activeTab === 'agenda' && (
          <section className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white dark:bg-[#1E293B] border border-amber-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-xl transition-colors">
              <div className="text-center max-w-2xl mx-auto mb-8">
                <span className="text-xs font-black uppercase tracking-wider text-[#0D7A6F] dark:text-amber-300 bg-[#FFDC80] dark:bg-amber-400/20 px-3.5 py-1 rounded-full border border-amber-300 dark:border-amber-500/30">
                  INFORMASI RESMI PMB
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-[#2D3436] dark:text-slate-100 mt-3">
                  Agenda Kedatangan & Berita Santri Baru
                </h2>
                <p className="text-xs sm:text-sm text-[#636E72] dark:text-slate-400 mt-1">
                  Pantau tanggal wajib hadir di asrama, daftar berkas fisik asli yang wajib dibawa, serta pengumuman seleksi berkala.
                </p>
              </div>

              {/* Filter Tabs Kategori */}
              <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
                {[
                  { key: 'all', label: 'Semua Informasi' },
                  { key: 'agenda_kedatangan', label: '📅 Agenda Kedatangan' },
                  { key: 'pengumuman', label: '📢 Pengumuman Seleksi' },
                  { key: 'alur_berkas', label: '📋 Berkas Fisik Wajib' },
                  { key: 'berita', label: '📰 Berita Pesantren' }
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setAnnouncementFilter(f.key)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      announcementFilter === f.key
                        ? 'bg-[#138F81] text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-[#636E72] dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Daftar Pengumuman */}
              {filteredAnnouncements.length === 0 ? (
                <div className="p-10 rounded-2xl bg-amber-50/40 dark:bg-slate-900/40 border border-amber-200/60 dark:border-slate-800 text-center">
                  <Megaphone className="w-10 h-10 text-amber-500 mx-auto mb-3 opacity-60" />
                  <h4 className="text-sm font-black text-[#2D3436] dark:text-slate-200">
                    Belum Ada Pengumuman Pada Kategori Ini
                  </h4>
                  <p className="text-xs text-[#636E72] dark:text-slate-400 mt-1">
                    Panitia PMB akan segera mempublikasikan agenda kedatangan santri dan jadwal berkas. Silakan cek berkala.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAnnouncements.map((item) => {
                    const badge = getCategoryBadge(item.category);
                    return (
                      <div
                        key={item.id}
                        className="p-6 rounded-2xl bg-[#F8FAFC] dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 hover:border-[#138F81] dark:hover:border-[#2DD4BF] transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${badge.style}`}>
                              {badge.label}
                            </span>
                            {item.is_pinned && (
                              <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 flex items-center gap-1 bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-300">
                                <Sparkles size={11} />
                                <span>Penting / Diutamakan</span>
                              </span>
                            )}
                          </div>
                          {item.event_date && (
                            <div className="flex items-center gap-1.5 text-xs font-black text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-xl border border-amber-300 dark:border-amber-800 w-fit">
                              <Calendar size={13} />
                              <span>Tanggal Acara: {item.event_date}</span>
                            </div>
                          )}
                        </div>

                        <h3 className="text-base sm:text-lg font-black text-[#2D3436] dark:text-slate-100 mb-2">
                          {item.title}
                        </h3>

                        <p className="text-xs sm:text-sm text-[#636E72] dark:text-slate-300 leading-relaxed whitespace-pre-line mb-4">
                          {item.content}
                        </p>

                        <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-[11px] text-[#636E72] dark:text-slate-400">
                          <span>
                            Diterbitkan oleh: <strong className="text-[#2D3436] dark:text-slate-200">{item.author?.name || 'Panitia PMB Qomaruddin'}</strong>
                          </span>
                          <span>{new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* 🌟 MODAL DETAIL PENGUMUMAN DARI BERANDA */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E293B] text-[#2D3436] dark:text-slate-100 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative border-2 border-amber-300 dark:border-slate-700">
            <button
              onClick={() => setSelectedAnnouncement(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${getCategoryBadge(selectedAnnouncement.category).style}`}>
                {getCategoryBadge(selectedAnnouncement.category).label}
              </span>
              {selectedAnnouncement.event_date && (
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <Calendar size={12} />
                  <span>{selectedAnnouncement.event_date}</span>
                </span>
              )}
            </div>

            <h3 className="text-lg font-black text-[#2D3436] dark:text-slate-100 mb-4">
              {selectedAnnouncement.title}
            </h3>

            <div className="max-h-80 overflow-y-auto pr-2 text-xs sm:text-sm text-[#636E72] dark:text-slate-300 leading-relaxed whitespace-pre-line bg-[#F8FAFC] dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 mb-6">
              {selectedAnnouncement.content}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-[#636E72] dark:text-slate-400">
                Oleh: <strong>{selectedAnnouncement.author?.name || 'Panitia PMB'}</strong>
              </span>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="px-5 py-2 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white font-black cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL CETAK KARTU RESMI PMB */}
      {selectedCardToPrint && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-[#2D3436] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative border-2 border-amber-300">
            <button
              onClick={() => setSelectedCardToPrint(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Kartu Bukti Pendaftaran */}
            <div className="border-b-2 border-amber-300 pb-4 mb-5 text-center flex flex-col items-center">
              <div className="h-12 w-12 rounded-xl bg-white p-1 border border-amber-200 shadow-xs mb-2">
                <img src="/logo-qomaruddin.png" alt="Logo" className="h-full w-full object-contain" />
              </div>
              <div className="text-[11px] font-black uppercase tracking-widest text-[#138F81]">
                {profilCms?.nama_pesantren ? profilCms.nama_pesantren.toUpperCase() : 'YAYASAN PONDOK PESANTREN QOMARUDDIN'}
              </div>
              <h3 className="text-lg font-black text-[#2D3436] mt-0.5">
                KARTU BUKTI PENDAFTARAN PMB
              </h3>
              <p className="text-[11px] text-[#636E72] font-medium">
                {profilCms?.alamat || 'Jl. Sampurnan No. 01 Bungah Gresik'} • {selectedCardToPrint.gelombang}
              </p>
            </div>

            {/* Detail Kartu */}
            <div className="space-y-2.5 text-xs mb-6 bg-[#F8FAFC] p-4 rounded-2xl border border-slate-200">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-[#636E72] font-semibold">No. Registrasi:</span>
                <span className="font-mono font-black text-[#138F81] text-sm">
                  {selectedCardToPrint.registration_number}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-[#636E72] font-semibold">Nama Calon Santri:</span>
                <span className="font-black text-[#2D3436]">{selectedCardToPrint.nama_lengkap}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-[#636E72] font-semibold">Jenis Kelamin:</span>
                <span className="font-bold text-[#2D3436]">
                  {selectedCardToPrint.jenis_kelamin === 'L' ? 'Laki-laki (Putra)' : 'Perempuan (Putri)'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-[#636E72] font-semibold">Program Pendidikan:</span>
                <span className="font-bold text-[#2D3436]">{selectedCardToPrint.pilihan_jenjang}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-[#636E72] font-semibold">Asrama Dipilih:</span>
                <span className="font-bold text-[#2D3436]">{selectedCardToPrint.pilihan_asrama}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-[#636E72] font-semibold">Status Seleksi:</span>
                <span className="font-black text-[#138F81]">{selectedCardToPrint.status_label}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-[#636E72] font-semibold">Status Pembayaran:</span>
                <span className="font-black text-amber-700 uppercase">
                  {selectedCardToPrint.payment_status} (Rp {Number(selectedCardToPrint.payment_amount || 0).toLocaleString('id-ID')})
                </span>
              </div>
              {selectedCardToPrint.is_converted && (
                <div className="flex justify-between border-b border-slate-200 pb-2 bg-emerald-50 p-2 rounded-xl border border-emerald-300">
                  <span className="text-emerald-800 font-bold">NIS Resmi Pondok:</span>
                  <span className="font-mono font-black text-emerald-900">{selectedCardToPrint.nis_resmi || '-'}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#636E72] font-semibold">Waktu Mendaftar:</span>
                <span className="font-bold text-[#2D3436]">{selectedCardToPrint.tanggal_daftar}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setSelectedCardToPrint(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#636E72] hover:bg-slate-100 cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak / Simpan PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL BAGIKAN LINK PMB */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1E293B] border-2 border-amber-300 dark:border-slate-700 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-left relative">
            <button
              onClick={() => setIsShareModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-2xl bg-[#FFDC80] text-[#0D7A6F] flex items-center justify-center border border-amber-300 shadow-xs">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#2D3436] dark:text-slate-100">Bagikan Info PMB Online</h3>
                <p className="text-xs text-[#636E72] dark:text-slate-400 font-semibold">{profilCms?.nama_pesantren || 'Pondok Pesantren Qomaruddin Gresik'}</p>
              </div>
            </div>

            <p className="text-xs text-[#636E72] dark:text-slate-300 leading-relaxed mb-5 font-medium">
              Sebarkan link pendaftaran santri baru kepada kerabat, sanak saudara, dan grup media sosial:
            </p>

            {/* Input Link & Tombol Salin */}
            <div className="mb-5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#636E72] dark:text-slate-400 mb-1.5">
                Link Resmi PMB Publik:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getPublicPmbUrl()}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-[#138F81] dark:text-[#2DD4BF] select-all outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyPmbLink}
                  className="px-4 py-2.5 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white text-xs font-black shrink-0 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  {hasCopiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#FFDC80]" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Tombol Bagikan WhatsApp Langsung */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full py-3 rounded-2xl bg-[#25D366] hover:bg-[#20BD5A] text-white text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-[#25D366]/25 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-white" />
                <span>Bagikan Langsung via WhatsApp</span>
              </button>

              <a
                href={`https://wa.me/${profilCms?.telepon?.replace(/\D/g, '') || '6281234567890'}?text=Assalamu%27alaikum%20Panitia%20PMB%20Qomaruddin%2C%20saya%20ingin%20konsultasi%20pendaftaran`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#0D7A6F] dark:text-amber-300 text-xs font-bold border border-amber-300 dark:border-slate-700 flex items-center justify-center gap-2 transition-all"
              >
                <Phone className="w-3.5 h-3.5 text-[#138F81] dark:text-[#2DD4BF]" />
                <span>Hubungi Narahubung Panitia PMB</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 FOOTER RESMI PESANTREN (CLEAN & KONSISTEN / OBSIDIAN DARK) */}
      <footer className="bg-white dark:bg-[#1E293B] border-t-2 border-amber-300 dark:border-slate-800 mt-12 py-10 text-[#636E72] dark:text-slate-400 text-xs shadow-inner transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-slate-800 p-1 border border-amber-200 dark:border-slate-700">
                  <img src="/logo-qomaruddin.png" alt="Logo Qomaruddin" className="h-full w-full object-contain" />
                </div>
                <div>
                  <h4 className="font-black text-[#2D3436] dark:text-slate-100 text-sm sm:text-base">
                    {profilCms?.nama_pesantren || 'Pondok Pesantren Qomaruddin'}
                  </h4>
                  <p className="text-[11px] text-[#0D7A6F] dark:text-[#2DD4BF] font-bold">
                    Sampurnan Bungah Gresik • Berdiri Sejak 1775 M
                  </p>
                </div>
              </div>
              <p className="text-[#636E72] dark:text-slate-400 text-xs leading-relaxed max-w-md mb-3">
                Pondok pesantren tertua dan bersejarah di Kabupaten Gresik yang mendidik santri berakhlaqul karimah, berhaluan Ahlussunnah wal Jama'ah an-Nahdliyyah.
              </p>
              <div className="flex items-center gap-2 text-xs text-[#2D3436] dark:text-slate-200 font-semibold">
                <MapPin className="w-4 h-4 text-[#138F81] dark:text-[#2DD4BF] shrink-0" />
                <span>{profilCms?.alamat || 'Jl. Sampurnan No. 01, Bungah, Gresik, Jawa Timur 61152'}</span>
              </div>
            </div>

            <div>
              <h4 className="text-[#2D3436] dark:text-slate-100 font-black mb-3 text-xs uppercase tracking-wider">
                Layanan PMB
              </h4>
              <ul className="space-y-2 font-medium">
                <li>
                  <button onClick={() => setActiveTab('beranda')} className="hover:text-[#138F81] dark:hover:text-[#2DD4BF] transition-colors">
                    Profil Lembaga
                  </button>
                </li>
                <li>
                  <button onClick={() => { setActiveTab('daftar'); setFormStep(1); }} className="hover:text-[#138F81] dark:hover:text-[#2DD4BF] transition-colors">
                    Formulir Pendaftaran
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveTab('status')} className="hover:text-[#138F81] dark:hover:text-[#2DD4BF] transition-colors">
                    Cek Status & Biaya
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveTab('agenda')} className="hover:text-[#138F81] dark:hover:text-[#2DD4BF] transition-colors">
                    Agenda Kedatangan Santri
                  </button>
                </li>
                <li>
                  <button onClick={onOpenLogin} className="hover:text-[#138F81] dark:hover:text-[#2DD4BF] transition-colors flex items-center gap-1">
                    <span>Portal Staf Pegawai</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-[#2D3436] dark:text-slate-100 font-black mb-3 text-xs uppercase tracking-wider">
                Kontak Sekretariat
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold text-[#2D3436] dark:text-slate-200">
                  <Phone className="w-3.5 h-3.5 text-[#138F81] dark:text-[#2DD4BF]" />
                  <span>{profilCms?.telepon || '0812-3456-7890'} (Sekretariat PMB)</span>
                </div>
                <div className="flex items-center gap-2 text-[#636E72] dark:text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-[#138F81] dark:text-[#2DD4BF]" />
                  <span>Senin - Ahad: 08.00 - 16.00 WIB</span>
                </div>
                <div className="pt-2">
                  <a
                    href={`https://wa.me/${profilCms?.telepon?.replace(/\D/g, '') || '6281234567890'}?text=Assalamu%27alaikum%2C%20saya%20ingin%20bertanya%20tentang%20PMB%20Santri%20Baru%20PP%20Qomaruddin`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 font-bold transition-all shadow-xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span>WhatsApp Panitia PMB</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <p className="text-[11px] text-[#7B8794] dark:text-slate-500">
              © {new Date().getFullYear()} {profilCms?.nama_pesantren || 'Yayasan Pondok Pesantren Qomaruddin'}. Hak Cipta Dilindungi.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500">
              <span>Managed & Engineered by</span>
              <span className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-[#0D7A6F] dark:text-amber-300 font-black border border-amber-200 dark:border-amber-800">
                IT QOMARUDDIN ( ITQOM )
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* 📲 PWA 1-Click Install Banner */}
      <PwaInstallBanner />

      {/* 🔔 Izin Notifikasi Real-Time PMB & Agenda */}
      <NotificationPermissionPrompt role="public" />
    </div>
  );
}
