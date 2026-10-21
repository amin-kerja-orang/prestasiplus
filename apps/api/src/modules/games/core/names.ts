/** BR-M16-22: a name cut to 15 characters plus "..." (lobby leaderboards). */
export const truncateName = (name: string): string => (name.length > 15 ? `${name.slice(0, 15)}...` : name)

/** First letters of up to two words, upper case ("Murid Contoh Alfa" -> "MC"). */
export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => (w[0] ?? '').toUpperCase())
    .join('')

/** round(menang / jumlah * 100), 0 when jumlah is 0. */
export const kadarOf = (menang: number, jumlah: number): number => (jumlah === 0 ? 0 : Math.round((menang / jumlah) * 100))
