/**
 * Matematik Kertas 2 (structured) seed. Question families with parts, marks, K1 / N1 / P1 mark
 * schemes (accepted equivalents, tolerance, ECF) and shared Rajah groups. Fictitious practice items.
 */
import { Bank, branch, leaf } from './builders'
import { triangleSvg } from './diagrams'
import type { PointDef, QuestionDef } from '../domain/types'

const POOL_A = 'MAT2-A'
const POOL_B = 'MAT2-B'

const pts = (id: string, list: Omit<PointDef, 'id'>[]): PointDef[] =>
  list.map((p, i) => ({ ...p, id: `${id}-p${i + 1}` }))

/** Q "faktor + selesai" (Bahagian A). */
function algebra(bank: Bank, v: number): string {
  const sets = [
    { k: 3, r: 2, c: 12, m: 2, s: 3, rhs: 10, x: 8 },
    { k: 2, r: 3, c: 18, m: 3, s: 2, rhs: 12, x: 6 },
  ] as const
  const d = sets[v]!
  const id = `mat2-algebra-v${v + 1}`
  const q: QuestionDef = {
    id,
    topic: 'Algebra',
    stem: 'Jawab semua soalan.',
    parts: [
      leaf(`${id}-a`, '(a)', `Faktorkan sepenuhnya $${d.k}x^2 - ${d.c}$.`, 2, 'working'),
      leaf(`${id}-b`, '(b)', `Selesaikan persamaan $${d.m}(x - ${d.s}) = ${d.rhs}$.`, 2, 'working'),
    ],
  }
  bank.addQuestion(q, POOL_A)
  bank.schemes.set(`${id}-a`, {
    kind: 'points',
    marks: 2,
    points: pts(`${id}-a`, [
      {
        code: 'K1',
        marks: 1,
        label: 'Mengeluarkan faktor sepunya',
        match: { type: 'step', accept: [`${d.k}(x^2-${d.c / d.k})`] },
      },
      { code: 'N1', marks: 1, label: 'Faktor lengkap', match: { type: 'final' } },
    ]),
    final: {
      accept: [`${d.k}(x-${d.r})(x+${d.r})`],
      display: `${d.k}(x - ${d.r})(x + ${d.r})`,
      mustContain: '(',
      formHint: 'Jawapan mesti dalam bentuk faktor.',
    },
  })
  bank.schemes.set(`${id}-b`, {
    kind: 'points',
    marks: 2,
    points: pts(`${id}-b`, [
      {
        code: 'K1',
        marks: 1,
        label: 'Kembangkan atau bahagi kedua-dua belah',
        match: {
          type: 'step',
          accept: [
            `x-${d.s}=${d.rhs / d.m}`,
            `${d.m}x-${d.m * d.s}=${d.rhs}`,
            `${d.m}x=${d.rhs + d.m * d.s}`,
          ],
        },
      },
      { code: 'N1', marks: 1, label: 'Nilai x betul', match: { type: 'final' } },
    ]),
    final: { accept: [String(d.x)], display: `x = ${d.x}` },
  })
  return id
}

/** Group of two questions sharing Rajah n (right-angled triangle). */
function triangleGroup(bank: Bank, v: number): string[] {
  const sets = [
    { ab: 12, bc: 5, ac: 13 },
    { ab: 8, bc: 6, ac: 10 },
  ] as const
  const d = sets[v]!
  const area = (d.ab * d.bc) / 2
  const q1 = `mat2-segitiga-v${v + 1}-q1`
  const q2 = `mat2-segitiga-v${v + 1}-q2`
  bank.addQuestion(
    {
      id: q1,
      topic: 'Teorem Pythagoras',
      stem: `Rajah menunjukkan segi tiga ABC bersudut tegak di B. AB = ${d.ab} cm dan BC = ${d.bc} cm.`,
      parts: [leaf(`${q1}-a`, '(a)', 'Hitung panjang, dalam cm, AC.', 2, 'working', 'cm')],
    },
    POOL_A,
  )
  bank.schemes.set(`${q1}-a`, {
    kind: 'points',
    marks: 2,
    points: pts(`${q1}-a`, [
      {
        code: 'K1',
        marks: 1,
        label: 'Menggunakan teorem Pythagoras',
        match: {
          type: 'step',
          accept: [
            `${d.ab}^2+${d.bc}^2`,
            `sqrt(${d.ab}^2+${d.bc}^2)`,
            String(d.ab ** 2 + d.bc ** 2),
          ],
        },
      },
      { code: 'N1', marks: 1, label: 'Panjang AC betul', match: { type: 'final' } },
    ]),
    final: { accept: [String(d.ac)], unit: 'cm', display: `${d.ac}\\text{ cm}` },
  })
  bank.addQuestion(
    {
      id: q2,
      topic: 'Luas dan trigonometri',
      stem: 'Berdasarkan Rajah itu,',
      parts: [
        leaf(`${q2}-a`, '(a)', 'hitung luas, dalam cm², segi tiga ABC.', 2, 'working', 'cm²'),
        leaf(`${q2}-b`, '(b)', 'cari nilai $\\sin \\angle ACB$.', 2, 'working'),
      ],
    },
    POOL_A,
  )
  bank.schemes.set(`${q2}-a`, {
    kind: 'points',
    marks: 2,
    points: pts(`${q2}-a`, [
      {
        code: 'K1',
        marks: 1,
        label: 'Menggunakan luas = 1/2 x tapak x tinggi',
        match: {
          type: 'step',
          accept: [`1/2*${d.ab}*${d.bc}`, `(${d.ab}*${d.bc})/2`, `${d.ab * d.bc}/2`],
        },
      },
      { code: 'N1', marks: 1, label: 'Luas betul', match: { type: 'final' } },
    ]),
    final: { accept: [String(area)], unit: 'cm²', display: `${area}\\text{ cm}^{2}` },
  })
  bank.schemes.set(`${q2}-b`, {
    kind: 'points',
    marks: 2,
    points: pts(`${q2}-b`, [
      {
        code: 'K1',
        marks: 1,
        label: 'Sisi bertentangan / hipotenus',
        match: { type: 'step', accept: [`${d.ab}/${d.ac}`, 'AB/AC'] },
      },
      { code: 'N1', marks: 1, label: 'Nilai sin betul', match: { type: 'final' } },
    ]),
    final: { accept: [`${d.ab}/${d.ac}`], tolerance: 0.001, display: `\\frac{${d.ab}}{${d.ac}}` },
  })
  bank.addGroup(
    { id: `mat2-segitiga-v${v + 1}`, stimulusId: `mat2-segitiga-s${v + 1}`, questionIds: [q1, q2] },
    {
      id: `mat2-segitiga-s${v + 1}`,
      kind: 'diagram',
      label: 'Rajah 1',
      caption: 'Segi tiga ABC bersudut tegak di B.',
      alt: `Segi tiga ABC bersudut tegak di B, AB ${d.ab} cm dan BC ${d.bc} cm.`,
      svg: triangleSvg(
        d.ab,
        d.bc,
        `Segi tiga ABC bersudut tegak di B, AB ${d.ab} cm dan BC ${d.bc} cm.`,
      ),
    },
  )
  return [q1, q2]
}

/** Diskaun (with own-figure-carried-forward from (a) to (b)). */
function diskaun(bank: Bank, v: number): string {
  const sets = [
    { price: 80, pct: 15 },
    { price: 100, pct: 20 },
    { price: 250, pct: 12 },
  ] as const
  const d = sets[v]!
  const disc = (d.price * d.pct) / 100
  const sale = d.price - disc
  const id = `mat2-diskaun-v${v + 1}`
  bank.addQuestion(
    {
      id,
      topic: 'Peratusan',
      stem: `Harga asal sehelai baju ialah RM${d.price}. Kedai itu memberi diskaun ${d.pct}%.`,
      parts: [
        leaf(`${id}-a`, '(a)', 'Hitung jumlah diskaun, dalam RM.', 2, 'working', 'RM'),
        leaf(
          `${id}-b`,
          '(b)',
          'Hitung harga jualan baju itu selepas diskaun, dalam RM.',
          1,
          'numeric',
          'RM',
        ),
      ],
    },
    POOL_A,
  )
  bank.schemes.set(`${id}-a`, {
    kind: 'points',
    marks: 2,
    points: pts(`${id}-a`, [
      {
        code: 'K1',
        marks: 1,
        label: 'Peratus x harga asal',
        match: {
          type: 'step',
          accept: [`${d.pct}/100*${d.price}`, `${d.pct / 100}*${d.price}`, `${d.pct}%*${d.price}`],
        },
      },
      { code: 'N1', marks: 1, label: 'Diskaun betul', match: { type: 'final' } },
    ]),
    final: { accept: [String(disc)], unit: 'RM', display: `\\text{RM}${disc}` },
  })
  bank.schemes.set(`${id}-b`, {
    kind: 'points',
    marks: 1,
    points: pts(`${id}-b`, [
      {
        code: 'N1',
        marks: 1,
        label: 'Harga jualan betul',
        match: { type: 'final' },
        ecf: {
          fromPart: `${id}-a`,
          expected: (prev) => d.price - prev,
          note: 'Diterima mengikut ECF: jawapan (a) dibawa ke hadapan.',
        },
      },
    ]),
    final: { accept: [String(sale)], unit: 'RM', display: `\\text{RM}${sale}` },
  })
  return id
}

/** Bahagian B: straight line y = mx + c. */
function garisLurus(bank: Bank, v: number): string {
  const sets = [
    { m: 2, c: 3, x1: 4, y2: 9 },
    { m: 3, c: 1, x1: 4, y2: 10 },
  ] as const
  const d = sets[v]!
  const id = `mat2-garis-v${v + 1}`
  const y1 = d.m * d.x1 + d.c
  const x2 = (d.y2 - d.c) / d.m
  bank.addQuestion(
    {
      id,
      topic: 'Garis lurus',
      stem: `Persamaan satu garis lurus ialah $y = ${d.m}x + ${d.c}$.`,
      parts: [
        leaf(`${id}-a`, '(a)', 'Nyatakan kecerunan garis lurus itu.', 1, 'numeric'),
        leaf(`${id}-b`, '(b)', 'Nyatakan pintasan-y garis lurus itu.', 1, 'numeric'),
        branch(`${id}-c`, '(c)', 'Cari', [
          leaf(`${id}-c1`, '(i)', `nilai y apabila $x = ${d.x1}$,`, 2, 'working'),
          leaf(`${id}-c2`, '(ii)', `nilai x apabila $y = ${d.y2}$.`, 2, 'working'),
        ]),
      ],
    },
    POOL_B,
  )
  const single = (pid: string, ans: number, label: string): void => {
    bank.schemes.set(pid, {
      kind: 'points',
      marks: 1,
      points: pts(pid, [{ code: 'N1', marks: 1, label, match: { type: 'final' } }]),
      final: { accept: [String(ans)], display: String(ans) },
    })
  }
  single(`${id}-a`, d.m, 'Kecerunan betul')
  single(`${id}-b`, d.c, 'Pintasan-y betul')
  bank.schemes.set(`${id}-c1`, {
    kind: 'points',
    marks: 2,
    points: pts(`${id}-c1`, [
      {
        code: 'K1',
        marks: 1,
        label: 'Gantikan nilai x',
        match: { type: 'step', accept: [`${d.m}*${d.x1}+${d.c}`, `${d.m * d.x1}+${d.c}`] },
      },
      { code: 'N1', marks: 1, label: 'Nilai y betul', match: { type: 'final' } },
    ]),
    final: { accept: [String(y1)], display: `y = ${y1}` },
  })
  bank.schemes.set(`${id}-c2`, {
    kind: 'points',
    marks: 2,
    points: pts(`${id}-c2`, [
      {
        code: 'K1',
        marks: 1,
        label: 'Gantikan nilai y',
        match: {
          type: 'step',
          accept: [`${d.m}x+${d.c}=${d.y2}`, `${d.m}x=${d.y2 - d.c}`, `${d.y2}=${d.m}x+${d.c}`],
        },
      },
      { code: 'N1', marks: 1, label: 'Nilai x betul', match: { type: 'final' } },
    ]),
    final: { accept: [String(x2)], display: `x = ${x2}` },
  })
  return id
}

/** Bahagian B: statistics. */
function statistik(bank: Bank, v: number): string {
  const sets = [
    { xs: [4, 6, 7, 7, 9, 12], mean: 7.5, mode: 7, median: 7, range: 8 },
    { xs: [3, 5, 5, 8, 9], mean: 6, mode: 5, median: 5, range: 6 },
  ] as const
  const d = sets[v]!
  const id = `mat2-statistik-v${v + 1}`
  const sum = d.xs.reduce((a, b) => a + b, 0)
  bank.addQuestion(
    {
      id,
      topic: 'Statistik',
      stem: `Data berikut menunjukkan bilangan buku yang dibaca oleh sekumpulan murid: ${d.xs.join(', ')}.`,
      parts: [
        leaf(`${id}-a`, '(a)', 'Hitung min data itu.', 2, 'working'),
        leaf(`${id}-b`, '(b)', 'Nyatakan mod data itu.', 1, 'numeric'),
        leaf(`${id}-c`, '(c)', 'Nyatakan median data itu.', 2, 'working'),
        leaf(`${id}-d`, '(d)', 'Cari julat data itu.', 1, 'numeric'),
      ],
    },
    POOL_B,
  )
  bank.schemes.set(`${id}-a`, {
    kind: 'points',
    marks: 2,
    points: pts(`${id}-a`, [
      {
        code: 'K1',
        marks: 1,
        label: 'Jumlah dibahagi bilangan nilai',
        match: { type: 'step', accept: [`${sum}/${d.xs.length}`] },
      },
      { code: 'N1', marks: 1, label: 'Min betul', match: { type: 'final' } },
    ]),
    final: { accept: [String(d.mean)], display: String(d.mean) },
  })
  const one = (pid: string, ans: number): void => {
    bank.schemes.set(pid, {
      kind: 'points',
      marks: 1,
      points: pts(pid, [
        { code: 'N1', marks: 1, label: 'Jawapan betul', match: { type: 'final' } },
      ]),
      final: { accept: [String(ans)], display: String(ans) },
    })
  }
  one(`${id}-b`, d.mode)
  one(`${id}-d`, d.range)
  bank.schemes.set(`${id}-c`, {
    kind: 'points',
    marks: 2,
    points: pts(`${id}-c`, [
      {
        code: 'K1',
        marks: 1,
        label: 'Menyusun data dan mengenal pasti nilai tengah',
        match: {
          type: 'step',
          accept: [
            d.xs.length % 2
              ? String(d.median)
              : `(${d.xs[d.xs.length / 2 - 1]}+${d.xs[d.xs.length / 2]})/2`,
          ],
        },
      },
      { code: 'N1', marks: 1, label: 'Median betul', match: { type: 'final' } },
    ]),
    final: { accept: [String(d.median)], display: String(d.median) },
  })
  return id
}

/** Bahagian B: quadratic equation. */
function kuadratik(bank: Bank, v: number): string {
  const sets = [
    { p: 2, q: 3 },
    { p: 2, q: 5 },
  ] as const
  const d = sets[v]!
  const id = `mat2-kuadratik-v${v + 1}`
  bank.addQuestion(
    {
      id,
      topic: 'Persamaan kuadratik',
      stem: `Diberi persamaan kuadratik $x^2 - ${d.p + d.q}x + ${d.p * d.q} = 0$.`,
      parts: [
        leaf(`${id}-a`, '(a)', `Faktorkan $x^2 - ${d.p + d.q}x + ${d.p * d.q}$.`, 2, 'working'),
        branch(`${id}-b`, '(b)', 'Seterusnya,', [
          leaf(`${id}-b1`, '(i)', 'selesaikan persamaan kuadratik itu,', 2, 'working'),
          leaf(`${id}-b2`, '(ii)', 'cari hasil tambah punca-punca persamaan itu.', 2, 'working'),
        ]),
      ],
    },
    POOL_B,
  )
  bank.schemes.set(`${id}-a`, {
    kind: 'points',
    marks: 2,
    points: pts(`${id}-a`, [
      {
        code: 'K1',
        marks: 1,
        label: 'Dua faktor dengan satu sebutan betul',
        match: { type: 'step', accept: [`(x-${d.p})(x-${d.q})`] },
      },
      { code: 'N1', marks: 1, label: 'Faktor betul', match: { type: 'final' } },
    ]),
    final: {
      accept: [`(x-${d.p})(x-${d.q})`],
      mustContain: '(',
      formHint: 'Jawapan mesti dalam bentuk faktor.',
      display: `(x - ${d.p})(x - ${d.q})`,
    },
  })
  bank.schemes.set(`${id}-b1`, {
    kind: 'points',
    marks: 2,
    points: pts(`${id}-b1`, [
      {
        code: 'K1',
        marks: 1,
        label: 'Menyamakan setiap faktor dengan sifar',
        match: { type: 'step', accept: [`x-${d.p}=0`, `x-${d.q}=0`] },
      },
      { code: 'N1', marks: 1, label: 'Kedua-dua punca betul', match: { type: 'final' } },
    ]),
    final: { accept: [`${d.p}, ${d.q}`], display: `x = ${d.p},\\ x = ${d.q}` },
  })
  bank.schemes.set(`${id}-b2`, {
    kind: 'points',
    marks: 2,
    points: pts(`${id}-b2`, [
      {
        code: 'K1',
        marks: 1,
        label: 'Menambah kedua-dua punca',
        match: { type: 'step', accept: [`${d.p}+${d.q}`] },
      },
      {
        code: 'N1',
        marks: 1,
        label: 'Hasil tambah betul',
        match: { type: 'final' },
        ecf: { fromPart: `${id}-b1`, expected: () => d.p + d.q, note: 'Diterima mengikut ECF.' },
      },
    ]),
    final: { accept: [String(d.p + d.q)], display: String(d.p + d.q) },
  })
  return id
}

export function seedMatK2(bank: Bank): { setA: string[]; setB: string[] } {
  const a1 = algebra(bank, 0)
  algebra(bank, 1)
  const g1 = triangleGroup(bank, 0)
  triangleGroup(bank, 1)
  const d1 = diskaun(bank, 0)
  diskaun(bank, 1)
  diskaun(bank, 2)
  const b1 = garisLurus(bank, 0)
  garisLurus(bank, 1)
  const b2 = statistik(bank, 0)
  statistik(bank, 1)
  const b3 = kuadratik(bank, 0)
  kuadratik(bank, 1)
  return { setA: [a1, ...g1, d1], setB: [b1, b2, b3] }
}
