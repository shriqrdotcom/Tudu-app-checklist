/**
 * TU DU — Due-date helpers.
 *
 * Since Phase 12 all PURE time math lives in `lib/timeUtils.ts` (single
 * audited source, server-synced clock). This module keeps the scheduling-
 * domain pieces (presets) and re-exports shared helpers under their
 * historical names so existing call sites keep working unchanged.
 */

export {
  // conversions
  toUtcIsoFromLocal,
  isoToDatetimeLocalValue as toDatetimeLocalValue,
  datetimeLocalValueToIso,
  splitIntoClockParts,
  // math & formatting
  parseInstant,
  remainingTime,
  formatCountdownLabel as formatDueCountdown,
  formatDueAbsolute,
  getSyncedNow,
  isClockSyncTrusted,
} from './timeUtils';

import { formatCountdownLabel } from './timeUtils';

/** The quick-select presets offered in the scheduling UI. */
export type DuePresetKind = '15m' | '30m' | '1h' | 'evening' | 'tomorrow9';

export interface DuePreset {
  kind: DuePresetKind;
  /** Chip label, e.g. "+15 Mins". */
  label: string;
}

export const DUE_PRESETS: DuePreset[] = [
  { kind: '15m', label: '+15m' },
  { kind: '30m', label: '+30m' },
  { kind: '1h', label: '+1 hr' },
  { kind: 'evening', label: 'Today 6 PM' },
  { kind: 'tomorrow9', label: 'Tomorrow 9 AM' },
];

/** Resolve a preset into a concrete Date (evaluated at tap time). */
export function resolvePreset(kind: DuePresetKind, from: Date = new Date()): Date {
  const d = new Date(from.getTime());
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

/**
 * Legacy object-shape helper kept for compatibility:
 * returns the countdown label string directly.
 */
export interface DueBadgeInfoLegacy {
  label: string;
  overdue: boolean;
}
export function formatDueBadgeInfo(dueIso: string, nowMs?: number): DueBadgeInfoLegacy {
  const label = formatCountdownLabel(dueIso, nowMs);
  return { label, overdue: label.startsWith('⚠️') };
}
