/**
 * Postgres cannot store a NUL character (U+0000) in text or jsonb: the driver raises and the request would be
 * a 500. Modules of BE-24 refuse it at the boundary with a 422 on the field. A global guard in
 * `common/validation` is BE-33 (deviation row of 2026-10-20).
 */
export const hasNul = (value: unknown): boolean => typeof value === 'string' && value.includes('\u0000')

/** The same text without NUL characters (for search terms, where refusing would only be noise). */
export const withoutNul = (value: string): string => value.replaceAll('\u0000', '')
