import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DSKP_SUBJECTS } from '../../dskp/subjects'
import type { DskpSubjectData, DskpSubjectInfo, DskpVersionFile } from '../../dskp/types'

/** Repo root (this file is `src/modules/m03-curriculum/__tests__/dskp/helpers.ts`). */
export const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url))
export const DATA_DIR = 'src/modules/m03-curriculum/dskp/data'

export function readRepo(path: string): string {
  return readFileSync(resolve(ROOT, path), 'utf8')
}

export function readData<T>(name: string): T {
  return JSON.parse(readRepo(`${DATA_DIR}/${name}.json`)) as T
}

export function loadIndex(): DskpSubjectInfo[] {
  return readData<DskpSubjectInfo[]>('index')
}

export function loadVersion(): DskpVersionFile {
  return readData<DskpVersionFile>('version')
}

/** The 13 committed subject files, in the order of `DSKP_SUBJECTS`. */
export function loadSubjects(): DskpSubjectData[] {
  return DSKP_SUBJECTS.map((cfg) => readData<DskpSubjectData>(cfg.slug))
}
