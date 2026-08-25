/**
 * TU DU — Alarm Engine Runtime Test Harness
 *
 * Drives the REAL src/lib/audioSynthesizer.ts against mocked browser APIs
 * and asserts the contract Phase 13 promises:
 *   1. startContinuousAlarm() registers exactly ONE audio loop + ONE
 *      vibration loop and fires both immediately (no first-second silence)
 *   2. Each loop tick synthesizes a two-tone beep burst
 *   3. Double-start is idempotent (no duplicate loops)
 *   4. stopContinuousAlarm() clears BOTH loops, cancels vibration, suspends
 *      the audio context
 *   5. Stop is safe to call repeatedly / when never started
 *
 * Run: npx tsx scripts/alarm-engine.test.ts
 */

// ------------------------------------------------------------
// Browser API mocks (installed BEFORE importing the module)
// ------------------------------------------------------------
type Scheduled = { id: number; handler: () => void; ms: number; cleared: boolean };
let scheduled: Scheduled[] = [];
let nextId = 1;

function register(handler: () => void, ms: number): number {
  const id = nextId++;
  scheduled.push({ id, handler, ms, cleared: false });
  return id;
}

(globalThis as any).window = globalThis;
(globalThis as any).setInterval = (handler: () => void, ms: number) => register(handler, ms);
(globalThis as any).clearInterval = (id: number) => {
  const s = scheduled.find((x) => x.id === id);
  if (s) s.cleared = true;
};

let vibrateCalls: number[][] = [];
const navigatorMock = {
  vibrate: (pattern: number | number[]) => {
    vibrateCalls.push(Array.isArray(pattern) ? pattern : [pattern]);
    return true;
  },
};
// Node ≥21 exposes a read-only `navigator` getter — redefine over it
Object.defineProperty(globalThis, 'navigator', {
  value: navigatorMock,
  configurable: true,
  writable: true,
});

let oscillatorStarts = 0;
let suspended = 0;
function makeAudioNode() {
  return {
    connectedTo: [] as any[],
    connect(dest: any) {
      this.connectedTo.push(dest);
      return dest;
    },
  };
}
class FakeAudioContext {
  state = 'running';
  currentTime = 0;
  destination = makeAudioNode();
  async resume() {}
  async suspend() {
    suspended += 1;
  }
  createOscillator() {
    const node = makeAudioNode() as any;
    node.frequency = { setValueAtTime: () => {} };
    node.start = () => {
      oscillatorStarts += 1;
    };
    node.stop = () => {};
    return node;
  }
  createGain() {
    const node = makeAudioNode() as any;
    node.gain = {
      value: 1,
      cancelScheduledValues: () => {},
      setValueAtTime: () => {},
      exponentialRampToValueAtTime: () => {},
      setTargetAtTime: () => {},
    };
    return node;
  }
}
(globalThis as any).AudioContext = FakeAudioContext;

// ------------------------------------------------------------
// Import the REAL implementation under test
// ------------------------------------------------------------
const synth = await import('../src/lib/audioSynthesizer');
const { startContinuousAlarm, stopContinuousAlarm, isAlarmLoopActive } = synth;

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ------------------------------------------------------------
// Test 1: start registers exactly one audio + one vibration loop,
//         fires both immediately, reports active
// ------------------------------------------------------------
console.log('Test 1 — start behaviour');
startContinuousAlarm();
const loops = scheduled.filter((s) => !s.cleared);
check('isAlarmLoopActive() === true', isAlarmLoopActive() === true);
check('exactly 2 loops scheduled (audio + haptics)', loops.length === 2, `got ${loops.length}`);
check('audio loop cadence = 1000ms', loops.some((s) => s.ms === 1000));
check('vibration loop cadence = 1500ms', loops.some((s) => s.ms === 1500));
check('immediate first beep burst (2 tones)', oscillatorStarts === 2, `got ${oscillatorStarts}`);
check(
  'immediate vibration with [400,200,400,200,800]',
  JSON.stringify(vibrateCalls[0]) === JSON.stringify([400, 200, 400, 200, 800]),
  JSON.stringify(vibrateCalls[0])
);

// ------------------------------------------------------------
// Test 2: loop ticks keep synthesizing beeps
// ------------------------------------------------------------
console.log('Test 2 — loop ticks');
const before = oscillatorStarts;
const audioTick = loops.find((s) => s.ms === 1000)!.handler;
audioTick();
audioTick();
audioTick();
check('3 ticks → +6 oscillator starts (two tones each)', oscillatorStarts - before === 6, `delta ${oscillatorStarts - before}`);

// ------------------------------------------------------------
// Test 3: double-start is idempotent
// ------------------------------------------------------------
console.log('Test 3 — idempotent start');
startContinuousAlarm();
startContinuousAlarm();
check(
  'still exactly 2 live loops after duplicate starts',
  scheduled.filter((s) => !s.cleared).length === 2,
  `got ${scheduled.filter((s) => !s.cleared).length}`
);

// ------------------------------------------------------------
// Test 4: stop silences everything
// ------------------------------------------------------------
console.log('Test 4 — stop behaviour');
stopContinuousAlarm();
check('isAlarmLoopActive() === false', isAlarmLoopActive() === false);
check('all loops cleared', scheduled.every((s) => s.cleared));
check('vibration cancelled with vibrate(0)', vibrateCalls[vibrateCalls.length - 1].length === 1 && vibrateCalls[vibrateCalls.length - 1][0] === 0);
check('audio context suspended', suspended >= 1);

// ------------------------------------------------------------
// Test 5: stop is safe when idle / called twice
// ------------------------------------------------------------
console.log('Test 5 — safe redundant stop');
stopContinuousAlarm();
stopContinuousAlarm();
check('no crash on redundant stops', true);

// ------------------------------------------------------------
// Summary
// ------------------------------------------------------------
console.log('');
if (failures > 0) {
  console.error(`${failures} assertion(s) FAILED`);
  process.exit(1);
}
console.log('ALL ALARM ENGINE ASSERTIONS PASSED ✓');
