import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { checkMigratable, defaultPaths } from '../../../scripts/check-migratable'

const API_DIR = fileURLToPath(new URL('../../../', import.meta.url))

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pp-lint-'))
  mkdirSync(join(dir, 'schema'))
  mkdirSync(join(dir, 'migrations'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const paths = () => ({
  schemaDir: join(dir, 'schema'),
  migrationsDir: join(dir, 'migrations'),
  listFile: join(dir, 'migratable-models.json'),
})
const list = (names: string[]) => writeFileSync(join(dir, 'migratable-models.json'), JSON.stringify(names))
const schema = (text: string) => writeFileSync(join(dir, 'schema', 'x.prisma'), text)
const migration = (name: string, sql: string) => {
  mkdirSync(join(dir, 'migrations', name))
  writeFileSync(join(dir, 'migrations', name, 'migration.sql'), sql)
}

const NO_UNIQUE = `
model Widget {
  id           BigInt  @id @default(autoincrement())
  name         String
  legacySource String? @map("legacy_source")
  legacyId     String? @map("legacy_id")
  @@map("widgets")
}
`
const WITH_UNIQUE = NO_UNIQUE.replace('  @@map', '  @@unique([legacySource, legacyId], map: "uq_widgets_legacy")\n  @@map')
const CHECK_SQL = `ALTER TABLE "widgets" ADD CONSTRAINT "ck_widgets_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'));`

describe('be:lint:migration (check-migratable)', () => {
  it('fails on a fixture model that lacks the unique index and passes after it is added', () => {
    list(['widgets'])
    schema(NO_UNIQUE)
    migration('0001_a', 'CREATE TABLE widgets (id bigint);')
    const bad = checkMigratable(paths())
    expect(bad.errors.join('\n')).toMatch(/widgets: missing @@unique\(\[legacySource, legacyId\]\)/)

    schema(WITH_UNIQUE)
    migration('0002_b', CHECK_SQL)
    const good = checkMigratable(paths())
    expect(good.errors).toEqual([])
    expect(good.warnings).toEqual([])
  })

  it('fails on missing legacy columns, and on legacy_hash for the models that require it', () => {
    list(['practice_answers', 'widgets'])
    schema(`
model Widget {
  id BigInt @id
  @@map("widgets")
}
model PracticeAnswer {
  id           BigInt  @id
  legacySource String? @map("legacy_source")
  legacyId     String? @map("legacy_id")
  @@unique([legacySource, legacyId])
  @@map("practice_answers")
}
`)
    const { errors } = checkMigratable(paths())
    expect(errors).toContain('widgets: missing column legacy_source (plan 14.2).')
    expect(errors).toContain('widgets: missing column legacy_id (plan 14.2).')
    expect(errors.some((e) => e.startsWith('practice_answers: missing column legacy_hash'))).toBe(true)
  })

  it('fails when a listed model does not exist, or the list is unsorted or duplicated', () => {
    schema(WITH_UNIQUE)
    list(['zed', 'widgets'])
    expect(checkMigratable(paths()).errors.join('\n')).toMatch(/must be sorted alphabetically/)
    list(['widgets', 'widgets'])
    expect(checkMigratable(paths()).errors.join('\n')).toMatch(/lists a table twice/)
    list(['missing'])
    expect(checkMigratable(paths()).errors.join('\n')).toMatch(/missing: listed .* but no model maps/)
  })

  it('fails on a migration that creates a Postgres enum, and on a Prisma enum', () => {
    list([])
    schema(WITH_UNIQUE)
    migration('0001_a', `CREATE TYPE "Status" AS ENUM ('a', 'b');`)
    expect(checkMigratable(paths()).errors.join('\n')).toMatch(/migrations\/0001_a: creates a Postgres enum type/)

    rmSync(join(dir, 'migrations'), { recursive: true })
    mkdirSync(join(dir, 'migrations'))
    schema('enum Status {\n  A\n  B\n}\n')
    expect(checkMigratable(paths()).errors.join('\n')).toMatch(/Prisma "enum" is not allowed/)
  })

  it('reports unlisted business models and a missing source check as warnings, not errors', () => {
    list(['widgets'])
    schema(`${WITH_UNIQUE}
model Gadget {
  id BigInt @id
  @@map("gadgets")
}
model EtlThing {
  id BigInt @id
  legacyId String? @map("legacy_id")
  @@map("etl_things")
}
`)
    const { errors, warnings } = checkMigratable(paths())
    expect(errors).toEqual([])
    expect(warnings.some((w) => w.startsWith('gadgets: not listed'))).toBe(true)
    expect(warnings.some((w) => w.startsWith('EtlThing'))).toBe(false)
    expect(warnings.some((w) => w.startsWith("widgets: no CHECK (legacy_source IN ('cloud', 'my'))"))).toBe(true)
  })

  it('the repository schema passes, and etl_* control tables are neither listed nor flagged', () => {
    const result = checkMigratable(defaultPaths())
    expect(result.errors).toEqual([])
    expect(result.warnings.filter((w) => w.startsWith('Etl'))).toEqual([])
  })

  it('the npm script exits 1 on errors and 0 on the repository state', () => {
    const run = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-migratable.ts'], {
      cwd: API_DIR,
      encoding: 'utf8',
    })
    expect(run.status).toBe(0)
    expect(run.stdout).toMatch(/be:lint:migration passed/)
  })
})

describe('be:lint:migration (check-migratable): hardening', () => {
  it('catches the schema-qualified enum form and ignores enum text inside SQL comments', () => {
    list([])
    schema(WITH_UNIQUE)
    migration('0001_a', `CREATE TYPE "public"."Role" AS ENUM ('a', 'b');`)
    expect(checkMigratable(paths()).errors.join('\n')).toMatch(/migrations\/0001_a: creates a Postgres enum type/)

    rmSync(join(dir, 'migrations'), { recursive: true })
    mkdirSync(join(dir, 'migrations'))
    migration('0001_a', `-- CREATE TYPE x AS ENUM ('a');\n/* CREATE TYPE y AS ENUM ('b') */\nSELECT 1;`)
    expect(checkMigratable(paths()).errors).toEqual([])

    rmSync(join(dir, 'migrations'), { recursive: true })
    mkdirSync(join(dir, 'migrations'))
    migration('0001_a', `CREATE\n  TYPE public.status\n  AS ENUM ('a');`)
    expect(checkMigratable(paths()).errors.join('\n')).toMatch(/creates a Postgres enum type/)
  })

  it('reads a multi-line @@unique and a table name from @@map', () => {
    list(['widgets'])
    schema(`
model Widget {
  id           BigInt  @id
  legacySource String? @map("legacy_source")
  legacyId     String? @map("legacy_id")
  @@unique([
    legacySource,
    legacyId,
  ], map: "uq_widgets_legacy")
  @@map("widgets")
}
`)
    migration('0001_a', CHECK_SQL)
    const r = checkMigratable(paths())
    expect(r.errors).toEqual([])
    expect(r.warnings).toEqual([])
  })

  it('looks tables up by table name, not by model name', () => {
    list(['Widget'])
    schema(WITH_UNIQUE)
    expect(checkMigratable(paths()).errors.join('\n')).toMatch(/Widget: listed .* no model maps to this table/)
  })
})
