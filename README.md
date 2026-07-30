# Release Hub

Wewnętrzna aplikacja do przygotowania wydań (4 testerów QA, 3 PM-ów).
Next.js App Router + TypeScript + Prisma + Postgres, jeden kontener Docker.

Specyfikacja: [`PROMPT-release-hub-mvp.md`](PROMPT-release-hub-mvp.md) ·
reguły: [`CLAUDE.md`](CLAUDE.md) · postęp: [`PROGRESS.md`](PROGRESS.md).

## Uruchomienie (Docker)

```
cp .env.example .env      # uzupełnij wartości
docker compose up --build
```

- Aplikacja: http://localhost:3000
- Health check bazy: http://localhost:3000/health → „Baza: OK"

Postgres trzyma dane w named volume `pgdata` — przetrwają `docker compose down`.

## Rozwój lokalny

```
npm install               # instaluje zależności, generuje klienta Prisma (postinstall)
npm run check             # tsc --noEmit && next lint — musi przejść przed commitem
npm run dev               # dev server (wymaga uruchomionego Postgresa)
```

Lokalne narzędzia Prisma (`npx prisma migrate dev`) korzystają z `DATABASE_URL`
z `.env` (host `localhost`). W kontenerze `docker-compose.yml` nadpisuje ten
adres na host `db`.

## Seed danych

```
npm run seed
```

Idempotentny (`upsert`) — można uruchamiać wielokrotnie, nie tworzy duplikatów.
Ładuje 4 użytkowników, 6 szablonów zadań i 5 instancji. Uruchamiany lokalnie
przeciw `DATABASE_URL` z `.env` (baza w kontenerze na `localhost:5432`); **nie**
jest częścią `docker compose up`.

### Konta (seed) — dane deweloperskie

Wszystkie z `mustChangePassword: false` i wspólnym hasłem **`Dev12345!`**.
W produkcji admin ustawia własne hasła — nie używaj tych wartości poza dev.

| Email | Rola |
|---|---|
| `admin@releasehub.local` | ADMIN |
| `tester1@releasehub.local` | TESTER |
| `tester2@releasehub.local` | TESTER |
| `pm@releasehub.local` | PM |

## Stan

Kroki 1–4 gotowe (setup, schema, sesje, autoryzacja, seed). Kolejne kroki: patrz
`PROGRESS.md`.
