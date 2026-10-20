import { Inject, Injectable } from '@nestjs/common'

import { isIdString, idFromString } from '../../../db/ids'
import { CurriculumRepository } from '../../curriculum'

/**
 * Port to the curriculum subjects (owner: BE-08). A video keeps `subject_id`; the video pages need the subject name and
 * the writes need to know whether an id exists.
 */
export interface SubjectLookup {
  /** Names of the known subjects among `ids` (unknown ids are absent). */
  names(ids: readonly string[]): Promise<Map<string, string>>
  /** True when the subject exists. */
  exists(id: string): Promise<boolean>
}

export const SUBJECT_LOOKUP = Symbol('SUBJECT_LOOKUP')

/** The adapter over the BE-08 curriculum repository (`subjects()` for names, `subject(id)` for one existence check); an inactive subject still exists and keeps its name. */
@Injectable()
export class CurriculumSubjectLookup implements SubjectLookup {
  constructor(@Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository) {}

  /** One list read for any number of ids (a facet list can hold many subjects), not a read per subject. */
  async names(ids: readonly string[]): Promise<Map<string, string>> {
    const wanted = new Set(ids.filter(isIdString))
    const out = new Map<string, string>()
    if (wanted.size === 0) return out
    for (const subject of await this.curriculum.subjects()) {
      const id = String(subject.id)
      if (wanted.has(id)) out.set(id, subject.name)
    }
    return out
  }

  async exists(id: string): Promise<boolean> {
    return isIdString(id) && (await this.curriculum.subject(idFromString(id))) !== null
  }
}
