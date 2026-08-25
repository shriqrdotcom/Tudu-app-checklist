/**
 * TU DU — Due-date helpers shared by the picker, task cards and alerts.
 */

/** The quick-select presets offered in the scheduling UI. */
export type DuePresetKind = '15m' | '30m' | '1h' | 'evening' | 'tomorrow9';

export interface DuePreset {
  kind: DuePresetKind;
  /** Chip label, e.g. "+15 Mins". */
  label: string;
}

export const DUE_PRESETS: DuePreset[] = [
  { kind: '15m', label: '+15 Mins' },
  { kind: '30m', label: '+30 Mins' },
  { kind: '1h', label: '+1 Hour' },
  { kind: 'evening', label: 'Today 6 PM' },
  { kind: 'tomorrow9', label: 'Tomorrow 9 AM' },
];

/** Resolve a preset into a concrete Date (evaluated at tap time). */
export function resolvePreset(kind: DuePresetKind, from: Date = new Date()): Date {
  const d = new Date(from);
  switch (kind) {
    case '15m':
      return new Date(d.getTime() + 15 * 60_000);
    case '30m':
      return new Date(d.getTime() + 30 * 60_000);
    case '1h':
      return new Date(d.getTime() + 60 * 60_000);
    case 'evening': {
      // Today 18:00 local; if that's already (nearly) past → tomorrow 18:00
      d.setHours(18, 0, 0, 0);
      if (d.getTime() - from.getTime() < 5 * 60_000) {
        d.setDate(d.getDate() + 1);
      }
      return d;
    }
    case 'tomorrow9': {
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    }
  }
}

/** Human-friendly absolute label, e.g. "Today, 6:00 PM" / "Tue, Jul 14 · 9:00 AM". */
export function formatDueAbsolute(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const sameDay = date.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (sameDay) return `Today · ${time}`;
    if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${time}`;
    return `${date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`;
  } catch {
    return '';
  }
}

export interface DueBadgeInfo {
  /** e.g. "⏳ Due in 14m 20s" / "⚠️ Overdue by 10m" */
  label: string;
  overdue: boolean;
}

/**
 * Live countdown badge text with SECOND granularity for the final hour.
 * Output shapes:
 *   future : "Due now" · "⏳ Due in 42s" · "⏳ Due in 14m 20s"
 *            "⏳ Due in 3h 12m" · "⏳ Due in 2d 5h"
 *   past   : "⚠️ Overdue by 10m" (escalates to h/d spans for old items)
 */
export function formatDueCountdown(dueIso: string, now: number = Date.now()): DueBadgeInfo {
  const dueMs = new Date(dueIso).getTime();
  if (Number.isNaN(dueMs)) return { label: 'Invalid date', overdue: false };

  let diff = dueMs - now;
  const overdue = diff < 0;
  const abs = Math.abs(diff);

  if (!overdue) {
    if (abs < 1_000) return { label: 'Due now', overdue: false };
    const totalSec = Math.floor(abs / 1_000);
    const totalMin = Math.floor(totalSec / 60);
    const hours = Math.floor(totalMin / 60);
    const days = Math.floor(hours / 24);

    if (days >= 2) return { label: `⏳ Due in ${days}d ${hours % 24}h`, overdue: false };
    if (totalMin >= 60) return { label: `⏳ Due in ${hours}h ${totalMin % 60}m`, overdue: false };
    if (totalSec >= 60) return { label: `⏳ Due in ${totalMin}m ${totalSec % 60}s`, overdue: false };
    return { label: `⏳ Due in ${totalSec}s`, overdue: false };
  }

  // Overdue — minute granularity and up
  const totalMin = Math.floor(abs / 60_000);
  const hours = Math.floor(totalMin / 60);
  const days = Math.floor(hours / 24);
  if (days >= 2) return { label: `⚠️ Overdue by ${days}d ${hours % 24}h`, overdue: true };
  if (totalMin >= 60) return { label: `⚠️ Overdue by ${hours}h ${totalMin % 60}m`, overdue: true };
  return { label: `⚠️ Overdue by ${Math.max(totalMin, 0) || '<1'}m`, overdue: true };
}

// ------------------------------------------------------------
// <input type="datetime-local"> converters.
// datetime-local values are "YYYY-MM-DDTHH:mm" in LOCAL time.
// ------------------------------------------------------------

export function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

export function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
