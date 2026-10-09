/**
 * SRS M07 v1.7 §7 #7-#13 (admin PKSK questions, screens S5-S7), all admin only (guest 401, other
 * roles 403, FR-M07-59):
 *
 * | # | Route | Notes |
 * |---|---|---|
 * | 7 | `GET /api/admin/pksk-questions` | filters `bahagian, level, status, search, page` (BR-M07-06) |
 * | 8 | `GET /api/admin/pksk-questions/stats` | `{total, approved, pending, t1, t4}` (BR-M07-05) |
 * | 9 | `GET /api/admin/pksk-questions/:id` | detail for S7 |
 * | 10 | `POST /api/admin/pksk-questions` | create, saved `approved` (BR-M07-03) |
 * | 11 | `PUT /api/admin/pksk-questions/:id` | update |
 * | 12 | `DELETE /api/admin/pksk-questions/:id` | hard delete (BR-M07-02) |
 * | 13 | `POST /api/admin/pksk-questions/bulk` | `approve` / `reject` / `delete` |
 *
 * The PKSK questions are M04 rows: every read and write goes through the M04 public contract
 * (`questions.pkskList / pkskGet / pkskCreate / pkskUpdate / pkskDelete / countWhere`). Every id
 * is resolved with `pkskGet`, so an id of a non-PKSK row answers 404 / 422 and is never touched
 * (BR-M07-21, SEC-M07-12). A rejected request (4xx) writes nothing.
 */

import {
  created,
  fail,
  noContent,
  notFound,
  ok,
  pageParams,
  paged,
  queryString,
  route,
  validationError,
  int,
  type RouteDef,
} from '@/mock/define'
import { API_ERROR_CODES } from '@/api/errors'
import { questions, type Question } from '@/modules/m04-question-bank/mock'

import { isLevel } from '../repository/rules'
import { pkskDomainsRepo } from '../repository/stores'
import type { Bahagian, PkskDomain, PkskLevel } from '../repository/types'
import { adminOnly, asInt, obj } from './common'

export const ADMIN_PAGE_SIZE = 20
export const STATUSES = ['pending', 'approved', 'rejected'] as const
type Status = (typeof STATUSES)[number]
const BAHAGIAN_CODES: readonly Bahagian[] = ['A', 'B', 'C']

/** 404 copy (INFERRED: the SPA shows the global 404 page, FR-M07-18). */
export const QUESTION_NOT_FOUND = 'Soalan PKSK tidak dijumpai.'

/** Success flash texts returned in `status` (UNVERIFIED COPY, SRS §8.2). */
export const QUESTION_FLASH = {
  created: 'Soalan PKSK berjaya ditambah.',
  updated: 'Soalan PKSK berjaya dikemaskini.',
  deleted: 'Soalan PKSK berjaya dipadam.',
  bulk: {
    approve: (n: number) => `${String(n)} soalan telah diluluskan.`,
    reject: (n: number) => `${String(n)} soalan telah ditolak.`,
    delete: (n: number) => `${String(n)} soalan telah dipadam.`,
  },
} as const

/** Server field messages (SRS §5; UNVERIFIED COPY unless the SRS gives them; INFERRED ones noted). */
export const QUESTION_MESSAGES = {
  bahagian: 'Sila pilih bahagian.',
  domain: 'Sila pilih domain.',
  level: 'Sila pilih tingkatan.', // INFERRED
  status: 'Sila pilih status.', // INFERRED
  text: 'Sila masukkan teks soalan.',
  difficulty: 'Tahap kesukaran tidak sah.', // INFERRED
  optionsCount: 'Sila masukkan 2 hingga 6 pilihan jawapan.', // INFERRED
  optionText: 'Sila masukkan teks pilihan jawapan.', // INFERRED
  ids: 'Sila pilih sekurang-kurangnya satu soalan PKSK.', // INFERRED
  action: 'Tindakan tidak sah.', // INFERRED
} as const

interface OptionInput {
  text: string
  isCorrect: boolean
}

function domainOf(q: Question): PkskDomain {
  return pkskDomainsRepo.get(q.pkskDomainId as number) as PkskDomain
}

/** `PkskQuestionListItem` (§6.2). */
function listItem(q: Question) {
  const d = domainOf(q)
  return {
    id: q.id,
    questionText: q.questionText,
    bahagian: d.bahagian,
    domain: { id: d.id, code: d.code, name: d.name, icon: d.icon, color: d.color },
    targetLevel: q.pkskTargetLevel,
    status: q.status,
  }
}

/** `PkskQuestionDetail` (§6.2). */
function detail(q: Question) {
  return {
    id: q.id,
    bahagian: domainOf(q).bahagian,
    pkskDomainId: q.pkskDomainId,
    pkskTargetLevel: q.pkskTargetLevel,
    status: q.status,
    questionText: q.questionText,
    difficultyLevel: q.difficultyLevel,
    explanation: q.explanation,
    options: (q.pkskOptions ?? []).map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
  }
}

const trimmed = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

const asFlag = (v: unknown): boolean => v === true || v === 1 || v === '1' || v === 'true'

/** Parses `options` for an A/B question; `fields.options` on failure. */
function parseOptions(raw: unknown, fields: Record<string, string>): OptionInput[] | null {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 6) {
    fields.options = QUESTION_MESSAGES.optionsCount
    return null
  }
  const out: OptionInput[] = []
  for (const item of raw as unknown[]) {
    const o = obj(item)
    const text = trimmed(o.text)
    if (text === null) {
      fields.options = QUESTION_MESSAGES.optionText
      return null
    }
    out.push({ text, isCorrect: asFlag(o.isCorrect) })
  }
  return out
}

interface QuestionFields {
  pkskDomainId: number
  pkskTargetLevel: PkskLevel
  questionText: string
  difficultyLevel: number
  explanation: string | null
  pkskOptions: OptionInput[]
  status: Status
}

/**
 * Validates a create (`current` undefined, §5) or an update (`current` = the stored row) body.
 * BR-M07-04: A/B hold 2-6 options, C holds none (any `options` sent for C is ignored); an update
 * without `options` keeps the stored ones when they still fit the domain's Bahagian (INFERRED).
 */
function parse(
  raw: unknown,
  current?: Question,
): { fields: Record<string, string> } | { value: QuestionFields } {
  const body = obj(raw)
  const fields: Record<string, string> = {}

  // Domain (and, on create, the Bahagian it must belong to; BR-M07-01).
  let bahagian: Bahagian | undefined
  if (!current) {
    const b = trimmed(body.bahagian)
    if (b === null || !BAHAGIAN_CODES.includes(b as Bahagian))
      fields.bahagian = QUESTION_MESSAGES.bahagian
    else bahagian = b as Bahagian
  }
  const domainId = asInt(body.pkskDomainId)
  const domain = domainId === undefined ? undefined : pkskDomainsRepo.get(domainId)
  if (!domain || (bahagian !== undefined && domain.bahagian !== bahagian)) {
    fields.pkskDomainId = QUESTION_MESSAGES.domain
  }

  const level = trimmed(body.pkskTargetLevel)
  if (level === null || !isLevel(level)) fields.pkskTargetLevel = QUESTION_MESSAGES.level

  let status: Status = 'approved' // BR-M07-03: a created question is saved approved.
  if (current) {
    const s = trimmed(body.status)
    if (s === null || !STATUSES.includes(s as Status)) fields.status = QUESTION_MESSAGES.status
    else status = s as Status
  }

  const questionText = trimmed(body.questionText)
  if (questionText === null) fields.questionText = QUESTION_MESSAGES.text

  // Create: required 1-5. Update: optional 1-5, absent / blank keeps the stored value (INFERRED).
  let difficultyLevel = current?.difficultyLevel ?? 3
  const rawDifficulty = body.difficultyLevel
  const blank = rawDifficulty === undefined || rawDifficulty === null || rawDifficulty === ''
  if (blank) {
    if (!current) fields.difficultyLevel = QUESTION_MESSAGES.difficulty
  } else {
    const d = asInt(rawDifficulty)
    if (d === undefined || d < 1 || d > 5) fields.difficultyLevel = QUESTION_MESSAGES.difficulty
    else difficultyLevel = d
  }

  let explanation: string | null = current?.explanation ?? null
  if ('explanation' in body) explanation = trimmed(body.explanation)

  let pkskOptions: OptionInput[] = []
  if (domain && domain.bahagian !== 'C') {
    const stored = (current?.pkskOptions ?? []).map((o) => ({ ...o }))
    if (current && !('options' in body) && stored.length >= 2) pkskOptions = stored
    else pkskOptions = parseOptions(body.options, fields) ?? []
  }

  if (Object.keys(fields).length > 0) return { fields }
  return {
    value: {
      pkskDomainId: (domain as PkskDomain).id,
      pkskTargetLevel: level as PkskLevel,
      questionText: questionText as string,
      difficultyLevel,
      explanation,
      pkskOptions,
      status,
    },
  }
}

const emptyPage = (page: { page: number; pageSize: number }) => paged({ rows: [], total: 0 }, page)

export const adminQuestionRoutes: RouteDef[] = [
  // #7
  route('GET', '/api/admin/pksk-questions', [adminOnly], (req) => {
    const page = pageParams(req.query, { pageSize: ADMIN_PAGE_SIZE })
    const q = (key: string): string => (queryString(req.query, key) ?? '').trim()

    // BR-M07-06: values compare case-insensitively; an unknown value matches nothing.
    let domainIds: number[] | undefined
    const bahagian = q('bahagian').toUpperCase()
    if (bahagian !== '') {
      if (!BAHAGIAN_CODES.includes(bahagian as Bahagian)) return emptyPage(page)
      domainIds = pkskDomainsRepo.ofBahagian(bahagian as Bahagian).map((d) => d.id)
    }
    const level = q('level').toUpperCase()
    if (level !== '' && !isLevel(level)) return emptyPage(page)
    const status = q('status').toLowerCase()
    if (status !== '' && !STATUSES.includes(status as Status)) return emptyPage(page)

    const res = questions.pkskList({
      ...(domainIds ? { domainIds } : {}),
      ...(level !== '' ? { targetLevel: level } : {}),
      ...(status !== '' ? { status } : {}),
      search: q('search'),
      page: page.page,
      pageSize: page.pageSize,
    })
    return paged({ rows: res.rows.map(listItem), total: res.total }, page)
  }),

  // #8
  route('GET', '/api/admin/pksk-questions/stats', [adminOnly], () => {
    const pksk = { pkskDomainId: { ne: null } } as const
    return ok({
      total: questions.countWhere(pksk),
      approved: questions.countWhere({ ...pksk, status: 'approved' }),
      pending: questions.countWhere({ ...pksk, status: 'pending' }),
      t1: questions.countWhere({ ...pksk, pkskTargetLevel: 'T1' }),
      t4: questions.countWhere({ ...pksk, pkskTargetLevel: 'T4' }),
    })
  }),

  // #13 (registered before the `:id` routes; `bulk` is not numeric so it could not clash anyway)
  route('POST', '/api/admin/pksk-questions/bulk', [adminOnly], (req, ctx) => {
    const body = obj(req.body)
    const action = body.action
    if (action !== 'approve' && action !== 'reject' && action !== 'delete') {
      return validationError({ action: QUESTION_MESSAGES.action })
    }
    const rawIds = body.ids
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return validationError({ ids: QUESTION_MESSAGES.ids })
    }
    const ids: number[] = []
    for (const r of rawIds as unknown[]) {
      const id = asInt(r)
      // SEC-M07-12: every id must be a PKSK question, otherwise nothing is changed.
      if (id === undefined || !questions.pkskGet(id)) {
        return validationError({ ids: QUESTION_MESSAGES.ids })
      }
      if (!ids.includes(id)) ids.push(id)
    }
    const now = ctx.clock.now()
    for (const id of ids) {
      if (action === 'delete') questions.pkskDelete(id)
      else questions.pkskUpdate(id, { status: action === 'approve' ? 'approved' : 'rejected' }, now)
    }
    return ok({ affected: ids.length }, { status: QUESTION_FLASH.bulk[action](ids.length) })
  }),

  // #9
  route(
    'GET',
    '/api/admin/pksk-questions/:id',
    [adminOnly],
    (req) => {
      const row = questions.pkskGet(Number(req.params.id))
      return row ? ok(detail(row)) : notFound(QUESTION_NOT_FOUND)
    },
    { params: { id: int() } },
  ),

  // #10
  route('POST', '/api/admin/pksk-questions', [adminOnly], (req, ctx) => {
    const parsed = parse(req.body)
    if ('fields' in parsed) return validationError(parsed.fields)
    const row = questions.pkskCreate(parsed.value, ctx.clock.now())
    return created(detail(row), { status: QUESTION_FLASH.created })
  }),

  // #11
  route(
    'PUT',
    '/api/admin/pksk-questions/:id',
    [adminOnly],
    (req, ctx) => {
      const id = Number(req.params.id)
      const current = questions.pkskGet(id)
      if (!current) return notFound(QUESTION_NOT_FOUND)
      const parsed = parse(req.body, current)
      if ('fields' in parsed) return validationError(parsed.fields)
      const row = questions.pkskUpdate(id, parsed.value, ctx.clock.now())
      if (!row) return fail(404, API_ERROR_CODES.NOT_FOUND, QUESTION_NOT_FOUND)
      return ok(detail(row), { status: QUESTION_FLASH.updated })
    },
    { params: { id: int() } },
  ),

  // #12
  route(
    'DELETE',
    '/api/admin/pksk-questions/:id',
    [adminOnly],
    (req) => {
      if (!questions.pkskDelete(Number(req.params.id))) return notFound(QUESTION_NOT_FOUND)
      return noContent()
    },
    { params: { id: int() } },
  ),
]
