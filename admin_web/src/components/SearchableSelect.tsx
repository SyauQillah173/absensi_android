import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Sparkles } from 'lucide-react';

export interface SearchSelectOption {
  value: string | number;
  label: string;
  subLabel?: string;
  badge?: string;
  badgeColor?: 'blue' | 'pink' | 'teal' | 'amber' | 'emerald' | 'slate';
  gender?: 'L' | 'P' | 'PA' | 'PI' | 'Campur';
  isRecommended?: boolean;
  category?: string;
}

export interface FilterChip {
  id: string;
  label: string;
  filter: (opt: SearchSelectOption) => boolean;
}

export interface SearchableSelectProps {
  options: (SearchSelectOption | { value: string | number; label: string })[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  name?: string;
  filterChips?: FilterChip[];
  recommendationNotice?: string;
  className?: string;
  size?: 'sm' | 'md';
  dropdownAlign?: 'left' | 'right';
  dropdownWidth?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Ketik untuk mencari...',
  disabled = false,
  name,
  filterChips,
  recommendationNotice,
  className = '',
  size = 'md',
  dropdownAlign = 'left',
  dropdownWidth = 'w-full sm:w-[390px]',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeChip, setActiveChip] = useState<string>('all');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalize options to SearchSelectOption
  const normalizedOptions: SearchSelectOption[] = useMemo(() => {
    return options.map((opt) => ({
      value: opt.value,
      label: opt.label,
      ...('subLabel' in opt ? { subLabel: opt.subLabel } : {}),
      ...('badge' in opt ? { badge: opt.badge } : {}),
      ...('badgeColor' in opt ? { badgeColor: opt.badgeColor } : {}),
      ...('gender' in opt ? { gender: opt.gender } : {}),
      ...('isRecommended' in opt ? { isRecommended: opt.isRecommended } : {}),
      ...('category' in opt ? { category: opt.category } : {}),
    }));
  }, [options]);

  // Find the selected option
  const selectedOption = normalizedOptions.find((opt) => String(opt.value) === String(value));

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Filtered options based on active chip and search query
  const filteredOptions = useMemo(() => {
    let result = normalizedOptions;

    // Apply active filter chip
    if (filterChips && activeChip !== 'all') {
      const chip = filterChips.find((c) => c.id === activeChip);
      if (chip) {
        result = result.filter(chip.filter);
      }
    }

    // Apply search query
    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter((opt) => {
        const matchLabel = opt.label.toLowerCase().includes(query);
        const matchSub = opt.subLabel ? opt.subLabel.toLowerCase().includes(query) : false;
        const matchBadge = opt.badge ? opt.badge.toLowerCase().includes(query) : false;
        const matchCategory = opt.category ? opt.category.toLowerCase().includes(query) : false;
        return matchLabel || matchSub || matchBadge || matchCategory;
      });
    }

    return result;
  }, [normalizedOptions, filterChips, activeChip, search]);

  // Handle keyboard interaction (Enter selects first filtered item, Esc closes)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' && filteredOptions.length > 0) {
      e.preventDefault();
      onChange(filteredOptions[0].value);
      setIsOpen(false);
    }
  };

  const getBadgeStyle = (color?: string) => {
    switch (color) {
      case 'pink':
        return 'bg-pink-100 text-pink-700 border-pink-200';
      case 'blue':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'emerald':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'amber':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'slate':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-teal-100 text-teal-800 border-teal-200';
    }
  };

  const isSmall = size === 'sm';

  return (
    <div ref={wrapperRef} className={`relative w-full ${className}`}>
      {/* Hidden input for form tracking */}
      <input type="hidden" name={name} value={value} />

      {/* Trigger Button */}
      <div
        className={`flex w-full items-center justify-between rounded-xl border transition-all ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
            : isOpen
            ? 'border-[#138F81] ring-2 ring-[#138F81]/20 bg-white shadow-xs'
            : 'border-slate-200 bg-white hover:border-[#138F81]/60 cursor-pointer shadow-2xs'
        } ${isSmall ? 'px-3 py-1.5 min-h-[38px]' : 'px-3.5 py-2.5 min-h-[42px]'}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
          }
        }}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1 mr-1">
          {selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              {selectedOption.gender === 'P' || selectedOption.gender === 'PI' ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-pink-100 text-[12px]">
                  👧
                </span>
              ) : selectedOption.gender === 'L' || selectedOption.gender === 'PA' ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-100 text-[12px]">
                  👦
                </span>
              ) : null}

              <div className="truncate text-left">
                <span className="text-xs sm:text-sm font-bold text-slate-800 truncate block">
                  {selectedOption.label}
                </span>
                {selectedOption.subLabel && (
                  <span className="text-[10px] text-slate-500 truncate block font-semibold -mt-0.5">
                    {selectedOption.subLabel}
                  </span>
                )}
              </div>

              {selectedOption.badge && (
                <span
                  className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold ${getBadgeStyle(
                    selectedOption.badgeColor
                  )}`}
                >
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <Search size={14} className="shrink-0 text-slate-400" />
              <span className="text-xs sm:text-sm font-medium truncate">{placeholder}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {selectedOption && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setIsOpen(false);
              }}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
              title="Hapus pilihan"
            >
              <X size={13} />
            </button>
          )}
          <ChevronDown
            size={15}
            className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#138F81]' : ''}`}
          />
        </div>
      </div>

      {/* Floating Dropdown Panel (Luas & Tidak Sempit) */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-2 ${dropdownWidth} overflow-hidden rounded-2xl border border-teal-200/90 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/5 ${
            dropdownAlign === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {/* Header Panel: Search Bar + Segmented Filter */}
          <div className="border-b border-slate-100 bg-slate-50/80 p-3 space-y-2.5">
            {/* Search Input Box */}
            <div className="relative flex items-center">
              <Search size={15} className="absolute left-3 text-[#138F81] pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#138F81] focus:ring-2 focus:ring-[#138F81]/20 transition-all"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Segmented Control 1 Baris (Rapi & Tidak Bertumpuk) */}
            {filterChips && filterChips.length > 0 && (
              <div
                className={`grid gap-1 bg-slate-200/60 p-1 rounded-xl ${
                  filterChips.length === 2
                    ? 'grid-cols-2'
                    : filterChips.length === 3
                    ? 'grid-cols-3'
                    : 'grid-cols-4'
                }`}
              >
                {filterChips.map((chip) => {
                  const isActive = activeChip === chip.id;
                  const count =
                    chip.id === 'all'
                      ? normalizedOptions.length
                      : normalizedOptions.filter(chip.filter).length;

                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveChip(chip.id);
                      }}
                      className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-[11px] font-extrabold transition-all cursor-pointer truncate ${
                        isActive
                          ? 'bg-[#138F81] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      <span className="truncate">{chip.label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[9px] font-black ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-300/70 text-slate-700'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Recommendation Banner (Kompak & Elegan) */}
            {recommendationNotice && (
              <div className="flex items-center gap-1.5 rounded-xl border border-teal-200/90 bg-teal-50/90 px-2.5 py-1.5 text-[11px] font-bold text-teal-900 animate-in fade-in duration-150">
                <Sparkles size={13} className="text-[#138F81] shrink-0" />
                <span className="truncate">{recommendationNotice}</span>
              </div>
            )}
          </div>

          {/* Options Scrollable List (Tinggi Lega, Muat Banyak Data) */}
          <div className="max-h-72 overflow-y-auto q-scrollbar p-2 space-y-1">
            {filteredOptions.length === 0 ? (
              <div className="p-5 text-center">
                <p className="text-xs font-bold text-slate-400">Tidak ada hasil ditemukan</p>
                {search && (
                  <p className="text-[11px] font-semibold text-slate-400 mt-1">
                    Coba kata kunci lain untuk "{search}"
                  </p>
                )}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);

                return (
                  <div
                    key={String(opt.value)}
                    className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 transition-all text-xs sm:text-sm ${
                      isSelected
                        ? 'bg-teal-50/90 border border-teal-200 text-[#138F81] font-bold shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden mr-2">
                      {/* Gender avatar icon */}
                      {opt.gender === 'P' || opt.gender === 'PI' ? (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-pink-100 text-sm shadow-2xs">
                          👧
                        </div>
                      ) : opt.gender === 'L' || opt.gender === 'PA' ? (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-sm shadow-2xs">
                          👦
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-[#138F81] text-xs font-black shadow-2xs">
                          👥
                        </div>
                      )}

                      <div className="truncate text-left">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-extrabold truncate ${
                              isSelected ? 'text-[#138F81]' : 'text-slate-800'
                            }`}
                          >
                            {opt.label}
                          </span>
                          {opt.isRecommended && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-black text-emerald-800 shrink-0">
                              <Sparkles size={10} /> Disarankan
                            </span>
                          )}
                        </div>
                        {opt.subLabel && (
                          <span className="text-[11px] font-semibold text-slate-500 block truncate mt-0.5">
                            {opt.subLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {opt.badge && (
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-extrabold ${getBadgeStyle(
                            opt.badgeColor
                          )}`}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check size={16} className="text-[#138F81]" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Info Bar */}
          <div className="border-t border-slate-100 bg-slate-50/80 px-3.5 py-2 text-[10px] font-bold text-slate-400 flex items-center justify-between">
            <span>
              Menampilkan {filteredOptions.length} dari {normalizedOptions.length} pilihan
            </span>
            <span className="italic">Tekan Enter untuk pilih cepat</span>
          </div>
        </div>
      )}
    </div>
  );
}

export { SearchableSelect as SmartSearchSelect };
