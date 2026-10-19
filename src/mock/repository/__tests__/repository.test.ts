import { describe, expect, expectTypeOf, it } from 'vitest'

import { createDb } from '../../db/transaction'
import { mulberry32 } from '../../determinism/prng'
import {
  createRepositoryRegistry,
  currentOwner,
  defineRepository,
  finaliseRepositories,
  isRepository,
  repositoryInfo,
  RepositoryError,
  withZeroCounts,
  type RepositoryRegistry,
} from '../index'
import {
  anchor,
  makeQuestions,
  makeWalletTable,
  Q_TOTAL,
  questionQueries,
  type Q,
} from './fixtures'

function questionsRepo(registry: RepositoryRegistry, store = makeQuestions()) {
  return defineRepository({
    name: 'questions',
    owner: 'M04',
    store,
    queries: questionQueries(store),
    validateAnchor: (row) =>
      row.subjectId > 0 ? undefined : 'subjectId must be a curriculum subject',
    methods: ({ store: s, transaction }) => ({
      get: (id: number) => s.get(id),
      deactivate: (id: number) => transaction(() => s.update(id, { isActive: false })),
      whoAmI: () => currentOwner(),
    }),
    registry,
  })
}

function expectRepoError(fn: () => unknown, code: RepositoryError['code'], message?: RegExp) {
  let caught: unknown
  try {
    fn()
  } catch (err) {
    caught = err
  }
  expect(caught).toBeInstanceOf(RepositoryError)
  expect((caught as RepositoryError).code).toBe(code)
  if (message) expect((caught as RepositoryError).message).toMatch(message)
}

describe('defineRepository', () => {
  it('exposes domain methods only, run in the owner scope, with its info', () => {
    const registry = createRepositoryRegistry()
    const repo = questionsRepo(registry)
    finaliseRepositories([repo])
    expect(isRepository(repo)).toBe(true)
    expect(isRepository({ get: () => 1 })).toBe(false)
    expect(Object.isFrozen(repo)).toBe(true)
    expect(Object.keys(repo).sort()).toEqual(
      [
        'contributeAnchors',
        'count',
        'deactivate',
        'get',
        'groupCount',
        'query',
        'sample',
        'whoAmI',
        'where',
      ].sort(),
    )
    expect('store' in repo).toBe(false)
    expect(repo.whoAmI()).toBe('M04')
    expect(currentOwner()).toBeNull()
    expect(repositoryInfo(repo)).toEqual({
      name: 'questions',
      owner: 'M04',
      provisional: false,
      store: 'questions',
      stores: ['questions'],
      kind: 'virtual',
      namedQueries: ['Q-ALL', 'Q-ELIGIBLE', 'Q-DRAFT'],
    })
    expect(registry.get('questions')).toBe(repositoryInfo(repo))
  })

  it('rejects invalid definitions', () => {
    const registry = createRepositoryRegistry()
    expectRepoError(
      () => defineRepository({ owner: 'X9' as 'M04', store: makeWalletTable(), registry }),
      'CONTRACT',
      /invalid owner/,
    )
    expectRepoError(
      () =>
        defineRepository({
          owner: 'M05',
          store: {} as ReturnType<typeof makeWalletTable>,
          registry,
        }),
      'CONTRACT',
      /expected a store/,
    )
    expectRepoError(
      () =>
        defineRepository({
          owner: 'M05',
          store: makeWalletTable('w1'),
          methods: () => ({ count: () => 1 }),
          registry,
        }),
      'CONTRACT',
      /clashes/,
    )
    expectRepoError(
      () =>
        defineRepository({
          owner: 'M05',
          store: makeWalletTable('w2'),
          methods: ({ store }) => ({ table: store }),
          registry,
        }),
      'CONTRACT',
      /domain methods only/,
    )
  })

  it('tables have no contributeAnchors; extra stores share the owner', () => {
    const registry = createRepositoryRegistry()
    const sessions = makeWalletTable('practice.sessions')
    const answers = makeWalletTable('practice.answers')
    const repo = defineRepository({
      name: 'practice',
      owner: 'M05',
      store: sessions,
      stores: { answers },
      methods: ({ stores }) => ({
        record: (userId: number) => stores.answers.insert({ userId, coins: 0, points: 0 }),
      }),
      registry,
    })
    expect('contributeAnchors' in repo).toBe(false)
    expect(repositoryInfo(repo)).toMatchObject({
      kind: 'table',
      stores: ['practice.sessions', 'practice.answers'],
    })
    expect(repo.record(7)).toMatchObject({ id: 1, userId: 7 })
    expectRepoError(() => answers.insert({ userId: 8, coins: 0, points: 0 }), 'OWNERSHIP')
  })
})

describe('named-query methods', () => {
  const registry = createRepositoryRegistry()
  const repo = questionsRepo(registry)
  finaliseRepositories([repo])

  it('count / groupCount / query / sample / where by query id', () => {
    expect(repo.count('Q-ALL')).toBe(Q_TOTAL)
    expect(repo.count('Q-ELIGIBLE')).toBe(65)
    expect(repo.count('Q-ELIGIBLE', 1)).toBe(40)
    expect(repo.count('Q-DRAFT')).toBe(30)
    expect(repo.where('Q-ELIGIBLE', 2)).toEqual({
      status: 'approved',
      isActive: true,
      subjectId: 2,
    })

    const page = repo.query(
      'Q-ELIGIBLE',
      { sort: { field: 'id', dir: 'desc' }, page: 1, pageSize: 5 },
      2,
    )
    expect(page.total).toBe(25)
    expect(page.rows).toHaveLength(5)
    expect(page.rows.every((r) => r.subjectId === 2 && r.isActive)).toBe(true)

    const drawn = repo.sample('Q-ELIGIBLE', 3, mulberry32(7), 1)
    expect(drawn).toHaveLength(3)
    expect(new Set(drawn.map((r) => r.id)).size).toBe(3)
    expect(repo.sample('Q-ELIGIBLE', 3, mulberry32(7), 1)).toEqual(drawn)
  })

  it('groupCount omits zero groups; withZeroCounts fills them', () => {
    const bySubject = repo.groupCount('Q-ELIGIBLE', 'subjectId')
    expect([...bySubject.entries()].sort()).toEqual([
      [1, 40],
      [2, 25],
    ])
    expect(bySubject.has(3)).toBe(false)
    expect([...withZeroCounts(bySubject, [1, 2, 3])]).toEqual([
      [1, 40],
      [2, 25],
      [3, 0],
    ])
    expect([...withZeroCounts(new Map([[9, 1]]), [1])]).toEqual([
      [1, 0],
      [9, 1],
    ])
  })

  it('unknown query ids throw; ids and args are typed', () => {
    expectRepoError(
      () => (repo.count as (id: string) => number)('Q-NOPE'),
      'CONTRACT',
      /Known: Q-ALL/,
    )
    // @ts-expect-error unknown named query
    expect(() => repo.count('Q-NOPE')).toThrow(RepositoryError)
    // @ts-expect-error wrong argument type
    expect(repo.count('Q-ELIGIBLE', '1')).toBe(0)
    expectTypeOf(repo.groupCount('Q-ALL', 'status')).toEqualTypeOf<Map<Q['status'], number>>()
  })
})

describe('ownership guard (runtime D12)', () => {
  it('refuses direct writes from outside the owner repository', () => {
    const registry = createRepositoryRegistry()
    const wallet = makeWalletTable()
    const repo = defineRepository({
      owner: 'M14',
      provisional: true,
      store: wallet,
      methods: ({ store }) => ({
        credit: (userId: number, coins: number) =>
          store.insert({ userId, coins, points: coins * 10 }),
      }),
      registry,
    })
    const row = repo.credit(1, 5)
    expect(row).toMatchObject({ userId: 1, coins: 5, points: 50 })
    expectRepoError(
      () => wallet.insert({ userId: 2, coins: 1, points: 1 }),
      'OWNERSHIP',
      /owned by M14/,
    )
    expectRepoError(() => wallet.update(row.id, { coins: 99 }), 'OWNERSHIP', /current scope: none/)
    expectRepoError(() => wallet.remove(row.id), 'OWNERSHIP')
    expect(wallet.get(row.id)).toMatchObject({ coins: 5 })
  })

  it('a non-owner repository method cannot write another owner store, but may call its contract', () => {
    const registry = createRepositoryRegistry()
    const store = makeQuestions()
    const questions = questionsRepo(registry, store)
    const db = createDb()
    db.register(store)
    const practiceTable = db.register(makeWalletTable('practice.sessions'))
    db.baseline()
    const practice = defineRepository({
      name: 'practice',
      owner: 'M05',
      store: practiceTable,
      methods: () => ({
        cheat: (id: number) => store.update(id, { isActive: false }),
        report: (id: number) => questions.deactivate(id),
        scope: () => currentOwner(),
      }),
      registry,
    })
    expectRepoError(() => practice.cheat(1), 'OWNERSHIP', /current scope: M05/)
    const [first] = questions.query('Q-ELIGIBLE', { page: 1, pageSize: 1 }).rows
    expect(practice.report(first!.id)).toMatchObject({ isActive: false })
    expect(questions.count('Q-ELIGIBLE')).toBe(64)
    expect(practice.scope()).toBe('M05')
  })

  it('raw overrideSpec is refused; an owner method wrapping it (contributeCells) works', () => {
    const registry = createRepositoryRegistry()
    const store = makeQuestions()
    type Cell = { facets: Pick<Q, 'subjectId' | 'status' | 'isActive'>; count: number }
    const repo = defineRepository({
      name: 'questions',
      owner: 'M04',
      store,
      queries: questionQueries(store),
      methods: ({ store: s, phase }) => ({
        /** Owner contract for distribution cells from another module (e.g. the M06 SPM pool). */
        contributeCells(contributor: string, cells: readonly Cell[]) {
          if (s.compiled || phase() === 'live') {
            throw new RepositoryError('PHASE', `contributeCells(${contributor}): seed phase only`)
          }
          const bad = cells.filter((c) => c.count < 0 || c.facets.subjectId <= 0)
          if (bad.length > 0) throw new RepositoryError('CONTRACT', 'invalid cells')
          // Owner rule (D11): contributed cells count within the total, taken from the same
          // subject's draft pool.
          s.overrideSpec((spec) => [
            ...spec.map((c) => {
              const taken = cells
                .filter(
                  (x) => x.facets.subjectId === c.facets.subjectId && c.facets.status === 'draft',
                )
                .reduce((n, x) => n + x.count, 0)
              return { facets: { ...c.facets }, count: c.count - taken }
            }),
            ...cells.map((c) => ({ ...c, facets: { ...c.facets } })),
          ])
        },
      }),
      registry,
    })
    const extra: Cell = { facets: { subjectId: 3, status: 'approved', isActive: true }, count: 7 }

    // A non-owner holding the raw dataset cannot change the owner's spec.
    expectRepoError(
      () => store.overrideSpec((spec) => [...spec, extra]),
      'OWNERSHIP',
      /overrideSpec/,
    )
    expectRepoError(
      () => repo.contributeCells('M06', [{ ...extra, facets: { ...extra.facets, subjectId: 0 } }]),
      'CONTRACT',
    )
    repo.contributeCells('M06', [extra])
    finaliseRepositories([repo])
    expect(repo.count('Q-ALL')).toBe(Q_TOTAL)
    expect(repo.count('Q-DRAFT')).toBe(30 - 7)
    expect(repo.count('Q-ELIGIBLE', 3)).toBe(7)
    expectRepoError(() => repo.contributeCells('M06', [extra]), 'PHASE')
  })

  it('raw addAnchors is refused; a store has one owner', () => {
    const registry = createRepositoryRegistry()
    const store = makeQuestions()
    questionsRepo(registry, store)
    expectRepoError(() => store.addAnchors([anchor(600_001)], 'M05'), 'OWNERSHIP')
    expectRepoError(
      () => defineRepository({ name: 'questions-copy', owner: 'M05', store, registry }),
      'OWNERSHIP',
      /owned by M04/,
    )
    // A second repository of the same owner over the same store is fine.
    expect(() =>
      defineRepository({ name: 'questions-admin', owner: 'M04', store, registry }),
    ).not.toThrow()
  })

  it('ctx.transaction rolls back every store written by a failing method', () => {
    const registry = createRepositoryRegistry()
    const a = makeWalletTable('a')
    const b = makeWalletTable('b')
    // Repositories are defined at module load, before boot registers their stores.
    const repo = defineRepository({
      owner: 'M05',
      store: a,
      stores: { b },
      methods: ({ store, stores, transaction, phase }) => ({
        both: (fail: boolean) =>
          transaction(() => {
            store.insert({ userId: 1, coins: 1, points: 1 })
            stores.b.insert({ userId: 1, coins: 1, points: 1 })
            if (fail) throw new Error('boom')
          }),
        phase,
      }),
      registry,
    })
    expect(repo.phase()).toBeNull()
    const db = createDb()
    db.register(a)
    db.register(b)
    expect(repo.phase()).toBe('seed')
    db.baseline()
    expect(repo.phase()).toBe('live')
    const commits: unknown[] = []
    db.onCommit((e) => void commits.push(e.changes))
    expect(() => repo.both(true)).toThrow('boom')
    expect(a.count()).toBe(0)
    expect(b.count()).toBe(0)
    repo.both(false)
    expect(commits).toHaveLength(1)
    expect(Object.keys(commits[0] as object).sort()).toEqual(['a', 'b'])
  })
})

describe('registry of stores (boot errors)', () => {
  it('a duplicate repository name throws', () => {
    const registry = createRepositoryRegistry()
    defineRepository({
      name: 'wallet',
      owner: 'M14',
      provisional: true,
      store: makeWalletTable('w-a'),
      registry,
    })
    expectRepoError(
      () =>
        defineRepository({ name: 'wallet', owner: 'M14', store: makeWalletTable('w-b'), registry }),
      'DUPLICATE_REPOSITORY',
      /defined twice: by M14 \(provisional\) and by M14/,
    )
  })

  it('the HMR registry lets a definition replace itself only', () => {
    const registry = createRepositoryRegistry({ allowRedefine: true })
    defineRepository({ name: 'wallet', owner: 'M14', store: makeWalletTable('w-a'), registry })
    expect(() =>
      defineRepository({ name: 'wallet', owner: 'M14', store: makeWalletTable('w-b'), registry }),
    ).not.toThrow()
    expectRepoError(
      () =>
        defineRepository({ name: 'wallet', owner: 'M05', store: makeWalletTable('w-c'), registry }),
      'DUPLICATE_REPOSITORY',
    )
    registry.clear()
    expect(registry.list()).toEqual([])
  })
})
