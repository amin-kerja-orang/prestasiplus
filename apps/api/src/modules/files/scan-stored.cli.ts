/**
 * `npm run files:scan-stored -w @pp/api`: report-only malware scan of every stored file (AZ-188, for migrated data).
 * Needs MALWARE_SCAN=clamd and CLAMAV_HOST. Never deletes.
 * Exit 0 only when every file was scanned clean; 1 when any file is infected (wins); 2 when none infected but a file is
 * missing or unscannable, the scanner is unreachable, or the configuration is invalid.
 * Production: `docker compose ... exec api node dist/scan-stored.cli.js` (built next to dist/main.js).
 */
import { loadEnv } from '../../common/config/env.schema'
import { createAdapter, PrismaClient } from '../../db/client'
import { idToString } from '../../db/ids'
import { ClamdScanner } from './clamd.scanner'
import { LocalDiskStorage } from './local-disk.storage'
import { ScannerUnavailableError } from './malware-scanner'

async function main(): Promise<number> {
  let env: ReturnType<typeof loadEnv>
  try {
    env = loadEnv()
  } catch (err) {
    // Names the offending keys only (the message of loadEnv never carries a value).
    console.error(err instanceof Error ? err.message : 'Invalid environment configuration.')
    return 2
  }
  if (env.MALWARE_SCAN !== 'clamd' || !env.CLAMAV_HOST || !env.FILE_STORAGE_DIR) {
    console.error('Set MALWARE_SCAN=clamd, CLAMAV_HOST and FILE_STORAGE_DIR to run this scan.')
    return 2
  }
  const scanner = new ClamdScanner({ host: env.CLAMAV_HOST, port: env.CLAMAV_PORT, timeoutMs: env.CLAMAV_TIMEOUT_MS })
  const storage = new LocalDiskStorage(env.FILE_STORAGE_DIR)
  const prisma = new PrismaClient({ adapter: createAdapter(env.DATABASE_URL) })
  const counts = { scanned: 0, clean: 0, infected: 0, missing: 0, unscannable: 0 }
  const report: string[] = []
  try {
    for (let after = 0n; ; ) {
      const rows = await prisma.file.findMany({
        where: { id: { gt: after } },
        orderBy: { id: 'asc' },
        take: 200,
        select: { id: true, purpose: true, storageKey: true },
      })
      if (rows.length === 0) break
      for (const row of rows) {
        after = row.id
        const label = `${idToString(row.id)} (${row.purpose})`
        let bytes: Buffer | null = null
        try {
          bytes = await storage.get(row.storageKey)
        } catch {
          counts.unscannable++
          report.push(`unscannable ${label}`)
          continue
        }
        if (!bytes) {
          counts.missing++
          report.push(`missing ${label}`)
          continue
        }
        try {
          const result = await scanner.scan(bytes)
          counts.scanned++
          if (result.verdict === 'clean') counts.clean++
          else {
            counts.infected++
            report.push(`infected ${label} ${result.signature}`)
          }
        } catch (err) {
          if (err instanceof ScannerUnavailableError && counts.scanned === 0 && (err.reason === 'ECONNREFUSED' || err.reason === 'ENOTFOUND' || err.reason === 'timeout')) {
            console.error(`Scanner unreachable: ${err.reason}`)
            return 2
          }
          counts.unscannable++
          report.push(`unscannable ${label}`)
        }
      }
    }
  } finally {
    await prisma.$disconnect()
  }
  for (const line of report) console.log(line)
  console.log(JSON.stringify(counts))
  if (counts.infected > 0) return 1
  return counts.unscannable > 0 || counts.missing > 0 ? 2 : 0
}

process.exitCode = await main()
