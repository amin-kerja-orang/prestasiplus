/**
 * The export stream splitter (AM-10). Consumes the stdout lines of the one-session export (export-sql.ts
 * `buildDumpSql`) and writes `<table>.ndjson` files. Memory use is one line plus a 1 MiB write buffer.
 *
 * Every data line is checked to parse as a JSON object, but it is written VERBATIM (never re-serialised), so a bigint
 * above 2^53 keeps every digit. Files are created with mode 0600 and never overwritten (`wx`).
 *
 * The row count of each table is compared with the COUNT(*) taken in the same snapshot; a mismatch, a line that is not a
 * JSON object, an unexpected marker or a truncated stream (no end marker) raises `ExportStreamError` (exit 6). Messages
 * hold table names and counts only, never a line.
 */
import { open, type FileHandle } from 'node:fs/promises'
import { join } from 'node:path'

import { ExportStreamError } from './errors'
import { M, type TablePlan } from './export-sql'

export interface SplitTable {
  table: string
  rows: number
  /** Set when rows > 0. */
  file?: string
  bytes: number
}

export interface SplitResult {
  tables: SplitTable[]
  /** table -> column -> number of non-NULL values that were not valid JSON (spec `j` on a text column). */
  invalidJson: Record<string, Record<string, number>>
}

const FLUSH_AT = 1024 * 1024

class TableFile {
  private handle: FileHandle | undefined
  private chunks: string[] = []
  private pending = 0
  bytes = 0

  constructor(private readonly path: string) {}

  async write(line: string): Promise<void> {
    this.chunks.push(line, '\n')
    this.pending += line.length + 1
    if (this.pending >= FLUSH_AT) await this.flush()
  }

  async flush(): Promise<void> {
    if (this.pending === 0) return
    this.handle ??= await open(this.path, 'wx', 0o600)
    const data = Buffer.from(this.chunks.join(''), 'utf8')
    this.chunks = []
    this.pending = 0
    await this.handle.write(data)
    this.bytes += data.length
  }

  async close(): Promise<void> {
    try {
      await this.flush()
    } finally {
      await this.handle?.close()
      this.handle = undefined
    }
  }
}

type Stage = 'idle' | 'count' | 'rows' | 'bad-count'

export async function splitExport(lines: AsyncIterable<string>, plans: readonly TablePlan[], dir: string): Promise<SplitResult> {
  const expected = plans.filter((p) => p.present)
  const tables: SplitTable[] = []
  const invalidJson: Record<string, Record<string, number>> = {}
  let next = 0
  let stage: Stage = 'idle'
  let current: { name: string; promised: number; rows: number; file: TableFile; fileName: string } | undefined
  let badColumn = ''
  let ended = false

  const finish = async (): Promise<void> => {
    if (!current) return
    const c = current
    current = undefined
    await c.file.close()
    if (c.rows !== c.promised) {
      throw new ExportStreamError(`Table ${c.name}: the snapshot counted ${c.promised} rows but ${c.rows} were exported.`)
    }
    tables.push({ table: c.name, rows: c.rows, ...(c.rows > 0 ? { file: c.fileName } : {}), bytes: c.file.bytes })
  }

  try {
    for await (const line of lines) {
      if (ended) throw new ExportStreamError('The export stream continued after its end marker.')
      if (line === M.end) {
        await finish()
        ended = true
        continue
      }
      if (line.startsWith(`${M.table} `)) {
        await finish()
        const name = line.slice(M.table.length + 1)
        const want = expected[next]
        if (!want || want.name !== name) {
          throw new ExportStreamError('The export stream names a table that was not asked for, or in a different order.')
        }
        next++
        const fileName = `${name}.ndjson`
        current = { name, promised: -1, rows: 0, file: new TableFile(join(dir, fileName)), fileName }
        stage = 'count'
        continue
      }
      if (!current) throw new ExportStreamError('Unexpected output before the first table marker.')
      if (stage === 'count' || stage === 'bad-count') {
        if (!/^\d{1,15}$/.test(line)) throw new ExportStreamError(`Table ${current.name}: a row count was expected but the client printed something else.`)
        if (stage === 'count') current.promised = Number(line)
        else (invalidJson[current.name] ??= {})[badColumn] = Number(line)
        stage = 'rows'
        continue
      }
      if (line.startsWith(`${M.jsonBad} `)) {
        badColumn = line.slice(M.jsonBad.length + 1)
        stage = 'bad-count'
        continue
      }
      // A data line.
      let parsed: unknown
      try {
        parsed = JSON.parse(line)
      } catch {
        throw new ExportStreamError(`Table ${current.name}: row ${current.rows + 1} is not valid JSON.`)
      }
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new ExportStreamError(`Table ${current.name}: row ${current.rows + 1} is not a JSON object.`)
      }
      await current.file.write(line)
      current.rows++
    }
    if (!ended) throw new ExportStreamError('The export stream ended before its end marker (the client was cut off).')
    if (next !== expected.length) throw new ExportStreamError(`The export stream covered ${next} of ${expected.length} tables.`)
    return { tables, invalidJson }
  } finally {
    await (current as { file: TableFile } | undefined)?.file.close().catch(() => undefined)
  }
}
