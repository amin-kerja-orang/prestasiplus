/**
 * `useSession()`: the session store with its state as refs, for components that only read the
 * logged-in user (shell identity blocks, role checks). Actions stay on `store`.
 */

import { storeToRefs } from 'pinia'

import { useSessionStore } from '@/stores/session'

export function useSession() {
  const store = useSessionStore()
  const { isLoggedIn, token, user, role, landingPath, remember, expiresAt } = storeToRefs(store)
  return { store, isLoggedIn, token, user, role, landingPath, remember, expiresAt }
}
