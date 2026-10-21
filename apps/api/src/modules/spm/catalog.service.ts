import { Inject, Injectable } from '@nestjs/common'
import type { SpmTargetType } from '@pp/contract'

import { idToString } from '../../db/ids'
import { CurriculumRepository } from '../curriculum'
import { FALLBACK_COLOR, SPM_LEVEL_GRADES } from './config'
import { SpmRepository } from './spm.repository'

/** A curriculum subject as the hub shows it (names, icon and colour are read from the curriculum, never re-declared). */
export interface SubjectMeta {
  subjectId: string
  code: string
  name: string
  nameEn: string
  icon: string | null
  color: string
}

/** A subject with its SPM configuration row. */
export interface SpmSubject extends SubjectMeta {
  group: 'teras' | 'elektif'
  displayOrder: number
  databankOrder: number | null
  targetType: SpmTargetType | null
  targetSize: number | null
}

/**
 * Subjects and the SPM subject configuration (BR-M06-04 / -06), joined by CODE. Curriculum data comes from
 * `CurriculumRepository` (BE-08); the configuration rows from `spm_subject_configs`.
 */
@Injectable()
export class SpmCatalogService {
  constructor(
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(SpmRepository) private readonly repo: SpmRepository,
  ) {}

  /** Every curriculum subject by code (upper case). */
  async subjectsByCode(): Promise<Map<string, SubjectMeta>> {
    const subjects = await this.curriculum.subjects()
    return new Map(
      subjects.map((s) => [
        s.code,
        { subjectId: idToString(s.id), code: s.code, name: s.name, nameEn: s.nameEn, icon: s.icon, color: s.color || FALLBACK_COLOR },
      ]),
    )
  }

  /** The configured SPM subjects (the 19 rows), in display order; a row whose subject is gone is skipped. */
  async spmSubjects(): Promise<SpmSubject[]> {
    const [configs, byCode] = await Promise.all([this.repo.configs(), this.subjectsByCode()])
    const byId = new Map([...byCode.values()].map((s) => [s.subjectId, s]))
    return configs.flatMap((c) => {
      const s = byId.get(c.subjectId)
      return s ? [{ ...s, group: c.group, displayOrder: c.displayOrder, databankOrder: c.databankOrder, targetType: c.targetType, targetSize: c.targetSize }] : []
    })
  }

  /** The Tingkatan 4 and Tingkatan 5 level ids (decimal strings), in that order; open question 7. */
  async spmLevelIds(): Promise<string[]> {
    const levels = await Promise.all(SPM_LEVEL_GRADES.map((g) => this.curriculum.levelForGrade(g)))
    return levels.flatMap((l) => (l ? [idToString(l.id)] : []))
  }
}
