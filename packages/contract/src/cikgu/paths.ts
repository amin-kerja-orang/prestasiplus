import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { IdSchema } from '../common/ids'
import { envelopeOf, listEnvelopeOf } from '../common/envelope'
import { RATE_LIMITED_RESPONSE, registerRoute } from './rate-limit'
import {
  CIKGU_PAGE_SIZE,
  CIKGU_PBD_CSV_FILENAME,
  CIKGU_PBD_CSV_HEADER,
  CikguBulkApproveRequestSchema,
  CikguBulkApproveResultSchema,
  CikguChatEmptyBodySchema,
  CikguChatErrorBodySchema,
  CikguChatQuotaBodySchema,
  CikguChatTierSchema,
  CikguEssayListItemSchema,
  CikguEssayMarkingSchema,
  CikguLevelCodeSchema,
  CikguPbdQueueItemSchema,
  CikguRollupRequestSchema,
  CikguRollupResultSchema,
  CikguRphCreateRequestSchema,
  CikguRphListItemSchema,
  CikguRphSchema,
  CikguRubricKeySchema,
  CikguSendRequestSchema,
  CikguSendResponseSchema,
} from './schema'

/** Components contributed by BE-43 (M13 Cikgu Alesa); appended to COMPONENT_SCHEMAS in openapi.ts. */
export const CIKGU_COMPONENT_SCHEMAS = {
  CikguRubricKey: CikguRubricKeySchema,
  CikguLevelCode: CikguLevelCodeSchema,
  CikguChatTier: CikguChatTierSchema,
  CikguSendRequest: CikguSendRequestSchema,
  CikguSendResponse: CikguSendResponseSchema,
  CikguChatEmptyBody: CikguChatEmptyBodySchema,
  CikguChatQuotaBody: CikguChatQuotaBodySchema,
  CikguChatErrorBody: CikguChatErrorBodySchema,
  CikguRph: CikguRphSchema,
  CikguRphListItem: CikguRphListItemSchema,
  CikguRphCreateRequest: CikguRphCreateRequestSchema,
  CikguEssayMarking: CikguEssayMarkingSchema,
  CikguEssayListItem: CikguEssayListItemSchema,
  CikguPbdQueueItem: CikguPbdQueueItemSchema,
  CikguRollupRequest: CikguRollupRequestSchema,
  CikguRollupResult: CikguRollupResultSchema,
  CikguBulkApproveRequest: CikguBulkApproveRequestSchema,
  CikguBulkApproveResult: CikguBulkApproveResultSchema,
} as const

const TAGS = ['cikgu']

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)

/** Personal data of minors: never cached by the browser or a proxy (PDPA, data minimisation). */
const NO_STORE_HEADERS = {
  'Cache-Control': {
    description: 'no-store: the body carries personal data of minors (chat text, essays, student names).',
    schema: { type: 'string' as const, enum: ['no-store'] },
  },
}
const noStore = (schema: z.ZodType, description: string) => ({
  description,
  headers: NO_STORE_HEADERS,
  content: { 'application/json': { schema } },
})

const UNAUTHORIZED = err('UNAUTHORIZED "Unauthenticated." (no valid session).')
const FORBIDDEN_TEACHER = err('FORBIDDEN "This action is unauthorized." (any role other than teacher or admin).')
const CSRF_INVALID = err('CSRF_INVALID (missing or wrong X-CSRF-Token).')
const NOT_FOUND = err('NOT_FOUND "Not Found." (unknown, foreign or non-numeric id; indistinguishable on purpose).')
const AI_UNAVAILABLE_ENVELOPE = err(
  '[PROPOSED] AI_UNAVAILABLE "Cikgu Alesa tak boleh respon. Cuba lagi." (provider error, BE-36 rate limit or AI_BUDGET_EXHAUSTED). Nothing is stored.',
)

const csrf = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})
const pageQuery = z.object({
  page: z
    .number()
    .int()
    .min(1)
    .optional()
    .meta({
      description: `1-based page. The page size is fixed at ${String(CIKGU_PAGE_SIZE)} (no pageSize). An invalid value means 1; a page beyond the last is an empty page that keeps the requested page number.`,
    }),
})
const idParam = z.object({
  id: IdSchema.meta({ description: 'Decimal-string id of a row of the caller. Unknown, foreign or non-numeric = 404.' }),
})

const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })

/** Registers the ten M13 routes. `POST /cikgu/send` and `GET /cikgu/pbd/export.csv` are NOT `{data}` bodies. */
export function registerCikguPaths(registry: OpenAPIRegistry): void {
  // #1 chat turn ----------------------------------------------------------------------------------
  registerRoute(registry, {
    method: 'post',
    path: '/cikgu/send',
    tags: TAGS,
    summary: 'Chat turn with Cikgu Alesa (raw, un-enveloped body)',
    description:
      'Any signed-in role. RAW body (no `{data}` envelope, snake_case), as the live site; the client reads the body for every HTTP status. ' +
      'A guest gets 401 with body exactly `{}` (not the error envelope). A non-string or blank (after trim) `message` is 422 body `{}`, checked before the thread and the AI call; nothing is stored. ' +
      'Quota by role (BR-M13-06), counted per user per Malaysia calendar day from the stored user messages: `admin` tier `admin` 100 turns, `teacher` tier `guru` 30, every other role tier `pelajar` 10. When used >= limit: 429 body exactly `{"quota_exhausted": true}` and nothing is stored. `turns_remaining` = limit - (used + 1). ' +
      'Routing of the reply is deterministic string logic on the server (BR-M13-04), first match on the trimmed message, case-insensitive: starts with "Tolong mark karangan ini menggunakan rubric " = `mark_essay` (stores an essay marking); contains "rph" = RPH tool (stores an RPH when subject and level are found); contains "latihan" or "soalan" = practice reply; otherwise the general reply. ' +
      '`tool_hops` is 1 when the turn ran mark_essay, saved an RPH or returned practice questions, else 0. With the mock AI provider `tokens.in = 120 + ceil(codepoints(message) / 4)` and `tokens.out = ceil(codepoints(reply) / 4)`. ' +
      'AI: the reply, marks and RPH text come from the mock provider or, later, the BE-36 adapter (redaction, rate limit, cost log, budget); this route calls no AI vendor. ' +
      'PDPA: the user is often a minor. The message and reply are personal data: never logged, `Cache-Control: no-store`, sent to a provider only after redaction. The contract makes no statement that content is not used to train models (open question). ' +
      'The CSRF header is checked (403 CSRF_INVALID, standard envelope).',
    request: { headers: [csrf], body: body(CikguSendRequestSchema) },
    responses: {
      200: noStore(CikguSendResponseSchema, 'The reply. Raw snake_case body, no envelope.'),
      401: json(CikguChatEmptyBodySchema, 'Guest: body exactly `{}`.'),
      403: CSRF_INVALID,
      422: json(CikguChatEmptyBodySchema, 'Blank or non-string message: body exactly `{}`. Nothing stored.'),
      429: {
        description:
          'Either the daily quota is used up (body exactly `{"quota_exhausted": true}`, nothing stored), or [PROPOSED] RATE_LIMITED (D57a; raw body with a BM string `error`, `code` RATE_LIMITED and `retryAfter`, plus the Retry-After header). Tell them apart by the `quota_exhausted` key.',
        headers: RATE_LIMITED_RESPONSE.headers,
        content: {
          'application/json': { schema: z.union([CikguChatQuotaBodySchema, CikguChatErrorBodySchema]) },
        },
      },
      503: json(
        CikguChatErrorBodySchema,
        '[PROPOSED] AI_UNAVAILABLE: raw body `{error: "Cikgu Alesa tak boleh respon. Cuba lagi.", code: "AI_UNAVAILABLE"}`. Nothing is stored and no quota turn is consumed.',
      ),
    },
    'x-envelope': 'none',
  })

  // #2 RPH list -----------------------------------------------------------------------------------
  registerRoute(registry, {
    method: 'get',
    path: '/cikgu/rph',
    tags: TAGS,
    summary: 'My RPH list',
    description:
      'Teacher or admin. Only the caller\'s own RPHs, `lessonDate` descending then id descending, 20 per page. An admin sees only their own (normally empty) rows.',
    request: { query: pageQuery },
    responses: {
      200: json(listEnvelopeOf(CikguRphListItemSchema), 'One page of the caller\'s RPHs.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_TEACHER,
    },
  })

  // #3 RPH create ---------------------------------------------------------------------------------
  registerRoute(registry, {
    method: 'post',
    path: '/cikgu/rph',
    tags: TAGS,
    summary: 'Generate and save an RPH from the form',
    description:
      'Teacher or admin. Validates (BR-M13-12), generates the plan text with the AI provider (mock: the canned plan), stores the row with `status` generated, `source` form, `threadId` null, 201 `{data: Rph}`. ' +
      'Values are trimmed; lengths count Unicode code points; optional text fields that are blank become null; `lessonDate` empty or missing = today (Malaysia); `durationMinutes` missing = 60. ' +
      'Content for 60 minutes splits 6/15/15/15/9 (a = round(0.10 x total), e = round(0.15 x total), b = floor((total - a - e) / 3), d = total - a - e - 2b). ' +
      'The mock waits 1,500 ms; the API does not (open question). The CSRF header is checked.',
    request: { headers: [csrf], body: body(CikguRphCreateRequestSchema) },
    responses: {
      201: json(envelopeOf(CikguRphSchema), 'The saved RPH.'),
      401: UNAUTHORIZED,
      403: err('FORBIDDEN "This action is unauthorized." (any role other than teacher or admin), or CSRF_INVALID.'),
      422: err(
        'VALIDATION_ERROR with `fields`, collected for all fields and returned together, inserted in the order subjectName, level, tajuk, durationMinutes, lessonDate, pengajaranKeperluan, className, timeSlot, tema. ' +
          'Messages: required text = "Medan ini diperlukan."; level not in D1-D6/T1-T5 = "Medan ini tidak sah."; too long = "Medan ini tidak boleh melebihi {max} aksara." (subjectName 100, tajuk 200, pengajaranKeperluan 500, className/timeSlot/tema 100); durationMinutes = "Tempoh mesti antara 15 dan 240 minit."; lessonDate = "Tarikh tidak sah.". ' +
          'Top-level message = the first field message plus " (and N more error(s))" when several fields fail.',
      ),
      503: AI_UNAVAILABLE_ENVELOPE,
    },
  })

  // #4 RPH detail ---------------------------------------------------------------------------------
  registerRoute(registry, {
    method: 'get',
    path: '/cikgu/rph/{id}',
    tags: TAGS,
    summary: 'RPH detail',
    description: 'Teacher or admin. Own rows only; unknown, foreign or non-numeric id = 404 NOT_FOUND "Not Found." (no existence leak).',
    request: { params: idParam },
    responses: {
      200: json(envelopeOf(CikguRphSchema), 'The RPH.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_TEACHER,
      404: NOT_FOUND,
    },
  })

  // #5 essays list --------------------------------------------------------------------------------
  registerRoute(registry, {
    method: 'get',
    path: '/cikgu/essays',
    tags: TAGS,
    summary: 'My essay markings',
    description:
      'Teacher or admin. Own markings only, `createdAt` descending then id descending, 20 per page. Rows carry a student name typed by the teacher (PDPA): `Cache-Control: no-store`, never logged.',
    request: { query: pageQuery },
    responses: {
      200: noStore(listEnvelopeOf(CikguEssayListItemSchema), 'One page of the caller\'s markings.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_TEACHER,
    },
  })

  // #6 essay detail -------------------------------------------------------------------------------
  registerRoute(registry, {
    method: 'get',
    path: '/cikgu/essays/{id}',
    tags: TAGS,
    summary: 'Essay marking detail',
    description:
      'Teacher or admin. Own rows only; unknown, foreign or non-numeric id = 404 NOT_FOUND "Not Found.". Carries the essay text and student name (child data): `Cache-Control: no-store`, never logged.',
    request: { params: idParam },
    responses: {
      200: noStore(envelopeOf(CikguEssayMarkingSchema), 'The marking.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_TEACHER,
      404: NOT_FOUND,
    },
  })

  // #7 PBD queue ----------------------------------------------------------------------------------
  registerRoute(registry, {
    method: 'get',
    path: '/cikgu/pbd',
    tags: TAGS,
    summary: 'My pending PBD tags (approval queue)',
    description:
      'Teacher or admin. Own `pending` tags only, newest roll-up first, then student name A to Z (case and diacritic insensitive, Malay collation), then id; 20 per page. Student names: `Cache-Control: no-store`.',
    request: { query: pageQuery },
    responses: {
      200: noStore(listEnvelopeOf(CikguPbdQueueItemSchema), 'One page of the pending tags.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_TEACHER,
    },
  })

  // #8 rollup -------------------------------------------------------------------------------------
  registerRoute(registry, {
    method: 'post',
    path: '/cikgu/pbd/rollup',
    tags: TAGS,
    summary: 'Roll up practice answers of a class into PBD tags',
    description:
      'Teacher or admin. `classroomId` null, malformed, not the caller\'s class, or a class without a subject: 200 `{created: 0, updated: 0, skipped: 0}` and no change (never 422, never reveals a foreign class). ' +
      'Otherwise, for every active member with at least one answer in the class subject (rows with `is_test` excluded): skor = round(correct / answered x 1000) / 10; tp bands <20 1, <40 2, <60 3, <75 4, <90 5, else 6; sp = "5.1.1" for subject Kimia, "1.1.1" for Sejarah and every other subject (illustrative, open question). ' +
      'An existing `pending` tag for (teacher, class, student, sp) gets the new skor/tp and `createdAt` = now (`updated`); else if an approved tag exists it is left alone (`skipped`); else a new pending tag (`created`).',
    request: { headers: [csrf], body: body(CikguRollupRequestSchema) },
    responses: {
      200: json(envelopeOf(CikguRollupResultSchema), 'Counts of the run.'),
      401: UNAUTHORIZED,
      403: err('FORBIDDEN "This action is unauthorized." (any role other than teacher or admin), or CSRF_INVALID.'),
    },
  })

  // #9 bulk approve -------------------------------------------------------------------------------
  registerRoute(registry, {
    method: 'post',
    path: '/cikgu/pbd/bulk-approve',
    tags: TAGS,
    summary: 'Approve PBD tags in bulk',
    description:
      'Teacher or admin. Only the caller\'s `pending` tags among `ids` become `approved` with `approvedAt` = now; foreign, unknown or non-pending ids are ignored silently; duplicates count once; non-array or empty `ids` = `{approved: 0}` (never 422). `approved` = how many changed.',
    request: { headers: [csrf], body: body(CikguBulkApproveRequestSchema) },
    responses: {
      200: json(envelopeOf(CikguBulkApproveResultSchema), 'Number of tags approved.'),
      401: UNAUTHORIZED,
      403: err('FORBIDDEN "This action is unauthorized." (any role other than teacher or admin), or CSRF_INVALID.'),
    },
  })

  // #10 CSV export --------------------------------------------------------------------------------
  registerRoute(
    registry,
    {
      method: 'get',
      path: '/cikgu/pbd/export.csv',
      tags: TAGS,
      summary: 'Export approved PBD tags as CSV (raw file)',
      description:
        `Teacher or admin. A file, not JSON: UTF-8 \`text/csv; charset=utf-8\`, attachment \`${CIKGU_PBD_CSV_FILENAME}\`, \`Cache-Control: no-store\`. ` +
        `First line \`${CIKGU_PBD_CSV_HEADER}\`; one line per approved tag of the caller ordered by approval time (else roll-up time), student name, id; \`skor\` with one decimal, \`tarikh_lulus\` = YYYY-MM-DD (Malaysia date of approval). ` +
        'A cell starting with `=`, `+`, `@` or `-` gets a leading `\'`; a cell containing `"`, `,`, CR or LF is double-quoted with inner quotes doubled; lines end with `\\n`, including the last; no approved tag = the header line only. ' +
        'Bulk child data: rate limited (D57, [PROPOSED] on a read).',
      responses: {
        200: {
          description: 'The CSV file.',
          headers: {
            'Content-Disposition': {
              description: `attachment; filename="${CIKGU_PBD_CSV_FILENAME}"`,
              schema: { type: 'string' as const },
            },
            ...NO_STORE_HEADERS,
          },
          content: { 'text/csv': { schema: z.string() } },
        },
        401: UNAUTHORIZED,
        403: FORBIDDEN_TEACHER,
      },
      'x-envelope': 'none',
    },
    true,
  )
}
