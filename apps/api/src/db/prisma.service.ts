import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../common/config/env.schema'
import { createAdapter, PrismaClient, type TxClient } from './client'
import { currentTransaction, type TransactionOptions, withTransaction } from './transaction'

/**
 * The one Prisma client of the API (a `PrismaClient` over the `pg` driver adapter). It connects
 * lazily, so the app boots while the database is down and `/api/health` reports it.
 * Repositories use `prisma.client` (the active transaction if there is one) and services group
 * writes with `prisma.transaction(...)`.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  // PrismaClient instances are proxies, so a getter's `this` is not the instance callers hold.
  private readonly root: PrismaClient

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    super({ adapter: createAdapter(config.get('DATABASE_URL', { infer: true })) })
    this.root = this
  }

  /** The current transaction client inside `transaction(...)`, otherwise this service. */
  get client(): TxClient | PrismaClient {
    return currentTransaction() ?? this.root
  }

  transaction<T>(fn: (tx: TxClient) => Promise<T>, options?: TransactionOptions): Promise<T> {
    return withTransaction(this, fn, options)
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
