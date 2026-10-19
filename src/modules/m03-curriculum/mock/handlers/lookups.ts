/**
 * SRS v1.8 §7 #28 `GET /api/subjects` and #29 `GET /api/education-levels` (FR-M03-96; F-24).
 * Any session (A). Active records only, BR-08 order; unpaginated `{data, meta}` envelope (§7).
 */

import { queryInt, requireAuth, route, unpaged, type RouteDef } from '@/mock/define'

import type { EducationLevelLookup, SubjectLookup } from '../../api/lookups'
import { curriculumRepo } from '../repository/curriculum'

export const lookupRoutes: RouteDef[] = [
  route('GET', '/api/subjects', [requireAuth()], (req) => {
    // A non-numeric or unknown level is ignored (no filter), SRS #28.
    const levelParam = queryInt(req.query, 'educationLevelId')
    const educationLevelId =
      levelParam !== undefined && curriculumRepo.level(levelParam) ? levelParam : undefined
    const items: SubjectLookup[] = curriculumRepo
      .subjects({ active: true, ...(educationLevelId === undefined ? {} : { educationLevelId }) })
      .map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        nameEn: s.nameEn,
        icon: s.icon,
        color: s.color,
        isCore: s.isCore,
        educationLevelIds: s.educationLevelIds,
      }))
    return unpaged(items)
  }),
  route('GET', '/api/education-levels', [requireAuth()], () => {
    const items: EducationLevelLookup[] = curriculumRepo.levels({ active: true }).map((l) => ({
      id: l.id,
      code: l.code,
      name: l.name,
      nameEn: l.nameEn,
      stage: l.stage,
      grade: l.grade,
    }))
    return unpaged(items)
  }),
]
