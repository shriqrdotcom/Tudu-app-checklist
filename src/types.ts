export type ThemeMode = 'light' | 'dark';

export interface UserProfile {
  id: string;
  user_id: string;
  email?: string;
  name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ProgressProject {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  image_url?: string;
  accent_color: string; // e.g. '#ff6b00', '#3b82f6', '#10b981', '#a855f7', '#ec4899'
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  
  // Computed client stats
  total_tasks?: number;
  completed_tasks?: number;
  pending_tasks?: number;
  completion_percentage?: number;
}

export interface ProgressTask {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  description?: string;
  image_url?: string;
  is_completed: boolean;
  is_favorite: boolean;
  position: number;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;

  // Reminder & Notification Engine (Phase 10)
  /** User-scheduled deadline (ISO string). NULL = no reminder. */
  due_datetime?: string | null;
  /** Latched once the overdue alert fired for the current deadline. */
  notified?: boolean;
  /** Snooze target — suppresses re-alerting until this instant passes. */
  snooze_until?: string | null;
}

export interface UserSettings {
  id?: string;
  user_id: string;
  theme: ThemeMode;
  created_at?: string;
  updated_at?: string;
}

export type ViewTab = 'dashboard' | 'create' | 'profile';

export type SortOption =
  | 'recent_updated'
  | 'recent_created'
  | 'name_asc'
  | 'name_desc'
  | 'completion_high'
  | 'completion_low';

export type FilterStatus = 'all' | 'in_progress' | 'completed' | 'favorites';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}
