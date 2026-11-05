import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * S5-T15 (AC-PA-01): no code writes `practice_answers` except through `AnswerLogPort` (answer-log.port.ts). Scanned:
 * `apps/api/src/**` (not the generated client) and `apps/api/prisma/seed/**`. The allow-list holds the direct writers
 * that still exist; each owning change removes its entry, so the list shrinks to empty (then migration 0188 validates
 * the mode check and sets NOT NULL). A new writer fails the test, and so does an entry that no longer matches anything.
 */
const API = resolve(__dirname, '../..')
const ROOTS = [join(API, 'src'), join(API, 'prisma/seed')]
const PORT = 'src/modules/practice/answer-log.port.ts'

/** file (relative to apps/api) -> number of direct write sites it may still have. */
const ALLOW_LIST: Readonly<Record<string, number>> = {
  // completeSession and completeDirect (createMany each); they move to the port in part 2 of S5-T15.
  'src/modules/practice/practice.repository.ts': 2,
  // Legacy ETL loader (upsertAndMap into practice_answers): must set `mode` before 0188 (NOT NULL).
  'src/migration/load/activity/practice-steps.ts': 1,
  // Demo seed: must set `mode` before 0188 (NOT NULL).
  'prisma/seed/practice.ts': 1,
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

  it('every direct writer is on the allow-list with its exact count', () => {
    const unexpected = [...found].filter(([f, n]) => ALLOW_LIST[f] !== n).map(([f, n]) => `${f}: ${String(n)} write site(s), allowed ${String(ALLOW_LIST[f] ?? 0)}`)
    expect(unexpected, 'route the write through AnswerLogPort.record').toEqual([])
  })

  it('every allow-list entry still matches (remove entries as writers move to the port)', () => {
    const stale = Object.entries(ALLOW_LIST).filter(([f, n]) => found.get(f) !== n).map(([f]) => f)
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
