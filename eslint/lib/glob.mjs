// Tiny glob matcher for the Portal Pentadbiran lint tooling (no dependency). Supports `**`, `*`, `?`
// and `{a,b}`; paths use forward slashes and are relative to the repo root.

/** Converts a glob to a RegExp (anchored). `dir/**` matches everything below `dir`. */
export function globToRegExp(glob) {
  let re = ''
  let i = 0
  let braces = 0
  while (i < glob.length) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // `**/` = any number of directories (including none); trailing `**` = anything
        if (glob[i + 2] === '/') {
          re += '(?:.*/)?'
          i += 3
        } else {
          re += '.*'
          i += 2
        }
      } else {
        re += '[^/]*'
        i++
      }
    } else if (c === '?') {
      re += '[^/]'
      i++
    } else if (c === '{') {
      braces++
      re += '(?:'
      i++
    } else if (c === '}' && braces > 0) {
      braces--
      re += ')'
      i++
    } else if (c === ',' && braces > 0) {
      re += '|'
      i++
    } else {
      re += c.replace(/[.+^$()|[\]\\]/g, (m) => `\\${m}`)
      i++
    }
  }
  return new RegExp(`^${re}$`)
}

/** Returns a predicate `(relPath) => boolean` for a list of globs. */
export function matcher(globs) {
  const res = globs.map(globToRegExp)
  return (p) => res.some((r) => r.test(p))
}
