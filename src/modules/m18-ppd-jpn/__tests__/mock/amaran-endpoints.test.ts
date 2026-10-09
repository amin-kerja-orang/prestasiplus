/**
 * SRS M18 §7 #21, #22, #24, #30: happy paths, role / scope rules (401 / 403 / 404 / 422), the CSV
 * contract (§7.2) and that the endpoints read the same numbers as the public `risk` / `amaran` exports.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest'

import { CLOCK_ANCHOR_MS } from '@/lib/time'
import type { MockRuntime } from '@/mock/index'
import { users, type UserRow } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'

import {
  amaran,
  amaranExportAudit,
  amaranInterventions,
  correctionSubjects,
  m18SeedIssues,
  risk,
  type EffectivenessReport,
  type SchoolRiskData,
  type SummaryData,
} from '../../mock'
import { MemoryStorage, bootM18, dataAs, getAs } from './boot'

vi.setConfig({ testTimeout: 180_000 })

const now = CLOCK_ANCHOR_MS
let runtime: MockRuntime
let admin: UserRow
let schoolAdmin: UserRow
let teacher8880: UserRow
let ppdSelangor: UserRow
let jpnJohor: UserRow
let student: UserRow

type Role = NonNullable<Parameters<typeof users.adminList>[0]>['role']
const firstOf = (role: Role) => users.adminList({ role, page: 1, pageSize: 5 }).rows[0] as UserRow

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootM18()).runtime
  admin = firstOf('admin')
  student = firstOf('student')
  schoolAdmin = users
    .adminList({ role: 'school_admin', page: 1, pageSize: 500 })
    .rows.find((u) => u.schoolId !== null && u.schoolId !== 8880) as UserRow
  teacher8880 = users
    .adminList({ role: 'teacher', schoolId: 8880, page: 1, pageSize: 10 })
    .rows.sort((a, b) => a.id - b.id)[0] as UserRow
  ppdSelangor = users.get(5701) as UserRow
  jpnJohor = users.get(5711) as UserRow
}, 600_000)

describe('seed (finalise)', () => {
  it('found every owner anchor', () => {
    expect(m18SeedIssues()).toEqual([])
  })

  it('DATA-M18-01: interventions 2 and 3 for pupil 3215 at 8880, both belum_dinilai', () => {
    const rows = amaranInterventions.forSchool(8880)
    expect(rows.map((r) => r.id).sort()).toEqual([2, 3])
    expect(rows.every((r) => r.studentId === 3215 && r.effectiveness === 'belum_dinilai')).toBe(
      true,
    )
    expect(rows.map((r) => r.type).sort()).toEqual(['kaunseling', 'mentor_rakan'])
    expect(rows[0]?.teacherId).toBe(teacher8880.id)
  })

  it('DATA-M18-04: 8880 BM / BI / MATH, 8765 nine subjects, 2710 five, pupilsWeak = pupils', () => {
    expect(correctionSubjects.forSchool(8880)).toHaveLength(3)
    expect(correctionSubjects.forSchool(8765)).toHaveLength(9)
    expect(correctionSubjects.forSchool(2710)).toHaveLength(5)
    for (const id of [8880, 8765, 2710])
      expect(correctionSubjects.forSchool(id).every((r) => r.pupilsWeak === r.pupils)).toBe(true)
  })
})

describe('#21 GET /api/amaran/schools/:id', () => {
  it('401 without a session', async () => {
    expect((await getAs(runtime, null, '/api/amaran/schools/8880')).status).toBe(401)
  })

  it('403 for a pupil', async () => {
    expect((await getAs(runtime, student.id, '/api/amaran/schools/8880')).status).toBe(403)
  })

  it('404 for an unknown school (admin and school admin alike)', async () => {
    expect((await getAs(runtime, admin.id, '/api/amaran/schools/999999999')).status).toBe(404)
    expect((await getAs(runtime, schoolAdmin.id, '/api/amaran/schools/999999999')).status).toBe(404)
  })

  it('admin: school 8880 payload = tally 59 / 0 / 0 / 59, weakness BM / BI / MT, 59 pupils score descending', async () => {
    const d = await dataAs<SchoolRiskData>(runtime, admin.id, '/api/amaran/schools/8880')
    expect(d.school).toMatchObject({ id: 8880 })
    expect(d.levelFilter).toBeNull()
    expect(d.tally).toMatchObject({ green: 0, yellow: 0, red: 59, total: 59 })
    expect(d.tally.pct).toEqual({ green: 0, yellow: 0, red: 100 })
    expect(d.weakness.map((w) => `${w.weak}/${w.total} ${w.pct}`)).toEqual([
      '1/1 100',
      '1/1 100',
      '1/1 100',
    ])
    expect(d.pupils).toHaveLength(59)
    expect(d.pupils.map((p) => p.rank)).toEqual(d.pupils.map((_, i) => i + 1))
    for (let i = 1; i < d.pupils.length; i++)
      expect((d.pupils[i - 1] as { score: number }).score).toBeGreaterThanOrEqual(
        (d.pupils[i] as { score: number }).score,
      )
  })

  it('reads the same numbers as risk.forSchool and amaran.schoolRisk (S0 and S4 identity)', async () => {
    for (const id of [8880, 7780, 1, 8765]) {
      const d = await dataAs<SchoolRiskData>(runtime, admin.id, `/api/amaran/schools/${String(id)}`)
      const t = risk.forSchool(id, { now })
      expect(d.tally).toMatchObject({
        green: t.onTrack,
        yellow: t.watch,
        red: t.high,
        total: t.total,
      })
      expect(d.pupils).toEqual(amaran.schoolRisk(id, { now })?.pupils)
    }
  })

  it('7780: 17 pupils, 15 x 100 then 2 x 80, with the FN-M18-4.1.3 cell texts', async () => {
    const d = await dataAs<SchoolRiskData>(runtime, admin.id, '/api/amaran/schools/7780')
    expect(d.pupils.map((p) => p.score)).toEqual([...Array(15).fill(100), 80, 80])
    const never = d.pupils.at(-1)
    expect(never).toMatchObject({
      accuracyText: 'Tiada data latihan',
      engagementText: 'Tiada aktiviti',
      masteryText: 'Tiada data penguasaan',
      status: 'high',
    })
    const dated = d.pupils[0]
    expect(dated?.accuracyText).toBe('Tiada data')
    expect(dated?.engagementText).toMatch(/^Terakhir aktif: 2026-02-2[678]$/)
    expect(dated?.masteryText).toBe('Tiada data')
  })

  it('?tingkatan=T4 / T5 filters class members of the level and sets levelFilter', async () => {
    const t4 = await dataAs<SchoolRiskData>(
      runtime,
      admin.id,
      '/api/amaran/schools/8880?tingkatan=T4',
    )
    expect(t4.levelFilter).toBe('T4')
    expect(t4.levelSuffix).toBe(' — Tingkatan 4')
    expect(t4.tally.total).toBe(risk.forSchool(8880, { now, tingkatan: 4 }).total)
    expect(t4.pupils).toHaveLength(t4.tally.total)
    const t5 = await dataAs<SchoolRiskData>(
      runtime,
      admin.id,
      '/api/amaran/schools/8880?tingkatan=T5',
    )
    expect(t5.levelFilter).toBe('T5')
    expect(t5.tally.total).toBe(risk.forSchool(8880, { now, tingkatan: 5 }).total)
  })

  it('school admin: own school 200, another school 403', async () => {
    const own = schoolAdmin.schoolId as number
    expect(
      (await getAs(runtime, schoolAdmin.id, `/api/amaran/schools/${String(own)}`)).status,
    ).toBe(200)
    expect((await getAs(runtime, schoolAdmin.id, '/api/amaran/schools/8880')).status).toBe(403)
  })

  it('PPD officer: own district only; JPN officer: own state only', async () => {
    expect((await getAs(runtime, ppdSelangor.id, '/api/amaran/schools/8880')).status).toBe(403)
    expect((await getAs(runtime, jpnJohor.id, '/api/amaran/schools/8880')).status).toBe(200)
    expect((await getAs(runtime, jpnJohor.id, '/api/amaran/schools/7780')).status).toBe(403)
    const hulu = schools.get(8082)
    expect(hulu?.district).not.toBe(ppdSelangor.ppdDistrict)
  })

  it('teacher: a school of own classes only', async () => {
    expect((await getAs(runtime, teacher8880.id, '/api/amaran/schools/8880')).status).toBe(200)
    expect((await getAs(runtime, teacher8880.id, '/api/amaran/schools/7780')).status).toBe(403)
  })
})

describe('#22 GET /api/amaran/summary', () => {
  it('401 / 403 / 422 / 404', async () => {
    expect((await getAs(runtime, null, '/api/amaran/summary')).status).toBe(401)
    expect((await getAs(runtime, student.id, '/api/amaran/summary')).status).toBe(403)
    expect((await getAs(runtime, admin.id, '/api/amaran/summary?scope=galaxy')).status).toBe(422)
    expect((await getAs(runtime, admin.id, '/api/amaran/summary?scope=school')).status).toBe(422)
    expect(
      (await getAs(runtime, admin.id, '/api/amaran/summary?scope=school&schoolId=999999999'))
        .status,
    ).toBe(404)
    expect(
      (
        await getAs(
          runtime,
          admin.id,
          '/api/amaran/summary?scope=district&district=NOWHERE&state=Perak',
        )
      ).status,
    ).toBe(404)
  })

  it('admin without scope: the preview district PPD BATANG PADANG (33 pupils, both schools once)', async () => {
    const d = await dataAs<SummaryData>(runtime, admin.id, '/api/amaran/summary')
    expect(d.scope).toBe('district')
    expect(d.title).toBe('PPD BATANG PADANG')
    expect(d.tally).toMatchObject({ green: 0, yellow: 0, red: 33, total: 33 })
    expect(d.schools?.map((s) => [s.schoolId, s.pupils])).toEqual([
      [7780, 17],
      [1, 16],
    ])
    expect(d.schools?.map((s) => s.avgScore)).toEqual([97.6, 97.5])
    expect(d.kombo.pupils).toBe(33)
    expect(d.generatedAt).toBeGreaterThan(0)
  })

  it('scope=school (school_id alias too): tally, weakness and kombo of 8880', async () => {
    const a = await dataAs<SummaryData>(
      runtime,
      admin.id,
      '/api/amaran/summary?scope=school&schoolId=8880',
    )
    const b = await dataAs<SummaryData>(
      runtime,
      admin.id,
      '/api/amaran/summary?scope=school&school_id=8880',
    )
    expect(b).toEqual(a)
    expect(a.title).toBe(schools.get(8880)?.name)
    expect(a.pupilsLine).toBe('59 pelajar')
    expect(a.tally.total).toBe(59)
    expect(a.weakness).toHaveLength(3)
    expect(a.kombo.pupils).toBe(59)
  })

  it('scope=state for the JPN officer: Johor holds the KLUANG pupils', async () => {
    const d = await dataAs<SummaryData>(runtime, jpnJohor.id, '/api/amaran/summary')
    expect(d.scope).toBe('state')
    expect(d.title).toBe('Negeri Johor')
    expect(d.tally.total).toBeGreaterThanOrEqual(135)
    expect(d.schools?.some((s) => s.schoolId === 8880)).toBe(true)
  })

  it('403 out of scope: PPD officer for another district or a state; school admin for district / state', async () => {
    expect(
      (await getAs(runtime, ppdSelangor.id, '/api/amaran/summary?scope=school&schoolId=8880'))
        .status,
    ).toBe(403)
    expect(
      (await getAs(runtime, ppdSelangor.id, '/api/amaran/summary?scope=state&state=Selangor'))
        .status,
    ).toBe(403)
    expect(
      (
        await getAs(
          runtime,
          schoolAdmin.id,
          '/api/amaran/summary?scope=district&district=PPD%20KLUANG&state=Johor',
        )
      ).status,
    ).toBe(403)
    expect(
      (await getAs(runtime, schoolAdmin.id, '/api/amaran/summary?scope=school&schoolId=8880'))
        .status,
    ).toBe(403)
  })

  it('school admin without scope: the own school', async () => {
    const d = await dataAs<SummaryData>(runtime, schoolAdmin.id, '/api/amaran/summary')
    expect(d.scope).toBe('school')
    expect(d.tally.total).toBe(risk.forSchool(schoolAdmin.schoolId as number, { now }).total)
  })
})

describe('#24 GET /api/amaran/effectiveness', () => {
  it('401 without a session; 403 for officers and pupils (no own school)', async () => {
    expect((await getAs(runtime, null, '/api/amaran/effectiveness')).status).toBe(401)
    expect((await getAs(runtime, ppdSelangor.id, '/api/amaran/effectiveness')).status).toBe(403)
    expect((await getAs(runtime, jpnJohor.id, '/api/amaran/effectiveness')).status).toBe(403)
    expect((await getAs(runtime, student.id, '/api/amaran/effectiveness')).status).toBe(403)
  })

  it('teacher of 8880: the report of 8880 (2 interventions, none evaluated)', async () => {
    const d = await dataAs<{ school: { id: number; name: string }; report: EffectivenessReport }>(
      runtime,
      teacher8880.id,
      '/api/amaran/effectiveness',
    )
    expect(d.school.id).toBe(8880)
    expect(d.report.cards).toMatchObject({
      total: 2,
      berkesan: 0,
      evaluated: 0,
      rate: 0,
      needsAction: 0,
      notEvaluated: 2,
    })
    expect(d.report.doughnut).toEqual([0, 0, 0, 2])
    expect(d.report.byType).toEqual([
      { type: 'kaunseling', label: 'Sesi Kaunseling', count: 1 },
      { type: 'mentor_rakan', label: 'Mentor Rakan Sebaya', count: 1 },
    ])
    expect(d.report.byTeacher).toHaveLength(1)
    expect(d.report.byTeacher[0]).toMatchObject({ total: 2, rate: null })
    expect(d.report.followUps).toHaveLength(2)
    expect(d.report.bySchool).toHaveLength(1)
    // the clock is 2026-09-25: the 6 months Apr 2026 ... Sep 2026, the 13 Apr rows in the first bucket
    expect(d.report.trend.labels).toEqual([
      'Apr 2026',
      'Mei 2026',
      'Jun 2026',
      'Jul 2026',
      'Ogo 2026',
      'Sep 2026',
    ])
    expect(d.report.trend.data).toEqual([2, 0, 0, 0, 0, 0])
  })

  it('admin: school 127 (S21), which has no records yet', async () => {
    const d = await dataAs<{ school: { id: number }; report: EffectivenessReport }>(
      runtime,
      admin.id,
      '/api/amaran/effectiveness',
    )
    expect(d.school.id).toBe(127)
    expect(d.report.cards).toMatchObject({ total: 0, rate: 0, needsAction: 0, notEvaluated: 0 })
  })

  it('school admin: the own school', async () => {
    const d = await dataAs<{ school: { id: number } }>(
      runtime,
      schoolAdmin.id,
      '/api/amaran/effectiveness',
    )
    expect(d.school.id).toBe(schoolAdmin.schoolId)
  })
})

describe('#30 GET /api/amaran/export/school/:id', () => {
  it('401 / 403 / 404', async () => {
    expect((await getAs(runtime, null, '/api/amaran/export/school/8880')).status).toBe(401)
    expect((await getAs(runtime, student.id, '/api/amaran/export/school/8880')).status).toBe(403)
    expect((await getAs(runtime, teacher8880.id, '/api/amaran/export/school/8880')).status).toBe(
      403,
    )
    expect((await getAs(runtime, schoolAdmin.id, '/api/amaran/export/school/8880')).status).toBe(
      403,
    )
    expect((await getAs(runtime, ppdSelangor.id, '/api/amaran/export/school/8880')).status).toBe(
      403,
    )
    expect((await getAs(runtime, admin.id, '/api/amaran/export/school/999999999')).status).toBe(404)
  })

  it('admin: attachment amaran-sekolah-8880-20260925.csv, BOM, CRLF, 59 rows, no personal contact data', async () => {
    const r = await getAs<Blob>(runtime, admin.id, '/api/amaran/export/school/8880')
    expect(r.status).toBe(200)
    expect(r.headers['content-type']).toContain('text/csv')
    expect(r.headers['content-disposition']).toContain('amaran-sekolah-8880-20260925.csv')
    expect(r.headers['cache-control']).toBe('no-store')
    // Blob.text() drops the BOM, so read the bytes.
    const bytes = new Uint8Array(await r.body.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const text = new TextDecoder().decode(bytes.slice(3))
    const lines = text.split('\r\n')
    expect(lines.at(-1)).toBe('')
    expect(lines[0]).toBe(
      'Bil,Pelajar,Tingkatan / Kelas,Skor Risiko,Status,Ketepatan,Penglibatan,Penguasaan',
    )
    expect(lines.length - 2).toBe(59)
    expect(text).not.toMatch(/@|\d{6}-\d{2}-\d{4}|icNumber|telefon/i)
    expect(lines[1]).toMatch(/^1,/)
    expect(amaranExportAudit().some((e) => e.schoolId === 8880 && e.viewerId === admin.id)).toBe(
      true,
    )
  })

  it('school admin: own school allowed; JPN officer in the state allowed', async () => {
    const own = schoolAdmin.schoolId as number
    expect(
      (await getAs(runtime, schoolAdmin.id, `/api/amaran/export/school/${String(own)}`)).status,
    ).toBe(200)
    expect((await getAs(runtime, jpnJohor.id, '/api/amaran/export/school/8880')).status).toBe(200)
  })

  it('the CSV lists the same pupils as #21 (names and scores), only that school', async () => {
    const r = await getAs<Blob>(runtime, admin.id, '/api/amaran/export/school/7780')
    const rows = (await r.body.text()).trim().split('\r\n').slice(1)
    const d = await dataAs<SchoolRiskData>(runtime, admin.id, '/api/amaran/schools/7780')
    expect(rows).toHaveLength(d.pupils.length)
    rows.forEach((line, i) => {
      expect(line).toContain((d.pupils[i] as { name: string }).name)
      expect(line).toContain((d.pupils[i] as { score: number }).score.toFixed(1))
    })
  })
})
