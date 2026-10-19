import { describe, expect, it } from 'vitest'

import { createClock } from '@/lib/time'

import { createDb } from '../../db/transaction'
import { bootMock } from '../../index'
import { defineMockCore, defineMockModule, type MockModule } from '../../server/plugin'
import {
  createRepositoryRegistry,
  defineRepository,
  finaliseRepositories,
  RepositoryError,
  type RepositoryRegistry,
} from '../index'
import { anchor, makeQuestions, Q_TOTAL, questionQueries } from './fixtures'

function catchError(fn: () => unknown): RepositoryError {
  try {
    fn()
  } catch (err) {
    expect(err).toBeInstanceOf(RepositoryError)
    return err as RepositoryError
  }
  throw new Error('expected a RepositoryError')
}

function makeRepo(registry: RepositoryRegistry) {
  const store = makeQuestions()
  const repo = defineRepository({
    name: 'questions',
    owner: 'M04',
    store,
    queries: questionQueries(store),
    validateAnchor: (row) =>
      row.subjectId > 0 ? undefined : 'subjectId must be a curriculum subject',
    methods: ({ store: s }) => ({
      get: (id: number) => s.get(id),
      isAnchor: (id: number) => s.isAnchor(id),
    }),
    registry,
  })
  return { store, repo }
}

describe('contribute phase → finalise (unit)', () => {
  it('contributions are anchors within the owner totals; reads wait for finalise', () => {
    const { store, repo } = makeRepo(createRepositoryRegistry())
    repo.contributeAnchors('M05', [anchor(600_001), anchor(600_002, { subjectId: 2 })])
    repo.contributeAnchors('M06', [anchor(600_003, { status: 'draft' })])

    // Any read before finalise throws, so no read can compile the dataset early.
    const early = catchError(() => repo.count('Q-ALL'))
    expect(early.code).toBe('PHASE')
    expect(early.message).toMatch(/read before finalise/)
    expect(catchError(() => repo.get(1)).code).toBe('PHASE')
    expect(catchError(() => store.count()).code).toBe('PHASE')
    expect(store.compiled).toBe(false)

    finaliseRepositories([repo])
    expect(repo.count('Q-ALL')).toBe(Q_TOTAL) // anchors never add to the total (D11)
    expect(repo.get(600_001)).toMatchObject({ text: 'Anchor 600001' })
    expect(repo.isAnchor(600_003)).toBe(true)
    expect([...store.contributions().entries()]).toEqual([
      ['M05', [600_001, 600_002]],
      ['M06', [600_003]],
    ])
  })

  it('a contribution after finalise throws', () => {
    const { repo } = makeRepo(createRepositoryRegistry())
    finaliseRepositories([repo])
    const err = catchError(() => repo.contributeAnchors('M05', [anchor(600_001)]))
    expect(err.code).toBe('PHASE')
    expect(err.message).toMatch(/seed-phase only.*seed\(ctx\)/)
  })

  it('a contribution from a live-phase context throws', () => {
    const { repo } = makeRepo(createRepositoryRegistry())
    const db = createDb()
    db.baseline()
    const err = catchError(() => repo.contributeAnchors({ module: 'M05', db }, [anchor(600_001)]))
    expect(err.code).toBe('PHASE')
  })

  it('the owner validates contributed rows', () => {
    const { repo } = makeRepo(createRepositoryRegistry())
    const err = catchError(() =>
      repo.contributeAnchors('M05', [
        anchor(600_001, { subjectId: 0 }),
        anchor(600_002),
        anchor(600_002),
        { subjectId: 1 } as never,
      ]),
    )
    expect(err.code).toBe('CONTRACT')
    expect(err.issues).toEqual([
      'id 600001: subjectId must be a curriculum subject',
      'row 2: duplicate id 600002',
      'row 3: id is required (anchors carry their live or reserved id)',
    ])
    expect(catchError(() => repo.contributeAnchors('X' as 'M05', [])).code).toBe('CONTRACT')
    // Nothing was added by the rejected call.
    finaliseRepositories([repo])
    expect(repo.isAnchor(600_002)).toBe(false)
  })

  it('reset (db.reset → clear) reopens the contribute phase', () => {
    const { store, repo } = makeRepo(createRepositoryRegistry())
    const db = createDb()
    db.register(store)
    repo.contributeAnchors({ module: 'M05', db }, [anchor(600_001)])
    db.baseline()
    expect(repo.isAnchor(600_001)).toBe(true)
    db.reset()
    repo.contributeAnchors({ module: 'M05', db }, [anchor(600_002)])
    db.baseline()
    expect(repo.isAnchor(600_001)).toBe(false)
    expect(repo.isAnchor(600_002)).toBe(true)
  })
})

describe('contribute phase with the real seed composer (bootMock)', () => {
  function plugins(options: { readInSeed?: boolean; contributeInFinalise?: boolean } = {}) {
    const registry = createRepositoryRegistry()
    const { store, repo } = makeRepo(registry)
    const seen: Record<string, unknown> = {}
    // M03 comes BEFORE the owner M04 in registry order and still contributes.
    const m03 = defineMockModule({
      id: 'M03',
      seed: (ctx) => repo.contributeAnchors(ctx, [anchor(600_010, { subjectId: 2 })]),
    })
    const m04 = defineMockModule({
      id: 'M04',
      datasets: { questions: store },
      repositories: { questions: repo },
    })
    const m05 = defineMockModule({
      id: 'M05',
      dependsOn: ['M04'],
      seed: (ctx) => {
        repo.contributeAnchors(ctx, [anchor(600_011)])
        if (options.readInSeed) repo.count('Q-ALL')
      },
      finalise: (ctx) => {
        seen.total = repo.count('Q-ALL')
        seen.eligible = repo.count('Q-ELIGIBLE', 2)
        seen.anchor = repo.get(600_010)
        if (options.contributeInFinalise) repo.contributeAnchors(ctx, [anchor(600_012)])
      },
    })
    return { modules: [m03, m04, m05] as MockModule<object>[], repo, store, seen }
  }

  function boot(modules: MockModule<object>[]) {
    return bootMock({
      mode: 'test',
      core: defineMockCore({}),
      plugins: modules,
      clock: createClock({ at: '2026-09-25T15:40:00+08:00' }),
      latencyMs: 0,
    })
  }

  it('every module contributes in seed(); reads start in finalise()', async () => {
    const { modules, repo, store, seen } = plugins()
    const runtime = await boot(modules)
    expect(runtime.seedSteps).toEqual([
      'seed:core',
      'seed:M03',
      'seed:M04',
      'seed:M05',
      'compile:M04.questions',
      'finalise:M05',
      'baseline',
    ])
    expect(seen).toMatchObject({
      total: Q_TOTAL,
      eligible: 25,
      anchor: { id: 600_010, subjectId: 2 },
    })
    expect([...store.contributions().keys()]).toEqual(['M03', 'M05'])
    expect(repo.count('Q-ALL')).toBe(Q_TOTAL)
  })

  it('a read in seed() fails the boot with a clear phase error', async () => {
    const { modules } = plugins({ readInSeed: true })
    await expect(boot(modules)).rejects.toMatchObject({
      code: 'PHASE',
      message: /read before finalise/,
    })
  })

  it('a contribution in finalise() fails the boot', async () => {
    const { modules } = plugins({ contributeInFinalise: true })
    await expect(boot(modules)).rejects.toMatchObject({ code: 'PHASE', message: /seed-phase only/ })
  })

  it('two plugins registering one store name fail the boot (duplicate store)', async () => {
    const { modules } = plugins()
    const copy = defineMockModule({ id: 'M06', datasets: { questions: makeQuestions() } })
    await expect(boot([...modules, copy])).rejects.toMatchObject({ code: 'DUPLICATE_STORE' })
  })

  it('after boot, direct writes are refused and owner writes are persisted', async () => {
    const { modules, store } = plugins()
    const runtime = await boot(modules)
    const err = catchError(() => store.update(1, { isActive: false }))
    expect(err.code).toBe('OWNERSHIP')
    expect(runtime.db.diff()).toMatchObject({ questions: { overrides: [] } })
  })
})
