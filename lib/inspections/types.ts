import type { ActivityState, CriticalityState } from '@/lib/types';

export type InspectionKind = 'form' | 'intent';
export type InspectionStatus = 'draft' | 'active';
export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type AnswerType =
  | 'measurement'
  | 'yes_no'
  | 'yes_no_na'
  | 'free_text'
  | 'photo_set';

export type AnswerConfig =
  | { type: 'measurement'; units: string[]; defaultUnit?: string; min?: number; max?: number }
  | { type: 'yes_no'; correct: 'yes' | 'no' }
  | { type: 'yes_no_na'; correct: 'yes' | 'no' | 'na' }
  | { type: 'free_text' }
  | { type: 'photo_set'; slots: { id: string; label: string }[] };

export interface Question {
  id: string;
  title: string;
  description?: string;
  imagePath?: string;
  severity: Severity;
  answer: AnswerConfig;
  comments: { photo: boolean; text: boolean };
}

export interface Section {
  id: string;
  name: string;
  questions: Question[];
}

export interface FormSchema {
  sections: Section[];
}

export type ChatRole = 'user' | 'assistant';
export interface ChatMessage {
  role: ChatRole;
  content: string;
  ts: string;
}

export type AssignmentKind = 'all' | 'site' | 'type' | 'machine';

export interface Assignment {
  id: string;
  accountId: string;
  templateId: string;
  targetKind: AssignmentKind;
  /** Site or machine id when targetKind is 'site' or 'machine'; null otherwise. */
  targetId: string | null;
  /** The type string (e.g. 'EXCAVATOR') when targetKind is 'type'; null otherwise. */
  targetValue: string | null;
  createdAt: string;
}

/** Lightweight machine snapshot passed to the runner so the AI / form header
 *  knows which machine the inspection is being run against. */
export interface MachineContext {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  assetType: string | null;
  siteName: string | null;
}

export interface InspectionTemplate {
  id: string;
  account_id: string;
  kind: InspectionKind;
  status: InspectionStatus;
  name: string;
  handle: string;
  description: string | null;
  form_schema: FormSchema | null;
  yaml_body: string | null;
  chat_history: ChatMessage[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// ─── Runtime answers (client state in the mobile runner) ────────────────────
export type RuntimeAnswer =
  | { type: 'measurement'; value: number | ''; unit: string }
  | { type: 'yes_no'; value: 'yes' | 'no' | null }
  | { type: 'yes_no_na'; value: 'yes' | 'no' | 'na' | null }
  | { type: 'free_text'; value: string }
  | { type: 'photo_set'; photos: Record<string, File | null> };

export interface RuntimeComment {
  text?: string;
  photo?: File | null;
}

// ─── Submitted answers (serialised DB shape — no File refs) ─────────────────
// Photo binaries live in inspection_response_photos; the answer/comment JSON
// only records *which* slots were filled or whether a comment photo exists.
export type SubmittedAnswer =
  | { type: 'measurement'; value: number | null; unit: string }
  | { type: 'yes_no'; value: 'yes' | 'no' | null }
  | { type: 'yes_no_na'; value: 'yes' | 'no' | 'na' | null }
  | { type: 'free_text'; value: string }
  | { type: 'photo_set'; filledSlots: string[] };

export interface SubmittedComment {
  text?: string;
  hasPhoto?: boolean;
}

export interface ResponsePhoto {
  id: string;
  responseId: string;
  accountId: string;
  questionId: string;
  slotId: string | null;
  kind: 'answer' | 'comment';
  storagePath: string;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  /** Lazily attached by getResponse(); not stored in DB. */
  signedUrl?: string;
}

export interface InspectionResponse {
  id: string;
  accountId: string;
  templateId: string;
  templateSnapshot: FormSchema;
  machineId: string | null;
  siteId: string | null;
  submittedBy: string | null;
  submittedAt: string;
  answers: Record<string, SubmittedAnswer>;
  comments: Record<string, SubmittedComment>;
  status: string;
  /** 'pass' | 'attention' | 'fail' — null while in_progress. */
  outcome: Outcome | null;
  summary: string | null;
  findings: unknown;
  /** Optional join; populated by getResponse(). */
  photos?: ResponsePhoto[];
}

// ─── Pre-inspection AI analysis ─────────────────────────────────────────────

export type InspectionRunStatus = 'in_progress' | 'complete' | 'partial' | 'skipped';

export type PreflightRecommendation = 'proceed' | 'heightened' | 'skip';

export interface PreflightVerdict {
  recommendation: PreflightRecommendation;
  /** Plain-English explanation shown to admins. */
  reasoning: string;
  /** Short briefing injected into the runner's system prompt. */
  briefing: string;
  /** Optional emphasis bullets. */
  focusItems?: string[];
}

/** Pre-computed inputs the model receives. Numerical deltas + session state
 *  done in code so the LLM gets clean facts. */
export interface PreflightInputs {
  machine: MachineContext;
  /** ISO timestamp from machines.lastSyncedAt — flags stale telematics. */
  lastSyncedAt: string | null;
  activity: ActivityState | null;
  criticality: CriticalityState | null;
  criticalEventCount: number;
  lowEventCount: number;
  recentEvents: Array<{
    type: string;
    severity: CriticalityState;
    openedAt: string | null;
    description: string | null;
  }>;
  fuelLevel: number | null;
  batteryStateOfChargePercent: number | null;
  cumulativeOperatingHours: number | null;
  cumulativeEngineHours: number | null;
  lastRun: {
    completedAt: string;
    summary: string | null;
    operatorId: string | null;
    engineHoursAtStart: number | null;
    /** Concrete observations captured last time (e.g. operator said "front wheel
     *  is flat"). The AI uses these to ask follow-up questions like "Has the
     *  flat tyre been replaced?" instead of starting from scratch. */
    findings: unknown;
  } | null;
  hoursSinceLastInspection: number | null;
  engineHoursDelta: number | null;
  /** 'continuing' = same operator, <2h ago; 'new' otherwise. */
  sessionState: 'continuing' | 'new';
}

export interface IntentRun {
  id: string;
  accountId: string;
  templateId: string;
  machineId: string | null;
  operatorId: string | null;
  status: InspectionRunStatus;
  startedAt: string;
  completedAt: string | null;
  yamlSnapshot: string;
  transcript: ChatMessage[];
  preflight: PreflightVerdict | PreflightInputs | null;
  engineHoursAtStart: number | null;
  operatingHoursAtStart: number | null;
  machineStateAtStart: unknown;
  summary: string | null;
  findings: unknown;
  /** 'pass' | 'attention' | 'fail' — null while in_progress. */
  outcome: Outcome | null;
}

/** Kind-agnostic shape used by the resolver to surface "last run for
 *  (machine, template)" across both inspection_responses and inspection_intent_runs. */
export interface RunRow {
  kind: 'form' | 'intent';
  id: string;
  templateId: string;
  machineId: string | null;
  operatorId: string | null;
  startedAt: string;
  completedAt: string | null;
  status: InspectionRunStatus;
  summary: string | null;
  /** Concrete findings captured at completion. Free-form JSON matching the
   *  YAML's `extraction` block — e.g. { physical_issues: ['front wheel flat'] }.
   *  Carried forward to the next run's PreflightInputs.lastRun.findings. */
  findings: unknown;
  engineHoursAtStart: number | null;
}

// ─── Outcomes ───────────────────────────────────────────────────────────────

export type Outcome = 'pass' | 'attention' | 'fail';

/** Row shape used by /inspection-history list. Joins template name + machine
 *  name + outcome so the list can render without further lookups. */
export interface UnifiedRunRow extends RunRow {
  outcome: Outcome | null;
  templateName: string;
  templateHandle: string;
  machineName: string | null;
  /** Count of escalations on this run (0 = no chip; >0 = "Escalated" chip). */
  escalationCount: number;
}

// ─── Escalations ────────────────────────────────────────────────────────────

export type EscalationKind = 'manager' | 'service' | 'event';
export type EscalationStatus = 'open' | 'sent' | 'resolved' | 'dismissed';

export interface Escalation {
  id: string;
  accountId: string;
  responseId: string | null;
  intentRunId: string | null;
  machineId: string | null;
  kind: EscalationKind;
  status: EscalationStatus;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
}
