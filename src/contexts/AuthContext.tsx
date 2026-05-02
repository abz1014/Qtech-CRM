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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile with automatic retry (handles Supabase cold starts on free tier)
  const fetchUserProfile = useCallback(async (userId: string, attempt = 1): Promise<User | null> => {
    const TIMEOUT_MS = 15000; // 15s — free tier cold starts can take up to 15s
    const MAX_ATTEMPTS = 2;

    try {
      const profilePromise = supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Profile fetch timeout (attempt ${attempt})`)), TIMEOUT_MS)
      );

      const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as Awaited<typeof profilePromise>;

      if (error) {
        console.error('Profile fetch error:', error);
        return null;
      }
      return (data as User) ?? null;
    } catch (err) {
      console.warn('Auth error:', err);
      // Retry once on timeout — Supabase may need a warm-up request
      if (attempt < MAX_ATTEMPTS) {
        console.info(`Retrying profile fetch (attempt ${attempt + 1})...`);
        return fetchUserProfile(userId, attempt + 1);
      }
      return null;
    }
  }, []);

  // Listen for auth state changes — fires immediately with current session on mount
  useEffect(() => {
    let mounted = true;

    // Hard fallback: clear loading after 35s maximum (2 attempts × 15s + buffer)
    const fallbackTimer = setTimeout(() => {
      if (mounted) {
        console.warn('Auth fallback timer fired – clearing loading state');
        setLoading(false);
      }
    }, 35000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        try {
          if (session?.user) {
            const profile = await fetchUserProfile(session.user.id);
            if (!mounted) return;
            setUser(profile);
          } else {
            if (mounted) setUser(null);
          }
        } catch (err) {
          console.error('Auth error:', err);
          if (mounted) setUser(null);
        } finally {
          clearTimeout(fallbackTimer);
          if (mounted) setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
      subscription?.unsubscribe();
    };
  }, [fetchUserProfile]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      // Use Supabase Auth's signInWithPassword - sends password via POST body, handles hashing
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error.message);
        return false;
      }

      if (data.session?.user) {
        // Fetch user profile from users table
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.session.user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Profile fetch error:', profileError);
          return false;
        }

        if (userProfile) {
          setUser(userProfile as User);
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Login exception:', err);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  }, []);

  const value: AuthContextType = {
    user,
    login,
    logout,
    isAdmin: user?.role === 'admin',
    isSales: user?.role === 'sales',
    isEngineer: user?.role === 'engineer',
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
