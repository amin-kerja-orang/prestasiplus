/**
 * SRS v1.10 §7 #7–#12: admin education levels (S9–S11). All `AD`: a guest gets 401, any other role
 * 403.
 *
 * | # | Route | Success |
 * |---|---|---|
 * | 7 | `GET /api/admin/education-levels` | 200 unpaged `{data: (EducationLevel + {questionCount, subjectCount})[]}` |
 * | 8 | `GET /api/admin/education-levels/:id` | 200 `{data: EducationLevel}`; 404 "Tahap Pendidikan tidak dijumpai." |
 * | 9 | `POST /api/admin/education-levels` | 201 `{data, status}`; 422 `fields` |
 * | 10 | `PUT /api/admin/education-levels/:id` | 200 `{data, status}`; 404; 422 |
 * | 11 | `PATCH /api/admin/education-levels/:id/active` | 200 `{data: {id, isActive}}`; 404 |
 * | 12 | `DELETE /api/admin/education-levels/:id` | 200 `{data: {deleted: 1}, status}` (BR-10 cascade); 404 |
 *
 * `questionCount` = M04 Q-ACTIVE(level) (hidden Darjah questions excluded, D72) through the M04 public entry (D12, FR-98);
 * `subjectCount` = the M03 named query LINK-LEVEL(level).
 */

import {
  created,
  int,
  max,
  notFound,
  ok,
  oneOf,
  required,
  route,
  unique,
  unpaged,
  validationError,
  validationErrors,
  type RouteDef,
} from '@/mock/define'
import { questions } from '@/modules/m04-question-bank/mock'

import {
  curriculumRepo,
  curriculumSubjectLevelsRepo,
  type LevelInput,
} from '../repository/curriculum'
import type { EducationLevelRow, Stage } from '../repository/types'
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
  LEVEL_NOT_FOUND,
  normalise,
} from './admin-common'

export const STAGES: readonly Stage[] = ['primary', 'lower_secondary', 'upper_secondary']

/** Secondary-only (D72): a level cannot be written with the hidden `primary` stage (422). */
const WRITABLE_STAGES: readonly Stage[] = STAGES.filter((s) => s !== 'primary')

export interface LevelListItem extends EducationLevelRow {
  /** M04 Q-ACTIVE(level). */
  questionCount: number
  /** M03 LINK-LEVEL(level). */
  subjectCount: number
}

function levelRules(ignoreId: number | null) {
  return {
    name: [required(), isString(), max(255)],
    nameEn: [required(), isString(), max(255)],
    code: [
      required(),
      isString(),
      max(10),
      unique((value) => {
        const code = String(value).toUpperCase()
        return curriculumRepo.levels().some((l) => l.code === code && l.id !== ignoreId)
      }),
    ],
    stage: [required(), oneOf(WRITABLE_STAGES)],
    curriculum: [required(), isString(), max(255)],
    order: [isInteger(), atLeast(0)],
  }
}

function toInput(body: Record<string, unknown>): LevelInput {
  return {
    name: body.name as string,
    nameEn: body.nameEn as string,
    code: body.code as string,
    stage: body.stage as Stage,
    curriculum: body.curriculum as string,
    order: asInt(body.order) ?? 0,
  }
}

export const adminLevelRoutes: RouteDef[] = [
  route('GET', '/api/admin/education-levels', [adminOnly], () => {
    const counts = questions.visibleActiveGroupCount('educationLevelId')
    const items: LevelListItem[] = curriculumRepo.visibleLevels().map((l) => ({
      ...l,
      questionCount: counts.get(l.id) ?? 0,
      subjectCount: curriculumSubjectLevelsRepo.count('LINK-LEVEL', l.id),
    }))
    return unpaged(items)
  }),

  route(
    'GET',
    '/api/admin/education-levels/:id',
    [adminOnly],
    (req) => {
      const id = idParam(req)
      const level = curriculumRepo.isLevelHidden(id) ? undefined : curriculumRepo.level(id)
      return level ? ok(level) : notFound(LEVEL_NOT_FOUND)
    },
    { params: { id: int() } },
  ),

  route('POST', '/api/admin/education-levels', [adminOnly], (req, ctx) => {
    const body = normalise(req.body)
    const fields = validationErrors(body, levelRules(null))
    if (fields) return validationError(fields)
    return created(curriculumRepo.createLevel(toInput(body), ctx.clock.now()), {
      status: FLASH.level.created,
    })
  }),

  route(
    'PUT',
    '/api/admin/education-levels/:id',
    [adminOnly],
    (req, ctx) => {
      const id = idParam(req)
      if (!curriculumRepo.level(id) || curriculumRepo.isLevelHidden(id))
        return notFound(LEVEL_NOT_FOUND)
      const body = normalise(req.body)
      const fields = validationErrors(body, levelRules(id))
      if (fields) return validationError(fields)
      const level = curriculumRepo.updateLevel(id, toInput(body), ctx.clock.now())
      return level ? ok(level, { status: FLASH.level.updated }) : notFound(LEVEL_NOT_FOUND)
    },
    { params: { id: int() } },
  ),

  route(
    'PATCH',
    '/api/admin/education-levels/:id/active',
    [adminOnly],
    (req, ctx) => {
      const id = idParam(req)
      if (!curriculumRepo.level(id) || curriculumRepo.isLevelHidden(id))
        return notFound(LEVEL_NOT_FOUND)
      const body = normalise(req.body)
      const fields = validationErrors(body, { isActive: [required(), isBoolean()] })
      if (fields) return validationError(fields)
      const isActive = asBoolean(body.isActive) as boolean
      curriculumRepo.setLevelActive(id, isActive, ctx.clock.now())
      return ok({ id, isActive })
    },
    { params: { id: int() } },
  ),

  route(
    'DELETE',
    '/api/admin/education-levels/:id',
    [adminOnly],
    (req) => {
      const id = idParam(req)
      if (curriculumRepo.isLevelHidden(id) || !curriculumRepo.deleteLevel(id)) {
        return notFound(LEVEL_NOT_FOUND)
      }
      return ok({ deleted: 1 }, { status: FLASH.level.deleted })
    },
    { params: { id: int() } },
  ),
]
