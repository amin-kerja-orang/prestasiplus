import { z } from '../zod'
import { SPM_MESSAGES, SpmWalkthroughSubjectSchema } from './shared'

/**
 * Simulated step-by-step walkthrough (M06-13). The answer is canned text (no external call, D4);
 * the uploaded image is never stored. The body is the live-shaped raw `{ ok, walkthrough | error }`
 * (no `data` envelope) and business errors are HTTP 200.
 */

/** Largest accepted image. A larger or non-`image/*` file is a business error (HTTP 200 `ok: false`). */
export const SPM_WALKTHROUGH_MAX_IMAGE_BYTES = 5 * 1024 * 1024
/** Characters of the question echoed after "Soalan: ". */
export const SPM_WALKTHROUGH_ECHO_CHARS = 80

/**
 * `POST /spm-walkthrough/solve` body, `multipart/form-data` (snake_case key as live). Only
 * `subject` is a validation error (422 `fields.subject` "Sila pilih subjek."). The image part is
 * checked by the handler, not by this schema, so its refusals can answer 200 `{ ok: false }`.
 */
export const SpmWalkthroughRequestSchema = z
  .object({
    subject: SpmWalkthroughSubjectSchema,
    question_text: z.string().optional().meta({ description: 'Trimmed by the server; may be empty when an image is sent.' }),
    image: z
      .custom<Blob>((value) => value instanceof Blob)
      .optional()
      .meta({
        type: 'string',
        format: 'binary',
        description: 'Optional question photo, image/* and at most 5 MB; otherwise 200 { ok: false, error: "Gambar tidak sah." }. Never stored.',
      }),
  })
  .meta({ id: 'SpmWalkthroughRequest' })
export type SpmWalkthroughRequest = z.infer<typeof SpmWalkthroughRequestSchema>

/** Success: `walkthrough` = `Soalan: <first 80 chars of the text, or (gambar)>\n\n<canned text>`. */
export const SpmWalkthroughSolvedSchema = z
  .strictObject({ ok: z.literal(true), walkthrough: z.string().min(1) })
  .meta({ id: 'SpmWalkthroughSolved' })

/** Business error, HTTP 200: `error` is "Gambar tidak sah." or "Sila masukkan soalan atau muat naik gambar soalan.". */
export const SpmWalkthroughRefusedSchema = z
  .strictObject({
    ok: z.literal(false),
    error: z.enum([SPM_MESSAGES.walkthroughImageInvalid, SPM_MESSAGES.walkthroughEmpty]),
  })
  .meta({ id: 'SpmWalkthroughRefused' })

/** Raw response body of `POST /spm-walkthrough/solve` (HTTP 200 in both cases). */
export const SpmWalkthroughResponseSchema = z
  .union([SpmWalkthroughSolvedSchema, SpmWalkthroughRefusedSchema])
  .meta({ id: 'SpmWalkthroughResponse' })
export type SpmWalkthroughResponse = z.infer<typeof SpmWalkthroughResponseSchema>
