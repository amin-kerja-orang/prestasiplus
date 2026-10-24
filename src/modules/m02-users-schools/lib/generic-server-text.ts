/**
 * The API's generic English defaults (`apps/api/src/common/errors/api-error.ts`): sent when a
 * failure has no module message of its own. They must never reach the BM UI (SWE).
 */
const GENERIC_SERVER_TEXTS: readonly string[] = [
  'server error',
  'not found',
  'this action is unauthorized',
  'unauthenticated',
  'conflict',
  'the given data was invalid',
  'payload too large',
]

/** True for an empty message, a transport `HTTP <status>` text or one of the API's generic English defaults. */
export function isGenericServerText(message: string): boolean {
  const text = message.trim().replace(/\.$/, '').toLowerCase()
  return text === '' || /^http \d+$/.test(text) || GENERIC_SERVER_TEXTS.includes(text)
}
