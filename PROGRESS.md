# Postęp — Release Hub MVP

Aktualizowany po każdym kroku. Claude czyta ten plik na start sesji i uzupełnia na koniec.

Legenda: `[ ]` nierozpoczęte · `[~]` w toku · `[x]` zrobione

---

## Krok 1 — Setup projektu `[ ]`

- [ ] Next.js App Router + TypeScript + Tailwind
- [ ] Prisma + połączenie z Postgresem
- [ ] docker-compose: app + postgres, healthcheck, named volume, non-root
- [ ] `.env.example`, `npm run check`

### Decyzje
### Odłożone
### Jak sprawdzić
- `docker compose up` → strona startowa odpowiada, log pokazuje udane połączenie z bazą
- `docker compose down && docker compose up` → dane Postgresa przetrwały

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
