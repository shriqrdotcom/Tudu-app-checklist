import React from 'react';
import {
  ArrowLeft,
  Plus,
  Star,
  CheckCircle2,
  Trash2,
  Edit3,
  RotateCcw,
  MoreVertical,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ProgressProject, ProgressTask } from '../types';
import { ProgressBar } from '../components/ProgressBar';
import { TaskCard } from '../components/TaskCard';
import { SearchBar } from '../components/SearchBar';
import { EmptyState } from '../components/EmptyState';
import { useClickOutside } from '../hooks/useClickOutside';

type TaskFilter = 'all' | 'pending' | 'completed' | 'favorites';

interface ProjectDetailViewProps {
  project: ProgressProject;
  tasks: ProgressTask[];
  isResetting?: boolean;
  onBack: () => void;
  onToggleTaskComplete: (taskId: string, isCompleted: boolean) => void;
  onToggleTaskFavorite: (taskId: string, current: boolean) => void;
  onAddTask: (taskData: { project_id: string; title: string; description?: string }) => Promise<void>;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (task: ProgressTask) => void;
  onToggleFavorite: (projectId: string, current: boolean) => void;
  onEditProject: (project: ProgressProject) => void;
  onDeleteProject: (projectId: string) => void;
  onRequestReset: () => void;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  project,
  tasks,
  isResetting = false,
  onBack,
  onToggleTaskComplete,
  onToggleTaskFavorite,
  onAddTask,
  onDeleteTask,
  onEditTask,
  onToggleFavorite,
  onEditProject,
  onDeleteProject,
  onRequestReset,
}) => {
  const [quickTitle, setQuickTitle] = React.useState('');
  const [isAdding, setIsAdding] = React.useState(false);
  const [taskSearch, setTaskSearch] = React.useState('');
  const [taskFilter, setTaskFilter] = React.useState<TaskFilter>('all');
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const closeMenu = React.useCallback(() => setMenuOpen(false), []);
  useClickOutside(menuRef, closeMenu, menuOpen);

  const projectTasks = React.useMemo(
    () => tasks.filter((t) => t.project_id === project.id),
    [tasks, project.id]
  );

  // Dynamic stats — always derived from Supabase data
  const total = projectTasks.length;
  const completed = projectTasks.filter((t) => t.is_completed).length;
  const remaining = total - completed;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const taskCounts = React.useMemo(
    () => ({
      all: total,
      pending: remaining,
      completed,
      favorites: projectTasks.filter((t) => t.is_favorite).length,
    }),
    [total, completed, remaining, projectTasks]
  );

  const filteredTasks = React.useMemo(() => {
    const query = taskSearch.trim().toLowerCase();
    return projectTasks.filter((t) => {
      const matchesSearch =
        !query ||
        t.title.toLowerCase().includes(query) ||
        (t.description ?? '').toLowerCase().includes(query);
      if (!matchesSearch) return false;

      switch (taskFilter) {
        case 'completed':
          return t.is_completed;
        case 'pending':
          return !t.is_completed;
        case 'favorites':
          return t.is_favorite;
        default:
          return true;
      }
    });
  }, [projectTasks, taskSearch, taskFilter]);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    try {
      setIsAdding(true);
      await onAddTask({
        project_id: project.id,
        title: quickTitle.trim(),
      });
      setQuickTitle('');
    } catch (err) {
      console.error('Failed to add task:', err);
    } finally {
      setIsAdding(false);
    }
  };

  const accent = project.accent_color || '#ff6b00';

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-28">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Progress</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onToggleFavorite(project.id, project.is_favorite)}
            aria-label={project.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
            className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer active:scale-90"
          >
            <Star
              className={`w-4 h-4 ${
                project.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
              }`}
            />
          </button>
          <button
            onClick={() => onEditProject(project)}
            aria-label="Edit project"
            className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer active:scale-90"
          >
            <Edit3 className="w-4 h-4" />
          </button>

          {/* More Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="More actions"
              aria-expanded={menuOpen}
              className={`p-2 rounded-xl border transition-colors cursor-pointer active:scale-90 ${
                menuOpen
                  ? 'bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400'
                  : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300'
              }`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-48 z-30 py-1.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl overflow-hidden"
                  role="menu"
                >
                  <button
                    role="menuitem"
                    disabled={isResetting}
                    onClick={() => {
                      closeMenu();
                      onRequestReset();
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isResetting ? (
                      <div className="w-3.5 h-3.5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5 text-orange-500" />
                    )}
                    Reset Progress
                  </button>
                  <div className="my-1 h-px bg-slate-200 dark:bg-zinc-800" />
                  <button
                    role="menuitem"
                    onClick={() => {
                      closeMenu();
                      onDeleteProject(project.id);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Project
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Hero Card */}
      <div className="relative overflow-hidden bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-lg">
        {project.image_url && (
          <div className="h-40 sm:h-44 w-full relative">
            <img src={project.image_url} alt={project.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
          </div>
        )}

        <div className={`p-5 sm:p-6 ${project.image_url ? '-mt-14 relative z-10 text-white' : ''}`}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: accent }} />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-500">
              Progress Project
            </span>
          </div>

          <h1
            className={`text-xl sm:text-2xl font-black tracking-tight break-words ${
              project.image_url ? 'text-white' : 'text-slate-900 dark:text-white'
            }`}
          >
            {project.title}
          </h1>

          {project.description && (
            <p
              className={`text-xs sm:text-sm mt-1.5 leading-relaxed max-w-2xl ${
                project.image_url ? 'text-zinc-300' : 'text-slate-500 dark:text-zinc-400'
              }`}
            >
              {project.description}
            </p>
          )}
        </div>
      </div>

      {/* Progress Summary */}
      <section className="bg-white dark:bg-zinc-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-zinc-800 shadow-md">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
          Project Progress
        </p>

        <div className="flex items-end justify-between gap-4 mt-1.5">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-mono text-4xl sm:text-5xl font-black leading-none" style={{ color: accent }}>
              {completed}
            </span>
            <span className="font-mono text-lg sm:text-xl font-bold text-slate-400 dark:text-zinc-500">
              / {total}
            </span>
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 ml-1 hidden xs:inline sm:inline">
              Completed
            </span>
          </div>
          <span
            className="shrink-0 px-3 py-1.5 rounded-xl text-sm font-extrabold font-mono text-white shadow-md"
            style={{ backgroundColor: accent }}
          >
            {percentage}%
          </span>
        </div>

        <div className="mt-4">
          <ProgressBar percentage={percentage} color={accent} size="lg" showText={false} />
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4">
          <div className="rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/70 dark:border-zinc-700/60 p-3 text-center">
            <p className="font-mono text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">{total}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500 mt-0.5">
              Total Tasks
            </p>
          </div>
          <div className="rounded-2xl bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/20 p-3 text-center">
            <p className="font-mono text-base sm:text-lg font-extrabold text-orange-600 dark:text-orange-400">{completed}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-500/70 dark:text-orange-400/60 mt-0.5">
              Completed
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/70 dark:border-zinc-700/60 p-3 text-center">
            <p className="font-mono text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">{remaining}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500 mt-0.5">
              Remaining
            </p>
          </div>
        </div>
      </section>

      {/* Quick Add Task Input */}
      <form
        onSubmit={handleQuickAdd}
        className="flex items-center gap-2 p-2 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm focus-within:border-orange-500/50 transition-colors"
      >
        <input
          type="text"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Add a task..."
          maxLength={140}
          className="flex-1 min-w-0 px-3 py-2.5 bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isAdding || !quickTitle.trim()}
          id="quick-add-task-btn"
          className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-orange-500/20 disabled:opacity-50 transition-all cursor-pointer active:scale-95 shrink-0"
        >
          {isAdding ? (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          <span>Add</span>
        </button>
      </form>

      {/* Checklist Toolbar */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-orange-500" />
            <span>Checklist</span>
          </h3>
          <SearchBar value={taskSearch} onChange={setTaskSearch} placeholder="Search checklist..." className="w-full sm:w-56" />
        </div>

        {/* Checklist filter tabs with counts */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {(['all', 'pending', 'completed', 'favorites'] as TaskFilter[]).map((filter) => {
            const isActive = taskFilter === filter;
            const count = taskCounts[filter];
            return (
              <button
                key={filter}
                onClick={() => setTaskFilter(filter)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'text-orange-600 dark:text-orange-400 font-bold'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/60'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="task-filter-pill"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="absolute inset-0 bg-orange-500/10 dark:bg-orange-500/20 rounded-xl border border-orange-500/30"
                  />
                )}
                <span className="relative z-10 capitalize">{filter === 'pending' ? 'Pending' : filter}</span>
                <span
                  className={`relative z-10 px-1.5 rounded-full text-[10px] py-0.5 ${
                    isActive
                      ? 'bg-orange-500 text-white font-bold'
                      : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Task List */}
        {filteredTasks.length > 0 ? (
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggleComplete={onToggleTaskComplete}
                  onToggleFavorite={onToggleTaskFavorite}
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <EmptyState
            title={
              taskSearch.trim()
                ? 'No matching tasks'
                : taskFilter === 'all'
                  ? 'Checklist is empty'
                  : taskFilter === 'favorites'
                    ? 'No favorite tasks yet'
                    : `No ${taskFilter} tasks`
            }
            description={
              taskSearch.trim()
                ? 'Try another search.'
                : taskFilter === 'all'
                  ? 'Quick add your first task above to start tracking completion.'
                  : 'Nothing matches this view right now.'
            }
            type={taskSearch.trim() ? 'search' : 'tasks'}
          />
        )}
      </div>
    </div>
  );
};
