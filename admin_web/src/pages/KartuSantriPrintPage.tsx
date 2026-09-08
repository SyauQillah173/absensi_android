import {
  ArrowLeft,
  Check,
  CreditCard,
  Download,
  Info,
  Layers,
  Maximize2,
  Minimize2,
  Printer,
  RotateCcw,
  Search,
  Smartphone,
  Sparkles,
  User,
  Users,
  X
} from 'lucide-react';
import QRCode from 'qrcode';
import React, { useEffect, useMemo, useState } from 'react';
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
export type PaperLayoutMode = 'a4-sheet' | 'ktp-cr80';

// =====================================================================
// HELPER: GENERATE GAMBAR KTS KE FORMAT JPG TAJAM (300 DPI / 1012x638)
// =====================================================================
async function generateKtsJpg(student: ApiRecord, side: 'front' | 'back'): Promise<Blob> {
  const width = 1012;
  const height = 638;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not supported');

  const nama = text(student.nama, 'Nama Santri');
  const nis = text(student.nis, '-');
  const ttl = `${text(student.tempat_lahir, '')}${student.tempat_lahir && student.tanggal_lahir ? ', ' : ''}${text(student.tanggal_lahir, '-')}`;
  const kamar = text(student.kamar, '-');
  const komplek = text(student.komplek, '-');
  const alamat = `${text(student.kecamatan, '')}${student.kecamatan && student.kota ? ', ' : ''}${text(student.kota, text(student.alamat, '-'))}`;
  const wali = text(student.nama_wali, text(student.nama_ayah, '-'));
  const isPutri = text(student.jenis_kelamin).includes('P') || text(student.jenis_kelamin).toUpperCase() === 'PEREMPUAN';
  const qrCodeValue = `QOMAR-${num(student.id)}-${nis}`;

  // Helper load image
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image: ' + src));
      img.src = src;
    });
  };

  if (side === 'front') {
    // 1. Background Gradient Deep Emerald Green
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#053b34');
    grad.addColorStop(0.5, '#0a5247');
    grad.addColorStop(1, '#042e27');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 2. Ornamen Guilloche Pattern Halus
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.12)';
    ctx.lineWidth = 1;
    for (let x = -100; x < width + 100; x += 45) {
      ctx.beginPath();
      ctx.arc(x, height / 2, 280, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3. Watermark Logo Transparan di Tengah
    try {
      const logoImg = await loadImage(qomaruddinLogo);
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.drawImage(logoImg, width / 2 - 120, height / 2 - 150, 320, 320);
      ctx.restore();
    } catch {
      // safe fallback
    }

    // 4. Double Gold Border
    // Outer border
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    // Inner border
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    // 5. Header / Kop Pesantren
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(25, 115);
    ctx.lineTo(width - 25, 115);
    ctx.stroke();

    // Gambar Logo di Kop
    try {
      const logoImg = await loadImage(qomaruddinLogo);
      // Lingkaran putih di belakang logo
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(75, 68, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.drawImage(logoImg, 45, 38, 60, 60);
    } catch {
      // safe fallback
    }

    // Teks Kop
    ctx.fillStyle = '#fde047';
    ctx.font = '900 15px sans-serif';
    ctx.letterSpacing = '3px';
    ctx.fillText('YAYASAN PONDOK PESANTREN', 130, 48);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillText('QOMARUDDIN SAMPURNAN', 130, 78);

    ctx.fillStyle = '#99f6e4';
    ctx.font = 'bold 13px sans-serif';
    ctx.letterSpacing = '1.5px';
    ctx.fillText('KARTU TANDA SANTRI (KTS) RESMI', 130, 100);

    // Kode ID di kanan atas kop
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`ID: ${num(student.id)}`, width - 35, 70);
    ctx.textAlign = 'left';

    // 6. Pas Foto Santri
    const photoX = 40;
    const photoY = 140;
    const photoW = 230;
    const photoH = 300;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.strokeRect(photoX, photoY, photoW, photoH);

    let photoDrawn = false;
    if (student.foto_santri) {
      try {
        const photoImg = await loadImage(String(student.foto_santri));
        ctx.drawImage(photoImg, photoX + 2, photoY + 2, photoW - 4, photoH - 4);
        photoDrawn = true;
      } catch {
        // Gagal load foto
      }
    }

    if (!photoDrawn) {
      ctx.fillStyle = '#0f766e';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isPutri ? '🧕 SANTRI PI' : '👳 SANTRI PA', photoX + photoW / 2, photoY + photoH / 2);
      ctx.textAlign = 'left';
    }

    // Badge Santri di Bawah Foto
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(photoX + 15, photoY + photoH + 15, photoW - 30, 36, 18);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.font = '900 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isPutri ? 'SANTRI PUTRI' : 'SANTRI PUTRA', photoX + photoW / 2, photoY + photoH + 38);
    ctx.textAlign = 'left';

    // 7. Tabel Biodata
    const bioX = 300;
    ctx.fillStyle = '#fff8db';
    ctx.font = '900 24px sans-serif';
    ctx.fillText(nama.toUpperCase(), bioX, 165);

    // Garis bawah nama
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bioX, 178);
    ctx.lineTo(bioX + 380, 178);
    ctx.stroke();

    const drawRow = (label: string, val: string, yPos: number, isMono = false) => {
      ctx.fillStyle = '#99f6e4';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText(label, bioX, yPos);

      ctx.fillStyle = isMono ? '#fde047' : '#ffffff';
      ctx.font = isMono ? '900 20px monospace' : '600 17px sans-serif';
      ctx.fillText(`: ${val}`, bioX + 90, yPos);
    };

    drawRow('NIS', nis, 220, true);
    drawRow('TTL', ttl, 265);
    drawRow('Kamar', `${kamar} (${komplek})`, 310);
    drawRow('Alamat', alamat, 355);
    drawRow('Wali', wali, 400);

    // 8. Barcode QR Code (Bersih Tanpa Text Scan Sholat)
    const qrSize = 210;
    const qrX = width - qrSize - 45;
    const qrY = 160;

    // Kotak putih QR
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(qrX, qrY, qrSize, qrSize + 35, 14);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    try {
      const qrDataUrl = await QRCode.toDataURL(qrCodeValue, {
        width: 320,
        margin: 1,
        color: { dark: '#032621', light: '#ffffff' }
      });
      const qrImg = await loadImage(qrDataUrl);
      ctx.drawImage(qrImg, qrX + 10, qrY + 10, qrSize - 20, qrSize - 20);
    } catch {
      // safe fallback
    }

    ctx.fillStyle = '#1e293b';
    ctx.font = '900 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VERIFIED ID', qrX + qrSize / 2, qrY + qrSize + 22);
    ctx.textAlign = 'left';

    // 9. Footer
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(25, height - 55);
    ctx.lineTo(width - 25, height - 55);
    ctx.stroke();

    ctx.fillStyle = '#99f6e4';
    ctx.font = '600 15px sans-serif';
    ctx.fillText('Sampurnan, Bungah, Gresik • Jawa Timur', 40, height - 25);

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`KTS-QOMARUDDIN • 2026`, width - 40, height - 25);
    ctx.textAlign = 'left';
  } else {
    // SISI BELAKANG (BACK CARD)
    ctx.fillStyle = '#fcfcfb';
    ctx.fillRect(0, 0, width, height);

    // Double Border
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    // Watermark Logo
    try {
      const logoImg = await loadImage(qomaruddinLogo);
      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.drawImage(logoImg, width / 2 - 150, height / 2 - 150, 300, 300);
      ctx.restore();
    } catch {
      // safe fallback
    }

    // Header Tata Tertib
    const hGrad = ctx.createLinearGradient(40, 35, width - 80, 80);
    hGrad.addColorStop(0, '#063e36');
    hGrad.addColorStop(0.5, '#0b574a');
    hGrad.addColorStop(1, '#063e36');
    ctx.fillStyle = hGrad;
    ctx.beginPath();
    ctx.roundRect(40, 35, width - 80, 85, 12);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.font = '900 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TATA TERTIB & KETENTUAN SANTRI', width / 2, 72);

    ctx.fillStyle = '#99f6e4';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Pondok Pesantren Qomaruddin Sampurnan Bungah Gresik', width / 2, 98);
    ctx.textAlign = 'left';

    // 5 Butir Tata Tertib
    const rules = [
      '1. Kartu Tanda Santri (KTS) adalah identitas resmi santri Pondok Pesantren Qomaruddin.',
      '2. Wajib dibawa saat Presensi Sholat Berjamaah 5 Waktu & KBM Madrasah Diniyah.',
      '3. Pindai barcode pada pos scanner presensi yang telah disediakan sebelum masuk masjid.',
      '4. Dilarang keras meminjamkan, menukar, atau memalsukan kartu identitas ini.',
      '5. Jika kartu hilang atau rusak, segera lapor ke Bagian Keamanan Pesantren.'
    ];

    ctx.fillStyle = '#1e293b';
    ctx.font = '600 17px sans-serif';
    let rY = 175;
    rules.forEach((r) => {
      ctx.fillText(r, 55, rY);
      rY += 48;
    });

    // Garis Footer
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(40, height - 145);
    ctx.lineTo(width - 40, height - 145);
    ctx.stroke();

    // Kolom Kiri Bawah
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`, 55, height - 105);

    ctx.fillStyle = '#1e293b';
    ctx.font = '900 17px monospace';
    ctx.fillText(`NIS: ${nis}`, 55, height - 75);

    // Kolom Kanan Bawah (Stempel & Pengesahan)
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Pengasuh / Bagian Keamanan,', width - 180, height - 110);

    ctx.fillStyle = '#0d9488';
    ctx.font = '900 16px serif';
    ctx.fillText('[ STEMPEL RESMI ]', width - 180, height - 75);

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 15px sans-serif';
    ctx.fillText('PP. QOMARUDDIN SAMPURNAN', width - 180, height - 48);
    ctx.textAlign = 'left';
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Gagal konversi canvas ke blob JPEG'));
    }, 'image/jpeg', 0.95);
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function KartuSantriPrintPage({ onBack, initialSiswaId }: KartuSantriPrintPageProps) {
  const [students, setStudents] = useState<ApiRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tab Mode: 'single' (Cetak Satuan / Penggantian Kartu Hilang) vs 'batch' (Cetak Massal)
  const [viewMode, setViewMode] = useState<ViewMode>('single');

  // Santri terpilih untuk Mode Satuan
  const [singleSelectedId, setSingleSelectedId] = useState<number | null>(initialSiswaId ?? null);

  // Santri terpilih untuk Mode Massal
  const [batchSelectedIds, setBatchSelectedIds] = useState<number[]>([]);

  // Filter & Pencarian
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [complexFilter, setComplexFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'L' | 'P'>('all');

  // Pengaturan Cetak: Default A4 Sheet (Paling sering dipakai printer kantor/pesantren)
  const [printSide, setPrintSide] = useState<PrintSideMode>('both');
  const [paperLayout, setPaperLayout] = useState<PaperLayoutMode>('a4-sheet');

  // State Modal Fullscreen Scan HP (KTS Digital Darurat)
  const [showMobileScanModal, setShowMobileScanModal] = useState(false);

  // State Loading Download JPG
  const [isDownloading, setIsDownloading] = useState(false);

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

  // Handler Download Gambar JPG
  const handleDownloadJpg = async (side: 'front' | 'back') => {
    if (!singleStudent) return;
    setIsDownloading(true);
    try {
      const blob = await generateKtsJpg(singleStudent, side);
      const cleanName = text(singleStudent.nama).replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `KTS_${side === 'front' ? 'DEPAN' : 'BELAKANG'}_${cleanName}_NIS${text(singleStudent.nis)}.jpg`;
      triggerDownload(blob, filename);
    } catch (err) {
      console.error('Gagal download gambar KTS:', err);
      alert('Maaf, gagal membuat file gambar KTS. Silakan coba lagi.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* ========================================================= */}
      {/* CSS KHUSUS PRINT: ISOLASI AREA CETAK 100% BULLETPROOF    */}
      {/* ========================================================= */}
      <style>{`
        @media print {
          @page {
            ${
              paperLayout === 'ktp-cr80'
                ? 'size: 85.6mm 54mm; margin: 0;'
                : 'size: A4 portrait; margin: 6mm;'
            }
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-hidden-area,
          aside,
          header,
          footer,
          .q-sidebar,
          .q-topbar,
          .q-header-title,
          .q-profile-chip {
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
            gap: 6mm !important;
            justify-content: center !important;
            align-content: start !important;
          }
        }
      `}</style>

      {/* ========================================================= */}
      {/* HEADER & TOOLBAR ATAS (HILANG SAAT DI-PRINT)              */}
      {/* ========================================================= */}
      <div className="print-hidden-area bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-5">
        {/* Row 1: Judul Halaman & Tombol Aksi Utama */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
              title="Kembali"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#138F81] shrink-0" />
                <h1 className="text-base sm:text-xl font-black text-slate-800 tracking-tight truncate">
                  Studio Kartu Tanda Santri (KTS)
                </h1>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">
                Desain Royal Emerald Gold • Siap Cetak ID Card atau Scan Digital via Layar HP
              </p>
            </div>
          </div>

          {/* Action Buttons Header */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Tombol Buka Scan Layar HP (Urgent Scan Standby) */}
            {singleStudent && viewMode === 'single' && (
              <button
                type="button"
                onClick={() => setShowMobileScanModal(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 px-4 py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-amber-500/25 transition-all cursor-pointer"
                title="Buka QR Code Besar di Layar HP untuk Diarahkan ke Kamera Laptop Pos Sholat"
              >
                <Smartphone size={17} />
                <span>📱 Scan Layar HP</span>
              </button>
            )}

            {/* Tombol Cetak Utama */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={printStudents.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-lg shadow-[#138F81]/25 transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer size={17} />
              <span>
                {viewMode === 'single'
                  ? 'Cetak KTS (Ctrl+P)'
                  : `Cetak Massal (${printStudents.length})`}
              </span>
            </button>
          </div>
        </div>

        {/* Row 2: Tips Petunjuk Print & Download */}
        <div className="flex items-center gap-2.5 bg-teal-50/80 border border-teal-200 text-teal-950 px-3.5 py-2.5 rounded-2xl text-xs font-semibold">
          <Info size={16} className="text-teal-600 shrink-0" />
          <p className="leading-relaxed">
            <strong className="font-extrabold text-teal-900">Uji Coba Tanpa Printer:</strong> Anda bisa langsung klik <span className="font-bold underline text-amber-800">📱 Scan Layar HP</span> atau klik <span className="font-bold underline text-teal-800">📥 Download JPG</span> lalu buka di HP dan arahkan ke kamera laptop pos sholat. Barcode QR akan terbaca otomatis!
          </p>
        </div>

        {/* Row 3: Tab Navigasi Mode (Satuan vs Massal) + Pengaturan Cetak */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
          {/* TAB MODE: SATUAN (HILANG KARTU) VS MASSAL */}
          <div className="inline-flex rounded-xl bg-white p-1 border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode('single')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                viewMode === 'single'
                  ? 'bg-[#138F81] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User size={15} />
              <span>👤 Cetak/Scan Satuan</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('batch')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                viewMode === 'batch'
                  ? 'bg-[#138F81] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={15} />
              <span>👥 Cetak Massal ({batchSelectedIds.length})</span>
            </button>
          </div>

          {/* Pengaturan Sisi Kartu & Jenis Kertas */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Sisi Cetak */}
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
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
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="font-bold text-slate-500">Kertas:</span>
              <select
                value={paperLayout}
                onChange={(e) => setPaperLayout(e.target.value as PaperLayoutMode)}
                className="font-bold text-slate-800 outline-none bg-transparent cursor-pointer"
              >
                <option value="a4-sheet">📄 Lembar A4 / Kertas Foto (Printer Biasa)</option>
                <option value="ktp-cr80">💳 Ukuran KTP CR-80 (Printer PVC)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Row 4: Filter & Search Bar */}
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
              <option value="all">Semua Gender (Putra & Putri)</option>
              <option value="L">👦 Santri Putra (PA)</option>
              <option value="P">👧 Santri Putri (PI)</option>
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
      {/* TAMPILAN MODE 1: CETAK / SCAN SATUAN                      */}
      {/* ========================================================= */}
      {viewMode === 'single' && (
        <div className="print-hidden-area grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* KOLOM KIRI (4 SPAN): DAFTAR SANTRI UNTUK DIPILIH */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-4 shadow-sm flex flex-col h-[580px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                PILIH SANTRI ({filteredStudents.length})
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">
                Pilih untuk pratinjau / scan
              </span>
            </div>

            <div className="flex-1 overflow-y-auto q-scrollbar divide-y divide-slate-100 pr-1 mt-2">
              {isLoading ? (
                <div className="p-8 text-center text-xs text-slate-400 font-semibold">
                  Memuat data santri...
                </div>
              ) : filteredStudents.length === 0 ? (
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
          <div className="lg:col-span-8 bg-gradient-to-br from-slate-100 via-slate-50 to-teal-50/40 rounded-3xl border border-slate-200 p-4 sm:p-6 flex flex-col items-center justify-center min-h-[580px] relative overflow-hidden shadow-inner">
            {singleStudent ? (
              <div className="space-y-6 w-full max-w-2xl flex flex-col items-center">
                {/* Badge Info Santri */}
                <div className="text-center space-y-1">
                  <span className="rounded-full bg-teal-100 text-teal-800 text-xs font-black px-3 py-1 uppercase tracking-wider inline-flex items-center gap-1.5 shadow-2xs">
                    <Sparkles size={13} className="text-amber-500" />
                    <span>DESAIN KTS RESMI • ROYAL EMERALD GOLD</span>
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-tight">
                    {text(singleStudent.nama)}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    NIS: <span className="font-mono font-bold text-slate-700">{text(singleStudent.nis)}</span> • Kamar:{' '}
                    <span className="font-bold text-slate-700">{text(singleStudent.kamar)} ({text(singleStudent.komplek)})</span>
                  </p>
                </div>

                {/* AREA MOCKUP KARTU KTP (RESPONSIF DI HP & LAPTOP) */}
                <div className="w-full flex flex-wrap items-center justify-center gap-6 p-2 overflow-x-auto">
                  {/* Sisi Depan */}
                  {(printSide === 'both' || printSide === 'front') && (
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                        SISI DEPAN (FRONT)
                      </span>
                      <div className="shadow-2xl rounded-[3.18mm] overflow-hidden border border-slate-300 transform scale-95 sm:scale-100 origin-center transition-transform">
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
                      <div className="shadow-2xl rounded-[3.18mm] overflow-hidden border border-slate-300 transform scale-95 sm:scale-100 origin-center transition-transform">
                        <KtsBackCard student={singleStudent} />
                      </div>
                    </div>
                  )}
                </div>

                {/* TOOLBAR AKSI: SCAN HP, DOWNLOAD JPG, CETAK PRINTER */}
                <div className="w-full pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
                  {/* Tombol Scan Layar HP */}
                  <button
                    type="button"
                    onClick={() => setShowMobileScanModal(true)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 px-6 py-3.5 text-xs sm:text-sm font-black text-white shadow-md shadow-amber-500/25 transition-all cursor-pointer"
                  >
                    <Smartphone size={17} />
                    <span>📱 Scan Layar HP (KTS Digital)</span>
                  </button>

                  {/* Tombol Download JPG Sisi Depan */}
                  <button
                    type="button"
                    onClick={() => void handleDownloadJpg('front')}
                    disabled={isDownloading}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-white hover:bg-slate-50 border border-slate-300 px-4 py-3.5 text-xs sm:text-sm font-black text-slate-700 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Download size={16} className="text-teal-600" />
                    <span>Unduh JPG Depan</span>
                  </button>

                  {/* Tombol Download JPG Sisi Belakang */}
                  <button
                    type="button"
                    onClick={() => void handleDownloadJpg('back')}
                    disabled={isDownloading}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-white hover:bg-slate-50 border border-slate-300 px-4 py-3.5 text-xs sm:text-sm font-black text-slate-700 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Download size={16} className="text-slate-500" />
                    <span>Unduh JPG Belakang</span>
                  </button>

                  {/* Tombol Cetak Fisik */}
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] px-5 py-3.5 text-xs sm:text-sm font-black text-white shadow-lg shadow-[#138F81]/25 transition-all cursor-pointer"
                  >
                    <Printer size={16} />
                    <span>Cetak Fisik</span>
                  </button>
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
                <span>Daftar Pilihan Santri Siap Cetak Massal</span>
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
          <div className="max-h-96 overflow-y-auto q-scrollbar grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 p-1">
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
      {/* MODAL FULLSCREEN: KTS DIGITAL KHUSUS SCAN LAYAR HP        */}
      {/* ========================================================= */}
      {showMobileScanModal && singleStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 select-none animate-in fade-in duration-200">
          {/* Header Modal */}
          <div className="w-full max-w-md flex items-center justify-between border-b border-slate-800 pb-3 text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-sm font-black tracking-tight uppercase text-teal-300">
                KTS Digital • Scan Layar HP
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowMobileScanModal(false)}
              className="h-9 w-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Area QR Code Besar Beresolusi Tinggi & Kontras Tajam */}
          <div className="w-full max-w-md flex flex-col items-center justify-center my-auto space-y-4 text-center">
            {/* Box Putih QR Bersih Khusus Kamera Laptop/Kiosk */}
            <div className="bg-white p-5 rounded-3xl shadow-2xl border-4 border-amber-400 flex flex-col items-center">
              <MobileQrDisplay
                value={`QOMAR-${num(singleStudent.id)}-${text(singleStudent.nis)}`}
              />
              <span className="text-xs font-mono font-black text-slate-800 tracking-wider uppercase mt-2">
                AUTHENTIC SCANNER CODE
              </span>
            </div>

            {/* Identitas Santri */}
            <div className="text-white space-y-1">
              <h2 className="text-lg sm:text-xl font-black text-amber-300 uppercase tracking-tight">
                {text(singleStudent.nama)}
              </h2>
              <p className="text-xs text-slate-300 font-mono">
                NIS: <span className="font-bold text-white">{text(singleStudent.nis)}</span> • Kamar:{' '}
                <span className="font-bold text-white">{text(singleStudent.kamar)}</span>
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-extrabold border border-emerald-500/40">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Arahkan Layar HP ini ke Kamera Scanner Pos Sholat</span>
                </span>
              </div>
            </div>
          </div>

          {/* Footer Action Modal */}
          <div className="w-full max-w-md flex items-center justify-center gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => void handleDownloadJpg('front')}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 hover:bg-teal-500 py-3 text-xs font-black text-white transition-colors cursor-pointer"
            >
              <Download size={16} />
              <span>Simpan JPG ke Galeri HP</span>
            </button>
            <button
              type="button"
              onClick={() => setShowMobileScanModal(false)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-800 hover:bg-slate-700 py-3 text-xs font-black text-slate-300 transition-colors cursor-pointer"
            >
              <span>Tutup</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* AREA RENDER CETAK DOKUMEN (HANYA MUNCUL DI DIALOG PRINT)  */}
      {/* ========================================================= */}
      <div className="hidden print:block">
        {printStudents.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Tidak ada kartu yang dipilih untuk dicetak.</div>
        ) : viewMode === 'single' && paperLayout === 'a4-sheet' ? (
          /* Khusus Cetak Satuan di Kertas A4 (PAS 1 LEMBAR KERTAS) */
          <div className="flex flex-col items-center justify-center min-h-[260mm] p-6">
            <div className="flex flex-wrap items-center justify-center gap-6">
              {(printSide === 'both' || printSide === 'front') && (
                <div className="kts-card-wrapper border border-dashed border-slate-300">
                  <KtsFrontCard student={printStudents[0]} />
                </div>
              )}
              {(printSide === 'both' || printSide === 'back') && (
                <div className="kts-card-wrapper border border-dashed border-slate-300">
                  <KtsBackCard student={printStudents[0]} />
                </div>
              )}
            </div>
            <p className="text-[9px] text-slate-400 mt-6 tracking-wide font-mono">
              ✂️ Garis potong presisi ID Card (85.6mm x 54mm) • Pondok Pesantren Qomaruddin Sampurnan
            </p>
          </div>
        ) : paperLayout === 'ktp-cr80' ? (
          /* Mode Printer Kartu PVC CR-80 */
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
          /* Mode Massal Grid A4 */
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

// Component QR Code Khusus Layar HP (Resolusi Besar & Sangat Tajam)
function MobileQrDisplay({ value }: { value: string }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    QRCode.toDataURL(value, {
      width: 280,
      margin: 1,
      color: { dark: '#021e1a', light: '#ffffff' }
    })
      .then((url) => setDataUrl(url))
      .catch((err) => console.error(err));
  }, [value]);

  if (!dataUrl) {
    return <div className="w-[240px] h-[240px] bg-slate-100 animate-pulse rounded-2xl" />;
  }

  return (
    <img
      src={dataUrl}
      alt="QR Santri"
      className="w-[240px] h-[240px] sm:w-[260px] sm:h-[260px] object-contain rounded-xl"
    />
  );
}

// =====================================================================
// SISI DEPAN KARTU TANDA SANTRI (KTS) RESMI
// Dimensi: 85.6mm x 54mm (Ukuran KTP Standar Internasional ISO/IEC 7810 ID-1)
// Desain: Deep Royal Emerald & Gold Security Card (Bersih & Elegan)
// =====================================================================
function KtsFrontCard({ student }: { student: ApiRecord }) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const qrCodeValue = `QOMAR-${num(student.id)}-${text(student.nis, '0')}`;

  // Generate QR Code Beresolusi Tinggi (240px untuk ketajaman cetak ~360 DPI)
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(qrCodeValue, {
      width: 240,
      margin: 1,
      color: {
        dark: '#032621', // Deep Royal Emerald pekat tajam
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((err) => console.error('Gagal generate QR Code KTS:', err));

    return () => {
      active = false;
    };
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
        printColorAdjust: 'exact',
        background: 'linear-gradient(135deg, #053b34 0%, #0a5247 52%, #042e27 100%)'
      }}
      className="relative text-white p-2.5 shadow-md border border-amber-400/80 flex flex-col justify-between overflow-hidden print:shadow-none select-none box-border"
    >
      {/* 1. ORNAMEN GUILLOCHE SECURITY & WATERMARK LOGO DI LATAR */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.14]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="kts-guilloche-pat" width="36" height="36" patternUnits="userSpaceOnUse">
            <path d="M0 18 Q9 0 18 18 T36 18" fill="none" stroke="#fbbf24" strokeWidth="0.5" />
            <path d="M0 18 Q9 36 18 18 T36 18" fill="none" stroke="#fbbf24" strokeWidth="0.5" />
            <circle cx="18" cy="18" r="11" fill="none" stroke="#fbbf24" strokeWidth="0.3" strokeDasharray="1.5,1.5" />
            <circle cx="18" cy="18" r="5" fill="none" stroke="#fbbf24" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#kts-guilloche-pat)" />
      </svg>

      {/* Watermark Logo PP. Qomaruddin di Latar Belakang Tengah */}
      <img
        src={qomaruddinLogo}
        alt=""
        className="absolute right-10 top-1/2 -translate-y-1/2 h-26 w-26 object-contain pointer-events-none opacity-[0.09] select-none"
      />

      {/* Garis Border Emas Dalam (Dual Security Frame) */}
      <div className="absolute inset-[1.4mm] rounded-[2.2mm] border border-amber-300/40 pointer-events-none" />

      {/* 2. KOP RESMI PESANTREN (BERSIH, TANPA CHIP SMART ID ALAY) */}
      <div className="relative z-10 flex items-center justify-between border-b border-amber-300/40 pb-1 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7.5 w-7.5 rounded-full bg-white p-0.5 border border-amber-400 shadow-2xs shrink-0 flex items-center justify-center">
            <img
              src={qomaruddinLogo}
              alt="Logo Qomaruddin"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0 leading-none">
            <p className="text-[6.2px] uppercase tracking-[0.18em] font-black text-amber-300">
              YAYASAN PONDOK PESANTREN
            </p>
            <h3 className="text-[9.5px] font-black tracking-wide text-white uppercase mt-0.5">
              QOMARUDDIN SAMPURNAN
            </h3>
            <p className="text-[5.8px] text-teal-100 font-bold tracking-wider uppercase mt-0.5">
              KARTU TANDA SANTRI (KTS) RESMI
            </p>
          </div>
        </div>

        {/* Nomor ID Santri di Kanan Atas Kop */}
        <div className="shrink-0 text-right">
          <span className="text-[6.2px] font-mono font-bold text-amber-300 tracking-wider">
            ID: {num(student.id)}
          </span>
        </div>
      </div>

      {/* 3. BODY KARTU: PAS FOTO + TABEL BIODATA + BARCODE QR MEWAH */}
      <div className="relative z-10 flex items-center gap-2.5 my-auto pt-0.5">
        {/* Pas Foto Santri (Standar Rasio KTP) */}
        <div className="flex flex-col items-center shrink-0">
          <div className="w-[19.5mm] h-[25.5mm] rounded-lg border-1.5 border-amber-400 bg-white overflow-hidden shadow-xs flex items-center justify-center">
            {student.foto_santri ? (
              <img
                src={String(student.foto_santri)}
                alt={nama}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-teal-900/50 p-1 text-center">
                <svg className="w-8 h-8 text-teal-800/60" viewBox="0 0 24 24" fill="currentColor">
                  {isPutri ? (
                    <path d="M12 2c-3.31 0-6 2.69-6 6 0 2.22 1.21 4.15 3 5.19V14c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-.81c1.79-1.04 3-2.97 3-5.19 0-3.31-2.69-6-6-6zm-4 16c-2.21 0-4 1.79-4 4v1h16v-1c0-2.21-1.79-4-4-4H8z" />
                  ) : (
                    <path d="M12 2c-2.5 0-4.5.5-5 1.5l-.5 2.5c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3l-.5-2.5C16.5 2.5 14.5 2 12 2zm0 8c-2.21 0-4 1.79-4 4v1c0 2.21 1.79 4 4 4s4-1.79 4-4v-1c0-2.21-1.79-4-4-4zm-6 11c0-2.21 1.79-4 4-4h4c2.21 0 4 1.79 4 4v1H6v-1z" />
                  )}
                </svg>
                <span className="text-[5.5px] font-black text-teal-900 uppercase tracking-tighter mt-0.5">
                  PAS FOTO
                </span>
              </div>
            )}
          </div>
          <span className="mt-1 text-[5.8px] font-black uppercase text-amber-950 tracking-wider bg-gradient-to-r from-amber-300 to-amber-400 px-1.5 py-0.5 rounded-full shadow-2xs">
            {isPutri ? 'SANTRI PUTRI' : 'SANTRI PUTRA'}
          </span>
        </div>

        {/* Tabel Biodata Presisi & Elegan */}
        <div className="flex-1 min-w-0 text-[7.5px] leading-tight space-y-0.5">
          <p className="font-black text-[9.5px] text-[#fff8db] uppercase truncate leading-tight pb-0.5 border-b border-amber-400/30">
            {nama}
          </p>

          <div className="grid grid-cols-[38px_auto] gap-x-0.5 text-teal-50 pt-0.5">
            <span className="font-bold text-teal-200">NIS</span>
            <span className="font-mono font-black text-amber-300">: {nis}</span>

            <span className="font-bold text-teal-200">TTL</span>
            <span className="font-medium text-white truncate">: {ttl}</span>

            <span className="font-bold text-teal-200">Kamar</span>
            <span className="font-bold text-amber-100 truncate">: {kamar} ({komplek})</span>

            <span className="font-bold text-teal-200">Alamat</span>
            <span className="font-medium text-white truncate">: {alamat}</span>

            <span className="font-bold text-teal-200">Wali</span>
            <span className="font-medium text-white truncate">: {wali}</span>
          </div>
        </div>

        {/* Barcode QR Code yang Bersih & Berwibawa (TANPA TEKS "SCAN SHOLAT") */}
        <div className="shrink-0 flex flex-col items-center justify-center bg-white p-1 rounded-lg shadow-sm border border-amber-400/90 relative">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR Code KTS"
              className="w-[17.5mm] h-[17.5mm] object-contain rounded"
            />
          ) : (
            <div className="w-[17.5mm] h-[17.5mm] bg-white rounded flex items-center justify-center">
              <span className="text-[6px] text-slate-400">QR</span>
            </div>
          )}
          <span className="text-[5.2px] font-mono font-black text-slate-800 tracking-wider uppercase mt-0.5">
            VERIFIED ID
          </span>
        </div>
      </div>

      {/* 4. FOOTER KARTU */}
      <div className="relative z-10 flex items-center justify-between border-t border-amber-300/40 pt-0.5 text-[6.5px] text-teal-100 shrink-0">
        <span className="font-medium tracking-wide">Sampurnan, Bungah, Gresik • Jawa Timur</span>
        <span className="font-mono font-bold text-amber-300">ID: {num(student.id)}</span>
      </div>
    </div>
  );
}

// =====================================================================
// SISI BELAKANG KARTU TANDA SANTRI (KTS)
// Dimensi: 85.6mm x 54mm (Tata Tertib & Pengesahan Resmi Pesantren)
// =====================================================================
function KtsBackCard({ student }: { student: ApiRecord }) {
  return (
    <div
      style={{
        width: '85.6mm',
        height: '54mm',
        borderRadius: '3.18mm',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        background: '#fcfcfb'
      }}
      className="relative text-slate-800 p-2.5 shadow-md border border-amber-400/70 flex flex-col justify-between overflow-hidden print:shadow-none select-none box-border"
    >
      {/* Watermark Logo PP. Qomaruddin di Latar Belakang Belakang */}
      <img
        src={qomaruddinLogo}
        alt=""
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-24 w-24 object-contain pointer-events-none opacity-[0.08] select-none"
      />

      {/* Garis Border Dalam Halus */}
      <div className="absolute inset-[1.4mm] rounded-[2.2mm] border border-amber-400/30 pointer-events-none" />

      {/* Bagian Atas: Header Tata Tertib Deep Emerald */}
      <div className="relative z-10">
        <div className="text-center rounded-lg bg-gradient-to-r from-[#063e36] via-[#0b574a] to-[#063e36] text-white py-1 px-2 border border-amber-400/40 shadow-2xs">
          <h4 className="text-[7.8px] font-black uppercase tracking-wider text-amber-200">
            TATA TERTIB & KETENTUAN SANTRI
          </h4>
          <p className="text-[5.8px] text-teal-100 font-semibold mt-0.2">
            Pondok Pesantren Qomaruddin Sampurnan Bungah Gresik
          </p>
        </div>

        <ol className="list-decimal list-inside text-[6.8px] text-slate-700 space-y-0.5 mt-1.5 leading-snug font-medium">
          <li>Kartu Tanda Santri (KTS) adalah identitas resmi santri PP. Qomaruddin.</li>
          <li>Wajib dibawa saat Presensi Sholat Berjamaah 5 Waktu & KBM Madin.</li>
          <li>Pindai barcode pada pos scanner presensi yang telah disediakan.</li>
          <li>Dilarang keras meminjamkan, menukar, atau memalsukan kartu ini.</li>
          <li>Jika kartu hilang / rusak, segera lapor Bagian Keamanan Pesantren.</li>
        </ol>
      </div>

      {/* Bagian Bawah: Legalitas & Pengesahan */}
      <div className="relative z-10 border-t border-slate-200 pt-1 text-[6.5px]">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[5.5px] text-slate-400 font-semibold">
              Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            <p className="font-mono font-bold text-slate-700 text-[6.8px]">
              NIS: {text(student.nis, '-')}
            </p>
            <div className="mt-0.5 flex items-center gap-0.5 opacity-60">
              <span className="text-[5px] font-mono tracking-widest text-slate-400">||| | |||| || ||| |||| |</span>
            </div>
          </div>

          <div className="text-center leading-tight">
            <p className="text-[5.8px] text-slate-500 font-medium">Pengasuh / Bagian Keamanan,</p>
            <div className="h-4 flex items-center justify-center my-0.5">
              <span className="text-[7.5px] font-black text-teal-800 tracking-wider font-serif border border-teal-800/40 px-1 py-0.2 rounded bg-teal-50/50">
                [ STEMPEL RESMI ]
              </span>
            </div>
            <p className="font-black text-slate-800 text-[6.5px] underline">
              PP. QOMARUDDIN SAMPURNAN
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
