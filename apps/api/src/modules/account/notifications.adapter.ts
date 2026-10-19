import { Inject, Injectable } from '@nestjs/common'

import { NotificationsService } from '../notifications'
import type { AccountNotice, NotificationPort } from './ports'

/**
 * Binds `NOTIFICATION_PORT` to the inbox (BE-06 part B). Callers invoke it AFTER the account change
 * has committed, so a rolled-back reset never leaves a notice behind; a failing push is caught by the caller.
 */
@Injectable()
export class NotificationsAdapter implements NotificationPort {
  constructor(@Inject(NotificationsService) private readonly inbox: NotificationsService) {}

  async push(userId: string, notice: AccountNotice): Promise<void> {
    await this.inbox.push(userId, { type: notice.type, category: 'system', title: notice.title, body: notice.body })
  }
}
