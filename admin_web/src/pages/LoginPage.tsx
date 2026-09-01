import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
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
    <main className="h-[100dvh] w-full flex items-center justify-center p-3 sm:p-5 bg-[#FFDC80] font-sans select-none overflow-hidden">
      
      {/* STANDALONE 3D CARD */}
      <div className="w-full max-w-[380px] sm:max-w-[400px]">
        
        {/* CARD CONTAINER (CLEAN 3D DEPTH SHADOW WITHOUT WHITE GLOW) */}
        <div
          className="w-full rounded-[36px] sm:rounded-[44px] bg-[#f8fafc] px-6 py-6 sm:px-8 sm:py-8"
          style={{
            boxShadow: '0 22px 45px -10px rgba(150, 110, 20, 0.35), 0 10px 20px -5px rgba(0, 0, 0, 0.08)',
          }}
        >
          {/* LOGO QOMARUDDIN */}
          <div className="flex flex-col items-center text-center mb-4">
            <div className="h-16 w-16 sm:h-18 sm:w-18 rounded-full p-2 bg-white flex items-center justify-center mb-2.5 transition-transform duration-300 hover:scale-105 shadow-md shadow-black/5 border border-slate-100">
              <img
                className="h-12 w-12 sm:h-13 sm:w-13 object-contain drop-shadow-xs"
                src="/logo-qomaruddin.png"
                alt="Logo Qomaruddin"
              />
            </div>

            {/* TITLE & SUBTITLE */}
            <h1 className="text-2xl sm:text-3xl font-black text-[#2D3436] tracking-tight">
              Login
            </h1>
            <p className="text-[11px] sm:text-xs font-semibold text-[#7B8794] mt-0.5">
              Sign in to your account
            </p>
          </div>

          {/* FORM */}
          <form className="space-y-3.5 sm:space-y-4" onSubmit={handleSubmit}>
            
            {/* USERNAME INPUT */}
            <div
              className="relative rounded-2xl bg-[#f1f5f9] transition-all focus-within:ring-2 focus-within:ring-[#138F81]/40 border border-slate-200/70"
              style={{
                boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.04)',
              }}
            >
              <UserRound
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#7B8794]"
                size={18}
              />
              <input
                className="w-full bg-transparent pl-11 pr-4 py-3 sm:py-3.5 text-xs sm:text-sm font-bold text-[#2D3436] placeholder:text-[#9AA5B1] placeholder:font-normal outline-hidden"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoComplete="username"
                placeholder="Username / Email / NIS"
                required
              />
            </div>

            {/* PASSWORD INPUT */}
            <div
              className="relative rounded-2xl bg-[#f1f5f9] transition-all focus-within:ring-2 focus-within:ring-[#138F81]/40 border border-slate-200/70"
              style={{
                boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.04)',
              }}
            >
              <LockKeyhole
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#7B8794]"
                size={18}
              />
              <input
                className="w-full bg-transparent pl-11 pr-11 py-3 sm:py-3.5 text-xs sm:text-sm font-bold text-[#2D3436] placeholder:text-[#9AA5B1] placeholder:font-normal outline-hidden"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Password"
                required
              />
              <button
                className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl text-[#7B8794] hover:text-[#2D3436] transition-colors cursor-pointer"
                onClick={() => setShowPassword((value) => !value)}
                type="button"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            {/* REMEMBER ME & HELPER */}
            <div className="flex items-center justify-between text-xs font-semibold text-[#7B8794] px-1">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-gray-300 text-[#138F81] focus:ring-[#138F81] h-3.5 w-3.5 cursor-pointer"
                />
                <span className="text-[11px] sm:text-xs">Remember me</span>
              </label>

              <span className="text-[#9AA5B1] text-[10px] sm:text-[11px]">
                Yayasan Qomaruddin
              </span>
            </div>

            {/* ERROR MESSAGE */}
            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200/80 px-3.5 py-2.5 text-xs font-bold text-[#D63031] shadow-xs">
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
          </form>

          {/* FOOTER TEXT */}
          <div className="mt-5 text-center">
            <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest text-[#138F81]">
              Pondok Pesantren Qomaruddin
            </p>
            <p className="text-[9px] sm:text-[10px] font-medium text-[#7B8794]">
              Sampurnan Bungah Gresik • Jawa Timur
            </p>
          </div>

        </div>
      </div>
    </main>
  );
}





