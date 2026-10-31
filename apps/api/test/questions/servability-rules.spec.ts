import { describe, expect, it } from 'vitest'
import { SERVABILITY_ACTIVITIES, SERVABILITY_REASON_MS } from '@pp/contract'

import { SERVABLE_STATUSES, evaluate, evaluateAll } from '../../src/modules/questions/serving'
import type { ServabilityFacts } from '../../src/modules/questions/serving'
import type { QuestionRecord } from '../../src/modules/questions'

/** Unit (no DB): the pure rules over hand-made facts. The parity against the real readers is `servability-parity.spec.ts`. */
const mcqPart = {
  label: '',
  prompt: { ms: 'Soalan?' },
  mode: 'mcq',
  marks: 1,
  options: ['A', 'B', 'C', 'D'].map((label) => ({ label, body: { ms: label } })),
  key: { kind: 'option', correct: 'A' },
}

function record(over: Record<string, unknown> = {}, version: Record<string, unknown> = {}): QuestionRecord {
  return {
    id: '10',
    isActive: true,
    latestVersionNo: 1,
    liveVersionNo: 1,
    groupId: null,
    groupPosition: null,
    spmPool: false,
    pksk: null,
    version: {
      versionNo: 1,
      status: 'published',
      type: 'mcq',
      stemMs: 'Soalan?',
      educationLevelId: '4',
      subjectId: '3',
      chapterId: '7',
      stimulusIds: [],
      publishedAt: new Date('2026-01-01T00:00:00Z'),
      spIds: [],
      formOrigin: 't4',
      difficultyTp: 3,
      explanationMs: null,
      unitId: null,
      parts: [mcqPart],
      ...version,
    },
    ...over,
  } as unknown as QuestionRecord
}

function facts(over: Partial<ServabilityFacts> = {}): ServabilityFacts {
  const live = record()
  return {
    live,
    latest: live,
    level: { id: '4', code: 'T4', stage: 'upper_secondary', isActive: true },
    subject: { id: '3', isActive: true, linkedToLevel: true, spmListed: true, databankListed: true },
    group: null,
    linkedAssets: new Map(),
    fileTokens: new Map(),
    onPublishedPaper: false,
    janaFacts: null,
    ...over,
  }
}

const codes = (f: ServabilityFacts, a: (typeof SERVABILITY_ACTIVITIES)[number]) => evaluate(f, a).reasons.map((r) => r.code)

describe('servability rules (pure)', () => {
  it('serves a plain text MCQ in Databank, Latih Tubi SPM, Bab and Simulasi Kuiz', () => {
    const f = facts()
    for (const a of ['databank', 'latih_tubi_spm', 'bab', 'simulasi_kuiz'] as const) expect(evaluate(f, a).served, a).toBe(true)
  })

  it('accepts both approved and published until T04 removes published (TODO T04)', () => {
    expect(SERVABLE_STATUSES).toEqual(['approved', 'published'])
    const approved = record({}, { status: 'approved' })
    expect(evaluate(facts({ live: approved, latest: approved }), 'bab').served).toBe(true)
    const review = record({}, { status: 'review' })
    expect(codes(facts({ live: review, latest: review }), 'bab')).toEqual(['not_approved'])
  })

  it('says why when nothing is live: not approved, or archived', () => {
    const draft = record({ liveVersionNo: null }, { status: 'draft' })
    expect(codes(facts({ live: null, latest: draft }), 'databank')).toEqual(['not_approved'])
    const archived = record({ liveVersionNo: null }, { status: 'archived' })
    expect(codes(facts({ live: null, latest: archived }), 'databank')).toEqual(['archived'])
  })

  it('a withdrawn (inactive) question is not drawn, but a published paper still serves it (the paper is the authority)', () => {
    const inactive = record({ isActive: false })
    const f = facts({ live: inactive, latest: inactive, onPublishedPaper: true })
    expect(codes(f, 'latih_tubi_spm')).toEqual(['withdrawn'])
    expect(codes(f, 'jana_kertas')).toEqual(['withdrawn'])
    expect(evaluate(f, 'simulasi_paper').served).toBe(true)
  })

  it('level rules: inactive level, primary level, and a level the SPM activities do not offer (Bab does not mind)', () => {
    expect(codes(facts({ level: { id: '4', code: 'T4', stage: 'upper_secondary', isActive: false } }), 'bab')).toEqual(['level_inactive'])
    expect(codes(facts({ level: { id: '1', code: 'D1', stage: 'primary', isActive: true } }), 'bab')).toEqual(['level_primary'])
    const t3 = facts({ level: { id: '3', code: 'T3', stage: 'lower_secondary', isActive: true } })
    expect(codes(t3, 'latih_tubi_spm')).toEqual(['level_not_offered'])
    expect(evaluate(t3, 'bab').served).toBe(true)
  })

  it('subject rules: unlinked or inactive subject, and the Databank list narrower than the Latih Tubi list', () => {
    expect(codes(facts({ subject: { id: '3', isActive: true, linkedToLevel: false, spmListed: true, databankListed: true } }), 'latih_tubi_spm')).toEqual(['subject_unavailable'])
    const noDatabank = facts({ subject: { id: '3', isActive: true, linkedToLevel: true, spmListed: true, databankListed: false } })
    expect(codes(noDatabank, 'databank')).toEqual(['subject_not_listed'])
    expect(evaluate(noDatabank, 'latih_tubi_spm').served).toBe(true)
  })

  it('Bab needs a chapter; text-only shape reasons are classified (D87 U2)', () => {
    const noChapter = record({}, { chapterId: null })
    expect(codes(facts({ live: noChapter, latest: noChapter }), 'bab')).toEqual(['no_chapter'])
    const grouped = record({ groupId: '5' })
    expect(codes(facts({ live: grouped, latest: grouped }), 'bab')).toEqual(['has_stimulus'])
    const withImage = record({}, { parts: [{ ...mcqPart, options: mcqPart.options.map((o, i) => ({ ...o, imageId: i === 0 ? '9' : null })) }] })
    expect(codes(facts({ live: withImage, latest: withImage }), 'bab')).toEqual(['has_option_image'])
    const structured = record({}, { type: 'structured', parts: [mcqPart, mcqPart] })
    expect(codes(facts({ live: structured, latest: structured }), 'bab')).toEqual(['shape_unsupported'])
  })

  it('Simulasi (kertas) needs a published paper and the bridge to accept the question', () => {
    expect(codes(facts(), 'simulasi_paper')).toEqual(['not_on_published_paper'])
    expect(evaluate(facts({ onPublishedPaper: true }), 'simulasi_paper').served).toBe(true)
  })

  it('every reason comes with its BM sentence from the one copy table, and the report counts served activities', () => {
    const report = evaluateAll(facts({ onPublishedPaper: true }))
    expect(report.total).toBe(SERVABILITY_ACTIVITIES.length)
    expect(report.servedCount).toBe(report.activities.filter((a) => a.served).length)
    const draft = record({ liveVersionNo: null }, { status: 'draft' })
    const r = evaluate(facts({ live: null, latest: draft }), 'bab').reasons[0]
    expect(r?.message).toBe(SERVABILITY_REASON_MS.not_approved)
  })
})
