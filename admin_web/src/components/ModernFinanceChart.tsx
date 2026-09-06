import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Calendar,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { formatMoney } from './MoneyText';
import type { ApiRecord } from '../services/api';

export interface ModernFinanceChartItem {
  name?: string;
  Pemasukan?: number;
  Pengeluaran?: number;
  Santri?: number;
  KasLain?: number;
  Netto?: number;
  [key: string]: unknown;
}

interface ModernFinanceChartProps {
  data: (ApiRecord | ModernFinanceChartItem)[];
  title?: string;
  subtitle?: string;
  year?: number;
  collapsible?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    payload: Record<string, unknown>;
  }>;
  label?: string;
  year: number;
}

function CustomTooltip({ active, payload, label, year }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0]?.payload;
  const pemasukan = Number(item?.Pemasukan ?? 0);
  const pengeluaran = Number(item?.Pengeluaran ?? 0);
  const santri = Number(item?.Santri ?? 0);
  const kasLain = Number(item?.KasLain ?? 0);
  const netto = pemasukan - pengeluaran;
  const isSurplus = netto >= 0;

  return (
    <div className="min-w-[240px] rounded-2xl border border-slate-700/60 bg-slate-900/95 p-3.5 text-white shadow-2xl backdrop-blur-md transition-all">
      {/* Month Header */}
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-2 mb-2.5">
        <div className="flex items-center gap-1.5 text-xs font-black text-slate-200">
          <Calendar size={13} className="text-[#138F81]" />
          <span>Bulan {label} {year}</span>
        </div>
        <span
          className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
            isSurplus
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
          }`}
        >
          {isSurplus ? 'Surplus' : 'Defisit'}
        </span>
      </div>

      {/* Pemasukan */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <ArrowUpRight size={13} />
            <span>Pemasukan:</span>
          </div>
          <span className="font-extrabold text-emerald-300 font-mono">
            {formatMoney(pemasukan)}
          </span>
        </div>

        {/* Sub-breakdown if available */}
        {(santri > 0 || kasLain > 0) && (
          <div className="flex items-center gap-2 pl-4 text-[10px] text-slate-400 font-medium">
            <span>Santri: {formatMoney(santri)}</span>
            {kasLain > 0 && <span>• Kas Lain: {formatMoney(kasLain)}</span>}
          </div>
        )}

        {/* Pengeluaran */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-rose-400 font-bold">
            <ArrowDownRight size={13} />
            <span>Pengeluaran:</span>
          </div>
          <span className="font-extrabold text-rose-300 font-mono">
            {formatMoney(pengeluaran)}
          </span>
        </div>

        {/* Netto */}
        <div className="border-t border-slate-700/60 pt-2 mt-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-300 font-bold">
            <Wallet size={13} className="text-amber-400" />
            <span>Saldo Netto:</span>
          </div>
          <span
            className={`font-black font-mono ${
              isSurplus ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isSurplus ? '+' : ''}{formatMoney(netto)}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatYAxisNumber(val: number): string {
  if (val === 0) return 'Rp 0';
  if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)}M`;
  if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(val % 1_000_000 === 0 ? 0 : 1)}Jt`;
  if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}Rb`;
  return `Rp ${val}`;
}

export function ModernFinanceChart({
  data,
  title = 'Tren Arus Kas Pesantren',
  subtitle = 'Grafik Komparasi Pemasukan vs Pengeluaran Bulanan',
  year = new Date().getFullYear(),
  collapsible = true,
}: ModernFinanceChartProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Total summary calculations
  const totals = useMemo(() => {
    let totalPemasukan = 0;
    let totalPengeluaran = 0;

    data.forEach((item) => {
      totalPemasukan += Number(item.Pemasukan ?? 0);
      totalPengeluaran += Number(item.Pengeluaran ?? 0);
    });

    const saldoNetto = totalPemasukan - totalPengeluaran;
    return {
      totalPemasukan,
      totalPengeluaran,
      saldoNetto,
      isSurplus: saldoNetto >= 0,
    };
  }, [data]);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-b from-white via-white to-slate-50/40 p-5 sm:p-6 shadow-sm transition-all hover:shadow-md">
      {/* Decorative accent glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-teal-200/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-rose-200/15 blur-3xl" />

      {/* Header Bar */}
      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#138F81] to-teal-400 text-white shadow-md shadow-teal-700/20">
            <TrendingUp size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-800">
                {title} Tahun {year}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 text-[10px] font-black text-[#138F81]">
                <Sparkles size={11} /> Realtime
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Quick Summary Chips & Collapse Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Pemasukan Chip */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-emerald-200/90 bg-emerald-50/70 px-3 py-1.5 text-xs font-bold text-emerald-900 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] text-emerald-700 font-extrabold">Masuk:</span>
            <span className="font-mono font-black text-emerald-800">
              {formatMoney(totals.totalPemasukan)}
            </span>
          </div>

          {/* Pengeluaran Chip */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-rose-200/90 bg-rose-50/70 px-3 py-1.5 text-xs font-bold text-rose-900 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span className="text-[11px] text-rose-700 font-extrabold">Keluar:</span>
            <span className="font-mono font-black text-rose-800">
              {formatMoney(totals.totalPengeluaran)}
            </span>
          </div>

          {/* Netto Chip */}
          <div
            className={`flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-bold shadow-2xs ${
              totals.isSurplus
                ? 'border-teal-200 bg-teal-50/80 text-[#138F81]'
                : 'border-amber-200 bg-amber-50/80 text-amber-800'
            }`}
          >
            <span className="text-[11px] font-extrabold">
              {totals.isSurplus ? 'Surplus:' : 'Defisit:'}
            </span>
            <span className="font-mono font-black">
              {totals.isSurplus ? '+' : ''}{formatMoney(totals.saldoNetto)}
            </span>
          </div>

          {collapsible && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="flex h-9 items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer shadow-2xs"
              title={isExpanded ? 'Sembunyikan grafik tren' : 'Tampilkan grafik tren'}
            >
              {isExpanded ? <EyeOff size={14} /> : <Eye size={14} />}
              <span className="hidden sm:inline">{isExpanded ? 'Tutup' : 'Buka Grafik'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Chart Body */}
      {isExpanded && (
        <div className="pt-4 transition-all duration-300">
          <div className="h-[280px] sm:h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 15, right: 12, left: -5, bottom: 0 }}
              >
                <defs>
                  {/* Pemasukan Gradient */}
                  <linearGradient id="modernColorPemasukan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="60%" stopColor="#138F81" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#138F81" stopOpacity={0.0} />
                  </linearGradient>

                  {/* Pengeluaran Gradient */}
                  <linearGradient id="modernColorPengeluaran" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.35} />
                    <stop offset="60%" stopColor="#FF7675" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="#FF7675" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="4 4"
                  vertical={false}
                  stroke="#E2E8F0"
                />

                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fontWeight: 700, fill: '#64748B' }}
                  dy={6}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fontWeight: 600, fill: '#94A3B8' }}
                  tickFormatter={formatYAxisNumber}
                  width={68}
                />

                <RechartsTooltip
                  cursor={{
                    stroke: '#CBD5E1',
                    strokeWidth: 1.5,
                    strokeDasharray: '3 3',
                  }}
                  content={<CustomTooltip year={year} />}
                />

                {/* Pemasukan Area */}
                <Area
                  type="monotone"
                  dataKey="Pemasukan"
                  name="Pemasukan"
                  stroke="#10B981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#modernColorPemasukan)"
                  activeDot={{
                    r: 6,
                    stroke: '#FFFFFF',
                    strokeWidth: 2.5,
                    fill: '#10B981',
                  }}
                />

                {/* Pengeluaran Area */}
                <Area
                  type="monotone"
                  dataKey="Pengeluaran"
                  name="Pengeluaran"
                  stroke="#F43F5E"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#modernColorPengeluaran)"
                  activeDot={{
                    r: 6,
                    stroke: '#FFFFFF',
                    strokeWidth: 2.5,
                    fill: '#F43F5E',
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Footer Interactive Legend */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-xs" />
                <span>Pemasukan (Santri & Kas Masuk)</span>
              </div>
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <span className="h-3 w-3 rounded-full bg-rose-500 shadow-xs" />
                <span>Pengeluaran Kas</span>
              </div>
            </div>

            <span className="text-[11px] font-semibold text-slate-400 italic">
              💡 Sentuh atau arahkan kursor pada kurva grafik untuk melihat rincian per bulan
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
