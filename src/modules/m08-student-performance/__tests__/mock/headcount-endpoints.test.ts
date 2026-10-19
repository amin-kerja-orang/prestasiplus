/**
 * M08-T1b endpoints (SRS M08 v1.12 §7 #12–#17, #24–#29; §9; OD-R3): happy paths, validation, access per
 * role, the writes and their effect on the S1 / S3 figures (the fingerprint of the reader), and the CSV.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import type {
  HeadcountDashboard,
  HeadcountDetail,
  HeadcountFormOptions,
  HeadcountListItem,
  HeadcountStudent,
  HeadcountSummary,
} from '../../api/headcount-types'
import type { SchoolPerformance } from '../../api/types'
import { headcount } from '../../mock'
import { MemoryStorage, bootM08 } from './boot'
import {
  ADMIN,
  ADMIN_SEKOLAH,
  GURU,
  IBU_BAPA,
  PELAJAR,
  PPD,
  call,
  data,
  type ErrorBody,
} from './headcount-helpers'

let runtime: MockRuntime

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootM08()).runtime
}, 180_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

const get = <T>(as: number | null, url: string) => data<T>(runtime, as, 'GET', url)
const send = (as: number | null, method: 'GET' | 'POST' | 'DELETE', url: string, body?: unknown) =>
  call<ErrorBody>(runtime, as, method, url, body)

// ---------------------------------------------------------------------------------------------
// Access (§9, OD-R3)
// ---------------------------------------------------------------------------------------------

describe('access', () => {
  const routes: ['GET' | 'POST' | 'DELETE', string, unknown?][] = [
    ['GET', '/api/headcounts'],
    ['GET', '/api/headcounts/dashboard'],
    ['GET', '/api/headcounts/form-options'],
    ['POST', '/api/headcounts', {}],
    ['POST', '/api/headcounts/auto-setup', { levels: [11] }],
    ['GET', '/api/headcounts/students/3201'],
    ['GET', '/api/headcounts/213/summary'],
    ['GET', '/api/headcounts/213'],
    ['POST', '/api/headcounts/213/reset'],
    ['DELETE', '/api/headcounts/213'],
    ['POST', '/api/headcounts/213/drop-students', { action: 'drop', studentIds: [3201] }],
    ['GET', '/api/headcounts/213/export'],
  ]

  it('a request without a session is 401 on every route', async () => {
    for (const [method, url, body] of routes) {
      expect((await send(null, method, url, body)).status, `${method} ${url}`).toBe(401)
    }
  })

  it.each([
    ['pelajar', PELAJAR],
    ['ibu bapa', IBU_BAPA],
    ['pegawai PPD', PPD],
  ])('%s is 403 on every route (the headcount pages are not theirs)', async (_name, userId) => {
    for (const [method, url, body] of routes) {
      expect((await send(userId, method, url, body)).status, `${method} ${url}`).toBe(403)
    }
  })

  it('an unknown config is 404 for the roles that may use the module (checked before 403)', async () => {
    for (const as of [ADMIN, GURU, ADMIN_SEKOLAH]) {
      for (const url of ['/api/headcounts/99999', '/api/headcounts/99999/summary']) {
        expect((await send(as, 'GET', url)).status).toBe(404)
      }
      expect((await send(as, 'GET', '/api/headcounts/99999/export')).status).toBe(404)
      expect((await send(as, 'POST', '/api/headcounts/99999/reset')).status).toBe(404)
      expect((await send(as, 'DELETE', '/api/headcounts/99999')).status).toBe(404)
      expect(
        (
          await send(as, 'POST', '/api/headcounts/99999/drop-students', {
            action: 'drop',
            studentIds: [1],
          })
        ).status,
      ).toBe(404)
    }
  })

  it('a config of another owner / school is 403 (guru: not own; school admin: other school)', async () => {
    // Config 213 is teacher 4503's class 516 at school 8880.
    for (const as of [GURU, ADMIN_SEKOLAH]) {
      for (const url of [
        '/api/headcounts/213',
        '/api/headcounts/213/summary',
        '/api/headcounts/213/export',
      ]) {
        expect((await send(as, 'GET', url)).status, `${String(as)} ${url}`).toBe(403)
      }
      expect((await send(as, 'POST', '/api/headcounts/213/reset')).status).toBe(403)
      expect((await send(as, 'DELETE', '/api/headcounts/213')).status).toBe(403)
      expect(
        (
          await send(as, 'POST', '/api/headcounts/213/drop-students', {
            action: 'drop',
            studentIds: [3201],
          })
        ).status,
      ).toBe(403)
    }
    expect(headcount.config(213)).toBeDefined()
  })

  it('the admin opens any config by URL; the school admin and guru their own school / configs', async () => {
    expect((await send(ADMIN, 'GET', '/api/headcounts/213')).status).toBe(200)
    expect((await send(ADMIN, 'GET', '/api/headcounts/501')).status).toBe(200)
    expect((await send(ADMIN_SEKOLAH, 'GET', '/api/headcounts/501')).status).toBe(200)
    expect((await send(GURU, 'GET', '/api/headcounts/501')).status).toBe(200)
  })

  it('a bad path id is a 404 (no route)', async () => {
    expect((await send(ADMIN, 'GET', '/api/headcounts/abc')).status).toBe(404)
  })
})

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

describe('#12 list', () => {
  it('guru: the own six configs, newest first', async () => {
    const list = await get<HeadcountListItem[]>(GURU, '/api/headcounts')
    expect(list.map((c) => c.id)).toEqual([504, 501, 502, 503, 505, 506])
    expect(list[1]).toEqual({
      id: 501,
      className: '5 MARIKH - Kimia',
      subjectName: 'Kimia',
      levelName: 'Tingkatan 5',
      year: 2026,
      mode: 'auto',
      activeOtrs: 3,
      students: 8,
    })
    expect(list.find((c) => c.id === 502)?.mode).toBe('manual')
  })

  it('admin and school admin own no config: the empty state (S12)', async () => {
    expect(await get<HeadcountListItem[]>(ADMIN, '/api/headcounts')).toEqual([])
    expect(await get<HeadcountListItem[]>(ADMIN_SEKOLAH, '/api/headcounts')).toEqual([])
  })
})

describe('#13 dashboard', () => {
  it('guru: 6 configs, 48 students, On Track 3, Off Track 3, no data 42 (50 %)', async () => {
    const { configs } = await get<HeadcountDashboard>(GURU, '/api/headcounts/dashboard')
    expect(configs).toHaveLength(6)
    const sum = (f: (c: HeadcountDashboard['configs'][number]) => number) =>
      configs.reduce((a, c) => a + f(c), 0)
    expect(sum((c) => c.totalStudents)).toBe(48)
    expect(sum((c) => c.onTrack)).toBe(3)
    expect(sum((c) => c.offTrack)).toBe(3)
    expect(sum((c) => c.noData)).toBe(42)
    const c501 = configs.find((c) => c.id === 501)
    expect(c501).toMatchObject({ level: 11, onTrack: 2, offTrack: 2, noData: 4, totalStudents: 8 })
    expect(c501?.chart.labels).toEqual(['OTR1', 'OTR2', 'OTR3'])
    // Class means per OTR: targets 62, 58, 52, 45 → 54.3; ARs 65, 50, 52, 30 → 49.3.
    expect(c501?.chart.target[0]).toBe(54.3)
    expect(c501?.chart.actual[0]).toBe(49.3)
    expect(c501?.chart.actual[2]).toBeNull()
  })

  it('the Tingkatan 4 filter (client side) leaves config 506: 1 config, 8 students, nothing tracked', async () => {
    const { configs } = await get<HeadcountDashboard>(GURU, '/api/headcounts/dashboard')
    const t4 = configs.filter((c) => c.level === 10)
    expect(t4.map((c) => [c.id, c.totalStudents, c.onTrack, c.offTrack, c.noData])).toEqual([
      [506, 8, 0, 0, 8],
    ])
  })

  it('admin: empty', async () => {
    expect(await get<HeadcountDashboard>(ADMIN, '/api/headcounts/dashboard')).toEqual({
      configs: [],
    })
  })
})

describe('#14 form options', () => {
  it('guru: own active classes, 31 subjects A-Z with codes, levels 10 / 11, the current year', async () => {
    const o = await get<HeadcountFormOptions>(GURU, '/api/headcounts/form-options')
    expect(o.classes.map((c) => c.id).sort()).toEqual([2001, 2002])
    expect(o.subjects).toHaveLength(31)
    const names = o.subjects.map((s) => s.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    expect(o.subjects.find((s) => s.id === 3)).toEqual({ id: 3, name: 'Matematik', code: 'MATH' })
    expect(o.levels).toEqual([
      { id: 10, name: 'Tingkatan 4' },
      { id: 11, name: 'Tingkatan 5' },
    ])
    expect(o.defaultYear).toBe(2026)
  })

  it('admin owns no class: the class select is empty', async () => {
    expect(
      (await get<HeadcountFormOptions>(ADMIN, '/api/headcounts/form-options')).classes,
    ).toEqual([])
  })
})

describe('#17 pupil sections (S15)', () => {
  it('admin: pupil 3201 has five sections, config id ascending, with the observed chips of 213', async () => {
    const s = await get<HeadcountStudent>(ADMIN, '/api/headcounts/students/3201')
    expect(s.student).toMatchObject({ id: 3201 })
    expect(s.sections.map((x) => x.configId)).toEqual([209, 210, 211, 212, 213])
    const sej = s.sections[4]
    expect(sej).toMatchObject({
      subject: 'Sejarah',
      levelName: 'Tingkatan 4',
      className: '4 Simulasi',
      year: 2026,
      status: 'below',
      tov: 67,
      etr: 56,
      rs: { value: 56.4, recordedAt: '2026-04-13' },
      projection: { value: 56, variant: 'green', trend: 'Menurun', confidence: 'Rendah' },
      prediction: { etr: 56, rs: 56.4, diff: 0.4, verdict: 'Ramalan Tepat' },
    })
    expect(sej?.rows).toEqual([
      { checkpoint: 1, target: 72, targetGrade: 'A-', ar: null, arGrade: null, tone: 'noAr' },
      { checkpoint: 2, target: 77, targetGrade: 'A-', ar: null, arGrade: null, tone: 'noAr' },
      { checkpoint: 3, target: 82, targetGrade: 'A', ar: 56, arGrade: 'C+', tone: 'below' },
    ])
    expect(sej?.chart.labels).toEqual(['TOV', 'OTR1', 'OTR2', 'OTR3', 'ETR', 'RS'])
    expect(sej?.chart.target).toEqual([67, 72, 77, 82, 56, null])
    expect(sej?.chart.actual).toEqual([67, null, null, 56, null, null])
    expect(sej?.chart.projection).toEqual([null, null, null, 56, 56, null])
    expect(sej?.chart.rs).toBe(56.4)
  })

  it('BR-M08-33 verdicts and the no-target rows (DV-21)', async () => {
    const b = await get<HeadcountStudent>(ADMIN, '/api/headcounts/students/3202')
    // RS 35.1 vs ETR 65 → d = -29.9 → Selisih Besar.
    expect(b.sections.find((x) => x.configId === 213)?.prediction).toEqual({
      etr: 65,
      rs: 35.1,
      diff: -29.9,
      verdict: 'Selisih Besar',
    })
    const a = await get<HeadcountStudent>(ADMIN, '/api/headcounts/students/3201')
    const sci = a.sections.find((x) => x.configId === 212)
    expect(sci?.status).toBe('none')
    expect(sci?.rows[2]).toMatchObject({ target: null, ar: 61, arGrade: 'B', tone: 'noTarget' })
    expect(sci?.projection?.variant).toBe('green')
  })

  it('a pupil without an entry has no section; an unknown id or a non-pupil is 404', async () => {
    expect((await get<HeadcountStudent>(ADMIN, '/api/headcounts/students/2')).sections).toEqual([])
    expect((await send(ADMIN, 'GET', '/api/headcounts/students/99999999')).status).toBe(404)
    expect((await send(ADMIN, 'GET', '/api/headcounts/students/5')).status).toBe(404)
  })

  it('guru: own pupils through the own configs only; the school admin: own-school pupils', async () => {
    const own = await get<HeadcountStudent>(GURU, '/api/headcounts/students/3001')
    expect(own.sections.map((x) => x.configId)).toEqual([501, 502, 503, 504, 505])
    expect((await send(GURU, 'GET', '/api/headcounts/students/3201')).status).toBe(403)
    const sa = await get<HeadcountStudent>(ADMIN_SEKOLAH, '/api/headcounts/students/3001')
    expect(sa.student.school).toBe('SMK DEMO')
    expect(sa.sections).toHaveLength(5)
    expect((await send(ADMIN_SEKOLAH, 'GET', '/api/headcounts/students/3201')).status).toBe(403)
  })

  it('projection (BR-M08-24): one AR keeps the AR; two ARs add the step; amber below the ETR', async () => {
    const s = await get<HeadcountStudent>(ADMIN, '/api/headcounts/students/3001')
    const kimia = s.sections.find((x) => x.configId === 501)
    // ARs 65 → 70 (step +5) → Unjuran 75 = ETR 75 → green; trend 75 - TOV 60 → Meningkat; 2 points → Sederhana.
    expect(kimia?.projection).toEqual({
      value: 75,
      variant: 'green',
      trend: 'Meningkat',
      confidence: 'Sederhana',
    })
    const sej = s.sections.find((x) => x.configId === 504)
    // ARs 40 → 45 → Unjuran 50 < ETR 65 → amber; 50 - TOV 50 → Stabil.
    expect(sej?.projection).toMatchObject({ value: 50, variant: 'amber', trend: 'Stabil' })
    const tovOnly = s.sections.find((x) => x.configId === 502)
    expect(tovOnly?.projection).toBeNull()
    expect(tovOnly?.status).toBe('none')
    expect(tovOnly?.rows.every((r) => r.tone === 'noAr')).toBe(true)
  })
})

describe('#24 summary (S22) and #25 detail (S23)', () => {
  it('213 summary: 15 pupils, Purata TOV 62.1, ETR 71.9, OTR3 Above 5 · On Track 2 · Below 8, OTR1 / 2 N/A', async () => {
    const s = await get<HeadcountSummary>(ADMIN, '/api/headcounts/213/summary')
    expect(s.config).toEqual({
      id: 213,
      subject: 'Sejarah',
      className: '4 Simulasi',
      levelName: 'Tingkatan 4',
      year: 2026,
      activeOtrs: 3,
    })
    expect([s.students, s.avgTov, s.avgEtr]).toEqual([15, 62.1, 71.9])
    expect(s.otrs).toEqual([
      { n: 1, above: 0, onTrack: 0, below: 0, na: 15 },
      { n: 2, above: 0, onTrack: 0, below: 0, na: 15 },
      { n: 3, above: 5, onTrack: 2, below: 8, na: 0 },
    ])
  })

  it('213 detail: chips by the ±2 % rule 7 / 8 / 0, ranking order, averages with the class means', async () => {
    const d = await get<HeadcountDetail>(ADMIN, '/api/headcounts/213')
    expect(d.config).toMatchObject({ id: 213, teacherName: 'Guru Demo KL-01', status: 'active' })
    expect(d.chips).toEqual({ onTrack: 7, below: 8, empty: 0, total: 15 })
    expect(d.rows.map((r) => r.userId).slice(0, 4)).toEqual([3204, 3205, 3206, 3207])
    expect(d.rows[0]).toMatchObject({
      userId: 3204,
      tov: 73,
      tovGrade: 'A-',
      etr: 93,
      etrGrade: 'A+',
    })
    expect(d.rows[0]?.cells[2]).toEqual({
      target: 88,
      targetGrade: 'A',
      ar: 93,
      arGrade: 'A+',
      tone: 'above',
    })
    expect(d.rows[0]?.cells[0]).toMatchObject({ ar: null, tone: 'na' })
    // Rank by the latest AR, descending.
    const ars = d.rows.map((r) => r.cells[2]?.ar as number)
    expect(ars).toEqual([...ars].sort((a, b) => b - a))
    expect(d.averages).toEqual({
      tov: 62.1,
      otrs: [67.1, 72.1, 77.1],
      ars: [null, null, 71.9],
      etr: 71.9,
    })
    // Tones: 3205 (gap 0) and 3207 (gap -2) are On Track, 3210 (-14) Below.
    const tone = (id: number) => d.rows.find((r) => r.userId === id)?.cells[2]?.tone
    expect([tone(3205), tone(3207), tone(3210)]).toEqual(['on', 'on', 'below'])
  })

  it('sort=name lists A-Z; an unknown sort ranks', async () => {
    const byName = await get<HeadcountDetail>(ADMIN, '/api/headcounts/213?sort=name')
    const names = byName.rows.map((r) => r.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    const unknown = await get<HeadcountDetail>(ADMIN, '/api/headcounts/213?sort=zzz')
    const ranking = await get<HeadcountDetail>(ADMIN, '/api/headcounts/213?sort=ranking')
    expect(unknown.rows.map((r) => r.userId)).toEqual(ranking.rows.map((r) => r.userId))
  })

  it('a config with TOV only and a config without an entry: members count as "Belum Diisi"', async () => {
    const d503 = await get<HeadcountDetail>(GURU, '/api/headcounts/503')
    expect(d503.chips).toEqual({ onTrack: 0, below: 0, empty: 8, total: 8 })
    expect(d503.averages.tov).toBe(53.5)
    const d506 = await get<HeadcountDetail>(GURU, '/api/headcounts/506')
    expect(d506.rows).toHaveLength(8)
    expect(d506.rows.every((r) => r.tov === null && r.cells.every((c) => c.tone === 'na'))).toBe(
      true,
    )
    expect(d506.averages).toEqual({ tov: null, otrs: [null, null], ars: [null, null], etr: null })
    const s506 = await get<HeadcountSummary>(GURU, '/api/headcounts/506/summary')
    expect(s506).toMatchObject({ students: 8, avgTov: null, avgEtr: null })
  })

  it('S5 block basis: config 504 (the class latest-updated) has 0 / 1 / 7 and Purata TOV 50, ETR 65', async () => {
    const d = await get<HeadcountDetail>(GURU, '/api/headcounts/504')
    // ±2 % rule at the latest AR: AR 45 vs OTR2 60 → Below.
    expect(d.chips).toEqual({ onTrack: 0, below: 1, empty: 7, total: 8 })
    expect(d.averages.tov).toBe(50)
    expect(d.averages.etr).toBe(65)
  })
})

// ---------------------------------------------------------------------------------------------
// #29 CSV
// ---------------------------------------------------------------------------------------------

describe('#29 CSV export', () => {
  it('213: text/csv, a file name, the S23 columns, 15 pupils in ranking order and the class mean', async () => {
    const r = await call<Blob>(runtime, ADMIN, 'GET', '/api/headcounts/213/export')
    expect(r.status).toBe(200)
    expect(r.headers['content-type']).toBe('text/csv')
    expect(r.headers['content-disposition']).toContain('headcount-213.csv')
    const text = await r.body.text()
    // Blob.text() drops a UTF-8 BOM, so the bytes are checked: EF BB BF (opens in a spreadsheet).
    const bytes = new Uint8Array(await r.body.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const lines = text.trimEnd().split('\r\n')
    expect(lines).toHaveLength(17)
    expect(lines[0]).toBe(
      'Bil,Nama,TOV (%),Gred TOV,OTR1 (%),Gred OTR1,AR1 (%),Gred AR1,OTR2 (%),Gred OTR2,AR2 (%),Gred AR2,OTR3 (%),Gred OTR3,AR3 (%),Gred AR3,ETR (%),Gred ETR',
    )
    const first = (lines[1] as string).split(',')
    expect(first[0]).toBe('1')
    expect(first.slice(2)).toEqual([
      '73',
      'A-',
      '78',
      'A-',
      '',
      '',
      '83',
      'A',
      '',
      '',
      '88',
      'A',
      '93',
      'A+',
      '93',
      'A+',
    ])
    const mean = (lines[16] as string).split(',')
    expect(mean.slice(0, 4)).toEqual(['', 'Purata Kelas', '62.1', 'B'])
    expect(mean.at(-2)).toBe('71.9')
  })

  it('sort=name orders the rows A-Z; a dropped pupil is not listed', async () => {
    const r = await call<Blob>(runtime, GURU, 'GET', '/api/headcounts/501/export?sort=name')
    expect(r.status).toBe(200)
    const lines = (await r.body.text()).trimEnd().split('\r\n')
    expect(lines).toHaveLength(1 + 8 + 1)
    const names = lines.slice(1, 9).map((l) => l.split(',')[1] as string)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })
})

// ---------------------------------------------------------------------------------------------
// Writes (each describe resets the baseline first)
// ---------------------------------------------------------------------------------------------

const schoolS1 = (as: number) => get<SchoolPerformance>(as, '/api/performance/school')

describe('#15 create, #16 auto-setup', () => {
  beforeAll(async () => {
    await runtime.reset()
  }, 180_000)

  it('creates a config of the own class: 201 {id}, listed first, no entry, 8 members', async () => {
    const r = await send(GURU, 'POST', '/api/headcounts', {
      classroomId: 2001,
      subjectId: 3,
      educationLevelId: 11,
      academicYear: 2026,
      activeOtrs: 4,
      mode: 'auto',
    })
    expect(r.status).toBe(201)
    const id = (r.body as unknown as { data: { id: number } }).data.id
    expect(id).toBeGreaterThanOrEqual(9_000_001)
    const list = await get<HeadcountListItem[]>(GURU, '/api/headcounts')
    expect(list).toHaveLength(7)
    expect(list[0]).toMatchObject({ id, subjectName: 'Matematik', activeOtrs: 4, students: 8 })
    expect(headcount.entriesOf(id)).toEqual([])
    const d = await get<HeadcountDetail>(GURU, `/api/headcounts/${String(id)}`)
    expect(d.rows).toHaveLength(8)
    expect(d.chips).toEqual({ onTrack: 0, below: 0, empty: 8, total: 8 })
  })

  it('accepts form strings (S14 posts text), including a Manual config of the same class + subject', async () => {
    const r = await send(GURU, 'POST', '/api/headcounts', {
      classroomId: '2001',
      subjectId: '3',
      educationLevelId: '10',
      academicYear: '2026',
      activeOtrs: '2',
      mode: 'manual',
    })
    expect(r.status).toBe(201)
  })

  it('409 CONFLICT with the proposed copy for a duplicate class + subject + year + mode', async () => {
    const body = {
      classroomId: 2001,
      subjectId: 10,
      educationLevelId: 11,
      academicYear: 2026,
      activeOtrs: 3,
    }
    const auto = await send(GURU, 'POST', '/api/headcounts', { ...body, mode: 'auto' })
    expect(auto.status).toBe(409)
    expect(auto.body.error).toMatchObject({
      code: 'CONFLICT',
      message: 'Headcount Auto untuk kelas, subjek dan tahun ini sudah wujud.',
    })
    const manual = await send(GURU, 'POST', '/api/headcounts', { ...body, mode: 'manual' })
    expect(manual.status).toBe(409)
    expect(manual.body.error.message).toBe(
      'Headcount Manual untuk kelas, subjek dan tahun ini sudah wujud.',
    )
  })

  it('422 with fields for invalid input', async () => {
    const r = await send(GURU, 'POST', '/api/headcounts', {
      subjectId: 9999,
      educationLevelId: 9,
      academicYear: 2019,
      activeOtrs: 6,
      mode: 'semi',
    })
    expect(r.status).toBe(422)
    expect(r.body.error.code).toBe('VALIDATION_ERROR')
    expect(Object.keys(r.body.error.fields ?? {}).sort()).toEqual([
      'academicYear',
      'activeOtrs',
      'classroomId',
      'educationLevelId',
      'mode',
      'subjectId',
    ])
    const year = await send(GURU, 'POST', '/api/headcounts', {
      classroomId: 2001,
      subjectId: 3,
      educationLevelId: 11,
      academicYear: 2101,
      activeOtrs: 3,
      mode: 'auto',
    })
    expect(year.body.error.fields).toEqual({
      academicYear: 'Tahun akademik mesti antara 2020 dan 2100.',
    })
  })

  it('"Kelas tidak sah." (422) for a class that is not the own active class', async () => {
    const base = {
      subjectId: 3,
      educationLevelId: 11,
      academicYear: 2026,
      activeOtrs: 3,
      mode: 'auto',
    }
    // Another teacher's class (516) and the admin / school admin (who own no class).
    for (const [as, classroomId] of [
      [GURU, 516],
      [ADMIN, 2001],
      [ADMIN_SEKOLAH, 2001],
    ] as const) {
      const r = await send(as, 'POST', '/api/headcounts', { ...base, classroomId })
      expect(r.status, String(as)).toBe(422)
      expect(r.body.error.fields).toEqual({ classroomId: 'Kelas tidak sah.' })
    }
  })

  it('auto-setup: a new own class of level 11 gets one auto config (class subject, this year, 3 OTR); a repeat adds none', async () => {
    const cls = classrooms.create(
      {
        name: '5 UJIAN',
        teacherId: GURU,
        schoolId: 900001,
        subjectId: 3,
        educationLevel: 'tingkatan-5',
      },
      runtime.clock.now(),
    )
    const first = await send(GURU, 'POST', '/api/headcounts/auto-setup', { levels: ['T5'] })
    expect(first.status).toBe(200)
    // 2001 / 2002 already have their (class, subject, year) config (501, 506); only the new class is set up.
    expect(first.body).toMatchObject({ data: { created: 1 } })
    const made = headcount.configsOfClass(cls.classId)
    expect(made).toHaveLength(1)
    expect(made[0]).toMatchObject({
      subjectId: 3,
      academicYear: 2026,
      activeOtrs: 3,
      mode: 'auto',
      educationLevelId: 11,
      teacherId: GURU,
    })
    const again = await send(GURU, 'POST', '/api/headcounts/auto-setup', {
      levels: [11, 'T5', 'T4'],
    })
    expect(again.body).toMatchObject({ data: { created: 0 } })
    // A level the teacher owns no class in creates nothing; the admin owns no class at all.
    expect(
      (await send(GURU, 'POST', '/api/headcounts/auto-setup', { levels: [1, 'T1'] })).body,
    ).toMatchObject({
      data: { created: 0 },
    })
    expect(
      (await send(ADMIN, 'POST', '/api/headcounts/auto-setup', { levels: [11] })).body,
    ).toMatchObject({
      data: { created: 0 },
    })
  })

  it('auto-setup 422: no level, an unknown level', async () => {
    for (const levels of [[], ['T9'], [12], [0], ['x']]) {
      const r = await send(GURU, 'POST', '/api/headcounts/auto-setup', { levels })
      expect(r.status, JSON.stringify(levels)).toBe(422)
      expect(r.body.error.fields?.levels).toBeDefined()
    }
    expect((await send(GURU, 'POST', '/api/headcounts/auto-setup', {})).status).toBe(422)
    for (const levels of [['D1'], ['d6'], [1, 2, 3], ['T1', 'T5']]) {
      expect((await send(GURU, 'POST', '/api/headcounts/auto-setup', { levels })).status).toBe(200)
    }
  })
})

describe('#26 reset, #27 delete, #28 drop / restore and the S1 / S3 figures', () => {
  beforeAll(async () => {
    await runtime.reset()
  }, 180_000)

  it('the school admin S1 starts at GPS 5.33 from 6 entries', async () => {
    expect((await schoolS1(ADMIN_SEKOLAH)).gps).toMatchObject({ value: 5.33, entries: 6 })
  })

  it('drop: 3001 leaves config 501 (updated 1); the pupil is flagged, the counts and the S1 GPS change', async () => {
    const r = await send(GURU, 'POST', '/api/headcounts/501/drop-students', {
      action: 'drop',
      studentIds: [3001, 3001],
    })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ data: { updated: 1 } })
    const d = await get<HeadcountDetail>(GURU, '/api/headcounts/501')
    expect(d.rows.find((x) => x.userId === 3001)?.dropped).toBe(true)
    expect(d.chips).toEqual({ onTrack: 1, below: 2, empty: 4, total: 7 })
    // Fingerprint: the cached school-admin S1 follows (A- leaves: (6 + 6 + 9 + 7 + 2) / 5 = 6).
    expect((await schoolS1(ADMIN_SEKOLAH)).gps).toMatchObject({ value: 6, entries: 5 })
    expect(
      (await get<HeadcountListItem[]>(GURU, '/api/headcounts')).find((c) => c.id === 501)?.students,
    ).toBe(7)
  })

  it('dropping again changes nothing; restore brings 3001 back and the S1 GPS returns to 5.33', async () => {
    const again = await send(GURU, 'POST', '/api/headcounts/501/drop-students', {
      action: 'drop',
      studentIds: [3001],
    })
    expect(again.body).toMatchObject({ data: { updated: 0 } })
    const back = await send(GURU, 'POST', '/api/headcounts/501/drop-students', {
      action: 'restore',
      studentIds: [3001],
    })
    expect(back.body).toMatchObject({ data: { updated: 1 } })
    expect((await schoolS1(ADMIN_SEKOLAH)).gps).toMatchObject({ value: 5.33, entries: 6 })
  })

  it('a member without an entry can be dropped (an empty flagged entry) and restored', async () => {
    const before = headcount.entriesOf(501).length
    const r = await send(GURU, 'POST', '/api/headcounts/501/drop-students', {
      action: 'drop',
      studentIds: [3005],
    })
    expect(r.body).toMatchObject({ data: { updated: 1 } })
    expect(headcount.entriesOf(501)).toHaveLength(before + 1)
    const d = await get<HeadcountDetail>(GURU, '/api/headcounts/501')
    expect(d.chips.total).toBe(7)
    await send(GURU, 'POST', '/api/headcounts/501/drop-students', {
      action: 'restore',
      studentIds: [3005],
    })
    expect((await get<HeadcountDetail>(GURU, '/api/headcounts/501')).chips.total).toBe(8)
  })

  it('drop 422: bad action, nobody selected, a pupil that is not in the roster', async () => {
    const bad = await send(GURU, 'POST', '/api/headcounts/501/drop-students', {
      action: 'x',
      studentIds: [3001],
    })
    expect(bad.status).toBe(422)
    expect(bad.body.error.fields).toEqual({ action: 'Tindakan tidak sah.' })
    const none = await send(GURU, 'POST', '/api/headcounts/501/drop-students', {
      action: 'drop',
      studentIds: [],
    })
    expect(none.body.error.fields).toEqual({
      studentIds: 'Pilih sekurang-kurangnya seorang murid.',
    })
    const stranger = await send(GURU, 'POST', '/api/headcounts/501/drop-students', {
      action: 'drop',
      studentIds: [3201],
    })
    expect(stranger.body.error.fields).toEqual({ studentIds: 'Murid tidak sah.' })
  })

  it('reset clears TOV, ETR, OTR, AR and RS of every entry; the roster and the settings stay; S1 follows', async () => {
    const r = await send(GURU, 'POST', '/api/headcounts/505/reset')
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ data: { reset: true } })
    const d = await get<HeadcountDetail>(GURU, '/api/headcounts/505')
    expect(d.rows).toHaveLength(8)
    expect(d.rows.every((x) => x.tov === null && x.etr === null)).toBe(true)
    expect(d.rows.every((x) => x.cells.every((c) => c.ar === null && c.target === null))).toBe(true)
    expect(d.config).toMatchObject({ id: 505, year: 2025, subject: 'Bahasa Melayu', activeOtrs: 3 })
    const e = headcount.entriesOf(505)
    expect(e).toHaveLength(1)
    expect(e[0]).toMatchObject({ rs: null, rsRecordedAt: null, dropped: false })
    // 3001's BM entry (A-) is no longer graded: (2 + 6 + 6 + 9 + 7) / 5 = 6.
    expect((await schoolS1(ADMIN_SEKOLAH)).gps).toMatchObject({ value: 6, entries: 5 })
    // The listing keeps the config (settings are safe).
    expect((await get<HeadcountListItem[]>(GURU, '/api/headcounts')).map((c) => c.id)).toContain(
      505,
    )
  })

  it('delete removes the config and its entries (404 afterwards); the S1 figures follow', async () => {
    const r = await send(GURU, 'DELETE', '/api/headcounts/501')
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ data: { deleted: true } })
    expect((await send(GURU, 'GET', '/api/headcounts/501')).status).toBe(404)
    expect(headcount.entriesOf(501)).toEqual([])
    const list = await get<HeadcountListItem[]>(GURU, '/api/headcounts')
    expect(list.map((c) => c.id)).not.toContain(501)
    const dash = await get<HeadcountDashboard>(GURU, '/api/headcounts/dashboard')
    expect(dash.configs).toHaveLength(5)
    // Remaining graded entries of 900001: 3001 Sejarah (D) only.
    expect((await schoolS1(ADMIN_SEKOLAH)).gps).toMatchObject({ value: 7, entries: 1 })
  })

  it('the admin may reset and delete any config by URL; S3 Tingkatan 4 follows (34 / 41 → 28 / 32 after 213 goes)', async () => {
    const t4 = () => get<{ onTrack: number; below: number }>(ADMIN, '/api/performance/levels/t4')
    expect(await t4()).toMatchObject({ onTrack: 34, below: 41 })
    expect((await send(ADMIN, 'POST', '/api/headcounts/213/reset')).status).toBe(200)
    // All 15 pairs of 213 lose their AR: the 6 on become Below.
    expect(await t4()).toMatchObject({ onTrack: 28, below: 47 })
    expect((await send(ADMIN, 'DELETE', '/api/headcounts/213')).status).toBe(200)
    expect(await t4()).toMatchObject({ onTrack: 28, below: 32 })
  })
})
