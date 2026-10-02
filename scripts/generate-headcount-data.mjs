// Generator of src/modules/m08-student-performance/mock/seeds/headcount-data.ts (M08-T1b).
//
// Pins (SRS M08 v1.12 §6.3, §6.10), all checked by the console output below:
//  - 744 graded entries: grade counts A+ 125 · A 146 · A- 96 · B+ 47 · B 107 · C+ 24 · C 23 · D 76 · E 28 · G 72 (GPS 3.45);
//  - the 16 platform subject rows of discovery A.2 (entries, Σ points, On Track / Below / Tiada Sasaran);
//  - school 8880: 148 entries, grades 4/36/42/36/18/6/4/1/1/0 (GPS 2.49), 6 subject rows;
//  - class 516: 75 pairs, 34 On Track / 41 Below; level 11: 114 on / 289 below.
// Deterministic (seeded PRNG, no clock): the output is stable.
//
// Run from the repo root:  node scripts/generate-headcount-data.mjs [outFile]
// Default outFile is the data file above; the output is formatted with prettier, so a re-run is
// byte-identical to the committed file unless the inputs here change.
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const DEFAULT_OUT = fileURLToPath(
  new URL('../src/modules/m08-student-performance/mock/seeds/headcount-data.ts', import.meta.url),
)
const OUT = process.argv[2] ?? DEFAULT_OUT

function mulberry(a) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const r2 = (v) => Math.round(v * 100) / 100
function shuffle(arr, rnd) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function solve(rowN, rowPts, colN, seed) {
  const S = rowN.length,
    G = colN.length
  const rnd = mulberry(seed)
  const m = Array.from({ length: S }, () => new Array(G).fill(0))
  const order = []
  for (let s = 0; s < S; s++) for (let k = 0; k < rowN[s]; k++) order.push(s)
  const slots = []
  for (let g = 0; g < G; g++) for (let k = 0; k < colN[g]; k++) slots.push(g)
  const sl = shuffle(slots, rnd)
  order.forEach((s, i) => {
    m[s][sl[i]]++
  })
  const pts = (s) => m[s].reduce((a, c, g) => a + c * g, 0)
  let c = rowPts.reduce((a, p, s) => a + Math.abs(pts(s) - p), 0)
  for (let it = 0; it < 4_000_000 && c > 0; it++) {
    const s1 = Math.floor(rnd() * S),
      s2 = Math.floor(rnd() * S)
    if (s1 === s2) continue
    const g1 = Math.floor(rnd() * G),
      g2 = Math.floor(rnd() * G)
    if (g1 === g2 || m[s1][g1] === 0 || m[s2][g2] === 0) continue
    const d1 = g2 - g1
    const before = Math.abs(pts(s1) - rowPts[s1]) + Math.abs(pts(s2) - rowPts[s2])
    const after = Math.abs(pts(s1) + d1 - rowPts[s1]) + Math.abs(pts(s2) - d1 - rowPts[s2])
    if (after <= before) {
      m[s1][g1]--
      m[s1][g2]++
      m[s2][g2]--
      m[s2][g1]++
      c += after - before
    }
  }
  return c === 0 ? m : null
}

const AR_RANGE = [
  [90, 99],
  [80, 89],
  [70, 79],
  [65, 69],
  [60, 64],
  [55, 59],
  [50, 54],
  [45, 49],
  [40, 44],
  [5, 39],
]
const GRADE_OF = (v) =>
  v >= 90
    ? 0
    : v >= 80
      ? 1
      : v >= 70
        ? 2
        : v >= 65
          ? 3
          : v >= 60
            ? 4
            : v >= 55
              ? 5
              : v >= 50
                ? 6
                : v >= 45
                  ? 7
                  : v >= 40
                    ? 8
                    : 9
const pickAr = (g, rnd) => {
  const [lo, hi] = AR_RANGE[g]
  return lo + Math.floor(rnd() * (hi - lo + 1))
}

/** marks from AR, status, latest checkpoint n, gap limit. Returns [tov, [t1,t2,t3], [a1,a2,a3], etr]. */
function marks(ar, status, n, rnd, gapMax) {
  let tn = null
  if (status === 'on') tn = Math.max(0, ar - Math.floor(rnd() * 9))
  else if (status === 'below') {
    const g = 1 + Math.floor(rnd() * Math.min(gapMax, 100 - ar))
    tn = ar + g
  }
  let tov, targets
  if (tn === null) {
    tov = Math.max(0, Math.min(100, ar + Math.round(rnd() * 12 - 6)))
    targets = [null, null, null]
  } else {
    tov = Math.max(0, tn - 5 * n)
    const step = (tn - tov) / n
    targets = [1, 2, 3].map((i) => Math.min(100, r2(tov + step * i)))
    targets[n - 1] = tn
  }
  const actuals = [null, null, null]
  actuals[n - 1] = ar
  return [tov, targets, actuals, ar]
}
function statusOf(m) {
  let n = -1
  m[2].forEach((v, i) => {
    if (v !== null) n = i
  })
  const ar = m[2][n],
    t = m[1][n]
  return t === null ? 'nt' : ar >= t ? 'on' : 'below'
}

// ------------------------------------------------------------------ stage matrices
const free8880 = {
  n: [20, 24, 37, 32, 5],
  pts: [46, 53, 86, 85, 14],
  col: [1, 32, 37, 29, 12, 2, 3, 1, 1, 0],
}
let m1 = null
for (let s = 1; s < 50 && !m1; s++) m1 = solve(free8880.n, free8880.pts, free8880.col, s)
const SUBJ2 = [25, 6, 21, 22, 11, 9, 2, 4, 1, 10, 7, 5, 8, 17, 3, 23]
const n2 = [7, 48, 5, 28, 23, 1, 9, 97, 84, 52, 9, 80, 3, 1, 59, 70]
const p2 = [2, 47, 7, 52, 45, 1, 33, 275, 246, 157, 31, 301, 11, 4, 355, 601 - 116]
const col2 = [121, 110, 52, 11, 88, 18, 17, 74, 22, 63]
let m2 = null
for (let s = 1; s < 100 && !m2; s++) m2 = solve(n2, p2, col2, s)
if (!m1 || !m2) throw new Error('no solution')
const gradesOf = (row) => row.flatMap((c, g) => new Array(c).fill(g)) // best first

// ------------------------------------------------------------------ T4 (class 516)
const rndT4 = mulberry(4242)
const ST_ORDER = { on: 0, below: 1, nt: 2 }
const T4_GEN = {
  209: {
    subject: 1,
    on: [3203, 3204, 3205, 3206, 3208, 3209, 3210, 3211, 3213, 3214],
    below: [],
    nt: [3215],
  },
  210: {
    subject: 2,
    on: [3202, 3204, 3205, 3206],
    below: [3207, 3208, 3209, 3212, 3213, 3214, 3215],
    nt: [],
  },
  211: {
    subject: 3,
    on: [3204, 3205, 3206, 3207, 3209, 3210],
    below: [3202, 3203, 3211, 3212, 3214],
    nt: [],
  },
  212: {
    subject: 4,
    on: [3202, 3204, 3206, 3208, 3210, 3213],
    below: [],
    nt: [3203, 3205, 3207, 3209, 3211, 3212, 3215],
  },
}
const T4_OBS = {
  209: [
    [3201, 58, [58, 59, 60], 60],
    [3202, 62, [67, 72, 77], 58],
    [3207, 78, [83, 88, 93], 75],
    [3212, 59, [64, 69, 74], 57],
  ],
  210: [
    [3201, 51, [56, 65, 74], 74],
    [3203, 67, [72, 77, 82], 66],
    [3211, 69, [74, 79, 84], 68],
    [3210, 83, [88, 93, 98], 83],
  ],
  211: [
    [3201, 55, [60, 65, 70], 65],
    [3208, 67, [72, 77, 82], 68],
    [3213, 67, [72, 77, 82], 69],
    [3215, 60, [65, 70, 75], 62],
  ],
  212: [
    [3201, 70.2, [null, null, null], 61],
    [3214, 78, [83, 88, 93], 83],
  ],
}
const T213 = [
  [3204, 73, 93],
  [3205, 76, 91],
  [3206, 69, 90],
  [3207, 68, 81],
  [3208, 63, 80],
  [3209, 54, 77],
  [3210, 74, 75],
  [3211, 55, 73],
  [3202, 68, 65],
  [3212, 54, 65],
  [3213, 64, 64],
  [3214, 59, 61],
  [3203, 46, 57],
  [3201, 67, 56],
  [3215, 42, 51],
]
const RS213 = { 3201: 56.4, 3202: 35.1, 3203: 47 }

const T5_STATUS = {
  1: { on: 9, below: 0, nt: 0 },
  2: { on: 8, below: 5, nt: 0 },
  3: { on: 13, below: 13, nt: 0 },
  4: { on: 10, below: 8, nt: 1 },
  5: { on: 3, below: 2, nt: 0 },
}
const S1ROW = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 }
const freeBySubject = { 1: [], 2: [], 3: [], 4: [], 5: [] }
for (const [cfg, g] of Object.entries(T4_GEN)) {
  for (const st of ['on', 'below', 'nt'])
    for (const p of g[st])
      freeBySubject[g.subject].push({ kind: 't4', cfg: Number(cfg), pupil: p, st })
}
for (const [s, c] of Object.entries(T5_STATUS))
  for (const st of ['on', 'below', 'nt'])
    for (let i = 0; i < c[st]; i++) freeBySubject[Number(s)].push({ kind: 't5', st, i })
const rndG = mulberry(777)
for (const subject of [1, 2, 3, 4, 5]) {
  const rows = shuffle(freeBySubject[subject], rndG).sort((a, b) => ST_ORDER[a.st] - ST_ORDER[b.st])
  const grades = gradesOf(m1[S1ROW[subject]])
  if (grades.length !== rows.length)
    throw new Error(`8880 subject ${subject}: ${grades.length} grades for ${rows.length} rows`)
  rows.forEach((r, i) => {
    r.grade = grades[i]
  })
}
const T4 = { 209: [], 210: [], 211: [], 212: [] }
for (const cfg of [209, 210, 211, 212]) {
  for (const [pupil, tov, targets, ar] of T4_OBS[cfg]) T4[cfg].push([pupil, tov, targets, ar])
  for (const r of freeBySubject[T4_GEN[cfg].subject].filter(
    (x) => x.kind === 't4' && x.cfg === cfg,
  )) {
    const ar = pickAr(r.grade, rndT4)
    const m = marks(ar, r.st, 3, rndT4, 9)
    T4[cfg].push([r.pupil, m[0], m[1], ar])
  }
  T4[cfg].sort((a, b) => a[0] - b[0])
}
const t4Out = {}
for (const cfg of [209, 210, 211, 212]) {
  t4Out[cfg] = T4[cfg].map(([pupil, tov, targets, ar]) => [
    pupil,
    tov,
    targets[0],
    targets[1],
    targets[2],
    ar,
    ar,
    ar,
  ])
}
t4Out[213] = T213.map(([pupil, tov, ar]) => [
  pupil,
  tov,
  tov + 5,
  tov + 10,
  tov + 15,
  ar,
  ar,
  RS213[pupil] ?? ar,
])

const T5_CFG = {
  1: [[517, 9]],
  2: [[517, 13]],
  3: [
    [517, 15],
    [540, 8],
    [628, 3],
  ],
  4: [
    [517, 15],
    [628, 4],
  ],
  5: [[517, 5]],
}
const t5Groups = []
const rndT5 = mulberry(5151)
for (const subject of [1, 2, 3, 4, 5]) {
  const rows = shuffle(
    freeBySubject[subject].filter((x) => x.kind === 't5'),
    rndT5,
  )
  let at = 0
  for (const [classId, count] of T5_CFG[subject]) {
    const list = []
    for (let i = 0; i < count; i++) {
      const r = rows[at++]
      const ar = pickAr(r.grade, rndT5)
      const n = rndT5() < 0.8 ? 3 : 2
      list.push(marks(ar, r.st, n, rndT5, 30))
    }
    t5Groups.push({ classId, subjectId: subject, rows: list })
  }
  if (at !== rows.length) throw new Error('T5 8880 rows left over')
}
t5Groups.push({ classId: 517, subjectId: 9, rows: [[47, [52, 57, 62], [null, null, 62], 62]] })

// ------------------------------------------------------------------ platform others
const ST2 = {
  25: [0, 0, 7],
  6: [0, 1, 47],
  21: [0, 3, 2],
  22: [9, 7, 12],
  11: [19, 4, 0],
  9: [0, 0, 1],
  2: [0, 1, 8],
  4: [58, 27, 12],
  1: [1, 1, 82],
  10: [6, 2, 44],
  7: [3, 2, 4],
  5: [18, 22, 40],
  8: [3, 0, 0],
  17: [1, 0, 0],
  3: [5, 6, 48],
  23: [7, 47, 16],
}
const rndO = mulberry(9090)
const allOthers = []
SUBJ2.forEach((subject, si) => {
  const [on, below, nt] = ST2[subject]
  if (on + below + nt !== n2[si]) throw new Error(`status total subject ${subject}`)
  const grades = gradesOf(m2[si])
  const sts = [
    ...new Array(on).fill('on'),
    ...new Array(below).fill('below'),
    ...new Array(nt).fill('nt'),
  ]
  grades.forEach((g, i) => allOthers.push({ subject, grade: g, st: sts[i] }))
})
function quotas(counts, total) {
  const sum = counts.reduce((a, b) => a + b, 0)
  const exact = counts.map((c) => (c * total) / sum)
  const q = exact.map(Math.floor)
  let left = total - q.reduce((a, b) => a + b, 0)
  const order = exact.map((e, i) => [e - Math.floor(e), i]).sort((a, b) => b[0] - a[0])
  for (const [, i] of order) {
    if (left <= 0) break
    if (q[i] < counts[i]) {
      q[i]++
      left--
    }
  }
  return q
}
const onQ = quotas(
  SUBJ2.map((s) => ST2[s][0]),
  67,
)
const bnQ = quotas(
  SUBJ2.map((s) => ST2[s][1] + ST2[s][2]),
  179,
)
const lvl11 = [],
  lvlOther = []
SUBJ2.forEach((subject, si) => {
  const rows = shuffle(
    allOthers.filter((r) => r.subject === subject),
    rndO,
  )
  const onRows = rows.filter((r) => r.st === 'on'),
    bRows = rows.filter((r) => r.st === 'below'),
    nRows = rows.filter((r) => r.st === 'nt')
  const bnTotal = bRows.length + nRows.length
  const nQ =
    bnTotal === 0 ? 0 : Math.min(nRows.length, Math.round((bnQ[si] * nRows.length) / bnTotal))
  const bQ = bnQ[si] - nQ
  if (bQ > bRows.length) throw new Error(`below quota subject ${subject}`)
  lvl11.push(...onRows.slice(0, onQ[si]), ...bRows.slice(0, bQ), ...nRows.slice(0, nQ))
  lvlOther.push(...onRows.slice(onQ[si]), ...bRows.slice(bQ), ...nRows.slice(nQ))
})
const cnt = (rows, st) => rows.filter((r) => r.st === st).length
console.log(
  'lvl11 others',
  lvl11.length,
  'on',
  cnt(lvl11, 'on'),
  'below+nt',
  cnt(lvl11, 'below') + cnt(lvl11, 'nt'),
  '| other levels',
  lvlOther.length,
  'on',
  cnt(lvlOther, 'on'),
)
if (lvl11.length !== 246 || cnt(lvl11, 'on') !== 67) throw new Error('level 11 quota')

function toGroups(rows, rnd, gapMax) {
  const by = new Map()
  for (const r of rows) {
    const l = by.get(r.subject) ?? []
    l.push(r)
    by.set(r.subject, l)
  }
  return [...by.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([subjectId, list]) => ({
      subjectId,
      rows: shuffle(list, rnd).map((r) => {
        const ar = pickAr(r.grade, rnd)
        const n = rnd() < 0.8 ? 3 : 1 + Math.floor(rnd() * 2)
        return marks(ar, r.st, n, rnd, gapMax)
      }),
    }))
}
const l11Groups = toGroups(lvl11, mulberry(1111), 30)
const otherGroups = toGroups(lvlOther, mulberry(2222), 30)

const AT = [
  [0, 70, 3],
  [0, 69, 3],
  [20, 88, 3],
  [20, 86, 3],
  [0, 60, 3],
  [40, 98, 3],
  [40, 90, 2],
  [20, 69, 3],
  [40, 80, 3],
  [40, 78, 3],
  [60, 96, 3],
  [0, 33.33, 2],
  [20, 51.33, 1],
  [40, 71, 3],
]
const atMarks = AT.map(([ar, t, n]) => {
  const tov = r2(Math.max(0, t - 5 * n))
  const step = (t - tov) / n
  const targets = [1, 2, 3].map((i) => Math.min(100, r2(tov + step * i)))
  targets[n - 1] = t
  const actuals = [null, null, null]
  actuals[n - 1] = ar
  return [tov, targets, actuals, ar]
})
const atGroups = [[0, 4, 5], [1, 7], [2, 10], [3], [6], [8], [9], [11], [12], [13]].map((idx) =>
  idx.map((i) => atMarks[i]),
)

// ------------------------------------------------------------------ verification
const all = []
const push = (subject, grade, st) => all.push({ subject, grade, st })
for (const cfg of [209, 210, 211, 212, 213]) {
  const subject = cfg === 213 ? 5 : T4_GEN[cfg].subject
  for (const row of t4Out[cfg])
    push(subject, GRADE_OF(row[5]), row[4] === null ? 'nt' : row[5] >= row[4] ? 'on' : 'below')
}
for (const g of t5Groups) for (const m of g.rows) push(g.subjectId, GRADE_OF(m[3]), statusOf(m))
for (const g of l11Groups) for (const m of g.rows) push(g.subjectId, GRADE_OF(m[3]), statusOf(m))
for (const g of otherGroups) for (const m of g.rows) push(g.subjectId, GRADE_OF(m[3]), statusOf(m))
for (const g of atGroups) for (const m of g) push(23, GRADE_OF(m[3]), statusOf(m))
push(10, 2, 'on')
push(10, 6, 'below')
push(10, 6, 'on')
push(10, 9, 'below')
push(5, 7, 'below')
push(1, 2, 'on')
console.log('graded', all.length)
const gc = new Array(10).fill(0)
for (const r of all) gc[r.grade]++
console.log(
  'grade counts',
  gc.join(','),
  'expected 125,146,96,47,107,24,23,76,28,72',
  'points',
  gc.reduce((a, c, g) => a + c * g, 0),
)
const EXPECT = {
  25: [7, 2, 0, 0, 7],
  6: [48, 47, 0, 1, 47],
  21: [5, 7, 0, 3, 2],
  22: [28, 52, 9, 7, 12],
  11: [23, 45, 19, 4, 0],
  9: [2, 5, 1, 0, 1],
  2: [37, 95, 13, 16, 8],
  4: [131, 365, 74, 36, 21],
  1: [109, 310, 22, 4, 83],
  10: [56, 180, 8, 4, 44],
  7: [9, 31, 3, 2, 4],
  5: [101, 360, 27, 34, 40],
  8: [3, 11, 3, 0, 0],
  17: [1, 4, 1, 0, 0],
  3: [100, 454, 24, 28, 48],
  23: [84, 601, 7, 61, 16],
}
let bad = 0
for (const [s, exp] of Object.entries(EXPECT)) {
  const rs = all.filter((r) => r.subject === Number(s))
  const got = [
    rs.length,
    rs.reduce((a, r) => a + r.grade, 0),
    cnt(rs, 'on'),
    cnt(rs, 'below'),
    cnt(rs, 'nt'),
  ]
  if (got.join() !== exp.join()) {
    bad++
    console.log('MISMATCH subject', s, got.join(), 'expected', exp.join())
  }
}
console.log(bad === 0 ? 'ALL SUBJECT ROWS MATCH' : 'subject mismatches ' + bad)
const e8880 = []
for (const cfg of [209, 210, 211, 212, 213]) {
  const subject = cfg === 213 ? 5 : T4_GEN[cfg].subject
  for (const row of t4Out[cfg])
    e8880.push({
      subject,
      grade: GRADE_OF(row[5]),
      st: row[4] === null ? 'nt' : row[5] >= row[4] ? 'on' : 'below',
    })
}
for (const g of t5Groups)
  for (const m of g.rows)
    e8880.push({ subject: g.subjectId, grade: GRADE_OF(m[3]), st: statusOf(m) })
const g8 = new Array(10).fill(0)
for (const r of e8880) g8[r.grade]++
console.log(
  '8880',
  e8880.length,
  g8.join(','),
  'expected 4,36,42,36,18,6,4,1,1,0',
  'pts',
  g8.reduce((a, c, g) => a + c * g, 0),
)
for (const s of [2, 3, 1, 5, 4, 9]) {
  const rs = e8880.filter((r) => r.subject === s)
  console.log(
    ' 8880 subj',
    s,
    rs.length,
    rs.reduce((a, r) => a + r.grade, 0),
    cnt(rs, 'on'),
    cnt(rs, 'below'),
    cnt(rs, 'nt'),
  )
}
// T4 totals
let on4 = 0,
  be4 = 0
for (const cfg of [209, 210, 211, 212, 213]) {
  for (const row of t4Out[cfg]) {
    if (row[4] !== null && row[5] >= row[4]) on4++
    else be4++
  }
}
console.log('T4 on/below', on4, be4)
// min gap of generated level-11 below rows
let minGap = 0
for (const g of [...l11Groups, ...t5Groups])
  for (const m of g.rows) {
    let n = -1
    m[2].forEach((v, i) => {
      if (v !== null) n = i
    })
    if (m[1][n] !== null) minGap = Math.min(minGap, m[2][n] - m[1][n])
  }
console.log('min gap of non-observed level-11 rows', minGap)

// ------------------------------------------------------------------ emit
const j = (v) => JSON.stringify(v)
const L = []
L.push(`// Generated by scripts/generate-headcount-data.mjs (node scripts/generate-headcount-data.mjs); do not edit by hand.
/**
 * M08-T1b headcount seed data (SRS M08 v1.12 §6.3, §6.10). GENERATED OFFLINE by a deterministic script
 * (seeded PRNG); the per-subject grade split is generated (unobserved) under the constraint that every
 * platform subject row (discovery A.2: entries, GPS, On Track / Below / Tiada Sasaran) and the 8880 pins
 * (148 entries, GPS 2.49) hold, and the 744 graded entries give the platform grade counts
 * A+ 125 · A 146 · A- 96 · B+ 47 · B 107 · C+ 24 · C 23 · D 76 · E 28 · G 72 (GPS 3.45).
 *
 * Marks are \`[TOV, [OTR1, OTR2, OTR3 targets], [AR1, AR2, AR3], ETR]\` (percent; \`null\` = none).
 * OBSERVED values: the 15 TOV / AR3 pairs of config 213, the 14 at-risk rows of 209-212 and 3201's four
 * rows (T4 below), the 14 T5 at-risk rows (AR, target, checkpoint; the live class names are not mapped).
 * INFERRED: every other mark, the targets of the 3201 rows, ETR = latest AR, RS = AR3 of the class-516
 * rows that carry no observed RS.
 */

/** [tov, targets, actuals, etr] of a 3-OTR entry. */
export type Marks = readonly [
  tov: number,
  targets: readonly (number | null)[],
  actuals: readonly (number | null)[],
  etr: number,
]

/** [pupil, tov, t1, t2, t3, ar3, etr, rs] of a class-516 row. */
export type T4Row = readonly [
  pupil: number,
  tov: number,
  t1: number | null,
  t2: number | null,
  t3: number | null,
  ar3: number,
  etr: number,
  rs: number,
]

export interface MarkGroup {
  readonly subjectId: number
  readonly rows: readonly Marks[]
}

export interface ClassMarkGroup extends MarkGroup {
  readonly classId: number
}
`)
L.push('// prettier-ignore')
L.push('/** Class 516 configs 209-213: one row per pupil. */')
L.push('export const T4_ROWS: Readonly<Record<number, readonly T4Row[]>> = {')
for (const cfg of [209, 210, 211, 212, 213]) {
  L.push(`  ${cfg}: [`)
  for (const r of t4Out[cfg]) L.push(`    ${j(r)},`)
  L.push('  ],')
}
L.push('}\n')
L.push('// prettier-ignore')
L.push(
  "/** The 73 T5 entries of 8880 pupils (class 517 and the school teacher's other classes). */",
)
L.push('export const T5_8880_GROUPS: readonly ClassMarkGroup[] = [')
for (const g of t5Groups) {
  L.push(`  { classId: ${g.classId}, subjectId: ${g.subjectId}, rows: [`)
  for (const m of g.rows) L.push(`    ${j(m)},`)
  L.push('  ] },')
}
L.push(']\n')
L.push('// prettier-ignore')
L.push(
  '/** The 14 observed T5 at-risk rows (S3 "Murid Berisiko"), grouped by the observed class multiplicity. */',
)
L.push('export const AT_RISK_GROUPS: readonly (readonly Marks[])[] = [')
for (const g of atGroups) {
  L.push('  [')
  for (const m of g) L.push(`    ${j(m)},`)
  L.push('  ],')
}
L.push(']\n')
L.push('// prettier-ignore')
L.push(
  '/** Other T5 (level 11) entries of the platform: on 67, below / no target 179 (all graded). */',
)
L.push('export const L11_GROUPS: readonly MarkGroup[] = [')
for (const g of l11Groups) {
  L.push(`  { subjectId: ${g.subjectId}, rows: [`)
  for (const m of g.rows) L.push(`    ${j(m)},`)
  L.push('  ] },')
}
L.push(']\n')
L.push('// prettier-ignore')
L.push(
  '/** Entries of configs of the other levels (Darjah, Tingkatan 1-3): on 63, below / no target 267 (all graded). */',
)
L.push('export const OTHER_LEVEL_GROUPS: readonly MarkGroup[] = [')
for (const g of otherGroups) {
  L.push(`  { subjectId: ${g.subjectId}, rows: [`)
  for (const m of g.rows) L.push(`    ${j(m)},`)
  L.push('  ] },')
}
L.push(']')
writeFileSync(OUT, L.join('\n') + '\n')
execFileSync(
  process.execPath,
  [
    fileURLToPath(new URL('../node_modules/prettier/bin/prettier.cjs', import.meta.url)),
    '--write',
    OUT,
  ],
  {
    stdio: 'inherit',
  },
)
console.log(
  'written; groups',
  t5Groups.length,
  l11Groups.length,
  otherGroups.length,
  atGroups.length,
)
