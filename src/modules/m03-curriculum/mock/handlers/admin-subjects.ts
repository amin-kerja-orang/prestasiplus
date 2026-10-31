/**
 * SRS v1.10 §7 #1–#6: admin subjects (S6–S8). All `AD`: a guest gets 401, any other role 403.
 *
 * | # | Route | Success |
 * |---|---|---|
 * | 1 | `GET /api/admin/subjects` | 200 unpaged `{data: SubjectListItem[]}` (`Subject` + `questionCount`, `levels`) |
 * | 2 | `GET /api/admin/subjects/:id` | 200 `{data: Subject}`; 404 "Subjek tidak dijumpai." |
 * | 3 | `POST /api/admin/subjects` | 201 `{data: Subject, status}`; 422 `fields` |
 * | 4 | `PUT /api/admin/subjects/:id` | 200 `{data: Subject, status}`; 404; 422 |
 * | 5 | `PATCH /api/admin/subjects/:id/active` | 200 `{data: {id, isActive}}`; 404 |
 * | 6 | `DELETE /api/admin/subjects/:id` | 200 `{data: {deleted: 1}, status}` (BR-10 cascade); 404 |
 *
 * `questionCount` = M04 Q-ACTIVE(subject) through the M04 public entry (D12, FR-98).
 */

import {
  created,
  int,
  max,
  notFound,
  ok,
  required,
  route,
  rule,
  unique,
  unpaged,
  validationError,
  validationErrors,
  type RouteDef,
} from '@/mock/define'
import { questions } from '@/modules/m04-question-bank/mock'

import { curriculumRepo, type SubjectInput } from '../repository/curriculum'
import type { Subject } from '../repository/types'
import {
  adminOnly,
  asBoolean,
  asInt,
  atLeast,
  FLASH,
  idParam,
  isBoolean,
  isInteger,
  isString,
  normalise,
  SUBJECT_NOT_FOUND,
  textOrNull,
} from './admin-common'

export const DEFAULT_SUBJECT_COLOR = '#4f46e5'
export const DEFAULT_SUBJECT_ICON = 'fas fa-book'

export interface SubjectListItem extends Subject {
  /** M04 Q-ACTIVE(subject). */
  questionCount: number
  /** Linked levels in level order. */
  levels: { id: number; name: string }[]
}

/** Secondary-only (D72): a subject as the screens see it, without its hidden Darjah level links. */
function shown(s: Subject): Subject {
  return { ...s, educationLevelIds: curriculumRepo.visibleLevelIds(s.educationLevelIds) }
}

function levelRefs(ids: readonly number[]): { id: number; name: string }[] {
  return curriculumRepo.visibleLevelIds(ids).flatMap((id) => {
    const level = curriculumRepo.level(id)
    return level ? [{ id, name: level.name }] : []
  })
}

/** Rules of S7/S8 (§5, BR-02); `ignoreId` = the subject being edited. */
function subjectRules(ignoreId: number | null) {
  return {
    name: [required(), isString(), max(255)],
    nameEn: [required(), isString(), max(255)],
    code: [
      required(),
      isString(),
      max(20),
      unique((value) => {
        const hit = curriculumRepo.subjectByCode(String(value))
        return hit !== undefined && hit.id !== ignoreId
      }),
    ],
    icon: [isString(), max(100)],
    color: [
      isString(),
      // INFERRED: SRS §5 has no colour row; #RRGGBB per DATA-M03-02.
      rule('regex', (v) =>
        typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
          ? null
          : 'The :attribute field format is invalid.',
      ),
    ],
    isCore: [isBoolean()],
    order: [isInteger(), atLeast(0)],
    educationLevelIds: [
      rule('array', (v) =>
        v === undefined || v === null || Array.isArray(v)
          ? null
          : 'The :attribute field must be an array.',
      ),
      rule('exists', (v) =>
        Array.isArray(v) &&
        v.some(
          (x) =>
            asInt(x) === undefined ||
            !curriculumRepo.level(asInt(x) as number) ||
            curriculumRepo.isLevelHidden(asInt(x) as number),
        )
          ? 'The selected :attribute is invalid.'
          : null,
      ),
    ],
  }
}

/**
 * POST: absent fields take the BR-02 defaults. PUT (`current` given): absent fields keep the
 * stored value (INFERRED, like `isActive`). An empty `icon` is stored as null (no glyph, BR-05
 * step 1).
 */
function toInput(body: Record<string, unknown>, current?: Subject): SubjectInput {
  const has = (key: string) => key in body
  const ids = Array.isArray(body.educationLevelIds)
    ? [...new Set((body.educationLevelIds as unknown[]).map((x) => asInt(x) as number))]
    : []
  return {
    name: body.name as string,
    nameEn: body.nameEn as string,
    code: body.code as string,
    icon: has('icon') ? textOrNull(body.icon) : current ? current.icon : DEFAULT_SUBJECT_ICON,
    color: typeof body.color === 'string' ? body.color : (current?.color ?? DEFAULT_SUBJECT_COLOR),
    isCore: asBoolean(body.isCore) ?? current?.isCore ?? false,
    order: asInt(body.order) ?? current?.order ?? 0,
    educationLevelIds:
      Array.isArray(body.educationLevelIds) || !current ? ids : current.educationLevelIds,
  }
}

export const adminSubjectRoutes: RouteDef[] = [
  route('GET', '/api/admin/subjects', [adminOnly], () => {
    const counts = questions.visibleActiveGroupCount('subjectId')
    const items: SubjectListItem[] = curriculumRepo.subjects().map((s) => ({
      ...shown(s),
      questionCount: counts.get(s.id) ?? 0,
      levels: levelRefs(s.educationLevelIds),
    }))
    return unpaged(items)
  }),

  route(
    'GET',
    '/api/admin/subjects/:id',
    [adminOnly],
    (req) => {
      const subject = curriculumRepo.subject(idParam(req))
      return subject ? ok(shown(subject)) : notFound(SUBJECT_NOT_FOUND)
    },
    { params: { id: int() } },
  ),

  route('POST', '/api/admin/subjects', [adminOnly], (req, ctx) => {
    const body = normalise(req.body)
    const fields = validationErrors(body, subjectRules(null))
    if (fields) return validationError(fields)
    const subject = curriculumRepo.createSubject(toInput(body), ctx.clock.now())
    return created(shown(subject), { status: FLASH.subject.created })
  }),

  route(
    'PUT',
    '/api/admin/subjects/:id',
    [adminOnly],
    (req, ctx) => {
      const id = idParam(req)
      const current = curriculumRepo.subject(id)
      if (!current) return notFound(SUBJECT_NOT_FOUND)
      const body = normalise(req.body)
      const fields = validationErrors(body, subjectRules(id))
      if (fields) return validationError(fields)
      const subject = curriculumRepo.updateSubject(id, toInput(body, current), ctx.clock.now())
      return subject
        ? ok(shown(subject), { status: FLASH.subject.updated })
        : notFound(SUBJECT_NOT_FOUND)
    },
    { params: { id: int() } },
  ),

  route(
    'PATCH',
    '/api/admin/subjects/:id/active',
    [adminOnly],
    (req, ctx) => {
      const id = idParam(req)
      if (!curriculumRepo.subject(id)) return notFound(SUBJECT_NOT_FOUND)
      const body = normalise(req.body)
      const fields = validationErrors(body, { isActive: [required(), isBoolean()] })
      if (fields) return validationError(fields)
      const isActive = asBoolean(body.isActive) as boolean
      curriculumRepo.setSubjectActive(id, isActive, ctx.clock.now())
      return ok({ id, isActive })
    },
    { params: { id: int() } },
  ),

  route(
    'DELETE',
    '/api/admin/subjects/:id',
    [adminOnly],
    (req) => {
      if (!curriculumRepo.deleteSubject(idParam(req))) return notFound(SUBJECT_NOT_FOUND)
      return ok({ deleted: 1 }, { status: FLASH.subject.deleted })
    },
    { params: { id: int() } },
  ),
]
