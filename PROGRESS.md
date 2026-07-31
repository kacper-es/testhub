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
