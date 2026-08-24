import React from 'react';
import { motion } from 'motion/react';
import { FilterStatus } from '../types';

interface FilterTabsProps {
  activeFilter: FilterStatus;
  onSelectFilter: (filter: FilterStatus) => void;
  counts?: {
    all?: number;
    in_progress?: number;
    completed?: number;
    favorites?: number;
  };
}

export const FilterTabs: React.FC<FilterTabsProps> = ({
  activeFilter,
  onSelectFilter,
  counts,
}) => {
  const tabs: { id: FilterStatus; label: string; countKey?: keyof typeof counts }[] = [
    { id: 'all', label: 'All', countKey: 'all' },
    { id: 'in_progress', label: 'Active', countKey: 'in_progress' },
    { id: 'completed', label: 'Completed', countKey: 'completed' },
    { id: 'favorites', label: '★ Favorites', countKey: 'favorites' },
  ];

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
      {tabs.map((tab) => {
        const isActive = activeFilter === tab.id;
        const count = counts && tab.countKey ? counts[tab.countKey] : undefined;

        return (
          <button
            key={tab.id}
            onClick={() => onSelectFilter(tab.id)}
            className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              isActive
                ? 'text-orange-600 dark:text-orange-400 font-bold'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/60'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="active-filter-pill"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="absolute inset-0 bg-orange-500/10 dark:bg-orange-500/20 rounded-xl border border-orange-500/30"
              />
            )}
            <span className="relative z-10">{tab.label}</span>
            {count !== undefined && (
              <span
                className={`relative z-10 px-1.5 py-0.2 rounded-full text-[10px] ${
                  isActive
                    ? 'bg-orange-500 text-white font-bold'
                    : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
