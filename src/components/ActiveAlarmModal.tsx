/**
 * TU DU — Active Alarm Modal (Phase 13)
 *
 * High-priority frosted-glass alert that stays on screen while the infinite
 * audio/vibration loop runs. Three explicit interventions:
 *
 *   🛑 Stop Alarm   — silence immediately; task REMAINS overdue in the list
 *   ✅ Mark Complete — silence + persist is_completed = true
 *   ⏰ Snooze 5 Min  — silence + due_datetime += 5 minutes (re-arms alarm)
 *
 * Focus is locked to the dialog: Escape and backdrop taps route to the least
 * destructive action (Stop Alarm) so nothing is ever lost by accident.
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BellRing } from 'lucide-react';
import { ProgressProject, ProgressTask } from '../types';
import { Button } from './Button';
import { formatDueAbsolute, getSyncedNow, remainingTime } from '../lib/timeUtils';

interface ActiveAlarmModalProps {
  task: ProgressTask | null;
  /** Optional project context (accent color + name). */
  project?: ProgressProject | null;
  /** Silence audio/vibration only — task stays overdue. */
  onStopAlarm: () => void;
  /** Silence + mark complete in Supabase. */
  onMarkComplete: () => void;
  /** Silence + push due time 5 minutes into the future. */
  onSnooze: () => void;
}

export const ActiveAlarmModal: React.FC<ActiveAlarmModalProps> = ({
  task,
  project,
  onStopAlarm,
  onMarkComplete,
  onSnooze,
}) => {
  // Live per-second "overdue by" counter while ringing
  const [nowTick, setNowTick] = React.useState(() => getSyncedNow());
  React.useEffect(() => {
    if (!task) return;
    setNowTick(getSyncedNow());
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

  // Keyboard access: Escape performs the least-destructive intervention
  // (Stop Alarm — silence only, task stays overdue).
  React.useEffect(() => {
    if (!task) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onStopAlarm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [task, onStopAlarm]);

  return (
    <AnimatePresence>
      {task && (
        <motion.div
          key="alarm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-4 pb-24 sm:pb-4"
          onClick={onStopAlarm}
          role="alertdialog"
          aria-modal="true"
          aria-label={`Alarm: ${task.title} is overdue`}
        >
          <motion.div
            key="alarm-card"
            initial={{ opacity: 0, y: 40, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm relative overflow-hidden rounded-3xl border border-orange-500/60 dark:border-orange-500/50 shadow-2xl shadow-orange-600/40 ring-2 ring-orange-500/30
                       bg-white/85 dark:bg-zinc-950/90 backdrop-blur-xl"
          >
            {/* Pulsing neon accent bar */}
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-500 via-amber-400 to-red-500 animate-pulse" />

            <div className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <span
                    className="absolute -inset-1.5 rounded-2xl bg-orange-500/60 blur-lg animate-pulse"
                    aria-hidden="true"
                  />
                  <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/50 animate-pulse">
                    <BellRing className="w-6 h-6" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-orange-500">
                    TU DU ★ Alarm · Time's Up!
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

              {/* Live overdue counter */}
              <div className="rounded-2xl bg-red-500/10 dark:bg-red-500/15 border border-red-500/40 p-3 space-y-1">
                <p className="text-xs font-black text-red-500 dark:text-red-400">
                  ⚠️ Overdue by{' '}
                  <span className="tabular-nums text-sm">{overdueLabel}</span>
                </p>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                  Scheduled for {formatDueAbsolute(task.due_datetime || '')} · still pending.
                </p>
              </div>

              {/* Actions — stacked, large, unmissable */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  autoFocus
                  onClick={onStopAlarm}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-zinc-900 font-black text-sm shadow-lg active:scale-[0.98] transition-transform cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/50"
                >
                  🛑 Stop Alarm
                </button>

                <button
                  type="button"
                  onClick={onMarkComplete}
                  className="w-full px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/40"
                >
                  ✅ Mark Complete
                </button>

                <button
                  type="button"
                  onClick={onSnooze}
                  className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-orange-500/50 text-orange-600 dark:text-orange-400 font-black text-sm hover:bg-orange-500/10 active:scale-[0.98] transition-all cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/40"
                >
                  ⏰ Snooze 5 Min
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
