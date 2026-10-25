import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const DIR = join(__dirname, '../../components/command-center')
const MODALS = [
  'HoldersModal',
  'RemedialModal',
  'EvaluateModal',
  'PredictiveModal',
  'AchievementsModal',
  'ClassSummaryModal',
  'DrillModal',
]

describe('Command Center modals: a failed load never shows the server text (SWE-06)', () => {
  it.each(MODALS)('%s shows the fixed BM line, not error.message', (name) => {
    const source = readFileSync(join(DIR, `${name}.vue`), 'utf8')
    expect(source).not.toMatch(/error(\.value)?\.message/)
    expect(source).toContain('S2_COPY.loadFailed')
  })
})
