import React from 'react';
import { Upload, X, Image as ImageIcon, Sparkles, Check } from 'lucide-react';
import { PRESET_PROJECT_IMAGES, compressAndUploadImage } from '../lib/storage';

interface ImageUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  bucket?: 'project-images' | 'task-images';
  userId?: string;
  label?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  value,
  onChange,
  bucket = 'project-images',
  userId = 'demo-user-123',
  label = 'Cover Image (Optional)',
}) => {
  const [isUploading, setIsUploading] = React.useState(false);
  const [showPresets, setShowPresets] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const url = await compressAndUploadImage(file, bucket as 'project-images' | 'task-images', userId);
      onChange(url);
    } catch (err) {
      console.error('Failed to upload image:', err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowPresets(!showPresets)}
          className="text-xs text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
        >
          <Sparkles className="w-3 h-3" />
          <span>{showPresets ? 'Hide presets' : 'Choose preset'}</span>
        </button>
      </div>

      {/* Preset Picker Tray */}
      {showPresets && (
        <div className="mb-3 p-3 bg-slate-100 dark:bg-zinc-800/80 rounded-xl border border-slate-200 dark:border-zinc-700 grid grid-cols-4 gap-2">
          {PRESET_PROJECT_IMAGES.map((imgUrl, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onChange(imgUrl);
                setShowPresets(false);
              }}
              className={`relative h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer group ${
                value === imgUrl ? 'border-orange-500 scale-95 shadow-md' : 'border-transparent hover:opacity-90'
              }`}
            >
              <img src={imgUrl} alt={`Preset ${i}`} className="w-full h-full object-cover" />
              {value === imgUrl && (
                <div className="absolute inset-0 bg-orange-500/40 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white stroke-[3]" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Upload Drop Zone / Image Display */}
      {value ? (
        <div className="relative group w-full h-36 rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-700 bg-slate-900">
          <img src={value} alt="Uploaded" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white text-slate-900 rounded-lg text-xs font-bold hover:bg-slate-100 cursor-pointer shadow-md"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer shadow-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-28 border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-orange-500 dark:hover:border-orange-500 rounded-xl flex flex-col items-center justify-center p-4 text-center cursor-pointer bg-slate-50/50 dark:bg-zinc-800/30 hover:bg-orange-500/5 transition-all"
        >
          {isUploading ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 dark:text-orange-400">
              <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <span>Optimizing image...</span>
            </div>
          ) : (
            <>
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center text-slate-600 dark:text-zinc-400 mb-2">
                <Upload className="w-4 h-4" />
              </div>
              <p className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                Click or drag image to upload
              </p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                PNG, JPG, WebP up to 5MB
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};
