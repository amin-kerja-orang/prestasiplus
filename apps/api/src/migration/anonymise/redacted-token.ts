/**
 * The text that `redact-pii` (redact.ts) writes in place of a masked span. Kept in a file of its own, without imports,
 * so that the question transform (QLOAD) can hold a question that carries it without pulling in the anonymiser.
 * It has no digit, no `@` and no URL, so it matches no leak-scan pattern and no other `piiKindsOf` kind.
 */
export const REDACTED_TOKEN = '[maklumat peribadi dipadam]'
