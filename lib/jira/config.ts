import { z } from 'zod'

// Konfiguracja Jira Cloud — wyłącznie z env (sekrety nigdy w bazie ani w repo).
// Czysty moduł: przyjmuje env jako argument, więc testy nie muszą ruszać process.env.

export const JIRA_ENV_VARS = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN'] as const
type JiraEnvVar = (typeof JIRA_ENV_VARS)[number]

export type JiraConfig = {
  baseUrl: string // bez końcowego „/"
  email: string
  apiToken: string
}

export type JiraConfigResult =
  | { status: 'configured'; config: JiraConfig }
  | { status: 'missing'; missing: JiraEnvVar[] }
  | { status: 'invalid'; error: string }

const configSchema = z.object({
  baseUrl: z
    .url({ message: 'JIRA_BASE_URL musi być poprawnym adresem URL' })
    .refine((v) => v.startsWith('https://'), {
      message: 'JIRA_BASE_URL musi zaczynać się od https://',
    })
    .transform((v) => v.replace(/\/+$/, '')),
  email: z.email({ message: 'JIRA_EMAIL musi być poprawnym adresem e-mail' }),
  apiToken: z.string().min(1),
})

export function readJiraConfig(
  env: Record<string, string | undefined> = process.env,
): JiraConfigResult {
  const missing = JIRA_ENV_VARS.filter((name) => !env[name]?.trim())
  if (missing.length > 0) return { status: 'missing', missing }

  const parsed = configSchema.safeParse({
    baseUrl: env.JIRA_BASE_URL!.trim(),
    email: env.JIRA_EMAIL!.trim(),
    apiToken: env.JIRA_API_TOKEN!.trim(),
  })
  if (!parsed.success) {
    return {
      status: 'invalid',
      error: parsed.error.issues[0]?.message ?? 'Nieprawidłowa konfiguracja Jira',
    }
  }
  return { status: 'configured', config: parsed.data }
}
