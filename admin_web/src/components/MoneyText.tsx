interface MoneyTextProps {
  value: unknown;
  className?: string;
}

const formatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
});

export function formatMoney(value: unknown): string {
  const amount = typeof value === 'number' ? value : Number(value ?? 0);
  return formatter.format(Number.isFinite(amount) ? amount : 0);
}

export function formatCompactMoney(value: unknown): string {
  const amount = typeof value === 'number' ? value : Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const absolute = Math.abs(safeAmount);

  if (absolute >= 1_000_000_000) {
    return `Rp${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(safeAmount / 1_000_000_000)} M`;
  }
  if (absolute >= 1_000_000) {
    return `Rp${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(safeAmount / 1_000_000)} jt`;
  }

  return formatMoney(safeAmount).replace(/\s/g, '');
}

export function MoneyText({ value, className = '' }: MoneyTextProps) {
  return <span className={className}>{formatMoney(value)}</span>;
}
