import { Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
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
    <main className="min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 md:p-8 bg-[#FFDC80] relative overflow-hidden font-sans select-none">
      
      {/* SOFT AMBIENT GLOWS ON YELLOW BACKGROUND */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* STANDALONE CIRCULAR / SQUIRCLE NEUMORPHIC CONTAINER PERSIS SCREENSHOT */}
      <div className="relative w-full max-w-[420px] sm:max-w-[450px]">
        
        {/* OUTER CIRCULAR BEZEL / EMBOSSED RIM */}
        <div
          className="w-full rounded-[44px] sm:rounded-[56px] bg-[#f0f3f6] p-7 sm:p-10 md:p-12 relative border border-white/80"
          style={{
            boxShadow: '18px 18px 45px rgba(180, 140, 50, 0.28), -14px -14px 40px rgba(255, 255, 255, 0.9), inset 1px 1px 2px rgba(255, 255, 255, 0.8)',
          }}
        >
          {/* LOGO QOMARUDDIN */}
          <div className="flex flex-col items-center text-center mb-5">
            <div
              className="h-20 w-20 sm:h-22 sm:w-22 rounded-full p-2.5 bg-[#f0f3f6] flex items-center justify-center mb-3.5 transition-transform duration-300 hover:scale-105"
              style={{
                boxShadow: '6px 6px 14px #d1d9e2, -6px -6px 14px #ffffff',
              }}
            >
              <img
                className="h-14 w-14 sm:h-16 sm:w-16 object-contain drop-shadow-xs"
                src="/logo-qomaruddin.png"
                alt="Logo Qomaruddin"
              />
            </div>

            {/* TITLE & SUBTITLE PERSIS SCREENSHOT */}
            <h1 className="text-3xl sm:text-4xl font-black text-[#2D3436] tracking-tight">
              Login
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm font-semibold text-[#7B8794]">
              Sign in to your account
            </p>
          </div>

          {/* FORM PERSIS SCREENSHOT */}
          <form className="space-y-4 sm:space-y-5 mt-6" onSubmit={handleSubmit}>
            
            {/* USERNAME INPUT (NEUMORPHIC INSET) */}
            <div
              className="relative rounded-2xl sm:rounded-[20px] bg-[#f0f3f6] transition-all focus-within:ring-2 focus-within:ring-[#138F81]/30 focus-within:border-[#138F81]/40 border border-transparent"
              style={{
                boxShadow: 'inset 4px 4px 8px #d1d9e2, inset -4px -4px 8px #ffffff',
              }}
            >
              <UserRound
                className="pointer-events-none absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-[#7B8794]"
                size={19}
              />
              <input
                className="w-full bg-transparent pl-12 sm:pl-13 pr-4 py-3.5 sm:py-4 text-xs sm:text-sm font-bold text-[#2D3436] placeholder:text-[#9AA5B1] placeholder:font-normal outline-hidden"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoComplete="username"
                placeholder="Username / Email / NIS"
                required
              />
            </div>

            {/* PASSWORD INPUT (NEUMORPHIC INSET) */}
            <div
              className="relative rounded-2xl sm:rounded-[20px] bg-[#f0f3f6] transition-all focus-within:ring-2 focus-within:ring-[#138F81]/30 focus-within:border-[#138F81]/40 border border-transparent"
              style={{
                boxShadow: 'inset 4px 4px 8px #d1d9e2, inset -4px -4px 8px #ffffff',
              }}
            >
              <LockKeyhole
                className="pointer-events-none absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-[#7B8794]"
                size={19}
              />
              <input
                className="w-full bg-transparent pl-12 sm:pl-13 pr-11 sm:pr-12 py-3.5 sm:py-4 text-xs sm:text-sm font-bold text-[#2D3436] placeholder:text-[#9AA5B1] placeholder:font-normal outline-hidden"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Password"
                required
              />
              <button
                className="absolute right-3.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl text-[#7B8794] hover:text-[#2D3436] transition-colors cursor-pointer"
                onClick={() => setShowPassword((value) => !value)}
                type="button"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* REMEMBER ME & FORGOT PASSWORD PERSIS SCREENSHOT */}
            <div className="flex items-center justify-between text-xs sm:text-[13px] font-semibold text-[#7B8794] px-1 pt-0.5">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded-md border-gray-300 text-[#138F81] focus:ring-[#138F81] h-4 w-4 cursor-pointer"
                />
                <span>Remember me</span>
              </label>

              <span className="text-[#9AA5B1] text-[11px] sm:text-xs">
                Yayasan Qomaruddin
              </span>
            </div>

            {/* ERROR MESSAGE */}
            {error && (
              <div
                className="rounded-2xl bg-rose-50 border border-rose-200/80 px-4 py-3 text-xs font-bold text-[#D63031]"
                style={{
                  boxShadow: 'inset 2px 2px 4px rgba(214, 48, 49, 0.08)',
                }}
              >
                {error}
              </div>
            )}

            {/* NEUMORPHIC 3D SUBMIT BUTTON PERSIS SCREENSHOT */}
            <button
              className="mt-3 w-full py-3.5 sm:py-4 px-6 rounded-2xl sm:rounded-[20px] bg-[#f0f3f6] text-xs sm:text-sm font-black tracking-widest uppercase text-[#52606D] hover:text-[#138F81] transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-60 border border-white/60"
              style={{
                boxShadow: '6px 6px 14px #d1d9e2, -6px -6px 14px #ffffff',
              }}
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? 'SIGNING IN...' : 'SIGN IN'}
            </button>
          </form>

          {/* FOOTER TEXT */}
          <div className="mt-8 text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#138F81]">
              Pondok Pesantren Qomaruddin
            </p>
            <p className="text-[10px] font-medium text-[#7B8794] mt-0.5">
              Sampurnan Bungah Gresik • Jawa Timur
            </p>
          </div>

        </div>
      </div>
    </main>
  );
}



