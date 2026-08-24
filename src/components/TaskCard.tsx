import React from 'react';
import { Check, Trash2, Edit2, Image as ImageIcon, Calendar } from 'lucide-react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { ProgressTask } from '../types';

interface TaskCardProps {
  task: ProgressTask;
  projectName?: string;
  projectColor?: string;
  onToggleComplete: (taskId: string, isCompleted: boolean) => void;
  onEdit?: (task: ProgressTask) => void;
  onDelete?: (taskId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  projectName,
  projectColor = '#ff6b00',
  onToggleComplete,
  onEdit,
  onDelete,
}) => {
  const [showImagePreview, setShowImagePreview] = React.useState(false);

  const handleToggle = () => {
    const nextState = !task.is_completed;
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
      <div className="flex items-start gap-3.5 flex-1 min-w-0">
        {/* Custom Checkbox */}
        <button
          onClick={handleToggle}
          id={`task-check-${task.id}`}
          className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border transition-all cursor-pointer ${
            task.is_completed
              ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
              : 'border-slate-300 dark:border-zinc-600 hover:border-orange-500 bg-white dark:bg-zinc-800'
          }`}
        >
          {task.is_completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
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
      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
        {onEdit && (
          <button
            onClick={() => onEdit(task)}
            title="Edit task"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}

        {onDelete && (
          <button
            onClick={() => onDelete(task.id)}
            title="Delete task"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
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
