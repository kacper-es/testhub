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
![tests](https://img.shields.io/badge/testy-33%20passing-3B6D11?style=flat-square)

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
| ✏️ **Edycja wersji** | Osobny ekran: zmiana nazwy, daty wydania, aplikacji i kroków wersji (terminy się przesuwają) |
| 🗄️ **Archiwum** | Wersje wydane i anulowane z powodem i filtrami |
| 🛠️ **Panel admina** | Szablony zadań, aplikacje (z ikonami), katalog instancji, kroki i szablony (flow), konta, log zmian |
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
| `/versions/[id]` | Widok wersji: checklista, instancje, komentarze | wszyscy |
| `/versions/[id]/edit` | Edycja wersji (nazwa, data, aplikacja) | TESTER/ADMIN |
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
`requireRole()` po stronie serwera; zero hard delete (dezaktywacja przez `isActive`,
odpinanie przez `excludedAt`); każda mutacja audytowana w `ChangeLog` w tej samej
transakcji. Pełny zestaw niezmienników → [`CLAUDE.md`](CLAUDE.md).

## 📌 Stan

**MVP kompletne (kroki 1–10)** + iteracje UX (wspólny header z nawigacją i okruszkami,
katalog instancji w panelu admina, osobny ekran edycji wersji). Opcjonalny krok 11
(SSE + `LISTEN/NOTIFY`) — po MVP. Szczegóły i historia decyzji → [`PROGRESS.md`](PROGRESS.md).
