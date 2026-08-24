import React from 'react';
import { KeyRound, Mail, AlertCircle, Database, MailCheck } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile) => void;
}

function friendlyAuthError(err: any): string {
  const message: string = err?.message || 'Authentication failed. Please try again.';
  if (/invalid login credentials/i.test(message)) return 'Incorrect email or password.';
  if (/user already registered/i.test(message)) return 'An account with this email already exists. Try signing in.';
  if (/password should be at least/i.test(message)) return 'Password must be at least 6 characters.';
  if (/rate limit/i.test(message)) return 'Too many attempts. Please wait a moment and try again.';
  return message;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [mode, setMode] = React.useState<'login' | 'signup'>('login');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');
  const [confirmationSent, setConfirmationSent] = React.useState(false);

  const isLiveSupabase = isSupabaseConfigured();

  const resetForm = () => {
    setErrorMsg('');
    setConfirmationSent(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!isLiveSupabase || !supabase || !email || !password) return;

    try {
      setIsLoading(true);

      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name: name || email.split('@')[0] },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;

        if (data.session && data.user) {
          onAuthSuccess({
            id: data.user.id,
            user_id: data.user.id,
            email: data.user.email,
            name: name || email.split('@')[0],
            created_at: data.user.created_at ?? new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          onClose();
        } else {
          // Email confirmation required — no session yet
          setConfirmationSent(true);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
          onAuthSuccess({
            id: data.user.id,
            user_id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.name || email.split('@')[0],
            created_at: data.user.created_at ?? new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMsg(friendlyAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title={mode === 'login' ? 'Sign In to TU DU' : 'Create TU DU Account'}
      maxWidth="sm"
    >
      {!isLiveSupabase ? (
        <div className="space-y-4">
          <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl flex items-start gap-3">
            <Database className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
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
      ) : confirmationSent ? (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start gap-3">
            <MailCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                Confirm your email
              </p>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 leading-relaxed">
                We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
                account, then sign in.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            fullWidth
            onClick={() => {
              setMode('login');
              setConfirmationSent(false);
            }}
          >
            Back to Sign In
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Toggle Mode */}
          <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl mb-4">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white dark:bg-zinc-900 text-orange-600 dark:text-orange-400 shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg('');
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white dark:bg-zinc-900 text-orange-600 dark:text-orange-400 shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400'
              }`}
            >
              Sign Up
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {mode === 'signup' && (
          <Input
            label="Full Name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
          )}

          <Input
            label="Email Address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alex@tudu.app"
            autoComplete="email"
            icon={<Mail className="w-4 h-4" />}
          />

          <Input
            label="Password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            icon={<KeyRound className="w-4 h-4" />}
          />

          <Button type="submit" fullWidth isLoading={isLoading} className="mt-2">
            {isLoading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>

          <p className="text-[11px] text-center text-slate-400 dark:text-zinc-500 mt-2">
            Secured by Supabase Auth. Your data is protected by Row Level Security.
          </p>
        </form>
      )}
    </Modal>
  );
};
