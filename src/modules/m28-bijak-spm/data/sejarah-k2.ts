/**
 * Sejarah Kertas 2 small sample (exam schema D4.1): F (fact) and C (example) mark points with
 * "[mana-mana n x 1 m]" groups, a match_letter question with a shared lettered bank, and two essay
 * questions marked by a teacher against a band rubric. Original practice wording; no real paper text.
 */
import { Bank, curr, leaf } from './builders'
import type { PointDef, PointGroup } from '../domain/types'

const fc = (id: string, code: 'F' | 'C', items: { label: string; anyOf: string[] }[]): PointDef[] =>
  items.map((it, i) => ({
    id: `${id}-p${i + 1}`,
    code,
    marks: 1,
    label: it.label,
    match: { type: 'keywords', anyOf: it.anyOf },
  }))

const group = (id: string, n: number, count: number): PointGroup => ({
  id: 'g1',
  anyN: n,
  pointIds: Array.from({ length: count }, (_, i) => `${id}-p${i + 1}`),
})

export function seedSejarahK2(bank: Bank): { setA: string[]; setB: string[] } {
  // Bahan 1: a short source shared by Q1 (a) and (b).
  bank.addQuestion({
    id: 'sej2-q1',
    curriculum: curr('SEJ', 'Kemerdekaan Tanah Melayu', 3),
    stem: 'Bahan 1 menerangkan usaha rakyat sebelum negara merdeka. Berdasarkan Bahan 1,',
    parts: [
      leaf(
        'sej2-q1-a',
        '(a)',
        'nyatakan dua fakta tentang usaha mencapai kemerdekaan.',
        2,
        'short_text',
      ),
      leaf(
        'sej2-q1-b',
        '(b)',
        'jelaskan empat contoh kerjasama antara kaum yang membantu kemerdekaan.',
        4,
        'short_text',
      ),
    ],
  })
  bank.schemes.set('sej2-q1-a', {
    kind: 'points',
    marks: 2,
    points: fc('sej2-q1-a', 'F', [
      { label: 'Rundingan dengan pihak British', anyOf: ['rundingan', 'berunding'] },
      { label: 'Pilihan raya umum pertama', anyOf: ['pilihan raya'] },
      { label: 'Perlembagaan digubal', anyOf: ['perlembagaan'] },
      { label: 'Kerjasama parti politik pelbagai kaum', anyOf: ['perikatan', 'parti'] },
    ]),
    groups: [group('sej2-q1-a', 2, 4)],
    model: 'Mana-mana 2 fakta: rundingan, pilihan raya, perlembagaan, kerjasama parti.',
  })
  bank.schemes.set('sej2-q1-b', {
    kind: 'points',
    marks: 4,
    points: fc('sej2-q1-b', 'C', [
      { label: 'Kaum bekerjasama dalam satu pertubuhan politik', anyOf: ['pertubuhan', 'parti'] },
      { label: 'Wakil pelbagai kaum menyertai rundingan', anyOf: ['wakil', 'delegasi'] },
      { label: 'Persetujuan tentang kerakyatan', anyOf: ['kerakyatan'] },
      {
        label: 'Persetujuan tentang bahasa kebangsaan',
        anyOf: ['bahasa kebangsaan', 'bahasa melayu'],
      },
      { label: 'Persetujuan tentang kedudukan agama', anyOf: ['agama'] },
      { label: 'Semangat tolak ansur', anyOf: ['tolak ansur', 'tolak-ansur'] },
    ]),
    groups: [group('sej2-q1-b', 4, 6)],
    model: 'Mana-mana 4 contoh, setiap satu dengan huraian ringkas.',
  })
  bank.addGroup(
    { id: 'sej2-bahan1', stimulusId: 'sej2-s1', questionIds: ['sej2-q1'] },
    {
      id: 'sej2-s1',
      kind: 'passage',
      label: 'Bahan 1',
      alt: 'Petikan ringkas tentang usaha rakyat mencapai kemerdekaan.',
      text: 'Sebelum merdeka, pemimpin pelbagai kaum berunding dan bersetuju tentang asas negara baharu. Mereka menubuhkan satu gabungan, bertanding dalam pilihan raya dan menyediakan perlembagaan yang diterima bersama.',
    },
  )

  // Q2: three items share one lettered bank (match_letter).
  bank.addQuestion({
    id: 'sej2-q2',
    curriculum: curr('SEJ', 'Kronologi sejarah negara', 2),
    stem: 'Padankan setiap peristiwa dengan tahun yang betul daripada Bahan 2.',
    parts: [
      leaf('sej2-q2-a', '(a)', 'Persekutuan Tanah Melayu ditubuhkan.', 1, 'match_letter'),
      leaf('sej2-q2-b', '(b)', 'Pilihan raya umum pertama diadakan.', 1, 'match_letter'),
      leaf('sej2-q2-c', '(c)', 'Negara mencapai kemerdekaan.', 1, 'match_letter'),
    ],
  })
  const map: Record<string, string> = { 'sej2-q2-a': 'B', 'sej2-q2-b': 'C', 'sej2-q2-c': 'D' }
  for (const [pid, letter] of Object.entries(map)) {
    bank.schemes.set(pid, { kind: 'mapping', marks: 1, map: { [pid]: letter } })
  }
  bank.addGroup(
    {
      id: 'sej2-bahan2',
      stimulusId: 'sej2-s2',
      questionIds: ['sej2-q2'],
      optionBank: [
        { id: 'A', text: '1946' },
        { id: 'B', text: '1948' },
        { id: 'C', text: '1955' },
        { id: 'D', text: '1957' },
        { id: 'E', text: '1963' },
      ],
    },
    {
      id: 'sej2-s2',
      kind: 'table',
      label: 'Bahan 2',
      alt: 'Senarai tahun: A 1946, B 1948, C 1955, D 1957, E 1963.',
      table: {
        head: ['Huruf', 'Tahun'],
        rows: [
          ['A', '1946'],
          ['B', '1948'],
          ['C', '1955'],
          ['D', '1957'],
          ['E', '1963'],
        ],
      },
    },
  )

  // Bahagian B: choose 1 of 2 essays, teacher-marked against a band rubric.
  const rubric = {
    kind: 'rubric' as const,
    marks: 10,
    criteria: [
      { id: 'fakta', name: 'Fakta' },
      { id: 'huraian', name: 'Huraian' },
      { id: 'contoh', name: 'Contoh' },
    ],
    bands: [
      {
        name: 'Cemerlang',
        range: [9, 10] as [number, number],
        descriptor: 'Fakta tepat, huraian jelas dan contoh sesuai.',
      },
      {
        name: 'Baik',
        range: [6, 8] as [number, number],
        descriptor: 'Fakta tepat, huraian dan contoh kurang lengkap.',
      },
      {
        name: 'Sederhana',
        range: [3, 5] as [number, number],
        descriptor: 'Fakta asas sahaja, sedikit huraian.',
      },
      {
        name: 'Lemah',
        range: [1, 2] as [number, number],
        descriptor: 'Fakta terhad atau kurang tepat.',
      },
    ],
    notes: ['Guru mengesahkan band; markah tidak diberi secara automatik.'],
  }
  for (const [id, stem] of [
    ['sej2-q3', 'Huraikan kepentingan perlembagaan kepada sebuah negara yang baharu merdeka.'],
    ['sej2-q4', 'Jelaskan peranan kerjasama antara kaum dalam membina perpaduan negara.'],
  ] as const) {
    bank.addQuestion({
      id,
      curriculum: curr('SEJ', 'Kemerdekaan Tanah Melayu', 4),
      stem,
      parts: [
        {
          id: `${id}-a`,
          label: '',
          prompt: 'Jawapan anda (100 hingga 200 patah perkataan).',
          marks: 10,
          answer: { kind: 'essay', wordRange: { min: 100, max: 200 } },
        },
      ],
    })
    bank.schemes.set(`${id}-a`, rubric)
  }
  return { setA: ['sej2-q1', 'sej2-q2'], setB: ['sej2-q3', 'sej2-q4'] }
}
