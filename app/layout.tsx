import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import { jetbrainsMono, plexSans } from './fonts'
import { THEME_COOKIE, themeClass } from '@/lib/theme'

export const metadata: Metadata = {
  title: 'Release Hub',
  description: 'Wewnętrzny hub przygotowania wydań',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const theme = (await cookies()).get(THEME_COOKIE)?.value
  const cls = themeClass(theme)

  return (
    <html
      lang="pl"
      className={`${plexSans.variable} ${jetbrainsMono.variable} ${cls}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  )
}
