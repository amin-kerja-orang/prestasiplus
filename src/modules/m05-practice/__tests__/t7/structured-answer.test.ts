// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter, RouterView, type Router } from 'vue-router'

import StructuredAnswerPage from '../../pages/StructuredAnswerPage.vue'

const api = vi.hoisted(() => ({ fetchStructuredDetail: vi.fn(), submitStructuredAttempt: vi.fn() }))
const who = vi.hoisted(() => ({ id: null as number | null }))
vi.mock('@/composables', async (orig) => {
  const { computed } = await import('vue')
  return {
    ...(await orig<typeof import('@/composables')>()),
    useSession: () => ({ user: computed(() => (who.id === null ? null : { id: who.id })) }),
  }
})
vi.mock('../../api/practice', () => api)
vi.mock('@/modules/m04-question-bank', () => ({
  ReportQuestionModal: defineComponent({ props: { open: Boolean }, setup: () => () => h('div') }),
}))

/** (a) has (i) and (ii); (ii) has (A) and (B); (b) is a leaf of its own. Four leaves. */
const DETAIL = {
  id: 7,
  subjectId: 1,
  subjectName: 'Matematik',
  levelName: 'Tingkatan 4',
  stimulus: 'Petikan tentang kadar.',
  stimulusImage: null,
  backUrl: '/latihan-berstruktur',
  subQuestions: [
    { id: 1, label: '(a)', text: 'Bahagian a', marks: 0 },
    { id: 2, label: '(a).(i)', text: 'Satu', marks: 2 },
    { id: 3, label: '(a).(ii)', text: 'Dua', marks: 0 },
    { id: 4, label: '(a).(ii).(A)', text: 'Dua A', marks: 1 },
    { id: 5, label: '(a).(ii).(B)', text: 'Dua B', marks: 1 },
    { id: 6, label: '(b)', text: 'Bahagian b', marks: 3 },
  ],
}
const KEY = 'pp:draft:structured:5:7'

let wrapper: VueWrapper | null = null
let router: Router

async function open(url = '/latihan-berstruktur/7/jawab'): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/latihan-berstruktur/:id/jawab', component: StructuredAnswerPage },
      { path: '/latihan-berstruktur', component: { template: '<div id="list" />' } },
    ],
  })
  await router.push(url)
  // Through a RouterView so that the leave guard of the page is registered.
  wrapper = mount(RouterView, {
    attachTo: document.body,
    global: { plugins: [router, createPinia()] },
  })
  await flushPromises()
  return wrapper
}
const boxes = (w: VueWrapper) => w.findAll('[data-testid=sub-answer]')
const body = (sel: string): HTMLElement | null => document.body.querySelector(sel)
const settle = async (): Promise<void> => {
  await flushPromises()
  await vi.advanceTimersByTimeAsync(10)
  await flushPromises()
}

beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.clear()
  who.id = 5
  window.scrollTo = vi.fn()
  api.fetchStructuredDetail.mockReset().mockResolvedValue(DETAIL)
  api.submitStructuredAttempt.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('S5-T11 structured answer: the parts tree', () => {
  it('nests sub-parts under their part, with one box and one mark label per leaf', async () => {
    const w = await open()
    expect(w.findAll('[data-testid^=part-]')).toHaveLength(2)
    expect(boxes(w)).toHaveLength(4)
    expect(w.findAll('[data-testid=sub-marks]').map((m) => m.text())).toEqual([
      '[2 markah]',
      '[1 markah]',
      '[1 markah]',
      '[3 markah]',
    ])
    expect(
      w
        .get('[data-testid=part-1]')
        .findAll('[data-testid=sub-label]')
        .map((l) => l.text()),
    ).toEqual(['(a)', '(a)(i)', '(a)(ii)', '(a)(ii)(A)', '(a)(ii)(B)'])
    expect(w.get('[data-testid=sub-4]').classes()).toContain('ps-6')
    expect(w.get('[data-testid=sub-1]').classes()).not.toContain('ps-3')
    expect(w.get('[data-testid=answer-summary]').text()).toBe('2 bahagian · 7 markah')
  })

  it('shows the stimulus once for the whole tree', async () => {
    const w = await open()
    expect(w.findAll('[data-testid=stimulus-group]')).toHaveLength(1)
    expect(w.text().split('Petikan tentang kadar.').length - 1).toBe(1)
  })

  it('an own passage stimulus equal to the stem is shown once', async () => {
    api.fetchStructuredDetail.mockResolvedValue({
      ...DETAIL,
      stimuli: [{ id: '7-1', kind: 'passage', label: 'Petikan', alt: 'Petikan', text: 'Petikan tentang kadar.' }],
    })
    const w = await open()
    await settle()
    expect(w.text().split('Petikan tentang kadar.').length - 1).toBe(1)
  })

  it('stem dedupe: a passage equal to the stem (ignoring outer spaces) is dropped; a different passage is kept; picture and table are unaffected', async () => {
    api.fetchStructuredDetail.mockResolvedValue({
      ...DETAIL,
      stimuli: [
        { id: '7-1', kind: 'passage', label: 'Sama', alt: 'Sama', text: '  Petikan tentang kadar.  ' },
        { id: '7-2', kind: 'passage', label: 'Lain', alt: 'Lain', text: 'Petikan lain zzkekal.' },
        { id: '7-3', kind: 'image', label: 'Rajah 1', alt: 'Rajah 1', image: { url: '/api/files/tokenBbbbbbbbbbbbbbbbb' } },
        { id: '7-4', kind: 'table', label: 'Jadual 1', alt: 'Jadual 1', table: { head: ['zzkepala'], rows: [['zzsel']] } },
      ],
    })
    const w = await open()
    await settle()
    // The stem once (the stimulus group above), the equal passage not repeated.
    expect(w.text().split('Petikan tentang kadar.').length - 1).toBe(1)
    expect(w.text()).toContain('Petikan lain zzkekal.')
    expect(document.body.querySelector('img[src="/api/files/tokenBbbbbbbbbbbbbbbbb"]')).not.toBeNull()
    expect(w.text()).toContain('zzsel')
  })

  it('stem dedupe: with an empty stem a passage is kept', async () => {
    api.fetchStructuredDetail.mockResolvedValue({
      ...DETAIL,
      stimulus: '',
      stimuli: [{ id: '7-1', kind: 'passage', label: 'Petikan', alt: 'Petikan', text: 'Petikan zzsaja.' }],
    })
    const w = await open()
    await settle()
    expect(w.text()).toContain('Petikan zzsaja.')
  })

  it('shows the linked rajah (own or group stimulus) next to the text: its picture is rendered', async () => {
    api.fetchStructuredDetail.mockResolvedValue({
      ...DETAIL,
      stimuli: [{ id: '7-1', kind: 'image', label: 'Rajah 1', alt: 'Rajah 1', image: { url: '/api/files/tokenAaaaaaaaaaaaaaaaa' } }],
    })
    await open()
    await settle()
    expect(document.body.querySelector('img[src="/api/files/tokenAaaaaaaaaaaaaaaaa"]')).not.toBeNull()
  })
})

describe('S5-T11 structured answer: autosave and restore (AC-MUR-17-2)', () => {
  it('saves the draft after 800 ms and restores it when the page reopens', async () => {
    const w = await open()
    await boxes(w)[1]?.setValue('jawapan dua A')
    expect(window.localStorage.getItem(KEY)).toBeNull()
    await vi.advanceTimersByTimeAsync(800)
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')).toEqual({ 4: 'jawapan dua A' })
    w.unmount()
    const again = await open()
    expect((boxes(again)[1]?.element as HTMLTextAreaElement).value).toBe('jawapan dua A')
    expect((boxes(again)[0]?.element as HTMLTextAreaElement).value).toBe('')
  })

  it('flushes the draft when the page unmounts before the debounce', async () => {
    const w = await open()
    await boxes(w)[0]?.setValue('cepat')
    w.unmount()
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')).toEqual({ 2: 'cepat' })
  })

  it('keeps one draft per user and question', async () => {
    window.localStorage.setItem('pp:draft:structured:5:8', JSON.stringify({ 2: 'soalan lain' }))
    const w = await open()
    expect((boxes(w)[0]?.element as HTMLTextAreaElement).value).toBe('')
  })

  it('clears the draft after a successful submit', async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ 2: 'a', 4: 'b', 5: 'c', 6: 'd' }))
    api.submitStructuredAttempt.mockResolvedValue({
      id: 'a1',
      marks: [],
      totalAwarded: 0,
      totalMax: 7,
      modelAnswers: [],
    })
    const w = await open()
    await w.get('form').trigger('submit')
    await settle()
    expect(api.submitStructuredAttempt).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it('keeps the draft when the submit fails', async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ 2: 'a', 4: 'b', 5: 'c', 6: 'd' }))
    api.submitStructuredAttempt.mockRejectedValue(new Error('x'))
    const w = await open()
    await w.get('form').trigger('submit')
    await settle()
    expect(w.find('[data-testid=answer-errors]').exists()).toBe(true)
    expect(window.localStorage.getItem(KEY)).not.toBeNull()
  })

  it('works when localStorage throws', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- re-called with the right `this` below
    const real = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, k: string) {
      if (k.startsWith('pp:draft:structured')) throw new Error('blocked')
      return real.call(this, k)
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k: string) {
      if (k.startsWith('pp:draft:structured')) throw new Error('full')
    })
    const w = await open()
    await boxes(w)[0]?.setValue('masih boleh')
    await vi.advanceTimersByTimeAsync(800)
    expect((boxes(w)[0]?.element as HTMLTextAreaElement).value).toBe('masih boleh')
  })
})

describe('S5-T11 structured answer: Hantar & Semak', () => {
  it('asks first when leaves are blank and counts the blank leaves', async () => {
    const w = await open()
    await boxes(w)[0]?.setValue('satu')
    await w.get('form').trigger('submit')
    await settle()
    expect(api.submitStructuredAttempt).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Hantar & Semak sekarang?')
    expect(document.body.textContent).toContain('Anda belum menjawab 3 bahagian.')
  })

  it('starts focus on "Kembali" and closes without sending', async () => {
    const w = await open()
    await w.get('form').trigger('submit')
    await settle()
    const back = body('[data-testid=blank-back]')
    expect(back?.textContent).toContain('Kembali')
    expect(document.activeElement).toBe(back)
    expect(back?.className).toContain('min-h-11')
    back?.click()
    await settle()
    expect(body('[data-testid=blank-back]')).toBeNull()
    expect(api.submitStructuredAttempt).not.toHaveBeenCalled()
  })

  it('Esc picks the safe button and sends nothing', async () => {
    const w = await open()
    await w.get('form').trigger('submit')
    await settle()
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await settle()
    expect(body('[data-testid=blank-back]')).toBeNull()
    expect(api.submitStructuredAttempt).not.toHaveBeenCalled()
  })

  it('sends from the dialog and shows "Menyemak…" while sending', async () => {
    let done: (v: unknown) => void = () => undefined
    api.submitStructuredAttempt.mockReturnValue(new Promise((r) => (done = r)))
    const w = await open()
    await w.get('form').trigger('submit')
    await settle()
    body('[data-testid=blank-submit]')?.click()
    await flushPromises()
    expect(api.submitStructuredAttempt).toHaveBeenCalledTimes(1)
    expect(w.get('[data-testid=answer-submit]').text()).toBe('Menyemak…')
    expect(w.get('[data-testid=answer-submit]').attributes('disabled')).toBeDefined()
    expect(body('[data-testid=blank-submit]')?.textContent).toContain('Menyemak…')
    done({ id: 'a1', marks: [], totalAwarded: 3, totalMax: 7, modelAnswers: [] })
    await settle()
    expect(w.get('[data-testid=answer-total]').text()).toBe('Jumlah: 3/7 markah')
    expect(body('[data-testid=blank-back]')).toBeNull()
  })

  it('goes straight through when every leaf is answered', async () => {
    api.submitStructuredAttempt.mockResolvedValue({
      id: 'a1',
      marks: [],
      totalAwarded: 7,
      totalMax: 7,
      modelAnswers: [],
    })
    const w = await open()
    for (const b of boxes(w)) await b.setValue('x')
    await w.get('form').trigger('submit')
    await settle()
    expect(document.body.textContent).not.toContain('Anda belum menjawab')
    expect(api.submitStructuredAttempt).toHaveBeenCalledTimes(1)
  })

  it('treats a whitespace-only answer as blank', async () => {
    const w = await open()
    for (const b of boxes(w)) await b.setValue('x')
    await boxes(w)[2]?.setValue('   ')
    await w.get('form').trigger('submit')
    await settle()
    expect(document.body.textContent).toContain('Anda belum menjawab 1 bahagian.')
  })
})

describe('S5-T11 structured answer: leaving', () => {
  it('leaves without asking when nothing is typed', async () => {
    await open()
    await router.push('/latihan-berstruktur')
    await settle()
    expect(router.currentRoute.value.path).toBe('/latihan-berstruktur')
  })

  it('asks with typed answers; "Kekal" stays, "Keluar" leaves', async () => {
    const w = await open()
    await boxes(w)[0]?.setValue('x')
    const nav = router.push('/latihan-berstruktur')
    await settle()
    expect(document.body.textContent).toContain('Keluar daripada percubaan?')
    expect(document.body.textContent).toContain('Jawapan anda disimpan.')
    const stay = body('[data-testid=leave-stay]')
    expect(document.activeElement).toBe(stay)
    stay?.click()
    await settle()
    await nav
    expect(router.currentRoute.value.path).toBe('/latihan-berstruktur/7/jawab')

    const nav2 = router.push('/latihan-berstruktur')
    await settle()
    body('[data-testid=leave-exit]')?.click()
    await settle()
    await nav2
    expect(router.currentRoute.value.path).toBe('/latihan-berstruktur')
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')).toEqual({ 2: 'x' })
  })

  it('does not ask after a successful submit', async () => {
    api.submitStructuredAttempt.mockResolvedValue({
      id: 'a1',
      marks: [],
      totalAwarded: 7,
      totalMax: 7,
      modelAnswers: [],
    })
    const w = await open()
    for (const b of boxes(w)) await b.setValue('x')
    await w.get('form').trigger('submit')
    await settle()
    await router.push('/latihan-berstruktur')
    await nextTick()
    expect(router.currentRoute.value.path).toBe('/latihan-berstruktur')
  })
})

describe('S5-T11 structured answer: review fixes', () => {
  it('flushes the draft on pagehide, before the 800 ms debounce', async () => {
    const w = await open()
    await boxes(w)[0]?.setValue('segera')
    expect(window.localStorage.getItem(KEY)).toBeNull()
    window.dispatchEvent(new Event('pagehide'))
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')).toEqual({ 2: 'segera' })
  })

  it('flushes the draft when the tab becomes hidden, and not when visible', async () => {
    const w = await open()
    await boxes(w)[0]?.setValue('tab')
    let state: DocumentVisibilityState = 'visible'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => state)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(window.localStorage.getItem(KEY)).toBeNull()
    state = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')).toEqual({ 2: 'tab' })
  })

  it('isolates drafts per user', async () => {
    who.id = 11
    const a = await open()
    await boxes(a)[0]?.setValue('milik 11')
    a.unmount()
    expect(window.localStorage.getItem('pp:draft:structured:11:7')).not.toBeNull()
    who.id = 12
    const b = await open()
    expect((boxes(b)[0]?.element as HTMLTextAreaElement).value).toBe('')
    b.unmount()
    who.id = 11
    const c = await open()
    expect((boxes(c)[0]?.element as HTMLTextAreaElement).value).toBe('milik 11')
  })

  it('Esc on the leave dialog stays on the page', async () => {
    const w = await open()
    await boxes(w)[0]?.setValue('x')
    const nav = router.push('/latihan-berstruktur')
    await settle()
    expect(body('[data-testid=leave-stay]')).not.toBeNull()
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await settle()
    await nav
    expect(body('[data-testid=leave-stay]')).toBeNull()
    expect(router.currentRoute.value.path).toBe('/latihan-berstruktur/7/jawab')
  })

  it('a second navigation while the dialog is open shares the first answer', async () => {
    const w = await open()
    await boxes(w)[0]?.setValue('x')
    const first = router.push('/latihan-berstruktur')
    await settle()
    const second = router.push('/latihan-berstruktur?x=1')
    await settle()
    expect(document.body.querySelectorAll('[data-testid=leave-stay]')).toHaveLength(1)
    body('[data-testid=leave-exit]')?.click()
    await settle()
    await Promise.allSettled([first, second])
    expect(router.currentRoute.value.path).toBe('/latihan-berstruktur')
    expect(body('[data-testid=leave-stay]')).toBeNull()
  })

  it('leaving during an in-flight submit does not ask', async () => {
    api.submitStructuredAttempt.mockReturnValue(new Promise(() => undefined))
    const w = await open()
    for (const b of boxes(w)) await b.setValue('x')
    await w.get('form').trigger('submit')
    await settle()
    await router.push('/latihan-berstruktur')
    await settle()
    expect(body('[data-testid=leave-stay]')).toBeNull()
    expect(router.currentRoute.value.path).toBe('/latihan-berstruktur')
  })
})

describe('S5-T11 structured answer: tree by label chain', () => {
  const sub = (id: number, label: string, marks = 1) => ({
    id,
    label,
    text: `T${String(id)}`,
    marks,
  })
  const withSubs = (subQuestions: ReturnType<typeof sub>[]): void => {
    api.fetchStructuredDetail.mockResolvedValue({ ...DETAIL, subQuestions })
  }

  it('(a), (b), (a).(i) in that order puts (a).(i) under (a), with two parts', async () => {
    withSubs([sub(1, '(a)', 0), sub(2, '(b)'), sub(3, '(a).(i)')])
    const w = await open()
    expect(w.findAll('[data-testid^=part-]')).toHaveLength(2)
    expect(
      w
        .get('[data-testid=part-1]')
        .findAll('[data-testid=sub-label]')
        .map((l) => l.text()),
    ).toEqual(['(a)', '(a)(i)'])
    expect(
      w
        .get('[data-testid=part-2]')
        .findAll('[data-testid=sub-label]')
        .map((l) => l.text()),
    ).toEqual(['(b)'])
    expect(w.get('[data-testid=answer-summary]').text()).toBe('2 bahagian · 2 markah')
    expect(boxes(w)).toHaveLength(2)
  })

  it('an orphan "(c).(i)" without "(c)" makes one part, not two', async () => {
    withSubs([sub(1, '(a)'), sub(2, '(c).(i)'), sub(3, '(c).(ii)')])
    const w = await open()
    expect(w.findAll('[data-testid^=part-]')).toHaveLength(2)
    expect(w.get('[data-testid=answer-summary]').text()).toBe('2 bahagian · 3 markah')
    expect(boxes(w)).toHaveLength(3)
  })

  it('a child listed before its parent still sits under the parent', async () => {
    withSubs([sub(3, '(a).(i)'), sub(1, '(a)', 0)])
    const w = await open()
    expect(w.findAll('[data-testid^=part-]')).toHaveLength(1)
    expect(w.findAll('[data-testid=sub-label]').map((l) => l.text())).toEqual(['(a)', '(a)(i)'])
    expect(boxes(w)).toHaveLength(1)
  })
})

describe('S5-T11 structured answer: shared draft prefix', () => {
  it('sign-out (the real store) removes the saved draft', async () => {
    const w = await open()
    await boxes(w)[0]?.setValue('rahsia')
    window.dispatchEvent(new Event('pagehide'))
    expect(window.localStorage.getItem(KEY)).not.toBeNull()
    const { useSessionStore } = await import('@/stores')
    await useSessionStore().logout()
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it('without a signed-in user nothing is saved or restored', async () => {
    who.id = null
    window.localStorage.setItem('pp:draft:structured:null:7', JSON.stringify({ 2: 'x' }))
    const w = await open()
    expect((boxes(w)[0]?.element as HTMLTextAreaElement).value).toBe('')
    await boxes(w)[0]?.setValue('tidak disimpan')
    window.dispatchEvent(new Event('pagehide'))
    expect(
      Object.keys(window.localStorage).filter((k) => k !== 'pp:draft:structured:null:7'),
    ).toEqual([])
  })
})
