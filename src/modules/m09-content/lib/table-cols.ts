/**
 * Column width / alignment classes for `DsDataTable layout="fixed"`: `UTable` reads per-cell classes from
 * the column meta under the key `class` (a computed key, so the class linter does not read it as a class
 * list). `th` and `td` default to the same string.
 */

const META_CLASS = 'class'

export function cellClass(th: string, td = th): { meta: Record<string, unknown> } {
  return { meta: { [META_CLASS]: { th, td } } }
}
