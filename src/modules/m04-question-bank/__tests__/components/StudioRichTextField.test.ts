// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import StudioRichTextField from '../../components/studio/StudioRichTextField.vue'

const api = vi.hoisted(() => ({ uploadStudioImage: vi.fn() }))
vi.mock('../../api/studio', () => api)

let w: VueWrapper | null = null
afterEach(() => {
  w?.unmount()
  w = null
  vi.clearAllMocks()
})

const Host = defineComponent({
  components: { StudioRichTextField },
  props: { initial: { type: String, default: '' } },
  setup(p) {
    return { text: ref(p.initial) }
  },
  template: '<StudioRichTextField v-model="text" testid="f" /><output data-testid="out">{{ text }}</output>',
})
const mountField = (initial = ''): VueWrapper => {
  w = mount(Host, { props: { initial }, attachTo: document.body })
  return w
}
const t = (id: string) => w!.get(`[data-testid="${id}"]`)
const area = () => t('f').element as HTMLTextAreaElement
const out = () => t('out').text()
const select = (a: number, b: number) => {
  area().focus()
  area().setSelectionRange(a, b)
}

describe('StudioRichTextField', () => {
  it('renders the 20 toolbar buttons with 44px targets and the textarea', () => {
    mountField()
    expect(w!.findAll('[data-testid^="f-tb-"]')).toHaveLength(20)
    expect(t('f-tb-bold').classes()).toContain('min-h-11')
    expect(area().tagName).toBe('TEXTAREA')
  })

  it('wraps the selection', async () => {
    mountField('ab cd')
    select(3, 5)
    await t('f-tb-underline').trigger('click')
    expect(out()).toBe('ab <u>cd</u>')
  })

  it('inserts at the caret', async () => {
    mountField('ab')
    select(1, 1)
    await t('f-tb-gap').trigger('click')
    expect(out()).toBe('a{{gap:1}}b')
  })

  it('typing updates the model; undo and redo walk the history', async () => {
    mountField('ab')
    select(2, 2)
    await t('f-tb-bold').trigger('click')
    expect(out()).toBe('ab<b></b>')
    await t('f-tb-undo').trigger('click')
    expect(out()).toBe('ab')
    await t('f-tb-redo').trigger('click')
    expect(out()).toBe('ab<b></b>')
  })

  it('math dialog: invalid formula shows the error, valid one inserts $latex$', async () => {
    mountField('x ')
    select(2, 2)
    await t('f-tb-math').trigger('click')
    await flushPromises()
    const input = document.body.querySelector('[data-testid="f-math-input"]') as HTMLInputElement
    expect(document.body.textContent).toContain('Matematik dalam baris (LaTeX)')
    input.value = '\\frac{1'
    input.dispatchEvent(new Event('input'))
    ;(document.body.querySelector('[data-testid="f-math-insert"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(document.body.textContent).toContain('Formula matematik tidak sah.')
    expect(out()).toBe('x')
    input.value = 'x^2'
    input.dispatchEvent(new Event('input'))
    ;(document.body.querySelector('[data-testid="f-math-insert"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(out()).toBe('x $x^2$')
  })

  it('image: uploads and inserts {{img:token}}; a wrong type is refused without upload', async () => {
    api.uploadStudioImage.mockResolvedValue('abcdefghijklmnopqrstuv')
    mountField('a')
    select(1, 1)
    await t('f-tb-image').trigger('click')
    const input = t('f-image-input').element as HTMLInputElement
    const set = (file: File) => Object.defineProperty(input, 'files', { value: [file], configurable: true })
    set(new File(['x'], 'a.gif', { type: 'image/gif' }))
    await t('f-image-input').trigger('change')
    expect(api.uploadStudioImage).not.toHaveBeenCalled()
    expect(t('f-image-error').text()).toContain('JPG, PNG atau WebP')
    set(new File(['x'], 'a.png', { type: 'image/png' }))
    await t('f-image-input').trigger('change')
    await flushPromises()
    expect(api.uploadStudioImage).toHaveBeenCalledOnce()
    expect(out()).toBe('a{{img:abcdefghijklmnopqrstuv}}')
  })

  it('disabled blocks the buttons', () => {
    w = mount(StudioRichTextField, { props: { modelValue: 'a', testid: 'f', disabled: true }, attachTo: document.body })
    expect(t('f-tb-bold').attributes('disabled')).toBeDefined()
  })
})
