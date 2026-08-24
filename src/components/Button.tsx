import React from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-extrabold shadow-md shadow-orange-500/20',
  secondary:
    'bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold border border-slate-200 dark:border-zinc-700',
  ghost:
    'bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-semibold',
  danger:
    'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold border border-red-500/30',
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'py-1.5 px-3 text-xs rounded-lg gap-1.5',
  md: 'py-2.5 px-4 text-xs rounded-xl gap-2',
  lg: 'py-3 px-6 text-sm rounded-2xl gap-2',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...rest
}) => (
  <button
    disabled={disabled || isLoading}
    className={`inline-flex items-center justify-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed ${
      VARIANT_CLASSES[variant]
    } ${SIZE_CLASSES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    {...rest}
  >
    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
    {children}
  </button>
);
