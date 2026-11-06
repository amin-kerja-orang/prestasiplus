import { describe, expect, it } from 'vitest'

import { parseUatArgs } from '../../scripts/uat-ops/lib'
import { normalizeApiUrl, SPEC, supportLines } from '../../scripts/uat-ops/u-op-16-support-contact'

/** S4-T08 U-OP-16: the support contact check (pure; the HTTP call is the script's main). */
const statuses = (status: number, body: unknown): string[] => supportLines(status, body).map((l) => l.status)

describe('supportLines', () => {
  it('passes 200 with a non-empty e-mail and WhatsApp number, without printing the values', () => {
    const lines = supportLines(200, { data: { email: 'bantuan@contoh.invalid', whatsappNumber: '+60123456789' } })
    expect(lines.map((l) => l.status)).toEqual(['PASS', 'PASS', 'PASS'])
    const text = lines.map((l) => l.text).join('\n')
    expect(text).not.toContain('contoh.invalid')
    expect(text).not.toContain('60123456789')
  })

  it('fails an empty or missing value', () => {
    expect(statuses(200, { data: { email: '', whatsappNumber: '+60123456789' } })).toEqual(['PASS', 'FAIL', 'PASS'])
    expect(statuses(200, { data: { email: 'a@b.invalid', whatsappNumber: '  ' } })).toEqual(['PASS', 'PASS', 'FAIL'])
    expect(statuses(200, { data: {} })).toEqual(['PASS', 'FAIL', 'FAIL'])
  })

  it('fails a body without data and any status but 200 (404 names the missing setting)', () => {
    expect(statuses(200, null)).toEqual(['PASS', 'FAIL'])
    expect(statuses(200, { email: 'a@b.invalid' })).toEqual(['PASS', 'FAIL'])
    expect(supportLines(404, null)).toEqual([{ status: 'FAIL', text: expect.stringContaining('not set yet') }])
    expect(statuses(500, null)).toEqual(['FAIL'])
  })
})

describe('arguments', () => {
  it('is read-only and takes --api-url', () => {
    expect(() => parseUatArgs(['--apply'], SPEC)).toThrow('read-only')
    expect(parseUatArgs(['--api-url', 'https://uat.invalid'], SPEC).values).toEqual({ 'api-url': 'https://uat.invalid' })
  })

  it('normalises the URL and refuses credentials and other schemes', () => {
    expect(normalizeApiUrl('https://uat.invalid/')).toBe('https://uat.invalid')
    expect(normalizeApiUrl('https://uat.invalid/base//')).toBe('https://uat.invalid/base')
    expect(() => normalizeApiUrl('https://user:pw@uat.invalid')).toThrow('credentials')
    expect(() => normalizeApiUrl('ftp://uat.invalid')).toThrow('http(s)')
    expect(() => normalizeApiUrl('bukan url')).toThrow('not a valid URL')
  })
})
