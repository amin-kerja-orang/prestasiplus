/**
 * Shared behaviour of the DSKP filter group (UX spec 6.1) for the bank and the review queue: the
 * catalogue subject that feeds the Unit and SP options, and the dependency rules applied the moment a
 * field changes (before "Cari" / "Guna"), so the two bars cannot drift.
 */
import { watch } from 'vue'

import { useDskpSubject } from '../../lib/dskp-source'
import { clearOnForm, clearOnSubject, clearOnUnit, type DskpFilterDraft } from './dskp-filter'

export function useDskpFilter(draft: DskpFilterDraft & { subject: string }) {
  const catalogue = useDskpSubject(() => draft.subject)
  // `sync`: a quick filter that sets the subject and applies in one go must already see the cleared Unit and SP.
  watch(
    () => draft.subject,
    () => clearOnSubject(draft),
    { flush: 'sync' },
  )
  watch(
    () => draft.formOrigin,
    () => clearOnForm(draft),
    { flush: 'sync' },
  )
  watch(
    () => draft.unitId,
    () => clearOnUnit(draft),
    { flush: 'sync' },
  )
  return catalogue
}
