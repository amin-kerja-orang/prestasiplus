/**
 * Derived (non-facet) fields of generated question rows (SRS §6.13.1 "Derived (not facets)").
 *
 * Every value is a pure function of the row key and its facets, so the same id always yields the
 * same row. Texts are built from small per-subject stem lists modelled on the discovery samples;
 * they are fictitious and name no real person. Nothing here is tuned to reach a count: counts come
 * from facets only.
 *
 * The cheap fields (`questionText`, `sourceFile`, `hasExplanation`, `createdAt`, `createdAtMs`,
 * `chapterLabel`, `curriculumTopicId`, `usageAttempts`; `qualityScore` lives in `./quality.ts`) use
 * `hashKey` only, so filters, sorts and searches on them never derive a full row.
 */

import { hashKey } from '@/mock/dataset'
import { toIsoMyt } from '@/lib/time'

import type {
  Language,
  PkskOption,
  QuestionFacets,
  ScriptType,
  SourceType,
  TextDirection,
} from '../repository/types'

// ---------------------------------------------------------------------------------------------
// Time: generated `createdAt` increases with the id (live auto-increment, BR-M04-31)
// ---------------------------------------------------------------------------------------------

/** Oldest generated row (id 1). PROPOSED; only the order is contractual. */
const T0 = Date.parse('2025-03-01T08:00:00+08:00')
/** Newest generated row (id 564,161): one minute before the newest observed anchors (23:20). */
const T1 = Date.parse('2026-05-18T23:19:00+08:00')
const ID_MAX = 564_161
const STEP = (T1 - T0) / ID_MAX

/** Generated `createdAt` of a question key (epoch ms, whole seconds, non-decreasing in key). */
export function generatedCreatedAtMs(key: number): number {
  return Math.floor((T0 + key * STEP) / 1000) * 1000
}

// ---------------------------------------------------------------------------------------------
// Per-subject stems
// ---------------------------------------------------------------------------------------------

interface Stems {
  /** Stem templates; `{t}` = a topic word. */
  q: readonly string[]
  /** Topic words. */
  t: readonly string[]
  /** Option pool (4 distinct entries are picked per row). */
  o: readonly string[]
}

const GENERIC: Stems = {
  q: [
    'Apakah maksud {t}?',
    'Antara berikut, yang manakah berkaitan dengan {t}?',
    'Pilih pernyataan yang benar tentang {t}.',
    'Mengapakah {t} penting?',
  ],
  t: ['konsep asas', 'kemahiran utama', 'nilai murni', 'amalan harian', 'prinsip penting'],
  o: ['Pernyataan I', 'Pernyataan II', 'Pernyataan III', 'Pernyataan IV', 'I dan II', 'III dan IV'],
}

const STEMS: Readonly<Record<number, Stems>> = {
  1: {
    q: [
      'Pilih ayat yang menggunakan {t} dengan betul.',
      'Apakah maksud {t} dalam ayat di atas?',
      'Antara berikut, yang manakah contoh {t}?',
      'Baca petikan tentang {t}. Apakah idea utama petikan itu?',
    ],
    t: [
      'kata sendi nama',
      'kata kerja transitif',
      'peribahasa',
      'kata ganda',
      'imbuhan apitan',
      'simpulan bahasa',
    ],
    o: [
      'di',
      'ke',
      'daripada',
      'kepada',
      'bagai aur dengan tebing',
      'ringan tulang',
      'berlari-lari',
      'memperbaiki',
    ],
  },
  2: {
    q: [
      'Choose the correct word to complete the sentence about {t}.',
      'What is the meaning of {t}?',
      'Which of the following is an example of {t}?',
      'Read the text about {t}. What is the main idea?',
    ],
    t: [
      'simple past tense',
      'prepositions',
      'synonyms',
      'adjectives',
      'phrasal verbs',
      'daily routines',
    ],
    o: ['went', 'goes', 'going', 'gone', 'under', 'between', 'happy', 'carefully'],
  },
  3: {
    q: [
      'Hitung nilai {t} yang diberi.',
      'Antara berikut, yang manakah betul tentang {t}?',
      'Selesaikan: cari {t} bagi nombor tersebut.',
      'Rajah menunjukkan {t}. Apakah nilainya?',
    ],
    t: ['pecahan', 'peratus', 'luas segi empat', 'purata', 'nilai tempat', 'sudut'],
    o: ['12', '24', '36', '48', '1/2', '3/4', '45°', '90°'],
  },
  4: {
    q: [
      'Apakah fungsi {t}?',
      'Antara berikut, yang manakah ciri {t}?',
      'Mengapakah {t} penting kepada hidupan?',
      'Pilih jawapan yang paling tepat tentang {t}.',
    ],
    t: [
      'fotosintesis',
      'sistem pencernaan',
      'satelit buatan',
      'magnet',
      'kitar air',
      'sel tumbuhan',
    ],
    o: [
      'Menghasilkan makanan',
      'Membekalkan tenaga',
      'Mengangkut oksigen',
      'Menyerap air',
      'Menarik besi',
      'Memantulkan cahaya',
    ],
  },
  5: {
    q: [
      'Apakah ciri {t}?',
      'Mengapakah {t} penting dalam sejarah negara?',
      'Antara berikut, yang manakah berkaitan dengan {t}?',
      'Apakah kesan {t} kepada masyarakat?',
    ],
    t: [
      'negara berdaulat',
      'Perlembagaan Persekutuan',
      'kerajaan Melayu Melaka',
      'pembentukan Malaysia',
      'perpaduan kaum',
      'sistem pentadbiran',
    ],
    o: ['I dan II', 'I dan IV', 'II dan III', 'III dan IV', 'Kedaulatan', 'Perpaduan'],
  },
  6: {
    q: [
      'Apakah hukum {t}?',
      'Antara berikut, yang manakah adab {t}?',
      'Apakah hikmah {t}?',
      'Nyatakan maksud {t}.',
    ],
    t: ['solat berjemaah', 'berpuasa', 'bersedekah', 'menghormati ibu bapa', 'membaca al-Quran'],
    o: ['Wajib', 'Sunat', 'Harus', 'Makruh', 'Ikhlas', 'Sabar'],
  },
  7: {
    q: [
      'Apakah nilai yang ditunjukkan dalam situasi {t}?',
      'Tindakan terbaik semasa {t} ialah',
      'Mengapakah {t} perlu diamalkan?',
    ],
    t: [
      'membantu jiran',
      'bekerjasama dalam kumpulan',
      'menjaga kebersihan',
      'menghormati guru',
      'bertanggungjawab',
    ],
    o: [
      'Baik hati',
      'Hormat-menghormati',
      'Kerjasama',
      'Tanggungjawab',
      'Kasih sayang',
      'Berdikari',
    ],
  },
  8: {
    q: [
      'Cari nilai {t}.',
      'Selesaikan persamaan yang melibatkan {t}.',
      'Antara berikut, yang manakah betul tentang {t}?',
    ],
    t: [
      'fungsi gubahan',
      'persamaan kuadratik',
      'janjang aritmetik',
      'pembezaan',
      'indeks dan logaritma',
    ],
    o: ['x = 2', 'x = -3', 'x = 5', 'x = 1/2', '2x + 1', '3x² - 1'],
  },
  9: {
    q: [
      'Apakah unit S.I. bagi {t}?',
      'Antara berikut, yang manakah menerangkan {t}?',
      'Hitung {t} objek tersebut.',
    ],
    t: ['daya', 'momentum', 'tekanan', 'arus elektrik', 'gelombang'],
    o: ['newton', 'pascal', 'ampere', 'joule', 'kg m s⁻¹', 'hertz'],
  },
  10: {
    q: [
      'Apakah hasil {t}?',
      'Antara berikut, yang manakah sifat {t}?',
      'Pilih pernyataan yang betul tentang {t}.',
    ],
    t: ['elektrolisis', 'asid dan bes', 'jadual berkala', 'kadar tindak balas', 'garam'],
    o: ['Gas klorin', 'Gas hidrogen', 'Natrium klorida', 'pH 7', 'Kuprum', 'Oksigen'],
  },
  11: {
    q: [
      'Apakah fungsi {t}?',
      'Antara berikut, yang manakah berlaku semasa {t}?',
      'Rajah menunjukkan {t}. Namakan struktur X.',
    ],
    t: ['mitosis', 'respirasi sel', 'sistem imun', 'enzim', 'osmosis'],
    o: ['Nukleus', 'Mitokondria', 'Ribosom', 'Kloroplas', 'Membran plasma', 'Vakuol'],
  },
  12: {
    q: ['Apakah ciri {t}?', 'Antara berikut, yang manakah faktor {t}?', 'Nyatakan kesan {t}.'],
    t: [
      'cuaca harian',
      'bentuk muka bumi',
      'taburan penduduk',
      'hutan hujan tropika',
      'peta lakar',
    ],
    o: ['Hujan lebat', 'Tanah pamah', 'Bandar', 'Pantai', 'Arah utara', 'Skala peta'],
  },
  18: {
    q: ['اختر الجواب الصحيح عن {t}.', 'ما معنى {t}؟', 'أيّ الجمل الآتية صحيحة عن {t}؟'],
    t: ['المدرسة', 'الأسرة', 'الطعام', 'الصلاة', 'الكتاب'],
    o: ['في', 'من', 'إلى', 'على', 'هذا', 'ذلك'],
  },
  26: {
    q: [
      'Pilih ejaan jawi yang betul bagi {t}.',
      'Apakah bunyi huruf dalam {t}?',
      'Tulis semula {t} dalam tulisan jawi.',
    ],
    t: ['perkataan sekolah', 'suku kata terbuka', 'huruf saksi', 'perkataan pinjaman'],
    o: ['سکوله', 'بوکو', 'کات', 'رومه', 'باڤ', 'ايبو'],
  },
}

function stemsOf(subjectId: number | null): Stems {
  return (subjectId !== null ? STEMS[subjectId] : undefined) ?? GENERIC
}

function pick<T>(list: readonly T[], key: number, salt: number): T {
  return list[hashKey(key, salt) % list.length] as T
}

const LEVEL_LABEL: Readonly<Record<number, string>> = {
  1: 'Darjah 1',
  2: 'Darjah 2',
  3: 'Darjah 3',
  4: 'Darjah 4',
  5: 'Darjah 5',
  6: 'Darjah 6',
  7: 'Tingkatan 1',
  8: 'Tingkatan 2',
  9: 'Tingkatan 3',
  10: 'Tingkatan 4',
  11: 'Tingkatan 5',
}

export function levelLabel(levelId: number | null): string {
  return levelId !== null ? (LEVEL_LABEL[levelId] ?? '') : ''
}

const SUBJECT_FILE: Readonly<Record<number, [string, string]>> = {
  1: ['BAHASA MELAYU', 'BM'],
  2: ['BAHASA INGGERIS', 'BI'],
  3: ['MATEMATIK', 'MATE'],
  4: ['SAINS', 'SAINS'],
  5: ['SEJARAH', 'SEJ'],
  6: ['PENDIDIKAN ISLAM', 'PI'],
  7: ['PENDIDIKAN MORAL', 'PM'],
  8: ['MATEMATIK TAMBAHAN', 'MT'],
  9: ['FIZIK', 'FIZIK'],
  10: ['KIMIA', 'KIMIA'],
  11: ['BIOLOGI', 'BIO'],
  12: ['GEOGRAFI', 'GEO'],
  13: ['PENDIDIKAN SENI VISUAL', 'PSV'],
  14: ['PENDIDIKAN MUZIK', 'MUZIK'],
  15: ['PENDIDIKAN JASMANI DAN KESIHATAN', 'PJK'],
  16: ['REKA BENTUK DAN TEKNOLOGI', 'RBT'],
  17: ['SAINS KOMPUTER', 'SK'],
  18: ['BAHASA ARAB', 'BA'],
  20: ['BAHASA TAMIL', 'BT'],
  21: ['PRINSIP PERAKAUNAN', 'PP'],
  22: ['EKONOMI', 'EKO'],
  23: ['PERNIAGAAN', 'NIAGA'],
  24: ['PENDIDIKAN AL-QURAN DAN AS-SUNNAH', 'PQS'],
  25: ['TASAWWUR ISLAM', 'TI'],
  26: ['JAWI', 'JAWI'],
  27: ['PENDIDIKAN SYARIAH ISLAMIAH', 'PSI'],
}

const STATES = [
  'JOHOR',
  'PAHANG',
  'SELANGOR',
  'KEDAH',
  'PERAK',
  'KELANTAN',
  'SABAH',
  'MELAKA',
] as const

// ---------------------------------------------------------------------------------------------
// Cheap fields
// ---------------------------------------------------------------------------------------------

type Facets = Readonly<QuestionFacets>

export function questionTextOf(key: number, f: Facets): string {
  if (f.pkskDomainId !== null) {
    // Fictitious PKSK texts; they never contain a domain name (M07: only the 13 live records
    // contain "inovasi").
    return f.questionType === 'essay'
      ? `Tulis karangan pendek tentang pengalaman anda (item ${String(key)}).`
      : `Bagi calon ${f.pkskTargetLevel ?? 'T1'}, pilih tindakan yang paling sesuai dalam situasi berikut (item ${String(key)}).`
  }
  const s = stemsOf(f.subjectId)
  const qi = hashKey(key, 1) % s.q.length
  const ti = hashKey(key, 2) % s.t.length
  // One string per (subject, stem, topic, type): the texts repeat, so they are built once (the
  // S1 search index reads every row's text at boot).
  const code = ((f.subjectId ?? 0) * 64 + qi) * 64 * 8 + ti * 8 + TYPE_CODE[f.questionType]
  const hit = TEXT_CACHE.get(code)
  if (hit !== undefined) return hit
  const text = (s.q[qi] as string).replace('{t}', s.t[ti] as string)
  const out =
    f.questionType === 'true_false'
      ? `Benar atau salah: ${text}`
      : f.questionType === 'fill_blank'
        ? `Isikan tempat kosong: ${text} ____`
        : f.questionType === 'essay'
          ? `Huraikan dengan contoh: ${text}`
          : text
  TEXT_CACHE.set(code, out)
  return out
}

const TEXT_CACHE = new Map<number, string>()
const TYPE_CODE: Readonly<Record<QuestionFacets['questionType'], number>> = {
  mcq: 0,
  true_false: 1,
  short_answer: 2,
  fill_blank: 3,
  essay: 4,
}

export function hasExplanationOf(key: number): boolean {
  return hashKey(key, 11) % 100 < 70
}

export function sourceFileOf(key: number, f: Facets): string | null {
  if (!f.hasSourceFile || f.subjectId === null) return null
  const [name, code] = SUBJECT_FILE[f.subjectId] ?? ['SUBJEK', 'SUBJ']
  const level = f.educationLevelId ?? 0
  const form = level >= 7 ? `T${String(level - 6)}` : `D${String(level)}`
  switch (f.sourceType) {
    case 'trial':
      return `SET ${String(1 + (hashKey(key, 21) % 3))}-${code} K1 ${pick(STATES, key, 22)}-2025.pdf`
    case 'dskp':
      return `DSKP KSSM ${name} ${form}.pdf`
    case 'marking_scheme':
      return `SKEMA ${code} K1 ${pick(STATES, key, 22)}-2024.pdf`
    default:
      return `${form}-BT-${code}---${name}.pdf`
  }
}

export function sourcePageOf(key: number, f: Facets): number | null {
  return f.hasSourceFile ? 1 + (hashKey(key, 23) % 240) : null
}

export function sourceSetOf(key: number, source: SourceType | null): string | null {
  switch (source) {
    case null:
      return null
    case 'ai_generated':
      return pick(
        ['tracking_a_feed_20260308', 'spm_tracking_auto_seed_v1', 'ai_generated'],
        key,
        24,
      )
    default:
      return source
  }
}

export function scriptOf(subjectId: number | null): {
  scriptType: ScriptType
  textDirection: TextDirection
} {
  if (subjectId === 18) return { scriptType: 'arab', textDirection: 'rtl' }
  if (subjectId === 26) return { scriptType: 'jawi', textDirection: 'rtl' }
  return { scriptType: 'rumi', textDirection: 'ltr' }
}

/** `rtl` for Arab/Jawi only (M10 `updateDirection()`; `mixed` → `ltr`). */
export function directionOf(scriptType: ScriptType): TextDirection {
  return scriptType === 'arab' || scriptType === 'jawi' ? 'rtl' : 'ltr'
}

// ---------------------------------------------------------------------------------------------
// Full derivation (non-cheap fields)
// ---------------------------------------------------------------------------------------------

export interface DerivedQuestionFields {
  scriptType: ScriptType
  textDirection: TextDirection
  pkskOptions: PkskOption[] | null
  questionImage: string | null
  options: string[] | null
  optionImages: (string | null)[]
  correctAnswer: number | null
  tfAnswer: boolean | null
  correctAnswerText: string | null
  altAnswers: string[]
  modelAnswer: string | null
  explanation: string | null
  aiExplanation: null
  language: Language
  pointsValue: number
  sourcePage: number | null
  sourceSet: string | null
  updatedAt: string
  usage: { attempts: number; correct: number }
}

function fourOptions(key: number, pool: readonly string[]): string[] {
  const start = hashKey(key, 31) % pool.length
  const stride = pool.length > 4 ? 1 + (hashKey(key, 32) % (pool.length - 1)) : 1
  const out: string[] = []
  for (let i = 0; out.length < 4 && i < pool.length * 2; i++) {
    const v = pool[(start + i * stride) % pool.length] as string
    if (!out.includes(v)) out.push(v)
  }
  while (out.length < 4) out.push(`Pilihan ${String.fromCharCode(65 + out.length)}`)
  return out
}

export function deriveQuestionFields(key: number, f: Facets): DerivedQuestionFields {
  const { scriptType, textDirection } = scriptOf(f.subjectId)
  const base = {
    scriptType,
    textDirection,
    questionImage: null,
    optionImages: [null, null, null, null],
    aiExplanation: null,
    language: 'bm' as Language,
    pointsValue: 1,
    sourcePage: sourcePageOf(key, f),
    sourceSet: sourceSetOf(key, f.sourceType),
    updatedAt: toIsoMyt(generatedCreatedAtMs(key)),
    usage: { attempts: 0, correct: 0 },
    tfAnswer: null,
    correctAnswerText: null,
    altAnswers: [] as string[],
    modelAnswer: null,
  }
  const explanation = hasExplanationOf(key)
    ? 'Jawapan ini dipilih berdasarkan konsep utama dalam buku teks.'
    : null
  if (f.pkskDomainId !== null) {
    const correct = hashKey(key, 7) % 4
    const pkskOptions =
      f.questionType === 'essay'
        ? []
        : ['Pilihan pertama', 'Pilihan kedua', 'Pilihan ketiga', 'Pilihan keempat'].map(
            (text, i) => ({
              text,
              isCorrect: i === correct,
            }),
          )
    return { ...base, pkskOptions, options: null, correctAnswer: null, explanation }
  }
  const s = stemsOf(f.subjectId)
  switch (f.questionType) {
    case 'true_false':
      return {
        ...base,
        pkskOptions: null,
        options: null,
        correctAnswer: null,
        tfAnswer: hashKey(key, 8) % 2 === 0,
        explanation,
      }
    case 'short_answer':
    case 'fill_blank':
      return {
        ...base,
        pkskOptions: null,
        options: null,
        correctAnswer: null,
        correctAnswerText: pick(s.o, key, 9),
        explanation,
      }
    case 'essay':
      return {
        ...base,
        pkskOptions: null,
        options: null,
        correctAnswer: null,
        modelAnswer: 'Jawapan perlu menyatakan isi utama berserta huraian dan contoh yang sesuai.',
        explanation,
      }
    default:
      return {
        ...base,
        pkskOptions: null,
        options: fourOptions(key, s.o),
        correctAnswer: hashKey(key, 7) % 4,
        explanation,
      }
  }
}
