import { GuruDskpBidangListSchema, GuruDskpSkListSchema, GuruDskpSpListSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootWorkflowApp, expectError, loginAll, type Client, type WorkflowTestApp } from './helpers'

type Roles = Record<'admin' | 'teacher' | 'otherTeacher' | 'schoolAdmin' | 'student', Client>

describe('DSKP picking lists (BE-10)', () => {
  let t: WorkflowTestApp
  let c: Roles
  let tree: { subjectId: string; levelId: string; groupingId: string; groupingTitle: string; skId: string; skCode: string; spCount: number }

  beforeAll(async () => {
    t = await bootWorkflowApp()
    c = await loginAll(t)
    const [row] = await t.db.query<{ subject_id: string; level_id: string; gid: string; gtitle: string; skid: string; skcode: string; sps: string }>(
      `select g.subject_id::text, g.education_level_id::text level_id, g.id::text gid, g.title gtitle, sk.id::text skid, sk.code skcode,
              (select count(*) from curriculum_nodes sp where sp.parent_id = sk.id and sp.kind = 'sp')::text sps
         from curriculum_nodes g
         join curriculum_nodes u on u.parent_id = g.id and u.kind = 'unit'
         join curriculum_nodes sk on sk.parent_id = u.id and sk.kind = 'sk'
        where g.kind = 'grouping' and exists (select 1 from curriculum_nodes sp where sp.parent_id = sk.id and sp.kind = 'sp')
        order by g.id, sk.id limit 1`,
    )
    if (!row) throw new Error('the curriculum seed has no DSKP grouping with an SP')
    tree = { subjectId: row.subject_id, levelId: row.level_id, groupingId: row.gid, groupingTitle: row.gtitle, skId: row.skid, skCode: row.skcode, spCount: Number(row.sps) }
  })
  afterAll(async () => {
    await t.close()
  })

  const urls = (): string[] => [
    `/api/guru/dskp/bidang?subjectId=${tree.subjectId}&educationLevelId=${tree.levelId}`,
    `/api/guru/dskp/sk?bidangId=${tree.groupingId}`,
    `/api/guru/dskp/sp?skId=${tree.skId}`,
  ]

  it('401 without a session; 403 for school admin and student; teacher and admin are allowed', async () => {
    for (const url of urls()) {
      expectError(await t.http().get(url), 'UNAUTHORIZED')
      expectError(await c.schoolAdmin.get(url), 'FORBIDDEN')
      expectError(await c.student.get(url), 'FORBIDDEN')
      expect((await c.teacher.get(url)).status).toBe(200)
      expect((await c.admin.get(url)).status).toBe(200)
    }
  })

  it('bidang: a bare array of the groupings of the subject and level', async () => {
    const res = await c.teacher.get(urls()[0]!)
    expect(Array.isArray(res.body)).toBe(true)
    const list = GuruDskpBidangListSchema.parse(res.body)
    expect(list.find((b) => b.id === tree.groupingId)).toEqual({ id: tree.groupingId, code: null, name: tree.groupingTitle })
  })

  it('sk: the Standard Kandungan under the units of the bidang; sp: the Standard Pembelajaran of an sk', async () => {
    const sk = GuruDskpSkListSchema.parse((await c.teacher.get(urls()[1]!)).body)
    expect(sk.find((s) => s.id === tree.skId)?.code).toBe(tree.skCode)
    const sp = GuruDskpSpListSchema.parse((await c.teacher.get(urls()[2]!)).body)
    expect(sp).toHaveLength(tree.spCount)
    expect(sp.every((s) => s.code.length > 0 && s.description.length > 0)).toBe(true)
  })

  it('a missing, malformed or unknown value answers 200 []', async () => {
    for (const url of [
      '/api/guru/dskp/bidang', `/api/guru/dskp/bidang?subjectId=${tree.subjectId}`, `/api/guru/dskp/bidang?educationLevelId=${tree.levelId}`,
      '/api/guru/dskp/bidang?subjectId=abc&educationLevelId=1', '/api/guru/dskp/bidang?subjectId=987654&educationLevelId=987654',
      '/api/guru/dskp/sk', '/api/guru/dskp/sk?bidangId=abc', '/api/guru/dskp/sk?bidangId=987654', `/api/guru/dskp/sk?bidangId=${tree.skId}`,
      '/api/guru/dskp/sp', '/api/guru/dskp/sp?skId=abc', '/api/guru/dskp/sp?skId=987654', `/api/guru/dskp/sp?skId=${tree.groupingId}`,
    ]) {
      const res = await c.teacher.get(url)
      expect(res.status, url).toBe(200)
      expect(res.body, url).toEqual([])
    }
  })

  it('the lookups are rate limited per user (429)', async () => {
    const limited = await bootWorkflowApp({ env: { THROTTLE_ADMIN_READ_PER_MINUTE: '3' } })
    try {
      const who = (await loginAll(limited)).teacher
      for (let i = 0; i < 3; i += 1) expect((await who.get('/api/guru/dskp/sk')).status).toBe(200)
      expectError(await who.get('/api/guru/dskp/sk'), 'RATE_LIMITED')
    } finally {
      await limited.close()
    }
  })
})
