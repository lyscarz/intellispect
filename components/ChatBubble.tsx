/** Shared chat bubble — used inside the phone-frame runner AND on the
 *  inspection-history detail page when rendering an intent run transcript. */
export function ChatBubble({
  role,
  content,
}: {
  role: 'user' | 'assistant';
  content: string;
}) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
          isUser
            ? 'bg-brand-600 text-white'
            : 'bg-white border border-slate-200 text-slate-800'
        }`}
      >
        {content || ' '}
      </div>
    </div>
  );
}
