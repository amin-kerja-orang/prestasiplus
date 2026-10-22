import { Inject, Injectable } from '@nestjs/common'
import type { AiTaxonomyUnit, IntakeQuestion } from '@pp/contract'

import { idToString } from '../../../db/ids'
import { CurriculumRepository } from '../../curriculum'
import type { CurriculumFacts } from './gate'
import type { TagIds } from './to-question'

type Tag = IntakeQuestion['tag']

const MAX_SP = 3

/** Education level codes a tag may mean, in the order they are tried (`T4+T5` is decided by the form of origin). */
function levelCandidates(tag: Pick<Tag, 'level' | 'formOrigin'>): string[] {
  if (tag.level === 'T4') return ['T4']
  if (tag.level === 'T5') return ['T5']
  return tag.formOrigin === 'T5' ? ['T5', 'T4'] : ['T4', 'T5']
}

export interface Resolved {
  facts: CurriculumFacts
  /** Set when the tag resolves completely enough to create a question (subject, level; unit and SP when present). */
  ids: TagIds | null
}

/**
 * Looks the tag of an item up in the curriculum owner (BE-08: subjects, levels and the DSKP node tree). One instance per
 * request: results are cached, so a page of 100 rows reads each subject and level once.
 */
export class TagResolver {
  private readonly subjects = new Map<string, Promise<{ id: bigint } | null>>()
  private readonly levels = new Map<string, Promise<{ id: bigint } | null>>()
  private readonly nodes = new Map<string, Promise<{ id: bigint } | null>>()

  constructor(private readonly curriculum: CurriculumRepository) {}

  private subject(code: string): Promise<{ id: bigint } | null> {
    const key = code.toUpperCase()
    let p = this.subjects.get(key)
    if (!p) {
      p = this.curriculum.subjectByCode(key)
      this.subjects.set(key, p)
    }
    return p
  }

  private level(code: string): Promise<{ id: bigint } | null> {
    let p = this.levels.get(code)
    if (!p) {
      p = this.curriculum.levelByCode(code)
      this.levels.set(code, p)
    }
    return p
  }

  private node(code: string, subjectId: bigint, levelId: bigint, kind: 'unit' | 'sp'): Promise<{ id: bigint } | null> {
    const key = `${kind}|${subjectId}|${levelId}|${code}`
    let p = this.nodes.get(key)
    if (!p) {
      p = this.curriculum.node(code, { subjectId, educationLevelId: levelId, kind })
      this.nodes.set(key, p)
    }
    return p
  }

  async resolve(tag: Tag): Promise<Resolved> {
    const subject = tag.subject ? await this.subject(tag.subject) : null
    let levelId: bigint | null = null
    let unitId: bigint | null = null
    let unitKnown: boolean | null = tag.unit === null ? null : false
    if (subject) {
      for (const code of levelCandidates(tag)) {
        const level = await this.level(code)
        if (!level) continue
        if (tag.unit !== null) {
          const unit = await this.node(tag.unit, subject.id, level.id, 'unit')
          if (unit) {
            levelId = level.id
            unitId = unit.id
            unitKnown = true
            break
          }
          if (levelId === null) levelId = level.id
        } else {
          levelId = level.id
          break
        }
      }
    }
    const facts: CurriculumFacts = { subjectKnown: subject !== null, levelKnown: levelId !== null, unitKnown }
    if (!subject || levelId === null) return { facts, ids: null }
    const spIds: string[] = []
    for (const code of tag.sp) {
      if (spIds.length >= MAX_SP) break
      const sp = await this.node(code, subject.id, levelId, 'sp')
      if (sp) spIds.push(idToString(sp.id))
    }
    return {
      facts,
      ids: {
        subjectId: idToString(subject.id),
        educationLevelId: idToString(levelId),
        unitId: unitId === null ? null : idToString(unitId),
        spIds,
        tp: tag.tp,
      },
    }
  }
}

/** Builds request-scoped resolvers, and the taxonomy list handed to the extractor. */
@Injectable()
export class CurriculumFactsService {
  constructor(@Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository) {}

  resolver(): TagResolver {
    return new TagResolver(this.curriculum)
  }

  /** Units of a subject for the extraction request (AC-05.2: the model may only pick known units). Capped at 500. */
  async taxonomy(subjectCode: string): Promise<AiTaxonomyUnit[]> {
    const subject = await this.curriculum.subjectByCode(subjectCode)
    if (!subject) return []
    const out: AiTaxonomyUnit[] = []
    for (const code of ['T4', 'T5'] as const) {
      const level = await this.curriculum.levelByCode(code)
      if (!level) continue
      const nodes = await this.curriculum.dskpNodes(level.id, subject.id)
      for (const n of nodes) {
        if (n.kind !== 'unit' || out.length >= 500) continue
        out.push({ code: n.code.slice(0, 64), label: (n.title || n.code).slice(0, 200), form: code })
      }
    }
    return out
  }
}
