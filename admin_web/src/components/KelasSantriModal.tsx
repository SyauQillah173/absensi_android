import {
  Check,
  CheckCircle2,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  X,
  AlertCircle,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { api, type ApiRecord } from '../services/api';

interface KelasSantriModalProps {
  targetClass: ApiRecord;
  onClose: () => void;
  onUpdated: () => void;
}

function text(value: unknown, fallback = '-'): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function KelasSantriModal({ targetClass, onClose, onUpdated }: KelasSantriModalProps) {
  const classId = num(targetClass.id);
  const className = text(targetClass.name);
  const rawGenderGroup = String(targetClass.gender_group || '').toUpperCase();
  const isPa = rawGenderGroup === 'PA';
  const isPi = rawGenderGroup === 'PI';

  const [activeTab, setActiveTab] = useState<'members' | 'add'>('members');
  const [members, setMembers] = useState<ApiRecord[]>([]);
  const [allStudents, setAllStudents] = useState<ApiRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Search & Filter
  const [searchMember, setSearchMember] = useState('');
  const [searchAvailable, setSearchAvailable] = useState('');
  const [genderFilterAdd, setGenderFilterAdd] = useState<'all' | 'L' | 'P'>(() => {
    if (isPa) return 'L';
    if (isPi) return 'P';
    return 'all';
  });
  const [onlyNoClass, setOnlyNoClass] = useState(true);

  // Selected students for bulk adding
  const [selectedToAdd, setSelectedToAdd] = useState<number[]>([]);

  async function loadData() {
    setIsLoading(true);
    setError('');
    try {
      const [membersRes, allRes] = await Promise.all([
        api.siswa({ class_id: classId, status: 'Aktif' }),
        api.siswa({ status: 'Aktif' }),
      ]);
      setMembers(Array.isArray(membersRes.data) ? membersRes.data : []);
      setAllStudents(Array.isArray(allRes.data) ? allRes.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data santri.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  // Filtered members
  const filteredMembers = useMemo(() => {
    const q = searchMember.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const nama = String(m.nama || '').toLowerCase();
      const nis = String(m.nis || '').toLowerCase();
      return nama.includes(q) || nis.includes(q);
    });
  }, [members, searchMember]);

  // Available students to add (not in current class)
  const availableStudents = useMemo(() => {
    const memberIds = new Set(members.map((m) => num(m.id)));
    let list = allStudents.filter((s) => !memberIds.has(num(s.id)));

    if (onlyNoClass) {
      list = list.filter((s) => !s.class_id || num(s.class_id) === 0);
    }

    if (genderFilterAdd !== 'all') {
      list = list.filter((s) => String(s.jenis_kelamin || '').toUpperCase() === genderFilterAdd);
    }

    const q = searchAvailable.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) => {
      const nama = String(s.nama || '').toLowerCase();
      const nis = String(s.nis || '').toLowerCase();
      const kelas = String(s.kelas || '').toLowerCase();
      return nama.includes(q) || nis.includes(q) || kelas.includes(q);
    });
  }, [allStudents, members, onlyNoClass, genderFilterAdd, searchAvailable]);

  // Toggle selection
  const toggleSelect = (id: number) => {
    setSelectedToAdd((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedToAdd.length === availableStudents.length) {
      setSelectedToAdd([]);
    } else {
      setSelectedToAdd(availableStudents.map((s) => num(s.id)));
    }
  };

  // Add selected students to class
  async function handleAddSelected() {
    if (selectedToAdd.length === 0 || isProcessing) return;
    setIsProcessing(true);
    setError('');
    setNotice('');
    try {
      await Promise.all(
        selectedToAdd.map((sId) =>
          api.updateSiswa(sId, {
            class_id: classId,
            kelas: className,
          })
        )
      );
      setNotice(`Berhasil memasukkan ${selectedToAdd.length} santri ke kelas ${className}!`);
      setSelectedToAdd([]);
      await loadData();
      onUpdated();
      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'kelas' } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memasukkan santri ke kelas.');
    } finally {
      setIsProcessing(false);
    }
  }

  // Remove single student from class
  async function handleRemove(sId: number, sName: string) {
    if (!confirm(`Keluarkan ${sName} dari kelas ${className}?`) || isProcessing) return;
    setIsProcessing(true);
    setError('');
    setNotice('');
    try {
      await api.updateSiswa(sId, {
        class_id: null,
        kelas: '',
      });
      setNotice(`${sName} berhasil dikeluarkan dari kelas.`);
      await loadData();
      onUpdated();
      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'kelas' } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengeluarkan santri.');
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 sm:px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-[#138F81] border border-teal-100 font-black">
              <Users size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-800">
                  Anggota Kelas: <span className="text-[#138F81]">{className}</span>
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                    isPa
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : isPi
                      ? 'bg-pink-50 text-pink-700 border-pink-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {isPa ? '👦 Madin Putra (PA)' : isPi ? '🧕 Madin Putri (PI)' : '👥 Campur'}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Total {members.length} santri terdaftar di rombel ini
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-5 sm:px-6 shrink-0 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`py-3 text-xs sm:text-sm font-extrabold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'members'
                ? 'border-[#138F81] text-[#138F81]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck size={16} />
            Daftar Santri Kelas ({members.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('add')}
            className={`py-3 text-xs sm:text-sm font-extrabold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'add'
                ? 'border-[#138F81] text-[#138F81]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus size={16} />
            + Masukkan Santri ke Kelas Ini
          </button>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="mx-6 mt-3 rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-800 flex items-center gap-2 shrink-0">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="mx-6 mt-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-800 flex items-center gap-2 shrink-0">
            <CheckCircle2 size={16} />
            <span>{notice}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {isLoading ? (
            <div className="py-12 text-center text-sm font-bold text-slate-400">
              <RefreshCw className="animate-spin inline-block mr-2" size={16} />
              Memuat data santri...
            </div>
          ) : activeTab === 'members' ? (
            /* TAB 1: MEMBERS LIST */
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchMember}
                    onChange={(e) => setSearchMember(e.target.value)}
                    placeholder="Cari santri di kelas ini..."
                    className="q-input pl-8 py-2 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('add')}
                  className="rounded-xl bg-[#138F81] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#0D7A6F] transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus size={14} /> + Tambah Santri
                </button>
              </div>

              {filteredMembers.length === 0 ? (
                <div className="py-12 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200">
                  <p className="text-sm font-bold text-slate-500">
                    {searchMember ? 'Santri tidak ditemukan.' : 'Belum ada santri yang dimasukkan ke kelas ini.'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Klik tab "+ Masukkan Santri" di atas untuk menambahkan santri ke rombel ini.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-200">
                      <tr>
                        <th className="p-3 w-10 text-center">#</th>
                        <th className="p-3">NIS</th>
                        <th className="p-3">Nama Santri</th>
                        <th className="p-3">Gender</th>
                        <th className="p-3">Asal / Kota</th>
                        <th className="p-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMembers.map((student, idx) => {
                        const sGender = String(student.jenis_kelamin || 'L').toUpperCase();
                        const sIsL = sGender === 'L';
                        return (
                          <tr key={num(student.id)} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                            <td className="p-3 font-mono font-bold text-slate-600">{text(student.nis)}</td>
                            <td className="p-3 font-extrabold text-slate-800">{text(student.nama)}</td>
                            <td className="p-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                  sIsL
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-pink-50 text-pink-700 border-pink-200'
                                }`}
                              >
                                {sIsL ? '👦 Laki-laki' : '👧 Perempuan'}
                              </span>
                            </td>
                            <td className="p-3 text-slate-500 font-medium">
                              {text(student.kota ?? student.kabupaten ?? student.alamat)}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleRemove(num(student.id), text(student.nama))}
                                className="rounded-xl bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-500 hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                title="Keluarkan dari kelas"
                              >
                                <Trash2 size={12} /> Keluarkan
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: ADD STUDENTS */
            <div className="space-y-4">
              {/* Controls bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="relative flex-1 min-w-[220px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchAvailable}
                    onChange={(e) => setSearchAvailable(e.target.value)}
                    placeholder="Cari santri berdasarkan nama / NIS..."
                    className="q-input pl-8 py-1.5 text-xs bg-white"
                  />
                </div>

                {/* Filter Gender */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500">Gender:</span>
                  {(['all', 'L', 'P'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGenderFilterAdd(g)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                        genderFilterAdd === g
                          ? 'bg-[#138F81] text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {g === 'all' ? 'Semua' : g === 'L' ? '👦 Putra (L)' : '👧 Putri (P)'}
                    </button>
                  ))}
                </div>

                {/* Checkbox only no class */}
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyNoClass}
                    onChange={(e) => setOnlyNoClass(e.target.checked)}
                    className="rounded text-[#138F81] focus:ring-0"
                  />
                  Hanya yang belum ada kelas
                </label>
              </div>

              {/* Table of available students */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={availableStudents.length > 0 && selectedToAdd.length === availableStudents.length}
                          onChange={toggleSelectAll}
                          className="rounded text-[#138F81]"
                        />
                      </th>
                      <th className="p-3">NIS</th>
                      <th className="p-3">Nama Santri</th>
                      <th className="p-3">Gender</th>
                      <th className="p-3">Kelas Saat Ini</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {availableStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">
                          Tidak ada santri yang sesuai kriteria pencarian.
                        </td>
                      </tr>
                    ) : (
                      availableStudents.slice(0, 100).map((student) => {
                        const sId = num(student.id);
                        const isSelected = selectedToAdd.includes(sId);
                        const sGender = String(student.jenis_kelamin || 'L').toUpperCase();
                        const sIsL = sGender === 'L';
                        return (
                          <tr
                            key={sId}
                            onClick={() => toggleSelect(sId)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-teal-50/70 font-semibold' : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(sId)}
                                className="rounded text-[#138F81]"
                              />
                            </td>
                            <td className="p-3 font-mono font-bold text-slate-600">{text(student.nis)}</td>
                            <td className="p-3 font-extrabold text-slate-800">{text(student.nama)}</td>
                            <td className="p-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                  sIsL
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-pink-50 text-pink-700 border-pink-200'
                                }`}
                              >
                                {sIsL ? '👦 L' : '👧 P'}
                              </span>
                            </td>
                            <td className="p-3 text-slate-500 font-medium">
                              {text(student.kelas ?? (student.class as ApiRecord)?.name, 'Belum ada')}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {availableStudents.length > 100 && (
                <p className="text-[11px] text-slate-400 text-center font-semibold">
                  Menampilkan 100 dari {availableStudents.length} santri. Gunakan pencarian untuk menyaring lebih spesifik.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 px-5 sm:px-6 py-3.5 bg-slate-50/70 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-500">
            {activeTab === 'add' && selectedToAdd.length > 0 ? (
              <span className="text-[#138F81] font-black">{selectedToAdd.length} santri dipilih</span>
            ) : (
              <span>Rombel: {className}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Tutup
            </button>
            {activeTab === 'add' && (
              <button
                type="button"
                disabled={selectedToAdd.length === 0 || isProcessing}
                onClick={() => void handleAddSelected()}
                className="rounded-xl bg-[#138F81] px-4 py-2 text-xs font-extrabold text-white shadow-md shadow-[#138F81]/20 hover:bg-[#0D7A6F] transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Check size={14} />
                {isProcessing ? 'Memproses...' : `Masukkan ${selectedToAdd.length} Santri ke Kelas Ini`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
