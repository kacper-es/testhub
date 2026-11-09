import { requireUser } from '@/lib/auth/authz'
import { Card, Eyebrow } from '@/components/ui/Card'
import { ThemeToggle } from '@/components/ThemeToggle'
import { PalettePicker } from '@/components/PalettePicker'

// UI-3: ustawienia własnego konta — motyw i paleta akcentu (dostępne dla każdej roli).
export default async function SettingsPage() {
  const user = await requireUser()

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-8">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Konto · {user.name}</Eyebrow>
        <h1 className="m-0 text-3xl font-bold tracking-tight">Ustawienia</h1>
      </div>

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="m-0">
            <Eyebrow>Motyw</Eyebrow>
          </h2>
          <p className="mt-1 text-sm text-muted">
            Systemowy idzie za ustawieniem jasny/ciemny w systemie operacyjnym.
          </p>
        </div>
        <div className="max-w-sm">
          <ThemeToggle current={user.theme} />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="m-0">
            <Eyebrow>Paleta kolorów</Eyebrow>
          </h2>
          <p className="mt-1 text-sm text-muted">
            Kolor akcentu i „gotowe&rdquo; w całej aplikacji. Ostrzeżenia i błędy mają te same
            kolory w każdej palecie. Wybór dotyczy tylko twojego konta.
          </p>
        </div>
        <PalettePicker current={user.palette} />
      </Card>
    </main>
  )
}
