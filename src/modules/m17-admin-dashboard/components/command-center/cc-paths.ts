/**
 * Links of the S4-S7 drill-down for one route prefix (FR-M17-60, SRS §3.2): the prefix is a prop of the
 * pages, so the same component serves `/admin/command-center` (admin), `/guru/command-center` (M10 mount)
 * and `/admin-sekolah/command-center` (school-scope alias).
 */
export interface CcPaths {
  /** The S2 board of the same scope ("Command Center", "← Kembali ke Gambaran Keseluruhan"). */
  overview: string
  school: (schoolId: number) => string
  teacher: (schoolId: number, userId: number) => string
  classroom: (classroomId: number) => string
  student: (userId: number) => string
}

export function ccPaths(basePath: string): CcPaths {
  const base = basePath.replace(/\/+$/, '')
  return {
    overview: base,
    school: (id) => `${base}/school/${String(id)}`,
    teacher: (sid, uid) => `${base}/school/${String(sid)}/teacher/${String(uid)}`,
    classroom: (id) => `${base}/classroom/${String(id)}`,
    student: (id) => `${base}/student/${String(id)}`,
  }
}
