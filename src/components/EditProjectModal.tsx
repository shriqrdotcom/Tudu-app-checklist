import React from 'react';
import { Star, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { ImageUploader } from './ImageUploader';
import { ProgressProject } from '../types';
import { ACCENT_COLORS } from '../lib/accentColors';

interface EditProjectModalProps {
  project: ProgressProject;
  userId: string;
  onClose: () => void;
  onSave: (updates: {
    title: string;
    description: string;
    image_url: string;
    accent_color: string;
    is_favorite: boolean;
  }) => Promise<void>;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({
  project,
  userId,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = React.useState(project.title);
  const [description, setDescription] = React.useState(project.description || '');
  const [imageUrl, setImageUrl] = React.useState(project.image_url || '');
  const [accentColor, setAccentColor] = React.useState(project.accent_color || '#ff6b00');
  const [isFavorite, setIsFavorite] = React.useState(Boolean(project.is_favorite));
  const [errorMsg, setErrorMsg] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please give your progress a name.');
      return;
    }

    try {
      setIsSaving(true);
      await onSave({
        title: title.trim(),
        description: description.trim(),
        image_url: imageUrl,
        accent_color: accentColor,
        is_favorite: isFavorite,
      });
      onClose();
    } catch (err) {
      console.error('Failed to update progress:', err);
      setErrorMsg('Something went wrong. Please try again.');
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Edit Progress" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Progress Name"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (e.target.value.trim()) setErrorMsg('');
          }}
          placeholder="e.g. Restaurant Dashboard"
          maxLength={80}
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
            placeholder="What are you working toward?"
            maxLength={300}
            className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
          />
        </div>

        {/* Accent color */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-2">
            Accent Color
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

        {/* Image (preview / replace / remove) */}
        <ImageUploader
          value={imageUrl}
          onChange={setImageUrl}
          bucket="project-images"
          userId={userId}
          label="Project Image"
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
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
