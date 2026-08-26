import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, RefreshCw, AlertCircle, WifiOff } from 'lucide-react';
import { Header } from './components/Header';
import { BottomNavigation } from './components/BottomNavigation';
import { ToastContainer } from './components/Toast';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Button } from './components/Button';
import { LoadingState } from './components/LoadingState';
import { EditProjectModal } from './components/EditProjectModal';
import { EditTaskModal } from './components/EditTaskModal';
import { EmptyState } from './components/EmptyState';
import { DashboardView } from './views/DashboardView';
import { CreateView } from './views/CreateView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { AuthModal } from './views/AuthModal';
import { ProfileView } from './views/ProfileView';
import { DataService, isSupabaseConfigured, supabase, detectDeadlineSchema } from './lib/supabase';
import { deleteStorageFileFromUrl, isSupabaseStorageUrl } from './lib/storage';
import { clearSnapshot, hasAnySnapshot, loadSnapshot, saveSnapshot } from './lib/cache';
import { usePrecisionTimer } from './hooks/usePrecisionTimer';
import { useContinuousAlarm } from './hooks/useContinuousAlarm';
import { ActiveAlarmModal } from './components/ActiveAlarmModal';
import { NotificationPermissionBanner } from './components/NotificationPermissionBanner';
import { subscribeToPush, getPushSubscription, unsubscribeFromPush } from './lib/notificationManager';
import { ProgressProject, ProgressTask, UserProfile, ViewTab, ThemeMode, ToastMessage, TaskReminder, PushSubscription } from './types';

// Auth state machine
type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated';

const STARTUP_TIMEOUT_MS = 15_000;
const MAX_STARTUP_RETRIES = 3;

export default function App() {
  // Theme State (localStorage + user_settings persistence)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('tudu_theme_v1');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Navigation & View State
  const [activeTab, setActiveTab] = useState<ViewTab>('dashboard');
  const [selectedProject, setSelectedProject] = useState<ProgressProject | null>(null);
  const [searchSignal, setSearchSignal] = useState(0);

  // Auth State Machine
  const [authStatus, setAuthStatus] = useState<AuthStatus>('unknown');

  // Data State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<ProgressProject[]>([]);
  const [tasks, setTasks] = useState<ProgressTask[]>([]);
  const [initialHasCache] = useState<boolean>(() => hasAnySnapshot());
  const [isLoading, setIsLoading] = useState<boolean>(() => !initialHasCache);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [updateReady, setUpdateReady] = useState<boolean>(false);

  // Startup tracking
  const [startupRetries, setStartupRetries] = useState(0);
  const startupTimeoutRef = useRef<number | null>(null);
  const startupCompleteRef = useRef(false);

  // Modals & Dialogs
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProgressProject | null>(null);
  const [editingTask, setEditingTask] = useState<ProgressTask | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Reminders & Push
  const [reminders, setReminders] = useState<TaskReminder[]>([]);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const pushSubscribedRef = useRef(false);

  // Reminder engine: FIFO queue of task ids whose deadline expired.
  const [overdueQueue, setOverdueQueue] = useState<string[]>([]);

  // Apply Theme class to <html> element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('tudu_theme_v1', theme);
  }, [theme]);

  const addToast = useCallback(
    (type: 'success' | 'error' | 'info', title: string, description?: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, title, description }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Persist theme to the user's server-side settings (fire & forget).
  // Guarded so an identity change of `user` (every refresh) never re-upserts
  // the same theme — one write per actual change per session.
  const persistedThemeRef = React.useRef<string>('');
  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return;
    const signature = `${user.user_id}:${theme}`;
    if (persistedThemeRef.current === signature) return;
    persistedThemeRef.current = signature;
    DataService.setUserTheme(user.user_id, theme).catch((err) =>
      console.warn('Failed to persist theme:', err)
    );
  }, [theme, user]);

  // Ref keeps latest theme without re-triggering loadData
  const themeRef = React.useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  // Tracks the newest loadData invocation for the race guard
  const loadRequestIdRef = React.useRef(0);

  // Startup timeout handling
  const clearStartupTimeout = useCallback(() => {
    if (startupTimeoutRef.current) {
      window.clearTimeout(startupTimeoutRef.current);
      startupTimeoutRef.current = null;
    }
  }, []);

  const handleStartupTimeout = useCallback(() => {
    if (startupCompleteRef.current) return;
    console.warn('[TU DU] Startup timeout reached');
    setLoadError('Startup timed out. Please check your connection and try again.');
    setIsLoading(false);
    setAuthStatus('unauthenticated');
  }, []);

  useEffect(() => {
    startupTimeoutRef.current = window.setTimeout(handleStartupTimeout, STARTUP_TIMEOUT_MS);
    return () => clearStartupTimeout();
  }, [handleStartupTimeout, clearStartupTimeout]);
  // Loading-mode separation: initial load (may show skeletons/full-screen)
  // vs background refresh (never blocks the visible UI).
  const hasLoadedOnceRef = React.useRef(false);
  const userRef = React.useRef(user);
  const isFetchingRef = React.useRef(false);
  const lastFetchedAtRef = React.useRef(0);
  const hydratedFromCacheRef = React.useRef(false);
  const consecutiveRefreshFailuresRef = React.useRef(0);
  const lastRefreshFailureAtRef = React.useRef(0);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  /** Only update the user state when content actually changed (prevents
   *  realtime-channel churn + memo-breaking re-renders on every refresh). */
  const setUserIfChanged = React.useCallback((next: UserProfile | null) => {
    setUser((prev) => {
      if (prev && next && prev.user_id === next.user_id) {
        if (
          prev.name === next.name &&
          prev.email === next.email &&
          prev.avatar_url === next.avatar_url &&
          prev.created_at === next.created_at
        ) {
          return prev;
        }
      }
      if (!prev && !next) return prev;
      return next;
    });
  }, []);

  // Load User & App Data — only the newest call may apply state (race guard).
  // When a user is already on screen this runs as a BACKGROUND refresh:
  // existing UI stays visible, no skeleton/full-page spinner.
  //
  // Startup path: persisted session (local, ~0ms) → snapshot hydration
  // (localStorage, instant paint) → ONE parallel network batch (stale-while-
  // revalidate). The old 5-request sequential waterfall is gone.
  const loadData = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    const isStale = () => requestId !== loadRequestIdRef.current;
    const isBackground = hasLoadedOnceRef.current && Boolean(userRef.current);

    if (!isSupabaseConfigured() || !supabase) {
      setAuthStatus('unauthenticated');
      setUser(null);
      setIsLoading(false);
      clearStartupTimeout();
      startupCompleteRef.current = true;
      return;
    }

    // Auto-refresh backoff: after a failed attempt, wait 15s before retrying
    // so offline flaps never hammer the backend.
    if (isBackground && consecutiveRefreshFailuresRef.current > 0) {
      if (Date.now() - lastRefreshFailureAtRef.current < 15_000) return;
    }

    isFetchingRef.current = true;

    const t0 = import.meta.env.DEV ? performance.now() : 0;

    try {
      // 1) Session restore — local storage read, NO network round trip.
      const sessionUser = await DataService.restoreSession();
      if (isStale()) return;

      if (!sessionUser) {
        // No valid persisted session
        const prevUid = userRef.current?.user_id;
        if (prevUid) clearSnapshot(prevUid);
        setAuthStatus('unauthenticated');
        setUser(null);
        setProjects([]);
        setTasks([]);
        setSelectedProject(null);
        hasLoadedOnceRef.current = true;
        hydratedFromCacheRef.current = false;
        setIsLoading(false);
        clearStartupTimeout();
        startupCompleteRef.current = true;
        return;
      }

      const uid = sessionUser.user_id;

      // One-time schema probe: are the reminder columns live?
      void detectDeadlineSchema();

      // 2) Stale-while-revalidate hydration: paint cached data instantly.
      const paintedFromCache =
        !hydratedFromCacheRef.current &&
        (() => {
          const snap = loadSnapshot(uid);
          if (!snap) return false;
          setUserIfChanged(snap.profile ?? sessionUser);
          setProjects(snap.projects);
          setTasks(snap.tasks);
          lastFetchedAtRef.current = snap.savedAt;
          setIsLoading(false); // data is on screen — never show a loader again
          return true;
        })();
      hydratedFromCacheRef.current = true;
      hasLoadedOnceRef.current = true;

      // Loading-mode decision: warm start with usable cache refreshes silently;
      // only a true cold start shows skeletons.
      if (isBackground || paintedFromCache) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setLoadError(null);

      // 3) Fresh data in ONE parallel batch (projects ∥ tasks ∥ profile ∥ theme ∥ reminders)
      const { profile, projects: freshProjects, tasks: freshTasks, theme } =
        await DataService.fetchAllData(uid);
      if (isStale()) return;

      // 4) Fetch reminders for this user
      let userReminders: TaskReminder[] = [];
      try {
        userReminders = await DataService.getAllUserReminders(uid);
      } catch {
        // Non-fatal; reminders will load on next refresh
      }
      if (isStale()) return;
      setReminders(userReminders);

      const mergedProfile: UserProfile = { ...sessionUser, ...profile, email: sessionUser.email };
      setUserIfChanged(mergedProfile);
      setProjects(freshProjects);
      setTasks(freshTasks);
      saveSnapshot(uid, { profile: mergedProfile, projects: freshProjects, tasks: freshTasks });

      // Adopt the server-side theme preference when available
      if (theme && theme !== themeRef.current) {
        themeRef.current = theme;
        setTheme(theme);
      }

      // 5) Push subscription: if permission granted, subscribe and store in Supabase
      if (!pushSubscribedRef.current && Notification.permission === 'granted') {
        pushSubscribedRef.current = true;
        try {
          const vapidKey = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY || '';
          if (vapidKey) {
            await subscribeToPush(vapidKey, async (sub) => {
              await DataService.upsertPushSubscription({ ...sub, user_id: uid });
              setPushSubscribed(true);
            });
          }
        } catch {
          // Non-fatal; will retry on next load
        }
      }

      setAuthStatus('authenticated');
      consecutiveRefreshFailuresRef.current = 0;
      if (import.meta.env.DEV) {
        console.info(`[perf] full sync completed in ${(performance.now() - t0).toFixed(0)}ms`);
      }
    } catch (err) {
      if (isStale()) return;
      consecutiveRefreshFailuresRef.current += 1;
      lastRefreshFailureAtRef.current = Date.now();
      if (isBackground || hydratedFromCacheRef.current) {
        // Keep the current UI and data — just note the refresh failed.
        console.warn('[TU DU] Background refresh failed — keeping current data.');
        // Don't change auth status on background failure
      } else {
        // Cold start failure - distinguish network error from auth failure
        const isNetworkError = err instanceof TypeError && err.message.includes('NetworkError') ||
                              (err as any)?.message?.includes('NetworkError') ||
                              (err as any)?.code === 'NETWORK_ERROR' ||
                              !navigator.onLine;
        if (isNetworkError) {
          setLoadError('Network unavailable. Using cached data. Will retry when online.');
          // Keep auth status as unknown - don't assume logged out
        } else {
          setLoadError('Unable to load your progress. Please try again.');
          setAuthStatus('unauthenticated');
        }
      }
    } finally {
      if (!isStale()) {
        hasLoadedOnceRef.current = true;
        lastFetchedAtRef.current = Date.now();
        isFetchingRef.current = false;
        setIsLoading(false);
        setIsRefreshing(false);
        if (!startupCompleteRef.current) {
          clearStartupTimeout();
          startupCompleteRef.current = true;
        }
      }
    }
  }, [setUserIfChanged, clearStartupTimeout]);

  // Initial load + auth listener (setup listener BEFORE calling loadData to avoid race)
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setAuthStatus('unauthenticated');
      setIsLoading(false);
      clearStartupTimeout();
      startupCompleteRef.current = true;
      return;
    }

    // Set up auth listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // TOKEN_REFRESHED: session stays valid — no refetch needed.
      // INITIAL_SESSION: handled by initial loadData call.
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return;
      // SIGNED_OUT: clear auth state
      if (event === 'SIGNED_OUT') {
        setAuthStatus('unauthenticated');
        setUser(null);
        setProjects([]);
        setTasks([]);
        setSelectedProject(null);
        return;
      }
      // SIGNED_IN, USER_UPDATED: reload data
      setTimeout(() => loadData(), 0);
    });

    // Then trigger initial load
    loadData();

    return () => subscription.unsubscribe();
  }, [loadData, clearStartupTimeout]);

  // Smart background refresh on tab return / network recovery.
  // The visible UI is never replaced — data updates in place when actually stale.
  // Lightweight by design: one parallel batch, silent, no loaders, no reloads.
  useEffect(() => {
    const maybeRefresh = (minAgeMs: number) => {
      if (!userRef.current) return;            // only for signed-in users
      if (isFetchingRef.current) return;       // a load is already in flight
      if (!navigator.onLine) return;           // offline — wait for 'online'
      // Backoff after failures: don't hammer a struggling backend
      if (
        consecutiveRefreshFailuresRef.current > 0 &&
        Date.now() - lastRefreshFailureAtRef.current < 15_000
      ) {
        return;
      }
      const age = Date.now() - lastFetchedAtRef.current;
      if (age > minAgeMs) loadData();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Fresh sessions (<45s old) skip validation entirely — instant resume
        maybeRefresh(45_000);
      }
    };
    const handleOnline = () => maybeRefresh(30_000);

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [loadData]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleAuthSuccess = () => {
    addToast('success', 'Welcome back!');
    // onAuthStateChange triggers loadData automatically
  };

  // Brand logo load failure fallback (asset may not be provisioned yet)
  const [logoFailed, setLogoFailed] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await DataService.signOut();
      if (userRef.current) clearSnapshot(userRef.current.user_id);
      addToast('info', 'Signed out successfully');
    } catch (err: any) {
      console.error('Sign out failed:', err);
      addToast('error', 'Sign out failed', 'Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Recompute a project's live statistics from the given tasks array (no refetch).
  const recomputeProjectStats = useCallback(
    (projectId: string, tasksSource: ProgressTask[]) => {
      const pTasks = tasksSource.filter((t) => t.project_id === projectId);
      const total = pTasks.length;
      const completed = pTasks.filter((t) => t.is_completed).length;
      const patch: Partial<ProgressProject> = {
        total_tasks: total,
        completed_tasks: completed,
        pending_tasks: total - completed,
        completion_percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        updated_at: new Date().toISOString(),
      };
      setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, ...patch } : p)));
      setSelectedProject((prev) => (prev && prev.id === projectId ? { ...prev, ...patch } : prev));
    },
    []
  );

  const handleUpdateUser = (updated: UserProfile) => {
    setUser(updated);
    addToast('success', 'Profile updated');
  };

  // ---------------- Realtime sync (same-account multi-session) ----------------
  // Row id is the identity: every event is an idempotent upsert/remove, so
  // echoes of this device's own optimistic mutations never duplicate rows.

  // Refs keep handlers stable and read fresh state without re-subscribing.
  const projectsRef = React.useRef(projects);
  const tasksRef = React.useRef(tasks);
  useEffect(() => {
    projectsRef.current = projects;
    tasksRef.current = tasks;
  }, [projects, tasks]);

  // Persist a cache snapshot whenever data changes (debounced — one write per
  // burst of mutations). Guarantees instant paint on next cold start.
  useEffect(() => {
    const uid = user?.user_id;
    if (!uid || isLoading) return;
    const timer = window.setTimeout(() => {
      saveSnapshot(uid, { profile: user, projects, tasks });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [user, projects, tasks, isLoading]);

  const handleProjectChange = useCallback((payload: any) => {
    const { eventType, new: newRow, old } = payload;

    if (eventType === 'DELETE') {
      const id = old?.id;
      if (!id) return;
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setTasks((prev) => prev.filter((t) => t.project_id !== id));
      setSelectedProject((prev) => (prev?.id === id ? null : prev));
      return;
    }

    const row = newRow as ProgressProject;
    if (!row?.id) return;
    setProjects((prev) => {
      const idx = prev.findIndex((p) => p.id === row.id);
      if (idx === -1) {
        // New project from another session — stats start at zero
        return [
          { ...row, total_tasks: 0, completed_tasks: 0, pending_tasks: 0, completion_percentage: 0 },
          ...prev,
        ];
      }
      // Merge DB columns; keep locally computed stats intact
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...row };
      return copy;
    });
    setSelectedProject((prev) => (prev && prev.id === row.id ? { ...prev, ...row } : prev));
  }, []);

  const handleTaskChange = useCallback(
    (payload: any) => {
      const { eventType, new: newRow, old } = payload;

      if (eventType === 'DELETE') {
        const id = old?.id;
        if (!id) return;
        const target = tasksRef.current.find((t) => t.id === id);
        const next = tasksRef.current.filter((t) => t.id !== id);
        setTasks(next);
        if (target) recomputeProjectStats(target.project_id, next);
        return;
      }

      const row = newRow as ProgressTask;
      if (!row?.id) return;
      const idx = tasksRef.current.findIndex((t) => t.id === row.id);
      const next =
        idx === -1
          ? [row, ...tasksRef.current]
          : tasksRef.current.map((t) => (t.id === row.id ? { ...t, ...row } : t));
      setTasks(next);
      recomputeProjectStats(row.project_id, next);
    },
    [recomputeProjectStats]
  );

  // Subscribe while authenticated; stop on logout; never duplicate channels.
  // Keyed on the user ID STRING (not the object): background refreshes create
  // new `user` objects — keying on the object would tear down and re-subscribe
  // the realtime socket after every refresh, dropping events in the gap.
  const realtimeUid = user?.user_id;
  const remindersRef = useRef(reminders);
  useEffect(() => {
    remindersRef.current = reminders;
  }, [reminders]);
  useEffect(() => {
    if (!realtimeUid || !supabase) return;
    const uid = realtimeUid;

    let channel: import('@supabase/supabase-js').RealtimeChannel | null = null;
    let disposed = false;
    let attempt = 0;
    let retryTimer: number | undefined;

    const connect = () => {
      if (disposed) return;

      // Safety: drop any stale channel with the same topic before re-joining
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }

      // Unique topic per attempt guarantees a fresh subscription even while a
      // previous leave is still in flight (prevents duplicate listeners).
      const topic = `tudu-realtime-${uid}${attempt > 0 ? `-r${attempt}` : ''}`;
      channel = supabase
        .channel(topic)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'progress_projects', filter: `user_id=eq.${uid}` },
          handleProjectChange
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'progress_tasks', filter: `user_id=eq.${uid}` },
          handleTaskChange
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'task_reminders', filter: `user_id=eq.${uid}` },
          (payload: any) => {
            const { eventType, new: newRow, old } = payload;
            if (eventType === 'DELETE') {
              const id = old?.id;
              if (!id) return;
              setReminders((prev) => prev.filter((r) => r.id !== id));
              return;
            }
            const row = newRow as TaskReminder;
            if (!row?.id) return;
            setReminders((prev) => {
              const idx = prev.findIndex((r) => r.id === row.id);
              if (idx === -1) return [row, ...prev];
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...row };
              return copy;
            });
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            attempt = 0; // healthy — reset backoff
          } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !disposed) {
            attempt += 1;
            const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempt - 1, 5));
            console.warn(`[TU DU] Realtime ${status} — reconnecting in ${delay}ms`);
            window.clearTimeout(retryTimer);
            retryTimer = window.setTimeout(connect, delay);
          }
        });
    };

    connect();

    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [realtimeUid, handleProjectChange, handleTaskChange]);

  // ---------------- PWA update flow ----------------
  const applyingUpdateRef = React.useRef(false);
  useEffect(() => {
    const onUpdateReady = () => setUpdateReady(true);
    window.addEventListener('tudu-update-ready', onUpdateReady);
    return () => window.removeEventListener('tudu-update-ready', onUpdateReady);
  }, []);

  // ---------------- Service Worker message handler (deep-link from push) ----------------
  useEffect(() => {
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'TUDU_OPEN_TASK') {
        const { taskId, projectId } = event.data;
        if (projectId) {
          // Find project and navigate
          const proj = projects.find((p) => p.id === projectId);
          if (proj) {
            setSelectedProject(proj);
          }
        }
        // If taskId but no projectId, we could search tasks — for now just project navigation
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
  }, [projects]);

  const applyAppUpdate = () => {
    if (applyingUpdateRef.current) return;
    applyingUpdateRef.current = true;
    navigator.serviceWorker?.controller?.postMessage({ type: 'SKIP_WAITING' });
    navigator.serviceWorker?.addEventListener(
      'controllerchange',
      () => window.location.reload(),
      { once: true }
    );
  };

  // ---------------- Actions (stable identities → memoized rows never
  // re-render unnecessarily; functional updates → no stale-array races) ----

  const openProject = useCallback((proj: ProgressProject) => setSelectedProject(proj), []);
  const askDeleteTask = useCallback((id: string) => setDeletingTaskId(id), []);
  const askEditTask = useCallback((task: ProgressTask) => setEditingTask(task), []);
  const askEditProject = useCallback((project: ProgressProject) => setEditingProject(project), []);
  const askDeleteProject = useCallback((id: string) => setDeletingProjectId(id), []);

  const handleCreateProject = useCallback(
    async (projectData: {
      title: string;
      description: string;
      image_url: string;
      accent_color: string;
      is_favorite: boolean;
    }): Promise<ProgressProject> => {
      const currentUser = userRef.current;
      if (!currentUser) throw new Error('You must be signed in.');
      const created = await DataService.createProject({ user_id: currentUser.user_id, ...projectData });
      // Insert the returned row locally — no refetch needed
      setProjects((prev) => [created, ...prev]);
      // Navigate straight into the new Progress Detail workspace
      setSelectedProject(created);
      addToast('success', 'Progress created successfully', `"${created.title}" is ready.`);
      return created;
    },
    [addToast]
  );

  const handleUpdateProject = useCallback(
    async (projectId: string, updates: Partial<ProgressProject>) => {
      try {
        await DataService.updateProject(projectId, updates);
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? { ...p, ...updates } : p))
        );
        setSelectedProject((prev) => (prev && prev.id === projectId ? { ...prev, ...updates } : prev));
        addToast('success', 'Progress updated');
      } catch (err: any) {
        console.error(err);
        addToast('error', 'Update failed', err?.message);
      }
    },
    [addToast]
  );

  const handleSaveProjectEdit = async (updates: {
    title: string;
    description: string;
    image_url: string;
    accent_color: string;
    is_favorite: boolean;
  }) => {
    if (!editingProject) return;
    const oldImage = editingProject.image_url || '';

    // Optimistic: apply locally first, persist after — modal closes instantly
    setProjects((prev) =>
      prev.map((p) => (p.id === editingProject.id ? { ...p, ...updates } : p))
    );
    setSelectedProject((prev) => (prev && prev.id === editingProject.id ? { ...prev, ...updates } : prev));

    try {
      await DataService.updateProject(editingProject.id, updates);
      addToast('success', 'Progress updated');
    } catch (err: any) {
      // Rollback on failure
      setProjects((prev) =>
        prev.map((p) => (p.id === editingProject.id ? { ...p, ...editingProject } : p))
      );
      setSelectedProject((prev) => (prev && prev.id === editingProject.id ? { ...prev, ...editingProject } : prev));
      console.error(err);
      addToast('error', 'Update failed', err?.message);
      return;
    }

    // Best-effort cleanup of the replaced storage file — only after a successful save
    if (oldImage && oldImage !== updates.image_url && isSupabaseStorageUrl(oldImage)) {
      deleteStorageFileFromUrl(oldImage);
    }
  };

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      try {
        const target = projectsRef.current.find((p) => p.id === projectId);
        // Optimistic removal — UI reacts instantly, DB delete confirms behind it
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
        setTasks((prev) => prev.filter((t) => t.project_id !== projectId));
        setSelectedProject(null);
        await DataService.deleteProject(projectId);
        // Cancel reminders for deleted project
        await DataService.cancelRemindersForProject(projectId);
        addToast('success', 'Progress deleted', target ? `"${target.title}" and its tasks were removed.` : undefined);
      } catch (err: any) {
        // Rollback: restore from snapshot of refs at failure time via silent refresh
        console.error(err);
        loadData();
        addToast('error', 'Delete failed', 'Please try again.');
      }
    },
    [addToast, loadData]
  );

  const handleToggleFavorite = useCallback(
    async (projectId: string, current: boolean) => {
      const nextState = !current;
      // Optimistic update, revert on failure
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, is_favorite: nextState } : p))
      );
      setSelectedProject((prev) => (prev && prev.id === projectId ? { ...prev, is_favorite: nextState } : prev));
      try {
        await DataService.updateProject(projectId, { is_favorite: nextState });
      } catch {
        console.error('Favorite update failed');
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? { ...p, is_favorite: current } : p))
        );
        setSelectedProject((prev) => (prev && prev.id === projectId ? { ...prev, is_favorite: current } : prev));
        addToast('error', 'Could not update favorite', 'Please try again.');
      }
    },
    [addToast]
  );

  // Task Actions
  const handleCreateTask = useCallback(
    async (taskData: {
      project_id: string;
      title: string;
      description?: string;
      image_url?: string;
      is_favorite?: boolean;
      due_datetime?: string | null;
    }): Promise<ProgressTask> => {
      const currentUser = userRef.current;
      if (!currentUser) throw new Error('You must be signed in.');

      // Verify the target project belongs to the authenticated user (RLS is final layer)
      const targetProject = projectsRef.current.find((p) => p.id === taskData.project_id);
      if (!targetProject) {
        throw new Error('Selected progress was not found.');
      }

      const t0 = import.meta.env.DEV ? performance.now() : 0;

      // Optimistic placeholder appears instantly; replaced by the DB row
      const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimisticTask: ProgressTask = {
        id: optimisticId,
        project_id: taskData.project_id,
        user_id: currentUser.user_id,
        title: taskData.title,
        description: taskData.description || '',
        image_url: taskData.image_url || '',
        is_completed: false,
        completed_at: null,
        is_favorite: taskData.is_favorite ?? false,
        position: Number.MAX_SAFE_INTEGER - 1, // end of list until confirmed
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        due_datetime: taskData.due_datetime ?? null,
        notified: false,
        snooze_until: null,
      };
      const baseTasks = tasksRef.current;
      const withPlaceholder = [...baseTasks, optimisticTask];
      setTasks(withPlaceholder);
      recomputeProjectStats(taskData.project_id, withPlaceholder);

      let newTask: ProgressTask;
      try {
        newTask = await DataService.createTask({
          project_id: taskData.project_id,
          user_id: currentUser.user_id,
          title: taskData.title,
          description: taskData.description || '',
          image_url: taskData.image_url || '',
          is_completed: false,
          is_favorite: taskData.is_favorite ?? false,
          position: 0, // server assigns next position
          due_datetime: taskData.due_datetime ?? null,
        });
      } catch (err) {
        // Rollback the optimistic row + stats
        const withoutPlaceholder = tasksRef.current.filter((t) => t.id !== optimisticId);
        setTasks(withoutPlaceholder);
        recomputeProjectStats(taskData.project_id, withoutPlaceholder);
        if (import.meta.env.DEV) console.info('[perf] createTask FAILED');
        throw err;
      }

      // Swap placeholder → real row (idempotent against realtime echo by id)
      const swapped = tasksRef.current.filter((t) => t.id !== optimisticId);
      const alreadyEchoed = swapped.some((t) => t.id === newTask.id);
      const finalTasks = alreadyEchoed
        ? swapped.map((t) => (t.id === newTask.id ? { ...t, ...newTask } : t))
        : [newTask, ...swapped];
      setTasks(finalTasks);
      recomputeProjectStats(taskData.project_id, finalTasks);

      // Create reminder for the task's due_datetime if set
      if (newTask.due_datetime) {
        try {
          await DataService.createReminder(newTask.id, newTask.due_datetime);
        } catch (err) {
          console.warn('[TU DU] Failed to create reminder:', err);
        }
      }

      // Jump into that Progress Detail workspace WITHOUT clobbering freshly
      // recomputed stats (previous code spread a pre-mutation snapshot here).
      setSelectedProject((prev) =>
        prev && prev.id === targetProject.id
          ? { ...prev }
          : { ...targetProject }
      );
      addToast('success', 'Task added successfully', `"${newTask.title}" was added to ${targetProject.title}.`);
      if (import.meta.env.DEV) {
        console.info(`[perf] createTask confirmed in ${(performance.now() - t0).toFixed(0)}ms`);
      }
      return newTask;
    },
    [addToast, recomputeProjectStats]
  );

  const handleToggleTaskComplete = useCallback(
    async (taskId: string, isCompleted: boolean) => {
      const target = tasksRef.current.find((t) => t.id === taskId);
      if (!target || target.id.startsWith('optimistic-')) return;

      const t0 = import.meta.env.DEV ? performance.now() : 0;

      // Optimistic update + instant local stats recompute
      const nextTasks = tasksRef.current.map((t) =>
        t.id === taskId
          ? {
              ...t,
              is_completed: isCompleted,
              completed_at: isCompleted ? new Date().toISOString() : null,
            }
          : t
      );
      setTasks(nextTasks);
      recomputeProjectStats(target.project_id, nextTasks);

      // Inline pending indicator while Supabase confirms
      setPendingTaskIds((prev) => new Set(prev).add(taskId));
      try {
        await DataService.toggleTaskCompletion(taskId, isCompleted);
        // Cancel reminders when task is completed; recreate if uncompleted (not needed typically)
        if (isCompleted) {
          await DataService.cancelRemindersForTask(taskId);
        }
        if (import.meta.env.DEV) {
          console.info(`[perf] toggleComplete confirmed in ${(performance.now() - t0).toFixed(0)}ms`);
        }
      } catch {
        console.error('Task completion update failed');
        // Revert UI to the previous state
        const reverted = nextTasks.map((t) =>
          t.id === taskId
            ? { ...t, is_completed: !isCompleted, completed_at: target.completed_at ?? null }
            : t
        );
        setTasks(reverted);
        recomputeProjectStats(target.project_id, reverted);
        addToast('error', 'Could not update task', 'Please try again.');
      } finally {
        setPendingTaskIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    },
    [addToast, recomputeProjectStats]
  );

  const handleToggleTaskFavorite = useCallback(
    async (taskId: string, current: boolean) => {
      const next = !current;
      // Optimistic update, silent success, revert on failure
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, is_favorite: next } : t)));

      try {
        await DataService.updateTask(taskId, { is_favorite: next });
      } catch {
        console.error('Favorite update failed');
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, is_favorite: current } : t)));
        addToast('error', 'Could not update favorite', 'Please try again.');
      }
    },
    [addToast]
  );

  const confirmResetProgress = async () => {
    const currentProject = selectedProject;
    if (!currentProject || !userRef.current) return;
    setShowResetDialog(false);

    try {
      setIsResetting(true);
      await DataService.resetProjectProgress(currentProject.id, userRef.current.user_id);
      // Update all of this project's tasks locally — no refetch
      const nextTasks = tasksRef.current.map((t) =>
        t.project_id === currentProject.id
          ? { ...t, is_completed: false, completed_at: null }
          : t
      );
      setTasks(nextTasks);
      recomputeProjectStats(currentProject.id, nextTasks);
      addToast('success', 'Progress reset', 'All tasks were marked incomplete. No tasks were deleted.');
    } catch {
      console.error('Reset failed');
      loadData(); // resync from server on failure
      addToast('error', 'Reset failed', 'Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleSaveTaskEdit = async (updates: {
    title: string;
    description: string;
    image_url: string;
    is_favorite: boolean;
    project_id: string;
    due_datetime?: string | null;
    snooze_until?: string | null;
    notified?: boolean;
  }) => {
    if (!editingTask) return;
    const oldImage = editingTask.image_url || '';
    const oldProjectId = editingTask.project_id;
    const oldDueDatetime = editingTask.due_datetime ?? null;
    const newDueDatetime = updates.due_datetime ?? null;

    // Optimistic apply + stats for BOTH projects when moved
    const applyEdit = (source: ProgressTask[]) =>
      source.map((t) => (t.id === editingTask.id ? { ...t, ...updates } : t));
    const optimisticTasks = applyEdit(tasksRef.current);
    setTasks(optimisticTasks);
    recomputeProjectStats(updates.project_id, optimisticTasks);
    if (oldProjectId !== updates.project_id) {
      recomputeProjectStats(oldProjectId, optimisticTasks);
    }

    try {
      await DataService.updateTask(editingTask.id, updates);
      addToast('success', 'Task updated');
    } catch (err: any) {
      // Rollback
      setTasks(tasksRef.current.map((t) => (t.id === editingTask.id ? { ...t, ...editingTask } : t)));
      recomputeProjectStats(updates.project_id, tasksRef.current);
      if (oldProjectId !== updates.project_id) recomputeProjectStats(oldProjectId, tasksRef.current);
      console.error(err);
      addToast('error', 'Update failed', err?.message);
      return;
    }

    // Handle reminder changes: if due_datetime changed, cancel old and create new
    if (oldDueDatetime !== newDueDatetime) {
      try {
        await DataService.cancelRemindersForTask(editingTask.id);
        if (newDueDatetime) {
          await DataService.createReminder(editingTask.id, newDueDatetime);
        }
      } catch (err) {
        console.warn('[TU DU] Failed to update reminders:', err);
      }
    }

    if (oldImage && oldImage !== updates.image_url && isSupabaseStorageUrl(oldImage)) {
      deleteStorageFileFromUrl(oldImage);
    }
  };

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      const target = tasksRef.current.find((t) => t.id === taskId);
      if (!target) return;
      // Optimistic removal + instant stats recompute
      const originalTasks = tasksRef.current;
      const nextTasks = originalTasks.filter((t) => t.id !== taskId);
      setTasks(nextTasks);
      recomputeProjectStats(target.project_id, nextTasks);
      try {
        await DataService.deleteTask(taskId);
        // Cancel reminders for deleted task
        await DataService.cancelRemindersForTask(taskId);
        addToast('success', 'Task deleted');
      } catch {
        console.error('Task delete failed');
        setTasks(originalTasks); // exact rollback
        recomputeProjectStats(target.project_id, originalTasks);
        addToast('error', 'Delete failed', 'Please try again.');
      }
    },
    [addToast, recomputeProjectStats]
  );

  // ---------------- Reminder & Notification Engine (Phase 10) ----------------

  /** Persist notified=true: optimistic locally + Supabase write behind it. */
  const handleMarkNotified = useCallback((taskId: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, notified: true } : t)));
    DataService.setTaskNotified(taskId, true).catch((err) =>
      console.warn('[TU DU] Failed to persist notified flag:', err)
    );
  }, []);

  /** Queue an overdue task for the interactive in-app alert (deduped). */
  const pushOverdueAlert = useCallback((task: ProgressTask) => {
    setOverdueQueue((prev) => (prev.includes(task.id) ? prev : [...prev, task.id]));
  }, []);

  // Self-pruning queue: if an alarmed task becomes completed or disappears
  // (done from another device/tab via realtime, or its checkbox while the
  // modal rings), drop it immediately so the siren NEVER rings for a resolved
  // task. Emptying the queue also silences the continuous alarm loop.
  useEffect(() => {
    setOverdueQueue((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.filter((id) => {
        const t = tasksRef.current.find((x) => x.id === id);
        return Boolean(t && !t.is_completed);
      });
      return next.length === prev.length ? prev : next;
    });
  }, [tasks]);

  // Precision deadline engine — server-synced clock, drift-compensated loop,
  // targeted wakes; fires alarms/OS notifications on the exact second.
  usePrecisionTimer({
    tasks,
    enabled: Boolean(user) && isSupabaseConfigured(),
    onAlarm: pushOverdueAlert,
    markTriggered: handleMarkNotified,
  });

  const activeOverdueId = overdueQueue[0] ?? null;
  // Continuous ring: keyed on queue occupancy so resolving alarm #1 flows
  // straight into #2 without the siren stuttering off→on.
  useContinuousAlarm(overdueQueue.length > 0 ? activeOverdueId ?? 'active' : null);
  const activeOverdueTask = activeOverdueId
    ? tasks.find((t) => t.id === activeOverdueId) ?? null
    : null;
  const activeOverdueProject = activeOverdueTask
    ? projectsRef.current.find((p) => p.id === activeOverdueTask.project_id) ?? null
    : null;

  const resolveActiveOverdue = useCallback(() => {
    setOverdueQueue((prev) => prev.slice(1));
  }, []);

  const handleCompleteActiveOverdue = useCallback(() => {
    if (!activeOverdueId) return;
    void handleToggleTaskComplete(activeOverdueId, true);
    resolveActiveOverdue();
    addToast('success', 'Task completed', 'Nice — that one is off your plate.');
  }, [activeOverdueId, handleToggleTaskComplete, resolveActiveOverdue, addToast]);

  const handleSnoozeActiveOverdue = useCallback(() => {
    if (!activeOverdueId) return;
    const snoozeUntil = new Date(Date.now() + 5 * 60_000).toISOString();
    // Optimistic: re-arm the alarm exactly 5 minutes out
    setTasks((prev) =>
      prev.map((t) =>
        t.id === activeOverdueId ? { ...t, snooze_until: snoozeUntil, notified: false } : t
      )
    );
    DataService.snoozeTask(activeOverdueId, 5).catch((err) =>
      console.warn('[TU DU] Snooze persistence failed:', err)
    );
    resolveActiveOverdue();
    addToast('info', 'Snoozed for 5 minutes', 'The alarm will ring again.');
  }, [activeOverdueId, resolveActiveOverdue, addToast]);

  // ---------- Render ----------

  // Loading screen while session restores
  if (isLoading && authStatus === 'unknown') {
    return <LoadingState fullScreen label="Loading TU DU..." description="Restoring your session" />;
  }

  // Startup timeout / error recovery
  if (authStatus === 'unknown' && loadError) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="flex justify-end px-6 pt-6">
          <Header
            theme={theme}
            onToggleTheme={toggleTheme}
            user={null}
            onOpenAuth={() => setIsAuthOpen(true)}
            onOpenProfile={() => setIsAuthOpen(true)}
          />
        </div>

        <main className="flex-1 flex items-center justify-center px-4 pb-24">
          <div className="w-full max-w-sm text-center space-y-6 glass-panel border border-amber-500/40 dark:border-amber-500/40 rounded-3xl shadow-2xl p-8">
            <AlertCircle className="mx-auto w-14 h-14 text-amber-500" />
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Startup Timeout
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 leading-relaxed">
                {loadError}
              </p>
            </div>
            <Button fullWidth size="lg" onClick={() => {
              setLoadError(null);
              setStartupRetries((r) => r + 1);
              loadData();
            }}>
              Retry
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Protected route gate — real Supabase auth required for app content
  if (authStatus === 'unauthenticated' || !user) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="flex justify-end px-6 pt-6">
          <Header
            theme={theme}
            onToggleTheme={toggleTheme}
            user={null}
            onOpenAuth={() => setIsAuthOpen(true)}
            onOpenProfile={() => setIsAuthOpen(true)}
          />
        </div>

        <main className="flex-1 flex items-center justify-center px-4 pb-24">
          <div className="w-full max-w-sm text-center space-y-6 glass-panel border border-white/40 dark:border-zinc-800/80 rounded-3xl shadow-2xl p-8">
            {logoFailed ? (
              <div className="mx-auto w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30 orange-glow">
                <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
              </div>
            ) : (
              <img
                src="/brand/tudu-logo.png"
                alt="TU DU logo"
                className="mx-auto w-16 h-16 rounded-2xl shadow-lg shadow-orange-500/30 orange-glow"
                onError={() => setLogoFailed(true)}
              />
            )}
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                TU DU <span className="text-orange-500">★</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 leading-relaxed">
                Create Progress → Add Tasks → Complete Tasks → Track Completion.
                Sign in to sync your progress securely.
              </p>
            </div>
            <Button fullWidth size="lg" onClick={() => setIsAuthOpen(true)}>
              Sign In
            </Button>
          </div>
        </main>

        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onAuthSuccess={handleAuthSuccess}
        />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </div>
    );
  }

  const userId = user.user_id;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-200">
      {/* Top Header */}
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenProfile={() => {
          setSelectedProject(null);
          setActiveTab('profile');
        }}
        onSearch={() => {
          setSelectedProject(null);
          setActiveTab('dashboard');
          setSearchSignal((s) => s + 1);
        }}
        contextTitle={selectedProject ? selectedProject.title : undefined}
        onBrandClick={() => {
          setSelectedProject(null);
          setActiveTab('dashboard');
        }}
      />

      {/* Main View Container */}
      {/* Subtle non-blocking background-refresh indicator */}
      {isRefreshing && (
        <div
          role="status"
          className="fixed top-20 right-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel shadow-md text-[11px] font-semibold text-slate-500 dark:text-zinc-300"
        >
          <span className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
          Updating…
        </div>
      )}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6">
        {/* One-tap reminder permission banner (self-dismissing) */}
        {!selectedProject && <NotificationPermissionBanner />}
        {selectedProject && !projects.some((p) => p.id === selectedProject.id) ? (
          /* Deleted/missing project fallback */
          <div className="max-w-3xl mx-auto">
            <EmptyState
              title="Progress not found"
              description="This progress no longer exists or was deleted."
              actionLabel="Back to Progress"
              onAction={() => setSelectedProject(null)}
              type="search"
            />
          </div>
        ) : selectedProject ? (
          <ProjectDetailView
            project={selectedProject}
            tasks={tasks}
            isResetting={isResetting}
            pendingTaskIds={pendingTaskIds}
            onBack={() => setSelectedProject(null)}
            onToggleTaskComplete={handleToggleTaskComplete}
            onToggleTaskFavorite={handleToggleTaskFavorite}
            onAddTask={handleCreateTask}
            onDeleteTask={askDeleteTask}
            onEditTask={askEditTask}
            onToggleFavorite={handleToggleFavorite}
            onEditProject={askEditProject}
            onDeleteProject={askDeleteProject}
            onRequestReset={() => setShowResetDialog(true)}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                projects={projects}
                tasks={tasks}
                isLoading={isLoading}
                error={loadError}
                onRetry={loadData}
                searchSignal={searchSignal}
                onOpenProject={openProject}
                onToggleFavorite={handleToggleFavorite}
                onNavigateCreate={() => setActiveTab('create')}
              />
            )}

            {activeTab === 'create' && (
              <CreateView
                projects={projects}
                userId={userId}
                onCreateProject={handleCreateProject}
                onCreateTask={handleCreateTask}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileView
                user={user}
                theme={theme}
                isLoggingOut={isLoggingOut}
                onThemeChange={(t) => setTheme(t)}
                onToggleTheme={toggleTheme}
                onUpdateUser={handleUpdateUser}
                onLogout={handleLogout}
              />
            )}
          </>
        )}
      </main>

      {/* PWA update prompt — user-initiated, never an automatic reload */}
      {updateReady && (
        <div className="fixed bottom-24 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-full glass-panel shadow-2xl border border-white/40 dark:border-zinc-800/80">
            <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">
              New version available
            </span>
            <Button size="sm" onClick={applyAppUpdate}>
              Refresh
            </Button>
          </div>
        </div>
      )}

      {/* Glassmorphism Bottom Floating Navigation Bar */}
      <BottomNavigation
        activeTab={selectedProject ? 'dashboard' : activeTab}
        onSelectTab={(tab) => {
          setSelectedProject(null);
          setActiveTab(tab);
        }}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Edit Progress Modal */}
      {editingProject && (
        <EditProjectModal
          project={editingProject}
          userId={userId}
          onClose={() => setEditingProject(null)}
          onSave={handleSaveProjectEdit}
        />
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          projects={projects}
          userId={userId}
          onClose={() => setEditingTask(null)}
          onSave={handleSaveTaskEdit}
          reminders={reminders.filter((r) => r.task_id === editingTask.id)}
          onAddReminder={async (taskId, remindAt) => {
            await DataService.createReminder(taskId, remindAt);
          }}
          onDeleteReminder={async (reminderId) => {
            await DataService.deleteReminder(reminderId);
          }}
        />
      )}

      {/* Delete Progress Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingProjectId)}
        onClose={() => setDeletingProjectId(null)}
        onConfirm={() => {
          if (deletingProjectId) handleDeleteProject(deletingProjectId);
        }}
        title="Delete this Progress?"
        message="This will permanently delete the Progress and its checklist tasks. This action cannot be undone."
        confirmLabel="Delete Progress"
        isDangerous={true}
      />

      {/* Delete Task Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingTaskId)}
        onClose={() => setDeletingTaskId(null)}
        onConfirm={() => {
          if (deletingTaskId) handleDeleteTask(deletingTaskId);
        }}
        title="Delete this task?"
        message="This checklist item will be permanently deleted."
        confirmLabel="Delete"
        isDangerous={true}
      />

      {/* Reset Progress Confirmation */}
      <ConfirmDialog
        isOpen={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={confirmResetProgress}
        title="Reset Progress?"
        message="Reset all tasks in this progress? Tasks will become incomplete but will NOT be deleted. Completion stats will restart from zero."
        confirmLabel="Reset Progress"
        isDangerous={false}
      />

      {/* Active alarm — continuous ring until user intervenes:
          🛑 Stop Alarm / ✅ Mark Complete / ⏰ Snooze 5 Min */}
      <ActiveAlarmModal
        task={activeOverdueTask}
        project={activeOverdueProject}
        onStopAlarm={resolveActiveOverdue}
        onMarkComplete={handleCompleteActiveOverdue}
        onSnooze={handleSnoozeActiveOverdue}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
