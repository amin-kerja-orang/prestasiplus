/**
 * The core's view of the `users` repository (owner **M01**, D12, overview §6.7).
 *
 * F-11 hosted a provisional `users` repository here; F-23 moved it, unchanged in contract (the
 * `users.secrets` store and every secret method included), into
 * `src/modules/m01-authentication/mock/repository/users.ts`, where the store is now the users
 * virtual dataset of M02 SRS §6.15 (canonical accounts 1–11 as anchors). The core imports it from
 * the owner's public entry and re-exports what its own files use.
 */

export {
  emailKey,
  hashSecret,
  isSessionUser,
  maskIc,
  randomSalt,
  seedSalt,
  users,
  type SessionUserRow,
  type UserRow,
  type UserSecretsRow,
} from '@/modules/m01-authentication/mock'

export type { UsersRepository } from '@/modules/m01-authentication/mock'
