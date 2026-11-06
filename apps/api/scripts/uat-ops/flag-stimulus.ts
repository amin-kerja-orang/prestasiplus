/**
 * U-OP-05 / DM-05 (card S1-T07): one-off backfill of the stimulus flag (`stimulus_flag`, `stimulus_flag_ref`, `stimulus_flag_at`) for the questions that
 * were written before the detectors ran on every version write. Same detector as the write path (`detectStimulusFlag`, effective-leaf.ts); nothing here
 * decides a flag on its own.
 *
 *   DATABASE_URL=... npx tsx apps/api/scripts/uat-ops/flag-stimulus.ts              # dry run (default): counts only, writes nothing
 *   DATABASE_URL=... npx tsx apps/api/scripts/uat-ops/flag-stimulus.ts --apply      # the real run, after the admin approved the dry-run report
 *   Options: --batch=5000 (versions per batch)
 *
 * Scope: APPROVED LIVE versions only (`q.live_version_no = v.version_no AND v.status = 'approved'`). Idempotent: a version whose stored flag already equals
 * the detector's verdict is not touched (so a "Bukan masalah" dismissal survives a re-run); a second run reports 0 changes. The connection comes from the
 * environment, never from this file. It prints the counts per subject and Tingkatan, and per flag. The designated UAT developer runs the dry run, the report
 * goes to the admin, and only then the real run. Do not run it against a server without that approval.
 */
import { createPrismaClient } from '../../src/db/client'
import { detectStimulusFlag, FLAG_INCLUDE, flagInputOfRow, flagWrite, type StimulusFlag } from '../../src/modules/questions/effective-leaf'

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const apply = process.argv.includes('--apply')
const batchSize = Math.max(1, Math.min(5000, Number(arg('batch') ?? '5000') || 5000))

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const db = createPrismaClient(url)
  const now = new Date()
  const cell = new Map<string, { subject: string; level: string; flags: Record<StimulusFlag, number> }>()
  const totals: Record<StimulusFlag, number> = { stimulus_missing: 0, figure_only: 0, stem_duplicated: 0 }
  let seen = 0
  let changed = 0
  let cleared = 0
  let after = 0n
  try {
    for (;;) {
      const ids = await db.$queryRaw<{ id: bigint }[]>`
        SELECT v.id FROM question_versions v JOIN questions q ON q.id = v.question_id AND q.live_version_no = v.version_no
         WHERE v.status = 'approved' AND v.id > ${after} ORDER BY v.id LIMIT ${batchSize}`
      if (ids.length === 0) break
      after = ids[ids.length - 1]!.id
      const versions = await db.questionVersion.findMany({
        where: { id: { in: ids.map((r) => r.id) } },
        include: FLAG_INCLUDE,
        orderBy: { id: 'asc' },
      })
      const writes: (() => Promise<unknown>)[] = []
      for (const v of versions) {
        seen += 1
        const found = detectStimulusFlag(flagInputOfRow(v))
        const flag = found?.flag ?? null
        const ref = found?.ref ?? null
        if (flag !== null) {
          totals[flag] += 1
          const key = `${v.subjectId ?? 'none'}:${v.educationLevelId ?? 'none'}`
          const c = cell.get(key) ?? { subject: String(v.subjectId ?? 'none'), level: String(v.educationLevelId ?? 'none'), flags: { stimulus_missing: 0, figure_only: 0, stem_duplicated: 0 } }
          c.flags[flag] += 1
          cell.set(key, c)
        }
        if (flag === v.stimulusFlag && ref === v.stimulusFlagRef) continue
        changed += 1
        if (flag === null) cleared += 1
        if (apply) {
          // Same flag, only the reference kind moved: keep the dismissal (as the write path does).
          const data = flag !== null && flag === v.stimulusFlag ? { stimulusFlagRef: ref } : flagWrite(flag, ref, now)
          writes.push(() => db.questionVersion.update({ where: { id: v.id }, data }))
        }
      }
      // At most 50 updates in flight, so a 5,000-row batch cannot exhaust the connection pool.
      for (let i = 0; i < writes.length; i += 50) await Promise.all(writes.slice(i, i + 50).map((w) => w()))
      process.stderr.write(`batch up to version ${after}: ${seen} read, ${changed} to change\n`)
    }
    const subjects = new Map((await db.$queryRaw<{ id: bigint; name: string }[]>`SELECT id, code AS name FROM subjects`).map((s) => [String(s.id), s.name]))
    const levels = new Map((await db.$queryRaw<{ id: bigint; code: string }[]>`SELECT id, code FROM education_levels`).map((l) => [String(l.id), l.code]))
    console.log(`${apply ? 'APPLIED' : 'DRY RUN (nothing written)'}: ${seen} approved live versions read`)
    console.log(`flags found: stimulus_missing=${totals.stimulus_missing} figure_only=${totals.figure_only} stem_duplicated=${totals.stem_duplicated}`)
    console.log(`versions ${apply ? 'changed' : 'that would change'}: ${changed} (of which flag cleared: ${cleared})`)
    console.log('per subject and Tingkatan (stimulus_missing / figure_only / stem_duplicated):')
    for (const c of [...cell.values()].sort((a, b) => a.subject.localeCompare(b.subject, undefined, { numeric: true }) || a.level.localeCompare(b.level, undefined, { numeric: true }))) {
      console.log(`  ${subjects.get(c.subject) ?? c.subject} | ${levels.get(c.level) ?? c.level}: ${c.flags.stimulus_missing} / ${c.flags.figure_only} / ${c.flags.stem_duplicated}`)
    }
  } finally {
    await db.$disconnect()
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
})
