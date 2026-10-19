import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'

import { CloudSource, type SourceRow } from '../cloud-source'
import { hashInput } from '../kit/sql'
import { findTable } from '../ddl/spec'

export class DumpFormatError extends Error {}

/** Where the rows come from. Both readers yield plain JSON objects, `size` rows per batch. */
export interface TableReader {
  readonly kind: 'dir' | 'pg'
  /** Rows the input promises per table (dir manifest), or null when it makes no promise. */
  expectedRows(table: string): number | null
  /** False when the input has no such table (loaded empty, and reported as absent). */
  has(table: string): Promise<boolean>
  read(table: string, size: number): AsyncGenerator<SourceRow[], void, undefined>
  /** Stable hash of what was read from (manifest content), for the report. Null for a live source. */
  inputHash(): string | null
  close(): Promise<void>
}

export const DUMP_FORMAT = 'pp-staging-dump/1'

interface Manifest {
  format: string
  source: string
  tables: Record<string, { rows: number; file?: string }>
}

const FILE_NAME = /^[a-z][a-z0-9_]*\.ndjson$/

/**
 * A dump directory: `manifest.json` plus one `<table>.ndjson` per non-empty table (one JSON object
 * per line). This is the format of the synthetic fixtures; the format for the real anonymised dump
 * is confirmed once OD-2 is answered (runbook).
 */
export class DirReader implements TableReader {
  readonly kind = 'dir' as const
  private readonly manifest: Manifest
  private readonly manifestText: string

  constructor(private readonly dir: string) {
    const manifestPath = join(resolve(dir), 'manifest.json')
    if (!existsSync(manifestPath)) throw new DumpFormatError('The dump directory has no manifest.json.')
    this.manifestText = readFileSync(manifestPath, 'utf8')
    let parsed: unknown
    try {
      parsed = JSON.parse(this.manifestText)
    } catch {
      throw new DumpFormatError('manifest.json is not valid JSON.')
    }
    const m = parsed as Partial<Manifest>
    if (m.format !== DUMP_FORMAT) throw new DumpFormatError(`manifest.json format must be "${DUMP_FORMAT}".`)
    if (m.source !== 'cloud') throw new DumpFormatError('manifest.json source must be "cloud".')
    if (!m.tables || typeof m.tables !== 'object') throw new DumpFormatError('manifest.json has no tables object.')
    for (const [name, entry] of Object.entries(m.tables)) {
      if (!findTable(name)) throw new DumpFormatError(`manifest.json lists an unknown table "${name}".`)
      if (!Number.isInteger(entry.rows) || entry.rows < 0) throw new DumpFormatError(`Bad row count for table "${name}".`)
      if (entry.rows > 0 && (!entry.file || !FILE_NAME.test(entry.file))) {
        throw new DumpFormatError(`Table "${name}" needs a plain file name like ${name}.ndjson.`)
      }
    }
    this.manifest = m as Manifest
  }

  expectedRows(table: string): number | null {
    return this.manifest.tables[table]?.rows ?? null
  }

  async has(table: string): Promise<boolean> {
    return this.manifest.tables[table] !== undefined
  }

  inputHash(): string {
    return hashInput([DUMP_FORMAT, this.manifestText])
  }

  async *read(table: string, size: number): AsyncGenerator<SourceRow[], void, undefined> {
    const entry = this.manifest.tables[table]
    if (!entry || entry.rows === 0) return
    const path = join(resolve(this.dir), entry.file as string)
    if (!existsSync(path) || !statSync(path).isFile()) throw new DumpFormatError(`File for table "${table}" is missing.`)
    const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity })
    let batch: SourceRow[] = []
    let lineNo = 0
    for await (const line of lines) {
      lineNo++
      if (line.trim() === '') continue
      let row: unknown
      try {
        row = JSON.parse(line)
      } catch {
        // Never echo the line: it may hold personal data.
        throw new DumpFormatError(`Table "${table}": line ${lineNo} is not valid JSON.`)
      }
      if (row === null || typeof row !== 'object' || Array.isArray(row)) {
        throw new DumpFormatError(`Table "${table}": line ${lineNo} is not a JSON object.`)
      }
      batch.push(row as SourceRow)
      if (batch.length >= size) {
        yield batch
        batch = []
      }
    }
    if (batch.length > 0) yield batch
  }

  async close(): Promise<void> {}
}

/** Reads from a read-only PostgreSQL source (`CLOUD_SOURCE_URL`), already past the read-only guard. */
export class PgReader implements TableReader {
  readonly kind = 'pg' as const
  constructor(private readonly source: CloudSource) {}

  expectedRows(): number | null {
    return null
  }
  has(table: string): Promise<boolean> {
    return this.source.tableExists(table)
  }
  inputHash(): string | null {
    return null
  }
  read(table: string, size: number): AsyncGenerator<SourceRow[], void, undefined> {
    return this.source.read(table, size)
  }
  close(): Promise<void> {
    return this.source.close()
  }
}
