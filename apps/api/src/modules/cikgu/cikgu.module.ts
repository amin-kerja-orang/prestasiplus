import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../common/throttle'
import { ClassesModule } from '../classes'
import { CurriculumModule } from '../curriculum'
import { PracticeModule } from '../practice'
import { UsersModule } from '../users'
import { CIKGU_AI } from './ai.port'
import { CikguChatController, CikguToolsController } from './cikgu.controller'
import { CikguRepository } from './cikgu.repository'
import { CikguService } from './cikgu.service'
import { MockCikguAi } from './mock-cikgu-ai'

/**
 * Cikgu Alesa (M13, BE-43): the chat turn and the teacher tools (RPH, essay markings, PBD tags). Exports `CikguRepository`,
 * the only doorway to `chat_threads`, `chat_messages`, `rph_plans`, `essay_markings` and `pbd_tags` (ADR-0014).
 *
 * The AI comes from the `CIKGU_AI` provider. Today it is `MockCikguAi` (the canned logic). When BE-36's `generateText`
 * has merged, an adapter-backed implementation replaces the `useClass` below (and a test overrides the provider the same
 * way); no controller or service changes.
 */
@Module({
  imports: [ThrottleModule, UsersModule, CurriculumModule, ClassesModule, PracticeModule],
  controllers: [CikguChatController, CikguToolsController],
  providers: [CikguRepository, CikguService, MockCikguAi, { provide: CIKGU_AI, useExisting: MockCikguAi }],
  exports: [CikguRepository],
})
export class CikguModule {}
