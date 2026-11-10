/**
 * Builds the Terbit publisher of `terbit-pass.ts` from an in-process Nest application context (no HTTP server): the same
 * `BuilderService.publish` the Studio route calls, as an Admin Pusat migration actor. Imported lazily by the `migrate:papers` command only,
 * so the loaders and their tests do not pull the Nest modules.
 *
 * Environment: `DATABASE_URL` (the V3 database), plus whatever the app's env schema requires (`SESSION_SECRET`, ...), as for the API process.
 */
import 'reflect-metadata'

import { NestFactory } from '@nestjs/core'
import type pg from 'pg'

import { defineAppModule } from '../../../app.module'
import { BijakPapersModule } from '../../../modules/bijak/papers'
import { ExamBlueprintsModule } from '../../../modules/exam/blueprints'
import { BuilderService, ExamBuilderModule } from '../../../modules/exam/builder'
import type { PaperPublisher } from './terbit-pass'

/** The first Admin Pusat user (the audit row needs a real actor); null when the database has none. */
export async function findMigrationActor(pool: Pick<pg.Pool, 'query'>): Promise<string | null> {
  const res = await pool.query<{ user_id: string }>(`SELECT user_id::text AS user_id FROM user_roles WHERE role = 'admin' ORDER BY user_id LIMIT 1`)
  return res.rows[0]?.user_id ?? null
}

export async function openTerbitPublisher(actorUserId: string): Promise<{ publish: PaperPublisher; close(): Promise<void> }> {
  const app = await NestFactory.createApplicationContext(defineAppModule([BijakPapersModule, ExamBuilderModule, ExamBlueprintsModule]), { logger: ['error'] })
  const builder = app.get(BuilderService)
  const actor = { userId: actorUserId, role: 'admin', requestId: null, ip: null, isTest: false }
  return {
    async publish(paperId) {
      // KP-14: a V2-published paper keeps the status V2 gave its questions; the legacy publish drops only the lines caused by that status (and the
      // Kontrak lines) and still refuses every structural blocker. Audited with `LEGACY_V2_PUBLISH_REASON`.
      const r = await builder.publishLegacyV2(actor, paperId)
      return { ok: r.ok, errors: r.errors, overridden: r.overridden }
    },
    close: () => app.close(),
  }
}
