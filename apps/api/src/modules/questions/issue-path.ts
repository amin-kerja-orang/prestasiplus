/**
 * Reading zod union errors for the part tree (shared by the request parser and the service): a failed `z.union` reports only
 * "Invalid input" at the union, so this walks into the branches and keeps the issue that got furthest into the value.
 */
export interface FlatIssue {
  path: PropertyKey[]
  message: string
}
export interface UnionLike {
  code: string
  path: readonly PropertyKey[]
  message: string
  errors?: readonly (readonly UnionLike[])[]
}

/** A branch that says "the `kind` is not mine" (its own `kind` literal failed) is a candidate for the other key kind: it never explains the failure. */
const isOtherKind = (branch: readonly UnionLike[]): boolean => branch.some((i) => i.code === 'invalid_value' && i.path.length === 1 && i.path[0] === 'kind')

/**
 * The issue that got furthest into the value (longest path; the first branch wins a tie, so the v2 key schema, tried first, names its own
 * field). Branches that only reject the `kind` are skipped, so a malformed scheme v2 `rubric` key does not report "expected points".
 */
export function deepestIssue(issue: UnionLike, prefix: readonly PropertyKey[]): FlatIssue {
  const path = [...prefix, ...issue.path]
  if (issue.code === 'invalid_union' && issue.errors && issue.errors.length > 0) {
    const relevant = issue.errors.filter((b) => !isOtherKind(b))
    let best: FlatIssue | undefined
    for (const branch of relevant.length > 0 ? relevant : issue.errors) {
      for (const inner of branch) {
        const flat = deepestIssue(inner, path)
        if (!best || flat.path.length > best.path.length) best = flat
      }
    }
    if (best) return best
  }
  return { path, message: issue.message }
}
