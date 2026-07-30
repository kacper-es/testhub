# Postęp — Release Hub MVP

Aktualizowany po każdym kroku. Claude czyta ten plik na start sesji i uzupełnia na koniec.

Legenda: `[ ]` nierozpoczęte · `[~]` w toku · `[x]` zrobione

---

## Krok 1 — Setup projektu `[x]`

- [x] Next.js App Router + TypeScript + Tailwind
- [x] Prisma + połączenie z Postgresem
- [x] docker-compose: app + postgres, healthcheck, named volume, non-root
- [x] `.env.example`, `npm run check`

### Decyzje
- Wersje: Next 15.5, React 19.2, Prisma 6.19, Tailwind 3.4, ESLint 9.39, TypeScript 5.9.
- Bootstrap Prismy bez modeli: `prisma/schema.prisma` zawiera tylko `datasource` + `generator`.
  Modele i pierwsza migracja dochodzą w kroku 2 (pokażę diff).
- Połączenie z bazą dowodzone stroną `/health` (`prisma.$queryRaw\`SELECT 1\``) z
  `export const dynamic = 'force-dynamic'` — bez tego `next build` próbowałby prerenderować
  stronę w warstwie builder (brak bazy) i build by padł.
- Tailwind v3 (klasyczny `tailwind.config` mapujący tokeny — zgodnie z sekcją 9.1). Tokeny/motywy: krok 4.5.
- ESLint 9 → flat config (`eslint.config.mjs` + `FlatCompat` z `next/core-web-vitals`).
- Entrypoint: warunek na istnienie i niepustość `prisma/migrations` przed `migrate deploy`
  (zamiast `|| true`). Zweryfikowane: w kroku 1 loguje „No migrations yet — skipping migrate deploy",
  od kroku 2 realny błąd migracji zatrzyma start kontenera. `migrate deploy` wołany przez
  `node ./node_modules/prisma/build/index.js` (bez zależności od npx/network w runtime).
- `postinstall: prisma generate` w `package.json` — klient generuje się po `npm ci`; Dockerfile
  deps stage kopiuje `prisma/` przed `npm ci`.
- `docker-compose.yml`: `DATABASE_URL` jawnie w `environment:` app z hostem `db`, nadpisuje
  `localhost` z `.env` (ten służy tylko lokalnym `prisma migrate dev` / `npm run check`).
- `.gitignore`: dodane `next-env.d.ts` i `*.tsbuildinfo` (generowane, nie do repo).

### Odłożone
- `next lint` jest deprecated (zniknie w Next 16). Zostaje, bo CLAUDE.md definiuje `check` przez
  `next lint`. Migracja do ESLint CLI (`next-lint-to-eslint-cli`) — do rozważenia po MVP.
- `npm audit` zgłasza podatności w transitive deps — nie ruszam bez zapytania (zmiana zależności).
- Pełne tokeny/motywy/fonty lokalne/komponenty/`/design` → krok 4.5. `zod`, `bcrypt`, `vitest`,
  skrypt `seed` w `package.json` → odpowiednie kroki.

### Jak sprawdzić
- `docker compose up` → strona startowa odpowiada, log pokazuje udane połączenie z bazą
- `docker compose down && docker compose up` → dane Postgresa przetrwały

**Zweryfikowane w tej sesji:**
- `npm run check` przechodzi (tsc czysto, `next lint` bez błędów), `npm run build` — standalone,
  `/health` jako `ƒ (Dynamic)`.
- `docker compose up --build` → `db` healthy, `app` up; `curl /` → 200 `<h1>Release Hub</h1>`;
  `curl /health` → 200, „Baza: OK".
- `docker compose down && up` → log Postgresa „Skipping initialization" (volume `testhub_pgdata`
  przetrwał), `/health` → 200.

---

## Krok 2 — Schema Prisma `[ ]`

- [ ] Wszystkie enumy i modele wg sekcji 3 promptu
- [ ] Unique constraints: `Version.name`, `[versionId, instanceId]`, `[versionId, taskTemplateId]`
- [ ] `onDelete: Restrict` na wszystkich relacjach do `User`
- [ ] Pierwsza migracja

### Decyzje
### Odłożone
### Jak sprawdzić
- `npx prisma studio` → wszystkie tabele obecne, próba wstawienia duplikatu nazwy wersji odrzucona

---

## Krok 3a — Sesje i logowanie `[ ]`

- [ ] Model `Session`, cookie httpOnly/sameSite/secure, 8 h rolling
- [ ] bcrypt cost 12, logowanie, wylogowanie
- [ ] Rate limit 5 prób / 15 min per email
- [ ] `/change-password` przy `mustChangePassword`

### Decyzje
### Odłożone
### Jak sprawdzić

---

## Krok 3b — Autoryzacja `[ ]`

- [ ] `requireRole()` + middleware chroniący ścieżki
- [ ] Unieważnianie sesji przy zmianie hasła i `isActive = false`
- [ ] Test: PM dostaje odmowę z server action

### Decyzje
### Odłożone
### Jak sprawdzić
- Zaloguj się jako PM, wywołaj mutującą akcję z DevToolsów → odmowa, brak zmiany w bazie

---

## Krok 4 — Seed `[ ]`

- [ ] 1 ADMIN, 2 TESTER, 1 PM (`mustChangePassword: false`, hasła w README)
- [ ] 6 `TaskTemplate` — po dwa każdego typu
- [ ] 5 `Instance`, w tym jedna bez `clientName`
- [ ] Idempotentny (`upsert`), `npm run seed`

### Decyzje
### Odłożone
### Jak sprawdzić
- Dwukrotne uruchomienie seeda nie tworzy duplikatów

---

## Krok 4,5 — Fundament wizualny `[ ]`

- [ ] Tokeny CSS variables, oba motywy, warianty tekstowe kolorów statusów
- [ ] `tailwind.config` mapujący tokeny
- [ ] Przełącznik motywu: `User.theme` + cookie czytane w server layoucie (bez FOUC)
- [ ] Komponenty: `Button`, `Card`, `StatusBadge`, `Checkbox`, `StepDots`, `DataTable`
- [ ] Fonty lokalne (`next/font/local`), pliki `.woff2` w repo
- [ ] Strona `/design` z galerią

### Decyzje
### Odłożone
### Jak sprawdzić
- `/design` w obu motywach, przełączenie bez mrugnięcia, po odświeżeniu motyw zachowany
- Kontrasty sprawdzone narzędziem, wszystkie ≥ 4,5:1 dla tekstu

---

## Krok 5 — CRUD wersji `[ ]`

- [ ] Tworzenie w jednej transakcji: `Version` + `VersionTask` (aktywne szablony) + `InstanceTestRun` (aktywne instancje)
- [ ] Helper `resolveTask()`
- [ ] Helper `logChange(tx, …)`
- [ ] Zmiana statusu: zamrażanie snapshotów, `statusChanged*`, `cancelReason` przy `CANCELLED`
- [ ] Ponowne otwarcie (tylko ADMIN) czyszczące snapshoty

### Decyzje
### Odłożone
### Jak sprawdzić
- Utwórz „9.9.9" → oczekuj 6 zadań i 5 runów
- Ustaw `RELEASED` → zmień nazwę szablonu w bazie → archiwum pokazuje starą nazwę, otwarta wersja nową

---

## Krok 6a — Checklista `[ ]`

- [ ] Trzy typy zadań z właściwą logiką statusu
- [ ] `INSTANCE_AGGREGATE` nieklikalny, wyliczany
- [ ] `TICKET_AGGREGATE`: walidacja, `total = 0` → `—`
- [ ] Deadline'y i progi pilności, `FLEXIBLE` → „elastyczny"
- [ ] `completedBy` / `completedAt`, czyszczone przy odznaczeniu
- [ ] `deadline.test.ts`, `aggregates.test.ts`

### Decyzje
### Odłożone
### Jak sprawdzić

---

## Krok 6b — Tabela instancji `[ ]`

- [ ] 4 checkboxy, każdy osobna akcja na jedno pole
- [ ] `notes` z debounce 800 ms i ochroną focus/dirty
- [ ] Polling 5 s (`useLivePolling`), pauza przy `document.hidden`
- [ ] Pod/odpinanie instancji przez `excludedAt`
- [ ] Tooltipy z `ChangeLog`, jedno zapytanie `DISTINCT ON`

### Decyzje
### Odłożone
### Jak sprawdzić
- Dwie przeglądarki obok siebie: zmiana widoczna u drugiej w ≤ 5 s
- Pisz w `notes` przez 15 s — tekst nie znika przy odświeżeniach
- Odepnij instancję z danymi, podepnij ponownie → notatki i flagi wróciły

---

## Krok 6c — Komentarze `[ ]`

- [ ] Sekcja komentarzy (TESTER/ADMIN)
- [ ] Wymuszenie read-only na wersji zamkniętej we wszystkich akcjach
- [ ] `authz.test.ts`

### Decyzje
### Odłożone
### Jak sprawdzić

---

## Krok 7 — Dashboard i archiwum `[ ]`

- [ ] Karty wersji `IN_PROGRESS`, sortowane po `releaseDate`
- [ ] `StepDots`, progi kolorów, licznik instancji (bez odpiętych)
- [ ] Archiwum: `RELEASED` + `CANCELLED` z filtrem, `cancelReason`
- [ ] Puste stany

### Decyzje
### Odłożone
### Jak sprawdzić

---

## Krok 8 — Katalog instancji `[ ]`

- [ ] CRUD `Instance` bez delete (`isActive`)
- [ ] `scripts/import-instances.ts` z CSV + podsumowanie

### Decyzje
### Odłożone
### Jak sprawdzić

---

## Krok 9 — Panel admina `[ ]`

- [ ] `TaskTemplate`: dodawanie, edycja, dezaktywacja, `sortOrder`, blokada zmiany `taskType`
- [ ] Konta: tworzenie z hasłem tymczasowym, reset, `isActive`, rola
- [ ] `/admin/changelog` z filtrami i paginacją

### Decyzje
### Odłożone
### Jak sprawdzić

---

## Krok 10 — Dopracowanie `[ ]`

- [ ] Przejście po wszystkich ekranach w obu motywach
- [ ] Mobile: tabela instancji → karty
- [ ] Focus ring, nawigacja klawiaturą
- [ ] `prefers-reduced-motion`
- [ ] Wszystkie puste stany i przypadki brzegowe

### Decyzje
### Odłożone
### Jak sprawdzić

---

## Krok 11 — SSE (opcjonalny, po MVP) `[ ]`

- [ ] `NOTIFY` z server actions, klient `pg` z `LISTEN`
- [ ] Route handler `text/event-stream`, `X-Accel-Buffering: no`
- [ ] `EventSource` w kliencie zamiast interwału

### Decyzje
### Odłożone
### Jak sprawdzić
