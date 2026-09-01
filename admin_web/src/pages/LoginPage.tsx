import { Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound, Users } from 'lucide-react';
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
    <main className="q-login-shell grid min-h-[100dvh] w-full place-items-center bg-[#FFDC80] p-3 sm:p-6 md:p-8 font-sans">
      <section className="q-login-card grid w-full max-w-5xl overflow-hidden rounded-[28px] sm:rounded-[36px] bg-[#FFFDF7] shadow-2xl shadow-black/15 lg:grid-cols-[1.05fr_0.95fr] border border-amber-200/50">
        
        {/* LEFT BRAND PANEL (KONSISTEN TEMA RESMI QOMARUDDIN) */}
        <div className="hidden bg-[#E1EFF7] p-8 xl:p-10 lg:flex flex-col justify-between border-r border-sky-100/80">
          <div>
            <div className="h-20 w-20 rounded-2xl bg-white/90 p-2.5 shadow-sm border border-sky-100 flex items-center justify-center mb-6">
              <img className="q-brand-logo h-16 w-16 object-contain" src="/logo-qomaruddin.png" alt="Logo Qomaruddin" />
            </div>
            <h1 className="max-w-md text-3xl xl:text-4xl font-extrabold leading-tight text-[#2D3436]">
              Sistem Informasi Pondok & Madrasah
            </h1>
            <p className="mt-3.5 max-w-md text-sm font-semibold leading-relaxed text-[#636E72]">
              Yayasan Pondok Pesantren Qomaruddin — Sampurnan Bungah Gresik. Terintegrasi untuk Admin, Bendahara, Dewan Guru, dan Wali Santri.
            </p>

            <div className="mt-8 grid max-w-md gap-3">
              <div className="flex items-center gap-3 rounded-2xl bg-white/85 px-4 py-3 shadow-xs border border-white">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8F7F3] text-[#138F81] shrink-0">
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <p className="text-xs sm:text-sm font-extrabold text-[#2D3436]">Panel Admin, Bendahara & Guru</p>
                  <p className="text-[11px] font-semibold text-[#636E72]">Manajemen data santri, absensi KBM, sholat, kas, dan raport.</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-white/85 px-4 py-3 shadow-xs border border-white">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E0F2FE] text-[#0284C7] shrink-0">
                  <Users size={20} />
                </span>
                <div>
                  <p className="text-xs sm:text-sm font-extrabold text-[#2D3436]">Portal Wali Santri Terpadu</p>
                  <p className="text-[11px] font-semibold text-[#636E72]">Cek kehadiran madin & ngaji, tagihan SPP, dan perkembangan anak.</p>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.16em] text-[#138F81]">
            Yayasan Pondok Pesantren Qomaruddin
          </p>
        </div>

        {/* RIGHT FORM PANEL (NEUMORPHIC 3D FORM DENGAN TEXT 'LOGIN') */}
        <div className="q-login-form-panel flex w-full items-center justify-center p-6 sm:p-10 md:p-12 bg-[#f4f7fa]">
          <div className="mx-auto w-full max-w-[360px]">
            
            {/* LOGO & TITLE */}
            <div className="text-center mb-6">
              <div
                className="inline-flex h-18 w-18 sm:h-20 sm:w-20 rounded-full p-2 bg-[#f4f7fa] items-center justify-center mb-3 transition-transform hover:scale-105"
                style={{
                  boxShadow: '6px 6px 14px #d8e2ec, -6px -6px 14px #ffffff',
                }}
              >
                <img
                  className="h-12 w-12 sm:h-14 sm:w-14 object-contain drop-shadow-xs"
                  src="/logo-qomaruddin.png"
                  alt="Logo Qomaruddin"
                />
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-[#2D3436] tracking-tight">
                Login
              </h2>
              <p className="mt-1 text-xs sm:text-sm font-semibold text-[#636E72]">
                Sign in to your account
              </p>
            </div>

            {/* UNIFIED FORM */}
            <form className="space-y-4 sm:space-y-4.5" onSubmit={handleSubmit}>
              {/* USERNAME / IDENTIFIER FIELD */}
              <div>
                <div
                  className="relative rounded-2xl bg-[#f4f7fa] transition-all focus-within:ring-2 focus-within:ring-[#138F81]/30 focus-within:border-[#138F81]/40 border border-transparent"
                  style={{
                    boxShadow: 'inset 3.5px 3.5px 7px #d5e0ec, inset -3.5px -3.5px 7px #ffffff',
                  }}
                >
                  <UserRound
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#138F81]"
                    size={18}
                  />
                  <input
                    className="w-full bg-transparent pl-11 pr-4 py-3.5 text-xs sm:text-sm font-bold text-[#2D3436] placeholder:text-slate-400 placeholder:font-normal outline-hidden"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    autoComplete="username"
                    placeholder="Username / Email / NIS"
                    required
                  />
                </div>
              </div>

              {/* PASSWORD FIELD */}
              <div>
                <div
                  className="relative rounded-2xl bg-[#f4f7fa] transition-all focus-within:ring-2 focus-within:ring-[#138F81]/30 focus-within:border-[#138F81]/40 border border-transparent"
                  style={{
                    boxShadow: 'inset 3.5px 3.5px 7px #d5e0ec, inset -3.5px -3.5px 7px #ffffff',
                  }}
                >
                  <LockKeyhole
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#138F81]"
                    size={18}
                  />
                  <input
                    className="w-full bg-transparent pl-11 pr-11 py-3.5 text-xs sm:text-sm font-bold text-[#2D3436] placeholder:text-slate-400 placeholder:font-normal outline-hidden"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Password"
                    required
                  />
                  <button
                    className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl text-[#636E72] hover:text-[#2D3436] transition-colors cursor-pointer"
                    onClick={() => setShowPassword((value) => !value)}
                    type="button"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* REMEMBER ME & HELPER */}
              <div className="flex items-center justify-between text-xs font-semibold text-[#636E72] px-1 pt-0.5">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded-md border-gray-300 text-[#138F81] focus:ring-[#138F81] h-4 w-4 cursor-pointer"
                  />
                  <span>Remember me</span>
                </label>

                <span className="text-[11px] text-slate-400">
                  Pondok & Madrasah
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

              {/* NEUMORPHIC 3D SUBMIT BUTTON */}
              <button
                className="mt-2 w-full py-3.5 px-6 rounded-2xl bg-[#138F81] hover:bg-[#0f7569] text-xs sm:text-sm font-black tracking-widest uppercase text-white transition-all duration-200 hover:brightness-105 active:scale-[0.98] cursor-pointer shadow-lg shadow-[#138F81]/25 disabled:opacity-60"
                style={{
                  boxShadow: '5px 5px 14px #d5e0ec, -5px -5px 14px #ffffff',
                }}
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? 'SIGNING IN...' : 'SIGN IN'}
              </button>
            </form>

            {/* FOOTER HELPER */}
            <div className="mt-7 text-center">
              <p className="text-[11px] font-semibold text-[#636E72]">
                Masuk sebagai Admin, Bendahara, Dewan Guru, atau Wali Santri.
              </p>
            </div>

          </div>
        </div>
      </section>
    </main>
  );
}


