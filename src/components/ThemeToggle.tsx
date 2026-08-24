import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { motion } from 'motion/react';
import { ThemeMode } from '../types';

interface ThemeToggleProps {
  theme: ThemeMode;
  onToggle: () => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onToggle }) => {
  const isDark = theme === 'dark';

  return (
    <button
      onClick={onToggle}
      id="theme-toggle-btn"
      aria-label="Toggle visual theme"
      className="relative flex items-center justify-between w-14 h-8 px-1 rounded-full bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50 cursor-pointer shadow-inner"
    >
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`w-6 h-6 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white shadow-md ${
          isDark ? 'translate-x-6' : 'translate-x-0'
        }`}
      >
        {isDark ? (
          <Moon className="w-3.5 h-3.5 text-zinc-900 fill-zinc-900" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-white fill-white" />
        )}
      </motion.div>
    </button>
  );
};
