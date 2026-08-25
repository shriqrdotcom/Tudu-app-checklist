import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProgressProject, ProgressTask, UserProfile, ThemeMode } from '../types';

// Detect Supabase env credentials (client-safe anon key only)
const metaEnv = (import.meta as any).env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || '';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'MY_SUPABASE_URL');
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// Production-only diagnostic (never prints values) — makes a misconfigured
// deployment obvious in the browser console instead of failing silently.
if (import.meta.env.PROD && !isSupabaseConfigured()) {
  console.warn(
    '[TU DU] Supabase env missing in this deployment. ' +
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel → Settings → Environment Variables (Production + Preview), then redeploy.'
  );
}

function requireClient(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

/** Strip client-computed fields before sending partial updates to Postgres. */
function projectPatch(updates: Partial<ProgressProject>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if ('title' in updates) patch.title = updates.title;
  if ('description' in updates) patch.description = updates.description;
  if ('image_url' in updates) patch.image_url = updates.image_url;
  if ('accent_color' in updates) patch.accent_color = updates.accent_color;
  if ('is_favorite' in updates) patch.is_favorite = updates.is_favorite;
  return patch;
}

function taskPatch(updates: Partial<ProgressTask>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if ('title' in updates) patch.title = updates.title;
  if ('description' in updates) patch.description = updates.description;
  if ('image_url' in updates) patch.image_url = updates.image_url;
  if ('is_completed' in updates) patch.is_completed = updates.is_completed;
  if ('is_favorite' in updates) patch.is_favorite = updates.is_favorite;
  if ('position' in updates) patch.position = updates.position;
  if ('completed_at' in updates) patch.completed_at = updates.completed_at;
  if ('project_id' in updates && updates.project_id) patch.project_id = updates.project_id;
  // Reminder engine — explicit nulls are meaningful (clearing a deadline/snooze)
  if ('due_datetime' in updates) patch.due_datetime = updates.due_datetime ?? null;
  if ('notified' in updates) patch.notified = Boolean(updates.notified);
  if ('snooze_until' in updates) patch.snooze_until = updates.snooze_until ?? null;
  return patch;
}

/**
 * Fire-and-forget `updated_at` touch on the parent project.
 * Never awaited: stats/percentages are computed client-side from tasks, so the
 * touch only influences sort order. Awaiting it would double the round trips
 * of every task mutation and delay confirmation of user actions.
 */
function touchProject(client: SupabaseClient, projectId: string): void {
  client
    .from('progress_projects')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', projectId)
    .then(undefined, () => {
      /* best-effort — next successful mutation refreshes ordering */
    });
}

/** Compute per-project stats in a single O(T) pass (scales to 1000+ tasks). */
export function computeProjectStatsMap(tasks: Array<Pick<ProgressTask, 'project_id' | 'is_completed'>>) {
  const stats = new Map<string, { total_tasks: number; completed_tasks: number; pending_tasks: number; completion_percentage: number }>();
  for (const t of tasks) {
    const s = stats.get(t.project_id) || { total_tasks: 0, completed_tasks: 0, pending_tasks: 0, completion_percentage: 0 };
    s.total_tasks += 1;
    if (t.is_completed) s.completed_tasks += 1;
    else s.pending_tasks += 1;
    stats.set(t.project_id, s);
  }
  for (const s of stats.values()) {
    s.completion_percentage = s.total_tasks > 0 ? Math.round((s.completed_tasks / s.total_tasks) * 100) : 0;
  }
  return stats;
}

function withStats(projects: ProgressProject[], stats: ReturnType<typeof computeProjectStatsMap>): ProgressProject[] {
  return projects.map((p) => {
    const s = stats.get(p.id);
    return {
      ...p,
      total_tasks: s?.total_tasks ?? 0,
      completed_tasks: s?.completed_tasks ?? 0,
      pending_tasks: s?.pending_tasks ?? 0,
      completion_percentage: s?.completion_percentage ?? 0,
    };
  });
}

export class DataService {
  // --- AUTH / PROFILE ---

  static async updateProfile(
    userId: string,
    updates: { name?: string; avatar_url?: string | null }
  ): Promise<UserProfile> {
    const client = requireClient();
    const { data, error } = await client
      .from('profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async signOut(): Promise<void> {
    const client = requireClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  /**
   * Restore the persisted session from local storage WITHOUT a network call.
   * `auth.getUser()` validates the JWT against the server (1 round trip) —
   * too slow for the startup critical path. The session JWT is used directly
   * for RLS-protected queries; supabase-js auto-refreshes expired tokens.
   */
  static async restoreSession(): Promise<UserProfile | null> {
    const client = requireClient();
    const { data: { session } } = await client.auth.getSession();
    const sUser = session?.user;
    if (!sUser || !session?.access_token) return null;
    return {
      id: sUser.id,
      user_id: sUser.id,
      email: sUser.email ?? undefined,
      name:
        (sUser.user_metadata?.name as string) ||
        sUser.email?.split('@')[0] ||
        'TU DU User',
      avatar_url: (sUser.user_metadata?.avatar_url as string) || undefined,
      created_at: sUser.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  static async fetchProfile(userId: string): Promise<UserProfile | null> {
    const client = requireClient();

    const fallbackProfile = (email?: string): UserProfile => ({
      id: userId,
      user_id: userId,
      email,
      name: 'TU DU User',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    try {
      const { data: profile, error } = await client
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) return null; // table not provisioned yet — caller falls back
      if (profile) return profile;

      // No row yet — create one (the DB trigger normally handles this)
      const { data: created } = await client
        .from('profiles')
        .insert({ user_id: userId })
        .select()
        .single();
      return created || fallbackProfile();
    } catch {
      return fallbackProfile();
    }
  }

  /**
   * Fetch EVERYTHING the app needs in one parallel batch (1 round-trip of wall
   * time instead of the previous 4-request waterfall). Projects stats are
   * computed locally from tasks — no extra queries, no joins.
   */
  static async fetchAllData(userId: string): Promise<{
    profile: UserProfile | null;
    projects: ProgressProject[];
    tasks: ProgressTask[];
    theme: ThemeMode | null;
  }> {
    const client = requireClient();
    const [profileRes, projectsRes, tasksRes, themeRes] = await Promise.all([
      this.fetchProfile(userId),
      client.from('progress_projects').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      client
        .from('progress_tasks')
        .select('*')
        .eq('user_id', userId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: false }),
      client.from('user_settings').select('theme').eq('user_id', userId).maybeSingle(),
    ]);

    if (projectsRes.error) throw projectsRes.error;
    if (tasksRes.error) throw tasksRes.error;

    const tasks: ProgressTask[] = tasksRes.data || [];
    const projects = withStats(projectsRes.data || [], computeProjectStatsMap(tasks));
    const theme =
      themeRes.data?.theme === 'dark' || themeRes.data?.theme === 'light' ? themeRes.data.theme : null;

    return { profile: profileRes, projects, tasks, theme };
  }

  // --- PROJECTS ---

  static async getProjects(userId: string, knownTasks?: ProgressTask[]): Promise<ProgressProject[]> {
    const client = requireClient();
    const { data: projects, error } = await client
      .from('progress_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    // Reuse already-fetched tasks when the caller has them (avoids a duplicate query)
    let tasks: Array<Pick<ProgressTask, 'project_id' | 'is_completed'>> = knownTasks || [];
    if (!knownTasks) {
      const { data: fetched, error: tasksError } = await client
        .from('progress_tasks')
        .select('project_id, is_completed')
        .eq('user_id', userId);
      if (tasksError) throw tasksError;
      tasks = fetched || [];
    }

    return withStats(projects || [], computeProjectStatsMap(tasks));
  }

  static async createProject(
    projectData: Pick<
      ProgressProject,
      'user_id' | 'title' | 'description' | 'image_url' | 'accent_color' | 'is_favorite'
    >
  ): Promise<ProgressProject> {
    const client = requireClient();
    const { data, error } = await client
      .from('progress_projects')
      .insert({
        user_id: projectData.user_id,
        title: projectData.title,
        description: projectData.description || '',
        image_url: projectData.image_url || '',
        accent_color: projectData.accent_color,
        is_favorite: projectData.is_favorite,
      })
      .select()
      .single();
    if (error) {
      // Safe diagnostic only — PostgREST messages contain no secrets.
      console.error('[TU DU] create project failed:', {
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
      });
      throw error;
    }
    return {
      ...data,
      total_tasks: 0,
      completed_tasks: 0,
      pending_tasks: 0,
      completion_percentage: 0,
    };
  }

  static async updateProject(projectId: string, updates: Partial<ProgressProject>): Promise<void> {
    const client = requireClient();
    const { error } = await client
      .from('progress_projects')
      .update({ ...projectPatch(updates), updated_at: new Date().toISOString() })
      .eq('id', projectId);
    if (error) throw error;
  }

  static async deleteProject(projectId: string): Promise<void> {
    const client = requireClient();
    const { error } = await client.from('progress_projects').delete().eq('id', projectId);
    if (error) throw error;
  }

  // --- TASKS ---

  static async getTasks(userId: string, projectId?: string): Promise<ProgressTask[]> {
    const client = requireClient();
    let query = client
      .from('progress_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  static async createTask(
    taskData: Pick<
      ProgressTask,
      'project_id' | 'user_id' | 'title' | 'description' | 'image_url' | 'is_completed' | 'is_favorite' | 'position'
    > & { due_datetime?: string | null }
  ): Promise<ProgressTask> {
    const client = requireClient();

    // Server-derived position when not provided
    let position = taskData.position;
    if (!position || position < 1) {
      const { count } = await client
        .from('progress_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', taskData.project_id);
      position = (count || 0) + 1;
    }

    const now = new Date().toISOString();
    const { data, error } = await client
      .from('progress_tasks')
      .insert({
        project_id: taskData.project_id,
        user_id: taskData.user_id,
        title: taskData.title,
        description: taskData.description || '',
        image_url: taskData.image_url || '',
        is_completed: taskData.is_completed,
        completed_at: taskData.is_completed ? now : null,
        is_favorite: taskData.is_favorite ?? false,
        position,
        due_datetime: taskData.due_datetime || null,
      })
      .select()
      .single();
    if (error) throw error;

    touchProject(client, taskData.project_id);
    return data;
  }

  static async toggleTaskCompletion(taskId: string, isCompleted: boolean): Promise<ProgressTask | null> {
    const client = requireClient();
    const now = new Date().toISOString();
    const { data, error } = await client
      .from('progress_tasks')
      .update({ is_completed: isCompleted, completed_at: isCompleted ? now : null })
      .eq('id', taskId)
      .select()
      .single();
    if (error) throw error;

    if (data) touchProject(client, data.project_id);
    return data;
  }

  static async updateTask(taskId: string, updates: Partial<ProgressTask>): Promise<void> {
    const client = requireClient();
    const { data, error } = await client
      .from('progress_tasks')
      .update(taskPatch(updates))
      .eq('id', taskId)
      .select('project_id')
      .single();
    if (error) throw error;

    if (data) touchProject(client, data.project_id);
  }

  /** Latch the overdue-alert flag so a deadline never notifies twice. */
  static async setTaskNotified(taskId: string, notified: boolean = true): Promise<void> {
    const client = requireClient();
    const { error } = await client
      .from('progress_tasks')
      .update({ notified })
      .eq('id', taskId);
    if (error) throw error;
  }

  /**
   * Snooze an overdue task: silence until `minutes` from now and re-arm the
   * alert (notified=false) so the scheduler fires again when the snooze ends.
   */
  static async snoozeTask(taskId: string, minutes: number): Promise<void> {
    const client = requireClient();
    const { error } = await client
      .from('progress_tasks')
      .update({
        snooze_until: new Date(Date.now() + minutes * 60_000).toISOString(),
        notified: false,
      })
      .eq('id', taskId);
    if (error) throw error;
  }

  static async deleteTask(taskId: string): Promise<void> {
    const client = requireClient();
    const { data } = await client
      .from('progress_tasks')
      .select('project_id')
      .eq('id', taskId)
      .maybeSingle();

    const { error } = await client.from('progress_tasks').delete().eq('id', taskId);
    if (error) throw error;

    if (data) touchProject(client, data.project_id);
  }

  /** Mark every task in a project incomplete (tasks are kept, progress is cleared). */
  static async resetProjectProgress(projectId: string, userId: string): Promise<void> {
    const client = requireClient();
    const { error } = await client
      .from('progress_tasks')
      .update({ is_completed: false, completed_at: null })
      .eq('project_id', projectId)
      .eq('user_id', userId);
    if (error) throw error;
  }

  // --- SETTINGS (server-side theme persistence) ---

  static async getUserTheme(userId: string): Promise<ThemeMode | null> {
    const client = requireClient();
    const { data } = await client
      .from('user_settings')
      .select('theme')
      .eq('user_id', userId)
      .maybeSingle();
    return data?.theme === 'dark' || data?.theme === 'light' ? data.theme : null;
  }

  static async setUserTheme(userId: string, theme: ThemeMode): Promise<void> {
    const client = requireClient();
    const { error } = await client
      .from('user_settings')
      .upsert({ user_id: userId, theme }, { onConflict: 'user_id' });
    if (error) throw error;
  }
}
