import type { JiraConfig } from '@/lib/jira/config'
import { jiraGet, JiraError } from '@/lib/jira/client'

// Pobieranie ticketów jednej fixVersion (J-3): enhanced search (`/search/jql`)
// z paginacją po nextPageToken i ponawianiem po 429.

const PAGE_SIZE = 100
const MAX_PAGES = 50 // 5000 ticketów — powyżej to raczej błąd konfiguracji niż wersja
const MAX_RETRIES = 3
const MAX_RETRY_WAIT_S = 30
const FIELDS = 'summary,issuetype,status,assignee,updated'

type RawIssue = {
  id: string
  key: string
  fields: {
    summary?: string | null
    issuetype?: { name?: string } | null
    status?: { name?: string; statusCategory?: { key?: string } } | null
    assignee?: { displayName?: string } | null
    updated?: string | null
  }
}

type SearchPage = { issues?: RawIssue[]; nextPageToken?: string; isLast?: boolean }

export type JiraIssueData = {
  jiraId: string
  key: string
  summary: string
  issueType: string
  statusName: string
  statusCategory: string
  assigneeName: string | null
  jiraUpdatedAt: Date
}

export function mapIssue(raw: RawIssue): JiraIssueData {
  const f = raw.fields ?? {}
  const updated = f.updated ? new Date(f.updated) : null
  return {
    jiraId: String(raw.id),
    key: raw.key,
    summary: f.summary ?? '',
    issueType: f.issuetype?.name ?? '',
    statusName: f.status?.name ?? '',
    statusCategory: f.status?.statusCategory?.key ?? 'undefined',
    assigneeName: f.assignee?.displayName ?? null,
    jiraUpdatedAt: updated && !Number.isNaN(updated.getTime()) ? updated : new Date(0),
  }
}

type Deps = {
  fetchFn?: typeof fetch
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function getWithRetry<T>(config: JiraConfig, path: string, deps: Deps): Promise<T> {
  const sleep = deps.sleep ?? defaultSleep
  for (let attempt = 0; ; attempt++) {
    try {
      return await jiraGet<T>(config, path, deps.fetchFn)
    } catch (e) {
      const retryable = e instanceof JiraError && e.kind === 'rate_limited'
      if (!retryable || attempt >= MAX_RETRIES) throw e
      const waitS = Math.min(e.retryAfterSeconds ?? 2 ** attempt, MAX_RETRY_WAIT_S)
      await sleep(waitS * 1000)
    }
  }
}

export class TooManyIssuesError extends Error {
  constructor() {
    super(`Wersja ma więcej niż ${PAGE_SIZE * MAX_PAGES} ticketów — synchronizacja przerwana.`)
    this.name = 'TooManyIssuesError'
  }
}

export async function fetchFixVersionIssues(
  config: JiraConfig,
  jiraVersionId: string,
  deps: Deps = {},
): Promise<JiraIssueData[]> {
  // jiraVersionId pochodzi z Jiry (J-2), ale i tak tylko cyfry trafiają do JQL.
  if (!/^\d+$/.test(jiraVersionId)) throw new JiraError('unexpected_response')

  const jql = `fixVersion = ${jiraVersionId} ORDER BY key ASC`
  const out: JiraIssueData[] = []
  let token: string | undefined

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      jql,
      fields: FIELDS,
      maxResults: String(PAGE_SIZE),
    })
    if (token) params.set('nextPageToken', token)

    const res = await getWithRetry<SearchPage>(
      config,
      `/rest/api/3/search/jql?${params.toString()}`,
      deps,
    )
    if (!Array.isArray(res.issues)) throw new JiraError('unexpected_response')
    out.push(...res.issues.map(mapIssue))

    if (res.isLast || !res.nextPageToken) return out
    token = res.nextPageToken
  }
  throw new TooManyIssuesError()
}
