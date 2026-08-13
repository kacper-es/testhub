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

## Krok 4,5 — Fundament wizualny `[x]`

- [x] Tokeny CSS variables, oba motywy, warianty tekstowe kolorów statusów
- [x] `tailwind.config` mapujący tokeny
- [x] Przełącznik motywu: `User.theme` + cookie czytane w server layoucie (bez FOUC)
- [x] Komponenty: `Button`, `Card`, `StatusBadge`, `Checkbox`, `StepDots`, `DataTable`
- [x] Fonty lokalne (`next/font/local`), pliki `.woff2` w repo
- [x] Strona `/design` z galerią

### Decyzje
- **Tokeny w `app/globals.css`:** jasny w `:root, .light`; ciemny w `.dark`; `SYSTEM` przez
  `@media (prefers-color-scheme: dark)` na `:root:not(.light):not(.dark)`. Selektory klasowe
  (nie tylko `:root`) → można scope'ować motyw na wycinku (panele „oba motywy" na `/design`).
- **Nazwy tokenów w Tailwindzie płaskie** (`fg`, `muted`, `pass/warn/fail` = wypełnienia,
  `pass-strong/warn-strong/fail-strong` = dostępne warianty tekstowe). Paleta **zawężona do tokenów**
  (bez domyślnych `gray-*/green-*/red-*`) — twarde egzekwowanie niezmiennika.
- **Kontrast:** zweryfikowany skryptem WCAG w obu motywach. Wszystkie pary tekstu ≥ 4,5:1, UI ≥ 3:1.
  Jedyny wyjątek — warn (#D9A404) jako samo wypełnienie na jasnym tle (2,27) — mitygowany
  **obramowaniem elementów statusowych** (StepDots/StatusBadge) w wariancie `*-strong` (≥ 4,5:1),
  bez zmiany sygnaturowych kolorów wypełnień z sekcji 9.1.
- **Fonty:** zvendorowane `.woff2` w `public/fonts` (IBM Plex Sans 400/600, JetBrains Mono 400/700,
  subset latin), pozyskane przez `@fontsource` (dev, potem odinstalowane), `next/font/local`.
- **Motyw:** `User.theme` źródłem prawdy, mirror w cookie `theme` czytanym w server root-layoucie
  (klasa na `<html>`, bez FOUC). Akcja `setTheme` (`requireUser`), klient przełącza optymistycznie
  klasę i `router.refresh()`. Cookie ustawiane też przy logowaniu (z `User.theme`).
- Strona główna `/` odświeżona na tokeny/komponenty; `/design` pod auth (grupa `(app)`).
- **Przycisk primary neutralny** (odwrócenie `fg`/`bg`), nie zielony — żeby nie mylić z semantyką
  statusu pass i nie łamać kontrastu (biały na zieleni < 4,5:1).

### Odłożone
- `DataTable` to prosty, generyczny komponent bazowy — bogatsze warianty (sortowanie, sticky header)
  dojdą, jeśli będą potrzebne w krokach 6b/7.
- Realne dane w komponentach (wersje/instancje) → kroki 5–7; tu tylko galeria z próbkami.

### Jak sprawdzić
- `/design` w obu motywach, przełączenie bez mrugnięcia, po odświeżeniu motyw zachowany
- Kontrasty sprawdzone narzędziem, wszystkie ≥ 4,5:1 dla tekstu

**Zweryfikowane w tej sesji:**
- `npm run check` i `npm run build` przechodzą (trasa `/design` obecna, fonty `next/font/local` OK).
- `docker compose up --build` startuje; `/design` chronione (307 → `/login` bez cookie), po
  zalogowaniu adminem renderuje pełną galerię w obu panelach (jasny/ciemny), z przełącznikiem motywu.
- Skrypt kontrastu: wszystkie pary tekstu ≥ 4,5:1 i UI ≥ 3:1 (poza mitygowanym warn-fill na jasnym).
- **Podgląd wizualny** opublikowany jako Artifact (oba motywy, zaszyte fonty) — patrz link w sesji.
  (Pane przeglądarki nie kompozytuje klatek → weryfikacja renderu przez odczyt DOM + Artifact.)

---

## Krok 5 — CRUD wersji `[x]`

- [x] Tworzenie w jednej transakcji: `Version` + `VersionTask` (aktywne szablony) + `InstanceTestRun` (aktywne instancje)
- [x] Helper `resolveTask()`
- [x] Helper `logChange(tx, …)`
- [x] Zmiana statusu: zamrażanie snapshotów, `statusChanged*`, `cancelReason` przy `CANCELLED`
- [x] Ponowne otwarcie (tylko ADMIN) czyszczące snapshoty

### Decyzje
- **Helpery:** `lib/versions/resolve-task.ts` (jedyne źródło efektywnych wartości zadania),
  `lib/versions/log-change.ts` (zapis do `ChangeLog` w transakcji; pierwszy wywołujący w 6a),
  `lib/versions/guard.ts` (`assertVersionEditable` / `VersionClosedError` — read-only na zamkniętej),
  `lib/date.ts` (`todayInWarsaw` — „dzisiaj" po stronie serwera, Europe/Warsaw).
- **Akcje** `app/actions/versions.ts`: `createVersion`, `releaseVersion`, `cancelVersion`,
  `reopenVersion` — wszystkie przez `requireRole` (create/release/cancel: TESTER/ADMIN; **reopen: ADMIN**).
  Unikat nazwy → przyjazny komunikat (catch P2002), nie surowy błąd Prismy. `releaseDate` date-only.
  Zmiany statusu wersji **nie** idą do `ChangeLog` (reguła 30).
- **UI interim:** `/versions/new` (formularz + ostrzeżenie o dacie w przeszłości bez blokady) i
  `/versions` (lista + akcje statusu). Pełny widok wersji → krok 6, dashboard/archiwum → krok 7.
  Ostrzeżenie o dacie porównuje **stringi** (`date < today`), `today` liczone server-side (bez `new Date()` w kliencie).
- **`authz.test.ts` rozszerzony** o reprezentatywną akcję: PM (i niezalogowany) dostaje odmowę
  z `createVersion` — dopięcie żywego dowodu odłożonego z 3b. Nadal 3 pliki testów; część
  „mutacja na zamkniętej wersji" dojdzie w 6c.
- `resolveTask`/snapshoty weryfikowane przez bazę (bez 4. pliku testów — prompt: „trzy pliki").

### Odłożone
- Pełny widok `/versions/[id]` (checklista, instancje, komentarze) → kroki 6a–6c.
- Właściwy dashboard (karty IN_PROGRESS) i `/archive` → krok 7. `/versions` to lista utylitarna.
- Pierwszy realny wywołujący `logChange` → 6a (mutacje flag/statusów).

### Jak sprawdzić
- Utwórz „9.9.9" → oczekuj 6 zadań i 5 runów
- Ustaw `RELEASED` → zmień nazwę szablonu w bazie → archiwum pokazuje starą nazwę, otwarta wersja nową

**Zweryfikowane w tej sesji (przeglądarka + baza):**
- Utworzenie „9.9.9" → **6 `VersionTask` + 5 `InstanceTestRun`**.
- `RELEASED` → status + `statusChangedById` + **6/6 snapshotów** zapisanych.
- Zmiana nazwy szablonu w bazie → zamknięta wersja czyta **„Release notes dla klienta"** (snapshot),
  szablon ma **„ZMIENIONA NAZWA"** (live) → zamrożenie działa (`resolveTask`). Nazwę przywrócono.
- Reopen (ADMIN) → `IN_PROGRESS` + `statusChangedById` + **0 snapshotów** (wyczyszczone).
- Duplikat „9.9.9" → **„Wersja 9.9.9 już istnieje"** (nie surowy błąd Prismy).
- `npx vitest run` → 6/6 zielone (w tym PM→odmowa z `createVersion`); `npm run check`, `npm run build`,
  `docker compose up --build` OK.
- Uwaga narzędziowa: część klików pane'a chybiała przyciski (zła lokalizacja) — reopen/duplikat
  wyzwolone przez `form.requestSubmit()`; efekty potwierdzone w bazie/DOM. Logika akcji poprawna.

---

## Krok 6a — Checklista `[x]`

- [x] Trzy typy zadań z właściwą logiką statusu
- [x] `INSTANCE_AGGREGATE` nieklikalny, wyliczany
- [x] `TICKET_AGGREGATE`: walidacja, `total = 0` → `—`
- [x] Deadline'y i progi pilności, `FLEXIBLE` → „elastyczny"
- [x] `completedBy` / `completedAt`, czyszczone przy odznaczeniu
- [x] `deadline.test.ts`, `aggregates.test.ts`

### Decyzje
- **Helpery czyste (testowalne bez mocków):** `lib/versions/deadline.ts`
  (`taskDeadline`, `daysRemaining`, `urgency`, `resolveDeadline` z gałęzią `FLEXIBLE`) i
  `lib/versions/aggregates.ts` (`ticketAggregateStatus`, `instanceAggregateStatus`).
  Arytmetyka dat na UTC-północy ze stringów `YYYY-MM-DD` — wolna od strefy (reguła 22).
  Deadline i „ile dni" liczone po stronie serwera, `resolveDeadline` jest jedynym źródłem
  dla widoku (bez `new Date()` w kliencie — reguła 25).
- **Akcje** `app/actions/tasks.ts`: `setCheckboxTaskStatus` (CHECKBOX, log `status`),
  `setTicketCounters` (TICKET, walidacja `0 ≤ current ≤ total`, log `manualCounter*`, status
  **wyliczany** przez `ticketAggregateStatus`). Obie: `requireRole(['TESTER','ADMIN'])` +
  `assertVersionEditable` + `logChange` w tej samej transakcji (pierwszy realny wywołujący helpera).
- **`completedBy/At` jednolicie wg reguły 17** także dla TICKET (wejście/zejście z DONE) —
  wybrana opcja rekomendowana. `INSTANCE_AGGREGATE`: status nigdy nie zapisywany, `completedBy`
  nieaplikowalny — status wyliczany przy renderze z flag `InstanceTestRun` (reguła 16).
- **Kontrolki klienckie:** `CheckboxTaskControl` (cykl NOT_STARTED→IN_PROGRESS→DONE→…,
  `useOptimistic`, animacja „wskoczenia" na DONE z remountem przez `key`), `TicketCounterControl`
  (dwa pola + zapis, `—` przy `total=0`, walidacja kliencka + serwerowa). INSTANCE_AGGREGATE:
  `StepDots` + badge, nieklikalny (`cursor-default`).
- **Status w bazie dla TICKET zapisywany** (spójność + hak `completedBy`), ale czytany zawsze
  przez `ticketAggregateStatus` — pole `status` nie jest źródłem prawdy dla agregatów.

### Odłożone
- „Dodaj zadanie z szablonu" (furtka reguła 6) — mutacja spoza logiki 3 typów; do rozważenia
  przy panelu admina/szablonach (krok 9) lub osobno.
- Widok wersji rozwijany w 6b (instancje) i 6c (komentarze) — ten sam plik `/versions/[id]`.

### Jak sprawdzić
- Otwórz `/versions/[id]`: 3 typy zadań, deadline w kolorze progu, `FLEXIBLE` → „elastyczny"
- CHECKBOX: cykl statusu z audytem `completedBy` na DONE; TICKET: `—` przy `0/0`, walidacja `current≤total`
- `npx vitest run` → `deadline.test.ts` + `aggregates.test.ts` zielone

**Zweryfikowane w tej sesji (przeglądarka + baza, fixture „9.9.9"):**
- Strona renderuje się w całości (RSC + wszystkie kontrolki), guard `/versions/[id]` bez cookie → 307.
- CHECKBOX „Release notes": NOT_STARTED→IN_PROGRESS→**DONE** + `completedById=Admin` + `completedAt`;
  `ChangeLog`: 2 wpisy `status`.
- TICKET „Weryfikacja zgłoszeń": **3/5 → IN_PROGRESS** (wyliczony); `ChangeLog`:
  `manualCounterCurrent 0→3`, `manualCounterTotal 0→5`.
- INSTANCE_AGGREGATE „Gotowość środowisk": po ustawieniu 1 flagi przeliczony na **W trakcie 0/5**.
- `npx vitest run` → 33/33; `npm run check`, `npm run build` OK.

---

## Krok 6b — Tabela instancji `[x]`

- [x] 4 checkboxy, każdy osobna akcja na jedno pole
- [x] `notes` z debounce 800 ms i ochroną focus/dirty
- [x] Polling 5 s (`useLivePolling`), pauza przy `document.hidden`
- [x] Pod/odpinanie instancji przez `excludedAt`
- [x] Tooltipy z `ChangeLog`, jedno zapytanie `DISTINCT ON`

### Decyzje
- **`app/actions/test-runs.ts`:** 4 nazwane akcje flag (`setEnvironmentRestored`,
  `setDbScriptsInstalled`, `setBackendUpdated`, `setTestsCompleted`) delegujące do wspólnego
  `setFlag` — każda aktualizuje **jedną kolumnę** (reguła 21, brak wzajemnego nadpisywania).
  `setNotes` (walidacja + log), `unpinInstanceRun` (`excludedAt=now`), `attachInstance`
  (przywraca odpięty run `excludedAt=null` lub tworzy nowy — reguła 20). Wszystkie: `requireRole` +
  `assertVersionEditable` + `logChange` w transakcji; `updatedById` aktualizowane.
- **`excludedAt` NIE idzie do `ChangeLog`** (reguła 27 obejmuje tylko 4 flagi, `notes`, pola VersionTask).
- **Polling:** `lib/hooks/use-live-polling.ts` (jeden hook, `router.refresh()` co 5 s, pauza na
  `document.hidden`, natychmiastowy refresh na powrót do widoczności) montowany komponentem
  `LivePolling` tylko na wersji `IN_PROGRESS`. Reszta zostaje Server Components (reguła 7).
- **`NotesField`:** komponent kliencki z debounce 800 ms i wskaźnikiem „zapisywanie…/zapisano".
  Dopóki pole ma focus **albo** jest dirty — dane z serwera (polling) są ignorowane; po udanym
  zapisie znów przyjmuje serwer (reguła 7, ochrona przed zerowaniem `notes`).
- **`FlagCheckbox`:** `useOptimistic`, akcja przekazywana propem; reużyty `Checkbox` z nowymi
  `hideLabel`/`title` (tooltip). Tabela: desktop `<table>`, mobile karty (`md:hidden`) — bez
  poziomego scrolla (sekcja 9.4).
- **Tooltipy z `ChangeLog`:** jedno zapytanie `$queryRaw` `DISTINCT ON (entityId, field)` na całą
  stronę (reguła 4, bez N+1), mapowane kluczem `${runId}:${field}`, format „pole: user, dzień godz.".
- **Tabela pokazuje tylko aktywne runy** (`excludedAt=null`); odpięte wracają przez „Podepnij
  instancję" z adnotacją „(były dane)".

### Odłożone
- Bogatszy `DataTable` (sort/sticky) — niepotrzebny; własna responsywna tabela w komponencie.
- Dashboard skrótowy „3/5 instancji gotowych" → krok 7.

### Jak sprawdzić
- Dwie przeglądarki obok siebie: zmiana widoczna u drugiej w ≤ 5 s
- Pisz w `notes` przez 15 s — tekst nie znika przy odświeżeniach
- Odepnij instancję z danymi, podepnij ponownie → notatki i flagi wróciły

**Zweryfikowane w tej sesji (przeglądarka + baza):**
- Flaga `environmentRestored` Klienta A → `true`, `updatedById=Admin`; `ChangeLog`
  `environmentRestored false→true`. Agregat instancji przeliczony na „W trakcie".
- Tooltip flagi z `DISTINCT ON`: „środowisko odtworzone: Admin, pt., 10:21".
- **Odpięcie/podpięcie (reguła 18):** `unpinInstanceRun` → `excludedAt` ustawione, flaga
  zachowana; opcja „(były dane)" w selekcie; `attachInstance` → `excludedAt=null`, flaga wróciła,
  **liczba runów wciąż 5** (bez duplikatu). `npm run check`, `npm run build`, `docker compose up` OK.

---

## Krok 6c — Komentarze `[x]`

- [x] Sekcja komentarzy (TESTER/ADMIN)
- [x] Wymuszenie read-only na wersji zamkniętej we wszystkich akcjach
- [x] `authz.test.ts`

### Decyzje
- **`app/actions/comments.ts`:** `addComment(versionId, content)` — `requireRole(['TESTER','ADMIN'])`
  (PM to pełny read-only, nie dodaje nawet komentarzy — sekcja 5), walidacja `zod`,
  `assertVersionEditable`, create. Komentarze **nie** idą do `ChangeLog` (reguła 27).
  `CommentForm` kliencki (kontrolowana treść, czyszczenie po sukcesie, błąd inline); lista malejąco
  po `createdAt` (autor + czas w strefie Warsaw + treść `whitespace-pre-wrap`).
- **Read-only wymuszone we WSZYSTKICH akcjach mutujących** wersję (reguła 12): `assertVersionEditable`
  jest już w `tasks.ts` (6a), `test-runs.ts` (6b) i `comments.ts` (6c) — zamknięta wersja odrzuca
  każdą mutację po stronie serwera. Baner „Wersja zamknięta — tylko do odczytu" + wyłączone
  kontrolki (`disabled`) to warstwa kosmetyczna nad wymuszeniem.
- **`authz.test.ts` domknięty** o drugą część z sekcji 12: `addComment` na wersji `RELEASED`/`CANCELLED`
  rzuca `VersionClosedError` (mock `prisma.version.findUnique` zwraca zamknięty status).

### Odłożone
- Widok wersji jest kompletny (checklista + instancje + komentarze). Dalej: dashboard/archiwum (7).

### Jak sprawdzić
- Jako TESTER/ADMIN dodaj komentarz na otwartej wersji → pojawia się na liście
- Jako PM: brak formularza; próba `addComment` z DevToolsów → odmowa (rola)
- Na wersji zamkniętej: baner read-only, brak kontrolek; `addComment`/flagi/liczniki odrzucone serwerowo

**Zweryfikowane w tej sesji (przeglądarka + baza):**
- Komentarz dodany przez Admina, widoczny na liście.
- `npx vitest run` → **33/33** (w tym `authz.test.ts`: PM/niezalogowany odrzuceni z `createVersion`,
  `addComment` na RELEASED/CANCELLED → `VersionClosedError`).
- `npm run check`, `npm run build`, `docker compose up --build` — OK (entrypoint „No pending
  migrations", Ready; `/versions/[id]` bez cookie → 307).

---

## Krok 7 — Dashboard i archiwum `[x]`

- [x] Karty wersji `IN_PROGRESS`, sortowane po `releaseDate`
- [x] `StepDots`, progi kolorów, licznik instancji (bez odpiętych)
- [x] Archiwum: `RELEASED` + `CANCELLED` z filtrem, `cancelReason`
- [x] Puste stany

### Decyzje
- **`/` = dashboard** (przebudowa `app/(app)/page.tsx`): wersje `IN_PROGRESS`, `orderBy releaseDate asc`.
  `LivePolling` (reguła 7). Nagłówek: `ThemeToggle` + „Wyloguj" + nawigacja do
  `/versions` (zarządzanie), `/archive`, `/design`.
- **`VersionCard`** (`components/versions/VersionCard.tsx`), klikalna do `/versions/[id]`:
  - odliczanie na poziomie wersji „za N dni" w kolorze wg progów reguły 26
    (`urgency(daysRemaining(releaseDate, today))`, „po terminie" przy ujemnym) — serwerowo;
  - `StepDots` (sygnaturowy): zadania `DONE`/wszystkie, gdzie status każdego liczony jak w 6a
    (CHECKBOX = `status`, TICKET/INSTANCE = z agregatów — **agregaty nieklikalne liczą się do postępu**);
  - skrócona checklista: kropka statusu + nazwa + deadline zadania (`resolveDeadline`, „elastyczny");
  - „X/Y instancji gotowych" z `instanceAggregateStatus` (bez odpiętych — reguła 19).
- **`/archive`** (`app/(app)/archive/page.tsx`): `RELEASED`+`CANCELLED`, filtr przez `searchParams`
  (`?status=released|cancelled`, domyślnie wszystkie) jako linki-chipy — bez klienta.
  `orderBy statusChangedAt desc`, „Zamknięto: <kto>, <kiedy>" (`statusChangedBy`, strefa Warsaw),
  `cancelReason` przy `CANCELLED`. Klikalne do `/versions/[id]` (read-only z 6c).
- **Puste stany** (sekcja 9.5): brak wersji `IN_PROGRESS` → „Brak wersji w przygotowaniu — dodaj
  pierwszą"; wersja bez zadań / bez instancji → krótkie komunikaty; pusty filtr archiwum →
  „Brak wersji w tym filtrze".
- Bez nowej logiki domenowej (progi/agregaty już pokryte testami), bez zmian `schema.prisma`,
  bez nowych zależności.

### Odłożone
- Katalog instancji `/instances` → krok 8; panel admina `/admin` i `/admin/changelog` → krok 9.

### Jak sprawdzić
- `/` pokazuje karty wersji `IN_PROGRESS` z `StepDots`, kolorem odliczania i „X/Y instancji gotowych"
- Po `RELEASED`/`CANCELLED` wersja znika z dashboardu i pojawia w `/archive`
- `/archive` filtruje po statusie; przy anulowanej widać powód i kto zamknął

**Zweryfikowane w tej sesji (przeglądarka + baza):**
- Dashboard: karta „9.9.9" — `StepDots` **6/6** (2 CHECKBOX + 2 TICKET + 2 INSTANCE_AGGREGATE
  policzone z flag), odliczanie **„za 32 dni"** (zielone), deadline'y per zadanie (dni / „elastyczny"),
  **„5/5 instancji gotowych"**.
- Archiwum (na 2 wstrzykniętych i potem usuniętych wersjach): lista sortowana malejąco po zamknięciu,
  badge statusu, „Zamknięto: Admin, <data Warsaw>", powód przy anulowanej; filtry
  Wszystkie/Wydane/Anulowane zawężają poprawnie.
- `npm run check`, `npm run build` OK; `docker compose up --build` startuje (Ready). `npx vitest run` → 33/33.

---

## Krok 8 — Katalog instancji `[x]`

- [x] CRUD `Instance` bez delete (`isActive`)
- [x] `scripts/import-instances.ts` z CSV + podsumowanie

### Decyzje
- **`/instances`** (lista) — `requireUser` (podgląd dla wszystkich, w tym PM — „Przeglądanie
  wszystkiego"); kontrolki Edytuj/Dezaktywuj tylko dla TESTER/ADMIN (`canEdit`). `/instances/new`
  i `/instances/[id]/edit` — `requireRolePage(['TESTER','ADMIN'])`.
- **Akcje** `app/actions/instances.ts`: `createInstance`, `updateInstance` (`useActionState`,
  wspólny `InstanceForm`), `setInstanceActive` (toggle). Wszystkie `requireRole(['TESTER','ADMIN'])`,
  walidacja `zod` (`clientName` opcjonalny → null). **Zero delete** — dezaktywacja przez `isActive`
  (reguła integralności). Nowa/edytowana instancja nie dopina się sama do trwających wersji.
- **Import CSV** `scripts/import-instances.ts` (`npm run import:instances -- <plik.csv>`):
  nagłówki `name,clientName,keyFunctionalities`, własny parser CSV (cudzysłowy, przecinki i
  nowe linie w polach, `""`, BOM), podsumowanie „dodano/zaktualizowano/pominięto" z powodami.
  Bez UI importu (sekcja 11).
- **Upsert po `name` bez zmiany schematu:** `Instance.name` nie ma `@unique` (świadomie odłożone
  w kroku 4), a inwariant zabrania zmiany `schema.prisma` bez pokazania diffa — więc ręczny upsert
  (`findFirst` po name → update/create), nie `prisma.upsert`. Cel z sekcji 11 osiągnięty bez migracji.

### Odłożone
- `@unique` na `Instance.name` — niepotrzebne przy ręcznym upsercie; gdyby pojawił się wymóg
  twardej unikalności, to osobna migracja z pokazaniem diffa.
- Panel admina (`TaskTemplate`, konta, changelog) → krok 9.

### Jak sprawdzić
- `/instances`: lista aktywnych i nieaktywnych; „Nowa instancja", „Edytuj", „Dezaktywuj/Aktywuj"
- `npm run import:instances -- plik.csv` → podsumowanie; ponowny import tego samego → „zaktualizowano"
- PM: widzi listę, brak kontrolek edycji; akcje odrzucane serwerowo (rola)

**Zweryfikowane w tej sesji (przeglądarka + baza + CLI):**
- Import CSV: przebieg 1 → **dodano 2, pominięto 1** („wiersz 4: brak nazwy"); przebieg 2 →
  **zaktualizowano 2** (upsert po name). Pole z przecinkiem w cudzysłowie zachowane, puste
  `clientName` → `null`.
- UI: utworzenie instancji z formularza (zapisane), dezaktywacja (`isActive=false`, bez delete),
  strona edycji prefilluje wszystkie pola + ukryte `id`. Lista pokazuje licznik „N przypisań".
- Dane testowe posprzątane (zostało 5 seedowych instancji). `npm run check`, `npm run build`,
  `docker compose up --build` OK; `npx vitest run` → 33/33.

---

## Krok 9 — Panel admina `[x]`

- [x] `TaskTemplate`: dodawanie, edycja, dezaktywacja, `sortOrder`, blokada zmiany `taskType`
- [x] Konta: tworzenie z hasłem tymczasowym, reset, `isActive`, rola
- [x] `/admin/changelog` z filtrami i paginacją

### Decyzje
- **Trasy pod `/admin`** (wszystkie `requireRolePage(['ADMIN'])`): `/admin` (hub) →
  `/admin/templates` (+`new`, `[id]/edit`), `/admin/users` (+`new`, `[id]`), `/admin/changelog`.
  Spec wymienia tylko `/admin` i `/admin/changelog`; rozbicie na podtrasy dla czytelności, nie łamie zakresu.
- **Szablony** (`app/actions/task-templates.ts`): create/update/`setActive`. **`taskType` niezmienny**
  (reguła 7) — `updateTaskTemplate` w ogóle go nie czyta; `TemplateForm` przy edycji pokazuje typ
  tylko do odczytu z podpowiedzią „dezaktywuj i utwórz nowy" (brak `<select>`). Pole
  `daysBeforeRelease` widoczne tylko dla `DAYS_BEFORE_RELEASE` (stan kliencki); walidacja warunkowa
  w akcji. Edycja działa na żywo w otwartych wersjach (reguła 4), dezaktywacja zostawia istniejące
  `VersionTask` (reguła 8). Zero delete.
- **Konta** (`app/actions/users.ts`): `createUser` (hasło tymczasowe → `mustChangePassword=true`,
  P2002 → „Konto z tym adresem email już istnieje"), `resetUserPassword` (nowy hash +
  `mustChangePassword=true` + **usunięcie wszystkich sesji** w transakcji — sekcja 6),
  `setUserActive` (dezaktywacja usuwa sesje), `setUserRole`. **Blokada wykluczenia:** ADMIN nie może
  dezaktywować własnego konta ani zmienić własnej roli — enforce w akcji (throw) + ukrycie kontrolek
  dla własnego konta w UI (reset własnego hasła dozwolony).
- **`/admin/changelog`:** filtry (wersja, użytkownik, typ encji, zakres dat) jako **natywny formularz
  GET** (bez klienta), paginacja `PAGE_SIZE=50` linkami zachowującymi filtry. `ChangeLog.versionId`
  to skalar (bez relacji) → mapowanie `id→nazwa` z osobnego `findMany`; użytkownik z relacji `user`.
  Etykiety pól po polsku, wartości bool jako „tak/nie". Bez retencji (reguła 31).

### Odłożone
- Dopracowanie (przejście po ekranach w obu motywach, mobile, focus, reduced-motion) → krok 10.

### Jak sprawdzić
- `/admin` (ADMIN) → sekcje Szablony / Konta / Log zmian; nie-ADMIN → redirect `/`
- Szablon: utwórz, edytuj (typ zablokowany), dezaktywuj; zmiana pól widoczna w otwartej wersji
- Konto: utwórz (hasło tymczasowe), reset (wylogowuje ze wszystkich sesji), zmień rolę/aktywność
- Changelog: filtruj po wersji/użytkowniku/encji/dacie, paginacja

**Zweryfikowane w tej sesji (przeglądarka + baza):**
- Szablon: utworzenie `TICKET_AGGREGATE` + `DAYS_BEFORE_RELEASE`=4 (warunkowe pole dni pojawia się
  po wyborze terminu); edycja — **brak selecta `taskType`**, podpowiedź „niezmienny", pola prefilled.
- Konto: utworzenie (`mustChangePassword=true`, hash bcrypt `$2b$12$`, rola TESTER); reset hasła →
  **hash zmieniony, `mustChangePassword=true`, sesje usunięte (1→0)**; własne konto — ukryte
  formularze roli/aktywności + notka „To Twoje konto".
- Changelog: **35 wpisów**, etykiety pól PL, bool „tak/nie", nazwa wersji, czas Warsaw; filtr
  `entityType=VersionTask` → **14 wpisów, same „Zadanie"**, select zachowuje wybór.
- Dane testowe posprzątane (6 szablonów, 4 konta). `npm run check`, `npm run build`,
  `docker compose up --build` OK; `npx vitest run` → 33/33.

---

## Krok 10 — Dopracowanie `[x]`

- [x] Przejście po wszystkich ekranach w obu motywach
- [x] Mobile: tabela instancji → karty
- [x] Focus ring, nawigacja klawiaturą
- [x] `prefers-reduced-motion`
- [x] Wszystkie puste stany i przypadki brzegowe

### Decyzje
- **Audyt zamiast przebudowy** — aplikacja była budowana na tokenach od kroku 4.5, więc krok 10
  to audyt + punktowe poprawki, nie przeprojektowanie.
- **Poprawka a11y:** `CheckboxTaskControl` tłumił focus ring (`focus-visible:outline-none`) —
  zamienione na widoczny ring (`focus-visible:outline-2 outline-focus`). Reszta kontrolek to
  natywne elementy z globalnym `:focus-visible` z `globals.css`.
- **Motywy z konstrukcji:** grep potwierdził **zero surowych klas kolorów** Tailwinda
  (`gray/green/red/...-NNN`) — wszystko przez tokeny CSS variables; oba motywy zdefiniowane w
  `globals.css`. Zmiana motywu zapisywana w `User.theme` + cookie czytane w server-layoucie (bez FOUC).
- **`prefers-reduced-motion`** obsłużone globalnie w `globals.css` (animacje wyłączone, nie skrócone).

### Odłożone
- Krok 11 (SSE + LISTEN/NOTIFY) — opcjonalny, po MVP. Polling 5 s zostaje.
- Per-stronowe `<title>` (metadata) — pominięte; wewnętrzna aplikacja, tytuł „Release Hub" wystarcza.

### Jak sprawdzić
- Przełącz motyw (Jasny/Ciemny/Systemowy) — zachowany po odświeżeniu, bez mrugnięcia
- Zwęź okno do ~375 px — tabela instancji → karty, changelog przewija się w swoim kontenerze
- Tab po kontrolkach — widoczny focus ring; checkboxy działają Space/Enter

**Zweryfikowane w tej sesji (przeglądarka + baza):**
- **Motyw ciemny:** `<html>.dark`, `body` tło `#12151C` / tekst `#E6E9EF` (tokeny ciemne),
  `User.theme=DARK` zapisany server-side. Zero surowych kolorów w kodzie (grep).
- **Mobile (375 px):** widok wersji — tabela ukryta, **5 kart instancji** z edytowalnymi
  polami/notatkami, **brak poziomego scrolla body**; changelog — szeroka tabela przewija się we
  własnym `overflow-x-auto`, body bez scrolla.
- **Focus/klawiatura:** przycisk statusu focusowalny, ring przywrócony (`outline-none` usunięty).
- **Puste stany:** dashboard bez wersji IN_PROGRESS → „Brak wersji w przygotowaniu — dodaj pierwszą";
  (pozostałe puste stany obsłużone w kodzie — changelog/archiwum/instancje/wersja bez zadań/instancji).
- Fixture przywrócony do `IN_PROGRESS` (reopen wyczyścił snapshoty), motyw Admina wrócił do SYSTEM.
  `npm run check`, `npm run build`, `docker compose up --build` OK; `npx vitest run` → 33/33.

---

## MVP kompletne (kroki 1–10) `[x]`

Wszystkie kroki MVP z sekcji 12 zrobione i zweryfikowane. Pozostaje opcjonalny krok 11 (SSE) po MVP.

## Krok UI-1 — Redesign ekranów auth + prymityw formularza `[x]`

Po review UI: ekrany przed logowaniem (`/login`, `/change-password`) były jedynymi
stronami omijającymi system tokenów — inline style, surowe `#ccc`, `sans-serif`,
brak motywów, brak komponentów. Reszta aplikacji zbudowana poprawnie na tokenach.

- [x] `components/ui/Input.tsx` — prymityw `Input`/`Textarea`/`Select`/`Field`
  (jedyne źródło stylu kontrolek, zastępuje kopiowane po komponentach `field`/`input`)
- [x] `components/Wordmark.tsx` — marka „RH" + nazwa, tylko tokeny, bez assetów
- [x] `/login` i `/change-password` przeniesione na tokeny: wyśrodkowana karta,
  wordmark, `Field`/`Input`, `Button`, komunikaty w kolorach statusowych, oba motywy
- [x] Migracja formularzy aplikacji na prymityw: `InstanceForm`, `NewVersionForm`,
  `TemplateForm`, `CreateUserForm`, `ResetPasswordForm`, `CommentForm`
- [x] Usunięta galeria komponentów: link z dashboardu + trasa `/design` +
  `components/design/Showcase.tsx` (dev-tool, niepotrzebny na produkcji)
- [x] `app/favicon.ico` — wielorozmiarowy (16–256) kafelek „RH" w kolorach tokenów
  (`#1a1d24` tło / `#fafaf7` litery); podpięty automatycznie przez konwencję App Routera
- [x] `app/icon.svg` — adaptacyjny favicon (`prefers-color-scheme`): ciemny kafelek na
  jasnym chrome, jasny na ciemnym; SVG ma pierwszeństwo, `.ico` to fallback. Dodano
  `icon.svg` do wykluczeń matchera middleware (jak `favicon.ico`) — inaczej brama auth
  blokowała asset na stronie logowania (wylogowany user)

### Decyzje
- **Zero nowej palety/fontów.** Baza design (ui-ux-pro-max) sugerowała niebiesko-zielony
  „enterprise" + Fira — świadomie odrzucone: aplikacja ma zweryfikowany WCAG system tokenów
  (IBM Plex Sans) i inwariant „zero surowych kolorów / bez nowych zależności". Atrakcyjność
  z układu, odstępów, elewacji i marki — nie z nowych kolorów.
- **Karta auth jako zwykły `div`** z `p-6` (nie komponent `Card`): `cn` nie robi
  tailwind-merge, więc nadpisanie `p-4` z `Card` byłoby niejednoznaczne. Precyzyjny padding
  bez walki z kolejnością CSS.
- **`AttachInstance` i `NotesField` nietknięte** — to celowe warianty (inline select /
  kompaktowa kontrolka w komórce tabeli z logiką focus/dirty), już na tokenach.
- Bez zmian `schema.prisma`, bez nowych zależności, bez zmian logiki serwerowej/akcji.

### Odłożone
- Przełącznik motywu przed logowaniem — niski priorytet (7 wewnętrznych userów, root layout
  i tak czyta cookie motywu zalogowanego).
- Ewentualny wariant `Input` z `aria-invalid`/stanem błędu per pole — dodać, jeśli pojawi się
  potrzeba walidacji inline.

### Jak sprawdzić
- `/login` w obu motywach: wyśrodkowana karta, wordmark, spójne pola, przycisk `w-full`
- `/change-password` — ten sam układ; baner „musisz zmienić" w kolorze warn
- Formularze admina/instancji/wersji renderują się identycznie jak wcześniej (ten sam wygląd pól)

**Zweryfikowane w tej sesji:**
- `npm run check` przechodzi (tsc czysto, `next lint` bez błędów).
- Podgląd wizualny (oba motywy, dokładne wartości tokenów + fonty) pokazany jako widget.

---

## Krok App-1 — Aplikacje i ikony wersji `[x]`

Feature poza zakresem MVP (na życzenie): najprostszy podział wersji na aplikacje
przez małą ikonę przy nazwie + panel admina do zarządzania aplikacjami i wgrywania ikon.

- [x] Model `Application` (`name @unique`, `iconData`/`iconType`/`iconUpdatedAt`, `isActive`, `sortOrder`) + opcjonalna relacja `Version.applicationId` (`onDelete: Restrict`), migracja `add_application`
- [x] Ikony w bazie (bytea), serwowane read-only route handlerem `GET /api/applications/[id]/icon` (`requireUser`, `nosniff`, cache immutable, `?v=iconUpdatedAt`)
- [x] Akcje ADMIN (`app/actions/applications.ts`): create/update/`setActive`, `uploadApplicationIcon` (upload z urządzenia), `removeApplicationIcon`
- [x] Panel `/admin/applications` (+`new`, `[id]/edit` z uploadem/podglądem/usuwaniem ikony); kafelek w hubie `/admin`
- [x] Komponent `AppIcon` (`1em` → auto-skalowanie do fontu nazwy) przy nazwie wersji: dashboard, `/versions/[id]`, `/versions`, `/archive`
- [x] Wybór aplikacji przy tworzeniu wersji (opcjonalny) + zmiana aplikacji na otwartej wersji (`setVersionApplication`, read-only na zamkniętej)
- [x] Filtrowanie po aplikacji (chipy GET) na dashboardzie, `/versions`, `/archive`
- [x] Seed: 2 przykładowe aplikacje (bez ikon)

### Decyzje
- **Relacja opcjonalna (nullable)** — istniejące wersje zostają bez aplikacji, migracja bez backfillu.
  Aplikacja podana przy tworzeniu/zmianie musi istnieć i być aktywna (walidacja w akcji).
- **Ikony w bazie (bytea), nie na dysku** — jeden kontener, ikony małe; brak nowego wolumenu,
  przetrwają redeploy. Serwowane route handlerem (read, nie mutacja → dozwolone poza Server Action).
  `iconData` (bajty) **nigdy** w zapytaniach list/kart — tylko `id/name/iconType/iconUpdatedAt`.
- **Bez nowej zależności (bez `sharp`)** — walidacja MIME (PNG/WebP/JPEG) + limit **100 KB**,
  zapis surowych bajtów. CSS skaluje `1em` (`object-contain`). Zatwierdzone formaty: rastry
  (SVG świadomie poza listą — mniejsza powierzchnia; serwowanie i tak z `nosniff`).
- **Zmiana aplikacji wersji logowana do ChangeLog** (`entityType='Version'`, `field='application'`,
  stara→nowa nazwa) w tej samej transakcji przez `logChange` — rozszerza reguła 27 świadomie,
  na wniosek użytkownika. CRUD samych aplikacji (jak szablony/instancje) **nie** idzie do ChangeLog.
- **Zero hard delete** — dezaktywacja aplikacji przez `isActive`; nieaktywna znika z selektorów
  i (co do zasady) z chipów, ale istniejące wersje zachowują ikonę/nazwę. Chipy filtra = aktywne
  aplikacje ∪ aplikacje faktycznie użyte w danym widoku (nieaktywna z wersją nadal ma chip);
  „Usuń ikonę" czyści atrybut, nie kasuje rekordu.
- **Kontrolka zmiany aplikacji** to natywny `<select>` z tokenami (nie współdzielony `Select`,
  który ma `w-full` — `cn` nie robi tailwind-merge, notatka z Kroku UI-1), żeby uniknąć walki o szerokość.

### Odłożone
- Grupowanie/nagłówki sekcji po aplikacji na dashboardzie — na razie ikona-marker + filtr wystarczają.
- Placeholder-monogram gdy brak ikony — pomijany w wersjach (ikona renderowana tylko gdy jest);
  w panelu admina pusty kafelek pokazuje przerywaną ramkę.
- Normalizacja/resize ikon (kwadrat, stały rozmiar) — gdyby zaszła potrzeba, osobno z `sharp` (za zgodą).

### Jak sprawdzić
- `/admin/applications` (ADMIN): dodaj aplikację, wejdź w edycję, wgraj ikonę (PNG/WebP/JPEG ≤100 KB),
  podgląd się odświeża; „Usuń ikonę" czyści; dezaktywacja chowa z selektorów
- Utwórz wersję z aplikacją → ikona przy nazwie na dashboardzie i w widoku wersji, skaluje się z fontem
- Na otwartej wersji zmień aplikację → wpis w `/admin/changelog` (Wersja / aplikacja / stara → nowa)
- Filtr po aplikacji na dashboardzie/`/versions`/`/archive`; „Bez aplikacji" pokazuje wersje bez przypisania

**Zweryfikowane w tej sesji (przeglądarka + baza + curl, fixture wstrzyknięty i posprzątany):**
- Migracja `20260804082408_add_application` — kolumna nullable + tabela + FK RESTRICT (bez utraty danych).
- Ikona serwowana: `GET /api/applications/[id]/icon` → **200 `image/png`**, `X-Content-Type-Options: nosniff`,
  cache immutable; **bez cookie → 307 `/login`** (brama middleware). `naturalWidth=1` (bajty dotarły).
- **Auto-skalowanie:** ta sama ikona **14 px** w chipie (text-sm) vs **18 px** na karcie (text-lg).
- **Filtr:** `?app=<id>` → tylko wersje tej aplikacji; `?app=none` → wersje bez aplikacji; brak → wszystkie;
  aktywny chip poprawny; łączenie z filtrem statusu w `/archive` zachowuje oba parametry.
- **Zmiana aplikacji wersji** przez UI → baza zaktualizowana + **ChangeLog**: `Version` / `application` /
  „Portal klienta → Aplikacja mobilna"; changelog renderuje etykiety PL, filtr `entityType=Version` działa.
- `npm run check` czysto, `npm run build` (21 tras, w tym `/api/applications/[id]/icon`, `/admin/applications*`),
  `npx vitest run` → **33/33**, `npm run seed` idempotentny (`applications=2`),
  `docker compose up --build` startuje („No pending migrations", Ready, `/health` 200).

---

## Krok UI-2 — Wspólny header, nawigacja i okruszki `[x]`

Redesign górnej części na życzenie po review UX: nawigacja i przełącznik motywu /
wylogowanie istniały tylko na dashboardzie, brak „home", niespójne back-linki
(z widoku wersji dwa kliki do dashboardu). Cel: jeden współdzielony chrome na
każdej zalogowanej stronie.

- [x] `lib/nav.ts` — czysty moduł: `NAV_ITEMS`, `isNavItemActive`, `buildBreadcrumbs`
- [x] `components/nav/AppHeader.tsx` (server) — sticky pasek: marka=home + `AppNav`
  + `ThemeToggle` + chip „Imię (ROLA)" + „Wyloguj"
- [x] `components/nav/AppNav.tsx` (client) — sekcje z aktywnym stanem (`usePathname`)
- [x] `components/nav/Breadcrumbs.tsx` (client) — okruszki ze ścieżki, ukryte na dashboardzie
- [x] Chrome zamontowany w `(app)/layout.tsx` (ma usera z `requireUser`)
- [x] Usunięty inline header + nav z dashboardu; nagłówek sekcji → `<h1>`
- [x] Usunięte bespoke back-linki („← …") z 17 podstron + martwe importy `Link`

### Decyzje
- **Wybór użytkownika (AskUserQuestion):** górny pasek (nie sidebar/hybryda);
  breadcrumbs TAK; tożsamość jako widoczny chip + przycisk (nie dropdown).
- **Breadcrumbs generyczne, w pełni automatyczne ze ścieżki** — zero propsów per
  strona (świadomy wybór „mniej dłubaniny"). Segment dynamiczny (id) dostaje
  generyczne słowo (`Szczegóły`) i tylko gdy jest ostatni; pośredni segment id
  (np. `templates/[id]/edit`) jest pomijany → `… / Szablony zadań / Edycja`.
- **Aktywny stan sekcji = `usePathname`**, więc `AppNav`/`Breadcrumbs` to cienkie
  komponenty klienckie; `AppHeader` i reszta stron zostają Server Components.
- **Aktywny wygląd = `bg-fg text-bg`** (wzorzec „zaznaczenia" z appki, jak aktywny
  `ThemeToggle`) — brak tokena `accent`, nie dokładam nowego koloru.
- **Marka w pasku = kompaktowy inline lockup** (kafelek „RH" + „Release Hub"),
  nie pionowy `Wordmark` (ten zostaje na ekranach auth — inna forma). Te same
  tokeny (`bg-fg`/`text-bg`/`font-mono`), zero nowych assetów.
- **Kolumna chrome `max-w-6xl px-6`** (pasek + okruszki); strony zachowują własne
  `max-w-2xl/4xl/5xl` centrowane. Sticky pasek, breadcrumb scrolluje się z treścią.
- Bez zmian `schema.prisma`, bez nowych zależności, tylko tokeny CSS,
  `prefers-reduced-motion` (globalnie), teksty PL.

### Odłożone
- Hamburger na mobile — 5 pozycji zawija się pod markę, wystarcza (≤375 px).
- Breadcrumb z realną nazwą obiektu (`9.9.9`, nazwa instancji) zamiast generycznego
  słowa — wymaga przekazania kontekstu ze strony; do rozważenia, jeśli zajdzie potrzeba.
- Przełącznik motywu przed logowaniem — nadal poza zakresem (jak w UI-1).

### Jak sprawdzić
- Z dowolnej podstrony: klik w „RH / Release Hub" → dashboard (jeden klik)
- Motyw i „Wyloguj" dostępne na każdej stronie, nie tylko na `/`
- Widok wersji: breadcrumb `Dashboard / Wersje / Szczegóły`, aktywna „Wersje”, brak „← Wersje”
- `admin/templates/[id]/edit`: breadcrumb pomija id → `… / Szablony zadań / Edycja`

**Zweryfikowane w tej sesji (przeglądarka + baza + docker):**
- `npm run check` czysto (tsc + ESLint), `npx vitest run` → **33/33**.
- `docker compose up -d --build` startuje (health 200); `/`, `/versions` bez cookie → 307.
- Zalogowany (admin): dashboard bez okruszków, shell z home/nav/motyw/chip/Wyloguj,
  `<h1>` „Wersje w przygotowaniu”, brak starego zduplikowanego nagłówka.
- Widok wersji: breadcrumb `Dashboard / Wersje / Szczegóły` (ostatni nielinkowany),
  `activeNav=["Wersje"]`, `<main>` startuje od `9.9.9` (back-link usunięty).
- `templates/[id]/edit`: breadcrumb `Dashboard / Panel administratora / Szablony zadań /
  Edycja` (segment `seed-tpl-*` pominięty), `activeNav=["Admin"]`.

---

## Krok UI-3 — Katalog instancji w panelu admina `[x]`

Instancje to konfiguracja ustawiana na starcie i edytowana rzadko (raz w roku) —
przeniesione z głównej nawigacji do panelu admina, jak Szablony/Aplikacje/Konta.

- [x] Trasy przeniesione: `/instances*` → `/admin/instances`, `/admin/instances/new`,
  `/admin/instances/[id]/edit`
- [x] Autoryzacja zaostrzona do **ADMIN** (było TESTER+ADMIN i publiczny podgląd):
  strony `requireRolePage(['ADMIN'])`, akcje `requireRole(['ADMIN'])`
- [x] Stary `/instances` usunięty (404); pozycja „Instancje" znika z głównej nawigacji
- [x] Kafelek „Katalog instancji" w hubie `/admin`

### Decyzje
- **Wybór użytkownika (AskUserQuestion):** dostęp = **tylko ADMIN**; stary URL
  `/instances` = **usunąć zupełnie** (404, bez redirectu — wewnętrzna apka).
- **Zmiana polityki względem Kroku 8:** katalog przestaje być widoczny dla wszystkich
  i edytowalny przez testerów. Instancje pozostają widoczne dla wszystkich **w kontekście
  wersji** (tabela test-runów) — znika tylko samodzielny katalog dla nie-adminów. Egzekwowane
  tym samym `requireRolePage`/`requireRole` co reszta admina (bez nowego testu).
- **Breadcrumb działa bez zmian** — `SEGMENT_LABELS.instances='Katalog instancji'` daje
  `Dashboard / Panel administratora / Katalog instancji` pod nową ścieżką.
- **Lista uproszczona** — bez `canEdit` (admin zawsze edytuje); kontrolki zawsze widoczne.
- Bez zmian `schema.prisma`, bez nowych zależności. `scripts/import-instances.ts` (CSV)
  bez zmian — operuje na bazie, nie na trasie.

### Jak sprawdzić
- Główna nawigacja: brak „Instancje"; `/admin` → kafelek „Katalog instancji"
- `/admin/instances` (ADMIN): lista + „Nowa instancja” → `/admin/instances/new`, edycja, dezaktywacja
- Stary `/instances` → 404; nie-ADMIN na `/admin/instances*` → redirect `/`

**Zweryfikowane w tej sesji (przeglądarka + docker):**
- `npm run check` czysto (po wyczyszczeniu stale `.next/types`), `npx vitest run` → **33/33**.
- `docker compose up -d --build` startuje (health 200).
- `/admin/instances` (admin): h1 „Katalog instancji", breadcrumb `Dashboard / Panel
  administratora / Katalog instancji", `activeNav=["Admin"]`, przycisk → `/admin/instances/new`.
- Główna nawigacja = `[Dashboard, Wersje, Archiwum, Admin]` (bez „Instancje").
- `/admin` hub: 5 kafelków, w tym „Katalog instancji" → `/admin/instances`.
- Stary `/instances` (zalogowany) → **404**.

---

## Krok UI-4 — Osobny ekran edycji wersji `[x]`

Wybór aplikacji przeniesiony z widoku wersji do dedykowanego ekranu edycji;
doszła edycja daty wydania (terminy się przesuwają) i nazwy. Widok wersji
pokazuje już tylko logo aplikacji (bez inline-selecta).

- [x] Widok `/versions/[id]`: usunięty inline `<select>` aplikacji + akcja
  `setVersionApplication`; zostaje samo `AppIcon`; przycisk „Edytuj wersję”
  (tylko otwarta wersja + TESTER/ADMIN)
- [x] Nowy ekran `/versions/[id]/edit` (nazwa, data wydania, aplikacja) —
  `requireRolePage(['TESTER','ADMIN'])`, redirect na widok gdy wersja zamknięta
- [x] Akcja `updateVersion` (zastępuje `setVersionApplication`): jedna transakcja,
  `assertVersionEditable`, walidacja `zod`, P2002 → „Wersja X już istnieje”
- [x] Zmiany nazwy / daty / aplikacji logowane do ChangeLog (stara→nowa)
- [x] Etykiety PL w `/admin/changelog`: `nazwa`, `data wydania`

### Decyzje
- **Wybór użytkownika (AskUserQuestion):** ekran edytuje **nazwę + datę + aplikację**;
  zmiana daty **logowana** do ChangeLog. Dla spójności audytu **nazwa też jest
  logowana** (to identyfikator wersji — zmiana bez śladu byłaby luką).
- **Tylko zmienione pola idą do ChangeLog** — akcja porównuje wartości i zapisuje
  wyłącznie różnice (brak pustych wpisów przy zapisie bez zmian).
- **`setVersionApplication` skonsolidowane w `updateVersion`** — jedna akcja i jeden
  formularz zamiast osobnej mutacji per pole (było używane tylko w usuniętym inline-formularzu).
- **Read-only na zamkniętej wersji** (reguła 12): strona edycji przekierowuje na widok,
  a `assertVersionEditable` w akcji odrzuca mutację po stronie serwera.
- **Aplikacja nieaktywna przypisana do wersji** — dołączana do selecta jako
  „(nieaktywna)”, żeby nie zniknęła; zmiana na inną wymaga aplikacji aktywnej.
- **Data w przeszłości** — nadal tylko ostrzeżenie (bez blokady), porównanie stringów
  z `today` liczonym serwerowo (bez `new Date()` w kliencie, reguła 25).
- Bez zmian `schema.prisma`, bez nowych zależności, tylko tokeny CSS, teksty PL.

### Jak sprawdzić
- Widok wersji (otwartej): samo logo przy nazwie, przycisk „Edytuj wersję”; PM go nie widzi
- Ekran edycji: zmiana daty/aplikacji/nazwy → powrót na widok z nowymi wartościami
- `/admin/changelog` (filtr Wersja): wpisy `data wydania` / `aplikacja` / `nazwa` (stara → nowa)
- Nadanie istniejącej nazwy → „Wersja X już istnieje”; wersja zamknięta → brak edycji

**Zweryfikowane w tej sesji (przeglądarka + baza + docker, fixture przywrócony):**
- `npm run check` czysto, `npx vitest run` → **33/33**, `docker compose up -d --build` (health 200).
- Widok `9.9.9`: brak inline-selecta, przycisk „Edytuj wersję” → `/versions/[id]/edit`.
- Edycja: data `2026-09-01 → 2026-09-15` + aplikacja `— → MerchMobiler` → redirect na widok,
  nowa data i ikona widoczne; ChangeLog: **`data wydania` i `aplikacja`** (etykiety PL, stara→nowa).
- Duplikat nazwy (`04.01.150 → 9.9.9`) → **„Wersja 9.9.9 już istnieje”**, bez zapisu.
- Fixture `9.9.9` przywrócony (data 2026-09-01, bez aplikacji).

---

## Krok Kolumny-A — Konfiguracja kroków i szablonów (warstwa config) `[x]`

Pierwszy z dwóch kroków wprowadzania konfigurowalnych kolumn („kroków") tabeli
instancji. Krok A jest **addytywny** — dodaje warstwę konfiguracji, nie rusza
jeszcze 4 sztywnych flag ani logiki wersji. Cutover → Krok Kolumny-B.

- [x] Schema: enum `ColumnFieldType { CHECKBOX }`, modele `Column`, `ColumnTemplate`,
  `ColumnTemplateItem`; migracja `add_columns_and_templates` (bez zmian w `InstanceTestRun`)
- [x] Walidacja `zod` + akcje `app/actions/columns.ts` (ADMIN): CRUD katalogu kroków
  i szablonów (create/update/setActive/setDefault, sync kroków szablonu)
- [x] Ekran `/admin/columns` z zakładkami (`?tab=steps|flows`) + formularze
  `new`/`[id]/edit` dla kroków i `flows/new`/`flows/[id]/edit` dla szablonów
- [x] Kafelek „Konfiguracja kroków i szablony" w hubie `/admin`; etykiety breadcrumb
- [x] Seed: 4 kroki (= 4 obecne flagi) + domyślny szablon „Domyślne flow" ze wszystkimi 4

### Decyzje (uzgodnione z użytkownikiem)
- **Model 4-warstwowy:** katalog kroków (`Column`) → szablony/flow (`ColumnTemplate`
  + `ColumnTemplateItem`, jeden `isDefault`) → kolumny wersji (`VersionColumn`, krok B,
  **kopia przy podpięciu**) → wartości (`InstanceRunValue`, krok B, **wiersz na parę
  run×kolumna** — zachowuje regułę 21).
- **Kolumny per-wersja, nie globalny sztywny setting** — każda wersja może mieć inny
  zakres kroków; dodawanie kroku „w połowie wersji" przez ekran edycji wersji (krok B).
- **Kopia przy podpięciu** rozwiązuje archiwum bez snapshotów: rename/dezaktywacja w
  katalogu nie rusza istniejących wersji; zamknięta wersja i tak read-only.
- **Gotowość instancji** = wszystkie aktywne kroki checkbox danej wersji (krok B).
- **Zero hard delete** — kroki/szablony przez `isActive`; usunięcie kroku z wersji przez
  `excludedAt` (krok B). Edycja składu szablonu (add/remove item) to konfiguracja, nie
  audytowane dane — dozwolone plain create/delete itemów.
- **UI po polsku: „kroki/szablony"** (nazwa kafelka jak podał użytkownik); w kodzie
  modele angielskie `Column`/`ColumnTemplate` (fizycznie to kolumny tabeli).
- **URL `flows` zamiast `templates`** dla szablonów kroków — uniknięcie kolizji breadcrumb
  z „Szablony zadań" (`/admin/templates`). `/admin/columns/flows` → redirect na zakładkę.

### Odłożone → Krok Kolumny-B (cutover)
- `VersionColumn` + `InstanceRunValue`, migracja z backfillem 4 flag do domyślnego flow
  i runów (zachowanie zaznaczeń i archiwum), potem drop 4 kolumn boolean z `InstanceTestRun`.
- Podpięcie domyślnego flow przy tworzeniu wersji; zarządzanie kolumnami w edycji wersji.
- Dynamiczna tabela instancji + generyczna akcja `setColumnValue`; przepisany agregat
  gotowości (`aggregates.ts`) + testy; changelog kluczowany po kolumnie; `overflow-x-auto`.

### Jak sprawdzić
- `/admin` → kafelek „Konfiguracja kroków i szablony"; `/admin/columns` — zakładki Kroki/Szablony
- Zakładka Kroki: 4 zaseedowane, „Nowy krok" tworzy; Szablony: „Domyślne flow" (Domyślny, 4 kroków)
- Edycja szablonu: zaznaczanie kroków zmienia licznik; aplikacja bez zmian (4 flagi po staremu)

**Zweryfikowane w tej sesji (przeglądarka + baza + docker):**
- `npm run check` czysto, `npx vitest run` → **33/33**, `docker compose up -d --build` (health 200).
- `npm run seed` ×2 idempotentny → `columns=4, columnTemplates=1`.
- `/admin/columns`: h1, breadcrumb `Dashboard / Panel administratora / Konfiguracja kroków`,
  zakładki Kroki(aktywna)/Szablony, 4 kroki. Zakładka Szablony: „Domyślne flow" Domyślny, 4 kroków.
- Utworzenie kroku przez UI → pojawia się na liście. Edycja szablonu (dołączenie kroku) →
  licznik 4→5 (sync itemów działa). Dane testowe posprzątane (columns=4, flow=4).

---

## Krok Kolumny-B — Cutover na kolumny wersji `[x]`

Drugi krok konfigurowalnych kolumn („kroków"). Zastępuje 4 sztywne flagi
`InstanceTestRun` dynamicznymi krokami per-wersja (kopie z szablonu/flow),
z pełnym backfillem danych. Aplikacja czyta wartości wyłącznie przez nowe tabele.

- [x] Schema: `VersionColumn` (kopia name/fieldType, `excludedAt` soft-hide) +
  `InstanceRunValue` (wiersz na parę run×kolumna, reguła 21); usunięte 4 boolean z `InstanceTestRun`
- [x] Migracja `column_cutover` (ręczna): utwórz tabele → **backfill** 4 flag do
  `VersionColumn` + `InstanceRunValue` per wersja/run → drop 4 kolumn (atomowo, transakcyjny DDL)
- [x] `aggregates.ts` przepisany na dynamiczny model (`trueCount` per run, N kroków checkbox) + testy
- [x] `setColumnValue(runId, versionColumnId, value)` zastępuje 4 akcje flag (upsert wartości, log po kroku)
- [x] `version-columns.ts`: `addVersionColumns` (z katalogu), `removeVersionColumn` (soft), `restoreVersionColumn`
- [x] Dynamiczna `InstanceRunsTable` (kolumny z `VersionColumn`, `overflow-x-auto`); widok wersji + `VersionCard` liczą agregat z wartości
- [x] Tworzenie wersji podpina domyślny/wybrany flow; ekran edycji wersji zarządza krokami
- [x] Changelog rozwiązuje `versionColumnId` → nazwa kroku (stare etykiety flag zostają dla historii)

### Decyzje
- **Backfill z `columnId = NULL`** dla danych historycznych — kolumna samowystarczalna
  (name/fieldType skopiowane), bez zależności migracji od zaseedowanego katalogu i bez
  ryzyka FK. Dopasowanie flaga→krok po nazwie (literały w tej samej migracji).
- **Wartości leniwie** — brak wiersza `InstanceRunValue` = false; tworzone przy pierwszym
  zaznaczeniu (upsert). Mniej danych, agregat traktuje brak jako false.
- **Gotowość** = run ma wszystkie aktywne kroki checkbox wersji = true; N = liczba tych
  kroków. N = 0 → „brak kryteriów" (nic nie jest gotowe, bez pustej gotowości).
- **Soft-remove + restore** kroku wersji (reguła 18): usunięcie chowa (`excludedAt`),
  wartości zostają i wracają po „Przywróć" (ten sam wiersz). „Dodaj z katalogu" wyklucza
  kroki aktywne i ukryte po nazwie (kroki backfillowane mają `columnId = null`).
- **Log kluczowany po `versionColumnId`**; changelog mapuje id→nazwa (jak `versionId→nazwa`).
  Stare wpisy flag (`environmentRestored` itd.) zachowują etykiety PL w `FIELD_LABEL`.

### Jak sprawdzić
- Widok wersji: kolumny = kroki wersji; zaznaczenie zapisuje się, changelog pokazuje nazwę kroku
- Edycja wersji → „Kroki wersji": usuń krok (znika z tabeli), przywróć (wartości wracają), dodaj z katalogu
- Nowa wersja z domyślnym flow → dostaje jego kroki; „— bez kroków —" → wersja bez kroków
- Wersja bez kroków checkbox → „X/Y gotowych" nie pokazuje pustej gotowości

**Zweryfikowane w tej sesji (przeglądarka + baza + docker):**
- `npm run check` czysto, `npx vitest run` → **34/34**, `docker compose up -d --build` (health 200).
- **Migracja+backfill:** VersionColumn=8 (2 wersje × 4), InstanceRunValue=40 (10 runów × 4),
  true=20, po 5 na każdy krok — dokładnie zgodne ze stanem 4 flag sprzed migracji.
- Widok `9.9.9`: 4 dynamiczne kroki z zachowanymi wartościami; odznaczenie → baza `false`
  + ChangeLog `Środowisko odtworzone: tak → nie` (nazwa, nie uuid).
- Edycja: usuń „Testy wykonane" → 3 kroki w tabeli; „Przywróć" → 4 kroki, wartości **5/5 zachowane**.
- Nowa wersja z „Domyślne flow" → **4 kroki** + 5 runów; wersja testowa i toggle posprzątane
  (true_values=20, version_columns=8, versions=2).

---

## Krok Kolumny-C — Reorder kroków (drag-and-drop) `[x]`

Przeciąganie zamiast wpisywania `sortOrder` w trzech miejscach: kroki wersji
(edycja wersji), katalog kroków (admin) i kolejność kroków w szablonie (flow).

- [x] **Nowa zależność (zatwierdzona): `@dnd-kit/core` + `/sortable` + `/utilities`** —
  drag mysz/dotyk/klawiatura, dostępne, respektuje reduced-motion
- [x] `components/ui/SortableList.tsx` — reużywalna lista sortowalna + `DragHandle` (uchwyt „⠿")
- [x] Akcje: `reorderColumns(orderedIds)` (ADMIN), `reorderVersionColumns(versionId, orderedIds)`
  (TESTER/ADMIN + `assertVersionEditable`) — zapis `sortOrder` wg pozycji w transakcji
- [x] Katalog kroków (`ColumnCatalogList`) i kroki wersji (`VersionColumnsList`) — sortowalne,
  zapis optymistyczny (`useOptimistic`)
- [x] Szablon (`ColumnTemplateForm`) — sortowalna lista wybranych kroków + dodawanie/usuwanie;
  kolejność wysyłana jako uporządkowane `columnIds` (item `sortOrder` wg pozycji)
- [x] Usunięte pola „Kolejność" z formularza kroku; nowy krok na koniec (auto `sortOrder`)

### Decyzje
- **dnd-kit, nie natywny HTML5 drag** — natywny nie działa na dotyku i nie jest dostępny
  z klawiatury (regres a11y). dnd-kit ma sensory pointer + touch + keyboard.
- **Uchwyt (grip), nie cały wiersz** — wiersze mają przyciski (Edytuj/Usuń/Dezaktywuj),
  więc drag tylko za uchwyt, żeby nie kolidował z klikaniem.
- **Reorder tylko wśród aktywnych** kroków katalogu; nieaktywne w osobnej, nieprzeciąganej sekcji.
- **Kolejność szablonu przez submit** (uporządkowane `columnIds`), nie osobna akcja —
  spójne z istniejącym `syncItems` (item `sortOrder` = indeks).
- **Kolejność samego szablonu na liście** zostaje polem liczbowym (poza zakresem — dotyczyło kroków).

### Jak sprawdzić
- Admin → Konfiguracja kroków → Kroki: przeciągnij „⠿", kolejność zapisana po odświeżeniu
- Edycja wersji → Kroki wersji: przeciągnij; kolejność = kolejność kolumn w tabeli instancji
- Edycja szablonu: przeciągnij kroki; nowa wersja z tym flow dostaje je w tej kolejności

**Zweryfikowane w tej sesji (przeglądarka + baza + docker):**
- `npm run check` czysto, `npx vitest run` → **34/34**, `docker compose up -d --build` (health 200).
- Struktura sortowalna renderuje się na wszystkich 3 ekranach (uchwyty „⠿" obecne).
- **Persystencja kolejności** (ścieżka, którą karmi drag) potwierdzona: utworzenie szablonu z
  krokami dodanymi w kolejności [Testy, Środowisko] → item `sortOrder` w bazie **Testy > Środowisko**.
- Uwaga narzędziowa: sam **gest drag** nie da się wysterować w panelu (dnd-kit nie reaguje na
  syntetyczne pointer/keyboard events bez kompozycji klatek) — do ręcznego sprawdzenia w przeglądarce;
  logika akcji reorder i wiązanie `onReorder` są proste i pokryte typami/checkiem.

---

## Krok 11 — SSE (opcjonalny, po MVP) `[ ]`

- [ ] `NOTIFY` z server actions, klient `pg` z `LISTEN`
- [ ] Route handler `text/event-stream`, `X-Accel-Buffering: no`
- [ ] `EventSource` w kliencie zamiast interwału

### Decyzje
### Odłożone
### Jak sprawdzić
