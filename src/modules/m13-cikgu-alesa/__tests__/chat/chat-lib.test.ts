import { describe, expect, it } from 'vitest'

import { buildHandoffMessage, type ChatSendResponse } from '../../api'
import {
  formatMeta,
  messageLines,
  resolveChat,
  resolvePrefill,
  speakDuration,
} from '../../components/chat/chat-lib'

const ok = (over: Partial<ChatSendResponse> = {}): ChatSendResponse => ({
  thread_id: 'thr-1',
  reply: 'Soalan yang baik! Ini penerangan.',
  tier: 'guru',
  turns_remaining: 27,
  tool_hops: 0,
  tokens: { in: 126, out: 9 },
  ...over,
})

describe('formatMeta (FR-M13-19)', () => {
  it('builds the live usage line', () => {
    expect(formatMeta(ok())).toBe(
      'Tier: guru · Turns remaining: 27 · Tool hops: 0 · Tokens: in=126 out=9',
    )
  })
})

describe('messageLines (FR-M13-15)', () => {
  it('splits on line breaks only and keeps markup as text', () => {
    expect(messageLines('Baris 1\n<b>x</b>')).toEqual(['Baris 1', '<b>x</b>'])
  })
})

describe('speakDuration (FR-M13-30)', () => {
  it('is 60 ms per character clamped to 1,500 to 8,000 ms', () => {
    expect(speakDuration('a'.repeat(11))).toBe(1500)
    expect(speakDuration('a'.repeat(50))).toBe(3000)
    expect(speakDuration('a'.repeat(500))).toBe(8000)
  })
})

describe('resolveChat (FR-M13-19, 20)', () => {
  it('2xx: reply, thread, meta and the speak flag (longer than 10 characters, voice on)', () => {
    const r = resolveChat(200, ok(), true)
    expect(r).toMatchObject({ kind: 'reply', threadId: 'thr-1', speak: true })
    expect(resolveChat(200, ok(), false)).toMatchObject({ speak: false })
    expect(resolveChat(200, ok({ reply: 'Ok' }), true)).toMatchObject({ speak: false })
  })

  it('2xx with an empty or missing reply shows "(tiada respon)" and is not spoken', () => {
    expect(resolveChat(200, ok({ reply: '' }), true)).toMatchObject({
      reply: '(tiada respon)',
      speak: false,
    })
    const missing = { ...ok() } as Partial<ChatSendResponse>
    delete missing.reply
    expect(resolveChat(200, missing as ChatSendResponse, true)).toMatchObject({
      reply: '(tiada respon)',
    })
  })

  it('non-2xx JSON: the error text or the fallback, quota meta only when quota_exhausted', () => {
    expect(resolveChat(500, { error: 'Ralat ujian.' }, false)).toEqual({
      kind: 'error',
      text: 'Ralat ujian.',
      meta: '',
    })
    expect(resolveChat(422, {}, false)).toEqual({
      kind: 'error',
      text: 'Cikgu Alesa tidak dapat membalas. Cuba lagi.',
      meta: '',
    })
    expect(resolveChat(429, { quota_exhausted: true }, false)).toEqual({
      kind: 'error',
      text: 'Cikgu Alesa tidak dapat membalas. Cuba lagi.',
      meta: 'Kuota habis untuk hari ini.',
    })
  })

  it('a non-JSON or empty body is the network branch', () => {
    const net = { kind: 'network', text: 'Ralat sambungan. Cuba lagi sebentar.' }
    expect(resolveChat(200, null, false)).toEqual(net)
    expect(resolveChat(200, 'oops' as never, false)).toEqual(net)
    expect(resolveChat(500, null, false)).toEqual(net)
  })
})

describe('resolvePrefill (FR-M13-21, 22)', () => {
  it('?ask= copies the decoded value', () => {
    expect(resolvePrefill('ask=Terangkan%20pecahan%20setara', null, buildHandoffMessage)).toEqual({
      text: 'Terangkan pecahan setara',
      consumedEssay: false,
    })
  })

  it('ask wins over action=mark_essay', () => {
    expect(resolvePrefill('ask=Hai&action=mark_essay', 'x'.repeat(60), buildHandoffMessage)).toEqual(
      { text: 'Hai', consumedEssay: false },
    )
  })

  it('mark_essay builds the hand-off message ("+" is a space, empty keys are left out)', () => {
    const essay = 'Karangan contoh yang cukup panjang untuk ujian ini sahaja, bukan karangan sebenar.'
    const full = resolvePrefill(
      'action=mark_essay&rubric=sejarah_essay&subject=Sejarah&level=T5&student=Murid+Demo+03&title=Semangat+Patriotisme',
      essay,
      buildHandoffMessage,
    )
    expect(full.consumedEssay).toBe(true)
    expect(full.text).toBe(
      'Tolong tanda karangan ini menggunakan rubrik Sejarah — Karangan Esei (20 markah). ' +
        'Subjek: Sejarah. Level: T5. Pelajar: Murid Demo 03. Tajuk: Semangat Patriotisme. ' +
        `Karangan: ${essay}`,
    )
    const bare = resolvePrefill(
      'action=mark_essay&rubric=&subject=&level=&student=&title=',
      essay,
      buildHandoffMessage,
    )
    expect(bare.text).toBe(
      `Tolong tanda karangan ini menggunakan rubrik SPM Bahasa Melayu — Karangan (Bahagian B) (50 markah). Karangan: ${essay}`,
    )
  })

  it('mark_essay without a stored essay leaves the input empty (DV-M13-01)', () => {
    expect(resolvePrefill('action=mark_essay&rubric=general', null, buildHandoffMessage)).toEqual({
      text: null,
      consumedEssay: false,
    })
  })

  it('no entry point, nothing to prefill', () => {
    expect(resolvePrefill('', 'x', buildHandoffMessage)).toEqual({
      text: null,
      consumedEssay: false,
    })
  })
})
