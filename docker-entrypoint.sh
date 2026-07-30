#!/bin/sh
set -e

# Krok 1: brak katalogu prisma/migrations -> pomijamy migrate deploy (no-op).
# Od kroku 2: realne migracje uruchamiane; ich błąd zatrzymuje start kontenera.
# Świadomie BEZ `|| true`, żeby nie maskować prawdziwych błędów migracji.
if [ -d prisma/migrations ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "Running prisma migrate deploy..."
  node ./node_modules/prisma/build/index.js migrate deploy
else
  echo "No migrations yet — skipping migrate deploy (krok 1)"
fi

exec node server.js
