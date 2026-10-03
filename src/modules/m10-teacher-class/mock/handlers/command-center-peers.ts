/**
 * Call-time reads of the later modules the Command Center needs (overview §6.7 "Call-time reads across
 * modules"; D12): M05 `practice`, M08 `headcount`, M12 `feedback`, M14 `learnerBadges`, M17
 * `moodCheckins`. M08's mock imports M10 (`classrooms`), so a static import of M08 here would make the
 * cycle M10 → M08 → M10 and change the evaluation order of the registry (M08's anchor sessions then
 * never reach the M05 log). Nothing is imported at module load: the entries are resolved with a
 * dynamic `import()` on the first request and cached. The types are erased imports (no cycle).
 */

type PeerModules = {
  practice: typeof import('@/modules/m05-practice/mock').practice
  headcount: typeof import('@/modules/m08-student-performance/mock').headcount
  feedback: typeof import('@/modules/m12-kirkpatrick/mock').feedback
  learnerBadges: typeof import('@/modules/m14-gamification/mock').learnerBadges
  moodCheckins: typeof import('@/modules/m17-admin-dashboard/mock').moodCheckins
}

export type Peers = Readonly<PeerModules>

let cached: Promise<Peers> | null = null

/** The peer repositories (resolved once; later calls reuse the same promise). */
export function loadPeers(): Promise<Peers> {
  cached ??= Promise.all([
    import('@/modules/m05-practice/mock'),
    import('@/modules/m08-student-performance/mock'),
    import('@/modules/m12-kirkpatrick/mock'),
    import('@/modules/m14-gamification/mock'),
    import('@/modules/m17-admin-dashboard/mock'),
  ]).then(([m05, m08, m12, m14, m17]) => ({
    practice: m05.practice,
    headcount: m08.headcount,
    feedback: m12.feedback,
    learnerBadges: m14.learnerBadges,
    moodCheckins: m17.moodCheckins,
  }))
  return cached
}
