import { Eye, EyeOff, LockKeyhole, Sparkles, UserRound } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const [loginMode, setLoginMode] = useState<'admin' | 'wali'>('admin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

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
      setError(err instanceof Error ? err.message : 'Login gagal. Periksa kembali username & password Anda.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 md:p-8 bg-[#e6edf4] relative overflow-hidden font-sans select-none">
      {/* AMBIENT BACKGROUND GLOWS */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-teal-300/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-200/20 rounded-full blur-3xl pointer-events-none" />

      {/* NEUMORPHIC OUTER CONTAINER */}
      <div className="relative w-full max-w-[440px]">
        {/* OUTER EMBOSSED CIRCULAR BEZEL EFFECT */}
        <div
          className="w-full rounded-[40px] sm:rounded-[48px] bg-[#eef3f8] p-6 sm:p-10 border border-white/60"
          style={{
            boxShadow: '18px 18px 45px #cad5e2, -18px -18px 45px #ffffff',
          }}
        >
          {/* LOGO BADGE */}
          <div className="flex flex-col items-center text-center mb-6">
            <div
              className="relative h-20 w-20 sm:h-22 sm:w-22 rounded-full p-2 bg-[#eef3f8] flex items-center justify-center mb-4 transition-transform hover:scale-105"
              style={{
                boxShadow: '8px 8px 18px #cad5e2, -8px -8px 18px #ffffff',
              }}
            >
              <img
                className="h-14 w-14 sm:h-16 sm:w-16 object-contain drop-shadow-sm"
                src="/logo-qomaruddin.png"
                alt="Logo Qomaruddin"
              />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#2D3436]">
              {loginMode === 'admin' ? 'Masuk Portal' : 'Portal Wali'}
            </h1>
            <p className="mt-1 text-xs sm:text-sm font-semibold text-[#636E72]">
              {loginMode === 'admin'
                ? 'Sistem Terintegrasi Pondok & Madrasah'
                : 'Pantau Absensi & Nilai Santri Realtime'}
            </p>
          </div>

          {/* NEUMORPHIC ROLE SWITCHER TABS */}
          <div
            className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[#e2eaf2] mb-6"
            style={{
              boxShadow: 'inset 3px 3px 6px #cad5e2, inset -3px -3px 6px #ffffff',
            }}
          >
            <button
              type="button"
              onClick={() => handleModeChange('admin')}
              className={`py-2.5 text-xs font-black rounded-xl transition-all duration-300 ${
                loginMode === 'admin'
                  ? 'bg-[#eef3f8] text-[#138F81] border border-white/80'
                  : 'text-[#636E72] hover:text-[#2D3436]'
              }`}
              style={
                loginMode === 'admin'
                  ? {
                      boxShadow: '4px 4px 10px #cad5e2, -4px -4px 10px #ffffff',
                    }
                  : undefined
              }
            >
              🛡️ Admin / Guru
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('wali')}
              className={`py-2.5 text-xs font-black rounded-xl transition-all duration-300 ${
                loginMode === 'wali'
                  ? 'bg-[#138F81] text-white'
                  : 'text-[#636E72] hover:text-[#2D3436]'
              }`}
              style={
                loginMode === 'wali'
                  ? {
                      boxShadow: '4px 4px 12px rgba(19, 143, 129, 0.35)',
                    }
                  : undefined
              }
            >
              👨‍👩‍👧 Wali Santri
            </button>
          </div>

          {/* WALI HELPER CALLOUT */}
          {loginMode === 'wali' && (
            <div
              className="mb-5 p-3.5 bg-[#e8f7f3] border border-teal-200/80 rounded-2xl text-[11px] text-teal-900 font-semibold leading-relaxed flex items-start gap-2.5"
              style={{
                boxShadow: 'inset 2px 2px 4px rgba(19, 143, 129, 0.1)',
              }}
            >
              <Sparkles size={16} className="text-[#138F81] shrink-0 mt-0.5" />
              <span>
                <strong>Panduan Login Wali:</strong> Masukkan <strong>Nama Lengkap Santri</strong> atau <strong>NIS</strong> (Sandi default: <strong>siswa12345</strong>).
              </span>
            </div>
          )}

          {/* FORM */}
          <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
            {/* USERNAME / IDENTIFIER FIELD */}
            <div>
              <label className="block mb-1.5 text-xs font-bold text-[#636E72] px-1">
                {loginMode === 'admin' ? 'Username / Email' : 'Nama Lengkap / NIS Santri'}
              </label>
              <div
                className="relative rounded-2xl bg-[#eef3f8] transition-all focus-within:ring-2 focus-within:ring-[#138F81]/30 focus-within:border-[#138F81]/40 border border-transparent"
                style={{
                  boxShadow: 'inset 4px 4px 8px #cad5e2, inset -4px -4px 8px #ffffff',
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
                  placeholder={
                    loginMode === 'admin'
                      ? 'Username atau email akun'
                      : 'Contoh: AHMAD FAISAL / 2425001'
                  }
                  required
                />
              </div>
            </div>

            {/* PASSWORD FIELD */}
            <div>
              <div className="flex items-center justify-between mb-1.5 px-1">
                <label className="block text-xs font-bold text-[#636E72]">Password</label>
                {loginMode === 'wali' && password !== 'siswa12345' && (
                  <button
                    type="button"
                    onClick={() => setPassword('siswa12345')}
                    className="text-[10px] font-extrabold text-[#138F81] hover:underline"
                  >
                    Gunakan Sandi Default
                  </button>
                )}
              </div>
              <div
                className="relative rounded-2xl bg-[#eef3f8] transition-all focus-within:ring-2 focus-within:ring-[#138F81]/30 focus-within:border-[#138F81]/40 border border-transparent"
                style={{
                  boxShadow: 'inset 4px 4px 8px #cad5e2, inset -4px -4px 8px #ffffff',
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
                  placeholder={loginMode === 'wali' ? 'Default: siswa12345' : 'Masukkan password'}
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
            <div className="flex items-center justify-between text-xs font-bold text-[#636E72] px-1 pt-1">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded-md border-gray-300 text-[#138F81] focus:ring-[#138F81] h-4 w-4 cursor-pointer"
                />
                <span>Ingat saya</span>
              </label>

              <span className="text-[11px] font-semibold text-slate-400">
                Qomaruddin v2.0
              </span>
            </div>

            {/* ERROR MESSAGE */}
            {error && (
              <div
                className="rounded-2xl bg-rose-50 border border-rose-200/80 px-4 py-3 text-xs font-bold text-[#D63031]"
                style={{
                  boxShadow: 'inset 2px 2px 4px rgba(214, 48, 49, 0.1)',
                }}
              >
                {error}
              </div>
            )}

            {/* NEUMORPHIC 3D SUBMIT BUTTON */}
            <button
              className="mt-3 w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#138F81] to-[#0e7467] text-xs sm:text-sm font-black tracking-wider uppercase text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98] cursor-pointer disabled:opacity-60"
              style={{
                boxShadow: '6px 6px 16px #cad5e2, -6px -6px 16px #ffffff, inset 0 1px 1px rgba(255,255,255,0.4)',
              }}
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? 'Memproses...'
                : loginMode === 'admin'
                ? 'MASUK PORTAL'
                : 'MASUK PORTAL WALI'}
            </button>
          </form>

          {/* FOOTER TEXT */}
          <div className="mt-8 text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#138F81]/80">
              Yayasan Pondok Pesantren Qomaruddin
            </p>
            <p className="text-[10px] font-medium text-[#636E72] mt-0.5">
              Sampurnan Bungah Gresik • Jawa Timur
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

