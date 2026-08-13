import { redirect } from 'next/navigation'

// Lista szablonów żyje w zakładce na /admin/columns. Ta trasa istnieje tylko po to,
// by okruszek „Szablony" (segment /flows) miał dokąd prowadzić.
export default function FlowsIndexPage() {
  redirect('/admin/columns?tab=flows')
}
