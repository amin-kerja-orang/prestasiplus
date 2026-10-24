/**
 * Reference data transforms (BE-28, v2-data-migration.md 6.1 step 1): education levels, subjects, chapters,
 * topics, subject-level pairs, schools and the JPN / PPD rows derived from the schools' free-text
 * state and district (plan 14.7 T-09). Pure functions; the loader resolves ids and writes.
 */
import {
  DEFAULT_SUBJECT_COLOR,
  JPN_CODES,
  SCHOOL_TYPE_MAP,
  SCHOOL_TYPE_SOURCE_CODES,
  STAGE_MAP,
  STAGE_SOURCE_CODES,
} from './enums'
import { enumKey, flag, integer, ok, reject, squash, stamps, text, type Outcome, type Staged } from './common'

// ---------------------------------------------------------------- education levels

export interface LevelValues {
  code: string
  name: string
  name_en: string
  stage: string
  curriculum: string
  sort_order: number
  grade: number | null
  created_at: string
  updated_at: string
}

/** What the seeded row (reference data of BE-08) already holds, adopted by code. */
export interface ExistingLevel {
  grade: number | null
}

/**
 * The v2 code of a level. .cloud has no code column: `Darjah N` / `Tahun N` give `DN`, `Tingkatan N` /
 * `Form N` give `TN` and the grade (1..6, 7..11). Any other name keeps a surrogate `LVL<id>` code (admin
 * can rename it) and a null grade. The rule is documented, not a guess: the name is the only source.
 */
export function levelIdentity(nameBm: string, id: string): { code: string; grade: number | null } {
  const primary = /^(?:darjah|tahun)\s*(\d)$/i.exec(nameBm.trim())
  if (primary && Number(primary[1]) >= 1 && Number(primary[1]) <= 6) {
    return { code: `D${primary[1]}`, grade: Number(primary[1]) }
  }
  const secondary = /^(?:tingkatan|form)\s*(\d)$/i.exec(nameBm.trim())
  if (secondary && Number(secondary[1]) >= 1 && Number(secondary[1]) <= 5) {
    return { code: `T${secondary[1]}`, grade: 6 + Number(secondary[1]) }
  }
  return { code: `LVL${id}`, grade: null }
}

export function transformLevel(row: Staged, existing?: ExistingLevel): Outcome<LevelValues> {
  const name = squash(row.name_bm)
  if (name === null) return reject('INVALID_VALUE', 'name_bm')
  const stageKey = enumKey(row.stage)
  const stage = stageKey === null ? undefined : STAGE_MAP[stageKey]
  if (stage === undefined) {
    return reject('UNKNOWN_ENUM', 'stage', { enumValue: row.stage ?? '', allowedCodes: STAGE_SOURCE_CODES })
  }
  const curriculum = text(row.curriculum)?.toUpperCase() ?? null
  if (curriculum === null) return reject('INVALID_VALUE', 'curriculum')
  const sort = integer(row.sort_order)
  if (sort === 'invalid') return reject('INVALID_VALUE', 'sort_order')
  const { code, grade } = levelIdentity(name, row.id ?? '')
  return ok({
    code,
    name,
    name_en: squash(row.name_en) ?? name,
    stage,
    curriculum,
    sort_order: sort ?? 0,
    grade: grade ?? existing?.grade ?? null,
    ...stamps(row),
  })
}

// ---------------------------------------------------------------- subjects

export interface SubjectValues {
  code: string
  name: string
  name_en: string
  color: string
  is_core: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

/**
 * The seeded row adopted by code keeps its English name and colour (.cloud has no colour; its `name_en` only fills
 * a subject that has no seeded row).
 */
export interface ExistingSubject {
  name_en: string
  color: string
}

export function transformSubject(row: Staged, existing?: ExistingSubject): Outcome<SubjectValues> {
  const name = squash(row.name_bm)
  if (name === null) return reject('INVALID_VALUE', 'name_bm')
  const core = flag(row.is_core, false)
  if (core === 'invalid') return reject('INVALID_VALUE', 'is_core')
  const sort = integer(row.sort_order)
  if (sort === 'invalid') return reject('INVALID_VALUE', 'sort_order')
  const code = (text(row.code)?.toUpperCase() ?? `SUBJ${row.id ?? ''}`).replace(/\s+/g, '_')
  const color = text(row.color)
  return ok({
    code,
    name,
    name_en: existing?.name_en ?? squash(row.name_en) ?? name,
    color: color !== null && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : (existing?.color ?? DEFAULT_SUBJECT_COLOR),
    is_core: core,
    sort_order: sort ?? 0,
    ...stamps(row),
  })
}

// ---------------------------------------------------------------- chapters and topics

export interface ChapterValues {
  subject_id: string
  education_level_id: string | null
  name: string | null
  chapter_number: number | null
  strand: string | null
  dskp_code: string | null
  in_tree: boolean
  created_at: string
  updated_at: string
}

/** Parent ids are already resolved to v2 ids (`undefined` = the source id was set but its parent is not loaded). */
export function transformChapter(
  row: Staged,
  parents: { subjectId: string | null | undefined; levelId: string | null | undefined },
): Outcome<ChapterValues> {
  if (parents.subjectId === null || parents.subjectId === undefined) return reject('ORPHAN_PARENT', 'subject_id')
  if (parents.levelId === undefined) return reject('ORPHAN_PARENT', 'education_level_id')
  const number = integer(row.number)
  if (number === 'invalid') return reject('INVALID_VALUE', 'number')
  const name = squash(row.title)
  return ok({
    subject_id: parents.subjectId,
    education_level_id: parents.levelId,
    name,
    chapter_number: number,
    strand: text(row.strand),
    dskp_code: text(row.dskp_code),
    // Only the rows the checks allow are in the tree (a name and a level); the rest are the out-of-tree rows.
    in_tree: name !== null && parents.levelId !== null,
    ...stamps(row),
  })
}

export interface TopicValues {
  chapter_id: string
  name: string
  sort_order: number | null
  created_at: string
  updated_at: string
}

export function transformTopic(row: Staged, parents: { chapterId: string | null | undefined }): Outcome<TopicValues> {
  if (parents.chapterId === null || parents.chapterId === undefined) return reject('ORPHAN_PARENT', 'chapter_id')
  const name = squash(row.name)
  if (name === null) return reject('INVALID_VALUE', 'name')
  const sort = integer(row.sort_order)
  if (sort === 'invalid') return reject('INVALID_VALUE', 'sort_order')
  return ok({ chapter_id: parents.chapterId, name, sort_order: sort, ...stamps(row) })
}

// ---------------------------------------------------------------- geography (JPN / PPD)

export interface GeoPair {
  state: string | null
  district: string | null
  /** Number of schools with this exact (squashed) spelling. */
  n: number
}

export interface JpnRow {
  /** Legacy id: the upper-case normalised state. */
  key: string
  code: string
  name: string
}

export interface PpdRow {
  /** Legacy id: `<state key>|<district key>`. */
  key: string
  jpnKey: string
  code: string
  /** The canonical district spelling (what `schools.district` and a PPD officer's scope hold). */
  district: string
  name: string
}

export interface Geo {
  jpns: JpnRow[]
  ppds: PpdRow[]
  jpnByKey: ReadonlyMap<string, JpnRow>
  ppdByKey: ReadonlyMap<string, PpdRow>
}

const upperKey = (v: string): string => v.toUpperCase()

/** "PPD JOHOR BAHRU" -> "PPD Johor Bahru"; a value without the prefix is kept as is (same as the core schools seed). */
export function ppdName(code: string): string {
  return code.replace(/^(PPD|PPW|JPN)\b(.*)$/, (_m, p: string, rest: string) => {
    const words = rest.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return [p, ...words.map((w) => w.charAt(0).toUpperCase() + w.slice(1))].join(' ')
  })
}

/** The most frequent spelling of each case-insensitive group; ties go to the smallest string. */
function canonical(spellings: Map<string, number>): string {
  let best = ''
  let bestN = -1
  for (const [spelling, n] of [...spellings].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (n > bestN) {
      best = spelling
      bestN = n
    }
  }
  return best
}

/**
 * JPN per distinct state and PPD per distinct (state, district), after normalising spelling variants
 * (case and whitespace). Output is sorted by key, so a run is deterministic. A district name that is used
 * by two states keeps its plain name in the state whose key sorts first and gets ` (<JPN code>)` in the
 * others, because `ppds.code` is unique platform-wide.
 */
export function buildGeo(pairs: readonly GeoPair[]): Geo {
  const states = new Map<string, Map<string, number>>()
  const districts = new Map<string, { stateKey: string; spellings: Map<string, number> }>()
  for (const p of pairs) {
    const state = squash(p.state)
    if (state === null) continue
    const stateKey = upperKey(state)
    const spellings = states.get(stateKey) ?? new Map<string, number>()
    spellings.set(state, (spellings.get(state) ?? 0) + p.n)
    states.set(stateKey, spellings)
    const district = squash(p.district)
    if (district === null) continue
    const key = `${stateKey}|${upperKey(district)}`
    const d = districts.get(key) ?? { stateKey, spellings: new Map<string, number>() }
    d.spellings.set(district, (d.spellings.get(district) ?? 0) + p.n)
    districts.set(key, d)
  }
  const jpns: JpnRow[] = [...states.keys()]
    .sort()
    .map((key) => ({ key, name: canonical(states.get(key) as Map<string, number>), code: JPN_CODES[key] ?? key }))
  const jpnCode = new Map(jpns.map((j) => [j.key, j.code]))
  const usedCodes = new Set<string>()
  const ppds: PpdRow[] = []
  for (const key of [...districts.keys()].sort()) {
    const d = districts.get(key) as { stateKey: string; spellings: Map<string, number> }
    const district = canonical(d.spellings)
    const code = usedCodes.has(upperKey(district)) ? `${district} (${jpnCode.get(d.stateKey) as string})` : district
    usedCodes.add(upperKey(district))
    ppds.push({ key, jpnKey: d.stateKey, code, district, name: ppdName(code) })
  }
  return {
    jpns,
    ppds,
    jpnByKey: new Map(jpns.map((j) => [j.key, j])),
    ppdByKey: new Map(ppds.map((p) => [p.key, p])),
  }
}

/** The (state key, district key) of a school and the canonical spellings, from a built `Geo`. */
export function geoOf(
  geo: Geo,
  state: string | null | undefined,
  district: string | null | undefined,
): { jpn: JpnRow | null; ppd: PpdRow | null } {
  const s = squash(state)
  if (s === null) return { jpn: null, ppd: null }
  const stateKey = upperKey(s)
  const jpn = geo.jpnByKey.get(stateKey) ?? null
  const d = squash(district)
  const ppd = d === null ? null : (geo.ppdByKey.get(`${stateKey}|${upperKey(d)}`) ?? null)
  return { jpn, ppd }
}

// ---------------------------------------------------------------- schools

export interface SchoolValues {
  name: string
  code: string | null
  type: string | null
  state: string | null
  district: string | null
  jpn_id: string | null
  ppd_id: string | null
  join_code: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export function transformSchool(
  row: Staged,
  geo: { jpnId: string | null; ppdId: string | null; stateName: string | null; districtName: string | null },
): Outcome<SchoolValues> {
  const name = squash(row.name)
  if (name === null) return reject('INVALID_VALUE', 'name')
  const typeKey = enumKey(row.type)
  let type: string | null = null
  if (typeKey !== null) {
    type = SCHOOL_TYPE_MAP[typeKey] ?? null
    if (type === null) return reject('UNKNOWN_ENUM', 'type', { enumValue: row.type ?? '', allowedCodes: SCHOOL_TYPE_SOURCE_CODES })
  }
  const active = flag(row.is_active, true)
  if (active === 'invalid') return reject('INVALID_VALUE', 'is_active')
  return ok({
    name,
    code: text(row.code),
    type,
    state: geo.stateName,
    district: geo.districtName,
    jpn_id: geo.jpnId,
    ppd_id: geo.ppdId,
    join_code: text(row.join_code),
    is_active: active,
    ...stamps(row),
  })
}
