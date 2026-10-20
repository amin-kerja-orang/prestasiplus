import { parseFragment, type DefaultTreeAdapterMap } from 'parse5'

type Node = DefaultTreeAdapterMap['node']

/** The allow-list the tests expect: element to its allowed attributes. Independent of the implementation. */
export const ORACLE_TAGS: Readonly<Record<string, readonly string[]>> = {
  p: [], br: [], strong: [], b: [], em: [], i: [], u: [], s: [], sub: [], sup: [], code: [], pre: [], hr: [], span: [], div: [],
  ul: [], ol: ['start'], li: [], h2: [], h3: [], h4: [], blockquote: [], table: [], thead: [], tbody: [], tfoot: [], tr: [],
  caption: [], colgroup: [], col: [], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'],
  a: ['href', 'title', 'rel'], img: ['src', 'alt', 'title', 'width', 'height'],
}

/** Parses markup as a browser would (parse5) and returns the problems found; empty when only allow-listed content is in it. */
export function problemsOf(out: string): string[] {
  const problems: string[] = []
  const walk = (node: Node): void => {
    if (node.nodeName === '#comment') problems.push('a comment survived')
    if ('tagName' in node) {
      const allowed = ORACLE_TAGS[node.tagName]
      if (!allowed) problems.push(`element <${node.tagName}> survived`)
      for (const a of node.attrs) {
        if (!allowed?.includes(a.name)) problems.push(`attribute ${a.name} on <${node.tagName}> survived`)
        if (a.name === 'href' || a.name === 'src') {
          const v = a.value.replace(/[\u0000- \u007f-\u009f]/g, '')
          const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(v)?.[1]?.toLowerCase()
          const schemes = node.tagName === 'a' ? ['http', 'https', 'mailto'] : ['http', 'https']
          const ok = scheme ? schemes.includes(scheme) : /^\/(?![/\\])/.test(v) || (node.tagName === 'a' && v.startsWith('#'))
          if (!ok) problems.push(`URL ${a.value} survived`)
        }
      }
    }
    for (const child of 'childNodes' in node ? node.childNodes : []) walk(child)
  }
  walk(parseFragment(out))
  return problems
}

/** The first `href` of the first element of `html` after parsing. */
export function firstHref(html: string): string | undefined {
  const el = parseFragment(html).childNodes[0] as DefaultTreeAdapterMap['element'] | undefined
  return el?.attrs.find((a) => a.name === 'href')?.value
}
