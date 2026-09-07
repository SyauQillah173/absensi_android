import { ArrowLeft, Check, Download, Filter, Printer, QrCode, Search, Sparkles, UserCheck } from 'lucide-react';
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

export function KartuSantriPrintPage({ onBack, initialSiswaId }: KartuSantriPrintPageProps) {
  const [students, setStudents] = useState<ApiRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>(initialSiswaId ? [initialSiswaId] : []);
  const [search, setSearch] = useState('');
  const [complexFilter, setComplexFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'L' | 'P'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [includeBackside, setIncludeBackside] = useState(true);

  // Load list santri
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const res = await api.siswa({ per_page: 1500 });
        const list = Array.isArray(res.data) ? res.data : [];
        setStudents(list);
        if (!initialSiswaId && list.length > 0) {
          // Default pilih 8 santri pertama untuk preview A4
          setSelectedIds(list.slice(0, 8).map((s) => num(s.id)));
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
      {/* TOOLBAR ATAS (HILANG SAAT DI-PRINT) */}
      <div className="print:hidden bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
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
                <span>🪪 Cetak Kartu Tanda Santri (KTS) Resmi</span>
                <span className="rounded-full bg-teal-100 text-teal-800 text-xs font-black px-2.5 py-0.5">
                  {printStudents.length} Santri Dipilih
                </span>
              </h1>
              <p className="text-xs font-medium text-slate-500">
                Kartu resmi dilengkapi Barcode/QR untuk Presensi Mandiri Sholat & KBM Pondok Pesantren Qomaruddin.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeBackside}
                onChange={(e) => setIncludeBackside(e.target.checked)}
                className="h-4 w-4 rounded text-[#138F81] focus:ring-[#138F81]"
              />
              <span>Sertakan Sisi Belakang (Tata Tertib)</span>
            </label>

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
              <option value="all">Semua Gender</option>
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

        {/* Quick Check Pills Santri */}
        <div className="max-h-36 overflow-y-auto q-scrollbar flex flex-wrap gap-1.5 p-2 bg-slate-50/80 rounded-2xl border border-slate-200/70">
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
      {/* AREA KERTAS CETAK (LAYOUT CETAK RESMI A4 / MULTI-CARD)    */}
      {/* ========================================================= */}
      {printStudents.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 font-bold text-sm">
          Silakan centang santri di atas untuk menampilkan kartu santri yang akan dicetak.
        </div>
      ) : (
        <div className="print:p-0 print:m-0 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4 print:grid-cols-2 print:gap-3 print:space-y-0">
            {printStudents.map((student) => (
              <React.Fragment key={text(student.id)}>
                <KtsFrontCard student={student} />
                {includeBackside && <KtsBackCard student={student} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================
// SISI DEPAN KARTU TANDA SANTRI (KTS) RESMI
// =========================================================
function KtsFrontCard({ student }: { student: ApiRecord }) {
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrCodeValue = `QOMAR-${num(student.id)}-${text(student.nis, '0')}`;

  useEffect(() => {
    if (qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, qrCodeValue, {
        width: 80,
        margin: 1,
        color: {
          dark: '#0f4c45',
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
    <div className="relative w-[345px] h-[218px] sm:w-[350px] sm:h-[220px] rounded-2xl bg-gradient-to-br from-[#0c6b61] via-[#138F81] to-[#0A5A52] text-white p-3 shadow-md border border-teal-600 flex flex-col justify-between overflow-hidden print:shadow-none print:border-slate-300 print:break-inside-avoid">
      {/* Ornamen Latar Belakang Islami Lembut */}
      <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none blur-sm" />
      <div className="absolute left-1/2 -top-12 w-40 h-40 rounded-full bg-amber-400/10 pointer-events-none blur-sm" />

      {/* 1. KOP RESMI PESANTREN */}
      <div className="flex items-center gap-2 border-b border-white/20 pb-1.5 shrink-0">
        <img
          src={qomaruddinLogo}
          alt="Logo Qomaruddin"
          className="h-9 w-9 rounded-lg bg-white p-0.5 object-contain shrink-0 shadow-2xs"
        />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[8px] uppercase tracking-widest font-black text-amber-300">
            YAYASAN PONDOK PESANTREN
          </p>
          <h3 className="text-[12px] font-black tracking-tight text-white uppercase">
            QOMARUDDIN SAMPURNAN
          </h3>
          <p className="text-[7.5px] text-teal-100 font-semibold tracking-wide">
            KARTU TANDA SANTRI (KTS) & PRESENSI RESMI
          </p>
        </div>
      </div>

      {/* 2. BODY KARTU: FOTO + BIODATA LENGKAP + QR CODE */}
      <div className="flex items-start gap-2.5 my-auto pt-1">
        {/* Foto Santri */}
        <div className="flex flex-col items-center shrink-0">
          <div className="w-[62px] h-[78px] rounded-xl border-2 border-amber-300/80 bg-slate-100 overflow-hidden shadow-sm flex items-center justify-center">
            {student.foto_santri ? (
              <img
                src={String(student.foto_santri)}
                alt={nama}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 p-1 text-center">
                <span className="text-2xl">{isPutri ? '🧕' : '👳‍♂️'}</span>
              </div>
            )}
          </div>
          <span className="mt-1 text-[7.5px] font-black uppercase text-amber-200 tracking-wider bg-black/20 px-1.5 py-0.2 rounded">
            {isPutri ? 'SANTRI PI' : 'SANTRI PA'}
          </span>
        </div>

        {/* Tabel Biodata Lengkap */}
        <div className="flex-1 min-w-0 text-[9px] leading-tight space-y-0.5">
          <p className="font-black text-[11px] text-amber-200 uppercase truncate leading-none pb-0.5">
            {nama}
          </p>

          <div className="grid grid-cols-[55px_auto] gap-x-1 text-teal-50">
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

        {/* QR Code Presensi Sholat & KBM */}
        <div className="shrink-0 flex flex-col items-center bg-white p-1 rounded-xl shadow-xs">
          <canvas ref={qrCanvasRef} className="w-[66px] h-[66px] rounded" />
          <span className="text-[6.5px] font-black text-slate-700 tracking-tighter uppercase mt-0.5">
            SCAN SHOLAT
          </span>
        </div>
      </div>

      {/* 3. FOOTER KARTU */}
      <div className="flex items-center justify-between border-t border-white/20 pt-1 text-[7.5px] text-teal-100 shrink-0">
        <span className="font-medium tracking-wide">Sampurnan, Bungah, Gresik</span>
        <span className="font-mono font-bold text-amber-200">ID: {num(student.id)}</span>
      </div>
    </div>
  );
}

// =========================================================
// SISI BELAKANG KARTU TANDA SANTRI (KTS)
// =========================================================
function KtsBackCard({ student }: { student: ApiRecord }) {
  return (
    <div className="relative w-[345px] h-[218px] sm:w-[350px] sm:h-[220px] rounded-2xl bg-white text-slate-800 p-3 shadow-md border border-slate-200 flex flex-col justify-between overflow-hidden print:shadow-none print:border-slate-300 print:break-inside-avoid">
      <div>
        <div className="text-center border-b border-slate-200 pb-1">
          <h4 className="text-[10px] font-black uppercase text-[#138F81] tracking-wider">
            TATA TERTIB & KETENTUAN KTS
          </h4>
          <p className="text-[7.5px] text-slate-500 font-semibold">
            Pondok Pesantren Qomaruddin Sampurnan Bungah
          </p>
        </div>

        <ol className="list-decimal list-inside text-[8px] text-slate-600 space-y-0.5 mt-1.5 leading-relaxed font-medium">
          <li>Kartu ini adalah identitas resmi santri Pondok Pesantren Qomaruddin.</li>
          <li>Wajib dibawa setiap mengikuti Sholat Berjamaah 5 Waktu & KBM Madin.</li>
          <li>Pindai QR Code di meja pos pengurus sebelum masuk masjid.</li>
          <li>Dilarang menitipkan atau meminjamkan kartu kepada santri lain.</li>
          <li>Apabila kartu hilang, segera lapor ke bagian keamanan pondok.</li>
        </ol>
      </div>

      {/* Bagian Tanda Tangan Pengurus */}
      <div className="flex items-end justify-between border-t border-slate-200 pt-1 text-[8px]">
        <div>
          <p className="text-[7px] text-slate-400 font-semibold">
            Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <p className="font-mono font-bold text-slate-600 text-[8px]">
            NIS: {text(student.nis, '-')}
          </p>
        </div>

        <div className="text-center leading-tight">
          <p className="text-[7.5px] text-slate-500">Pengasuh / Keamanan,</p>
          <div className="h-6 flex items-center justify-center">
            <span className="text-[9px] font-black text-teal-800 tracking-wider font-serif">
              [ STEMPEL RESMI ]
            </span>
          </div>
          <p className="font-black text-slate-800 text-[8px] underline">
            PP. Qomaruddin
          </p>
        </div>
      </div>
    </div>
  );
}
