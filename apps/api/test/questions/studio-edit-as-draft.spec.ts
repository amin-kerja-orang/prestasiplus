import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { loginAs, bootQuestionsApp, type Client, type QuestionsTestApp } from './helpers'
import { tagOf, type Tag } from './fixtures'

/**
 * T13b: "Edit sebagai draf" writes version n+1 with `PUT /api/questions/:id` and a minimal body (the four required fields and
 * the stored parts). Version n+1 must equal the live version in everything the Studio model cannot round-trip: `reveal`, a
 * leaf `stimulusId`-less tree, short_text caseSensitive/anyOrder, numeric tolKind/sigFigs/decimals, several numeric values, the
 * per-leaf TP, the question TP and the number label.
 */
describe('Studio edit-as-draft: version n+1 equals the live version', () => {
  let t: QuestionsTestApp
  let admin: Client
  let tag: Tag

  beforeAll(async () => {
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
  })
  afterAll(async () => {
    await t.close()
  })

  const parts = [
    {
      label: 'a',
      prompt: { ms: 'Nyatakan jawapan pendek.', en: 'State the short answer.' },
      mode: 'short_text',
      marks: 2,
      reveal: 'never',
      difficultyTp: 2,
      cognitiveLevel: 'memahami',
      kbat: 'bukan',
      key: { kind: 'accepted', values: ['Ya', 'ya betul'], caseSensitive: true, anyOrder: true },
    },
    {
      label: 'b',
      prompt: { ms: 'Berapakah nilainya?' },
      mode: 'numeric',
      marks: 3,
      difficultyTp: 4,
      cognitiveLevel: 'menganalisis',
      kbat: 'menganalisis',
      key: { kind: 'accepted', values: [{ v: 12.5, tol: 5, tolKind: 'rel', unit: 'ohm', unitAlt: ['Ω'], sigFigs: 3 }, { v: 13, decimals: 1 }] },
    },
  ]

  it('keeps every field the editor cannot hold', async () => {
    const created = await admin.post('/api/questions', {
      subjectId: tag.subjectId,
      educationLevelId: tag.levelId,
      difficultyLevel: 3,
      questionType: 'essay',
      questionText: 'Berdasarkan Rajah 1, jawab soalan berikut dengan teliti.',
      parts,
      tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 4 },
      numberLabel: '7',
      kertas: '2',
      explanation: 'Penjelasan asal.',
    })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const id = created.body.data.id as string
    // Approved state is written directly (as other specs do): this question has no image for the part that needs one, so the T45 approve gate
    // (AC-05.3) would refuse it, and approved-but-unservable rows exist in real data. The test is about Edit sebagai draf, not about approval.
    await t.db.query(`update question_versions set status = 'approved', published_at = now() where question_id = $1`, [id])
    await t.db.query(`update questions set live_version_no = 1 where id = $1`, [id])
    const live = (await admin.get(`/api/questions/${id}`)).body.data as Record<string, unknown>
    expect(live.status).toBe('approved')

    // The body `editAsDraftBody` (src/modules/m04-question-bank/lib/studio/draft.ts) builds.
    const put = await admin.put(`/api/questions/${id}`, {
      subjectId: live.subjectId,
      educationLevelId: live.educationLevelId,
      difficultyLevel: live.difficultyLevel,
      questionText: live.questionText,
      parts: live.parts,
    })
    expect(put.status, JSON.stringify(put.body)).toBe(200)

    const versions = await t.db.query<{ version_no: number; status: string }>(
      'select version_no, status from question_versions where question_id = $1 order by version_no',
      [id],
    )
    expect(versions.map((v) => [v.version_no, v.status])).toEqual([[1, 'approved'], [2, 'draft']])

    const next = (await admin.get(`/api/questions/${id}`)).body.data as Record<string, unknown>
    expect(next.status).toBe('draft')
    const volatile = new Set(['status', 'complianceStatus', 'versionNo', 'updatedAt', 'createdAt', 'publishedAt', 'liveVersionNo', 'latestVersionNo', 'version'])
    const strip = (q: Record<string, unknown>) => Object.fromEntries(Object.entries(q).filter(([k]) => !volatile.has(k)))
    expect(strip(next)).toEqual(strip(live))
    expect(next.parts).toEqual(parts)
  })
})
