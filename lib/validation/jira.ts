import { z } from 'zod'

// Klucz projektu Jira: wielka litera, potem wielkie litery/cyfry/_ (reguła Jiry).
// Wpisywany dowolną wielkością liter; puste = odpięcie aplikacji od Jiry.
export const applicationJiraSchema = z.object({
  applicationId: z.string().min(1),
  projectKey: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === '' || /^[A-Z][A-Z0-9_]{1,49}$/.test(v), {
      message: 'Klucz projektu: wielkie litery, cyfry i _, zaczyna się od litery (np. ABC)',
    })
    .transform((v) => (v === '' ? null : v)),
})

// Id wersji Jira (liczbowe w Jira Cloud); puste = odpięcie wersji od Jiry.
export const versionJiraSchema = z.object({
  versionId: z.string().min(1),
  jiraVersionId: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d+$/.test(v), { message: 'Nieprawidłowa wersja Jira' })
    .transform((v) => (v === '' ? null : v)),
})
