/**
 * Sector filter of `migrate:verify` (KP-22: the V2 clone is staged and loaded one sector at a time). A staged run names the entities (or a
 * sector) it loaded; only those entities' checks run and decide the exit code, everything else is reported as "not in this stage". The
 * default (no filter) is the full run, unchanged.
 */
import { ENTITY_MATRIX } from './entities'

export const SECTORS = ['core', 'questions', 'structured', 'papers', 'terbit', 'activity'] as const
export type Sector = (typeof SECTORS)[number]

const CORE = [
  'education_levels', 'subjects', 'chapters', 'topics', 'subject_levels', 'jpns', 'ppds', 'schools', 'users', 'parent_links', 'classrooms', 'enrolments',
  'school_subscriptions',
]
const QUESTIONS = ['questions', 'question_stimuli', 'stimulus_groups', 'question_files']
const STRUCTURED = ['structured_questions', 'subjective_questions', 'exam_questions', 'pksk_questions']
const PAPERS = ['spm_sets', 'paper_blueprints', 'exam_papers', 'paper_documents', 'paper_document_pages']
/** The Terbit pass publishes the loaded V2 papers: it has no entity of its own, its rows are the `exam_papers` placements. */
const TERBIT = ['exam_papers']
const STANDALONE = new Set([...QUESTIONS, ...STRUCTURED, ...PAPERS])

/** The matrix entities of a sector (activity = every matrix entity that is neither core nor a standalone bank/paper entity). */
export function sectorEntities(sector: Sector): string[] {
  switch (sector) {
    case 'core':
      return CORE
    case 'questions':
      return QUESTIONS
    case 'structured':
      return STRUCTURED
    case 'papers':
      return PAPERS
    case 'terbit':
      return TERBIT
    case 'activity':
      return ENTITY_MATRIX.map((m) => m.entity).filter((n) => !CORE.includes(n) && !STANDALONE.has(n))
  }
}

/** The sectors that contain at least one of the entities. */
export function sectorsOf(entities: ReadonlySet<string>): Set<Sector> {
  return new Set(SECTORS.filter((s) => sectorEntities(s).some((e) => entities.has(e))))
}

/** Which sectors each semantic check belongs to. A check with no row here is treated as in every stage (it runs and decides). */
export const CHECK_SECTORS: Readonly<Record<string, readonly Sector[]>> = {
  'users per role per school': ['core'],
  geography: ['core'],
  'answers per subject': ['activity'],
  ledger: ['activity'],
  'correct answers': ['activity'],
  orphans: ['core', 'activity'],
  'derived counts': ['core', 'activity'],
  'accepted drift': ['core', 'activity'],
  'questions accounting': ['questions', 'structured'],
  'stimulus groups': ['questions', 'structured', 'papers'],
  'stimulus groups versus V2': ['questions', 'structured', 'papers'],
  'question pictures': ['questions'],
  'PKSK questions': ['structured'],
  'loader rejects': ['questions', 'structured', 'papers', 'terbit'],
}

/** The entity list a `--entities` and/or `--sector` filter names (null = the full run). Unknown names are a usage error (RangeError). */
export function stageEntities(entities: readonly string[] | undefined, sector: string | undefined): string[] | null {
  if (entities === undefined && sector === undefined) return null
  const names = new Set<string>()
  const known = new Set(ENTITY_MATRIX.map((m) => m.entity))
  for (const raw of entities ?? []) {
    const n = raw.trim()
    if (n === '') continue
    if (!known.has(n)) throw new RangeError(`unknown entity "${n}" (see verify/entities.ts)`)
    names.add(n)
  }
  if (sector !== undefined) {
    for (const raw of sector.split(',')) {
      const s = raw.trim()
      if (!(SECTORS as readonly string[]).includes(s)) throw new RangeError(`unknown sector "${s}" (one of ${SECTORS.join(', ')})`)
      for (const e of sectorEntities(s as Sector)) names.add(e)
    }
  }
  if (names.size === 0) throw new RangeError('--entities / --sector name no entity')
  return [...names]
}
