/**
 * Matematik Kertas 1 (objective) seed: 16 parametrised question families x 4 variants (64 single
 * MCQ) plus three stimulus groups of 4 questions that share one diagram. Fictitious practice items.
 */
import { barChartSvg, gridSvg, triangleSvg } from './diagrams'
import { Bank, distinct, mcqQuestion } from './builders'

const POOL = 'MAT1-A'

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))
const frac = (n: number, d: number): string => {
  const g = gcd(n, d)
  const [a, b] = [n / g, d / g]
  return b === 1 ? String(a) : `$\\frac{${a}}{${b}}$`
}
const sgn = (n: number): string => (n < 0 ? `- ${-n}` : `+ ${n}`)
const poly = (b: number, c: number): string => `x^2 ${b === 0 ? '' : sgn(b).replace(/(\d+)/, '$1x')} ${sgn(c)}`.replace(/\s+/g, ' ').trim()

type Family = (bank: Bank, v: number) => void

const id = (f: string, v: number): string => `mat1-${f}-v${v + 1}`

const families: { key: string; topic: string; make: Family }[] = [
  {
    key: 'pecahan',
    topic: 'Pecahan',
    make(bank, v) {
      const sets = [[1, 2, 1, 3], [1, 4, 2, 3], [1, 2, 1, 5], [2, 5, 1, 3]] as const
      const [a, b, c, d] = sets[v]!
      const n = a * d + c * b
      const den = b * d
      const correct = frac(n, den)
      mcqQuestion(bank, {
        id: id('pecahan', v),
        topic: 'Pecahan',
        stem: `Nilaikan $\\frac{${a}}{${b}} + \\frac{${c}}{${d}}$.`,
        correct,
        wrong: distinct(correct, [frac(a + c, b + d), frac(a * c, b * d), frac(n, b + d)], (i) => frac(n + i, den)),
        reason: `Samakan penyebut: ${n}/${den}.`,
        pool: POOL,
      })
    },
  },
  {
    key: 'peratus',
    topic: 'Peratusan',
    make(bank, v) {
      const sets = [[15, 240], [20, 150], [35, 80], [12, 500]] as const
      const [p, n] = sets[v]!
      const ans = (p * n) / 100
      const correct = `RM${ans}`
      mcqQuestion(bank, {
        id: id('peratus', v),
        topic: 'Peratusan',
        stem: `Hitung ${p}% daripada RM${n}.`,
        correct,
        wrong: distinct(correct, [`RM${n - ans}`, `RM${(p * n) / 10}`, `RM${n / p}`], (i) => `RM${ans + i * 5}`),
        reason: `${p}/100 x ${n} = ${ans}.`,
        pool: POOL,
      })
    },
  },
  {
    key: 'bentuk-piawai',
    topic: 'Bentuk piawai',
    make(bank, v) {
      const sets = [[4.5, 4], [3.2, -4], [7.2, 6], [5.08, -2]] as const
      const [m, e] = sets[v]!
      const value = Number(`${m}e${e}`)
      const show = (mm: number, ee: number): string => `$${mm} \\times 10^{${ee}}$`
      const correct = show(m, e)
      mcqQuestion(bank, {
        id: id('bentuk-piawai', v),
        topic: 'Bentuk piawai',
        stem: `Ungkapkan ${value.toString().replace('.', ',')} dalam bentuk piawai.`,
        correct,
        wrong: distinct(correct, [show(m, e + 1), show(m, e - 1), show(Number((m * 10).toFixed(2)), e - 1)], (i) => show(m, e + 2 * i)),
        reason: `${m} x 10^${e}.`,
        pool: POOL,
      })
    },
  },
  {
    key: 'persamaan',
    topic: 'Persamaan linear',
    make(bank, v) {
      const sets = [[3, 4, 5], [2, 7, -3], [5, 3, 4], [4, 6, -8]] as const
      const [a, x, b] = sets[v]!
      const c = a * x + b
      const correct = String(x)
      mcqQuestion(bank, {
        id: id('persamaan', v),
        topic: 'Persamaan linear',
        stem: `Selesaikan persamaan $${a}x ${sgn(b)} = ${c}$.`,
        correct: `$x = ${x}$`,
        wrong: distinct(`$x = ${x}$`, [`$x = ${(c + b) / a}$`, `$x = ${c - b}$`, `$x = ${x + 1}$`], (i) => `$x = ${x + i + 1}$`),
        reason: `${a}x = ${c - b}, x = ${correct}.`,
        pool: POOL,
      })
    },
  },
  {
    key: 'kembang',
    topic: 'Ungkapan algebra',
    make(bank, v) {
      const sets = [[2, 3], [1, 4], [3, 2], [5, 1]] as const
      const [p, q] = sets[v]!
      const correct = `$${poly(p + q, p * q)}$`
      mcqQuestion(bank, {
        id: id('kembang', v),
        topic: 'Ungkapan algebra',
        stem: `Kembangkan $(x + ${p})(x + ${q})$.`,
        correct,
        wrong: distinct(correct, [`$${poly(p * q, p + q)}$`, `$${poly(p + q, p + q)}$`, `$${poly(p - q || 1, p * q)}$`], (i) => `$${poly(p + q + i, p * q)}$`),
        reason: `x^2 + ${p + q}x + ${p * q}.`,
        pool: POOL,
      })
    },
  },
  {
    key: 'faktor',
    topic: 'Pemfaktoran',
    make(bank, v) {
      const sets = [[2, 5], [3, 4], [1, 6], [2, 7]] as const
      const [p, q] = sets[v]!
      const show = (a: number, b: number): string => `$(x ${sgn(a)})(x ${sgn(b)})$`
      const correct = show(-p, -q)
      mcqQuestion(bank, {
        id: id('faktor', v),
        topic: 'Pemfaktoran',
        stem: `Faktorkan $x^2 - ${p + q}x + ${p * q}$.`,
        correct,
        wrong: distinct(correct, [show(p, q), show(-p, q), show(p, -q)], (i) => show(i, i + 1)),
        reason: `Dua nombor hasil darab ${p * q}, hasil tambah ${p + q}.`,
        pool: POOL,
      })
    },
  },
  {
    key: 'indeks',
    topic: 'Indeks',
    make(bank, v) {
      const sets = [[3, 5, 2], [2, 6, 4], [5, 4, 3], [4, 7, 5]] as const
      const [base, m, n] = sets[v]!
      const e = m - n
      const show = (x: number): string => `$${base}^{${x}}$`
      const correct = show(e)
      mcqQuestion(bank, {
        id: id('indeks', v),
        topic: 'Indeks',
        stem: `Ringkaskan $${base}^{${m}} \\div ${base}^{${n}}$.`,
        correct,
        wrong: distinct(correct, [show(m + n), show(m * n), show(Math.round(m / n) || 1)], (i) => show(e + i)),
        reason: `${m} - ${n} = ${e}.`,
        pool: POOL,
      })
    },
  },
  {
    key: 'kecerunan',
    topic: 'Garis lurus',
    make(bank, v) {
      const sets = [[1, 2, 3, 8], [0, 1, 4, 9], [2, 3, 5, 9], [1, 1, 4, 7]] as const
      const [x1, y1, x2, y2] = sets[v]!
      const m = (y2 - y1) / (x2 - x1)
      const correct = frac(y2 - y1, x2 - x1)
      mcqQuestion(bank, {
        id: id('kecerunan', v),
        topic: 'Garis lurus',
        stem: `Cari kecerunan garis lurus yang melalui titik $(${x1}, ${y1})$ dan $(${x2}, ${y2})$.`,
        correct,
        wrong: distinct(correct, [frac(x2 - x1, y2 - y1), frac(y2 + y1, x2 + x1), String(-m)], (i) => String(m + i + 0.5)),
        reason: `m = (${y2} - ${y1}) / (${x2} - ${x1}).`,
        pool: POOL,
      })
    },
  },
  {
    key: 'kebarangkalian',
    topic: 'Kebarangkalian',
    make(bank, v) {
      const sets = [[3, 5, 2], [4, 3, 5], [2, 6, 2], [5, 5, 5]] as const
      const [r, b, g] = sets[v]!
      const t = r + b + g
      const correct = frac(r, t)
      mcqQuestion(bank, {
        id: id('kebarangkalian', v),
        topic: 'Kebarangkalian',
        stem: `Sebuah beg mengandungi ${r} bola merah, ${b} bola biru dan ${g} bola hijau. Sebiji bola dipilih secara rawak. Cari kebarangkalian bola itu merah.`,
        correct,
        wrong: distinct(correct, [frac(r, b + g), frac(b, t), frac(r + b, t)], (i) => frac(r + i, t + i)),
        reason: `${r} / ${t}.`,
        pool: POOL,
      })
    },
  },
  {
    key: 'min',
    topic: 'Statistik',
    make(bank, v) {
      const sets = [[4, 6, 7, 9, 14], [3, 5, 8, 8, 11], [10, 12, 15, 18, 20], [2, 4, 6, 8, 10]] as const
      const xs = sets[v]!
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length
      const correct = String(mean)
      mcqQuestion(bank, {
        id: id('min', v),
        topic: 'Statistik',
        stem: `Cari min bagi data ${xs.join(', ')}.`,
        correct,
        wrong: distinct(correct, [String(xs[2]), String(mean + 1), String(Math.max(...xs) - Math.min(...xs))], (i) => String(mean + i * 2)),
        reason: `Jumlah ${xs.reduce((a, b) => a + b, 0)} dibahagi ${xs.length}.`,
        pool: POOL,
      })
    },
  },
  {
    key: 'ketaksamaan',
    topic: 'Ketaksamaan linear',
    make(bank, v) {
      const sets = [[2, 3, 11], [3, 1, 16], [4, -2, 18], [5, 5, 30]] as const
      const [a, b, c] = sets[v]!
      const x = (c - b) / a
      const correct = `$x < ${x}$`
      mcqQuestion(bank, {
        id: id('ketaksamaan', v),
        topic: 'Ketaksamaan linear',
        stem: `Selesaikan ketaksamaan $${a}x ${sgn(b)} < ${c}$.`,
        correct,
        wrong: distinct(correct, [`$x > ${x}$`, `$x < ${c - b}$`, `$x < ${(c + b) / a}$`], (i) => `$x < ${x + i}$`),
        reason: `${a}x < ${c - b}.`,
        pool: POOL,
      })
    },
  },
  {
    key: 'laju',
    topic: 'Laju, jarak dan masa',
    make(bank, v) {
      const sets = [[180, 3], [240, 4], [150, 2.5], [320, 4]] as const
      const [d, t] = sets[v]!
      const s = d / t
      const correct = `${s} km/j`
      mcqQuestion(bank, {
        id: id('laju', v),
        topic: 'Laju, jarak dan masa',
        stem: `Sebuah bas bergerak sejauh ${d} km dalam masa ${String(t).replace('.', ',')} jam. Hitung laju purata bas itu.`,
        correct,
        wrong: distinct(correct, [`${d * t} km/j`, `${t / d} km/j`, `${s + 10} km/j`], (i) => `${s + i * 5} km/j`),
        reason: `${d} / ${t} = ${s}.`,
        pool: POOL,
      })
    },
  },
  {
    key: 'poligon',
    topic: 'Poligon',
    make(bank, v) {
      const ns = [5, 6, 8, 10] as const
      const n = ns[v]!
      const a = ((n - 2) * 180) / n
      const correct = `${a}°`
      mcqQuestion(bank, {
        id: id('poligon', v),
        topic: 'Poligon',
        stem: `Hitung sudut pedalaman bagi sebuah poligon sekata yang mempunyai ${n} sisi.`,
        correct,
        wrong: distinct(correct, [`${360 / n}°`, `${(n - 2) * 180}°`, `${180 - a / 2}°`], (i) => `${a + i * 6}°`),
        reason: `(${n} - 2) x 180 / ${n}.`,
        pool: POOL,
      })
    },
  },
  {
    key: 'pythagoras',
    topic: 'Teorem Pythagoras',
    make(bank, v) {
      const sets = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]] as const
      const [a, b, c] = sets[v]!
      const correct = `${c} cm`
      mcqQuestion(bank, {
        id: id('pythagoras', v),
        topic: 'Teorem Pythagoras',
        stem: `Dalam segi tiga bersudut tegak, dua sisi yang membentuk sudut tegak ialah ${a} cm dan ${b} cm. Hitung panjang hipotenus.`,
        correct,
        wrong: distinct(correct, [`${a + b} cm`, `${Math.abs(b - a)} cm`, `${a * b} cm`], (i) => `${c + i} cm`),
        reason: `Akar punca kuasa dua (${a}^2 + ${b}^2) = ${c}.`,
        pool: POOL,
      })
    },
  },
  {
    key: 'bulatan',
    topic: 'Bulatan',
    make(bank, v) {
      const sets = [[7, 154], [14, 616], [21, 1386], [3.5, 38.5]] as const
      const [r, area] = sets[v]!
      const correct = `${area} cm²`
      mcqQuestion(bank, {
        id: id('bulatan', v),
        topic: 'Bulatan',
        stem: `Hitung luas sebuah bulatan berjejari ${String(r).replace('.', ',')} cm. [Guna $\\pi = \\frac{22}{7}$]`,
        correct,
        wrong: distinct(correct, [`${area * 2 / r} cm²`, `${(2 * 22 * r) / 7} cm²`, `${area * 2} cm²`], (i) => `${area + i * 11} cm²`),
        reason: `22/7 x ${r}^2 = ${area}.`,
        pool: POOL,
      })
    },
  },
  {
    key: 'set',
    topic: 'Set',
    make(bank, v) {
      const sets = [[12, 9, 4], [20, 15, 8], [30, 18, 10], [25, 14, 6]] as const
      const [a, b, c] = sets[v]!
      const correct = String(a + b - c)
      mcqQuestion(bank, {
        id: id('set', v),
        topic: 'Set',
        stem: `Diberi $n(A) = ${a}$, $n(B) = ${b}$ dan $n(A \\cap B) = ${c}$. Cari $n(A \\cup B)$.`,
        correct,
        wrong: distinct(correct, [String(a + b), String(a + b + c), String(a - c)], (i) => String(a + b - c + i)),
        reason: `${a} + ${b} - ${c}.`,
        pool: POOL,
      })
    },
  },
]

export const K1_FAMILY_COUNT = families.length

/** The stimulus groups: three diagrams x 4 questions each. */
function addGroups(bank: Bank): void {
  // Rajah 1: right-angled triangle
  const g1 = ['mat1-g1-q1', 'mat1-g1-q2', 'mat1-g1-q3', 'mat1-g1-q4']
  mcqQuestion(bank, { id: g1[0]!, topic: 'Teorem Pythagoras', stem: 'Hitung panjang AC.', correct: '10 cm', wrong: ['14 cm', '2 cm', '48 cm'], reason: 'AC = akar (8^2 + 6^2) = 10.', pool: POOL })
  mcqQuestion(bank, { id: g1[1]!, topic: 'Perimeter', stem: 'Hitung perimeter segi tiga ABC.', correct: '24 cm', wrong: ['14 cm', '48 cm', '22 cm'], reason: '8 + 6 + 10 = 24.', pool: POOL })
  mcqQuestion(bank, { id: g1[2]!, topic: 'Luas', stem: 'Hitung luas segi tiga ABC.', correct: '24 cm²', wrong: ['48 cm²', '14 cm²', '30 cm²'], reason: '1/2 x 8 x 6 = 24.', pool: POOL })
  mcqQuestion(bank, { id: g1[3]!, topic: 'Trigonometri', stem: 'Cari nilai $\\tan \\angle ACB$.', correct: '$\\frac{4}{3}$', wrong: ['$\\frac{3}{4}$', '$\\frac{4}{5}$', '$\\frac{3}{5}$'], reason: 'tan = bertentangan / bersebelahan = 8/6.', pool: POOL })
  bank.addGroup(
    { id: 'mat1-g1', stimulusId: 'mat1-s1', questionIds: g1 },
    {
      id: 'mat1-s1',
      kind: 'diagram',
      label: 'Rajah 1',
      caption: 'Segi tiga ABC dengan sudut tegak di B.',
      alt: 'Segi tiga ABC bersudut tegak di B, AB 8 cm dan BC 6 cm.',
      svg: triangleSvg(8, 6, 'Segi tiga ABC bersudut tegak di B, AB 8 cm dan BC 6 cm.'),
    },
  )

  // Rajah 2: bar chart
  const g2 = ['mat1-g2-q1', 'mat1-g2-q2', 'mat1-g2-q3', 'mat1-g2-q4']
  mcqQuestion(bank, { id: g2[0]!, topic: 'Statistik', stem: 'Cari beza antara markah tertinggi dengan markah terendah.', correct: '45', wrong: ['35', '55', '90'], reason: '90 - 45 = 45.', pool: POOL })
  mcqQuestion(bank, { id: g2[1]!, topic: 'Statistik', stem: 'Hitung jumlah markah bagi kelima-lima mata pelajaran.', correct: '350', wrong: ['340', '360', '70'], reason: '60 + 75 + 80 + 45 + 90.', pool: POOL })
  mcqQuestion(bank, { id: g2[2]!, topic: 'Statistik', stem: 'Hitung min markah.', correct: '70', wrong: ['75', '80', '65'], reason: '350 / 5.', pool: POOL })
  mcqQuestion(bank, { id: g2[3]!, topic: 'Statistik', stem: 'Berapakah bilangan mata pelajaran dengan markah melebihi min?', correct: '3', wrong: ['2', '4', '5'], reason: '75, 80 dan 90 melebihi 70.', pool: POOL })
  bank.addGroup(
    { id: 'mat1-g2', stimulusId: 'mat1-s2', questionIds: g2 },
    {
      id: 'mat1-s2',
      kind: 'diagram',
      label: 'Rajah 2',
      caption: 'Markah seorang murid dalam lima mata pelajaran.',
      alt: 'Carta palang markah: BM 60, BI 75, Mat 80, Sej 45, Sains 90.',
      svg: barChartSvg('Markah murid', ['BM', 'BI', 'Mat', 'Sej', 'Sn'], [60, 75, 80, 45, 90], 'Carta palang markah: BM 60, BI 75, Mat 80, Sej 45, Sains 90.'),
    },
  )

  // Rajah 3: coordinate grid
  const g3 = ['mat1-g3-q1', 'mat1-g3-q2', 'mat1-g3-q3', 'mat1-g3-q4']
  mcqQuestion(bank, { id: g3[0]!, topic: 'Garis lurus', stem: 'Cari kecerunan garis PQ.', correct: '$\\frac{3}{4}$', wrong: ['$\\frac{4}{3}$', '$3$', '$\\frac{5}{4}$'], reason: '(5 - 2) / (5 - 1).', pool: POOL })
  mcqQuestion(bank, { id: g3[1]!, topic: 'Garis lurus', stem: 'Cari titik tengah PQ.', correct: '$(3, 3.5)$', wrong: ['$(3, 3)$', '$(4, 3.5)$', '$(2, 3.5)$'], reason: '((1+5)/2, (2+5)/2).', pool: POOL })
  mcqQuestion(bank, { id: g3[2]!, topic: 'Garis lurus', stem: 'Hitung jarak PQ.', correct: '5 unit', wrong: ['7 unit', '25 unit', '4 unit'], reason: 'akar (4^2 + 3^2) = 5.', pool: POOL })
  mcqQuestion(bank, { id: g3[3]!, topic: 'Garis lurus', stem: 'Cari pintasan-y bagi garis PQ.', correct: '$\\frac{5}{4}$', wrong: ['$2$', '$\\frac{3}{4}$', '$-\\frac{5}{4}$'], reason: 'c = 2 - (3/4)(1).', pool: POOL })
  bank.addGroup(
    { id: 'mat1-g3', stimulusId: 'mat1-s3', questionIds: g3 },
    {
      id: 'mat1-s3',
      kind: 'diagram',
      label: 'Rajah 3',
      caption: 'Titik P(1, 2) dan Q(5, 5) pada satah Cartes.',
      alt: 'Satah Cartes dengan titik P(1, 2) dan Q(5, 5) disambung dengan garis lurus.',
      svg: gridSvg([{ name: 'P', x: 1, y: 2 }, { name: 'Q', x: 5, y: 5 }], 'Satah Cartes dengan titik P(1, 2) dan Q(5, 5).'),
    },
  )
}

/** Proof-of-concept volume: 2 variants per family in the pool, one curated paper of 10 questions. */
export function seedMatK1(bank: Bank): { setA: string[] } {
  for (const f of families) for (let v = 0; v < 2; v++) f.make(bank, v)
  addGroups(bank)
  const singles = [0, 1, 2, 3, 4, 5].map((fi) => id(families[fi]!.key, 0))
  const setA = [...singles.slice(0, 4), ...bank.groups.get('mat1-g1')!.questionIds, ...singles.slice(4)]
  return { setA }
}
