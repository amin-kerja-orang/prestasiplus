/** Transport switch (V2-T31): `VITE_API_MODE=http` talks to the real API, anything else is the in-browser mock. */
export function isHttpMode(): boolean {
  return import.meta.env.VITE_API_MODE === 'http'
}
