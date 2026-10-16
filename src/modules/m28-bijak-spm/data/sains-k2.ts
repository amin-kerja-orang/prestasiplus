/** Sains Kertas 2 short sample: keyword-marked structured questions, a shared Rajah, a speed part. */
import { Bank, leaf } from './builders'
import { plantCellSvg } from './diagrams'
import type { PointDef } from '../domain/types'

const POOL_A = 'SN2-A'
const POOL_B = 'SN2-B'

const kw = (id: string, items: { label: string; anyOf: string[] }[]): PointDef[] =>
  items.map((it, i) => ({
    id: `${id}-p${i + 1}`,
    code: 'B1',
    marks: 1,
    label: it.label,
    match: { type: 'keywords', anyOf: it.anyOf },
  }))

export function seedSainsK2(bank: Bank): { setA: string[]; setB: string[] } {
  // Rajah 1: plant cell. Group of two questions.
  bank.addQuestion(
    {
      id: 'sn2-sel-q1',
      topic: 'Sel',
      stem: 'Rajah 1 menunjukkan struktur sebuah sel tumbuhan.',
      parts: [
        leaf('sn2-sel-q1-a', '(a)', 'Namakan organel P.', 1, 'short_text'),
        leaf('sn2-sel-q1-b', '(b)', 'Nyatakan satu fungsi organel Q.', 1, 'short_text'),
        leaf('sn2-sel-q1-c', '(c)', 'Mengapakah sel ini ialah sel tumbuhan? Beri satu sebab.', 1, 'short_text'),
      ],
    },
    POOL_A,
  )
  bank.addQuestion(
    {
      id: 'sn2-sel-q2',
      topic: 'Sel',
      stem: 'Berdasarkan Rajah 1,',
      parts: [
        leaf('sn2-sel-q2-a', '(a)', 'namakan organel R.', 1, 'short_text'),
        leaf('sn2-sel-q2-b', '(b)', 'terangkan fungsi organel R.', 2, 'short_text'),
      ],
    },
    POOL_A,
  )
  const one = (pid: string, label: string, anyOf: string[]): void => {
    bank.schemes.set(pid, { kind: 'points', marks: 1, points: kw(pid, [{ label, anyOf }]), model: anyOf[0] })
  }
  one('sn2-sel-q1-a', 'Nukleus', ['nukleus', 'nucleus', 'inti sel'])
  one('sn2-sel-q1-b', 'Fotosintesis / menghasilkan makanan', ['fotosintesis', 'menghasilkan makanan', 'klorofil', 'tenaga cahaya'])
  one('sn2-sel-q1-c', 'Mempunyai dinding sel / kloroplas / vakuol besar', ['dinding sel', 'kloroplas', 'vakuol besar'])
  one('sn2-sel-q2-a', 'Vakuol', ['vakuol'])
  bank.schemes.set('sn2-sel-q2-b', {
    kind: 'points',
    marks: 2,
    points: kw('sn2-sel-q2-b', [
      { label: 'Menyimpan air / bahan terlarut', anyOf: ['menyimpan', 'simpan', 'air'] },
      { label: 'Mengekalkan tekanan turgor / bentuk sel', anyOf: ['turgor', 'kekal tegang', 'mengekalkan bentuk'] },
    ]),
    model: 'Menyimpan air dan mengekalkan tekanan turgor supaya sel kekal tegang.',
  })
  bank.addGroup(
    { id: 'sn2-sel', stimulusId: 'sn2-sel-s1', questionIds: ['sn2-sel-q1', 'sn2-sel-q2'] },
    {
      id: 'sn2-sel-s1',
      kind: 'diagram',
      label: 'Rajah 1',
      caption: 'Struktur sebuah sel tumbuhan.',
      alt: 'Sel tumbuhan dengan dinding sel, nukleus (P), kloroplas (Q) dan vakuol (R).',
      svg: plantCellSvg('Sel tumbuhan dengan dinding sel, nukleus (P), kloroplas (Q) dan vakuol (R).'),
    },
  )

  // Speed (working + unit), three variants.
  const speeds = [
    { d: 600, t: 40, v: 15 },
    { d: 450, t: 30, v: 15 },
    { d: 900, t: 60, v: 15 },
  ]
  speeds.forEach((s, i) => {
    const id = `sn2-laju-v${i + 1}`
    bank.addQuestion(
      {
        id,
        topic: 'Daya dan gerakan',
        stem: `Sebuah kereta mainan bergerak sejauh ${s.d} m dalam masa ${s.t} s.`,
        parts: [leaf(`${id}-a`, '(a)', 'Hitung laju kereta mainan itu.', 3, 'working', 'm/s')],
      },
      POOL_A,
    )
    bank.schemes.set(`${id}-a`, {
      kind: 'points',
      marks: 3,
      points: [
        { id: `${id}-a-p1`, code: 'K1', marks: 1, label: 'Jarak / masa', match: { type: 'step', accept: [`${s.d}/${s.t}`] } },
        { id: `${id}-a-p2`, code: 'N1', marks: 1, label: 'Nilai laju betul', match: { type: 'final' } },
        { id: `${id}-a-p3`, code: 'P1', marks: 1, label: 'Unit betul (m/s)', match: { type: 'unit' } },
      ],
      final: { accept: [String(s.v)], unit: 'm/s', display: `${s.v}\\text{ m/s}` },
    })
  })

  // Bahagian B: choose 1 of 2.
  bank.addQuestion(
    {
      id: 'sn2-osmosis',
      topic: 'Pergerakan bahan merentasi membran',
      stem: 'Terangkan bagaimana air meresap masuk ke dalam sel akar tumbuhan melalui osmosis.',
      parts: [leaf('sn2-osmosis-a', '', 'Jawapan anda.', 4, 'short_text')],
    },
    POOL_B,
  )
  bank.schemes.set('sn2-osmosis-a', {
    kind: 'points',
    marks: 4,
    points: kw('sn2-osmosis-a', [
      { label: 'Membran separa telap', anyOf: ['separa telap', 'membran separa'] },
      { label: 'Kepekatan larutan di luar sel lebih rendah (hipotonik)', anyOf: ['lebih rendah', 'kurang pekat', 'hipotonik', 'kepekatan rendah'] },
      { label: 'Air bergerak dari kepekatan rendah ke tinggi', anyOf: ['kepekatan tinggi', 'lebih pekat', 'hipertonik', 'rendah ke tinggi'] },
      { label: 'Sel menjadi tegang (turgid)', anyOf: ['turgid', 'tegang', 'turgor'] },
    ]),
    model: 'Air meresap melalui membran separa telap dari larutan berkepekatan rendah ke kepekatan tinggi dalam sel; sel menjadi turgid.',
  })
  bank.addQuestion(
    {
      id: 'sn2-fotosintesis',
      topic: 'Fotosintesis',
      stem: 'Nyatakan empat faktor yang mempengaruhi kadar fotosintesis.',
      parts: [leaf('sn2-fotosintesis-a', '', 'Jawapan anda.', 4, 'short_text')],
    },
    POOL_B,
  )
  bank.schemes.set('sn2-fotosintesis-a', {
    kind: 'points',
    marks: 4,
    points: kw('sn2-fotosintesis-a', [
      { label: 'Keamatan cahaya', anyOf: ['cahaya'] },
      { label: 'Kepekatan karbon dioksida', anyOf: ['karbon dioksida', 'co2'] },
      { label: 'Suhu', anyOf: ['suhu'] },
      { label: 'Bekalan air / klorofil', anyOf: ['air', 'klorofil'] },
    ]),
    model: 'Keamatan cahaya, karbon dioksida, suhu dan bekalan air.',
  })
  return { setA: ['sn2-sel-q1', 'sn2-sel-q2', 'sn2-laju-v1'], setB: ['sn2-osmosis', 'sn2-fotosintesis'] }
}
