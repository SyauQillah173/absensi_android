import QRCode from 'qrcode';
import { CheckCircle2, MessageCircle, RefreshCw, RotateCcw, Send, Settings, Smartphone, XCircle, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type ApiRecord } from '../services/api';

function asArray(value: unknown): ApiRecord[] {
  return Array.isArray(value) ? (value as ApiRecord[]) : [];
}

function text(value: unknown, fallback = '-'): string {
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

function numberValue(value: unknown): number {
  return Number(value ?? 0) || 0;
}

function statusBadge(status: unknown) {
  const value = text(status, 'unknown').toLowerCase();
  const active = ['aktif', 'ready', 'connected', 'sent'].includes(value);
  const failed = ['failed', 'gagal', 'offline', 'disconnected'].includes(value);
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${
        active ? 'bg-[#DFF7EE] text-[#138F81]' : failed ? 'bg-red-50 text-red-600' : 'bg-[#FFF4D8] text-[#9A6B00]'
      }`}
    >
      {text(status)}
    </span>
  );
}

function CardTitle({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <div className="mb-4 flex min-w-0 items-center gap-2 text-base font-extrabold text-[#1F2933] sm:text-lg">
      <Icon className="shrink-0 text-[#138F81]" size={21} />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

export function WhatsAppBotPage() {
  const [status, setStatus] = useState<ApiRecord | null>(null);
  const [templates, setTemplates] = useState<ApiRecord[]>([]);
  const [settings, setSettings] = useState<ApiRecord[]>([]);
  const [messages, setMessages] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [manual, setManual] = useState({ phone_number: '', message: '' });
  const [clientId, setClientId] = useState('qomaruddin_main');
  const [notice, setNotice] = useState('');
  const qrCanvas = useRef<HTMLCanvasElement | null>(null);

  const sessions = useMemo(() => asArray(status?.sessions), [status]);
  const qrPayload = sessions.find((session) => text(session.qr_code, '') !== '')?.qr_code;
  const counts = (status?.message_counts && typeof status.message_counts === 'object' ? status.message_counts : {}) as ApiRecord;
  const statCards: Array<{ label: string; value: number; icon: LucideIcon }> = [
    { label: 'Sesi Aktif', value: sessions.filter((item) => text(item.status).toLowerCase() === 'aktif').length, icon: CheckCircle2 },
    { label: 'Pending', value: numberValue(counts.pending), icon: RefreshCw },
    { label: 'Terkirim', value: numberValue(counts.sent), icon: Send },
    { label: 'Gagal', value: numberValue(counts.failed), icon: XCircle }
  ];

  async function load() {
    setLoading(true);
    try {
      const [statusResponse, templateResponse, settingResponse, messageResponse] = await Promise.all([
        api.whatsappStatus(),
        api.whatsappTemplates(),
        api.notificationSettings(),
        api.whatsappMessages({ limit: 25 })
      ]);

      setStatus((statusResponse.data ?? {}) as ApiRecord);
      setTemplates(asArray(templateResponse.data));
      setSettings(asArray(settingResponse.data));
      const messageData = (messageResponse.data ?? {}) as ApiRecord;
      setMessages(asArray(messageData.data));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal memuat data WhatsApp.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!qrPayload || !qrCanvas.current) return;
    QRCode.toCanvas(qrCanvas.current, String(qrPayload), { width: 220, margin: 2, color: { dark: '#138F81', light: '#FFFDF7' } }).catch(() => {
      setNotice('QR tersedia, tetapi gagal dirender di browser.');
    });
  }, [qrPayload]);

  async function connect() {
    setSaving(true);
    try {
      const response = await api.whatsappConnect({ client_id: clientId, client_name: 'Qomaruddin Utama' });
      setNotice(response.message || 'Sesi WhatsApp sedang dibuat.');
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal membuat sesi WhatsApp.');
    } finally {
      setSaving(false);
    }
  }

  async function sessionAction(action: 'reconnect' | 'logout', id: string) {
    setSaving(true);
    try {
      const response = action === 'reconnect' ? await api.whatsappReconnect(id) : await api.whatsappLogout(id);
      setNotice(response.message || 'Aksi sesi berhasil diproses.');
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Aksi sesi gagal.');
    } finally {
      setSaving(false);
    }
  }

  async function sendManual() {
    setSaving(true);
    try {
      const response = await api.whatsappSend(manual);
      setNotice(response.message || 'Pesan masuk antrian.');
      setManual({ phone_number: '', message: '' });
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal mengirim pesan.');
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const payload = settings.map((item) => ({
        module: item.module,
        channel_app: Boolean(item.channel_app),
        channel_whatsapp: Boolean(item.channel_whatsapp),
        send_mode: text(item.send_mode, 'manual'),
        template_id: item.template_id ? Number(item.template_id) : null,
        is_active: Boolean(item.is_active),
        retry_limit: numberValue(item.retry_limit) || 3,
        delay_seconds: numberValue(item.delay_seconds)
      }));
      const response = await api.updateNotificationSettings(payload);
      setSettings(asArray(response.data));
      setNotice('Setting notifikasi tersimpan.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal menyimpan setting.');
    } finally {
      setSaving(false);
    }
  }

  async function retryMessage(id: number) {
    setSaving(true);
    try {
      await api.whatsappRetry(id);
      setNotice('Pesan masuk antrian ulang.');
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal retry pesan.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="q-whatsapp-page w-full max-w-full min-w-0 space-y-4 overflow-hidden sm:space-y-6">
      <section className="min-w-0 rounded-[22px] bg-[#FFFDF7] p-4 shadow-xl shadow-black/5 sm:rounded-[26px] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#138F81]">Integrasi WhatsApp</p>
            <h2 className="mt-2 text-xl font-extrabold text-[#1F2933] sm:text-2xl">WhatsApp Bot</h2>
            <p className="mt-1 break-words text-sm font-semibold text-[#636E72]">Status sesi, antrian pesan, template, dan pengaturan channel wali.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#E1EFF7] px-3 text-sm font-extrabold text-[#138F81] sm:px-4" onClick={load} type="button">
              <RefreshCw size={17} /> Refresh
            </button>
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#138F81] px-3 text-sm font-extrabold text-white sm:px-4" disabled={saving} onClick={connect} type="button">
              <Smartphone size={17} /> Connect
            </button>
          </div>
        </div>
        {notice ? <div className="mt-4 rounded-2xl bg-[#FFF4D8] px-4 py-3 text-sm font-bold text-[#7A5A00]">{notice}</div> : null}
      </section>

      <section className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon }) => (
          <div className="min-w-0 rounded-[18px] bg-white p-4 shadow-lg shadow-black/5 sm:rounded-[22px] sm:p-5" key={label}>
            <Icon className="text-[#138F81]" size={22} />
            <p className="mt-3 break-words text-xs font-bold text-[#636E72] sm:mt-4 sm:text-sm">{label}</p>
            <p className="text-2xl font-extrabold text-[#1F2933] sm:text-3xl">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 rounded-[22px] bg-white p-4 shadow-xl shadow-black/5 sm:rounded-[26px] sm:p-5">
          <CardTitle icon={MessageCircle}>Sesi Bot</CardTitle>
          <div className="mb-4 grid min-w-0 gap-2 sm:flex">
            <input className="min-h-11 min-w-0 rounded-2xl border border-[#E1EFF7] px-4 text-sm font-semibold outline-none focus:border-[#138F81] sm:flex-1" value={clientId} onChange={(event) => setClientId(event.target.value)} />
            <button className="min-h-11 rounded-2xl bg-[#FFDC80] px-4 text-sm font-extrabold text-[#5C4600]" disabled={saving} onClick={connect} type="button">
              Buat
            </button>
          </div>
          <div className="hidden min-w-0 overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-[#636E72]">
                <tr>
                  <th className="py-3">Client</th>
                  <th>Status</th>
                  <th>Nomor</th>
                  <th>Kuota</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr className="border-t border-[#E1EFF7]" key={text(session.client_id ?? session.id)}>
                    <td className="py-3 font-extrabold text-[#1F2933]">{text(session.client_id ?? session.id)}</td>
                    <td>{statusBadge(session.status)}</td>
                    <td className="font-semibold text-[#636E72]">{text(session.phone_number ?? session.nomor)}</td>
                    <td className="font-semibold text-[#636E72]">{text((session.metadata as ApiRecord | undefined)?.kuota_sisa ?? session.kuota_sisa)}</td>
                    <td className="py-3 text-right">
                      <button className="mr-2 rounded-xl bg-[#E1EFF7] px-3 py-2 text-xs font-extrabold text-[#138F81]" onClick={() => sessionAction('reconnect', text(session.client_id ?? session.id))} type="button">
                        <RotateCcw size={14} />
                      </button>
                      <button className="rounded-xl bg-red-50 px-3 py-2 text-xs font-extrabold text-red-600" onClick={() => sessionAction('logout', text(session.client_id ?? session.id))} type="button">
                        Logout
                      </button>
                    </td>
                  </tr>
                ))}
                {!sessions.length && !loading ? (
                  <tr>
                    <td className="py-6 text-center font-bold text-[#636E72]" colSpan={5}>Belum ada sesi bot.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {sessions.map((session) => (
              <article className="min-w-0 rounded-[18px] border border-[#E1EFF7] p-3" key={text(session.client_id ?? session.id)}>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-all text-sm font-extrabold text-[#1F2933]">{text(session.client_id ?? session.id)}</p>
                    <p className="mt-1 break-all text-xs font-bold text-[#636E72]">{text(session.phone_number ?? session.nomor, 'Nomor belum tersedia')}</p>
                  </div>
                  {statusBadge(session.status)}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#636E72]">Kuota {text((session.metadata as ApiRecord | undefined)?.kuota_sisa ?? session.kuota_sisa)}</span>
                  <div className="flex shrink-0 gap-2">
                    <button className="grid h-9 w-9 place-items-center rounded-xl bg-[#E1EFF7] text-[#138F81]" onClick={() => sessionAction('reconnect', text(session.client_id ?? session.id))} type="button" aria-label="Reconnect">
                      <RotateCcw size={14} />
                    </button>
                    <button className="min-h-9 rounded-xl bg-red-50 px-3 text-xs font-extrabold text-red-600" onClick={() => sessionAction('logout', text(session.client_id ?? session.id))} type="button">
                      Logout
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {!sessions.length && !loading ? <p className="rounded-[18px] bg-[#F8FAFC] px-4 py-6 text-center text-sm font-bold text-[#636E72]">Belum ada sesi bot.</p> : null}
          </div>
        </div>

        <div className="min-w-0 rounded-[22px] bg-[#FFFDF7] p-4 shadow-xl shadow-black/5 sm:rounded-[26px] sm:p-5">
          <p className="text-lg font-extrabold text-[#1F2933]">QR Login</p>
          <div className="mt-4 flex min-h-[220px] min-w-0 items-center justify-center rounded-[20px] bg-white p-4 sm:min-h-[240px] sm:rounded-[22px]">
            {qrPayload ? <canvas className="max-w-full" ref={qrCanvas} /> : <p className="max-w-full break-words text-center text-sm font-bold leading-6 text-[#636E72]">Tekan Connect atau Reconnect sampai QR tersedia.</p>}
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="min-w-0 rounded-[22px] bg-white p-4 shadow-xl shadow-black/5 sm:rounded-[26px] sm:p-5">
          <CardTitle icon={Send}>Kirim Manual</CardTitle>
          <input className="mb-3 min-h-11 w-full rounded-2xl border border-[#E1EFF7] px-4 text-sm font-semibold outline-none focus:border-[#138F81]" placeholder="62812..." value={manual.phone_number} onChange={(event) => setManual((value) => ({ ...value, phone_number: event.target.value }))} />
          <textarea className="min-h-32 w-full rounded-2xl border border-[#E1EFF7] p-4 text-sm font-semibold outline-none focus:border-[#138F81]" placeholder="Isi pesan" value={manual.message} onChange={(event) => setManual((value) => ({ ...value, message: event.target.value }))} />
          <button className="mt-3 w-full rounded-2xl bg-[#138F81] px-4 py-3 text-sm font-extrabold text-white" disabled={saving || !manual.phone_number || !manual.message} onClick={sendManual} type="button">
            Kirim Pesan
          </button>
        </div>

        <div className="min-w-0 rounded-[22px] bg-white p-4 shadow-xl shadow-black/5 sm:rounded-[26px] sm:p-5">
          <div className="mb-4 grid gap-3 sm:flex sm:items-center sm:justify-between">
            <div className="mb-0 flex min-w-0 items-center gap-2 text-base font-extrabold text-[#1F2933] sm:text-lg">
              <Settings className="shrink-0 text-[#138F81]" size={21} />
              <span className="break-words">Setting Modul</span>
            </div>
            <button className="min-h-10 rounded-2xl bg-[#FFDC80] px-4 text-sm font-extrabold text-[#5C4600]" disabled={saving} onClick={saveSettings} type="button">
              Simpan
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {settings.map((item, index) => (
              <div className="rounded-[20px] border border-[#E1EFF7] p-4" key={text(item.module)}>
                <p className="font-extrabold text-[#1F2933]">{text(item.module)}</p>
                <label className="mt-3 flex items-center justify-between text-sm font-bold text-[#636E72]">
                  Aktif
                  <input checked={Boolean(item.is_active)} type="checkbox" onChange={(event) => setSettings((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, is_active: event.target.checked } : row))} />
                </label>
                <label className="mt-2 flex items-center justify-between text-sm font-bold text-[#636E72]">
                  WhatsApp
                  <input checked={Boolean(item.channel_whatsapp)} type="checkbox" onChange={(event) => setSettings((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, channel_whatsapp: event.target.checked } : row))} />
                </label>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-2">
        <div className="min-w-0 rounded-[22px] bg-white p-4 shadow-xl shadow-black/5 sm:rounded-[26px] sm:p-5">
          <p className="mb-4 text-lg font-extrabold text-[#1F2933]">Template</p>
          <div className="space-y-3">
            {templates.map((template) => (
              <div className="min-w-0 rounded-[20px] border border-[#E1EFF7] p-4" key={text(template.id)}>
                <div className="grid min-w-0 gap-2 sm:flex sm:items-center sm:justify-between sm:gap-3">
                  <p className="min-w-0 break-words font-extrabold text-[#1F2933]">{text(template.name)}</p>
                  {statusBadge(template.is_active ? 'aktif' : 'nonaktif')}
                </div>
                <p className="mt-2 whitespace-pre-line break-words text-sm font-semibold text-[#636E72]">{text(template.message_template)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-[22px] bg-white p-4 shadow-xl shadow-black/5 sm:rounded-[26px] sm:p-5">
          <p className="mb-4 text-lg font-extrabold text-[#1F2933]">Log Pesan</p>
          <div className="space-y-3">
            {messages.map((message) => (
              <div className="min-w-0 rounded-[20px] border border-[#E1EFF7] p-4" key={text(message.id)}>
                <div className="grid min-w-0 gap-2 sm:flex sm:items-center sm:justify-between sm:gap-3">
                  <p className="min-w-0 break-all font-extrabold text-[#1F2933]">{text(message.phone_number)}</p>
                  {statusBadge(message.status)}
                </div>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[#138F81]">{text(message.module)}</p>
                <p className="mt-2 line-clamp-2 break-words text-sm font-semibold text-[#636E72]">{text(message.message)}</p>
                {['failed', 'pending'].includes(text(message.status).toLowerCase()) ? (
                  <button className="mt-3 rounded-xl bg-[#E1EFF7] px-3 py-2 text-xs font-extrabold text-[#138F81]" onClick={() => retryMessage(Number(message.id))} type="button">
                    Retry
                  </button>
                ) : null}
              </div>
            ))}
            {!messages.length && !loading ? <p className="rounded-[20px] bg-[#F8FAFC] p-4 text-center text-sm font-bold text-[#636E72]">Belum ada log pesan.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
