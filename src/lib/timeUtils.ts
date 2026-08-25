/**
 * TU DU — Canonical Time Utilities & Clock Synchronization (Phase 12)
 *
 * Single audited source of truth for EVERYTHING time-related:
 *
 *  1. SERVER CLOCK SYNC (NTP-lite)
 *     Browsers throttle timers and devices ship with skewed clocks. We learn
 *     the true epoch from the Supabase REST response `Date` header on every
 *     API call, estimate latency half-trip, and expose getSyncedNow().
 *     All alarm math uses this instead of raw Date.now(), so a device clock
 *     running 3 minutes fast can never fire alarms early.
 *
 *  2. LOCAL ⇄ UTC CONVERSION
 *     Writing: local wall-clock parts → UTC ISO string (Supabase TIMESTAMPTZ).
 *     Reading: TIMESTAMPTZ instant → exact local wall time. No double-shifts:
 *     we never construct naive strings and never mix UTC getters on local
 *     dates (the classic +5:30 / -1h drift bugs).
 *
 *  3. PRECISE REMAINING TIME
 *     Second-granularity { hours, minutes, seconds, isOverdue } breakdown
 *     plus human countdown labels used by badges and the alarm modal.
 */

// ============================================================
// 1) SERVER CLOCK SYNC
// ============================================================

let serverOffsetMs = 0; // serverEpoch ≈ Date.now() + offset
let syncSamples = 0;
const MIN_SAMPLES_BEFORE_TRUST = 1;
/** Offsets smaller than this are indistinguishable from network jitter. */
const TRUST_THRESHOLD_MS = 2_000;

/**
 * Record a latency-compensated sample from an HTTP `Date` response header
 * (second resolution → ±500ms inherent precision, refined by latency split).
 * Called automatically by the Supabase client fetch wrapper.
 */
export function recordServerTimeSample(response: Response, startedAtMs: number): void {
  try {
    const header = response.headers.get('date');
    if (!header) return;
    const headerMs = Date.parse(header);
    if (Number.isNaN(headerMs)) return;

    const endedAtMs = Date.now();
    const rttMs = Math.max(0, endedAtMs - startedAtMs);
    // Best estimate of "server time right now" = header + half round trip
    const serverNowEstimate = headerMs + rttMs / 2;
    const offset = serverNowEstimate - endedAtMs;

    // Ignore jitter-level offsets; once trusted, smooth towards new samples
    if (Math.abs(offset) < TRUST_THRESHOLD_MS) {
      serverOffsetMs = 0;
      syncSamples += 1;
      return;
    }
    serverOffsetMs = syncSamples === 0 ? offset : Math.round(serverOffsetMs * 0.7 + offset * 0.3);
    syncSamples += 1;
  } catch {
    /* header missing/unparseable — keep previous state */
  }
}

/** How many useful samples recorded (diagnostics). */
export function clockSyncSampleCount(): number {
  return syncSamples;
}

/** Current offset applied (diagnostics / debug UI). */
export function clockOffsetMs(): number {
  return serverOffsetMs;
}

/** Are we confidently correcting against a server reference? */
export function isClockSyncTrusted(): boolean {
  return syncSamples >= MIN_SAMPLES_BEFORE_TRUST && serverOffsetMs !== 0;
}

/**
 * THE canonical "now" for all deadline math.
 * Falls back to Date.now() until a server sample arrives.
 */
export function getSyncedNow(): number {
  return Date.now() + serverOffsetMs;
}

// ============================================================
// 2) LOCAL ⇄ UTC CONVERSION
// ============================================================

/**
 * Compose an exact UTC ISO instant from local wall-clock parts.
 * `dateYmd` = "YYYY-MM-DD" (as produced by <input type="date">),
 * hour12 ∈ 1..12, minute ∈ 0..59, ampm 'AM'|'PM'.
 * Returns null when the parts cannot form a valid date.
 */
export function toUtcIsoFromLocal(
  dateYmd: string,
  hour12: number,
  minute: number,
  ampm: 'AM' | 'PM'
): string | null {
  if (!dateYmd) return null;
  // Local-midnight anchor: ES spec parses date-time WITHOUT Z as local time.
  const d = new Date(`${dateYmd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const h24 =
    ampm === 'AM' ? (hour12 === 12 ? 0 : hour12) : hour12 === 12 ? 12 : hour12 + 12;
  d.setHours(h24, minute, 0, 0); // setHours operates in LOCAL time by design
  return d.toISOString();        // exact instant → UTC for Supabase TIMESTAMPTZ
}

/**
 * Parse a Supabase TIMESTAMPTZ ISO string into an epoch-ms instant.
 * Returns null for invalid input (callers must handle explicitly).
 */
export function parseInstant(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/** ISO instant → value for <input type="datetime-local"> (local wall time). */
export function isoToDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return '';
  const ms = parseInstant(iso);
  if (ms == null) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value → UTC ISO string (or null when empty/invalid). */
export function datetimeLocalValueToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value); // no Z suffix → parsed as LOCAL per spec ✓
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Split an instant into 12-hour clock parts (local timezone). */
export function splitIntoClockParts(iso?: string | null): {
  hour12?: number;
  minute?: number;
  ampm?: 'AM' | 'PM';
} {
  const ms = parseInstant(iso);
  if (ms == null) return {};
  const h24 = new Date(ms).getHours();
  return {
    hour12: h24 % 12 === 0 ? 12 : h24 % 12,
    minute: new Date(ms).getMinutes(),
    ampm: h24 >= 12 ? 'PM' : 'AM',
  };
}

/** Human absolute label: "Today · 6:00 PM" / "Tomorrow · 9:00 AM" / "Tue, Jul 14 · 9:00 AM". */
export function formatDueAbsolute(iso: string): string {
  const ms = parseInstant(iso);
  if (ms == null) return '';
  const date = new Date(ms);
  const now = new Date(getSyncedNow());
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === now.toDateString()) return `Today · ${time}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${time}`;
  return `${date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`;
}

// ============================================================
// 3) PRECISE REMAINING TIME
// ============================================================

export interface RemainingTime {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isOverdue: boolean;
}

/**
 * Exact second-granularity gap between now (synced) and the deadline.
 * Negative gaps come back as positive components with isOverdue=true.
 */
export function remainingTime(dueIso: string, nowMs: number = getSyncedNow()): RemainingTime | null {
  const due = parseInstant(dueIso);
  if (due == null) return null;

  let diffMs = due - nowMs;
  const isOverdue = diffMs < 0;
  const absMs = Math.abs(diffMs);

  const totalSeconds = Math.floor(absMs / 1000);
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalSeconds,
    isOverdue,
  };
}

/**
 * Live badge label with second precision near the deadline:
 *   "⏳ Due in 14m 20s" · "⚠️ Overdue by 10m" · "Due now"
 * Long horizons degrade to h/d spans so cards stay compact.
 */
export function formatCountdownLabel(dueIso: string, nowMs: number = getSyncedNow()): string {
  const r = remainingTime(dueIso, nowMs);
  if (!r) return 'Invalid date';

  const days = Math.floor(r.hours / 24);
  if (!r.isOverdue) {
    if (r.totalSeconds < 1) return 'Due now';
    if (days >= 2) return `⏳ Due in ${days}d ${r.hours % 24}h`;
    if (r.hours >= 1) return `⏳ Due in ${r.hours}h ${r.minutes}m`;
    if (r.minutes >= 1) return `⏳ Due in ${r.minutes}m ${r.seconds}s`;
    return `⏳ Due in ${r.seconds}s`;
  }
  if (days >= 2) return `⚠️ Overdue by ${days}d ${r.hours % 24}h`;
  if (r.hours >= 1) return `⚠️ Overdue by ${r.hours}h ${r.minutes}m`;
  return `⚠️ Overdue by ${Math.max(r.minutes, 0)}m`;
}
