import type { Type } from '@nestjs/common'

import { AuthModule } from './auth'
import { SchoolsModule } from './schools'

/**
 * Module registry. Each lane adds ONE import and ONE array entry for its Nest module
 * (append-only; never reorder). `app.module.ts` imports this list.
 */
export const featureModules: Type<unknown>[] = [AuthModule, SchoolsModule]
