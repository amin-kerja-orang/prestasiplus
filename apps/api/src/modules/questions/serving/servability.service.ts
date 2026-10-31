import { Inject, Injectable } from '@nestjs/common'
import type { QuestionFacts } from '@pp/exam-core'
import type { ServabilityReport } from '@pp/contract'

import { idFromString, idToString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { optionImageIds } from '../../bijak/kuiz/kuiz.mapper'
import { QuestionsBijakPoolSource } from '../bijak-pool'
import { QuestionsRepository } from '../questions.repository'
import type { QuestionRecord, StimulusGroupRecord } from '../types'
import { evaluateAll } from './rules'
import type { LevelFact, ServabilityFacts, SubjectFact } from './types'

const big = (ids: Iterable<string>): bigint[] => [...new Set(ids)].map((id) => idFromString(id))

/**
 * R1-B03 (lite) "Dilihat murid di": loads, in batch, what the rules need and applies `evaluate` (see `rules.ts`). No migration, no
 * facts table: it asks the same readers as the draws (bank, practice and kuiz mappers, Bijak bridge, pool facts) and the database
 * for the level, subject, paper and file rows. A question the bank does not return (unknown, PKSK, Darjah) has no report.
 *
 * Cost: a handful of statements per call, plus one Jana pool read per distinct subject, narrowed to the requested ids (R1-T30; before
 * it read the whole subject). No facts table (D92).
 */
@Injectable()
export class ServabilityService {
  constructor(
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QuestionsBijakPoolSource) private readonly pool: QuestionsBijakPoolSource,
  ) {}

  private get db() {
    return this.prisma.client
  }

  async report(id: string): Promise<ServabilityReport | null> {
    return (await this.reports([id])).get(id) ?? null
  }

  /** One report per known question id (unknown ids are absent). */
  async reports(ids: readonly string[]): Promise<ReadonlyMap<string, ServabilityReport>> {
    const facts = await this.factsOf(ids)
    return new Map([...facts].map(([id, f]) => [id, evaluateAll(f)]))
  }

  /** The loaded facts (exported for the specs and for T30 reads that need the same data). */
  async factsOf(ids: readonly string[]): Promise<ReadonlyMap<string, ServabilityFacts>> {
    const wanted = [...new Set(ids)].filter(isIdString)
    if (wanted.length === 0) return new Map()
    const latest = new Map((await this.questions.getMany(wanted, 'latest')).map((r) => [r.id, r]))
    if (latest.size === 0) return new Map()
    const live = new Map((await this.questions.getMany([...latest.keys()], 'live')).map((r) => [r.id, r]))
    const records = [...live.values()]

    const [levels, subjects, groups, linkedAssets, onPaper, jana] = await Promise.all([
      this.levelsOf([...latest.values()].flatMap((r) => (r.version.educationLevelId ? [r.version.educationLevelId] : []))),
      this.subjectsOf([...latest.values()]),
      this.groupsOf(records),
      this.assetsOf(records),
      this.onPublishedPaper([...live.keys()]),
      this.janaFactsOf(records),
    ])
    const tokens = await this.tokensOf(records, groups, linkedAssets)

    const out = new Map<string, ServabilityFacts>()
    for (const [id, l] of latest) {
      const v = (live.get(id) ?? l).version
      out.set(id, {
        live: live.get(id) ?? null,
        latest: l,
        level: v.educationLevelId ? (levels.get(v.educationLevelId) ?? null) : null,
        subject: subjects.get(`${v.subjectId ?? ''}:${v.educationLevelId ?? ''}`) ?? null,
        group: live.get(id)?.groupId ? (groups.get(live.get(id)!.groupId!) ?? null) : null,
        linkedAssets,
        fileTokens: tokens,
        onPublishedPaper: onPaper.has(id),
        janaFacts: jana.get(id) ?? null,
      })
    }
    return out
  }

  private async levelsOf(ids: readonly string[]): Promise<Map<string, LevelFact>> {
    if (ids.length === 0) return new Map()
    const rows = await this.db.$queryRaw<{ id: bigint; code: string; stage: string; is_active: boolean }[]>`
      SELECT id, code, stage, is_active FROM education_levels WHERE id = ANY(${big(ids)}::bigint[])`
    return new Map(rows.map((r) => [idToString(r.id), { id: idToString(r.id), code: r.code, stage: r.stage, isActive: r.is_active }]))
  }

  /** Key `subjectId:levelId`: the subject's own flags plus whether it is linked to that level and where it is listed. */
  private async subjectsOf(records: readonly QuestionRecord[]): Promise<Map<string, SubjectFact>> {
    const pairs = [...new Map(records.flatMap((r) => (r.version.subjectId && r.version.educationLevelId ? [[`${r.version.subjectId}:${r.version.educationLevelId}`, r.version] as const] : []))).values()]
    const subjectIds = [...new Set(records.flatMap((r) => (r.version.subjectId ? [r.version.subjectId] : [])))]
    if (subjectIds.length === 0) return new Map()
    const [subs, links, configs] = await Promise.all([
      this.db.$queryRaw<{ id: bigint; is_active: boolean }[]>`SELECT id, is_active FROM subjects WHERE id = ANY(${big(subjectIds)}::bigint[])`,
      this.db.$queryRaw<{ subject_id: bigint; education_level_id: bigint }[]>`
        SELECT subject_id, education_level_id FROM subject_levels WHERE subject_id = ANY(${big(subjectIds)}::bigint[])`,
      this.db.$queryRaw<{ subject_id: bigint; databank_order: number | null }[]>`
        SELECT subject_id, databank_order FROM spm_subject_configs WHERE subject_id = ANY(${big(subjectIds)}::bigint[])`,
    ])
    const linked = new Set(links.map((l) => `${idToString(l.subject_id)}:${idToString(l.education_level_id)}`))
    const config = new Map(configs.map((c) => [idToString(c.subject_id), c.databank_order]))
    const byId = new Map(subs.map((s) => [idToString(s.id), s.is_active]))
    const out = new Map<string, SubjectFact>()
    for (const v of pairs) {
      const key = `${v.subjectId}:${v.educationLevelId}`
      const active = byId.get(v.subjectId as string)
      if (active === undefined) continue
      out.set(key, {
        id: v.subjectId as string,
        isActive: active,
        linkedToLevel: linked.has(key),
        spmListed: config.has(v.subjectId as string),
        databankListed: (config.get(v.subjectId as string) ?? null) !== null,
      })
    }
    return out
  }

  private async groupsOf(records: readonly QuestionRecord[]): Promise<Map<string, StimulusGroupRecord>> {
    const out = new Map<string, StimulusGroupRecord>()
    for (const r of records) {
      if (r.groupId === null || out.has(r.groupId)) continue
      const group = await this.questions.groupOf(r.id)
      if (group) out.set(r.groupId, group)
    }
    return out
  }

  private async assetsOf(records: readonly QuestionRecord[]): Promise<Map<string, { kind: string; assetFileId: string | null }>> {
    const linked = new Set<string>()
    for (const r of records) {
      for (const id of r.version.stimulusIds) linked.add(id)
      for (const part of walkLeaves(r.version.parts)) if (part.stimulusId) linked.add(part.stimulusId)
    }
    return new Map((await this.questions.stimulusAssets([...linked])).map((a) => [a.id, { kind: a.kind, assetFileId: a.assetFileId }]))
  }

  private async tokensOf(
    records: readonly QuestionRecord[],
    groups: ReadonlyMap<string, StimulusGroupRecord>,
    assets: ReadonlyMap<string, { assetFileId: string | null }>,
  ): Promise<Map<string, string>> {
    const files = new Set<string>()
    for (const g of groups.values()) for (const s of g.stimuli) if (s.assetFileId) files.add(s.assetFileId)
    for (const a of assets.values()) if (a.assetFileId) files.add(a.assetFileId)
    for (const r of records) for (const id of optionImageIds(r)) files.add(id)
    if (files.size === 0) return new Map()
    const rows = await this.db.$queryRaw<{ id: bigint; public_id: string }[]>`SELECT id, public_id FROM files WHERE id = ANY(${big(files)}::bigint[])`
    return new Map(rows.map((r) => [idToString(r.id), r.public_id]))
  }

  /** Questions placed on a published paper that pupils can sit (a per-pupil generated paper does not count). */
  private async onPublishedPaper(ids: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set()
    const rows = await this.db.$queryRaw<{ question_id: bigint }[]>`
      SELECT DISTINCT pl.question_id
        FROM paper_placements pl
        JOIN paper_sections ps ON ps.id = pl.paper_section_id
        JOIN papers p ON p.id = ps.paper_id
       WHERE p.status = 'published' AND p.kind <> 'jana' AND pl.question_id = ANY(${big(ids)}::bigint[])`
    return new Set(rows.map((r) => idToString(r.question_id)))
  }

  /** Jana pool facts of the live versions, read for those question ids only (per subject), never the whole subject. */
  private async janaFactsOf(records: readonly QuestionRecord[]): Promise<Map<string, QuestionFacts>> {
    const bySubject = new Map<string, string[]>()
    for (const r of records) if (r.version.subjectId) bySubject.set(r.version.subjectId, [...(bySubject.get(r.version.subjectId) ?? []), r.id])
    const out = new Map<string, QuestionFacts>()
    for (const [subjectId, ids] of bySubject) {
      for (const facts of await this.pool.candidatesOf(subjectId, ids)) out.set(facts.id, facts)
    }
    return out
  }
}

type Leaf = Extract<QuestionRecord['version']['parts'][number], { mode: string }>
function walkLeaves(parts: QuestionRecord['version']['parts']): Leaf[] {
  return parts.flatMap((p) => ('mode' in p ? [p as Leaf] : walkLeaves(p.children as QuestionRecord['version']['parts'])))
}
