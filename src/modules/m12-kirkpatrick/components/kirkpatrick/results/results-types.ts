/** Narrowed slices of the S5 read model used by the result components. */

import type { Results } from '../../../api/types'

export type ResultsDistribution = NonNullable<Results['distribution']>
export type ResultsSubjectGps = Results['subjectGps']
export type ResultsTrend = Results['trend']
export type ResultsPrediction = Results['predictions'][number]
