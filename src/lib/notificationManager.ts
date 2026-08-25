/**
 * TU DU — Notification & Haptics Manager (Phase 10)
 *
 * Central, side-effect-safe wrappers for:
 *  - The Vibration API (haptic feedback: micro-buzz + overdue pattern)
 *  - The Notification API (permission handling)
 *  - Service-Worker-backed system notifications (visible when tab is hidden)
 *  - A tiny WebAudio alert chime (no asset needed, fails silently)
 *
 * Every function degrades gracefully on browsers that lack support —
 * notifications/haptics are enhancements, never a crash path.
 */

import { ProgressTask } from '../types';

// ============================================================
// HAPTIC FEEDBACK (Vibration API)
// ============================================================

/** Subtle confirmation tick for small interactions (complete, filter taps). */
export const MICRO_BUZZ = 15;

/**
 * Deadline-missed haptic signature (Phase 11):
 * buzz → pause → buzz → pause → LONG buzz.
 */
export const OVERDUE_VIBRATION_PATTERN: number[] = [300, 150, 300, 150, 600];

/** Fire a vibration pattern if the device supports it. Never throws. */
export function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* vibration unsupported/blocked — silent no-op */
  }
}

/** Convenience: one subtle micro-buzz for light interactions. */
export function microBuzz(): void {
  vibrate(MICRO_BUZZ);
}

// ============================================================
// NOTIFICATION PERMISSION
// ============================================================

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export function areNotificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Current permission state; 'unsupported' where the API is missing. */
export function getNotificationPermission(): NotificationPermissionState {
  if (!areNotificationsSupported()) return 'unsupported';
  return Notification.permission as NotificationPermissionState;
}

/**
 * Ask the user for notification permission (MUST be called from a user
 * gesture — e.g. the "Enable" tap on the in-app banner).
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!areNotificationsSupported()) return 'unsupported';
  try {
    return (await Notification.requestPermission()) as NotificationPermissionState;
  } catch {
    return 'denied';
  }
}

// ------------------------------------------------------------
// Permission-banner dismissal persistence.
// If the user declines the in-app banner we stay quiet for 3 days
// instead of nagging on every launch.
// ------------------------------------------------------------

const BANNER_DISMISS_KEY = 'tudu_notif_banner_dismissed_v1';
const BANNER_REASK_MS = 3 * 24 * 60 * 60 * 1000;

export function shouldShowPermissionBanner(): boolean {
  if (!areNotificationsSupported()) return false;
  if (Notification.permission !== 'default') return false;
  try {
    const until = Number(localStorage.getItem(BANNER_DISMISS_KEY) || 0);
    return Date.now() > until;
  } catch {
    return true;
  }
}

export function dismissPermissionBanner(): void {
  try {
    localStorage.setItem(BANNER_DISMISS_KEY, String(Date.now() + BANNER_REASK_MS));
  } catch {
    /* private mode — banner simply reappears next session */
  }
}

// ============================================================
// SYSTEM NOTIFICATIONS (via Service Worker registration)
// ============================================================

const APP_ICON = '/brand/icons/icon-192.png';
const APP_BADGE = '/brand/icons/icon-192.png';

export interface OverdueNotificationInput {
  task: Pick<ProgressTask, 'id' | 'title'>;
  /** ISO instant the deadline (or snooze) expired. */
  dueIso: string;
}

/**
 * Show a native OS notification through the service worker (preferred —
 * works while the tab is hidden and supports click-to-focus), falling back
 * to the page-side Notification constructor when no SW controller exists.
 *
 * Title format (exact): `TU DU ★ Alert: [Task Title] is due now!`
 */
export async function showOverdueNotification(input: OverdueNotificationInput): Promise<void> {
  const { task, dueIso } = input;
  const title = `TU DU ★ Alert: ${task.title} is due now!`;
  const body = `"${task.title}" was scheduled for ${formatClock(dueIso)} and is still pending.`;
  // OS-level dedupe: re-showing replaces instead of stacking duplicates
  const tag = `tudu-overdue-${task.id}`;

  if (!areNotificationsSupported() || Notification.permission !== 'granted') return;

  try {
    const reg =
      typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        ? await navigator.serviceWorker.getRegistration()
        : undefined;

    if (reg) {
      await reg.showNotification(title, {
        body,
        tag,
        icon: APP_ICON,
        badge: APP_BADGE,
        // Reminders behave like alarms: keep visible until handled
        requireInteraction: true,
        data: { taskId: task.id },
      });
      return;
    }

    // Legacy fallback (no SW registered yet)
    new Notification(title, { body, tag, icon: APP_ICON });
  } catch (err) {
    console.warn('[TU DU] System notification failed:', err);
  }
}

function formatClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return 'the scheduled time';
  }
}

// ============================================================
// ALERT CHIME (WebAudio — zero assets, best-effort)
// ============================================================

let audioCtx: AudioContext | null = null;

/**
 * Alarm ping — audible even when the user is looking away.
 * Three urgent two-tone bursts (Web Audio, zero assets). Browsers may block
 * audio without prior user interaction — every failure is swallowed so this
 * can be called freely from timers.
 */
export function playAlertChime(): void {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }
    const ctx = audioCtx!;
    const t0 = ctx.currentTime;

    // 3 bursts × (high blip + low blip) — unmistakably an alarm, not a chime
    const bursts = [0, 0.45, 0.9];
    bursts.forEach((burstStart) => {
      [
        { freq: 987.77, offset: burstStart, dur: 0.16 }, // B5
        { freq: 659.25, offset: burstStart + 0.18, dur: 0.22 }, // E5
      ].forEach(({ freq, offset, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + offset);
        gain.gain.exponentialRampToValueAtTime(0.14, t0 + offset + 0.02);
        gain.gain.setValueAtTime(0.14, t0 + offset + dur - 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0 + offset);
        osc.stop(t0 + offset + dur + 0.02);
      });
    });
  } catch {
    /* autoplay policy / unsupported — silent no-op */
  }
}
