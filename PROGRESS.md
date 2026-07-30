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

## Krok 2 — Schema Prisma `[x]`

- [x] Wszystkie enumy i modele wg sekcji 3 promptu
- [x] Unique constraints: `Version.name`, `[versionId, instanceId]`, `[versionId, taskTemplateId]`
- [x] `onDelete: Restrict` na wszystkich relacjach do `User`
- [x] Pierwsza migracja (`20260730152112_init`)

### Decyzje
- **Nazwane relacje** wszędzie, gdzie User wskazuje wielokrotnie na ten sam model
  (`CreatedVersions`/`StatusChangedVersions`) oraz dla inverse-relations z komentarza sekcji 3
  (`CompletedTasks`, `UpdatedTestRuns`, `Comments`, `ChangeLogs`) — bez nich schema się nie waliduje.
- **`onDelete` jawnie na każdej relacji.** Zweryfikowane w żywej bazie: 8× RESTRICT (wszystkie
  relacje do `User` poza sesją + `VersionTask.taskTemplate` + `InstanceTestRun.instance`),
  4× CASCADE (`Session.user` — wyjątek z sekcji 3, oraz 3 relacje do `Version`).
- **`InstanceTestRun.instance` = RESTRICT** — decyzja nieopisana w sekcji 3, zatwierdzona przez
  użytkownika (Instance nigdy nie jest kasowana; odpinanie przez `excludedAt`).
- **`ChangeLog.versionId` jako skalar bez relacji** (denormalizacja pod filtrowanie).
- **Enumy rozpisane po jednej wartości na linię** — kompaktowy zapis z promptu (`{ A B C }`)
  jest niepoprawny w Prisma i nie przechodzi walidacji.
- **`prisma` przeniesione do `dependencies`** (z dev): CLI jest realnie potrzebne w runtime do
  `migrate deploy` w entrypoincie. Dockerfile: nowy stage `proddeps` (`npm ci --omit=dev`) daje
  domknięty graf zależności CLI (m.in. `effect`, którego brakowało przy cherry-picku `node_modules/prisma`).

### Odłożone
- Snapshoty (`*Snapshot`) i logika zamrażania wersji — to krok 5, tu tylko pola w schemacie.
- Seed danych → krok 4.

### Jak sprawdzić
- `npx prisma studio` → wszystkie tabele obecne, próba wstawienia duplikatu nazwy wersji odrzucona

**Zweryfikowane w tej sesji:**
- `npx prisma migrate dev --name init` — migracja utworzona i zastosowana; `npm run check` przechodzi.
- `docker compose down -v && up --build` (czysty volume) → entrypoint: „Applying migration
  `20260730152112_init` … All migrations have been successfully applied", serwer Ready, `/health` → 200.
- Baza: 9 tabel modeli + `_prisma_migrations`. Unikalne indeksy obecne: `Version_name_key`,
  `User_email_key`, `InstanceTestRun_versionId_instanceId_key`, `VersionTask_versionId_taskTemplateId_key`.

---

## Krok 3a — Sesje i logowanie `[x]`

- [x] Model `Session`, cookie httpOnly/sameSite/secure, 8 h rolling
- [x] bcrypt cost 12, logowanie, wylogowanie
- [x] Rate limit 5 prób / 15 min per email
- [x] `/change-password` przy `mustChangePassword`

### Decyzje
- **Nowe zależności (zatwierdzone):** `zod` (walidacja server actions — wymóg sekcji 2),
  `bcryptjs` (czysto-JS bcrypt, bez natywnej kompilacji na alpine), `@types/bcryptjs` (dev).
- **Middleware = lekka brama na Edge** (tylko obecność cookie): brak cookie + trasa niepubliczna
  → redirect `/login`; slide ważności cookie 8 h. **Pełna walidacja sesji** (podpis HMAC,
  wygaśnięcie, `isActive`) i **redirect przy `mustChangePassword`** są server-side
  (`getSessionUser()` + layout grupy `(app)`), bo Prisma nie działa w runtime Edge.
  „Już zalogowany na /login" rozstrzyga strona `/login` server-side (unika pętli przy nieważnym cookie).
- **Rolling refresh dwupoziomowy:** cookie w przeglądarce przesuwa middleware (co request);
  `Session.expiresAt` w bazie odświeża `getSessionUser()` z throttlingiem ~1 h (nie zapisuje
  cookie — RSC nie może; zapis cookie tylko w Server Action/Route Handler/middleware).
- **Cookie sesji podpisane HMAC-SHA256** przez `SESSION_SECRET` (wartość = `sessionId.hmac`);
  `SESSION_COOKIE` wydzielone do lekkiego `lib/auth/cookie.ts`, żeby middleware nie ciągnął Prismy.
- **Neutralny komunikat** logowania („Nieprawidłowy email lub hasło") jednakowy dla:
  brak konta / złe hasło / `isActive=false`. Rate limit liczy nieudane próby, sukces resetuje.
- **Grupa tras `(app)`** ze strażnikiem w layoucie; `/` przeniesione do `app/(app)/page.tsx`.
  `/login`, `/health` publiczne (`/health` musi być poza auth dla probe'ów). `getSessionUser`
  owinięte `react.cache` (dedup w obrębie renderu).

### Odłożone
- `requireRole()` i pełna ochrona per rola, test „PM → 403", unieważnianie sesji przy
  `isActive=false` → **krok 3b** (helper `destroyAllUserSessions` już jest, użyty przez zmianę hasła).
- Równoważenie czasu odpowiedzi przy nieistniejącym userze (dummy bcrypt) — pominięte
  (7 użytkowników, sieć wewnętrzna); do rozważenia, nie krytyczne.
- Realni użytkownicy → seed w kroku 4 (tu testowano jednorazowym userem, usuniętym po weryfikacji).

### Jak sprawdzić
- Zaloguj się userem z `mustChangePassword` → redirect na `/change-password`, reszta zablokowana
- Zmień hasło → wylogowanie ze wszystkich sesji, `/login?changed=1`, logowanie nowym hasłem
- Złe hasło → neutralny błąd; 6. próba w 15 min → „Zbyt wiele prób logowania"
- Wyloguj → cookie i rekord `Session` skasowane, powrót na `/login`

**Zweryfikowane w tej sesji (przeglądarka, lokalny `next start` + baza w kontenerze):**
- Pełny flow: login (mustChange) → `/change-password` → zmiana hasła → `/login?changed=1`
  → login nowym hasłem → `/` „Zalogowano jako Test Admin (ADMIN)" → logout → `/login`. ✓
- Neutralny błąd przy złym haśle; 6. próba zablokowana rate-limitem. ✓
- Middleware: `GET /` bez cookie → 307 `/login`; `/login`, `/health` → 200 (lokalnie i w kontenerze).
- `npm run check` i `npm run build` przechodzą; `docker compose up --build` startuje
  (entrypoint „No pending migrations to apply", Ready), trasy w kontenerze OK.

---

## Krok 3b — Autoryzacja `[x]`

- [x] `requireRole()` + ochrona ścieżek (server-side, nie Edge — patrz decyzje)
- [x] Unieważnianie sesji przy zmianie hasła (3a) i mechanizm dla `isActive=false`
- [x] Test PM dostaje odmowę — unit `assertRole` (żywy test na realnej akcji → krok 5)

### Decyzje
- **`lib/auth/roles.ts` (czysta logika):** `AuthorizationError`, `assertRole(user, roles)` —
  rzuca gdy brak usera / `!isActive` / rola spoza listy. Bez importów `next/headers`/Prisma,
  więc testowalna jednostkowo bez mocków.
- **`lib/auth/authz.ts` (server):** `requireRole(roles)` (dla server actions/route handlerów —
  rzuca → mutacja odrzucona), `requireUser()` (strony — redirect `/login`),
  `requireRolePage(roles)` (strony per rola — redirect `/` przy złej roli, pod przyszłe `/admin`).
- **Ochrona per rola jest server-side, nie w middleware.** Świadome odstępstwo od dosłownego
  „middleware chroniący ścieżki per rola": Prisma nie działa na Edge, więc rola sprawdzana
  w `requireRole`/`requireRolePage`. Middleware zostaje bramą „zalogowany/nie" (z 3a).
- **`isActive=false`:** `getSessionUser()` już odrzuca nieaktywnych (test to potwierdza).
  Fizyczne kasowanie ich sesji zrobi akcja dezaktywacji w panelu admina (krok 9) przez istniejący
  `destroyAllUserSessions` — nie dokładam osieroconego helpera bez wywołania.
- **Vitest przypięty do `^3` (3.2.7)**, nie 4.x: lokalny Node to v21.2.0 (non-LTS), a Vitest 4
  (rolldown) wymaga `node:util.styleText` niedostępnego w tym runtime. Docker i tak używa node:22.
  `authz.test.ts` w `tests/`, alias `@` w `vitest.config.ts`. Skrypt `npm test` = `vitest run`.

### Odłożone
- **Żywy dowód „PM → 403 z DevTools na realnej akcji"** → krok 5 (pierwsza mutująca akcja
  domenowa + zaseedowany PM). Mechanizm (`requireRole`) i logika (`assertRole`) gotowe i przetestowane.
- Druga część `authz.test.ts` — „mutacja na zamkniętej wersji odrzucona" → krok 6c (gdy istnieją wersje).
- Akcja dezaktywacji konta (`isActive=false` + kasowanie sesji) → krok 9.

### Jak sprawdzić
- `npx vitest run` → `authz.test.ts` zielony (PM odrzucony, TESTER/ADMIN dopuszczeni, brak usera
  i nieaktywny odrzuceni)
- (od kroku 5) Zaloguj się jako PM, wywołaj mutującą akcję z DevToolsów → odmowa, brak zmiany w bazie

**Zweryfikowane w tej sesji:**
- `npx vitest run` → 4/4 zielone; `npm run check` przechodzi.
- `docker compose up --build` startuje (Ready); `/` bez cookie → 307 `/login`, `/login` → 200.

---

## Krok 4 — Seed `[x]`

- [x] 1 ADMIN, 2 TESTER, 1 PM (`mustChangePassword: false`, hasła w README)
- [x] 6 `TaskTemplate` — po dwa każdego typu
- [x] 5 `Instance`, w tym jedna bez `clientName`
- [x] Idempotentny (`upsert`), `npm run seed`

### Decyzje
- **Runner: `tsx`** (nowa dev-zależność, zatwierdzona). Skrypt
  `seed` = `node --env-file=.env --import tsx prisma/seed.ts` (ładuje `DATABASE_URL` z `.env`).
- **Idempotencja przez `update: {}`** (create-if-absent): ponowny seed nie nadpisuje istniejących
  danych, nie re-hashuje haseł, nie klobruje ewentualnych zmian. Użytkownicy upsertowani po `email`
  (`@unique`); `TaskTemplate`/`Instance` **nie mają unikatu** (sekcja 3), więc nadałem im
  deterministyczne `id` (`seed-tpl-*`, `seed-inst-*`) i upsertuję po `id`. Schemy nie zmieniałem.
- Hasło dev `Dev12345!` (jedno, wspólne), hashowane przez `hashPassword` (bcrypt cost 12).
  Konta w README, z notką, że to wartości deweloperskie.
- Seed **poza** entrypointem Dockera (sekcja 10) — komenda lokalna przeciw bazie w kontenerze.

### Odłożone
- `Instance.name`/`TaskTemplate.name` bez `@unique` — pod import CSV „po name" (krok 8) może być
  potrzebny unikat albo inna strategia upsertu; decyzja w kroku 8, nie ruszam schematu teraz.
- Seedowanie bazy produkcyjnej (na VM) — poza zakresem; ten sam skrypt przeciw prod `DATABASE_URL`.

### Jak sprawdzić
- Dwukrotne uruchomienie seeda nie tworzy duplikatów

**Zweryfikowane w tej sesji:**
- `npm run seed` ×2 → identyczne liczby (users=4, taskTemplates=6, instances=5) — idempotentne.
- Rozkład: role 2×TESTER / 1×PM / 1×ADMIN; typy szablonów 2× każdy; 1 instancja bez `clientName`.
- `bcrypt.compare('Dev12345!', hash)` = true; logowanie `admin@releasehub.local` tworzy ważną sesję
  (POST /login → 303, `mustChangePassword=false` → `/`). `npm run check` przechodzi.
- Uwaga narzędziowa: pane przeglądarki nie kompozytuje klatek w tej sesji (screenshot/redirect-follow
  padają `ERR_ABORTED`) — dowód logowania oparty na sesji w bazie + kodzie odpowiedzi, nie na UI.

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
