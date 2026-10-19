import { describe, expect, expectTypeOf, it } from 'vitest'

import { defineMockModule } from '../../server/plugin'
import {
  assertRepositoryConventions,
  checkRepositoryConventions,
  createRepositoryRegistry,
  defineRepository,
  repositoryInfo,
  repositoryStores,
  RepositoryError,
  type RepositoryRegistry,
} from '../index'
import { makeQuestions, makeWalletTable } from './fixtures'

/**
 * The wallet contract (overview §6.7). The provisional definition (hosted by M05, `owner: 'M14'`)
 * and the real one (in M14) come from the same definition, which is exactly what "the owner's build
 * task moves the definition without changing the contract" means.
 */
function defineWallet(options: { provisional: boolean; registry: RepositoryRegistry }) {
  const table = makeWalletTable('wallet')
  const repo = defineRepository({
    name: 'wallet',
    owner: 'M14',
    provisional: options.provisional,
    store: table,
    methods: ({ store, transaction }) => ({
      credit(userId: number, amount: { coins: number; points: number }) {
        return transaction(() => {
          const [row] = store.query({ where: { userId } }).rows
          if (!row) return store.insert({ userId, ...amount })
          return store.update(row.id, {
            coins: row.coins + amount.coins,
            points: row.points + amount.points,
          })
        })
      },
      summary(userId: number) {
        const [row] = store.query({ where: { userId } }).rows
        return { coins: row?.coins ?? 0, points: row?.points ?? 0 }
      },
    }),
    registry: options.registry,
  })
  return { table, repo }
}

type WalletContract = ReturnType<typeof defineWallet>['repo']

/** A consumer (e.g. the M05 completeSession path) written against the contract only. */
function consumer(wallet: WalletContract) {
  wallet.credit(3, { coins: 4, points: 40 })
  wallet.credit(3, { coins: 1, points: 10 })
  return wallet.summary(3)
}

describe('provisional → owner move', () => {
  it('keeps the same contract and behaviour', () => {
    const provisional = defineWallet({ provisional: true, registry: createRepositoryRegistry() })
    const owned = defineWallet({ provisional: false, registry: createRepositoryRegistry() })
    expectTypeOf(provisional.repo).toEqualTypeOf(owned.repo)
    expect(consumer(provisional.repo)).toEqual({ coins: 5, points: 50 })
    expect(consumer(owned.repo)).toEqual({ coins: 5, points: 50 })
    expect(repositoryInfo(provisional.repo)).toMatchObject({ owner: 'M14', provisional: true })
    expect(repositoryInfo(owned.repo)).toMatchObject({ owner: 'M14', provisional: false })

    // Before the move: M05 hosts the provisional store. After: M14 owns it; M05 only consumes.
    const before = defineMockModule({
      id: 'M05',
      tables: { wallet: provisional.table },
      repositories: { wallet: provisional.repo },
    })
    const after = [
      defineMockModule({ id: 'M05' }),
      defineMockModule({
        id: 'M14',
        tables: { wallet: owned.table },
        repositories: { wallet: owned.repo },
      }),
    ]
    expect(checkRepositoryConventions([before])).toEqual([])
    expect(checkRepositoryConventions(after)).toEqual([])
  })

  it('both definitions at once is a duplicate (copy instead of move)', () => {
    const registry = createRepositoryRegistry()
    defineWallet({ provisional: true, registry })
    expect(() => defineWallet({ provisional: false, registry })).toThrow(/defined twice/)
  })
})

describe('plugin repositories export convention', () => {
  it('reports every breach', () => {
    const registry = createRepositoryRegistry()
    const questions = makeQuestions()
    const questionsRepo = defineRepository({
      name: 'questions',
      owner: 'M04',
      store: questions,
      registry,
    })
    const wallet = defineWallet({ provisional: true, registry })
    const orphan = makeWalletTable('orphan')
    const orphanRepo = defineRepository({ name: 'orphan', owner: 'M05', store: orphan, registry })

    const issues = checkRepositoryConventions([
      defineMockModule({
        id: 'M04',
        datasets: { questions },
        repositories: { questions: questionsRepo },
      }),
      defineMockModule({
        id: 'M05',
        datasets: { questions }, // a second copy of another owner's store
        tables: { wallet: wallet.table },
        repositories: {
          questions: questionsRepo, // re-export of the M04 contract
          wallet: wallet.repo,
          orphan: orphanRepo, // store not registered by the plugin
          plain: { get: () => 1 }, // not a repository
        },
      }),
      defineMockModule({
        id: 'M14',
        tables: { wallet: wallet.table },
        repositories: { purse: wallet.repo },
      }),
      defineMockModule({ id: 'M06', repositories: {} }),
    ])
    expect(issues).toEqual([
      "M05: re-exports repository 'questions' of M04; import it from the owner's mock entry instead",
      "M05: store 'orphan' of repository 'orphan' is not in the plugin's tables/datasets",
      'M05: repositories.plain is not a defineRepository result',
      "M05: registers store 'questions' owned by M04; use the M04 repository",
      "M14: repositories.purse holds repository 'wallet'; use its name as the key",
      "M14: re-exports repository 'wallet' of M05; import it from the owner's mock entry instead",
    ])
  })

  it('owner and provisional flags must match the exporting plugin', () => {
    const registry = createRepositoryRegistry()
    const a = makeWalletTable('a')
    const b = makeWalletTable('b')
    const selfProvisional = defineRepository({
      name: 'a',
      owner: 'M14',
      provisional: true,
      store: a,
      registry,
    })
    const foreign = defineRepository({ name: 'b', owner: 'M04', store: b, registry })
    expect(
      checkRepositoryConventions([
        defineMockModule({ id: 'M14', tables: { a }, repositories: { a: selfProvisional } }),
        defineMockModule({ id: 'M05', tables: { b }, repositories: { b: foreign } }),
      ]),
    ).toEqual([
      "M14: repository 'a' is provisional in its own owner; drop the flag",
      "M05: exports repository 'b' owned by M04; only the owner (or a provisional host) exports it",
      "M05: registers store 'b' owned by M04; use the M04 repository",
    ])
  })

  it('two plugins exporting one repository name', () => {
    const one = defineRepository({
      name: 'x',
      owner: 'M04',
      store: makeWalletTable('x1'),
      registry: createRepositoryRegistry(),
    })
    const two = defineRepository({
      name: 'x',
      owner: 'M05',
      store: makeWalletTable('x2'),
      registry: createRepositoryRegistry(),
    })
    const plugins = [
      defineMockModule({
        id: 'M04',
        tables: { x: repositoryStoreOf(one) },
        repositories: { x: one },
      }),
      defineMockModule({
        id: 'M05',
        tables: { x: repositoryStoreOf(two) },
        repositories: { x: two },
      }),
    ]
    expect(checkRepositoryConventions(plugins)).toEqual([
      "repository 'x' is exported by M04 and M05",
    ])
    expect(() => assertRepositoryConventions(plugins)).toThrow(RepositoryError)
    expect(() => assertRepositoryConventions([])).not.toThrow()
  })
})

function repositoryStoreOf(repo: object) {
  return repositoryStores(repo)[0]!
}
