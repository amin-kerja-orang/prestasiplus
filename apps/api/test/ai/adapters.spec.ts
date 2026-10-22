import {
  AiCapabilitiesSchema,
  AiGenerateTextResultSchema,
  AiIntakeStimulusSchema,
  AiQuestionDraftSchema,
  AiTagSuggestionSchema,
  type AiExtractRequest,
  type AiSuggestTagsRequest,
} from '@pp/contract'
import { afterEach, describe, expect, it } from 'vitest'

import type { ExtractionProvider } from '../../src/modules/ai-extraction/ai.types'
import { ProviderAttemptError } from '../../src/modules/ai-extraction/providers/provider-errors'
import { createProvider } from '../../src/modules/ai-extraction/providers/registry'
import { captureLogs, FAKE_KEY, fixture, jsonResponse, makeConfig, publicResolver, stubFetch, VENDORS, vendorEnv } from './helpers'

/**
 * AC1 / AC9: ONE contract suite, run against the mock and, with recorded responses, against every real adapter. The
 * fixtures are authored in each vendor's documented response shape (no network and no key exist in CI) with fictitious
 * paper content. Swapping the provider changes nothing for the caller: the same four operations, the same result shapes.
 */
const EXTRACT: AiExtractRequest = {
  pages: [{ page: 1, source: 'text-layer', text: '1. Antara berikut, yang manakah nilai min bagi 2, 4, 6, 8?\nA. 4\nB. 5\nC. 6\nD. 8\n2. Selesaikan persamaan 2x + 6 = 14. [2 markah]\nJawapan: 1-B' }],
  subject: 'MAT',
  kertas: 2,
  taxonomy: [{ code: 'MAT-T4-09', label: 'Statistik', form: 'T4' }],
}
const TAGS: AiSuggestTagsRequest = {
  subject: 'MAT',
  items: [
    { ref: 'q1', stem: 'Nilai min bagi 2, 4, 6, 8 ialah' },
    { ref: 'q2', stem: 'Selesaikan 2x + 6 = 14' },
  ],
  taxonomy: [{ code: 'MAT-T4-09', label: 'Statistik', form: 'T4' }],
}
const signal = () => new AbortController().signal

type Recorded = { extract: unknown; tags: unknown; text: unknown; health: unknown; error: unknown }

interface Subject {
  name: string
  provider: ExtractionProvider
  fetch: ReturnType<typeof stubFetch>
  /** Make the next calls answer with the recorded response of this operation. */
  answer(op: keyof Omit<Recorded, 'error'>): void
}

function mockSubject(): Subject {
  const fetch = stubFetch(() => {
    throw new Error('the mock must not call the network')
  })
  return { name: 'mock', provider: createProvider(makeConfig({}), fetch.fn, publicResolver), fetch, answer: () => undefined }
}

function vendorSubject(id: (typeof VENDORS)[number]['id']): Subject {
  const rec = fixture<Recorded>(`recorded-${id}.json`)
  const fetch = stubFetch()
  return {
    name: id,
    provider: createProvider(makeConfig(vendorEnv(id)), fetch.fn, publicResolver),
    fetch,
    answer: (op) => fetch.set(() => jsonResponse(rec[op])),
  }
}

const subjects: [string, () => Subject][] = [['mock', mockSubject], ...VENDORS.map((v): [string, () => Subject] => [v.id, () => vendorSubject(v.id)])]

describe.each(subjects)('adapter contract: %s', (_name, make) => {
  it('declares its id, a model, valid capabilities and that it is configured', () => {
    const s = make()
    expect(s.provider.id).toBe(_name)
    expect(s.provider.model.length).toBeGreaterThan(0)
    expect(AiCapabilitiesSchema.safeParse(s.provider.capabilities).success).toBe(true)
    expect(s.provider.isConfigured()).toBe(true)
  })

  it('extractPaper returns drafts only, valid against the contract, with tokens', async () => {
    const s = make()
    s.answer('extract')
    const r = await s.provider.extractPaper(EXTRACT, { signal: signal() })
    expect(r.paper.provider).toBe(_name)
    expect(r.paper.questions.length).toBeGreaterThan(0)
    for (const q of r.paper.questions) {
      expect(AiQuestionDraftSchema.safeParse(q).success, JSON.stringify(q)).toBe(true)
      expect(q.status).toBe('draft')
      expect(q.confirmed).toEqual([])
      // AC-05.2: a unit is a code of the supplied taxonomy or null, never free text.
      expect(q.tag.unit === null || q.tag.unit === 'MAT-T4-09').toBe(true)
    }
    for (const st of r.paper.stimuli) {
      expect(AiIntakeStimulusSchema.safeParse(st).success).toBe(true)
      expect(st.svg).toBeUndefined()
    }
    expect(Number.isInteger(r.tokensIn) && r.tokensIn >= 0).toBe(true)
    expect(Number.isInteger(r.tokensOut) && r.tokensOut >= 0).toBe(true)
  })

  it('suggestTags answers only for refs that were asked, with units from the taxonomy', async () => {
    const s = make()
    s.answer('tags')
    const r = await s.provider.suggestTags(TAGS, { signal: signal() })
    expect(r.suggestions.length).toBeGreaterThan(0)
    for (const g of r.suggestions) {
      expect(AiTagSuggestionSchema.safeParse(g).success).toBe(true)
      expect(['q1', 'q2']).toContain(g.ref)
      expect(g.tag.unit === null || g.tag.unit === 'MAT-T4-09').toBe(true)
    }
  })

  it('generateText returns { text, tokensIn, tokensOut } exactly', async () => {
    const s = make()
    s.answer('text')
    const r = await s.provider.generateText({ purpose: 'cikgu.chat', system: 'Anda pembantu.', input: 'Apakah teorem Pythagoras?' }, { signal: signal() })
    expect(AiGenerateTextResultSchema.safeParse(r).success).toBe(true)
    expect(Object.keys(r).sort()).toEqual(['text', 'tokensIn', 'tokensOut'])
    expect(r.text.length).toBeGreaterThan(0)
  })

  it('healthCheck answers ok on its built-in sample', async () => {
    const s = make()
    s.answer('health')
    const r = await s.provider.healthCheck({ signal: signal() })
    expect(r.ok).toBe(true)
    expect(r.latencyMs).toBeGreaterThanOrEqual(0)
  })
})

describe('mock provider specifics', () => {
  it('generateText returns deterministic canned text per purpose, without a network call and without echoing the input', async () => {
    const s = mockSubject()
    const a = await s.provider.generateText({ purpose: 'cikgu.chat', system: 's', input: 'CANARY-INPUT-1' }, { signal: signal() })
    const b = await s.provider.generateText({ purpose: 'cikgu.chat', system: 's2', input: 'CANARY-INPUT-2' }, { signal: signal() })
    const c = await s.provider.generateText({ purpose: 'rph.plan', system: 's', input: 'x' }, { signal: signal() })
    expect(a.text).toBe(b.text)
    expect(a.text).not.toBe(c.text)
    expect(a.text).not.toContain('CANARY')
    expect(s.fetch.calls).toHaveLength(0)
  })

  it('is the default when AI_PROVIDER is unset, and an unknown id is a start-up error (no silent fallback)', () => {
    expect(createProvider(makeConfig({}), stubFetch().fn, publicResolver).id).toBe('mock')
    expect(() => createProvider(makeConfig({ AI_PROVIDER: 'nope' }), stubFetch().fn, publicResolver)).toThrow('Penyedia AI tidak dikenali: nope')
  })
})

describe('recorded replies are normalised, not trusted', () => {
  it('forces draft status, empties confirmed, strips svg, drops dangling stimulus links, nulls foreign units, keeps a placeholder for junk', async () => {
    for (const v of VENDORS) {
      const s = vendorSubject(v.id)
      s.answer('extract')
      const { paper } = await s.provider.extractPaper(EXTRACT, { signal: signal() })
      expect(paper.questions).toHaveLength(3)
      const [q1, q2, junk] = paper.questions
      expect(q1?.status).toBe('draft') // the reply said "approved"
      expect(q1?.confirmed).toEqual([]) // the reply said ["stem"]
      expect(q1?.lowFields).toContain('marks') // confidence 0.5 is below the review threshold
      expect(q2?.tag.unit).toBeNull() // "XXX-99" is not in the taxonomy
      expect(q2?.lowFields).toContain('tag.unit')
      expect(q2?.stimulusId).toBeUndefined() // "stim-9" does not exist
      expect(junk?.needsManual).toBe(true)
      expect(paper.stimuli[0]?.svg).toBeUndefined()
      expect(JSON.stringify(paper)).not.toContain('onload')
      expect(new Set(paper.questions.map((q) => q.id)).size).toBe(3)
    }
  })

  it('a suggestion for a ref nobody asked about is dropped and a foreign unit becomes null', async () => {
    const s = vendorSubject('openai')
    s.answer('tags')
    const { suggestions } = await s.provider.suggestTags(TAGS, { signal: signal() })
    expect(suggestions.map((x) => x.ref)).toEqual(['q1', 'q2'])
    expect(suggestions[1]?.tag.unit).toBeNull()
  })
})

describe('request shape of each vendor', () => {
  const cases: [string, string, (c: ReturnType<typeof stubFetch>['calls'][number]) => void][] = [
    ['anthropic', 'https://api.anthropic.com/v1/messages', (c) => expect(c.headers['x-api-key']).toBe(FAKE_KEY)],
    ['openai', 'https://api.openai.com/v1/chat/completions', (c) => expect(c.headers.authorization).toBe(`Bearer ${FAKE_KEY}`)],
    ['gemini', 'https://generativelanguage.googleapis.com/v1beta/models/model-x:generateContent', (c) => expect(c.headers['x-goog-api-key']).toBe(FAKE_KEY)],
    ['openai-compatible', 'https://gateway.example.test/v1/chat/completions', (c) => expect(c.headers.authorization).toBe(`Bearer ${FAKE_KEY}`)],
  ]
  it.each(cases)('%s: fixed endpoint, key only in a header, JSON body, no redirect, pinned addresses', async (id, url, header) => {
    const s = vendorSubject(id as (typeof VENDORS)[number]['id'])
    s.answer('text')
    await s.provider.generateText({ purpose: 'x', system: 'sistem', input: 'masukan' }, { signal: signal() })
    const c = s.fetch.calls[0]
    expect(c?.url).toBe(url)
    expect(c?.method).toBe('POST')
    expect(c?.redirect).toBe('manual')
    expect(c?.pinned).toEqual(['93.184.216.34'])
    if (c) header(c)
    expect(c?.url).not.toContain(FAKE_KEY)
    expect(c?.body).not.toContain(FAKE_KEY)
    expect(JSON.parse(c?.body ?? '{}')).toBeTypeOf('object')
  })

  it('the extraction prompt carries page text, taxonomy and structure only', async () => {
    const s = vendorSubject('anthropic')
    s.answer('extract')
    await s.provider.extractPaper({ ...EXTRACT, structure: [{ label: 'Bahagian A', type: 'mcq', questionCount: 40 }] }, { signal: signal() })
    const body = JSON.parse(s.fetch.calls[0]?.body ?? '{}') as { messages: { content: string }[]; system: string; model: string }
    const user = JSON.parse(body.messages[0]?.content ?? '{}') as Record<string, unknown>
    expect(Object.keys(user).sort()).toEqual(['kertas', 'pages', 'structure', 'subject', 'taxonomy'])
    expect(body.model).toBe('model-x')
  })
})

describe('provider failures', () => {
  const logs = captureLogs
  let cap: ReturnType<typeof logs> | undefined
  afterEach(() => cap?.restore())

  it.each(VENDORS.map((v) => v.id))('%s: 429 and 5xx are transient (Retry-After kept), other 4xx fatal, junk replies fatal', async (id) => {
    cap = logs()
    const rec = fixture<Recorded>(`recorded-${id}.json`)
    const s = vendorSubject(id)
    const ask = () => s.provider.generateText({ purpose: 'x', system: 's', input: 'i' }, { signal: signal() })
    s.fetch.set(() => jsonResponse(rec.error, 429, { 'retry-after': '7' }))
    await expect(ask()).rejects.toMatchObject({ kind: 'transient', status: 429, retryAfterMs: 7000 })
    s.fetch.set(() => jsonResponse(rec.error, 503))
    await expect(ask()).rejects.toMatchObject({ kind: 'transient', status: 503 })
    s.fetch.set(() => jsonResponse(rec.error, 401))
    await expect(ask()).rejects.toMatchObject({ kind: 'fatal', status: 401 })
    s.fetch.set(() => jsonResponse(rec.error, 400))
    await expect(ask()).rejects.toMatchObject({ kind: 'fatal', status: 400 })
    s.fetch.set(() => new Response('<html>not json</html>', { status: 200 }))
    await expect(ask()).rejects.toBeInstanceOf(ProviderAttemptError)
    s.fetch.set(() => jsonResponse({ unexpected: true }, 200))
    await expect(ask()).rejects.toMatchObject({ kind: 'fatal' })
    // The provider's error body is never logged (it can echo prompt text) and the key is not either.
    const all = (cap?.lines ?? []).join('\n')
    expect(all).not.toContain('CANARY-PROVIDER-ERROR-BODY')
    expect(all).not.toContain(FAKE_KEY)
    expect(all).toContain('status=429')
  })

  it('a non-JSON model reply is a fatal attempt, not a crash', async () => {
    const s = vendorSubject('openai')
    s.fetch.set(() => jsonResponse({ choices: [{ message: { content: 'Maaf, saya tidak dapat membantu.' } }], usage: { prompt_tokens: 3, completion_tokens: 4 } }))
    await expect(s.provider.extractPaper(EXTRACT, { signal: signal() })).rejects.toMatchObject({ kind: 'fatal' })
  })

  it('is not configured without a key or a model', () => {
    for (const env of [{ ...vendorEnv('openai'), AI_API_KEY: '' }, { ...vendorEnv('gemini'), AI_MODEL: '' }, { ...vendorEnv('anthropic'), AI_MODEL: 'bad model!' }]) {
      expect(createProvider(makeConfig(env), stubFetch().fn, publicResolver).isConfigured()).toBe(false)
    }
  })
})
