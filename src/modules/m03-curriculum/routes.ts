import type { RouteRecordRaw } from 'vue-router'

import adminCurriculum from './routes/admin-curriculum'
import adminSubjectsLevels from './routes/admin-subjects-levels'
import studentCurriculum from './routes/student-curriculum'

/**
 * M03 routes (build-plan §S.3 rule 2): the admin fragments (S1-S11) and the student catalogue
 * (S12-S14, M03-T4).
 */
const routes: RouteRecordRaw[] = [...adminCurriculum, ...adminSubjectsLevels, ...studentCurriculum]

export default routes
