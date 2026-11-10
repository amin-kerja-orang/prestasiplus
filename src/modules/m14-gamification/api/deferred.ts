/**
 * Routes the R1 backend does not have: the teacher economy (`/api/guru/gamification*`, `/api/admin/gamification/guru*`) is
 * backlog (D53, OWN-10). No screen calls these clients, and in http mode a call would only end in a 404, so it is refused
 * here without a request. The mock keeps serving them.
 */
import { isHttpMode } from '@/api/mode'

export const DEFERRED_MESSAGE = 'Fungsi ini belum tersedia dalam mod API sebenar.'

/** `true` when the call must not leave the browser (http mode). */
export const deferredInHttp = (): boolean => isHttpMode()

export const deferredRejection = <T>(): Promise<T> => Promise.reject(new Error(DEFERRED_MESSAGE))
