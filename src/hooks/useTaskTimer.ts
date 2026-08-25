/**
 * TU DU — Task Timer & Alarm Engine Hook (Phase 11)
 *
 * A lightweight 1-second interval loop that guarantees alarms fire at the
 * EXACT second the user picked:
 *
 *   • Every tick scans the live task list (via refs — zero re-renders/tick)
 *     for tasks where: due_datetime exists, is_completed === false,
 *     notified === false, and effectiveDeadline = max(due_datetime,
 *     snooze_until) <= now.
 *
 *   • Safeguards against multiple/looping triggers:
 *       1. firedKeysRef — session-scoped Set of `${taskId}:${effectiveIso}`;
 *          a task cannot fire twice for the same deadline even if state
 *          updates lag a tick.
 *       2. markTriggered() optimistically flips `notified` in app state and
 *          persists to Supabase, so reloads/other tabs stay quiet.
 *       3. Snoozing rewrites snooze_until → new effective instant → new key,
 *          which legitimately re-arms exactly one future alarm.
 *       4. Storm guard: deadlines already >60s stale on first sighting
 *          (fresh login with old overdue items) are latched silently.
 *
 *   • Routing per fire:
 *       foreground (visible + focused) → vibration + alarm audio + onAlarm()
 *       background + permission granted → native OS notification + haptics
 *                                         (+ queued in-app alert for return)
 *       otherwise                       → in-app queue only
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

/** Exactness: check every second so alarms land on the chosen second. */
const CHECK_INTERVAL_MS = 1_000;
/** Deadlines already expired longer than this on first sight latch silently. */
const GRACE_SILENT_MS = 60_000;

export interface UseTaskTimerOptions {
  /** Live task list from app state. */
  tasks: ProgressTask[];
  /** Engine runs only when true (user signed in). */
  enabled: boolean;
  /** Called once per newly-due task → opens the in-app alarm modal queue. */
  onAlarm: (task: ProgressTask) => void;
  /** Persist alert-triggered flag (optimistic UI + Supabase write). */
  markTriggered: (taskId: string) => void;
}

export function useTaskTimer({ tasks, enabled, onAlarm, markTriggered }: UseTaskTimerOptions): void {
  // Latest data/handlers without recreating the interval every render
  const tasksRef = useRef(tasks);
  const onAlarmRef = useRef(onAlarm);
  const markTriggeredRef = useRef(markTriggered);
  useEffect(() => {
    tasksRef.current = tasks;
    onAlarmRef.current = onAlarm;
    markTriggeredRef.current = markTriggered;
  }, [tasks, onAlarm, markTriggered]);

  // Session-scoped trigger ledger: `${taskId}:${effectiveIso}` per fired alarm
  const firedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      const now = Date.now();

      for (const task of tasksRef.current) {
        if (!task.due_datetime || task.is_completed || task.notified) continue;
        if (task.id.startsWith('optimistic-')) continue; // not persisted yet

        const dueMs = Date.parse(task.due_datetime);
        if (Number.isNaN(dueMs)) continue;
        const snoozeMs = task.snooze_until ? Date.parse(task.snooze_until) : 0;
        const effectiveMs = Math.max(dueMs, Number.isNaN(snoozeMs) ? 0 : snoozeMs);
        if (now < effectiveMs) continue; // still waiting

        // ---- SAFEGUARD #1: session dedupe by exact effective instant ----
        const key = `${task.id}:${new Date(effectiveMs).toISOString()}`;
        if (firedKeysRef.current.has(key)) continue;
        firedKeysRef.current.add(key);

        // ---- SAFEGUARD #4: silent latch for long-stale deadlines ----
        if (now - effectiveMs > GRACE_SILENT_MS) {
          markTriggeredRef.current(task.id);
          continue;
        }

        // ---- FIRE ----
        markTriggeredRef.current(task.id); // latches before anything async

        // Haptics first (works even if audio is blocked): buzz-buzz-LOOONG
        vibrate(OVERDUE_VIBRATION_PATTERN);

        const isForeground =
          typeof document !== 'undefined' &&
          document.visibilityState === 'visible' &&
          document.hasFocus();

        if (isForeground) {
          // Audible alarm ping + interactive glass modal
          playAlertChime();
          onAlarmRef.current(task);
        } else if (
          areNotificationsSupported() &&
          getNotificationPermission() === 'granted'
        ) {
          // Tab in background: native OS notification ("...is due now!")
          void showOverdueNotification({
            task: { id: task.id, title: task.title },
            dueIso: new Date(effectiveMs).toISOString(),
          });
          // Also queue in-app so it greets the user on return
          onAlarmRef.current(task);
        } else {
          // No permission / unsupported: in-app alert when they come back
          onAlarmRef.current(task);
        }
      }
    };

    tick(); // immediate sweep on start/re-enable
    const interval = window.setInterval(tick, CHECK_INTERVAL_MS);

    // Instant catch-up when the tab becomes visible again
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);
}
