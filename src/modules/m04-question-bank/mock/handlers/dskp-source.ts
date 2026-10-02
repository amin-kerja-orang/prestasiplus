/**
 * Lazy access to the M10 `dskp` store (owner M10, F-30). M10 depends on M04 (its seed and missions
 * import the M04 repositories), so M04 must not import M10 at module load: the import runs inside a
 * handler, at request time. **M10 must be booted whenever a DSKP read or tag is used** (the DSKP
 * cascade #28–#30, a question detail with a DSKP chain, a create or edit that sets `dskpSpId`); the
 * real registry always loads it, and a test that uses those paths lists the M10 plugin.
 */

export type DskpStore = (typeof import('@/modules/m10-teacher-class/mock'))['dskp']

export async function dskpStore(): Promise<DskpStore> {
  return (await import('@/modules/m10-teacher-class/mock')).dskp
}
