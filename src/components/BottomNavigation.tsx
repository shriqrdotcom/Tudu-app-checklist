import React from 'react';
import { LayoutGrid, PlusCircle, User } from 'lucide-react';
import { motion } from 'motion/react';
import { ViewTab } from '../types';

interface BottomNavigationProps {
  activeTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onSelectTab }) => {
  const navItems = [
    { id: 'dashboard' as ViewTab, label: 'Progress', icon: LayoutGrid },
    { id: 'create' as ViewTab, label: 'Add', icon: PlusCircle, isPrimary: true },
    { id: 'profile' as ViewTab, label: 'Profile', icon: User },
  ];

  return (
    <div className="fixed bottom-4 inset-x-0 z-40 flex justify-center px-4 pointer-events-none pb-safe">
      <nav
        id="glass-bottom-nav"
        className="pointer-events-auto relative flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-full glass-panel shadow-2xl shadow-orange-900/10 dark:shadow-black/60 border border-white/40 dark:border-zinc-800/80 transition-all duration-300 max-w-md w-full justify-around"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          if (item.isPrimary) {
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                id={`nav-btn-${item.id}`}
                aria-label="Add new"
                className="relative flex flex-col items-center justify-center p-2 rounded-full text-white bg-gradient-to-tr from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 orange-glow active:scale-95 transition-all cursor-pointer -mt-4 shadow-lg shadow-orange-500/30"
              >
                <PlusCircle className="w-6 h-6 stroke-[2.2]" />
                <span className="sr-only">Create New</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              id={`nav-btn-${item.id}`}
              aria-label={item.label}
              className={`relative flex flex-col items-center justify-center py-1.5 px-5 rounded-2xl text-xs font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'text-orange-600 dark:text-orange-400 font-bold'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              {/* Active Background Pill Animation */}
              {isActive && (
                <motion.div
                  layoutId="active-nav-pill"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="absolute inset-0 bg-orange-500/10 dark:bg-orange-500/20 rounded-xl -z-10 border border-orange-500/20"
                />
              )}

              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2] text-orange-500' : 'stroke-[1.8]'}`} />
              <span className="text-[11px] mt-0.5 tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
