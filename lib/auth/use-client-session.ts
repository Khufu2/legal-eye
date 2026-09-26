"use client";
import { useCallback, useEffect, useRef, useState } from 'react';

export type ClientSession = { access_token: string; refresh_token?: string; expires_at?: number; user: { id: string; email?: string } };
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/** Separate sessions for Office and client portals; never substitute a shared demo identity. */
export function useClientSession(storageKey: string) {
  const [session, setSession] = useState<ClientSession | null>(null);
  const [sessionError, setSessionError] = useState('');
  const generation = useRef(0);
  const commit = useCallback((next: ClientSession | null) => {
    generation.current++;
    try { if (next) sessionStorage.setItem(storageKey, JSON.stringify(next)); else sessionStorage.removeItem(storageKey); } catch { /* In-memory session still works when embedded storage is unavailable. */ }
    setSession(next);
  }, [storageKey]);
  useEffect(() => {
    // Discard legacy, non-refreshable localStorage bearer tokens.
    try { localStorage.removeItem(storageKey); const saved = sessionStorage.getItem(storageKey); setSession(saved ? JSON.parse(saved) : null); } catch { setSession(null); }
    return () => { generation.current++; };
  }, [storageKey]);
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const revision = generation.current;
    const refresh = async () => {
      if (!session.refresh_token) { commit(null); setSessionError('Please sign in again to renew your session.'); return; }
      try {
        const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: key, 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refresh_token }) });
        const data = await response.json();
        if (cancelled || generation.current !== revision) return;
        if (!response.ok) { commit(null); setSessionError('Your session expired. Please sign in again.'); return; }
        commit({ access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at || Math.floor(Date.now() / 1000) + data.expires_in, user: data.user });
      } catch {
        if (!cancelled && generation.current === revision) { commit(null); setSessionError('Session renewal failed. Please reconnect and sign in.'); }
      }
    };
    const timer = window.setTimeout(() => void refresh(), Math.max(0, ((session.expires_at || 0) * 1000) - Date.now() - 60000));
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [session, commit]);
  const acceptSession = useCallback((data: any) => {
    const value = data.session || data;
    if (!value.access_token || !value.refresh_token || !value.user?.id || value.user.is_anonymous || !(value.user.email_confirmed_at || value.user.confirmed_at)) throw new Error('Confirm your email before signing in.');
    setSessionError('');
    commit({ access_token: value.access_token, refresh_token: value.refresh_token, expires_at: value.expires_at || Math.floor(Date.now() / 1000) + value.expires_in, user: value.user });
  }, [commit]);
  const signOut = useCallback(async () => {
    const token = session?.access_token;
    commit(null);
    if (token) {
      try { const response = await fetch(`${url}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}` } }); if (!response.ok && response.status !== 401) throw new Error(); }
      catch { setSessionError('Signed out here. Server revocation could not be confirmed; use account recovery to revoke other sessions if needed.'); }
    }
  }, [session, commit]);
  return { session, acceptSession, signOut, sessionError };
}
