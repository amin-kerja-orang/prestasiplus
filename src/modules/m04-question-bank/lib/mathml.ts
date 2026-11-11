/**
 * A migrated V2 question keeps its maths as baked MathML (`<math xmlns=...><semantics>...<annotation encoding="application/x-tex">LaTeX</annotation></semantics></math>`).
 * Shown as text it is unreadable, so a screen that prints question text as text turns each `<math>` element back into its LaTeX source:
 * `$...$`, which `RichText` renders with KaTeX and an excerpt shows as readable text.
 */
const MATH_ELEMENT = /<math\b[\s\S]*?<\/math>/gi
const ANNOTATION = /<annotation\b[^>]*encoding="application\/x-tex"[^>]*>([\s\S]*?)<\/annotation>/i

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' }
const decode = (s: string): string => s.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITIES[m] ?? m)

/** Whether the text holds a MathML element. */
export const hasMathml = (text: string): boolean => /<math\b/i.test(text)

/** Replaces every MathML element by `$latex$` (its TeX annotation), or by its plain text when it has none. */
export function mathmlToLatex(text: string): string {
  if (!hasMathml(text)) return text
  return text.replace(MATH_ELEMENT, (el) => {
    const tex = ANNOTATION.exec(el)?.[1]
    if (tex !== undefined) return `$${decode(tex).trim()}$`
    const flat = decode(el.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
    return flat === '' ? '' : `$${flat}$`
  })
}
