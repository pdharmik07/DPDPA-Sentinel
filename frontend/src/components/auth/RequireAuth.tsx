import { useMemo, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';

/**
 * Route guard. While a stored token is being revalidated it renders a spinner
 * rather than redirecting, so a refresh on a protected page does not bounce a
 * signed-in user to the login screen.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  /**
   * The redirect state MUST have a stable identity.
   *
   * `<Navigate>` navigates from an effect keyed on its props. Passing an inline
   * `state={{ from: ... }}` gives that effect a fresh object on every render, so
   * it refires endlessly — "Maximum update depth exceeded", and the whole app
   * renders blank. Memoising on the pathname is what breaks the loop.
   */
  const redirectState = useMemo(() => ({ from: location.pathname }), [location.pathname]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-neon" />
        <span className="ml-3 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-dim">
          Restoring session
        </span>
      </div>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={redirectState} />;
  }

  return <>{children}</>;
}
