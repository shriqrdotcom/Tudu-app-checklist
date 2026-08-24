import React from 'react';
import { CheckSquare, Filter, Search } from 'lucide-react';
import { ProgressTask, ProgressProject } from '../types';
import { TaskCard } from '../components/TaskCard';
import { SearchBar } from '../components/SearchBar';
import { EmptyState } from '../components/EmptyState';

interface TasksViewProps {
  tasks: ProgressTask[];
  projects: ProgressProject[];
  onToggleTaskComplete: (taskId: string, isCompleted: boolean) => void;
  onEditTask: (task: ProgressTask) => void;
  onDeleteTask: (taskId: string) => void;
  onNavigateCreate: () => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  projects,
  onToggleTaskComplete,
  onEditTask,
  onDeleteTask,
  onNavigateCreate,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'pending' | 'completed'>('all');
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>('all');

  const filteredTasks = React.useMemo(() => {
    return tasks.filter((t) => {
      // Search
      const matchesSearch =
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Project filter
      if (selectedProjectId !== 'all' && t.project_id !== selectedProjectId) return false;

      // Status filter
      if (statusFilter === 'completed') return t.is_completed;
      if (statusFilter === 'pending') return !t.is_completed;

      return true;
    });
  }, [tasks, searchQuery, selectedProjectId, statusFilter]);

  return (
    <div className="space-y-6 pb-28">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-orange-500" />
            <span>Master Checklist</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            View and check off tasks across all your Progress Projects in one unified stream.
          </p>
        </div>

        <button
          onClick={onNavigateCreate}
          className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 cursor-pointer self-start sm:self-auto"
        >
          + Add New Task
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Filter tasks by name or notes..."
          className="md:max-w-xs"
        />

        <div className="flex flex-wrap items-center gap-2">
          {/* Project Dropdown */}
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">All Projects ({projects.length})</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl">
            {(['all', 'pending', 'completed'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white dark:bg-zinc-900 text-orange-600 dark:text-orange-400 shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tasks List */}
      {filteredTasks.length > 0 ? (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const project = projects.find((p) => p.id === task.project_id);
            return (
              <TaskCard
                key={task.id}
                task={task}
                projectName={project?.title}
                projectColor={project?.accent_color}
                onToggleComplete={onToggleTaskComplete}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No tasks found"
          description="Try broadening your search keywords or switching project/status filters."
          actionLabel="Add New Task"
          onAction={onNavigateCreate}
          type="tasks"
        />
      )}
    </div>
  );
};
