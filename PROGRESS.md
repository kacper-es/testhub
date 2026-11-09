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
  → Zrewidowane w kroku D-1: seed nie nadaje się na produkcję, potrzebny osobny skrypt admina.

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
  przy panelu admina/szablonach (krok 9) lub osobno. → Zrobione w kroku V-1 (2026-11-08).
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

## Krok UI-5 — Podgląd wersji: widok roboczy, struktura w edycji `[x]`

Rozdzielenie podglądu wersji (praca) od edycji (struktura), na wniosek użytkownika.

- [x] Usunięta kolumna „Notatki" z tabeli instancji w podglądzie wersji
- [x] „Odepnij" i „Podepnij instancję" przeniesione z podglądu do ekranu edycji wersji
- [x] Podgląd wersji = czysty widok roboczy: instancje × kroki (checkboxy), bez struktury

### Decyzje
- **Oba (odepnij + podepnij) w edycji** (wybór użytkownika) — cała struktura wersji
  (nazwa, data, aplikacja, kroki, instancje) w jednym miejscu; podgląd tylko do pracy.
- **`NotesField`/`setNotes` zostają w kodzie jako nieużywane** (martwy kod, gdyby notatki
  miały wrócić) — pole `InstanceTestRun.notes` w schemacie nietknięte, dane zachowane.
- `unpinInstanceRun`/`attachInstance` rewalidują teraz też `/versions/[id]/edit`.

### Jak sprawdzić
- Podgląd wersji: tabela = Instancja + kroki; brak „Notatki", „Odepnij", „Podepnij"
- Edycja wersji → „Instancje": lista z „Odepnij" + „Podepnij instancję"; odepnij→podepnij zachowuje zaznaczenia

**Zweryfikowane w tej sesji (przeglądarka + baza + docker):**
- `npm run check` czysto; `docker compose up -d --build` (health 200).
- Podgląd `9.9.9`: nagłówki [Instancja, 4 kroki]; brak Notatki/Odepnij/Podepnij.
- Edycja: sekcja „Instancje" z 5× „Odepnij" + „Podepnij"; odpięcie Klient A → 4 aktywne
  + opcja „Klient A (były dane)"; ponowne podpięcie → 5 aktywnych, **20 wartości true zachowane**.

---

## Integracja Jira (po MVP) — plan `[ ]`

Plan uzgodniony 2026-10-23, jeszcze nic nie zbudowane. Przed J-1: przenieść Jira z „Poza zakresem"
do zakresu w `CLAUDE.md` i `PROMPT-release-hub-mvp.md`.

### Ustalenia
- **Jira Cloud** (`*.atlassian.net`), REST API v3, Basic auth: e-mail konta + API token.
  Konto/token utworzy użytkownik później. Sekrety tylko w env (`JIRA_BASE_URL`, `JIRA_EMAIL`,
  `JIRA_API_TOKEN`), nigdy w bazie ani w repo. VM ma dostęp do Jiry.
- **Read-only** — zero zapisu do Jiry.
- **Przynależność ticketu do wersji = `fixVersion`.** `Application` ↔ projekt Jira,
  `Version` ↔ wersja projektu Jira (wybór z listy pobranej z Jiry).
- **„Gotowe" = kategoria statusu `Done`** (`statusCategory.key = "done"`).
- **Jira zastępuje ręczny licznik `TICKET_AGGREGATE`** (zaakceptowane 2026-10-25):
  wersje zamknięte zachowują historyczne wartości ręczne (read-only); otwarte bez podpiętej
  wersji Jira pokazują „—" + „Niepodpięta do Jira". Kolumny `manualCounter*` zostają w schemacie.
- **Zarządzanie integracją: tylko ADMIN** (konfiguracja, mapowanie, „Synchronizuj teraz").
- **Lokalna kopia ticketów** (`JiraIssue`), odświeżana pullem — widoki i polling 5 s nie
  odpytują Jiry. Wersje zamknięte (`RELEASED`/`CANCELLED`) nie są synchronizowane.
- Bez nowych zależności (wbudowany `fetch`). Zmiany `schema.prisma` — diff do akceptacji w każdym kroku.

### Kroki
- [x] **J-1** Połączenie: klient Jira (`fetch` + auth z env, obsługa 401/403/404/429/5xx),
  strona admina „Jira" z „Testuj połączenie" i stanem konfiguracji. Paginacja → J-3.
- [x] **J-2** Mapowanie: `Application.jiraProjectKey`, `Version.jiraVersionId` (wybór z listy wersji projektu).
- [x] **J-3** Synchronizacja ticketów do `JiraIssue` (ręczna, ADMIN): JQL `fixVersion = <id>`,
  ~~przyrostowo po `updated`~~ **pełna per wersja** (zmiana 2026-11-08, patrz krok J-3);
  klucz, tytuł, typ, status, kategoria statusu, przypisany, `updated`.
- [x] **J-4** Widok ticketów w wersji + `TICKET_AGGREGATE` liczony z Jiry (Done / wszystkie).
- [ ] **J-5** Pola własne: pobranie definicji (`/rest/api/3/field`), wybór przez admina,
  zapis wartości (JSONB), wyświetlanie. **Czeka na listę pól od użytkownika.**
- [x] **J-6** Automatyczna synchronizacja co N minut.

### Pytania otwarte
- Pola własne: które i do czego (tylko wyświetlanie czy też filtrowanie/liczenie) — przed J-5.
- ~~J-6: mechanizm harmonogramu i interwał~~ → rozstrzygnięte w J-6 (timer w procesie, 30 min).

---

## Krok J-1 — Połączenie z Jira Cloud `[x]`

- [x] Jira przeniesiona do zakresu w `CLAUDE.md` i `PROMPT-release-hub-mvp.md`
- [x] `lib/jira/config.ts`, `lib/jira/client.ts`, akcja `testJiraConnection`
- [x] `/admin/jira` + karta w panelu admina + okruszek
- [x] `.env.example`, `docker-compose.yml`, testy

### Decyzje
- **Bez zmian schematu i bez nowych zależności.**
- **`readJiraConfig(env)`** — czysta funkcja (env jako argument), `zod`: URL tylko `https://`,
  końcowy `/` obcinany, poprawny e-mail. Trzy stany: `configured` / `missing` (lista zmiennych) / `invalid`.
- **`jiraGet()`** — Basic auth (`email:token` base64), timeout 10 s (`AbortSignal.timeout`),
  `redirect: 'manual'` (przekierowanie np. na stronę logowania = zły adres), wymagany
  `content-type: application/json`. Błędy jako `JiraError` z rodzajem i **stałym** polskim komunikatem —
  treść odpowiedzi Jiry nigdy nie jest przepisywana (nie wycieknie token ani dane). 429 dokleja `Retry-After`.
  `fetch` wstrzykiwalny (testy bez sieci).
- **Test połączenia = `GET /rest/api/3/myself`** — wynik: nazwa konta, adres, czas w ms.
- **`testJiraConnection`** — `requireRole(['ADMIN'])`, bez wejścia od klienta (brak danych do `zod`),
  bez mutacji → bez `ChangeLog`. Kształt `(prevState, formData)` pod `useActionState`.
- **Strona `/admin/jira`** pokazuje adres i e-mail, token wyłącznie jako „ustawiony". Przycisk
  wyłączony, gdy konfiguracja niepełna/niepoprawna.
- **docker-compose:** `JIRA_*: ${JIRA_*:-}` — puste domyślne, brak konfiguracji nie blokuje startu
  ani nie daje ostrzeżeń compose.

### Odłożone
- Paginacja (`nextPageToken`) i ponawianie przy 429 → J-3 (pierwsze realne użycie).
- **Test na prawdziwej Jirze** — czeka na konto/token od użytkownika.

### Jak sprawdzić
- Bez `JIRA_*`: `/admin/jira` → „Nieskonfigurowane" + lista 3 zmiennych, przycisk wyłączony
- Zmyślony token na prawdziwym adresie → „Nieprawidłowy e-mail lub token API (401)."
- Prawdziwy token → „Połączono jako <konto> (<adres>) w N ms."
- PM/TESTER: brak dostępu do `/admin/jira` (redirect), akcja odrzucona serwerowo

**Zweryfikowane w tej sesji (przeglądarka + docker):**
- `npx vitest run` → **50/50** (nowy `jira-client.test.ts` 14 testów; `authz.test.ts`: PM i TESTER
  odrzuceni z `testJiraConnection`). `npm run check` czysto. `docker compose up -d --build` OK.
- `/admin/jira` bez zmiennych → „Nieskonfigurowane", 3 brakujące zmienne.
- Tymczasowo `JIRA_BASE_URL=https://jira.invalid` + zmyślony token (tylko w zmiennych powłoki,
  `.env` nietknięty): konfiguracja pokazana, token jako „ustawiony", test →
  „Błąd sieci — nie udało się połączyć z Jirą."; `docker compose logs app` — 0 wystąpień tokenu.
  Kontener przywrócony bez zmiennych Jira, `/health` 200.
- ~~Niezweryfikowane: połączenie z prawdziwą Jirą~~ → **zweryfikowane przez użytkownika
  2026-11-08 na produkcji** (Swarm, `JIRA_*` w zmiennych stacka): „Testuj połączenie" działa.

---

## Krok J-2 — Mapowanie aplikacji i wersji na Jirę `[x]`

- [x] Migracja `20261028101500_jira_mapping`: `Application.jiraProjectKey @unique`,
  `Version.jiraVersionId @unique` + `Version.jiraVersionName`
- [x] Klucz projektu na ekranie edycji aplikacji (weryfikacja w Jirze)
- [x] Sekcja „Jira" w edycji wersji (tylko ADMIN), wybór fixVersion z listy projektu
- [x] Odpinanie przy zmianie aplikacji wersji, testy

### Decyzje
- **Jeden projekt Jira = jedna aplikacja** (`@unique` na `jiraProjectKey`, decyzja użytkownika).
  **Jedna wersja Jira = najwyżej jedna wersja Release Hub** (`@unique` na `jiraVersionId`).
  Konflikt → komunikat z nazwą aplikacji/wersji, która już używa projektu/wersji.
- **Dwie osobne akcje ADMIN** w `app/actions/jira.ts`: `setApplicationJiraProject`,
  `setVersionJiraVersion` — oddzielone od `updateApplication`/`updateVersion` (te drugie może
  wołać TESTER, a zapytanie do Jiry nie powinno blokować zwykłej edycji).
- **Klucz projektu:** `zod` (wielkie litery/cyfry/_, od litery, wielkość liter dowolna przy wpisie),
  weryfikacja `GET /rest/api/3/project/{key}`, zapisywany klucz **kanoniczny z Jiry**. 404 →
  „nie istnieje albo konto techniczne go nie widzi". Zmiana/odpięcie klucza **zablokowane**,
  dopóki otwarte wersje aplikacji mają podpiętą wersję Jira (lista nazw w komunikacie).
  Zamknięte wersje zachowują swoje podpięcie (historia).
- **Wybór fixVersion:** lista `GET /rest/api/3/project/{key}/versions` pobierana przy renderze
  strony edycji (tylko dla ADMIN). Pokazywane niewydane i niezarchiwizowane + aktualnie podpięta;
  sortowanie po dacie wydania, potem nazwie (`lib/jira/versions.ts`). **Serwer ponownie pobiera
  listę i sprawdza id** (nie ufa klientowi); wydana/zarchiwizowana → odmowa.
- **Ponowny odczyt w transakcji** (status, projekt aplikacji) — zmiany w trakcie zapytania do Jiry
  nie przejdą. Zmiana logowana w `ChangeLog` (`field: 'jiraVersion'`, nazwy wersji), etykieta
  „wersja Jira" w logu zmian.
- **Odpięcie działa bez Jiry** — gdy lista jest niedostępna, formularz pokazuje tylko aktualną
  wersję i opcję „— niepodpięta —".
- **Zmiana aplikacji wersji w `updateVersion`** czyści `jiraVersionId/Name` i loguje to w tej samej
  transakcji (wersja Jira należy do projektu poprzedniej aplikacji).
- **Migracja przez `prisma migrate diff` + `migrate deploy`** — `migrate dev` odmawia pracy w
  nieinteraktywnym terminalu Claude'a. Nadal plik migracji w repo, nie `db push`.
- `prisma format` wyrównał przy okazji białe znaki w modelu `User` (bez zmian treści).

### Odłożone
- Pokazanie podpiętej wersji Jira poza ekranem edycji (podgląd wersji, dashboard) → J-4.
- Klucz projektu na liście aplikacji w panelu admina — niepotrzebny na razie.
- **Test na prawdziwej Jirze** — czeka na token.

### Jak sprawdzić
- Bez `JIRA_*`: edycja aplikacji → sekcja „Jira" z informacją „nieskonfigurowana", pole wyłączone;
  edycja wersji (ADMIN) → podpowiedź, co ustawić najpierw
- TESTER: edycja wersji bez sekcji „Jira"; akcje mapowania odrzucone serwerowo
- Z tokenem: klucz `abc` → zapisany jako `ABC`; nieistniejący klucz → komunikat; w edycji wersji
  lista fixVersion; ta sama fixVersion na drugiej wersji → odmowa z nazwą pierwszej; zmiana aplikacji
  wersji → podpięcie znika, wpis „wersja Jira" w logu zmian; zmiana klucza aplikacji z podpiętą
  otwartą wersją → odmowa z listą wersji

**Zweryfikowane w tej sesji (testy + przeglądarka + docker):**
- `npx vitest run` → **64/64** (nowy `jira-mapping.test.ts`, 14 testów: filtr/sortowanie wersji,
  walidacja, odmowa PM/TESTER w obu akcjach, blokada zmiany klucza, 404 projektu, kanoniczny klucz,
  obca i wydana wersja odrzucone, zapis + `ChangeLog`, odpięcie bez Jiry, wersja zamknięta).
- `npm run check` czysto; `docker compose up -d --build` → „No pending migrations", Ready.
- Przeglądarka (bez `JIRA_*`): ADMIN — sekcja „Jira" w edycji aplikacji (nieskonfigurowana, pole
  wyłączone) i w edycji wersji `04.01.150` (podpowiedź o kluczu projektu); TESTER — brak sekcji.
- ~~Niezweryfikowane: lista fixVersion i zapis mapowania na prawdziwej Jirze~~ → **zweryfikowane
  przez użytkownika 2026-11-08 na produkcji**: klucz projektu przy aplikacji i wybór fixVersion działają.
- Środowisko: Docker Desktop znów padł na martwym sockecie (`Docker\run`) — przeniesione na bok
  (`*.broken-20261028-*`), zgodnie z wcześniejszą zgodą użytkownika.

---

## Krok D-1 — Wdrożenie (Portainer + Swarm) `[x]`

2026-11-08: zrobione `COOKIE_SECURE`, D-1a, D-1b, D-1c. Zostało pierwsze prawdziwe wdrożenie
po stronie użytkownika (tag `v1.0.0`, upublicznienie pakietu, stack w Portainerze, HAProxy).
Dokumentacja wdrożenia: README → „Wdrożenie (Docker Swarm + Portainer)".

### Ustalenia
- **Docker Swarm zarządzany przez Portainer**, gotowy obraz z `ghcr.io` (Swarm nie buduje
  obrazów — pierwotny pomysł „stack z repo, Portainer buduje" porzucony). Postgres w stacku.
  HTTPS na osobnym HAProxy. Zmienne w „Environment variables" stacka, nie w `.env`.
- **VM ma wychodzący internet** (npm w czasie builda, Jira Cloud). „Brak dostępu z internetu"
  w specyfikacji dotyczy ruchu przychodzącego — aplikacja widoczna tylko w sieci firmowej.
  Założenie „brak internetu w czasie builda" (fonty) było ostrożnością, nie faktem o infrastrukturze;
  zvendorowane fonty zostają.

### Do zrobienia (każde z planem do akceptacji)
- [x] **Flaga `secure` cookie** — przełącznik `COOKIE_SECURE` (decyzja użytkownika 2026-11-08,
  szczegóły niżej). Weryfikacja w Dockerze — patrz „Jak sprawdzić".
- [x] **D-1a Pierwszy admin** — domyślne konto przy starcie na pustej bazie (szczegóły niżej).
- [x] **D-1b Publiczny obraz** — `LICENSE` (MIT), GitHub Actions → `ghcr.io` przy tagu `v*`
  (szczegóły niżej). Upublicznienie repo i pakietu robi użytkownik.
- [x] **D-1c Stack pod Swarma** — `docker-stack.yml` + README (szczegóły niżej).
- [x] **D-1d Po pierwszym wdrożeniu** — przypięcie `app` do noda + ostrzeżenie o HTTP
  przy `secure` cookie (szczegóły niżej).
- Backlog: dedykowany endpoint zdrowia z kodem 503 przy błędzie bazy (healthcheck nie musiałby
  parsować HTML); Swarm secrets (`*_FILE`) zamiast zmiennych z hasłami.
- Backlog uniwersalności: obraz `linux/arm64`, README po angielsku, i18n UI, wstęp `CLAUDE.md` („Wewnętrzna aplikacja
  dla 4 testerów…"), tekst „Zaloguj się firmowym adresem email" na `/login`.

### Decyzje
- **`COOKIE_SECURE` w env** zamiast stałego `NODE_ENV === 'production'`. Jeden helper
  `cookieSecure()` w `lib/auth/cookie.ts` (moduł bez zależności — bezpieczny w Edge), użyty
  w 4 miejscach: `lib/auth/session.ts`, `middleware.ts` (rolling refresh), `app/actions/auth.ts`
  i `app/actions/theme.ts` (cookie motywu). `false`/`true` (bez wielkości liter, z trim) nadpisują;
  puste lub inna wartość → domyślne `secure` w produkcji. Wyłączenie wymaga świadomego `false`.
- Zmienne czytane po nazwie literalnej (`process.env.COOKIE_SECURE`) jako domyślne argumenty —
  testowalne bez mutowania `process.env`.
- `docker-compose.yml`: `COOKIE_SECURE: ${COOKIE_SECURE:-}`; `.env.example` z ostrzeżeniem
  o cookie otwartym tekstem po HTTP.
- **Kierunek projektu (2026-11-08):** narzędzie uniwersalne i publiczne — każda firma może je
  wdrożyć i skonfigurować. Pierwsze wdrożenie: Docker Swarm przez Portainer, HTTPS na zewnętrznym
  HAProxy (`COOKIE_SECURE` puste). Zamiast budowania w Portainerze: publiczny obraz w `ghcr.io`
  z GitHub Actions (D-1b), stack pod Swarma (D-1c).
- **D-1a — domyślny admin (wzorem Grafany).** `instrumentation.ts` (hook Next, tylko runtime
  Node, po `migrate deploy`) woła `ensureInitialAdmin()` z `lib/auth/bootstrap.ts`: gdy tabela
  `User` jest **całkiem pusta** (nieaktywne też się liczą), zakłada ADMIN-a `admin@example.com` /
  `admin` z `mustChangePassword: true` — istniejąca brama wymusza zmianę hasła.
  Login w formie e-maila (decyzja użytkownika) — walidacja logowania bez zmian. Adres
  `admin@example.com` (domena zarezerwowana, RFC 2606), bo `admin@releasehub.local` ma już
  seed, który nie nadpisuje istniejących kont. Wyścig replik → P2002 pomijany. Bez `ChangeLog`
  (jak `createUser`; brak aktora). Log startowy bez hasła. Bez zmian schematu i zależności.
- Seed zostaje narzędziem deweloperskim — wcześniejszy pomysł skryptu admina w obrazie porzucony.
- **D-1b — licencja MIT**, właściciel praw `kacper-es` (decyzja użytkownika). `package.json`
  zostaje `"private": true` (blokuje tylko `npm publish`, nie dotyczy licencji).
- **D-1b — `.github/workflows/release.yml`**: zadanie `test` (Node 22 jak w Dockerfile,
  `npm ci` → `npm run check` → `npx vitest run`) na każdym pushu na `main`, PR i tagu; zadanie
  `image` tylko dla tagów `v*`, po zielonym `test`. Logowanie do ghcr.io wbudowanym
  `GITHUB_TOKEN` (`packages: write` tylko w tym zadaniu, reszta `contents: read`) — zero sekretów.
  Tagi obrazu z `metadata-action`: `X.Y.Z`, `X.Y`, `latest`. Tylko `linux/amd64`; cache warstw `gha`.
  Akcje (zatwierdzone w planie): `actions/checkout@v4`, `actions/setup-node@v4`,
  `docker/setup-buildx-action@v3`, `docker/login-action@v3`, `docker/metadata-action@v5`,
  `docker/build-push-action@v6`.
- **Dockerfile:** etykiety `org.opencontainers.image.source` (łączy pakiet z repo) i `.licenses`.
- **D-1c — osobny `docker-stack.yml`**, `docker-compose.yml` bez zmian (dev: build + port 5432).
  Obraz `ghcr.io/kacper-es/testhub:${RELEASEHUB_VERSION:-latest}`, port `${RELEASEHUB_PORT:-3000}`
  przez routing mesh (cel dla HAProxy). Działa też jako zwykły stack compose (placement ignorowane).
- **Baza przypięta etykietą noda** `node.labels.releasehub.db == true` (wolumen lokalny dla noda);
  bez etykiety `db` czeka „no suitable node" zamiast wstać pusta na innym nodzie. Bez portu,
  `stop_grace_period: 1m`.
- **App:** 1 replika, `restart_policy: any`; `update_config`/`rollback_config` `stop-first`
  (migracje nie biegną obok starej wersji), `failure_action: rollback`. `depends_on` pominięte
  (Swarm ignoruje) — przy starcie przed bazą `P1001` → restart do skutku (opisane w README).
- **Healthcheck app:** `wget` na `/health` + `grep 'OK</p>'` — strona zwraca 200 także przy błędzie
  bazy, a React renderuje „Baza: <!-- -->OK" (pierwsza wersja z `grep 'Baza: OK'` nigdy nie
  przechodziła — wykryte na Swarmie). `start_period: 60s`. Bez zmian kodu (wget jest w obrazie).
- **README:** HAProxy — backend na dowolny nod, TLS na proxy, `X-Forwarded-Proto: https`,
  **bez przepisywania `Host`** (Server Actions porównują `Origin` z `Host`), `COOKIE_SECURE` puste.

- **D-1d — przypięcie `app`** (prośba użytkownika): `node.labels.releasehub.app == true`, osobna
  etykieta (może być na tym samym nodzie co `releasehub.db`); etykiety bazy nie zmieniano, żeby
  nie zatrzymać działającej bazy. Kolejność przy działającym stacku: etykieta → redeploy.
- **D-1d — ostrzeżenie o HTTP.** Zgłoszenie z produkcji: zmiana hasła „nie działa" (powrót na
  `/login` bez komunikatu, `mustChangePassword` bez zmian). Przyczyna: strona po `http://`,
  cookie `secure` odrzucane przez przeglądarkę; ekran zmiany hasła i tak się pokazuje, bo Next
  renderuje cel `redirect()` z akcji logowania w tej samej odpowiedzi (z cookie ustawionym
  w akcji), a dopiero kolejny POST idzie bez cookie → middleware → `/login`.
  Czysta funkcja `secureCookieWillBeDropped(url, secure)` (`lib/auth/insecure-origin.ts`,
  bez zależności): `http:` + `secure` → true; `localhost`/`127.0.0.1`/`[::1]`/`*.localhost`
  zwolnione (przeglądarki akceptują tam `Secure`). Użycie: (1) formularz logowania sprawdza
  `window.location.href` po zamontowaniu (protokół zna tylko przeglądarka; proxy przed aplikacją)
  i pokazuje komunikat (`role="alert"`, tokeny `text-warn-strong`); (2) akcja `login` po
  udanym logowaniu sprawdza nagłówek `Origin` i loguje `console.warn` (bez danych użytkownika).

### Pytania otwarte
- Kopia zapasowa bazy (`pg_dump` z crona na nodzie z etykietą) — poza aplikacją, ktoś musi ją ustawić.

### Jak sprawdzić
- Stack bez etykiet nodów → `db` i `app` „no suitable node"; po etykietach `releasehub.db`
  i `releasehub.app` → `db` 1/1, `app` 1/1 i healthy
- `http://<nod>:3000/login` przy pustym `COOKIE_SECURE` → ostrzeżenie o HTTP na ekranie
  i „Login from http://… over plain HTTP" w logach po zalogowaniu; przez `https://` → brak
- `https://<adres z HAProxy>/health` → „Baza: OK"; port `5432` niedostępny z innej maszyny
- Pusta baza → w logach `app` „Created initial admin account admin@example.com…";
  logowanie `admin@example.com` / `admin` → wymuszona zmiana hasła → dashboard;
  restart nie zakłada drugiego konta
- Push tagu `v1.0.0` → w Actions zielone `test` i `image`; `docker pull ghcr.io/kacper-es/testhub:1.0.0`
  z maszyny bez logowania do ghcr.io działa (pakiet publiczny)
- `COOKIE_SECURE=false`, `http://<host>:3000`: logowanie działa; odpowiedź z middleware
  (`curl -sI -b rh_session=x http://<host>:3000/`) ma `Set-Cookie` **bez** `Secure`
- Ten sam obraz bez `COOKIE_SECURE`: ten sam `curl` → `Set-Cookie` **z** `Secure`
  (dowód, że middleware czyta zmienną w runtime, a nie wkleja jej przy buildzie)

**Zweryfikowane w tej sesji:**
- `npm run check` czysto; `npx vitest run` → **70/70** (nowy `cookie.test.ts`, 6 testów).
- `COOKIE_SECURE=false docker compose up -d --build`: `/health` 200; `curl` z cookie →
  `Set-Cookie: rh_session=…; HttpOnly; SameSite=lax` (bez `Secure`). Przeglądarka:
  logowanie przez `http://localhost:3000` → dashboard, przejście na `/archive` bez wylogowania.
- Ten sam obraz, `docker compose up -d` bez zmiennej (kontener odtworzony, `COOKIE_SECURE` puste):
  ten sam `curl` → `… Secure; HttpOnly; SameSite=lax`. **Middleware czyta zmienną w runtime.**
- **D-1a:** `npm run check` czysto; `npx vitest run` → **74/74** (nowy `bootstrap.test.ts`, 4 testy:
  pusta baza → ADMIN z `mustChangePassword` i hasłem `admin`; istniejące konto → nic; P2002 → nic;
  inny błąd → propagowany). Docker na osobnym projekcie (`-p rh-bootstrap`, pusty wolumen,
  port 3001): 5 migracji → log „Created initial admin account admin@example.com…", w bazie
  1 konto ADMIN z `mustChangePassword`. Przeglądarka: `admin@example.com`/`admin` →
  `/change-password`; wejście na `/` → z powrotem `/change-password`; zmiana hasła → `/login`;
  stare hasło odrzucone, nowe → dashboard. Restart kontenera → brak drugiego konta (1 wpis
  w logu, 1 konto). Projekt testowy usunięty z wolumenem (`down -v`).
- **D-1b:** `actionlint` 1.7.7 (w Dockerze) na workflow → 0 błędów. `npm run check` czysto,
  `npx vitest run` → 74/74 (te same komendy co w CI). `docker build` → etykiety `source`
  i `licenses` obecne w obrazie (obraz testowy usunięty). Próba `npm ci` na czystej kopii
  plików z gita odrzucona przez uprawnienia sesji — pominięta.
- **Niezweryfikowane (D-1b):** przebieg workflow na GitHubie i publikacja w ghcr.io — dopiero
  przy pierwszym tagu użytkownika. Po nim sprawdzić widoczność pakietu
  (Packages → testhub → Package settings → Public).
- **D-1c (lokalny jednowęzłowy Swarm, `docker swarm init`, obraz zbudowany lokalnie jako
  `ghcr.io/kacper-es/testhub:test`, `COOKIE_SECURE=false`):**
  - bez etykiety: `db` Pending „no suitable node (scheduling constraints not satisfied)";
    `app` restartuje się z `P1001: Can't reach database server at db:5432`;
  - po etykiecie: `db` 1/1, migracje, „Created initial admin account…"; pierwsza wersja
    healthchecka nie przechodziła (komentarz Reacta w HTML) → poprawiona, `app` healthy po 15 s;
  - `/health` przez routing mesh na `localhost:3000` OK; port 5432 zamknięty, `db` bez portów;
  - przeglądarka: `admin@example.com`/`admin` → `/change-password`;
  - `db` przeskalowana do 0 → `app` unhealthy po 70 s, Swarm restartuje; `db` z powrotem →
    `app` healthy po 15 s, dane zachowane (1 konto w bazie);
  - sprzątanie: `docker stack rm`, wolumen testowy usunięty, `docker swarm leave --force`,
    obraz testowy usunięty, lokalny stack compose wznowiony.
- **D-1d:** `npm run check` czysto; `npx vitest run` → **79/79** (nowy `insecure-origin.test.ts`,
  5 testów). Lokalny Swarm, `COOKIE_SECURE` puste: tylko etykieta `db` → `app` Pending
  „no suitable node"; po `releasehub.app` → healthy po 15 s. Przeglądarka na
  `http://192.168.8.178:3000/login` (adres LAN) → ostrzeżenie widoczne; logowanie →
  `/change-password`, `document.cookie` puste; zmiana hasła → `/login` bez komunikatu,
  w bazie `mustChangePassword = t` (problem z produkcji odtworzony 1:1); w logach `app`
  „Login from http://192.168.8.178:3000 over plain HTTP…". `http://localhost:3000/login` →
  brak ostrzeżenia. Sprzątanie jak w D-1c, lokalny compose wznowiony.
- **Niezweryfikowane (D-1c):** wielowęzłowy Swarm (przypięcie bazy do innego noda niż app),
  Portainer i HAProxy z HTTPS — dopiero przy wdrożeniu u użytkownika.
- Środowisko: Docker Desktop nie wstawał (martwe sockety w `%LOCALAPPDATA%\Docker\run`
  i `%LOCALAPPDATA%\docker-secrets-engine`, przeniesione na bok jako `*.broken-20261108-*`
  za zgodą użytkownika); naprawił dopiero restart Windows — przy kolejnej awarii zacząć od restartu.

---

## Krok UI-1 — Zwarty widok wersji `[x]`

- [x] Checklista: jedna karta, jeden wiersz na zadanie (~44 px zamiast osobnej karty)
- [x] Tickety Jira: pod Komentarzami, zwinięte (`<details>`), lista przewijana w środku
- [x] Usuwanie wersji przeniesione z podglądu do edycji wersji

### Decyzje

- Opis zadania w dymku (`title`) na nazwie (kropkowane podkreślenie) + `sr-only` dla czytników.
- Kolejność w wierszu: notka źródła → licznik/kropki → status (status zawsze z prawej).
- Tickety: natywne `<details>` bez JS; nagłówek zwinięty pokazuje fixVersion, `x/y gotowych`
  i czas synchronizacji; lista `max-h-[60vh]` z przewijaniem. Stan rozwinięcia przeżywa polling 5 s
  (React nie kontroluje atrybutu `open`). Strzałka bez animacji przy `prefers-reduced-motion`.
- Usuwanie: sekcja na dole edycji wersji (ADMIN). Wersja zamknięta nie ma edycji, więc ADMIN
  widzi w podglądzie przycisk „Usuń wersję…" prowadzący na `/edit`, który dla zamkniętej wersji
  renderuje tylko sekcję usuwania (TESTER nadal dostaje redirect).

### Jak sprawdzić

1. Wersja z 8–10 zadaniami → checklista mieści się na pół ekranu Full HD; najechanie na nazwę
   pokazuje opis.
2. Wersja podpięta do Jiry → „Tickety Jira" pod Komentarzami, zwinięte; po rozwinięciu lista
   przewija się w ramce; po 5 s (polling) sekcja zostaje rozwinięta.
3. Podgląd wersji nie ma sekcji „Usuń wersję"; jest na dole „Edytuj wersję" (ADMIN).
4. Wersja zamknięta, ADMIN → „Usuń wersję…" w nagłówku → strona z samym usuwaniem.

### Zweryfikowane

- Lokalnie (docker): punkty 1–3 (40 testowych ticketów wstawionych ręcznie i usuniętych).
  Punkt 4 niesprawdzony — brak zamkniętej wersji w lokalnej bazie.

---

## Krok UI-2c — Dashboard, listy i reszta stron `[x]`

- [x] `lib/versions/summary.ts` — `summarizeVersion` (zadania z resolveTask, agregaty, T−N, mini oś); karty i KPI z jednego źródła
- [x] Dashboard: pasek KPI (najbliższe wydanie, otwarte wersje, zadania gotowe, po terminie) + karty w 2–3 kolumnach
- [x] `VersionCard`: T−N, mini oś z terminami, mierniki (checklista, kroki instancji, tickety Jira), maks. 4 otwarte zadania wg terminu
- [x] Lista wersji i archiwum w siatce kart; archiwum z wykresem zamkniętych wersji wg miesiąca (12 mies., `monthlyClosed`)
- [x] Wszystkie strony: kontener do 1440 px (formularze 3xl), nagłówki `text-3xl font-bold`; panel admina w 3 kolumnach

### Decyzje

- Karta pokazuje tylko otwarte zadania (najpilniejsze najpierw) — gotowe są w pasku segmentów; „✓ wszystkie
  zadania gotowe", gdy nic nie zostało.
- Miernik „Kroki instancji" liczy zaznaczone kroki (jak kafel w widoku wersji), opis podaje gotowe instancje.
- Wykres archiwum idzie za filtrami (status, aplikacja), miesiąc wg daty wydania.
- Formularze (edycja, nowe rekordy) zostają w jednej kolumnie — wielokolumnowo tylko widoki z danymi.

### Jak sprawdzić

1. Dashboard: KPI zgadzają się z kartami; karta prowadzi do wersji; filtr aplikacji działa.
2. Archiwum z zamkniętymi wersjami → wykres słupkowy wydane/anulowane, filtry zmieniają wykres.
3. Wersje, admin, edycja, logowanie — nowy styl w obu motywach; telefon bez poziomego przewijania.

### Zweryfikowane

- Lokalnie (docker, oba motywy + telefon): punkty 1–3 (do wykresu archiwum jedna wersja tymczasowo
  oznaczona jako wydana w bazie i przywrócona). Testy 166/166.

---

## Krok UI-2b — Widok wersji „Telemetria" `[x]`

- [x] Migracja `20261109150000_jira_snapshots`: model `JiraSnapshot` (dzienny stan ticketów wersji)
- [x] `applyIssueSync` zapisuje stan dnia w tej samej transakcji (ręczna i automatyczna synchronizacja)
- [x] `lib/versions/overview.ts`: `buildTimeline` + `assignLanes`, `buildBurnup`, `burnupPolylines` (czyste, testowane)
- [x] Widok wersji: kafle (T−N, checklista, instancje, tickety), układ 8 + 4 kolumny do 1440 px
- [x] `ReleaseTimeline` — oś do wydania z terminami zadań; `JiraPanel` — statusy, burn-up, zwijana lista;
      `EventLog` — ostatnie 8 wpisów ChangeLog; macierz instancji z kolumną Σ
- [x] `lib/versions/changelog-labels.ts` — etykiety pól wspólne dla logu admina i logu zdarzeń

### Decyzje

- Snapshot: klucz `(versionId, day)`, dzień w strefie Europe/Warsaw; ostatnia synchronizacja dnia
  nadpisuje. Burn-up: ostatnie 14 dni od pierwszego snapshotu, dni bez synchronizacji przenoszą
  poprzednią wartość; wykres od 2 punktów (wcześniej komunikat).
- Oś czasu: zakres od wcześniejszej z (dziś, pierwszy termin) do późniejszej z (wydanie, dziś) — mieści
  zaległe terminy i zaległe wydanie. Etykiety na 4 torach (2 nad, 2 pod osią), min. odstęp 25% osi,
  przy braku miejsca sam romb z podpowiedzią; etykiety przy krawędziach kotwiczone do krawędzi.
- Kolory terminów: daleki termin neutralny (szary), bo limonka oznacza „gotowe"; ostrzeżenie/pilne/po
  terminie bez zmian (reguła 26).
- Log zdarzeń nie pokazuje treści notatek („notatki: zmiana"). Link „cały log" tylko dla ADMIN.
- Prawa kolumna: Jira (gdy wersja podpięta), log zdarzeń, komentarze. Na telefonie wszystko w jednej kolumnie.

### Odłożone

- Burn-up na produkcji zacznie się rysować dopiero po synchronizacjach z dwóch różnych dni.

### Jak sprawdzić

1. Wersja otwarta z terminami → oś czasu z rombami, „dziś" i „release"; kafel T−N w kolorze pilności.
2. Wersja podpięta do Jiry i zsynchronizowana → panel Jira: pasek statusów, liczby, lista ticketów
   (zwinięta). Po synchronizacji następnego dnia → burn-up.
3. Zaznaczenie kroku instancji → wpis w „Log zdarzeń" po odświeżeniu (polling 5 s); Σ w macierzy rośnie.
4. Szerokość telefonu → jedna kolumna, bez poziomego przewijania.

### Zweryfikowane

- Lokalnie (docker, oba motywy + telefon): punkty 1–4 na danych testowych (40 ticketów i 11 snapshotów
  wstawionych ręcznie i usuniętych; data wydania tymczasowo przesunięta i przywrócona). Testy 165/165.

---

## Krok UI-2a — Fundament „Telemetria" `[x]`

Kierunek wybrany z trzech makiet (A · Telemetria): ciemny, sygnałowy, limonkowy akcent,
Space Grotesk + JetBrains Mono, ostre rogi, etykiety mono wersalikami. Kolejne kroki:
UI-2b (widok wersji: kafle, oś czasu, macierz, panel Jira z burn-upem — wymaga tabeli
historii ticketów, zmiana schematu do pokazania), UI-2c (dashboard, archiwum, edycja, admin, logowanie).

- [x] Fonty Space Grotesk + JetBrains Mono (variable, latin + latin-ext) w `public/fonts`, `next/font/local`
- [x] Tokeny w `globals.css` (oba motywy) + nowe: `accent`, `on-accent`, `signal`, `on-pass`, `border-strong`
- [x] Komponenty: Card (znacznik w rogu) + `Eyebrow`, Button, StatusBadge, Input/Field, Checkbox, StepDots
- [x] Boczna kolumna (`AppSidebar`) zamiast górnego paska: nawigacja, otwarte wersje z T−N, motyw, konto
- [x] Zaokrąglenia i aktywne stany ujednolicone w całej aplikacji (`rounded-[3px|4px]`, `bg-accent`)
- [x] `tests/contrast.test.ts` — kontrast tokenów liczony z `globals.css`

### Decyzje

- Fonty dalej vendorowane (build bez internetu), ale teraz z latin-ext — wcześniejsze IBM Plex /
  JetBrains miały tylko latin, polskie znaki szły z fontu systemowego. Dwie rodziny na krój
  (latin, latin-ext) w jednym stosie `font-family`; `adjustFontFallback: false`, bo fallback
  Nexta przechwytywał polskie glify przed plikiem latin-ext.
- Jasny motyw „papier": złamana biel, grafit; akcent to grafitowy przycisk z limonkowym tekstem,
  zielenie przyciemnione do oliwkowych (jasna limonka na jasnym tle nie przechodzi 3:1).
- Kontrast (obie wersje): tekst ≥ 5,3:1, statusy/sygnał/focus/obramowanie kontrolek ≥ 3:1 —
  pilnuje tego test. `--border` (dekoracyjny podział) zostaje słabszy; kontrolki formularzy
  dostały `--border-strong`.
- Focus zostaje niebieski w obu motywach (spec 9.1 — nie może mylić się z pass, a pass to limonka).
- T−N w kolumnie bocznej: maks. 8 najbliższych otwartych wersji, kolor wg progów pilności (reguła 26),
  liczone w layoucie na serwerze. Na telefonie kolumna staje się paskiem u góry, lista wersji ukryta.

### Odłożone

- Wiersze checklisty z ręcznym licznikiem wychodzą poza ekran na telefonie — widok wersji jest
  przebudowywany w UI-2b.

### Jak sprawdzić

1. Dashboard i widok wersji w trzech motywach (Jasny / Ciemny / Systemowy).
2. Polskie znaki (ł, ą, ę) w nagłówkach i etykietach mono w tym samym kroju co reszta.
3. Kolumna boczna: aktywna sekcja podświetlona, otwarte wersje z T−N, link do wersji.
4. Szerokość telefonu → kolumna zamienia się w pasek u góry.

### Zweryfikowane

- Lokalnie (docker): punkty 1–4 (jasny i ciemny; fonty latin-ext ładują się). Testy 155/155.

---

## Krok J-6 + health 503 `[x]`

- [x] `lib/jira/sync-version.ts` — wspólna synchronizacja (przeniesiona z `app/actions/jira.ts`)
- [x] `lib/jira/auto-sync.ts` — timer w procesie, start z `instrumentation.ts`
- [x] Panel admina → Jira: interwał i wynik ostatniego automatycznego przebiegu
- [x] `/health` jako route handler: 200 / 503
- [x] `JIRA_SYNC_INTERVAL_MINUTES` w compose, stacku, `.env.example`, README

### Decyzje

- Timer w procesie aplikacji (nie cron/osobny serwis). Interwał `JIRA_SYNC_INTERVAL_MINUTES`:
  puste = 30, `0` = wyłączona, 1–1440; inna wartość = wyłączona + ostrzeżenie w logu i w panelu.
  Bez skonfigurowanej Jiry timer nie startuje. Pierwszy przebieg minutę po starcie.
- `pg_try_advisory_xact_lock` w transakcji trzymającej tylko blokadę (timeout 30 min) — jeden
  automatyczny przebieg naraz, także przy nakładających się kontenerach. Zajęta blokada = pominięcie.
  Ręczne „Synchronizuj" nie bierze blokady (zbieżny przebieg jest bezpieczny, najwyżej błąd jednej wersji).
- Bez `revalidatePath` w automacie — strony wersji są dynamiczne i odpytywane co 5 s.
- Stan ostatniego przebiegu w pamięci (`globalThis`, bo instrumentation i strony mają osobne
  instancje modułów) — po restarcie „jeszcze się nie odbyła". Bez zapisu w bazie.
- Logi: liczba wersji i błędy per wersja (komunikaty jak w UI, bez sekretów); nieoczekiwany
  wyjątek logowany bez treści.
- `/health` publiczny bez `requireRole` (świadomie: brak danych, tylko stan bazy). Treść nadal
  zawiera `OK</p>`, więc stary healthcheck z grepem działa z nowym obrazem. W `docker-stack.yml`
  healthcheck to teraz sam `wget` (kończy się błędem przy 503).

### Jak sprawdzić

1. Jira skonfigurowana → w logach `Jira auto-sync every 30 min.`, po minucie
   `Jira auto-sync: N version(s), 0 failed.`
2. Panel admina → Jira → „Automatyczna synchronizacja": interwał i „Ostatnio …".
3. `JIRA_SYNC_INTERVAL_MINUTES=0` → panel „Wyłączona"; `abc` → komunikat o błędnej wartości.
4. `curl -i http://localhost:3000/health` → 200; po `docker compose stop db` → 503.

### Zweryfikowane

- Lokalnie (docker, Jira z fikcyjnym adresem i 0 podpiętych wersji, interwał 1 min): punkty 1, 2, 4.
  Testy 126/126. Synchronizacja z prawdziwą Jirą przez timer — do sprawdzenia na produkcji.

---

## Krok V-3 — Odpinanie zadań od wersji `[x]`

- [x] `VersionTask.excludedAt` + migracja `20261109120000_version_task_excluded`
- [x] Akcja `unpinVersionTask` (TESTER/ADMIN, otwarta wersja, `logChange` field `pinned`)
- [x] `addVersionTasks` z `templateId` przywraca odpięte zadanie (stan wraca) zamiast tworzyć nowe
- [x] Edycja wersji → „Zadania": lista przypiętych z „Odepnij"; odpięte w selekcie jako „(odpięte — przywróć)"
- [x] Odpięte zadania pominięte: podgląd wersji, dashboard (karta + status), licznik na liście wersji;
      akcje statusu/liczników odmawiają na odpiętym zadaniu

### Decyzje

- Soft, jak przy instancjach (zero hard delete); status i liczniki zostają w wierszu.
- W przeciwieństwie do odpinania instancji — wpis w `ChangeLog` (`pinned`: tak/nie), bo zmienia
  zakres checklisty wersji.
- „Dodaj wszystkie brakujące" nie przywraca odpiętych — odpięcie było świadome, przywraca się pojedynczo.
- Snapshoty przy zamknięciu wersji obejmują też odpięte zadania (nieszkodliwe, niewidoczne).
- Przy okazji: licznik instancji na liście wersji pomija odpięte instancje (wcześniej liczył wszystkie).

### Jak sprawdzić

1. Edytuj wersję → Zadania → „Odepnij" → zadanie znika z checklisty i z karty na dashboardzie.
2. Select „Dodaj zadanie z szablonu" → „(odpięte — przywróć)" → „Dodaj" → zadanie wraca z poprzednim statusem.
3. Panel administratora → Log zmian → dwa wpisy „przypięte do wersji" (tak → nie, nie → tak).

### Zweryfikowane

- Lokalnie (docker): punkty 1–3; testy 116/116.

---

## Krok J-4 — Tickety w wersji i licznik z Jiry `[x]`

- [x] `lib/versions/ticket-source.ts` — tryb źródła liczb dla `TICKET_AGGREGATE`
- [x] `lib/jira/counts.ts` — liczby z lokalnej kopii, jedno zapytanie dla wielu wersji
- [x] Podgląd wersji: sekcja „Tickety Jira" + zadania licznikowe wg trybu
- [x] Dashboard: status zadań licznikowych z tego samego helpera
- [x] `setTicketCounters` odmawia poza trybem ręcznym

### Decyzje
- **Wariant A** (decyzja użytkownika): każde zadanie `TICKET_AGGREGATE` w wersji liczy całą
  fixVersion (gotowe = kategoria `done` / wszystkie bez `removedAt`). Filtr JQL per szablon
  (wariant B) odłożony.
- **Tryby** (`ticketTaskView`, jedno źródło prawdy dla podglądu, dashboardu i akcji):
  `jira` — wersja podpięta i zsynchronizowana (otwarta lub zamknięta; zamknięte nie są
  synchronizowane, więc liczby zamrożone na ostatniej synchronizacji); `jira-unsynced` — podpięta,
  bez synchronizacji: „—" + „Nie zsynchronizowano z Jirą"; `unmapped` — integracja skonfigurowana,
  wersja otwarta, niepodpięta: „—" + „Niepodpięta do Jira" (jak w ustaleniach planu Jira);
  `manual-edit` — **integracja nieskonfigurowana**, wersja otwarta: ręczne liczniki jak dotąd
  (doprecyzowanie ustaleń — uniwersalność dla firm bez Jiry); `manual-readonly` — zamknięta bez
  danych z Jiry: historyczne wartości ręczne. Kolumny `manualCounter*` bez zmian.
- **`setTicketCounters`** woła ten sam helper i odmawia poza `manual-edit` (komunikat
  „…liczony z Jiry — ręczna zmiana jest wyłączona").
- **Sekcja „Tickety Jira"** (wszystkie role, tylko gdy wersja ma `jiraVersionId`): klucz (link
  `<JIRA_BASE_URL>/browse/<KEY>` gdy integracja skonfigurowana), tytuł, typ, przypisany,
  status jako odznaka wg kategorii (`new` neutral, `indeterminate` warn, `done` pass). Kolejność:
  niegotowe najpierw, potem klucz z sortowaniem numerycznym (ABC-2 przed ABC-10). Nagłówek:
  nazwa wersji Jira · M/N gotowych · czas synchronizacji. Pusty stan i stan „nie synchronizowano".
  Polling 5 s czyta tylko lokalną bazę.
- Bez zmian schematu i zależności.

### Odłożone
- Wariant B: filtr JQL na szablonie (różne liczniki w jednej wersji) — gdy będzie potrzebny.

### Jak sprawdzić
- Wersja podpięta i zsynchronizowana → podgląd: „Tickety Jira" z listą; zadania licznikowe
  „M/N" + „z Jiry", bez pól ręcznych; dashboard: kropki statusu zgodne
- Wyjęty z fixVersion ticket (po synchronizacji) znika z listy i z liczników
- Wersja niepodpięta przy skonfigurowanej Jirze → „—" + „Niepodpięta do Jira"
- Bez `JIRA_*` → ręczne liczniki działają jak przed J-4

**Zweryfikowane w tej sesji:**
- `npm run check` czysto; `npx vitest run` → **110/110** (nowy `ticket-source.test.ts`, 9 testów:
  wszystkie tryby, DONE przy komplecie; akcja: odmowa przy podpiętej wersji i przy
  skonfigurowanej Jirze bez podpięcia, przepuszczenie bez konfiguracji).
- Docker + przeglądarka (bez `JIRA_*`): wersja `04.01.150` podpięta w SQL do fikcyjnej fixVersion
  ze zsynchronizowanymi 4 ticketami (1 z `removedAt`): sekcja „TEST-FAKE · 1/3 gotowych", kolejność
  ABC-2 (In Progress), ABC-10 (To Do), ABC-1 (Done), wyjęty nieobecny; oba zadania licznikowe
  „1/3 · z Jiry", bez pól ręcznych; dashboard — oba zadania z kropką „w trakcie". Wersja `9.9.9`
  (niepodpięta, Jira nieskonfigurowana): 4 pola ręczne, brak sekcji Jira. Dane testowe usunięte.
- **Niezweryfikowane:** na prawdziwej Jirze — linki do ticketów i stan „Niepodpięta do Jira"
  (wymaga skonfigurowanej Jiry) — sprawdzi użytkownik na produkcji.

---

## Krok J-3 — Synchronizacja ticketów z Jiry `[x]`

- [x] Migracja `20261108160000_jira_issues`: model `JiraIssue`, `Version.jiraSyncedAt`
- [x] `lib/jira/issues.ts` (pobieranie z paginacją i 429), `lib/jira/sync.ts` (zapis)
- [x] Akcje `syncVersionJiraIssues`, `syncAllOpenJiraVersions` (ADMIN)
- [x] UI: „Synchronizuj teraz" w sekcji Jira edycji wersji, „Synchronizuj wszystkie otwarte
  wersje" w `/admin/jira`

### Decyzje
- **Pełna synchronizacja wersji zamiast przyrostowej** (zmiana uzgodnionego planu, zaakceptowana
  z planem kroku): zapytanie po `updated` nie widzi ticketu wyjętego z fixVersion, więc licznik
  w J-4 byłby zawyżony. Koszt: 1–3 zapytania po 100 ticketów na wersję.
- **Schemat** (diff pokazany i zaakceptowany): `JiraIssue` (`jiraId` = stałe id z Jiry, `key`,
  `summary`, `issueType`, `statusName`, `statusCategory`, `assigneeName`, `jiraUpdatedAt`,
  `syncedAt`, `removedAt`), `@@unique([versionId, jiraId])`, kaskada z `Version` (V-2 usuwa też
  tickety). `Version.jiraSyncedAt`. Migracja przez `migrate diff` z bazy lokalnej + `migrate
  deploy` (nieinteraktywny terminal), plik w repo. `prisma format` wyrównał relacje w `Version`.
- **Zero hard delete także dla kopii:** ticket nieobecny w wyniku → `removedAt = now`; wraca →
  `removedAt = null`. J-4 pokaże tylko `removedAt IS NULL`.
- **Pobieranie:** `GET /rest/api/3/search/jql`, JQL `fixVersion = <id> ORDER BY key ASC` (id
  sprawdzane jako same cyfry przed wstawieniem do JQL), pola `summary,issuetype,status,assignee,
  updated`, 100 na stronę, `nextPageToken`/`isLast`; limit 50 stron → `TooManyIssuesError`.
  429 → do 3 ponowień, czekanie wg `Retry-After` (bez nagłówka 1/2/4 s, max 30 s); inne błędy
  bez ponawiania. Błędy przez `JiraError` ze stałymi komunikatami (treść Jiry nie przechodzi).
- **Zapis:** najpierw całe pobranie (poza transakcją), potem jedna transakcja: ponowny odczyt
  wersji (otwarta i nadal ta sama fixVersion — inaczej przerwanie), upsert zwróconych,
  `removedAt` dla brakujących, `jiraSyncedAt`. Błąd pobierania = zero zmian. Bez `ChangeLog`
  (dane zewnętrzne, nie zmiana użytkownika).
- **Akcje:** tylko ADMIN; odmowa dla wersji zamkniętej, niepodpiętej i przy braku konfiguracji.
  „Wszystkie" — otwarte wersje z `jiraVersionId`, po kolei, wynik per wersja (błąd jednej nie
  zatrzymuje reszty).
- **UI:** stan „Ostatnia synchronizacja: <data> · N ticketów, M gotowych" liczony na serwerze
  (strefa Europe/Warsaw), przycisk tylko gdy wersja ma podpiętą fixVersion. Lista ticketów → J-4.

### Odłożone
- Wyświetlanie ticketów i licznik z Jiry zamiast ręcznego `TICKET_AGGREGATE` → J-4.
- Automatyczna synchronizacja → J-6.

### Jak sprawdzić
- ADMIN, wersja z podpiętą fixVersion → edycja → „Synchronizuj teraz" → „Zsynchronizowano: N
  ticketów, M gotowych"; N zgadza się z Jirą (filtr `fixVersion = <wersja>`); po odświeżeniu
  „Ostatnia synchronizacja: …"
- Wyjęcie ticketu z fixVersion w Jirze → ponowna synchronizacja → „…, 1 wyjętych z wersji"
- `/admin/jira` → „Synchronizuj wszystkie otwarte wersje" → wynik dla każdej podpiętej wersji
- PM/TESTER: brak przycisków; akcje odrzucone serwerowo

**Zweryfikowane w tej sesji:**
- `npm run check` czysto; `npx vitest run` → **101/101** (nowy `jira-sync.test.ts`, 14 testów:
  mapowanie i wartości domyślne, paginacja po `nextPageToken`, 429 z `Retry-After` → ponowienie,
  429 ponad limit → błąd (4 zapytania), 401 bez ponawiania, nieskończona paginacja →
  `TooManyIssuesError`, nie-liczbowe id nie trafia do JQL, zapis: upsert + przywrócenie +
  `removedAt` + `jiraSyncedAt`; akcje: odmowa PM i TESTER (obie), wersja zamknięta, niepodpięta,
  brak konfiguracji).
- Docker z `JIRA_BASE_URL=https://jira.invalid` + zmyślony token (tylko zmienne powłoki), wersja
  `04.01.150` tymczasowo podpięta w SQL do fikcyjnej fixVersion: edycja → „Tickety nie były
  jeszcze synchronizowane" + „Synchronizuj teraz" → „Błąd sieci — nie udało się połączyć
  z Jirą."; w bazie 0 `JiraIssue`, `jiraSyncedAt` puste; `/admin/jira` → „04.01.150: Błąd
  sieci…"; token w logach: 0 wystąpień. Podpięcie cofnięte, kontener bez zmiennych Jira.
  Pierwszy build padł na `react/no-unescaped-entities` (cudzysłów w tekście) — poprawione.
- ~~Niezweryfikowane: synchronizacja na prawdziwej Jirze~~ → **zweryfikowane przez użytkownika
  2026-11-08 na produkcji**: synchronizacja działa.

---

## Krok V-1 — „Dodaj zadanie z szablonu" (reguła 6) `[x]`

Zgłoszenie z produkcji (2026-11-08): wersja utworzona przed szablonami zadań — nie było jak
dołożyć zadań. Furtka z reguły 6 specyfikacji odłożona w 6a i nigdy niezbudowana.

- [x] Akcja `addVersionTasks` + `addVersionTasksSchema`
- [x] Sekcja „Zadania" na ekranie edycji wersji (`AddVersionTasks`)

### Decyzje
- **Na ekranie edycji** (`/versions/[id]/edit`), obok „Kroki wersji" i „Instancje" — zmiany
  struktury wersji są tam od UI-5. Select „Dodaj zadanie z szablonu" + **„Dodaj wszystkie
  brakujące (N)"** (przypadek ze zgłoszenia). Pusty stan: „Wszystkie aktywne szablony są już
  w tej wersji". Formularze server action bez JS klienta (jak `AttachInstance`).
- **`addVersionTasks`**: TESTER/ADMIN, `zod` (puste `templateId` = wszystkie brakujące); w transakcji
  odczyt statusu → `assertVersionEditable` (tylko `IN_PROGRESS`), aktywne szablony bez
  `VersionTask` w tej wersji, `createMany` z `skipDuplicates`. Wybrany szablon nieaktywny/już
  obecny → błąd. Bez `ChangeLog` (reguła 27 go nie obejmuje — jak „Podepnij instancję").
- Lista brakujących szablonów czyta `TaskTemplate.name` — to katalog, nie efektywne wartości
  zadania wersji, więc `resolveTask` nie dotyczy.

### Jak sprawdzić
- Wersja bez części zadań → edycja → „Zadania": select z brakującymi + „Dodaj wszystkie (N)";
  dodanie jednego → N−1; „Dodaj wszystkie" → „Wszystkie aktywne szablony są już w tej wersji";
  podgląd wersji pokazuje nowe zadania z terminami
- PM: akcja odrzucona serwerowo; wersja zamknięta: odrzucona (edycja i tak przekierowuje)

---

## Krok V-2 — Trwałe usuwanie wersji `[x]`

Prośba użytkownika (2026-11-08): usuwanie wersji jest potrzebne (np. wersja testowa, nazwa
zablokowana przez `@unique` także po anulowaniu). Świadomy wyjątek od „Zero hard delete".

- [x] Akcja `deleteVersion` + `deleteVersionSchema`
- [x] Sekcja „Usuń wersję" w podglądzie wersji (`DeleteVersion`, tylko ADMIN)
- [x] Etykieta „usunięcie wersji" i „(usunięta)" w logu zmian
- [x] Wyjątek w `CLAUDE.md` i w specyfikacji (sekcja integralności)

### Decyzje
- **Miejsce: dół podglądu wersji**, nie ekran edycji (jak planowano) — edycja przekierowuje
  wersje zamknięte, a usuwać trzeba też anulowane/wydane. Widoczne tylko dla ADMIN, każdy status.
  Ramka `border-fail-strong`, przycisk `danger`.
- **Potwierdzenie nazwą:** przycisk aktywny po wpisaniu dokładnej nazwy (klient), serwer
  porównuje ponownie (po `trim`). Niezgodność → komunikat, nic nie usunięte.
- **`deleteVersion`**: `requireRole(['ADMIN'])`, `zod`; w jednej transakcji: odczyt nazwy →
  `logChange` (`entityType: 'Version'`, `field: 'deleted'`, `oldValue` = nazwa, `versionId: null`)
  → `version.delete`. Zadania, runy instancji (z notatkami i wartościami), komentarze i kroki
  wersji znikają kaskadą (`onDelete: Cascade` w schemacie — bez zmian schematu). `ChangeLog` nie
  ma FK do `Version`, więc starsze wpisy zostają; w logu zmian kolumna wersji pokazuje dla nich
  „(usunięta)". Zwolnione: nazwa (`@unique`) i ewentualna wersja Jira (`jiraVersionId @unique`).
- Przekierowanie na `/versions`, `revalidatePath` dla list, dashboardu, archiwum i logu zmian.

### Jak sprawdzić
- ADMIN, podgląd dowolnej wersji → „Usuń wersję"; niepełna nazwa → przycisk nieaktywny;
  pełna → usunięcie, przekierowanie na `/versions`
- Log zmian: „usunięcie wersji · <nazwa> → —"; starsze wpisy tej wersji z „(usunięta)"
- Nowa wersja o tej samej nazwie tworzy się bez błędu
- TESTER/PM: brak sekcji; akcja odrzucona serwerowo

**Zweryfikowane w tej sesji (V-1 + V-2):**
- `npm run check` czysto; `npx vitest run` → **87/87** (nowy `version-structure.test.ts`, 8 testów:
  V-1 — odmowa PM, wersja zamknięta, „dodaj wszystkie" = tylko aktywne brakujące + `skipDuplicates`,
  pojedynczy nieaktywny/obecny → błąd; V-2 — odmowa PM i TESTER, niezgodna nazwa → nic,
  zgodna → `ChangeLog` + `delete` + redirect).
- Docker (`docker compose up -d --build`) + przeglądarka jako ADMIN: wersja `V-TEST-1` (6 zadań),
  3 zadania usunięte w SQL (symulacja szablonów dodanych później) → „Dodaj wszystkie brakujące (3)";
  dodanie jednego → (2), 4 zadania; „Dodaj wszystkie" → 6 zadań, pusty stan; podgląd: 6 zadań
  z terminami. Przed usunięciem dodany komentarz i wpis `ChangeLog` (SQL). „V-TEST" → przycisk
  nieaktywny, „V-TEST-1" → aktywny; usunięcie → `/versions`; w bazie 0 wersji/zadań/runów/
  komentarzy/kroków; log zmian: „usunięcie wersji V-TEST-1 → —" i „(usunięta) data wydania…";
  ponowne utworzenie `V-TEST-1` bez błędu. Dane testowe usunięte z lokalnej bazy.
- **Niezweryfikowane w przeglądarce:** widok TESTER/PM (brak sekcji) — pokryte testami akcji
  i warunkiem `user.role === 'ADMIN'` w stronie.

---

## Backlog (po MVP)

- **Rozbudowa kont, ról i uprawnień.** Na razie zostają 3 role (TESTER/PM/ADMIN), a integracją
  Jira zarządza wyłącznie ADMIN. Później: bardziej granularne uprawnienia (np. kto może
  synchronizować Jirę, zarządzać mapowaniem, katalogami) — do zaprojektowania osobno.

---

## Krok 11 — SSE (opcjonalny, po MVP) `[ ]`

- [ ] `NOTIFY` z server actions, klient `pg` z `LISTEN`
- [ ] Route handler `text/event-stream`, `X-Accel-Buffering: no`
- [ ] `EventSource` w kliencie zamiast interwału

### Decyzje
### Odłożone
### Jak sprawdzić
