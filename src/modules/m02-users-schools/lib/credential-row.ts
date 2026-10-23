/** One account's one-time credential as shown by `GeneratedCredentials` (http mode, D59b). */
export interface CredentialRow {
  /** 1-based import line; absent for a single account. */
  line?: number
  name?: string
  email: string
  password: string
}
