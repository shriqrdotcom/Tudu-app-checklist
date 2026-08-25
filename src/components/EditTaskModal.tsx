import React from 'react';
import { Star, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { ImageUploader } from './ImageUploader';
import { ProjectSelect } from './ProjectSelect';
import { TimeSelector } from './TimeSelector';
import { ProgressProject, ProgressTask } from '../types';

interface EditTaskModalProps {
  task: ProgressTask;
  /** The authenticated user's own projects — used for moving the task. */
  projects: ProgressProject[];
  userId: string;
  onClose: () => void;
  onSave: (updates: {
    title: string;
    description: string;
    image_url: string;
    is_favorite: boolean;
    project_id: string;
    due_datetime?: string | null;
  }) => Promise<void>;
}

export const EditTaskModal: React.FC<EditTaskModalProps> = ({
  task,
  projects,
  userId,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = React.useState(task.title);
  const [description, setDescription] = React.useState(task.description || '');
  const [imageUrl, setImageUrl] = React.useState(task.image_url || '');
  const [isFavorite, setIsFavorite] = React.useState(Boolean(task.is_favorite));
  const [projectId, setProjectId] = React.useState(task.project_id);
  const [dueDatetime, setDueDatetime] = React.useState<string | null>(task.due_datetime ?? null);
  const [errorMsg, setErrorMsg] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please give the task a title.');
      return;
    }
    if (!projectId) {
      setErrorMsg('Choose which progress this task belongs to.');
      return;
    }

    try {
      setIsSaving(true);
      await onSave({
        title: title.trim(),
        description: description.trim(),
        image_url: imageUrl,
        is_favorite: isFavorite,
        project_id: projectId,
        due_datetime: dueDatetime,
        // Re-arm the reminder when the deadline changes or is set
        ...(dueDatetime && dueDatetime !== task.due_datetime
          ? { snooze_until: null, notified: false }
          : {}),
      });
      onClose();
    } catch (err) {
      console.error('Failed to update task:', err);
      setErrorMsg('Something went wrong. Please try again.');
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Edit Task" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Move between the user's own projects */}
        <ProjectSelect
          projects={projects}
          value={projectId}
          onChange={(id) => {
            setProjectId(id);
            setErrorMsg('');
          }}
        />

        <Input
          label="Task Title"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (e.target.value.trim()) setErrorMsg('');
          }}
          placeholder="e.g. Orders Page + Add Orders"
          maxLength={140}
          required
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
            Description
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what needs to be completed..."
            maxLength={400}
            className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
          />
        </div>

        {/* Reminder scheduling — presets + exact date & time */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
            Remind Me At <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <TimeSelector value={dueDatetime} onChange={setDueDatetime} />
        </div>

        <ImageUploader
          value={imageUrl}
          onChange={setImageUrl}
          bucket="task-images"
          userId={userId}
          label="Task Image"
        />

        {/* Favorite */}
        <div>
          <button
            type="button"
            onClick={() => setIsFavorite(!isFavorite)}
            className={`p-2 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-colors cursor-pointer ${
              isFavorite
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/40'
                : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
            }`}
          >
            <Star
              className={`w-4 h-4 ${
                isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
              }`}
            />
            <span>{isFavorite ? 'Favorited' : 'Mark as Favorite'}</span>
          </button>
        </div>

        {errorMsg && (
          <p role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {errorMsg}
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving} className="flex-1">
            {isSaving ? 'Saving...' : 'Save Task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
