import { describe, expect, it } from 'vitest'

import { DEFAULT_PUBLIC_BASE_URL, publicBaseUrl, publicBaseUrlBootWarning } from '../../src/common/config/public-base-url'

const config = (value: string | undefined) => ({ get: () => value }) as never

/** SW10-06: share, register and league links are built on the configured `PUBLIC_BASE_URL`, never on the old system's host. */
describe('publicBaseUrl', () => {
  it('uses PUBLIC_BASE_URL without a trailing slash, else the local default', () => {
    expect(publicBaseUrl(config('https://app.example.test'))).toBe('https://app.example.test')
    expect(publicBaseUrl(config('https://app.example.test/'))).toBe('https://app.example.test')
    expect(publicBaseUrl(config('https://app.example.test/base//'))).toBe('https://app.example.test/base')
    expect(publicBaseUrl(config(undefined))).toBe(DEFAULT_PUBLIC_BASE_URL)
  })

  it('a production boot without PUBLIC_BASE_URL warns (it stays optional); set, blank-free or outside production it does not', () => {
    expect(publicBaseUrlBootWarning({ NODE_ENV: 'production' })).toContain('PUBLIC_BASE_URL is not set')
    expect(publicBaseUrlBootWarning({ NODE_ENV: 'production', PUBLIC_BASE_URL: '  ' })).toContain('http://localhost:8080')
    expect(publicBaseUrlBootWarning({ NODE_ENV: 'production', PUBLIC_BASE_URL: 'https://app.example.test' })).toBeUndefined()
    expect(publicBaseUrlBootWarning({ NODE_ENV: 'development' })).toBeUndefined()
    expect(publicBaseUrlBootWarning({ NODE_ENV: 'test' })).toBeUndefined()
  })
})
