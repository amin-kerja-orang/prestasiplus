import { Inject, Injectable } from '@nestjs/common'
import { BIJAK_BUILDER_MESSAGES as MSG, BijakDskpUnitsQuerySchema, type BijakDskpUnit, type BijakSubject } from '@pp/contract'

import { ApiError } from '../../../common/errors/api-error'
import { ok } from '../../../common/http/respond'
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe'
import { bijakCodeOf, curriculumCodeOf } from '../../bijak/papers'
import { BlueprintsRepository } from './blueprints.repository'

/** Read-only pickers for the blueprint editor (architecture 15.1, 15.2). */
@Injectable()
export class BlueprintLookupsService {
  constructor(@Inject(BlueprintsRepository) private readonly repo: BlueprintsRepository) {}

  /** DSKP units of a subject (Bijak code) at T4, T5 or both, by `sortOrder`. 404 for an unknown subject; empty for one without DSKP units. */
  async units(rawQuery: unknown) {
    const q = new ZodValidationPipe(BijakDskpUnitsQuerySchema).transform(rawQuery)
    const subject = await this.repo.subjectByCode(curriculumCodeOf(q.subject))
    if (!subject) throw ApiError.of('NOT_FOUND', { message: MSG.blueprintNotFound })
    const units = await this.repo.unitsOfSubject(subject.id, q.level)
    return ok(units.map((u): BijakDskpUnit => ({ nodeId: u.nodeId, code: u.code, level: u.level, title: u.title, elective: u.elective })))
  }

  /** All active subjects with their Bijak codes (not only those of the student hub). */
  async subjects() {
    const rows = await this.repo.activeSubjects()
    return ok(rows.map((s): BijakSubject => ({ code: bijakCodeOf(s.code), name: s.name })))
  }
}
