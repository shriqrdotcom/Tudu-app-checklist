/**
 * TU DU — Overdue Alarm Modal (Phase 11)
 *
 * High-priority glassmorphic alert fired the moment a deadline expires
 * while the app is in the foreground:
 *   • Task title + description + project chip
 *   • Urgent line: "Time is up! Complete this task now."
 *   • Actions: ✅ Mark Complete Now  ·  ⏰ Snooze 5 Min
 *
 * Vibration is triggered by the timer engine at fire time (single source of
 * truth) so this modal stays a pure, side-effect-free view.
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BellRing } from 'lucide-react';
import { ProgressProject, ProgressTask } from '../types';
import { Button } from './Button';
import { formatDueAbsolute, getSyncedNow, remainingTime } from '../lib/timeUtils';

interface OverdueAlarmModalProps {
  task: ProgressTask | null;
  /** Optional project context (accent color + name). */
  project?: ProgressProject | null;
  onMarkDone: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
}

export const OverdueAlarmModal: React.FC<OverdueAlarmModalProps> = ({
  task,
  project,
  onMarkDone,
  onSnooze,
  onDismiss,
}) => {
  // Live per-second "overdue by" readout while the modal is on screen
  const [nowTick, setNowTick] = React.useState(() => getSyncedNow());
  React.useEffect(() => {
    if (!task) return;
    const timer = window.setInterval(() => setNowTick(getSyncedNow()), 1_000);
    return () => window.clearInterval(timer);
  }, [task]);

  const live = task ? remainingTime(task.due_datetime ?? null, nowTick) : null;
  const overdueLabel = live
    ? live.hours >= 1
      ? `${live.hours}h ${live.minutes}m ${live.seconds}s`
      : live.minutes >= 1
        ? `${live.minutes}m ${live.seconds}s`
        : `${live.seconds}s`
    : '—';

  return (
    <AnimatePresence>
      {task && (
        <motion.div
          key="alarm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 pb-24 sm:pb-4"
          onClick={onDismiss}
          role="alertdialog"
          aria-modal="true"
          aria-label={`Task due now: ${task.title}`}
        >
          <motion.div
            key="alarm-card"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm relative overflow-hidden rounded-3xl border border-orange-500/50 dark:border-orange-500/40 shadow-2xl shadow-orange-600/30 ring-1 ring-orange-500/25
                       bg-white/80 dark:bg-zinc-950/85 backdrop-blur-xl"
          >
            {/* Pulsing glow accent bar */}
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-orange-600 via-amber-400 to-orange-600 animate-pulse" />

            <div className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  {/* Neon halo behind the bell */}
                  <span
                    className="absolute -inset-1 rounded-2xl bg-orange-500/50 blur-lg animate-pulse"
                    aria-hidden="true"
                  />
                  <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/40">
                    <BellRing className="w-6 h-6" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-orange-500">
                    TU DU ★ Alert · Due Now!
                  </p>
                  <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white break-words leading-snug mt-0.5">
                    {task.title}
                  </h3>
                  {project && (
                    <span
                      className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: project.accent_color || '#ff6b00' }}
                    >
                      {project.title}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              {task.description ? (
                <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-300 break-words">
                  {task.description}
                </p>
              ) : null}

              {/* Urgent banner */}
              <div className="rounded-2xl bg-red-500/10 dark:bg-red-500/10 border border-red-500/40 p-3">
                <p className="text-xs font-black text-red-500 dark:text-red-400 animate-pulse">
                  Time is up! Complete this task now.
                </p>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mt-1">
                  Scheduled for {task ? formatDueAbsolute(task.due_datetime || '') : ''} — overdue by{' '}
                  <span className="font-black text-red-500 dark:text-red-400 tabular-nums">
                    {overdueLabel}
                  </span>
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <Button fullWidth onClick={onMarkDone}>
                  ✅ Mark Complete Now
                </Button>
                <Button variant="secondary" fullWidth onClick={onSnooze}>
                  ⏰ Snooze 5 Min
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
