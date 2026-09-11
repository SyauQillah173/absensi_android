import React, { useState } from 'react';
import { ShieldCheck, Lock, Eye, EyeOff, X, KeyRound, CheckCircle2, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { ToastNotification } from './ToastNotification';

interface FirstLoginPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  user: {
    id: number;
    name: string;
    role: string;
    email?: string | null;
    kode_guru?: string | null;
    nis?: string | null;
  };
}

export function FirstLoginPasswordModal({
  isOpen,
  onClose,
  onSuccess,
  user
}: FirstLoginPasswordModalProps) {
  const [step, setStep] = useState<'prompt' | 'form'>('prompt');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  const defaultPasswordHint = user.role === 'guru' ? 'guru123' : 'wali123';

  const handleDismiss = () => {
    if (user?.id) {
      sessionStorage.setItem(`dismissed_first_pwd_prompt_${user.id}`, 'true');
    }
    onClose();
  };

  const handleStartChange = () => {
    setCurrentPassword(defaultPasswordHint);
    setStep('form');
    setError('');
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Kata sandi baru minimal 6 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('Kata sandi baru harus berbeda dari kata sandi default.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Gunakan changePasswordSecure jika tersedia, atau changePassword
      const identifier = user.email || user.kode_guru || user.nis || user.name;
      try {
        await api.changePasswordSecure({
          current_password: currentPassword,
          password: newPassword,
          password_confirmation: confirmPassword,
          logout_others: false,
        });
      } catch {
        // Fallback ke changePassword
        await api.changePassword({
          identifier,
          current_password: currentPassword,
          new_password: newPassword,
          new_password_confirmation: confirmPassword,
        });
      }

      if (user?.id) {
        sessionStorage.setItem(`dismissed_first_pwd_prompt_${user.id}`, 'true');
      }

      setToast({
        show: true,
        message: 'Kata sandi baru berhasil disimpan! Mohon diingat untuk login berikutnya.',
        type: 'success',
      });

      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Gagal mengubah kata sandi. Pastikan kata sandi lama/default sesuai.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ToastNotification
        show={Boolean(toast?.show)}
        type={toast?.type || 'success'}
        message={toast?.message || ''}
        onClose={() => setToast(null)}
      />

      <div className="fixed inset-0 z-[99990] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transition-all">
          {/* Top Decorative Header */}
          <div className="bg-gradient-to-br from-[#138F81] to-[#0A564D] p-6 text-white relative">
            <button
              onClick={handleDismiss}
              type="button"
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Lewati (Nanti Saja)"
              aria-label="Tutup"
            >
              <X size={18} />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center mb-3 shadow-inner">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>

            <span className="inline-block px-2.5 py-0.5 rounded-full bg-teal-400/25 border border-teal-300/30 text-[11px] font-black uppercase tracking-wider text-teal-100 mb-1.5">
              Rekomendasi Keamanan Akun
            </span>

            <h3 className="text-xl font-extrabold text-white">
              {step === 'prompt' ? 'Saran Ganti Kata Sandi Baru' : 'Buat Kata Sandi Baru'}
            </h3>
            <p className="text-xs text-teal-100/90 mt-1 leading-relaxed">
              {step === 'prompt'
                ? `Assalamu'alaikum, ${user.name}! Akun Anda saat ini masih menggunakan kata sandi default sistem.`
                : 'Silakan masukkan kata sandi baru yang mudah Anda ingat namun sulit ditebak orang lain.'}
            </p>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            {step === 'prompt' ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs leading-relaxed space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-amber-950">
                    <KeyRound size={15} className="text-amber-700 shrink-0" />
                    <span>Kata Sandi Default Saat Ini:</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1 font-mono font-black text-sm text-slate-800 bg-white/80 px-3 py-1.5 rounded-xl border border-amber-200">
                    <span>{defaultPasswordHint}</span>
                    <span className="text-[10px] font-sans font-normal text-slate-500 ml-auto">(Bawaan Sistem)</span>
                  </div>
                  <p className="text-[11px] text-amber-800 pt-1">
                    Demi menjaga kerahasiaan data santri dan akun Anda, kami sarankan Anda mengganti kata sandi. Pilihan ini bersifat <strong>opsional</strong>, Anda dapat menggantinya sekarang atau melewatinya.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={handleStartChange}
                    className="w-full py-3 px-4 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] text-white text-sm font-extrabold shadow-lg shadow-[#138F81]/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                  >
                    <Lock size={16} />
                    <span>Ganti Kata Sandi Sekarang</span>
                    <ArrowRight size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="w-full py-2.5 px-4 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    Nanti Saja (Lewati & Masuk ke Aplikasi)
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitForm} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700">
                    {error}
                  </div>
                )}

                {/* Password Lama / Default */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Kata Sandi Default / Lama:</label>
                  <input
                    type="text"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold focus:border-[#138F81] focus:ring-1 focus:ring-[#138F81] outline-hidden bg-slate-50"
                  />
                  <span className="text-[10px] text-slate-400">Default: {defaultPasswordHint}</span>
                </div>

                {/* Password Baru */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Kata Sandi Baru:</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="Minimal 6 karakter"
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 text-sm font-semibold focus:border-[#138F81] focus:ring-1 focus:ring-[#138F81] outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Konfirmasi Password Baru */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Konfirmasi Kata Sandi Baru:</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Ketik ulang kata sandi baru"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold focus:border-[#138F81] focus:ring-1 focus:ring-[#138F81] outline-hidden"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setStep('prompt')}
                    disabled={isSubmitting}
                    className="w-1/3 py-2.5 px-3 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
                  >
                    Kembali
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-2/3 py-2.5 px-4 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white text-xs font-extrabold shadow-md flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Sandi Baru'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
