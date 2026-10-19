// CM-6 prop renames (hardening spec 7.5, R1 R2 R3 R4 R7): rewrites the callers of the deprecated
// aliases of the typed Ds APIs. Idempotent; `--dry-run`, `--module mNN`, `--json` for the skip list.
// Dynamic values that cannot be mapped statically are reported, never guessed.
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  boolValue,
  findAttr,
  literalValue,
  MagicString,
  parseSfc,
  pascalTag,
  removeAttr,
  renameAttr,
  replaceAttr,
  runCodemod,
  styleName,
  walkElements,
} from './lib.mjs'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))

/** Phosphor base names `DsIcon` can build (src/theme/ds-icons.ts + learn-icons.ts). */
const ICON_BASES = new Set(
  [...readFileSync(here('../../src/theme/ds-icons.ts'), 'utf8').matchAll(/^\s+'([a-z0-9-]+)',?$/gm)]
    .concat([
      ...readFileSync(here('../../src/theme/learn-icons.ts'), 'utf8').matchAll(/'([a-z0-9-]+)'/g),
    ])
    .map((m) => m[1]),
)
/** Ds components whose `icon` prop is a base name (DsIconProp). */
const ICON_TAGS = new Set([
  'DsBadgeTile',
  'DsCharacterCard',
  'DsEmptyState',
  'DsFileField',
  'DsFormSection',
  'DsGameTile',
  'DsIconChip',
  'DsPillNav',
  'DsRewardChip',
  'DsStatRow',
  'DsStatTile',
])
const VALUE_TONES = {
  'text-highlighted': 'highlighted',
  'text-primary': 'primary',
  'text-success': 'success',
  'text-warning': 'warning',
  'text-error': 'error',
  'text-info': 'info',
  'text-muted': 'muted',
}

const q = (s) => JSON.stringify(s)

/** @type {Record<string, (c: Ctx) => void>} */
const RULES = {
  DsStatTile: (c) => {
    valueClass(c)
    density(c)
  },
  DsStatRow: (c) => density(c),
  DsDataTable: (c) => {
    const a = c.attr('compactCells')
    if (!a) return
    const b = boolValue(a)
    if (b === true) c.replace(a, 'compactCells', `density="compact"`)
    else if (b === false) c.remove(a, 'compactCells')
    else c.skip('compactCells', 'dynamic value')
  },
  DsFilterBar: (c) => rename(c, 'tone', 'surface'),
  DsScoreRing: (c) => {
    const a = c.attr('tone')
    if (!a) return
    const v = literalValue(a)
    if (v === 'win' || v === 'action') c.rename(a, 'tone', 'accent')
    else if (v === 'onPrimary') c.replace(a, 'tone', 'inverted')
    else c.skip('tone', 'dynamic value')
  },
  DsCharacterCard: (c) => {
    const a = c.attr('variant')
    if (!a) return
    const v = literalValue(a)
    const map = { trial: 'trial', warning: 'heat', info: 'friend', win: 'win', action: 'action' }
    if (v && map[v]) c.replace(a, 'variant', `accent=${q(map[v])}`)
    else c.skip('variant', 'dynamic value')
  },
  DsWinHero: (c) => {
    const a = c.attr('tone')
    if (!a) return
    const v = literalValue(a)
    if (v === 'win' || v === 'keep')
      c.replace(a, 'tone', `accent=${q(v === 'keep' ? 'action' : 'win')}`)
    else c.skip('tone', 'dynamic value')
  },
  DsFeedbackSheet: (c) => {
    const a = c.attr('tone')
    if (!a) return
    const map = { good: 'success', bad: 'error' }
    if (a.kind === 'static') {
      if (map[a.value]) c.replace(a, 'tone', `tone=${q(map[a.value])}`)
    } else if (a.kind === 'bound' && /'(good|bad)'/.test(a.exp ?? '')) {
      const lits = [...a.exp.matchAll(/'([^']*)'/g)].map((m) => m[1])
      if (lits.every((l) => ['good', 'bad', 'success', 'error'].includes(l)))
        c.replace(
          a,
          'tone',
          `:${styleName(a.name, 'tone')}="${a.exp.replace(/'good'/g, "'success'").replace(/'bad'/g, "'error'")}"`,
        )
      else c.skip('tone', 'dynamic value')
    } else if (a.kind === 'bound' && !/'(success|error)'/.test(a.exp ?? ''))
      c.skip('tone', 'dynamic value')
  },
  DsLoadError: (c) => {
    const a = c.attr('inline')
    if (!a) return
    const b = boolValue(a)
    if (b === true) c.replace(a, 'inline', `variant="inline"`)
    else if (b === false) c.remove(a, 'inline')
    else c.skip('inline', 'dynamic value')
  },
  DsChart: (c) => rename(c, 'level', 'headingLevel'),
  DsNativeSelect: (c) => {
    const a = c.attr('placeholder')
    if (!a) return
    const b = boolValue(a)
    if (a.kind === 'bare' || b === true) c.replace(a, 'placeholder', 'blank')
    else if (a.kind === 'bound' && b === undefined) c.skip('placeholder', 'dynamic value')
  },
  DsFormSection: (c) => {
    const a = c.attr('tone')
    if (a && literalValue(a) === 'danger') c.replace(a, 'tone', `tone="error"`)
  },
  DsPanel: (c) => {
    const t = c.attr('tone')
    if (t) {
      const v = literalValue(t)
      if (v === 'raised') c.remove(t, 'tone')
      else if (v === 'bulk' || v === 'bar' || v === 'float')
        c.replace(t, 'tone', `behavior=${q(v)}`)
      else if (v === 'inset' || v === 'tint')
        c.skip('tone', `tone="${v}" has no replacement prop (surface layer)`)
      else c.skip('tone', 'dynamic value')
    }
    const f = c.attr('flush')
    if (f) {
      const b = boolValue(f)
      if (b === true) c.replace(f, 'flush', `padding="none"`)
      else if (b === false) c.remove(f, 'flush')
      else c.skip('flush', 'dynamic value')
    }
  },
}

function rename(c, from, to) {
  const a = c.attr(from)
  if (a) c.rename(a, from, to)
}

function valueClass(c) {
  const a = c.attr('valueClass')
  if (!a) return
  const tone = a.kind === 'static' ? VALUE_TONES[a.value] : undefined
  if (tone) c.replace(a, 'valueClass', `${styleName(a.name, 'valueTone')}=${q(tone)}`)
  else
    c.skip('valueClass', a.kind === 'static' ? `class "${a.value}" has no tone` : 'dynamic value')
}

function density(c) {
  const comp = c.attr('compact')
  const roomy = c.attr('roomy')
  if (comp && roomy) return c.skip('compact/roomy', 'both set')
  for (const [a, name, val] of [
    [comp, 'compact', 'compact'],
    [roomy, 'roomy', 'roomy'],
  ]) {
    if (!a) continue
    const b = boolValue(a)
    if (b === true) c.replace(a, name, `density="${val}"`)
    else if (b === false) c.remove(a, name)
    else if (a.kind === 'bound') c.replace(a, name, `:density="(${a.exp}) ? '${val}' : undefined"`)
  }
}

/** `icon="i-ph-fire-duotone"` -> `icon="fire"` when the base name is bundled. */
function icon(c) {
  const a = c.attr('icon')
  if (!a || !ICON_TAGS.has(c.tag)) return
  const v = literalValue(a)
  const m = v && /^i-ph-([a-z0-9-]+?)(?:-(duotone|regular))?$/.exec(v)
  if (!m) return
  if (!ICON_BASES.has(m[1])) return c.skip('icon', `"${m[1]}" is not in the bundled icon list`)
  c.replace(a, 'icon', a.kind === 'static' ? `${a.name}=${q(m[1])}` : `:${a.name}="'${m[1]}'"`)
}

export function transformSource(file, source, report) {
  let out = source
  if (file.endsWith('.vue')) {
    const d = parseSfc(file, source)
    if (!d) return null
    if (d.template?.ast) {
      const ms = new MagicString(source)
      let n = 0
      walkElements(d.template.ast, (el) => {
        const tag = pascalTag(el.tag)
        if (!/^Ds[A-Z]/.test(tag)) return
        const c = {
          tag,
          attr: (name) => findAttr(el, name),
          replace: (a, rule, text) => {
            replaceAttr(ms, a, text)
            report.hit(file, `${tag}.${rule}`)
            n++
          },
          remove: (a, rule) => {
            removeAttr(ms, source, a)
            report.hit(file, `${tag}.${rule}`)
            n++
          },
          rename: (a, rule, to) => {
            renameAttr(ms, source, a, to)
            report.hit(file, `${tag}.${rule}`)
            n++
          },
          skip: (rule, reason) => report.skip(file, el.loc.start.line, `${tag}.${rule}`, reason),
        }
        RULES[tag]?.(c)
        icon(c)
      })
      if (n) out = ms.toString()
    }
  }
  // object-literal callers: StatItem `valueClass: 'text-x'` and useConfirm `tone: 'danger'`
  out = out.replace(/\bvalueClass:\s*(['"])(text-[a-z-]+)\1/g, (m, qt, cls) => {
    const tone = VALUE_TONES[cls]
    if (!tone) {
      report.skip(file, 0, 'StatItem.valueClass', `class "${cls}" has no tone`)
      return m
    }
    report.hit(file, 'StatItem.valueClass')
    return `valueTone: ${qt}${tone}${qt}`
  })
  out = out.replace(/(confirm\(\{[^}]*?\btone:\s*)(['"])danger\2/g, (m, pre, qt) => {
    report.hit(file, 'useConfirm.tone')
    return `${pre}${qt}error${qt}`
  })
  return out
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runCodemod('CM-6 prop renames', transformSource, undefined, { extra: ['src/dev'] })
}
