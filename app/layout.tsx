import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Release Hub',
  description: 'Wewnętrzny hub przygotowania wydań',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  )
}
