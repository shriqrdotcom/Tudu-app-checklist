import React from 'react';
import { Plus, TrendingUp, CheckCircle2, Clock, Sparkles, FolderKanban } from 'lucide-react';
import { motion } from 'motion/react';
import { ProgressProject, ProgressTask, FilterStatus } from '../types';
import { ProgressCard } from '../components/ProgressCard';
import { SearchBar } from '../components/SearchBar';
import { FilterTabs } from '../components/FilterTabs';
import { EmptyState } from '../components/EmptyState';
import { SkeletonGrid } from '../components/SkeletonLoader';
import { ProgressBar } from '../components/ProgressBar';

interface DashboardViewProps {
  projects: ProgressProject[];
  tasks: ProgressTask[];
  isLoading: boolean;
  onOpenProject: (project: ProgressProject) => void;
  onToggleFavorite: (projectId: string, current: boolean) => void;
  onNavigateCreate: () => void;
  onEditProject: (project: ProgressProject) => void;
  onDeleteProject: (projectId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  tasks,
  isLoading,
  onOpenProject,
  onToggleFavorite,
  onNavigateCreate,
  onEditProject,
  onDeleteProject,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState<FilterStatus>('all');

  // Computed Global Metrics
  const totalProjects = projects.length;
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.is_completed).length;
  const overallPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Filter & Search Logic
  const filteredProjects = React.useMemo(() => {
    return projects.filter((p) => {
      // Search Query match
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Filter Status match
      if (activeFilter === 'favorites') return p.is_favorite;
      if (activeFilter === 'completed') return (p.completion_percentage ?? 0) === 100;
      if (activeFilter === 'in_progress') return (p.completion_percentage ?? 0) < 100;

      return true;
    });
  }, [projects, searchQuery, activeFilter]);

  const filterCounts = React.useMemo(() => {
    return {
      all: projects.length,
      in_progress: projects.filter((p) => (p.completion_percentage ?? 0) < 100).length,
      completed: projects.filter((p) => (p.completion_percentage ?? 0) === 100).length,
      favorites: projects.filter((p) => p.is_favorite).length,
    };
  }, [projects]);

  return (
    <div className="space-y-6 pb-24">
      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by project name or description..."
          className="sm:max-w-xs"
        />
        <FilterTabs
          activeFilter={activeFilter}
          onSelectFilter={setActiveFilter}
          counts={filterCounts}
        />
      </div>

      {/* Projects Grid Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-orange-500" />
            <span>Progress Projects</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
              {filteredProjects.length}
            </span>
          </h2>
        </div>

        {isLoading ? (
          <SkeletonGrid count={4} />
        ) : filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((project) => (
              <ProgressCard
                key={project.id}
                project={project}
                onOpen={onOpenProject}
                onToggleFavorite={onToggleFavorite}
                onEdit={onEditProject}
                onDelete={onDeleteProject}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title={
              searchQuery || activeFilter !== 'all'
                ? 'No matching projects found'
                : 'No projects created yet'
            }
            description={
              searchQuery || activeFilter !== 'all'
                ? 'Try adjusting your search keywords or filter tab.'
                : 'Create your first Progress Project to start adding checklist tasks and tracking progress!'
            }
            actionLabel={searchQuery || activeFilter !== 'all' ? 'Reset Filters' : 'Create Project'}
            onAction={
              searchQuery || activeFilter !== 'all'
                ? () => {
                    setSearchQuery('');
                    setActiveFilter('all');
                  }
                : onNavigateCreate
            }
            type={searchQuery ? 'search' : 'projects'}
          />
        )}
      </div>
    </div>
  );
};
