import { Moon, Sparkles, Sun } from 'lucide-react';
import React from 'react';
import { useTheme } from '../theme/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showDropdown?: boolean; // dipertahankan untuk kompatibilitas props lama, tapi sekarang selalu 1-klik
}

/**
 * Modern 1-Click Day/Night (Siang-Malam) Theme Toggle
 * Dilengkapi animasi transisi mikro rotasi 360°, morphing Matahari <-> Bulan,
 * serta gradasi langit siang emas cerah <-> midnight obsidian berbintang.
 */
export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`group relative flex items-center justify-between h-9 sm:h-10 px-2 sm:px-2.5 rounded-full transition-all duration-500 ease-out cursor-pointer select-none shadow-sm hover:shadow-md active:scale-95 ${
        isDark
          ? 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-amber-300 border border-slate-700/80 shadow-slate-950/40 hover:border-amber-400/40'
          : 'bg-gradient-to-r from-amber-100 via-amber-50 to-orange-100 text-amber-800 border border-amber-300/80 shadow-amber-900/10 hover:border-amber-400'
      } ${className}`}
      title={isDark ? 'Mode Malam aktif (Klik untuk beralih ke Mode Siang)' : 'Mode Siang aktif (Klik untuk beralih ke Mode Malam)'}
      aria-label="Ganti Mode Siang / Malam"
    >
      {/* Background Animated Sky Stars / Rays Effect */}
      <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none opacity-40 group-hover:opacity-70 transition-opacity">
        {isDark ? (
          <div className="absolute inset-0 flex items-center justify-around px-2 text-[8px] text-amber-200 animate-pulse">
            <span>✦</span>
            <span className="text-[6px] text-sky-200">★</span>
            <span className="text-[7px] text-indigo-200">✦</span>
          </div>
        ) : (
          <div className="absolute inset-0 bg-radial from-amber-300/30 to-transparent blur-xs animate-pulse" />
        )}
      </div>

      {/* Pill Slider Thumb dengan Animasi Rotasi Siang-Malam */}
      <div
        className={`relative z-10 flex items-center gap-1.5 transition-transform duration-500 ease-out`}
      >
        <div
          className={`h-6 w-6 sm:h-7 sm:w-7 rounded-full flex items-center justify-center shadow-xs transition-all duration-500 transform ${
            isDark
              ? 'bg-indigo-950/90 text-amber-300 rotate-360 scale-100 ring-1 ring-amber-400/30 shadow-indigo-950/50'
              : 'bg-white text-amber-500 rotate-0 scale-100 ring-1 ring-amber-300/60 shadow-amber-500/20'
          }`}
        >
          {isDark ? (
            <Moon size={14} className="animate-in zoom-in duration-300" />
          ) : (
            <Sun size={15} className="animate-in spin-in-180 duration-500 text-amber-500" />
          )}
        </div>

        {/* Teks Label Siang / Malam yang Elegan */}
        <span className="text-[11px] sm:text-xs font-black tracking-tight uppercase px-1 transition-colors duration-300">
          {isDark ? (
            <span className="text-amber-200 flex items-center gap-1">
              <span>Malam</span>
              <Sparkles size={10} className="text-amber-400 animate-pulse" />
            </span>
          ) : (
            <span className="text-amber-900 font-extrabold">
              Siang
            </span>
          )}
        </span>
      </div>
    </button>
  );
}
