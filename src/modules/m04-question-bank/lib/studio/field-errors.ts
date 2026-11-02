/**
 * Studio field-error keys (REQ-A-036). The Semakan gate reports the Bab problem as `fields.chapterId`, while the request body
 * (and the Bab field on the page) is `curriculumChapterId`. Map the gate key to the body key so the message shows under Bab.
 */
const KEY_ALIASES: Readonly<Record<string, string>> = { chapterId: 'curriculumChapterId' }

export function studioFieldErrors(fields: Readonly<Record<string, string>> | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, message] of Object.entries(fields ?? {})) {
    const to = KEY_ALIASES[key] ?? key
    // an explicit body key wins over an alias
    if (to === key || out[to] === undefined) out[to] = message
  }
  return out
}
