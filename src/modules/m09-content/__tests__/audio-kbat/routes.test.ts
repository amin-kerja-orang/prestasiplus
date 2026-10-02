import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import routes from '../../routes/audio-kbat'

const router = () => createRouter({ history: createMemoryHistory(), routes })

describe('audio-kbat route fragment', () => {
  it('resolves the list and the player with a numeric id', () => {
    const r = router()
    expect(r.resolve('/audio-kbat').name).toBe('m09-audio-kbat')
    const player = r.resolve('/audio-kbat/7')
    expect(player.name).toBe('m09-audio-kbat-player')
    expect(player.params.id).toBe('7')
  })

  it('does not resolve a non-numeric id', () => {
    const r = router()
    expect(r.resolve('/audio-kbat/abc').matched).toHaveLength(0)
    expect(r.resolve('/audio-kbat/d').matched).toHaveLength(0)
  })

  it('uses the user layout, auth access and a title-only header', () => {
    for (const route of routes) {
      expect(route.meta).toMatchObject({
        layout: 'user',
        access: 'auth',
        title: 'Audio KBAT',
        header: { title: 'Audio KBAT' },
      })
    }
  })
})
