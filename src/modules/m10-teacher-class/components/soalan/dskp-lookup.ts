/**
 * The DSKP lookups of the teacher question form (API-DSKP-07 `/api/guru/dskp/*`, API-GUR-08 `/api/guru/chapters`).
 * The API is a cascade Bidang → SK → SP with no link to a Bab, so the SP choices of a Subjek + Tingkatan are the
 * flattened SP of every SK of every Bidang. "DSKP nodes exist" for `dskp-rule.ts` means this list is not empty.
 */
import { fetchBidang, fetchSk, fetchSp } from '../../api/guru'
import type { SpOption } from '../../api/types'

export interface SpChoice {
  id: number
  code: string
  description: string
}

const byCode = (a: SpChoice, b: SpChoice): number =>
  a.code.localeCompare(b.code, 'ms', { numeric: true })

/** All SP of the pair, in code order. A failed branch makes the whole list fail (the caller shows no SP). */
export async function fetchSpChoices(
  query: { subjectId: number; educationLevelId: number },
  signal?: AbortSignal,
): Promise<SpChoice[]> {
  const opts = signal ? { signal } : {}
  const bidangs = await fetchBidang(query, opts)
  const sks = (await Promise.all(bidangs.map((b) => fetchSk(b.id, opts)))).flat()
  const sps: SpOption[] = (await Promise.all(sks.map((s) => fetchSp(s.id, opts)))).flat()
  const seen = new Set<number>()
  return sps
    .filter((sp) => (seen.has(sp.id) ? false : (seen.add(sp.id), true)))
    .map((sp) => ({ id: sp.id, code: sp.code, description: sp.description }))
    .sort(byCode)
}
