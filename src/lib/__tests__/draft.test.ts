// @vitest-environment jsdom
// Draft keep across a 401 re-login (AC-ERR-2).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DRAFT_MAX_BYTES,
  DRAFT_NOTICE_BM,
  clearAllDrafts,
  clearDraft,
  draftKey,
  loadDraft,
  isSecretFieldName,
  restoreDraft,
  saveDraft,
  setDraftUserProvider,
} from '../draft'

let user: string | null = 'u1'
beforeEach(() => {
  sessionStorage.clear()
  user = 'u1'
  setDraftUserProvider(() => user)
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('draft keep', () => {
  it('builds pp.draft.{routeName}.{recordId|new}', () => {
    expect(draftKey('studio-soalan', 12)).toBe('pp.draft.studio-soalan.12')
    expect(draftKey('studio-soalan')).toBe('pp.draft.studio-soalan.new')
  })

  it('saves, restores once with the notice, then clears', () => {
    expect(saveDraft('studio-soalan', null, { tajuk: 'Soalan 1', markah: 2 })).toBe(true)
    const restored = restoreDraft('studio-soalan', null)
    expect(restored?.values).toEqual({ tajuk: 'Soalan 1', markah: 2 })
    expect(restored?.notice).toBe('Terdapat kerja yang belum disimpan daripada sesi sebelum ini.')
    expect(DRAFT_NOTICE_BM).toBe(restored?.notice)
    expect(restoreDraft('studio-soalan', null)).toBeNull()
    expect(sessionStorage.length).toBe(0)
  })

  it('never stores passwords, secrets or files', () => {
    saveDraft('profil', 3, {
      nama: 'Ujian',
      kataLaluan: 'x',
      password: 'y',
      nested: { token: 't', ok: 1 },
      gambar: new File(['a'], 'a.png'),
      lampiran: [new Blob(['b']), 'kekal'],
    })
    const stored = sessionStorage.getItem('pp.draft.profil.3') ?? ''
    expect(stored).not.toMatch(/kataLaluan|password|token|a\.png/)
    expect(loadDraft('profil', 3)).toEqual({
      nama: 'Ujian',
      nested: { ok: 1 },
      lampiran: ['kekal'],
    })
  })

  it('refuses a draft above 200 KB', () => {
    expect(saveDraft('besar', null, { teks: 'a'.repeat(DRAFT_MAX_BYTES + 1) })).toBe(false)
    expect(loadDraft('besar')).toBeNull()
  })

  it('clearDraft and clearAllDrafts remove only draft keys', () => {
    sessionStorage.setItem('lain', '1')
    saveDraft('a', null, { x: 1 })
    saveDraft('b', 2, { x: 1 })
    clearDraft('a')
    expect(loadDraft('a')).toBeNull()
    expect(loadDraft('b', 2)).not.toBeNull()
    clearAllDrafts()
    expect(loadDraft('b', 2)).toBeNull()
    expect(sessionStorage.getItem('lain')).toBe('1')
  })

  it('survives blocked storage and corrupt data', () => {
    sessionStorage.setItem('pp.draft.rosak.new', '{not json')
    expect(loadDraft('rosak')).toBeNull()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(saveDraft('a', null, { x: 1 })).toBe(false)
    expect(loadDraft('a')).toBeNull()
    expect(() => clearDraft('a')).not.toThrow()
    expect(() => clearAllDrafts()).not.toThrow()
  })

  it('binds a draft to its user: another user, or a draft with no owner, never gets it (and it is removed)', () => {
    saveDraft('studio-soalan', null, { tajuk: 'A' })
    user = 'u2'
    expect(loadDraft('studio-soalan')).toBeNull()
    expect(restoreDraft('studio-soalan')).toBeNull()
    expect(sessionStorage.length).toBe(0)
    sessionStorage.setItem('pp.draft.lama.new', JSON.stringify({ values: { x: 1 } }))
    expect(loadDraft('lama')).toBeNull()
    expect(sessionStorage.getItem('pp.draft.lama.new')).toBeNull()
  })

  it('gives the draft back to the same user after a sign-out and sign-in; refuses to save with no user', () => {
    saveDraft('studio-soalan', null, { tajuk: 'A' })
    user = null
    expect(loadDraft('studio-soalan')).toBeNull()
    expect(sessionStorage.length).toBe(1)
    expect(saveDraft('lain', null, { x: 1 })).toBe(false)
    user = 'u1'
    expect(restoreDraft('studio-soalan')?.values).toEqual({ tajuk: 'A' })
  })

  it('drops secret field names by name segment, not by substring', () => {
    for (const name of [
      'password',
      'newPassword',
      'kata_laluan',
      'kataLaluanBaru',
      'otp',
      'pin',
      'api-token',
      'client.secret',
      'confirm password',
    ]) {
      expect(isSecretFieldName(name), name).toBe(true)
    }
    for (const name of [
      'passage',
      'stimulus',
      'spinner',
      'bypass',
      'pinned',
      'tokenise',
      'opt',
      'tajuk',
    ]) {
      expect(isSecretFieldName(name), name).toBe(false)
    }
  })
})
