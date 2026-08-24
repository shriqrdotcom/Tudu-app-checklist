import React from 'react';
import { KeyRound, Mail, AlertCircle, Database, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: () => void;
}

/** Private single-owner app: sign-in only. There is no public registration. */
export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');

  const isLiveSupabase = isSupabaseConfigured();

  const friendlyAuthError = (err: any): string => {
    const code = err?.code || '';
    const message: string = err?.message || '';

    if (code === 'user_banned' || /disabled|banned/i.test(message)) {
      return 'This account is not available.';
    }
    if (/email not confirmed/i.test(message)) {
      return 'This account is not available.';
    }
    if (/invalid login credentials|invalid credentials|user not found/i.test(message)) {
      return 'Incorrect email or password.';
    }
    if (
      /failed to fetch|networkerror|network error|load failed/i.test(message) ||
      code === 'fetch_error'
    ) {
      return 'Unable to connect. Please try again.';
    }
    if (/rate limit/i.test(message)) {
      return 'Too many attempts. Please wait a moment and try again.';
    }
    return 'Unable to sign in. Please try again.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!isLiveSupabase || !supabase || !email || !password) return;

    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // onAuthStateChange in App loads the session + data automatically
      onAuthSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(friendlyAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="TU DU ★" maxWidth="sm">
      {!isLiveSupabase ? (
        <div className="space-y-4">
          <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl flex items-start gap-3">
            <Database className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
                Supabase is not connected
              </p>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 leading-relaxed">
                Set <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
                <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> in your{' '}
                <code className="font-mono">.env.local</code>, then restart the app to enable
                authentication.
              </p>
            </div>
          </div>
          <Button variant="secondary" fullWidth onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Heading */}
          <div className="pb-1">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Welcome back</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Sign in to continue to your progress.
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          <Input
            label="Email Address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@example.com"
            autoComplete="email"
            autoFocus
            icon={<Mail className="w-4 h-4" aria-hidden="true" />}
          />

          {/* Password with show/hide toggle */}
          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="current-password"
              icon={<KeyRound className="w-4 h-4" aria-hidden="true" />}
              className="pr-16"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 bottom-2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>

          <Button type="submit" fullWidth isLoading={isLoading} className="mt-1">
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>

          <p className="text-[11px] text-center text-slate-400 dark:text-zinc-500 pt-1 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3" aria-hidden="true" />
            Your data is protected by Supabase Row Level Security.
          </p>
        </form>
      )}
    </Modal>
  );
};
