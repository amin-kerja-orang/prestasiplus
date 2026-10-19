import type { BulkDeleteRequestSchema, BulkImportRequestSchema } from '@pp/contract'
import type { z } from 'zod'

export type BulkImportBody = z.infer<typeof BulkImportRequestSchema>
export type BulkDeleteBody = z.infer<typeof BulkDeleteRequestSchema>
