import { z } from '../zod'
import { ListMetaSchema } from '../common/envelope'

/**
 * Helpers shared by the question-workflow wire files (BE-10, contract-only). Kept local to this
 * folder on purpose: no other domain folder is imported (BE-09 is not merged yet).
 */

/** Size limit of a CSV upload and of a diagram image (mock `workflow-common.ts`). */
export const QUESTION_WORKFLOW_CSV_MAX_BYTES = 5 * 1024 * 1024
export const QUESTION_WORKFLOW_IMAGE_MAX_BYTES = 2 * 1024 * 1024

/**
 * Mutating routes of this card answer `{ data, status }`: `status` is the BM flash text the screen
 * queues (mock `ok(data, { status })`, "E3" in the API catalogue). Not part of the common envelope.
 */
export function questionWorkflowMutationOf<T extends z.ZodType>(data: T) {
  return z.object({
    data,
    status: z.string().min(1).meta({ description: 'BM flash text for the success message.' }),
  })
}

/**
 * List meta of a list that is not paged in the mock (`unpaged`): `page` 1, `pageSize` = max(1, n),
 * `totalPages` 1. Module aggregates ride next to the standard keys.
 */
export function questionWorkflowListMetaOf<T extends z.ZodRawShape>(extra: T) {
  return ListMetaSchema.extend(extra)
}

/** Options of a file part. */
export interface QuestionWorkflowFileOptions {
  maxBytes: number
  /** Accepted declared MIME types. An empty declared type is judged by the extension. */
  mimes: readonly string[]
  /** Accepted extensions (lower case, without the dot). */
  extensions: readonly string[]
  description: string
}

/**
 * A multipart file part (OpenAPI `string` / `binary`). Validates `Blob`/`File` instances: size,
 * declared MIME type, and the extension (when the browser sends no type the extension decides).
 * Storage itself belongs to BE-04 (`FileStorage`); the contract only describes the field.
 */
export function questionWorkflowFile(options: QuestionWorkflowFileOptions) {
  const { maxBytes, mimes, extensions, description } = options
  return z
    .custom<Blob>((value) => {
      if (!(value instanceof Blob)) return false
      if (value.size > maxBytes) return false
      const name = (value as Blob & { name?: string }).name ?? ''
      const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : ''
      if (!extensions.includes(ext)) return false
      return value.type === '' || mimes.includes(value.type)
    })
    .meta({ type: 'string', format: 'binary', description })
}

/**
 * Request `page` query: a missing or invalid value means 1 at runtime (an out-of-range page is an
 * empty page, not an error), as the mock `pageParams`.
 */
export const questionWorkflowPageQuery = () => z.coerce.number().int().min(1).optional()
