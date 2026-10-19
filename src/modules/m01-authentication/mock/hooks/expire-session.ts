/**
 * The `expireSession` test hook (overview §6.13; a delegated built-in of `window.__mock`, registered
 * by M01). It invalidates a session server-side, so the client's next request answers 401 and the
 * client goes to `/login` (FR-M01-14), while `pp.auth` still looks valid in the browser.
 *
 * Arguments:
 * - none: the session in `localStorage['pp.auth']` (the current page's user);
 * - a token string (`pp_…`): that session;
 * - an e-mail string or a user id: every session of that user.
 *
 * Returns how many sessions were ended.
 */

import { sessions } from '@/mock/auth/sessions'

import { usersRepo as users } from '../repository/users'

const PP_AUTH_KEY = 'pp.auth'

function storedToken(): string | null {
  try {
    const raw = (globalThis as { localStorage?: Storage }).localStorage?.getItem(PP_AUTH_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as { token?: unknown }
    return typeof value.token === 'string' ? value.token : null
  } catch {
    return null
  }
}

export function expireSession(...args: unknown[]): number {
  const [target] = args
  if (target === undefined || target === null) {
    const token = storedToken()
    return token !== null && sessions.revoke(token) ? 1 : 0
  }
  if (typeof target === 'string' && !target.includes('@')) return sessions.revoke(target) ? 1 : 0
  if (typeof target !== 'string' && typeof target !== 'number') {
    throw new TypeError('expireSession: expected a token, an e-mail or a user id')
  }
  const user = typeof target === 'number' ? users.get(target) : users.findByEmail(target)
  if (!user) throw new Error(`expireSession: no user ${JSON.stringify(target)}`)
  return sessions.revokeAllFor(user.id)
}
