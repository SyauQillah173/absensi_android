export function num(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

export function str(value: unknown, fallback = '-'): string {
  const result = String(value ?? '').trim();
  return result || fallback;
}
