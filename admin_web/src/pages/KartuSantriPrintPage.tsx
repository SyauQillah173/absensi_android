import {
  ArrowLeft,
  Check,
  CheckCheck,
  CreditCard,
  Filter,
  Layers,
  Printer,
  RotateCcw,
  Search,
  Sparkles,
  User,
  Users,
  X
} from 'lucide-react';
import QRCode from 'qrcode';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import qomaruddinLogo from '../assets/logo-qomaruddin.png';
import { api, type ApiRecord } from '../services/api';

interface KartuSantriPrintPageProps {
  onBack: () => void;
  initialSiswaId?: number;
}

function text(value: unknown, fallback = '-'): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export type ViewMode = 'single' | 'batch';
export type PrintSideMode = 'both' | 'front' | 'back';
export type PaperLayoutMode = 'ktp-cr80' | 'a4-sheet';

export function KartuSantriPrintPage({ onBack, initialSiswaId }: KartuSantriPrintPageProps) {
  const [students, setStudents] = useState<ApiRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tab Mode: 'single' (Cetak Satuan / Penggantian Kartu Hilang) vs 'batch' (Cetak Massal)
  const [viewMode, setViewMode] = useState<ViewMode>(initialSiswaId ? 'single' : 'single');

  // Santri terpilih untuk Mode Satuan
  const [singleSelectedId, setSingleSelectedId] = useState<number | null>(initialSiswaId ?? null);

  // Santri terpilih untuk Mode Massal
  const [batchSelectedIds, setBatchSelectedIds] = useState<number[]>([]);

  // Filter & Pencarian
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [complexFilter, setComplexFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'L' | 'P'>('all');

  // Pengaturan Cetak
  const [printSide, setPrintSide] = useState<PrintSideMode>('both');
  const [paperLayout, setPaperLayout] = useState<PaperLayoutMode>('ktp-cr80');

  // Load list santri dari backend
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const res = await api.siswa({ per_page: 2500, status: 'Aktif' });
        const list = Array.isArray(res.data) ? res.data : [];
        setStudents(list);

        if (initialSiswaId) {
          setSingleSelectedId(initialSiswaId);
          setBatchSelectedIds([initialSiswaId]);
        } else if (list.length > 0) {
          setSingleSelectedId(num(list[0].id));
          setBatchSelectedIds([num(list[0].id)]);
        }
      } catch (err) {
        console.error('Gagal memuat daftar santri untuk KTS:', err);
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [initialSiswaId]);

  // Ekstrak opsi kelas & komplek unik untuk dropdown filter
  const classOptions = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      const c = text(s.kelas, '').trim();
      if (c && c !== '-') set.add(c);
    });
    return Array.from(set).sort();
  }, [students]);

  const complexOptions = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      const c = text(s.komplek, '').trim();
      if (c && c !== '-') set.add(c);
    });
    return Array.from(set).sort();
  }, [students]);

  // Filter santri
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        text(s.nama).toLowerCase().includes(q) ||
        text(s.nis).toLowerCase().includes(q) ||
        text(s.kamar).toLowerCase().includes(q) ||
        text(s.komplek).toLowerCase().includes(q);

      const matchClass =
        classFilter === 'all' ||
        text(s.kelas).toLowerCase() === classFilter.toLowerCase();

      const matchComplex =
        complexFilter === 'all' ||
        text(s.komplek).toLowerCase() === complexFilter.toLowerCase();

      const jk = text(s.jenis_kelamin).toUpperCase();
      const isL = jk === 'L' || jk.includes('LAKI');
      const matchGender =
        genderFilter === 'all' || (genderFilter === 'L' ? isL : !isL);

      return matchSearch && matchClass && matchComplex && matchGender;
    });
  }, [students, search, classFilter, complexFilter, genderFilter]);

  // Santri yang sedang aktif dipilih pada Mode Satuan
  const singleStudent = useMemo(() => {
    if (!singleSelectedId) return filteredStudents[0] || students[0] || null;
    return students.find((s) => num(s.id) === singleSelectedId) || filteredStudents[0] || null;
  }, [students, singleSelectedId, filteredStudents]);

  // Santri yang siap dicetak
  const printStudents = useMemo(() => {
    if (viewMode === 'single') {
      return singleStudent ? [singleStudent] : [];
    }
    return students.filter((s) => batchSelectedIds.includes(num(s.id)));
  }, [viewMode, singleStudent, students, batchSelectedIds]);

  // Handler Mode Massal
  const handleToggleBatchStudent = (id: number) => {
    setBatchSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    const ids = filteredStudents.map((s) => num(s.id));
    setBatchSelectedIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const handleClearBatch = () => {
    setBatchSelectedIds([]);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* CSS KHUSUS PRINT: UKURAN FISIK KTP ASLI (85.6mm x 54mm)   */}
      {/* ========================================================= */}
      <style>{`
        @media print {
          @page {
            ${
              paperLayout === 'ktp-cr80'
                ? 'size: 85.6mm 54mm; margin: 0;'
                : 'size: A4 portrait; margin: 8mm;'
            }
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-hidden-area {
            display: none !important;
          }
          .kts-card-wrapper {
            width: 85.6mm !important;
            height: 54mm !important;
            min-width: 85.6mm !important;
            min-height: 54mm !important;
            max-width: 85.6mm !important;
            max-height: 54mm !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            border-radius: 3.18mm !important;
            ${
              paperLayout === 'ktp-cr80'
                ? 'page-break-after: always !important; break-after: page !important;'
                : 'break-inside: avoid !important;'
            }
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .a4-sheet-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 85.6mm) !important;
            gap: 4mm !important;
            justify-content: center !important;
            align-content: start !important;
          }
        }
      `}</style>

      {/* ========================================================= */}
      {/* HEADER & TOOLBAR ATAS (HILANG SAAT DI-PRINT)              */}
      {/* ========================================================= */}
      <div className="print-hidden-area bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-5">
        {/* Row 1: Judul Halaman & Tombol Cetak Utama */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
              title="Kembali"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#138F81]" />
                <h1 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
                  Studio Cetak Kartu Tanda Santri (KTS)
                </h1>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Standar ID Card Internasional CR-80 (85.6mm × 54mm). Pas untuk printer PVC card maupun potong plong.
              </p>
            </div>
          </div>

          {/* Action Print Button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              disabled={printStudents.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] px-6 py-3 text-xs sm:text-sm font-black text-white shadow-lg shadow-[#138F81]/25 transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer size={18} />
              <span>
                {viewMode === 'single'
                  ? 'Cetak Kartu Santri Ini (Ctrl + P)'
                  : `Cetak Massal (${printStudents.length} Santri)`}
              </span>
            </button>
          </div>
        </div>

        {/* Row 2: Tab Navigasi Mode (Satuan vs Massal) + Pengaturan Cetak */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
          {/* TAB MODE: SATUAN (HILANG KARTU) VS MASSAL */}
          <div className="inline-flex rounded-xl bg-white p-1 border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode('single')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                viewMode === 'single'
                  ? 'bg-[#138F81] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User size={15} />
              <span>👤 Cetak Satuan (Cari Santri / Kartu Hilang)</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('batch')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                viewMode === 'batch'
                  ? 'bg-[#138F81] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={15} />
              <span>👥 Cetak Massal ({batchSelectedIds.length} Dipilih)</span>
            </button>
          </div>

          {/* Pengaturan Sisi Kartu & Jenis Kertas */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Sisi Cetak */}
            <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-500">Sisi:</span>
              <select
                value={printSide}
                onChange={(e) => setPrintSide(e.target.value as PrintSideMode)}
                className="font-bold text-slate-800 outline-none bg-transparent cursor-pointer"
              >
                <option value="both">Depan & Belakang</option>
                <option value="front">Depan Saja</option>
                <option value="back">Belakang Saja</option>
              </select>
            </div>

            {/* Ukuran Kertas / Mesin */}
            <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-500">Kertas:</span>
              <select
                value={paperLayout}
                onChange={(e) => setPaperLayout(e.target.value as PaperLayoutMode)}
                className="font-bold text-slate-800 outline-none bg-transparent cursor-pointer"
              >
                <option value="ktp-cr80">💳 Ukuran KTP (85.6×54mm)</option>
                <option value="a4-sheet">📄 Grid Lembar A4</option>
              </select>
            </div>
          </div>
        </div>

        {/* Row 3: Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="relative flex items-center">
            <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
            <input
              type="text"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#138F81]"
              placeholder="Cari nama santri, NIS, kamar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-[#138F81]"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as 'all' | 'L' | 'P')}
            >
              <option value="all">Semua Gender (Pa/Pi)</option>
              <option value="L">👦 Santri Putra</option>
              <option value="P">👧 Santri Putri</option>
            </select>
          </div>

          <div>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-[#138F81]"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <option value="all">Semua Kelas Madin</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  Kelas {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-[#138F81]"
              value={complexFilter}
              onChange={(e) => setComplexFilter(e.target.value)}
            >
              <option value="all">Semua Komplek Pondok</option>
              {complexOptions.map((c) => (
                <option key={c} value={c}>
                  Komplek {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAMPILAN MODE 1: CETAK SATUAN (PREVIEW SATU PER SATU)     */}
      {/* ========================================================= */}
      {viewMode === 'single' && (
        <div className="print-hidden-area grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* KOLOM KIRI (4 SPAN): DAFTAR SANTRI UNTUK DIPILIH */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-4 shadow-sm flex flex-col h-[560px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                PILIH SANTRI ({filteredStudents.length})
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">
                Klik untuk lihat kartu
              </span>
            </div>

            <div className="flex-1 overflow-y-auto q-scrollbar divide-y divide-slate-100 pr-1 mt-2">
              {filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 font-semibold">
                  Santri tidak ditemukan dengan filter ini.
                </div>
              ) : (
                filteredStudents.map((s) => {
                  const isSelected = num(s.id) === (singleSelectedId ?? num(singleStudent?.id));
                  const isPutri = text(s.jenis_kelamin).includes('P');
                  return (
                    <button
                      key={text(s.id)}
                      type="button"
                      onClick={() => setSingleSelectedId(num(s.id))}
                      className={`w-full text-left p-3 rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-teal-50 border border-teal-200 shadow-xs'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base ${
                            isSelected ? 'bg-[#138F81] text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {isPutri ? '🧕' : '👳'}
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`text-xs font-black truncate uppercase leading-tight ${
                              isSelected ? 'text-[#0c6b61]' : 'text-slate-800'
                            }`}
                          >
                            {text(s.nama)}
                          </p>
                          <p className="text-[10.5px] text-slate-400 font-mono mt-0.5 truncate">
                            NIS: {text(s.nis)} • {text(s.kamar)}
                          </p>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="h-6 w-6 rounded-full bg-[#138F81] text-white flex items-center justify-center shrink-0">
                          <Check size={14} />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* KOLOM KANAN (8 SPAN): STUDIO PREVIEW KARTU KTP BESAR & BERSIH */}
          <div className="lg:col-span-8 bg-gradient-to-br from-slate-100 via-slate-50 to-teal-50/30 rounded-3xl border border-slate-200/90 p-6 flex flex-col items-center justify-center min-h-[560px] relative overflow-hidden shadow-inner">
            {singleStudent ? (
              <div className="space-y-5 w-full max-w-2xl flex flex-col items-center">
                {/* Badge Info Santri */}
                <div className="text-center space-y-1">
                  <span className="rounded-full bg-teal-100 text-teal-800 text-xs font-black px-3 py-1 uppercase tracking-wider inline-flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-500" />
                    <span>PREVIEW KARTU RESMI (UKURAN KTP ASLI)</span>
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-tight">
                    {text(singleStudent.nama)}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    NIS: <span className="font-mono font-bold text-slate-700">{text(singleStudent.nis)}</span> • Kamar:{' '}
                    <span className="font-bold text-slate-700">{text(singleStudent.kamar)} ({text(singleStudent.komplek)})</span>
                  </p>
                </div>

                {/* AREA MOCKUP KARTU KTP BERDAMPINGAN (FRONT & BACK) */}
                <div className="flex flex-wrap items-center justify-center gap-6 p-4">
                  {/* Sisi Depan */}
                  {(printSide === 'both' || printSide === 'front') && (
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                        SISI DEPAN (FRONT)
                      </span>
                      <div className="shadow-2xl rounded-[3.18mm] overflow-hidden border border-slate-300">
                        <KtsFrontCard student={singleStudent} />
                      </div>
                    </div>
                  )}

                  {/* Sisi Belakang */}
                  {(printSide === 'both' || printSide === 'back') && (
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                        SISI BELAKANG (BACK)
                      </span>
                      <div className="shadow-2xl rounded-[3.18mm] overflow-hidden border border-slate-300">
                        <KtsBackCard student={singleStudent} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Cetak Cepat untuk Santri Ini */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] px-6 py-3 text-xs sm:text-sm font-black text-white shadow-md shadow-[#138F81]/25 transition-all cursor-pointer"
                  >
                    <Printer size={16} />
                    <span>Cetak Kartu {text(singleStudent.nama).split(' ')[0]} Sekarang (Ctrl + P)</span>
                  </button>
                  <p className="text-[11px] text-slate-400 mt-2">
                    💡 Tips: Jika santri kehilangan kartu, cukup cetak kartu santri bersangkutan di halaman ini.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 font-bold text-sm">
                Pilih santri di daftar sebelah kiri untuk melihat kartu.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAMPILAN MODE 2: CETAK MASSAL (BANYAK SANTRI / BATCH)     */}
      {/* ========================================================= */}
      {viewMode === 'batch' && (
        <div className="print-hidden-area bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
          {/* Action Bar Pemilihan Santri */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <span>Daftar Pilihan Santri Siap Cetak</span>
                <span className="rounded-full bg-teal-100 text-[#138F81] text-xs font-black px-2.5 py-0.5">
                  {batchSelectedIds.length} Terpilih
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Centang santri yang ingin dicetak massal sekaligus ke printer ID Card atau kertas A4.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="rounded-xl bg-teal-50 border border-teal-200 px-3.5 py-2 text-xs font-black text-[#138F81] hover:bg-teal-100 transition-colors cursor-pointer"
              >
                ✓ Pilih Semua ({filteredStudents.length})
              </button>
              {batchSelectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearBatch}
                  className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  ✕ Kosongkan
                </button>
              )}
            </div>
          </div>

          {/* Grid Santri untuk Dicentang */}
          <div className="max-h-80 overflow-y-auto q-scrollbar grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 p-1">
            {filteredStudents.map((s) => {
              const isChecked = batchSelectedIds.includes(num(s.id));
              const isPutri = text(s.jenis_kelamin).includes('P');
              return (
                <div
                  key={text(s.id)}
                  onClick={() => handleToggleBatchStudent(num(s.id))}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 select-none ${
                    isChecked
                      ? 'border-[#138F81] bg-teal-50/70 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{isPutri ? '🧕' : '👳'}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-slate-800 truncate uppercase">
                        {text(s.nama)}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        NIS: {text(s.nis)} • {text(s.kamar)}
                      </p>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // Controlled by div click
                    className="h-4 w-4 rounded text-[#138F81] focus:ring-[#138F81] cursor-pointer"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* AREA RENDER DOKUMEN CETAK (HANYA MUNCUL SAAT PRINT)       */}
      {/* ========================================================= */}
      <div className="hidden print:block">
        {printStudents.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Tidak ada kartu yang dipilih.</div>
        ) : paperLayout === 'ktp-cr80' ? (
          /* Mode 1: 1 Halaman per Kartu (Printer Kartu PVC / CR-80) */
          <div>
            {printStudents.map((student) => (
              <React.Fragment key={text(student.id)}>
                {(printSide === 'both' || printSide === 'front') && (
                  <div className="kts-card-wrapper">
                    <KtsFrontCard student={student} />
                  </div>
                )}
                {(printSide === 'both' || printSide === 'back') && (
                  <div className="kts-card-wrapper">
                    <KtsBackCard student={student} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        ) : (
          /* Mode 2: Grid Lembar A4 Siap Potong */
          <div className="a4-sheet-grid">
            {printStudents.map((student) => (
              <React.Fragment key={text(student.id)}>
                {(printSide === 'both' || printSide === 'front') && (
                  <div className="kts-card-wrapper border border-dashed border-slate-300">
                    <KtsFrontCard student={student} />
                  </div>
                )}
                {(printSide === 'both' || printSide === 'back') && (
                  <div className="kts-card-wrapper border border-dashed border-slate-300">
                    <KtsBackCard student={student} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// SISI DEPAN KARTU TANDA SANTRI (KTS) RESMI
// Dimensi: 85.6mm x 54mm (Ukuran KTP Standar Internasional ISO/IEC 7810 ID-1)
// =====================================================================
function KtsFrontCard({ student }: { student: ApiRecord }) {
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrCodeValue = `QOMAR-${num(student.id)}-${text(student.nis, '0')}`;

  useEffect(() => {
    if (qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, qrCodeValue, {
        width: 62,
        margin: 0,
        color: {
          dark: '#0a423d',
          light: '#ffffff'
        }
      }).catch((err) => console.error('QR Render Error:', err));
    }
  }, [qrCodeValue]);

  const nama = text(student.nama, 'Nama Santri');
  const nis = text(student.nis, '-');
  const ttl = `${text(student.tempat_lahir, '')}${student.tempat_lahir && student.tanggal_lahir ? ', ' : ''}${text(student.tanggal_lahir, '-')}`;
  const kamar = text(student.kamar, '-');
  const komplek = text(student.komplek, '-');
  const alamat = `${text(student.kecamatan, '')}${student.kecamatan && student.kota ? ', ' : ''}${text(student.kota, text(student.alamat, '-'))}`;
  const wali = text(student.nama_wali, text(student.nama_ayah, '-'));
  const isPutri = text(student.jenis_kelamin).includes('P') || text(student.jenis_kelamin).toUpperCase() === 'PEREMPUAN';

  return (
    <div
      style={{
        width: '85.6mm',
        height: '54mm',
        borderRadius: '3.18mm',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
      className="relative bg-gradient-to-br from-[#0c6b61] via-[#138F81] to-[#0a4f47] text-white p-2.5 shadow-md border border-teal-600 flex flex-col justify-between overflow-hidden print:shadow-none print:border-slate-300 select-none box-border"
    >
      {/* Ornamen Latar Belakang Islami Halus */}
      <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/5 pointer-events-none blur-xs" />
      <div className="absolute left-1/3 -top-10 w-36 h-36 rounded-full bg-amber-400/10 pointer-events-none blur-xs" />

      {/* 1. KOP RESMI PESANTREN (UKURAN KTP) */}
      <div className="flex items-center gap-1.5 border-b border-white/20 pb-1 shrink-0">
        <img
          src={qomaruddinLogo}
          alt="Logo Qomaruddin"
          className="h-7 w-7 rounded-md bg-white p-0.5 object-contain shrink-0 shadow-2xs"
        />
        <div className="min-w-0 flex-1 leading-none">
          <p className="text-[6.5px] uppercase tracking-wider font-black text-amber-300">
            YAYASAN PONDOK PESANTREN
          </p>
          <h3 className="text-[9.5px] font-black tracking-tight text-white uppercase mt-0.5">
            QOMARUDDIN SAMPURNAN
          </h3>
          <p className="text-[6px] text-teal-100 font-semibold tracking-tight mt-0.5">
            KARTU TANDA SANTRI (KTS) & PRESENSI RESMI
          </p>
        </div>
      </div>

      {/* 2. BODY KARTU: FOTO + BIODATA LENGKAP KTP + QR CODE */}
      <div className="flex items-center gap-2 my-auto pt-0.5">
        {/* Pas Foto Santri (Standar Rasio KTP) */}
        <div className="flex flex-col items-center shrink-0">
          <div className="w-[19mm] h-[25mm] rounded-lg border border-amber-300/80 bg-slate-100 overflow-hidden shadow-xs flex items-center justify-center">
            {student.foto_santri ? (
              <img
                src={String(student.foto_santri)}
                alt={nama}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 text-center">
                <span className="text-xl">{isPutri ? '🧕' : '👳‍♂️'}</span>
              </div>
            )}
          </div>
          <span className="mt-0.5 text-[6px] font-black uppercase text-amber-200 tracking-wider bg-black/25 px-1 py-0.2 rounded">
            {isPutri ? 'SANTRI PI' : 'SANTRI PA'}
          </span>
        </div>

        {/* Tabel Biodata Presisi KTP */}
        <div className="flex-1 min-w-0 text-[7.5px] leading-tight space-y-0.5">
          <p className="font-black text-[9px] text-amber-200 uppercase truncate leading-tight pb-0.5">
            {nama}
          </p>

          <div className="grid grid-cols-[38px_auto] gap-x-0.5 text-teal-50">
            <span className="font-semibold text-teal-200">NIS</span>
            <span className="font-mono font-bold text-white">: {nis}</span>

            <span className="font-semibold text-teal-200">TTL</span>
            <span className="font-medium text-white truncate">: {ttl}</span>

            <span className="font-semibold text-teal-200">Kamar</span>
            <span className="font-bold text-amber-100 truncate">: {kamar} ({komplek})</span>

            <span className="font-semibold text-teal-200">Alamat</span>
            <span className="font-medium text-white truncate">: {alamat}</span>

            <span className="font-semibold text-teal-200">Wali</span>
            <span className="font-medium text-white truncate">: {wali}</span>
          </div>
        </div>

        {/* Barcode QR Code Presisi Sholat */}
        <div className="shrink-0 flex flex-col items-center bg-white p-0.5 rounded-lg shadow-2xs border border-teal-800/20">
          <canvas ref={qrCanvasRef} className="w-[16mm] h-[16mm] rounded" />
          <span className="text-[5.5px] font-black text-slate-800 tracking-tighter uppercase mt-0.5">
            SCAN SHOLAT
          </span>
        </div>
      </div>

      {/* 3. FOOTER KARTU KTP */}
      <div className="flex items-center justify-between border-t border-white/20 pt-0.5 text-[6.5px] text-teal-100 shrink-0">
        <span className="font-medium tracking-wide">Sampurnan, Bungah, Gresik</span>
        <span className="font-mono font-bold text-amber-200">ID: {num(student.id)}</span>
      </div>
    </div>
  );
}

// =====================================================================
// SISI BELAKANG KARTU TANDA SANTRI (KTS)
// Dimensi: 85.6mm x 54mm (Tata Tertib & Pengesahan Pesantren)
// =====================================================================
function KtsBackCard({ student }: { student: ApiRecord }) {
  return (
    <div
      style={{
        width: '85.6mm',
        height: '54mm',
        borderRadius: '3.18mm',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
      className="relative bg-white text-slate-800 p-2.5 shadow-md border border-slate-200 flex flex-col justify-between overflow-hidden print:shadow-none print:border-slate-300 select-none box-border"
    >
      <div>
        <div className="text-center border-b border-slate-200 pb-0.5">
          <h4 className="text-[8px] font-black uppercase text-[#138F81] tracking-wider">
            TATA TERTIB & KETENTUAN KTS
          </h4>
          <p className="text-[6px] text-slate-500 font-semibold">
            Pondok Pesantren Qomaruddin Sampurnan Bungah
          </p>
        </div>

        <ol className="list-decimal list-inside text-[6.8px] text-slate-600 space-y-0.5 mt-1 leading-snug font-medium">
          <li>Kartu ini identitas resmi santri Pondok Pesantren Qomaruddin.</li>
          <li>Wajib dibawa setiap Sholat Berjamaah 5 Waktu & KBM Madin.</li>
          <li>Pindai QR Code di meja pos pengurus sebelum masuk masjid.</li>
          <li>Dilarang menitipkan atau meminjamkan kartu ke santri lain.</li>
          <li>Jika kartu hilang, segera lapor bagian keamanan pesantren.</li>
        </ol>
      </div>

      {/* Bagian Pengesahan & Stempel */}
      <div className="flex items-end justify-between border-t border-slate-200 pt-0.5 text-[6.5px]">
        <div>
          <p className="text-[5.5px] text-slate-400 font-semibold">
            Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <p className="font-mono font-bold text-slate-600 text-[6.5px]">
            NIS: {text(student.nis, '-')}
          </p>
        </div>

        <div className="text-center leading-tight">
          <p className="text-[6px] text-slate-500">Pengasuh / Keamanan,</p>
          <div className="h-4 flex items-center justify-center">
            <span className="text-[7.5px] font-black text-teal-800 tracking-wider font-serif">
              [ STEMPEL RESMI ]
            </span>
          </div>
          <p className="font-black text-slate-800 text-[6.5px] underline">
            PP. Qomaruddin
          </p>
        </div>
      </div>
    </div>
  );
}
