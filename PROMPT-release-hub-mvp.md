# Release Hub — MVP. Prompt startowy dla Claude Code

## 0. Jak pracujemy (przeczytaj to pierwsze)

Zanim napiszesz jakikolwiek kod:

1. Przeczytaj `CLAUDE.md` i `PROGRESS.md` w rootcie repo.
2. Ustal, który krok z sekcji 12 jest następny.
3. Przedstaw plan tego **jednego** kroku i zatrzymaj się na moje potwierdzenie.

Zasady na całą współpracę:

- **Jeden krok = jedna sesja.** Nie łącz kroków, nawet jeśli wydaje się to szybsze. Jeśli uważasz, że dwa kroki trzeba połączyć — powiedz dlaczego i zapytaj.
- Po zakończeniu kroku: zaktualizuj `PROGRESS.md` (sekcje `Decyzje`, `Odłożone`, `Jak sprawdzić`) i zatrzymaj się. Nie zaczynaj następnego kroku sam.
- **Definition of done** dla każdego kroku: `npm run check` przechodzi bez błędów, `docker compose up` startuje bez błędów, i podałeś mi listę kroków manualnej weryfikacji.
- Nie dodawaj żadnej zależności bez zapytania. Nie zmieniaj `schema.prisma` bez pokazania mi diffa.
- Jeśli w trakcie kroku natkniesz się na decyzję, której nie ma w tym prompcie — **zapytaj**, nie wybieraj domyślnej. Wszystkie znane mi decyzje są tu rozstrzygnięte, więc luka oznacza, że coś przeoczyliśmy.
- Komunikaty w UI po polsku. Kod, nazwy zmiennych, komentarze i commity po angielsku.

---

## 1. Kontekst projektu

Wewnętrzna aplikacja webowa dla **4 testerów QA i 3 product managerów** (7 użytkowników, firmowy VM, brak dostępu z internetu). Centralizuje przygotowanie wydań: checklisty przed-wydaniowe, status środowisk testowych, widok postępu wszystkich przygotowywanych wersji.

Zastępuje dwa arkusze Excel:
1. Katalog instancji/środowisk z ich kluczowymi funkcjonalnościami → model `Instance`
2. Lista instancji z postępem testów (4 flagi) → model `InstanceTestRun`

### Poza zakresem MVP — nie buduj rusztowania

- integracja z Jira API (przyszły etap, read-only)
- baza wiedzy / dokumentacja procesów
- powiadomienia email i Slack
- reset hasła mailem (brak SMTP)
- kopie zapasowe (będzie `pg_dump` z volume'a, poza aplikacją)
- eksport do PDF/Excel

Nie zostawiaj pustych folderów, interfejsów ani „TODO: Jira" pod te funkcje.

---

## 2. Stack

- **Next.js (App Router) + TypeScript**
- **PostgreSQL 16 + Prisma**
- **Auth:** własne sesje w bazie, cookie-based, hasła przez bcrypt. Bez zewnętrznych providerów, bez NextAuth.
- **Tailwind CSS** (tokeny wg sekcji 9, zero surowych `gray-*` w komponentach)
- **Mutacje:** Server Actions, nie route handlery. Walidacja wejścia przez `zod` w każdej akcji.
- **Docker:** jeden `docker-compose.yml` (app + postgres), `docker compose up` uruchamia całość lokalnie i na serwerze
- **Testy:** Vitest, minimalny zakres wg sekcji 12

---

## 3. Model danych

Docelowy `schema.prisma`. Odstępstwa uzgadniaj ze mną.

```prisma
enum Role          { TESTER PM ADMIN }
enum Theme         { LIGHT DARK SYSTEM }
enum VersionStatus { IN_PROGRESS RELEASED CANCELLED }
enum TaskType      { CHECKBOX TICKET_AGGREGATE INSTANCE_AGGREGATE }
enum DeadlineType  { FLEXIBLE DAYS_BEFORE_RELEASE }
enum TaskStatus    { NOT_STARTED IN_PROGRESS DONE }

model User {
  id                 String   @id @default(cuid())
  email              String   @unique          // login
  passwordHash       String
  name               String
  role               Role
  isActive           Boolean  @default(true)   // odejście z firmy — nie usuwamy
  mustChangePassword Boolean  @default(true)
  theme              Theme    @default(SYSTEM)
  createdAt          DateTime @default(now())

  sessions           Session[]
  // relacje odwrotne: createdVersions, statusChangedVersions, completedTasks,
  // updatedTestRuns, comments, changeLogs
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}

model Version {
  id                String        @id @default(cuid())
  name              String        @unique       // "2.4.1"
  releaseDate        DateTime      @db.Date     // data-only, świadomie
  status            VersionStatus @default(IN_PROGRESS)
  createdById       String
  statusChangedById String?                     // kto zamknął/anulował
  statusChangedAt   DateTime?
  cancelReason      String?                     // wymagany przy CANCELLED
  createdAt         DateTime      @default(now())

  tasks     VersionTask[]
  testRuns  InstanceTestRun[]
  comments  VersionComment[]

  @@index([status, releaseDate])
}

model TaskTemplate {
  id                String       @id @default(cuid())
  name              String                       // "Release notes dla klienta"
  description       String?                      // dłuższa instrukcja
  taskType          TaskType                     // NIEZMIENNY po utworzeniu
  deadlineType      DeadlineType
  daysBeforeRelease Int?                         // tylko dla DAYS_BEFORE_RELEASE
  sortOrder         Int
  isActive          Boolean      @default(true)
  createdAt         DateTime     @default(now())

  versionTasks VersionTask[]
}

model VersionTask {
  id             String     @id @default(cuid())
  versionId      String
  taskTemplateId String                          // onDelete: Restrict
  status         TaskStatus @default(NOT_STARTED)

  manualCounterCurrent Int @default(0)           // tylko TICKET_AGGREGATE
  manualCounterTotal   Int @default(0)

  completedById String?
  completedAt   DateTime?
  updatedAt     DateTime  @updatedAt

  // SNAPSHOT — null dopóki wersja jest IN_PROGRESS.
  // Zapisywany w transakcji przy przejściu na RELEASED/CANCELLED.
  nameSnapshot              String?
  descriptionSnapshot       String?
  taskTypeSnapshot          TaskType?
  deadlineTypeSnapshot      DeadlineType?
  daysBeforeReleaseSnapshot Int?
  sortOrderSnapshot         Int?

  @@unique([versionId, taskTemplateId])
}

model Instance {
  id                 String   @id @default(cuid())
  name               String                     // "Klient A — produkcja-mirror"
  clientName         String?                    // opcjonalny (środowiska wewnętrzne)
  keyFunctionalities String                     // wolny tekst
  isActive           Boolean  @default(true)
  createdAt          DateTime @default(now())

  testRuns InstanceTestRun[]
}

model InstanceTestRun {
  id         String @id @default(cuid())
  versionId  String
  instanceId String

  environmentRestored Boolean @default(false)   // "środowisko odtworzone z proda"
  dbScriptsInstalled  Boolean @default(false)   // "skrypty bazodanowe zainstalowane"
  backendUpdated      Boolean @default(false)   // "backend podbity"
  testsCompleted      Boolean @default(false)   // "testy wykonane"

  notes       String?
  excludedAt  DateTime?                         // odpięcie BEZ utraty danych
  updatedAt   DateTime  @updatedAt
  updatedById String?

  @@unique([versionId, instanceId])
  @@index([versionId, excludedAt])
}

model VersionComment {
  id        String   @id @default(cuid())
  versionId String
  authorId  String
  content   String
  createdAt DateTime @default(now())

  @@index([versionId, createdAt])
}

model ChangeLog {
  id         String   @id @default(cuid())
  entityType String                             // "InstanceTestRun" | "VersionTask"
  entityId   String
  versionId  String?                            // denormalizacja pod filtrowanie
  field      String                             // "backendUpdated" | "status" | ...
  oldValue   String?
  newValue   String?
  userId     String
  createdAt  DateTime @default(now())

  @@index([versionId, createdAt])
  @@index([entityType, entityId, field, createdAt])
}
```

### Reguły integralności

- **Zero hard delete w całej aplikacji.** Wszystkie relacje do `User` mają `onDelete: Restrict`. Dezaktywacja przez `isActive`. Nie generuj żadnej akcji `delete` poza `Session`.
- Relacje do `Version` (`tasks`, `testRuns`, `comments`) mogą mieć `onDelete: Cascade`, ale nie buduj UI do usuwania wersji.

---

## 4. Reguły biznesowe

Każdy punkt jest rozstrzygnięty — nie wymyślaj alternatyw.

### 4.1 Tworzenie wersji

1. Nazwa unikalna. Walidacja z komunikatem „Wersja 2.4.1 już istnieje", nie surowy błąd Prismy.
2. Tworzone w **jednej transakcji**: `Version` + `VersionTask` dla wszystkich `TaskTemplate.isActive = true` + `InstanceTestRun` dla wszystkich `Instance.isActive = true`.
3. `releaseDate` może być w przeszłości (backfill starych wydań) — ostrzeż w UI, nie blokuj.

### 4.2 Szablony a istniejące wersje

4. Edycja `TaskTemplate` (nazwa, opis, `daysBeforeRelease`, `sortOrder`) **działa na żywo** we wszystkich wersjach `IN_PROGRESS`. Wersje `RELEASED`/`CANCELLED` są zamrożone i czytają wyłącznie pola `*Snapshot`.
5. Zbiór zadań w wersji jest **zamrożony w chwili utworzenia**. Nowy `TaskTemplate` nie dosypuje się do trwających wersji.
6. Furtka: przycisk „Dodaj zadanie z szablonu" w widoku wersji (TESTER/ADMIN) — lista aktywnych szablonów jeszcze nieobecnych w tej wersji.
7. `taskType` jest **niezmienny** po utworzeniu szablonu. UI blokuje edycję tego pola z podpowiedzią „dezaktywuj szablon i utwórz nowy".
8. Dezaktywacja szablonu: nie pojawia się w nowych wersjach, istniejące `VersionTask` zostają widoczne i edytowalne.
9. Jeden wspólny helper czyta efektywne wartości zadania:
   `resolveTask(versionTask, template, versionStatus)` → jeśli wersja zamknięta, bierze `*Snapshot`, inaczej z `template`. **Nigdy nie czytaj tych pól bezpośrednio w komponentach.**

### 4.3 Zamykanie wersji

10. Przejście na `RELEASED`/`CANCELLED` w jednej transakcji: zapis wszystkich pól `*Snapshot` we wszystkich `VersionTask` tej wersji + `statusChangedById` + `statusChangedAt`.
11. `CANCELLED` wymaga `cancelReason` (niepuste).
12. Wersja zamknięta jest **read-only wymuszone po stronie serwera**: każda server action mutująca `VersionTask`, `InstanceTestRun` lub dodająca komentarz odrzuca żądanie, jeśli wersja nie jest `IN_PROGRESS`.
13. Ponowne otwarcie (`→ IN_PROGRESS`) może tylko ADMIN. Czyści pola `*Snapshot` i zapisuje `statusChangedById`/`statusChangedAt`.

### 4.4 Trzy typy zadań

14. `CHECKBOX` — ręczne `NOT_STARTED` ⇄ `IN_PROGRESS` ⇄ `DONE`.
15. `TICKET_AGGREGATE` — ręczne `manualCounterCurrent/Total`. Walidacja `0 ≤ current ≤ total`. Status **wyliczany**: `DONE` gdy `current >= total && total > 0`, `IN_PROGRESS` gdy `current > 0`, inaczej `NOT_STARTED`. Przy `total = 0` wyświetlaj `—`, nigdy `0/0` ani dzielenia przez zero.
16. `INSTANCE_AGGREGATE` — status **zawsze wyliczany**, pole `status` w bazie ignorowane, UI nieklikalny (kursor `default`, brak hovera):
    - mianownik = liczba `InstanceTestRun` tej wersji z `excludedAt = null`
    - licznik = te z wszystkimi 4 flagami `true`
    - `DONE` gdy licznik = mianownik i mianownik > 0; `IN_PROGRESS` gdy licznik > 0 lub jakakolwiek flaga gdziekolwiek `true`; inaczej `NOT_STARTED`
17. Zdjęcie `DONE` czyści `completedById` i `completedAt`. Ustawienie `DONE` je zapisuje.

### 4.5 Instancje w wersji

18. Odpięcie instancji = `excludedAt = now()`. **Nigdy `delete`.** Notatki i flagi zostają i wracają po ponownym podpięciu (`excludedAt = null`).
19. Odpięte instancje nie liczą się do `INSTANCE_AGGREGATE` ani do licznika na dashboardzie.
20. Nowa `Instance` nie dopina się sama do trwających wersji. Przycisk „Podepnij instancję" w widoku wersji pokazuje aktywne instancje nieobecne w tej wersji (lub odpięte, z adnotacją „były dane").
21. Każdy z 4 checkboxów to **osobna server action na jedno pole** — dwie osoby klikające różne flagi w tym samym wierszu nie nadpisują się wzajemnie.

### 4.6 Daty i deadline'y

22. `releaseDate` i deadline'y zadań to wartości **date-only**. Arytmetyka na datach bez czasu jest wolna od problemów ze strefą — jedyne miejsce wymagające strefy `Europe/Warsaw` to ustalenie „dzisiaj".
23. `deadline zadania = releaseDate − daysBeforeRelease dni`. Bez pomijania weekendów i świąt.
24. `deadlineType = FLEXIBLE` → brak deadline'u, wyświetlaj „elastyczny", nie pustą komórkę.
25. „Ile dni zostało" liczone **wyłącznie po stronie serwera**. Nigdy `new Date()` w komponencie klienckim do tego celu — inaczej wynik zależy od zegara przeglądarki.
26. Progi pilności (użyj dokładnie tych): `> 7 dni` zielony · `3–7 dni` żółty · `< 3 dni` czerwony · po terminie czerwony + wyraźny znacznik „po terminie".

### 4.7 Log zmian

27. Logujemy: 4 flagi i `notes` w `InstanceTestRun`, oraz `status`, `manualCounterCurrent`, `manualCounterTotal` w `VersionTask`. Nic więcej.
28. Zapis **w tej samej transakcji co mutacja**, przez jeden helper `logChange(tx, {...})`. Nie rozsypuj tego po plikach.
29. Pola `updatedById` / `completedById` zostają obok logu — to cache „kto tknął ostatni" do taniego renderu, log jest historią.
30. Zmiany statusu wersji **nie** idą do logu — mają dedykowane pola `statusChanged*` i `cancelReason`.
31. Brak retencji/czyszczenia logu w MVP.

---

## 5. Uprawnienia

| Akcja | TESTER | PM | ADMIN |
|---|---|---|---|
| Przeglądanie wszystkiego | ✅ | ✅ | ✅ |
| Tworzenie/edycja wersji, zmiana statusu | ✅ | ❌ | ✅ |
| Ponowne otwarcie zamkniętej wersji | ❌ | ❌ | ✅ |
| Odhaczanie zadań, liczniki | ✅ | ❌ | ✅ |
| Edycja `Instance` i `InstanceTestRun`, pod/odpinanie | ✅ | ❌ | ✅ |
| Dodawanie komentarzy | ✅ | ❌ | ✅ |
| Zarządzanie `TaskTemplate` | ❌ | ❌ | ✅ |
| Zarządzanie kontami | ❌ | ❌ | ✅ |
| Widok logu zmian | ❌ | ❌ | ✅ |

PM jest **pełnym read-only** — nie dodaje nawet komentarzy.

### Wymóg nienegocjowalny

Autoryzacja wymuszana po stronie serwera w **każdej** server action i route handlerze, przez wspólny helper:

```ts
const user = await requireRole(['TESTER', 'ADMIN'])
```

Ukrycie przycisku w UI **nie jest autoryzacją**. PM z otwartymi DevToolsami nie może wykonać żadnej mutacji. Warunkowe renderowanie jest wyłącznie kosmetyką na wierzchu wymuszenia serwerowego.

---

## 6. Auth

- Sesje w tabeli `Session`, identyfikator w cookie: `httpOnly`, `sameSite: 'lax'`, `secure` w produkcji, `maxAge` 8 h z rolling refresh przy aktywności.
- bcrypt cost 12.
- Rate limit logowania: 5 prób / 15 min per email, licznik w pamięci procesu (jeden kontener, wystarczy).
- Brak rejestracji. ADMIN tworzy konto z hasłem tymczasowym → `mustChangePassword = true` → middleware przekierowuje na `/change-password` i blokuje resztę aplikacji do zmiany.
- Brak resetu mailowego. ADMIN ustawia nowe hasło ręcznie w panelu.
- Zmiana hasła oraz `isActive = false` **usuwają wszystkie sesje** danego użytkownika.
- Logowanie odrzuca `isActive = false` z neutralnym komunikatem (bez ujawniania, czy konto istnieje).

---

## 7. Live updates (polling)

MVP: polling. SSE jest osobnym, późniejszym krokiem 11 — **nie buduj go teraz**.

- Na dashboardzie i w widoku szczegółowym wersji: `setInterval` co **5 s** wołający `router.refresh()`. Cała reszta zostaje Server Components, bez duplikowania stanu w kliencie.
- Pauzuj interwał gdy `document.hidden`. Na `visibilitychange → widoczna` wywołaj `refresh()` natychmiast.
- **Ochrona przed nadpisaniem tego, co ktoś pisze** (krytyczne — bez tego pole `notes` zeruje się w trakcie pisania):
  - `notes` to komponent kliencki z własnym stanem
  - dopóki pole ma focus **albo** stan jest „dirty", przychodzące dane z serwera są ignorowane
  - zapis debounce 800 ms + widoczny wskaźnik („zapisywanie…" / „zapisano")
  - po udanym zapisie stan przestaje być dirty i pole znów przyjmuje dane z serwera
- Checkboxy nie potrzebują ochrony — są per-pole i idempotentne.
- Jeden hook `useLivePolling(intervalMs)` w jednym miejscu, nie kopiowany po stronach.

---

## 8. Widoki

1. **`/login`** — email + hasło. `/change-password` przy `mustChangePassword`.
2. **`/` — dashboard** — karty wersji `IN_PROGRESS`, sortowane po `releaseDate`:
   - nazwa, data wydania, „za N dni" w kolorze wg progów (p. 26)
   - checklista z sygnaturowym wskaźnikiem statusu i deadline'em zadania
   - skrócony status instancji („3/5 instancji gotowych"), bez odpiętych
3. **`/versions/[id]`** — pełna checklista (edytowalna dla TESTER/ADMIN, logika 3 typów zadań), tabela instancji z 4 checkboxami i notatkami, pod/odpinanie instancji, „Dodaj zadanie z szablonu", sekcja komentarzy, przy zamkniętej wersji baner „Wersja zamknięta — tylko do odczytu" i wyłączone kontrolki.
   - **Tooltip przy każdej fladze:** hover i focus pokazują ostatnią zmianę tej konkretnej flagi — „backend podbity: Marek, wt 14:20". Dane z `ChangeLog`.
   - Pobierz je **jednym zapytaniem na całą stronę**: `SELECT DISTINCT ON (entity_id, field) ... ORDER BY entity_id, field, created_at DESC` przez `$queryRaw`. Nie rób zapytania per flaga — 20 instancji × 4 flagi = 80 zapytań.
4. **`/archive`** — wersje `RELEASED` **i** `CANCELLED`, z filtrem po statusie. Klikalne do widoku szczegółowego (read-only). Przy `CANCELLED` pokaż `cancelReason` i kto anulował.
5. **`/instances`** — CRUD `Instance` (bez delete, tylko `isActive`).
6. **`/admin`** (tylko ADMIN) — zarządzanie `TaskTemplate` (dodawanie, edycja, dezaktywacja, kolejność), zarządzanie kontami (tworzenie, reset hasła, `isActive`, zmiana roli).
7. **`/admin/changelog`** (tylko ADMIN) — log zmian z filtrami: wersja, użytkownik, typ encji, zakres dat. Paginacja.
8. **`/design`** — galeria komponentów bazowych w obu motywach (krok 4,5). Zostaje w repo jako żywa dokumentacja.

---

## 9. Styl wizualny

Dashboard QA wprost. Materiał źródłowy to słownik testera: pass / fail / blocked / pending, środowisko, build, gotowość do wydania. **Bez metafor z innych dziedzin** — nie lotnisko, nie sport, nie motoryzacja.

Charakter „zabawny/ludzki" osiągany przez **kolor, mikro-animacje i ton tekstu**, nie przez ozdobne ikony.

Zakazane domyślne estetyki: kremowe tło + serif + terracotta (`#D97757`); czarne tło + jeden neon; gazetowy układ z cienkimi liniami jako jedyna stylistyka.

### 9.1 Tokeny — jeden plik CSS variables + mapowanie w `tailwind.config`

**Zero surowych klas Tailwinda `gray-*`, `green-*`, `red-*` w komponentach.** Wszystko przez tokeny.

Kolory bazowe (wypełnienia, obramowania, kropki wskaźnika):

| Token | Wartość | Zastosowanie |
|---|---|---|
| `--status-pass` | `#2FA36B` | gotowe / pass |
| `--status-warn` | `#D9A404` | w trakcie / blocked |
| `--status-fail` | `#D9483D` | fail / pilne |

**Te trzy kolory nie nadają się na tekst na jasnym tle.** Sprawdzone wobec `#FAFAF7`: żółty ≈ 1,9:1, zielony ≈ 3,2:1, czerwony ≈ 4,2:1 — poniżej progu 4,5:1. Potrzebne osobne warianty tekstowe:

| Token | Motyw jasny | Motyw ciemny |
|---|---|---|
| `--text-pass` | `#1E7A4C` (≈5,2:1) | `#2FA36B` (≈5,8:1) |
| `--text-warn` | `#8A6300` (≈4,9:1) | `#D9A404` (≈8,2:1) |
| `--text-fail` | `#B03227` (≈6,1:1) | `#E8695E` (≈5,9:1) |

Powierzchnie i tekst:

| Token | Jasny | Ciemny |
|---|---|---|
| `--bg` | `#FAFAF7` | `#12151C` |
| `--surface` | `#FFFFFF` | `#171B24` |
| `--surface-raised` | `#F2F2EE` | `#1E2430` |
| `--border` | `#DFDFD8` | `#2A3140` |
| `--text` | `#1A1D24` | `#E6E9EF` |
| `--text-muted` | `#5C6370` | `#98A1B0` |
| `--focus` | `#1F5FBF` | `#7FB2FF` |

Kontrasty policzyłem, ale **zweryfikuj narzędziem** i popraw, jeśli coś wypada poniżej 4,5:1 dla tekstu i 3:1 dla elementów UI. Kolor focusa jest świadomie niebieski — nie może być konfundowany ze statusem pass/fail.

### 9.2 Typografia

- **JetBrains Mono** — dane liczbowe, statusy, liczniki `X/Y`, nazwy wersji, daty. Testerzy czytają logi i konsole, więc to wybór naturalny, nie ozdobny.
- **IBM Plex Sans** — nagłówki i treść.
- **Uwaga wdrożeniowa:** `next/font/google` pobiera fonty w czasie **builda**. Firmowy VM może budować obraz bez dostępu do internetu. Zvenduruj pliki `.woff2` do repo (`/public/fonts`) i użyj `next/font/local`. Załóż brak internetu w czasie builda.

### 9.3 Element sygnaturowy

Wskaźnik statusu checklisty jako **rząd kwadratów/kropek** — jeden na krok lub ticket — wypełniających się kolorem stopniowo. Nawiązanie do statusów z CI i test runnerów, **nie** gradientowy pasek postępu. Jeden komponent `StepDots`, używany na dashboardzie, w widoku wersji i w archiwum. Przy dużym `total` (np. 200 ticketów) grupuj — nie renderuj 200 kropek.

### 9.4 Mikro-animacje i dostępność

- Checkbox „wskakujący" na zielono po odhaczeniu (krótki scale + zmiana koloru), kropki wskaźnika wypełniające się z małym opóźnieniem kaskadowym.
- **Wszystkie animacje respektują `@media (prefers-reduced-motion: reduce)`** — wyłączone, nie skrócone.
- Widoczny focus ring na każdym elemencie interaktywnym, obsługa `Tab`/`Space`/`Enter` na checkboxach.
- Responsywność: dashboard bywa oglądany na telefonie przez PM. Tabela instancji na wąskim ekranie przechodzi w karty, nie w poziomy scroll.
- Przełącznik jasny/ciemny zapisywany w `User.theme` (źródło prawdy) **oraz** w cookie `theme` czytanym w server layoucie i wstawianym jako klasa na `<html>`. Bez tego każde wejście mrugnie jasnym tłem. `SYSTEM` = `prefers-color-scheme`.

### 9.5 Ton tekstu

Puste stany bezpośrednie i pomocne: „Brak wersji w przygotowaniu — dodaj pierwszą", nie „No data available". Obsłuż też przypadki brzegowe: wersja bez żadnego zadania (brak aktywnych szablonów), wersja bez podpiętych instancji, deadline zadania już minął w chwili utworzenia wersji, log zmian bez wyników filtra.

---

## 10. Docker

- `output: 'standalone'` w `next.config`, multi-stage build na `node:22-alpine`.
- Entrypoint aplikacji: `prisma migrate deploy` przed startem. **Nigdy `db push`** w żadnym środowisku.
- Postgres z `healthcheck` (`pg_isready`) i `depends_on: condition: service_healthy`.
- Named volume na dane Postgresa.
- `.env.example` w repo, `.env` w `.gitignore`. `SESSION_SECRET`, `POSTGRES_PASSWORD`, `DATABASE_URL` z env, bez wartości domyślnych w kodzie.
- Kontener działa jako user non-root.
- Seed **idempotentny** (`upsert`), uruchamiany osobną komendą (`npm run seed`), nie w entrypoincie.
- `npm run check` = `tsc --noEmit && next lint`.

---

## 11. Migracja z Excela

Skrypt `scripts/import-instances.ts` czytający CSV o nagłówkach `name,clientName,keyFunctionalities` → `upsert` po `name`. Uruchamiany komendą, z podsumowaniem („dodano 12, zaktualizowano 3, pominięto 1 z powodu…"). Bez UI do importu.

---

## 12. Kolejność budowy

Buduj po jednym kroku, z zatrzymaniem na weryfikację.

| # | Krok | Zawartość |
|---|---|---|
| 1 | Setup | Next.js + TS + Tailwind + Prisma + docker-compose wg sekcji 10. Weryfikacja: `docker compose up` → strona startowa, połączenie z bazą działa |
| 2 | Schema | Cały `schema.prisma` z sekcji 3 + pierwsza migracja. Pokaż mi diff przed migracją |
| 3a | Sesje | Login, logout, tabela `Session`, cookie, `/change-password` przy `mustChangePassword` |
| 3b | Autoryzacja | `requireRole()`, middleware, unieważnianie sesji. **Test: PM dostaje 403 z server action** |
| 4 | Seed | 1 ADMIN, 2 TESTER, 1 PM (`mustChangePassword: false`, hasła w README), 6 `TaskTemplate` (po dwa każdego typu), 5 `Instance` (w tym jedna bez `clientName`) |
| 4,5 | **Fundament wizualny** | Tokeny (oba motywy) + `tailwind.config` + przełącznik motywu z zapisem do DB i cookie + komponenty: `Button`, `Card`, `StatusBadge`, `Checkbox` (z animacją), `StepDots`, `DataTable`. Strona `/design` z galerią w obu motywach. **Zatrzymaj się i pokaż mi ją przed krokiem 5** |
| 5 | CRUD wersji | Tworzenie w transakcji (p. 2), helper `logChange`, helper `resolveTask`, zmiana statusu z zamrażaniem snapshotów |
| 6a | Checkosta | Pełna checklista: 3 typy zadań, wyliczanie statusów, deadline'y, audyt `completedBy` |
| 6b | Instancje | Tabela z 4 checkboxami per-pole, notatki z ochroną przed nadpisaniem, pod/odpinanie, polling 5 s, tooltipy z `ChangeLog` (jedno zapytanie `DISTINCT ON`) |
| 6c | Komentarze | Sekcja komentarzy + wymuszenie read-only na zamkniętej wersji |
| 7 | Dashboard + archiwum | Karty, progi pilności, `StepDots`, filtr archiwum |
| 8 | Katalog instancji | CRUD + skrypt importu z CSV (sekcja 11) |
| 9 | Panel admina | `TaskTemplate`, konta użytkowników, widok logu zmian z filtrami i paginacją |
| 10 | Dopracowanie | Przejście po wszystkich ekranach, mobile, kontrasty, focus, `prefers-reduced-motion`. Iterujemy na zrzutach ekranu |
| 11 | *(opcjonalny, po MVP)* | SSE + Postgres `LISTEN/NOTIFY` zamiast pollingu |

### Testy — minimalny zakres

Trzy pliki Vitest, nie suite. Dodawaj w kroku, który tworzy daną logikę:

1. `deadline.test.ts` — wyliczanie `releaseDate − daysBeforeRelease`, „ile dni zostało" wobec ustalonego „dzisiaj", `FLEXIBLE`
2. `aggregates.test.ts` — `TICKET_AGGREGATE` (w tym `total = 0`) i `INSTANCE_AGGREGATE` (w tym wszystkie instancje odpięte)
3. `authz.test.ts` — PM dostaje odmowę z reprezentatywnej server action; mutacja na zamkniętej wersji jest odrzucana

---

## 13. Częste błędy — nie popełniaj ich tutaj

Lista rzeczy, które w tym projekcie łatwo zrobić źle:

1. Autoryzacja tylko w warunkowym renderowaniu, endpointy otwarte.
2. Odczyt `TaskTemplate` bezpośrednio w komponentach, z pominięciem `resolveTask` → archiwum zaczyna się zmieniać.
3. `router.refresh()` kasujący tekst wpisywany w `notes`.
4. Zapytanie do `ChangeLog` per flaga → N+1 na widoku wersji.
5. `new Date()` w kliencie do liczenia dni do wydania.
6. `#D9A404` jako kolor tekstu na jasnym tle.
7. `localStorage` na motyw (per-przeglądarka, a wymóg jest per-użytkownik).
8. `prisma db push` zamiast migracji.
9. `delete` na `InstanceTestRun` przy odpinaniu instancji.
10. Rusztowanie pod Jirę, której nie ma w zakresie.
