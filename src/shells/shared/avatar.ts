/**
 * Shell avatar image (M01 FR-M01-52, BR-15). Live renders an `<img alt="Avatar">` whose source is
 * the uploaded picture or a generated initials image (`ui-avatars.com/api/?name=…&background=6366F1
 * &color=fff&bold=true`). The prototype has no external image service, so the initials image is a
 * local SVG data URL with the same look: white bold initials on `#6366F1`, square (the shells clip
 * it round with `rounded-full`).
 */

/** Up to two initials, from the first two words, upper case ("Admin PRESTASI+" → "AP"). */
export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
  const letters = words.slice(0, 2).map((word) => word.charAt(0).toLocaleUpperCase('ms-MY'))
  return letters.join('') || '?'
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/** SVG data URL of the initials avatar (BR-15 shells: `#6366F1`, white, bold). */
export function initialsAvatarUrl(name: string, background = '#6366F1'): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" fill="${background}"/>` +
    `<text x="50%" y="50%" dy=".35em" text-anchor="middle" fill="#fff" ` +
    `font-family="Inter, Arial, sans-serif" font-size="26" font-weight="700">` +
    `${escapeXml(initialsOf(name))}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** The avatar source for a user: the uploaded picture, else the initials image. */
export function avatarSrc(user: { name: string; avatarUrl: string | null } | null): string {
  if (!user) return initialsAvatarUrl('')
  return user.avatarUrl || initialsAvatarUrl(user.name)
}
