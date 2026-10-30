/**
 * The service-layer `Gateway` of the K1 draft script: the real `BlueprintsService` and `BuilderService` of the API (the same code
 * the Admin Pusat routes run, with their validation, locks and audit rows), wired by hand over one `PrismaService` so that no HTTP
 * server, session or credential is needed. The database is the one of `DATABASE_URL`.
 *
 * Reads that the services do not offer (the eligible stock, the papers of a subject) are read-only parameterised queries.
 * The audit rows are written under an existing active Admin Pusat user (the lowest id, or `--actor-id`); nothing about that user is printed.
 */
import type { ConfigService } from '@nestjs/config'

import { AuditService } from '../../common/audit/audit.service'
import type { Env } from '../../common/config/env.schema'
import { SystemClock } from '../../db/clock'
import { PrismaService } from '../../db/prisma.service'
import { BlueprintsRepository } from '../../modules/exam/blueprints/blueprints.repository'
import { BlueprintsService } from '../../modules/exam/blueprints/blueprints.service'
import { BuilderRepository } from '../../modules/exam/builder/builder.repository'
import { BuilderService } from '../../modules/exam/builder/builder.service'
import { BijakBuilderPorts } from '../../modules/exam/builder/ports'
import { QuestionBankBuilderSource } from '../../modules/exam/builder/question-bank.source'
import { QuestionsRepository } from '../../modules/questions/questions.repository'
import { curriculumCodeOf } from '../../modules/bijak/papers/subject-codes'
import { ScriptError, type BlueprintBody, type BlueprintInfo, type ExistingPaper, type Gateway } from './run'
import type { Candidate } from './select'

/** Audit actor of the writes: an Admin Pusat user. The shape of `AuditActor` of the exam modules. */
interface Actor {
  userId: string
  role: string
  requestId: string | null
  ip: string | null
  isTest: boolean
}

export class ActorError extends ScriptError {}

interface EligibleRow {
  id: bigint
  legacy_id: string
  level_code: string
  level_stage: string
  dedupe: string
}

/** School level of an education level: Tingkatan 4 and 5 by code, lower secondary as one bucket; anything else is not SPM stock. */
export function stratumOf(levelCode: string, levelStage: string): string | null {
  if (levelCode === 'T4') return 't4'
  if (levelCode === 'T5') return 't5'
  return levelStage === 'lower_secondary' ? 't1_t3' : null
}

export async function connectGateway(databaseUrl: string, actorId?: string): Promise<{ gateway: Gateway; close: () => Promise<void> }> {
  // Only DATABASE_URL is needed; the audit service reads SESSION_SECRET for the keyed IP hash, which is unused (no IP is recorded).
  const config = { get: (key: string) => (key === 'DATABASE_URL' ? databaseUrl : process.env[key]) } as unknown as ConfigService<Env, true>
  const prisma = new PrismaService(config)
  const clock = new SystemClock()
  const audit = new AuditService(prisma, config)
  const ports = new BijakBuilderPorts()
  const builderRepo = new BuilderRepository(prisma)
  // The source only needs `QuestionsRepository` for `review`, which the script never calls.
  ports.provideQuestionSource(new QuestionBankBuilderSource(prisma, new QuestionsRepository(prisma), builderRepo))
  const blueprints = new BlueprintsService(new BlueprintsRepository(prisma), prisma, clock, audit)
  const builder = new BuilderService(builderRepo, prisma, clock, audit, ports)

  let actor: Actor | undefined
  const getActor = async (): Promise<Actor> => {
    if (actor) return actor
    const rows = await prisma.$queryRaw<{ id: bigint }[]>`
      SELECT u.id FROM users u
       WHERE u.is_active AND NOT u.is_suspended
         AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'admin')
         AND (${actorId ?? null}::text IS NULL OR u.id::text = ${actorId ?? null}::text)
       ORDER BY u.id ASC LIMIT 1`
    const row = rows[0]
    if (!row) throw new ActorError(actorId ? 'The --actor-id is not an active Admin Pusat user.' : 'No active Admin Pusat user exists to attribute the audit rows to.')
    actor = { userId: row.id.toString(), role: 'admin', requestId: null, ip: null, isTest: false }
    return actor
  }

  const sectionIdsOf = async (paperId: string): Promise<string[]> => {
    const rows = await prisma.paperSection.findMany({ where: { paperId: BigInt(paperId) }, select: { id: true }, orderBy: { position: 'asc' } })
    return rows.map((x) => x.id.toString())
  }

  const subjectRow = (bijak: string) => prisma.subject.findUnique({ where: { code: curriculumCodeOf(bijak) }, select: { id: true, name: true } })

  const gateway: Gateway = {
    async subject(code) {
      const s = await subjectRow(code)
      return s ? { name: s.name } : null
    },

    async eligible(code): Promise<Candidate[]> {
      const s = await subjectRow(code)
      if (!s) return []
      // Migrated (QLOAD, source `cloud`), live version published, question active, one top-level MCQ part with 2 to 8 options that all
      // have text and one key naming one of them; no stimulus group; the subject of the paper.
      const rows = await prisma.$queryRaw<EligibleRow[]>`
        SELECT q.id, q.legacy_id, el.code AS level_code, el.stage AS level_stage,
               md5(lower(btrim(coalesce(v.stem_ms, '')))) AS dedupe
          FROM questions q
          JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
          JOIN education_levels el ON el.id = v.education_level_id
         WHERE q.legacy_source = 'cloud' AND q.legacy_id IS NOT NULL AND q.is_active AND q.group_id IS NULL
           AND v.status = 'published' AND v.type = 'mcq' AND v.subject_id = ${s.id}
           AND btrim(coalesce(v.stem_ms, '')) <> ''
           AND (SELECT count(*) FROM question_parts p WHERE p.question_version_id = v.id) = 1
           AND EXISTS (
                 SELECT 1 FROM question_parts p
                   JOIN answer_keys k ON k.part_id = p.id AND k.kind = 'option'
                  WHERE p.question_version_id = v.id AND p.parent_part_id IS NULL AND p.mode = 'mcq'
                    AND jsonb_typeof(k.content -> 'correct') = 'string'
                    AND (SELECT count(*) FROM part_options o WHERE o.part_id = p.id) BETWEEN 2 AND 8
                    AND NOT EXISTS (SELECT 1 FROM part_options o WHERE o.part_id = p.id AND btrim(coalesce(o.body_ms, '')) = '' AND o.image_file_id IS NULL)
                    AND EXISTS (SELECT 1 FROM part_options o WHERE o.part_id = p.id AND o.label = k.content ->> 'correct'))`
      return rows.flatMap((r) => {
        const stratum = stratumOf(r.level_code, r.level_stage)
        return stratum === null ? [] : [{ id: r.id.toString(), legacyId: r.legacy_id, stratum, dedupeKey: r.dedupe }]
      })
    },

    async blueprint(code, kertas): Promise<BlueprintInfo | null> {
      const s = await subjectRow(code)
      if (!s) return null
      const bp = await new BlueprintsRepository(prisma).active(s.id, kertas)
      return bp
        ? { source: bp.source, code: bp.code, sections: bp.sections.map((x) => ({ ruleType: x.ruleType, questionCount: x.questionCount, markBudget: x.markBudget })) }
        : null
    },

    async writeBlueprint(body: BlueprintBody, replace: boolean) {
      const who = await getActor()
      if (replace) {
        const { subject, kertas, ...version } = body
        await blueprints.addVersion(who, subject, String(kertas), version)
      } else {
        await blueprints.create(who, body)
      }
    },

    async papers(code, kertas): Promise<ExistingPaper[]> {
      const s = await subjectRow(code)
      if (!s) return []
      const rows = await prisma.paper.findMany({
        where: { kind: 'pilihan', subjectId: s.id, kertas },
        select: { id: true, title: true, status: true, sections: { select: { placements: { select: { questionId: true } } } } },
        orderBy: { id: 'asc' },
      })
      return rows.map((r) => ({
        id: r.id.toString(),
        title: r.title,
        status: r.status,
        questionIds: r.sections.flatMap((x) => x.placements.map((p) => p.questionId.toString())),
      }))
    },

    async createPaper(code, kertas, title) {
      const { id } = await builder.create(await getActor(), { subject: code, kertas, title })
      return { id, sectionIds: await sectionIdsOf(id) }
    },

    sectionIds: sectionIdsOf,

    async fillSection(paperId, sectionId, questionIds) {
      await builder.update(await getActor(), paperId, { sections: [{ id: sectionId, questionIds }] })
      // Read back: the section must hold exactly what was asked, in order.
      const placed = await prisma.paperPlacement.findMany({
        where: { paperSectionId: BigInt(sectionId) },
        select: { questionId: true },
        orderBy: { position: 'asc' },
      })
      const got = placed.map((p) => p.questionId.toString())
      if (got.length !== questionIds.length || got.some((id, i) => id !== questionIds[i])) throw new ScriptError('the saved question list differs from the planned one')
    },

    async draftsPassingCheck(paperIds) {
      const wanted = new Set(paperIds)
      let ok = 0
      let seen = 0
      for (let page = 1; page <= 10 && seen < wanted.size; page++) {
        const { data } = await builder.list({ status: 'draf', page, pageSize: 100 })
        if (data.length === 0) break
        for (const row of data) {
          if (!wanted.has(row.id)) continue
          seen++
          if (row.ok) ok++
        }
      }
      return seen === wanted.size ? ok : null
    },
  }
  return { gateway, close: () => prisma.$disconnect() }
}
