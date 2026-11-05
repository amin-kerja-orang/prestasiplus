/**
 * Profile `uat-like` (S4-T01, D110/D115): a SMALL deterministic fixture set for automated tests in CI. CI fixtures only, not acceptance
 * evidence; acceptance runs on UAT. See docs/ops/uat-like-data.md. Runs only under `--profile=uat-like`; the include list of the base
 * modules is `UAT_LIKE_BASE_MODULES` in `../index.ts`.
 *
 * Creates (all fictitious, idempotent): Tingkatan 1 to 3 pupils (T4/T5 pupils, Admin Pusat, Admin Sekolah, Guru and 4 schools come from
 * `core-identity` and `core-schools`) and the defect-shape questions of `questions.ts`. It creates no paper, no blueprint (Kontrak) and no sitting.
 */
import { assertSeedAllowed } from '../guard'
import type { SeedModule } from '../index'
import { seedUatLikeAccounts } from './accounts'
import { seedUatLikeQuestions } from './questions'

export const uatLikeSeed: SeedModule = {
  name: 'uat-like-fixtures',
  kind: 'demo',
  profiles: ['uat-like'],
  async run(ctx) {
    // Defence in depth: the runner already refuses demo modules in production without the flag.
    assertSeedAllowed(ctx.env)
    await seedUatLikeAccounts(ctx)
    await seedUatLikeQuestions(ctx)
  },
}
