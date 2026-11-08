<div align="center">

# 🚀 Release Hub

**Wewnętrzny hub przygotowania wydań** — checklisty QA, instancje testowe
i pełny audyt zmian w jednym miejscu. Dla 4 testerów QA i 3 PM-ów.

![Next.js](https://img.shields.io/badge/Next.js-15.5-000?style=flat-square&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?style=flat-square&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)
![tests](https://img.shields.io/badge/testy-110%20passing-3B6D11?style=flat-square)

[Specyfikacja](PROMPT-release-hub-mvp.md) ·
[Reguły projektu](CLAUDE.md) ·
[Postęp](PROGRESS.md)

</div>

---

## ✨ Co potrafi

| | |
|---|---|
| 📋 **Dashboard** | Wersje w przygotowaniu z odliczaniem do wydania, postępem i gotowością instancji |
| ✅ **Checklista wersji** | Trzy typy zadań (checkbox, licznik zgłoszeń, agregat instancji) z deadline'ami i progami pilności |
| 🖥️ **Instancje testowe** | Tabela środowisk z konfigurowalnymi krokami (kolumnami) gotowości, notatkami i podpinaniem/odpinaniem |
| ✏️ **Edycja wersji** | Osobny ekran: zmiana nazwy, daty wydania, aplikacji, kroków i zadań wersji (dokładanie szablonów dodanych później) |
| 🗄️ **Archiwum** | Wersje wydane i anulowane z powodem i filtrami |
| 🛠️ **Panel admina** | Szablony zadań, aplikacje (z ikonami), katalog instancji, kroki i szablony (flow), konta, log zmian |
| 🔗 **Jira Cloud** | Read-only: test połączenia, mapowanie aplikacji na projekt i wersji na fixVersion, ręczna synchronizacja ticketów (ADMIN), lista ticketów w wersji i licznik z Jiry |
| 🌗 **Motywy** | Jasny / ciemny / systemowy, bez migotania, zapisywane per użytkownik |
| 🔄 **Na żywo** | Polling co 5 s na dashboardzie i widoku wersji |
| 🔐 **Bezpieczeństwo** | Autoryzacja per rola po stronie serwera, audyt zmian w `ChangeLog` |

## 🗺️ Role

| Rola | Może |
|---|---|
| **ADMIN** | Wszystko + panel administratora + ponowne otwarcie zamkniętej wersji |
| **TESTER** | Prowadzi wersje: tworzenie i edycja, checklisty, flagi instancji, komentarze |
| **PM** | Podgląd wszystkiego — tylko do odczytu |

## 🚀 Szybki start (Docker)

```bash
cp .env.example .env      # uzupełnij wartości
docker compose up --build
```

- Aplikacja → **http://localhost:3000**
- Health check bazy → **http://localhost:3000/health** → „Baza: OK"

Postgres trzyma dane w named volume `pgdata` — przetrwają `docker compose down`.

### Zmienne środowiskowe

| Zmienna | Opis |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Dane bazy (usługa `db`) |
| `SESSION_SECRET` | Długi losowy ciąg: `openssl rand -hex 32` |
| `COOKIE_SECURE` | Puste = cookie z flagą `secure` (wymaga HTTPS). `false` tylko przy serwowaniu po zwykłym HTTP |
| `DATABASE_URL` | Tylko dla lokalnych narzędzi (host `localhost`); w kontenerze nadpisywany na host `db` |
| `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` | Opcjonalne — puste = integracja nieskonfigurowana |

## 🏢 Wdrożenie (Docker Swarm + Portainer)

Produkcja używa gotowego obrazu z `ghcr.io` i pliku [`docker-stack.yml`](docker-stack.yml)
(`docker-compose.yml` służy tylko do lokalnego rozwoju — buduje obraz i wystawia port bazy).
Ten sam plik działa też jako zwykły stack compose w Portainerze bez Swarma.

1. **Etykiety nodów** (raz). Baza i aplikacja są przypięte do nodów z etykietami
   (wolumen Postgresa jest lokalny dla noda) — Portainer: **Swarm → nod → Labels**
   (`releasehub.db` = `true`, `releasehub.app` = `true`) albo:
   ```bash
   docker node update --label-add releasehub.db=true <nod>
   docker node update --label-add releasehub.app=true <nod>
   ```
   Obie etykiety mogą być na tym samym nodzie. Bez etykiety usługa czeka ze stanem
   „no suitable node". Przy dodawaniu etykiety do działającego stacka: najpierw etykieta,
   potem redeploy.
2. Portainer → **Stacks → Add stack**: wklej `docker-stack.yml` (**Web editor**) albo wskaż
   repozytorium i ścieżkę `docker-stack.yml` (**Repository**).
3. **Environment variables** stacka — wartości z tabeli wyżej (nowe hasło bazy, nowy
   `SESSION_SECRET`) oraz:

   | Zmienna | Opis |
   |---|---|
   | `RELEASEHUB_VERSION` | Wersja obrazu, np. `1.0.0` (domyślnie `latest` — przypnij wersję) |
   | `RELEASEHUB_PORT` | Port publikowany na nodach (domyślnie `3000`) |

   `COOKIE_SECURE` zostaw puste, gdy przed aplikacją jest HTTPS (patrz niżej).
4. **Deploy the stack.** Przy pierwszym starcie aplikacja może kilka razy się zrestartować
   z `P1001: Can't reach database server` — Swarm nie czeka na bazę (`depends_on` jest
   ignorowane), więc kontener startuje ponownie, aż baza wstanie. Potem `migrate deploy`
   i założenie domyślnego admina (patrz niżej). Usługa `app` ma healthcheck na `/health`.
5. Zaloguj się domyślnym kontem i ustaw własne hasło.

**Aktualizacja:** nowy tag (`git tag vX.Y.Z` → obraz w ghcr.io), w stacku zmień
`RELEASEHUB_VERSION` i zrób redeploy. Stara wersja jest zatrzymywana przed startem nowej
(migracje nie biegną obok niej); gdy nowa nie przejdzie healthchecka, Swarm wraca do poprzedniej.

**Reverse proxy z HTTPS (np. HAProxy na osobnej maszynie):**

- backend: `<dowolny nod Swarma>:3000` (routing mesh przekieruje do kontenera),
- TLS kończony na proxy, nagłówek `X-Forwarded-Proto: https`,
- **nie przepisuj nagłówka `Host`** — Server Actions w Next.js porównują `Origin` z `Host`;
  zmieniony `Host` psuje wszystkie formularze,
- `COOKIE_SECURE` w stacku puste (cookie z flagą `secure`).

> **Objaw: po zalogowaniu każdy formularz (np. zmiana hasła) wraca na `/login`, nic się nie
> zapisuje.** Strona jest otwarta przez `http://` (np. `http://<nod>:3000`), a cookie sesji
> ma flagę `secure` — przeglądarka je odrzuca. Ekran logowania pokazuje wtedy ostrzeżenie,
> a w logach `app` jest „Login from http://… over plain HTTP". Wejdź przez `https://`
> albo (tymczasowo, bez proxy) ustaw `COOKIE_SECURE=false`.

Kopia zapasowa bazy jest poza aplikacją — np. `pg_dump` z crona na nodzie z etykietą.

### Obraz i wydawanie wersji

Gotowy obraz: **`ghcr.io/kacper-es/testhub`** (tagi `X.Y.Z`, `X.Y`, `latest`).
Buduje go GitHub Actions ([`.github/workflows/release.yml`](.github/workflows/release.yml)):

- każdy push na `main` i PR → `npm run check` + testy,
- tag `v*` → te same testy, potem build i publikacja obrazu:

```bash
git tag v1.0.0
git push origin v1.0.0
```

### Pierwsze uruchomienie — domyślny admin

Przy starcie na **pustej** bazie (zero kont) aplikacja zakłada konto administratora:

| Login | Hasło |
|---|---|
| `admin@example.com` | `admin` |

Pierwsze logowanie wymusza zmianę hasła — bez tego żaden ekran nie jest dostępny.
Konto powstaje tylko raz: gdy w bazie jest jakiekolwiek konto (także nieaktywne),
nic się nie dzieje. Pozostałe konta admin zakłada w `/admin/users`.
**Nie uruchamiaj `npm run seed` na produkcji** — to dane deweloperskie.

## 🧑‍💻 Rozwój lokalny

```bash
npm install               # zależności + klient Prisma (postinstall)
npm run check             # tsc --noEmit && next lint — musi przejść przed commitem
npm run dev               # dev server (wymaga uruchomionego Postgresa)
```

Lokalne narzędzia Prisma (`npx prisma migrate dev`) korzystają z `DATABASE_URL`
z `.env` (host `localhost`). W kontenerze `docker-compose.yml` nadpisuje ten
adres na host `db`.

> **Migracje wyłącznie przez `npx prisma migrate dev --name <opis>`** — nigdy `prisma db push`.

## 🌱 Seed danych

```bash
npm run seed
```

Idempotentny (`upsert`) — można uruchamiać wielokrotnie, nie tworzy duplikatów.
Ładuje **4 użytkowników, 6 szablonów zadań, 5 instancji, 2 aplikacje oraz 4 kroki
i domyślny szablon (flow)**. Uruchamiany
lokalnie przeciw `DATABASE_URL` z `.env` (baza w kontenerze na `localhost:5432`);
**nie** jest częścią `docker compose up`.

### Konta (seed) — dane deweloperskie

Wszystkie z `mustChangePassword: false` i wspólnym hasłem **`Dev12345!`**.
W produkcji admin ustawia własne hasła — nie używaj tych wartości poza dev.
Jeśli aplikacja wystartowała na pustej bazie przed seedem, w bazie jest też
domyślne konto `admin@example.com` (patrz „Pierwsze uruchomienie”).

| Email | Rola |
|---|---|
| `admin@releasehub.local` | ADMIN |
| `tester1@releasehub.local` | TESTER |
| `tester2@releasehub.local` | TESTER |
| `pm@releasehub.local` | PM |

## 🧭 Ekrany

| Ścieżka | Opis | Dostęp |
|---|---|---|
| `/` | Dashboard — wersje w przygotowaniu | wszyscy |
| `/versions` | Zarządzanie wersjami | wszyscy · akcje: TESTER/ADMIN |
| `/versions/new` | Nowa wersja | TESTER/ADMIN |
| `/versions/[id]` | Widok wersji: checklista, instancje, komentarze · usuwanie (ADMIN) | wszyscy |
| `/versions/[id]/edit` | Edycja wersji (nazwa, data, aplikacja, kroki, zadania, instancje) | TESTER/ADMIN |
| `/archive` | Archiwum (wydane / anulowane) | wszyscy |
| `/admin` | Panel administratora | ADMIN |

<details>
<summary><strong>Podstrony panelu admina</strong></summary>

| Ścieżka | Opis |
|---|---|
| `/admin/templates` | Szablony zadań (dodawanie, edycja, kolejność, dezaktywacja) |
| `/admin/applications` | Aplikacje + ikony (upload z urządzenia) |
| `/admin/instances` | Katalog instancji (CRUD, import z CSV) |
| `/admin/columns` | Konfiguracja kroków (kolumn tabeli instancji) i szablonów (flow) |
| `/admin/users` | Konta (tworzenie, reset hasła, rola, dezaktywacja) |
| `/admin/changelog` | Log zmian z filtrami i paginacją |
| `/admin/jira` | Stan konfiguracji Jira i test połączenia |

</details>

## ⚙️ Komendy

| Komenda | Opis |
|---|---|
| `docker compose up --build` | uruchomienie całości |
| `npm run dev` | dev server |
| `npm run check` | `tsc --noEmit && next lint` — przed commitem |
| `npm run test` | testy (`vitest`) |
| `npm run seed` | idempotentny seed |
| `npm run import:instances -- plik.csv` | import instancji z CSV |
| `npx prisma migrate dev --name <opis>` | migracja bazy |

## 🧱 Stack

**Next.js 15 (App Router)** · **TypeScript** · **Prisma 6** · **PostgreSQL 16** ·
**Tailwind 3** (tokeny CSS variables, oba motywy) · **Vitest** · jeden kontener
**Docker** na firmowym VM.

Mutacje przez **Server Actions** z walidacją `zod`; autoryzacja wyłącznie przez
`requireRole()` po stronie serwera; zero hard delete poza usuwaniem wersji przez ADMIN (dezaktywacja przez `isActive`,
odpinanie przez `excludedAt`); każda mutacja audytowana w `ChangeLog` w tej samej
transakcji. Pełny zestaw niezmienników → [`CLAUDE.md`](CLAUDE.md).

## 📄 Licencja

[MIT](LICENSE)

## 📌 Stan

**MVP kompletne (kroki 1–10)** + iteracje UX (wspólny header z nawigacją i okruszkami,
katalog instancji w panelu admina, osobny ekran edycji wersji), konfigurowalne kroki
i szablony z kolejnością drag-and-drop oraz integracja Jira — kroki J-1 i J-2 (połączenie,
mapowanie); synchronizacja ticketów (J-3) i widok ticketów z licznikiem (J-4); pola własne i automat (J-5, J-6) w toku. Wdrożenie produkcyjne (Swarm + Portainer, krok D-1) gotowe; dokładanie zadań i usuwanie wersji (V-1, V-2).
Opcjonalny krok 11 (SSE + `LISTEN/NOTIFY`) — po MVP. Szczegóły i historia decyzji → [`PROGRESS.md`](PROGRESS.md).
