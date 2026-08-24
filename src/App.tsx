import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { BottomNavigation } from './components/BottomNavigation';
import { ToastContainer } from './components/Toast';
import { Modal } from './components/Modal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { DashboardView } from './views/DashboardView';
import { CreateView } from './views/CreateView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { TasksView } from './views/TasksView';
import { AuthModal } from './views/AuthModal';
import { ProfileModal } from './views/ProfileModal';
import { DataService, isSupabaseConfigured, supabase } from './lib/supabase';
import { ProgressProject, ProgressTask, UserProfile, ViewTab, ThemeMode, ToastMessage } from './types';

export default function App() {
  // Theme State
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('tudu_theme_v1');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Navigation & View State
  const [activeTab, setActiveTab] = useState<ViewTab>('dashboard');
  const [selectedProject, setSelectedProject] = useState<ProgressProject | null>(null);

  // Data State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<ProgressProject[]>([]);
  const [tasks, setTasks] = useState<ProgressTask[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals & Dialogs
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProgressProject | null>(null);
  const [editingTask, setEditingTask] = useState<ProgressTask | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
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

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const addToast = (type: 'success' | 'error' | 'info', title: string, description?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Load User & App Data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const currentUser = await DataService.getCurrentUser();
      setUser(currentUser);

      const userId = currentUser?.user_id || 'demo-user-123';
      const fetchedProjects = await DataService.getProjects(userId);
      const fetchedTasks = await DataService.getTasks(userId);

      setProjects(fetchedProjects);
      setTasks(fetchedTasks);
    } catch (err) {
      console.error('Error loading TU DU data:', err);
      addToast('error', 'Failed to load projects', 'Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Supabase Auth state listener if configured
    if (isSupabaseConfigured() && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
        loadData();
      });
      return () => subscription.unsubscribe();
    }
  }, [loadData]);

  // Project Actions
  const handleCreateProject = async (projectData: {
    title: string;
    description: string;
    image_url: string;
    accent_color: string;
    is_favorite: boolean;
  }) => {
    const userId = user?.user_id || 'demo-user-123';
    const newProj = await DataService.createProject({
      user_id: userId,
      ...projectData,
    });

    setProjects((prev) => [newProj, ...prev]);
    addToast('success', 'Project created!', `"${newProj.title}" is ready.`);
    setActiveTab('dashboard');
  };

  const handleUpdateProject = async (projectId: string, updates: Partial<ProgressProject>) => {
    await DataService.updateProject(projectId, updates);
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, ...updates } : p))
    );
    if (selectedProject?.id === projectId) {
      setSelectedProject((prev) => (prev ? { ...prev, ...updates } : null));
    }
    addToast('success', 'Project updated');
  };

  const handleDeleteProject = async (projectId: string) => {
    const target = projects.find((p) => p.id === projectId);
    await DataService.deleteProject(projectId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setTasks((prev) => prev.filter((t) => t.project_id !== projectId));

    if (selectedProject?.id === projectId) {
      setSelectedProject(null);
    }
    addToast('info', 'Project deleted', target ? `"${target.title}" was removed.` : '');
  };

  const handleToggleFavorite = async (projectId: string, current: boolean) => {
    const nextState = !current;
    await handleUpdateProject(projectId, { is_favorite: nextState });
  };

  // Task Actions
  const handleCreateTask = async (taskData: {
    project_id: string;
    title: string;
    description?: string;
    image_url?: string;
  }) => {
    const userId = user?.user_id || 'demo-user-123';
    const projectTasks = tasks.filter((t) => t.project_id === taskData.project_id);

    const newTask = await DataService.createTask({
      project_id: taskData.project_id,
      user_id: userId,
      title: taskData.title,
      description: taskData.description || '',
      image_url: taskData.image_url || '',
      is_completed: false,
      position: projectTasks.length + 1,
    });

    setTasks((prev) => [newTask, ...prev]);
    await loadData(); // refresh calculated percentages
    addToast('success', 'Task added to checklist');
  };

  const handleToggleTaskComplete = async (taskId: string, isCompleted: boolean) => {
    // Optimistic Update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, is_completed: isCompleted } : t))
    );

    await DataService.toggleTaskCompletion(taskId, isCompleted);
    await loadData(); // refresh calculated project completion percentages
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<ProgressTask>) => {
    await DataService.updateTask(taskId, updates);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
    );
    await loadData();
    addToast('success', 'Task updated');
  };

  const handleDeleteTask = async (taskId: string) => {
    await DataService.deleteTask(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await loadData();
    addToast('info', 'Task removed');
  };

  // Filter pending tasks count for bottom nav badge
  const pendingTasksCount = tasks.filter((t) => !t.is_completed).length;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-200">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Top Header */}
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenSettings={() => setIsProfileOpen(true)}
        contextTitle={selectedProject ? selectedProject.title : undefined}
        onBrandClick={() => {
          setSelectedProject(null);
          setActiveTab('dashboard');
        }}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6">
        {selectedProject ? (
          <ProjectDetailView
            project={selectedProject}
            tasks={tasks}
            onBack={() => setSelectedProject(null)}
            onToggleTaskComplete={handleToggleTaskComplete}
            onAddTask={handleCreateTask}
            onDeleteTask={handleDeleteTask}
            onEditTask={(task) => setEditingTask(task)}
            onToggleFavorite={handleToggleFavorite}
            onEditProject={(project) => setEditingProject(project)}
            onDeleteProject={(id) => setDeletingProjectId(id)}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                projects={projects}
                tasks={tasks}
                isLoading={isLoading}
                onOpenProject={(proj) => setSelectedProject(proj)}
                onToggleFavorite={handleToggleFavorite}
                onNavigateCreate={() => setActiveTab('create')}
                onEditProject={(proj) => setEditingProject(proj)}
                onDeleteProject={(id) => setDeletingProjectId(id)}
              />
            )}

            {activeTab === 'create' && (
              <CreateView
                projects={projects}
                onCreateProject={handleCreateProject}
                onCreateTask={handleCreateTask}
                userId={user?.user_id}
                onSuccess={() => {
                  setSelectedProject(null);
                  setActiveTab('dashboard');
                }}
              />
            )}

            {activeTab === 'tasks' && (
              <TasksView
                tasks={tasks}
                projects={projects}
                onToggleTaskComplete={handleToggleTaskComplete}
                onEditTask={(task) => setEditingTask(task)}
                onDeleteTask={handleDeleteTask}
                onNavigateCreate={() => setActiveTab('create')}
              />
            )}

            {activeTab === 'favorites' && (
              <DashboardView
                projects={projects.filter((p) => p.is_favorite)}
                tasks={tasks}
                isLoading={isLoading}
                onOpenProject={(proj) => setSelectedProject(proj)}
                onToggleFavorite={handleToggleFavorite}
                onNavigateCreate={() => setActiveTab('create')}
                onEditProject={(proj) => setEditingProject(proj)}
                onDeleteProject={(id) => setDeletingProjectId(id)}
              />
            )}

            {activeTab === 'settings' && (
              <div className="max-w-2xl mx-auto py-4">
                <ProfileModal
                  isOpen={true}
                  onClose={() => setActiveTab('dashboard')}
                  user={user}
                  onLogout={() => {
                    setUser(null);
                    loadData();
                  }}
                />
              </div>
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
        pendingTaskCount={pendingTasksCount}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(u) => {
          setUser(u);
          loadData();
          addToast('success', `Welcome back, ${u.name}!`);
        }}
      />

      {/* Profile Settings Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onLogout={() => {
          setUser(null);
          loadData();
          addToast('info', 'Signed out successfully');
        }}
      />

      {/* Edit Project Modal */}
      {editingProject && (
        <Modal
          isOpen={true}
          onClose={() => setEditingProject(null)}
          title="Edit Progress Project"
          maxWidth="md"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await handleUpdateProject(editingProject.id, {
                title: editingProject.title,
                description: editingProject.description,
                image_url: editingProject.image_url,
                accent_color: editingProject.accent_color,
              });
              setEditingProject(null);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold mb-1">Title</label>
              <input
                type="text"
                required
                value={editingProject.title}
                onChange={(e) => setEditingProject({ ...editingProject, title: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Description</label>
              <textarea
                rows={3}
                value={editingProject.description || ''}
                onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              Save Project Changes
            </button>
          </form>
        </Modal>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <Modal
          isOpen={true}
          onClose={() => setEditingTask(null)}
          title="Edit Checklist Item"
          maxWidth="md"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await handleUpdateTask(editingTask.id, {
                title: editingTask.title,
                description: editingTask.description,
              });
              setEditingTask(null);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold mb-1">Task Title</label>
              <input
                type="text"
                required
                value={editingTask.title}
                onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Notes</label>
              <textarea
                rows={3}
                value={editingTask.description || ''}
                onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              Save Task
            </button>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingProjectId)}
        onClose={() => setDeletingProjectId(null)}
        onConfirm={() => {
          if (deletingProjectId) handleDeleteProject(deletingProjectId);
        }}
        title="Delete Progress Project?"
        message="Are you sure you want to delete this project and all its associated checklist tasks? This action cannot be undone."
        confirmLabel="Delete Project"
        isDangerous={true}
      />
    </div>
  );
}
