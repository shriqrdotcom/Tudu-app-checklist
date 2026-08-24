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
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Modals & Dialogs
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProgressProject | null>(null);
  const [editingTask, setEditingTask] = useState<ProgressTask | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
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

  // Load User & App Data
  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setLoadError(null);
      const currentUser = await DataService.getCurrentUser();
      setUser(currentUser);

      if (currentUser) {
        const [fetchedProjects, fetchedTasks] = await Promise.all([
          DataService.getProjects(currentUser.user_id),
          DataService.getTasks(currentUser.user_id),
        ]);
        setProjects(fetchedProjects);
        setTasks(fetchedTasks);

        // Adopt the server-side theme preference when available
        try {
          const remoteTheme = await DataService.getUserTheme(currentUser.user_id);
          if (remoteTheme && remoteTheme !== themeRef.current) {
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
    } catch (err: any) {
      console.error('Error loading TU DU data:', err);
      // Never surface raw database errors
      setLoadError('Unable to load your progress. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    if (isSupabaseConfigured() && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        // Skip high-frequency token refreshes — session stays valid, no reload needed
        if (event === 'TOKEN_REFRESHED') return;
        loadData();
      });
      return () => subscription.unsubscribe();
    }
  }, [loadData]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleAuthSuccess = () => {
    addToast('success', 'Welcome back!');
    // onAuthStateChange triggers loadData automatically
  };

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

  const handleUpdateUser = (updated: UserProfile) => {
    setUser(updated);
    addToast('success', 'Profile updated');
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
    await loadData();
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
      await loadData();
      // Return to the Progress Dashboard after deletion
      setSelectedProject(null);
      addToast('success', 'Progress deleted', target ? `"${target.title}" and its tasks were removed.` : undefined);
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Delete failed', err?.message);
    }
  };

  const handleToggleFavorite = async (projectId: string, current: boolean) => {
    try {
      const nextState = !current;
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, is_favorite: nextState } : p))
      );
      if (selectedProject?.id === projectId) {
        setSelectedProject((prev) => (prev ? { ...prev, is_favorite: nextState } : null));
      }
      await DataService.updateProject(projectId, { is_favorite: nextState });
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Could not update favorite', err?.message);
      await loadData();
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

    setTasks((prev) => [newTask, ...prev]);
    await loadData(); // refresh computed percentages + counts
    // Jump into that Progress Detail workspace
    setSelectedProject(targetProject);
    addToast('success', 'Task added successfully', `"${newTask.title}" was added to ${targetProject.title}.`);
    return newTask;
  };

  const handleToggleTaskComplete = async (taskId: string, isCompleted: boolean) => {
    // Optimistic Update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, is_completed: isCompleted } : t))
    );

    try {
      await DataService.toggleTaskCompletion(taskId, isCompleted);
      await loadData();
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Could not update task', err?.message);
      await loadData();
    }
  };

  const handleToggleTaskFavorite = async (taskId: string, current: boolean) => {
    const next = !current;
    // Optimistic update, silent success
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, is_favorite: next } : t)));

    try {
      await DataService.updateTask(taskId, { is_favorite: next });
    } catch (err: any) {
      console.error(err);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, is_favorite: current } : t)));
      addToast('error', 'Could not update favorite', err?.message);
    }
  };

  const confirmResetProgress = async () => {
    if (!selectedProject || !user) return;
    setShowResetDialog(false);

    try {
      setIsResetting(true);
      await DataService.resetProjectProgress(selectedProject.id, user.user_id);
      await loadData();
      addToast('success', 'Progress reset', 'All tasks were marked incomplete. No tasks were deleted.');
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Reset failed', err?.message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<ProgressTask>) => {
    try {
      await DataService.updateTask(taskId, updates);
      // Full refresh keeps both projects' stats correct (covers task moves)
      await loadData();
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

    await DataService.updateTask(editingTask.id, updates);
    await loadData();
    addToast('success', 'Task updated');

    if (oldImage && oldImage !== updates.image_url && isSupabaseStorageUrl(oldImage)) {
      deleteStorageFileFromUrl(oldImage);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await DataService.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      await loadData();
      addToast('success', 'Task deleted');
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Delete failed', err?.message);
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
            <div className="mx-auto w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30 orange-glow">
              <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
            </div>
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
