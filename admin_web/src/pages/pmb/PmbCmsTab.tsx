import {
  AlertTriangle,
  Award,
  BookOpen,
  Building,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  Globe,
  GraduationCap,
  HeartHandshake,
  HelpCircle,
  History,
  Info,
  Layers,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Power,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api, type ApiRecord } from '../../services/api';

interface ProgramItem {
  title: string;
  desc: string;
  icon: string;
}

export function PmbCmsTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states
  const [pmbIsOpen, setPmbIsOpen] = useState(true);
  const [pmbClosedMessage, setPmbClosedMessage] = useState('');
  const [namaPesantren, setNamaPesantren] = useState('Pondok Pesantren Qomaruddin');
  const [pendiri, setPendiri] = useState('Kiai Qomaruddin (Mbah Kiai Qomaruddin)');
  const [tahunBerdiri, setTahunBerdiri] = useState('1775 M (Lebih dari 250 Tahun Berkhidmah)');
  const [tagline, setTagline] = useState('Mencetak Generasi Berakhlakul Karimah, Unggul Ilmu Agama & Berdaya Saing Global');
  const [alamat, setAlamat] = useState('Jl. Sampurnan No. 01, Bungah, Kabupaten Gresik, Jawa Timur 61152');
  const [telepon, setTelepon] = useState('0812-3456-7890');
  const [email, setEmail] = useState('pmb@ppqomaruddin.itqom.net');
  const [website, setWebsite] = useState('https://ppqomaruddin.itqom.net');
  const [sejarah, setSejarah] = useState('');
  const [visi, setVisi] = useState('');
  const [misi, setMisi] = useState('');
  const [agendaKedatanganInfo, setAgendaKedatanganInfo] = useState('');

  // Dynamic Lists
  const [programs, setPrograms] = useState<ProgramItem[]>([
    {
      title: 'Madrasah Diniyah Salafiyah',
      desc: 'Kajian mendalam kitab kuning berjenjang (Sifir, Ula, Wustho, Ulya) dengan metode sorogan dan bandongan klasik.',
      icon: 'BookOpen'
    },
    {
      title: "Tahfidzul Qur'an 30 Juz",
      desc: "Bimbingan intensif hafalan Al-Qur'an bersanad muttashil dengan target tajwid mutqin dan fashahah.",
      icon: 'Award'
    },
    {
      title: 'Pendidikan Formal Terpadu',
      desc: "Sinergi kurikulum Kemenag/Kemendikbud (MI, MTs, MA, SMA, SMK Assa'adah) hingga jenjang Universitas Qomaruddin.",
      icon: 'GraduationCap'
    },
    {
      title: 'Karakter & Kemandirian Asrama',
      desc: "Pembinaan disiplin sholat jama'ah 5 waktu, dzikir ma'tsurat, kepemimpinan, dan bahasa Arab-Inggris.",
      icon: 'ShieldCheck'
    }
  ]);

  const [fasilitas, setFasilitas] = useState<string[]>([
    "Masjid Jami' Qomaruddin yang Megah & Bersejarah",
    'Komplek Asrama Santri Putra & Putri Representatif',
    'Perpustakaan Khazanah Kitab Salaf & Referensi Modern',
    'Laboratorium Komputer & Bahasa',
    'Klinik Kesehatan Pesantren (Poskestren)',
    'Kantin, Koperasi Pesantren & Dapur Bersih',
    'Sarana Olahraga & Seni Hadrah Al-Banjari'
  ]);

  const [newFasilitasInput, setNewFasilitasInput] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadCmsSettings = async () => {
    setIsLoading(true);
    try {
      const res = await api.getPmbCmsSettingsAdmin();
      if (Array.isArray(res)) {
        res.forEach((s: any) => {
          const val = s.value;
          switch (s.key) {
            case 'pmb_is_open':
              setPmbIsOpen(val === '1' || val === true || val === 'true');
              break;
            case 'pmb_closed_message':
              setPmbClosedMessage(val || '');
              break;
            case 'nama_pesantren':
              setNamaPesantren(val || '');
              break;
            case 'pendiri':
              setPendiri(val || '');
              break;
            case 'tahun_berdiri':
              setTahunBerdiri(val || '');
              break;
            case 'tagline':
              setTagline(val || '');
              break;
            case 'alamat':
              setAlamat(val || '');
              break;
            case 'telepon':
              setTelepon(val || '');
              break;
            case 'email':
              setEmail(val || '');
              break;
            case 'website':
              setWebsite(val || '');
              break;
            case 'sejarah':
              setSejarah(val || '');
              break;
            case 'visi':
              setVisi(val || '');
              break;
            case 'misi':
              setMisi(val || '');
              break;
            case 'agenda_kedatangan_info':
              setAgendaKedatanganInfo(val || '');
              break;
            case 'program_unggulan':
              try {
                const parsed = typeof val === 'string' ? JSON.parse(val) : val;
                if (Array.isArray(parsed) && parsed.length > 0) setPrograms(parsed);
              } catch {}
              break;
            case 'fasilitas':
              try {
                const parsed = typeof val === 'string' ? JSON.parse(val) : val;
                if (Array.isArray(parsed) && parsed.length > 0) setFasilitas(parsed);
              } catch {}
              break;
          }
        });
      }
    } catch (e: any) {
      showToast(e?.message || 'Gagal memuat pengaturan CMS', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCmsSettings();
  }, []);

  const handleTogglePmbStatus = async () => {
    try {
      const nextStatus = !pmbIsOpen;
      await api.togglePmbStatus({
        is_open: nextStatus,
        closed_message: pmbClosedMessage
      });
      setPmbIsOpen(nextStatus);
      showToast(`Status pendaftaran PMB berhasil di-${nextStatus ? 'BUKA' : 'TUTUP'}.`);
    } catch (e: any) {
      showToast(e?.message || 'Gagal mengubah status pendaftaran PMB', 'error');
    }
  };

  const handleAddFasilitas = () => {
    const trimmed = newFasilitasInput.trim();
    if (!trimmed) return;
    if (fasilitas.includes(trimmed)) {
      showToast('Fasilitas sudah ada dalam daftar', 'error');
      return;
    }
    setFasilitas([...fasilitas, trimmed]);
    setNewFasilitasInput('');
  };

  const handleRemoveFasilitas = (index: number) => {
    setFasilitas(fasilitas.filter((_, i) => i !== index));
  };

  const handleUpdateProgram = (index: number, field: keyof ProgramItem, val: string) => {
    const updated = [...programs];
    updated[index] = { ...updated[index], [field]: val };
    setPrograms(updated);
  };

  const handleSaveAllCms = async () => {
    setIsSaving(true);
    try {
      const settingsPayload = [
        { key: 'pmb_is_open', value: pmbIsOpen ? '1' : '0', group: 'general', label: 'Status Pendaftaran PMB Dibuka/Ditutup', type: 'boolean' },
        { key: 'pmb_closed_message', value: pmbClosedMessage, group: 'general', label: 'Pesan Saat Pendaftaran PMB Ditutup', type: 'textarea' },
        { key: 'nama_pesantren', value: namaPesantren, group: 'identity', label: 'Nama Resmi Pesantren', type: 'text' },
        { key: 'pendiri', value: pendiri, group: 'identity', label: 'Tokoh Pendiri Pesantren', type: 'text' },
        { key: 'tahun_berdiri', value: tahunBerdiri, group: 'identity', label: 'Tahun Berdiri Pesantren', type: 'text' },
        { key: 'tagline', value: tagline, group: 'identity', label: 'Tagline & Slogan Pesantren', type: 'text' },
        { key: 'alamat', value: alamat, group: 'contact', label: 'Alamat Lengkap Pesantren', type: 'textarea' },
        { key: 'telepon', value: telepon, group: 'contact', label: 'Narahubung & WhatsApp Panitia', type: 'text' },
        { key: 'email', value: email, group: 'contact', label: 'Email Resmi PMB Pesantren', type: 'text' },
        { key: 'website', value: website, group: 'contact', label: 'Alamat Website Pesantren', type: 'text' },
        { key: 'sejarah', value: sejarah, group: 'profile', label: 'Sejarah & Khazanah Pesantren 1775 M', type: 'textarea' },
        { key: 'visi', value: visi, group: 'profile', label: 'Visi Pesantren', type: 'textarea' },
        { key: 'misi', value: misi, group: 'profile', label: 'Misi Pesantren', type: 'textarea' },
        { key: 'agenda_kedatangan_info', value: agendaKedatanganInfo, group: 'agenda', label: 'Informasi Agenda Kedatangan Santri', type: 'textarea' },
        { key: 'program_unggulan', value: programs, group: 'programs', label: 'Program Unggulan Pesantren', type: 'json' },
        { key: 'fasilitas', value: fasilitas, group: 'facilities', label: 'Fasilitas & Sarana Prasarana', type: 'json' },
      ];

      await api.updatePmbCmsSettings(settingsPayload);
      showToast('Alhamdulillah! Seluruh pengaturan Web Profil Pesantren (CMS) berhasil disimpan.');
    } catch (e: any) {
      showToast(e?.message || 'Gagal menyimpan pengaturan CMS', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3 text-center">
        <RefreshCw className="w-8 h-8 text-[#138F81] animate-spin" />
        <p className="text-sm font-bold text-[#636E72]">Memuat editor CMS Web Profil Pesantren...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 rounded-2xl text-xs font-black shadow-xl animate-fade-in ${
            toast.type === 'success'
              ? 'bg-[#0D7A6F] text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-[#FFDC80]" /> : <X className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* HEADER CMS BANNER */}
      <div className="p-4 sm:p-6 lg:p-7 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 sm:gap-4">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-[#FFDC80] text-[#0D7A6F] border border-amber-300 flex items-center justify-center shrink-0 shadow-xs">
            <Globe className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-2xl font-black text-[#2D3436] tracking-tight">
                CMS Web Profil Pesantren
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#E8F7F3] text-[#138F81] border border-[#138F81]/20">
                Wordpress-Style Engine
              </span>
            </div>
            <p className="text-xs text-[#636E72] font-medium mt-0.5 line-clamp-2 sm:line-clamp-none">
              Admin leluasa memperbarui teks sejarah 1775 M, visi misi, fasilitas, kontak, dan sakelar cerdas buka/tutup PMB.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            onClick={() => window.open('/?pmb=1', '_blank')}
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-[#2D3436] text-xs font-bold border border-slate-200 flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer min-h-[40px]"
          >
            <Eye className="w-3.5 h-3.5 text-[#138F81]" />
            <span>Lihat Live Web Publik</span>
          </button>

          <button
            onClick={handleSaveAllCms}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md shadow-[#138F81]/25 cursor-pointer min-h-[40px]"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin text-[#FFDC80]" /> : <Save className="w-4 h-4 text-[#FFDC80]" />}
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan CMS'}</span>
          </button>
        </div>
      </div>

      {/* SAKELAR CERDAS: MASTER BUKA / TUTUP PMB */}
      <div className={`p-4 sm:p-6 rounded-3xl border shadow-sm transition-all ${
        pmbIsOpen 
          ? 'bg-emerald-50/40 border-emerald-200' 
          : 'bg-rose-50/40 border-rose-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-2xl shrink-0 ${
              pmbIsOpen ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
            }`}>
              <Power className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-[#2D3436]">
                  Status Master Pendaftaran PMB Online:
                </h3>
                <span className={`px-3 py-1 rounded-full text-[11px] sm:text-xs font-black uppercase tracking-wider ${
                  pmbIsOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {pmbIsOpen ? '🟢 PMB SEDANG DIBUKA' : '🔴 PMB SEDANG DITUTUP'}
                </span>
              </div>
              <p className="text-xs text-[#636E72] font-medium mt-1">
                {pmbIsOpen
                  ? 'Calon santri dapat mengisi formulir online dan berkas akan masuk realtime ke Admin PMB.'
                  : 'Formulir online ditutup otomatis. Pengunjung hanya dapat membaca profil pesantren & memantau pengumuman resmi.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleTogglePmbStatus}
            className={`w-full sm:w-auto justify-center px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-xs cursor-pointer shrink-0 min-h-[40px] ${
              pmbIsOpen
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{pmbIsOpen ? 'Tutup Pendaftaran PMB' : 'Buka Pendaftaran PMB'}</span>
          </button>
        </div>

        {/* Custom Closed Message */}
        <div className="mt-4 pt-4 border-t border-slate-200/60">
          <label className="block text-xs font-bold text-[#2D3436] mb-1.5">
            Pesan Pengumuman Saat PMB Ditutup (Tampil di Web Publik):
          </label>
          <input
            type="text"
            value={pmbClosedMessage}
            onChange={(e) => setPmbClosedMessage(e.target.value)}
            placeholder="Contoh: Pendaftaran Santri Baru Gelombang 1 telah ditutup. Gelombang 2 akan dibuka tanggal 15 Mei 2026."
            className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-[#2D3436] focus:outline-none focus:border-[#138F81]"
          />
        </div>
      </div>

      {/* GRID FORM CMS UTAMA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* KARTU 1: IDENTITAS & PROFIL UTAMA PESANTREN */}
        <div className="p-4 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Building className="w-5 h-5 text-[#138F81]" />
            <h3 className="text-sm font-black text-[#2D3436]">1. Identitas & Slogan Pesantren</h3>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2D3436] mb-1">Nama Resmi Lembaga</label>
            <input
              type="text"
              value={namaPesantren}
              onChange={(e) => setNamaPesantren(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-[#2D3436] focus:bg-white focus:outline-none focus:border-[#138F81]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#2D3436] mb-1">Tokoh Pendiri Pesantren</label>
              <input
                type="text"
                value={pendiri}
                onChange={(e) => setPendiri(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-[#2D3436] focus:bg-white focus:outline-none focus:border-[#138F81]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2D3436] mb-1">Tahun Berdiri</label>
              <input
                type="text"
                value={tahunBerdiri}
                onChange={(e) => setTahunBerdiri(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-[#2D3436] focus:bg-white focus:outline-none focus:border-[#138F81]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2D3436] mb-1">Tagline & Slogan Web Publik</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-[#2D3436] focus:bg-white focus:outline-none focus:border-[#138F81]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2D3436] mb-1">Alamat Lengkap Pesantren</label>
            <textarea
              rows={2}
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-[#2D3436] focus:bg-white focus:outline-none focus:border-[#138F81]"
            />
          </div>
        </div>

        {/* KARTU 2: KONTAK & NARAHUBUNG PMB */}
        <div className="p-4 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Phone className="w-5 h-5 text-[#138F81]" />
            <h3 className="text-sm font-black text-[#2D3436]">2. Narahubung & Kanal Digital</h3>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2D3436] mb-1">Nomor WhatsApp / Hotline PMB</label>
            <input
              type="text"
              value={telepon}
              onChange={(e) => setTelepon(e.target.value)}
              placeholder="0812-3456-7890"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-[#2D3436] focus:bg-white focus:outline-none focus:border-[#138F81]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2D3436] mb-1">Email Resmi Panitia PMB</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-[#2D3436] focus:bg-white focus:outline-none focus:border-[#138F81]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2D3436] mb-1">Alamat Portal / Website</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-[#2D3436] focus:bg-white focus:outline-none focus:border-[#138F81]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2D3436] mb-1">
              Petunjuk Kedatangan Santri Baru (Wajib Hadir / Antar ke Asrama)
            </label>
            <textarea
              rows={2}
              value={agendaKedatanganInfo}
              onChange={(e) => setAgendaKedatanganInfo(e.target.value)}
              placeholder="Santri baru yang telah di-ACC wajib diantar ke pondok pesantren pada tanggal yang ditentukan dengan membawa berkas asli."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-[#2D3436] focus:bg-white focus:outline-none focus:border-[#138F81]"
            />
          </div>
        </div>

        {/* KARTU 3: SEJARAH KHIDMAH 1775 M */}
        <div className="p-4 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-3 lg:col-span-2">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <History className="w-5 h-5 text-[#138F81]" />
            <h3 className="text-sm font-black text-[#2D3436]">3. Sejarah & Khazanah Berdiri Sejak 1775 M</h3>
          </div>
          <p className="text-xs text-[#636E72]">
            Tuliskan narasi sejarah perjuangan Mbah Kiai Qomaruddin dan silsilah kepengurusan yang akan menginspirasi wali santri baru.
          </p>
          <textarea
            rows={5}
            value={sejarah}
            onChange={(e) => setSejarah(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-[#2D3436] leading-relaxed focus:bg-white focus:outline-none focus:border-[#138F81]"
          />
        </div>

        {/* KARTU 4: VISI & MISI PESANTREN */}
        <div className="p-4 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Sparkles className="w-5 h-5 text-[#138F81]" />
            <h3 className="text-sm font-black text-[#2D3436]">4. Visi Pesantren</h3>
          </div>
          <textarea
            rows={4}
            value={visi}
            onChange={(e) => setVisi(e.target.value)}
            placeholder="Tuliskan rumusan visi pesantren..."
            className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-[#2D3436] focus:bg-white focus:outline-none focus:border-[#138F81]"
          />
        </div>

        <div className="p-4 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Sparkles className="w-5 h-5 text-[#138F81]" />
            <h3 className="text-sm font-black text-[#2D3436]">5. Misi Pesantren</h3>
          </div>
          <textarea
            rows={4}
            value={misi}
            onChange={(e) => setMisi(e.target.value)}
            placeholder="Tuliskan butir-butir misi pesantren..."
            className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-[#2D3436] focus:bg-white focus:outline-none focus:border-[#138F81]"
          />
        </div>

        {/* KARTU 5: 4 PROGRAM UNGGULAN */}
        <div className="p-4 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Award className="w-5 h-5 text-[#138F81]" />
            <h3 className="text-sm font-black text-[#2D3436]">6. Program Unggulan Pesantren (4 Pilar)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {programs.map((prog, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-[#138F81] bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                    Pilar #{idx + 1}
                  </span>
                  <span className="text-[10px] text-[#636E72] font-semibold">Ikon: {prog.icon}</span>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#2D3436] mb-1">Judul Program</label>
                  <input
                    type="text"
                    value={prog.title}
                    onChange={(e) => handleUpdateProgram(idx, 'title', e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-[#2D3436] focus:outline-none focus:border-[#138F81]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#2D3436] mb-1">Deskripsi Program</label>
                  <textarea
                    rows={2}
                    value={prog.desc}
                    onChange={(e) => handleUpdateProgram(idx, 'desc', e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-[#2D3436] focus:outline-none focus:border-[#138F81]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KARTU 6: FASILITAS & SARANA PRASARANA */}
        <div className="p-4 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Layers className="w-5 h-5 text-[#138F81]" />
            <h3 className="text-sm font-black text-[#2D3436]">7. Fasilitas & Sarana Pesantren</h3>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newFasilitasInput}
              onChange={(e) => setNewFasilitasInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddFasilitas();
                }
              }}
              placeholder="Ketik fasilitas baru (contoh: Lapangan Futsal & Basket)..."
              className="min-w-0 flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-[#2D3436] focus:bg-white focus:outline-none focus:border-[#138F81]"
            />
            <button
              onClick={handleAddFasilitas}
              type="button"
              className="w-full sm:w-auto shrink-0 justify-center px-5 py-2.5 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer min-h-[42px]"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Fasilitas</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2">
            {fasilitas.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-[#2D3436]"
              >
                <div className="flex items-center gap-2 truncate min-w-0">
                  <Check className="w-3.5 h-3.5 text-[#138F81] shrink-0" />
                  <span className="truncate">{item}</span>
                </div>
                <button
                  onClick={() => handleRemoveFasilitas(idx)}
                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Hapus fasilitas ini"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM FLOATING SAVE BAR */}
      <div className="sticky bottom-4 sm:bottom-6 p-3.5 sm:p-4 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 text-xs text-[#636E72] font-semibold">
          <Info className="w-4 h-4 text-[#138F81] shrink-0" />
          <span className="leading-snug">Setiap perubahan yang Anda simpan akan langsung tampil live di Landing Page Web PMB.</span>
        </div>

        <button
          onClick={handleSaveAllCms}
          disabled={isSaving}
          className="w-full sm:w-auto justify-center px-6 py-3 sm:py-2.5 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] disabled:opacity-50 text-white text-xs font-black flex items-center gap-2 transition-all shadow-md shadow-[#138F81]/25 cursor-pointer shrink-0 min-h-[44px]"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin text-[#FFDC80]" /> : <Save className="w-4 h-4 text-[#FFDC80]" />}
          <span>{isSaving ? 'Menyimpan Pengaturan...' : 'Simpan Seluruh Pengaturan (CMS)'}</span>
        </button>
      </div>
    </div>
  );
}
