import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getToken } from '@/lib/api/client';
import * as api from '@/lib/api/endpoints';
import type { ApiUser } from '@/lib/api/types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: ApiUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(() => (getToken() ? 'loading' : 'anonymous'));
  const [user, setUser] = useState<ApiUser | null>(null);

  // Revalidate a stored token on load: it may have expired while the tab was
  // closed, and a stale token must not leave the app in a half-signed-in state.
  useEffect(() => {
    if (!getToken()) {
      setStatus('anonymous');
      return;
    }
    let cancelled = false;
    api
      .me()
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        api.logout();
        setUser(null);
        setStatus('anonymous');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { user: next } = await api.login({ email, password });
    setUser(next);
    setStatus('authenticated');
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { user: next } = await api.register({ name, email, password });
    setUser(next);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(() => {
    api.logout();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signIn, signUp, signOut }),
    [status, user, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
