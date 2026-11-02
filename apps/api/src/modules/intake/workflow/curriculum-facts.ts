import { Inject, Injectable } from '@nestjs/common'
import type { AiTaxonomyUnit, IntakeQuestion } from '@pp/contract'

import { idToString } from '../../../db/ids'
import { curriculumCodeOf } from '../../bijak/papers/subject-codes'
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
    // The contract speaks the Bijak code (MAT, SN); the curriculum `subjects` row is MATH / SCI (R1E2E-01).
    const key = curriculumCodeOf(code.toUpperCase())
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

  /**
   * Reads, with ONE statement per subject and level, every unit and SP code the tags of a page mention, so `resolve` finds them in its
   * cache (a 100-row page with 20 SP codes each was up to 2,000 single-node queries). Optional: `resolve` alone still works, one node at a time.
   */
  async prefetch(tags: readonly Tag[]): Promise<void> {
    const wanted = new Map<string, { subjectId: bigint; levelId: bigint; codes: Set<string> }>()
    for (const tag of tags) {
      const subject = tag.subject ? await this.subject(tag.subject) : null
      if (!subject) continue
      for (const lc of levelCandidates(tag)) {
        const level = await this.level(lc)
        if (!level) continue
        const key = `${subject.id}|${level.id}`
        const entry = wanted.get(key) ?? { subjectId: subject.id, levelId: level.id, codes: new Set<string>() }
        for (const code of [...(tag.unit === null ? [] : [tag.unit]), ...tag.sp]) {
          if (!this.nodes.has(`unit|${subject.id}|${level.id}|${code}`) || !this.nodes.has(`sp|${subject.id}|${level.id}|${code}`)) entry.codes.add(code)
        }
        wanted.set(key, entry)
      }
    }
    // The statements run together (one per subject and level). Each is awaited here and only its rows are cached, so no cached promise can
    // reject on its own (an unhandled rejection ends the process): a failed read rejects `prefetch`, and the request fails (500), never passes the gate.
    await Promise.all(
      [...wanted.values()].map(async ({ subjectId, levelId, codes }) => {
        if (codes.size === 0) return
        const rows = await this.curriculum.nodesByCodes([...codes], { subjectId, educationLevelId: levelId })
        for (const kind of ['unit', 'sp'] as const) {
          for (const code of codes) {
            const key = `${kind}|${subjectId}|${levelId}|${code}`
            if (!this.nodes.has(key)) this.nodes.set(key, Promise.resolve(rows.find((n) => n.code === code && n.kind === kind) ?? null))
          }
        }
      }),
    )
  }

  /** The SP codes of a tag at one level: the ids found (at most MAX_SP are kept) and the codes that are not an SP there (each once). */
  private async spAt(codes: readonly string[], subjectId: bigint, levelId: bigint): Promise<{ ids: string[]; unknown: string[] }> {
    const ids: string[] = []
    const unknown: string[] = []
    for (const code of codes) {
      const sp = await this.node(code, subjectId, levelId, 'sp')
      if (sp) {
        if (ids.length < MAX_SP) ids.push(idToString(sp.id))
      } else if (!unknown.includes(code)) unknown.push(code)
    }
    return { ids, unknown }
  }

  async resolve(tag: Tag): Promise<Resolved> {
    const subject = tag.subject ? await this.subject(tag.subject) : null
    const levels: bigint[] = []
    if (subject) {
      for (const code of levelCandidates(tag)) {
        const level = await this.level(code)
        if (level) levels.push(level.id)
      }
    }
    const levelKnown = levels.length > 0
    if (!subject || !levelKnown) {
      return { facts: { subjectKnown: subject !== null, levelKnown, unitKnown: tag.unit === null ? null : false, unknownSp: [] }, ids: null }
    }
    // The level: a `T4`/`T5` tag has one candidate; a `T4+T5` tag has two (the form of origin first). When a unit is given, only the
    // levels that have it can be the level (none: every candidate stays, and the unit is reported as unknown). Among those, the level
    // whose SP list knows the most of the typed codes wins (the first on a tie), so a valid T5 SP is not refused because T4 came first.
    const unitAt = new Map<bigint, { id: bigint } | null>()
    if (tag.unit !== null) for (const lv of levels) unitAt.set(lv, await this.node(tag.unit, subject.id, lv, 'unit'))
    const withUnit = tag.unit === null ? levels : levels.filter((lv) => unitAt.get(lv) != null)
    const eligible = withUnit.length > 0 ? withUnit : levels
    // Every typed code is looked up: an unknown one is a field error (REQ-B-034), never silently dropped. At most MAX_SP are kept.
    let levelId = eligible[0] as bigint
    let sp = await this.spAt(tag.sp, subject.id, levelId)
    for (const other of eligible.slice(1)) {
      if (sp.unknown.length === 0) break
      const alt = await this.spAt(tag.sp, subject.id, other)
      if (alt.unknown.length < sp.unknown.length) {
        sp = alt
        levelId = other
      }
    }
    const unit = unitAt.get(levelId) ?? null
    const facts: CurriculumFacts = { subjectKnown: true, levelKnown: true, unitKnown: tag.unit === null ? null : unit !== null, unknownSp: sp.unknown }
    return {
      facts,
      ids: {
        subjectId: idToString(subject.id),
        educationLevelId: idToString(levelId),
        unitId: unit === null ? null : idToString(unit.id),
        spIds: sp.ids,
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
    const subject = await this.curriculum.subjectByCode(curriculumCodeOf(subjectCode.toUpperCase()))
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
