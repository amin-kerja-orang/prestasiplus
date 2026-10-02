import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import * as lucide from '@lucide/vue'
import { describe, expect, it } from 'vitest'

import { FA_TO_LUCIDE, LUCIDE_STATIC, type StaticLucideName } from '../fa-to-lucide'
import { MODULE_ICON_MAPS } from '../maps'

const DOC = fileURLToPath(new URL('../../../../docs/design/design-system.md', import.meta.url))
const lucideExports = lucide as unknown as Record<string, unknown>
const realIcons = new Set<unknown>(Object.values(lucide.icons))

interface DocRow {
  fa: string
  lucide: string
}

/** Parses every mapping row of design-system.md §6.1-§6.8 (§6.9 brand rows have no Lucide column). */
function parseDocRows(): DocRow[] {
  const md = readFileSync(DOC, 'utf8')
  const start = md.indexOf('## 6. Icon mapping')
  const end = md.indexOf('### 6.9')
  if (start < 0 || end < start) throw new Error('design-system.md §6 not found')
  const rows: DocRow[] = []
  for (const line of md.slice(start, end).split('\n')) {
    if (!line.startsWith('|') || line.startsWith('|---') || line.includes('FA class')) continue
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim())
    const fa = /`fa-([a-z0-9-]+)`/.exec(cells[0] ?? '')?.[1]
    const name = /([A-Z][A-Za-z0-9]*)/.exec(cells[1] ?? '')?.[1]
    if (!fa || !name) throw new Error(`Unparsed icon row: ${line}`)
    rows.push({ fa, lucide: name })
  }
  return rows
}

const docRows = parseDocRows()

describe('FA -> Lucide table vs design-system.md §6', () => {
  it('parses the full doc table (276 rows, unique FA names)', () => {
    expect(docRows).toHaveLength(276)
    expect(new Set(docRows.map((r) => r.fa)).size).toBe(docRows.length)
  })

  it.each(docRows)('fa-$fa -> $lucide', ({ fa, lucide: docName }) => {
    // The doc's name is a real @lucide/vue icon export...
    expect(realIcons.has(lucideExports[docName])).toBe(true)
    // ...and the table maps the FA name to that same component.
    const tableName = FA_TO_LUCIDE[fa]
    expect(tableName).toBeDefined()
    expect(LUCIDE_STATIC[tableName as StaticLucideName]).toBe(lucideExports[docName])
  })

  it('has no rows beyond the doc', () => {
    expect(Object.keys(FA_TO_LUCIDE).sort()).toEqual(docRows.map((r) => r.fa).sort())
  })

  it('statically imports only real, used, canonical Lucide icons', () => {
    const used = new Set<string>(Object.values(FA_TO_LUCIDE))
    const canonical = lucide.icons as unknown as Record<string, unknown>
    for (const [name, icon] of Object.entries(LUCIDE_STATIC)) {
      expect(canonical[name], name).toBe(icon)
      expect(used.has(name), `${name} unused`).toBe(true)
    }
  })

  it('module maps only add real icons and never redefine a global row', () => {
    for (const [mod, map] of Object.entries(MODULE_ICON_MAPS)) {
      for (const [fa, icon] of Object.entries(map)) {
        expect(Object.hasOwn(FA_TO_LUCIDE, fa), `${mod}: fa-${fa} is already global`).toBe(false)
        expect(realIcons.has(icon), `${mod}: fa-${fa}`).toBe(true)
      }
    }
  })
})
