// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

import passwordRoutes, { resetLinkTarget } from '../../routes/password'

const blank = { template: '<div />' }

function router() {
  // The real M01 password fragment, with light stand-in pages.
  return createRouter({
    history: createMemoryHistory(),
    routes: passwordRoutes.map((r) => ({ ...r, component: blank }) as RouteRecordRaw),
  })
}

describe('reset link from the mail (SW8-07)', () => {
  it('goes from /password/reset#token=…&email=… to S4 with the e-mail, without the hash', async () => {
    const r = router()
    await r.push('/password/reset#token=abc123&email=pelajar%40demo.test')
    expect(r.currentRoute.value.path).toBe('/password/reset/abc123')
    expect(r.currentRoute.value.query.email).toBe('pelajar@demo.test')
    expect(r.currentRoute.value.hash).toBe('')
    expect(r.currentRoute.value.name).toBe('m01.password.reset')
  })

  it('goes to S4 without ?email= when the link has no e-mail', async () => {
    const r = router()
    await r.push('/password/reset#token=abc123')
    expect(r.currentRoute.value.fullPath).toBe('/password/reset/abc123')
  })

  it('encodes a token that holds URL characters', () => {
    expect(resetLinkTarget({ hash: '#token=a%2Fb&email=x%40y.my' })).toMatchObject({
      path: '/password/reset/a%2Fb',
      query: { email: 'x@y.my' },
    })
  })

  it.each(['', '#', '#email=a%40b.my', '#token=', '#other=1'])(
    'keeps the forgot page for hash %j',
    async (hash) => {
      const r = router()
      await r.push(`/password/reset${hash}`)
      expect(r.currentRoute.value.name).toBe('m01.password.forgot')
    },
  )
})
