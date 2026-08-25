/**
 * TU DU — Large dataset simulation (Phase 9 audit).
 * Replicates the app's client-side algorithms at 100 projects / 1000 tasks
 * and measures: stats computation (old vs new), dashboard filter+sort,
 * per-task completion update path. Run: node scripts/perf-sim.mjs
 */

const PROJECTS = 100;
const TASKS = 1000;

const now = Date.now();
const iso = (offsetMs) => new Date(now - offsetMs).toISOString();

const projects = Array.from({ length: PROJECTS }, (_, i) => ({
  id: `p-${i}`,
  user_id: 'u',
  title: `Progress ${i} Kitchen Renovation`,
  description: `Description for project ${i}`,
  image_url: '',
  accent_color: '#ff6b00',
  is_favorite: i % 10 === 0,
  created_at: iso(i * 36e5),
  updated_at: iso(i * 18e5),
}));

const tasks = Array.from({ length: TASKS }, (_, i) => ({
  id: `t-${i}`,
  project_id: `p-${i % PROJECTS}`,
  user_id: 'u',
  title: `Task ${i}`,
  description: '',
  image_url: '',
  is_completed: i % 3 !== 0,
  completed_at: null,
  is_favorite: i % 7 === 0,
  position: Math.floor(i / PROJECTS),
  created_at: iso(i * 6e4),
}));

const ms = (fn) => {
  const t0 = performance.now();
  const r = fn();
  return { result: r, ms: performance.now() - t0 };
};

// --- OLD: getProjects stats — nested filter per project, O(P × T)
function oldStats() {
  return projects.map((p) => {
    const pTasks = tasks.filter((t) => t.project_id === p.id);
    const total = pTasks.length;
    const completed = pTasks.filter((t) => t.is_completed).length;
    return { ...p, total_tasks: total, completed_tasks: completed };
  });
}

// --- NEW: single-pass Map, O(P + T)
function newStats() {
  const map = new Map();
  for (const t of tasks) {
    const s = map.get(t.project_id) || { total: 0, completed: 0 };
    s.total += 1;
    if (t.is_completed) s.completed += 1;
    map.set(t.project_id, s);
  }
  return projects.map((p) => {
    const s = map.get(p.id);
    return { ...p, total_tasks: s?.total ?? 0, completed_tasks: s?.completed ?? 0 };
  });
}

// --- Dashboard pipeline: search + filter + counts + sort (as DashboardView)
function dashboardPipeline(list) {
  const query = 'kitchen';
  const filtered = list.filter(
    (p) =>
      p.title.toLowerCase().includes(query) ||
      (p.description ?? '').toLowerCase().includes(query)
  );
  const counts = {
    all: list.length,
    in_progress: list.filter((p) => p.completed_tasks < p.total_tasks).length,
    favorites: list.filter((p) => p.is_favorite).length,
  };
  const sorted = [...filtered].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return { sorted, counts };
}

// --- Completion toggle recompute (per click)
function toggleRecompute() {
  const next = tasks.map((t) => (t.id === 't-500' ? { ...t, is_completed: !t.is_completed } : t));
  const map = new Map();
  for (const t of next) {
    if (t.project_id === 'p-0') {
      /* only touched project recomputed in app */
    }
    const s = map.get(t.project_id) || { total: 0, completed: 0 };
    s.total += 1;
    if (t.is_completed) s.completed += 1;
    map.set(t.project_id, s);
  }
  return next.length;
}

console.log(`Dataset: ${PROJECTS} projects, ${TASKS} tasks\n`);

const oldR = ms(() => Array.from({ length: 100 }, oldStats));
const newR = ms(() => Array.from({ length: 100 }, newStats));
console.log(`Project stats ×100 runs  OLD (O(P×T)): ${oldR.ms.toFixed(2)}ms`);
console.log(`Project stats ×100 runs  NEW (Map):    ${newR.ms.toFixed(2)}ms  → ${(oldR.ms / newR.ms).toFixed(1)}× faster`);

const dash = ms(() => dashboardPipeline(newStats().map((p) => ({ ...p }))));
console.log(`Dashboard search+filter+sort:          ${dash.ms.toFixed(2)}ms`);

const tog = ms(toggleRecompute);
console.log(`Completion toggle full-list recompute: ${tog.ms.toFixed(3)}ms`);

const mem = ms(() => JSON.stringify({ projects, tasks }).length);
console.log(`Snapshot serialize (cache write):      ${mem.result} bytes`);
