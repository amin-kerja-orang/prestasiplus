/**
 * Public entry of the API layer (overview §6.1–§6.3). Module `api/` functions import from here.
 * `bootstrap.ts` installs the transport; the session store configures the token and 401 hook.
 */

export * from './client'
export * from './envelope'
export * from './errors'
export * from './http-transport'
export * from './transport'
export * from './mode'
