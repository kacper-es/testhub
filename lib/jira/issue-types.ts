// J-7: breakdown of a version's Jira tickets by the issue types chosen by ADMIN.
// Pure module (no Prisma) — used by the version page and tests.

type IssueLike = { issueType: string; statusCategory: string }

export type TypeGroup<T extends IssueLike> = {
  name: string
  issues: T[]
  done: number
}

export type TypeBreakdown<T extends IssueLike> = {
  groups: TypeGroup<T>[] // one per tracked type, in the given order (also when empty)
  other: TypeGroup<T> & { typeCount: number } // everything else, collapsed as "Inne"
}

function group<T extends IssueLike>(name: string, issues: T[]): TypeGroup<T> {
  return { name, issues, done: issues.filter((i) => i.statusCategory === 'done').length }
}

// Matching is exact (Jira type names are case-sensitive labels, e.g. "Bug prod").
// Issue order inside a group follows the input order.
export function groupIssuesByType<T extends IssueLike>(
  issues: T[],
  trackedTypes: string[],
): TypeBreakdown<T> {
  const tracked = new Set(trackedTypes)
  const groups = trackedTypes.map((name) =>
    group(
      name,
      issues.filter((i) => i.issueType === name),
    ),
  )
  const rest = issues.filter((i) => !tracked.has(i.issueType))
  return {
    groups,
    other: { ...group('Inne', rest), typeCount: new Set(rest.map((i) => i.issueType)).size },
  }
}

// Options for the ADMIN picker: every type seen in synced tickets plus every
// currently tracked type (even with no tickets), alphabetically.
export function trackedTypeOptions(
  seen: { issueType: string; count: number }[],
  active: string[],
): { name: string; count: number; checked: boolean }[] {
  const counts = new Map(seen.filter((s) => s.issueType !== '').map((s) => [s.issueType, s.count]))
  const activeSet = new Set(active)
  const names = new Set([...counts.keys(), ...active])
  return [...names]
    .sort((a, b) => a.localeCompare(b, 'pl'))
    .map((name) => ({ name, count: counts.get(name) ?? 0, checked: activeSet.has(name) }))
}
