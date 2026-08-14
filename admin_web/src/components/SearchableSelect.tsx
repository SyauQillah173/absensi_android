import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string | number;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Pilih...',
  disabled = false,
  name
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Find the selected option's label to display when closed
  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  const displayValue = selectedOption ? selectedOption.label : '';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* Invisible actual input for form submission if needed */}
      <input type="hidden" name={name} value={value} />
      
      <div
        className={`flex w-full items-center justify-between rounded-xl border border-[#138F81]/30 bg-[#F8FDFD] px-4 py-3 text-sm transition-all focus-within:border-[#138F81] focus-within:ring-2 focus-within:ring-[#138F81]/20 ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer hover:border-[#138F81]/50'}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            if (!isOpen) setSearch('');
          }
        }}
      >
        <span className={displayValue ? 'text-slate-800 font-medium' : 'text-slate-400'}>
          {displayValue || placeholder}
        </span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-slate-500">
            <Search size={16} />
            <input
              type="text"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-300"
              placeholder="Ketik untuk mencari..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto q-scrollbar p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-sm text-slate-400">Tidak ada hasil ditemukan</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <div
                    key={opt.value}
                    className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${isSelected ? 'bg-[#138F81]/10 text-[#138F81] font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                  >
                    {opt.label}
                    {isSelected && <Check size={16} />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
