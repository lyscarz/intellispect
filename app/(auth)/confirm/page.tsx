import Link from 'next/link';

export default function ConfirmPage({ searchParams }: { searchParams: { email?: string } }) {
  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-200 p-6 shadow-sm text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center">
        <svg className="w-6 h-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h1 className="mt-4 text-xl font-semibold text-slate-900">Check your email</h1>
      <p className="mt-2 text-sm text-slate-500">
        We sent a confirmation link to{' '}
        <span className="font-medium text-slate-700">{searchParams.email ?? 'your inbox'}</span>.
        Click it to activate your account and continue.
      </p>
      <p className="mt-6 text-xs text-slate-400">
        Didn&apos;t get it? Check spam, or{' '}
        <Link href="/signup" className="text-brand-600 hover:text-brand-700">
          try a different email
        </Link>
        .
      </p>
    </div>
  );
}
