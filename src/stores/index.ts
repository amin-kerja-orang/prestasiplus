/**
 * Global Pinia stores (overview §9 "Global stores", ADR-0007). Page data is never kept here: every
 * navigation refetches, as a live page load does.
 */

export * from './flash'
export * from './notification-badge'
export * from './session'
export * from './session-types'
export * from './shell'
