import React from 'react';
import { User, LogOut, Database, Copy, Check, ShieldCheck, Sparkles, Code2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import { UserProfile } from '../types';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { SUPABASE_SQL_SCHEMA } from '../lib/sqlExport';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onLogout: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onLogout,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [showSql, setShowSql] = React.useState(false);
  const isLiveSupabase = isSupabaseConfigured();

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Account & Database Settings" maxWidth="lg">
      <div className="space-y-6">
        {/* User Badge */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700">
          <div className="w-12 h-12 rounded-full bg-orange-500 text-white font-black text-lg flex items-center justify-center overflow-hidden shadow-md">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              user?.name?.charAt(0).toUpperCase() || 'U'
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
              {user?.name || 'TU DU Member'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
              {user?.email || 'demo@tudu.app'}
            </p>
          </div>
          <button
            onClick={() => {
              if (isLiveSupabase && supabase) {
                supabase.auth.signOut();
              }
              onLogout();
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>

        {/* Supabase Status Banner */}
        <div className="p-4 rounded-2xl border bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-orange-500" />
              <h5 className="font-bold text-sm text-slate-900 dark:text-white">
                Supabase Backend
              </h5>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                isLiveSupabase
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
              }`}
            >
              {isLiveSupabase ? 'Live Connected' : 'Local Persistence Engine'}
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
            {isLiveSupabase
              ? 'Your application is directly connected to Supabase PostgreSQL with active Row Level Security (RLS) policies.'
              : 'App is currently persisting data in local storage with high performance. To connect to a live Supabase database, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'}
          </p>

          <div className="pt-2">
            <button
              onClick={() => setShowSql(!showSql)}
              className="flex items-center gap-1.5 text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
            >
              <Code2 className="w-4 h-4" />
              <span>{showSql ? 'Hide Supabase SQL Migration' : 'View Supabase PostgreSQL Schema & RLS SQL'}</span>
            </button>
          </div>
        </div>

        {/* SQL Schema Exporter */}
        {showSql && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                SQL Migration & RLS Security Rules:
              </span>
              <button
                onClick={handleCopySql}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500 text-white font-bold text-xs hover:bg-orange-600 transition-colors cursor-pointer shadow-sm"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied SQL!' : 'Copy SQL Script'}</span>
              </button>
            </div>
            <pre className="p-3 bg-zinc-950 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto max-h-60 border border-zinc-800 select-all">
              {SUPABASE_SQL_SCHEMA}
            </pre>
          </div>
        )}
      </div>
    </Modal>
  );
};
