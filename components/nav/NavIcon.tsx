// UI-4: small stroke icons for the sidebar (shown alone when it is collapsed).
// Inline SVG, currentColor — no icon dependency.
const PATHS = {
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  versions: 'M12 3 2 8l10 5 10-5-10-5zM2 13l10 5 10-5M2 18l10 5 10-5',
  archive: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4',
  admin: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3z',
  account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  collapse: 'M11 6l-6 6 6 6M19 6l-6 6 6 6',
  expand: 'M13 6l6 6-6 6M5 6l6 6-6 6',
} as const

export type NavIconName = keyof typeof PATHS

export function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
