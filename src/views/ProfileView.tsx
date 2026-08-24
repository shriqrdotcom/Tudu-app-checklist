import React from 'react';
import {
  User,
  LogOut,
  Copy,
  Check,
  Code2,
  Camera,
  Palette,
  ShieldCheck,
  Sun,
  Moon,
  Trash2,
} from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { ThemeToggle } from '../components/ThemeToggle';
import { UserProfile, ThemeMode } from '../types';
import { DataService, isSupabaseConfigured } from '../lib/supabase';
import { compressAndUploadImage, deleteStorageFileFromUrl, isSupabaseStorageUrl } from '../lib/storage';
import { SUPABASE_SQL_SCHEMA } from '../lib/sqlExport';

interface ProfileViewProps {
  user: UserProfile;
  theme: ThemeMode;
  isLoggingOut?: boolean;
  onThemeChange: (theme: ThemeMode) => void;
  onToggleTheme: () => void;
  onUpdateUser: (user: UserProfile) => void;
  onLogout: () => void;
}

const displayName = (name?: string): string => (name && name.trim() ? name : 'TU DU User');

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  theme,
  isLoggingOut = false,
  onThemeChange,
  onToggleTheme,
  onUpdateUser,
  onLogout,
}) => {
  const [nameValue, setNameValue] = React.useState(displayName(user.name));
  const [isSavingName, setIsSavingName] = React.useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [showSql, setShowSql] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const isLiveSupabase = isSupabaseConfigured();

  React.useEffect(() => {
    setNameValue(displayName(user.name));
  }, [user.name]);

  const memberSince = React.useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(
        new Date(user.created_at)
      );
    } catch {
      return '';
    }
  }, [user.created_at]);

  const flashFeedback = (message: string) => {
    setFeedback(message);
    setTimeout(() => setFeedback(''), 2500);
  };

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === user.name) return;

    try {
      setIsSavingName(true);
      const updated = await DataService.updateProfile(user.user_id, { name: trimmed });
      onUpdateUser({ ...updated, email: user.email });
    } catch (err) {
      console.error('Failed to update profile:', err);
      flashFeedback('Could not save your name. Please try again.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const oldAvatar = user.avatar_url || '';
    try {
      setIsUploadingAvatar(true);
      const url = await compressAndUploadImage(file, 'avatars', user.user_id);
      const updated = await DataService.updateProfile(user.user_id, { avatar_url: url });
      onUpdateUser({ ...updated, email: user.email });
      if (oldAvatar !== url && isSupabaseStorageUrl(oldAvatar)) {
        deleteStorageFileFromUrl(oldAvatar);
      }
    } catch (err) {
      console.error('Failed to upload avatar:', err);
      flashFeedback('Image upload failed. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user.avatar_url) return;
    const oldAvatar = user.avatar_url;
    try {
      setIsUploadingAvatar(true);
      const updated = await DataService.updateProfile(user.user_id, { avatar_url: null });
      onUpdateUser({ ...updated, email: user.email });
      if (isSupabaseStorageUrl(oldAvatar)) deleteStorageFileFromUrl(oldAvatar);
    } catch (err) {
      console.error('Failed to remove avatar:', err);
      flashFeedback('Could not remove your avatar. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nameChanged =
    nameValue.trim() !== user.name && nameValue.trim().length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-28">
      {/* Page Heading */}
      <div>
        <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <User className="w-5 h-5 text-orange-500" aria-hidden="true" />
          Profile
        </h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
          Manage your account, appearance and connection.
        </p>
      </div>

      {/* Account Card */}
      <section
        aria-labelledby="profile-account-heading"
        className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-5"
      >
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 text-white font-black text-xl flex items-center justify-center overflow-hidden shadow-md orange-glow-sm select-none">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={`${displayName(user.name)}'s avatar`}
                  className="w-full h-full object-cover"
                />
              ) : (
                displayName(user.name).charAt(0).toUpperCase()
              )}
            </div>

            {/* Upload / replace */}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUploadingAvatar}
              aria-label={user.avatar_url ? 'Replace avatar' : 'Upload avatar'}
              title={user.avatar_url ? 'Replace avatar' : 'Upload avatar'}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center border-2 border-white dark:border-zinc-900 hover:bg-orange-500 hover:text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60"
            >
              {isUploadingAvatar ? (
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Remove */}
            {user.avatar_url && !isUploadingAvatar && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                aria-label="Remove avatar"
                title="Remove avatar"
                className="absolute top-0 right-0 w-6 h-6 rounded-full bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 flex items-center justify-center border border-slate-200 dark:border-zinc-700 hover:text-red-500 hover:border-red-300 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarSelect}
              className="hidden"
            />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base text-slate-900 dark:text-white truncate">
              {displayName(user.name)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
              {user.email || 'Signed in'}
            </p>
            <span
              className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                isLiveSupabase
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
              }`}
            >
              <ShieldCheck className="w-3 h-3" aria-hidden="true" />
              {isLiveSupabase ? 'RLS Protected' : 'Setup Required'}
            </span>
          </div>
        </div>

        {/* Display-name editor */}
        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <Input
              label="Display Name"
              type="text"
              value={nameValue}
              maxLength={40}
              onChange={(e) => setNameValue(e.target.value)}
              placeholder="Your name"
              autoComplete="nickname"
            />
            <Button
              onClick={handleSaveName}
              isLoading={isSavingName}
              disabled={!nameChanged}
              size="md"
            >
              Save
            </Button>
          </div>
          {feedback && (
            <p role="status" className="text-[11px] font-semibold text-red-600 dark:text-red-400">
              {feedback}
            </p>
          )}
        </div>
      </section>

      {/* Appearance Card */}
      <section
        aria-labelledby="profile-appearance-heading"
        className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Palette className="w-5 h-5 text-orange-500" aria-hidden="true" />
            <h3 id="profile-appearance-heading" className="font-bold text-sm text-slate-900 dark:text-white">
              Appearance
            </h3>
          </div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>

        {/* Explicit Light / Dark selection */}
        <div
          role="radiogroup"
          aria-label="Theme"
          className="grid grid-cols-2 gap-2"
        >
          <button
            type="button"
            role="radio"
            aria-checked={theme === 'light'}
            onClick={() => onThemeChange('light')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 ${
              theme === 'light'
                ? 'bg-orange-500/10 border-orange-500/40 text-orange-600 dark:text-orange-400'
                : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-orange-500/40'
            }`}
          >
            <Sun className="w-4 h-4" aria-hidden="true" />
            Light
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={theme === 'dark'}
            onClick={() => onThemeChange('dark')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 ${
              theme === 'dark'
                ? 'bg-orange-500/10 border-orange-500/40 text-orange-600 dark:text-orange-400'
                : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-orange-500/40'
            }`}
          >
            <Moon className="w-4 h-4" aria-hidden="true" />
            Dark
          </button>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-zinc-500">
          Saved to this device and to your account.
        </p>
      </section>

      {/* Account Card */}
      <section
        aria-labelledby="profile-security-heading"
        className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" aria-hidden="true" />
            <h3 id="profile-security-heading" className="font-bold text-sm text-slate-900 dark:text-white">
              Account
            </h3>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 whitespace-nowrap">
            {memberSince ? `Member since ${memberSince}` : 'Active'}
          </span>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-slate-400 dark:text-zinc-500 font-semibold">Email</dt>
          <dd className="text-slate-700 dark:text-zinc-200 truncate">{user.email || '—'}</dd>
          <dt className="text-slate-400 dark:text-zinc-500 font-semibold">Sign-in</dt>
          <dd className="text-slate-700 dark:text-zinc-200">Email &amp; password (Supabase Auth)</dd>
        </dl>

        <Button variant="danger" fullWidth onClick={onLogout} isLoading={isLoggingOut}>
          {!isLoggingOut && <LogOut className="w-4 h-4" />}
          {isLoggingOut ? 'Signing out...' : 'Log out'}
        </Button>
      </section>

      {/* Database Setup Card */}
      <section
        aria-labelledby="profile-db-heading"
        className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 id="profile-db-heading" className="font-bold text-sm text-slate-900 dark:text-white">
            Supabase Backend
          </h3>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
              isLiveSupabase
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
            }`}
          >
            {isLiveSupabase ? 'Live Connected' : 'Not Connected'}
          </span>
        </div>
        <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
          Run the SQL below once in your Supabase Dashboard → SQL Editor. It creates the tables,
          RLS security policies and storage buckets used by TU DU.
        </p>
        <button
          onClick={() => setShowSql(!showSql)}
          className="flex items-center gap-1.5 text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
        >
          <Code2 className="w-4 h-4" aria-hidden="true" />
          <span>{showSql ? 'Hide SQL migration' : 'View schema & RLS SQL'}</span>
        </button>
        {showSql && (
          <div className="space-y-2 pt-1">
            <Button variant="secondary" size="sm" onClick={handleCopySql}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied SQL!' : 'Copy SQL Script'}
            </Button>
            <pre className="p-3 bg-zinc-950 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto max-h-60 border border-zinc-800 select-all">
              {SUPABASE_SQL_SCHEMA}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
};
