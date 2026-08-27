import { Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles, UserCheck, UserRound, Users } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const [loginMode, setLoginMode] = useState<'admin' | 'wali'>('admin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleModeChange = (mode: 'admin' | 'wali') => {
    setLoginMode(mode);
    setError('');
    setIdentifier('');
    if (mode === 'wali') {
      setPassword('siswa12345');
    } else {
      setPassword('');
    }
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(identifier.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal. Periksa kembali data Anda.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="q-login-shell grid min-h-[100dvh] w-full place-items-center bg-[#FFDC80] p-3 sm:p-6 md:p-8">
      <section className="q-login-card grid w-full max-w-5xl overflow-hidden rounded-[24px] sm:rounded-[32px] bg-[#FFFDF7] shadow-2xl shadow-black/10 lg:grid-cols-[1.08fr_0.92fr]">
        {/* LEFT BRAND PANEL */}
        <div className="hidden bg-[#E1EFF7] p-10 lg:block">
          <div className="flex h-full flex-col justify-center">
            <img className="q-brand-logo h-24 w-24 object-contain" src="/logo-qomaruddin.png" alt="Logo Qomaruddin" />
            <h1 className="mt-8 max-w-md text-3xl xl:text-4xl font-extrabold leading-tight text-[#2D3436]">
              Sistem Informasi Pondok & Madrasah
            </h1>
            <p className="mt-4 max-w-md text-sm font-semibold leading-7 text-[#636E72]">
              Yayasan Pondok Pesantren Qomaruddin — Sampurnan Bungah Gresik. Terintegrasi untuk Admin, Bendahara, Dewan Guru, dan Wali Santri.
            </p>

            <div className="mt-8 grid max-w-md gap-3">
              <div className="flex items-center gap-3 rounded-3xl bg-white/80 px-4 py-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#E8F7F3] text-[#138F81]">
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-[#2D3436]">Panel Admin & Bendahara</p>
                  <p className="text-xs font-semibold text-[#636E72]">Manajemen data santri, absensi, keuangan, dan bot WA.</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-3xl bg-white/80 px-4 py-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#E0F2FE] text-[#0284C7]">
                  <Users size={20} />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-[#2D3436]">Portal Wali Santri Realtime</p>
                  <p className="text-xs font-semibold text-[#636E72]">Cek absensi madin & ngaji, tagihan SPP, dan nilai raport.</p>
                </div>
              </div>
            </div>

            <p className="mt-10 text-xs font-bold uppercase tracking-[0.18em] text-[#138F81]">
              Yayasan Pondok Pesantren Qomaruddin
            </p>
          </div>
        </div>

        {/* RIGHT FORM PANEL */}
        <div className="q-login-form-panel flex w-full items-center justify-center p-5 sm:p-8 md:p-10">
          <div className="mx-auto w-full max-w-sm">
            {/* BRAND LOGO MOBILE */}
            <div className="mb-4 sm:mb-6 text-center">
              <img
                className="q-brand-logo mx-auto h-16 w-16 sm:h-18 sm:w-18 object-contain transition-transform hover:scale-105"
                src="/logo-qomaruddin.png"
                alt="Logo Qomaruddin"
              />
              <h2 className="mt-3 text-xl sm:text-2xl font-extrabold text-[#2D3436]">
                {loginMode === 'admin' ? 'Masuk Admin' : 'Portal Wali Santri'}
              </h2>
              <p className="mt-1 text-xs sm:text-sm font-semibold text-[#636E72]">
                {loginMode === 'admin'
                  ? 'Gunakan akun admin utama atau bendahara.'
                  : 'Monitoring absensi, keuangan, & nilai anak realtime.'}
              </p>
            </div>

            {/* TAB SELECTOR: ADMIN VS WALI */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl mb-5">
              <button
                type="button"
                onClick={() => handleModeChange('admin')}
                className={`py-2 text-xs font-black rounded-xl transition-all ${
                  loginMode === 'admin'
                    ? 'bg-white text-[#138F81] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🛡️ Admin / Petugas
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('wali')}
                className={`py-2 text-xs font-black rounded-xl transition-all ${
                  loginMode === 'wali'
                    ? 'bg-[#138F81] text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                👨‍👩‍👧 Wali Santri
              </button>
            </div>

            {/* WALI HELPER CALLOUT */}
            {loginMode === 'wali' && (
              <div className="mb-4 p-3 bg-teal-50/80 border border-teal-200 rounded-2xl text-[11px] text-teal-900 font-semibold leading-relaxed flex items-start gap-2">
                <Sparkles size={16} className="text-[#138F81] shrink-0 mt-0.5" />
                <span>
                  <strong>Panduan Login Wali:</strong> Masukkan <strong>Nama Lengkap Santri</strong> atau <strong>NIS</strong>, dengan sandi default <strong>siswa12345</strong>.
                </span>
              </div>
            )}

            {/* FORM */}
            <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-1.5 sm:mb-2 block text-xs sm:text-sm font-bold text-[#636E72]">
                  {loginMode === 'admin' ? 'Username / Email' : 'Nama Lengkap Santri / NIS'}
                </span>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-[#138F81]" size={18} />
                  <input
                    className="q-input q-input-icon-left w-full text-xs sm:text-sm transition-all focus:ring-2 focus:ring-[#138F81]/30"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    autoComplete="username"
                    placeholder={
                      loginMode === 'admin'
                        ? 'Masukkan username atau email'
                        : 'Contoh: AHMAD FAISAL atau 2425001'
                    }
                    required
                  />
                </div>
              </label>

              <label className="block">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <span className="block text-xs sm:text-sm font-bold text-[#636E72]">Password</span>
                  {loginMode === 'wali' && password !== 'siswa12345' && (
                    <button
                      type="button"
                      onClick={() => setPassword('siswa12345')}
                      className="text-[10px] font-bold text-[#138F81] hover:underline"
                    >
                      Pakai Sandi Default
                    </button>
                  )}
                </div>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-[#138F81]" size={18} />
                  <input
                    className="q-input q-input-icon-both w-full text-xs sm:text-sm transition-all focus:ring-2 focus:ring-[#138F81]/30"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder={loginMode === 'wali' ? 'Default: siswa12345' : 'Masukkan password'}
                    required
                  />
                  <button
                    className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-[#636E72] transition-colors hover:bg-black/5"
                    onClick={() => setShowPassword((value) => !value)}
                    type="button"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              {error ? (
                <div className="rounded-2xl bg-[#FDECEC] border border-rose-200 px-4 py-3 text-xs sm:text-sm font-bold text-[#D63031]">
                  {error}
                </div>
              ) : null}

              <button
                className="mt-2 min-h-11 sm:min-h-12 w-full rounded-xl sm:rounded-2xl bg-[#138F81] px-5 text-xs sm:text-sm font-extrabold text-white shadow-lg shadow-[#138F81]/25 transition-all hover:bg-[#0f7569] hover:shadow-xl active:scale-[0.99] disabled:opacity-60"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting
                  ? 'Memproses...'
                  : loginMode === 'admin'
                  ? 'Masuk Dashboard Admin'
                  : 'Masuk Portal Wali Santri'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
