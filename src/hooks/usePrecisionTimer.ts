/**
 * TU DU — Precision Alarm Timer Hook (Phase 12)
 *
 * Fixes the two real accuracy killers of naive `setInterval` engines:
 *
 *  1. CLOCK SOURCE — every comparison uses getSyncedNow() (device clock
 *     corrected against Supabase server time), so a skewed system clock
 *     can never fire alarms early/late.
 *
 *  2. INTERVAL DRIFT & BACKGROUND THROTTLING — browsers clamp background
 *     timers to ≥1/min (Chrome intensive throttling: worse). Instead of
 *     trusting tick counts we:
 *       • re-anchor each tick via performance.now() deltas and compute our
 *         actual skew vs expected cadence;
 *       • schedule a TARGETED one-shot wake at the earliest pending deadline
 *         (clamped to ≤30s) so the alarm lands on the exact second even when
 *         periodic ticks are throttled;
 *       • sweep immediately on visibilitychange / focus / online, which
 *         catches up anything throttled while hidden.
 *
 * Deduplication (strictly once per deadline):
 *   • firedKeysRef Set keyed `${taskId}:${effectiveIso}` guards within session
 *   • markTriggered → optimistic `notified` latch persisted to Supabase,
 *     guarding across reloads/devices
 *   • snooze rewrites snooze_until → NEW effective instant → exactly one
 *     legitimate future re-arm
 *   • deadlines already >60s stale on first sighting latch silently (no
 *     notification storms after login)
 */

import { useEffect, useRef } from 'react';
import { ProgressTask } from '../types';
import {
  areNotificationsSupported,
  getNotificationPermission,
  OVERDUE_VIBRATION_PATTERN,
  playAlertChime,
  showOverdueNotification,
  vibrate,
} from '../lib/notificationManager';
import { getSyncedNow, parseInstant } from '../lib/timeUtils';

/** Verification cadence while foregrounded. */
const BASE_TICK_MS = 1_000;
/** Longest silence between sweeps even when nothing is imminent. */
const MAX_IDLE_MS = 30_000;
/** Deadlines already expired longer than this on first sight latch silently. */
const GRACE_SILENT_MS = 60_000;

export interface UsePrecisionTimerOptions {
  tasks: ProgressTask[];
  enabled: boolean;
  /** Called once per newly-due task → opens the in-app alarm modal queue. */
  onAlarm: (task: ProgressTask) => void;
  /** Persist alert-triggered flag (optimistic UI + Supabase write). */
  markTriggered: (taskId: string) => void;
}

/** Effective deadline = max(due_datetime, snooze_until). */
function effectiveDeadlineMs(task: ProgressTask): number | null {
  const due = parseInstant(task.due_datetime);
  if (due == null) return null;
  const snooze = parseInstant(task.snooze_until) ?? 0;
  return Math.max(due, snooze);
}

export function usePrecisionTimer({ tasks, enabled, onAlarm, markTriggered }: UsePrecisionTimerOptions): void {
  // Latest data/handlers without tearing down the engine on every render
  const tasksRef = useRef(tasks);
  const onAlarmRef = useRef(onAlarm);
  const markTriggeredRef = useRef(markTriggered);
  useEffect(() => {
    tasksRef.current = tasks;
    onAlarmRef.current = onAlarm;
    markTriggeredRef.current = markTriggered;
  }, [tasks, onAlarm, markTriggered]);

  const firedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;

    let perfAnchor = performance.now();
    let wallAnchor = getSyncedNow();
    let verificationTimer: number | undefined;
    let targetedWake: number | undefined;

    const sweep = () => {
      const now = getSyncedNow();

      for (const task of tasksRef.current) {
        if (!task.due_datetime || task.is_completed || task.notified) continue;
        if (task.id.startsWith('optimistic-')) continue;

        const effectiveMs = effectiveDeadlineMs(task);
        if (effectiveMs == null || now < effectiveMs) continue;

        // ---- DEDUPE #1: strictly once per effective instant ----
        const key = `${task.id}:${new Date(effectiveMs).toISOString()}`;
        if (firedKeysRef.current.has(key)) continue;
        firedKeysRef.current.add(key);

        // ---- STORM GUARD: long-stale deadlines latch silently ----
        if (now - effectiveMs > GRACE_SILENT_MS) {
          markTriggeredRef.current(task.id);
          continue;
        }

        // ---- FIRE ----
        markTriggeredRef.current(task.id); // latch before any async work

        vibrate(OVERDUE_VIBRATION_PATTERN);

        const isForeground =
          typeof document !== 'undefined' &&
          document.visibilityState === 'visible' &&
          document.hasFocus();

        if (isForeground) {
          playAlertChime();
          onAlarmRef.current(task);
        } else if (
          areNotificationsSupported() &&
          getNotificationPermission() === 'granted'
        ) {
          void showOverdueNotification({
            task: { id: task.id, title: task.title },
            dueIso: new Date(effectiveMs).toISOString(),
          });
          onAlarmRef.current(task); // greets the user when they return
        } else {
          onAlarmRef.current(task);
        }
      }
    };

    /** Schedule a one-shot wake exactly at the earliest pending deadline. */
    const scheduleTargetedWake = () => {
      window.clearTimeout(targetedWake);
      const now = getSyncedNow();
      let earliest = Infinity;

      for (const task of tasksRef.current) {
        if (!task.due_datetime || task.is_completed || task.notified) continue;
        if (task.id.startsWith('optimistic-')) continue;
        const eff = effectiveDeadlineMs(task);
        if (eff != null && eff > now && eff < earliest) earliest = eff;
      }

      if (earliest !== Infinity) {
        const delay = Math.min(Math.max(earliest - now + 250, 250), MAX_IDLE_MS);
        targetedWake = window.setTimeout(() => {
          sweep();
          scheduleTargetedWake(); // chain to the next deadline
        }, delay);
      }
    };

    /**
     * Drift-compensated verification loop.
     * Measures real elapsed time against intended cadence using
     * performance.now() and corrects the NEXT delay by the measured skew —
     * so throttled/background intervals self-correct instead of accumulating
     * error, while wall-time comparisons keep alarms honest.
     */
    const verificationLoop = () => {
      const perfNow = performance.now();
      const elapsedPerf = perfNow - perfAnchor;
      const elapsedWall = getSyncedNow() - wallAnchor;

      // Skew between monotonic clock and (synced) wall clock since anchor
      const skewMs = elapsedWall - elapsedPerf;
      // Re-anchor for the next cycle
      perfAnchor = perfNow;
      wallAnchor = getSyncedNow();

      // Correct next delay: if ticks were stretched (throttled), shorten it
      const driftCorrection = Math.min(Math.max(skewMs, -BASE_TICK_MS / 2), BASE_TICK_MS);
      const nextDelay = Math.max(250, BASE_TICK_MS - driftCorrection);

      sweep();
      scheduleTargetedWake();
      verificationTimer = window.setTimeout(verificationLoop, nextDelay);
    };

    // Kick everything off with an immediate catch-up sweep
    sweep();
    scheduleTargetedWake();
    verificationTimer = window.setTimeout(verificationLoop, BASE_TICK_MS);

    // Instant catch-up on tab return / focus / network recovery
    const onCatchUp = () => {
      sweep();
      scheduleTargetedWake();
    };
    document.addEventListener('visibilitychange', onCatchUp);
    window.addEventListener('focus', onCatchUp);
    window.addEventListener('online', onCatchUp);

    return () => {
      window.clearTimeout(verificationTimer);
      window.clearTimeout(targetedWake);
      document.removeEventListener('visibilitychange', onCatchUp);
      window.removeEventListener('focus', onCatchUp);
      window.removeEventListener('online', onCatchUp);
    };
  }, [enabled]);
}
