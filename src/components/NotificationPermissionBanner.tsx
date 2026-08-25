/**
 * TU DU — Notification Permission Banner (Phase 10)
 *
 * Native-styled frosted banner shown once (re-asks at most every 3 days)
 * while browser permission is still 'default'. One tap enables reminders;
 * dismissal is remembered. Renders nothing when permission is already
 * granted/denied or the Notifications API is unsupported.
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X } from 'lucide-react';
import {
  dismissPermissionBanner,
  requestNotificationPermission,
  shouldShowPermissionBanner,
} from '../lib/notificationManager';

export const NotificationPermissionBanner: React.FC = () => {
  const [visible, setVisible] = React.useState<boolean>(() => shouldShowPermissionBanner());
  const [isRequesting, setIsRequesting] = React.useState(false);

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

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          role="status"
          className="max-w-3xl mx-auto mb-3 flex items-center gap-3 p-3 rounded-2xl border border-orange-500/30 shadow-md shadow-orange-500/10
                     bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl"
        >
          <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-md shadow-orange-500/25">
            <Bell className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-white">Never miss a deadline</p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug">
              Enable notifications to get alerts when tasks become due — even in the background.
            </p>
          </div>

          <button
            type="button"
            onClick={handleEnable}
            disabled={isRequesting}
            className="shrink-0 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-colors cursor-pointer active:scale-95"
          >
            {isRequesting ? '…' : 'Enable'}
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            title="Not now"
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
