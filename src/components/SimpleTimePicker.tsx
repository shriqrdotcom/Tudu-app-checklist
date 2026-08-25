/**
 * TU DU — Simple & Accessible Time Picker (Phase 13)
 *
 * Dead-simple deadline selection matching the White/Orange (light) and
 * OLED Black/Orange (dark) themes:
 *
 *   Chips: [+15m] [+30m] [+1 hr] [Today 6 PM] [Tomorrow 9 AM]
 *   Native: <input type="datetime-local"> — 100% accurate native mobile
 *           clock UI (color-scheme aware), zero custom drift surface.
 *
 * Storage contract: the input's local value is converted via
 * `new Date(value).toISOString()` → standard UTC ISO string for Supabase
 * TIMESTAMPTZ. Reads convert back to the exact same local wall time.
 */

import React from 'react';
import { CalendarClock, X } from 'lucide-react';
import {
  DUE_PRESETS,
  DuePresetKind,
  resolvePreset,
  formatDueAbsolute,
  toDatetimeLocalValue,
  datetimeLocalValueToIso,
} from '../lib/dueTime';
import { microBuzz } from '../lib/notificationManager';
import { isDeadlineSchemaReady } from '../lib/supabase';

interface SimpleTimePickerProps {
  /** ISO string of the selected deadline, or null/'' when unset. */
  value?: string | null;
  onChange: (iso: string | null) => void;
}

export const SimpleTimePicker: React.FC<SimpleTimePickerProps> = ({ value, onChange }) => {
  const selectPreset = (kind: DuePresetKind) => {
    microBuzz();
    onChange(resolvePreset(kind).toISOString());
  };

  const handleNativeChange = (raw: string) => {
    // "YYYY-MM-DDTHH:mm" is parsed as LOCAL time per ES spec — the resulting
    // ISO string is the exact absolute instant, timezone-drift-proof.
    const iso = datetimeLocalValueToIso(raw);
    if (raw && !iso) return; // ignore transient invalid states while typing
    onChange(iso);
    if (iso) microBuzz();
  };

  const clear = () => {
    microBuzz();
    onChange(null);
  };

  const chipClasses =
    'px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer active:scale-95';

  return (
    <div className="space-y-2">
      {/* ---- Preset chips ---- */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {DUE_PRESETS.map((preset) => (
          <button
            key={preset.kind}
            type="button"
            onClick={() => selectPreset(preset.kind)}
            className={`${chipClasses} bg-white dark:bg-black text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:border-orange-500/50 hover:text-orange-600 dark:hover:text-orange-400`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* ---- Native date & time picker ---- */}
      <div className="relative">
        <input
          type="datetime-local"
          value={toDatetimeLocalValue(value || '')}
          onChange={(e) => handleNativeChange(e.target.value)}
          aria-label="Due date and time"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
        />
        <CalendarClock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-orange-500 pointer-events-none" />
        {!!value && (
          <button
            type="button"
            onClick={clear}
            aria-label="Remove reminder"
            title="Remove reminder"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer active:scale-90"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Confirmation line */}
      {!!value && (
        <p className="text-[11px] font-bold text-orange-600 dark:text-orange-400">
          <CalendarClock className="w-3 h-3 inline -mt-0.5 mr-1" />
          Reminder: {formatDueAbsolute(value)}
        </p>
      )}

      {/* Schema hint: reminders activate after the migration runs */}
      {!isDeadlineSchemaReady() && (
        <p className="text-[11px] leading-relaxed text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
          ⚠️ Reminders need a one-time database update — run{' '}
          <code className="font-mono">supabase/migrations/fix_tasks_and_rls.sql</code> in the
          Supabase SQL Editor. Tasks save normally in the meantime; alarms activate automatically
          after.
        </p>
      )}
    </div>
  );
};
