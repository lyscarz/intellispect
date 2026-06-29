import { useState } from 'react';
import { Preloader } from 'framework7-react';
import { submitFormResponse } from '../lib/inspections';
import type {
  AnswerConfig,
  InspectionTemplate,
  Outcome,
  Question,
  RuntimeAnswer as Answer,
  RuntimeComment as Comment,
  Section,
  Severity,
  SubmittedAnswer,
  SubmittedComment,
} from '../lib/inspectionTypes';
import type { FleetMachine } from '../types';

type AnswersState = Record<string, Answer>;
type CommentsState = Record<string, Comment>;
type Phase = 'editing' | 'saving' | 'done' | 'error';

const SEVERITY_CLASS: Record<Severity, string> = {
  low: 'op-sev-low',
  medium: 'op-sev-medium',
  high: 'op-sev-high',
  critical: 'op-sev-critical',
};

function initialAnswer(cfg: AnswerConfig): Answer {
  switch (cfg.type) {
    case 'measurement':
      return { type: 'measurement', value: '', unit: cfg.defaultUnit ?? cfg.units[0] ?? '' };
    case 'yes_no':
      return { type: 'yes_no', value: null };
    case 'yes_no_na':
      return { type: 'yes_no_na', value: null };
    case 'free_text':
      return { type: 'free_text', value: '' };
    case 'photo_set':
      return { type: 'photo_set', photos: Object.fromEntries(cfg.slots.map((s) => [s.id, null])) };
  }
}

function toSubmittedAnswers(
  sections: Section[],
  answers: AnswersState
): Record<string, SubmittedAnswer> {
  const out: Record<string, SubmittedAnswer> = {};
  for (const sec of sections) {
    for (const q of sec.questions) {
      const a = answers[q.id];
      if (!a) continue;
      switch (a.type) {
        case 'measurement':
          out[q.id] = { type: 'measurement', value: a.value === '' ? null : Number(a.value), unit: a.unit };
          break;
        case 'yes_no':
          out[q.id] = { type: 'yes_no', value: a.value };
          break;
        case 'yes_no_na':
          out[q.id] = { type: 'yes_no_na', value: a.value };
          break;
        case 'free_text':
          out[q.id] = { type: 'free_text', value: a.value };
          break;
        case 'photo_set':
          out[q.id] = {
            type: 'photo_set',
            filledSlots: Object.entries(a.photos)
              .filter(([, f]) => !!f)
              .map(([slotId]) => slotId),
          };
          break;
      }
    }
  }
  return out;
}

function toSubmittedComments(comments: CommentsState): Record<string, SubmittedComment> {
  const out: Record<string, SubmittedComment> = {};
  for (const [qid, c] of Object.entries(comments)) {
    const text = c.text?.trim();
    const hasPhoto = !!c.photo;
    if (!text && !hasPhoto) continue;
    out[qid] = {};
    if (text) out[qid].text = text;
    if (hasPhoto) out[qid].hasPhoto = true;
  }
  return out;
}

export default function InspectionFormRunner({
  template,
  machine,
  onDone,
}: {
  template: InspectionTemplate;
  machine: FleetMachine;
  onDone: (outcome: Outcome) => void;
}) {
  const schema = template.form_schema ?? { sections: [] };
  const [answers, setAnswers] = useState<AnswersState>(() => {
    const init: AnswersState = {};
    for (const s of schema.sections) for (const q of s.questions) init[q.id] = initialAnswer(q.answer);
    return init;
  });
  const [comments, setComments] = useState<CommentsState>({});
  const [phase, setPhase] = useState<Phase>('editing');
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const totalQs = schema.sections.reduce((n, s) => n + s.questions.length, 0);

  if (schema.sections.length === 0) {
    return <div className="op-insp-empty">This inspection has no questions yet.</div>;
  }

  if (phase === 'done' && outcome) {
    return (
      <div className={`op-insp-result op-insp-result-${outcome}`}>
        <div className="op-insp-result-badge">{outcome.toUpperCase()}</div>
        <div className="op-insp-result-title">Inspection complete</div>
        <p className="op-insp-result-sub">Submitted to the fleet manager.</p>
        <button type="button" className="op-ci-btn op-ci-btn-fill" onClick={() => onDone(outcome)}>
          Done · check in
        </button>
      </div>
    );
  }

  async function handleSubmit() {
    setError(null);
    setPhase('saving');
    try {
      const submittedAnswers = toSubmittedAnswers(schema.sections, answers);
      const submittedComments = toSubmittedComments(comments);
      const res = await submitFormResponse({
        template,
        machine,
        answers: submittedAnswers,
        comments: submittedComments,
      });
      setOutcome(res.outcome);
      setPhase('done');
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
    }
  }

  const saving = phase === 'saving';

  return (
    <div className="op-insp-body">
      <div className="op-insp-head">
        <div className="op-insp-kicker">Inspection</div>
        <div className="op-insp-name">{template.name}</div>
        <div className="op-insp-count">{totalQs} questions</div>
      </div>

      {schema.sections.map((sec) => (
        <div key={sec.id} className="op-insp-section">
          <div className="op-insp-section-name">{sec.name}</div>
          {sec.questions.map((q) => (
            <QuestionCard
              key={q.id}
              q={q}
              answer={answers[q.id]}
              comment={comments[q.id]}
              onAnswer={(a) => setAnswers((s) => ({ ...s, [q.id]: a }))}
              onComment={(c) => setComments((s) => ({ ...s, [q.id]: { ...s[q.id], ...c } }))}
            />
          ))}
        </div>
      ))}

      {error && <div className="op-insp-error">{error}</div>}

      <button
        type="button"
        className="op-ci-btn op-ci-btn-fill op-insp-submit"
        onClick={handleSubmit}
        disabled={saving}
      >
        {saving ? <Preloader color="white" size={20} /> : 'Submit inspection'}
      </button>
    </div>
  );
}

function QuestionCard({
  q,
  answer,
  comment,
  onAnswer,
  onComment,
}: {
  q: Question;
  answer: Answer | undefined;
  comment: Comment | undefined;
  onAnswer: (a: Answer) => void;
  onComment: (c: Comment) => void;
}) {
  const [commentOpen, setCommentOpen] = useState(false);
  return (
    <div className="op-insp-q">
      <div className={`op-insp-q-sev ${SEVERITY_CLASS[q.severity]}`} />
      <div className="op-insp-q-inner">
        <div className="op-insp-q-title">{q.title}</div>
        {q.description && <div className="op-insp-q-desc">{q.description}</div>}
        <div className="op-insp-q-answer">
          <AnswerInput cfg={q.answer} answer={answer} onChange={onAnswer} />
        </div>
        {(q.comments.text || q.comments.photo) && (
          <div className="op-insp-comment">
            <button
              type="button"
              className="op-insp-comment-toggle"
              onClick={() => setCommentOpen((o) => !o)}
            >
              {commentOpen ? '− Hide comment' : '+ Add comment'}
            </button>
            {commentOpen && (
              <div className="op-insp-comment-body">
                {q.comments.text && (
                  <textarea
                    rows={2}
                    value={comment?.text ?? ''}
                    onChange={(e) => onComment({ text: e.target.value })}
                    placeholder="Note…"
                    className="op-insp-textarea"
                  />
                )}
                {q.comments.photo && (
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="op-insp-file"
                    onChange={(e) => onComment({ photo: e.target.files?.[0] ?? null })}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AnswerInput({
  cfg,
  answer,
  onChange,
}: {
  cfg: AnswerConfig;
  answer: Answer | undefined;
  onChange: (a: Answer) => void;
}) {
  if (cfg.type === 'yes_no') {
    const a = (answer ?? { type: 'yes_no', value: null }) as Extract<Answer, { type: 'yes_no' }>;
    return (
      <YesNoButtons
        options={['yes', 'no']}
        value={a.value}
        correct={cfg.correct}
        onChange={(v) => onChange({ type: 'yes_no', value: v as 'yes' | 'no' })}
      />
    );
  }
  if (cfg.type === 'yes_no_na') {
    const a = (answer ?? { type: 'yes_no_na', value: null }) as Extract<Answer, { type: 'yes_no_na' }>;
    return (
      <YesNoButtons
        options={['yes', 'no', 'na']}
        value={a.value}
        correct={cfg.correct}
        onChange={(v) => onChange({ type: 'yes_no_na', value: v as 'yes' | 'no' | 'na' })}
      />
    );
  }
  if (cfg.type === 'free_text') {
    const a = (answer ?? { type: 'free_text', value: '' }) as Extract<Answer, { type: 'free_text' }>;
    return (
      <textarea
        rows={3}
        value={a.value}
        onChange={(e) => onChange({ type: 'free_text', value: e.target.value })}
        className="op-insp-textarea"
        placeholder="Type your answer…"
      />
    );
  }
  if (cfg.type === 'measurement') {
    const a = (answer ?? {
      type: 'measurement' as const,
      value: '' as const,
      unit: cfg.defaultUnit ?? cfg.units[0] ?? '',
    }) as Extract<Answer, { type: 'measurement' }>;
    return (
      <div className="op-insp-measure">
        <input
          type="number"
          inputMode="decimal"
          value={a.value}
          onChange={(e) =>
            onChange({
              type: 'measurement',
              value: e.target.value === '' ? '' : Number(e.target.value),
              unit: a.unit,
            })
          }
          className="op-insp-num"
          placeholder="0"
        />
        <select
          value={a.unit}
          onChange={(e) => onChange({ type: 'measurement', value: a.value, unit: e.target.value })}
          className="op-insp-unit"
        >
          {cfg.units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
    );
  }
  // photo_set
  const a = (answer ?? {
    type: 'photo_set' as const,
    photos: Object.fromEntries(cfg.slots.map((s) => [s.id, null])),
  }) as Extract<Answer, { type: 'photo_set' }>;
  return (
    <div className="op-insp-photos">
      {cfg.slots.map((s) => {
        const file = a.photos[s.id];
        return (
          <label key={s.id} className={`op-insp-photo${file ? ' filled' : ''}`}>
            <span>
              {file ? '✓' : '+'} {s.label}
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="op-insp-file-hidden"
              onChange={(e) =>
                onChange({ type: 'photo_set', photos: { ...a.photos, [s.id]: e.target.files?.[0] ?? null } })
              }
            />
          </label>
        );
      })}
    </div>
  );
}

function YesNoButtons({
  options,
  value,
  correct,
  onChange,
}: {
  options: string[];
  value: string | null;
  correct: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="op-insp-yesno">
      {options.map((o) => {
        const selected = value === o;
        const isCorrect = o === correct;
        const cls = selected ? (isCorrect ? ' good' : ' bad') : '';
        return (
          <button key={o} type="button" className={`op-insp-yn${cls}`} onClick={() => onChange(o)}>
            {o.replace('_', ' ')}
          </button>
        );
      })}
    </div>
  );
}
