import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getSessionContext } from '@/lib/getSessionContext';
import { getResponse } from '@/lib/inspections/responses';
import { getTemplate } from '@/lib/inspections/repo';
import { getMachine } from '@/lib/machines';
import { getSite } from '@/lib/sites';
import type {
  FormSchema,
  Question,
  ResponsePhoto,
  SubmittedAnswer,
  SubmittedComment,
} from '@/lib/inspections/types';

export const dynamic = 'force-dynamic';

export default async function ResponseDetailPage({
  params,
}: {
  params: { id: string; responseId: string };
}) {
  const ctx = await getSessionContext();
  const [template, response] = await Promise.all([
    getTemplate(ctx.accountId, params.id),
    getResponse(ctx.accountId, params.responseId),
  ]);
  if (!template || !response) notFound();
  if (response.templateId !== template.id) notFound();

  const [machine, site] = await Promise.all([
    response.machineId ? getMachine(response.machineId, ctx.accountId) : Promise.resolve(null),
    response.siteId ? getSite(response.siteId, ctx.accountId) : Promise.resolve(null),
  ]);

  const schema: FormSchema = response.templateSnapshot ?? { sections: [] };
  const photosByKey = groupPhotos(response.photos ?? []);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 text-sm mb-3">
        <Link
          href={`/inspections/${template.id}/responses`}
          className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {template.name} · responses
        </Link>
      </div>

      <header className="rounded-xl border border-slate-200 bg-white p-4 mb-4">
        <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
          Response
        </div>
        <h1 className="text-xl font-bold text-slate-900">{template.name}</h1>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Meta label="Submitted" value={new Date(response.submittedAt).toLocaleString()} />
          <Meta label="Machine" value={machine?.name ?? '—'} />
          <Meta label="Site" value={site?.name ?? '—'} />
          <Meta label="Status" value={response.status} />
        </div>
      </header>

      <div className="space-y-4">
        {schema.sections.map((sec) => (
          <section key={sec.id} className="rounded-xl border border-slate-200 bg-white">
            <header className="px-4 py-2 border-b border-slate-100 bg-slate-50">
              <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
                {sec.name}
              </div>
            </header>
            <div className="p-4 space-y-3">
              {sec.questions.map((q) => (
                <QuestionAnswer
                  key={q.id}
                  q={q}
                  answer={response.answers[q.id]}
                  comment={response.comments[q.id]}
                  photos={photosByKey[q.id] ?? []}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{label}</div>
      <div className="text-sm text-slate-900 mt-0.5">{value}</div>
    </div>
  );
}

function QuestionAnswer({
  q,
  answer,
  comment,
  photos,
}: {
  q: Question;
  answer: SubmittedAnswer | undefined;
  comment: SubmittedComment | undefined;
  photos: ResponsePhoto[];
}) {
  const answerPhotos = photos.filter((p) => p.kind === 'answer');
  const commentPhotos = photos.filter((p) => p.kind === 'comment');

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="px-3 py-2 border-b border-slate-100">
        <div className="text-sm font-semibold text-slate-900">{q.title}</div>
        {q.description && <div className="text-xs text-slate-500 mt-0.5">{q.description}</div>}
      </div>
      <div className="px-3 py-2 space-y-2">
        <AnswerDisplay q={q} answer={answer} photos={answerPhotos} />
        {(comment?.text || commentPhotos.length > 0) && (
          <div className="rounded-md bg-slate-50 border border-slate-200 px-2 py-1.5">
            <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
              Comment
            </div>
            {comment?.text && <div className="text-sm text-slate-700 mt-0.5">{comment.text}</div>}
            {commentPhotos.length > 0 && (
              <PhotoGrid photos={commentPhotos} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AnswerDisplay({
  q,
  answer,
  photos,
}: {
  q: Question;
  answer: SubmittedAnswer | undefined;
  photos: ResponsePhoto[];
}) {
  if (!answer) {
    return <div className="text-sm text-slate-400 italic">(not answered)</div>;
  }
  switch (answer.type) {
    case 'measurement':
      return (
        <div className="text-sm text-slate-900">
          {answer.value === null ? <span className="italic text-slate-400">No value</span> : answer.value}{' '}
          <span className="text-slate-500 text-xs">{answer.unit}</span>
        </div>
      );
    case 'yes_no':
    case 'yes_no_na': {
      const expected = q.answer.type === answer.type ? q.answer.correct : null;
      const ok = expected && answer.value === expected;
      const colour =
        answer.value === null
          ? 'bg-slate-100 text-slate-500'
          : ok
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-rose-100 text-rose-700';
      return (
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${colour}`}>
          {answer.value ?? 'unanswered'}
        </span>
      );
    }
    case 'free_text':
      return (
        <div className="text-sm text-slate-900 whitespace-pre-wrap">
          {answer.value || <span className="italic text-slate-400">(blank)</span>}
        </div>
      );
    case 'photo_set':
      return <PhotoGrid photos={photos} />;
  }
}

function PhotoGrid({ photos }: { photos: ResponsePhoto[] }) {
  if (photos.length === 0) {
    return <div className="text-xs text-slate-400 italic">No photos</div>;
  }
  return (
    <div className="mt-1 grid grid-cols-3 gap-1.5">
      {photos.map((p) => (
        <a
          key={p.id}
          href={p.signedUrl ?? '#'}
          target="_blank"
          rel="noreferrer"
          className="block aspect-square rounded-md bg-slate-100 overflow-hidden relative"
        >
          {p.signedUrl ? (
            <Image
              src={p.signedUrl}
              alt={p.slotId ?? 'Photo'}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 33vw, 200px"
              unoptimized
            />
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-slate-400">
              Unavailable
            </div>
          )}
        </a>
      ))}
    </div>
  );
}

function groupPhotos(photos: ResponsePhoto[]): Record<string, ResponsePhoto[]> {
  const out: Record<string, ResponsePhoto[]> = {};
  for (const p of photos) {
    (out[p.questionId] ??= []).push(p);
  }
  return out;
}
