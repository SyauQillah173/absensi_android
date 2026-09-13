import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Coins,
  CreditCard,
  Layers,
  Save,
  Wallet,
  X
} from 'lucide-react';
import React, { FormEvent, useEffect, useState } from 'react';
import { api, type ApiRecord } from '../services/api';

interface ComplexPaymentTypeFormProps {
  initialData: ApiRecord | null;
  semesters: ApiRecord[];
  paymentMethods: ApiRecord[];
  paymentPeriods: ApiRecord[];
  onClose: () => void;
  onSave: () => void;
}

function str(value: unknown, fallback = ''): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ComplexPaymentTypeForm({
  initialData,
  semesters,
  paymentMethods,
  paymentPeriods,
  onClose,
  onSave,
}: ComplexPaymentTypeFormProps) {
  const isEditing = Boolean(initialData && initialData.id);

  const [targetSemesterId, setTargetSemesterId] = useState(0);
  const [name, setName] = useState(str(initialData?.nama, ''));
  const [amount, setAmount] = useState(String(initialData?.nominal_default ?? ''));
  const [periodId, setPeriodId] = useState(num(initialData?.payment_period_type_id ?? paymentPeriods[0]?.id));
  const [status, setStatus] = useState(str(initialData?.status, 'Aktif'));
  const [methods, setMethods] = useState<Set<string>>(() => {
    return new Set(
      (Array.isArray(initialData?.metode_pembayaran)
        ? initialData?.metode_pembayaran
        : paymentMethods.map((item) => item.name)
      ).map(String)
    );
  });
  const [isBilledToAll, setIsBilledToAll] = useState(initialData?.is_billed_to_all !== false);

  const allMonths = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
  const [billedMonths, setBilledMonths] = useState<Set<number>>(() => {
    if (Array.isArray(initialData?.billed_months) && initialData.billed_months.length > 0) {
      return new Set(initialData.billed_months.map(Number));
    }
    const rulesArray = Array.isArray(initialData?.bill_rules)
      ? initialData?.bill_rules
      : Array.isArray(initialData?.billRules)
      ? initialData?.billRules
      : [];
    const rule = rulesArray[0];
    if (rule && Array.isArray(rule.billed_months) && rule.billed_months.length > 0) {
      return new Set(rule.billed_months.map(Number));
    }
    return new Set(allMonths);
  });

  const [monthAmounts, setMonthAmounts] = useState<Record<number, string>>(() => {
    const raw = (initialData?.month_amounts ||
      (initialData?.billRules && (initialData.billRules as any)[0]?.month_amounts) ||
      {}) as Record<string, number>;
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
    if (!initialData) return;
    if (targetSemesterId === 0) {
      setAmount(String(initialData.nominal_default ?? ''));
      setBilledMonths(
        new Set(
          Array.isArray(initialData.billed_months) && initialData.billed_months.length > 0
            ? initialData.billed_months.map(Number)
            : allMonths
        )
      );
      const sourceAmounts = (initialData.month_amounts || {}) as Record<string, number>;
      const loaded: Record<number, string> = {};
      if (sourceAmounts && typeof sourceAmounts === 'object') {
        Object.entries(sourceAmounts).forEach(([k, v]) => {
          if (v) loaded[Number(k)] = String(v);
        });
      }
      setMonthAmounts(loaded);
      return;
    }
    const rulesArray = Array.isArray(initialData.bill_rules)
      ? initialData.bill_rules
      : Array.isArray(initialData.billRules)
      ? initialData.billRules
      : [];
    const rule = rulesArray.find((r: any) => num(r.semester_id) === targetSemesterId);
    if (rule) {
      setAmount(String(rule.nominal ?? initialData.nominal_default ?? ''));
      setBilledMonths(
        new Set(
          Array.isArray(rule.billed_months) && rule.billed_months.length > 0
            ? rule.billed_months.map(Number)
            : Array.isArray(initialData.billed_months) && initialData.billed_months.length > 0
            ? initialData.billed_months.map(Number)
            : allMonths
        )
      );
      const sourceAmounts = (rule.month_amounts || initialData.month_amounts || {}) as Record<string, number>;
      const loaded: Record<number, string> = {};
      if (sourceAmounts && typeof sourceAmounts === 'object') {
        Object.entries(sourceAmounts).forEach(([k, v]) => {
          if (v) loaded[Number(k)] = String(v);
        });
      }
      setMonthAmounts(loaded);
    } else {
      setAmount(String(initialData.nominal_default ?? ''));
      setBilledMonths(
        new Set(
          Array.isArray(initialData.billed_months) && initialData.billed_months.length > 0
            ? initialData.billed_months.map(Number)
            : allMonths
        )
      );
      setMonthAmounts({});
    }
  }, [targetSemesterId, initialData]);

  async function submit(event?: FormEvent) {
    if (event) event.preventDefault();
    if (saving) return;

    if (!name.trim()) {
      setError('Nama tipe pembayaran wajib diisi.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const period = paymentPeriods.find((item) => num(item.id) === periodId);
      const customAmountsPayload: Record<number, number> = {};
      Object.entries(monthAmounts).forEach(([k, v]) => {
        const parsed = Number(String(v).replace(/\D/g, ''));
        if (parsed > 0 && parsed !== num(amount)) {
          customAmountsPayload[Number(k)] = parsed;
        }
      });

      const payload = {
        nama: name.trim(),
        nominal_default: num(amount),
        periode: str(period?.code ?? period?.name, 'umum'),
        payment_period_type_id: periodId,
        metode_pembayaran: Array.from(methods),
        status,
        is_billed_to_all: isBilledToAll,
        billed_months: Array.from(billedMonths),
        month_amounts: Object.keys(customAmountsPayload).length > 0 ? customAmountsPayload : null,
        target_semester_id: targetSemesterId > 0 ? targetSemesterId : null,
      };

      if (initialData?.id) await api.updatePaymentType(num(initialData.id), payload);
      else await api.createPaymentType(payload);

      window.dispatchEvent(new CustomEvent('app:data-updated', { detail: { type: 'finance' } }));
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSave();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tipe pembayaran gagal disimpan');
      setSaving(false);
    }
  }

  const selectedPeriod = paymentPeriods.find((item) => num(item.id) === periodId);
  const isBulanan = selectedPeriod?.code === 'bulanan';

  return (
    <div className="w-full flex-1 animate-in fade-in duration-200">
      {/* Toast Notifikasi Berhasil */}
      {isSuccess && (
        <div className="fixed top-5 right-5 z-[99999] flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-2xl border border-emerald-200 shadow-emerald-900/15 animate-in fade-in slide-in-from-top-4 duration-300 max-w-sm">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
            <CheckCircle2 size={24} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-800">Pos Tagihan Disimpan!</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Tipe pembayaran "{name}" telah diperbarui dan aktif di sistem keuangan.
            </p>
          </div>
        </div>
      )}

      {/* Frame In-Page Form (Konsisten Master Data) */}
      <div className="flex min-h-[calc(100vh-10rem)] w-full flex-col overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-3xl">
        {/* Header Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer shrink-0"
                title="Kembali"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl bg-teal-50 border border-teal-200/60 text-[#138F81] shadow-sm shrink-0">
                <Coins size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#138F81] bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
                    Pos Tagihan Santri
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">•</span>
                  <span className="text-xs font-bold text-slate-500">Administrasi Keuangan</span>
                </div>
                <h1 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
                  {isEditing ? `✏️ Edit Tipe Tagihan: ${name}` : '➕ Tambah Tipe Pembayaran (Pos Tagihan)'}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button
              className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors shrink-0 cursor-pointer"
              onClick={onClose}
              type="button"
              disabled={saving}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body Form */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50/50 q-scrollbar">
          <form onSubmit={submit} className="max-w-4xl mx-auto space-y-6">
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 animate-in fade-in">
                <div className="flex items-center gap-2 font-black text-sm">
                  <AlertTriangle size={18} />
                  <span>Kesalahan Validasi</span>
                </div>
                <p className="text-xs font-semibold mt-1 text-rose-700">{error}</p>
              </div>
            )}

            {/* Target Semester (Jika Mode Edit) */}
            {initialData && (
              <div className="rounded-3xl border-2 border-amber-200 bg-amber-50/70 p-4 sm:p-5">
                <label className="block text-xs font-black uppercase tracking-wider text-amber-900 mb-1.5">
                  Target Semester Penyesuaian (Opsional)
                </label>
                <select
                  value={targetSemesterId}
                  onChange={(e) => setTargetSemesterId(Number(e.target.value))}
                  className="w-full rounded-2xl border border-amber-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-extrabold text-slate-800 outline-none focus:border-[#138F81]"
                >
                  <option value={0}>🌐 Berlaku Global (Seluruh Semester / Default)</option>
                  {semesters.map((s) => (
                    <option key={num(s.id)} value={num(s.id)}>
                      Semester: {str(s.name ?? s.semester)}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs font-medium text-amber-800 leading-relaxed">
                  💡 Pilih semester spesifik (Ganjil/Genap) jika Anda ingin nominal atau bulan penagihan <b>hanya berlaku untuk semester tersebut</b> tanpa merusak aturan global.
                </p>
              </div>
            )}

            {/* CARD 1: INFORMASI DASAR POS TAGIHAN */}
            <div className="rounded-3xl bg-white p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-[#138F81]">
                  <Wallet size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800">1. Data Pos Tagihan & Nominal</h3>
                  <p className="text-xs text-slate-400 font-medium">Atur nama tagihan, nominal standar, dan siklus periode pembayaran.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Nama Tipe Tagihan / Pos Biaya <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: SPP Bulanan Pondok atau Biaya Kitab Madin"
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-[#138F81] focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    {targetSemesterId > 0 ? 'Nominal Semester Ini (Rp)' : 'Nominal Default (Rp)'} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-xs text-slate-400">Rp</span>
                    <input
                      type="text"
                      value={amount ? Number(amount).toLocaleString('id-ID') : ''}
                      onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                      placeholder="0"
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-xs sm:text-sm font-black text-[#138F81] outline-none focus:border-[#138F81] focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Periode Pembayaran
                  </label>
                  <select
                    value={periodId}
                    onChange={(e) => setPeriodId(Number(e.target.value))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-[#138F81] shadow-xs cursor-pointer"
                  >
                    {paymentPeriods.map((p) => (
                      <option key={num(p.id)} value={num(p.id)}>
                        {str(p.name)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Status Tagihan
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Aktif', 'Nonaktif'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatus(st)}
                        className={`py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
                          status === st
                            ? st === 'Aktif'
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : 'bg-slate-700 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {st === 'Aktif' ? '✓ Aktif' : 'Nonaktif'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Checkbox Ditagihkan ke Seluruh Santri */}
              <div className="flex items-center gap-3 rounded-2xl bg-teal-50/60 border border-teal-200/80 p-4">
                <input
                  type="checkbox"
                  id="complex_is_billed_to_all"
                  checked={isBilledToAll}
                  onChange={(e) => setIsBilledToAll(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-[#138F81] focus:ring-[#138F81] cursor-pointer"
                />
                <label htmlFor="complex_is_billed_to_all" className="text-xs sm:text-sm font-bold text-slate-800 cursor-pointer">
                  Masukkan ke tagihan seluruh santri secara otomatis saat semester/bulan berjalan?
                </label>
              </div>
            </div>

            {/* CARD 2: BULAN DITAGIHKAN & CUSTOM NOMINAL PER BULAN (KHUSUS BULANAN) */}
            {isBulanan && (
              <div className="rounded-3xl bg-white p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-800">
                        2. Bulan Penagihan ({billedMonths.size} Bulan Terpilih)
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">Pilih bulan aktif penagihan SPP dalam tahun ajaran pesantren.</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBilledMonths(new Set([7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]))}
                      className="rounded-xl bg-teal-50 px-3 py-1.5 text-xs font-extrabold text-[#138F81] hover:bg-teal-100 transition cursor-pointer"
                    >
                      Pilih Semua (12 Bulan)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBilledMonths(new Set())}
                      className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                {/* Grid Pilihan Bulan */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {[
                    { v: 7, l: 'Jul' }, { v: 8, l: 'Agu' }, { v: 9, l: 'Sep' }, { v: 10, l: 'Okt' }, { v: 11, l: 'Nov' }, { v: 12, l: 'Des' },
                    { v: 1, l: 'Jan' }, { v: 2, l: 'Feb' }, { v: 3, l: 'Mar' }, { v: 4, l: 'Apr' }, { v: 5, l: 'Mei' }, { v: 6, l: 'Jun' }
                  ].map((m) => {
                    const selected = billedMonths.has(m.v);
                    return (
                      <button
                        key={m.v}
                        type="button"
                        onClick={() =>
                          setBilledMonths((current) => {
                            const next = new Set(current);
                            if (next.has(m.v)) next.delete(m.v);
                            else next.add(m.v);
                            return next;
                          })
                        }
                        className={`rounded-2xl py-2.5 text-xs font-black transition cursor-pointer ${
                          selected
                            ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/20'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {m.l} {selected ? '✓' : ''}
                      </button>
                    );
                  })}
                </div>

                {/* Kustomisasi Nominal Per Bulan */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs sm:text-sm font-black text-slate-800">
                        ⚙️ Atur Nominal Berbeda Per Bulan (Opsional)
                      </p>
                      <p className="text-xs text-slate-400 font-medium">
                        Biarkan kosong jika bulan tersebut memakai Nominal Standar ({formatMoney(num(amount) || 0)}).
                      </p>
                    </div>
                    {Object.keys(monthAmounts).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMonthAmounts({})}
                        className="rounded-xl bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-700 hover:bg-amber-100 transition cursor-pointer"
                      >
                        Reset ke Standar
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { v: 7, l: 'Juli', sem: 'Ganjil' },
                      { v: 8, l: 'Agustus', sem: 'Ganjil' },
                      { v: 9, l: 'September', sem: 'Ganjil' },
                      { v: 10, l: 'Oktober', sem: 'Ganjil' },
                      { v: 11, l: 'November', sem: 'Ganjil' },
                      { v: 12, l: 'Desember', sem: 'Ganjil' },
                      { v: 1, l: 'Januari', sem: 'Genap' },
                      { v: 2, l: 'Februari', sem: 'Genap' },
                      { v: 3, l: 'Maret', sem: 'Genap' },
                      { v: 4, l: 'April', sem: 'Genap' },
                      { v: 5, l: 'Mei', sem: 'Genap' },
                      { v: 6, l: 'Juni', sem: 'Genap' },
                    ].map((m) => {
                      const isBilled = billedMonths.has(m.v);
                      const currentVal = monthAmounts[m.v] ?? '';
                      const hasCustom = currentVal !== '' && Number(currentVal) !== num(amount);

                      return (
                        <div
                          key={m.v}
                          className={`rounded-2xl border p-3 transition ${
                            !isBilled
                              ? 'border-slate-200 bg-slate-100/70 opacity-60'
                              : hasCustom
                              ? 'border-amber-300 bg-amber-50/60 shadow-xs'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-black text-slate-800">
                              {m.l} <span className="text-[10px] font-normal text-slate-500">({m.sem})</span>
                            </span>
                            {!isBilled ? (
                              <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                                Libur
                              </span>
                            ) : hasCustom ? (
                              <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                                Khusus
                              </span>
                            ) : (
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                                Standar
                              </span>
                            )}
                          </div>

                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">Rp</span>
                            <input
                              type="text"
                              disabled={!isBilled}
                              placeholder={num(amount) > 0 ? formatMoney(num(amount)).replace('Rp ', '') : '0'}
                              value={currentVal ? Number(currentVal).toLocaleString('id-ID') : ''}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/\D/g, '');
                                setMonthAmounts((prev) => {
                                  const next = { ...prev };
                                  if (!raw) delete next[m.v];
                                  else next[m.v] = raw;
                                  return next;
                                });
                              }}
                              className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-2.5 py-1.5 text-xs font-black text-slate-900 outline-none focus:border-[#138F81] disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* CARD 3: METODE PEMBAYARAN DIDUKUNG */}
            <div className="rounded-3xl bg-white p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800">3. Kanal & Rekening Pembayaran</h3>
                  <p className="text-xs text-slate-400 font-medium">Tentukan kanal pembayaran yang diperbolehkan untuk pos tagihan ini.</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {paymentMethods.map((method) => {
                  const nameValue = str(method.name, '');
                  const selected = methods.has(nameValue);
                  return (
                    <button
                      key={num(method.id)}
                      type="button"
                      onClick={() =>
                        setMethods((current) => {
                          const next = new Set(current);
                          if (next.has(nameValue)) next.delete(nameValue);
                          else next.add(nameValue);
                          return next;
                        })
                      }
                      className={`inline-flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-black transition cursor-pointer ${
                        selected
                          ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/20'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>{nameValue}</span>
                      {selected && <CheckCircle2 size={14} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ACTION BAR STICKY */}
            <div className="sticky bottom-0 z-10 flex items-center justify-between gap-4 rounded-3xl bg-white/95 backdrop-blur-md p-4 sm:p-5 border border-slate-200/90 shadow-lg">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 hover:bg-slate-200 px-5 py-3 text-xs sm:text-sm font-extrabold text-slate-700 transition cursor-pointer"
              >
                <ChevronLeft size={16} /> Batal & Kembali
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#138F81] hover:bg-[#0D7A6F] px-7 py-3 text-xs sm:text-sm font-black text-white shadow-lg shadow-[#138F81]/25 transition cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Simpan Tipe Pembayaran</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
