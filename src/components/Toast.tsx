import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ToastMessage } from '../types';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed top-20 right-4 left-4 sm:left-auto z-[60] flex flex-col items-end gap-2 max-w-sm w-full sm:w-full pointer-events-none"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            className="pointer-events-auto w-full flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl overflow-hidden"
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" aria-hidden="true" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" aria-hidden="true" />}

            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-bold text-slate-900 dark:text-white">{toast.title}</h5>
              {toast.description && (
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-tight">
                  {toast.description}
                </p>
              )}
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              aria-label={`Dismiss "${toast.title}" notification`}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
