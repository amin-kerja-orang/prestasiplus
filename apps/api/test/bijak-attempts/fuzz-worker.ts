/**
 * Run as a child process by attempts-hardening.spec.ts (a synchronous infinite loop cannot be
 * interrupted inside the test runner, so the parent kills this process on a timeout).
 * Feeds defused random strings to the RAW engine reader and through the wrapper marking functions.
 */
import { latexToPlain, numericValue as rawNumericValue } from '../../../../src/modules/m28-bijak-spm/domain/math-expr'
import { defuseRootIndex, gradePart, isBlank } from '../../src/modules/bijak/attempts/exam-core.adapter'

const TOKENS = ['\\sqrt', '[', ']', '{', '}', '\\mathrm{', '\\text{', '\\text{}', '\\dfrac', '\\left', '\\right', '$', '\\,', '\\s', 'qrt', '\\tex', 't{', ' ', '2', 'x', '^', '\\frac', '\\sqrt[', '\\sqrt[3]']
let seed = Number(process.argv[2] ?? 4242)
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
const make = () => {
  let s = ''
  for (let k = 1 + Math.floor(rnd() * 16); k > 0; k--) s += TOKENS[Math.floor(rnd() * TOKENS.length)]
  return s
}
const part = { id: 'p', label: 'a', prompt: '', marks: 1, kind: 'numeric' } as const
const scheme = { kind: 'points', model: '', points: [], final: { display: '1', accept: ['1'], tolerance: 0 } } as never

const explicit = ['\\mathrm{\\sqrt\\text{}\\text{}[', '\\sqrt[\\sqrt[', '\\sqrt[a\\sqrt[', '\\sqrt[\\sqrt[2]]', '\\frac{\\sqrt[2}{3]}']
for (let n = 0; n < 3000; n++) {
  const a = explicit[n] ?? make()
  const b = explicit[n] ?? make()
  const da = defuseRootIndex(a)
  const db = defuseRootIndex(b)
  latexToPlain(da) // the raw engine reader, on defused text
  latexToPlain(`${da} ${db}`) // what grading builds by joining text, final and steps
  rawNumericValue(da)
  isBlank({ final: a, steps: [b] })
  gradePart({ part, scheme, answer: { final: a, steps: [b], text: a }, ctx: { finals: {} } as never })
}
console.log('fuzz-ok')
