// Helpers shared by the strict Portal Pentadbiran rules (eslint/rules/ds-*.mjs).

/** `u-button` / `UButton` -> `UButton`. */
export const pascal = (name) =>
  String(name).replace(/(^|-)([a-zA-Z0-9])/g, (_m, _d, c) => c.toUpperCase())

/** `value-class` -> `valueClass`. */
export const camel = (name) => String(name).replace(/-([a-zA-Z0-9])/g, (_m, c) => c.toUpperCase())

/** Tag as written in the template (case kept). */
export const tagOf = (element) => element.rawName ?? element.name

/** Component tag name in PascalCase, or null for a native element. */
export function componentName(element) {
  const raw = tagOf(element)
  if (/^[A-Z]/.test(raw)) return raw
  if (raw.includes('-') && /^(?:u|ds)-/.test(raw)) return pascal(raw)
  return null
}

/**
 * Describes a template attribute.
 * kind: 'static' (`foo="x"`), 'bind' (`:foo`), 'model' (`v-model[:foo]`), 'on' (`@foo`),
 *       or the directive name (`if`, `for`, `slot`, ...).
 * name: attribute / prop name as written (null for `v-bind="obj"` and dynamic arguments).
 */
export function attrInfo(attr) {
  if (!attr.directive) {
    return {
      kind: 'static',
      name: attr.key.rawName ?? attr.key.name,
      value: attr.value ? attr.value.value : null,
      expr: null,
    }
  }
  const dir = attr.key.name?.name
  const arg = attr.key.argument
  const name = arg && arg.type === 'VIdentifier' ? (arg.rawName ?? arg.name) : null
  const expr = attr.value?.expression ?? null
  if (dir === 'bind') return { kind: 'bind', name, value: null, expr }
  if (dir === 'model') return { kind: 'model', name: name ?? 'modelValue', value: null, expr }
  if (dir === 'on') return { kind: 'on', name, value: null, expr }
  return { kind: dir ?? 'unknown', name, value: null, expr }
}

/** Value of a static string attribute or a bound string literal, else undefined. */
export function stringValue(info) {
  if (info.kind === 'static') return info.value ?? ''
  if (info.kind === 'bind' && info.expr?.type === 'Literal' && typeof info.expr.value === 'string')
    return info.expr.value
  return undefined
}

/** Attribute named `name` (static or bound, kebab or camel) of an element, as attrInfo, or null. */
export function findAttr(element, name) {
  const want = camel(name)
  for (const a of element.startTag.attributes) {
    const info = attrInfo(a)
    if (info.name && camel(info.name) === want && info.kind !== 'on') return { ...info, node: a }
  }
  return null
}

/** Child elements of a VElement (text and comments skipped). */
export const childElements = (element) => element.children.filter((c) => c.type === 'VElement')

/** Depth-first walk over elements: fn(element, parentElement | null). */
export function walkElements(element, fn, parent = null) {
  fn(element, parent)
  for (const c of childElements(element)) walkElements(c, fn, element)
}

/**
 * Registers template visitors plus script visitors. In a `.ts` file (no template parser) only the
 * script visitors are returned.
 */
export function visit(context, templateVisitor, scriptVisitor = {}) {
  const parser = context.sourceCode.parserServices
  if (!parser?.defineTemplateBodyVisitor) return scriptVisitor
  return parser.defineTemplateBodyVisitor(templateVisitor, scriptVisitor)
}

/** The `<template>` root element of the SFC (VElement) or null. */
export function templateRoot(context) {
  return context.sourceCode.parserServices?.getDocumentFragment?.()?.children?.find(
    (c) => c.type === 'VElement' && c.name === 'template',
  ) ?? null
}

/** Normalised file path relative to the repo, forward slashes. */
export function relFile(context) {
  const f = (context.filename ?? context.getFilename()).replaceAll('\\', '/')
  const i = f.lastIndexOf('/src/')
  return i >= 0 ? f.slice(i + 1) : f
}
