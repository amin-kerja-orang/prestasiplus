/**
 * Migration lint (BE-34, plan 14.2 and 14.9). `npm run be:lint:migration`.
 *
 * Fails (exit 1) when
 *  - a model listed in `prisma/migratable-models.json` is missing from the schema, or lacks the
 *    `legacy_source` / `legacy_id` columns, the unique `(legacy_source, legacy_id)`, or (for the
 *    models in HASH_REQUIRED_MODELS) `legacy_hash`;
 *  - a migration creates a Postgres enum type (`CREATE TYPE ... AS ENUM`), or a schema file
 *    declares a Prisma `enum` (enums are `text` + `check`, plan 14.2);
 *  - the list file is not an alphabetical array of unique model names.
 *
 * Reports as warnings (exit stays 0, so existing tables can be fixed by their owning cards):
 *  - a model that is NOT listed but carries a `legacy_source` or `legacy_id` column;
 *  - a model that is NOT listed and looks like a business table (every model except the `Etl*`
 *    control tables and `_`-prefixed ones), so the owning card can either list it or confirm that
 *    no source row can land in it;
 *  - a listed model with no `legacy_source IN ('cloud', 'my')` check constraint in any migration.
 *
 * File format of `migratable-models.json`: a JSON array of Prisma model names (PascalCase, as
 * written in `schema/*.prisma`), sorted alphabetically, no duplicates. Example: ["Chapter", "User"].
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Models that must also carry `legacy_hash` (big activity tables, plan 14.2). Extend when a card adds one. */
export const HASH_REQUIRED_MODELS: ReadonlySet<string> = new Set(['CoinLedger', 'PracticeAnswer'])

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
  /** Column name per field (the `@map` value, else the field name). */
  columns: Map<string, string>
  /** Each `@@unique` as a list of column names. */
  uniques: string[][]
}

function stripComments(text: string): string {
  return text.replace(/\/\/[^\n]*/g, '')
}

export function parseModels(schemaText: string): ParsedModel[] {
  const models: ParsedModel[] = []
  const blockRe = /^\s*model\s+(\w+)\s*\{([\s\S]*?)^\s*\}/gm
  for (const m of stripComments(schemaText).matchAll(blockRe)) {
    const name = m[1] as string
    const body = m[2] as string
    const columns = new Map<string, string>()
    const uniques: string[][] = []
    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim()
      if (!line) continue
      if (line.startsWith('@@')) {
        const u = /^@@unique\(\s*\[([^\]]*)\]/.exec(line)
        if (u) uniques.push((u[1] as string).split(',').map((s) => s.trim()).filter(Boolean))
        continue
      }
      const f = /^(\w+)\s+\S+/.exec(line)
      if (!f) continue
      const field = f[1] as string
      const map = /@map\(\s*"([^"]+)"\s*\)/.exec(line)
      columns.set(field, map ? (map[1] as string) : field)
    }
    models.push({ name, columns, uniques })
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

export function checkMigratable(paths: CheckPaths): CheckResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. The list file.
  let listed: string[] = []
  try {
    const parsed: unknown = JSON.parse(readFileSync(paths.listFile, 'utf8'))
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) {
      errors.push('migratable-models.json must be a JSON array of model names (strings).')
    } else {
      listed = parsed as string[]
      const sorted = [...listed].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      if (listed.join('|') !== sorted.join('|')) {
        errors.push('migratable-models.json must be sorted alphabetically (plain code-point order).')
      }
      if (new Set(listed).size !== listed.length) errors.push('migratable-models.json lists a model twice.')
    }
  } catch (err) {
    errors.push(`migratable-models.json cannot be read: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 2. The schema.
  const files = readSchemaFiles(paths.schemaDir)
  const models = new Map<string, ParsedModel>()
  for (const { file, text } of files) {
    if (/^\s*enum\s+\w+\s*\{/m.test(stripComments(text))) {
      errors.push(`${file}: Prisma "enum" is not allowed; use String + CHECK in the migration (plan 14.2).`)
    }
    for (const model of parseModels(text)) models.set(model.name, model)
  }

  const listedSet = new Set(listed)
  for (const name of listed) {
    const model = models.get(name)
    if (!model) {
      errors.push(`${name}: listed in migratable-models.json but no such model in prisma/schema.`)
      continue
    }
    const cols = new Set(model.columns.values())
    for (const need of ['legacy_source', 'legacy_id']) {
      if (!cols.has(need)) errors.push(`${name}: missing column ${need} (plan 14.2).`)
    }
    if (HASH_REQUIRED_MODELS.has(name) && !cols.has('legacy_hash')) {
      errors.push(`${name}: missing column legacy_hash (required for big activity tables).`)
    }
    const hasUnique = model.uniques.some((u) => {
      const cs = u.map((field) => model.columns.get(field) ?? field)
      return cs.length === 2 && cs[0] === 'legacy_source' && cs[1] === 'legacy_id'
    })
    if (!hasUnique) {
      errors.push(`${name}: missing @@unique([legacySource, legacyId]) (the ETL upsert key).`)
    }
  }

  // 3. Migrations.
  const migrations = readMigrations(paths.migrationsDir)
  for (const { dir, sql } of migrations) {
    if (/create\s+type\s+("?[\w.]+"?)\s+as\s+enum/i.test(sql)) {
      errors.push(`migrations/${dir}: creates a Postgres enum type; use text + CHECK (plan 14.2).`)
    }
  }

  // 4. Warnings for existing tables.
  const statements = migrations.flatMap((m) => m.sql.split(';'))
  for (const model of models.values()) {
    if (listedSet.has(model.name) || CONTROL_MODEL.test(model.name)) continue
    const cols = new Set(model.columns.values())
    const hasLegacy = cols.has('legacy_source') || cols.has('legacy_id')
    if (hasLegacy) {
      warnings.push(`${model.name}: has legacy_* columns but is not listed in migratable-models.json.`)
    } else {
      warnings.push(
        `${model.name}: not listed in migratable-models.json and has no legacy_* columns (list it, or confirm no source row can land in it).`,
      )
    }
  }
  for (const name of listed) {
    if (!models.has(name)) continue
    const table = tableOf(name, files)
    const hasCheck =
      table !== undefined &&
      statements.some(
        (st) => st.includes(table) && /legacy_source[^;]*\bin\s*\(\s*'cloud'\s*,\s*'my'\s*\)/i.test(st),
      )
    if (!hasCheck) warnings.push(`${name}: no CHECK (legacy_source IN ('cloud', 'my')) found in any migration.`)
  }

  return { errors, warnings }
}

function tableOf(model: string, files: { text: string }[]): string | undefined {
  for (const { text } of files) {
    const m = new RegExp(`model\\s+${model}\\s*\\{[\\s\\S]*?@@map\\(\\s*"([^"]+)"\\s*\\)[\\s\\S]*?\\}`).exec(
      stripComments(text),
    )
    if (m) return m[1]
  }
  return undefined
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
