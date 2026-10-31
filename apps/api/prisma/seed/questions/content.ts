/**
 * Content of the question seed (BE-09). Invented, fictitious, structurally valid questions in Bahasa
 * Melayu: no real exam content, no .cloud bank, no person names. Every part tree is parsed with the
 * contract `QuestionPartSchema` before it is written (see `index.ts`), so the seed can never hold a
 * tree the API would refuse.
 */
import type { QuestionPart } from '@pp/contract'

export type SeedSubject = 'MATH' | 'SCI' | 'BM'
export type SeedLevel = 'T4' | 'T5'
export type SeedStatus = 'draft' | 'review' | 'approved' | 'archived'
export type SeedQuestionType = 'mcq' | 'match' | 'short' | 'structured' | 'essay'

export interface SeedQuestion {
  /** Natural key: stored in `question_versions.number_label`, unique across the seed. */
  ref: string
  type: SeedQuestionType
  stem: string
  subject: SeedSubject
  level: SeedLevel
  status: SeedStatus
  /** Owner: the first teacher or admin account of the identity seed (by role, never by id). */
  owner: 'admin' | 'teacher'
  /** Curriculum tag (unit, SP, TP) written; false = only subject and level (an unfinished row). */
  tagged: boolean
  parts: QuestionPart[]
  /** Stimulus group membership (1-based position). */
  group?: { ref: string; position: number }
  /** `question_version_stimuli`: stimulus refs in display order. */
  stimuli?: string[]
  /** `question_tags` rows of kind `pool`. */
  pools?: string[]
}

export interface SeedStimulus {
  ref: string
  kind: 'passage' | 'diagram' | 'table'
  body: string
}

export interface SeedGroup {
  ref: string
  /** `stimulus_group_stimuli`, in order (1 to 3). */
  stimuli: string[]
  /** `stimulus_group_options`: the lettered option bank. */
  optionBank?: { label: string; body: string }[]
}

const rich = (ms: string) => ({ ms })

const mcq = (label: string, prompt: string, options: [string, string, string, string], correct: 'A' | 'B' | 'C' | 'D'): QuestionPart => ({
  label,
  prompt: rich(prompt),
  mode: 'mcq',
  marks: 1,
  options: options.map((body, i) => ({ label: 'ABCD'[i] as string, body: rich(body) })),
  key: { kind: 'option', correct },
})

export const SEED_STIMULI: SeedStimulus[] = [
  {
    ref: 'SEED-STIM-PASAR',
    kind: 'passage',
    body:
      'Pasar tani di pekan kecil itu dibuka setiap hujung minggu. Penjual menyusun sayur, buah dan kuih di atas meja panjang. ' +
      'Pembeli datang awal untuk mendapatkan barangan yang segar.',
  },
  {
    ref: 'SEED-STIM-AYAT',
    kind: 'passage',
    body: 'Bahagian ini mengandungi empat ayat. Padankan setiap ayat dengan jenis ayatnya.',
  },
]

export const SEED_GROUPS: SeedGroup[] = [
  { ref: 'SEED-GRP-PASAR', stimuli: ['SEED-STIM-PASAR'] },
  {
    ref: 'SEED-GRP-AYAT',
    stimuli: ['SEED-STIM-AYAT'],
    optionBank: [
      { label: 'A', body: 'Ayat penyata' },
      { label: 'B', body: 'Ayat tanya' },
      { label: 'C', body: 'Ayat perintah' },
      { label: 'D', body: 'Ayat seruan' },
    ],
  },
]

const matchItem = (n: number, sentence: string, letter: 'A' | 'B' | 'C' | 'D'): QuestionPart => ({
  label: String(n),
  prompt: rich(sentence),
  mode: 'match_letter',
  marks: 1,
  key: { kind: 'mapping', map: { [String(n)]: letter } },
})

export const SEED_QUESTIONS: SeedQuestion[] = [
  // Six published objective questions: 3 subjects x 2 forms.
  {
    ref: 'SEED-MCQ-MATH-T4', type: 'mcq', subject: 'MATH', level: 'T4', status: 'approved', owner: 'admin', tagged: true,
    stem: 'Pilih ungkapan kuadratik dalam satu pemboleh ubah.',
    parts: [mcq('1', 'Antara berikut, yang manakah ungkapan kuadratik dalam satu pemboleh ubah?', ['3x + 2', 'x² + 5x − 6', '2/x + 1', 'x³ − x'], 'B')],
  },
  {
    ref: 'SEED-MCQ-MATH-T5', type: 'mcq', subject: 'MATH', level: 'T5', status: 'approved', owner: 'admin', tagged: true, pools: ['spm'],
    stem: 'Nilai sin 30 darjah.',
    parts: [mcq('1', 'Nilai bagi sin 30° ialah', ['1/2', '√3/2', '1', '0'], 'A')],
  },
  {
    ref: 'SEED-MCQ-SCI-T4', type: 'mcq', subject: 'SCI', level: 'T4', status: 'approved', owner: 'admin', tagged: true,
    stem: 'Peralatan perlindungan diri di makmal.',
    parts: [mcq('1', 'Alat manakah yang digunakan untuk melindungi mata di makmal?', ['Apron', 'Gogal keselamatan', 'Sarung tangan', 'Penutup hidung'], 'B')],
  },
  {
    ref: 'SEED-MCQ-SCI-T5', type: 'mcq', subject: 'SCI', level: 'T5', status: 'approved', owner: 'admin', tagged: true, pools: ['spm'],
    stem: 'Unit SI bagi daya.',
    parts: [mcq('1', 'Apakah unit SI bagi daya?', ['Joule', 'Watt', 'Newton', 'Pascal'], 'C')],
  },
  {
    ref: 'SEED-MCQ-BM-T4', type: 'mcq', subject: 'BM', level: 'T4', status: 'approved', owner: 'admin', tagged: true,
    stem: 'Maksud peribahasa.',
    parts: [mcq('1', "Apakah maksud peribahasa 'bagai aur dengan tebing'?", ['Saling bergantung', 'Bermusuhan', 'Berpecah', 'Berjauhan'], 'A')],
  },
  {
    ref: 'SEED-MCQ-BM-T5', type: 'mcq', subject: 'BM', level: 'T5', status: 'approved', owner: 'admin', tagged: true, pools: ['spm'],
    stem: 'Kata ganda penuh.',
    parts: [mcq('1', 'Pilih perkataan yang merupakan kata ganda penuh.', ['kupu-kupu', 'sayur-mayur', 'tali-temali', 'lintang-pukang'], 'A')],
  },

  // Structured question with a 3-level part tree: (a) -> (i) -> (A), (B).
  {
    ref: 'SEED-STR-TREE', type: 'structured', subject: 'MATH', level: 'T4', status: 'approved', owner: 'admin', tagged: true,
    stem: 'Diberi fungsi kuadratik f(x) = x² − 4x + 3.',
    parts: [
      {
        label: '(a)',
        prompt: rich('Bagi fungsi f(x) = x² − 4x + 3:'),
        children: [
          {
            label: '(i)',
            prompt: rich('Tentukan'),
            children: [
              {
                label: '(A)', prompt: rich('nilai f(0).'), mode: 'numeric', marks: 1,
                key: { kind: 'accepted', values: [{ v: 3 }] },
              },
              {
                label: '(B)', prompt: rich('pintasan-y bagi graf fungsi itu.'), mode: 'short_text', marks: 1,
                key: { kind: 'accepted', values: ['3', 'y = 3', '(0, 3)'] },
              },
            ],
          },
          {
            label: '(ii)', prompt: rich('Cari punca-punca bagi persamaan x² − 4x + 3 = 0.'), mode: 'working', marks: 3,
            key: {
              kind: 'points', marks: 3,
              points: [
                { id: 'k1', code: 'K', label: 'Memfaktorkan atau menggunakan rumus', marks: 1, accept: ['(x − 1)(x − 3)', '(x-1)(x-3)'] },
                { id: 'n1', code: 'N', label: 'x = 1', marks: 1, accept: ['1', 'x = 1'] },
                { id: 'n2', code: 'N', label: 'x = 3', marks: 1, accept: ['3', 'x = 3'] },
              ],
              paths: [
                { id: 'faktor', pointIds: ['k1', 'n1', 'n2'] },
                { id: 'rumus', pointIds: ['k1', 'n1', 'n2'] },
              ],
            },
          },
        ],
      },
      {
        label: '(b)', prompt: rich('Cari nilai minimum bagi f(x).'), mode: 'numeric', marks: 2,
        key: { kind: 'accepted', values: [{ v: -1, tol: 0, tolKind: 'abs' }] },
      },
    ],
  },
  // Structured question with error carried forward (ECF) and a tolerance.
  {
    ref: 'SEED-STR-ECF', type: 'structured', subject: 'MATH', level: 'T5', status: 'approved', owner: 'admin', tagged: true,
    stem: 'Sebuah segi tiga bersudut tegak mempunyai dua sisi tegak 3 cm dan 4 cm.',
    parts: [
      {
        label: '(a)', prompt: rich('Hitung panjang hipotenus, dalam cm.'), mode: 'numeric', marks: 2,
        key: { kind: 'accepted', values: [{ v: 5, tol: 0.01, tolKind: 'abs', unit: 'cm' }] },
      },
      {
        label: '(b)', prompt: rich('Hitung perimeter segi tiga itu, dalam cm.'), mode: 'working', marks: 2,
        key: {
          kind: 'points', marks: 2,
          points: [
            { id: 'k1', code: 'K', label: 'Menjumlahkan ketiga-tiga sisi', marks: 1, accept: ['3 + 4 + 5'] },
            {
              id: 'n1', code: 'N', label: 'Perimeter = 12', marks: 1, accept: ['12'],
              ecf: { fromPart: '(a)', rule: { op: 'add', k: 7 } },
              unit: { value: 'cm', mandatory: false },
              tolerance: { kind: 'abs', value: 0.01 },
            },
          ],
          final: { display: '12 cm', accept: ['12', '12 cm'] },
        },
      },
    ],
  },
  // Structured question with an "any N of M" group (essay mode, points key).
  {
    ref: 'SEED-STR-ANYN', type: 'structured', subject: 'SCI', level: 'T4', status: 'approved', owner: 'admin', tagged: true,
    stem: 'Keselamatan di dalam makmal sains.',
    parts: [
      {
        label: '(a)', prompt: rich('Nyatakan tiga langkah keselamatan yang perlu dipatuhi semasa menjalankan eksperimen.'),
        mode: 'essay', marks: 3, wordRange: { min: 5, max: 60 },
        key: {
          kind: 'points', marks: 3,
          points: [
            { id: 'p1', code: 'P', label: 'Memakai kot makmal', marks: 1 },
            { id: 'p2', code: 'P', label: 'Memakai gogal keselamatan', marks: 1 },
            { id: 'p3', code: 'P', label: 'Tidak makan atau minum di dalam makmal', marks: 1 },
            { id: 'p4', code: 'P', label: 'Membasuh tangan selepas eksperimen', marks: 1 },
            { id: 'p5', code: 'P', label: 'Membaca arahan sebelum bermula', marks: 1 },
          ],
          groups: [{ id: 'g1', anyN: 3, eachMarks: 1, pointIds: ['p1', 'p2', 'p3', 'p4', 'p5'] }],
        },
      },
    ],
  },

  // Stimulus group of 3 ordered members around one passage.
  {
    ref: 'SEED-GRP-PASAR-1', type: 'mcq', subject: 'BM', level: 'T5', status: 'approved', owner: 'admin', tagged: true,
    stem: 'Pasar tani: bilakah pasar dibuka?', group: { ref: 'SEED-GRP-PASAR', position: 1 }, stimuli: ['SEED-STIM-PASAR'],
    parts: [mcq('1', 'Bilakah pasar tani itu dibuka?', ['Setiap hari', 'Setiap hujung minggu', 'Setiap malam', 'Setiap bulan'], 'B')],
  },
  {
    ref: 'SEED-GRP-PASAR-2', type: 'mcq', subject: 'BM', level: 'T5', status: 'approved', owner: 'admin', tagged: true,
    stem: 'Pasar tani: barangan yang dijual.', group: { ref: 'SEED-GRP-PASAR', position: 2 }, stimuli: ['SEED-STIM-PASAR'],
    parts: [mcq('2', 'Apakah yang disusun oleh penjual di atas meja?', ['Pakaian', 'Sayur, buah dan kuih', 'Buku', 'Perabot'], 'B')],
  },
  {
    ref: 'SEED-GRP-PASAR-3', type: 'mcq', subject: 'BM', level: 'T5', status: 'approved', owner: 'admin', tagged: true,
    stem: 'Pasar tani: sebab pembeli datang awal.', group: { ref: 'SEED-GRP-PASAR', position: 3 }, stimuli: ['SEED-STIM-PASAR'],
    parts: [mcq('3', 'Mengapakah pembeli datang awal?', ['Untuk mendapatkan barangan yang segar', 'Untuk bertemu rakan', 'Kerana pasar ditutup lewat', 'Kerana hari hujan'], 'A')],
  },
  // Stimulus group with a lettered option bank (match_letter, 4 items).
  {
    ref: 'SEED-GRP-AYAT-1', type: 'match', subject: 'BM', level: 'T4', status: 'approved', owner: 'admin', tagged: true,
    stem: 'Jenis ayat 1.', group: { ref: 'SEED-GRP-AYAT', position: 1 }, stimuli: ['SEED-STIM-AYAT'],
    parts: [matchItem(1, 'Adik sedang membaca buku.', 'A')],
  },
  {
    ref: 'SEED-GRP-AYAT-2', type: 'match', subject: 'BM', level: 'T4', status: 'approved', owner: 'admin', tagged: true,
    stem: 'Jenis ayat 2.', group: { ref: 'SEED-GRP-AYAT', position: 2 }, stimuli: ['SEED-STIM-AYAT'],
    parts: [matchItem(2, 'Siapakah yang menyapu halaman?', 'B')],
  },
  {
    ref: 'SEED-GRP-AYAT-3', type: 'match', subject: 'BM', level: 'T4', status: 'approved', owner: 'admin', tagged: true,
    stem: 'Jenis ayat 3.', group: { ref: 'SEED-GRP-AYAT', position: 3 }, stimuli: ['SEED-STIM-AYAT'],
    parts: [matchItem(3, 'Tutup pintu itu sekarang.', 'C')],
  },
  {
    ref: 'SEED-GRP-AYAT-4', type: 'match', subject: 'BM', level: 'T4', status: 'approved', owner: 'admin', tagged: true,
    stem: 'Jenis ayat 4.', group: { ref: 'SEED-GRP-AYAT', position: 4 }, stimuli: ['SEED-STIM-AYAT'],
    parts: [matchItem(4, 'Wah, cantiknya pemandangan ini!', 'D')],
  },

  // One row per non-approved status, for visibility and eligibility tests.
  {
    ref: 'SEED-DRAFT-BM-T4', type: 'short', subject: 'BM', level: 'T4', status: 'draft', owner: 'admin', tagged: false,
    stem: 'Kata nama am.',
    parts: [
      {
        label: '1', prompt: rich('Berikan satu contoh kata nama am.'), mode: 'short_text', marks: 1,
        key: { kind: 'accepted', values: ['buku', 'meja', 'kerusi', 'rumah'] },
      },
    ],
  },
  {
    // Owned by the seeded teacher: what a Guru submission looks like (status `review`).
    ref: 'SEED-REVIEW-SCI-T5', type: 'mcq', subject: 'SCI', level: 'T5', status: 'review', owner: 'teacher', tagged: false,
    stem: 'Planet paling hampir dengan Matahari.',
    parts: [mcq('1', 'Planet manakah yang paling hampir dengan Matahari?', ['Zuhrah', 'Utarid', 'Bumi', 'Marikh'], 'B')],
  },
  {
    ref: 'SEED-ARCHIVED-MATH-T4', type: 'mcq', subject: 'MATH', level: 'T4', status: 'archived', owner: 'admin', tagged: true,
    stem: 'Operasi asas.',
    parts: [mcq('1', 'Nilai bagi 2 + 3 × 4 ialah', ['20', '14', '24', '9'], 'B')],
  },
]
