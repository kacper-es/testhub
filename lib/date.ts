// „Dzisiaj" ustalane w strefie Europe/Warsaw (jedyne miejsce wymagające strefy —
// sekcja 4.6). Zwraca datę w formacie YYYY-MM-DD. Liczone po stronie serwera.
export function todayInWarsaw(now: Date = new Date()): string {
  // en-CA daje format YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
