import type { RouteRecordRaw } from 'vue-router'

import admin from './routes/admin'
import adminArticlesNotes from './routes/admin-articles-notes'
import adminMedia from './routes/admin-media'
import artikel from './routes/artikel'
import audioKbat from './routes/audio-kbat'
import panduan from './routes/panduan'
import perutusan from './routes/perutusan'
import video from './routes/video'

/**
 * M09 routes (build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments. Each UI task
 * writes its own fragment; M09-T1 created them empty.
 */
const routes: RouteRecordRaw[] = [
  ...admin,
  ...adminArticlesNotes,
  ...adminMedia,
  ...artikel,
  ...audioKbat,
  ...panduan,
  ...perutusan,
  ...video,
]

export default routes
