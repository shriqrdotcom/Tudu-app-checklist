import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search projects or tasks...',
  className = '',
  ariaLabel = 'Search',
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && value) {
      e.stopPropagation();
      onChange('');
    }
  };

  return (
    <div className={`relative w-full ${className}`}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500 pointer-events-none" aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        role="searchbox"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800/90 border border-slate-200 dark:border-zinc-700/80 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
      />
      {value && (
        <button
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60 cursor-pointer transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
