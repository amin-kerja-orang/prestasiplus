import { defineConfig } from 'prisma/config'

/**
 * Prisma 7 configuration. The connection URL lives here (not in the schema); the runtime client
 * gets it from `PrismaService` (driver adapter). `prisma generate` needs no database, so the URL
 * is read lazily and only `migrate` commands require `DATABASE_URL`.
 */
export default defineConfig({
  schema: 'prisma/schema',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
})
