/**
 * BE-48 Heatmap Topik Lemah (M25 route #1): the card's acceptance criteria 1 to 7 and 9 over a real
 * database. The mock tests `src/modules/m25-ai-centre/__tests__/{heatmap,ties}.test.ts` are ported to
 * fixtures written here (the mock's ids become generated ids; names and figures are the mock's).
 * Tests share one database; each `describe` clears the answer log it uses.
 */
import { HEATMAP_MIN_ATTEMPTS } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { HeatmapPorts } from '../../src/modules/heatmap'
import { PracticeRepository } from '../../src/modules/practice'
import type { CurriculumTestApp } from '../curriculum/helpers'
import {
  HEATMAP,
  addAnswers,
  addChapter,
  addSubject,
  bootHeatmapApp,
  cells,
  clearAnswers,
  expectError,
  heatmapOf,
  loginAs,
  loginModPelajar,
  sum,
  userIdByEmail,
  type Client,
} from './helpers'

let t: CurriculumTestApp
let admin: Client
let pelajar: Client
let maju: Client
let pelajar2: Client
let adminId: string
let pelajarId: string
let majuId: string
let pelajar2Id: string

/** Generated ids of the observed fixture, keyed by the mock's ids. */
const ch: Record<string, string> = {}
let bm = ''
let sej = ''
let mat = ''

beforeAll(async () => {
  t = await bootHeatmapApp()
  ;[admin, pelajar, maju, pelajar2] = await Promise.all([
    loginAs(t, 'admin@demo.test'),
    loginAs(t, 'pelajar@demo.test'),
    loginAs(t, 'pelajarmaju@demo.test'),
    loginAs(t, 'pelajar2@demo.test'),
  ])
  adminId = await userIdByEmail(t.db, 'admin@demo.test')
  pelajarId = await userIdByEmail(t.db, 'pelajar@demo.test')
  majuId = await userIdByEmail(t.db, 'pelajarmaju@demo.test')
  pelajar2Id = await userIdByEmail(t.db, 'pelajar2@demo.test')
  // Observed curriculum (SRS M25 section 6.7): Bahasa Melayu before Sejarah; Matematik for pelajarmaju.
  bm = await addSubject(t.db, 'Bahasa Melayu', -30)
  sej = await addSubject(t.db, 'Sejarah', -20)
  mat = await addSubject(t.db, 'Matematik', -25)
  ch['87'] = await addChapter(t.db, bm, 'Kemahiran Bahasa Tingkatan 4')
  ch['413'] = await addChapter(t.db, bm, 'Kemahiran Bahasa Tingkatan 5')
  ch['35'] = await addChapter(t.db, bm, 'Kemahiran Mendengar dan Bertutur')
  ch['36'] = await addChapter(t.db, bm, 'Kemahiran Membaca')
  ch['2'] = await addChapter(t.db, bm, 'Kemahiran Menulis')
  ch['4'] = await addChapter(t.db, bm, 'Kemahiran Bahasa D2')
  ch['382'] = await addChapter(t.db, sej, 'Bab Sejarah Ujian')
  ch['143'] = await addChapter(t.db, mat, 'Sukatan dan Geometri')
  ch['136'] = await addChapter(t.db, mat, 'Pecahan')
  ch['1'] = await addChapter(t.db, mat, 'Nombor Bulat hingga 100')
}, 300_000)

afterAll(async () => {
  await t?.close()
})

/** The admin's observed answer log: 119 answers / 46 correct (BM 79 / 32, SEJ 40 / 14). */
async function seedObservedAdmin(): Promise<void> {
  const a = (chapter: string | null, subjectId: string, attempts: number, correct: number) =>
    addAnswers(t.db, adminId, { subjectId, chapterId: chapter === null ? null : (ch[chapter] as string), attempts, correct })
  await a('87', bm, 5, 0)
  await a('413', bm, 38, 12)
  await a('35', bm, 18, 8)
  await a('36', bm, 5, 3)
  await a('2', bm, 10, 8)
  await a('4', bm, 2, 1) // the D2 chapter below the minimum (hidden)
  await a(null, bm, 1, 0) // one BM answer without a chapter (hidden)
  await a('382', sej, 40, 14)
}

async function seedObservedMaju(): Promise<void> {
  await addAnswers(t.db, majuId, { subjectId: mat, chapterId: ch['143'] as string, attempts: 7, correct: 3 })
  await addAnswers(t.db, majuId, { subjectId: mat, chapterId: ch['136'] as string, attempts: 7, correct: 4 })
  await addAnswers(t.db, majuId, { subjectId: mat, chapterId: ch['1'] as string, attempts: 23, correct: 19 })
}

const totals = async (userId: string) => {
  const rows = await t.db.query<{ n: string; c: string }>(
    'select count(*)::text as n, count(*) filter (where is_correct)::text as c from practice_answers where user_id = $1::bigint and not is_test',
    [userId],
  )
  return { attempts: Number(rows[0]?.n), correct: Number(rows[0]?.c) }
}

/* ------------------------------------------------------------------------------------------- AC 1 */

describe('AC1: the observed figures (ported mock heatmap.test.ts)', () => {
  beforeAll(async () => {
    await clearAnswers(t.db)
    await seedObservedAdmin()
    await seedObservedMaju()
  })

  it('admin: six cells in the observed order, BM before Sejarah', async () => {
    const data = await heatmapOf(admin.get)
    expect(data.subjects.map((s) => [s.subjectId, s.name])).toEqual([
      [bm, 'Bahasa Melayu'],
      [sej, 'Sejarah'],
    ])
    expect(cells(data)).toEqual([
      [ch['87'], 5, 0, 0, 'red'],
      [ch['413'], 38, 12, 32, 'red'],
      [ch['35'], 18, 8, 44, 'red'],
      [ch['36'], 5, 3, 60, 'amber'],
      [ch['2'], 10, 8, 80, 'green'],
      [ch['382'], 40, 14, 35, 'red'],
    ])
    expect(data.subjects[0]?.topics.map((x) => x.name)).toEqual([
      'Kemahiran Bahasa Tingkatan 4',
      'Kemahiran Bahasa Tingkatan 5',
      'Kemahiran Mendengar dan Bertutur',
      'Kemahiran Membaca',
      'Kemahiran Menulis',
    ])
  })

  it('admin: 116 attempts / 45 correct shown, 3 / 1 hidden, 119 / 46 in total', async () => {
    const shown = sum((await heatmapOf(admin.get)).subjects.flatMap((s) => s.topics))
    expect(shown).toEqual({ attempts: 116, correct: 45 })
    const all = await totals(adminId)
    expect(all).toEqual({ attempts: 119, correct: 46 })
    expect({ attempts: all.attempts - shown.attempts, correct: all.correct - shown.correct }).toEqual({ attempts: 3, correct: 1 })
  })

  it('pelajarmaju: 3 Matematik cells, 37 / 26, ordered 43, 57, 83; nothing hidden', async () => {
    const data = await heatmapOf(maju.get)
    expect(data.subjects.map((s) => s.name)).toEqual(['Matematik'])
    expect(data.subjects[0]?.topics.map((x) => [x.chapterId, x.name, x.attempts, x.correct, x.percent, x.band])).toEqual([
      [ch['143'], 'Sukatan dan Geometri', 7, 3, 43, 'red'],
      [ch['136'], 'Pecahan', 7, 4, 57, 'amber'],
      [ch['1'], 'Nombor Bulat hingga 100', 23, 19, 83, 'green'],
    ])
    expect(sum(data.subjects.flatMap((s) => s.topics))).toEqual(await totals(majuId))
  })

  it('a student with no data gets { subjects: [] } (the empty state)', async () => {
    const res = await pelajar2.get(HEATMAP)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { subjects: [] } })
  })

  it('m25-bands fixture: bands and order by accuracy', async () => {
    const s = await addSubject(t.db, 'Bahasa Melayu D3', 50)
    const ids = [
      await addChapter(t.db, s, 'Bab 12'),
      await addChapter(t.db, s, 'Bab 13'),
      await addChapter(t.db, s, 'Bab 14'),
      await addChapter(t.db, s, 'Bab 15'),
      await addChapter(t.db, s, 'Bab 16'),
    ] as const
    const figures: [number, number][] = [[10, 4], [10, 5], [100, 79], [200, 160], [10, 8]]
    for (const [i, [n, c]] of figures.entries()) await addAnswers(t.db, pelajar2Id, { subjectId: s, chapterId: ids[i] as string, attempts: n, correct: c })
    const data = await heatmapOf(pelajar2.get)
    expect(cells(data).map(([id, n, , p, b]) => [id, n, p, b])).toEqual([
      [ids[0], 10, 40, 'red'],
      [ids[1], 10, 50, 'amber'],
      [ids[2], 100, 79, 'amber'],
      [ids[3], 200, 80, 'green'],
      [ids[4], 10, 80, 'green'],
    ])
    expect(sum(data.subjects.flatMap((x) => x.topics))).toEqual(await totals(pelajar2Id))
    await clearAnswers(t.db, pelajar2Id)
  })

  it('m25-ties fixture (ported ties.test.ts): equal accuracy orders by topic name', async () => {
    const s = await addSubject(t.db, 'Bahasa Melayu Seri', 51)
    const c12 = await addChapter(t.db, s, 'Kemahiran Membaca D3')
    const c13 = await addChapter(t.db, s, 'Kemahiran Menulis D3')
    const c14 = await addChapter(t.db, s, 'Aspek Tatabahasa D3')
    for (const c of [c12, c13, c14]) await addAnswers(t.db, pelajar2Id, { subjectId: s, chapterId: c, attempts: 10, correct: 5 })
    const data = await heatmapOf(pelajar2.get)
    expect(data.subjects[0]?.topics.map((x) => [x.chapterId, x.name, x.attempts, x.percent])).toEqual([
      [c14, 'Aspek Tatabahasa D3', 10, 50],
      [c12, 'Kemahiran Membaca D3', 10, 50],
      [c13, 'Kemahiran Menulis D3', 10, 50],
    ])
    await clearAnswers(t.db, pelajar2Id)
  })
})

/* ------------------------------------------------------------------------------------------- AC 2 */

describe('AC2: population', () => {
  let s: string
  beforeAll(async () => {
    await clearAnswers(t.db, pelajarId)
    s = await addSubject(t.db, 'Populasi', 60)
  })

  it('answers without a chapter are not grouped; 4 attempts hidden, 5 shown', async () => {
    const four = await addChapter(t.db, s, 'Empat')
    const five = await addChapter(t.db, s, 'Lima')
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: null, attempts: 30, correct: 30 })
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: four, attempts: HEATMAP_MIN_ATTEMPTS - 1, correct: 1 })
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: five, attempts: HEATMAP_MIN_ATTEMPTS, correct: 1 })
    const data = await heatmapOf(pelajar.get)
    expect(cells(data)).toEqual([[five, 5, 1, 20, 'red']])
    await clearAnswers(t.db, pelajarId)
  })

  it('an inactive chapter is still shown (the mock does not filter on is_active)', async () => {
    const off = await addChapter(t.db, s, 'Tidak Aktif')
    await t.db.query('update chapters set is_active = false where id = $1::bigint', [off])
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: off, attempts: 5, correct: 4 })
    expect(cells(await heatmapOf(pelajar.get))).toEqual([[off, 5, 4, 80, 'green']])
    await clearAnswers(t.db, pelajarId)
  })

  it('two chapters with the same name are separate cells (grouped by id)', async () => {
    const a = await addChapter(t.db, s, 'Nama Sama')
    const b = await addChapter(t.db, s, 'Nama Sama')
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: a, attempts: 5, correct: 2 })
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: b, attempts: 6, correct: 3 })
    const data = await heatmapOf(pelajar.get)
    expect(cells(data)).toEqual([
      [a, 5, 2, 40, 'red'],
      [b, 6, 3, 50, 'amber'],
    ])
    await clearAnswers(t.db, pelajarId)
  })

  it('a shown chapter that is out of the tree (not in the curriculum) is skipped', async () => {
    const kept = await addChapter(t.db, s, 'Kekal')
    const out = await addChapter(t.db, s, 'Luar Pokok')
    await t.db.query('update chapters set in_tree = false where id = $1::bigint', [out])
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: kept, attempts: 5, correct: 5 })
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: out, attempts: 5, correct: 0 })
    expect(cells(await heatmapOf(pelajar.get))).toEqual([[kept, 5, 5, 100, 'green']])
    await clearAnswers(t.db, pelajarId)
  })
})

/* ------------------------------------------------------------------------------------------- AC 3 */

describe('AC3: percent and band edges', () => {
  let s: string
  beforeAll(async () => {
    await clearAnswers(t.db, pelajarId)
    s = await addSubject(t.db, 'Tepi', 61)
  })

  it('49.5 gives 50 amber, 79.5 gives 80 green, 0 correct 0 red, all correct 100 green', async () => {
    const half = await addChapter(t.db, s, 'A 49.5')
    const high = await addChapter(t.db, s, 'B 79.5')
    const zero = await addChapter(t.db, s, 'C kosong')
    const full = await addChapter(t.db, s, 'D penuh')
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: half, attempts: 200, correct: 99 })
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: high, attempts: 200, correct: 159 })
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: zero, attempts: 5, correct: 0 })
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: full, attempts: 6, correct: 6 })
    expect(cells(await heatmapOf(pelajar.get))).toEqual([
      [zero, 5, 0, 0, 'red'],
      [half, 200, 99, 50, 'amber'],
      [high, 200, 159, 80, 'green'],
      [full, 6, 6, 100, 'green'],
    ])
    await clearAnswers(t.db, pelajarId)
  })
})

/* ------------------------------------------------------------------------------------------- AC 4 */

describe('AC4: order', () => {
  beforeAll(async () => {
    await clearAnswers(t.db, pelajarId)
  })

  it('equal accuracy and equal name order by numeric chapter id (9... before 10..., not string order)', async () => {
    const s = await addSubject(t.db, 'Susunan', 62)
    const big = await addChapter(t.db, s, 'Sama', '1000000000')
    const small = await addChapter(t.db, s, 'Sama', '999999999')
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: big, attempts: 5, correct: 2 })
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: small, attempts: 10, correct: 4 })
    expect(cells(await heatmapOf(pelajar.get)).map((c) => c[0])).toEqual(['999999999', '1000000000'])
    await clearAnswers(t.db, pelajarId)
  })

  it('accuracy uses exact fractions: 33/100 before 2/6 although both round to 33', async () => {
    const s = await addSubject(t.db, 'Pecahan Tepat', 63)
    const third = await addChapter(t.db, s, 'A dua per enam')
    const lower = await addChapter(t.db, s, 'B tiga puluh tiga')
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: third, attempts: 6, correct: 2 })
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: lower, attempts: 100, correct: 33 })
    expect(cells(await heatmapOf(pelajar.get))).toEqual([
      [lower, 100, 33, 33, 'red'],
      [third, 6, 2, 33, 'red'],
    ])
    await clearAnswers(t.db, pelajarId)
  })

  it('subjects follow sort_order, then numeric subject id', async () => {
    const late = await addSubject(t.db, 'Akhir', 90, '1000000001')
    const tieBig = await addSubject(t.db, 'Seri Besar', 80, '1000000000')
    const tieSmall = await addSubject(t.db, 'Seri Kecil', 80, '999999998')
    const first = await addSubject(t.db, 'Awal', 70, '1000000002')
    for (const subj of [late, tieBig, tieSmall, first]) {
      const c = await addChapter(t.db, subj, `Bab ${subj}`)
      await addAnswers(t.db, pelajarId, { subjectId: subj, chapterId: c, attempts: 5, correct: 1 })
    }
    expect((await heatmapOf(pelajar.get)).subjects.map((x) => x.subjectId)).toEqual([first, tieSmall, tieBig, late])
    await clearAnswers(t.db, pelajarId)
  })
})

/* ------------------------------------------------------------------------------------------- AC 5 */

describe('AC5: own data only and the role gate', () => {
  beforeAll(async () => {
    await clearAnswers(t.db)
    await seedObservedAdmin()
    await seedObservedMaju()
  })

  it('a ?userId= (or any) query is ignored', async () => {
    const own = await heatmapOf(maju.get)
    expect(await heatmapOf(maju.get, `${HEATMAP}?userId=${adminId}`)).toEqual(own)
    expect(await heatmapOf(maju.get, `${HEATMAP}?user_id=${adminId}&subjectId=${bm}`)).toEqual(own)
    expect((await heatmapOf(pelajar2.get, `${HEATMAP}?userId=${majuId}`)).subjects).toEqual([])
  })

  it('two students each see only their own cells', async () => {
    const a = cells(await heatmapOf(maju.get)).map((c) => c[0])
    const b = cells(await heatmapOf(pelajar.get)).map((c) => c[0])
    expect(a).toEqual([ch['143'], ch['136'], ch['1']])
    expect(b).toEqual([])
  })

  it('an admin gets 200 with the admin\'s own data', async () => {
    expect(cells(await heatmapOf(admin.get))).toHaveLength(6)
  })

  it('no session is 401 UNAUTHORIZED "Unauthenticated."', async () => {
    expectError(await t.http().get(HEATMAP), 'UNAUTHORIZED', 'Unauthenticated.')
  })

  it('teacher, parent and school admin are 403 FORBIDDEN "This action is unauthorized."', async () => {
    for (const who of ['guru@demo.test', 'ibubapa@demo.test', 'adminsekolah@demo.test']) {
      const c = await loginAs(t, who)
      expectError(await c.get(HEATMAP), 'FORBIDDEN', 'This action is unauthorized.')
    }
  })

  it('a dual-role account answers by its ACTIVE role (teacher: 403)', async () => {
    const c = await loginAs(t, 'guruadmin@demo.test')
    expectError(await c.get(HEATMAP), 'FORBIDDEN', 'This action is unauthorized.')
  })
})

/* ------------------------------------------------------------------------------------------- AC 6 */

describe('AC6: agreement with the M05 answer log (BR-M25-10)', () => {
  beforeAll(async () => {
    await clearAnswers(t.db)
    await seedObservedAdmin()
    await seedObservedMaju()
  })

  it('every shown cell equals the per-chapter aggregate of the same user; shown + hidden = all answers', async () => {
    for (const [c, id] of [[admin, adminId], [maju, majuId]] as const) {
      const data = await heatmapOf(c.get)
      const agg = await t.db.query<{ chapter_id: string; n: string; c: string }>(
        `select chapter_id::text, count(*)::text as n, count(*) filter (where is_correct)::text as c from practice_answers
          where user_id = $1::bigint and chapter_id is not null and not is_test group by chapter_id`,
        [id],
      )
      const byChapter = new Map(agg.map((r) => [r.chapter_id, { attempts: Number(r.n), correct: Number(r.c) }]))
      const shown = data.subjects.flatMap((s) => s.topics)
      for (const x of shown) expect({ attempts: x.attempts, correct: x.correct }).toEqual(byChapter.get(x.chapterId))
      const hidden = [...byChapter.entries()].filter(([k]) => !shown.some((x) => x.chapterId === k)).map(([, v]) => v)
      const noChapter = await t.db.query<{ n: string }>(
        'select count(*)::text as n from practice_answers where user_id = $1::bigint and chapter_id is null and not is_test',
        [id],
      )
      expect(sum(shown).attempts + sum(hidden).attempts + Number(noChapter[0]?.n)).toBe((await totals(id)).attempts)
    }
  })

  it('the default port agrees with the SQL GROUP BY for every minimum (the BE-13 chapterAnswerCounts query)', async () => {
    const port = t.app.get(HeatmapPorts).answerCounts
    for (const min of [1, 3, 5, 6, 41]) {
      const sql = await t.db.query<{ chapter_id: string; attempts: string; correct: string }>(
        `select chapter_id::text, count(*)::text as attempts, count(*) filter (where is_correct)::text as correct
           from practice_answers where user_id = $1::bigint and chapter_id is not null and not is_test
          group by chapter_id having count(*) >= $2::bigint order by chapter_id`,
        [adminId, min],
      )
      expect(await port.chapterAnswerCounts(adminId, min, false)).toEqual(
        sql.map((r) => ({ chapterId: r.chapter_id, attempts: Number(r.attempts), correct: Number(r.correct) })),
      )
    }
  })
})

/* ------------------------------------------------------------------------------------------- AC 7 */

describe('AC7: independence from the question bank', () => {
  beforeAll(async () => {
    await clearAnswers(t.db)
  })

  it('nulling question_id and marking rows historical changes nothing; deactivating the question changes nothing', async () => {
    const q = await t.db.query<{ id: string }>(`insert into questions (source_type, live_version_no, is_active) values ('manual', 1, true) returning id::text`)
    const qid = q[0]?.id as string
    for (const [c, n, k] of [['143', 7, 3], ['136', 7, 4], ['1', 23, 19]] as const) {
      await addAnswers(t.db, majuId, { subjectId: mat, chapterId: ch[c] as string, attempts: n, correct: k, questionId: qid })
    }
    const before = await heatmapOf(maju.get)
    expect(cells(before)).toHaveLength(3)
    await t.db.query('update questions set is_active = false where id = $1::bigint', [qid])
    expect(await heatmapOf(maju.get)).toEqual(before)
    await t.db.query('update practice_answers set question_id = null, historical = true where user_id = $1::bigint', [majuId])
    expect(await heatmapOf(maju.get)).toEqual(before)
  })
})

/* ------------------------------------------------------------------------------------------- AC 9 */

describe('AC9: test mode (Mod Pelajar, is_test)', () => {
  let s: string
  let real: string
  let test: string
  beforeAll(async () => {
    await clearAnswers(t.db)
    s = await addSubject(t.db, 'Mod Ujian', 64)
    real = await addChapter(t.db, s, 'Sebenar')
    test = await addChapter(t.db, s, 'Ujian')
    // real rows of the admin, and Mod Pelajar (is_test) rows of the admin and of a student
    await addAnswers(t.db, adminId, { subjectId: s, chapterId: real, attempts: 5, correct: 5 })
    await addAnswers(t.db, adminId, { subjectId: s, chapterId: test, attempts: 6, correct: 0, isTest: true })
    await addAnswers(t.db, adminId, { subjectId: s, chapterId: real, attempts: 4, correct: 0, isTest: true })
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: test, attempts: 9, correct: 9, isTest: true })
  })

  it('real mode never counts is_test rows (admin and student)', async () => {
    expect(cells(await heatmapOf(admin.get))).toEqual([[real, 5, 5, 100, 'green']])
    expect((await heatmapOf(pelajar.get)).subjects).toEqual([])
  })

  it('Mod Pelajar reads only the caller\'s own is_test rows (own view)', async () => {
    const mp = await loginModPelajar(t as never, 'admin@demo.test')
    expect(cells(await heatmapOf(mp.get))).toEqual([
      [test, 6, 0, 0, 'red'],
    ])
  })
})

/* ------------------------------------------------------------------------------------------ ports */

describe('HeatmapPorts', () => {
  it('a second registration of the answer source throws', () => {
    // a fresh holder, so the shared app keeps its default source
    const ports = new HeatmapPorts(t.app.get(PracticeRepository))
    const fake = { chapterAnswerCounts: async () => [] }
    ports.provideAnswerCounts(fake)
    expect(() => ports.provideAnswerCounts(fake)).toThrow(/already provided/)
  })
})
