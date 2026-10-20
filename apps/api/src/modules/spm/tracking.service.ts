import { Inject, Injectable } from '@nestjs/common'
import type { SpmSetStatus } from '@pp/contract'

import { QuestionsRepository } from '../questions'
import type { PracticeRamalanSource } from '../practice'
import { SpmCatalogService } from './catalog.service'
import { DEFAULT_SET_SIZE } from './config'
import { isStartable, setFigures } from './rules'
import { SpmRepository, type TrackingSetRow } from './spm.repository'

/** A Tracking A set with its derived figures (computed on read, never stored; G-15). */
export interface SetView {
  subjectId: string
  setNo: number
  status: SpmSetStatus
  readyCount: number
  bankSource: number | null
  dskpTagged: number
  dskpTotal: number
  /** Eligible questions in the set (a deactivated or unpublished one leaves it). */
  eligibleCount: number
  size: number
  /** Eligible question ids in `position` order. */
  eligibleIds: string[]
}

/**
 * Tracking A sets (BR-M06-08, -14). Eligibility comes from `QuestionsRepository` (published, active, live version);
 * a question that stops being eligible leaves the count with no write to `spm_tracking_sets`.
 * Implements the `ramalan` port of the practice module (`PracticeRamalanSource`), bound in `SpmModule.onModuleInit`.
 */
@Injectable()
export class SpmTrackingService implements PracticeRamalanSource {
  constructor(
    @Inject(SpmRepository) private readonly repo: SpmRepository,
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(SpmCatalogService) private readonly catalog: SpmCatalogService,
  ) {}

  private async sizes(): Promise<Map<string, number>> {
    return new Map((await this.catalog.spmSubjects()).map((s) => [s.subjectId, s.targetSize ?? DEFAULT_SET_SIZE]))
  }

  private async views(rows: readonly TrackingSetRow[], sizes: ReadonlyMap<string, number>): Promise<SetView[]> {
    const eligibleBySubject = new Map<string, Set<string>>()
    for (const subjectId of new Set(rows.map((r) => r.subjectId))) {
      eligibleBySubject.set(subjectId, new Set(await this.questions.eligibleIds({ subjectId })))
    }
    return rows.map((row) => {
      const size = sizes.get(row.subjectId) ?? DEFAULT_SET_SIZE
      const eligible = eligibleBySubject.get(row.subjectId) ?? new Set<string>()
      const eligibleIds = row.questionIds.filter((id) => eligible.has(id))
      const f = setFigures(eligibleIds.length, size)
      const dskpTotal = f.bankSource ?? f.readyCount
      return {
        subjectId: row.subjectId,
        setNo: row.setNo,
        status: f.status,
        readyCount: f.readyCount,
        bankSource: f.bankSource,
        dskpTagged: Math.min(row.dskpTagged, dskpTotal),
        dskpTotal,
        eligibleCount: eligibleIds.length,
        size,
        eligibleIds,
      }
    })
  }

  /** The sets of every subject that has any (any year), by subject then set number. */
  async allSets(): Promise<Map<string, SetView[]>> {
    const views = await this.views(await this.repo.sets(), await this.sizes())
    const out = new Map<string, SetView[]>()
    for (const v of views) out.set(v.subjectId, [...(out.get(v.subjectId) ?? []), v])
    return out
  }

  /** The sets of one subject (optionally of one year) ordered by set number. */
  async setsOf(subjectId: string, year?: number): Promise<SetView[]> {
    const rows = await this.repo.sets({ subjectId, ...(year === undefined ? {} : { year }) })
    return (await this.views(rows, await this.sizes())).sort((a, b) => a.setNo - b.setNo)
  }

  /**
   * BR-M06-14, the read `ramalan` starts from: `null` for an unknown set, `[]` for a `belum_cukup` set, otherwise
   * the eligible question ids in `position` order cut to the set size.
   */
  async ramalanQuestionIds(subjectId: string, year: number, setNo: number): Promise<string[] | null> {
    let row: TrackingSetRow | null
    try {
      row = await this.repo.set(subjectId, year, setNo)
    } catch {
      return null // an id that is not a decimal id names no set
    }
    if (!row) return null
    const [view] = await this.views([row], await this.sizes())
    if (!view || !isStartable(view.status)) return []
    return view.eligibleIds.slice(0, view.size)
  }
}
