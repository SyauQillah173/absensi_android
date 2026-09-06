import { useEffect, useRef, useState } from 'react';

// Site key resmi dari Cloudflare Turnstile akun Yayasan Qomaruddin
export const TURNSTILE_SITE_KEY = '0x4AAAAAAEqTAKJ33D5lbDBb';

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

  useEffect(() => {
    // 1. Cek apakah script Turnstile sudah ada
    const scriptId = 'cf-turnstile-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current) return;

      // Bersihkan widget lama jika ada
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore cleanup error
        }
      }

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme,
          size: 'flexible',
          callback: (token: string) => {
            onVerify(token);
          },
          'error-callback': (err: unknown) => {
            console.warn('[Cloudflare Turnstile] Verifikasi error:', err);
            onError?.(String(err));
          },
          'expired-callback': () => {
            onExpire?.();
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
          // ignore
        }
      }
    };
  }, [theme, onVerify, onError, onExpire]);

  return (
    <div className={`my-2 flex flex-col items-center justify-center min-h-[65px] ${className}`}>
      <div ref={containerRef} className="w-full flex justify-center" />
      {!isReady && (
        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400 py-2">
          <span className="h-3 w-3 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
          <span>Memuat verifikasi keamanan Cloudflare...</span>
        </div>
      )}
    </div>
  );
}
