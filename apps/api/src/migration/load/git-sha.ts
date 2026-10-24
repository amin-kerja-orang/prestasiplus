/**
 * The git commit that produced a migration run, for `etl_runs.git_sha`. Best effort: it never fails a run.
 * Order: `PP_GIT_SHA`, `GIT_SHA`, then `git rev-parse HEAD` in the current directory. A value that is not a
 * 7 to 64 character hex string is ignored, so nothing but a commit id can reach the ledger.
 */
import { execFileSync } from 'node:child_process'

const SHA = /^[0-9a-f]{7,64}$/i

export type GitRunner = () => string

const gitHead: GitRunner = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 })

export function resolveGitSha(env: Readonly<Record<string, string | undefined>>, git: GitRunner = gitHead): string | null {
  for (const candidate of [env.PP_GIT_SHA, env.GIT_SHA]) {
    const v = candidate?.trim()
    if (v && SHA.test(v)) return v.toLowerCase()
  }
  try {
    const v = git().trim()
    return SHA.test(v) ? v.toLowerCase() : null
  } catch {
    return null
  }
}
