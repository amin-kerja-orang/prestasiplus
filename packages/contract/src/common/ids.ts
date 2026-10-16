import { z } from '../zod'

/**
 * Entity id on the wire: an opaque, non-empty string (ADR-0018 item 6, v2-data-migration X1).
 *
 * Decision (V2-T06): ids are strings. The backend generates its own primary keys (bigint identity,
 * serialised as a decimal string so JavaScript never loses precision, or UUID for session-like
 * records) and keeps the .cloud key in an internal `legacy_cloud_id` column that is NOT part of
 * the contract. Clients must never parse, compare numerically or construct ids. The mock's
 * `ID_RANGES` stays inside the mock.
 *
 * Transition note: the prototype still uses numeric ids for users and schools; the realign tasks
 * (V2-T09, V2-T24) move those to this type.
 */
export const IdSchema = z.string().min(1).max(64).meta({
  id: 'Id',
  description: 'Opaque entity id (string). Never parse or construct on the client.',
  example: '1042',
})
export type Id = z.infer<typeof IdSchema>

/** Client-generated idempotency key (offline sync), e.g. `clientUuid` of practice sessions. */
export const ClientUuidSchema = z.uuid().meta({
  id: 'ClientUuid',
  description: 'Client-generated UUID used as an idempotency key.',
})
export type ClientUuid = z.infer<typeof ClientUuidSchema>
