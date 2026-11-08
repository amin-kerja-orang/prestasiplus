import { describe, expect, it } from 'vitest'

import {
  applyAction,
  emptyHistory,
  imageProblem,
  insertImage,
  insertMath,
  MATH_INVALID,
  nextGapNumber,
  pushHistory,
  redo,
  TOOLBAR,
  undo,
  type TextState,
} from '../../../lib/studio/rich-text'

const st = (value: string, start = value.length, end = start): TextState => ({ value, start, end })

describe('toolbar order (PRD45 3.1.5)', () => {
  it('lists every button in order', () => {
    expect(TOOLBAR.map((b) => b.label)).toEqual([
      'B', 'I', 'U', 'S', '• Senarai', '1. Senarai', '</>', 'Jadual', '+Baris', '+Lajur', '×Jadual', '√x', '√x blok', 'Imej',
      'Baris puisi', 'Dua lajur', 'Kotak teks', 'Penanda ruang kosong', 'Buat asal', 'Buat semula',
    ])
  })
})

describe('inline wrappers', () => {
  it.each([
    ['bold', '<b>x</b>'],
    ['italic', '<i>x</i>'],
    ['underline', '<u>x</u>'],
    ['strike', '<s>x</s>'],
    ['code', '<code>x</code>'],
  ] as const)('%s wraps the selection', (action, out) => {
    const r = applyAction(action, st('x', 0, 1))
    expect(r.value).toBe(out)
    expect(r.value.slice(r.start, r.end)).toBe('x')
  })
  it('an empty selection puts the caret between the tags', () => {
    const r = applyAction('underline', st('ab', 1))
    expect(r.value).toBe('a<u></u>b')
    expect(r.start).toBe(4)
  })
})

describe('blocks', () => {
  it('lists use the selected lines', () => {
    expect(applyAction('ul', st('a\nb', 0, 3)).value).toBe('<ul><li>a</li><li>b</li></ul>')
    expect(applyAction('ol', st('a\nb', 0, 3)).value).toBe('<ol><li>a</li><li>b</li></ol>')
  })
  it('a block starts on its own line', () => {
    expect(applyAction('box', st('Teks ', 5)).value).toBe('Teks \n<p class="box"></p>')
  })
  it('poem: one p.poem per stanza, lines joined by br', () => {
    const r = applyAction('poem', st('a\nb\n\nc\nd', 0, 8))
    expect(r.value).toBe('<p class="poem">a<br>b</p>\n<p class="poem">c<br>d</p>')
  })
  it('two columns use ul.two-col with two li, never div', () => {
    const r = applyAction('twoCol', st('kiri\n\nkanan', 0, 11))
    expect(r.value).toBe('<ul class="two-col"><li>kiri</li><li>kanan</li></ul>')
    expect(r.value).not.toContain('<div')
  })
  it('box wraps the selection in p.box', () => {
    expect(applyAction('box', st('x', 0, 1)).value).toBe('<p class="box">x</p>')
  })
})

describe('tables', () => {
  it('Jadual inserts a 2x2 table', () => {
    const v = applyAction('table', st('')).value
    expect(v).toContain('<table>')
    expect((v.match(/<tr>/g) ?? []).length).toBe(3)
  })
  it('+Baris adds a row with the same number of cells after the caret row', () => {
    const t = applyAction('table', st('')).value
    const r = applyAction('row', st(t, t.indexOf('<td>') + 1))
    expect((r.value.match(/<tr>/g) ?? []).length).toBe(4)
    expect(r.value).toContain('</tr><tr><td></td><td></td></tr>')
  })
  it('+Lajur adds a cell to every row (th in the header)', () => {
    const t = applyAction('table', st('')).value
    const r = applyAction('col', st(t, 3))
    expect((r.value.match(/<th><\/th>/g) ?? []).length).toBe(3)
    expect((r.value.match(/<td><\/td>/g) ?? []).length).toBe(6)
  })
  it('×Jadual removes the table around the caret and nothing else', () => {
    const t = applyAction('table', st('a\n')).value
    const r = applyAction('removeTable', st(t, t.indexOf('<td>') + 1))
    expect(r.value).not.toContain('<table')
    expect(r.value.startsWith('a')).toBe(true)
  })
  it('row, column and remove do nothing outside a table', () => {
    for (const a of ['row', 'col', 'removeTable'] as const) expect(applyAction(a, st('abc', 1)).value).toBe('abc')
  })
})

describe('gap markers', () => {
  it('numbers from 1 and takes the next free integer', () => {
    expect(nextGapNumber('')).toBe(1)
    expect(nextGapNumber('{{gap:1}} {{gap:2}}')).toBe(3)
    expect(nextGapNumber('{{gap:2}}')).toBe(1)
  })
  it('inserts {{gap:N}} at the caret', () => {
    expect(applyAction('gap', st('a {{gap:1}} b ', 14)).value).toBe('a {{gap:1}} b {{gap:2}}')
  })
  it('refuses past 99', () => {
    const all = Array.from({ length: 99 }, (_, i) => `{{gap:${String(i + 1)}}}`).join('')
    expect(nextGapNumber(all)).toBeNull()
    expect(applyAction('gap', st(all)).value).toBe(all)
  })
})

describe('math', () => {
  it('inline: $latex$', () => {
    const r = insertMath(st('a '), 'x^2', false)
    expect(r.error).toBeNull()
    expect(r.state.value).toBe('a $x^2$')
  })
  it('block: $$latex$$ on its own line', () => {
    const r = insertMath(st('a b', 1), '\\frac{1}{2}', true)
    expect(r.state.value).toBe('a\n$$\\frac{1}{2}$$\n b')
  })
  it('invalid or empty formula is refused', () => {
    expect(insertMath(st(''), '\\frac{1', false).error).toBe(MATH_INVALID)
    expect(insertMath(st(''), '  ', false).error).toBe('Formula matematik tidak sah.')
  })
  it('more than 500 characters is refused, 500 is fine', () => {
    expect(insertMath(st(''), 'x'.repeat(501), false).error).toBe(MATH_INVALID)
    expect(insertMath(st(''), 'x'.repeat(500), false).error).toBeNull()
  })
})

describe('image', () => {
  it('inserts {{img:token}}', () => {
    expect(insertImage(st('a '), 'abcdefghijklmnopqrstuv').value).toBe('a {{img:abcdefghijklmnopqrstuv}}')
  })
  it('accepts JPG/PNG/WebP up to 2MB only', () => {
    expect(imageProblem({ type: 'image/png', size: 2 * 1024 * 1024 })).toBeNull()
    expect(imageProblem({ type: 'image/webp', size: 10 })).toBeNull()
    expect(imageProblem({ type: 'image/gif', size: 10 })).not.toBeNull()
    expect(imageProblem({ type: 'image/png', size: 2 * 1024 * 1024 + 1 })).not.toBeNull()
  })
})

describe('undo / redo', () => {
  it('steps back and forward', () => {
    let h = pushHistory(emptyHistory(), st('a'))
    const u = undo(h, st('ab'))!
    expect(u.state.value).toBe('a')
    h = u.history
    expect(redo(h, st('a'))!.state.value).toBe('ab')
  })
  it('nothing to undo or redo returns null', () => {
    expect(undo(emptyHistory(), st(''))).toBeNull()
    expect(redo(emptyHistory(), st(''))).toBeNull()
  })
  it('a new change clears redo', () => {
    const h = undo(pushHistory(emptyHistory(), st('a')), st('ab'))!.history
    expect(pushHistory(h, st('x')).future).toEqual([])
  })
})
