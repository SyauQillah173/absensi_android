interface StatusBadgeProps {
  label: string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

const toneMap = {
  success: 'bg-[#E8F7F3] text-[#138F81]',
  warning: 'bg-[#FFF3E0] text-[#E65100]',
  danger: 'bg-[#FDECEC] text-[#D63031]',
  info: 'bg-[#EAF4FF] text-[#2E86DE]',
  neutral: 'bg-[#F2F4F6] text-[#636E72]'
};

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${toneMap[tone]}`}>
      {label}
    </span>
  );
}
