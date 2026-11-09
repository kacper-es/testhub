import { requireRolePage } from '@/lib/auth/authz'
import { readJiraConfig, JIRA_ENV_VARS } from '@/lib/jira/config'
import { Card } from '@/components/ui/Card'
import { JiraConnectionTest } from '@/components/admin/JiraConnectionTest'
import { JiraSyncAll } from '@/components/admin/JiraSyncAll'
import { lastAutoSyncRun, readSyncInterval } from '@/lib/jira/auto-sync'

const runFmt = new Intl.DateTimeFormat('pl-PL', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Warsaw',
})

export const dynamic = 'force-dynamic'

export default async function JiraAdminPage() {
  await requireRolePage(['ADMIN'])

  // Konfiguracja czytana na serwerze; do klienta trafia tylko adres i e-mail,
  // token wyłącznie jako „ustawiony".
  const cfg = readJiraConfig()
  const interval = readSyncInterval()
  const lastRun = lastAutoSyncRun()

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Jira</h1>
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

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Synchronizacja ticketów</h2>
          <p className="mt-1 text-sm text-muted">
            Pobiera tickety z podpiętych wersji Jira (fixVersion) do wszystkich otwartych wersji.
            Pojedynczą wersję zsynchronizujesz w jej edycji, w sekcji „Jira&rdquo;.
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded-[3px] border border-border bg-surface-raised px-3 py-2 text-sm">
          <span className="font-medium text-fg">Automatyczna synchronizacja</span>
          {cfg.status !== 'configured' ? (
            <span className="text-muted">Wyłączona — Jira nieskonfigurowana.</span>
          ) : interval.status === 'off' ? (
            <span className="text-muted">
              Wyłączona (<code>JIRA_SYNC_INTERVAL_MINUTES=0</code>).
            </span>
          ) : interval.status === 'invalid' ? (
            <span role="alert" className="text-fail-strong">
              Wyłączona — nieprawidłowa wartość <code>JIRA_SYNC_INTERVAL_MINUTES</code>{' '}
              („{interval.raw}&rdquo;). Dozwolone: 0 (wyłączona) lub 1–1440 minut.
            </span>
          ) : (
            <>
              <span className="text-muted">
                Co {interval.minutes} min (<code>JIRA_SYNC_INTERVAL_MINUTES</code>), pierwsza
                minutę po starcie aplikacji.
              </span>
              {!lastRun ? (
                <span className="text-muted">Od startu aplikacji jeszcze się nie odbyła.</span>
              ) : lastRun.skipped ? (
                <span className="text-muted">
                  Ostatnio {runFmt.format(lastRun.finishedAt)}: pominięta (trwała inna synchronizacja).
                </span>
              ) : (
                <span className={lastRun.failed.length > 0 ? 'text-fail-strong' : 'text-muted'}>
                  Ostatnio {runFmt.format(lastRun.finishedAt)}: {lastRun.versions} wersji
                  {lastRun.failed.length > 0
                    ? `, błędy: ${lastRun.failed.map((f) => `${f.name} — ${f.message}`).join('; ')}`
                    : ', bez błędów'}
                  .
                </span>
              )}
            </>
          )}
        </div>
        <JiraSyncAll disabled={cfg.status !== 'configured'} />
      </Card>
    </main>
  )
}
