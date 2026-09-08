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
    // 1. Background Putih Bersih
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 2. Ornamen Watermark Kubah di Kanan Bawah
    ctx.strokeStyle = 'rgba(11, 128, 98, 0.14)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(width - 80, height - 40, 180, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(width - 80, height - 40, 130, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Ornamen Lengkungan Hijau Sisi Kiri (Canva Green Waves)
    // Layer 1: Hijau Toska Cerah
    ctx.fillStyle = '#00A86B';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(190, 60, 290, 260, 210, 460);
    ctx.bezierCurveTo(170, 560, 90, 610, 0, 638);
    ctx.closePath();
    ctx.fill();

    // Layer 2: Hijau Emerald Elegan
    ctx.fillStyle = '#0B8062';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(150, 60, 230, 240, 165, 440);
    ctx.bezierCurveTo(130, 520, 60, 590, 0, 638);
    ctx.closePath();
    ctx.fill();

    // Layer 3: Aksen Hijau Tua Dalam
    ctx.fillStyle = '#065f46';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(105, 50, 165, 210, 105, 400);
    ctx.bezierCurveTo(75, 500, 25, 570, 0, 610);
    ctx.closePath();
    ctx.fill();

    // 4. Kop Surat di Kanan Atas
    // Logo Resmi Qomaruddin
    try {
      const logoImg = await loadImage(qomaruddinLogo);
      ctx.drawImage(logoImg, width - 110, 22, 75, 75);
    } catch {
      // safe fallback
    }

    // Gambar Kaligrafi Arab Asli (Khat Tsuluts Resmi Qomaruddin)
    try {
      const kaligrafiImg = await loadImage(kaligrafiQomaruddin);
      ctx.drawImage(kaligrafiImg, width - 365, 26, 240, 38);
    } catch {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#0B8062';
      ctx.font = 'bold 22px "Amiri", "Traditional Arabic", serif, sans-serif';
      ctx.fillText('المعهد الإسلامي السلفي قمر الدين', width - 125, 46);
    }

    // Teks Kop Latin
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0B8062';
    ctx.font = '900 18px sans-serif';
    ctx.letterSpacing = '0.5px';
    ctx.fillText('PONDOK PESANTREN QOMARUDDIN', width - 125, 75);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 12.5px sans-serif';
    ctx.letterSpacing = '0px';
    ctx.fillText('Sampurnan Bungah Gresik • NSP : 510035250011', width - 125, 96);
    ctx.textAlign = 'left';

    // 5. Pas Foto Santri
    const photoX = 170;
    const photoY = 145;
    const photoW = 210;
    const photoH = 280;

    // Background kotak foto hijau khas Canva
    ctx.fillStyle = '#00A86B';
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, 24);
    ctx.fill();
    ctx.strokeStyle = '#0B8062';
    ctx.lineWidth = 3;
    ctx.stroke();

    let photoDrawn = false;
    if (student.foto_santri) {
      try {
        const photoImg = await loadImage(String(student.foto_santri));
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(photoX, photoY, photoW, photoH, 24);
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

    // 6. Biodata Santri
    const bioX = 410;
    ctx.fillStyle = '#065f46';
    ctx.font = '900 32px sans-serif';
    ctx.fillText(nama, bioX, 185);

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText(ttl, bioX, 222);

    // NIS & Kamar
    ctx.fillStyle = '#0B8062';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText('NIS:', bioX, 258);
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 19px monospace';
    ctx.fillText(nis, bioX + 45, 258);

    ctx.fillStyle = '#0B8062';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText('• Kamar: ' + kamar + ' (' + komplek + ')', bioX + 160, 258);

    // Alamat
    ctx.fillStyle = '#0B8062';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText('🏠 Alamat :', bioX, 298);

    ctx.fillStyle = '#475569';
    ctx.font = '500 16px sans-serif';
    const displayAlamat = alamat.length > 55 ? alamat.slice(0, 52) + '...' : alamat;
    ctx.fillText(displayAlamat, bioX, 326);

    // 7. Pita KTS & Badge Website di Bawah Foto / Alamat
    // Icon Bulat
    ctx.fillStyle = '#00A86B';
    ctx.beginPath();
    ctx.arc(185, 475, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Q', 185, 480);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#065f46';
    ctx.font = '900 19px sans-serif';
    ctx.letterSpacing = '0.5px';
    ctx.fillText('KARTU TANDA SANTRI', 210, 482);
    ctx.letterSpacing = '0px';

    // Badge Pill Website Hijau
    ctx.fillStyle = '#00A86B';
    ctx.beginPath();
    ctx.roundRect(210, 502, 210, 38, 19);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('www.qomaruddin.com', 315, 527);
    ctx.textAlign = 'left';

    // 8. Barcode QR Code Absensi (Sesuai Permintaan Khusus Pengurus)
    const qrSize = 185;
    const qrX = width - qrSize - 55;
    const qrY = 145;

    // Kotak Putih QR dengan Border Hijau
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(qrX, qrY, qrSize, qrSize + 40, 20);
    ctx.fill();
    ctx.strokeStyle = '#0B8062';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    try {
      const qrDataUrl = await QRCode.toDataURL(qrCodeValue, {
        width: 300,
        margin: 1,
        color: { dark: '#065f46', light: '#ffffff' }
      });
      const qrImg = await loadImage(qrDataUrl);
      ctx.drawImage(qrImg, qrX + 10, qrY + 10, qrSize - 20, qrSize - 20);
    } catch {
      // safe fallback
    }

    ctx.fillStyle = '#065f46';
    ctx.font = '900 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SCAN PRESENSI', qrX + qrSize / 2, qrY + qrSize + 26);
    ctx.textAlign = 'left';
  } else {
    // SISI BELAKANG (BACK CARD PERSIS SESUAI CANVA PENGURUS)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 1. Ornamen Sayap Lengkung Hijau Sisi Kiri & Kanan
    // Sisi Kiri
    ctx.fillStyle = '#00A86B';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(160, 80, 210, 250, 160, 440);
    ctx.bezierCurveTo(120, 540, 60, 600, 0, 638);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0B8062';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(110, 70, 150, 220, 120, 410);
    ctx.bezierCurveTo(90, 490, 30, 570, 0, 620);
    ctx.closePath();
    ctx.fill();

    // Sisi Kanan
    ctx.fillStyle = '#00A86B';
    ctx.beginPath();
    ctx.moveTo(width, 0);
    ctx.bezierCurveTo(width - 160, 80, width - 210, 250, width - 160, 440);
    ctx.bezierCurveTo(width - 120, 540, width - 60, 600, width, 638);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0B8062';
    ctx.beginPath();
    ctx.moveTo(width, 0);
    ctx.bezierCurveTo(width - 110, 70, width - 150, 220, width - 120, 410);
    ctx.bezierCurveTo(width - 90, 490, width - 30, 570, width, 620);
    ctx.closePath();
    ctx.fill();

    // 2. Ornamen Watermark Kubah di Kanan Bawah
    ctx.strokeStyle = 'rgba(11, 128, 98, 0.12)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(width - 90, height - 30, 160, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Kop Tengah Atas
    // Gambar Kaligrafi Arab Asli di Tengah
    try {
      const kaligrafiImg = await loadImage(kaligrafiQomaruddin);
      ctx.drawImage(kaligrafiImg, width / 2 - 130, 26, 260, 42);
    } catch {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0B8062';
      ctx.font = 'bold 24px "Amiri", "Traditional Arabic", serif, sans-serif';
      ctx.fillText('المعهد الإسلامي السلفي قمر الدين', width / 2, 58);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#0B8062';
    ctx.font = '900 18px sans-serif';
    ctx.letterSpacing = '0.5px';
    ctx.fillText('PONDOK PESANTREN QOMARUDDIN', width / 2, 88);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 13px sans-serif';
    ctx.letterSpacing = '0px';
    ctx.fillText('Sampurnan Bungah Gresik • NSP : 510035250011', width / 2, 110);
    ctx.textAlign = 'left';

    // 4. Isi Ketentuan Tata Tertib (4 Butir Resmi Pengurus)
    // Bullet Bulat Hijau Khas Canva
    ctx.fillStyle = '#00A86B';
    ctx.beginPath();
    ctx.arc(175, 178, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.font = '600 17.5px sans-serif';
    const rules = [
      'Kartu Tanda Santri wajib dibawa dan digunakan oleh pemiliknya selama berada di lingkungan pesantren.',
      'Kartu ini tidak boleh dipindahtangankan, dipalsukan, atau disalahgunakan.',
      'Setiap pelanggaran akan dikenakan sanksi sesuai tata tertib pesantren yang berlaku.',
      'Kartu yang hilang atau ditemukan wajib segera dilaporkan atau dikembalikan kepada pihak Pondok Pesantren Qomaruddin.'
    ];

    let ruleY = 184;
    rules.forEach((r, idx) => {
      ctx.font = idx === 0 ? '700 17.5px sans-serif' : '500 17.5px sans-serif';
      // Baris pertama rata dengan bullet di x = 205, baris berikutnya di x = 205
      ctx.fillText(r, 205, ruleY);
      ruleY += 46;
    });

    // 5. Pengesahan Pengasuh di Kiri Bawah
    ctx.fillStyle = '#64748b';
    ctx.font = '500 15px sans-serif';
    ctx.fillText('Pemangku,', 170, height - 120);
    ctx.fillText('Pondok Pesantren Qomaruddin', 170, height - 95);

    ctx.fillStyle = '#065f46';
    ctx.font = '900 19px sans-serif';
    ctx.fillText('Dr. KH. M. Ala\'uddin, Lc., M.SEI.', 170, height - 65);
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
// Desain: Deep Royal Emerald & Gold Security Card (Bersih & Elegan)
// =====================================================================
function KtsFrontCard({ student }: { student: ApiRecord }) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const qrCodeValue = `QOMAR-${num(student.id)}-${text(student.nis, '0')}`;

  // Generate QR Code Beresolusi Tinggi (280px untuk ketajaman cetak ~360 DPI)
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(qrCodeValue, {
      width: 280,
      margin: 1,
      color: {
        dark: '#065f46',
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
      {/* 1. TEKSTUR POLA ISLAMI HALUS (ARABESQUE BACKGROUND) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="kts-front-pat" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M14 0 L28 14 L14 28 L0 14 Z" fill="none" stroke="#065f46" strokeWidth="0.5" />
            <circle cx="14" cy="14" r="7" fill="none" stroke="#065f46" strokeWidth="0.4" />
            <circle cx="0" cy="0" r="4" fill="none" stroke="#065f46" strokeWidth="0.4" />
            <circle cx="28" cy="0" r="4" fill="none" stroke="#065f46" strokeWidth="0.4" />
            <circle cx="0" cy="28" r="4" fill="none" stroke="#065f46" strokeWidth="0.4" />
            <circle cx="28" cy="28" r="4" fill="none" stroke="#065f46" strokeWidth="0.4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#kts-front-pat)" />
      </svg>

      {/* 2. WATERMARK KUBAH ARSITEKTUR PESANTREN DI KANAN BAWAH */}
      <svg className="absolute right-0 bottom-0 w-[44mm] h-[36mm] pointer-events-none opacity-[0.14] text-[#065f46]" viewBox="0 0 200 160" fill="currentColor">
        <circle cx="170" cy="130" r="60" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="4,4" />
        <circle cx="170" cy="130" r="45" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="170" cy="130" r="30" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M130 160 C 130 115, 150 95, 170 80 C 190 95, 210 115, 210 160 Z" opacity="0.6" />
      </svg>

      {/* 3. ORNAMEN KURVA HIJAU SISI KIRI (CANVA GREEN CURVED WINGS) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 856 540" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Layer 1: Hijau Toska Cerah */}
        <path d="M 0 0 C 160 50, 240 220, 180 390 C 140 480, 80 520, 0 540 L 0 540 Z" fill="#00A86B" />
        {/* Layer 2: Hijau Emerald Elegan */}
        <path d="M 0 0 C 130 50, 190 200, 140 370 C 110 440, 50 500, 0 540 Z" fill="#0B8062" />
        {/* Layer 3: Aksen Hijau Tua Dalam */}
        <path d="M 0 0 C 90 40, 140 180, 90 340 C 60 420, 20 480, 0 520 Z" fill="#065f46" />
      </svg>

      {/* 4. KOP PESANTREN RESMI DI KANAN ATAS */}
      <div className="relative z-10 flex items-center justify-end gap-2 pl-18 shrink-0">
        <div className="text-right leading-none flex flex-col items-end">
          <img
            src={kaligrafiQomaruddin}
            alt="المعهد الإسلامي السلفي قمر الدين"
            className="h-3.5 w-auto object-contain mb-0.5"
          />
          <h4 className="font-black text-[7.2px] text-[#0B8062] tracking-tight uppercase mt-0.5">
            PONDOK PESANTREN QOMARUDDIN
          </h4>
          <p className="text-[5px] text-slate-500 font-bold tracking-tight mt-0.5">
            Sampurnan Bungah Gresik • NSP : 510035250011
          </p>
        </div>
        <div className="h-7.5 w-7.5 rounded-full bg-white p-0.5 border border-amber-400 shadow-2xs shrink-0 flex items-center justify-center">
          <img
            src={qomaruddinLogo}
            alt="Logo Qomaruddin"
            className="h-full w-full object-contain"
          />
        </div>
      </div>

      {/* 5. BODY: PAS FOTO + BIODATA + QR CODE ABSENSI */}
      <div className="relative z-10 flex items-center gap-2 pl-14 my-auto">
        {/* Pas Foto Santri */}
        <div className="w-[18.5mm] h-[24.5mm] rounded-xl border-1.5 border-[#0B8062] bg-[#00A86B] overflow-hidden shadow-xs flex items-center justify-center shrink-0">
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
          <h3 className="font-black text-[10.5px] text-[#065f46] uppercase leading-tight truncate">
            {nama}
          </h3>
          <p className="text-[6.5px] text-slate-600 font-semibold truncate">
            {ttl}
          </p>
          <p className="text-[6.2px] text-slate-700 font-bold truncate">
            <span className="text-[#0B8062]">NIS:</span> <span className="font-mono">{nis}</span> • <span className="text-[#0B8062]">Kamar:</span> {kamar} ({komplek})
          </p>

          {/* Alamat Santri */}
          <div className="pt-0.5">
            <div className="flex items-center gap-0.5 text-[6px] font-black text-[#0B8062]">
              <Home size={7.5} />
              <span>Alamat :</span>
            </div>
            <p className="text-[5.8px] text-slate-600 leading-tight line-clamp-2 max-w-[34mm] font-medium">
              {alamat}
            </p>
          </div>
        </div>

        {/* QR Code Absensi Santri (Fitur Baru Permintaan Pengurus) */}
        <div className="shrink-0 flex flex-col items-center justify-center bg-white p-1 rounded-xl border border-teal-600/30 shadow-xs">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR Code Presensi"
              className="w-[16mm] h-[16mm] object-contain"
            />
          ) : (
            <div className="w-[16mm] h-[16mm] bg-white rounded flex items-center justify-center">
              <span className="text-[6px] text-slate-400">QR</span>
            </div>
          )}
          <span className="text-[4.8px] font-mono font-black text-[#065f46] tracking-wider uppercase mt-0.5">
            SCAN PRESENSI
          </span>
        </div>
      </div>

      {/* 6. FOOTER: LOGO KTS + BADGE WEBSITE RESMI */}
      <div className="relative z-10 flex items-center justify-between pl-14 pt-0.5 border-t border-slate-200 shrink-0">
        <div className="flex items-center gap-1">
          <div className="w-3.5 h-3.5 rounded-full bg-[#00A86B] flex items-center justify-center text-[7.5px] text-white font-black">
            Q
          </div>
          <span className="text-[6.5px] font-black tracking-wide text-[#065f46] uppercase">
            KARTU TANDA SANTRI
          </span>
        </div>
        <div className="px-2 py-0.5 rounded-full bg-[#00A86B] text-white text-[5.5px] font-black tracking-wide shadow-2xs">
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
function KtsBackCard({ student }: { student: ApiRecord }) {
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
      {/* 1. TEKSTUR POLA ISLAMI HALUS (ARABESQUE BACKGROUND) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="kts-back-pat" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M14 0 L28 14 L14 28 L0 14 Z" fill="none" stroke="#065f46" strokeWidth="0.5" />
            <circle cx="14" cy="14" r="7" fill="none" stroke="#065f46" strokeWidth="0.4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#kts-back-pat)" />
      </svg>

      {/* 2. WATERMARK KUBAH ARSITEKTUR PESANTREN DI KANAN BAWAH */}
      <svg className="absolute right-0 bottom-0 w-[44mm] h-[36mm] pointer-events-none opacity-[0.14] text-[#065f46]" viewBox="0 0 200 160" fill="currentColor">
        <circle cx="170" cy="130" r="60" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="4,4" />
        <circle cx="170" cy="130" r="45" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M130 160 C 130 115, 150 95, 170 80 C 190 95, 210 115, 210 160 Z" opacity="0.6" />
      </svg>

      {/* 3. ORNAMEN KURVA HIJAU DI SISI KIRI & KANAN (CANVA FRAMING) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 856 540" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Sayap Kiri Hijau */}
        <path d="M 0 0 C 140 70, 190 220, 150 380 C 110 460, 60 510, 0 540 Z" fill="#00A86B" />
        <path d="M 0 0 C 100 60, 140 200, 110 360 C 80 430, 30 490, 0 530 Z" fill="#0B8062" />

        {/* Sayap Kanan Hijau */}
        <path d="M 856 0 C 716 70, 666 220, 706 380 C 746 460, 796 510, 856 540 Z" fill="#00A86B" />
        <path d="M 856 0 C 756 60, 716 200, 746 360 C 776 430, 826 490, 856 530 Z" fill="#0B8062" />
      </svg>

      {/* 4. KOP RESMI PESANTREN DI TENGAH ATAS */}
      <div className="relative z-10 text-center leading-none px-12 shrink-0 flex flex-col items-center">
        <img
          src={kaligrafiQomaruddin}
          alt="المعهد الإسلامي السلفي قمر الدين"
          className="h-4 w-auto object-contain mx-auto mb-0.5"
        />
        <h4 className="font-black text-[7.2px] text-[#0B8062] tracking-tight uppercase mt-0.5">
          PONDOK PESANTREN QOMARUDDIN
        </h4>
        <p className="text-[5px] text-slate-500 font-bold tracking-tight mt-0.5">
          Sampurnan Bungah Gresik • NSP : 510035250011
        </p>
      </div>

      {/* 5. ISI KETENTUAN TATA TERTIB RESMI (PERSIS DARI PENGURUS) */}
      <div className="relative z-10 px-12 my-auto">
        <div className="flex items-start gap-1.5">
          {/* Bullet Bulat Hijau Khas Canva */}
          <div className="w-2.5 h-2.5 rounded-full bg-[#00A86B] shrink-0 mt-0.5 shadow-xs" />
          <div className="space-y-1 text-[5.8px] sm:text-[6px] text-slate-800 leading-snug font-medium">
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
        </div>
      </div>

      {/* 6. PENGESAHAN PENGASUH DI KIRI BAWAH */}
      <div className="relative z-10 pl-12 pr-12 pt-0.5 shrink-0">
        <div className="text-left leading-tight text-[5.8px] text-slate-700">
          <p className="font-medium text-slate-500">Pemangku,</p>
          <p className="font-medium text-slate-500">Pondok Pesantren Qomaruddin</p>
          <p className="font-black text-[#065f46] text-[6.5px] mt-1 tracking-tight">
            Dr. KH. M. Ala'uddin, Lc., M.SEI.
          </p>
        </div>
      </div>
    </div>
  );
}
