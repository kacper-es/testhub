import type { JiraProjectVersion } from '@/lib/jira/client'

// Wersje Jira do wyboru przy podpinaniu: niewydane i niezarchiwizowane, plus aktualnie
// podpięta (nawet wydana), żeby nie zniknęła z listy. Sortowanie: data wydania rosnąco
// (bez daty na końcu), potem nazwa.
export function selectableJiraVersions(
  versions: JiraProjectVersion[],
  currentId: string | null,
): JiraProjectVersion[] {
  return versions
    .filter((v) => v.id === currentId || (!v.released && !v.archived))
    .sort((a, b) => {
      if (a.releaseDate !== b.releaseDate) {
        if (a.releaseDate === null) return 1
        if (b.releaseDate === null) return -1
        return a.releaseDate < b.releaseDate ? -1 : 1
      }
      return a.name.localeCompare(b.name, 'pl')
    })
}
