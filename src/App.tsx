import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Header } from './components/Header';
import { BottomNavigation } from './components/BottomNavigation';
import { ToastContainer } from './components/Toast';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Button } from './components/Button';
import { LoadingState } from './components/LoadingState';
import { EditProjectModal } from './components/EditProjectModal';
import { EditTaskModal } from './components/EditTaskModal';
import { EmptyState } from './components/EmptyState';
import { DashboardView } from './views/DashboardView';
import { CreateView } from './views/CreateView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { AuthModal } from './views/AuthModal';
import { ProfileView } from './views/ProfileView';
import { DataService, isSupabaseConfigured, supabase } from './lib/supabase';
import { deleteStorageFileFromUrl, isSupabaseStorageUrl } from './lib/storage';
import { ProgressProject, ProgressTask, UserProfile, ViewTab, ThemeMode, ToastMessage } from './types';

export default function App() {
  // Theme State (localStorage + user_settings persistence)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('tudu_theme_v1');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Navigation & View State
  const [activeTab, setActiveTab] = useState<ViewTab>('dashboard');
  const [selectedProject, setSelectedProject] = useState<ProgressProject | null>(null);
  const [searchSignal, setSearchSignal] = useState(0);

  // Data State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<ProgressProject[]>([]);
  const [tasks, setTasks] = useState<ProgressTask[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [updateReady, setUpdateReady] = useState<boolean>(false);

  // Modals & Dialogs
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProgressProject | null>(null);
  const [editingTask, setEditingTask] = useState<ProgressTask | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Apply Theme class to <html> element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('tudu_theme_v1', theme);
  }, [theme]);

  const addToast = useCallback(
    (type: 'success' | 'error' | 'info', title: string, description?: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, title, description }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Persist theme to the user's server-side settings (fire & forget)
  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return;
    DataService.setUserTheme(user.user_id, theme).catch((err) =>
      console.warn('Failed to persist theme:', err)
    );
  }, [theme, user]);

  // Ref keeps latest theme without re-triggering loadData
  const themeRef = React.useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  // Tracks the newest loadData invocation for the race guard
  const loadRequestIdRef = React.useRef(0);
  // Loading-mode separation: initial load (may show skeletons/full-screen)
  // vs background refresh (never blocks the visible UI).
  const hasLoadedOnceRef = React.useRef(false);
  const userRef = React.useRef(user);
  const isFetchingRef = React.useRef(false);
  const lastFetchedAtRef = React.useRef(0);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Load User & App Data — only the newest call may apply state (race guard).
  // When a user is already on screen this runs as a BACKGROUND refresh:
  // existing UI stays visible, no skeleton/full-page spinner.
  const loadData = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    const isStale = () => requestId !== loadRequestIdRef.current;
    const isBackground = hasLoadedOnceRef.current && Boolean(userRef.current);

    if (!isSupabaseConfigured() || !supabase) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    isFetchingRef.current = true;
    if (isBackground) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
      setLoadError(null);
    }

    try {
      const currentUser = await DataService.getCurrentUser();
      if (isStale()) return;
      setUser(currentUser);

      if (currentUser) {
        // Fetch tasks once; project stats are computed from them (no duplicate query)
        const fetchedTasks = await DataService.getTasks(currentUser.user_id);
        if (isStale()) return;
        const fetchedProjects = await DataService.getProjects(currentUser.user_id, fetchedTasks);
        if (isStale()) return;
        setProjects(fetchedProjects);
        setTasks(fetchedTasks);

        // Adopt the server-side theme preference when available
        try {
          const remoteTheme = await DataService.getUserTheme(currentUser.user_id);
          if (!isStale() && remoteTheme && remoteTheme !== themeRef.current) {
            themeRef.current = remoteTheme;
            setTheme(remoteTheme);
          }
        } catch {
          /* settings row may not exist yet — non-fatal */
        }
      } else {
        setProjects([]);
        setTasks([]);
        setSelectedProject(null);
      }
    } catch {
      if (isStale()) return;
      if (isBackground) {
        // Keep the current UI and data — just note the refresh failed.
        console.warn('[TU DU] Background refresh failed — keeping current data.');
      } else {
        // Never surface raw database errors
        setLoadError('Unable to load your progress. Please try again.');
      }
    } finally {
      if (!isStale()) {
        hasLoadedOnceRef.current = true;
        lastFetchedAtRef.current = Date.now();
        isFetchingRef.current = false;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadData();

    if (isSupabaseConfigured() && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        // TOKEN_REFRESHED: session stays valid — no refetch needed.
        // INITIAL_SESSION: the mount effect above already performs the first load.
        if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return;
        loadData();
      });
      return () => subscription.unsubscribe();
    }
  }, [loadData]);

  // Smart background refresh on tab return / network recovery.
  // The visible UI is never replaced — data updates in place when actually stale.
  useEffect(() => {
    const maybeRefresh = (minAgeMs: number) => {
      if (!userRef.current) return;            // only for signed-in users
      if (isFetchingRef.current) return;       // a load is already in flight
      const age = Date.now() - lastFetchedAtRef.current;
      if (age > minAgeMs) loadData();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') maybeRefresh(60_000);
    };
    const handleOnline = () => maybeRefresh(30_000);

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [loadData]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleAuthSuccess = () => {
    addToast('success', 'Welcome back!');
    // onAuthStateChange triggers loadData automatically
  };

  // Brand logo load failure fallback (asset may not be provisioned yet)
  const [logoFailed, setLogoFailed] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await DataService.signOut();
      addToast('info', 'Signed out successfully');
    } catch (err: any) {
      console.error('Sign out failed:', err);
      addToast('error', 'Sign out failed', 'Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Recompute a project's live statistics from the given tasks array (no refetch).
  const recomputeProjectStats = useCallback(
    (projectId: string, tasksSource: ProgressTask[]) => {
      const pTasks = tasksSource.filter((t) => t.project_id === projectId);
      const total = pTasks.length;
      const completed = pTasks.filter((t) => t.is_completed).length;
      const patch: Partial<ProgressProject> = {
        total_tasks: total,
        completed_tasks: completed,
        pending_tasks: total - completed,
        completion_percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        updated_at: new Date().toISOString(),
      };
      setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, ...patch } : p)));
      setSelectedProject((prev) => (prev && prev.id === projectId ? { ...prev, ...patch } : prev));
    },
    []
  );

  const handleUpdateUser = (updated: UserProfile) => {
    setUser(updated);
    addToast('success', 'Profile updated');
  };

  // ---------------- Realtime sync (same-account multi-session) ----------------
  // Row id is the identity: every event is an idempotent upsert/remove, so
  // echoes of this device's own optimistic mutations never duplicate rows.

  // Refs keep handlers stable and read fresh state without re-subscribing.
  const projectsRef = React.useRef(projects);
  const tasksRef = React.useRef(tasks);
  useEffect(() => {
    projectsRef.current = projects;
    tasksRef.current = tasks;
  }, [projects, tasks]);

  const handleProjectChange = useCallback((payload: any) => {
    const { eventType, new: newRow, old } = payload;

    if (eventType === 'DELETE') {
      const id = old?.id;
      if (!id) return;
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setTasks((prev) => prev.filter((t) => t.project_id !== id));
      setSelectedProject((prev) => (prev?.id === id ? null : prev));
      return;
    }

    const row = newRow as ProgressProject;
    if (!row?.id) return;
    setProjects((prev) => {
      const idx = prev.findIndex((p) => p.id === row.id);
      if (idx === -1) {
        // New project from another session — stats start at zero
        return [
          { ...row, total_tasks: 0, completed_tasks: 0, pending_tasks: 0, completion_percentage: 0 },
          ...prev,
        ];
      }
      // Merge DB columns; keep locally computed stats intact
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...row };
      return copy;
    });
    setSelectedProject((prev) => (prev && prev.id === row.id ? { ...prev, ...row } : prev));
  }, []);

  const handleTaskChange = useCallback(
    (payload: any) => {
      const { eventType, new: newRow, old } = payload;

      if (eventType === 'DELETE') {
        const id = old?.id;
        if (!id) return;
        const target = tasksRef.current.find((t) => t.id === id);
        const next = tasksRef.current.filter((t) => t.id !== id);
        setTasks(next);
        if (target) recomputeProjectStats(target.project_id, next);
        return;
      }

      const row = newRow as ProgressTask;
      if (!row?.id) return;
      const idx = tasksRef.current.findIndex((t) => t.id === row.id);
      const next =
        idx === -1
          ? [row, ...tasksRef.current]
          : tasksRef.current.map((t) => (t.id === row.id ? { ...t, ...row } : t));
      setTasks(next);
      recomputeProjectStats(row.project_id, next);
    },
    [recomputeProjectStats]
  );

  // Subscribe while authenticated; stop on logout; never duplicate channels.
  useEffect(() => {
    if (!user || !supabase) return;
    const uid = user.user_id;

    const channel = supabase
      .channel(`tudu-realtime-${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'progress_projects', filter: `user_id=eq.${uid}` },
        handleProjectChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'progress_tasks', filter: `user_id=eq.${uid}` },
        handleTaskChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, handleProjectChange, handleTaskChange]);

  // ---------------- PWA update flow ----------------
  const applyingUpdateRef = React.useRef(false);
  useEffect(() => {
    const onUpdateReady = () => setUpdateReady(true);
    window.addEventListener('tudu-update-ready', onUpdateReady);
    return () => window.removeEventListener('tudu-update-ready', onUpdateReady);
  }, []);

  const applyAppUpdate = () => {
    if (applyingUpdateRef.current) return;
    applyingUpdateRef.current = true;
    navigator.serviceWorker?.controller?.postMessage({ type: 'SKIP_WAITING' });
    navigator.serviceWorker?.addEventListener(
      'controllerchange',
      () => window.location.reload(),
      { once: true }
    );
  };

  // Project Actions
  const handleCreateProject = async (projectData: {
    title: string;
    description: string;
    image_url: string;
    accent_color: string;
    is_favorite: boolean;
  }): Promise<ProgressProject> => {
    if (!user) throw new Error('You must be signed in.');
    const created = await DataService.createProject({ user_id: user.user_id, ...projectData });
    // Insert the returned row locally — no refetch needed
    setProjects((prev) => [created, ...prev]);
    // Navigate straight into the new Progress Detail workspace
    setSelectedProject(created);
    addToast('success', 'Progress created successfully', `"${created.title}" is ready.`);
    return created;
  };

  const handleUpdateProject = async (projectId: string, updates: Partial<ProgressProject>) => {
    try {
      await DataService.updateProject(projectId, updates);
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, ...updates } : p))
      );
      if (selectedProject?.id === projectId) {
        setSelectedProject((prev) => (prev ? { ...prev, ...updates } : null));
      }
      addToast('success', 'Progress updated');
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Update failed', err?.message);
    }
  };

  const handleSaveProjectEdit = async (updates: {
    title: string;
    description: string;
    image_url: string;
    accent_color: string;
    is_favorite: boolean;
  }) => {
    if (!editingProject) return;
    const oldImage = editingProject.image_url || '';

    await DataService.updateProject(editingProject.id, updates);

    // Reflect immediately in local state
    setProjects((prev) =>
      prev.map((p) => (p.id === editingProject.id ? { ...p, ...updates } : p))
    );
    if (selectedProject?.id === editingProject.id) {
      setSelectedProject((prev) => (prev ? { ...prev, ...updates } : null));
    }
    addToast('success', 'Progress updated');

    // Best-effort cleanup of the replaced storage file — only after a successful save
    if (oldImage && oldImage !== updates.image_url && isSupabaseStorageUrl(oldImage)) {
      deleteStorageFileFromUrl(oldImage);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const target = projects.find((p) => p.id === projectId);
      await DataService.deleteProject(projectId);
      // Remove project + its tasks locally — no refetch needed
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setTasks((prev) => prev.filter((t) => t.project_id !== projectId));
      // Return to the Progress Dashboard after deletion
      setSelectedProject(null);
      addToast('success', 'Progress deleted', target ? `"${target.title}" and its tasks were removed.` : undefined);
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Delete failed', 'Please try again.');
    }
  };

  const handleToggleFavorite = async (projectId: string, current: boolean) => {
    const nextState = !current;
    // Optimistic update, revert on failure
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, is_favorite: nextState } : p))
    );
    if (selectedProject?.id === projectId) {
      setSelectedProject((prev) => (prev ? { ...prev, is_favorite: nextState } : prev));
    }
    try {
      await DataService.updateProject(projectId, { is_favorite: nextState });
    } catch {
      console.error('Favorite update failed');
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, is_favorite: current } : p))
      );
      if (selectedProject?.id === projectId) {
        setSelectedProject((prev) => (prev ? { ...prev, is_favorite: current } : prev));
      }
      addToast('error', 'Could not update favorite', 'Please try again.');
    }
  };

  // Task Actions
  const handleCreateTask = async (taskData: {
    project_id: string;
    title: string;
    description?: string;
    image_url?: string;
    is_favorite?: boolean;
  }): Promise<ProgressTask> => {
    if (!user) throw new Error('You must be signed in.');

    // Verify the target project belongs to the authenticated user (RLS is final layer)
    const targetProject = projects.find((p) => p.id === taskData.project_id);
    if (!targetProject) {
      throw new Error('Selected progress was not found.');
    }

    const newTask = await DataService.createTask({
      project_id: taskData.project_id,
      user_id: user.user_id,
      title: taskData.title,
      description: taskData.description || '',
      image_url: taskData.image_url || '',
      is_completed: false,
      is_favorite: taskData.is_favorite ?? false,
      position: 0, // server assigns next position
    });

    // Insert the returned row and update stats locally — no refetch
    const nextTasks = [newTask, ...tasks];
    setTasks(nextTasks);
    recomputeProjectStats(taskData.project_id, nextTasks);
    // Jump into that Progress Detail workspace
    setSelectedProject((prev) =>
      prev && prev.id === targetProject.id
        ? { ...prev, ...targetProject }
        : { ...targetProject }
    );
    addToast('success', 'Task added successfully', `"${newTask.title}" was added to ${targetProject.title}.`);
    return newTask;
  };

  const handleToggleTaskComplete = async (taskId: string, isCompleted: boolean) => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;

    // Optimistic update + instant local stats recompute
    const nextTasks = tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            is_completed: isCompleted,
            completed_at: isCompleted ? new Date().toISOString() : null,
          }
        : t
    );
    setTasks(nextTasks);
    recomputeProjectStats(target.project_id, nextTasks);

    // Inline pending indicator while Supabase confirms
    setPendingTaskIds((prev) => new Set(prev).add(taskId));
    try {
      await DataService.toggleTaskCompletion(taskId, isCompleted);
    } catch {
      console.error('Task completion update failed');
      // Revert UI to the previous state
      const reverted = nextTasks.map((t) =>
        t.id === taskId
          ? { ...t, is_completed: !isCompleted, completed_at: target.completed_at ?? null }
          : t
      );
      setTasks(reverted);
      recomputeProjectStats(target.project_id, reverted);
      addToast('error', 'Could not update task', 'Please try again.');
    } finally {
      setPendingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const handleToggleTaskFavorite = async (taskId: string, current: boolean) => {
    const next = !current;
    // Optimistic update, silent success, revert on failure
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, is_favorite: next } : t)));

    try {
      await DataService.updateTask(taskId, { is_favorite: next });
    } catch {
      console.error('Favorite update failed');
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, is_favorite: current } : t)));
      addToast('error', 'Could not update favorite', 'Please try again.');
    }
  };

  const confirmResetProgress = async () => {
    if (!selectedProject || !user) return;
    setShowResetDialog(false);

    try {
      setIsResetting(true);
      await DataService.resetProjectProgress(selectedProject.id, user.user_id);
      // Update all of this project's tasks locally — no refetch
      const nextTasks = tasks.map((t) =>
        t.project_id === selectedProject.id
          ? { ...t, is_completed: false, completed_at: null }
          : t
      );
      setTasks(nextTasks);
      recomputeProjectStats(selectedProject.id, nextTasks);
      addToast('success', 'Progress reset', 'All tasks were marked incomplete. No tasks were deleted.');
    } catch {
      console.error('Reset failed');
      addToast('error', 'Reset failed', 'Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<ProgressTask>) => {
    try {
      await DataService.updateTask(taskId, updates);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)));
      addToast('success', 'Task updated');
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Update failed', err?.message);
    }
  };

  const handleSaveTaskEdit = async (updates: {
    title: string;
    description: string;
    image_url: string;
    is_favorite: boolean;
    project_id: string;
  }) => {
    if (!editingTask) return;
    const oldImage = editingTask.image_url || '';
    const oldProjectId = editingTask.project_id;

    await DataService.updateTask(editingTask.id, updates);

    // Apply locally and recompute stats for BOTH projects when moved — no refetch
    const nextTasks = tasks.map((t) =>
      t.id === editingTask.id ? { ...t, ...updates } : t
    );
    setTasks(nextTasks);
    recomputeProjectStats(updates.project_id, nextTasks);
    if (oldProjectId !== updates.project_id) {
      recomputeProjectStats(oldProjectId, nextTasks);
    }
    addToast('success', 'Task updated');

    if (oldImage && oldImage !== updates.image_url && isSupabaseStorageUrl(oldImage)) {
      deleteStorageFileFromUrl(oldImage);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const target = tasks.find((t) => t.id === taskId);
    try {
      await DataService.deleteTask(taskId);
      // Remove locally and recompute the parent project's stats — no refetch
      const nextTasks = tasks.filter((t) => t.id !== taskId);
      setTasks(nextTasks);
      if (target) recomputeProjectStats(target.project_id, nextTasks);
      addToast('success', 'Task deleted');
    } catch {
      console.error('Task delete failed');
      addToast('error', 'Delete failed', 'Please try again.');
    }
  };

  // ---------- Render ----------

  // Loading screen while session restores
  if (isLoading && !user) {
    return <LoadingState fullScreen label="Loading TU DU..." description="Restoring your session" />;
  }

  // Protected route gate — real Supabase auth required for app content
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="flex justify-end px-6 pt-6">
          <Header
            theme={theme}
            onToggleTheme={toggleTheme}
            user={null}
            onOpenAuth={() => setIsAuthOpen(true)}
            onOpenProfile={() => setIsAuthOpen(true)}
          />
        </div>

        <main className="flex-1 flex items-center justify-center px-4 pb-24">
          <div className="w-full max-w-sm text-center space-y-6 glass-panel border border-white/40 dark:border-zinc-800/80 rounded-3xl shadow-2xl p-8">
            {logoFailed ? (
              <div className="mx-auto w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30 orange-glow">
                <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
              </div>
            ) : (
              <img
                src="/brand/tudu-logo.png"
                alt="TU DU logo"
                className="mx-auto w-16 h-16 rounded-2xl shadow-lg shadow-orange-500/30 orange-glow"
                onError={() => setLogoFailed(true)}
              />
            )}
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                TU DU <span className="text-orange-500">★</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 leading-relaxed">
                Create Progress → Add Tasks → Complete Tasks → Track Completion.
                Sign in to sync your progress securely.
              </p>
            </div>
            <Button fullWidth size="lg" onClick={() => setIsAuthOpen(true)}>
              Sign In
            </Button>
          </div>
        </main>

        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onAuthSuccess={handleAuthSuccess}
        />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </div>
    );
  }

  const userId = user.user_id;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-200">
      {/* Top Header */}
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenProfile={() => {
          setSelectedProject(null);
          setActiveTab('profile');
        }}
        onSearch={() => {
          setSelectedProject(null);
          setActiveTab('dashboard');
          setSearchSignal((s) => s + 1);
        }}
        contextTitle={selectedProject ? selectedProject.title : undefined}
        onBrandClick={() => {
          setSelectedProject(null);
          setActiveTab('dashboard');
        }}
      />

      {/* Main View Container */}
      {/* Subtle non-blocking background-refresh indicator */}
      {isRefreshing && (
        <div
          role="status"
          className="fixed top-20 right-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel shadow-md text-[11px] font-semibold text-slate-500 dark:text-zinc-300"
        >
          <span className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
          Updating…
        </div>
      )}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6">
        {selectedProject && !projects.some((p) => p.id === selectedProject.id) ? (
          /* Deleted/missing project fallback */
          <div className="max-w-3xl mx-auto">
            <EmptyState
              title="Progress not found"
              description="This progress no longer exists or was deleted."
              actionLabel="Back to Progress"
              onAction={() => setSelectedProject(null)}
              type="search"
            />
          </div>
        ) : selectedProject ? (
          <ProjectDetailView
            project={selectedProject}
            tasks={tasks}
            isResetting={isResetting}
            pendingTaskIds={pendingTaskIds}
            onBack={() => setSelectedProject(null)}
            onToggleTaskComplete={handleToggleTaskComplete}
            onToggleTaskFavorite={handleToggleTaskFavorite}
            onAddTask={handleCreateTask}
            onDeleteTask={(id) => setDeletingTaskId(id)}
            onEditTask={(task) => setEditingTask(task)}
            onToggleFavorite={handleToggleFavorite}
            onEditProject={(project) => setEditingProject(project)}
            onDeleteProject={(id) => setDeletingProjectId(id)}
            onRequestReset={() => setShowResetDialog(true)}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                projects={projects}
                tasks={tasks}
                isLoading={isLoading}
                error={loadError}
                onRetry={loadData}
                searchSignal={searchSignal}
                onOpenProject={(proj) => setSelectedProject(proj)}
                onToggleFavorite={handleToggleFavorite}
                onNavigateCreate={() => setActiveTab('create')}
              />
            )}

            {activeTab === 'create' && (
              <CreateView
                projects={projects}
                userId={userId}
                onCreateProject={handleCreateProject}
                onCreateTask={handleCreateTask}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileView
                user={user}
                theme={theme}
                isLoggingOut={isLoggingOut}
                onThemeChange={(t) => setTheme(t)}
                onToggleTheme={toggleTheme}
                onUpdateUser={handleUpdateUser}
                onLogout={handleLogout}
              />
            )}
          </>
        )}
      </main>

      {/* PWA update prompt — user-initiated, never an automatic reload */}
      {updateReady && (
        <div className="fixed bottom-24 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-full glass-panel shadow-2xl border border-white/40 dark:border-zinc-800/80">
            <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">
              New version available
            </span>
            <Button size="sm" onClick={applyAppUpdate}>
              Refresh
            </Button>
          </div>
        </div>
      )}

      {/* Glassmorphism Bottom Floating Navigation Bar */}
      <BottomNavigation
        activeTab={selectedProject ? 'dashboard' : activeTab}
        onSelectTab={(tab) => {
          setSelectedProject(null);
          setActiveTab(tab);
        }}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Edit Progress Modal */}
      {editingProject && (
        <EditProjectModal
          project={editingProject}
          userId={userId}
          onClose={() => setEditingProject(null)}
          onSave={handleSaveProjectEdit}
        />
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          projects={projects}
          userId={userId}
          onClose={() => setEditingTask(null)}
          onSave={handleSaveTaskEdit}
        />
      )}

      {/* Delete Progress Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingProjectId)}
        onClose={() => setDeletingProjectId(null)}
        onConfirm={() => {
          if (deletingProjectId) handleDeleteProject(deletingProjectId);
        }}
        title="Delete this Progress?"
        message="This will permanently delete the Progress and its checklist tasks. This action cannot be undone."
        confirmLabel="Delete Progress"
        isDangerous={true}
      />

      {/* Delete Task Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingTaskId)}
        onClose={() => setDeletingTaskId(null)}
        onConfirm={() => {
          if (deletingTaskId) handleDeleteTask(deletingTaskId);
        }}
        title="Delete this task?"
        message="This checklist item will be permanently deleted."
        confirmLabel="Delete"
        isDangerous={true}
      />

      {/* Reset Progress Confirmation */}
      <ConfirmDialog
        isOpen={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={confirmResetProgress}
        title="Reset Progress?"
        message="Reset all tasks in this progress? Tasks will become incomplete but will NOT be deleted. Completion stats will restart from zero."
        confirmLabel="Reset Progress"
        isDangerous={false}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
