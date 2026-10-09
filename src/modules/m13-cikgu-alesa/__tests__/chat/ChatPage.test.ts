// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import {
  configureVoice,
  fireVoiceError,
  resetVoice,
  spokenTexts,
  type ChatSendResponse,
} from '../../api'
import ChatPage from '../../pages/ChatPage.vue'

const sendChat = vi.hoisted(() => vi.fn())
vi.mock('../../api/cikgu', () => ({ sendChat }))

const okBody = (reply: string, over: Partial<ChatSendResponse> = {}): ChatSendResponse => ({
  thread_id: 'thr-7',
  reply,
  tier: 'guru',
  turns_remaining: 27,
  tool_hops: 0,
  tokens: { in: 126, out: 10 },
  ...over,
})

let wrapper: VueWrapper | undefined

let currentRouter: Router | undefined

async function mountPage(url = '/cikgu') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/cikgu', component: { template: '<div />' } }],
  })
  currentRouter = router
  await router.push(url)
  await router.isReady()
  wrapper = mount(ChatPage, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const input = () => wrapper!.get<HTMLInputElement>('#cikgu-input')
const send = () => wrapper!.get<HTMLButtonElement>('#cikgu-send')
const meta = () => wrapper!.get('#cikgu-meta').text()
const status = () => wrapper!.get('#cikgu-voice-status').text()
const msgs = () => wrapper!.findAll('.cikgu-msg')

async function submit(text: string) {
  await input().setValue(text)
  await wrapper!.get('#cikgu-form').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  resetVoice()
  sendChat.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

describe('S1 chat page: static copy (FR-M13-12..16)', () => {
  it('renders the header, the greeting, the toolbar and the form', async () => {
    await mountPage()
    expect(wrapper!.get('h1').text()).toBe('Cikgu Alesa')
    expect(wrapper!.get('.ca-sub').text()).toBe(
      'Guru maya · Powered by Cikgu Nur Demo · Cikgu Amin Demo · Cikgu Siti Demo + 50K+ soalan DSKP',
    )
    expect(msgs()).toHaveLength(1)
    expect(msgs()[0]!.classes()).toContain('cikgu-msg-bot')
    expect(msgs()[0]!.text()).toBe(
      'Cikgu Alesa: Hai! Saya Cikgu Alesa. Apa nak belajar hari ni? Cuba tanya pasal subjek tertentu, atau minta latihan soalan.',
    )
    expect(wrapper!.get('#cikgu-voice-toolbar').text()).toContain('🎙️ Voice Mode:')
    expect(wrapper!.get<HTMLInputElement>('#cikgu-voice-mode').element.checked).toBe(false)
    expect(input().attributes('placeholder')).toBe('Taip atau tekan 🎤 untuk cakap…')
    expect(input().attributes('required')).toBeDefined()
    expect(input().attributes('maxlength')).toBe('4000')
    expect(input().attributes('name')).toBeUndefined()
    expect(send().text()).toBe('Hantar')
    expect(meta()).toBe('')
    expect(wrapper!.get('#cikgu-mic').attributes('title')).toBe('Tekan untuk cakap')
  })
})

describe('S1 sending (FR-M13-17..20, 23)', () => {
  it('a whitespace-only value sends nothing and appends nothing', async () => {
    await mountPage()
    await submit('   ')
    expect(sendChat).not.toHaveBeenCalled()
    expect(msgs()).toHaveLength(1)
  })

  it('shows the busy state, then the reply, the meta, the thread id and focus', async () => {
    let resolve!: (v: unknown) => void
    sendChat.mockReturnValueOnce(new Promise((r) => (resolve = r)))
    await mountPage()
    await submit('  Terangkan pecahan setara  ')
    expect(sendChat).toHaveBeenCalledWith({ message: 'Terangkan pecahan setara', thread_id: null })
    expect(msgs()[1]!.text()).toBe('Anda: Terangkan pecahan setara')
    expect(input().element.value).toBe('')
    expect(send().element.disabled).toBe(true)
    expect(meta()).toBe('Cikgu Alesa sedang berfikir…')
    resolve({ status: 200, body: okBody('Baris 1\n<b>x</b>') })
    await flushPromises()
    const bot = msgs()[2]!
    expect(bot.get('.cikgu-msg-body').element.querySelectorAll('br')).toHaveLength(1)
    expect(bot.get('.cikgu-msg-body').text()).toContain('<b>x</b>')
    expect(bot.element.querySelector('b')).toBeNull()
    expect(meta()).toBe('Tier: guru · Turns remaining: 27 · Tool hops: 0 · Tokens: in=126 out=10')
    expect(send().element.disabled).toBe(false)
    expect(document.activeElement).toBe(input().element)
    expect(wrapper!.get<HTMLInputElement>('#cikgu-thread-id').element.value).toBe('thr-7')
    sendChat.mockResolvedValueOnce({ status: 200, body: okBody('Jawapan kedua yang panjang') })
    await submit('Minta latihan soalan')
    expect(sendChat).toHaveBeenLastCalledWith({ message: 'Minta latihan soalan', thread_id: 'thr-7' })
  })

  it('non-2xx JSON bodies: error text, fallback and the quota line', async () => {
    await mountPage()
    sendChat.mockResolvedValueOnce({ status: 500, body: { error: 'Ralat ujian.' } })
    await submit('a')
    expect(msgs()[2]!.text()).toBe('Cikgu Alesa: Ralat ujian.')
    expect(meta()).toBe('')
    sendChat.mockResolvedValueOnce({ status: 429, body: { quota_exhausted: true } })
    await submit('b')
    expect(msgs()[4]!.text()).toBe('Cikgu Alesa: Cikgu Alesa tak boleh respon. Cuba lagi.')
    expect(meta()).toBe('Quota habis untuk hari ni.')
    sendChat.mockResolvedValueOnce({ status: 422, body: {} })
    await submit('c')
    expect(msgs()[6]!.text()).toBe('Cikgu Alesa: Cikgu Alesa tak boleh respon. Cuba lagi.')
    expect(meta()).toBe('')
  })

  it('a network failure or a non-JSON body shows the connection text and re-enables the form', async () => {
    await mountPage()
    sendChat.mockRejectedValueOnce(new Error('network'))
    await submit('a')
    expect(msgs()[2]!.text()).toBe('Cikgu Alesa: Ralat sambungan. Cuba lagi sebentar.')
    expect(send().element.disabled).toBe(false)
    expect(document.activeElement).toBe(input().element)
    sendChat.mockResolvedValueOnce({ status: 200, body: null })
    await submit('b')
    expect(msgs()[4]!.text()).toBe('Cikgu Alesa: Ralat sambungan. Cuba lagi sebentar.')
  })

  it('an empty reply shows "(tiada respon)"', async () => {
    sendChat.mockResolvedValueOnce({ status: 200, body: okBody('') })
    await mountPage()
    await submit('hai')
    expect(msgs()[2]!.text()).toBe('Cikgu Alesa: (tiada respon)')
  })
})

describe('S1 entry points (FR-M13-21, 22)', () => {
  it('?ask= fills and focuses the input and sends nothing', async () => {
    Element.prototype.scrollIntoView = vi.fn()
    await mountPage('/cikgu?ask=Terangkan%20pecahan%20setara')
    expect(input().element.value).toBe('Terangkan pecahan setara')
    expect(document.activeElement).toBe(input().element)
    expect(sendChat).not.toHaveBeenCalled()
  })

  it('a link to /cikgu?ask= while already on /cikgu re-applies the prefill', async () => {
    Element.prototype.scrollIntoView = vi.fn()
    await mountPage('/cikgu')
    expect(input().element.value).toBe('')
    await currentRouter!.push('/cikgu?ask=Terangkan%20pecahan%20setara')
    await flushPromises()
    expect(input().element.value).toBe('Terangkan pecahan setara')
    expect(sendChat).not.toHaveBeenCalled()
  })

  it('mark_essay with a stored essay pre-fills the hand-off message and removes the key', async () => {
    Element.prototype.scrollIntoView = vi.fn()
    sessionStorage.setItem('cikgu_pending_essay', 'Karangan ujian yang cukup panjang untuk lulus.')
    await mountPage('/cikgu?action=mark_essay&rubric=sejarah_essay&subject=&level=&student=&title=')
    expect(input().element.value).toBe(
      'Tolong mark karangan ini menggunakan rubric Sejarah — Karangan Esei (20 markah). Karangan: Karangan ujian yang cukup panjang untuk lulus.',
    )
    expect(sessionStorage.getItem('cikgu_pending_essay')).toBeNull()
    expect(sendChat).not.toHaveBeenCalled()
  })

  it('mark_essay without a stored essay leaves the input empty', async () => {
    await mountPage('/cikgu?action=mark_essay&rubric=general')
    expect(input().element.value).toBe('')
  })
})

describe('S1 voice mode and the simulated speaker (FR-M13-29, 30)', () => {
  it('loads from localStorage and writes 1 / 0 on change', async () => {
    localStorage.setItem('cikgu_voice_mode', '1')
    await mountPage()
    const box = wrapper!.get<HTMLInputElement>('#cikgu-voice-mode')
    expect(box.element.checked).toBe(true)
    await box.setValue(false)
    expect(localStorage.getItem('cikgu_voice_mode')).toBe('0')
    await box.setValue(true)
    expect(localStorage.getItem('cikgu_voice_mode')).toBe('1')
  })

  it('speaks a long reply, shows the status, clears it, and skips short or failed texts', async () => {
    vi.useFakeTimers()
    localStorage.setItem('cikgu_voice_mode', '1')
    await mountPage()
    sendChat.mockResolvedValueOnce({ status: 200, body: okBody('Soalan yang baik! Ini jawapan.') })
    await submit('hai')
    expect(status()).toBe('🔊 Cikgu sedang bercakap…')
    expect(spokenTexts()).toEqual(['Soalan yang baik! Ini jawapan.'])
    await vi.advanceTimersByTimeAsync(1900)
    expect(status()).toBe('')
    sendChat.mockResolvedValueOnce({ status: 200, body: okBody('Ok') })
    await submit('hai')
    sendChat.mockResolvedValueOnce({ status: 500, body: { error: 'Ralat ujian panjang.' } })
    await submit('hai')
    expect(spokenTexts()).toHaveLength(1)
  })

  it('does not speak when the switch is off', async () => {
    await mountPage()
    sendChat.mockResolvedValueOnce({ status: 200, body: okBody('Soalan yang baik! Ini jawapan.') })
    await submit('hai')
    expect(spokenTexts()).toEqual([])
    expect(status()).toBe('')
  })
})

describe('S1 simulated recogniser (FR-M13-31..33, BR-M13-20)', () => {
  const mic = () => wrapper!.get<HTMLButtonElement>('#cikgu-mic')

  it('click: listening, interim at 600 ms, final at 1,200 ms, end and auto-submit', async () => {
    vi.useFakeTimers()
    sendChat.mockResolvedValue({ status: 200, body: okBody('Jawapan panjang untuk suara') })
    await mountPage()
    await mic().trigger('click')
    expect(mic().text()).toBe('🔴')
    expect(mic().classes()).toContain('ca-mic-on')
    expect(status()).toBe('Mendengar...')
    await vi.advanceTimersByTimeAsync(600)
    expect(input().element.value).toBe('Terangkan pecahan')
    await vi.advanceTimersByTimeAsync(600)
    expect(mic().text()).toBe('🎤')
    expect(status()).toBe('')
    expect(sendChat).toHaveBeenCalledTimes(1)
    expect(sendChat.mock.calls[0]![0].message).toBe('Terangkan pecahan setara dengan contoh')
  })

  it('a second click stops the session and sends what is in the input', async () => {
    vi.useFakeTimers()
    sendChat.mockResolvedValue({ status: 200, body: okBody('Jawapan panjang untuk suara') })
    await mountPage()
    await mic().trigger('click')
    await vi.advanceTimersByTimeAsync(700)
    await mic().trigger('click')
    expect(sendChat.mock.calls[0]![0].message).toBe('Terangkan pecahan')
  })

  it('the error step shows "Maaf, tak dengar." and then ends; short input is not sent', async () => {
    vi.useFakeTimers()
    configureVoice({ transcript: { interim: 'Hai', final: 'Hai' } })
    await mountPage()
    await mic().trigger('click')
    await vi.advanceTimersByTimeAsync(700)
    fireVoiceError()
    await flushPromises()
    expect(status()).toBe('Maaf, tak dengar.')
    expect(mic().text()).toBe('🎤')
    await vi.advanceTimersByTimeAsync(1100)
    expect(status()).toBe('')
    expect(sendChat).not.toHaveBeenCalled()
  })

  it('dictation can start a second turn while one is in flight (replicated, SEC-M13-02)', async () => {
    vi.useFakeTimers()
    sendChat.mockReturnValue(new Promise(() => undefined))
    await mountPage()
    await submit('Pertanyaan pertama')
    expect(send().element.disabled).toBe(true)
    await mic().trigger('click')
    await vi.advanceTimersByTimeAsync(1300)
    expect(sendChat).toHaveBeenCalledTimes(2)
  })

  it('unsupported: the mic is disabled with the live title (hook only)', async () => {
    configureVoice({ supported: false })
    await mountPage()
    expect(mic().element.disabled).toBe(true)
    expect(mic().attributes('title')).toBe('Browser tidak sokong voice — guna Chrome/Edge')
    expect(mic().classes()).toContain('ca-mic-off')
  })

  it('never touches a browser speech API (D4)', async () => {
    const speak = vi.fn()
    vi.stubGlobal('speechSynthesis', { speak })
    vi.useFakeTimers()
    await mountPage()
    await mic().trigger('click')
    await vi.advanceTimersByTimeAsync(1300)
    expect(speak).not.toHaveBeenCalled()
    expect('SpeechRecognition' in window).toBe(false)
    vi.unstubAllGlobals()
  })
})
