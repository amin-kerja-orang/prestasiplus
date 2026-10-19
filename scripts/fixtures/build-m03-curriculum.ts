/**
 * F-24 fixture transform (overview §6.9, build-plan F-24; M03 SRS v1.8 §6.9, §6.10).
 *
 * Reads the M03 discovery capture and writes the curriculum seed the app imports:
 *
 *   docs/discovery/inventory/M03/_curriculum-data.json   (live capture, 2026-09-25)
 *   docs/qa/audit/M03-audit.md  Appendix A                (subtopic names of the legacy topics with > 3 subtopics)
 *   docs/discovery/M03-curriculum.md  Appendix B.6        (Peta Belajar island emoji, where observed)
 *     → src/modules/m03-curriculum/mock/data/curriculum.json
 *
 * Rules applied (SRS §6.9):
 * - levels (11) and subjects (31) as captured, live ids; `order` = id; level `grade` = id; subject
 *   `icon_raw` → `icon` (empty → null); the 194 subject × level links from `education_level_ids`;
 * - tree (194 pairs): "Bab {n}: {name}" → `chapterNumber` n + `name`; "Topik {x}: {name}" →
 *   `topicNumber` x + `name`; descriptions and subtopics as captured; `createdSeq` = dataset order;
 * - DV-M03-09 (a): per tree, chapter numbers ≥ 100 are renumbered consecutively after the highest
 *   number < 100 of that tree, in stored order; (b) in every chapter whose topic numbers repeat, the
 *   topics are renumbered "1"…"n" in stored order;
 * - out-of-tree chapters (v1.10, XL3-24): 60 records `inTree = false` (subject 14 × 56, 27 × 3,
 *   28 × 1), ids 1282–1341, every field but `subjectId` null (designed, never displayed);
 * - ids: the 38 named tree records keep their live ids (SRS §6.9 (a)–(c)); every other chapter,
 *   topic and subtopic gets the next free integer in dataset order, skipping the kept ids;
 * - known extra values: chapter 91 `nameEn`, topic 126 `nameEn`;
 * - legacy topics (125): live ids, `sequence` = dataset order, subject label → code (" " → "_");
 *   subtopic names from `subtopics_preview`, topic 7's fourth name and audit Appendix A; the
 *   observed subtopic descriptions (topics 4, 68, 69, 103); `icon` only where Appendix B.6 shows it;
 *   legacy subtopic ids in catalogue order (topic `sequence`, then subtopic order).
 *
 * The script is deterministic and verifies the SRS §6.10 golden counts before it writes.
 *
 * Run (Node 22): node --experimental-strip-types scripts/fixtures/build-m03-curriculum.ts
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { format, resolveConfig } from 'prettier'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SOURCE = 'docs/discovery/inventory/M03/_curriculum-data.json'
const AUDIT = 'docs/qa/audit/M03-audit.md'
const DISCOVERY = 'docs/discovery/M03-curriculum.md'
const OUTPUT = 'src/modules/m03-curriculum/mock/data/curriculum.json'

// ---------------------------------------------------------------------------------------------
// Source shapes (discovery capture)
// ---------------------------------------------------------------------------------------------

interface RawLevel {
  id: number
  code: string
  name: string
  name_en: string
  stage: string
  curriculum: string
  is_active: boolean
}

interface RawSubject {
  id: number
  code: string
  name: string
  name_en: string
  color: string
  icon_raw: string
  is_core: boolean
  education_level_ids: number[]
  is_active: boolean
}

interface RawSubtopic {
  name: string
  name_en: string | null
  learning_objective: string | null
}

interface RawTopic {
  title: string
  description: string | null
  subtopics: RawSubtopic[]
}

interface RawChapter {
  title: string
  description: string | null
  topics: RawTopic[]
}

interface RawPair {
  subject_id: number
  subject_code: string
  level_id: number
  level_code: string
  stats: { chapters: number; topics: number; subtopics: number }
  chapters: RawChapter[]
}

interface RawLegacyTopic {
  id: number
  grade_level: string
  name: string
  subject: string
  description?: string | null
  subtopic_count: number
  subtopics_preview: string[]
}

interface RawData {
  source: string
  educationLevels: RawLevel[]
  subjects: RawSubject[]
  totals: {
    combos: number
    withChapters: number
    chapters: number
    topics: number
    subtopics: number
  }
  byLevel: Record<string, { chapters: number; topics: number; subtopics: number }>
  bySubject: Record<string, { chapters: number; topics: number; subtopics: number }>
  tree: RawPair[]
  legacyTopics: RawLegacyTopic[]
}

// ---------------------------------------------------------------------------------------------
// Output shapes (src/modules/m03-curriculum/mock/data/curriculum.json)
// ---------------------------------------------------------------------------------------------

interface OutLevel {
  id: number
  code: string
  name: string
  nameEn: string
  stage: string
  curriculum: string
  order: number
  grade: number
  isActive: boolean
}

interface OutSubject {
  id: number
  code: string
  name: string
  nameEn: string
  icon: string | null
  color: string
  isCore: boolean
  order: number
  isActive: boolean
}

interface OutChapter {
  id: number
  subjectId: number
  /** `null` only for out-of-tree chapters (XL3-24, designed). */
  educationLevelId: number | null
  /** `null` only for out-of-tree chapters (title not observed). */
  name: string | null
  nameEn: string | null
  chapterNumber: number | null
  description: string | null
  /** `false` only for the 60 out-of-tree chapters (SRS v1.10 §6.9). */
  inTree: boolean
  createdSeq: number
}

interface OutTopic {
  id: number
  chapterId: number
  name: string
  nameEn: string | null
  topicNumber: string | null
  description: string | null
  learningStandard: string | null
  createdSeq: number
}

interface OutSubtopic {
  id: number
  topicId: number
  name: string
  nameEn: string | null
  learningObjective: string | null
  createdSeq: number
}

interface OutLegacyTopic {
  id: number
  gradeLevel: string
  subject: string
  name: string
  description: string | null
  icon: string | null
  sequence: number
}

interface OutLegacySubtopic {
  id: number
  legacyTopicId: number
  name: string
  description: string | null
  order: number
}

// ---------------------------------------------------------------------------------------------
// Kept live ids (SRS v1.9 §6.9 (a)–(c): 31 chapters, 4 topics, 3 subtopics = 38 named records)
// ---------------------------------------------------------------------------------------------

/** [subject code, level code, captured chapter title, live id] */
const KEPT_CHAPTERS: readonly (readonly [string, string, string, number])[] = [
  // (a) opened in M03
  ['BM', 'D1', 'Bab 1: Kemahiran Mendengar dan Bertutur', 35],
  ['BM', 'D1', 'Bab 2: Kemahiran Membaca', 36],
  ['MATH', 'T4', 'Bab 1: Fungsi dan Persamaan Kuadratik', 91],
  ['MATH', 'T4', 'Bab 2: Asas Nombor', 92],
  // (b) observed on the M05 chapter pages
  ['MATH', 'D1', 'Bab 1: Nombor Bulat hingga 100', 1],
  ['MATH', 'D2', 'Bab 1: Nombor Bulat hingga 1000', 3],
  ['SCI', 'D1', 'Bab 1: Sains Hayat', 18],
  ['BI', 'D1', 'Bab 1: Listening and Speaking', 57],
  ['PI', 'D1', 'Bab 1: Akidah D1', 120],
  ['PM', 'D1', 'Bab 1: Nilai Diri D1', 142],
  ['SEJ', 'D1', 'Bab 1: Asas Sejarah D1', 164],
  ['GEO', 'D1', 'Bab 1: Asas Geografi D1', 179],
  ['BA', 'D1', 'Bab 1: Kemahiran Mendengar dan Bertutur (الاستماع والتحدث)', 263],
  ['JAWI', 'D1', 'Bab 1: Mengenal Huruf Jawi', 325],
  // (c) observed in the M10 chapter selects
  ['PERNIAGA', 'T5', 'Bab 1: Pengurusan dan Kepimpinan', 258],
  ['PERNIAGA', 'T5', 'Bab 2: Kewangan Perniagaan', 259],
  ['PERNIAGA', 'T5', 'Bab 3: Pemasaran (Lanjutan)', 260],
  ['PERNIAGA', 'T5', 'Bab 4: Perniagaan Antarabangsa', 261],
  ['PERNIAGA', 'T5', 'Bab 5: Etika dan Tanggungjawab Sosial', 262],
  ['PERNIAGA', 'T5', 'Bab 6: Persediaan Memulakan Perniagaan', 1280],
  ['PERNIAGA', 'T5', 'Bab 7: Merancang Pengendalian Perniagaan', 1281],
  ['BM', 'T5', 'Bab 99: Kemahiran Bahasa Tingkatan 5', 413],
  ['SCI', 'T5', 'Bab 1: Dunia mikroorganisma', 362],
  ['SCI', 'T5', 'Bab 2: Diet seimbang dan nilai kalori', 363],
  ['SCI', 'T5', 'Bab 3: Kelestarian Alam Sekitar', 347],
  ['SCI', 'T5', 'Bab 4: Aplikasi kadar tindak balas', 364],
  ['SCI', 'T5', 'Bab 5: Alkohol', 365],
  ['SCI', 'T5', 'Bab 6: Sel elektrolisis', 366],
  ['SCI', 'T5', 'Bab 7: Alat optik', 367],
  ['SCI', 'T5', 'Bab 8: Tekanan dalam bendalir', 368],
  ['SCI', 'T5', 'Bab 9: Satelit', 369],
]

/** [chapter live id, captured topic title, live id] */
const KEPT_TOPICS: readonly (readonly [number, string, number])[] = [
  [35, 'Topik 1: Mendengar dan Memahami', 59],
  [36, 'Topik 1: Membaca Perkataan', 60],
  [91, 'Topik 1: Fungsi', 126],
  [91, 'Topik 2: Persamaan kuadratik', 127],
]

/** [topic live id, subtopic name, live id] */
const KEPT_SUBTOPICS: readonly (readonly [number, string, number])[] = [
  [59, 'Mendengar sebutan dan intonasi', 132],
  [59, 'Bertutur untuk menyatakan permintaan', 133],
  [60, 'Mengenal huruf dan suku kata', 134],
]

/**
 * Out-of-tree chapters (SRS v1.10 §6.9, §6.10; XL3-24, M17 XR-M17-19): [subjectId, count] in id
 * order. Pendidikan Muzik 56, Pendidikan Syariah Islamiah 3, Sains Rumah Tangga 1 — ids 1282–1341.
 */
const OUT_OF_TREE_CHAPTERS: readonly (readonly [number, number])[] = [
  [14, 56],
  [27, 3],
  [28, 1],
]
const OUT_OF_TREE_FIRST_ID = 1282

/** Known extra values (SRS §6.9 "Tree"). */
const CHAPTER_NAME_EN: Readonly<Record<number, string>> = {
  91: 'Functions and Quadratic Equations',
}
const TOPIC_NAME_EN: Readonly<Record<number, string>> = { 126: 'Functions' }

/** Topic 7's fourth subtopic (SRS §6.9 "Legacy topics"). */
const TOPIC_7_EXTRA = 'Menulis Nombor dalam Perkataan'

/** Observed legacy subtopic descriptions (SRS §6.9, audit AUD-M03-18): topic id → per position. */
const LEGACY_SUBTOPIC_DESCRIPTIONS: Readonly<Record<number, readonly (string | null)[]>> = {
  4: [
    'Mengenal haiwan peliharaan seperti kucing, anjing',
    'Mengenal haiwan liar seperti harimau, gajah',
  ],
  68: ['Kemahiran Bahasa Melayu SPM Tingkatan 5 berdasarkan DSKP KSSM'],
  69: ['Membaca dan mentafsir peta', 'Rujukan grid'],
  103: ['SK 4.6 Sains Tingkatan 4'],
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

function fail(message: string): never {
  throw new Error(`build-m03-curriculum: ${message}`)
}

function check(condition: boolean, message: string): void {
  if (!condition) fail(message)
}

function read(path: string): string {
  return readFileSync(resolve(ROOT, path), 'utf8')
}

function nullIfEmpty(value: string | null | undefined): string | null {
  return value === undefined || value === null || value === '' ? null : value
}

const CHAPTER_TITLE = /^Bab (\d+): (.*)$/s
const TOPIC_TITLE = /^Topik ([^:]+): (.*)$/s

/** Allocates ids in dataset order, skipping the kept (reserved) ids. */
function allocator(reserved: ReadonlySet<number>) {
  let next = 1
  return () => {
    while (reserved.has(next)) next++
    return next++
  }
}

/** Audit Appendix A: topic id → subtopic names. */
function appendixA(markdown: string): Map<number, string[]> {
  const start = markdown.indexOf('## Appendix A')
  check(start >= 0, `${AUDIT}: Appendix A not found`)
  const end = markdown.indexOf('\n## ', start + 5)
  const section = markdown.slice(start, end < 0 ? undefined : end)
  const out = new Map<number, string[]>()
  for (const line of section.split('\n')) {
    const m = /^\| (\d+) \| (.+) \|$/.exec(line.trim())
    if (!m) continue
    out.set(
      Number(m[1]),
      (m[2] as string).split(';').map((s) => s.trim()),
    )
  }
  return out
}

/** Discovery Appendix B.6: legacy topic id → observed island emoji (unlocked islands only). */
function appendixB6(markdown: string): Map<number, string> {
  const start = markdown.indexOf('### B.6')
  check(start >= 0, `${DISCOVERY}: Appendix B.6 not found`)
  const end = markdown.indexOf('\n---', start)
  const section = markdown.slice(start, end < 0 ? undefined : end)
  const out = new Map<number, string>()
  const re = /unlocked:[^:]+:(\S+):\/practice\?topic_id=(\d+)/g
  for (const m of section.matchAll(re)) {
    const id = Number(m[2])
    const icon = m[1] as string
    const prev = out.get(id)
    check(prev === undefined || prev === icon, `B.6: topic ${String(id)} has two icons`)
    out.set(id, icon)
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------------------------

export interface CurriculumFixture {
  source: string
  generatedBy: string
  levels: OutLevel[]
  subjects: OutSubject[]
  /** `[subjectId, educationLevelId]`, in `subjects[].education_level_ids` order. */
  subjectLevels: [number, number][]
  chapters: OutChapter[]
  topics: OutTopic[]
  subtopics: OutSubtopic[]
  legacyTopics: OutLegacyTopic[]
  legacySubtopics: OutLegacySubtopic[]
}

export interface TransformReport {
  renumberedChapters: number
  renumberedTrees: string[]
  chaptersWithRepeatedTopicNumbers: number
  repeatedTopicNumbers: number
  renumberedTopics: number
}

export function transform(
  data: RawData,
  audit: string,
  discovery: string,
): { fixture: CurriculumFixture; report: TransformReport } {
  // Levels and subjects (live ids).
  const levels: OutLevel[] = data.educationLevels.map((l) => ({
    id: l.id,
    code: l.code,
    name: l.name,
    nameEn: l.name_en,
    stage: l.stage,
    curriculum: l.curriculum,
    order: l.id,
    grade: l.id,
    isActive: l.is_active,
  }))
  const subjects: OutSubject[] = data.subjects.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    nameEn: s.name_en,
    icon: nullIfEmpty(s.icon_raw),
    color: s.color,
    isCore: s.is_core,
    order: s.id,
    isActive: s.is_active,
  }))
  const subjectLevels: [number, number][] = data.subjects.flatMap((s) =>
    s.education_level_ids.map((l): [number, number] => [s.id, l]),
  )

  // Kept ids.
  const keptChapter = new Map<string, number>()
  for (const [s, l, title, id] of KEPT_CHAPTERS) keptChapter.set(`${s}|${l}|${title}`, id)
  const keptTopic = new Map<string, number>()
  for (const [ch, title, id] of KEPT_TOPICS) keptTopic.set(`${String(ch)}|${title}`, id)
  const keptSubtopic = new Map<string, number>()
  for (const [tp, name, id] of KEPT_SUBTOPICS) keptSubtopic.set(`${String(tp)}|${name}`, id)
  const nextChapterId = allocator(new Set(keptChapter.values()))
  const nextTopicId = allocator(new Set(keptTopic.values()))
  const nextSubtopicId = allocator(new Set(keptSubtopic.values()))
  const usedChapter = new Set<number>()
  const usedTopic = new Set<number>()
  const usedSubtopic = new Set<number>()

  const chapters: OutChapter[] = []
  const topics: OutTopic[] = []
  const subtopics: OutSubtopic[] = []
  const report: TransformReport = {
    renumberedChapters: 0,
    renumberedTrees: [],
    chaptersWithRepeatedTopicNumbers: 0,
    repeatedTopicNumbers: 0,
    renumberedTopics: 0,
  }

  for (const pair of data.tree) {
    // DV-M03-09 (a): chapter numbers ≥ 100 → after the tree's highest genuine number.
    const parsed = pair.chapters.map((c) => {
      const m = CHAPTER_TITLE.exec(c.title)
      if (!m)
        fail(
          `chapter title without "Bab n: " in ${pair.subject_code} ${pair.level_code}: ${c.title}`,
        )
      return { raw: c, number: Number(m[1]), name: m[2] as string }
    })
    const genuine = parsed.map((c) => c.number).filter((n) => n < 100)
    let nextNumber = (genuine.length > 0 ? Math.max(...genuine) : 0) + 1
    let renumberedHere = 0
    for (const c of parsed) {
      if (c.number >= 100) {
        c.number = nextNumber++
        renumberedHere++
      }
    }
    if (renumberedHere > 0) {
      report.renumberedChapters += renumberedHere
      report.renumberedTrees.push(`${pair.subject_code} ${pair.level_code}`)
    }

    for (const c of parsed) {
      const key = `${pair.subject_code}|${pair.level_code}|${c.raw.title}`
      const kept = keptChapter.get(key)
      const chapterId = kept ?? nextChapterId()
      check(!usedChapter.has(chapterId), `chapter id ${String(chapterId)} used twice`)
      usedChapter.add(chapterId)
      chapters.push({
        id: chapterId,
        subjectId: pair.subject_id,
        educationLevelId: pair.level_id,
        name: c.name,
        nameEn: CHAPTER_NAME_EN[chapterId] ?? null,
        chapterNumber: c.number,
        description: nullIfEmpty(c.raw.description),
        inTree: true,
        createdSeq: chapters.length + 1,
      })

      // DV-M03-09 (b): repeated topic numbers inside the chapter → "1"…"n" in stored order.
      const parsedTopics = c.raw.topics.map((t) => {
        const m = TOPIC_TITLE.exec(t.title)
        if (!m)
          fail(`topic title without "Topik x: " under chapter ${String(chapterId)}: ${t.title}`)
        return { raw: t, number: (m[1] as string).trim(), name: m[2] as string }
      })
      const distinct = new Set(parsedTopics.map((t) => t.number))
      const repeats = parsedTopics.length - distinct.size
      if (repeats > 0) {
        report.chaptersWithRepeatedTopicNumbers++
        report.repeatedTopicNumbers += repeats
        report.renumberedTopics += parsedTopics.length
        parsedTopics.forEach((t, i) => {
          t.number = String(i + 1)
        })
      }

      for (const t of parsedTopics) {
        const keptT = keptTopic.get(`${String(chapterId)}|${t.raw.title}`)
        const topicId = keptT ?? nextTopicId()
        check(!usedTopic.has(topicId), `topic id ${String(topicId)} used twice`)
        usedTopic.add(topicId)
        topics.push({
          id: topicId,
          chapterId,
          name: t.name,
          nameEn: TOPIC_NAME_EN[topicId] ?? null,
          topicNumber: t.number,
          description: nullIfEmpty(t.raw.description),
          learningStandard: null,
          createdSeq: topics.length + 1,
        })
        for (const s of t.raw.subtopics) {
          const keptS = keptSubtopic.get(`${String(topicId)}|${s.name}`)
          const subtopicId = keptS ?? nextSubtopicId()
          check(!usedSubtopic.has(subtopicId), `subtopic id ${String(subtopicId)} used twice`)
          usedSubtopic.add(subtopicId)
          subtopics.push({
            id: subtopicId,
            topicId,
            name: s.name,
            nameEn: nullIfEmpty(s.name_en),
            learningObjective: nullIfEmpty(s.learning_objective),
            createdSeq: subtopics.length + 1,
          })
        }
      }
    }
  }

  // Out-of-tree chapters (SRS v1.10 §6.9, XL3-24): observed only as per-subject counts (M17 S10);
  // every field but `subjectId` is designed. Ids follow the highest tree id, in subject order.
  let orphanId = Math.max(...chapters.map((c) => c.id)) + 1
  check(orphanId === OUT_OF_TREE_FIRST_ID, `out-of-tree ids start at ${String(orphanId)}`)
  for (const [subjectId, count] of OUT_OF_TREE_CHAPTERS) {
    for (let i = 0; i < count; i++) {
      chapters.push({
        id: orphanId++,
        subjectId,
        educationLevelId: null,
        name: null,
        nameEn: null,
        chapterNumber: null,
        description: null,
        inTree: false,
        createdSeq: chapters.length + 1,
      })
    }
  }

  // Every kept id was found.
  for (const [s, l, title, id] of KEPT_CHAPTERS) {
    check(
      usedChapter.has(id),
      `kept chapter ${String(id)} (${s} ${l} "${title}") not in the capture`,
    )
  }
  for (const [, title, id] of KEPT_TOPICS) {
    check(usedTopic.has(id), `kept topic ${String(id)} ("${title}") not in the capture`)
  }
  for (const [, name, id] of KEPT_SUBTOPICS) {
    check(usedSubtopic.has(id), `kept subtopic ${String(id)} ("${name}") not in the capture`)
  }

  // Legacy catalogue.
  const namesA = appendixA(audit)
  const icons = appendixB6(discovery)
  const legacyTopics: OutLegacyTopic[] = data.legacyTopics.map((t, i) => ({
    id: t.id,
    gradeLevel: t.grade_level,
    subject: t.subject.replace(/ /g, '_'),
    name: t.name,
    description: nullIfEmpty(t.description),
    icon: icons.get(t.id) ?? null,
    sequence: i + 1,
  }))
  for (const id of icons.keys()) {
    check(
      legacyTopics.some((t) => t.id === id),
      `B.6 icon for unknown topic ${String(id)}`,
    )
  }
  const legacySubtopics: OutLegacySubtopic[] = []
  for (const t of data.legacyTopics) {
    let names: string[]
    if (t.subtopic_count <= 3) names = [...t.subtopics_preview]
    else if (t.id === 7) names = [...t.subtopics_preview, TOPIC_7_EXTRA]
    else {
      const fromAudit = namesA.get(t.id)
      if (!fromAudit)
        fail(
          `legacy topic ${String(t.id)} has ${String(t.subtopic_count)} subtopics but no Appendix A row`,
        )
      names = fromAudit
      check(
        t.subtopics_preview.every((n, i) => names[i] === n),
        `Appendix A names of topic ${String(t.id)} disagree with subtopics_preview`,
      )
    }
    check(
      names.length === t.subtopic_count,
      `legacy topic ${String(t.id)}: ${String(names.length)} names for subtopic_count ${String(t.subtopic_count)}`,
    )
    const descriptions = LEGACY_SUBTOPIC_DESCRIPTIONS[t.id] ?? []
    check(
      descriptions.length <= names.length,
      `descriptions of topic ${String(t.id)} exceed its subtopics`,
    )
    names.forEach((name, i) => {
      legacySubtopics.push({
        id: legacySubtopics.length + 1,
        legacyTopicId: t.id,
        name,
        description: descriptions[i] ?? null,
        order: i + 1,
      })
    })
  }
  for (const id of namesA.keys()) {
    check(
      data.legacyTopics.some((t) => t.id === id && t.subtopic_count > 3),
      `Appendix A row for topic ${String(id)} is not a topic with > 3 subtopics`,
    )
  }

  const fixture: CurriculumFixture = {
    source: `${SOURCE} (${data.source}); ${AUDIT} Appendix A; ${DISCOVERY} Appendix B.6`,
    generatedBy: 'scripts/fixtures/build-m03-curriculum.ts (F-24)',
    levels,
    subjects,
    subjectLevels,
    chapters,
    topics,
    subtopics,
    legacyTopics,
    legacySubtopics,
  }
  verify(data, fixture, report)
  return { fixture, report }
}

/** SRS §6.10 golden counts. */
function verify(data: RawData, f: CurriculumFixture, report: TransformReport): void {
  const eq = (actual: number, expected: number, what: string) =>
    check(actual === expected, `${what}: ${String(actual)}, expected ${String(expected)}`)
  eq(f.levels.length, 11, 'levels')
  eq(f.subjects.length, 31, 'subjects')
  eq(f.subjectLevels.length, 194, 'subject × level links')
  eq(f.subjectLevels.length, data.totals.combos, 'links vs totals.combos')
  eq(data.tree.length, 194, 'tree pairs')
  eq(data.tree.filter((p) => p.chapters.length > 0).length, 140, 'pairs with chapters')
  const tree = f.chapters.filter((c) => c.inTree)
  const orphans = f.chapters.filter((c) => !c.inTree)
  eq(tree.length, 1251, 'tree chapters')
  eq(orphans.length, 60, 'out-of-tree chapters')
  eq(f.chapters.length, 1311, 'chapters incl. out-of-tree')
  eq(Math.min(...orphans.map((c) => c.id)), 1282, 'first out-of-tree id')
  eq(Math.max(...orphans.map((c) => c.id)), 1341, 'last out-of-tree id')
  eq(f.topics.length, 2423, 'topics')
  eq(f.subtopics.length, 234, 'subtopics')
  eq(f.legacyTopics.length, 125, 'legacy topics')
  eq(f.legacySubtopics.length, 335, 'legacy subtopics')
  eq(f.subjects.filter((s) => s.isCore).length, 7, 'core subjects')
  eq(report.renumberedChapters, 334, 'DV-M03-09 (a) renumbered chapters')
  eq(report.renumberedTrees.length, 11, 'DV-M03-09 (a) trees')
  eq(report.chaptersWithRepeatedTopicNumbers, 102, 'DV-M03-09 (b) chapters')
  check(
    tree.every((c) => c.chapterNumber !== null && c.chapterNumber < 100),
    'a chapter number ≥ 100 is left',
  )
  const maxChapterId = Math.max(...tree.map((c) => c.id))
  eq(maxChapterId, 1281, 'highest chapter id')
  eq(Math.max(...f.topics.map((t) => t.id)), 2423, 'highest topic id')
  eq(Math.max(...f.subtopics.map((s) => s.id)), 234, 'highest subtopic id')

  // Per-level and per-subject counts of the capture.
  const levelCode = new Map(f.levels.map((l) => [l.id, l.code]))
  const subjectCode = new Map(f.subjects.map((s) => [s.id, s.code]))
  const chapterOf = new Map(f.chapters.map((c) => [c.id, c]))
  const topicOf = new Map(f.topics.map((t) => [t.id, t]))
  const tally = (key: (c: OutChapter) => string) => {
    const out = new Map<string, { chapters: number; topics: number; subtopics: number }>()
    const get = (k: string) => {
      let v = out.get(k)
      if (!v) out.set(k, (v = { chapters: 0, topics: 0, subtopics: 0 }))
      return v
    }
    for (const c of tree) get(key(c)).chapters++
    for (const t of f.topics) get(key(chapterOf.get(t.chapterId) as OutChapter)).topics++
    for (const s of f.subtopics) {
      const t = topicOf.get(s.topicId) as OutTopic
      get(key(chapterOf.get(t.chapterId) as OutChapter)).subtopics++
    }
    return out
  }
  const byLevel = tally((c) => levelCode.get(c.educationLevelId ?? 0) as string)
  for (const [code, v] of Object.entries(data.byLevel)) {
    const got = byLevel.get(code) ?? { chapters: 0, topics: 0, subtopics: 0 }
    check(
      JSON.stringify(got) === JSON.stringify(v),
      `byLevel ${code}: ${JSON.stringify(got)} vs ${JSON.stringify(v)}`,
    )
  }
  const bySubject = tally((c) => subjectCode.get(c.subjectId) as string)
  for (const [code, v] of Object.entries(data.bySubject)) {
    const got = bySubject.get(code) ?? { chapters: 0, topics: 0, subtopics: 0 }
    check(
      JSON.stringify(got) === JSON.stringify(v),
      `bySubject ${code}: ${JSON.stringify(got)} vs ${JSON.stringify(v)}`,
    )
  }
}

async function main(): Promise<void> {
  const data = JSON.parse(read(SOURCE)) as RawData
  const { fixture, report } = transform(data, read(AUDIT), read(DISCOVERY))
  // Formatted as the repo Prettier config does, so `prettier --check` stays clean after a re-run.
  const out = resolve(ROOT, OUTPUT)
  const config = (await resolveConfig(out)) ?? {}
  const text = await format(JSON.stringify(fixture, null, 2), { ...config, filepath: out })
  writeFileSync(out, text, 'utf8')
  console.log(`wrote ${OUTPUT}`)
  console.log(
    `levels ${String(fixture.levels.length)}, subjects ${String(fixture.subjects.length)}, links ${String(fixture.subjectLevels.length)}, chapters ${String(fixture.chapters.length)}, topics ${String(fixture.topics.length)}, subtopics ${String(fixture.subtopics.length)}, legacy topics ${String(fixture.legacyTopics.length)}, legacy subtopics ${String(fixture.legacySubtopics.length)}`,
  )
  console.log(
    `DV-M03-09 (a): ${String(report.renumberedChapters)} chapters renumbered in ${String(report.renumberedTrees.length)} trees (${report.renumberedTrees.join(', ')})`,
  )
  console.log(
    `DV-M03-09 (b): ${String(report.chaptersWithRepeatedTopicNumbers)} chapters with repeated topic numbers (${String(report.repeatedTopicNumbers)} repeats; ${String(report.renumberedTopics)} topics renumbered)`,
  )
}

await main()
