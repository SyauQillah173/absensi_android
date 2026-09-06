import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { CloudflareTurnstile } from '../components/CloudflareTurnstile';

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
            <div className="h-12 w-12 sm:h-13 sm:w-13 rounded-full p-1.5 bg-white dark:bg-slate-800 flex items-center justify-center mb-1.5 transition-transform duration-300 hover:scale-105 shadow-sm border border-slate-100 dark:border-slate-700">
              <img
                className="h-9 w-9 sm:h-10 sm:w-10 object-contain drop-shadow-xs"
                src="/logo-qomaruddin.png"
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
                placeholder="Username / Email / NIS"
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

            {/* REMEMBER ME & HELPER */}
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

              <span className="text-[#9AA5B1] dark:text-slate-500 text-[10px]">
                Yayasan Qomaruddin
              </span>
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
    </main>
  );
}
