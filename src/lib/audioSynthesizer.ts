/**
 * TU DU — Continuous Alarm Synthesizer (Phase 13)
 *
 * A self-contained Web Audio + Vibration looping alarm that rings and buzzes
 * INDEFINITELY until stopContinuousAlarm() is explicitly invoked:
 *
 *   • Audio : synthesized two-tone beep (OscillatorNode → GainNode envelope)
 *             every 1000ms — zero external files, nothing to fail loading.
 *   • Haptic: navigator.vibrate([400, 200, 400, 200, 800]) re-fired every
 *             1500ms for continuous physical buzzing on supporting devices.
 *
 * Robustness notes:
 *   • AudioContext creation/resume is attempted on every beep — mobile Safari
 *     requires a prior user gesture; once unlocked it keeps ringing.
 *   • Pages that are audibly playing are EXEMPT from Chrome's intensive
 *     background throttling, so the loop keeps cadence in hidden tabs.
 *   • Every call is crash-proof: unsupported APIs degrade to silent no-ops.
 */

// ------------------------------------------------------------
// Tuning constants
// ------------------------------------------------------------
const AUDIO_LOOP_MS = 1000;
/** buzz · pause · buzz · pause · LOOOONG buzz */
const VIBRATION_PATTERN: number[] = [400, 200, 400, 200, 800];
const VIBRATION_LOOP_MS = 1500;

const BEEP_PRIMARY_HZ = 880; // A5
const BEEP_SECONDARY_HZ = 622.25; // D#5 (dissonant → unmistakably an alarm)

// ------------------------------------------------------------
// Module state
// ------------------------------------------------------------
let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let beepTimer: number | undefined;
let vibrationTimer: number | undefined;
let running = false;

// ------------------------------------------------------------
// Internal: one synthesized double-beep burst
// ------------------------------------------------------------
function playBeepBurst(): void {
  try {
    const Ctx: typeof AudioContext | undefined =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === 'suspended') void audioCtx.resume();

    if (!masterGain) {
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 1;
      masterGain.connect(audioCtx.destination);
    }

    const t0 = audioCtx.currentTime;
    // Two urgent tones inside each 1s window: A5 blip → D#5 wail
    const tones = [
      { freq: BEEP_PRIMARY_HZ, start: 0, dur: 0.18 },
      { freq: BEEP_SECONDARY_HZ, start: 0.2, dur: 0.42 },
    ];
    for (const { freq, start, dur } of tones) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square'; // raw siren character, cuts through silence
      osc.frequency.setValueAtTime(freq, t0 + start);
      // Gentle attack / sustained / fast release so loops never click or pop
      gain.gain.setValueAtTime(0.0001, t0 + start);
      gain.gain.exponentialRampToValueAtTime(0.16, t0 + start + 0.02);
      gain.gain.setValueAtTime(0.16, t0 + start + dur - 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      osc.connect(gain).connect(masterGain);
      osc.start(t0 + start);
      osc.stop(t0 + start + dur + 0.02);
    }
  } catch {
    /* autoplay policy / unsupported — vibration loop continues regardless */
  }
}

function fireVibration(): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(VIBRATION_PATTERN);
    }
  } catch {
    /* unsupported device — silent no-op */
  }
}

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

/**
 * Start the infinite alarm: beeps every second + haptics every 1.5s.
 * Idempotent — calling twice while running is a safe no-op.
 */
export function startContinuousAlarm(): void {
  if (running) return;
  running = true;

  playBeepBurst(); // audible immediately, no first-second silence
  beepTimer = window.setInterval(playBeepBurst, AUDIO_LOOP_MS);

  fireVibration(); // buzz immediately alongside the first beep
  vibrationTimer = window.setInterval(fireVibration, VIBRATION_LOOP_MS);
}

/**
 * Silence everything NOW and cancel all pending loops.
 * Safe to call even when nothing is running.
 */
export function stopContinuousAlarm(): void {
  running = false;
  if (beepTimer !== undefined) {
    window.clearInterval(beepTimer);
    beepTimer = undefined;
  }
  if (vibrationTimer !== undefined) {
    window.clearInterval(vibrationTimer);
    vibrationTimer = undefined;
  }

  try {
    navigator.vibrate?.(0); // cancel any in-flight vibration pattern
  } catch {
    /* ignore */
  }

  try {
    if (masterGain && audioCtx) {
      const now = audioCtx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setTargetAtTime(0, now, 0.02); // kill tail instantly
    }
    void audioCtx?.suspend(); // keep context alive & reusable, zero CPU
  } catch {
    /* ignore */
  }
}

/** True while the alarm loop is active (diagnostics/tests). */
export function isAlarmLoopActive(): boolean {
  return running;
}
