import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  valueTitle?: string;
  subtitle?: string;
  icon: LucideIcon;
  tone?: 'teal' | 'blue' | 'orange' | 'purple' | 'red';
  compactValue?: boolean;
}

const toneMap = {
  teal: 'bg-[#E8F7F3] text-[#138F81]',
  blue: 'bg-[#EAF4FF] text-[#2E86DE]',
  orange: 'bg-[#FFF3E0] text-[#E65100]',
  purple: 'bg-[#F0EBFF] text-[#6C5CE7]',
  red: 'bg-[#FDECEC] text-[#D63031]'
};

export function StatCard({ title, value, valueTitle, subtitle, icon: Icon, tone = 'teal', compactValue = false }: StatCardProps) {
  return (
    <section className="q-card q-stat-card flex flex-col justify-between min-h-[120px] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="q-stat-title text-xs font-semibold text-[#636E72] truncate">{title}</p>
          <p
            className={`q-stat-value mt-2 text-2xl sm:text-3xl font-extrabold tracking-normal text-[#2D3436] truncate ${compactValue ? 'q-stat-value--compact' : ''}`}
            title={valueTitle}
          >
            {value}
          </p>
        </div>
        <div className={`q-stat-icon grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-2xl ${toneMap[tone]}`}>
          <Icon size={20} />
        </div>
      </div>
      {subtitle ? <p className="q-stat-subtitle mt-3 sm:mt-4 text-xs font-semibold text-[#138F81] truncate">{subtitle}</p> : null}
    </section>
  );
}
