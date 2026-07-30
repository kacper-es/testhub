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

## Stan

Krok 1 (setup) — szkielet + Docker + połączenie z bazą. Kolejne kroki: patrz
`PROGRESS.md`.
