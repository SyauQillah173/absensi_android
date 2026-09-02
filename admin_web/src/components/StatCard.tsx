import type { LucideIcon } from 'lucide-react';

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
  teal: 'bg-[#E8F7F3] text-[#138F81] border border-teal-100',
  blue: 'bg-[#EAF4FF] text-[#2E86DE] border border-blue-100',
  orange: 'bg-[#FFF3E0] text-[#E65100] border border-orange-100',
  purple: 'bg-[#F0EBFF] text-[#6C5CE7] border border-purple-100',
  red: 'bg-[#FDECEC] text-[#D63031] border border-rose-100'
};

const subtitleToneMap: Record<string, string> = {
  teal: 'text-[#138F81]',
  blue: 'text-[#2E86DE]',
  orange: 'text-[#E65100]',
  purple: 'text-[#6C5CE7]',
  red: 'text-[#D63031]'
};

const pillToneMap: Record<string, { bg: string; text: string; border: string }> = {
  success: { bg: 'bg-emerald-50/80', text: 'text-emerald-700', border: 'border-emerald-200/80' },
  warning: { bg: 'bg-amber-50/80', text: 'text-amber-700', border: 'border-amber-200/80' },
  danger: { bg: 'bg-rose-50/80', text: 'text-rose-700', border: 'border-rose-200/80' },
  neutral: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200/80' },
  blue: { bg: 'bg-sky-50/80', text: 'text-sky-700', border: 'border-sky-200/80' },
  purple: { bg: 'bg-purple-50/80', text: 'text-purple-700', border: 'border-purple-200/80' },
  teal: { bg: 'bg-teal-50/80', text: 'text-teal-700', border: 'border-teal-200/80' },
  rose: { bg: 'bg-rose-50/80', text: 'text-rose-700', border: 'border-rose-200/80' },
  sky: { bg: 'bg-sky-50/80', text: 'text-sky-700', border: 'border-sky-200/80' },
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
  const valueStr = String(value ?? '');
  // Dynamically scale font size for long currency text so it NEVER clips or truncates
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
    <section className="q-card q-stat-card flex flex-col justify-between p-4 sm:p-5 rounded-3xl border border-gray-100/90 bg-white shadow-xs hover:shadow-md transition-all duration-200">
      <div>
        <div className="flex items-start justify-between gap-3">
          <p className="q-stat-title text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 line-clamp-2 leading-tight min-h-[32px] flex items-center">
            {title}
          </p>
          <div className={`q-stat-icon grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-2xl shadow-xs transition-transform duration-200 group-hover:scale-105 ${toneMap[tone] || toneMap.teal}`}>
            <Icon size={20} className="shrink-0" />
          </div>
        </div>

        <div className="mt-2 flex items-baseline">
          <p
            className={`q-stat-value tracking-tight text-gray-900 leading-none whitespace-nowrap overflow-visible ${valueFontSize}`}
            title={valueTitle ?? valueStr}
          >
            {value}
          </p>
        </div>

        {subtitle ? (
          <p className={`q-stat-subtitle mt-2 text-xs font-bold leading-tight ${subtitleToneMap[tone] || 'text-[#138F81]'}`}>
            {subtitle}
          </p>
        ) : null}
      </div>

      {breakdown && breakdown.length > 0 ? (
        <div className={`mt-3.5 pt-3 border-t border-slate-100 grid ${gridColsClass}`}>
          {breakdown.map((item, idx) => {
            const style = pillToneMap[item.tone ?? 'neutral'] || pillToneMap.neutral;
            return (
              <div
                key={idx}
                className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl border ${style.bg} ${style.border} transition-transform hover:scale-105`}
                title={item.tooltip || `${item.label}: ${item.value}`}
              >
                <span className={`text-xs font-black leading-none ${style.text}`}>
                  {item.value}
                </span>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight mt-0.5 leading-none">
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

