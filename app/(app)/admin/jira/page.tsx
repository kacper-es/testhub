import { requireRolePage } from '@/lib/auth/authz'
import { readJiraConfig, JIRA_ENV_VARS } from '@/lib/jira/config'
import { Card } from '@/components/ui/Card'
import { JiraConnectionTest } from '@/components/admin/JiraConnectionTest'

export const dynamic = 'force-dynamic'

export default async function JiraAdminPage() {
  await requireRolePage(['ADMIN'])

  // Konfiguracja czytana na serwerze; do klienta trafia tylko adres i e-mail,
  // token wyłącznie jako „ustawiony".
  const cfg = readJiraConfig()

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Jira</h1>
        <p className="mt-1 text-sm text-muted">
          Integracja z Jira Cloud — tylko odczyt. Konfiguracja wyłącznie przez zmienne
          środowiskowe.
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Konfiguracja</h2>

        {cfg.status === 'configured' && (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Adres</dt>
            <dd className="break-all">{cfg.config.baseUrl}</dd>
            <dt className="text-muted">E-mail konta</dt>
            <dd className="break-all">{cfg.config.email}</dd>
            <dt className="text-muted">Token API</dt>
            <dd>ustawiony</dd>
          </dl>
        )}

        {cfg.status === 'missing' && (
          <div className="flex flex-col gap-2 text-sm">
            <p className="font-medium text-warn-strong">Nieskonfigurowane</p>
            <p>Brakujące zmienne środowiskowe:</p>
            <ul className="list-inside list-disc">
              {cfg.missing.map((name) => (
                <li key={name}>
                  <code>{name}</code>
                </li>
              ))}
            </ul>
          </div>
        )}

        {cfg.status === 'invalid' && (
          <p role="alert" className="text-sm text-fail-strong">
            Nieprawidłowa konfiguracja: {cfg.error}
          </p>
        )}

        {cfg.status !== 'configured' && (
          <p className="text-sm text-muted">
            Uzupełnij {JIRA_ENV_VARS.join(', ')} w pliku <code>.env</code> obok{' '}
            <code>docker-compose.yml</code> i zrestartuj kontener (
            <code>docker compose up -d</code>). Token wygenerujesz na id.atlassian.com →
            Security → API tokens.
          </p>
        )}

        <JiraConnectionTest disabled={cfg.status !== 'configured'} />
      </Card>
    </main>
  )
}
