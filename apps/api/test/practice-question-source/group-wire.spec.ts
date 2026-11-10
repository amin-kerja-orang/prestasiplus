import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { prngStream } from '../../src/db/prng'
import { quizQuestionsOf } from '../../src/modules/practice/practice-wire'
import { Be09PracticeQuestionSource } from '../../src/modules/practice/question-bridge/be09-practice-question-source'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import type { UsersRepository } from '../../src/modules/users'
import { adminActor, mcqInput, tagOf, type Tag } from '../questions/fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from '../questions/helpers'

/**
 * T-C13 (S5-T03 Part B, D105, D90, PO core requirement) against a real database: with the DEFAULT surface list a drill serves a stimulus group
 * WHOLE and IN ORDER, every member carries the rajah (the 2nd and 3rd question too) with its picture as a file token URL, a resumed session
 * (the pinned read) still carries it, and a group whose picture has no public token is dropped as a whole.
 */
let t: QuestionsTestApp
let tag: Tag
let source: Be09PracticeQuestionSource
let chapterId: string
let seq = 0
const made: Record<string, string> = {}

const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string }>(sql, params)

async function fileRow(): Promise<{ id: string; token: string }> {
  seq += 1
  const token = `gw${String(seq)}`.padEnd(22, 'B')
  const [row] = await q(
    `insert into files (public_id, owner_user_id, purpose, mime, size_bytes, sha256, storage_key)
     values ($1, null, 'question_image', 'image/png', 10, $2, $3) returning id::text id`,
    [token, 'd'.repeat(64), `gw-key-${String(seq)}`],
  )
  return { id: row?.id as string, token }
}

async function publish(key: string, over: Record<string, unknown> = {}): Promise<string> {
  const admin = await adminActor(t.db)
  const created = await t.app.get(QuestionsService).create(mcqInput(tag, { questionText: `Soalan ${key} sambungan rajah`, ...over }), admin)
  await q(`update question_versions set status = 'approved', published_at = now() where question_id = $1`, [created.id])
  await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
  await q(`update question_versions set chapter_id = $2 where question_id = $1`, [created.id, chapterId])
  made[key] = created.id
  return created.id
}

async function rajahGroup(label: string, fileId: string): Promise<string> {
  const svc = t.app.get(QuestionsService)
  const figure = await svc.createStimulus({ kind: 'diagram', label, bodyMs: null, bodyEn: null, altText: `Graf untuk ${label}`, assetFileId: BigInt(fileId) })
  return svc.createStimulusGroup({ label, scope: 'section', stimulusIds: [figure], optionBank: [] })
}

beforeAll(async () => {
  t = await bootQuestionsApp()
  const repo = t.app.get(QuestionsRepository)
  tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
  await q(`update questions set is_active = false`)
  chapterId = (await q(`select id::text id from chapters where subject_id = $1 order by id limit 1`, [tag.subjectId]))[0]?.id as string
  const files = {
    publicIdsOf: async (ids: readonly string[]) => new Map((await t.db.query<{ id: string; public_id: string }>(`select id::text id, public_id from files where id = any($1::bigint[])`, [ids])).map((r) => [r.id, r.public_id])),
  }
  // The DEFAULT surface list (no 3rd argument): this is what the app runs with.
  source = new Be09PracticeQuestionSource(repo, { getMany: () => Promise.resolve([]) } as unknown as UsersRepository, undefined, files as never)

  const f = await fileRow()
  made.token = f.token
  const group = await rajahGroup('Rajah 1', f.id)
  for (const k of ['m1', 'm2', 'm3']) await publish(k, { stimulusGroupId: group })
  for (let i = 1; i <= 3; i++) await publish(`plain${String(i)}`)
}, 240_000)
afterAll(async () => {
  await t.close()
})

const sel = { activity: 'bab', spmPool: false } as const

describe('practice drills serve the rajah (default surfaces)', () => {
  it('live(): every member of the group carries the stimulus with the picture token URL, alt text and its place in the group', async () => {
    const ids = [made.m1!, made.m2!, made.m3!]
    const live = await source.live(ids, 'bab')
    expect([...live.keys()].sort()).toEqual([...ids].sort())
    const wire = quizQuestionsOf(ids.map((id) => live.get(id)!), () => 0)
    for (const w of wire) {
      expect(w.stimuli).toHaveLength(1)
      expect(w.stimuli?.[0]).toMatchObject({ kind: 'diagram', label: 'Rajah 1', alt: 'Graf untuk Rajah 1', image: { url: `/api/files/${made.token!}` } })
    }
    expect(wire.map((w) => w.group?.index)).toEqual([1, 2, 3])
    expect(wire.every((w) => w.group?.size === 3)).toBe(true)
  })

  it('every drill surface serves the group; Ramalan / Misi (no surface) still refuse it', async () => {
    for (const a of ['bab', 'latih_tubi_spm', 'databank'] as const) expect((await source.live([made.m2!], a)).has(made.m2!), a).toBe(true)
    expect((await source.live([made.m2!])).has(made.m2!)).toBe(false)
  })

  it('a chapter page serves the whole group in group order, never split by the count', async () => {
    const page = await source.chapterPage(chapterId, [], 10)
    const at = page.indexOf(made.m1!)
    expect(page.slice(at, at + 3)).toEqual([made.m1, made.m2, made.m3])
    // A count of 2 cannot hold the 3-member group: it is skipped, the plain questions fill it.
    const small = await source.chapterPage(chapterId, [], 2)
    expect(small.filter((id) => [made.m1, made.m2, made.m3].includes(id))).toEqual([])
  })

  it('a draw keeps the group whole and contiguous in order, and its members are never apart', async () => {
    for (let s = 0; s < 8; s++) {
      const drawn = await source.sample({ subjectId: tag.subjectId, ...sel }, 6, prngStream(`group-wire:${String(s)}`))
      const inGroup = drawn.filter((id) => [made.m1, made.m2, made.m3].includes(id))
      expect([0, 3]).toContain(inGroup.length)
      if (inGroup.length === 3) {
        const at = drawn.indexOf(made.m1!)
        expect(drawn.slice(at, at + 3)).toEqual([made.m1, made.m2, made.m3])
      }
    }
  })

  it('a resumed session (pinned read) still carries the rajah on every member', async () => {
    const refs = [made.m1!, made.m2!, made.m3!].map((questionId) => ({ questionId, versionNo: 1 }))
    const pinned = await source.versions(refs)
    for (const r of refs) {
      const p = pinned.get(`${r.questionId}@1`)
      expect(p?.stimuli?.[0]?.image?.url, r.questionId).toBe(`/api/files/${made.token!}`)
      expect(p?.groupId).toBeDefined()
    }
  })

  it('a group whose picture has no public token is not served at all (never a broken frame, never half a group)', async () => {
    const bare = { publicIdsOf: () => Promise.resolve(new Map<string, string>()) }
    const repo = t.app.get(QuestionsRepository)
    const noFiles = new Be09PracticeQuestionSource(repo, { getMany: () => Promise.resolve([]) } as unknown as UsersRepository, undefined, bare as never)
    const live = await noFiles.live([made.m1!, made.m2!, made.m3!, made.plain1!], 'bab')
    expect([...live.keys()]).toEqual([made.plain1])
  })
})
