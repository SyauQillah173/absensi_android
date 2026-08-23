import { CalendarDays, Check, CreditCard, Landmark, Plus, Printer, RefreshCw, Save, Trash2, WalletCards, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import { useAuth } from '../auth/AuthContext';
import { DataTable } from '../components/DataTable';
import { ModalForm } from '../components/ModalForm';
import { formatMoney, MoneyText } from '../components/MoneyText';
import { ConfirmDialog } from '../components/ConfirmDialog';
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
  { id: 'student', label: 'Tagihan' },
  { id: 'pengeluaran', label: 'Pengeluaran' },
  { id: 'types', label: 'Tipe Bayar' },
  { id: 'methods', label: 'Metode' },
  { id: 'periods', label: 'Periode' },
  { id: 'settings', label: 'Pengaturan Struk' }
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
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; type: 'transaction' | 'legacy'; title: string } | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  async function load(silent = false) {
    if (!silent) setIsLoading(true);
    if (!silent) setError('');
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
      if (!silent) setError(err instanceof Error ? err.message : 'Data keuangan gagal dimuat');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totalToday = useMemo(() => today.reduce((sum, row) => sum + num(row.jumlah), 0), [today]);
  const totalPengeluaranToday = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return pengeluaran
      .filter((row) => String(row.tanggal).startsWith(todayStr))
      .reduce((sum, row) => sum + num(row.jumlah), 0);
  }, [pengeluaran]);

  const activeMethods = paymentMethods.filter((method) => method.is_active !== false);
  const activePeriods = paymentPeriods.filter((period) => period.is_active !== false);
  const activeTypes = paymentTypes.filter((type) => String(type.status ?? 'Aktif') === 'Aktif');
  
  const activeAcademicYear = academicPeriods.find((item) => item.is_active === true || item.status === 'Aktif') ?? academicPeriods[0];
  const activeSemesters = Array.isArray(activeAcademicYear?.semesters) ? activeAcademicYear.semesters : [];

  async function openBilling(studentId = billingStudentId, silent = false) {
    if (!studentId) return;
    setBillingStudentId(studentId);
    if (!silent) setBillingSummary(null);
    try {
      const activeAcademic = academicPeriods.find((item) => item.is_active === true || item.status === 'Aktif') ?? academicPeriods[0];
      const result = await api.studentBillingSummary({
        user_id: session?.id ?? 0,
        siswa_id: studentId,
        ...(activeAcademic?.id ? { academic_year_id: num(activeAcademic.id) } : {})
      });
      setBillingSummary(result.data && typeof result.data === 'object' ? (result.data as ApiRecord) : result);
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Tagihan santri gagal dimuat');
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
        </div>
      </section>

      {toast ? (
        <div className={`fixed bottom-4 right-4 z-50 rounded-2xl px-6 py-3 text-sm font-bold text-white shadow-xl transition-all duration-300 ${toast.type === 'success' ? 'bg-[#138F81]' : 'bg-[#D63031]'}`}>
          {toast.message}
        </div>
      ) : null}



      {confirmDelete ? (
        <ConfirmDialog
          title="Hapus Data"
          message={`Yakin ingin menghapus ${confirmDelete.title}? Tindakan ini tidak dapat dibatalkan.`}
          tone="danger"
          confirmLabel="Hapus"
          isBusy={isLoading}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            try {
              setIsLoading(true);
              await api.deletePaymentTransaction(confirmDelete.id, confirmDelete.type);
              setConfirmDelete(null);
              showToast('Data berhasil dihapus', 'success');
              await load();
            } catch (err) {
              showToast('Gagal menghapus data', 'error');
            } finally {
              setIsLoading(false);
            }
          }}
        />
      ) : null}

      {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#D63031]">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total Masuk Hari Ini" value={formatMoney(totalToday)} subtitle={`${today.length} transaksi hari ini`} icon={WalletCards} tone="teal" />
        <StatCard title="Total Keluar Hari Ini" value={formatMoney(totalPengeluaranToday)} subtitle={`Pengeluaran hari ini`} icon={WalletCards} tone="red" />
        <StatCard title="Tipe Pembayaran Aktif" value={activeTypes.length} subtitle={`${paymentTypes.length} master tagihan`} icon={Landmark} tone="orange" />
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
        {!isLoading && activeTab === 'today' ? <PaymentsTable rows={today} emptyText="Belum ada transaksi hari ini." onDeleteTransaction={(row) => setConfirmDelete({ id: num(row.id), type: row.source === 'legacy' ? 'legacy' : 'transaction', title: `Transaksi ${str(row.transaction_code ?? row.kode_transaksi)}` })} onDeleteItem={(item) => setConfirmDelete({ id: num(item.id), type: 'legacy', title: `Item ${str(item.nama)}` })} /> : null}
        {!isLoading && activeTab === 'history' ? <PaymentsTable rows={history} emptyText="Riwayat pembayaran masih kosong." onDeleteTransaction={(row) => setConfirmDelete({ id: num(row.id), type: row.source === 'legacy' ? 'legacy' : 'transaction', title: `Transaksi ${str(row.transaction_code ?? row.kode_transaksi)}` })} onDeleteItem={(item) => setConfirmDelete({ id: num(item.id), type: 'legacy', title: `Item ${str(item.nama)}` })} /> : null}
        {!isLoading && activeTab === 'student' ? (
          <StudentBillingPanel
            students={students}
            selectedStudentId={billingStudentId}
            onSelect={openBilling}
            summary={billingSummary}
            paymentTypes={activeTypes}
            paymentMethods={activeMethods}
            academicPeriods={academicPeriods}
            userId={session?.id ?? 0}
            onPaymentSuccess={async () => {
              await load(true);
              if (billingStudentId) await openBilling(billingStudentId, true);
              showToast('✅ Pembayaran santri berhasil disimpan!', 'success');
            }}
            onDeletePayment={async (pembayaranId, name) => {
              try {
                setIsLoading(true);
                await api.deletePaymentTransaction(pembayaranId, 'legacy');
                await load();
                if (billingStudentId) await openBilling(billingStudentId);
                showToast(`Pembayaran ${name} berhasil dibatalkan`, 'success');
              } catch (err) {
                showToast(`Gagal membatalkan pembayaran: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
              } finally {
                setIsLoading(false);
              }
            }}
          />
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


      {modal === 'type' ? (
        <PaymentTypeModal
          row={editing}
          semesters={activeSemesters}
          paymentMethods={activeMethods}
          paymentPeriods={activePeriods}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            setEditing(null);
            showToast('Tipe Pembayaran berhasil disimpan!', 'success');
            await load();
            if (billingStudentId) {
              await openBilling(billingStudentId);
            }
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
            showToast('Metode Pembayaran berhasil disimpan!', 'success');
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
            showToast('Periode Pembayaran berhasil disimpan!', 'success');
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

function PaymentsTable({ rows, emptyText, onDeleteTransaction, onDeleteItem }: { rows: ApiRecord[]; emptyText: string; onDeleteTransaction?: (row: ApiRecord) => void; onDeleteItem?: (item: ApiRecord) => void }) {
  return (
    <DataTable
      rows={rows}
      emptyText={emptyText}
      isRowExpandable={(row) => row.is_multi_payment === true || (Array.isArray(row.payment_items) && row.payment_items.length > 1)}
      renderExpandedRow={(row) => {
        const items = Array.isArray(row.payment_items) ? row.payment_items : [];
        return (
          <div className="grid gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Rincian Transaksi</p>
            <div className="grid max-w-2xl gap-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-colors hover:border-gray-300">
                  <div>
                    <div className="font-bold text-[#2D3436]">{str(item.nama)}</div>
                    <div className="text-xs font-semibold text-gray-500">
                      {str(item.payment_bill?.period_label ?? item.periode)} {str(item.tahun_ajaran)} {str(item.semester)} {str(item.keterangan)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-extrabold text-[#138F81]">Rp {num(item.jumlah).toLocaleString('id-ID')}</span>
                    {onDeleteItem ? (
                      <button
                        onClick={() => onDeleteItem(item)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                        title="Hapus Item"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }}
      columns={[
        { key: 'siswa', header: 'Santri', render: (row) => str(row.siswa_nama ?? row.nama_siswa ?? row.nama) },
        { key: 'atas', header: 'Atas Nama', render: (row) => str(row.atas_nama ?? row.wali_nama) },
        { key: 'jenis', header: 'Jenis', render: (row) => str(row.jenis ?? row.payment_type_name) },
        { key: 'periode', header: 'Periode', render: (row) => {
          const items = Array.isArray(row.payment_items) ? row.payment_items : [];
          const first = items[0] ?? {};
          const periodLabel = str(first.payment_bill?.period_label ?? first.periode, '');
          const semester = str(row.semester ?? first.semester, '');
          const tahunAjaran = str(row.tahun_ajaran ?? first.tahun_ajaran, '');
          const parts = [periodLabel, semester, tahunAjaran].filter(p => p && p !== '-');
          return parts.length > 0 ? parts.join(' • ') : '-';
        }},
        { key: 'jumlah', header: 'Nominal', render: (row) => <MoneyText value={row.jumlah} className="font-extrabold text-[#138F81]" /> },
        { key: 'via', header: 'Metode', render: (row) => str(row.via ?? row.payment_method_name) },
        { key: 'status', header: 'Status', render: (row) => <StatusBadge label={str(row.status, 'Tercatat')} tone={statusTone(row.status)} /> },
        ...(onDeleteTransaction ? [{ key: 'actions', header: '', render: (row: ApiRecord) => (
          <div className="flex justify-end gap-2">
            <button
              onClick={() => onDeleteTransaction(row)}
              className="rounded-xl bg-red-50 p-2 text-red-600 hover:bg-red-100"
              title="Hapus Seluruh Transaksi"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) }] : [])
      ]}
    />
  );
}interface PaidSessionItem {
  id: number;
  code: string;
  typeName: string;
  detail: string;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  method: string;
  time: string;
  notes: string;
  txData?: ApiRecord;
}

function DirectPaymentCashier({
  student,
  userId,
  paymentTypes,
  paymentMethods,
  academicPeriods,
  summaryData,
  onPaymentSuccess,
}: {
  student: ApiRecord;
  userId: number;
  paymentTypes: ApiRecord[];
  paymentMethods: ApiRecord[];
  academicPeriods: ApiRecord[];
  summaryData: ApiRecord | null;
  onPaymentSuccess: () => Promise<void>;
}) {
  const studentId = num(student.id);
  const currentStudentIdRef = useRef(studentId);

  const defaultAcademic = academicPeriods.find((item) => item.is_active === true) ?? academicPeriods[0];
  const [academicYearId, setAcademicYearId] = useState(num(defaultAcademic?.id));
  const selectedAcademic = academicPeriods.find((item) => num(item.id) === academicYearId);
  const semesters = Array.isArray(selectedAcademic?.semesters) ? (selectedAcademic.semesters as ApiRecord[]) : [];
  const defaultSemester = semesters.find((s) => s.is_active === true || s.status === 'Aktif') ?? semesters[0];
  const [semesterId, setSemesterId] = useState<number | ''>(defaultSemester ? num(defaultSemester.id) : '');

  const [typeId, setTypeId] = useState(paymentTypes[0] ? num(paymentTypes[0].id) : 0);
  const selectedType = paymentTypes.find((row) => num(row.id) === typeId);
  const monthly = isMonthly(selectedType);

  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(new Set());
  const [customAmount, setCustomAmount] = useState('');
  const [methodId, setMethodId] = useState(paymentMethods[0] ? num(paymentMethods[0].id) : 0);
  const [notes, setNotes] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Completed payments in this cashier session
  const [completedList, setCompletedList] = useState<PaidSessionItem[]>([]);
  const [sendingWaId, setSendingWaId] = useState<number | null>(null);

  // Reset completed cashier list ONLY when student genuinely changes
  useEffect(() => {
    if (currentStudentIdRef.current !== studentId) {
      currentStudentIdRef.current = studentId;
      setCompletedList([]);
    }
  }, [studentId]);

  function handlePrintAll() {
    if (completedList.length === 0) return;
    const combinedIds = completedList.map((item) => item.id).join(',');
    window.open(`/finance/print/${combinedIds}`, '_blank', 'noopener,noreferrer');
  }

  // Discount states
  const [discountGuru, setDiscountGuru] = useState<number>(0);
  const [discountYatim, setDiscountYatim] = useState<number>(0);
  const [discountPrestasi, setDiscountPrestasi] = useState<number>(0);
  const [discountTahfidz, setDiscountTahfidz] = useState<number>(0);
  const [discountLain, setDiscountLain] = useState<number>(0);

  // Month Status Map for selected type
  const monthStatusMap = useMemo(() => {
    const map = new Map<number, { isPaid: boolean; isHoliday: boolean; status: string; amount: number }>();
    if (summaryData && typeId) {
      const groups = Array.isArray(summaryData.groups) ? (summaryData.groups as ApiRecord[]) : [];
      for (const group of groups) {
        const monthlyList = Array.isArray(group.monthly) ? (group.monthly as ApiRecord[]) : [];
        const match = monthlyList.find((m) => num(m.payment_type_id) === typeId);
        if (match && Array.isArray(match.months)) {
          for (const m of match.months as ApiRecord[]) {
            const mNo = num(m.month);
            const st = str(m.status);
            const isPaid = m.is_paid === true || st.toLowerCase() === 'lunas';
            const isHoliday = st.toLowerCase() === 'libur';
            map.set(mNo, { isPaid, isHoliday, status: st, amount: num(m.amount ?? selectedType?.nominal_default) });
          }
        }
      }
    }
    return map;
  }, [summaryData, typeId, selectedType]);

  // Find matching general / non-bulanan bill from summaryData
  const matchingGeneralBill = useMemo(() => {
    if (monthly || !summaryData || !typeId) return null;
    const groups = Array.isArray(summaryData.groups) ? (summaryData.groups as ApiRecord[]) : [];
    for (const group of groups) {
      if (!group.academic_year_id || num(group.academic_year_id) === academicYearId) {
        const generalList = Array.isArray(group.general) ? (group.general as ApiRecord[]) : [];
        const match = generalList.find((g) => {
          const matchType = num(g.payment_type_id ?? g.id) === typeId;
          const matchSem = !g.semester_id || !semesterId || num(g.semester_id) === Number(semesterId);
          return matchType && matchSem;
        });
        if (match) return match;
      }
    }
    const billsList = Array.isArray(summaryData.tagihan) ? (summaryData.tagihan as ApiRecord[]) : [];
    return billsList.find((b) => num(b.payment_type_id) === typeId && (!b.semester_id || !semesterId || num(b.semester_id) === Number(semesterId))) || null;
  }, [monthly, summaryData, typeId, academicYearId, semesterId]);

  const defaultNominal = num(selectedType?.nominal_default);
  const totalTagihanAsli = num(matchingGeneralBill?.amount ?? matchingGeneralBill?.amount_due ?? defaultNominal);
  const sudahDibayar = num(matchingGeneralBill?.paid_amount);
  const sisaKurangBayar = matchingGeneralBill ? num(matchingGeneralBill.remaining_amount) : defaultNominal;
  const isGeneralPaid = !monthly && matchingGeneralBill ? (matchingGeneralBill.status === 'Lunas' || matchingGeneralBill.is_paid === true || (sudahDibayar >= totalTagihanAsli && totalTagihanAsli > 0)) : false;

  // Auto-fill customAmount with remaining balance when type changes or bill updates
  useEffect(() => {
    if (!monthly) {
      if (matchingGeneralBill) {
        const rem = num(matchingGeneralBill.remaining_amount);
        setCustomAmount(String(rem > 0 ? rem : (matchingGeneralBill.amount ?? defaultNominal)));
      } else {
        setCustomAmount(String(defaultNominal));
      }
    }
  }, [typeId, matchingGeneralBill, monthly, defaultNominal]);

  const grossAmount = monthly ? selectedMonths.size * defaultNominal : num(customAmount || sisaKurangBayar || defaultNominal);

  // Calculate discounts
  const totalPercentDiscount = Number(discountGuru || 0) + Number(discountYatim || 0) + Number(discountPrestasi || 0) + Number(discountTahfidz || 0);
  const discountFromPercent = Math.round((grossAmount * totalPercentDiscount) / 100);
  const totalDiscount = discountFromPercent + Number(discountLain || 0);
  const netAmount = Math.max(0, grossAmount - totalDiscount);

  function toggleMonth(month: number) {
    const mInfo = monthStatusMap.get(month);
    if (mInfo?.isPaid || mInfo?.isHoliday) return;
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }

  function handleReset() {
    setSelectedMonths(new Set());
    setCustomAmount('');
    setDiscountGuru(0);
    setDiscountYatim(0);
    setDiscountPrestasi(0);
    setDiscountTahfidz(0);
    setDiscountLain(0);
    setNotes('');
    setPassword('');
    setError('');
  }

  async function handleSendWa(paymentId: number) {
    try {
      setSendingWaId(paymentId);
      const res = await api.notifyWaPayment(paymentId);
      alert(res.message || 'Pesan WhatsApp struk pembayaran berhasil dikirim ke Wali!');
    } catch (err) {
      alert(`Gagal mengirim WhatsApp: ${err instanceof Error ? err.message : 'Terjadi kesalahan'}`);
    } finally {
      setSendingWaId(null);
    }
  }

  async function handleSave() {
    if (!studentId || !typeId || !methodId || netAmount <= 0) {
      setError('Pilih minimal satu bulan tagihan / isi nominal bayar yang valid');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const baseItem = {
        payment_type_id: typeId,
        academic_year_id: academicYearId || undefined,
        semester_id: semesterId || undefined,
      };

      const payment_items = monthly
        ? Array.from(selectedMonths).map((month) => ({
            ...baseItem,
            period_month: month,
            jumlah: defaultNominal - Math.round(totalDiscount / (selectedMonths.size || 1)),
          }))
        : [{ ...baseItem, jumlah: netAmount }];

      const discountNotes: string[] = [];
      if (discountGuru > 0) discountNotes.push(`Diskon Guru: ${discountGuru}%`);
      if (discountYatim > 0) discountNotes.push(`Diskon Yatim: ${discountYatim}%`);
      if (discountPrestasi > 0) discountNotes.push(`Diskon Prestasi: ${discountPrestasi}%`);
      if (discountTahfidz > 0) discountNotes.push(`Diskon Tahfidz: ${discountTahfidz}%`);
      if (discountLain > 0) discountNotes.push(`Diskon Lain: ${formatMoney(discountLain)}`);
      if (notes.trim()) discountNotes.push(notes.trim());

      const selectedMethod = paymentMethods.find((m) => num(m.id) === methodId);

      const payload: PaymentFormPayload = {
        user_id: userId,
        siswa_id: studentId,
        atas_nama: str(student.wali_nama ?? student.nama_wali, ''),
        via: str(selectedMethod?.name, 'Tunai'),
        payment_method_id: methodId,
        jumlah: netAmount,
        keterangan: discountNotes.length > 0 ? discountNotes.join(' | ') : undefined,
        tanggal: new Date().toISOString().slice(0, 10),
        status: 'Lunas',
        academic_year_id: academicYearId || undefined,
        semester_id: semesterId || undefined,
        payment_items,
        ...(password.trim() ? { payment_security_password: password.trim() } : {}),
      };

      const res = await api.createPayment(payload);
      const tx = (res.data && typeof res.data === 'object' ? res.data : {}) as ApiRecord;
      const txId = num(tx.id || (tx as any).payment_transaction_id || Date.now());
      const txCode = str(tx.kode_transaksi || tx.invoice_number || `TRX-${Date.now().toString().slice(-6)}`);

      const newItem: PaidSessionItem = {
        id: txId,
        code: txCode,
        typeName: str(selectedType?.nama || 'Tagihan'),
        detail: monthly
          ? `${selectedMonths.size} Bulan (${Array.from(selectedMonths).map((m) => monthLabels[m]).join(', ')})`
          : (matchingGeneralBill && sudahDibayar > 0 ? `Angsuran/Pelunasan (Sisa: ${formatMoney(Math.max(0, sisaKurangBayar - netAmount))})` : 'Pembayaran Penuh'),
        grossAmount: grossAmount,
        discountAmount: totalDiscount,
        netAmount: netAmount,
        method: str(selectedMethod?.name, 'Tunai'),
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        notes: discountNotes.join(' | '),
        txData: tx,
      };

      setCompletedList((prev) => [newItem, ...prev]);
      handleReset();
      await onPaymentSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan transaksi pembayaran');
    } finally {
      setIsSaving(false);
    }
  }

  // 4-column month structure
  const monthColumns = [
    { title: 'Ganjil (Awal)', months: [7, 8, 9] },
    { title: 'Ganjil (Akhir)', months: [10, 11, 12] },
    { title: 'Genap (Awal)', months: [1, 2, 3] },
    { title: 'Genap (Akhir)', months: [4, 5, 6] },
  ];

  const totalSessionPaid = completedList.reduce((acc, curr) => acc + curr.netAmount, 0);

  return (
    <div className="space-y-6 pt-4">
      {/* SECTION 1: PEMBAYARAN SEKARANG (SESI KASIR) */}
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div className="border-b-2 border-[#138F81] pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-black tracking-wider text-gray-800 uppercase flex items-center gap-2">
              <span>PEMBAYARAN SEKARANG</span>
              {completedList.length > 0 && (
                <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-black text-teal-800">
                  {completedList.length} Transaksi Selesai (Total {formatMoney(totalSessionPaid)})
                </span>
              )}
            </h3>
            <p className="text-[11px] font-medium text-gray-500 mt-0.5">
              Daftar transaksi untuk <span className="font-bold text-teal-800">{str(student.nama)}</span>
            </p>
          </div>

          {completedList.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePrintAll}
                className="flex items-center gap-2 rounded-xl bg-[#138F81] text-white px-4 py-2 text-xs font-black hover:bg-[#0A7065] shadow-md shadow-[#138F81]/25 transition-all"
                title="Cetak struk semua pembayaran yang ada di tabel ini"
              >
                <Printer size={15} /> Cetak Struk ({completedList.length})
              </button>
              <button
                type="button"
                onClick={() => setCompletedList([])}
                className="flex items-center gap-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 px-4 py-2 text-xs font-black text-gray-700 transition-colors"
                title="Selesai dan bersihkan tabel sesi kasir santri ini"
              >
                <RefreshCw size={14} /> Refresh / Selesai
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 font-black text-gray-700 text-left border-b border-gray-200">
                <th className="py-2.5 px-3 w-10 text-center">No</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Tipe Pembayaran</th>
                <th className="py-2.5 px-3 text-right">Tagihan</th>
                <th className="py-2.5 px-3 text-right">Diskon</th>
                <th className="py-2.5 px-3 text-right">Total Tagihan</th>
                <th className="py-2.5 px-3 text-right">Nominal Bayar</th>
                <th className="py-2.5 px-3">Keterangan</th>
                <th className="py-2.5 px-3 text-center w-28">Aksi Cetak / WA</th>
              </tr>
            </thead>
            <tbody>
              {/* COMPLETED TRANSACTIONS IN THIS SESSION */}
              {completedList.map((item, idx) => (
                <tr key={item.id} className="border-b border-gray-100 bg-teal-50/20 font-bold hover:bg-teal-50/40 transition-colors">
                  <td className="py-3 px-3 text-center text-teal-800 font-extrabold">{idx + 1}</td>
                  <td className="py-3 px-3">
                    <span className="inline-block rounded-md bg-[#138F81] px-2.5 py-1 text-[10px] font-black text-white shadow-xs">
                      ✓ Sukses ({item.time})
                    </span>
                  </td>
                  <td className="py-3 px-3 font-extrabold text-gray-800">
                    <div>{item.typeName}</div>
                    <div className="text-[11px] font-semibold text-teal-700">{item.detail}</div>
                  </td>
                  <td className="py-3 px-3 text-right text-gray-700">{formatMoney(item.grossAmount)}</td>
                  <td className="py-3 px-3 text-right text-amber-600">{item.discountAmount > 0 ? `-${formatMoney(item.discountAmount)}` : 'Rp 0'}</td>
                  <td className="py-3 px-3 text-right font-extrabold text-gray-800">{formatMoney(item.netAmount)}</td>
                  <td className="py-3 px-3 text-right font-black text-[#138F81] text-sm">{formatMoney(item.netAmount)}</td>
                  <td className="py-3 px-3 text-xs text-gray-600">
                    <div>Via: <span className="font-bold text-gray-800">{item.method}</span></div>
                    {item.notes && <div className="text-[11px] text-gray-500 italic truncate max-w-[160px]" title={item.notes}>{item.notes}</div>}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => window.open(`/finance/print/${item.id}`, '_blank', 'noopener,noreferrer')}
                        className="rounded-lg bg-teal-100 hover:bg-teal-200 p-1.5 text-teal-800 font-bold transition-colors"
                        title="Cetak Struk Transaksi Ini"
                      >
                        <Printer size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendWa(item.id)}
                        disabled={sendingWaId === item.id}
                        className="rounded-lg bg-emerald-100 hover:bg-emerald-200 p-1.5 text-emerald-800 font-bold transition-colors disabled:opacity-50"
                        title="Kirim Struk ke WhatsApp Wali"
                      >
                        <span className="text-[11px] font-black">WA</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {completedList.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400 font-semibold italic">
                    Belum ada pembayaran yang berhasil di sesi ini. Silakan lakukan pembayaran pada form di bawah.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: LAKUKAN PEMBAYARAN */}
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
        <div className="border-b-2 border-[#138F81] pb-3 flex items-center justify-between">
          <h3 className="text-sm font-black tracking-wider text-gray-800 uppercase">
            LAKUKAN PEMBAYARAN
          </h3>
          <span className="text-xs font-bold text-gray-500">
            {str(student.nama)} ({str(student.nis)})
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField
            label="Tipe Pembayaran"
            value={typeId}
            onChange={(id) => {
              setTypeId(id);
              setSelectedMonths(new Set());
              setCustomAmount('');
            }}
            rows={paymentTypes}
            labelOf={(t) => `${str(t.nama)} - ${formatMoney(t.nominal_default)}`}
            hidePlaceholder={true}
          />
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Tahun Ajaran"
              value={academicYearId}
              onChange={(id) => {
                setAcademicYearId(id);
                setSelectedMonths(new Set());
              }}
              rows={academicPeriods}
              labelOf={(a) => str(a.tahun_ajaran ?? a.name ?? a.label)}
              hidePlaceholder={true}
            />
            <SelectField
              label="Semester"
              value={Number(semesterId) || 0}
              onChange={setSemesterId}
              rows={semesters}
              labelOf={(s) => str(s.name ?? s.semester)}
              hidePlaceholder={true}
            />
          </div>
        </div>

        {/* 12-MONTH CHECKBOX GRID (4 COLUMNS) */}
        {monthly ? (
          <div className="space-y-2">
            <label className="block text-xs font-black uppercase tracking-wider text-gray-600">
              Pilih Bulan Tagihan
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-2xl bg-gray-50/80 border border-gray-200">
              {monthColumns.map((col, cIdx) => (
                <div key={cIdx} className="space-y-2">
                  <div className="text-[11px] font-black text-gray-500 uppercase tracking-wider border-b pb-1 border-gray-200">
                    {col.title}
                  </div>
                  <div className="space-y-1.5">
                    {col.months.map((mNo) => {
                      const mInfo = monthStatusMap.get(mNo);
                      const isPaid = mInfo?.isPaid === true;
                      const isHoliday = mInfo?.isHoliday === true;
                      const isChecked = selectedMonths.has(mNo);

                      return (
                        <label
                          key={mNo}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold transition-all select-none ${
                            isPaid
                              ? 'bg-teal-100/70 text-teal-800 border border-teal-300 cursor-not-allowed opacity-90'
                              : isHoliday
                              ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                              : isChecked
                              ? 'bg-[#138F81] text-white shadow-sm ring-1 ring-[#0A7065] cursor-pointer'
                              : 'bg-white text-gray-700 border border-gray-200 hover:bg-teal-50/40 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isPaid || isChecked}
                            disabled={isPaid || isHoliday}
                            onChange={() => toggleMonth(mNo)}
                            className="h-4 w-4 rounded border-gray-300 text-[#138F81] focus:ring-[#138F81]"
                          />
                          <span className="flex-1">{monthLabels[mNo]}</span>
                          <span className="text-[10px] opacity-80">
                            {isPaid ? '✓ Lunas' : isHoliday ? '- Libur' : ''}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {matchingGeneralBill && sudahDibayar > 0 && !isGeneralPaid ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <span className="font-black text-amber-700">⚠️ Status Cicilan (Kurang Bayar):</span> Total Tagihan: {formatMoney(totalTagihanAsli)}, Sudah Dibayar: {formatMoney(sudahDibayar)}.
                </div>
                <div className="font-extrabold">
                  Sisa Kurang Bayar: <span className="font-black text-red-600 text-sm">{formatMoney(sisaKurangBayar)}</span>
                </div>
              </div>
            ) : null}

            {isGeneralPaid ? (
              <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-xs font-bold text-teal-900">
                ✅ Tagihan {str(selectedType?.nama)} untuk periode ini sudah <b>LUNAS</b> ({formatMoney(totalTagihanAsli)}).
              </div>
            ) : null}

            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase tracking-wider text-gray-600">
                Nominal Tagihan Yang Akan Dibayar (Sisa Kurang Bayar)
              </span>
              <input
                className="q-input font-bold"
                inputMode="numeric"
                disabled={isGeneralPaid}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value.replace(/\D/g, ''))}
                placeholder="Masukkan nominal tagihan"
              />
            </label>
          </div>
        )}

        {/* TAGIHAN DISPLAY */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase tracking-wider text-gray-600">Tagihan Yang Dibayar</span>
            <input className="q-input font-bold bg-gray-50 text-gray-800" disabled value={formatMoney(grossAmount)} />
          </label>

          <SelectField
            label="Metode Pembayaran"
            value={methodId}
            onChange={setMethodId}
            rows={paymentMethods.filter((m) => m.is_active !== false)}
            labelOf={(m) => str(m.name)}
            hidePlaceholder={true}
          />
        </div>

        {/* DISKON SECTION */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
          <div className="text-xs font-black tracking-wider text-gray-700 uppercase">
            POTONGAN / DISKON (OPSIONAL)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-gray-600">Diskon Anak Guru (%)</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="q-input text-right font-bold"
                  value={discountGuru || ''}
                  onChange={(e) => setDiscountGuru(Math.min(100, Math.max(0, Number(e.target.value))))}
                  placeholder="0"
                />
                <span className="text-sm font-black text-gray-500">%</span>
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-bold text-gray-600">Diskon Anak Yatim / Kurang Mampu (%)</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="q-input text-right font-bold"
                  value={discountYatim || ''}
                  onChange={(e) => setDiscountYatim(Math.min(100, Math.max(0, Number(e.target.value))))}
                  placeholder="0"
                />
                <span className="text-sm font-black text-gray-500">%</span>
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-bold text-gray-600">Diskon Anak Berprestasi (%)</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="q-input text-right font-bold"
                  value={discountPrestasi || ''}
                  onChange={(e) => setDiscountPrestasi(Math.min(100, Math.max(0, Number(e.target.value))))}
                  placeholder="0"
                />
                <span className="text-sm font-black text-gray-500">%</span>
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-bold text-gray-600">Diskon Tahfidz (%)</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="q-input text-right font-bold"
                  value={discountTahfidz || ''}
                  onChange={(e) => setDiscountTahfidz(Math.min(100, Math.max(0, Number(e.target.value))))}
                  placeholder="0"
                />
                <span className="text-sm font-black text-gray-500">%</span>
              </div>
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-bold text-gray-600">Diskon Lain-lain (Rp)</span>
              <input
                type="text"
                inputMode="numeric"
                className="q-input font-bold"
                value={discountLain ? String(discountLain) : ''}
                onChange={(e) => setDiscountLain(Number(e.target.value.replace(/\D/g, '')))}
                placeholder="Rp 0"
              />
            </label>
          </div>
        </div>

        {/* CATATAN, PASSWORD & NOMINAL BAYAR */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase tracking-wider text-gray-600">Catatan / Keterangan</span>
            <input
              type="text"
              className="q-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cth: Pembayaran cicilan tahap 1"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase tracking-wider text-gray-600 flex items-center justify-between">
              <span>Password Keamanan Admin</span>
              <span className="text-[10px] text-teal-700 font-bold">Wajib jika proteksi aktif</span>
            </span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="q-input pr-12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password admin"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600"
              >
                {showPassword ? 'Tutup' : 'Lihat'}
              </button>
            </div>
          </label>
        </div>

        <div>
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase tracking-wider text-gray-600">Total Nominal Bayar</span>
            <input
              className="q-input font-black text-xl bg-teal-50/70 text-[#138F81] border-teal-300"
              disabled
              value={formatMoney(netAmount)}
            />
          </label>
        </div>

        {error ? (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-3 text-xs font-bold text-red-700">
            {error}
          </div>
        ) : null}

        {/* ACTION BUTTONS */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-2xl font-black text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || netAmount <= 0}
            className="flex items-center gap-2 px-8 py-2.5 rounded-2xl font-black text-sm bg-[#138F81] text-white hover:bg-[#0A7065] shadow-md shadow-[#138F81]/25 disabled:opacity-50 transition-all"
          >
            <Save size={17} />
            {isSaving ? 'Menyimpan...' : 'Simpan Pembayaran'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StudentBillingPanel({
  students,
  selectedStudentId,
  onSelect,
  summary,
  onDeletePayment,
  paymentTypes,
  paymentMethods,
  academicPeriods,
  userId,
  onPaymentSuccess,
}: {
  students: ApiRecord[];
  selectedStudentId: number;
  onSelect: (id: number) => void;
  summary: ApiRecord | null;
  onDeletePayment: (pembayaranId: number, name: string) => Promise<void>;
  paymentTypes: ApiRecord[];
  paymentMethods: ApiRecord[];
  academicPeriods: ApiRecord[];
  userId: number;
  onPaymentSuccess: () => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [confirmCancel, setConfirmCancel] = useState<{ id: number; title: string } | null>(null);
  const filtered = students.filter((student) => {
    const text = `${student.nama ?? ''} ${student.nis ?? ''} ${student.nisn ?? ''} ${student.kelas ?? ''}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });
  const student = students.find((item) => num(item.id) === selectedStudentId);
  const totals = (summary?.summary ?? summary) as ApiRecord | undefined;
  const groups = Array.isArray(summary?.groups) ? (summary.groups as ApiRecord[]) : [];
  let groupsData = groups;
  if (groupsData.length === 0) {
    const fallbackMonthly = Array.isArray(summary?.monthly) ? summary.monthly : Array.isArray(summary?.monthly_items) ? summary?.monthly_items : [];
    const fallbackGeneral = Array.isArray(summary?.general) ? summary.general : Array.isArray(summary?.general_items) ? summary?.general_items : [];
    if (fallbackMonthly.length > 0 || fallbackGeneral.length > 0) {
      groupsData = [{ period_badge: 'Semua Periode', monthly: fallbackMonthly, general: fallbackGeneral }];
    }
  }

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-3xl bg-[#138F81] p-6 text-white shadow-md">
          <div>
            <h3 className="text-xl font-black">{str(student.nama)} ({str(student.kelas)})</h3>
            <p className="mt-1 text-sm font-medium text-teal-100">
              NIS: <span className="font-bold">{str(student.nis)}</span> • Wali: <span className="font-bold">{str(student.wali_nama ?? student.nama_wali)}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await api.sendBillNotification(num(student.id));
                  alert(res.message || 'Tagihan berhasil dikirim ke WhatsApp Wali!');
                } catch (err) {
                  alert(`Gagal mengirim WhatsApp: ${err instanceof Error ? err.message : 'Error'}`);
                }
              }}
              className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-black text-[#138F81] shadow hover:bg-teal-50"
            >
              Kirim Tagihan (WhatsApp)
            </button>
          </div>
        </div>
      ) : null}

      {summary ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryBox title="Total Tagihan" value={totals?.total_tagihan ?? totals?.amount ?? 0} tone="blue" />
            <SummaryBox title="Total Dibayar" value={totals?.total_dibayar ?? totals?.paid_amount ?? 0} tone="teal" />
            <SummaryBox title="Kurang Bayar" value={totals?.total_kurang_bayar ?? totals?.remaining_amount ?? 0} tone="red" />
            <SummaryBox title="Menunggu Verifikasi" value={totals?.total_menunggu ?? totals?.pending_amount ?? 0} tone="orange" />
          </div>

          {groupsData.length === 0 ? (
            <div className="rounded-2xl bg-[#E1EFF7] p-8 text-center font-bold text-[#636E72]">Belum ada tagihan untuk santri ini.</div>
          ) : (
            groupsData.map((group, idx) => {
              const groupMonthly = Array.isArray(group.monthly) ? (group.monthly as ApiRecord[]) : [];
              const groupGeneral = Array.isArray(group.general) ? (group.general as ApiRecord[]) : [];
              const periodTitle = str(group.tahun_ajaran ?? group.period_badge, '2025/2026');

              return (
                <div key={idx} className="space-y-4 rounded-3xl bg-white p-6 shadow-sm border border-gray-200">
                  <h2 className="text-lg font-black text-gray-800">
                    Tahun Ajaran: <span className="text-[#138F81]">{periodTitle}</span>
                  </h2>
                  
                  {groupMonthly.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs font-black tracking-wider text-gray-500 uppercase">BULANAN (SPP)</div>
                      <div className="overflow-x-auto q-scrollbar rounded-xl border border-gray-200">
                        <table className="w-full min-w-[760px] border-collapse text-xs">
                          <thead>
                            <tr className="bg-gray-50 font-black text-gray-700">
                              <th className="border border-gray-200 px-4 py-2.5 text-left w-52">Tipe Pembayaran</th>
                              {['Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun'].map((m, idx) => (
                                <th
                                  key={m}
                                  className={`border border-gray-200 px-1 py-2.5 text-center w-12 ${
                                    idx < 6 ? 'text-teal-900 bg-teal-50/30' : 'text-blue-900 bg-blue-50/30'
                                  }`}
                                  title={idx < 6 ? `${m} (Semester Ganjil)` : `${m} (Semester Genap)`}
                                >
                                  {m}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {groupMonthly.map((item) => {
                              const months = Array.isArray(item.months) ? (item.months as ApiRecord[]) : [];
                              return (
                                <tr key={str(item.payment_type_id ?? item.id ?? item.name)}>
                                  <td className="border border-gray-200 bg-white px-4 py-3 text-gray-800">
                                    <div className="font-extrabold text-sm">{str(item.name ?? item.nama ?? item.payment_type_name ?? 'SPP')}</div>
                                    <div className="text-[11px] font-semibold text-gray-500">12 Bulan (Ganjil & Genap)</div>
                                  </td>
                                  {months.map((month) => {
                                    const monthNo = num(month.month);
                                    const status = str(month.status, 'Libur');
                                    const paid = status === 'Lunas' || month.is_paid === true;
                                    const isLibur = status === 'Libur';
                                    const pId = month.pembayaran_id;
                                    const semLabel = [7, 8, 9, 10, 11, 12].includes(monthNo) ? 'Semester Ganjil' : 'Semester Genap';

                                    return (
                                      <td
                                        key={`${str(item.payment_type_id)}-${monthNo}`}
                                        className={`border border-gray-200 p-0 text-center font-black transition-colors ${
                                          isLibur
                                            ? 'bg-gray-100 text-gray-400'
                                            : paid
                                            ? 'bg-[#138F81] text-white hover:bg-[#0A7065] cursor-pointer'
                                            : 'bg-[#E74C3C] text-white'
                                        }`}
                                        onClick={() => {
                                          if (paid && pId) {
                                            setConfirmCancel({ id: Number(pId), title: `${str(item.name)} ${month.label} (${semLabel})` });
                                          }
                                        }}
                                        title={
                                          isLibur
                                            ? `Bulan ${month.label} (${semLabel}) - Libur / Tidak Ditagihkan`
                                            : paid
                                            ? `Bulan ${month.label} (${semLabel}) - LUNAS ✓ (Klik untuk batalkan jika perlu)`
                                            : `Bulan ${month.label} (${semLabel}) - Belum Lunas: ${formatMoney(month.remaining_amount ?? month.amount)}`
                                        }
                                      >
                                        <div className="flex h-11 w-full items-center justify-center text-sm font-extrabold">
                                          {isLibur ? '-' : paid ? '✓' : 'X'}
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Legend & Penjelasan Pembagian Semester SPP */}
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50/80 p-3 text-xs font-semibold text-gray-600">
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <span className="flex h-4 w-4 items-center justify-center rounded bg-[#138F81] text-[10px] font-black text-white">✓</span>
                            <span>Sudah Lunas</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="flex h-4 w-4 items-center justify-center rounded bg-[#E74C3C] text-[10px] font-black text-white">X</span>
                            <span>Belum Lunas</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="flex h-4 w-4 items-center justify-center rounded bg-gray-200 text-[10px] font-black text-gray-500">-</span>
                            <span>Libur SPP</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                          <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-teal-800">
                            Semester Ganjil: Jul – Des
                          </span>
                          <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-800">
                            Semester Genap: Jan – Jun
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {groupGeneral.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <div className="text-xs font-black tracking-wider text-gray-500 uppercase">UMUM (NON-BULANAN)</div>
                      <div className="overflow-x-auto q-scrollbar rounded-xl border border-gray-200">
                        <table className="w-full min-w-[760px] border-collapse text-xs">
                          <thead>
                            <tr className="bg-gray-50 font-black text-gray-700">
                              <th className="border border-gray-200 px-4 py-2.5 text-left">Tipe Pembayaran</th>
                              <th className="border border-gray-200 px-3 py-2.5 text-center w-36">Semester / Periode</th>
                              <th className="border border-gray-200 px-4 py-2.5 text-right w-36">Tagihan</th>
                              <th className="border border-gray-200 px-4 py-2.5 text-right w-36">Dibayar</th>
                              <th className="border border-gray-200 px-4 py-2.5 text-right w-36">Kurang Bayar</th>
                              <th className="border border-gray-200 px-4 py-2.5 text-center w-32">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupGeneral.map((row, rIdx) => {
                              const amount = num(row.amount ?? row.amount_due);
                              const paidAmount = num(row.paid_amount);
                              const remaining = num(row.remaining_amount);
                              const status = str(row.display_status ?? row.status);
                              const isLunas = status.toLowerCase() === 'lunas' || (amount > 0 && paidAmount >= amount);
                              const semesterName = str(row.semester, row.semester_id === 1 ? 'Semester Ganjil' : row.semester_id === 2 ? 'Semester Genap' : 'Tahunan / Sekali Bayar');

                              return (
                                <tr key={rIdx} className="hover:bg-gray-50/50">
                                  <td className="border border-gray-200 bg-white px-4 py-3 font-extrabold text-gray-800">
                                    {str(row.name ?? row.nama ?? row.payment_type_name ?? row.title)}
                                  </td>
                                  <td className="border border-gray-200 bg-white px-3 py-3 text-center">
                                    <span className={`inline-block rounded-md px-2.5 py-1 text-xs font-black ${
                                      semesterName.toLowerCase().includes('ganjil')
                                        ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                        : semesterName.toLowerCase().includes('genap')
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}>
                                      {semesterName}
                                    </span>
                                  </td>
                                  <td className="border border-gray-200 bg-white px-4 py-3 text-right font-bold text-gray-700">
                                    {formatMoney(amount)}
                                  </td>
                                  <td className="border border-gray-200 bg-white px-4 py-3 text-right font-bold text-gray-700">
                                    {formatMoney(paidAmount)}
                                  </td>
                                  <td className="border border-gray-200 bg-white px-4 py-3 text-right font-bold text-gray-700">
                                    {formatMoney(remaining)}
                                  </td>
                                  <td className="border border-gray-200 bg-white px-4 py-3 text-center">
                                    <span className={`inline-block rounded-lg px-3 py-1 text-xs font-black ${
                                      isLunas
                                        ? 'bg-[#138F81] text-white'
                                        : remaining < amount && paidAmount > 0
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-[#E74C3C] text-white'
                                    }`}>
                                      {isLunas ? 'LUNAS' : remaining < amount && paidAmount > 0 ? 'KURANG BAYAR' : 'BELUM LUNAS'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* KASIR POS PEMBAYARAN SANTRI */}
          {student ? (
            <DirectPaymentCashier
              student={student}
              userId={userId}
              paymentTypes={paymentTypes}
              paymentMethods={paymentMethods}
              academicPeriods={academicPeriods}
              summaryData={summary}
              onPaymentSuccess={onPaymentSuccess}
            />
          ) : null}

          {/* RIWAYAT SEMUA TRANSAKSI SANTRI (CETAK ULANG KAPAN SAJA & MULTI PILIH) */}
          {student && Array.isArray(summary?.transactions) && summary.transactions.length > 0 && (
            <StudentPaymentHistorySection
              transactions={summary.transactions as ApiRecord[]}
              student={student}
            />
          )}
        </>
      ) : (
        <div className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-bold text-[#636E72]">Pilih santri untuk melihat tagihan.</div>
      )}

      {confirmCancel ? (
        <ConfirmDialog
          title="Batalkan Pembayaran"
          message={`Yakin ingin membatalkan pembayaran ${confirmCancel.title}? Data transaksi ini akan dihapus.`}
          tone="danger"
          confirmLabel="Batalkan Pembayaran"
          onCancel={() => setConfirmCancel(null)}
          onConfirm={async () => {
            await onDeletePayment(confirmCancel.id, confirmCancel.title);
            setConfirmCancel(null);
          }}
        />
      ) : null}
    </div>
  );
}

function StudentPaymentHistorySection({
  transactions,
  student,
}: {
  transactions: ApiRecord[];
  student: ApiRecord;
}) {
  const [semesterFilter, setSemesterFilter] = useState<'all' | 'ganjil' | 'genap'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isSendingWa, setIsSendingWa] = useState(false);

  // Filter transactions based on semester & search
  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      const txSem = str(tx.semester ?? '').toLowerCase();
      const semMatch =
        semesterFilter === 'all' ||
        (semesterFilter === 'ganjil' && (txSem.includes('ganjil') || tx.semester_id === 1)) ||
        (semesterFilter === 'genap' && (txSem.includes('genap') || tx.semester_id === 2));

      if (!semMatch) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const code = str(tx.kode_transaksi ?? tx.invoice_number ?? tx.transaction_code).toLowerCase();
      const ket = str(tx.keterangan).toLowerCase();
      const items = Array.isArray(tx.items) ? (tx.items as ApiRecord[]) : [];
      const itemNames = items.map((it) => {
        const pType = record(it.paymentType);
        return str(it.payment_type_name ?? it.nama ?? pType.nama ?? it.name);
      }).join(' ').toLowerCase();

      return code.includes(q) || ket.includes(q) || itemNames.includes(q);
    });
  }, [transactions, semesterFilter, searchQuery]);

  const totalFilteredAmount = useMemo(() => {
    return filtered.reduce((sum, tx) => sum + num(tx.jumlah_total ?? tx.jumlah ?? tx.amount), 0);
  }, [filtered]);

  const totalAllAmount = useMemo(() => {
    return transactions.reduce((sum, tx) => sum + num(tx.jumlah_total ?? tx.jumlah ?? tx.amount), 0);
  }, [transactions]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((tx) => num(tx.id)).filter((id) => id > 0));
    }
  };

  const isAllSelected = filtered.length > 0 && selectedIds.length === filtered.length;

  const handleBatchPrint = () => {
    if (selectedIds.length === 0) return;
    window.open(`/finance/print/${selectedIds.join(',')}`, '_blank', 'noopener,noreferrer');
  };

  const handleBatchWa = async () => {
    if (selectedIds.length === 0) return;
    try {
      setIsSendingWa(true);
      for (const id of selectedIds) {
        await api.notifyWaPayment(id).catch(() => null);
      }
      alert(`✅ Berhasil mengirim WhatsApp untuk ${selectedIds.length} transaksi terpilih!`);
    } catch (err) {
      alert(`Gagal mengirim WhatsApp: ${err instanceof Error ? err.message : 'Error'}`);
    } finally {
      setIsSendingWa(false);
    }
  };

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
      {/* HEADER & SUMMARY STATS */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b-2 border-gray-100 pb-4">
        <div>
          <h3 className="text-base font-black tracking-wide text-gray-800 uppercase flex items-center gap-2">
            <span>RIWAYAT SEMUA PEMBAYARAN SANTRI</span>
            <span className="rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-xs font-black text-teal-800">
              {transactions.length} Transaksi Tercatat
            </span>
          </h3>
          <p className="text-xs font-semibold text-gray-500 mt-1">
            Gunakan tabel ini jika ingin mencetak ulang struk pembayaran lama atau mengirim ulang WhatsApp ke wali santri.
          </p>
        </div>

        {/* STATS TOTAL BAYAR */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl bg-gray-50 border border-gray-200 px-4 py-2 text-right">
            <div className="text-[11px] font-bold text-gray-500 uppercase">Total Uang Masuk Santri</div>
            <div className="text-base font-black text-[#138F81]">{formatMoney(totalAllAmount)}</div>
          </div>
          {semesterFilter !== 'all' && (
            <div className="rounded-2xl bg-teal-50 border border-teal-200 px-4 py-2 text-right">
              <div className="text-[11px] font-bold text-teal-700 uppercase">Total Filter ({semesterFilter})</div>
              <div className="text-base font-black text-teal-900">{formatMoney(totalFilteredAmount)}</div>
            </div>
          )}
        </div>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50/80 p-3 rounded-2xl border border-gray-200">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-gray-500 mr-1">Filter Semester:</span>
          <button
            type="button"
            onClick={() => setSemesterFilter('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-black transition-all ${
              semesterFilter === 'all'
                ? 'bg-[#138F81] text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Semua ({transactions.length})
          </button>
          <button
            type="button"
            onClick={() => setSemesterFilter('ganjil')}
            className={`rounded-xl px-3 py-1.5 text-xs font-black transition-all ${
              semesterFilter === 'ganjil'
                ? 'bg-[#138F81] text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            🍂 Semester Ganjil (Jul - Des)
          </button>
          <button
            type="button"
            onClick={() => setSemesterFilter('genap')}
            className={`rounded-xl px-3 py-1.5 text-xs font-black transition-all ${
              semesterFilter === 'genap'
                ? 'bg-[#138F81] text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            🌸 Semester Genap (Jan - Jun)
          </button>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 placeholder:font-normal placeholder:text-gray-400 focus:border-[#138F81] focus:outline-none"
            placeholder="Cari no. trx / nama tagihan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* BATCH ACTION BAR WHEN CHECKED */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-teal-900 p-3.5 text-white shadow-md animate-in fade-in duration-200">
          <div className="flex items-center gap-2 font-black text-xs text-teal-100">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#138F81] text-white text-xs">
              ✓
            </span>
            <span>{selectedIds.length} transaksi pembayaran dipilih</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleBatchPrint}
              className="flex items-center gap-1.5 rounded-xl bg-white hover:bg-teal-50 px-3.5 py-1.5 text-xs font-black text-[#138F81] shadow-sm transition-all"
            >
              <Printer size={14} />
              Cetak Struk Terpilih ({selectedIds.length})
            </button>

            <button
              type="button"
              disabled={isSendingWa}
              onClick={handleBatchWa}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-3.5 py-1.5 text-xs font-black text-white shadow-sm transition-all disabled:opacity-50"
            >
              {isSendingWa ? <RefreshCw className="animate-spin" size={14} /> : null}
              📲 Kirim WA Terpilih ({selectedIds.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="rounded-xl bg-teal-800 hover:bg-teal-700 px-3 py-1.5 text-xs font-bold text-teal-200 transition-colors"
            >
              Batal Pilih
            </button>
          </div>
        </div>
      )}

      {/* SCROLLABLE TABLE (MIN 5 ROWS THEN SCROLL) */}
      <div className="max-h-[360px] overflow-y-auto q-scrollbar rounded-2xl border border-gray-200 shadow-sm">
        <table className="w-full min-w-[840px] border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-gray-100 border-b border-gray-300 shadow-sm">
            <tr className="font-black text-gray-700 text-left">
              <th className="py-2.5 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-[#138F81] focus:ring-[#138F81] cursor-pointer"
                  title="Pilih / Batal Pilih Semua"
                />
              </th>
              <th className="py-2.5 px-2 w-10 text-center">No</th>
              <th className="py-2.5 px-3 w-28">Tanggal</th>
              <th className="py-2.5 px-3 w-36">No. Transaksi</th>
              <th className="py-2.5 px-3">Tipe Pembayaran & Rincian Item</th>
              <th className="py-2.5 px-3 w-36 text-center">Tahun & Semester</th>
              <th className="py-2.5 px-3 text-right w-28">Total Bayar</th>
              <th className="py-2.5 px-3 text-center w-20">Metode</th>
              <th className="py-2.5 px-3 text-center w-20">Status</th>
              <th className="py-2.5 px-3 text-center w-28">Cetak / WA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-gray-400 font-bold">
                  Tidak ada transaksi yang cocok dengan filter.
                </td>
              </tr>
            ) : (
              filtered.map((tx, idx) => {
                const txId = num(tx.id);
                const items = Array.isArray(tx.items) ? (tx.items as ApiRecord[]) : [];
                const isSelected = selectedIds.includes(txId);
                const isLunas = str(tx.status).toLowerCase() === 'lunas';

                const txSem = str(tx.semester ?? '').toLowerCase();
                const isGanjil = txSem.includes('ganjil') || tx.semester_id === 1;
                const isGenap = txSem.includes('genap') || tx.semester_id === 2;
                const semText = isGanjil ? 'Ganjil' : isGenap ? 'Genap' : str(tx.semester, 'Umum');
                const thnAjaranText = str(tx.tahun_ajaran, '2025/2026');

                return (
                  <tr
                    key={txId || idx}
                    className={`transition-colors font-bold ${
                      isSelected
                        ? 'bg-teal-50/70 hover:bg-teal-100/70'
                        : 'hover:bg-gray-50/80'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(txId)}
                        className="h-4 w-4 rounded border-gray-300 text-[#138F81] focus:ring-[#138F81] cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 px-2 text-center text-gray-500 font-semibold">{idx + 1}</td>
                    <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap">
                      {str(tx.tanggal ?? tx.created_at ?? '-').slice(0, 10)}
                    </td>
                    <td className="py-2.5 px-3 font-extrabold text-teal-800 whitespace-nowrap">
                      {str(tx.kode_transaksi ?? tx.transaction_code ?? tx.invoice_number ?? `TRX-${txId}`)}
                    </td>
                    <td className="py-2.5 px-3 text-gray-800">
                      {items.length > 0 ? (
                        <div className="space-y-1">
                          {items.map((it, itIdx) => {
                            const pType = record(it.paymentType);
                            const pBill = record(it.paymentBill);
                            const pName = str(it.payment_type_name ?? it.nama ?? pType.nama ?? it.name ?? 'Tagihan');
                            const pMonth = num(it.period_month || pBill.period_month);
                            const mName = pMonth > 0 ? monthLabels[pMonth] : '';
                            const itAmount = num(it.jumlah);
                            return (
                              <div key={itIdx} className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold text-gray-900">{pName}</span>
                                {mName && (
                                  <span className="rounded bg-teal-100 px-1.5 py-0.2 text-[10px] font-black text-teal-900">
                                    Bulan {mName}
                                  </span>
                                )}
                                {itAmount > 0 && items.length > 1 && (
                                  <span className="text-[11px] font-bold text-gray-500">
                                    ({formatMoney(itAmount)})
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="font-extrabold text-gray-900">{str(tx.jenis || 'Pembayaran Santri')}</div>
                      )}
                      {Boolean(tx.keterangan) && tx.keterangan !== '-' && !String(tx.keterangan).toLowerCase().startsWith('pembayaran santri') ? (
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-900 bg-amber-50 rounded px-2 py-0.5 border border-amber-200/80 w-fit max-w-[280px] truncate">
                          <span className="font-bold">📝 Catatan:</span> {str(tx.keterangan)}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="text-[11px] font-black text-gray-700">{thnAjaranText}</div>
                      <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-black ${
                        isGanjil
                          ? 'bg-teal-50 text-teal-800 border border-teal-200'
                          : isGenap
                          ? 'bg-blue-50 text-blue-800 border border-blue-200'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {semText}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-[#138F81] text-sm whitespace-nowrap">
                      {formatMoney(tx.jumlah_total ?? tx.jumlah ?? tx.amount ?? 0)}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-700">
                        {str(tx.via ?? tx.payment_method_name ?? 'Tunai')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-black ${
                        isLunas ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {str(tx.status ?? 'Lunas')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => window.open(`/finance/print/${txId}`, '_blank', 'noopener,noreferrer')}
                          className="rounded-lg bg-teal-50 hover:bg-teal-100 p-1.5 text-teal-800 font-bold transition-colors"
                          title="Cetak Struk Transaksi Ini"
                        >
                          <Printer size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await api.notifyWaPayment(txId);
                              alert(res.message || 'Pesan WhatsApp berhasil dikirim!');
                            } catch (err) {
                              alert(`Gagal mengirim WhatsApp: ${err instanceof Error ? err.message : 'Error'}`);
                            }
                          }}
                          className="rounded-lg bg-emerald-50 hover:bg-emerald-100 p-1.5 text-emerald-800 font-bold transition-colors"
                          title="Kirim Ulang WA ke Wali"
                        >
                          <span className="text-[11px] font-black">WA</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
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

function SelectField({
  label,
  value,
  onChange,
  rows,
  labelOf,
  hidePlaceholder = false,
}: {
  label: string;
  value: number | string;
  onChange: (id: number) => void;
  rows: ApiRecord[];
  labelOf: (row: ApiRecord) => string;
  hidePlaceholder?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[#636E72]">{label}</span>
      <select
        className="q-input"
        value={value !== undefined && value !== null ? String(value) : ''}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {!hidePlaceholder && <option value="">Pilih {label.toLowerCase()}</option>}
        {rows.map((row) => (
          <option key={num(row.id)} value={String(num(row.id))}>
            {labelOf(row)}
          </option>
        ))}
      </select>
    </label>
  );
}

function PaymentTypeModal({
  row,
  semesters,
  paymentMethods,
  paymentPeriods,
  onClose,
  onSaved
}: {
  row: ApiRecord | null;
  semesters: ApiRecord[];
  paymentMethods: ApiRecord[];
  paymentPeriods: ApiRecord[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const activeSem = semesters.find((s) => s.is_active === true) ?? semesters[0];
  const [targetSemesterId, setTargetSemesterId] = useState(0);
  const [name, setName] = useState(str(row?.nama, ''));
  const [amount, setAmount] = useState(String(row?.nominal_default ?? ''));
  const [periodId, setPeriodId] = useState(num(row?.payment_period_type_id ?? paymentPeriods[0]?.id));
  const [status, setStatus] = useState(str(row?.status, 'Aktif'));
  const [methods, setMethods] = useState<Set<string>>(() => new Set((Array.isArray(row?.metode_pembayaran) ? row?.metode_pembayaran : paymentMethods.map((item) => item.name)).map(String)));
  const [isBilledToAll, setIsBilledToAll] = useState(row?.is_billed_to_all !== false);
  const [billedMonths, setBilledMonths] = useState<Set<number>>(() => {
    const allMonths = [7,8,9,10,11,12,1,2,3,4,5,6];
    if (Array.isArray(row?.billed_months) && row.billed_months.length > 0) {
      return new Set(row.billed_months.map(Number));
    }
    const rulesArray = Array.isArray(row?.bill_rules) ? row?.bill_rules : (Array.isArray(row?.billRules) ? row?.billRules : []);
    const rule = rulesArray[0];
    if (rule && Array.isArray(rule.billed_months) && rule.billed_months.length > 0) {
      return new Set(rule.billed_months.map(Number));
    }
    return new Set(allMonths);
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Saat targetSemesterId berubah, load setting rule-nya jika ada
  useEffect(() => {
    if (!row) return;
    const allMonths = [7,8,9,10,11,12,1,2,3,4,5,6];
    if (targetSemesterId === 0) {
      setAmount(String(row.nominal_default ?? ''));
      setBilledMonths(new Set(Array.isArray(row.billed_months) && row.billed_months.length > 0 ? row.billed_months.map(Number) : allMonths));
      return;
    }
    const rulesArray = Array.isArray(row.bill_rules) ? row.bill_rules : (Array.isArray(row.billRules) ? row.billRules : []);
    const rule = rulesArray.find((r: any) => num(r.semester_id) === targetSemesterId);
    if (rule) {
      setAmount(String(rule.nominal ?? row.nominal_default ?? ''));
      setBilledMonths(new Set(Array.isArray(rule.billed_months) && rule.billed_months.length > 0 ? rule.billed_months.map(Number) : (Array.isArray(row.billed_months) && row.billed_months.length > 0 ? row.billed_months.map(Number) : allMonths)));
    } else {
      setAmount(String(row.nominal_default ?? ''));
      setBilledMonths(new Set(Array.isArray(row.billed_months) && row.billed_months.length > 0 ? row.billed_months.map(Number) : allMonths));
    }
  }, [targetSemesterId, row]);

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
        status,
        is_billed_to_all: isBilledToAll,
        billed_months: Array.from(billedMonths),
        target_semester_id: targetSemesterId > 0 ? targetSemesterId : null,
      };
      if (row?.id) await api.updatePaymentType(num(row.id), payload);
      else await api.createPaymentType(payload);
      setSuccessMsg('Tipe Pembayaran berhasil disimpan!');
      setTimeout(() => {
        onSaved().catch(console.error);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tipe pembayaran gagal disimpan');
      setSaving(false);
    }
  }

  return (
    <ModalForm title={row ? 'Edit Tipe Pembayaran' : 'Tambah Tipe Pembayaran'} onClose={onClose} footer={<SaveButton saving={saving} form="type-form" label="Simpan Tipe Pembayaran" />}>
      <form id="type-form" className="space-y-4" onSubmit={submit}>
        {row && (
          <div className="rounded-2xl border-2 border-orange-100 bg-orange-50 p-4">
            <SelectField 
              label="Pilih Target Semester (Opsional)" 
              value={targetSemesterId} 
              onChange={setTargetSemesterId} 
              rows={[{ id: 0, name: 'Berlaku Global (Semua Semester)' }, ...semesters]} 
              labelOf={(s) => str(s.name ?? s.semester)} 
              hidePlaceholder={true}
            />
            <p className="mt-2 text-xs text-orange-600">
              Ubah ke semester spesifik (Ganjil/Genap) jika Anda ingin mengubah Nominal/Bulan tagihan yang <b>hanya berlaku untuk semester tersebut</b>.
            </p>
          </div>
        )}
        <TextField label="Nama Tipe Pembayaran" value={name} onChange={setName} required />
        <TextField label={targetSemesterId > 0 ? "Nominal Semester Ini" : "Nominal Default"} value={amount} onChange={(value) => setAmount(value.replace(/\D/g, ''))} required />
        <SelectField label="Periode Pembayaran" value={periodId} onChange={setPeriodId} rows={paymentPeriods} labelOf={(item) => str(item.name)} />
        
        <div className="flex items-center gap-3 rounded-2xl bg-white p-4">
          <input type="checkbox" id="is_billed_to_all" checked={isBilledToAll} onChange={(e) => setIsBilledToAll(e.target.checked)} className="h-5 w-5 rounded border-[#B2BEC3] text-[#138F81] focus:ring-[#138F81]" />
          <label htmlFor="is_billed_to_all" className="text-sm font-extrabold text-[#2D3436]">Masukkan ke penagihan seluruh santri otomatis?</label>
        </div>

        {paymentPeriods.find((item) => num(item.id) === periodId)?.code === 'bulanan' ? (
          <div className="rounded-3xl bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-extrabold text-[#2D3436]">Bulan yang ditagihkan ({billedMonths.size} bulan)</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBilledMonths(new Set([7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]))}
                  className="rounded-lg bg-teal-50 px-2 py-1 text-xs font-bold text-[#138F81] hover:bg-teal-100"
                >
                  Pilih Semua (12 Bulan)
                </button>
                <button
                  type="button"
                  onClick={() => setBilledMonths(new Set())}
                  className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600 hover:bg-gray-200"
                >
                  Kosongkan
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {[
                { v: 7, l: 'Jul' }, { v: 8, l: 'Agu' }, { v: 9, l: 'Sep' }, { v: 10, l: 'Okt' }, { v: 11, l: 'Nov' }, { v: 12, l: 'Des' },
                { v: 1, l: 'Jan' }, { v: 2, l: 'Feb' }, { v: 3, l: 'Mar' }, { v: 4, l: 'Apr' }, { v: 5, l: 'Mei' }, { v: 6, l: 'Jun' }
              ].map((m) => {
                const selected = billedMonths.has(m.v);
                return (
                  <button
                    key={m.v}
                    className={`rounded-xl py-2 text-xs font-bold transition-all ${
                      selected ? 'bg-[#138F81] text-white shadow-sm' : 'bg-[#F2F4F6] text-[#636E72] hover:bg-[#E2E8F0]'
                    }`}
                    onClick={() => setBilledMonths((current) => {
                      const next = new Set(current);
                      if (next.has(m.v)) next.delete(m.v);
                      else next.add(m.v);
                      return next;
                    })}
                    type="button"
                  >
                    {m.l} {selected ? '✓' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

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
        {successMsg ? <div className="rounded-2xl bg-[#D0EAF0] px-4 py-3 text-sm font-bold text-[#138F81]">{successMsg}</div> : null}
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

function TextField({ label, value, onChange, required = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[#636E72]">{label}</span>
      <input className="q-input" value={value} onChange={(event) => onChange(event.target.value)} required={required} placeholder={placeholder} />
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
  const { session } = useAuth();
  const [receiptWidth, setReceiptWidth] = useState(String(settings?.receipt_width ?? '58mm'));
  const [paymentAdminName, setPaymentAdminName] = useState(String(settings?.payment_admin_name ?? ''));
  const [paymentAdminTitle, setPaymentAdminTitle] = useState(String(settings?.payment_admin_title ?? ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Sync settings when loaded from server
  useEffect(() => {
    if (settings) {
      if (settings.receipt_width) setReceiptWidth(String(settings.receipt_width));
      if (settings.payment_admin_name !== undefined) setPaymentAdminName(String(settings.payment_admin_name ?? ''));
      if (settings.payment_admin_title !== undefined) setPaymentAdminTitle(String(settings.payment_admin_title ?? ''));
    }
  }, [settings]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.updateDocumentSettings({ 
        user_id: session?.id ?? 1,
        document_type: 'pembayaran',
        receipt_width: receiptWidth,
        payment_admin_name: paymentAdminName.trim() || "MTS ASSA'ADAH II",
        payment_admin_title: paymentAdminTitle.trim() || 'JL. MASJID KIYAI GEDE BUNGAH',
        payment_signature_mode: settings?.payment_signature_mode ?? 'kosong'
      });
      await onSaved();
      setSuccess('✅ Pengaturan judul struk & printer berhasil disimpan!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  }

  const previewName = paymentAdminName.trim() || "MTS ASSA'ADAH II";
  const previewAddress = paymentAdminTitle.trim() || 'JL. MASJID KIYAI GEDE BUNGAH';

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-xl font-extrabold text-[#2D3436]">Pengaturan Format & Judul Struk</h2>
        <p className="text-xs font-semibold text-[#636E72] mt-1">
          Ubah nama aplikasi/institusi, alamat, dan ukuran kertas printer yang tercetak pada struk kasir secara fleksibel tanpa edit kodingan.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* FORM SETTINGS */}
        <div className="lg:col-span-7 rounded-3xl bg-white p-6 shadow-sm border border-gray-100 space-y-5">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Judul Struk / Nama Aplikasi & Lembaga
              </label>
              <input
                type="text"
                className="q-input font-bold"
                value={paymentAdminName}
                onChange={(e) => setPaymentAdminName(e.target.value)}
                placeholder="Contoh: MTS ASSA'ADAH II / SISTEM INFORMASI PONDOK"
                required
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="text-[11px] font-semibold text-gray-400">Contoh Cepat:</span>
                <button
                  type="button"
                  onClick={() => setPaymentAdminName("MTS ASSA'ADAH II")}
                  className="rounded-md bg-gray-100 hover:bg-gray-200 px-2 py-0.5 text-[11px] font-bold text-gray-700 transition-colors"
                >
                  MTS ASSA'ADAH II
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentAdminName('YAYASAN PONDOK PESANTREN QOMARUDDIN')}
                  className="rounded-md bg-gray-100 hover:bg-gray-200 px-2 py-0.5 text-[11px] font-bold text-gray-700 transition-colors"
                >
                  PONDOK PESANTREN
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Alamat / Kontak / Keterangan Baris Ke-2
              </label>
              <input
                type="text"
                className="q-input font-medium"
                value={paymentAdminTitle}
                onChange={(e) => setPaymentAdminTitle(e.target.value)}
                placeholder="Contoh: JL. MASJID KIYAI GEDE BUNGAH (031) 3949818"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Ukuran Printer & Format Kertas
              </label>
              <select
                className="q-input font-bold text-gray-800"
                value={receiptWidth}
                onChange={(e) => setReceiptWidth(e.target.value)}
              >
                <option value="58mm">58mm (Printer Thermal Kasir Kecil / Bluetooth POS 58mm)</option>
                <option value="80mm">80mm (Printer Thermal Kasir Besar / Desktop POS 80mm)</option>
                <option value="100%">100% / A4 / A5 (Kertas Biasa / Inkjet / Laser Printer)</option>
              </select>
              <p className="mt-1 text-[11px] text-gray-500 font-medium">
                💡 Struk otomatis auto-fit margin saat dicetak di printer apapun tanpa ada teks terpotong.
              </p>
            </div>

            {error ? <div className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-xs font-bold text-[#D63031]">{error}</div> : null}
            {success ? <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-black text-emerald-800">{success}</div> : null}

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#138F81] px-5 py-3.5 text-sm font-extrabold text-white hover:bg-[#0F7A6E] shadow-md shadow-[#138F81]/25 transition-all disabled:opacity-50"
              >
                {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                {saving ? 'Menyimpan...' : 'Simpan Pengaturan Struk'}
              </button>
            </div>
          </form>
        </div>

        {/* REALTIME THERMAL PREVIEW */}
        <div className="lg:col-span-5 rounded-3xl bg-gray-50 p-6 border border-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-gray-600">
              Live Preview Struk Thermal
            </span>
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-black text-teal-800">
              {receiptWidth === '80mm' ? '80mm' : receiptWidth === '100%' ? 'A4/A5' : '58mm'}
            </span>
          </div>

          <div
            className="mx-auto rounded-xl bg-white p-3.5 shadow-md border border-gray-300 text-black font-mono leading-tight space-y-1.5 transition-all duration-300"
            style={{
              width: receiptWidth === '80mm' ? '100%' : receiptWidth === '100%' ? '100%' : '240px',
              fontSize: '11px',
            }}
          >
            {/* KOP */}
            <div className="text-center space-y-0.5">
              <div className="font-extrabold text-[12px] uppercase tracking-wider break-words">{previewName}</div>
              <div className="text-[10px] font-bold uppercase break-words">{previewAddress}</div>
            </div>

            <div className="border-b border-black border-dashed my-1" />

            <div className="text-center font-black tracking-widest text-[11px] uppercase">
              BUKTI PEMBAYARAN
            </div>

            <div className="border-b border-black border-dashed my-1" />

            {/* METADATA */}
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between"><span>Tanggal</span><span>: 10-08-2026</span></div>
              <div className="flex justify-between"><span>No. Trx</span><span className="font-bold">: TR-R95F5FF...</span></div>
              <div className="flex justify-between"><span>Nama</span><span className="font-bold">: AHMAD ZAKI (240188)</span></div>
              <div className="flex justify-between"><span>Kelas</span><span>: Sifir Awal A</span></div>
              <div className="flex justify-between"><span>Thn Ajaran</span><span>: 2025/2026 (1)</span></div>
            </div>

            <div className="border-b-[1.5px] border-black my-1" />

            {/* TABLE */}
            <div className="flex justify-between font-extrabold text-[10px]">
              <span>Uraian</span>
              <span>Nominal</span>
            </div>

            <div className="border-b-[1.5px] border-black my-1" />

            <div className="space-y-1 text-[10px]">
              <div>
                <div className="flex justify-between font-bold">
                  <span>1. SPP 2025/2026 Bulan</span>
                  <span>350.000</span>
                </div>
                <div className="pl-3 text-[9px]">Agustus</div>
              </div>
              <div>
                <div className="flex justify-between font-bold">
                  <span>2. Bayar Kitab Kuning</span>
                  <span>120.000</span>
                </div>
                <div className="pl-3 text-[9px]">2025/2026 (Lunas)</div>
              </div>
            </div>

            <div className="border-b border-black border-dashed my-1" />

            <div className="flex justify-between font-black text-[11px]">
              <span>TOTAL</span>
              <span>470.000</span>
            </div>

            <div className="border-b-[1.5px] border-black my-1" />

            <div className="mt-2 text-[10px]">
              <div className="font-bold">Petugas</div>
              <div className="h-6" />
              <div className="font-bold uppercase underline">ADMIN MADRASAH</div>
            </div>

            <div className="mt-3 text-center text-[9px] space-y-0.5">
              <div className="font-extrabold">*** TERIMA KASIH ***</div>
              <div className="italic">Struk ini adalah bukti pembayaran yang sah</div>
            </div>
          </div>
        </div>
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
