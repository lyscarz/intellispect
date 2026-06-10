'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function LoginPage() {
  // useSearchParams() forces the page out of static rendering; Next.js requires
  // that consumers be wrapped in a Suspense boundary so the rest of the tree
  // can still prerender. The form lives inside <LoginForm/>.
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // ?next=/some/path lets callers (e.g. /accept-invite) bounce back here for
  // sign-in and return automatically. We only honour same-origin paths.
  const nextParam = searchParams.get('next');
  const nextPath = nextParam && nextParam.startsWith('/') ? nextParam : '/fleet';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-200 p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Log in</h1>
      <p className="mt-1 text-sm text-slate-500">Welcome back.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Password</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Log in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        No account?{' '}
        <Link href="/signup" className="text-brand-600 font-medium hover:text-brand-700">
          Sign up
        </Link>
      </p>
    </div>
  );
}

/** Skeleton shown while the search-params hook hydrates. Same visual shape as
 *  the real form so layout doesn't jump. */
function LoginFormFallback() {
  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-200 p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Log in</h1>
      <p className="mt-1 text-sm text-slate-500">Welcome back.</p>
      <div className="mt-6 space-y-4">
        <div className="h-8 rounded bg-slate-100 animate-pulse" />
        <div className="h-8 rounded bg-slate-100 animate-pulse" />
        <div className="h-9 rounded bg-slate-100 animate-pulse" />
      </div>
    </div>
  );
}
