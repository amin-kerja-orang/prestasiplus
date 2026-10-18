/**
 * One-release prop aliases (v2-ds-hardening R3, D-H11): a component accepts the old prop, warns once
 * in development and the codemod rewrites the call sites. Removed at T-Z.
 */
const seen = new Set<string>()

export function warnDeprecated(component: string, oldProp: string, newProp: string): void {
  if (!import.meta.env.DEV || import.meta.env.MODE === 'test') return
  const key = `${component}.${oldProp}`
  if (seen.has(key)) return
  seen.add(key)
  console.warn(`[ds] ${component}: "${oldProp}" is deprecated, use "${newProp}".`)
}
