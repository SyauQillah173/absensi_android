/**
 * Modul Utilitas Keamanan Web (Security & Anti-Phising Shield)
 * Mencegah XSS, URL Phising injection, dan payload berbahaya pada UI client.
 */

// Protokol terlarang yang sering digunakan hacker untuk XSS dan phising
const DANGEROUS_PROTOCOLS = ['javascript:', 'data:', 'vbscript:', 'file:'];

/**
 * Validasi apakah suatu URL aman untuk dibuka pengguna.
 */
export function isSafeUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();

  // Tolak jika mengandung protokol berbahaya
  for (const proto of DANGEROUS_PROTOCOLS) {
    if (trimmed.startsWith(proto)) {
      return false;
    }
  }

  // Izinkan path internal (diawali /) atau URL web sah (http:// / https://)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true;
  }

  return trimmed.startsWith('https://') || trimmed.startsWith('http://');
}

/**
 * Sanitasi URL: mengembalikan URL aman atau fallback jika terdeteksi berbahaya.
 */
export function sanitizeUrl(url: string | null | undefined, fallback = '#'): string {
  if (isSafeUrl(url)) {
    return url!.trim();
  }
  return fallback;
}

/**
 * Sanitasi teks dari tag script mentah sebelum dirender.
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}
