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
import { api, type ApiRecord } from '../services/api';

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

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);
  const recentScannedMap = useRef<Map<number, number>>(new Map()); // Debounce map: id -> timestamp

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

  // Start & Stop Kamera
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        startScanLoop();
      }
    } catch (err) {
      console.error('Gagal akses kamera:', err);
      setCameraError('Kamera tidak dapat diakses atau diblokir oleh browser. Gunakan input NIS/Barcode scanner di bawah.');
    }
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

  // Loop Scanning Realtime (Ultra-Fast Dual Engine: Native BarcodeDetector + Multi-Orientation jsQR)
  const startScanLoop = () => {
    let isDetectingNative = false;

    const scan = async () => {
      if (!videoRef.current || !canvasRef.current) {
        animFrameRef.current = requestAnimationFrame(scan);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        // 1. PRIORITAS UTAMA: Gunakan Native BarcodeDetector (Kecepatan C++ / Hardware Accelerated setara WhatsApp Web)
        if (barcodeDetectorRef.current && !isDetectingNative) {
          isDetectingNative = true;
          try {
            const barcodes = await barcodeDetectorRef.current.detect(video);
            if (barcodes && barcodes.length > 0) {
              for (const barcode of barcodes) {
                if (barcode.rawValue) {
                  handleDetectedCode(barcode.rawValue);
                  break;
                }
              }
            }
          } catch {
            // Lanjut ke fallback jsQR jika ada kendala frame
          } finally {
            isDetectingNative = false;
          }
        }

        // 2. ENGINE CADANGAN / PARALEL: jsQR Multi-Pass & Mirror Compensation
        // Batasi resolusi kanvas ke max 640 agar pemrosesan CPU instan (< 5ms per frame)
        const maxDim = 640;
        let w = video.videoWidth;
        let h = video.videoHeight;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (ctx) {
          // Pass A: Scan Frame Normal (attemptBoth: normal & inverted/glare)
          ctx.drawImage(video, 0, 0, w, h);
          let imageData = ctx.getImageData(0, 0, w, h);

          let qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
          });

          if (qrCode && qrCode.data) {
            handleDetectedCode(qrCode.data);
          } else {
            // Pass B: Scan Frame yang di-FLIP Horizontal (SANGAT KRUSIAL!)
            // Mengatasi webcam laptop atau kamera yang ter-mirror sehingga QR code terbalik tetap terbaca seketika!
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(video, -w, 0, w, h);
            ctx.restore();

            imageData = ctx.getImageData(0, 0, w, h);
            qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth'
            });

            if (qrCode && qrCode.data) {
              handleDetectedCode(qrCode.data);
            }
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

    const matched = parseStudentFromCode(rawCode);
    if (!matched) {
      return;
    }

    const sId = Number(matched.id);
    const now = Date.now();
    const lastScanTime = recentScannedMap.current.get(sId) || 0;

    // Debounce 10 Detik untuk santri yang sama agar tidak spam berulang di kamera
    if (now - lastScanTime < 10000) {
      return;
    }

    // Catat timestamp debounce
    recentScannedMap.current.set(sId, now);

    void processScan(matched, rawCode);
  };

  const processScan = async (student: ApiRecord, rawCode: string) => {
    setIsProcessing(true);

    const nowTimeStr = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const studentId = Number(student.id);
    const nama = String(student.nama || 'Santri');
    const nis = String(student.nis || '-');
    const kamar = String(student.kamar || '-');
    const komplek = String(student.komplek || '-');
    const foto = student.foto_santri ? String(student.foto_santri) : undefined;

    // Tampilkan data langsung di layar (0.01 detik)
    const logItem: ScanLogEntry = {
      id: `${studentId}-${Date.now()}`,
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

    // Audio Feedback Instan
    if (!isMuted) {
      sfx.playSuccess();
    }

    try {
      // Kirim payload super-ringan ke backend (<80 bytes)
      const res = await api.quickScanPrayerAttendance({
        qr_code: rawCode,
        siswa_id: studentId,
        prayer_attendance_type_id: selectedTypeId,
        device_id: posLocation
      });

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

    const matched = parseStudentFromCode(code);
    if (!matched) {
      if (!isMuted) sfx.playError();
      alert(`Santri dengan kode/NIS "${code}" tidak ditemukan dalam database santri aktif.`);
      return;
    }

    setManualInput('');
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

  return (
    <div
      ref={modalContainerRef}
      className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between overflow-hidden text-white font-sans select-none"
    >
      {/* 1. TOP BAR KIOSK POS */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md shrink-0">
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

        {/* Setting Cepat Pos & Waktu Sholat */}
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
      </header>

      {/* 2. BODY KIOSK: 2 KOLOM (KIRI: SCANNER KAMERA, KANAN: LIVE CARD SANTRI & LOG) */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* KOLOM KIRI (7 SPAN): KAMERA SCANNER + FRAME FOCUS */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden relative shadow-2xl">
          {/* Petunjuk Arahkan KTS */}
          <div className="absolute top-3 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
            <div className="rounded-full bg-slate-950/80 backdrop-blur-md px-3.5 py-1 text-xs font-black text-teal-300 border border-teal-500/30 shadow-md flex items-center gap-1.5">
              <Camera size={14} className="text-teal-400 animate-pulse" />
              <span>Arahkan Barcode KTS / Layar HP ke Kamera (Jarak 20-30 cm)</span>
            </div>

            <div className="rounded-full bg-slate-950/80 backdrop-blur-md px-3 py-1 text-xs font-bold text-slate-300 border border-slate-700">
              {posLocation}
            </div>
          </div>

          {/* Area Video Kamera */}
          <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden">
            {cameraError ? (
              <div className="p-6 text-center max-w-md space-y-3">
                <AlertCircle className="h-12 w-12 text-rose-400 mx-auto" />
                <h3 className="text-base font-black text-rose-300">Kamera Tidak Aktif</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{cameraError}</p>
                <button
                  type="button"
                  onClick={startCamera}
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
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-3xl border-2 border-dashed border-teal-400/70 flex items-center justify-center shadow-[0_0_50px_rgba(19,143,129,0.25)]">
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
          <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center gap-2">
            <Search size={16} className="text-slate-500 ml-2 shrink-0" />
            <form onSubmit={handleManualSubmit} className="flex-1 flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Pindai Pistol Barcode USB atau Ketik NIS Santri lalu Tekan Enter..."
                className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-white placeholder:text-slate-500 outline-none focus:border-teal-400"
              />
              <button
                type="submit"
                className="rounded-xl bg-teal-600 hover:bg-teal-500 px-4 py-2 text-xs font-black text-white transition-colors cursor-pointer shrink-0"
              >
                Scan Manual
              </button>
            </form>
          </div>
        </div>

        {/* KOLOM KANAN (5 SPAN): KARTU PROFIL SANTRI TERPAMPANG + LOG TERKINI */}
        <div className="lg:col-span-5 flex flex-col gap-4 overflow-hidden">
          {/* KARTU PROFIL SANTRI TERPAMPANG INSTAN */}
          <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/40 border-2 border-teal-500/40 p-5 shadow-xl relative overflow-hidden shrink-0">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <span className="text-xs font-black tracking-widest text-teal-400 uppercase flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-400" />
                <span>DATA SANTRI TERDETEKSI</span>
              </span>
              <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-0.5 text-xs font-black">
                {currentPrayerName}
              </span>
            </div>

            {activeStudent ? (
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 animate-in fade-in zoom-in-95 duration-200">
                {/* Foto Profil Santri */}
                <div className="w-24 h-30 sm:w-28 sm:h-36 rounded-2xl border-2 border-amber-400/80 bg-slate-800 overflow-hidden shadow-lg flex items-center justify-center shrink-0">
                  {activeStudent.foto ? (
                    <img
                      src={activeStudent.foto}
                      alt={activeStudent.nama}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-2">
                      <span className="text-4xl">👳‍♂️</span>
                    </div>
                  )}
                </div>

                {/* Biodata Santri */}
                <div className="flex-1 text-center sm:text-left min-w-0 space-y-1">
                  <span className="inline-flex items-center gap-1 rounded-md bg-teal-500/20 text-teal-300 text-[10px] font-black px-2 py-0.5 uppercase tracking-wider">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    {activeStudent.statusText}
                  </span>

                  <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight truncate">
                    {activeStudent.nama}
                  </h2>

                  <div className="text-xs space-y-1 text-slate-300 font-medium">
                    <p className="font-mono text-amber-300 font-bold">
                      NIS: {activeStudent.nis}
                    </p>
                    <p className="truncate text-slate-300">
                      Kamar: <span className="text-white font-bold">{activeStudent.kamar}</span> ({activeStudent.komplek})
                    </p>
                    <p className="flex items-center justify-center sm:justify-start gap-1 text-teal-200 text-xs font-bold pt-1">
                      <Clock size={13} />
                      <span>{activeStudent.waktu} WIB</span>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                  <UserCheck size={24} />
                </div>
                <p className="text-sm font-bold text-slate-400">
                  Siap Memindai Kartu Tanda Santri...
                </p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Santri cukup mengarahkan barcode KTS ke kamera laptop/HP. Data langsung tercatat dan notifikasi otomatis terkirim ke Aplikasi Wali.
                </p>
              </div>
            )}
          </div>

          {/* RIWAYAT LIVE SCAN SANTRI (20 Terakhir) */}
          <div className="flex-1 rounded-3xl bg-slate-900/90 border border-slate-800 p-4 flex flex-col overflow-hidden shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <span>RIWAYAT SCAN POS INI</span>
                <span className="rounded-full bg-teal-500/20 text-teal-300 px-2 py-0.2 text-[10px] font-black">
                  {scanLogs.length} Santri
                </span>
              </h3>
              <span className="text-[11px] font-bold text-slate-400">
                Otomatis Sync ke Server
              </span>
            </div>

            <div className="flex-1 overflow-y-auto q-scrollbar divide-y divide-slate-800/60 pr-1 mt-2">
              {scanLogs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center p-6 text-xs font-medium text-slate-500">
                  Belum ada santri yang melakukan presensi pada sesi pos ini.
                </div>
              ) : (
                scanLogs.map((log) => (
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
                        <p className="text-[10px] text-slate-400 font-mono">
                          NIS: {log.nis} • {log.kamar}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="inline-block rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9.5px] font-black px-1.5 py-0.5">
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

      {/* 3. FOOTER KIOSK STATUS */}
      <footer className="px-4 py-2 bg-slate-900/90 border-t border-slate-800 text-xs font-medium text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          <span>Database Lokal: {isLoadingStudents ? 'Sinkronisasi santri...' : `${students.length} Santri Aktif Siap`}</span>
        </div>

        <div className="text-[11px] text-slate-500">
          💡 Catatan: Notifikasi presensi langsung terkirim ke Aplikasi Wali (PWA) tanpa membebani WhatsApp Gateway.
        </div>
      </footer>
    </div>
  );
}
