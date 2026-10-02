/**
 * F-23 fixture transform (overview §6.9; M02 SRS v1.18 §6.15 A, M18 SRS §6.10, §6.11 A).
 *
 * Reads the M18 discovery snapshot (public school records only) and writes the school-register
 * anchors of the M02 schools dataset:
 *
 *   docs/discovery/inventory/M18/_snapshot-2026-09-26.json
 *     pages['/jpn/dashboard']          "Prestasi GPS" table: the 1,189 Johor schools (id, name)
 *     pages['/ppd/dashboard']          "Prestasi GPS" table: the 118 PPD KLUANG schools (ids)
 *     pages['/ppd/benchmark-sekolah']  "Kedudukan Sekolah": KPM codes of the KLUANG schools
 *     supplement.pages['/kombo/jpn']   the 1,102 Perak schools (id, name)
 *     supplement.pages['/kombo/ppd']   the 122 PPD BATANG PADANG schools (ids)
 *     → src/modules/m02-users-schools/mock/data/schools-register.json
 *
 * Rules:
 * - ids and names as captured (OBSERVED); names are public institution names (CLAUDE.md §6);
 * - codes: KLUANG codes from the benchmark table (OBSERVED), plus the two codes the SRS text gives
 *   (8880 JEB2037, 8953 JHA2001); a benchmark row without a code is stored as `''` (live "Tiada
 *   kod": 8784, 8910); every other anchor has `code: null` and the dataset generates one
 *   (`observed:false`);
 * - type (SK | SMK, the only types live uses, M02 §6.15 A): SMK when the name names a secondary
 *   school (MENENGAH, KOLEJ, MAKTAB, SAM, SMA, SABK, MAAHAD, MADRASAH, BERASRAMA, …), else SK
 *   (INFERRED from the name; SJK(C)/SJK(T) primary schools are type SK, as live BBD4051);
 * - district: PPD KLUANG and PPD BATANG PADANG as observed; the other Johor schools are given the
 *   other 10 Johor PPDs to the observed per-PPD counts of `/jpn/dashboard` (M18 §6.10: "generated
 *   to the observed per-PPD counts", `observed:false`), the other Perak schools the other 11 Perak
 *   PPDs in equal shares (counts not observed). Assignment: a school whose name contains a PPD's
 *   town gets that PPD while it has room, then the rest in ascending id order, PPD by PPD.
 *
 * The script is deterministic and verifies the observed counts before it writes.
 *
 * Run (Node 22): node --experimental-strip-types scripts/fixtures/build-m02-schools.ts
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { format, resolveConfig } from 'prettier'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SNAPSHOT = resolve(ROOT, 'docs/discovery/inventory/M18/_snapshot-2026-09-26.json')
const OUT = resolve(ROOT, 'src/modules/m02-users-schools/mock/data/schools-register.json')

interface Table {
  section: string
  rows: string[][]
}
interface Page {
  tables?: Table[]
}
interface Snapshot {
  pages: Record<string, Page>
  supplement: { pages: Record<string, Page> }
}

const snap = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as Snapshot

function table(page: Page | undefined, section: string): Table {
  const t = page?.tables?.find((x) => x.section.startsWith(section))
  if (!t) throw new Error(`table "${section}" not found`)
  return t
}

function idOf(row: string[], re: RegExp): number {
  const href = row[row.length - 1] ?? ''
  const m = re.exec(href)
  if (!m?.[1]) throw new Error(`no id in ${JSON.stringify(row)}`)
  return Number(m[1])
}

/** Johor PPDs with their observed school counts (M18 §6.10, `/jpn/dashboard`). */
const JOHOR_PPDS: readonly (readonly [string, number])[] = [
  ['PPD BATU PAHAT', 176],
  ['PPD JOHOR BAHRU', 146],
  ['PPD KLUANG', 118],
  ['PPD KOTA TINGGI', 97],
  ['PPD KULAI', 73],
  ['PPD MERSING', 47],
  ['PPD MUAR', 129],
  ['PPD PASIR GUDANG', 112],
  ['PPD PONTIAN', 100],
  ['PPD SEGAMAT', 110],
  ['PPD TANGKAK', 81],
]

/** Perak PPDs (BATANG PADANG observed with 122; the others INFERRED, equal shares of the rest). */
const PERAK_PPDS: readonly string[] = [
  'PPD BAGAN DATUK',
  'PPD BATANG PADANG',
  'PPD HILIR PERAK',
  'PPD HULU PERAK',
  'PPD KERIAN',
  'PPD KINTA SELATAN',
  'PPD KINTA UTARA',
  'PPD KUALA KANGSAR',
  'PPD LARUT MATANG DAN SELAMA',
  'PPD MANJUNG',
  'PPD MUALLIM',
  'PPD PERAK TENGAH',
]

const SMK_RE =
  /MENENGAH|^KOLEJ|^MAKTAB|^SAM\b|^SMA\b|^SABK\b|MAAHAD|MA'AHAD|MADRASAH|BERASRAMA|^SEKOLAH TINGGI|^SEKOLAH SENI|^SEKOLAH SUKAN|^SEKOLAH TUN |^SEKOLAH TUANKU/

function typeOf(name: string): 'SK' | 'SMK' {
  return SMK_RE.test(name) ? 'SMK' : 'SK'
}

/** Largest remainder over equal weights. */
function equalShares(total: number, n: number): number[] {
  const base = Math.floor(total / n)
  return Array.from({ length: n }, (_, i) => base + (i < total - base * n ? 1 : 0))
}

type Entry = [id: number, name: string, code: string | null, district: string, type: 'SK' | 'SMK']

function assignDistricts(
  schools: readonly { id: number; name: string }[],
  capacity: Map<string, number>,
): Map<number, string> {
  const out = new Map<number, string>()
  const left = new Map(capacity)
  const sorted = [...schools].sort((a, b) => a.id - b.id)
  // Pass 1: the PPD town in the school name.
  for (const s of sorted) {
    for (const ppd of left.keys()) {
      const town = ppd.replace(/^PPD /, '')
      if ((left.get(ppd) ?? 0) > 0 && s.name.includes(town)) {
        out.set(s.id, ppd)
        left.set(ppd, (left.get(ppd) ?? 0) - 1)
        break
      }
    }
  }
  // Pass 2: the rest in ascending id order, PPD by PPD.
  const queue = [...left.entries()]
  let qi = 0
  for (const s of sorted) {
    if (out.has(s.id)) continue
    while (qi < queue.length && ((queue[qi] as [string, number])[1] ?? 0) <= 0) qi++
    const slot = queue[qi]
    if (!slot) throw new Error('district capacity exhausted')
    out.set(s.id, slot[0])
    slot[1]--
  }
  if (queue.some(([, n]) => n !== 0)) throw new Error('district capacity not used exactly')
  return out
}

// --- Johor ----------------------------------------------------------------------------------
const johorRows = table(snap.pages['/jpn/dashboard'], 'Prestasi GPS').rows
const johor = johorRows.map((r) => ({ id: idOf(r, /\/jpn\/sekolah\/(\d+)$/), name: r[1] ?? '' }))
const kluangIds = new Set(
  table(snap.pages['/ppd/dashboard'], 'Prestasi GPS').rows.map((r) =>
    idOf(r, /\/sekolah\/(\d+)\/prestasi$/),
  ),
)
const codes = new Map<number, string>([
  [8880, 'JEB2037'],
  [8953, 'JHA2001'],
])
for (const r of table(snap.pages['/ppd/benchmark-sekolah'], 'Kedudukan Sekolah').rows) {
  const id = idOf(r, /\/ppd\/sekolah\/(\d+)$/)
  const m = /\s([A-Z]{3}\d{4})$/.exec(r[1] ?? '')
  // A benchmark row without a trailing code is a school live stores without a code ("Tiada kod").
  if (!codes.has(id)) codes.set(id, m?.[1] ?? '')
}

const johorCap = new Map(JOHOR_PPDS.filter(([p]) => p !== 'PPD KLUANG'))
const johorOther = assignDistricts(
  johor.filter((s) => !kluangIds.has(s.id)),
  johorCap,
)
const johorOut: Entry[] = johor
  .map((s): Entry => [
    s.id,
    s.name,
    kluangIds.has(s.id) ? (codes.get(s.id) ?? null) : null,
    kluangIds.has(s.id) ? 'PPD KLUANG' : (johorOther.get(s.id) as string),
    typeOf(s.name),
  ])
  .sort((a, b) => a[0] - b[0])

// --- Perak ----------------------------------------------------------------------------------
const perakRows = table(snap.supplement.pages['/kombo/jpn'], 'Perbandingan Sekolah').rows
const perak = perakRows.map((r) => ({ id: idOf(r, /\/kombo\/sekolah\/(\d+)$/), name: r[1] ?? '' }))
const bpIds = new Set(
  table(snap.supplement.pages['/kombo/ppd'], 'Perbandingan Sekolah').rows.map((r) =>
    idOf(r, /\/kombo\/sekolah\/(\d+)$/),
  ),
)
const perakOthers = PERAK_PPDS.filter((p) => p !== 'PPD BATANG PADANG')
const shares = equalShares(perak.length - bpIds.size, perakOthers.length)
const perakCap = new Map(perakOthers.map((p, i) => [p, shares[i] as number]))
const perakOther = assignDistricts(
  perak.filter((s) => !bpIds.has(s.id)),
  perakCap,
)
const perakOut: Entry[] = perak
  .map((s): Entry => [
    s.id,
    s.name,
    null,
    bpIds.has(s.id) ? 'PPD BATANG PADANG' : (perakOther.get(s.id) as string),
    typeOf(s.name),
  ])
  .sort((a, b) => a[0] - b[0])

// --- checks (observed counts, M18 §6.10) ----------------------------------------------------
function check(label: string, actual: number, expected: number) {
  if (actual !== expected) throw new Error(`${label}: ${String(actual)} ≠ ${String(expected)}`)
}
check('Johor schools', johorOut.length, 1189)
check('Johor unique ids', new Set(johorOut.map((e) => e[0])).size, 1189)
check('PPD KLUANG', kluangIds.size, 118)
for (const [ppd, n] of JOHOR_PPDS) {
  check(ppd, johorOut.filter((e) => e[3] === ppd).length, n)
}
// 115 observed codes + 2 observed without a code (8784, 8910) + 2710 (not on the benchmark page).
check('KLUANG codes', johorOut.filter((e) => e[3] === 'PPD KLUANG' && e[2]).length, 115)
check('KLUANG code-less', johorOut.filter((e) => e[3] === 'PPD KLUANG' && e[2] === '').length, 2)
check('Perak schools', perakOut.length, 1102)
check('Perak unique ids', new Set(perakOut.map((e) => e[0])).size, 1102)
check('PPD BATANG PADANG', perakOut.filter((e) => e[3] === 'PPD BATANG PADANG').length, 122)
check('Johor ∩ Perak', johorOut.filter((e) => perak.some((p) => p.id === e[0])).length, 0)
check('school 1', perakOut.find((e) => e[0] === 1)?.[3] === 'PPD BATANG PADANG' ? 1 : 0, 1)
check('school 127', perakOut.some((e) => e[0] === 127) ? 1 : 0, 1)

const out = {
  source:
    'docs/discovery/inventory/M18/_snapshot-2026-09-26.json (built by scripts/fixtures/build-m02-schools.ts)',
  columns: ['id', 'name', 'code', 'district', 'type'],
  johor: johorOut,
  perak: perakOut,
}
const config = (await resolveConfig(OUT)) ?? {}
writeFileSync(OUT, await format(JSON.stringify(out), { ...config, filepath: OUT }))
console.log(
  `wrote ${OUT}: Johor ${String(johorOut.length)} (SMK ${String(johorOut.filter((e) => e[4] === 'SMK').length)}), Perak ${String(perakOut.length)} (SMK ${String(perakOut.filter((e) => e[4] === 'SMK').length)})`,
)
