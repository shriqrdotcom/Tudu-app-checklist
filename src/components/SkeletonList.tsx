import React from 'react';

/** Lightweight skeleton matching the Progress list-row layout (no heavy animation). */
export const SkeletonList: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="space-y-2.5" aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="flex items-center gap-3 sm:gap-4 p-3 sm:p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800"
      >
        {/* Avatar block */}
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-200/80 dark:bg-zinc-800/80 animate-pulse shrink-0" />
        {/* Title + description + bar */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-3.5 w-1/2 rounded bg-slate-200/80 dark:bg-zinc-800/80 animate-pulse" />
          <div className="h-2.5 w-3/4 rounded bg-slate-200/60 dark:bg-zinc-800/60 animate-pulse" />
          <div className="h-1.5 w-24 sm:w-32 rounded-full bg-slate-200/60 dark:bg-zinc-800/60 animate-pulse" />
        </div>
        {/* Percentage block */}
        <div className="w-10 h-4 rounded bg-slate-200/60 dark:bg-zinc-800/60 animate-pulse shrink-0" />
      </div>
    ))}
  </div>
);
