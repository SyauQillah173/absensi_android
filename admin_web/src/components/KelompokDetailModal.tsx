import { BookOpen, GraduationCap, Search, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { type ApiRecord } from '../services/api';

interface KelompokDetailModalProps {
  data: ApiRecord | null;
  onClose: () => void;
}

function text(value: unknown, fallback = '-'): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

export function KelompokDetailModal({ data, onClose }: KelompokDetailModalProps) {
  const [search, setSearch] = useState('');

  if (!data) return null;

  const rawSiswaList = Array.isArray(data.siswa) ? (data.siswa as ApiRecord[]) : [];

  const filteredStudents = useMemo(() => {
    const kw = search.toLowerCase().trim();
    if (!kw) return rawSiswaList;
    return rawSiswaList.filter((s) =>
      `${s.nama ?? ''} ${s.nis ?? ''} ${s.nisn ?? ''} ${s.kamar ?? ''}`.toLowerCase().includes(kw)
    );
  }, [rawSiswaList, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-transparent px-6 py-5">
          <div className="flex items-center gap-3.5">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#138F81] text-white shadow-lg shadow-[#138F81]/25">
              <BookOpen size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold text-slate-800">{text(data.nama)}</h3>
                <span className="rounded-md bg-teal-100 px-2.5 py-0.5 text-xs font-black text-teal-800">
                  {text(data.kategori, 'Kelompok')}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Level/Sifir: <b>{text(data.sifir)}</b> • Total <b>{rawSiswaList.length} Santri</b> terdaftar
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-[#138F81] outline-none"
              placeholder="Cari santri di kelompok ini..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-xs font-bold text-slate-500">
            Menampilkan {filteredStudents.length} dari {rawSiswaList.length} santri
          </span>
        </div>

        {/* Student Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {rawSiswaList.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Users className="mx-auto mb-2 text-slate-300" size={36} />
              <p className="text-sm font-bold text-slate-600">Belum ada santri di kelompok belajar ini.</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Klik tombol <b>Edit</b> pada tabel untuk menambahkan santri ke dalam kelompok ini.
              </p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-8 text-center text-xs font-bold text-slate-400">
              Tidak ada santri yang cocok dengan pencarian "{search}".
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-center w-12">No</th>
                    <th className="px-4 py-3">NIS</th>
                    <th className="px-4 py-3">Nama Lengkap Santri</th>
                    <th className="px-4 py-3 text-center">Gender</th>
                    <th className="px-4 py-3">Kamar / Asrama</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {filteredStudents.map((siswa, idx) => (
                    <tr key={String(siswa.id ?? idx)} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">{text(siswa.nis)}</td>
                      <td className="px-4 py-3 font-extrabold text-slate-900">{text(siswa.nama)}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-black ${
                            siswa.jenis_kelamin === 'L'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-pink-50 text-pink-700 border border-pink-200'
                          }`}
                        >
                          {siswa.jenis_kelamin === 'L' ? 'L (Putra)' : 'P (Putri)'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{text(siswa.kamar)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800">
                          {text(siswa.status, 'Aktif')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end border-t border-slate-200 bg-slate-50/50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-slate-700 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
