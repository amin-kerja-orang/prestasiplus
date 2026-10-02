// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { alertNative, confirmNative } from '../native-dialogs'

describe('native dialogs', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('confirmNative calls window.confirm with the exact text and returns its answer', () => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValueOnce(true).mockReturnValueOnce(false)
    expect(confirmNative('Pasti untuk menukar status pengguna ini?')).toBe(true)
    expect(confirmNative('Pasti untuk menukar status pengguna ini?')).toBe(false)
    expect(spy).toHaveBeenCalledWith('Pasti untuk menukar status pengguna ini?')
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('alertNative calls window.alert with the exact text', () => {
    const spy = vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    alertNative('Sila pilih tindakan terlebih dahulu')
    expect(spy).toHaveBeenCalledWith('Sila pilih tindakan terlebih dahulu')
  })
})
