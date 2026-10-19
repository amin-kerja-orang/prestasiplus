/**
 * Inline SVG diagrams for the seed stimuli. Everything is drawn with `currentColor` so the
 * diagram follows the theme (light / dark); no remote or generated media (D22).
 */

const HEAD = (w: number, h: number, alt: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${alt}" ` +
  `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ` +
  `font-family="sans-serif" font-size="15">`

const label = (x: number, y: number, t: string, anchor = 'middle'): string =>
  `<text x="${x}" y="${y}" fill="currentColor" stroke="none" text-anchor="${anchor}">${t}</text>`

/** Right-angled triangle with the right angle at B (bottom left), AB vertical, BC horizontal. */
export function triangleSvg(ab: number, bc: number, alt: string, unit = 'cm'): string {
  const w = 300
  const h = 220
  const bx = 50
  const by = 180
  const scale = Math.min(190 / bc, 140 / ab)
  const cx = bx + bc * scale
  const ay = by - ab * scale
  return (
    HEAD(w, h, alt) +
    `<path d="M${bx} ${by} L${bx} ${ay} L${cx} ${by} Z" fill="currentColor" fill-opacity="0.08"/>` +
    `<path d="M${bx} ${by - 14} L${bx + 14} ${by - 14} L${bx + 14} ${by}"/>` +
    label(bx - 12, ay + 4, 'A', 'end') +
    label(bx - 12, by + 14, 'B', 'end') +
    label(cx + 14, by + 14, 'C') +
    label(bx - 10, (ay + by) / 2 + 5, `${ab} ${unit}`, 'end') +
    label((bx + cx) / 2, by + 24, `${bc} ${unit}`) +
    `</svg>`
  )
}

/** Bar chart with value labels. */
export function barChartSvg(
  title: string,
  labels: string[],
  values: number[],
  alt: string,
): string {
  const w = 320
  const h = 230
  const max = Math.max(...values)
  const top = 36
  const base = 190
  const gap = (w - 60) / values.length
  const bars = values
    .map((v, i) => {
      const bh = ((base - top) * v) / max
      const x = 40 + i * gap + gap * 0.15
      return (
        `<rect x="${x}" y="${base - bh}" width="${gap * 0.7}" height="${bh}" fill="currentColor" fill-opacity="0.25"/>` +
        label(x + gap * 0.35, base - bh - 6, String(v)) +
        label(x + gap * 0.35, base + 18, labels[i] ?? '')
      )
    })
    .join('')
  return (
    HEAD(w, h, alt) +
    label(w / 2, 20, title) +
    `<path d="M40 ${top - 6} L40 ${base} L${w - 10} ${base}"/>` +
    bars +
    `</svg>`
  )
}

/** Cartesian grid with labelled points. */
export function gridSvg(points: { name: string; x: number; y: number }[], alt: string): string {
  const w = 300
  const h = 260
  const ox = 40
  const oy = 220
  const u = 28
  let grid = ''
  for (let i = 0; i <= 8; i++) {
    grid += `<path d="M${ox + i * u} ${oy} L${ox + i * u} ${oy - 7 * u}" stroke-opacity="0.15" stroke-width="1"/>`
    if (i <= 7)
      grid += `<path d="M${ox} ${oy - i * u} L${ox + 8 * u} ${oy - i * u}" stroke-opacity="0.15" stroke-width="1"/>`
    grid += label(ox + i * u, oy + 16, String(i))
    if (i >= 1 && i <= 7) grid += label(ox - 10, oy - i * u + 5, String(i), 'end')
  }
  const dots = points
    .map(
      (p) =>
        `<circle cx="${ox + p.x * u}" cy="${oy - p.y * u}" r="4" fill="currentColor"/>` +
        label(ox + p.x * u + 10, oy - p.y * u - 8, p.name, 'start'),
    )
    .join('')
  const line =
    points.length >= 2
      ? `<path d="M${ox + points[0]!.x * u} ${oy - points[0]!.y * u} L${ox + points[1]!.x * u} ${oy - points[1]!.y * u}"/>`
      : ''
  return (
    HEAD(w, h, alt) +
    grid +
    `<path d="M${ox} ${oy + 4} L${ox} ${oy - 7 * u - 6}"/><path d="M${ox - 4} ${oy} L${ox + 8 * u + 6} ${oy}"/>` +
    label(ox + 8 * u + 12, oy + 5, 'x') +
    label(ox, oy - 7 * u - 12, 'y') +
    line +
    dots +
    `</svg>`
  )
}

/** Plant cell with three labelled organelles P, Q and R. */
export function plantCellSvg(alt: string): string {
  return (
    HEAD(320, 240, alt) +
    `<rect x="30" y="20" width="260" height="200" rx="26"/>` +
    `<rect x="40" y="30" width="240" height="180" rx="20" stroke-opacity="0.45"/>` +
    `<ellipse cx="110" cy="120" rx="48" ry="30" fill="currentColor" fill-opacity="0.12"/>` +
    `<circle cx="110" cy="120" r="9" fill="currentColor" fill-opacity="0.4"/>` +
    `<ellipse cx="210" cy="82" rx="30" ry="17" fill="currentColor" fill-opacity="0.2"/>` +
    `<path d="M192 82 Q210 70 228 82" stroke-opacity="0.6"/>` +
    `<ellipse cx="206" cy="160" rx="34" ry="24" stroke-dasharray="5 4"/>` +
    label(110, 172, 'P') +
    label(250, 78, 'Q') +
    label(206, 196, 'R') +
    `</svg>`
  )
}

/** A beaker over a flame, used by the Sains stimulus. */
export function circuitSvg(alt: string): string {
  return (
    HEAD(320, 200, alt) +
    `<rect x="40" y="40" width="240" height="120" rx="6"/>` +
    `<path d="M120 40 L120 20 M200 40 L200 20"/>` +
    `<circle cx="160" cy="100" r="22"/>` +
    label(160, 106, 'A') +
    `<path d="M40 80 L70 80 M40 120 L70 120" />` +
    label(160, 188, 'Rajah litar ringkas') +
    `</svg>`
  )
}
