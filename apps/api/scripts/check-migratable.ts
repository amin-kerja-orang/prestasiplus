/**
 * Migration lint (BE-34, plan 14.2 and 14.9). `npm run be:lint:migration`.
 *
 * Fails (exit 1) when
 *  - a table listed in `prisma/migratable-models.json` has no model in the schema, or lacks the
 *    `legacy_source` / `legacy_id` columns, the unique `(legacy_source, legacy_id)`, or (for the
 *    tables in HASH_REQUIRED_TABLES) `legacy_hash`;
 *  - a migration creates a Postgres enum type (`CREATE TYPE ... AS ENUM`, also the schema-qualified
 *    form, comments ignored), or a schema file declares a Prisma `enum` (enums are `text` + `check`,
 *    plan 14.2);
 *  - the list file is not an alphabetical array of unique table names.
 *
 * Reports as warnings (exit stays 0, so existing tables can be fixed by their owning cards):
 *  - a model that is NOT listed but carries a `legacy_source` or `legacy_id` column;
 *  - a model that is NOT listed and looks like a business table (every model except the `Etl*`
 *    control tables and `_`-prefixed ones), so the owning card can either list it or confirm that
 *    no source row can land in it;
 *  - a listed table with no `legacy_source IN ('cloud', 'my')` check constraint in any migration.
 *
 * File format of `migratable-models.json`: a JSON array of TABLE names (the `@@map` value of the
 * model, else the model name; snake_case as in the database), sorted alphabetically, no
 * duplicates. Example: ["schools", "users"]. This is the format BE-03 wrote and that its schema
 * spec reads.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Tables that must also carry `legacy_hash` (big activity tables, plan 14.2). Extend when a card adds one. */
export const HASH_REQUIRED_TABLES: ReadonlySet<string> = new Set(['coin_ledger', 'practice_answers'])

/** Control and platform models that never receive legacy rows (no warning when unlisted). */
const CONTROL_MODEL = /^(Etl[A-Z]|_)/

export interface CheckPaths {
  schemaDir: string
  migrationsDir: string
  listFile: string
}

export interface CheckResult {
  errors: string[]
  warnings: string[]
}

interface ParsedModel {
  name: string
  /** Database table: the `@@map` value, else the model name. */
  table: string
  /** Column name per field (the `@map` value, else the field name). */
  columns: Map<string, string>
  /** Each `@@unique` as a list of field names. */
  uniques: string[][]
}

function stripComments(text: string): string {
  return text.replace(/\/\/[^\n]*/g, '')
}

/** Block attributes (`@@unique([...])`, possibly over several lines, `@@map("...")`). */
const BLOCK_ATTR = /@@(\w+)\(((?:[^()]|\([^()]*\))*)\)/g

export function parseModels(schemaText: string): ParsedModel[] {
  const models: ParsedModel[] = []
  const blockRe = /^\s*model\s+(\w+)\s*\{([\s\S]*?)^\s*\}/gm
  for (const m of stripComments(schemaText).matchAll(blockRe)) {
    const name = m[1] as string
    const body = m[2] as string
    const columns = new Map<string, string>()
    const uniques: string[][] = []
    let table = name
    for (const a of body.matchAll(BLOCK_ATTR)) {
      const args = a[2] as string
      if (a[1] === 'unique') {
        const u = /^\s*\[([^\]]*)\]/.exec(args)
        if (u) uniques.push((u[1] as string).split(',').map((s) => s.trim()).filter(Boolean))
      } else if (a[1] === 'map') {
        const t = /^\s*"([^"]+)"/.exec(args)
        if (t) table = t[1] as string
      }
    }
    for (const rawLine of body.replace(BLOCK_ATTR, '').split('\n')) {
      const line = rawLine.trim()
      if (!line) continue
      const f = /^(\w+)\s+\S+/.exec(line)
      if (!f) continue
      const field = f[1] as string
      const map = /@map\(\s*"([^"]+)"\s*\)/.exec(line)
      columns.set(field, map ? (map[1] as string) : field)
    }
    models.push({ name, table, columns, uniques })
  }
  return models
}

function readSchemaFiles(schemaDir: string): { file: string; text: string }[] {
  return readdirSync(schemaDir)
    .filter((f) => f.endsWith('.prisma'))
    .sort()
    .map((file) => ({ file, text: readFileSync(join(schemaDir, file), 'utf8') }))
}

function readMigrations(migrationsDir: string): { dir: string; sql: string }[] {
  if (!existsSync(migrationsDir)) return []
  return readdirSync(migrationsDir)
    .filter((d) => statSync(join(migrationsDir, d)).isDirectory())
    .sort()
    .map((dir) => {
      const file = join(migrationsDir, dir, 'migration.sql')
      return { dir, sql: existsSync(file) ? readFileSync(file, 'utf8') : '' }
    })
}

function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')
}

export function checkMigratable(paths: CheckPaths): CheckResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. The list file.
  let listed: string[] = []
  try {
    const parsed: unknown = JSON.parse(readFileSync(paths.listFile, 'utf8'))
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) {
      errors.push('migratable-models.json must be a JSON array of table names (strings).')
    } else {
      listed = parsed as string[]
      const sorted = [...listed].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      if (listed.join('|') !== sorted.join('|')) {
        errors.push('migratable-models.json must be sorted alphabetically (plain code-point order).')
      }
      if (new Set(listed).size !== listed.length) errors.push('migratable-models.json lists a table twice.')
    }
  } catch (err) {
    errors.push(`migratable-models.json cannot be read: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 2. The schema (models keyed by table name).
  const files = readSchemaFiles(paths.schemaDir)
  const byTable = new Map<string, ParsedModel>()
  for (const { file, text } of files) {
    if (/^\s*enum\s+\w+\s*\{/m.test(stripComments(text))) {
      errors.push(`${file}: Prisma "enum" is not allowed; use String + CHECK in the migration (plan 14.2).`)
    }
    for (const model of parseModels(text)) byTable.set(model.table, model)
  }

  const listedSet = new Set(listed)
  for (const table of listed) {
    const model = byTable.get(table)
    if (!model) {
      errors.push(`${table}: listed in migratable-models.json but no model maps to this table in prisma/schema.`)
      continue
    }
    const cols = new Set(model.columns.values())
    for (const need of ['legacy_source', 'legacy_id']) {
      if (!cols.has(need)) errors.push(`${table}: missing column ${need} (plan 14.2).`)
    }
    if (HASH_REQUIRED_TABLES.has(table) && !cols.has('legacy_hash')) {
      errors.push(`${table}: missing column legacy_hash (required for big activity tables).`)
    }
    const hasUnique = model.uniques.some((u) => {
      const cs = u.map((field) => model.columns.get(field) ?? field)
      return cs.length === 2 && cs[0] === 'legacy_source' && cs[1] === 'legacy_id'
    })
    if (!hasUnique) {
      errors.push(`${table}: missing @@unique([legacySource, legacyId]) (the ETL upsert key).`)
    }
  }

  // 3. Migrations.
  const migrations = readMigrations(paths.migrationsDir).map((m) => ({ ...m, sql: stripSqlComments(m.sql) }))
  for (const { dir, sql } of migrations) {
    if (/create\s+type\s+[^;(]*?\s+as\s+enum\b/i.test(sql)) {
      errors.push(`migrations/${dir}: creates a Postgres enum type; use text + CHECK (plan 14.2).`)
    }
  }

  // 4. Warnings for existing tables.
  const statements = migrations.flatMap((m) => m.sql.split(';'))
  for (const model of byTable.values()) {
    if (listedSet.has(model.table) || CONTROL_MODEL.test(model.name)) continue
    const cols = new Set(model.columns.values())
    if (cols.has('legacy_source') || cols.has('legacy_id')) {
      warnings.push(`${model.table}: has legacy_* columns but is not listed in migratable-models.json.`)
    } else {
      warnings.push(
        `${model.table}: not listed in migratable-models.json and has no legacy_* columns (list it, or confirm no source row can land in it).`,
      )
    }
  }
  for (const table of listed) {
    if (!byTable.has(table)) continue
    const mention = new RegExp(`["\\s.]${table}["\\s]`)
    const hasCheck = statements.some(
      (st) => mention.test(st) && /legacy_source[^;]*\bin\s*\(\s*'cloud'\s*,\s*'my'\s*\)/i.test(st),
    )
    if (!hasCheck) warnings.push(`${table}: no CHECK (legacy_source IN ('cloud', 'my')) found in any migration.`)
  }

  return { errors, warnings }
}

export function defaultPaths(): CheckPaths {
  const root = fileURLToPath(new URL('../prisma/', import.meta.url))
  return {
    schemaDir: join(root, 'schema'),
    migrationsDir: join(root, 'migrations'),
    listFile: join(root, 'migratable-models.json'),
  }
}

function main(): void {
  const { errors, warnings } = checkMigratable(defaultPaths())
  for (const w of warnings) console.warn(`warning: ${w}`)
  for (const e of errors) console.error(`error: ${e}`)
  if (errors.length > 0) {
    console.error(`be:lint:migration failed: ${errors.length} error(s), ${warnings.length} warning(s).`)
    process.exit(1)
  }
  console.log(`be:lint:migration passed (${warnings.length} warning(s)).`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
