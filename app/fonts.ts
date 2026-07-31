import localFont from 'next/font/local'

// Fonty zvendorowane do /public/fonts (sekcja 9.2) — zakładamy build bez internetu.
export const plexSans = localFont({
  variable: '--font-sans',
  display: 'swap',
  src: [
    {
      path: '../public/fonts/ibm-plex-sans-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/ibm-plex-sans-latin-600-normal.woff2',
      weight: '600',
      style: 'normal',
    },
  ],
})

export const jetbrainsMono = localFont({
  variable: '--font-mono',
  display: 'swap',
  src: [
    {
      path: '../public/fonts/jetbrains-mono-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/jetbrains-mono-latin-700-normal.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
})
