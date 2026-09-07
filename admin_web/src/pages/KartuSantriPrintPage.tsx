import { ArrowLeft, Check, CreditCard, Layers, Printer, Search } from 'lucide-react';
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

export type PrintPageMode = 'ktp-cr80' | 'a4-sheet';

export function KartuSantriPrintPage({ onBack, initialSiswaId }: KartuSantriPrintPageProps) {
  const [students, setStudents] = useState<ApiRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>(initialSiswaId ? [initialSiswaId] : []);
  const [search, setSearch] = useState('');
  const [complexFilter, setComplexFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'L' | 'P'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [includeBackside, setIncludeBackside] = useState(true);
  const [printLayout, setPrintLayout] = useState<PrintPageMode>(initialSiswaId ? 'ktp-cr80' : 'ktp-cr80');

  // Load list santri
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const res = await api.siswa({ per_page: 2000 });
        const list = Array.isArray(res.data) ? res.data : [];
        setStudents(list);
        if (!initialSiswaId && list.length > 0) {
          // Default pilih 1 santri pertama jika belum ada
          setSelectedIds([num(list[0].id)]);
        }
      } catch (err) {
        console.error('Gagal memuat daftar santri untuk KTS:', err);
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [initialSiswaId]);

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

      const matchComplex =
        complexFilter === 'all' ||
        text(s.komplek).toLowerCase().includes(complexFilter.toLowerCase());

      const jk = text(s.jenis_kelamin).toUpperCase();
      const isL = jk === 'L' || jk.includes('LAKI');
      const matchGender =
        genderFilter === 'all' || (genderFilter === 'L' ? isL : !isL);

      return matchSearch && matchComplex && matchGender;
    });
  }, [students, search, complexFilter, genderFilter]);

  // Santri yang siap dicetak
  const printStudents = useMemo(() => {
    return students.filter((s) => selectedIds.includes(num(s.id)));
  }, [students, selectedIds]);

  const handleToggleStudent = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    const ids = filteredStudents.map((s) => num(s.id));
    setSelectedIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const handleClearSelected = () => {
    setSelectedIds([]);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* CSS KHUSUS PRINT: MENGATUR UKURAN CETAK STANDAR KTP (CR-80: 85.6mm x 54mm) ATAU SHEET A4 */}
      <style>{`
        @media print {
          @page {
            ${
              printLayout === 'ktp-cr80'
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
          .kts-card-print {
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
              printLayout === 'ktp-cr80'
                ? 'page-break-after: always !important; break-after: page !important;'
                : 'break-inside: avoid !important;'
            }
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .a4-grid-container {
            display: grid !important;
            grid-template-columns: repeat(2, 85.6mm) !important;
            gap: 4mm !important;
            justify-content: center !important;
          }
        }
      `}</style>

      {/* TOOLBAR ATAS (HILANG SAAT DI-PRINT) */}
      <div className="print:hidden bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
              title="Kembali"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                <span>🪪 Cetak Kartu Tanda Santri (Ukuran KTP Standar)</span>
                <span className="rounded-full bg-teal-100 text-teal-800 text-xs font-black px-2.5 py-0.5">
                  {printStudents.length} Santri
                </span>
              </h1>
              <p className="text-xs font-medium text-slate-500">
                Dimensi fisik presisi KTP/ID Card (85.6mm × 54mm). Pas untuk printer PVC card maupun potong plong.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Pilihan Layout Kertas / Mesin Cetak */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setPrintLayout('ktp-cr80')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  printLayout === 'ktp-cr80'
                    ? 'bg-white text-[#138F81] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Satu kartu per lembar pas ukuran KTP / Printer PVC"
              >
                <CreditCard size={14} />
                <span>Ukuran KTP (85.6×54mm)</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout('a4-sheet')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  printLayout === 'a4-sheet'
                    ? 'bg-white text-[#138F81] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Banyak kartu dalam 1 kertas A4 siap potong"
              >
                <Layers size={14} />
                <span>Grid Lembar A4</span>
              </button>
            </div>

            {/* Sertakan Sisi Belakang */}
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeBackside}
                onChange={(e) => setIncludeBackside(e.target.checked)}
                className="h-4 w-4 rounded text-[#138F81] focus:ring-[#138F81]"
              />
              <span>Sisi Belakang (Tata Tertib)</span>
            </label>

            {/* Tombol Cetak Sekarang */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={printStudents.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-[#138F81]/25 transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer size={16} />
              <span>Cetak Sekarang (Ctrl + P)</span>
            </button>
          </div>
        </div>

        {/* Filter & Pemilihan Santri Massal */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2 relative flex items-center">
            <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
            <input
              type="text"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#138F81]"
              placeholder="Cari nama santri, NIS, atau kamar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-bold text-slate-700 outline-none focus:border-[#138F81]"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as 'all' | 'L' | 'P')}
            >
              <option value="all">Semua Santri (Pa/Pi)</option>
              <option value="L">👦 Santri Putra</option>
              <option value="P">👧 Santri Putri</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="flex-1 rounded-xl bg-teal-50 border border-teal-200 px-3 py-2 text-xs font-black text-[#138F81] hover:bg-teal-100 transition-colors cursor-pointer"
            >
              ✓ Pilih Semua ({filteredStudents.length})
            </button>
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={handleClearSelected}
                className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                ✕ Kosongkan
              </button>
            )}
          </div>
        </div>

        {/* Quick Select Pills Santri */}
        <div className="max-h-32 overflow-y-auto q-scrollbar flex flex-wrap gap-1.5 p-2 bg-slate-50/80 rounded-2xl border border-slate-200/70">
          {filteredStudents.map((s) => {
            const isChecked = selectedIds.includes(num(s.id));
            return (
              <button
                key={text(s.id)}
                type="button"
                onClick={() => handleToggleStudent(num(s.id))}
                className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-extrabold border transition-all cursor-pointer select-none ${
                  isChecked
                    ? 'border-[#138F81] bg-teal-50 text-teal-900 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <span>{text(s.jenis_kelamin).includes('P') ? '👧' : '👦'}</span>
                <span>{text(s.nama)}</span>
                {isChecked && <Check size={12} className="text-[#138F81]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* AREA KERTAS CETAK (LAYOUT CETAK STANDAR UKURAN KTP)        */}
      {/* ========================================================= */}
      {printStudents.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 font-bold text-sm">
          Silakan centang santri di atas untuk menampilkan kartu santri yang akan dicetak.
        </div>
      ) : (
        <div className="print:p-0 print:m-0 flex flex-col items-center">
          <div
            className={
              printLayout === 'ktp-cr80'
                ? 'flex flex-col items-center gap-6 print:block print:gap-0'
                : 'a4-grid-container grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-2'
            }
          >
            {printStudents.map((student) => (
              <React.Fragment key={text(student.id)}>
                <div className="kts-card-print">
                  <KtsFrontCard student={student} />
                </div>
                {includeBackside && (
                  <div className="kts-card-print">
                    <KtsBackCard student={student} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
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
        width: 60,
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
