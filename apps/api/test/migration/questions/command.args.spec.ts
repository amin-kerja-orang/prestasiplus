/**
 * The argv shape `deploy/vps/migration/slot.sh etl` produces for `migrate:questions` (QLOAD): it appends
 * `--out-dir /app/apps/api/.migration-out` to every command, so the command must accept it.
 */
import { describe, expect, it } from 'vitest'

import { parseArgs } from '../../../src/migration/cli'
import { ApplyGuardError } from '../../../src/migration/kit/apply-guard'
import { parseQuestionsArgs } from '../../../src/migration/load/questions/command'
import { chapterCoverageWarning } from '../../../src/migration/load/questions'

const SLOT_OUT = '/app/apps/api/.migration-out'
const parse = (argv: string[]) => {
  const prepared: string[] = []
  const out = parseQuestionsArgs(parseArgs(['migrate:questions', ...argv]).args, (d) => (prepared.push(d), d))
  return { out, prepared, mode: parseArgs(['migrate:questions', ...argv]).args.mode }
}

describe('migrate:questions argv as slot.sh passes it', () => {
  it.each([
    ['dry-run, as-of with =', ['--as-of=2026-10-29', '--out-dir', SLOT_OUT], 'dry-run'],
    ['dry-run, as-of with a space', ['--as-of', '2026-10-29', '--out-dir', SLOT_OUT], 'dry-run'],
    ['apply, as-of with =', ['--apply', '--as-of=2026-10-29', '--out-dir', SLOT_OUT], 'apply'],
    ['apply, as-of with a space', ['--apply', '--as-of', '2026-10-29', '--out-dir', SLOT_OUT], 'apply'],
    ['out-dir with =', ['--as-of=2026-10-29', `--out-dir=${SLOT_OUT}`], 'dry-run'],
  ])('%s is accepted', (_label, argv, mode) => {
    const r = parse(argv)
    expect(r.mode).toBe(mode)
    expect(r.out.asOf).toBe('2026-10-29')
    expect(r.out.outDir).toBe(SLOT_OUT)
    expect(r.prepared).toEqual([SLOT_OUT])
  })

  it('still refuses an unknown flag, a positional argument and a missing out-dir value', () => {
    expect(() => parse(['--nope=1'])).toThrow(ApplyGuardError)
    expect(() => parseQuestionsArgs({ mode: 'dry-run', flags: new Map(), positional: ['x'] }, (d) => d)).toThrow(/flags only/)
    expect(() => parseQuestionsArgs({ mode: 'dry-run', flags: new Map([['out-dir', true]]) as never, positional: [] }, (d) => d)).toThrow(/--out-dir needs a value/)
  })

  it('refuses an out-dir outside a .migration-out folder (the real check)', () => {
    expect(() => parseQuestionsArgs(parseArgs(['migrate:questions', '--out-dir', '/tmp/elsewhere']).args)).toThrow(/--out-dir: .*\.migration-out/)
  })
})

describe('chapterCoverageWarning (counts only, never a failure)', () => {
  const recon = (loaded: number) => ({ recon: [{ entity: 'questions', sourceCount: 9, eligibleCount: 9, loaded, rejected: 0, expectedDelta: 0, status: 'ok' }] }) as unknown as Parameters<typeof chapterCoverageWarning>[0]
  it('is null when every new question has a chapter, or nothing new was loaded (no-op re-run)', () => {
    expect(chapterCoverageWarning(recon(5), new Map([['questions.chapter_from_topic', 2]]))).toBeNull()
    expect(chapterCoverageWarning(recon(5), new Map([['questions.excluded.status.draf', 1]]))).toBeNull()
  })
  it('names missing and unmapped separately and what the learner loses', () => {
    const w = chapterCoverageWarning(recon(5), new Map([['questions.chapter_missing', 3], ['questions.chapter_unmapped', 1]]))
    expect(w).toMatch(/^4 of 5 new question\(s\) have no chapter \(chapter_missing 3: .*chapter_unmapped 1: /)
    expect(w).toContain('chapter-mode practice')
    expect(w).toContain('the input carries no column chapter_id')
  })
})
