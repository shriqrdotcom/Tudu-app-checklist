import React from 'react';
import { Plus, FolderKanban, RefreshCw } from 'lucide-react';
import { ProgressProject, ProgressTask, FilterStatus, SortOption } from '../types';
import { ProgressCard } from '../components/ProgressCard';
import { SearchBar } from '../components/SearchBar';
import { FilterTabs } from '../components/FilterTabs';
import { SortMenu } from '../components/SortMenu';
import { EmptyState } from '../components/EmptyState';
import { SkeletonList } from '../components/SkeletonList';

interface DashboardViewProps {
  projects: ProgressProject[];
  tasks: ProgressTask[];
  isLoading: boolean;
  /** Set when the initial Supabase query fails. */
  error?: string | null;
  onRetry?: () => void;
  /** Increment to move focus into the search field (header search button). */
  searchSignal?: number;
  onOpenProject: (project: ProgressProject) => void;
  onToggleFavorite: (projectId: string, current: boolean) => void;
  onNavigateCreate: () => void;
}

const isProjectCompleted = (p: ProgressProject): boolean => {
  const total = p.total_tasks ?? 0;
  return total > 0 && (p.completed_tasks ?? 0) === total;
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  isLoading,
  error,
  onRetry,
  searchSignal,
  onOpenProject,
  onToggleFavorite,
  onNavigateCreate,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState<FilterStatus>('all');
  const [sortOption, setSortOption] = React.useState<SortOption>('recent_updated');
  const searchRef = React.useRef<HTMLDivElement>(null);

  // Focus the search field when the header search button is pressed
  React.useEffect(() => {
    if (!searchSignal) return;
    const input = searchRef.current?.querySelector('input');
    input?.focus();
  }, [searchSignal]);

  // Filter definitions:
  // Active   -> at least one incomplete task
  // Completed-> all tasks completed
  const filteredProjects = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return projects.filter((p) => {
      const matchesSearch =
        !query ||
        p.title.toLowerCase().includes(query) ||
        (p.description ?? '').toLowerCase().includes(query);
      if (!matchesSearch) return false;

      switch (activeFilter) {
        case 'favorites':
          return p.is_favorite;
        case 'completed':
          return isProjectCompleted(p);
        case 'in_progress':
          return !isProjectCompleted(p);
        default:
          return true;
      }
    });
  }, [projects, searchQuery, activeFilter]);

  // Sorting
  const sortedProjects = React.useMemo(() => {
    const arr = [...filteredProjects];
    const byDate = (key: 'created_at' | 'updated_at') => (b: ProgressProject, a: ProgressProject) =>
      a[key].localeCompare(b[key]);

    switch (sortOption) {
      case 'recent_created':
        return arr.sort(byDate('created_at'));
      case 'name_asc':
        return arr.sort((a, b) => a.title.localeCompare(b.title));
      case 'name_desc':
        return arr.sort((a, b) => b.title.localeCompare(a.title));
      case 'completion_high':
        return arr.sort((a, b) => (b.completion_percentage ?? 0) - (a.completion_percentage ?? 0));
      case 'completion_low':
        return arr.sort((a, b) => (a.completion_percentage ?? 0) - (b.completion_percentage ?? 0));
      default:
        return arr.sort(byDate('updated_at'));
    }
  }, [filteredProjects, sortOption]);

  const filterCounts = React.useMemo(
    () => ({
      all: projects.length,
      in_progress: projects.filter((p) => !isProjectCompleted(p)).length,
      completed: projects.filter((p) => isProjectCompleted(p)).length,
      favorites: projects.filter((p) => p.is_favorite).length,
    }),
    [projects]
  );

  const hasNoProjectsAtAll = projects.length === 0;
  const hasActiveRefinements = searchQuery.trim().length > 0 || activeFilter !== 'all';

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-28">
      {/* Search */}
      <div ref={searchRef} className="pt-2">
        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search progress..." />
      </div>

      {/* Filters + Sort */}
      <div className="flex items-center justify-between gap-2">
        <FilterTabs activeFilter={activeFilter} onSelectFilter={setActiveFilter} counts={filterCounts} />
        <SortMenu value={sortOption} onChange={setSortOption} />
      </div>

      {/* List Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <FolderKanban className="w-4 h-4 text-orange-500" />
            <span>Progress</span>
          </h2>
          {!isLoading && sortedProjects.length > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
              {sortedProjects.length} {sortedProjects.length === 1 ? 'project' : 'projects'}
            </span>
          )}
        </div>

        {isLoading ? (
          <SkeletonList count={5} />
        ) : error ? (
          /* Load-failure state with retry */
          <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl bg-slate-50/50 dark:bg-zinc-900/30 border border-dashed border-red-300 dark:border-red-900/40 my-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 dark:bg-red-500/15 text-red-500 flex items-center justify-center mb-4">
              <FolderKanban className="w-7 h-7 stroke-[1.8]" aria-hidden="true" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Unable to load your progress
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 max-w-sm mt-1 leading-relaxed">
              {error}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-bold text-xs sm:text-sm shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            )}
          </div>
        ) : sortedProjects.length > 0 ? (
          <div className="space-y-2.5">
            {sortedProjects.map((project) => (
              <ProgressCard
                key={project.id}
                project={project}
                onOpen={onOpenProject}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        ) : hasNoProjectsAtAll && !hasActiveRefinements ? (
          <EmptyState
            title="Nothing to track yet"
            description="Create your first progress and start getting things done."
            actionLabel="+ Create Progress"
            onAction={onNavigateCreate}
            type="projects"
          />
        ) : (
          <EmptyState
            title="No progress found"
            description="Try another search."
            actionLabel="Reset"
            onAction={() => {
              setSearchQuery('');
              setActiveFilter('all');
            }}
            type="search"
          />
        )}
      </div>

      {/* Floating-nav clearance CTA for empty desktop space */}
      {!isLoading && hasNoProjectsAtAll && (
        <div className="hidden sm:flex justify-center pt-2">
          <button
            onClick={onNavigateCreate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-bold text-xs shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Progress
          </button>
        </div>
      )}
    </div>
  );
};
