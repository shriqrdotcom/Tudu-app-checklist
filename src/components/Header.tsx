import React from 'react';
import { Sparkles, User, Database, CheckCircle2 } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { ThemeMode, UserProfile } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';

interface HeaderProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  user: UserProfile | null;
  onOpenAuth: () => void;
  onOpenSettings: () => void;
  contextTitle?: string;
  onBrandClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  onToggleTheme,
  user,
  onOpenAuth,
  onOpenSettings,
  contextTitle,
  onBrandClick,
}) => {
  const isSupabaseLive = isSupabaseConfigured();

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/80 dark:bg-zinc-900/80 border-b border-slate-200/80 dark:border-zinc-800/80 transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Branding & Context */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBrandClick}
            id="brand-logo-btn"
            className="group flex items-center gap-1.5 focus:outline-none cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            <div className="flex items-baseline gap-1 font-black text-xl sm:text-2xl tracking-tight text-slate-900 dark:text-white">
              TU DU
              <span className="text-orange-500 font-bold text-lg sm:text-xl leading-none">★</span>
            </div>
          </button>

          {contextTitle && (
            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-300 dark:border-zinc-700">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                View:
              </span>
              <span className="text-sm font-medium text-slate-700 dark:text-zinc-200 truncate max-w-[200px]">
                {contextTitle}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Supabase Status Badge */}
          <button
            onClick={onOpenSettings}
            title={isSupabaseLive ? 'Connected to live Supabase Backend' : 'Running in Local Persistent Mode (Click to connect Supabase)'}
            id="supabase-status-badge"
            className={`hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all ${
              isSupabaseLive
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30 hover:bg-orange-500/20'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>{isSupabaseLive ? 'Supabase Live' : 'Local + Supabase SQL'}</span>
          </button>

          {/* Theme Toggle */}
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />

          {/* User Profile Avatar / Sign In */}
          <button
            onClick={user ? onOpenSettings : onOpenAuth}
            id="user-profile-btn"
            className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500/40 cursor-pointer"
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover border border-slate-300 dark:border-zinc-700"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 font-bold text-xs border border-slate-300 dark:border-zinc-700">
                {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
              </div>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
