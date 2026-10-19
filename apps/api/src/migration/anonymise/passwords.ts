/**
 * Dummy password hashes (BE-35 AC4). Every hash in the source is replaced by the hash of ONE documented
 * dummy password, so nobody can log in as a real person and no original hash survives.
 *
 *   dummy password: Demo1234 (the documented demo password of the seeds; demo data only)
 *
 * The replacement keeps the CLASS of the original so the profile and the ETL still see the same mix:
 *   NULL / empty            stay NULL / empty
 *   `$2a$ $2b$ $2y$`   bcrypt hash of the dummy, with the same prefix
 *   `$argon2...$`           argon2id hash of the dummy (v2 parameters)
 *   other `$xxx$...`        the same prefix class is not reproducible: argon2id hash of the dummy
 *   anything else           the fixed text `not-a-hash-anonymised` (a plaintext password in the source
 *                           is thereby destroyed; it stays in the "(other)" class of the profile)
 *
 * Both hashes were generated once and verified (PHP password_verify, @node-rs/argon2 verify). A test
 * re-verifies the argon2 one.
 */

export const DUMMY_PASSWORD = 'Demo1234'
/** bcrypt, cost 10, of DUMMY_PASSWORD (`$2y$` form; `$2a$`/`$2b$` verify the same). */
const BCRYPT_BODY = '10$1BYJgcHHYPQGKg8zT39ARe/w5AeZ41OVkDbo33Yy8S.1BexZs1KEC'
/** argon2id of DUMMY_PASSWORD with the OWASP minimum parameters the v2 auth module uses. */
export const DUMMY_ARGON2_HASH = '$argon2id$v=19$m=19456,t=2,p=1$rh2l5K/3jj9wZ18JnsWzBA$/zsL21Colhro/Zb8ZUyApcYuSjWaCbozDIDWFmPzlUk'
export const NOT_A_HASH = 'not-a-hash-anonymised'

export function dummyBcryptHash(prefix: '2a' | '2b' | '2y' = '2y'): string {
  return `$${prefix}$${BCRYPT_BODY}`
}

export function dummyPasswordHash(original: unknown): unknown {
  if (original === null || original === undefined) return original ?? null
  if (typeof original !== 'string') return NOT_A_HASH
  if (original === '') return ''
  const bcrypt = /^\$(2[aby])\$/.exec(original)
  if (bcrypt) return dummyBcryptHash(bcrypt[1] as '2a' | '2b' | '2y')
  if (/^\$[0-9A-Za-z-]{1,10}\$/.test(original)) return DUMMY_ARGON2_HASH
  return NOT_A_HASH
}
