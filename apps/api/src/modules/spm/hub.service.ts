import { Inject, Injectable } from '@nestjs/common'
import {
  SPM_COUNT_OPTIONS,
  SPM_DEFAULT_COUNT,
  SPM_TARGET_TYPE_LABEL,
  type SpmBahasaSubject,
  type SpmDatabankSubject,
  type SpmDifficultyCounts,
  type SpmLatihTubiCard,
  type SpmLatihTubiConfig,
  type SpmLatihTubiList,
  type SpmOpenSubjectCard,
  type SpmOverview,
  type SpmReadiness,
  type SpmReadinessTile,
  type SpmSubjektifOverview,
  type SpmTrackingAHub,
  type SpmTrackingASubject,
  type SpmTrackingARedirect,
} from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import { PracticeRepository } from '../practice'
import { QuestionsRepository } from '../questions'
import { SpmCatalogService, type SpmSubject, type SubjectMeta } from './catalog.service'
import { BAHASA_CODES, READINESS_ORDER, SUBJEKTIF_CODES, SUBJEKTIF_TERAS_CODES, TRACKING_YEAR } from './config'
import { SpmPorts } from './ports'
import { countOf, SpmPoolService, type PoolCell } from './pool.service'
import { isStartable } from './rules'
import { SpmTrackingService, type SetView } from './tracking.service'
import { CurriculumRepository } from '../curriculum'
import { idFromString } from '../../db/ids'

/** The signed-in caller as the read models see them. */
export interface SpmCaller {
  userId: string
  /** Active role code. */
  role: string
  /** Mod Pelajar is on. */
  isTest: boolean
}

/** Subjects whose pool counts are read at the same time (each is one grouped SQL statement). */
export const POOL_LOAD_CONCURRENCY = 4

/** Maps `items` with at most `limit` calls in flight; the result order is the input order. */
export async function mapBounded<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i] as T)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

const SPM_MODES = ['past_year', 'latih_tubi', 'ramalan'] as const

const notFound = (): ApiError => ApiError.of('NOT_FOUND')

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0)
const sumReady = (sets: readonly SetView[]): number => sum(sets.map((s) => s.readyCount))

function diffCounts(facts: readonly PoolCell[], levelId?: string): SpmDifficultyCounts {
  const filter = levelId === undefined ? {} : { levelId }
  const n = (d: number): number => countOf(facts, { ...filter, difficulty: d })
  return { '1': n(1), '2': n(2), '3': n(3), '4': n(4), '5': n(5) }
}

const metaOf = (s: SubjectMeta) => ({ name: s.name, nameEn: s.nameEn, icon: s.icon, color: s.color })

/**
 * Read models of the hub (M06-01 to M06-07). Everything is computed on read from the owners' stores through
 * their services: curriculum (BE-08), questions (BE-09, SPM pool and structured counts), practice (BE-12, history
 * stats) and the structured-attempt port (BE-13). The module owns only the subject configuration and the sets.
 */
@Injectable()
export class SpmHubService {
  constructor(
    @Inject(SpmCatalogService) private readonly catalog: SpmCatalogService,
    @Inject(SpmPoolService) private readonly pool: SpmPoolService,
    @Inject(SpmTrackingService) private readonly tracking: SpmTrackingService,
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(PracticeRepository) private readonly practice: PracticeRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(SpmPorts) private readonly ports: SpmPorts,
  ) {}

  /** Student-visible structured questions of a subject (published, active). */
  private visibleSets(subjectId: string): Promise<number> {
    return this.questions.count({ subjectId, status: 'published', active: true, type: 'structured' })
  }

  /** Pool sizes of the configured subjects: one grouped count each, at most POOL_LOAD_CONCURRENCY at a time. */
  private async poolSizes(subjects: readonly SpmSubject[]): Promise<Map<string, number>> {
    const sizes = await mapBounded(subjects, POOL_LOAD_CONCURRENCY, (s) => this.pool.count(s.subjectId))
    return new Map(subjects.map((s, i) => [s.subjectId, sizes[i] as number]))
  }

  // --- M06-01 -----------------------------------------------------------------------------------

  /**
   * The three hub figures that the mock keeps as display constants are computed (AC 15): `totalQuestions` and the
   * Latih Tubi chip are the sum of the pool sizes of the 19 configured subjects, the Databank chip the sum over the
   * subjects on the Tahun Lepas list. `yearsAvailable` stays 0 (a question carries no year in the hub's sense).
   */
  async overview(caller: SpmCaller): Promise<SpmOverview> {
    const [subjects, byCode, levelIds, allSets] = await Promise.all([
      this.catalog.spmSubjects(),
      this.catalog.subjectsByCode(),
      this.catalog.spmLevelIds(),
      this.tracking.allSets(),
    ])
    const sizes = await this.poolSizes(subjects)
    const total = sum([...sizes.values()])
    const databank = sum(subjects.filter((s) => s.databankOrder !== null).map((s) => sizes.get(s.subjectId) ?? 0))
    const levelSubjects = await Promise.all(levelIds.map((id) => this.curriculum.subjects({ active: true, educationLevelId: idFromString(id) })))
    const subjectCount = new Set(levelSubjects.flat().map((s) => s.id)).size
    const trackingA = sum([...allSets.values()].map(sumReady))
    const subjektifSets = sum(await Promise.all(SUBJEKTIF_CODES.map((c) => (byCode.get(c) ? this.visibleSets((byCode.get(c) as SubjectMeta).subjectId) : Promise.resolve(0)))))
    const stats = await this.practice.historyStats(caller.userId, { modes: [...SPM_MODES], includeTest: caller.isTest })
    return {
      stats: { totalQuestions: total, subjectCount, yearsAvailable: 0, trackingAQuestions: trackingA },
      modules: { databank, latihTubi: total, trackingA, subjektifSets },
      me: { sessions: stats.sessions, avgAccuracy: stats.avgAccuracyPct, coins: stats.coins, answered: stats.answered },
    }
  }

  // --- M06-02 / M06-03 / M06-04 -----------------------------------------------------------------

  async databank(): Promise<SpmDatabankSubject[]> {
    const listed = (await this.catalog.spmSubjects())
      .filter((s) => s.databankOrder !== null)
      .sort((a, b) => (a.databankOrder as number) - (b.databankOrder as number))
    const sizes = await this.poolSizes(listed)
    return listed.map((s) => ({ code: s.code, ...metaOf(s), databankCount: sizes.get(s.subjectId) ?? 0 }))
  }

  async latihTubiList(): Promise<SpmLatihTubiList> {
    const subjects = await this.catalog.spmSubjects()
    const sizes = await this.poolSizes(subjects)
    const card = (s: SpmSubject): SpmLatihTubiCard => {
      const total = sizes.get(s.subjectId) ?? 0
      return { code: s.code, ...metaOf(s), total, targetType: s.targetType, targetSize: s.targetSize, locked: s.targetSize !== null && total < s.targetSize }
    }
    const group = (g: 'teras' | 'elektif'): SpmLatihTubiCard[] =>
      subjects.filter((s) => s.group === g).sort((a, b) => a.displayOrder - b.displayOrder).map(card)
    return { teras: group('teras'), elektif: group('elektif') }
  }

  async latihTubiConfig(code: string): Promise<SpmLatihTubiConfig> {
    const s = (await this.catalog.spmSubjects()).find((x) => x.code === code.toUpperCase())
    if (!s) throw notFound()
    const levelIds = await this.catalog.spmLevelIds()
    const facts = await this.pool.cells(s.subjectId)
    const target = s.targetSize
    return {
      code: s.code,
      name: s.name,
      icon: s.icon,
      color: s.color,
      total: countOf(facts),
      targetType: s.targetType,
      targetSize: target,
      levelCounts: Object.fromEntries(levelIds.map((id) => [id, countOf(facts, { levelId: id })])),
      difficultyStats: diffCounts(facts),
      difficultyByLevel: Object.fromEntries(levelIds.map((id) => [id, diffCounts(facts, id)])),
      countOptions:
        target !== null && s.targetType !== null
          ? [{ value: target, label: `${String(target)} (Target ${SPM_TARGET_TYPE_LABEL[s.targetType]})`, isTarget: true }]
          : SPM_COUNT_OPTIONS.map((n) => ({ value: n, label: String(n), isTarget: false })),
      defaultCount: target ?? SPM_DEFAULT_COUNT,
    }
  }

  // --- M06-05 / M06-06 --------------------------------------------------------------------------

  private openCard(s: SpmSubject, sets: readonly SetView[]): SpmOpenSubjectCard {
    const startable = sets.filter((x) => isStartable(x.status))
    const bank = startable.filter((x) => x.status === 'bank_besar')
    return {
      subjectId: s.subjectId,
      code: s.code,
      ...metaOf(s),
      readyQuestions: sumReady(startable),
      bankBesarSets: bank.length,
      bersihSets: startable.length - bank.length,
      targetType: s.targetType,
      targetSize: s.targetSize,
      bankSource: bank.length > 0 ? sum(bank.map((x) => x.bankSource ?? 0)) : null,
      startableSets: startable.length,
    }
  }

  private readiness(subjects: ReadonlyMap<string, SpmSubject>, sets: ReadonlyMap<string, SetView[]>): SpmReadiness {
    const tiles: SpmReadinessTile[] = READINESS_ORDER.flatMap((code) => {
      const s = subjects.get(code)
      if (!s) return []
      const own = sets.get(s.subjectId) ?? []
      const bersih = own.filter((x) => x.status === 'bersih').length
      const bankBesar = own.filter((x) => x.status === 'bank_besar').length
      const locked = own.filter((x) => x.status === 'belum_cukup')
      return [
        {
          code,
          name: s.name,
          targetSize: s.targetSize ?? 0,
          bersih,
          bankBesar,
          locked: locked.length,
          total: own.length,
          readiness: own.length === 0 ? 0 : Math.round(((bersih + bankBesar) / own.length) * 100),
          lockedSets: locked.slice(0, 6).map((x) => ({ setNo: x.setNo, readyCount: x.readyCount, target: x.size })),
          hasBankBesar: bankBesar > 0,
        },
      ]
    })
    return {
      summary: { bersih: sum(tiles.map((t) => t.bersih)), bankBesar: sum(tiles.map((t) => t.bankBesar)), locked: sum(tiles.map((t) => t.locked)) },
      tiles,
    }
  }

  async trackingHub(caller: SpmCaller): Promise<SpmTrackingAHub> {
    const [subjects, byCode, allSets] = await Promise.all([this.catalog.spmSubjects(), this.catalog.subjectsByCode(), this.tracking.allSets()])
    const byConfigCode = new Map(subjects.map((s) => [s.code, s]))
    const open = subjects
      .filter((s) => !(BAHASA_CODES as readonly string[]).includes(s.code))
      .sort((a, b) => (a.group === b.group ? 0 : a.group === 'teras' ? -1 : 1) || a.displayOrder - b.displayOrder)
      .map((s) => ({ subject: s, card: this.openCard(s, allSets.get(s.subjectId) ?? []) }))
      .filter((x) => x.card.startableSets > 0)
    const bahasa: SpmBahasaSubject[] = []
    for (const code of BAHASA_CODES) {
      const s = byCode.get(code)
      if (s) bahasa.push({ subjectId: s.subjectId, code: s.code, ...metaOf(s), sets: await this.visibleSets(s.subjectId) })
    }
    return {
      objectiveLane: {
        subjects: open.length,
        sets: sum(open.map((x) => x.card.startableSets)),
        // Sum over the startable sets of (bankSource ?? readyCount).
        questions: sum(open.map((x) => sum((allSets.get(x.subject.subjectId) ?? []).filter((v) => isStartable(v.status)).map((v) => v.bankSource ?? v.readyCount)))),
      },
      bahasaLane: { subjects: 2, sets: sum(bahasa.map((b) => b.sets)) },
      // BR-M06-30: the active role `admin` only.
      readiness: caller.role === 'admin' ? this.readiness(byConfigCode, allSets) : null,
      bahasa,
      openSubjects: open.map((x) => x.card),
    }
  }

  async trackingSubject(code: string): Promise<SpmTrackingASubject | SpmTrackingARedirect> {
    const s = (await this.catalog.spmSubjects()).find((x) => x.code === code.toUpperCase())
    if (!s) throw notFound()
    if ((BAHASA_CODES as readonly string[]).includes(s.code)) {
      return { redirect: `/latihan-berstruktur?subject_id=${s.subjectId}&scope=spm&track=bahasa` }
    }
    const sets = await this.tracking.setsOf(s.subjectId, TRACKING_YEAR)
    const startable = sets.filter((x) => isStartable(x.status))
    return {
      code: s.code,
      name: s.name,
      icon: s.icon,
      color: s.color,
      targetType: s.targetType,
      targetSize: s.targetSize,
      summary: {
        bersih: sets.filter((x) => x.status === 'bersih').length,
        bankBesar: sets.filter((x) => x.status === 'bank_besar').length,
        // Sum of ALL the subject's sets, unlike the S5 open card.
        readyQuestions: sumReady(sets),
        belumCukup: sets.filter((x) => x.status === 'belum_cukup').length,
      },
      // Startable first, then locked, each by set number (FR-M06-49).
      sets: [...startable, ...sets.filter((x) => !isStartable(x.status))].map((x) => ({
        setNo: x.setNo,
        status: x.status,
        readyCount: x.readyCount,
        bankSource: x.bankSource,
        dskpTagged: x.dskpTagged,
        dskpTotal: x.dskpTotal,
      })),
    }
  }

  // --- M06-07 -----------------------------------------------------------------------------------

  async subjektif(caller: SpmCaller): Promise<SpmSubjektifOverview> {
    const byCode = await this.catalog.subjectsByCode()
    const found = SUBJEKTIF_CODES.flatMap((code) => {
      const s = byCode.get(code)
      return s ? [s] : []
    })
    const subjects: SpmSubjektifOverview['subjects'] = []
    for (const s of found) {
      subjects.push({
        subjectId: s.subjectId,
        name: s.name,
        nameEn: s.nameEn,
        group: SUBJEKTIF_TERAS_CODES.includes(s.code) ? 'teras' : 'elektif',
        icon: s.icon,
        color: s.color,
        sets: await this.visibleSets(s.subjectId),
      })
    }
    subjects.sort((a, b) => (a.group === b.group ? 0 : a.group === 'teras' ? -1 : 1) || a.name.localeCompare(b.name, 'ms'))
    const stats = await this.ports.structuredAttempts.statsFor(caller.userId, found.map((s) => s.subjectId), { includeTest: caller.isTest })
    return { stats, subjects }
  }
}
