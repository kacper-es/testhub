'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth/authz'
import { readJiraConfig, type JiraConfig } from '@/lib/jira/config'
import { getMyself, getProject, getProjectVersions, JiraError } from '@/lib/jira/client'
import { assertVersionEditable } from '@/lib/versions/guard'
import { logChange } from '@/lib/versions/log-change'
import { applicationJiraSchema, jiraSyncSchema, versionJiraSchema } from '@/lib/validation/jira'
import { fetchFixVersionIssues, TooManyIssuesError } from '@/lib/jira/issues'
import { applyIssueSync } from '@/lib/jira/sync'

export type JiraTestState =
  | { status: 'idle' }
  | { status: 'ok'; displayName: string; baseUrl: string; latencyMs: number }
  | { status: 'error'; error: string }

export type JiraMappingState = { error?: string; saved?: boolean }

type ConfigOrError = { config: JiraConfig } | { error: string }

function jiraConfigOrError(): ConfigOrError {
  const cfg = readJiraConfig()
  if (cfg.status === 'missing') return { error: `Brak zmiennych: ${cfg.missing.join(', ')}.` }
  if (cfg.status === 'invalid') return { error: cfg.error }
  return { config: cfg.config }
}

function jiraErrorMessage(err: unknown): string {
  if (err instanceof JiraError) return err.message
  console.error('Jira request failed with unexpected error')
  return 'Nieoczekiwany błąd podczas łączenia z Jirą.'
}

// Test połączenia z Jira Cloud — tylko ADMIN. Bez wejścia od klienta (nic do
// walidacji zodem) i bez mutacji, więc bez ChangeLog. Wynik nie zawiera tokenu.
export async function testJiraConnection(
  _prev: JiraTestState,
  _formData: FormData,
): Promise<JiraTestState> {
  await requireRole(['ADMIN'])

  const cfg = jiraConfigOrError()
  if ('error' in cfg) return { status: 'error', error: cfg.error }

  const started = Date.now()
  try {
    const me = await getMyself(cfg.config)
    return {
      status: 'ok',
      displayName: me.displayName,
      baseUrl: cfg.config.baseUrl,
      latencyMs: Date.now() - started,
    }
  } catch (err) {
    return { status: 'error', error: jiraErrorMessage(err) }
  }
}

// Podpięcie aplikacji do projektu Jira (J-2) — tylko ADMIN. Klucz weryfikowany
// w Jirze. Zmiana/odpięcie zablokowane, dopóki otwarte wersje aplikacji mają
// podpiętą wersję Jira. Aplikacje nie idą do ChangeLog (reguła 27).
export async function setApplicationJiraProject(
  _prev: JiraMappingState,
  formData: FormData,
): Promise<JiraMappingState> {
  await requireRole(['ADMIN'])

  const parsed = applicationJiraSchema.safeParse({
    applicationId: formData.get('applicationId'),
    projectKey: formData.get('projectKey') ?? '',
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }
  const { applicationId, projectKey } = parsed.data

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { jiraProjectKey: true },
  })
  if (!app) return { error: 'Nie znaleziono aplikacji' }
  if (app.jiraProjectKey === projectKey) return { saved: true }

  const mappedOpen = await prisma.version.findMany({
    where: { applicationId, status: 'IN_PROGRESS', jiraVersionId: { not: null } },
    select: { name: true },
    orderBy: { name: 'asc' },
  })
  if (mappedOpen.length > 0) {
    return {
      error: `Najpierw odepnij od Jiry otwarte wersje: ${mappedOpen.map((v) => v.name).join(', ')}.`,
    }
  }

  let canonicalKey: string | null = null
  if (projectKey) {
    const cfg = jiraConfigOrError()
    if ('error' in cfg) return { error: cfg.error }
    try {
      canonicalKey = (await getProject(cfg.config, projectKey)).key
    } catch (err) {
      if (err instanceof JiraError && err.kind === 'not_found') {
        return { error: `Projekt ${projectKey} nie istnieje albo konto techniczne go nie widzi.` }
      }
      return { error: jiraErrorMessage(err) }
    }
  }

  try {
    await prisma.application.update({
      where: { id: applicationId },
      data: { jiraProjectKey: canonicalKey },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const owner = await prisma.application.findUnique({
        where: { jiraProjectKey: canonicalKey ?? '' },
        select: { name: true },
      })
      return {
        error: `Projekt ${canonicalKey} jest już podpięty do aplikacji ${owner?.name ?? 'innej'}.`,
      }
    }
    throw e
  }

  revalidatePath('/admin/applications')
  revalidatePath(`/admin/applications/${applicationId}/edit`)
  return { saved: true }
}

// Podpięcie wersji do fixVersion z projektu jej aplikacji (J-2) — tylko ADMIN.
// Id wersji Jira weryfikowane po stronie serwera na liście wersji projektu
// (nie ufamy klientowi). Zmiana logowana w ChangeLog w tej samej transakcji.
export async function setVersionJiraVersion(
  _prev: JiraMappingState,
  formData: FormData,
): Promise<JiraMappingState> {
  const user = await requireRole(['ADMIN'])

  const parsed = versionJiraSchema.safeParse({
    versionId: formData.get('versionId'),
    jiraVersionId: formData.get('jiraVersionId') ?? '',
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }
  const { versionId, jiraVersionId } = parsed.data

  const version = await prisma.version.findUnique({
    where: { id: versionId },
    select: {
      status: true,
      jiraVersionId: true,
      application: { select: { jiraProjectKey: true } },
    },
  })
  if (!version) throw new Error('Nie znaleziono wersji')
  assertVersionEditable(version.status)
  if (version.jiraVersionId === jiraVersionId) return { saved: true }

  const projectKey = version.application?.jiraProjectKey ?? null
  let jiraVersionName: string | null = null
  if (jiraVersionId) {
    if (!projectKey) return { error: 'Aplikacja wersji nie jest podpięta do projektu Jira.' }
    const cfg = jiraConfigOrError()
    if ('error' in cfg) return { error: cfg.error }
    try {
      const found = (await getProjectVersions(cfg.config, projectKey)).find(
        (v) => v.id === jiraVersionId,
      )
      if (!found) return { error: `Wybrana wersja nie należy do projektu ${projectKey}.` }
      if (found.released || found.archived) {
        return { error: `Wersja ${found.name} jest w Jirze wydana lub zarchiwizowana.` }
      }
      jiraVersionName = found.name
    } catch (err) {
      return { error: jiraErrorMessage(err) }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Ponowny odczyt w transakcji — status/aplikacja mogły się zmienić w trakcie
      // zapytania do Jiry.
      const current = await tx.version.findUnique({
        where: { id: versionId },
        select: {
          status: true,
          jiraVersionName: true,
          application: { select: { jiraProjectKey: true } },
        },
      })
      if (!current) throw new Error('Nie znaleziono wersji')
      assertVersionEditable(current.status)
      if (jiraVersionId && current.application?.jiraProjectKey !== projectKey) {
        throw new MappingConflictError('Projekt Jira aplikacji zmienił się — odśwież stronę.')
      }

      await tx.version.update({
        where: { id: versionId },
        data: { jiraVersionId, jiraVersionName },
      })
      await logChange(tx, {
        entityType: 'Version',
        entityId: versionId,
        versionId,
        field: 'jiraVersion',
        oldValue: current.jiraVersionName,
        newValue: jiraVersionName,
        userId: user.id,
      })
    })
  } catch (e) {
    if (e instanceof MappingConflictError) return { error: e.message }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const other = await prisma.version.findUnique({
        where: { jiraVersionId: jiraVersionId ?? '' },
        select: { name: true },
      })
      return {
        error: `Wersja Jira ${jiraVersionName} jest już podpięta do wersji ${other?.name ?? 'innej'}.`,
      }
    }
    throw e
  }

  revalidatePath(`/versions/${versionId}`)
  revalidatePath(`/versions/${versionId}/edit`)
  return { saved: true }
}

class MappingConflictError extends Error {}

// --- J-3: synchronizacja ticketów -------------------------------------------

export type JiraSyncState =
  | { status: 'idle' }
  | { status: 'ok'; total: number; done: number; removed: number }
  | { status: 'error'; error: string }

class SyncAbortedError extends Error {}

// Pełna synchronizacja jednej wersji: najpierw całe pobranie z Jiry (poza
// transakcją), potem zapis w jednej transakcji. Błąd pobierania = zero zmian.
async function syncOneVersion(
  versionId: string,
  config: JiraConfig,
): Promise<{ total: number; done: number; removed: number }> {
  const version = await prisma.version.findUnique({
    where: { id: versionId },
    select: { status: true, jiraVersionId: true },
  })
  if (!version) throw new SyncAbortedError('Nie znaleziono wersji.')
  if (version.status !== 'IN_PROGRESS') {
    throw new SyncAbortedError('Wersja jest zamknięta — synchronizacja tylko dla otwartych.')
  }
  if (!version.jiraVersionId) {
    throw new SyncAbortedError('Wersja nie jest podpięta do wersji Jira.')
  }
  const jiraVersionId = version.jiraVersionId

  const issues = await fetchFixVersionIssues(config, jiraVersionId)

  return prisma.$transaction(async (tx) => {
    // Ponowny odczyt — w trakcie pobierania wersja mogła zostać zamknięta lub przepięta.
    const current = await tx.version.findUnique({
      where: { id: versionId },
      select: { status: true, jiraVersionId: true },
    })
    if (!current || current.status !== 'IN_PROGRESS' || current.jiraVersionId !== jiraVersionId) {
      throw new SyncAbortedError('Wersja zmieniła się w trakcie synchronizacji — spróbuj ponownie.')
    }
    return applyIssueSync(tx, versionId, issues, new Date())
  })
}

function syncErrorMessage(err: unknown): string {
  if (err instanceof SyncAbortedError || err instanceof TooManyIssuesError) return err.message
  return jiraErrorMessage(err)
}

// „Synchronizuj teraz" w edycji wersji — tylko ADMIN.
export async function syncVersionJiraIssues(
  _prev: JiraSyncState,
  formData: FormData,
): Promise<JiraSyncState> {
  await requireRole(['ADMIN'])
  const parsed = jiraSyncSchema.safeParse({ versionId: formData.get('versionId') })
  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' }
  }

  const cfg = jiraConfigOrError()
  if ('error' in cfg) return { status: 'error', error: cfg.error }

  try {
    const summary = await syncOneVersion(parsed.data.versionId, cfg.config)
    revalidatePath(`/versions/${parsed.data.versionId}`)
    revalidatePath(`/versions/${parsed.data.versionId}/edit`)
    return { status: 'ok', ...summary }
  } catch (err) {
    return { status: 'error', error: syncErrorMessage(err) }
  }
}

export type JiraSyncAllState =
  | { status: 'idle' }
  | {
      status: 'done'
      results: { name: string; ok: boolean; message: string }[]
    }
  | { status: 'error'; error: string }

// „Synchronizuj wszystkie otwarte wersje" w panelu Jira — tylko ADMIN. Po kolei;
// błąd jednej wersji nie zatrzymuje pozostałych.
export async function syncAllOpenJiraVersions(
  _prev: JiraSyncAllState,
  _formData: FormData,
): Promise<JiraSyncAllState> {
  await requireRole(['ADMIN'])

  const cfg = jiraConfigOrError()
  if ('error' in cfg) return { status: 'error', error: cfg.error }

  const versions = await prisma.version.findMany({
    where: { status: 'IN_PROGRESS', jiraVersionId: { not: null } },
    orderBy: { releaseDate: 'asc' },
    select: { id: true, name: true },
  })

  const results: { name: string; ok: boolean; message: string }[] = []
  for (const v of versions) {
    try {
      const s = await syncOneVersion(v.id, cfg.config)
      results.push({ name: v.name, ok: true, message: syncSummaryText(s) })
      revalidatePath(`/versions/${v.id}`)
    } catch (err) {
      results.push({ name: v.name, ok: false, message: syncErrorMessage(err) })
    }
  }
  return { status: 'done', results }
}

function syncSummaryText(s: { total: number; done: number; removed: number }): string {
  const base = `${s.total} ticketów, ${s.done} gotowych`
  return s.removed > 0 ? `${base}, ${s.removed} wyjętych z wersji` : base
}
