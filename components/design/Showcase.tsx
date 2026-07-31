'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { StepDots } from '@/components/ui/StepDots'
import { DataTable, type Column } from '@/components/ui/DataTable'

type Row = { name: string; client: string; progress: string }

const rows: Row[] = [
  { name: 'Klient A — produkcja-mirror', client: 'Klient A', progress: '4/4' },
  { name: 'Klient B — staging', client: 'Klient B', progress: '2/4' },
  { name: 'Środowisko wewnętrzne', client: '—', progress: '0/4' },
]

const columns: Column<Row>[] = [
  { key: 'name', header: 'Instancja', render: (r) => r.name },
  { key: 'client', header: 'Klient', render: (r) => r.client },
  {
    key: 'progress',
    header: 'Postęp',
    mono: true,
    render: (r) => r.progress,
  },
]

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-mono text-xs uppercase tracking-wide text-muted">
        {title}
      </h3>
      {children}
    </section>
  )
}

export function Showcase() {
  const [a, setA] = useState(true)
  const [b, setB] = useState(false)

  return (
    <div className="flex flex-col gap-6 rounded-lg bg-bg p-5 text-fg">
      <Section title="Typografia">
        <p className="text-lg">IBM Plex Sans — nagłówki i treść.</p>
        <p className="font-mono text-sm">
          JetBrains Mono — dane, statusy, 2.4.1, 12/40, 2026-07-31
        </p>
      </Section>

      <Section title="Button">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
      </Section>

      <Section title="StatusBadge">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="pass">Gotowe</StatusBadge>
          <StatusBadge status="warn">W trakcie</StatusBadge>
          <StatusBadge status="fail">Po terminie</StatusBadge>
          <StatusBadge status="neutral">Nie rozpoczęto</StatusBadge>
        </div>
      </Section>

      <Section title="Checkbox (animacja)">
        <div className="flex flex-col gap-2">
          <Checkbox checked={a} onCheckedChange={setA} label="Backend podbity" />
          <Checkbox checked={b} onCheckedChange={setB} label="Testy wykonane" />
          <Checkbox checked disabled label="Zablokowany (read-only)" />
        </div>
      </Section>

      <Section title="StepDots">
        <div className="flex flex-col gap-2">
          <StepDots done={3} total={5} />
          <StepDots done={12} total={40} />
          <StepDots done={140} total={200} />
          <StepDots done={0} total={0} />
        </div>
      </Section>

      <Section title="Card + DataTable">
        <Card>
          <DataTable columns={columns} rows={rows} getRowKey={(r) => r.name} />
        </Card>
      </Section>
    </div>
  )
}
