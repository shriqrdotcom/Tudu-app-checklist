import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export const LoadingSpinner: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = '',
}) => (
  <div
    className={`border-2 border-orange-500 border-t-transparent rounded-full animate-spin ${className}`}
    style={{ width: size, height: size }}
    role="status"
    aria-label="Loading"
  />
);

interface LoadingStateProps {
  label?: string;
  description?: string;
  fullScreen?: boolean;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label = 'Loading...',
  description,
  fullScreen = false,
}) => {
  const content = (
    <div className="flex flex-col items-center justify-center gap-3 text-center">
      <CheckCircle2 className="w-8 h-8 text-orange-500 orange-glow" />
      <LoadingSpinner />
      <div>
        <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">{label}</p>
        {description && (
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">{description}</p>
        )}
      </div>
    </div>
  );

  if (!fullScreen) {
    return <div className="flex items-center justify-center py-16">{content}</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4">
      {content}
    </div>
  );
};
