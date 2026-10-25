import { DSKP_NON_SELECTABLE_FLAGS, sortFlags } from './flags'
import { dskpKey, groupCode } from './keys'
import { DSKP_LOADERS, DSKP_INDEX_TEXT, DSKP_VERSION_TEXT } from './loaders'
import type { DskpLoader } from './loaders'
import { resolveTp } from './tp'
import type { TpContext } from './tp'
import type {
  DskpFlag,
  DskpGroupId,
  DskpGroupNode,
  DskpNode,
  DskpSearchHit,
  DskpSkId,
  DskpSkNode,
  DskpSpId,
  DskpSpNode,
  DskpSubjectData,
  DskpSubjectInfo,
  DskpTingkatan,
  DskpUnitId,
  DskpUnitNode,
  DskpVersionFile,
  TpResolved,
  TpTable,
} from './types'

/**
 * The DSKP catalogue runtime (DSKP-T02, design sections 3.2 and 4, ADR-0022).
 *
 * `dskpCatalog` is the one object other modules read: a synchronous index of the 13 subjects,
 * `load(code)` that lazily loads and indexes one subject (cached), and a synchronous
 * `DskpSubjectView` for lookups, SP pick lists, TP descriptors and search. Everything it returns is
 * read-only (frozen). `createDskpCatalog` is the test seam: it takes the loaders (and optionally the
 * subject index) so a test can inject a small fixture instead of the real data.
 */

export type { DskpLoader } from './loaders'

export type DskpLoadErrorReason = 'unknown-subject' | 'no-loader' | 'load-failed' | 'invalid-data'

/** Typed rejection of `DskpCatalog.load`. */
export class DskpLoadError extends Error {
  readonly subject: string
  readonly reason: DskpLoadErrorReason

  constructor(subject: string, reason: DskpLoadErrorReason, detail?: string, cause?: unknown) {
    super(`DSKP subject ${subject}: ${reason}${detail ? ` (${detail})` : ''}`, { cause })
    this.name = 'DskpLoadError'
    this.subject = subject
    this.reason = reason
  }
}

export interface DskpSearchOptions {
  tingkatan?: DskpTingkatan
  unitId?: DskpUnitId
  /** Maximum number of hits (default 50). */
  limit?: number
  /** Kinds to search (default all three). Applied before `limit`. */
  kinds?: readonly ('u' | 'sk' | 'sp')[]
}

export interface DskpSubjectView {
  readonly info: DskpSubjectInfo
  groups(t: DskpTingkatan): readonly DskpGroupNode[]
  /** Print order; each unit carries `groupId` where the subject has groups. */
  units(t: DskpTingkatan): readonly DskpUnitNode[]
  group(id: DskpGroupId): DskpGroupNode | undefined
  unit(id: DskpUnitId): DskpUnitNode | undefined
  sk(id: DskpSkId): DskpSkNode | undefined
  sks(unitId: DskpUnitId): readonly DskpSkNode[]
  /** Selectable SP only, print order. */
  sps(unitId: DskpUnitId): readonly DskpSpNode[]
  /** Includes non-selectable slots. */
  sp(id: DskpSpId): DskpSpNode | undefined
  /** The parent SK, from the tree (not parsed from the code). */
  skOf(spId: DskpSpId): DskpSkNode | undefined
  unitOf(id: DskpSkId | DskpSpId): DskpUnitNode | undefined
  /** Unique SK ids of the SPs, in print order. Unknown ids are skipped. */
  skIdsOf(spIds: readonly DskpSpId[]): DskpSkId[]
  /** Node flags plus subject-wide and tingkatan-wide flags (already merged into `node.flags`). */
  effectiveFlags(node: DskpNode): readonly DskpFlag[]
  tpFor(target: { unitId: DskpUnitId; spIds?: readonly DskpSpId[] }, tp: number): TpResolved[]
  search(query: string, o?: DskpSearchOptions): DskpSearchHit[]
}

export interface DskpCatalog {
  readonly version: string
  /** The 13 subjects, synchronously (eager index). */
  subjects(): readonly DskpSubjectInfo[]
  subject(code: string): DskpSubjectInfo | undefined
  /** Lazy and cached. Rejects with `DskpLoadError` for an unknown code or a failed chunk. */
  load(code: string): Promise<DskpSubjectView>
  /** Synchronous accessor after `load`; undefined before. */
  loaded(code: string): DskpSubjectView | undefined
}

/** Index and version overrides for `createDskpCatalog` (tests). */
export interface DskpCatalogIndex {
  version?: string
  subjects?: readonly DskpSubjectInfo[]
}

// -----------------------------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------------------------

const EMPTY: readonly never[] = Object.freeze([])
const T4: DskpTingkatan = 'T4'
const T5: DskpTingkatan = 'T5'

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v)
  }
  return value
}

/**
 * Search normalisation: compatibility-decomposed, combining marks removed (Latin accents and
 * Arabic tashkil), Arabic tatweel removed, lower-case, whitespace collapsed.
 */
export function normaliseDskpText(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\p{M}ـ]/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// -----------------------------------------------------------------------------------------------
// Indexer
// -----------------------------------------------------------------------------------------------

interface SearchEntry {
  hit: DskpSearchHit
  ordinal: number
  unitId: DskpUnitId
  tingkatan: DskpTingkatan
  code: string
  haystack: string
}

function buildSubjectView(info: DskpSubjectInfo, data: DskpSubjectData): DskpSubjectView {
  const subject = info.code
  const invalid = (detail: string): DskpLoadError =>
    new DskpLoadError(info.code, 'invalid-data', detail)

  const groupsByT: Record<DskpTingkatan, DskpGroupNode[]> = { T4: [], T5: [] }
  const unitsByT: Record<DskpTingkatan, DskpUnitNode[]> = { T4: [], T5: [] }
  const groupMap = new Map<DskpGroupId, DskpGroupNode>()
  const unitMap = new Map<DskpUnitId, DskpUnitNode>()
  const skMap = new Map<DskpSkId, DskpSkNode>()
  const spMap = new Map<DskpSpId, DskpSpNode>()
  const sksByUnit = new Map<DskpUnitId, readonly DskpSkNode[]>()
  const spsByUnit = new Map<DskpUnitId, readonly DskpSpNode[]>()
  const skOrdinal = new Map<DskpSkId, number>()
  const entries: SearchEntry[] = []
  let ordinal = 0

  const effective = (own: readonly DskpFlag[] | undefined, t: DskpTingkatan): readonly DskpFlag[] =>
    Object.freeze(
      sortFlags([...(own ?? []), ...(info.flags ?? []), ...(info.tingkatanFlags?.[t] ?? [])]),
    )

  const register = <K extends string, V>(map: Map<K, V>, id: K, node: V): void => {
    if (map.has(id)) throw invalid(`duplicate key ${id}`)
    map.set(id, node)
  }

  const groupNodes: (DskpGroupNode | undefined)[] = data.groups.map((g) => {
    const node: DskpGroupNode = Object.freeze({
      kind: 'g' as const,
      id: dskpKey(subject, g.tingkatan, 'g', groupCode(g.title)),
      subject,
      tingkatan: g.tingkatan,
      ...(g.code !== undefined ? { code: g.code } : {}),
      title: g.title,
      flags: effective(undefined, g.tingkatan),
    })
    register(groupMap, node.id, node)
    groupsByT[g.tingkatan].push(node)
    return node
  })

  for (const u of data.units) {
    const t = u.tingkatan
    const group = u.group === undefined ? undefined : groupNodes[u.group]
    if (u.group !== undefined && !group) throw invalid(`unit ${u.code} points at group ${u.group}`)
    const unit: DskpUnitNode = Object.freeze({
      kind: 'u' as const,
      id: dskpKey(subject, t, 'u', u.code),
      subject,
      tingkatan: t,
      code: u.code,
      title: u.title,
      ...(group ? { groupId: group.id } : {}),
      ...(u.pkg !== undefined ? { pkg: u.pkg } : {}),
      flags: effective(u.flags, t),
      ...(u.tp ? { tp: deepFreeze(u.tp as readonly TpTable[]) } : {}),
    })
    register(unitMap, unit.id, unit)
    unitsByT[t].push(unit)
    entries.push(
      entryOf({ kind: 'u', node: unit, score: 0 }, ordinal++, unit.id, t, unit.code, unit.title),
    )

    const sks: DskpSkNode[] = []
    const sps: DskpSpNode[] = []
    for (const k of u.sks) {
      const sk: DskpSkNode = Object.freeze({
        kind: 'sk' as const,
        id: dskpKey(subject, t, 'sk', k.code),
        subject,
        tingkatan: t,
        code: k.code,
        title: k.title,
        unitId: unit.id,
        flags: effective(k.flags, t),
        ...(k.tp ? { tp: deepFreeze(k.tp as readonly TpTable[]) } : {}),
      })
      register(skMap, sk.id, sk)
      skOrdinal.set(sk.id, ordinal)
      sks.push(sk)
      entries.push(
        entryOf({ kind: 'sk', node: sk, score: 0 }, ordinal++, unit.id, t, sk.code, sk.title),
      )

      for (const p of k.sps) {
        const flags = effective(p.flags, t)
        const sp: DskpSpNode = Object.freeze({
          kind: 'sp' as const,
          id: dskpKey(subject, t, 'sp', p.code),
          subject,
          tingkatan: t,
          code: p.code,
          text: p.text,
          skId: sk.id,
          unitId: unit.id,
          ...(p.citizenship ? { citizenship: true as const } : {}),
          selectable: !flags.some((f) => DSKP_NON_SELECTABLE_FLAGS.includes(f)),
          flags,
        })
        register(spMap, sp.id, sp)
        if (sp.selectable) {
          sps.push(sp)
          entries.push(
            entryOf({ kind: 'sp', node: sp, score: 0 }, ordinal++, unit.id, t, sp.code, sp.text),
          )
        } else {
          ordinal++
        }
      }
    }
    sksByUnit.set(unit.id, Object.freeze(sks))
    spsByUnit.set(unit.id, Object.freeze(sps))
  }
  for (const t of [T4, T5]) {
    Object.freeze(groupsByT[t])
    Object.freeze(unitsByT[t])
  }

  function entryOf(
    hit: DskpSearchHit,
    ord: number,
    unitId: DskpUnitId,
    tingkatan: DskpTingkatan,
    code: string,
    text: string,
  ): SearchEntry {
    const c = normaliseDskpText(code)
    return {
      hit,
      ordinal: ord,
      unitId,
      tingkatan,
      code: c,
      haystack: `${c} ${normaliseDskpText(text)}`,
    }
  }

  const frozenInfo = deepFreeze(info) // already frozen when it comes from the catalogue index

  const skIdsOf = (spIds: readonly DskpSpId[]): DskpSkId[] => {
    const ids = new Set<DskpSkId>()
    for (const id of spIds) {
      const sp = spMap.get(id)
      if (sp) ids.add(sp.skId)
    }
    return [...ids].sort((a, b) => (skOrdinal.get(a) ?? 0) - (skOrdinal.get(b) ?? 0))
  }
  const tpContext: TpContext = {
    info: frozenInfo,
    generalTp: data.generalTp,
    unit: (id) => unitMap.get(id),
    sk: (id) => skMap.get(id),
    sp: (id) => spMap.get(id),
    skIdsOf,
  }

  const view: DskpSubjectView = {
    info: frozenInfo,
    groups: (t) => groupsByT[t] ?? EMPTY,
    units: (t) => unitsByT[t] ?? EMPTY,
    group: (id) => groupMap.get(id),
    unit: (id) => unitMap.get(id),
    sk: (id) => skMap.get(id),
    sks: (unitId) => sksByUnit.get(unitId) ?? EMPTY,
    sps: (unitId) => spsByUnit.get(unitId) ?? EMPTY,
    sp: (id) => spMap.get(id),
    skOf: (spId) => {
      const sp = spMap.get(spId)
      return sp ? skMap.get(sp.skId) : undefined
    },
    unitOf: (id) => {
      const parent = spMap.get(id as DskpSpId) ?? skMap.get(id as DskpSkId)
      return parent ? unitMap.get(parent.unitId) : undefined
    },
    skIdsOf,
    effectiveFlags: (node) => node.flags,
    tpFor: (target, tp) => resolveTp(tpContext, target, tp),
    search: (query, o = {}) => {
      const tokens = normaliseDskpText(query).split(' ').filter(Boolean)
      if (tokens.length === 0) return []
      const q = tokens.join(' ')
      const limit = Math.max(0, o.limit ?? 50)
      const scored: { hit: DskpSearchHit; ordinal: number }[] = []
      for (const e of entries) {
        if (o.tingkatan && e.tingkatan !== o.tingkatan) continue
        if (o.unitId && e.unitId !== o.unitId) continue
        if (o.kinds && !o.kinds.includes(e.hit.kind)) continue
        if (!tokens.every((tok) => e.haystack.includes(tok))) continue
        scored.push({ hit: withScore(e, q, tokens), ordinal: e.ordinal })
      }
      scored.sort((a, b) => b.hit.score - a.hit.score || a.ordinal - b.ordinal)
      return scored.slice(0, limit).map((s) => s.hit)
    },
  }
  return Object.freeze(view)
}

/**
 * Score: exact code 3000 > code prefix 2000 > 1000 x the fraction of query tokens that start a
 * word (all tokens are present, because the search is token-AND). Ties keep print order.
 */
function withScore(e: SearchEntry, q: string, tokens: readonly string[]): DskpSearchHit {
  let score: number
  if (e.code === q) score = 3000
  else if (e.code.startsWith(q)) score = 2000
  else {
    const padded = ` ${e.haystack}`
    const starts = tokens.filter((tok) => padded.includes(` ${tok}`)).length
    score = Math.round((1000 * starts) / tokens.length)
  }
  return { ...e.hit, score }
}

// -----------------------------------------------------------------------------------------------
// Catalogue
// -----------------------------------------------------------------------------------------------

/**
 * Builds a catalogue over the given loaders (code -> raw JSON text of a `DskpSubjectData`). With no
 * `index`, the committed `data/index.json` and `data/version.json` are used. Test seam.
 */
export function createDskpCatalog(
  loaders: Readonly<Record<string, DskpLoader>>,
  index: DskpCatalogIndex = {},
): DskpCatalog {
  let subjects: readonly DskpSubjectInfo[] | undefined
  let version: string | undefined
  const views = new Map<string, DskpSubjectView>()
  const pending = new Map<string, Promise<DskpSubjectView>>()

  const allSubjects = (): readonly DskpSubjectInfo[] => {
    subjects ??= deepFreeze(
      index.subjects
        ? (structuredClone(index.subjects) as DskpSubjectInfo[])
        : (JSON.parse(DSKP_INDEX_TEXT) as DskpSubjectInfo[]),
    )
    return subjects
  }
  const subject = (code: string): DskpSubjectInfo | undefined =>
    allSubjects().find((s) => s.code === code)

  async function loadSubject(code: string, info: DskpSubjectInfo): Promise<DskpSubjectView> {
    const loader = Object.hasOwn(loaders, code) ? loaders[code] : undefined
    if (!loader) throw new DskpLoadError(code, 'no-loader')
    let text: string
    try {
      text = await loader()
    } catch (cause) {
      throw new DskpLoadError(code, 'load-failed', undefined, cause)
    }
    let data: DskpSubjectData
    try {
      data = JSON.parse(text) as DskpSubjectData
    } catch (cause) {
      throw new DskpLoadError(code, 'invalid-data', 'not valid JSON', cause)
    }
    if (data?.code !== code || !Array.isArray(data.units) || !Array.isArray(data.groups)) {
      throw new DskpLoadError(code, 'invalid-data', 'unexpected shape')
    }
    const view = buildSubjectView(info, data)
    views.set(code, view)
    return view
  }

  return {
    get version() {
      version ??= index.version ?? (JSON.parse(DSKP_VERSION_TEXT) as DskpVersionFile).version
      return version
    },
    subjects: allSubjects,
    subject,
    load(code) {
      const cached = pending.get(code)
      if (cached) return cached
      const info = subject(code)
      if (!info) return Promise.reject(new DskpLoadError(code, 'unknown-subject'))
      // A failed load is not cached, so a retry runs the loader again.
      const p = loadSubject(code, info).catch((err: unknown) => {
        pending.delete(code)
        throw err
      })
      pending.set(code, p)
      return p
    },
    loaded: (code) => views.get(code),
  }
}

/** The catalogue of the 13 committed subjects, loaded lazily per subject. */
export const dskpCatalog: DskpCatalog = createDskpCatalog(DSKP_LOADERS)
