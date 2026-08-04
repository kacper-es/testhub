import { cn } from '@/lib/cn'

// Ikona aplikacji przy nazwie wersji. Rozmiar 1em → skaluje się do fontu
// elementu, w którym jest osadzona (text-lg na karcie, text-2xl w widoku).
// Renderowana tylko gdy aplikacja ma wgraną ikonę.
export type VersionAppIcon = {
  id: string
  name: string
  iconType: string | null
  iconUpdatedAt: Date | null
}

export function AppIcon({
  app,
  className,
}: {
  app: VersionAppIcon | null | undefined
  className?: string
}) {
  if (!app || !app.iconType) return null

  const v = app.iconUpdatedAt ? new Date(app.iconUpdatedAt).getTime() : 0

  return (
    // eslint-disable-next-line @next/next/no-img-element -- mała ikona z bazy, dynamiczne id; Image nie pasuje
    <img
      src={`/api/applications/${app.id}/icon?v=${v}`}
      alt={app.name}
      title={app.name}
      width={16}
      height={16}
      className={cn(
        'inline-block h-[1em] w-[1em] shrink-0 rounded-sm object-contain align-[-0.125em]',
        className,
      )}
    />
  )
}
