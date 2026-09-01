import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Plus, Save, Search, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type ApiRecord } from '../services/api';

interface ComplexKelompokFormProps {
  initialData?: ApiRecord | null;
  onClose: () => void;
  onSave: () => void;
}

function text(value: unknown, fallback = ''): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function ComplexKelompokForm({ initialData, onClose, onSave }: ComplexKelompokFormProps) {
  const [form, setForm] = useState<{
    id?: number;
    nama: string;
    kategori: string;
    sifir: string;
    class_id?: number;
  }>({
    id: initialData?.id ? num(initialData.id) : undefined,
    nama: text(initialData?.nama),
    kategori: text(initialData?.kategori, 'Sifir'),
    sifir: text(initialData?.sifir ?? initialData?.nama),
    class_id: initialData?.class_id ? num(initialData.class_id) : undefined,
  });

  const [activeTab, setActiveTab] = useState<'info' | 'santri'>('info');
  const [allStudents, setAllStudents] = useState<ApiRecord[]>([]);
  const [memberStudents, setMemberStudents] = useState<ApiRecord[]>([]);
  const [classes, setClasses] = useState<ApiRecord[]>([]);

  const [searchMember, setSearchMember] = useState('');
  const [searchAvailable, setSearchAvailable] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Load classes & all students & current members
  useEffect(() => {
    async function loadData() {
      try {
        const [studentRes, classRes] = await Promise.all([
          api.siswa({ status: 'Aktif' }),
          api.classes(),
        ]);
        const studentList = Array.isArray(studentRes.data) ? studentRes.data : [];
        setAllStudents(studentList);
        setClasses(Array.isArray(classRes.data) ? classRes.data : []);

        if (initialData?.id) {
          const detailRes = await api.kelompokBelajarDetail(num(initialData.id));
          const detailData = detailRes.data as ApiRecord;
          if (detailData && Array.isArray(detailData.siswa)) {
            setMemberStudents(detailData.siswa as ApiRecord[]);
          }
        }
      } catch {
        // handle fallback
      }
    }
    void loadData();
  }, [initialData]);

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  useEffect(() => {
    scrollToTop();
  }, [activeTab]);

  const memberIds = useMemo(() => {
    return new Set(memberStudents.map((s) => num(s.id)));
  }, [memberStudents]);

  const filteredMembers = useMemo(() => {
    const kw = searchMember.toLowerCase().trim();
    if (!kw) return memberStudents;
    return memberStudents.filter((s) =>
      `${s.nama ?? ''} ${s.nis ?? ''} ${s.nisn ?? ''} ${s.kamar ?? ''}`.toLowerCase().includes(kw)
    );
  }, [memberStudents, searchMember]);

  const availableStudents = useMemo(() => {
    const kw = searchAvailable.toLowerCase().trim();
    return allStudents
      .filter((s) => !memberIds.has(num(s.id)))
      .filter((s) => {
        if (!kw) return true;
        return `${s.nama ?? ''} ${s.nis ?? ''} ${s.nisn ?? ''} ${s.kelas ?? ''}`.toLowerCase().includes(kw);
      })
      .slice(0, 30);
  }, [allStudents, memberIds, searchAvailable]);

  const handleAddStudent = (student: ApiRecord) => {
    setMemberStudents((prev) => [...prev, student]);
  };

  const handleRemoveStudent = (studentId: number) => {
    setMemberStudents((prev) => prev.filter((s) => num(s.id) !== studentId));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;

    if (!form.nama.trim()) {
      setError('Nama kelompok belajar wajib diisi.');
      setActiveTab('info');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const payload: ApiRecord = {
        nama: form.nama.trim(),
        kategori: form.kategori.trim() || 'Sifir',
        sifir: form.sifir.trim() || form.nama.trim(),
        class_id: form.class_id || null,
        siswa_ids: Array.from(memberIds),
      };

      if (form.id) {
        await api.updateKelompokBelajar(form.id, payload);
      } else {
        await api.createKelompokBelajar(payload);
      }

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSave();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan kelompok belajar.');
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full flex-1">
      {/* Top-Right Floating Toast Notification */}
      {isSuccess && (
        <div className="fixed top-5 right-5 z-[99999] flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-2xl border border-emerald-200 shadow-emerald-900/15 transition-all animate-in fade-in slide-in-from-top-4 duration-300 max-w-sm">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
            <CheckCircle2 size={24} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-800">Berhasil Disimpan!</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {form.id
                ? 'Kelompok belajar & anggota santri berhasil diperbarui.'
                : 'Kelompok belajar baru berhasil dibuat.'}
            </p>
          </div>
        </div>
      )}

      <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#2D3436]">
              {form.id ? 'Edit Kelompok Belajar & Anggota' : 'Tambah Kelompok Belajar Baru'}
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-[#636E72] mt-0.5">
              Atur nama kelompok, level/sifir, dan kelola santri yang tergabung di kelompok ini.
            </p>
          </div>
          <button
            className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors shrink-0"
            onClick={onClose}
            type="button"
            disabled={isSuccess}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`flex items-center gap-2.5 border-b-2 py-3.5 text-xs sm:text-sm font-black transition-colors ${
              activeTab === 'info'
                ? 'border-[#138F81] text-[#138F81]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen size={16} />
            <span>I. Informasi Kelompok</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('santri')}
            className={`flex items-center gap-2.5 border-b-2 py-3.5 px-4 text-xs sm:text-sm font-black transition-colors ${
              activeTab === 'santri'
                ? 'border-[#138F81] text-[#138F81]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users size={16} />
            <span>II. Anggota Santri</span>
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">
              {memberStudents.length} Santri
            </span>
          </button>
        </div>

        {/* Form Body with Scroll */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {error && (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs sm:text-sm font-bold text-rose-700">
              ⚠️ {error}
            </div>
          )}

          {/* TAB 1: INFORMASI KELOMPOK */}
          {activeTab === 'info' && (
            <div className="max-w-3xl space-y-6 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 sm:p-6 space-y-5">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-800 flex items-center gap-2">
                  <BookOpen className="text-[#138F81]" size={18} /> Detail Kelompok Belajar
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                      Nama Kelompok <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 placeholder-slate-400 focus:border-[#138F81] focus:ring-2 focus:ring-[#138F81]/20 outline-none"
                      placeholder="Contoh: Sifir Awal A PA, Madin Wustho 1..."
                      value={form.nama}
                      onChange={(e) => setForm({ ...form, nama: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                      Kategori Kelompok
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 placeholder-slate-400 focus:border-[#138F81] focus:ring-2 focus:ring-[#138F81]/20 outline-none"
                      placeholder="Contoh: Sifir Awal PA, Madin Ula..."
                      value={form.kategori}
                      onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                      Sifir / Level
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 placeholder-slate-400 focus:border-[#138F81] focus:ring-2 focus:ring-[#138F81]/20 outline-none"
                      placeholder="Contoh: awal, wustho, ula..."
                      value={form.sifir}
                      onChange={(e) => setForm({ ...form, sifir: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                      Hubungkan ke Master Kelas Resmi (Opsional)
                    </label>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:border-[#138F81] outline-none"
                      value={form.class_id ?? ''}
                      onChange={(e) =>
                        setForm({ ...form, class_id: e.target.value ? Number(e.target.value) : undefined })
                      }
                    >
                      <option value="">-- Otomatis Sinkronisasi / Tidak Terikat --</option>
                      {classes.map((c) => (
                        <option key={c.id as number} value={c.id as number}>
                          {text(c.name ?? c.nama)} ({text(c.category, 'Madin')})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ANGGOTA SANTRI */}
          {activeTab === 'santri' && (
            <div className="max-w-5xl space-y-6 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Panel Kiri: Santri Terdaftar dalam Kelompok */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                        <Users className="text-[#138F81]" size={17} /> Anggota Terdaftar ({memberStudents.length})
                      </h4>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">
                        Santri yang saat ini masuk di kelompok ini.
                      </p>
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-8 pr-3 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-[#138F81] outline-none"
                      placeholder="Cari anggota terdaftar..."
                      value={searchMember}
                      onChange={(e) => setSearchMember(e.target.value)}
                    />
                  </div>

                  <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
                    {memberStudents.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        <Users className="mx-auto text-slate-300 mb-2" size={28} />
                        <p className="text-xs font-bold text-slate-600">Belum ada santri di kelompok ini.</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Tambahkan santri dari panel sebelah kanan.
                        </p>
                      </div>
                    ) : filteredMembers.length === 0 ? (
                      <p className="py-6 text-center text-xs font-bold text-slate-400">
                        Tidak ada santri yang cocok.
                      </p>
                    ) : (
                      filteredMembers.map((s, idx) => (
                        <div
                          key={String(s.id ?? idx)}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/80 hover:bg-slate-100/70 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-extrabold text-slate-800 truncate">{text(s.nama)}</p>
                            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                              NIS: {text(s.nis)} • {s.jenis_kelamin === 'L' ? 'L (Putra)' : 'P (Putri)'} {s.kamar ? `• ${s.kamar}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveStudent(num(s.id))}
                            className="grid h-7 w-7 place-items-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-colors ml-2 shrink-0"
                            title="Keluarkan santri dari kelompok ini"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Panel Kanan: Tambah Santri dari Database */}
                <div className="rounded-2xl border border-teal-200/80 bg-teal-50/40 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-teal-100 pb-3">
                    <div>
                      <h4 className="text-sm font-extrabold text-[#138F81] flex items-center gap-2">
                        <UserPlus size={17} /> + Tambah Santri ke Kelompok
                      </h4>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">
                        Pilih santri aktif untuk dimasukkan ke kelompok ini.
                      </p>
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-[#138F81] outline-none"
                      placeholder="Cari nama santri / NIS / kelas santri..."
                      value={searchAvailable}
                      onChange={(e) => setSearchAvailable(e.target.value)}
                    />
                  </div>

                  <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
                    {availableStudents.length === 0 ? (
                      <p className="p-8 text-center text-xs font-bold text-slate-400">
                        Tidak ada santri yang cocok atau semua santri sudah masuk.
                      </p>
                    ) : (
                      availableStudents.map((s, idx) => (
                        <div
                          key={String(s.id ?? idx)}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-[#138F81] transition-all"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-extrabold text-slate-800 truncate">{text(s.nama)}</p>
                            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                              NIS: {text(s.nis)} • {s.jenis_kelamin === 'L' ? 'Putra' : 'Putri'} • Kelas: {text(s.kelas, 'Belum ada')}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddStudent(s)}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#138F81] px-2.5 py-1 text-[11px] font-black text-white hover:bg-[#0f766a] transition-colors ml-2 shrink-0"
                          >
                            <Plus size={12} /> Tambah
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div>
            {activeTab === 'santri' && (
              <button
                type="button"
                onClick={() => setActiveTab('info')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft size={16} /> Kembali ke Informasi Kelompok
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving || isSuccess}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>

            {activeTab === 'info' ? (
              <button
                type="button"
                onClick={() => {
                  if (!form.nama.trim()) {
                    setError('Nama kelompok belajar wajib diisi.');
                    return;
                  }
                  setError('');
                  setActiveTab('santri');
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#138F81] px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-[#138F81]/25 hover:bg-[#0f766a] transition-all"
              >
                <span>Lanjut ke II. Anggota Santri</span>
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isSaving || isSuccess}
                className="inline-flex items-center gap-2 rounded-xl bg-[#138F81] px-6 py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-[#138F81]/25 hover:bg-[#0f766a] transition-all disabled:opacity-50"
              >
                <Save size={16} />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Kelompok Belajar'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
