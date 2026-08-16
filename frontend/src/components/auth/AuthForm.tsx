import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button, Card } from '@/components/ui/primitives';
import { Logo } from '@/components/layout/Logo';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/store/AuthContext';
import { cn } from '@/lib/utils';

interface Props {
  mode: 'login' | 'register';
}

const FIELD =
  'w-full rounded-lg border border-hairline bg-void/60 px-3 py-2.5 text-sm text-ink outline-none transition ' +
  'placeholder:text-ink-faint focus:border-neon/60 focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-neon)_14%,transparent)]';

const LABEL = 'mb-1.5 block font-mono text-[0.62rem] uppercase tracking-[0.16em] text-ink-dim';

export function AuthForm({ mode }: Props) {
  const isRegister = mode === 'register';
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  /** Where the user was headed before the guard bounced them here. */
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isRegister) await signUp(name, email, password);
      else await signIn(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError(0, 'internal_error', 'Something went wrong. Try again.'),
      );
    } finally {
      setBusy(false);
    }
  }

  const fieldErrors = new Map((error?.details ?? []).map((d) => [d.field, d.message]));

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className="mb-7 flex flex-col items-center text-center">
          <Logo />
          <h1 className="mt-5 font-mono text-lg font-semibold uppercase tracking-[0.2em] text-ink">
            {isRegister ? 'Create Account' : 'Secure Sign-In'}
          </h1>
          <p className="mt-2 max-w-sm text-sm text-ink-dim">
            {isRegister
              ? 'Register to upload policies and keep a private history of your assessments.'
              : 'Sign in to run assessments and access your scan history.'}
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={onSubmit} noValidate>
            {isRegister && (
              <div className="mb-4">
                <label className={LABEL} htmlFor="name">
                  Full name
                </label>
                <input
                  id="name"
                  className={cn(FIELD, fieldErrors.has('name') && 'border-alert/70')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                  minLength={2}
                  placeholder="Ada Lovelace"
                />
                {fieldErrors.get('name') && (
                  <p className="mt-1 text-[0.7rem] text-alert">{fieldErrors.get('name')}</p>
                )}
              </div>
            )}

            <div className="mb-4">
              <label className={LABEL} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className={cn(FIELD, fieldErrors.has('email') && 'border-alert/70')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
              {fieldErrors.get('email') && (
                <p className="mt-1 text-[0.7rem] text-alert">{fieldErrors.get('email')}</p>
              )}
            </div>

            <div className="mb-5">
              <label className={LABEL} htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className={cn(FIELD, fieldErrors.has('password') && 'border-alert/70')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                minLength={isRegister ? 10 : 1}
                placeholder={isRegister ? 'At least 10 characters' : '••••••••'}
              />
              {fieldErrors.get('password') && (
                <p className="mt-1 text-[0.7rem] text-alert">{fieldErrors.get('password')}</p>
              )}
              {isRegister && !fieldErrors.has('password') && (
                <p className="mt-1.5 text-[0.7rem] text-ink-faint">
                  Minimum 10 characters. Stored using Argon2id — never in plain text.
                </p>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 flex gap-2.5 rounded-lg border border-alert/40 bg-alert/8 px-3 py-2.5"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-alert" />
                <div className="min-w-0">
                  <p className="text-sm text-ink">{error.message}</p>
                  {error.hint && <p className="mt-0.5 text-[0.72rem] text-ink-dim">{error.hint}</p>}
                </div>
              </div>
            )}

            <Button type="submit" variant="solid" size="lg" className="w-full" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isRegister ? 'Creating…' : 'Signing in…'}
                </>
              ) : (
                <>
                  {isRegister ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                  {isRegister ? 'Create account' : 'Sign in'}
                </>
              )}
            </Button>
          </form>

          <p className="mt-5 text-center text-[0.75rem] text-ink-dim">
            {isRegister ? 'Already registered?' : 'No account yet?'}{' '}
            <Link
              to={isRegister ? '/login' : '/register'}
              state={{ from: redirectTo }}
              className="text-neon underline-offset-4 hover:underline"
            >
              {isRegister ? 'Sign in' : 'Create one'}
            </Link>
          </p>
        </Card>

        <p className="mt-5 flex items-start gap-2 text-[0.7rem] leading-relaxed text-ink-faint">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Uploaded documents are private to your account. This tool produces an automated
          preliminary assessment and is not a legal opinion.
        </p>
      </motion.div>
    </div>
  );
}
