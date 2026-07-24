import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Store the auth session in sessionStorage (not the default localStorage) so a
// login lasts only for the browser session: reloads and in-tab navigation stay
// signed in, but fully closing the browser clears it and the next open requires
// email + password again.
//
// Because each tab holds its OWN session, supabase-js's default cross-tab
// Navigator Lock ("lock:sb-<ref>-auth-token", shared browser-wide) is useless
// here — worse, two open CRM tabs starve each other's token work and sign-in
// hangs on "Authenticating…" ("lock was released because another request stole
// it"). That lock exists to coordinate ONE localStorage session shared by many
// tabs, which we deliberately don't do — so run auth calls without it.
const perTabLock = async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: perTabLock,
  },
});
