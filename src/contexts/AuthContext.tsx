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

  // Listen for auth state changes — fires immediately with current session on mount
  useEffect(() => {
    let mounted = true;

    // Hard fallback: if onAuthStateChange never resolves, clear loading after 6s
    const fallbackTimer = setTimeout(() => {
      if (mounted) {
        console.warn('Auth fallback timer fired – clearing loading state');
        setLoading(false);
      }
    }, 6000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        try {
          if (session?.user) {
            // Fetch user profile from users table with a 5s timeout race
            const profilePromise = supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
            );

            const { data: userProfile, error } = await Promise.race([
              profilePromise,
              timeoutPromise,
            ]) as Awaited<typeof profilePromise>;

            if (!mounted) return;

            if (error) {
              console.error('Profile fetch error:', error);
              setUser(null);
            } else {
              setUser((userProfile as User) ?? null);
            }
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
  }, []);

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
