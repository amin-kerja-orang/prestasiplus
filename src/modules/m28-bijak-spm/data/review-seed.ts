/**
 * Review-queue seed (fictitious content and uploaders). Questions here are NOT in the student bank
 * until the store publishes them. `status: 'terbit'` seeds are live from the start.
 */
import type { ReviewSeed } from '../domain/admin-types'
import type { PointDef } from '../domain/types'
import { Bank, curr, leaf, mcqQuestion } from './builders'
import { triangleSvg } from './diagrams'

type Meta = Omit<ReviewSeed, 'questions' | 'schemes' | 'group'>

const pts = (id: string, list: Omit<PointDef, 'id'>[]): PointDef[] =>
  list.map((p, i) => ({ ...p, id: `${id}-p${i + 1}` }))

function fromBank(b: Bank, meta: Meta, groupId?: string): ReviewSeed {
  const g = groupId ? b.groups.get(groupId) : undefined
  return {
    ...meta,
    questions: [...b.questions.values()],
    schemes: Object.fromEntries(b.schemes),
    ...(g ? { group: { def: g, stimulus: b.stimuli.get(g.stimulusId)! } } : {}),
  }
}

function mcqSeed(meta: Meta, args: Parameters<typeof mcqQuestion>[1], noKey = false): ReviewSeed {
  const b = new Bank()
  mcqQuestion(b, args)
  if (noKey) b.schemes.delete(args.id)
  return fromBank(b, meta)
}

const SRC_A = 'Percubaan Fiksyen Negeri Alfa 2025'
const SRC_B = 'Set Latihan Sekolah Beta 2025'
const UP_A = 'Cikgu Aisyah (fiksyen)'
const UP_B = 'Cikgu Bahar (fiksyen)'

function triangleGroupSeed(): ReviewSeed {
  const b = new Bank()
  const q1 = 'mat2-rev-g1-q1'
  const q2 = 'mat2-rev-g1-q2'
  b.addQuestion({
    id: q1,
    curriculum: curr('MAT', 'Teorem Pythagoras'),
    stem: 'Rajah menunjukkan segi tiga PQR bersudut tegak di Q. PQ = 9 cm dan QR = 12 cm.',
    parts: [leaf(`${q1}-a`, '(a)', 'Hitung panjang, dalam cm, PR.', 2, 'working', 'cm')],
  })
  b.schemes.set(`${q1}-a`, {
    kind: 'points',
    marks: 2,
    points: pts(`${q1}-a`, [
      {
        code: 'K',
        marks: 1,
        label: 'Menggunakan teorem Pythagoras',
        match: { type: 'step', accept: ['9^2+12^2', 'sqrt(9^2+12^2)', '225'] },
      },
      { code: 'N', marks: 1, label: 'Panjang PR betul', match: { type: 'final' } },
    ]),
    final: { accept: ['15'], unit: 'cm', display: '15\\text{ cm}' },
  })
  b.addQuestion({
    id: q2,
    curriculum: curr('MAT', 'Luas dan trigonometri'),
    stem: 'Berdasarkan Rajah itu,',
    parts: [
      leaf(`${q2}-a`, '(a)', 'hitung luas, dalam cm², segi tiga PQR.', 2, 'working', 'cm²'),
      leaf(`${q2}-b`, '(b)', 'cari nilai $\\cos \\angle QRP$.', 2, 'working'),
    ],
  })
  b.schemes.set(`${q2}-a`, {
    kind: 'points',
    marks: 2,
    points: pts(`${q2}-a`, [
      {
        code: 'K',
        marks: 1,
        label: 'Menggunakan luas = 1/2 x tapak x tinggi',
        match: { type: 'step', accept: ['1/2*9*12', '(9*12)/2', '108/2'] },
      },
      { code: 'N', marks: 1, label: 'Luas betul', match: { type: 'final' } },
    ]),
    final: { accept: ['54'], unit: 'cm²', display: '54\\text{ cm}^{2}' },
  })
  b.schemes.set(`${q2}-b`, {
    kind: 'points',
    marks: 2,
    points: pts(`${q2}-b`, [
      {
        code: 'K',
        marks: 1,
        label: 'Sisi bersebelahan / hipotenus',
        match: { type: 'step', accept: ['12/15', 'QR/PR'] },
      },
      { code: 'N', marks: 1, label: 'Nilai kos betul', match: { type: 'final' } },
    ]),
    final: { accept: ['12/15', '4/5', '0.8'], tolerance: 0.001, display: '\\frac{4}{5}' },
  })
  const alt = 'Segi tiga PQR bersudut tegak di Q, PQ 9 cm dan QR 12 cm.'
  b.addGroup(
    { id: 'mat2-rev-g1', stimulusId: 'mat2-rev-g1-s', questionIds: [q1, q2] },
    {
      id: 'mat2-rev-g1-s',
      kind: 'diagram',
      label: 'Rajah 1',
      caption: 'Segi tiga PQR bersudut tegak di Q.',
      alt,
      svg: triangleSvg(9, 12, alt),
    },
  )
  return fromBank(
    b,
    {
      key: 'mat2-rev-g1',
      subject: 'MAT',
      kertas: 2,
      source: SRC_A,
      uploader: UP_A,
      confidence: 'sederhana',
      ageDays: 2,
      status: 'semakan',
    },
    'mat2-rev-g1',
  )
}

function structuredSeed(): ReviewSeed {
  const b = new Bank()
  const id = 'sn2-rev-1'
  b.addQuestion({
    id,
    curriculum: curr('SN', 'Sel'),
    stem: 'Sel darah merah manusia tidak mempunyai nukleus.',
    parts: [
      leaf(`${id}-a`, '(a)', 'Nyatakan satu fungsi sel darah merah.', 1, 'short_text'),
      leaf(
        `${id}-b`,
        '(b)',
        'Terangkan mengapa ketiadaan nukleus membantu fungsi sel itu.',
        2,
        'short_text',
      ),
    ],
  })
  b.schemes.set(`${id}-a`, {
    kind: 'accepted',
    marks: 1,
    values: [{ v: 'mengangkut oksigen' }, { v: 'membawa oksigen' }],
  })
  b.schemes.set(`${id}-b`, {
    kind: 'points',
    marks: 2,
    points: pts(`${id}-b`, [
      {
        code: 'M',
        marks: 1,
        label: 'Ruang di dalam sel lebih banyak',
        match: { type: 'keywords', anyOf: ['ruang', 'lebih banyak'] },
      },
      {
        code: 'M',
        marks: 1,
        label: 'Boleh membawa lebih banyak hemoglobin / oksigen',
        match: { type: 'keywords', anyOf: ['hemoglobin', 'oksigen'] },
      },
    ]),
  })
  return fromBank(b, {
    key: id,
    subject: 'SN',
    kertas: 2,
    source: SRC_B,
    uploader: UP_B,
    confidence: 'sederhana',
    ageDays: 3,
    status: 'semakan',
  })
}

export const REVIEW_SEEDS: ReviewSeed[] = [
  mcqSeed(
    {
      key: 'mat1-rev-1',
      subject: 'MAT',
      kertas: 1,
      source: SRC_A,
      uploader: UP_A,
      confidence: 'tinggi',
      ageDays: 1,
      status: 'semakan',
    },
    {
      id: 'mat1-rev-1',
      topic: 'Pecahan',
      stem: 'Hitung nilai $\\frac{3}{4} + \\frac{1}{8}$.',
      correct: '$\\frac{7}{8}$',
      wrong: ['$\\frac{4}{12}$', '$\\frac{1}{2}$', '$\\frac{3}{32}$'],
      reason: 'Samakan penyebut: $\\frac{6}{8} + \\frac{1}{8} = \\frac{7}{8}$.',
    },
  ),
  mcqSeed(
    {
      key: 'mat1-rev-2',
      subject: 'MAT',
      kertas: 1,
      source: SRC_A,
      uploader: UP_A,
      confidence: 'sederhana',
      ageDays: 1,
      status: 'semakan',
    },
    {
      id: 'mat1-rev-2',
      topic: 'Peratusan',
      stem: 'Harga sebuah buku ialah RM40. Selepas diskaun 25%, berapakah harga buku itu?',
      correct: 'RM30',
      wrong: ['RM10', 'RM35', 'RM15'],
      reason: 'Diskaun = 25% x 40 = 10, harga baharu = 40 - 10 = RM30.',
    },
  ),
  // No answer key: the publish gate refuses this one until the uploader adds it.
  mcqSeed(
    {
      key: 'mat1-rev-3',
      subject: 'MAT',
      kertas: 1,
      source: SRC_B,
      uploader: UP_B,
      confidence: 'rendah',
      ageDays: 6,
      status: 'semakan',
    },
    {
      id: 'mat1-rev-3',
      topic: 'Indeks',
      stem: 'Ringkaskan $a^5 \\times a^3$.',
      correct: '$a^8$',
      wrong: ['$a^{15}$', '$a^2$', '$2a^8$'],
      reason: 'Tambah indeks apabila asas sama.',
    },
    true,
  ),
  triangleGroupSeed(),
  structuredSeed(),
  mcqSeed(
    {
      key: 'sn1-rev-1',
      subject: 'SN',
      kertas: 1,
      source: SRC_B,
      uploader: UP_B,
      confidence: 'tinggi',
      ageDays: 4,
      status: 'semakan',
    },
    {
      id: 'sn1-rev-1',
      subject: 'SN',
      topic: 'Daya dan gerakan',
      stem: 'Unit SI bagi daya ialah',
      correct: 'newton',
      wrong: ['joule', 'watt', 'pascal'],
      reason: 'Unit SI bagi daya ialah newton (N).',
    },
  ),
  // Already published: the few extra live questions added to the student bank.
  mcqSeed(
    {
      key: 'mat1-pub-1',
      subject: 'MAT',
      kertas: 1,
      source: SRC_A,
      uploader: UP_A,
      confidence: 'tinggi',
      ageDays: 12,
      status: 'terbit',
    },
    {
      id: 'mat1-pub-1',
      topic: 'Persamaan linear',
      stem: 'Selesaikan $3x - 5 = 10$.',
      correct: '$x = 5$',
      wrong: ['$x = 15$', '$x = 3$', '$x = \\frac{5}{3}$'],
      reason: '$3x = 15$, maka $x = 5$.',
    },
  ),
  mcqSeed(
    {
      key: 'mat1-pub-2',
      subject: 'MAT',
      kertas: 1,
      source: SRC_A,
      uploader: UP_A,
      confidence: 'tinggi',
      ageDays: 12,
      status: 'terbit',
    },
    {
      id: 'mat1-pub-2',
      topic: 'Statistik',
      stem: 'Min bagi nombor 4, 6, 8, 10 dan 12 ialah',
      correct: '8',
      wrong: ['6', '10', '40'],
      reason: 'Jumlah = 40, bahagi 5 = 8.',
    },
  ),
]
