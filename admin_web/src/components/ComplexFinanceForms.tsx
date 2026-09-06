import {
  Banknote,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Layers,
  Save,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, type ApiRecord } from '../services/api';

function str(value: unknown, fallback = ''): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/* =========================================================================
   1. COMPLEX PAYMENT TYPE (TIPE TAGIHAN SANTRI / SPP) IN-PAGE FORM
   ========================================================================= */
export function ComplexPaymentTypeForm({
  row,
  semesters,
  paymentMethods,
  paymentPeriods,
  onClose,
  onSaved,
}: {
  row: ApiRecord | null;
  semesters: ApiRecord[];
  paymentMethods: ApiRecord[];
  paymentPeriods: ApiRecord[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [targetSemesterId, setTargetSemesterId] = useState(0);
  const [name, setName] = useState(str(row?.nama, ''));
  const [amount, setAmount] = useState(String(row?.nominal_default ?? ''));
  const [periodId, setPeriodId] = useState(num(row?.payment_period_type_id ?? paymentPeriods[0]?.id));
  const [status, setStatus] = useState(str(row?.status, 'Aktif'));
  const [methods, setMethods] = useState<Set<string>>(() => {
    return new Set(
      (Array.isArray(row?.metode_pembayaran)
        ? row?.metode_pembayaran
        : paymentMethods.map((item) => item.name)
      ).map(String)
    );
  });
  const [isBilledToAll, setIsBilledToAll] = useState(row?.is_billed_to_all !== false);
  const [targetGender, setTargetGender] = useState<'ALL' | 'L' | 'P'>(() => {
    const g = str(row?.target_gender, 'ALL').toUpperCase();
    if (g === 'L' || g === 'LAKI-LAKI' || g === 'PUTRA') return 'L';
    if (g === 'P' || g === 'PEREMPUAN' || g === 'PUTRI') return 'P';
    return 'ALL';
  });
  const [billedMonths, setBilledMonths] = useState<Set<number>>(() => {
    const allMonths = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
    if (Array.isArray(row?.billed_months) && row.billed_months.length > 0) {
      return new Set(row.billed_months.map(Number));
    }
    const rulesArray = Array.isArray(row?.bill_rules)
      ? row?.bill_rules
      : Array.isArray(row?.billRules)
      ? row?.billRules
      : [];
    const rule = rulesArray[0] as ApiRecord | undefined;
    if (rule && Array.isArray(rule.billed_months) && rule.billed_months.length > 0) {
      return new Set(rule.billed_months.map(Number));
    }
    return new Set(allMonths);
  });
  const [monthAmounts, setMonthAmounts] = useState<Record<number, string>>(() => {
    const raw = (row?.month_amounts ||
      (row?.billRules && (row.billRules as unknown[])[0] && ((row.billRules as unknown[])[0] as ApiRecord).month_amounts) ||
      {}) as Record<string, number>;
    const res: Record<number, string> = {};
    if (raw && typeof raw === 'object') {
      Object.entries(raw).forEach(([k, v]) => {
        if (v) res[Number(k)] = String(v);
      });
    }
    return res;
  });
  const [monthNotes, setMonthNotes] = useState<Record<number, string>>(() => {
    const raw = (row?.month_notes ||
      (row?.billRules && (row.billRules as unknown[])[0] && ((row.billRules as unknown[])[0] as ApiRecord).month_notes) ||
      {}) as Record<string, string>;
    const res: Record<number, string> = {};
    if (raw && typeof raw === 'object') {
      Object.entries(raw).forEach(([k, v]) => {
        if (v) res[Number(k)] = String(v);
      });
    }
    return res;
  });

  const [saving, setSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  // Saat targetSemesterId berubah, load setting rule-nya jika ada
  useEffect(() => {
    if (!row) return;
    const allMonths = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
    if (targetSemesterId === 0) {
      setAmount(String(row.nominal_default ?? ''));
      setBilledMonths(
        new Set(
          Array.isArray(row.billed_months) && row.billed_months.length > 0
            ? row.billed_months.map(Number)
            : allMonths
        )
      );
      const sourceAmounts = (row.month_amounts || {}) as Record<string, number>;
      const loaded: Record<number, string> = {};
      if (sourceAmounts && typeof sourceAmounts === 'object') {
        Object.entries(sourceAmounts).forEach(([k, v]) => {
          if (v) loaded[Number(k)] = String(v);
        });
      }
      setMonthAmounts(loaded);

      const sourceNotes = (row.month_notes || {}) as Record<string, string>;
      const loadedNotes: Record<number, string> = {};
      if (sourceNotes && typeof sourceNotes === 'object') {
        Object.entries(sourceNotes).forEach(([k, v]) => {
          if (v) loadedNotes[Number(k)] = String(v);
        });
      }
      setMonthNotes(loadedNotes);
      return;
    }
    const rulesArray = Array.isArray(row.bill_rules)
      ? row.bill_rules
      : Array.isArray(row.billRules)
      ? row.billRules
      : [];
    const rule = rulesArray.find((r: ApiRecord) => num(r.semester_id) === targetSemesterId);
    if (rule) {
      setAmount(String(rule.nominal ?? row.nominal_default ?? ''));
      setBilledMonths(
        new Set(
          Array.isArray(rule.billed_months) && rule.billed_months.length > 0
            ? rule.billed_months.map(Number)
            : Array.isArray(row.billed_months) && row.billed_months.length > 0
            ? row.billed_months.map(Number)
            : allMonths
        )
      );
      const sourceAmounts = (rule.month_amounts || row.month_amounts || {}) as Record<string, number>;
      const loaded: Record<number, string> = {};
      if (sourceAmounts && typeof sourceAmounts === 'object') {
        Object.entries(sourceAmounts).forEach(([k, v]) => {
          if (v) loaded[Number(k)] = String(v);
        });
      }
      setMonthAmounts(loaded);

      const sourceNotes = (rule.month_notes || row.month_notes || {}) as Record<string, string>;
      const loadedNotes: Record<number, string> = {};
      if (sourceNotes && typeof sourceNotes === 'object') {
        Object.entries(sourceNotes).forEach(([k, v]) => {
          if (v) loadedNotes[Number(k)] = String(v);
        });
      }
      setMonthNotes(loadedNotes);
    } else {
      setAmount(String(row.nominal_default ?? ''));
      setBilledMonths(
        new Set(
          Array.isArray(row.billed_months) && row.billed_months.length > 0
            ? row.billed_months.map(Number)
            : allMonths
        )
      );
      setMonthAmounts({});
      setMonthNotes({});
    }
  }, [targetSemesterId, row]);

  const selectedPeriod = useMemo(() => {
    return paymentPeriods.find((p) => num(p.id) === periodId);
  }, [paymentPeriods, periodId]);

  const isBulanan =
    String(selectedPeriod?.code ?? '').toLowerCase() === 'bulanan' ||
    String(selectedPeriod?.name ?? '').toLowerCase().includes('bulan');


  const submit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (saving) return;

    if (!name.trim()) {
      setError('Nama tipe pembayaran / pos tagihan wajib diisi.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError('Nominal tagihan wajib diisi dengan nominal yang valid.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const customAmountsPayload: Record<number, number> = {};
      Object.entries(monthAmounts).forEach(([k, v]) => {
        const parsed = Number(String(v).replace(/\D/g, ''));
        if (parsed > 0 && parsed !== num(amount)) {
          customAmountsPayload[Number(k)] = parsed;
        }
      });

      const customNotesPayload: Record<number, string> = {};
      Object.entries(monthNotes).forEach(([k, v]) => {
        const trimmed = String(v ?? '').trim();
        if (trimmed) {
          customNotesPayload[Number(k)] = trimmed;
        }
      });

      const payload = {
        nama: name.trim(),
        nominal_default: num(amount),
        periode: str(selectedPeriod?.code ?? selectedPeriod?.name, 'umum'),
        payment_period_type_id: periodId,
        metode_pembayaran: Array.from(methods),
        status,
        target_gender: targetGender,
        is_billed_to_all: isBilledToAll,
        billed_months: Array.from(billedMonths),
        month_amounts: Object.keys(customAmountsPayload).length > 0 ? customAmountsPayload : null,
        month_notes: Object.keys(customNotesPayload).length > 0 ? customNotesPayload : null,
        target_semester_id: targetSemesterId > 0 ? targetSemesterId : null,
      };

      if (row?.id) {
        await api.updatePaymentType(num(row.id), payload);
      } else {
        await api.createPaymentType(payload);
      }

      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'keuangan' } }));
      setIsSuccess(true);
      setTimeout(async () => {
        setIsSuccess(false);
        await onSaved();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tipe pembayaran gagal disimpan');
      setSaving(false);
    }
  };

  const monthNames = [
    { num: 7, name: 'Juli', sem: 'Ganjil' },
    { num: 8, name: 'Agustus', sem: 'Ganjil' },
    { num: 9, name: 'September', sem: 'Ganjil' },
    { num: 10, name: 'Oktober', sem: 'Ganjil' },
    { num: 11, name: 'November', sem: 'Ganjil' },
    { num: 12, name: 'Desember', sem: 'Ganjil' },
    { num: 1, name: 'Januari', sem: 'Genap' },
    { num: 2, name: 'Februari', sem: 'Genap' },
    { num: 3, name: 'Maret', sem: 'Genap' },
    { num: 4, name: 'April', sem: 'Genap' },
    { num: 5, name: 'Mei', sem: 'Genap' },
    { num: 6, name: 'Juni', sem: 'Genap' },
  ];


  return (
    <div className="w-full flex-1 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {isSuccess && (
        <div className="fixed top-5 right-5 z-[99999] flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-2xl border border-emerald-200 shadow-emerald-900/15 transition-all animate-in fade-in slide-in-from-top-4 duration-300 max-w-sm">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
            <CheckCircle2 size={24} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-800">Berhasil Disimpan!</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Pos tagihan {name} berhasil disinkronkan ke sistem penagihan santri.
            </p>
          </div>
        </div>
      )}

      <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#138F81] text-white shadow-md shadow-[#138F81]/20">
              <Wallet size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#2D3436]">
                {row?.id ? 'Edit Pos Tarif Tagihan Santri' : 'Tambah Pos Tarif Tagihan Baru'}
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-[#636E72]">
                Pengaturan nominal tagihan SPP, makan, kitab, dan biaya santri Pondok Pesantren Qomaruddin.
              </p>
            </div>
          </div>

          <button
            className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
            onClick={onClose}
            type="button"
            title="Tutup form"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs sm:text-sm font-bold text-rose-700">
              ⚠️ {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              {/* Step 1: Identitas & Nominal */}
              <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-3">
                  <Banknote size={18} className="text-[#138F81]" />
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    I. Identitas Pos Tagihan & Nominal
                  </h3>
                </div>

                {row && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 space-y-1.5">
                    <label className="block text-xs font-black text-amber-900 uppercase">
                      Target Semester Khusus (Opsional)
                    </label>
                    <select
                      className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-slate-800"
                      value={targetSemesterId}
                      onChange={(e) => setTargetSemesterId(Number(e.target.value))}
                    >
                      <option value="0">Berlaku Global (Semua Semester)</option>
                      {semesters.map((s) => (
                        <option key={num(s.id)} value={num(s.id)}>
                          {str(s.name ?? s.semester)}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] font-semibold text-amber-700">
                      Pilih semester spesifik jika nominal ini hanya berlaku pada semester tersebut.
                    </p>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Nama Pos Tagihan / Pembayaran <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Syahriyah / SPP Pondok, Biaya Kitab, Uang Gedung..."
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Nominal Standar (Rp) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-lg font-black text-slate-800 placeholder:text-slate-300 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                      type="text"
                      inputMode="numeric"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                      placeholder="Contoh: 150000"
                      required
                    />
                    <p className="mt-1 text-[11px] font-bold text-[#138F81]">
                      {num(amount) > 0 ? formatRupiah(num(amount)) : 'Rp 0'}
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Periode Siklus Pembayaran <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#138F81] focus:outline-hidden cursor-pointer"
                      value={periodId}
                      onChange={(e) => setPeriodId(Number(e.target.value))}
                    >
                      {paymentPeriods.map((p) => (
                        <option key={num(p.id)} value={num(p.id)}>
                          {str(p.name)} ({str(p.code)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isBilledToAll}
                    onChange={(e) => setIsBilledToAll(e.target.checked)}
                    className="h-4 w-4 rounded-md border-slate-300 text-[#138F81] focus:ring-[#138F81]"
                  />
                  <div>
                    <p className="text-xs font-black text-slate-800">Tagihkan Otomatis ke Seluruh Santri Aktif</p>
                    <p className="text-[11px] font-semibold text-slate-400">Tagihan akan otomatis digenerate untuk setiap santri aktif sesuai sasaran jenis kelamin.</p>
                  </div>
                </label>

                {/* Sasaran Jenis Kelamin Santri (Pembeda Putra & Putri) */}
                <div className="space-y-2 pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                      🎯 Sasaran Santri (Pembeda Putra & Putri) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] font-bold text-slate-500">
                      {targetGender === 'ALL' ? '👥 Semua Santri' : targetGender === 'L' ? '👦 Khusus Putra' : '👧 Khusus Putri'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Option 1: Semua */}
                    <button
                      type="button"
                      onClick={() => setTargetGender('ALL')}
                      className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all ${
                        targetGender === 'ALL'
                          ? 'border-[#138F81] bg-teal-50/90 ring-2 ring-[#138F81]/25 text-[#138F81]'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-black text-xs">
                        <span className="text-base">👥</span>
                        <span>Semua Santri</span>
                      </div>
                      <p className="text-[10px] font-semibold text-slate-500 mt-1 leading-tight">
                        Putra & Putri (SPP, Gedung, Kitab, dll)
                      </p>
                    </button>

                    {/* Option 2: Putra */}
                    <button
                      type="button"
                      onClick={() => setTargetGender('L')}
                      className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all ${
                        targetGender === 'L'
                          ? 'border-sky-500 bg-sky-50/90 ring-2 ring-sky-500/25 text-sky-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-black text-xs">
                        <span className="text-base">👦</span>
                        <span>Khusus Putra</span>
                      </div>
                      <p className="text-[10px] font-semibold text-slate-500 mt-1 leading-tight">
                        Hanya Laki-laki (Peci, Sarung, dll)
                      </p>
                    </button>

                    {/* Option 3: Putri */}
                    <button
                      type="button"
                      onClick={() => setTargetGender('P')}
                      className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all ${
                        targetGender === 'P'
                          ? 'border-rose-500 bg-rose-50/90 ring-2 ring-rose-500/25 text-rose-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-black text-xs">
                        <span className="text-base">👧</span>
                        <span>Khusus Putri</span>
                      </div>
                      <p className="text-[10px] font-semibold text-slate-500 mt-1 leading-tight">
                        Hanya Perempuan (Kerudung, Mukena, dll)
                      </p>
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2: Bulan Ditagihkan (Jika Bulanan) */}
              {isBulanan && (
                <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                    <div className="flex items-center gap-2">
                      <Calendar size={18} className="text-[#138F81]" />
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        II. Bulan yang Ditagihkan ({billedMonths.size} Bulan Terpilih)
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBilledMonths(new Set(monthNames.map((m) => m.num)))}
                        className="text-xs font-black text-[#138F81] hover:underline"
                      >
                        Pilih Semua 12 Bulan
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {monthNames.map((m) => {
                      const isChecked = billedMonths.has(m.num);
                      return (
                        <button
                          key={m.num}
                          type="button"
                          onClick={() => {
                            const next = new Set(billedMonths);
                            if (next.has(m.num)) next.delete(m.num);
                            else next.add(m.num);
                            setBilledMonths(next);
                          }}
                          className={`p-3 rounded-2xl border text-center transition-all ${
                            isChecked
                              ? 'border-[#138F81] bg-teal-50/90 ring-2 ring-[#138F81]/20 font-black text-[#138F81]'
                              : 'border-slate-200 bg-white text-slate-500 font-bold hover:border-slate-300'
                          }`}
                        >
                          <span className="text-xs">{m.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* CUSTOM NOMINAL PER BULAN */}
                  <div className="pt-4 border-t border-slate-200">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <span>⚙️ Atur Nominal Berbeda Per Bulan (Opsional)</span>
                        </p>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Kosongkan jika bulan tersebut memakai Nominal Standar ({num(amount) > 0 ? formatRupiah(num(amount)) : 'Rp 0'}).
                        </p>
                      </div>
                      {(Object.keys(monthAmounts).length > 0 || Object.keys(monthNotes).length > 0) && (
                        <button
                          type="button"
                          onClick={() => {
                            setMonthAmounts({});
                            setMonthNotes({});
                          }}
                          className="rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700 hover:bg-amber-100 transition-colors border border-amber-200/70"
                        >
                          Reset ke Standar
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1">
                      {monthNames.map((m) => {
                        const isBilled = billedMonths.has(m.num);
                        const currentVal = monthAmounts[m.num] ?? '';
                        const currentNote = monthNotes[m.num] ?? '';
                        const hasCustom = (currentVal !== '' && Number(currentVal) !== num(amount)) || currentNote !== '';

                        return (
                          <div
                            key={m.num}
                            className={`rounded-2xl border p-3 transition-all ${
                              !isBilled
                                ? 'border-slate-100 bg-slate-50/60 opacity-50'
                                : hasCustom
                                ? 'border-amber-400 bg-amber-50/60 ring-2 ring-amber-400/20 shadow-xs'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                                <span>{m.name}</span>
                                <span className="text-[10px] font-semibold text-slate-400">({m.sem})</span>
                              </span>
                              {!isBilled ? (
                                <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">Libur</span>
                              ) : hasCustom ? (
                                <span className="rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white shadow-xs">Khusus</span>
                              ) : (
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">Standar</span>
                              )}
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                disabled={!isBilled}
                                placeholder={num(amount) > 0 ? formatRupiah(num(amount)) : 'Rp 0'}
                                value={currentVal ? formatRupiah(Number(currentVal)).replace('Rp ', '') : ''}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\D/g, '');
                                  setMonthAmounts((prev) => {
                                    const next = { ...prev };
                                    if (!raw) delete next[m.num];
                                    else next[m.num] = raw;
                                    return next;
                                  });
                                }}
                                className={`w-full rounded-xl border px-3 py-2 text-xs font-bold transition-all disabled:bg-slate-100 disabled:cursor-not-allowed ${
                                  hasCustom
                                    ? 'border-amber-400 bg-white text-amber-950 font-black focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20'
                                    : 'border-slate-200 text-slate-800 bg-white focus:border-[#138F81] focus:ring-2 focus:ring-[#138F81]/10'
                                }`}
                              />
                            </div>
                            {/* Catatan / Keterangan Opsional Per Bulan */}
                            <div className="mt-1.5">
                              <input
                                type="text"
                                disabled={!isBilled}
                                placeholder="Catatan bulan (opsional, misal: Termasuk Seragam)..."
                                value={currentNote}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMonthNotes((prev) => {
                                    const next = { ...prev };
                                    if (!val.trim()) delete next[m.num];
                                    else next[m.num] = val;
                                    return next;
                                  });
                                }}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-2 focus:ring-[#138F81]/15 disabled:bg-slate-100 disabled:cursor-not-allowed"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}


              {/* Step 3: Metode Bayar & Status */}
              <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-3">
                  <CreditCard size={18} className="text-[#138F81]" />
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    III. Metode Pembayaran yang Diterima
                  </h3>
                </div>

                <div className="flex flex-wrap gap-2">
                  {paymentMethods.map((m) => {
                    const mName = str(m.name);
                    const isSelected = methods.has(mName);
                    return (
                      <button
                        key={mName}
                        type="button"
                        onClick={() => {
                          const next = new Set(methods);
                          if (next.has(mName)) next.delete(mName);
                          else next.add(mName);
                          setMethods(next);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black border transition-all ${
                          isSelected
                            ? 'bg-[#138F81] text-white border-[#138F81] shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {isSelected && <Check size={14} />}
                        <span>{mName}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-white p-4 border border-slate-200 pt-3">
                  <div>
                    <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Status Pos Tagihan</p>
                    <p className="text-[11px] font-semibold text-slate-400">Tagihan aktif dapat ditagihkan dan dibayar melalui loket pembayaran santri.</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={status === 'Aktif'}
                      onChange={(e) => setStatus(e.target.checked ? 'Aktif' : 'Nonaktif')}
                    />
                    <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:top-[2px] after:start-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-[#138F81] peer-checked:after:translate-x-full peer-focus:outline-hidden"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Kolom Kanan: Live Preview Struk Tagihan */}
            <div className="space-y-4">
              <div className="rounded-3xl border border-teal-100 bg-linear-to-b from-teal-50/60 to-white p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-teal-100/80 pb-3">
                  <Sparkles size={18} className="text-[#138F81]" />
                  <h3 className="text-xs font-black text-[#138F81] uppercase tracking-wider">
                    Pratinjau Kartu Tagihan
                  </h3>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-teal-100 text-[#138F81] font-black text-[10px] px-2 py-0.5 uppercase">
                      {selectedPeriod ? str(selectedPeriod.name) : 'Umum'}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {status === 'Aktif' ? '🟢 Aktif' : '⚪ Nonaktif'}
                    </span>
                  </div>

                  <p className="text-base font-black text-slate-900">{name || 'Nama Pos Tagihan'}</p>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[11px] font-bold text-slate-400">Tarif Tagihan:</p>
                    <p className="text-2xl font-black text-[#138F81] mt-0.5">
                      {num(amount) > 0 ? formatRupiah(num(amount)) : 'Rp 0'}
                    </p>
                  </div>

                  <div className="text-[11px] font-semibold text-slate-500 space-y-1">
                    <p>• Diterima via: {Array.from(methods).join(', ') || 'Semua metode'}</p>
                    <p>• Penagihan: {isBilledToAll ? 'Seluruh santri otomatis' : 'Manual santri tertentu'}</p>
                    {isBulanan && Object.keys(monthAmounts).length > 0 && (
                      <p className="text-amber-700 font-bold">• {Object.keys(monthAmounts).length} bulan diatur dengan nominal khusus</p>
                    )}
                  </div>

                </div>

                <div className="rounded-2xl bg-teal-50/80 p-3.5 border border-teal-100 text-xs font-semibold text-teal-900 leading-relaxed">
                  🧾 <b>Portal Wali Santri:</b> Tagihan yang dibuat otomatis muncul di riwayat pembayaran portal wali santri secara real-time.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#138F81] px-6 py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-[#138F81]/25 hover:bg-[#0f766a] transition-all disabled:opacity-50"
          >
            <Save size={16} />
            <span>{saving ? 'Menyimpan...' : 'Simpan Pos Tagihan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   2. COMPLEX PAYMENT METHOD IN-PAGE FORM
   ========================================================================= */
export function ComplexPaymentMethodForm({
  row,
  onClose,
  onSaved,
}: {
  row: ApiRecord | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(str(row?.name, ''));
  const [code, setCode] = useState(str(row?.code, ''));
  const [sort, setSort] = useState(String(row?.sort_order ?? 100));
  const [active, setActive] = useState(row?.is_active !== false);
  const [saving, setSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (saving) return;

    if (!name.trim()) {
      setError('Nama metode pembayaran wajib diisi.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toLowerCase().replace(/\s+/g, '_'),
        sort_order: num(sort),
        is_active: active,
      };

      if (row?.id) {
        await api.updatePaymentMethod(num(row.id), payload);
      } else {
        await api.createPaymentMethod(payload);
      }

      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'keuangan' } }));
      setIsSuccess(true);
      setTimeout(async () => {
        setIsSuccess(false);
        await onSaved();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Metode pembayaran gagal disimpan');
      setSaving(false);
    }
  };

  return (
    <div className="w-full flex-1 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {isSuccess && (
        <div className="fixed top-5 right-5 z-[99999] flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-2xl border border-emerald-200 shadow-emerald-900/15 transition-all animate-in fade-in slide-in-from-top-4 duration-300 max-w-sm">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
            <CheckCircle2 size={24} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-800">Berhasil Disimpan!</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Metode pembayaran {name} berhasil disimpan.
            </p>
          </div>
        </div>
      )}

      <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#138F81] text-white shadow-md shadow-[#138F81]/20">
              <CreditCard size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#2D3436]">
                {row?.id ? 'Edit Metode Pembayaran' : 'Tambah Metode Pembayaran Baru'}
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-[#636E72]">
                Pengaturan metode pembayaran pondok: Tunai, Transfer Bank Mandiri, BSI, QRIS, dll.
              </p>
            </div>
          </div>

          <button
            className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
            onClick={onClose}
            type="button"
            title="Tutup form"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-2xl">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs sm:text-sm font-bold text-rose-700">
              ⚠️ {error}
            </div>
          )}

          <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 sm:p-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                Nama Metode Pembayaran <span className="text-rose-500">*</span>
              </label>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden focus:ring-4 focus:ring-[#138F81]/10 transition-all"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Tunai / Cash, Transfer BSI, QRIS..."
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                Kode Singkat Unik
              </label>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-mono font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Contoh: cash, bsi, qris"
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-white p-4 border border-slate-200">

              <div>
                <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Status Aktif</p>
                <p className="text-[11px] font-semibold text-slate-400">Metode aktif dapat dipilih saat input pembayaran santri.</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:top-[2px] after:start-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-[#138F81] peer-checked:after:translate-x-full peer-focus:outline-hidden"></div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#138F81] px-6 py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-[#138F81]/25 hover:bg-[#0f766a] transition-all disabled:opacity-50"
          >
            <Save size={16} />
            <span>{saving ? 'Menyimpan...' : 'Simpan Metode'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   3. COMPLEX PAYMENT PERIOD IN-PAGE FORM
   ========================================================================= */
export function ComplexPaymentPeriodForm({
  row,
  onClose,
  onSaved,
}: {
  row: ApiRecord | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(str(row?.name, ''));
  const [code, setCode] = useState(str(row?.code, ''));
  const [usesMonth, setUsesMonth] = useState(row?.uses_month === true);
  const [usesSemester, setUsesSemester] = useState(row?.uses_semester !== false);
  const [monthMode, setMonthMode] = useState(str(row?.month_mode, 'semester'));
  const [dueDay, setDueDay] = useState(String(row?.due_day ?? 10));
  const [active, setActive] = useState(row?.is_active !== false);
  const [saving, setSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (saving) return;

    if (!name.trim()) {
      setError('Nama periode pembayaran wajib diisi.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toLowerCase().replace(/\s+/g, '_'),
        uses_month: usesMonth,
        uses_semester: usesSemester,
        month_mode: monthMode,
        due_day: num(dueDay),
        is_active: active,
      };

      if (row?.id) {
        await api.updatePaymentPeriodType(num(row.id), payload);
      } else {
        await api.createPaymentPeriodType(payload);
      }

      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'keuangan' } }));
      setIsSuccess(true);
      setTimeout(async () => {
        setIsSuccess(false);
        await onSaved();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Periode pembayaran gagal disimpan');
      setSaving(false);
    }
  };

  return (
    <div className="w-full flex-1 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {isSuccess && (
        <div className="fixed top-5 right-5 z-[99999] flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-2xl border border-emerald-200 shadow-emerald-900/15 transition-all animate-in fade-in slide-in-from-top-4 duration-300 max-w-sm">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
            <CheckCircle2 size={24} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-800">Berhasil Disimpan!</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Periode pembayaran {name} berhasil disimpan.
            </p>
          </div>
        </div>
      )}

      <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#138F81] text-white shadow-md shadow-[#138F81]/20">
              <Clock size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#2D3436]">
                {row?.id ? 'Edit Periode Pembayaran' : 'Tambah Periode Pembayaran Baru'}
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-[#636E72]">
                Pengaturan siklus penagihan: Bulanan, Semesteran, Tahunan, atau Sekali Bayar.
              </p>
            </div>
          </div>

          <button
            className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
            onClick={onClose}
            type="button"
            title="Tutup form"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-2xl">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs sm:text-sm font-bold text-rose-700">
              ⚠️ {error}
            </div>
          )}

          <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 sm:p-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                Nama Periode <span className="text-rose-500">*</span>
              </label>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-[#138F81] focus:outline-hidden"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Bulanan, Semester, Tahunan"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                Kode Periode
              </label>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-mono font-bold text-slate-800 focus:border-[#138F81] focus:outline-hidden"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Contoh: bulanan, semester, tahunan"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usesMonth}
                  onChange={(e) => setUsesMonth(e.target.checked)}
                  className="h-4 w-4 rounded-md border-slate-300 text-[#138F81] focus:ring-[#138F81]"
                />
                <span className="text-xs font-bold text-slate-700">Memakai Siklus Bulan</span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usesSemester}
                  onChange={(e) => setUsesSemester(e.target.checked)}
                  className="h-4 w-4 rounded-md border-slate-300 text-[#138F81] focus:ring-[#138F81]"
                />
                <span className="text-xs font-bold text-slate-700">Mengikuti Semester</span>
              </label>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-black text-slate-700 uppercase tracking-wider">
                Tanggal Jatuh Tempo Penagihan (Tiap Bulan)
              </label>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#138F81] focus:outline-hidden"
                type="number"
                min="1"
                max="31"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value.replace(/\D/g, ''))}
                placeholder="Contoh: 10"
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-white p-4 border border-slate-200">
              <div>
                <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Status Aktif</p>
                <p className="text-[11px] font-semibold text-slate-400">Periode aktif dapat dipilih saat membuat pos tagihan baru.</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:top-[2px] after:start-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-[#138F81] peer-checked:after:translate-x-full peer-focus:outline-hidden"></div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#138F81] px-6 py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-[#138F81]/25 hover:bg-[#0f766a] transition-all disabled:opacity-50"
          >
            <Save size={16} />
            <span>{saving ? 'Menyimpan...' : 'Simpan Periode'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
