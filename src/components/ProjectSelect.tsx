import React from 'react';
import { Check, ChevronDown, Search, FolderKanban } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ProgressProject } from '../types';
import { useClickOutside } from '../hooks/useClickOutside';

interface ProjectSelectProps {
  projects: ProgressProject[];
  value: string;
  onChange: (projectId: string) => void;
  label?: string;
  placeholder?: string;
}

/** Searchable "Add to Progress" selector — only shows the user's own projects. */
export const ProjectSelect: React.FC<ProjectSelectProps> = ({
  projects,
  value,
  onChange,
  label = 'Add to Progress',
  placeholder = 'Select a project...',
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const close = React.useCallback(() => setIsOpen(false), []);
  useClickOutside(containerRef, close, isOpen);

  React.useEffect(() => {
    if (isOpen) {
      setQuery('');
      // Focus the search field once rendered
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const selected = projects.find((p) => p.id === value);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q)
    );
  }, [projects, query]);

  return (
    <div className="w-full" ref={containerRef}>
      <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
        {label} <span className="text-orange-500">*</span>
      </label>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border text-sm transition-colors cursor-pointer ${
          isOpen
            ? 'border-orange-500 ring-2 ring-orange-500/50 bg-white dark:bg-zinc-800'
            : 'border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 hover:border-orange-500/50'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          {selected ? (
            <>
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: selected.accent_color || '#ff6b00' }}
              />
              <span className="truncate font-medium text-slate-900 dark:text-white">
                {selected.title}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0">
                ({selected.total_tasks ?? 0} tasks)
              </span>
            </>
          ) : (
            <span className="truncate text-slate-400 dark:text-zinc-500">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="mt-1.5 z-30 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl overflow-hidden"
            role="listbox"
          >
            {/* Search */}
            <div className="p-2 border-b border-slate-100 dark:border-zinc-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search projects..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Options */}
            <div className="max-h-52 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                  <FolderKanban className="w-6 h-6 text-slate-300 dark:text-zinc-600" />
                  <p className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                    No progress found
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500">Try another search.</p>
                </div>
              ) : (
                filtered.map((p) => {
                  const isSelected = p.id === value;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(p.id);
                        close();
                      }}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-orange-500/5 dark:bg-orange-500/10'
                          : 'hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt=""
                          aria-hidden="true"
                          className="w-8 h-8 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shrink-0"
                          style={{ backgroundColor: p.accent_color || '#ff6b00' }}
                        >
                          {p.title.charAt(0).toUpperCase()}
                        </span>
                      )}

                      <span className="flex-1 min-w-0">
                        <span
                          className={`block truncate text-xs ${
                            isSelected
                              ? 'font-bold text-orange-600 dark:text-orange-400'
                              : 'font-semibold text-slate-800 dark:text-zinc-100'
                          }`}
                        >
                          {p.title}
                        </span>
                        <span className="block text-[10px] text-slate-400 dark:text-zinc-500">
                          {p.completed_tasks ?? 0}/{p.total_tasks ?? 0} completed ·{' '}
                          {p.completion_percentage ?? 0}%
                        </span>
                      </span>

                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
