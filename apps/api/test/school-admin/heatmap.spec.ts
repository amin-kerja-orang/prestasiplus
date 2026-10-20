import { ErrorBodySchema, SchoolAdminDskpHeatmapSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { TestDatabase } from '../support/db'
import { ADMIN, apiOf, bootSchoolAdminApp, login, SCHOOL_ADMIN, schoolIdOf, STUDENT, TEACHER, type Api, type SchoolAdminTestApp } from './helpers'
import { addLevel, addPupil, addSchoolAdmin, addSession, addSubject } from './reports-fixtures'

async function node(db: TestDatabase, o: { subject: string; level: string; kind: string; code: string; title: string; parent?: string | null; order?: number; edition?: string }): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `insert into curriculum_nodes (subject_id, education_level_id, kind, code, title, parent_id, sort_order, edition, is_elective, created_at, updated_at)
     values ($1::bigint, $2::bigint, $3, $4, $5, $6::bigint, $7, $8, false, now(), now()) returning id::text`,
    [o.subject, o.level, o.kind, o.code, o.title, o.parent ?? null, o.order ?? 0, o.edition ?? 'KSSM 2018'],
  )
  return rows[0]?.id as string
}

/** DB spec: needs Docker/Testcontainers. */
describe('GET /admin-sekolah/dskp-heatmap', () => {
  let t: SchoolAdminTestApp
  let admin: Api
  let adminB: Api
  let s1: string
  let s2: string
  let mat: string
  let bm: string

  beforeAll(async () => {
    t = await bootSchoolAdminApp()
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
    const t4 = await addLevel(t.db, 'T4', 'Tingkatan 4', 10)
    const t5 = await addLevel(t.db, 'T5', 'Tingkatan 5', 11)
    mat = await addSubject(t.db, 'MATHM', 'Matematik Ujian')
    bm = await addSubject(t.db, 'BMHM', 'Bahasa Ujian')
    const kosong = await addSubject(t.db, 'KOSONGHM', 'Kosong Ujian')
    for (const [subject, level] of [[mat, t4], [mat, t5], [bm, t4], [kosong, t4]] as const) {
      await t.db.query(`insert into subject_levels (subject_id, education_level_id) values ($1::bigint, $2::bigint)`, [subject, level])
    }
    // Matematik T4: one bidang -> unit -> sk -> two SP; a second bidang with one SP. Bahasa T4: one bidang, one SP. Kosong: no SP.
    const b1 = await node(t.db, { subject: mat, level: t4, kind: 'grouping', code: 'nombor', title: 'Nombor dan Operasi', order: 1 })
    const u1 = await node(t.db, { subject: mat, level: t4, kind: 'unit', code: '1.0', title: 'Unit Satu', parent: b1 })
    const sk1 = await node(t.db, { subject: mat, level: t4, kind: 'sk', code: '1.1', title: 'Standard Kandungan Satu', parent: u1 })
    await node(t.db, { subject: mat, level: t4, kind: 'sp', code: '1.1.1', title: 'Standard Pembelajaran Satu', parent: sk1, order: 1 })
    await node(t.db, { subject: mat, level: t4, kind: 'sp', code: '1.1.2', title: 'Standard Pembelajaran Dua', parent: sk1, order: 2 })
    const b2 = await node(t.db, { subject: mat, level: t4, kind: 'grouping', code: 'ukuran', title: 'Ukuran', order: 2 })
    const u2 = await node(t.db, { subject: mat, level: t4, kind: 'unit', code: '2.0', title: 'Unit Dua', parent: b2 })
    const sk2 = await node(t.db, { subject: mat, level: t4, kind: 'sk', code: '2.1', title: 'Standard Kandungan Dua', parent: u2 })
    await node(t.db, { subject: mat, level: t4, kind: 'sp', code: '2.1.1', title: 'Standard Pembelajaran Tiga', parent: sk2 })
    const bb = await node(t.db, { subject: bm, level: t4, kind: 'grouping', code: 'bacaan', title: 'Bacaan', order: 1 })
    const ub = await node(t.db, { subject: bm, level: t4, kind: 'unit', code: '1.0', title: 'Unit Bahasa', parent: bb })
    const skb = await node(t.db, { subject: bm, level: t4, kind: 'sk', code: '1.1', title: 'SK Bahasa', parent: ub })
    await node(t.db, { subject: bm, level: t4, kind: 'sp', code: '1.1.1', title: 'SP Bahasa', parent: skb })
    // Matematik T5 has one SP only.
    const g5 = await node(t.db, { subject: mat, level: t5, kind: 'grouping', code: 'g5', title: 'Bidang Lima', order: 1 })
    const u5 = await node(t.db, { subject: mat, level: t5, kind: 'unit', code: '5.0', title: 'Unit Lima', parent: g5 })
    const k5 = await node(t.db, { subject: mat, level: t5, kind: 'sk', code: '5.1', title: 'SK Lima', parent: u5 })
    await node(t.db, { subject: mat, level: t5, kind: 'sp', code: '5.1.1', title: 'SP Lima', parent: k5 })

    // Pupils with practice in Matematik: the heatmap must still show 0/0 (no SP link exists).
    for (let i = 1; i <= 5; i++) {
      const p = await addPupil(t.db, s1, `Murid Peta ${i}`)
      await addSession(t.db, p, { questions: 10, correct: 9, completedAt: '2026-10-19T08:00:00+08:00', subjectId: mat })
    }
    await addSchoolAdmin(t.db, s2, 'admin.b@report.test')
    admin = apiOf(await login(t, SCHOOL_ADMIN))
    adminB = apiOf(await login(t, 'admin.b@report.test'))
  })
  afterAll(async () => {
    await t.close()
  })

  it('default: T4, the first subject by name, the real DSKP structure with every SP belum (0/0, pct null)', async () => {
    const res = await admin.get('/admin-sekolah/dskp-heatmap')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const h = SchoolAdminDskpHeatmapSchema.parse(res.body.data)
    expect(h.school).toEqual({ id: s1, name: 'SMK Demo Satu' })
    expect(h.level).toEqual({ code: 't4', name: 'Tingkatan 4' })
    // Kosong Ujian has no SP so it is not offered; Bahasa comes before Matematik.
    expect(h.subjects.map((s) => s.name)).toEqual(['Bahasa Ujian', 'Matematik Ujian'])
    expect(h.subject).toEqual({ id: bm, name: 'Bahasa Ujian' })
    expect(h.caption).toBe('KSSM Bahasa Ujian Tingkatan 4')
    expect(h.bidang).toHaveLength(1)
    expect(h.bidang[0]).toMatchObject({ code: null, name: 'Bacaan' })
    for (const sp of h.bidang.flatMap((b) => b.sp)) expect(sp).toMatchObject({ answered: 0, correct: 0, pct: null, status: 'belum' })
  })

  it('subjectId selects a subject; bidang and SP keep their printed order', async () => {
    const h = SchoolAdminDskpHeatmapSchema.parse((await admin.get(`/admin-sekolah/dskp-heatmap?subjectId=${mat}`)).body.data)
    expect(h.subject?.id).toBe(mat)
    expect(h.bidang.map((b) => b.name)).toEqual(['Nombor dan Operasi', 'Ukuran'])
    expect(h.bidang[0]?.sp.map((s) => s.code)).toEqual(['1.1.1', '1.1.2'])
    expect(h.bidang[1]?.sp.map((s) => s.code)).toEqual(['2.1.1'])
    // The pupils of the school did practise Matematik, yet no SP shows a result (no honest topic -> SP link exists).
    for (const sp of h.bidang.flatMap((b) => b.sp)) expect(sp.status).toBe('belum')
  })

  it('an unknown subjectId falls back to the first subject; tingkatan T5 / t5 switches level; anything else is T4', async () => {
    const unknown = SchoolAdminDskpHeatmapSchema.parse((await admin.get('/admin-sekolah/dskp-heatmap?subjectId=999999')).body.data)
    expect(unknown.subject?.id).toBe(bm)
    const t5 = SchoolAdminDskpHeatmapSchema.parse((await admin.get(`/admin-sekolah/dskp-heatmap?tingkatan=t5`)).body.data)
    expect(t5.level).toEqual({ code: 't5', name: 'Tingkatan 5' })
    expect(t5.subjects.map((s) => s.name)).toEqual(['Matematik Ujian'])
    expect(t5.caption).toBe('KSSM Matematik Ujian Tingkatan 5')
    const odd = SchoolAdminDskpHeatmapSchema.parse((await admin.get('/admin-sekolah/dskp-heatmap?tingkatan=T9')).body.data)
    expect(odd.level.code).toBe('t4')
  })

  it('a school-B admin gets school B in the envelope and never the pupils of school A', async () => {
    const res = await adminB.get(`/admin-sekolah/dskp-heatmap?schoolId=${s1}`)
    const h = SchoolAdminDskpHeatmapSchema.parse(res.body.data)
    expect(h.school.id).toBe(s2)
    expect(JSON.stringify(res.body)).not.toContain('Murid Peta')
  })

  it('401 without a session; 403 for admin, teacher and student', async () => {
    expect((await t.http().get('/api/admin-sekolah/dskp-heatmap')).status).toBe(401)
    for (const who of [ADMIN, TEACHER, STUDENT]) {
      const res = await apiOf(await login(t, who)).get('/admin-sekolah/dskp-heatmap')
      expect(res.status, who).toBe(403)
      expect(ErrorBodySchema.parse(res.body).error.code).toBe('FORBIDDEN')
    }
  })
})
