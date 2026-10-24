// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { formStubs } from '@/test-support/form-stubs'

import { answersEquivalent, plainToLatex, previewLatex } from '../domain/math-expr'
import MathField from '../components/MathField.vue'
import MathKeyboard from '../components/MathKeyboard.vue'
import { openKeypad } from '../lib/keypad-owner'
import {
  ALL_KEYS,
  applyKey,
  FUNCTION_ROWS,
  type KeyPress,
  type MathKey,
  NUMBER_ROWS,
  SHARED_KEYS,
  SYMBOL_ROWS,
} from '../lib/math-keys'

afterEach(() => {
  vi.unstubAllGlobals()
  openKeypad.value = null
  document.body.innerHTML = ''
})

/** The 35 keys of the previous keypad (id, accessible name, what it inserts or does). */
const OLD_KEYS: Record<
  string,
  { aria: string; insert?: string; cursor?: number; action?: string }
> = {
  frac: { aria: 'Pecahan', insert: '()/()', cursor: 1 },
  pow: { aria: 'Kuasa', insert: '^()', cursor: 2 },
  sq: { aria: 'Kuasa dua', insert: '^2' },
  sqrt: { aria: 'Punca kuasa dua', insert: '√()', cursor: 2 },
  pi: { aria: 'Pi', insert: 'π' },
  pm: { aria: 'Tambah atau tolak', insert: '±' },
  '7': { aria: '7', insert: '7' },
  '8': { aria: '8', insert: '8' },
  '9': { aria: '9', insert: '9' },
  times: { aria: 'Darab', insert: '×' },
  div: { aria: 'Bahagi', insert: '÷' },
  back: { aria: 'Padam', action: 'backspace' },
  '4': { aria: '4', insert: '4' },
  '5': { aria: '5', insert: '5' },
  '6': { aria: '6', insert: '6' },
  plus: { aria: 'Tambah', insert: '+' },
  minus: { aria: 'Tolak', insert: '-' },
  left: { aria: 'Kursor ke kiri', action: 'left' },
  '1': { aria: '1', insert: '1' },
  '2': { aria: '2', insert: '2' },
  '3': { aria: '3', insert: '3' },
  lp: { aria: 'Kurungan buka', insert: '(' },
  rp: { aria: 'Kurungan tutup', insert: ')' },
  right: { aria: 'Kursor ke kanan', action: 'right' },
  '0': { aria: '0', insert: '0' },
  dot: { aria: 'Titik perpuluhan', insert: '.' },
  x: { aria: 'Pemboleh ubah x', insert: 'x' },
  y: { aria: 'Pemboleh ubah y', insert: 'y' },
  eq: { aria: 'Sama dengan', insert: '=' },
  lt: { aria: 'Kurang daripada', insert: '<' },
  gt: { aria: 'Lebih daripada', insert: '>' },
  le: { aria: 'Kurang daripada atau sama dengan', insert: '≤' },
  ge: { aria: 'Lebih daripada atau sama dengan', insert: '≥' },
  percent: { aria: 'Peratus', insert: '%' },
  comma: { aria: 'Koma', insert: ', ' },
}

/** Stand-in for Nuxt UI's UButton (the plugin cannot load under Vitest): a native button. */
const UButtonStub = defineComponent({
  inheritAttrs: false,
  setup(_p, { attrs, slots }) {
    return () => h('button', attrs, slots.default?.())
  },
})

const ids = (rows: MathKey[][]): string[][] => rows.map((r) => r.map((k) => k.id))

describe('keypad key map (Casio style)', () => {
  it('keeps every key of the previous keypad with the same name and effect', () => {
    expect(Object.keys(OLD_KEYS)).toHaveLength(35)
    const byId = new Map(ALL_KEYS.map((k) => [k.id, k]))
    for (const [id, old] of Object.entries(OLD_KEYS)) {
      const k = byId.get(id)
      expect(k, `key ${id} is missing`).toBeDefined()
      expect(k!.aria).toBe(old.aria)
      expect(k!.insert).toBe(old.insert)
      expect(k!.cursor).toBe(old.cursor)
      expect(k!.action).toBe(old.action)
    }
  })

  it('has unique ids, a BM accessible name on every key, and adds AC and the scientific keys', () => {
    const all = ALL_KEYS.map((k) => k.id)
    expect(new Set(all).size).toBe(all.length)
    for (const k of ALL_KEYS) expect(k.aria.length).toBeGreaterThan(0)
    for (const id of ['clear', 'inv', 'sin', 'cos', 'tan', 'log', 'ln', 'deg', 'e10']) {
      expect(all).toContain(id)
    }
    expect(ALL_KEYS.find((k) => k.id === 'clear')).toMatchObject({
      aria: 'AC, kosongkan semua',
      action: 'clear',
    })
  })

  it('lays the number block out like a Casio: digits contiguous, DEL AC and operators on the right', () => {
    expect(ids(NUMBER_ROWS)).toEqual([
      ['7', '8', '9', 'back', 'clear'],
      ['4', '5', '6', 'times', 'div'],
      ['1', '2', '3', 'plus', 'minus'],
      ['0', 'dot', 'e10', 'left', 'right'],
    ])
  })

  it('puts the function area above: fraction, root, powers first, then trig and log', () => {
    expect(ids(FUNCTION_ROWS)).toEqual([
      ['frac', 'sqrt', 'sq', 'pow', 'inv'],
      ['sin', 'cos', 'tan', 'log', 'ln'],
    ])
    expect(SHARED_KEYS.map((k) => k.id)).toEqual(['lp', 'rp', 'pi', 'deg'])
    expect(ids(SYMBOL_ROWS).flat().sort()).toEqual(
      ['x', 'y', 'comma', 'percent', 'pm', 'lt', 'gt', 'le', 'ge', 'eq'].sort(),
    )
  })

  it('renders the groups top to bottom and switches the layer', async () => {
    const w = mount(MathKeyboard, {
      props: { label: 'Papan kekunci matematik' },
      global: { components: { UButton: UButtonStub } },
    })
    const order = w.findAll('button[data-key]').map((b) => b.attributes('data-key'))
    expect(order).toEqual([
      'frac',
      'sqrt',
      'sq',
      'pow',
      'inv',
      'sin',
      'cos',
      'tan',
      'log',
      'ln',
      'lp',
      'rp',
      'pi',
      'deg',
      'layer',
      '7',
      '8',
      '9',
      'back',
      'clear',
      '4',
      '5',
      '6',
      'times',
      'div',
      '1',
      '2',
      '3',
      'plus',
      'minus',
      '0',
      'dot',
      'e10',
      'left',
      'right',
    ])
    expect(w.get('[data-key=frac]').attributes('aria-label')).toBe('Pecahan')
    await w.get('[data-key=layer]').trigger('click')
    expect(w.find('[data-key=x]').exists()).toBe(true)
    expect(w.find('[data-key=frac]').exists()).toBe(false)
    expect(w.find('[data-key="7"]').exists()).toBe(true)
    await w.get('[data-key=layer]').trigger('click')
    expect(w.find('[data-key=frac]').exists()).toBe(true)
  })

  it('emits what a key inserts and closes on Escape', async () => {
    const w = mount(MathKeyboard, {
      props: { label: 'Papan kekunci matematik' },
      global: { components: { UButton: UButtonStub } },
    })
    await w.get('[data-key=sqrt]').trigger('click')
    await w.get('[data-key=clear]').trigger('click')
    expect(w.emitted('press')).toEqual([[{ insert: '√()', cursor: 2 }], [{ action: 'clear' }]])
    await w.get('[data-testid=math-keyboard]').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('close')).toHaveLength(1)
  })
})

describe('applyKey (insert, DEL, AC, cursor)', () => {
  const press = (k: string): KeyPress => {
    const key = ALL_KEYS.find((x) => x.id === k)!
    return key.action ? { action: key.action } : { insert: key.insert, cursor: key.cursor }
  }

  it('inserts at the caret and puts the caret inside a template', () => {
    expect(applyKey('2+', 2, 2, press('frac'))).toEqual({ text: '2+()/()', caret: 3 })
    expect(applyKey('', 0, 0, press('sin'))).toEqual({ text: 'sin()', caret: 4 })
    expect(applyKey('3', 1, 1, press('e10'))).toEqual({ text: '3×10^()', caret: 6 })
    expect(applyKey('x', 1, 1, press('inv'))).toEqual({ text: 'x^(-1)', caret: 6 })
  })

  it('DEL removes one character, or an empty () pair in one step, or the selection', () => {
    expect(applyKey('12', 2, 2, press('back'))).toEqual({ text: '1', caret: 1 })
    expect(applyKey('2√()', 3, 3, press('back'))).toEqual({ text: '2√', caret: 2 })
    expect(applyKey('1234', 1, 3, press('back'))).toEqual({ text: '14', caret: 1 })
    expect(applyKey('1', 0, 0, press('back'))).toEqual({ text: '1', caret: 0 })
  })

  it('AC clears the whole line', () => {
    expect(applyKey('(1)/(2)+3', 4, 4, press('clear'))).toEqual({ text: '', caret: 0 })
  })

  it('right steps over )/( of a fraction; left stops at the start', () => {
    expect(applyKey('(1)/(2)', 2, 2, press('right'))).toEqual({ text: '(1)/(2)', caret: 5 })
    expect(applyKey('12', 2, 2, press('right'))).toEqual({ text: '12', caret: 2 })
    expect(applyKey('12', 0, 0, press('left'))).toEqual({ text: '12', caret: 0 })
  })
})

describe('MathField with the keypad', () => {
  it('AC empties the line and the stored value', async () => {
    const w = mount(MathField, {
      props: { modelValue: '\\frac{1}{2}', label: 'Langkah 1' },
      global: { components: { ...formStubs, UButton: UButtonStub, UIcon: { template: '<i />' } } },
      attachTo: document.body,
    })
    expect((w.get('input').element as HTMLInputElement).value).toBe('1/2')
    await w.get('[data-testid=math-keypad-toggle]').trigger('click')
    await w.get('[data-key=clear]').trigger('click')
    await w.vm.$nextTick()
    expect((w.get('input').element as HTMLInputElement).value).toBe('')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([''])
    w.unmount()
  })
})

describe('keypad keeps the field and its preview in view (FB-047)', () => {
  const global = {
    components: { ...formStubs, UButton: UButtonStub, UIcon: { template: '<i />' } },
  }

  it('previews fractions stacked, also with a power on the denominator', () => {
    expect(previewLatex('(7)/(3)')).toBe('\\frac{7}{3}')
    expect(previewLatex('(7)/(3)^2')).toBe('\\frac{7}{3^{2}}')
    expect(previewLatex('1/2+x^2')).toBe('\\frac{1}{2}+x^{2}')
    expect(previewLatex('x/y^2')).toBe('\\frac{x}{y^{2}}')
    expect(previewLatex('()/()')).toBe('\\frac{}{}')
    // the stored answer is unchanged by the preview conversion
    expect(plainToLatex('(7)/(3)')).toBe('\\frac{7}{3}')
    expect(plainToLatex('(7)/(3)^2')).toBe('(7)/(3)^{2}')
  })

  it('previews functions upright, the degree sign and a literal percent', () => {
    expect(previewLatex('sin(30°)')).toBe('\\sin (30^{\\circ})')
    expect(previewLatex('log(100)+ln(e)')).toBe('\\log (100)+\\ln (e)')
    expect(previewLatex('50%')).toBe('50\\%')
    expect(previewLatex('2×10^(3)')).toBe('2\\times 10^{3}')
    expect(previewLatex('')).toBe('')
  })

  it('renders a stacked fraction in the preview, above the docked keypad', async () => {
    const w = mount(MathField, {
      props: { modelValue: '(7)/(3)^{2}', label: 'Langkah 1' },
      global,
      attachTo: document.body,
    })
    await w.get('[data-testid=math-keypad-toggle]').trigger('click')
    const preview = w.get('[data-testid=math-preview]')
    expect(preview.find('.mfrac').exists()).toBe(true)
    const dock = w.get('[data-testid=math-keyboard-dock]')
    // DOM order: input line, preview, keypad dock
    const order = [
      ...w.element.querySelectorAll(
        'input, [data-testid=math-preview], [data-testid=math-keyboard-dock]',
      ),
    ]
    expect(
      order.map((e) => (e.tagName === 'INPUT' ? 'input' : e.getAttribute('data-testid'))),
    ).toEqual(['input', 'math-preview', 'math-keyboard-dock'])
    expect(dock.classes()).toContain('fixed')
    expect(dock.classes()).toContain('md:static')
    // inline from md: no spacer, the dock is a normal block
    expect(w.find('[data-testid=math-keyboard-spacer]').exists()).toBe(false)
    w.unmount()
  })

  it('opens one keypad at a time and Escape closes it', async () => {
    // Both fields in one app: useId gives each its own id there.
    const Two = {
      components: { MathField },
      template:
        '<div><MathField model-value="" label="Langkah 1" /><MathField model-value="" label="Langkah 2" /></div>',
    }
    const w = mount(Two, { global, attachTo: document.body })
    const toggles = w.findAll('[data-testid=math-keypad-toggle]')
    const inputs = w.findAll('input')
    await toggles[0]!.trigger('click')
    expect(w.findAll('[data-testid=math-keyboard]')).toHaveLength(1)
    expect(inputs[0]!.attributes('inputmode')).toBe('none')
    await toggles[1]!.trigger('click')
    expect(w.findAll('[data-testid=math-keyboard]')).toHaveLength(1)
    expect(inputs[0]!.attributes('inputmode')).toBe('text')
    expect(inputs[1]!.attributes('inputmode')).toBe('none')
    await w.get('[data-testid=math-keyboard]').trigger('keydown', { key: 'Escape' })
    expect(w.find('[data-testid=math-keyboard]').exists()).toBe(false)
    w.unmount()
  })
})

describe('new keys: accessible names and what the marker makes of them', () => {
  const OLD_IDS = new Set(Object.keys(OLD_KEYS))

  it('names every new key starting with its visible text (WCAG 2.5.3)', () => {
    const fresh = ALL_KEYS.filter((k) => !OLD_IDS.has(k.id))
    expect(fresh.map((k) => k.id).sort()).toEqual(
      ['clear', 'cos', 'deg', 'e10', 'inv', 'ln', 'log', 'sin', 'tan'].sort(),
    )
    for (const k of fresh) expect(k.aria.toLowerCase().startsWith(k.label.toLowerCase())).toBe(true)
  })

  it('announces the layer switch', async () => {
    const w = mount(MathKeyboard, {
      props: { label: 'Papan kekunci matematik' },
      global: { components: { UButton: UButtonStub } },
    })
    expect(w.get('[data-testid=math-layer-status]').text()).toBe('Lapisan fungsi')
    await w.get('[data-key=layer]').trigger('click')
    expect(w.get('[data-testid=math-layer-status]').text()).toBe('Lapisan simbol')
    expect(w.get('[data-key=layer]').text()).toBe('Fungsi')
  })

  it.each([
    ['sin(30°)', '1/2'],
    ['cos(60°)', '0.5'],
    ['tan(45)', '1'],
    ['log(100)', '2'],
    ['ln(1)', '0'],
    ['3×10^(4)', '30000'],
    ['2.5×10^(-3)', '0.0025'],
    ['x^(-1)', '1/x'],
    ['(7)/(3)^2', '7/9'],
  ])(
    'the marker reads %s as %s (typed through the keypad and stored as LaTeX)',
    (typed, expected) => {
      expect(answersEquivalent(typed, expected)).toBe(true)
      expect(answersEquivalent(plainToLatex(typed), expected)).toBe(true)
    },
  )
})

describe('keypad closing (FB-047 follow-up)', () => {
  const global = {
    components: { ...formStubs, UButton: UButtonStub, UIcon: { template: '<i />' } },
  }
  const phone = (): void => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: !q.includes('min-width'),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
  }

  it('resets the open keypad when its field goes away', async () => {
    const w = mount(MathField, { props: { modelValue: '', label: 'Langkah 1' }, global })
    await w.get('[data-testid=math-keypad-toggle]').trigger('click')
    expect(openKeypad.value).not.toBeNull()
    w.unmount()
    expect(openKeypad.value).toBeNull()
  })

  it('on a phone the sheet shows the preview and a Tutup key that closes it', async () => {
    phone()
    const w = mount(MathField, {
      props: { modelValue: '(7)/(3)', label: 'Langkah 1' },
      global,
      attachTo: document.body,
    })
    await w.get('[data-testid=math-keypad-toggle]').trigger('click')
    // one preview only, inside the sheet
    const previews = w.findAll('[data-testid=math-preview]')
    expect(previews).toHaveLength(1)
    expect(
      w.get('[data-testid=math-keyboard-dock]').find('[data-testid=math-preview]').exists(),
    ).toBe(true)
    expect(previews[0]!.find('.mfrac').exists()).toBe(true)
    expect(w.find('[data-testid=math-keyboard-spacer]').exists()).toBe(true)
    const close = w.get('[data-testid=math-keyboard-close]')
    expect(close.attributes('aria-label')).toBe('Tutup papan kekunci')
    expect(close.text()).toBe('Tutup')
    await close.trigger('click')
    expect(w.find('[data-testid=math-keyboard]').exists()).toBe(false)
    expect(w.find('[data-testid=math-preview]').exists()).toBe(true)
    w.unmount()
  })

  it('closes on a tap or focus outside the field and keypad, never on a key', async () => {
    phone()
    const outside = document.createElement('button')
    document.body.append(outside)
    const w = mount(MathField, {
      props: { modelValue: '', label: 'Langkah 1' },
      global,
      attachTo: document.body,
    })
    await w.get('[data-testid=math-keypad-toggle]').trigger('click')
    await w.get('[data-key="7"]').trigger('click')
    await w.get('[data-testid=math-keyboard-dock]').trigger('click')
    expect(w.find('[data-testid=math-keyboard]').exists()).toBe(true)
    outside.click()
    await w.vm.$nextTick()
    expect(w.find('[data-testid=math-keyboard]').exists()).toBe(false)

    await w.get('[data-testid=math-keypad-toggle]').trigger('click')
    expect(w.find('[data-testid=math-keyboard]').exists()).toBe(true)
    outside.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-testid=math-keyboard]').exists()).toBe(false)
    w.unmount()
  })

  it('Tutup gives the focus to the keypad toggle, not to the page', async () => {
    phone()
    const w = mount(MathField, {
      props: { modelValue: '1', label: 'Langkah 1' },
      global,
      attachTo: document.body,
    })
    await w.get('[data-testid=math-keypad-toggle]').trigger('click')
    await w.get('[data-testid=math-keyboard-close]').trigger('click')
    expect(document.activeElement).toBe(w.get('[data-testid=math-keypad-toggle]').element)
    w.unmount()
  })

  it('asks the matching media query for md (48rem) and lets the owner pick the inputmode', async () => {
    const queries: string[] = []
    vi.stubGlobal('matchMedia', (q: string) => {
      queries.push(q)
      return {
        matches: true,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }
    })
    const w = mount(MathField, {
      props: { modelValue: '', label: 'Jawapan akhir', inputmode: 'decimal' },
      global,
      attachTo: document.body,
    })
    expect(queries).toContain('(min-width: 48rem)')
    expect(w.get('input').attributes('inputmode')).toBe('decimal')
    await w.get('[data-testid=math-keypad-toggle]').trigger('click')
    expect(w.get('input').attributes('inputmode')).toBe('none')
    await w.get('[data-testid=math-keypad-toggle]').trigger('click')
    expect(w.get('input').attributes('inputmode')).toBe('decimal')
    w.unmount()
  })

  it('the answer field is the 44 px size on phones and the 52 px size from md', async () => {
    phone()
    const small = mount(MathField, { props: { modelValue: '', label: 'Langkah 1' }, global })
    await small.vm.$nextTick()
    expect(small.findComponent({ name: 'Input' }).props('size')).toBe('sm')
    small.unmount()
    vi.unstubAllGlobals()
    const wide = mount(MathField, { props: { modelValue: '', label: 'Langkah 1' }, global })
    await wide.vm.$nextTick()
    expect(wide.findComponent({ name: 'Input' }).props('size')).toBe('lg')
    wide.unmount()
  })
})
