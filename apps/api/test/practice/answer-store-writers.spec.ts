import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * S5-T15 (AC-PA-01): no code writes `practice_answers` except through `AnswerLogPort` (answer-log.port.ts). Scanned:
 * `apps/api/src/**` (not the generated client) and `apps/api/prisma/seed/**`. The allow-list is EMPTY (part 3 of S5-T15,
 * migration 0188 validated the mode check and set NOT NULL); the only exemption is the legacy ETL loader (see EXEMPT).
 * A new writer fails the test, and so does an exemption entry that no longer matches anything.
 */
const API = resolve(__dirname, '../..')
const ROOTS = [join(API, 'src'), join(API, 'prisma/seed')]
const PORT = 'src/modules/practice/answer-log.port.ts'

/** file (relative to apps/api) -> number of direct write sites it may still have. EMPTY since S5-T15 part 3 (migration 0188). */
const ALLOW_LIST: Readonly<Record<string, number>> = {}

/**
 * Permanent, explicit exemption (not part of the allow-list): the ETL bulk loader is a migration tool that upserts
 * historical rows keyed by legacy id in batches, not a pupil activity. It sets `mode` from the imported session.
 * NOT A TEMPLATE: this map is pinned to exactly this one file by a test; a pupil activity never goes here (AC-PA-01),
 * and any new entry needs a lead/architect decision recorded on DM-44 first.
 */
const EXEMPT: Readonly<Record<string, number>> = {
  // legacy ETL import, not a pupil activity (AC-PA-01 covers pupil activities)
  'src/migration/load/activity/practice-steps.ts': 1,
}

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return p.split('\\').join('/').endsWith('src/db/generated') ? [] : walk(p)
    return p.endsWith('.ts') ? [p] : []
  })

const PRISMA_WRITE = /practiceAnswer\s*\.\s*(?:create|createMany|createManyAndReturn|upsert)\b/g
const BRACKET_ACCESS = /\[\s*['"]practiceAnswer['"]\s*\]/g
/** The ETL loader's generic upsert helper called with the table name (`upsertAndMap(ctx, entity, 'practice_answers', ...)`). */
const LOADER_UPSERT = /upsertAndMap\s*\([^)]*['"]practice_answers['"]/g
const SQL_INSERT = /insert\s+into\s+(?:"?public"?\s*\.\s*)?"?practice_answers"?/gi
/**
 * A `$executeRaw` / `$queryRaw` (Unsafe) call that mentions `practice_answers` and inserts into a DYNAMIC target
 * (`insert into ${...}`); a literal target is caught by SQL_INSERT, and `insert into other_table ... from practice_answers` is a read.
 */
const RAW_CALL = /\$(?:execute|query)Raw(?:Unsafe)?\s*(?:<[^>]*>)?\s*\(?\s*(?:`[^`]*`|'[^']*'|"[^"]*")/g

/** Number of direct write sites in `src`, comments removed. */
export function writeSites(src: string): number {
  let code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  let n = 0
  code = code.replace(RAW_CALL, (m) => {
    if (/insert\s+into\s+\$\{/i.test(m) && /practice_answers/i.test(m)) {
      n++
      return ' '
    }
    return m
  })
  return n + (code.match(PRISMA_WRITE)?.length ?? 0) + (code.match(BRACKET_ACCESS)?.length ?? 0) + (code.match(SQL_INSERT)?.length ?? 0) + (code.match(LOADER_UPSERT)?.length ?? 0)
}

describe('no write to practice_answers outside the port', () => {
  const found = new Map<string, number>()
  const files = ROOTS.flatMap(walk)
  for (const file of files) {
    const rel = relative(API, file).split('\\').join('/')
    if (rel === PORT) continue
    const n = writeSites(readFileSync(file, 'utf8'))
    if (n > 0) found.set(rel, n)
  }

  it('finds the source and seed files, not the generated client', () => {
    expect(files.length).toBeGreaterThan(100)
    expect(files.some((f) => f.endsWith('prisma/seed/practice.ts'))).toBe(true)
    expect(files.some((f) => f.includes('src/db/generated'))).toBe(false)
  })

  it('every direct writer is on the allow-list or the exemption with its exact count', () => {
    const unexpected = [...found]
      .filter(([f, n]) => (ALLOW_LIST[f] ?? EXEMPT[f]) !== n)
      .map(([f, n]) => `${f}: ${String(n)} write site(s), allowed ${String(ALLOW_LIST[f] ?? EXEMPT[f] ?? 0)}`)
    expect(unexpected, 'route the write through AnswerLogPort.record').toEqual([])
  })

  it('the allow-list is empty', () => {
    expect(Object.keys(ALLOW_LIST)).toEqual([])
  })

  it('the exemption holds only the legacy ETL loader', () => {
    expect(EXEMPT).toEqual({ 'src/migration/load/activity/practice-steps.ts': 1 })
  })

  it('every allow-list or exemption entry still matches (remove entries as writers move to the port)', () => {
    const stale = Object.entries({ ...ALLOW_LIST, ...EXEMPT }).filter(([f, n]) => found.get(f) !== n).map(([f]) => f)
    expect(stale).toEqual([])
  })

  it('the port itself is the writer', () => {
    expect(readFileSync(join(API, PORT), 'utf8')).toMatch(/INSERT INTO practice_answers/)
  })
})

describe('the patterns catch a planted writer', () => {
  it.each([
    ['await this.db.practiceAnswer.createMany({ data })', 1],
    ['await tx.practiceAnswer.upsert({})', 1],
    ['await db.practiceAnswer.createManyAndReturn({ data })', 1],
    ["await db['practiceAnswer'].createMany({ data })", 1],
    ['await db.$queryRaw`\n  INSERT INTO public.practice_answers (a) VALUES (1) RETURNING id`', 1],
    ['await db.$executeRawUnsafe("insert into practice_answers (a) values (1)")', 1],
    ['await db.$executeRaw`WITH x AS (SELECT 1) INSERT INTO practice_answers SELECT * FROM x`', 1],
    ["await db.$executeRawUnsafe(`INSERT INTO ${table} SELECT * FROM practice_answers`)", 1],
    ["return upsertAndMap(ctx, entity, 'practice_answers', COLUMNS, items, { register: false })", 1],
    ['await db.$executeRaw`INSERT INTO revision_queue SELECT user_id FROM practice_answers`', 0],
    ['await db.$queryRaw`SELECT * FROM practice_answers`', 0],
    ['await db.practiceAnswer.update({})', 0],
    ['await db.$executeRaw`INSERT INTO practice_answers (a) VALUES (1)`', 1],
    ['await db.$executeRaw`insert  into "practice_answers" (a) values (1)`', 1],
    ['await db.practiceAnswer.findMany({})', 0],
    ['// await db.practiceAnswer.createMany({})', 0],
    ['/* insert into practice_answers */', 0],
  ])('%s', (src, n) => {
    expect(writeSites(src)).toBe(n)
  })
})
