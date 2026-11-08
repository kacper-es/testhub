import { describe, it, expect, vi } from 'vitest'
import { readJiraConfig, type JiraConfig } from '@/lib/jira/config'
import { getMyself, JiraError } from '@/lib/jira/client'

const TOKEN = 'secret-token-123'
const config: JiraConfig = {
  baseUrl: 'https://acme.atlassian.net',
  email: 'bot@acme.com',
  apiToken: TOKEN,
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  })
}

describe('readJiraConfig', () => {
  const full = {
    JIRA_BASE_URL: 'https://acme.atlassian.net/',
    JIRA_EMAIL: 'bot@acme.com',
    JIRA_API_TOKEN: TOKEN,
  }

  it('zwraca konfigurację i obcina końcowy „/" z adresu', () => {
    expect(readJiraConfig(full)).toEqual({
      status: 'configured',
      config: { baseUrl: 'https://acme.atlassian.net', email: 'bot@acme.com', apiToken: TOKEN },
    })
  })

  it('wylicza brakujące zmienne (puste i same spacje też)', () => {
    expect(readJiraConfig({ JIRA_BASE_URL: full.JIRA_BASE_URL, JIRA_EMAIL: '  ' })).toEqual({
      status: 'missing',
      missing: ['JIRA_EMAIL', 'JIRA_API_TOKEN'],
    })
  })

  it('odrzuca http://', () => {
    const res = readJiraConfig({ ...full, JIRA_BASE_URL: 'http://acme.atlassian.net' })
    expect(res.status).toBe('invalid')
  })

  it('odrzuca niepoprawny e-mail i nie ujawnia tokenu w błędzie', () => {
    const res = readJiraConfig({ ...full, JIRA_EMAIL: 'nie-email' })
    expect(res.status).toBe('invalid')
    expect(JSON.stringify(res)).not.toContain(TOKEN)
  })
})

describe('getMyself', () => {
  it('wysyła Basic auth z e-mailem i tokenem na /rest/api/3/myself', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ accountId: 'a1', displayName: 'Bot QA', emailAddress: 'x' }),
    )
    const me = await getMyself(config, fetchFn)

    expect(me).toEqual({ accountId: 'a1', displayName: 'Bot QA' })
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('https://acme.atlassian.net/rest/api/3/myself')
    const expected = Buffer.from(`bot@acme.com:${TOKEN}`).toString('base64')
    expect(init.headers.Authorization).toBe(`Basic ${expected}`)
    expect(init.redirect).toBe('manual')
  })

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [503, 'server'],
    [302, 'unexpected_response'],
  ])('status %i → %s', async (status, kind) => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status }))
    await expect(getMyself(config, fetchFn)).rejects.toMatchObject({ kind, status })
  })

  it('429 przekazuje Retry-After w komunikacie', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 429, headers: { 'retry-after': '30' } }))
    const err = await getMyself(config, fetchFn).catch((e) => e)
    expect(err).toBeInstanceOf(JiraError)
    expect(err.kind).toBe('rate_limited')
    expect(err.message).toContain('30 s')
  })

  it('odpowiedź HTML (np. strona logowania) → unexpected_response', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response('<html></html>', { headers: { 'content-type': 'text/html' } }))
    await expect(getMyself(config, fetchFn)).rejects.toMatchObject({ kind: 'unexpected_response' })
  })

  it('timeout i błąd sieci', async () => {
    const timeout = Object.assign(new Error('t'), { name: 'TimeoutError' })
    await expect(getMyself(config, vi.fn().mockRejectedValue(timeout))).rejects.toMatchObject({
      kind: 'timeout',
    })
    await expect(
      getMyself(config, vi.fn().mockRejectedValue(new TypeError('fetch failed'))),
    ).rejects.toMatchObject({ kind: 'network' })
  })

  it('komunikaty błędów nie zawierają tokenu ani treści odpowiedzi Jiry', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse({ errorMessages: [`bad ${TOKEN}`] }, { status: 401 }))
    const err = await getMyself(config, fetchFn).catch((e) => e)
    expect(err.message).not.toContain(TOKEN)
    expect(JSON.stringify(err)).not.toContain(TOKEN)
  })
})
