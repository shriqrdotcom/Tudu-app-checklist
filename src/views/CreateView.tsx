import React from 'react';
import { FolderPlus, CheckSquare, Sparkles, Star, Palette } from 'lucide-react';
import { motion } from 'motion/react';
import { ProgressProject, ProgressTask } from '../types';
import { ImageUploader } from '../components/ImageUploader';

interface CreateViewProps {
  projects: ProgressProject[];
  onCreateProject: (projectData: {
    title: string;
    description: string;
    image_url: string;
    accent_color: string;
    is_favorite: boolean;
  }) => Promise<void>;
  onCreateTask: (taskData: {
    project_id: string;
    title: string;
    description: string;
    image_url: string;
  }) => Promise<void>;
  defaultProjectId?: string;
  userId?: string;
  onSuccess: () => void;
}

const ACCENT_COLORS = [
  { name: 'Orange', hex: '#ff6b00' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Red', hex: '#ef4444' },
];

export const CreateView: React.FC<CreateViewProps> = ({
  projects,
  onCreateProject,
  onCreateTask,
  defaultProjectId,
  userId = 'demo-user-123',
  onSuccess,
}) => {
  const [activeMode, setActiveMode] = React.useState<'project' | 'task'>('project');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form State - Project
  const [projectTitle, setProjectTitle] = React.useState('');
  const [projectDesc, setProjectDesc] = React.useState('');
  const [projectImage, setProjectImage] = React.useState('');
  const [accentColor, setAccentColor] = React.useState('#ff6b00');
  const [isFavorite, setIsFavorite] = React.useState(false);

  // Form State - Task
  const [selectedProjectId, setSelectedProjectId] = React.useState(
    defaultProjectId || (projects[0]?.id ?? '')
  );
  const [taskTitle, setTaskTitle] = React.useState('');
  const [taskDesc, setTaskDesc] = React.useState('');
  const [taskImage, setTaskImage] = React.useState('');

  React.useEffect(() => {
    if (defaultProjectId) {
      setSelectedProjectId(defaultProjectId);
      setActiveMode('task');
    }
  }, [defaultProjectId]);

  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectTitle.trim()) return;

    try {
      setIsSubmitting(true);
      await onCreateProject({
        title: projectTitle.trim(),
        description: projectDesc.trim(),
        image_url: projectImage,
        accent_color: accentColor,
        is_favorite: isFavorite,
      });
      onSuccess();
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !selectedProjectId) return;

    try {
      setIsSubmitting(true);
      await onCreateTask({
        project_id: selectedProjectId,
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        image_url: taskImage,
      });
      onSuccess();
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24">
      {/* Header Tabs: Project vs Task */}
      <div className="flex bg-slate-100 dark:bg-zinc-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-zinc-700/80">
        <button
          onClick={() => setActiveMode('project')}
          id="tab-create-project"
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeMode === 'project'
              ? 'bg-white dark:bg-zinc-900 text-orange-600 dark:text-orange-400 shadow-sm border border-slate-200/80 dark:border-zinc-700'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <FolderPlus className="w-4 h-4" />
          <span>New Progress Project</span>
        </button>

        <button
          onClick={() => setActiveMode('task')}
          id="tab-create-task"
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeMode === 'task'
              ? 'bg-white dark:bg-zinc-900 text-orange-600 dark:text-orange-400 shadow-sm border border-slate-200/80 dark:border-zinc-700'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>New Task Item</span>
        </button>
      </div>

      {/* Form Container */}
      <motion.div
        key={activeMode}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-zinc-800 shadow-xl"
      >
        {activeMode === 'project' ? (
          <form onSubmit={handleSubmitProject} className="space-y-5">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-orange-500" />
                <span>Create Progress Project</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                A project acts as a container for checklist tasks and tracks completion progress.
              </p>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Project Title <span className="text-orange-500">*</span>
              </label>
              <input
                type="text"
                required
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="e.g. Website Development, Marketing Campaign..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Description (Optional)
              </label>
              <textarea
                rows={3}
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                placeholder="Brief summary of goals and deliverables..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>

            {/* Accent Color Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-orange-500" />
                <span>Project Color Theme</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {ACCENT_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setAccentColor(c.hex)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-transform cursor-pointer ${
                      accentColor === c.hex
                        ? 'border-slate-900 dark:border-white scale-110 shadow-md'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            {/* Image Uploader */}
            <ImageUploader
              value={projectImage}
              onChange={setProjectImage}
              bucket="project-images"
              userId={userId}
              label="Project Header Banner / Image (Optional)"
            />

            {/* Favorite Checkbox */}
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
                <span>Add to Favorite Projects</span>
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !projectTitle.trim()}
              id="submit-project-btn"
              className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-extrabold text-sm shadow-lg shadow-orange-500/30 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isSubmitting ? 'Creating Project...' : 'Create Progress Project'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmitTask} className="space-y-5">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-orange-500" />
                <span>Add Checklist Task</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Assign a new task to a specific Progress Project.
              </p>
            </div>

            {/* Select Target Project */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Select Progress Project <span className="text-orange-500">*</span>
              </label>
              <select
                required
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {projects.length === 0 && <option value="">No projects available</option>}
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.total_tasks ?? 0} tasks)
                  </option>
                ))}
              </select>
            </div>

            {/* Task Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Task Title <span className="text-orange-500">*</span>
              </label>
              <input
                type="text"
                required
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g. Design hero section wireframes..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Task Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Task Notes / Details (Optional)
              </label>
              <textarea
                rows={3}
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="Add sub-notes or specifications..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>

            {/* Image Attachment */}
            <ImageUploader
              value={taskImage}
              onChange={setTaskImage}
              bucket="task-images"
              userId={userId}
              label="Attach Mockup or Reference Image (Optional)"
            />

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !taskTitle.trim() || !selectedProjectId}
              id="submit-task-btn"
              className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-extrabold text-sm shadow-lg shadow-orange-500/30 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isSubmitting ? 'Adding Task...' : 'Add Task to Project'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};
