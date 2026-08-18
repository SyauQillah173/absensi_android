import { CalendarDays, Check, CreditCard, Landmark, Plus, Printer, RefreshCw, Save, Trash2, WalletCards, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import { useAuth } from '../auth/AuthContext';
import { DataTable } from '../components/DataTable';
import { ModalForm } from '../components/ModalForm';
import { formatMoney, MoneyText } from '../components/MoneyText';
import { PostPaymentActionModal } from '../components/PostPaymentActionModal';
import { SearchInput } from '../components/SearchInput';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { api, type ApiRecord, type PaymentFormPayload } from '../services/api';

const monthLabels: Record<number, string> = {
  1: 'Jan',
  2: 'Feb',
  3: 'Mar',
  4: 'Apr',
  5: 'Mei',
  6: 'Jun',
  7: 'Jul',
  8: 'Agu',
  9: 'Sep',
  10: 'Okt',
  11: 'Nov',
  12: 'Des'
};

const tabs = [
  { id: 'today', label: 'Hari Ini' },
  { id: 'history', label: 'Riwayat' },
  { id: 'student', label: 'Per Santri' },
  { id: 'pengeluaran', label: 'Pengeluaran' },
  { id: 'types', label: 'Tipe Bayar' },
  { id: 'methods', label: 'Metode' },
  { id: 'periods', label: 'Periode' },
  { id: 'settings', label: 'Pengaturan' }
];

function num(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function str(value: unknown, fallback = '-'): string {
  const result = String(value ?? '').trim();
  return result || fallback;
}

function record(value: unknown): ApiRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ApiRecord) : {};
}

function idOf(row: ApiRecord | undefined): number {
  return num(row?.id);
}

function isMonthly(type: ApiRecord | undefined): boolean {
  const related = record(type?.periodType);
  const period = String(type?.periode ?? type?.period_type_code ?? related.code ?? '').toLowerCase();
  const periodType = type?.period_type as ApiRecord | undefined;
  return period.includes('bulan') || periodType?.is_monthly === true || related?.is_monthly === true || related?.uses_month === true;
}

function statusTone(status: unknown): 'success' | 'warning' | 'danger' | 'neutral' {
  const clean = String(status ?? '').toLowerCase();
  if (clean.includes('lunas') && !clean.includes('belum')) return 'success';
  if (clean.includes('kurang') || clean.includes('menunggu')) return 'warning';
  if (clean.includes('batal') || clean.includes('non')) return 'danger';
  return 'neutral';
}

export function FinancePage() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState('today');
  const [today, setToday] = useState<ApiRecord[]>([]);
  const [history, setHistory] = useState<ApiRecord[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<ApiRecord[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<ApiRecord[]>([]);
  const [paymentPeriods, setPaymentPeriods] = useState<ApiRecord[]>([]);
  const [students, setStudents] = useState<ApiRecord[]>([]);
  const [academicPeriods, setAcademicPeriods] = useState<ApiRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'payment' | 'type' | 'method' | 'period' | 'pengeluaran' | null>(null);
  const [editing, setEditing] = useState<ApiRecord | null>(null);
  const [billingStudentId, setBillingStudentId] = useState<number>(0);
  const [billingSummary, setBillingSummary] = useState<ApiRecord | null>(null);
  const [chartData, setChartData] = useState<ApiRecord[]>([]);
  const [pengeluaran, setPengeluaran] = useState<ApiRecord[]>([]);
  const [documentSettings, setDocumentSettings] = useState<ApiRecord | null>(null);
  const [successTransaction, setSuccessTransaction] = useState<ApiRecord | null>(null);

  async function load() {
    setIsLoading(true);
    setError('');
    try {
      const [todayResult, historyResult, typesResult, methodsResult, periodsResult, studentsResult, academicResult, chartResult, pengeluaranResult, documentSettingsResult] = await Promise.all([
        api.paymentToday(),
        api.paymentAll(),
        api.paymentTypes(),
        api.paymentMethods(),
        api.paymentPeriodTypes(),
        api.siswa({ with_wali: 1, status: 'Aktif', for_payment: 1 }),
        api.academicPeriods(),
        api.paymentChart(),
        api.pengeluaran(),
        api.documentSettings()
      ]);
      setToday(Array.isArray(todayResult.data) ? todayResult.data : []);
      setHistory(Array.isArray(historyResult.data) ? historyResult.data : []);
      setPaymentTypes(Array.isArray(typesResult.data) ? typesResult.data : []);
      setPaymentMethods(Array.isArray(methodsResult.data) ? methodsResult.data : []);
      setPaymentPeriods(Array.isArray(periodsResult.data) ? periodsResult.data : []);
      setStudents(Array.isArray(studentsResult.data) ? studentsResult.data : []);
      setAcademicPeriods(Array.isArray(academicResult.data) ? academicResult.data : []);
      setChartData(Array.isArray(chartResult.data) ? chartResult.data : []);
      setPengeluaran(Array.isArray(pengeluaranResult.data) ? pengeluaranResult.data : []);
      setDocumentSettings(documentSettingsResult.data as ApiRecord);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data keuangan gagal dimuat');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totalToday = useMemo(() => today.reduce((sum, row) => sum + num(row.jumlah), 0), [today]);
  const activeMethods = paymentMethods.filter((method) => method.is_active !== false);
  const activePeriods = paymentPeriods.filter((period) => period.is_active !== false);
  const activeTypes = paymentTypes.filter((type) => String(type.status ?? 'Aktif') === 'Aktif');

  async function openBilling(studentId = billingStudentId) {
    if (!studentId) return;
    setBillingStudentId(studentId);
    setBillingSummary(null);
    try {
      const activeAcademic = academicPeriods.find((item) => item.is_active === true || item.status === 'Aktif') ?? academicPeriods[0];
      const result = await api.studentBillingSummary({
        user_id: session?.id ?? 0,
        siswa_id: studentId,
        ...(activeAcademic?.id ? { academic_year_id: num(activeAcademic.id) } : {})
      });
      setBillingSummary(result.data && typeof result.data === 'object' ? (result.data as ApiRecord) : result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tagihan santri gagal dimuat');
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#636E72]">Keuangan & Pembayaran</p>
          <h1 className="text-3xl font-extrabold text-[#2D3436]">Keuangan</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={`q-refresh-button flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-[#138F81] ${isLoading ? 'is-loading' : ''}`}
            onClick={() => void load()}
            type="button"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            <RefreshCw className="q-refresh-icon" size={17} />
            {isLoading ? 'Menyegarkan...' : 'Refresh'}
          </button>
          <button className="flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-bold text-white shadow-lg shadow-[#138F81]/25" onClick={() => setModal('payment')} type="button">
            <Plus size={18} />
            Tambah Pembayaran
          </button>
        </div>
      </section>

      {successTransaction ? (
        <PostPaymentActionModal
          transaction={successTransaction}
          onPrint={() => {
            window.open(`/finance/print/${successTransaction.id}`, '_blank', 'noopener,noreferrer');
          }}
          onSendWa={async () => {
            try {
              await api.notifyWaPayment(Number(successTransaction.id));
              alert('Notifikasi WhatsApp sedang dikirim!');
            } catch (err) {
              alert(err instanceof Error ? err.message : 'Gagal mengirim WA');
            }
          }}
          onClose={() => setSuccessTransaction(null)}
        />
      ) : null}

      {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Masuk Hari Ini" value={formatMoney(totalToday)} subtitle={`${today.length} transaksi hari ini`} icon={WalletCards} tone="orange" />
        <StatCard title="Tipe Pembayaran Aktif" value={activeTypes.length} subtitle={`${paymentTypes.length} master tagihan`} icon={Landmark} tone="teal" />
        <StatCard title="Metode Aktif" value={activeMethods.length} subtitle={`${paymentMethods.length} metode tersimpan`} icon={CreditCard} tone="blue" />
      </div>

      <section className="q-card p-5 mb-5">
        <h2 className="text-lg font-extrabold text-[#2D3436] mb-1">Tren Keuangan Tahun {new Date().getFullYear()}</h2>
        <p className="text-xs font-semibold text-[#636E72] mb-4">Grafik Pemasukan vs Pengeluaran Bulanan</p>
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPemasukan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#138F81" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#138F81" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPengeluaran" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF7675" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FF7675" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} tickFormatter={(value) => `Rp ${(value/1000).toFixed(0)}K`} />
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} formatter={(value: any) => formatMoney(value)} />
              <Area type="monotone" dataKey="Pemasukan" stroke="#138F81" strokeWidth={3} fillOpacity={1} fill="url(#colorPemasukan)" />
              <Area type="monotone" dataKey="Pengeluaran" stroke="#FF7675" strokeWidth={3} fillOpacity={1} fill="url(#colorPengeluaran)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <SegmentedTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      <section className="q-panel p-4 sm:p-6">
        {isLoading ? <div className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-bold text-[#636E72]">Memuat data keuangan...</div> : null}
        {!isLoading && activeTab === 'today' ? <PaymentsTable rows={today} emptyText="Belum ada transaksi hari ini." onDelete={async (row) => {
            try {
              await api.deletePaymentTransaction(idOf(row), row.source === 'legacy' ? 'legacy' : 'transaction');
              await load();
            } catch (err) {
              alert('Gagal menghapus transaksi');
            }
          }} /> : null}
        {!isLoading && activeTab === 'history' ? <PaymentsTable rows={history} emptyText="Riwayat pembayaran masih kosong." onDelete={async (row) => {
            try {
              await api.deletePaymentTransaction(idOf(row), row.source === 'legacy' ? 'legacy' : 'transaction');
              await load();
            } catch (err) {
              alert('Gagal menghapus transaksi');
            }
          }} /> : null}
        {!isLoading && activeTab === 'student' ? (
          <StudentBillingPanel students={students} selectedStudentId={billingStudentId} onSelect={openBilling} summary={billingSummary} />
        ) : null}
        {!isLoading && activeTab === 'pengeluaran' ? (
          <PengeluaranPanel
            rows={pengeluaran}
            onCreate={() => {
              setEditing(null);
              setModal('pengeluaran');
            }}
            onEdit={(row) => {
              setEditing(row);
              setModal('pengeluaran');
            }}
            onDelete={async (row) => {
              await api.deletePengeluaran(idOf(row));
              await load();
            }}
          />
        ) : null}
        {!isLoading && activeTab === 'types' ? (
          <MasterPaymentTypes
            rows={paymentTypes}
            onCreate={() => {
              setEditing(null);
              setModal('type');
            }}
            onEdit={(row) => {
              setEditing(row);
              setModal('type');
            }}
          />
        ) : null}
        {!isLoading && activeTab === 'methods' ? (
          <PaymentMethodsPanel
            rows={paymentMethods}
            onCreate={() => {
              setEditing(null);
              setModal('method');
            }}
            onEdit={(row) => {
              setEditing(row);
              setModal('method');
            }}
            onDelete={async (row) => {
              await api.deletePaymentMethod(idOf(row));
              await load();
            }}
          />
        ) : null}
        {!isLoading && activeTab === 'periods' ? (
          <PaymentPeriodsPanel
            rows={paymentPeriods}
            onCreate={() => {
              setEditing(null);
              setModal('period');
            }}
            onEdit={(row) => {
              setEditing(row);
              setModal('period');
            }}
            onDelete={async (row) => {
              await api.deletePaymentPeriodType(idOf(row));
              await load();
            }}
          />
        ) : null}
        {!isLoading && activeTab === 'settings' ? (
          <DocumentSettingsPanel settings={documentSettings} onSaved={load} />
        ) : null}
      </section>

      {modal === 'payment' ? (
        <PaymentModal
          userId={session?.id ?? 0}
          students={students}
          paymentTypes={activeTypes}
          paymentMethods={activeMethods}
          academicPeriods={academicPeriods}
          onClose={() => setModal(null)}
          onSaved={async (trx) => {
            setModal(null);
            if (trx) setSuccessTransaction(trx);
            await load();
            if (billingStudentId) await openBilling(billingStudentId);
          }}
        />
      ) : null}
      {modal === 'type' ? (
        <PaymentTypeModal
          row={editing}
          paymentMethods={activeMethods}
          paymentPeriods={activePeriods}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            setEditing(null);
            await load();
          }}
        />
      ) : null}
      {modal === 'method' ? (
        <PaymentMethodModal
          row={editing}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            setEditing(null);
            await load();
          }}
        />
      ) : null}
      {modal === 'period' ? (
        <PaymentPeriodModal
          row={editing}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            setEditing(null);
            await load();
          }}
        />
      ) : null}
      {modal === 'pengeluaran' ? (
        <PengeluaranModal
          row={editing}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            setEditing(null);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function PaymentsTable({ rows, emptyText, onDelete }: { rows: ApiRecord[]; emptyText: string; onDelete?: (row: ApiRecord) => void }) {
  return (
    <DataTable
      rows={rows}
      emptyText={emptyText}
      columns={[
        { key: 'siswa', header: 'Santri', render: (row) => str(row.siswa_nama ?? row.nama_siswa ?? row.nama) },
        { key: 'atas', header: 'Atas Nama', render: (row) => str(row.atas_nama ?? row.wali_nama) },
        { key: 'jenis', header: 'Jenis', render: (row) => str(row.jenis ?? row.payment_type_name) },
        { key: 'jumlah', header: 'Nominal', render: (row) => <MoneyText value={row.jumlah} className="font-extrabold text-[#138F81]" /> },
        { key: 'via', header: 'Metode', render: (row) => str(row.via ?? row.payment_method_name) },
        { key: 'status', header: 'Status', render: (row) => <StatusBadge label={str(row.status, 'Tercatat')} tone={statusTone(row.status)} /> },
        ...(onDelete ? [{ key: 'actions', header: '', render: (row: ApiRecord) => (
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                if (confirm('Yakin ingin menghapus transaksi ini?')) {
                  onDelete(row);
                }
              }}
              className="rounded-xl bg-red-50 p-2 text-red-600 hover:bg-red-100"
              title="Hapus Pembayaran"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) }] : [])
      ]}
    />
  );
}

function StudentBillingPanel({
  students,
  selectedStudentId,
  onSelect,
  summary
}: {
  students: ApiRecord[];
  selectedStudentId: number;
  onSelect: (id: number) => void;
  summary: ApiRecord | null;
}) {
  const [search, setSearch] = useState('');
  const filtered = students.filter((student) => {
    const text = `${student.nama ?? ''} ${student.nis ?? ''} ${student.nisn ?? ''} ${student.kelas ?? ''}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });
  const student = students.find((item) => num(item.id) === selectedStudentId);
  const totals = (summary?.summary ?? summary) as ApiRecord | undefined;
  const groups = Array.isArray(summary?.groups) ? (summary.groups as ApiRecord[]) : [];
  const monthly = groups.length > 0
    ? groups.flatMap((g) => (Array.isArray(g.monthly) ? g.monthly : []))
    : Array.isArray(summary?.monthly) ? (summary.monthly as ApiRecord[]) : Array.isArray(summary?.monthly_items) ? (summary?.monthly_items as ApiRecord[]) : [];
  const general = groups.length > 0
    ? groups.flatMap((g) => (Array.isArray(g.general) ? g.general : []))
    : Array.isArray(summary?.general) ? (summary.general as ApiRecord[]) : Array.isArray(summary?.general_items) ? (summary?.general_items as ApiRecord[]) : [];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari nama / NIS / NISN / kelas" />
        <select className="q-input" value={selectedStudentId || ''} onChange={(event) => onSelect(Number(event.target.value))}>
          <option value="">Pilih santri</option>
          {filtered.map((item) => (
            <option key={num(item.id)} value={num(item.id)}>
              {str(item.nama)} - {str(item.nis)} - {str(item.kelas)}
            </option>
          ))}
        </select>
      </div>

      {student ? (
        <div className="q-card p-5">
          <h3 className="text-lg font-extrabold text-[#2D3436]">{str(student.nama)}</h3>
          <p className="text-sm font-semibold text-[#636E72]">{str(student.nis)} • {str(student.kelas)} • Wali: {str(student.wali_nama ?? student.nama_wali)}</p>
        </div>
      ) : null}

      {summary ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryBox title="Tagihan" value={totals?.total_tagihan ?? totals?.amount ?? 0} tone="blue" />
            <SummaryBox title="Dibayar" value={totals?.total_dibayar ?? totals?.paid_amount ?? 0} tone="teal" />
            <SummaryBox title="Kurang" value={totals?.total_kurang_bayar ?? totals?.remaining_amount ?? 0} tone="red" />
            <SummaryBox title="Menunggu" value={totals?.total_menunggu ?? totals?.pending_amount ?? 0} tone="orange" />
          </div>
          <section className="q-card p-5">
            <h3 className="mb-4 text-lg font-extrabold text-[#2D3436]">Pembayaran Bulanan</h3>
            <div className="overflow-x-auto q-scrollbar">
              <table className="w-full min-w-[760px] border-separate border-spacing-2">
                <tbody>
                  {monthly.length === 0 ? (
                    <tr><td className="rounded-2xl bg-[#E1EFF7] p-5 text-center text-sm font-bold text-[#636E72]">Belum ada tagihan bulanan.</td></tr>
                  ) : (
                    monthly.map((item) => {
                      const months = Array.isArray(item.months) ? (item.months as ApiRecord[]) : Array.isArray(item.items) ? (item.items as ApiRecord[]) : [item];
                      return (
                        <tr key={str(item.payment_type_id ?? item.id ?? item.name)}>
                          <td className="rounded-2xl bg-white px-4 py-3 text-sm font-extrabold">{str(item.name ?? item.nama ?? item.payment_type_name ?? 'SPP')}</td>
                          {months.map((month) => {
                            const monthNo = num(month.month ?? month.period_month ?? month.month_code);
                            const paid = month.is_paid === true || String(month.status ?? '').toLowerCase() === 'lunas';
                            return (
                              <td key={`${str(item.id)}-${monthNo}`} className={`h-14 min-w-16 rounded-2xl text-center text-sm font-extrabold ${paid ? 'bg-[#138F81] text-white' : 'bg-[#D9E4EA] text-[#636E72]'}`}>
                                <div>{str(month.label ?? monthLabels[monthNo] ?? monthNo)}</div>
                                <div>{paid ? <Check className="mx-auto" size={18} /> : <X className="mx-auto" size={18} />}</div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section className="q-card p-5">
            <h3 className="mb-4 text-lg font-extrabold text-[#2D3436]">Pembayaran Umum</h3>
            <DataTable
              rows={general}
              emptyText="Belum ada tagihan umum."
              columns={[
                { key: 'nama', header: 'Tipe', render: (row) => str(row.name ?? row.nama ?? row.payment_type_name) },
                { key: 'tagihan', header: 'Tagihan', render: (row) => <MoneyText value={row.amount ?? row.amount_due} /> },
                { key: 'dibayar', header: 'Dibayar', render: (row) => <MoneyText value={row.paid_amount} /> },
                { key: 'kurang', header: 'Kurang', render: (row) => <MoneyText value={row.remaining_amount} /> },
                { key: 'status', header: 'Status', render: (row) => <StatusBadge label={str(row.display_status ?? row.status)} tone={statusTone(row.display_status ?? row.status)} /> }
              ]}
            />
          </section>
        </>
      ) : (
        <div className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-bold text-[#636E72]">Pilih santri untuk melihat tagihan.</div>
      )}
    </div>
  );
}

function SummaryBox({ title, value, tone }: { title: string; value: unknown; tone: 'blue' | 'teal' | 'red' | 'orange' }) {
  const color = { blue: 'text-[#2E86DE]', teal: 'text-[#138F81]', red: 'text-[#D63031]', orange: 'text-[#E65100]' }[tone];
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className="text-xs font-bold text-[#636E72]">{title}</p>
      <p className={`mt-2 text-lg font-extrabold ${color}`}>{formatMoney(value)}</p>
    </div>
  );
}

function MasterPaymentTypes({ rows, onCreate, onEdit }: { rows: ApiRecord[]; onCreate: () => void; onEdit: (row: ApiRecord) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-bold text-white" onClick={onCreate} type="button">
          <Plus size={17} /> Tambah Tipe
        </button>
      </div>
      <DataTable
        rows={rows}
        columns={[
          { key: 'nama', header: 'Nama', render: (row) => <span className="font-extrabold">{str(row.nama)}</span> },
          { key: 'nominal', header: 'Nominal', render: (row) => <MoneyText value={row.nominal_default} /> },
          { key: 'periode', header: 'Periode', render: (row) => str(row.periode ?? record(row.periodType).name) },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge label={str(row.status, 'Aktif')} tone={statusTone(row.status)} /> },
          { key: 'aksi', header: 'Aksi', render: (row) => <button className="rounded-xl bg-[#EAF4FF] px-3 py-2 text-xs font-bold text-[#2E86DE]" onClick={() => onEdit(row)} type="button">Edit</button> }
        ]}
      />
    </div>
  );
}

function PaymentMethodsPanel({
  rows,
  onCreate,
  onEdit,
  onDelete
}: {
  rows: ApiRecord[];
  onCreate: () => void;
  onEdit: (row: ApiRecord) => void;
  onDelete: (row: ApiRecord) => Promise<void>;
}) {
  return <CrudPanel rows={rows} type="method" onCreate={onCreate} onEdit={onEdit} onDelete={onDelete} />;
}

function PaymentPeriodsPanel({
  rows,
  onCreate,
  onEdit,
  onDelete
}: {
  rows: ApiRecord[];
  onCreate: () => void;
  onEdit: (row: ApiRecord) => void;
  onDelete: (row: ApiRecord) => Promise<void>;
}) {
  return <CrudPanel rows={rows} type="period" onCreate={onCreate} onEdit={onEdit} onDelete={onDelete} />;
}

function CrudPanel({
  rows,
  type,
  onCreate,
  onEdit,
  onDelete
}: {
  rows: ApiRecord[];
  type: 'method' | 'period';
  onCreate: () => void;
  onEdit: (row: ApiRecord) => void;
  onDelete: (row: ApiRecord) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="flex min-h-11 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-bold text-white" onClick={onCreate} type="button">
          <Plus size={17} /> Tambah {type === 'method' ? 'Metode' : 'Periode'}
        </button>
      </div>
      <DataTable
        rows={rows}
        columns={[
          { key: 'nama', header: 'Nama', render: (row) => <span className="font-extrabold">{str(row.name)}</span> },
          { key: 'kode', header: 'Kode', render: (row) => str(row.code) },
          { key: 'urutan', header: 'Urutan Tampil', render: (row) => str(row.sort_order) },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge label={row.is_active === false ? 'Nonaktif' : 'Aktif'} tone={row.is_active === false ? 'danger' : 'success'} /> },
          {
            key: 'aksi',
            header: 'Aksi',
            render: (row) => (
              <div className="flex gap-2">
                <button className="rounded-xl bg-[#EAF4FF] px-3 py-2 text-xs font-bold text-[#2E86DE]" onClick={() => onEdit(row)} type="button">Edit</button>
                <button className="rounded-xl bg-[#FDECEC] px-3 py-2 text-xs font-bold text-[#D63031]" onClick={() => void onDelete(row)} type="button"><Trash2 size={14} /></button>
              </div>
            )
          }
        ]}
      />
    </div>
  );
}

function PaymentModal({
  userId,
  students,
  paymentTypes,
  paymentMethods,
  academicPeriods,
  onClose,
  onSaved
}: {
  userId: number;
  students: ApiRecord[];
  paymentTypes: ApiRecord[];
  paymentMethods: ApiRecord[];
  academicPeriods: ApiRecord[];
  onClose: () => void;
  onSaved: (transaction?: ApiRecord) => Promise<void>;
}) {
  const [studentId, setStudentId] = useState(0);
  const [typeId, setTypeId] = useState(0);
  const [methodId, setMethodId] = useState(0);
  const [academicYearId, setAcademicYearId] = useState(num(academicPeriods.find((item) => item.is_active === true)?.id ?? academicPeriods[0]?.id));
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const selectedStudent = students.find((row) => num(row.id) === studentId);
  const selectedType = paymentTypes.find((row) => num(row.id) === typeId);
  const selectedMethod = paymentMethods.find((row) => num(row.id) === methodId);
  const monthly = isMonthly(selectedType);
  const months = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
  const nominal = num(selectedType?.nominal_default);
  const total = monthly ? selectedMonths.size * nominal : num(amount || nominal);

  function toggleMonth(month: number) {
    setSelectedMonths((current) => {
      const next = new Set(current);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studentId || !typeId || !methodId || total <= 0) return;
    setIsSaving(true);
    setError('');
    try {
      const baseItem = {
        payment_type_id: typeId,
        academic_year_id: academicYearId || undefined
      };
      const payment_items = monthly
        ? Array.from(selectedMonths).map((month) => ({ ...baseItem, period_month: month, jumlah: nominal }))
        : [{ ...baseItem, jumlah: total }];
      const payload: PaymentFormPayload = {
        user_id: userId,
        siswa_id: studentId,
        atas_nama: str(selectedStudent?.wali_nama ?? selectedStudent?.nama_wali, ''),
        via: str(selectedMethod?.name, 'Tunai'),
        payment_method_id: methodId,
        jumlah: total,
        tanggal: new Date().toISOString().slice(0, 10),
        status: 'Lunas',
        academic_year_id: academicYearId || undefined,
        payment_items,
        ...(password.trim() ? { payment_security_password: password.trim() } : {})
      };
      const res = await api.createPayment(payload);
      await onSaved(res.data as ApiRecord);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pembayaran gagal disimpan');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalForm
      title="Tambah Pembayaran Baru"
      onClose={onClose}
      footer={
        <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#138F81] text-sm font-extrabold text-white disabled:opacity-60" disabled={isSaving} form="payment-form" type="submit">
          <Save size={18} /> {isSaving ? 'Menyimpan...' : 'Simpan Pembayaran'}
        </button>
      }
    >
      <form id="payment-form" className="space-y-4" onSubmit={submit}>
        <SelectField label="Siswa" value={studentId} onChange={setStudentId} rows={students} labelOf={(row) => `${str(row.nama)} - ${str(row.nis)} - ${str(row.kelas)}`} />
        <input className="q-input" disabled value={str(selectedStudent?.wali_nama ?? selectedStudent?.nama_wali, 'Nama wali akan terisi otomatis')} />
        <SelectField label="Tahun Ajaran" value={academicYearId} onChange={setAcademicYearId} rows={academicPeriods} labelOf={(row) => str(row.tahun_ajaran ?? row.name ?? row.label)} />
        <SelectField label="Tipe Pembayaran" value={typeId} onChange={(id) => { setTypeId(id); setAmount(String(paymentTypes.find((row) => num(row.id) === id)?.nominal_default ?? '')); setSelectedMonths(new Set()); }} rows={paymentTypes} labelOf={(row) => `${str(row.nama)} - ${formatMoney(row.nominal_default)}`} />
        <SelectField label="Metode Pembayaran" value={methodId} onChange={setMethodId} rows={paymentMethods} labelOf={(row) => str(row.name)} />
        {monthly ? (
          <div className="rounded-3xl bg-white p-4">
            <p className="mb-3 text-sm font-extrabold text-[#2D3436]">Pilih Bulan</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {months.map((month) => {
                const selected = selectedMonths.has(month);
                return (
                  <button key={month} className={`min-h-11 rounded-2xl text-sm font-extrabold ${selected ? 'bg-[#138F81] text-white' : 'bg-[#F2F4F6] text-[#138F81]'}`} onClick={() => toggleMonth(month)} type="button">
                    {selected ? '✓ ' : ''}{monthLabels[month]}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-[#636E72]">Nominal Dibayar</span>
            <input className="q-input" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))} />
          </label>
        )}
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-[#636E72]">Password Admin jika diminta sistem</span>
          <input className="q-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Opsional" />
        </label>
        {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
        <div className="rounded-2xl bg-[#D0EAF0] px-4 py-3 text-right text-lg font-extrabold text-[#138F81]">Total {formatMoney(total)}</div>
      </form>
    </ModalForm>
  );
}

function SelectField({
  label,
  value,
  onChange,
  rows,
  labelOf
}: {
  label: string;
  value: number;
  onChange: (id: number) => void;
  rows: ApiRecord[];
  labelOf: (row: ApiRecord) => string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[#636E72]">{label}</span>
      <select className="q-input" value={value || ''} onChange={(event) => onChange(Number(event.target.value))} required>
        <option value="">Pilih {label.toLowerCase()}</option>
        {rows.map((row) => (
          <option key={num(row.id)} value={num(row.id)}>{labelOf(row)}</option>
        ))}
      </select>
    </label>
  );
}

function PaymentTypeModal({
  row,
  paymentMethods,
  paymentPeriods,
  onClose,
  onSaved
}: {
  row: ApiRecord | null;
  paymentMethods: ApiRecord[];
  paymentPeriods: ApiRecord[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(str(row?.nama, ''));
  const [amount, setAmount] = useState(String(row?.nominal_default ?? ''));
  const [periodId, setPeriodId] = useState(num(row?.payment_period_type_id ?? paymentPeriods[0]?.id));
  const [status, setStatus] = useState(str(row?.status, 'Aktif'));
  const [methods, setMethods] = useState<Set<string>>(() => new Set((Array.isArray(row?.metode_pembayaran) ? row?.metode_pembayaran : paymentMethods.map((item) => item.name)).map(String)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const period = paymentPeriods.find((item) => num(item.id) === periodId);
      const payload = {
        nama: name.trim(),
        nominal_default: num(amount),
        periode: str(period?.code ?? period?.name, 'umum'),
        payment_period_type_id: periodId,
        metode_pembayaran: Array.from(methods),
        status
      };
      if (row?.id) await api.updatePaymentType(num(row.id), payload);
      else await api.createPaymentType(payload);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tipe pembayaran gagal disimpan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalForm title={row ? 'Edit Tipe Pembayaran' : 'Tambah Tipe Pembayaran'} onClose={onClose} footer={<SaveButton saving={saving} form="type-form" label="Simpan Tipe Pembayaran" />}>
      <form id="type-form" className="space-y-4" onSubmit={submit}>
        <TextField label="Nama Tipe Pembayaran" value={name} onChange={setName} required />
        <TextField label="Nominal Default" value={amount} onChange={(value) => setAmount(value.replace(/\D/g, ''))} required />
        <SelectField label="Periode Pembayaran" value={periodId} onChange={setPeriodId} rows={paymentPeriods} labelOf={(item) => str(item.name)} />
        <div className="rounded-3xl bg-white p-4">
          <p className="mb-3 text-sm font-extrabold text-[#2D3436]">Metode Didukung</p>
          <div className="flex flex-wrap gap-2">
            {paymentMethods.map((method) => {
              const nameValue = str(method.name, '');
              const selected = methods.has(nameValue);
              return (
                <button key={num(method.id)} className={`rounded-2xl px-4 py-2 text-sm font-bold ${selected ? 'bg-[#138F81] text-white' : 'bg-[#F2F4F6] text-[#636E72]'}`} onClick={() => setMethods((current) => {
                  const next = new Set(current);
                  if (next.has(nameValue)) next.delete(nameValue);
                  else next.add(nameValue);
                  return next;
                })} type="button">{nameValue}</button>
              );
            })}
          </div>
        </div>
        {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
        <StatusPicker value={status} onChange={setStatus} />
      </form>
    </ModalForm>
  );
}

function PaymentMethodModal({ row, onClose, onSaved }: { row: ApiRecord | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(str(row?.name, ''));
  const [code, setCode] = useState(str(row?.code, ''));
  const [sort, setSort] = useState(String(row?.sort_order ?? 100));
  const [active, setActive] = useState(row?.is_active !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { name, code, sort_order: num(sort), is_active: active };
      if (row?.id) await api.updatePaymentMethod(num(row.id), payload);
      else await api.createPaymentMethod(payload);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Metode pembayaran gagal disimpan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalForm title={row ? 'Edit Metode Pembayaran' : 'Tambah Metode Pembayaran'} onClose={onClose} footer={<SaveButton saving={saving} form="method-form" label="Simpan Metode" />}>
      <form id="method-form" className="space-y-4" onSubmit={submit}>
        <TextField label="Nama Metode" value={name} onChange={setName} required />
        <TextField label="Kode" value={code} onChange={setCode} />
        <TextField label="Urutan Tampil" value={sort} onChange={(value) => setSort(value.replace(/\D/g, ''))} />
        <Toggle label="Aktif" checked={active} onChange={setActive} />
        {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
      </form>
    </ModalForm>
  );
}

function PaymentPeriodModal({ row, onClose, onSaved }: { row: ApiRecord | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(str(row?.name, ''));
  const [code, setCode] = useState(str(row?.code, ''));
  const [usesMonth, setUsesMonth] = useState(row?.uses_month === true);
  const [usesSemester, setUsesSemester] = useState(row?.uses_semester !== false);
  const [monthMode, setMonthMode] = useState(str(row?.month_mode, 'semester'));
  const [dueDay, setDueDay] = useState(String(row?.due_day ?? 10));
  const [active, setActive] = useState(row?.is_active !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        name,
        code,
        uses_month: usesMonth,
        uses_semester: usesSemester,
        month_mode: monthMode,
        due_day: num(dueDay),
        is_active: active
      };
      if (row?.id) await api.updatePaymentPeriodType(num(row.id), payload);
      else await api.createPaymentPeriodType(payload);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Periode pembayaran gagal disimpan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalForm title={row ? 'Edit Periode Pembayaran' : 'Tambah Periode Pembayaran'} onClose={onClose} footer={<SaveButton saving={saving} form="period-form" label="Simpan Periode" />}>
      <form id="period-form" className="space-y-4" onSubmit={submit}>
        <TextField label="Nama Periode" value={name} onChange={setName} required />
        <TextField label="Kode" value={code} onChange={setCode} />
        <Toggle label="Memakai Bulan" checked={usesMonth} onChange={setUsesMonth} />
        <Toggle label="Mengikuti Semester" checked={usesSemester} onChange={setUsesSemester} />
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-[#636E72]">Mode Bulan</span>
          <select className="q-input" value={monthMode} onChange={(event) => setMonthMode(event.target.value)}>
            <option value="semester">Semester</option>
            <option value="full_year">Jan-Des</option>
          </select>
        </label>
        <TextField label="Tanggal Jatuh Tempo" value={dueDay} onChange={(value) => setDueDay(value.replace(/\D/g, ''))} />
        <Toggle label="Aktif" checked={active} onChange={setActive} />
        {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
      </form>
    </ModalForm>
  );
}

function TextField({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[#636E72]">{label}</span>
      <input className="q-input" value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
      <span className="text-sm font-extrabold text-[#2D3436]">{label}</span>
      <button className={`relative h-9 w-16 rounded-full transition ${checked ? 'bg-[#74C5BB]' : 'bg-[#D9E4EA]'}`} onClick={() => onChange(!checked)} type="button">
        <span className={`absolute top-1 h-7 w-7 rounded-full bg-[#138F81] transition ${checked ? 'left-8' : 'left-1 bg-[#636E72]'}`} />
      </button>
    </label>
  );
}

function StatusPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {['Aktif', 'Nonaktif'].map((status) => (
        <button key={status} className={`min-h-12 rounded-2xl text-sm font-extrabold ${value === status ? 'bg-[#138F81] text-white' : 'bg-white text-[#E65100]'}`} onClick={() => onChange(status)} type="button">
          {status}
        </button>
      ))}
    </div>
  );
}

function DocumentSettingsPanel({ settings, onSaved }: { settings: ApiRecord | null; onSaved: () => Promise<void> }) {
  const [receiptWidth, setReceiptWidth] = useState(String(settings?.receipt_width ?? '58mm'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.updateDocumentSettings({ receipt_width: receiptWidth });
      await onSaved();
      setSuccess('Pengaturan berhasil disimpan');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100">
        <h2 className="text-xl font-extrabold text-[#2D3436] mb-4">Pengaturan Cetak Struk</h2>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-[#636E72]">Ukuran Kertas Printer</span>
            <select
              className="q-input"
              value={receiptWidth}
              onChange={(e) => setReceiptWidth(e.target.value)}
            >
              <option value="58mm">58mm (Printer Thermal Kecil)</option>
              <option value="80mm">80mm (Printer Thermal Besar)</option>
              <option value="100%">100% (Sesuai Kertas / A4)</option>
            </select>
          </label>
          
          {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
          {success ? <div className="rounded-2xl bg-[#EAF4FF] px-4 py-3 text-sm font-bold text-[#2E86DE]">{success}</div> : null}
          
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#138F81] px-4 py-3 text-sm font-bold text-white hover:bg-[#0F7A6E] disabled:opacity-50"
          >
            {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
            Simpan Pengaturan
          </button>
        </form>
      </div>
    </div>
  );
}

function SaveButton({ saving, form, label }: { saving: boolean; form: string; label: string }) {
  return (
    <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#138F81] text-sm font-extrabold text-white disabled:opacity-60" disabled={saving} form={form} type="submit">
      {saving ? <X size={18} /> : <Save size={18} />} {saving ? 'Menyimpan...' : label}
    </button>
  );
}

function PengeluaranPanel({ rows, onCreate, onEdit, onDelete }: { rows: ApiRecord[]; onCreate: () => void; onEdit: (row: ApiRecord) => void; onDelete: (row: ApiRecord) => void }) {
  const columns = [
    { key: 'tanggal', header: 'Tanggal', render: (row: ApiRecord) => new Date(String(row.tanggal)).toLocaleDateString('id-ID') },
    { key: 'judul', header: 'Judul', render: (row: ApiRecord) => str(row.judul) },
    { key: 'kategori', header: 'Kategori', render: (row: ApiRecord) => str(row.kategori) },
    { key: 'jumlah', header: 'Nominal', render: (row: ApiRecord) => <MoneyText value={num(row.jumlah)} className="font-extrabold text-[#FF7675]" /> },
    { key: 'keterangan', header: 'Keterangan', render: (row: ApiRecord) => str(row.keterangan) },
    { key: 'penginput', header: 'Diinput Oleh', render: (row: ApiRecord) => str(record(row.penginput)?.name ?? '-') },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (row: ApiRecord) => (
        <div className="flex gap-2">
          <button className="rounded-xl bg-[#EAF4FF] px-3 py-2 text-xs font-bold text-[#2E86DE]" onClick={() => onEdit(row)} type="button">Edit</button>
          <button className="rounded-xl bg-[#FDF4E6] px-3 py-2 text-xs font-bold text-[#D9822B]" onClick={() => window.open(`/finance/print-expense/${row.id}`, '_blank', 'noopener,noreferrer')} type="button"><Printer size={14} /></button>
          <button className="rounded-xl bg-[#FDECEC] px-3 py-2 text-xs font-bold text-[#D63031]" onClick={() => void onDelete(row)} type="button"><Trash2 size={14} /></button>
        </div>
      )
    }
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="flex min-h-10 items-center gap-2 rounded-2xl bg-[#138F81] px-4 text-sm font-bold text-white" onClick={onCreate} type="button">
          <Plus size={16} /> Tambah Pengeluaran
        </button>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        emptyText="Belum ada data pengeluaran."
      />
    </div>
  );
}

function PengeluaranModal({ row, onClose, onSaved }: { row: ApiRecord | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [judul, setJudul] = useState(str(row?.judul, ''));
  const [jumlah, setJumlah] = useState(String(row?.jumlah ?? '0'));
  const [tanggal, setTanggal] = useState(str(row?.tanggal, new Date().toISOString().split('T')[0]));
  const [kategori, setKategori] = useState(str(row?.kategori, ''));
  const [keterangan, setKeterangan] = useState(str(row?.keterangan, ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { judul, jumlah: num(jumlah), tanggal, kategori, keterangan };
      if (row?.id) await api.updatePengeluaran(num(row.id), payload);
      else await api.createPengeluaran(payload);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data pengeluaran gagal disimpan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalForm title={row ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'} onClose={onClose} footer={<SaveButton saving={saving} form="pengeluaran-form" label="Simpan" />}>
      <form id="pengeluaran-form" className="space-y-4" onSubmit={submit}>
        <TextField label="Tanggal" value={tanggal} onChange={setTanggal} required />
        <TextField label="Judul/Keperluan" value={judul} onChange={setJudul} required />
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-[#636E72]">Nominal (Rp)</span>
          <input className="q-input" type="number" min="0" value={jumlah} onChange={(event) => setJumlah(event.target.value)} required />
        </label>
        <TextField label="Kategori" value={kategori} onChange={setKategori} />
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-[#636E72]">Keterangan Tambahan</span>
          <textarea className="q-input min-h-24" value={keterangan} onChange={(event) => setKeterangan(event.target.value)} />
        </label>
        {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}
      </form>
    </ModalForm>
  );
}
