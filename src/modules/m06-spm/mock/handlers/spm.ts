/**
 * SRS M06 v1.4 §7 #1-#7: the read endpoints of S1-S6 and S8. Any session (A); guests get 401.
 * Counts are named queries on the M04 dataset (`spm.poolCount`), Tracking A figures are computed from
 * the set records, subjective counts from M04 `structured`; the hub constants are documented display
 * constants (DV-M06-01).
 */

import { notFound, ok, requireAuth, route, type MockRequest, type RouteDef } from '@/mock/define'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { structured } from '@/modules/m04-question-bank/mock'
import { SPM_MODES, practice } from '@/modules/m05-practice/mock'

import type {
  DatabankSubject,
  LatihTubiCard,
  LatihTubiConfig,
  OpenSubjectCard,
  Readiness,
  ReadinessTile,
  SpmOverview,
  SubjektifOverview,
  TrackingAHub,
  TrackingASubject,
} from '../../api/types'
import {
  BAHASA_SUBJECT_IDS,
  COUNT_OPTIONS,
  READINESS_ORDER,
  SPM_SUBJECTS,
  SUBJEKTIF_SUBJECT_IDS,
  SUBJEKTIF_TERAS_IDS,
  TARGET_TYPE_LABEL,
  TRACKING_YEAR,
} from '../data/config'
import { HUB_POOL_CHIP, HUB_TOTAL_QUESTIONS } from '../constants/display'
import { isStartable } from '../repository/rules'
import { spmRepo, type SetView } from '../repository/spm'

const auth = requireAuth()

export const userIdOf = (req: MockRequest): number => {
  if (!req.session) throw new Error('a guard must run first')
  return req.session.userId
}

const subjectMeta = (subjectId: number) => {
  const s = curriculum.subject(subjectId)
  return {
    name: s?.name ?? '',
    nameEn: s?.nameEn ?? '',
    icon: s?.icon ?? null,
    color: s?.color ?? '#64748B',
  }
}

const DIFFICULTIES = [1, 2, 3, 4, 5] as const
const diffMap = (fn: (d: number) => number) =>
  Object.fromEntries(DIFFICULTIES.map((d) => [String(d), fn(d)])) as Record<
    '1' | '2' | '3' | '4' | '5',
    number
  >

const allSets = (): SetView[] => spmRepo.subjectsWithSets().flatMap((id) => spmRepo.setsOf(id))
const sumReady = (sets: readonly SetView[]) => sets.reduce((a, s) => a + s.readyCount, 0)
const visibleSets = (subjectId: number): number =>
  structured.visible({ subjectId, pageSize: 1 }).total

/** #1 S1. */
function overview(req: MockRequest): SpmOverview {
  const levels = [10, 11].flatMap((l) => curriculum.subjects({ active: true, educationLevelId: l }))
  const stats = practice.historyPage(userIdOf(req), { modes: SPM_MODES }).stats
  const trackingA = sumReady(allSets())
  return {
    stats: {
      totalQuestions: HUB_TOTAL_QUESTIONS.value,
      subjectCount: new Set(levels.map((s) => s.id)).size,
      // The dataset has no `year` field on questions, so no year is available (as live: 0).
      yearsAvailable: 0,
      trackingAQuestions: trackingA,
    },
    modules: {
      databank: HUB_POOL_CHIP.value,
      latihTubi: HUB_POOL_CHIP.value,
      trackingA,
      subjektifSets: SUBJEKTIF_SUBJECT_IDS.reduce((a, id) => a + visibleSets(id), 0),
    },
    me: {
      sessions: stats.sessions,
      avgAccuracy: stats.avgAccuracyPct,
      coins: stats.coins,
      answered: stats.answered,
    },
  }
}

/** #2 S2: the 18 databank subjects in BR-M06-06 order. */
function databank(): DatabankSubject[] {
  return SPM_SUBJECTS.filter((s) => s.databankOrder !== null)
    .sort((a, b) => (a.databankOrder as number) - (b.databankOrder as number))
    .map((s) => ({
      code: s.code,
      ...subjectMeta(s.subjectId),
      databankCount: spmRepo.poolCount(s.subjectId),
    }))
}

/** #3 S3. */
function latihTubiList(): { teras: LatihTubiCard[]; elektif: LatihTubiCard[] } {
  const card = (s: (typeof SPM_SUBJECTS)[number]): LatihTubiCard => {
    const total = spmRepo.poolCount(s.subjectId)
    return {
      code: s.code,
      ...subjectMeta(s.subjectId),
      total,
      targetType: s.targetType,
      targetSize: s.targetSize,
      locked: s.targetSize !== null && total < s.targetSize,
    }
  }
  const group = (g: 'teras' | 'elektif') =>
    SPM_SUBJECTS.filter((s) => s.group === g)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(card)
  return { teras: group('teras'), elektif: group('elektif') }
}

/** #4 S4. */
function latihTubiConfig(code: string): LatihTubiConfig | null {
  const s = spmRepo.subjectByCode(code)
  if (!s) return null
  const meta = subjectMeta(s.subjectId)
  const cnt = (level?: number) => diffMap((d) => spmRepo.poolCount(s.subjectId, level, d))
  const total = spmRepo.poolCount(s.subjectId)
  const target = s.targetSize
  const label = s.targetType ? TARGET_TYPE_LABEL[s.targetType] : ''
  return {
    code: s.code,
    name: meta.name,
    icon: meta.icon,
    color: meta.color,
    total,
    targetType: s.targetType,
    targetSize: target,
    levelCounts: {
      '10': spmRepo.poolCount(s.subjectId, 10),
      '11': spmRepo.poolCount(s.subjectId, 11),
    },
    difficultyStats: cnt(),
    difficultyByLevel: { '10': cnt(10), '11': cnt(11) },
    countOptions:
      target !== null
        ? [{ value: target, label: `${String(target)} (Target ${label})`, isTarget: true }]
        : COUNT_OPTIONS.map((n) => ({ value: n, label: String(n), isTarget: false })),
    defaultCount: target ?? 10,
  }
}

const openCard = (subjectId: number, sets: SetView[]): OpenSubjectCard => {
  const cfg = spmRepo.subjectById(subjectId)
  const startable = sets.filter((s) => isStartable(s.status))
  const bank = startable.filter((s) => s.status === 'bank_besar')
  return {
    subjectId,
    code: cfg?.code ?? '',
    ...subjectMeta(subjectId),
    readyQuestions: sumReady(startable),
    bankBesarSets: bank.length,
    bersihSets: startable.length - bank.length,
    targetType: cfg?.targetType ?? null,
    targetSize: cfg?.targetSize ?? null,
    bankSource: bank.length > 0 ? bank.reduce((a, s) => a + (s.bankSource ?? 0), 0) : null,
    startableSets: startable.length,
  }
}

function readiness(): Readiness {
  const tiles: ReadinessTile[] = READINESS_ORDER.map((code) => {
    const cfg = spmRepo.subjectByCode(code)
    const subjectId = cfg?.subjectId as number
    const sets = spmRepo.setsOf(subjectId)
    const bersih = sets.filter((s) => s.status === 'bersih').length
    const bankBesar = sets.filter((s) => s.status === 'bank_besar').length
    const locked = sets.filter((s) => s.status === 'belum_cukup')
    return {
      code,
      name: subjectMeta(subjectId).name,
      targetSize: cfg?.targetSize ?? 0,
      bersih,
      bankBesar,
      locked: locked.length,
      total: sets.length,
      readiness: sets.length === 0 ? 0 : Math.round(((bersih + bankBesar) / sets.length) * 100),
      lockedSets: locked
        .slice(0, 6)
        .map((s) => ({ setNo: s.setNo, readyCount: s.readyCount, target: s.size })),
      hasBankBesar: bankBesar > 0,
    }
  })
  return {
    summary: {
      bersih: tiles.reduce((a, t) => a + t.bersih, 0),
      bankBesar: tiles.reduce((a, t) => a + t.bankBesar, 0),
      locked: tiles.reduce((a, t) => a + t.locked, 0),
    },
    tiles,
  }
}

/** #5 S5. */
function trackingHub(req: MockRequest): TrackingAHub {
  const open = SPM_SUBJECTS.filter((s) => !BAHASA_SUBJECT_IDS.includes(s.subjectId))
    .sort(
      (a, b) =>
        (a.group === b.group ? 0 : a.group === 'teras' ? -1 : 1) || a.displayOrder - b.displayOrder,
    )
    .map((s) => openCard(s.subjectId, spmRepo.setsOf(s.subjectId)))
    .filter((c) => c.startableSets > 0)
  const bahasa = BAHASA_SUBJECT_IDS.map((subjectId) => ({
    subjectId,
    code: spmRepo.subjectById(subjectId)?.code ?? '',
    ...subjectMeta(subjectId),
    sets: visibleSets(subjectId),
  }))
  return {
    objectiveLane: {
      subjects: open.length,
      sets: open.reduce((a, c) => a + c.startableSets, 0),
      // Σ over startable sets of (bankSource ?? readyCount): GEO 67 + AKAUN 640 + PSI 40 = 747.
      questions: open.reduce(
        (a, c) =>
          a +
          spmRepo
            .setsOf(c.subjectId)
            .filter((s) => isStartable(s.status))
            .reduce((n, s) => n + (s.bankSource ?? s.readyCount), 0),
        0,
      ),
    },
    bahasaLane: { subjects: 2, sets: bahasa.reduce((a, b) => a + b.sets, 0) },
    // BR-M06-30: role admin only.
    readiness: req.session?.role === 'admin' ? readiness() : null,
    bahasa,
    openSubjects: open,
  }
}

/** #6 S6; BM/BI redirect to the bahasa track. */
function trackingSubject(code: string): TrackingASubject | { redirect: string } | null {
  const cfg = spmRepo.subjectByCode(code)
  if (!cfg) return null
  if (cfg.subjectId === 1 || cfg.subjectId === 2) {
    return {
      redirect: `/latihan-berstruktur?subject_id=${String(cfg.subjectId)}&scope=spm&track=bahasa`,
    }
  }
  const sets = spmRepo.setsOf(cfg.subjectId, TRACKING_YEAR)
  const startable = sets.filter((s) => isStartable(s.status))
  const meta = subjectMeta(cfg.subjectId)
  return {
    code: cfg.code,
    name: meta.name,
    icon: meta.icon,
    color: meta.color,
    targetType: cfg.targetType,
    targetSize: cfg.targetSize,
    summary: {
      bersih: sets.filter((s) => s.status === 'bersih').length,
      bankBesar: sets.filter((s) => s.status === 'bank_besar').length,
      readyQuestions: sumReady(startable),
      belumCukup: sets.filter((s) => s.status === 'belum_cukup').length,
    },
    // Startable first, then locked, each by set number (FR-M06-49).
    sets: [...startable, ...sets.filter((s) => !isStartable(s.status))].map((s) => ({
      setNo: s.setNo,
      status: s.status,
      readyCount: s.readyCount,
      bankSource: s.bankSource,
      dskpTagged: s.dskpTagged,
      dskpTotal: s.dskpTotal,
    })),
  }
}

/** #7 S8 (BR-M06-18). */
function subjektif(req: MockRequest): SubjektifOverview {
  const attempts = practice
    .structuredAttempts(userIdOf(req))
    .filter((a) => a.scope === 'spm')
  const subjectOf = (id: number) => structured.get(id)?.subjectId ?? 0
  const pct = (a: { totalAwarded: number; totalMax: number }) =>
    a.totalMax > 0 ? (a.totalAwarded / a.totalMax) * 100 : 0
  const subjects: SubjektifOverview['subjects'] = SUBJEKTIF_SUBJECT_IDS.map((subjectId) => ({
    subjectId,
    ...subjectMeta(subjectId),
    group: SUBJEKTIF_TERAS_IDS.includes(subjectId) ? ('teras' as const) : ('elektif' as const),
    sets: visibleSets(subjectId),
  })).sort(
    (a, b) =>
      (a.group === b.group ? 0 : a.group === 'teras' ? -1 : 1) || a.name.localeCompare(b.name, 'ms'),
  )
  return {
    stats: {
      setsAnswered: attempts.length,
      subjectsTried: new Set(attempts.map((a) => subjectOf(a.structuredQuestionId))).size,
      bestScore: attempts.length === 0 ? null : Math.round(Math.max(...attempts.map(pct))),
      bestSetsSaved: new Set(attempts.map((a) => a.structuredQuestionId)).size,
    },
    subjects,
  }
}

export const spmReadRoutes: RouteDef[] = [
  route('GET', '/api/spm/overview', [auth], (req) => ok(overview(req))),
  route('GET', '/api/spm/databank', [auth], () => ok(databank())),
  route('GET', '/api/spm/latih-tubi', [auth], () => ok(latihTubiList())),
  route('GET', '/api/spm/latih-tubi/:code', [auth], (req) => {
    const r = latihTubiConfig(String(req.params.code))
    return r ? ok(r) : notFound()
  }),
  route('GET', '/api/spm/tracking-a', [auth], (req) => ok(trackingHub(req))),
  route('GET', '/api/spm/tracking-a/:code', [auth], (req) => {
    const r = trackingSubject(String(req.params.code))
    return r ? ok(r) : notFound()
  }),
  route('GET', '/api/spm/subjektif', [auth], (req) => ok(subjektif(req))),
]
