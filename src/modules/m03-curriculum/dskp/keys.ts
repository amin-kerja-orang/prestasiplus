import type {
  DskpGroupId,
  DskpKeyKind,
  DskpSkId,
  DskpSpId,
  DskpTingkatan,
  DskpUnitId,
} from './types.ts'

/**
 * Opaque composite keys (design A5): `SUBJECT:T4|T5:g|u|sk|sp:<printed code>`.
 *
 * Keys are never stored in the data files; the indexer builds them. The SK of an SP is taken from
 * the SP's parent node, never parsed from the SP code (Landskap prints SP 1.4.x under SK 1.3).
 */

const KINDS: readonly string[] = ['g', 'u', 'sk', 'sp']
const TINGKATAN: readonly string[] = ['T4', 'T5']

export function dskpKey(
  subject: string,
  tingkatan: DskpTingkatan,
  kind: 'g',
  code: string,
): DskpGroupId
export function dskpKey(
  subject: string,
  tingkatan: DskpTingkatan,
  kind: 'u',
  code: string,
): DskpUnitId
export function dskpKey(
  subject: string,
  tingkatan: DskpTingkatan,
  kind: 'sk',
  code: string,
): DskpSkId
export function dskpKey(
  subject: string,
  tingkatan: DskpTingkatan,
  kind: 'sp',
  code: string,
): DskpSpId
export function dskpKey(
  subject: string,
  tingkatan: DskpTingkatan,
  kind: DskpKeyKind,
  code: string,
): string
export function dskpKey(
  subject: string,
  tingkatan: DskpTingkatan,
  kind: DskpKeyKind,
  code: string,
): string {
  if (subject.includes(':') || code.includes(':')) {
    throw new Error(`DSKP key part contains ":" (${subject} ${tingkatan} ${kind} ${code})`)
  }
  return `${subject}:${tingkatan}:${kind}:${code}`
}

export interface ParsedDskpKey {
  subject: string
  tingkatan: DskpTingkatan
  kind: DskpKeyKind
  code: string
}

/** Splits a key into its parts; null when it is not a well-formed DSKP key. */
export function parseDskpKey(key: string): ParsedDskpKey | null {
  const parts = key.split(':')
  if (parts.length !== 4) return null
  const [subject, tingkatan, kind, code] = parts as [string, string, string, string]
  if (subject === '' || code === '') return null
  if (!TINGKATAN.includes(tingkatan) || !KINDS.includes(kind)) return null
  return { subject, tingkatan: tingkatan as DskpTingkatan, kind: kind as DskpKeyKind, code }
}

/** Code of a group node: a slug of its title (the DSKP prints no code for a group). */
export function groupCode(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}
