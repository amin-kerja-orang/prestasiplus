/**
 * Content of the PoC question pool at Darjah 1 to 4 (AZ-02, demo 23 Oct): published single-part MCQs per subject and
 * level so practice `random` (BR-11 offers D1 to D4 only, `practice/rules.ts` OFFERED_LEVEL_CODES), Jutawan Ilmu and
 * the five solo games (they draw by the pupil's level; Kad Memori draws over D1 to D4) find questions.
 *
 * Same rules as `pool-content.ts`: generic, curriculum-plausible content written for this seed (computed exercises
 * whose key is computed, and small fact tables asked in both directions). No exam paper text, no .cloud bank content,
 * no person names. Pure functions of the level: no randomness, no clock.
 *
 * The solo games serve MCQs only and derive their items from them (Betul atau Salah: question + an option as a
 * statement; Cabaran Kilat and Tembak Jawapan: the four options; Susun Jawapan: the key, scrambled, when it is at most
 * 20 characters; Kad Memori: question and key as a pair), so every item here is a four-option MCQ and most keys are short.
 */
import { item, numeric, oneWay, table, type PoolItem } from './pool-content'

/** Subjects of the primary pool: the pool subjects (`POOL_SUBJECTS`) that the curriculum links to Darjah 1 to 4. */
export type PrimarySubject = 'BM' | 'BI' | 'MATH' | 'SCI' | 'SEJ' | 'PI' | 'PM' | 'PSV'
export type PrimaryLevel = 'D1' | 'D2' | 'D3' | 'D4'

export const PRIMARY_SUBJECTS: readonly PrimarySubject[] = ['BM', 'BI', 'MATH', 'SCI', 'SEJ', 'PI', 'PM', 'PSV']
/** Equal to `OFFERED_LEVEL_CODES` of `src/modules/practice/rules.ts` (pinned by test/seed/question-pool.spec.ts). */
export const PRIMARY_LEVELS: readonly PrimaryLevel[] = ['D1', 'D2', 'D3', 'D4']

/**
 * Questions per subject and level. Same margin as the Tingkatan pool: the largest consumer minimum at one subject
 * and level is a practice session of 20; Jutawan needs 15 (4/4/4/3 over TP 1 to 4). Per level (all subjects) the
 * largest solo draw is Betul atau Salah (40) and Susun Jawapan (20 short keys out of a 160-question sample).
 */
export const PRIMARY_PER_LEVEL = 24

// --------------------------------------------------------------------------------------------------------------------
// Matematik (computed: the key is correct by construction)
// --------------------------------------------------------------------------------------------------------------------

function mathD1(): PoolItem[] {
  const out: PoolItem[] = []
  for (const [i, [a, b]] of ([[2, 3], [4, 5], [6, 2], [7, 1], [3, 6], [8, 2]] as const).entries()) {
    out.push(numeric(`Berapakah ${a} + ${b}?`, a + b, [a + b + 1, a + b - 1, a + b + 2], i))
  }
  for (const [i, [a, b]] of ([[9, 4], [8, 3], [10, 6], [7, 5], [6, 1], [10, 2]] as const).entries()) {
    out.push(numeric(`Berapakah ${a} − ${b}?`, a - b, [a + b, a - b + 1, a - b - 1], i + 1))
  }
  for (const [i, n] of [4, 7, 11, 15, 18, 9].entries()) {
    out.push(numeric(`Nombor manakah yang datang selepas ${n}?`, n + 1, [n - 1, n + 2, n], i + 2))
  }
  for (const [i, set] of ([[3, 8, 5, 1], [12, 7, 9, 4], [6, 14, 10, 2], [17, 11, 13, 5], [20, 16, 19, 8], [15, 9, 18, 12]] as const).entries()) {
    const max = Math.max(...set)
    const wrong = set.filter((x) => x !== max).map(String) as [string, string, string]
    out.push(item(`Antara nombor ${set.join(', ')}, yang manakah paling besar?`, String(max), wrong, i + 3))
  }
  return out
}

function mathD2(): PoolItem[] {
  const out: PoolItem[] = []
  for (const [i, [a, b]] of ([[23, 14], [35, 22], [41, 36], [17, 28], [56, 33], [62, 29]] as const).entries()) {
    out.push(numeric(`Berapakah ${a} + ${b}?`, a + b, [a + b + 10, a + b - 1, a + b + 1], i))
  }
  for (const [i, [a, b]] of ([[48, 23], [75, 41], [90, 36], [63, 27], [84, 52], [57, 19]] as const).entries()) {
    out.push(numeric(`Berapakah ${a} − ${b}?`, a - b, [a - b + 10, a - b - 1, a + b], i + 1))
  }
  for (const [i, [a, b]] of ([[2, 6], [5, 4], [10, 3], [2, 9], [5, 7], [10, 8]] as const).entries()) {
    out.push(numeric(`Berapakah ${a} × ${b}?`, a * b, [a + b, a * b + a, a * b - b], i + 2))
  }
  for (const [i, [a, b]] of ([[50, 20], [30, 40], [10, 50], [20, 60], [40, 40], [70, 20]] as const).entries()) {
    out.push(numeric(`Jumlahkan ${a} sen dan ${b} sen.`, a + b, [a + b + 10, a + b - 10, a * 2], i + 3, (n) => `${n} sen`))
  }
  return out
}

function mathD3(): PoolItem[] {
  const out: PoolItem[] = []
  for (const [i, [a, b]] of ([[245, 132], [318, 471], [506, 283], [127, 364], [439, 250], [612, 175]] as const).entries()) {
    out.push(numeric(`Berapakah ${a} + ${b}?`, a + b, [a + b + 100, a + b - 10, a + b + 1], i))
  }
  for (const [i, [a, b]] of ([[3, 7], [4, 8], [6, 6], [7, 9], [8, 4], [9, 3]] as const).entries()) {
    out.push(numeric(`Berapakah ${a} × ${b}?`, a * b, [a + b, a * b + a, a * b - b], i + 1))
  }
  for (const [i, [q, d]] of ([[6, 3], [8, 4], [7, 5], [9, 6], [4, 9], [5, 7]] as const).entries()) {
    out.push(numeric(`Berapakah ${q * d} ÷ ${d}?`, q, [q + 1, q - 1, d], i + 2))
  }
  for (const [i, [n, d]] of ([[8, 2], [12, 3], [20, 4], [15, 5], [18, 2], [24, 3]] as const).entries()) {
    const part = d === 2 ? 'satu perdua' : d === 3 ? 'satu pertiga' : d === 4 ? 'satu perempat' : 'satu perlima'
    out.push(numeric(`Berapakah ${part} daripada ${n}?`, n / d, [n, n / d + 1, n - n / d], i + 3))
  }
  return out
}

function mathD4(): PoolItem[] {
  const out: PoolItem[] = []
  for (const [i, [a, b]] of ([[23, 4], [36, 3], [47, 2], [52, 6], [18, 7], [65, 5]] as const).entries()) {
    out.push(numeric(`Berapakah ${a} × ${b}?`, a * b, [a * b + b, a * b - 10, a + b], i))
  }
  for (const [i, [q, d]] of ([[42, 3], [56, 4], [35, 6], [73, 5], [29, 8], [64, 7]] as const).entries()) {
    out.push(numeric(`Berapakah ${q * d} ÷ ${d}?`, q, [q + 1, q - 1, q + 10], i + 1))
  }
  for (const [i, h] of [2, 3, 4, 5, 6, 8].entries()) {
    out.push(numeric(`${h} jam bersamaan dengan berapa minit?`, h * 60, [h * 100, h * 30, h * 60 + 10], i + 2, (n) => `${n} minit`))
  }
  for (const [i, s] of [4, 6, 7, 9, 12, 15].entries()) {
    out.push(numeric(`Sebuah segi empat sama mempunyai sisi ${s} cm. Hitung perimeternya.`, 4 * s, [s * s, 2 * s, 4 * s + 4], i + 3, (n) => `${n} cm`))
  }
  return out
}

// --------------------------------------------------------------------------------------------------------------------
// Bahasa Melayu
// --------------------------------------------------------------------------------------------------------------------

function bmD1(): PoolItem[] {
  const antonyms: [string, string][] = [
    ['besar', 'kecil'], ['panjang', 'pendek'], ['panas', 'sejuk'], ['siang', 'malam'], ['naik', 'turun'], ['buka', 'tutup'],
    ['masuk', 'keluar'], ['berat', 'ringan'], ['cepat', 'lambat'], ['tebal', 'nipis'], ['gemuk', 'kurus'], ['kaya', 'miskin'],
  ]
  return table(antonyms, (a) => `Apakah antonim bagi perkataan '${a}'?`, (b) => `Perkataan '${b}' ialah antonim bagi`)
}

function bmD2(): PoolItem[] {
  const synonyms: [string, string][] = [
    ['cantik', 'indah'], ['gembira', 'riang'], ['pandai', 'bijak'], ['marah', 'berang'], ['takut', 'gentar'], ['laju', 'pantas'],
    ['kawan', 'sahabat'], ['rumah', 'kediaman'], ['bercakap', 'bertutur'], ['mula', 'awal'], ['senyap', 'sunyi'], ['kotor', 'cemar'],
  ]
  return table(synonyms, (a) => `Apakah sinonim bagi perkataan '${a}'?`, (b) => `Perkataan '${b}' mempunyai maksud yang sama dengan`)
}

function bmD3(): PoolItem[] {
  const out: PoolItem[] = []
  const counters: [string, string][] = [
    ['kucing', 'seekor'], ['kereta', 'sebuah'], ['pensel', 'sebatang'], ['kertas', 'sehelai'], ['bola', 'sebiji'], ['buku', 'sebuah'],
    ['burung', 'seekor'], ['pokok', 'sepohon'], ['baju', 'sehelai'], ['epal', 'sebiji'], ['jalan', 'sebatang'], ['rumah', 'sebuah'],
  ]
  const asks = oneWay(counters, (n) => `Apakah penjodoh bilangan yang sesuai bagi '${n}'?`, ['seekor', 'sebuah', 'sebatang', 'sehelai', 'sebiji', 'sepohon'])
  // 'sebatang pokok' is also acceptable BM, so 'pokok' gets a fixed distractor set without 'sebatang' (key stays at the same slot).
  const pokok = counters.findIndex(([n]) => n === 'pokok')
  asks[pokok] = item(`Apakah penjodoh bilangan yang sesuai bagi 'pokok'?`, 'sepohon', ['seekor', 'sebuah', 'sehelai'], pokok)
  out.push(...asks)
  const genders: [string, string][] = [
    ['lelaki', 'perempuan'], ['abang', 'kakak'], ['bapa', 'ibu'], ['datuk', 'nenek'], ['raja', 'permaisuri'], ['putera', 'puteri'],
  ]
  out.push(...table(genders, (a) => `Apakah pasangan perempuan bagi perkataan '${a}'?`, (b) => `Perkataan '${b}' ialah pasangan perempuan bagi`, 1))
  return out
}

function bmD4(): PoolItem[] {
  const idioms: [string, string][] = [
    ['ringan tulang', 'rajin'], ['berat tulang', 'malas'], ['buah hati', 'orang yang disayangi'], ['panjang tangan', 'suka mencuri'],
    ['kaki bangku', 'tidak pandai bersukan'], ['besar kepala', 'sombong'], ['murah hati', 'pemurah'], ['cakar ayam', 'tulisan buruk'],
    ['ulat buku', 'suka membaca'], ['mulut murai', 'suka bercakap'], ['kepala batu', 'degil'], ['tangan terbuka', 'menerima dengan baik'],
  ]
  return table(idioms, (a) => `Apakah maksud simpulan bahasa '${a}'?`, (b) => `Simpulan bahasa yang bermaksud '${b}' ialah`)
}

// --------------------------------------------------------------------------------------------------------------------
// Bahasa Inggeris (English text)
// --------------------------------------------------------------------------------------------------------------------

function biD1(): PoolItem[] {
  const opposites: [string, string][] = [
    ['big', 'small'], ['hot', 'cold'], ['up', 'down'], ['happy', 'sad'], ['old', 'new'], ['open', 'close'],
    ['day', 'night'], ['fast', 'slow'], ['tall', 'short'], ['wet', 'dry'], ['full', 'empty'], ['light', 'dark'],
  ]
  return table(opposites, (a) => `What is the opposite of '${a}'?`, (b) => `'${b}' is the opposite of`)
}

function biD2(): PoolItem[] {
  const plurals: [string, string][] = [
    ['child', 'children'], ['mouse', 'mice'], ['foot', 'feet'], ['tooth', 'teeth'], ['man', 'men'], ['woman', 'women'],
    ['box', 'boxes'], ['baby', 'babies'], ['leaf', 'leaves'], ['knife', 'knives'], ['bus', 'buses'], ['goose', 'geese'],
  ]
  return table(plurals, (a) => `What is the plural of '${a}'?`, (b) => `'${b}' is the plural of`)
}

function biD3(): PoolItem[] {
  const past: [string, string][] = [
    ['go', 'went'], ['eat', 'ate'], ['see', 'saw'], ['run', 'ran'], ['write', 'wrote'], ['swim', 'swam'],
    ['drink', 'drank'], ['sing', 'sang'], ['take', 'took'], ['buy', 'bought'], ['come', 'came'], ['sleep', 'slept'],
  ]
  return table(past, (a) => `What is the past tense of '${a}'?`, (b) => `'${b}' is the past tense of`)
}

function biD4(): PoolItem[] {
  const synonyms: [string, string][] = [
    ['big', 'large'], ['little', 'tiny'], ['happy', 'glad'], ['fast', 'quick'], ['begin', 'start'], ['end', 'finish'],
    ['shut', 'close'], ['smart', 'clever'], ['scared', 'afraid'], ['sick', 'ill'], ['rich', 'wealthy'], ['angry', 'cross'],
  ]
  return table(synonyms, (a) => `Which word means the same as '${a}'?`, (b) => `'${b}' means the same as`)
}

// --------------------------------------------------------------------------------------------------------------------
// Sains
// --------------------------------------------------------------------------------------------------------------------

function sciD1(): PoolItem[] {
  const out: PoolItem[] = []
  const senses: [string, string][] = [['mata', 'melihat'], ['telinga', 'mendengar'], ['hidung', 'menghidu'], ['lidah', 'merasa'], ['kulit', 'menyentuh']]
  out.push(...table(senses, (a) => `Apakah fungsi deria '${a}'?`, (b) => `Organ deria yang digunakan untuk ${b} ialah`))
  // No 'siput merayap' row: 'merayap' is also a fair answer for how a snake moves (G4 re-review of #129).
  const moves: [string, string][] = [['ikan', 'berenang'], ['burung', 'terbang'], ['ular', 'menjalar'], ['arnab', 'melompat'], ['kucing', 'berjalan']]
  out.push(...table(moves, (a) => `Bagaimanakah ${a} bergerak?`, (b) => `Haiwan manakah yang bergerak dengan cara ${b}?`, 1))
  out.push(item('Haiwan manakah yang bertelur?', 'ayam', ['kucing', 'lembu', 'kambing'], 2))
  out.push(item('Apakah yang diperlukan oleh tumbuhan untuk hidup?', 'air', ['plastik', 'besi', 'kaca'], 3))
  out.push(item('Haiwan manakah yang menyusukan anaknya?', 'lembu', ['ayam', 'ikan', 'katak'], 0))
  out.push(item('Apakah yang diperlukan oleh tumbuhan hijau untuk membuat makanan?', 'cahaya matahari', ['pasir', 'plastik', 'batu'], 1))
  return out
}

function sciD2(): PoolItem[] {
  const out: PoolItem[] = []
  const diets: [string, string][] = [
    ['lembu', 'herbivor'], ['harimau', 'karnivor'], ['ayam', 'omnivor'], ['kambing', 'herbivor'],
    ['singa', 'karnivor'], ['beruang', 'omnivor'], ['arnab', 'herbivor'], ['helang', 'karnivor'],
  ]
  out.push(...oneWay(diets, (a) => `Berdasarkan jenis makanannya, ${a} ialah haiwan`, ['herbivor', 'karnivor', 'omnivor', 'insektivor']))
  const parts: [string, string][] = [['akar', 'menyerap air'], ['daun', 'membuat makanan'], ['batang', 'mengangkut air ke daun'], ['bunga', 'menghasilkan buah']]
  out.push(...table(parts, (a) => `Apakah fungsi ${a} bagi tumbuhan?`, (b) => `Bahagian tumbuhan yang berfungsi ${b} ialah`, 1))
  const states: [string, string][] = [
    ['ais', 'pepejal'], ['air sirap', 'cecair'], ['wap air', 'gas'], ['batu', 'pepejal'], ['susu', 'cecair'], ['udara', 'gas'], ['minyak masak', 'cecair'], ['kayu', 'pepejal'],
  ]
  out.push(...oneWay(states, (a) => `Apakah keadaan jirim bagi ${a} pada suhu bilik?`, ['pepejal', 'cecair', 'gas', 'plasma'], 2))
  return out
}

function sciD3(): PoolItem[] {
  const out: PoolItem[] = []
  const organs: [string, string][] = [['jantung', 'mengepam darah'], ['paru-paru', 'bernafas'], ['perut', 'mencerna makanan'], ['otak', 'mengawal badan'], ['ginjal', 'menapis darah']]
  out.push(...table(organs, (a) => `Apakah fungsi utama ${a}?`, (b) => `Organ manakah yang berfungsi ${b}?`))
  const tools: [string, string][] = [['termometer', 'suhu'], ['pembaris', 'panjang'], ['penimbang', 'jisim'], ['jam randik', 'masa'], ['silinder penyukat', 'isi padu']]
  out.push(...table(tools, (a) => `Kuantiti apakah yang diukur dengan ${a}?`, (b) => `Alat yang digunakan untuk mengukur ${b} ialah`, 1))
  out.push(item('Apakah gas yang diperlukan oleh manusia untuk bernafas?', 'oksigen', ['karbon dioksida', 'nitrogen', 'wap air'], 2))
  out.push(item('Tumbuhan hijau membuat makanan melalui proses', 'fotosintesis', ['respirasi', 'penyejatan', 'pendebungaan'], 3))
  out.push(item('Planet yang kita diami ialah', 'Bumi', ['Marikh', 'Zuhal', 'Utarid'], 0))
  out.push(item('Bahan manakah yang ditarik oleh magnet?', 'paku besi', ['pemadam', 'kayu', 'kertas'], 1))
  return out
}

function sciD4(): PoolItem[] {
  const out: PoolItem[] = []
  const planets: [string, string][] = [
    ['pertama', 'Utarid'], ['kedua', 'Zuhrah'], ['ketiga', 'Bumi'], ['keempat', 'Marikh'],
    ['kelima', 'Musytari'], ['keenam', 'Zuhal'], ['ketujuh', 'Uranus'], ['kelapan', 'Neptun'],
  ]
  out.push(...table(planets, (a) => `Planet ${a} dari Matahari ialah`, (b) => `${b} ialah planet yang ke berapa dari Matahari?`))
  const materials: [string, string][] = [
    ['kuprum', 'konduktor elektrik'], ['plastik', 'penebat elektrik'], ['besi', 'konduktor elektrik'], ['getah', 'penebat elektrik'],
    ['aluminium', 'konduktor elektrik'], ['kayu kering', 'penebat elektrik'], ['perak', 'konduktor elektrik'], ['kaca', 'penebat elektrik'],
  ]
  out.push(...oneWay(materials, (a) => `${a.charAt(0).toUpperCase()}${a.slice(1)} ialah bahan`, ['konduktor elektrik', 'penebat elektrik', 'bahan cecair', 'bahan gas'], 1))
  return out
}

// --------------------------------------------------------------------------------------------------------------------
// Sejarah
// --------------------------------------------------------------------------------------------------------------------

function sejD1(): PoolItem[] {
  const out: PoolItem[] = []
  const days = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad']
  const next: [string, string][] = days.map((d, i) => [d, days[(i + 1) % days.length] as string])
  out.push(...table(next, (a) => `Hari selepas ${a} ialah`, (b) => `Hari sebelum ${b} ialah`))
  const months: [string, string][] = [['pertama', 'Januari'], ['kedua', 'Februari'], ['ketiga', 'Mac'], ['keempat', 'April'], ['kelima', 'Mei']]
  out.push(...table(months, (a) => `Bulan ${a} dalam setahun ialah`, (b) => `${b} ialah bulan yang ke berapa dalam setahun?`, 1))
  return out
}

function sejD2(): PoolItem[] {
  const out: PoolItem[] = []
  const symbols: [string, string][] = [
    ['bendera', 'Jalur Gemilang'], ['lagu kebangsaan', 'Negaraku'], ['bunga kebangsaan', 'Bunga Raya'], ['ibu negara', 'Kuala Lumpur'],
    ['pusat pentadbiran', 'Putrajaya'], ['bahasa kebangsaan', 'Bahasa Melayu'], ['tarikh Hari Kebangsaan', '31 Ogos'], ['tarikh Hari Malaysia', '16 September'],
  ]
  out.push(...table(symbols, (a) => `Apakah ${a} Malaysia?`, (b) => `Apakah yang dimaksudkan dengan '${b}' bagi Malaysia?`))
  const capitals: [string, string][] = [['Johor', 'Johor Bahru'], ['Kedah', 'Alor Setar'], ['Pahang', 'Kuantan'], ['Perak', 'Ipoh']]
  out.push(...table(capitals, (a) => `Apakah ibu negeri ${a}?`, (b) => `${b} ialah ibu negeri bagi negeri`, 1))
  return out
}

function sejD3(): PoolItem[] {
  const capitals: [string, string][] = [
    ['Kelantan', 'Kota Bharu'], ['Terengganu', 'Kuala Terengganu'], ['Pulau Pinang', 'George Town'], ['Selangor', 'Shah Alam'],
    ['Negeri Sembilan', 'Seremban'], ['Perlis', 'Kangar'], ['Sabah', 'Kota Kinabalu'], ['Sarawak', 'Kuching'],
    ['Johor', 'Johor Bahru'], ['Kedah', 'Alor Setar'], ['Pahang', 'Kuantan'], ['Perak', 'Ipoh'],
  ]
  return table(capitals, (a) => `Apakah ibu negeri ${a}?`, (b) => `${b} ialah ibu negeri bagi negeri`)
}

function sejD4(): PoolItem[] {
  const out: PoolItem[] = []
  const sites: [string, string][] = [['Gua Niah', 'Sarawak'], ['Lembah Bujang', 'Kedah'], ['Gua Cha', 'Kelantan'], ['Bukit Tengkorak', 'Sabah'], ['Kota Tampan', 'Perak']]
  out.push(...table(sites, (a) => `Tapak sejarah ${a} terletak di negeri`, (b) => `Tapak sejarah manakah yang terletak di ${b}?`))
  const days: [string, string][] = [['Hari Kebangsaan', '31 Ogos'], ['Hari Malaysia', '16 September'], ['Hari Pekerja', '1 Mei'], ['Hari Guru', '16 Mei']]
  out.push(...table(days, (a) => `Bilakah ${a} disambut setiap tahun?`, (b) => `Hari apakah yang disambut pada ${b} setiap tahun?`, 1))
  out.push(numeric('Pada tahun berapakah Persekutuan Tanah Melayu mencapai kemerdekaan?', 1957, [1963, 1946, 1948], 2))
  out.push(numeric('Pada tahun berapakah Malaysia dibentuk?', 1963, [1957, 1965, 1946], 3))
  out.push(numeric('Berapakah bilangan jalur merah dan putih pada Jalur Gemilang?', 14, [13, 11, 16], 0))
  out.push(numeric('Berapakah bilangan negeri di Malaysia?', 13, [14, 11, 9], 1))
  out.push(numeric('Berapakah bilangan bucu bintang pada Jalur Gemilang?', 14, [13, 5, 8], 2))
  out.push(numeric('Berapakah bilangan Wilayah Persekutuan di Malaysia?', 3, [2, 4, 1], 3))
  return out
}

// --------------------------------------------------------------------------------------------------------------------
// Pendidikan Islam
// --------------------------------------------------------------------------------------------------------------------

const ORDINALS = ['pertama', 'kedua', 'ketiga', 'keempat', 'kelima', 'keenam', 'ketujuh', 'kelapan', 'kesembilan', 'kesepuluh', 'kesebelas', 'kedua belas']

function piD1(): PoolItem[] {
  const out: PoolItem[] = []
  const islam = ['Mengucap syahadah', 'Solat', 'Zakat', 'Puasa', 'Haji']
  out.push(...table(islam.map((r, i) => [ORDINALS[i] as string, r] as [string, string]), (a) => `Rukun Islam yang ${a} ialah`, (b) => `${b} ialah Rukun Islam yang ke berapa?`))
  const iman = ['Allah', 'Malaikat', 'Kitab', 'Rasul', 'Hari Akhirat', 'Qada dan Qadar']
  out.push(...table(iman.map((r, i) => [ORDINALS[i] as string, r] as [string, string]), (a) => `Rukun Iman yang ${a} ialah beriman kepada`, (b) => `Beriman kepada ${b} ialah Rukun Iman yang ke berapa?`, 1))
  out.push(item('Kitab suci umat Islam ialah', 'Al-Quran', ['Injil', 'Taurat', 'Zabur'], 2))
  out.push(item('Ketika solat, umat Islam menghadap ke arah', 'Kaabah', ['matahari', 'utara', 'laut'], 3))
  return out
}

function piD2(): PoolItem[] {
  const out: PoolItem[] = []
  const rakaat: [string, string][] = [['Subuh', '2'], ['Zohor', '4'], ['Asar', '4'], ['Maghrib', '3'], ['Isyak', '4']]
  out.push(...oneWay(rakaat, (a) => `Berapakah bilangan rakaat solat fardu ${a}?`, ['2', '3', '4', '5']))
  const order = ['Subuh', 'Zohor', 'Asar', 'Maghrib', 'Isyak']
  out.push(...table(order.map((s, i) => [ORDINALS[i] as string, s] as [string, string]), (a) => `Solat fardu yang ${a} dalam sehari ialah`, (b) => `Solat fardu ${b} ialah solat yang ke berapa dalam sehari?`, 1))
  const angels: [string, string][] = [
    ['Jibril', 'membawa wahyu'], ['Mikail', 'menurunkan hujan'], ['Israfil', 'meniup sangkakala'],
    ['Izrail', 'mencabut nyawa'], ['Raqib', 'mencatat amal baik'], ['Atid', 'mencatat amal buruk'],
  ]
  out.push(...table(angels, (a) => `Apakah tugas malaikat ${a}?`, (b) => `Malaikat yang bertugas ${b} ialah`, 2))
  // 5 + 10 + 12 = 27 items are defined; the bank takes the first PRIMARY_PER_LEVEL, so the last three (backward items of
  // the last three angels) are spare and intentionally not seeded.
  return out
}

function piD3(): PoolItem[] {
  const months = ['Muharam', 'Safar', 'Rabiulawal', 'Rabiulakhir', 'Jamadilawal', 'Jamadilakhir', 'Rejab', 'Syaaban', 'Ramadan', 'Syawal', 'Zulkaedah', 'Zulhijah']
  return table(months.map((m, i) => [ORDINALS[i] as string, m] as [string, string]), (a) => `Bulan Islam yang ${a} ialah`, (b) => `${b} ialah bulan Islam yang ke berapa?`)
}

function piD4(): PoolItem[] {
  const out: PoolItem[] = []
  const wuduk = ['niat', 'membasuh muka', 'membasuh tangan', 'menyapu kepala', 'membasuh kaki', 'tertib']
  out.push(...table(wuduk.map((w, i) => [ORDINALS[i] as string, w] as [string, string]), (a) => `Rukun wuduk yang ${a} ialah`, (b) => `Dalam rukun wuduk, '${b}' ialah rukun yang ke berapa?`))
  const days: [string, string][] = [
    ['Hari Raya Aidilfitri', 'Syawal'], ['Hari Raya Aidiladha', 'Zulhijah'], ['ibadah puasa wajib', 'Ramadan'],
    ['Maal Hijrah', 'Muharam'], ['Israk dan Mikraj', 'Rejab'], ['Maulidur Rasul', 'Rabiulawal'],
  ]
  out.push(...table(days, (a) => `Dalam bulan Islam yang manakah ${a}?`, (b) => `Peristiwa atau ibadah yang berlaku dalam bulan ${b} ialah`, 1))
  return out
}

// --------------------------------------------------------------------------------------------------------------------
// Pendidikan Moral
// --------------------------------------------------------------------------------------------------------------------

function pmD1(): PoolItem[] {
  const meanings: [string, string][] = [
    ['baik hati', 'suka menolong'], ['jujur', 'bercakap benar'], ['rajin', 'tekun berusaha'], ['hormat', 'menghargai orang lain'],
    ['berterima kasih', 'menghargai pemberian'], ['bertanggungjawab', 'menjalankan tugas'], ['bekerjasama', 'membantu dalam kumpulan'],
    ['sederhana', 'tidak berlebihan'], ['berani', 'sanggup menghadapi cabaran'], ['kasih sayang', 'menyayangi keluarga'], ['adil', 'tidak berat sebelah'],
    ['bersih', 'menjaga kebersihan'],
  ]
  return table(meanings, (a) => `Apakah maksud nilai '${a}'?`, (b) => `Nilai yang bermaksud '${b}' ialah`)
}

function pmD2(): PoolItem[] {
  const acts: [string, string][] = [
    ['membantu rakan yang terjatuh', 'baik hati'], ['memulangkan dompet yang dijumpai', 'jujur'], ['menyiapkan kerja rumah setiap hari', 'rajin'],
    ['memberi salam kepada guru', 'hormat'], ['mengucapkan terima kasih apabila diberi hadiah', 'berterima kasih'], ['menyiram pokok yang menjadi tugasnya', 'bertanggungjawab'],
    ['bergotong-royong membersihkan kelas', 'bekerjasama'], ['berbelanja mengikut keperluan', 'sederhana'], ['menjaga adik yang sakit', 'kasih sayang'],
    ['mengaku kesilapan sendiri', 'berani'], ['membahagikan kek sama banyak', 'adil'], ['membuang sampah ke dalam tong', 'bersih'],
  ]
  return table(acts, (a) => `Perbuatan ${a} menunjukkan nilai`, (b) => `Perbuatan manakah yang menunjukkan nilai ${b}?`)
}

function pmD3(): PoolItem[] {
  const meanings: [string, string][] = [
    ['toleransi', 'bertolak ansur'], ['patriotisme', 'cinta akan negara'], ['kerajinan', 'usaha yang tekun'], ['kesyukuran', 'bersyukur'],
    ['hemah tinggi', 'bersopan santun'], ['kebebasan', 'bebas mengikut undang-undang'], ['keberanian', 'sanggup menghadapi cabaran'],
    ['kepercayaan', 'yakin kepada Tuhan'], ['rasional', 'berfikir secara wajar'], ['kesederhanaan', 'bersederhana'],
    ['keadilan', 'saksama'], ['kasih sayang', 'perasaan cinta'],
  ]
  return table(meanings, (a) => `Apakah yang dimaksudkan dengan nilai ${a}?`, (b) => `Nilai yang dikaitkan dengan '${b}' ialah`)
}

function pmD4(): PoolItem[] {
  const acts: [string, string][] = [
    ['menghormati perayaan kaum lain', 'toleransi'], ['menyanyikan lagu Negaraku dengan bangga', 'patriotisme'],
    ['berlatih bersungguh-sungguh untuk pertandingan', 'kerajinan'], ['tidak membazir makanan', 'kesyukuran'],
    ['bercakap dengan sopan kepada orang tua', 'hemah tinggi'], ['memilih aktiviti kokurikulum sendiri', 'kebebasan'],
    ['menegur rakan yang membuli', 'keberanian'], ['berdoa sebelum belajar', 'kepercayaan'], ['membuat keputusan selepas berfikir', 'rasional'],
    ['membeli barang yang perlu sahaja', 'kesederhanaan'], ['memberi markah yang saksama', 'keadilan'], ['melawat datuk di hospital', 'kasih sayang'],
  ]
  return table(acts, (a) => `Tindakan ${a} menunjukkan nilai`, (b) => `Tindakan manakah yang menunjukkan nilai ${b}?`)
}

// --------------------------------------------------------------------------------------------------------------------
// Pendidikan Seni Visual
// --------------------------------------------------------------------------------------------------------------------

function psvD1(): PoolItem[] {
  const out: PoolItem[] = []
  const colours: [string, string][] = [
    ['langit pada waktu siang', 'biru'], ['daun', 'hijau'], ['pisang masak', 'kuning'], ['buah tomato masak', 'merah'],
    ['arang', 'hitam'], ['susu', 'putih'], ['lobak merah', 'jingga'], ['buah terung', 'ungu'], ['batang pokok', 'coklat'],
  ]
  out.push(...table(colours, (a) => `Apakah warna ${a}?`, (b) => `Antara berikut, yang manakah biasanya berwarna ${b}?`))
  const mixes: [string, string][] = [['merah dan kuning', 'jingga'], ['kuning dan biru', 'hijau'], ['merah dan biru', 'ungu']]
  out.push(...oneWay(mixes, (m) => `Campuran warna ${m} menghasilkan warna`, ['jingga', 'hijau', 'ungu', 'coklat'], 1))
  const primaryAsks = ['Yang manakah warna primer?', 'Pilih satu warna primer.', 'Warna manakah ialah warna primer?']
  for (const [i, p] of ['merah', 'kuning', 'biru'].entries()) out.push(item(primaryAsks[i] as string, p, ['hijau', 'jingga', 'ungu'], i + 2))
  return out
}

function psvD2(): PoolItem[] {
  const out: PoolItem[] = []
  // Techniques share materials (pensel or krayon for gosokan and lukisan, kertas for most), so each item has a fixed
  // list of distractors that cannot also be right, not the other rows of a table (G4 re-review of #129).
  const media: [string, string, [string, string, string]][] = [
    ['catan', 'cat air', ['gam', 'tanah liat', 'blok cetakan']],
    ['kolaj', 'gam', ['cat air', 'tanah liat', 'blok cetakan']],
    ['lukisan', 'pensel', ['gam', 'tanah liat', 'blok cetakan']],
    ['cetakan', 'blok cetakan', ['gam', 'tanah liat', 'benang']],
    ['resis', 'krayon minyak', ['gam', 'tanah liat', 'blok cetakan']],
    ['origami', 'kertas', ['tanah liat', 'blok cetakan', 'cat air']],
    ['arca', 'tanah liat', ['pensel', 'blok cetakan', 'gam']],
    ['gosokan', 'permukaan bertekstur', ['gam', 'tanah liat', 'cat air']],
  ]
  media.forEach(([a, m, wrong], i) => out.push(item(`Bahan atau alat utama bagi aktiviti ${a} ialah`, m, wrong, i)))
  const byMaterial: [string, string, [string, string, string]][] = [
    ['Aktiviti seni yang menggunakan cat air sebagai bahan utama ialah', 'catan', ['arca', 'origami', 'gosokan']],
    ['Aktiviti seni yang menggunakan gam untuk menampal kepingan bahan ialah', 'kolaj', ['lukisan', 'gosokan', 'arca']],
    ['Aktiviti seni yang menggunakan pensel untuk melakar objek ialah', 'lukisan', ['arca', 'catan', 'origami']],
    ['Aktiviti seni yang menggunakan blok cetakan sebagai bahan utama ialah', 'cetakan', ['arca', 'origami', 'lukisan']],
    ['Aktiviti seni yang menggunakan krayon minyak dan cat air yang ditolak oleh lilin krayon ialah', 'resis', ['arca', 'origami', 'kolaj']],
    ['Seni melipat kertas tanpa gunting dan gam dikenali sebagai', 'origami', ['arca', 'catan', 'gosokan']],
    ['Aktiviti seni yang membentuk objek tiga dimensi daripada tanah liat ialah', 'arca', ['catan', 'origami', 'gosokan']],
    ['Aktiviti seni yang memindahkan corak permukaan bertekstur ke atas kertas ialah', 'gosokan', ['catan', 'origami', 'arca']],
  ]
  byMaterial.forEach(([text, key, wrong], i) => out.push(item(text, key, wrong, i + 2)))
  const elements: [string, string][] = [['garisan', 'titik yang bersambung'], ['rupa', 'kawasan tertutup'], ['jalinan', 'kesan permukaan'], ['ruang', 'kawasan sekitar objek']]
  out.push(...table(elements, (a) => `Unsur seni '${a}' terhasil daripada`, (b) => `Unsur seni yang terhasil daripada ${b} ialah`, 1))
  return out
}

function psvD3(): PoolItem[] {
  const out: PoolItem[] = []
  // Three-row tables: asked one way at a time with a fixed fourth choice (`table` needs at least four rows).
  const mixes: [string, string][] = [['merah dan kuning', 'jingga'], ['kuning dan biru', 'hijau'], ['merah dan biru', 'ungu']]
  out.push(...oneWay(mixes, (a) => `Campuran warna ${a} menghasilkan`, ['jingga', 'hijau', 'ungu', 'coklat']))
  out.push(...oneWay(mixes.map(([a, b]) => [b, a] as [string, string]), (b) => `Warna ${b} terhasil daripada campuran`, ['merah dan kuning', 'kuning dan biru', 'merah dan biru', 'hitam dan putih'], 2))
  const complements: [string, string][] = [['merah', 'hijau'], ['biru', 'jingga'], ['kuning', 'ungu']]
  out.push(...oneWay(complements, (a) => `Warna pelengkap bagi ${a} ialah`, ['hijau', 'jingga', 'ungu', 'coklat'], 1))
  out.push(...oneWay(complements.map(([a, b]) => [b, a] as [string, string]), (b) => `${b.charAt(0).toUpperCase()}${b.slice(1)} ialah warna pelengkap bagi`, ['merah', 'biru', 'kuning', 'putih'], 3))
  const temps: [string, string][] = [
    ['merah', 'warna panas'], ['jingga', 'warna panas'], ['kuning', 'warna panas'], ['biru', 'warna sejuk'],
    ['hijau', 'warna sejuk'], ['ungu', 'warna sejuk'], ['merah jambu', 'warna panas'], ['biru laut', 'warna sejuk'],
  ]
  out.push(...oneWay(temps, (a) => `Warna ${a} tergolong dalam`, ['warna panas', 'warna sejuk', 'warna neutral', 'warna logam'], 2))
  out.push(item('Kraf yang dihasilkan dengan menganyam daun mengkuang ialah', 'anyaman', ['tekat', 'ukiran', 'tembikar'], 3))
  out.push(item('Kain yang dihasilkan dengan teknik lilin dan pewarna ialah', 'batik', ['songket', 'kain pelikat', 'kain kapas'], 0))
  out.push(item('Permainan tradisional yang diterbangkan dengan tali ialah', 'wau', ['gasing', 'congkak', 'batu seremban'], 1))
  out.push(item('Permainan tradisional yang dipusingkan dengan tali di atas tanah ialah', 'gasing', ['wau', 'congkak', 'batu seremban'], 2))
  return out
}

function psvD4(): PoolItem[] {
  const out: PoolItem[] = []
  const principles: [string, string][] = [
    ['imbangan', 'keseimbangan visual'], ['kontras', 'perbezaan yang ketara'], ['harmoni', 'gabungan yang serasi'], ['pergerakan', 'kesan gerakan visual'],
    ['penegasan', 'tumpuan utama karya'], ['kepelbagaian', 'pelbagai unsur seni'], ['kesatuan', 'karya kelihatan lengkap'], ['ritma', 'unsur yang berulang'],
  ]
  out.push(...table(principles, (a) => `Prinsip rekaan '${a}' merujuk kepada`, (b) => `Prinsip rekaan yang merujuk kepada ${b} ialah`))
  out.push(item('Campuran sesuatu warna dengan warna putih menghasilkan', 'ton cerah', ['ton gelap', 'warna primer', 'warna pelengkap'], 1))
  out.push(item('Campuran sesuatu warna dengan warna hitam menghasilkan', 'ton gelap', ['ton cerah', 'warna primer', 'warna pelengkap'], 2))
  out.push(item('Seni sulaman menggunakan benang emas pada kain baldu dikenali sebagai', 'tekat', ['anyaman', 'ukiran', 'batik'], 3))
  out.push(item('Seni membentuk corak pada kayu dengan pahat dikenali sebagai', 'ukiran', ['tekat', 'anyaman', 'batik'], 0))
  out.push(item('Bekas air tradisional daripada tanah liat yang dibakar ialah', 'labu', ['wau', 'gasing', 'rebana'], 1))
  out.push(item('Alat yang digunakan untuk mencampur warna semasa mewarna ialah', 'palet', ['pembaris', 'gunting', 'pemadam'], 2))
  out.push(item('Teknik mewarna dengan titik-titik kecil dikenali sebagai', 'pointilisme', ['kolaj', 'resis', 'gosokan'], 3))
  out.push(item('Garisan yang tegak dari atas ke bawah ialah garisan', 'menegak', ['melintang', 'condong', 'berombak'], 0))
  return out
}

// --------------------------------------------------------------------------------------------------------------------

const BANKS: Record<PrimarySubject, Record<PrimaryLevel, () => PoolItem[]>> = {
  BM: { D1: bmD1, D2: bmD2, D3: bmD3, D4: bmD4 },
  BI: { D1: biD1, D2: biD2, D3: biD3, D4: biD4 },
  MATH: { D1: mathD1, D2: mathD2, D3: mathD3, D4: mathD4 },
  SCI: { D1: sciD1, D2: sciD2, D3: sciD3, D4: sciD4 },
  SEJ: { D1: sejD1, D2: sejD2, D3: sejD3, D4: sejD4 },
  PI: { D1: piD1, D2: piD2, D3: piD3, D4: piD4 },
  PM: { D1: pmD1, D2: pmD2, D3: pmD3, D4: pmD4 },
  PSV: { D1: psvD1, D2: psvD2, D3: psvD3, D4: psvD4 },
}

/** Every item a bank defines for a subject and level (may exceed PRIMARY_PER_LEVEL). */
export function primaryBank(subject: PrimarySubject, level: PrimaryLevel): PoolItem[] {
  return BANKS[subject][level]()
}

/** The PRIMARY_PER_LEVEL items seeded for a subject and level, in seed order. */
export function primaryItems(subject: PrimarySubject, level: PrimaryLevel): PoolItem[] {
  const bank = primaryBank(subject, level)
  if (bank.length < PRIMARY_PER_LEVEL) throw new Error(`question pool: ${subject} ${level} defines ${bank.length} items, needs ${PRIMARY_PER_LEVEL}`)
  return bank.slice(0, PRIMARY_PER_LEVEL)
}
