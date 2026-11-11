/**
 * An EMPTY prompt is accepted, not refused: one the stored part already has is carried over (K10, the migrated V2 bank), and a new part may
 * leave it empty too (V2 `parts.*.prompt_text` is nullable; the pre-fix write contract answered a raw "Too small" 422 on an MCQ with no instruction).
 *
 * The write contract demands `prompt.ms` min 1 on every part an update sends that differs from the stored one. A question that V2 gave
 * only a stem (an MCQ has no separate instruction) is stored with the text once, in the stem, and an EMPTY leaf prompt (the loader and the
 * `trim-duplicate-stem` step leave it so: S4-T04). Tagging it in the Studio (the aras of the leaf) or fixing one option changes the part,
 * so the strict rule would answer 422 `parts.0.prompt.ms` for a question the admin never wrote an instruction for, and every one of
 * the migrated questions would first need a typed instruction. So a part that has an empty prompt in the stored version at the same place
 * (same position, same label) may keep it empty; a NEW part, a part with another label and every part whose stored prompt is not empty
 * stay under the strict rule (a typed instruction can be cleared only by a question that never had one).
 */
interface PartLike {
  label: string
  prompt?: { ms: string; en?: string | undefined } | undefined
  children?: readonly PartLike[] | undefined
}

const emptyPrompt = (p: PartLike | undefined): boolean => p?.prompt !== undefined && p.prompt.ms === ''

/**
 * The incoming tree with each carried empty prompt replaced by a placeholder (so the strict schema checks everything else), and the
 * function that puts the empty prompts back into the parsed tree (same shape, same order).
 */
export function maskCarriedPrompts<T extends PartLike>(
  incoming: readonly T[],
  stored: readonly PartLike[] | undefined,
): { masked: T[]; restore: <R extends PartLike>(parsed: readonly R[]) => R[] } {
  const carried = new Set<string>()
  const walk = (list: readonly T[], before: readonly PartLike[] | undefined, path: string): T[] =>
    list.map((p, i) => {
      const old = before?.[i]
      const here = `${path}/${String(i)}`
      // V2 stores the instruction of a sub-bahagian as nullable (StoreStudioQuestionRequest: parts.*.prompt_text): an empty one is valid for
      // a new part too, not only a carried one. The stem (or another part) holds the text; the submit gate still needs some text somewhere.
      const keep = emptyPrompt(p)
      if (keep) carried.add(here)
      const children = Array.isArray(p.children) ? walk(p.children as readonly T[], old?.children, here) : undefined
      return { ...p, ...(keep ? { prompt: { ...p.prompt, ms: '-' } } : {}), ...(children === undefined ? {} : { children }) }
    })
  const masked = walk(incoming, stored, '')
  const restore = <R extends PartLike>(parsed: readonly R[]): R[] => {
    const back = (list: readonly R[], path: string): R[] =>
      list.map((p, i) => {
        const here = `${path}/${String(i)}`
        const children = Array.isArray(p.children) ? back(p.children as readonly R[], here) : undefined
        return { ...p, ...(carried.has(here) ? { prompt: { ...p.prompt, ms: '' } } : {}), ...(children === undefined ? {} : { children }) }
      })
    return back(parsed, '')
  }
  return { masked, restore }
}
