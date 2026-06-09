import YAML from 'yaml';

export const INTENT_TOP_LEVEL_KEYS = [
  'intent_id',
  'pattern',
  'intent',
  'when',
  'data_known',
  'operator_verified',
  'conditional',
  'escalation',
  'extraction',
  'audience',
  'preflight',
] as const;

export type IntentTopLevelKey = (typeof INTENT_TOP_LEVEL_KEYS)[number];

export interface YamlValidationResult {
  ok: boolean;
  parsed?: Record<string, unknown>;
  error?: string;
}

const KEBAB_CASE = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

export function validateIntentYaml(yamlText: string): YamlValidationResult {
  let parsed: unknown;
  try {
    parsed = YAML.parse(yamlText);
  } catch (e) {
    return { ok: false, error: `YAML parse error: ${(e as Error).message}` };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'YAML root must be a mapping' };
  }
  const obj = parsed as Record<string, unknown>;
  const allowed = new Set<string>(INTENT_TOP_LEVEL_KEYS);
  const extraKeys = Object.keys(obj).filter((k) => !allowed.has(k));
  if (extraKeys.length > 0) {
    return {
      ok: false,
      error: `Unknown top-level key(s): ${extraKeys.join(', ')}. Allowed: ${INTENT_TOP_LEVEL_KEYS.join(', ')}`,
    };
  }
  if (typeof obj.intent_id !== 'string' || !KEBAB_CASE.test(obj.intent_id)) {
    return { ok: false, error: '`intent_id` must be a kebab-case string' };
  }
  return { ok: true, parsed: obj };
}

export function emptyIntentYaml(handle: string): string {
  const id = handle.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'new_intent';
  return YAML.stringify({
    intent_id: id,
    pattern: 'conversational',
    intent: 'Describe the inspection intent here.',
    when: { triggers: [] },
    data_known: [],
    operator_verified: [],
    conditional: [],
    escalation: null,
    extraction: { findings: {} },
    audience: [],
    preflight: null,
  });
}
