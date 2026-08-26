/**
 * TU DU — Notification Permission Banner (Phase 10)
 *
 * Native-styled frosted banner shown once (re-asks at most every 3 days)
 * while browser permission is still 'default'. One tap enables reminders;
 * dismissal is remembered. Renders nothing when permission is already
 * granted/denied or the Notifications API is unsupported.
 * When permission is 'denied', shows a helpful static banner with instructions
 * to enable notifications in browser settings.
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, ExternalLink } from 'lucide-react';
import {
  dismissPermissionBanner,
  requestNotificationPermission,
  shouldShowPermissionBanner,
  getNotificationPermission,
} from '../lib/notificationManager';

export const NotificationPermissionBanner: React.FC = () => {
  const [visible, setVisible] = React.useState<boolean>(() => shouldShowPermissionBanner());
  const [isRequesting, setIsRequesting] = React.useState(false);
  const permission = getNotificationPermission();

  // Show banner for 'default' (handled by shouldShowPermissionBanner) or 'denied'
  const shouldShow = permission === 'default' ? shouldShowPermissionBanner() : permission === 'denied';

  const handleEnable = async () => {
    try {
      setIsRequesting(true);
      const result = await requestNotificationPermission();
      // Banner disappears either way — granted shows a toast from App,
      // denied means we respect the choice (and stop asking for 3 days).
      dismissPermissionBanner();
      setVisible(false);
      if (result !== 'granted') console.info('[TU DU] Notification permission not granted:', result);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    dismissPermissionBanner();
    setVisible(false);
  };

  if (!shouldShow) return null;

  const isDenied = permission === 'denied';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          role="status"
          className="max-w-3xl mx-auto mb-3 flex items-start gap-3 p-3 rounded-2xl border shadow-md
                     bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl"
          style={isDenied
            ? { borderColor: 'rgb(163 230 53 / 0.4)', boxShadow: '0 0 0 1px rgb(163 230 53 / 0.2)' }
            : { borderColor: 'rgb(249 115 22 / 0.3)', boxShadow: '0 4px 6px -1px rgb(249 115 22 / 0.1)' }}
        >
          <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center shadow-md ${
            isDenied
              ? 'bg-lime-500/20 text-lime-600 dark:text-lime-400'
              : 'bg-gradient-to-tr from-orange-600 to-amber-500 text-white'
          }`}>
            <Bell className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold ${isDenied ? 'text-lime-700 dark:text-lime-300' : 'text-slate-900 dark:text-white'}`}>
              {isDenied ? 'Notifications are blocked' : 'Never miss a deadline'}
            </p>
            <p className={`text-[11px] leading-snug ${isDenied ? 'text-lime-700/80 dark:text-lime-300/80' : 'text-slate-500 dark:text-zinc-400'}`}>
              {isDenied
                ? 'To receive reminders, enable notifications for TU DU in your browser settings, then refresh this page.'
                : 'Enable notifications to get alerts when tasks become due — even in the background.'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isDenied ? (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  // Open browser settings — best effort
                  if (typeof window !== 'undefined' && 'navigator' in window) {
                    // Can't directly open settings, but we can guide
                    alert('Open your browser settings (usually via the lock icon in the address bar) → Notifications → Allow for this site.');
                  }
                }}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-lime-500 hover:bg-lime-600 text-white font-bold text-xs shadow-md shadow-lime-500/20 transition-colors cursor-pointer active:scale-95"
              >
                How to enable
              </a>
            ) : (
              <button
                type="button"
                onClick={handleEnable}
                disabled={isRequesting}
                className="shrink-0 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-colors cursor-pointer active:scale-95"
              >
                {isRequesting ? '…' : 'Enable'}
              </button>
            )}

            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss"
              title="Not now"
              className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
