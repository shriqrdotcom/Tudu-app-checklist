import React from 'react';
import { Star, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { ProgressProject } from '../types';
import { ProgressBar } from './ProgressBar';

interface ProgressCardProps {
  project: ProgressProject;
  onOpen: (project: ProgressProject) => void;
  onToggleFavorite: (projectId: string, current: boolean) => void;
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return 'Recently';
  const date = new Date(iso);
  const diffMinutes = Math.round((date.getTime() - Date.now()) / (1000 * 60));
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) return rtf.format(diffDays, 'day');
  return rtf.format(Math.round(diffDays / 30), 'month');
}

/**
 * WhatsApp-inspired progress list row:
 * image/avatar on the left, title + secondary info in the middle,
 * completion status on the right. TU DU identity: white/black + orange.
 */
export const ProgressCard: React.FC<ProgressCardProps> = ({
  project,
  onOpen,
  onToggleFavorite,
}) => {
  const total = project.total_tasks ?? 0;
  const completed = project.completed_tasks ?? 0;
  const percentage = project.completion_percentage ?? 0;
  const accent = project.accent_color || '#ff6b00';
  const relativeTime = React.useMemo(() => formatRelativeTime(project.updated_at), [project.updated_at]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      whileTap={{ scale: 0.99 }}
      role="button"
      tabIndex={0}
      aria-label={`Open progress: ${project.title}. ${completed} of ${total} tasks completed, ${percentage} percent.`}
      onClick={() => onOpen(project)}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(project);
        }
      }}
      className="group relative flex items-center gap-3 sm:gap-4 p-3 sm:p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-zinc-700 active:bg-slate-50 dark:active:bg-zinc-800/50 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:border-orange-500 transition-all duration-200 cursor-pointer outline-none"
    >
      {/* Avatar / Project image */}
      {project.image_url ? (
        <img
          src={project.image_url}
          alt=""
          aria-hidden="true"
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-slate-200 dark:border-zinc-800 shrink-0"
          loading="lazy"
        />
      ) : (
        <div
          aria-hidden="true"
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center text-white font-black text-lg shrink-0"
          style={{ backgroundColor: accent }}
        >
          {project.title.charAt(0).toUpperCase() || 'P'}
        </div>
      )}

      {/* Title + secondary info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-sm sm:text-[15px] text-slate-900 dark:text-white truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
            {project.title}
          </h3>
          {project.is_favorite && (
            <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" aria-hidden="true" />
          )}
        </div>

        {project.description && (
          <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
            {project.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1.5">
          {/* Compact progress bar */}
          <div className="w-16 sm:w-24 shrink-0">
            <ProgressBar percentage={percentage} color={accent} size="sm" showText={false} />
          </div>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 whitespace-nowrap">
            {completed} / {total} completed
          </span>
        </div>
      </div>

      {/* Right-side status */}
      <div className="flex flex-col items-end justify-between self-stretch py-0.5 gap-1.5 shrink-0">
        <span className="font-mono text-sm sm:text-base font-extrabold" style={{ color: accent }}>
          {percentage}
          <span className="text-[10px] align-top">%</span>
        </span>

        <div className="flex items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(project.id, project.is_favorite);
            }}
            id={`fav-btn-${project.id}`}
            aria-label={project.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
            title="Favorite"
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer active:scale-90"
          >
            <Star
              className={`w-4 h-4 transition-colors ${
                project.is_favorite
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-slate-300 dark:text-zinc-600'
              }`}
            />
          </button>

          <ChevronRight className="w-4 h-4 text-slate-300 dark:text-zinc-600 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
        </div>

        <span className="text-[10px] text-slate-400 dark:text-zinc-500 hidden sm:block whitespace-nowrap">
          {relativeTime}
        </span>
      </div>
    </motion.div>
  );
};
