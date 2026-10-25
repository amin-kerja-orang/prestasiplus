import indexRaw from './data/index.json?raw'
import versionRaw from './data/version.json?raw'
import type { DskpSubjectCode } from './types'

/**
 * Lazy per-subject loaders (design section 3.2, ADR-0022). One literal dynamic `import()` per
 * subject: no `import.meta.glob` and no template-literal import (ADR-0009 amendment 1). `?raw`
 * returns the file as text, so the type-checker does not infer a 100 KB literal type; the
 * catalogue parses it on first use. Each subject becomes its own chunk.
 *
 * The index and version files are small and imported eagerly, as text; they are parsed on first use.
 */

export type DskpLoader = () => Promise<string>

export const DSKP_LOADERS: Readonly<Record<DskpSubjectCode, DskpLoader>> = {
  MAT: () => import('./data/matematik.json?raw').then((m) => m.default),
  MTM: () => import('./data/matematik-tambahan.json?raw').then((m) => m.default),
  FIZ: () => import('./data/fizik.json?raw').then((m) => m.default),
  SN: () => import('./data/sains.json?raw').then((m) => m.default),
  BM: () => import('./data/bahasa-melayu.json?raw').then((m) => m.default),
  BI: () => import('./data/bahasa-inggeris.json?raw').then((m) => m.default),
  SEJ: () => import('./data/sejarah.json?raw').then((m) => m.default),
  PI: () => import('./data/pendidikan-islam.json?raw').then((m) => m.default),
  TI: () => import('./data/tasawwur-islam.json?raw').then((m) => m.default),
  PM: () => import('./data/pendidikan-moral.json?raw').then((m) => m.default),
  PSV: () => import('./data/pendidikan-seni-visual.json?raw').then((m) => m.default),
  LNS: () => import('./data/landskap-dan-nurseri.json?raw').then((m) => m.default),
  KPJ: () => import('./data/katering-dan-penyajian.json?raw').then((m) => m.default),
}

/** Raw text of `data/index.json` (the 13-row subject index). */
export const DSKP_INDEX_TEXT: string = indexRaw
/** Raw text of `data/version.json`. */
export const DSKP_VERSION_TEXT: string = versionRaw
