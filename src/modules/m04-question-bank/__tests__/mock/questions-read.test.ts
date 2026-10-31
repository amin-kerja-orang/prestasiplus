/**
 * M04-T1 (read-only): the S1 list, summary, detail and DSKP cascade handlers (SRS v1.16 §7 #1, #2, #4,
 * #28–#30) and the admin guards. Boots the REAL registry once (every module, so a duplicate route
 * such as M10 #39–#41 against the M04 DSKP routes would stop the boot) and never mutates or resets.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'

import type { QuestionDetail, QuestionRow, QuestionSummary } from '../../api/questions'
import { toQuestionFormData } from '../../api/questions'
import {
  APPROVED_BY_SUBJECT,
  COMPLIANCE_TOTALS,
  MISSING_SOURCE_TOTAL,
  S1_TOTAL_BY_SUBJECT,
  SOURCE_TOTALS,
  TOTALS,
  UNTAGGED_TOTAL,
} from '../../mock/data/tables'
import { questions } from '../../mock'
import { showPrimaryLevels } from '../../mock/repository/visible-levels'
import {
  ADMIN,
  ADMIN_SEKOLAH,
  GURU,
  IBU_BAPA,
  PELAJAR,
  bootRegistry,
  callAs,
  type ErrorBody,
  type ListBody,
} from './helpers-questions'

let runtime: MockRuntime
let call: ReturnType<typeof callAs>

beforeAll(async () => {
  // The documented counts include the Darjah questions; the hiding (D72) is in secondary-only.test.ts.
  showPrimaryLevels()
  runtime = await bootRegistry()
  call = callAs(runtime)
}, 180_000)

const list = (query = '', as: number | null = ADMIN) =>
  call<ListBody<QuestionRow>>('GET', `/api/questions${query}`, as)

const png = (name = 'a.png', bytes = 16, type = 'image/png') =>
  new File([new Uint8Array(bytes)], name, { type })

describe('the real registry boots with M04 and M10 (no duplicate routes)', () => {
  it('serves the M04 DSKP cascade and the M10 store together', async () => {
    expect(runtime.plugins.map((p) => p.id)).toEqual(expect.arrayContaining(['M04', 'M10']))
    const res = await call('GET', '/api/guru/dskp/bidang?subjectId=4&educationLevelId=11', ADMIN)
    expect(res.status).toBe(200)
  })
})

describe('admin guards', () => {
  const endpoints: [Parameters<typeof call>[0], string][] = [
    ['GET', '/api/questions'],
    ['GET', '/api/questions/summary'],
    ['POST', '/api/questions'],
    ['GET', '/api/questions/564159'],
    ['PUT', '/api/questions/564159'],
    ['DELETE', '/api/questions/564159'],
    ['POST', '/api/questions/bulk-action'],
    ['POST', '/api/questions/564159/ai-explanation'],
  ]
  const bodyOf = (method: string) => (method === 'GET' || method === 'DELETE' ? undefined : {})

  it.each(endpoints)('%s %s: guest 401 UNAUTHORIZED', async (method, url) => {
    const res = await call<ErrorBody>(method, url, null, bodyOf(method))
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it.each(endpoints)(
    '%s %s: student, teacher, parent and school admin get 403',
    async (method, url) => {
      for (const as of [PELAJAR, GURU, IBU_BAPA, ADMIN_SEKOLAH]) {
        const res = await call<ErrorBody>(method, url, as, bodyOf(method))
        expect(res.status).toBe(403)
        expect(res.body.error.code).toBe('FORBIDDEN')
      }
    },
  )

  it('no denied call changed anything', () => {
    expect(questions.count('Q-ALL')).toBe(TOTALS.all)
    expect(questions.get(564159)).not.toBeNull()
  })
})

describe('#1 GET /api/questions (S1)', () => {
  it('page 1: 20 rows, newest first (BR-M04-31), Q-ALL 465,278 without the 763 PKSK rows', async () => {
    const res = await list()
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(20)
    expect(res.body.meta).toMatchObject({
      page: 1,
      pageSize: 20,
      totalItems: 465_278,
      totalPages: 23_264,
      from: 1,
      to: 20,
    })
    expect(res.body.data.slice(0, 5).map((r) => r.id)).toEqual([
      564159, 564160, 564161, 564157, 564158,
    ])
  })

  it('a row carries the QuestionRow fields with subject and level names', async () => {
    const res = await list('?subjectId=4&educationLevelId=11&status=approved')
    const row = res.body.data.find((r) => r.id === 564159)
    expect(row).toEqual({
      id: 564159,
      questionText: expect.stringContaining('Topup Sains T5 Bab 9 item 1'),
      subject: { id: 4, name: 'Sains' },
      level: { id: 11, name: 'Tingkatan 5' },
      difficultyLevel: 3,
      status: 'approved',
      isActive: true,
      complianceStatus: 'verified',
      aiVerified: true,
      dskpTagged: true,
      sourceType: 'textbook',
      sourceFile: 'DSKP KSSM Science Form 4 and 5.pdf',
    })
  })

  it('never lists a PKSK row', async () => {
    const res = await list('?search=PKSK')
    expect(res.body.data.every((r) => r.id < 177_698 || r.id > 178_460)).toBe(true)
    expect(questions.countWhere({})).toBe(TOTALS.all)
  })

  it('filters: subject, level, status, source, compliance and DSKP totals are the observed ones', async () => {
    const total = async (q: string) => (await list(q)).body.meta.totalItems
    expect(await total('?subjectId=3')).toBe(S1_TOTAL_BY_SUBJECT[3])
    expect(await total('?subjectId=3&status=approved')).toBe(APPROVED_BY_SUBJECT[3])
    expect(await total('?subjectId=19')).toBe(0)
    expect(await total('?educationLevelId=1')).toBe(14_778)
    expect(await total('?status=approved')).toBe(TOTALS.approved)
    expect(await total('?status=archived')).toBe(TOTALS.archived)
    expect(await total('?complianceFilter=quarantined')).toBe(COMPLIANCE_TOTALS.quarantined)
    expect(await total('?complianceFilter=pending_mapping')).toBe(COMPLIANCE_TOTALS.pending_mapping)
    expect(await total('?complianceFilter=draft')).toBe(COMPLIANCE_TOTALS.draft)
    expect(await total('?complianceFilter=missing_source')).toBe(MISSING_SOURCE_TOTAL)
    expect(await total('?sourceFilter=trial')).toBe(SOURCE_TOTALS.trial)
    expect(await total('?sourceFilter=dskp')).toBe(SOURCE_TOTALS.dskp)
    expect(await total('?sourceFilter=marking_scheme')).toBe(SOURCE_TOTALS.marking_scheme)
    expect(await total('?dskpFilter=untagged')).toBe(UNTAGGED_TOTAL)
    expect(await total('?dskpFilter=tagged')).toBe(TOTALS.all - UNTAGGED_TOTAL)
  })

  it('filters combine with AND and search is a case-insensitive substring of the text', async () => {
    const both = await list(
      '?subjectId=4&educationLevelId=11&status=approved&search=SATELIT+BUATAN',
    )
    expect(both.body.data.map((r) => r.id)).toContain(564159)
    const other = await list('?subjectId=3&search=satelit+buatan')
    expect(other.body.meta.totalItems).toBe(0)
  })

  it('unknown parameters are ignored; unknown filter values and non-numeric ids match nothing', async () => {
    expect((await list('?type=essay&question_type=mcq&sort=id')).body.meta.totalItems).toBe(465_278)
    expect((await list('?status=nonsense')).body.meta.totalItems).toBe(0)
    expect((await list('?dskpFilter=maybe')).body.meta.totalItems).toBe(0)
    expect((await list('?sourceFilter=ai_generated')).body.meta.totalItems).toBe(0)
    expect((await list('?subjectId=abc')).body.meta.totalItems).toBe(0)
    // Empty values (the filter form's blank selects) are no filter.
    expect((await list('?subjectId=&educationLevelId=&status=&search=')).body.meta.totalItems).toBe(
      465_278,
    )
  })

  it('an out-of-range page is an empty page, not an error', async () => {
    const res = await list('?page=999999')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
    expect(res.body.meta.page).toBe(999_999)
  })
})

describe('#2 GET /api/questions/summary', () => {
  it('total is Q-ALL and there is one tile per M03 subject with its total and approved count', async () => {
    const res = await call<{ data: QuestionSummary }>('GET', '/api/questions/summary', ADMIN)
    expect(res.status).toBe(200)
    const { total, subjects } = res.body.data
    expect(total).toBe(465_278)
    expect(subjects).toHaveLength(31)
    expect(subjects.map((s) => s.id)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1))
    const math = subjects.find((s) => s.id === 3)
    expect(math).toEqual({
      id: 3,
      name: 'Matematik',
      icon: 'fa-calculator',
      group: 'teras',
      total: 38_504,
      approved: 16_645,
    })
    expect(subjects.find((s) => s.id === 21)).toMatchObject({
      total: S1_TOTAL_BY_SUBJECT[21],
      approved: 2970,
    })
    expect(subjects.find((s) => s.id === 19)).toMatchObject({ total: 0, approved: 0 })
    expect(subjects.filter((s) => s.group === 'teras').map((s) => s.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ])
    expect(subjects.find((s) => s.id === 29)?.icon).toBe('fa-book')
    expect(subjects.reduce((a, s) => a + s.total, 0)).toBe(465_278)
    expect(subjects.reduce((a, s) => a + s.approved, 0)).toBe(146_330)
  })

  it('the store totals include 130,152 questions and 129,752 approved (M05 "Total Soalan")', () => {
    expect(questions.count('Q-ACTIVE') + questions.count('Q-PKSK')).toBe(130_152)
    expect(questions.count('Q-ELIGIBLE') + questions.count('Q-PKSK')).toBe(129_752)
    expect(questions.count('Q-ALL') + questions.count('Q-PKSK')).toBe(TOTALS.datasetN)
  })
})

describe('#4 GET /api/questions/:id', () => {
  it('returns the question with names, the DSKP chain and the creator', async () => {
    const res = await call<{ data: QuestionDetail }>('GET', '/api/questions/564159', ADMIN)
    expect(res.status).toBe(200)
    const q = res.body.data
    expect(q).toMatchObject({
      id: 564159,
      subject: { id: 4, name: 'Sains' },
      level: { id: 11, name: 'Tingkatan 5' },
      questionType: 'mcq',
      status: 'approved',
      isActive: true,
      difficultyLevel: 3,
      correctAnswer: 0,
      usage: { attempts: 0, correct: 0 },
    })
    expect(q.options).toHaveLength(4)
    expect(q.dskp?.sp).toMatchObject({ id: 6191, code: 'T5SN.B9.1' })
    expect(q.dskp?.bidang.name).toBe('Sains T5 - Sokongan Bab Buku Teks')
    expect(q.createdBy.id).toBeGreaterThan(0)
    expect(q.createdBy).toHaveProperty('name')
    expect(q).not.toHaveProperty('createdAtMs')
  })

  it('an untagged question has dskp null', async () => {
    const res = await call<{ data: QuestionDetail }>('GET', '/api/questions/129114', ADMIN)
    expect(res.body.data.dskp).toBeNull()
    expect(res.body.data.status).toBe('archived')
    expect(res.body.data.isActive).toBe(false)
  })

  it('includes a PKSK row with its domain and options (BR-M04-33)', async () => {
    const res = await call<{ data: QuestionDetail }>('GET', '/api/questions/177698', ADMIN)
    expect(res.status).toBe(200)
    expect(res.body.data.pkskDomainId).not.toBeNull()
    expect(res.body.data.subject).toBeNull()
    expect(res.body.data.level).toBeNull()
    expect(res.body.data.options).toBeNull()
  })

  it('an unknown id (or a deleted question) is 404 NOT_FOUND', async () => {
    for (const url of ['/api/questions/999999999', '/api/questions/108527', '/api/questions/abc']) {
      const res = await call<ErrorBody>('GET', url, ADMIN)
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    }
  })
})

describe('#28–#30 DSKP cascade (M10 store)', () => {
  it('Bidang → SK → SP down to the observed Sains T5 chain, as bare arrays', async () => {
    const bidang = await call<{ id: number; code: string | null; name: string }[]>(
      'GET',
      '/api/guru/dskp/bidang?subjectId=4&educationLevelId=11',
      ADMIN,
    )
    expect(bidang.status).toBe(200)
    expect(Array.isArray(bidang.body)).toBe(true)
    expect(bidang.body).toContainEqual({
      id: 515,
      code: 'T5-SUB4-TEXTBOOK',
      name: 'Sains T5 - Sokongan Bab Buku Teks',
    })
    const sk = await call<{ id: number; code: string; description: string }[]>(
      'GET',
      '/api/guru/dskp/sk?bidangId=515',
      ADMIN,
    )
    expect(sk.body).toContainEqual({
      id: 2667,
      code: 'T5SN.B9',
      description: 'Menguasai konsep utama Bab 9: Satelit berdasarkan buku teks Sains Tingkatan 5.',
    })
    const sp = await call<{ id: number; code: string; description: string }[]>(
      'GET',
      '/api/guru/dskp/sp?skId=2667',
      ADMIN,
    )
    expect(sp.body.map((s) => s.id)).toContain(6191)
  })

  it('a missing or unknown parameter gives []', async () => {
    for (const url of [
      '/api/guru/dskp/bidang',
      '/api/guru/dskp/bidang?subjectId=4',
      '/api/guru/dskp/bidang?subjectId=999&educationLevelId=11',
      '/api/guru/dskp/sk',
      '/api/guru/dskp/sk?bidangId=999999',
      '/api/guru/dskp/sp',
      '/api/guru/dskp/sp?skId=abc',
    ]) {
      const res = await call('GET', url, ADMIN)
      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    }
  })

  it('teachers may read; students, parents and school admins get 403; guests 401', async () => {
    const url = '/api/guru/dskp/bidang?subjectId=4&educationLevelId=11'
    expect((await call('GET', url, GURU)).status).toBe(200)
    for (const as of [PELAJAR, IBU_BAPA, ADMIN_SEKOLAH]) {
      expect((await call('GET', url, as)).status).toBe(403)
    }
    expect((await call('GET', url, null)).status).toBe(401)
  })
})

describe('client form builder', () => {
  it('the client form builder uses the keys of SRS §7', () => {
    const f = toQuestionFormData({
      subjectId: 3,
      educationLevelId: '11',
      difficultyLevel: 2,
      questionType: 'mcq',
      questionText: 'Teks soalan yang cukup panjang',
      dskpSpId: null,
      options: ['a', 'b', 'c', 'd'],
      optionImages: [null, png()],
      correctAnswer: 0,
      tfAnswer: false,
      altAnswers: ['a', 'b'],
      removeQuestionImage: true,
      removeOptionImage: [false, true],
    })
    const keys = [...f.keys()]
    expect(keys).toEqual(
      expect.arrayContaining([
        'subjectId',
        'options[0]',
        'options[3]',
        'optionImages[1]',
        'removeQuestionImage',
        'removeOptionImage[1]',
      ]),
    )
    expect(f.get('dskpSpId')).toBe('')
    expect(f.get('tfAnswer')).toBe('false')
    expect(f.get('altAnswers')).toBe('a,b')
    expect(f.has('optionImages[0]')).toBe(false)
    expect(f.has('removeOptionImage[0]')).toBe(false)
  })
})
