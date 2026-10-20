/**
 * The key and tag rules are BE-09's (`publish-gate.ts`); this thin file re-exports them so the gates
 * of the workflow and the publish path of the question bank can never disagree. Only the small leaf
 * walker below is local, because BE-09 does not export `leavesOf`.
 */
import type { QuestionPart } from '@pp/contract'

export { checkKeysGate, checkTagGate, PUBLISH_TAG_MESSAGES } from '../../index'

type PartLeaf = Extract<QuestionPart, { mode: string }>

export const isLeaf = (part: QuestionPart): part is PartLeaf => 'mode' in part

/** Leaves in reading order with their path (labels joined with `.`). */
export function leavesOf(parts: readonly QuestionPart[], prefix: readonly string[] = []): { path: string; leaf: PartLeaf }[] {
  const out: { path: string; leaf: PartLeaf }[] = []
  for (const part of parts) {
    const path = [...prefix, part.label]
    if (isLeaf(part)) out.push({ path: path.join('.'), leaf: part })
    else out.push(...leavesOf((part as { children: QuestionPart[] }).children, path))
  }
  return out
}
