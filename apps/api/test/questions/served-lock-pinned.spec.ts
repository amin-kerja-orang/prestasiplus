import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { QuestionSchema, STIMULUS_MESSAGES, StimulusGroupDetailSchema, StimulusSchema, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, tagOf, type Refs } from './http-helpers'

/**
 * REQ-B-012 extra cases (the main specs are in stimulus-group-rules.spec.ts, 'B2 minors of T32'): only a PUBLISHED paper locks (a withdrawn
 * one, a draft one or none does not, after archive), and a question that a Terbit paper pins cannot be added to a group (it is served). Real database.
 */
describe('REQ-B-012 extra: which papers keep a member served', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  let tag: Awaited<ReturnType<typeof tagOf>>

  beforeAll(async () => {
    process.env.FILE_STORAGE_DIR = await mkdtemp(join(tmpdir(), 'pp-served-pinned-'))
    process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE = '100000'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    tag = await tagOf(t.db, refs.mathId, refs.t4Id)
  })
  afterAll(async () => {
    await t.close()
  })

  const stimulus = async (): Promise<string> => {
    const res = await admin.post('/api/stimuli', { kind: 'passage', label: 'Petikan', body: { ms: 'Teks petikan.' } })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return mutationEnvelopeOf(StimulusSchema).parse(res.body).data.id
  }
  const question = async (over: Record<string, unknown> = {}): Promise<string> => {
    const res = await admin.post('/api/questions', mcqBody(refs, over))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
  }
  const group = async (questionIds: string[]) => {
    const res = await admin.post('/api/stimulus-groups', { stimulusIds: [await stimulus()], questionIds })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return mutationEnvelopeOf(StimulusGroupDetailSchema).parse(res.body).data
  }
  /** A paper of the given status that pins version 1 of the questions. */
  const paper = async (status: 'published' | 'draft' | 'withdrawn', questionIds: string[]): Promise<string> => {
    const p = await t.db.prisma.paper.create({
      data: {
        kind: 'pilihan',
        title: `Kertas kunci ${status}`,
        subjectId: BigInt(refs.mathId),
        kertas: 2,
        paperCode: '1449/2',
        printedDurationMin: 60,
        status,
        publishedAt: status === 'draft' ? null : new Date('2026-10-20T09:00:00+08:00'),
        sections: { create: [{ position: 1, label: 'Bahagian A', questionCount: questionIds.length, markBudget: 0, placements: { create: questionIds.map((q, i) => ({ questionId: BigInt(q), position: i + 1 })) } }] },
      },
    })
    return p.id.toString()
  }
  const archive = async (ids: string[]) => {
    const res = await admin.post('/api/questions/bulk-action', { action: 'archived', ids })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.failed).toEqual([])
  }
  /** A group with one served member (approved, active) made inside it; returns the pieces. */
  const servedGroup = async () => {
    const g = await group([])
    const res = await admin.post(`/api/stimulus-groups/${g.id}/questions`, mcqBody(refs, { status: 'approved', tag }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const member = mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
    return { id: g.id, member, stimulusId: g.stimuli[0]!.id }
  }

  describe('only a published paper keeps a question served', () => {
    it('an archived member on a draft or withdrawn paper, or on no paper, does not lock the stimulus', async () => {
      for (const status of ['draft', 'withdrawn', null] as const) {
        const s = await servedGroup()
        if (status !== null) await paper(status, [s.member])
        await archive([s.member])
        const edited = await admin.put(`/api/stimuli/${s.stimulusId}`, { caption: `Tukar ${String(status)}` })
        expect(edited.status, `${String(status)} ${JSON.stringify(edited.body)}`).toBe(200)
      }
    })

    it('an archived question that a Terbit paper pins cannot be added to a group', async () => {
      const q = await question({ status: 'approved', tag })
      await paper('published', [q])
      await archive([q])
      const g = await group([])
      const res = await admin.post(`/api/stimulus-groups/${g.id}/members`, { questionId: q })
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(res.body.error.fields.questionId).toBe(STIMULUS_MESSAGES.memberInactive)
    })
  })
})
