import { FixedClock } from '../../../../src/db/clock'
import { PerformancePorts } from '../../../../src/modules/reports/performance/ports'
import { LeaderboardService, PublicProfileService, RankingService, WeeklyReportService } from '../../../../src/modules/reports/performance/services'
import { NOW } from './fixtures'
import { InMemoryClasses } from './in-memory-classes'
import { InMemoryDirectory } from './in-memory-directory'
import { InMemoryGamification } from './in-memory-gamification'
import { InMemoryPracticeRead } from './in-memory-practice-read'

export interface SocialWorld {
  directory: InMemoryDirectory
  classes: InMemoryClasses
  practice: InMemoryPracticeRead
  gamification: InMemoryGamification
  ports: PerformancePorts
  clock: FixedClock
  ranking: RankingService
  board: LeaderboardService
  profile: PublicProfileService
  weekly: WeeklyReportService
}

/** Fakes wired into the real social services. Schools: s1 (Negeri A / Daerah A), s2 (Negeri A / Daerah B), s3 (Negeri B). */
export function socialWorld(): SocialWorld {
  const directory = new InMemoryDirectory()
    .addSchool({ id: 's1', name: 'Sekolah Satu', state: 'Negeri A', district: 'Daerah A' })
    .addSchool({ id: 's2', name: 'Sekolah Dua', state: 'Negeri A', district: 'Daerah B' })
    .addSchool({ id: 's3', name: 'Sekolah Tiga', state: 'Negeri B', district: 'Daerah C' })
  const classes = new InMemoryClasses()
  const practice = new InMemoryPracticeRead()
  const gamification = new InMemoryGamification()
  const ports = new PerformancePorts(undefined, classes, practice, gamification)
  const clock = new FixedClock(NOW)
  return {
    directory,
    classes,
    practice,
    gamification,
    ports,
    clock,
    ranking: new RankingService(ports, directory),
    board: new LeaderboardService(ports, clock, directory),
    profile: new PublicProfileService(ports, directory, clock),
    weekly: new WeeklyReportService(),
  }
}

const SCHOOLS: Record<string, { schoolName: string; state: string; district: string }> = {
  s1: { schoolName: 'Sekolah Satu', state: 'Negeri A', district: 'Daerah A' },
  s2: { schoolName: 'Sekolah Dua', state: 'Negeri A', district: 'Daerah B' },
  s3: { schoolName: 'Sekolah Tiga', state: 'Negeri B', district: 'Daerah C' },
}

/** A fictitious pupil in both the directory and the practice fake. */
export function addPupil(w: SocialWorld, id: string, name: string, schoolId: string, over: { grade?: number; isActive?: boolean } = {}): void {
  w.directory.addPupil({ id, name, schoolId, ...over })
  w.practice.addPupil({ id, name, schoolId, ...SCHOOLS[schoolId] })
}
