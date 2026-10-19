import { describe, expect, it } from 'vitest'

import { NOTIFICATION_PUSH_EVENT as SHELL_EVENT } from '@/shells/user/constants'

import { NOTIFICATION_PUSH_EVENT } from '../../api/notifications'

describe('notification push event contract', () => {
  it('the user shell listens for the event name the M01 api (and mock hook) dispatches', () => {
    // The shell may not import from a module (eslint boundaries), so it holds its own copy.
    expect(SHELL_EVENT).toBe(NOTIFICATION_PUSH_EVENT)
  })
})
