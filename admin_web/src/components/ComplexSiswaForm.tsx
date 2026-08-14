import { X, Save, User, Users, GraduationCap, FileText, CheckCircle2 } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api, type ApiRecord } from '../services/api';
import SearchableSelect from './SearchableSelect';

interface ComplexSiswaFormProps {
  initialData?: ApiRecord | null;
  readOnly?: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function ComplexSiswaForm({ initialData, readOnly = false, onClose, onSave }: ComplexSiswaFormProps) {
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  
  // Options state
  const [masterRefs, setMasterRefs] = useState<ApiRecord[]>([]);
  const [provinces, setProvinces] = useState<ApiRecord[]>([]);
  
  // Region States
  const [cities, setCities] = useState<ApiRecord[]>([]);
  const [districts, setDistricts] = useState<ApiRecord[]>([]);
  const [villages, setVillages] = useState<ApiRecord[]>([]);
  
  const [citiesAyah, setCitiesAyah] = useState<ApiRecord[]>([]);
  const [districtsAyah, setDistrictsAyah] = useState<ApiRecord[]>([]);
  const [villagesAyah, setVillagesAyah] = useState<ApiRecord[]>([]);
  
  const [citiesIbu, setCitiesIbu] = useState<ApiRecord[]>([]);
  const [districtsIbu, setDistrictsIbu] = useState<ApiRecord[]>([]);
  const [villagesIbu, setVillagesIbu] = useState<ApiRecord[]>([]);
  
  // Sections state
  const [activeTab, setActiveTab] = useState<'siswa' | 'ortu' | 'akademik' | 'lainnya'>('siswa');

  useEffect(() => {
    // Initialize form data
    if (initialData) {
      const parsed: Record<string, string | number> = {};
      Object.entries(initialData).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          parsed[key] = String(value);
        }
      });
      setForm(parsed);
      
      // Load cascade dropdowns if editing
      if (parsed.province_id) loadCities(parsed.province_id, 'siswa');
      if (parsed.city_id) loadDistricts(parsed.city_id, 'siswa');
      if (parsed.district_id) loadVillages(parsed.district_id, 'siswa');
      
      if (parsed.province_id_ayah) loadCities(parsed.province_id_ayah, 'ayah');
      if (parsed.city_id_ayah) loadDistricts(parsed.city_id_ayah, 'ayah');
      if (parsed.district_id_ayah) loadVillages(parsed.district_id_ayah, 'ayah');
      
      if (parsed.province_id_ibu) loadCities(parsed.province_id_ibu, 'ibu');
      if (parsed.city_id_ibu) loadDistricts(parsed.city_id_ibu, 'ibu');
      if (parsed.district_id_ibu) loadVillages(parsed.district_id_ibu, 'ibu');
    } else {
      setForm({ jenis_kelamin: 'L', status: 'Aktif', kewarganegaraan: 'Indonesia' });
    }

    // Load static dropdowns
    api.masterReferensi().then(res => setMasterRefs(res.data || [])).catch(() => {});
    api.regionProvinces().then(res => setProvinces(res.data || [])).catch(() => {});
  }, [initialData]);

  const loadCities = async (provId: string | number, type: 'siswa'|'ayah'|'ibu' = 'siswa') => {
    if (!provId) {
      if(type==='siswa') setCities([]); if(type==='ayah') setCitiesAyah([]); if(type==='ibu') setCitiesIbu([]);
      return;
    }
    try {
      const res = await api.regionCities({ province_id: provId });
      if(type==='siswa') setCities(res.data || []); if(type==='ayah') setCitiesAyah(res.data || []); if(type==='ibu') setCitiesIbu(res.data || []);
    } catch {}
  };

  const loadDistricts = async (cityId: string | number, type: 'siswa'|'ayah'|'ibu' = 'siswa') => {
    if (!cityId) {
      if(type==='siswa') setDistricts([]); if(type==='ayah') setDistrictsAyah([]); if(type==='ibu') setDistrictsIbu([]);
      return;
    }
    try {
      const res = await api.regionDistricts({ city_id: cityId });
      if(type==='siswa') setDistricts(res.data || []); if(type==='ayah') setDistrictsAyah(res.data || []); if(type==='ibu') setDistrictsIbu(res.data || []);
    } catch {}
  };

  const loadVillages = async (districtId: string | number, type: 'siswa'|'ayah'|'ibu' = 'siswa') => {
    if (!districtId) {
      if(type==='siswa') setVillages([]); if(type==='ayah') setVillagesAyah([]); if(type==='ibu') setVillagesIbu([]);
      return;
    }
    try {
      const res = await api.regionVillages({ district_id: districtId });
      if(type==='siswa') setVillages(res.data || []); if(type==='ayah') setVillagesAyah(res.data || []); if(type==='ibu') setVillagesIbu(res.data || []);
    } catch {}
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string, value: any } }) => {
    const { name, value } = e.target;
    setForm(prev => {
      const next = { ...prev, [name]: value };
      
      // Cascading logic SISWA
      if (name === 'province_id') {
        next.city_id = ''; next.district_id = ''; next.village_id = ''; next.kode_pos = '';
        loadCities(value, 'siswa'); setDistricts([]); setVillages([]);
      }
      if (name === 'city_id') {
        next.district_id = ''; next.village_id = ''; next.kode_pos = '';
        loadDistricts(value, 'siswa'); setVillages([]);
      }
      if (name === 'district_id') {
        next.village_id = ''; next.kode_pos = '';
        loadVillages(value, 'siswa');
      }
      if (name === 'village_id') {
        const village = villages.find(p => String(p.id) === String(value));
        if (village) next.kode_pos = String(village.postal_code || next.kode_pos || '');
      }
      
      // Cascading logic AYAH
      if (name === 'province_id_ayah') {
        next.city_id_ayah = ''; next.district_id_ayah = ''; next.village_id_ayah = ''; next.kode_pos_ayah = '';
        loadCities(value, 'ayah'); setDistrictsAyah([]); setVillagesAyah([]);
      }
      if (name === 'city_id_ayah') {
        next.district_id_ayah = ''; next.village_id_ayah = ''; next.kode_pos_ayah = '';
        loadDistricts(value, 'ayah'); setVillagesAyah([]);
      }
      if (name === 'district_id_ayah') {
        next.village_id_ayah = ''; next.kode_pos_ayah = '';
        loadVillages(value, 'ayah');
      }
      if (name === 'village_id_ayah') {
        const village = villagesAyah.find(p => String(p.id) === String(value));
        if (village) next.kode_pos_ayah = String(village.postal_code || next.kode_pos_ayah || '');
      }

      // Cascading logic IBU
      if (name === 'province_id_ibu') {
        next.city_id_ibu = ''; next.district_id_ibu = ''; next.village_id_ibu = ''; next.kode_pos_ibu = '';
        loadCities(value, 'ibu'); setDistrictsIbu([]); setVillagesIbu([]);
      }
      if (name === 'city_id_ibu') {
        next.district_id_ibu = ''; next.village_id_ibu = ''; next.kode_pos_ibu = '';
        loadDistricts(value, 'ibu'); setVillagesIbu([]);
      }
      if (name === 'district_id_ibu') {
        next.village_id_ibu = ''; next.kode_pos_ibu = '';
        loadVillages(value, 'ibu');
      }
      if (name === 'village_id_ibu') {
        const village = villagesIbu.find(p => String(p.id) === String(value));
        if (village) next.kode_pos_ibu = String(village.postal_code || next.kode_pos_ibu || '');
      }

      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError('');
    
    try {
      const payload: ApiRecord = { ...form };
      if (form.id) {
        await api.updateSiswa(Number(form.id), payload);
      } else {
        await api.createSiswa(payload);
      }
      
      // Show success animation
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSave();
      }, 2000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan data siswa.');
      setIsSaving(false);
    }
  };

  const getRef = (kategori: string) => masterRefs.filter(r => String(r.kategori).toLowerCase() === kategori.toLowerCase());

  return (
    <div className="w-full flex-1">
      <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <div>
              <h2 className="text-xl font-extrabold text-[#2D3436]">
                {readOnly ? 'Detail Data Siswa/Santri' : (form.id ? 'Edit Data Siswa/Santri' : 'Tambah Data Siswa/Santri Baru')}
              </h2>
              <p className="text-sm font-semibold text-[#636E72] mt-1">Lengkapi data profil, orang tua, dan akademik secara detail.</p>
            </div>
            <button className="grid h-10 w-10 place-items-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors" onClick={onClose} type="button" disabled={isSuccess}>
              <X size={20} />
            </button>
          </div>

          {/* Success Overlay */}
          {isSuccess && (
            <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center rounded-3xl bg-white/90 backdrop-blur-sm transition-all duration-300">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100 text-green-500 shadow-xl shadow-green-500/20 mb-6 animate-[bounce_1s_ease-in-out_infinite]">
                <CheckCircle2 size={56} strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-extrabold text-[#2D3436] animate-[pulse_2s_ease-in-out_infinite]">Berhasil!</h2>
              <p className="mt-2 text-base font-bold text-[#636E72]">{form.id ? 'Data berhasil diperbarui.' : 'Siswa baru berhasil ditambahkan.'}</p>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col md:flex-row overflow-hidden relative">
            {/* Sidebar Tabs */}
            <div className="hidden w-64 shrink-0 flex-col gap-2 overflow-y-auto border-r border-slate-200 bg-slate-50 p-4 md:flex">
              <button type="button" onClick={() => setActiveTab('siswa')} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-colors ${activeTab === 'siswa' ? 'bg-[#138F81] text-white shadow-md' : 'text-[#636E72] hover:bg-white'}`}>
                <User size={18} /> I. Data Siswa
              </button>
              <button type="button" onClick={() => setActiveTab('ortu')} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-colors ${activeTab === 'ortu' ? 'bg-[#138F81] text-white shadow-md' : 'text-[#636E72] hover:bg-white'}`}>
                <Users size={18} /> II. Orang Tua / Wali
              </button>
              <button type="button" onClick={() => setActiveTab('akademik')} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-colors ${activeTab === 'akademik' ? 'bg-[#138F81] text-white shadow-md' : 'text-[#636E72] hover:bg-white'}`}>
                <GraduationCap size={18} /> III. Masuk Sekolah
              </button>
              <button type="button" onClick={() => setActiveTab('lainnya')} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-colors ${activeTab === 'lainnya' ? 'bg-[#138F81] text-white shadow-md' : 'text-[#636E72] hover:bg-white'}`}>
                <FileText size={18} /> IV. Lain-lain
              </button>
            </div>

            {/* Mobile Tab Selector */}
            <div className="border-b border-slate-200 bg-slate-50 p-3 md:hidden">
               <select className="q-input font-bold text-[#138F81]" value={activeTab} onChange={(e) => setActiveTab(e.target.value as any)}>
                 <option value="siswa">I. Data Siswa</option>
                 <option value="ortu">II. Orang Tua / Wali</option>
                 <option value="akademik">III. Masuk Madrasah Ini</option>
                 <option value="lainnya">IV. Lain-lain</option>
               </select>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-white q-scrollbar">
              {error ? <div className="mb-6 rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031] border border-rose-100">{error}</div> : null}
              
              <form id="complex-siswa-form" onSubmit={handleSubmit} className="space-y-8 pb-10">
                <fieldset disabled={readOnly} className="space-y-8">
                  {/* Section I */}
                <div className={activeTab === 'siswa' ? 'block' : 'hidden'}>
                  <h3 className="mb-6 flex items-center gap-2 text-lg font-extrabold text-[#138F81] pb-2 border-b border-[#138F81]/20">
                    <User size={20} /> I. Data Pribadi Siswa
                  </h3>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">Nama Lengkap</span>
                      <input className="q-input" name="nama" value={String(form.nama || '')} onChange={handleChange} required />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">Nama Panggilan</span>
                      <input className="q-input" name="nama_panggilan" value={String(form.nama_panggilan || '')} onChange={handleChange} />
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">NIS</span>
                        <input className="q-input" name="nis" value={String(form.nis || '')} onChange={handleChange} required />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">NISN</span>
                        <input className="q-input" name="nisn" value={String(form.nisn || '')} onChange={handleChange} />
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">NIK (Siswa)</span>
                        <input className="q-input" name="nik" value={String(form.nik || '')} onChange={handleChange} />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">No KK</span>
                        <input className="q-input" name="no_kk" value={String(form.no_kk || '')} onChange={handleChange} />
                      </label>
                    </div>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">No Akta Kelahiran</span>
                      <input className="q-input" name="no_akta" value={String(form.no_akta || '')} onChange={handleChange} />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">Jenis Kelamin</span>
                      <select className="q-input" name="jenis_kelamin" value={String(form.jenis_kelamin || 'L')} onChange={handleChange} required>
                        <option value="L">Laki-laki</option>
                        <option value="P">Perempuan</option>
                      </select>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">Anak Ke</span>
                        <input type="number" className="q-input" name="anak_ke" value={String(form.anak_ke || '')} onChange={handleChange} />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">Jml Saudara</span>
                        <input type="number" className="q-input" name="jml_saudara" value={String(form.jml_saudara || '')} onChange={handleChange} />
                      </label>
                    </div>
                    
                    <div className="col-span-full mt-4">
                      <h4 className="text-sm font-extrabold text-[#2D3436] mb-4">Kontak & Alamat</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">No WhatsApp Siswa</span>
                        <input className="q-input" name="no_whatsapp" value={String(form.no_whatsapp || '')} onChange={handleChange} />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">Email Siswa</span>
                        <input type="email" className="q-input" name="email_siswa" value={String(form.email_siswa || '')} onChange={handleChange} />
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">Provinsi</span>
                      <SearchableSelect 
                        name="province_id" 
                        value={form.province_id || ''} 
                        onChange={(v) => handleChange({ target: { name: 'province_id', value: v } })}
                        options={provinces.map(p => ({ value: p.id as string, label: p.name as string }))} 
                        placeholder="Pilih Provinsi..." 
                        disabled={readOnly}
                      />
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">Kota / Tempat Lahir</span>
                        <SearchableSelect 
                          name="city_id" 
                          value={form.city_id || ''} 
                          onChange={(v) => handleChange({ target: { name: 'city_id', value: v } })}
                          options={cities.map(p => ({ value: p.id as string, label: p.name as string }))} 
                          placeholder="Pilih Kabupaten..." 
                          disabled={readOnly || !form.province_id}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">Tgl Lahir</span>
                        <input type="date" className="q-input px-2" name="tanggal_lahir" value={String(form.tanggal_lahir || '')} onChange={handleChange} />
                      </label>
                    </div>
                    
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">Kecamatan</span>
                      <SearchableSelect 
                        name="district_id" 
                        value={form.district_id || ''} 
                        onChange={(v) => handleChange({ target: { name: 'district_id', value: v } })}
                        options={districts.map(p => ({ value: p.id as string, label: p.name as string }))} 
                        placeholder="Pilih Kecamatan..." 
                        disabled={readOnly || !form.city_id}
                      />
                    </label>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">Desa / Kelurahan</span>
                        <SearchableSelect 
                          name="village_id" 
                          value={form.village_id || ''} 
                          onChange={(v) => handleChange({ target: { name: 'village_id', value: v } })}
                          options={villages.map(p => ({ value: p.id as string, label: p.name as string }))} 
                          placeholder="Pilih Desa..." 
                          disabled={readOnly || !form.district_id}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#138F81]">Kode Pos</span>
                        <input className="q-input border-[#138F81]/50 bg-white focus:bg-white text-slate-800" name="kode_pos" value={String(form.kode_pos || '')} onChange={handleChange} placeholder="Ketik disini..." />
                      </label>
                    </div>

                    <label className="block col-span-full">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">Jalan / Detail Alamat Lengkap</span>
                      <textarea className="q-input min-h-[80px]" name="alamat" value={String(form.alamat || '')} onChange={handleChange} placeholder="Dusun, RT/RW, Nama Jalan, Blok, dll" />
                    </label>

                    <div className="col-span-full mt-4">
                      <h4 className="text-sm font-extrabold text-[#2D3436] mb-4">Tempat Tinggal & Fisik</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">Tempat Tinggal</span>
                        <input list="tempat-tinggal-list" className="q-input" name="tempat_tinggal" value={String(form.tempat_tinggal || '')} onChange={handleChange} />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">Transportasi</span>
                        <input list="transportasi-list" className="q-input" name="transportasi" value={String(form.transportasi || '')} onChange={handleChange} />
                      </label>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">Tinggi (cm)</span>
                        <input type="number" className="q-input" name="tinggi_badan" value={String(form.tinggi_badan || '')} onChange={handleChange} />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">Berat (kg)</span>
                        <input type="number" className="q-input" name="berat_badan" value={String(form.berat_badan || '')} onChange={handleChange} />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[#636E72]">Gol. Darah</span>
                        <select className="q-input" name="golongan_darah" value={String(form.golongan_darah || '')} onChange={handleChange}>
                          <option value="">-</option>
                          {getRef('golongan_darah').map(r => <option key={String(r.id)} value={String(r.nilai)}>{String(r.nilai)}</option>)}
                        </select>
                      </label>
                    </div>
                  </div>
                  
                  <datalist id="tempat-tinggal-list">{getRef('tempat_tinggal').map(r => <option key={String(r.id)} value={String(r.nilai)} />)}</datalist>
                  <datalist id="transportasi-list">{getRef('transportasi').map(r => <option key={String(r.id)} value={String(r.nilai)} />)}</datalist>
                </div>

                {/* Section II */}
                <div className={activeTab === 'ortu' ? 'block' : 'hidden'}>
                  <h3 className="mb-6 flex items-center gap-2 text-lg font-extrabold text-[#138F81] pb-2 border-b border-[#138F81]/20">
                    <Users size={20} /> II. Data Orang Tua & Wali
                  </h3>
                  
                  <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
                    {/* AYAH */}
                    <div className="space-y-4 rounded-3xl bg-slate-50 p-5 border border-slate-200 shadow-sm">
                      <h4 className="text-base font-extrabold text-[#2D3436]">Data Ayah</h4>
                      <label className="block">
                        <span className="mb-2 block text-xs font-bold text-[#636E72]">Nama Ayah</span>
                        <input className="q-input" name="nama_ayah" value={String(form.nama_ayah || '')} onChange={handleChange} />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-bold text-[#636E72]">NIK Ayah</span>
                        <input className="q-input" name="nik_ayah" value={String(form.nik_ayah || '')} onChange={handleChange} />
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                          <span className="mb-2 block text-xs font-bold text-[#636E72]">Tempat Lahir</span>
                          <input className="q-input" name="tempat_lahir_ayah" value={String(form.tempat_lahir_ayah || '')} onChange={handleChange} />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-bold text-[#636E72]">Tgl Lahir</span>
                          <input type="date" className="q-input px-2" name="tanggal_lahir_ayah" value={String(form.tanggal_lahir_ayah || '')} onChange={handleChange} />
                        </label>
                      </div>
                      <label className="block">
                        <span className="mb-2 block text-xs font-bold text-[#636E72]">Pendidikan Ayah</span>
                        <input list="pendidikan-list" className="q-input" name="pendidikan_ayah" value={String(form.pendidikan_ayah || '')} onChange={handleChange} />
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                          <span className="mb-2 block text-xs font-bold text-[#636E72]">Pekerjaan Ayah</span>
                          <input list="pekerjaan-list" className="q-input" name="pekerjaan_ayah" value={String(form.pekerjaan_ayah || '')} onChange={handleChange} />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-bold text-[#636E72]">Penghasilan</span>
                          <input list="penghasilan-list" className="q-input" name="penghasilan_ayah" value={String(form.penghasilan_ayah || '')} onChange={handleChange} />
                        </label>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <h5 className="text-xs font-extrabold text-[#2D3436] mb-3">Alamat Ayah</h5>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold text-[#636E72]">Provinsi</span>
                            <SearchableSelect 
                              value={form.province_id_ayah || ''} 
                              onChange={(v) => handleChange({ target: { name: 'province_id_ayah', value: v } })}
                              options={provinces.map(p => ({ value: p.id as string, label: p.name as string }))} 
                              placeholder="Pilih..." disabled={readOnly}
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold text-[#636E72]">Kabupaten/Kota</span>
                            <SearchableSelect 
                              value={form.city_id_ayah || ''} 
                              onChange={(v) => handleChange({ target: { name: 'city_id_ayah', value: v } })}
                              options={citiesAyah.map(p => ({ value: p.id as string, label: p.name as string }))} 
                              placeholder="Pilih..." disabled={readOnly || !form.province_id_ayah}
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold text-[#636E72]">Kecamatan</span>
                            <SearchableSelect 
                              value={form.district_id_ayah || ''} 
                              onChange={(v) => handleChange({ target: { name: 'district_id_ayah', value: v } })}
                              options={districtsAyah.map(p => ({ value: p.id as string, label: p.name as string }))} 
                              placeholder="Pilih..." disabled={readOnly || !form.city_id_ayah}
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold text-[#636E72]">Desa/Kelurahan</span>
                            <SearchableSelect 
                              value={form.village_id_ayah || ''} 
                              onChange={(v) => handleChange({ target: { name: 'village_id_ayah', value: v } })}
                              options={villagesAyah.map(p => ({ value: p.id as string, label: p.name as string }))} 
                              placeholder="Pilih..." disabled={readOnly || !form.district_id_ayah}
                            />
                          </label>
                        </div>
                        <div className="grid grid-cols-[1fr_100px] gap-3">
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold text-[#636E72]">Jalan/Detail</span>
                            <input className="q-input text-xs py-2" name="alamat_ayah" value={String(form.alamat_ayah || '')} onChange={handleChange} placeholder="Jl. Raya..." />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold text-[#636E72]">Kode Pos</span>
                            <input className="q-input text-xs py-2" name="kode_pos_ayah" value={String(form.kode_pos_ayah || '')} onChange={handleChange} placeholder="00000" />
                          </label>
                        </div>
                      </div>

                      <label className="block mt-4">
                        <span className="mb-2 block text-xs font-bold text-[#636E72]">No WhatsApp Ayah</span>
                        <input className="q-input" name="no_whatsapp_ayah" value={String(form.no_whatsapp_ayah || '')} onChange={handleChange} />
                      </label>
                    </div>

                    {/* IBU */}
                    <div className="space-y-4 rounded-3xl bg-slate-50 p-5 border border-slate-200 shadow-sm">
                      <h4 className="text-base font-extrabold text-[#2D3436]">Data Ibu</h4>
                      <label className="block">
                        <span className="mb-2 block text-xs font-bold text-[#636E72]">Nama Ibu</span>
                        <input className="q-input" name="nama_ibu" value={String(form.nama_ibu || '')} onChange={handleChange} />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-bold text-[#636E72]">NIK Ibu</span>
                        <input className="q-input" name="nik_ibu" value={String(form.nik_ibu || '')} onChange={handleChange} />
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                          <span className="mb-2 block text-xs font-bold text-[#636E72]">Tempat Lahir</span>
                          <input className="q-input" name="tempat_lahir_ibu" value={String(form.tempat_lahir_ibu || '')} onChange={handleChange} />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-bold text-[#636E72]">Tgl Lahir</span>
                          <input type="date" className="q-input px-2" name="tanggal_lahir_ibu" value={String(form.tanggal_lahir_ibu || '')} onChange={handleChange} />
                        </label>
                      </div>
                      <label className="block">
                        <span className="mb-2 block text-xs font-bold text-[#636E72]">Pendidikan Ibu</span>
                        <input list="pendidikan-list" className="q-input" name="pendidikan_ibu" value={String(form.pendidikan_ibu || '')} onChange={handleChange} />
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                          <span className="mb-2 block text-xs font-bold text-[#636E72]">Pekerjaan Ibu</span>
                          <input list="pekerjaan-list" className="q-input" name="pekerjaan_ibu" value={String(form.pekerjaan_ibu || '')} onChange={handleChange} />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-bold text-[#636E72]">Penghasilan</span>
                          <input list="penghasilan-list" className="q-input" name="penghasilan_ibu" value={String(form.penghasilan_ibu || '')} onChange={handleChange} />
                        </label>
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <h5 className="text-xs font-extrabold text-[#2D3436] mb-3">Alamat Ibu</h5>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold text-[#636E72]">Provinsi</span>
                            <SearchableSelect 
                              value={form.province_id_ibu || ''} 
                              onChange={(v) => handleChange({ target: { name: 'province_id_ibu', value: v } })}
                              options={provinces.map(p => ({ value: p.id as string, label: p.name as string }))} 
                              placeholder="Pilih..." disabled={readOnly}
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold text-[#636E72]">Kabupaten/Kota</span>
                            <SearchableSelect 
                              value={form.city_id_ibu || ''} 
                              onChange={(v) => handleChange({ target: { name: 'city_id_ibu', value: v } })}
                              options={citiesIbu.map(p => ({ value: p.id as string, label: p.name as string }))} 
                              placeholder="Pilih..." disabled={readOnly || !form.province_id_ibu}
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold text-[#636E72]">Kecamatan</span>
                            <SearchableSelect 
                              value={form.district_id_ibu || ''} 
                              onChange={(v) => handleChange({ target: { name: 'district_id_ibu', value: v } })}
                              options={districtsIbu.map(p => ({ value: p.id as string, label: p.name as string }))} 
                              placeholder="Pilih..." disabled={readOnly || !form.city_id_ibu}
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold text-[#636E72]">Desa/Kelurahan</span>
                            <SearchableSelect 
                              value={form.village_id_ibu || ''} 
                              onChange={(v) => handleChange({ target: { name: 'village_id_ibu', value: v } })}
                              options={villagesIbu.map(p => ({ value: p.id as string, label: p.name as string }))} 
                              placeholder="Pilih..." disabled={readOnly || !form.district_id_ibu}
                            />
                          </label>
                        </div>
                        <div className="grid grid-cols-[1fr_100px] gap-3">
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold text-[#636E72]">Jalan/Detail</span>
                            <input className="q-input text-xs py-2" name="alamat_ibu" value={String(form.alamat_ibu || '')} onChange={handleChange} placeholder="Jl. Raya..." />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold text-[#636E72]">Kode Pos</span>
                            <input className="q-input text-xs py-2" name="kode_pos_ibu" value={String(form.kode_pos_ibu || '')} onChange={handleChange} placeholder="00000" />
                          </label>
                        </div>
                      </div>

                      <label className="block mt-4">
                        <span className="mb-2 block text-xs font-bold text-[#636E72]">No WhatsApp Ibu</span>
                        <input className="q-input" name="no_whatsapp_ibu" value={String(form.no_whatsapp_ibu || '')} onChange={handleChange} />
                      </label>
                    </div>

                    {/* WALI */}
                    <div className="space-y-4 rounded-3xl bg-[#138F81]/5 p-5 border border-[#138F81]/20 col-span-full shadow-sm">
                      <h4 className="text-base font-extrabold text-[#138F81]">Data Wali (Opsional)</h4>
                      <div className="grid md:grid-cols-3 gap-4">
                        <label className="block">
                          <span className="mb-2 block text-xs font-bold text-[#636E72]">Nama Wali</span>
                          <input className="q-input" name="nama_wali_keluarga" value={String(form.nama_wali_keluarga || '')} onChange={handleChange} />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-bold text-[#636E72]">Hubungan Wali</span>
                          <input list="hubungan-list" className="q-input" name="wali_sama_dengan" value={String(form.wali_sama_dengan || '')} onChange={handleChange} />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-bold text-[#636E72]">Pekerjaan Wali</span>
                          <input list="pekerjaan-list" className="q-input" name="pekerjaan_wali_keluarga" value={String(form.pekerjaan_wali_keluarga || '')} onChange={handleChange} />
                        </label>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <label className="block">
                          <span className="mb-2 block text-xs font-bold text-[#636E72]">No WhatsApp Wali</span>
                          <input className="q-input" name="no_telepon_wali" value={String(form.no_telepon_wali || '')} onChange={handleChange} />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-bold text-[#636E72]">Alamat Wali</span>
                          <input className="q-input" name="alamat_wali_keluarga" value={String(form.alamat_wali_keluarga || '')} onChange={handleChange} />
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <datalist id="pendidikan-list">{getRef('pendidikan_terakhir').map(r => <option key={String(r.id)} value={String(r.nilai)} />)}</datalist>
                  <datalist id="pekerjaan-list">{getRef('pekerjaan').map(r => <option key={String(r.id)} value={String(r.nilai)} />)}</datalist>
                  <datalist id="penghasilan-list">{getRef('rentang_penghasilan').map(r => <option key={String(r.id)} value={String(r.nilai)} />)}</datalist>
                  <datalist id="hubungan-list">{getRef('hubungan_wali').map(r => <option key={String(r.id)} value={String(r.nilai)} />)}</datalist>
                </div>

                {/* Section III */}
                <div className={activeTab === 'akademik' ? 'block' : 'hidden'}>
                  <h3 className="mb-6 flex items-center gap-2 text-lg font-extrabold text-[#138F81] pb-2 border-b border-[#138F81]/20">
                    <GraduationCap size={20} /> III. Masuk Madrasah Ini
                  </h3>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">Dari Sekolah / Madrasah</span>
                      <input list="sekolah-list" className="q-input" name="asal_sekolah" value={String(form.asal_sekolah || '')} onChange={handleChange} />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">Kewarganegaraan</span>
                      <input className="q-input" name="kewarganegaraan" value={String(form.kewarganegaraan || 'Indonesia')} onChange={handleChange} />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">Tanggal Diterima</span>
                      <input type="date" className="q-input" name="tanggal_diterima_sekolah" value={String(form.tanggal_diterima_sekolah || '')} onChange={handleChange} />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">Diterima di Kelas</span>
                      <input className="q-input" name="kelas" value={String(form.kelas || '')} onChange={handleChange} />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">Tahun Akademik Masuk</span>
                      <input list="tahun-akademik-list" className="q-input" name="tahun_akademik_masuk" value={String(form.tahun_akademik_masuk || '')} onChange={handleChange} placeholder="Misal: 2026/2027" />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">Jenis Santri</span>
                      <input list="jenis-santri-list" className="q-input" name="jenis_santri" value={String(form.jenis_santri || '')} onChange={handleChange} placeholder="Misal: Mukim / Non-Mukim" />
                    </label>
                  </div>
                  <datalist id="sekolah-list">{getRef('asal_sekolah').map(r => <option key={String(r.id)} value={String(r.nilai)} />)}</datalist>
                  <datalist id="tahun-akademik-list">{getRef('tahun_akademik').map(r => <option key={String(r.id)} value={String(r.nilai)} />)}</datalist>
                  <datalist id="jenis-santri-list">{getRef('jenis_santri').map(r => <option key={String(r.id)} value={String(r.nilai)} />)}</datalist>
                </div>

                {/* Section IV */}
                <div className={activeTab === 'lainnya' ? 'block' : 'hidden'}>
                  <h3 className="mb-6 flex items-center gap-2 text-lg font-extrabold text-[#138F81] pb-2 border-b border-[#138F81]/20">
                    <FileText size={20} /> IV. Lain-lain
                  </h3>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">Status Saat Ini</span>
                      <select className="q-input font-bold" name="status" value={String(form.status || 'Aktif')} onChange={handleChange}>
                        <option value="Aktif">Aktif</option>
                        <option value="Nonaktif">Keluar / Nonaktif</option>
                        <option value="Lulus">Lulus</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">Tahun Lulus / Tanggal Meninggalkan</span>
                      <input className="q-input" name="tahun_lulus" value={String(form.tahun_lulus || '')} onChange={handleChange} />
                    </label>
                    <label className="block col-span-full">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">Catatan Khusus (Ijazah / Prestasi / dll)</span>
                      <textarea className="q-input min-h-[120px]" name="catatan_santri" value={String(form.catatan_santri || '')} onChange={handleChange} />
                    </label>
                  </div>
                </div>
                </fieldset>
              </form>
            </div>
          </div>
          
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
            <button type="button" onClick={onClose} disabled={isSaving || isSuccess} className="rounded-2xl bg-white px-6 py-3 text-sm font-bold text-[#636E72] shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50">
              {readOnly ? 'Tutup' : 'Batal'}
            </button>
            {!readOnly && (
              <button type="submit" form="complex-siswa-form" disabled={isSaving || isSuccess} className="inline-flex items-center gap-2 rounded-2xl bg-[#138F81] px-8 py-3 text-sm font-extrabold text-white shadow-lg shadow-[#138F81]/20 hover:bg-[#0E6A5F] transition-colors disabled:opacity-70">
                <CheckCircle2 size={18} className={isSaving ? 'animate-spin' : ''} />
                {isSaving ? 'Menyimpan...' : 'Simpan Data Siswa/Santri'}
              </button>
            )}
          </div>
      </div>
    </div>
  );
}
