/**
 * TU DU — Continuous Alarm Lifecycle Hook (Phase 13)
 *
 * Binds the infinite audio/vibration loop to the app's alarm state:
 *   • Alarm queue non-empty  → startContinuousAlarm() (rings & buzzes forever)
 *   • Queue emptied (user tapped Stop / Complete / Snooze, or snoozed the
 *     last item)            → stopContinuousAlarm()
 *
 * Deliberately keyed on "is ANY alarm active" rather than WHICH task is
 * active: resolving alarm #1 while #2 waits keeps the siren running
 * seamlessly into the next modal instead of stuttering off→on.
 *
 * Detection itself stays in usePrecisionTimer (exact-second, drift-
 * compensated). This hook owns ONLY the audible/haptic loop lifecycle.
 */

import { useEffect } from 'react';
import { startContinuousAlarm, stopContinuousAlarm } from '../lib/audioSynthesizer';

/**
 * @param activeAlarmId The task id currently shown in the alarm modal,
 *                      or null when no alarm needs attention.
 */
export function useContinuousAlarm(activeAlarmId: string | null): void {
  useEffect(() => {
    if (activeAlarmId) {
      startContinuousAlarm();
    } else {
      stopContinuousAlarm();
    }
    // Cleanup guarantees silence if the component unmounts mid-ring.
    return () => stopContinuousAlarm();
  }, [activeAlarmId]);
}
