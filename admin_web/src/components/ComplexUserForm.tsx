import { CheckCircle2, KeyRound, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type ApiRecord } from '../services/api';

interface ComplexUserFormProps {
  initialData?: ApiRecord | null;
  readOnly?: boolean;
  forcedRole?: string;
  onClose: () => void;
  onSave: () => void;
}

export function ComplexUserForm({ initialData, readOnly = false, forcedRole, onClose, onSave }: ComplexUserFormProps) {
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'profil' | 'akses'>('profil');

  useEffect(() => {
    if (initialData) {
      const parsed: Record<string, string | number> = {};
      Object.entries(initialData).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          parsed[key] = String(value);
        }
      });
      // Set defaults for missing fields
      if (!parsed.role) parsed.role = forcedRole || 'admin';
      if (!parsed.status) parsed.status = 'Aktif';
      setForm(parsed);
    } else {
      setForm({ 
        role: forcedRole || 'admin',
        status: 'Aktif'
      });
    }
  }, [initialData, forcedRole]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    
    setIsSaving(true);
    setError('');
    
    try {
      const payload: ApiRecord = {
        name: String(form.name || '').trim(),
        email: String(form.email || '').trim(),
        no_hp: String(form.no_hp || '').trim() || null,
        role: String(form.role || 'admin'),
        admin_type: form.role === 'admin' ? (String(form.admin_type || 'utama')) : null,
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
      
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSave();
      }, 2000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan data user.');
      setIsSaving(false);
    }
  };

  const isGuru = form.role === 'guru';
  const isAdmin = form.role === 'admin';

  return (
    <div className="w-full flex-1">
      <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
          
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <div>
              <h2 className="text-xl font-extrabold text-[#2D3436]">
                {readOnly ? 'Detail Data Pengguna' : (form.id ? 'Edit Data Pengguna' : 'Tambah Data Pengguna Baru')}
              </h2>
              <p className="text-sm font-semibold text-[#636E72] mt-1">Lengkapi informasi profil dan hak akses dengan detail.</p>
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
              <h2 className="text-2xl font-extrabold text-[#2D3436] animate-[pulse_2s_ease-in-out_infinite]">Berhasil!</h2>
              <p className="mt-2 text-base font-bold text-[#636E72]">{form.id ? 'Data pengguna diperbarui.' : 'Pengguna baru ditambahkan.'}</p>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col md:flex-row overflow-hidden relative">
            
            <div className="hidden w-64 shrink-0 flex-col gap-2 overflow-y-auto border-r border-slate-200 bg-slate-50 p-4 md:flex">
              <button type="button" onClick={() => setActiveTab('profil')} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-colors ${activeTab === 'profil' ? 'bg-[#138F81] text-white shadow-md' : 'text-[#636E72] hover:bg-white'}`}>
                <User size={18} /> I. Profil Akun
              </button>
              <button type="button" onClick={() => setActiveTab('akses')} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-colors ${activeTab === 'akses' ? 'bg-[#138F81] text-white shadow-md' : 'text-[#636E72] hover:bg-white'}`}>
                <KeyRound size={18} /> II. Akses & Hak
              </button>
            </div>

            <div className="border-b border-slate-200 bg-slate-50 p-3 md:hidden">
              <div className="flex gap-2 overflow-x-auto pb-1 q-scrollbar">
                <button type="button" onClick={() => setActiveTab('profil')} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold ${activeTab === 'profil' ? 'bg-[#138F81] text-white shadow-sm' : 'bg-white text-[#636E72] border border-slate-200'}`}>
                  I. Profil Akun
                </button>
                <button type="button" onClick={() => setActiveTab('akses')} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold ${activeTab === 'akses' ? 'bg-[#138F81] text-white shadow-sm' : 'bg-white text-[#636E72] border border-slate-200'}`}>
                  II. Akses & Hak
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-white q-scrollbar">
              {error && (
                <div className="mb-6 rounded-2xl bg-[#FDECEC] p-4 text-sm font-bold text-[#D63031] border border-[#FDECEC]">
                  {error}
                </div>
              )}

              <form id="complex-user-form" onSubmit={handleSubmit} className="space-y-8 max-w-3xl mx-auto">
                
                <div className={activeTab === 'profil' ? 'block' : 'hidden'}>
                  <div className="space-y-4 rounded-3xl bg-slate-50 p-5 border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-extrabold text-[#138F81] flex items-center gap-2 mb-4">
                      <User size={16} /> Informasi Pribadi
                    </h3>
                    
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">Nama Lengkap</span>
                      <input className="q-input" name="name" value={String(form.name || '')} onChange={handleChange} required disabled={readOnly} />
                    </label>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">Email Akun</span>
                        <input type="email" className="q-input" name="email" value={String(form.email || '')} onChange={handleChange} required disabled={readOnly} />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">Nomor WhatsApp / HP</span>
                        <input type="tel" className="q-input" name="no_hp" value={String(form.no_hp || '')} onChange={handleChange} disabled={readOnly} />
                      </label>
                    </div>

                    {!readOnly && (
                      <div className="pt-4 border-t border-slate-200 mt-4">
                        <label className="block">
                          <span className="mb-2 block text-sm font-bold text-[#636E72]">{form.id ? 'Ganti Password (Opsional)' : 'Password Baru'}</span>
                          <input type="password" className="q-input" name="password" value={String(form.password || '')} onChange={handleChange} required={!form.id} placeholder={form.id ? 'Kosongkan jika tidak ingin mengubah password' : 'Masukkan password untuk akun ini...'} />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                <div className={activeTab === 'akses' ? 'block' : 'hidden'}>
                  <div className="space-y-4 rounded-3xl bg-slate-50 p-5 border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-extrabold text-[#138F81] flex items-center gap-2 mb-4">
                      <KeyRound size={16} /> Peran & Hak Akses
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">Hak Akses (Role)</span>
                        <select className="q-input" name="role" value={String(form.role || '')} onChange={handleChange} disabled={readOnly || !!forcedRole}>
                          <option value="admin">Administrator</option>
                          <option value="guru">Guru / Ustadz</option>
                          <option value="wali">Wali Santri</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">Status Akun</span>
                        <select className="q-input" name="status" value={String(form.status || 'Aktif')} onChange={handleChange} disabled={readOnly}>
                          <option value="Aktif">Aktif (Bisa Login)</option>
                          <option value="Nonaktif">Nonaktif (Diblokir)</option>
                        </select>
                      </label>
                    </div>

                      {(form.role === 'admin' || form.role === 'guru') && (
                        <label className="block sm:col-span-2">
                          <span className="mb-2 block text-sm font-bold text-[#636E72]">{form.role === 'admin' ? 'Tipe Admin' : 'Hak Akses Spesifik Guru'}</span>
                          <select className="q-input" name="admin_type" value={String(form.admin_type || (form.role === 'admin' ? 'utama' : 'umum'))} onChange={handleChange} disabled={readOnly}>
                            {form.role === 'admin' ? (
                              <>
                                <option value="it">Admin IT (Super Admin & Full Stack)</option>
                                <option value="pengurus">Admin Pengurus (Akses Penuh)</option>
                                <option value="madrasah">Admin Madrasah (Pemantau Absensi Realtime)</option>
                                <option value="bendahara_2">Admin Bendahara 2 (Kasir Santri)</option>
                                <option value="keuangan">Admin Keuangan 1 (Bendahara Utama)</option>
                                <option value="utama">Admin Utama (Akses Penuh)</option>
                                <option value="akademik">Admin Akademik (Pelajaran & Nilai)</option>
                                <option value="pondok">Admin Pondok (Asrama & Santri)</option>
                                <option value="absensi">Admin Absensi (Rekap & Kehadiran)</option>
                                <option value="lainnya">Lainnya / Terbatas</option>
                              </>
                            ) : (
                              <>
                                <option value="umum">Guru Umum (Sesuai Hak Akses Default)</option>
                                <option value="madin">Guru Madin (Absensi Madin)</option>
                                <option value="ngaji">Guru Ngaji Kitab (Absensi Ngaji)</option>
                                <option value="sholat">Guru Pembina Sholat (Absensi Jama'ah)</option>
                                <option value="asrama">Pembina Asrama / Musyrif</option>
                              </>
                            )}
                          </select>
                        </label>
                      )}

                    {isGuru && (
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">Kode Guru (Opsional)</span>
                        <input className="q-input" name="kode_guru" value={String(form.kode_guru || '')} onChange={handleChange} disabled={readOnly} placeholder="Misal: GR-001" />
                      </label>
                    )}
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
