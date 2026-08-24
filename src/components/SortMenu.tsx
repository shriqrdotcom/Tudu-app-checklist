import React from 'react';
import { ArrowUpDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SortOption } from '../types';
import { useClickOutside } from '../hooks/useClickOutside';

interface SortMenuProps {
  value: SortOption;
  onChange: (sort: SortOption) => void;
}

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'recent_updated', label: 'Recently updated' },
  { id: 'recent_created', label: 'Recently created' },
  { id: 'name_asc', label: 'Name A–Z' },
  { id: 'name_desc', label: 'Name Z–A' },
  { id: 'completion_high', label: 'Highest completion' },
  { id: 'completion_low', label: 'Lowest completion' },
];

export const SortMenu: React.FC<SortMenuProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setIsOpen(false), []);
  useClickOutside(menuRef, close, isOpen);

  const currentLabel = SORT_OPTIONS.find((o) => o.id === value)?.label ?? 'Sort';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Sort projects"
        aria-expanded={isOpen}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
          isOpen
            ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30'
            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-transparent hover:bg-slate-200 dark:hover:bg-zinc-700'
        }`}
      >
        <ArrowUpDown className="w-3.5 h-3.5" />
        <span className="hidden xs:inline sm:inline">{currentLabel}</span>
        <span className="xs:hidden sm:hidden">Sort</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-52 z-30 py-1.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl overflow-hidden"
            role="menu"
          >
            {SORT_OPTIONS.map((option) => {
              const isActive = option.id === value;
              return (
                <button
                  key={option.id}
                  role="menuitem"
                  onClick={() => {
                    onChange(option.id);
                    close();
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 text-xs text-left transition-colors cursor-pointer ${
                    isActive
                      ? 'text-orange-600 dark:text-orange-400 font-bold bg-orange-500/5 dark:bg-orange-500/10'
                      : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span>{option.label}</span>
                  {isActive && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
