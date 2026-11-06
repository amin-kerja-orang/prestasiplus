import { describe, expect, it } from 'vitest'

import { Prisma } from '../../src/db/generated/client'
import { PracticeAssignmentsAdapter } from '../../src/modules/classes/missions/practice-assignments.adapter'
import { toPersonalQuestion, PersonalQuestionsService } from '../../src/modules/classes/teacher-tools/personal-questions.service'
import { QuestionsRepository } from '../../src/modules/questions/questions.repository'

/**
 * S6-T16 (API-GUR-24, FR-GUR-44a-*): service rules with fakes (no database) and the SQL of the mission draw. The database twin of the draw is
 * `personal-questions-draw.spec.ts` (Docker).
 */
type Hooks = { guard?: (tx: unknown) => Promise<void>; cleanup?: (tx: unknown) => Promise<void>; after?: (tx: unknown, id: string) => Promise<void> }
const TX = { tx: true }
const actor = (userId: string) => ({ userId, role: 'teacher', schoolId: null, auth: { sessionRowId: 's', active: { scope: { level: 'school' } } }, requestId: null, ip: null }) as never

const body = (over: Record<string, unknown> = {}) => ({
  subjectId: '1',
  educationLevelId: '4',
  difficulty: 3,
  text: 'Berapakah 2 + 2?',
  options: [{ text: '3' }, { text: '4' }, { text: '5' }, { text: '6' }],
  correctIndex: 1,
  ...over,
})

function harness(opts: { facts?: { hasChapters: boolean; hasDskpNodes: boolean }; used?: boolean; open?: boolean; owned?: Record<string, string> } = {}) {
  const calls: { created: unknown[]; rewritten: unknown[]; removed: string[]; audit: string[]; auditIn: { tx: boolean; details: unknown }[]; revisionDropped: string[] } = { created: [], rewritten: [], removed: [], audit: [], auditIn: [], revisionDropped: [] }
  const stored = new Map<string, unknown>()
  const owned = opts.owned ?? { '10': '7' } // question id -> owner
  const repo = {
    ownVersionNo: (owner: string, id: string) => Promise.resolve(owned[id] === owner ? 1 : null),
    activeSubject: (id: string) => Promise.resolve(id === '1' ? { id: 1n } : null),
    activeTingkatan: (id: string) => Promise.resolve(id === '4' ? { id: 4n } : null),
    dskpFacts: () => Promise.resolve(opts.facts ?? { hasChapters: false, hasDskpNodes: false }),
    chapter: (id: string) => Promise.resolve(id === '50' ? { id: 50n, subjectId: 1n, educationLevelId: 4n } : id === '51' ? { id: 51n, subjectId: 2n, educationLevelId: 4n } : null),
    countSpNodes: (ids: bigint[]) => Promise.resolve(ids.filter((i) => i < 100n).length),
    usedByActiveMission: () => Promise.resolve(opts.used === true),
    heldByOpenSession: () => Promise.resolve(opts.open === true),
    dropRevisionRows: (id: string) => (calls.revisionDropped.push(id), Promise.resolve()),
    subjectNames: () => Promise.resolve(new Map([['1', 'Matematik']])),
    records: (ids: string[]) => Promise.resolve(ids.flatMap((id) => (stored.has(id) ? [stored.get(id)] : [])) as never),
    page: () => Promise.resolve({ ids: ['10'], total: 1 }),
  }
  const record = (id: string, w: Record<string, unknown>) => ({
    id,
    createdAt: new Date('2026-11-05T02:00:00Z'),
    version: {
      subjectId: '1', educationLevelId: '4', difficultyLevel: w.difficulty, difficultyTp: w.tp ?? w.difficulty, stemMs: w.text, chapterId: w.chapterId ?? null, spIds: w.spIds ?? [],
      referenceUrl: w.referenceUrl ?? null,
      parts: [{ mode: 'mcq', options: (w.options as { text: string }[]).map((o) => ({ body: { ms: o.text } })), key: { kind: 'option', correct: 'ABCD'[w.correctIndex as number] } }],
    },
  })
  stored.set('10', record('10', body()))
  const questions = {
    createPersonal: async (w: Record<string, unknown>, _o: string, hooks: Hooks) => (calls.created.push(w), stored.set('11', record('11', w)), await hooks.after?.(TX, '11'), '11'),
    rewritePersonal: async (id: string, _v: number, w: Record<string, unknown>, _o: string, hooks: Hooks) => {
      await hooks.guard?.(TX) // the real one runs it after the row lock, inside the transaction
      calls.rewritten.push(w)
      stored.set(id, record(id, w))
      await hooks.after?.(TX, id)
    },
    removePersonal: async (id: string, hooks: Hooks) => {
      await hooks.guard?.(TX)
      await hooks.cleanup?.(TX)
      calls.removed.push(id)
      await hooks.after?.(TX, id)
      return true
    },
  }
  const audit = { record: (a: { action: string; tx?: unknown; details?: unknown }) => (calls.audit.push(a.action), calls.auditIn.push({ tx: a.tx === TX, details: a.details }), Promise.resolve()) }
  const clock = { now: () => new Date('2026-11-05T02:00:00Z') }
  return { svc: new PersonalQuestionsService(repo as never, questions as never, audit as never, clock as never), calls }
}

const fieldsOf = async (p: Promise<unknown>): Promise<Record<string, string>> => {
  try {
    await p
  } catch (e) {
    return ((e as { fields?: Record<string, string> }).fields ?? {}) as Record<string, string>
  }
  return {}
}

describe('API-GUR-24: create, read, edit', () => {
  it('AC-GUR-44a-1: saves the question with the link and lists it with the stored correct option', async () => {
    const h = harness()
    const row = await h.svc.create(actor('7'), body({ correctIndex: 1, referenceUrl: 'https://example.org/rujukan' }))
    expect(row).toMatchObject({ id: '11', subjectName: 'Matematik', correctIndex: 1, referenceUrl: 'https://example.org/rujukan', difficulty: 3, tp: null })
    expect(row.createdAt).toBe('2026-11-05T10:00:00.000+08:00')
    expect(h.calls.created[0]).toMatchObject({ referenceUrl: 'https://example.org/rujukan', chapterId: null, spIds: [] })
    expect(h.calls.audit).toEqual(['classes.personal_question.created'])
  })

  it('stores the scheme in lower case and an empty link as none', async () => {
    const h = harness()
    await h.svc.create(actor('7'), body({ referenceUrl: 'HTTPS://Example.org/A' }))
    await h.svc.create(actor('7'), body({ referenceUrl: '  ' }))
    expect(h.calls.created).toMatchObject([{ referenceUrl: 'https://Example.org/A' }, { referenceUrl: null }])
  })

  it('AC-GUR-44a-3 / 8: javascript:, ftp: and data: links are 422 on referenceUrl and nothing is saved', async () => {
    const h = harness()
    for (const bad of ['javascript:alert(1)', 'ftp://contoh', 'data:text/html,x']) {
      expect(await fieldsOf(h.svc.create(actor('7'), body({ referenceUrl: bad })))).toEqual({ referenceUrl: 'Pautan mesti bermula dengan http:// atau https://.' })
    }
    expect(await fieldsOf(h.svc.create(actor('7'), body({ referenceUrl: `https://a.my/${'x'.repeat(2048)}` })))).toEqual({ referenceUrl: 'Pautan tidak boleh melebihi 2048 aksara.' })
    expect(h.calls.created).toHaveLength(0)
  })

  it('AC-GUR-44a-2 / FR-GUR-44a-5: BM messages, Tingkatan only, unknown keys refused', async () => {
    const h = harness()
    expect(await fieldsOf(h.svc.create(actor('7'), body({ text: '' })))).toEqual({ text: 'Sila isi teks soalan.' })
    expect(await fieldsOf(h.svc.create(actor('7'), body({ subjectId: '999' })))).toEqual({ subjectId: 'Sila pilih subjek.' })
    expect(await fieldsOf(h.svc.create(actor('7'), body({ educationLevelId: '2' })))).toEqual({ educationLevelId: 'Sila pilih tingkatan.' })
    expect(await fieldsOf(h.svc.create(actor('7'), body({ options: [{ text: 'a' }, { text: 'b' }, { text: '' }, { text: 'd' }] })))).toEqual({ options: 'Sila isi pilihan C.' })
    expect(await fieldsOf(h.svc.create(actor('7'), body({ owner: '1' })))).toHaveProperty('owner')
    expect(h.calls.created).toHaveLength(0)
  })

  it('AC-GUR-44a-7: the DSKP fields are required only where the Subjek + Tingkatan has them (D112)', async () => {
    const none = harness()
    await none.svc.create(actor('7'), body())
    expect(none.calls.created).toHaveLength(1)

    const some = harness({ facts: { hasChapters: true, hasDskpNodes: true } })
    expect(await fieldsOf(some.svc.create(actor('7'), body()))).toEqual({
      chapterId: 'Sila pilih bab.',
      spIds: 'Sila pilih Standard Pembelajaran (SP).',
      tp: 'Sila pilih TP.',
      cognitiveLevel: 'Sila pilih aras pemikiran.',
    })
    expect(await fieldsOf(some.svc.create(actor('7'), body({ chapterId: '51', spIds: ['3'], tp: 3, cognitiveLevel: 'memahami' })))).toEqual({ chapterId: 'Bab tidak sepadan dengan subjek dan tingkatan.' })
    expect(await fieldsOf(some.svc.create(actor('7'), body({ chapterId: '50', spIds: ['300'], tp: 3, cognitiveLevel: 'memahami' })))).toEqual({ spIds: 'SP tidak sah.' })
    const row = await some.svc.create(actor('7'), body({ chapterId: '50', spIds: ['3'], tp: 4, cognitiveLevel: 'memahami' }))
    expect(row).toMatchObject({ chapterId: '50', spIds: ['3'], tp: 4 })
  })

  it('edits an own question in place', async () => {
    const h = harness()
    const row = await h.svc.update(actor('7'), '10', body({ text: 'Teks baharu' }))
    expect(row.text).toBe('Teks baharu')
    expect(h.calls.audit).toEqual(['classes.personal_question.updated'])
  })

  it('maps the stored rows to the wire shape', () => {
    const rec = { id: '5', createdAt: new Date('2026-01-01T00:00:00Z'), version: { subjectId: '1', educationLevelId: '4', difficultyLevel: null, difficultyTp: 4, stemMs: 't', chapterId: null, spIds: [], referenceUrl: null, parts: [] } }
    expect(toPersonalQuestion(rec as never, 'X')).toMatchObject({ difficulty: 4, tp: null, options: [{ text: '' }, { text: '' }, { text: '' }, { text: '' }], correctIndex: 0 })
  })
})

describe('API-GUR-24: own only (FR-GUR-44a-1)', () => {
  it('another teacher\'s id, a bank id and an unknown id are 404 on get, put and delete', async () => {
    const h = harness()
    for (const id of ['10', '99']) {
      await expect(h.svc.get(actor('8'), id)).rejects.toMatchObject({ status: 404 })
      await expect(h.svc.update(actor('8'), id, body())).rejects.toMatchObject({ status: 404 })
      await expect(h.svc.remove(actor('8'), id)).rejects.toMatchObject({ status: 404 })
    }
    expect(h.calls.rewritten).toHaveLength(0)
    expect(h.calls.removed).toHaveLength(0)
    expect(await h.svc.get(actor('7'), '10')).toMatchObject({ id: '10' })
  })

  it('the 404 comes before the body is validated (no oracle through 422)', async () => {
    const h = harness()
    await expect(h.svc.update(actor('8'), '10', { bad: true })).rejects.toMatchObject({ status: 404 })
  })
})

describe('API-GUR-24: delete guard (ADD-21, AC-GUR-44a-9)', () => {
  it('409 "Soalan sedang digunakan dalam misi." while an active Misi draws it, and the question stays', async () => {
    const h = harness({ used: true })
    await expect(h.svc.remove(actor('7'), '10')).rejects.toMatchObject({ status: 409, message: 'Soalan sedang digunakan dalam misi.' })
    expect(h.calls.removed).toHaveLength(0)
  })

  it('deletes an own question that no active Misi holds, cleaning its Ulang Kaji rows and auditing in the same transaction', async () => {
    const h = harness()
    expect(await h.svc.remove(actor('7'), '10')).toEqual({ deleted: 1 })
    expect(h.calls.removed).toEqual(['10'])
    expect(h.calls.revisionDropped).toEqual(['10'])
    expect(h.calls.auditIn).toEqual([{ tx: true, details: {} }])
  })

  it('an OPEN practice session holding the question blocks DELETE and PUT with the same 409 (the guard runs inside the write)', async () => {
    const h = harness({ open: true })
    await expect(h.svc.remove(actor('7'), '10')).rejects.toMatchObject({ status: 409, message: 'Soalan sedang digunakan dalam misi.' })
    await expect(h.svc.update(actor('7'), '10', body())).rejects.toMatchObject({ status: 409, message: 'Soalan sedang digunakan dalam misi.' })
    expect(h.calls.removed).toHaveLength(0)
    expect(h.calls.rewritten).toHaveLength(0)
    expect(h.calls.revisionDropped).toHaveLength(0)
  })

  it('an active Misi blocks PUT as well', async () => {
    const h = harness({ used: true })
    await expect(h.svc.update(actor('7'), '10', body())).rejects.toMatchObject({ status: 409 })
  })

  it('the audit of a create/update carries the Subjek and Tingkatan ids (never the text), written with the transaction client', async () => {
    const h = harness()
    await h.svc.create(actor('7'), body())
    await h.svc.update(actor('7'), '10', body())
    expect(h.calls.auditIn).toEqual([
      { tx: true, details: { subjectId: '1', educationLevelId: '4' } },
      { tx: true, details: { subjectId: '1', educationLevelId: '4' } },
    ])
  })
})

describe('FR-GUR-44a-10: the mission draw', () => {
  const mission = (over: Record<string, unknown> = {}) => ({ id: '3', teacherId: '7', classroomId: null, missionType: 'latih_tubi', subjectId: '1', chapterId: null, questionCount: 10, coinsPerCorrect: 3, ...over })
  function adapter(levels: string[], emptyBab = false) {
    const draws: Record<string, unknown>[] = []
    const repo = { pupilLevelIds: () => Promise.resolve(levels) }
    // `emptyBab`: the bank has no question in the Bab (the existence draw, which has no owner, answers nothing).
    const pool = { draw: (f: Record<string, unknown>) => (draws.push(f), Promise.resolve(emptyBab && f.chapterId !== undefined && f.ownerPrivateUserId === undefined ? [] : ['1'])) }
    const a = new PracticeAssignmentsAdapter(repo as never, pool as never, {} as never)
    const run = (m: Record<string, unknown>) => (a as unknown as { missionQuestionIds(m: unknown, u: string): Promise<string[]> }).missionQuestionIds(m, '20')
    return { draws, run }
  }

  it('filters the bank by the pupil class Tingkatan and adds the OWNER personal questions of that Subjek + Tingkatan', async () => {
    const { draws, run } = adapter(['4'])
    await run(mission())
    expect(draws).toEqual([{ subjectId: '1', spmPool: true, educationLevelIds: ['4'], ownerPrivateUserId: '7' }])
  })

  it('a Bab with bank questions: the Bab bank part plus the personal questions, with the same Tingkatan filter', async () => {
    const { draws, run } = adapter(['4'])
    await run(mission({ chapterId: '9' }))
    expect(draws).toEqual([
      { subjectId: '1', chapterId: '9', educationLevelIds: ['4'] }, // does the Bab have a bank question? (bank only)
      { subjectId: '1', chapterId: '9', educationLevelIds: ['4'], ownerPrivateUserId: '7' },
    ])
  })

  it('a Bab with no bank question falls back to the SPM pool of the SAME Tingkatan (never another), personal questions riding along', async () => {
    const { draws, run } = adapter(['2'], true)
    await run(mission({ chapterId: '9' }))
    expect(draws[1]).toEqual({ subjectId: '1', spmPool: true, educationLevelIds: ['2'], ownerPrivateUserId: '7' })
  })

  it('a pupil with no class of the mission teacher gets no personal question and no level filter', async () => {
    const { draws, run } = adapter([])
    await run(mission())
    expect(draws).toEqual([{ subjectId: '1', spmPool: true }])
  })
})

describe('FR-GUR-44a-10: scope() with ownerPrivateUserId', () => {
  const sqlOf = (filter: Record<string, unknown>): string => {
    const repo = new QuestionsRepository({ client: {} } as never)
    return repo.scopeSql({ status: 'approved', active: true, ...filter }, true).where.sql
  }

  it('without an owner: bank rows only, never a private one', () => {
    const sql = sqlOf({ subjectId: '1' })
    expect(sql).toContain(`v.visibility = 'bank'`)
    expect(sql).not.toContain('teacher_private')
  })

  it('with an owner: bank OR that owner\'s private rows, one owner only', () => {
    const repo = new QuestionsRepository({ client: {} } as never)
    const where = repo.scopeSql({ status: 'approved', active: true, subjectId: '1', educationLevelIds: ['4'], ownerPrivateUserId: '7' }, true).where
    expect(where.sql).toContain(`(v.visibility = 'bank' OR (v.visibility = 'teacher_private' AND v.owner_user_id = ?))`)
    expect(where.values).toContain(7n)
    expect(where.sql).toContain('v.education_level_id IN')
  })

  it('the Bab and the SPM pool narrow the bank part only', () => {
    const repo = new QuestionsRepository({ client: {} } as never)
    const where = repo.scopeSql({ status: 'approved', active: true, chapterId: '9', spmPool: true, ownerPrivateUserId: '7' }, true).where
    expect(where.sql).toContain('(v.chapter_id = ? OR (v.visibility')
    expect(where.sql).toContain(' OR (v.visibility = \'teacher_private\' AND v.owner_user_id = ?))')
    expect(Prisma.empty.sql).toBe('')
  })

  it('an invalid owner id adds nothing (bank only)', () => {
    expect(sqlOf({ ownerPrivateUserId: 'abc' })).not.toContain('teacher_private')
  })
})
