/**
 * TU DU — Interactive Time & Deadline Selector (Phase 11)
 *
 * Native-feeling, theme-matched (OLED dark / clean light) deadline picker:
 *
 *   Row 1 — one-tap preset chips:
 *     [+15 Mins] [+30 Mins] [+1 Hour] [Today 6 PM] [Tomorrow 9 AM]
 *   Row 2 (toggle "Custom") — exact date & time:
 *     native date field (color-scheme aware) + HH : MM + AM/PM segments
 *   Summary line with the resolved absolute date/time.
 */

import React from 'react';
import { CalendarClock, ChevronDown, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DUE_PRESETS,
  DuePresetKind,
  formatDueAbsolute,
  resolvePreset,
  toDatetimeLocalValue,
} from '../lib/dueTime';
import { microBuzz } from '../lib/notificationManager';
import { isDeadlineSchemaReady } from '../lib/supabase';

interface TimeSelectorProps {
  /** ISO string of the selected deadline, or null/'' when unset. */
  value?: string | null;
  onChange: (iso: string | null) => void;
}

/** Build a Date from date-string parts + 12h clock segments (local time). */
function composeIso(dateYmd: string, hour12: number, minute: number, ampm: 'AM' | 'PM'): string | null {
  if (!dateYmd) return null;
  const h24 = ampm === 'AM' ? (hour12 === 12 ? 0 : hour12) : hour12 === 12 ? 12 : hour12 + 12;
  const d = new Date(`${dateYmd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(h24, minute, 0, 0);
  return d.toISOString();
}

export const TimeSelector: React.FC<TimeSelectorProps> = ({ value, onChange }) => {
  const [customOpen, setCustomOpen] = React.useState(false);

  // Custom panel state — initialized from the incoming value / sensible defaults
  const initial = value || '';
  const [dateYmd, setDateYmd] = React.useState<string>(
    initial ? toDatetimeLocalValue(initial).slice(0, 10) : toLocalTodayYmd()
  );
  const [hour12, setHour12] = React.useState<number>(() => splitClock(initial).hour12 ?? 9);
  const [minute, setMinute] = React.useState<number>(() => splitClock(initial).minute ?? 0);
  const [ampm, setAmpm] = React.useState<'AM' | 'PM'>(() => splitClock(initial).ampm ?? 'PM');

  // Keep custom fields in sync when the value is changed externally (form reset)
  React.useEffect(() => {
    if (!value) {
      setDateYmd(toLocalTodayYmd());
      return;
    }
    setDateYmd(toDatetimeLocalValue(value).slice(0, 10));
    const c = splitClock(value);
    if (c.hour12 != null) setHour12(c.hour12);
    if (c.minute != null) setMinute(c.minute);
    if (c.ampm) setAmpm(c.ampm);
  }, [value]);

  // ------------------------------------------------------------
  // Preset taps — resolve instantly at tap time
  // ------------------------------------------------------------
  const selectPreset = (kind: DuePresetKind) => {
    microBuzz(); // tactile confirmation on every tap
    setCustomOpen(false);
    onChange(resolvePreset(kind).toISOString());
  };

  // ------------------------------------------------------------
  // Custom segment changes — commit live whenever all parts are valid
  // ------------------------------------------------------------
  const commitCustom = (
    nextDate: string = dateYmd,
    nextHour: number = hour12,
    nextMinute: number = minute,
    nextAmpm: 'AM' | 'PM' = ampm
  ) => {
    const iso = composeIso(nextDate, nextHour, nextMinute, nextAmpm);
    if (iso) onChange(iso);
  };

  const openCustom = () => {
    microBuzz();
    // Opening custom with an existing value keeps it; otherwise default today
    setCustomOpen((v) => !v);
  };

  const clear = () => {
    microBuzz();
    setCustomOpen(false);
    onChange(null);
  };

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const selectClasses =
    'appearance-none bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer';

  return (
    <div className="space-y-2">
      {/* ---- Preset chips ---- */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {DUE_PRESETS.map((preset) => (
          <button
            key={preset.kind}
            type="button"
            onClick={() => selectPreset(preset.kind)}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer active:scale-95 ${
              value && !customOpen && matchesPreset(value, preset.kind)
                ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/25'
                : 'bg-white dark:bg-black text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:border-orange-500/50 hover:text-orange-600 dark:hover:text-orange-400'
            }`}
          >
            {preset.label}
          </button>
        ))}

        {/* Custom toggle */}
        <button
          type="button"
          onClick={openCustom}
          aria-expanded={customOpen}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer active:scale-95 ${
            customOpen
              ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/25'
              : 'bg-white dark:bg-black text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:border-orange-500/50 hover:text-orange-600 dark:hover:text-orange-400'
          }`}
        >
          <CalendarClock className="w-3.5 h-3.5" />
          Exact Date &amp; Time
        </button>

        {/* Clear */}
        {!!value && (
          <button
            type="button"
            onClick={clear}
            aria-label="Remove reminder"
            title="Remove reminder"
            className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer active:scale-90"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ---- Custom exact picker ---- */}
      <AnimatePresence initial={false}>
        {customOpen && (
          <motion.div
            key="custom-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-2.5 rounded-2xl bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-800">
              {/* Date */}
              <input
                type="date"
                value={dateYmd}
                onChange={(e) => {
                  setDateYmd(e.target.value);
                  commitCustom(e.target.value);
                }}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
              />

              {/* Time segments: HH : MM AM|PM */}
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <select
                    aria-label="Hour"
                    value={hour12}
                    onChange={(e) => {
                      const h = Number(e.target.value);
                      setHour12(h);
                      commitCustom(dateYmd, h);
                    }}
                    className={`w-full ${selectClasses}`}
                  >
                    {hours.map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                <span className="font-black text-slate-400 dark:text-zinc-500">:</span>

                <div className="relative flex-1 min-w-0">
                  <select
                    aria-label="Minute"
                    value={minute}
                    onChange={(e) => {
                      const m = Number(e.target.value);
                      setMinute(m);
                      commitCustom(dateYmd, hour12, m);
                    }}
                    className={`w-full ${selectClasses}`}
                  >
                    {minutes.map((m) => (
                      <option key={m} value={m}>
                        {String(m).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                {/* AM / PM segmented toggle */}
                <div className="flex items-center rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 shrink-0">
                  {(['AM', 'PM'] as const).map((seg) => (
                    <button
                      key={seg}
                      type="button"
                      onClick={() => {
                        setAmpm(seg);
                        commitCustom(dateYmd, hour12, minute, seg);
                      }}
                      aria-pressed={ampm === seg}
                      className={`px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                        ampm === seg
                          ? 'bg-orange-500 text-white'
                          : 'bg-slate-50 dark:bg-black text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900'
                      }`}
                    >
                      {seg}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation line */}
      {!!value && !customOpen && (
        <p className="text-[11px] font-bold text-orange-600 dark:text-orange-400">
          <CalendarClock className="w-3 h-3 inline -mt-0.5 mr-1" />
          Reminder: {formatDueAbsolute(value)}
        </p>
      )}

      {/* Schema hint: reminders activate after the migration runs */}
      {!isDeadlineSchemaReady() && (
        <p className="text-[11px] leading-relaxed text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
          ⚠️ Reminders need a one-time database update — run{' '}
          <code className="font-mono">supabase/migrations/add_due_timers.sql</code> in the Supabase
          SQL Editor. Tasks save normally in the meantime; the alarm activates automatically after.
        </p>
      )}
    </div>
  );
};

// ------------------------------------------------------------
// Small local helpers
// ------------------------------------------------------------

function toLocalTodayYmd(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Split an ISO instant into 12-hour clock parts (local timezone). */
function splitClock(iso?: string | null): { hour12?: number; minute?: number; ampm?: 'AM' | 'PM' } {
  if (!iso) return {};
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return {};
    const h24 = d.getHours();
    return {
      hour12: h24 % 12 === 0 ? 12 : h24 % 12,
      minute: d.getMinutes(),
      ampm: h24 >= 12 ? 'PM' : 'AM',
    };
  } catch {
    return {};
  }
}

/** True when the stored instant matches what this preset would resolve to now. */
function matchesPreset(iso: string, kind: DuePresetKind): boolean {
  try {
    return Math.abs(new Date(resolvePreset(kind)).getTime() - new Date(iso).getTime()) < 60_000;
  } catch {
    return false;
  }
}
