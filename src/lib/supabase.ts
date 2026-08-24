import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProgressProject, ProgressTask, UserProfile, UserSettings } from '../types';

// Detect Supabase env credentials
const metaEnv = (import.meta as any).env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || '';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'MY_SUPABASE_URL');
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Initial high-quality sample data for immediate preview
const INITIAL_PROJECTS: ProgressProject[] = [
  {
    id: 'proj-1',
    user_id: 'demo-user-123',
    title: 'Website Development',
    description: 'Redesign company landing page, improve UX & performance scores.',
    image_url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80',
    accent_color: '#ff6b00',
    is_favorite: true,
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'proj-2',
    user_id: 'demo-user-123',
    title: 'Restaurant Dashboard',
    description: 'POS ordering kiosk integration and inventory tracking system.',
    image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
    accent_color: '#3b82f6',
    is_favorite: false,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'proj-3',
    user_id: 'demo-user-123',
    title: 'Marketing Campaign',
    description: 'Q3 social media push, newsletter series, and Google Ad copy.',
    image_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
    accent_color: '#10b981',
    is_favorite: true,
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'proj-4',
    user_id: 'demo-user-123',
    title: 'Product Launch',
    description: 'Prepare v2 release candidate, press kit, and customer support docs.',
    image_url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80',
    accent_color: '#a855f7',
    is_favorite: false,
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const INITIAL_TASKS: ProgressTask[] = [
  // Website Development tasks (10 total, 7 completed)
  { id: 'task-101', project_id: 'proj-1', user_id: 'demo-user-123', title: 'Figma wireframes & UI design system', description: 'Complete component tokens, colors & responsive layouts.', is_completed: true, position: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-102', project_id: 'proj-1', user_id: 'demo-user-123', title: 'Setup React + Vite + Tailwind setup', description: 'Initialize repository structure.', is_completed: true, position: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-103', project_id: 'proj-1', user_id: 'demo-user-123', title: 'Hero banner section with animation', description: 'Implement smooth fade-in motion.', is_completed: true, position: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-104', project_id: 'proj-1', user_id: 'demo-user-123', title: 'Interactive pricing table component', description: 'Monthly vs annual billing toggle.', is_completed: true, position: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-105', project_id: 'proj-1', user_id: 'demo-user-123', title: 'Contact form & email integration', description: 'Connect with API route handler.', is_completed: true, position: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-106', project_id: 'proj-1', user_id: 'demo-user-123', title: 'SEO Meta tags & OpenGraph card', description: 'Optimize preview cards for social media.', is_completed: true, position: 6, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-107', project_id: 'proj-1', user_id: 'demo-user-123', title: 'Dark mode theme toggle', description: 'Add CSS color variables.', is_completed: true, position: 7, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-108', project_id: 'proj-1', user_id: 'demo-user-123', title: 'Lighthouse score optimization (>95)', description: 'Compress images & optimize bundle chunk sizes.', is_completed: false, position: 8, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-109', project_id: 'proj-1', user_id: 'demo-user-123', title: 'Cross-browser testing (Safari & Chrome)', description: 'Test touch gestures on iOS.', is_completed: false, position: 9, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-110', project_id: 'proj-1', user_id: 'demo-user-123', title: 'Deploy build to Cloud Run', description: 'Configure SSL domain and final check.', is_completed: false, position: 10, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

  // Restaurant Dashboard (5 total, 3 completed)
  { id: 'task-201', project_id: 'proj-2', user_id: 'demo-user-123', title: 'Table management grid view', description: 'Visual map of active seating tables.', is_completed: true, position: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-202', project_id: 'proj-2', user_id: 'demo-user-123', title: 'Kitchen display screen (KDS) live stream', description: 'Order ticket timer badges.', is_completed: true, position: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-203', project_id: 'proj-2', user_id: 'demo-user-123', title: 'Menu item price editor modal', description: 'Quick edit price & availability toggle.', is_completed: true, position: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-204', project_id: 'proj-2', user_id: 'demo-user-123', title: 'Daily revenue analytics chart', description: 'Connect bar graph to sales database.', is_completed: false, position: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-205', project_id: 'proj-2', user_id: 'demo-user-123', title: 'Thermal receipt printer Bluetooth driver', description: 'Format receipt printout layout.', is_completed: false, position: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

  // Marketing (4 total, 2 completed)
  { id: 'task-301', project_id: 'proj-3', user_id: 'demo-user-123', title: 'Draft August newsletter announcement', description: 'Highlight new feature roadmap.', is_completed: true, position: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-302', project_id: 'proj-3', user_id: 'demo-user-123', title: 'Create LinkedIn banner graphics', description: 'Use brand orange color palette.', is_completed: true, position: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-303', project_id: 'proj-3', user_id: 'demo-user-123', title: 'Set up Google Ads campaign', description: 'Target productivity & project management keywords.', is_completed: false, position: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-304', project_id: 'proj-3', user_id: 'demo-user-123', title: 'Schedule Twitter/X thread release', description: 'Write 5-part tips thread.', is_completed: false, position: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

  // Product Launch (15 total, 10 completed)
  { id: 'task-401', project_id: 'proj-4', user_id: 'demo-user-123', title: 'Finalize v2.0 release notes', description: 'Document all new additions & fixes.', is_completed: true, position: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-402', project_id: 'proj-4', user_id: 'demo-user-123', title: 'Record Product Hunt promo video', description: '60 second high energy walkthrough.', is_completed: true, position: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-403', project_id: 'proj-4', user_id: 'demo-user-123', title: 'Prepare press release kit', description: 'Logos, high-res screenshots & quotes.', is_completed: true, position: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-404', project_id: 'proj-4', user_id: 'demo-user-123', title: 'Update Help Center FAQ articles', description: 'Add tutorials for glass navigation & themes.', is_completed: true, position: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-405', project_id: 'proj-4', user_id: 'demo-user-123', title: 'Beta user feedback survey analysis', description: 'Review top 10 requested improvements.', is_completed: true, position: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-406', project_id: 'proj-4', user_id: 'demo-user-123', title: 'Verify Supabase RLS security policies', description: 'Audit table permissions for auth users.', is_completed: true, position: 6, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-407', project_id: 'proj-4', user_id: 'demo-user-123', title: 'Configure CDN cache headers', description: 'Speed up asset delivery globally.', is_completed: true, position: 7, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-408', project_id: 'proj-4', user_id: 'demo-user-123', title: 'Perform load testing with 10k users', description: 'Verify database connection pool limits.', is_completed: true, position: 8, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-409', project_id: 'proj-4', user_id: 'demo-user-123', title: 'Audit dark mode color contrast ratios', description: 'Ensure WCAG AA compliance.', is_completed: true, position: 9, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-410', project_id: 'proj-4', user_id: 'demo-user-123', title: 'Automated backup script test', description: 'Verify database point-in-time recovery.', is_completed: true, position: 10, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-411', project_id: 'proj-4', user_id: 'demo-user-123', title: 'Host live launch livestream', description: 'Q&A session with community.', is_completed: false, position: 11, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-412', project_id: 'proj-4', user_id: 'demo-user-123', title: 'Monitor error logs on launch day', description: 'Track Sentry & server logs.', is_completed: false, position: 12, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-413', project_id: 'proj-4', user_id: 'demo-user-123', title: 'Send email blast to early waitlist', description: 'Trigger broadcast mailer.', is_completed: false, position: 13, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-414', project_id: 'proj-4', user_id: 'demo-user-123', title: 'Post to HackerNews & Reddit', description: 'Show HN submission.', is_completed: false, position: 14, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'task-415', project_id: 'proj-4', user_id: 'demo-user-123', title: 'Post-launch metrics retrospective', description: 'Review signups, retention & conversion.', is_completed: false, position: 15, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

// Helper to manage persistent store
const STORAGE_KEYS = {
  PROJECTS: 'tudu_projects_v1',
  TASKS: 'tudu_tasks_v1',
  USER: 'tudu_user_v1',
  SETTINGS: 'tudu_settings_v1',
};

// Initialize Local Store if empty
function initializeLocalStore() {
  if (!localStorage.getItem(STORAGE_KEYS.PROJECTS)) {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(INITIAL_PROJECTS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.TASKS)) {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(INITIAL_TASKS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.USER)) {
    const demoUser: UserProfile = {
      id: 'demo-profile-123',
      user_id: 'demo-user-123',
      email: 'demo@tudu.app',
      name: 'Alex Rivera',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(demoUser));
  }
}

// Data Service API that seamlessly bridges Supabase & Local Fallback
export class DataService {
  // --- USER PROFILE ---
  static async getCurrentUser(): Promise<UserProfile | null> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (profile) return profile;
          return {
            id: user.id,
            user_id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            avatar_url: user.user_metadata?.avatar_url,
            created_at: user.created_at,
            updated_at: new Date().toISOString(),
          };
        }
      } catch (e) {
        console.warn('Supabase profile fetch error, using local state:', e);
      }
    }

    initializeLocalStore();
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  }

  // --- PROJECTS ---
  static async getProjects(userId: string): Promise<ProgressProject[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: projects, error } = await supabase
          .from('progress_projects')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && projects) {
          // Compute stats
          const { data: tasks } = await supabase
            .from('progress_tasks')
            .select('project_id, is_completed')
            .eq('user_id', userId);

          return projects.map((p) => {
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
      } catch (err) {
        console.warn('Supabase projects fetch failed:', err);
      }
    }

    // Local Fallback
    initializeLocalStore();
    const rawProjects: ProgressProject[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]');
    const rawTasks: ProgressTask[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS) || '[]');

    return rawProjects.map((p) => {
      const pTasks = rawTasks.filter((t) => t.project_id === p.id);
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

  static async createProject(projectData: Omit<ProgressProject, 'id' | 'created_at' | 'updated_at'>): Promise<ProgressProject> {
    const newProject: ProgressProject = {
      ...projectData,
      id: isSupabaseConfigured() ? crypto.randomUUID() : `proj-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      total_tasks: 0,
      completed_tasks: 0,
      pending_tasks: 0,
      completion_percentage: 0,
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('progress_projects')
          .insert([{
            id: newProject.id,
            user_id: newProject.user_id,
            title: newProject.title,
            description: newProject.description,
            image_url: newProject.image_url,
            accent_color: newProject.accent_color,
            is_favorite: newProject.is_favorite,
          }])
          .select()
          .single();

        if (!error && data) return { ...data, total_tasks: 0, completed_tasks: 0, pending_tasks: 0, completion_percentage: 0 };
      } catch (e) {
        console.warn('Supabase create project error:', e);
      }
    }

    initializeLocalStore();
    const projects: ProgressProject[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]');
    projects.unshift(newProject);
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    return newProject;
  }

  static async updateProject(projectId: string, updates: Partial<ProgressProject>): Promise<void> {
    const updatedAt = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('progress_projects')
          .update({ ...updates, updated_at: updatedAt })
          .eq('id', projectId);
      } catch (e) {
        console.warn('Supabase update project error:', e);
      }
    }

    initializeLocalStore();
    const projects: ProgressProject[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]');
    const index = projects.findIndex((p) => p.id === projectId);
    if (index !== -1) {
      projects[index] = { ...projects[index], ...updates, updated_at: updatedAt };
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    }
  }

  static async deleteProject(projectId: string): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('progress_projects').delete().eq('id', projectId);
      } catch (e) {
        console.warn('Supabase delete project error:', e);
      }
    }

    initializeLocalStore();
    const projects: ProgressProject[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]');
    const tasks: ProgressTask[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS) || '[]');

    const updatedProjects = projects.filter((p) => p.id !== projectId);
    const updatedTasks = tasks.filter((t) => t.project_id !== projectId);

    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(updatedProjects));
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(updatedTasks));
  }

  // --- TASKS ---
  static async getTasks(userId: string, projectId?: string): Promise<ProgressTask[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase
          .from('progress_tasks')
          .select('*')
          .eq('user_id', userId)
          .order('position', { ascending: true })
          .order('created_at', { ascending: false });

        if (projectId) {
          query = query.eq('project_id', projectId);
        }

        const { data: tasks, error } = await query;
        if (!error && tasks) return tasks;
      } catch (err) {
        console.warn('Supabase tasks fetch failed:', err);
      }
    }

    initializeLocalStore();
    const rawTasks: ProgressTask[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS) || '[]');
    let userTasks = rawTasks.filter((t) => t.user_id === userId || userId === 'demo-user-123');
    if (projectId) {
      userTasks = userTasks.filter((t) => t.project_id === projectId);
    }
    return userTasks.sort((a, b) => a.position - b.position);
  }

  static async createTask(taskData: Omit<ProgressTask, 'id' | 'created_at' | 'updated_at'>): Promise<ProgressTask> {
    const newTask: ProgressTask = {
      ...taskData,
      id: isSupabaseConfigured() ? crypto.randomUUID() : `task-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: taskData.is_completed ? new Date().toISOString() : null,
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('progress_tasks')
          .insert([{
            id: newTask.id,
            project_id: newTask.project_id,
            user_id: newTask.user_id,
            title: newTask.title,
            description: newTask.description,
            image_url: newTask.image_url,
            is_completed: newTask.is_completed,
            position: newTask.position,
            completed_at: newTask.completed_at,
          }])
          .select()
          .single();

        if (!error && data) {
          // Touch project updated_at
          await this.updateProject(newTask.project_id, { updated_at: new Date().toISOString() });
          return data;
        }
      } catch (e) {
        console.warn('Supabase create task error:', e);
      }
    }

    initializeLocalStore();
    const tasks: ProgressTask[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS) || '[]');
    tasks.unshift(newTask);
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    await this.updateProject(newTask.project_id, { updated_at: new Date().toISOString() });
    return newTask;
  }

  static async toggleTaskCompletion(taskId: string, isCompleted: boolean): Promise<ProgressTask | null> {
    const updatedAt = new Date().toISOString();
    const completedAt = isCompleted ? updatedAt : null;

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('progress_tasks')
          .update({
            is_completed: isCompleted,
            completed_at: completedAt,
            updated_at: updatedAt,
          })
          .eq('id', taskId)
          .select()
          .single();

        if (!error && data) {
          await this.updateProject(data.project_id, { updated_at: updatedAt });
          return data;
        }
      } catch (e) {
        console.warn('Supabase toggle task error:', e);
      }
    }

    initializeLocalStore();
    const tasks: ProgressTask[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS) || '[]');
    const index = tasks.findIndex((t) => t.id === taskId);
    if (index !== -1) {
      tasks[index] = {
        ...tasks[index],
        is_completed: isCompleted,
        completed_at: completedAt,
        updated_at: updatedAt,
      };
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
      await this.updateProject(tasks[index].project_id, { updated_at: updatedAt });
      return tasks[index];
    }
    return null;
  }

  static async updateTask(taskId: string, updates: Partial<ProgressTask>): Promise<void> {
    const updatedAt = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('progress_tasks')
          .update({ ...updates, updated_at: updatedAt })
          .eq('id', taskId);
      } catch (e) {
        console.warn('Supabase update task error:', e);
      }
    }

    initializeLocalStore();
    const tasks: ProgressTask[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS) || '[]');
    const index = tasks.findIndex((t) => t.id === taskId);
    if (index !== -1) {
      tasks[index] = { ...tasks[index], ...updates, updated_at: updatedAt };
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
      await this.updateProject(tasks[index].project_id, { updated_at: updatedAt });
    }
  }

  static async deleteTask(taskId: string): Promise<void> {
    initializeLocalStore();
    const tasks: ProgressTask[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS) || '[]');
    const target = tasks.find((t) => t.id === taskId);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('progress_tasks').delete().eq('id', taskId);
      } catch (e) {
        console.warn('Supabase delete task error:', e);
      }
    }

    const updatedTasks = tasks.filter((t) => t.id !== taskId);
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(updatedTasks));

    if (target) {
      await this.updateProject(target.project_id, { updated_at: new Date().toISOString() });
    }
  }
}
