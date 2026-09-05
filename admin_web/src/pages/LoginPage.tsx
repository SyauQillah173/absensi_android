import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';

interface LoginPageProps {
  onOpenPmb?: () => void;
}

export function LoginPage({ onOpenPmb }: LoginPageProps = {}) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(identifier.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal. Periksa kembali username & password Anda.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative h-[100dvh] w-full flex items-center justify-center p-3 sm:p-5 bg-[#FFDC80] dark:bg-[#0B1120] font-sans select-none overflow-hidden transition-colors duration-300">
      {/* CORNER THEME TOGGLE DENGAN MIKRO-ANIMASI CERDAS */}
      <div className="absolute top-4 right-4 z-30">
        <ThemeToggle showDropdown={true} />
      </div>

      {/* STANDALONE 3D CARD */}
      <div className="w-full max-w-[380px] sm:max-w-[400px]">
        {/* CARD CONTAINER (CLEAN 3D DEPTH SHADOW WITHOUT WHITE GLOW) */}
        <div
          className="w-full rounded-[36px] sm:rounded-[44px] bg-[#f8fafc] dark:bg-[#1E293B] px-6 py-6 sm:px-8 sm:py-8 transition-colors duration-300 dark:border dark:border-slate-800"
          style={{
            boxShadow: '0 22px 45px -10px rgba(150, 110, 20, 0.35), 0 10px 20px -5px rgba(0, 0, 0, 0.08)',
          }}
        >
          {/* LOGO QOMARUDDIN */}
          <div className="flex flex-col items-center text-center mb-4">
            <div className="h-16 w-16 sm:h-18 sm:w-18 rounded-full p-2 bg-white dark:bg-slate-800 flex items-center justify-center mb-2.5 transition-transform duration-300 hover:scale-105 shadow-md shadow-black/5 border border-slate-100 dark:border-slate-700">
              <img
                className="h-12 w-12 sm:h-13 sm:w-13 object-contain drop-shadow-xs"
                src="/logo-qomaruddin.png"
                alt="Logo Qomaruddin"
              />
            </div>

            {/* TITLE & SUBTITLE */}
            <h1 className="text-2xl sm:text-3xl font-black text-[#2D3436] dark:text-slate-100 tracking-tight">
              Login
            </h1>
            <p className="text-[11px] sm:text-xs font-semibold text-[#7B8794] dark:text-slate-400 mt-0.5">
              Sign in to your account
            </p>
          </div>

          {/* FORM */}
          <form className="space-y-3.5 sm:space-y-4" onSubmit={handleSubmit}>
            {/* USERNAME INPUT (ANJLOK / 3D INSET PERSIS CONTOH) */}
            <div
              className="relative rounded-[22px] bg-[#edf2f7] dark:bg-slate-900/90 transition-all focus-within:ring-2 focus-within:ring-[#138F81]/40 border border-transparent dark:border-slate-800"
              style={{
                boxShadow: 'inset 4.5px 4.5px 9px #ccd6e2, inset -4.5px -4.5px 9px #ffffff',
              }}
            >
              <UserRound
                className="pointer-events-none absolute left-4.5 top-1/2 -translate-y-1/2 text-[#7B8794] dark:text-slate-400"
                size={19}
              />
              <input
                className="w-full bg-transparent pl-12 pr-4 py-3.5 text-xs sm:text-sm font-bold text-[#2D3436] dark:text-slate-100 placeholder:text-[#9AA5B1] dark:placeholder:text-slate-500 placeholder:font-normal outline-hidden"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoComplete="username"
                placeholder="Username / Email / NIS"
                required
              />
            </div>

            {/* PASSWORD INPUT (ANJLOK / 3D INSET PERSIS CONTOH) */}
            <div
              className="relative rounded-[22px] bg-[#edf2f7] dark:bg-slate-900/90 transition-all focus-within:ring-2 focus-within:ring-[#138F81]/40 border border-transparent dark:border-slate-800"
              style={{
                boxShadow: 'inset 4.5px 4.5px 9px #ccd6e2, inset -4.5px -4.5px 9px #ffffff',
              }}
            >
              <LockKeyhole
                className="pointer-events-none absolute left-4.5 top-1/2 -translate-y-1/2 text-[#7B8794] dark:text-slate-400"
                size={19}
              />
              <input
                className="w-full bg-transparent pl-12 pr-12 py-3.5 text-xs sm:text-sm font-bold text-[#2D3436] dark:text-slate-100 placeholder:text-[#9AA5B1] dark:placeholder:text-slate-500 placeholder:font-normal outline-hidden"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Password"
                required
              />
              <button
                className="absolute right-3.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl text-[#7B8794] dark:text-slate-400 hover:text-[#2D3436] dark:hover:text-slate-100 transition-colors cursor-pointer"
                onClick={() => setShowPassword((value) => !value)}
                type="button"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* REMEMBER ME & HELPER */}
            <div className="flex items-center justify-between text-xs font-semibold text-[#7B8794] dark:text-slate-400 px-1">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-gray-300 dark:border-slate-700 text-[#138F81] focus:ring-[#138F81] h-3.5 w-3.5 cursor-pointer"
                />
                <span className="text-[11px] sm:text-xs">Remember me</span>
              </label>

              <span className="text-[#9AA5B1] dark:text-slate-500 text-[10px] sm:text-[11px]">
                Yayasan Qomaruddin
              </span>
            </div>

            {/* ERROR MESSAGE */}
            {error && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/50 px-3.5 py-2.5 text-xs font-bold text-[#D63031] dark:text-rose-400 shadow-xs">
                {error}
              </div>
            )}

            {/* 3D TEAL BRAND ACTION BUTTON */}
            <button
              className="mt-2 w-full py-3.5 px-6 rounded-2xl bg-[#138F81] hover:bg-[#0e7467] text-xs sm:text-sm font-black tracking-widest uppercase text-white transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              style={{
                boxShadow: '0 10px 24px -4px rgba(19, 143, 129, 0.45)',
              }}
              disabled={isSubmitting}
              type="submit"
            >
              <span>{isSubmitting ? 'SIGNING IN...' : 'SIGN IN'}</span>
              {!isSubmitting && <ArrowRight size={16} />}
            </button>

            {/* QUICK LINK TO PUBLIC PMB & PROFILE PORTAL */}
            {onOpenPmb && (
              <button
                type="button"
                onClick={onOpenPmb}
                className="mt-3 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-slate-800 dark:to-slate-800/80 hover:from-emerald-100 hover:to-teal-100 dark:hover:bg-slate-700 text-[#0f766e] dark:text-[#2DD4BF] text-xs font-bold border border-teal-200/80 dark:border-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <span>🌟 Profil Pesantren & PMB Online</span>
                <ArrowRight size={13} />
              </button>
            )}
          </form>

          {/* FOOTER TEXT */}
          <div className="mt-5 text-center">
            <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest text-[#138F81] dark:text-[#2DD4BF]">
              Pondok Pesantren Qomaruddin
            </p>
            <p className="text-[9px] sm:text-[10px] font-medium text-[#7B8794] dark:text-slate-400">
              Sampurnan Bungah Gresik • Jawa Timur
            </p>
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500">
              <span>Managed & Engineered by</span>
              <span className="px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-[#138F81] dark:text-[#2DD4BF] font-black border border-teal-200/60 dark:border-teal-800 text-[10px] tracking-wide">
                IT QOMARUDDIN ( ITQOM )
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

