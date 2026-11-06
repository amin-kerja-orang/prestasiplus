/**
 * The `Tajuk set` rule (PRD30 13-01 / 13-04), the same one the server enforces on create, Jana set and
 * the paper PUT: required, at most `BIJAK_SET_TITLE_MAX` characters after trim. One place for the forms,
 * the page and the mock, with the contract's own messages.
 */
import { BIJAK_BUILDER_MESSAGES, BIJAK_SET_BUILDER_PROPOSED, BIJAK_SET_TITLE_MAX } from '@pp/contract'

export { BIJAK_SET_TITLE_MAX }

/** The field error of a set title as typed, or `undefined` when it is acceptable. */
export function setTitleError(raw: string | undefined): string | undefined {
  const title = (raw ?? '').trim()
  if (!title) return BIJAK_BUILDER_MESSAGES.setTitleRequired
  if (title.length > BIJAK_SET_TITLE_MAX) return BIJAK_SET_BUILDER_PROPOSED.setTitleTooLong
  return undefined
}
