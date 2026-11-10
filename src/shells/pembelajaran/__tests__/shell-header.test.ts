// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { NOTIFICATION_PUSH_EVENT } from '@/shells/user/constants'

// Class-level assertions on the Pembelajaran layout source (same approach as shell-a11y.test.ts).
const src = readFileSync(resolve(__dirname, '../PembelajaranLayout.vue'), 'utf8')

describe('Pembelajaran shell bell (C-6, FR-M01-53)', () => {
  it('listens for the foreground push event and refreshes the bell', () => {
    expect(NOTIFICATION_PUSH_EVENT).toBe('pp:notification-push')
    expect(src).toMatch(/window\.addEventListener\(NOTIFICATION_PUSH_EVENT, onNotificationPush\)/)
    expect(src).toMatch(/function onNotificationPush\(\): void \{\s*void bell\.refresh\(\)/)
  })

  it('removes the listener when the layout unmounts', () => {
    expect(src).toMatch(/onBeforeUnmount\(\(\) =>\s*window\.removeEventListener\(NOTIFICATION_PUSH_EVENT, onNotificationPush\)/)
  })
})

describe('Pembelajaran shell title and subtitle (C-7)', () => {
  it('a data-driven header (usePageMeta) wins over the route header, for title and subtitle', () => {
    expect(src).toMatch(/const header = computed\(\(\) => pageMeta\.state\.header \?\? route\.meta\.header\)/)
    expect(src).toMatch(/const title = computed\(\(\) => header\.value\?\.title \?\? current\.value\?\.label \?\? ''\)/)
    expect(src).toMatch(/const subtitle = computed\(\(\) => header\.value\?\.subtitle \|\| ''\)/)
  })

  it('prints the subtitle under the title with its test id, from md up', () => {
    const m = src.match(/<p\s+v-if="subtitle"\s+class="([^"]*)"[^>]*data-testid="pembelajaran-subtitle"/s)
    expect(m?.[1]).toContain('md:block')
    expect(m?.[1]).toContain('hidden')
  })
})
