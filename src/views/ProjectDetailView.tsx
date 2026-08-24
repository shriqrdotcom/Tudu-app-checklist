import React from 'react';
import { ArrowLeft, Plus, Star, CheckCircle2, Trash2, Edit3, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ProgressProject, ProgressTask } from '../types';
import { ProgressBar } from '../components/ProgressBar';
import { TaskCard } from '../components/TaskCard';
import { EmptyState } from '../components/EmptyState';

interface ProjectDetailViewProps {
  project: ProgressProject;
  tasks: ProgressTask[];
  onBack: () => void;
  onToggleTaskComplete: (taskId: string, isCompleted: boolean) => void;
  onAddTask: (taskData: { project_id: string; title: string; description?: string }) => Promise<void>;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (task: ProgressTask) => void;
  onToggleFavorite: (projectId: string, current: boolean) => void;
  onEditProject: (project: ProgressProject) => void;
  onDeleteProject: (projectId: string) => void;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  project,
  tasks,
  onBack,
  onToggleTaskComplete,
  onAddTask,
  onDeleteTask,
  onEditTask,
  onToggleFavorite,
  onEditProject,
  onDeleteProject,
}) => {
  const [quickTitle, setQuickTitle] = React.useState('');
  const [isAdding, setIsAdding] = React.useState(false);
  const [taskFilter, setTaskFilter] = React.useState<'all' | 'pending' | 'completed'>('all');

  const projectTasks = React.useMemo(() => {
    return tasks.filter((t) => t.project_id === project.id);
  }, [tasks, project.id]);

  const filteredTasks = React.useMemo(() => {
    if (taskFilter === 'completed') return projectTasks.filter((t) => t.is_completed);
    if (taskFilter === 'pending') return projectTasks.filter((t) => !t.is_completed);
    return projectTasks;
  }, [projectTasks, taskFilter]);

  const total = projectTasks.length;
  const completed = projectTasks.filter((t) => t.is_completed).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

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
    } catch (e) {
      console.error('Failed to add task:', e);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-28">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Projects</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleFavorite(project.id, project.is_favorite)}
            className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Star
              className={`w-4 h-4 ${
                project.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
              }`}
            />
          </button>
          <button
            onClick={() => onEditProject(project)}
            className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDeleteProject(project.id)}
            className="p-2 rounded-xl border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Project Banner Card */}
      <div className="relative overflow-hidden bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-xl">
        {project.image_url && (
          <div className="h-44 w-full relative">
            <img src={project.image_url} alt={project.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
          </div>
        )}

        <div className={`p-6 sm:p-8 ${project.image_url ? '-mt-16 relative z-10 text-white' : ''}`}>
          <div className="flex items-center gap-2 mb-2">
            <span
              className="w-3.5 h-3.5 rounded-full"
              style={{ backgroundColor: project.accent_color || '#ff6b00' }}
            />
            <span className="text-xs font-extrabold uppercase tracking-wider text-orange-500">
              Progress Project
            </span>
          </div>

          <h1
            className={`text-2xl sm:text-3xl font-black tracking-tight ${
              project.image_url ? 'text-white' : 'text-slate-900 dark:text-white'
            }`}
          >
            {project.title}
          </h1>

          {project.description && (
            <p
              className={`text-xs sm:text-sm mt-2 leading-relaxed max-w-2xl ${
                project.image_url ? 'text-zinc-300' : 'text-slate-600 dark:text-zinc-400'
              }`}
            >
              {project.description}
            </p>
          )}

          {/* Progress Header Gauge */}
          <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-zinc-800">
            <div className="flex items-center justify-between text-xs font-bold mb-2">
              <span className={project.image_url ? 'text-zinc-300' : 'text-slate-600 dark:text-zinc-400'}>
                Completion Rate
              </span>
              <span className="font-mono text-sm font-extrabold text-orange-500">
                {percentage}% ({completed} / {total} tasks)
              </span>
            </div>
            <ProgressBar percentage={percentage} color={project.accent_color || '#ff6b00'} showText={false} size="lg" />
          </div>
        </div>
      </div>

      {/* Quick Add Task Input */}
      <form
        onSubmit={handleQuickAdd}
        className="flex items-center gap-2 p-2 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-md"
      >
        <input
          type="text"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="+ Quick add a task to this project checklist..."
          className="flex-1 px-4 py-2.5 bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isAdding || !quickTitle.trim()}
          className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-orange-500/20 disabled:opacity-50 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Task</span>
        </button>
      </form>

      {/* Task Filters & Checklist Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-orange-500" />
            <span>Checklist Items</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
              {filteredTasks.length}
            </span>
          </h3>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl">
            {(['all', 'pending', 'completed'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTaskFilter(filter)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                  taskFilter === filter
                    ? 'bg-white dark:bg-zinc-900 text-orange-600 dark:text-orange-400 shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {filteredTasks.length > 0 ? (
          <div className="space-y-3">
            <AnimatePresence>
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggleComplete={onToggleTaskComplete}
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <EmptyState
            title={taskFilter === 'all' ? 'Checklist is empty' : `No ${taskFilter} tasks`}
            description={
              taskFilter === 'all'
                ? 'Add your first task above to begin tracking project completion.'
                : `No tasks currently match the "${taskFilter}" status.`
            }
            type="tasks"
          />
        )}
      </div>
    </div>
  );
};
