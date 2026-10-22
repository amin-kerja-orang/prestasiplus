/**
 * OWASP argon2id minimum (19 MiB, t=2, p=1); the demo seed uses the same parameters. Kept in a file without Nest
 * imports so a host CLI (`src/ops/admin-bootstrap`) hashes exactly like `PasswordService`.
 */
export const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const
