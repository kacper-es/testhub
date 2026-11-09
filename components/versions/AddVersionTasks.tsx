import { addVersionTasks } from '@/app/actions/versions'
import { Button } from '@/components/ui/Button'

export type MissingTemplate = { id: string; name: string }

// „Dodaj zadanie z szablonu" (reguła 6): aktywne szablony nieobecne w wersji
// oraz zadania odpięte (V-3) — wybór odpiętego przywraca je z danymi.
// Formularze server action, bez JS klienta (jak AttachInstance).
export function AddVersionTasks({
  versionId,
  missing,
  unpinned,
}: {
  versionId: string
  missing: MissingTemplate[]
  unpinned: MissingTemplate[]
}) {
  if (missing.length === 0 && unpinned.length === 0) {
    return (
      <p className="text-sm text-muted">
        Wszystkie aktywne szablony są już w tej wersji.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={addVersionTasks} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="versionId" value={versionId} />
        <label className="flex items-center gap-2">
          <span className="text-sm text-muted">Dodaj zadanie z szablonu</span>
          <select
            name="templateId"
            required
            defaultValue=""
            className="rounded-[3px] border border-border-strong bg-bg px-3 py-2 text-sm text-fg"
          >
            <option value="" disabled>
              Wybierz…
            </option>
            {missing.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            {unpinned.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} (odpięte — przywróć)
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" type="submit">
          Dodaj
        </Button>
      </form>

      {missing.length > 1 && (
        <form action={addVersionTasks}>
          <input type="hidden" name="versionId" value={versionId} />
          <input type="hidden" name="templateId" value="" />
          <Button variant="secondary" type="submit">
            Dodaj wszystkie brakujące ({missing.length})
          </Button>
        </form>
      )}
    </div>
  )
}
