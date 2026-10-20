import { describe, expect, it } from 'vitest'

import { csvCell, toCsv } from '../../src/modules/school-admin/csv'

describe('school-admin csv helper', () => {
  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tx', '\rx'])('neutralises the formula prefix of %j', (v) => {
    expect(csvCell(v).replace(/^"/, '').startsWith("'")).toBe(true)
  })
  it('neutralises =HYPERLINK(...) and quotes it because of the comma and quotes', () => {
    expect(csvCell('=HYPERLINK("http://x.test","klik")')).toBe('"\'=HYPERLINK(""http://x.test"",""klik"")"')
  })
  it('does not touch plain text, numbers, booleans; null and undefined are empty', () => {
    expect([csvCell('Aina'), csvCell(5), csvCell(false), csvCell(null), csvCell(undefined)]).toEqual(['Aina', '5', 'false', '', ''])
  })
  it('quotes commas, quotes and line breaks (RFC 4180)', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"')
  })
  it('writes BOM, header and rows with LF by default and a trailing newline', () => {
    expect(toCsv(['id', 'name'], [['1', 'A'], ['2', '=x']])).toBe("﻿id,name\n1,A\n2,'=x\n")
  })
  it('uses CRLF when asked', () => {
    expect(toCsv(['a'], [['1']], 'CRLF')).toBe('﻿a\r\n1\r\n')
  })
})
