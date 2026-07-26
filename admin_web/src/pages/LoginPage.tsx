import { Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
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
      setError(err instanceof Error ? err.message : 'Login gagal');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="q-login-shell grid min-h-[100dvh] w-full place-items-center bg-[#FFDC80] p-3 sm:p-6 md:p-8">
      <section className="q-login-card grid w-full max-w-5xl overflow-hidden rounded-[24px] sm:rounded-[32px] bg-[#FFFDF7] shadow-2xl shadow-black/10 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="hidden bg-[#E1EFF7] p-10 lg:block">
          <div className="flex h-full flex-col justify-center">
            <img className="q-brand-logo h-24 w-24 object-contain" src="/logo-qomaruddin.png" alt="Logo Qomaruddin" />
            <h1 className="mt-8 max-w-md text-4xl font-extrabold leading-tight text-[#2D3436]">Admin Web Qomaruddin</h1>
            <p className="mt-4 max-w-md text-sm font-semibold leading-7 text-[#636E72]">
              Panel kerja Admin Utama dan Bendahara untuk mengelola data madrasah, pondok, absensi, dan keuangan.
            </p>
            <div className="mt-8 grid max-w-md gap-3">
              <div className="flex items-center gap-3 rounded-3xl bg-white/80 px-4 py-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#E8F7F3] text-[#138F81]">
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-[#2D3436]">Akses terkontrol</p>
                  <p className="text-xs font-semibold text-[#636E72]">Admin utama full akses, bendahara fokus keuangan.</p>
                </div>
              </div>
            </div>
            <p className="mt-10 text-xs font-bold uppercase tracking-[0.18em] text-[#138F81]">Yayasan Pondok Pesantren Qomaruddin</p>
          </div>
        </div>
        <div className="q-login-form-panel flex w-full items-center justify-center p-5 sm:p-8 md:p-10">
          <div className="mx-auto w-full max-w-sm">
          <div className="mb-6 sm:mb-8 text-center">
            <img className="q-brand-logo mx-auto h-16 w-16 sm:h-20 sm:w-20 object-contain transition-transform hover:scale-105" src="/logo-qomaruddin.png" alt="Logo Qomaruddin" />
            <h2 className="mt-3 sm:mt-4 text-xl sm:text-2xl font-extrabold text-[#2D3436]">Masuk Admin</h2>
            <p className="mt-1 text-xs sm:text-sm font-semibold text-[#636E72]">Gunakan akun admin utama atau bendahara.</p>
          </div>

          <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1.5 sm:mb-2 block text-xs sm:text-sm font-bold text-[#636E72]">Username / Email</span>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-[#138F81]" size={18} />
                <input
                  className="q-input q-input-icon-left w-full text-xs sm:text-sm transition-all focus:ring-2 focus:ring-[#138F81]/30"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  autoComplete="username"
                  placeholder="Masukkan username atau email"
                  required
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 sm:mb-2 block text-xs sm:text-sm font-bold text-[#636E72]">Password</span>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-[#138F81]" size={18} />
                <input
                  className="q-input q-input-icon-both w-full text-xs sm:text-sm transition-all focus:ring-2 focus:ring-[#138F81]/30"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Masukkan password"
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

            {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-xs sm:text-sm font-bold text-[#D63031]">{error}</div> : null}

            <button
              className="mt-2 min-h-11 sm:min-h-12 w-full rounded-xl sm:rounded-2xl bg-[#138F81] px-5 text-xs sm:text-sm font-extrabold text-white shadow-lg shadow-[#138F81]/25 transition-all hover:bg-[#0f7569] hover:shadow-xl active:scale-[0.99] disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? 'Memproses...' : 'Masuk Dashboard'}
            </button>
          </form>
          </div>
        </div>
      </section>
    </main>
  );
}
