import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import { fontVariables } from './fonts'
import { THEME_COOKIE, themeClass } from '@/lib/theme'
import { PALETTE_COOKIE, paletteAttr } from '@/lib/palette'

export const metadata: Metadata = {
  title: 'Release Hub',
  description: 'Wewnętrzny hub przygotowania wydań',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const jar = await cookies()
  const theme = jar.get(THEME_COOKIE)?.value
  const palette = paletteAttr(jar.get(PALETTE_COOKIE)?.value)
  const cls = themeClass(theme)

  return (
    <html
      lang="pl"
      className={`${fontVariables} ${cls}`}
      data-palette={palette}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  )
}
