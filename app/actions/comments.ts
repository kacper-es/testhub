'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth/authz'
import { assertVersionEditable } from '@/lib/versions/guard'
import { commentSchema } from '@/lib/validation/comment'

export type CommentResult = { error?: string }

// Dodanie komentarza. PM jest pełnym read-only (sekcja 5) — dopuszczeni tylko
// TESTER/ADMIN. Zamknięta wersja odrzuca dodawanie (reguła 12). Komentarze nie
// idą do ChangeLog (reguła 27).
export async function addComment(
  versionId: string,
  content: string,
): Promise<CommentResult> {
  const user = await requireRole(['TESTER', 'ADMIN'])
  const parsed = commentSchema.safeParse({ content })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Nieprawidłowy komentarz' }
  }

  const version = await prisma.version.findUnique({
    where: { id: versionId },
    select: { status: true },
  })
  if (!version) return { error: 'Nie znaleziono wersji' }
  assertVersionEditable(version.status)

  await prisma.versionComment.create({
    data: { versionId, authorId: user.id, content: parsed.data.content },
  })

  revalidatePath(`/versions/${versionId}`)
  return {}
}
