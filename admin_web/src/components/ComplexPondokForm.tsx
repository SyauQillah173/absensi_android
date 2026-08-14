import { Building2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { type ApiRecord } from '../services/api';

interface ComplexPondokFormProps {
  initialData: ApiRecord;
  onClose: () => void;
}

export function ComplexPondokForm({ initialData, onClose }: ComplexPondokFormProps) {
  function text(value: unknown, fallback = '-'): string {
    const result = String(value ?? '').trim();
    return result || fallback;
  }
  
  function record(value: unknown): ApiRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as ApiRecord) : {};
  }

  const row = initialData;
  const santriName = text(row.siswa_nama ?? row.nama);
  const komplekName = text(row.complex_name ?? row.komplek ?? record(row.complex).name);
  const kamarName = text(row.room_name ?? row.kamar ?? record(row.room).name);
  const status = row.is_active === false ? 'Nonaktif' : 'Aktif';
  const nis = text(row.nis ?? record(row.siswa).nis);
  const kelas = text(row.kelas ?? record(row.siswa).kelas);

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative flex max-h-[100vh] w-full max-w-4xl flex-col bg-transparent">
        <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
          
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <div>
              <h2 className="text-xl font-extrabold text-[#2D3436]">Detail Data Pondok Santri</h2>
              <p className="text-sm font-semibold text-[#636E72] mt-1">Informasi komplek dan kamar untuk santri boarding.</p>
            </div>
            <button className="grid h-10 w-10 place-items-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors" onClick={onClose} type="button">
              <X size={20} />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden relative">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-white q-scrollbar">
              <div className="space-y-8 max-w-3xl mx-auto">
                <div className="space-y-4 rounded-3xl bg-slate-50 p-5 border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-extrabold text-[#138F81] flex items-center gap-2 mb-4">
                    <Building2 size={16} /> Informasi Santri & Asrama
                  </h3>
                  
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-[#636E72]">Nama Santri</span>
                    <input className="q-input" value={santriName} disabled />
                  </label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">NIS</span>
                      <input className="q-input" value={nis} disabled />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">Kelas</span>
                      <input className="q-input" value={kelas} disabled />
                    </label>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">Komplek Asrama</span>
                      <input className="q-input" value={komplekName} disabled />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">Kamar</span>
                      <input className="q-input" value={kamarName} disabled />
                    </label>
                  </div>
                  
                  <div className="mt-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#636E72]">Status Mondok</span>
                      <input className="q-input" value={status} disabled />
                    </label>
                  </div>
                  
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-2xl bg-white px-6 py-3 text-sm font-bold text-[#636E72] shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 transition-colors">
              Tutup
            </button>
          </div>

        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
