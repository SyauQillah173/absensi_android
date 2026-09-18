import { ArrowRight, Building2, Check, Copy, Cpu, ExternalLink, Eye, EyeOff, HelpCircle, LockKeyhole, MessageSquare, Shield, ShieldAlert, ShieldCheck, Terminal, UserRound, X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { CloudflareTurnstile } from '../components/CloudflareTurnstile';
import { api, type ItHelpdeskConfig } from '../services/api';
import qomaruddinLogo from '../assets/logo-qomaruddin.png';

interface LoginPageProps {
  onOpenPmb?: () => void;
}

export function LoginPage({ onOpenPmb }: LoginPageProps = {}) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [turnstileToken, setTurnstileToken] = useState('');

  // Persona Portal Mode: 'keamanan' | 'admin_it' | 'pengurus_umum'
  type PortalMode = 'keamanan' | 'admin_it' | 'pengurus_umum';
  const [portalMode, setPortalMode] = useState<PortalMode>('pengurus_umum');

  const handleIdentifierChange = (val: string) => {
    setIdentifier(val);
    const lower = val.toLowerCase();
    if (lower.includes('keamanan') || lower.includes('tatib') || lower.includes('security')) {
      setPortalMode('keamanan');
    } else if (lower.includes('syauqillah') || lower.includes('admin_it') || lower.includes('superadmin')) {
      setPortalMode('admin_it');
    }
  };

  const portalConfig = useMemo(() => {
    if (portalMode === 'keamanan') {
      return {
        bgMain: 'bg-gradient-to-br from-[#04120E] via-[#08241C] to-[#030C09]',
        cardBg: 'bg-[#0B1E19]/95 border-emerald-500/40 text-white shadow-2xl shadow-emerald-950/70 backdrop-blur-xl',
        badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
        badgeLabel: '🛡️ BIRO KEAMANAN & KETERTIBAN',
        title: 'Posko Kedisiplinan',
        subtitle: 'Pengawasan Tata Tertib, Poin & Takzir Santri',
        inputBoxShadow: 'inset 3px 3px 6px #051310, inset -3px -3px 6px #12332a',
        inputClass: 'bg-[#071713] text-emerald-100 placeholder:text-emerald-700/50 border border-emerald-500/30 focus-within:ring-2 focus-within:ring-emerald-400/50',
        inputIcon: 'text-emerald-400',
        titleColor: 'text-white',
        subtitleColor: 'text-emerald-300/80',
        btnBg: 'bg-gradient-to-r from-[#0D7A6F] to-[#059669] hover:from-[#0B685F] hover:to-[#047857] text-white shadow-lg shadow-emerald-700/40 border border-emerald-400/30',
        btnText: 'MASUK KE POSKO KEDISIPLINAN',
        placeholderUser: 'Email / Akun Keamanan (keamanan@absensi.com)',
        placeholderPass: 'Password Petugas Keamanan',
        footerBadge: 'TIM KEAMANAN SANTRI',
        logoHalo: 'ring-2 ring-emerald-400/50 shadow-emerald-500/30 shadow-lg',
      };
    }
    if (portalMode === 'admin_it') {
      return {
        bgMain: 'bg-gradient-to-br from-[#060D1A] via-[#0B172A] to-[#0A1120]',
        cardBg: 'bg-[#0F1B2F]/95 border-sky-500/40 text-white shadow-2xl shadow-sky-950/70 backdrop-blur-xl',
        badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-400/40',
        badgeLabel: '💻 IT MASTER & SYSTEM ARCHITECT',
        title: 'Pusat Kendali IT',
        subtitle: 'Akses Server, Database, & Konfigurasi Sistem',
        inputBoxShadow: 'inset 3px 3px 6px #070e1a, inset -3px -3px 6px #16263f',
        inputClass: 'bg-[#0A1322] text-sky-100 placeholder:text-sky-700/50 border border-sky-500/30 focus-within:ring-2 focus-within:ring-sky-400/50',
        inputIcon: 'text-sky-400',
        titleColor: 'text-white',
        subtitleColor: 'text-sky-300/80',
        btnBg: 'bg-gradient-to-r from-[#0369A1] to-[#0284C7] hover:from-[#075985] hover:to-[#0369A1] text-white shadow-lg shadow-sky-700/40 border border-sky-400/30',
        btnText: 'AKSES KENDALI IT MASTER',
        placeholderUser: 'Username / Email Admin IT',
        placeholderPass: 'Password Master IT',
        footerBadge: 'CYBER IT QOMARUDDIN',
        logoHalo: 'ring-2 ring-sky-400/50 shadow-sky-500/30 shadow-lg',
      };
    }
    return {
      bgMain: 'bg-[#FFDC80] dark:bg-[#0B1120]',
      cardBg: 'bg-[#f8fafc] dark:bg-[#1E293B] border-slate-100/90 dark:border-slate-800 text-[#2D3436] dark:text-white',
      badgeBg: 'bg-teal-500/15 text-[#138F81] dark:text-[#2DD4BF] border-teal-500/30',
      badgeLabel: '🏛️ PONDOK PESANTREN QOMARUDDIN',
      title: 'Portal Administrasi',
      subtitle: 'Satu Data Pengurus, Bendahara, Guru & Wali',
      inputBoxShadow: 'inset 3.5px 3.5px 7px #ccd6e2, inset -3.5px -3.5px 7px #ffffff',
      inputClass: 'bg-[#edf2f7] dark:bg-slate-800/80 text-[#2D3436] dark:text-slate-100 placeholder:text-[#9AA5B1] dark:placeholder:text-slate-500 border-transparent focus-within:ring-2 focus-within:ring-[#138F81]/40',
      inputIcon: 'text-[#7B8794] dark:text-slate-400',
      titleColor: 'text-[#2D3436] dark:text-white',
      subtitleColor: 'text-[#7B8794] dark:text-slate-400',
      btnBg: 'bg-[#138F81] hover:bg-[#0e7467] text-white shadow-[#138F81]/30',
      btnText: 'SIGN IN AKUN RESMI',
      placeholderUser: 'Nama / Email / Kode Guru / NIS',
      placeholderPass: 'Password Akun',
      footerBadge: 'ITQOM',
      logoHalo: '',
    };
  }, [portalMode]);

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Lupa Password Modal States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [helpdeskInfo, setHelpdeskInfo] = useState<ItHelpdeskConfig | null>(null);
  const [loadingHelpdesk, setLoadingHelpdesk] = useState(false);
  const [forgotName, setForgotName] = useState('');
  const [forgotRole, setForgotRole] = useState('Wali Santri');
  const [forgotContact, setForgotContact] = useState('');
  const [copiedMsg, setCopiedMsg] = useState(false);

  const openForgotModal = async () => {
    if (identifier.trim()) {
      const trimmed = identifier.trim();
      if (/^\d+$/.test(trimmed)) {
        if (!forgotContact) setForgotContact(trimmed);
      } else {
        if (!forgotName) setForgotName(trimmed);
      }
    }
    setShowForgotModal(true);
    if (!helpdeskInfo) {
      setLoadingHelpdesk(true);
      try {
        const res = await api.getHelpdeskInfo();
        if (res.data) {
          setHelpdeskInfo(res.data);
        }
      } catch {
        setHelpdeskInfo({
          whatsapp_number: '6285731998591',
          contact_person_name: 'Abdullah SyauQillah (Admin IT)',
          contact_role: 'Penanggung Jawab Sistem IT',
          template_message: "Assalamu'alaikum Admin, saya membutuhkan bantuan untuk reset kata sandi akun sistem Qomaruddin.\n\nNama: [Nama Anda]\nNIS / No. Akun: [NIS Anda]\nPeran: [Wali Santri / Guru / Petugas]\n\nMohon bantuannya untuk verifikasi akun dan reset kata sandi ke kata sandi default. Terima kasih.",
          pic_name: 'Abdullah SyauQillah (Admin IT)',
          contact_type: 'it_master',
          message_template: "Assalamu'alaikum Admin, saya membutuhkan bantuan untuk reset kata sandi akun sistem Qomaruddin.\n\nNama: [Nama Anda]\nNIS / No. Akun: [NIS Anda]\nPeran: [Wali Santri / Guru / Petugas]\n\nMohon bantuannya untuk verifikasi akun dan reset kata sandi ke kata sandi default. Terima kasih.",
          is_active: true,
        });
      } finally {
        setLoadingHelpdesk(false);
      }
    }
  };

  const compiledMessage = useMemo(() => {
    let msg =
      helpdeskInfo?.template_message ||
      helpdeskInfo?.message_template ||
      "Assalamu'alaikum Admin, saya membutuhkan bantuan untuk reset kata sandi akun sistem Qomaruddin.\n\nNama: [Nama Anda]\nNIS / No. Akun: [NIS Anda]\nPeran: [Wali Santri / Guru / Petugas]\n\nMohon bantuannya untuk verifikasi akun dan reset kata sandi ke kata sandi default. Terima kasih.";

    const nameVal = forgotName.trim() || '[Nama Santri / Pengguna]';
    const roleVal = forgotRole;
    const contactVal = forgotContact.trim() || '[NIS Belum Diisi]';

    // 1. Cerdaskan penggantian semua variasi placeholder Nama / Identitas
    msg = msg
      .replace(/\[Nama Anda\]/gi, nameVal)
      .replace(/\[Nama \/ Identitas Anda\]/gi, nameVal)
      .replace(/\[Nama\/Identitas Anda\]/gi, nameVal)
      .replace(/\[Nama Santri \/ Pengguna\]/gi, nameVal)
      .replace(/\[Nama Santri\]/gi, nameVal)
      .replace(/\[Nama\]/gi, nameVal)
      .replace(/\[Identitas Anda\]/gi, nameVal)
      .replace(/\[Identitas\]/gi, nameVal)
      .replace(/\{nama\}/gi, nameVal)
      .replace(/\{name\}/gi, nameVal)
      .replace(/\{identitas\}/gi, nameVal);

    // 2. Cerdaskan penggantian semua variasi placeholder Role / Peran
    msg = msg
      .replace(/\[Wali Santri \/ Guru \/ Petugas\]/gi, roleVal)
      .replace(/\[Wali Santri\/Guru\/Petugas\]/gi, roleVal)
      .replace(/\[Role\]/gi, roleVal)
      .replace(/\[Peran\]/gi, roleVal)
      .replace(/\{role\}/gi, roleVal)
      .replace(/\{peran\}/gi, roleVal);

    // 3. Cerdaskan penggantian semua variasi placeholder NIS / No HP / Data Akun
    msg = msg
      .replace(/\[Data Akun\]/gi, contactVal)
      .replace(/\[NIS Anda\]/gi, contactVal)
      .replace(/\[NIS Santri\]/gi, contactVal)
      .replace(/\[NIS \/ No HP\]/gi, contactVal)
      .replace(/\[NIS\/No HP\]/gi, contactVal)
      .replace(/\[NIS \/ No\. Akun\]/gi, contactVal)
      .replace(/\[NIS\/No\. Akun\]/gi, contactVal)
      .replace(/\[NIS\]/gi, contactVal)
      .replace(/\{nis\}/gi, contactVal)
      .replace(/\{kontak\}/gi, contactVal)
      .replace(/\{no_hp\}/gi, contactVal);

    return msg;
  }, [helpdeskInfo, forgotName, forgotRole, forgotContact]);

  const cleanWaNumber = useMemo(() => {
    let num = (helpdeskInfo?.whatsapp_number || '6285731998591').replace(/\D/g, '');
    if (num.startsWith('0')) {
      num = '62' + num.slice(1);
    }
    return num;
  }, [helpdeskInfo]);

  const waHref = `https://wa.me/${cleanWaNumber}?text=${encodeURIComponent(compiledMessage)}`;

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(compiledMessage);
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2500);
    } catch {
      // ignore clipboard error
    }
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!turnstileToken) {
      setError('Verifikasi keamanan Cloudflare wajib diselesaikan terlebih dahulu.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(identifier.trim(), password, turnstileToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal. Periksa kembali username & password Anda.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={`relative min-h-[100dvh] w-full flex items-center justify-center p-3 sm:p-4 font-sans select-none overflow-y-auto transition-all duration-500 ${portalConfig.bgMain}`}>
      {/* CORNER THEME TOGGLE */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30">
        <ThemeToggle showDropdown={true} />
      </div>

      {/* COMPACT & RESPONSIVE 3D CARD */}
      <div className="w-full max-w-[370px] sm:max-w-[400px] my-auto transition-all duration-500">
        <div
          className={`w-full rounded-[28px] sm:rounded-[36px] px-5 py-4 sm:px-6 sm:py-5.5 transition-all duration-500 border ${portalConfig.cardBg}`}
          style={{
            boxShadow:
              portalMode === 'keamanan'
                ? '0 20px 45px -10px rgba(5, 150, 105, 0.35), 0 8px 20px -6px rgba(0, 0, 0, 0.4)'
                : portalMode === 'admin_it'
                ? '0 20px 45px -10px rgba(2, 132, 199, 0.35), 0 8px 20px -6px rgba(0, 0, 0, 0.4)'
                : '0 16px 36px -8px rgba(150, 110, 20, 0.28), 0 6px 14px -4px rgba(0, 0, 0, 0.06)',
          }}
        >
          {/* 🌟 SELECTOR PORTAL CERDAS & INTERAKTIF */}
          <div className="flex items-center justify-between p-1 rounded-2xl bg-black/10 dark:bg-black/35 mb-3 gap-1 border border-white/5">
            <button
              type="button"
              onClick={() => {
                setPortalMode('keamanan');
                if (!identifier || identifier.includes('syauqillah') || identifier.includes('admin@')) {
                  setIdentifier('keamanan@absensi.com');
                }
              }}
              className={`flex-1 py-1.5 px-1.5 rounded-xl text-[10px] sm:text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                portalMode === 'keamanan'
                  ? 'bg-gradient-to-r from-[#0D7A6F] to-[#059669] text-white shadow-md shadow-emerald-950/50 scale-[1.03]'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
              title="Portal Khusus Biro Keamanan & Ketertiban Santri"
            >
              <ShieldAlert size={13} />
              <span>Kedisiplinan</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPortalMode('admin_it');
                if (!identifier || identifier.includes('keamanan') || identifier.includes('admin@')) {
                  setIdentifier('syauqillah@absensi.com');
                }
              }}
              className={`flex-1 py-1.5 px-1.5 rounded-xl text-[10px] sm:text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                portalMode === 'admin_it'
                  ? 'bg-gradient-to-r from-[#0369A1] to-[#0284C7] text-white shadow-md shadow-sky-950/50 scale-[1.03]'
                  : 'text-slate-400 hover:text-sky-300'
              }`}
              title="Pusat Kendali Master IT & Sistem"
            >
              <Terminal size={13} />
              <span>Admin IT</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPortalMode('pengurus_umum');
                if (identifier.includes('keamanan') || identifier.includes('syauqillah')) {
                  setIdentifier('');
                }
              }}
              className={`flex-1 py-1.5 px-1.5 rounded-xl text-[10px] sm:text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                portalMode === 'pengurus_umum'
                  ? 'bg-[#138F81] text-white shadow-md shadow-teal-950/40 scale-[1.03]'
                  : 'text-slate-500 hover:text-[#138F81]'
              }`}
              title="Portal Administrasi Yayasan, Pengurus, Bendahara & Wali"
            >
              <Building2 size={13} />
              <span>Pengurus</span>
            </button>
          </div>

          {/* LOGO QOMARUDDIN & TITLE */}
          <div className="flex flex-col items-center text-center mb-2.5 sm:mb-3.5">
            <div className={`h-14 w-14 sm:h-15 sm:w-15 flex items-center justify-center mb-2 transition-all duration-300 rounded-2xl ${portalConfig.logoHalo}`}>
              <img
                className="h-full w-full object-contain drop-shadow-md rounded-2xl"
                src={qomaruddinLogo}
                alt="Logo Qomaruddin"
              />
            </div>

            {/* BADGE PERSONA AKTIF */}
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black tracking-wider border mb-1 transition-all ${portalConfig.badgeBg}`}>
              {portalConfig.badgeLabel}
            </span>

            <h1 className={`text-xl sm:text-2xl font-black tracking-tight leading-tight transition-colors ${portalConfig.titleColor}`}>
              {portalConfig.title}
            </h1>
            <p className={`text-[11px] font-medium transition-colors ${portalConfig.subtitleColor}`}>
              {portalConfig.subtitle}
            </p>
          </div>

          {/* FORM */}
          <form className="space-y-2.5 sm:space-y-3" onSubmit={handleSubmit}>
            {/* USERNAME INPUT */}
            <div
              className={`relative rounded-[18px] transition-all border ${portalConfig.inputClass}`}
              style={{
                boxShadow: portalMode === 'pengurus_umum' ? portalConfig.inputBoxShadow : undefined,
              }}
            >
              <UserRound
                className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${portalConfig.inputIcon}`}
                size={17}
              />
              <input
                className="w-full bg-transparent pl-10 pr-3.5 py-2.5 sm:py-2.8 text-xs sm:text-[13px] font-bold outline-hidden"
                value={identifier}
                onChange={(event) => handleIdentifierChange(event.target.value)}
                autoComplete="username"
                placeholder={portalConfig.placeholderUser}
                required
              />
            </div>

            {/* PASSWORD INPUT */}
            <div
              className={`relative rounded-[18px] transition-all border ${portalConfig.inputClass}`}
              style={{
                boxShadow: portalMode === 'pengurus_umum' ? portalConfig.inputBoxShadow : undefined,
              }}
            >
              <LockKeyhole
                className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${portalConfig.inputIcon}`}
                size={17}
              />
              <input
                className="w-full bg-transparent pl-10 pr-10 py-2.5 sm:py-2.8 text-xs sm:text-[13px] font-bold outline-hidden"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder={portalConfig.placeholderPass}
                required
              />
              <button
                className={`absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg transition-colors cursor-pointer ${portalConfig.inputIcon} hover:text-white`}
                onClick={() => setShowPassword((value) => !value)}
                type="button"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* REMEMBER ME & LUPA PASSWORD */}
            <div className="flex items-center justify-between text-xs font-semibold px-1 pt-0.5">
              <label className={`inline-flex items-center gap-1.5 cursor-pointer select-none ${portalConfig.subtitleColor}`}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-gray-300 text-[#138F81] focus:ring-[#138F81] h-3.5 w-3.5 cursor-pointer"
                />
                <span className="text-[11px]">Remember me</span>
              </label>

              <button
                type="button"
                onClick={openForgotModal}
                className={`text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 hover:underline ${
                  portalMode === 'keamanan'
                    ? 'text-emerald-400 hover:text-emerald-300'
                    : portalMode === 'admin_it'
                    ? 'text-sky-400 hover:text-sky-300'
                    : 'text-[#138F81] dark:text-[#2DD4BF] hover:text-[#0c6b61]'
                }`}
              >
                <HelpCircle size={12} />
                <span>Bantuan Akun?</span>
              </button>
            </div>

            {/* ERROR MESSAGE */}
            {error && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 px-3 py-2 text-xs font-bold text-[#D63031] dark:text-rose-400 shadow-xs">
                {error}
              </div>
            )}

            {/* CLOUDFLARE TURNSTILE HUMAN VERIFICATION WIDGET */}
            <CloudflareTurnstile
              onVerify={(token) => {
                setTurnstileToken(token);
                setError('');
              }}
              onExpire={() => setTurnstileToken('')}
              theme="auto"
            />

            {/* 3D BRAND ACTION BUTTON */}
            <button
              className={`w-full py-3.5 px-5 min-h-[48px] rounded-2xl text-xs sm:text-sm font-black tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2 shadow-md ${
                !turnstileToken || isSubmitting
                  ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-none'
                  : `${portalConfig.btnBg} active:scale-[0.98] cursor-pointer`
              }`}
              disabled={!turnstileToken || isSubmitting}
              type="submit"
              title={!turnstileToken ? 'Harap tunggu atau selesaikan verifikasi Cloudflare' : 'Klik untuk masuk'}
            >
              {!turnstileToken ? (
                <>
                  <LockKeyhole size={17} />
                  <span>VERIFIKASI KEAMANAN DULU</span>
                </>
              ) : isSubmitting ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>MEMVERIFIKASI AKUN...</span>
                </>
              ) : (
                <>
                  <span>{portalConfig.btnText}</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>

            {/* QUICK LINK TO PUBLIC PMB & PROFILE PORTAL */}
            {onOpenPmb && (
              <button
                type="button"
                onClick={onOpenPmb}
                className="w-full py-2.5 sm:py-3 px-4 min-h-[42px] rounded-xl bg-white/10 hover:bg-white/15 text-xs font-extrabold border border-white/20 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <span>🌟 Profil Pesantren & PMB Online</span>
                <ArrowRight size={14} />
              </button>
            )}
          </form>

          {/* FOOTER TEXT */}
          <div className="mt-3.5 pt-2.5 border-t border-white/10 text-center">
            <p className={`text-[10px] font-extrabold uppercase tracking-wider ${portalConfig.subtitleColor}`}>
              Pondok Pesantren Qomaruddin
            </p>
            <p className="text-[9px] font-medium opacity-70">
              Sampurnan Bungah Gresik • Jawa Timur
            </p>
            <div className="mt-1 flex items-center justify-center gap-1 text-[9px] font-semibold opacity-80">
              <span>Persona Portal:</span>
              <span className="px-2 py-0.5 rounded-md bg-white/10 font-black border border-white/15 text-[9px] tracking-wide">
                {portalConfig.footerBadge}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL LUPA PASSWORD (WHATSAPP SMART HELPDESK) */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden transition-all text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-br from-[#138F81] to-[#0A564D] p-5 sm:p-6 text-white relative">
              <button
                onClick={() => setShowForgotModal(false)}
                type="button"
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Tutup"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shadow-inner shrink-0">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-teal-400/25 border border-teal-300/30 text-[10px] font-black uppercase tracking-wider text-teal-100 mb-0.5">
                    Helpdesk Resmi Pesantren
                  </span>
                  <h3 className="text-lg font-black text-white leading-tight">
                    Bantuan Lupa Kata Sandi
                  </h3>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-4 text-xs">
              <div className="rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200/70 dark:border-teal-800/50 p-3.5 flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#138F81] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-100">
                    Layanan Reset Sandi via WhatsApp
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Pengurus / Admin IT Pesantren akan memverifikasi identitas Anda dan mereset kata sandi ke sandi bawaan default.
                  </p>
                </div>
              </div>

              {loadingHelpdesk ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-500">
                  <div className="w-6 h-6 border-2 border-[#138F81] border-t-transparent rounded-full animate-spin" />
                  <span className="text-[11px] font-semibold">Memuat kontak helpdesk...</span>
                </div>
              ) : (
                <>
                  {/* Form identitas opsional agar pesan otomatis terisi */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        1. Nama Santri / Pengguna:
                      </label>
                      <input
                        type="text"
                        value={forgotName}
                        onChange={(e) => setForgotName(e.target.value)}
                        placeholder="Contoh: Adinda nur / Ustadz Hasan"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-[#138F81] focus:ring-1 focus:ring-[#138F81] outline-hidden transition-all"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          2. NIS Santri / No. Induk Akun:
                        </label>
                        <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200/50">
                          Sangat Dianjurkan
                        </span>
                      </div>
                      <input
                        type="text"
                        value={forgotContact}
                        onChange={(e) => setForgotContact(e.target.value)}
                        placeholder="Contoh: 2026001 / NIS Santri"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-[#138F81] focus:ring-1 focus:ring-[#138F81] outline-hidden transition-all"
                      />
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium leading-relaxed flex items-center gap-1">
                        <span>💡</span>
                        <span>Cantumkan NIS agar Admin IT tidak keliru jika ada nama santri yang sama / kembar.</span>
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        3. Peran / Status Akun:
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {['Wali Santri', 'Guru', 'Petugas'].map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setForgotRole(r)}
                            className={`py-2 px-2 rounded-xl text-[11px] font-bold text-center border transition-all cursor-pointer ${
                              forgotRole === r
                                ? 'bg-[#138F81] text-white border-[#138F81] shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-200'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Preview Bubble Pesan WA */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Pesan Otomatis WhatsApp:
                        </label>
                        <button
                          type="button"
                          onClick={handleCopyMessage}
                          className="text-[11px] font-bold text-[#138F81] dark:text-[#2DD4BF] hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          {copiedMsg ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          <span>{copiedMsg ? 'Tersalin!' : 'Salin Pesan'}</span>
                        </button>
                      </div>
                      <div className="rounded-xl bg-[#EFEAE2] dark:bg-slate-800 border border-[#D1D7DB] dark:border-slate-700 p-3 text-[11px] font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed shadow-inner max-h-32 overflow-y-auto">
                        {compiledMessage}
                      </div>
                    </div>

                    {/* Info PIC */}
                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1">
                      <span>Penanggung Jawab:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {helpdeskInfo?.contact_person_name || helpdeskInfo?.pic_name || 'Admin IT'} ({cleanWaNumber})
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs text-center flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all"
                    >
                      <ExternalLink size={15} />
                      <span>KIRIM KE WHATSAPP</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
