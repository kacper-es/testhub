// Browsers silently drop `Secure` cookies set for a page opened over plain HTTP
// (localhost is the exception). The symptom is confusing — login seems to work,
// the next form submit lands back on /login — so we detect it and say so.
// No dependencies: used by the login form (client) and the login action (server).

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export function secureCookieWillBeDropped(
  pageUrl: string | null | undefined,
  secureCookies: boolean,
): boolean {
  if (!secureCookies || !pageUrl) return false
  let url: URL
  try {
    url = new URL(pageUrl)
  } catch {
    return false
  }
  if (url.protocol !== 'http:') return false
  return !(LOCAL_HOSTS.has(url.hostname) || url.hostname.endsWith('.localhost'))
}
