import React from 'react';
import { motion } from 'motion/react';

interface ProgressBarProps {
  percentage: number;
  color?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  color = '#ff6b00',
  showText = true,
  size = 'md',
  className = '',
}) => {
  const clamped = Math.min(100, Math.max(0, percentage));

  const heightMap = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className={`w-full ${className}`}>
      {showText && (
        <div className="flex justify-between items-center text-xs font-semibold mb-1.5 text-slate-600 dark:text-zinc-400">
          <span>Progress</span>
          <span className="font-mono text-slate-900 dark:text-zinc-100 font-bold">{clamped}%</span>
        </div>
      )}
      <div
        className={`w-full bg-slate-200/80 dark:bg-zinc-800/90 rounded-full overflow-hidden ${heightMap[size]} p-0.5 border border-slate-300/40 dark:border-zinc-700/50`}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ backgroundColor: color }}
          className="h-full rounded-full shadow-sm transition-all"
        />
      </div>
    </div>
  );
};
