import type { LucideIcon } from 'lucide-react';
import React from 'react';
import { CountUpNumber } from './CountUpNumber';

export interface StatBreakdownItem {
  label: string;
  value: number | string;
  tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'blue' | 'purple' | 'teal' | 'rose' | 'sky';
  tooltip?: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  valueTitle?: string;
  subtitle?: string;
  icon: LucideIcon;
  tone?: 'teal' | 'blue' | 'orange' | 'purple' | 'red';
  compactValue?: boolean;
  breakdown?: StatBreakdownItem[];
}

const toneMap: Record<string, string> = {
  teal: 'bg-[#E8F7F3] dark:bg-teal-950/60 text-[#138F81] dark:text-[#2DD4BF] border border-teal-100 dark:border-teal-800/40',
  blue: 'bg-[#EAF4FF] dark:bg-sky-950/60 text-[#2E86DE] dark:text-sky-400 border border-blue-100 dark:border-sky-800/40',
  orange: 'bg-[#FFF3E0] dark:bg-amber-950/60 text-[#E65100] dark:text-amber-400 border border-orange-100 dark:border-amber-800/40',
  purple: 'bg-[#F0EBFF] dark:bg-purple-950/60 text-[#6C5CE7] dark:text-purple-300 border border-purple-100 dark:border-purple-800/40',
  red: 'bg-[#FDECEC] dark:bg-rose-950/60 text-[#D63031] dark:text-rose-400 border border-rose-100 dark:border-rose-800/40'
};

const subtitleToneMap: Record<string, string> = {
  teal: 'text-[#138F81] dark:text-[#2DD4BF]',
  blue: 'text-[#2E86DE] dark:text-sky-400',
  orange: 'text-[#E65100] dark:text-amber-400',
  purple: 'text-[#6C5CE7] dark:text-purple-300',
  red: 'text-[#D63031] dark:text-rose-400'
};

const pillToneMap: Record<string, { bg: string; text: string; border: string }> = {
  success: { bg: 'bg-emerald-50/80 dark:bg-emerald-950/50', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200/80 dark:border-emerald-800/50' },
  warning: { bg: 'bg-amber-50/80 dark:bg-amber-950/50', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200/80 dark:border-amber-800/50' },
  danger: { bg: 'bg-rose-50/80 dark:bg-rose-950/50', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200/80 dark:border-rose-800/50' },
  neutral: { bg: 'bg-slate-50 dark:bg-slate-800/60', text: 'text-slate-600 dark:text-slate-300', border: 'border-slate-200/80 dark:border-slate-700/60' },
  blue: { bg: 'bg-sky-50/80 dark:bg-sky-950/50', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-200/80 dark:border-sky-800/50' },
  purple: { bg: 'bg-purple-50/80 dark:bg-purple-950/50', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200/80 dark:border-purple-800/50' },
  teal: { bg: 'bg-teal-50/80 dark:bg-teal-950/50', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-200/80 dark:border-teal-800/50' },
  rose: { bg: 'bg-rose-50/80 dark:bg-rose-950/50', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200/80 dark:border-rose-800/50' },
  sky: { bg: 'bg-sky-50/80 dark:bg-sky-950/50', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-200/80 dark:border-sky-800/50' },
};

export function StatCard({
  title,
  value,
  valueTitle,
  subtitle,
  icon: Icon,
  tone = 'teal',
  compactValue = false,
  breakdown
}: StatCardProps) {
  const isNumeric = typeof value === 'number' || (!isNaN(Number(value)) && typeof value === 'string' && value.trim() !== '' && !value.includes('Rp') && !value.includes(' '));
  const numericVal = isNumeric ? Number(value) : 0;
  const valueStr = String(value ?? '');

  const isLongValue = valueStr.length > 11;
  const isVeryLongValue = valueStr.length > 15;

  const valueFontSize = compactValue || isVeryLongValue
    ? 'text-lg sm:text-xl font-black'
    : isLongValue
    ? 'text-xl sm:text-2xl font-black'
    : 'text-2xl sm:text-3xl font-extrabold';

  const gridColsClass =
    breakdown && breakdown.length === 2
      ? 'grid-cols-2 gap-1.5'
      : breakdown && breakdown.length === 3
      ? 'grid-cols-3 gap-1'
      : 'grid-cols-4 gap-1';

  return (
    <section className="q-card q-stat-card flex flex-col justify-between p-4 sm:p-5 rounded-3xl border border-gray-100/90 dark:border-slate-800 bg-white dark:bg-slate-800/95 shadow-xs hover:shadow-md transition-all duration-200">
      <div>
        <div className="flex items-start justify-between gap-3">
          <p className="q-stat-title text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 line-clamp-2 leading-tight min-h-[32px] flex items-center">
            {title}
          </p>
          <div className={`q-stat-icon grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-2xl shadow-xs transition-transform duration-200 group-hover:scale-105 ${toneMap[tone] || toneMap.teal}`}>
            <Icon size={20} className="shrink-0" />
          </div>
        </div>

        <div className="mt-2 flex items-baseline">
          <p
            className={`q-stat-value tracking-tight text-gray-900 dark:text-slate-100 leading-none whitespace-nowrap overflow-visible ${valueFontSize}`}
            title={valueTitle ?? valueStr}
          >
            {isNumeric ? (
              <CountUpNumber end={numericVal} />
            ) : (
              value
            )}
          </p>
        </div>

        {subtitle ? (
          <p className={`q-stat-subtitle mt-2 text-xs font-bold leading-tight ${subtitleToneMap[tone] || 'text-[#138F81] dark:text-[#2DD4BF]'}`}>
            {subtitle}
          </p>
        ) : null}
      </div>

      {breakdown && breakdown.length > 0 ? (
        <div className={`mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-700/80 grid ${gridColsClass}`}>
          {breakdown.map((item, idx) => {
            const style = pillToneMap[item.tone ?? 'neutral'] || pillToneMap.neutral;
            const itemIsNumeric = typeof item.value === 'number' || (!isNaN(Number(item.value)) && typeof item.value === 'string' && item.value.trim() !== '' && !item.value.includes('Rp'));
            const itemNum = itemIsNumeric ? Number(item.value) : 0;

            return (
              <div
                key={idx}
                className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl border ${style.bg} ${style.border} transition-transform hover:scale-105`}
                title={item.tooltip || `${item.label}: ${item.value}`}
              >
                <span className={`text-xs font-black leading-none ${style.text}`}>
                  {itemIsNumeric ? <CountUpNumber end={itemNum} duration={800} /> : item.value}
                </span>
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight mt-0.5 leading-none">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

