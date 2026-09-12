import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Clock,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  UserCheck
} from 'lucide-react';
import jsQR from 'jsqr';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, type ApiRecord } from '../services/api';

const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 1024;
};

interface PrayerKioskScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  types: ApiRecord[];
  activeTypeId?: number;
  onAttendanceSuccess?: () => void;
}

// Audio Feedback Menggunakan Web Audio API Synthesizer Native (Instan 0 delay)
class SoundFx {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  playSuccess() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      // Nada naik ceria (C6 -> G6) khas scanner modern
      osc.frequency.setValueAtTime(1046.5, now);
      osc.frequency.exponentialRampToValueAtTime(1567.98, now + 0.12);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Audio tidak diperbolehkan oleh browser policy
    }
  }

  playWarning() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(370, now + 0.1);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Ignored
    }
  }

  playError() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // Ignored
    }
  }
}

const sfx = new SoundFx();

interface ScanLogEntry {
  id: string;
  siswaId: number;
  nama: string;
  nis: string;
  kamar: string;
  komplek: string;
  foto?: string;
  waktu: string;
  statusText: string;
  isAlreadyAttended?: boolean;
}

const POS_LOCATIONS = [
  'Pos 1 - Pintu Utama Masjid',
  'Pos 2 - Pintu Timur (Asrama Putra)',
  'Pos 3 - Pintu Barat (Serambi Depan)',
  'Pos 4 - Serambi Selatan',
  'Pos 5 - Area Khusus Santri Putri'
];

export function PrayerKioskScannerModal({
  isOpen,
  onClose,
  types,
  activeTypeId,
  onAttendanceSuccess
}: PrayerKioskScannerModalProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<number>(activeTypeId || Number(types[0]?.id || 1));
  const [posLocation, setPosLocation] = useState(POS_LOCATIONS[0]);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Santri Preloaded Cache
  const [students, setStudents] = useState<ApiRecord[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);

  // Scanner State
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeStudent, setActiveStudent] = useState<ScanLogEntry | null>(null);
  const [scanLogs, setScanLogs] = useState<ScanLogEntry[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Responsivitas Smartphone Mobile: Segmented Tab, Search Filter & Smart Auto-Scroll
  const [mobileTab, setMobileTab] = useState<'unified' | 'camera' | 'logs'>('unified');
  const [logSearch, setLogSearch] = useState('');
  const [isScrolledToLogs, setIsScrolledToLogs] = useState(false);
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const logsSectionRef = useRef<HTMLDivElement | null>(null);

  const handleMainScroll = (e: React.UIEvent<HTMLElement>) => {
    const top = e.currentTarget.scrollTop;
    setIsScrolledToLogs(top > 140);
  };

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);
  const recentScannedMap = useRef<Map<string, number>>(new Map()); // Debounce map: key -> timestamp

  // Update selectedTypeId saat prop berubah
  useEffect(() => {
    if (activeTypeId) {
      setSelectedTypeId(activeTypeId);
    } else if (types.length > 0 && !selectedTypeId) {
      setSelectedTypeId(Number(types[0].id));
    }
  }, [activeTypeId, types]);

  // Preload Santri Database ke Memori Browser untuk Instant Zero-Lag Display
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadStudents() {
      setIsLoadingStudents(true);
      try {
        const res = await api.siswa({ per_page: 2000, status: 'Aktif' });
        if (isMounted) {
          setStudents(Array.isArray(res.data) ? res.data : []);
        }
      } catch (err) {
        console.error('Gagal preload santri:', err);
      } finally {
        if (isMounted) setIsLoadingStudents(false);
      }
    }

    void loadStudents();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // State Facing Mode Kamera: Default kamera belakang (environment) di perangkat HP/mobile
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(() => {
    return isMobileDevice() ? 'environment' : 'user';
  });

  // Start & Stop Kamera
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    void startCamera(facingMode);
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async (overrideFacingMode?: 'user' | 'environment') => {
    setCameraError(null);
    const targetFacing = overrideFacingMode || facingMode;

    // Bersihkan stream lama jika masih aktif
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      let stream: MediaStream | null = null;

      // 1. Coba dengan constraint ideal facingMode & resolusi HD
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch {
        // 2. Coba tanpa batasan resolusi (beberapa browser HP menolak request jika resolusi di-lock)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: targetFacing === 'environment' ? { ideal: 'environment' } : 'user'
            },
            audio: false
          });
        } catch {
          // 3. Fallback ke kamera default perangkat apapun yang tersedia
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
      }

      if (!stream) {
        throw new Error('Tidak dapat memperoleh stream video.');
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        startScanLoop();
      }
    } catch (err) {
      console.error('Gagal akses kamera dengan mode:', targetFacing, err);
      // Fallback: coba mode sebaliknya jika kamera tertentu tidak tersedia
      if (!overrideFacingMode) {
        try {
          const fallbackFacing = targetFacing === 'user' ? 'environment' : 'user';
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: fallbackFacing },
            audio: false
          });
          streamRef.current = fallbackStream;
          setFacingMode(fallbackFacing);
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            videoRef.current.setAttribute('playsinline', 'true');
            await videoRef.current.play();
            startScanLoop();
          }
          return;
        } catch {
          // Lanjut ke penanganan error
        }
      }
      setCameraError('Kamera tidak dapat diakses atau diblokir oleh browser. Pastikan izin kamera aktif pada browser HP Anda.');
    }
  };

  // Fungsi Putar / Ganti Kamera Depan <-> Belakang
  const switchCamera = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    // Jika ganti ke kamera belakang, matikan efek mirror otomatis agar teks tidak terbalik
    if (nextMode === 'environment') {
      setIsMirrored(false);
    }
    stopCamera();
    // Beri jeda 150ms agar hardware sensor kamera dilepas oleh sistem operasi Android/iOS
    await new Promise((resolve) => setTimeout(resolve, 150));
    await startCamera(nextMode);
  };

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Native Hardware BarcodeDetector Ref (Engine Chromium / WhatsApp Web)
  const barcodeDetectorRef = useRef<any>(null);
  const [isMirrored, setIsMirrored] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const BD = (window as any).BarcodeDetector;
        barcodeDetectorRef.current = new BD({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'codabar']
        });
      } catch (err) {
        console.warn('Native BarcodeDetector tidak tersedia:', err);
      }
    }
  }, []);

  // Loop Scanning Realtime (Multi-Pass Super Scanner: Center Viewfinder, Mirrored Pass, Contrast Boost & Native BD)
  const startScanLoop = () => {
    let isDetectingNative = false;

    // Helper fungsi untuk meningkatkan kontras piksel (Adaptive Contrast Enhancement untuk layar HP yang silau)
    const applyContrastBoost = (data: Uint8ClampedArray, len: number) => {
      for (let i = 0; i < len; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = (r * 77 + g * 150 + b * 29) >> 8;
        // Binarization & high contrast stretch
        const val = gray < 128 ? Math.max(0, gray - 55) : Math.min(255, gray + 55);
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }
    };

    const scan = async () => {
      if (!videoRef.current || !canvasRef.current) {
        animFrameRef.current = requestAnimationFrame(scan);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;

        // Area tengah viewfinder (65% tengah) untuk modul piksel yang padat & tajam
        const cropSize = Math.round(Math.min(vw, vh) * 0.65);
        const sx = Math.round((vw - cropSize) / 2);
        const sy = Math.round((vh - cropSize) / 2);

        // Ukuran crop kanvas 480x480 (sangat tajam & ringan diproses CPU < 3ms)
        const targetDim = 480;
        canvas.width = targetDim;
        canvas.height = targetDim;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (ctx) {
          let foundCode: string | null = null;

          // ==============================================================
          // PASS 1: CROP TENGAH FLIP HORIZONTAL (MIRRORED)
          // PRIORITAS UTAMA: Webcam laptop Windows secara default ter-mirror!
          // ==============================================================
          ctx.save();
          ctx.scale(-1, 1);
          ctx.drawImage(video, sx, sy, cropSize, cropSize, -targetDim, 0, targetDim, targetDim);
          ctx.restore();

          let imgData = ctx.getImageData(0, 0, targetDim, targetDim);
          let qr = jsQR(imgData.data, targetDim, targetDim, { inversionAttempts: 'attemptBoth' });
          if (qr?.data) {
            foundCode = qr.data;
          }

          // ==============================================================
          // PASS 2: CROP TENGAH NORMAL (NON-MIRRORED)
          // ==============================================================
          if (!foundCode) {
            ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, targetDim, targetDim);
            imgData = ctx.getImageData(0, 0, targetDim, targetDim);
            qr = jsQR(imgData.data, targetDim, targetDim, { inversionAttempts: 'attemptBoth' });
            if (qr?.data) {
              foundCode = qr.data;
            }
          }

          // ==============================================================
          // PASS 3: CONTRAST BOOST PADA CROP MIRRORED (LAYAR HP ANTI-SILAU)
          // Membantu membaca layar HP yang backlight-nya terlalu terang
          // ==============================================================
          if (!foundCode) {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(video, sx, sy, cropSize, cropSize, -targetDim, 0, targetDim, targetDim);
            ctx.restore();
            imgData = ctx.getImageData(0, 0, targetDim, targetDim);
            applyContrastBoost(imgData.data, imgData.data.length);
            qr = jsQR(imgData.data, targetDim, targetDim, { inversionAttempts: 'dontInvert' });
            if (qr?.data) {
              foundCode = qr.data;
            }
          }

          // ==============================================================
          // PASS 4: NATIVE HARDWARE BARCODE DETECTOR
          // ==============================================================
          if (!foundCode && barcodeDetectorRef.current && !isDetectingNative) {
            isDetectingNative = true;
            try {
              let barcodes = await barcodeDetectorRef.current.detect(video);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                foundCode = barcodes[0].rawValue;
              } else {
                barcodes = await barcodeDetectorRef.current.detect(canvas);
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  foundCode = barcodes[0].rawValue;
                }
              }
            } catch {
              // Ignore hardware detector limitation
            } finally {
              isDetectingNative = false;
            }
          }

          // ==============================================================
          // PASS 5: FULL FRAME FALLBACK (MIRRORED & NORMAL)
          // ==============================================================
          if (!foundCode) {
            const fullDim = 640;
            const fullW = fullDim;
            const fullH = Math.round((vh / vw) * fullDim);
            canvas.width = fullW;
            canvas.height = fullH;

            // Full Frame Mirrored
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, vw, vh, -fullW, 0, fullW, fullH);
            ctx.restore();

            imgData = ctx.getImageData(0, 0, fullW, fullH);
            qr = jsQR(imgData.data, fullW, fullH, { inversionAttempts: 'attemptBoth' });
            if (qr?.data) {
              foundCode = qr.data;
            }
          }

          // Jika ditemukan kode barcode / QR code
          if (foundCode) {
            handleDetectedCode(foundCode);
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(scan);
    };

    animFrameRef.current = requestAnimationFrame(scan);
  };

  // Parsing Kode (Mendukung: QOMAR-{id}-{nis}, NIS murni, atau ID angka)
  const parseStudentFromCode = (rawCode: string): ApiRecord | undefined => {
    const clean = rawCode.trim();
    if (!clean) return undefined;

    // Format 1: QOMAR-12-0042
    if (clean.toUpperCase().startsWith('QOMAR-')) {
      const parts = clean.split('-');
      const idPart = Number(parts[1] || 0);
      const nisPart = parts[2] || '';

      const foundById = students.find((s) => Number(s.id) === idPart);
      if (foundById) return foundById;

      const foundByNis = students.find((s) => String(s.nis || '').trim() === nisPart.trim());
      if (foundByNis) return foundByNis;
    }

    // Format 2: Cocokkan dengan NIS
    const foundByNis = students.find((s) => String(s.nis || '').trim() === clean);
    if (foundByNis) return foundByNis;

    // Format 3: Cocokkan dengan ID angka
    if (/^\d+$/.test(clean)) {
      const foundById = students.find((s) => Number(s.id) === Number(clean));
      if (foundById) return foundById;
    }

    // Format 4: Cocokkan dengan Nama Santri (Pencarian fleksibel untuk Scan/Ketik Manual)
    if (clean.length >= 3) {
      const query = clean.toLowerCase();
      const foundByName = students.find((s) =>
        String(s.nama || '').toLowerCase().includes(query)
      );
      if (foundByName) return foundByName;
    }

    return undefined;
  };

  // Handler Saat Kode Terdeteksi
  const handleDetectedCode = (rawCode: string) => {
    if (isProcessing) return;

    const cleanCode = rawCode.trim();
    if (!cleanCode) return;

    const matched = parseStudentFromCode(cleanCode);
    const sId = matched ? Number(matched.id) : 0;
    const now = Date.now();
    const cacheKey = sId > 0 ? `id-${sId}` : `code-${cleanCode}`;
    const lastScanTime = recentScannedMap.current.get(cacheKey) || 0;

    // Debounce 6 Detik untuk kode/santri yang sama agar tidak spam berulang di kamera
    if (now - lastScanTime < 6000) {
      return;
    }

    recentScannedMap.current.set(cacheKey, now);
    void processScan(matched, cleanCode);
  };

  const processScan = async (student: ApiRecord | undefined, rawCode: string) => {
    setIsProcessing(true);

    const nowTimeStr = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const studentId = student ? Number(student.id) : 0;
    const nama = student ? String(student.nama || 'Santri') : 'Memverifikasi Santri...';
    const nis = student ? String(student.nis || '-') : rawCode.replace(/^QOMAR-\d+-/i, '');
    const kamar = student ? String(student.kamar || '-') : '-';
    const komplek = student ? String(student.komplek || '-') : '-';
    const foto = student?.foto_santri ? String(student.foto_santri) : undefined;

    // Tampilkan data langsung di layar secara instan
    const logItem: ScanLogEntry = {
      id: `${studentId || rawCode}-${Date.now()}`,
      siswaId: studentId,
      nama,
      nis,
      kamar,
      komplek,
      foto,
      waktu: nowTimeStr,
      statusText: 'Hadir Tepat Waktu'
    };

    setActiveStudent(logItem);
    setScanLogs((prev) => [logItem, ...prev.slice(0, 19)]); // Simpan 20 log terbaru

    // Audio Feedback Instan (Ting! 🔔)
    if (!isMuted) {
      sfx.playSuccess();
    }

    try {
      // Kirim payload quick-scan ke backend (<80 bytes)
      const res = await api.quickScanPrayerAttendance({
        qr_code: rawCode,
        siswa_id: studentId > 0 ? studentId : undefined,
        prayer_attendance_type_id: selectedTypeId,
        device_id: posLocation
      });

      // Update data di layar dengan profil lengkap dari database jika tadi baru terdeteksi
      const serverSiswa = res.data && typeof res.data === 'object' && 'siswa' in res.data ? (res.data as any).siswa : null;
      if (serverSiswa) {
        logItem.nama = String(serverSiswa.nama || logItem.nama);
        logItem.nis = String(serverSiswa.nis || logItem.nis);
        logItem.kamar = String(serverSiswa.kamar || logItem.kamar);
        logItem.komplek = String(serverSiswa.komplek || logItem.komplek);
        if (serverSiswa.foto_santri) logItem.foto = String(serverSiswa.foto_santri);
        setActiveStudent({ ...logItem });
        setScanLogs((prev) => prev.map((item) => (item.id === logItem.id ? { ...logItem } : item)));
      }

      if (res.already_attended) {
        logItem.isAlreadyAttended = true;
        logItem.statusText = 'Sudah Tercatat Sebelumnya';
        if (!isMuted) sfx.playWarning();
      }

      if (onAttendanceSuccess) {
        onAttendanceSuccess();
      }
    } catch (err) {
      console.error('Gagal kirim quick-scan ke server:', err);
      logItem.statusText = 'Tersimpan Lokal (Server Pending)';
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler Manual Barcode Input (USB Barcode Scanner atau Ketik Manual)
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualInput.trim();
    if (!code) return;

    setManualInput('');
    const matched = parseStudentFromCode(code);
    void processScan(matched, code);
  };

  // Toggle Fullscreen Layar Kiosk
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void modalContainerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (!isOpen) return null;

  const currentPrayerName = String(types.find((t) => Number(t.id) === selectedTypeId)?.name || 'Sholat Berjamaah');

  return createPortal(
    <div
      ref={modalContainerRef}
      className="fixed inset-0 h-[100dvh] max-h-[100dvh] z-[99999] bg-slate-950 flex flex-col justify-between overflow-hidden text-white font-sans"
    >
      {/* 1. TOP BAR KIOSK POS (RESPONSIF MOBILE & DESKTOP) */}
      <header className="px-3 sm:px-6 py-2 sm:py-3 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md shrink-0">
        {/* Mobile View Header (sm:hidden): 3 Baris Rapi & Tombol Mode */}
        <div className="flex sm:hidden flex-col gap-2">
          {/* Baris 1 Mobile: Logo + Judul + Tombol Tutup X */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0c6b61] to-[#138F81] shadow-md">
                <UserCheck className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-xs font-black tracking-tight text-white flex items-center gap-1.5">
                  <span>POS SCANNER SHOLAT</span>
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                </h1>
                <p className="text-[10px] text-slate-400 font-semibold truncate max-w-[170px]">
                  {posLocation}
                </p>
              </div>
            </div>

            {/* Tombol Tutup Merah Mudah di-tap di HP */}
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer active:scale-95 shadow-md"
              title="Tutup Pos Scanner"
            >
              <X size={15} />
              <span>Tutup</span>
            </button>
          </div>

          {/* Baris 2 Mobile: Sesi Sholat + Putar Kamera + Mirror + Suara */}
          <div className="flex items-center justify-between gap-1.5">
            <select
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(Number(e.target.value))}
              className="flex-1 min-w-[90px] rounded-xl border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-extrabold text-amber-300 outline-none"
            >
              {types.map((t) => (
                <option key={String(t.id)} value={Number(t.id)}>
                  🕌 {String(t.name)}
                </option>
              ))}
            </select>

            {/* Tombol Putar Kamera Depan / Belakang di Mobile */}
            <button
              type="button"
              onClick={() => void switchCamera()}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
                facingMode === 'environment'
                  ? 'bg-teal-500/25 border-teal-400 text-teal-200'
                  : 'bg-indigo-500/25 border-indigo-400 text-indigo-200'
              }`}
              title="Putar Kamera Depan / Belakang"
            >
              <RefreshCw size={13} className={facingMode === 'environment' ? '' : 'rotate-180'} />
              <span>{facingMode === 'environment' ? '📷 Belakang' : '🤳 Depan'}</span>
            </button>

            {/* Tombol Mirror */}
            <button
              type="button"
              onClick={() => setIsMirrored(!isMirrored)}
              className={`px-2 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                isMirrored
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
              title={isMirrored ? 'Mode Cermin Aktif' : 'Mode Normal Aktif'}
            >
              <span>{isMirrored ? '🪞' : '📷'}</span>
            </button>

            {/* Tombol Suara */}
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className={`p-1.5 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                isMuted
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                  : 'bg-slate-800 border-slate-700 text-teal-300'
              }`}
              title={isMuted ? 'Suara Senyap' : 'Suara Aktif'}
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
          </div>

          {/* Baris 3 Mobile: Segmented Mode Switcher (Kamera vs Riwayat vs Terpadu) */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            <button
              type="button"
              onClick={() => setMobileTab('unified')}
              className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                mobileTab === 'unified'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>⚡ Terpadu</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('camera')}
              className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                mobileTab === 'camera'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>📷 Kamera</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('logs')}
              className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                mobileTab === 'logs'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>📋 Riwayat ({scanLogs.length})</span>
            </button>
          </div>
        </div>

        {/* Desktop View Header (hidden sm:flex): Tampilan Lengkap Kiosk */}
        <div className="hidden sm:flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0c6b61] to-[#138F81] shadow-lg shadow-teal-500/20">
              <UserCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                  <span>POS SCANNER MANDIRI SHOLAT</span>
                  <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                </h1>
              </div>
              <p className="text-xs font-semibold text-slate-400">
                Pondok Pesantren Qomaruddin Sampurnan Bungah
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <select
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(Number(e.target.value))}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-extrabold text-amber-300 outline-none focus:border-[#138F81]"
            >
              {types.map((t) => (
                <option key={String(t.id)} value={Number(t.id)}>
                  🕌 {String(t.name)}
                </option>
              ))}
            </select>

            <select
              value={posLocation}
              onChange={(e) => setPosLocation(e.target.value)}
              className="hidden md:block rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 outline-none focus:border-[#138F81]"
            >
              {POS_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>

            {/* Tombol Putar Kamera Depan / Belakang */}
            <button
              type="button"
              onClick={() => void switchCamera()}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                facingMode === 'environment'
                  ? 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                  : 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
              }`}
              title="Putar Kamera (Depan / Belakang)"
            >
              <RefreshCw size={14} className={facingMode === 'environment' ? '' : 'rotate-180'} />
              <span>{facingMode === 'environment' ? '📷 Kamera Belakang' : '🤳 Kamera Depan'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMirrored(!isMirrored)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                isMirrored
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title={isMirrored ? 'Mode Cermin Aktif (Klik untuk Mode Normal)' : 'Mode Normal Aktif (Klik untuk Mode Cermin)'}
            >
              <span>{isMirrored ? '🪞 Cermin' : '📷 Normal'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isMuted
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                  : 'bg-slate-800 border-slate-700 text-teal-300 hover:bg-slate-700'
              }`}
              title={isMuted ? 'Suara Dinonaktifkan' : 'Suara Aktif (Ting! 🔔)'}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
              title="Layar Penuh (Kiosk)"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>

            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-2 rounded-xl bg-rose-600/90 text-white hover:bg-rose-700 transition-colors cursor-pointer ml-1"
              title="Tutup Pos Scanner"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. BODY KIOSK: RESPONSIF MOBILE & DESKTOP (Touch Friendly, Bebas Scroll Trap) */}
      <main
        ref={mainScrollRef}
        onScroll={handleMainScroll}
        className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 p-2.5 sm:p-4 overflow-y-auto q-scrollbar touch-pan-y scroll-smooth"
      >
        {/* KOLOM KIRI (7 SPAN): KAMERA SCANNER + FRAME FOCUS */}
        <div
          className={`lg:col-span-7 flex flex-col justify-between rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden relative shadow-2xl ${
            mobileTab === 'logs' ? 'hidden lg:flex' : 'flex'
          } min-h-[220px] max-h-[35vh] sm:max-h-[46vh] lg:max-h-none lg:min-h-0`}
        >
          {/* Petunjuk Arahkan KTS */}
          <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between pointer-events-none">
            <div className="rounded-full bg-slate-950/85 backdrop-blur-md px-2.5 py-1 text-[11px] sm:text-xs font-black text-teal-300 border border-teal-500/30 shadow-md flex items-center gap-1.5">
              <Camera size={13} className="text-teal-400 animate-pulse shrink-0" />
              <span className="truncate">Arahkan Barcode KTS (Jarak 20-30 cm)</span>
            </div>

            {/* Tombol Floating Ganti Kamera di Atas Video */}
            <button
              type="button"
              onClick={() => void switchCamera()}
              className="pointer-events-auto rounded-full bg-slate-950/85 hover:bg-teal-900/80 backdrop-blur-md px-2.5 py-1 text-[11px] sm:text-xs font-bold text-slate-200 border border-slate-700 shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              title="Putar Kamera"
            >
              <RefreshCw size={12} className="text-teal-400" />
              <span>{facingMode === 'environment' ? 'Belakang' : 'Depan'}</span>
            </button>
          </div>

          {/* Area Video Kamera */}
          <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden min-h-[160px] sm:min-h-[260px]">
            {cameraError ? (
              <div className="p-6 text-center max-w-md space-y-3">
                <AlertCircle className="h-12 w-12 text-rose-400 mx-auto" />
                <h3 className="text-base font-black text-rose-300">Kamera Tidak Aktif</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-500 transition-colors cursor-pointer"
                >
                  Coba Hubungkan Ulang Kamera
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  className={`w-full h-full object-cover transition-transform ${
                    isMirrored ? 'transform -scale-x-100' : 'transform-none'
                  }`}
                  muted
                  playsInline
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Target Frame Reticle Laser Hijau */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-3">
                  <div className="relative w-44 h-44 sm:w-68 sm:h-68 lg:w-76 lg:h-76 rounded-3xl border-2 border-dashed border-teal-400/70 flex items-center justify-center shadow-[0_0_50px_rgba(19,143,129,0.25)]">
                    {/* Corner Reticles */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-teal-400 rounded-tl-xl" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-teal-400 rounded-tr-xl" />
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-teal-400 rounded-bl-xl" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-teal-400 rounded-br-xl" />

                    {/* Laser Scan Animation Line */}
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-teal-300 to-transparent shadow-[0_0_12px_#138F81] animate-bounce" />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Form Barcode Manual USB / Keyboard Standby */}
          <div className="p-2 sm:p-3 bg-slate-950/90 border-t border-slate-800 flex items-center gap-2">
            <Search size={15} className="text-slate-500 ml-1.5 shrink-0" />
            <form onSubmit={handleManualSubmit} className="flex-1 flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Scan Barcode USB atau Ketik NIS..."
                className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white placeholder:text-slate-500 outline-none focus:border-teal-400"
              />
              <button
                type="submit"
                className="rounded-xl bg-teal-600 hover:bg-teal-500 px-3 py-1.5 text-xs font-black text-white transition-colors cursor-pointer shrink-0"
              >
                Scan
              </button>
            </form>
          </div>
        </div>

        {/* KOLOM KANAN (5 SPAN): KARTU PROFIL SANTRI TERPAMPANG + LOG TERKINI */}
        <div
          ref={logsSectionRef}
          className={`lg:col-span-5 flex flex-col gap-3 sm:gap-4 ${
            mobileTab === 'camera' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* KARTU PROFIL SANTRI TERPAMPANG INSTAN */}
          <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/40 border-2 border-teal-500/40 p-4 sm:p-5 shadow-xl relative overflow-hidden shrink-0">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
              <span className="text-xs font-black tracking-widest text-teal-400 uppercase flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-400" />
                <span>DATA SANTRI TERDETEKSI</span>
              </span>
              <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-0.5 text-xs font-black">
                {currentPrayerName}
              </span>
            </div>

            {activeStudent ? (
              <div className="flex flex-row items-center sm:items-start gap-3.5 animate-in fade-in zoom-in-95 duration-200">
                {/* Foto Profil Santri */}
                <div className="w-20 h-24 sm:w-28 sm:h-36 rounded-2xl border-2 border-amber-400/80 bg-slate-800 overflow-hidden shadow-lg flex items-center justify-center shrink-0">
                  {activeStudent.foto ? (
                    <img
                      src={activeStudent.foto}
                      alt={activeStudent.nama}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-2">
                      <span className="text-3xl sm:text-4xl">👳‍♂️</span>
                    </div>
                  )}
                </div>

                {/* Biodata Santri */}
                <div className="flex-1 min-w-0 space-y-1">
                  <span className="inline-flex items-center gap-1 rounded-md bg-teal-500/20 text-teal-300 text-[10px] font-black px-2 py-0.5 uppercase tracking-wider">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    {activeStudent.statusText}
                  </span>

                  <h2 className="text-base sm:text-xl font-black text-white uppercase tracking-tight truncate">
                    {activeStudent.nama}
                  </h2>

                  <div className="text-xs space-y-0.5 text-slate-300 font-medium">
                    <p className="font-mono text-amber-300 font-bold text-xs">
                      NIS: {activeStudent.nis}
                    </p>
                    <p className="truncate text-slate-300 text-[11.5px]">
                      Kamar: <span className="text-white font-bold">{activeStudent.kamar}</span> ({activeStudent.komplek})
                    </p>
                    <p className="flex items-center gap-1 text-teal-200 text-xs font-bold pt-0.5">
                      <Clock size={12} />
                      <span>{activeStudent.waktu} WIB</span>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-5 sm:py-7 text-center space-y-2">
                <div className="h-11 w-11 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                  <UserCheck size={22} />
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-300">
                  Siap Memindai Kartu Tanda Santri...
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Arahkan barcode KTS ke kamera. Presensi otomatis tersimpan realtime ke server yayasan.
                </p>
              </div>
            )}
          </div>

          {/* RIWAYAT LIVE SCAN SANTRI (Dengan Filter Cari & Bebas Scroll Trap) */}
          <div className="flex-1 rounded-3xl bg-slate-900/90 border border-slate-800 p-3.5 sm:p-4 flex flex-col shadow-lg min-h-[300px] lg:min-h-0">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 shrink-0">
              <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <span>RIWAYAT SCAN POS INI</span>
                <span className="rounded-full bg-teal-500/20 text-teal-300 px-2 py-0.5 text-[10px] font-black">
                  {scanLogs.length} Santri
                </span>
              </h3>
              <span className="text-[10.5px] font-bold text-slate-400">
                Live Sinkron
              </span>
            </div>

            {/* Input Pencarian Cepat di Riwayat Santri */}
            {scanLogs.length > 0 && (
              <div className="relative flex items-center my-2 shrink-0">
                <Search size={13} className="absolute left-3 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Cari nama atau NIS di riwayat..."
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-1.5 pl-8 pr-7 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-teal-500"
                />
                {logSearch && (
                  <button
                    type="button"
                    onClick={() => setLogSearch('')}
                    className="absolute right-2.5 text-slate-500 hover:text-slate-300 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* List Data Riwayat Santri (Bisa di-scroll mulus) */}
            <div className="flex-1 overflow-y-auto q-scrollbar divide-y divide-slate-800/60 pr-1 mt-1 touch-pan-y min-h-[220px] max-h-[460px] lg:max-h-none">
              {scanLogs.length === 0 ? (
                <div className="h-full min-h-[140px] flex items-center justify-center text-center p-6 text-xs font-medium text-slate-500">
                  Belum ada santri yang melakukan presensi pada sesi pos ini.
                </div>
              ) : (
                scanLogs
                  .filter((log) => {
                    if (!logSearch.trim()) return true;
                    const q = logSearch.trim().toLowerCase();
                    return (
                      log.nama.toLowerCase().includes(q) ||
                      log.nis.toLowerCase().includes(q) ||
                      log.kamar.toLowerCase().includes(q)
                    );
                  })
                  .map((log) => (
                    <div key={log.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-teal-900/40 border border-teal-600/40 flex items-center justify-center shrink-0 text-sm">
                          {log.foto ? (
                            <img src={log.foto} alt={log.nama} className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            '👳'
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-200 truncate uppercase">
                            {log.nama}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">
                            NIS: {log.nis} • {log.kamar}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-block rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5">
                          {log.waktu}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 3. FLOATING ACTION BUTTON NAVIGASI DI HP */}
      <div className="sm:hidden fixed bottom-14 right-3.5 z-40 flex flex-col items-end gap-2 pointer-events-auto">
        {!isScrolledToLogs && mobileTab !== 'logs' ? (
          <button
            type="button"
            onClick={() => {
              logsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
              setIsScrolledToLogs(true);
            }}
            className="rounded-full bg-teal-600 hover:bg-teal-500 text-white text-xs font-black px-3.5 py-2 shadow-xl border border-teal-400/50 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <span>📋 Lihat Riwayat ({scanLogs.length})</span>
            <span>⬇️</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              setIsScrolledToLogs(false);
            }}
            className="rounded-full bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-black px-3.5 py-2 shadow-xl border border-slate-600 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <span>📷 Ke Kamera</span>
            <span>⬆️</span>
          </button>
        )}
      </div>

      {/* 4. FOOTER KIOSK STATUS */}
      <footer className="px-4 py-2 bg-slate-900/90 border-t border-slate-800 text-xs font-medium text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          <span>Database Lokal: {isLoadingStudents ? 'Sinkronisasi santri...' : `${students.length} Santri Aktif Siap`}</span>
        </div>

        <div className="text-[11px] text-slate-500 truncate max-w-full">
          💡 Catatan: Notifikasi presensi langsung terkirim ke Aplikasi Wali (PWA) realtime.
        </div>
      </footer>
    </div>,
    document.body
  );
}
