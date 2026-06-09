import type {
  AnswerConfig,
  InspectionResponse,
  Question,
  ResponsePhoto,
  Section,
  Severity,
  SubmittedAnswer,
  SubmittedComment,
} from '@/lib/inspections/types';

const SEVERITY_BAR: Record<Severity, string> = {
  low: 'bg-slate-300',
  medium: 'bg-amber-400',
  high: 'bg-orange-500',
  critical: 'bg-rose-500',
};

export function FormRunDetail({ response }: { response: InspectionResponse }) {
  const schema = response.templateSnapshot;
  const photosByQuestion = groupPhotos(response.photos ?? []);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {response.summary && (
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
            Summary
          </div>
          <p className="text-sm text-slate-800 mt-1 leading-relaxed">{response.summary}</p>
        </div>
      )}

      <div className="p-4 space-y-4">
        {schema.sections.length === 0 && (
          <div className="text-sm text-slate-500">This template had no sections.</div>
        )}
        {schema.sections.map((sec) => (
          <SectionDetail
            key={sec.id}
            sec={sec}
            answers={response.answers}
            comments={response.comments}
            photosByQuestion={photosByQuestion}
          />
        ))}
      </div>
    </div>
  );
}

function groupPhotos(photos: ResponsePhoto[]): Record<
  string,
  { answer: ResponsePhoto[]; comment: ResponsePhoto[] }
> {
  const out: Record<string, { answer: ResponsePhoto[]; comment: ResponsePhoto[] }> = {};
  for (const p of photos) {
    const bucket = (out[p.questionId] ??= { answer: [], comment: [] });
    bucket[p.kind].push(p);
  }
  return out;
}

function SectionDetail({
  sec,
  answers,
  comments,
  photosByQuestion,
}: {
  sec: Section;
  answers: Record<string, SubmittedAnswer>;
  comments: Record<string, SubmittedComment>;
  photosByQuestion: Record<string, { answer: ResponsePhoto[]; comment: ResponsePhoto[] }>;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-2">
        {sec.name}
      </div>
      <div className="space-y-2.5">
        {sec.questions.map((q) => (
          <QuestionDetail
            key={q.id}
            q={q}
            answer={answers[q.id]}
            comment={comments[q.id]}
            photos={photosByQuestion[q.id]}
          />
        ))}
      </div>
    </div>
  );
}

function QuestionDetail({
  q,
  answer,
  comment,
  photos,
}: {
  q: Question;
  answer: SubmittedAnswer | undefined;
  comment: SubmittedComment | undefined;
  photos: { answer: ResponsePhoto[]; comment: ResponsePhoto[] } | undefined;
}) {
  const bad = isBadAnswer(q.answer, answer);
  return (
    <div className={`rounded-xl border overflow-hidden ${bad ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 bg-white'}`}>
      <div className={`h-1 ${SEVERITY_BAR[q.severity]}`} />
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900">{q.title}</div>
          <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
            {q.severity}
          </span>
        </div>
        {q.description && (
          <p className="text-xs text-slate-500 mt-0.5">{q.description}</p>
        )}
        <AnswerSummary cfg={q.answer} a={answer} photos={photos?.answer ?? []} />
        {(comment?.text || comment?.hasPhoto) && (
          <div className="mt-2 rounded-md bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-xs">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-0.5">
              Comment
            </div>
            {comment.text && <div className="text-slate-700">{comment.text}</div>}
            {(photos?.comment ?? []).map((p) => (
              <PhotoThumb key={p.id} photo={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AnswerSummary({
  cfg,
  a,
  photos,
}: {
  cfg: AnswerConfig;
  a: SubmittedAnswer | undefined;
  photos: ResponsePhoto[];
}) {
  if (!a) {
    return <div className="mt-2 text-xs text-slate-400">No answer.</div>;
  }
  if (a.type === 'yes_no' || a.type === 'yes_no_na') {
    const correct =
      cfg.type === a.type ? cfg.correct : null;
    const bad = a.value !== null && correct !== null && a.value !== correct;
    return (
      <div className="mt-2 inline-flex items-center gap-2 text-sm">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded uppercase tracking-wide font-semibold text-xs ${
            bad ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {a.value ?? '—'}
        </span>
        {correct && (
          <span className="text-[11px] text-slate-400">expected: {correct}</span>
        )}
      </div>
    );
  }
  if (a.type === 'measurement') {
    return (
      <div className="mt-2 text-sm font-mono text-slate-800">
        {a.value ?? '—'} <span className="text-xs text-slate-500">{a.unit}</span>
      </div>
    );
  }
  if (a.type === 'free_text') {
    return (
      <div className="mt-2 text-sm text-slate-800 whitespace-pre-wrap">
        {a.value || <span className="text-slate-400">(empty)</span>}
      </div>
    );
  }
  // photo_set
  if (a.type === 'photo_set') {
    return (
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {photos.length === 0 && (
          <div className="text-xs text-slate-400 col-span-full">No photos uploaded.</div>
        )}
        {photos.map((p) => (
          <PhotoThumb key={p.id} photo={p} />
        ))}
      </div>
    );
  }
  return null;
}

function PhotoThumb({ photo }: { photo: ResponsePhoto }) {
  if (!photo.signedUrl) {
    return (
      <div className="aspect-video rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400">
        photo
      </div>
    );
  }
  return (
    <a href={photo.signedUrl} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.signedUrl}
        alt={photo.slotId ?? 'inspection photo'}
        className="aspect-video object-cover rounded-md border border-slate-200"
      />
    </a>
  );
}

function isBadAnswer(cfg: AnswerConfig, a: SubmittedAnswer | undefined): boolean {
  if (!a) return false;
  if (cfg.type === 'yes_no' && a.type === 'yes_no')
    return a.value !== null && a.value !== cfg.correct;
  if (cfg.type === 'yes_no_na' && a.type === 'yes_no_na')
    return a.value !== null && a.value !== cfg.correct;
  if (cfg.type === 'measurement' && a.type === 'measurement') {
    if (a.value === null) return false;
    if (cfg.min !== undefined && a.value < cfg.min) return true;
    if (cfg.max !== undefined && a.value > cfg.max) return true;
  }
  return false;
}
