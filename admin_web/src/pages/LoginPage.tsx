import { ArrowRight, Check, Copy, ExternalLink, Eye, EyeOff, HelpCircle, LockKeyhole, MessageSquare, ShieldCheck, UserRound, X } from 'lucide-react';
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
    <main className="relative min-h-[100dvh] w-full flex items-center justify-center p-3 sm:p-4 bg-[#FFDC80] dark:bg-[#0B1120] font-sans select-none overflow-y-auto transition-colors duration-300">
      {/* CORNER THEME TOGGLE DENGAN MIKRO-ANIMASI CERDAS */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30">
        <ThemeToggle showDropdown={true} />
      </div>

      {/* COMPACT & RESPONSIVE 3D CARD (TIDAK MEMANJANG) */}
      <div className="w-full max-w-[360px] sm:max-w-[380px] my-auto">
        <div
          className="w-full rounded-[28px] sm:rounded-[36px] bg-[#f8fafc] dark:bg-[#1E293B] px-5 py-4 sm:px-6 sm:py-5 transition-all duration-300 border border-slate-100/90 dark:border-slate-800"
          style={{
            boxShadow: '0 16px 36px -8px rgba(150, 110, 20, 0.28), 0 6px 14px -4px rgba(0, 0, 0, 0.06)',
          }}
        >
          {/* LOGO QOMARUDDIN & TITLE (PROPORSIONAL & RINGKAS) */}
          <div className="flex flex-col items-center text-center mb-2.5 sm:mb-3">
            <div className="h-14 w-14 sm:h-15 sm:w-15 flex items-center justify-center mb-1.5 transition-transform duration-300 hover:scale-105">
              <img
                className="h-full w-full object-contain drop-shadow-md rounded-2xl"
                src={qomaruddinLogo}
                alt="Logo Qomaruddin"
              />
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-[#2D3436] dark:text-white tracking-tight leading-tight">
              Login
            </h1>
            <p className="text-[11px] font-semibold text-[#7B8794] dark:text-slate-400">
              Sign in to your account
            </p>
          </div>

          {/* FORM */}
          <form className="space-y-2.5 sm:space-y-3" onSubmit={handleSubmit}>
            {/* USERNAME INPUT */}
            <div
              className="relative rounded-[18px] bg-[#edf2f7] dark:bg-slate-800/80 transition-all focus-within:ring-2 focus-within:ring-[#138F81]/40 border border-transparent"
              style={{
                boxShadow: 'inset 3.5px 3.5px 7px #ccd6e2, inset -3.5px -3.5px 7px #ffffff',
              }}
            >
              <UserRound
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7B8794] dark:text-slate-400"
                size={17}
              />
              <input
                className="w-full bg-transparent pl-10 pr-3.5 py-2.5 sm:py-2.8 text-xs sm:text-[13px] font-bold text-[#2D3436] dark:text-slate-100 placeholder:text-[#9AA5B1] dark:placeholder:text-slate-500 placeholder:font-normal outline-hidden"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoComplete="username"
                placeholder="Nama / Email / Kode Guru / NIS"
                required
              />
            </div>

            {/* PASSWORD INPUT */}
            <div
              className="relative rounded-[18px] bg-[#edf2f7] dark:bg-slate-800/80 transition-all focus-within:ring-2 focus-within:ring-[#138F81]/40 border border-transparent"
              style={{
                boxShadow: 'inset 3.5px 3.5px 7px #ccd6e2, inset -3.5px -3.5px 7px #ffffff',
              }}
            >
              <LockKeyhole
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7B8794] dark:text-slate-400"
                size={17}
              />
              <input
                className="w-full bg-transparent pl-10 pr-10 py-2.5 sm:py-2.8 text-xs sm:text-[13px] font-bold text-[#2D3436] dark:text-slate-100 placeholder:text-[#9AA5B1] dark:placeholder:text-slate-500 placeholder:font-normal outline-hidden"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Password"
                required
              />
              <button
                className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-[#7B8794] dark:text-slate-400 hover:text-[#2D3436] dark:hover:text-slate-200 transition-colors cursor-pointer"
                onClick={() => setShowPassword((value) => !value)}
                type="button"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* REMEMBER ME & LUPA PASSWORD */}
            <div className="flex items-center justify-between text-xs font-semibold text-[#7B8794] dark:text-slate-400 px-1 pt-0.5">
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
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
                className="text-[#138F81] dark:text-[#2DD4BF] hover:text-[#0c6b61] hover:underline text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
              >
                <HelpCircle size={12} />
                <span>Lupa Password?</span>
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

            {/* 3D TEAL BRAND ACTION BUTTON */}
            <button
              className={`w-full py-3.5 px-5 min-h-[48px] rounded-2xl text-xs sm:text-sm font-black tracking-widest uppercase transition-all duration-200 flex items-center justify-center gap-2 shadow-md ${
                !turnstileToken || isSubmitting
                  ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-[#138F81] hover:bg-[#0e7467] text-white active:scale-[0.98] cursor-pointer shadow-[#138F81]/30'
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
                  <span>SIGNING IN...</span>
                </>
              ) : (
                <>
                  <span>SIGN IN</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>

            {/* QUICK LINK TO PUBLIC PMB & PROFILE PORTAL */}
            {onOpenPmb && (
              <button
                type="button"
                onClick={onOpenPmb}
                className="w-full py-2.5 sm:py-3 px-4 min-h-[42px] rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-slate-800 dark:to-teal-950/40 hover:from-emerald-100 hover:to-teal-100 text-[#0f766e] dark:text-[#2DD4BF] text-xs font-extrabold border border-teal-200/80 dark:border-teal-800/60 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <span>🌟 Profil Pesantren & PMB Online</span>
                <ArrowRight size={14} />
              </button>
            )}
          </form>

          {/* FOOTER TEXT (COMPACT & SLEEK) */}
          <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-center">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#138F81] dark:text-[#2DD4BF]">
              Pondok Pesantren Qomaruddin
            </p>
            <p className="text-[9px] font-medium text-[#7B8794] dark:text-slate-400">
              Sampurnan Bungah Gresik • Jawa Timur
            </p>
            <div className="mt-1 flex items-center justify-center gap-1 text-[9px] font-semibold text-slate-400 dark:text-slate-500">
              <span>Engineered by</span>
              <span className="px-1.5 py-0.2 rounded-md bg-teal-50 dark:bg-teal-950/60 text-[#138F81] dark:text-[#2DD4BF] font-black border border-teal-200/60 dark:border-teal-800/50 text-[9px] tracking-wide">
                ITQOM
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
