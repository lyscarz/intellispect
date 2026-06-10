export const dynamic = 'force-dynamic';

export default function MobileAssistantTab() {
  return (
    <div className="px-4 py-4 max-w-screen-sm mx-auto">
      <header className="mb-4">
        <h1 className="text-xl font-bold">Assistant</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Your AI assistant for the field.
        </p>
      </header>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 px-4 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h3 className="font-semibold text-slate-900">Chat coming soon</h3>
        <p className="mt-1 text-sm text-slate-500 max-w-xs mx-auto">
          Soon you&apos;ll be able to ask questions about your fleet, get inspection
          recommendations, and report issues — all from here.
        </p>
      </div>
    </div>
  );
}
