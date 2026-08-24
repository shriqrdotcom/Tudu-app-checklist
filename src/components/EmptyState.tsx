import React from 'react';
import { FolderPlus, CheckSquare, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  type?: 'projects' | 'tasks' | 'search';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  type = 'projects',
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl bg-slate-50/50 dark:bg-zinc-900/30 border border-dashed border-slate-300 dark:border-zinc-800 my-4">
      <div className="w-16 h-16 rounded-2xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-4 orange-glow-sm">
        {type === 'projects' && <FolderPlus className="w-8 h-8 stroke-[1.8]" />}
        {type === 'tasks' && <CheckSquare className="w-8 h-8 stroke-[1.8]" />}
        {type === 'search' && <Sparkles className="w-8 h-8 stroke-[1.8]" />}
      </div>
      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
      <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 max-w-sm mt-1 leading-relaxed">
        {description}
      </p>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-6 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-bold text-xs sm:text-sm shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
