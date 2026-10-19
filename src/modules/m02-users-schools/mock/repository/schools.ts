/**
 * The `schools` repository (owner M02; D12, overview §6.7; SRS v1.18 §6.3, §6.4, §6.15 A, §7 #38,
 * #40, #41, #43). The only doorway to the schools dataset and the JPN / PPD tables: M02's own
 * handlers and seed, M01 (register, profile), M04, M08, M11, M16, M17, M18 and the core
 * (`UserMe.school`) go through these methods.
 *
 * Contract (overview §6.7): `schools.search({q, state, limit, id})`, `schools.get(id)`,
 * `schools.summary(id)`, `schools.options()`, plus the admin reads and writes of S9–S11
 * (`list`, `counts`, `create`, `update`, `toggleActive`) and the lookups `jpnList`, `jpn`,
 * `ppdList`. Named queries (`count('S-…', …)`) are the documented school figures.
 *
 * Repository methods are synchronous; writes take `now` (epoch ms, the handler passes
 * `ctx.clock.now()`).
 */

import { toIsoMyt } from '@/lib/time'
import { defineNamedQueries } from '@/mock/dataset'
import { defineTable, maxPlusOne, type Where } from '@/mock/define'
import { defineRepository } from '@/mock/repository'

import { JPN_LIST, PPD_LIST } from '../data/geo'
import {
  FIXTURE_SCHOOL_ROWS,
  isFixtureSchoolId,
  SCHOOLS_RESERVED_RANGE,
} from '../datasets/schools-anchors'
import { schoolsDataset } from '../datasets/schools'
import {
  PERLIS_SCHOOLS,
  SCHOOL_DISTRICT_PINS,
  SCHOOLS_ACTIVE,
  SCHOOLS_BY_TYPE,
  SCHOOLS_TOTAL,
  SCHOOL_STATE_PINS,
} from '../datasets/schools-spec'
import type { Jpn, Ppd, School, SchoolOption, SchoolSummary, SchoolType } from './types'

export const jpnTable = defineTable<Jpn>({ name: 'schools.jpn', ids: maxPlusOne() })
/**
 * The fictitious fixture schools 900001–900004 (v1.21): stored rows outside every register count
 * (S9 list / stats, facets, search, options, M11 / M17 / M18). Read by `get` / `summary` only.
 */
export const fixtureSchoolsTable = defineTable<School>({
  name: 'schools.fixtures',
  ids: maxPlusOne(),
})
export const ppdTable = defineTable<Ppd>({
  name: 'schools.ppd',
  ids: maxPlusOne(),
  indexes: ['jpnId'],
})

/** `GET /api/schools/search` default limit (OBSERVED, M02 FR-102 / M01 #20). */
export const SCHOOL_SEARCH_DEFAULT_LIMIT = 20

/** Every non-fixture school id is below the reserved range (runtime ids start at 10,301). */
const REGISTER_IDS = { lte: SCHOOLS_RESERVED_RANGE.min - 1 } as const

/**
 * Named school figures (D11: every count is a named query on the dataset). `S-STATE-REGISTER`
 * excludes the fixture range 900001–900099 (M18 BR-M18-02, M11 BR-M11-34).
 */
export const schoolQueries = defineNamedQueries(schoolsDataset, {
  'S-ALL': { expected: SCHOOLS_TOTAL, source: 'M02 §6.15 A (S9 "Jumlah Sekolah")' },
  'S-ACTIVE': { where: { isActive: true }, expected: SCHOOLS_ACTIVE, source: 'M02 §6.15 A' },
  'S-INACTIVE': {
    where: { isActive: false },
    expected: SCHOOLS_TOTAL - SCHOOLS_ACTIVE,
    source: 'M02 §6.15 A',
  },
  'S-TYPE': {
    where: (type: SchoolType) => ({ type }),
    expected: [
      { args: ['SK'], value: SCHOOLS_BY_TYPE.SK },
      { args: ['SMK'], value: SCHOOLS_BY_TYPE.SMK },
    ],
    source: 'M02 §6.15 A (S9 ?type=SK)',
  },
  'S-STATE': {
    where: (state: string) => ({ state }),
    expected: [
      { args: ['Perlis'], value: PERLIS_SCHOOLS },
      { args: ['Johor'], value: SCHOOL_STATE_PINS.Johor },
      { args: ['Perak'], value: SCHOOL_STATE_PINS.Perak },
    ],
    source: 'M02 §6.15 A (S9 ?state=Perlis)',
  },
  'S-STATE-REGISTER': {
    where: (state: string) => ({ state, id: REGISTER_IDS }),
    expected: Object.entries(SCHOOL_STATE_PINS).map(([state, value]) => ({ args: [state], value })),
    source: 'M18 §6.10 (Johor 1,189, Perak 1,102), M02 §6.15 A',
  },
  'S-DISTRICT': {
    where: (district: string) => ({ district }),
    expected: Object.entries(SCHOOL_DISTRICT_PINS).map(([district, value]) => ({
      args: [district],
      value,
    })),
    source: 'M18 §6.10 (S10 per-PPD counts, KLUANG 118, BATANG PADANG 122)',
  },
})

export interface SchoolSearchInput {
  /** Name or code substring (case-insensitive); empty = no text filter. */
  q?: string
  state?: string
  /** Default 20, no maximum (OBSERVED). */
  limit?: number
  /** A single school by id. */
  id?: number
}

export interface SchoolListFilter {
  search?: string
  state?: string
  type?: string
  isActive?: boolean
  page?: number
  pageSize?: number
}

export interface SchoolInput {
  name: string
  code: string
  type: SchoolType
  state: string
  district?: string | null
  city?: string | null
  isActive: boolean
}

function toSummary(s: School): SchoolSummary {
  return {
    id: s.id,
    name: s.name,
    code: s.code,
    type: s.type,
    state: s.state,
    district: s.district,
    city: s.city,
  }
}

function blank(v: string | undefined): boolean {
  return v === undefined || v.trim() === ''
}

export const schoolsRepo = defineRepository({
  owner: 'M02',
  name: 'schools',
  store: schoolsDataset,
  stores: { jpn: jpnTable, ppd: ppdTable, fixtures: fixtureSchoolsTable },
  queries: schoolQueries,
  validateAnchor: (row) => {
    const r = row as Partial<School>
    if (typeof r.name !== 'string' || r.name === '') return 'name is required'
    if (r.type !== 'SK' && r.type !== 'SMK') return `type must be SK or SMK, got ${String(r.type)}`
    return undefined
  },
  methods: ({ store, stores, transaction }) => {
    let optionsCache: { version: number; list: readonly SchoolOption[] } | null = null
    return {
      /** Seed phase: the JPN and PPD lookups (DATA-M02-04/05). */
      seedLookups(): void {
        transaction(() => {
          for (const f of FIXTURE_SCHOOL_ROWS) stores.fixtures.insert({ ...f })
          for (const j of JPN_LIST) stores.jpn.insert({ ...j })
          for (const p of PPD_LIST) stores.ppd.insert({ ...p })
        })
      },

      get(id: number): School | undefined {
        return isFixtureSchoolId(id) ? stores.fixtures.get(id) : store.get(id)
      },

      getMany(ids: readonly number[]): School[] {
        return ids.flatMap((id) => {
          const s = isFixtureSchoolId(id) ? stores.fixtures.get(id) : store.get(id)
          return s ? [s] : []
        })
      },

      /** M01 DATA-M01-06 `SchoolSummary` of school `id`, or null. */
      summary(id: number): SchoolSummary | null {
        const s = isFixtureSchoolId(id) ? stores.fixtures.get(id) : store.get(id)
        return s ? toSummary(s) : null
      },

      /** `true` for the fictitious fixture schools 900001–900099 (excluded from monitoring rollups). */
      isFixture(id: number): boolean {
        return isFixtureSchoolId(id)
      },

      /**
       * `GET /api/schools/search` (M02 #38 = M01 #20, FR-M02-102): **active** schools whose name or
       * code contains `q` (case-insensitive), filtered by `state`, at most `limit` (default 20, no
       * maximum), ordered by name A→Z (INFERRED; the one observed ranking — "bangi" → SJK(T) BANGI
       * first — holds). `id` returns that school (if active).
       */
      search(input: SchoolSearchInput = {}): SchoolSummary[] {
        const limit =
          input.limit !== undefined && Number.isSafeInteger(input.limit) && input.limit > 0
            ? input.limit
            : SCHOOL_SEARCH_DEFAULT_LIMIT
        if (input.id !== undefined) {
          // The dataset only: fixture schools are outside the search (v1.21).
          const s = isFixtureSchoolId(input.id) ? undefined : store.get(input.id)
          return s && s.isActive ? [toSummary(s)] : []
        }
        const where: Where<School> = { isActive: true }
        if (!blank(input.state)) where.state = (input.state as string).trim()
        const q = input.q?.trim() ?? ''
        const { rows } = store.query({
          where,
          ...(q === '' ? {} : { search: { term: q, fields: ['name', 'code'] as const } }),
          sort: [{ field: 'name', dir: 'asc' }, 'id'],
          page: 1,
          pageSize: limit,
        })
        return rows.map(toSummary)
      },

      /**
       * §7 #43 `GET /api/schools?all=1`: every school (active and inactive), name A→Z. The list is
       * kept per dataset version (every write bumps it), so repeated reads stay within the budget.
       */
      options(): SchoolOption[] {
        if (!optionsCache || optionsCache.version !== store.version) {
          const list = store
            .query({ sort: [{ field: 'name', dir: 'asc' }, 'id'] })
            .rows.map((s) => Object.freeze({ id: s.id, name: s.name }))
          optionsCache = { version: store.version, list: Object.freeze(list) }
        }
        return [...optionsCache.list]
      },

      /**
       * S9 list (§7 #24): filters, text search over name and code, name A→Z (OBSERVED, FR-M02-78;
       * ties by id), 30 per page.
       */
      list(filter: SchoolListFilter = {}): { rows: School[]; total: number } {
        const where: Where<School> = {}
        if (!blank(filter.state)) where.state = (filter.state as string).trim()
        if (!blank(filter.type)) where.type = (filter.type as string).trim() as SchoolType
        if (filter.isActive !== undefined) where.isActive = filter.isActive
        const term = filter.search?.trim() ?? ''
        return store.query({
          where,
          ...(term === '' ? {} : { search: { term, fields: ['name', 'code'] as const } }),
          sort: [{ field: 'name', dir: 'asc' }, 'id'],
          page: filter.page ?? 1,
          pageSize: filter.pageSize ?? 30,
        })
      },

      /** S9 `meta.types` (FR-M02-77): the distinct school types present in the data, A→Z. */
      types(): string[] {
        return [...store.groupCount('type').keys()].sort()
      },

      /**
       * A school (register or fixture) whose code equals `code` (case-insensitive, trimmed), for
       * the S10/S11 unique-code rule (BR-20, INFERRED). An empty code never matches.
       */
      findByCode(code: string): School | undefined {
        const term = code.trim()
        if (term === '') return undefined
        const key = term.toLowerCase()
        // Exact match: page through the substring hits (no cap) until one equals the code.
        const PAGE = 500
        let hit: School | undefined
        for (let page = 1; !hit; page++) {
          const { rows } = store.query({
            search: { term, fields: ['code'] as const },
            page,
            pageSize: PAGE,
          })
          hit = rows.find((s) => s.code.toLowerCase() === key)
          if (rows.length < PAGE) break
        }
        return (
          hit ??
          stores.fixtures.query({ sort: 'id' }).rows.find((s) => s.code.toLowerCase() === key)
        )
      },

      /** S9 stat cards: total, active, inactive (named queries S-ALL / S-ACTIVE / S-INACTIVE). */
      counts(): { total: number; active: number; inactive: number } {
        return {
          total: store.count(),
          active: store.count({ isActive: true }),
          inactive: store.count({ isActive: false }),
        }
      },

      /** Ad-hoc filter count (overview §6.7: `count` is reserved for named queries). */
      countWhere(where: Where<School> = {}): number {
        return store.count(where)
      },

      /** S10 create (§7 #26): a runtime school, id from 10,301 (skipping 900001–900099). */
      create(input: SchoolInput, now: number): School {
        const at = toIsoMyt(now)
        return transaction(() =>
          store.insert({
            name: input.name,
            code: input.code,
            type: input.type,
            state: input.state,
            district: input.district ?? null,
            city: input.city ?? null,
            isActive: input.isActive,
            createdAt: at,
            updatedAt: at,
          }),
        )
      },

      /** S11 update (§7 #27). */
      update(id: number, patch: Partial<SchoolInput>, now: number): School {
        const target = isFixtureSchoolId(id) ? stores.fixtures : store
        if (!target.get(id)) throw new Error(`schools.update: no school ${String(id)}`)
        return transaction(() => target.update(id, { ...patch, updatedAt: toIsoMyt(now) }))
      },

      /** S9 toggle (§7 #28). */
      toggleActive(id: number, now: number): School {
        const target = isFixtureSchoolId(id) ? stores.fixtures : store
        const s = target.get(id)
        if (!s) throw new Error(`schools.toggleActive: no school ${String(id)}`)
        return transaction(() =>
          target.update(id, { isActive: !s.isActive, updatedAt: toIsoMyt(now) }),
        )
      },

      /** `GET /api/jpn` (§7 #40): the 16 JPN in id order. */
      jpnList(): Jpn[] {
        return stores.jpn.query({ sort: 'id' }).rows.map((j) => ({ ...j }))
      },

      jpn(id: number): Jpn | undefined {
        return stores.jpn.get(id)
      },

      /** `GET /api/jpn/:id/ppd` (§7 #41): the PPDs of a JPN, in code order; `undefined` = no JPN. */
      ppdList(jpnId: number): Ppd[] | undefined {
        if (!stores.jpn.get(jpnId)) return undefined
        return stores.ppd.query({ where: { jpnId }, sort: 'code' }).rows.map((p) => ({ ...p }))
      },
    }
  },
})

export type SchoolsRepository = typeof schoolsRepo
