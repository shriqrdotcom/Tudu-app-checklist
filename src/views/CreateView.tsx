import React from 'react';
import { FolderPlus, CheckSquare, Star, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { ProgressProject, ProgressTask } from '../types';
import { ImageUploader } from '../components/ImageUploader';
import { ProjectSelect } from '../components/ProjectSelect';
import { TimeSelector } from '../components/TimeSelector';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { ACCENT_COLORS, DEFAULT_ACCENT } from '../lib/accentColors';

interface CreateViewProps {
  projects: ProgressProject[];
  userId: string;
  onCreateProject: (projectData: {
    title: string;
    description: string;
    image_url: string;
    accent_color: string;
    is_favorite: boolean;
  }) => Promise<ProgressProject>;
  onCreateTask: (taskData: {
    project_id: string;
    title: string;
    description: string;
    image_url: string;
    is_favorite: boolean;
    due_datetime?: string | null;
  }) => Promise<ProgressTask>;
}

type CreateMode = 'project' | 'task';

export const CreateView: React.FC<CreateViewProps> = ({
  projects,
  userId,
  onCreateProject,
  onCreateTask,
}) => {
  const [activeMode, setActiveMode] = React.useState<CreateMode>('project');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form State - Project
  const [projectTitle, setProjectTitle] = React.useState('');
  const [projectDesc, setProjectDesc] = React.useState('');
  const [projectImage, setProjectImage] = React.useState('');
  const [accentColor, setAccentColor] = React.useState(DEFAULT_ACCENT);
  const [isFavorite, setIsFavorite] = React.useState(false);
  const [projectError, setProjectError] = React.useState('');

  // Form State - Task
  const [selectedProjectId, setSelectedProjectId] = React.useState('');
  const [taskTitle, setTaskTitle] = React.useState('');
  const [taskDesc, setTaskDesc] = React.useState('');
  const [taskImage, setTaskImage] = React.useState('');
  const [isTaskFavorite, setIsTaskFavorite] = React.useState(false);
  const [taskDueDatetime, setTaskDueDatetime] = React.useState<string | null>(null);
  const [taskError, setTaskError] = React.useState('');

  const resetProjectForm = () => {
    setProjectTitle('');
    setProjectDesc('');
    setProjectImage('');
    setAccentColor(DEFAULT_ACCENT);
    setIsFavorite(false);
    setProjectError('');
  };

  const resetTaskForm = () => {
    setSelectedProjectId('');
    setTaskTitle('');
    setTaskDesc('');
    setTaskImage('');
    setIsTaskFavorite(false);
    setTaskDueDatetime(null);
    setTaskError('');
  };

  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectTitle.trim()) {
      setProjectError('Please give your progress a name.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onCreateProject({
        title: projectTitle.trim(),
        description: projectDesc.trim(),
        image_url: projectImage,
        accent_color: accentColor,
        is_favorite: isFavorite,
      });
      resetProjectForm();
    } catch (err: any) {
      console.error('Failed to create progress:', err);
      const msg: string = err?.message || '';
      if (/could not find the table|PGRST205|schema cache/i.test(msg)) {
        setProjectError(
          'Database setup incomplete. Open Profile → Supabase Backend, copy the SQL, and run it in Supabase → SQL Editor.'
        );
      } else if (/failed to fetch|networkerror|network error|load failed/i.test(msg)) {
        setProjectError('Unable to connect. Please try again.');
      } else {
        setProjectError('Unable to create progress. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setTaskError('Choose which progress this task belongs to.');
      return;
    }
    if (!taskTitle.trim()) {
      setTaskError('Please give the task a title.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onCreateTask({
        project_id: selectedProjectId,
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        image_url: taskImage,
        is_favorite: isTaskFavorite,
        due_datetime: taskDueDatetime,
      });
      resetTaskForm();
    } catch (err) {
      console.error('Failed to add task:', err);
      setTaskError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-28">
      {/* Page Heading */}
      <div>
        <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
          Create Something
        </h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
          Start a new progress or extend an existing checklist.
        </p>
      </div>

      {/* Two distinct entry actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setActiveMode('project')}
          id="tab-create-project"
          aria-pressed={activeMode === 'project'}
          className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all cursor-pointer active:scale-[0.98] ${
            activeMode === 'project'
              ? 'bg-orange-500/10 dark:bg-orange-500/15 border-orange-500/50 shadow-md shadow-orange-500/10'
              : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-orange-500/40 shadow-sm'
          }`}
        >
          <span
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              activeMode === 'project'
                ? 'bg-gradient-to-tr from-orange-600 to-amber-500 text-white orange-glow-sm'
                : 'bg-slate-100 dark:bg-zinc-800 text-orange-500'
            }`}
          >
            <FolderPlus className="w-5 h-5" />
          </span>
          <span>
            <span className="block text-sm font-extrabold text-slate-900 dark:text-white">
              + Create Progress
            </span>
            <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              A new project to track completion.
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMode('task')}
          id="tab-create-task"
          aria-pressed={activeMode === 'task'}
          className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all cursor-pointer active:scale-[0.98] ${
            activeMode === 'task'
              ? 'bg-orange-500/10 dark:bg-orange-500/15 border-orange-500/50 shadow-md shadow-orange-500/10'
              : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-orange-500/40 shadow-sm'
          }`}
        >
          <span
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              activeMode === 'task'
                ? 'bg-gradient-to-tr from-orange-600 to-amber-500 text-white orange-glow-sm'
                : 'bg-slate-100 dark:bg-zinc-800 text-emerald-500'
            }`}
          >
            <CheckSquare className="w-5 h-5" />
          </span>
          <span>
            <span className="block text-sm font-extrabold text-slate-900 dark:text-white">
              + Add Task
            </span>
            <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              A checklist item inside a progress.
            </span>
          </span>
        </button>
      </div>

      {/* Form Container */}
      <motion.div
        key={activeMode}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-zinc-800 shadow-lg"
      >
        {activeMode === 'project' ? (
          <form onSubmit={handleSubmitProject} className="space-y-5" noValidate>
            {/* Title */}
            <Input
              label="Progress Name"
              type="text"
              value={projectTitle}
              onChange={(e) => {
                setProjectTitle(e.target.value);
                if (e.target.value.trim()) setProjectError('');
              }}
              placeholder="e.g. Restaurant Dashboard"
              maxLength={80}
              autoComplete="off"
            />

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Description <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                rows={3}
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                placeholder="What are you working toward?"
                maxLength={300}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>

            {/* Accent Color Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-2">
                Accent Color <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {ACCENT_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setAccentColor(c.hex)}
                    aria-label={c.name}
                    title={c.name}
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-transform cursor-pointer ${
                      accentColor === c.hex
                        ? 'border-slate-900 dark:border-white scale-110 shadow-md'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>

            {/* Image Uploader */}
            <ImageUploader
              value={projectImage}
              onChange={(url) => {
                setProjectImage(url);
                setProjectError('');
              }}
              bucket="project-images"
              userId={userId}
              label="Project Image (Optional)"
            />

            {/* Favorite Toggle */}
            <div className="flex items-center gap-2 pt-1">
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
                <span>Mark as Favorite</span>
              </button>
            </div>

            {/* Validation */}
            {projectError && (
              <p
                id="project-error"
                role="alert"
                className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {projectError}
              </p>
            )}

            {/* Submit */}
            <Button
              type="submit"
              size="lg"
              fullWidth
              isLoading={isSubmitting}
              id="submit-project-btn"
            >
              {isSubmitting ? 'Creating...' : 'Create Progress'}
            </Button>
          </form>
        ) : projects.length === 0 ? (
          /* No-progress empty state */
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center orange-glow-sm">
              <FolderPlus className="w-8 h-8 stroke-[1.8]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">No Progress yet</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-xs leading-relaxed">
                Create your first Progress before adding tasks.
              </p>
            </div>
            <Button onClick={() => setActiveMode('project')}>Create Progress</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmitTask} className="space-y-5" noValidate>
            {/* Searchable project selector */}
            <ProjectSelect
              projects={projects}
              value={selectedProjectId}
              onChange={(id) => {
                setSelectedProjectId(id);
                setTaskError('');
              }}
            />

            {/* Task Title */}
            <Input
              label="Task Title"
              type="text"
              value={taskTitle}
              onChange={(e) => {
                setTaskTitle(e.target.value);
                if (e.target.value.trim()) setTaskError('');
              }}
              placeholder="e.g. Orders Page + Add Orders"
              maxLength={140}
              autoComplete="off"
            />

            {/* Reminder scheduling — presets + exact date & time */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                Remind Me At <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <TimeSelector value={taskDueDatetime} onChange={setTaskDueDatetime} />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Description <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                rows={3}
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="Describe what needs to be completed..."
                maxLength={400}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>

            {/* Image Attachment */}
            <ImageUploader
              value={taskImage}
              onChange={setTaskImage}
              bucket="task-images"
              userId={userId}
              label="Task Image (Optional)"
            />

            {/* Favorite Toggle */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsTaskFavorite(!isTaskFavorite)}
                className={`p-2 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-colors cursor-pointer ${
                  isTaskFavorite
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/40'
                    : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
                }`}
              >
                <Star
                  className={`w-4 h-4 ${
                    isTaskFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
                  }`}
                />
                <span>Mark as Favorite</span>
              </button>
            </div>

            {/* Validation */}
            {taskError && (
              <p
                id="task-error"
                role="alert"
                className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {taskError}
              </p>
            )}

            {/* Submit */}
            <Button
              type="submit"
              size="lg"
              fullWidth
              isLoading={isSubmitting}
              id="submit-task-btn"
            >
              {isSubmitting ? 'Adding...' : 'Add Task'}
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
};
