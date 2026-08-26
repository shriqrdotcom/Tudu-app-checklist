import React from 'react';
import { Star, AlertCircle, Plus, Trash2, Bell } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { ImageUploader } from './ImageUploader';
import { ProjectSelect } from './ProjectSelect';
import { SimpleTimePicker } from './SimpleTimePicker';
import { ProgressProject, ProgressTask, TaskReminder } from '../types';
import { microBuzz } from '../lib/notificationManager';

interface ExtraReminder {
  id: string;
  remind_at: string;
}

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
  /** Existing reminders for this task (from parent state) */
  reminders?: TaskReminder[];
  /** Callback to add a new reminder */
  onAddReminder?: (taskId: string, remindAt: string) => Promise<void>;
  /** Callback to delete a reminder */
  onDeleteReminder?: (reminderId: string) => Promise<void>;
}

export const EditTaskModal: React.FC<EditTaskModalProps> = ({
  task,
  projects,
  userId,
  onClose,
  onSave,
  reminders = [],
  onAddReminder,
  onDeleteReminder,
}) => {
  const [title, setTitle] = React.useState(task.title);
  const [description, setDescription] = React.useState(task.description || '');
  const [imageUrl, setImageUrl] = React.useState(task.image_url || '');
  const [isFavorite, setIsFavorite] = React.useState(Boolean(task.is_favorite));
  const [projectId, setProjectId] = React.useState(task.project_id);
  const [dueDatetime, setDueDatetime] = React.useState<string | null>(task.due_datetime ?? null);
  const [extraReminders, setExtraReminders] = React.useState<ExtraReminder[]>(() =>
    reminders
      .filter((r) => r.remind_at !== task.due_datetime && r.status === 'pending')
      .map((r) => ({ id: r.id, remind_at: r.remind_at }))
  );
  const [errorMsg, setErrorMsg] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [showExtraReminders, setShowExtraReminders] = React.useState(false);

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

  const addExtraReminder = () => {
    microBuzz();
    const newReminder: ExtraReminder = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      remind_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // default +1 hour
    };
    setExtraReminders((prev) => [...prev, newReminder]);
    setShowExtraReminders(true);
  };

  const removeExtraReminder = async (id: string) => {
    microBuzz();
    const reminder = extraReminders.find((r) => r.id === id);
    if (reminder && !reminder.id.startsWith('temp-') && onDeleteReminder) {
      await onDeleteReminder(reminder.id);
    }
    setExtraReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const updateExtraReminder = (id: string, remindAt: string) => {
    setExtraReminders((prev) => prev.map((r) => (r.id === id ? { ...r, remind_at: remindAt } : r)));
  };

  const formatReminderTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString([], { 
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
      });
    } catch {
      return iso;
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

        {/* Reminder scheduling — preset chips + native date & time */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
            Remind Me At <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <SimpleTimePicker value={dueDatetime} onChange={setDueDatetime} />
        </div>

        {/* Extra Reminders — add up to 5 additional notification times */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Extra Reminders <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <button
              type="button"
              onClick={() => setShowExtraReminders(!showExtraReminders)}
              className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline"
            >
              {showExtraReminders ? 'Hide' : extraReminders.length > 0 ? `Show (${extraReminders.length})` : 'Add'}
            </button>
          </div>

          {showExtraReminders && (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {extraReminders.length > 0 ? (
                extraReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700"
                  >
                    <Bell className="w-4 h-4 text-orange-500 shrink-0" />
                    <SimpleTimePicker
                      value={reminder.remind_at}
                      onChange={(iso) => updateExtraReminder(reminder.id, iso || new Date().toISOString())}
                    />
                    <button
                      type="button"
                      onClick={() => removeExtraReminder(reminder.id)}
                      aria-label="Remove reminder"
                      className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 dark:text-zinc-400 text-center py-2">
                  No extra reminders yet. Add one below.
                </p>
              )}
              {extraReminders.length < 5 && (
                <button
                  type="button"
                  onClick={addExtraReminder}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-orange-500/50 text-orange-600 dark:text-orange-400 text-xs font-semibold hover:bg-orange-500/10 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add Extra Reminder
                </button>
              )}
              {extraReminders.length >= 5 && (
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 text-center">
                  Maximum 5 extra reminders reached.
                </p>
              )}
            </div>
          )}
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
