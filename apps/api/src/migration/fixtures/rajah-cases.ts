/**
 * SYNTHETIC archive rows for the rajah planner and the V2 status/repair rules of `migrate:questions` (T-B9). Fictitious text only.
 * Appended to the `small` and `medium` fixtures (the committed `tiny` sample is untouched). Ids start at 100001, above every generated
 * question, in the subject and level of the chapter given. Each case is separated from the next by one plain filler question.
 *
 * Cases (design v2-question-bank-migration.md 7.6 and the adversarial list of T-B9-3):
 *   1 carrier + 2 followers          2 image owner + follower          3 passage carrier + 2 unnumbered followers
 *   4 unresolved follower            5 carrier with no follower        6 one rajah, approved + archived + approved
 *   7 Medium gap (approved held, archived grouped)                     8 shared image
 *   9 repairs: no key, 2 options, bad labels, multi-answer, statuses, empty stem + image
 *  10 same key, two carriers         11 run over 40 members            12 follower after an unrelated question
 */
export type Row = Record<string, unknown>

export const RAJAH_BASE = 100000

interface Q {
  id: number
  body: string | null
  status?: string
  image?: string
  /** option texts; the first `correct` indexes are correct (default [0]); null = no options */
  options?: string[] | null
  correct?: number[]
  labels?: string[]
}

const cases: Q[] = []
const plain = (id: number): Q => ({ id, body: `Soalan biasa ${id} tanpa rujukan.` })
const add = (...qs: Q[]): void => {
  cases.push(...qs)
}
const opts = (id: number): string[] => [`Pilihan ${id}A`, `Pilihan ${id}B`, `Pilihan ${id}C`, `Pilihan ${id}D`]

// 1
add({ id: 101001, body: 'Rajah 1', image: 'soalan/rajah1.png', options: null })
add({ id: 101002, body: 'Berdasarkan Rajah 1, hitung luas kawasan berlorek.' }, { id: 101003, body: 'Berdasarkan Rajah 1, nyatakan jenis sudut.' }, plain(101009))
// 2
add({ id: 102001, body: 'Rajah 2 menunjukkan graf jarak masa. Cari kelajuan.', image: 'soalan/rajah2.png' }, { id: 102002, body: 'Berdasarkan Rajah 2, hitung jarak.' }, plain(102009))
// 3
add(
  { id: 103001, body: 'Teks berikut menerangkan kisah seorang murid yang gigih berusaha mengejar cita-citanya walaupun menghadapi pelbagai dugaan di sekolah.', options: null },
  { id: 103002, body: 'Berdasarkan teks di atas, apakah tema cerita ini?' },
  { id: 103003, body: "Maksud 'gigih' dalam teks di atas ialah ..." },
  plain(103009),
)
// 4
add({ id: 104001, body: 'Berdasarkan Rajah 3, tentukan nilai x.' }, plain(104009))
// 5
add({ id: 105001, body: 'Rajah 4', image: 'soalan/rajah4.png', options: null }, plain(105009))
// 6
add(
  { id: 106000, body: 'Rajah 5', image: 'soalan/rajah5.png', options: null },
  { id: 106001, body: 'Berdasarkan Rajah 5, hitung perimeter.' },
  { id: 106002, body: 'Berdasarkan Rajah 5, hitung luas.', status: 'diarkib' },
  { id: 106003, body: 'Berdasarkan Rajah 5, nyatakan bentuk.' },
  plain(106009),
)
// 7
add(
  { id: 107001, body: 'Rajah 6 menunjukkan sebuah segi tiga.', image: 'soalan/rajah6.png' },
  plain(107002),
  { id: 107003, body: 'Berdasarkan Rajah 6, hitung tinggi.' },
  plain(107004),
  { id: 107011, body: 'Rajah 7 menunjukkan sebuah bulatan.', image: 'soalan/rajah7.png', status: 'diarkib' },
  { ...plain(107012), status: 'diarkib' },
  { id: 107013, body: 'Berdasarkan Rajah 7, hitung jejari.', status: 'diarkib' },
  plain(107019),
)
// 8
add({ id: 108001, body: 'Soalan tentang gambar pertama.', image: 'soalan/kongsi.png' }, { id: 108002, body: 'Soalan tentang gambar kedua.', image: 'soalan/kongsi.png' }, plain(108009))
// 9
add(
  { id: 109001, body: 'Soalan tanpa kunci jawapan.', correct: [] },
  { id: 109002, body: 'Dua pilihan sahaja.', options: ['Betul', 'Salah'] },
  { id: 109003, body: 'Label bercelaru.', labels: ['a)', 'a)', 'x', ''] },
  { id: 109004, body: 'Pilih dua jawapan betul.', correct: [0, 2] },
  { id: 109005, body: 'Soalan diarkib.', status: 'diarkib' },
  { id: 109006, body: 'Soalan draf.', status: 'draf' },
  { id: 109007, body: 'Soalan ditolak.', status: 'ditolak' },
  { id: 109008, body: 'Status tidak dikenali.', status: 'xyz' },
  { id: 109010, body: '', image: 'soalan/kosong.png' },
  plain(109019),
)
// 10
add(
  { id: 110001, body: 'Rajah 1', image: 'soalan/kertas-a-rajah1.png', options: null },
  { id: 110002, body: 'Berdasarkan Rajah 1, hitung x.' },
  { id: 110003, body: 'Rajah 1', image: 'soalan/kertas-b-rajah1.png', options: null },
  { id: 110004, body: 'Berdasarkan Rajah 1, hitung y.' },
  plain(110009),
)
// 11
add({ id: 111001, body: 'Rajah 9', image: 'soalan/rajah9.png', options: null })
for (let i = 1; i <= 45; i += 1) add({ id: 111100 + i, body: `Berdasarkan Rajah 9, soalan nombor ${i}.` })
add(plain(111999))
// 12
add(
  { id: 112001, body: 'Rajah 8', image: 'soalan/rajah8.png', options: null },
  { id: 112002, body: 'Berdasarkan Rajah 8, hitung a.' },
  plain(112003),
  { id: 112004, body: 'Berdasarkan Rajah 8, hitung b.' },
)

/** Questions and options rows for the archive, in the subject and level of `chapter`. */
export function rajahCaseRows(chapter: Row): { questions: Row[]; options: Row[] } {
  const questions: Row[] = []
  const options: Row[] = []
  let optionId = 5_000_000
  const created = '2025-03-01T08:00:00Z'
  for (const q of cases) {
    questions.push({
      id: q.id,
      subject_id: chapter.subject_id,
      education_level_id: chapter.education_level_id,
      chapter_id: chapter.id,
      topic_id: ((chapter.id as number) - 1) * 3 + 1,
      difficulty_level: '3',
      type: 'objektif',
      status: q.status ?? 'diluluskan',
      body: q.body,
      image_path: q.image ?? null,
      created_at: created,
      updated_at: created,
    })
    const texts = q.options === undefined ? opts(q.id) : q.options
    if (texts === null) continue
    const correct = q.correct ?? [0]
    texts.forEach((body, i) => {
      optionId += 1
      options.push({ id: optionId, question_id: q.id, label: q.labels?.[i] ?? 'ABCDEFGH'.charAt(i), body, is_correct: correct.includes(i) ? '1' : '0' })
    })
  }
  return { questions, options }
}

/** Ids of the cases, for tests. */
export const RAJAH_IDS = {
  carrierGroup: [101001, 101002, 101003],
  owner: [102001, 102002],
  passage: [103001, 103002, 103003],
  unresolved: 104001,
  lonelyCarrier: 105001,
  split: { carrier: 106000, approved: [106001, 106003], archived: [106002] },
  gap: { owner: 107001, approvedFollower: 107003, archivedOwner: 107011, archivedFollower: 107013 },
  shared: [108001, 108002],
  noKey: 109001,
  twoOptions: 109002,
  badLabels: 109003,
  multi: 109004,
  archived: 109005,
  draft: 109006,
  rejected: 109007,
  unknownStatus: 109008,
  emptyStem: 109010,
  twoCarriers: { a: 110001, aFollower: 110002, b: 110003, bFollower: 110004 },
  big: { carrier: 111001, first: 111101, last: 111145 },
  afterGap: { carrier: 112001, first: 112002, second: 112004 },
} as const
