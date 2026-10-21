import { isAbsolute } from 'node:path'

import { z } from 'zod'

import { parseCidrList } from '../metrics/cidr'

/**
 * Environment of the API (plan section 11). Every key here must also be in `.env.api.example`
 * (and vice versa); a test enforces it. Later cards add their keys here in their own block.
 */
export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  // PC-1 block (BE-02). The message must not echo the value (it holds a password).
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgresql:// URL'),
  // BE-03 (auth). Optional here; the auth module applies the defaults and, in production, refuses to start
  // without a strong SESSION_SECRET.
  SESSION_COOKIE_NAME: z.string().min(1).optional(),
  // Required in production (see loadEnv); a fixed development default is applied outside production.
  SESSION_SECRET: z.string().optional(),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  THROTTLE_LOGIN_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  // BE-05 (schools): requests per minute, counted per process. Public routes per client address, admin routes per user.
  THROTTLE_PUBLIC_PER_MINUTE: z.coerce.number().int().min(1).default(60),
  // BE-06: self-registration attempts per minute per client address (own bucket, tolerant of a school behind one NAT).
  THROTTLE_REGISTER_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  THROTTLE_PUBLIC_SEARCH_PER_MINUTE: z.coerce.number().int().min(1).default(300),
  THROTTLE_ADMIN_READ_PER_MINUTE: z.coerce.number().int().min(1).default(300),
  THROTTLE_ADMIN_WRITE_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  // BE-05 (users): bulk imports per hour per user.
  THROTTLE_IMPORT_PER_HOUR: z.coerce.number().int().min(1).default(10),
  // BE-25 (parents): invite throttles, counted per process. Preview per client address; the others per user.
  THROTTLE_PARENT_INVITE_PREVIEW_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  THROTTLE_PARENT_INVITE_READ_PER_MINUTE: z.coerce.number().int().min(1).default(120),
  THROTTLE_PARENT_INVITE_ISSUE_PER_HOUR: z.coerce.number().int().min(1).default(10),
  THROTTLE_PARENT_INVITE_ACCEPT_PER_HOUR: z.coerce.number().int().min(1).default(30),
  THROTTLE_PARENT_LINK_WRITE_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  // BE-06 (notifications): inbox throttles per user, counted per process.
  THROTTLE_NOTIFICATION_READ_PER_MINUTE: z.coerce.number().int().min(1).default(240),
  THROTTLE_NOTIFICATION_WRITE_PER_MINUTE: z.coerce.number().int().min(1).default(60),
  THROTTLE_WALLET_READ_PER_MINUTE: z.coerce.number().int().min(1).default(240),
  // BE-24 part C (support, audio KBAT): throttles per user (the support contact per client address), counted per process.
  THROTTLE_SUPPORT_TICKET_CREATE_PER_HOUR: z.coerce.number().int().min(1).default(10),
  THROTTLE_GAMIFICATION_CONVERT_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  THROTTLE_SHOP_WRITE_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  THROTTLE_SUPPORT_READ_PER_MINUTE: z.coerce.number().int().min(1).default(120),
  THROTTLE_SUPPORT_CONFIG_PER_MINUTE: z.coerce.number().int().min(1).default(60),
  THROTTLE_AUDIO_KBAT_READ_PER_MINUTE: z.coerce.number().int().min(1).default(120),
  THROTTLE_AUDIO_KBAT_FILE_PER_MINUTE: z.coerce.number().int().min(1).default(60),
  THROTTLE_AUDIO_KBAT_ATTEMPT_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  THROTTLE_AUDIO_KBAT_ADMIN_WRITE_PER_HOUR: z.coerce.number().int().min(1).default(20),
  // BE-19 (performance reports): read throttle per user, counted per process.
  THROTTLE_PERFORMANCE_READ_PER_MINUTE: z.coerce.number().int().min(1).default(120),
  // BE-19 headcount writes (create, auto-setup, drop, reset, delete): per user, counted per process.
  THROTTLE_PERFORMANCE_WRITE_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  // BE-19 timeline posts (POST /timeline, multipart with photos): per user, counted per process.
  THROTTLE_TIMELINE_WRITE_PER_MINUTE: z.coerce.number().int().min(1).default(10),
  // BE-21 (school admin): throttles per user, counted per process.
  THROTTLE_SCHOOL_ADMIN_READ_PER_MINUTE: z.coerce.number().int().min(1).default(120),
  THROTTLE_SCHOOL_ADMIN_WRITE_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  THROTTLE_SCHOOL_ADMIN_CREATE_PER_MINUTE: z.coerce.number().int().min(1).default(10),
  THROTTLE_SCHOOL_ADMIN_RESET_PER_MINUTE: z.coerce.number().int().min(1).default(10),
  THROTTLE_SCHOOL_ADMIN_EXPORT_PER_MINUTE: z.coerce.number().int().min(1).default(5),
  // BE-05 (users): HMAC key of the IC number hash. Unset: SESSION_SECRET is used (required in production). Rotating it breaks IC lookups until every ic_hash is recomputed.
  IC_HASH_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(16).optional()),
  /** BE-24: extra origins (comma separated, e.g. https://app.example) whose /api/files/<token> URLs an article or banner image may use, besides the API's own origin. */
  PUBLIC_ORIGINS: z.string().optional(),
  /** Reverse-proxy hops to trust for the client address (0 = none). */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  /** Lifetime of a "remember me" session in days (LEAD decision: 30). */
  SESSION_REMEMBER_DAYS: z.coerce.number().int().min(1).default(30),
  /** Remember lifetime in days for admin and school_admin; 0 turns remember off for them. */
  SESSION_REMEMBER_DAYS_STAFF: z.coerce.number().int().min(0).default(1),
  /** Allow seeding the demo accounts (never in production). */
  ALLOW_DEMO_SEED: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  /**
   * Bijak SPM PoC questions (LEAD decision 2026-10-20 16:00: staging only, never prod). true serves the reserved
   * PoC id block (seeded PoC papers, Jana pool); false (default) refuses those ids, so only BE-09 questions are served.
   * Set true wherever ALLOW_DEMO_SEED loads the demo seed (staging, dev, e2e).
   */
  BIJAK_POC_QUESTIONS: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  /** Cost (4..13) of the throw-away bcrypt hash that evens out login timing for unknown accounts. */
  LEGACY_BCRYPT_DUMMY_COST: z.coerce.number().int().min(4).max(13).default(12),
  /** A failed login (wrong password, unknown identifier) never answers sooner than this many ms (timing oracle floor). */
  LOGIN_FAILURE_FLOOR_MS: z.coerce.number().int().min(0).max(10_000).default(1500),
  /** Failed logins per 15 minutes for one identifier across all addresses, before 429. */
  LOGIN_IDENTIFIER_FAIL_LIMIT: z.coerce.number().int().min(5).default(100),
  // BE-04 (files). Optional here; FilesConfig applies the defaults (10, 20, 30, 120). FILE_STORAGE_DIR is required in production and must be an absolute path (see loadEnv).
  FILE_STORAGE_DIR: z.string().trim().min(1).optional(),
  /** Global ceiling of one upload in MB; each purpose has its own, lower limit. */
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(100).optional(),
  /** Ceiling of a derived intake file (page image, figure crop, original) in MB. */
  INTAKE_MAX_FILE_MB: z.coerce.number().int().min(1).max(200).optional(),
  /** Uploads and file deletes per user per minute before 429. */
  UPLOAD_RATE_PER_MINUTE: z.coerce.number().int().min(1).max(1000).optional(),
  /** Downloads per user per minute (anonymous cms_image reads: per address) before 429. */
  FILE_READS_PER_MINUTE: z.coerce.number().int().min(1).max(10000).optional(),
  // BE-06 (account). Optional: the code applies 30 writes per minute per user when unset.
  // BE-33: global per-address ceiling on every /api route except /api/health (default 300 per minute, per process).
  THROTTLE_GLOBAL_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  THROTTLE_ACCOUNT_WRITE_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  // BE-16 (Bijak attempts). All optional: the code applies the defaults (save 240, lifecycle 30, Semak 60, photo 20 per minute per user; sweep every 60 s, 0 = off, off under NODE_ENV=test).
  THROTTLE_BIJAK_ATTEMPT_SAVE_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  THROTTLE_BIJAK_ATTEMPT_WRITE_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  THROTTLE_BIJAK_CHECK_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  THROTTLE_BIJAK_PHOTO_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  BIJAK_SWEEP_INTERVAL_SECONDS: z.coerce.number().int().min(0).max(3600).optional(),
  // BE-12 (practice). Optional: the code applies 120 writes (start, check, submit) per minute per user when unset.
  THROTTLE_PRACTICE_WRITE_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  THROTTLE_PRACTICE_READ_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  // BE-13 (practice reads). Optional: the code applies 30 SPM-target saves and 60 structured attempts per minute per user when unset.
  THROTTLE_SPM_TARGETS_WRITE_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  THROTTLE_STRUCTURED_ATTEMPT_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  // BE-09 (question bank). Optional: the code applies 60 writes per minute per user when unset.
  THROTTLE_QUESTIONS_WRITE_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  // BE-06: development only. true lets the logging MailPort print the password reset link (a secret) to the log. Ignored outside NODE_ENV=development; refused at start in production.
  MAIL_LOG_RESET_LINKS: z.enum(['true', 'false']).optional(),
  // BE-17 (classes). Throttles per user and the public origin of the join link (QR payload); the code applies the defaults when unset.
  THROTTLE_CLASSES_READ_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  THROTTLE_CLASSES_WRITE_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  THROTTLE_CLASS_JOIN_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  PUBLIC_BASE_URL: z.url().optional(),
  // BE-37 (jobs, OCR, intake files). All optional: the code applies the defaults named in .env.api.example (PC-5 block).
  /** true starts the in-process job worker tick; false (default) runs nothing in this process. */
  JOBS_WORKER_ENABLED: z.enum(['true', 'false']).optional(),
  JOBS_POLL_MS: z.coerce.number().int().min(100).max(60_000).optional(),
  JOBS_CONCURRENCY: z.coerce.number().int().min(1).max(32).optional(),
  JOBS_LOCK_TIMEOUT_MS: z.coerce.number().int().min(1000).max(3_600_000).optional(),
  JOBS_BACKOFF_BASE_MS: z.coerce.number().int().min(100).max(600_000).optional(),
  /** none = no OCR (scanned pages fail with OCR_UNAVAILABLE); tesseract needs OCR_LANG_DIR with msa and eng traineddata. */
  OCR_ENGINE: z.enum(['none', 'tesseract']).optional(),
  /** Empty = unset. When OCR_ENGINE=tesseract: an absolute folder with msa.traineddata and eng.traineddata. */
  OCR_LANG_DIR: z.string().trim().optional(),
  OCR_WORKERS: z.coerce.number().int().min(1).max(16).optional(),
  OCR_PAGE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600_000).optional(),
  OCR_INSPECT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600_000).optional(),
  OCR_MAX_PAGES: z.coerce.number().int().min(1).max(2000).optional(),
  OCR_MIN_TEXT_CHARS: z.coerce.number().int().min(0).max(10_000).optional(),
  OCR_RENDER_DPI: z.coerce.number().int().min(72).max(400).optional(),
  OCR_MAX_PIXELS: z.coerce.number().int().min(100_000).max(100_000_000).optional(),
  OCR_WORKER_MEMORY_MB: z.coerce.number().int().min(64).max(4096).optional(),
  /** RSS growth (MB) of the process while one PDF worker runs before the watchdog stops it. Default 2 x OCR_WORKER_MEMORY_MB. */
  OCR_WORKER_RSS_LIMIT_MB: z.coerce.number().int().min(64).max(16_384).optional(),
  /** Uploads whose PDFs are inspected at the same time in this process (more wait). Default 2. */
  INTAKE_UPLOAD_CONCURRENCY: z.coerce.number().int().min(1).max(16).optional(),
  INTAKE_MAX_FILES_PER_BATCH: z.coerce.number().int().min(1).max(50).optional(),
  INTAKE_MAX_ACTIVE_BATCHES: z.coerce.number().int().min(1).max(100).optional(),
  INTAKE_DAILY_PAGE_QUOTA: z.coerce.number().int().min(1).max(100_000).optional(),
  INTAKE_WRITES_PER_MINUTE: z.coerce.number().int().min(1).max(1000).optional(),
  INTAKE_READS_PER_MINUTE: z.coerce.number().int().min(1).max(10_000).optional(),
  // BE-20 (Kirkpatrick, feedback). Throttles per user; the code applies the defaults when unset.
  THROTTLE_KIRKPATRICK_READ_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  THROTTLE_KIRKPATRICK_WRITE_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  // BE-20 (M11 monitoring and teacher report). Throttle per user; the code applies the default when unset.
  THROTTLE_ANALYTICS_READ_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  // BE-43 (Cikgu Alesa). Throttles per user; the code applies the defaults when unset (send 20, read 120, write 30, CSV export 10 per minute).
  THROTTLE_CIKGU_SEND_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  THROTTLE_CIKGU_READ_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  THROTTLE_CIKGU_WRITE_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  THROTTLE_CIKGU_EXPORT_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  // BE-45 (games). Optional: the code applies the defaults (write 60, read 240, spin 10, solo start 30, solo check 600 per minute per user).
  THROTTLE_GAMES_WRITE_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  THROTTLE_GAMES_READ_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  THROTTLE_GAMES_SPIN_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  THROTTLE_GAMES_SOLO_START_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  THROTTLE_GAMES_SOLO_CHECK_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  // BE-47 (Mohon Keluarga Angkat). Throttle per user; the code applies the default when unset (5 per minute).
  THROTTLE_FOSTER_APPLICATION_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  // BE-33 (runtime): HTTP server timeouts, graceful shutdown, metrics switch. Optional; the code applies the defaults
  // (REQUEST_TIMEOUT_MS 120000, HEADERS_TIMEOUT_MS 60000, KEEP_ALIVE_TIMEOUT_MS 65000, SHUTDOWN_GRACE_MS 25000, METRICS_ENABLED true).
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(3_600_000).optional(),
  HEADERS_TIMEOUT_MS: z.coerce.number().int().min(1000).max(3_600_000).optional(),
  KEEP_ALIVE_TIMEOUT_MS: z.coerce.number().int().min(0).max(3_600_000).optional(),
  SHUTDOWN_GRACE_MS: z.coerce.number().int().min(1000).max(600_000).optional(),
  METRICS_ENABLED: z.enum(['true', 'false']).optional(),
  // Comma list of CIDRs allowed to scrape /api/metrics without a session (direct peer only). Unset: production = admin session only.
  METRICS_INTERNAL_CIDRS: z
    .string()
    .optional()
    .superRefine((v, ctx) => {
      if (v === undefined || v === '') return
      try {
        parseCidrList(v)
      } catch (e) {
        ctx.addIssue({ code: 'custom', message: e instanceof Error ? e.message : 'invalid CIDR list' })
      }
    }),
})
export type Env = z.infer<typeof EnvSchema>

/** Parse and validate raw env; the error message names every offending key. */
export function loadEnv(raw: Record<string, unknown> = process.env): Env {
  const parsed = EnvSchema.safeParse(raw)
  if (parsed.success) return withSessionSecret(parsed.data)
  const problems = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
  throw new Error(`Invalid environment configuration. ${problems.join('; ')}`)
}

export const DEV_SESSION_SECRET = 'dev-only-session-secret-not-for-production'
const MIN_SECRET_LENGTH = 16
const MIN_IC_KEY_LENGTH = 32

/** SESSION_SECRET and IC_HASH_KEY: strong values are mandatory in production (boot fails; no fallback between them); other environments get a dev default. */
function withSessionSecret(env: Env): Env {
  if (env.NODE_ENV !== 'production') return { ...env, SESSION_SECRET: env.SESSION_SECRET || DEV_SESSION_SECRET }
  const secret = env.SESSION_SECRET
  if (!secret || secret.length < MIN_SECRET_LENGTH || secret === 'change-me') {
    throw new Error(
      `Invalid environment configuration. SESSION_SECRET: required in production, at least ${MIN_SECRET_LENGTH} characters and not the placeholder`,
    )
  }
  const icKey = env.IC_HASH_KEY
  if (!icKey || icKey.length < MIN_IC_KEY_LENGTH || icKey === secret) {
    throw new Error(
      `Invalid environment configuration. IC_HASH_KEY: required in production, at least ${MIN_IC_KEY_LENGTH} characters and different from SESSION_SECRET`,
    )
  }
  if (env.MAIL_LOG_RESET_LINKS === 'true') {
    throw new Error('Invalid environment configuration. MAIL_LOG_RESET_LINKS: must not be true in production (it would write reset links to the log)')
  }
  const dir = env.FILE_STORAGE_DIR
  if (!dir || !isAbsolute(dir)) {
    throw new Error('Invalid environment configuration. FILE_STORAGE_DIR: required in production and must be an absolute path')
  }
  return env
}
