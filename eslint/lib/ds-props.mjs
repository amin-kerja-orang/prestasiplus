// Declared props of a src/ds component, read from the SFC with @vue/compiler-sfc (type-based and
// runtime `defineProps`). Used by R7 to flag props outside the documented API. Cached per process;
// a component that does not exist yet or cannot be analysed yields `null` (the rule then skips it).
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { compileScript, parse } from '@vue/compiler-sfc'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const cache = new Map()
const fsHost = {
  fileExists: existsSync,
  readFile: (f) => readFileSync(f, 'utf8'),
  realpath: realpathSync,
}

/** @returns {Set<string> | null} camelCase prop names, or null when unknown. */
export function dsProps(tag) {
  if (cache.has(tag)) return cache.get(tag)
  let props = null
  const file = `${ROOT}src/ds/${tag}.vue`
  if (existsSync(file)) {
    try {
      const { descriptor } = parse(readFileSync(file, 'utf8'), { filename: file })
      if (descriptor.scriptSetup) {
        const out = compileScript(descriptor, { id: tag, fs: fsHost })
        props = new Set(
          Object.entries(out.bindings ?? {})
            .filter(([, kind]) => kind === 'props')
            .map(([name]) => name),
        )
        // `defineModel('name')` is a prop (`v-model:name`) the bindings do not list; the unnamed model is `modelValue`.
        for (const m of descriptor.scriptSetup.content.matchAll(/defineModel(?:<[^>]*>)?\(\s*(?:'(\w+)')?/g)) {
          props.add(m[1] ?? 'modelValue')
        }
      }
    } catch {
      props = null
    }
  }
  cache.set(tag, props)
  return props
}
