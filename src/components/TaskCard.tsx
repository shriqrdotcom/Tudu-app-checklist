import React from 'react';
import { Check, Trash2, Edit2, Image as ImageIcon, Star } from 'lucide-react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { ProgressTask } from '../types';
import { formatDueCountdown } from '../lib/dueTime';
import { microBuzz } from '../lib/notificationManager';

interface TaskCardProps {
  task: ProgressTask;
  projectName?: string;
  projectColor?: string;
  /** True while the completion toggle is being confirmed by Supabase. */
  pending?: boolean;
  onToggleComplete: (taskId: string, isCompleted: boolean) => void;
  onToggleFavorite?: (taskId: string, current: boolean) => void;
  onEdit?: (task: ProgressTask) => void;
  onDelete?: (taskId: string) => void;
}

const TaskCardInner: React.FC<TaskCardProps> = ({
  task,
  projectName,
  projectColor = '#ff6b00',
  pending = false,
  onToggleComplete,
  onToggleFavorite,
  onEdit,
  onDelete,
}) => {
  const [showImagePreview, setShowImagePreview] = React.useState(false);

  // Live 1-second ticker for the countdown badge — but ONLY while the
  // deadline is "relevant" (pending and within ±2h). Cards far in the
  // future or long past render statically: zero cost at scale.
  const dueMs = task.due_datetime ? Date.parse(task.due_datetime) : NaN;
  const isDuePending = !Number.isNaN(dueMs) && !task.is_completed;
  const needsSecondTick =
    isDuePending && Math.abs(dueMs - Date.now()) < 2 * 60 * 60_000;
  const [nowTick, setNowTick] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!needsSecondTick) return;
    setNowTick(Date.now());
    const timer = window.setInterval(() => setNowTick(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [needsSecondTick]);

  const handleToggle = () => {
    const nextState = !task.is_completed;
    // Subtle haptic confirmation on every check/uncheck
    microBuzz();
    onToggleComplete(task.id, nextState);

    // Trigger subtle confetti on completion
    if (nextState) {
      confetti({
        particleCount: 30,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#ff6b00', '#f97316', '#fbbf24'],
      });
    }
  };

  // Countdown / overdue badge state, null when no deadline or completed
  const dueBadge =
    task.due_datetime && !task.is_completed
      ? formatDueCountdown(task.due_datetime, nowTick)
      : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group relative flex items-start justify-between gap-3 p-4 rounded-xl border transition-all duration-200 ${
        task.is_completed
          ? 'bg-slate-50/70 dark:bg-zinc-900/40 border-slate-200/60 dark:border-zinc-800/60 opacity-80'
          : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 shadow-sm hover:border-orange-500/40 dark:hover:border-orange-500/40'
      }`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {/* Custom Checkbox (with comfortable touch padding) */}
        <button
          onClick={handleToggle}
          disabled={pending}
          id={`task-check-${task.id}`}
          role="checkbox"
          aria-checked={task.is_completed}
          aria-label={task.is_completed ? `Mark "${task.title}" incomplete` : `Mark "${task.title}" complete`}
          className="mt-0.5 -m-1 p-1 rounded-lg shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 disabled:cursor-wait"
        >
          {pending ? (
            <span className="w-5 h-5 flex items-center justify-center">
              <span className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </span>
          ) : (
            <motion.span
              whileTap={{ scale: 0.85 }}
              className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all duration-200 ${
                task.is_completed
                  ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                  : 'border-slate-300 dark:border-zinc-600 hover:border-orange-500 bg-white dark:bg-zinc-800'
              }`}
            >
              {task.is_completed && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </motion.span>
              )}
            </motion.span>
          )}
        </button>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4
              className={`font-semibold text-sm transition-all ${
                task.is_completed
                  ? 'line-through text-slate-400 dark:text-zinc-500'
                  : 'text-slate-800 dark:text-zinc-100'
              }`}
            >
              {task.title}
            </h4>

            {projectName && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: projectColor }}
              >
                {projectName}
              </span>
            )}

            {/* Live countdown / flashing overdue badge */}
            {dueBadge && (
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border tabular-nums ${
                  dueBadge.overdue
                    ? 'bg-red-500/15 dark:bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/50 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.45)]'
                    : 'bg-orange-500/10 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30'
                }`}
                title={task.due_datetime ? new Date(task.due_datetime).toLocaleString() : undefined}
              >
                {dueBadge.label}
              </span>
            )}
          </div>

          {task.description && (
            <p
              className={`text-xs mt-1 leading-relaxed ${
                task.is_completed
                  ? 'text-slate-400 dark:text-zinc-600'
                  : 'text-slate-500 dark:text-zinc-400'
              }`}
            >
              {task.description}
            </p>
          )}

          {/* Attached Image Thumbnail */}
          {task.image_url && (
            <div className="mt-2.5">
              <button
                onClick={() => setShowImagePreview(true)}
                className="relative group/img flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
              >
                <img
                  src={task.image_url}
                  alt="Attachment"
                  className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-zinc-700"
                />
                <span className="font-medium">View Image</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Task Actions */}
      <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
        {onToggleFavorite && (
          <button
            onClick={() => onToggleFavorite(task.id, task.is_favorite)}
            id={`task-fav-${task.id}`}
            aria-label={task.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={task.is_favorite}
            title="Favorite"
            className="p-2 rounded-lg transition-colors cursor-pointer active:scale-90 hover:bg-slate-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60"
          >
            <Star
              className={`w-4 h-4 ${
                task.is_favorite
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-slate-300 dark:text-zinc-600'
              }`}
            />
          </button>
        )}

        {onEdit && (
          <button
            onClick={() => onEdit(task)}
            title="Edit task"
            aria-label={`Edit "${task.title}"`}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}

        {onDelete && (
          <button
            onClick={() => onDelete(task.id)}
            title="Delete task"
            aria-label={`Delete "${task.title}"`}
            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Image Preview Modal */}
      {showImagePreview && task.image_url && (
        <div
          onClick={() => setShowImagePreview(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="max-w-xl max-h-[85vh] overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 p-2 relative">
            <img
              src={task.image_url}
              alt={task.title}
              className="max-w-full max-h-[75vh] rounded-xl object-contain mx-auto"
            />
            <p className="text-center text-xs text-zinc-400 mt-2 font-medium">{task.title}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// Memoized: checklist rows only re-render when their own task data changes
export const TaskCard = React.memo(TaskCardInner);
