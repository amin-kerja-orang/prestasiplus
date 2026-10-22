import { lookup } from 'node:dns/promises'

import { Module } from '@nestjs/common'

import { AuditModule } from '../../common/audit/audit.module'
import { ThrottleModule } from '../../common/throttle'
import { NotificationsModule } from '../notifications'
import { UsersModule } from '../users'
import { AiAdminController } from './ai-admin.controller'
import { AiAdminService } from './ai-admin.service'
import { AiBudgetService } from './ai-budget.service'
import { AiCallPipeline } from './ai-call.pipeline'
import { AiExtractionService } from './ai-extraction.service'
import { AiExtractorAdapter } from './ai-extractor.adapter'
import { AiRunsService } from './ai-runs.service'
import { AiConfig } from './ai.config'
import { AI_FETCH, AI_PROVIDER, AI_RESOLVER, AI_SLEEP } from './ai.constants'
import { AiRepository } from './ai.repository'
import type { AiFetch, AiResolver, AiSleep } from './ai.types'
import { createPinnedFetch } from './net/pinned-fetch'
import { createProvider } from './providers/registry'

/** Resolves every A and AAAA record. The SSRF check judges all of them. */
const dnsResolver: AiResolver = async (hostname) => (await lookup(hostname, { all: true, verbatim: true })).map((a) => a.address)

const realSleep: AiSleep = (ms, signal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new DOMException('aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })

/**
 * BE-36 AI extraction service (D52, plan 15). Provider adapters behind one interface (mock by default), redaction,
 * rate limits, retry, usage log, monthly budget, and the four admin routes. Exports `AiExtractionService` (in-process
 * `extractPaper`, `suggestTags`, `generateText`), `AiRunsService` (BE-38 pre-creates runs with file and job references)
 * and `AiExtractorAdapter`, which `IntakeFilesModule` binds to the BE-37 `AI_EXTRACTOR` token.
 */
@Module({
  imports: [AuditModule, ThrottleModule, NotificationsModule, UsersModule],
  controllers: [AiAdminController],
  providers: [
    AiConfig,
    AiRepository,
    AiRunsService,
    AiBudgetService,
    AiCallPipeline,
    AiExtractionService,
    AiAdminService,
    AiExtractorAdapter,
    { provide: AI_FETCH, useFactory: (): AiFetch => createPinnedFetch() },
    { provide: AI_RESOLVER, useValue: dnsResolver },
    { provide: AI_SLEEP, useValue: realSleep },
    { provide: AI_PROVIDER, useFactory: (config: AiConfig, fetchImpl: AiFetch, resolver: AiResolver) => createProvider(config, fetchImpl, resolver), inject: [AiConfig, AI_FETCH, AI_RESOLVER] },
  ],
  exports: [AiExtractionService, AiRunsService, AiExtractorAdapter],
})
export class AiExtractionModule {}
