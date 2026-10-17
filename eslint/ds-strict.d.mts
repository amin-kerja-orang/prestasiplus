export type DsLevel = 'page' | 'ds'
export interface DsStrictEntry {
  glob: string
  level: DsLevel
}
export interface DsStrict {
  strict: DsStrictEntry[]
  exempt: string[]
}
export function normalizeDsStrict(raw: unknown): DsStrict
export function readDsStrict(file?: string): DsStrict
export function globsOf(strict: DsStrictEntry[], level: DsLevel): string[]
export function styleGlobs(globs: string[]): string[]
export function ratchetViolations(current: DsStrict, floor: DsStrict): string[]
