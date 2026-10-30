export interface AdminStrict {
  scope: string[]
  exempt: string[]
  enforce: { glob: string; batch?: number }[]
  areas: { batch: number; name: string; globs: string[] }[]
}
export function readAdminStrict(file?: string): AdminStrict
export const ADMIN_RULES: Record<string, unknown>
export function adminRuleBlocks(files: string[], ignores?: string[]): unknown[]
export function adminStrictConfig(): unknown[]
