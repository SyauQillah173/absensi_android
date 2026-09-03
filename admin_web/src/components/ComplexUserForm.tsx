import { CheckCircle2, KeyRound, ShieldCheck, Sparkles, User, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api, type ApiRecord } from '../services/api';
import { SYSTEM_ROLE_OPTIONS, getRoleDisplayName, type RoleOption } from '../utils/roleHelper';

interface ComplexUserFormProps {
  initialData?: ApiRecord | null;
  readOnly?: boolean;
  forcedRole?: string;
  onClose: () => void;
  onSave: () => void;
}

export function ComplexUserForm({ initialData, readOnly = false, forcedRole, onClose, onSave }: ComplexUserFormProps) {
  const { isItAdmin } = useAuth();
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'profil' | 'akses'>('profil');

  // Proteksi: Cek apakah user yang sedang diedit adalah Admin IT
  const isEditingItAdmin = Boolean(
    initialData &&
    initialData.role === 'admin' &&
    String(initialData.admin_type || '').toLowerCase() === 'it'
  );
  // Jika sedang mengedit akun Admin IT tapi yang login bukan Admin IT, kunci form
  const isLockedForNonIt = isEditingItAdmin && !isItAdmin;

  // Filter pilihan role: Role "admin_it" HANYA boleh dilihat dan dipilih oleh Admin IT
  const availableRoleOptions = useMemo(() => {
    return SYSTEM_ROLE_OPTIONS.filter((opt) => {
      if (opt.key === 'admin_it' && !isItAdmin) {
        return false;
      }
      return true;
    });
  }, [isItAdmin]);

  useEffect(() => {
    if (initialData) {
      const parsed: Record<string, string | number> = {};
      Object.entries(initialData).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          parsed[key] = String(value);
        }
      });
      if (!parsed.role) parsed.role = forcedRole || 'admin';
      if (!parsed.status) parsed.status = 'Aktif';
      setForm(parsed);
    } else {
      setForm({ 
        role: forcedRole || 'admin',
        admin_type: forcedRole === 'admin' ? 'pengurus' : '',
        status: 'Aktif',
        gender: 'L',
        password: 'admin123'
      });
    }
  }, [initialData, forcedRole]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Smart Role Picker handler
  const handleRoleSelection = (selectedKey: string) => {
    const option = SYSTEM_ROLE_OPTIONS.find(o => o.key === selectedKey);
    if (!option) return;

    setForm(prev => {
      const updated: Record<string, string | number> = {
        ...prev,
        role: option.role,
        admin_type: option.adminType || '',
      };

      // Set default password suggestion if creating new user
      if (!prev.id) {
        if (option.role === 'admin') updated.password = 'admin123';
        else if (option.role === 'guru') updated.password = 'guru123';
        else if (option.role === 'wali') updated.password = 'siswa123';
      }

      return updated;
    });

  };

  // Quick email generator
  const generateEmailFromName = () => {
    const name = String(form.name || '').trim().toLowerCase();
    if (!name) return;
    const cleanName = name
      .replace(/^(mas|bapak|pak|ibu|ustadz|ustadzah|h\.|hj\.)\s+/i, '')
      .replace(/[^a-z0-9]/g, '');
    if (cleanName) {
      setForm(prev => ({ ...prev, email: `${cleanName}@absensi.com` }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || isLockedForNonIt) return;
    
    // 🛡️ Batasan Admin Pengurus: Tidak boleh membuat user Admin IT
    if (form.admin_type === 'it' && !isItAdmin) {
      setError('Akses ditolak: Hanya Admin IT yang berwenang membuat atau menetapkan role Admin IT.');
      return;
    }

    setIsSaving(true);
    setError('');
    
    try {
      const payload: ApiRecord = {
        name: String(form.name || '').trim(),
        email: String(form.email || '').trim(),
        gender: String(form.gender || 'L').trim(),
        no_hp: String(form.no_hp || '').trim() || null,
        role: String(form.role || 'admin'),
        admin_type: form.role === 'admin' ? String(form.admin_type || 'pengurus') : null,
        status: String(form.status || 'Aktif'),
        kode_guru: form.role === 'guru' ? (String(form.kode_guru || '').trim() || null) : null
      };
      
      if (form.password && String(form.password).trim()) {
        payload.password = String(form.password).trim();
      }
      
      if (form.id) {
        await api.updateUser(Number(form.id), payload);
      } else {
        await api.createUser(payload);
      }
      
      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'user' } }));
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSave();
      }, 600);

      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan data pengguna.');
      setIsSaving(false);
    }
  };

  // Find currently active role option
  const currentRoleKey = (() => {
    if (form.role === 'guru') return 'guru';
    if (form.role === 'wali') return 'wali';
    if (form.role === 'admin') {
      const match = SYSTEM_ROLE_OPTIONS.find(o => o.role === 'admin' && o.adminType === String(form.admin_type || ''));
      return match ? match.key : 'admin_pengurus';
    }
    return 'admin_pengurus';
  })();

  const activeRoleOption = SYSTEM_ROLE_OPTIONS.find(o => o.key === currentRoleKey) || SYSTEM_ROLE_OPTIONS[1];
  const isGuru = form.role === 'guru';

  return (
    <div className="w-full flex-1">
      <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
          
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-[#2D3436]">
                  {readOnly ? 'Detail Data Pengguna' : (form.id ? 'Edit Data Pengguna' : 'Tambah Data Pengguna Baru')}
                </h2>
                <span className="rounded-xl bg-[#E8F7F3] px-2.5 py-0.5 text-xs font-black text-[#138F81] border border-teal-200">
                  {getRoleDisplayName(String(form.role || ''), String(form.admin_type || ''))}
                </span>
              </div>
              <p className="text-sm font-semibold text-[#636E72] mt-1">
                Sistem cerdas otomatis menyiapkan hak akses dan antarmuka sesuai jabatan role yang dipilih.
              </p>
            </div>
            <button className="grid h-10 w-10 place-items-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors" onClick={onClose} type="button" disabled={isSuccess}>
              <X size={20} />
            </button>
          </div>

          {isSuccess && (
            <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center rounded-3xl bg-white/90 backdrop-blur-sm transition-all duration-300">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100 text-green-500 shadow-xl shadow-green-500/20 mb-6 animate-[bounce_1s_ease-in-out_infinite]">
                <CheckCircle2 size={56} strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-extrabold text-[#2D3436] animate-[pulse_2s_ease-in-out_infinite]">Berhasil Disimpan!</h2>
              <p className="mt-2 text-base font-bold text-[#636E72]">
                {form.id ? 'Data pengguna berhasil diperbarui.' : `Pengguna baru dengan role ${activeRoleOption.label} telah aktif.`}
              </p>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col md:flex-row overflow-hidden relative">
            
            <div className="hidden w-64 shrink-0 flex-col gap-2 overflow-y-auto border-r border-slate-200 bg-slate-50 p-4 md:flex">
              <button type="button" onClick={() => setActiveTab('profil')} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-colors ${activeTab === 'profil' ? 'bg-[#138F81] text-white shadow-md' : 'text-[#636E72] hover:bg-white'}`}>
                <User size={18} /> I. Profil Akun
              </button>
              <button type="button" onClick={() => setActiveTab('akses')} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-colors ${activeTab === 'akses' ? 'bg-[#138F81] text-white shadow-md' : 'text-[#636E72] hover:bg-white'}`}>
                <KeyRound size={18} /> II. Jabatan & Hak Akses
              </button>
            </div>

            <div className="border-b border-slate-200 bg-slate-50 p-3 md:hidden">
              <div className="flex gap-2 overflow-x-auto pb-1 q-scrollbar">
                <button type="button" onClick={() => setActiveTab('profil')} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold ${activeTab === 'profil' ? 'bg-[#138F81] text-white shadow-sm' : 'bg-white text-[#636E72] border border-slate-200'}`}>
                  I. Profil Akun
                </button>
                <button type="button" onClick={() => setActiveTab('akses')} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold ${activeTab === 'akses' ? 'bg-[#138F81] text-white shadow-sm' : 'bg-white text-[#636E72] border border-slate-200'}`}>
                  II. Jabatan & Hak Akses
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-white q-scrollbar">
              {isLockedForNonIt && (
                <div className="mb-4 rounded-2xl bg-amber-50 p-4 text-xs font-bold text-amber-800 border border-amber-200 flex items-center gap-2.5 shadow-xs">
                  <ShieldCheck size={20} className="text-amber-600 shrink-0" />
                  <span>Akun Admin IT ini dilindungi sistem dan hanya dapat diubah oleh Admin IT (Super Admin). Anda hanya dapat melihat informasi akun.</span>
                </div>
              )}

              {error && (
                <div className="mb-6 rounded-2xl bg-[#FDECEC] p-4 text-sm font-bold text-[#D63031] border border-[#FDECEC]">
                  {error}
                </div>
              )}

              <form id="complex-user-form" onSubmit={handleSubmit} className="space-y-8 max-w-3xl mx-auto">
                
                {/* TAB 1: PROFIL PENGGUNA */}
                <div className={activeTab === 'profil' ? 'block' : 'hidden'}>
                  <div className="space-y-5 rounded-3xl bg-slate-50 p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-extrabold text-[#138F81] flex items-center gap-2">
                        <User size={16} /> Biodata & Identitas Akun
                      </h3>
                      <span className="text-xs font-bold text-[#636E72]">Langkah 1 dari 2</span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">Nama Lengkap Pengguna</span>
                        <input className="q-input" name="name" value={String(form.name || '')} onChange={handleChange} required disabled={readOnly} placeholder="Misal: Abdullah Syauqillah / Mas Fahmi" />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">Jenis Kelamin</span>
                        <select className="q-input" name="gender" value={String(form.gender || 'L')} onChange={handleChange} disabled={readOnly}>
                          <option value="L">Laki-laki (Ikhwan / Ustadz)</option>
                          <option value="P">Perempuan (Akhwat / Ustadzah)</option>
                        </select>
                      </label>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <div className="flex items-center justify-between mb-2">
                          <span className="block text-sm font-bold text-[#636E72]">Email Login (Username)</span>
                          {!readOnly && form.name && (
                            <button
                              type="button"
                              onClick={generateEmailFromName}
                              className="text-[11px] font-extrabold text-[#138F81] hover:underline flex items-center gap-1"
                            >
                              <Sparkles size={12} /> Buat Otomatis
                            </button>
                          )}
                        </div>
                        <input type="text" className="q-input" name="email" value={String(form.email || '')} onChange={handleChange} required disabled={readOnly} placeholder="contoh: fahmi@absensi.com" />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">Nomor WhatsApp / HP</span>
                        <input type="tel" className="q-input" name="no_hp" value={String(form.no_hp || '')} onChange={handleChange} disabled={readOnly} placeholder="08xxxxxxxxxx" />
                      </label>
                    </div>

                    {!readOnly && (
                      <div className="pt-4 border-t border-slate-200 mt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-[#636E72]">{form.id ? 'Ganti Password (Opsional)' : 'Password Akun'}</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setForm(prev => ({ ...prev, password: 'admin123' }))}
                              className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-teal-50 text-[#138F81] hover:bg-teal-100"
                            >
                              admin123
                            </button>
                            <button
                              type="button"
                              onClick={() => setForm(prev => ({ ...prev, password: 'guru123' }))}
                              className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-teal-50 text-[#138F81] hover:bg-teal-100"
                            >
                              guru123
                            </button>
                          </div>
                        </div>
                        <input type="text" className="q-input" name="password" value={String(form.password || '')} onChange={handleChange} required={!form.id} placeholder={form.id ? 'Kosongkan jika tidak ingin mengubah password' : 'Masukkan password login...'} />
                      </div>
                    )}
                  </div>
                </div>

                {/* TAB 2: JABATAN & HAK AKSES */}
                <div className={activeTab === 'akses' ? 'block' : 'hidden'}>
                  <div className="space-y-6 rounded-3xl bg-slate-50 p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-extrabold text-[#138F81] flex items-center gap-2">
                        <KeyRound size={16} /> Pemilihan Role & Jabatan Cerdas
                      </h3>
                      <span className="text-xs font-bold text-[#636E72]">Langkah 2 dari 2</span>
                    </div>

                    <div>
                      <span className="mb-2 block text-sm font-bold text-[#2D3436]">Pilih Jabatan Resmi Pengguna:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {availableRoleOptions.map((opt) => {
                          const isSelected = currentRoleKey === opt.key;
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => handleRoleSelection(opt.key)}
                              disabled={readOnly || isLockedForNonIt || Boolean(forcedRole && forcedRole !== opt.role)}
                              className={`text-left p-3.5 rounded-2xl border transition-all ${
                                isSelected
                                  ? 'border-[#138F81] bg-teal-50/70 shadow-sm ring-2 ring-[#138F81]/20'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              } ${(forcedRole && forcedRole !== opt.role) ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-base">{opt.icon}</span>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                  isSelected ? 'bg-[#138F81] text-white' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {opt.badge}
                                </span>
                              </div>
                              <p className="text-xs font-black text-[#2D3436] mt-2">{opt.label}</p>
                              <p className="text-[11px] font-semibold text-[#636E72] mt-1 line-clamp-2">{opt.description}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* LIVE PREVIEW BANNER */}
                    <div className="rounded-2xl bg-white p-4 border border-teal-200 shadow-sm space-y-3">
                      <div className="flex items-center gap-2 text-xs font-black text-[#138F81]">
                        <Sparkles size={16} />
                        <span>INFORMASI TAMPILAN SISTEM OTOMATIS:</span>
                      </div>
                      <div className="text-xs space-y-1.5 text-[#2D3436]">
                        <p><strong className="text-[#636E72]">Peran Database:</strong> <code className="bg-slate-100 px-1.5 py-0.5 rounded font-bold">{form.role}</code> {form.admin_type ? <>| Tipe Admin: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-bold">{form.admin_type}</code></> : null}</p>
                        <p><strong className="text-[#636E72]">Tampilan Saat Login:</strong> <span className="font-bold text-[#138F81]">{activeRoleOption.loginView}</span></p>
                        <p><strong className="text-[#636E72]">Status Akun:</strong> <span className="font-bold text-emerald-600">Aktif & Siap Digunakan</span></p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">Status Login</span>
                        <select className="q-input" name="status" value={String(form.status || 'Aktif')} onChange={handleChange} disabled={readOnly}>
                          <option value="Aktif">Aktif (Dapat Login)</option>
                          <option value="Nonaktif">Nonaktif (Diblokir)</option>
                        </select>
                      </label>

                      {isGuru && (
                        <label className="block">
                          <span className="mb-2 block text-sm font-bold text-[#636E72]">Kode Guru (Opsional)</span>
                          <input className="q-input" name="kode_guru" value={String(form.kode_guru || '')} onChange={handleChange} disabled={readOnly} placeholder="Misal: GR-001" />
                        </label>
                      )}
                    </div>

                  </div>
                </div>

              </form>
            </div>
          </div>
          
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
            <button type="button" onClick={onClose} disabled={isSaving || isSuccess} className="rounded-2xl bg-white px-6 py-3 text-sm font-bold text-[#636E72] shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50">
              {readOnly ? 'Tutup' : 'Batal'}
            </button>
            {!readOnly && (
              <button type="submit" form="complex-user-form" disabled={isSaving || isSuccess} className="inline-flex items-center gap-2 rounded-2xl bg-[#138F81] px-8 py-3 text-sm font-extrabold text-white shadow-lg shadow-[#138F81]/20 hover:bg-[#0E6A5F] transition-colors disabled:opacity-70">
                <CheckCircle2 size={18} className={isSaving ? 'animate-spin' : ''} />
                {isSaving ? 'Menyimpan...' : 'Simpan Data Pengguna'}
              </button>
            )}
          </div>

        </div>
      </div>
  );
}
