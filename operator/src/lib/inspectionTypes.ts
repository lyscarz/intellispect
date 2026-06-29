// Inspection types ported from the desktop app's lib/inspections/types.ts.
// Only the subset the mobile runner needs (templates, form schema, answers,
// outcomes). Keep field names in sync with the desktop so persisted rows match.

export type InspectionKind = 'form' | 'intent';
export type InspectionStatus = 'draft' | 'active';
export type Severity = 'low' | 'medium' | 'high' | 'critical';

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
  created_at: string;
  updated_at: string;
}

// Runtime answer state held by the form runner (File refs for photos).
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

// Serialised DB shape — no File refs (binaries live in inspection_response_photos).
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

export type Outcome = 'pass' | 'attention' | 'fail';
