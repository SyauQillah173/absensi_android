import {
  Award,
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
  GraduationCap,
  HeartHandshake,
  HelpCircle,
  Home,
  Info,
  KeyRound,
  Landmark,
  LogIn,
  MapPin,
  MessageCircle,
  Phone,
  Printer,
  QrCode,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api, type ApiRecord } from '../services/api';

interface PublicPmbLandingPageProps {
  onOpenLogin: () => void;
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
  catatan_admin: string | null;
  gelombang: string;
  tanggal_daftar: string;
  is_converted: boolean;
}

export function PublicPmbLandingPage({ onOpenLogin }: PublicPmbLandingPageProps) {
  const [activeTab, setActiveTab] = useState<'beranda' | 'daftar' | 'status'>('beranda');
  const [activeBatch, setActiveBatch] = useState<ActiveBatch | null>(null);
  const [totalRegistered, setTotalRegistered] = useState(0);
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
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
    setTimeout(() => setHasCopiedLink(false), 2500);
  };

  const handleCopyCredentials = (username: string, pass: string) => {
    const text = `Akun Login PMB Qomaruddin:\nUsername: ${username}\nPassword: ${pass}\nPortal: ${getPublicPmbUrl()}`;
    navigator.clipboard.writeText(text);
    setHasCopiedCredentials(true);
    setTimeout(() => setHasCopiedCredentials(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `*PENERIMAAN SANTRI BARU (PMB)*\n` +
      `*PONDOK PESANTREN QOMARUDDIN*\n` +
      `_Sampurnan, Bungah, Gresik, Jawa Timur (Sejak 1775 M)_\n\n` +
      `Pendaftaran Santri Baru telah resmi dibuka untuk jenjang:\n` +
      `• Madrasah Diniyah Salafiyah\n` +
      `• Tahfidzul Qur'an 30 Juz Bersanad\n` +
      `• Pendidikan Formal (MTs / MA / SMK / Universitas)\n\n` +
      `Daftar online & informasi lengkap profil pondok dapat diakses di link resmi berikut:\n` +
      `${getPublicPmbUrl()}\n\n` +
      `Mari bersama menuntun putra/putri kita meraih ilmu agama yang berkah dan berakhlaqul karimah.`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  // Form Registration State (Wizard Steps: 1, 2, 3, 4)
  const [formStep, setFormStep] = useState(1);
  const [form, setForm] = useState({
    nama_lengkap: '',
    nama_panggilan: '',
    jenis_kelamin: 'L',
    nik: '',
    nisn: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    alamat_lengkap: '',
    provinsi: 'Jawa Timur',
    kota: 'Gresik',
    kecamatan: 'Bungah',
    asal_sekolah: '',
    pilihan_jenjang: 'Madrasah Diniyah & Pondok',
    pilihan_asrama: 'Pondok Putra',
    nama_ayah: '',
    pekerjaan_ayah: '',
    nama_ibu: '',
    pekerjaan_ibu: '',
    nama_wali: '',
    no_whatsapp_wali: '',
    catatan_khusus: '',
  });

  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [kkFile, setKkFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [registrationSuccess, setRegistrationSuccess] = useState<RegistrationResult | null>(null);

  // Status Tracker State
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearchingStatus, setIsSearchingStatus] = useState(false);
  const [statusResults, setStatusResults] = useState<StatusCheckItem[] | null>(null);
  const [statusSearchError, setStatusSearchError] = useState('');
  const [selectedCardToPrint, setSelectedCardToPrint] = useState<StatusCheckItem | null>(null);

  useEffect(() => {
    fetchPmbInfo();
  }, []);

  const fetchPmbInfo = async () => {
    setIsLoadingInfo(true);
    try {
      const res = await api.get('/pmb/info');
      if (res && res.data) {
        setActiveBatch(res.data.active_batch || null);
        setTotalRegistered(res.data.total_registered || 0);
        setQuotaRemaining(res.data.quota_remaining ?? null);
      }
    } catch (e) {
      console.warn('Gagal memuat info PMB:', e);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => {
      const updated = { ...prev, [name]: value };
      // Otomatis sesuaikan asrama jika jenis kelamin berubah
      if (name === 'jenis_kelamin') {
        updated.pilihan_asrama = value === 'P' ? 'Pondok Putri' : 'Pondok Putra';
      }
      return updated;
    });
  };

  const handleNextStep = () => {
    if (formStep === 1) {
      if (!form.nama_lengkap.trim()) {
        setSubmitError('Nama lengkap calon santri wajib diisi.');
        return;
      }
    }
    if (formStep === 3) {
      if (!form.no_whatsapp_wali.trim()) {
        setSubmitError('Nomor WhatsApp aktif wali/orang tua wajib diisi untuk konfirmasi seleksi.');
        return;
      }
    }
    setSubmitError('');
    setFormStep(prev => Math.min(prev + 1, 4));
  };

  const handlePrevStep = () => {
    setSubmitError('');
    setFormStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!form.nama_lengkap.trim() || !form.no_whatsapp_wali.trim()) {
      setSubmitError('Mohon lengkapi Nama Lengkap dan Nomor WhatsApp Wali.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, val]) => {
        if (val) formData.append(key, String(val));
      });

      if (activeBatch) {
        formData.append('pmb_batch_id', String(activeBatch.id));
      }

      if (fotoFile) formData.append('dokumen_foto', fotoFile);
      if (kkFile) formData.append('dokumen_kk', kkFile);

      const res = await api.postForm<RegistrationResult>('/pmb/register', formData);
      if (res && res.data) {
        setRegistrationSuccess(res.data);
        // Refresh batch stats
        fetchPmbInfo();
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
        setStatusSearchError('Data pendaftaran tidak ditemukan.');
      }
    } catch (err: any) {
      setStatusSearchError(err?.message || 'Nomor pendaftaran atau nomor WhatsApp tidak ditemukan.');
    } finally {
      setIsSearchingStatus(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#071E19] text-white flex flex-col font-sans selection:bg-[#138F81] selection:text-white">
      {/* 🌟 LUXURY ISLAMIC PATTERN TOP BAR & NAVBAR */}
      <header className="sticky top-0 z-50 bg-[#0A2922]/90 backdrop-blur-md border-b border-[#138F81]/25 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo & Identity */}
            <div 
              onClick={() => setActiveTab('beranda')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#138F81] to-[#0A4B42] p-0.5 shadow-lg shadow-[#138F81]/20 group-hover:scale-105 transition-transform flex items-center justify-center border border-[#4ADE80]/30">
                <Landmark className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white group-hover:text-[#4ADE80] transition-colors">
                    PP. QOMARUDDIN
                  </span>
                  <span className="text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full bg-[#138F81]/30 text-[#5EEAD4] border border-[#138F81]/50">
                    EST. 1775 M
                  </span>
                </div>
                <p className="text-xs text-[#A7F3D0] hidden sm:block">
                  Sampurnan Bungah Gresik • Portal PMB & Profil Resmi
                </p>
              </div>
            </div>

            {/* Nav Menu Tabs */}
            <nav className="hidden md:flex items-center gap-1 bg-[#051814]/60 p-1.5 rounded-2xl border border-[#138F81]/30">
              <button
                onClick={() => setActiveTab('beranda')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'beranda'
                    ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/40'
                    : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                }`}
              >
                Beranda & Profil
              </button>
              <button
                onClick={() => {
                  setActiveTab('daftar');
                  setFormStep(1);
                  setRegistrationSuccess(null);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === 'daftar'
                    ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/40'
                    : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 text-[#5EEAD4]" />
                Daftar Online
              </button>
              <button
                onClick={() => setActiveTab('status')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === 'status'
                    ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/40'
                    : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                }`}
              >
                <Search className="w-3.5 h-3.5 text-[#FCD34D]" />
                Cek Status Kelulusan
              </button>
            </nav>

            {/* Quick Actions: Share PMB & Login Portal Staff */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setIsShareModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-xs font-bold bg-[#10B981]/20 hover:bg-[#10B981]/30 text-[#6EE7B7] border border-[#10B981]/40 hover:border-[#6EE7B7] transition-all shadow-sm"
                title="Bagikan Info PMB ke WhatsApp / Media Sosial"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Bagikan PMB</span>
              </button>

              <button
                onClick={onOpenLogin}
                className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs font-bold bg-[#138F81]/15 hover:bg-[#138F81]/30 text-[#A7F3D0] border border-[#138F81]/40 hover:border-[#4ADE80] transition-all duration-200 shadow-sm"
              >
                <LogIn className="w-4 h-4 text-[#4ADE80]" />
                <span className="hidden sm:inline">Masuk Portal Pegawai</span>
                <span className="sm:hidden">Login</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 🌟 CONTENT AREA */}
      <main className="flex-1">
        {activeTab === 'beranda' && (
          <div>
            {/* HERO SECTION */}
            <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 border-b border-[#138F81]/20">
              {/* Glow background effects */}
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-[#138F81]/20 to-[#4ADE80]/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -top-10 right-10 w-72 h-72 bg-[#D97706]/10 rounded-full blur-2xl pointer-events-none" />

              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                {/* Active Gelombang Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#138F81]/30 to-[#D97706]/20 border border-[#4ADE80]/40 text-xs font-bold text-[#A7F3D0] mb-6 shadow-inner animate-pulse">
                  <Sparkles className="w-3.5 h-3.5 text-[#FCD34D]" />
                  <span>
                    {activeBatch ? activeBatch.nama_gelombang : 'PMB Tahun Ajaran 2026/2027 Telah Dibuka!'}
                  </span>
                </div>

                {/* Main Heading */}
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight max-w-4xl mx-auto mb-6">
                  Penerimaan Santri Baru (PMB) <br className="hidden sm:inline" />
                  <span className="bg-gradient-to-r from-[#4ADE80] via-[#5EEAD4] to-[#FCD34D] bg-clip-text text-transparent">
                    Pondok Pesantren Qomaruddin
                  </span>
                </h1>

                {/* Tagline / Subtitle */}
                <p className="text-sm sm:text-base lg:text-lg text-[#CBD5E1] max-w-2xl mx-auto mb-10 leading-relaxed">
                  Menyemai generasi tafaqquh fiddin, berakhlaqul karimah, dan berwawasan luas dengan barokah sanad keilmuan salaf sejak 1775 M di Sampurnan Bungah Gresik.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto mb-14">
                  <button
                    onClick={() => {
                      setActiveTab('daftar');
                      setFormStep(1);
                      setRegistrationSuccess(null);
                    }}
                    className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-[#138F81] to-[#0D6B60] hover:from-[#16A394] hover:to-[#0F7A6E] text-white font-extrabold text-sm shadow-xl shadow-[#138F81]/30 hover:shadow-[#138F81]/50 hover:scale-102 transition-all flex items-center justify-center gap-2 border border-[#4ADE80]/30"
                  >
                    <UserPlus className="w-5 h-5 text-[#5EEAD4]" />
                    <span>Daftar Santri Baru Sekarang</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setActiveTab('status')}
                    className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-[#0F352C]/80 hover:bg-[#138F81]/20 text-white font-bold text-sm border border-[#138F81]/40 hover:border-[#5EEAD4] transition-all flex items-center justify-center gap-2"
                  >
                    <Search className="w-4 h-4 text-[#FCD34D]" />
                    <span>Cek Status Kelulusan</span>
                  </button>
                </div>

                {/* Live Stats Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto pt-6 border-t border-[#138F81]/20">
                  <div className="p-4 rounded-2xl bg-[#092720]/70 border border-[#138F81]/30 text-center">
                    <div className="text-2xl sm:text-3xl font-black text-[#4ADE80]">250+</div>
                    <div className="text-xs text-[#94A3B8] mt-0.5 font-medium">Tahun Berdiri (1775 M)</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#092720]/70 border border-[#138F81]/30 text-center">
                    <div className="text-2xl sm:text-3xl font-black text-[#5EEAD4]">1.650+</div>
                    <div className="text-xs text-[#94A3B8] mt-0.5 font-medium">Santri Putra & Putri</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#092720]/70 border border-[#138F81]/30 text-center">
                    <div className="text-2xl sm:text-3xl font-black text-[#FCD34D]">30 Juz</div>
                    <div className="text-xs text-[#94A3B8] mt-0.5 font-medium">Tahfidz Bersanad</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#092720]/70 border border-[#138F81]/30 text-center">
                    <div className="text-2xl sm:text-3xl font-black text-white">{totalRegistered}</div>
                    <div className="text-xs text-[#94A3B8] mt-0.5 font-medium">Pendaftar Gelombang Ini</div>
                  </div>
                </div>
              </div>
            </section>

            {/* SEJARAH & NILAI LUHUR */}
            <section className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-5 relative">
                  <div className="relative rounded-3xl overflow-hidden border-2 border-[#138F81]/40 bg-gradient-to-br from-[#0C382E] to-[#061C17] p-8 shadow-2xl">
                    <div className="h-16 w-16 rounded-2xl bg-[#138F81]/20 flex items-center justify-center border border-[#4ADE80]/40 mb-6">
                      <Landmark className="w-8 h-8 text-[#4ADE80]" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">Pesantren Salaf Tertua & Bersejarah</h3>
                    <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed mb-6">
                      Didirikan oleh Kiai Qomaruddin pada tahun 1775 M, Pondok Pesantren Qomaruddin Sampurnan Bungah telah melahirkan ribuan ulama, kiai, cendekiawan, dan pemimpin umat yang tersebar di seluruh pelosok nusantara dan mancanegara.
                    </p>
                    <div className="space-y-3 border-t border-[#138F81]/30 pt-4">
                      <div className="flex items-center gap-3 text-xs text-[#A7F3D0]">
                        <CheckCircle2 className="w-4 h-4 text-[#4ADE80] shrink-0" />
                        <span>Sanad keilmuan muttashil bersambung ke Rasulullah SAW</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#A7F3D0]">
                        <CheckCircle2 className="w-4 h-4 text-[#4ADE80] shrink-0" />
                        <span>Kombinasi sorogan salaf dan manajemen modern terakreditasi</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#A7F3D0]">
                        <CheckCircle2 className="w-4 h-4 text-[#4ADE80] shrink-0" />
                        <span>Terbuka untuk santri mukim (asrama) dari seluruh Indonesia</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-6">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#4ADE80] bg-[#138F81]/20 px-3 py-1 rounded-lg border border-[#138F81]/40">
                      PROGRAM PENDIDIKAN UNGGULAN
                    </span>
                    <h2 className="text-2xl sm:text-4xl font-extrabold text-white mt-3">
                      Pilihan Jenjang & Kurikulum Terpadu
                    </h2>
                    <p className="text-sm text-[#94A3B8] mt-2">
                      Pesantren menyediakan jalur pendidikan komprehensif bagi santri putra maupun putri:
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-5 rounded-2xl bg-[#092B23]/70 border border-[#138F81]/30 hover:border-[#4ADE80] transition-colors">
                      <div className="h-10 w-10 rounded-xl bg-[#138F81]/20 flex items-center justify-center text-[#5EEAD4] mb-3">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <h4 className="text-base font-bold text-white mb-1">Madrasah Diniyah Salafiyah</h4>
                      <p className="text-xs text-[#94A3B8] leading-relaxed">
                        Kajian kitab kuning berjenjang (Sifir Awal, Wustho, Ulya) mendalami Fiqih, Nahwu-Sharaf, Tauhid, Hadits, dan Akhlaq.
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#092B23]/70 border border-[#138F81]/30 hover:border-[#4ADE80] transition-colors">
                      <div className="h-10 w-10 rounded-xl bg-[#D97706]/20 flex items-center justify-center text-[#FCD34D] mb-3">
                        <Award className="w-5 h-5" />
                      </div>
                      <h4 className="text-base font-bold text-white mb-1">Tahfidzul Qur'an 30 Juz</h4>
                      <p className="text-xs text-[#94A3B8] leading-relaxed">
                        Halaqah tahfidz intensif dengan musyrif mutqin, setoran tartil, muraja'ah rutin, dan bimbingan tasmi' bersanad.
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#092B23]/70 border border-[#138F81]/30 hover:border-[#4ADE80] transition-colors">
                      <div className="h-10 w-10 rounded-xl bg-[#3B82F6]/20 flex items-center justify-center text-[#93C5FD] mb-3">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <h4 className="text-base font-bold text-white mb-1">Sekolah Formal Terpadu</h4>
                      <p className="text-xs text-[#94A3B8] leading-relaxed">
                        Pilihan sekolah formal di lingkungan Yayasan: MI, MTs, MA, SMA, SMK Assa'adah Bungah dengan fasilitas laboratorium lengkap.
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#092B23]/70 border border-[#138F81]/30 hover:border-[#4ADE80] transition-colors">
                      <div className="h-10 w-10 rounded-xl bg-[#10B981]/20 flex items-center justify-center text-[#6EE7B7] mb-3">
                        <Home className="w-5 h-5" />
                      </div>
                      <h4 className="text-base font-bold text-white mb-1">Asrama Pondok Putra & Putri</h4>
                      <p className="text-xs text-[#94A3B8] leading-relaxed">
                        Komplek pondok yang bersih dan nyaman, pembinaan sholat jama'ah 5 waktu, pengajian kitab bandongan, dan muhadhoroh.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ALUR PENDAFTARAN (STEP BY STEP) */}
            <section className="py-16 bg-[#061A15] border-y border-[#138F81]/20">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-3xl mx-auto mb-14">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#FCD34D] bg-[#D97706]/20 px-3 py-1 rounded-lg border border-[#D97706]/30">
                    PANDUAN PMB
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-extrabold text-white mt-3">
                    4 Langkah Mudah Mendaftar Santri Baru
                  </h2>
                  <p className="text-xs sm:text-sm text-[#94A3B8] mt-2">
                    Proses pendaftaran dirancang cepat, transparan, dan dapat dipantau langsung oleh wali santri dari rumah:
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="p-6 rounded-2xl bg-[#08221B] border border-[#138F81]/30 relative group hover:border-[#4ADE80] transition-all">
                    <div className="w-8 h-8 rounded-full bg-[#138F81] text-white font-extrabold text-xs flex items-center justify-center mb-4">
                      1
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">Isi Formulir Online</h3>
                    <p className="text-xs text-[#94A3B8] leading-relaxed">
                      Lengkapi biodata calon santri, data orang tua/wali, pilihan jenjang, dan upload dokumen KK/foto.
                    </p>
                  </div>

                  <div className="p-6 rounded-2xl bg-[#08221B] border border-[#138F81]/30 relative group hover:border-[#4ADE80] transition-all">
                    <div className="w-8 h-8 rounded-full bg-[#138F81] text-white font-extrabold text-xs flex items-center justify-center mb-4">
                      2
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">Dapatkan No. Registrasi</h3>
                    <p className="text-xs text-[#94A3B8] leading-relaxed">
                      Sistem langsung menerbitkan Nomor Registrasi unik (contoh: PMB-2026-0001) dan kartu tanda daftar.
                    </p>
                  </div>

                  <div className="p-6 rounded-2xl bg-[#08221B] border border-[#138F81]/30 relative group hover:border-[#4ADE80] transition-all">
                    <div className="w-8 h-8 rounded-full bg-[#138F81] text-white font-extrabold text-xs flex items-center justify-center mb-4">
                      3
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">Verifikasi Panitia PMB</h3>
                    <p className="text-xs text-[#94A3B8] leading-relaxed">
                      Panitia PMB meninjau keabsahan berkas, tes baca Al-Qur'an/bakat santri, dan kelayakan penempatan.
                    </p>
                  </div>

                  <div className="p-6 rounded-2xl bg-[#08221B] border border-[#138F81]/30 relative group hover:border-[#4ADE80] transition-all">
                    <div className="w-8 h-8 rounded-full bg-[#10B981] text-white font-extrabold text-xs flex items-center justify-center mb-4">
                      4
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">ACC & Penetapan Santri</h3>
                    <p className="text-xs text-[#94A3B8] leading-relaxed">
                      Santri resmi menerima NIS pondok, pembagian kamar asrama & kelas Madin, serta akun login wali santri.
                    </p>
                  </div>
                </div>

                {/* Banner Ajakan Daftar */}
                <div className="mt-14 p-8 rounded-3xl bg-gradient-to-r from-[#0C382E] to-[#0A4B42] border border-[#4ADE80]/30 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
                  <div>
                    <h3 className="text-xl font-bold text-white">Siap Menjadi Bagian dari Keluarga Besar Qomaruddin?</h3>
                    <p className="text-xs sm:text-sm text-[#A7F3D0] mt-1">
                      Kuota santri terbatas untuk menjaga mutu bimbingan dan kenyamanan asrama.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('daftar');
                      setFormStep(1);
                      setRegistrationSuccess(null);
                    }}
                    className="shrink-0 px-6 py-3.5 rounded-xl bg-white text-[#0A4B42] font-black text-xs hover:bg-[#FCD34D] transition-colors shadow-lg"
                  >
                    Daftar Santri Baru Sekarang
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* 🌟 TAB FORMULIR PENDAFTARAN ONLINE */}
        {activeTab === 'daftar' && (
          <section className="py-12 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            {registrationSuccess ? (
              /* MODAL / VIEW SUKSES REGISTRASI */
              <div className="p-8 sm:p-10 rounded-3xl bg-[#092B23] border-2 border-[#4ADE80]/50 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="h-20 w-20 rounded-full bg-[#4ADE80]/20 text-[#4ADE80] flex items-center justify-center mx-auto mb-6 border border-[#4ADE80]/40 shadow-lg shadow-[#4ADE80]/20">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#4ADE80] bg-[#138F81]/30 px-3.5 py-1 rounded-full border border-[#4ADE80]/40">
                  PENDAFTARAN ONLINE BERHASIL
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white mt-4 mb-2">
                  Alhamdulillah, Selamat Datang!
                </h2>
                <p className="text-sm text-[#CBD5E1] max-w-lg mx-auto mb-6">
                  Data calon santri <strong className="text-white font-bold">{registrationSuccess.nama_lengkap}</strong> telah resmi terdaftar di Sistem PMB Pondok Pesantren Qomaruddin.
                </p>

                {/* Card Kredensial Login & Nomor Registrasi */}
                <div className="p-6 rounded-2xl bg-[#061A15] border border-[#138F81]/60 max-w-md mx-auto mb-6 text-left shadow-2xl space-y-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-[#94A3B8] font-bold">NOMOR REGISTRASI RESMI:</div>
                    <div className="text-2xl sm:text-3xl font-black text-[#FCD34D] tracking-widest font-mono select-all mt-0.5">
                      {registrationSuccess.registration_number}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#138F81]/30 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#4ADE80]">
                      <KeyRound className="w-4 h-4" />
                      <span>AKUN LOGIN PORTAL SANTRI & WALI:</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-[#092B23] p-3 rounded-xl border border-[#138F81]/40 text-xs">
                      <div>
                        <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Username / ID</span>
                        <strong className="text-white font-mono select-all text-xs">
                          {registrationSuccess.username || registrationSuccess.registration_number}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Password Sistem</span>
                        <strong className="text-[#FCD34D] font-mono select-all text-xs">
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
                      className="w-full py-2 rounded-xl bg-[#138F81]/20 hover:bg-[#138F81]/30 text-[#6EE7B7] text-xs font-bold border border-[#138F81]/40 flex items-center justify-center gap-1.5 transition-all"
                    >
                      {hasCopiedCredentials ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#4ADE80]" />
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

                  {/* WhatsApp Notification Status */}
                  <div className="pt-3 border-t border-[#138F81]/30">
                    <div className="flex items-start gap-2 text-xs text-[#A7F3D0] bg-[#10B981]/15 p-2.5 rounded-xl border border-[#10B981]/30">
                      <MessageCircle className="w-4 h-4 text-[#4ADE80] shrink-0 mt-0.5" />
                      <div>
                        <strong className="block text-white font-semibold">Notifikasi WhatsApp Dikirimkan</strong>
                        <span>
                          Rincian akun login & konfirmasi pendaftaran telah dikirim ke nomor{' '}
                          <strong className="text-white font-mono">{registrationSuccess.no_whatsapp_wali}</strong>.
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
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#138F81] hover:bg-[#16A394] text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Search className="w-4 h-4" />
                    <span>Lacak Status & Cetak Kartu</span>
                  </button>

                  <button
                    onClick={onOpenLogin}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-[#10B981] to-[#0D9488] hover:from-[#059669] hover:to-[#0F766E] text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Masuk ke Portal Login</span>
                  </button>

                  <button
                    onClick={() => {
                      setRegistrationSuccess(null);
                      setFormStep(1);
                    }}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#0F352C] hover:bg-[#138F81]/20 text-[#A7F3D0] font-bold text-xs border border-[#138F81]/40 transition-colors cursor-pointer"
                  >
                    Daftar Santri Lain
                  </button>
                </div>
              </div>
            ) : (
              /* FORMULIR MULTI-STEP WIZARD */
              <div className="bg-[#092720] border border-[#138F81]/40 rounded-3xl p-6 sm:p-10 shadow-2xl">
                <div className="text-center mb-8">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#4ADE80] bg-[#138F81]/30 px-3 py-1 rounded-full border border-[#138F81]/50">
                    FORMULIR ONLINE PMB
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white mt-3">
                    Pendaftaran Calon Santri Baru
                  </h2>
                  <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
                    Gelombang Aktif: <strong className="text-[#FCD34D]">{activeBatch?.nama_gelombang ?? 'TA 2026/2027'}</strong>
                  </p>
                </div>

                {/* Wizard Step Indicators */}
                <div className="flex items-center justify-between max-w-md mx-auto mb-8 relative">
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[#138F81]/30 -translate-y-1/2 z-0" />
                  {[
                    { num: 1, label: 'Santri' },
                    { num: 2, label: 'Program' },
                    { num: 3, label: 'Orang Tua' },
                    { num: 4, label: 'Kirim' }
                  ].map((s) => (
                    <div key={s.num} className="relative z-10 flex flex-col items-center">
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          formStep === s.num
                            ? 'bg-[#4ADE80] text-[#071E19] ring-4 ring-[#4ADE80]/20 font-black scale-110'
                            : formStep > s.num
                            ? 'bg-[#138F81] text-white'
                            : 'bg-[#061A15] text-[#64748B] border border-[#138F81]/40'
                        }`}
                      >
                        {formStep > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                      </div>
                      <span className="text-[10px] font-semibold text-[#94A3B8] mt-1 hidden sm:block">
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>

                {submitError && (
                  <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-semibold mb-6 flex items-center gap-2">
                    <Info className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{submitError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmitRegistration}>
                  {/* STEP 1: DATA CALON SANTRI */}
                  {formStep === 1 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div className="text-sm font-bold text-[#A7F3D0] border-b border-[#138F81]/30 pb-2">
                        1. Biodata Calon Santri
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                          Nama Lengkap Calon Santri <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          name="nama_lengkap"
                          value={form.nama_lengkap}
                          onChange={handleInputChange}
                          placeholder="Contoh: Muhammad Faiz Al-Qodri"
                          className="w-full px-4 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 focus:border-[#4ADE80] focus:ring-1 focus:ring-[#4ADE80] text-sm text-white placeholder-slate-500 outline-none"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                            Nama Panggilan
                          </label>
                          <input
                            type="text"
                            name="nama_panggilan"
                            value={form.nama_panggilan}
                            onChange={handleInputChange}
                            placeholder="Contoh: Faiz"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 focus:border-[#4ADE80] text-sm text-white placeholder-slate-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                            Jenis Kelamin <span className="text-rose-400">*</span>
                          </label>
                          <select
                            name="jenis_kelamin"
                            value={form.jenis_kelamin}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 focus:border-[#4ADE80] text-sm text-white outline-none"
                          >
                            <option value="L">Laki-laki (Putra)</option>
                            <option value="P">Perempuan (Putri)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                            Tempat Lahir
                          </label>
                          <input
                            type="text"
                            name="tempat_lahir"
                            value={form.tempat_lahir}
                            onChange={handleInputChange}
                            placeholder="Contoh: Gresik"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 focus:border-[#4ADE80] text-sm text-white placeholder-slate-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                            Tanggal Lahir
                          </label>
                          <input
                            type="date"
                            name="tanggal_lahir"
                            value={form.tanggal_lahir}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 focus:border-[#4ADE80] text-sm text-white outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                            NIK (Nomor Induk Kependudukan)
                          </label>
                          <input
                            type="text"
                            name="nik"
                            value={form.nik}
                            onChange={handleInputChange}
                            placeholder="16 Digit NIK dari Kartu Keluarga"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 focus:border-[#4ADE80] text-sm text-white placeholder-slate-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                            NISN (Nomor Induk Siswa Nasional)
                          </label>
                          <input
                            type="text"
                            name="nisn"
                            value={form.nisn}
                            onChange={handleInputChange}
                            placeholder="Nomor NISN jika ada"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 focus:border-[#4ADE80] text-sm text-white placeholder-slate-500 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                          Asal Sekolah Sebelumnya
                        </label>
                        <input
                          type="text"
                          name="asal_sekolah"
                          value={form.asal_sekolah}
                          onChange={handleInputChange}
                          placeholder="Contoh: MI / SD Negeri 1 Bungah"
                          className="w-full px-4 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 focus:border-[#4ADE80] text-sm text-white placeholder-slate-500 outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* STEP 2: PILIHAN PROGRAM & ASRAMA */}
                  {formStep === 2 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div className="text-sm font-bold text-[#A7F3D0] border-b border-[#138F81]/30 pb-2">
                        2. Pilihan Program & Asrama Pondok
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                          Pilihan Program Pendidikan
                        </label>
                        <select
                          name="pilihan_jenjang"
                          value={form.pilihan_jenjang}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 focus:border-[#4ADE80] text-sm text-white outline-none"
                        >
                          <option value="Madrasah Diniyah & Pondok">Madrasah Diniyah & Pondok (Salaf Reguler)</option>
                          <option value="Tahfidzul Qur'an & Pondok">Tahfidzul Qur'an 30 Juz & Pondok</option>
                          <option value="Kitab Salaf Sorogan & Pondok">Pendalaman Kitab Salaf Sorogan & Bandongan</option>
                          <option value="Pondok & Sekolah Formal MI/MTs/MA">Pondok & Satuan Pendidikan Formal (MTs/MA Assa'adah)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                          Pilihan Asrama / Tempat Tinggal
                        </label>
                        <select
                          name="pilihan_asrama"
                          value={form.pilihan_asrama}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 focus:border-[#4ADE80] text-sm text-white outline-none"
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
                        <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                          Riwayat Kesehatan / Bakat Khusus Santri (Opsional)
                        </label>
                        <textarea
                          name="catatan_khusus"
                          rows={3}
                          value={form.catatan_khusus}
                          onChange={handleInputChange}
                          placeholder="Catatan riwayat alergi, penyakit tertentu, atau prestasi tahfidz/hadrah sebelumnya..."
                          className="w-full px-4 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 focus:border-[#4ADE80] text-sm text-white placeholder-slate-500 outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* STEP 3: DATA ORANG TUA / WALI */}
                  {formStep === 3 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div className="text-sm font-bold text-[#A7F3D0] border-b border-[#138F81]/30 pb-2">
                        3. Biodata Orang Tua & Kontak WhatsApp
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                          Nomor WhatsApp Aktif Wali / Orang Tua <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            name="no_whatsapp_wali"
                            value={form.no_whatsapp_wali}
                            onChange={handleInputChange}
                            placeholder="Contoh: 081234567890"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 focus:border-[#4ADE80] text-sm text-white placeholder-slate-500 outline-none pl-11"
                            required
                          />
                          <Phone className="w-4 h-4 text-[#4ADE80] absolute left-3.5 top-3" />
                        </div>
                        <p className="text-[11px] text-[#A7F3D0] mt-1">
                          Nomor ini akan digunakan panitia untuk informasi hasil seleksi dan akun portal wali santri.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                            Nama Lengkap Ayah
                          </label>
                          <input
                            type="text"
                            name="nama_ayah"
                            value={form.nama_ayah}
                            onChange={handleInputChange}
                            placeholder="Nama ayah kandung"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 focus:border-[#4ADE80] text-sm text-white placeholder-slate-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                            Pekerjaan Ayah
                          </label>
                          <input
                            type="text"
                            name="pekerjaan_ayah"
                            value={form.pekerjaan_ayah}
                            onChange={handleInputChange}
                            placeholder="Contoh: Wiraswasta / Guru / PNS"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 focus:border-[#4ADE80] text-sm text-white placeholder-slate-500 outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                            Nama Lengkap Ibu
                          </label>
                          <input
                            type="text"
                            name="nama_ibu"
                            value={form.nama_ibu}
                            onChange={handleInputChange}
                            placeholder="Nama ibu kandung"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 focus:border-[#4ADE80] text-sm text-white placeholder-slate-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                            Pekerjaan Ibu
                          </label>
                          <input
                            type="text"
                            name="pekerjaan_ibu"
                            value={form.pekerjaan_ibu}
                            onChange={handleInputChange}
                            placeholder="Contoh: Ibu Rumah Tangga / Guru"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 focus:border-[#4ADE80] text-sm text-white placeholder-slate-500 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                          Alamat Lengkap Asal Santri
                        </label>
                        <textarea
                          name="alamat_lengkap"
                          rows={2}
                          value={form.alamat_lengkap}
                          onChange={handleInputChange}
                          placeholder="Nama Jalan, RT/RW, Dusun/Desa, Kecamatan..."
                          className="w-full px-4 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 focus:border-[#4ADE80] text-sm text-white placeholder-slate-500 outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                            Kabupaten / Kota
                          </label>
                          <input
                            type="text"
                            name="kota"
                            value={form.kota}
                            onChange={handleInputChange}
                            placeholder="Contoh: Gresik / Surabaya / Lamongan"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 focus:border-[#4ADE80] text-sm text-white placeholder-slate-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                            Provinsi
                          </label>
                          <input
                            type="text"
                            name="provinsi"
                            value={form.provinsi}
                            onChange={handleInputChange}
                            placeholder="Contoh: Jawa Timur"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 focus:border-[#4ADE80] text-sm text-white placeholder-slate-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: UPLOAD BERKAS & KONFIRMASI */}
                  {formStep === 4 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div className="text-sm font-bold text-[#A7F3D0] border-b border-[#138F81]/30 pb-2">
                        4. Upload Berkas & Konfirmasi Pendaftaran
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-[#061A15] border border-[#138F81]/30">
                          <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                            Pas Foto Calon Santri (Opsional)
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setFotoFile(e.target.files?.[0] || null)}
                            className="text-xs text-[#94A3B8] file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#138F81]/30 file:text-[#A7F3D0] hover:file:bg-[#138F81]/50 cursor-pointer"
                          />
                          <p className="text-[10px] text-[#64748B] mt-1">Format JPG, PNG (Maks 5 MB)</p>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#061A15] border border-[#138F81]/30">
                          <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                            Foto / Scan Kartu Keluarga (Opsional)
                          </label>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => setKkFile(e.target.files?.[0] || null)}
                            className="text-xs text-[#94A3B8] file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#138F81]/30 file:text-[#A7F3D0] hover:file:bg-[#138F81]/50 cursor-pointer"
                          />
                          <p className="text-[10px] text-[#64748B] mt-1">Format PDF atau Foto (Maks 5 MB)</p>
                        </div>
                      </div>

                      {/* Ringkasan Konfirmasi */}
                      <div className="p-5 rounded-2xl bg-[#061A15] border border-[#138F81]/40 text-xs space-y-2">
                        <div className="font-bold text-[#FCD34D] mb-2 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" />
                          <span>Pernyataan Kebenaran Data</span>
                        </div>
                        <p className="text-[#94A3B8] leading-relaxed">
                          Dengan mengirim formulir ini, saya selaku orang tua/wali menyatakan bahwa data yang diisikan adalah benar. Saya bersedia mengikuti seluruh tata tertib dan bimbingan di Pondok Pesantren Qomaruddin Sampurnan Bungah Gresik.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Wizard Bottom Navigation Buttons */}
                  <div className="flex items-center justify-between pt-6 border-t border-[#138F81]/30 mt-6">
                    {formStep > 1 ? (
                      <button
                        type="button"
                        onClick={handlePrevStep}
                        className="px-5 py-2.5 rounded-xl bg-[#061A15] hover:bg-[#138F81]/20 text-[#A7F3D0] text-xs font-bold border border-[#138F81]/40 transition-colors"
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
                        className="px-6 py-2.5 rounded-xl bg-[#138F81] hover:bg-[#16A394] text-white text-xs font-extrabold shadow-lg flex items-center gap-1.5 transition-colors"
                      >
                        <span>Lanjut Langkah Berikutnya</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#10B981] to-[#0D9488] hover:from-[#059669] hover:to-[#0F766E] text-white text-xs font-black shadow-xl shadow-[#10B981]/30 flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                            <span>Mengirim Data...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-[#A7F3D0]" />
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

        {/* 🌟 TAB CEK STATUS & PELACAKAN KELULUSAN */}
        {activeTab === 'status' && (
          <section className="py-12 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-[#092720] border border-[#138F81]/40 rounded-3xl p-6 sm:p-10 shadow-2xl">
              <div className="text-center mb-8">
                <span className="text-xs font-bold uppercase tracking-wider text-[#FCD34D] bg-[#D97706]/20 px-3 py-1 rounded-full border border-[#D97706]/30">
                  PELACAKAN REALTIME
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white mt-3">
                  Cek Status Pendaftaran & Kelulusan PMB
                </h2>
                <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
                  Masukkan Nomor Registrasi (contoh: <span className="font-mono text-[#4ADE80]">PMB-2026-0001</span>) atau Nomor WhatsApp yang terdaftar.
                </p>
              </div>

              {/* Form Search Input */}
              <form onSubmit={handleCheckStatus} className="max-w-xl mx-auto mb-8">
                <div className="flex items-center gap-2 bg-[#061A15] p-2 rounded-2xl border border-[#138F81]/50 focus-within:border-[#4ADE80] shadow-lg">
                  <Search className="w-5 h-5 text-[#4ADE80] ml-3 shrink-0" />
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="Ketik Nomor Registrasi atau No. WA..."
                    className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-slate-500 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSearchingStatus}
                    className="px-6 py-2.5 rounded-xl bg-[#138F81] hover:bg-[#16A394] text-white text-xs font-extrabold shadow-md disabled:opacity-50 transition-colors shrink-0"
                  >
                    {isSearchingStatus ? 'Mencari...' : 'Lacak'}
                  </button>
                </div>
              </form>

              {statusSearchError && (
                <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-semibold max-w-xl mx-auto mb-6 text-center">
                  {statusSearchError}
                </div>
              )}

              {/* Hasil Pencarian */}
              {statusResults && statusResults.length > 0 && (
                <div className="space-y-4 max-w-2xl mx-auto animate-in fade-in duration-200">
                  <div className="text-xs font-bold text-[#A7F3D0] uppercase tracking-wider">
                    Ditemukan {statusResults.length} Data Pendaftaran:
                  </div>

                  {statusResults.map((item) => {
                    const isAccepted = item.status === 'accepted';
                    const isPending = item.status === 'pending';
                    const isReviewed = item.status === 'reviewed';
                    const isRejected = item.status === 'rejected';

                    return (
                      <div
                        key={item.id}
                        className={`p-6 rounded-2xl border transition-all ${
                          isAccepted
                            ? 'bg-[#0B3A2C]/80 border-[#4ADE80]/60 shadow-lg shadow-[#4ADE80]/10'
                            : isRejected
                            ? 'bg-rose-950/30 border-rose-500/40'
                            : 'bg-[#061A15] border-[#138F81]/40'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4 mb-4">
                          <div>
                            <span className="text-[11px] font-mono font-bold text-[#FCD34D] bg-[#FCD34D]/10 px-2.5 py-1 rounded-md border border-[#FCD34D]/30">
                              {item.registration_number}
                            </span>
                            <h3 className="text-lg font-black text-white mt-2">{item.nama_lengkap}</h3>
                            <p className="text-xs text-[#94A3B8]">
                              {item.pilihan_jenjang} • {item.pilihan_asrama}
                            </p>
                          </div>

                          {/* Status Badge */}
                          <div>
                            <span
                              className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm ${
                                isAccepted
                                  ? 'bg-[#10B981] text-white shadow-[#10B981]/30'
                                  : isRejected
                                  ? 'bg-rose-600 text-white'
                                  : isReviewed
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-amber-500 text-black'
                              }`}
                            >
                              {isAccepted && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                              {item.status_label}
                            </span>
                          </div>
                        </div>

                        {/* Catatan Admin / Instruksi Panitia */}
                        {item.catatan_admin && (
                          <div className="p-3.5 rounded-xl bg-black/30 border border-white/10 text-xs text-[#CBD5E1] mb-4">
                            <strong className="text-[#FCD34D]">Catatan Panitia:</strong> {item.catatan_admin}
                          </div>
                        )}

                        {isAccepted && (
                          <div className="p-4 rounded-xl bg-[#4ADE80]/10 border border-[#4ADE80]/30 text-xs text-[#A7F3D0] mb-4">
                            🎉 <strong>Selamat!</strong> Calon santri telah lolos seleksi dan resmi diterima di Pondok Pesantren Qomaruddin. Silakan hubungi Sekretariat PMB untuk konfirmasi kedatangan ke pondok.
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs text-[#64748B] pt-1">
                          <span>Tanggal Daftar: {item.tanggal_daftar}</span>
                          <button
                            onClick={() => setSelectedCardToPrint(item)}
                            className="px-3.5 py-1.5 rounded-lg bg-[#138F81]/20 hover:bg-[#138F81]/40 text-[#5EEAD4] font-bold flex items-center gap-1.5 border border-[#138F81]/40 transition-colors"
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
      </main>

      {/* 🌟 MODAL CETAK KARTU PMB */}
      {selectedCardToPrint && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
            <button
              onClick={() => setSelectedCardToPrint(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Kartu Cetak */}
            <div className="border-b-2 border-[#138F81] pb-4 mb-5 text-center">
              <div className="text-xs font-bold uppercase tracking-widest text-[#138F81]">
                YAYASAN PONDOK PESANTREN QOMARUDDIN
              </div>
              <h3 className="text-lg font-black text-slate-900 mt-0.5">
                KARTU BUKTI PENDAFTARAN PMB
              </h3>
              <p className="text-[11px] text-slate-500">
                Jl. Sampurnan No. 01 Bungah Gresik • Tahun Ajaran 2026/2027
              </p>
            </div>

            {/* Detail Kartu */}
            <div className="space-y-3 text-xs mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">No. Registrasi:</span>
                <span className="font-mono font-black text-[#138F81] text-sm">
                  {selectedCardToPrint.registration_number}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Nama Santri:</span>
                <span className="font-bold text-slate-900">{selectedCardToPrint.nama_lengkap}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Jenis Kelamin:</span>
                <span className="font-semibold text-slate-700">
                  {selectedCardToPrint.jenis_kelamin === 'L' ? 'Laki-laki (Putra)' : 'Perempuan (Putri)'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Program Dipilih:</span>
                <span className="font-semibold text-slate-700">{selectedCardToPrint.pilihan_jenjang}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Status Seleksi:</span>
                <span className="font-bold text-[#138F81]">{selectedCardToPrint.status_label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Waktu Mendaftar:</span>
                <span className="text-slate-600">{selectedCardToPrint.tanggal_daftar}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedCardToPrint(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Tutup
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl bg-[#138F81] hover:bg-[#0F7A6E] text-white text-xs font-bold shadow-md flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak / Simpan PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 FOOTER PESANTREN */}
      <footer className="bg-[#04120F] border-t border-[#138F81]/25 py-12 text-[#94A3B8] text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 text-white font-extrabold text-base mb-3">
                <Landmark className="w-5 h-5 text-[#4ADE80]" />
                <span>Pondok Pesantren Qomaruddin</span>
              </div>
              <p className="text-[#CBD5E1] text-xs leading-relaxed max-w-sm mb-4">
                Pondok Pesantren tertua di Kabupaten Gresik (1775 M), mendidik santri mandiri yang unggul ilmu agama berhaluan Ahlussunnah wal Jama'ah an-Nahdliyyah.
              </p>
              <div className="flex items-center gap-2 text-xs text-[#A7F3D0]">
                <MapPin className="w-4 h-4 text-[#4ADE80] shrink-0" />
                <span>Jl. Sampurnan No. 01, Bungah, Gresik, Jawa Timur 61152</span>
              </div>
            </div>

            <div>
              <h4 className="text-white font-bold mb-3 text-xs uppercase tracking-wider">Layanan PMB</h4>
              <ul className="space-y-2">
                <li>
                  <button onClick={() => setActiveTab('beranda')} className="hover:text-white transition-colors">
                    Profil Lembaga
                  </button>
                </li>
                <li>
                  <button onClick={() => { setActiveTab('daftar'); setFormStep(1); }} className="hover:text-white transition-colors">
                    Formulir Pendaftaran
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveTab('status')} className="hover:text-white transition-colors">
                    Cek Status & Kelulusan
                  </button>
                </li>
                <li>
                  <button onClick={onOpenLogin} className="hover:text-white transition-colors flex items-center gap-1">
                    <span>Portal Staf Pegawai</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-3 text-xs uppercase tracking-wider">Kontak Panitia</h4>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-[#4ADE80]" />
                  <span>0812-3456-7890 (Sekretariat PMB)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#4ADE80]" />
                  <span>Pelayanan: 08.00 - 16.00 WIB</span>
                </div>
                <div className="pt-2">
                  <a
                    href="https://wa.me/6281234567890?text=Assalamu%27alaikum%2C%20saya%20ingin%20bertanya%20mengenai%20PMB%20Santri%20Baru%20PP%20Qomaruddin"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40 hover:bg-[#25D366]/30 font-bold transition-all"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp Panitia PMB</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

        </div>
      </footer>

      {/* 🌟 MODAL BAGIKAN LINK PMB PUBLIK */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#092B23] border border-[#138F81]/60 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-left relative">
            <button
              onClick={() => setIsShareModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-[#061A15] hover:bg-[#138F81]/30 text-[#94A3B8] hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-2xl bg-[#10B981]/20 text-[#4ADE80] flex items-center justify-center border border-[#10B981]/40">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Bagikan Info PMB Online</h3>
                <p className="text-xs text-[#A7F3D0]">Pondok Pesantren Qomaruddin Gresik</p>
              </div>
            </div>

            <p className="text-xs text-[#CBD5E1] leading-relaxed mb-6">
              Sebarkan link pendaftaran santri baru kepada sanak saudara, kerabat, dan grup WhatsApp masyarakat:
            </p>

            {/* Input Link & Salin */}
            <div className="mb-4">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                Link Resmi PMB Publik:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getPublicPmbUrl()}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#061A15] border border-[#138F81]/40 text-xs font-mono text-[#FCD34D] select-all outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyPmbLink}
                  className="px-4 py-2.5 rounded-xl bg-[#138F81] hover:bg-[#16A394] text-white text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {hasCopiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#4ADE80]" />
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

            {/* Tombol Bagikan Langsung */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full py-3 rounded-2xl bg-[#25D366] hover:bg-[#20BD5A] text-slate-900 text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/20 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-slate-950" />
                <span>Bagikan Langsung via WhatsApp</span>
              </button>

              <a
                href="https://wa.me/6281234567890?text=Assalamu%27alaikum%20Panitia%20PMB%20Qomaruddin%2C%20saya%20ingin%20konsultasi%20pendaftaran"
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 rounded-2xl bg-[#061A15] hover:bg-[#138F81]/20 text-[#A7F3D0] text-xs font-bold border border-[#138F81]/40 flex items-center justify-center gap-2 transition-all"
              >
                <Phone className="w-3.5 h-3.5 text-[#4ADE80]" />
                <span>Hubungi Narahubung Panitia (0812-3456-7890)</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
