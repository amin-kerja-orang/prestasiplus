import { describe, expect, it } from 'vitest'

import { csvCell } from '../../mock/repository/cikgu'

describe('PBD CSV cell (SEC-M13-04)', () => {
  it.each(['=', '+', '-', '@'])('prefixes a quote when a cell starts with %s', (lead) => {
    expect(csvCell(`${lead}1+1`)).toBe(`'${lead}1+1`)
  })

  it('neutralises a formula name and still quotes commas and quotes', () => {
    expect(csvCell('=HYPERLINK("http://x.test","Klik")')).toBe(
      `"'=HYPERLINK(""http://x.test"",""Klik"")"`,
    )
  })

  it('leaves ordinary cells and numbers alone', () => {
    expect(csvCell('Aina binti Ali')).toBe('Aina binti Ali')
    expect(csvCell('5.1.1')).toBe('5.1.1')
    expect(csvCell(3)).toBe('3')
    expect(csvCell('a=b')).toBe('a=b')
  })
})
