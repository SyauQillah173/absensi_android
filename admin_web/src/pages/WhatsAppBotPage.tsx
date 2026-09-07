import QRCode from 'qrcode';
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Layers,
  MessageCircle,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Terminal,
  Trash2,
  Wifi,
  WifiOff,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type ApiRecord } from '../services/api';
import { ToastNotification } from '../components/ToastNotification';

function asArray(value: unknown): ApiRecord[] {
  return Array.isArray(value) ? (value as ApiRecord[]) : [];
}

function text(value: unknown, fallback = '-'): string {
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

function numberValue(value: unknown): number {
  return Number(value ?? 0) || 0;
}

export function WhatsAppBotPage() {
  const [status, setStatus] = useState<ApiRecord | null>(null);
  const [templates, setTemplates] = useState<ApiRecord[]>([]);
  const [settings, setSettings] = useState<ApiRecord[]>([]);
  const [messages, setMessages] = useState<ApiRecord[]>([]);
  const [runtimeLogs, setRuntimeLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSync, setAutoSync] = useState(true);

  // Form manual send
  const [manual, setManual] = useState({ phone_number: '', message: '', client_id: '' });
  const [newBotId, setNewBotId] = useState('');
  const [showAddBotModal, setShowAddBotModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'sessions' | 'manual' | 'settings' | 'logs' | 'runtime'>('sessions');

  // Toast
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error' | 'warning' | 'info'; title?: string; message: string }>({
    show: false,
    type: 'success',
    title: '',
    message: '',
  });

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success', title?: string) => {
    setToast({ show: true, type, title, message });
  }, []);

  // QR Canvas Refs
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Parse sessions
  const sessions = useMemo(() => asArray(status?.sessions), [status]);
  const counts = useMemo(
    () => ((status?.message_counts && typeof status.message_counts === 'object' ? status.message_counts : {}) as ApiRecord),
    [status]
  );
  const botHealth = useMemo(
    () => ((status?.bot && typeof status.bot === 'object' ? status.bot : {}) as ApiRecord),
    [status]
  );

  // Sesi yang butuh scan QR
  const pendingQrSession = useMemo(() => {
    return sessions.find((s) => text(s.status).toLowerCase() === 'menunggu_qr' && text(s.qr_code, '') !== '');
  }, [sessions]);

  // Sesi aktif utama
  const activeSessions = useMemo(() => {
    return sessions.filter((s) => ['aktif', 'ready', 'connected'].includes(text(s.status).toLowerCase()));
  }, [sessions]);

  const isGatewayOnline = useMemo(() => {
    const healthStatus = text(botHealth.data ? (botHealth.data as ApiRecord).status : botHealth.status).toLowerCase();
    return healthStatus === 'aktif' || Boolean(botHealth.success) || activeSessions.length > 0 || Boolean(pendingQrSession);
  }, [botHealth, activeSessions, pendingQrSession]);

  // Render QR Canvas saat pendingQrSession berubah
  useEffect(() => {
    if (!pendingQrSession?.qr_code || !qrCanvasRef.current) return;
    QRCode.toCanvas(qrCanvasRef.current, String(pendingQrSession.qr_code), {
      width: 220,
      margin: 2,
      color: { dark: '#0F7A6E', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    }).catch(() => {
      // ignore
    });
  }, [pendingQrSession]);

  // Load status and data
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [statusRes, templateRes, settingRes, messageRes, runtimeRes] = await Promise.all([
        api.whatsappStatus().catch(() => ({ data: null })),
        api.whatsappTemplates().catch(() => ({ data: [] })),
        api.notificationSettings().catch(() => ({ data: [] })),
        api.whatsappMessages({ limit: 30 }).catch(() => ({ data: { data: [] } })),
        api.whatsappRuntimeLogs({ limit: 40 }).catch(() => ({ data: [] })),
      ]);

      if (statusRes.data) {
        setStatus(statusRes.data as ApiRecord);
      }
      setTemplates(asArray(templateRes.data));
      setSettings(asArray(settingRes.data));
      const msgData = (messageRes.data ?? {}) as ApiRecord;
      setMessages(asArray(msgData.data));
      setRuntimeLogs(Array.isArray(runtimeRes.data) ? (runtimeRes.data as string[]) : []);
    } catch {
      if (!silent) {
        showToast('Gagal memuat status WhatsApp Gateway.', 'error', 'Koneksi Terganggu');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto polling setiap 4 detik jika ada QR yang menunggu scan, atau 10 detik default jika autoSync aktif
  useEffect(() => {
    if (!autoSync) return;
    const intervalMs = pendingQrSession ? 3500 : 10000;
    const timer = setInterval(() => {
      loadData(true);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [autoSync, pendingQrSession, loadData]);

  // Handler: Tambah sesi / connect
  const handleConnectSession = async (clientId: string) => {
    const cleanId = clientId.trim().replace(/[^a-zA-Z0-9_-]/g, '') || 'qomaruddin_main';
    setSaving(true);
    try {
      const res = await api.whatsappConnect({ client_id: cleanId, client_name: cleanId });
      showToast(res.message || `Sesi "${cleanId}" sedang dibuat. Tunggu beberapa detik untuk memindai QR Code.`, 'success', 'Sesi Disiapkan');
      setShowAddBotModal(false);
      setNewBotId('');
      await loadData(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyiapkan sesi WhatsApp.', 'error', 'Gagal Membuat Sesi');
    } finally {
      setSaving(false);
    }
  };

  // Handler: Reconnect
  const handleReconnect = async (clientId: string) => {
    setSaving(true);
    try {
      const res = await api.whatsappReconnect(clientId);
      showToast(res.message || `Memulai ulang koneksi sesi "${clientId}"...`, 'info', 'Menghubungkan Ulang');
      await loadData(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mereconnect sesi.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Handler: Logout & Hapus Sesi
  const handleLogout = async (clientId: string) => {
    if (!window.confirm(`Yakin ingin memutus & menghapus sesi WhatsApp "${clientId}"? Anda harus scan QR ulang jika ingin menghubungkannya kembali.`)) {
      return;
    }
    setSaving(true);
    try {
      const res = await api.whatsappLogout(clientId);
      showToast(res.message || `Sesi "${clientId}" berhasil diputus & dihapus.`, 'success', 'Sesi Dimatikan');
      await loadData(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mematikan sesi.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Handler: Kirim pesan manual
  const handleSendManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manual.phone_number.trim() || !manual.message.trim()) {
      showToast('Nomor HP tujuan dan pesan wajib diisi.', 'warning', 'Form Belum Lengkap');
      return;
    }
    setSaving(true);
    try {
      let phone = manual.phone_number.trim().replace(/[\s\-\+]/g, '');
      if (phone.startsWith('08')) phone = '62' + phone.substring(1);
      if (phone.startsWith('8')) phone = '62' + phone;

      const res = await api.whatsappSend({
        phone_number: phone,
        message: manual.message.trim(),
      });
      showToast(res.message || `Pesan berhasil masuk antrian pengiriman ke ${phone}.`, 'success', 'Pesan Terkirim');
      setManual({ phone_number: '', message: '', client_id: '' });
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mengirim pesan WhatsApp.', 'error', 'Pengiriman Gagal');
    } finally {
      setSaving(false);
    }
  };

  // Handler: Simpan settings modul
  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const payload = settings.map((s) => ({
        module: s.module,
        channel_app: Boolean(s.channel_app),
        channel_whatsapp: Boolean(s.channel_whatsapp),
        send_mode: text(s.send_mode, 'manual'),
        template_id: s.template_id ? Number(s.template_id) : null,
        is_active: Boolean(s.is_active),
        retry_limit: numberValue(s.retry_limit) || 3,
        delay_seconds: numberValue(s.delay_seconds) || 0,
      }));
      const res = await api.updateNotificationSettings(payload);
      setSettings(asArray(res.data));
      showToast('Pengaturan modul notifikasi WhatsApp berhasil disimpan.', 'success', 'Pengaturan Tersimpan');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan modul.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Handler: Retry message log
  const handleRetryMessage = async (id: number) => {
    setSaving(true);
    try {
      await api.whatsappRetry(id);
      showToast('Pesan berhasil dijadwalkan untuk dikirim ulang.', 'success', 'Antrian Ulang');
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mengulang pengiriman pesan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Template quick fill
  const applyPresetMessage = (type: 'spp' | 'presensi' | 'pengumuman') => {
    if (type === 'spp') {
      setManual((prev) => ({
        ...prev,
        message: `Assalamu'alaikum Wr. Wb. Bpk/Ibu Wali Santri,\n\nKami menginformasikan tagihan SPP & Syahriyah santri atas nama Ananda *[NAMA_SANTRI]* bulan ini telah terbit. Silakan cek rincian dan konfirmasi pembayaran melalui Portal Wali Santri.\n\nTerima kasih.\n*Bendahara Pondok Pesantren Qomaruddin*`,
      }));
    } else if (type === 'presensi') {
      setManual((prev) => ({
        ...prev,
        message: `Assalamu'alaikum Wr. Wb. Bpk/Ibu Wali Santri,\n\nKami menginformasikan bahwa Ananda *[NAMA_SANTRI]* hari ini tercatat *[STATUS_KEHADIRAN]* pada kegiatan Madrasah Diniyyah Pesantren.\n\nJazakumullah khairan.\n*Pengurus Pondok Pesantren Qomaruddin*`,
      }));
    } else {
      setManual((prev) => ({
        ...prev,
        message: `Assalamu'alaikum Wr. Wb. Seluruh Wali Santri Pesantren Qomaruddin,\n\n[PENGUMUMAN PENTING]: Terkait agenda kedatangan santri dan kegiatan pesantren, kami himbau wali santri untuk memantau informasi terkini melalui portal resmi.\n\nWassalamu'alaikum Wr. Wb.`,
      }));
    }
  };

  return (
    <div className="q-whatsapp-page w-full max-w-full min-w-0 space-y-5 overflow-hidden">
      {/* Universal Floating Toast */}
      <ToastNotification
        show={toast.show}
        type={toast.type}
        title={toast.title}
        message={toast.message}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />

      {/* HEADER HERO */}
      <section className="min-w-0 rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-6 lg:p-7 shadow-xl shadow-black/5 border border-slate-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-[#138F81] border border-teal-200">
                <Bot size={13} />
                WhatsApp Gateway Server
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-black text-amber-800 border border-amber-200">
                <ShieldCheck size={12} />
                Khusus Admin IT
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-800 tracking-tight">
              Pusat Kendali WhatsApp Bot Pesantren
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 leading-relaxed max-w-3xl">
              Satu pintu terintegrasi untuk memindai QR code perangkat tertaut, mengelola multi-sesi bot WhatsApp resmi, memantau antrian pesan realtime, dan mengatur modul notifikasi wali santri.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Indikator Gateway Status */}
            <div className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-black transition-all ${
              isGatewayOnline
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-xs shadow-emerald-500/10'
                : 'bg-rose-50 text-rose-800 border-rose-200 shadow-xs shadow-rose-500/10'
            }`}>
              {isGatewayOnline ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span>Gateway Online</span>
                </>
              ) : (
                <>
                  <WifiOff size={14} className="text-rose-500" />
                  <span>Gateway Offline</span>
                </>
              )}
            </div>

            {/* Tombol Panduan Server */}
            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-100 hover:bg-slate-200 px-3.5 py-2 text-xs font-extrabold text-slate-700 transition cursor-pointer"
            >
              <Terminal size={14} className="text-slate-500" />
              <span>Panduan Server</span>
            </button>

            {/* Tombol Refresh */}
            <button
              type="button"
              onClick={() => loadData(false)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-[#E1EFF7] hover:bg-[#D3E7F2] px-3.5 py-2 text-xs font-black text-[#138F81] transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Menyinkronkan...' : 'Sinkronkan'}</span>
            </button>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-4 pt-5 border-t border-slate-100">
          <div className="rounded-2xl bg-slate-50 p-3.5 sm:p-4 border border-slate-200/80">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">Bot Aktif</span>
              <Smartphone size={16} className="text-[#138F81]" />
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-black text-slate-800">
              {activeSessions.length} <span className="text-xs font-bold text-slate-400">/ {sessions.length} Sesi</span>
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3.5 sm:p-4 border border-slate-200/80">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">Terkirim Hari Ini</span>
              <Send size={16} className="text-emerald-600" />
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-black text-emerald-700">
              {numberValue(counts.sent)}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3.5 sm:p-4 border border-slate-200/80">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">Dalam Antrian</span>
              <Clock size={16} className="text-amber-600" />
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-black text-amber-700">
              {numberValue(counts.pending)}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3.5 sm:p-4 border border-slate-200/80">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">Gagal Kirim</span>
              <XCircle size={16} className="text-rose-600" />
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-black text-rose-700">
              {numberValue(counts.failed)}
            </p>
          </div>
        </div>
      </section>

      {/* ALERT JIKA GATEWAY OFFLINE */}
      {!isGatewayOnline && !loading && (
        <section className="rounded-2xl sm:rounded-3xl bg-amber-50/80 border border-amber-200 p-4 sm:p-5 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-700 mt-0.5">
              <AlertTriangle size={20} />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-sm font-black text-amber-900">
                Service Engine WhatsApp Bot Belum Aktif di Background
              </h4>
              <p className="text-xs font-semibold text-amber-800 leading-relaxed">
                Service WhatsApp Bot di port 3001 belum merespons. Jalankan service bot melalui terminal SSH VPS yayasan atau klik Panduan Server untuk melihat langkahnya.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 text-xs font-black shrink-0 transition cursor-pointer shadow-sm"
          >
            Lihat Perintah Terminal
          </button>
        </section>
      )}

      {/* HERO QR SCANNER & LIVE DEVICE CARD (UNIFIED IN PLACE) */}
      <section className="grid gap-5 lg:grid-cols-12 items-start w-full max-w-full min-w-0">
        {/* KOLOM KIRI: SCANNER QR / LIVE PERANGKAT TERTAUT */}
        <div className="lg:col-span-7 w-full max-w-full min-w-0">
          {pendingQrSession ? (
            /* TAMPILAN QR SCANNER AKTIF */
            <div className="rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-7 shadow-xl shadow-black/5 border-2 border-[#138F81]/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 px-4 py-1 rounded-bl-2xl bg-teal-500 text-white text-[10px] font-black uppercase tracking-wider">
                ⚡ Mode Scan Realtime
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <Smartphone className="text-[#138F81]" size={20} />
                    Pindai QR Code WhatsApp Resmi Pesantren
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 mt-1">
                    Sesi: <span className="font-mono font-black text-[#138F81]">{text(pendingQrSession.client_id || pendingQrSession.id)}</span> — Pindai QR di bawah menggunakan WhatsApp di smartphone Anda.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
                  {/* QR Canvas Box */}
                  <div className="relative p-3 rounded-2xl bg-white border-2 border-dashed border-[#138F81] shadow-md flex items-center justify-center shrink-0">
                    <canvas ref={qrCanvasRef} className="max-w-[200px] h-auto rounded-lg" />
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-[#138F81]"></div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-[#138F81]"></div>
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-[#138F81]"></div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-[#138F81]"></div>
                  </div>

                  {/* Panduan 4 Langkah */}
                  <div className="space-y-2.5 text-xs text-slate-600">
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#138F81] text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</span>
                      <p><strong className="text-slate-800">Buka WhatsApp</strong> di HP yang ingin dijadikan nomor resmi bot pesantren.</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#138F81] text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</span>
                      <p>Ketuk <strong className="text-slate-800">Titik Tiga ⋮</strong> (Android) atau menu <strong className="text-slate-800">Pengaturan ⚙️</strong> (iPhone).</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#138F81] text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">3</span>
                      <p>Pilih menu <strong className="text-slate-800">Perangkat Tertaut (Linked Devices)</strong> ➔ ketuk <strong className="text-slate-800">Tautkan Perangkat</strong>.</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#138F81] text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">4</span>
                      <p><strong className="text-[#138F81]">Arahkan kamera HP</strong> ke kotak QR code di samping kiri. Halaman akan otomatis terhubung seketika!</p>
                    </div>

                    <div className="pt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleReconnect(String(pendingQrSession.client_id || pendingQrSession.id))}
                        disabled={saving}
                        className="rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 transition cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw size={13} />
                        <span>Muat Ulang QR</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLogout(String(pendingQrSession.client_id || pendingQrSession.id))}
                        disabled={saving}
                        className="rounded-xl bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-black text-rose-700 transition cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 size={13} />
                        <span>Batalkan Sesi</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeSessions.length > 0 ? (
            /* TAMPILAN SMARTPHONE EMERALD KARTU PERANGKAT AKTIF */
            <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#0F7A6E] via-[#138F81] to-[#0A524A] p-5 sm:p-7 text-white shadow-xl shadow-[#138F81]/25 relative overflow-hidden">
              <div className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
                      <Smartphone size={22} className="text-[#FFDC80]" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-teal-200 block">Status Gateway Bot</span>
                      <h3 className="text-base sm:text-lg font-black tracking-wide text-white flex items-center gap-2">
                        WhatsApp Resmi Terhubung
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                        </span>
                      </h3>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-black border border-white/30 text-[#FFDC80]">
                    Aktif & Standby
                  </span>
                </div>

                <div className="rounded-2xl bg-black/20 backdrop-blur-md p-4 border border-white/15 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-teal-200">Nama Akun WhatsApp:</span>
                      <p className="text-sm sm:text-base font-black text-white">
                        {text(activeSessions[0].client_name || activeSessions[0].nama, 'Pondok Pesantren Qomaruddin')}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-teal-200">Nomor WhatsApp Resmi:</span>
                      <p className="font-mono text-sm sm:text-base font-black text-[#FFDC80]">
                        {text(activeSessions[0].phone_number || activeSessions[0].nomor, '-')}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-teal-100">
                    <span>ID Sesi: <strong className="text-white font-mono">{text(activeSessions[0].client_id || activeSessions[0].id)}</strong></span>
                    <span>Sisa Kuota Hari Ini: <strong className="text-[#FFDC80] font-black">{text((activeSessions[0].metadata as ApiRecord)?.kuota_sisa ?? activeSessions[0].kuota_sisa, '200')} pesan</strong></span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('manual')}
                    className="rounded-xl bg-white text-[#138F81] hover:bg-teal-50 px-4 py-2 text-xs font-black transition cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    <Send size={14} />
                    <span>Uji Kirim Pesan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReconnect(String(activeSessions[0].client_id || activeSessions[0].id))}
                    disabled={saving}
                    className="rounded-xl bg-white/20 hover:bg-white/30 text-white px-3.5 py-2 text-xs font-black transition cursor-pointer border border-white/25 flex items-center gap-1.5"
                  >
                    <RotateCcw size={14} />
                    <span>Restart Sesi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLogout(String(activeSessions[0].client_id || activeSessions[0].id))}
                    disabled={saving}
                    className="rounded-xl bg-rose-500/30 hover:bg-rose-500/50 text-rose-100 px-3.5 py-2 text-xs font-black transition cursor-pointer border border-rose-300/30 flex items-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    <span>Putus Sesi</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* TAMPILAN BELUM ADA SESI AKTIF */
            <div className="rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-8 shadow-xl shadow-black/5 border border-slate-200 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center mx-auto text-[#138F81]">
                <Smartphone size={28} />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base sm:text-lg font-black text-slate-800">
                  Belum Ada WhatsApp Tertaut
                </h3>
                <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                  Hubungkan nomor WhatsApp resmi pesantren sekarang agar sistem otomatis mengirimkan tagihan SPP, presensi madin/ngaji, dan notifikasi PMB santri.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleConnectSession('qomaruddin_main')}
                  disabled={saving}
                  className="rounded-2xl bg-[#138F81] hover:bg-[#0F7A6E] text-white px-5 py-3 text-xs sm:text-sm font-black shadow-lg shadow-[#138F81]/25 transition cursor-pointer flex items-center gap-2"
                >
                  <Smartphone size={16} />
                  <span>Scan QR Sekarang (Sesi Utama)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddBotModal(true)}
                  className="rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 text-xs sm:text-sm font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <Plus size={16} />
                  <span>Custom ID Bot</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* KOLOM KANAN: DAFTAR SEMUA SESI BOT (MULTI-SESSION) */}
        <div className="lg:col-span-5 w-full max-w-full min-w-0 rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-xl shadow-black/5 border border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-[#138F81]" />
              <h3 className="text-sm sm:text-base font-black text-slate-800">Daftar Sesi WhatsApp</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowAddBotModal(true)}
              className="rounded-xl bg-[#E1EFF7] hover:bg-[#D3E7F2] px-3 py-1 text-xs font-black text-[#138F81] transition cursor-pointer flex items-center gap-1"
            >
              <Plus size={13} />
              <span>Tambah Bot</span>
            </button>
          </div>

          <div className="space-y-2.5 max-h-[340px] overflow-y-auto q-scrollbar pr-1">
            {sessions.map((sess) => {
              const sessId = text(sess.client_id || sess.id);
              const isAktif = ['aktif', 'ready', 'connected'].includes(text(sess.status).toLowerCase());
              const isWaitingQr = text(sess.status).toLowerCase() === 'menunggu_qr';

              return (
                <div
                  key={sessId}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isAktif
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : isWaitingQr
                      ? 'bg-amber-50/60 border-amber-300'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-xs text-slate-800 truncate">{sessId}</span>
                        {isAktif && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black">
                            Aktif
                          </span>
                        )}
                        {isWaitingQr && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[9px] font-black">
                            Scan QR
                          </span>
                        )}
                        {!isAktif && !isWaitingQr && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[9px] font-black">
                            Offline
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 mt-0.5 truncate">
                        {text(sess.phone_number || sess.nomor, 'Nomor belum tertaut')}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleReconnect(sessId)}
                        disabled={saving}
                        title="Restart / Muat Ulang Sesi"
                        className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
                      >
                        <RotateCcw size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLogout(sessId)}
                        disabled={saving}
                        title="Hapus Sesi"
                        className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center transition cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                    <span>Sisa Kuota: <strong className="text-slate-800">{text((sess.metadata as ApiRecord)?.kuota_sisa ?? sess.kuota_sisa, '200')}</strong></span>
                    <span>Terkirim: <strong className="text-emerald-700">{numberValue((sess.metadata as ApiRecord)?.statistik ? ((sess.metadata as ApiRecord)?.statistik as ApiRecord)?.berhasil : 0)}</strong></span>
                  </div>
                </div>
              );
            })}

            {!sessions.length && !loading && (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs font-bold text-slate-500">
                Belum ada sesi bot WhatsApp yang dibuat. Klik "+ Tambah Bot" untuk memulai.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* TABS MENU KONTROL: SANDBOX KIRIM, SETTING MODUL, LOG PESAN, RUNTIME TERMINAL */}
      <section className="rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-6 shadow-xl shadow-black/5 border border-slate-100 space-y-4">
        {/* TAB BUTTONS */}
        <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'manual'
                ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Send size={15} />
            <span>Kirim Pesan Manual & Uji Coba</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Settings size={15} />
            <span>Pengaturan Modul Notifikasi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <MessageSquare size={15} />
            <span>Riwayat Antrian Pesan ({messages.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('runtime')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'runtime'
                ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Terminal size={15} />
            <span>Live Terminal Log ({runtimeLogs.length})</span>
          </button>
        </div>

        {/* CONTENT TAB: KIRIM MANUAL */}
        {activeTab === 'manual' && (
          <form onSubmit={handleSendManual} className="space-y-4 max-w-2xl">
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-800">Kirim Pesan WhatsApp Langsung</h3>
              <p className="text-xs font-semibold text-slate-500">
                Gunakan fitur ini untuk mengirim pengumuman darurat, menguji koneksi bot, atau menghubungi wali santri secara spesifik.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Pilih Sesi Pengirim
              </label>
              <select
                className="q-input font-bold text-gray-800"
                value={manual.client_id}
                onChange={(e) => setManual((prev) => ({ ...prev, client_id: e.target.value }))}
              >
                <option value="">-- Rotasi Otomatis (Round-Robin Semua Bot Aktif) --</option>
                {activeSessions.map((s) => (
                  <option key={text(s.client_id || s.id)} value={text(s.client_id || s.id)}>
                    {text(s.client_id || s.id)} ({text(s.phone_number || s.nomor, 'Nomor aktif')})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Nomor Tujuan (Wali / Penerima)
              </label>
              <input
                type="text"
                className="q-input font-bold"
                placeholder="Contoh: 081234567890 atau 6281234567890"
                value={manual.phone_number}
                onChange={(e) => setManual((prev) => ({ ...prev, phone_number: e.target.value }))}
                required
              />
              <p className="mt-1 text-[11px] font-semibold text-slate-400">
                💡 Awalan `08...` otomatis dikonversi ke format internasional `628...` oleh sistem.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Isi Pesan WhatsApp
                </label>
                <span className="text-[11px] font-bold text-slate-400">
                  {manual.message.length} Karakter
                </span>
              </div>
              <textarea
                rows={5}
                className="q-input font-medium leading-relaxed py-2.5"
                placeholder="Ketik pesan WhatsApp resmi di sini..."
                value={manual.message}
                onChange={(e) => setManual((prev) => ({ ...prev, message: e.target.value }))}
                required
              />

              {/* TEMPLATE QUICK CHIP */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400">Contoh Template Cepat:</span>
                <button
                  type="button"
                  onClick={() => applyPresetMessage('spp')}
                  className="rounded-xl bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition cursor-pointer"
                >
                  💳 Tagihan SPP
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetMessage('presensi')}
                  className="rounded-xl bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition cursor-pointer"
                >
                  📋 Presensi Santri
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetMessage('pengumuman')}
                  className="rounded-xl bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition cursor-pointer"
                >
                  📢 Pengumuman Umum
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || !manual.phone_number.trim() || !manual.message.trim()}
              className="rounded-2xl bg-[#138F81] hover:bg-[#0F7A6E] text-white px-6 py-3.5 text-sm font-black shadow-lg shadow-[#138F81]/25 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <RefreshCw className="animate-spin" size={16} /> : <Send size={16} />}
              <span>{saving ? 'Mengirim Pesan...' : 'Kirim Pesan Sekarang'}</span>
            </button>
          </form>
        )}

        {/* CONTENT TAB: PENGATURAN MODUL NOTIFIKASI OTOMATIS */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-black text-slate-800">Otomatisasi Notifikasi Per Modul</h3>
                <p className="text-xs font-semibold text-slate-500">
                  Pilih modul pesantren mana saja yang diizinkan mengirim pesan WhatsApp otomatis ke wali santri.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={saving}
                className="rounded-2xl bg-[#138F81] hover:bg-[#0F7A6E] text-white px-5 py-2.5 text-xs sm:text-sm font-black transition cursor-pointer disabled:opacity-50 flex items-center gap-2 self-start"
              >
                {saving ? <RefreshCw className="animate-spin" size={15} /> : <Check size={15} />}
                <span>Simpan Pengaturan Modul</span>
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {settings.map((item, idx) => (
                <div key={text(item.module)} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-slate-800 uppercase tracking-wider">
                      {text(item.module).replace('_', ' ')}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(item.is_active)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSettings((prev) => prev.map((s, i) => i === idx ? { ...s, is_active: checked } : s));
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#138F81]"></div>
                    </label>
                  </div>

                  <div className="space-y-1.5 text-xs font-bold text-slate-600">
                    <label className="flex items-center justify-between">
                      <span>Kirim Via WhatsApp:</span>
                      <input
                        type="checkbox"
                        checked={Boolean(item.channel_whatsapp)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSettings((prev) => prev.map((s, i) => i === idx ? { ...s, channel_whatsapp: checked } : s));
                        }}
                        className="rounded text-[#138F81] focus:ring-[#138F81]"
                      />
                    </label>
                    <label className="flex items-center justify-between">
                      <span>Mode Kirim:</span>
                      <select
                        value={text(item.send_mode, 'manual')}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSettings((prev) => prev.map((s, i) => i === idx ? { ...s, send_mode: val } : s));
                        }}
                        className="text-[11px] font-bold rounded-lg border border-slate-200 px-2 py-1 bg-white"
                      >
                        <option value="automatic">Otomatis (Instant)</option>
                        <option value="manual">Manual (Operator)</option>
                      </select>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONTENT TAB: RIWAYAT ANTRIAN PESAN SISTEM */}
        {activeTab === 'logs' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800">Riwayat Antrian Pesan Sistem</h3>
                <p className="text-xs font-semibold text-slate-500">
                  Daftar pesan notifikasi otomatis yang dihasilkan oleh modul presensi, keuangan, dan PMB.
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadData(true)}
                className="rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 transition cursor-pointer"
              >
                Muat Ulang Pesan
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Waktu</th>
                    <th className="px-4 py-3">Tujuan / Santri</th>
                    <th className="px-4 py-3">Modul</th>
                    <th className="px-4 py-3">Isi Pesan</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {messages.map((m) => {
                    const st = text(m.status).toLowerCase();
                    const isSent = ['sent', 'terkirim'].includes(st);
                    const isFailed = ['failed', 'gagal'].includes(st);
                    const isPending = ['pending', 'processing', 'retrying'].includes(st);

                    return (
                      <tr key={text(m.id)} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">
                          {text(m.created_at ? new Date(String(m.created_at)).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-mono font-bold text-slate-800">{text(m.phone_number)}</p>
                          {m.siswa ? (
                            <p className="text-[11px] text-slate-500 font-semibold truncate max-w-[140px]">
                              {(m.siswa as ApiRecord).nama ? String((m.siswa as ApiRecord).nama) : '-'}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-teal-50 text-[#138F81] font-bold text-[10px] uppercase border border-teal-200">
                            {text(m.module)}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate text-slate-600 font-medium">
                          {text(m.message)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {isSent && (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-black text-[10px] border border-emerald-200">
                              Terkirim
                            </span>
                          )}
                          {isPending && (
                            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 font-black text-[10px] border border-amber-200">
                              Antrian
                            </span>
                          )}
                          {isFailed && (
                            <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 font-black text-[10px] border border-rose-200" title={text(m.error_message)}>
                              Gagal
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {isFailed ? (
                            <button
                              type="button"
                              onClick={() => handleRetryMessage(Number(m.id))}
                              className="rounded-xl bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition cursor-pointer"
                            >
                              Kirim Ulang
                            </button>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {!messages.length && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400 font-bold">
                        Belum ada riwayat pesan notifikasi di database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONTENT TAB: LIVE RUNTIME TERMINAL LOG */}
        {activeTab === 'runtime' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800">Live Terminal Runtime Logs Engine</h3>
                <p className="text-xs font-semibold text-slate-500">
                  Streaming log pengiriman detik-per-detik langsung dari background service engine WhatsApp Bot.
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadData(true)}
                className="rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 transition cursor-pointer"
              >
                Refresh Log Engine
              </button>
            </div>

            <div className="rounded-2xl bg-slate-950 p-4 sm:p-5 text-emerald-400 font-mono text-xs leading-relaxed max-h-[400px] overflow-y-auto q-scrollbar border border-slate-800 shadow-inner">
              {runtimeLogs.map((logLine, index) => {
                const isErr = logLine.includes('GAGAL') || logLine.includes('Error');
                const isRetry = logLine.includes('RETRY');
                return (
                  <div
                    key={index}
                    className={`py-0.5 whitespace-pre-wrap break-all ${
                      isErr ? 'text-rose-400 font-bold' : isRetry ? 'text-amber-300' : 'text-emerald-300'
                    }`}
                  >
                    {logLine}
                  </div>
                );
              })}

              {!runtimeLogs.length && (
                <div className="text-slate-500 py-6 text-center">
                  Belum ada log runtime dari engine. Pastikan background service WhatsApp Bot sudah menyala.
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* MODAL: TAMBAH BOT SESI BARU */}
      {showAddBotModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Bot className="text-[#138F81]" size={20} />
                Tambah Sesi Bot Baru
              </h3>
              <button
                type="button"
                onClick={() => setShowAddBotModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs font-semibold text-slate-500 leading-relaxed">
              Buat ID sesi baru untuk bot WhatsApp kedua atau bot cadangan (misal: <code className="font-bold text-[#138F81]">bot_spp</code>, <code className="font-bold text-[#138F81]">bot_pmb</code>, atau <code className="font-bold text-[#138F81]">bot_cs</code>).
            </p>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                ID Bot Baru (Hanya Huruf, Angka & Garis Bawah)
              </label>
              <input
                type="text"
                className="q-input font-bold"
                placeholder="Contoh: bot_keuangan"
                value={newBotId}
                onChange={(e) => setNewBotId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddBotModal(false)}
                className="rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleConnectSession(newBotId)}
                disabled={saving || !newBotId.trim()}
                className="rounded-xl bg-[#138F81] hover:bg-[#0F7A6E] text-white px-5 py-2.5 text-xs font-black transition cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Membuat Sesi...' : 'Lanjut & Pindai QR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PANDUAN SERVER VPS TERMINAL */}
      {showGuideModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto q-scrollbar animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Terminal className="text-[#138F81]" size={20} />
                Panduan Menjalankan Bot di Server Yayasan
              </h3>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                Service engine WhatsApp Bot berjalan mandiri menggunakan Node.js dan PM2 di background server. Jika service belum online, jalankan perintah di bawah ini melalui terminal:
              </p>

              <div className="rounded-2xl bg-slate-900 p-4 text-white font-mono space-y-2 border border-slate-800">
                <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider block">
                  🐧 Di Server VPS Yayasan (Linux / Ubuntu):
                </span>
                <div className="p-2.5 rounded-xl bg-black/40 text-emerald-400 text-xs overflow-x-auto select-all">
                  cd /var/www/ppqomaruddin/WhatsApp_Bot && pm2 start ecosystem.config.js
                </div>
                <p className="text-[11px] text-slate-400">
                  Untuk menyimpan agar otomatis menyala saat server VPS reboot: <br />
                  <code className="text-white">pm2 save && pm2 startup</code>
                </p>
              </div>

              <div className="rounded-2xl bg-slate-900 p-4 text-white font-mono space-y-2 border border-slate-800">
                <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider block">
                  💻 Di Komputer Lokal (Windows Development):
                </span>
                <div className="p-2.5 rounded-xl bg-black/40 text-emerald-400 text-xs overflow-x-auto select-all">
                  cd WhatsApp_Bot && npm start
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 text-teal-900 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-[#138F81]" />
                  Keamanan Sesi Terjamin:
                </p>
                <p className="text-[11px] font-medium text-teal-800">
                  Semua sesi WhatsApp tersimpan secara terenkripsi di folder lokal <code>sessions/</code> pada server. Anda tidak perlu memindai QR code lagi saat server di-restart selama sesi tidak sengaja di-logout dari WhatsApp smartphone.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2 text-xs font-black text-slate-700 transition cursor-pointer"
              >
                Tutup Panduan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
