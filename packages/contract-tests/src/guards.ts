/**
 * AC5 (plan 14.2): `legacy_*` columns are never exposed. Returns the JSON path of every key that
 * starts with `legacy_`, at any depth (objects inside arrays included).
 */
export function findLegacyKeys(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => findLegacyKeys(v, `${path}[${i}]`))
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => [
      ...(k.startsWith('legacy_') ? [`${path}.${k}`] : []),
      ...findLegacyKeys(v, `${path}.${k}`),
    ])
  }
  return []
}
