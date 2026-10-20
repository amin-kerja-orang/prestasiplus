/**
 * Log hygiene for the staging CLI (BE-27 AC5): no connection string, user name or password may
 * reach stdout, stderr or an error message. Loader messages are built from table names, counts and
 * SQLSTATE codes only; `scrub` is the last line of defence for anything that still slips through
 * (driver errors, a URL typed into a flag).
 */

const URL_IN_TEXT = /\b(postgres(?:ql)?|mysql|mariadb):\/\/[^\s'"`]*/gi

/** Strings that must never be printed for a connection URL: the URL, its user and its password. */
export function secretsFromUrl(url: string | undefined): string[] {
  if (!url) return []
  const secrets = [url]
  try {
    const u = new URL(url)
    for (const part of [u.password, u.username]) {
      if (part) secrets.push(part, decodeURIComponent(part))
    }
  } catch {
    // Not a parsable URL: the whole value is already a secret.
  }
  return secrets.filter((s) => s.length > 0)
}

/** Replaces URLs and the given secrets. Longest secrets first so a password inside a URL goes whole. */
export function scrub(text: string, secrets: readonly string[] = []): string {
  let out = text
  for (const secret of [...secrets].sort((x, y) => y.length - x.length)) {
    if (secret.length > 0) out = out.split(secret).join('[redacted]')
  }
  return out.replace(URL_IN_TEXT, '$1://[redacted]')
}

export interface Logger {
  info(message: string): void
  warn(message: string): void
}

/** A logger that scrubs every line before it reaches the sink. */
export function scrubbingLogger(
  sink: { out(line: string): void; err(line: string): void },
  secrets: readonly string[],
): Logger {
  return {
    info: (m) => sink.out(scrub(m, secrets)),
    warn: (m) => sink.err(scrub(m, secrets)),
  }
}

export const silentLogger: Logger = { info: () => undefined, warn: () => undefined }
