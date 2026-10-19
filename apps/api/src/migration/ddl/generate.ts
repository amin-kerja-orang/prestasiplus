/** Writes `staging_cloud.sql` from the spec: `npm run staging:ddl -w @pp/api`. */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { renderDdl } from './render'

export const DDL_FILE = fileURLToPath(new URL('./staging_cloud.sql', import.meta.url))

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(DDL_FILE, renderDdl(), 'utf8')
  console.log(`Wrote ${DDL_FILE}`)
}
