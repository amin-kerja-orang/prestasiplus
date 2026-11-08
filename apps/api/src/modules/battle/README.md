# Battle module (BE-44) - hand-off for the feature developers

Edit only your own folder (`queue/`, `arena/`, `standings/`, `tournaments/`: add controllers/providers to its `*.module.ts`).
Shared root files (`battle-core.module.ts`, `battle.deps.ts`, ...) change only with a note to the lead. Paths are under `apps/api/src`.

- **Session/role/test flag**: `import { ScopeContext, type RequestWithAuth } from '../../../common/scope'`;
  `const s = ScopeContext.fromRequest(req as Request & RequestWithAuth)` then `s.userId` (decimal string), `s.role`, `s.isTest`
  (Mod Pelajar: stamp `isTest` on every row you write, exclude `is_test` rows from reads). Every route is default-deny
  (global `AuthGuard`, 401 `UNAUTHORIZED`); the global session guard also enforces CSRF on mutations (403 `CSRF_INVALID`).
- **Admin only** (M16-43, M16-44): `import { Roles } from '../../../common/guards'` and `@Roles('admin')` (403 for every other role).
- **Clock**: `@Inject(CLOCK) private readonly clock: Clock` from `'../../../db/clock'` (`clock.now()`); never `Date.now()`/`new Date()`.
  MYT helpers in the same file: `mytDay`, `startOfMytDay` (fixed UTC+8, so week-from-Monday/month windows are easy).
- **PRNG**: `import { prngStream, type Prng } from '../../../db/prng'`; `prngStream('m16:battle:<queueId>')` returns a fresh named
  stream (`next()`, `int(a,b)`, `pick(items)`); a stream depends only on its name. Bot answers: `m16:battle:<battleUuid>`.
- **Throttle**: `@UseGuards(RateLimitGuard)` on the controller + `@RateLimit(BATTLE_LIMITS.write | read | poll | search)` per route
  (`'../battle.limits'`, imports from `'../../../common/throttle'`). D57: every write and the name search carry 429.
- **No-store**: `@UseInterceptors(NoStoreInterceptor)` from `'../../../common/http'` on every battle controller (answer data).
- **Env responses**: return `ok(data)` (`'../../../common/http/respond'`) and throw `ApiError.of('NOT_FOUND', { message })`,
  `ApiError.of('VALIDATION_ERROR', { message, fields })`, `ApiError.of('CONFLICT', { message })`
  (`'../../../common/errors/api-error'`). Parse bodies/queries with the contract schemas (`@pp/contract`, `BATTLE_MESSAGES`).
- **Raw routes (M16-02..14, M16-01)**: return the bare object (no `ok()`); put `@UseFilters(BattleRawErrorFilter)` on the controller
  and throw `rawNotFound(text)` (404), `rawConflict(text)` (409), `rawInvalid(text?)` (422), `rawForbidden(text?)` (403) from
  `'../raw-response'`. No text = the empty `{}` body (M16-02/03). Other errors (401, CSRF, 429) keep the standard envelope.
- **Owner reads**: inject `BattleDeps` (`'../battle.deps'`, from `BattleCoreModule`): `activeStudents`, `searchStudents`, `student`,
  `players`, `gradeOf`, `school(s)`, `subjects`, `subject`, `levelIdOfGrade`, `spmPoolCount`, `drawQuestions`, `arenaQuestion`
  (keyless), `gradeAnswer`, `platformAccuracy`, `pkskDomains`. Never inject an owner repository or query `users`, `schools`,
  `subjects`, `questions` tables yourself. Fallbacks and limits are listed at the top of `battle.deps.ts`.
- **M14 report**: `@Inject(GAME_RESULT_PORT) port: GameResultPort` (`'../game-result.port'`), no-op until the owner binds it.
- **DB**: `PrismaService` (global): `this.prisma.client.battle|battleParticipant|battleQuestion|battleAnswer|battleQueue|battleInvitation|tournament|tournamentSubject`;
  group writes in `this.prisma.transaction(async (tx) => ...)`. Ids: `idToString`/`idFromString` from `'../../../db/ids'`. Row locks via `$queryRaw ... FOR UPDATE`.
- **Tests**: `apps/api/test/battle/`; boot pattern `apps/api/test/classes/helpers.ts` (`createTestDatabase`, `FixedClock`, seeds).
- **Exported to other cards**: `BattleReadService` (`countFor`, `windowCounts`, `hasBattled`) via `BattleModule`.
