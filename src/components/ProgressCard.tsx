import React from 'react';
import { Star, CheckCircle2, Clock, ChevronRight, MoreVertical, Trash2, Edit3 } from 'lucide-react';
import { motion } from 'motion/react';
import { ProgressProject } from '../types';
import { ProgressBar } from './ProgressBar';

interface ProgressCardProps {
  project: ProgressProject;
  onOpen: (project: ProgressProject) => void;
  onToggleFavorite: (projectId: string, current: boolean) => void;
  onEdit?: (project: ProgressProject) => void;
  onDelete?: (projectId: string) => void;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({
  project,
  onOpen,
  onToggleFavorite,
  onEdit,
  onDelete,
}) => {
  const [showMenu, setShowMenu] = React.useState(false);

  const formattedDate = React.useMemo(() => {
    if (!project.updated_at) return 'Recently';
    const date = new Date(project.updated_at);
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      'day'
    );
  }, [project.updated_at]);

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className="group relative flex flex-col justify-between bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:shadow-lg dark:hover:shadow-orange-950/20 overflow-hidden transition-all duration-200"
    >
      {/* Top Banner Image or Accent Bar */}
      {project.image_url ? (
        <div className="relative h-32 w-full overflow-hidden bg-slate-100 dark:bg-zinc-800">
          <img
            src={project.image_url}
            alt={project.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {/* Accent Badge Swatch */}
          <div
            className="absolute top-3 left-3 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-zinc-900 shadow-md"
            style={{ backgroundColor: project.accent_color || '#ff6b00' }}
          />

          {/* Top Actions: Favorite & Menu */}
          <div className="absolute top-3 right-3 flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(project.id, project.is_favorite);
              }}
              id={`fav-btn-${project.id}`}
              className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-colors cursor-pointer"
            >
              <Star
                className={`w-4 h-4 ${
                  project.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'
                }`}
              />
            </button>
          </div>

          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-500/90 text-white backdrop-blur-sm">
              {project.completed_tasks ?? 0} / {project.total_tasks ?? 0} Tasks
            </span>
          </div>
        </div>
      ) : (
        <div
          className="h-2 w-full"
          style={{ backgroundColor: project.accent_color || '#ff6b00' }}
        />
      )}

      {/* Card Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Header row for non-image projects */}
          {!project.image_url && (
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: project.accent_color || '#ff6b00' }}
                />
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                  {project.completed_tasks ?? 0}/{project.total_tasks ?? 0} Tasks
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(project.id, project.is_favorite);
                }}
                id={`fav-btn-noimg-${project.id}`}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <Star
                  className={`w-4.5 h-4.5 ${
                    project.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400 dark:text-zinc-500'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Title & Description */}
          <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors line-clamp-1">
            {project.title}
          </h3>
          {project.description && (
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
              {project.description}
            </p>
          )}
        </div>

        {/* Progress Gauge */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800/80">
          <ProgressBar
            percentage={project.completion_percentage ?? 0}
            color={project.accent_color || '#ff6b00'}
            size="md"
          />

          {/* Bottom Footer Details */}
          <div className="flex items-center justify-between mt-4 text-xs text-slate-400 dark:text-zinc-500">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
              <span>{formattedDate}</span>
            </div>

            <div className="flex items-center gap-2">
              {onEdit && (
                <button
                  onClick={() => onEdit(project)}
                  title="Edit Project"
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}

              {onDelete && (
                <button
                  onClick={() => onDelete(project.id)}
                  title="Delete Project"
                  className="p-1.5 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                onClick={() => onOpen(project)}
                id={`open-project-${project.id}`}
                className="flex items-center gap-1 text-xs font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 group-hover:translate-x-0.5 transition-transform cursor-pointer pl-2"
              >
                <span>Open</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
