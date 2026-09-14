import React, { useEffect, useState } from 'react';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
  Printer,
  Phone,
  MessageCircle,
  LogOut,
  User,
  CreditCard,
  Copy,
  Check,
  Award,
  Eye,
  RefreshCw,
  ShieldCheck,
  X
} from 'lucide-react';
import { api, clearSession, UserSession } from '../services/api';
import { ThemeToggle } from '../components/ThemeToggle';
import qomaruddinLogo from '../assets/logo-qomaruddin.png';

interface ApplicantRegistrationData {
  id: number;
  registration_number: string;
  nama_lengkap: string;
  nama_panggilan?: string;
  jenis_kelamin: 'L' | 'P';
  pilihan_jenjang: string;
  pilihan_asrama: string;
  status: 'pending' | 'reviewed' | 'accepted' | 'rejected';
  catatan_admin?: string | null;
  payment_status?: string;
  payment_amount?: number;
  payment_notes?: string | null;
  dokumen_foto?: string | null;
  dokumen_kk?: string | null;
  dokumen_ijazah?: string | null;
  dokumen_bukti_bayar?: string | null;
  tempat_lahir?: string | null;
  tanggal_lahir?: string | null;
  asal_sekolah?: string | null;
  nama_ayah?: string | null;
  nama_ibu?: string | null;
  nama_wali?: string | null;
  no_whatsapp_wali?: string;
  alamat_lengkap?: string | null;
  kecamatan?: string | null;
  kota?: string | null;
  created_at?: string;
  is_converted?: boolean;
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

interface PmbApplicantPortalPageProps {
  session?: UserSession | null;
}

export default function PmbApplicantPortalPage({ session }: PmbApplicantPortalPageProps) {
  const [registration, setRegistration] = useState<ApplicantRegistrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [copiedRekening, setCopiedRekening] = useState(false);

  const fetchMyRegistration = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getPmbMyRegistration();
      if (res.data) {
        setRegistration(res.data as unknown as ApplicantRegistrationData);
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat data pendaftaran calon santri.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyRegistration();
  }, []);

  const handleLogout = () => {
    clearSession();
    window.location.href = '/?pmb=1';
  };

  const handleCopyRekening = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRekening(true);
    setTimeout(() => setCopiedRekening(false), 2500);
  };

  const handleUploadFile = async (type: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran berkas maksimal 5 MB!');
      return;
    }

    try {
      setUploadingType(type);
      const res = await api.uploadPmbApplicantDocument(type, file);
      if (res.data) {
        setRegistration(res.data as unknown as ApplicantRegistrationData);
        alert('Berkas berhasil diunggah dan disimpan!');
      }
    } catch (err: any) {
      alert(err?.message || 'Gagal mengunggah berkas.');
    } finally {
      setUploadingType(null);
    }
  };

  const isAccepted = registration?.status === 'accepted';
  const isReviewed = registration?.status === 'reviewed';
  const isRejected = registration?.status === 'rejected';

  const isLunas = registration?.payment_status === 'lunas' || registration?.payment_status === 'gratis';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1320] text-[#2D3436] dark:text-slate-100 font-sans transition-colors duration-300 pb-16">
      {/* 🌟 EMBEDDED PRINT STYLES FOR CLEAN ISO A4 REGISTRATION CARD */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #pmb-applicant-card-printable,
          #pmb-applicant-card-printable * {
            visibility: visible !important;
          }
          #pmb-applicant-card-printable {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            background: #ffffff !important;
            color: #111827 !important;
            box-shadow: none !important;
            border: 2px solid #0D7A6F !important;
            border-radius: 8px !important;
            z-index: 999999 !important;
          }
          .no-print, .no-print * {
            display: none !important;
            visibility: hidden !important;
          }
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
        }
      `}</style>

      {/* 🌟 TOPBAR PORTAL CALON SANTRI PMB */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#1E293B]/95 backdrop-blur-md border-b border-amber-300/80 dark:border-slate-800 shadow-sm transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Brand Logo & Name */}
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-white dark:bg-slate-800 p-1 border border-amber-200 dark:border-slate-700 shadow-xs flex items-center justify-center shrink-0">
                <img src={qomaruddinLogo} alt="Logo Qomaruddin" className="h-full w-full object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm sm:text-base tracking-tight text-[#2D3436] dark:text-slate-100">
                    PORTAL CALON SANTRI
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-[#0D7A6F] dark:text-emerald-400 font-extrabold text-[10px] uppercase border border-emerald-300 dark:border-emerald-800">
                    PMB 2026/2027
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#636E72] dark:text-slate-400 font-medium">
                  Pondok Pesantren Qomaruddin Sampurnan Bungah Gresik
                </p>
              </div>
            </div>

            {/* Actions: Theme Toggle, Reload & Logout */}
            <div className="flex items-center gap-2">
              <ThemeToggle showDropdown={true} />

              <button
                onClick={fetchMyRegistration}
                className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[#636E72] dark:text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Segarkan Data Realtime"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#138F81]' : ''}`} />
                <span className="hidden sm:inline">Segarkan</span>
              </button>

              <button
                onClick={handleLogout}
                className="px-3 sm:px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-black border border-rose-200 dark:border-rose-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Keluar dari Portal PMB"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 🌟 MAIN CONTAINER */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        {loading && !registration && (
          <div className="p-12 text-center bg-white dark:bg-[#1E293B] rounded-3xl border border-amber-200 dark:border-slate-800 shadow-sm">
            <RefreshCw className="w-8 h-8 text-[#138F81] dark:text-[#2DD4BF] animate-spin mx-auto mb-3" />
            <p className="text-sm font-bold text-[#2D3436] dark:text-slate-200">
              Memuat Data Pendaftaran Calon Santri...
            </p>
          </div>
        )}

        {error && (
          <div className="p-6 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm">
            <div className="flex items-center gap-2 font-black mb-1">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              <span>Gagal Memuat Data</span>
            </div>
            <p>{error}</p>
            <button
              onClick={fetchMyRegistration}
              className="mt-3 px-4 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-xs hover:bg-rose-700 cursor-pointer"
            >
              Coba Muat Ulang
            </button>
          </div>
        )}

        {registration && (
          <>
            {/* 🌟 HERO PROFILE & REGISTRATION SUMMARY CARD */}
            <div className="rounded-3xl bg-gradient-to-r from-[#0D7A6F] via-[#138F81] to-[#107064] text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
              <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 opacity-10 pointer-events-none">
                <img src={qomaruddinLogo} alt="Watermark" className="w-64 h-64 object-contain" />
              </div>

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start sm:items-center gap-4">
                  {registration.dokumen_foto ? (
                    <img
                      src={registration.dokumen_foto}
                      alt="Foto Santri"
                      className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-amber-300 shadow-md bg-white shrink-0"
                    />
                  ) : (
                    <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center shrink-0 font-black text-2xl text-amber-200 shadow-md">
                      {registration.nama_lengkap ? registration.nama_lengkap.charAt(0).toUpperCase() : 'S'}
                    </div>
                  )}

                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono text-xs sm:text-sm font-black px-3 py-1 rounded-xl bg-amber-300 text-slate-900 shadow-xs">
                        {registration.registration_number}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/20 text-white font-bold border border-white/30">
                        {registration.batch?.nama_gelombang || 'Gelombang 1'}
                      </span>
                    </div>
                    <h1 className="text-xl sm:text-3xl font-black tracking-tight">
                      {registration.nama_lengkap}
                    </h1>
                    <p className="text-xs sm:text-sm text-teal-100 mt-1 font-medium">
                      Pilihan: <strong className="text-white">{registration.pilihan_jenjang}</strong> •{' '}
                      <strong className="text-white">{registration.pilihan_asrama}</strong>
                    </p>
                  </div>
                </div>

                {/* Quick Print Button */}
                <div className="shrink-0 flex flex-col sm:flex-row gap-2.5">
                  <button
                    onClick={() => setShowPrintModal(true)}
                    className="px-5 py-3 rounded-2xl bg-amber-300 hover:bg-amber-400 text-slate-900 text-xs font-black shadow-lg shadow-amber-300/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                  >
                    <Printer className="w-4 h-4 text-slate-900" />
                    <span>Cetak Kartu Peserta PMB (A4)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 🌟 STATUS TAHAPAN PENDAFTARAN (INTERACTIVE STEPPER) */}
            <div className="bg-white dark:bg-[#1E293B] border border-amber-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-md transition-colors">
              <h2 className="text-sm font-black uppercase tracking-wider text-[#0D7A6F] dark:text-[#2DD4BF] mb-6 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Tahapan & Alur Seleksi PMB</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Step 1: Formulir Online */}
                <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border-2 border-emerald-300 dark:border-emerald-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Langkah 1
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-black text-emerald-950 dark:text-emerald-100">
                    Formulir Pendaftaran
                  </h3>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-1">
                    Selesai dikirim pada {registration.created_at ? new Date(String(registration.created_at)).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                  </p>
                </div>

                {/* Step 2: Audit Berkas Panitia */}
                <div
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    isAccepted || isReviewed
                      ? 'bg-sky-50/80 dark:bg-sky-950/30 border-sky-300 dark:border-sky-700'
                      : 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#0D7A6F] dark:text-teal-300">
                      Langkah 2
                    </span>
                    {isAccepted ? (
                      <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse" />
                    )}
                  </div>
                  <h3 className="text-sm font-black text-[#2D3436] dark:text-slate-100">
                    Audit & Verifikasi Berkas
                  </h3>
                  <p className="text-[11px] text-[#636E72] dark:text-slate-400 mt-1">
                    {isAccepted
                      ? 'Lolos Verifikasi Administrasi ✓'
                      : isReviewed
                      ? 'Sedang Ditinjau Panitia'
                      : isRejected
                      ? 'Perlu Revisi Dokumen'
                      : 'Menunggu Antrean Audit'}
                  </p>
                </div>

                {/* Step 3: Biaya Pendaftaran PMB */}
                <div
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    isLunas
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700'
                      : 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#0D7A6F] dark:text-teal-300">
                      Langkah 3
                    </span>
                    {isLunas ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    )}
                  </div>
                  <h3 className="text-sm font-black text-[#2D3436] dark:text-slate-100">
                    Biaya Pendaftaran
                  </h3>
                  <p className="text-[11px] text-[#636E72] dark:text-slate-400 mt-1">
                    {isLunas ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">LUNAS ✓</span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400 font-bold">
                        Pending (Rp {Number(registration.payment_amount || 150000).toLocaleString('id-ID')})
                      </span>
                    )}
                  </p>
                </div>

                {/* Step 4: Kelulusan & Buku Induk Santri */}
                <div
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    isAccepted
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-500 shadow-md'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${isAccepted ? 'text-amber-200' : 'text-slate-400'}`}>
                      Langkah 4
                    </span>
                    <Award className={`w-4 h-4 ${isAccepted ? 'text-amber-300' : 'text-slate-400'}`} />
                  </div>
                  <h3 className={`text-sm font-black ${isAccepted ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                    {isAccepted ? 'Resmi Diterima (ACC)' : 'Buku Induk Santri'}
                  </h3>
                  <p className={`text-[11px] mt-1 ${isAccepted ? 'text-emerald-100' : 'text-slate-400'}`}>
                    {isAccepted
                      ? 'Terdaftar di Buku Induk Santri!'
                      : 'Diterbitkan setelah lulus seleksi'}
                  </p>
                </div>
              </div>
            </div>

            {/* 🌟 BANNER HASIL KELULUSAN JIKA SUDAH DI-ACC ATAU BELUM */}
            {isAccepted ? (
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-teal-700 text-white shadow-xl border-2 border-emerald-400">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white/20 rounded-2xl shrink-0">
                    <Award className="w-8 h-8 text-amber-300" />
                  </div>
                  <div className="space-y-2">
                    <div className="inline-block px-3 py-0.5 rounded-full bg-amber-300 text-slate-900 text-xs font-black uppercase tracking-wider">
                      ALHAMDULILLAH • RESMI DITERIMA
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black">
                      Selamat! {registration.nama_lengkap} Resmi Diterima sebagai Santri Pondok Pesantren Qomaruddin
                    </h3>
                    <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed max-w-3xl">
                      Calon santri telah berhasil melewati seluruh tahapan audit dan dinyatakan <strong>LULUS SELEKSI</strong>. Data Anda telah dimasukkan ke Buku Induk Santri Resmi.
                    </p>

                    {/* Info NIS & Kamar jika sudah dikonversi */}
                    {registration.is_converted && registration.siswa && (
                      <div className="pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-white/10 p-3 rounded-2xl border border-white/20">
                          <span className="text-[10px] uppercase font-bold text-emerald-200 block">NIS Resmi Santri</span>
                          <strong className="font-mono text-base">{registration.siswa.nis}</strong>
                        </div>
                        <div className="bg-white/10 p-3 rounded-2xl border border-white/20">
                          <span className="text-[10px] uppercase font-bold text-emerald-200 block">Kelas Diniyah</span>
                          <strong>{registration.siswa.kelas || '-'}</strong>
                        </div>
                        <div className="bg-white/10 p-3 rounded-2xl border border-white/20">
                          <span className="text-[10px] uppercase font-bold text-emerald-200 block">Kamar Asrama</span>
                          <strong>{registration.siswa.kamar || '-'}</strong>
                        </div>
                      </div>
                    )}

                    <div className="p-3.5 bg-black/20 rounded-2xl text-xs text-amber-100 border border-amber-200/30 mt-3">
                      <strong>Catatan Login Resmi Wali Santri:</strong> Akun resmi login wali santri telah diterbitkan menggunakan nomor <strong>NIS Resmi</strong> di atas dengan password default: <code className="font-mono bg-black/40 px-2 py-0.5 rounded font-bold text-amber-300">siswa123</code>. Gunakan akun tersebut saat masuk portal utama untuk memantau tabungan, SPP, dan nilai santri.
                    </div>
                  </div>
                </div>
              </div>
            ) : isRejected ? (
              <div className="p-6 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-base font-black text-rose-900 dark:text-rose-100">
                      Status: Perlu Revisi / Perbaikan Berkas
                    </h3>
                    <p className="text-xs sm:text-sm mt-1 leading-relaxed">
                      {registration.catatan_admin ||
                        'Terdapat berkas persyaratan yang belum sesuai atau belum lengkap. Silakan cek bagian dokumen di bawah dan unggah kembali berkas yang valid.'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-3xl bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700/60 text-[#2D3436] dark:text-slate-200 shadow-sm">
                <div className="flex items-start gap-3">
                  <Clock className="w-6 h-6 text-[#138F81] shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <h3 className="text-base font-black text-[#0D7A6F] dark:text-[#2DD4BF]">
                      Status: Menunggu Verifikasi & Audit Panitia PMB
                    </h3>
                    <p className="text-xs sm:text-sm text-[#636E72] dark:text-slate-300 mt-1 leading-relaxed">
                      Formulir pendaftaran Anda telah berhasil kami terima. Panitia PMB saat ini sedang melakukan audit berkas administrasi dan riwayat pendaftar. Hasil verifikasi akan diperbarui di portal ini dan dikabarkan melalui WhatsApp ke nomor <strong className="text-[#0D7A6F] dark:text-amber-300">{registration.no_whatsapp_wali}</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 🌟 GRID 2 KOLOM: BIAYA PENDAFTARAN & UPLOAD BERKAS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* KOLOM KIRI: BIAYA PENDAFTARAN (5 COLS) */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white dark:bg-[#1E293B] border border-amber-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm transition-colors">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h3 className="text-sm font-black text-[#2D3436] dark:text-slate-100 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#138F81] dark:text-[#2DD4BF]" />
                      <span>Biaya Formulir PMB</span>
                    </h3>
                    <span
                      className={`text-xs font-black px-2.5 py-0.5 rounded-full uppercase ${
                        isLunas
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                      }`}
                    >
                      {isLunas ? 'Lunas' : 'Menunggu Pelunasan'}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mb-4">
                    <span className="text-[11px] text-[#636E72] dark:text-slate-400 block font-semibold">
                      Total Tagihan Pendaftaran
                    </span>
                    <div className="text-2xl font-black text-[#0D7A6F] dark:text-[#2DD4BF] mt-0.5">
                      Rp {Number(registration.payment_amount || 150000).toLocaleString('id-ID')}
                    </div>
                    {registration.payment_notes && (
                      <p className="text-xs text-[#636E72] dark:text-slate-400 mt-1 italic">
                        Catatan: {registration.payment_notes}
                      </p>
                    )}
                  </div>

                  {/* Instruksi Transfer */}
                  {!isLunas && (
                    <div className="space-y-3 text-xs">
                      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
                        <span className="text-[10px] uppercase font-black text-amber-800 dark:text-amber-300 block mb-1">
                          Rekening Resmi PMB Pesantren:
                        </span>
                        <div className="font-bold text-sm text-[#2D3436] dark:text-slate-100">
                          Bank Syariah Indonesia (BSI)
                        </div>
                        <div className="flex items-center justify-between mt-1 font-mono font-black text-base text-[#0D7A6F] dark:text-amber-300">
                          <span>7175-01-002345-53-1</span>
                          <button
                            type="button"
                            onClick={() => handleCopyRekening('717501002345531')}
                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-slate-700 text-xs font-bold text-[#0D7A6F] dark:text-teal-300 flex items-center gap-1 cursor-pointer hover:bg-amber-50"
                          >
                            {copiedRekening ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedRekening ? 'Tersalin' : 'Salin'}</span>
                          </button>
                        </div>
                        <p className="text-[10px] text-[#636E72] dark:text-slate-400 mt-1">
                          a.n. <strong>Bendahara PMB Pondok Pesantren Qomaruddin</strong>
                        </p>
                      </div>

                      {/* Upload Bukti Pembayaran */}
                      <div className="p-4 rounded-2xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <label className="block text-xs font-bold text-[#2D3436] dark:text-slate-200 mb-2">
                          Upload Bukti Pembayaran / Struk Transfer:
                        </label>

                        {registration.dokumen_bukti_bayar ? (
                          <div className="flex items-center justify-between gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 dark:border-emerald-800 text-xs">
                            <span className="text-emerald-800 dark:text-emerald-300 font-bold truncate">
                              ✓ Bukti Terunggah
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <a
                                href={registration.dokumen_bukti_bayar || undefined}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-slate-700"
                                title="Lihat Bukti"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </a>
                              <label className="p-1.5 rounded-lg bg-emerald-600 text-white cursor-pointer hover:bg-emerald-700" title="Ganti File">
                                <Upload className="w-3.5 h-3.5" />
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  className="hidden"
                                  onChange={(e) => handleUploadFile('dokumen_bukti_bayar', e)}
                                />
                              </label>
                            </div>
                          </div>
                        ) : (
                          <label className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-[#138F81] dark:border-[#2DD4BF] bg-white dark:bg-slate-800 text-[#138F81] dark:text-[#2DD4BF] font-bold text-xs cursor-pointer hover:bg-teal-50 dark:hover:bg-slate-700/50 transition-colors">
                            {uploadingType === 'dokumen_bukti_bayar' ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                            <span>{uploadingType === 'dokumen_bukti_bayar' ? 'Mengunggah...' : 'Pilih Foto Bukti Transfer'}</span>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              disabled={uploadingType !== null}
                              onChange={(e) => handleUploadFile('dokumen_bukti_bayar', e)}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* BANTUAN NARAHUBUNG PMB */}
                <div className="bg-white dark:bg-[#1E293B] border border-amber-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm transition-colors">
                  <h3 className="text-sm font-black text-[#2D3436] dark:text-slate-100 flex items-center gap-2 mb-3">
                    <Phone className="w-4 h-4 text-[#138F81] dark:text-[#2DD4BF]" />
                    <span>Layanan Bantuan & Hotline PMB</span>
                  </h3>
                  <p className="text-xs text-[#636E72] dark:text-slate-400 leading-relaxed mb-4">
                    Butuh bantuan seputar pemilihan kamar asrama, madrasah diniyah, atau konfirmasi berkas? Hubungi sekretariat PMB:
                  </p>
                  <a
                    href="https://wa.me/6281234567890?text=Assalamu%27alaikum%20Panitia%20PMB%20Qomaruddin%2C%20saya%20calon%20santri%20ingin%20konsultasi%20pendaftaran"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Chat WhatsApp Panitia (0812-3456-7890)</span>
                  </a>
                </div>
              </div>

              {/* KOLOM KANAN: KELENGKAPAN BERKAS PERSYARATAN & BIODATA (7 COLS) */}
              <div className="lg:col-span-7 space-y-6">
                {/* CHECKLIST DOKUMEN */}
                <div className="bg-white dark:bg-[#1E293B] border border-amber-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm transition-colors">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h3 className="text-sm font-black text-[#2D3436] dark:text-slate-100 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#138F81] dark:text-[#2DD4BF]" />
                      <span>Kelengkapan Berkas Persyaratan</span>
                    </h3>
                    <span className="text-[11px] text-[#636E72] dark:text-slate-400">
                      Maksimal 5 MB (JPG / PNG / PDF)
                    </span>
                  </div>

                  <div className="space-y-3">
                    {[
                      {
                        type: 'dokumen_foto',
                        label: 'Pas Foto Calon Santri (3x4)',
                        required: true,
                        url: registration.dokumen_foto,
                      },
                      {
                        type: 'dokumen_kk',
                        label: 'Kartu Keluarga (KK)',
                        required: true,
                        url: registration.dokumen_kk,
                      },
                      {
                        type: 'dokumen_ijazah',
                        label: 'Ijazah / Surat Keterangan Lulus (SKL)',
                        required: false,
                        url: registration.dokumen_ijazah,
                      },
                    ].map((doc) => {
                      const isUploaded = !!doc.url;
                      return (
                        <div
                          key={doc.type}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#2D3436] dark:text-slate-200">
                                {doc.label}
                              </span>
                              {doc.required && <span className="text-rose-500 font-bold">*</span>}
                            </div>
                            <span
                              className={`text-[10px] font-extrabold inline-block mt-0.5 ${
                                isUploaded ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {isUploaded ? '✓ Berkas Terunggah' : 'Belum Diunggah'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isUploaded && (
                              <a
                                href={doc.url || undefined}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 text-xs font-bold text-[#0D7A6F] dark:text-[#2DD4BF] border border-slate-200 dark:border-slate-700 flex items-center gap-1 shadow-2xs"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Lihat</span>
                              </a>
                            )}

                            <label className="px-3 py-1.5 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-xs">
                              {uploadingType === doc.type ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Upload className="w-3.5 h-3.5" />
                              )}
                              <span>{isUploaded ? 'Ganti' : 'Unggah'}</span>
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                disabled={uploadingType !== null}
                                onChange={(e) => handleUploadFile(doc.type, e)}
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* BIODATA RINGKAS */}
                <div className="bg-white dark:bg-[#1E293B] border border-amber-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm transition-colors">
                  <h3 className="text-sm font-black text-[#2D3436] dark:text-slate-100 flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <User className="w-4 h-4 text-[#138F81] dark:text-[#2DD4BF]" />
                    <span>Rincian Formulir Santri & Orang Tua</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-[#F8FAFC] dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-[#636E72] dark:text-slate-400 block font-semibold text-[11px]">Nama Lengkap</span>
                      <strong className="text-sm text-[#2D3436] dark:text-slate-100">{registration.nama_lengkap}</strong>
                    </div>

                    <div className="p-3 bg-[#F8FAFC] dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-[#636E72] dark:text-slate-400 block font-semibold text-[11px]">Jenis Kelamin</span>
                      <strong className="text-sm text-[#2D3436] dark:text-slate-100">
                        {registration.jenis_kelamin === 'L' ? 'Laki-laki (Putra)' : 'Perempuan (Putri)'}
                      </strong>
                    </div>

                    <div className="p-3 bg-[#F8FAFC] dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-[#636E72] dark:text-slate-400 block font-semibold text-[11px]">Tempat, Tgl Lahir</span>
                      <strong className="text-sm text-[#2D3436] dark:text-slate-100">
                        {registration.tempat_lahir || '-'}, {registration.tanggal_lahir || '-'}
                      </strong>
                    </div>

                    <div className="p-3 bg-[#F8FAFC] dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-[#636E72] dark:text-slate-400 block font-semibold text-[11px]">Asal Sekolah</span>
                      <strong className="text-sm text-[#2D3436] dark:text-slate-100">{registration.asal_sekolah || '-'}</strong>
                    </div>

                    <div className="p-3 bg-[#F8FAFC] dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-[#636E72] dark:text-slate-400 block font-semibold text-[11px]">Nama Ayah / Ibu</span>
                      <strong className="text-sm text-[#2D3436] dark:text-slate-100">
                        {registration.nama_ayah || '-'} / {registration.nama_ibu || '-'}
                      </strong>
                    </div>

                    <div className="p-3 bg-[#F8FAFC] dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-[#636E72] dark:text-slate-400 block font-semibold text-[11px]">WhatsApp Wali</span>
                      <strong className="text-sm text-[#2D3436] dark:text-slate-100">{registration.no_whatsapp_wali || '-'}</strong>
                    </div>

                    <div className="p-3 bg-[#F8FAFC] dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 sm:col-span-2">
                      <span className="text-[#636E72] dark:text-slate-400 block font-semibold text-[11px]">Alamat Domisili</span>
                      <strong className="text-sm text-[#2D3436] dark:text-slate-100">
                        {registration.alamat_lengkap || '-'} {registration.kecamatan ? `• Kec. ${registration.kecamatan}` : ''} {registration.kota ? `• ${registration.kota}` : ''}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* 🌟 MODAL CETAK KARTU BUKTI PENDAFTARAN RESMI (A4 PRINT READY) */}
      {showPrintModal && registration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border-2 border-[#138F81] rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl text-left relative max-h-[90vh] overflow-y-auto">
            {/* Modal Actions */}
            <div className="no-print flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-[#138F81]" />
                <span className="font-black text-sm text-[#2D3436] dark:text-slate-100">
                  Pratinjau Kartu Tanda Peserta PMB (ISO A4)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak / Unduh PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>

            {/* 🌟 KARTU TANDA PESERTA PMB RESMI (TARGET CETAK ELEGAN BERKUALITAS A4) */}
            <div
              id="pmb-applicant-card-printable"
              className="bg-white text-slate-900 p-6 sm:p-8 border-2 border-slate-300 rounded-2xl shadow-xs space-y-6"
            >
              {/* KOP RESMI PESANTREN */}
              <div className="flex items-center gap-4 border-b-2 border-slate-900 pb-4 text-center sm:text-left">
                <img
                  src={qomaruddinLogo}
                  alt="Logo PP Qomaruddin"
                  className="w-16 h-16 object-contain shrink-0"
                />
                <div className="flex-1">
                  <div className="text-xs font-extrabold uppercase tracking-widest text-[#0D7A6F]">
                    YAYASAN PONDOK PESANTREN QOMARUDDIN
                  </div>
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
                    KARTU BUKTI PENDAFTARAN SANTRI BARU (PMB)
                  </h2>
                  <p className="text-[11px] text-slate-600 font-medium">
                    Jl. Sampurnan No. 01 Bungah Gresik Jawa Timur 61152 • Website: ppqomaruddin.itqom.net
                  </p>
                </div>
                <div className="hidden sm:block text-right shrink-0">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Tahun Ajaran</span>
                  <strong className="font-mono text-xs text-slate-800">2026/2027</strong>
                </div>
              </div>

              {/* RINCIAN PESERTA & FOTO */}
              <div className="flex flex-col-reverse sm:flex-row items-start justify-between gap-6">
                <table className="w-full text-xs text-slate-800 border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="py-1.5 font-bold text-slate-600 w-36">No. Registrasi</td>
                      <td className="py-1.5 font-mono font-black text-sm text-[#0D7A6F]">
                        {registration.registration_number}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1.5 font-bold text-slate-600">Nama Lengkap</td>
                      <td className="py-1.5 font-black text-sm">{registration.nama_lengkap}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1.5 font-bold text-slate-600">Jenis Kelamin</td>
                      <td className="py-1.5">
                        {registration.jenis_kelamin === 'L' ? 'Laki-laki (Putra)' : 'Perempuan (Putri)'}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1.5 font-bold text-slate-600">Gelombang Masuk</td>
                      <td className="py-1.5 font-bold">
                        {registration.batch?.nama_gelombang || 'Gelombang 1'}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1.5 font-bold text-slate-600">Program Pilihan</td>
                      <td className="py-1.5 font-bold">{registration.pilihan_jenjang}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1.5 font-bold text-slate-600">Pilihan Asrama</td>
                      <td className="py-1.5 font-bold">{registration.pilihan_asrama}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1.5 font-bold text-slate-600">Asal Sekolah</td>
                      <td className="py-1.5">{registration.asal_sekolah || '-'}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1.5 font-bold text-slate-600">Nama Wali / No WA</td>
                      <td className="py-1.5">
                        {registration.nama_wali || registration.nama_ayah || 'Wali'} ({registration.no_whatsapp_wali || '-'})
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1.5 font-bold text-slate-600">Status Seleksi</td>
                      <td className="py-1.5 font-black uppercase text-[#0D7A6F]">
                        {registration.status === 'accepted' ? 'Diterima Resmi (Lolos Seleksi)' : 'Menunggu Verifikasi Audit'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 font-bold text-slate-600">Biaya Formulir</td>
                      <td className="py-1.5 font-black">
                        {registration.payment_status === 'lunas' ? (
                          <span className="text-emerald-700 font-black">LUNAS ✓</span>
                        ) : (
                          <span className="text-amber-800 font-bold">
                            PENDING (Rp {Number(registration.payment_amount || 150000).toLocaleString('id-ID')})
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Pas Foto Box */}
                <div className="shrink-0 flex flex-col items-center">
                  <div className="w-28 h-36 border-2 border-dashed border-slate-400 rounded-xl flex items-center justify-center p-1 bg-slate-50 overflow-hidden">
                    {registration.dokumen_foto ? (
                      <img
                        src={registration.dokumen_foto}
                        alt="Foto Santri"
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <span className="text-[10px] text-center font-bold text-slate-400">
                        Pas Foto Santri 3x4
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-500 font-bold mt-1">Cap Panitia PMB</span>
                </div>
              </div>

              {/* CATATAN & TANDA TANGAN */}
              <div className="border-t border-slate-300 pt-4 flex flex-col sm:flex-row items-end justify-between gap-4 text-xs">
                <div className="text-[11px] text-slate-500 max-w-md">
                  <p className="font-bold text-slate-700 mb-1">Catatan Penting:</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Simpan kartu bukti pendaftaran ini sebagai tanda pengenal resmi seleksi PMB.</li>
                    <li>Wajib dibawa saat proses verifikasi berkas fisik dan kedatangan ke asrama pondok.</li>
                    <li>Pengumuman resmi kelulusan dapat dipantau realtime di portal ppqomaruddin.itqom.net.</li>
                  </ol>
                </div>

                <div className="text-center shrink-0">
                  <p className="text-[11px] text-slate-600">
                    Bungah, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="text-[11px] font-bold text-slate-700 mt-0.5">Panitia Penerimaan Santri Baru</p>
                  <div className="h-14 flex items-center justify-center">
                    <span className="text-[10px] font-mono text-emerald-800 border border-dashed border-emerald-500 px-3 py-1 rounded bg-emerald-50">
                      TERVERIFIKASI SISTEM PMB
                    </span>
                  </div>
                  <p className="text-xs font-black text-slate-900">Sekretariat PMB Qomaruddin</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
