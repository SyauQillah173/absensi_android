import {
  ArrowLeft,
  Check,
  CreditCard,
  Download,
  Home,
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
import kaligrafiQomaruddin from '../assets/kaligrafi-qomaruddin.png';
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
async function generateKtsJpg(
  student: ApiRecord,
  side: 'front' | 'back',
  qrPlacement: 'none' | 'front' | 'back' = 'front'
): Promise<Blob> {
  const width = 1012;
  const height = 638;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not supported');

  const nama = text(student.nama, 'Nama Santri');
  const nis = text(student.nis, '-');
  const ttl = `${text(student.tempat_lahir, 'Gresik')}${student.tempat_lahir && student.tanggal_lahir ? ', ' : ''}${text(student.tanggal_lahir, '-')}`;
  const kamar = text(student.kamar, '-');
  const komplek = text(student.komplek, '-');
  const alamat = text(student.alamat, `${text(student.kecamatan, '')} ${text(student.kota, 'Gresik')}`.trim());
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

  // 1. Background Putih
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // 2. Background Pattern: Soft Islamic Honeycomb Pattern
  ctx.strokeStyle = 'rgba(0, 143, 93, 0.04)';
  ctx.lineWidth = 1;
  const r = 16;
  const h = r * Math.sqrt(3);
  for (let py = -h; py < height + h * 2; py += h) {
    for (let px = -r * 3; px < width + r * 3; px += r * 3) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const hx = px + r * Math.cos(a);
        const hy = py + r * Math.sin(a);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  // 3. Ornamen Lengkungan Hijau Konsentris Khas Canva Pengurus (Sisi Kiri)
  // Layer Luar: Hijau Emerald (#008f5d)
  ctx.fillStyle = '#008f5d';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(220, 60, 285, 260, 225, 450);
  ctx.bezierCurveTo(180, 550, 105, 605, 0, 638);
  ctx.closePath();
  ctx.fill();

  // Layer Dalam: Hijau Mint Cerah (#10b981)
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(175, 60, 230, 240, 185, 430);
  ctx.bezierCurveTo(145, 520, 75, 580, 0, 638);
  ctx.closePath();
  ctx.fill();

  // Aksen Sudut Kiri Atas
  ctx.fillStyle = '#008f5d';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(95, 0);
  ctx.bezierCurveTo(70, 50, 30, 85, 0, 95);
  ctx.closePath();
  ctx.fill();

  // Aksen Sudut Kanan Bawah
  ctx.fillStyle = '#008f5d';
  ctx.beginPath();
  ctx.moveTo(width, height - 95);
  ctx.bezierCurveTo(width - 30, height - 85, width - 70, height - 50, width - 95, height);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  // 4. Watermark Stempel Bundar Resmi di Kanan Bawah
  ctx.strokeStyle = 'rgba(0, 143, 93, 0.13)';
  ctx.lineWidth = 3.5;
  const wCenterX = width - 110;
  const wCenterY = height - 50;
  ctx.beginPath();
  ctx.arc(wCenterX, wCenterY, 175, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(wCenterX, wCenterY, 150, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(wCenterX, wCenterY, 105, 0, Math.PI * 2);
  ctx.stroke();

  if (side === 'front') {
    // KOP SISI DEPAN (KANAN ATAS)
    // Logo Resmi Qomaruddin di paling kanan
    try {
      const logoImg = await loadImage(qomaruddinLogo);
      ctx.drawImage(logoImg, width - 118, 18, 86, 86);
    } catch {
      // safe fallback
    }

    // Gambar Kaligrafi Arab Asli (Khat Tsuluts)
    try {
      const kaligrafiImg = await loadImage(kaligrafiQomaruddin);
      ctx.drawImage(kaligrafiImg, width - 425, 20, 290, 44);
    } catch {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#008f5d';
      ctx.font = 'bold 24px "Amiri", "Traditional Arabic", serif, sans-serif';
      ctx.fillText('المعهد الإسلامي السلفي قمر الدين', width - 135, 48);
    }

    // Teks Kop Sisi Depan
    ctx.textAlign = 'right';
    ctx.fillStyle = '#008f5d';
    ctx.font = '900 18.5px sans-serif';
    ctx.letterSpacing = '0.4px';
    ctx.fillText('PONDOK PESANTREN QOMARUDDIN', width - 135, 78);

    ctx.fillStyle = '#008f5d';
    ctx.font = 'bold 12.5px sans-serif';
    ctx.letterSpacing = '0px';
    ctx.fillText('SampurnanBungahGresik-NSP : 511235250073', width - 135, 98);
    ctx.textAlign = 'left';

    // PAS FOTO SANTRI (KIRI TENGAH)
    const photoX = 135;
    const photoY = 135;
    const photoW = 205;
    const photoH = 265;

    ctx.fillStyle = '#008f5d';
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, 22);
    ctx.fill();

    let photoDrawn = false;
    if (student.foto_santri) {
      try {
        const photoImg = await loadImage(String(student.foto_santri));
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(photoX, photoY, photoW, photoH, 22);
        ctx.clip();
        ctx.drawImage(photoImg, photoX, photoY, photoW, photoH);
        ctx.restore();
        photoDrawn = true;
      } catch {
        // Gagal load foto
      }
    }

    if (!photoDrawn) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isPutri ? '🧕' : '👳', photoX + photoW / 2, photoY + photoH / 2 + 10);
      ctx.font = '900 14px sans-serif';
      ctx.fillText(isPutri ? 'SANTRI PUTRI' : 'SANTRI PUTRA', photoX + photoW / 2, photoY + photoH / 2 + 50);
      ctx.textAlign = 'left';
    }

    // BIODATA SANTRI (KANAN FOTO)
    const bioX = 365;
    ctx.fillStyle = '#008f5d';
    ctx.font = '900 32px sans-serif';
    ctx.fillText(nama, bioX, 185);

    ctx.fillStyle = '#1e293b';
    ctx.font = '600 19px sans-serif';
    ctx.fillText(ttl, bioX, 224);

    // Label Alamat
    ctx.fillStyle = '#008f5d';
    ctx.font = '900 18px sans-serif';
    ctx.fillText('🏠 Alamat :', bioX, 270);

    // Isi Alamat (Bisa multi baris)
    ctx.fillStyle = '#334155';
    ctx.font = '500 16.5px sans-serif';
    const words = alamat.split(' ');
    let currentLine = '';
    let lineY = 300;
    for (let n = 0; n < words.length; n++) {
      const testLine = currentLine + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > 420 && n > 0) {
        ctx.fillText(currentLine, bioX, lineY);
        currentLine = words[n] + ' ';
        lineY += 25;
        if (lineY > 375) {
          currentLine = currentLine + '...';
          break;
        }
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      ctx.fillText(currentLine, bioX, lineY);
    }

    // BRANDING FOOTER KTS (KIRI BAWAH)
    // Icon Bulat Q
    ctx.fillStyle = '#008f5d';
    ctx.beginPath();
    ctx.arc(148, 470, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Q', 148, 476);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#008f5d';
    ctx.font = '900 19px sans-serif';
    ctx.letterSpacing = '0.5px';
    ctx.fillText('KARTU TANDA SANTRI', 172, 477);
    ctx.letterSpacing = '0px';

    // Badge Pill Website
    ctx.fillStyle = '#008f5d';
    ctx.beginPath();
    ctx.roundRect(172, 496, 210, 36, 18);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('www.qomaruddin.com', 277, 521);
    ctx.textAlign = 'left';

    // QR Code Presensi (Jika Diaktifkan di Sisi Depan)
    if (qrPlacement === 'front') {
      const qrSize = 135;
      const qrX = width - qrSize - 45;
      const qrY = height - qrSize - 55;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 36, 16);
      ctx.fill();
      ctx.strokeStyle = '#008f5d';
      ctx.lineWidth = 2;
      ctx.stroke();

      try {
        const qrDataUrl = await QRCode.toDataURL(qrCodeValue, {
          width: 250,
          margin: 1,
          color: { dark: '#008f5d', light: '#ffffff' }
        });
        const qrImg = await loadImage(qrDataUrl);
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
      } catch {
        // safe fallback
      }

      ctx.fillStyle = '#008f5d';
      ctx.font = '900 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SCAN PRESENSI', qrX + qrSize / 2, qrY + qrSize + 18);
      ctx.textAlign = 'left';
    }
  } else {
    // SISI BELAKANG KTS (100% PERSIS CANVA PENGURUS)
    // KOP TENGAH ATAS
    try {
      const kaligrafiImg = await loadImage(kaligrafiQomaruddin);
      ctx.drawImage(kaligrafiImg, width / 2 - 150, 24, 300, 46);
    } catch {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#008f5d';
      ctx.font = 'bold 24px "Amiri", "Traditional Arabic", serif, sans-serif';
      ctx.fillText('المعهد الإسلامي السلفي قمر الدين', width / 2, 58);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#008f5d';
    ctx.font = '900 18.5px sans-serif';
    ctx.letterSpacing = '0.5px';
    ctx.fillText('PONDOK PESANTREN QOMARUDDIN', width / 2, 88);

    ctx.fillStyle = '#008f5d';
    ctx.font = 'bold 13px sans-serif';
    ctx.letterSpacing = '0px';
    ctx.fillText('Sampurnan Bungah Gresik - NSP : 510035250011', width / 2, 110);
    ctx.textAlign = 'left';

    // TATA TERTIB RESMI PENGURUS
    // Bullet Bulat Hijau Khas Canva di samping butir 1
    ctx.fillStyle = '#008f5d';
    ctx.beginPath();
    ctx.arc(165, 178, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    const rules = [
      'Kartu Tanda Santri wajib dibawa dan digunakan oleh pemiliknya selama berada di lingkungan pesantren.',
      'Kartu ini tidak boleh dipindahtangankan, dipalsukan, atau disalahgunakan.',
      'Setiap pelanggaran akan dikenakan sanksi sesuai tata tertib pesantren yang berlaku.',
      'Kartu yang hilang atau ditemukan wajib segera dilaporkan atau dikembalikan kepada pihak Pondok Pesantren Qomaruddin.'
    ];

    let ruleY = 184;
    rules.forEach((r) => {
      ctx.font = '500 17.5px sans-serif';
      ctx.fillText(r, 195, ruleY);
      ruleY += 46;
    });

    // PENGESAHAN PEMANGKU DI KIRI BAWAH
    ctx.fillStyle = '#64748b';
    ctx.font = '500 15px sans-serif';
    ctx.fillText('Pemangku,', 160, height - 120);
    ctx.fillText('Pondok Pesantren Qomaruddin', 160, height - 95);

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 19px sans-serif';
    ctx.fillText("Dr. KH. M. Ala'uddin, Lc., M.SEI.", 160, height - 65);

    // QR Code Presensi (Jika Diaktifkan di Sisi Belakang)
    if (qrPlacement === 'back') {
      const qrSize = 135;
      const qrX = width - qrSize - 45;
      const qrY = height - qrSize - 55;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 36, 16);
      ctx.fill();
      ctx.strokeStyle = '#008f5d';
      ctx.lineWidth = 2;
      ctx.stroke();

      try {
        const qrDataUrl = await QRCode.toDataURL(qrCodeValue, {
          width: 250,
          margin: 1,
          color: { dark: '#008f5d', light: '#ffffff' }
        });
        const qrImg = await loadImage(qrDataUrl);
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
      } catch {
        // safe fallback
      }

      ctx.fillStyle = '#008f5d';
      ctx.font = '900 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SCAN PRESENSI', qrX + qrSize / 2, qrY + qrSize + 18);
      ctx.textAlign = 'left';
    }
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

  // Mode Penempatan QR Presensi: 'front' (Depan Kompak) | 'back' (Belakang) | 'none' (100% Persis Canva Pengurus Tanpa QR)
  const [qrPlacement, setQrPlacement] = useState<'none' | 'front' | 'back'>('front');

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
      const blob = await generateKtsJpg(singleStudent, side, qrPlacement);
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

            {/* Posisi QR Presensi */}
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="font-bold text-slate-500">QR Code:</span>
              <select
                value={qrPlacement}
                onChange={(e) => setQrPlacement(e.target.value as 'none' | 'front' | 'back')}
                className="font-black text-[#008f5d] outline-none bg-transparent cursor-pointer"
              >
                <option value="front">📱 Sisi Depan (Kompak Elegan)</option>
                <option value="back">🔄 Sisi Belakang (Belakang Kartu)</option>
                <option value="none">✨ 100% Persis Canva (Tanpa QR)</option>
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
                  <span className="rounded-full bg-emerald-100 text-[#065f46] text-xs font-black px-3 py-1 uppercase tracking-wider inline-flex items-center gap-1.5 shadow-2xs">
                    <Sparkles size={13} className="text-emerald-600" />
                    <span>DESAIN RESMI PENGURUS • HIJAU EMERALD QOMARUDDIN</span>
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
                        <KtsFrontCard student={singleStudent} qrPlacement={qrPlacement} />
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
                        <KtsBackCard student={singleStudent} qrPlacement={qrPlacement} />
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
          <div className="w-full max-w-md flex flex-col items-center justify-center my-auto space-y-5 text-center">
            {/* Box Putih QR Bersih Murni Khusus Scanner Kamera (Quiet Zone Tebal & Bersih) */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-2xl flex flex-col items-center justify-center border-4 border-emerald-400/40">
              <MobileQrDisplay
                value={`QOMAR-${num(singleStudent.id)}-${text(singleStudent.nis)}`}
              />
            </div>

            {/* Identitas Santri Terpisah Jelas di Bawah Box QR */}
            <div className="text-white space-y-1.5 pt-2">
              <h2 className="text-xl sm:text-2xl font-black text-amber-300 uppercase tracking-tight">
                {text(singleStudent.nama)}
              </h2>
              <p className="text-xs text-slate-300 font-mono">
                NIS: <span className="font-bold text-white">{text(singleStudent.nis)}</span> • Kamar:{' '}
                <span className="font-bold text-white">{text(singleStudent.kamar)} ({text(singleStudent.komplek)})</span>
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/25 text-emerald-300 text-xs font-black border border-emerald-500/50 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Arahkan ke Kamera Laptop (Jarak 20 - 30 cm)</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium pt-1 max-w-xs mx-auto">
                💡 Tips: Set kecerahan layar HP sekitar 50%–70% agar tidak terlalu silau di kamera laptop.
              </p>
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
                  <KtsFrontCard student={printStudents[0]} qrPlacement={qrPlacement} />
                </div>
              )}
              {(printSide === 'both' || printSide === 'back') && (
                <div className="kts-card-wrapper border border-dashed border-slate-300">
                  <KtsBackCard student={printStudents[0]} qrPlacement={qrPlacement} />
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
                    <KtsFrontCard student={student} qrPlacement={qrPlacement} />
                  </div>
                )}
                {(printSide === 'both' || printSide === 'back') && (
                  <div className="kts-card-wrapper">
                    <KtsBackCard student={student} qrPlacement={qrPlacement} />
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
                    <KtsFrontCard student={student} qrPlacement={qrPlacement} />
                  </div>
                )}
                {(printSide === 'both' || printSide === 'back') && (
                  <div className="kts-card-wrapper border border-dashed border-slate-300">
                    <KtsBackCard student={student} qrPlacement={qrPlacement} />
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

// Component QR Code Khusus Layar HP (Resolusi Besar, Kotak Modul Tebal & Mudah Dibaca Kamera)
function MobileQrDisplay({ value }: { value: string }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    QRCode.toDataURL(value, {
      width: 360,
      margin: 4, // Quiet Zone standar internasional ISO 18004
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'L' // Error Correction Low -> Modul kotak jauh lebih sedikit, sehingga KOTAK BESAR & TEBAL!
    })
      .then((url) => setDataUrl(url))
      .catch((err) => console.error(err));
  }, [value]);

  if (!dataUrl) {
    return <div className="w-[240px] h-[240px] sm:w-[280px] sm:h-[280px] bg-slate-100 animate-pulse rounded-2xl" />;
  }

  return (
    <img
      src={dataUrl}
      alt="QR Santri"
      className="w-[240px] h-[240px] sm:w-[280px] sm:h-[280px] object-contain select-none"
    />
  );
}

// =====================================================================
// SISI DEPAN KARTU TANDA SANTRI (KTS) RESMI
// Dimensi: 85.6mm x 54mm (Ukuran KTP Standar Internasional ISO/IEC 7810 ID-1)
// Desain: 100% Sesuai Master Canva Resmi Admin Pengurus Pondok Pesantren Qomaruddin
// =====================================================================
function KtsFrontCard({
  student,
  qrPlacement = 'front'
}: {
  student: ApiRecord;
  qrPlacement?: 'none' | 'front' | 'back';
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const qrCodeValue = `QOMAR-${num(student.id)}-${text(student.nis, '0')}`;

  // Generate QR Code Beresolusi Tinggi untuk Presensi (Jika Diaktifkan)
  useEffect(() => {
    if (qrPlacement !== 'front') return;
    let active = true;
    QRCode.toDataURL(qrCodeValue, {
      width: 250,
      margin: 1,
      color: {
        dark: '#008f5d',
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
  }, [qrCodeValue, qrPlacement]);

  const nama = text(student.nama, 'Nama Santri');
  const nis = text(student.nis, '-');
  const ttl = `${text(student.tempat_lahir, 'Gresik')}${student.tempat_lahir && student.tanggal_lahir ? ', ' : ''}${text(student.tanggal_lahir, '-')}`;
  const kamar = text(student.kamar, '-');
  const komplek = text(student.komplek, '-');
  const alamat = text(student.alamat, `${text(student.kecamatan, '')} ${text(student.kota, 'Gresik')}`.trim());
  const isPutri = text(student.jenis_kelamin).includes('P') || text(student.jenis_kelamin).toUpperCase() === 'PEREMPUAN';

  return (
    <div
      style={{
        width: '85.6mm',
        height: '54mm',
        borderRadius: '3.18mm',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        background: '#ffffff'
      }}
      className="relative text-slate-800 p-2 shadow-md border border-slate-200 flex flex-col justify-between overflow-hidden print:shadow-none select-none box-border font-sans"
    >
      {/* 1. TEKSTUR POLA EMBOSSED HONEYCOMB ISLAMI */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="kts-front-hex-pat" width="14" height="24.25" patternUnits="userSpaceOnUse">
            <path
              d="M 7 0 L 14 4.04 L 14 12.12 L 7 16.17 L 0 12.12 L 0 4.04 Z M 0 20.21 L 7 24.25 L 14 20.21"
              fill="none"
              stroke="#008f5d"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#kts-front-hex-pat)" />
      </svg>

      {/* 2. WATERMARK STEMPEL BUNDAR RESMI DI KANAN BAWAH */}
      <svg className="absolute right-[-10mm] bottom-[-10mm] w-[50mm] h-[50mm] pointer-events-none opacity-[0.16] text-[#008f5d]" viewBox="0 0 200 200" fill="none" stroke="currentColor">
        <circle cx="100" cy="100" r="85" strokeWidth="2.5" />
        <circle cx="100" cy="100" r="75" strokeWidth="1.5" strokeDasharray="3,3" />
        <circle cx="100" cy="100" r="55" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="35" strokeWidth="1" />
        <path d="M70 120 C 70 85, 85 70, 100 60 C 115 70, 130 85, 130 120 Z" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
      </svg>

      {/* 3. ORNAMEN KURVA HIJAU KONSENTRIS SISI KIRI KHAS CANVA */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 856 540" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Layer Luar: Hijau Emerald (#008f5d) */}
        <path d="M 0 0 C 180 50, 240 220, 190 380 C 150 470, 90 515, 0 540 L 0 0 Z" fill="#008f5d" />
        {/* Layer Dalam: Hijau Mint Cerah (#10b981) */}
        <path d="M 0 0 C 145 50, 195 205, 155 365 C 125 435, 60 495, 0 540 L 0 0 Z" fill="#10b981" />
        {/* Aksen Sudut Kiri Atas */}
        <path d="M 0 0 L 80 0 C 60 40, 25 70, 0 80 Z" fill="#008f5d" />
        {/* Aksen Sudut Kanan Bawah */}
        <path d="M 856 460 C 830 470, 790 500, 775 540 L 856 540 Z" fill="#008f5d" />
      </svg>

      {/* 4. KOP RESMI SISI DEPAN DI KANAN ATAS */}
      <div className="relative z-10 flex items-center justify-end gap-2 pl-16 shrink-0">
        <div className="text-right leading-none flex flex-col items-end">
          <img
            src={kaligrafiQomaruddin}
            alt="المعهد الإسلامي السلفي قمر الدين"
            className="h-3.5 w-auto object-contain mb-0.5"
          />
          <h4 className="font-black text-[7.5px] text-[#008f5d] tracking-tight uppercase mt-0.5">
            PONDOK PESANTREN QOMARUDDIN
          </h4>
          <p className="text-[5.2px] text-[#008f5d] font-bold tracking-tight mt-0.5">
            SampurnanBungahGresik-NSP : 511235250073
          </p>
        </div>
        <div className="h-8 w-8 rounded-full bg-white p-0.5 border border-amber-400 shadow-2xs shrink-0 flex items-center justify-center">
          <img
            src={qomaruddinLogo}
            alt="Logo Qomaruddin"
            className="h-full w-full object-contain"
          />
        </div>
      </div>

      {/* 5. BODY: PAS FOTO + BIODATA + OPSIONAL QR */}
      <div className="relative z-10 flex items-center gap-2 pl-14 my-auto">
        {/* Pas Foto Santri */}
        <div className="w-[19mm] h-[25mm] rounded-2xl bg-[#008f5d] overflow-hidden shadow-xs flex items-center justify-center shrink-0 border border-[#008f5d]">
          {student.foto_santri ? (
            <img
              src={String(student.foto_santri)}
              alt={nama}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-white p-1 text-center">
              <span className="text-2xl">{isPutri ? '🧕' : '👳'}</span>
              <span className="text-[5.5px] font-black uppercase tracking-wider mt-0.5 text-teal-100">
                PAS FOTO
              </span>
            </div>
          )}
        </div>

        {/* Biodata Santri */}
        <div className="flex-1 min-w-0 pr-1 space-y-0.5">
          <h3 className="font-black text-[11.5px] text-[#008f5d] uppercase leading-tight truncate">
            {nama}
          </h3>
          <p className="text-[6.8px] text-slate-700 font-semibold truncate">
            {ttl}
          </p>
          <p className="text-[6.2px] text-slate-700 font-bold truncate">
            <span className="text-[#008f5d]">NIS:</span> <span className="font-mono">{nis}</span> • <span className="text-[#008f5d]">Kamar:</span> {kamar} ({komplek})
          </p>

          {/* Alamat Santri */}
          <div className="pt-0.5">
            <div className="flex items-center gap-0.5 text-[6.5px] font-black text-[#008f5d]">
              <Home size={7.5} />
              <span>Alamat :</span>
            </div>
            <p className="text-[5.8px] text-slate-600 leading-tight line-clamp-2 max-w-[38mm] font-medium">
              {alamat}
            </p>
          </div>
        </div>

        {/* QR Code Presensi di Depan (Jika Dipilih) */}
        {qrPlacement === 'front' && (
          <div className="shrink-0 flex flex-col items-center justify-center bg-white p-1 rounded-xl border border-teal-600/30 shadow-xs">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code Presensi"
                className="w-[13.5mm] h-[13.5mm] object-contain"
              />
            ) : (
              <div className="w-[13.5mm] h-[13.5mm] bg-white rounded flex items-center justify-center">
                <span className="text-[5px] text-slate-400">QR</span>
              </div>
            )}
            <span className="text-[4.5px] font-mono font-black text-[#008f5d] tracking-wider uppercase mt-0.5">
              SCAN PRESENSI
            </span>
          </div>
        )}
      </div>

      {/* 6. FOOTER: LOGO KTS + BADGE WEBSITE RESMI */}
      <div className="relative z-10 flex items-center justify-between pl-14 pt-0.5 shrink-0">
        <div className="flex items-center gap-1">
          <div className="w-3.5 h-3.5 rounded-full bg-[#008f5d] flex items-center justify-center text-[7.5px] text-white font-black">
            Q
          </div>
          <span className="text-[6.8px] font-black tracking-wide text-[#008f5d] uppercase">
            KARTU TANDA SANTRI
          </span>
        </div>
        <div className="px-2.5 py-0.5 rounded-full bg-[#008f5d] text-white text-[5.8px] font-bold tracking-wide shadow-2xs">
          www.qomaruddin.com
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// SISI BELAKANG KARTU TANDA SANTRI (KTS)
// Dimensi: 85.6mm x 54mm (Tata Tertib & Ketentuan Resmi Pengurus)
// =====================================================================
function KtsBackCard({
  student,
  qrPlacement = 'front'
}: {
  student: ApiRecord;
  qrPlacement?: 'none' | 'front' | 'back';
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const qrCodeValue = `QOMAR-${num(student.id)}-${text(student.nis, '0')}`;

  useEffect(() => {
    if (qrPlacement !== 'back') return;
    let active = true;
    QRCode.toDataURL(qrCodeValue, {
      width: 250,
      margin: 1,
      color: {
        dark: '#008f5d',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((err) => console.error('Gagal generate QR Code KTS Back:', err));

    return () => {
      active = false;
    };
  }, [qrCodeValue, qrPlacement]);

  return (
    <div
      style={{
        width: '85.6mm',
        height: '54mm',
        borderRadius: '3.18mm',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        background: '#ffffff'
      }}
      className="relative text-slate-800 p-2.5 shadow-md border border-slate-200 flex flex-col justify-between overflow-hidden print:shadow-none select-none box-border font-sans"
    >
      {/* 1. TEKSTUR POLA EMBOSSED HONEYCOMB ISLAMI */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="kts-back-hex-pat" width="14" height="24.25" patternUnits="userSpaceOnUse">
            <path
              d="M 7 0 L 14 4.04 L 14 12.12 L 7 16.17 L 0 12.12 L 0 4.04 Z M 0 20.21 L 7 24.25 L 14 20.21"
              fill="none"
              stroke="#008f5d"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#kts-back-hex-pat)" />
      </svg>

      {/* 2. WATERMARK STEMPEL BUNDAR RESMI DI KANAN BAWAH */}
      <svg className="absolute right-[-10mm] bottom-[-10mm] w-[50mm] h-[50mm] pointer-events-none opacity-[0.16] text-[#008f5d]" viewBox="0 0 200 200" fill="none" stroke="currentColor">
        <circle cx="100" cy="100" r="85" strokeWidth="2.5" />
        <circle cx="100" cy="100" r="75" strokeWidth="1.5" strokeDasharray="3,3" />
        <circle cx="100" cy="100" r="55" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="35" strokeWidth="1" />
        <path d="M70 120 C 70 85, 85 70, 100 60 C 115 70, 130 85, 130 120 Z" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
      </svg>

      {/* 3. ORNAMEN KURVA HIJAU KONSENTRIS SISI KIRI KHAS CANVA */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 856 540" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M 0 0 C 180 50, 240 220, 190 380 C 150 470, 90 515, 0 540 L 0 0 Z" fill="#008f5d" />
        <path d="M 0 0 C 145 50, 195 205, 155 365 C 125 435, 60 495, 0 540 L 0 0 Z" fill="#10b981" />
        <path d="M 0 0 L 80 0 C 60 40, 25 70, 0 80 Z" fill="#008f5d" />
        <path d="M 856 460 C 830 470, 790 500, 775 540 L 856 540 Z" fill="#008f5d" />
      </svg>

      {/* 4. KOP RESMI PESANTREN DI TENGAH ATAS */}
      <div className="relative z-10 text-center leading-none px-12 shrink-0 flex flex-col items-center">
        <img
          src={kaligrafiQomaruddin}
          alt="المعهد الإسلامي السلفي قمر الدين"
          className="h-4 w-auto object-contain mx-auto mb-0.5"
        />
        <h4 className="font-black text-[7.5px] text-[#008f5d] tracking-tight uppercase mt-0.5">
          PONDOK PESANTREN QOMARUDDIN
        </h4>
        <p className="text-[5.2px] text-[#008f5d] font-bold tracking-tight mt-0.5">
          Sampurnan Bungah Gresik - NSP : 510035250011
        </p>
      </div>

      {/* 5. ISI KETENTUAN TATA TERTIB RESMI (PERSIS DARI PENGURUS) */}
      <div className="relative z-10 pl-14 pr-6 my-auto flex items-start gap-2">
        {/* Bullet Bulat Hijau Khas Canva di samping butir 1 */}
        <div className="w-3.5 h-3.5 rounded-full bg-[#008f5d] shrink-0 mt-0.5 shadow-xs" />
        <div className="space-y-1 text-[5.8px] sm:text-[6.1px] text-slate-800 leading-snug font-medium flex-1">
          <p className="font-semibold text-slate-900">
            Kartu Tanda Santri wajib dibawa dan digunakan oleh pemiliknya selama berada di lingkungan pesantren.
          </p>
          <p>
            Kartu ini tidak boleh dipindahtangankan, dipalsukan, atau disalahgunakan.
          </p>
          <p>
            Setiap pelanggaran akan dikenakan sanksi sesuai tata tertib pesantren yang berlaku.
          </p>
          <p>
            Kartu yang hilang atau ditemukan wajib segera dilaporkan atau dikembalikan kepada pihak Pondok Pesantren Qomaruddin.
          </p>
        </div>

        {/* QR Code Presensi di Belakang (Jika Dipilih) */}
        {qrPlacement === 'back' && (
          <div className="shrink-0 flex flex-col items-center justify-center bg-white p-1 rounded-xl border border-teal-600/30 shadow-xs">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code Presensi"
                className="w-[14mm] h-[14mm] object-contain"
              />
            ) : (
              <div className="w-[14mm] h-[14mm] bg-white rounded flex items-center justify-center">
                <span className="text-[5px] text-slate-400">QR</span>
              </div>
            )}
            <span className="text-[4.5px] font-mono font-black text-[#008f5d] tracking-wider uppercase mt-0.5">
              SCAN PRESENSI
            </span>
          </div>
        )}
      </div>

      {/* 6. PENGESAHAN PENGASUH DI KIRI BAWAH */}
      <div className="relative z-10 pl-14 pr-12 pt-0.5 shrink-0">
        <div className="text-left leading-tight text-[5.8px] text-slate-700">
          <p className="font-medium text-slate-500">Pemangku,</p>
          <p className="font-medium text-slate-500">Pondok Pesantren Qomaruddin</p>
          <p className="font-black text-slate-900 text-[6.8px] mt-0.5 tracking-tight">
            Dr. KH. M. Ala'uddin, Lc., M.SEI.
          </p>
        </div>
      </div>
    </div>
  );
}
