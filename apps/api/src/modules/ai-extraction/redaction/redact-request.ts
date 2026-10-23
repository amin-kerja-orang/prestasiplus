import type { AiExtractRequest, AiGenerateTextRequest, AiRedactionSummary, AiSuggestTagsRequest } from '@pp/contract'

import { type MaskedSpan, Redactor } from './redactor'

export interface Redacted<T> {
  request: T
  summary: AiRedactionSummary
}

/**
 * Page text, taxonomy labels and structure labels go through the redactor. Page images are dropped: a masked name on a
 * text layer is still a name in the pixels of the cover page, and there is no redacting image source in this card
 * (open question in the card report), so the service sends text only. `spans` are the masked values, in memory only, for
 * `maskEchoes` on the answer (`AiExtractionService.extractPaper`); they are never stored, logged or returned. This is the
 * one redaction of an extraction request (#189): callers hand over unredacted text and never redact it themselves.
 */
export function redactExtractRequest(req: AiExtractRequest): Redacted<AiExtractRequest> & { spans: MaskedSpan[] } {
  const r = new Redactor()
  const request: AiExtractRequest = {
    pages: req.pages.map((p) => ({ ...p, text: r.redact(p.text) })),
    subject: req.subject,
    kertas: req.kertas,
    ...(req.taxonomy ? { taxonomy: req.taxonomy.map((u) => ({ ...u, label: r.redact(u.label) })) } : {}),
    ...(req.structure ? { structure: req.structure.map((s) => ({ ...s, label: r.redact(s.label) })) } : {}),
  }
  return { request, summary: r.summary(), spans: r.maskedSpans() }
}

/**
 * Question stems are redacted. The caller's `ref` keys may be entity ids, so a provider only ever sees positional keys
 * (`q1`, `q2`, ...); `refs[i]` is the caller key of `q${i + 1}`.
 */
export function redactSuggestTagsRequest(req: AiSuggestTagsRequest): Redacted<AiSuggestTagsRequest> & { refs: string[] } {
  const r = new Redactor()
  const refs = req.items.map((i) => i.ref)
  const request: AiSuggestTagsRequest = {
    subject: req.subject,
    items: req.items.map((i, idx) => ({ ref: `q${idx + 1}`, stem: r.redact(i.stem), ...(i.type ? { type: i.type } : {}) })),
    taxonomy: req.taxonomy.map((u) => ({ ...u, label: r.redact(u.label) })),
  }
  return { request, summary: r.summary(), refs }
}

export function redactGenerateTextRequest(req: AiGenerateTextRequest): Redacted<AiGenerateTextRequest> {
  const r = new Redactor()
  const request: AiGenerateTextRequest = { purpose: req.purpose, system: r.redact(req.system), input: r.redact(req.input) }
  return { request, summary: r.summary() }
}
