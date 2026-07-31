import { attachInstance } from '@/app/actions/test-runs'
import { Button } from '@/components/ui/Button'

export type AttachOption = { id: string; name: string; hadData: boolean }

// „Podepnij instancję" (reguła 20): aktywne instancje nieobecne w wersji lub
// odpięte (z adnotacją „były dane"). Formularz server action, bez JS klienta.
export function AttachInstance({
  versionId,
  options,
}: {
  versionId: string
  options: AttachOption[]
}) {
  if (options.length === 0) {
    return (
      <p className="text-sm text-muted">
        Wszystkie aktywne instancje są już podpięte.
      </p>
    )
  }

  return (
    <form action={attachInstance} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="versionId" value={versionId} />
      <label className="flex items-center gap-2">
        <span className="text-sm text-muted">Podepnij instancję</span>
        <select
          name="instanceId"
          required
          defaultValue=""
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg"
        >
          <option value="" disabled>
            Wybierz…
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.hadData ? ' (były dane)' : ''}
            </option>
          ))}
        </select>
      </label>
      <Button variant="secondary" type="submit">
        Podepnij
      </Button>
    </form>
  )
}
