import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User } from '@/types/crm';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isSales: boolean;
  isEngineer: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Profile Cache (localStorage) ────────────────────────────────────────────
// Stores the user profile locally so page refreshes are instant.
// The DB is still refreshed in the background to pick up any role changes.

const CACHE_KEY = 'qtcrm_profile';
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

function readCache(userId: string): User | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { profile, ts } = JSON.parse(raw) as { profile: User; ts: number };
    // Reject if stale or belongs to a different user
    if (!profile || profile.id !== userId || Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return profile;
  } catch {
    return null;
  }
}

function writeCache(profile: User | null) {
  try {
    if (profile) {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ profile, ts: Date.now() }));
    } else {
      localStorage.removeItem(CACHE_KEY);
    }
  } catch {
    // localStorage may be unavailable (private browsing) — silent fail
  }
}

// ─── DB fetch with timeout ────────────────────────────────────────────────────
// Supabase free tier can cold-start slowly. Without a timeout, a hanging
// DB call blocks the login flow forever showing "Authenticating...".

async function fetchFromDB(userId: string, timeoutMs = 6000): Promise<User | null> {
  try {
    const timeout = new Promise<{ timedOut: true }>(resolve =>
      setTimeout(() => resolve({ timedOut: true }), timeoutMs)
    );

    const result = await Promise.race([
      supabase.from('users').select('*').eq('id', userId).maybeSingle(),
      timeout,
    ]);

    // Timed out
    if ('timedOut' in result) {
      console.warn('[Auth] DB fetch timed out after', timeoutMs, 'ms');
      return null;
    }

    const { data, error } = result;
    if (error) {
      console.error('[Auth] DB fetch error:', error.message);
      return null;
    }
    return (data as User) ?? null;
  } catch (err) {
    console.error('[Auth] DB fetch threw:', err);
    return null;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        if (!session?.user) {
          // Signed out
          writeCache(null);
          setUser(null);
          setLoading(false);
          return;
        }

        const uid = session.user.id;

        // ── Step 1: Serve from cache immediately (0ms loading) ──────────────
        const cached = readCache(uid);
        if (cached) {
          setUser(cached);
          setLoading(false);   // ← instant — user sees dashboard right away

          // ── Step 2: Background DB refresh (silent, non-blocking) ──────────
          fetchFromDB(uid).then(fresh => {
            if (!mounted) return;
            if (fresh) {
              // Only update state if something actually changed
              setUser(prev => {
                if (JSON.stringify(prev) === JSON.stringify(fresh)) return prev;
                writeCache(fresh);
                return fresh;
              });
            }
          });
          return;
        }

        // ── No cache (first login or cleared storage) — must wait for DB ────
        // Show loading while we fetch for the first time
        const profile = await fetchFromDB(uid);
        if (!mounted) return;

        if (profile) {
          writeCache(profile);
          setUser(profile);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    // Safety net: never hang forever. fetchFromDB times out at 6s so this
    // only fires if something truly unexpected hangs the auth state change.
    const safety = setTimeout(() => {
      if (mounted) {
        console.warn('[Auth] Safety timeout fired');
        setLoading(false);
      }
    }, 8000);

    return () => {
      mounted = false;
      clearTimeout(safety);
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        console.error('[Auth] Login error:', error.message);
        return false;
      }

      if (!data.session?.user) return false;

      const uid = data.session.user.id;

      // Try cache first — instant
      const cached = readCache(uid);
      if (cached) {
        setUser(cached);
        // Refresh in background, don't block
        fetchFromDB(uid).then(fresh => {
          if (fresh) { writeCache(fresh); setUser(fresh); }
        });
        return true;
      }

      // No cache — fetch from DB with timeout
      // onAuthStateChange will also fire and handle this, but we do it
      // here too so login() can return true quickly and navigate the user
      const profile = await fetchFromDB(uid);
      if (profile) {
        writeCache(profile);
        setUser(profile);
        return true;
      }

      // DB timed out or returned nothing — auth DID succeed so still allow in.
      // onAuthStateChange will retry the profile fetch shortly after.
      console.warn('[Auth] Profile not found in DB after login — auth succeeded, proceeding anyway');
      return true;
    } catch (err) {
      console.error('[Auth] Login exception:', err);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      writeCache(null);
      setUser(null);
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[Auth] Logout error:', err);
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAdmin:    user?.role === 'admin',
      isSales:    user?.role === 'sales',
      isEngineer: user?.role === 'engineer',
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
