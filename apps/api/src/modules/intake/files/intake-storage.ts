import { Logger } from '@nestjs/common'

import { idFromString } from '../../../db/ids'
import type { PrismaService } from '../../../db/prisma.service'
import type { FileStorage } from '../../files'

const logger = new Logger('IntakeStorage')

/**
 * Removes stored objects (and their `files` rows) that no committed row refers to: the clean-up after a failed
 * upload or a page write that lost a race with a cancel. Never throws.
 */
export async function discardStored(prisma: PrismaService, storage: FileStorage, ids: ReadonlyArray<string>): Promise<void> {
  for (const id of ids) {
    try {
      const key = idFromString(id)
      const row = await prisma.client.file.findUnique({ where: { id: key }, select: { storageKey: true } })
      if (!row) continue
      await prisma.client.file.delete({ where: { id: key } })
      await storage.delete(row.storageKey)
    } catch {
      logger.warn('Could not clean up a stored intake object')
    }
  }
}
