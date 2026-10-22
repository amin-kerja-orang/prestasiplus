import { existsSync } from 'node:fs'

import { afterAll, describe, expect, it } from 'vitest'

import { AnonymiseAbortedError } from '../../../src/migration/anonymise/errors'
import { runAnonymise } from '../../../src/migration/anonymise/run'
import { parseConfig } from '../../../src/migration/anonymise/rules'
import { DirReader, type TableReader } from '../../../src/migration/staging/readers'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { piiTables, scratch, TEST_KEY, writeDump } from './helpers'

const work = scratch()
afterAll(() => work.cleanup())
const config = parseConfig(JSON.parse(readFileSync(fileURLToPath(new URL('../../../src/migration/anonymise/anon.config.json', import.meta.url)), 'utf8')))

/** A reader that fires the abort while the first table is being read, and counts the tables that were opened. */
function abortingReader(inner: TableReader, abort: AbortController, opened: string[]): TableReader {
  return {
    kind: inner.kind,
    expectedRows: (t) => inner.expectedRows(t),
    has: (t) => inner.has(t),
    inputHash: () => inner.inputHash(),
    close: () => inner.close(),
    read: async function* (table, size) {
      opened.push(table)
      for await (const batch of inner.read(table, size)) {
        yield batch
        abort.abort()
      }
    },
  }
}

describe('runAnonymise signal', () => {
  it('stops after the batch in which the abort arrived, deletes the partial output and throws AnonymiseAbortedError', async () => {
    const source = work.out('abort-src')
    writeDump(source, piiTables())
    const out = work.out('abort-out')
    const abort = new AbortController()
    const opened: string[] = []
    await expect(
      runAnonymise({ reader: abortingReader(new DirReader(source), abort, opened), outDir: out, config, key: Buffer.from(TEST_KEY), sourceDir: source, signal: abort.signal }),
    ).rejects.toBeInstanceOf(AnonymiseAbortedError)
    expect(opened.length).toBe(1) // the later tables were never opened
    expect(existsSync(out)).toBe(false)
    expect(existsSync(`${out}.partial`)).toBe(false)
  })

  it('an already aborted signal stops before the first table is read', async () => {
    const source = work.out('abort-src2')
    writeDump(source, piiTables())
    const abort = new AbortController()
    abort.abort()
    const opened: string[] = []
    const out2 = work.out('abort-out2')
    await expect(
      runAnonymise({ reader: abortingReader(new DirReader(source), abort, opened), outDir: out2, config, key: Buffer.from(TEST_KEY), sourceDir: source, signal: abort.signal }),
    ).rejects.toBeInstanceOf(AnonymiseAbortedError)
    expect(opened).toEqual([])
    expect(existsSync(out2)).toBe(false)
    expect(existsSync(`${out2}.partial`)).toBe(false)
  })

  it('without a signal nothing changes', async () => {
    const source = work.out('abort-src3')
    writeDump(source, { schools: piiTables().schools ?? [] })
    const r = await runAnonymise({ reader: new DirReader(source), outDir: work.out('abort-out3'), config, key: Buffer.from(TEST_KEY), sourceDir: source })
    expect(r.totalRows).toBe(1)
  })
})
