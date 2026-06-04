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

export function MoneyText({ value, className = '' }: MoneyTextProps) {
  return <span className={className}>{formatMoney(value)}</span>;
}
