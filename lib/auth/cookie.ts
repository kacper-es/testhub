// Lekki moduł bez zależności od Prismy / next-headers — bezpieczny do importu
// w middleware (runtime Edge).
export const SESSION_COOKIE = 'rh_session'

// `secure` flag for every cookie the app sets. Default: on in production.
// COOKIE_SECURE=false is an explicit opt-out for a deployment served over plain
// HTTP (no reverse proxy with TLS yet) — otherwise the browser drops the cookie.
// Env vars are read with literal names so the value is resolved the same way in
// the Edge middleware and in the Node server.
export function cookieSecure(
  cookieSecureVar: string | undefined = process.env.COOKIE_SECURE,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  const v = cookieSecureVar?.trim().toLowerCase()
  if (v === 'false') return false
  if (v === 'true') return true
  return nodeEnv === 'production'
}
