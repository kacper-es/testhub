# Release Hub — reguły projektu

Wewnętrzna aplikacja dla 4 testerów QA i 3 PM-ów. Next.js App Router + TypeScript + Prisma + Postgres, jeden kontener Docker na firmowym VM.

Pełna specyfikacja: `PROMPT-release-hub-mvp.md`. Bieżący stan: `PROGRESS.md`.

## Komendy

```
docker compose up                      # uruchomienie całości
npm run check                          # tsc --noEmit && next lint — musi przejść przed commitem
npm run seed                           # idempotentny seed
npx prisma migrate dev --name <opis>   # migracja (NIGDY db push)
npx vitest run                         # testy
```

## Niezmienniki

Nie łam ich bez zapytania mnie:

- **Autoryzacja wyłącznie przez `requireRole()` po stronie serwera**, w każdej server action i route handlerze. Ukrycie przycisku nie jest autoryzacją.
- **Zero hard delete.** Dezaktywacja przez `isActive`, odpinanie instancji przez `excludedAt`. Wyjątek: `Session`.
- **Zero surowych kolorów Tailwinda** (`gray-*`, `green-*`, `red-*`) w komponentach — tylko tokeny CSS variables.
- **Nigdy `prisma db push`** — tylko migracje.
- Efektywne wartości zadania czytaj tylko przez `resolveTask()`, nigdy `template.name` w komponencie.
- Zapis do `ChangeLog` w tej samej transakcji co mutacja, przez `logChange(tx, …)`.
- „Ile dni zostało" i deadline'y liczone po stronie serwera. Zero `new Date()` w kliencie do porównywania z `releaseDate`.
- Nie dodawaj zależności bez zapytania. Nie zmieniaj `schema.prisma` bez pokazania diffa.

## Konwencje

- Mutacje: Server Actions, nie route handlery. Walidacja `zod` w każdej akcji.
- Komunikaty UI po polsku. Kod, identyfikatory, komentarze i commity po angielsku.
- Każdy checkbox w `InstanceTestRun` to osobna akcja na jedno pole.
- Pole `notes` to komponent kliencki z ochroną przed nadpisaniem przez polling (focus/dirty → ignoruj dane z serwera).
- Animacje respektują `prefers-reduced-motion: reduce`.
- Kontrast: min. 4,5:1 dla tekstu, 3:1 dla elementów UI, w obu motywach.

## Poza zakresem MVP

Jira API, baza wiedzy, powiadomienia email/Slack, reset hasła mailem, eksport PDF/Excel, kopie zapasowe w aplikacji. **Nie buduj rusztowania pod te funkcje** — żadnych pustych folderów, interfejsów ani komentarzy „TODO: Jira".

SSE + `LISTEN/NOTIFY` to krok 11, po MVP. W MVP polling co 5 s.

## Tryb pracy

1. Przeczytaj `PROGRESS.md`, ustal następny krok.
2. Przedstaw plan tego jednego kroku, zatrzymaj się na potwierdzenie.
3. Zbuduj. Jeden krok = jedna sesja, nie łącz kroków.
4. Zaktualizuj `PROGRESS.md` (`Decyzje`, `Odłożone`, `Jak sprawdzić`) i zatrzymaj się.

Definition of done: `npm run check` przechodzi, `docker compose up` startuje bez błędów, podane kroki manualnej weryfikacji.

Jeśli napotkasz decyzję nieopisaną w `PROMPT-release-hub-mvp.md` — zapytaj, nie wybieraj domyślnej.
