/**
 * Heatmap Topik Lemah (S10-T05, API-DSKP-08) over a real database: AC-MUR-14-1, -2, -3, -5, FR-MUR-14-1, -6, -7, -8
 * and the unchanged role, own-data and Mod Pelajar rules. Tests share one database; each `describe` clears the answer
 * log it uses and uses its own subjects (the response lists only practised subjects).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { HeatmapPorts } from '../../src/modules/heatmap'
import { PracticeRepository } from '../../src/modules/practice'
import type { CurriculumTestApp } from '../curriculum/helpers'
import {
  HEATMAP,
  addAnswers,
  addChapter,
  addSession,
  addSubject,
  bootHeatmapApp,
  cells,
  clearAnswers,
  expectError,
  heatmapOf,
  loginAs,
  loginModPelajar,
  setCore,
  userIdByEmail,
  type Client,
} from './helpers'

let t: CurriculumTestApp
let admin: Client
let pelajar: Client
let pelajar2: Client
let adminId: string
let pelajarId: string
let pelajar2Id: string

beforeAll(async () => {
  t = await bootHeatmapApp()
  ;[admin, pelajar, pelajar2] = await Promise.all([
    loginAs(t, 'admin@demo.test'),
    loginAs(t, 'pelajar@demo.test'),
    loginAs(t, 'pelajar2@demo.test'),
  ])
  adminId = await userIdByEmail(t.db, 'admin@demo.test')
  pelajarId = await userIdByEmail(t.db, 'pelajar@demo.test')
  pelajar2Id = await userIdByEmail(t.db, 'pelajar2@demo.test')
}, 300_000)

afterAll(async () => {
  await t?.close()
})

/** The ten values of `ck_practice_sessions_mode`: a pupil's heatmap reads the answers of every one of them. */
const DB_MODES = [
  'random',
  'chapter',
  'revision',
  'past_year',
  'latih_tubi',
  'ramalan',
  'mission',
  'remedial',
  'question_set',
  'pksk',
]

/* ----------------------------------------------------------------------------------- tiles and bands */

describe('AC-MUR-14-1 and AC-MUR-14-5: tiles, accuracy and states', () => {
  let s: string
  beforeAll(async () => {
    await clearAnswers(t.db)
    s = await addSubject(t.db, 'Tiles Matematik', 10)
  })

  it('10 attempts, 4 correct is a red tile with accuracy 40 (no minimum, no extra decimal)', async () => {
    const c = await addChapter(t.db, s, 'Pecahan', undefined, { number: 1 })
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: c, attempts: 10, correct: 4 })
    const data = await heatmapOf(pelajar.get)
    expect(data.subjects).toEqual([
      {
        id: s,
        name: 'Tiles Matematik',
        chapters: [
          {
            id: c,
            number: 1,
            name: 'Pecahan',
            attempts: 10,
            correct: 4,
            accuracy: 40,
            state: 'red',
          },
        ],
      },
    ])
    await clearAnswers(t.db, pelajarId)
  })

  it('7 attempts, 4 correct is an amber tile with accuracy 57.1 (the screen shows 57)', async () => {
    const c = await addChapter(t.db, s, 'Perpuluhan', undefined, { number: 2 })
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: c, attempts: 7, correct: 4 })
    const tile = (await heatmapOf(pelajar.get)).subjects[0]?.chapters.find((x) => x.id === c)
    expect(tile).toMatchObject({ attempts: 7, correct: 4, accuracy: 57.1, state: 'amber' })
    await clearAnswers(t.db, pelajarId)
  })

  it('there is no minimum: one answer makes a tile; band edges 49 red, 50 amber, 79 amber, 80 green on the whole percent', async () => {
    const edge = await addSubject(t.db, 'Tiles Tepi', 11)
    const one = await addChapter(t.db, edge, 'Satu', undefined, { number: 1 })
    const half = await addChapter(t.db, edge, 'Separuh', undefined, { number: 2 })
    const high = await addChapter(t.db, edge, 'Tinggi', undefined, { number: 3 })
    const full = await addChapter(t.db, edge, 'Penuh', undefined, { number: 4 })
    await addAnswers(t.db, pelajarId, { subjectId: edge, chapterId: one, attempts: 1, correct: 1 })
    await addAnswers(t.db, pelajarId, {
      subjectId: edge,
      chapterId: half,
      attempts: 200,
      correct: 99,
    }) // 49.5 -> whole 50
    await addAnswers(t.db, pelajarId, {
      subjectId: edge,
      chapterId: high,
      attempts: 200,
      correct: 159,
    }) // 79.5 -> whole 80
    await addAnswers(t.db, pelajarId, { subjectId: edge, chapterId: full, attempts: 6, correct: 5 }) // 83.3
    expect(cells(await heatmapOf(pelajar.get))).toEqual([
      [one, 1, 1, 100, 'green'],
      [half, 200, 99, 49.5, 'amber'],
      [high, 200, 159, 79.5, 'green'],
      [full, 6, 5, 83.3, 'green'],
    ])
    await clearAnswers(t.db, pelajarId)
  })
})

/* -------------------------------------------------------------------------------------- grey tiles */

describe('AC-MUR-14-2: a chapter without an attempt is a grey belum-cuba tile; FR-MUR-14-6, -8', () => {
  let s: string
  beforeAll(async () => {
    await clearAnswers(t.db)
    s = await addSubject(t.db, 'Grey Sains', 20)
  })

  it('lists every active Tingkatan 1-5 chapter of a practised subject, not the Darjah, inactive or out-of-tree ones', async () => {
    const tried = await addChapter(t.db, s, 'Bab dicuba', undefined, { number: 1, levelCode: 'T1' })
    const t2 = await addChapter(t.db, s, 'Bab T2', undefined, { number: 2, levelCode: 'T2' })
    const t5 = await addChapter(t.db, s, 'Bab T5', undefined, { number: 3, levelCode: 'T5' })
    const darjah = await addChapter(t.db, s, 'Bab Darjah', undefined, {
      number: 4,
      levelCode: 'D2',
    })
    const off = await addChapter(t.db, s, 'Bab tidak aktif', undefined, { number: 5 })
    const out = await addChapter(t.db, s, 'Bab luar pokok', undefined, { number: 6 })
    await t.db.query('update chapters set is_active = false where id = $1::bigint', [off])
    await t.db.query('update chapters set in_tree = false where id = $1::bigint', [out])
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: tried, attempts: 3, correct: 3 })
    const data = await heatmapOf(pelajar.get)
    expect(cells(data)).toEqual([
      [tried, 3, 3, 100, 'green'],
      [t2, 0, 0, null, 'belum-cuba'],
      [t5, 0, 0, null, 'belum-cuba'],
    ])
    expect([darjah, off, out].some((id) => cells(data).some((c) => c[0] === id))).toBe(false)
    await clearAnswers(t.db, pelajarId)
  })

  it('a subject with no attempt is not listed, even when the pupil practised another subject', async () => {
    const other = await addSubject(t.db, 'Grey Lain', 21)
    await addChapter(t.db, other, 'Bab lain', undefined, { number: 1 })
    const c = await addChapter(t.db, s, 'Bab ujian dua', undefined, { number: 7 })
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: c, attempts: 2, correct: 1 })
    expect((await heatmapOf(pelajar.get)).subjects.map((x) => x.id)).toEqual([s])
    await clearAnswers(t.db, pelajarId)
  })
})

/* -------------------------------------------------------------------------------------- AC-MUR-14-3 */

describe('AC-MUR-14-3: answers without a chapter give the empty state', () => {
  it('answers with no Bab give { subjects: [] } with no error, and do not make the subject practised', async () => {
    await clearAnswers(t.db)
    const s = await addSubject(t.db, 'Tanpa Bab', 30)
    await addChapter(t.db, s, 'Bab tidak dicuba', undefined, { number: 1 })
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: null, attempts: 12, correct: 9 })
    const res = await pelajar.get(HEATMAP)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { subjects: [] } })
    await clearAnswers(t.db, pelajarId)
  })

  it('a student with no data gets { subjects: [] }', async () => {
    await clearAnswers(t.db)
    const res = await pelajar2.get(HEATMAP)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { subjects: [] } })
  })
})

/* ---------------------------------------------------------------------------------- FR-MUR-14-1 modes */

describe('FR-MUR-14-1: every practice mode counts', () => {
  it('one answer row per practice mode (and one outside any session) all land in the chapter tile', async () => {
    await clearAnswers(t.db)
    const s = await addSubject(t.db, 'Semua Mod', 40)
    const c = await addChapter(t.db, s, 'Bab semua mod', undefined, { number: 1 })
    for (const mode of DB_MODES) {
      const sessionId = await addSession(t.db, pelajarId, mode)
      await addAnswers(t.db, pelajarId, {
        subjectId: s,
        chapterId: c,
        attempts: 1,
        correct: 1,
        sessionId,
      })
    }
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: c, attempts: 2, correct: 0 })
    expect(cells(await heatmapOf(pelajar.get))).toEqual([
      [c, DB_MODES.length + 2, DB_MODES.length, 83.3, 'green'],
    ])
    await clearAnswers(t.db, pelajarId)
  })
})

/* ----------------------------------------------------------------------------------------- ordering */

describe('ordering: Subjek Teras first then name; chapters by Bab number', () => {
  it('core subjects come first, then name ascending; chapters follow the Bab number (no number last)', async () => {
    await clearAnswers(t.db)
    const zCore = await addSubject(t.db, 'Zeta Teras', 50)
    const aPlain = await addSubject(t.db, 'Alfa Biasa', 51)
    const mPlain = await addSubject(t.db, 'Mim Biasa', 52)
    await setCore(t.db, zCore)
    const ten = await addChapter(t.db, zCore, 'Sepuluh', undefined, { number: 10 })
    const two = await addChapter(t.db, zCore, 'Dua', undefined, { number: 2 })
    const none = await addChapter(t.db, zCore, 'Tanpa nombor')
    const one = await addChapter(t.db, zCore, 'Satu', undefined, { number: 1 })
    for (const [subj, chapter] of [
      [zCore, ten],
      [aPlain, await addChapter(t.db, aPlain, 'A1', undefined, { number: 1 })],
      [mPlain, await addChapter(t.db, mPlain, 'M1', undefined, { number: 1 })],
    ] as const) {
      await addAnswers(t.db, pelajarId, {
        subjectId: subj,
        chapterId: chapter,
        attempts: 2,
        correct: 1,
      })
    }
    const data = await heatmapOf(pelajar.get)
    expect(data.subjects.map((x) => x.name)).toEqual(['Zeta Teras', 'Alfa Biasa', 'Mim Biasa'])
    expect(data.subjects[0]?.chapters.map((x) => x.id)).toEqual([one, two, ten, none])
    await clearAnswers(t.db, pelajarId)
  })
})

/* ------------------------------------------------------------------------------- own data and roles */

describe('own data only and the role gate (unchanged)', () => {
  let s: string
  let c: string
  beforeAll(async () => {
    await clearAnswers(t.db)
    s = await addSubject(t.db, 'Milik Sendiri', 60)
    c = await addChapter(t.db, s, 'Bab sendiri', undefined, { number: 1 })
    await addAnswers(t.db, pelajar2Id, { subjectId: s, chapterId: c, attempts: 7, correct: 4 })
    await addAnswers(t.db, adminId, { subjectId: s, chapterId: c, attempts: 3, correct: 3 })
  })

  it('a ?userId= (or any) query is ignored; two students see only their own tiles', async () => {
    const own = await heatmapOf(pelajar2.get)
    expect(cells(own)).toEqual([[c, 7, 4, 57.1, 'amber']])
    expect(await heatmapOf(pelajar2.get, `${HEATMAP}?userId=${adminId}&subjectId=${s}`)).toEqual(
      own,
    )
    expect((await heatmapOf(pelajar.get, `${HEATMAP}?userId=${pelajar2Id}`)).subjects).toEqual([])
  })

  it("an admin gets 200 with the admin's own data", async () => {
    expect(cells(await heatmapOf(admin.get))).toEqual([[c, 3, 3, 100, 'green']])
  })

  it('no session is 401 UNAUTHORIZED', async () => {
    expectError(
      await t.http().get(HEATMAP),
      'UNAUTHORIZED',
      'Sesi anda telah tamat. Sila log masuk semula.',
    )
  })

  it('teacher, parent and school admin are 403 FORBIDDEN', async () => {
    for (const who of [
      'guru@demo.test',
      'ibubapa@demo.test',
      'adminsekolah@demo.test',
      'guruadmin@demo.test',
    ]) {
      const client = await loginAs(t, who)
      expectError(
        await client.get(HEATMAP),
        'FORBIDDEN',
        'Anda tidak dibenarkan melakukan tindakan ini.',
      )
    }
  })
})

/* ------------------------------------------------------------------------- agreement with the answer log */

describe('agreement with the M05 answer log (BR-M25-10) and independence from the question bank', () => {
  it('every tile equals the per-chapter aggregate of the same user; the default port reads every answer', async () => {
    await clearAnswers(t.db)
    const s = await addSubject(t.db, 'Selaras', 70)
    const a = await addChapter(t.db, s, 'Bab A', undefined, { number: 1 })
    const b = await addChapter(t.db, s, 'Bab B', undefined, { number: 2 })
    await addAnswers(t.db, adminId, { subjectId: s, chapterId: a, attempts: 9, correct: 5 })
    await addAnswers(t.db, adminId, { subjectId: s, chapterId: b, attempts: 1, correct: 0 })
    const sql = await t.db.query<{ chapter_id: string; attempts: string; correct: string }>(
      `select chapter_id::text, count(*)::text as attempts, count(*) filter (where is_correct)::text as correct
         from practice_answers where user_id = $1::bigint and chapter_id is not null and not is_test
        group by chapter_id order by chapter_id`,
      [adminId],
    )
    expect(await t.app.get(HeatmapPorts).answerCounts.chapterAnswerCounts(adminId, false)).toEqual(
      sql.map((r) => ({
        chapterId: r.chapter_id,
        attempts: Number(r.attempts),
        correct: Number(r.correct),
      })),
    )
    expect(cells(await heatmapOf(admin.get))).toEqual([
      [a, 9, 5, 55.6, 'amber'],
      [b, 1, 0, 0, 'red'],
    ])
    // the question bank is never read: nulling the question link and marking rows historical changes nothing
    const before = await heatmapOf(admin.get)
    await t.db.query(
      'update practice_answers set question_id = null, historical = true where user_id = $1::bigint',
      [adminId],
    )
    expect(await heatmapOf(admin.get)).toEqual(before)
    await clearAnswers(t.db)
  })
})

/* ------------------------------------------------------------------------------------------ test mode */

describe('test mode (Mod Pelajar, is_test)', () => {
  let s: string
  let real: string
  let test: string
  beforeAll(async () => {
    await clearAnswers(t.db)
    s = await addSubject(t.db, 'Mod Ujian', 80)
    real = await addChapter(t.db, s, 'Sebenar', undefined, { number: 1 })
    test = await addChapter(t.db, s, 'Ujian', undefined, { number: 2 })
    await addAnswers(t.db, adminId, { subjectId: s, chapterId: real, attempts: 5, correct: 5 })
    await addAnswers(t.db, adminId, {
      subjectId: s,
      chapterId: test,
      attempts: 6,
      correct: 0,
      isTest: true,
    })
    await addAnswers(t.db, pelajarId, {
      subjectId: s,
      chapterId: test,
      attempts: 9,
      correct: 9,
      isTest: true,
    })
  })

  it('real mode never counts is_test rows (the unattempted chapter is grey)', async () => {
    expect(cells(await heatmapOf(admin.get))).toEqual([
      [real, 5, 5, 100, 'green'],
      [test, 0, 0, null, 'belum-cuba'],
    ])
    expect((await heatmapOf(pelajar.get)).subjects).toEqual([])
  })

  it("Mod Pelajar reads only the caller's own is_test rows", async () => {
    const mp = await loginModPelajar(t as never, 'admin@demo.test')
    expect(cells(await heatmapOf(mp.get))).toEqual([
      [real, 0, 0, null, 'belum-cuba'],
      [test, 6, 0, 0, 'red'],
    ])
  })
})

/* ------------------------------------------------------------------------------------------ ports */

describe('HeatmapPorts', () => {
  it('a second registration of the answer source throws', () => {
    const ports = new HeatmapPorts(t.app.get(PracticeRepository))
    const fake = { chapterAnswerCounts: async () => [] }
    ports.provideAnswerCounts(fake)
    expect(() => ports.provideAnswerCounts(fake)).toThrow(/already provided/)
  })
})
