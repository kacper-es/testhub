import { PrismaClient, Prisma } from '@prisma/client'
import { hashPassword } from '../lib/auth/password'

const prisma = new PrismaClient()

// Wspólne hasło dev — udokumentowane w README. mustChangePassword: false, więc
// zaseedowani użytkownicy logują się od razu (w produkcji admin zmienia hasła).
const DEV_PASSWORD = 'Dev12345!'

async function seedUsers() {
  const passwordHash = await hashPassword(DEV_PASSWORD)

  const users: Prisma.UserCreateInput[] = [
    {
      email: 'admin@releasehub.local',
      name: 'Admin',
      role: 'ADMIN',
      passwordHash,
      mustChangePassword: false,
    },
    {
      email: 'tester1@releasehub.local',
      name: 'Marek Kowalski',
      role: 'TESTER',
      passwordHash,
      mustChangePassword: false,
    },
    {
      email: 'tester2@releasehub.local',
      name: 'Anna Nowak',
      role: 'TESTER',
      passwordHash,
      mustChangePassword: false,
    },
    {
      email: 'pm@releasehub.local',
      name: 'Piotr Zieliński',
      role: 'PM',
      passwordHash,
      mustChangePassword: false,
    },
  ]

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    })
  }
}

async function seedTaskTemplates() {
  // TaskTemplate.name nie jest @unique (sekcja 3), więc idempotencja po
  // deterministycznym id. Po dwa szablony każdego typu, mieszanka deadlineType.
  const templates: Prisma.TaskTemplateUncheckedCreateInput[] = [
    {
      id: 'seed-tpl-checkbox-notes',
      name: 'Release notes dla klienta',
      description: 'Przygotuj i wyślij notatki wydania do klienta.',
      taskType: 'CHECKBOX',
      deadlineType: 'DAYS_BEFORE_RELEASE',
      daysBeforeRelease: 3,
      sortOrder: 10,
    },
    {
      id: 'seed-tpl-checkbox-scope',
      name: 'Zatwierdzenie zakresu wydania',
      description: 'Potwierdź z PM ostateczny zakres wersji.',
      taskType: 'CHECKBOX',
      deadlineType: 'FLEXIBLE',
      sortOrder: 20,
    },
    {
      id: 'seed-tpl-ticket-verify',
      name: 'Weryfikacja zgłoszeń',
      description: 'Sprawdź, że wszystkie zaplanowane zgłoszenia są rozwiązane.',
      taskType: 'TICKET_AGGREGATE',
      deadlineType: 'DAYS_BEFORE_RELEASE',
      daysBeforeRelease: 5,
      sortOrder: 30,
    },
    {
      id: 'seed-tpl-ticket-critical',
      name: 'Poprawki błędów krytycznych',
      description: 'Domknij krytyczne błędy blokujące wydanie.',
      taskType: 'TICKET_AGGREGATE',
      deadlineType: 'FLEXIBLE',
      sortOrder: 40,
    },
    {
      id: 'seed-tpl-instance-ready',
      name: 'Gotowość środowisk testowych',
      description: 'Wszystkie środowiska odtworzone i podbite.',
      taskType: 'INSTANCE_AGGREGATE',
      deadlineType: 'DAYS_BEFORE_RELEASE',
      daysBeforeRelease: 2,
      sortOrder: 50,
    },
    {
      id: 'seed-tpl-instance-tested',
      name: 'Testy na wszystkich instancjach',
      description: 'Testy wykonane na każdej podpiętej instancji.',
      taskType: 'INSTANCE_AGGREGATE',
      deadlineType: 'FLEXIBLE',
      sortOrder: 60,
    },
  ]

  for (const template of templates) {
    await prisma.taskTemplate.upsert({
      where: { id: template.id },
      update: {},
      create: template,
    })
  }
}

async function seedInstances() {
  // Instance.name nie jest @unique — idempotencja po deterministycznym id.
  const instances: Prisma.InstanceUncheckedCreateInput[] = [
    {
      id: 'seed-inst-klient-a',
      name: 'Klient A — produkcja-mirror',
      clientName: 'Klient A',
      keyFunctionalities: 'Moduł płatności, integracja z bramką, raporty sprzedaży.',
    },
    {
      id: 'seed-inst-klient-b',
      name: 'Klient B — staging',
      clientName: 'Klient B',
      keyFunctionalities: 'Zarządzanie użytkownikami, eksport danych, powiadomienia.',
    },
    {
      id: 'seed-inst-klient-c',
      name: 'Klient C — UAT',
      clientName: 'Klient C',
      keyFunctionalities: 'Katalog produktów, koszyk, proces zamówienia.',
    },
    {
      // Środowisko wewnętrzne — bez clientName.
      id: 'seed-inst-internal',
      name: 'Środowisko wewnętrzne — integracja',
      keyFunctionalities: 'Wspólny backend, testy integracyjne między modułami.',
    },
    {
      id: 'seed-inst-klient-d',
      name: 'Klient D — produkcja-mirror',
      clientName: 'Klient D',
      keyFunctionalities: 'Panel administracyjny, uprawnienia, audyt operacji.',
    },
  ]

  for (const instance of instances) {
    await prisma.instance.upsert({
      where: { id: instance.id },
      update: {},
      create: instance,
    })
  }
}

async function seedApplications() {
  // Przykładowe aplikacje bez ikon (ikony wgrywa admin z urządzenia).
  // Idempotencja po deterministycznym id.
  const apps: Prisma.ApplicationUncheckedCreateInput[] = [
    { id: 'seed-app-portal', name: 'Portal klienta', sortOrder: 10 },
    { id: 'seed-app-mobile', name: 'Aplikacja mobilna', sortOrder: 20 },
  ]

  for (const app of apps) {
    await prisma.application.upsert({
      where: { id: app.id },
      update: {},
      create: app,
    })
  }
}

async function main() {
  await seedUsers()
  await seedTaskTemplates()
  await seedInstances()
  await seedApplications()

  const [users, templates, instances, applications] = await Promise.all([
    prisma.user.count(),
    prisma.taskTemplate.count(),
    prisma.instance.count(),
    prisma.application.count(),
  ])
  console.log(
    `Seed done: users=${users}, taskTemplates=${templates}, instances=${instances}, applications=${applications}`,
  )
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
