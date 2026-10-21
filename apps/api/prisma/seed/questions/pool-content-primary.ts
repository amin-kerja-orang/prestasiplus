/**
 * Content of the PoC primary question pool (Darjah 1 to 4): published single-part MCQs per subject and level so the
 * practice "random" mode, the games picker, the solo games and Jutawan Ilmu have data for pupils in Darjah 1 to 4.
 *
 * Same style as `pool-content.ts`: generic, age-appropriate content written for this seed (computed exercises whose key
 * is computed, so it is correct by construction, and small fact tables turned into questions in both directions). No
 * exam paper text, no person names, no brand names. Pure functions of the level: no randomness, no clock.
 *
 * Subjects: BM, BI, MATH and SCI, the subjects the primary demo shows. BM and BI are asked in their own language,
 * MATH and SCI in Bahasa Melayu.
 */
import { numeric, oneWay, table, type PoolItem } from './pool-content'

export type PrimarySubject = 'BM' | 'BI' | 'MATH' | 'SCI'
export type PrimaryLevel = 'D1' | 'D2' | 'D3' | 'D4'

export const PRIMARY_SUBJECTS: readonly PrimarySubject[] = ['BM', 'BI', 'MATH', 'SCI']
export const PRIMARY_LEVELS: readonly PrimaryLevel[] = ['D1', 'D2', 'D3', 'D4']

/**
 * Questions per subject and level: above the largest practice draw (20) and, over the 4 subjects, 96 per level against
 * the biggest solo game draw (Betul atau Salah, 40 items).
 */
export const PRIMARY_PER_LEVEL = 24

/** Wrong values near the key, never negative: the key's neighbours, rotated by `slot` so the slips vary. */
function near(right: number): number[] {
  return [right + 1, right - 1, right + 2, right - 2, right + 10, right - 10, right + 3, right + 4].filter((n) => n >= 0 && n !== right)
}
const rotate = (list: readonly number[], by: number): number[] => list.map((_, i) => list[(i + by) % list.length] as number)

/** A whole-number question with computed neighbours as slips (non-negative). */
function whole(text: string, right: number, slot: number, fmt?: (n: number) => string, extra: readonly number[] = []): PoolItem {
  return numeric(text, right, [...extra, ...rotate(near(right), slot)], slot, fmt)
}

// --------------------------------------------------------------------------------------------------------------------
// Matematik
// --------------------------------------------------------------------------------------------------------------------

function mathD1(): PoolItem[] {
  const out: PoolItem[] = []
  const adds = [[3, 4], [5, 2], [6, 3], [7, 5], [8, 4], [9, 6], [10, 7], [12, 5]] as const
  adds.forEach(([a, b], i) => out.push(whole(`Berapakah ${a} + ${b}?`, a + b, i)))
  const subs = [[9, 4], [8, 3], [12, 5], [15, 6], [14, 9], [18, 7], [20, 8], [16, 10]] as const
  subs.forEach(([a, b], i) => out.push(whole(`Berapakah ${a} − ${b}?`, a - b, i + 1)))
  ;[19, 39, 54, 79].forEach((n, i) => out.push(whole(`Nombor selepas ${n} ialah`, n + 1, i + 2)))
  ;([[5, 3], [6, 2], [7, 4], [9, 5]] as const).forEach(([a, b], i) =>
    out.push(whole(`Adik ada ${a} biji epal. Dia diberi ${b} biji epal lagi. Berapakah jumlah epal adik sekarang?`, a + b, i + 3)),
  )
  return out
}

function mathD2(): PoolItem[] {
  const out: PoolItem[] = []
  ;([[23, 15], [34, 26], [47, 18], [52, 29], [65, 27], [38, 45]] as const).forEach(([a, b], i) => out.push(whole(`Berapakah ${a} + ${b}?`, a + b, i)))
  ;([[48, 23], [75, 38], [62, 17], [90, 45], [83, 29], [56, 28]] as const).forEach(([a, b], i) => out.push(whole(`Berapakah ${a} − ${b}?`, a - b, i + 1)))
  ;([[2, 6], [2, 8], [5, 4], [5, 7], [10, 6], [10, 9]] as const).forEach(([a, b], i) => out.push(whole(`Berapakah ${a} × ${b}?`, a * b, i + 2)))
  ;([[482, 8, 80], [615, 6, 600], [739, 3, 30]] as const).forEach(([n, d, v], i) =>
    out.push(numeric(`Berapakah nilai digit ${d} dalam nombor ${n}?`, v, [d, d * 10, d * 100, d * 1000], i + 3)),
  )
  ;([[4, 5], [3, 10], [6, 2]] as const).forEach(([a, b], i) =>
    out.push(whole(`Terdapat ${a} buah kotak. Setiap kotak mengandungi ${b} biji limau. Berapakah jumlah limau?`, a * b, i)),
  )
  return out
}

function mathD3(): PoolItem[] {
  const out: PoolItem[] = []
  ;([[3, 7], [4, 8], [6, 6], [7, 5], [8, 9], [9, 6]] as const).forEach(([a, b], i) => out.push(whole(`Berapakah ${a} × ${b}?`, a * b, i)))
  ;([[24, 4], [45, 5], [56, 7], [63, 9]] as const).forEach(([a, b], i) => out.push(whole(`Berapakah ${a} ÷ ${b}?`, a / b, i + 1)))
  ;([[235, 148], [407, 256], [582, 319], [624, 277]] as const).forEach(([a, b], i) => out.push(whole(`Berapakah ${a} + ${b}?`, a + b, i + 2)))
  ;([[500, 238], [734, 189], [920, 455], [681, 347]] as const).forEach(([a, b], i) => out.push(whole(`Berapakah ${a} − ${b}?`, a - b, i + 3)))
  ;([[12, 5], [8, 7], [15, 9]] as const).forEach(([a, b], i) =>
    out.push(whole(`Sebuah buku berharga RM${a} dan sebatang pen berharga RM${b}. Berapakah jumlah harganya?`, a + b, i, (n) => `RM${n}`)),
  )
  ;[2, 3, 5].forEach((h, i) => out.push(whole(`Berapakah bilangan minit dalam ${h} jam?`, h * 60, i + 1, undefined, [h * 10, h * 100, h * 24])))
  return out
}

function mathD4(): PoolItem[] {
  const out: PoolItem[] = []
  ;([[23, 4], [35, 6], [48, 5], [62, 7]] as const).forEach(([a, b], i) => out.push(whole(`Berapakah ${a} × ${b}?`, a * b, i)))
  ;([[96, 8], [84, 7], [125, 5], [132, 6]] as const).forEach(([a, b], i) => out.push(whole(`Berapakah ${a} ÷ ${b}?`, a / b, i + 1)))
  ;([[2345, 1678], [4506, 2894], [3718, 4285], [5062, 3949]] as const).forEach(([a, b], i) => out.push(whole(`Berapakah ${a} + ${b}?`, a + b, i + 2)))
  ;([[5000, 2376], [7241, 3865], [6000, 1458], [9100, 4327]] as const).forEach(([a, b], i) => out.push(whole(`Berapakah ${a} − ${b}?`, a - b, i + 3)))
  ;([[8, 5], [12, 7], [15, 9], [20, 6]] as const).forEach(([p, l], i) =>
    out.push(
      whole(`Sebuah segi empat tepat berukuran panjang ${p} cm dan lebar ${l} cm. Cari perimeternya.`, 2 * (p + l), i, (n) => `${n} cm`, [p * l, p + l, 2 * p + l]),
    ),
  )
  ;([[7, 6], [9, 8], [12, 5], [15, 4]] as const).forEach(([p, l], i) =>
    out.push(
      whole(`Sebuah segi empat tepat berukuran panjang ${p} cm dan lebar ${l} cm. Cari luasnya.`, p * l, i + 1, (n) => `${n} cm²`, [2 * (p + l), p + l, p * l + p]),
    ),
  )
  return out
}

// --------------------------------------------------------------------------------------------------------------------
// Bahasa Melayu
// --------------------------------------------------------------------------------------------------------------------

function bmD1(): PoolItem[] {
  const words: [string, string][] = [
    ['ayam', 'A'], ['bola', 'B'], ['cawan', 'C'], ['dadu', 'D'], ['epal', 'E'], ['gajah', 'G'],
    ['harimau', 'H'], ['itik', 'I'], ['jam', 'J'], ['kucing', 'K'], ['lembu', 'L'], ['meja', 'M'],
  ]
  return table(words, (w) => `Apakah huruf pertama bagi perkataan '${w}'?`, (l) => `Perkataan manakah bermula dengan huruf '${l}'?`)
}

function bmD2(): PoolItem[] {
  const antonyms: [string, string][] = [
    ['besar', 'kecil'], ['panas', 'sejuk'], ['siang', 'malam'], ['naik', 'turun'], ['atas', 'bawah'], ['buka', 'tutup'],
    ['masuk', 'keluar'], ['baru', 'lama'], ['jauh', 'dekat'], ['gemuk', 'kurus'], ['kenyang', 'lapar'], ['basah', 'kering'],
  ]
  return table(antonyms, (a) => `Apakah lawan kata bagi perkataan '${a}'?`, (b) => `Perkataan '${b}' ialah lawan kata bagi perkataan`)
}

function bmD3(): PoolItem[] {
  const base = ['buku', 'murid', 'kereta', 'bunga', 'rumah', 'kucing', 'pokok', 'meja', 'kerusi', 'burung', 'ikan', 'anak']
  const rows: [string, string][] = base.map((w) => [w, `${w}-${w}`])
  return table(rows, (w) => `Apakah kata ganda bagi perkataan '${w}'?`, (g) => `'${g}' ialah kata ganda bagi perkataan`)
}

function bmD4(): PoolItem[] {
  const synonyms: [string, string][] = [
    ['pandai', 'bijak'], ['rajin', 'tekun'], ['cepat', 'laju'], ['gembira', 'riang'], ['sedih', 'pilu'], ['takut', 'gerun'],
    ['marah', 'berang'], ['letih', 'penat'], ['bising', 'riuh'], ['cantik', 'indah'], ['murid', 'pelajar'], ['hadiah', 'ganjaran'],
  ]
  return table(synonyms, (a) => `Apakah sinonim bagi perkataan '${a}'?`, (b) => `Perkataan '${b}' ialah sinonim bagi perkataan`)
}

// --------------------------------------------------------------------------------------------------------------------
// Bahasa Inggeris
// --------------------------------------------------------------------------------------------------------------------

function biD1(): PoolItem[] {
  const numbers: [string, string][] = [
    ['1', 'one'], ['2', 'two'], ['3', 'three'], ['4', 'four'], ['5', 'five'], ['6', 'six'],
    ['7', 'seven'], ['8', 'eight'], ['9', 'nine'], ['10', 'ten'], ['11', 'eleven'], ['12', 'twelve'],
  ]
  return table(numbers, (n) => `How do you spell the number ${n}?`, (w) => `Which number is written as '${w}'?`)
}

function biD2(): PoolItem[] {
  const opposites: [string, string][] = [
    ['big', 'small'], ['hot', 'cold'], ['up', 'down'], ['open', 'close'], ['day', 'night'], ['fast', 'slow'],
    ['happy', 'sad'], ['old', 'new'], ['long', 'short'], ['full', 'empty'], ['near', 'far'], ['clean', 'dirty'],
  ]
  return table(opposites, (a) => `What is the opposite of '${a}'?`, (b) => `'${b}' is the opposite of`)
}

function biD3(): PoolItem[] {
  const plurals: [string, string][] = [
    ['child', 'children'], ['man', 'men'], ['foot', 'feet'], ['mouse', 'mice'], ['tooth', 'teeth'], ['box', 'boxes'],
    ['bus', 'buses'], ['baby', 'babies'], ['leaf', 'leaves'], ['knife', 'knives'], ['woman', 'women'], ['dish', 'dishes'],
  ]
  return table(plurals, (s) => `What is the plural of '${s}'?`, (p) => `'${p}' is the plural of`)
}

function biD4(): PoolItem[] {
  const verbs: [string, string][] = [
    ['come', 'came'], ['sit', 'sat'], ['ride', 'rode'], ['fly', 'flew'], ['draw', 'drew'], ['make', 'made'],
    ['find', 'found'], ['sleep', 'slept'], ['wear', 'wore'], ['know', 'knew'], ['throw', 'threw'], ['catch', 'caught'],
  ]
  return table(verbs, (v) => `What is the past tense of the verb '${v}'?`, (p) => `'${p}' is the past tense of which verb?`)
}

// --------------------------------------------------------------------------------------------------------------------
// Sains
// --------------------------------------------------------------------------------------------------------------------

function sciD1(): PoolItem[] {
  const parts: [string, string][] = [
    ['mata', 'melihat'], ['telinga', 'mendengar'], ['hidung', 'menghidu'], ['lidah', 'merasa'], ['kulit', 'merasai panas dan sejuk'],
    ['tangan', 'memegang'], ['kaki', 'berjalan'], ['gigi', 'mengunyah'], ['mulut', 'bercakap'], ['otak', 'berfikir'],
    ['paru-paru', 'bernafas'], ['jantung', 'mengepam darah'],
  ]
  return table(parts, (a) => `Apakah fungsi ${a}?`, (b) => `Anggota badan manakah berfungsi untuk ${b}?`)
}

function sciD2(): PoolItem[] {
  const out: PoolItem[] = []
  const covers: [string, string][] = [
    ['ayam', 'bulu'], ['ikan', 'sisik'], ['siput', 'cangkerang'], ['katak', 'kulit licin'], ['burung', 'bulu'], ['ular', 'sisik'],
    ['kura-kura', 'cangkerang'], ['itik', 'bulu'], ['ikan keli', 'kulit licin'], ['ikan kerisi', 'sisik'], ['ketam', 'cangkerang'], ['udang', 'cangkerang'],
  ]
  out.push(...oneWay(covers, (a) => `Apakah penutup badan bagi ${a}?`, ['bulu', 'sisik', 'cangkerang', 'kulit licin']))
  const plant: [string, string][] = [
    ['akar', 'menyerap air dan garam mineral'], ['batang', 'menyokong tumbuhan'], ['daun', 'membuat makanan'],
    ['bunga', 'menghasilkan buah dan biji'], ['buah', 'melindungi biji'], ['biji', 'tumbuh menjadi tumbuhan baharu'],
  ]
  out.push(...table(plant, (a) => `Apakah fungsi ${a} pada tumbuhan?`, (b) => `Bahagian tumbuhan manakah yang berfungsi untuk ${b}?`, 1))
  return out
}

function sciD3(): PoolItem[] {
  const materials: [string, string][] = [
    ['tingkap', 'kaca'], ['tayar', 'getah'], ['meja', 'kayu'], ['botol air mineral', 'plastik'], ['buku', 'kertas'], ['paku', 'besi'],
    ['baju', 'kain'], ['pinggan', 'seramik'], ['tali pinggang', 'kulit'], ['periuk', 'aluminium'], ['wayar elektrik', 'kuprum'], ['bakul', 'rotan'],
  ]
  return table(
    materials,
    (o) => `Bahan apakah yang biasa digunakan untuk membuat ${o}?`,
    (m) => `Antara berikut, yang manakah biasa dibuat daripada ${m}?`,
  )
}

function sciD4(): PoolItem[] {
  const out: PoolItem[] = []
  const planets: [string, string][] = [
    ['pertama', 'Utarid'], ['kedua', 'Zuhrah'], ['ketiga', 'Bumi'], ['keempat', 'Marikh'],
    ['kelima', 'Musytari'], ['keenam', 'Zuhal'], ['ketujuh', 'Uranus'], ['kelapan', 'Neptun'],
  ]
  out.push(...table(planets, (n) => `Planet manakah yang ${n} paling dekat dengan Matahari?`, (p) => `${p} ialah planet yang ke berapa paling dekat dengan Matahari?`))
  const diet: [string, string][] = [
    ['kambing', 'herbivor'], ['lembu', 'herbivor'], ['arnab', 'herbivor'], ['singa', 'karnivor'],
    ['harimau', 'karnivor'], ['helang', 'karnivor'], ['ayam', 'omnivor'], ['tikus', 'omnivor'],
  ]
  out.push(...oneWay(diet, (a) => `Berdasarkan makanannya, ${a} ialah haiwan`, ['herbivor', 'karnivor', 'omnivor', 'detritivor'], 1))
  return out
}

// --------------------------------------------------------------------------------------------------------------------

const BANKS: Record<PrimarySubject, Record<PrimaryLevel, () => PoolItem[]>> = {
  BM: { D1: bmD1, D2: bmD2, D3: bmD3, D4: bmD4 },
  BI: { D1: biD1, D2: biD2, D3: biD3, D4: biD4 },
  MATH: { D1: mathD1, D2: mathD2, D3: mathD3, D4: mathD4 },
  SCI: { D1: sciD1, D2: sciD2, D3: sciD3, D4: sciD4 },
}

/** Every item a bank defines for a subject and level (may exceed PRIMARY_PER_LEVEL). */
export function primaryBank(subject: PrimarySubject, level: PrimaryLevel): PoolItem[] {
  return BANKS[subject][level]()
}

/** The PRIMARY_PER_LEVEL items seeded for a subject and level, in seed order. */
export function primaryItems(subject: PrimarySubject, level: PrimaryLevel): PoolItem[] {
  const bank = primaryBank(subject, level)
  if (bank.length < PRIMARY_PER_LEVEL) throw new Error(`primary pool: ${subject} ${level} defines ${bank.length} items, needs ${PRIMARY_PER_LEVEL}`)
  return bank.slice(0, PRIMARY_PER_LEVEL)
}

/** Natural key (`question_versions.number_label`) of item `index` (0-based). Prefix `SEED-PRIM-`, apart from `SEED-POOL-`. */
export const primaryRef = (subject: PrimarySubject, level: PrimaryLevel, index: number): string =>
  `SEED-PRIM-${subject}-${level}-${String(index + 1).padStart(2, '0')}`
