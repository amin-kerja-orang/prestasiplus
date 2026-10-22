import { Inject, Injectable } from '@nestjs/common'
import type { GamesRoomSubject } from '@pp/contract'

import { idToString } from '../../../db/ids'
import { CurriculumRepository } from '../../curriculum'
import { gradeOfEnum } from './grades'

/** Room subject (English code of the subject, BE-45 Open question 5) -> curriculum subject code (BE-08 seed). */
export const ROOM_SUBJECT_CODES: Readonly<Record<GamesRoomSubject, string>> = {
  MATEMATIK: 'MATH',
  BAHASA_MELAYU: 'BM',
  BAHASA_INGGERIS: 'BI',
  SAINS: 'SCI',
  SEJARAH: 'SEJ',
}

/** Subject and education-level ids for the games, always through `CurriculumRepository` (the owner). Ids are decimal strings. */
@Injectable()
export class GameSubjects {
  constructor(@Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository) {}

  /** The curriculum subject id of a room subject, null when the subject is missing or inactive. */
  async subjectId(subject: GamesRoomSubject): Promise<string | null> {
    const row = await this.curriculum.subjectByCode(ROOM_SUBJECT_CODES[subject])
    return row && row.isActive ? idToString(row.id) : null
  }

  /** The education-level id of a grade 1..11 (null for an invalid grade or a missing level). */
  async levelIdOfGrade(grade: number): Promise<string | null> {
    if (!Number.isInteger(grade) || grade < 1 || grade > 11) return null
    const level = await this.curriculum.levelForGrade(grade)
    return level ? idToString(level.id) : null
  }

  /** The education-level id of a `DARJAH_n` / `TINGKATAN_n` value. */
  async levelIdOfEnum(gradeLevel: string): Promise<string | null> {
    const grade = gradeOfEnum(gradeLevel)
    return grade === null ? null : this.levelIdOfGrade(grade)
  }
}
