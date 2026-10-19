import type { Type } from '@nestjs/common'

/**
 * Module registry. Each lane adds ONE import and ONE array entry for its Nest module
 * (append-only; never reorder). `app.module.ts` imports this list.
 */
export const featureModules: Type<unknown>[] = []
