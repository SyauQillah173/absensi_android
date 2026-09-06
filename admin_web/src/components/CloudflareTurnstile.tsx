import { useEffect, useRef, useState } from 'react';

// Site key resmi dari Cloudflare Turnstile akun Yayasan Qomaruddin (Domain: itqom.net & subdomains)
export const PRODUCTION_TURNSTILE_SITE_KEY = '0x4AAAAAAEqTAKJ33D5lbDBb';

// Cloudflare official "Always passes" test key untuk testing / localhost / IP internal (127.0.0.1, 10.x, 192.168.x)
export const TEST_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';

/**
 * Deteksi otomatis apakah aplikasi berjalan di domain produksi itqom.net
 * atau di lingkungan lokal / IP server langsung agar verifikasi tidak macet.
 */
export function getTurnstileSiteKey(): string {
  if (typeof window === 'undefined') return PRODUCTION_TURNSTILE_SITE_KEY;
  const host = window.location.hostname.toLowerCase();
  
  // Jika domain produksi itqom.net atau subdomainnya (misal ppqomaruddin.itqom.net)
  if (host === 'itqom.net' || host.endsWith('.itqom.net')) {
    return PRODUCTION_TURNSTILE_SITE_KEY;
  }
  
  // Jika diakses melalui localhost, 127.0.0.1, atau IP server (misal 10.10.69.21) -> gunakan Cloudflare test key resmi
  return TEST_TURNSTILE_SITE_KEY;
}

interface TurnstileProps {
  onVerify: (token: string) => void;
  onError?: (error: string) => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: (err: unknown) => void;
          'expired-callback'?: () => void;
          theme?: string;
          size?: 'normal' | 'compact' | 'flexible';
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

export function CloudflareTurnstile({
  onVerify,
  onError,
  onExpire,
  theme = 'auto',
  className = '',
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Simpan callback ke useRef agar reference stabil dan TIDAK memicu unmount / infinite re-render loop
  const onVerifyRef = useRef(onVerify);
  onVerifyRef.current = onVerify;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const scriptId = 'cf-turnstile-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    const sitekey = getTurnstileSiteKey();

    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current) return;

      // Jika widget sudah ter-render pada DOM, cegah render duplikat
      if (widgetIdRef.current) return;

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey,
          theme,
          size: 'normal',
          callback: (token: string) => {
            setIsReady(true);
            onVerifyRef.current?.(token);
          },
          'error-callback': (err: unknown) => {
            console.warn('[Cloudflare Turnstile] Warning:', err);
            onErrorRef.current?.(String(err));
          },
          'expired-callback': () => {
            onExpireRef.current?.();
          },
        });
        widgetIdRef.current = id;
        setIsReady(true);
      } catch (err) {
        console.error('[Cloudflare Turnstile] Gagal me-render widget:', err);
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        renderWidget();
      };
      document.head.appendChild(script);
    } else if (window.turnstile) {
      renderWidget();
    } else {
      script.addEventListener('load', renderWidget);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore cleanup error
        }
        widgetIdRef.current = null;
      }
    };
  }, [theme]); // HANYA bergantung pada theme, bukan fungsi callback!

  return (
    <div className={`my-1.5 flex flex-col items-center justify-center min-h-[65px] ${className}`}>
      <div ref={containerRef} className="flex justify-center" />
      {!isReady && (
        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400 py-1.5">
          <span className="h-3 w-3 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
          <span>Memuat verifikasi keamanan Cloudflare...</span>
        </div>
      )}
    </div>
  );
}
