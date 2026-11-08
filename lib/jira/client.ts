import type { JiraConfig } from '@/lib/jira/config'

// Minimalny klient Jira Cloud (REST API v3), tylko odczyt. Token nigdy nie trafia
// do logów, wyników ani komunikatów błędów — komunikaty są stałe, treść odpowiedzi
// Jiry nie jest przepisywana.

const TIMEOUT_MS = 10_000

export type JiraErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'server'
  | 'unexpected_response'
  | 'timeout'
  | 'network'

const MESSAGES: Record<JiraErrorKind, string> = {
  unauthorized: 'Nieprawidłowy e-mail lub token API (401).',
  forbidden: 'Konto nie ma uprawnień do tego zasobu w Jirze (403).',
  not_found: 'Nie znaleziono zasobu — sprawdź JIRA_BASE_URL (404).',
  rate_limited: 'Jira ogranicza liczbę zapytań (429).',
  server: 'Jira zwróciła błąd serwera — spróbuj ponownie później.',
  unexpected_response: 'Odpowiedź nie wygląda na Jira Cloud — sprawdź JIRA_BASE_URL.',
  timeout: `Jira nie odpowiedziała w ${TIMEOUT_MS / 1000} s.`,
  network: 'Błąd sieci — nie udało się połączyć z Jirą.',
}

export class JiraError extends Error {
  constructor(
    public readonly kind: JiraErrorKind,
    public readonly status?: number,
    public readonly retryAfterSeconds?: number,
  ) {
    const base = MESSAGES[kind]
    super(retryAfterSeconds ? `${base} Spróbuj za ${retryAfterSeconds} s.` : base)
    this.name = 'JiraError'
  }
}

type FetchFn = typeof fetch

function authHeader(config: JiraConfig): string {
  const raw = `${config.email}:${config.apiToken}`
  return `Basic ${Buffer.from(raw, 'utf8').toString('base64')}`
}

function kindForStatus(status: number): JiraErrorKind {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'server'
  return 'unexpected_response'
}

export async function jiraGet<T>(
  config: JiraConfig,
  path: string,
  fetchFn: FetchFn = fetch,
): Promise<T> {
  let res: Response
  try {
    res = await fetchFn(`${config.baseUrl}${path}`, {
      method: 'GET',
      headers: { Authorization: authHeader(config), Accept: 'application/json' },
      // Przekierowanie (np. na stronę logowania) = zły adres, nie podążamy za nim.
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    throw new JiraError(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network')
  }

  if (!res.ok) {
    const retryAfter = Number(res.headers.get('retry-after'))
    throw new JiraError(
      kindForStatus(res.status),
      res.status,
      res.status === 429 && retryAfter > 0 ? retryAfter : undefined,
    )
  }

  if (!res.headers.get('content-type')?.includes('application/json')) {
    throw new JiraError('unexpected_response', res.status)
  }
  try {
    return (await res.json()) as T
  } catch {
    throw new JiraError('unexpected_response', res.status)
  }
}

export type JiraMyself = {
  accountId: string
  displayName: string
}

// Kto jest zalogowany — test połączenia (J-1).
export async function getMyself(config: JiraConfig, fetchFn?: FetchFn): Promise<JiraMyself> {
  const data = await jiraGet<Partial<JiraMyself>>(config, '/rest/api/3/myself', fetchFn)
  if (typeof data.accountId !== 'string' || typeof data.displayName !== 'string') {
    throw new JiraError('unexpected_response')
  }
  return { accountId: data.accountId, displayName: data.displayName }
}

export type JiraProject = {
  id: string
  key: string
  name: string
}

// Projekt po kluczu — weryfikacja klucza przy podpinaniu aplikacji (J-2).
// 404 = projekt nie istnieje albo konto techniczne go nie widzi.
export async function getProject(
  config: JiraConfig,
  key: string,
  fetchFn?: FetchFn,
): Promise<JiraProject> {
  const data = await jiraGet<Partial<JiraProject>>(
    config,
    `/rest/api/3/project/${encodeURIComponent(key)}`,
    fetchFn,
  )
  if (typeof data.id !== 'string' || typeof data.key !== 'string' || typeof data.name !== 'string') {
    throw new JiraError('unexpected_response')
  }
  return { id: data.id, key: data.key, name: data.name }
}

export type JiraProjectVersion = {
  id: string
  name: string
  released: boolean
  archived: boolean
  releaseDate: string | null // YYYY-MM-DD
}

// Wszystkie wersje projektu (Jira zwraca je w całości, bez paginacji).
export async function getProjectVersions(
  config: JiraConfig,
  key: string,
  fetchFn?: FetchFn,
): Promise<JiraProjectVersion[]> {
  const data = await jiraGet<unknown>(
    config,
    `/rest/api/3/project/${encodeURIComponent(key)}/versions`,
    fetchFn,
  )
  if (!Array.isArray(data)) throw new JiraError('unexpected_response')
  return data.flatMap((v): JiraProjectVersion[] => {
    if (!v || typeof v.id !== 'string' || typeof v.name !== 'string') return []
    return [
      {
        id: v.id,
        name: v.name,
        released: v.released === true,
        archived: v.archived === true,
        releaseDate: typeof v.releaseDate === 'string' ? v.releaseDate : null,
      },
    ]
  })
}
