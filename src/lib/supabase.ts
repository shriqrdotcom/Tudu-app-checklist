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
  return patch;
}

async function touchProject(client: SupabaseClient, projectId: string): Promise<void> {
  await client
    .from('progress_projects')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', projectId);
}

export class DataService {
  // --- AUTH / PROFILE ---

  static async getCurrentUser(): Promise<UserProfile | null> {
    const client = requireClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error) throw error;
    if (!user) return null;

    // A valid session IS an authenticated user — never fail login just
    // because the profiles table is missing or not provisioned yet.
    const fallbackProfile: UserProfile = {
      id: user.id,
      user_id: user.id,
      email: user.email ?? undefined,
      name:
        (user.user_metadata?.name as string) ||
        user.email?.split('@')[0] ||
        'TU DU User',
      avatar_url: (user.user_metadata?.avatar_url as string) || undefined,
      created_at: user.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.warn('[TU DU] profiles table unavailable — using auth metadata for this session.');
        return fallbackProfile;
      }
      if (profile) return { ...profile, email: user.email ?? undefined };

      // No row yet — create one (the DB trigger normally handles this)
      const { data: created, error: insertError } = await client
        .from('profiles')
        .insert({ user_id: user.id, name: fallbackProfile.name })
        .select()
        .single();
      if (insertError) return fallbackProfile;
      return { ...created, email: user.email ?? undefined };
    } catch {
      console.warn('[TU DU] profiles lookup failed — using auth metadata for this session.');
      return fallbackProfile;
    }
  }

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

  // --- PROJECTS ---

  static async getProjects(userId: string): Promise<ProgressProject[]> {
    const client = requireClient();
    const { data: projects, error } = await client
      .from('progress_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const { data: tasks, error: tasksError } = await client
      .from('progress_tasks')
      .select('project_id, is_completed')
      .eq('user_id', userId);
    if (tasksError) throw tasksError;

    return (projects || []).map((p) => {
      const pTasks = (tasks || []).filter((t) => t.project_id === p.id);
      const total = pTasks.length;
      const completed = pTasks.filter((t) => t.is_completed).length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
      return {
        ...p,
        total_tasks: total,
        completed_tasks: completed,
        pending_tasks: total - completed,
        completion_percentage: percentage,
      };
    });
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
    >
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
      })
      .select()
      .single();
    if (error) throw error;

    await touchProject(client, taskData.project_id);
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

    if (data) await touchProject(client, data.project_id);
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

    if (data) await touchProject(client, data.project_id);
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

    if (data) await touchProject(client, data.project_id);
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
