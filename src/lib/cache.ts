import { ProgressProject, ProgressTask, UserProfile } from '../types';

/**
 * TU DU smart cache — stale-while-revalidate snapshots in localStorage.
 *
 * On cold start (or after the OS discarded a backgrounded PWA page), the last
 * known projects/tasks/profile are painted INSTANTLY from here. A silent
 * network refresh then reconciles. Loading skeletons are only shown when no
 * usable snapshot exists (true first visit).
 *
 * The Supabase client itself is never cached — only this app-level snapshot.
 */

const KEY_PREFIX = 'tudu_cache_v2_';
const MAX_JSON_BYTES = 1_500_000; // ~1.5 MB safety valve before skipping writes

interface CacheSnapshot {
  v: 2;
  uid: string;
  savedAt: number;
  profile: UserProfile | null;
  projects: ProgressProject[];
  tasks: ProgressTask[];
}

function keyFor(uid: string): string {
  return `${KEY_PREFIX}${uid}`;
}

function isValidProject(p: any): p is ProgressProject {
  return p && typeof p.id === 'string' && typeof p.title === 'string';
}

function isValidTask(t: any): t is ProgressTask {
  return (
    t &&
    typeof t.id === 'string' &&
    typeof t.project_id === 'string' &&
    typeof t.title === 'string'
  );
}

export function loadSnapshot(uid: string): Omit<CacheSnapshot, 'v' | 'uid'> | null {
  try {
    const raw = localStorage.getItem(keyFor(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheSnapshot;
    if (
      parsed?.v !== 2 ||
      parsed.uid !== uid ||
      !Array.isArray(parsed.projects) ||
      !Array.isArray(parsed.tasks)
    ) {
      localStorage.removeItem(keyFor(uid));
      return null;
    }
    const projects = parsed.projects.filter(isValidProject);
    const tasks = parsed.tasks.filter(isValidTask);
    const profile =
      parsed.profile && typeof parsed.profile.user_id === 'string' ? parsed.profile : null;
    // Treat absurdly old snapshots (>7 days) as unusable to avoid stale ghosts
    if (Date.now() - parsed.savedAt > 7 * 24 * 60 * 60 * 1000) {
      return { savedAt: 0, profile, projects, tasks };
    }
    return { savedAt: parsed.savedAt, profile, projects, tasks };
  } catch {
    return null;
  }
}

export function saveSnapshot(
  uid: string,
  data: { profile: UserProfile | null; projects: ProgressProject[]; tasks: ProgressTask[] }
): void {
  try {
    const payload: CacheSnapshot = {
      v: 2,
      uid,
      savedAt: Date.now(),
      profile: data.profile,
      projects: data.projects,
      tasks: data.tasks,
    };
    const raw = JSON.stringify(payload);
    if (raw.length > MAX_JSON_BYTES) return;
    localStorage.setItem(keyFor(uid), raw);
  } catch {
    /* quota/private-mode — caching is best-effort */
  }
}

export function clearSnapshot(uid: string): void {
  try {
    localStorage.removeItem(keyFor(uid));
  } catch {
    /* ignore */
  }
}

/** Synchronous probe: does ANY snapshot exist? Used to skip the boot loader. */
export function hasAnySnapshot(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i)?.startsWith(KEY_PREFIX)) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
