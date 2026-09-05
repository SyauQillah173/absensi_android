import { Check, ChevronDown, Moon, Sparkles, Sun } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTheme, type ThemeMode } from '../theme/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showDropdown?: boolean;
}

export function ThemeToggle({ className = '', showDropdown = true }: ThemeToggleProps) {
  const { themeMode, resolvedTheme, setThemeMode, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const options: Array<{ mode: ThemeMode; label: string; desc: string; icon: typeof Sun }> = [
    {
      mode: 'light',
      label: 'Mode Terang',
      desc: 'Kuning Emas & Putih Bersih Khas Qomaruddin',
      icon: Sun
    },
    {
      mode: 'dark',
      label: 'Mode Malam',
      desc: 'Midnight Obsidian Slate yang Sejuk di Mata',
      icon: Moon
    },
    {
      mode: 'auto',
      label: 'Otomatis Cerdas',
      desc: 'Menyesuaikan Sistem OS & Waktu Malam (18:00 - 06:00)',
      icon: Sparkles
    }
  ];

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* TOMBOL TOGGLE UTAMA DENGAN MIKRO-ANIMASI MORPHING */}
      <button
        type="button"
        onClick={() => {
          if (showDropdown) {
            setIsOpen(!isOpen);
          } else {
            toggleTheme();
          }
        }}
        className={`group relative flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl transition-all duration-300 cursor-pointer shadow-xs ${
          resolvedTheme === 'dark'
            ? 'bg-slate-800/90 text-amber-300 border border-slate-700/80 hover:bg-slate-700/80 hover:border-amber-400/40 shadow-slate-900/40'
            : 'bg-amber-50/80 text-[#0D7A6F] border border-amber-200 hover:bg-amber-100/80 hover:border-amber-300 shadow-amber-900/5'
        }`}
        title={
          themeMode === 'auto'
            ? `Tema: Otomatis Cerdas (${resolvedTheme === 'dark' ? 'Malam Aktif' : 'Siang Aktif'})`
            : `Tema: Mode ${resolvedTheme === 'dark' ? 'Malam' : 'Terang'}`
        }
        aria-label="Pilih Mode Tema (Terang / Malam / Otomatis)"
      >
        {/* ICON CONTAINER DENGAN ANIMASI ROTASI & SCALE */}
        <div className="relative w-5 h-5 flex items-center justify-center">
          {/* Ikon Matahari */}
          <Sun
            size={18}
            className={`absolute transition-all duration-500 ease-out text-[#D97706] ${
              resolvedTheme === 'dark'
                ? 'opacity-0 rotate-90 scale-50 pointer-events-none'
                : 'opacity-100 rotate-0 scale-100'
            }`}
          />
          {/* Ikon Bulan */}
          <Moon
            size={18}
            className={`absolute transition-all duration-500 ease-out text-amber-300 ${
              resolvedTheme === 'dark'
                ? 'opacity-100 rotate-0 scale-100'
                : 'opacity-0 -rotate-90 scale-50 pointer-events-none'
            }`}
          />
        </div>

        {/* Label Ringkas untuk Desktop */}
        <span className="hidden sm:inline text-xs font-bold capitalize select-none">
          {themeMode === 'auto' ? 'Otomatis' : resolvedTheme === 'dark' ? 'Malam' : 'Terang'}
        </span>

        {/* Panah Dropdown jika showDropdown true */}
        {showDropdown && (
          <ChevronDown
            size={13}
            className={`transition-transform duration-300 ${
              isOpen ? 'rotate-180' : ''
            } ${resolvedTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}
          />
        )}
      </button>

      {/* DROPDOWN MENU PILIHAN 3 MODE CERDAS */}
      {showDropdown && isOpen && (
        <div
          className={`absolute right-0 mt-2 w-64 sm:w-72 rounded-3xl p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200 ${
            resolvedTheme === 'dark'
              ? 'bg-slate-900/95 border border-slate-700/80 text-slate-100 backdrop-blur-md shadow-black/60'
              : 'bg-white/95 border border-amber-200 text-[#2D3436] backdrop-blur-md shadow-slate-300/40'
          }`}
        >
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#138F81] dark:text-amber-400 block">
              TEMA SISTEM CERDAS
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Pilih tampilan yang paling nyaman untuk mata Anda
            </span>
          </div>

          <div className="py-1 space-y-1">
            {options.map((opt) => {
              const Icon = opt.icon;
              const isSelected = themeMode === opt.mode;

              return (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => {
                    setThemeMode(opt.mode);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-start gap-3 p-2.5 rounded-2xl text-left transition-all cursor-pointer ${
                    isSelected
                      ? resolvedTheme === 'dark'
                        ? 'bg-slate-800 border border-slate-700 text-amber-300 font-bold'
                        : 'bg-amber-50 border border-amber-200 text-[#0D7A6F] font-bold'
                      : resolvedTheme === 'dark'
                      ? 'hover:bg-slate-800/60 text-slate-300'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div
                    className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected
                        ? resolvedTheme === 'dark'
                          ? 'bg-amber-400/20 text-amber-300'
                          : 'bg-[#FFDC80] text-[#0D7A6F]'
                        : resolvedTheme === 'dark'
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon size={16} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black">{opt.label}</span>
                      {isSelected && <Check size={14} className="text-[#138F81] dark:text-amber-400" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 font-normal">
                      {opt.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
