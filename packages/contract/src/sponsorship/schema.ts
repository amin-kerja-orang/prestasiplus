import { z } from '../zod'
import { IdSchema } from '../common/ids'

/**
 * M21 Sponsorship, student side only (BE-47, contract-only; D48 Penaja out, D53(a)).
 *
 * The only M21 route in the mock is `POST /api/mohon-keluarga-angkat` (`m21-sponsorship/mock/handlers/
 * foster-application.ts`, wire types in `.../api/types.ts`). The sponsor (Penaja) role, anak-angkat
 * records and the admin review of applications are not part of this contract. No read endpoint exists:
 * the category, income and reason of a minor are write-only on the wire and are never echoed back.
 *
 * Ids are opaque strings (`Id`), not the mock integers.
 */

/** The five S6 category values (SRS 6.4). The wire values are the screen's option values, kept verbatim. */
export const KELUARGA_ANGKAT_CATEGORIES = ['B40', 'Asnaf', 'Yatim', 'OKU', 'Lain-lain'] as const
export const KeluargaAngkatCategorySchema = z
  .enum(KELUARGA_ANGKAT_CATEGORIES)
  .meta({ id: 'KeluargaAngkatCategory' })
export type KeluargaAngkatCategory = z.infer<typeof KeluargaAngkatCategorySchema>

/** The four S6 income values (SRS 6.4), kept verbatim (note the spaces around the dash). */
export const KELUARGA_ANGKAT_INCOME_RANGES = [
  '< RM1,000',
  'RM1,000 - RM2,500',
  'RM2,500 - RM4,000',
  '> RM4,000',
] as const
export const KeluargaAngkatIncomeRangeSchema = z
  .enum(KELUARGA_ANGKAT_INCOME_RANGES)
  .meta({ id: 'KeluargaAngkatIncomeRange' })
export type KeluargaAngkatIncomeRange = z.infer<typeof KeluargaAngkatIncomeRangeSchema>

/** Statuses of a stored application. Only `pending` is ever written in B1 (no review route exists). */
export const KELUARGA_ANGKAT_STATUSES = ['pending', 'approved', 'matched', 'rejected'] as const

/** The stored reason is cut to this many characters, not rejected (SEC-M21-07, mock `REASON_MAX`). */
export const KELUARGA_ANGKAT_REASON_MAX = 5000

/** Exact BM copy of #15 (SRS 5 V-M21-03, 8.2; mock `FOSTER_APPLICATION_MESSAGES`). */
export const KELUARGA_ANGKAT_MESSAGES = {
  required: 'Sila isi ruangan ini.',
  invalidEmail: 'Format e-mel tidak sah.',
  invalidChoice: 'Pilihan tidak sah.',
  studentNotFound: 'Email pelajar tidak dijumpai dalam PrestasiPlus.',
} as const

/** Shown by the client after a 201 (SRS 8.2). Not returned by the API. */
export const KELUARGA_ANGKAT_SUCCESS_TEXT =
  'Permohonan anda telah dihantar. Admin akan menyemak permohonan dalam 1-3 hari bekerja.'

/** Shown by the client for any non-field failure (network, 401, 5xx). Client-side copy, not an API message. */
export const KELUARGA_ANGKAT_GENERIC_ERROR = 'Ralat berlaku. Sila cuba lagi.'

/** The 422 `fields` keys, in the order the server inserts them (the order of the top-level message). */
export const KELUARGA_ANGKAT_FIELD_ORDER = [
  'studentEmail',
  'studentCategory',
  'familyIncomeRange',
  'reason',
] as const
export type KeluargaAngkatField = (typeof KELUARGA_ANGKAT_FIELD_ORDER)[number]

/** Same shape check as the mock handler. */
export const KELUARGA_ANGKAT_EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const { required, invalidEmail, invalidChoice } = KELUARGA_ANGKAT_MESSAGES

/** Missing, non-string or empty means "required"; any other value outside the list means "invalid choice". */
const choiceError = (iss: { input?: unknown }): string =>
  typeof iss.input !== 'string' || iss.input === '' ? required : invalidChoice

/**
 * Body of `POST /mohon-keluarga-angkat`. Unknown keys are stripped: `applicantUserId`, `applicantRole`
 * and the like in a body are ignored (the applicant is always the session user and role).
 *
 * `studentEmail` is trimmed; the further check (an existing user with role `student`, answer
 * `studentNotFound`) needs the database and is not part of this schema. A teacher, a parent and an
 * unknown e-mail all give the same message.
 *
 * `familyIncomeRange`: missing, null, `""` or any non-string value means "not given" (stored null, no
 * error); only a non-empty string outside the four values is `invalidChoice`.
 *
 * `reason`: blank after trim or not a string is `required`. The stored text is the value as typed (NOT
 * trimmed), cut to `KELUARGA_ANGKAT_REASON_MAX` characters; longer input is accepted, not rejected.
 */
export const FosterApplicationInputSchema = z
  .object({
    studentEmail: z
      .string({ error: required })
      .trim()
      .min(1, { error: required })
      .refine((v) => v === '' || KELUARGA_ANGKAT_EMAIL_SHAPE.test(v), { error: invalidEmail }),
    studentCategory: z.enum(KELUARGA_ANGKAT_CATEGORIES, { error: choiceError }),
    familyIncomeRange: z
      .preprocess(
        (v) => (typeof v === 'string' && v !== '' ? v : null),
        z.enum(KELUARGA_ANGKAT_INCOME_RANGES, { error: invalidChoice }).nullable(),
      )
      .optional()
      .meta({
        description:
          'One of the four ranges, or "" / null / missing for "not given" (stored null). A non-string value is also treated as not given.',
      }),
    reason: z
      .string({ error: required })
      .refine((v) => v.trim() !== '', { error: required })
      .meta({
        description: `Required, non-blank after trim. Stored as typed (not trimmed), cut to ${String(KELUARGA_ANGKAT_REASON_MAX)} characters (longer input is accepted, not rejected).`,
      }),
  })
  .meta({ id: 'KeluargaAngkatApplicationInput' })
export type FosterApplicationInput = z.input<typeof FosterApplicationInputSchema>

/** `data` of the 201: only the new id. Nothing the applicant typed is echoed back. */
export const FosterApplicationCreatedSchema = z
  .strictObject({ id: IdSchema })
  .meta({ id: 'KeluargaAngkatApplicationCreated' })
export type FosterApplicationCreated = z.infer<typeof FosterApplicationCreatedSchema>

/** What is stored for the reason: as typed, first 5,000 characters. */
export function storedFosterReason(reason: string): string {
  return reason.slice(0, KELUARGA_ANGKAT_REASON_MAX)
}

/** Top-level 422 message: the first field message plus ` (and N more error(s))` (Laravel summarize). */
export function summarizeFosterFieldErrors(fields: Partial<Record<KeluargaAngkatField, string>>): string {
  const messages = KELUARGA_ANGKAT_FIELD_ORDER.flatMap((k) => (fields[k] === undefined ? [] : [fields[k]]))
  const [first] = messages
  if (first === undefined) return ''
  const more = messages.length - 1
  return more === 0 ? first : `${first} (and ${String(more)} more error${more === 1 ? '' : 's'})`
}
