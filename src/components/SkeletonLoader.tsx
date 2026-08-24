import React from 'react';

export const SkeletonCard: React.FC = () => {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 animate-pulse flex flex-col justify-between h-52">
      <div>
        <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-1/3 mb-3" />
        <div className="h-6 bg-slate-200 dark:bg-zinc-800 rounded w-3/4 mb-2" />
        <div className="h-3 bg-slate-200 dark:bg-zinc-800 rounded w-full mb-1" />
        <div className="h-3 bg-slate-200 dark:bg-zinc-800 rounded w-2/3" />
      </div>

      <div>
        <div className="h-2 bg-slate-200 dark:bg-zinc-800 rounded-full w-full mb-3" />
        <div className="flex justify-between items-center">
          <div className="h-3 bg-slate-200 dark:bg-zinc-800 rounded w-20" />
          <div className="h-3 bg-slate-200 dark:bg-zinc-800 rounded w-12" />
        </div>
      </div>
    </div>
  );
};

export const SkeletonGrid: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
};
