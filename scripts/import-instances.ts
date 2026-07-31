import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

// Import katalogu instancji z CSV (sekcja 11). Nagłówki: name,clientName,keyFunctionalities.
// Upsert po `name` (Instance.name nie ma @unique, więc ręcznie: findFirst → update/create,
// bez zmiany schematu). Uruchamianie: npm run import:instances -- <plik.csv>.

const prisma = new PrismaClient()

// Minimalny parser CSV: obsługuje pola w cudzysłowach, przecinki i nowe linie
// wewnątrz cudzysłowów oraz escapowany cudzysłów "".
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') {
      field += c
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Użycie: npm run import:instances -- <plik.csv>')
    process.exitCode = 1
    return
  }

  let raw: string
  try {
    raw = readFileSync(file, 'utf8').replace(/^﻿/, '') // strip BOM
  } catch {
    console.error(`Nie można odczytać pliku: ${file}`)
    process.exitCode = 1
    return
  }

  const rows = parseCsv(raw).filter((r) => r.some((c) => c.trim() !== ''))
  if (rows.length === 0) {
    console.error('Plik CSV jest pusty.')
    process.exitCode = 1
    return
  }

  const header = rows[0].map((h) => h.trim().toLowerCase())
  const iName = header.indexOf('name')
  const iClient = header.indexOf('clientname')
  const iKey = header.indexOf('keyfunctionalities')
  if (iName === -1 || iKey === -1) {
    console.error(
      'Wymagane nagłówki: name, clientName, keyFunctionalities (clientName opcjonalny w danych).',
    )
    process.exitCode = 1
    return
  }

  let added = 0
  let updated = 0
  const skipped: string[] = []

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]
    const name = (cells[iName] ?? '').trim()
    const clientRaw = iClient === -1 ? '' : (cells[iClient] ?? '').trim()
    const keyFunctionalities = (cells[iKey] ?? '').trim()

    if (!name) {
      skipped.push(`wiersz ${r + 1}: brak nazwy`)
      continue
    }
    if (!keyFunctionalities) {
      skipped.push(`wiersz ${r + 1} (${name}): brak kluczowych funkcjonalności`)
      continue
    }

    const clientName = clientRaw.length > 0 ? clientRaw : null

    // Upsert po name (bez @unique): znajdź istniejącą, inaczej utwórz.
    const existing = await prisma.instance.findFirst({ where: { name } })
    if (existing) {
      await prisma.instance.update({
        where: { id: existing.id },
        data: { clientName, keyFunctionalities },
      })
      updated++
    } else {
      await prisma.instance.create({
        data: { name, clientName, keyFunctionalities },
      })
      added++
    }
  }

  console.log(
    `Import zakończony: dodano ${added}, zaktualizowano ${updated}, pominięto ${skipped.length}.`,
  )
  for (const reason of skipped) {
    console.log(`  - ${reason}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
