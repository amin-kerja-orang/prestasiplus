import { afterEach, describe, expect, it } from 'vitest'

import { blankQuestion } from '../admin/intake/domain/blank'
import { defToIntake, intakeToDef } from '../admin/intake/domain/convert'
import type { IntakeQuestion, ManualMeta } from '../admin/intake/types'
import { BANK } from '../data/registry'
import type { QuestionDef, SchemeDef } from '../domain/types'
import { BijakServer, MemoryStorage } from '../server/store'
import { MAT_T4_SP2, matTag } from './tag-fixtures'

const meta: ManualMeta = {
  subject: 'MAT',
  kertas: 2,
  year: 2026,
  paperType: 'Soalan Umum',
  source: 'Latihan sekolah fiksyen',
  copyright: 'sendiri',
  notes: '',
}

function make(storage = new MemoryStorage()) {
  const now = { t: 1_800_000_000_000 }
  return { server: new BijakServer({ storage, now: () => now.t }), storage, now }
}

const tag = (spIds = [MAT_T4_SP2]) => matTag({ tp: 2, spIds })

/** An objektif question with options A-D and key B. */
function mcq(q: IntakeQuestion): IntakeQuestion {
  return {
    ...q,
    type: 'mcq',
    stem: 'Nilai $2 + 3$ ialah',
    options: ['4', '5', '6', '7'].map((text, i) => ({ id: 'ABCD'[i]!, text })),
    marks: 1,
    scheme: { kind: 'option', marks: 1, correct: 'B', reason: '2 + 3 = 5' },
    tag: tag(),
  }
}

/** A structured question with one part and a K1 N1 scheme. */
function structured(q: IntakeQuestion): IntakeQuestion {
  return {
    ...q,
    type: 'structured',
    stem: 'Diberi $x = 4$.',
    parts: [
      {
        id: 'part-a',
        label: '(a)',
        prompt: 'Hitung $2x$.',
        marks: 2,
        mode: 'working',
        scheme: {
          kind: 'points',
          marks: 2,
          points: [
            { id: 'a1', code: 'K', marks: 1, label: 'Mendarab 2 dengan x', match: { type: 'step', accept: ['2*4'] } },
            { id: 'a2', code: 'N', marks: 1, label: 'Jawapan betul', match: { type: 'final' } },
          ],
          final: { accept: ['8'], display: '8' },
        },
      },
    ],
    marks: 2,
    tag: tag(),
  }
}

// The bank is a shared in-memory registry; put it back so other tests see the seed content.
const snapshot = {
  questions: new Map(BANK.questions),
  schemes: new Map(BANK.schemes),
  stimuli: new Map(BANK.stimuli),
  groups: new Map(BANK.groups),
}
afterEach(() => {
  for (const [k, m] of [
    ['questions', BANK.questions],
    ['schemes', BANK.schemes],
    ['stimuli', BANK.stimuli],
    ['groups', BANK.groups],
  ] as const) {
    m.clear()
    for (const [id, v] of snapshot[k] as Map<string, never>) (m as Map<string, never>).set(id, v)
  }
})

describe('manual batch (no file)', () => {
  it('is created without a file, as source kind manual, with one empty question', async () => {
    const { server } = make()
    const b = await server.createManualBatch(1, { ...meta, forPaperId: 'kp-seed-1' })
    expect(b).toMatchObject({
      sourceKind: 'manual',
      status: 'draf',
      fileName: '',
      fileHash: '',
      pageCount: 0,
      pages: [],
      stimuli: [],
      provider: 'manual',
      forPaperId: 'kp-seed-1',
    })
    expect(b.questions).toHaveLength(1)
    expect(b.questions[0]).toMatchObject({ label: '1', stem: '', type: 'short' })

    const row = (await server.listIntakeBatches()).find((x) => x.id === b.id)!
    expect(row).toMatchObject({ sourceKind: 'manual', questionCount: 1, status: 'draf' })
    // the demo batch (an upload) keeps its kind
    expect((await server.listIntakeBatches()).find((x) => x.id === 'ek-demo-1')!.sourceKind).toBe('pdf')
    expect(await server.listIntakeBatches({ q: 'manual' })).toHaveLength(1)
  })

  it('finds a draft paper from Pembina Kertas in the admin list (the paper link of a manual batch)', async () => {
    const { server } = make()
    const paperId = await server.createPaper({ subject: 'MAT', kertas: 2 })
    const admin = await server.listAdminPapers()
    expect(admin.some((p) => p.id === paperId)).toBe(true)
    // the student list holds published papers only
    expect((await server.listPapers(1)).some((p) => p.id === paperId)).toBe(false)
    const b = await server.createManualBatch(1, { ...meta, forPaperId: paperId })
    expect(b.forPaperId).toBe(paperId)
  })

  it('cannot be submitted while the question is empty (same gate as an extracted batch)', async () => {
    const { server } = make()
    const b = await server.createManualBatch(1, meta)
    const res = await server.submitForReview(b.id)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.issues.some((i) => i.message === 'Teks soalan kosong.')).toBe(true)
    expect((await server.getIntakeBatch(b.id)).status).toBe('draf')
    expect((await server.listReviewQueue()).items.some((i) => i.key.startsWith(b.id))).toBe(false)
  })

  it('goes through the gate into the review queue, then publishes to the bank on approval', async () => {
    const { server, storage } = make()
    const b = await server.createManualBatch(1, meta)
    const q1 = mcq(b.questions[0]!)
    const q2 = structured({ ...blankQuestion('MAT', 2), label: '2' })
    await server.saveExtracted(b.id, { questions: [q1, q2], stimuli: [] })

    const before = (await server.listReviewQueue()).counts.semakan
    const sent = await server.submitForReview(b.id)
    expect(sent.ok).toBe(true)
    // read-only after submit
    await expect(server.saveExtracted(b.id, { questions: [q1], stimuli: [] })).rejects.toMatchObject({
      code: 'bad_request',
    })

    const queue = await server.listReviewQueue()
    expect(queue.counts.semakan).toBe(before + 2)
    const mine = queue.items.filter((i) => i.key.startsWith(b.id))
    expect(mine.map((i) => [i.kind, i.marks, i.subject, i.kertas])).toEqual(
      expect.arrayContaining([
        ['objektif', 1, 'MAT', 2],
        ['berstruktur', 2, 'MAT', 2],
      ]),
    )
    expect(mine[0]!.source).toContain('Manual')

    // not served to students until approved
    const idMcq = mine.find((i) => i.kind === 'objektif')!.questionIds[0]!
    expect(BANK.questions.has(idMcq)).toBe(false)
    expect((await server.listBank({ status: 'terbit', q: idMcq })).length).toBe(0)

    const detail = await server.getReviewItem(mine.find((i) => i.kind === 'objektif')!.key)
    expect(detail.gate).toEqual([])
    expect(detail.questions[0]!.mcq?.correct).toBeTruthy()

    for (const it of mine) expect((await server.reviewDecision(it.key, { action: 'terbit' })).ok).toBe(true)
    const bank = await server.listBank({ status: 'terbit', subject: 'MAT', kertas: 2 })
    expect(bank.filter((r) => r.id.startsWith(b.id))).toHaveLength(2)
    expect(BANK.schemes.get(idMcq)).toMatchObject({ kind: 'option', marks: 1 })

    // survives a refresh (units and decisions are persisted)
    const again = new BijakServer({ storage })
    expect(
      (await again.listBank({ status: 'terbit', subject: 'MAT', kertas: 2 })).filter((r) =>
        r.id.startsWith(b.id),
      ),
    ).toHaveLength(2)
  })

  it('an extracted batch with a stimulus group becomes one unit per group', async () => {
    const { server } = make()
    const b = await server.getIntakeBatch('ek-demo-1')
    const fixed = b.questions.map((x) => ({
      ...x,
      confirmed: [...x.lowFields],
      tag: matTag({ subject: x.tag.subject }),
    }))
    await server.saveExtracted(b.id, {
      questions: fixed,
      stimuli: b.stimuli.map((s) => ({ ...s, alt: s.alt || 'Rajah segi tiga' })),
    })
    expect((await server.submitForReview(b.id)).ok).toBe(true)
    const mine = (await server.listReviewQueue()).items.filter((i) => i.key.startsWith('ek-demo-1'))
    expect(mine).toHaveLength(4)
    const group = mine.find((i) => i.groupId)!
    expect(group.questionIds).toHaveLength(2)
    expect((await server.getReviewItem(group.key)).stimulus?.label).toBe('Rajah 1')
  })
})

describe('full revise from the bank', () => {
  it('Sunting opens the whole question: options, key, scheme and tag', async () => {
    const { server } = make()
    const e = await server.getBankEditable('mat1-pub-1')
    expect(e.question.type).toBe('mcq')
    expect(e.question.options.map((o) => o.id)).toEqual(['A', 'B', 'C', 'D'])
    expect(e.question.scheme).toMatchObject({ kind: 'option' })
    expect('legacyTag' in e).toBe(false)
    expect(e.pendingRevision).toBe(false)
  })

  it('creates version n+1, the live version keeps serving, approve swaps it', async () => {
    const { server } = make()
    const id = 'mat1-pub-1'
    const e = await server.getBankEditable(id)
    const liveKey = BANK.schemes.get(id)
    const edited: IntakeQuestion = {
      ...e.question,
      stem: 'Selesaikan $3x - 5 = 10$ bagi $x$.',
      options: e.question.options.map((o, i) => (i === 2 ? { ...o, text: '$x = 4$' } : o)),
      // a different key
      scheme: { kind: 'option', marks: 1, correct: 'C', reason: 'Kunci diubah' },
    }
    const res = await server.reviseQuestionFull(id, edited, undefined, 'Tukar kunci')
    expect(res).toEqual({ ok: true, errors: [] })

    // live version unchanged and still version 1
    const live = await server.getBankDetail(id)
    expect(live.row.version).toBe(1)
    expect(live.question.stem).toBe('Selesaikan $3x - 5 = 10$.')
    expect(BANK.schemes.get(id)).toBe(liveKey)
    expect((await server.getBankEditable(id)).pendingRevision).toBe(true)

    // version 2 waits in the queue with the whole new content
    const item = (await server.listReviewQueue()).items.find((i) => i.key === `v:${id}`)!
    expect(item).toMatchObject({ isRevision: true, version: 2, kind: 'objektif' })
    const detail = await server.getReviewItem(`v:${id}`)
    expect(detail.fullEdit).toBe(true)
    expect(detail.gate).toEqual([])
    expect(detail.liveStem).toBe('Selesaikan $3x - 5 = 10$.')
    expect(detail.questions[0]!.stem).toContain('bagi $x$')
    expect(detail.questions[0]!.mcq?.correct).toContain('mat1-pub-1-o3')

    // a second revision is refused while one waits
    expect((await server.reviseQuestionFull(id, edited, undefined, '')).ok).toBe(false)

    expect((await server.reviewDecision(`v:${id}`, { action: 'terbit' })).ok).toBe(true)
    const after = await server.getBankDetail(id)
    expect(after.row.version).toBe(2)
    expect(after.question.stem).toContain('bagi $x$')
    expect(after.history.map((h) => h.action).join('|')).toContain('Diarkibkan (digantikan)')
    const key = BANK.schemes.get(id)
    expect(key?.kind === 'option' && key.correct).toBe('mat1-pub-1-o3')
    expect((await server.getBankEditable(id)).pendingRevision).toBe(false)
  })

  it('a rejected revision does not reuse its version number, and a stem-only edit keeps the full edit', async () => {
    const { server, storage } = make()
    const id = 'mat1-pub-1'
    const e = await server.getBankEditable(id)
    const edited = { ...e.question, stem: 'Selesaikan $3x - 5 = 10$ bagi $x$.' }
    expect((await server.reviseQuestionFull(id, edited, undefined, '')).ok).toBe(true)
    expect((await server.reviewDecision(`v:${id}`, { action: 'tolak', reason: 'Kurang jelas' })).ok).toBe(true)
    expect((await server.reviseQuestionFull(id, edited, undefined, '')).ok).toBe(true)
    const item = (await server.listReviewQueue()).items.find((i) => i.key === `v:${id}`)!
    expect(item.version).toBe(3)
    expect((await server.reviewDecision(`v:${id}`, { action: 'terbit' })).ok).toBe(true)

    // stem-only edit after the full edit: the options of the full edit survive a reload
    expect((await server.reviseQuestion(id, 'Teks baharu sahaja.', '')).ok).toBe(true)
    expect((await server.reviewDecision(`v:${id}`, { action: 'terbit' })).ok).toBe(true)
    const again = new BijakServer({ storage, now: () => 1_800_000_000_000 })
    const d = await again.getBankDetail(id)
    expect(d.question.stem).toBe('Teks baharu sahaja.')
    expect(d.row.version).toBe(4)
  })

  it('applies the same gate: an empty option or a missing key is refused', async () => {
    const { server } = make()
    const e = await server.getBankEditable('mat1-pub-2')
    const blank = { ...e.question, options: e.question.options.map((o, i) => (i === 0 ? { ...o, text: '' } : o)) }
    const r1 = await server.reviseQuestionFull('mat1-pub-2', blank, undefined, '')
    expect(r1.ok).toBe(false)
    expect(r1.errors.join('|')).toContain('pilihan jawapan yang kosong')
    const nokey = { ...e.question, scheme: undefined }
    const r2 = await server.reviseQuestionFull('mat1-pub-2', nokey, undefined, '')
    expect(r2.errors.join('|')).toContain('Kunci jawapan belum dipilih')
    expect((await server.getBankEditable('mat1-pub-2')).pendingRevision).toBe(false)
  })

  it('refuses a question that is not Terbit', async () => {
    const { server } = make()
    await expect(server.getBankEditable('mat1-rev-1')).rejects.toMatchObject({ code: 'bad_request' })
    const e = mcq(blankQuestion('MAT', 1))
    expect((await server.reviseQuestionFull('mat1-rev-1', e, undefined, '')).ok).toBe(false)
  })

  it('persists a full edit across a refresh (live content is re-applied)', async () => {
    const { server, storage } = make()
    const id = 'mat1-pub-2'
    const e = await server.getBankEditable(id)
    await server.reviseQuestionFull(id, { ...e.question, stem: 'Min bagi 4, 6, 8, 10 dan 12 ialah' }, undefined, '')
    await server.reviewDecision(`v:${id}`, { action: 'terbit' })
    BANK.questions.set(id, snapshot.questions.get(id)!) // simulate a fresh tab
    const again = new BijakServer({ storage })
    expect((await again.getBankDetail(id)).question.stem).toBe('Min bagi 4, 6, 8, 10 dan 12 ialah')
    expect((await again.getBankDetail(id)).row.version).toBe(2)
  })
})

describe('intake and bank question conversion', () => {
  it('round-trips every bank question through the editor shape without losing content', () => {
    const schemeOf = (id: string): SchemeDef | undefined => BANK.schemes.get(id)
    const strip = (q: QuestionDef): unknown => JSON.parse(JSON.stringify(q))
    let checked = 0
    for (const q of BANK.questions.values()) {
      const intake = defToIntake(q, schemeOf, '1', q.groupId)
      const back = intakeToDef(intake, {
        qid: q.id,
        ...(q.groupId ? { groupId: q.groupId } : {}),
        newPartId: (j) => `${q.id}-n${j}`,
      })
      const a = strip(q) as QuestionDef
      const b = strip(back.question) as QuestionDef
      // option ids are re-derived from the position; compare everything else as is
      if (a.mcq) a.mcq.options = a.mcq.options.map((o, i) => ({ ...o, id: String(i) }))
      if (b.mcq) b.mcq.options = b.mcq.options.map((o, i) => ({ ...o, id: String(i) }))
      // a short answer without parts is stored as one unlabelled leaf
      expect(b.stem).toBe(a.stem)
      expect(b.mcq).toEqual(a.mcq)
      expect(b.curriculum).toEqual(a.curriculum)
      expect(b.groupId).toBe(a.groupId)
      expect(b.parts).toEqual(a.parts)
      checked += 1
    }
    expect(checked).toBeGreaterThan(20)
  })

  it('keeps unit and word range of a question without parts through a full edit', () => {
    const none = (): SchemeDef | undefined => undefined
    const num: QuestionDef = {
      id: 'qx-1',
      curriculum: blankQuestion('MAT', 1).tag,
      stem: 'Hitung luas.',
      parts: [
        { id: 'qx-1-ans', label: '', prompt: '', marks: 2, answer: { kind: 'numeric', unit: 'cm' } },
      ],
    }
    const essay: QuestionDef = {
      id: 'qx-2',
      curriculum: blankQuestion('MAT', 2).tag,
      stem: 'Tulis esei.',
      parts: [
        {
          id: 'qx-2-ans',
          label: '',
          prompt: '',
          marks: 10,
          answer: { kind: 'essay', wordRange: { min: 120, max: 200 } },
        },
      ],
    }
    for (const [q, key] of [
      [num, 'unit'],
      [essay, 'wordRange'],
    ] as const) {
      const intake = defToIntake(q, none)
      expect(intake[key]).toEqual(q.parts![0]!.answer![key])
      const back = intakeToDef(intake, { qid: q.id, newPartId: (j) => `${q.id}-n${j}` })
      expect(back.question.parts![0]!.answer).toEqual(q.parts![0]!.answer)
    }
  })
})
