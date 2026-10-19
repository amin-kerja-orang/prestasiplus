import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ApplyRefusedError, Runner, RunInProgressError, hashInput } from '../../../src/migration/kit'
import { createKitDb, DEMO_DDL, demoRows, demoStep, type DemoSource, type KitDb } from './helpers'

let kit: KitDb
let runner: Runner
beforeAll(async () => {
  kit = await createKitDb()
  await kit.db.query(DEMO_DDL)
  runner = new Runner({ pool: kit.pool })
})
afterAll(async () => {
  await kit.close()
})

const count = async (table = 'demo_items') =>
  Number((await kit.db.query<{ n: string }>(`select count(*) n from ${table}`))[0]?.n)
const reset = async () => {
  await kit.db.query('delete from demo_items')
  await kit.db.query('alter table demo_items alter column id restart with 1')
  await kit.db.query('delete from etl_runs')
  await kit.db.query('delete from etl_id_map')
}
const snapshot = () =>
  kit.db.query(`select id, code, name, qty, legacy_source, legacy_id, legacy_hash from demo_items order by id`)

describe('Runner dry-run and apply', () => {
  it('AC3: dry-run is the default, changes no non-etl table, and writes a run row marked dry-run', async () => {
    await reset()
    const inputHash = hashInput(['ac3'])
    const rows = demoRows(25)
    const report = await runner.run({ steps: [demoStep(rows)], inputHash, batchSize: 10 })

    expect(report.mode).toBe('dry-run')
    expect(report.status).toBe('succeeded')
    expect(report.recon).toEqual([
      { entity: 'demo_items', sourceCount: 25, eligibleCount: 25, loaded: 25, rejected: 0, expectedDelta: 0, status: 'ok' },
    ])
    expect(await count()).toBe(0)
    expect(await count('etl_id_map')).toBe(0)
    expect(await count('etl_checkpoints')).toBe(0)
    const run = (await kit.db.query<{ mode: string; status: string; input_hash: string; sources: string[]; entity_set: string[] }>(
      'select mode, status, input_hash, sources, entity_set from etl_runs',
    ))[0]
    expect(run).toEqual({ mode: 'dry-run', status: 'succeeded', input_hash: inputHash, sources: ['cloud'], entity_set: ['demo_items'] })
    expect(await count('etl_recon')).toBe(1)
  })

  it('AC3: --apply without a prior passing dry-run on the same input hash is refused with a clear message', async () => {
    await reset()
    const rows = demoRows(5)
    const err = await runner.run({ mode: 'apply', steps: [demoStep(rows)], inputHash: hashInput(['never-dry-run']) }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApplyRefusedError)
    expect((err as Error).message).toMatch(/Refusing --apply: no passing dry-run found for input hash/)
    expect(await count()).toBe(0)
    expect(await count('etl_runs')).toBe(0)

    // a dry-run on a different input hash, or a different entity set, does not count
    await runner.run({ steps: [demoStep(rows)], inputHash: hashInput(['other']) })
    await expect(runner.run({ mode: 'apply', steps: [demoStep(rows)], inputHash: hashInput(['never-dry-run']) })).rejects.toBeInstanceOf(ApplyRefusedError)
    const renamed = { ...demoStep(rows), entity: 'other_entity' }
    await expect(runner.run({ mode: 'apply', steps: [renamed], inputHash: hashInput(['other']) })).rejects.toBeInstanceOf(ApplyRefusedError)
    expect(await count()).toBe(0)
  })

  it('a failed dry-run (reconciliation mismatch) does not unlock --apply', async () => {
    await reset()
    const hash = hashInput(['mismatch'])
    const step = { ...demoStep(demoRows(4)), expectedDelta: 1 } // claims one row is unaccounted for; none is
    const report = await runner.run({ steps: [step], inputHash: hash })
    expect(report.status).toBe('failed')
    expect(report.recon[0]?.status).toBe('mismatch')
    await expect(runner.run({ mode: 'apply', steps: [step], inputHash: hash })).rejects.toBeInstanceOf(ApplyRefusedError)
  })

  it('apply after a passing dry-run loads the rows, is idempotent, and matches the dry-run reconciliation', async () => {
    await reset()
    const hash = hashInput(['apply-ok'])
    const rows: DemoSource[] = [...demoRows(30), { id: 31, code: 'BAD', name: null, qty: 0, status: 'zzz' }]
    const dry = await runner.run({ steps: [demoStep(rows)], inputHash: hash, batchSize: 8 })
    expect(dry.status).toBe('succeeded')
    expect(await count()).toBe(0)

    const applied = await runner.run({ mode: 'apply', steps: [demoStep(rows)], inputHash: hash, batchSize: 8 })
    expect(applied.status).toBe('succeeded')
    expect(applied.recon).toEqual(dry.recon)
    expect(applied.recon[0]).toMatchObject({ sourceCount: 31, loaded: 30, rejected: 1 })
    expect(await count()).toBe(30)
    expect(await count('etl_id_map')).toBe(30)
    const first = await snapshot()

    // second apply (a fresh run) changes nothing
    const again = await runner.run({ mode: 'apply', steps: [demoStep(rows)], inputHash: hash, batchSize: 8 })
    expect(again.counters.demo_items).toMatchObject({ inserted: 0, updated: 0, unchanged: 30 })
    expect(await snapshot()).toEqual(first)
  })

  it('AC7: killing a run after batch N and re-running continues at batch N+1 with identical final data', async () => {
    const rows = demoRows(35)
    const hash = hashInput(['resume'])

    // reference: an uninterrupted run
    await reset()
    await runner.run({ steps: [demoStep(rows)], inputHash: hash, batchSize: 10 })
    await runner.run({ mode: 'apply', steps: [demoStep(rows)], inputHash: hash, batchSize: 10 })
    const expected = await snapshot()

    // interrupted: batch 3 throws (the process "dies" after batch 2 committed)
    await reset()
    await runner.run({ steps: [demoStep(rows)], inputHash: hash, batchSize: 10 })
    await expect(
      runner.run({
        mode: 'apply',
        steps: [demoStep(rows, { beforeBatch: (b) => { if (b === 3) throw new Error('simulated crash') } })],
        inputHash: hash,
        batchSize: 10,
      }),
    ).rejects.toThrow('simulated crash')
    expect(await count()).toBe(20)
    const crashed = (await kit.db.query<{ id: string; status: string }>(`select id::text, status from etl_runs where mode = 'apply'`))[0]
    expect(crashed?.status).toBe('failed')
    const cp = (await kit.db.query<{ last_key: string; batch: number }>('select last_key, batch from etl_checkpoints'))[0]
    expect(cp).toEqual({ last_key: '20', batch: 2 })

    // re-run: the extractor is asked to start after key 20; batches 3 and 4 run
    const seenBatches: number[] = []
    const afterKeys: (string | null)[] = []
    const report = await runner.run({
      mode: 'apply',
      steps: [demoStep(rows, { beforeBatch: (b) => seenBatches.push(b), afterExtract: (k) => afterKeys.push(k) })],
      inputHash: hash,
      batchSize: 10,
    })
    expect(afterKeys).toEqual(['20'])
    expect(seenBatches).toEqual([3, 4])
    expect(report.resumedBatches).toBe(2)
    expect(report.status).toBe('succeeded')
    expect(report.runId).toBe(crashed?.id) // same run row
    expect(report.recon[0]).toMatchObject({ sourceCount: 35, loaded: 35, rejected: 0, status: 'ok' })
    expect(await snapshot()).toEqual(expected)
    expect(await count('etl_runs')).toBe(2) // one dry-run, one apply
  })

  it('a crash inside a batch leaves no partial rows, rejects or id-map entries for that batch', async () => {
    await reset()
    const hash = hashInput(['atomic'])
    const rows: DemoSource[] = [...demoRows(5), { id: 6, code: 'X', name: null, qty: 0, status: 'bad' }]
    await runner.run({ steps: [demoStep(rows)], inputHash: hash, batchSize: 10 })
    await kit.db.query('delete from etl_rejects')
    const crashing = demoStep(rows)
    const load = crashing.load.bind(crashing)
    crashing.load = async (batch, ctx) => {
      await load(batch, ctx)
      throw new Error('after the writes')
    }
    await expect(runner.run({ mode: 'apply', steps: [crashing], inputHash: hash, batchSize: 10 })).rejects.toThrow('after the writes')
    expect(await count()).toBe(0)
    expect(await count('etl_rejects')).toBe(0)
    expect(await count('etl_id_map')).toBe(0)
    expect(await count('etl_checkpoints')).toBe(0)
  })

  it('refuses a second concurrent run on the same mode and input', async () => {
    await reset()
    const hash = hashInput(['lock'])
    let release: () => void = () => undefined
    const gate = new Promise<void>((r) => { release = r })
    const slow = demoStep(demoRows(3))
    const load = slow.load.bind(slow)
    slow.load = async (b, c) => { await gate; return load(b, c) }
    const first = runner.run({ steps: [slow], inputHash: hash })
    await new Promise((r) => setTimeout(r, 300))
    await expect(runner.run({ steps: [demoStep(demoRows(3))], inputHash: hash })).rejects.toBeInstanceOf(RunInProgressError)
    release()
    expect((await first).status).toBe('succeeded')
  })
})
