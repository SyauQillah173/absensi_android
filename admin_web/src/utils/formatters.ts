export function num(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

export function str(value: unknown, fallback = '-'): string {
  const result = String(value ?? '').trim();
  return result || fallback;
}

/**
 * Returns today's date string formatted as YYYY-MM-DD in Asia/Jakarta timezone.
 * Avoids the UTC-shift bug where new Date().toISOString() returns yesterday's date before 07:00 AM WIB.
 */
export function getTodayDateString(timeZone = 'Asia/Jakarta'): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
