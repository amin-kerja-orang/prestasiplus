/** Error classes of the dump pipeline (AM-10). Messages carry table names, column names and counts only, never a value. */

export class DumpError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

/** Bad flags, bad environment, bad option file, no client binary, unusable output location. */
export class DumpUsageError extends DumpError {}

/** The account can do more than read (or its grants cannot be verified). Nothing was read. */
export class ReadOnlyRequiredError extends DumpError {}

/** The MySQL client failed (non-zero exit, killed). The message holds scrubbed stderr only. */
export class ClientError extends DumpError {}

/** The export stream is not what was asked for (row-count mismatch, invalid JSON line, truncated stream). */
export class ExportStreamError extends DumpError {}

/** The run was interrupted (SIGINT/SIGTERM). */
export class DumpAbortedError extends DumpError {}

/** The wipe refused (symlink, outside .migration-out, unsupported file type). Nothing was deleted. */
export class WipeRefusedError extends DumpError {}
