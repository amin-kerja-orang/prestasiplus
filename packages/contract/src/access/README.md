# Access matrix (V2-T08)

Data form of `docs/requirements/v2-portals.md` sections 5, 6 and 8.

- `matrix.ts`: `ACCESS_GROUPS` (9 groups, menu order), `ACCESS_MATRIX` (100 Pentadbiran items: `id`, `group`, `labelBm`, `route`, `capability`, `modes`, `ppdOnly`), `LEARNING_MENU` (Pembelajaran groups per learner role).
- `modes`: `{ admin?, ppd_officer?, school_admin? }` with `F | R | S | D`. A missing key is hidden. Learner roles never appear.
- `capability`: `admin.<group>.<item-slug>.read`. `capabilitiesFor` also emits `.write` for F and S modes only (PPD/JPN never write).
- `routes` are proposed (`/admin/<group>/<item>`, PP-01 = `/admin`); V2-T14 owns the final mapping.
- `ppdOnly` items (PM-01, PM-17 to PM-20) are hidden when the officer scope level is `state` (JPN).

```ts
import { capabilitiesFor, visibleGroups, visibleItems } from '@pp/contract'

visibleGroups('ppd_officer') // Pemantauan, Pengguna & Sekolah
capabilitiesFor('school_admin', { level: 'school' }) // [{ key, itemId, mode, kind }]
```

Tests (`__tests__/access.test.ts`) parse the requirements tables and fail if ids, order or labels drift.
