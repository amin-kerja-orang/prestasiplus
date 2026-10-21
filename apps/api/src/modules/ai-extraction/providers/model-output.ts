import {
  AiCurriculumTagSchema,
  AiIntakeStimulusSchema,
  AiQuestionDraftSchema,
  AiRegionSchema,
  AiTagSuggestionSchema,
  type AiCurriculumTag,
  type AiExtractRequest,
  type AiIntakeStimulus,
  type AiQuestionDraft,
  type AiSuggestTagsRequest,
} from '@pp/contract'

import type { AiTagSuggestion } from '../ai.types'
import { ProviderAttemptError } from './provider-errors'

/**
 * Turns a model reply into drafts. A provider reply is NOT trusted: it is parsed, validated against the contract
 * schemas, and normalised so that the result can only be a draft (`status: 'draft'`, `confirmed: []`), carries only
 * taxonomy units that were in the request (AC-05.2), has no inline SVG (the intake worker would strip it anyway), and
 * never references a stimulus that does not exist. Anything that does not validate becomes a `needsManual` draft that a
 * person must review; nothing is silently invented.
 */

/** A field whose confidence is below this is added to `lowFields` (a person must confirm it, gate 4.8). */
export const LOW_CONFIDENCE = 0.6

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')

/** The JSON object in a model reply (fences and surrounding prose tolerated). */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end <= start) throw new ProviderAttemptError('fatal')
  try {
    return JSON.parse(trimmed.slice(start, end + 1))
  } catch {
    throw new ProviderAttemptError('fatal')
  }
}

export const emptyTag = (subject: string): AiCurriculumTag => ({ subject, level: 'T4+T5', unit: null, unitLabel: '', sp: [], tp: 3, formOrigin: 'T4' })

interface UnitInfo {
  label: string
  form: 'T4' | 'T5' | undefined
}
const unitIndex = (taxonomy: AiExtractRequest['taxonomy']): Map<string, UnitInfo> => new Map((taxonomy ?? []).map((u) => [u.code, { label: u.label, form: u.form }]))

/** Keeps `tag.unit` inside the supplied taxonomy: an unknown code (or any code without a taxonomy) becomes null. */
export function normaliseTag(raw: unknown, subject: string, units: Map<string, UnitInfo>): { tag: AiCurriculumTag; unitKept: boolean } {
  const base = emptyTag(subject)
  const merged = { ...base, ...(isObject(raw) ? raw : {}), subject }
  const parsed = AiCurriculumTagSchema.safeParse(merged)
  const tag = parsed.success ? parsed.data : base
  if (tag.unit !== null) {
    const info = units.get(tag.unit)
    if (!info) return { tag: { ...tag, unit: null, unitLabel: '' }, unitKept: false }
    return { tag: { ...tag, unitLabel: info.label }, unitKept: true }
  }
  return { tag: { ...tag, unitLabel: '' }, unitKept: false }
}

function lowFieldsOf(declared: unknown, confidence: Record<string, number>, unitKept: boolean): string[] {
  const out = new Set<string>(Array.isArray(declared) ? declared.filter((x): x is string => typeof x === 'string').slice(0, 40) : [])
  for (const [field, c] of Object.entries(confidence)) if (c < LOW_CONFIDENCE) out.add(field)
  if (!unitKept) out.add('tag.unit')
  return [...out].slice(0, 50)
}

function placeholder(index: number, subject: string, raw: unknown): AiQuestionDraft {
  const o = isObject(raw) ? raw : {}
  const label = str(o.label, 32)
  return {
    status: 'draft',
    id: `q-${label || String(index + 1)}-${String(index + 1)}`,
    label,
    type: 'short',
    stem: str(o.stem, 100_000),
    options: [],
    marks: 0,
    mode: 'short_text',
    parts: [],
    tag: emptyTag(subject),
    page: 1,
    lowFields: ['stem', 'marks', 'tag.unit'],
    confirmed: [],
    needsManual: true,
    fieldConfidence: {},
    warnings: [{ code: 'low_confidence', message: 'Soalan ini tidak dapat dibaca dengan pasti. Sila semak secara manual.' }],
  }
}

function toDraft(raw: unknown, index: number, subject: string, units: Map<string, UnitInfo>, stimulusIds: Set<string>): AiQuestionDraft {
  if (!isObject(raw)) return placeholder(index, subject, raw)
  const { tag, unitKept } = normaliseTag(raw.tag, subject, units)
  const confidenceRaw = isObject(raw.fieldConfidence) ? raw.fieldConfidence : {}
  const fieldConfidence: Record<string, number> = {}
  for (const [k, v] of Object.entries(confidenceRaw).slice(0, 50)) if (typeof v === 'number' && v >= 0 && v <= 1) fieldConfidence[k] = v
  const region = AiRegionSchema.safeParse(raw.region)
  const candidate = {
    ...raw,
    status: 'draft' as const,
    id: typeof raw.id === 'string' && raw.id !== '' ? raw.id.slice(0, 64) : `q-${str(raw.label, 32) || String(index + 1)}-${String(index + 1)}`,
    label: str(raw.label, 32),
    options: Array.isArray(raw.options) ? raw.options : [],
    parts: Array.isArray(raw.parts) ? raw.parts : [],
    tag,
    page: typeof raw.page === 'number' && Number.isInteger(raw.page) && raw.page >= 1 ? raw.page : 1,
    lowFields: lowFieldsOf(raw.lowFields, fieldConfidence, unitKept),
    confirmed: [] as string[],
    fieldConfidence,
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
    region: region.success ? region.data : undefined,
    stimulusId: typeof raw.stimulusId === 'string' && stimulusIds.has(raw.stimulusId) ? raw.stimulusId : undefined,
  }
  if (candidate.region === undefined) delete (candidate as { region?: unknown }).region
  if (candidate.stimulusId === undefined) delete (candidate as { stimulusId?: unknown }).stimulusId
  const parsed = AiQuestionDraftSchema.safeParse(candidate)
  return parsed.success ? parsed.data : placeholder(index, subject, raw)
}

function toStimulus(raw: unknown): AiIntakeStimulus | null {
  if (!isObject(raw)) return null
  // Inline SVG from a provider is never kept (the contract says adapters never emit it).
  const { svg: _svg, ...rest } = raw
  void _svg
  const parsed = AiIntakeStimulusSchema.safeParse({ ...rest, alt: typeof rest.alt === 'string' ? rest.alt : '', label: typeof rest.label === 'string' ? rest.label : '' })
  return parsed.success ? parsed.data : null
}

/** Reply text -> `questions`, `stimuli`, `unmatched`, `warnings` of an extraction (drafts only). */
export function parseExtractReply(text: string, req: AiExtractRequest): { questions: AiQuestionDraft[]; stimuli: AiIntakeStimulus[]; unmatched: string[]; warnings: string[] } {
  const json = extractJson(text)
  if (!isObject(json)) throw new ProviderAttemptError('fatal')
  const units = unitIndex(req.taxonomy)
  const stimuli: AiIntakeStimulus[] = []
  const seen = new Set<string>()
  for (const raw of Array.isArray(json.stimuli) ? json.stimuli.slice(0, 200) : []) {
    const s = toStimulus(raw)
    if (s && !seen.has(s.id)) {
      seen.add(s.id)
      stimuli.push(s)
    }
  }
  const questions: AiQuestionDraft[] = []
  const ids = new Set<string>()
  for (const [i, raw] of (Array.isArray(json.questions) ? json.questions.slice(0, 500) : []).entries()) {
    const q = toDraft(raw, i, req.subject, units, seen)
    // Local keys must be unique within a result.
    const id = ids.has(q.id) ? `${q.id}-${String(i + 1)}`.slice(0, 64) : q.id
    ids.add(id)
    questions.push({ ...q, id })
  }
  const strings = (v: unknown, max: number): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, max)).slice(0, 200) : [])
  return { questions, stimuli, unmatched: strings(json.unmatched, 200), warnings: strings(json.warnings, 500) }
}

/** Reply text -> tag suggestions for the refs that were asked about, units restricted to the taxonomy. */
export function parseTagsReply(text: string, req: AiSuggestTagsRequest): AiTagSuggestion[] {
  const json = extractJson(text)
  if (!isObject(json) || !Array.isArray(json.suggestions)) throw new ProviderAttemptError('fatal')
  const units = unitIndex(req.taxonomy)
  const asked = new Set(req.items.map((i) => i.ref))
  const out: AiTagSuggestion[] = []
  const done = new Set<string>()
  for (const raw of json.suggestions.slice(0, 200)) {
    if (!isObject(raw) || typeof raw.ref !== 'string' || !asked.has(raw.ref) || done.has(raw.ref)) continue
    const { tag } = normaliseTag(raw.tag, req.subject, units)
    const confidence = typeof raw.confidence === 'number' && raw.confidence >= 0 && raw.confidence <= 1 ? raw.confidence : 0
    const parsed = AiTagSuggestionSchema.safeParse({ ref: raw.ref, tag, confidence })
    if (parsed.success) {
      done.add(raw.ref)
      out.push(parsed.data)
    }
  }
  return out
}
