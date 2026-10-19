import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

/** One reset mail. `link` and `token` are secrets: an implementation must never write them to a shared log in production. */
export interface PasswordResetMail {
  to: string
  /** Decimal-string user id. */
  userId: string
  /** Id of the `password_resets` row (safe to log). */
  resetId: string
  /** The raw token (exists only here and in the mail). */
  token: string
  /** Relative link, token in the URL fragment: `/password/reset#token=...&email=...`. */
  link: string
  expiresAt: Date
}

/** Outgoing mail. B1 has no provider (OD-7, D14): the only implementation logs; nothing is sent. */
export interface MailPort {
  sendPasswordReset(mail: PasswordResetMail): Promise<void>
}
export const MAIL_PORT = Symbol('MAIL_PORT')

/** `a***@example.com`: enough for a developer to recognise the mailbox, useless to an attacker. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 1) return '***'
  return `${email.slice(0, 1)}***${email.slice(at)}`
}

/**
 * The B1 `MailPort`: nothing is e-mailed. By default it logs the masked address and the reset id
 * only, so the normal access and app log never holds a token or a working link (the contract says
 * the same). A developer who needs the link on a laptop sets `MAIL_LOG_RESET_LINKS=true`; it is read
 * only when `NODE_ENV=development` (it is ignored in `test` and `production`, and a production
 * start with the flag set is refused by the env loader). The link then goes to a separate logger
 * context (`MailPort.dev`) at `warn`, so it is easy to keep out of any shipped log.
 */
@Injectable()
export class LoggingMailPort implements MailPort {
  private readonly logger = new Logger('MailPort')
  private readonly devLogger = new Logger('MailPort.dev')
  private readonly logLinks: boolean

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.logLinks = config.get('NODE_ENV') === 'development' && String(config.get('MAIL_LOG_RESET_LINKS') ?? '') === 'true'
  }

  async sendPasswordReset(mail: PasswordResetMail): Promise<void> {
    this.logger.log(`password reset mail not sent (no provider): to=${maskEmail(mail.to)} resetId=${mail.resetId}`)
    if (this.logLinks) this.devLogger.warn(`DEV ONLY reset link for resetId=${mail.resetId}: ${mail.link}`)
    return Promise.resolve()
  }
}

/** What the account flows tell a user. `category` is always `system`. */
export interface AccountNotice {
  type: string
  title: string
  body: string
}

/**
 * Seam to the notification inbox (D59a). Part B's `NotificationsService.push(userId, {type, category,
 * title, body})` is wired behind this token by the LEAD; until then the default is a no-op. A failing
 * port never fails the account request.
 */
export interface NotificationPort {
  push(userId: string, notice: AccountNotice): Promise<void>
}
export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT')

@Injectable()
export class NoopNotificationPort implements NotificationPort {
  push(): Promise<void> {
    return Promise.resolve()
  }
}
